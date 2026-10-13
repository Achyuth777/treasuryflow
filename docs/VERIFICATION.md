# Verification report

Executed on 30 September 2026 in the build workspace. This report records observed results, not claims about production readiness.

| Check | Result |
|---|---|
| Strict TypeScript + production React build | Passed |
| Solidity compiled with solc 0.8.30, Shanghai EVM, optimizer 200 runs | Passed |
| Contract/EVM suite | 8 passed |
| Browser simulation business-logic suite | 5 passed |
| Spring Boot API integration suite against an actual local EVM and H2 PostgreSQL-compatibility database | 7 passed, none skipped |
| Actual backend process SIGKILL and restart with persistent H2 file ledger | Passed: recovered original hash, one settlement event |
| Compose YAML structure and service healthcheck string | Parsed and inspected |
| Full Docker/PostgreSQL stack in this environment | Not run: Docker unavailable |
| Browser visual/interaction QA | Not run: permitted browser-testing capability unavailable |
| Browser WebMCP tool registration | Not exercised; feature-detected read-only registration included |
| Hosted preview | Not published: source-repository service returned internal errors |

**20 automated tests passed**, plus a separate actual process-kill/restart check.

## Contract coverage

Unauthorized creator and recipient; unauthorized/duplicate approvals; two distinct approvals above threshold; single approval exactly at threshold; duplicate request cannot replace payment terms; duplicate execution leaves recipient balance unchanged; future due date and rejection; aggregate daily limit and UTC-day rollover; insufficient token balance rolls back execution marker and daily spend.

## Java API coverage

Authentication and role denial; duplicate UUID returns one record; reused UUID with changed payload conflicts; new UUID with duplicate supplier/invoice conflicts; two approvals before execution; duplicate execution returns the original hash; interruption returns 503 and leaves EXECUTING; reconciliation recovers the real EVM event; tampered accounting amount is flagged and preserved; rejected/future requests cannot execute; non-JSON mutation requests return 415.

## Actual restart check

1. Start the Java API with a file-backed H2 database and the real local EVM bridge.
2. Create and approve a 100 mUSD payment.
3. Inject response interruption after confirmed on-chain settlement.
4. Verify the database reports EXECUTING.
5. Kill the Java process with SIGKILL, then start a new process against the same database.
6. Reconcile, verify SETTLED, retry execute, and count settlement events.

Observed: recovered = 1; settlement events = 1; retry returned the original transaction hash. This validates application restart recovery with H2 persistence. It is not a claim that a Docker or PostgreSQL restart was executed here. CI includes the Compose/PostgreSQL process-restart scenario for independent reproduction.

## Measured samples

- **Execute gas: 94,393** for the test's first 6,000 mUSD settlement after two approvals. Includes the mock token transfer; excludes request/approval transactions. Gas differs with storage state and contract/compiler configuration.
- **Reconciliation: 331 ms** for one small-fixture Java integration-test API call in this workspace (earlier run: 432 ms). This is a single local sample including HTTP handling, not a throughput benchmark or SLA.

Node 24.19.0 and Java 17.0.20 were used here. Ganache fell back to its JavaScript transport because its optional native transport did not match Node 24; the tests still used an actual EVM. The project supports Node 22.18+ and CI uses Node 22.

## Reproduce

Run `npm ci`, `npm run build`, `npm test`. Start a fresh chain with the documented bridge secret and run `LIVE_CHAIN=true mvn -f backend/pom.xml test`. For the complete stack, use Docker Compose and `RESTART_BACKEND=true npm run demo:api`. An ordinary Maven test run without LIVE_CHAIN intentionally skips the chain-dependent suite.

## Portable-demo packaging correction

Corrected the standalone stylesheet embedding after HTML formatting changed a link tag. Also fixed font-import removal to handle semicolons inside font URLs. The build now fails if CSS or JavaScript remain external, or if the embedded stylesheet does not start with the theme. Rebuilt the standalone HTML and project ZIP; verified embedded CSS/JavaScript with theme and responsive rules present. Browser visual QA is still not claimed.

## 1 October 2026 — Workspace redesign

See REDESIGN.md for the current UI verification record. The updated Node suite passed 22 tests, including actual contract checks and mounted React DOM interaction tests. Strict TypeScript and self-contained HTML builds passed. Browser visual QA remains unavailable; the UI is not claimed to be visually browser-verified. The earlier Java tests and process-restart results above describe the original backend verification, which was not rerun in this redesign.
