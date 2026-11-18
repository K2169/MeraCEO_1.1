# P2 Professional Login — implementation plan

**Source:** MeraCEO Master PRD V3 Consolidated, page 45 (P2 visual and acceptance) and page 13 (authentication behavior). The product-provided P2 reference is the visual baseline.

## Screen structure

1. Use the approved P2/S2 hero artwork embedded in the consolidated PRD. Render only its top hero region with a top-aligned cover crop; preserve the source aspect ratio and the exact approved “Welcome Back” copy.
2. Keep the role toggle directly below the artwork; highlight Professionals using the existing green role token and preserve Business Owner as the alternate role.
3. Add mobile number or email and password fields. The password field has a visibility toggle and autofill hints.
4. Place “Forgot password?” below the password field, then the primary Login action.
5. Add the outlined “Login via OTP” action and the Google sign-in option as an alternate route.
6. Keep content within safe areas, use existing semantic spacing, radius, type, and color tokens, and allow vertical scrolling when the keyboard or accessibility text scale needs it.

## Interaction and initial API boundary

- Google authentication is already implemented in `src/features/auth/google-sign-in.ts` and `POST /auth/google`; reuse its ID-token verification, session storage, and session routing.
- The current API has no password login, password reset, OTP request, or OTP verification endpoints, and the application has no configured email/SMS delivery service. Do not fake a successful credential or OTP login. Keep those actions visible to match P2, but return a clear, non-account-enumerating “not available yet; use Google” message until the server flows exist.
- Preserve selected role intent before authentication. Do not grant access based on the local role toggle; the authenticated server profile remains authoritative.
- Show loading, cancellation, and generic authentication failure states. Never display token or raw provider errors.

## Follow-up: password login and Google data in onboarding

The owner has now requested email-or-mobile plus password login, and Google name/email prefilling. Update this plan before implementing the credential API:

**Deferred by owner:** OTP login, email verification, SMS verification and password recovery remain “Coming soon.” Do not select or configure delivery providers as part of the current work. Resume these flows after the onboarding screens are reviewed.

1. **Private account fields:** return `email` alongside `name` only from the authenticated self-session payload (`POST /auth/google`, `GET /me`, and self-only updates). Keep it out of public profile/search/list responses and redact it from logs.
2. **Onboarding prefill:** add a read-only verified Google email field to the personal/contact onboarding step for each role. Seed the professional `name` and owner `ownerName` only when the local draft has no value. Preserve user edits and existing drafts. Google does not supply a verified mobile number, so never infer or prefill `phone` from Google.
3. **Password login:** add a server-side password verifier for a normalized email or verified mobile identifier. Store only a salted password hash, return the same generic error for unknown identifiers and wrong passwords, rate-limit attempts, and issue the existing session token only after verification. Never accept a client-selected role as authorization.
4. **Credential provisioning:** a password login endpoint alone cannot serve anyone until there is a safe way to create or set a password. Keep credential provisioning, verified ownership, OTP, email/SMS delivery and password recovery deferred while the onboarding screens are reviewed. Do not claim password authentication works until account provisioning and verification are implemented end to end.

### Updated acceptance

- Email and mobile/password login only succeed for an account with a securely provisioned password and a verified identifier.
- Invalid credentials return a generic error; rate limits apply before account lookup can be abused.
- The current user's verified Google email and name are available to onboarding; email stays private and profile drafts are not overwritten.
- OTP, email verification, SMS verification and password recovery are clearly marked “Coming soon” and are not presented as active flows.
- Password authentication is not marked complete until credential setup and account lookup are implemented end to end.

## Token and component usage

### P2 spacing and CTA consistency

- Use `space.md` between the major content groups, credential fields, and stacked CTA group so the owner hero and all actions fit on a Pixel 6 at normal text size.
- Keep the three P2 actions at a shared 48 px minimum height and `radius.pill`. Google sign-in stays outlined with its official mark, but uses the same outer radius as Login and OTP.
- Keep the 44 px password visibility hit target and preserve the safe-area-aware, scrollable screen shell.
- Keep role layouts exactly aligned: reserve a shared `900 / 680` hero frame and top-align both images. The owner artwork uses the full frame to reveal its welcome heading; crop the Professional artwork to `900 / 640` inside the same frame to keep its embedded selector out of view. Do not add a role-only heading block below the artwork. Role changes must not shift the form or CTA positions.

```tsx
const { colors, radius, space, type } = useTheme();
<View style={{ backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.md }} />
<Text style={[type.body, { color: colors.text }]} />
```

Use `Button`, `GoogleButton`, `Icon`, `Input`, `useTheme`, and `useSafeAreaInsets`; avoid screen-local hex colors or one-off type sizes. Add only missing semantic tokens to `src/components/theme.ts` if the reference cannot be represented by existing tokens.

## Acceptance checks

- P2 is reachable from the professional Log in action and restores the role toggle on return.
- Google sign-in completes through the existing verified API flow and routes by the authenticated account state.
- Password/OTP actions never imply success without a supporting server flow; errors are generic and actionable.
- Password visibility toggle exposes its state to accessibility services; input fields support email/phone and password autofill.
- Layout respects safe areas and remains usable with the keyboard open and larger text.
- Run mobile typecheck and lint; reload the Android emulator and inspect P2.
