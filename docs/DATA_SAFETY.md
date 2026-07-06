# Google Play — Data safety form (draft answers)

Use these answers when filling out **Play Console → App content → Data safety**. Adjust if your published privacy policy URL or behavior changes.

## Overview

- **Does your app collect or share user data?** Yes (only when user opts into Enhance with AI — data goes to Google, not to developer servers)
- **Is all data encrypted in transit?** Yes (HTTPS to Gemini when AI feature is used)
- **Can users request data deletion?** N/A for developer — no developer-hosted data; users delete local data by uninstalling

## Data types

### Optional — User-provided files (PDF page images)

| Field | Value |
|-------|--------|
| Collected? | Only if user taps Enhance with AI |
| Shared? | Yes — with Google (Gemini API) |
| Purpose | App functionality (OCR) |
| Required? | No — optional feature |
| Ephemeral? | Processed by Google per their policy; not stored by developer |

### Optional — Other (API key)

| Field | Value |
|-------|--------|
| Collected? | Stored locally on device only |
| Shared? | No (sent to Google only as auth header by user's action) |
| Purpose | App functionality |

## Data NOT collected by developer

- Name, email, phone
- Location
- Contacts
- Financial info
- Photos/videos (except page images user explicitly sends via AI feature)
- Analytics / advertising identifiers

## Security practices

- Data encrypted in transit (TLS for Gemini)
- Users can use app fully offline without AI feature
- No developer backend

## Privacy policy URL

`https://github.com/manisense/hindi-pdf-editor/blob/main/docs/PRIVACY_POLICY.md`

*(Recommended: host a rendered copy on GitHub Pages before final submission.)*
