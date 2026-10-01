# 0012 — Portrait on phones, rotation on large screens

**Status:** Accepted.

## Context

`app.config.ts` locked the whole app to portrait. Play Console flagged the lock under "Remove resizability and orientation restrictions … to support large screen devices". Android 16 ignores an orientation lock on displays at least 600dp wide for apps targeting API 36, so tablets and foldables would rotate anyway. They would do so without layouts that expect it: the tab pager and the viewer read the window width only once.

The home screen, however, is a fixed, non-scrolling layout by design (AGENTS.md, rule 6). It does not fit a phone in landscape.

## Decision

- The manifest declares no orientation (`orientation: 'default'`).
- `src/hooks/useOrientationPolicy.ts` locks phones to portrait at runtime with `expo-screen-orientation`. A screen whose shorter side is at least 600dp is unlocked. The check re-runs when the window size changes, for example when a foldable is unfolded.
- Layouts read widths with `useWindowDimensions`. The tab pager re-aligns to the active tab when the width changes, and starts on that tab when it remounts after a tool closes.

`expo-screen-orientation` is Expo's first-party module, pinned to the SDK 56 version from `expo/bundledNativeModules.json`. Its config plugin only affects iOS, so it isn't registered.

## Rejected alternatives

- **Keep the manifest lock.** It keeps the Play warning, and Android 16 overrides it on large screens anyway.
- **Rotate everywhere and make the home screen scroll in landscape.** This breaks the fixed home-screen rule for a layout few phone users would choose.

## Consequences

- Tablets and foldables get landscape. Every screen still needs a visual check there on a real large-screen device or emulator. None was available when this was written.
