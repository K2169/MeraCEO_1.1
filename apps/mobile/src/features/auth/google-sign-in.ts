import { GoogleSignin, isSuccessResponse } from '@react-native-google-signin/google-signin';

let configured = false;

// Returns the Google ID token, or null if the person cancelled. The token is sent to our API, which verifies it.
export async function signInWithGoogle(): Promise<string | null> {
  if (!configured) {
    GoogleSignin.configure({ webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? '' });
    configured = true;
  }
  await GoogleSignin.hasPlayServices();
  const response = await GoogleSignin.signIn();
  if (!isSuccessResponse(response)) return null;
  const idToken = response.data.idToken;
  if (!idToken) throw new Error('google_no_id_token');
  return idToken;
}

// Signs the device out of Google.
export async function signOutOfGoogle(): Promise<void> {
  if (!configured) return;
  await GoogleSignin.signOut();
}
