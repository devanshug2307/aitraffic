import assert from "node:assert/strict";
import test from "node:test";

import { classifyUserAgent } from "../src/core/agentRegistry.js";

test("classifies a known agent while preserving the verification limitation", () => {
  const result = classifyUserAgent(
    "Mozilla/5.0 (compatible; OAI-SearchBot/1.0; +https://openai.com/searchbot)",
  );

  assert.equal(result.matched, true);
  assert.equal(result.displayName, "OAI-SearchBot");
  assert.equal(result.behavior, "search");
  assert.equal(result.verification, "user_agent_only");
  assert.ok(result.limitations[0]?.includes("spoofed"));
});

test("does not label an ordinary browser as an AI agent", () => {
  const result = classifyUserAgent(
    "Mozilla/5.0 AppleWebKit/537.36 Chrome/126.0 Safari/537.36",
  );

  assert.equal(result.matched, false);
  assert.equal(result.agentId, null);
  assert.equal(result.behavior, "unknown");
});
