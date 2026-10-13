# Two-minute walkthrough script

Record your screen; this is a narration guide, not a pre-recorded video.

**0:00–0:15 — Problem.** “TreasuryFlow controls supplier payments from request to settlement. This demo uses synthetic suppliers and mock USD on a local Ethereum chain.” Show Payments and Policy & recipients.

**0:15–0:35 — Request and authority.** Create a 6,400 mUSD request due today. “The employee can request a payment, but cannot approve it.” Switch to manager1 and approve. Show 1/2 approvals and blocked execution.

**0:35–0:50 — Separation of duties.** Switch to manager2, approve, then return to creator. “Above 5,000, two distinct managers must approve. The smart contract independently enforces that rule.”

**0:50–1:15 — Critical failure window.** Select Execute with interrupted response. “The chain settled the payment, but the backend did not record its successful response. A timeout is not proof of failure.” Show EXECUTING.

**1:15–1:35 — Recover.** Run reconciliation. Show SETTLED and transaction hash. “The reconciler recovered the original event. It did not create a second transfer.” Retry execution and show unchanged hash.

**1:35–1:50 — Negative tests.** Show the terminal output from `npm run demo:api`: duplicate request, unauthorized approval, interrupted response and one settlement. Show the audit trail.

**1:50–2:00 — Honest trade-off.** “Shared settlement evidence is useful across organizations. A single company controlling everyone could use a conventional database. This prototype uses demo identities and is not a banking integration.”

For the hosted browser-only demo, use Demo lab → Run the complete scenario and explicitly say “simulation.” Do not present its `sim:` identifiers as real transactions. For real transaction hashes, use the local Docker system.
