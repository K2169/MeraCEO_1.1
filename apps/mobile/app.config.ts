import type { ConfigContext, ExpoConfig } from 'expo/config';

// Bundle IDs are placeholders until the owner confirms the domain and store listing (W1-02, W2-10).
const BUNDLE_ID = 'com.meraceo.app';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'MeraCEO',
  slug: 'meraceo',
  version: '0.1.0',
  owner: 'shksalman_dev',
  scheme: 'meraceo',
  orientation: 'portrait',
  userInterfaceStyle: 'automatic',
  icon: './assets/images/icon.png',
  ios: {
    bundleIdentifier: BUNDLE_ID,
    supportsTablet: false,
  },
  android: {
    package: BUNDLE_ID,
    adaptiveIcon: {
      backgroundColor: '#FFFFFF',
      foregroundImage: './assets/images/android-icon-foreground.png',
    },
  },
  web: {
    bundler: 'metro',
    output: 'static',
    favicon: './assets/images/favicon.png',
  },
  plugins: [
    'expo-router',
    [
      'expo-image-picker',
      {
        // Shown on iPhone when the photo library opens. Android uses its own photo picker without asking.
        photosPermission: 'Allow MeraCEO to use a photo from your library as your profile picture.',
      },
    ],
    [
      'expo-location',
      {
        // Shown in the system permission prompt. Only used to fill in the user's city.
        locationWhenInUsePermission: 'Allow MeraCEO to fill in your city using your current location.',
        isAndroidBackgroundLocationEnabled: false,
        isAndroidForegroundServiceEnabled: false,
        isIosBackgroundLocationEnabled: false,
      },
    ],
    [
      'expo-splash-screen',
      {
        // Same soft blue-white as the app background, so the splash flows into the first screen.
        backgroundColor: '#F3F7FF',
        image: './assets/images/splash-icon.png',
        // The logo sits in the middle of its square image, so this shows it at about 100dp wide.
        imageWidth: 220,
        dark: {
          backgroundColor: '#1B2330',
          image: './assets/images/splash-icon.png',
        },
      },
    ],
  ],
  experiments: {
    typedRoutes: true,
  },
  extra: {
    eas: {
      projectId: '4969b02f-2a34-4045-90bc-94a72a4a182f',
    },
  },
});
