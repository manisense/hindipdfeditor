// Run against a local Cloudflare Pages preview. Requires Playwright and Chrome.
const path = require("node:path");
const os = require("node:os");
const baseUrl = process.env.SMOKE_BASE_URL || "http://127.0.0.1:8788";
const outputDir = process.env.SMOKE_OUTPUT_DIR || os.tmpdir();
const { chromium } = require("playwright");
(async () => {
  const browser = await chromium.launch({ headless: true, channel: "chrome" });
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error" && !m.text().includes("net::"))
      errors.push(m.text());
  });
  await page.route("**/googletagmanager.com/**", (r) => r.abort());
  await page.route("**/google-analytics.com/**", (r) => r.abort());
  await page.route("**/fonts.googleapis.com/**", (r) => r.abort());
  await page.route("**/fonts.gstatic.com/**", (r) => r.abort());
  for (const width of [320, 360, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(baseUrl + "/", { waitUntil: "networkidle" });
    await page.locator(".hpe-home").waitFor();
    if (
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      )
    )
      throw new Error("Home overflows at " + width);
    if ((await page.locator("h1").count()) !== 1)
      throw new Error("Duplicate H1");
    if (
      (await page.locator("link[rel=canonical]").getAttribute("href")) !==
      "https://hindipdfeditor.com/"
    )
      throw new Error("Wrong canonical");
    await page.screenshot({
      path: path.join(outputDir, "hindi-home-" + width + ".png"),
      fullPage: true,
    });
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("link", { name: "हिन्दी", exact: true }).click();
  await page.waitForLoadState("networkidle");
  if ((await page.locator("html").getAttribute("lang")) !== "hi")
    throw new Error("Wrong locale");
  if (
    (await page.locator("link[rel=canonical]").getAttribute("href")) !==
    "https://hindipdfeditor.com/hi/"
  )
    throw new Error("Hindi canonical");
  await page.screenshot({
    path: path.join(outputDir, "hindi-home-hi.png"),
    fullPage: true,
  });
  for (const [old, path] of [
    ["edit", "edit-hindi-pdf"],
    ["translate", "translate-hindi-pdf"],
    ["merge", "merge-pdf"],
    ["split", "split-pdf"],
    ["compress", "compress-pdf"],
  ]) {
    await page.goto(baseUrl + "/edit/?tool=" + old, {
      waitUntil: "networkidle",
    });
    if (!page.url().includes("/tools/" + path + "/"))
      throw new Error("Migration failed " + old);
    if (
      (await page.locator("link[rel=canonical]").getAttribute("href")) !==
      "https://hindipdfeditor.com/tools/" + path + "/"
    )
      throw new Error("Tool canonical " + old);
  }
  await page.goto(baseUrl + "/tools/edit-hindi-pdf/", {
    waitUntil: "networkidle",
  });
  await page.locator("input[type=file]").setInputFiles({
    name: "invalid.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("not a pdf"),
  });
  await page.getByRole("alert").filter({ hasText: "Choose a PDF" }).waitFor();
  await page.evaluate(() => {
    window.__seoEvents = [];
    window.gtag = (...args) => window.__seoEvents.push(args);
  });
  await page
    .locator("input[type=file]")
    .setInputFiles(
      path.resolve(
        __dirname,
        "../../mobile-app/fixtures/devanagari-fixture.pdf",
      ),
    );
  await page.waitForTimeout(3000);
  await page.getByRole("button", { name: "Add text", exact: true }).click();
  await page
    .locator(".pdf-page-viewer__page")
    .click({ position: { x: 80, y: 180 } });
  await page
    .locator("textarea")
    .last()
    .fill("क्ष त्र ज्ञ कि प्रार्थना — परीक्षण");
  await page.locator("textarea").last().press("Escape");
  await page.getByRole("button", { name: "Open another", exact: true }).click();
  await page
    .getByRole("dialog", { name: "Discard unexported changes?" })
    .waitFor();
  await page.getByRole("button", { name: "Keep editing", exact: true }).click();
  if (
    !(await page.evaluate(
      () =>
        !window.dispatchEvent(new Event("beforeunload", { cancelable: true })),
    ))
  )
    throw new Error("Unexported changes are unprotected");
  const pending = page.waitForEvent("download", { timeout: 60000 });
  await page
    .getByRole("button", { name: "Download edited PDF", exact: true })
    .click();
  const downloaded = await pending;
  await downloaded.saveAs(path.join(outputDir, "hindi-seo-export.pdf"));
  console.log("EXPORTED", downloaded.suggestedFilename());
  if (
    !(await page.evaluate(() =>
      window.dispatchEvent(new Event("beforeunload", { cancelable: true })),
    ))
  )
    throw new Error("Exported changes still warn");
  const events = await page.evaluate(() => window.__seoEvents);
  if (events.filter((e) => e[1] === "export_success").length !== 1)
    throw new Error("Export event duplicated or missing");
  if (JSON.stringify(events).includes("devanagari-fixture"))
    throw new Error("Filename in analytics");
  console.log("WORKFLOW_EVENTS", events);
  await page.screenshot({
    path: path.join(outputDir, "hindi-editor-loaded.png"),
    fullPage: true,
  });
  console.log("BROWSER_ERRORS", errors);
  await browser.close();
  if (errors.length) process.exitCode = 1;
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
