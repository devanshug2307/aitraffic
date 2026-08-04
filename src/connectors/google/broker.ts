import {
  createDecipheriv,
  createHash,
  createPublicKey,
  diffieHellman,
  generateKeyPairSync,
  type KeyObject,
} from "node:crypto";

import { AppError } from "../../core/result.js";

const HANDOFF_VERSION = 1;
const HANDOFF_AAD_PREFIX = "aitraffic-google-handoff-v1:";

export interface BrokerToken {
  accessToken: string;
  refreshToken?: string;
  expiresIn: number;
  scopes: string[];
  tokenType?: string;
}

export interface BrokerHandoffKeys {
  privateKey: KeyObject;
  publicKey: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isBase64Url(value: string, minimum: number, maximum: number): boolean {
  return new RegExp(`^[A-Za-z0-9_-]{${minimum},${maximum}}$`, "u").test(value);
}

function handoffKey(sharedSecret: Buffer): Buffer {
  return createHash("sha256")
    .update(HANDOFF_AAD_PREFIX)
    .update(sharedSecret)
    .digest();
}

function parseToken(value: unknown): BrokerToken {
  if (
    !isRecord(value) ||
    typeof value.accessToken !== "string" ||
    value.accessToken === "" ||
    typeof value.expiresIn !== "number" ||
    !Number.isFinite(value.expiresIn) ||
    value.expiresIn <= 0 ||
    !Array.isArray(value.scopes) ||
    !value.scopes.every((scope) => typeof scope === "string")
  ) {
    throw new AppError(
      "GOOGLE_BROKER_HANDOFF_INVALID",
      "The AItraffic authorization response was invalid.",
      1,
    );
  }
  const token: BrokerToken = {
    accessToken: value.accessToken,
    expiresIn: value.expiresIn,
    scopes: value.scopes,
  };
  if (typeof value.refreshToken === "string") token.refreshToken = value.refreshToken;
  if (typeof value.tokenType === "string") token.tokenType = value.tokenType;
  return token;
}

export function createBrokerHandoffKeys(): BrokerHandoffKeys {
  const pair = generateKeyPairSync("x25519");
  return {
    privateKey: pair.privateKey,
    publicKey: pair.publicKey
      .export({ type: "spki", format: "der" })
      .toString("base64url"),
  };
}

export function decryptBrokerHandoff(options: {
  handoff: string;
  keys: BrokerHandoffKeys;
  localState: string;
}): BrokerToken {
  if (!isBase64Url(options.localState, 32, 128)) {
    throw new AppError(
      "GOOGLE_BROKER_HANDOFF_INVALID",
      "The AItraffic authorization response was invalid.",
      1,
    );
  }
  let payload: unknown;
  try {
    payload = JSON.parse(Buffer.from(options.handoff, "base64url").toString("utf8"));
  } catch {
    throw new AppError(
      "GOOGLE_BROKER_HANDOFF_INVALID",
      "The AItraffic authorization response was invalid.",
      1,
    );
  }
  if (
    !isRecord(payload) ||
    payload.v !== HANDOFF_VERSION ||
    typeof payload.epk !== "string" ||
    typeof payload.iv !== "string" ||
    typeof payload.tag !== "string" ||
    typeof payload.ct !== "string" ||
    !isBase64Url(payload.epk, 40, 512) ||
    !isBase64Url(payload.iv, 16, 32) ||
    !isBase64Url(payload.tag, 16, 32) ||
    !isBase64Url(payload.ct, 1, 16_384)
  ) {
    throw new AppError(
      "GOOGLE_BROKER_HANDOFF_INVALID",
      "The AItraffic authorization response was invalid.",
      1,
    );
  }
  try {
    const gatewayPublicKey = createPublicKey({
      key: Buffer.from(payload.epk, "base64url"),
      format: "der",
      type: "spki",
    });
    if (gatewayPublicKey.asymmetricKeyType !== "x25519") throw new Error();
    const key = handoffKey(
      diffieHellman({
        privateKey: options.keys.privateKey,
        publicKey: gatewayPublicKey,
      }),
    );
    const decipher = createDecipheriv(
      "aes-256-gcm",
      key,
      Buffer.from(payload.iv, "base64url"),
    );
    decipher.setAAD(Buffer.from(`${HANDOFF_AAD_PREFIX}${options.localState}`));
    decipher.setAuthTag(Buffer.from(payload.tag, "base64url"));
    const plaintext = Buffer.concat([
      decipher.update(Buffer.from(payload.ct, "base64url")),
      decipher.final(),
    ]);
    return parseToken(JSON.parse(plaintext.toString("utf8")));
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(
      "GOOGLE_BROKER_HANDOFF_INVALID",
      "The AItraffic authorization response was invalid.",
      1,
    );
  }
}

export async function refreshBrokerToken(options: {
  brokerUrl: string;
  refreshToken: string;
  fetch: typeof fetch;
}): Promise<BrokerToken> {
  let response: Response;
  try {
    response = await options.fetch(`${options.brokerUrl}/google/refresh`, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({ refreshToken: options.refreshToken }),
    });
  } catch {
    throw new AppError(
      "GOOGLE_BROKER_UNAVAILABLE",
      "AItraffic could not refresh the local Google connection. Try again shortly.",
      1,
    );
  }
  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }
  if (!response.ok) {
    throw new AppError(
      "GOOGLE_BROKER_REFRESH_FAILED",
      "AItraffic could not refresh the local Google connection. Run auth google login again.",
      1,
      { status: response.status },
    );
  }
  return parseToken(payload);
}

export function brokerStartUrl(options: {
  brokerUrl: string;
  callback: string;
  state: string;
  publicKey: string;
}): string {
  const url = new URL(`${options.brokerUrl}/google/start`);
  url.searchParams.set("callback", options.callback);
  url.searchParams.set("state", options.state);
  url.searchParams.set("public_key", options.publicKey);
  return url.toString();
}
