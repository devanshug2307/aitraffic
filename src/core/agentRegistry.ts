export const AGENT_BEHAVIORS = [
  "search",
  "agent",
  "training",
  "transact",
  "ads",
  "seo",
  "monitoring",
  "unknown",
] as const;

export type AgentBehavior = (typeof AGENT_BEHAVIORS)[number];

export type VerificationMethod =
  | "signed"
  | "official_ip"
  | "platform_verified"
  | "reverse_dns"
  | "user_agent_only"
  | "unknown";

export interface AgentClassification {
  matched: boolean;
  agentId: string | null;
  displayName: string | null;
  operator: string | null;
  behavior: AgentBehavior;
  verification: VerificationMethod;
  confidence: number;
  limitations: string[];
}

interface AgentPattern {
  id: string;
  displayName: string;
  operator: string;
  behavior: AgentBehavior;
  pattern: RegExp;
}

export const AGENT_PATTERNS: readonly AgentPattern[] = [
  {
    id: "openai-oai-searchbot",
    displayName: "OAI-SearchBot",
    operator: "OpenAI",
    behavior: "search",
    pattern: /\bOAI-SearchBot\b/i,
  },
  {
    id: "openai-oai-adsbot",
    displayName: "OAI-AdsBot",
    operator: "OpenAI",
    behavior: "ads",
    pattern: /\bOAI-AdsBot\b/i,
  },
  {
    id: "openai-chatgpt-user",
    displayName: "ChatGPT-User",
    operator: "OpenAI",
    behavior: "agent",
    pattern: /\bChatGPT-User\b/i,
  },
  {
    id: "openai-gptbot",
    displayName: "GPTBot",
    operator: "OpenAI",
    behavior: "training",
    pattern: /\bGPTBot\b/i,
  },
  {
    id: "anthropic-claude-searchbot",
    displayName: "Claude-SearchBot",
    operator: "Anthropic",
    behavior: "search",
    pattern: /\bClaude-SearchBot\b/i,
  },
  {
    id: "anthropic-claude-user",
    displayName: "Claude-User",
    operator: "Anthropic",
    behavior: "agent",
    pattern: /\bClaude-User\b/i,
  },
  {
    id: "anthropic-claudebot",
    displayName: "ClaudeBot",
    operator: "Anthropic",
    behavior: "training",
    pattern: /\bClaudeBot\b/i,
  },
  {
    id: "perplexity-user",
    displayName: "Perplexity-User",
    operator: "Perplexity",
    behavior: "agent",
    pattern: /\bPerplexity-User\b/i,
  },
  {
    id: "perplexity-bot",
    displayName: "PerplexityBot",
    operator: "Perplexity",
    behavior: "search",
    pattern: /\bPerplexityBot\b/i,
  },
  {
    id: "google-googlebot",
    displayName: "Googlebot",
    operator: "Google",
    behavior: "search",
    pattern: /\bGooglebot(?:-Image|-Video|-News)?\b/i,
  },
  {
    id: "microsoft-bingbot",
    displayName: "bingbot",
    operator: "Microsoft",
    behavior: "search",
    pattern: /\bbingbot\b/i,
  },
] as const;

const USER_AGENT_LIMITATION =
  "A user-agent string is a claim and can be spoofed; verify network identity separately.";

export function classifyUserAgent(userAgent: string): AgentClassification {
  for (const candidate of AGENT_PATTERNS) {
    if (candidate.pattern.test(userAgent)) {
      return {
        matched: true,
        agentId: candidate.id,
        displayName: candidate.displayName,
        operator: candidate.operator,
        behavior: candidate.behavior,
        verification: "user_agent_only",
        confidence: 0.35,
        limitations: [USER_AGENT_LIMITATION],
      };
    }
  }

  return {
    matched: false,
    agentId: null,
    displayName: null,
    operator: null,
    behavior: "unknown",
    verification: "unknown",
    confidence: 0,
    limitations: ["No known agent user-agent pattern matched."],
  };
}
