# 0015 — Keep tool outputs in app storage, not the cache

**Status:** Accepted. Amends ADR 0013.

## Context

Merge, Split, Compress and Translate wrote their output to `cacheDirectory` and added that cache URI to Files. Android may delete cache files under storage pressure, and "Clear cache" deletes them for certain, so Files and Home would point at missing files. The redesigned Saved screen also said the file was in "Files" and "opens fine", which the code did not back. The editor already copied its export into `documentDirectory/Edited/`.

## Decision

- One module, `src/lib/persistOutput.ts`, copies a tool's verified temporary output into `documentDirectory/<Edited|Merged|Split|Compressed|Translated>/`. It cleans the name (`outputFileName`), adds ` (n)` instead of overwriting, runs `verifyPdfOutput` on the copy, and deletes the cache file. A failed copy is deleted and the error reaches the tool's error dialog, never the Saved screen. It deletes only files inside the cache, so a source can never be removed.
- Files and Home record the permanent URI.
- The Saved screen says the file is saved in this app and listed in Files, and that Share or Open with put it in another app. The editor's button reads "Save in this app".

## Rejected

- Writing straight to a shared folder (Downloads) on every save: it needs SAF or MediaStore permission prompts on every save. "Save a copy to a folder" already covers it when the person wants it.
- Keeping the cache and only changing the copy: true, but files would still disappear from Files without warning.

## Consequences

- Outputs survive a cache clear but are removed when the app is uninstalled or its data is cleared.
- Removing a file from the Files list does not delete its copy; app-storage cleanup is a later task.
