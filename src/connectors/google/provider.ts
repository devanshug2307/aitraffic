import { ExternalGoogleDataProvider } from "./externalProvider.js";
import { LocalGoogleDataProvider } from "./localProvider.js";
import { readGoogleConnectorConfig } from "./config.js";
import type {
  GoogleConnectorConfig,
  GoogleDataProvider,
} from "./types.js";
import {
  createSystemGoogleVault,
  type GoogleCredentialVault,
} from "./vault.js";
import { AppError } from "../../core/result.js";

export interface OptionalGoogleDataProvider {
  google?: {
    config: GoogleConnectorConfig;
    provider: GoogleDataProvider;
  };
  unavailable?: {
    code: string;
    message: string;
  };
}

export async function createGoogleDataProvider(
  config: GoogleConnectorConfig,
  dependencies: {
    vault?: GoogleCredentialVault;
    fetch?: typeof fetch;
  } = {},
): Promise<GoogleDataProvider> {
  if (config.adapter === "external-command") {
    return new ExternalGoogleDataProvider(config);
  }
  const vault = dependencies.vault ?? (await createSystemGoogleVault());
  return new LocalGoogleDataProvider(
    config,
    vault,
    dependencies.fetch ?? fetch,
  );
}

export async function resolveOptionalGoogleDataProvider(
  cwd = process.cwd(),
): Promise<OptionalGoogleDataProvider> {
  try {
    const config = await readGoogleConnectorConfig(cwd);
    if (config === null) {
      return {
        unavailable: {
          code: "GOOGLE_NOT_CONFIGURED",
          message: "No Google connector is selected.",
        },
      };
    }
    if (!config.ga4Property || !config.gscSite) {
      return {
        unavailable: {
          code: "GOOGLE_RESOURCES_NOT_SELECTED",
          message:
            "The selected Google profile needs both a GA4 property and Search Console site for unified opportunity evidence.",
        },
      };
    }
    return {
      google: {
        config,
        provider: await createGoogleDataProvider(config),
      },
    };
  } catch (error) {
    return {
      unavailable: {
        code:
          error instanceof AppError
            ? error.code
            : "GOOGLE_PROVIDER_UNAVAILABLE",
        message:
          error instanceof Error
            ? error.message
            : "The optional Google provider is unavailable.",
      },
    };
  }
}
