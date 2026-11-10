import * as SecureStore from 'expo-secure-store';

// Session token lives in the device keychain / keystore, never in plain storage or logs.
const KEY = 'meraceo.session';

// Saves the session token in the phone secure storage.
export async function saveSessionToken(token: string): Promise<void> {
  await SecureStore.setItemAsync(KEY, token);
}

// Reads the saved session token, or null if there is none.
export async function loadSessionToken(): Promise<string | null> {
  return SecureStore.getItemAsync(KEY);
}

// Deletes the saved session token (sign out).
export async function clearSessionToken(): Promise<void> {
  await SecureStore.deleteItemAsync(KEY);
}
