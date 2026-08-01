import { createHash } from "node:crypto";

import {
  parse,
  type DefaultTreeAdapterTypes,
} from "parse5";

import type {
  ExtractedJsonLd,
  ExtractedLink,
  HtmlDocumentFacts,
} from "./types.js";

type Node = DefaultTreeAdapterTypes.Node;
type Element = DefaultTreeAdapterTypes.Element;

const MAX_EXTRACTED_LINKS = 500;
const MAX_TEXT_LENGTH = 2_000;

function isElement(node: Node): node is Element {
  return "tagName" in node && Array.isArray(node.attrs);
}

function childNodes(node: Node): Node[] {
  return "childNodes" in node ? node.childNodes : [];
}

function walk(node: Node, visit: (element: Element) => void): void {
  if (isElement(node)) {
    visit(node);
  }
  for (const child of childNodes(node)) {
    walk(child, visit);
  }
}

function attribute(element: Element, name: string): string | null {
  return (
    element.attrs.find(
      (item) => item.name.toLowerCase() === name.toLowerCase(),
    )?.value ?? null
  );
}

function textContent(node: Node): string {
  const pieces: string[] = [];
  const collect = (current: Node) => {
    if ("value" in current && typeof current.value === "string") {
      pieces.push(current.value);
    }
    for (const child of childNodes(current)) {
      collect(child);
    }
  };
  collect(node);
  return pieces
    .join(" ")
    .replace(/\s+/gu, " ")
    .trim()
    .slice(0, MAX_TEXT_LENGTH);
}

function rawTextContent(node: Node): string {
  const pieces: string[] = [];
  const collect = (current: Node) => {
    if ("value" in current && typeof current.value === "string") {
      pieces.push(current.value);
    }
    for (const child of childNodes(current)) {
      collect(child);
    }
  };
  collect(node);
  return pieces.join("");
}

function hasAncestor(element: Element, tagName: string): boolean {
  let current = element.parentNode;
  while (current) {
    if (isElement(current) && current.tagName.toLowerCase() === tagName) {
      return true;
    }
    current = "parentNode" in current ? current.parentNode : null;
  }
  return false;
}

function directiveTokens(value: string): string[] {
  const tokens = value
    .toLowerCase()
    .split(/[,\s]+/u)
    .map((token) => token.trim())
    .filter(Boolean);
  if (tokens.includes("none")) {
    tokens.push("noindex", "nofollow");
  }
  return [...new Set(tokens)];
}

function collectJsonLdValues(
  value: unknown,
  key: "@type" | "@id",
  output: Set<string>,
): void {
  if (Array.isArray(value)) {
    for (const item of value) {
      collectJsonLdValues(item, key, output);
    }
    return;
  }
  if (typeof value !== "object" || value === null) {
    return;
  }
  const record = value as Record<string, unknown>;
  const selected = record[key];
  if (typeof selected === "string") {
    output.add(selected);
  } else if (Array.isArray(selected)) {
    for (const item of selected) {
      if (typeof item === "string") {
        output.add(item);
      }
    }
  }
  for (const nested of Object.values(record)) {
    collectJsonLdValues(nested, key, output);
  }
}

function jsonLd(element: Element, index: number): ExtractedJsonLd {
  try {
    const parsed: unknown = JSON.parse(rawTextContent(element));
    const types = new Set<string>();
    const ids = new Set<string>();
    collectJsonLdValues(parsed, "@type", types);
    collectJsonLdValues(parsed, "@id", ids);
    return {
      index,
      parseStatus: "valid_json",
      types: [...types].slice(0, 100),
      ids: [...ids].slice(0, 100),
      error: null,
    };
  } catch {
    return {
      index,
      parseStatus: "invalid_json",
      types: [],
      ids: [],
      error: "JSON-LD block is not valid JSON.",
    };
  }
}

function stableJson(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(stableJson);
  }
  if (typeof value !== "object" || value === null) {
    return value;
  }
  return Object.fromEntries(
    Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, nested]) => [key, stableJson(nested)]),
  );
}

function semanticDocumentData(
  html: string,
): {
  visibleText: string;
  structuredData: unknown[];
} {
  const document = parse(html);
  const visiblePieces: string[] = [];
  const structuredData: unknown[] = [];
  const ignoredTextTags = new Set([
    "script",
    "style",
    "noscript",
    "template",
    "svg",
  ]);

  const collectVisible = (node: Node, ignored: boolean) => {
    const tag = isElement(node) ? node.tagName.toLowerCase() : null;
    const nextIgnored = ignored || (tag !== null && ignoredTextTags.has(tag));
    if (
      !nextIgnored &&
      "value" in node &&
      typeof node.value === "string"
    ) {
      visiblePieces.push(node.value);
    }
    for (const child of childNodes(node)) {
      collectVisible(child, nextIgnored);
    }
  };

  walk(document, (element) => {
    if (
      element.tagName.toLowerCase() !== "script" ||
      attribute(element, "type")?.trim().toLowerCase() !==
        "application/ld+json"
    ) {
      return;
    }
    const raw = rawTextContent(element);
    try {
      structuredData.push(stableJson(JSON.parse(raw)));
    } catch {
      structuredData.push({
        invalidJsonSha256: createHash("sha256")
          .update(raw)
          .digest("hex"),
      });
    }
  });
  collectVisible(document, false);

  return {
    visibleText: visiblePieces
      .join(" ")
      .replace(/\s+/gu, " ")
      .trim(),
    structuredData,
  };
}

export function stableHtmlContentHash(
  html: string,
  finalUrl: string,
  facts: HtmlDocumentFacts,
): string {
  const semantic = semanticDocumentData(html);
  const documentUrl = new URL(finalUrl);
  documentUrl.hash = "";
  const representation = {
    url: documentUrl.toString(),
    htmlLang: facts.htmlLang,
    titles: facts.titles,
    metaDescriptions: facts.metaDescriptions,
    metaRobots: facts.metaRobots,
    canonicals: facts.canonicals,
    headings: facts.headings,
    links: facts.links.items.map(
      ({ resolvedUrl, text, rel, kind }) => ({
        resolvedUrl,
        text,
        rel,
        kind,
      }),
    ),
    visibleText: semantic.visibleText,
    structuredData: semantic.structuredData,
  };
  return createHash("sha256")
    .update(JSON.stringify(representation))
    .digest("hex");
}

function linkKind(
  resolved: URL | null,
  documentUrl: URL,
): ExtractedLink["kind"] {
  if (!resolved) {
    return "invalid";
  }
  if (resolved.protocol !== "http:" && resolved.protocol !== "https:") {
    return "non_http";
  }
  return resolved.origin === documentUrl.origin ? "internal" : "external";
}

export function extractHtmlDocument(
  html: string,
  finalUrl: string,
): HtmlDocumentFacts {
  const document = parse(html);
  const documentUrl = new URL(finalUrl);
  let baseHref: string | null = null;
  let htmlLang: string | null = null;
  const titles: string[] = [];
  const metaDescriptions: string[] = [];
  const metaRobots: HtmlDocumentFacts["metaRobots"] = [];
  const canonicals: HtmlDocumentFacts["canonicals"] = [];
  const headings: HtmlDocumentFacts["headings"] = [];
  const links: ExtractedLink[] = [];
  const structuredData: ExtractedJsonLd[] = [];
  let totalLinks = 0;
  let nofollowLinks = 0;

  walk(document, (element) => {
    const tag = element.tagName.toLowerCase();
    if (tag === "html" && htmlLang === null) {
      htmlLang = attribute(element, "lang")?.trim() || null;
    }
    if (tag === "base" && baseHref === null) {
      baseHref = attribute(element, "href")?.trim() || null;
    }
  });

  let resolvedBase = documentUrl;
  if (baseHref !== null) {
    try {
      resolvedBase = new URL(baseHref, documentUrl);
    } catch {
      resolvedBase = documentUrl;
    }
  }

  walk(document, (element) => {
    const tag = element.tagName.toLowerCase();
    if (tag === "title") {
      titles.push(textContent(element));
      return;
    }
    if (tag === "meta") {
      const name = attribute(element, "name")?.trim().toLowerCase();
      const content = attribute(element, "content")?.trim() ?? "";
      if (name === "description") {
        metaDescriptions.push(content.slice(0, MAX_TEXT_LENGTH));
      }
      if (name === "robots" || name === "googlebot") {
        metaRobots.push({
          name,
          directives: directiveTokens(content),
        });
      }
      return;
    }
    if (tag === "link") {
      const rel = directiveTokens(attribute(element, "rel") ?? "");
      if (rel.includes("canonical")) {
        const rawHref = attribute(element, "href")?.trim() ?? "";
        let resolvedUrl: string | null = null;
        try {
          resolvedUrl = rawHref
            ? new URL(rawHref, resolvedBase).toString()
            : null;
        } catch {
          resolvedUrl = null;
        }
        canonicals.push({
          rawHref,
          resolvedUrl,
          location: hasAncestor(element, "head") ? "head" : "body",
        });
      }
      return;
    }
    if (/^h[1-6]$/u.test(tag)) {
      headings.push({
        level: Number(tag[1]) as 1 | 2 | 3 | 4 | 5 | 6,
        text: textContent(element),
      });
      return;
    }
    if (
      tag === "script" &&
      attribute(element, "type")?.trim().toLowerCase() ===
        "application/ld+json"
    ) {
      structuredData.push(jsonLd(element, structuredData.length));
      return;
    }
    if (tag === "a") {
      totalLinks += 1;
      const rawHref = attribute(element, "href")?.trim() ?? "";
      const rel = directiveTokens(attribute(element, "rel") ?? "");
      if (rel.includes("nofollow")) {
        nofollowLinks += 1;
      }
      if (links.length >= MAX_EXTRACTED_LINKS) {
        return;
      }
      let resolved: URL | null = null;
      try {
        resolved = rawHref ? new URL(rawHref, resolvedBase) : null;
        if (resolved) {
          resolved.hash = "";
        }
      } catch {
        resolved = null;
      }
      links.push({
        rawHref: rawHref.slice(0, MAX_TEXT_LENGTH),
        resolvedUrl: resolved?.toString() ?? null,
        text: textContent(element),
        rel,
        kind: linkKind(resolved, documentUrl),
      });
    }
  });

  const uniqueInternal = new Set(
    links
      .filter(({ kind }) => kind === "internal")
      .flatMap(({ resolvedUrl }) => (resolvedUrl ? [resolvedUrl] : [])),
  ).size;
  const uniqueExternal = new Set(
    links
      .filter(({ kind }) => kind === "external")
      .flatMap(({ resolvedUrl }) => (resolvedUrl ? [resolvedUrl] : [])),
  ).size;

  return {
    parseMode: "static_html",
    browserRendered: false,
    htmlLang,
    titles,
    metaDescriptions,
    metaRobots,
    canonicals,
    headings,
    baseHref,
    links: {
      total: totalLinks,
      uniqueInternal,
      uniqueExternal,
      nofollow: nofollowLinks,
      truncated: totalLinks > links.length,
      items: links,
    },
    structuredData,
  };
}

export function normalizeRobotDirectives(values: string[]): string[] {
  return directiveTokens(values.join(","));
}
