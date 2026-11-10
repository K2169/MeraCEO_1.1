# Decisions

Decisions made while building. Owner decisions (commercial model, engagement scope, verification rules, launch sequence, tester numbers, D-U-N-S, region) are still open and are listed at the end.

## Stack change (approved by Salman)

- **Supabase is removed.** The backend is `apps/api` (Fastify + TypeScript) with **MongoDB** for data.
- **Authentication is Google sign-in only** for now. The app gets a Google ID token, sends it to `POST /auth/google`, and receives a session token. The API verifies the token (signature, audience, issuer, `email_verified`).
- **Files use an S3-compatible bucket** through presigned upload URLs. Current provider: **Backblaze B2** (free tier). Cloudflare R2 was dropped because it asks for a payment method.
- **Consequence for the plan:** tasks that assumed Postgres and RLS change meaning. W1-09 (schema), W2-05 (RLS on all tables), W2-06 (pgTAP tests), and the RPC tasks (W3-05, W5-03, W6-01) must be re-planned. Authorization moves into the API. Stop and ask before changing any of these further.

## Built decisions

- **Monorepo layout** follows implementation plan section 2: `apps/mobile` (Expo Router, routes in `apps/mobile/app/`), `apps/api`, `packages/shared` (contracts).
- **Request status spelling is `cancelled`**, matching plan section 4.
- **Matching logic is not built yet.** It is W5-01 and must first be checked against the old repo's `src/domain/matching.ts` (plan rule 9).
- **`consultation_requests.scheduled_start_at`** is needed so `completed` can only follow a scheduled start. Not in the plan's column list; confirm with Salman.
- **`business_needs` expertise:** the plan has a single `expertise_id`, but the onboarding schema allows up to five areas per need. Resolve before W3-01.
- **Bundle identifier `com.meraceo.app` is a placeholder** until the domain is confirmed (W2-10).
- **`app/dev/components.tsx` is a dev-only screen** (W1-08). It must be removed or guarded before W7-01.
- **Google sign-in uses the Web client ID as the token audience.** Android client IDs are accepted by the API as well. Android builds need the debug and release SHA-1 registered in Google Cloud.
- **Google Expo plugin is not added yet.** The plugin requires an iOS URL scheme. Add it with the iOS client.
- **Session tokens** are HS256 JWTs signed with `SESSION_JWT_SECRET`, valid for 7 days. Stored in the device keystore with `expo-secure-store`.
- **Uploads use path-style addressing** (Backblaze B2 requires it). Keys start with the owner's id, so users can only write inside their own folder. Presigned URLs expire after 5 minutes. Note: a presigned PUT can't enforce a size limit; size limits must be checked when the upload is confirmed.
- **Logs never include tokens, request bodies or email addresses.** Fastify redacts the authorization header and the `idToken` field.

## App flow and UI decisions

- **Flow:** splash (loads the saved session) → welcome (two slides) → role choice → Google sign-in → age check (W2-08) → role saved once on the server (W2-04) → onboarding (W3-01/02/03) → consent (W3-04) → placeholder dashboard.
- **Role intent:** the role picked before sign-in is kept on the device and sent to `POST /me/role` after the age check. The server refuses a second role with 409, so the role cannot change from the client.
- **Age check:** collect and store the user's date of birth, calculate whether they are 18 or older on the server, and block onboarding for younger users.
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
4. Launch sequence (W1-01).
5. Tester target numbers (W5-06).
6. Whether grievance records survive account deletion (W2-07).
7. D-U-N-S reference number (W1-02).
8. Hosting region for the API and database.
9. Rotate the MongoDB password (it was printed in a chat transcript).
10. Confirm the light colour palette (see the logo palette proposal).
