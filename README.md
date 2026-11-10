# MeraCEO

Mobile-first advisory marketplace for business owners and professionals. Layout and task order follow `MeraCEO_Implementation_Plan.md` (v2).

## Start here

Read [docs/CODE-GUIDE.md](docs/CODE-GUIDE.md) first. It says where each thing goes and how to make common changes.

## Layout

```
apps/mobile/        The phone app (Expo Router; screens in app/, code in src/)
apps/api/           The server (Fastify, MongoDB, Google sign-in, upload links)
packages/shared/    Rules shared by app and server (enums, form rules, request status rules)
docs/               DECISIONS.md, CODE-GUIDE.md, and later legal/ and QA.md
```

## Commands

```sh
pnpm install          # from the repo root
pnpm check            # typecheck + lint + unit tests (definition of done)
pnpm --filter @meraceo/mobile web
pnpm --filter @meraceo/mobile android
```

Copy `apps/mobile/.env.example` to `apps/mobile/.env` and fill in the local Supabase values. Never put a service-role key in any `EXPO_PUBLIC_` variable.

## Status

- W1-07 (Expo app, monorepo, checks): done
- W1-08 (design tokens and base components): done, verified in browser at phone width in light and dark
- W1-09 (schema v1): migration written and applied to PGlite (16 tables, RLS off). Real `supabase db reset` pending Docker and Supabase CLI
- W1-12 (app on simulators): Android build in progress. iOS needs full Xcode, which is not installed

Open owner decisions are in `docs/DECISIONS.md`.
