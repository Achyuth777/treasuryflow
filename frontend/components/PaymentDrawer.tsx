import React, { useState } from "react";
import { Badge, Icon, Overlay } from "./ui";
import { money, title, short } from "../workspace";
import {
  actors,
  names,
  today,
  type Actor,
  type Payment,
  type Audit,
} from "../model";
export function PaymentDrawer({
  payment: p,
  audit,
  actor,
  supplier,
  busy,
  action,
  error,
  apiMode,
  onClose,
  onAct,
  onActor,
  onReconcile,
}: {
  payment: Payment;
  audit: Audit[];
  actor: Actor;
  supplier: string;
  busy: boolean;
  action: string;
  error: string;
  apiMode: boolean;
  onClose: () => void;
  onAct: (kind: string, interrupt?: boolean) => Promise<void>;
  onActor: (a: Actor) => void;
  onReconcile: () => void;
}) {
  const [confirmReject, setConfirmReject] = useState(false),
    [copied, setCopied] = useState("");
  const closed = ["SETTLED", "REJECTED"].includes(p.status),
    canApprove = actor.startsWith("manager"),
    approved = p.approvals.includes(actor),
    canExecute =
      actor !== "auditor" &&
      ["APPROVED", "EXECUTING", "SETTLED"].includes(p.status) &&
      p.dueDate <= today();
  const events = audit
    .filter((a) => a.payment_id === p.id)
    .sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id - b.id);
  const approvalNote = closed
    ? "This payment is closed."
    : !canApprove
      ? "Switch to an approver account to approve or reject."
      : approved
        ? "Your approval is recorded. A second manager must approve if required."
        : `You can review this payment as ${names[actor].split(" · ")[0]}.`;
  const copy = async (v: string) => {
    try {
      await navigator.clipboard.writeText(v);
      setCopied(v);
      setTimeout(() => setCopied(""), 1800);
    } catch {
      setCopied("unavailable");
    }
  };
  return (
    <Overlay title="Payment details" drawer onClose={onClose}>
      <div className="drawer-heading">
        <div className="supplier-avatar large">{supplier[0]}</div>
        <div>
          <h2>{supplier}</h2>
          <p>{p.invoice}</p>
        </div>
        <Badge status={p.status} />
      </div>
      <div className="drawer-amount">
        {money(p.amount)}
        <span>mUSD</span>
      </div>
      <div className="stage-track">
        {["Requested", "Approved", "Settled"].map((s, i) => (
          <div
            key={s}
            className={
              i === 0 ||
              (i === 1 && p.approvals.length >= p.required) ||
              (i === 2 && p.status === "SETTLED")
                ? "done"
                : ""
            }
          >
            <span>
              {i === 0 ||
              (i === 1 && p.approvals.length >= p.required) ||
              (i === 2 && p.status === "SETTLED") ? (
                <Icon name="check" size={13} />
              ) : (
                i + 1
              )}
            </span>
            {s}
          </div>
        ))}
      </div>
      <section className="drawer-section">
        <h3>Invoice information</h3>
        <dl className="detail-list">
          <dt>Requested by</dt>
          <dd>{names[p.creator as Actor]?.split(" · ")[0] || p.creator}</dd>
          <dt>Due date</dt>
          <dd>{p.dueDate} · UTC</dd>
        </dl>
      </section>
      <section className="drawer-section">
        <div className="section-label">
          <h3>Approvals</h3>
          <b>
            {p.approvals.length} / {p.required}
          </b>
        </div>
        {(p.required === 2 || p.approvals.length > 1
          ? ["manager1", "manager2"]
          : [p.approvals[0] || (actor.startsWith("manager") ? actor : "manager1")])
          .map((a) => (
            <div className="approver" key={a}>
              <span className="person-avatar">{names[a as Actor][0]}</span>
              <div>
                <b>{names[a as Actor].split(" · ")[0]}</b>
                <small>Finance approver</small>
              </div>
              <span
                className={
                  p.approvals.includes(a) ? "approval-complete" : "muted"
                }
              >
                {p.approvals.includes(a) ? (
                  <>
                    <Icon name="check" size={14} />
                    Approved
                  </>
                ) : (
                  "Awaiting review"
                )}
              </span>
            </div>
          ))}
        <p className="hint">
          {p.required === 2
            ? "This amount requires two distinct manager approvals."
            : "One approval is sufficient for this amount."}
        </p>
      </section>
      <section className="drawer-section">
        <h3>Settlement</h3>
        {p.txHash ? (
          <div className="transaction">
            <Icon name="shield" />
            <div>
              <b>
                {apiMode
                  ? "Confirmed on the local chain"
                  : "Confirmed in the simulation"}
              </b>
              <details><summary>View transaction reference</summary><code>{p.txHash}</code></details>
            </div>
          </div>
        ) : (
          <div className="transaction neutral">
            <Icon name="clock" />
            <div>
              <b>
                {p.status === "EXECUTING"
                  ? "Confirmation needs recovery"
                  : p.status === "REJECTED"
                    ? "Payment rejected"
                    : "Not settled yet"}
              </b>
              <p>
                {p.status === "EXECUTING"
                  ? "A missing response does not mean payment failed. Reconcile before retrying."
                  : p.status === "REJECTED"
                    ? "No settlement was released."
                    : "Funds move only after approval and confirmation."}
              </p>
            </div>
          </div>
        )}
        {p.status === "EXECUTING" && (
          <button className="button full" onClick={onReconcile} disabled={busy}>
            <Icon name="reconcile" />
            Reconcile transaction
          </button>
        )}
      </section>
      <details className="drawer-section settlement-details"><summary>Transaction details</summary><dl className="detail-list">          <dt>Recipient</dt>
          <dd>
            <span className="mono" title={p.recipient}>
              {short(p.recipient)}
            </span>
            <button
              className="icon-btn small"
              aria-label="Copy recipient address"
              onClick={() => copy(p.recipient)}
            >
              <Icon
                name={copied === p.recipient ? "check" : "copy"}
                size={15}
              />
            </button>
          </dd>
          <dt>Payment ID</dt>
          <dd className="mono wrap">{p.id}</dd>
</dl></details>
      <section className="drawer-section">
        <h3>Audit timeline</h3>
        <ol className="timeline">
          {events.map((e) => (
            <li key={e.id}>
              <span className={"timeline-dot " + e.action.toLowerCase()}>
                <Icon
                  name={
                    ["EXECUTED", "RECOVERED", "APPROVED"].includes(e.action)
                      ? "check"
                      : e.action === "DENIED"
                        ? "alert"
                        : "clock"
                  }
                  size={13}
                />
              </span>
              <div>
                <b>{title(e.action)}</b>
                <p>{e.detail}</p>
                <small>
                  {e.actor} ·{" "}
                  {new Date(e.created_at).toLocaleString([], {
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </small>
              </div>
            </li>
          ))}
        </ol>
      </section>
      <div className="drawer-actions">
        <div className="acting-as">
          <span>Acting as</span>
          <select
            aria-label="Acting role in payment drawer"
            value={actor}
            disabled={busy}
            onChange={(e) => onActor(e.target.value as Actor)}
          >
            {actors.map((a) => (
              <option value={a} key={a}>
                {names[a]}
              </option>
            ))}
          </select>
        </div>
        <p className="hint">{approvalNote}</p>
        {error && (
          <div className="inline-error" role="alert">
            {error}
          </div>
        )}
        {copied === "unavailable" && (
          <p role="status" className="hint">
            Clipboard unavailable. Select the address above to copy it.
          </p>
        )}
        {confirmReject ? (
          <div className="reject-confirm">
            <p>Reject this request? It will be permanently closed.</p>
            <button
              className="button danger"
              disabled={busy}
              onClick={() => void onAct("reject")}
            >
              {busy ? "Rejecting…" : "Confirm rejection"}
            </button>
            <button
              className="button"
              disabled={busy}
              onClick={() => setConfirmReject(false)}
            >
              Keep request
            </button>
          </div>
        ) : (
          <div className="action-grid">
            <button
              className="button primary"
              disabled={busy || closed || !canApprove || approved}
              onClick={() => void onAct("approve")}
            >
              {busy && action === "approve" ? (
                <>
                  <span className="spinner" />
                  Approving…
                </>
              ) : (
                <>
                  <Icon name="check" />
                  Approve payment
                </>
              )}
            </button>
            <button
              className="button"
              disabled={busy || closed || !canApprove}
              onClick={() => setConfirmReject(true)}
            >
              Reject
            </button>
          </div>
        )}
        {!["PENDING", "REJECTED"].includes(p.status) && (
          <button
            className={"button full " + (p.status === "APPROVED" ? "primary" : "")}
            disabled={busy || !canExecute}
            onClick={() => void onAct("execute")}
          >
            {busy && action === "execute" ? (
              <>
                <span className="spinner" />
                Waiting for confirmation…
              </>
            ) : p.status === "SETTLED" ? (
              "Verify safe retry"
            ) : (
              "Execute payment"
            )}
          </button>
        )}
        {p.dueDate > today() && (
          <p className="hint">Execution unlocks on {p.dueDate} at 00:00 UTC.</p>
        )}
        {p.status === "APPROVED" && actor !== "auditor" && (
          <details className="failure-options">
            <summary>Recovery demonstration</summary>
            <p>
              Settle, then interrupt the response before the ledger is updated.
            </p>
            <button
              className="button full"
              disabled={busy}
              onClick={() => void onAct("execute", true)}
            >
              Execute with interrupted response
            </button>
          </details>
        )}
      </div>
    </Overlay>
  );
}
