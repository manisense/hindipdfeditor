# Play Store submission checklist

## Before you build

- [ ] Create [Expo account](https://expo.dev) and run `eas login`
- [ ] Run `eas init` in this repo — replace `REPLACE_WITH_EAS_PROJECT_ID` in `app.config.ts` with the real project ID
- [ ] Create [Google Play Console](https://play.google.com/console) app listing (`com.manisense.hindipdfeditor`)
- [ ] Host privacy policy at a stable public URL (GitHub Pages recommended; update `privacyPolicyUrl` in `app.config.ts`)

## Build production AAB

```bash
npm install
eas build --platform android --profile production
```

EAS will:

- Run `expo prebuild` with `app.config.ts` (blocked permissions, minify, shrink resources)
- Sign the AAB with EAS-managed credentials (or your upload key)
- Produce an `.aab` for Play Console

**Do not** ship the local debug APK (`assembleDebug`) — it uses the debug keystore.

## Store listing assets (prepare in Play Console)

| Asset | Requirement |
|-------|-------------|
| App icon | 512×512 PNG — use `assets/icon.png` |
| Feature graphic | 1024×500 PNG |
| Phone screenshots | Min 2; 16:9 or 9:16; show tap-to-edit + export |
| Short description | ≤ 80 chars — see `docs/STORE_LISTING.md` |
| Full description | ≤ 4000 chars — see `docs/STORE_LISTING.md` |
| Privacy policy URL | Required |
| Content rating | Complete IARC questionnaire (likely Everyone / low maturity) |
| Target audience | Not designed for children |

## App content declarations

- [ ] **Data safety** — use `docs/DATA_SAFETY.md`
- [ ] **Ads** — No ads
- [ ] **Government apps** — No
- [ ] **Financial features** — No
- [ ] **Health** — No
- [ ] **Foreground service** — No

## Testing tracks

1. **Internal testing** — upload AAB, add testers
2. **Closed testing** — wider group, fix crashes
3. **Production** — staged rollout (start 10%)

## Submit via EAS (optional)

```bash
eas submit --platform android --profile production
```

Requires Google Play service account JSON (add path in `eas.json` → `submit.production.android.serviceAccountKeyPath`). Add `google-play-service-account.json` to `.gitignore` (already ignores `*.json` patterns for keys — add explicit entry).

## Post-launch

- [ ] Update `playStoreUrl` in `app.config.ts` after listing is live
- [ ] Bump `version` + `android.versionCode` (or use `autoIncrement` in `eas.json` production profile)
