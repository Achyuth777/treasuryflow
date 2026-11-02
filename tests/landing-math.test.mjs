// Camera and step maths behind the landing scroll story.
import test from "node:test";
import assert from "node:assert/strict";
import { activeStep, dolly, frame } from "../frontend/landing-math.ts";

test("active step maps progress onto four journey stops", () => {
  assert.deepEqual(
    [0, 0.2, 0.4, 0.6, 0.9, 1].map((p) => activeStep(p, 4)),
    [0, 1, 1, 2, 3, 3],
  );
});

test("dolly holds exactly on each stop and pulls back between them", () => {
  const cams = [
    { x: 0, y: 0, s: 2 },
    { x: 100, y: 50, s: 2 },
  ];
  assert.deepEqual(dolly(0, cams), cams[0]);
  assert.deepEqual(dolly(1, cams), cams[1]);
  const mid = dolly(0.5, cams);
  assert.equal(mid.x, 50);
  assert.ok(mid.s < 2, "camera pulls back mid-move");
});

test("frame fits a rect inside the viewport", () => {
  const c = frame({ x: 0, y: 0, w: 500, h: 400 }, 1000, 800, 0.5);
  assert.deepEqual(c, { x: 250, y: 200, s: 1 });
});
