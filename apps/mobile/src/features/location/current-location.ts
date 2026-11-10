import * as Location from 'expo-location';
import { Platform } from 'react-native';

import { matchCountry, matchState } from './places';

// What the phone's position turns into. State may be empty for places without one.
export interface DetectedPlace {
  country: string;
  state: string;
  city: string;
}

// Why a location lookup failed. The screen turns each reason into a friendly message.
export type LocationFailure = 'web' | 'denied' | 'off' | 'no-city' | 'timeout';

export class LocationError extends Error {
  constructor(public reason: LocationFailure) {
    super(reason);
  }
}

// How long to wait for a position before giving up, in milliseconds.
const TIMEOUT_MS = 25000;

// Reads the phone's position. If a fresh reading is refused (for example the user declines
// Google's "Location Accuracy" prompt), fall back to the last position the phone remembers.
async function readPosition() {
  try {
    return await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
  } catch (error) {
    const last = await Location.getLastKnownPositionAsync();
    if (last) return last;
    throw error;
  }
}

// Asks for permission, reads the phone's position and turns it into a country, state and city.
// Throws a LocationError when something goes wrong; the user can always type the city instead.
export async function currentPlace(): Promise<DetectedPlace> {
  // Automatic location only works in the app, not in a web browser.
  if (Platform.OS === 'web') throw new LocationError('web');

  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    // Ask first, before starting the timer, so the permission prompt is never rushed.
    const permission = await Location.requestForegroundPermissionsAsync();
    if (!permission.granted) throw new LocationError('denied');
    if (!(await Location.hasServicesEnabledAsync())) throw new LocationError('off');

    const lookup = (async () => {
      const { coords } = await readPosition();
      const [address] = await Location.reverseGeocodeAsync(coords);
      // Some places have no "city", so fall back to the district or sub-region.
      const city = address?.city || address?.district || address?.subregion;
      if (!city || !address?.country) throw new LocationError('no-city');
      // Use the spelling from our lists, so the pickers show the match as chosen.
      const country = matchCountry(address.country);
      return { country, state: address.region ? matchState(country, address.region) : '', city };
    })();
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new LocationError('timeout')), TIMEOUT_MS);
    });
    return await Promise.race([lookup, timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
