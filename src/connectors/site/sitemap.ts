import { SaxesParser } from "saxes";

import type {
  ParsedSitemap,
  SitemapChildEntry,
  SitemapUrlEntry,
} from "./types.js";

const MAX_REPORTED_PARSE_ERRORS = 10;

function parseTextSitemap(
  text: string,
  maxEntries: number,
): ParsedSitemap {
  const urls: SitemapUrlEntry[] = [];
  let totalEntries = 0;
  const errors: string[] = [];
  for (const [index, rawLine] of text.split(/\r?\n/u).entries()) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }
    let parsed: URL;
    try {
      parsed = new URL(line);
    } catch {
      if (errors.length < MAX_REPORTED_PARSE_ERRORS) {
        errors.push(`Line ${index + 1} is not an absolute URL.`);
      }
      continue;
    }
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      if (errors.length < MAX_REPORTED_PARSE_ERRORS) {
        errors.push(`Line ${index + 1} does not use HTTP or HTTPS.`);
      }
      continue;
    }
    totalEntries += 1;
    if (urls.length < maxEntries) {
      urls.push({ loc: parsed.toString(), lastmod: null });
    }
  }
  return {
    format: "text",
    kind: "urlset",
    urls,
    childSitemaps: [],
    totalEntries,
    retainedEntries: urls.length,
    truncated: totalEntries > urls.length,
    errors,
    warnings: [
      "Text sitemaps contain URLs only; last-modified metadata is unavailable.",
    ],
  };
}

function localName(name: string): string {
  return name.toLowerCase().split(":").at(-1) ?? name.toLowerCase();
}

export function parseSitemapDocument(
  text: string,
  maxEntries: number,
): ParsedSitemap {
  const trimmed = text.trim();
  if (!trimmed.startsWith("<")) {
    return parseTextSitemap(text, maxEntries);
  }

  const urls: SitemapUrlEntry[] = [];
  const childSitemaps: SitemapChildEntry[] = [];
  const errors: string[] = [];
  const warnings: string[] = [];
  const parser = new SaxesParser({ xmlns: false });
  let root: string | null = null;
  let currentContainer: "url" | "sitemap" | null = null;
  let currentField: "loc" | "lastmod" | null = null;
  let fieldText = "";
  let currentLoc: string | null = null;
  let currentLastmod: string | null = null;
  let totalEntries = 0;
  let doctypeObserved = false;
  const stack: string[] = [];

  parser.on("doctype", () => {
    doctypeObserved = true;
  });
  parser.on("error", (error) => {
    if (errors.length < MAX_REPORTED_PARSE_ERRORS) {
      errors.push(
        `XML parse error near line ${parser.line}: ${error.message.replace(/\s+/gu, " ").slice(0, 240)}`,
      );
    }
  });
  parser.on("opentag", (tag) => {
    const name = localName(tag.name);
    const parent = stack.at(-1) ?? null;
    if (root === null) {
      root = name;
    }
    if (
      (name === "url" || name === "sitemap") &&
      parent === root
    ) {
      currentContainer = name;
      currentLoc = null;
      currentLastmod = null;
    } else if (
      currentContainer !== null &&
      parent === currentContainer &&
      (name === "loc" || name === "lastmod")
    ) {
      currentField = name;
      fieldText = "";
    }
    stack.push(name);
  });
  parser.on("text", (value) => {
    if (currentField !== null) {
      fieldText += value;
    }
  });
  parser.on("cdata", (value) => {
    if (currentField !== null) {
      fieldText += value;
    }
  });
  parser.on("closetag", (tag) => {
    const name = localName(tag.name);
    if (currentField === name) {
      const value = fieldText.trim();
      if (currentField === "loc") {
        currentLoc = value || null;
      } else {
        currentLastmod = value || null;
      }
      currentField = null;
      fieldText = "";
    } else if (
      currentContainer !== null &&
      name === currentContainer
    ) {
      if (currentLoc === null) {
        if (errors.length < MAX_REPORTED_PARSE_ERRORS) {
          errors.push(
            `${currentContainer} entry ${totalEntries + 1} has no non-empty loc.`,
          );
        }
      } else {
        totalEntries += 1;
        if (urls.length + childSitemaps.length < maxEntries) {
          const entry = {
            loc: currentLoc,
            lastmod: currentLastmod,
          };
          if (currentContainer === "url") {
            urls.push(entry);
          } else {
            childSitemaps.push(entry);
          }
        }
      }
      currentContainer = null;
      currentLoc = null;
      currentLastmod = null;
    }
    stack.pop();
  });

  try {
    parser.write(text).close();
  } catch (error) {
    if (errors.length < MAX_REPORTED_PARSE_ERRORS) {
      errors.push(
        error instanceof Error
          ? error.message.replace(/\s+/gu, " ").slice(0, 240)
          : "XML parsing failed.",
      );
    }
  }

  if (doctypeObserved) {
    errors.push(
      "DOCTYPE declarations are not accepted in sitemap audit input.",
    );
  }
  const kind =
    root === "urlset"
      ? "urlset"
      : root === "sitemapindex"
        ? "sitemapindex"
        : "unsupported";
  if (kind === "unsupported") {
    errors.push(
      `Unsupported sitemap root element: ${root ?? "none"}.`,
    );
  }
  if (kind === "urlset" && childSitemaps.length > 0) {
    warnings.push("Sitemap child entries were ignored inside urlset.");
  }
  if (kind === "sitemapindex" && urls.length > 0) {
    warnings.push("Page URL entries were ignored inside sitemapindex.");
  }

  const retainedEntries =
    kind === "urlset"
      ? urls.length
      : kind === "sitemapindex"
        ? childSitemaps.length
        : 0;
  return {
    format: "xml",
    kind,
    urls: kind === "urlset" ? urls : [],
    childSitemaps:
      kind === "sitemapindex" ? childSitemaps : [],
    totalEntries,
    retainedEntries,
    truncated: totalEntries > retainedEntries,
    errors: [...new Set(errors)].slice(0, MAX_REPORTED_PARSE_ERRORS),
    warnings: [...new Set(warnings)],
  };
}
