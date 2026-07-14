import type { ExpoConfig } from 'expo/config';

/**
 * Single source of truth for Expo / EAS / Play Store metadata. EAS Build runs `expo prebuild`
 * from this file on every production build — do not duplicate version codes in Gradle by hand.
 */
const config: ExpoConfig = {
  name: 'Hindi PDF Editor',
  slug: 'hindipdfeditor',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'light',
  scheme: 'hindipdfeditor',
  android: {
    package: 'com.hindipdfeditor.app',
    versionCode: 3,
    adaptiveIcon: {
      backgroundColor: '#1843DD',
      foregroundImage: './assets/android-icon-foreground.png',
      backgroundImage: './assets/android-icon-background.png',
      monochromeImage: './assets/android-icon-monochrome.png',
    },
    // Play Store: only declare what we need. Document picker uses the system SAF on Android 13+
    // and does not require broad storage permissions. Block permissions added by transitive deps.
    permissions: ['INTERNET', 'VIBRATE'],
    blockedPermissions: [
      'android.permission.SYSTEM_ALERT_WINDOW',
      'android.permission.READ_EXTERNAL_STORAGE',
      'android.permission.WRITE_EXTERNAL_STORAGE',
      'android.permission.RECORD_AUDIO',
      'android.permission.CAMERA',
    ],
    playStoreUrl: 'https://play.google.com/store/apps/details?id=com.hindipdfeditor.app',
  },
  plugins: [
    [
      'expo-splash-screen',
      {
        image: './assets/splash-icon.png',
        imageWidth: 200,
        resizeMode: 'contain',
        backgroundColor: '#1843DD',
      },
    ],
    'expo-status-bar',
    'expo-asset',
    'expo-sharing',
    'expo-font',
    'expo-secure-store',
    [
      'expo-build-properties',
      {
        android: {
          minSdkVersion: 24,
          enableMinifyInReleaseBuilds: true,
          enableShrinkResourcesInReleaseBuilds: true,
          extraProguardRules: [
            '-keep class com.google.mlkit.** { *; }',
            '-keep class com.google.android.gms.** { *; }',
            '-keep class expo.modules.** { *; }',
            '-keep class com.facebook.react.turbomodule.** { *; }',
          ].join('\n'),
        },
      },
    ],
  ],
  extra: {
    eas: {
      projectId: '4dfa75b3-300a-4f72-bdf5-2def8f613298',
    },
    privacyPolicyUrl: 'https://hindipdfeditor.com/privacy/',
  },
};

export default config;
