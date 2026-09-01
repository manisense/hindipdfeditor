/**
 * Hindi PDF Editor — Unified Design System Tokens & Restyle Theme
 * Strictly aligned with `design-system.md` (Web & Mobile).
 */
import { createTheme } from '@shopify/restyle';

export const rawColors = {
  // Brand Foundation (design-system.md Section 2)
  brand: '#1843DD',
  brandDeep: '#3226B8',
  brandDark: '#3226B8',
  brand500: '#1843DD',
  brandTint: '#EEF2FF',
  brandWash: '#EEF2FF',

  // Feature Category Accents (design-system.md Section 2)
  accent: '#16A34A', // Translation / Privacy
  accentTint: '#E6F7EC',
  accentGreen: '#16A34A',
  accentGreenTint: '#E6F7EC',
  accentBlue: '#1843DD',
  accentBlueTint: '#E8EDFF',
  accentPurple: '#7C3AED',
  accentPurpleTint: '#F1EAFE',
  accentOrange: '#F0700F',
  accentOrangeTint: '#FFF1E4',
  accentTeal: '#0D9488',
  accentTealTint: '#E3F6F4',

  // Category aliases for tools
  lavender: '#7C3AED',
  lavenderTint: '#F1EAFE',
  amber: '#F0700F',
  amberInk: '#F0700F',
  amberTint: '#FFF1E4',
  coral: '#EF6C4D',
  coralTint: '#FFEBE4',

  // Surfaces & Backgrounds (design-system.md Section 2)
  background: '#FBFBFE',
  surface: '#FFFFFF',
  surfacePage: '#FBFBFE',
  surfaceCream: '#FAF6EC',
  surfaceSubtle: '#F8FAFC',

  // Borders (design-system.md Section 2)
  border: '#E7E8F1',
  borderSubtle: '#E7E8F1',
  borderStrong: '#D5D7E2',

  // Typography Neutrals (design-system.md Section 2)
  textPrimary: '#14161F',
  textSecondary: '#5B6472',
  textTertiary: '#94A0B2',
  textMuted: '#94A0B2',
  textOnPrimary: '#FFFFFF',

  // Semantic
  primary: '#1843DD',
  primaryDeep: '#3226B8',
  primaryDark: '#3226B8',
  primaryTint: '#EEF2FF',
  primarySoft: '#EEF2FF',
  success: '#16A34A',
  successSoft: '#E6F7EC',
  warning: '#EF6C4D',
  warningSoft: '#FFF1E4',
  danger: '#C6303E',
  dangerSoft: '#FBEAEC',
};

// Backward compatibility export
export const colors = rawColors;

/**
 * Spacing scale strictly aligned with design-system.md Section 5:
 * 4 / 8 / 12 / 16 / 24 / 32 / 48 / 64 (dp/px)
 */
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  '2xl': 32,
  '3xl': 48,
  '4xl': 64,
} as const;

/**
 * Shape & Corner Radius scale strictly aligned with design-system.md Section 4:
 * Cards/panels: 16–20px, Icon chips: 12px, Buttons/badges: full pill (9999px)
 */
export const radius = {
  xs: 6,
  sm: 8,
  chip: 12,
  md: 12,
  card: 16,
  lg: 16,
  xl: 20,
  '2xl': 26,
  full: 9999, // Pill shape standard
} as const;

/**
 * Elevation & Shadows strictly aligned with design-system.md Section 4:
 * Soft elevation: 0px 8px 24px rgba(20, 22, 31, 0.06)
 */
export const shadows = {
  soft: {
    shadowColor: '#14161F',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 3,
  },
  brand: {
    shadowColor: '#1843DD',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.22,
    shadowRadius: 14,
    elevation: 5,
  },
  card: {
    shadowColor: '#14161F',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.06,
    shadowRadius: 24,
    elevation: 4,
  },
  float: {
    shadowColor: '#14161F',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 4,
  },
  popup: {
    shadowColor: '#14161F',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.18,
    shadowRadius: 30,
    elevation: 10,
  },
} as const;

/**
 * Light Theme (Shopify Restyle)
 */
export const lightTheme = {
  ...createTheme({
    colors: {
      ...rawColors,
      navBar: rawColors.surface,
      auraTopRight: 'rgba(238,242,255,0.7)',
      activeHeaderBg: 'rgba(255,255,255,0.95)',
      cardBg: rawColors.surface,
      inputBg: rawColors.surfaceSubtle,
      segmentBg: rawColors.surfaceSubtle,
      segmentSelected: rawColors.brandTint,
    },
    spacing,
    radius,
    shadows,
    breakpoints: {
      phone: 0,
      tablet: 768,
    },
    textVariants: {
      defaults: {
        color: 'textPrimary',
        fontSize: 14,
      },
      header: {
        fontWeight: 'bold',
        fontSize: 22,
        color: 'textPrimary',
      },
      subheader: {
        fontWeight: '600',
        fontSize: 16,
        color: 'textPrimary',
      },
      body: {
        fontSize: 14,
        color: 'textSecondary',
      },
      caption: {
        fontSize: 12,
        color: 'textTertiary',
      },
    },
    cardVariants: {
      defaults: {
        backgroundColor: 'surface',
        borderRadius: 'card',
        borderColor: 'borderSubtle',
        borderWidth: 1,
      },
    },
  }),
  isDark: false as boolean,
};

export type Theme = typeof lightTheme;

/**
 * Dark Theme (Shopify Restyle)
 */
export const darkTheme: Theme = {
  ...lightTheme,
  isDark: true,
  colors: {
    ...lightTheme.colors,
    brand: '#2E5BFF',
    brandDeep: '#1843DD',
    brandDark: '#1843DD',
    brand500: '#2E5BFF',
    brandTint: 'rgba(46,91,255,0.18)',
    brandWash: 'rgba(46,91,255,0.10)',

    accent: '#22C55E',
    accentTint: 'rgba(34,197,94,0.16)',
    accentGreen: '#22C55E',
    accentGreenTint: 'rgba(34,197,94,0.16)',
    accentBlue: '#2E5BFF',
    accentBlueTint: 'rgba(46,91,255,0.18)',
    accentPurple: '#A855F7',
    accentPurpleTint: 'rgba(168,85,247,0.16)',
    accentOrange: '#FB923C',
    accentOrangeTint: 'rgba(251,146,60,0.16)',
    accentTeal: '#14B8A6',
    accentTealTint: 'rgba(20,184,166,0.16)',

    lavender: '#A855F7',
    lavenderTint: 'rgba(168,85,247,0.16)',
    amber: '#FB923C',
    amberInk: '#FB923C',
    amberTint: 'rgba(251,146,60,0.16)',
    coral: '#F87171',
    coralTint: 'rgba(248,113,113,0.16)',

    // Surfaces & Backgrounds
    background: '#0E0E14',
    surface: '#181924',
    surfacePage: '#0E0E14',
    surfaceCream: '#12131C',
    surfaceSubtle: '#222433',

    // Borders
    border: '#2D3042',
    borderSubtle: '#2D3042',
    borderStrong: '#3D4158',

    // Typography Neutrals
    textPrimary: '#E8EAF0',
    textSecondary: '#8E96A8',
    textTertiary: '#5C6478',
    textMuted: '#5C6478',
    textOnPrimary: '#FFFFFF',

    // Semantic
    primary: '#2E5BFF',
    primaryDeep: '#1843DD',
    primaryDark: '#1843DD',
    primaryTint: 'rgba(46,91,255,0.18)',
    primarySoft: 'rgba(46,91,255,0.18)',
    success: '#22C55E',
    successSoft: 'rgba(34,197,94,0.16)',
    warning: '#FB923C',
    warningSoft: 'rgba(251,146,60,0.16)',
    danger: '#F87171',
    dangerSoft: 'rgba(248,113,113,0.16)',

    // Component-level tokens
    navBar: '#181924',
    auraTopRight: 'rgba(46,91,255,0.06)',
    activeHeaderBg: 'rgba(24,25,36,0.96)',
    cardBg: '#181924',
    inputBg: '#222433',
    segmentBg: '#222433',
    segmentSelected: 'rgba(46,91,255,0.22)',
  },
};
