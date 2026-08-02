import path from "node:path";

import {
  cancel,
  confirm,
  intro,
  isCancel,
  log,
  multiselect,
  note,
  outro,
  select,
  spinner,
  text,
} from "@clack/prompts";

import { runDoctor, type DoctorReport } from "../commands/doctor.js";
import {
  readGoogleConnectorConfig,
  selectLocalGoogleConnector,
  validateGoogleProfile,
} from "../connectors/google/config.js";
import {
  configureGoogleOAuthClient,
  configureTrafficClawDesktopOAuthClient,
  getGoogleOAuthStatus,
  loginGoogleOAuthProfile,
} from "../connectors/google/oauth.js";
import { createGoogleDataProvider } from "../connectors/google/provider.js";
import type {
  Ga4Property,
  GoogleConnectorConfig,
  GoogleInventory,
  SearchConsoleSite,
} from "../connectors/google/types.js";
import { createSystemGoogleVault } from "../connectors/google/vault.js";
import {
  getAgentSetupCommands,
  initializeProject,
  projectConfigPath,
  readProjectConfig,
  type AgentIntegration,
} from "../core/project.js";
import { AppError } from "../core/result.js";
import {
  buildAgentInstallCommand,
  detectAgentTargets,
  installAgentTarget,
  type AgentDetection,
  type AgentInstallResult,
  type AgentTarget,
} from "./agents.js";
import {
  inspectAgentRegistrations,
  repairAgentRegistration,
} from "./registrations.js";

const SKIP = "__skip__";
const CONNECT = "__connect__";
const TRAFFICCLAW = "__trafficclaw__";

interface SafeGoogleStatus {
  available: boolean;
  clientConfigured: boolean;
  vaultBackend: { id: string; name: string } | null;
  profiles: Array<{
    profile: string;
    connected: boolean;
    expiresAt: string | null;
  }>;
  error?: {
    code: string;
    message: string;
  };
}

export interface OnboardingInspection {
  cwd: string;
  interactive: boolean;
  project: {
    configured: boolean;
    configPath: string;
    siteUrl: string | null;
  };
  agents: AgentDetection[];
  google: SafeGoogleStatus & {
    selection: {
      adapter: GoogleConnectorConfig["adapter"];
      profile: string;
      ga4Property: string | null;
      gscSite: string | null;
    } | null;
  };
  setupCommands: {
    codex: string;
    claudeCode: string;
    hermes: string;
    openclaw: string;
    generic: {
      command: string;
      args: string[];
    };
  };
}

export interface OnboardingResult {
  dryRun: boolean;
  projectInitialized: boolean;
  selectedAgents: AgentTarget[];
  agentResults: AgentInstallResult[];
  google: {
    profile: string;
    ga4Property: string | null;
    gscSite: string | null;
    written: boolean;
  } | null;
  doctor: DoctorReport | null;
  nextPrompt: string;
}

function appError(error: unknown): { code: string; message: string } {
  if (error instanceof AppError) {
    return { code: error.code, message: error.message };
  }
  return {
    code: "UNEXPECTED_ERROR",
    message: error instanceof Error ? error.message : String(error),
  };
}

function unwrapPrompt<T>(value: T | symbol): T {
  if (isCancel(value)) {
    cancel("Onboarding cancelled. No pending project or agent changes applied.");
    throw new AppError(
      "ONBOARDING_CANCELLED",
      "AItraffic onboarding was cancelled.",
    );
  }
  return value;
}

function agentIntegrationFor(targets: AgentTarget[]): AgentIntegration {
  const unique = new Set(targets);
  if (unique.size === 1 && unique.has("codex")) {
    return "codex";
  }
  if (unique.size === 1 && unique.has("claude-code")) {
    return "claude-code";
  }
  if (
    unique.size === 2 &&
    unique.has("codex") &&
    unique.has("claude-code")
  ) {
    return "both";
  }
  return "custom";
}

function ga4Label(property: Ga4Property): string {
  const id = property.property.replace(/^properties\//u, "");
  const name = property.displayName ?? "Unnamed property";
  const account = property.accountDisplayName
    ? ` · ${property.accountDisplayName}`
    : "";
  return `${name} — ${id}${account}`;
}

function gscLabel(site: SearchConsoleSite): string {
  return site.permissionLevel
    ? `${site.siteUrl} · ${site.permissionLevel}`
    : site.siteUrl;
}

async function inspectGoogle(): Promise<SafeGoogleStatus> {
  try {
    const vault = await createSystemGoogleVault();
    const status = await getGoogleOAuthStatus(vault);
    return {
      available: true,
      clientConfigured: status.clientConfigured,
      vaultBackend: status.vaultBackend,
      profiles: status.profiles.map((profile) => ({
        profile: profile.profile,
        connected: profile.connected,
        expiresAt: profile.expiresAt,
      })),
    };
  } catch (error) {
    return {
      available: false,
      clientConfigured: false,
      vaultBackend: null,
      profiles: [],
      error: appError(error),
    };
  }
}

export async function inspectOnboarding(
  cwd = process.cwd(),
): Promise<OnboardingInspection> {
  const [project, detectedAgents, registrations, googleStatus, googleSelection] = await Promise.all([
    readProjectConfig(cwd),
    detectAgentTargets(),
    inspectAgentRegistrations({ cwd }),
    inspectGoogle(),
    readGoogleConnectorConfig(cwd),
  ]);
  const registrationByAgent = new Map(
    registrations.map((registration) => [registration.id, registration]),
  );
  const agents = detectedAgents.map((agent) => {
    const registration =
      agent.id === "codex" || agent.id === "claude-code"
        ? registrationByAgent.get(agent.id)
        : undefined;
    return registration === undefined
      ? agent
      : {
          ...agent,
          configured: registration.configured,
          registration,
        };
  });
  const commands = getAgentSetupCommands(cwd);
  return {
    cwd,
    interactive: Boolean(process.stdin.isTTY && process.stdout.isTTY),
    project: {
      configured: project !== null,
      configPath: projectConfigPath(cwd),
      siteUrl: project?.siteUrl ?? null,
    },
    agents,
    google: {
      ...googleStatus,
      selection:
        googleSelection === null
          ? null
          : {
              adapter: googleSelection.adapter,
              profile: googleSelection.profile,
              ga4Property: googleSelection.ga4Property ?? null,
              gscSite: googleSelection.gscSite ?? null,
            },
    },
    setupCommands: {
      ...commands,
      generic: {
        command: "npx",
        args: ["-y", "aitraffic@latest", "mcp", "serve"],
      },
    },
  };
}

async function chooseGa4Property(
  inventory: GoogleInventory,
  current?: string,
): Promise<string | undefined> {
  if (inventory.ga4Properties.length === 0) {
    log.warn(
      current
        ? `No GA4 inventory was returned; keeping the current property ${current}.`
        : "No GA4 properties are available to this Google account.",
    );
    return current;
  }
  if (inventory.ga4Properties.length === 1) {
    const property = inventory.ga4Properties[0];
    if (!property) {
      return undefined;
    }
    const accepted = unwrapPrompt(
      await confirm({
        message: `Use GA4 ${ga4Label(property)}?`,
        initialValue: true,
      }),
    );
    return accepted
      ? property.property.replace(/^properties\//u, "")
      : undefined;
  }
  const options = inventory.ga4Properties.map((property) => ({
    value: property.property.replace(/^properties\//u, ""),
    label: ga4Label(property),
  }));
  options.push({ value: SKIP, label: "Skip GA4 for now" });
  const selected = unwrapPrompt(
    await select({
      message: "Choose a GA4 property",
      options,
      initialValue:
        current && options.some((option) => option.value === current)
          ? current
          : options[0]?.value,
      maxItems: 12,
    }),
  );
  return selected === SKIP ? undefined : selected;
}

async function chooseGscSite(
  inventory: GoogleInventory,
  current?: string,
): Promise<string | undefined> {
  if (inventory.searchConsoleSites.length === 0) {
    log.warn(
      current
        ? `No Search Console inventory was returned; keeping the current site ${current}.`
        : "No Search Console sites are available to this Google account.",
    );
    return current;
  }
  if (inventory.searchConsoleSites.length === 1) {
    const site = inventory.searchConsoleSites[0];
    if (!site) {
      return undefined;
    }
    const accepted = unwrapPrompt(
      await confirm({
        message: `Use Search Console ${gscLabel(site)}?`,
        initialValue: true,
      }),
    );
    return accepted ? site.siteUrl : undefined;
  }
  const options = inventory.searchConsoleSites.map((site) => ({
    value: site.siteUrl,
    label: gscLabel(site),
  }));
  options.push({ value: SKIP, label: "Skip Search Console for now" });
  const selected = unwrapPrompt(
    await select({
      message: "Choose a Search Console site",
      options,
      initialValue:
        current && options.some((option) => option.value === current)
          ? current
          : options[0]?.value,
      maxItems: 12,
    }),
  );
  return selected === SKIP ? undefined : selected;
}

async function connectGoogleProfile(options: {
  clientConfigured: boolean;
  useTrafficClaw?: boolean;
  dryRun: boolean;
}): Promise<{
  profile: string;
  plannedOnly: boolean;
}> {
  let clientJsonPath: string | undefined;
  if (
    !options.useTrafficClaw &&
    !options.clientConfigured
  ) {
    const entered = unwrapPrompt(
      await text({
        message: "Path to the downloaded Google Web OAuth client JSON",
        placeholder: "/absolute/path/to/client_secret.json",
        validate: (value) =>
          (value ?? "").trim() === ""
            ? "A client JSON path is required."
            : undefined,
      }),
    );
    clientJsonPath = path.resolve(entered.trim());
  }

  const profile = unwrapPrompt(
    await text({
      message: "Local profile name",
      placeholder: "work",
      defaultValue: "work",
      validate: (value) => {
        try {
          validateGoogleProfile(value ?? "");
          return undefined;
        } catch (error) {
          return error instanceof Error ? error.message : String(error);
        }
      },
    }),
  );
  const normalizedProfile = validateGoogleProfile(profile);

  note(
    [
      clientJsonPath
        ? `Import OAuth client: ${clientJsonPath}`
        : options.useTrafficClaw
          ? "Use AItraffic's built-in Google Desktop client with PKCE"
        : "Use the OAuth client already stored on this computer",
      `Open browser consent for profile: ${normalizedProfile}`,
      "Google consent identifies TrafficClaw as AItraffic's OAuth provider",
      "Request only read-only Analytics and Search Console scopes",
      "Store the client and tokens only in the OS credential store",
    ].join("\n"),
    options.dryRun ? "Google dry-run plan" : "Google authorization",
  );

  if (options.dryRun) {
    log.info("Dry run: Google credential storage and browser login were skipped.");
    return { profile: normalizedProfile, plannedOnly: true };
  }

  const approved = unwrapPrompt(
    await confirm({
      message: "Continue to Google sign-in?",
      initialValue: true,
    }),
  );
  if (!approved) {
    return { profile: normalizedProfile, plannedOnly: true };
  }

  const vault = await createSystemGoogleVault();
  if (options.useTrafficClaw) {
    const progress = spinner();
    progress.start("Configuring TrafficClaw local OAuth");
    try {
      await configureTrafficClawDesktopOAuthClient({ vault });
      progress.stop("TrafficClaw local OAuth is ready");
    } catch (error) {
      progress.stop("TrafficClaw local OAuth configuration failed");
      throw error;
    }
  }
  if (clientJsonPath) {
    const progress = spinner();
    progress.start("Importing the OAuth client into secure storage");
    try {
      await configureGoogleOAuthClient({
        clientJsonFile: clientJsonPath,
        vault,
      });
      progress.stop("OAuth client stored securely");
    } catch (error) {
      progress.stop("OAuth client import failed");
      throw error;
    }
  }
  log.info("Complete Google sign-in and consent in the browser window.");
  await loginGoogleOAuthProfile(normalizedProfile, vault, {
    onInstruction: (message) => log.info(message),
  });
  log.success(`Google profile "${normalizedProfile}" is connected.`);
  return { profile: normalizedProfile, plannedOnly: false };
}

function reviewLines(options: {
  inspection: OnboardingInspection;
  agents: AgentTarget[];
  google: {
    profile: string;
    ga4Property?: string;
    gscSite?: string;
    plannedOnly: boolean;
  } | null;
  siteUrl?: string;
  dryRun: boolean;
}): string[] {
  const lines: string[] = [];
  lines.push(
    options.inspection.project.configured
      ? `Keep project: ${options.inspection.project.configPath}`
      : `Create project: ${options.inspection.project.configPath}`,
  );
  if (!options.inspection.project.configured && options.siteUrl) {
    lines.push(`Set site: ${options.siteUrl}`);
  }
  if (options.agents.length === 0) {
    lines.push("Skip agent registration");
  }
  for (const id of options.agents) {
    const agent = options.inspection.agents.find(
      (candidate) => candidate.id === id,
    );
    if (
      agent?.registration?.state === "healthy" ||
      agent?.registration?.state === "pending_approval"
    ) {
      lines.push(`Keep existing ${agent.label} registration`);
    } else if (agent?.registration?.repair.needed) {
      lines.push(
        ...agent.registration.repair.operations.map(
          ({ display }) => display,
        ),
      );
      if (!agent.registration.repair.automatic) {
        lines.push(
          `${agent.label} requires manual registration review; it will not be overwritten automatically`,
        );
      }
    } else if (agent?.configured) {
      lines.push(`Keep existing ${agent.label} registration`);
    } else {
      lines.push(buildAgentInstallCommand(id, options.inspection.cwd).display);
    }
  }
  if (!options.google) {
    lines.push("Keep current Google selection unchanged");
  } else if (options.google.plannedOnly) {
    lines.push(
      `Google profile "${options.google.profile}" still needs browser authorization`,
    );
  } else {
    lines.push(`Select Google profile: ${options.google.profile}`);
    lines.push(
      options.google.ga4Property
        ? `Select GA4 property: ${options.google.ga4Property}`
        : "Leave GA4 unselected",
    );
    lines.push(
      options.google.gscSite
        ? `Select Search Console site: ${options.google.gscSite}`
        : "Leave Search Console unselected",
    );
  }
  if (options.dryRun) {
    lines.push("Dry run: do not write project or agent configuration");
  }
  return lines;
}

export async function runOnboardingWizard(options: {
  cwd?: string;
  dryRun?: boolean;
} = {}): Promise<OnboardingResult> {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    throw new AppError(
      "ONBOARDING_TTY_REQUIRED",
      "Interactive onboarding requires a terminal. Run aitraffic onboard --check --format json for a non-interactive inspection.",
    );
  }
  const cwd = options.cwd ?? process.cwd();
  const dryRun = options.dryRun === true;
  intro(dryRun ? "AItraffic onboarding · dry run" : "AItraffic onboarding");
  note(
    [
      `Project: ${cwd}`,
      "Google consent stays in your browser.",
      "Credentials stay in the OS credential store and are never exposed to agents.",
    ].join("\n"),
    "Local-first setup",
  );

  const inspectionSpinner = spinner();
  inspectionSpinner.start("Inspecting project, agents, and Google connection");
  let inspection: OnboardingInspection;
  try {
    inspection = await inspectOnboarding(cwd);
    inspectionSpinner.stop("Environment inspected");
  } catch (error) {
    inspectionSpinner.stop("Environment inspection failed");
    throw error;
  }

  const installedAgents = inspection.agents.filter((agent) => agent.installed);
  if (installedAgents.length === 0) {
    log.warn(
      "No supported agent CLI was detected. You can still configure Google and use the generic MCP command.",
    );
  }
  const initiallySelected = installedAgents
    .filter((agent) => agent.configured)
    .map((agent) => agent.id);
  if (initiallySelected.length === 0 && installedAgents.length === 1) {
    const onlyAgent = installedAgents[0];
    if (onlyAgent) {
      initiallySelected.push(onlyAgent.id);
    }
  }
  const selectedAgents = unwrapPrompt(
    await multiselect<AgentTarget>({
      message: "Where should AItraffic be available?",
      options: inspection.agents.map((agent) => ({
        value: agent.id,
        label: agent.label,
        hint: !agent.installed
          ? "not installed"
          : agent.registration?.state === "healthy"
            ? "current"
            : agent.registration?.state === "pending_approval"
              ? "pending approval"
              : agent.registration?.repair.needed
                ? agent.registration.repair.automatic
                  ? "repair available"
                  : "manual review required"
                : agent.configured
                  ? "already configured"
            : "detected",
        disabled: !agent.installed,
      })),
      initialValues: initiallySelected,
      required: false,
    }),
  );

  let siteUrl: string | undefined;
  if (!inspection.project.configured) {
    const enteredSite = unwrapPrompt(
      await text({
        message: "Site URL (optional)",
        placeholder: "https://example.com",
        validate: (value) => {
          if ((value ?? "").trim() === "") {
            return undefined;
          }
          try {
            new URL(value ?? "");
            return undefined;
          } catch {
            return "Enter a complete URL such as https://example.com, or leave it blank.";
          }
        },
      }),
    ).trim();
    if (enteredSite !== "") {
      siteUrl = enteredSite;
    }
  }

  let googlePlan: {
    profile: string;
    ga4Property?: string;
    gscSite?: string;
    plannedOnly: boolean;
  } | null = null;
  if (!inspection.google.available) {
    log.warn(
      `Secure Google storage is unavailable: ${inspection.google.error?.message ?? "unknown error"}`,
    );
  } else {
    const connectedProfiles = inspection.google.profiles.filter(
      (profile) => profile.connected,
    );
    const googleChoices: Array<{
      value: string;
      label: string;
      hint?: string;
    }> = connectedProfiles.map((profile) => ({
      value: `profile:${profile.profile}`,
      label: `Use local profile "${profile.profile}"`,
      hint:
        inspection.google.selection?.profile === profile.profile
          ? "selected for this project"
          : "already authorized",
    }));
    if (inspection.google.clientConfigured) {
      googleChoices.push({
        value: CONNECT,
        label: "Connect another Google account",
        hint: "uses the OAuth client stored on this computer",
      });
    }
    if (!inspection.google.clientConfigured) {
      googleChoices.push({
        value: TRAFFICCLAW,
        label: "Connect Google",
        hint: "recommended; opens your browser and keeps credentials on this computer",
      });
    }
    googleChoices.push({
      value: SKIP,
      label: "Skip Google for now",
      hint: "agent setup still works",
    });
    const googleChoice = unwrapPrompt(
      await select({
        message: "Google Analytics and Search Console",
        options: googleChoices,
        initialValue: connectedProfiles[0]
          ? `profile:${connectedProfiles[0].profile}`
          : inspection.google.clientConfigured
            ? SKIP
            : TRAFFICCLAW,
        maxItems: 10,
      }),
    );

    if (googleChoice.startsWith("profile:")) {
      googlePlan = {
        profile: validateGoogleProfile(googleChoice.slice("profile:".length)),
        plannedOnly: false,
      };
    } else if (
      googleChoice === CONNECT ||
      googleChoice === TRAFFICCLAW
    ) {
      googlePlan = {
        ...(await connectGoogleProfile({
          clientConfigured:
            inspection.google.clientConfigured || googleChoice === TRAFFICCLAW,
          useTrafficClaw: googleChoice === TRAFFICCLAW,
          dryRun,
        })),
      };
    }

    if (googlePlan && !googlePlan.plannedOnly) {
      const inventorySpinner = spinner();
      inventorySpinner.start("Loading GA4 properties and Search Console sites");
      let inventory: GoogleInventory;
      try {
        const provider = await createGoogleDataProvider({
          schemaVersion: "0.1.0",
          adapter: "local-oauth",
          profile: googlePlan.profile,
        });
        inventory = await provider.inventory();
        inventorySpinner.stop(
          `Found ${inventory.ga4Properties.length} GA4 properties and ${inventory.searchConsoleSites.length} Search Console sites`,
        );
      } catch (error) {
        inventorySpinner.stop("Google inventory could not be loaded");
        log.warn(appError(error).message);
        inventory = {
          profile: googlePlan.profile,
          ga4Properties: [],
          searchConsoleSites: [],
        };
      }
      const current =
        inspection.google.selection?.profile === googlePlan.profile
          ? inspection.google.selection
          : null;
      const ga4Property = await chooseGa4Property(
        inventory,
        current?.ga4Property ?? undefined,
      );
      if (ga4Property !== undefined) {
        googlePlan.ga4Property = ga4Property;
      }
      const gscSite = await chooseGscSite(
        inventory,
        current?.gscSite ?? undefined,
      );
      if (gscSite !== undefined) {
        googlePlan.gscSite = gscSite;
      }
    }
  }

  note(
    reviewLines({
      inspection,
      agents: selectedAgents,
      google: googlePlan,
      ...(siteUrl !== undefined ? { siteUrl } : {}),
      dryRun,
    }).join("\n"),
    "Review",
  );

  if (dryRun) {
    const nextPrompt =
      'Use AItraffic to inspect this project and explain the next setup action.';
    outro("Dry run complete. No project or agent configuration was written.");
    return {
      dryRun: true,
      projectInitialized: false,
      selectedAgents,
      agentResults: [],
      google:
        googlePlan === null
          ? null
          : {
              profile: googlePlan.profile,
              ga4Property: googlePlan.ga4Property ?? null,
              gscSite: googlePlan.gscSite ?? null,
              written: false,
            },
      doctor: null,
      nextPrompt,
    };
  }

  const approved = unwrapPrompt(
    await confirm({
      message: "Apply this setup?",
      initialValue: true,
    }),
  );
  if (!approved) {
    cancel("No project or agent configuration was changed.");
    throw new AppError(
      "ONBOARDING_CANCELLED",
      "AItraffic onboarding was cancelled before setup was applied.",
    );
  }

  let projectInitialized = false;
  if (!inspection.project.configured) {
    const progress = spinner();
    progress.start("Initializing the AItraffic project");
    await initializeProject({
      cwd,
      agentIntegration: agentIntegrationFor(selectedAgents),
      agentTargets: selectedAgents,
      ...(siteUrl !== undefined ? { siteUrl } : {}),
    });
    progress.stop("AItraffic project initialized");
    projectInitialized = true;
  }

  const agentResults: AgentInstallResult[] = [];
  for (const id of selectedAgents) {
    const agent = inspection.agents.find((candidate) => candidate.id === id);
    if (!agent) {
      continue;
    }
    const progress = spinner();
    progress.start(
      agent.configured
        ? `Verifying ${agent.label}`
        : `Adding AItraffic to ${agent.label}`,
    );
    try {
      const registration = agent.registration;
      const result =
        registration?.repair.needed
          ? await (async () => {
              const repaired = await repairAgentRegistration({
                id: id as "codex" | "claude-code",
                cwd,
                confirmed: true,
                expectedFingerprint: registration.fingerprint,
              });
              return {
                id,
                label: agent.label,
                status:
                  repaired.status === "already_healthy"
                    ? ("already_configured" as const)
                    : ("installed" as const),
                command: buildAgentInstallCommand(id, cwd).display,
                restartHint: agent.restartHint,
              };
            })()
          : await installAgentTarget({ id, cwd });
      agentResults.push(result);
      progress.stop(
        result.status === "already_configured"
          ? `${agent.label} already has a registration named aitraffic`
          : `AItraffic added to ${agent.label}`,
      );
    } catch (error) {
      progress.stop(`${agent.label} setup failed`);
      throw error;
    }
  }

  let googleResult: OnboardingResult["google"] = null;
  if (googlePlan && !googlePlan.plannedOnly) {
    const progress = spinner();
    progress.start("Saving the project Google selection");
    const selection = await selectLocalGoogleConnector({
      cwd,
      profile: googlePlan.profile,
      ...(googlePlan.ga4Property !== undefined
        ? { ga4Property: googlePlan.ga4Property }
        : {}),
      ...(googlePlan.gscSite !== undefined
        ? { gscSite: googlePlan.gscSite }
        : {}),
    });
    progress.stop("Google selection saved without credentials");
    googleResult = {
      profile: googlePlan.profile,
      ga4Property: googlePlan.ga4Property ?? null,
      gscSite: googlePlan.gscSite ?? null,
      written: selection.written,
    };
  }

  const doctorSpinner = spinner();
  doctorSpinner.start("Checking the completed setup");
  const doctor = await runDoctor(cwd);
  const failures = doctor.checks.filter((check) => check.status === "fail");
  doctorSpinner.stop(
    failures.length === 0
      ? "Setup checks completed"
      : `${failures.length} setup check failed`,
  );
  for (const check of doctor.checks) {
    if (check.status === "pass") {
      log.success(check.message);
    } else if (check.status === "warn") {
      log.warn(check.message);
    } else {
      log.error(check.message);
    }
  }

  const restartHints = [
    ...new Set(agentResults.map((result) => result.restartHint)),
  ];
  if (restartHints.length > 0) {
    note(restartHints.join("\n"), "Load the MCP server");
  }
  if (selectedAgents.length === 0) {
    note(
      "npx -y aitraffic@latest mcp serve",
      "Generic MCP stdio command",
    );
  }
  const nextPrompt =
    googleResult?.ga4Property && googleResult.gscSite
      ? "Use AItraffic to analyze AI acquisition for the last 28 days and separate observed findings from inferences."
      : "Use AItraffic to inspect this project, check available evidence, and recommend the next setup step.";
  note(nextPrompt, "First prompt");
  outro(
    failures.length === 0
      ? "AItraffic is ready."
      : "AItraffic setup finished with checks that need attention.",
  );
  return {
    dryRun: false,
    projectInitialized,
    selectedAgents,
    agentResults,
    google: googleResult,
    doctor,
    nextPrompt,
  };
}
