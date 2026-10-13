export type Actor = "creator" | "manager1" | "manager2" | "auditor";
export type Payment = {
  id: string;
  invoice: string;
  recipient: string;
  amount: string;
  dueDate: string;
  creator: string;
  status: string;
  txHash: string | null;
  approvals: string[];
  required: number;
};
export type Audit = {
  id: number;
  payment_id: string;
  actor: string;
  action: string;
  detail: string;
  created_at: string;
};
export type Report = {
  matched: number;
  recovered: number;
  flags: { id: string; issue: string }[];
  checkedAt: string;
};
export type Input = Pick<
  Payment,
  "id" | "invoice" | "recipient" | "amount" | "dueDate"
>;
export const actors: Actor[] = ["creator", "manager1", "manager2", "auditor"];
export const names: Record<Actor, string> = {
  creator: "Alex · Payment creator",
  manager1: "Morgan · Approver",
  manager2: "Jordan · Approver",
  auditor: "Sam · Auditor",
};
export const suppliers = [
  {
    id: "0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65",
    name: "Northstar Cloud",
    category: "Infrastructure",
  },
  {
    id: "0x9965507D1a55bcC2695C58ba16FB37d819B0A4dc",
    name: "Atlas Design Co.",
    category: "Professional services",
  },
];
export const today = () => new Date().toISOString().slice(0, 10);
export const units = (value: string) => {
  if (!/^\d+(\.\d{1,6})?$/.test(value))
    throw Error("Use a positive amount with up to six decimals.");
  const [whole, part = ""] = value.split(".");
  return BigInt(whole) * 1000000n + BigInt(part.padEnd(6, "0"));
};
const clone = <T>(v: T): T => structuredClone(v);
export class Demo {
  payments: Payment[] = [];
  chain = new Map<string, Payment>();
  audit: Audit[] = [];
  config = {
    suppliers,
    dailyLimit: "25000",
    threshold: "5000",
    chainId: 31337,
  };
  spent = 0n;
  log(id: string, actor: string, action: string, detail: string) {
    this.audit.unshift({
      id: this.audit.length + 1,
      payment_id: id,
      actor,
      action,
      detail,
      created_at: new Date().toISOString(),
    });
  }
  create(actor: Actor, b: Input) {
    if (actor !== "creator") {
      this.log(
        b.id,
        actor,
        "DENIED",
        "Only a payment creator may submit requests.",
      );
      throw Error("Creator role required.");
    }
    b = {
      ...b,
      invoice: b.invoice.trim().toUpperCase(),
      recipient: b.recipient.toLowerCase(),
    };
    if (!/^[A-Z0-9][A-Z0-9 ._/-]{0,99}$/.test(b.invoice))
      throw Error("Enter a valid invoice reference (up to 100 characters).");
    const value = units(b.amount);
    if (value <= 0n || value > 25000000000n)
      throw Error("Amount must be greater than zero and at most 25,000 mUSD.");
    if (!suppliers.some((s) => s.id.toLowerCase() === b.recipient))
      throw Error("Recipient is not approved.");
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(b.dueDate) ||
      Number.isNaN(Date.parse(b.dueDate)) ||
      b.dueDate < "2000-01-01" ||
      b.dueDate > "2100-12-31"
    )
      throw Error("Enter a valid due date.");
    const old = this.payments.find((p) => p.id === b.id);
    if (old) {
      if (
        old.invoice !== b.invoice ||
        old.recipient !== b.recipient ||
        units(old.amount) !== value ||
        old.dueDate !== b.dueDate
      )
        throw Error("Idempotency key conflicts with the original request.");
      this.log(
        old.id,
        actor,
        "DUPLICATE_BLOCKED",
        "Original payment returned. No second request.",
      );
      return clone(old);
    }
    if (
      this.payments.some(
        (p) => p.recipient === b.recipient && p.invoice === b.invoice,
      )
    ) {
      this.log(
        b.id,
        actor,
        "DUPLICATE_BLOCKED",
        "Supplier invoice already exists.",
      );
      throw Error("This supplier invoice already exists.");
    }
    const p: Payment = {
      ...b,
      creator: actor,
      status: "PENDING",
      txHash: null,
      approvals: [],
      required: value > 5000000000n ? 2 : 1,
    };
    this.payments.unshift(p);
    this.chain.set(p.id, clone(p));
    this.log(p.id, actor, "REQUESTED", `${b.invoice} · ${b.amount} mUSD`);
    return clone(p);
  }
  act(id: string, actor: Actor, kind: string, interrupt = false) {
    const p = this.payments.find((p) => p.id === id);
    const c = this.chain.get(id);
    if (!p || !c) throw Error("Payment not found.");
    if (
      ((kind === "approve" || kind === "reject") &&
        !actor.startsWith("manager")) ||
      (kind === "execute" && actor === "auditor")
    ) {
      this.log(
        id,
        actor,
        "DENIED",
        "The selected role cannot perform this action.",
      );
      throw Error("Unauthorized: approver or executor role required.");
    }
    if (kind === "execute" && c.status === "SETTLED") {
      this.log(
        id,
        actor,
        "DUPLICATE_BLOCKED",
        "Existing settlement returned. No tokens transferred.",
      );
      return clone(p);
    }
    if (["SETTLED", "REJECTED"].includes(c.status))
      throw Error("Payment is closed.");
    if (kind === "approve") {
      if (c.approvals.includes(actor))
        throw Error("This approver has already approved.");
      c.approvals.push(actor);
      c.status = c.approvals.length >= c.required ? "APPROVED" : "PENDING";
      Object.assign(p, clone(c));
      this.log(
        id,
        actor,
        "APPROVED",
        `${c.approvals.length} of ${c.required} required approvals`,
      );
    } else if (kind === "reject") {
      c.status = "REJECTED";
      p.status = "REJECTED";
      this.log(id, actor, "REJECTED", "Payment closed without settlement.");
    } else if (kind === "execute") {
      if (c.approvals.length < c.required)
        throw Error("Additional approval required.");
      if (c.dueDate > today()) throw Error("Payment is not due yet.");
      if (this.spent + units(c.amount) > 25000000000n)
        throw Error("Daily limit of 25,000 mUSD exceeded.");
      p.status = "EXECUTING";
      this.log(
        id,
        actor,
        "EXECUTION_REQUESTED",
        "Durable intent saved before settlement.",
      );
      c.status = "SETTLED";
      c.txHash = "sim:" + crypto.randomUUID();
      this.spent += units(c.amount);
      this.log(id, actor, "EXECUTED", "Simulated chain settlement confirmed.");
      if (interrupt) {
        this.log(
          id,
          "system",
          "INTERRUPTED",
          "Ledger update skipped after simulated settlement.",
        );
        throw Error(
          "Response interrupted after settlement. Run reconciliation to recover.",
        );
      }
      Object.assign(p, clone(c));
    } else throw Error("Unknown action.");
    return clone(p);
  }
  reconcile(): Report {
    const report: Report = {
      matched: 0,
      recovered: 0,
      flags: [],
      checkedAt: new Date().toISOString(),
    };
    for (const p of this.payments) {
      const c = this.chain.get(p.id);
      if (c?.status === "SETTLED") {
        if (
          units(c.amount) !== units(p.amount) ||
          c.recipient !== p.recipient
        ) {
          report.flags.push({
            id: p.id,
            issue: "AMOUNT_OR_RECIPIENT_MISMATCH",
          });
          continue;
        }
        if (p.txHash && p.txHash !== c.txHash) {
          report.flags.push({ id: p.id, issue: "TRANSACTION_HASH_MISMATCH" });
          continue;
        }
        if (p.status !== "SETTLED") {
          Object.assign(p, clone(c));
          report.recovered++;
          this.log(
            p.id,
            "reconciler",
            "RECOVERED",
            "Confirmed settlement restored; no new payment.",
          );
        }
        report.matched++;
      } else if (p.status === "SETTLED")
        report.flags.push({ id: p.id, issue: "MISSING_CHAIN_SETTLEMENT" });
    }
    for (const c of this.chain.values())
      if (c.status === "SETTLED" && !this.payments.some((p) => p.id === c.id))
        report.flags.push({ id: c.id, issue: "UNRECORDED_CHAIN_PAYMENT" });
    return report;
  }
  seed() {
    for (const [invoice, amount, supplier, approval] of [
      ["INV-2026-084", "12800", 0, 1],
      ["INV-2026-083", "1860", 1, 0],
      ["INV-2026-082", "4600", 0, 1],
      ["INV-2026-081", "3200", 1, 2],
    ] as const) {
      const p = this.create("creator", {
        id: crypto.randomUUID(),
        invoice,
        amount,
        recipient: suppliers[supplier].id,
        dueDate: today(),
      });
      if (approval) this.act(p.id, "manager1", "approve");
      if (approval === 2) this.act(p.id, "creator", "execute");
    }
    return this;
  }
  scenario() {
    const b: Input = {
      id: crypto.randomUUID(),
      invoice: "DEMO-" + Date.now().toString().slice(-9),
      recipient: suppliers[0].id,
      amount: "100",
      dueDate: today(),
    };
    this.create("creator", b);
    this.create("creator", b);
    let denied = false;
    try {
      this.act(b.id, "auditor", "approve");
    } catch {
      denied = true;
    }
    this.act(b.id, "manager1", "approve");
    try {
      this.act(b.id, "creator", "execute", true);
    } catch {}
    const report = this.reconcile();
    this.act(b.id, "creator", "execute");
    return {
      id: b.id,
      duplicate: this.payments.filter((p) => p.id === b.id).length === 1,
      denied,
      recovered: report.recovered === 1,
      oneSettlement:
        this.audit.filter(
          (a) => a.payment_id === b.id && a.action === "EXECUTED",
        ).length === 1,
    };
  }
}
