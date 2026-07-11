/**
 * The app's one shared visual vocabulary - every component pulls colors/spacing from here so
 * the design stays coherent and a palette change touches exactly one file. Values are plain
 * constants (not a context/provider): this app has no runtime theming, so indirection would
 * be dead weight.
 */
export const colors = {
  /** Primary action color - buttons, active states, OCR highlights (matches brand logo #1843DD). */
  primary: '#1843DD',
  primaryDark: '#1130A8',
  /** Subtle tinted background for secondary buttons and chips. */
  primarySoft: '#D7E7FF',
  /** App background behind the page canvas. */
  background: '#F2F3F7',
  /** Cards, toolbars, headers. */
  surface: '#FFFFFF',
  border: '#E2E4EB',
  textPrimary: '#1B1D24',
  textSecondary: '#5B616E',
  textOnPrimary: '#FFFFFF',
  danger: '#C6303E',
  dangerSoft: '#FBEAEC',
  success: '#1E7B34',
  successSoft: '#E9F5EC',
  warning: '#8A5A00',
  warningSoft: '#FFF4DC',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
} as const;
