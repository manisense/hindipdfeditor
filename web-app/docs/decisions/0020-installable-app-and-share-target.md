# 0020 — Installable web app that receives shared files

Date: 27 November 2026

## Decision

The website is an installable web app: `manifest.webmanifest` (standalone, brand icons at 192 and 512 px, also maskable) and a root service worker, `sw.js`. Its manifest declares a Web Share Target, so on Android the installed app appears in the share sheet for PDFs, JPG/PNG/WebP images and .docx files.

- The service worker only answers `POST /share-target/`: it stores the shared files in IndexedDB (`hpe-shared-files`) and redirects to `/share/`. It caches nothing, so an installed app always runs the current deploy.
- `/share/` (noindex) lists the files and the tools that can open them (`toolsForSharedFiles`). A tool opened with `?shared=1` gets the files through its file picker (`DropZone`), which takes them once and deletes them; unopened shares are dropped after an hour.
- If the service worker is not running, the Worker answers the POST with a redirect to `/share/?error=receive`, which asks the user to open the app once and share again.

## Reason

People in India receive most PDFs on WhatsApp, Android is about 94 % of their phones, and the Android app is on hold. Sharing straight into the web app removes the download-then-upload step without a store release, and the files stay on the device.

## Rejected

- Offline caching of the app shell: an installed app could keep running an old build after a deploy, and the editor's OCR and font files are large. Revisit with a versioned cache if users ask for offline use.
- Passing files through the URL or a server: files must stay on the device.
- A Play Store wrapper (Trusted Web Activity) in this change: it needs the owner's decision on a new listing or replacing `com.hindipdfeditor.app`.
