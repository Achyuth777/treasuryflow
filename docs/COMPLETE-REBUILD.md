# Complete website rebuild

This release replaces the dashboard-only entry point with a complete TreasuryFlow public website and a new horizontal operations workspace. Tranzport informed the editorial structure, harbor atmosphere, capability navigation, coverage and tracking patterns. TreasuryFlow uses its own copy, identity and imagery; the interactions operate on treasury payments.

## Working features

- Four-slide hero capability navigation, section links and accessible full-screen menu.
- Capability accordion, approval threshold explorer and keyboard-operated journey tabs.
- Supplier/team directory, scenario details, FAQs and direct workspace entry.
- Payment tracking by invoice substring or exact payment ID/transaction hash, status steps and actual audit history, linked to payment details.
- Original validated payment creation, role-based approvals/rejection, execution, recovery, reconciliation, audit export, search, sorting and filters.
- Browser persistence of demo payments, confirmations, audit and daily spend, UTC rollover and confirmed reset. Invalid or unavailable storage falls back safely. Local storage is demo persistence, not authentication or a trusted ledger; multiple tabs are not synchronized.
- Responsive layouts, reduced-motion support, focus-managed overlays and keyboard navigation.

## Delivery and verification

Production compilation includes strict TypeScript checking. The automated suite covers real local EVM rules, demo business rules, persistence, mounted React interactions and the new public-site flows. The managed environment does not provide the supported visual browser QA path, so rendered desktop/mobile visual inspection was not performed. The full Docker/API integration suite was not rerun for this frontend release.

The hosted site is a labelled simulation with synthetic suppliers and accounts. Real local EVM settlement and PostgreSQL persistence require the included Docker project. No live bank, real-money settlement, production authentication or external logistics service is connected.

## Hero asset

`frontend/assets/harbor-hero.png` is an original image generated with the built-in image generation tool, not an asset copied from Tranzport. The production and portable builds embed it. Creative brief: photorealistic blue-hour container harbor and cargo vessel, cranes and port lights on the right, broad dark navy water and sky on the left for editorial typography; no logos or text.
