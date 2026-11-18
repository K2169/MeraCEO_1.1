# MeraCEO

Mobile-first advisory marketplace for business owners and professionals. Product scope and release gates follow [docs/IMPLEMENTATION_PLAN.md](docs/IMPLEMENTATION_PLAN.md), aligned with Master PRD V3.

## Start here

Read [docs/CODE-GUIDE.md](docs/CODE-GUIDE.md) first. It says where each thing goes and how to make common changes.

Read [docs/IMPLEMENTATION_PLAN.md](docs/IMPLEMENTATION_PLAN.md) for the current product scope, release gates, and work order.

## Layout

```
apps/mobile/        The phone app (Expo Router; screens in app/, code in src/)
apps/api/           The server (Fastify, MongoDB, Google sign-in, upload links)
packages/shared/    Rules shared by app and server (enums, form rules, request status rules)
docs/               implementation plan, decisions, code guide, handoff, legal/ and QA materials
```

## Commands

```sh
pnpm install          # from the repo root
pnpm check            # typecheck + lint + unit tests (definition of done)
pnpm --filter @meraceo/mobile web
pnpm --filter @meraceo/mobile android
```

Copy `apps/mobile/.env.example` to `apps/mobile/.env` and set the API URL and public Google client ID. Configure MongoDB, session signing, Google audience, and S3-compatible storage secrets only in the API environment. Never put server secrets in an `EXPO_PUBLIC_` variable or commit them.

## Project status

- Current scope and work order: [docs/IMPLEMENTATION_PLAN.md](docs/IMPLEMENTATION_PLAN.md)
- Implementation status and known gaps: [docs/HANDOFF.md](docs/HANDOFF.md)
- ClickUp task snapshot: [docs/CLICKUP_TASKS.md](docs/CLICKUP_TASKS.md), collected 2026-11-11
- Open owner decisions: [docs/DECISIONS.md](docs/DECISIONS.md)
