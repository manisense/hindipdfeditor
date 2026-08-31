/**
 * Hindi PDF Editor — Unified Design System Tokens
 * Strictly aligned with `design-system.md` (Web & Mobile).
 */
export const colors = {
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
} as const;

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
