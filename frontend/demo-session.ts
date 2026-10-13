import { Demo, today, units, type Payment, type Audit } from './model.ts';
import { makeDemo } from './workspace.ts';
export const DEMO_STORAGE_KEY = 'treasuryflow.demo.v1';
type Store = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
const statuses = ['PENDING', 'APPROVED', 'EXECUTING', 'SETTLED', 'REJECTED'];
function payment(value: unknown): value is Payment {
  if (!value || typeof value !== 'object') return false;
  const p = value as Payment;
  return typeof p.id === 'string' && typeof p.invoice === 'string' && typeof p.recipient === 'string' && typeof p.amount === 'string' && /^\d+(\.\d{1,6})?$/.test(p.amount) && units(p.amount) > 0n && typeof p.dueDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(p.dueDate) && typeof p.creator === 'string' && statuses.includes(p.status) && (p.txHash === null || typeof p.txHash === 'string') && Array.isArray(p.approvals) && p.approvals.every(a => ['manager1','manager2'].includes(a)) && (p.required === 1 || p.required === 2);
}
function event(value: unknown): value is Audit {
  if (!value || typeof value !== 'object') return false;
  const a = value as Audit;
  return Number.isInteger(a.id) && ['payment_id', 'actor', 'action', 'detail', 'created_at'].every(k => typeof a[k as keyof Audit] === 'string');
}
function browserStorage(): Store | null {
  try { return localStorage; } catch { return null; }
}
export function createDemoSession(storage: Store | null = browserStorage()) {
  let state = makeDemo();
  let day = today();
  let persistent = !!storage;
  let recovered = false;
  try {
    const raw = storage?.getItem(DEMO_STORAGE_KEY);
    if (raw) {
      const saved = JSON.parse(raw);
      if (saved.version !== 1 || !Array.isArray(saved.payments) || !saved.payments.every(payment) || !Array.isArray(saved.chain) || !saved.chain.every((pair: unknown) => Array.isArray(pair) && typeof pair[0] === 'string' && payment(pair[1]) && pair[0] === pair[1].id) || !Array.isArray(saved.audit) || !saved.audit.every(event) || typeof saved.spent !== 'string' || !/^\d+$/.test(saved.spent) || typeof saved.day !== 'string') throw new Error('Invalid saved demo');
      state = new Demo();
      state.payments = saved.payments;
      state.chain = new Map(saved.chain);
      state.audit = saved.audit;
      state.spent = saved.day === today() ? BigInt(saved.spent) : 0n;
    }
  } catch { recovered = true; }
  return {
    state,
    get persistent() { return persistent; },
    get recovered() { return recovered; },
    rollover() { if (day !== today()) { state.spent = 0n; day = today(); } },
    save() {
      this.rollover();
      try {
        if (!storage) { persistent = false; return false; }
        storage.setItem(DEMO_STORAGE_KEY, JSON.stringify({version: 1, payments: state.payments, chain: [...state.chain], audit: state.audit, spent: String(state.spent), day}));
        persistent = true;
        return true;
      } catch { persistent = false; return false; }
    },
    reset() {
      const fresh = makeDemo();
      state.payments = fresh.payments;
      state.chain = fresh.chain;
      state.audit = fresh.audit;
      state.spent = fresh.spent;
      day = today();
      recovered = false;
      this.save();
    },
  };
}
