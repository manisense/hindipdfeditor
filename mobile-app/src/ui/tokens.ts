/** Colour and shape tokens for the native UI kit (ADR 0013). Values are sRGB hex or rgba. */
export const ui = {
  brand: '#1843DD',
  brandTint: '#EEF2FF',
  /** Brand colour for text and icons on surfaces; `brand` stays for fills. */
  brandOnSurface: '#1843DD',
  chrome: '#14161F',
  readingBackdrop: '#E7E8F1',
  ink: '#09090B',
  inkSecondary: '#52525B',
  /** Group and section label text. */
  inkLabel: '#3F3F46',
  inkTertiary: '#71717A',
  fill: '#F4F4F5',
  divider: 'rgba(9, 9, 11, 0.06)',
  ring: 'rgba(9, 9, 11, 0.06)',
  scrim: 'rgba(9, 9, 11, 0.42)',
  snackbar: '#27272A',
  snackbarAction: '#A9BBFF',
  success: '#16A34A',
  danger: '#D93A2B',
  category: {
    edit: '#1843DD',
    translate: '#16A34A',
    pages: '#7C3AED',
    size: '#C2560A',
    read: '#0D9488',
  },
} as const;

/** Corner radii in dp. */
export const uiRadius = { tile: 14, sheet: 24, dialog: 28, fab: 16, pill: 9999 } as const;

/** Dark-theme overrides for the same keys. */
export const uiDark = {
  ...ui,
  brandTint: '#1B2350',
  brandOnSurface: '#A9BBFF',
  // Bars and the floating toolbar sit a step above the backdrop so they stay visible in dark mode.
  chrome: '#262A36',
  readingBackdrop: '#14161F',
  ink: '#E8EAF0',
  inkSecondary: '#A9B1C2',
  inkLabel: '#A9B1C2',
  inkTertiary: '#8A93A6',
  fill: '#23252F',
  divider: 'rgba(255, 255, 255, 0.08)',
  ring: 'rgba(255, 255, 255, 0.08)',
  // Lighter category hues keep icons at 3:1 or more on the dark surfaces.
  category: {
    edit: '#7B93FF',
    translate: '#34C26A',
    pages: '#B48CFF',
    size: '#F08A3C',
    read: '#2DBFAF',
  },
} as const;

export type UiTokens = typeof ui | typeof uiDark;

/** Font family names registered in App.tsx. */
export const uiFont = { latin: 'Inter', devanagari: 'NotoSansDevanagari' } as const;

/** Bottom padding (dp) that lets scroll content clear the floating bottom navigation. */
export const NAV_CLEARANCE = 96;
