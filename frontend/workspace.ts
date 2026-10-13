import {
  Demo,
  today,
  suppliers,
  units,
  type Input,
  type Payment,
  type Audit,
} from "./model.ts";
export const money = (v: string | number) =>
  Number(v).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 6,
  });
export const title = (v: string) =>
  v
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/^./, (c) => c.toUpperCase());
export const dateLabel = (v: string) =>
  new Date(v + "T12:00:00Z").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
export const short = (v: string) =>
  v.length > 24 ? v.slice(0, 10) + "…" + v.slice(-8) : v;
export function makeDemo() {
  const d = new Demo().seed();
  const currentSpent = d.spent;
  [
    2400, 7800, 4600, 8900, 3200, 6400, 1250, 3800, 2300, 5900, 4200, 1700,
  ].forEach((amount, i) => {
    d.spent = 0n;
    const date = new Date();
    date.setUTCDate(date.getUTCDate() - i - 1);
    const day = date.toISOString().slice(0, 10);
    const p = d.create("creator", {
      id: crypto.randomUUID(),
      invoice: `INV-2026-${String(80 - i).padStart(3, "0")}`,
      recipient: suppliers[i % 2].id,
      amount: String(amount),
      dueDate: day,
    });
    d.act(p.id, "manager1", "approve");
    if (p.required === 2) d.act(p.id, "manager2", "approve");
    d.act(p.id, "creator", "execute");
    d.audit
      .filter((a) => a.payment_id === p.id)
      .forEach(
        (a, j) =>
          (a.created_at = `${day}T${String(14 - j).padStart(2, "0")}:20:00.000Z`),
      );
  });
  d.spent = currentSpent;
  d.payments.sort((a, b) => b.dueDate.localeCompare(a.dueDate));
  d.audit.sort((a, b) => b.created_at.localeCompare(a.created_at));
  return d;
}
export function validateInput(
  b: Input,
  payments: Payment[],
  allowed: { id: string }[],
) {
  const errors: Partial<Record<keyof Input, string>> = {};
  if (!allowed.some((s) => s.id.toLowerCase() === b.recipient.toLowerCase()))
    errors.recipient = "Choose an approved supplier.";
  if (!/^[A-Z0-9][A-Z0-9 ._/-]{0,99}$/i.test(b.invoice.trim()))
    errors.invoice =
      "Use 1–100 letters, numbers, spaces, dots, slashes or hyphens.";
  if (
    payments.some(
      (p) =>
        p.recipient.toLowerCase() === b.recipient.toLowerCase() &&
        p.invoice === b.invoice.trim().toUpperCase(),
    )
  )
    errors.invoice = "This supplier invoice is already recorded.";
  try {
    const n = units(b.amount);
    if (n <= 0n || n > 25000000000n)
      errors.amount = "Enter an amount above 0 and no greater than 25,000.";
  } catch {
    errors.amount = "Use a decimal amount with up to six places.";
  }
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(b.dueDate) ||
    !Number.isFinite(Date.parse(b.dueDate)) ||
    b.dueDate < "2000-01-01" ||
    b.dueDate > "2100-12-31" ||
    new Date(b.dueDate + "T00:00:00Z").toISOString().slice(0, 10) !== b.dueDate
  )
    errors.dueDate = "Enter a valid date between 2000 and 2100.";
  return errors;
}
export function settlementSeries(
  payments: Payment[],
  audit: Audit[],
  days: number,
) {
  const seen = new Set<string>();
  const totals = new Map<string, number>();
  for (const event of audit) {
    if (event.action !== "EXECUTED" || seen.has(event.payment_id)) continue;
    const p = payments.find((p) => p.id === event.payment_id);
    if (!p) continue;
    seen.add(p.id);
    const day = event.created_at.slice(0, 10);
    totals.set(day, (totals.get(day) || 0) + Number(p.amount));
  }
  return Array.from({ length: days }, (_, i) => {
    const d = new Date(today() + "T00:00:00Z");
    d.setUTCDate(d.getUTCDate() - days + 1 + i);
    const date = d.toISOString().slice(0, 10);
    return { date, value: totals.get(date) || 0 };
  });
}
