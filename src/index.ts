export {
  acquisitionPeriods,
  buildAcquisitionReport,
  isAiAssistantTraffic,
  type AcquisitionReport,
} from "./analysis/acquisition.js";
export {
  configureGoogleConnector,
  googleConfigPath,
  readGoogleConnectorConfig,
  validateGoogleProfile,
} from "./connectors/google/config.js";
export { ExternalGoogleDataProvider } from "./connectors/google/externalProvider.js";
export type {
  Ga4Property,
  Ga4ReportRequest,
  Ga4ReportResponse,
  GoogleConnectorConfig,
  GoogleConnectorStatus,
  GoogleDataProvider,
  GoogleInventory,
  GscReportRequest,
  GscReportResponse,
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
