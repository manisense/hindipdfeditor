# Privacy Policy — Hindi PDF Editor

**Last updated:** 23 July 2026
**App:** Hindi PDF Editor (`com.hindipdfeditor.app`)
**Developer:** Manisense
**Public URL:** `https://hindipdfeditor.com/privacy/`

## Summary

Hindi PDF Editor is a local-first Android app. You pick PDFs from your device, edit text, and export a new PDF. Core editing stays on your phone. Only content you explicitly submit to AI OCR or Translate is sent through our secured API to Google Gemini.

## Data we collect

We do not sell personal data. The app has no analytics SDK, advertising SDK, or account system. Our AI API processes submitted page images or detected lines transiently, and stores only an anonymous client hash plus daily document/page quota records. It does not log document content.

## Website analytics

The public website at `hindipdfeditor.com` may use Google Analytics after a Google Analytics measurement ID is configured. Google Analytics may process technical information such as page views, browser/device details, approximate location, and referral source. This does not change the Android app's local-first behavior.

## Data processed on your device

When you use the app, the following stays on your device unless you explicitly export or share a file:

- PDF files you open (read-only; exports are new files)
- Edits you make (text, masks, positions)
- Rasterized page images used for editing and on-device OCR

## Optional AI OCR and Translate

If you explicitly use **AI OCR** or **Translate**:

- AI OCR sends the current page image through `api.hindipdfeditor.com` to Google's Gemini API.
- Translate sends detected source-language lines, not the whole PDF, through the same service.
- The Gemini API credential is held only as a server secret and is never shipped in the app.
- Gemini requests are made with response storage disabled. Google still processes submitted content under its applicable API terms and privacy practices.
- Anonymous daily quota records expire after operational retention; document content is not stored in our quota database or content logs.

You can use the full app without this feature; on-device OCR (ML Kit) works offline with no network call.

## Permissions

| Permission   | Why                                                    |
| ------------ | ------------------------------------------------------ |
| **Internet** | Optional AI OCR/Translate and user-requested downloads |
| **Vibrate**  | Standard system feedback (if used by the OS/keyboard)  |

The app uses the system document picker to open PDFs — it does **not** request broad storage access on modern Android.

## Children's privacy

The app is not directed at children under 13. We do not knowingly collect data from children.

## Data retention

All document data is under your control on your device. Uninstalling the app removes app-private storage. Exported PDFs remain where you saved or shared them.

## Changes

We may update this policy. The in-app **About → Privacy policy** link will point to the latest version in the project repository.

## Contact

Issues and privacy questions: [support@hindipdfeditor.com](mailto:support@hindipdfeditor.com)
