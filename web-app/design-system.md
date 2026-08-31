# Hindi PDF Editor — Design System (extracted from web homepage)

## 1. Brand identity

- **Personality:** confident, clean, trustworthy SaaS-utility — not playful, not corporate-cold. Reads as "a serious tool that happens to care about Hindi."
- **Signature move:** every feature category gets its own pastel-tinted icon chip (blue = core editing, green = translation/privacy, purple = merge/split, orange = compression, teal = OCR), while the brand itself stays a single confident indigo-blue used sparingly for CTAs, links, and the one highlighted column in the comparison table.
- **Devanagari is treated as a design element, not just content** — large Hindi headline text ("हिंदी दस्तावेज़।") sits directly under the English headline at equal visual weight, signaling this is a Hindi-first product, not a translated afterthought.

## 2. Color palette

### Brand / primary
| Token | Hex | Use |
|---|---|---|
| `brand.primary` | `#1843DD` | Primary CTAs, links, active states, brand mark (confirmed via site theme-color) |
| `brand.primaryDeep` | `#3226B8` | Gradient end for primary buttons (blue → indigo gradient) |
| `brand.primaryTint` | `#EEF2FF` | Selected/highlighted backgrounds (e.g. the "Hindi PDF Editor" column in comparison table) |

### Accent chips (per feature category)
| Token | Hex (icon/fg) | Hex (tint/bg) | Used for |
|---|---|---|---|
| `accent.blue` | `#1843DD` | `#E8EDFF` | Editing / core tools |
| `accent.green` | `#16A34A` | `#E6F7EC` | Translation, local-first privacy |
| `accent.purple` | `#7C3AED` | `#F1EAFE` | Merge & split |
| `accent.orange` | `#F0700F` | `#FFF1E4` | Compression, Sarkari/govt tools |
| `accent.teal` | `#0D9488` | `#E3F6F4` | OCR / detection |

### Neutrals
| Token | Hex | Use |
|---|---|---|
| `text.primary` | `#14161F` | Headlines, high-emphasis text |
| `text.secondary` | `#5B6472` | Body copy, descriptions |
| `text.muted` | `#94A0B2` | Captions, disabled/coming-soon labels |
| `border.subtle` | `#E7E8F1` | Card borders, dividers |
| `surface.white` | `#FFFFFF` | Cards, header, primary surface |
| `surface.page` | `#FBFBFE` | Default page background |
| `surface.cream` | `#FAF6EC` | Alternating section backgrounds ("Built for Hindi PDFs…", comparison table section) |

### Semantic
| Token | Hex | Use |
|---|---|---|
| `success` | `#16A34A` | Checkmarks in comparison table, "done" states |
| `warning/negative` | `#EF6C4D` | X-marks / limitations in comparison table |

### Hero/CTA gradient mesh (closing section)
Soft pastel radial blobs layered on white — blue, violet, pink, and yellow at low opacity (~15–25%), heavily blurred. Used once, at the bottom "Get your Hindi PDFs sorted" CTA — this is the one moment of color richness in an otherwise restrained palette. Don't reuse this treatment elsewhere or it loses impact.

## 3. Typography

**Latin typeface:** a geometric-grotesque sans with rounded terminals and a tall x-height — closest matches: **Inter, Manrope, or Plus Jakarta Sans**. Recommend **Inter** for the app (excellent variable-weight support, ships well on both iOS/Android).

**Devanagari typeface:** needs a companion that matches the Latin face's weight and modern feel rather than a traditional/calligraphic Devanagari style. Recommend **Noto Sans Devanagari** (best coverage + weight range, pairs cleanly with Inter) or **Hind** as a lighter-feeling alternative for body text.

| Role | Family | Weight | Size (mobile) | Notes |
|---|---|---|---|---|
| Display / Hero H1 | Inter + Noto Sans Devanagari | 700–800 | 32–36sp | Tight line-height (~1.1), Latin and Devanagari lines stack, not inline |
| Section heading (H2) | Inter | 700 | 24–26sp | |
| Card title (H3) | Inter | 600 | 16–18sp | |
| Body | Inter / Noto Sans Devanagari | 400 | 14–15sp | `text.secondary` color, line-height ~1.5 |
| Eyebrow label | Inter | 600, uppercase, tracked | 11–12sp | `brand.primary` color — used above section headings |
| Button label | Inter | 600 | 15sp | |
| Caption / meta | Inter | 500 | 12sp | `text.muted` |

## 4. Shape & elevation

- **Corner radius:** cards & panels `16–20px`, icon chips `12px` (rounded square, not circle), buttons `full pill (9999px)`, small tags/badges `full pill`.
- **Shadow:** one soft elevation used consistently — `0px 8px 24px rgba(20, 22, 31, 0.06)`. No heavy or colored shadows.
- **Borders:** hairline `1px solid border.subtle` on cards sitting on white; cards on the cream background skip the border and rely on shadow alone.

## 5. Spacing scale

`4 / 8 / 12 / 16 / 24 / 32 / 48 / 64` (px, or dp on mobile). Generous section padding; content breathes — avoid cramming.

## 6. Core components (mobile adaptation)

- **Primary button:** full pill, blue→indigo gradient fill, white 600-weight label, optional leading icon. Height ~48dp.
- **Secondary button:** full pill, white fill, `border.subtle` outline, dark text, used for "Get it on Google Play" style secondary actions.
- **Icon chip (feature badge):** 40–48dp rounded-square, tinted background per category from the accent table, solid-color line icon centered.
- **Feature card:** white surface, `16px` radius, hairline border, icon chip top-left, bold title, secondary-gray description below.
- **Tool row (bottom-sheet/list style, seen in the "One toolset, every job" card):** icon chip + label left-aligned, chevron right, subtle divider between rows — a strong pattern to reuse for the app's main tool list / home screen.
- **Progress bar:** thin rounded track in `border.subtle`, filled with `brand.primary`, used to show live editing/processing feedback.
- **Comparison/feature table → mobile:** collapse into a stacked comparison (one card per competitor, or a swipeable column) with the brand column tinted `brand.primaryTint` and check/x icons in `success`/`warning` colors.
- **Accordion (FAQ):** plain list rows, `+`/`–` toggle in `brand.primary`, divider lines, no card wrapper.
- **Status/disabled card:** greyed-out content (lower opacity, `text.muted`) with a "coming soon" tag — seen in "Land Records & Revenue Forms."

## 7. Section rhythm

Alternate `surface.white` and `surface.cream` full-bleed sections to break up a long scroll — white for hero/feature-detail/how-it-works/FAQ, cream for the "why us" and comparison sections. On mobile, this alternation is what will carry visual pacing since there's no room for side-by-side layouts.

## 8. Principles to carry into the app

1. **One brand color, many category tints.** Never let the accent colors compete with `brand.primary` for primary actions — accents label categories, blue drives action.
2. **Devanagari gets equal typographic billing**, not smaller/secondary treatment next to English.
3. **Restraint everywhere except one CTA moment** — the colorful gradient mesh is used exactly once (final CTA); don't scatter decorative gradients through the app.
4. **Local/private-by-design should be visually reinforced** — the green privacy card and "100% Client-Side Processing" footer line suggest a persistent trust signal (e.g. a small "processed on your device" badge) worth carrying into the app's editor screen.
