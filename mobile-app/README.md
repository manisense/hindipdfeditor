# Hindi PDF Editor

Edit Hindi and English text in scanned or digital PDFs on Android — tap to change text in place, export a new PDF. Fully offline for core editing.

## Features

- Tap-to-edit scanned PDF text (on-device ML Kit OCR)
- Live Devanagari shaping while typing
- Mask-and-replace for text OCR misses (hold and drag)
- Multi-page PDF support
- Export via print pipeline (no corrupting the original file)
- Optional consent-gated AI OCR through the production service
- Hindi → English and English → Hindi translation; no API key entry

## Development

**Stack:** Expo SDK 56, React Native 0.85, TypeScript strict.

**Requirements:** Node 22, Android SDK, USB device or emulator.

```bash
npm install
npx expo run:android          # dev client (custom native modules)
npm start                     # Metro for dev client
npm run check                 # lint, typecheck, tests, Prettier
npx expo install --check      # dependency versions match the SDK
```

EAS runs `npm ci` with npm 10. After changing dependencies, confirm the lock file with `npx npm@10 ci --dry-run --ignore-scripts`.

## Play Store release

Production builds use **EAS Build** — not the local debug APK.

```bash
npm install -g eas-cli
eas login
eas init                      # link project; update app.config.ts projectId
eas build -p android --profile production
```

See **[docs/PLAY_STORE.md](docs/PLAY_STORE.md)** for the full checklist, **[docs/PRIVACY_POLICY.md](docs/PRIVACY_POLICY.md)** for privacy, and **[docs/STORE_LISTING.md](docs/STORE_LISTING.md)** for listing copy.

## Architecture

- **Plan A — Render & Print:** Devanagari via WebView/HTML export (`expo-print`), never `pdf-lib` `drawText()`
- **Native modules:** `pdf-page-image` (rasterize), `text-recognition` (ML Kit OCR)
- Spec: `hindi-pdf-editor-spec.md` · Decisions: `docs/decisions/`

## PDF libraries

Edits are never written into the original PDF. Each page is rasterized, edits are composed over it as HTML in Noto Sans Devanagari, and the result is printed to a new PDF.

| Job                             | Library                                                                                    | License                      |
| ------------------------------- | ------------------------------------------------------------------------------------------ | ---------------------------- |
| Page → image                    | `pdf-page-image` (in-house, wraps Android `PdfRenderer`)                                   | Android platform             |
| HTML → PDF export               | `expo-print`                                                                               | MIT                          |
| Merge, split, output parse-back | `@cantoo/pdf-lib`                                                                          | MIT                          |
| On-device OCR                   | `text-recognition` (in-house, wraps Google ML Kit Text Recognition v2, Latin + Devanagari) | ML Kit is proprietary (free) |

Keep the MIT/Apache copyright notices of bundled open-source libraries in the app's licenses screen.

## Known issues

- Expo SDK 56 ships Hermes V1 250829098.0.10, which has a known memory regression (`npx expo-doctor`). The fix needs Expo SDK 57 (React Native 0.86.2+). Upgrading the SDK is a separate, device-tested task.
- Remaining `npm audit` findings sit in Expo CLI build tooling (`@expo/cli`, `zod`, `image-size`) and clear only with a newer SDK; none ship in the app bundle.

## License

Private / unpublished — see repository owner.
