# Consolidated PRD: current MVP completion checklist

Audit date: 2026-11-18. Source: `/Users/salman/Downloads/MeraCEO_Master_PRD_V3_Consolidated.pdf`, feature catalogue pages 3–5, functional requirements pages 12–19, screen references pages 20–56. This records current working-tree implementation, including parallel changes. A screen existing in code is not proof of device acceptance.

## Latest integration checkpoint

- Post-audit device acceptance update (2026-11-18): the user-selected Professional Google identity completed P1A–P1D, its dashboard and weekly availability loaded from the API, and its development moderation state was explicitly approved at the user's request. This is a visibility approval for the stakeholder flow, not credential verification; the approval command does not record evidence, reviewer identity, or reason. A read-only check confirmed it is available/approved but its latest matching consent is false, so matching correctly excludes it; no consent was changed.
- The user-selected second Google identity completed Owner S1A–S1D using explicitly authorized synthetic demo data and explicit acceptance of the displayed draft Terms of Use. The emulator reached Find experts with one Open need and matching professionals; the Requests tab displayed “Demo growth plan” and “No requests yet.” This verifies Owner submission and need retrieval in the development app, not production behavior.
- Request/accept verification (2026-11-18): Owner emulator sent a request to synthetic demo professional Ravi Menon. The synthetic professional opportunity API included the Owner need; its authenticated request endpoint accepted the request. Owner and Professional API reads both returned `accepted`; Owner Consultations showed Accepted and the Owner Notifications screen showed “Ravi Menon accepted your request.” The emulator did not run as the Professional, so its response screen is not device-verified.
- Scheduling limit found: seeded synthetic Ravi has no bookable availability. Owner sees an explanatory message and disabled Confirm time; no schedule was created. Successful scheduling remains device/API acceptance open.
- `pnpm check` after this profile submission passed: shared 36 tests, API 73 tests, workspace typecheck/lint and 768-key EN/HI parity.

- Required gender choice added to both new registrations; phone remains optional and professional fee bands retained per owner decision.
- Public support contact is krishnam@meraceo.com. Public Help and authenticated private problem reports are implemented, with idempotent retries and participant checks for linked requests.
- Verified Google email accounts can provision a password and use email/password login. OTP, mobile ownership verification and recovery remain explicitly deferred.
- Slot occupancy and active-request uniqueness have MongoDB indexes; repository/API tests cover overlap rejection and concurrent request retries in memory. MongoDB concurrency acceptance remains open. Legacy schedules without known durations fail closed for scheduling changes.
- Changed appointments now retain the booked time pending counterpart confirmation; API tests cover self-confirmation refusal and stale confirmation rejection.
- Logo confirmation checks object metadata for PNG/JPEG and 2 MiB limit.
- Final automated checkpoint: shared 36 tests and API 73 tests pass; workspace typecheck, lint and translation parity pass. Emulator reloaded; support email, language switching, password screen and professional gender control inspected. No real account profile/password/report was submitted during this inspection.
- Still open: successful scheduling with a configured Professional; full Professional response on-device; production MongoDB concurrency tests and reviewed legacy schedule migration; approved onboarding visual hierarchy/artwork; an auditable admin evidence/review/correction workflow; legal copy/retention approval; pilot metrics and release configuration. Search pagination, server-synced professional shortlists and full request-time booking selections remain backlog items. Automated checks and the Owner-to-acceptance backend path pass, but the app is not yet declared fully PRD/MVP complete.

## UI consistency verification (2026-11-18)

- Pixel 6 OS 16 emulator, 1080×2400 at 420 dpi; English/light mode checked. Temporary system dark mode was checked on Help and support, then restored. No real profile, report, or credential was submitted.
- Visually reviewed welcome, sign-in, Settings, Password, Help and support, Report a problem, Post a need, both onboarding first sections, both role dashboards, availability, opportunity-not-found, professional-profile-not-found, and empty Notifications. Safe-area status/navigation bars, scroll behavior, titles, primary actions, fields, cards, and role-specific tab bars were visible without clipping in the captured states.
- The screen families intentionally use two shared shells: `Screen` for welcome/onboarding and standalone forms (scrolling circular back action), and `TabScreen` for tab destinations/details (fixed compact header). Both use the same DM Sans styles, semantic palette, spacing/radius tokens, shared fields and buttons. The welcome/login artwork keeps its approved green role/CTA treatment; app actions use the shared blue primary.
- A source scan of the reviewed screens found no hard-coded hex colors. Workspace `pnpm check` passed: typecheck, lint, 768-key EN/HI parity, 36 shared tests and 73 API tests.
- Availability's load-failure state now follows the shared pattern: explanatory error text and an outlined retry action; reloaded and viewed on-device.
- Device data-state acceptance remains open: emulator holds an incomplete professional profile. `/me/profile` returned 404; role-gated owner/opportunity endpoints returned 403 when opened under this professional session. Thus the screenshots verify empty/error styling and shell consistency, not successful profile-dependent data or the full four-section submit journey. No profile was created to force those states.

## Status and release boundary

- **Implemented core**: code supports the main flow; listed acceptance still needs verification.
- **Partial**: substantial PRD behavior is absent or unresolved.
- **Device acceptance open**: no complete real two-account emulator acceptance pass has been recorded for this implementation batch. Earlier targeted screenshots do not close this gate.
- The original PRD defers production payments, video/call delivery, advanced chat, reviews and insights beyond Release A. At the user's request, a narrow request-linked text-chat slice has now been pulled forward; this does not imply the expanded product or overall PRD is complete.

## Shared entry

| Screen | Code status | Remaining acceptance or implementation |
|---|---|---|
| SP0 Splash | Implemented core: authorized session restore, absent/expired token routing, retry | Exercise cold launch, expiry, offline retry, underage/incomplete profile routing; dedicated final artwork pending in PRD. |
| S1/P1 Welcome | Implemented core: role choice, registration/login entry and persisted role | Verify role persistence and approved artwork, safe areas and typography on small device. |
| S2/P2 Authentication | Partial: verified Google route, identifier/password UI | Verified-email password provisioning/login is implemented. OTP, identifier verification and recovery explicitly deferred by owner; retain Coming soon until real delivery exists. Verify final credential route separately. |

## Business owner

| Screen | Code status | Remaining acceptance or implementation |
|---|---|---|
| S1A Business details | Implemented core in four-section owner flow: identity, type/industry, description, website, location, revenue/team size, logo | Confirm optional PAN/GST collection versus current decision to omit. Verify logo PNG/JPG 2 MB rule through upload confirmation, public privacy and 300-character limit. |
| S1B Owner information | Implemented core: owner name, inline DOB/age check, designation, years, bio, account email, phone, qualification, LinkedIn | Gender selection is now required for new signup with a Prefer not to say option; phone remains optional by owner decision; verify Google prefill never overwrites draft and DOB stays private. |
| S1C Business needs | Implemented core: challenge/goals, expertise, timeline, per-area INR budget slabs | Verify per-area budget API persistence, 500-character limits, nonoverlapping boundaries, generated first need and matching. Exact budgets coexist with coarse matching bands; do not imply matching uses exact amounts until wired/verified. |
| S1D Review/submit | Implemented core: grouped review, edit return, required terms, versioned optional consents, stable retry key | Real registration success/retry and concurrent MongoDB consent submission still need acceptance. Verify complete review, dashboard routing and honest verification status. |
| S3 Dashboard | Implemented core: real open-need/pending/upcoming counts, upcoming records, navigation, discovery | Visual reference fidelity and two-account count changes still need device review; no fabricated metrics. |
| S4 Post/manage need | Implemented core: 500-character challenge, timeline, optional budget; edit/close routes; duplicate-open-need prevention by normalized title/challenge, industry and expertise set, with disabled chip/CTA feedback | Verify full create/edit/close lifecycle, API duplicate-conflict path, re-matching and preservation of historical requests; retain prohibition on requests for closed needs. Draft-to-open lifecycle beyond current create form remains to assess. |
| S5 Find experts | Implemented core: search, expertise/industry/fee/mode/availability filters, saved experts, relevance | Explicit user-selectable sort and pagination remain absent; verify eligibility and saved-state persistence. Ratings must stay hidden until real review data exists. |
| S6 Public expert profile | Partial: identity/about/expertise/skills, repeatable employment/education/self-reported certification rendering, save/request | Match approved overview/experience/services hierarchy; credential evidence/review workflow absent. Real reviews/rating/counts depend on deferred modules; never infer verification from self-reported entries. |
| S7 Consultation request | Partial: owner request, pro response, schedule picker reads actual windows/timezone/duration | PRD request-time mode/date/duration/fee flow is not complete; current scheduling follows acceptance. Slot occupancy is enforced by a database index; MongoDB concurrency acceptance remains open. |
| S8 Consultations | Implemented core: accepted/completed records and scheduling | Advanced calendar/filter layout, confirmed eligible Join and payment state are expanded scope. Verify ordering and completion permission with both roles. |
| S9 Pending requests | Implemented core: owner outgoing requests, professional accept/decline, owner cancel, notifications | Incoming professional interest requires P9 (expanded scope). Verify state synchronization and no duplicate active request. |
| S10 Modify appointment | Partial: accepted request time can be changed | Material time changes now require counterpart confirmation; full revision history and MongoDB concurrency acceptance remain open. |
| S12 Owner profile | Partial: own profile summary, edit existing record, logo | Profile-level connected-expert/open-need/saved/consultation summaries and readiness indicator not complete. Verify edits update discovery correctly. |
| S13 Core settings | Implemented core: persisted English/Hindi and device/light/dark choice, privacy toggles, export/delete, Help/About | Confirmed support email and report workflow implemented; formal grievance designation/retention still needs approval; FAQ/help needs approved content. Billing methods/invoices/receipts deferred with payments. Verify persistence, translations, deletion and theme on device. |

## Working professional

| Screen | Code status | Remaining acceptance or implementation |
|---|---|---|
| P1A Personal information | Implemented core: four-stage stepper, name/DOB/contact/location/LinkedIn, required discreet-mode choice and display name, secure age draft. When discreet mode is on, owner-facing name surfaces use the display name. | Gender selection is required for new signup; phone remains optional by owner decision; verify the new discreet-mode privacy behavior on device and against API responses; final approved hero/hierarchy and full device acceptance open. |
| P1B Professional information | Implemented core: role/company/experience, multiple employment/education/certification entries | Functional-area/artwork differences need reconciliation; private credential uploads, verification decision/rejection/correction workflow absent. |
| P1C Expertise/availability | Implemented core: expertise/industries, modes, duration, fee band, weekly timezone windows, business-size/revenue preferences | Fee bands retained by owner decision; business functions and expertise summary remain unresolved. Verify max selections, overlap/day consistency, legacy draft migration and matching preferences. |
| P1D Review/submit | Implemented core: grouped edit, terms/disclaimer, versioned consents and stable retry key | Pending review is visible on dashboard; explicit submit confirmation still needs review. Real completion and concurrent MongoDB retry acceptance remain open. |
| P3 Dashboard | Implemented core: actual requests/upcoming counts, records and quick links, opportunity feed | Profile readiness derives from stored profile schema validity; profile views/rating need real event/review records. Full artwork/layout acceptance open. |
| P4 Set availability | Implemented core: dedicated route; modes/windows/timezone/duration editing | Advance-booking rule absent; enforce atomic booking conflicts, preserve existing booking terms after future edits; test legacy records and DST. |
| P5 Opportunities | Implemented core: matched feed, search/expertise/industry/budget/mode/timeline filters, relevance/title sorting, device-persisted user-scoped shortlist | Shortlist is device-local, not cross-device. Verify persistence, filters, excluded closed/ineligible records and safe account separation; backend shortlist sync and pagination remain open. |
| P8 Opportunity details | Implemented core: permitted business context, need, timeline/budget/mode and match reasons | Shared shortlist action implemented for detail integration; Express Interest depends on P9. Verify authorization, closed/inaccessible rejection and no private fields. |
| P10 Edit profile | Implemented core: edits existing record via four sections | Credential changes/re-verification policy absent; verify updates appear on S5/S6 without recreating registration. |
| P11 Core settings | Same implemented core as S13 | Same contact/grievance/help acceptance; secure payout details/documents deferred with payments. |

## Supporting MVP requirements without numbered screen IDs

- [ ] Complete administrative verification evidence/reasons/correction workflow; moderation commands exist, but no complete admin review UI.
- [ ] Implement visible approved grievance contact and report/support workflow, including pre-signup access.
- [ ] Finalize terms/privacy/disclaimer and retention decisions; current notice copy is draft.
- [ ] Complete request-time privacy notice explaining what the other participant receives.
- [ ] Exercise role/ownership/private-field boundaries and retries on real MongoDB; automated checks and device checks are separate evidence.
- [ ] Decide minimal pilot analytics; instrument signup completion/profile readiness/first need/accepted requests without personal properties.
- [ ] Controlled pilot, Android/iOS launch choice, production monitoring, hosting/store configuration and release QA remain separate release gates.
- [x] English/Hindi key parity script wired into mobile lint, therefore root `pnpm check` (710 keys at introduction); wording/native-reader review remains open.
- [x] Fetch failure recovery added to requests, consultations, notifications, account, feeds and professional draft initialization; device network-failure acceptance remains open.

## Expanded screens and new scope exception

S11 payment/receipts; S15/P13 feedback; P6 earnings/settlement/documents; P9 proposal/express-interest and owner incoming-interest responses remain absent. At the user's request on 2026-11-22, P7 Insights is partially implemented using actual requests, scheduled consultations, current open opportunities and professional advisory areas. Earnings remain unavailable while P6 payments are deferred; profile views and match rate are not tracked yet. Payment/provider/tax/refund/cancellation and communication decisions must be recorded before dependent production integration. Full-product acceptance also requires booking revisions/expiry/no-show/dispute/refund and confirmed consultation delivery.

## Chat scope accelerated by user request (2026-11-18)

- **Implemented slice:** S14/P12 conversation list and detail use accepted/completed consultation requests as the participant-scoped conversation. Messages persist separately; read state and unread counts are stored; list and thread are available to both roles. A synthetic Owner ↔ Ravi Menon conversation was sent through the emulator and backend; both persisted messages displayed in the Owner thread.
- **Verified:** focused API flow passed for both participant directions, unauthorized access rejection, message validation, and read/unread state. Mobile/API typechecks passed. The emulator showed the list, sent message, and Professional reply. Follow-up contact-sharing protection blocks numeric characters, English number words, email/URL/social-handle patterns in both the composer and API; focused API and shared-policy tests pass. The emulator confirmed “one two” is rejected without adding a message and that the top-right video icon displays “Video calling is coming soon.”
- **Still open for PRD/full-product chat:** All/Unread/Support filters and support inbox, full Professional-side device acceptance, delivery/push guarantees, attachments, block/report/moderation, older-message pagination, production rate limits and release security review. Do not describe chat as production-ready.

## Completion evidence boundary

Do not label the app PRD-complete until each partial row is resolved or explicitly deferred, corresponding shared/API/mobile checks pass, and both roles complete a real consenting test journey. This file is a code audit, not a deployment or device certification.
