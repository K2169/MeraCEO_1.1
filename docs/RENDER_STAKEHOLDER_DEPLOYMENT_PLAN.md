# Render stakeholder deployment plan

Updated: 2026-11-18

## Objective

Expose the MeraCEO MVP API through a Render-hosted staging service so stakeholders can use the mobile app against a stable remote API. This is a staging/demo deployment, not a production launch.

## Current checkout findings

- API: Fastify + TypeScript in `apps/api`; it binds `0.0.0.0` using `PORT` and exposes `GET /health`.
- Runtime: pnpm workspace; the API imports `@meraceo/shared` and uses `tsx` at startup.
- Data and file services are external: MongoDB and S3-compatible storage (Backblaze B2).
- API secrets/configuration are loaded from environment variables. The local `apps/api/.env` is git-ignored and must never be deployed or committed.
- No Render Blueprint/configuration is present in the checkout.
- The working tree had more than 100 changed or untracked paths on `development`; deploy only after an explicit, reviewed commit is prepared. Do not stage or commit the entire working tree as a deployment shortcut.
- No Render account or Render CLI is connected in this session. No Render service has been created, and no source has been pushed.
- Hosting region selected for this staging service: Singapore.

## Implementation sequence

1. Add a Render Blueprint for one API web service, rooted at the monorepo. Use a filtered pnpm install for the API and its workspace dependencies, a start command that reads Render environment variables without requiring `.env`, and `/health` as the health-check path.
2. Define the required environment-variable names as unsynchronized/secrets in Render. Never place credentials in the Blueprint, repository, logs, screenshots, or chat.
3. Verify API tests/typecheck and ensure local API start still works using the ignored local `.env`.
4. Prepare a dedicated deployment commit/branch containing only the reviewed MVP API and deployment configuration. Do not push the current mixed uncommitted working tree wholesale.
5. Connect the reviewed repository to the intended Render account, create the staging service from the Blueprint, and enter the required values in Render's dashboard. Verify health, Google sign-in, MongoDB reads/writes, B2 presigned upload flow, and essential owner/professional journeys.
6. Point a stakeholder build of the mobile app at the Render URL, then run a two-role demo smoke test. Video calling remains a later increment; its LiveKit token endpoint and secrets will be added and redeployed with that feature.

## Render service configuration target

- Runtime: Node.js
- Node: Node 22 (root `engines` range, minimum 22.13)
- Root directory: repository root
- Build command: `pnpm install --filter @meraceo/api... --frozen-lockfile --prod=false`
- Start command: `pnpm --filter @meraceo/api start:render`
- Health check: `/health`
- Plan: free for a short staging preview unless the owner chooses paid compute. Render free services spin down after idle time, so warm the service before stakeholder demos; do not treat free compute as production-ready.

## Required environment variable names

Required now: `MONGODB_URI`, `MONGODB_DB`, `SESSION_JWT_SECRET`, `GOOGLE_WEB_CLIENT_ID`, `S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`. Optional: `GOOGLE_ANDROID_CLIENT_ID`, `GOOGLE_ANDROID_RELEASE_CLIENT_ID`, `SUPPORT_EMAIL`. Render supplies `PORT`.

No values belong in this file. For video calling later, add the LiveKit URL/key/secret only in Render's secret environment settings and only expose short-lived call tokens to authenticated app clients.

## Deployment gates

- Singapore selected as the hosting region.
- The owner's Render account and repository connection are not available from this session yet; no service has been created.
- A reviewed commit contains only intended, verified MVP/API/deploy work; unrelated local changes remain out of the deploy commit.
- All required environment variables are configured directly in Render.
- API health and authentication/data/storage smoke checks pass against the deployed URL.
- Stakeholder mobile build is configured for the hosted API and tested with the demo accounts.
