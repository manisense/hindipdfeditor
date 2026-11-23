// Checks that every inline script the live site serves is allowed by its Content-Security-Policy.
// Cloudflare injects two inline snippets at the edge (Google tag gateway); the policy allows them
// by SHA-256 hash (web ADR 0014). If Cloudflare changes a snippet, its hash changes and the browser
// blocks it: analytics stops while the site keeps working. Run after each deploy, and weekly:
//   node web-app/scripts/check-csp-snippets.mjs [https://hindipdfeditor.com]
// Exits 1 and prints the new hash when a snippet is not allowed.
import { createHash } from "node:crypto";

const base = process.argv[2] ?? "https://hindipdfeditor.com";
const pages = ["/", "/hi/", "/tools/edit-hindi-pdf/", "/articles/"];
// The edge injects the snippets only for browser requests.
const headers = {
  "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36",
  Accept: "text/html",
};

let failed = false;
for (const path of pages) {
  const response = await fetch(base + path, { headers });
  const csp = response.headers.get("content-security-policy") ?? "";
  const scriptSrc = csp.split(";").map((d) => d.trim()).find((d) => d.startsWith("script-src")) ?? "";
  const html = await response.text();
  const inline = [...html.matchAll(/<script(\s[^>]*)?>([\s\S]*?)<\/script>/g)].filter(([, attrs = ""]) => !/\bsrc=/.test(attrs) && !/ld\+json/.test(attrs));
  if (!csp) {
    console.log(`FAIL ${path}: no Content-Security-Policy header`);
    failed = true;
    continue;
  }
  for (const [, , body] of inline) {
    const hash = `'sha256-${createHash("sha256").update(body, "utf8").digest("base64")}'`;
    if (!scriptSrc.includes(hash)) {
      console.log(`FAIL ${path}: inline script not allowed by the policy; add ${hash} to script-src in web-app/_headers`);
      console.log(`     starts: ${JSON.stringify(body.trim().slice(0, 80))}`);
      failed = true;
    }
  }
  console.log(`${failed ? "…" : "OK"} ${path}: ${inline.length} inline scripts checked`);
}
process.exit(failed ? 1 : 0);
