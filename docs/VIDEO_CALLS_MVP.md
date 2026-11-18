# One-to-one video calls (MVP)

The chat camera button starts a direct call attached to an accepted consultation request. The API checks the two request participants, stores a short-lived invitation, and creates Agora RTC tokens. The app never receives the Agora App Certificate.

## Provider setup

Create an Agora RTC project with token authentication enabled. Add these API environment variables in local development and in the staging API service:

- `AGORA_APP_ID`
- `AGORA_APP_CERTIFICATE`

The app reports that calling is not configured until both values are present. Keep the certificate only in the API's secret environment; do not add it to Expo variables or source control.

## Device build and demo

`react-native-agora` includes native code, so use a rebuilt Expo development or preview APK rather than Expo Go. The app requests camera and microphone access when the person joins. Test with two signed-in accounts on an accepted conversation, using the USB-connected phone and Android emulator.

The recipient sees an incoming-call screen while the app is open and the conversation is being polled. Background ringing and push notifications are not included in this first pass. Call invitations expire after one minute if unanswered; accepted sessions expire after two hours. Recording and call history are not included.


## App-wide incoming calls and ringing

The root layout mounts `IncomingCallListener` inside the session provider. While signed in and foregrounded, it polls `GET /me/calls/incoming` every three seconds and immediately on app resume. The API returns only an unexpired ringing invitation addressed to the authenticated user. No open chat is required. The listener skips call routes and suppresses repeated navigation for the same invitation. Logout and unmount cancel polling and ignore stale responses.

The incoming screen loops the bundled `assets/incoming-call.wav` tone and vibrates. Answering, declining, expiry, leaving the screen, or backgrounding stops feedback. Sound follows device volume and platform audio policy. This is foreground ringing; background/terminated delivery and lock-screen call UI require push/native calling support later.

`expo-audio` adds a native module: rebuild and reinstall development APKs on both devices after this update. Existing Agora credentials remain server-side. Verify calls from dashboard, settings, and chat; answer/decline and allow timeout; confirm ringing stops and repeated polls do not open duplicate screens. The ended screen uses existing theme tokens, participant context and a full-width Back action.
