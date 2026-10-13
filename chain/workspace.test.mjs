import { test } from "node:test";
import assert from "node:assert/strict";
import {
  makeDemo,
  validateInput,
  settlementSeries,
} from "../frontend/workspace.ts";
import { suppliers, today } from "../frontend/model.ts";
test("guided form rejects impossible dates, duplicate invoices and bad precision", () => {
  const d = makeDemo();
  const input = {
    id: crypto.randomUUID(),
    invoice: "INV-2026-084",
    recipient: suppliers[0].id,
    amount: "1.0000001",
    dueDate: "2026-02-31",
  };
  const e = validateInput(input, d.payments, suppliers);
  assert.ok(e.invoice && e.amount && e.dueDate);
  assert.equal(
    Object.keys(
      validateInput(
        {
          ...input,
          invoice: "VALID-100",
          amount: "1.000001",
          dueDate: today(),
        },
        d.payments,
        suppliers,
      ),
    ).length,
    0,
  );
});
test("chart derives settlements from audit evidence and deduplicates event IDs", () => {
  const d = makeDemo();
  const s = settlementSeries(d.payments, d.audit, 7);
  assert.equal(s.length, 7);
  assert.equal(s.at(-1).value, 3200);
  const duplicate = d.audit.find((a) => a.action === "EXECUTED");
  assert.deepEqual(settlementSeries(d.payments, [duplicate, ...d.audit], 7), s);
});
