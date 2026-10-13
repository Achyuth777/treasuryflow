import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
const base = process.env.API_URL || "http://localhost:8088/api";
const password = process.env.DEMO_PASSWORD || "treasury-demo-only";
async function request(actor, path, body, expected = 200) {
  const r = await fetch(base + path, {
    method: body === undefined ? "GET" : "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization:
        "Basic " + Buffer.from(actor + ":" + password).toString("base64"),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const data = await r.json();
  assert.equal(r.status, expected, JSON.stringify(data));
  return data;
}
const config = await request("creator", "/config");
const id = crypto.randomUUID();
const b = {
  id,
  recipient: config.suppliers[0].id,
  invoice: "DEMO-" + id,
  amount: "100",
  dueDate: new Date().toISOString().slice(0, 10),
};
await request("creator", "/payments", b);
await request("creator", "/payments", b);
const list = await request("auditor", "/payments");
assert.equal(list.filter((p) => p.id === id).length, 1);
console.log("PASS: Duplicate submission returned one record.");
await request("auditor", `/payments/${id}/approve`, {}, 403);
console.log("PASS: Unauthorized approval denied.");
await request("manager1", `/payments/${id}/approve`, {});
await request("creator", `/payments/${id}/execute?interrupt=true`, {}, 503);
console.log("PASS: Injected interrupted response after confirmed settlement.");
if (process.env.RESTART_BACKEND === "true") {
  const result = spawnSync("docker", ["compose", "restart", "backend"], {
    stdio: "inherit",
  });
  assert.equal(result.status, 0);
  let ready = false;
  for (let i = 0; i < 40; i++) {
    try {
      await request("auditor", "/config");
      ready = true;
      break;
    } catch {
      await new Promise((r) => setTimeout(r, 1000));
    }
  }
  assert.ok(ready, "Backend did not recover");
  console.log("PASS: Backend process restarted; chain and database retained.");
}
const start = performance.now();
const report = await request("auditor", "/reconcile", {});
const payment = (await request("auditor", "/payments")).find(
  (p) => p.id === id,
);
assert.equal(payment.status, "SETTLED");
assert.ok(payment.txHash?.startsWith("0x"));
console.log(
  "PASS: Recovered real transaction",
  payment.txHash,
  `(${Math.round(performance.now() - start)} ms)`,
);
const retry = await request("creator", `/payments/${id}/execute`, {});
assert.equal(retry.txHash, payment.txHash);
const audit = await request("auditor", "/audit");
assert.equal(
  audit.filter((e) => e.payment_id === id && e.action === "EXECUTED").length,
  1,
);
console.log("PASS: Retry produced no second settlement.");
console.log(JSON.stringify(report, null, 2));
