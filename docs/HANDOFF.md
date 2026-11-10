# MeraCEO handoff

For the next engineer or agent (written 2026-11-11). Read this, then `docs/CODE-GUIDE.md` and `docs/DECISIONS.md`.
The original task list is `~/Downloads/MeraCEO_Implementation_Plan.md` (v2). It assumes Supabase; we replaced that (see "Stack" below), so read its Postgres/RLS/RPC tasks as "do it in `apps/api`". The product spec is `MeraCEO_VIBECODED_POC/MeraCEO_PRD_V1.0.pdf`. The old POC in `MeraCEO_VIBECODED_POC/` is reference only. Do not edit or migrate it.

## Stack (decided by the owner, Salman)

- Monorepo, pnpm workspaces: `apps/mobile` (Expo SDK 58, React Native 0.88, Expo Router), `apps/api` (Fastify + TypeScript + MongoDB Atlas), `packages/shared` (zod schemas, enums, matching, request state machine, used by both).
- Google sign-in only. The app sends a Google ID token to `POST /auth/google` and gets a 7 day session JWT.
- Files: Backblaze B2 (S3 compatible) through presigned URLs. Reads use 1 hour signed URLs, uploads 5 minute presigned PUTs.
- No git history yet. The owner asked for no branches or commits so far. Do not commit or push unless asked.

## Commands

```sh
pnpm install
pnpm check                      # typecheck + lint + tests for shared, api, mobile. Definition of done. Currently green (shared 20, api 52 tests)
cd apps/api && pnpm dev         # API on :3000. Restart after any shared/ or api change: pkill -f "src/server.ts"
cd apps/mobile && npx expo run:android --device emulator-5554   # only needed after native changes (new native module, app.config.ts plugin)
```

Never print `.env` values in chat or logs. The MongoDB password was exposed once in a transcript and **still needs rotating**.

API dev helpers (`apps/api`): `pnpm pros list|approve <id>|hide <id>` (moderation), `pnpm demo:add` (adds 4 approved demo professionals), `pnpm demo:request <professionalUserId>`, `pnpm demo:remove`.

### Testing on the Android emulator (what worked)

- JS changes have no fast refresh in the dev client: `adb shell am force-stop <pkg>` then relaunch with `adb shell monkey -p <pkg> -c android.intent.category.LAUNCHER 1`, wait about 40 s.
- Screen is 1080x2424 px. `adb shell input tap x y`, `input text "a%sb"` (use %s for spaces), `input keyevent 4` hides the keyboard. Take screenshots with `adb exec-out screencap -p > file.png`. Wait 3 s between taps.
- Dark mode: `adb shell cmd uimode night yes|no`. Deep link to the dev component gallery: `meraceo:///dev/components`.
- Bottom sheet row positions depend on the number of options; screenshot to calibrate before tapping.

## Current state (what is built)

Auth, role, age check, consent, account deletion, export; owner (8 steps) and professional (7 steps) onboarding with logo/photo upload, validation, review with Edit links and draft persistence; moderation (pending_review / approved / hidden); matching with reasons; owner Discover with search, filters, bookmark Save and a Saved filter; professional profile page for owners (`app/professionals/[id].tsx`, `GET /me/professionals/:id`); send request; accept / decline / cancel / schedule / complete; notifications with bell and unread count (20 s polling); Requests and Consultations tabs; Profile/Account tab with Settings on its own page (gear, top right). English strings are complete; `hi.json` mirrors every key but there is no language switch.

Task by task status against the plan:

- Done: W1-07, W1-08, W1-12 (Android only), W2-03, W2-04, W2-07, W2-08, W3-01 to W3-05, W3-08 (draft wording), W4-01, W4-03 (photos/logos only), W5-01 to W5-03, W6-01, W6-02, W6-05.
- Partial: W4-02 (taxonomy lives in `packages/shared`, not a DB table), W6-03 (no pending-count tiles on owner, no request-count/profile-completion on professional), W6-04 (empty states done, error/retry thin), W6-08 (no language switch, no missing-key check), W2-05/W2-06 (rules enforced in API, tests cover ownership, no dedicated suite).
- Not started: see "Remaining work".

## Where things are

- API: `apps/api/src/app.ts` holds all routes. Repositories (Mongo + InMemory) in `src/users|profiles|needs|requests|consent|notifications|saved`. Storage in `src/storage`. Server wiring in `src/server.ts` (add new repos there and in `tests/app.test.ts` `makeApp`). Tests: `apps/api/tests/app.test.ts`.
- Mobile routes: `apps/mobile/app/` (`dashboard/owner|professional/*` are the tabs, `settings.tsx`, `notifications.tsx`, `professionals/[id].tsx`, `needs/*`, `account/edit.tsx`, `onboarding/*`).
- Mobile code: `src/components` (shared UI), `src/features/*`, `src/lib/api.ts` (typed client, add every endpoint here), `src/i18n/en.json` + `hi.json`.
- Shared: `packages/shared/src` (`enums.ts`, `schemas/*`, `matching.ts`, request state machine).

## Conventions the owner cares about (follow them)

- Simple, readable code; a short comment on every function and component.
- UI: professional, calm, flat. No chunky/lip buttons, no neo-brutalism, no floating tab bar, no emojis. DM Sans. Brand blue `#0866FF`, green `#00786A`/`#00A786`. Every colour comes from `theme.ts` tokens (no hex in screens). All text through `t('key')`; add the key to **both** `en.json` and `hi.json`.
- Icons only through `src/components/icon.tsx` (Lucide). Add new names to its map.
- Tab screens use `TabScreen` (compact top bar, no intro paragraphs). Pages opened from tabs use `TabScreen back`. Decorative corner circles only on welcome and onboarding screens. Select/unselect fades take 200 ms. Dark mode must work.
- Onboarding steps should fit one screen with the buttons pinned (Review may scroll).
- Privacy: date of birth is collected for age verification, kept in the user's account, included in their own export, and deleted with their account. Never log or expose it in public user responses. Do not collect PAN, full address or gender. Contact details (phone, LinkedIn, email) must never appear in list, search, profile-view or request payloads. The consent log is append-only and kept unlinked after account deletion (retention is a lawyer decision). Do not delete a user's real data to test; use the app's Delete flow on test accounts only.
- Run `pnpm check` before calling anything done, and look at UI changes on the emulator in light and dark.

## Remaining work (suggested order)

### A. Privacy and compliance items the plan marks Urgent
1. **Hide professionals who turned off "Match suggestions" from direct access.** `matchablePool()` in `app.ts` filters them out of search and matches, but `GET /me/professionals/:id` and `PUT /me/saved/:id` only check `moderation === 'approved'`. Apply the same consent rule there (404). Add tests. Saved lists should stop showing such a person too.
2. **W6-06 Report a problem.** `grievances` collection and repository, `POST /me/grievances` (category, message, optional request id), confirmation screen showing the officer contact, entry in Settings. Needs the grievance officer name and email from the owner (W3-07). Show the same contact in Settings and Help (W8-03), and make it visible before sign-up (welcome or sign-in screen).
3. **W5-04 Notice before sending a request.** In the send sheets (`features/needs/match-card.tsx` and `app/professionals/[id].tsx`) say what the professional will see (business name, place, the need, the note). Wording must be marked DRAFT until the lawyer signs off.
4. **W4-04 and credentials upload (W4-03 rest).** Private credential upload for professionals (`kind: 'credential'` already exists in `storage/presign.ts`), a verification notice on that screen, size/type limits checked when the upload is confirmed (a presigned PUT cannot enforce size). Reading uses expiring signed URLs.
5. **W2-09, W2-10, W3-06, W6-07** drafts in `docs/legal/` (privacy notice, terms, disclaimer, breach notice template), each marked "DRAFT, not legal advice, lawyer to confirm", with data collected, purpose, retention, rights and grievance contact. App copy must match the approved text exactly; bump `NOTICE_VERSION` in `app.ts` when wording changes.

### B. Product gaps
6. **W6-03 dashboards:** owner pending-request count and upcoming consultations; professional request counts, upcoming consultations, profile-completion indicator.
7. **W6-04 error states:** failed network, failed auth, with a retry on list screens (Discover, Opportunities, Requests, Consultations, Profile, notifications).
8. **W6-08 Hindi:** language switch (device locale via `expo-localization` plus a manual choice in Settings), and a CI check that `en.json` and `hi.json` have identical keys (add it to `pnpm check`). Review Hindi wording with the owner.
9. **W6-09 analytics:** PostHog events `signup_started`, `onboarding_completed`, `need_posted`, `request_sent`, `request_accepted`, `request_declined` with an allow-list in `lib/analytics.ts` and no personal data in properties. Needs a PostHog project key from the owner.
10. **Filters on Discover:** the two rows of pills (expertise and needs) are heavy. Move them into the filter sheet.
11. **Need edit/close, response note on accept/decline, contact sharing after acceptance (respecting the consent), calendar export, separate role intro screens, admin web review for moderation** (these come from the POC comparison, not the plan; confirm priority with the owner).

### C. Release engineering (needs owner accounts)
12. **W5-05 transactional email** (needs an email provider; subjects must contain no names) and push notifications (needs Firebase). In-app notifications already exist.
13. **W4-05 Sign in with Apple** (iOS), iOS Google client ID and the Google Expo plugin, iOS build (needs full Xcode, not installed). Android client IDs need debug and release SHA-1 registered in Google Cloud.
14. **W7-02 Sentry** (no PII), **W7-01** `docs/QA.md` checklist and Maestro flows (sign-in, onboarding, request, accept, delete account), **W6-11** reviewer test accounts (credentials go in store notes, not the repo), **W6-10** store listings and privacy disclosures, **W7-03/04** store submissions.
15. Hosting for the API and database (region still undecided; ask the lawyer about cross-border transfer), EAS project, bundle id `com.meraceo.app` is a placeholder.

### D. Cleanup before release
- Remove `apps/mobile/app/dev/components.tsx` (dev gallery; it now also holds sample match/need/request cards) before W7-01.
- Update `README.md`: the Status section still describes Supabase and PGlite.
- Remove demo data: `pnpm demo:remove`. Rotate the MongoDB password. Confirm the light colour palette with the owner. Record the matching-logic check against the POC's `src/domain/matching.ts` (plan W5-01 asks for it; weights are expertise 60 / industry 20 / budget 15 / format 5 in `packages/shared/src/matching.ts`).

## Known caveats

- Older saved profiles and the demo professionals lack fields added later (the profile page and API default missing fields; do not assume required fields are present on old records).
- The `industriesAdvised` field is accepted by the schema but has no UI.
- Dev toast about `Response.blob()` performance is harmless.
- Hindi text is mirrored but not reviewed by a native reader.
- Owner decisions still open (do not guess): commercial model, engagement scope, verification rules, launch sequence, tester numbers, D-U-N-S, hosting region, Play Console account type. They are listed in `docs/DECISIONS.md`.
