// Motion layer for the landing page: Motion (motion/react) for scroll-linked and
// pointer-driven motion, Lenis for smooth scrolling. Motion values update styles
// directly, so scroll and pointer movement never re-render React.
import React, {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import {
  m,
  useMotionTemplate,
  useMotionValue,
  useScroll,
  useSpring,
} from "motion/react";
import { ReactLenis, useLenis } from "lenis/react";
import "lenis/dist/lenis.css";

/** Narrow screens and reduced-motion users get the static, fully readable layout. */
export const STATIC_QUERY =
  "(max-width: 767px), (prefers-reduced-motion: reduce)";
const REDUCED_QUERY = "(prefers-reduced-motion: reduce)";

/** Spring for direct interactions (tilt, magnetic CTA). */
export const SPRING = { stiffness: 300, damping: 30 };
/** Light smoothing on top of scroll progress; Lenis already eases the scroll itself. */
const SCROLL_SPRING = { stiffness: 220, damping: 40, restDelta: 0.0005 };

export function useMedia(query: string) {
  return useSyncExternalStore(
    (cb) => {
      const mq = matchMedia(query);
      mq.addEventListener("change", cb);
      return () => mq.removeEventListener("change", cb);
    },
    () => matchMedia(query).matches,
  );
}
export const useStatic = () => useMedia(STATIC_QUERY);
/** Tilt, magnetism and smooth scrolling: mouse-class pointers without reduced motion. */
export function useFinePointer() {
  const fine = useMedia("(pointer: fine)");
  const reduced = useMedia(REDUCED_QUERY);
  return fine && !reduced;
}
const prefersReduced = () => matchMedia(REDUCED_QUERY).matches;

/**
 * Smoothed 0→1 progress of a pinned section: 0 when its top meets the viewport
 * top, 1 when its bottom meets the viewport bottom.
 */
export function usePinProgress(ref: React.RefObject<HTMLElement | null>) {
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end end"],
  });
  return useSpring(scrollYProgress, SCROLL_SPRING);
}

/**
 * Routes in-page anchor links through Lenis and pauses it while a modal is open.
 * Leaves workspace routes (`#workspace/…`) and skip links native.
 */
function LenisAnchors({ paused }: { paused: boolean }) {
  const lenis = useLenis();
  useEffect(() => {
    if (!lenis) return;
    if (paused) lenis.stop();
    else lenis.start();
  }, [lenis, paused]);
  useEffect(() => {
    if (!lenis) return;
    const onClick = (e: MouseEvent) => {
      const a = (e.target as Element | null)?.closest?.("a[href^='#']");
      if (!(a instanceof HTMLAnchorElement) || /\bskip/.test(a.className))
        return;
      const hash = a.getAttribute("href") ?? "";
      if (hash.length < 2 || hash.includes("/")) return;
      const target = document.getElementById(hash.slice(1));
      if (!target) return;
      e.preventDefault();
      lenis.scrollTo(target);
      history.pushState(null, "", hash);
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, [lenis]);
  return null;
}

/** Lenis on the document root, only for fine pointers without reduced motion. */
export function SmoothScroll({ paused = false }: { paused?: boolean }) {
  const fine = useFinePointer();
  if (!fine || typeof ResizeObserver === "undefined") return null;
  return (
    <ReactLenis
      root
      options={{ lerp: 0.1, smoothWheel: true, allowNestedScroll: true }}
    >
      <LenisAnchors paused={paused} />
    </ReactLenis>
  );
}

/** Card with spring tilt, pointer-following glare and spotlight. Fine pointers only. */
export function TiltCard({
  children,
  className = "",
  max = 11,
}: {
  children: React.ReactNode;
  className?: string;
  max?: number;
}) {
  const fine = useFinePointer();
  const rotateX = useSpring(0, SPRING);
  const rotateY = useSpring(0, SPRING);
  const mx = useMotionValue(50);
  const my = useMotionValue(30);
  const glare = useMotionTemplate`radial-gradient(circle at ${mx}% ${my}%, rgba(255, 255, 255, 0.12), transparent 45%)`;
  const spot = useMotionTemplate`radial-gradient(420px circle at ${mx}% ${my}%, rgba(255, 177, 107, 0.1), transparent 60%)`;
  const move = (e: React.PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width,
      py = (e.clientY - r.top) / r.height;
    mx.set(px * 100);
    my.set(py * 100);
    rotateX.set(-(py - 0.5) * 2 * max);
    rotateY.set((px - 0.5) * 2 * max);
  };
  const leave = () => {
    rotateX.set(0);
    rotateY.set(0);
  };
  return (
    <div
      className={`tilt ${className}`}
      onPointerMove={fine ? move : undefined}
      onPointerLeave={fine ? leave : undefined}
    >
      <m.div
        className="tilt-inner"
        style={fine ? { rotateX, rotateY } : undefined}
      >
        {fine && (
          <m.span
            className="tilt-spot"
            style={{ background: spot }}
            aria-hidden="true"
          />
        )}
        {children}
        {fine && (
          <m.span
            className="tilt-glare"
            style={{ background: glare }}
            aria-hidden="true"
          />
        )}
      </m.div>
    </div>
  );
}

/** Link that leans toward the pointer and springs back. */
export function MagneticLink({
  href,
  className = "",
  children,
}: {
  href: string;
  className?: string;
  children: React.ReactNode;
}) {
  const fine = useFinePointer();
  const x = useSpring(0, SPRING);
  const y = useSpring(0, SPRING);
  return (
    <m.a
      href={href}
      className={`magnetic ${className}`}
      style={fine ? { x, y } : undefined}
      onPointerMove={
        fine
          ? (e) => {
              const r = e.currentTarget.getBoundingClientRect();
              x.set((e.clientX - r.left - r.width / 2) * 0.22);
              y.set((e.clientY - r.top - r.height / 2) * 0.3);
            }
          : undefined
      }
      onPointerLeave={
        fine
          ? () => {
              x.set(0);
              y.set(0);
            }
          : undefined
      }
    >
      {children}
    </m.a>
  );
}

/** True once the element has entered the viewport (immediately under reduced motion). */
export function useInView<T extends HTMLElement>(threshold = 0.2) {
  const ref = useRef<T>(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (prefersReduced() || typeof IntersectionObserver === "undefined")
      return setSeen(true);
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setSeen(true);
          io.disconnect();
        }
      },
      { threshold },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [threshold]);
  return [ref, seen] as const;
}

export function Reveal({
  children,
  className = "",
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  const [ref, seen] = useInView<HTMLDivElement>(0.15);
  return (
    <div
      ref={ref}
      className={`rv ${seen ? "in" : ""} ${className}`}
      style={delay ? { transitionDelay: `${delay}ms` } : undefined}
    >
      {children}
    </div>
  );
}

/** Counts up to a real policy figure once visible. The final value is always in the DOM for assistive tech. */
export function Counter({ to }: { to: number }) {
  const [ref, seen] = useInView<HTMLSpanElement>(0.6);
  const out = useRef<HTMLSpanElement>(null);
  const fmt = (n: number) => n.toLocaleString("en-US");
  useEffect(() => {
    const el = out.current;
    if (!seen || !el || prefersReduced()) return;
    const t0 = performance.now();
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / 1400);
      el.textContent = fmt(Math.round(to * (1 - Math.pow(1 - p, 4))));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [seen, to]);
  return (
    <span ref={ref} className="counter">
      <span className="sr">{fmt(to)}</span>
      <span ref={out} aria-hidden="true">
        {fmt(to)}
      </span>
    </span>
  );
}

export const SampleTag = () => <span className="sample">Sample data</span>;
