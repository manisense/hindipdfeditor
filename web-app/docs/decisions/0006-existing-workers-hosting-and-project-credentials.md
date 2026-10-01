# 0006 — Existing Workers hosting and project-only credentials

Date: 1 October 2026

## Decision

Deploy the verified artifact through the existing production `hindipdfeditor` Worker, with an ASSETS binding and the shared migration script as entrypoint. Pin the owning account in both project Wrangler configurations. Use a project-installed Wrangler wrapper that explicitly reads a gitignored, owner-only root credential file or an explicitly supplied CI API token. Missing credentials fail instead of using global OAuth.

## Evidence and reason

The first pushed release generated a failed GitHub `Workers Builds: hindipdfeditor` check whose dashboard URL identifies the owning account. This establishes Workers hosting rather than the earlier Pages assumption. The supplied project token was verified active and the wrapper's whoami confirmed localcode.ai@gmail.com in the matching account. Global OAuth remained a different account and was not changed.

## Behavior

The Worker runs before assets, allowing query-aware migration and www normalization. Static requests delegate to ASSETS, keeping current HTML, caching and real 404 behavior. Exclude Pages metadata files from Workers assets. Both dashboard root-directory choices build/deploy the same Worker. No PDF rendering or export architecture changes.

## Verification

Project-local Wrangler dry-run bundles the migration Worker and ASSETS successfully. Migration tests include aliases, unknown tools and one-step www normalization. Local Workers browser acceptance and actual PDF downloads verify the same artifact before production upload. Verify live routes and canonical HTML after deployment; do not infer deployment success from a Git push.

## Rejected

Creating another Pages project or using unrelated global OAuth would not update the existing production Worker. Do not commit the API token or write it to global Wrangler configuration.
