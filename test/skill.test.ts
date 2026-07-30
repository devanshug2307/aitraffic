import assert from "node:assert/strict";
import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { listCapabilities } from "../src/core/capabilities.js";

const SKILL_ROOT = path.resolve("skills/aitraffic");

async function markdownFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory);
  const files: string[] = [];
  for (const entry of entries) {
    const resolved = path.join(directory, entry);
    const info = await stat(resolved);
    if (info.isDirectory()) {
      files.push(...(await markdownFiles(resolved)));
    } else if (entry.endsWith(".md")) {
      files.push(resolved);
    }
  }
  return files;
}

test("ships a valid, concise canonical skill with matching UI metadata", async () => {
  const skill = await readFile(path.join(SKILL_ROOT, "SKILL.md"), "utf8");
  const metadata = await readFile(
    path.join(SKILL_ROOT, "agents/openai.yaml"),
    "utf8",
  );
  const frontmatter = skill.match(/^---\n([\s\S]*?)\n---/u)?.[1] ?? "";
  const keys = [...frontmatter.matchAll(/^([a-z_]+):/gmu)].map(
    (match) => match[1],
  );

  assert.deepEqual(keys, ["name", "description"]);
  assert.match(frontmatter, /^name: aitraffic$/mu);
  assert.match(frontmatter, /Codex, Claude Code/u);
  assert.match(metadata, /display_name: "AItraffic"/u);
  assert.match(metadata, /\$aitraffic/u);
  assert.ok(skill.split("\n").length < 180);
});

test("keeps every skill recipe and reference reachable and free of placeholders", async () => {
  const files = await markdownFiles(SKILL_ROOT);
  const expectedRecipes = [
    "ai-acquisition.md",
    "change-verification.md",
    "gsc-opportunities.md",
    "indexing-audit.md",
    "internal-links.md",
    "seo-audit.md",
    "setup-check.md",
    "structured-data.md",
    "web-quality.md",
  ];
  assert.deepEqual(
    files
      .filter((file) => file.includes(`${path.sep}recipes${path.sep}`))
      .map((file) => path.basename(file))
      .sort(),
    expectedRecipes,
  );

  for (const file of files) {
    const content = await readFile(file, "utf8");
    assert.doesNotMatch(content, /\bTODO\b|\[TODO:/u, file);
    for (const match of content.matchAll(/\]\(([^)]+\.md)\)/gu)) {
      const target = path.resolve(path.dirname(file), match[1] ?? "");
      assert.equal((await stat(target)).isFile(), true, `${file}: ${target}`);
    }
  }
});

test("references only registered capabilities and MCP tools", async () => {
  const files = await markdownFiles(SKILL_ROOT);
  const combined = (
    await Promise.all(files.map((file) => readFile(file, "utf8")))
  ).join("\n");
  const capabilityIds = listCapabilities().map(({ id }) => id);
  for (const id of [
    "google.opportunities",
    "site.page_audit",
    "site.crawl",
    "site.audit_opportunities",
  ]) {
    assert.ok(capabilityIds.includes(id), id);
    assert.match(combined, new RegExp(`\\b${id.replace(".", "\\.")}\\b`, "u"));
  }

  const serverSource = await readFile("src/mcp/server.ts", "utf8");
  for (const tool of [
    "get_project_status",
    "aitraffic_list_capabilities",
    "aitraffic_describe_capability",
    "aitraffic_run",
    "google_connection_status",
    "list_google_resources",
    "run_gsc_report",
    "run_ga4_report",
    "analyze_ai_acquisition",
    "analyze_log_file",
    "classify_user_agent",
  ]) {
    assert.match(serverSource, new RegExp(`"${tool}"`, "u"), tool);
    assert.match(combined, new RegExp(`\\b${tool}\\b`, "u"), tool);
  }
});

test("documents only implemented CLI command families", async () => {
  const files = await markdownFiles(SKILL_ROOT);
  const combined = (
    await Promise.all(files.map((file) => readFile(file, "utf8")))
  ).join("\n");
  const implemented = [
    "doctor",
    "init",
    "onboard",
    "auth google configure",
    "auth google login",
    "google inventory",
    "google select",
    "capabilities list",
    "capabilities describe",
    "capabilities run",
    "crawl",
    "audit page",
    "audit opportunities",
    "opportunities",
    "report acquisition",
    "crawlers",
  ];
  const commands = [...combined.matchAll(/^\s*aitraffic ([^\n]+)$/gmu)].map(
    (match) => match[1]?.trim() ?? "",
  );

  assert.ok(commands.length >= implemented.length);
  for (const command of commands) {
    assert.ok(
      implemented.some(
        (prefix) => command === prefix || command.startsWith(`${prefix} `),
      ),
      `Unknown skill command: aitraffic ${command}`,
    );
  }
  assert.doesNotMatch(combined, /^\s*aitraffic (?:change|cwv|crawl history)/gmu);
});
