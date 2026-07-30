import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";

import {
  describeCapability,
  listCapabilities,
} from "../src/core/capabilities.js";

test("lists a compact, read-only capability registry", () => {
  const capabilities = listCapabilities();
  assert.deepEqual(
    capabilities.map(({ id }) => id),
    [
      "google.opportunities",
      "site.page_audit",
      "site.audit_opportunities",
    ],
  );
  assert.equal(capabilities.every(({ sideEffects }) => sideEffects === "none"), true);
  assert.deepEqual(capabilities[0]?.outputContract, [
    "coverage",
    "result",
    "findings",
    "recommendations",
    "observations",
    "warnings",
  ]);
});

test("describes known capabilities without inventing unknown ones", () => {
  assert.equal(
    describeCapability("google.opportunities")?.category,
    "search-performance",
  );
  assert.equal(describeCapability("missing.capability"), undefined);
});

test("exposes capability discovery as clean CLI JSON without Google auth", () => {
  const cli = fileURLToPath(new URL("../src/cli.js", import.meta.url));
  const result = spawnSync(
    process.execPath,
    [cli, "capabilities", "list", "--format", "json"],
    { encoding: "utf8", timeout: 10_000 },
  );
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stderr, "");
  const parsed = JSON.parse(result.stdout) as {
    ok: boolean;
    command: string;
    data: Array<{ id: string }>;
  };
  assert.equal(parsed.ok, true);
  assert.equal(parsed.command, "capabilities list");
  assert.equal(parsed.data[0]?.id, "google.opportunities");
});
