/**
 * The app's shared visual design tokens - matched pixel-for-pixel to the web brand design system.
 * Warm cream canvas (#FBF8F1), high-chroma electric blue (#1843DD), midnight navy (#050839),
 * and vibrant category tool accents.
 */
export const colors = {
  // Brand Foundation
  brand: '#1843DD',
  brandDark: '#1130A8',
  brand500: '#3A5CF0',
  brandTint: '#D7E7FF',
  brandWash: '#EEF3FF',

  // Tool Accents & Category Accents
  accent: '#01873E', // Translate & Split tool (Emerald)
  accent500: '#12A551',
  accentTint: '#D6F3E3',
  lavender: '#5B4BD6', // Merge tool (Lavender)
  lavenderTint: '#E9E6FF',
  amber: '#FFCE45', // Compress & OCR tool (Amber)
  amberInk: '#B58400',
  amberTint: '#FFF0C2',
  coral: '#FF8B5E', // Badges & highlights

  // Warm Paper & Neutrals (Web Theme)
  background: '#FBF8F1', // Warm cream canvas (replaces cold gray)
  surface: '#FFFFFF',
  surfaceSubtle: '#F6F7F9',
  border: '#ECEAE2',
  borderStrong: '#DEDBD1',
  textPrimary: '#15172C', // Deep ink
  textSecondary: '#5B6172', // Muted slate
  textTertiary: '#8E95A5', // Light slate
  navy: '#050839', // Midnight navy for modals & dark headers
  navyDark: '#0C1150',

  // Semantic Aliases
  primary: '#1843DD',
  primaryDark: '#1130A8',
  primarySoft: '#D7E7FF',
  textOnPrimary: '#FFFFFF',
  success: '#01873E',
  successSoft: '#D6F3E3',
  warning: '#B58400',
  warningSoft: '#FFF0C2',
  danger: '#C6303E',
  dangerSoft: '#FBEAEC',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  '2xl': 32,
  '3xl': 48,
} as const;

export const radius = {
  xs: 6,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 26,
  full: 9999, // Pill shape standard
} as const;

export const shadows = {
  soft: {
    shadowColor: '#15172C',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  brand: {
    shadowColor: '#1843DD',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.24,
    shadowRadius: 14,
    elevation: 5,
  },
  card: {
    shadowColor: '#15172C',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.09,
    shadowRadius: 20,
    elevation: 6,
  },
  float: {
    shadowColor: '#15172C',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 4,
  },
  popup: {
    shadowColor: '#050839',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.22,
    shadowRadius: 30,
    elevation: 10,
  },
} as const;
