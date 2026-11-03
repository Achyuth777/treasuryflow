import React, { Suspense, lazy, useEffect, useRef, useState } from "react";
import { LazyMotion, domAnimation, m, useTransform } from "motion/react";
import "./landing-tokens.css";
import "./landing.css";
import "./landing-sequence.css"; // eager so the reserved height applies before the lazy chunk
import {
  MagneticLink,
  SmoothScroll,
  usePinProgress,
  useStatic,
} from "./landing-motion";
import { Dashboard, DeviceFrame } from "./landing-mock";

export const GITHUB = "https://github.com/Achyuth777/treasuryflow";
export const DEMO = "#workspace/Payments";
/** Hosted pilot workspace: records payments made elsewhere, moves no money. */
export const LIVE = "/app";
const Sections = lazy(() => import("./landing-sections"));
const ExplodedSequence = lazy(() => import("./landing-sequence"));

const NAV = [
  ["Product", "#product"],
  ["How it works", "#journey"],
  ["Controls", "#controls"],
  ["FAQ", "#faq"],
];

function Nav() {
  const [open, setOpen] = useState(false);
  const [slim, setSlim] = useState(false);
  useEffect(() => {
    const on = () => setSlim(scrollY > 24);
    on();
    addEventListener("scroll", on, { passive: true });
    return () => removeEventListener("scroll", on);
  }, []);
  return (
    <header className={`lp-nav ${slim ? "slim" : ""} ${open ? "open" : ""}`}>
      <div className="nav-in">
        <a className="wordmark" href="#top" aria-label="TreasuryFlow home">
          <b aria-hidden="true">T</b>TreasuryFlow
        </a>
        <nav aria-label="Primary" id="lp-menu">
          {NAV.map(([l, h]) => (
            <a key={h} href={h} onClick={() => setOpen(false)}>
              {l}
            </a>
          ))}
          <a href={LIVE} aria-label="Sign in to live workspace">
            Sign in
          </a>
          <a className="cta sm" href={DEMO}>
            Open live demo
          </a>
        </nav>
        <button
          className="burger"
          aria-expanded={open}
          aria-controls="lp-menu"
          onClick={() => setOpen(!open)}
        >
          <span className="sr">Menu</span>
          <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
            <path
              d={open ? "M5 5l10 10M15 5L5 15" : "M3 7h14M3 13h14"}
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
            />
          </svg>
        </button>
      </div>
    </header>
  );
}

/** Hero: opens on a macro crop of the approval drawer and pulls back to the full workspace. */
function Hero({ still }: { still: boolean }) {
  const ref = useRef<HTMLElement>(null);
  const p = usePinProgress(ref);
  // The camera transform lives in CSS (it differs per breakpoint) and reads --p.
  const copyOpacity = useTransform(p, [0, 0.42], [1, 0]);
  const copyY = useTransform(p, [0, 1], [0, -140]);
  return (
    <m.section
      ref={ref}
      className="hero"
      aria-labelledby="h1"
      style={still ? undefined : ({ "--p": p } as React.CSSProperties)}
    >
      <div className="hero-pin">
        <div className="hero-glow" aria-hidden="true" />
        <m.div
          className="wrap hero-copy"
          style={still ? undefined : { opacity: copyOpacity, y: copyY }}
        >
          <p className="proto">
            <span aria-hidden="true" className="proto-dot" />
            Educational prototype · simulated funds
          </p>
          <h1 id="h1">A payment that can’t be paid twice. Or skip approval.</h1>
          <p className="lead">
            Request, approve, settle and reconcile supplier payments with the
            rules enforced in code: dual approval, an on-chain daily limit and
            execution that happens exactly once.
          </p>
          <div className="ctas">
            <MagneticLink className="cta" href={DEMO}>
              Open live demo
            </MagneticLink>
            <a className="cta ghost" href={GITHUB} rel="noopener">
              View on GitHub
            </a>
          </div>
        </m.div>
        <div className="hero-stage">
          <div
            className="hero-cam"
            role="img"
            aria-label="Sample data: a TreasuryFlow workspace showing a 7,500 mUSD payment to Northstar Cloud waiting for its second manager approval."
          >
            <DeviceFrame title="TreasuryFlow · Payments">
              <Dashboard />
            </DeviceFrame>
          </div>
        </div>
      </div>
    </m.section>
  );
}

const STACK = [
  "React",
  "TypeScript",
  "Vite",
  "Spring Boot 3",
  "PostgreSQL",
  "Solidity",
  "Local Ethereum chain",
  "Node signing bridge",
];

function Stack() {
  const row = STACK.map((t) => <li key={t}>{t}</li>);
  return (
    <section id="product" className="stack" aria-label="Built with">
      <p className="stack-label">Built with</p>
      <div className="marquee">
        <div className="marquee-track">
          <ul>{row}</ul>
          <ul aria-hidden="true">{row}</ul>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="lp-foot">
      <div className="wrap foot-in">
        <div>
          <a className="wordmark" href="#top">
            <b aria-hidden="true">T</b>TreasuryFlow
          </a>
          <p className="foot-disc">
            <strong>Educational prototype · simulated funds.</strong> No real
            money, KYC, bank connection or institutional integration. Every
            figure in the interface mockups is sample data.
          </p>
        </div>
        <nav aria-label="Footer">
          <a href={GITHUB} rel="noopener">
            GitHub
          </a>
          <a href={GITHUB + "/blob/main/LICENSE"} rel="noopener">
            MIT license
          </a>
          <a href={GITHUB + "/tree/main/docs"} rel="noopener">
            Docs
          </a>
          <a href={DEMO}>Live demo</a>
          <a href={LIVE}>Sign in to live workspace</a>
        </nav>
      </div>
    </footer>
  );
}

export function Landing() {
  const still = useStatic();
  useEffect(() => {
    document.title = "TreasuryFlow — Payments that can’t be paid twice";
  }, []);
  return (
    <LazyMotion features={domAnimation} strict>
      <SmoothScroll />
      <div className="lp" id="top" data-motion={still ? "static" : "full"}>
        <a className="skip" href="#main">
          Skip to content
        </a>
        <Nav />
        <main id="main">
          <Hero still={still} />
          <Stack />
          <Suspense fallback={<div className="seq-hold" />}>
            <ExplodedSequence />
          </Suspense>
          <Suspense fallback={<div className="lazy-hold" />}>
            <Sections still={still} />
          </Suspense>
        </main>
        <Footer />
      </div>
    </LazyMotion>
  );
}
