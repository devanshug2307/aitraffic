import assert from "node:assert/strict";
import {
  createDecipheriv,
  createHash,
  createPrivateKey,
  createPublicKey,
  diffieHellman,
  generateKeyPairSync,
} from "node:crypto";
import test from "node:test";

import {
  HANDOFF_AAD_PREFIX,
  encryptHandoff,
  signState,
  validateLoopbackCallback,
  verifyState,
} from "../src/protocol.mjs";

test("accepts an exact loopback callback origin only", () => {
  assert.equal(validateLoopbackCallback("http://127.0.0.1:49201/"), "http://127.0.0.1:49201");
  assert.throws(() => validateLoopbackCallback("https://example.com/callback"));
  assert.throws(() => validateLoopbackCallback("http://127.0.0.1:3000/path"));
});

test("signs short-lived handoff state", () => {
  const keyPair = generateKeyPairSync("x25519");
  const publicKey = keyPair.publicKey.export({ type: "spki", format: "der" }).toString("base64url");
  const secret = "test-state-secret";
  const now = Date.now();
  const signed = signState({
    v: 1,
    exp: now + 60_000,
    callback: "http://127.0.0.1:49201",
    localState: "a".repeat(43),
    publicKey,
  }, secret);
  assert.deepEqual(verifyState(signed, secret, now), {
    callback: "http://127.0.0.1:49201",
    localState: "a".repeat(43),
    publicKey,
  });
  assert.equal(verifyState(`${signed}x`, secret, now), null);
});

test("encrypts a handoff for the local ephemeral key", () => {
  const keyPair = generateKeyPairSync("x25519");
  const publicKey = keyPair.publicKey.export({ type: "spki", format: "der" }).toString("base64url");
  const state = "b".repeat(43);
  const token = { accessToken: "access", refreshToken: "refresh", expiresIn: 3600, scopes: ["openid"] };
  const payload = JSON.parse(Buffer.from(encryptHandoff(token, publicKey, state), "base64url").toString("utf8"));
  const serverPublicKey = createPublicKey({
    key: Buffer.from(payload.epk, "base64url"),
    format: "der",
    type: "spki",
  });
  const secret = diffieHellman({ privateKey: keyPair.privateKey, publicKey: serverPublicKey });
  const key = createHash("sha256").update(HANDOFF_AAD_PREFIX).update(secret).digest();
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(payload.iv, "base64url"));
  decipher.setAAD(Buffer.from(`${HANDOFF_AAD_PREFIX}${state}`));
  decipher.setAuthTag(Buffer.from(payload.tag, "base64url"));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(payload.ct, "base64url")),
    decipher.final(),
  ]);
  assert.deepEqual(JSON.parse(plaintext.toString("utf8")), token);
  assert.throws(() => createPrivateKey({ key: Buffer.from(payload.epk, "base64url"), format: "der", type: "pkcs8" }));
});
