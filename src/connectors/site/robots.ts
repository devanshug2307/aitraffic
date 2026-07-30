import type {
  ParsedRobots,
  RobotsDecision,
  RobotsGroup,
  RobotsRule,
} from "./types.js";

function cleanLine(raw: string): string {
  const comment = raw.indexOf("#");
  return (comment === -1 ? raw : raw.slice(0, comment)).trim();
}

export function parseRobotsTxt(text: string): ParsedRobots {
  const groups: RobotsGroup[] = [];
  const sitemaps: string[] = [];
  let agents: string[] = [];
  let rules: RobotsRule[] = [];

  const flush = () => {
    if (agents.length > 0) {
      groups.push({ userAgents: agents, rules });
    }
    agents = [];
    rules = [];
  };

  for (const [index, raw] of text.split(/\r?\n/u).entries()) {
    const line = cleanLine(raw);
    if (!line) {
      continue;
    }
    const separator = line.indexOf(":");
    if (separator < 1) {
      continue;
    }
    const field = line.slice(0, separator).trim().toLowerCase();
    const value = line.slice(separator + 1).trim();
    if (field === "user-agent") {
      if (rules.length > 0) {
        flush();
      }
      if (value) {
        agents.push(value.toLowerCase());
      }
      continue;
    }
    if (field === "sitemap") {
      if (value && !sitemaps.includes(value)) {
        sitemaps.push(value);
      }
      continue;
    }
    if (
      (field === "allow" || field === "disallow") &&
      agents.length > 0
    ) {
      if (field === "disallow" && value === "") {
        continue;
      }
      rules.push({
        directive: field,
        path: value,
        line: index + 1,
      });
    }
  }
  flush();
  return { groups, sitemaps };
}

function selectedGroups(
  parsed: ParsedRobots,
  agent: string,
): RobotsGroup[] {
  const normalized = agent.toLowerCase();
  const specific = parsed.groups.filter(({ userAgents }) =>
    userAgents.some(
      (candidate) =>
        candidate !== "*" &&
        (normalized === candidate || normalized.startsWith(candidate)),
    ),
  );
  if (specific.length > 0) {
    return specific;
  }
  return parsed.groups.filter(({ userAgents }) =>
    userAgents.includes("*"),
  );
}

function ruleRegex(pattern: string): RegExp | null {
  try {
    const anchored = pattern.endsWith("$");
    const withoutAnchor = anchored ? pattern.slice(0, -1) : pattern;
    const escaped = withoutAnchor
      .replace(/[.+?^${}()|[\]\\]/gu, "\\$&")
      .replaceAll("*", ".*");
    return new RegExp(`^${escaped}${anchored ? "$" : ""}`, "u");
  } catch {
    return null;
  }
}

export function evaluateRobots(
  parsed: ParsedRobots,
  url: URL,
  agent = "Googlebot",
): RobotsDecision {
  const groups = selectedGroups(parsed, agent);
  if (groups.length === 0) {
    return { agent, decision: "allowed", matchedRule: null };
  }
  const target = `${url.pathname}${url.search}`;
  const matches = groups
    .flatMap(({ rules }) => rules)
    .flatMap((rule) => {
      const pattern = ruleRegex(rule.path);
      return pattern?.test(target)
        ? [{ rule, specificity: rule.path.replaceAll("*", "").length }]
        : [];
    })
    .sort((left, right) => {
      if (right.specificity !== left.specificity) {
        return right.specificity - left.specificity;
      }
      if (left.rule.directive !== right.rule.directive) {
        return left.rule.directive === "allow" ? -1 : 1;
      }
      return left.rule.line - right.rule.line;
    });
  const matchedRule = matches[0]?.rule ?? null;
  return {
    agent,
    decision:
      matchedRule?.directive === "disallow" ? "disallowed" : "allowed",
    matchedRule,
  };
}
