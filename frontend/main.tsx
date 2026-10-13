import React, { useCallback, useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  actors,
  names,
  suppliers as defaultSuppliers,
  today,
  type Actor,
  type Payment,
  type Audit,
  type Report,
  type Input,
} from "./model";
import { makeDemo, money, title, short } from "./workspace";
import {
  Icon,
  Badge,
  Empty,
  Skeleton,
  Overlay,
  exportJson,
} from "./components/ui";
import { ActivityChart } from "./components/ActivityChart";
import { PaymentTable } from "./components/PaymentTable";
import { PaymentForm } from "./components/PaymentForm";
import { PaymentDrawer } from "./components/PaymentDrawer";
import "./style.css";
import "./theme.css";
import "./website.css";
import { Website, PaymentTracker, Arrow } from "./Website";
import { Business } from "./Business";
import { createDemoSession } from "./demo-session";
const apiMode = new URLSearchParams(location.search).get("mode") === "api";
const demoSession = apiMode ? null : createDemoSession();
const demo = demoSession?.state || null;
type Config = {
  suppliers: typeof defaultSuppliers;
  balance?: string;
  dailySpent?: string;
  dailyLimit: string;
  threshold: string;
  chainId: number;
  treasury?: string;
  failpoints?: boolean;
};
type Notice = { id: number; message: string; error: boolean };
const freshDraft = (): Input => ({
  id: crypto.randomUUID(),
  recipient: "",
  invoice: "",
  amount: "",
  dueDate: today(),
});
const nav = [
  ["Payments", "payments"],
  ["Reconciliation", "reconcile"],
  ["Activity", "clock"],
];
function App() {
  const [home, setHome] = useState(!apiMode && !location.hash.startsWith("#workspace")),
    [tracker, setTracker] = useState(false),
    [resetDialog, setResetDialog] = useState(false),
    [page, setPage] = useState(() => {
      const requested = decodeURIComponent(location.hash.split("/")[1] || "Payments");
      return ["Payments", "Overview", "Reconciliation", "Activity", "Policy & recipients", "Demo lab"].includes(requested) ? requested : "Payments";
    }),
    [actor, setActor] = useState<Actor>("creator"),
    [password, setPassword] = useState(""),
    [connected, setConnected] = useState(!apiMode),
    [config, setConfig] = useState<Config>({
      suppliers: defaultSuppliers,
      dailyLimit: "25000",
      threshold: "5000",
      chainId: 31337,
    }),
    [payments, setPayments] = useState<Payment[]>(demo?.payments || []),
    [audit, setAudit] = useState<Audit[]>(demo?.audit || []),
    [report, setReport] = useState<Report | null>(null),
    [loading, setLoading] = useState(apiMode),
    [busy, setBusy] = useState(""),
    [networkError, setNetworkError] = useState(""),
    [error, setError] = useState(""),
    [notices, setNotices] = useState<Notice[]>([]),
    [toast, setToast] = useState<Notice | null>(null),
    [selected, setSelected] = useState<string | null>(null),
    [filter, setFilter] = useState("ALL"),
    [form, setForm] = useState(false),
    [draft, setDraft] = useState<Input>(freshDraft),
    [showNotifications, setShowNotifications] = useState(false),
    [lastSync, setLastSync] = useState<Date | null>(null),
    [scenario, setScenario] = useState<ReturnType<
      NonNullable<typeof demo>["scenario"]
    > | null>(null),
    [auditQuery, setAuditQuery] = useState(""),
    [auditAction, setAuditAction] = useState("ALL");
  const epoch = useRef(0),
    inFlight = useRef(false),
    paymentRef = useRef(payments);
  paymentRef.current = payments;
  const notify = useCallback((message: string, isError = false) => {
    const n = { id: Date.now(), message, error: isError };
    setToast(n);
    setNotices((x) => [n, ...x].slice(0, 30));
  }, []);
  const api = useCallback(
    async (path: string, body?: unknown) => {
      const res = await fetch("/api" + path, {
        method: body === undefined ? "GET" : "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Basic " + btoa(actor + ":" + password),
        },
        signal: AbortSignal.timeout(15000),
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      const data = await res
        .json()
        .catch(() => ({
          error:
            res.status === 401
              ? "Your account or password is incorrect."
              : "The server did not return a valid response.",
        }));
      if (!res.ok) throw Error(data.error || `Request failed (${res.status}).`);
      return data;
    },
    [actor, password],
  );
  const refresh = useCallback(async () => {
    const version = ++epoch.current;
    try {
      if (apiMode) {
        const [c, p, a] = await Promise.all([
          api("/config"),
          api("/payments"),
          api("/audit"),
        ]);
        if (version !== epoch.current) return;
        setConfig(c);
        setPayments(p);
        setAudit(a);
      } else if (demo) {
        demoSession?.rollover();
        demoSession?.save();
        setConfig({
          ...demo.config,
          balance: String(
            500000 -
              [...demo.chain.values()]
                .filter((p) => p.status === "SETTLED")
                .reduce((s, p) => s + Number(p.amount), 0),
          ),
          dailySpent: String(Number(demo.spent) / 1e6),
        });
        setPayments(structuredClone(demo.payments));
        setAudit(structuredClone(demo.audit));
      }
      setNetworkError("");
      setLastSync(new Date());
    } catch (e) {
      if (version === epoch.current)
        setNetworkError(
          (e as Error).message || "Could not reach the treasury service.",
        );
      throw e;
    } finally {
      if (version === epoch.current) setLoading(false);
    }
  }, [api]);
  useEffect(() => {
    if (!connected) return;
    setLoading(true);
    void refresh().catch(() => {});
    const timer = setInterval(() => {
      if (!inFlight.current && document.visibilityState === "visible")
        void refresh().catch(() => {});
    }, 5000);
    return () => {
      clearInterval(timer);
      epoch.current++;
    };
  }, [connected, refresh]);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 6500);
    return () => clearTimeout(t);
  }, [toast]);
  useEffect(() => {
    const ctx = (document as any).modelContext;
    if (!ctx?.registerTool) return;
    const lifecycle = new AbortController();
    void Promise.resolve(
      ctx.registerTool(
        {
          name: "list_treasury_payments",
          description:
            "Read currently loaded payments and their recorded settlement state.",
          inputSchema: {
            type: "object",
            properties: {},
            additionalProperties: false,
          },
          annotations: { readOnlyHint: true },
          execute: () => ({
            mode: apiMode ? "local-chain" : "browser-simulation",
            payments: paymentRef.current,
          }),
        },
        { signal: lifecycle.signal },
      ),
    ).catch(() => {});
    return () => lifecycle.abort();
  }, []);
  async function run(name: string, fn: () => Promise<void> | void) {
    if (inFlight.current) return;
    inFlight.current = true;
    epoch.current++;
    demoSession?.rollover();
    setBusy(name);
    setError("");
    try {
      await fn();
    } catch (e) {
      const msg = (e as Error).message || "The request failed. Please retry.";
      setError(msg);
      notify(msg, true);
    } finally {
      try {
        await refresh();
      } catch {}
      setBusy("");
      inFlight.current = false;
    }
  }
  const switchActor = (a: Actor) => {
    setActor(a);
    setError("");
    if (apiMode) {
      epoch.current++;
      setConnected(false);
      setSelected(null);
      setPayments([]);
      setAudit([]);
      setPassword("");
      setReport(null);
    }
  };
  useEffect(() => {
    const route = () => {
      const isWorkspace = location.hash.startsWith("#workspace");
      setHome(!apiMode && !isWorkspace);
      if (isWorkspace) {
        const next = decodeURIComponent(location.hash.split("/")[1] || "Payments");
        if (["Payments", "Overview", "Reconciliation", "Activity", "Policy & recipients", "Demo lab"].includes(next)) setPage(next);
      }
    };
    window.addEventListener("hashchange", route);
    return () => window.removeEventListener("hashchange", route);
  }, []);
  const navigate = (s: string) => {
    setHome(false);
    if (location.hash !== "#workspace/" + encodeURIComponent(s)) history.pushState(null, "", "#workspace/" + encodeURIComponent(s));
    setPage(s);
    window.scrollTo({ top: 0, behavior: "instant" });
    setError("");
  };
  const supplierName = useCallback(
    (id: string) =>
      config.suppliers.find((s) => s.id.toLowerCase() === id.toLowerCase())
        ?.name || short(id),
    [config.suppliers],
  );
  const openCreate = () => {
    setError("");
    setForm(true);
  };
  const submit = () =>
    run("create", async () => {
      if (apiMode) await api("/payments", draft);
      else demo!.create(actor, draft);
      setForm(false);
      setDraft(freshDraft());
      notify("Payment requested. Your approval queue is updated.");
    });
  const act = (kind: string, interrupt = false) =>
    run(kind, async () => {
      if (!selected) return;
      let result: Payment;
      if (apiMode)
        result = await api(
          `/payments/${selected}/${kind}?interrupt=${interrupt}`,
          {},
        );
      else {
        await new Promise((r) => setTimeout(r, 450));
        result = demo!.act(selected, actor, kind, interrupt);
      }
      notify(
        kind === "execute"
          ? result.status === "SETTLED" && result.txHash
            ? "Confirmed settlement recorded. No duplicate transfer."
            : "Execution submitted. Waiting for confirmation."
          : kind === "approve"
            ? "Approval recorded successfully."
            : "Payment rejected. No settlement will be released.",
      );
    });
  const reconcile = () =>
    run("reconcile", async () => {
      const r = apiMode ? await api("/reconcile", {}) : demo!.reconcile();
      setReport(r);
      notify(
        `Reconciliation complete: ${r.matched} matched, ${r.recovered} recovered, ${r.flags.length} exceptions.`,
      );
    });
  const pending = payments.filter((p) => p.status === "PENDING"),
    ready = payments.filter((p) => p.status === "APPROVED"),
    settled = payments.filter((p) => p.status === "SETTLED"),
    chosen = payments.find((p) => p.id === selected);
  const spent = Number(config.dailySpent || 0),
    limit = Number(config.dailyLimit);
  const recent = [...audit].sort(
    (a, b) => b.created_at.localeCompare(a.created_at) || b.id - a.id,
  );
  const date = new Date().toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  const activity = (
    <section className="panel activity-panel">
      <div className="panel-heading">
        <div>
          <h2>Payment activity</h2>
          <p>Decisions, confirmations & recovery</p>
        </div>
        <span className="pulse-dot" />
      </div>
      <div className="activity-list">
        {recent.slice(0, 5).map((a) => (
          <button
            key={a.id}
            className="activity-entry"
            onClick={() => {
              if (payments.some((p) => p.id === a.payment_id))
                setSelected(a.payment_id);
              else navigate("Activity");
            }}
          >
            <span className={"event-mark " + a.action.toLowerCase()}>
              <Icon
                name={
                  ["EXECUTED", "APPROVED", "RECOVERED"].includes(a.action)
                    ? "check"
                    : a.action === "DENIED"
                      ? "alert"
                      : "clock"
                }
                size={15}
              />
            </span>
            <span>
              <b>{title(a.action)}</b>
              <small>
                {payments.find((p) => p.id === a.payment_id)?.invoice ||
                  short(a.payment_id)}
              </small>
              <em>
                {a.actor} ·{" "}
                {new Date(a.created_at).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </em>
            </span>
            <Icon name="chevron" size={14} />
          </button>
        ))}
      </div>
      {!audit.length && (
        <Empty
          title="No activity yet"
          detail="Payment decisions will appear here."
        />
      )}
      <button className="panel-link" onClick={() => navigate("Activity")}>
        View full audit trail
        <Icon name="chevron" size={15} />
      </button>
    </section>
  );
  if (home && connected) return <Website
    payments={payments} audit={audit} suppliers={config.suppliers}
    onNavigate={navigate}
    onCreate={() => { navigate("Payments"); if (actor !== "creator") switchActor("creator"); openCreate(); }}
    onOpenPayment={id => { navigate("Payments"); setSelected(id); setError(""); }}
  />;
  if (!connected)
    return (
      <main className="login-page">
        <div className="login-brand">
          <span className="brand-mark">T</span>TreasuryFlow
        </div>
        <section className="login-card">
          <span className="overline">LOCAL TREASURY WORKSPACE</span>
          <h1>Welcome back.</h1>
          <p>
            Connect to your local payment system with a seeded demo account.
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void run("login", async () => {
                await api("/config");
                setConnected(true);
                notify("Connected to your local treasury.");
              });
            }}
          >
            <label className="field">
              Account
              <select
                value={actor}
                onChange={(e) => setActor(e.target.value as Actor)}
              >
                {actors.map((a) => (
                  <option key={a} value={a}>
                    {names[a]}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              Password
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
            </label>
            {error && (
              <p className="inline-error" role="alert">
                {error}
              </p>
            )}
            <button className="button primary full" disabled={!!busy}>
              {busy ? "Connecting…" : "Connect to treasury"}
            </button>
          </form>
          <p className="hint">
            Use DEMO_PASSWORD from your local setup. Known demo credentials are
            for local development only.
          </p>
        </section>
      </main>
    );
  return (
    <>
      <div id="workspace" className="app-shell rebuilt-workspace">
        <a className="skip-link" href="#main-content">
          Skip to workspace
        </a>
        <div className="app-body">
          <header className="operations-header">
            <button className="operations-brand" onClick={() => { if (apiMode) { navigate("Payments"); return; } setHome(true); history.pushState(null, "", "#home"); window.scrollTo({ top: 0, behavior: "instant" }); }} aria-label={apiMode ? "TreasuryFlow payments" : "TreasuryFlow home"}><span className="site-mark"><Icon name="reconcile" size={23} /></span>TreasuryFlow<span className="wordmark-period">.</span></button>
            <nav aria-label="Main navigation" className="operations-nav">
              {nav.map(([name, icon]) => <button key={name} onClick={() => navigate(name)} aria-current={page === name ? "page" : undefined} className={page === name ? "active" : ""}><Icon name={icon} size={17} />{name}{name === "Payments" && <small>{pending.length}</small>}</button>)}
            </nav>
            <div className="operations-account"><span className="person-avatar">{names[actor][0]}</span><label><span>{apiMode ? "Local account" : "Demo role"}</span><select aria-label="Acting account" value={actor} onChange={e => switchActor(e.target.value as Actor)} disabled={!!busy}>{actors.map(a => <option key={a} value={a}>{names[a]}</option>)}</select></label>{apiMode && <button className="icon-btn" aria-label="Disconnect local account" onClick={() => switchActor(actor)}><Icon name="logout" size={17} /></button>}</div>
          </header>
          <div className="operations-context"><span><i />Northstar Holdings <b>/</b> Finance workspace</span><div>
            <button onClick={() => setTracker(true)}><Icon name="search" size={15} />Track payment</button>
            <button aria-label={`Open notifications, ${notices.length} messages`} onClick={() => setShowNotifications(true)}><Icon name="clock" size={15} />Updates {notices.length > 0 && <b>{notices.length}</b>}</button>
            <details className="workspace-tools"><summary><Icon name="grid" size={15} />Workspace tools<Icon name="chevron" size={12} /></summary><div className="workspace-tools-menu">{[["Overview", "grid"], ["Policy & recipients", "shield"], ["Demo lab", "lab"]].map(([name, icon]) => <button key={name} onClick={e => { navigate(name); e.currentTarget.closest('details')?.removeAttribute('open'); }} aria-current={page === name ? "page" : undefined}><Icon name={icon} size={17} />{name}</button>)}</div></details>
          </div></div>
          <main id="main-content" tabIndex={-1}>
            <div className="page-heading operating-title">
              <div>
                <div className="eyebrow">
                  {page === "Overview"
                    ? "YOUR TREASURY, AT A GLANCE"
                    : "TREASURY OPERATIONS"}
                </div>
                <h1>{page === "Overview" ? "Treasury overview" : page}</h1>
                <p>
                  {page === "Overview"
                    ? "A clear view of your funds, approvals, and settlements."
                    : page === "Payments"
                      ? "From first request to final confirmation. Your queue, in one place."
                      : page === "Reconciliation"
                        ? "Match accounting records to confirmed settlement events."
                        : page === "Activity"
                          ? "Follow every request, decision, and settlement."
                          : page === "Demo lab"
                            ? "Explore failures safely with synthetic payments."
                            : "The rules and recipients that keep payments under control."}
                </p>
              </div>
              <div className="heading-actions">
                
                <span className="date-chip">
                  <Icon name="clock" size={15} />
                  {date}
                </span>
                {["Overview", "Payments"].includes(page) ? (
                  <button
                    className="button primary"
                    onClick={openCreate}
                    disabled={actor !== "creator" || !!busy}
                    title={
                      actor !== "creator"
                        ? "Switch to the payment creator to create a request."
                        : undefined
                    }
                  >
                    <Icon name="plus" size={18} />
                    New payment
                  </button>
                ) : page === "Reconciliation" ? (
                  <button
                    className="button primary"
                    disabled={!!busy}
                    onClick={() => void reconcile()}
                  >
                    <Icon name="reconcile" size={17} />
                    {busy === "reconcile"
                      ? "Reconciling…"
                      : "Run reconciliation"}
                  </button>
                ) : page === "Activity" ? (
                  <button
                    className="button"
                    onClick={() =>
                      exportJson(
                        {
                          mode: apiMode ? "local-chain" : "simulation",
                          events: audit,
                        },
                        "treasuryflow-audit.json",
                      )
                    }
                  >
                    <Icon name="download" size={17} />
                    Export audit
                  </button>
                ) : null}
              </div>
            </div>
            <div className="workspace-status">
              <span>
                {apiMode ? (
                  <>
                    <Icon name="shield" size={14} />
                    Mock-token local chain
                  </>
                ) : (
                  <>
                    <Icon name="lab" size={14} />
                    Demo workspace · simulated settlement · {demoSession?.persistent ? "saved in this browser" : "session only — storage unavailable"}
                  </>
                )}
              </span>
              <button
                onClick={() => void refresh().catch(() => {})}
                disabled={!!busy}
              >
                <Icon name="refresh" size={13} />
                {lastSync
                  ? "Updated " +
                    lastSync.toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })
                  : "Refresh data"}
              </button>
            </div>
            {page === "Payments" && <div className="treasury-position"><div><Icon name="wallet" size={21} /><span>{apiMode ? "Available treasury" : "Simulated treasury"}<strong>{config.balance !== undefined ? money(config.balance) : "—"}<small>mUSD</small></strong></span></div><div className="position-spend"><span>Daily limit <b>{money(limit)} mUSD</b></span><div className="position-meter"><i style={{ width: `${Math.min(100, spent / limit * 100)}%` }} /></div><small>{money(spent)} used · resets at 00:00 UTC</small></div><button className="text-link" onClick={() => navigate("Policy & recipients")}>View policies <Arrow /></button></div>}
            {demoSession?.recovered && <p className="storage-notice" role="status">The saved demo data could not be read. A fresh sample workspace has been loaded.</p>}
            {networkError && (
              <div className="network-error" role="alert">
                <Icon name="alert" />
                <div>
                  <b>Connection interrupted</b>
                  <p>{networkError} Previously loaded records may be stale.</p>
                </div>
                <button
                  className="button"
                  onClick={() => void refresh().catch(() => {})}
                >
                  Retry connection
                </button>
              </div>
            )}
            {loading ? (
              <Skeleton />
            ) : (
              <>
                <div
                  className={
                    ["Overview", "Payments"].includes(page) ? "" : "hidden"
                  }
                >
                  {page === "Overview" && (
                    <>
                      <div className="metrics">
                        <section className="metric balance-metric">
                          <div className="metric-label">
                            <span>Available treasury balance</span>
                            <Icon name="wallet" size={19} />
                          </div>
                          <strong>
                            {config.balance !== undefined
                              ? money(config.balance)
                              : "—"}
                            <small>mUSD</small>
                          </strong>
                          <div className="metric-bottom">
                            <span className="metric-tag">
                              <Icon name="shield" size={12} />
                              {apiMode
                                ? "On-chain balance"
                                : "Simulated balance"}
                            </span>
                            <span>One treasury · one currency</span>
                          </div>
                        </section>
                        <button
                          className="metric metric-button"
                          onClick={() => {
                            setFilter("PENDING");
                            navigate("Payments");
                          }}
                        >
                          <div className="metric-label">
                            <span>Awaiting approval</span>
                            <Icon name="clock" size={19} />
                          </div>
                          <strong>
                            {String(pending.length).padStart(2, "0")}
                            <small>payments</small>
                          </strong>
                          <div className="metric-bottom">
                            <span>
                              {money(
                                pending.reduce(
                                  (s, p) => s + Number(p.amount),
                                  0,
                                ),
                              )}{" "}
                              mUSD pending
                            </span>
                            <Icon name="chevron" size={16} />
                          </div>
                        </button>
                        <button
                          className="metric metric-button"
                          onClick={() => {
                            setFilter("APPROVED");
                            navigate("Payments");
                          }}
                        >
                          <div className="metric-label">
                            <span>Ready to settle</span>
                            <Icon name="check" size={19} />
                          </div>
                          <strong>
                            {money(
                              ready.reduce((s, p) => s + Number(p.amount), 0),
                            )}
                            <small>mUSD</small>
                          </strong>
                          <div className="metric-bottom">
                            <span className="green-text">
                              {ready.length} approved{" "}
                              {ready.length === 1 ? "payment" : "payments"}
                            </span>
                            <Icon name="chevron" size={16} />
                          </div>
                        </button>
                        <button
                          className="metric metric-button"
                          onClick={() => navigate("Reconciliation")}
                        >
                          <div className="metric-label">
                            <span>Reconciliation exceptions</span>
                            <Icon name="reconcile" size={19} />
                          </div>
                          <strong>
                            {report
                              ? String(report.flags.length).padStart(2, "0")
                              : "—"}
                            <small>{report ? "flagged" : "not checked"}</small>
                          </strong>
                          <div className="metric-bottom">
                            <span>
                              {report
                                ? "Last check " +
                                  new Date(report.checkedAt).toLocaleTimeString(
                                    [],
                                    { hour: "2-digit", minute: "2-digit" },
                                  )
                                : "Run your first reconciliation"}
                            </span>
                            <Icon name="chevron" size={16} />
                          </div>
                        </button>
                      </div>
                      <div className="overview-grid">
                        <ActivityChart payments={payments} audit={audit} />
                        {activity}
                      </div>
                    </>
                  )}
                  {page === "Payments" && <section className="payment-summary" aria-label="Payment priorities">
                    {[
                      { label: "Awaiting approval", count: pending.length, filter: "PENDING", icon: "clock", note: "Ready for a review" },
                      { label: "Ready to pay", count: ready.length, filter: "APPROVED", icon: "check", note: "Approvals complete" },
                      { label: "Needs attention", count: payments.filter(p => ["EXECUTING", "FAILED"].includes(p.status)).length, filter: "ATTENTION", icon: "alert", note: "Check settlement status" },
                    ].map(item => <button key={item.filter} className={filter === item.filter ? "summary-item selected" : "summary-item"} aria-pressed={filter === item.filter} onClick={() => setFilter(filter === item.filter ? "ALL" : item.filter)}>
                      <span className="summary-icon"><Icon name={item.icon} size={19} /></span><span><span className="summary-label">{item.label}</span><strong>{String(item.count).padStart(2, "0")}</strong><small>{item.note}</small></span><Icon name="chevron" size={16} />
                    </button>)}
                  </section>}
                  {["Overview", "Payments"].includes(page) && (
                    <PaymentTable
                      payments={payments}
                      supplierName={supplierName}
                      filter={filter}
                      setFilter={setFilter}
                      onOpen={(id) => {
                        setSelected(id);
                        setError("");
                      }}
                      onCreate={openCreate}
                      canCreate={actor === "creator"}
                      compact={page === "Overview"}
                    />
                  )}
                </div>
                {page === "Reconciliation" && (
                  <>
                    <div className="reconcile-banner">
                      <span className="reconcile-symbol">
                        <Icon name="reconcile" size={30} />
                      </span>
                      <div>
                        <h2>One ledger. Independently checked.</h2>
                        <p>
                          Compare recipient, amount, and transaction identity.
                          Recover interrupted confirmations without sending
                          another payment.
                        </p>
                      </div>
                      <span className="pill">{apiMode ? "1 confirmation · local chain" : "Simulated settlement events"}</span>
                    </div>
                    <div className="reconcile-metrics">
                      {[
                        [
                          "Matched",
                          report?.matched,
                          "Verified against settlement events",
                        ],
                        [
                          "Recovered",
                          report?.recovered,
                          "Restored without a new transfer",
                        ],
                        [
                          "Exceptions",
                          report?.flags.length,
                          "Require an accounting review",
                        ],
                      ].map(([t, v, n]) => (
                        <section className="metric" key={String(t)}>
                          <span className="metric-label">{t}</span>
                          <strong>
                            {v === undefined ? "—" : String(v).padStart(2, "0")}
                          </strong>
                          <p>{n}</p>
                        </section>
                      ))}
                    </div>
                    <section className="panel">
                      <div className="panel-heading">
                        <div>
                          <h2>Reconciliation exceptions</h2>
                          <p>
                            {report
                              ? "Checked " +
                                new Date(report.checkedAt).toLocaleString()
                              : "No reconciliation run in this session"}
                          </p>
                        </div>
                        {report && (
                          <Badge
                            status={
                              report.flags.length
                                ? "REVIEW_REQUIRED"
                                : "MATCHED"
                            }
                          />
                        )}
                      </div>
                      {report?.flags.length ? (
                        report.flags.map((f, i) => (
                          <div className="exception-row" key={i}>
                            <span className="exception-icon">
                              <Icon name="alert" />
                            </span>
                            <div>
                              <b>{title(f.issue)}</b>
                              <small>
                                {payments.find((p) => p.id === f.id)?.invoice ||
                                  short(f.id)}
                              </small>
                            </div>
                            <button
                              className="button small-button"
                              disabled={!payments.some((p) => p.id === f.id)}
                              onClick={() => setSelected(f.id)}
                            >
                              Inspect payment
                            </button>
                          </div>
                        ))
                      ) : (
                        <Empty
                          title={
                            report
                              ? "Everything matches."
                              : "Ready to reconcile?"
                          }
                          detail={
                            report
                              ? "Observed settlement events match the recorded payment details."
                              : "Run a check to identify differences and recover confirmed transactions."
                          }
                          action={
                            !report ? (
                              <button
                                className="button primary"
                                disabled={!!busy}
                                onClick={() => void reconcile()}
                              >
                                Run first check
                              </button>
                            ) : undefined
                          }
                        />
                      )}
                    </section>
                  </>
                )}
                {page === "Activity" && (
                  <section className="panel">
                    <div className="panel-heading">
                      <div>
                        <h2>
                          Audit events{" "}
                          <span className="count">{audit.length}</span>
                        </h2>
                        <p>
                          {apiMode ? "Application decisions and settlement evidence · latest 500 events" : "Local demo activity · simulated decisions and confirmations"}
                        </p>
                      </div>
                    </div>
                    <div className="audit-controls">
                      <div className="table-search">
                        <Icon name="search" size={17} />
                        <input
                          aria-label="Search audit events"
                          placeholder="Search events, people or invoices"
                          value={auditQuery}
                          onChange={(e) => setAuditQuery(e.target.value)}
                        />
                      </div>
                      <label>
                        <span className="sr-only">Event type</span>
                        <select
                          value={auditAction}
                          onChange={(e) => setAuditAction(e.target.value)}
                        >
                          <option value="ALL">All event types</option>
                          {[...new Set(audit.map((a) => a.action))]
                            .sort()
                            .map((a) => (
                              <option key={a}>{a}</option>
                            ))}
                        </select>
                      </label>
                    </div>
                    <div className="audit-events">
                      {recent
                        .filter(
                          (a) =>
                            (auditAction === "ALL" ||
                              a.action === auditAction) &&
                            `${a.action} ${a.actor} ${a.detail} ${payments.find((p) => p.id === a.payment_id)?.invoice || ""}`
                              .toLowerCase()
                              .includes(auditQuery.toLowerCase()),
                        )
                        .map((a) => (
                          <div className="audit-row" key={a.id}>
                            <span className="audit-date">
                              {new Date(a.created_at).toLocaleDateString([], {
                                month: "short",
                                day: "numeric",
                              })}
                              <small>
                                {new Date(a.created_at).toLocaleTimeString([], {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </small>
                            </span>
                            <Badge status={a.action} />
                            <span className="audit-person">
                              <span className="person-avatar tiny">
                                {a.actor[0].toUpperCase()}
                              </span>
                              {a.actor}
                            </span>
                            <div className="audit-description">
                              <b>
                                {payments.find((p) => p.id === a.payment_id)
                                  ?.invoice || short(a.payment_id)}
                              </b>
                              <p>{a.detail}</p>
                            </div>
                            <button
                              className="icon-btn"
                              aria-label="Inspect event payment"
                              disabled={
                                !payments.some((p) => p.id === a.payment_id)
                              }
                              onClick={() => setSelected(a.payment_id)}
                            >
                              <Icon name="chevron" size={16} />
                            </button>
                          </div>
                        ))}
                    </div>
                    {!recent.some(
                      (a) =>
                        (auditAction === "ALL" || a.action === auditAction) &&
                        `${a.action} ${a.actor} ${a.detail} ${payments.find((p) => p.id === a.payment_id)?.invoice || ""}`
                          .toLowerCase()
                          .includes(auditQuery.toLowerCase()),
                    ) && (
                      <Empty
                        title="No events match"
                        detail="Try another event type or search term."
                        action={
                          <button
                            className="button"
                            onClick={() => {
                              setAuditQuery("");
                              setAuditAction("ALL");
                            }}
                          >
                            Reset filters
                          </button>
                        }
                      />
                    )}
                  </section>
                )}
                {page === "Policy & recipients" && (
                  <>
                    <div className="policy-grid">
                      {[
                        [
                          "shield",
                          "Recipient eligibility",
                          "Only approved synthetic supplier wallets can receive payments.",
                        ],
                        [
                          "user",
                          "Separation of duties",
                          "Creators request. Managers approve. Auditors inspect.",
                        ],
                        [
                          "check",
                          "Approval threshold",
                          "One manager up to 5,000 mUSD; two distinct managers above it.",
                        ],
                        [
                          "wallet",
                          "Daily spending cap",
                          "Total settlements cannot exceed 25,000 mUSD per UTC day.",
                        ],
                        [
                          "payments",
                          "Unique settlement",
                          "Stable payment IDs and unique supplier invoices prevent duplicate payment.",
                        ],
                        [
                          "clock",
                          "Due-date enforcement",
                          "Approve early if needed. Execute only on or after the due date.",
                        ],
                      ].map(([icon, t, d]) => (
                        <section className="panel policy-card" key={t}>
                          <span className="policy-card-icon">
                            <Icon name={icon} />
                          </span>
                          <h3>{t}</h3>
                          <p>{d}</p>
                          <span className="policy-enforced">
                            <Icon name="check" size={13} />
                            {apiMode ? "Enforced in local system" : "Applied in the simulation"}
                          </span>
                        </section>
                      ))}
                    </div>
                    <section className="panel">
                      <div className="panel-heading">
                        <div>
                          <h2>Approved recipients</h2>
                          <p>
                            Mock eligibility checks · fixed at contract
                            deployment
                          </p>
                        </div>
                        <span className="pill">
                          {config.suppliers.length} recipients
                        </span>
                      </div>
                      {config.suppliers.map((s, i) => (
                        <div className="recipient-row" key={s.id}>
                          <span
                            className={
                              "supplier-avatar large " + (i ? "peach" : "")
                            }
                          >
                            {s.name[0]}
                          </span>
                          <div>
                            <h3>{s.name}</h3>
                            <p>{s.category}</p>
                            <code className="wrap">{s.id}</code>
                          </div>
                          <Badge status="ELIGIBLE" />
                        </div>
                      ))}
                    </section>
                  </>
                )}
                {page === "Demo lab" && (
                  <>
                    <section className="lab-hero">
                      <div>
                        <span className="overline">
                          FAILURE RECOVERY, MADE VISIBLE
                        </span>
                        <h2>
                          A good payment system
                          <br />
                          handles the bad days.
                        </h2>
                        <p>
                          Duplicate requests. Unauthorized approvals. An
                          interrupted backend response. See the controls that
                          keep one payment from becoming two.
                        </p>
                        {!apiMode ? (
                          <button
                            className="button primary"
                            disabled={!!busy}
                            onClick={() =>
                              void run("scenario", async () => {
                                await new Promise((r) => setTimeout(r, 450));
                                setScenario(demo!.scenario());
                                setReport(demo!.reconcile());
                                notify(
                                  "Recovery scenario passed. Inspect the audit trail for each step.",
                                );
                              })
                            }
                          >
                            {busy === "scenario" ? (
                              <>
                                <span className="spinner" />
                                Running scenario…
                              </>
                            ) : (
                              <>
                                <Icon name="lab" size={18} />
                                Run failure-recovery demo
                              </>
                            )}
                          </button>
                        ) : (
                          <p className="hint">
                            Use a payment’s Recovery demonstration controls, or
                            run npm run demo:api from the source project.
                          </p>
                        )}
                      </div>
                      <div className="lab-flow">
                        <div>
                          <Icon name="payments" />
                          <span>Payment requested</span>
                          <Badge status="CHECKED" />
                        </div>
                        <div>
                          <Icon name="shield" />
                          <span>Approval verified</span>
                          <Badge status="CHECKED" />
                        </div>
                        <div>
                          <Icon name="alert" />
                          <span>Response interrupted</span>
                          <Badge status="INTERRUPTED" />
                        </div>
                        <div>
                          <Icon name="reconcile" />
                          <span>Original settlement recovered</span>
                          <Badge status="RECOVERED" />
                        </div>
                      </div>
                    </section>
                    <div className="scenario-grid">
                      {[
                        [
                          "01",
                          "Duplicate request",
                          "One record, even after a repeated submission.",
                          scenario?.duplicate,
                        ],
                        [
                          "02",
                          "Unauthorized action",
                          "An auditor cannot approve a payment.",
                          scenario?.denied,
                        ],
                        [
                          "03",
                          "Interrupted response",
                          "Recover the original confirmed settlement.",
                          scenario?.recovered,
                        ],
                        [
                          "04",
                          "Safe execution retry",
                          "Exactly one settlement event remains.",
                          scenario?.oneSettlement,
                        ],
                      ].map(([n, t, d, pass]) => (
                        <section
                          className="panel scenario-card"
                          key={String(n)}
                        >
                          <span>{n}</span>
                          <h3>{t}</h3>
                          <p>{d}</p>
                          <Badge status={pass === true ? "PASSED" : "READY"} />
                        </section>
                      ))}
                    </div>
                    {!apiMode && (
                      <section className="panel mismatch-panel">
                        <div>
                          <h3>Put reconciliation to the test</h3>
                          <p>
                            Change a settled ledger amount by 1 mUSD. The next
                            check should flag it without overwriting the record.
                          </p>
                        </div>
                        <button
                          className="button"
                          disabled={!!busy || !settled.length}
                          onClick={() =>
                            void run("mismatch", () => {
                              const p = demo!.payments.find(
                                (p) => p.status === "SETTLED",
                              );
                              if (!p) throw Error("Settle a payment first.");
                              p.amount = (Number(p.amount) + 1).toFixed(6);
                              demo!.log(
                                p.id,
                                "demo-lab",
                                "MISMATCH_INJECTED",
                                "Ledger-only amount increased by 1 mUSD.",
                              );
                              setReport(demo!.reconcile());
                              navigate("Reconciliation");
                              notify(
                                "Accounting mismatch created and detected.",
                              );
                            })
                          }
                        >
                          Simulate mismatch
                        </button>
                      </section>
                    )}
                    {!apiMode && <div className="demo-reset-row"><div><h3>Start fresh</h3><p>Reset this browser’s demo payments, history and simulated settlements.</p></div><button className="button" disabled={!!busy} onClick={() => setResetDialog(true)}>Reset demo data</button></div>}
                    <p className="hint">
                      Browser actions simulate the workflow. Real Solidity
                      enforcement and backend recovery are verified separately
                      in the source project’s tests.
                    </p>
                  </>
                )}
              </>
            )}
            <footer>
              <span>
                <b>TreasuryFlow</b> / Programmable corporate payments
              </span>
              <span>Synthetic organization · No institutional affiliation</span>
            </footer>
          </main>
        </div>
      </div>
      {resetDialog && <Overlay title="Reset demo data" onClose={() => setResetDialog(false)}><h2>Start with a fresh demo?</h2><p className="reset-description">This replaces the payments, activity and simulated settlements saved in this browser with the original sample data.</p><div className="reset-actions"><button className="button" onClick={() => setResetDialog(false)}>Keep my data</button><button className="button danger" onClick={() => { demoSession?.reset(); setReport(null); setScenario(null); setSelected(null); setDraft(freshDraft()); setResetDialog(false); void refresh(); notify("Demo reset. The original sample payments are ready."); }}>Reset demo</button></div></Overlay>}
      {tracker && <PaymentTracker payments={payments} audit={audit} suppliers={config.suppliers} onClose={() => setTracker(false)} onOpen={id => { setTracker(false); navigate("Payments"); setSelected(id); setError(""); }} />}
      {toast && (
        <div
          className={"toast " + (toast.error ? "toast-error" : "")}
          role={toast.error ? "alert" : "status"}
        >
          <Icon name={toast.error ? "alert" : "check"} size={18} />
          <span>{toast.message}</span>
          <button
            className="icon-btn small"
            aria-label="Dismiss notification"
            onClick={() => setToast(null)}
          >
            <Icon name="close" size={15} />
          </button>
        </div>
      )}
      {form && (
        <PaymentForm
          draft={draft}
          setDraft={setDraft}
          suppliers={config.suppliers}
          payments={payments}
          busy={!!busy}
          error={error}
          onClose={() => {
            if (!busy) setForm(false);
          }}
          onSubmit={submit}
        />
      )}
      {chosen && !form && (
        <PaymentDrawer
          payment={chosen}
          audit={audit}
          actor={actor}
          supplier={supplierName(chosen.recipient)}
          busy={!!busy}
          action={busy}
          error={error}
          apiMode={apiMode}
          onClose={() => setSelected(null)}
          onAct={act}
          onActor={switchActor}
          onReconcile={() => void reconcile()}
        />
      )}
      {showNotifications && (
        <Overlay
          title="Workspace notifications"
          onClose={() => setShowNotifications(false)}
          drawer
        >
          <div className="notification-heading">
            <h2>Recent updates</h2>
            <button
              className="button small-button"
              disabled={!notices.length}
              onClick={() => setNotices([])}
            >
              Clear all
            </button>
          </div>
          {notices.length ? (
            notices.map((n) => (
              <div className="notification-item" key={n.id}>
                <Icon name={n.error ? "alert" : "check"} />
                <div>
                  <p>{n.message}</p>
                  <small>{new Date(n.id).toLocaleTimeString()}</small>
                </div>
              </div>
            ))
          ) : (
            <Empty
              title="You’re all caught up"
              detail="Approval, settlement, and recovery updates will appear here."
            />
          )}
        </Overlay>
      )}
    </>
  );
}
createRoot(document.getElementById("root")!).render(location.pathname.replace(/\/$/, "") === "/app" ? <Business /> : <App />);
