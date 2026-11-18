# Need duplicate prevention implementation plan

## Product rule

An Owner cannot create a second **open** need for the same underlying request. Compare the same Owner's needs using normalized title, normalized challenge, industry, and the set of expertise IDs (order ignored). Budget, consultation format, timeline, and goals do not make an otherwise identical request distinct. A closed need may be posted again.

## Implementation

1. Add one shared canonical-identity helper so mobile and API use the same normalization and equality rule.
2. Persist a hash of that identity on newly created open need records. Add a partial unique MongoDB index on Owner plus hash for open records. Existing records without the hash remain readable and are checked by the repository before new writes.
3. Enforce duplicate checks in both Mongo and in-memory repositories for create and edit. Return a typed duplicate error and map it to `409 duplicate_need` from the API.
4. Load the Owner's existing needs in the Post a need/edit flow. When title, challenge, and industry match another open need, gray out its used expertise options (while allowing already-selected values to be removed). If the complete duplicate identity matches, show an inline explanation and disable the CTA using the existing disabled-button treatment. Exclude the record currently being edited. Keep the API check authoritative for stale data and concurrent requests.
5. Update English/Hindi copy and the matching/need notes. Run typecheck and lint, restart the backend before emulator reload, and report any device verification limits. Do not change the user-document relationship: needs remain separate records linked by `ownerId`.

## Acceptance

- Same Owner cannot create duplicate open needs through the UI or API.
- Simultaneous duplicate API writes cannot both succeed.
- Another Owner may post the same need.
- Reordering expertise does not bypass duplicate detection.
- An Owner can edit their need without it conflicting with itself.
- Closed needs do not block a later repost.
- Duplicate state greys out the Post need/Save changes CTA and explains how to resolve it.
- Expertise options already used by an open need with the same title, challenge, and industry appear grey and cannot be newly selected; selected values remain removable.
- Older need records without the identity hash continue to participate in duplicate checks.

## Status

Implemented in the shared identity helper, Mongo/in-memory repositories, API create/edit routes, and the Owner need form. Typecheck and lint passed. The backend health check returned 200. On the emulator, matching an existing need's title, challenge, and industry made its unused expertise chips gray and disabled while other expertise remained selectable; tapping a gray chip left it unselected. The exact duplicate draft also showed its warning and disabled gray Post need button in the prior visual check. No need data was submitted or changed. Automated/API end-to-end tests were not run.
