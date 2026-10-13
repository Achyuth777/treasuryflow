# Financial workspace redesign

Completed 1 October 2026.

## Working interface

- Graphite sidebar, light workspace, indigo actions, semantic statuses, shared design tokens and reusable components.
- Overview with treasury balance, awaiting-approval and ready-to-settle totals, exceptions from the latest reconciliation, daily spending, settlement chart and activity panel.
- Search, status filters, sortable columns, pagination and JSON export.
- Payment detail drawer with invoice terms, approvals, settlement evidence, audit timeline and role-aware actions.
- Guided form with inline validation, a review step, a stable request ID for retries, and preserved inputs after errors.
- Pending feedback for approval and execution; no optimistic transition to settled. An API settlement is displayed from the backend record and transaction hash.
- 7/14/30-day chart controls; hover, focus and tap details derived from recorded settlement events. Missing days display zero, not invented payments. Only events available in the audit response can be charted (latest 500 in API mode).
- Five-second polling while the page is visible in connected API mode, with stale-data warnings and retry controls. Polling pauses during actions. Demo mode refreshes its isolated in-memory model.
- Loading skeletons, empty/search states, error notifications, permission explanations, role switching, mobile navigation, visible keyboard focus, Escape dismissal, dialog focus containment and reduced-motion styles.
- Matching reconciliation, audit, policy/recipient and recovery-demo screens.

## Data and integration boundaries

The downloadable HTML runs entirely in the browser. All its balances, history, identities and settlement are synthetic and clearly labelled; refreshing resets the data. Historical fixtures give the activity chart meaningful demo values.

The Docker/local API uses the existing Java, PostgreSQL and Solidity workflow. The only integration addition is live balance and UTC-day spend fields from the chain bridge's authenticated config endpoint. Java passes these fields through its existing config route. Requests, approvals, execution, rejection, and reconciliation retain their existing endpoints and server-side checks. Seeded passwords/test-chain custody remain prototype controls.

The frontend does not silently substitute demo records if the API fails. Failed submission keeps the draft and request ID; failed execution remains uncertain until a backend read/reconciliation establishes its status. The browser demo's brief pending delay is simulated; API mode waits for the actual response.

## Verification

- Strict TypeScript and production/portable build passed.
- 22 tests passed in the updated Node suite: 9 actual EVM tests (including live overview metrics), 5 simulation business-rule tests, 6 mounted React DOM interaction tests, and 2 validation/chart tests.
- Interaction tests exercised search, sorting, range selection, drawer open/Escape close, inline form errors, review/submission, manager approval, auditor restrictions, recovery scenario, mismatches, and retaining input after an API error.
- The DOM interaction suite uses jsdom. It does not render a real browser layout or establish visual correctness.
- Desktop/mobile CSS layouts and reduced-motion rules are implemented. Actual desktop/mobile browser visual QA and native WebMCP registration could not be run because the required browser-testing capability is unavailable in this session.
- The previous Java integration and actual process restart results remain documented in VERIFICATION.md; that seven-test suite was not rerun for this frontend-focused change. Docker/PostgreSQL execution remains unverified in this environment.

Run `npm ci`, `npm run build`, and `npm test` to reproduce the updated checks. The portable HTML embeds its stylesheet and script; the build rejects missing externalized assets.
