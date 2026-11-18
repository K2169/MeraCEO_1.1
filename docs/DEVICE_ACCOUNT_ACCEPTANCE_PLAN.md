# Two-role device account acceptance plan

Date: 2026-11-18

## Objective

Verify populated onboarding, profile, discovery and dashboard states for one real professional account and one real business-owner account on the Pixel 6 emulator. The user authorized using `salman@englishbhashi.com` for Professional and `salman29213@gmail.com` for Business Owner.

## Steps

1. Confirm the two user-selected Google identities are available on the emulator.
2. Register the Professional identity through Google sign-in; complete P1A–P1D with existing profile details and the user's chosen gender value. Submit required legal consents only after the user's explicit acceptance.
3. Verify the saved professional profile, weekly availability, matching opportunities, opportunity detail, requests and profile view load from the API.
4. Sign out of both the app and cached Google session, then register the separate Owner identity; complete S1A–S1D with accurate business/need details and explicit gender selection. Do not invent missing personal or business details. Stop for the user's input where needed and before required legal consent.
5. Verify owner profile, need lifecycle, professional discovery, request/dashboard and account screens load from the API.
6. Record screenshots/results and leave both test accounts intact unless the user requests cleanup.

## Safety and stop condition

- Use only identities explicitly selected by the user; the Professional registration has now been submitted with user-authorized choices.
- Do not use `example.invalid` demo records or fabricated UI fixtures as account acceptance.
- Do not ask the user to send passwords or OAuth credentials. If two Google identities are not already available, pause before account creation and have the user sign into them on the emulator.
- No OTP verification, paid transaction, report submission or external message is part of this acceptance pass.
