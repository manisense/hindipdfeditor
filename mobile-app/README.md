# Hindi PDF Editor

Edit Hindi and English text in scanned or digital PDFs on Android — tap to change text in place, export a new PDF. Fully offline for core editing.

## Features

- Tap-to-edit scanned PDF text (on-device ML Kit OCR)
- Live Devanagari shaping while typing
- Mask-and-replace for text OCR misses (hold and drag)
- Multi-page PDF support
- Export via print pipeline (no corrupting the original file)
- Optional Enhance with AI (your Gemini API key)

## Development

**Requirements:** Node 20+, Android SDK, USB device or emulator.

```bash
npm install
npx expo run:android          # dev client (custom native modules)
npm start                     # Metro for dev client
npm test
npm run lint
```

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

## License

Private / unpublished — see repository owner.
