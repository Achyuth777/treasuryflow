# TreasuryFlow: navy and mint workspace

Updated 12 October 2026 using the existing application source.

## Interface

- Navy sidebar and payment header, mint primary header action, light operational surfaces, lighter typography and subdued semantic badges.
- Payments is the default. The three main destinations are Payments, Reconciliation and Activity.
- Existing Overview (including chart ranges), Policy & recipients and Demo lab remain available under the collapsed Workspace tools disclosure.
- Payment summaries apply Awaiting approval, Ready to pay and Needs attention filters. Needs attention selects EXECUTING/FAILED records; reconciliation exceptions remain on Reconciliation.
- Simplified supplier/invoice, amount, due date and status table. Search, sorting, pagination and JSON export remain functional.
- Mobile CSS converts the table into readable two-column payment rows and retains amount/date sorting. Navigation opens in a side panel.
- Detailed transaction references are expandable. Approval progress, settlement state, activity history and role checks remain connected to existing state and API responses.
- Shared theme lives in `frontend/theme.css`. No new runtime dependencies were introduced.
- Modal dismissal reads the current handler so a pending form cannot close through a stale Escape handler. Native disclosure summaries are included in keyboard focus handling.
- Corrected the dependency lockfile: Ganache's macOS-only fsevents entry is optional, allowing reproducible Linux installs.

## Scope and verification

The browser site remains a clearly labelled, session-only simulation: refresh resets its records. It does not connect to a deployed Java backend. The full local application still supports its existing Java/PostgreSQL/Solidity integration through `?mode=api`. No backend, contract, API route, identity or payment-policy code was changed in this update.

The existing 22-test Node suite passed, followed by eight passing UI tests including two new cases for queue-priority filters and navigation/secondary-feature access. A final combined run and production build are recorded in the accompanying work report. Tests use an actual local EVM for contracts and jsdom for mounted UI interactions.

Browser rendering at desktop/mobile widths could not be inspected: the required managed preview browser capability is unavailable. The CSS implements those layouts, but no visual browser pass is claimed. Java integration tests and Docker/PostgreSQL restart checks were not rerun for this frontend change; historical results are in VERIFICATION.md.

## Try it

1. Open Payments. Click Awaiting approval, then a supplier to inspect its invoice.
2. Select Morgan or Jordan in Demo role to approve a request. Requests above 5,000 mUSD still require two distinct approvers.
3. Create a payment as Alex through the existing details/review flow.
4. Open Workspace tools → Demo lab to test duplicate prevention, denied approval and interrupted-response recovery.
5. Run Reconciliation to compare the simulated records, then review the Activity history.

Use `npm ci`, `npm run build`, `npm test`. The build writes the hosted output to `dist/` and a self-contained offline demo to `release/TreasuryFlow-demo.html`.
