# Consultation slot safety and reschedule approval

Source: Consolidated PRD pages 3, 15, 31, 34, 47.

## Current gap

The schedule endpoint validates availability but calls an unconditional request update. Two simultaneous schedules can overlap. Either participant can replace a scheduled time without counterpart approval. Request status writes are unconditional and can race with scheduling or cancellation.

## Distributed-safe implementation

The existing picker and API use 30-minute-aligned starts and durations 30/60/90 minutes. Represent an occupied consultation as half-open UTC buckets [start,end), e.g. a 60-minute 09:00 consultation reserves 09:00 and 09:30 UTC bucket IDs. Persist all keys on the same request document as scheduledAt, durationMinutes and revision. Use a unique compound multikey index on professionalId + occupiedSlots (partial index for occupiedSlots present). MongoDB validates all keys during one atomic document update; two server processes cannot reserve intersecting buckets. Adjacent bookings do not overlap.

All scheduling/status updates require expected status + revision in their update filter. Duplicate-key becomes slot_conflict; failed compare-and-swap becomes stale_revision. Cancellation releases occupancy in the same document mutation. Completed consultations may retain historical occupancy; future reservations never collide with past buckets. Do not use a process-local mutex as the integrity boundary.

Before enabling the unique index, inventory accepted scheduled legacy requests, derive duration from a consultation snapshot (not today's mutable profile), and backfill occupancy. Existing records without reliable duration need explicit remediation and remain unbookable. Existing overlaps must be resolved before unique-index creation; startup must fail closed if the migration/index is absent. A precise migration is required rather than assuming all old bookings last 60 minutes.

## Counterpart approval

Add scheduleRevision, durationMinutes snapshot, and proposedSchedule { id, startsAt, durationMinutes, proposedBy, basedOnRevision, createdAt }. Proposing a material change does not overwrite scheduledAt or release the old occupancy. Only the other participant can approve/decline the exact proposal ID at its expected revision. On approval, atomically replace scheduledAt, duration and occupied buckets; retain the old schedule and proposal if conflict occurs. On decline, remove only that proposal. Include an immutable revision record/audit event; transaction or embedded bounded revision history must commit together with schedule changes.

Endpoint contracts:
- POST /me/requests/:id/schedule-proposals { startsAt, expectedRevision }.
- POST /me/requests/:id/schedule-proposals/:proposalId/accept { expectedRevision }.
- POST /me/requests/:id/schedule-proposals/:proposalId/decline { expectedRevision }.

Both roles see the old confirmed time plus pending proposed time and proposer. Show approve/decline only to counterpart, and surface conflict/stale errors with reload. Notifications identify the proposal/revision and deduplicate retries. The first schedule should also require counterpart agreement if not part of the original accepted request.

## Required verification

Repository tests: concurrent conflicting schedules yield one winner; adjacent schedules succeed; duration overlap catches unequal start times; stale revision cannot replace schedule; cancellation race cannot resurrect booking; approval conflict preserves old booking; proposer cannot approve own revision. Run Mongo-backed concurrency tests with actual unique index; in-memory tests alone do not establish distributed safety. Device walk covers both roles proposal/approval/decline and refresh consistency.

## Delivery boundary

This is a concrete next implementation batch. No new slot locking or reapproval is claimed implemented by this document. Repository, API, shared contracts, migration and UI must ship together to avoid unsafe partial behavior.

## Implementation continuation

Finish the landed occupancy repository/API integration first. Appointment changes retain the current booked time while a proposed revision awaits the other participant's explicit confirmation. Include revision checks so stale confirmations cannot overwrite newer proposals. Legacy scheduled records without a duration snapshot remain readable but require reviewed migration before rescheduling; do not infer their original duration from an edited profile.

Duplicate request retries also require a database-enforced active need/professional key. Release the key for terminal records and use expected-status checks for request actions, so concurrent cancellation/acceptance cannot revive an outdated request.
