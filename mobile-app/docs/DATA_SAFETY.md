# Google Play — Data safety form (draft answers)

Use these answers when filling out **Play Console → App content → Data safety**. Adjust if your published privacy policy URL or behavior changes.

## Overview

- **Does your app collect or share user data?** Yes, only for user-triggered AI OCR or Translate.
- **Is all data encrypted in transit?** Yes (HTTPS to the production API and Google Gemini).
- **Can users request data deletion?** Content is processed transiently; users can contact support about anonymous quota metadata.

## Data types

### Optional — User-provided files (PDF page images)

| Field      | Value                                                         |
| ---------- | ------------------------------------------------------------- |
| Collected? | Only if user explicitly uses AI OCR                           |
| Shared?    | Processed by our API and Google Gemini                        |
| Purpose    | App functionality (OCR)                                       |
| Required?  | No — optional feature                                         |
| Ephemeral? | Processed by Google per their policy; not stored by developer |

### Optional — Detected text lines

| Field      | Value                                  |
| ---------- | -------------------------------------- |
| Collected? | Only if user explicitly uses Translate |
| Shared?    | Processed by our API and Google Gemini |
| Purpose    | Hindi ↔ English translation            |

## Data NOT collected by developer

- Name, email, phone
- Location
- Contacts
- Financial info
- Photos/videos (except page images user explicitly sends via AI feature)
- Analytics / advertising identifiers

## Security practices

- Data encrypted in transit (TLS)
- Users can use app fully offline without AI feature
- AI credential is server-side only; content is not written to quota storage or content logs

## Public URLs

- Privacy policy: `https://hindipdfeditor.com/privacy/`
- Public data safety summary: `https://hindipdfeditor.com/data-safety/`
- Support: `https://hindipdfeditor.com/support/`
