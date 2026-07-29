import { ExternalGoogleDataProvider } from "./externalProvider.js";
import { LocalGoogleDataProvider } from "./localProvider.js";
import type {
  GoogleConnectorConfig,
  GoogleDataProvider,
} from "./types.js";
import {
  createSystemGoogleVault,
  type GoogleCredentialVault,
} from "./vault.js";

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
