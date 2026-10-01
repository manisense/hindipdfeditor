import { useEffect } from 'react';
import { Dimensions, Platform, useWindowDimensions } from 'react-native';
import * as ScreenOrientation from 'expo-screen-orientation';

/**
 * Screens whose shorter side is at least this many dp count as large (tablets, unfolded
 * foldables, Chromebooks). Android's own large-screen threshold, and the width from which
 * Android 16 ignores an app's orientation lock anyway.
 */
const LARGE_SCREEN_MIN_DP = 600;

/**
 * Portrait on phones, free rotation on large screens.
 *
 * The manifest declares no orientation, so Play's large-screen check passes and tablets and
 * foldables rotate. Phones are locked to portrait at runtime because the home screen is a
 * fixed, non-scrolling layout (AGENTS.md) that doesn't fit a landscape phone. It re-evaluates
 * when the screen itself changes, for example when a foldable is unfolded.
 */
export function useOrientationPolicy(): void {
  // Window size changes when the physical screen does (fold, external display); the policy is
  // based on the screen, which split-screen doesn't shrink.
  const { width, height } = useWindowDimensions();

  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const screen = Dimensions.get('screen');
    const isLargeScreen = Math.min(screen.width, screen.height) >= LARGE_SCREEN_MIN_DP;
    const apply = isLargeScreen
      ? ScreenOrientation.unlockAsync()
      : ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
    apply.catch((err: unknown) => console.warn('Orientation policy failed', err));
  }, [width, height]);
}
