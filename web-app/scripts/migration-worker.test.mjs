import assert from "node:assert/strict";
import test from "node:test";
import worker, { migrationDestination } from "./migration-worker.mjs";
import routes from "../tool-routes.json" with { type: "json" };

test("old landing goes to root without redirecting the root back", () => {
  for (const path of ["/edit", "/edit/", "/edit/index.html"]) {
    assert.equal(
      migrationDestination(new URL(`https://example.com${path}?utm_source=old`))
        .href,
      "https://example.com/?utm_source=old",
    );
  }
  assert.equal(migrationDestination(new URL("https://example.com/")), null);
});

test("each old tool and root query preserves mode, language and tracking state", () => {
  for (const route of routes) {
    for (const path of ["/edit/", "/"]) {
      const destination = migrationDestination(
        new URL(
          `https://example.com${path}?tool=${route.id}&mode=addText&lang=hi&utm_source=guide`,
        ),
      );
      assert.equal(destination.pathname, route.path);
      assert.equal(
        destination.search,
        "?mode=addText&lang=hi&utm_source=guide",
      );
    }
    assert.equal(
      migrationDestination(new URL(`https://example.com${route.path}`)),
      null,
    );
  }
});

test("invalid tool state returns a real 404; static assets are delegated", async () => {
  const env = { ASSETS: { fetch: async () => new Response("asset") } };
  const invalid = await worker.fetch(
    new Request("https://example.com/edit/?tool=unknown"),
    env,
  );
  assert.equal(invalid.status, 404);
  assert.equal(invalid.headers.get("X-Robots-Tag"), "noindex");
  assert.equal(
    await (
      await worker.fetch(
        new Request("https://example.com/edit/assets/app.js"),
        env,
      )
    ).text(),
    "asset",
  );
  const redirect = await worker.fetch(
    new Request("https://example.com/edit/?tool=translate"),
    env,
  );
  assert.equal(redirect.status, 301);
  assert.equal(
    redirect.headers.get("Location"),
    "https://example.com/tools/translate-hindi-pdf/",
  );
});

test("remote tool URLs redirect without losing language or mode", () => {
  for (const route of routes) {
    const alias = route.path.replace("/tools", "");
    for (const prefix of ["", "/hi"]) {
      const target = migrationDestination(
        new URL(
          `https://example.com${prefix}${alias}?mode=erase&utm_source=old`,
        ),
      );
      assert.equal(target.pathname, route.path);
      assert.equal(target.searchParams.get("mode"), "erase");
      assert.equal(target.searchParams.get("utm_source"), "old");
      assert.equal(target.searchParams.get("lang"), prefix ? "hi" : null);
    }
  }
});

test("www normalizes to the apex and preserves retired task state in one redirect", async () => {
  const env = { ASSETS: { fetch: async () => new Response("asset") } };
  for (const path of ["/privacy/?source=old", "/edit/?tool=merge&mode=edit"]) {
    const response = await worker.fetch(
      new Request(`https://www.hindipdfeditor.com${path}`),
      env,
    );
    assert.equal(response.status, 301);
    const target = new URL(response.headers.get("Location"));
    assert.equal(target.hostname, "hindipdfeditor.com");
    assert.equal(
      target.pathname,
      path.startsWith("/edit") ? "/tools/merge-pdf/" : "/privacy/",
    );
  }
});
