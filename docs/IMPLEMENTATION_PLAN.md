# MeraCEO Implementation Plan

Updated 2026-11-11. This plan aligns implementation with **MeraCEO Master PRD V3.0** and the owner-approved technical decisions in [DECISIONS.md](DECISIONS.md).

## 1. Source of truth

- PRD V3's original MVP commitments define Release A. Its later screen specifications describe the full product and do not automatically add features to the MVP.
- The V1.0 and V2.0 proposals inside the consolidated PRD are product references. Where the PRD leaves technology open, use the owner's current decision in [DECISIONS.md](DECISIONS.md): Expo/React Native, Fastify + TypeScript API, MongoDB, Google sign-in, and Backblaze B2 for files.
- The old v2 plan in Downloads is historical. Its Supabase, PostgreSQL, RLS, SQL RPC and Edge Function instructions are superseded.
- [CLICKUP_TASKS.md](CLICKUP_TASKS.md) is a dated task snapshot, not a live task source. Refresh it before using it for current status.

## 2. Release A: MVP marketplace loop

### Goal

Enable a real business owner to publish a need, find a relevant eligible professional, send a consultation request, and see the professional's response. Both roles must see the same request status.

### Scope

1. **Identity and roles:** approved sign-in, session handling, role selection, and server-side role/ownership checks.
2. **Profiles and onboarding:** owner and professional profiles with resumable entry, validation, review/edit, and consent. Keep the four logical onboarding stages in the PRD visible in the screen flow; reconcile the existing 8-step owner and 7-step professional forms before expanding them.
3. **Needs and opportunities:** owners create, retrieve, edit, and close only their own open needs; eligible professionals can open an authorized P8 detail page for matching open needs. Return only permitted business identity/context, need details, timeline, budget, mode, and match signals; reject closed, inaccessible, or non-matching needs. P9 expression of interest remains a separate approval-dependent flow.
4. **Discovery:** basic filters and explainable, rules-based matching. Do not claim a match is guaranteed or fabricate profile metrics.
5. **Consultation requests:** request, accept, decline, cancel, and track status. Treat a professional's expression of interest as a separate flow from a booked consultation; include that flow only if its scope is approved.
6. **Dashboards and core settings:** real counts, clear empty/error/retry states, support and privacy controls needed for the pilot.
7. **Trust operations:** profile review/moderation and a visible grievance contact before users can sign up.

### MVP exit gate

- Owner can complete onboarding and publish a need.
- An eligible professional can discover that need.
- Owner can submit one request; the professional can accept or decline it.
- Both roles see a consistent state after refresh or navigation.
- A controlled pilot can measure signup completion, profile readiness, first meaningful action, and accepted requests.

Payments are not required to pass this gate.

## 3. Release A work order

1. **Close product and compliance decisions:** answer the owner questions in W1-01; confirm D-U-N-S and store-account path; engage legal review for privacy, consent, verification, and cross-border data handling. Do not invent these decisions in code.
2. **Set up the chosen architecture:** choose hosting and region; provision MongoDB and API secrets; configure Google OAuth clients. Keep secrets server-side and out of Git.
3. **Define data and access rules:** document MongoDB collections and indexes; implement authorization in Fastify routes/repositories; test role, ownership, private-field, and invalid-transition boundaries.
4. **Complete the marketplace loop:** reconcile existing onboarding with the PRD, then close gaps in needs, discovery, request lifecycle, and role dashboards. Keep API contracts in packages/shared.
5. **Close trust and usability gaps:** notices before data sharing, credential-upload explanation and limits, grievance reporting/contact, privacy controls, and actionable error states.
6. **Pilot readiness:** finalize legal copy only after lawyer approval; recruit real consenting testers; prepare QA, monitoring, support, store disclosures, and release accounts.

The ClickUp W1-W8 IDs remain useful for tracking, but their old dates and Supabase-specific acceptance criteria are not authoritative. Re-date work after dependencies and scope are confirmed.

## 4. Later releases: require approval before implementation

### Release B — transactional marketplace

Only after provider, legal, tax, security, and support readiness: confirmed availability/booking, payment collection, invoices/receipts, ledger and settlement, consultation delivery, chat, and feedback. Payment callbacks must be verified server-side; payment and booking states remain separate; no payout or refund is complete until the provider confirms it.

### Release C — optimization

Prioritize from pilot evidence: richer matching, analytics/insights, localization, advanced reviews, and other improvements. AI matching and advanced communication remain deferred until explicitly approved.

## 5. Product decisions still open

Record decisions in [DECISIONS.md](DECISIONS.md) before treating them as requirements:

- Commercial model, fee payer, taxes, and when monetization begins. The PRD's 5% fee and INR examples are illustrative, not approved prices or tax calculations.
- One-time consultation versus ongoing advisory; cancellation, no-show, refund, and dispute rules.
- Professional verification evidence, review process, profile visibility, and moderation.
- Request-only communication versus chat in the MVP.
- Necessity and retention of DOB/gender data; the PRD asks to confirm whether these fields are needed.
- Android-first versus simultaneous Android/iOS launch; language rollout and tester targets.
- Payment, consultation, notification, hosting, and data-residency providers where still undecided.

## 6. Cross-cutting acceptance rules

- Enforce authentication, role, ownership, and participant access on the server. Expose only explicitly allowlisted public profile fields.
- Minimize personal data. Do not expose DOB, contact details, PAN/GST documents, payout details, or private credentials in public views, logs, or analytics.
- Make writes idempotent where retries can duplicate accounts, requests, payments, or notifications. Use transactions/locking for concurrent booking or ledger operations.
- Keep consent versioned and auditable; account deletion, data correction, and grievance retention follow lawyer-approved policy.
- Provide loading, empty, offline/error, and retry states for data-driven screens. Support accessibility and Android/iOS layouts.
- Do not hard-code illustrative fees, invent metrics, or show a verification badge before the review criteria are met.

## 7. Current implementation checkpoint

The codebase already contains the core auth, profile/onboarding, discovery, request lifecycle, moderation, and privacy foundations described in [HANDOFF.md](HANDOFF.md). Continue from that state; audit against this plan and the PRD instead of rebuilding completed work. Known gaps and implementation locations are tracked in the handoff.
