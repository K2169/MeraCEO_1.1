# Working Professional Onboarding Implementation Plan

**Status** · P1A–P1D and P1C-to-P4 availability wiring are implemented. Shared/API/mobile typechecks, lint, and shared/API tests pass. A synthetic-data emulator walk reached all four sections and verified Edit → Continue returns to review; real signup submission and full visual/accessibility acceptance remain open.

**Source** · [MeraCEO Master PRD V3 Consolidated](/Users/salman/Downloads/MeraCEO_Master_PRD_V3_Consolidated.pdf), PDF pages 13 and 40–45. P1 (welcome) and P2 (login) lead into the journey. The four registration steps are P1A–P1D. Successful registration leads to P3.

## Routing adjustment · Remove the standalone DOB page

- Delete `/age` and route users to their selected role's onboarding when DOB is missing.
- Keep the server age check and underage block. The professional enters DOB inline in P1A; the owner enters DOB inline in the owner "About you" step. Set the server role only after the age check succeeds.
- Keep DOB out of profile payloads, drafts in ordinary storage, public responses, and logs. Any retry draft is stored in SecureStore under the signed-in user ID and cleared after the server responds.
- Do not change `/age-blocked`; it is the underage outcome, not a DOB collection page.

## DOB input refinement · Calendar picker

- Keep DOB inline in professional P1A and owner "About you"; add one shared calendar picker component to both.
- Display and persist the existing `DD/MM/YYYY` format. Calendar selection must continue through the current server age-verification call and must not bypass date validation.
- Provide month navigation and a fast year jump so older birth dates do not require hundreds of taps. Restrict future dates and dates before 1900.
- Use the existing bottom sheet, icon set, safe-area behavior and theme tokens. Keep screen-reader labels and a typed-input fallback.
- Review the picker on the emulator after reload; preserve the existing completed-age confirmation and profile-edit behavior.

## P1A–P1D navigation refinement · Tappable stepper

- Replace the professional form's compact count/progress header with four labeled stages: Personal Details, Professional Information, Expertise & Availability, and Review & Submit.
- Let users select the current or any previously completed stage. Keep future stages visibly unavailable until required fields are valid and the P1A age check has succeeded.
- Preserve every draft value and keep Review-card Edit actions returning to P1D after the edited stage is continued.
- Use theme tokens, clear selected/completed/future states, accessible step names and state, and touch targets suitable for mobile.

## P1A discreet mode and display name

The approved P1A artwork on consolidated PRD page 41 shows required **Discreet Mode (Yes/No)** and **Display Name** controls. Add both to Personal Information and the P1D review. The functional text does not define the privacy behavior, so this implementation uses the explicit, user-visible rule below:

- Require an explicit Yes/No choice for new registration and a non-empty display name (2–80 characters).
- When Yes is selected, owner-facing discovery cards, public professional profiles, owner request/consultation summaries, and notifications use the display name instead of the full name. Do not return the full name on those surfaces.
- When No is selected, those surfaces use the full name. Keep the display name saved so the user can switch modes later without re-entering it.
- Discreet mode does not hide the profile from discovery. The separate matching consent and moderation/availability eligibility continue to control discoverability. Emails, phone, LinkedIn and DOB remain private in either mode.
- Keep fields optional in the shared base schema for legacy profiles; require them in new Professional registration. Legacy records without these fields retain their current display behavior.
- Use localized labels/help text, theme tokens, visible field errors and an accessible yes/no control. Preserve saved drafts and expose values in review/edit.

## Step validation feedback

- Keep Next/Submit actionable whenever the form is not saving. Pressing it validates the current stage and displays field-level errors instead of trapping the user behind a disabled action.
- Keep future stepper stages locked until validation and any P1A age check succeed. While saving, disable navigation and the action button.
- When loading a saved weekly availability window, derive the legacy `days` array from its window days; show inline errors for every required P1C selection so validation cannot look like an unresponsive button.
- Cap multi-selects where the PRD/schema defines a maximum and explain that limit in the field error.

Review and implement the sections in order, starting with P1A. Build and review the complete four-step flow before deciding whether any section needs smaller screens.

## Execution decisions for the complete four-section pass

1. **P1A** · Keep DOB inside Personal Information and retain the server age check. Keep an unsubmitted DOB draft in SecureStore, clear it after the server responds, and show a completion message when already verified. The separate `/age` route must not intercept the professional flow. Gender remains deferred pending its purpose and retention decision in `docs/DECISIONS.md`.
2. **P1B** · Keep the current qualification field and legacy free-text history readable. Add repeatable employment entries (role, organization, start/end month, current role), education entries (qualification, institution, field, completion year), and certification entries (name, issuer, year). Added credentials are self-reported; verification remains a separate workflow and no verification badge is inferred.
3. **P1C** · Keep the existing fee-band scale and consultation formats. Add duration choices of 30, 60, and 90 minutes; weekly availability windows with day, start, end, and an IANA timezone; advisory industries from the shared industry taxonomy; and optional preferred business team-size and revenue bands using the existing owner taxonomies. Validate window ordering, overlap, timezone pairing, and day consistency. Matching may use advisory-industry and preferred-business fit as explainable signals; preferences never exclude a professional by themselves. P4 offers 30-minute-aligned starts inside saved windows, in the professional's timezone, that fit the saved duration; the API enforces the same window and start-time checks.
4. **P1D** · Review all answers grouped by P1A, P1B, and P1C with labeled Edit actions that return to the source section. Keep the required disclaimer and terms choices. Record the required terms and optional consent choices with a stable, user-scoped draft-persisted idempotency key; preserve the draft after an ambiguous failure and block repeated submit taps. New professionals remain marked pending review and are told so after submission.
5. **Compatibility** · Keep new contract fields optional where needed to read older profile records. The new registration UI enforces its complete required inputs. Preserve old profile fields and local drafts during migration; do not expose contact details, DOB, or unverified credentials through public routes.

### Remaining acceptance items

- Decide whether P1A collects gender and define its purpose, options, requiredness, and retention before adding it. The PRD names gender, while the existing decision log defers collection for legal review.
- Reconcile P1A contact requiredness: the PRD artwork marks mobile number and email required; the app gets verified email from the signed-in account but currently treats phone as optional.
- Confirm whether P1C uses the current fee band or the per-hour INR amount shown in the PRD artwork. The current implementation retains the fee band.
- Confirm the P1C taxonomy mapping: the PRD calls out advisory areas and its artwork also shows business functions and an expertise summary. The app has expertise and industries-advised controls, but no separate business-functions control or P1C summary field.
- Decide whether pending-review status must appear immediately on P1D's submit confirmation; it currently appears on the destination professional dashboard when the API returns `pending_review`.
- Review the P4 picker on device. Legacy profiles without structured windows, timezone, and duration cannot be booked through the new picker until updated. Slots start on 30-minute boundaries; DST gap times are omitted and repeated fall-back times appear once. Slot locking and collision prevention are outside this change.
- Add loading and recoverable initialization-error states while the professional draft loads; the current screen renders nothing until loading finishes.
- Exercise consent idempotency against MongoDB as well as the in-memory API tests, including concurrent duplicate writes.
- Match the approved page 41–44 visual hierarchy and artwork. The current four screens show compact step headers and scrollable forms; they do not show the PRD's professional hero artwork.
- Finish device acceptance with keyboard, safe areas, both themes, English/Hindi, validation errors, and a resumed real signup draft. The synthetic-data preview verified navigation and Edit roundtrip without submitting. The standalone `/age` collection route has been removed; reinstall before device review so stale installed JavaScript cannot keep rendering that route. A fresh install returns to Welcome until a role is selected and authenticated.

## 1 of 4 · P1A Personal Information

### P1A implementation decisions for this pass

The functional specification on PDF page 41 is the source of truth for this section. The artwork contains some additional sample fields; those do not become requirements unless the functional specification or an approved product decision calls for them.

| Field | P1A treatment | Validation and privacy |
| --- | --- | --- |
| Name | Editable and prefilled from the authenticated account only when the draft is blank | Required by the existing profile contract; preserve user edits |
| DOB | Enter here when no age decision exists; otherwise show the completed age-check state | Submit to the existing server age endpoint before moving to P1B. Never add the DOB to the profile, public payloads, or logs |
| Gender | Required for new Professional registration | Use the existing gender options and localized labels; saved profile edits may retain legacy values |
| Discreet mode and display name | Require Yes/No and a 2–80 character display name for new registration | When Yes, use the display name on owner-facing surfaces; when No, use the full name. Keep matching consent as the separate discovery control |
| Contact | Show verified Google account email read-only; allow an optional phone number | Account email stays private. Do not treat an unverified phone as verified |
| Location | Country, applicable state, and city using the existing location control | Country and city required by the current profile contract; state only when applicable |
| LinkedIn/social | Keep LinkedIn optional in this pass | Match current schema's LinkedIn validation; do not accept arbitrary social URLs until scope is agreed |

Qualification belongs in P1B per its functional specification. The P1A artwork also includes display name and discreet mode; their behavior is defined in the decision above. The optional existing profile photo remains an app-specific convenience, separate from the PRD fields.

### P1A screen behavior

1. Keep the four sections P1A–P1D unchanged. P1A contains its own DOB input when age has not yet been confirmed; do not route a professional through a separate DOB page.
2. Continue is enabled only when the profile fields required by the existing contract are valid and, for a new age check, a valid DOB has been provided. The server remains the authority for age eligibility.
3. If the server confirms an underage account, route to the existing blocked state. On network failure, retain the draft and show a recoverable inline error.
4. Save draft changes locally as they are made. Reopening P1A must preserve edits and must not replace a user's name with the Google name.
5. An account with a completed age check sees a short confirmation state, not the full DOB repeated on screen.

P1A review checklist: match the page 41 hierarchy, confirm all fields and errors are visible with the keyboard open, check safe areas and both themes, and verify that age-check failure does not lose the draft.

| PRD field | Current app | Implementation |
| --- | --- | --- |
| Name | First step | Move into P1A. Allow correction before submit. |
| Date of birth | Inline field in P1A when no age decision exists | Securely retain an unsubmitted draft; submit through the server age gate before continuing. Do not repeat the full DOB on P1D or expose it publicly. |
| Gender | Not collected | Deferred pending a documented purpose, options, requiredness, and retention decision. |
| Contact | Verified Google account email is read-only; phone is optional | Keep account email and unverified phone private. The visual reference marks both mobile and email required; phone requiredness remains to be reconciled. |
| Location | Country and city, with state where supported | Reuse `LocationFields` and preserve its hierarchy and validation. |
| LinkedIn/social profile | Optional LinkedIn in step 2 | Move into P1A. Confirm whether other networks are supported before broadening URL validation. |

The current optional photo is an existing app field. Review it as an extra alongside the P1A fields. Validate before Continue and retain the draft when navigating back. Keep DOB and contact out of discovery and request payloads. If consent or field collection changes, review the matching notice before release.

## 2 of 4 · P1B Professional Information

| PRD field | Current app | Implementation |
| --- | --- | --- |
| Designation, organization, experience | Designation, company, years and experience summary across steps 3–4 | Group these in P1B. Keep the current headline, employment type, work industry and skills visible in the field review as existing app fields. |
| Employment history | Legacy free-text and repeatable structured entries | Structured role, organization, start/end month, and current role; validate date order and preserve legacy text. |
| Education | Qualification selector | Qualification plus repeatable institution, field, and completion-year entries. |
| Certifications | Distinct repeatable self-reported entries | Credential, issuer, optional year; verification is a separate workflow and no badge is inferred. |

## 3 of 4 · P1C Expertise and Availability

| PRD field | Current app | Implementation |
| --- | --- | --- |
| Expertise, advisory areas, industries | Expertise chips and work industry. The schema accepts advisory industries but the form cannot set them. | Use the shared marketplace taxonomy. Map expertise and advisory areas to the taxonomy before deciding if they need separate controls. Add an advisory-industry selector separate from work industry. |
| Consultation mode and duration | Format chips; no duration | Reuse the existing modes and collect 30, 60, or 90 minutes. The duration is shown on public professional detail. |
| Availability | Days and optional free-text slots | Collect structured weekly windows and timezone, retain legacy text, and validate interval overlap and day consistency. P4 uses those values for slot generation and API schedule validation. |
| Fees | Existing fee band | Current fee-band behavior is retained; confirm whether the PRD artwork's per-hour INR amount is the intended pilot model. |
| Preferred business profile | No field | Optional team-size and revenue bands feed an explainable, non-exclusive match signal. |

The shared schema and registration form now implement the selected requiredness and option lists recorded above. Confirm that the expertise/industries controls fully represent PRD advisory areas, then add the separate business-functions and expertise-summary fields if they are required by the approved visual specification. Basic onboarding preferences feed the profile; booking now uses structured availability, while slot locking and payment follow their own release decisions.

## 4 of 4 · P1D Review and Submit

- Show each section's answers in readable groups. Give each group an Edit action that returns to its source section, preserves answers and returns to review after validation. Keep sensitive information private and present the DOB check without repeating the full date unless its display is agreed.
- Reuse the consent controls. Reconcile the review checkboxes with the separate consent screen. The backend must record acceptance, notice version and time against the appropriate submission, with a single record per submission and notice.
- Block repeated taps while submitting. Add server-side idempotency for registration writes and consent side effects, with a stable key reused after an ambiguous network failure. Preserve the draft on failure and clear it after successful registration. Keep profile editing on its existing authenticated path.
- Use the actual verification state from the server. Show pending verification when applicable and continue to P3 after successful registration and any required consent.

## Design tokens and components

Use `apps/mobile/src/components/theme.ts` through `useTheme()`. Use `Screen` and `ScrollBody` for safe areas, keyboard behavior and a scrollable form above the pinned footer. Use `StepIndicator`, `Input`, `SelectField`, `OptionChips`, `Checkbox` and `Button` where their existing behavior fits. Use the shared icon component for icons.

| Purpose | Token |
| --- | --- |
| Page and input or review surface | `colors.background`, `colors.surface`, `colors.border` |
| Titles, section headings and field values | `type.title`, `type.heading`, `type.body` with `colors.text` |
| Progress count, helpers and field labels | `type.caption` with `colors.muted` where contrast holds |
| Primary action and edit link | Shared `Button` for `colors.primary` and `colors.primaryText`. Check link contrast on its actual surface. |
| Errors and verification status | `colors.danger` for errors, `colors.warning` for pending and `colors.accentText` for success, paired with explicit text |
| Layout | `space.xs` for title and helper, `space.sm` for close pairs, `space.md` between fields, `space.lg` between groups, `radius.md` for review surfaces |

Use the existing DM Sans text styles and theme palettes for both modes. Keep translated text in `en.json` and `hi.json`. Avoid inline hex values, custom font sizes and raw spacing values. Keep labels visible and show field errors beside their inputs. Give Edit actions a label that identifies the section, with a target of at least 44 × 44. Let long values and translated labels wrap.

### Snippet · Four stable section IDs

Use section IDs for routing within the form and review links, with the display number derived from the order. Resolve any stored legacy numeric positions explicitly.

```ts
const professionalSections = ['P1A', 'P1B', 'P1C', 'P1D'] as const;
type ProfessionalSection = (typeof professionalSections)[number];

const sectionTitle = {
  P1A: 'pro.registration.personal',
  P1B: 'pro.registration.professional',
  P1C: 'pro.registration.expertiseAvailability',
  P1D: 'pro.registration.review',
} as const satisfies Record<ProfessionalSection, string>;
```

### Snippet · Token-based section header and P1A fields

This fragment belongs inside the existing form shell. It uses the proposed title keys and the existing field components. Other P1A fields follow the field decisions above.

```tsx
const { colors, space, type } = useTheme();
const current = professionalSections.indexOf(section) + 1;

return (
  <View style={{ gap: space.lg }}>
    <View style={{ gap: space.sm }}>
      <Text style={[type.caption, { color: colors.muted }]}>
        {t('common.step', { current, total: professionalSections.length })}
      </Text>
      <StepIndicator current={current} total={professionalSections.length} />
      <Text accessibilityRole="header" style={[type.title, { color: colors.text }]}>
        {t(sectionTitle[section])}
      </Text>
    </View>
    <View style={{ gap: space.md }}>
      <Input
        label={t('pro.name')}
        value={draft.name ?? ''}
        onChangeText={(name) => update({ name })}
        error={errors.name}
      />
      <LocationFields value={draft} onChange={update} errors={errors} />
    </View>
  </View>
);
```

## Implementation order and acceptance

1. **P1A** · Inline DOB with server age verification; name, private account email, phone, location, and optional LinkedIn.
2. **P1B** · Existing professional details plus repeatable employment, education, and self-reported certification entries; legacy history remains readable.
3. **P1C** · Shared taxonomy, structured time windows and timezone, duration and fee band; advisory and business-profile preferences feed matching.
4. **P1D** · Grouped review and edit, required terms/disclaimer, optional consent choices, retry-safe submit, and pending-review status.
5. **Review all four steps** · Walk registration and profile edit paths. Check secure DOB draft recovery, back/edit behavior, device/server validation, and retry after network loss. Check small phones, keyboard and safe areas, larger text, screen reader labels, English/Hindi, both themes, older profiles and legacy drafts, and public privacy. Review step burden before proposing mini steps.

Main implementation references are `apps/mobile/src/features/onboarding-pro/professional-onboarding.tsx`, `apps/mobile/src/features/auth/progress-store.ts`, `packages/shared/src/schemas/onboarding.ts` and the `/me/profile` and consent handlers in `apps/api/src/app.ts`.

## Approved gender/contact/fee update · 2026-11-18

Ask gender in P1A, with an explicit Prefer not to say choice; require selection for new registrations and preserve legacy profile-edit compatibility. Gender is private. Owner S1B uses the same options. Phone and PAN/GST remain optional and existing fee bands remain approved. Earlier gender deferral and contact/fee decision questions above are superseded.
