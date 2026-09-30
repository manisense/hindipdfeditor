# Shared web design tokens

## Decision

Use `web-app/assets/brand-tokens.css` for the web's prescribed colors, spacing primitives, typography and shadows. React imports it through Vite; static article/legal CSS imports the same stylesheet. Existing component variable names remain aliases to approved values during migration.

## Reason

Separate Tailwind, React CSS and static CSS palettes had diverged from root `design-system.md`. One token source prevents future changes from silently creating a second brand palette.

## Rejected

- Keeping different palettes for the landing page and PDF tools creates visual inconsistency.
- Replacing the root design system with existing drift would violate the project contract.
- A new UI framework or token package adds no required capability.
