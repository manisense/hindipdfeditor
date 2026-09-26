# 0013 — One web shell, and handing files between tools in memory

**Status:** Accepted.

## Context

A UI/UX audit of the website (September 2026) found four different page headers: the React home page, the React tool pages, the article pages and the legal/support pages. Each had its own logo treatment, links and mobile behaviour, and one clipped its menu button at 390px. The home page ran to about 17 phone screens. Its headline was a typewriter animation that showed partial words ("No brok") and showed the Devanagari line only a quarter of the time, against AGENTS.md rule 3.

The main call to action was "Open the editor", but visitors arrive with a task (fill a form, shrink a scan, merge files), not a wish to open an editor. After an export, every tool ended at "Downloaded", with nowhere obvious to go next.

## Decision

- **One header and footer.** `editor/src/components/SiteHeader.tsx` and `home/Footer.tsx` are used by the home page and every tool page. Static pages (articles, legal, support, about, 404) carry the same markup, styled by the `.sh-*` rules in `assets/site.css`. The static mobile menu is a `<details>` element, so it works without JavaScript; `assets/site.js` only adds the scrolled shadow and outside-click/Escape closing. `components/toolVisuals.ts` is the single source of each tool's icon, Hindi name, tagline and category chip.
- **Static bilingual H1.** The hero headline is two fixed lines, English and Devanagari, at equal size and weight.
- **Pick a file, then a task.** The hero card takes a PDF, by choosing or dropping it, and then offers the five tools. The file goes to the chosen tool in memory:
  - `lib/pendingFiles.ts` holds it.
  - `lib/navigation.ts` changes the route with `history.pushState`, and `App` re-renders for the new route.
  - The tool's `DropZone` takes the file once on mount.
  - Tool pages use the same hand-off: after a successful export, `NextSteps` offers the output to the other tools.
- **Continue where you left off.** The last tool used is stored in `localStorage` under `hpe:lastTool`. Only the tool id is kept, never file names or content, and it is read after hydration.
- **Shorter home page.** The sections are: hero; document jobs (each linking to its tool); a shaping demo merged with the category comparison; three steps; a guides rail; FAQ; and the closing CTA. The features bento, the separate comparison table and "Work your way" are removed.

## Rejected alternatives

- **Passing the file through IndexedDB or `sessionStorage` across a full page load.** That would put the user's document into browser storage, even if only briefly. That is a privacy regression for a tool that promises local, transient handling. The in-memory hand-off loses the file on a hard reload, which is the safe way to fail.
- **Making the whole site a single-page app.** ADR 0010 keeps one prerendered HTML file per URL for crawlers. Client-side navigation only runs after a user action, and every URL it produces still has its prerendered page.
- **A dark or red "streaming service" re-skin.** `design-system.md` is binding: light surfaces, with `#1843DD` reserved for actions. The "premium" feel comes from continuity (start on the home page, carry on across tools, a continue chip, no dead ends) rather than from colour.

## Consequences

- A new static page must copy the header markup from an existing page. There is no build-time include for the static HTML.
- `seoFor(route).title` is applied to `document.title` on client-side route changes. Other head tags (canonical, hreflang) keep the values of the page first loaded. Crawlers never trigger client navigation, so this only affects a human's open tab.
