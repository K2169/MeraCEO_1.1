# MeraCEO ClickUp cleanup draft

**Sync status:** Proposed descriptions and grouping only. ClickUp rejected updates because the daily MCP limit was reached; do not treat this file as proof that ClickUp changed.
**Source snapshot:** `docs/CLICKUP_TASKS.md` collected 2026-11-11. Completed tasks are preserved as history. Current statuses and due dates need a refresh before syncing.

## Active: Release A MVP

Only the core marketplace loop, trust, privacy, pilot support, and quality gates stay in the active MVP queue. Task descriptions below are the proposed clear acceptance intent.

- [W1-01 Confirm five product decisions](https://app.clickup.com/t/14z8ykfxdvp) — MeraCEO connects business owners with professional consultants. Decide the revenue model; one-time vs ongoing engagement and what it includes; consultant verification checks; requests-only vs chat in the MVP; and first launch platform, users, location, and features. Record answers in docs/DECISIONS.md.
- [Choose API and database hosting region](https://app.clickup.com/t/14z8ykfxdvy) — Choose and record the India deployment region for the Fastify API and MongoDB. Ask legal counsel about residency and cross-border transfer implications.
- [Define MongoDB data model v1](https://app.clickup.com/t/14z8ykfxdvx) — Define MongoDB collections, ownership fields, indexes, and validation for users, profiles, needs, requests, consent, grievances, and notifications. Keep it aligned with packages/shared and document changes in the repo.
- [Set up MongoDB hosting](https://app.clickup.com/t/14z8ykfxdvu) — Choose a provider and create the development project/cluster. Configure a least-privilege API user and keep the connection string in server-only environment settings.
- [W1-03 Engage lawyer for privacy review](https://app.clickup.com/t/14z8ykfxdvq) — Engage counsel to review the privacy notice, terms, consent wording, verification process, data retention, grievance process, and cross-border data handling. Record the agreed scope and next steps.
- [W1-06 Create Expo account](https://app.clickup.com/t/14z8ykfxdvt) — Create or confirm the Expo account, create the EAS project, and link it to apps/mobile. Store signing credentials in EAS secrets; do not commit credentials.
- [Add authorization checks to API routes](https://app.clickup.com/t/14z8ykfxdw5) — Enforce authentication, role, ownership, and participant access in every protected Fastify route. Public responses must expose only allowlisted profile fields.
- [Configure Google sign-in for the API](https://app.clickup.com/t/14z8ykfxdw2) — Configure the API to accept approved Google client audiences. Verify token signature, issuer, audience, and email_verified; keep secrets out of the mobile bundle.
- [Test API authorization](https://app.clickup.com/t/14z8ykfxdw6) — Test that users can access only permitted records and actions. Cover cross-account access, private fields, role checks, and invalid request transitions.
- [W2-01 Create Google OAuth clients](https://app.clickup.com/t/14z8ykfxdw1) — Create Google OAuth clients for the approved MVP platforms. Register the app identifiers and signing fingerprints; store client secrets outside the repo.
- [W2-09 Draft privacy notice, terms and disclaimer](https://app.clickup.com/t/14z8ykfxdw9) — Draft privacy, terms, and disclaimer text from the app's actual data inventory. Cover purpose, retention, user rights, verification, and grievance contact; label drafts pending lawyer review.
- [W2-10 Domain and legal pages](https://app.clickup.com/t/14z8ykfxdwa) — Publish privacy, terms, and support pages on the chosen domain using lawyer-approved text. Link to them from the app before pilot signup.
- [W2-11 Business email address](https://app.clickup.com/t/14z8ykfxdwb) — Set up a monitored business/support mailbox for legal notices and user help. Confirm the grievance contact can receive and route messages.
- [W3-06 Finalise privacy notice and consent wording](https://app.clickup.com/t/14z8ykfxdwh) — Prepare the final in-app privacy and consent wording to match the lawyer-reviewed notice. Record the notice version and update the app copy.
- [W3-07 Grievance email and officer](https://app.clickup.com/t/14z8ykfxdwj) — Name the grievance officer, provide a monitored contact email, and agree the response process. Record approved details for use in the app and legal pages.
- [W4-02 Budget bands, expertise and industry taxonomy](https://app.clickup.com/t/14z8ykfxdwp) — Align budget bands, expertise areas, and industries across owner needs, professional profiles, matching, and filters. Use shared definitions and non-overlapping budget boundaries.
- [W4-04 Verification notice on upload screen](https://app.clickup.com/t/14z8ykfxdwq) — Before credential upload, explain what is collected, who can review it, how it is stored, and how long it is retained. Use lawyer-approved copy or mark it as draft.
- [W5-04 Notice before submitting a request](https://app.clickup.com/t/14z8ykfxdx0) — Before sending, show the owner exactly which business/profile details and request note the professional will receive. Submit only after the owner confirms.
- [W5-06 Recruit pilot testers on both sides](https://app.clickup.com/t/14z8ykfxdx2) — Recruit consenting business owners and professionals for the controlled pilot. Agree target numbers, keep the list private, and use real participants only.
- [W6-12 Lawyer sign-off on privacy notice and terms](https://app.clickup.com/t/14z8ykfxdxe) — Obtain written lawyer approval for the privacy notice, terms, disclaimer, and consent wording. Save the approval and make the app copy match the approved version.
- [W6-03 Basic dashboards on real data](https://app.clickup.com/t/14z8ykfxdx5) — Populate owner and professional dashboards from real API records: open needs/opportunities, request counts, and consultation status. Show correct empty states.
- [W6-04 Empty and error states](https://app.clickup.com/t/14z8ykfxdx6) — Add clear loading, empty, offline, and failed-request states to the MVP's data-driven screens, with retry where safe.
- [W6-06 Report a problem](https://app.clickup.com/t/14z8ykfxdx8) — Let an authenticated user submit a categorized problem report with an optional request reference. Store it privately, confirm receipt, and show the grievance contact.
- [W6-07 Breach notice template](https://app.clickup.com/t/14z8ykfxdx9) — Prepare a draft incident/breach notification template with counsel. Define who assesses an incident and how affected users are contacted under the approved policy.
- [W6-09 Analytics events for pilot metrics](https://app.clickup.com/t/14z8ykfxdxb) — Track only the minimum pilot events: signup started/completed, need posted, request sent, and request accepted/declined. Allowlist event properties and exclude personal data.
- [W6-13 Feature freeze](https://app.clickup.com/t/14z8ykfxdxf) — After the MVP exit gate passes, freeze Release A scope. Allow only critical fixes until the pilot review; keep Release B/C work out of the freeze.
- [W7-01 Final regression on both platforms](https://app.clickup.com/t/14z8ykfxdxg) — Run the owner-to-professional request/accept flow and privacy checks on each platform approved for the MVP. Record results and resolve urgent defects.
- [W7-02 Crash monitoring live](https://app.clickup.com/t/14z8ykfxdxh) — Enable crash monitoring for the pilot, verify a test event arrives, and confirm reports contain no personal data or credentials.
- [W8-02 Approve seed profiles](https://app.clickup.com/t/14z8ykfxdxn) — Review only real, consenting professional profiles against the approved verification criteria. Record each outcome; never publish fabricated profiles.
- [W8-03 Grievance officer contact visible in app](https://app.clickup.com/t/14z8ykfxdxp) — Display the approved grievance officer name and contact before signup and in Help/Settings. Verify the contact is readable on supported screens.
- [REL-01 Invite pilot users](https://app.clickup.com/t/14z8ykfxdxr) — After the MVP exit gate, invite the agreed real owner and professional testers. Provide clear pilot instructions and a support contact.
- [REL-02 Watch crash and support queues](https://app.clickup.com/t/14z8ykfxdxt) — During the first pilot week, check crash reports and grievance/support messages daily, triage issues, and log follow-up actions.

## Later or conditional

These tasks are outside the MVP or depend on owner approval, platform selection, provider choice, or store requirements. Prefix them with “Later” or “Conditional” so they do not read as Release A requirements.

- [Later: Set up billing for selected accounts](https://app.clickup.com/t/14z8ykfxdvz) — Not required for the MVP unless a chosen service requires billing. After providers and launch platforms are selected, list required payment methods, account owner, and expected charges.
- [Conditional: Apply for D-U-N-S number](https://app.clickup.com/t/14z8ykfxdvn) — Apply only if the chosen Play Console organization account requires it. Confirm the account type first and record the reference in the approved owner-only location.
- [Conditional: Confirm Play Console account type](https://app.clickup.com/t/14z8ykfxdwt) — After the Android store-launch decision, choose the Play Console account type and record whether organization verification or a closed test is required.
- [Later: Complete Apple Developer enrollment](https://app.clickup.com/t/14z8ykfxdwv) — Proceed only if iOS launch is approved. Complete enrollment and store the Team ID in EAS secrets.
- [Later: Evaluate Apple sign-in for iOS](https://app.clickup.com/t/14z8ykfxdwr) — Deferred from the Google-only MVP. Revisit if iOS launch is approved; check current store requirements and configure Apple token verification only if required.
- [Conditional: Run Android closed test](https://app.clickup.com/t/14z8ykfxdwu) — Run only if the selected Play Console account type requires it. Recruit the required opt-in testers and record the test period.
- [Later: Prepare iOS TestFlight build](https://app.clickup.com/t/14z8ykfxdww) — Proceed only after iOS launch is approved and Apple Developer enrollment is complete. Build, upload, and verify the core flow in TestFlight.
- [Later: Add transactional email](https://app.clickup.com/t/14z8ykfxdx1) — Not required for Release A; in-app notifications are the MVP baseline. Add email only after a provider is approved, with deduplication and no personal data in subject lines.
- [Later: Add Hindi localization](https://app.clickup.com/t/14z8ykfxdxa) — English is the PRD's initial language. Add Hindi strings and a language switch after localization is approved and wording is reviewed.
- [Later: Complete store listings and privacy disclosures](https://app.clickup.com/t/14z8ykfxdxc) — After platform and release decisions, prepare store listings and privacy/data disclosures that match the final data inventory and lawyer-approved notices.
- [Later: Prepare store-reviewer test accounts](https://app.clickup.com/t/14z8ykfxdxd) — Create test owner/professional accounts only if a store submission is planned. Put credentials in store review notes, never in the repository.
- [Later: Submit Android build to Play](https://app.clickup.com/t/14z8ykfxdxj) — Submit a production build only after Android store launch, legal disclosures, and regression approval are confirmed.
- [Later: Submit iOS build for review](https://app.clickup.com/t/14z8ykfxdxk) — Submit an iOS build only after iOS launch is approved, Apple enrollment is complete, and the iOS regression passes.
- [Later: Respond to store review comments](https://app.clickup.com/t/14z8ykfxdxm) — Use only after a store submission. Track each reviewer comment, implement required changes, and resubmit after verification.
- [Later: Complete app-store approvals](https://app.clickup.com/t/14z8ykfxdxq) — Milestone for the platform(s) approved in the launch decision. It is not a Release A pilot gate unless store distribution is selected.

## Preserved history

The 22 completed tasks remain unchanged. No task was deleted. The PRD's Release B/C work remains represented as deferred work rather than being lost.
