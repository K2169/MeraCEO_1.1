# Code guide: where things go

Read this first when you sit down to work. It says what each folder is for and what to do for common changes.

## The three parts

| Folder | What it is | Language |
|---|---|---|
| `apps/mobile` | The phone app (Android and iOS) | TypeScript + React Native (Expo) |
| `apps/api` | The server: Google sign-in, sessions, MongoDB, file upload links | TypeScript + Fastify |
| `packages/shared` | Rules used by both: role names, status names, form rules, request status rules | TypeScript + Zod |

Rule of thumb: if the app and the server must agree on something, it goes in `packages/shared`.

## Folder map

```
apps/mobile/
  app/                 Screens (one file per screen). The file name is the web address.
    index.tsx          Splash: loads the saved session, then sends you to the right screen
    welcome.tsx        Two intro slides
    role.tsx           Owner or professional choice
    sign-in.tsx        Google sign-in button
    age.tsx            18+ question
    age-blocked.tsx    Shown to under-18s
    consent.tsx        Four unticked boxes and terms
    onboarding/        Owner and professional forms
    dashboard/         Placeholder home screens (owner, professional)
    dev/               DEV ONLY screens (remove before release)
  src/
    components/        Reusable pieces: Button, Input, Card, Chip, Checkbox, Screen...
                       theme.ts holds ALL colours, spacing and text sizes
    features/          Logic grouped by feature
      auth/            Session, routing, Google sign-in, on-device progress
      onboarding/      Shared onboarding helpers (validation, option lists)
      onboarding-owner/  Owner form
      onboarding-pro/    Professional form
      needs/ discovery/ requests/ settings/ notifications/   Empty for now (later weeks)
    i18n/              en.json and hi.json: ALL text the user sees
    lib/api.ts         Every call to the server, in one file
    types/             Small type declarations (image imports)
  app.config.ts        App name, icon, bundle id, splash colours
  eas.json             Build profiles for EAS (cloud builds)

apps/api/
  src/
    server.ts          Start-up: connects to MongoDB and starts the server
    app.ts             Every API route, in one file
    config.ts          Reads and checks the .env values
    auth/              Google token check and session tokens
    users/             User records in MongoDB
    consent/           Consent choices (one row per choice)
    storage/           Upload links for Backblaze B2
  tests/               Automated tests for the API

packages/shared/
  src/enums.ts         Role, status and category names
  src/schemas/         Form rules (onboarding, request)
  src/requestStateMachine.ts   Who may change a request, and from which status
  tests/               Automated tests for the shared rules

docs/
  DECISIONS.md         Why we chose things, and the open questions for Salman
  CODE-GUIDE.md        This file
```

## Common jobs

**Change a colour.** Edit `apps/mobile/src/components/theme.ts`. Screens read colours from there. Never type a hex colour in a screen.

**Change any text.** Edit `apps/mobile/src/i18n/en.json` (and `hi.json` for Hindi). Screens call `t('key')`. Never type English text straight into a screen.

**Add a screen.** Create a file in `apps/mobile/app/`. Wrap its content in `<Screen>` so it gets the right background and safe-area padding. Add a route name to `routing.ts` if the splash screen must send people there.

**Add a server route.** Add it in `apps/api/src/app.ts`. Check the signed-in user with `requireUser`. Add a test in `apps/api/tests/app.test.ts`.

**Add a call from the app to the server.** Add one line in `apps/mobile/src/lib/api.ts`.

**Change a form rule.** Edit `packages/shared/src/schemas/`. Both the app and the server use it, so change it once.

**Check everything before you commit.** Run `pnpm check` from the repo root. It runs typecheck, lint and all tests.

## Rules we follow

1. Secrets go only in `apps/api/.env` or `apps/mobile/.env`. Never in code, and never in any variable that starts with `EXPO_PUBLIC_` unless it is public (client IDs, the API address).
2. Never log an email, a token or a date of birth.
3. Keep screen files under 400 lines. Move parts into `src/components` or `src/features`.
4. Every function has a one-line comment saying what it does.
5. Ask Salman before changing legal wording, the stack, or the data model after the first merge.
