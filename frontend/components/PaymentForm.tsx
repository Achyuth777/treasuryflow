import React, { useState } from "react";
import { Overlay, Icon } from "./ui";
import { money, validateInput } from "../workspace";
import type { Input, Payment } from "../model";
export function PaymentForm({
  draft,
  setDraft,
  suppliers,
  payments,
  busy,
  error,
  onClose,
  onSubmit,
}: {
  draft: Input;
  setDraft: (b: Input) => void;
  suppliers: { id: string; name: string; category: string }[];
  payments: Payment[];
  busy: boolean;
  error: string;
  onClose: () => void;
  onSubmit: () => Promise<void>;
}) {
  const [step, setStep] = useState(1),
    [touched, setTouched] = useState<Record<string, boolean>>({});
  const errors = validateInput(draft, payments, suppliers);
  const field = (k: keyof Input, value: string) =>
    setDraft({ ...draft, [k]: value });
  const supplier = suppliers.find((s) => s.id === draft.recipient);
  const dual = Number(draft.amount) > 5000;
  const validate = () => {
    setTouched({ recipient: true, invoice: true, amount: true, dueDate: true });
    if (Object.keys(errors).length) return;
    setStep(2);
  };
  return (
    <Overlay title="New payment request" onClose={onClose} wide>
      <div className="form-title">
        <h2>
          {step === 1
            ? "Let’s prepare your payment."
            : "Review before submitting."}
        </h2>
        <p>
          {step === 1
            ? "Start with an approved supplier and the invoice details."
            : "Your request will enter the approval queue. No funds move yet."}
        </p>
      </div>
      <div className="form-progress">
        <span className="active">
          <b>{step > 1 ? <Icon name="check" size={14} /> : 1}</b>Payment details
        </span>
        <i />
        <span className={step === 2 ? "active" : ""}>
          <b>2</b>Review & submit
        </span>
      </div>
      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          if (step === 1) validate();
          else if (Object.keys(errors).length) {
            setStep(1);
            validate();
          } else void onSubmit();
        }}
      >
        {step === 1 ? (
          <>
            <label className="field">
              Supplier
              <select
                value={draft.recipient}
                disabled={busy}
                onChange={(e) => field("recipient", e.target.value)}
                onBlur={() => setTouched({ ...touched, recipient: true })}
                aria-invalid={!!(touched.recipient && errors.recipient)}
              >
                <option value="">Select an approved supplier</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
              {touched.recipient && errors.recipient ? (
                <small className="field-error">{errors.recipient}</small>
              ) : (
                <small>Only eligible recipients can receive a payment.</small>
              )}
            </label>
            <label className="field">
              Invoice reference
              <input
                autoComplete="off"
                value={draft.invoice}
                placeholder="e.g. INV-2026-085"
                disabled={busy}
                onChange={(e) => field("invoice", e.target.value)}
                onBlur={() => setTouched({ ...touched, invoice: true })}
                aria-invalid={!!(touched.invoice && errors.invoice)}
                maxLength={100}
              />
              {touched.invoice && errors.invoice && (
                <small className="field-error">{errors.invoice}</small>
              )}
            </label>
            <div className="form-row">
              <label className="field">
                Amount · mUSD
                <input
                  inputMode="decimal"
                  placeholder="0.00"
                  value={draft.amount}
                  disabled={busy}
                  onChange={(e) => field("amount", e.target.value)}
                  onBlur={() => setTouched({ ...touched, amount: true })}
                  aria-invalid={!!(touched.amount && errors.amount)}
                />
                {touched.amount && errors.amount && (
                  <small className="field-error">{errors.amount}</small>
                )}
              </label>
              <label className="field">
                Due date · UTC
                <input
                  type="date"
                  min="2000-01-01"
                  max="2100-12-31"
                  value={draft.dueDate}
                  disabled={busy}
                  onChange={(e) => field("dueDate", e.target.value)}
                  onBlur={() => setTouched({ ...touched, dueDate: true })}
                  aria-invalid={!!(touched.dueDate && errors.dueDate)}
                />
                {touched.dueDate && errors.dueDate && (
                  <small className="field-error">{errors.dueDate}</small>
                )}
              </label>
            </div>
            <div className="policy-note">
              <Icon name="shield" />
              <div>
                <b>
                  {dual ? "Two approvals required" : "One approval required"}
                </b>
                <p>
                  {dual
                    ? "Amounts above 5,000 mUSD need two distinct managers."
                    : "A manager must approve this request before settlement."}
                </p>
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="review-card">
              <span className="supplier-avatar">{supplier?.name[0]}</span>
              <span>
                {supplier?.name}
                <small>{draft.invoice.trim().toUpperCase()}</small>
              </span>
              <strong>
                {money(draft.amount)}
                <small>mUSD</small>
              </strong>
            </div>
            <dl className="detail-list">
              <dt>Due date</dt>
              <dd>{draft.dueDate} · UTC</dd>
              <dt>Approvals required</dt>
              <dd>
                {dual ? 2 : 1} distinct {dual ? "managers" : "manager"}
              </dd>
              <dt>Daily treasury limit</dt>
              <dd>25,000.00 mUSD</dd>
              <dt>Recipient</dt>
              <dd className="mono wrap">{draft.recipient}</dd>
            </dl>
            <div className="policy-note">
              <Icon name="check" />
              <div>
                <b>Ready for the approval queue</b>
                <p>
                  Recipient and invoice checks passed. Execution remains subject
                  to on-chain controls.
                </p>
              </div>
            </div>
          </>
        )}
        {error && (
          <div className="inline-error" role="alert">
            <Icon name="alert" />
            {error}
          </div>
        )}
        <div className="form-footer">
          <button
            type="button"
            className="button"
            disabled={busy}
            onClick={() => (step === 2 ? setStep(1) : onClose())}
          >
            {step === 2 ? "Back to details" : "Cancel"}
          </button>
          <button className="button primary" disabled={busy}>
            {busy ? (
              <>
                <span className="spinner" />
                Submitting request…
              </>
            ) : step === 1 ? (
              "Review payment"
            ) : (
              "Submit payment request"
            )}
          </button>
        </div>
      </form>
    </Overlay>
  );
}
