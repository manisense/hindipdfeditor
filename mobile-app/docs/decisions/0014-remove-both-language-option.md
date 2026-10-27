# 0014 — Remove the "Both" language option

**Status:** Accepted. Amends ADR 0013.

## Context

The app language setting offered English, हिंदी and Both. "Both" made `pickText` join every label as `English · हिंदी`. The redesigned screens (ADR 0013) are single-language and sized for one label per control. The joined text overflowed Home tiles and the bottom tabs at 360dp and with larger system fonts, and it conflicts with the rule of one language per screen (AGENTS.md).

## Decision

- `AppLanguage` is `'english' | 'hindi'`. `pickText` returns English, or Hindi when it is available (English when the Hindi string is empty).
- Settings shows English and हिंदी only.
- `app_settings.json` may still hold `"language":"bilingual"` from an earlier build. `initStore` maps it to `hindi` (the user had chosen Hindi to be shown) and maps any other unknown value to `english`. No file version field is needed because the sanitiser handles every case.

## Rejected

- Keeping Both and truncating with `numberOfLines={1}`: hides meaning and still stacks two languages on one label.
- Migrating `bilingual` to English: the user opted into Hindi text, so dropping it would remove the language they asked for.
