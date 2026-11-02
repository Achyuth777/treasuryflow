// Scroll-linked image sequence: the five-layer "payment core" explodes, holds and
// reassembles as the section scrolls. Loaded lazily from landing.tsx.
import React, { useEffect, useRef, useState } from "react";
import {
  m,
  useMotionValue,
  useMotionValueEvent,
  useScroll,
  useSpring,
  useTransform,
  type MotionValue,
} from "motion/react";
import { useMedia } from "./landing-motion";
import "./landing-sequence.css";

/* ---- Sequence config: adjust to match your frame splitter's output ---- */
const FRAME_COUNT = 96;
const FRAME_DIR = "/sequence";
const framePath = (i: number) =>
  `${FRAME_DIR}/tf_${String(i).padStart(3, "0")}.webp`;
/* ----------------------------------------------------------------------- */

const LAST = FRAME_COUNT - 1;
const GITHUB = "https://github.com/Achyuth777/treasuryflow";
const DEMO = "#workspace/Payments";
const LABEL =
  "A five-layer payment core: request, approval, daily limit, settlement and reconciliation layers that separate and reassemble.";
// Explode over the first 60%, hold, reassemble by 95%.
const KEYS = [0, 0.6, 0.7, 0.95, 1];
const PRELOAD_CONCURRENCY = 6;

/** Loads frame 0 now; preloads the rest once the section is within ~1.5 viewports. */
function useFrames(
  sectionRef: React.RefObject<HTMLElement | null>,
  onProgress: (done: number) => void,
) {
  const frames = useRef<(HTMLImageElement | null)[]>(
    Array(FRAME_COUNT).fill(null),
  );
  const [first, setFirst] = useState<"pending" | "ok" | "failed">("pending");
  const [all, setAll] = useState(false);
  const report = useRef(onProgress);
  report.current = onProgress;

  useEffect(() => {
    let live = true;
    const img = new Image();
    img.src = framePath(0);
    if (typeof img.decode !== "function") {
      setFirst("failed");
      return;
    }
    img.decode().then(
      () => {
        if (!live) return;
        frames.current[0] = img;
        setBackdrop(sectionRef.current, img);
        setFirst("ok");
      },
      () => live && setFirst("failed"),
    );
    return () => {
      live = false;
    };
  }, []);

  useEffect(() => {
    const el = sectionRef.current;
    if (first !== "ok" || !el) return;
    let live = true,
      started = false,
      done = 1,
      next = 1;
    report.current(done / FRAME_COUNT);
    const pump = () => {
      if (!live || next >= FRAME_COUNT) return;
      const i = next++;
      const img = new Image();
      img.src = framePath(i);
      img
        .decode()
        .then(
          () => {
            frames.current[i] = img;
          },
          () => {},
        )
        .finally(() => {
          if (!live) return;
          done++;
          report.current(done / FRAME_COUNT);
          if (done === FRAME_COUNT) setAll(true);
          else pump();
        });
    };
    if (typeof IntersectionObserver === "undefined") {
      started = true;
      for (let k = 0; k < PRELOAD_CONCURRENCY; k++) pump();
      return () => {
        live = false;
      };
    }
    const io = new IntersectionObserver(
      ([e]) => {
        if (!e.isIntersecting || started) return;
        started = true;
        io.disconnect();
        for (let k = 0; k < PRELOAD_CONCURRENCY; k++) pump();
      },
      { rootMargin: "150% 0px" },
    );
    io.observe(el);
    return () => {
      live = false;
      io.disconnect();
    };
  }, [first]);

  return { frames, first, all };
}

/** Samples frame 0's corner so the stage background matches the frame edges. */
function setBackdrop(section: HTMLElement | null, img: HTMLImageElement) {
  if (!section) return;
  try {
    const c = document.createElement("canvas");
    c.width = c.height = 1;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(img, 0, 0, 1, 1, 0, 0, 1, 1);
    const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
    section.style.setProperty("--seq-bg", `rgb(${r} ${g} ${b})`);
  } catch {
    // Keep the CSS fallback colour if the pixel can't be read.
  }
}

/** Nearest decoded frame at or before i (a frame that failed to load is skipped). */
function pick(frames: (HTMLImageElement | null)[], i: number) {
  for (let k = i; k >= 0; k--) if (frames[k]) return frames[k];
  return null;
}

/** Draws `frame` into the canvas only when the rounded index changes, inside rAF. */
function useCanvasPlayer(
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
  frames: React.RefObject<(HTMLImageElement | null)[]>,
  frame: MotionValue<number>,
  active: boolean,
  scrubbing: boolean,
) {
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx || !active || typeof ResizeObserver === "undefined")
      return;
    let raf = 0,
      drawn = -1;
    const draw = () => {
      raf = 0;
      const want = scrubbing ? Math.round(frame.get()) : 0;
      if (want === drawn) return;
      const img = pick(frames.current, want);
      if (!img) return;
      const cw = canvas.width,
        ch = canvas.height;
      const s = Math.min(cw / img.naturalWidth, ch / img.naturalHeight);
      const dw = img.naturalWidth * s,
        dh = img.naturalHeight * s;
      ctx.clearRect(0, 0, cw, ch);
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(img, (cw - dw) / 2, (ch - dh) / 2, dw, dh);
      drawn = want;
    };
    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(draw);
    };
    const resize = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.round(canvas.clientWidth * dpr);
      canvas.height = Math.round(canvas.clientHeight * dpr);
      drawn = -1;
      schedule();
    };
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    const stop = frame.on("change", schedule);
    resize();
    return () => {
      ro.disconnect();
      stop();
      cancelAnimationFrame(raf);
    };
  }, [active, scrubbing]);
}

const LAYERS = [
  "Request",
  "Approval",
  "Daily limit",
  "Settlement",
  "Reconciliation",
];

/** CSS 3D stand-in for the sequence: five glass layers driven by `sep` (0 assembled → 1 exploded). */
function GlassStack({ sep }: { sep: MotionValue<number> }) {
  return (
    <div className="gs" role="img" aria-label={LABEL}>
      <div className="gs-scene" aria-hidden="true">
        {LAYERS.map((name, i) => (
          <GlassLayer key={name} name={name} i={i} sep={sep} />
        ))}
      </div>
    </div>
  );
}
function GlassLayer({
  name,
  i,
  sep,
}: {
  name: string;
  i: number;
  sep: MotionValue<number>;
}) {
  const z = useTransform(sep, (v) => (i - 2) * (14 + v * 76));
  return (
    <m.div className="gs-layer" style={{ z }}>
      <span>{name}</span>
    </m.div>
  );
}

const STORY = [
  {
    pos: "top",
    title: "A payment that can’t skip approval.",
    body: "One controlled path from request to proof of settlement.",
    opacity: [
      [0, 0.12, 0.18],
      [1, 1, 0],
    ],
    y: [
      [0, 0.18],
      [0, -24],
    ],
  },
  {
    pos: "left",
    title: "Approvals that scale with the amount.",
    body: "One manager up to 5,000 mUSD. Two distinct managers above.",
    opacity: [
      [0.2, 0.26, 0.36, 0.42],
      [0, 1, 1, 0],
    ],
    y: [
      [0.2, 0.26, 0.36, 0.42],
      [24, 0, 0, -24],
    ],
  },
  {
    pos: "right",
    title: "Limits enforced on-chain.",
    body: "A 25,000 mUSD daily cap checked atomically by the contract. A second execution is rejected independently.",
    opacity: [
      [0.5, 0.56, 0.66, 0.72],
      [0, 1, 1, 0],
    ],
    y: [
      [0.5, 0.56, 0.66, 0.72],
      [24, 0, 0, -24],
    ],
  },
  {
    pos: "bottom",
    title: "Interrupted? It reconciles.",
    body: "If the response drops after confirmation, reconciliation restores SETTLED with the original transaction hash.",
    opacity: [
      [0.8, 0.86, 1],
      [0, 1, 1],
    ],
    y: [
      [0.8, 0.86],
      [24, 0],
    ],
    cta: true,
  },
] as const;

function Ctas() {
  return (
    <div className="seq-ctas">
      <a className="cta" href={DEMO}>
        Open live demo
      </a>
      <a className="cta ghost" href={GITHUB} rel="noopener">
        View on GitHub
      </a>
    </div>
  );
}

function Overlay({
  s,
  progress,
}: {
  s: (typeof STORY)[number];
  progress: MotionValue<number>;
}) {
  const opacity = useTransform(progress, [...s.opacity[0]], [...s.opacity[1]]);
  const y = useTransform(progress, [...s.y[0]], [...s.y[1]]);
  const ctas = useRef<HTMLDivElement>(null);
  // Hidden overlays must not hold keyboard focus: toggle `inert` on the CTA group directly.
  useMotionValueEvent(opacity, "change", (v) => {
    if (ctas.current) ctas.current.inert = v < 0.5;
  });
  return (
    <m.div className={`seq-ov ov-${s.pos}`} style={{ opacity, y }}>
      <h3>{s.title}</h3>
      <p>{s.body}</p>
      {"cta" in s && (
        <div ref={ctas} inert>
          <Ctas />
        </div>
      )}
    </m.div>
  );
}

function Caption() {
  return (
    <p className="seq-caption">
      <span aria-hidden="true" />
      Educational prototype · simulated funds
    </p>
  );
}

/** Pinned, scroll-scrubbed version. */
function Scrub() {
  const ref = useRef<HTMLElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const bar = useRef<HTMLSpanElement>(null);
  const pct = useRef<HTMLSpanElement>(null);
  const meter = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end end"],
  });
  const progress = useSpring(scrollYProgress, {
    stiffness: 260,
    damping: 40,
    restDelta: 0.0005,
  });
  const frame = useTransform(progress, KEYS, [0, LAST, LAST, 0, 0]);
  const sep = useTransform(progress, KEYS, [0, 1, 1, 0, 0]);
  const { frames, first, all } = useFrames(ref, (done) => {
    const p = Math.round(done * 100);
    bar.current?.style.setProperty("transform", `scaleX(${done})`);
    if (pct.current) pct.current.textContent = `${p}%`;
    meter.current?.setAttribute("aria-valuenow", String(p));
  });
  useCanvasPlayer(canvas, frames, frame, first === "ok", all);

  return (
    <section ref={ref} className="seq" aria-labelledby="seq-h">
      <h2 id="seq-h" className="sr">
        Inside the payment core
      </h2>
      <div className="seq-stage">
        {first === "failed" ? (
          <GlassStack sep={sep} />
        ) : (
          <canvas
            ref={canvas}
            className="seq-canvas"
            role="img"
            aria-label={LABEL}
          />
        )}
        {STORY.map((s) => (
          <Overlay key={s.title} s={s} progress={progress} />
        ))}
        <Caption />
        {first === "ok" && !all && (
          <div
            ref={meter}
            className="seq-load"
            role="progressbar"
            aria-label="Loading the payment core animation"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={1}
          >
            <span className="seq-load-track">
              <span ref={bar} className="seq-load-bar" />
            </span>
            <span ref={pct} className="seq-load-pct">
              1%
            </span>
          </div>
        )}
      </div>
    </section>
  );
}

/** Reduced motion: no pinning or scrubbing. Assembled frame, then exploded frame, each with its text. */
function Still() {
  const [failed, setFailed] = useState(false);
  const assembled = useMotionValue(0);
  const exploded = useMotionValue(1);
  const shots = [
    {
      src: framePath(0),
      sep: assembled,
      alt: "The payment core assembled: five layers stacked into one object.",
      text: [STORY[0], STORY[1]],
    },
    {
      src: framePath(LAST),
      sep: exploded,
      alt: "The payment core exploded: request, approval, daily limit, settlement and reconciliation layers pulled apart.",
      text: [STORY[2], STORY[3]],
    },
  ];
  return (
    <section className="seq-still wrap" aria-labelledby="seq-h">
      <h2 id="seq-h" className="sr">
        Inside the payment core
      </h2>
      <Caption />
      {shots.map((shot, i) => (
        <figure key={shot.src} className="seq-shot">
          <div className="seq-frame">
            {failed ? (
              <GlassStack sep={shot.sep} />
            ) : (
              <img
                src={shot.src}
                alt={shot.alt}
                width={1600}
                height={900}
                loading="lazy"
                decoding="async"
                onError={() => setFailed(true)}
              />
            )}
          </div>
          <figcaption>
            {shot.text.map((s) => (
              <div key={s.title} className="seq-still-text">
                <h3>{s.title}</h3>
                <p>{s.body}</p>
              </div>
            ))}
            {i === 1 && <Ctas />}
          </figcaption>
        </figure>
      ))}
    </section>
  );
}

export default function ExplodedSequence() {
  const reduced = useMedia("(prefers-reduced-motion: reduce)");
  return reduced ? <Still /> : <Scrub />;
}
