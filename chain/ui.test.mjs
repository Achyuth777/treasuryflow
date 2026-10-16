import { test, before } from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { build } from "esbuild";
import { randomUUID } from "node:crypto";
let bundle;
before(async () => {
  bundle = (
    await build({
      entryPoints: ["frontend/main.tsx"],
      bundle: true,
      write: false,
      format: "iife",
      loader: { ".css": "empty", ".png": "dataurl" },
      define: { "process.env.NODE_ENV": '"production"' },
    })
  ).outputFiles[0].text;
});
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function setup(api = false, home = false) {
  const dom = new JSDOM('<!doctype html><div id="root"></div>', {
    url: api ? "http://localhost/?mode=api" : home ? "http://localhost/" : "http://localhost/#workspace/Payments",
    runScripts: "outside-only",
    pretendToBeVisual: true,
  });
  const w = dom.window;
  w.scrollTo = () => {};
  w.matchMedia = query => Object.assign(new w.EventTarget(), {
    matches: true,
    media: query,
    onchange: null,
  });
  w.HTMLElement.prototype.scrollIntoView = () => {};
  w.structuredClone = structuredClone;
  w.crypto.randomUUID = randomUUID;
  w.AbortSignal = AbortSignal;
  w.fetch = async (url, options) => {
    const endpoint = String(url);
    const cfg = {
      suppliers: [
        {
          id: "0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65",
          name: "Northstar Cloud",
          category: "Infrastructure",
        },
      ],
      balance: "500000",
      dailySpent: "0",
      dailyLimit: "25000",
      threshold: "5000",
      chainId: 31337,
    };
    const failed = endpoint === "/api/payments" && options.method === "POST";
    return {
      ok: !failed,
      status: failed ? 503 : 200,
      json: async () =>
        failed
          ? { error: "Test network failure. Your request may be pending." }
          : endpoint.endsWith("config")
            ? cfg
            : [],
    };
  };
  w.eval(bundle);
  await sleep(60);
  return { w, dom, doc: w.document };
}
const button = (d, text) =>
  [...d.querySelectorAll("button")].find((b) => b.textContent.trim() === text);
const click = async (el) => {
  assert.ok(el, "Expected control exists");
  el.click();
  await sleep(60);
};
const set = async (w, el, value) => {
  assert.ok(el, "Expected input exists");
  const prototype =
    el.tagName === "SELECT"
      ? w.HTMLSelectElement.prototype
      : w.HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(prototype, "value").set.call(el, value);
  el.dispatchEvent(
    new w.Event(el.tagName === "SELECT" ? "change" : "input", {
      bubbles: true,
    }),
  );
  await sleep(40);
};

test("dashboard shows honest demo metrics, searchable payments and range controls", async () => {
  const { dom, doc } = await setup();
  try {
    assert.match(doc.body.textContent, /Payments/);
    assert.equal(doc.querySelectorAll('nav[aria-label="Main navigation"] button').length, 3);
    await click(button(doc, "Overview"));
    assert.match(doc.body.textContent, /Treasury overview/);
    assert.match(doc.body.textContent, /simulated settlement/);
    await click(button(doc, "14D"));
    assert.equal(button(doc, "14D").getAttribute("aria-pressed"), "true");
    assert.equal(doc.querySelectorAll(".bar-column").length, 14);
    const { defaultView: w } = doc;
    await set(
      w,
      doc.querySelector('[aria-label="Search payments"]'),
      "no-such-invoice",
    );
    assert.match(doc.body.textContent, /No matching payments/);
    await click(button(doc, "Clear filters"));
    assert.ok(doc.querySelectorAll("tbody tr").length > 0);
  } finally {
    dom.window.close();
  }
});

test("table sorts and payment drawer opens with history and closes on Escape", async () => {
  const { dom, doc, w } = await setup();
  try {
    await click(
      [...doc.querySelectorAll("th button")].find((b) =>
        b.textContent.includes("Amount"),
      ),
    );
    assert.equal(
      doc.querySelector('th[aria-sort="ascending"] button').textContent,
      "Amount",
    );
    await click(doc.querySelector(".row-link"));
    assert.ok(doc.querySelector('[role="dialog"]'));
    assert.match(doc.querySelector(".drawer").textContent, /Audit timeline/);
    assert.ok(doc.getElementById("workspace").hasAttribute("inert"));
    doc.dispatchEvent(
      new w.KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
    );
    await sleep(30);
    assert.equal(doc.querySelector('[role="dialog"]'), null);
    assert.equal(doc.getElementById("workspace").hasAttribute("inert"), false);
  } finally {
    dom.window.close();
  }
});

test("guided payment validates inline, reviews, then creates exactly one request", async () => {
  const { dom, doc, w } = await setup();
  try {
    await click(button(doc, "New payment"));
    doc
      .querySelector(".modal form")
      .dispatchEvent(
        new w.Event("submit", { bubbles: true, cancelable: true }),
      );
    await sleep(30);
    assert.ok(doc.querySelectorAll(".field-error").length >= 3);
    await set(
      w,
      doc.querySelector(".modal select"),
      doc.querySelectorAll(".modal select option")[1].value,
    );
    await set(
      w,
      doc.querySelector('input[placeholder="e.g. INV-2026-085"]'),
      "QA-NEW-100",
    );
    await set(w, doc.querySelector('input[placeholder="0.00"]'), "120.25");
    doc
      .querySelector(".modal form")
      .dispatchEvent(
        new w.Event("submit", { bubbles: true, cancelable: true }),
      );
    await sleep(40);
    assert.match(
      doc.querySelector(".modal").textContent,
      /Review before submitting/,
    );
    assert.match(doc.querySelector(".modal").textContent, /120.25/);
    doc
      .querySelector(".modal form")
      .dispatchEvent(
        new w.Event("submit", { bubbles: true, cancelable: true }),
      );
    await sleep(80);
    assert.equal(doc.querySelector(".modal"), null);
    await set(
      w,
      doc.querySelector('[aria-label="Search payments"]'),
      "QA-NEW-100",
    );
    assert.equal(doc.querySelectorAll("tbody tr").length, 1);
  } finally {
    dom.window.close();
  }
});

test("manager approval updates drawer; auditor controls remain disabled", async () => {
  const { dom, doc, w } = await setup();
  try {
    await set(
      w,
      doc.querySelector('[aria-label="Search payments"]'),
      "INV-2026-084",
    );
    await click(doc.querySelector(".row-link"));
    await set(
      w,
      doc.querySelector('[aria-label="Acting role in payment drawer"]'),
      "manager2",
    );
    await click(button(doc, "Approve payment"));
    assert.match(doc.querySelector(".drawer").textContent, /Approving/);
    await sleep(550);
    assert.equal(doc.querySelector(".drawer .badge").textContent, "Approved");
    await set(
      w,
      doc.querySelector('[aria-label="Acting role in payment drawer"]'),
      "auditor",
    );
    assert.equal(button(doc, "Approve payment").disabled, true);
    assert.equal(button(doc, "Execute payment").disabled, true);
  } finally {
    dom.window.close();
  }
});

test("recovery lab passes four checks and mismatch simulation shows exception", async () => {
  const { dom, doc } = await setup();
  try {
    await click(button(doc, "Demo lab"));
    await click(button(doc, "Run failure-recovery demo"));
    await sleep(600);
    assert.equal(doc.querySelectorAll(".scenario-card .passed").length, 4);
    await click(button(doc, "Simulate mismatch"));
    assert.match(doc.body.textContent, /Amount or recipient mismatch/);
  } finally {
    dom.window.close();
  }
});

test("failed API submission preserves review and input fields", async () => {
  const { dom, doc, w } = await setup(true);
  try {
    await set(w, doc.querySelector('input[type="password"]'), "demo");
    doc
      .querySelector("form")
      .dispatchEvent(
        new w.Event("submit", { bubbles: true, cancelable: true }),
      );
    await sleep(100);
    await click(button(doc, "New payment"));
    await set(
      w,
      doc.querySelector(".modal select"),
      doc.querySelectorAll(".modal select option")[1].value,
    );
    await set(
      w,
      doc.querySelector('input[placeholder="e.g. INV-2026-085"]'),
      "KEEP-MY-INPUT",
    );
    await set(w, doc.querySelector('input[placeholder="0.00"]'), "345");
    doc
      .querySelector(".modal form")
      .dispatchEvent(
        new w.Event("submit", { bubbles: true, cancelable: true }),
      );
    await sleep(40);
    doc
      .querySelector(".modal form")
      .dispatchEvent(
        new w.Event("submit", { bubbles: true, cancelable: true }),
      );
    await sleep(80);
    assert.match(
      doc.querySelector(".modal").textContent,
      /Test network failure/,
    );
    await click(button(doc, "Back to details"));
    assert.equal(
      doc.querySelector('input[placeholder="e.g. INV-2026-085"]').value,
      "KEEP-MY-INPUT",
    );
    assert.equal(doc.querySelector('input[placeholder="0.00"]').value, "345");
  } finally {
    dom.window.close();
  }
});

test("payment priorities filter the queue and clear back to all requests", async () => {
  const { dom, doc } = await setup();
  try {
    const summary = [...doc.querySelectorAll('.summary-item')].find(b => b.textContent.includes('Awaiting approval'));
    const expected = Number(summary.querySelector('strong').textContent);
    await click(summary);
    assert.equal(summary.getAttribute('aria-pressed'), 'true');
    assert.equal(doc.querySelectorAll('tbody tr').length, expected);
    assert.ok([...doc.querySelectorAll('tbody .badge')].every(el => el.classList.contains('pending')));
    await click(button(doc, 'Clear filters'));
    assert.ok(doc.querySelectorAll('tbody tr').length > expected);
    await click([...doc.querySelectorAll('.summary-item')].find(b => b.textContent.includes('Needs attention')));
    assert.match(doc.body.textContent, /No matching payments/);
    await click(button(doc, 'Clear filters'));
    assert.ok(doc.querySelectorAll('tbody tr').length > 0);
  } finally { dom.window.close(); }
});

test("secondary tools preserve overview and reliability features; activity and reconciliation remain primary", async () => {
  const { dom, doc } = await setup();
  try {
    assert.deepEqual([...doc.querySelectorAll('nav button')].map(b => b.textContent.replace(/\d+$/, '').trim()), ['Payments', 'Reconciliation', 'Activity']);
    assert.equal(doc.querySelector('.workspace-tools').open, false);
    assert.equal(doc.querySelector('.operating-title h1').textContent, 'Payments');
    await click(button(doc, 'Activity'));
    assert.match(doc.body.textContent, /Local demo activity/);
    await click(button(doc, 'Reconciliation'));
    await click(button(doc, 'Run reconciliation'));
    assert.match(doc.body.textContent, /Everything matches/);
    await click(button(doc, 'Policy & recipients'));
    assert.match(doc.body.textContent, /Applied in the simulation/);
    assert.equal(doc.querySelectorAll('.recipient-row').length, 2);
  } finally { dom.window.close(); }
});

test('new public website has working carousel, policy explorer and keyboard journey', async () => {
  const { dom, doc, w } = await setup(false, true);
  try {
    assert.ok(doc.querySelector('.site-hero'));
    assert.equal(doc.querySelector('.operations-header'), null);
    assert.match(doc.querySelector('.site-hero h1').textContent, /Business moves/);
    await click(doc.querySelector('[aria-label="Next capability"]'));
    assert.match(doc.querySelector('.site-hero h1').textContent, /The right payment/);
    await click(doc.querySelector('[aria-label="Previous capability"]'));
    assert.match(doc.querySelector('.site-hero h1').textContent, /Business moves/);
    await click(doc.querySelectorAll('.capability-row > button')[1]);
    await set(w, doc.querySelector('[aria-label="Explore approval amount"]'), '5000');
    assert.equal(doc.querySelector('.approval-result strong').textContent, '01');
    await set(w, doc.querySelector('[aria-label="Explore approval amount"]'), '5001');
    assert.equal(doc.querySelector('.approval-result strong').textContent, '02');
    const first = doc.getElementById('journey-tab-0');
    first.focus();
    first.dispatchEvent(new w.KeyboardEvent('keydown', {key:'ArrowRight', bubbles:true}));
    await sleep(40);
    assert.equal(doc.activeElement.id, 'journey-tab-1');
    assert.equal(doc.activeElement.getAttribute('aria-selected'), 'true');
    assert.match(doc.querySelector('#journey-panel').textContent, /distinct approvers/);
    await click(button(doc, 'Team'));
    assert.equal(doc.querySelectorAll('.network-node').length, 4);
    await click(button(doc, 'Suppliers'));
    assert.equal(doc.querySelectorAll('.network-node').length, 2);
  } finally { dom.window.close(); }
});

test('payment tracking searches real demo records, handles no result and opens the existing drawer', async () => {
  const { dom, doc, w } = await setup(false, true);
  try {
    await click(button(doc, 'Track a payment'));
    assert.ok(doc.querySelector('.tracker-modal'));
    await set(w, doc.getElementById('tracking-query'), 'NO-SUCH-PAYMENT');
    doc.querySelector('.tracking-form').dispatchEvent(new w.Event('submit', {bubbles:true,cancelable:true}));
    await sleep(40);
    assert.match(doc.querySelector('.tracker-modal').textContent, /No matching payment/);
    await click(doc.querySelector('.tracking-example button'));
    assert.equal(doc.querySelectorAll('.tracking-result').length, 1);
    await set(w, doc.getElementById('tracking-query'), 'INV-2026-084');
    doc.querySelector('.tracking-form').dispatchEvent(new w.Event('submit', {bubbles:true,cancelable:true}));
    await sleep(40);
    const invoice = doc.querySelector('.tracking-result-head small').textContent;
    assert.equal(doc.querySelectorAll('.tracking-progress .complete').length, 1);
    await click(button(doc, 'View payment details'));
    assert.equal(doc.querySelector('.public-site'), null);
    assert.ok(doc.querySelector('.operations-header'));
    assert.match(doc.querySelector('.drawer').textContent, new RegExp(invoice));
    assert.equal(w.location.hash, '#workspace/Payments');
    assert.ok(doc.getElementById('workspace').hasAttribute('inert'));
  } finally { dom.window.close(); }
});

test('fullscreen menu closes with Escape and create CTA opens the original validated form', async () => {
  const { dom, doc, w } = await setup(false, true);
  try {
    const menuButton = doc.querySelector('[aria-label="Open website menu"]');
    menuButton.focus();
    await click(menuButton);
    assert.equal(doc.querySelectorAll('.menu-links button').length, 5);
    assert.ok(doc.getElementById('workspace').hasAttribute('inert'));
    doc.dispatchEvent(new w.KeyboardEvent('keydown', {key:'Escape',bubbles:true}));
    await sleep(30);
    assert.equal(doc.querySelector('.public-menu'), null);
    assert.equal(doc.activeElement, menuButton);
    await click(button(doc, 'Create a payment'));
    assert.ok(doc.querySelector('.operations-header'));
    assert.ok(doc.querySelector('.modal form'));
    doc.querySelector('.modal form').dispatchEvent(new w.Event('submit', {bubbles:true,cancelable:true}));
    await sleep(40);
    assert.ok(doc.querySelectorAll('.field-error').length >= 3);
  } finally { dom.window.close(); }
});

test('scenario stories lead to functioning demo tools; reset requires an explicit choice', async () => {
  const { dom, doc } = await setup(false, true);
  try {
    await click(doc.querySelectorAll('.story-card')[2]);
    assert.match(doc.querySelector('.site-modal').textContent, /response that never arrived/);
    await click(button(doc, 'Open reliability demo'));
    assert.ok(button(doc, 'Run failure-recovery demo'));
    await click(button(doc, 'Reset demo data'));
    assert.match(doc.querySelector('[role="dialog"]').textContent, /fresh demo/);
    await click(button(doc, 'Keep my data'));
    assert.equal(doc.querySelector('[role="dialog"]'), null);
    await click(button(doc, 'Reset demo data'));
    await click(button(doc, 'Reset demo'));
    assert.equal(doc.querySelector('[role="dialog"]'), null);
    assert.match(doc.body.textContent, /original sample payments are ready/);
  } finally { dom.window.close(); }
});
