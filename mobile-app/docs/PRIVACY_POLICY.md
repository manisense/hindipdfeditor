# Privacy Policy — Hindi PDF Editor

**Last updated:** 7 July 2026
**App:** Hindi PDF Editor (`com.hindipdfeditor.app`)
**Developer:** Manisense
**Public URL:** `https://hindipdfeditor.com/privacy/`

## Summary

Hindi PDF Editor is a local-first Android app. You pick PDFs from your device, edit text, and export a new PDF. **We do not operate servers that receive your documents.** Everything below describes what happens on your phone and what optional third-party services you may choose to use.

## Data we collect

**We do not collect, store, or sell your personal data on our own servers.** The app has no analytics SDK, no advertising SDK, and no account system.

## Website analytics

The public website at `hindipdfeditor.com` may use Google Analytics after a Google Analytics measurement ID is configured. Google Analytics may process technical information such as page views, browser/device details, approximate location, and referral source. This does not change the Android app's local-first behavior.

## Data processed on your device

When you use the app, the following stays on your device unless you explicitly export or share a file:

- PDF files you open (read-only; exports are new files)
- Edits you make (text, masks, positions)
- Rasterized page images used for editing and on-device OCR
- Your Gemini API key (if you use Enhance with AI), stored in Android encrypted storage (`expo-secure-store`)

## Optional: Enhance with AI

If you tap **Enhance with AI** and provide a Google Gemini API key:

- The **current page image** is sent to **Google's Gemini API** for text detection
- This uses **your** API key and **your** Google account terms
- We do not see or store your API key on any server we operate — it remains on your device
- You can clear the key by reinstalling the app or removing it when prompted after an invalid key

You can use the full app without this feature; on-device OCR (ML Kit) works offline with no network call.

## Permissions

| Permission   | Why                                                   |
| ------------ | ----------------------------------------------------- |
| **Internet** | Only for optional Enhance with AI (Gemini API)        |
| **Vibrate**  | Standard system feedback (if used by the OS/keyboard) |

The app uses the system document picker to open PDFs — it does **not** request broad storage access on modern Android.

## Children's privacy

The app is not directed at children under 13. We do not knowingly collect data from children.

## Data retention

All document data is under your control on your device. Uninstalling the app removes app-private storage. Exported PDFs remain where you saved or shared them.

## Changes

We may update this policy. The in-app **About → Privacy policy** link will point to the latest version in the project repository.

## Contact

Issues and privacy questions: [support@hindipdfeditor.com](mailto:support@hindipdfeditor.com)
