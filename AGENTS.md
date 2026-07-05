# AGENTS.md — Hindi PDF Editor

Read `hindi-pdf-editor-spec.md` first — it has the architecture, the phased build plan, data models, and module specs. This file governs *how* to work, not *what* to build. It is reloaded fresh at the start of every session — it has no memory of past sessions and will not learn new rules on its own. If a rule here needs to change permanently, edit this file directly; a verbal correction in one session will not persist to the next.

## Non-negotiable architecture rules

- Never draw Devanagari text via `Canvas.drawText()`, `android.graphics.pdf.PdfDocument`, or `pdf-lib`'s string-based `drawText()`. All Devanagari rendering goes through the WebView/HTML/print pipeline described in the spec (Section 5). If a task seems to call for one of these anyway, stop and flag it instead of implementing it — this is the one rule the whole project depends on.
- Do not switch from Plan A ("Render & Print") to Plan B (direct glyph injection) mid-build, even if it looks like a shortcut for a specific edit case. Plan B is Phase 5, deferred, and only happens as an explicit, separate decision after Phases 0–4 are working.
- Any change to `coordinateMath.ts`, `htmlCompositor.ts`, or `legacyFontDetector.ts` must be verified against an actual exported PDF or screenshot, not just read through — these are the modules where a subtle bug silently corrupts what the user sees without throwing an error.

## Code quality bar

- TypeScript strict mode on. No `any` without a one-line comment explaining why it's unavoidable.
- Every exported function in `/lib` gets a docstring stating the unit of every numeric parameter (dp, pt, or px). This codebase has three coexisting coordinate systems (Section 7–8 of the spec); unit confusion is the single most likely bug class here, and it will not show up as a compile error.
- Favor loose coupling and high cohesion over what "tightly engineered" often gets mistaken for: modules should be swappable, not intertwined. Swapping `expo-print` for `react-native-html-to-pdf`, for instance, should require touching only `exportPdf.ts`. If a change to one file forces edits in three unrelated files, that's a coupling problem to fix, not a one-off exception.
- No dead code and no commented-out blocks left "just in case" — delete it, git history keeps it if it's ever needed again.
- Run the linter/formatter before considering any checklist item done, not as a separate cleanup pass at the end.
- Single-responsibility components and functions. If `PdfPageViewer.tsx` starts also handling export logic, split it.

## Security and safety checks (specific to this app, not generic boilerplate)

- **Escape all user-typed text before interpolating it into the HTML compositor.** `htmlCompositor.ts` builds an HTML string that gets rendered inside a WebView; unescaped text containing `<script>`, `<img onerror=...>`, or similar is a real injection surface even though this is a single-user local app — the WebView will execute it. Every `TextEdit.text` value must pass through an `escapeHtml()` step before it reaches the template.
- **Never overwrite or mutate the original source PDF.** Every export produces a new output file. Silent data loss on a user's real document is the worst failure mode this app has — worse than any crash, because the person may not notice until much later.
- **Font/encoding inspection fails closed.** If `legacyFontDetector.ts` throws or is inconclusive when reading embedded font names, treat the page as unknown-encoding and warn the user — never default to "assume Unicode, proceed."
- **Validate before reporting success.** After export, confirm the output file is non-empty and re-openable (a basic parse-back check) before telling the user it worked. A silently corrupt export is worse than a visible error.
- **Vet new native dependencies before adding them.** Check current maintenance status and Expo SDK compatibility — the mobile native-module ecosystem's compatibility windows are short, and a package that worked six months ago may not build today. Don't add one without checking.

## Performance constraints

- Render background page images at 2–3× the page's point-dimensions, not arbitrarily higher — this is a deliberate memory/quality tradeoff, not a "more is better" setting.
- Exporting many pages in a single print call can be slow or memory-heavy on low-end Android hardware. Don't pre-optimize for this — only batch-export-and-merge (via `pdf-lib`'s `copyPages`) if a real device actually shows the problem.
- Keep heavy synchronous work (image processing, HTML string assembly for large documents) off the main JS thread where React Native makes that possible; don't let it block the UI during editing.

## Testing approach

Standard pyramid, mapped to this project:

- **Unit tests**: `coordinateMath.ts`'s three conversion functions are pure, have no native dependencies, and are the easiest place for an unnoticed sign/scale error to hide. There is no excuse for these being untested.
- **Visual/fixture-based checks**: maintain one fixed test-PDF fixture in the repo containing known conjuncts, matras, and a reph. Use the same fixture for every Phase 0/1/3 verification pass so results are comparable run to run, instead of eyeballing different ad hoc text each time.
- Don't report "tests pass" or "this works" without having actually run them in the current session. If something can't be verified in this environment (e.g., needs a physical device), say so explicitly rather than assuming it's fine.

## Iteration process, per phase

1. Implement only the current phase's acceptance criteria from the spec — nothing from a later phase, even if it looks easy to bundle in while you're already in that file.
2. Check off that phase's checklist items one at a time, explicitly, before calling the phase done.
3. For any phase touching Devanagari rendering (0, 1, 3): export an actual test PDF using the fixture above and describe what it shows, or ask the user to check it. Don't mark shaping-related work done from reading code alone — this is exactly the kind of bug that looks correct in the source and wrong on screen.
4. If a phase reveals that an earlier assumption in the spec was wrong, stop and state exactly what changed and why — don't silently re-architect around it.
5. Small, reviewable commits per checklist item, not one large commit per phase.

## Documentation & change tracking

Every real change gets recorded in more than just the diff — a future session (yours or Codex's) has no memory of this one, and "I'll remember why" doesn't survive a context reset. Three lightweight mechanisms, layered:

1. **Git + Conventional Commits.** Prefix every commit: `feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`. Costs nothing, and it's machine-parseable — a changelog can be generated from commit history later, and `git log --oneline` tells you what kind of change each commit was without opening it.
2. **`CHANGELOG.md`, Keep a Changelog format.** A running, human-readable log grouped by version or by phase (matching the spec's Phase 0–5 structure works well here — "Phase 1: viewer + tap-to-edit + Plan A export" as a heading, bullets underneath). This is what gets read in six months when it's forgotten what shipped when, without spelunking through `git log`.
3. **`docs/decisions/` — lightweight ADRs.** This is the actual fix for the "AGENTS.md has no memory" gap noted above. One short markdown file per real architectural call — `0001-render-and-print-over-glyph-injection.md`, `0002-expo-custom-dev-client.md` — each just: what was decided, why, what was rejected and why. When a future session wonders "why aren't we just using pdf-lib directly," the answer already exists instead of getting re-litigated or re-discovered the hard way.

**The discipline that matters more than any of the three tools above:** update `hindi-pdf-editor-spec.md` and this file in the *same commit* that changes the behavior they describe, not as a separate cleanup pass later. A spec that's stale by even one phase is worse than no spec, because it will be trusted.

## Skills

Codex separately supports reusable task-specific "Skills," distinct from this always-on instructions file — if you want a dedicated workflow (e.g., a repeatable "run the shaping-verification fixture" skill), check OpenAI's current Codex documentation for the exact format, since that mechanism evolves independently of AGENTS.md and isn't something this file can fully specify.

## Verifying this file loaded

Run `codex --ask-for-approval never "Summarize the current instructions."` from the repository root. The response should mention the rules above. If it doesn't: confirm this file is named exactly `AGENTS.md` (case-sensitive), sits at the repository root, and isn't empty.
