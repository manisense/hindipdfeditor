import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const webRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const credentialPath = path.resolve(webRoot, "../.env.cloudflare");
const local = {};
if (existsSync(credentialPath)) {
  for (const line of readFileSync(credentialPath, "utf8").split(/\r?\n/)) {
    const match = line.match(
      /^(CLOUDFLARE_API_TOKEN|CLOUDFLARE_ACCOUNT_ID)=(.*)$/,
    );
    if (match) local[match[1]] = match[2].trim();
  }
}
const token = local.CLOUDFLARE_API_TOKEN || process.env.CLOUDFLARE_API_TOKEN;
if (!token) {
  console.error(
    "Project Cloudflare credentials are missing. Configure .env.cloudflare or explicitly supply a CI token; global OAuth is not used.",
  );
  process.exit(1);
}
const env = {
  ...process.env,
  CLOUDFLARE_API_TOKEN: token,
  CLOUDFLARE_ACCOUNT_ID:
    local.CLOUDFLARE_ACCOUNT_ID || "4fa19d6815eb757bda0b564476970849",
  WRANGLER_SEND_METRICS: "false",
};
delete env.CLOUDFLARE_API_KEY;
delete env.CLOUDFLARE_EMAIL;
const args = process.argv.slice(2);
const result = spawnSync(
  process.execPath,
  [
    path.join(webRoot, "node_modules/wrangler/bin/wrangler.js"),
    ...(args.length ? args : ["whoami"]),
  ],
  { cwd: webRoot, env, stdio: "inherit" },
);
if (result.error) {
  console.error(
    "Could not start project-installed Wrangler:",
    result.error.message,
  );
  process.exit(1);
}
process.exit(result.status ?? 1);
