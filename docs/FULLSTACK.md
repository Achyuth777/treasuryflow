# TreasuryFlow company workspace

## What is live

The public website stays available to everyone. `/app` uses Sites-owned Sign in with ChatGPT. The API requires platform-injected identity and checks company membership and role on every protected request. No demo role selector or local-storage identity is used for live data.

The hosted service uses the supported Vinext/Cloudflare Worker runtime with D1 (`DB`) and R2 (`BUCKET`). The existing Java/PostgreSQL/Ganache project remains a separate local educational system; its static-host limitations are not worked around with an exposed laptop tunnel. Live and demo data do not synchronize.

## First complete workflow

1. Sign in at `/app`, create a company, choose its currency and approval threshold.
2. Add a supplier and create an invitation for a manager using their ChatGPT email. Copy and share the invitation link yourself. No email is sent by TreasuryFlow.
3. Submit an invoice, then attach its PDF before the first approval.
4. The invited manager signs in and accepts the invitation. They approve or reject the invoice. Above the threshold, two different approvers are required. Creators cannot review their own invoices.
5. Rejected invoices can be revised by their creator or the owner. Old approvals are cleared; before/after changes remain in the audit log.
6. After approval, an owner or accountant records a payment already made through a bank, including a transaction reference, paid date and note. This does not initiate a transfer.
7. Attach a receipt, then enter a matching bank-statement reference and amount with evidence notes. A match records manual reconciliation; a mismatch makes no changes.
8. Review in-app reminders, supplier spending, CSV invoice exports and JSON audit/workspace exports.

## Roles

| Role | Capabilities |
| --- | --- |
| Owner | Company administration, supplier management, invitations, revoke access, submit invoices, review others' invoices, record payments and reconcile |
| Manager | Read company records, approve/reject others' invoices |
| Creator | Submit invoices, attach own invoice documents, revise own rejected invoices |
| Accountant | Supplier management, invoice submission, receipts, manual payment records and reconciliation |
| Auditor | Read and export company records |

All members can see company invoice data and download company attachments. Owner removal is blocked. Removing a member withdraws their approvals from unpaid invoices; affected approved invoices return to awaiting approval. Paid invoice approval records remain historical. Currency and threshold are fixed at company creation in this release.

## Data and consistency

Amounts are positive integers in minor currency units. Supported currencies are INR, USD, EUR and GBP. Duplicate supplier/invoice combinations and duplicate bank references are rejected per company. Conditional writes use invoice versions to prevent competing decisions from silently overwriting one another. Database batches atomically write mutations and their audit events. Authorization decisions do not depend on browser state.

Invitation secrets are stored only as SHA-256 hashes. Invitations are bound to an authenticated email, single-use, valid for seven days and revocable by an owner. App responses are not cached. Mutations require same-origin requests and an application header. PDF downloads are access checked and served as attachments with nosniff. PDFs are limited to 5 MB each and 10 per invoice, with signature checks. They are not malware-scanned. Invoice files lock after the first approval. Receipt evidence may be added later. Failed database attachment writes attempt object cleanup.

The workspace loads the newest 2,000 invoices and 500 audit events. A visible notice appears if totals/exports cover a truncated invoice set. Records remain stored. This bounded pilot interface does not yet provide historical pagination, automated retention, multi-region recovery, or accounting-system integration.

## Development

From the repository root, install root dependencies with `npm ci`. The hosted starter additionally needs its own dependencies. Its managed setup uses the Sites `install-dependencies.mjs` helper; portable users can run `npm ci --prefix hosted` from the repository root. Preserve the hosted lockfiles and helper configuration.

- `npm test`: local EVM, business model, React DOM, and hosted API/SQL tests.
- `npm run build:demo`: original static assets and portable demo, suitable for the existing Docker frontend.
- `npm run build`: type-check frontend, build its assets, then build the hosted Worker and copy deployment output to root `dist/`.
- `cd hosted && npm run db:generate`: append schema migrations when the schema changes. Do not modify already deployed migrations.
- `cd hosted && npm run dev`: supported local full-stack development after building frontend assets. Production identity is injected by Sites; development mock auth is only provided by the starter in its portable loopback mode.

For schema changes use `hosted/db/schema.ts`. Migrations are copied by the preserved Sites build plugin. Source hosting manifests at root and `hosted/.openai/hosting.json` must retain the same Site ID and binding names. Sites provisions resources and applies migrations during publication.

## Verification and remaining integrations

Hosted API tests execute the real SQL migrations against SQLite through a D1-compatible test adapter and exercise the real route handler. Tests cover identity, company isolation, CSRF checks, invitations, concurrent/stale approvals, duplicate records, exact monetary arithmetic, protected PDFs, manual reconciliation, team removal and invoice revisions. Mounted React tests exercise company/supplier/invoice creation against that handler, manager approval and auditor restrictions. The production Worker build and TypeScript checks are also run.

Rendered browser QA and the live third-party sign-in redirect have not been exercised in this managed environment. Local tests do not claim live D1/R2 end-to-end coverage. The separate full Docker/Java integration suite was not rerun for this release.

External email/SMS/push, payment-provider sandboxes, live bank payouts and automatic bank feeds are not connected. They require a selected provider and the owner's configured credentials/onboarding. No payment or banking credentials are embedded. Notifications are in-app and refresh while the page is open. PDF signature checks do not replace malware scanning. Workspace JSON export is a manual export, not a tested disaster-recovery backup. Before handling sensitive production financial data, add operational backups with restore tests, provider/identity end-to-end verification, monitoring/alerting, security review and appropriate operational controls. This release is a functional hosted pilot, not a regulated payment service.
