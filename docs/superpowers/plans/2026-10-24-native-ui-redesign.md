# Native UI Redesign (Mobile) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild every screen of the Android app (`mobile-app/`) to the locked native designs, with one language per screen, real Android back behaviour, and the missing Reader menu features.

**Architecture:** A small native UI kit (`src/ui/`) and a string helper (`src/i18n/`) land first. Every screen is then rebuilt on top of them, one screen per task, without touching the PDF pipeline (`src/lib/` rendering, OCR, export). Pure logic (back stack, recency groups, reorder, search, strings) is unit-tested with Jest. Each screen is verified on a real device in English, Hindi and dark mode before its commit.

**Tech Stack:** Expo SDK 56, React Native 0.85.3, TypeScript strict, zustand, @shopify/restyle (theme only), `@expo/vector-icons` MaterialIcons, Jest (`jest-expo`), Noto Sans Devanagari, Inter.

**Spec (locked designs, read before each task):**

| Screen | Canvas |
|---|---|
| Home | https://claude.ai/artifact/L97VMtqUdgCVNmTCfqG6L4 (board "A4 band + A5 tools, recents below") |
| Files | https://claude.ai/artifact/BYhbmJCFK6Z1SkRUYBKZ54 (F3 + F4 no-access state) |
| Tools | https://claude.ai/artifact/L4agrny4BGGCSx8KkwMHJR (T2, no band subtitle) |
| Settings | https://claude.ai/artifact/PwXUoRMLR9DTaaYyTtd88u (S2) |
| Tool layout | https://claude.ai/artifact/TdV1TmmKZ6BexysjtNXFkb (Merge drag, Split, Compress, Working, Done) |
| Pop-ups | https://claude.ai/artifact/BdY6bprQdCKA1xpTj5hdzU |
| Reader + Edit | https://claude.ai/artifact/YNGuLso33jVDcT2tUDdgiC (English rows + Hindi row) |

## Global Constraints

- Brand primary `#1843DD`; primary buttons are **solid** `#1843DD` full pills (the locked designs replace the old gradient; Task 1 updates `AGENTS.md` and both `design-system.md` files in the same commit).
- Reader and editor chrome `#14161F`; reading backdrop `#E7E8F1`; app bands `#1843DD`; white sheet with 24dp top radius overlapping the band by 24dp.
- Neutrals for new UI: text `#09090B`, secondary `#52525B`, tertiary `#71717A`, fill `#F4F4F5`, divider `rgba(9,9,11,0.06)`.
- Category icon colours (icon only, never a tinted box): edit `#1843DD`, translate `#16A34A`, merge/split `#7C3AED`, compress `#C2560A`, read `#0D9488`.
- One language per screen. Every user-visible string goes through `tx(en, hi)` from `src/i18n`. No hard-coded English or Hindi in screens.
- Icons: `MaterialIcons` from `@expo/vector-icons` via `src/ui/Icon.tsx`. No emoji. No new icon dependency.
- Touch targets ≥ 48dp. Spacing scale `4 / 8 / 12 / 16 / 24 / 32 / 48 / 64`.
- Every screen works in light and dark theme (`darkTheme` in `src/theme.ts`).
- Android hardware back must close the top-most sheet/dialog first, then the tool, then return to Home, then exit.
- Never overwrite the source PDF; every tool saves a new file (AGENTS.md).
- Copy must be true to the code: no "100% offline". Translate is the only online feature and says so.
- New native dependencies need vetting first (maintenance + Expo SDK 56 support), and must be installed with `npx expo install`.
- Before every commit: `npm run check` (lint, typecheck, jest, prettier) passes in `mobile-app/`.
- Conventional Commits; `mobile-app/CHANGELOG.md` updated in the same commit as the behaviour change.

---

## File Structure

New:

```
mobile-app/src/i18n/
  index.ts              pickText(), useTx() — language selection
  index.test.ts
mobile-app/src/navigation/
  backStack.ts          resolveBack() pure reducer for hardware back
  backStack.test.ts
  useHardwareBack.ts    BackHandler hook with a LIFO handler registry
mobile-app/src/ui/
  Icon.tsx              MaterialIcons wrapper (size, color, label)
  BrandBand.tsx         blue band + overlapping white sheet
  ReaderBar.tsx         dark #14161F top bar used by Reader and Editor
  ListRow.tsx           icon + title + subtitle + trailing
  SegmentedControl.tsx  2–3 option pill switch
  Chip.tsx              filter chip
  PillButton.tsx        primary / tonal / text buttons
  BottomSheet.tsx       modal sheet with handle + scrim + back support
  Dialog.tsx            Android alert dialog
  Snackbar.tsx          SnackbarProvider + useSnackbar()
  ToolScaffold.tsx      band + content + bottom action bar for tools
  BottomNav.tsx         flat 4-tab bar (replaces BottomNavBar.tsx)
  tokens.ts             new colour + radius tokens
mobile-app/src/lib/
  recencyGroups.ts      Today / This week / Earlier grouping
  recencyGroups.test.ts
  reorder.ts            moveItem()
  reorder.test.ts
  textSearch.ts         findMatches() over OCR lines
  textSearch.test.ts
mobile-app/src/screens/reader/   (split out of ViewPdfTool.tsx)
  ReaderMenu.tsx, PageScroller.tsx, PageGrid.tsx, FindInFile.tsx, FileInfoSheet.tsx, ReadingThemeSheet.tsx
mobile-app/src/screens/editor/   (split out of EditPdfTool.tsx)
  EditToolbarBar.tsx, LineEditSheet.tsx, SaveSheet.tsx
mobile-app/src/screens/ToolDoneScreen.tsx
mobile-app/assets/fonts/Inter-Variable.ttf
mobile-app/docs/decisions/0013-native-ui-redesign.md
```

Modified: `App.tsx`, `src/theme.ts`, `src/components/ToolShell.tsx`, `src/screens/{Home,Files,Tools,Settings}Screen.tsx`, `src/tools/*.tsx`, `src/components/{LegacyFontWarning,FontPickerModal,AboutModal}.tsx`, `src/components/AppPopup.tsx` (removed at the end), `AGENTS.md`, `design-system.md`, `mobile-app/design-system.md`, `mobile-app/CHANGELOG.md`, `mobile-app/hindi-pdf-editor-spec.md`.

Removed once unused: `src/components/BottomNavBar.tsx`, `src/components/AppPopup.tsx`, `src/components/appPopupContext.ts`, `src/components/DropZone.tsx` (if no screen still uses it).

---

## Phase 0 — Foundation

### Task 1: ADR, rule updates and tokens

**Files:**
- Create: `mobile-app/docs/decisions/0013-native-ui-redesign.md`
- Modify: `AGENTS.md` (rules 1, 2, 4), `design-system.md`, `mobile-app/design-system.md`, `mobile-app/src/theme.ts`
- Create: `mobile-app/src/ui/tokens.ts`

- [ ] **Step 1: Write the ADR**

```markdown
# 0013 Native UI redesign

## Decision
Rebuild the Android UI on native Material patterns: blue brand band with an overlapping white sheet on tab screens, dark #14161F chrome for the reader and editor, flat bottom navigation, bottom sheets for choices, Android dialogs for errors, snackbars for quick confirmations, solid #1843DD primary pills, coloured icons without tinted boxes, and one language per screen through `tx(en, hi)`.

## Why
User testing of earlier rounds called the custom chips, gradient buttons and doubled English + Hindi labels "artificial, not native". The locked designs follow iLovePDF, Files by Google and Google Drive.

## Rejected
- Keeping bilingual labels on every element: doubles text, breaks layout at 360dp.
- Floating rounded dock navigation: looks web-made on Android.
- Gradient primary buttons and tinted icon squares: read as decoration, not native.
```

- [ ] **Step 2: Update the rules in the same commit**

In `AGENTS.md` "Strict Design System" section:
- Rule 1: replace "Brand Primary Deep … Gradient end for primary buttons" with "`#3226B8` is no longer used for buttons; primary buttons are solid `#1843DD`."
- Rule 2: keep (no emoji); add "Use `src/ui/Icon.tsx` (MaterialIcons)."
- Rule 3: replace with "One language per screen, chosen in Settings. Hindi screens render fully in Hindi in Noto Sans Devanagari; never stack English and Hindi on the same label."
- Rule 4: replace icon-chip line with "Icons sit directly on the surface in their category colour; no tinted squares." Cards: "white, 14dp radius, `0 0 0 1px rgba(9,9,11,0.06)` ring + 1dp shadow."
Mirror the same edits in `design-system.md` §6 and `mobile-app/design-system.md`.

- [ ] **Step 3: Add tokens**

`mobile-app/src/ui/tokens.ts`:

```ts
/** Colour and shape tokens for the native UI kit (ADR 0013). Values are sRGB hex or rgba. */
export const ui = {
  brand: '#1843DD',
  brandTint: '#EEF2FF',
  chrome: '#14161F',
  readingBackdrop: '#E7E8F1',
  ink: '#09090B',
  inkSecondary: '#52525B',
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
  readingBackdrop: '#0E1017',
  ink: '#E8EAF0',
  inkSecondary: '#A9B1C2',
  inkTertiary: '#8A93A6',
  fill: '#23252F',
  divider: 'rgba(255, 255, 255, 0.08)',
  ring: 'rgba(255, 255, 255, 0.08)',
} as const;

export type UiTokens = typeof ui | typeof uiDark;
```

Add a hook in `src/hooks/useAppTheme.ts`:

```ts
import { ui, uiDark, type UiTokens } from '../ui/tokens';

/** Returns native UI tokens for the resolved light/dark theme. */
export function useUi(): UiTokens {
  const theme = useAppTheme();
  return theme === darkTheme ? uiDark : ui;
}
```

(`darkTheme` is already imported in that file.)

- [ ] **Step 4: Verify and commit**

Run: `cd mobile-app && npm run check` — Expected: all pass.

```bash
git add AGENTS.md design-system.md mobile-app/design-system.md mobile-app/docs/decisions/0013-native-ui-redesign.md mobile-app/src/ui/tokens.ts mobile-app/src/hooks/useAppTheme.ts
git commit -m "docs(mobile): adopt native UI redesign rules and tokens (ADR 0013)"
```

### Task 2: Strings helper `tx(en, hi)`

**Files:**
- Create: `mobile-app/src/i18n/index.ts`, `mobile-app/src/i18n/index.test.ts`

**Interfaces:**
- Produces: `pickText(language: AppLanguage, en: string, hi: string): string` and `useTx(): (en: string, hi: string) => string`; `useIsHindi(): boolean`.

- [ ] **Step 1: Write the failing test**

```ts
import { pickText } from './index';

describe('pickText', () => {
  it('returns English for english', () => {
    expect(pickText('english', 'Files', 'फ़ाइलें')).toBe('Files');
  });
  it('returns Hindi for hindi', () => {
    expect(pickText('hindi', 'Files', 'फ़ाइलें')).toBe('फ़ाइलें');
  });
  it('joins both for bilingual, English first', () => {
    expect(pickText('bilingual', 'Files', 'फ़ाइलें')).toBe('Files · फ़ाइलें');
  });
  it('falls back to English when Hindi is empty', () => {
    expect(pickText('hindi', 'PDF', '')).toBe('PDF');
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd mobile-app && npx jest src/i18n/index.test.ts` — Expected: FAIL "Cannot find module './index'".

- [ ] **Step 3: Implement**

```ts
import { useCallback } from 'react';

import { useSettingsStore, type AppLanguage } from '../state/settingsStore';

/** Chooses the label for the current app language. Bilingual joins both with a middle dot. */
export function pickText(language: AppLanguage, en: string, hi: string): string {
  if (language === 'english' || !hi) return en;
  if (language === 'hindi') return hi;
  return `${en} · ${hi}`;
}

/** Hook returning `tx(en, hi)` bound to the current language. */
export function useTx(): (en: string, hi: string) => string {
  const language = useSettingsStore((s) => s.language);
  return useCallback((en: string, hi: string) => pickText(language, en, hi), [language]);
}

/** True when screens should use the Devanagari font for UI text. */
export function useIsHindi(): boolean {
  return useSettingsStore((s) => s.language === 'hindi');
}
```

- [ ] **Step 4: Change the default language**

In `src/state/settingsStore.ts` change the initial `language: 'bilingual'` to `language: 'english'`, so new installs start in one language. Update `settingsStore.test.ts` expectations that assert the default.

- [ ] **Step 5: Verify and commit**

Run: `npx jest src/i18n src/state/settingsStore.test.ts` — Expected: PASS. Then `npm run check`.

```bash
git add mobile-app/src/i18n mobile-app/src/state/settingsStore.ts mobile-app/src/state/settingsStore.test.ts
git commit -m "feat(mobile): add tx() single-language strings helper"
```

### Task 3: Hardware back

**Files:**
- Create: `mobile-app/src/navigation/backStack.ts`, `backStack.test.ts`, `useHardwareBack.ts`
- Modify: `mobile-app/src/components/ToolShell.tsx`, `mobile-app/App.tsx`

**Interfaces:**
- Produces: `resolveBack(state: NavState): BackAction`; `useHardwareBack(handler: () => boolean, enabled?: boolean): void` (handlers registered later win; return `true` when handled).

- [ ] **Step 1: Write the failing test**

```ts
import { resolveBack } from './backStack';

describe('resolveBack', () => {
  it('closes an open tool first', () => {
    expect(resolveBack({ activeTool: 'merge', tab: 'tools' })).toEqual({ type: 'closeTool' });
  });
  it('returns to Home from another tab', () => {
    expect(resolveBack({ activeTool: null, tab: 'files' })).toEqual({ type: 'goHome' });
  });
  it('lets Android exit from Home', () => {
    expect(resolveBack({ activeTool: null, tab: 'home' })).toEqual({ type: 'exit' });
  });
});
```

- [ ] **Step 2: Run to verify it fails** — `npx jest src/navigation` → FAIL module not found.

- [ ] **Step 3: Implement**

`backStack.ts`:

```ts
import type { MainTab } from '../ui/BottomNav';
import type { ToolId } from '../components/ToolShell';

export type NavState = { activeTool: ToolId | null; tab: MainTab };
export type BackAction = { type: 'closeTool' } | { type: 'goHome' } | { type: 'exit' };

/** Decides what Android back does when no sheet or dialog is open. */
export function resolveBack(state: NavState): BackAction {
  if (state.activeTool) return { type: 'closeTool' };
  if (state.tab !== 'home') return { type: 'goHome' };
  return { type: 'exit' };
}
```

`useHardwareBack.ts`:

```ts
import { useEffect, useRef } from 'react';
import { BackHandler } from 'react-native';

/**
 * Registers an Android back handler. Handlers added later run first (React Native keeps a LIFO
 * list), so a sheet opened on top of a tool closes before the tool does.
 */
export function useHardwareBack(handler: () => boolean, enabled = true): void {
  const ref = useRef(handler);
  ref.current = handler;
  useEffect(() => {
    if (!enabled) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => ref.current());
    return () => sub.remove();
  }, [enabled]);
}
```

In `ToolShell.tsx`, lift the tab state so it is readable (it already owns `activeTab`), then:

```ts
useHardwareBack(() => {
  const action = resolveBack({ activeTool, tab: activeTab });
  if (action.type === 'closeTool') { onSelectTool(null); return true; }
  if (action.type === 'goHome') { setActiveTab('home'); return true; }
  return false;
});
```

(`MainTab` moves to `src/ui/BottomNav.tsx` in Task 5; until then import it from `./BottomNavBar` and update the import in Task 5.)

- [ ] **Step 4: Verify on device**

Run the app (`npx expo run:android` with the phone connected). Open Merge → press back → returns to the tab; on Files → back → Home; on Home → back → app closes.

- [ ] **Step 5: Commit**

```bash
git add mobile-app/src/navigation mobile-app/src/components/ToolShell.tsx
git commit -m "feat(mobile): handle Android back for tools and tabs"
```

### Task 4: Inter font

**Files:**
- Create: `mobile-app/assets/fonts/Inter-Variable.ttf` (+ update `mobile-app/assets/fonts/OFL.txt` notice)
- Modify: `mobile-app/App.tsx` (`useFonts`)

- [ ] **Step 1: Vet and fetch the font**

Download Inter 4.1 from the official release `https://github.com/rsms/inter/releases/download/v4.1/Inter-4.1.zip`, take `InterVariable.ttf`, check it is a TrueType file (`file` reports "TrueType Font data") and under 1 MB, and save it as `assets/fonts/Inter-Variable.ttf`. Inter is SIL OFL 1.1; append its copyright line to `OFL.txt`.

- [ ] **Step 2: Load it**

```ts
const [fontsLoaded, fontError] = useFonts({
  NotoSansDevanagari: require('./assets/fonts/NotoSansDevanagari-Variable.ttf'),
  Inter: require('./assets/fonts/Inter-Variable.ttf'),
});
```

Add to `src/ui/tokens.ts`:

```ts
/** Font family names registered in App.tsx. */
export const uiFont = { latin: 'Inter', devanagari: 'NotoSansDevanagari' } as const;
```

- [ ] **Step 3: Verify and commit**

Build on device, confirm Latin text renders in Inter (compare "g" and "1" glyphs against Roboto). `npm run check`.

```bash
git add mobile-app/assets/fonts mobile-app/App.tsx mobile-app/src/ui/tokens.ts
git commit -m "feat(mobile): bundle Inter for Latin UI text"
```

### Task 5: Native UI kit

**Files:**
- Create: `src/ui/Icon.tsx`, `UiText.tsx`, `BrandBand.tsx`, `ReaderBar.tsx`, `ListRow.tsx`, `SegmentedControl.tsx`, `Chip.tsx`, `PillButton.tsx`, `BottomSheet.tsx`, `Dialog.tsx`, `Snackbar.tsx`, `BottomNav.tsx`, `ToolScaffold.tsx`
- Modify: `App.tsx` (wrap in `SnackbarProvider`), `ToolShell.tsx` (use `BottomNav`)

**Interfaces (Produces — every later task uses these exact names):**

```ts
// Icon.tsx
export type IconName = keyof typeof MaterialIcons.glyphMap;
export function Icon(props: { name: IconName; size?: number; color: string; label?: string }): JSX.Element;

// UiText.tsx — picks Inter or Noto Sans Devanagari from the current language
export function UiText(props: TextProps & { variant?: 'title' | 'section' | 'body' | 'meta' | 'label'; color?: string }): JSX.Element;

// BrandBand.tsx
export function BrandBand(props: { title: string; leading?: ReactNode; actions?: ReactNode; bandExtra?: ReactNode; children: ReactNode }): JSX.Element;

// ReaderBar.tsx
export function ReaderBar(props: { title: string; leadingIcon: 'arrow-back' | 'close'; onLeading: () => void; actions?: ReactNode }): JSX.Element;

// ListRow.tsx
export function ListRow(props: { icon?: IconName; iconColor?: string; leading?: ReactNode; title: string; subtitle?: string; trailing?: ReactNode; onPress?: () => void }): JSX.Element;

// SegmentedControl.tsx
export function SegmentedControl<T extends string>(props: { options: { value: T; label: string }[]; value: T; onChange: (v: T) => void; label: string }): JSX.Element;

// Chip.tsx
export function Chip(props: { label: string; selected: boolean; onPress: () => void }): JSX.Element;

// PillButton.tsx
export function PillButton(props: { title: string; onPress: () => void; kind?: 'primary' | 'tonal' | 'text'; icon?: IconName; disabled?: boolean; loading?: boolean }): JSX.Element;

// BottomSheet.tsx — closes on scrim tap and Android back
export function BottomSheet(props: { visible: boolean; onClose: () => void; title?: string; children: ReactNode }): JSX.Element;

// Dialog.tsx
export function Dialog(props: { visible: boolean; icon?: IconName; iconColor?: string; title: string; body: string; confirmLabel: string; cancelLabel?: string; onConfirm: () => void; onCancel: () => void }): JSX.Element;

// Snackbar.tsx
export function SnackbarProvider(props: { children: ReactNode }): JSX.Element;
export function useSnackbar(): { show: (message: string, action?: { label: string; onPress: () => void }) => void };

// BottomNav.tsx
export type MainTab = 'home' | 'files' | 'tools' | 'settings';
export function BottomNav(props: { activeTab: MainTab; onSelectTab: (t: MainTab) => void }): JSX.Element;

// ToolScaffold.tsx
export function ToolScaffold(props: { title: string; leadingIcon?: 'arrow-back' | 'close'; onLeading: () => void; primary?: { title: string; onPress: () => void; disabled?: boolean; loading?: boolean }; secondary?: { title: string; onPress: () => void }; children: ReactNode }): JSX.Element;
```

- [ ] **Step 1: Build `Icon`, `UiText`, `PillButton`, `Chip`, `SegmentedControl`, `ListRow`**

`Icon.tsx`:

```tsx
import { MaterialIcons } from '@expo/vector-icons';

export type IconName = keyof typeof MaterialIcons.glyphMap;

/** Material icon. `size` in dp; `label` makes it announce to TalkBack, otherwise it is hidden. */
export function Icon({ name, size = 24, color, label }: { name: IconName; size?: number; color: string; label?: string }) {
  return (
    <MaterialIcons
      name={name}
      size={size}
      color={color}
      accessibilityLabel={label}
      accessibilityElementsHidden={!label}
      importantForAccessibility={label ? 'yes' : 'no-hide-descendants'}
    />
  );
}
```

`UiText.tsx`:

```tsx
import { Text, type TextProps } from 'react-native';

import { useIsHindi } from '../i18n';
import { useUi } from '../hooks/useAppTheme';
import { uiFont } from './tokens';

const VARIANTS = {
  title: { fontSize: 22, fontWeight: '600' as const },
  section: { fontSize: 20, fontWeight: '600' as const },
  body: { fontSize: 16, fontWeight: '400' as const },
  meta: { fontSize: 14, fontWeight: '400' as const },
  label: { fontSize: 13, fontWeight: '500' as const },
};

/** Text that uses Noto Sans Devanagari in Hindi mode and Inter otherwise. Sizes are dp. */
export function UiText({ variant = 'body', color, style, ...rest }: TextProps & { variant?: keyof typeof VARIANTS; color?: string }) {
  const hindi = useIsHindi();
  const ui = useUi();
  return (
    <Text
      {...rest}
      style={[{ fontFamily: hindi ? uiFont.devanagari : uiFont.latin, color: color ?? ui.ink }, VARIANTS[variant], style]}
    />
  );
}
```

`PillButton.tsx` — height 52 (primary) / 48 (tonal, text); primary bg `ui.brand` white text; tonal bg `ui.fill` ink text; text = transparent brand text; `android_ripple={{ color: 'rgba(255,255,255,0.2)' }}` on primary, `rgba(9,9,11,0.08)` otherwise; `loading` shows `ActivityIndicator` and disables. Full code:

```tsx
import { ActivityIndicator, Pressable, View } from 'react-native';

import { useUi } from '../hooks/useAppTheme';
import { Icon, type IconName } from './Icon';
import { UiText } from './UiText';

type Kind = 'primary' | 'tonal' | 'text';

/** Full-pill button. Primary is 52dp tall, tonal and text are 48dp. */
export function PillButton({ title, onPress, kind = 'primary', icon, disabled, loading }: { title: string; onPress: () => void; kind?: Kind; icon?: IconName; disabled?: boolean; loading?: boolean }) {
  const ui = useUi();
  const bg = kind === 'primary' ? ui.brand : kind === 'tonal' ? ui.fill : 'transparent';
  const fg = kind === 'primary' ? '#FFFFFF' : kind === 'tonal' ? ui.ink : ui.brand;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled || !!loading, busy: !!loading }}
      disabled={disabled || loading}
      onPress={onPress}
      android_ripple={{ color: kind === 'primary' ? 'rgba(255,255,255,0.2)' : 'rgba(9,9,11,0.08)', borderless: false }}
      style={{ height: kind === 'primary' ? 52 : 48, borderRadius: 9999, backgroundColor: bg, overflow: 'hidden', opacity: disabled ? 0.4 : 1, justifyContent: 'center', paddingHorizontal: 24 }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
        {loading ? <ActivityIndicator color={fg} /> : icon ? <Icon name={icon} size={20} color={fg} /> : null}
        <UiText variant="body" color={fg} style={{ fontWeight: '600' }}>{title}</UiText>
      </View>
    </Pressable>
  );
}
```

`Chip.tsx`: 32dp tall pill; selected → `ui.brandTint` bg + `ui.brand` text; unselected → transparent with 1dp `ui.ring` border, `#3F3F46` text; `accessibilityRole="tab"`, `accessibilityState={{ selected }}`.

`SegmentedControl.tsx`: container `ui.fill`, radius 9999, padding 4, equal-width options 40dp tall; selected option white bg (`ui.fill` → `#FFFFFF` light / `#2E3140` dark) with 1dp shadow; `accessibilityRole="radiogroup"` on container and `radio` + `checked` on options.

`ListRow.tsx`: `Pressable` min height 64, padding 16, row gap 20; leading `Icon` (24, default `ui.inkSecondary`) or `leading` node; title `body`; subtitle `meta` in `ui.inkSecondary`; trailing node; ripple.

- [ ] **Step 2: Build `BrandBand`, `ReaderBar`, `BottomNav`**

`BrandBand.tsx`:

```tsx
import type { ReactNode } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAppTheme, useUi } from '../hooks/useAppTheme';
import { UiText } from './UiText';

/** Blue brand band (64dp app bar + optional extra content) with a white sheet that overlaps it by 24dp. */
export function BrandBand({ title, leading, actions, bandExtra, children }: { title: string; leading?: ReactNode; actions?: ReactNode; bandExtra?: ReactNode; children: ReactNode }) {
  const ui = useUi();
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flex: 1, backgroundColor: ui.brand }}>
      <View style={{ paddingTop: insets.top, paddingBottom: 48 }}>
        <View style={{ height: 64, flexDirection: 'row', alignItems: 'center', paddingLeft: leading ? 4 : 16, paddingRight: 4, gap: 4 }}>
          {leading}
          <UiText variant="title" color="#FFFFFF" style={{ flex: 1 }} accessibilityRole="header" numberOfLines={1}>{title}</UiText>
          {actions}
        </View>
        {bandExtra}
      </View>
      <View style={{ flex: 1, marginTop: -24, backgroundColor: theme.colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, overflow: 'hidden' }}>
        {children}
      </View>
    </View>
  );
}
```

`ReaderBar.tsx`: background `ui.chrome`, height 72 + top inset, leading 48dp icon button (`arrow-back` or `close`, white), title 17dp weight 500 white single line, `actions` slot; `StatusBar` style `light` while mounted.

`BottomNav.tsx`: height 80 + bottom inset, white (`surface`), top `ui.divider` hairline via `borderTopWidth: StyleSheet.hairlineWidth`; 4 equal items: icon inside a 64×32 pill (active: `ui.brandTint` bg, `ui.brand` icon, filled glyph), label 12dp weight 500 (same weight active/inactive, active colour `ui.ink`, inactive `ui.inkSecondary`). Icons: home `home`, files `folder`, tools `apps`, settings `settings` (MaterialIcons has filled glyphs only — use `*-outline` names where they exist: `folder-open` inactive is not a match; keep same glyph and change colour only). Labels via `tx('Home','होम')`, `tx('Files','फ़ाइलें')`, `tx('Tools','टूल')`, `tx('Settings','सेटिंग्स')`. `accessibilityRole="tab"`, `accessibilityState={{ selected }}`. Swap `ToolShell` to use it and delete `BottomNavBar.tsx` when no imports remain.

- [ ] **Step 3: Build `BottomSheet`, `Dialog`, `Snackbar`, `ToolScaffold`**

`BottomSheet.tsx`: RN `Modal` (`transparent`, `animationType="slide"`, `statusBarTranslucent`, `onRequestClose={onClose}` — this is Android back), scrim `ui.scrim` `Pressable` that calls `onClose`, sheet `surface` bg, radius 28 top, 32×4 handle `#D4D4D8` centred with 8dp top / 16dp bottom margin, optional title `title` variant with 24dp side padding, bottom padding = 24 + bottom inset.

`Dialog.tsx`: `Modal` transparent `animationType="fade"`, `onRequestClose={onCancel}`; card left/right 24, radius 28, padding 24/24/16; centred icon (24), title 22/600 centred, body 15 line-height 22 `#3F3F46` (`ui.inkSecondary` in dark); actions right-aligned text buttons (brand colour, 14/600, 40dp tall); `accessibilityRole="alert"`.

`Snackbar.tsx`:

```tsx
import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import { AccessibilityInfo, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ui } from './tokens';
import { UiText } from './UiText';

type Action = { label: string; onPress: () => void };
type Ctx = { show: (message: string, action?: Action) => void };
const SnackbarContext = createContext<Ctx>({ show: () => {} });

/** Bottom snackbar for quick confirmations. Auto-hides after 4 s (6 s with an action). */
export function SnackbarProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<{ message: string; action?: Action } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const insets = useSafeAreaInsets();
  const show = useCallback((message: string, action?: Action) => {
    if (timer.current) clearTimeout(timer.current);
    setState({ message, action });
    AccessibilityInfo.announceForAccessibility(message);
    timer.current = setTimeout(() => setState(null), action ? 6000 : 4000);
  }, []);
  return (
    <SnackbarContext.Provider value={{ show }}>
      {children}
      {state && (
        <View accessibilityLiveRegion="polite" style={{ position: 'absolute', left: 16, right: 16, bottom: 96 + insets.bottom, minHeight: 48, borderRadius: 8, backgroundColor: ui.snackbar, flexDirection: 'row', alignItems: 'center', paddingLeft: 16, paddingRight: 8, gap: 12, elevation: 6 }}>
          <UiText variant="meta" color="#F4F4F5" style={{ flex: 1 }}>{state.message}</UiText>
          {state.action && (
            <Pressable accessibilityRole="button" onPress={() => { state.action?.onPress(); setState(null); }} style={{ height: 40, paddingHorizontal: 12, justifyContent: 'center' }}>
              <UiText variant="meta" color={ui.snackbarAction} style={{ fontWeight: '600' }}>{state.action.label}</UiText>
            </Pressable>
          )}
        </View>
      )}
    </SnackbarContext.Provider>
  );
}

export function useSnackbar(): Ctx {
  return useContext(SnackbarContext);
}
```

`ToolScaffold.tsx`: `BrandBand` with `leading` = 48dp white icon button (`arrow-back` default) calling `onLeading`, `useHardwareBack(() => { onLeading(); return true; })`, children in a `ScrollView`/`View` with 8dp top padding, and a bottom action bar (white, `ui.divider` top hairline, padding 12/16/20 + inset) holding `PillButton primary` and optional `PillButton tonal` with 8dp gap. Hidden when `primary` is undefined.

- [ ] **Step 4: Wire providers**

In `App.tsx`, wrap `AppPopupProvider`'s children with `<SnackbarProvider>` (keep `AppPopupProvider` until Task 11 removes it).

- [ ] **Step 5: Kit preview on device**

Temporarily render a dev-only `UiKitPreview` screen (behind `__DEV__` and a long-press on the Settings title) showing each component in light, dark, English and Hindi. Take screenshots with `adb exec-out screencap -p > kit-<mode>.png` and compare with the canvases. Remove the preview before committing if it adds no lasting value; otherwise keep it behind `__DEV__`.

- [ ] **Step 6: Verify and commit**

`npm run check`.

```bash
git add mobile-app/src/ui mobile-app/App.tsx mobile-app/src/components/ToolShell.tsx
git rm mobile-app/src/components/BottomNavBar.tsx
git commit -m "feat(mobile): add native UI kit and flat bottom navigation"
```

---

## Phase 1 — Tab screens

Every task in this phase ends with the same **device check**:
1. `npx expo run:android` on the USB phone.
2. Screenshot the screen in English, Hindi and dark mode (`adb exec-out screencap -p > <screen>-<mode>.png`).
3. Compare side by side with the locked canvas; fix spacing, sizes and colours until they match.
4. TalkBack on: every control announces a name and role.
5. Press Android back: behaves per Task 3.

### Task 6: Home

**Files:**
- Modify: `mobile-app/src/screens/HomeScreen.tsx` (rewrite)
- Create: none (uses kit)

**Spec:** Home canvas, board "A4 band + A5 tools, recents below".

- [ ] **Step 1: Rewrite the layout**

Structure:

```tsx
<BrandBand
  title={tx('Hindi PDF', 'हिंदी PDF')}
  leading={<AppMark />}
  actions={<IconButton name="more-vert" color="#FFFFFF" label={tx('More options', 'और विकल्प')} onPress={openAbout} />}
  bandExtra={<SearchPill placeholder={tx('Search your PDFs', 'अपनी PDF खोजें')} onPress={() => onSelectTab('files')} />}
>
  <ScrollView contentContainerStyle={{ paddingBottom: 96 }}>
    <UiText variant="section" style={{ paddingHorizontal: 16 }}>{tx('Tools', 'टूल')}</UiText>
    <ToolTiles />   // 3-col grid, 6 tiles, see below
    <SectionHeader title={tx('Recent files', 'हाल की फ़ाइलें')} action={tx('See all', 'सभी देखें')} onAction={() => onSelectTab('files')} />
    <RecentThumbnails files={recent} />
  </ScrollView>
</BrandBand>
```

- `AppMark`: 32dp white rounded square (radius 8) with brand "हि" in Noto Sans Devanagari 17/700.
- `SearchPill`: 48dp white pill, 16dp margin, `search` icon + placeholder `ui.inkSecondary` 16dp; it is a button that opens Files with the search field focused (pass a `focusSearch` flag through `ToolShell`).
- `ToolTiles`: `flexDirection: 'row', flexWrap: 'wrap'`, gap 10, padding 16; each tile width `(screenWidth - 32 - 20) / 3`, height 96, radius 14, white, `ring` + `elevation: 1`; filled icon 30dp in category colour; label 13/500. Tiles and labels:
  - `edit` (`ui.category.edit`) — `tx('Edit Hindi', 'हिंदी एडिट')` → tool `edit`
  - `translate` — `tx('Translate', 'अनुवाद')` → `translate`
  - `merge-type` (`ui.category.pages`) — `tx('Merge', 'जोड़ें')` → `merge`
  - `call-split` — `tx('Split', 'अलग करें')` → `split`
  - `compress` (`ui.category.size`) — `tx('Compress', 'छोटा करें')` → `compress`
  - `menu-book` (`ui.category.read`) — `tx('Read', 'पढ़ें')` → `viewer`
- `RecentThumbnails`: horizontal `FlatList`, item 104×146 thumbnail (`thumbnailUri` via `Image`, fallback white page with `ring`), name 14/400 single line below, 16dp gap. Empty state: one row "Your recent PDFs show here" / "आपकी हाल की PDF यहाँ दिखेंगी" in `meta`.
- Remove "नमस्ते / Welcome back" and the "100% Offline" badge.

- [ ] **Step 2: Device check** (see phase intro) and `npm run check`.

- [ ] **Step 3: Commit**

```bash
git add mobile-app/src/screens/HomeScreen.tsx mobile-app/CHANGELOG.md
git commit -m "feat(mobile): rebuild Home with brand band, tool tiles and recents"
```

### Task 7: Files

**Files:**
- Create: `mobile-app/src/lib/recencyGroups.ts`, `recencyGroups.test.ts`
- Modify: `mobile-app/src/screens/FilesScreen.tsx` (rewrite the view; keep its permission + scan logic)

**Interfaces:**
- Produces: `groupByRecency<T>(items: T[], getTime: (t: T) => number, now: number): { key: 'today' | 'week' | 'earlier'; items: T[] }[]` (empty groups omitted, order kept).

- [ ] **Step 1: Failing test**

```ts
import { groupByRecency } from './recencyGroups';

const DAY = 86_400_000;
const now = new Date('2026-10-24T15:00:00+05:30').getTime();

describe('groupByRecency', () => {
  it('splits into today, this week and earlier', () => {
    const items = [now - 2 * 3600_000, now - 3 * DAY, now - 20 * DAY];
    const groups = groupByRecency(items, (t) => t, now);
    expect(groups.map((g) => [g.key, g.items.length])).toEqual([['today', 1], ['week', 1], ['earlier', 1]]);
  });
  it('omits empty groups', () => {
    expect(groupByRecency([now - 20 * DAY], (t) => t, now).map((g) => g.key)).toEqual(['earlier']);
  });
});
```

- [ ] **Step 2: Run, see it fail** — `npx jest src/lib/recencyGroups.test.ts`.

- [ ] **Step 3: Implement**

```ts
const DAY_MS = 86_400_000;

/** Groups items by age relative to `now` (epoch ms, local midnight boundaries). */
export function groupByRecency<T>(items: T[], getTime: (t: T) => number, now: number) {
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const todayMs = startOfToday.getTime();
  const weekMs = todayMs - 6 * DAY_MS;
  const buckets = { today: [] as T[], week: [] as T[], earlier: [] as T[] };
  for (const item of items) {
    const t = getTime(item);
    if (t >= todayMs) buckets.today.push(item);
    else if (t >= weekMs) buckets.week.push(item);
    else buckets.earlier.push(item);
  }
  return (['today', 'week', 'earlier'] as const)
    .map((key) => ({ key, items: buckets[key] }))
    .filter((g) => g.items.length > 0);
}
```

- [ ] **Step 4: Rebuild the view**

`BrandBand` title `tx('Files','फ़ाइलें')`, actions sort (`sort`) + `more-vert`, `bandExtra` = white search `TextInput` pill (`tx('Search PDFs on this phone','फ़ोन की PDF खोजें')`) + source tabs inside the band: horizontally scrolling white text tabs (All / Downloads / WhatsApp / Documents / Starred → `सभी / डाउनलोड / व्हाट्सऐप / दस्तावेज़ / स्टार किए`), active = white 15/500 with 3dp white underline, inactive `rgba(255,255,255,0.72)`.
Sheet: `SectionList` from `groupByRecency(filtered, f => f.dateModified ?? Date.parse(f.date), Date.now())`; section headers `tx('Today','आज')`, `tx('This week','इस हफ़्ते')`, `tx('Earlier','पहले')` 14/600 `#3F3F46`; rows 72dp: 40×56 thumbnail with `ring`, name 16 single line, meta `"<size> · <n> pages · <relative time>"` (Hindi: `"<size> · <n> पृष्ठ · <time>"`), star toggle (`star` filled `#C2560A` / `star-border` `ui.inkTertiary`), `more-vert` opening a `BottomSheet` with Open, Edit, Share, Remove from list.
No-access state (F4): centred `folder-open` 56dp brand, title `tx('Find the PDFs on your phone','अपने फ़ोन की PDF ढूँढें')`, body `tx('Allow file access to list PDFs from Downloads, WhatsApp and Documents. The list is made on your phone.','Downloads, WhatsApp और Documents की PDF दिखाने के लिए फ़ाइल की अनुमति दें। सूची आपके फ़ोन पर ही बनती है।')`, `PillButton` `tx('Allow access','अनुमति दें')`, text button `tx('Pick one file instead','एक फ़ाइल चुनें')`. In this state the band shows no tabs.

- [ ] **Step 5: Device check + `npm run check`**, then commit:

```bash
git add mobile-app/src/lib/recencyGroups.* mobile-app/src/screens/FilesScreen.tsx mobile-app/CHANGELOG.md
git commit -m "feat(mobile): rebuild Files with source tabs and date groups"
```

### Task 8: Tools

**Files:** Modify `mobile-app/src/screens/ToolsScreen.tsx` (rewrite)

- [ ] **Step 1: Rebuild**

`BrandBand` title `tx('Tools','टूल')`, `more-vert` action, no subtitle. Sheet content: four groups, heading 14/600 `#3F3F46` (padding 12/16/8), each a 2-column grid (gap 10, padding 0 16) of tiles: white, radius 14, `ring` + elevation 1, padding 14, filled icon 28dp category colour, name 15/600, description 13 `ui.inkSecondary`.

| Group (en / hi) | Tile (en / hi) | Description (en / hi) |
|---|---|---|
| Change text / टेक्स्ट बदलें | Edit Hindi text / हिंदी टेक्स्ट बदलें | Tap a line and type new words / पंक्ति टैप करें, नए शब्द लिखें |
| | Translate / अनुवाद करें | Hindi ⇄ English, needs internet / हिंदी ⇄ अंग्रेज़ी, इंटरनेट चाहिए |
| Pages / पृष्ठ | Merge PDFs / PDF जोड़ें | Join files in your order / अपने क्रम में फ़ाइलें जोड़ें |
| | Split PDF / PDF अलग करें | Keep only the pages you need / सिर्फ़ ज़रूरी पृष्ठ रखें |
| File size / फ़ाइल साइज़ | Compress / छोटा करें | Smaller file for WhatsApp / WhatsApp के लिए छोटी फ़ाइल |
| Reading / पढ़ना | Read / पढ़ें | Open a PDF to read / पढ़ने के लिए PDF खोलें |

- [ ] **Step 2: Device check + check + commit**

```bash
git add mobile-app/src/screens/ToolsScreen.tsx mobile-app/CHANGELOG.md
git commit -m "feat(mobile): rebuild Tools as grouped tiles with descriptions"
```

### Task 9: Settings

**Files:** Modify `mobile-app/src/screens/SettingsScreen.tsx` (rewrite), `mobile-app/src/components/AboutModal.tsx` (becomes `BottomSheet`)

- [ ] **Step 1: Rebuild**

`BrandBand` title `tx('Settings','सेटिंग्स')`. Content:
- Section label `tx('Appearance','दिखावट')` 14/600 brand.
- `UiText` `tx('App language','ऐप की भाषा')` + `SegmentedControl` options `english → 'English'`, `hindi → 'हिंदी'`, `bilingual → tx('Both','दोनों')` (option labels never translated except "Both").
- `tx('Theme','थीम')` + `SegmentedControl` `light → tx('Light','लाइट')`, `dark → tx('Dark','डार्क')`, `system → tx('System','सिस्टम')`.
- Section `tx('App','ऐप')`: `ListRow` icon `system-update`, title `tx('Check for updates','अपडेट जाँचें')`, subtitle `tx('Version','संस्करण') + ' ' + APP_VERSION`; on result use `Dialog` (update ready: `tx('Update ready','अपडेट तैयार है')` / body `tx('A newer version has downloaded. Restart the app to use it. Your files are not affected.','नया संस्करण डाउनलोड हो गया है। इसे इस्तेमाल करने के लिए ऐप फिर से शुरू करें। आपकी फ़ाइलों पर असर नहीं होगा।')` / `tx('Restart now','अभी शुरू करें')` / `tx('Later','बाद में')`) or `Snackbar` (`tx('You have the latest version','आपके पास नया संस्करण है')`).
- Section `tx('About','जानकारी')`: rows `shield` Privacy policy / गोपनीयता नीति (opens `PRIVACY_POLICY_URL`), `star` Rate on Play Store / Play Store पर रेटिंग दें, `share` Share the app / ऐप शेयर करें, `info` About / जानकारी (opens About sheet).

Language change applies instantly to all screens (zustand subscription through `useTx`).

- [ ] **Step 2: Device check (switch to हिंदी and walk every tab) + check + commit**

```bash
git add mobile-app/src/screens/SettingsScreen.tsx mobile-app/src/components/AboutModal.tsx mobile-app/CHANGELOG.md
git commit -m "feat(mobile): rebuild Settings with on-screen language and theme switches"
```

---

## Phase 2 — Pop-ups and tool layout

### Task 10: Replace AppPopup with Dialog / Snackbar / sheets

**Files:**
- Modify: every caller of `showPopup` (`grep -rn "showPopup(" src` — 15 files), `LegacyFontWarning.tsx`, `FontPickerModal.tsx`
- Remove: `AppPopup.tsx`, `appPopupContext.ts` (last step)

- [ ] **Step 1: Map each call**

| Old popup | New |
|---|---|
| "…successfully saved to your chosen folder", "Saved to Files", "Compression complete!", "Translation complete!", "PDF ready to export!" | `ToolDoneScreen` (Task 11) or `snackbar.show(tx('Saved to Downloads','Downloads में सेव हुई'), { label: tx('Open','खोलें'), onPress })` where no Done screen exists |
| "… failed", "Could not open PDF", "File pick error", "Share failed" | `Dialog` with `icon="error"` `iconColor={ui.danger}`, title "Couldn't <verb>" (`tx("Couldn't merge the PDFs",'PDF नहीं जुड़ सकीं')` etc.), body = cause + next step, `confirmLabel={tx('Try again','फिर से करें')}`, `cancelLabel={tx('Close','बंद करें')}` |
| "Select at least 2 files" | inline disabled state on the Merge button + helper text, no dialog |
| "Invalid Page Number" | inline error under the Go-to field |
| Update ready / up to date / failed | as in Task 9 |

- [ ] **Step 2: Rebuild the sheets**

- `LegacyFontWarning` → `BottomSheet` with `font-download-off` icon `#C2560A`, title `tx('This page uses an old Hindi font','इस पृष्ठ में पुराना हिंदी फ़ॉन्ट है')`, meta `tx('Found:','मिला:') + ' ' + fontName`, body `tx("Its lines can't be changed one by one. You can cover old text and type new Hindi on top. The original page stays as it is.",'इसकी पंक्तियाँ एक-एक करके नहीं बदल सकतीं। आप पुराना टेक्स्ट ढककर ऊपर नई हिंदी लिख सकते हैं। मूल पृष्ठ वैसा ही रहता है।')`, primary `tx('Cover and retype','ढककर लिखें')`, tonal `tx('Just read','सिर्फ़ पढ़ें')`. Unknown-encoding variant: `block` icon `ui.danger`, title `tx("We couldn't check this page's font",'इस पृष्ठ का फ़ॉन्ट जाँचा नहीं जा सका')`, body `tx('To keep your text correct, editing is off for this page. You can still read it, or edit other pages.','टेक्स्ट सही रखने के लिए इस पृष्ठ पर एडिट बंद है। आप इसे पढ़ सकते हैं या दूसरे पृष्ठ एडिट कर सकते हैं।')`, only `tx('OK','ठीक है')` (fail-closed rule).
- `FontPickerModal` → `BottomSheet` title `tx('Font','फ़ॉन्ट')`, radio rows per `fontAsset` family with label, Hindi sample "हिंदी दस्तावेज़" rendered in that font, trailing `tx('On phone','फ़ोन पर')` or `download` icon + `tx('Download','डाउनलोड')`; footer `tx('Used for new text on this page','इस पृष्ठ के नए टेक्स्ट के लिए')`.

- [ ] **Step 3: Remove `AppPopupProvider`**, delete the two files, `npm run check`, device check of one error, the old-font sheet (use `fixtures/legacy-krutidev-fixture.pdf`) and the font sheet.

- [ ] **Step 4: Commit**

```bash
git add -A mobile-app/src mobile-app/App.tsx mobile-app/CHANGELOG.md
git commit -m "refactor(mobile): replace AppPopup with dialogs, snackbars and sheets"
```

### Task 11: Tool layout (Merge, Split, Compress, Translate, Done)

**Files:**
- Create: `mobile-app/src/lib/reorder.ts`, `reorder.test.ts`, `mobile-app/src/screens/ToolDoneScreen.tsx`
- Modify: `src/tools/MergePdfTool.tsx`, `SplitPdfTool.tsx`, `CompressPdfTool.tsx`, `TranslatePdfTool.tsx`, `package.json` (gesture deps)

**Interfaces:**
- Produces: `moveItem<T>(list: T[], from: number, to: number): T[]`; `ToolDoneScreen(props: { title: string; fileName: string; fileUri: string; folderLabel: string; pageCount: number; sizeBytes: number; previewUri?: string; onOpen: () => void; onShare: () => void; onClose: () => void })`.

- [ ] **Step 1: Failing test for `moveItem`**

```ts
import { moveItem } from './reorder';

describe('moveItem', () => {
  it('moves an item down', () => {
    expect(moveItem(['a', 'b', 'c'], 0, 2)).toEqual(['b', 'c', 'a']);
  });
  it('moves an item up', () => {
    expect(moveItem(['a', 'b', 'c'], 2, 0)).toEqual(['c', 'a', 'b']);
  });
  it('returns a copy when from equals to', () => {
    const list = ['a'];
    expect(moveItem(list, 0, 0)).not.toBe(list);
  });
  it('clamps out-of-range targets', () => {
    expect(moveItem(['a', 'b'], 0, 9)).toEqual(['b', 'a']);
  });
});
```

- [ ] **Step 2: Implement**

```ts
/** Returns a new array with the item at `from` moved to index `to` (clamped to the list). */
export function moveItem<T>(list: T[], from: number, to: number): T[] {
  const next = list.slice();
  const target = Math.max(0, Math.min(next.length - 1, to));
  const [item] = next.splice(from, 1);
  next.splice(target, 0, item);
  return next;
}
```

Run `npx jest src/lib/reorder.test.ts` → PASS. Replace `moveUp`/`moveDown` internals in `MergePdfTool.tsx` with `moveItem`.

- [ ] **Step 3: Vet drag dependencies**

Check `react-native-gesture-handler` and `react-native-reanimated` versions bundled for Expo SDK 56 (`npx expo install --check` output, Expo SDK 56 changelog), and `react-native-draggable-flatlist` latest release date and open issues for RN 0.85 / New Architecture. Record the result in the commit message. If draggable-flatlist is unmaintained or fails on New Architecture, implement drag with `Gesture.Pan()` + `useAnimatedStyle` on a plain `FlatList` row instead (no third dependency).
Install: `npx expo install react-native-gesture-handler react-native-reanimated` (+ `react-native-draggable-flatlist` only if vetted). Add `GestureHandlerRootView` around the app root in `App.tsx`. Rebuild the dev client (`npx expo run:android`) because these are native.

- [ ] **Step 4: Rebuild Merge**

`ToolScaffold` title `tx('Merge PDFs','PDF जोड़ें')`, primary `tx('Merge ' + n + ' PDFs', n + ' PDF जोड़ें')` disabled when `n < 2` with helper `tx('Add at least 2 files','कम से कम 2 फ़ाइलें जोड़ें')`. Info line `tx(n + ' files · ' + pages + ' pages · hold and drag to change the order', n + ' फ़ाइलें · ' + pages + ' पृष्ठ · क्रम बदलने के लिए दबाकर खींचें')`. Rows 76dp: 40×56 thumb, name, `pages · size`, trailing 48dp `drag-indicator` handle that starts the drag on long-press (`onLongPress` 200 ms). Dragged row: elevation 8, scale 1.02, radius 16, 8dp side inset, handle tints `ui.brand`; haptic `Haptics.selectionAsync()` only if `expo-haptics` is already installed (it is not — skip haptics). Accessibility: each row exposes `accessibilityActions={[{ name: 'moveUp', label: tx('Move up','ऊपर ले जाएँ') }, { name: 'moveDown', label: tx('Move down','नीचे ले जाएँ') }]}` calling `moveItem`. Text button `tx('Add more files','और फ़ाइलें जोड़ें')` with `add` icon.

- [ ] **Step 5: Rebuild Split**

`ToolScaffold` title `tx('Split PDF','PDF अलग करें')`. File row (thumb, name, `pages · size`, text button `tx('Change','बदलें')`). `SegmentedControl` `all → tx('All pages','सभी पृष्ठ')`, `range → tx('Range','रेंज')`, `custom → tx('Pick pages','पृष्ठ चुनें')`. Custom: summary `tx(k + ' of ' + n + ' pages chosen', n + ' में से ' + k + ' पृष्ठ चुने')` + text button `tx('Select all','सभी चुनें')`; 4-column grid of page thumbnails (aspect 1:1.414) with `check-circle` (brand, selected) / `radio-button-unchecked` overlay top-right and a 3dp brand outline when selected; number under each. Primary `tx('Save ' + k + ' pages as a new PDF', k + ' पृष्ठ नई PDF में सेव करें')`.

- [ ] **Step 6: Rebuild Compress**

`ToolScaffold` title `tx('Compress','छोटा करें')`, file row, heading `tx('How small?','कितनी छोटी?')`, three radio `ListRow`s mapping to the existing levels: `strong → tx('Strong','ज़्यादा')` / `tx('Smallest file, pages look softer','सबसे छोटी फ़ाइल, पृष्ठ थोड़े धुंधले')`; `balanced → tx('Balanced','संतुलित')` / `tx('Good for WhatsApp and email','WhatsApp और ईमेल के लिए ठीक')`; `high_quality → tx('High quality','अच्छी क्वालिटी')` / `tx('Sharper pages, bigger file','साफ़ पृष्ठ, बड़ी फ़ाइल')`. Note box (`ui.fill`, radius 12): `tx("Pages are saved as pictures, so text in the new file can't be selected.",'पृष्ठ तस्वीर के रूप में सेव होते हैं, इसलिए नई फ़ाइल का टेक्स्ट चुना नहीं जा सकेगा।')`. Primary `tx('Compress','छोटा करें')`.

- [ ] **Step 7: Rebuild Translate working state**

While running, show centred `translate` icon 48 `ui.category.translate`, title `tx('Translating','अनुवाद हो रहा है')`, progress text from existing `progressMsg` mapped through `tx` (`Reading page ${i} of ${n}` / `पृष्ठ ${i} / ${n} पढ़ा जा रहा है`, `Detecting text on page ${p}` / `पृष्ठ ${p} पर टेक्स्ट ढूँढ़ा जा रहा है`, `Translating ${k} lines on page ${p}` / `पृष्ठ ${p} की ${k} पंक्तियों का अनुवाद`, `Assembling final translated document` / `अनुवादित फ़ाइल बन रही है`), 6dp `ProgressBar` (brand on `#E4E4E7`), meta `tx('Keep the app open until it finishes.','पूरा होने तक ऐप खुला रखें।')`, text button `tx('Cancel','रद्द करें')` that aborts the loop via an `AbortController` flag checked between pages. Leading icon `close`.

- [ ] **Step 8: `ToolDoneScreen`**

Shown by every tool after its existing parse-back validation passes (never before). 160×226 page preview (`previewUri` or rendered first page) with 48dp green `check` badge, title `tx('Saved','सेव हो गई')` 26/600, file name 16, meta `folderLabel · tx(n+' pages', n+' पृष्ठ') · size · tx('opens fine','ठीक से खुलती है')`. Primary `tx('Open','खोलें')` → opens in the Reader; tonal `tx('Share','शेयर करें')`. Leading `close` → back to the tool's tab.

- [ ] **Step 9: Device check each tool with the fixtures** (`fixtures/multipage-fixture.pdf` for Merge/Split/Compress, `fixtures/translation-bilingual-fixture.pdf` for Translate), both languages, dark mode, back button on every step; `npm run check`.

- [ ] **Step 10: Commit per tool** (one commit each for Merge, Split, Compress, Translate, Done):

```bash
git commit -m "feat(mobile): rebuild Merge with drag-to-reorder"
git commit -m "feat(mobile): rebuild Split with page grid"
git commit -m "feat(mobile): rebuild Compress level picker"
git commit -m "feat(mobile): rebuild Translate progress with cancel"
git commit -m "feat(mobile): add shared Saved screen after validated export"
```

---

## Phase 3 — Reader and Editor

### Task 12: Reader shell (reading, menu, scroller, grid, theme)

**Files:**
- Modify: `mobile-app/src/tools/ViewPdfTool.tsx` (shrink to orchestration)
- Create: `src/screens/reader/ReaderMenu.tsx`, `PageScroller.tsx`, `PageGrid.tsx`, `ReadingThemeSheet.tsx`, `FileInfoSheet.tsx`

**Interfaces:**
- `ReaderMenu(props: { visible: boolean; onClose: () => void; onAction: (a: 'find' | 'goto' | 'translate' | 'theme' | 'print' | 'openWith' | 'info') => void })`
- `PageScroller(props: { pageCount: number; currentPage: number; onScrubTo: (page: number) => void; previewUriFor: (page: number) => string | undefined })`
- `PageGrid(props: { visible: boolean; pageCount: number; currentPage: number; thumbUriFor: (page: number) => string | undefined; onPick: (page: number) => void; onClose: () => void })`

- [ ] **Step 1: Reading view**

`ReaderBar` (title = file name, `arrow-back`), actions `search` (opens Find), `share`, `more-vert` (opens menu). Pages: vertical `FlatList`, edge to edge, 6dp gap on `ui.readingBackdrop`, existing render at 2–3× point size (AGENTS performance rule — keep `renderPage` scale unchanged). Page pill `"3 / 12"` top-right (rgba(20,22,31,0.86), 14/500 white) visible while scrolling, fades out 1.5 s after scroll stops. Edit FAB 56dp, radius 16, `ui.brand`, `edit` icon, `accessibilityLabel={tx('Edit','संपादित करें')}`. Tap on a page toggles the bar + FAB (hide on scroll down, show on scroll up — Material behaviour). Single/continuous mode and zoom stay as pinch-zoom inside the list (remove the old mode and zoom buttons).

- [ ] **Step 2: Menu**

Anchored popup menu (RN `Modal` transparent, card at top-right 8dp, radius 16, elevation 8) with rows (icon 22 `#3F3F46` + label 15): `search` Find in file / फ़ाइल में खोजें; `tag` Go to page / पृष्ठ पर जाएँ; `translate` Translate / अनुवाद करें; `contrast` Reading theme / पढ़ने की थीम; `print` Print / प्रिंट करें; `open-in-new` Open with / इससे खोलें; `info` File info / फ़ाइल की जानकारी.

- [ ] **Step 3: Scroller + grid + theme + info**

- `PageScroller`: 4dp track on the right edge, 16×56 brand thumb; on drag show the preview bubble (60×85 thumb, page number 40/700, `tx('of ' + n, n + ' में से')`). Calls `onScrubTo` throttled to 1 per 50 ms.
- `PageGrid`: full-screen modal with `ReaderBar` (`close`, title `tx(n + ' pages', n + ' पृष्ठ')`), 3-column thumbnails, current page outlined 3dp brand, bottom go-to row (`TextInput` numeric `tx('Page number','पृष्ठ संख्या')` + `PillButton` `tx('Go','जाएँ')`, inline error `tx('Enter a page from 1 to ' + n, '1 से ' + n + ' तक पृष्ठ लिखें')`).
- `ReadingThemeSheet`: `BottomSheet` `tx('Reading theme','पढ़ने की थीम')` with `SegmentedControl` `light → tx('Day','दिन')`, `sepia → tx('Sepia','सेपिया')`, `dark → tx('Night','रात')` — reuses the existing `THEMES` map from `ViewPdfTool.tsx` (moved into this file).
- `FileInfoSheet`: rows Name, Pages, Size, Folder, Modified (`तारीख`), read from the opened `RecentFile` (Hindi labels: नाम, पृष्ठ, साइज़, फ़ोल्डर, बदली गई).
- Print: existing `Print.printAsync({ uri })`.

- [ ] **Step 4: Device check** with `fixtures/devanagari-fixture.pdf` and `multipage-fixture.pdf` (scroll, scrub, grid jump, theme, info, print dialog opens), both languages, dark mode, back closes menu → grid → reader in that order. `npm run check`.

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(mobile): rebuild Reader with dark bar, menu, scroller and page grid"
```

### Task 13: Find in file (new)

**Files:**
- Create: `mobile-app/src/lib/textSearch.ts`, `textSearch.test.ts`, `src/screens/reader/FindInFile.tsx`
- Modify: `src/screens/reader/ReaderMenu.tsx` wiring, `ViewPdfTool.tsx`

**Interfaces:**
- `findMatches(pages: { pageIndex: number; lines: string[] }[], query: string): { pageIndex: number; lineIndex: number; before: string; match: string; after: string }[]`

How text is obtained: the app has no PDF text layer API; it already runs on-device OCR (`detectTextLines` in `src/lib/ocr.ts`, ML Kit Devanagari) for the editor. Find runs OCR page by page on demand, caches `OcrLine.text` per page in memory for the open file, and searches as results arrive. The results header says `tx('Searching page ' + i + ' of ' + n, 'पृष्ठ ' + i + ' / ' + n + ' में खोज रहे हैं')` until done.

- [ ] **Step 1: Failing test**

```ts
import { findMatches } from './textSearch';

const pages = [
  { pageIndex: 0, lines: ['कई ज़िलों में प्रशिक्षण शिविर', 'Training camps were held'] },
  { pageIndex: 2, lines: ['पंचायत स्तर पर स्वयंसेवकों का प्रशिक्षण'] },
];

describe('findMatches', () => {
  it('finds Devanagari matches across pages', () => {
    const r = findMatches(pages, 'प्रशिक्षण');
    expect(r.map((m) => [m.pageIndex, m.lineIndex])).toEqual([[0, 0], [2, 0]]);
    expect(r[0]).toMatchObject({ before: 'कई ज़िलों में ', match: 'प्रशिक्षण', after: ' शिविर' });
  });
  it('matches Latin text case-insensitively', () => {
    expect(findMatches(pages, 'training')).toHaveLength(1);
  });
  it('normalises nukta forms so ज़ matches ज़', () => {
    expect(findMatches(pages, 'ज़िलों'.normalize('NFD'))).toHaveLength(1);
  });
  it('returns nothing for blank queries', () => {
    expect(findMatches(pages, '  ')).toEqual([]);
  });
});
```

- [ ] **Step 2: Implement**

```ts
const norm = (s: string) => s.normalize('NFC').toLocaleLowerCase('en');

/** Finds every occurrence of `query` in OCR lines. Indices are 0-based page and line numbers. */
export function findMatches(pages: { pageIndex: number; lines: string[] }[], query: string) {
  const q = norm(query.trim());
  if (!q) return [];
  const out: { pageIndex: number; lineIndex: number; before: string; match: string; after: string }[] = [];
  for (const page of pages) {
    page.lines.forEach((raw, lineIndex) => {
      const line = raw.normalize('NFC');
      const hay = norm(line);
      let from = 0;
      for (let at = hay.indexOf(q, from); at !== -1; at = hay.indexOf(q, from)) {
        out.push({ pageIndex: page.pageIndex, lineIndex, before: line.slice(0, at), match: line.slice(at, at + q.length), after: line.slice(at + q.length) });
        from = at + q.length;
      }
    });
  }
  return out;
}
```

Run `npx jest src/lib/textSearch.test.ts` → PASS.

- [ ] **Step 3: UI**

`ReaderBar` swaps to a search field (`close` leading, autofocus `TextInput`, clear button). Bottom sheet (330dp) title `tx(count + ' matches', count + ' परिणाम')` with up/down 44dp buttons; rows `p. N` + before/**match**/after (match in brand, 600). Tapping a row scrolls to the page and draws `OcrHighlightLayer` boxes (existing component) around matched lines; current match filled `ui.brand` at 30%, others `ui.brandTint`. Empty: `tx('No matches','कोई परिणाम नहीं')`. Scanned pages without text: same OCR path works.

- [ ] **Step 4: Device check** on `devanagari-fixture.pdf` (search a word you can see on page 1 and one only on a later page), both languages; `npm run check`; commit:

```bash
git commit -m "feat(mobile): add Find in file using on-device OCR"
```

### Task 14: Open with (new)

**Files:** Modify `ViewPdfTool.tsx` (menu handler), `package.json`

- [ ] **Step 1: Vet** `expo-intent-launcher` for SDK 56 (first-party Expo package; check its SDK 56 changelog entry). Install with `npx expo install expo-intent-launcher`.

- [ ] **Step 2: Implement**

```ts
import * as IntentLauncher from 'expo-intent-launcher';
import * as FileSystem from 'expo-file-system/legacy';

/** Opens the current PDF in another app chosen by the user. `uri` is a file:// or content:// URI. */
async function openWith(uri: string): Promise<void> {
  const contentUri = uri.startsWith('content://') ? uri : await FileSystem.getContentUriAsync(uri);
  await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
    data: contentUri,
    type: 'application/pdf',
    flags: 1, // FLAG_GRANT_READ_URI_PERMISSION
  });
}
```

If no app can open it, catch and show `Dialog` `tx('No app can open this PDF','इस PDF को खोलने वाला कोई ऐप नहीं मिला')`.

- [ ] **Step 3: Device check** (opens chooser with Drive/Files), `npm run check`, commit:

```bash
git commit -m "feat(mobile): add Open with to the Reader menu"
```

### Task 15: Editor (tools, line sheet, save sheet)

**Files:**
- Modify: `mobile-app/src/tools/EditPdfTool.tsx` (orchestration), `src/components/EditToolbar.tsx` (replace)
- Create: `src/screens/editor/EditToolbarBar.tsx`, `LineEditSheet.tsx`, `SaveSheet.tsx`

**Interfaces:**
- `EditToolbarBar(props: { mode: EditMode; onMode: (m: EditMode) => void; canUndo: boolean; canRedo: boolean; onUndo: () => void; onRedo: () => void; showingOriginal: boolean; onToggleOriginal: () => void })` — `EditMode` is the existing `'edit' | 'addText' | 'erase'`.
- `LineEditSheet(props: { originalText: string; value: string; onChange: (s: string) => void; fontLabel: string; sizePt: number; color: string; bold: boolean; onFont: () => void; onSize: (pt: number) => void; onColor: (c: string) => void; onBold: () => void; onDone: () => void })` — `sizePt` in pt, matching `TextEdit.fontSize` units.
- `SaveSheet(props: { visible: boolean; defaultName: string; changedSummary: string; onSave: (name: string) => void; onShare: () => void; onClose: () => void })`.

- [ ] **Step 1: Editor chrome**

`ReaderBar` leading `close` (confirm discard via `Dialog` `tx('Discard changes?','बदलाव हटाएँ?')` when edits exist), title file name, actions: `PillButton`-style 40dp `tx('Save','सेव करें')` + `more-vert`. Detected OCR lines get `ui.brandTint` backgrounds (existing `OcrHighlightLayer`). Hint pill `tx('Tap a line to change it','बदलने के लिए पंक्ति टैप करें')` shown until the first edit.

- [ ] **Step 2: Floating toolbar**

`EditToolbarBar`: dark pill (`ui.chrome`, radius 9999, elevation 8) 12dp from the edges, 24dp above bottom inset; 48dp icon buttons: `edit` (Change text / टेक्स्ट बदलें), `title` (Add text / टेक्स्ट जोड़ें), `format-color-reset` (Cover old text / पुराना टेक्स्ट ढकें), divider, `undo`, `redo` (disabled 40% opacity), `visibility` (Show original / मूल देखें — while held, hide overlays). Active mode: `ui.brand` circle.

- [ ] **Step 3: Line edit sheet above the keyboard**

On tapping a line: the page line gets brand underline + tint (live preview of the new text through the existing `EditableTextOverlay`), and `LineEditSheet` docks above the keyboard (`KeyboardAvoidingView behavior="height"` on Android, or `Keyboard` listeners already used in `EditPdfTool`). Contents: `tx('Was:','पहले:')` + original line (Noto Sans Devanagari 13); multiline `TextInput` 18dp Devanagari, 2dp brand border, radius 16; chips row: Font (opens font `BottomSheet` from Task 10), `13 pt` (tap cycles a small size picker: − / value / +), colour dot (default = sampled ink colour from `sampleTextColor`), `B`; `PillButton` `tx('Done','हो गया')`. All user text still goes through `escapeHtml` in `htmlCompositor.ts` (unchanged).

- [ ] **Step 4: Save sheet → Done**

`SaveSheet`: `BottomSheet` title `tx('Save as a new PDF','नई PDF के रूप में सेव करें')`, `verified-user` green line `tx('Your original file is never changed.','आपकी मूल फ़ाइल कभी नहीं बदलती।')`, label `tx('File name','फ़ाइल का नाम')`, `TextInput` default `<name>-edited`, meta `changedSummary` (`tx(lines + ' lines changed on ' + pages + ' pages', pages + ' पृष्ठों पर ' + lines + ' पंक्तियाँ बदलीं')`), primary `tx('Save to phone','फ़ोन में सेव करें')`, tonal `tx('Share','शेयर करें')`. After the existing export + parse-back validation succeeds, route to `ToolDoneScreen`.

- [ ] **Step 5: Shaping verification (AGENTS rule for Devanagari phases)**

Export `fixtures/devanagari-fixture.pdf` after changing one conjunct line and one reph line; open the result in the Reader and on the Mac (`pdftoppm -r 150`), and describe the conjuncts, matras and reph in the commit message. Do not mark done from code alone.

- [ ] **Step 6: Device check** (both languages, dark mode, back: font sheet → line sheet → discard dialog → close), `npm run check`.

- [ ] **Step 7: Commits**

```bash
git commit -m "feat(mobile): rebuild editor chrome and floating toolbar"
git commit -m "feat(mobile): add line edit sheet above the keyboard"
git commit -m "feat(mobile): add save-as-new sheet and Saved screen to editor"
```

---

## Phase 4 — Release quality

### Task 16: Whole-app native QA pass

- [ ] **Step 1: Matrix on the USB phone** — for each of Home, Files (with and without access), Tools, Settings, Merge, Split, Compress, Translate, Reader (+ menu, scroller, grid, find, theme, info, open with), Editor (+ line sheet, font sheet, old-font sheet with `legacy-krutidev-fixture.pdf`, save sheet, Saved): English, Hindi, Both, light, dark, system font size 130% (Android Settings › Display size and text). Record pass/fail in a table in the PR description.
- [ ] **Step 2: TalkBack** — every screen reachable and every control named.
- [ ] **Step 3: Back button** — no screen exits the app unexpectedly; sheets close first.
- [ ] **Step 4: Copy audit** — `grep -rn "'[A-Z][a-z].*'" src/screens src/tools src/ui src/screens/reader src/screens/editor` and confirm every user-facing string is inside `tx(…)`; no "100%", no "offline" claims.
- [ ] **Step 5: Docs in the same commit** — `mobile-app/CHANGELOG.md` (new "Native UI redesign" section), `mobile-app/hindi-pdf-editor-spec.md` UI section, `AGENTS.md` rule 6 (Home layout description) if changed.
- [ ] **Step 6: Release build** — bump `versionCode` in `app.config.ts`, `npm run build:preview`, install the APK on the phone, repeat a smoke pass of Home → Edit → Save.

```bash
git commit -m "docs(mobile): record native UI redesign in spec and changelog"
```

---

## Open decision (default applied)

- **"Both" language:** `pickText` returns `"English · हिंदी"`. Screens were designed single-language, so "Both" can overflow on tiles and tabs. Default kept because Settings S2 shows the option; if overflow appears in Task 16, either truncate with `numberOfLines={1}` or drop the option (one-line change in Task 9).
