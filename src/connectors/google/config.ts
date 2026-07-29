import {
  access,
  chmod,
  mkdir,
  readFile,
  rename,
  writeFile,
} from "node:fs/promises";
import path from "node:path";

import { PROJECT_DIRECTORY } from "../../core/project.js";
import { AppError } from "../../core/result.js";
import type {
  ExternalGoogleConnectorConfig,
  GoogleConnectorConfig,
  LocalGoogleConnectorConfig,
} from "./types.js";

export const GOOGLE_CONFIG_FILE = "google.json";

export function googleConfigPath(cwd = process.cwd()): string {
  return path.join(cwd, PROJECT_DIRECTORY, GOOGLE_CONFIG_FILE);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function validateGoogleProfile(profile: string): string {
  if (!/^[a-z0-9][a-z0-9_-]{0,63}$/i.test(profile)) {
    throw new AppError(
      "INVALID_GOOGLE_PROFILE",
      "Google profile must use 1-64 letters, digits, underscores, or hyphens.",
    );
  }
  return profile.toLowerCase();
}

export function normalizeGa4Property(
  property: string | undefined,
): string | undefined {
  if (property === undefined) {
    return undefined;
  }
  const normalized = property.replace(/^properties\//, "");
  if (!/^\d+$/.test(normalized)) {
    throw new AppError(
      "INVALID_GA4_PROPERTY",
      "GA4 property must be a numeric property ID.",
    );
  }
  return normalized;
}

async function writeGoogleConnectorConfig(
  cwd: string,
  config: GoogleConnectorConfig,
  dryRun: boolean,
): Promise<{
  configPath: string;
  config: GoogleConnectorConfig;
  written: boolean;
}> {
  const configPath = googleConfigPath(cwd);
  if (dryRun) {
    return { configPath, config, written: false };
  }

  await mkdir(path.dirname(configPath), { recursive: true, mode: 0o700 });
  const temporary = `${configPath}.${process.pid}.tmp`;
  await writeFile(temporary, `${JSON.stringify(config, null, 2)}\n`, {
    encoding: "utf8",
    mode: 0o600,
  });
  await chmod(temporary, 0o600);
  await rename(temporary, configPath);
  await chmod(configPath, 0o600);
  return { configPath, config, written: true };
}

export async function configureGoogleConnector(options: {
  cwd?: string;
  scriptPath: string;
  profile: string;
  ga4Property?: string;
  gscSite?: string;
  dryRun?: boolean;
}): Promise<{
  configPath: string;
  config: GoogleConnectorConfig;
  written: boolean;
}> {
  const cwd = options.cwd ?? process.cwd();
  const scriptPath = path.resolve(options.scriptPath);
  try {
    await access(scriptPath);
  } catch {
    throw new AppError(
      "GOOGLE_ADAPTER_UNREADABLE",
      `Google adapter script is not readable: ${scriptPath}`,
    );
  }

  const config: ExternalGoogleConnectorConfig = {
    schemaVersion: "0.1.0",
    adapter: "external-command",
    scriptPath,
    profile: validateGoogleProfile(options.profile),
  };
  const ga4Property = normalizeGa4Property(options.ga4Property);
  if (ga4Property !== undefined) {
    config.ga4Property = ga4Property;
  }
  if (options.gscSite !== undefined) {
    config.gscSite = options.gscSite;
  }

  return writeGoogleConnectorConfig(cwd, config, options.dryRun === true);
}

export async function selectLocalGoogleConnector(options: {
  cwd?: string;
  profile: string;
  ga4Property?: string;
  gscSite?: string;
  dryRun?: boolean;
}): Promise<{
  configPath: string;
  config: LocalGoogleConnectorConfig;
  written: boolean;
}> {
  const config: LocalGoogleConnectorConfig = {
    schemaVersion: "0.1.0",
    adapter: "local-oauth",
    profile: validateGoogleProfile(options.profile),
  };
  const ga4Property = normalizeGa4Property(options.ga4Property);
  if (ga4Property !== undefined) {
    config.ga4Property = ga4Property;
  }
  if (options.gscSite !== undefined) {
    config.gscSite = options.gscSite;
  }
  const result = await writeGoogleConnectorConfig(
    options.cwd ?? process.cwd(),
    config,
    options.dryRun === true,
  );
  return {
    configPath: result.configPath,
    config,
    written: result.written,
  };
}

export async function readGoogleConnectorConfig(
  cwd = process.cwd(),
): Promise<GoogleConnectorConfig | null> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(await readFile(googleConfigPath(cwd), "utf8"));
  } catch (error) {
    const code =
      typeof error === "object" && error !== null && "code" in error
        ? String(error.code)
        : "";
    if (code === "ENOENT") {
      return null;
    }
    throw new AppError(
      "GOOGLE_CONFIG_UNREADABLE",
      "Google connector configuration is unreadable.",
    );
  }

  if (
    !isRecord(parsed) ||
    parsed.schemaVersion !== "0.1.0" ||
    !["external-command", "local-oauth"].includes(String(parsed.adapter)) ||
    typeof parsed.profile !== "string"
  ) {
    throw new AppError(
      "GOOGLE_CONFIG_INVALID",
      "Google connector configuration is invalid.",
    );
  }

  let config: GoogleConnectorConfig;
  if (parsed.adapter === "external-command") {
    if (
      typeof parsed.scriptPath !== "string" ||
      !path.isAbsolute(parsed.scriptPath)
    ) {
      throw new AppError(
        "GOOGLE_CONFIG_INVALID",
        "Google connector configuration is invalid.",
      );
    }
    config = {
      schemaVersion: "0.1.0",
      adapter: "external-command",
      scriptPath: parsed.scriptPath,
      profile: validateGoogleProfile(parsed.profile),
    };
  } else {
    config = {
      schemaVersion: "0.1.0",
      adapter: "local-oauth",
      profile: validateGoogleProfile(parsed.profile),
    };
  }
  if (typeof parsed.ga4Property === "string") {
    const ga4Property = normalizeGa4Property(parsed.ga4Property);
    if (ga4Property !== undefined) {
      config.ga4Property = ga4Property;
    }
  }
  if (typeof parsed.gscSite === "string") {
    config.gscSite = parsed.gscSite;
  }
  return config;
}
