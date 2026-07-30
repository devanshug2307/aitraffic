import { createHash } from "node:crypto";
import http, {
  type IncomingHttpHeaders,
  type IncomingMessage,
} from "node:http";
import https from "node:https";
import type { LookupFunction } from "node:net";
import { Readable } from "node:stream";
import {
  createBrotliDecompress,
  createGunzip,
  createInflate,
} from "node:zlib";

import { AppError } from "../../core/result.js";
import { VERSION } from "../../core/version.js";
import {
  resolvePublicAuditUrl,
  resolveSiteHost,
} from "./networkPolicy.js";
import type {
  ResolvedAddress,
  SiteHostResolver,
  SiteHttpClient,
  SiteHttpRequestOptions,
  SiteHttpResponse,
  SiteRedirectHop,
} from "./types.js";

const USER_AGENT = `AItraffic/${VERSION} (+https://aitraffic.dev)`;
const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);

export interface SiteRawResponse {
  status: number;
  headers: IncomingHttpHeaders;
  stream: Readable;
}

export type SiteRequestOnce = (
  url: URL,
  addresses: ResolvedAddress[],
  options: {
    timeoutMs: number;
    accept: string;
  },
) => Promise<SiteRawResponse>;

function headerValues(
  headers: IncomingHttpHeaders,
  name: string,
): string[] {
  const value = headers[name];
  if (Array.isArray(value)) {
    return value;
  }
  return value === undefined ? [] : [value];
}

function oneHeader(
  headers: IncomingHttpHeaders,
  name: string,
): string | null {
  return headerValues(headers, name)[0] ?? null;
}

const requestOnce: SiteRequestOnce = async (
  url,
  addresses,
  options,
) =>
  new Promise((resolve, reject) => {
    const lookup: LookupFunction = (_hostname, lookupOptions, callback) => {
      if (lookupOptions.all) {
        callback(null, addresses);
        return;
      }
      const address = addresses[0];
      if (!address) {
        callback(new Error("No validated address is available."), []);
        return;
      }
      callback(null, address.address, address.family);
    };
    const transport = url.protocol === "https:" ? https : http;
    const request = transport.request(
      url,
      {
        method: "GET",
        lookup,
        headers: {
          accept: options.accept,
          "accept-encoding": "gzip, deflate, br",
          "user-agent": USER_AGENT,
        },
      },
      (response: IncomingMessage) => {
        const status = response.statusCode;
        if (status === undefined) {
          response.destroy();
          reject(
            new AppError(
              "FETCH_FAILED",
              "Site response did not include an HTTP status.",
              1,
            ),
          );
          return;
        }
        resolve({
          status,
          headers: response.headers,
          stream: response,
        });
      },
    );
    const deadline = setTimeout(() => {
      request.destroy(
        new AppError(
          "FETCH_TIMEOUT",
          `Site request exceeded ${options.timeoutMs}ms.`,
          1,
        ),
      );
    }, options.timeoutMs);
    deadline.unref();
    request.once("close", () => clearTimeout(deadline));
    request.setTimeout(options.timeoutMs, () => {
      request.destroy(
        new AppError(
          "FETCH_TIMEOUT",
          `Site request exceeded ${options.timeoutMs}ms.`,
          1,
        ),
      );
    });
    request.on("error", (error) => {
      if (error instanceof AppError) {
        reject(error);
        return;
      }
      reject(
        new AppError(
          "FETCH_FAILED",
          "Site request could not be completed.",
          1,
        ),
      );
    });
    request.end();
  });

function decodeStream(
  stream: Readable,
  encoding: string | null,
): Readable | null {
  const normalized = encoding?.trim().toLowerCase() ?? "";
  if (!normalized || normalized === "identity") {
    return stream;
  }
  if (normalized === "gzip" || normalized === "x-gzip") {
    return stream.pipe(createGunzip());
  }
  if (normalized === "deflate") {
    return stream.pipe(createInflate());
  }
  if (normalized === "br") {
    return stream.pipe(createBrotliDecompress());
  }
  return null;
}

async function readBoundedBody(
  stream: Readable,
  encoding: string | null,
  maxBytes: number,
): Promise<{
  body: string | null;
  byteLength: number;
  bodyRead: SiteHttpResponse["bodyRead"];
  sha256: string | null;
}> {
  const decoded = decodeStream(stream, encoding);
  if (!decoded) {
    stream.destroy();
    return {
      body: null,
      byteLength: 0,
      bodyRead: "unsupported_encoding",
      sha256: null,
    };
  }

  const chunks: Buffer[] = [];
  let byteLength = 0;
  let truncated = false;
  try {
    for await (const chunk of decoded) {
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      const remaining = maxBytes - byteLength;
      if (remaining <= 0) {
        truncated = true;
        break;
      }
      if (buffer.length > remaining) {
        chunks.push(buffer.subarray(0, remaining));
        byteLength += remaining;
        truncated = true;
        break;
      }
      chunks.push(buffer);
      byteLength += buffer.length;
    }
  } finally {
    if (truncated) {
      decoded.destroy();
      if (decoded !== stream) {
        stream.destroy();
      }
    }
  }
  const combined = Buffer.concat(chunks);
  return {
    body: combined.toString("utf8"),
    byteLength,
    bodyRead: truncated ? "truncated" : "complete",
    sha256: createHash("sha256").update(combined).digest("hex"),
  };
}

function relatedRedirectHost(left: string, right: string): boolean {
  const normalize = (hostname: string) =>
    hostname.toLowerCase().replace(/^www\./u, "");
  return normalize(left) === normalize(right);
}

export function createSiteHttpClient(
  runtime: {
    resolveHost?: SiteHostResolver;
    requestOnce?: SiteRequestOnce;
  } = {},
): SiteHttpClient {
  const resolver = runtime.resolveHost ?? resolveSiteHost;
  const performRequest = runtime.requestOnce ?? requestOnce;

  return {
    async get(
      input: string,
      options: SiteHttpRequestOptions,
    ): Promise<SiteHttpResponse> {
      const startedAt = Date.now();
      const initial = await resolvePublicAuditUrl(input, resolver);
      const requestedUrl = initial.url.toString();
      let current = initial;
      const redirects: SiteRedirectHop[] = [];
      const visited = new Set<string>();

      for (;;) {
        const currentUrl = current.url.toString();
        if (visited.has(currentUrl)) {
          throw new AppError(
            "REDIRECT_LOOP",
            "Site request entered a redirect loop.",
            1,
          );
        }
        visited.add(currentUrl);

        const response = await performRequest(
          current.url,
          current.addresses,
          {
            timeoutMs: options.timeoutMs,
            accept: options.accept,
          },
        );
        const location = oneHeader(response.headers, "location");
        if (
          REDIRECT_STATUSES.has(response.status) &&
          location !== null
        ) {
          response.stream.destroy();
          if (redirects.length >= options.maxRedirects) {
            throw new AppError(
              "REDIRECT_LIMIT_EXCEEDED",
              `Site request exceeded ${options.maxRedirects} redirects.`,
              1,
            );
          }
          const destination = new URL(location, current.url);
          if (
            current.url.protocol === "https:" &&
            destination.protocol === "http:"
          ) {
            throw new AppError(
              "HTTPS_DOWNGRADE_BLOCKED",
              "HTTPS-to-HTTP redirects are not followed.",
              1,
            );
          }
          if (
            !relatedRedirectHost(
              current.url.hostname,
              destination.hostname,
            )
          ) {
            throw new AppError(
              "CROSS_HOST_REDIRECT_BLOCKED",
              "Cross-host redirects are not followed by the page auditor.",
              1,
            );
          }
          redirects.push({
            url: currentUrl,
            status: response.status,
            location: destination.toString(),
          });
          current = await resolvePublicAuditUrl(destination, resolver);
          continue;
        }

        const contentEncoding = oneHeader(
          response.headers,
          "content-encoding",
        );
        let body;
        try {
          body = await readBoundedBody(
            response.stream,
            contentEncoding,
            options.maxBytes,
          );
        } catch {
          throw new AppError(
            "FETCH_FAILED",
            "Site response body could not be read.",
            1,
          );
        }
        const rawContentLength = oneHeader(
          response.headers,
          "content-length",
        );
        const parsedContentLength =
          rawContentLength === null ? NaN : Number(rawContentLength);
        return {
          requestedUrl,
          finalUrl: currentUrl,
          status: response.status,
          redirects,
          headers: {
            contentType: oneHeader(response.headers, "content-type"),
            contentLength: Number.isFinite(parsedContentLength)
              ? parsedContentLength
              : null,
            contentEncoding,
            xRobotsTag: headerValues(
              response.headers,
              "x-robots-tag",
            ),
          },
          ...body,
          durationMs: Date.now() - startedAt,
        };
      }
    },
  };
}
