# 0011 — Run PdfRenderer in a separate `:pdfrender` process

**Status:** Accepted. Amends ADR 0004 (the in-house `pdf-page-image` module stays; only where its PdfRenderer calls run changes).

## Context

Play Console reported native crashes inside the system PDF engine on version 1.0.0 (versionCode 6):

- `[libpdfium.so] CPDF_Page::~CPDF_Page()` SIGSEGV
- `[libpdfium.so] CPDF_Document::CPDF_Document(CPDF_Parser*)` SIGSEGV

`android.graphics.pdf.PdfRenderer` is a thin wrapper over the device's own pdfium. The version varies by device and Android release, and older ones segfault on some malformed, truncated or hostile files. A SIGSEGV can't be caught from Kotlin or JS, so the whole app died.

Our own calls were already serialised: Expo runs every `AsyncFunction` on one `expo.modules.AsyncFunctionQueue` thread. Concurrency inside the app is therefore not the likely cause. Exposure is. The Files tab mounts at app start, scans the device and renders a thumbnail of every visible PDF, including WhatsApp downloads still being written and files the user never chose to open.

## Decision

Every PdfRenderer call now runs in `PdfRenderService`, a non-exported bound service declared with `android:process=":pdfrender"` in the module's manifest.

- `PdfRenderClient`, in the app process, binds on first use. It sends the source file descriptor and arguments in a plain `Parcel` over a synchronous `IBinder.transact`, with no AIDL.
- When pdfium kills the helper, `transact` throws `DeadObjectException`. The client turns that into a normal `PdfRendererCrashedException` ("the file may be damaged or unsupported"), drops the binder, and the next call starts a fresh process.
- The service serialises pdfium behind one lock. Binder calls arrive on a thread pool, and the framework's own lock only exists from API 26; minSdk is 24.
- The service caps a page bitmap at 16M px. Larger pages render at a proportionally lower scale. The reply carries the page size in points, so callers no longer compute pt as px / scale, which would be wrong for capped pages.
- The rendered JPEG is written straight to the app's cache directory. It's the same app and UID, so no bytes are copied over binder.

Colour sampling (`sampleAverageColor`, `sampleTextColor`) stays in-process. It only decodes JPEGs this app wrote itself, so pdfium is never involved.

## Rejected alternatives

- **A lock around in-process PdfRenderer calls.** The calls were already serialised, so a lock would not stop a crash on a bad file.
- **Bundling a newer pdfium (for example `pdfium-android`).** This adds a third-party native dependency, and a bad file still crashes in-process. The engine would be newer but no less fatal.
- **Validating PDFs with pdf-lib before rendering.** This would not catch pdfium-specific bugs, and it costs a full JS parse per file.

## Consequences

- A damaged PDF now shows an error, or a placeholder thumbnail, instead of closing the app.
- The first render after launch or after a crash pays the process start-up cost, roughly 100–300 ms. The helper process uses its own memory, which also keeps large page bitmaps off the app's heap.
- Android runs `Application.onCreate` in every process, so the helper also loads React Native's native libraries at start-up. It never creates a React instance. expo-updates only initialises from `onCreate` under instrumentation tests, so it doesn't touch its database from the helper. Anything added to `MainApplication.onCreate` later must stay safe to run in a second process.
- This needs a device check. No Android SDK or device was available in the session that made this change (see CHANGELOG).
