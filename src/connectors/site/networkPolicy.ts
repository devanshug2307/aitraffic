import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

import { AppError } from "../../core/result.js";
import type {
  ResolvedAddress,
  SiteHostResolver,
} from "./types.js";

const BLOCKED_HOST_SUFFIXES = [
  ".localhost",
  ".local",
  ".internal",
  ".home",
  ".lan",
] as const;

function blockedIpv4(address: string): boolean {
  const octets = address.split(".").map(Number);
  if (
    octets.length !== 4 ||
    octets.some(
      (octet) => !Number.isInteger(octet) || octet < 0 || octet > 255,
    )
  ) {
    return true;
  }
  const [first = 0, second = 0] = octets;
  return (
    first === 0 ||
    first === 10 ||
    first === 127 ||
    (first === 100 && second >= 64 && second <= 127) ||
    (first === 169 && second === 254) ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 &&
      [0, 2, 88, 168].includes(second)) ||
    (first === 198 && [18, 19, 51].includes(second)) ||
    (first === 203 && second === 0) ||
    first >= 224
  );
}

function blockedIpv6(address: string): boolean {
  const normalized = address.toLowerCase().split("%", 1)[0] ?? "";
  if (
    normalized === "::" ||
    normalized === "::1" ||
    normalized.startsWith("fc") ||
    normalized.startsWith("fd") ||
    /^fe[89ab]/u.test(normalized) ||
    normalized.startsWith("ff") ||
    normalized.startsWith("2001:db8") ||
    normalized.startsWith("64:ff9b:")
  ) {
    return true;
  }
  const mapped = normalized.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/u);
  if (mapped?.[1] !== undefined) {
    return blockedIpv4(mapped[1]);
  }
  const mappedHex = normalized.match(
    /^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/u,
  );
  if (mappedHex?.[1] !== undefined && mappedHex[2] !== undefined) {
    const high = Number.parseInt(mappedHex[1], 16);
    const low = Number.parseInt(mappedHex[2], 16);
    return blockedIpv4(
      `${high >> 8}.${high & 255}.${low >> 8}.${low & 255}`,
    );
  }
  return false;
}

export function isPublicAddress(address: string): boolean {
  const family = isIP(address);
  if (family === 4) {
    return !blockedIpv4(address);
  }
  if (family === 6) {
    return !blockedIpv6(address);
  }
  return false;
}

export const resolveSiteHost: SiteHostResolver = async (hostname) => {
  let addresses;
  try {
    addresses = await lookup(hostname, {
      all: true,
      verbatim: true,
    });
  } catch {
    throw new AppError(
      "DNS_RESOLUTION_FAILED",
      `Could not resolve site hostname: ${hostname}`,
      1,
    );
  }
  return addresses.map(({ address, family }) => ({
    address,
    family: family === 6 ? 6 : 4,
  }));
};

export function normalizeAuditUrl(input: string): URL {
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    throw new AppError("INVALID_URL", "Audit URL is invalid.");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new AppError(
      "UNSUPPORTED_URL_SCHEME",
      "Audit URL must use http or https.",
    );
  }
  if (url.username || url.password) {
    throw new AppError(
      "URL_CREDENTIALS_NOT_ALLOWED",
      "Audit URLs cannot contain embedded credentials.",
    );
  }
  if (
    url.port &&
    !(
      (url.protocol === "http:" && url.port === "80") ||
      (url.protocol === "https:" && url.port === "443")
    )
  ) {
    throw new AppError(
      "UNSUPPORTED_URL_PORT",
      "Audit URLs may use only the default HTTP or HTTPS port.",
    );
  }
  url.hash = "";
  return url;
}

export async function resolvePublicAuditUrl(
  input: string | URL,
  resolver: SiteHostResolver = resolveSiteHost,
): Promise<{ url: URL; addresses: ResolvedAddress[] }> {
  const url = normalizeAuditUrl(String(input));
  const hostname = url.hostname
    .toLowerCase()
    .replace(/^\[|\]$/gu, "");
  if (
    hostname === "localhost" ||
    BLOCKED_HOST_SUFFIXES.some((suffix) => hostname.endsWith(suffix))
  ) {
    throw new AppError(
      "PRIVATE_NETWORK_BLOCKED",
      "Audit URL resolves to a blocked local hostname.",
    );
  }

  const literalFamily = isIP(hostname);
  const addresses =
    literalFamily === 0
      ? await resolver(hostname)
      : [
          {
            address: hostname,
            family: literalFamily === 6 ? (6 as const) : (4 as const),
          },
        ];
  if (
    addresses.length === 0 ||
    addresses.some(({ address }) => !isPublicAddress(address))
  ) {
    throw new AppError(
      "PRIVATE_NETWORK_BLOCKED",
      "Audit URL resolves to a private, local, reserved, or otherwise blocked address.",
    );
  }
  return { url, addresses };
}
