import { renderArticle, renderArticlesHub } from "./article-template.mjs";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const webAppRoot = path.resolve(__dirname, "..");
const queuePath = path.join(__dirname, "seo-keyword-queue.json");
const sitemapPath = path.join(webAppRoot, "sitemap.xml");
const llmsPath = path.join(webAppRoot, "llms.txt");
const llmsFullPath = path.join(webAppRoot, "llms-full.txt");
const articlesDir = path.join(webAppRoot, "articles");
const articlesHubPath = path.join(articlesDir, "index.html");

function getTodayDate() {
  const now = new Date();
  return now.toISOString().split("T")[0];
}

function generateArticleHtml(item) {
  const articles = JSON.parse(readFileSync(queuePath, "utf8"));
  return renderArticle(item, articles);
}

function updateSitemap(slug, modifiedDate = getTodayDate()) {
  let content = readFileSync(sitemapPath, "utf8");
  const urlEntry = `  <url>\n    <loc>https://hindipdfeditor.com/articles/${slug}/</loc>\n    <lastmod>${modifiedDate}</lastmod>\n    <changefreq>monthly</changefreq>\n    <priority>0.8</priority>\n  </url>\n`;

  if (content.includes("/articles/" + slug + "/")) {
    content = content.replace(/<url>[\s\S]*?<\/url>/g, (block) =>
      block.includes("/articles/" + slug + "/")
        ? block.replace(
            /<lastmod>[^<]*<\/lastmod>/,
            "<lastmod>" + modifiedDate + "</lastmod>",
          )
        : block,
    );
    writeFileSync(sitemapPath, content, "utf8");
  } else {
    content = content.replace("</urlset>", `${urlEntry}</urlset>`);
    writeFileSync(sitemapPath, content, "utf8");
    console.log(
      `[SEO Worker] Added https://hindipdfeditor.com/articles/${slug}/ to sitemap.xml`,
    );
  }
}

function refreshKnowledgeFiles(articles) {
  const routes = JSON.parse(
    readFileSync(path.join(webAppRoot, "tool-routes.json"), "utf8"),
  );
  const text =
    "# Hindi PDF Editor\n\n> Hindi-first web editing and Android tools. Core edits run locally; optional AI OCR and translation send approved content for processing. Keep the source and review every export.\n\n## Public entries\n\n- Homepage: https://hindipdfeditor.com/\n- Hindi homepage: https://hindipdfeditor.com/hi/\n" +
    routes
      .map((t) => "- " + t.title + ": https://hindipdfeditor.com" + t.path)
      .join("\n") +
    "\n\n## Guides\n\n" +
    articles
      .map(
        (a) =>
          "- " +
          a.title +
          ": https://hindipdfeditor.com/articles/" +
          a.slug +
          "/",
      )
      .join("\n") +
    "\n\n## Capabilities and limits\n\nNew Hindi text uses Unicode fonts and HTML shaping. The web editor adds overlays and exports image-based pages; it does not guarantee searchable text, original signatures or automatic legacy-font conversion. Unknown encoding blocks editing. Merge/split copy pages; compression rasterizes pages to JPEG and cannot guarantee a target file size. AI features require consent and enforce quotas. Editing an issued record does not authorize an official correction.\n\nPrivacy: https://hindipdfeditor.com/privacy/\nSupport: https://hindipdfeditor.com/support/\n";
  writeFileSync(llmsPath, text);
  writeFileSync(
    llmsFullPath,
    text +
      "\n## Web and Android distinction\n\nThe Android app uses its documented Render & Print pipeline. The web editor uses HTML-shaped overlays captured into image-based PDF pages. Do not assume these exports share selectability, signature preservation or file-size behavior. Test the fixed Devanagari fixture before relying on a new export change.\n",
  );
}

function updateArticlesHub() {
  const published = JSON.parse(readFileSync(queuePath, "utf8")).filter(
    (a) => a.status === "published",
  );
  writeFileSync(articlesHubPath, renderArticlesHub(published));
}

export function refreshPublishedArticles() {
  const articles = JSON.parse(readFileSync(queuePath, "utf8")).filter(
    (a) => a.status === "published",
  );
  for (const item of articles) {
    const directory = path.join(articlesDir, item.slug);
    mkdirSync(directory, { recursive: true });
    writeFileSync(
      path.join(directory, "index.html"),
      renderArticle(item, articles),
    );
    updateSitemap(item.slug, item.reviewedDate || item.publishedDate);
  }
  writeFileSync(articlesHubPath, renderArticlesHub(articles));
  refreshKnowledgeFiles(articles);
}

export function runWorker({ publishNext = false } = {}) {
  console.log(
    `=== 24-Hour Autonomous SEO/AEO/GEO Worker Started (${getTodayDate()}) ===`,
  );
  const queue = JSON.parse(readFileSync(queuePath, "utf8"));

  const published = queue.filter((q) => q.status === "published");
  const queued = queue.filter((q) => q.status === "queued");

  console.log(
    `[SEO Status] Total Articles in Pool: ${queue.length} | Published: ${published.length} | Queued: ${queued.length}`,
  );

  if (publishNext && queued.length > 0) {
    const nextItem = queued[0];
    console.log(
      `[SEO Worker] Publishing Next Scheduled Guide: "${nextItem.title}" (${nextItem.slug})`,
    );

    const targetDir = path.join(articlesDir, nextItem.slug);
    if (!existsSync(targetDir)) {
      mkdirSync(targetDir, { recursive: true });
    }

    const htmlContent = generateArticleHtml(nextItem);
    writeFileSync(path.join(targetDir, "index.html"), htmlContent, "utf8");

    updateSitemap(nextItem.slug);

    nextItem.status = "published";
    nextItem.publishedDate = getTodayDate();
    writeFileSync(queuePath, JSON.stringify(queue, null, 2), "utf8");
    updateArticlesHub();
    refreshKnowledgeFiles(queue.filter((a) => a.status === "published"));

    console.log(
      `[SEO Worker] Successfully published article: ${nextItem.slug}`,
    );

    // Rebuild dist static files if edit/ exists
    console.log(`[SEO Worker] Syncing publish artifacts...`);
    const editIndex = path.join(webAppRoot, "edit", "index.html");
    if (existsSync(editIndex)) {
      execSync("node scripts/prepare-publish.mjs", {
        cwd: webAppRoot,
        stdio: "inherit",
      });
    } else {
      console.log(
        "[SEO Worker] Notice: web-app/edit/ not present in this workspace. Build step will sync dist artifacts.",
      );
    }
  } else {
    console.log(
      "[SEO Worker] Health audit complete. No new articles pending publication today.",
    );
  }

  console.log("=== SEO Worker Run Finished ===");
}

// Direct execution
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  if (process.argv.includes("--refresh-published")) {
    refreshPublishedArticles();
    process.exit(0);
  }
  const publishNext = process.argv.includes("--publish-next");
  runWorker({ publishNext });
}
