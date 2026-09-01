import { useMemo } from 'react';
import { useColorScheme } from 'react-native';
import { createBox, createText, useTheme as useRestyleTheme } from '@shopify/restyle';

import { useSettingsStore } from '../state/settingsStore';
import { darkTheme, lightTheme, type Theme } from '../theme';

/**
 * Box and Text primitives from @shopify/restyle.
 * Type-safe, responsive, theme-aware building blocks.
 */
export const Box = createBox<Theme>();
export const Text = createText<Theme>();

/**
 * Returns the resolved Shopify Restyle Theme (lightTheme | darkTheme)
 * based on the user's settings store ('light' | 'dark' | 'system').
 */
export function useAppTheme(): Theme {
  const systemScheme = useColorScheme();
  const themeSetting = useSettingsStore((s) => s.theme);

  const isDark = themeSetting === 'dark' || (themeSetting === 'system' && systemScheme === 'dark');

  return isDark ? darkTheme : lightTheme;
}

/**
 * Hook to access the theme from Restyle's ThemeProvider context.
 */
export function useTheme(): Theme {
  return useRestyleTheme<Theme>();
}

/**
 * Factory hook that generates theme-aware StyleSheet styles.
 * Automatically recalculates and updates when theme changes (light <-> dark).
 *
 * @example
 * const styles = useThemedStyles((theme) => ({
 *   container: { backgroundColor: theme.colors.background },
 *   card: { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
 *   text: { color: theme.colors.textPrimary },
 * }));
 */
export function useThemedStyles<T>(styleFactory: (theme: Theme) => T): T {
  const theme = useAppTheme();
  return useMemo(() => styleFactory(theme), [theme, styleFactory]);
}

/**
 * Legacy DynamicColors alias for smooth backward compatibility
 */
export type DynamicColors = Theme['colors'];
