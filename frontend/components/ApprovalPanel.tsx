import React from "react";
import { Badge, Icon } from "./ui";
import { money, dateLabel } from "../workspace";
import { actors, names, today, type Payment } from "../model";

const settlementText: Record<string, string> = {
  PENDING: "Not executed · needs approval",
  APPROVED: "Not executed · ready to execute",
  EXECUTING: "Confirmation pending · reconcile before retrying",
  REJECTED: "Not executed · rejected",
  FAILED: "Not settled · execution failed",
};

/** Read-only approval summary for the payment selected in the Payments table. */
export function ApprovalPanel({
  payment: p,
  supplier,
  threshold,
  sample,
}: {
  payment: Payment | undefined;
  supplier: string;
  threshold: number;
  sample: boolean;
}) {
  const head = (
    <div className="approval-head">
      <span>Approval</span>
      {sample && <span className="sample-chip">Sample data</span>}
    </div>
  );
  if (!p)
    return (
      <aside className="approval-panel" aria-label="Approval">
        {head}
        <p className="approval-empty">Select a payment to see its approvals.</p>
      </aside>
    );
  const managers = actors.filter((a) => a.startsWith("manager"));
  // Above the threshold every manager signs; otherwise one approval from either.
  const steps =
    p.required > 1
      ? managers.map((m) => ({ who: m, done: p.approvals.includes(m) }))
      : [{ who: p.approvals[0] ?? null, done: p.approvals.length > 0 }];
  const label = (who: string | null) =>
    who ? `${names[who as keyof typeof names].split(" · ")[0]} · ${who}` : "Any manager";
  const limit = money(threshold).replace(/\.00$/, "");
  return (
    <aside className="approval-panel" aria-label="Approval">
      {head}
      <div className="approval-title">
        <div>
          <small>
            {p.invoice} · {supplier}
          </small>
          <h2>Payment request</h2>
        </div>
        {p.status === "PENDING" ? (
          <span className="approval-badge">
            {p.approvals.length} of {p.required} approvals
          </span>
        ) : (
          <Badge status={p.status} />
        )}
      </div>
      <div className="approval-amount">
        {money(p.amount)} <small>mUSD</small>
      </div>
      <dl className="approval-rows">
        <div>
          <dt>Policy</dt>
          <dd>
            {p.required > 1
              ? `${p.required} distinct managers · above ${limit}`
              : `1 manager · up to ${limit}`}
          </dd>
        </div>
        <div>
          <dt>Due</dt>
          <dd>{p.dueDate === today() ? "Today" : dateLabel(p.dueDate)} · UTC</dd>
        </div>
        <div>
          <dt>Client UUID</dt>
          <dd className="mono" title={p.id}>
            {p.id.slice(0, 4)}…{p.id.slice(-4)}
          </dd>
        </div>
      </dl>
      <ol className="approval-steps">
        {steps.map((s, i) => (
          <li key={s.who ?? i} className={s.done ? "done" : "waiting"}>
            <span className="step-mark" aria-hidden="true">
              {s.done ? <Icon name="check" size={13} /> : i + 1}
            </span>
            <span className="step-who">{label(s.who)}</span>
            <em>{s.done ? "approved" : p.status === "PENDING" ? "awaiting" : "not required"}</em>
          </li>
        ))}
      </ol>
      <div className="approval-settlement">
        <small>Settlement</small>
        <span className="mono">
          {p.status === "SETTLED"
            ? `Settled · ${p.txHash ? p.txHash.slice(0, 10) + "…" : "confirmed"}`
            : (settlementText[p.status] ?? "Not executed")}
        </span>
      </div>
    </aside>
  );
}
