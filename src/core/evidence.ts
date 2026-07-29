import { SCHEMA_VERSION } from "./version.js";

export const EVIDENCE_CLASSES = [
  "observed",
  "sampled",
  "inferred",
  "action",
  "unknown",
] as const;

export type EvidenceClass = (typeof EVIDENCE_CLASSES)[number];

export const evidenceJsonSchema = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "https://aitraffic.dev/schemas/evidence/v0.1.0.json",
  title: "AItraffic Evidence Envelope",
  description:
    "A provenance-first envelope for observations, samples, inferences, and actions.",
  type: "object",
  additionalProperties: false,
  required: [
    "evidence_id",
    "workspace_id",
    "site_id",
    "evidence_class",
    "evidence_type",
    "source",
    "time",
    "quality",
    "schema_version",
  ],
  properties: {
    evidence_id: {
      type: "string",
      minLength: 1,
      description: "Stable identifier for this evidence item.",
    },
    workspace_id: { type: "string", minLength: 1 },
    site_id: { type: "string", minLength: 1 },
    evidence_class: { enum: EVIDENCE_CLASSES },
    evidence_type: {
      type: "string",
      minLength: 1,
      description: "Namespaced type such as log.request or gsc.query_page.",
    },
    source: {
      type: "object",
      additionalProperties: false,
      required: ["connector", "method"],
      properties: {
        connector: { type: "string", minLength: 1 },
        method: { type: "string", minLength: 1 },
        source_id: { type: "string" },
        source_url: { type: "string", format: "uri" },
      },
    },
    time: {
      type: "object",
      additionalProperties: false,
      required: ["observed_at"],
      properties: {
        observed_at: { type: "string", format: "date-time" },
        period_start: { type: "string", format: "date-time" },
        period_end: { type: "string", format: "date-time" },
      },
    },
    scope: {
      type: "object",
      additionalProperties: true,
      properties: {
        url: { type: "string" },
        query: { type: "string" },
        country: { type: "string" },
        device: { type: "string" },
      },
    },
    payload: {
      description:
        "Evidence-specific values. Consumers should select behavior by evidence_type.",
    },
    quality: {
      type: "object",
      additionalProperties: false,
      required: ["confidence", "verification", "limitations"],
      properties: {
        confidence: { type: "number", minimum: 0, maximum: 1 },
        verification: {
          enum: [
            "signed",
            "official_ip",
            "platform_verified",
            "reverse_dns",
            "user_agent_only",
            "self_reported",
            "unknown",
          ],
        },
        limitations: {
          type: "array",
          items: { type: "string" },
        },
      },
    },
    schema_version: { const: SCHEMA_VERSION },
  },
} as const;
