# Owner ↔ Professional chat implementation plan

Implementation checkpoint: completed for the request-linked text-chat slice on 2026-11-18. Remaining production and expanded PRD gaps are listed at the end of this file.

## Follow-up: prevent contact exchange and reserve video entry

User clarification: chat is required, and its purpose includes keeping participants from exchanging direct contact details. Reject messages containing numeric characters, English number words (for example, one/two), common email/URL/social-handle patterns, or obfuscated email patterns such as `name at domain dot com`. Apply the same policy in the mobile composer and enforce it again in the API; show a clear inline explanation and never persist a rejected message. Keep ordinary English prose sendable when it does not contain those blocked patterns.

Add a video-call icon at the top right of the thread. It is a visible placeholder only: tapping it says video calling is coming soon and must not start a call or request permissions.

Follow-up implementation order:

1. Add a shared contact-information detector and API rejection code, with focused allow/block coverage.
2. Add client-side feedback using that same shared detector and retain the server as final enforcement.
3. Add the top-right video icon and a localized Coming Soon toast; do not integrate a call provider.
4. Typecheck/lint, exercise allowed and rejected messages through the API and UI, restart Metro/app from terminal, and capture the updated conversation screen.

Follow-up status (2026-11-18): all four steps completed. Numeric characters (including non-ASCII numerals), English number words, common email/link/social-handle patterns, and a written-out email pattern are blocked in both the shared mobile policy and the API. The composer displays a localized reason and rejected attempts are not saved. The chat header has a video icon that only displays a localized Coming Soon toast.

Follow-up verification: shared policy tests (3/3), focused API conversation test (1/1), API/shared/mobile typechecks, and EN/HI key parity passed. Backend `/health` returned `{ "ok": true }`. Terminal ADB reloaded the emulator; the synthetic Owner–Ravi thread showed existing messages and the video icon. Tapping the icon showed “Video calling is coming soon.” Submitting the harmless phrase “one two” displayed the block message and did not add a message bubble. Full API test suite and production abuse/rate-limit review were not run in this follow-up.

## Scope decision

The Consolidated PRD describes S14 (Owner chat) and P12 (Professional chat) as a later/approval feature in its release catalogue (PDF pages 3–4, 12, and 19). The expanded communication specification (PDF page 17) calls for a conversation list with unread state, participant-only text conversations, timestamps, read state, and loading/empty/error states. The user has explicitly asked to bring chat forward now so they can see messages.

Implement a small, request-linked text-chat slice for the two participants on an accepted or completed consultation request. This is an explicit scope expansion from Release A. It does not add attachments, typing/presence, push delivery, moderation/blocking, support inbox, calls, or payments.

## Implementation steps

1. **Persist messages in the API**
   - Add a Mongo `messages` collection and repository, with an in-memory implementation for route tests.
   - Each record has a stable message ID, request ID, sender ID, body, creation timestamp, and nullable recipient-read timestamp.
   - The consultation request ID is the conversation ID. This guarantees exactly two known participants and avoids exposing contact details.
2. **Enforce authorization and eligibility**
   - Add authenticated list, read, and send endpoints.
   - Return a conversation/message only to its owner or professional participant; use `404` for non-participants.
   - Permit chat only after the request is accepted or completed. Validate trimmed text (1–2,000 characters); never log message bodies.
   - Listing conversations returns eligible requests with latest-message preview and unread count. Opening a thread marks received messages as read. Sending persists once and returns the created message.
3. **Add the mobile experience**
   - Add a Messages list and request-linked conversation detail route usable by both roles.
   - Link into Messages from both roles’ Requests screen and provide a Message action on eligible request cards.
   - Show participant/business name, need title, message preview/time, unread state, chronological message bubbles, composer/send, and loading/empty/error states.
   - Use existing theme, spacing, typography, safe-area, button, and icon components; add English/Hindi strings.
4. **Demonstrate both directions**
   - Start/check the API before device verification, reload the app through terminal/ADB, open the synthetic accepted Owner–Professional request, and send/read a message from each role if the available emulator sessions permit.
   - Do not alter real profile/consent data. Any sample conversation content must be clearly synthetic and limited to the previously authorized demo accounts.

## Verification gates

- API checks cover participant-only access, accepted/completed eligibility, validation, persistence, and read-state changes.
- Mobile/API typechecks and lint pass.
- Terminal emulator shows the Messages list and an actual persisted conversation; report separately if the second role cannot be authenticated on the device.

## PRD status update after implementation

Update `docs/MVP_COMPLETION_CHECKLIST.md` to distinguish the original PRD release boundary from this user-approved scope expansion. Mark only what was implemented and verified; keep support inbox, moderation/block/report, push delivery, and production chat readiness open.

## Completion evidence

- Implemented Mongo message persistence, participant-only API access, accepted/completed eligibility, input validation, unread counts, read-state updates, notifications, and account-deletion cleanup.
- Implemented shared Owner/Professional Messages and thread screens with existing theme tokens, English/Hindi copy, safe-area composer, list previews, timestamps, send state, retry states, and periodic refresh.
- Focused API test passed. Mobile and API typechecks passed. The app reloaded from Metro on the terminal-managed Android emulator. The synthetic Owner sent a message in-app; a reply from the synthetic Ravi Menon Professional account was saved through the authenticated API; the Owner thread displayed both persisted messages.
- The full API suite currently has 18 failures in other request, match, profile, notification, and photo cases. These are not caused by the focused chat test but need a separate integration pass before claiming the full suite is green.
- The Professional screen has not been visually opened under a separate emulator session. Current emulator Google identities map to the existing Owner demo and a personal Professional account; the personal account was left untouched. Support inbox, All/Unread filters, older-message pagination, attachments, push delivery, and block/report/moderation remain open.
