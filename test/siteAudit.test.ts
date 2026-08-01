import assert from "node:assert/strict";
import { Readable } from "node:stream";
import test from "node:test";

import { auditPage } from "../src/analysis/pageAudit.js";
import { runCapability } from "../src/capabilities/run.js";
import {
  isPublicAddress,
  normalizeAuditUrl,
  resolvePublicAuditUrl,
} from "../src/connectors/site/networkPolicy.js";
import { createSiteHttpClient } from "../src/connectors/site/http.js";
import {
  evaluateRobots,
  parseRobotsTxt,
} from "../src/connectors/site/robots.js";
import type {
  SiteHttpClient,
  SiteHttpResponse,
} from "../src/connectors/site/types.js";
import { AppError } from "../src/core/result.js";

function response(
  url: string,
  body: string,
  overrides: Partial<SiteHttpResponse> = {},
): SiteHttpResponse {
  return {
    requestedUrl: url,
    finalUrl: url,
    status: 200,
    redirects: [],
    headers: {
      contentType: url.endsWith("/robots.txt")
        ? "text/plain"
        : "text/html; charset=utf-8",
      contentLength: Buffer.byteLength(body),
      contentEncoding: null,
      xRobotsTag: [],
    },
    body,
    byteLength: Buffer.byteLength(body),
    bodyRead: "complete",
    sha256: "abc123",
    durationMs: 4,
    ...overrides,
  };
}

function fakeClient(
  pageBody: string,
  robotsBody = "User-agent: *\nAllow: /",
): SiteHttpClient & { calls: string[] } {
  const calls: string[] = [];
  return {
    calls,
    async get(url) {
      calls.push(url);
      return url.endsWith("/robots.txt")
        ? response(url, robotsBody)
        : response(url, pageBody);
    },
  };
}

test("audits returned static HTML without returning the raw document", async () => {
  const client = fakeClient(`<!doctype html>
    <html lang="en"><head>
      <title>Useful page</title>
      <meta name="robots" content="noindex">
      <link rel="canonical" href="https://other.example/other">
      <script type="application/ld+json">{"@type":"Article"</script>
    </head><body><h1>Evidence</h1><a href="/next">Next</a></body></html>`);
  const analysis = await auditPage(
    "https://example.com/page#section",
    { now: new Date("2026-07-30T12:00:00.000Z") },
    client,
  );

  assert.equal(analysis.summary.requestedUrl, "https://example.com/page");
  assert.equal(analysis.summary.htmlObserved, true);
  assert.equal(analysis.summary.robotsDecision, "allowed");
  assert.deepEqual(
    analysis.findings.map(({ ruleId }) => ruleId).sort(),
    [
      "CROSS_ORIGIN_CANONICAL_REVIEW_V1",
      "DESCRIPTION_NOT_OBSERVED_STATIC_HTML_V1",
      "INVALID_JSON_LD_SYNTAX_V1",
      "NOINDEX_DIRECTIVE_OBSERVED_V1",
    ],
  );
  assert.equal(JSON.stringify(analysis).includes("<!doctype html>"), false);
  assert.equal(
    analysis.observations.some(
      (item) => item.type === "html" && item.sourceRef === "src_static_html",
    ),
    true,
  );
});

test("parses large JSON-LD without applying display-text truncation", async () => {
  const jsonLd = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "ItemList",
    itemListElement: Array.from({ length: 150 }, (_, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: `Evidence item ${index + 1}`,
      url: `https://example.com/items/${index + 1}`,
    })),
  });
  assert.equal(jsonLd.length > 2_000, true);
  const client = fakeClient(
    `<html><head><title>Items</title><script type="application/ld+json">${jsonLd}</script></head><body><h1>Items</h1></body></html>`,
  );
  const analysis = await auditPage(
    "https://example.com/items",
    {},
    client,
  );

  assert.equal(
    analysis.findings.some(
      ({ ruleId }) => ruleId === "INVALID_JSON_LD_SYNTAX_V1",
    ),
    false,
  );
  const html = analysis.observations.find(
    (item) => item.type === "html",
  );
  assert.equal(
    html !== undefined &&
      "structuredData" in html.payload &&
      html.payload.structuredData[0]?.parseStatus === "valid_json",
    true,
  );
});

test("uses a semantic page hash that ignores volatile executable scripts", async () => {
  const first = await auditPage(
    "https://example.com/",
    {},
    fakeClient(
      '<html><head><title>Stable</title></head><body><h1>Stable</h1><script>window.__BUILD_ID__="one"</script></body></html>',
    ),
  );
  const second = await auditPage(
    "https://example.com/",
    {},
    fakeClient(
      '<html><head><title>Stable</title></head><body><h1>Stable</h1><script>window.__BUILD_ID__="two"</script></body></html>',
    ),
  );
  const changed = await auditPage(
    "https://example.com/",
    {},
    fakeClient(
      '<html><head><title>Stable</title></head><body><h1>Changed</h1><script>window.__BUILD_ID__="two"</script></body></html>',
    ),
  );

  assert.equal(first.summary.contentHash, second.summary.contentHash);
  assert.notEqual(first.summary.contentHash, changed.summary.contentHash);
});

test("respects a Googlebot disallow and skips the page request", async () => {
  const client = fakeClient(
    "<html><title>Should not be fetched</title></html>",
    "User-agent: Googlebot\nDisallow: /private",
  );
  const analysis = await auditPage(
    "https://example.com/private/report",
    {},
    client,
  );

  assert.equal(analysis.summary.robotsDecision, "disallowed");
  assert.equal(analysis.coverage.partial, true);
  assert.equal(client.calls.length, 1);
  assert.equal(
    analysis.findings[0]?.ruleId,
    "ROBOTS_DISALLOW_GOOGLEBOT_V1",
  );
});

test("robots uses longest matching rule and allow wins an equal tie", () => {
  const parsed = parseRobotsTxt(`
    User-agent: *
    Disallow: /private/
    Allow: /private/public
    Disallow: /same
    Allow: /same
    Sitemap: https://example.com/sitemap.xml
  `);
  assert.equal(
    evaluateRobots(
      parsed,
      new URL("https://example.com/private/public"),
    ).decision,
    "allowed",
  );
  assert.equal(
    evaluateRobots(parsed, new URL("https://example.com/same")).decision,
    "allowed",
  );
  assert.deepEqual(parsed.sitemaps, ["https://example.com/sitemap.xml"]);
});

test("network policy blocks private targets and URL credentials", async () => {
  assert.equal(isPublicAddress("127.0.0.1"), false);
  assert.equal(isPublicAddress("10.0.0.1"), false);
  assert.equal(isPublicAddress("::1"), false);
  assert.equal(isPublicAddress("::ffff:7f00:1"), false);
  assert.equal(isPublicAddress("8.8.8.8"), true);
  assert.throws(
    () => normalizeAuditUrl("https://user:pass@example.com/"),
    (error) =>
      error instanceof AppError &&
      error.code === "URL_CREDENTIALS_NOT_ALLOWED",
  );
  await assert.rejects(
    resolvePublicAuditUrl("https://example.com/", async () => [
      { address: "127.0.0.1", family: 4 },
    ]),
    (error) =>
      error instanceof AppError &&
      error.code === "PRIVATE_NETWORK_BLOCKED",
  );
  await assert.rejects(
    resolvePublicAuditUrl("http://[::1]/"),
    (error) =>
      error instanceof AppError &&
      error.code === "PRIVATE_NETWORK_BLOCKED",
  );
});

test("redirect targets are resolved and blocked before a second request", async () => {
  let requests = 0;
  const client = createSiteHttpClient({
    resolveHost: async (hostname) =>
      hostname === "example.com"
        ? [{ address: "8.8.8.8", family: 4 }]
        : [{ address: "127.0.0.1", family: 4 }],
    requestOnce: async () => {
      requests += 1;
      return {
        status: 302,
        headers: { location: "https://www.example.com/secret" },
        stream: Readable.from([]),
      };
    },
  });

  await assert.rejects(
    client.get("https://example.com/", {
      timeoutMs: 1_000,
      maxBytes: 1_024,
      maxRedirects: 5,
      accept: "text/html",
    }),
    (error) =>
      error instanceof AppError &&
      error.code === "PRIVATE_NETWORK_BLOCKED",
  );
  assert.equal(requests, 1);
});

test("page audit capability runs without Google configuration", async () => {
  const client = fakeClient(
    "<html><head><title>Page</title></head><body><h1>Page</h1></body></html>",
  );
  const envelope = await runCapability(
    "site.page_audit",
    { url: "https://example.com/page" },
    {
      siteClient: client,
      now: new Date("2026-07-30T12:00:00.000Z"),
    },
  );

  assert.equal(envelope.run.capabilityId, "site.page_audit");
  assert.equal(envelope.subject.url, "https://example.com/page");
  assert.equal(envelope.subject.ga4Property, null);
  assert.equal(envelope.sources.length, 3);
  assert.equal(envelope.result.staticHtmlOnly, true);
});
