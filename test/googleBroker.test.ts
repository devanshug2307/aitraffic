import assert from "node:assert/strict";
import {
  createCipheriv,
  createHash,
  createPublicKey,
  diffieHellman,
  generateKeyPairSync,
  randomBytes,
} from "node:crypto";
import test from "node:test";

import {
  createBrokerHandoffKeys,
  decryptBrokerHandoff,
  refreshBrokerToken,
} from "../src/connectors/google/broker.js";

const HANDOFF_AAD_PREFIX = "aitraffic-google-handoff-v1:";

function encryptForCli(options: {
  publicKey: string;
  localState: string;
  token: Record<string, unknown>;
}): string {
  const recipient = createPublicKey({
    key: Buffer.from(options.publicKey, "base64url"),
    format: "der",
    type: "spki",
  });
  const pair = generateKeyPairSync("x25519");
  const key = createHash("sha256")
    .update(HANDOFF_AAD_PREFIX)
    .update(diffieHellman({ privateKey: pair.privateKey, publicKey: recipient }))
    .digest();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(Buffer.from(`${HANDOFF_AAD_PREFIX}${options.localState}`));
  const ciphertext = Buffer.concat([
    cipher.update(Buffer.from(JSON.stringify(options.token))),
    cipher.final(),
  ]);
  return Buffer.from(
    JSON.stringify({
      v: 1,
      epk: pair.publicKey.export({ type: "spki", format: "der" }).toString("base64url"),
      iv: iv.toString("base64url"),
      tag: cipher.getAuthTag().toString("base64url"),
      ct: ciphertext.toString("base64url"),
    }),
  ).toString("base64url");
}

test("decrypts a gateway handoff only with the matching local key and state", () => {
  const keys = createBrokerHandoffKeys();
  const state = "s".repeat(43);
  const handoff = encryptForCli({
    publicKey: keys.publicKey,
    localState: state,
    token: {
      accessToken: "access-token",
      refreshToken: "refresh-token",
      expiresIn: 3600,
      scopes: ["openid", "https://www.googleapis.com/auth/analytics.readonly"],
      tokenType: "Bearer",
    },
  });

  assert.deepEqual(decryptBrokerHandoff({ handoff, keys, localState: state }), {
    accessToken: "access-token",
    refreshToken: "refresh-token",
    expiresIn: 3600,
    scopes: ["openid", "https://www.googleapis.com/auth/analytics.readonly"],
    tokenType: "Bearer",
  });
  assert.throws(
    () => decryptBrokerHandoff({ handoff, keys, localState: "t".repeat(43) }),
    /authorization response was invalid/,
  );
});

test("refreshes through the broker without sending a Google client secret", async () => {
  let body = "";
  const token = await refreshBrokerToken({
    brokerUrl: "https://auth.trafficclaw.com/aitraffic",
    refreshToken: "local-refresh-token",
    fetch: (async (input, init) => {
      assert.equal(String(input), "https://auth.trafficclaw.com/aitraffic/google/refresh");
      assert.equal(init?.method, "POST");
      body = String(init?.body);
      return new Response(
        JSON.stringify({
          accessToken: "refreshed-access-token",
          expiresIn: 3600,
          scopes: ["openid"],
          tokenType: "Bearer",
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    }) as typeof fetch,
  });
  assert.equal(body, JSON.stringify({ refreshToken: "local-refresh-token" }));
  assert.deepEqual(token, {
    accessToken: "refreshed-access-token",
    expiresIn: 3600,
    scopes: ["openid"],
    tokenType: "Bearer",
  });
});
