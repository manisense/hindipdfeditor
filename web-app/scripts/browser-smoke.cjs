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
  const homepageRequests = [];
  page.on("request", (request) => homepageRequests.push(request.url()));
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
  if (
    homepageRequests.some((url) =>
      /\/(?:pdf-lib|jspdf|html2canvas|exportPdf|pdf\.worker)/.test(url),
    )
  )
    throw new Error("Homepage eagerly loads PDF tools");
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
    .click({ position: { x: 80, y: 330 } });
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
  for (const [tool, route, action, expectedPages] of [
    ["merge", "merge-pdf", "Merge & download", 2],
    ["split", "split-pdf", "Split & download", 1],
    ["compress", "compress-pdf", "Compress & download", 1],
  ]) {
    await page.goto(baseUrl + "/tools/" + route + "/", {
      waitUntil: "networkidle",
    });
    await page.evaluate(() => {
      window.__seoEvents = [];
      window.gtag = (...args) => window.__seoEvents.push(args);
    });
    const fixture = path.resolve(
      __dirname,
      "../../mobile-app/fixtures/devanagari-fixture.pdf",
    );
    await page
      .locator("input[type=file]")
      .first()
      .setInputFiles(tool === "merge" ? [fixture, fixture] : fixture);
    const dl = page.waitForEvent("download", { timeout: 60000 });
    await page.getByRole("button", { name: action, exact: true }).click();
    await (
      await dl
    ).saveAs(path.join(outputDir, "hindi-" + tool + "-export.pdf"));
    const toolEvents = await page.evaluate(() => window.__seoEvents);
    if (
      toolEvents.filter(
        (e) => e[1] === "export_success" && e[2].tool_id === tool,
      ).length !== 1
    )
      throw new Error("Utility success event mismatch: " + tool);
    console.log("UTILITY_EXPORT", tool, expectedPages);
  }
  await page.goto(baseUrl + "/tools/translate-hindi-pdf/", {
    waitUntil: "networkidle",
  });
  let aiRequests = 0;
  await page.route("**/v1/**", (r) => {
    aiRequests++;
    return r.abort();
  });
  await page
    .locator("input[type=file]")
    .setInputFiles(
      path.resolve(
        __dirname,
        "../../mobile-app/fixtures/devanagari-fixture.pdf",
      ),
    );
  await page.getByRole("checkbox").waitFor();
  await page
    .getByText("Auto-detected", { exact: true })
    .waitFor({ timeout: 60000 });
  if (await page.getByRole("checkbox").isChecked())
    throw new Error("AI consent preselected");
  if (
    !(await page
      .getByRole("button", { name: "Translate & download", exact: true })
      .isDisabled())
  )
    throw new Error("Translation enabled without consent");
  if (aiRequests !== 0) throw new Error("AI called before consent");
  await page.screenshot({
    path: path.join(outputDir, "hindi-translation-consent.png"),
    fullPage: true,
  });
  for (const slug of [
    "hindi-pdf-kaise-edit-kare",
    "how-to-edit-hindi-pdf",
    "fix-broken-hindi-fonts-in-pdf",
    "hindi-pdf-font-kaise-thik-kare",
    "bihar-bhumi-parimarjan-plus-shapath-patra-pdf",
    "parimarjan-plus-affidavit-pdf-guide",
    "sarkari-admit-card-name-correction-affidavit-hindi",
    "name-correction-application-and-affidavit-guide",
  ]) {
    for (const width of [320, 390, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(baseUrl + "/articles/" + slug + "/", {
        waitUntil: "networkidle",
      });
      if (
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        )
      )
        throw new Error("Article overflow " + slug + " " + width);
      if ((await page.locator("h1").count()) !== 1)
        throw new Error("Article heading mismatch");
      const graph = await page
        .locator('script[type="application/ld+json"]')
        .textContent();
      JSON.parse(graph);
      if (width === 390)
        await page.screenshot({
          path: path.join(outputDir, slug + "-390.png"),
          fullPage: true,
        });
    }
  }
  for (const route of [
    "/privacy/",
    "/hi/privacy/",
    "/data-safety/",
    "/hi/data-safety/",
    "/support/",
    "/hi/support/",
    "/terms/",
    "/hi/terms/",
  ]) {
    await page.setViewportSize({ width: 320, height: 900 });
    await page.goto(baseUrl + route, { waitUntil: "networkidle" });
    if (
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      )
    )
      throw new Error("Static page overflows " + route);
  }
  console.log(
    "ARTICLE_BROWSER_CHECKS",
    "8 priority guides, 3 widths; 8 legal/support pages at 320px",
  );
  await page.goto(baseUrl + "/", { waitUntil: "networkidle" });
  await page.setContent(
    '<html><head><link rel="stylesheet" href="' +
      baseUrl +
      '/assets/brand-tokens.css"></head><body style="font-family: Inter; padding:32px"><h1>Hindi PDF Editor</h1><div lang="hi"><p style="font-size:32px;font-weight:400">धर्म और क्षेत्र में गुरुजी ने ज्ञान दिया।</p><p style="font-size:32px;font-weight:700">विद्यालय में सूर्य की रोशनी आती है।</p><p style="font-size:32px;font-weight:800">क्ष त्र ज्ञ कि प्रार्थना — परीक्षण</p></div></body></html>',
    { waitUntil: "networkidle" },
  );
  await page.evaluate(async () => {
    await document.fonts.load(
      '800 32px "Noto Sans Devanagari"',
      "क्ष त्र ज्ञ कि प्रार्थना",
    );
    await document.fonts.ready;
  });
  const notoLoaded = await page.evaluate(() =>
    Array.from(document.fonts).some(
      (f) => f.family.includes("Noto Sans Devanagari") && f.status === "loaded",
    ),
  );
  if (!notoLoaded) throw new Error("Local brand font did not load");
  await page.pdf({
    path: path.join(outputDir, "hindi-brand-fonts.pdf"),
    format: "A4",
    printBackground: true,
  });
  console.log("LOCAL_FONT_FIXTURE", "400/700/800 weights rendered");
  console.log("BROWSER_ERRORS", errors);
  await browser.close();
  if (errors.length) process.exitCode = 1;
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
