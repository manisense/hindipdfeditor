import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
test("custom page and referral events do not send URL query content", () => {
  const window = {
    location: {
      origin: "https://hindipdfeditor.com",
      hostname: "hindipdfeditor.com",
      pathname: "/tools/edit-hindi-pdf/",
      search: "?document=private.pdf",
    },
    dataLayer: [],
  };
  const document = {
    referrer: "https://chatgpt.com/?private=user-text",
    head: { appendChild() {} },
    createElement() {
      return {};
    },
  };
  vm.runInNewContext(
    readFileSync(new URL("../assets/analytics.js", import.meta.url), "utf8"),
    { window, document, URL, Date },
  );
  const events = window.dataLayer.map((x) => Array.from(x));
  assert.equal(
    events.find((x) => x[0] === "config")[2].page_location,
    "https://hindipdfeditor.com/tools/edit-hindi-pdf/",
  );
  assert.equal(
    events.find((x) => x[0] === "config")[2].page_referrer,
    "https://chatgpt.com",
  );
  assert.ok(!JSON.stringify(events).includes("private"));
  assert.ok(!JSON.stringify(events).includes("user-text"));
});
