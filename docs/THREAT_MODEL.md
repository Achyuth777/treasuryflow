# Threat model and limitations

## Assets and boundaries

Assets: treasury token balance, payment identity, recipient/amount integrity, approval authority, and accounting evidence. Boundaries: browser → authenticated Java API → PostgreSQL; API → private signing bridge → local EVM. The browser simulation is an isolated teaching aid and provides no security guarantees.

| Threat                        | Implemented control                                                                         | Remaining trust/limitation                                                                      |
| ----------------------------- | ------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Double-click or retry         | UUID idempotency, payload comparison, unique supplier/invoice index, on-chain executed flag | One company defines invoice identity; changed invoice text can describe the same external bill. |
| Unauthorized approval         | Server-side actor identity; Solidity approver allowlist; distinct approval map              | All demo users share a configurable password; signing bridge controls all local test keys.      |
| Creator self-approval         | Creator excluded from manager addresses                                                     | Production organizations need independently held keys and identity lifecycle management.        |
| Overspending race             | Contract checks and increments UTC-day aggregate atomically                                 | Policy fixed at deployment; no FX/currency aggregation.                                         |
| Backend crash after broadcast | Durable EXECUTING intent and event reconciliation; safe resubmission                        | A pending submission is not a failure. Local bridge has one process/nonce queue.                |
| Accounting tampering          | Reconcile recipient, amount and transaction hash; flag mismatch                             | DB administrator can edit ledger/audit. No claim of tamper-proof application logs.              |
| Approval interruption         | Immutable chain approvals; bridge retries inspect approvedBy before signing                 | Full scans and snapshots are used instead of scalable checkpoint ingestion.                     |
| Malicious token callback      | Checks-effects-interactions with immutable simple mock token                                | Not audited for arbitrary external token implementations.                                       |
| Lost database or chain        | Both use separate persistent Docker volumes                                                 | No backup/restore orchestration; preserve both together.                                        |
| Reorgs or false RPC results   | Receipt/event checks on trusted local chain                                                 | One confirmation; no production finality/reorg handling; RPC operator is trusted.               |
| Secret exposure               | Bridge/RPC/Postgres not host-published; web bound to 127.0.0.1                              | Demo mnemonic is deliberately public. Never send real funds to any generated address.           |
| Privacy leakage               | No invoice text, documents or personal data on chain                                        | Addresses, amounts, timing and approval activity remain visible.                                |

## Recovery semantics

The backend commits EXECUTING before submission. The chain applies the transfer and executed marker in the same EVM transaction. If the HTTP response disappears, no reversal is assumed. Reconciliation scans chain events, checks ledger terms, then stores the original confirmed transaction hash. Replaying execute cannot transfer twice.

The interruption switch injects the critical failure window by returning 503 before the ledger update. `RESTART_BACKEND=true npm run demo:api` additionally restarts the Java process; the ledger and chain volumes survive. This models response loss and process restart, not every distributed-failure timing.

Reconciliation is idempotent through unique `(transaction hash, log index)` keys. Events without ledger records are flagged, not silently invented as approved invoices. An EXECUTING record without confirmation is flagged for safe retry, not automatically marked failed. A confirmed payment with divergent amount/recipient/hash is left for investigation.

## Not production-ready

Before any production pilot: replace seeded accounts with OIDC/SSO and independently controlled approvals; use HSM/KMS or external wallets; protect service-to-service calls; add rate limiting, secure sessions/CSRF controls appropriate to the chosen auth, migrations, backups, observability, RPC redundancy, reorg-aware finality, persisted nonce/outbox processing, distributed locks and immutable audit retention. Have contracts professionally reviewed. Integrate genuine eligibility checks only with appropriate legal/privacy review. These are future work, not implemented capabilities.

One Java process serializes mutation and reconciliation methods. PostgreSQL uniqueness and the EVM prevent the principal duplicate-payment classes, but this does not claim full multi-instance ordering or exactly-once message delivery. The claim is **at-most-once token transfer per contract payment ID**, plus recoverable local accounting status.
