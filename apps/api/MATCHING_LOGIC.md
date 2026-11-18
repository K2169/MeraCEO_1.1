# MeraCEO matching logic

This document describes the matching behavior currently implemented in the app. It is the place to discuss and record proposed rule or weight changes before implementing them. Editing this Markdown file alone does **not** change runtime behavior; the scoring implementation is shared by the API and app in `packages/shared/src/matching.ts`.

## Short version

- A Professional needs to share at least one expertise area with the Owner's need to receive a positive score. Without shared expertise, the score is `0`, even if industry, budget, or format match.
- The score starts with up to 60 points for expertise coverage, then adds points for industry, budget, consultation format, and optional business-stage preferences.
- Only approved, available Professionals who have not opted out of match suggestions enter the Owner-facing candidate pool.
- The Professional opportunity feed scores open Owner needs against that Professional's profile. A positive score is required for an opportunity to appear.
- This is deterministic rules-based ranking. There is no AI, machine learning, distance calculation, or score learning from user actions.

## Scoring formula

The implementation is `matchProfessional()` in [`packages/shared/src/matching.ts`](../packages/shared/src/matching.ts).

| Signal | Points | When it applies |
| --- | ---: | --- |
| Shared expertise | Up to 60 | Required. `60 × (shared expertise count ÷ need expertise count)`, rounded to the nearest integer |
| Industry | 20 | Professional's primary industry equals the need's industry, or the need's industry appears in `industriesAdvised` |
| Budget | 15 | The Owner supplied a budget band and the Professional's fee band is at or below it |
| Consultation format | 5 | The need has a format and the Professional offers that format |
| Business profile preference | 5 bonus | The Owner's team size **or** revenue band appears in the Professional's corresponding preference list |

The final result is capped at 100. The base weights add to 100; the optional business profile bonus can take the uncapped total to 105.

The band order is declared in [`packages/shared/src/enums.ts`](../packages/shared/src/enums.ts): `low < mid < high`. Therefore, a `mid` fee fits a `mid` or `high` budget, but not a `low` budget. If the need has no budget, this signal adds no points; it does not disqualify the Professional. Format behaves similarly: a missing format adds no points.

### Example

An Owner need asks for three expertise areas. A Professional shares two, has a matching industry, fits the budget, offers the requested format, and has a matching team-size or revenue preference:

```text
Expertise: 60 × 2/3 = 40
Industry:                       +20
Budget:                         +15
Format:                          +5
Business profile preference:    +5
Total:                           85 / 100
```

The returned explanation includes the reasons that contributed and the exact shared expertise IDs. A score of zero has no match reasons.

## Candidate eligibility and consent

Owner-facing candidate routes use `matchablePool()` in [`apps/api/src/app.ts`](src/app.ts), backed by `listMatchable()` in [`apps/api/src/profiles/repository.ts`](src/profiles/repository.ts):

1. The profile must belong to a Professional.
2. Moderation must be `approved`.
3. The Professional must be marked available.
4. The latest matching consent must not be `false` (a missing choice currently defaults to eligible).

The consent check also protects direct owner profile access and new saves. When a Professional opts out, their existing saved-professional entries are deleted. Discreet Mode affects the name displayed to Owners; it does not turn matching on or off. Matching consent controls that separately.

An Owner's need must be open to enter the Professional opportunity feed. Closed needs do not appear there.

## Where each direction uses matching

All routes below are registered in [`apps/api/src/app.ts`](src/app.ts).

### Owner finds Professionals — `GET /me/professionals`

- Scores each eligible Professional against the Owner's selected open need (`needId`) or, when none is selected, each of the Owner's open needs.
- Uses the highest score across those needs for that Professional.
- Applies optional search/filter parameters before returning results: text, expertise, industry, fee, format, configured availability, and saved-only.
- Text search checks every query word against the displayed Professional name, headline, experience summary, city, and state.
- Industry filter accepts the Professional's primary industry or an advised industry. Fee filter accepts the selected fee band or a lower one. Format requires that offered format. `availability=configured` checks for a valid timezone, duration, and structured weekly windows; it does not check whether a specific appointment slot is free.
- Sorts by score descending, then displayed name, then ID, and returns at most 50.
- **Current behavior to be aware of:** this general Discover route can include eligible Professionals with a score of zero (for example, when the Owner has no open needs). They sort below positive scores. The endpoint does not currently remove them by score.

### Owner matches for one need — `GET /me/needs/:needId/matches`

- Scores the eligible pool against that one Owner-owned, open need.
- `rankMatches()` removes score-zero results, sorts by score descending, then ID.

### Professional sees Owner opportunities — `GET /me/opportunities`

- Loads open needs, newest first; the repository currently limits this list to 200.
- Scores each need against the signed-in Professional's expertise, industry/advised industries, fee band, formats, and business-stage preferences compared with the Owner profile.
- Optional expertise and industry filters apply to the need; text search checks need title, challenge, and business name.
- `rankMatches()` removes score-zero needs and ranks the rest by score descending, then ID.
- This feed scores the signed-in Professional directly; the Owner-facing approved/available/matching-consent pool is not used to decide which opportunities that Professional can see.

### Opportunity detail — `GET /me/opportunities/:needId`

- Recalculates the score for the selected open need.
- Returns `404` when the need is closed/missing, either profile record is missing or has the wrong role, or the score is zero.

## Important distinction: ranking versus requesting

The matching score controls the two ranked feeds above. `POST /me/requests` currently checks that the Owner owns an open need and that the Professional is in the eligible pool, but it does **not** recalculate or require a positive score for that exact need. If product policy should forbid requests without shared expertise, that endpoint needs an additional `matchProfessional(...).score > 0` check. Documenting that policy here does not add the check to code.

## Owner need uniqueness rule

Product rule from the Owner: once a need has been posted, the Owner must not post another need for the same thing. Treat this as a duplicate-need prevention rule, separate from matching scores. A duplicate should not become a second open need that is independently matched to Professionals.

**Current implementation:** the API and Post a need form enforce this rule. The identity is the same Owner plus an open need with a matching title, challenge, industry, and expertise set. Text is Unicode NFKC-normalized, trimmed, lowercased, and whitespace-collapsed; expertise order is ignored. Punctuation is preserved. Budget, format, timeline, and goals do not affect duplicate identity. Closed needs do not block a repost.

The shared comparison helper is `packages/shared/src/needDuplicate.ts`. On the form, when title, challenge, and industry match an existing open need, expertise options already used by that need are greyed out and cannot be newly selected. An already-selected matching option can still be removed. New Mongo records store a SHA-256 `dedupeKey` and a partial unique index prevents concurrent duplicate inserts; records created before this change are compared by their fields. The API returns `409 duplicate_need`, and the form displays a message and disables the Post need/Save changes button when the full duplicate identity matches. This is separate from match scoring and does not use the user's reverse `needs` array; records remain in the `needs` collection linked by `ownerId`.

## Signals not currently included in the score

These fields do not add or subtract score points today:

- Location, distance, or in-person proximity
- Years of experience, job title, employer, education, certifications, or skills
- Availability windows or real-time calendar/slot occupancy (except the Discover filter for configured availability)
- Engagement type, ratings, reviews, response rate, completed work, or past Owner actions
- Business name, business type, sector, or exact currency budget amount
- Discreet Mode (it changes displayed identity only)

Search/filter controls can still use some fields without changing the match score. For example, text search checks city/state and experience, and availability can be filtered to configured schedules.

## What to edit when tuning matching

| Desired change | Runtime source to edit |
| --- | --- |
| Change point weights, match requirements, score cap, or reason signals | `packages/shared/src/matching.ts` |
| Change expertise/industry/fee/format/team-size/revenue identifiers or their order | `packages/shared/src/enums.ts` and the affected validation/localization |
| Change Owner Discover filters, candidate pool, tie-breaks, result limits, consent/availability gates, or request eligibility | `apps/api/src/app.ts` and, for database pool behavior, `apps/api/src/profiles/repository.ts` |
| Change which need fields Owners can provide or which Professional preferences are collected | Shared onboarding/need schemas and their mobile forms; keep the match types and API mapping aligned |
| Change the explanation text shown in the app | `apps/mobile/src/features/needs/match-card.tsx` and the `match.*` translation keys |

After a rule change, update this document to match the new behavior and run the relevant typecheck, lint, and matching/API verification. Keep score explanations aligned with the scoring code so the displayed reasons remain truthful.

## Current implementation limits

- These are heuristic percentages, not calibrated probabilities or guarantees of successful engagement.
- Expertise coverage can produce a score between 1 and 60; a positive result requires at least one shared expertise area.
- Business-profile preference is a single 5-point bonus even if both team size and revenue match.
- The general Discover route's score-zero behavior and the request-creation gap above are implementation details to decide whether to preserve or change.
