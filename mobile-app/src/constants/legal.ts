import Constants from 'expo-constants';

/** Public privacy policy URL (required by Google Play; also linked in-app). */
export const PRIVACY_POLICY_URL =
  (Constants.expoConfig?.extra as { privacyPolicyUrl?: string } | undefined)?.privacyPolicyUrl ??
  'https://hindipdfeditor.com/privacy/';

/** App version string shown in About (matches app.config.ts `version`). */
export const APP_VERSION = Constants.expoConfig?.version ?? '1.0.0';

/** Play Store listing for rate/share prompts (set after first publish). */
export const PLAY_STORE_URL =
  Constants.expoConfig?.android?.playStoreUrl ??
  'https://play.google.com/store/apps/details?id=com.manisense.hindipdfeditor';
