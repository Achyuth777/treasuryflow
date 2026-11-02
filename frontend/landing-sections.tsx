// Below-the-fold landing sections, loaded lazily from landing.tsx.
import React, { useEffect, useRef, useState } from "react";
import {
  m,
  useMotionValue,
  useMotionValueEvent,
  useTransform,
  type MotionValue,
} from "motion/react";
import { activeStep, dolly, frame } from "./landing-math";
import {
  Counter,
  MagneticLink,
  Reveal,
  SampleTag,
  TiltCard,
  usePinProgress,
} from "./landing-motion";
import { CANVAS, LedgerCard, PANELS, Pill, STOPS, TX } from "./landing-mock";

const GITHUB = "https://github.com/Achyuth777/treasuryflow";
const DEMO = "#workspace/Payments";

const STEPS = [
  [
    "Request",
    "A creator submits the invoice once. A client UUID and invoice dedupe stop it entering twice.",
  ],
  [
    "Approve",
    "Up to 5,000 mUSD needs one manager. Above that, two distinct managers. Creators can’t approve.",
  ],
  [
    "Settle",
    "The contract enforces the 25,000 mUSD daily limit atomically and rejects a second execution.",
  ],
  [
    "Reconcile",
    "Ledger, chain event and statement line are matched. Mismatches are flagged, never overwritten.",
  ],
];

function Head({
  eyebrow,
  title,
  id,
  lead,
}: {
  eyebrow: string;
  title: string;
  id: string;
  lead?: string;
}) {
  return (
    <Reveal className="sec-head">
      <p className="eyebrow">{eyebrow}</p>
      <h2 id={id}>{title}</h2>
      {lead && <p className="lead">{lead}</p>}
    </Reveal>
  );
}

/** Index of the active stop, re-rendering only when it changes. */
function useActiveStep(p: MotionValue<number>, n: number) {
  const [step, setStep] = useState(0);
  useMotionValueEvent(p, "change", (v) => setStep(activeStep(v, n)));
  return step;
}

/* ---------- 4 · Journey dolly ---------- */

function Journey({ still }: { still: boolean }) {
  const ref = useRef<HTMLElement>(null);
  const view = useRef<HTMLDivElement>(null);
  const p = usePinProgress(ref);
  const step = useActiveStep(p, STOPS.length);
  // Camera viewport size, tracked as motion values so a resize re-frames without a render.
  const vw = useMotionValue(0);
  const vh = useMotionValue(0);
  useEffect(() => {
    const el = view.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => {
      vw.set(el.clientWidth);
      vh.set(el.clientHeight);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [still]);
  const cam = (v: number, w: number, h: number) =>
    dolly(
      v,
      STOPS.map((r) => frame(r, w, h, 0.8)),
    );
  const transform = useTransform([p, vw, vh], ([v, w, h]: number[]) => {
    const c = cam(v, w, h);
    return `translate3d(${(w / 2 - c.x).toFixed(1)}px, ${(h / 2 - c.y).toFixed(1)}px, 0) scale(${c.s.toFixed(4)})`;
  });
  const transformOrigin = useTransform([p, vw, vh], ([v, w, h]: number[]) => {
    const c = cam(v, w, h);
    return `${c.x.toFixed(1)}px ${c.y.toFixed(1)}px`;
  });

  if (still)
    return (
      <section
        id="journey"
        ref={ref}
        className="journey-static wrap"
        aria-labelledby="j-h"
      >
        <Head
          eyebrow="How it works"
          id="j-h"
          title="One payment, four checkpoints."
        />
        <ol className="js-list">
          {STEPS.map(([k, d], i) => {
            const Panel = PANELS[i];
            return (
              <li key={k}>
                <span className="js-num">0{i + 1}</span>
                <h3>{k}</h3>
                <p>{d}</p>
                <div className="jpanel on" aria-hidden="true">
                  <Panel />
                </div>
              </li>
            );
          })}
        </ol>
      </section>
    );

  return (
    <section id="journey" ref={ref} className="journey" aria-labelledby="j-h">
      <div className="journey-pin">
        <div className="journey-rail">
          <p className="eyebrow">How it works</p>
          <h2 id="j-h">One payment, four checkpoints.</h2>
          <div className="rail-wrap">
            <span className="rail-track" aria-hidden="true">
              <m.span className="rail-fill" style={{ scaleY: p }} />
            </span>
            <ol className="rail">
              {STEPS.map(([k, d], i) => (
                <li
                  key={k}
                  className={i === step ? "on" : i < step ? "done" : ""}
                  aria-current={i === step ? "step" : undefined}
                >
                  <b>
                    <span className="rail-num">0{i + 1}</span>
                    {k}
                  </b>
                  <p>{d}</p>
                </li>
              ))}
            </ol>
          </div>
        </div>
        <div
          className="journey-view"
          ref={view}
          role="img"
          aria-label={`Sample data: the ${STOPS[step].key} step of a 7,500 mUSD payment.`}
        >
          <m.div
            className="journey-canvas"
            style={{
              width: CANVAS.w,
              height: CANVAS.h,
              transform,
              transformOrigin,
            }}
            aria-hidden="true"
          >
            <svg className="journey-path" width={CANVAS.w} height={CANVAS.h}>
              <path
                d={`M${STOPS.map((s) => `${s.x + s.w / 2} ${s.y + s.h / 2}`).join(" L")}`}
                fill="none"
              />
            </svg>
            {STOPS.map((s, i) => {
              const Panel = PANELS[i];
              return (
                <div
                  key={s.key}
                  className={`jpanel ${i === step ? "on" : ""}`}
                  style={{ left: s.x, top: s.y, width: s.w, height: s.h }}
                >
                  <span className="jpanel-step">
                    0{i + 1} · {s.key}
                  </span>
                  <Panel />
                </div>
              );
            })}
          </m.div>
        </div>
      </div>
    </section>
  );
}

/* ---------- 5 · Controls bento ---------- */

function Controls() {
  return (
    <section id="controls" className="wrap block" aria-labelledby="c-h">
      <Head
        eyebrow="Controls"
        id="c-h"
        title="Rules that hold when nobody is watching."
        lead="Each control is enforced where it can’t be skipped: in the API, in the ledger, or in the contract itself."
      />
      <div className="bento">
        <TiltCard className="tile t-a">
          <span className="tile-k z2">Dual approval threshold</span>
          <strong className="big z3">
            <Counter to={5000} />
            <small>mUSD</small>
          </strong>
          <p className="z1">
            One manager approves up to 5,000 mUSD. Above it, two distinct
            managers must both sign off.
          </p>
          <div className="pair z2" aria-hidden="true">
            <span className="av">M1</span>
            <span className="plus">+</span>
            <span className="av">M2</span>
            <span className="pair-note">above 5,000</span>
          </div>
        </TiltCard>
        <TiltCard className="tile t-b">
          <span className="tile-k z2">Daily on-chain limit</span>
          <strong className="big z3">
            <Counter to={25000} />
            <small>mUSD / UTC day</small>
          </strong>
          <p className="z1">
            Checked atomically inside the contract. A payment that would cross
            it is refused.
          </p>
        </TiltCard>
        <TiltCard className="tile t-c">
          <span className="tile-k z2">Invoice dedupe</span>
          <p className="z1">
            The same invoice can’t be submitted again under a new payment ID.
          </p>
          <div className="mini z3" aria-hidden="true">
            <span className="mono">INV-2041</span>
            <Pill tone="warn">already exists</Pill>
          </div>
          <SampleTag />
        </TiltCard>
        <TiltCard className="tile t-d">
          <span className="tile-k z2">Idempotent execution</span>
          <p className="z1">
            A client UUID makes retries safe, and the contract rejects a second
            execution.
          </p>
          <div className="mini z3" aria-hidden="true">
            <span className="mono">execute ×2</span>
            <Pill tone="ok">paid once</Pill>
          </div>
          <SampleTag />
        </TiltCard>
        <TiltCard className="tile t-e">
          <span className="tile-k z2">Role permissions</span>
          <p className="z1">
            Creator, manager and a read-only auditor. Denied actions are logged
            too.
          </p>
          <div className="roles-mini z3" aria-hidden="true">
            <span>creator</span>
            <span>manager</span>
            <span>auditor</span>
          </div>
        </TiltCard>
        <TiltCard className="tile t-f">
          <span className="tile-k z2">Audit export</span>
          <p className="z1">
            Every action, including denials, exports as JSON. Track by invoice,
            payment ID or tx hash.
          </p>
          <pre className="json z3" aria-hidden="true">{`{ "payment": "PAY-2041",
  "action": "APPROVED",
  "actor": "manager2",
  "tx": "${TX}" }`}</pre>
          <SampleTag />
        </TiltCard>
      </div>
    </section>
  );
}

/* ---------- 6 · Failure-recovery zoom ---------- */

const RECOVERY = [
  ["Execute", "The creator executes an approved payment.", "APPROVED"],
  [
    "Chain confirms",
    "The contract settles and emits an event with the tx hash.",
    "EXECUTING",
  ],
  [
    "Response lost",
    "The API returns 503 after confirmation. The ledger still says EXECUTING.",
    "503",
  ],
  [
    "Reconcile",
    "Reconciliation, run by hand or automatically within 30 s, reads the chain event.",
    "SCAN",
  ],
  [
    "Recovered",
    "The ledger is restored to SETTLED with the original tx hash. Nothing is paid twice.",
    "SETTLED",
  ],
] as const;

function Recovery({ still }: { still: boolean }) {
  const ref = useRef<HTMLElement>(null);
  const p = usePinProgress(ref);
  const stage = useActiveStep(p, RECOVERY.length);
  // Zoom into the ledger-state / tx-hash chip as the story plays.
  const scale = useTransform(p, [0, 1], [1, 1.45]);
  const shown = still ? 4 : stage;
  return (
    <section ref={ref} className="recovery" aria-labelledby="f-h">
      <div className="recovery-pin wrap">
        <div className="recovery-copy">
          <p className="eyebrow">Survives failure</p>
          <h2 id="f-h">The response dropped. The money didn’t.</h2>
          <ol className="rec-steps">
            {RECOVERY.map(([t, d, chip], i) => (
              <li
                key={t}
                className={still || i <= shown ? "on" : ""}
                aria-current={!still && i === shown ? "step" : undefined}
              >
                <b>
                  {t}
                  <Pill
                    tone={
                      chip === "SETTLED"
                        ? "ok"
                        : chip === "503"
                          ? "warn"
                          : chip === "APPROVED" || chip === "SCAN"
                            ? "mute"
                            : "wait"
                    }
                  >
                    {chip}
                  </Pill>
                </b>
                <p>{d}</p>
              </li>
            ))}
          </ol>
        </div>
        <div
          className="recovery-stage"
          role="img"
          aria-label={`Sample data: ledger record PAY-2041, state ${shown >= 4 ? "SETTLED" : shown >= 1 ? "EXECUTING" : "APPROVED"}, tx hash ${TX}.`}
        >
          <m.div className="rec-cam" style={still ? undefined : { scale }}>
            <LedgerCard stage={shown} />
          </m.div>
        </div>
      </div>
    </section>
  );
}

/* ---------- 7 · Roles ---------- */

const ROLES = [
  [
    "Creator",
    "Raises and executes payments.",
    [
      "Create payment requests",
      "Execute approved payments",
      "Track by invoice, ID or tx hash",
    ],
    ["Approve or reject a payment"],
  ],
  [
    "Manager",
    "Decides what gets paid.",
    ["Approve or reject requests", "Execute approved payments"],
    ["Create requests", "Count twice on the same payment"],
  ],
  [
    "Auditor",
    "Sees everything, changes nothing.",
    ["Read payments and reports", "Export the audit trail as JSON"],
    ["Create, approve or execute"],
  ],
] as const;

function Roles() {
  return (
    <section className="wrap block" aria-labelledby="r-h">
      <Head
        eyebrow="Roles"
        id="r-h"
        title="Everyone sees exactly what they should."
      />
      <div className="roles">
        {ROLES.map(([r, tag, can, cant], i) => (
          <Reveal key={r} delay={i * 90}>
            <TiltCard className="tile role">
              <span className="role-av z3" aria-hidden="true">
                {r[0]}
              </span>
              <h3 className="z2">{r}</h3>
              <p className="role-tag z1">{tag}</p>
              <h4 className="sr">{r} can</h4>
              <ul className="can z1">
                {can.map((x) => (
                  <li key={x}>{x}</li>
                ))}
              </ul>
              <h4 className="sr">{r} cannot</h4>
              <ul className="cant z1">
                {cant.map((x) => (
                  <li key={x}>{x}</li>
                ))}
              </ul>
            </TiltCard>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

/* ---------- 8 · Live workspace ---------- */

const icon = (d: string) => (
  <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
    <path
      d={d}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);
const WORKSPACE = [
  [
    "Suppliers",
    "Keep the people you pay in one list, scoped to your company workspace.",
    "M16 19v-1a4 4 0 00-4-4H7a4 4 0 00-4 4v1M9.5 10a3 3 0 100-6 3 3 0 000 6zM21 19v-1a4 4 0 00-3-3.9M16 4.1a3 3 0 010 5.8",
  ],
  [
    "Invoice PDFs",
    "Attach the invoice to the payment it supports, so approvers see the source.",
    "M14 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V8zM14 3v5h5M9 13h6M9 17h4",
  ],
  [
    "Statement matching",
    "Match statement lines to settled payments and see what’s left open.",
    "M4 7h11M4 12h7M4 17h11M17 14l2 2 4-4",
  ],
  [
    "Reports",
    "Review payments, approvals and settlement activity across the workspace.",
    "M4 20V10M10 20V4M16 20v-7M22 20H2",
  ],
];

function Workspace() {
  return (
    <section className="band" aria-labelledby="w-h">
      <div className="wrap">
        <Head
          eyebrow="Live workspace"
          id="w-h"
          title="A workspace around the ledger."
          lead="Company workspaces with email-bound invites, so every approval comes from a separate, named person."
        />
        <div className="ws">
          {WORKSPACE.map(([t, d, p], i) => (
            <Reveal key={t} delay={i * 70}>
              <TiltCard className="tile ws-tile" max={8}>
                <span className="ws-icon z3">{icon(p)}</span>
                <h3 className="z2">{t}</h3>
                <p className="z1">{d}</p>
              </TiltCard>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------- 9 · Why blockchain, honestly ---------- */

function Honest() {
  return (
    <section className="wrap block" aria-labelledby="b-h">
      <Head
        eyebrow="Why blockchain, honestly"
        id="b-h"
        title="Sometimes you don’t need one."
      />
      <div className="honest">
        <Reveal className="hon hon-yes">
          <h3>When it helps</h3>
          <p>
            When several organizations need to verify payments without relying
            only on one participant’s database, shared settlement state and
            independently enforced conditions earn their keep.
          </p>
        </Reveal>
        <Reveal className="hon hon-no" delay={90}>
          <h3>When a database is enough</h3>
          <p>
            If one company controls every participant and no outside party needs
            independently verifiable settlement, an ordinary database, approval
            workflow and payment-provider API are simpler and usually
            sufficient.
          </p>
        </Reveal>
      </div>
      <Reveal>
        <p className="hon-note">
          This prototype demonstrates the mechanics, not a decentralized
          deployment: every test key is controlled by the local signing bridge.
        </p>
      </Reveal>
    </section>
  );
}

/* ---------- 10 · FAQ ---------- */

const FAQ = [
  [
    "Is this real money?",
    "No. TreasuryFlow is an educational prototype. Funds are simulated mUSD on a local test chain. There is no KYC, bank connection or institutional integration.",
  ],
  [
    "What stops a payment being paid twice?",
    "Three layers: invoice dedupe in the ledger, a client UUID that makes retries idempotent, and a contract that rejects a second execution of the same payment.",
  ],
  [
    "What happens if the API fails mid-settlement?",
    "If the chain confirmed but the response was lost, the ledger stays EXECUTING until reconciliation finds the chain event and restores SETTLED with the original tx hash.",
  ],
  [
    "How do I find a payment later?",
    "Search by invoice number, payment ID or transaction hash. The audit trail exports as JSON.",
  ],
  ["Can the auditor change anything?", "No. The auditor role is read-only."],
  [
    "How do I try it?",
    "Open the live demo for a seeded browser simulation, or run the full stack locally with Docker from the GitHub README.",
  ],
];

function Faq() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <section id="faq" className="wrap faq" aria-labelledby="q-h">
      <Head eyebrow="FAQ" id="q-h" title="Questions, answered plainly." />
      <div className="acc">
        {FAQ.map(([q, a], i) => (
          <div key={q} className={`acc-item ${open === i ? "open" : ""}`}>
            <h3>
              <button
                aria-expanded={open === i}
                aria-controls={`faq-${i}`}
                id={`faq-b-${i}`}
                onClick={() => setOpen(open === i ? null : i)}
              >
                {q}
                <span className="acc-x" aria-hidden="true" />
              </button>
            </h3>
            <div
              id={`faq-${i}`}
              role="region"
              aria-labelledby={`faq-b-${i}`}
              hidden={open !== i}
            >
              <p>{a}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ---------- 11 · Final CTA ---------- */

function Final() {
  return (
    <section className="final" aria-labelledby="fin-h">
      <div className="wrap">
        <Reveal>
          <h2 id="fin-h">Try to pay an invoice twice.</h2>
          <p className="lead">
            Open the seeded simulation and try to break the rules. It won’t let
            you.
          </p>
          <div className="ctas center">
            <MagneticLink className="cta" href={DEMO}>
              Open live demo
            </MagneticLink>
            <a className="cta ghost" href={GITHUB} rel="noopener">
              View on GitHub
            </a>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

export default function Sections({ still }: { still: boolean }) {
  return (
    <>
      <Journey still={still} />
      <Controls />
      <Recovery still={still} />
      <Roles />
      <Workspace />
      <Honest />
      <Faq />
      <Final />
    </>
  );
}
