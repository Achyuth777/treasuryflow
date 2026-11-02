// Live HTML/CSS product mockups. Every value here is sample data and is tagged as such.
import React from "react";
import { SampleTag } from "./landing-motion";

export const TX = "0x9f3a…c41e";
const SUP_A = "Northstar Cloud";

const Check = () => (
  <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true">
    <path
      d="M3.5 8.5l3 3 6-7"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export function Pill({
  tone,
  children,
}: {
  tone: "ok" | "wait" | "warn" | "mute";
  children: React.ReactNode;
}) {
  return <span className={`pill pill-${tone}`}>{children}</span>;
}

/* ---------- Journey canvas panels ---------- */

export const STOPS = [
  { key: "Request", x: 60, y: 60, w: 560, h: 360 },
  { key: "Approve", x: 980, y: 120, w: 560, h: 360 },
  { key: "Settle", x: 1000, y: 700, w: 560, h: 360 },
  { key: "Reconcile", x: 80, y: 760, w: 560, h: 360 },
] as const;
export const CANVAS = { w: 1620, h: 1240 };

function Field({
  k,
  v,
  mono,
  flag,
}: {
  k: string;
  v: string;
  mono?: boolean;
  flag?: React.ReactNode;
}) {
  return (
    <div className="field">
      <small>{k}</small>
      <span className={mono ? "mono" : ""}>{v}</span>
      {flag}
    </div>
  );
}

export function RequestPanel() {
  return (
    <>
      <div className="jp-head">
        <b>New payment</b>
        <Pill tone="mute">Draft</Pill>
      </div>
      <div className="jp-grid">
        <Field k="Supplier" v={SUP_A} />
        <Field
          k="Invoice"
          v="INV-2041"
          mono
          flag={
            <span className="flag ok">
              <Check /> unique
            </span>
          }
        />
        <Field k="Amount" v="7,500.00 mUSD" mono />
        <Field k="Due" v="Today (UTC)" />
      </div>
      <div className="jp-note mono">
        client UUID 3f9c…a71e · resubmitting returns the same payment
      </div>
      <div className="jp-foot">
        <span className="btn-mock hot">Submit for approval</span>
        <SampleTag />
      </div>
    </>
  );
}

export function ApprovePanel() {
  return (
    <>
      <div className="jp-head">
        <b>Approvals</b>
        <Pill tone="ok">Approved</Pill>
      </div>
      <div className="jp-policy">
        7,500 &gt; 5,000 → <b>2 distinct managers</b>
      </div>
      <ol className="drawer-appr">
        <li className="ok">
          <span>
            <Check />
          </span>
          Morgan · manager1<em>approved</em>
        </li>
        <li className="ok">
          <span>
            <Check />
          </span>
          Jordan · manager2<em>approved</em>
        </li>
      </ol>
      <div className="flag warn">
        Creator cannot approve · same manager cannot count twice
      </div>
      <div className="jp-foot">
        <SampleTag />
      </div>
    </>
  );
}

export function SettlePanel() {
  return (
    <>
      <div className="jp-head">
        <b>On-chain settlement</b>
        <Pill tone="ok">Settled</Pill>
      </div>
      <div className="jp-limit">
        <small>Daily limit · this UTC day</small>
        <b className="mono">11,500 / 25,000 mUSD</b>
        <span className="meter">
          <u style={{ transform: "scaleX(0.46)" }} />
        </span>
      </div>
      <Field k="Transaction" v={TX} mono />
      <div className="flag warn">Second execution → rejected by contract</div>
      <div className="jp-foot">
        <SampleTag />
      </div>
    </>
  );
}

export function ReconcilePanel() {
  return (
    <>
      <div className="jp-head">
        <b>Reconciliation</b>
        <Pill tone="ok">Matched</Pill>
      </div>
      <div className="recon">
        <div className="tr th">
          <span>Source</span>
          <span>State</span>
          <span>Tx</span>
        </div>
        <div className="tr">
          <span>Ledger</span>
          <span>
            <Pill tone="ok">SETTLED</Pill>
          </span>
          <span className="mono">{TX}</span>
        </div>
        <div className="tr">
          <span>Chain event</span>
          <span>
            <Pill tone="ok">Executed</Pill>
          </span>
          <span className="mono">{TX}</span>
        </div>
        <div className="tr">
          <span>Statement line</span>
          <span>
            <Pill tone="ok">Matched</Pill>
          </span>
          <span className="mono">INV-2041</span>
        </div>
      </div>
      <div className="jp-foot">
        <span className="btn-mock">Export audit JSON</span>
        <SampleTag />
      </div>
    </>
  );
}

export const PANELS = [RequestPanel, ApprovePanel, SettlePanel, ReconcilePanel];

/** Ledger record used by the failure-recovery zoom. `stage` 0–4 follows the story. */
export function LedgerCard({ stage }: { stage: number }) {
  const state =
    stage >= 4
      ? ["SETTLED", "ok"]
      : stage >= 1
        ? ["EXECUTING", "wait"]
        : ["APPROVED", "mute"];
  return (
    <div className="ledger" aria-hidden="true">
      <div className="jp-head">
        <b>PAY-2041 · ledger</b>
      </div>
      <Field k="Supplier" v={SUP_A} />
      <Field k="Amount" v="7,500.00 mUSD" mono />
      <div className={`chip-zone s${stage}`}>
        <div className="state-chip">
          <small>Ledger state</small>
          <Pill tone={state[1] as "ok" | "wait" | "mute"}>{state[0]}</Pill>
        </div>
        <div className={`hash-chip ${stage >= 1 ? "on" : ""}`}>
          <small>Tx hash</small>
          <span className="mono">{stage >= 1 ? TX : "—"}</span>
          {stage >= 4 && <em>same hash</em>}
        </div>
        <div className="chip-tag">
          <SampleTag />
        </div>
      </div>
      <div className={`toast-503 ${stage === 2 ? "on" : ""}`}>
        503 · response lost after chain confirmation
      </div>
    </div>
  );
}
