import { AppError } from "../../core/result.js";
import { validateGoogleProfile } from "./config.js";

const GOOGLE_KEYCHAIN_SERVICE = "aitraffic.google";
const CLIENT_ACCOUNT = "oauth-client";
const PROFILE_INDEX_ACCOUNT = "profile-index";
export interface GoogleOAuthClient {
  schemaVersion: "0.2.0";
  clientId: string;
  clientSecret?: string;
  clientType?: "web" | "desktop";
  redirectUri: string;
  configuredAt: string;
}

export interface GoogleOAuthProfile {
  schemaVersion: "0.2.0";
  profile: string;
  clientKey: string;
  accessToken: string;
  refreshToken?: string;
  expiresAt: number;
  scopes: string[];
  subject: string;
  tokenType?: string;
  createdAt: string;
  updatedAt: string;
}

export interface GoogleCredentialVault {
  backendInfo(): { id: string; name: string };
  getClient(): Promise<GoogleOAuthClient | null>;
  setClient(client: GoogleOAuthClient): Promise<void>;
  getProfile(profile: string): Promise<GoogleOAuthProfile | null>;
  setProfile(profile: GoogleOAuthProfile): Promise<void>;
  deleteProfile(profile: string): Promise<boolean>;
  listProfiles(): Promise<string[]>;
}

interface SecretStore {
  readonly id: string;
  readonly name: string;
  getPassword(service: string, account: string): Promise<string | null>;
  setPassword(
    service: string,
    account: string,
    password: string,
  ): Promise<void>;
  deletePassword(service: string, account: string): Promise<void>;
}

interface NativeEntry {
  getPassword(): Promise<string | undefined>;
  setPassword(password: string): Promise<void>;
  deleteCredential(): Promise<boolean>;
}

type NativeEntryConstructor = new (
  service: string,
  account: string,
) => NativeEntry;

class NativeSecretStore implements SecretStore {
  readonly id: string;
  readonly name: string;
  private readonly Entry: NativeEntryConstructor;

  constructor(
    Entry: NativeEntryConstructor,
    backend: { id: string; name: string },
  ) {
    this.Entry = Entry;
    this.id = backend.id;
    this.name = backend.name;
  }

  private entry(service: string, account: string): NativeEntry {
    return new this.Entry(service, account);
  }

  async getPassword(service: string, account: string): Promise<string | null> {
    try {
      return (await this.entry(service, account).getPassword()) ?? null;
    } catch {
      throw new AppError(
        "GOOGLE_SECURE_STORAGE_FAILED",
        "The operating-system credential store could not be read.",
        1,
      );
    }
  }

  async setPassword(
    service: string,
    account: string,
    password: string,
  ): Promise<void> {
    try {
      await this.entry(service, account).setPassword(password);
    } catch {
      throw new AppError(
        "GOOGLE_SECURE_STORAGE_FAILED",
        "The operating-system credential store could not be written.",
        1,
      );
    }
  }

  async deletePassword(service: string, account: string): Promise<void> {
    try {
      await this.entry(service, account).deleteCredential();
    } catch {
      throw new AppError(
        "GOOGLE_SECURE_STORAGE_FAILED",
        "The operating-system credential could not be deleted.",
        1,
      );
    }
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseClient(value: string): GoogleOAuthClient {
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    throw new AppError(
      "GOOGLE_VAULT_CORRUPT",
      "Stored Google OAuth client configuration is invalid.",
      1,
    );
  }
  if (
    !isRecord(parsed) ||
    parsed.schemaVersion !== "0.2.0" ||
    typeof parsed.clientId !== "string" ||
    (parsed.clientSecret !== undefined &&
      typeof parsed.clientSecret !== "string") ||
    (parsed.clientType !== undefined &&
      parsed.clientType !== "web" &&
      parsed.clientType !== "desktop") ||
    typeof parsed.redirectUri !== "string" ||
    typeof parsed.configuredAt !== "string"
  ) {
    throw new AppError(
      "GOOGLE_VAULT_CORRUPT",
      "Stored Google OAuth client configuration is invalid.",
      1,
    );
  }
  const client: GoogleOAuthClient = {
    schemaVersion: "0.2.0",
    clientId: parsed.clientId,
    clientType: parsed.clientType ?? "web",
    redirectUri: parsed.redirectUri,
    configuredAt: parsed.configuredAt,
  };
  if (typeof parsed.clientSecret === "string") {
    client.clientSecret = parsed.clientSecret;
  }
  return client;
}

function parseProfile(value: string): GoogleOAuthProfile {
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    throw new AppError(
      "GOOGLE_VAULT_CORRUPT",
      "Stored Google OAuth profile is invalid.",
      1,
    );
  }
  if (
    !isRecord(parsed) ||
    parsed.schemaVersion !== "0.2.0" ||
    typeof parsed.profile !== "string" ||
    typeof parsed.clientKey !== "string" ||
    typeof parsed.accessToken !== "string" ||
    typeof parsed.expiresAt !== "number" ||
    !Array.isArray(parsed.scopes) ||
    !parsed.scopes.every((scope) => typeof scope === "string") ||
    typeof parsed.subject !== "string" ||
    typeof parsed.createdAt !== "string" ||
    typeof parsed.updatedAt !== "string"
  ) {
    throw new AppError(
      "GOOGLE_VAULT_CORRUPT",
      "Stored Google OAuth profile is invalid.",
      1,
    );
  }
  const profile: GoogleOAuthProfile = {
    schemaVersion: "0.2.0",
    profile: validateGoogleProfile(parsed.profile),
    clientKey: parsed.clientKey,
    accessToken: parsed.accessToken,
    expiresAt: parsed.expiresAt,
    scopes: parsed.scopes,
    subject: parsed.subject,
    createdAt: parsed.createdAt,
    updatedAt: parsed.updatedAt,
  };
  if (typeof parsed.refreshToken === "string") {
    profile.refreshToken = parsed.refreshToken;
  }
  if (typeof parsed.tokenType === "string") {
    profile.tokenType = parsed.tokenType;
  }
  return profile;
}

function parseProfileIndex(value: string | null): string[] {
  if (value === null) {
    return [];
  }
  try {
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return [
      ...new Set(
        parsed.flatMap((profile) => {
          if (typeof profile !== "string") {
            return [];
          }
          try {
            return [validateGoogleProfile(profile)];
          } catch {
            return [];
          }
        }),
      ),
    ].sort();
  } catch {
    return [];
  }
}

export class SecureGoogleVault implements GoogleCredentialVault {
  private readonly store: SecretStore;

  constructor(store: SecretStore) {
    this.store = store;
  }

  backendInfo(): { id: string; name: string } {
    return { id: this.store.id, name: this.store.name };
  }

  async getClient(): Promise<GoogleOAuthClient | null> {
    const value = await this.store.getPassword(
      GOOGLE_KEYCHAIN_SERVICE,
      CLIENT_ACCOUNT,
    );
    return value === null ? null : parseClient(value);
  }

  async setClient(client: GoogleOAuthClient): Promise<void> {
    await this.store.setPassword(
      GOOGLE_KEYCHAIN_SERVICE,
      CLIENT_ACCOUNT,
      JSON.stringify(client),
    );
  }

  async getProfile(profile: string): Promise<GoogleOAuthProfile | null> {
    const normalized = validateGoogleProfile(profile);
    const value = await this.store.getPassword(
      GOOGLE_KEYCHAIN_SERVICE,
      `profile:${normalized}`,
    );
    return value === null ? null : parseProfile(value);
  }

  async setProfile(profile: GoogleOAuthProfile): Promise<void> {
    const normalized = validateGoogleProfile(profile.profile);
    await this.store.setPassword(
      GOOGLE_KEYCHAIN_SERVICE,
      `profile:${normalized}`,
      JSON.stringify({ ...profile, profile: normalized }),
    );
    const profiles = await this.listProfiles();
    if (!profiles.includes(normalized)) {
      profiles.push(normalized);
      profiles.sort();
      await this.store.setPassword(
        GOOGLE_KEYCHAIN_SERVICE,
        PROFILE_INDEX_ACCOUNT,
        JSON.stringify(profiles),
      );
    }
  }

  async deleteProfile(profile: string): Promise<boolean> {
    const normalized = validateGoogleProfile(profile);
    const existing = await this.getProfile(normalized);
    if (existing === null) {
      return false;
    }
    await this.store.deletePassword(
      GOOGLE_KEYCHAIN_SERVICE,
      `profile:${normalized}`,
    );
    const profiles = (await this.listProfiles()).filter(
      (candidate) => candidate !== normalized,
    );
    await this.store.setPassword(
      GOOGLE_KEYCHAIN_SERVICE,
      PROFILE_INDEX_ACCOUNT,
      JSON.stringify(profiles),
    );
    return true;
  }

  async listProfiles(): Promise<string[]> {
    return parseProfileIndex(
      await this.store.getPassword(
        GOOGLE_KEYCHAIN_SERVICE,
        PROFILE_INDEX_ACCOUNT,
      ),
    );
  }
}

export async function createSystemGoogleVault(): Promise<GoogleCredentialVault> {
  const backend =
    process.platform === "darwin"
      ? { id: "native-macos", name: "Native macOS Keychain" }
      : process.platform === "win32"
        ? {
            id: "native-windows",
            name: "Native Windows Credential Manager",
          }
        : process.platform === "linux"
          ? { id: "native-linux", name: "Native Linux Secret Service" }
          : null;
  if (!backend) {
    throw new AppError(
      "GOOGLE_SECURE_STORAGE_UNAVAILABLE",
      "Native Google OAuth storage is not supported on this operating system.",
      1,
    );
  }
  try {
    const { AsyncEntry } = await import("@napi-rs/keyring");
    return new SecureGoogleVault(
      new NativeSecretStore(AsyncEntry, backend),
    );
  } catch {
    throw new AppError(
      "GOOGLE_SECURE_STORAGE_UNAVAILABLE",
      "The native operating-system credential-store binding is unavailable for Google OAuth.",
      1,
    );
  }
}
