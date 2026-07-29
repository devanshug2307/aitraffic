export {
  acquisitionPeriods,
  buildAcquisitionReport,
  isAiAssistantTraffic,
  type AcquisitionReport,
} from "./analysis/acquisition.js";
export {
  configureGoogleConnector,
  googleConfigPath,
  normalizeGa4Property,
  readGoogleConnectorConfig,
  selectLocalGoogleConnector,
  validateGoogleProfile,
} from "./connectors/google/config.js";
export { ExternalGoogleDataProvider } from "./connectors/google/externalProvider.js";
export {
  GOOGLE_READ_ONLY_SCOPES,
  buildGoogleAuthorizationUrl,
  createPkcePair,
  parseEnvFile,
  validateGoogleRedirectUri,
} from "./connectors/google/oauth.js";
export { createGoogleDataProvider } from "./connectors/google/provider.js";
export type {
  ExternalGoogleConnectorConfig,
  Ga4Property,
  Ga4ReportRequest,
  Ga4ReportResponse,
  GoogleConnectorConfig,
  GoogleConnectorSelection,
  GoogleConnectorStatus,
  GoogleDataProvider,
  GoogleInventory,
  GscReportRequest,
  GscReportResponse,
  LocalGoogleConnectorConfig,
  SearchConsoleSite,
} from "./connectors/google/types.js";
export {
  AGENT_BEHAVIORS,
  AGENT_PATTERNS,
  classifyUserAgent,
  type AgentBehavior,
  type AgentClassification,
  type VerificationMethod,
} from "./core/agentRegistry.js";
export {
  EVIDENCE_CLASSES,
  evidenceJsonSchema,
  type EvidenceClass,
} from "./core/evidence.js";
export {
  analyzeLogFile,
  parseLogLine,
  type LogAnalysis,
  type LogObservation,
  type LogParseError,
  type LogParseResult,
} from "./core/logs.js";
export {
  cliExecutablePath,
  getAgentSetupCommands,
  initializeProject,
  projectConfigPath,
  readProjectConfig,
  resolveReadableProjectFile,
  type AgentIntegration,
  type ProjectConfig,
  type ProjectInitialization,
} from "./core/project.js";
export { SCHEMA_VERSION, VERSION } from "./core/version.js";
