import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";

import { crawlSite } from "../src/analysis/siteCrawl.js";
import { runCapability } from "../src/capabilities/run.js";
import { parseSitemapDocument } from "../src/connectors/site/sitemap.js";
import type {
  SiteHttpClient,
  SiteHttpResponse,
} from "../src/connectors/site/types.js";

function response(
  url: string,
  body: string,
  status = 200,
  contentType = "text/html; charset=utf-8",
): SiteHttpResponse {
  return {
    requestedUrl: url,
    finalUrl: url,
    status,
    redirects: [],
    headers: {
      contentType,
      contentLength: Buffer.byteLength(body),
      contentEncoding: null,
      xRobotsTag: [],
    },
    body,
    byteLength: Buffer.byteLength(body),
    bodyRead: "complete",
    sha256: createHash("sha256").update(body).digest("hex"),
    durationMs: 1,
  };
}

test("parses XML sitemap indexes, URL sets, entities, and text sitemaps", () => {
  const index = parseSitemapDocument(
    `<?xml version="1.0"?>
      <sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
        <sitemap><loc>https://example.com/one.xml</loc><lastmod>2026-07-01</lastmod></sitemap>
        <sitemap><loc>https://example.com/two.xml</loc></sitemap>
      </sitemapindex>`,
    10,
  );
  assert.equal(index.kind, "sitemapindex");
  assert.deepEqual(index.childSitemaps, [
    { loc: "https://example.com/one.xml", lastmod: "2026-07-01" },
    { loc: "https://example.com/two.xml", lastmod: null },
  ]);

  const urlset = parseSitemapDocument(
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
      xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
      <url><loc>https://example.com/a?x=1&amp;y=2</loc>
        <image:image><image:loc>https://example.com/image.jpg</image:loc></image:image>
      </url>
      <url><loc>https://example.com/b</loc></url>
    </urlset>`,
    1,
  );
  assert.equal(urlset.kind, "urlset");
  assert.equal(urlset.totalEntries, 2);
  assert.equal(urlset.retainedEntries, 1);
  assert.equal(urlset.truncated, true);
  assert.equal(urlset.urls[0]?.loc, "https://example.com/a?x=1&y=2");

  const text = parseSitemapDocument(
    "# pages\nhttps://example.com/a\nhttps://example.com/b\n",
    10,
  );
  assert.equal(text.format, "text");
  assert.equal(text.kind, "urlset");
  assert.equal(text.urls.length, 2);
});

test("reports malformed, unsupported, and doctype sitemap input", () => {
  const malformed = parseSitemapDocument(
    "<urlset><url><loc>https://example.com/a</urlset>",
    10,
  );
  assert.equal(malformed.errors.length > 0, true);

  const unsupported = parseSitemapDocument("<feed></feed>", 10);
  assert.equal(unsupported.kind, "unsupported");
  assert.equal(unsupported.errors.length > 0, true);

  const doctype = parseSitemapDocument(
    '<!DOCTYPE urlset><urlset><url><loc>https://example.com/</loc></url></urlset>',
    10,
  );
  assert.equal(
    doctype.errors.some((message) => message.includes("DOCTYPE")),
    true,
  );
});

test("crawls sitemap indexes and links with compact, evidence-linked findings", async () => {
  const calls: string[] = [];
  const pages = new Map<string, SiteHttpResponse>();
  pages.set(
    "https://example.com/robots.txt",
    response(
      "https://example.com/robots.txt",
      "User-agent: *\nAllow: /\nSitemap: https://example.com/sitemap-index.xml",
      200,
      "text/plain",
    ),
  );
  pages.set(
    "https://example.com/sitemap-index.xml",
    response(
      "https://example.com/sitemap-index.xml",
      `<sitemapindex>
        <sitemap><loc>https://example.com/pages-1.xml</loc></sitemap>
        <sitemap><loc>https://example.com/pages-2.xml</loc></sitemap>
      </sitemapindex>`,
      200,
      "application/xml",
    ),
  );
  pages.set(
    "https://example.com/pages-1.xml",
    response(
      "https://example.com/pages-1.xml",
      `<urlset>
        <url><loc>https://example.com/</loc></url>
        <url><loc>https://example.com/a</loc><lastmod>2026-07-01</lastmod></url>
        <url><loc>https://example.com/b</loc></url>
        <url><loc>https://example.com/hidden</loc></url>
      </urlset>`,
      200,
      "application/xml",
    ),
  );
  pages.set(
    "https://example.com/pages-2.xml",
    response(
      "https://example.com/pages-2.xml",
      "<urlset><url><loc>https://example.com/canonical</loc></url></urlset>",
      200,
      "application/xml",
    ),
  );
  pages.set(
    "https://example.com/",
    response(
      "https://example.com/",
      `<html><head><title>Home</title><meta name="description" content="Home">
        <link rel="canonical" href="https://example.com/"></head>
        <body><h1>Home</h1>
        <a href="/a">A</a><a href="/broken">Broken</a><a href="/link-only">Link only</a>
        </body></html>`,
    ),
  );
  pages.set(
    "https://example.com/a",
    response(
      "https://example.com/a",
      `<html><head><title>Duplicate</title><meta name="description" content="A">
      <link rel="canonical" href="https://example.com/a"></head>
      <body><h1>A</h1><a href="/b">B</a></body></html>`,
    ),
  );
  pages.set(
    "https://example.com/b",
    response(
      "https://example.com/b",
      `<html><head><title>Duplicate</title><meta name="robots" content="noindex">
      <link rel="canonical" href="https://example.com/a"></head><body><h1>B</h1></body></html>`,
    ),
  );
  pages.set(
    "https://example.com/hidden",
    response(
      "https://example.com/hidden",
      "<html><head><title>Hidden</title></head><body><h1>Hidden</h1></body></html>",
    ),
  );
  pages.set(
    "https://example.com/canonical",
    response(
      "https://example.com/canonical",
      "<html><head><title>Canonical</title></head><body><h1>Canonical</h1></body></html>",
    ),
  );
  pages.set(
    "https://example.com/broken",
    response(
      "https://example.com/broken",
      "<html><head><title>Gone</title></head><body>Gone</body></html>",
      404,
    ),
  );
  pages.set(
    "https://example.com/link-only",
    response(
      "https://example.com/link-only",
      "<html><head><title>Link only</title></head><body><h1>Link only</h1></body></html>",
    ),
  );
  const client: SiteHttpClient = {
    async get(url) {
      calls.push(url);
      const selected = pages.get(url);
      assert.ok(selected, `Unexpected URL: ${url}`);
      return selected;
    },
  };

  const crawl = await crawlSite(
    "https://example.com/",
    {
      limit: 10,
      concurrency: 3,
      now: new Date("2026-07-30T12:00:00.000Z"),
    },
    client,
  );

  assert.equal(crawl.summary.pagesDiscovered, 7);
  assert.equal(crawl.summary.pagesAudited, 7);
  assert.equal(crawl.summary.sitemapDocumentsFetched, 3);
  assert.equal(crawl.summary.sitemapUrlsObserved, 5);
  assert.equal(crawl.summary.statuses.clientError4xx, 1);
  assert.equal(crawl.coverage.truncated, false);
  assert.equal(crawl.coverage.partial, false);
  assert.equal(
    calls.filter((url) => url.endsWith("/robots.txt")).length,
    1,
  );
  const ruleIds = new Set(crawl.findings.map(({ ruleId }) => ruleId));
  assert.equal(ruleIds.has("SITEMAP_URL_NOINDEX_CONFLICT_V1"), true);
  assert.equal(ruleIds.has("SITEMAP_CANONICAL_TARGET_CONFLICT_V1"), true);
  assert.equal(
    [...ruleIds].some((ruleId) =>
      ruleId.startsWith("DUPLICATE_TITLE_IN_AUDITED_SET_V1"),
    ),
    true,
  );
  assert.equal(ruleIds.has("AUDITED_INTERNAL_LINK_TARGET_ERROR_V1"), true);
  assert.equal(
    ruleIds.has("NOT_OBSERVED_IN_COMPLETE_SITEMAP_SET_V1"),
    true,
  );
  assert.equal(ruleIds.has("UNLINKED_IN_COMPLETE_STATIC_CRAWL_V1"), true);
  assert.equal(
    crawl.findings.every(
      ({ evidenceRefs }) =>
        evidenceRefs.length > 0 &&
        evidenceRefs.every((ref) =>
          crawl.observations.some(({ id }) => id === ref),
        ),
    ),
    true,
  );
  assert.equal(JSON.stringify(crawl).includes("<html"), false);
  assert.equal(
    crawl.observations.filter(({ type }) => type === "page").length,
    7,
  );
});

test("marks page-limit and sitemap-entry caps as incomplete coverage", async () => {
  const client: SiteHttpClient = {
    async get(url) {
      if (url.endsWith("/robots.txt")) {
        return response(
          url,
          "User-agent: *\nAllow: /\nSitemap: https://example.com/sitemap.xml",
          200,
          "text/plain",
        );
      }
      if (url.endsWith("/sitemap.xml")) {
        return response(
          url,
          `<urlset>
            <url><loc>https://example.com/</loc></url>
            <url><loc>https://example.com/a</loc></url>
            <url><loc>https://example.com/b</loc></url>
            <url><loc>https://example.com/c</loc></url>
          </urlset>`,
          200,
          "application/xml",
        );
      }
      return response(
        url,
        `<html><head><title>${url}</title></head><body></body></html>`,
      );
    },
  };

  const crawl = await crawlSite(
    "https://example.com/",
    { limit: 2, concurrency: 2 },
    client,
  );
  assert.equal(crawl.summary.pagesDiscovered, 4);
  assert.equal(crawl.summary.pagesAudited, 2);
  assert.equal(crawl.coverage.omitted, 2);
  assert.equal(crawl.coverage.truncated, true);
  assert.equal(crawl.coverage.partial, true);
  assert.equal(
    crawl.coverage.incompleteReasons.some((reason) =>
      reason.includes("requested limit"),
    ),
    true,
  );

  const envelope = await runCapability(
    "site.crawl",
    {
      url: "https://example.com/",
      limit: 2,
      concurrency: 2,
    },
    { siteClient: client },
  );
  assert.equal(envelope.run.capabilityId, "site.crawl");
  assert.equal(envelope.subject.ga4Property, null);
  assert.equal(envelope.result.pages.length, 2);
  assert.equal(envelope.coverage.truncated, true);
});

test("keeps common apex-to-www redirects inside the crawl boundary", async () => {
  const client: SiteHttpClient = {
    async get(url) {
      if (url.endsWith("/robots.txt")) {
        return response(url, "User-agent: *\nAllow: /", 200, "text/plain");
      }
      if (url === "https://example.com/") {
        return {
          ...response(
            url,
            '<html><head><title>Home</title></head><body><a href="https://www.example.com/page">Page</a></body></html>',
          ),
          finalUrl: "https://www.example.com/",
          redirects: [
            {
              url,
              status: 301,
              location: "https://www.example.com/",
            },
          ],
        };
      }
      assert.equal(url, "https://www.example.com/page");
      return response(
        url,
        "<html><head><title>Page</title></head><body></body></html>",
      );
    },
  };

  const crawl = await crawlSite(
    "https://example.com/",
    { sitemap: "none", limit: 2 },
    client,
  );
  assert.equal(crawl.summary.pagesAudited, 2);
  assert.equal(
    crawl.pages.some(({ url }) => url === "https://www.example.com/page"),
    true,
  );
});

test("rejects explicit cross-site sitemap scope before fetching", async () => {
  const client: SiteHttpClient = {
    async get() {
      assert.fail("No network request should occur.");
    },
  };
  await assert.rejects(
    crawlSite(
      "https://example.com/",
      { sitemap: "https://other.example/sitemap.xml" },
      client,
    ),
    (error) =>
      error instanceof Error &&
      error.message.includes("apex/www host boundary"),
  );
});
