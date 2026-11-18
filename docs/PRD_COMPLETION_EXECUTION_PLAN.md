# Consolidated PRD completion execution plan

Date: 2026-11-18
Source: /Users/salman/Downloads/MeraCEO_Master_PRD_V3_Consolidated.pdf

## Confirmed delivery scope

Complete every Consolidated PRD MVP requirement for business owners and working professionals first. Payments remain deferred. Video calling is scheduled after the MVP work is complete. Full-product chat, reviews, insights and commercial workflows do not automatically expand this MVP pass.

## Parallel ownership

- Business owner agent: S1A–S1D consolidation and owner-only screens. Start with four logical onboarding sections, full review, draft preservation and actionable validation.
- Professional agent: P4 dedicated availability and P8 opportunity details; preserve existing P1A–P1D and shared contracts.
- Shared flow agent: shared settings/help/preferences and identify auth/provider dependencies. Start with settings that need no external provider.
- Coordinator: shared schemas/API/contracts, integration, checks, emulator reload and reporting. Agents must request shared-contract changes rather than independently editing the same files.

## Execution order

1. Complete owner four-section registration and professional availability/opportunity detail surfaces.
2. Close dashboard, discovery, need lifecycle, request and scheduling gaps.
3. Complete shared settings, support and recoverable states.
4. Finish the complete MVP acceptance checklist. Keep expanded-product flows tracked separately; payments are deferred and video calling follows completion of the MVP.
5. Verify implemented flows and reload the emulator after changes. Report code completion separately from device acceptance.

## Stakeholder demo close-out (2026-11-18)

1. Professional identity completed P1A–P1D on the emulator; dashboard and weekly availability loaded. At the user's explicit request, moderation is now `approved` in the development database so the profile can appear in owner discovery. This does not certify credentials. The current CLI records no reviewer, evidence or reason, so the PRD's auditable review workflow remains open.
2. The selected second Google identity is authenticated as Owner. With explicit authorization for synthetic data and Owner terms consent, it completed S1A–S1D and submitted a fictional business/need with an adult demo DOB. The emulator reached Find experts, showed one need and matched professionals; the Requests tab showed the need as Open and no requests.
3. Verify the MVP marketplace flow end to end using the authorized synthetic Owner profile and a synthetic demo Professional: Owner UI submits a request; Professional opportunity feed returns the need; Professional API receives and accepts; both roles read the same resulting state; Owner UI shows the accepted consultation and notification. Separately note that the user's approved Professional account is opted out of matching and is therefore correctly excluded.
4. Track external/release gates separately from the local demo: legal notice/retention approval, moderation evidence/audit workflow, production MongoDB race acceptance, and release configuration.

## Feature verification pass (2026-11-18)

1. Confirm the development API is running and `/health` returns 200 before any test or emulator interaction. If it is down, start it in Terminal first.
2. Run the repository's prescribed `pnpm check` gate and capture typecheck, lint, translation parity, and shared/API test results. Do not alter implementation during this pass unless a failure is isolated and reported first.
3. Verify Release A paths on the emulator, using only the already authorized synthetic development identities/data: authenticated startup and role routing; Owner need list and lifecycle; professional opportunity discovery/detail; request creation and professional response; consistent request status for both roles; availability/scheduling; dashboards, notifications, and retry/empty states where reachable.
4. Inspect backend/API evidence for authorization and ownership boundaries, closed-need rejection, duplicate request/idempotency, and private-field redaction through existing automated coverage or focused read-only checks. No production accounts/data or external messages.
5. Record each result as automated, API, emulator, or not verified in `docs/MVP_COMPLETION_CHECKLIST.md`. Payments and video calling remain deferred; other expanded-product screens are listed separately from the Release A verdict.

### Verification results (2026-11-18)

- Backend `/health`: 200 before automated and emulator checks.
- `pnpm check`: passed workspace typecheck, lint, 768-key EN/HI parity, 36 shared tests and 73 API tests.
- Emulator Owner flow: submitted synthetic S1A–S1D; need appears Open; four professionals appear in discovery; request to synthetic Ravi Menon sent successfully; accepted request appears in Consultations; acceptance notification loads.
- API flow using a short-lived session only for the seeded synthetic Professional: professional feed contains the Owner's open need; pending request loads; accept succeeds; both Owner and Professional request lists report `accepted`.
- Schedule UI opens a recoverable “no bookable availability yet” state for seeded Ravi; no time can be confirmed. No appointment was created.
- The user's separate approved Professional account is `available` and `approved`, but its latest matching consent is `false`; it is intentionally absent from Owner discovery. No consent preference was changed.
- This does not certify all features: Professional response was exercised through API, not its UI; a successful scheduled booking, real professional consent/discovery, real MongoDB concurrency, error/offline retries on device, and remaining PRD/release gates are still open.

## Integration rules

Use existing semantic theme tokens, components, translations and authorization. Preserve current user data and local drafts. Each agent reports changed files, remaining gaps and verification. No deployment or production data changes are part of this local implementation pass.

## Owner need lifecycle batch

- Add required timeline and 500-character description validation for new/edited needs. Preserve old records without a timeline until their owner edits them.
- Keep budget optional, retain existing budget bands pending the wider exact-INR taxonomy update.
- Add ownership-scoped repository update/close operations; closed records stay readable and existing consultations remain intact.
- Owner need detail supports review, edit and confirmed close; closed needs stop discovery and new requests through server status enforcement.
- Coordinate API/client mutations centrally. Verify schema/repository boundaries and mobile typecheck before emulator review.

## Shared recovery pass

Requests, owner needs within requests, notifications and account profile must distinguish loading, failed load and successful empty results. Provide explicit retry while retaining previously loaded data. Refresh account on return from editing. Marking notifications read must not erase a successfully fetched list if the acknowledgement fails. Profile completeness will use actual schema-required values rather than invented activity metrics.

### Discovery/profile completion batch

Add S5 availability filter using a server-supported configured-availability predicate. Render only allowlisted self-reported employment, education, and certification fields on S6, without verification claims or private evidence/contact. Dashboard feed failures must show retry instead of empty results. Coordinate app.ts/api.ts changes through API owner.

## Tooling and professional draft recovery

Keep Expo's lint rules active and align the mobile ESLint dependency with the React plugin's declared supported range rather than removing rules. Add professional draft loading/error/retry with cancellation; do not proceed with an empty draft after storage failure.

## Owner registration data and consent batch

- Add a 300-character owner bio and business description, 500-character challenge/goals, and initial-need timeline.
- Capture a budget for each selected support area using nonoverlapping bands: below 5000; 5000–24999; 25000–100000; above 100000 INR. Retain the coarse legacy budgetBand for matching compatibility.
- Keep new profile fields optional for legacy records; require timeline and complete area budgets in new registration UI.
- Record terms and optional consent from S1D with the shared stable idempotency utility, retain draft until profile and consent both succeed.
- PAN/GST/gender remain decisions; do not add undocumented collection. Verify schema boundaries and draft/consent behavior.

## Final MVP audit and copy parity

Record current code status for every MVP screen in docs/MVP_COMPLETION_CHECKLIST.md, separately identifying device acceptance and unresolved product choices. Add a dependency-free English/Hindi key-parity check to the mobile lint/check path so missing translations fail required checks without changing active language behavior.

### Verified email password login

Allow authenticated Google-verified accounts to set a password in Security, then log in using that verified email. Store versioned salted scrypt hashes privately, bind credentials to the verified email, and exclude hashes from self/export/public payloads. Unknown identifiers and wrong passwords share the same response and expensive verification path. Rate-limit login and provisioning. Keep mobile verification, OTP, recovery and delivery providers deferred. Existing records must refresh Google verification before provisioning if no verification flag exists.

## Professional shortlist and feed controls

Persist shortlisted opportunity IDs in user-scoped device storage; reuse one store in P5 cards and P8 details. Load only eligible opportunities from API, then apply shortlist, exact timeline and budget/mode filters, plus relevance/title sorting against available public data. Never invent a chronological sort without timestamps. Show persistence errors and explain device-only scope. Show profile readiness from validated stored profile rather than arbitrary percentages.

## Owner profile summary batch (S12)

- Load own requests, needs and saved professionals for real activity counts; retain existing profile loading/retry behavior.
- Show accepted/completed consultation count and distinct connected experts, open needs and saved experts as accessible links.
- Show an explicit readiness checklist using actual profile field presence, owner bio and support-area tags. Do not infer ratings, income or verification.
- Refresh on focus; avoid presenting zero counts after a failed request. Keep private contact details out of profile summary.

### Logo upload limits

Enforce owner logo PNG/JPG and at most 2 MiB on the actual selected upload bytes before presigning. Add server HEAD metadata inspection before attaching uploads to profiles; reject missing, oversized, disallowed or extension/type mismatches. Preserve professional photo format support. Cover validation with focused tests and do not claim content signature scanning.

## Support and grievance workflow batch

- Add signed-in report-problem form: category, message up to 500 characters and optional participant-owned request reference.
- Persist complaints privately through Mongo/in-memory repositories and authenticated routes. Deduplicate retry submissions by reporter/key.
- Show submitted confirmation and only a configured public support email; never invent an officer or address. Public support remains accessible before signup.
- Preserve draft on failure; no external message is sent. Grievance retention policy remains unresolved and must be recorded before production approval.

## Approved personal-information choices

Owner decision: ask gender in S1B and P1A, require an explicit choice for new registration, offer prefer not to say; legacy profile edits remain compatible. Phone and PAN/GST stay optional, and fee bands remain. Store gender privately, never in discovery/opportunity/request public responses. Use shared gender options in both forms and include it in private review.

## Integrated checkpoint

Workspace typechecks/lint and shared36/API73 tests pass. Emulator reloaded and support contact/gender/settings inspected. See MVP_COMPLETION_CHECKLIST.md for honest remaining product and acceptance work. Payments deferred; video calling follows MVP completion.
