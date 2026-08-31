# 9. Unified Design System, Tokens, and Vector Icons

Date: 2026-09-01

## Status

Accepted and Implemented

## Context

The web homepage and mobile application require visual identity consistency, predictable UI hierarchy, and clear typography rules. Previously, some screens and tools used ad-hoc inline styling, raw emoji characters for icons, and inconsistent category tints.

A comprehensive design system was formalized in `design-system.md` to govern both web and mobile environments.

## Decision

1. **Adopt `design-system.md` as the single source of truth** for all visual styling across the entire project (web and mobile).
2. **Strict Color Palette & Category Tints**:
   - Primary Brand Action: `#1843DD` (with `#3226B8` gradient end and `#EEF2FF` tint).
   - Category Accents:
     - Core editing: `#1843DD` on `#E8EDFF`
     - Translation & privacy: `#16A34A` on `#E6F7EC`
     - Merge & split: `#7C3AED` on `#F1EAFE`
     - Compression & Sarkari tools: `#F0700F` on `#FFF1E4`
     - OCR & detection: `#0D9488` on `#E3F6F4`
   - Neutrals: Text `#14161F` / `#5B6472` / `#94A0B2`, Border `#E7E8F1`, Surface `#FFFFFF` / `#FBFBFE` / `#FAF6EC`.
3. **Strict Zero-Emoji Rule in UI**:
   - All UI icons must use vector icon libraries (`@expo/vector-icons` / `react-native-vector-icons` Ionicons & MaterialCommunityIcons on mobile, SVG/Lucide on web). No raw emojis.
4. **Devanagari Equal Typographic Weight**:
   - Devanagari headline text must sit with equal visual prominence alongside English headlines, reflecting Hindi-first product identity.
5. **Shape & Elevation Standards**:
   - Cards/panels: 16–20px radius, 1px subtle border, soft elevation (`0px 8px 24px rgba(20, 22, 31, 0.06)`).
   - Buttons and badges: Full pill shape (`9999px`).
   - Icon chips: 12px rounded square, 40–48dp size.
6. **Spacing Scale**:
   - Strict adherence to `4 / 8 / 12 / 16 / 24 / 32 / 48 / 64` (dp/px).
7. **Mobile Screen Layout**:
   - Fixed, responsive, non-scrollable home screen utilizing screen height without oversized gaps.

## Consequences

- All future AI agents and developers must strictly follow the tokens in `theme.ts` / `design-system.md` and `AGENTS.md`.
- Prevents UI regressions, visual fragmentation, and emoji rendering discrepancies across platforms.
