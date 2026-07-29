import { createReadStream } from "node:fs";
import { createInterface } from "node:readline";

import {
  classifyUserAgent,
  type AgentClassification,
} from "./agentRegistry.js";

export interface LogObservation {
  lineNumber: number;
  timestamp?: string;
  method: string;
  path: string;
  status: number;
  bytes?: number;
  referrer?: string;
  userAgent: string;
  agent: AgentClassification;
}

export interface LogParseError {
  lineNumber: number;
  reason: string;
}

export type LogParseResult =
  | { ok: true; observation: LogObservation }
  | { ok: false; error: LogParseError };

export interface LogAnalysis {
  file: string;
  totalLines: number;
  parsedLines: number;
  skippedLines: number;
  claimedAgentRequests: number;
  byAgent: Record<string, number>;
  byBehavior: Record<string, number>;
  byStatus: Record<string, number>;
  topPaths: Array<{ path: string; requests: number }>;
  parseErrors: LogParseError[];
  limitations: string[];
}

const COMBINED_LOG_PATTERN =
  /^(\S+)\s+\S+\s+\S+\s+\[([^\]]+)\]\s+"(\S+)\s+(.+?)\s+HTTP\/[^"]+"\s+(\d{3})\s+(\S+)\s+"([^"]*)"\s+"([^"]*)"(?:\s+.*)?$/;

const MONTHS: Record<string, number> = {
  Jan: 0,
  Feb: 1,
  Mar: 2,
  Apr: 3,
  May: 4,
  Jun: 5,
  Jul: 6,
  Aug: 7,
  Sep: 8,
  Oct: 9,
  Nov: 10,
  Dec: 11,
};

function parseApacheTimestamp(value: string): string | undefined {
  const match =
    /^(\d{2})\/([A-Za-z]{3})\/(\d{4}):(\d{2}):(\d{2}):(\d{2}) ([+-])(\d{2})(\d{2})$/.exec(
      value,
    );

  if (!match) {
    return undefined;
  }

  const month = MONTHS[match[2] ?? ""];
  if (month === undefined) {
    return undefined;
  }

  const day = Number(match[1]);
  const year = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = Number(match[6]);
  const offsetDirection = match[7] === "+" ? 1 : -1;
  const offsetMinutes =
    (Number(match[8]) * 60 + Number(match[9])) * offsetDirection;
  const utc = Date.UTC(year, month, day, hour, minute, second);

  return new Date(utc - offsetMinutes * 60_000).toISOString();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getNested(
  record: Record<string, unknown>,
  paths: readonly string[],
): unknown {
  for (const candidatePath of paths) {
    let current: unknown = record;
    let found = true;

    for (const segment of candidatePath.split(".")) {
      if (!isRecord(current) || !(segment in current)) {
        found = false;
        break;
      }
      current = current[segment];
    }

    if (found) {
      return current;
    }
  }

  return undefined;
}

function asString(value: unknown): string | undefined {
  if (typeof value === "string" && value.length > 0) {
    return value;
  }
  return undefined;
}

function asNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.length > 0) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return undefined;
}

function normalizeTimestamp(value: unknown): string | undefined {
  const timestamp = asString(value);
  if (!timestamp) {
    return undefined;
  }

  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) {
    return timestamp;
  }
  return date.toISOString();
}

function parseJsonLog(
  record: Record<string, unknown>,
  lineNumber: number,
): LogParseResult {
  const method =
    asString(getNested(record, ["method", "httpMethod", "request.method"])) ??
    "GET";
  const requestPath = asString(
    getNested(record, [
      "path",
      "uri",
      "url",
      "request.path",
      "request.uri",
      "request.url",
    ]),
  );
  const status = asNumber(
    getNested(record, ["status", "statusCode", "response.status"]),
  );
  const userAgent =
    asString(
      getNested(record, [
        "userAgent",
        "user_agent",
        "ua",
        "http_user_agent",
        "request.userAgent",
        "request.headers.user-agent",
      ]),
    ) ?? "";

  if (!requestPath || status === undefined) {
    return {
      ok: false,
      error: {
        lineNumber,
        reason: "JSON log line must include a request path and numeric status.",
      },
    };
  }

  const observation: LogObservation = {
    lineNumber,
    method,
    path: requestPath,
    status,
    userAgent,
    agent: classifyUserAgent(userAgent),
  };
  const timestamp = normalizeTimestamp(
    getNested(record, ["timestamp", "time", "date", "@timestamp"]),
  );
  const bytes = asNumber(
    getNested(record, ["bytes", "bodyBytesSent", "response.bytes"]),
  );
  const referrer = asString(
    getNested(record, ["referrer", "referer", "http_referer"]),
  );

  if (timestamp !== undefined) {
    observation.timestamp = timestamp;
  }
  if (bytes !== undefined) {
    observation.bytes = bytes;
  }
  if (referrer !== undefined && referrer !== "-") {
    observation.referrer = referrer;
  }

  return { ok: true, observation };
}

function parseCombinedLog(line: string, lineNumber: number): LogParseResult {
  const match = COMBINED_LOG_PATTERN.exec(line);
  if (!match) {
    return {
      ok: false,
      error: {
        lineNumber,
        reason: "Line is neither supported JSON nor Apache/Nginx combined format.",
      },
    };
  }

  const method = match[3] ?? "GET";
  const requestPath = match[4] ?? "/";
  const status = Number(match[5]);
  const rawBytes = match[6];
  const referrer = match[7];
  const userAgent = match[8] ?? "";
  const observation: LogObservation = {
    lineNumber,
    method,
    path: requestPath,
    status,
    userAgent,
    agent: classifyUserAgent(userAgent),
  };
  const timestamp = parseApacheTimestamp(match[2] ?? "");

  if (timestamp !== undefined) {
    observation.timestamp = timestamp;
  }
  if (rawBytes !== undefined && rawBytes !== "-") {
    const bytes = Number(rawBytes);
    if (Number.isFinite(bytes)) {
      observation.bytes = bytes;
    }
  }
  if (referrer !== undefined && referrer !== "-") {
    observation.referrer = referrer;
  }

  return { ok: true, observation };
}

export function parseLogLine(line: string, lineNumber = 1): LogParseResult {
  const trimmed = line.trim();
  if (trimmed.length === 0) {
    return {
      ok: false,
      error: { lineNumber, reason: "Line is empty." },
    };
  }

  if (trimmed.startsWith("{")) {
    try {
      const value: unknown = JSON.parse(trimmed);
      if (!isRecord(value)) {
        return {
          ok: false,
          error: { lineNumber, reason: "JSON log line must be an object." },
        };
      }
      return parseJsonLog(value, lineNumber);
    } catch {
      return {
        ok: false,
        error: { lineNumber, reason: "Invalid JSON log line." },
      };
    }
  }

  return parseCombinedLog(trimmed, lineNumber);
}

function increment(record: Record<string, number>, key: string): void {
  record[key] = (record[key] ?? 0) + 1;
}

export async function analyzeLogFile(file: string): Promise<LogAnalysis> {
  const byAgent: Record<string, number> = {};
  const byBehavior: Record<string, number> = {};
  const byStatus: Record<string, number> = {};
  const pathCounts: Record<string, number> = {};
  const parseErrors: LogParseError[] = [];
  let totalLines = 0;
  let parsedLines = 0;
  let claimedAgentRequests = 0;

  const input = createReadStream(file, { encoding: "utf8" });
  const lines = createInterface({ input, crlfDelay: Infinity });

  for await (const line of lines) {
    totalLines += 1;
    const result = parseLogLine(line, totalLines);
    if (!result.ok) {
      if (parseErrors.length < 10) {
        parseErrors.push(result.error);
      }
      continue;
    }

    parsedLines += 1;
    const { observation } = result;
    increment(byStatus, String(observation.status));
    increment(pathCounts, observation.path);

    if (observation.agent.matched) {
      claimedAgentRequests += 1;
      increment(byAgent, observation.agent.displayName ?? "unknown");
      increment(byBehavior, observation.agent.behavior);
    }
  }

  const topPaths = Object.entries(pathCounts)
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .slice(0, 20)
    .map(([requestPath, requests]) => ({ path: requestPath, requests }));

  return {
    file,
    totalLines,
    parsedLines,
    skippedLines: totalLines - parsedLines,
    claimedAgentRequests,
    byAgent,
    byBehavior,
    byStatus,
    topPaths,
    parseErrors,
    limitations: [
      "Agent counts are based on claimed user-agent strings, not verified network identity.",
      "IP addresses are intentionally not retained in this local summary.",
    ],
  };
}
