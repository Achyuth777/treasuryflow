# API contract

Base URL in Compose: `http://localhost:8088/api`. Every endpoint requires HTTP Basic authentication. Local accounts: creator, manager1, manager2, auditor. Default demo password: treasury-demo-only. Do not use Basic over plaintext outside loopback development; no public deployment is supported by this configuration.

| Method | Path                                    | Permission                   | Response                                               |
| ------ | --------------------------------------- | ---------------------------- | ------------------------------------------------------ |
| GET    | `/config`                               | Any authenticated role       | Chain ID, contract addresses, suppliers, policy, actor |
| GET    | `/payments`                             | Any role                     | Payment list, approval actors and required count       |
| POST   | `/payments`                             | Creator                      | Persist/return one payment request                     |
| POST   | `/payments/{id}/approve`                | Approver                     | Record on-chain approval; return ledger record         |
| POST   | `/payments/{id}/reject`                 | Approver                     | Permanently reject on chain                            |
| POST   | `/payments/{id}/execute`                | Creator or approver          | Execute once or return original settlement             |
| POST   | `/payments/{id}/execute?interrupt=true` | Executor; failpoints enabled | 503 after settlement, before ledger update             |
| POST   | `/reconcile`                            | Any role                     | Matched/recovered counts, exceptions, checkedAt        |
| GET    | `/audit`                                | Any role                     | Latest 500 audit records, newest first                 |

Amounts must be strings in decimal mUSD with at most six fractional digits. Supply a new random UUID once per business request, **reuse it on transport retries**, and do not reuse it for a changed payload. A supplier/invoice pair remains unique even if the UUID differs. Dates use ISO 8601 `YYYY-MM-DD`, interpreted at UTC midnight. Invoice references are trimmed, uppercased, and accept letters, digits, spaces, periods, underscores, slashes and hyphens.

Example body for POST `/payments` (replace recipient with GET `/config` output):

```json
{
  "id": "d8ef9c25-7520-4d88-8995-ef36b14c8012",
  "recipient": "0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65",
  "invoice": "INV-2026-085",
  "amount": "6400.00",
  "dueDate": "2026-09-30"
}
```

The POST response includes `id`, `invoice`, `recipient`, `amount`, `dueDate`, `creator`, `status`, and nullable `txHash`. GET `/payments` adds `approvals` and `required`. Chain registration is lazy: a locally persisted request is registered immutably when first approved, rejected or executed. The database is not treated as proof of settlement.

Statuses: PENDING → APPROVED → EXECUTING → SETTLED; PENDING/APPROVED may become REJECTED. An uncertain execution stays EXECUTING until chain inspection confirms settlement or a retry resolves it.

Error JSON: `{ "error": "human-readable reason" }` (unauthenticated Spring Security responses may have an empty body).

- 400: malformed UUID/date/amount, unknown action, disabled failpoint.
- 401: missing or incorrect credentials.
- 403: authenticated actor lacks the required role.
- 404: unknown payment.
- 409: duplicate invoice, conflicting idempotency payload, invalid business state or rule.
- 503: uncertain chain operation or injected interruption. Never assume non-settlement. Read/reconcile before retry.

Reconciliation flags: `AMOUNT_OR_RECIPIENT_MISMATCH`, `TRANSACTION_HASH_MISMATCH`, `MISSING_CHAIN_SETTLEMENT`, `UNRECORDED_CHAIN_PAYMENT`, `AWAITING_CONFIRMATIONS`, `UNCONFIRMED_INTENT_RETRY_SAFE`. Mismatched accounting data are not automatically overwritten.

The internal bridge uses `X-Bridge-Secret`, accepts actor names only from the trusted API, and is not a public API. Its nonce queue is process-local. Never expose it or the unlocked local RPC.
