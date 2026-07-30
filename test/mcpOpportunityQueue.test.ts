import assert from "node:assert/strict";
import { access, mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import {
  InMemoryTransport,
  type JSONRPCMessage,
  type McpServer,
} from "@modelcontextprotocol/server";

import {
  type OpportunityQueueStore,
  type QueuedOpportunity,
} from "../src/core/opportunityQueue.js";
import {
  opportunityQueuePath,
  writeOpportunityQueue,
} from "../src/core/opportunityStore.js";
import { SCHEMA_VERSION } from "../src/core/version.js";
import { createMcpServer } from "../src/mcp/server.js";

interface ToolDefinition {
  name: string;
  annotations?: {
    readOnlyHint?: boolean;
    destructiveHint?: boolean;
    idempotentHint?: boolean;
    openWorldHint?: boolean;
  };
}

class McpTestSession {
  private nextId = 0;
  private readonly pending = new Map<
    number,
    (message: JSONRPCMessage) => void
  >();

  private constructor(
    private readonly server: McpServer,
    private readonly clientTransport: InMemoryTransport,
  ) {}

  static async connect(server: McpServer): Promise<McpTestSession> {
    const [clientTransport, serverTransport] =
      InMemoryTransport.createLinkedPair();
    const session = new McpTestSession(server, clientTransport);
    clientTransport.onmessage = (message) => {
      if ("id" in message && typeof message.id === "number") {
        session.pending.get(message.id)?.(message);
        session.pending.delete(message.id);
      }
    };
    await clientTransport.start();
    await server.connect(serverTransport);
    await session.request("initialize", {
      protocolVersion: "2025-11-25",
      capabilities: {},
      clientInfo: { name: "aitraffic-test", version: "1.0.0" },
    });
    await clientTransport.send({
      jsonrpc: "2.0",
      method: "notifications/initialized",
    });
    return session;
  }

  async request(
    method: string,
    params: Record<string, unknown> = {},
  ): Promise<JSONRPCMessage> {
    const id = ++this.nextId;
    const response = new Promise<JSONRPCMessage>((resolve) => {
      this.pending.set(id, resolve);
    });
    await this.clientTransport.send({
      jsonrpc: "2.0",
      id,
      method,
      params,
    });
    return response;
  }

  async close(): Promise<void> {
    await this.clientTransport.close();
    await this.server.close();
  }
}

function resultRecord(
  message: JSONRPCMessage,
): Record<string, unknown> {
  assert.ok("result" in message, JSON.stringify(message));
  assert.equal(typeof message.result, "object");
  assert.notEqual(message.result, null);
  return message.result as Record<string, unknown>;
}

function toolText(message: JSONRPCMessage): Record<string, unknown> {
  const result = resultRecord(message);
  assert.ok(Array.isArray(result.content));
  const first = result.content[0] as
    | { type?: unknown; text?: unknown }
    | undefined;
  assert.equal(first?.type, "text");
  const text = first?.text;
  if (typeof text !== "string") {
    throw new Error("Expected the MCP tool to return text content.");
  }
  return JSON.parse(text) as Record<string, unknown>;
}

function fixtureOpportunity(id: string): QueuedOpportunity {
  return {
    id,
    stableKey: "technical:TITLE_NOT_OBSERVED_STATIC_HTML_V1\u0000https://example.com/",
    comparisonKey:
      "TITLE_NOT_OBSERVED_STATIC_HTML_V1\u0000https://example.com/",
    site: "https://example.com/",
    source: "technical",
    kind: "TITLE_NOT_OBSERVED_STATIC_HTML_V1",
    ruleId: "TITLE_NOT_OBSERVED_STATIC_HTML_V1",
    generator: {
      id: "technical-finding-queue",
      version: "1.0.0",
      sourceRule: "TITLE_NOT_OBSERVED_STATIC_HTML_V1",
    },
    title: "No non-empty title observed in static HTML",
    summary:
      "A static fetch did not contain a non-empty HTML title element.",
    priority: "high",
    scope: {
      urls: ["https://example.com/"],
      query: null,
    },
    impact: {
      basis: "A descriptive title can help users understand a result.",
    },
    confidence: {
      label: "high",
      basis: "Deterministic extraction from the observed static response.",
    },
    effort: {
      label: "unknown",
      basis: "The repository or CMS implementation was not inspected.",
    },
    suggestedAction: {
      action: "Review and add a truthful page-specific title if appropriate.",
      approvalRequired: true,
      verificationCommand:
        "aitraffic audit page \"https://example.com/\" --format json",
    },
    limitations: [
      "JavaScript may add a title after the initial HTML response.",
    ],
    status: "open",
    statusReason: null,
    observationState: "present",
    evidence: {
      firstSeenAt: "2026-07-30T10:00:00.000Z",
      lastSeenAt: "2026-07-30T10:00:00.000Z",
      latestRunId:
        "run_01234567-89ab-cdef-0123-456789abcdef",
      latestFindingId: "finding_title_fixture",
      evidenceRefs: ["ev_title_fixture"],
      occurrences: 1,
      latestCoverageComplete: false,
    },
    verification: null,
    history: [
      {
        at: "2026-07-30T10:01:00.000Z",
        event: "created",
        auditRunId:
          "run_01234567-89ab-cdef-0123-456789abcdef",
        fromStatus: null,
        toStatus: "open",
        reason: "First observed in a synced full audit.",
      },
    ],
  };
}

function fixtureStore(opportunity: QueuedOpportunity): OpportunityQueueStore {
  return {
    storeVersion: SCHEMA_VERSION,
    createdAt: "2026-07-30T10:01:00.000Z",
    updatedAt: "2026-07-30T10:01:00.000Z",
    siteSyncs: {
      example: {
        site: opportunity.site,
        latestRunId: opportunity.evidence.latestRunId,
        completedAt: opportunity.evidence.lastSeenAt,
        syncedAt: "2026-07-30T10:01:00.000Z",
      },
    },
    opportunities: [opportunity],
  };
}

test("advertises project-local opportunity tools as strictly read-only", async () => {
  const projectRoot = await mkdtemp(
    path.join(tmpdir(), "aitraffic-mcp-empty-"),
  );
  const session = await McpTestSession.connect(
    createMcpServer(projectRoot),
  );
  try {
    const listed = resultRecord(await session.request("tools/list"));
    assert.ok(Array.isArray(listed.tools));
    const tools = listed.tools as ToolDefinition[];
    for (const name of [
      "list_opportunity_queue",
      "explain_opportunity",
    ]) {
      const tool = tools.find((item) => item.name === name);
      assert.ok(tool, name);
      assert.deepEqual(tool.annotations, {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      });
    }

    const empty = toolText(
      await session.request("tools/call", {
        name: "list_opportunity_queue",
        arguments: {},
      }),
    );
    assert.deepEqual(empty.summary, {
      stored: 0,
      matching: 0,
      returned: 0,
      byStatus: {
        open: 0,
        planned: 0,
        dismissed: 0,
        verified: 0,
      },
      byObservationState: {
        present: 0,
        not_observed: 0,
        unknown: 0,
      },
    });
    assert.match(String(empty.nextCommand), /audit <URL> --save/u);
    await assert.rejects(access(path.join(projectRoot, ".aitraffic")));
  } finally {
    await session.close();
  }
});

test("lists and explains only the bound project queue without changing it", async () => {
  const projectRoot = await mkdtemp(
    path.join(tmpdir(), "aitraffic-mcp-queue-"),
  );
  const opportunity = fixtureOpportunity(
    "opp_0123456789abcdef01234567",
  );
  await writeOpportunityQueue(
    fixtureStore(opportunity),
    projectRoot,
  );
  const target = opportunityQueuePath(projectRoot);
  const before = await readFile(target, "utf8");
  const session = await McpTestSession.connect(
    createMcpServer(projectRoot),
  );
  try {
    const listed = toolText(
      await session.request("tools/call", {
        name: "list_opportunity_queue",
        arguments: {
          status: "active",
          observation: "present",
          path: "../another-project/.aitraffic/opportunities/queue.json",
        },
      }),
    );
    assert.equal(
      (listed.summary as { returned?: unknown }).returned,
      1,
    );
    const opportunities = listed.opportunities as Array<{
      id?: unknown;
      title?: unknown;
    }>;
    assert.equal(opportunities[0]?.id, opportunity.id);
    assert.equal(opportunities[0]?.title, opportunity.title);

    const explained = toolText(
      await session.request("tools/call", {
        name: "explain_opportunity",
        arguments: { id: opportunity.id },
      }),
    );
    const returned = explained.opportunity as {
      id?: unknown;
      evidence?: { evidenceRefs?: unknown };
      suggestedAction?: { approvalRequired?: unknown };
      limitations?: unknown;
    };
    assert.equal(returned.id, opportunity.id);
    assert.deepEqual(
      returned.evidence?.evidenceRefs,
      opportunity.evidence.evidenceRefs,
    );
    assert.equal(
      returned.suggestedAction?.approvalRequired,
      true,
    );
    assert.deepEqual(returned.limitations, opportunity.limitations);
    assert.equal(await readFile(target, "utf8"), before);
  } finally {
    await session.close();
  }
});
