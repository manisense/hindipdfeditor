import assert from "node:assert/strict";
import { test } from "node:test";
import { renderArticle } from "./article-template.mjs";
const base = {
  slug: "test-guide",
  language: "en",
  title: "Test <script>unsafe</script>",
  metaDescription: 'A "description"',
  category: "Guides",
  directAnswer: "Safe <img onerror=bad>",
  sections: [],
  faqs: [{ q: "Can I test?", a: "Yes < safely" }],
  publishedDate: "2026-08-20",
  reviewedDate: "2026-10-01",
};
test("escapes article content and script JSON without inventing language alternates", () => {
  const html = renderArticle(base, [base]);
  assert.ok(!html.includes("<script>unsafe</script>"));
  assert.ok(html.includes("&lt;script&gt;"));
  assert.ok(!html.includes("hreflang="));
  const json = JSON.parse(
    html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1],
  );
  assert.equal(json["@graph"][0].datePublished, "2026-08-20");
  assert.equal(
    json["@graph"][2].mainEntity[0].acceptedAnswer.text,
    base.faqs[0].a,
  );
});
test("only reciprocal real language pairs receive hreflang", () => {
  const en = { ...base, alternateSlug: "test-hindi" };
  const hi = {
    ...base,
    slug: "test-hindi",
    language: "hi",
    alternateSlug: base.slug,
  };
  for (const a of [en, hi]) {
    const html = renderArticle(a, [en, hi]);
    assert.ok(html.includes('hreflang="en"'));
    assert.ok(html.includes('hreflang="hi"'));
    assert.ok(html.includes('hreflang="x-default"'));
  }
  assert.ok(
    !renderArticle(en, [en, { ...hi, alternateSlug: undefined }]).includes(
      "hreflang=",
    ),
  );
});
test("rejects unreviewed content and unsafe route identity", () => {
  assert.throws(() => renderArticle({ ...base, reviewedDate: undefined }, []));
  assert.throws(() => renderArticle({ ...base, slug: "../escape" }, []));
});
