// Pure motion math for the landing page. No DOM access, so it can be unit tested.

export const clamp = (v: number, lo = 0, hi = 1) =>
  Math.min(hi, Math.max(lo, v));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const easeInOut = (t: number) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

/** Index of the stop nearest to progress p across n stops. */
export const activeStep = (p: number, n: number) =>
  Math.round(clamp(p) * (n - 1));

export type Rect = { x: number; y: number; w: number; h: number };
export type Camera = { x: number; y: number; s: number };

/** Camera centred on `r` so it fills `fill` of a vw × vh viewport. */
export function frame(r: Rect, vw: number, vh: number, fill = 0.72): Camera {
  return {
    x: r.x + r.w / 2,
    y: r.y + r.h / 2,
    s: Math.min((vw * fill) / r.w, (vh * fill) / r.h),
  };
}

/**
 * Camera dolly across stops: holds on each stop, eases to the next and pulls
 * back slightly mid-move so the travel reads as a camera, not a slide.
 */
export function dolly(p: number, cams: Camera[], hold = 0.4): Camera {
  if (cams.length === 1) return cams[0];
  const u = clamp(p) * (cams.length - 1);
  const i = Math.min(cams.length - 2, Math.floor(u));
  const t = easeInOut(clamp((u - i - hold / 2) / (1 - hold)));
  const a = cams[i],
    b = cams[i + 1];
  return {
    x: lerp(a.x, b.x, t),
    y: lerp(a.y, b.y, t),
    s: lerp(a.s, b.s, t) * (1 - 0.22 * Math.sin(Math.PI * t)),
  };
}
