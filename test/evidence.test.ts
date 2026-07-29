import assert from "node:assert/strict";
import test from "node:test";

import {
  EVIDENCE_CLASSES,
  evidenceJsonSchema,
} from "../src/core/evidence.js";

test("publishes a versioned evidence schema with provenance fields", () => {
  assert.equal(evidenceJsonSchema.properties.schema_version.const, "0.1.0");
  assert.ok(evidenceJsonSchema.required.includes("source"));
  assert.ok(evidenceJsonSchema.required.includes("quality"));
  assert.deepEqual(
    evidenceJsonSchema.properties.evidence_class.enum,
    EVIDENCE_CLASSES,
  );
});
