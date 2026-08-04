import {
  createCipheriv,
  createHash,
  createHmac,
  createPublicKey,
  diffieHellman,
  generateKeyPairSync,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";

export const HANDOFF_VERSION = 1;
export const HANDOFF_AAD_PREFIX = "aitraffic-google-handoff-v1:";

const LOOPBACK_HOSTS = new Set(["127.0.0.1", "localhost", "[::1]"]);

function base64UrlJson(value) {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

function parseBase64UrlJson(value) {
  try {
    return JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
  } catch {
    return null;
  }
}

export function validateLoopbackCallback(value) {
  let callback;
  try {
    callback = new URL(value);
  } catch {
    throw new Error("callback must be a valid loopback HTTP URL");
  }
  if (
    callback.protocol !== "http:" ||
    !LOOPBACK_HOSTS.has(callback.hostname) ||
    callback.port === "" ||
    callback.username !== "" ||
    callback.password !== "" ||
    callback.search !== "" ||
    callback.hash !== "" ||
    callback.pathname !== "/"
  ) {
    throw new Error("callback must be a loopback origin with an explicit port");
  }
  return callback.origin;
}

export function validateLocalState(value) {
  if (!/^[A-Za-z0-9_-]{32,128}$/u.test(value)) {
    throw new Error("state is invalid");
  }
  return value;
}

export function validateClientPublicKey(value) {
  if (!/^[A-Za-z0-9_-]{40,512}$/u.test(value)) {
    throw new Error("public_key is invalid");
  }
  try {
    const key = createPublicKey({
      key: Buffer.from(value, "base64url"),
      format: "der",
      type: "spki",
    });
    if (key.asymmetricKeyType !== "x25519") {
      throw new Error("public_key is invalid");
    }
  } catch {
    throw new Error("public_key is invalid");
  }
  return value;
}

export function signState(claims, secret) {
  const payload = base64UrlJson(claims);
  const signature = createHmac("sha256", secret).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

export function verifyState(value, secret, now = Date.now()) {
  const [payload, signature, extra] = value.split(".");
  if (!payload || !signature || extra !== undefined) return null;
  const expected = createHmac("sha256", secret).update(payload).digest();
  let supplied;
  try {
    supplied = Buffer.from(signature, "base64url");
  } catch {
    return null;
  }
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) {
    return null;
  }
  const claims = parseBase64UrlJson(payload);
  if (
    !claims ||
    claims.v !== HANDOFF_VERSION ||
    typeof claims.exp !== "number" ||
    claims.exp < now ||
    claims.exp > now + 15 * 60_000 ||
    typeof claims.callback !== "string" ||
    typeof claims.localState !== "string" ||
    typeof claims.publicKey !== "string"
  ) {
    return null;
  }
  try {
    return {
      callback: validateLoopbackCallback(claims.callback),
      localState: validateLocalState(claims.localState),
      publicKey: validateClientPublicKey(claims.publicKey),
    };
  } catch {
    return null;
  }
}

function handoffKey(sharedSecret) {
  return createHash("sha256")
    .update(HANDOFF_AAD_PREFIX)
    .update(sharedSecret)
    .digest();
}

export function encryptHandoff(token, clientPublicKey, localState) {
  const recipient = createPublicKey({
    key: Buffer.from(validateClientPublicKey(clientPublicKey), "base64url"),
    format: "der",
    type: "spki",
  });
  const pair = generateKeyPairSync("x25519");
  const key = handoffKey(
    diffieHellman({ privateKey: pair.privateKey, publicKey: recipient }),
  );
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(Buffer.from(`${HANDOFF_AAD_PREFIX}${localState}`));
  const encrypted = Buffer.concat([
    cipher.update(Buffer.from(JSON.stringify(token))),
    cipher.final(),
  ]);
  return base64UrlJson({
    v: HANDOFF_VERSION,
    epk: pair.publicKey.export({ type: "spki", format: "der" }).toString("base64url"),
    iv: iv.toString("base64url"),
    tag: cipher.getAuthTag().toString("base64url"),
    ct: encrypted.toString("base64url"),
  });
}
