# Decisions

Product scope follows Master PRD V3: the original MVP defines Release A; the later full-product screen designs do not automatically expand it. The PRD's stack references are proposals; the owner-approved stack below remains in force.

Decisions made while building. Owner decisions (commercial model, engagement scope, verification rules, communication, launch sequence, tester numbers, D-U-N-S, and hosting region) are still open and are listed at the end.

## Stack change (approved by Salman)

- **Supabase is removed.** The backend is `apps/api` (Fastify + TypeScript) with **MongoDB** for data.
- **Authentication includes Google and is expanding to email-or-mobile/password login** at the owner's request. Google sign-in remains available and verified by the API (signature, audience, issuer, `email_verified`). Credential provisioning, verified phone ownership, and OTP delivery/recovery are tracked in [PROFESSIONAL_LOGIN_IMPLEMENTATION_PLAN.md](PROFESSIONAL_LOGIN_IMPLEMENTATION_PLAN.md); no email/SMS delivery provider is configured yet.
- **Files use an S3-compatible bucket** through presigned upload URLs. Current provider: **Backblaze B2** (free tier). Cloudflare R2 was dropped because it asks for a payment method.
- **Plan update:** the old v2 plan's Postgres/RLS/RPC steps are superseded. Follow `docs/IMPLEMENTATION_PLAN.md`; authorization and data-integrity rules are implemented and tested at the API boundary.

## Built decisions

- **Monorepo layout:** `apps/mobile` (Expo Router, routes in `apps/mobile/app/`), `apps/api`, and `packages/shared` (contracts).
- **Request status spelling is `cancelled`**, enforced by `packages/shared/src/requestStateMachine.ts` and the API.
- **Matching is implemented** in `packages/shared/src/matching.ts` as explainable, rules-based ranking. Do not add AI matching to Release A.
- **Request completion** requires a scheduled start and must be enforced by the API state transition.
- **Need expertise:** a business need can include up to five expertise areas; keep mobile, shared schemas, and API behavior consistent.
- **Bundle identifier `com.meraceo.app` is a placeholder** until the domain is confirmed (W2-10).
- **`app/dev/components.tsx` is a dev-only screen** (W1-08). It must be removed or guarded before W7-01.
- **Google sign-in uses the Web client ID as the token audience.** Android client IDs are accepted by the API as well. Android builds need the debug and release SHA-1 registered in Google Cloud.
- **Google Expo plugin is not added yet.** The plugin requires an iOS URL scheme. Add it with the iOS client.
- **Session tokens** are HS256 JWTs signed with `SESSION_JWT_SECRET`, valid for 7 days. Stored in the device keystore with `expo-secure-store`.
- **Uploads use path-style addressing** (Backblaze B2 requires it). Keys start with the owner's id, so users can only write inside their own folder. Presigned URLs expire after 5 minutes. Note: a presigned PUT can't enforce a size limit; size limits must be checked when the upload is confirmed.
- **Logs never include tokens, request bodies or email addresses.** Fastify redacts the authorization header and the `idToken` field.

## App flow and UI decisions

- **Flow:** splash (loads the saved session) → welcome (two slides) → role choice → Google sign-in or the planned verified email/mobile-password route → age check (W2-08) → role saved once on the server (W2-04) → onboarding (W3-01/02/03) → consent (W3-04) → placeholder dashboard.
- **Role intent:** the role picked before sign-in is kept on the device and sent to `POST /me/role` after the age check. The server refuses a second role with 409, so the role cannot change from the client.
- **Age check:** the current implementation collects date of birth and checks age on the server. PRD V3 asks to confirm whether DOB (and gender) are necessary and how long to retain them; resolve with legal review before pilot.
- **Date of birth privacy:** never include DOB in public user responses or logs. Include it in the user's own data export and remove it with account deletion.
- **Onboarding is local for now:** progress and drafts are kept on the device (survive an app kill). Saving to the server is W3-05.
- **Consent:** four unticked boxes. Terms must be ticked. Each choice is stored as its own event with notice version `draft-1`. The wording is marked DRAFT until the lawyer approves it (W3-06).
- **Logo:** the approved mark from the old POC `assets/icon.png`. Used for the app icon, splash and favicon.
- **Dark mode:** a softer slate background (`#1B2330`), not black. The light palette is still pending Salman's confirmation.
- **Splash and native splash:** the native splash background is white. A native rebuild is needed to see it.

## Open items (owner)

1. Commercial model (W1-01).
2. Engagement scope (W1-01).
3. Professional verification rules (W1-01).
4. Communication in the MVP: request-only or in-app chat (W1-01).
5. Launch sequence (W1-01).
6. Tester target numbers (W5-06).
7. Whether grievance records survive account deletion (W2-07).
8. D-U-N-S reference number (W1-02).
9. Hosting region for the API and database.
10. Whether DOB/gender collection is necessary, and its retention (legal review).
11. Rotate the MongoDB password (it was printed in a chat transcript).
12. Confirm the light colour palette (see the logo palette proposal).

## Personal-information decisions approved 2026-11-18

- Ask gender in owner S1B and professional P1A. New registrants explicitly select Woman, Man, Another gender, or Prefer not to say; legacy edits may omit it. Gender remains private and does not participate in matching, public profiles, opportunity cards or request payloads.
- Phone and optional PAN/GST remain optional. Continue using fee bands.
- Prior notes deferring whether to ask gender are superseded by this decision; retention/legal copy still needs the existing policy review.
