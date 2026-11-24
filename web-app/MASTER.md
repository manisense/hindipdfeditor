# MASTER.md: genjutsu design file for hindipdfeditor.com

genjutsu (`cast`, `paint`, `design-audit`) reads this file as the project's design system and
validated thesis. It does not repeat the tokens: it points to where they live, records what the
owner approved, and says how to audit. Keep it in sync in the same commit as any design change.

## Sources of truth

| What | Where |
|---|---|
| Brand rules, colours, geometry, one language per screen | `../AGENTS.md` (wins over everything here), `design-system.md` |
| Shared web tokens (static pages and editor) | `assets/brand-tokens.css` |
| Homepage tokens (Tailwind `@theme`) | `editor/src/home.css` |
| Homepage motion tokens | `editor/src/home/motion.ts` |
| Every tool, grouped by category | `editor/src/home/toolCatalog.ts` (nav menu, phone menu, hero, chips) |
| Copy, English and Hindi | `editor/src/home/translations.ts`, `faqData.ts` |

Type: Inter for Latin (headings too; `brand-tokens.css` maps `--font-display` to it), Noto Sans
Devanagari for Hindi. Hindi display type runs wider: the hero caps Hindi at 54px, English at 68px.

## Validated thesis (homepage)

Approved by the owner on 2026-11-24 ("C is best", then "beautifull.. merge and deploy"):

> The homepage shows the one hard thing the product does: a real Hindi letter whose subject line
> is retyped live, matras intact, and signed when each line is done, under a typewriter headline
> of fixed height. Everything else is quiet: flat surfaces separated by tone, icons in their
> category colour on the surface, one brand blue for action.

Allowed patterns: typewriter headline with a blinking caret (stops under reduced motion); drawn
sample Hindi letter in the hero, labelled "Editing this line" (sample content, not a screenshot);
CSS hover sweep on one phrase ("one place"); pointer box around one word in the hero sentence;
brand eyebrow labels above section headings (design-system.md, uppercase, tracked); pill badges
and tags; cream section ground `#FBF8F1` (design-system.md `surface.cream`); one soft shadow on
primary buttons and on floating things (menus, the hero letter); category colours including
violet `#7C3AED` and orange `#F0700F` (AGENTS.md); the single gradient mesh in the closing CTA.

Not allowed (removed in the 2026-11-24 audit, keep them out): middle-dot runs in copy, em dashes
in displayed copy, unsourced social proof ("Loved for…"), grey bars standing in for text in
illustrations, guessed read times, a menu or sheet that stays open behind focus.

## Motion system

| Token | Value | Use |
|---|---|---|
| `UI` | 180ms, ease-out `[0.16, 1, 0.3, 1]` | menus (CSS `.menu-panel`), FAQ answer |
| `ENTER` | 400ms, same ease, `STAGGER` 80ms | section items entering on scroll |
| `HERO` | 600ms, same ease | hero rise (CSS `.hero-rise`), pointer box |
| decorative | signature stroke 1.1s, typewriter 55–65ms per grapheme | hero only |

Rules: transform and opacity only (the FAQ no longer animates height). `MotionConfig
reducedMotion="user"` wraps the homepage, and `home.css` turns off the caret, hero rise, sweep,
signature and menu transforms under `prefers-reduced-motion`. Menus stay mounted and fade out;
closed menus are `inert` and `visibility: hidden`.

## Accessibility contract

- Tools menu: hover or click opens; Esc closes and returns focus to the button; tabbing out closes.
- Phone menu: focus moves to the first link; `main` and `footer` are `inert` while it is open; Esc
  returns focus to the menu button.
- Decorative chips and beams are `aria-hidden`. Text contrast is 5.6:1 or more (computed). The
  orange `#F0700F` icon is 2.99:1 on white: allowed only beside a text label (AGENTS.md keeps it).

## Auditing this project

```bash
# from web-app/: scan the homepage components AND the CSS that styles them
python3 ~/.claude/skills/genjutsu/_jutsu/design-audit/scripts/audit.py editor/src/home
python3 ~/.claude/skills/genjutsu/_jutsu/design-audit/scripts/audit.py editor/src --only outline-none,hover-no-transition,will-change-permanent,layout-property-animation
```

Known false positives: `js-driven-animation` on `typewriter.tsx` (it swaps text, not frames)
and on `Nav.tsx` (hover-intent delay); `decorative-motion-not-hidden` on motion wrappers that
hold content; inline `style` colours from `toolCatalog.ts`. The script cannot read copy held in
`translations.ts`, `faqData.ts` or the `ArticlesSection` array: read those by hand.

Then the browser checks (reduced motion, keyboard, phone menu) with the `genjutsu-audit` skill's
`browser-checks.cjs`, and `scripts/browser-smoke.cjs` as in `.claude/skills/verify`.

Protected (never changed by an audit): routes in `tool-routes.json`, canonical URLs, nav labels'
meaning, FAQ text and JSON-LD (changed only with the owner), the logo, legal pages.
