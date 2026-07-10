# Google Play, Analytics, and Search Console setup

Use this as the field guide while creating the Play Console app and connecting
`hindipdfeditor.com` to Google services.

## Play Console: Create app fields

| Field            | Value                                                                                                                                       |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| App name         | `Hindi PDF Editor`                                                                                                                          |
| Package name     | `com.hindipdfeditor.app`                                                                                                                    |
| Default language | Prefer `English (India) - en-IN` if available; otherwise use `English (United States)` or the closest English option shown in Play Console. |
| App or game      | `App`                                                                                                                                       |
| Free or paid     | `Free`                                                                                                                                      |

Important: the package name is permanent after the first upload. Free apps also cannot later be
changed to paid, so keep monetization as optional in-app/website plans later rather than making the
Play listing paid now.

## Recommended Play Console setup values

| Section            | Value                                                                   |
| ------------------ | ----------------------------------------------------------------------- |
| Category           | `Productivity`                                                          |
| Tags               | PDF editor, Hindi, Devanagari, OCR, document editor                     |
| Website            | `https://hindipdfeditor.com/`                                           |
| Privacy policy     | `https://hindipdfeditor.com/privacy/`                                   |
| Support URL        | `https://hindipdfeditor.com/support/`                                   |
| Support email      | `support@hindipdfeditor.com`                                            |
| Ads declaration    | No ads                                                                  |
| App access         | All features available without login                                    |
| Target audience    | Not designed for children                                               |
| News app           | No                                                                      |
| Government app     | No                                                                      |
| Financial features | No                                                                      |
| Health app         | No                                                                      |
| Data safety        | Use `docs/DATA_SAFETY.md` and `https://hindipdfeditor.com/data-safety/` |

## Do we need Google Cloud Console?

Not for manual Play Store publishing.

You only need Google Cloud Console if you want automation such as `eas submit` or another CI system
to upload releases through the Google Play Developer API. For that path, create a Google Cloud
project, enable the Google Play Developer API, create a service account, download its JSON key, and
grant that service account the required Play Console permissions.

For the first release, manual upload in Play Console is simpler and avoids managing service-account
secrets.

## Google Analytics for the website

1. Create a Google Analytics 4 property.
2. Create a Web data stream for `https://hindipdfeditor.com`.
3. Copy the Measurement ID. It starts with `G-`.
4. Put that ID in `../web-app/assets/analytics.js`:

```js
const GOOGLE_ANALYTICS_ID = 'G-XXXXXXXXXX';
```

The loader is currently inactive because the ID is blank. After the ID is set, all website pages
will load Google Analytics through the shared script.

## Google Search Console

1. Open Google Search Console.
2. Add a Domain property for `hindipdfeditor.com`.
3. Copy the DNS TXT verification record Google gives you.
4. Add that TXT record in Cloudflare DNS for `hindipdfeditor.com`.
5. Return to Search Console and click Verify after DNS propagation.
6. Submit sitemap: `https://hindipdfeditor.com/sitemap.xml`.

Use a Domain property rather than a URL-prefix property because it covers apex, `www`, HTTP, and
HTTPS variants through one DNS verification.
