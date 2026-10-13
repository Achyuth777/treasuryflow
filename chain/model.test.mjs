import { test } from "node:test";
import assert from "node:assert/strict";
import { Demo, suppliers, today } from "../frontend/model.ts";
const input = (amount = "100") => ({
  id: crypto.randomUUID(),
  invoice: crypto.randomUUID(),
  recipient: suppliers[0].id,
  amount,
  dueDate: today(),
});
test("browser scenario detects duplicates, denies auditor, recovers exactly one settlement", () => {
  const d = new Demo().seed();
  const r = d.scenario();
  assert.ok(r.duplicate && r.denied && r.recovered && r.oneSettlement);
});
test("same invoice with a new ID is rejected", () => {
  const d = new Demo();
  const b = input();
  d.create("creator", b);
  assert.throws(() => d.create("creator", { ...b, id: crypto.randomUUID() }));
});
test("accounting mismatch is flagged and never overwritten", () => {
  const d = new Demo();
  const b = input();
  d.create("creator", b);
  d.act(b.id, "manager1", "approve");
  d.act(b.id, "creator", "execute");
  d.payments[0].amount = "101";
  assert.equal(d.reconcile().flags[0].issue, "AMOUNT_OR_RECIPIENT_MISMATCH");
  assert.equal(d.payments[0].amount, "101");
});
test("two distinct managers are required above 5,000", () => {
  const d = new Demo();
  const b = input("5000.000001");
  d.create("creator", b);
  d.act(b.id, "manager1", "approve");
  assert.throws(() => d.act(b.id, "creator", "execute"));
  assert.throws(() => d.act(b.id, "manager1", "approve"));
  d.act(b.id, "manager2", "approve");
  d.act(b.id, "creator", "execute");
  assert.equal(d.reconcile().matched, 1);
});
test("payload conflict and unauthorized creation fail", () => {
  const d = new Demo();
  const b = input();
  assert.throws(() => d.create("auditor", b));
  d.create("creator", b);
  assert.throws(() => d.create("creator", { ...b, amount: "2" }));
});
