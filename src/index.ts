export {
  acquisitionPeriods,
  buildAcquisitionReport,
  isAiAssistantTraffic,
  type AcquisitionReport,
} from "./analysis/acquisition.js";
export {
  compareAuditRuns,
  getGoogleFindingSnapshots,
  getTechnicalFindingSnapshots,
  type AuditComparison,
  type GoogleFindingSnapshot,
  type TechnicalFindingSnapshot,
} from "./analysis/auditComparison.js";
export {
  gscSiteCoversUrl,
  prioritizeUnifiedFindings,
  sameApexWwwBoundary,
  type FullAuditFocus,
  type FullAuditPriority,
  type UnifiedFindingCandidate,
  type UnifiedPriorityFinding,
} from "./analysis/fullAudit.js";
export {
  auditPage,
  type PageAuditAnalysis,
  type PageAuditFinding,
  type PageAuditObservation,
  type PageAuditOptions,
  type PageAuditRecommendation,
} from "./analysis/pageAudit.js";
export {
  crawlSite,
  type SiteCrawlAnalysis,
  type SiteCrawlOptions,
  type SiteCrawlPageObservation,
  type SiteCrawlPageResult,
  type SiteCrawlSitemapObservation,
} from "./analysis/siteCrawl.js";
export {
  buildOpportunityAnalysis,
  type LandingOutcome,
  type OpportunityAnalysis,
  type OpportunityFinding,
  type OpportunityObservation,
  type OpportunityRecommendation,
  type OpportunitySignal,
  type SearchMovement,
} from "./analysis/opportunities.js";
export {
  runCapability,
  type CapabilityRunContext,
  type CapabilityRunParameters,
  type GoogleOpportunityEnvelope,
  type FullAuditEnvelope,
  type FullAuditConfiguration,
  type FullAuditGoogleStatus,
  type OpportunityAuditEnvelope,
  type OpportunityPageAudit,
  type PageAuditEnvelope,
  type SiteCrawlEnvelope,
} from "./capabilities/run.js";
export { extractHtmlDocument } from "./connectors/site/html.js";
export { createSiteHttpClient } from "./connectors/site/http.js";
export {
  isPublicAddress,
  normalizeAuditUrl,
  resolvePublicAuditUrl,
} from "./connectors/site/networkPolicy.js";
export {
  evaluateRobots,
  parseRobotsTxt,
} from "./connectors/site/robots.js";
export { parseSitemapDocument } from "./connectors/site/sitemap.js";
export type {
  HtmlDocumentFacts,
  RobotsDecision,
  ParsedRobots,
  ParsedSitemap,
  SitemapChildEntry,
  SitemapUrlEntry,
  SiteHostResolver,
  SiteHttpClient,
  SiteHttpRequestOptions,
  SiteHttpResponse,
} from "./connectors/site/types.js";
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
export {
  createGoogleDataProvider,
  resolveOptionalGoogleDataProvider,
  type OptionalGoogleDataProvider,
} from "./connectors/google/provider.js";
export {
  fetchPaginatedGa4Report,
  fetchPaginatedGscReport,
} from "./connectors/google/pagination.js";
export type {
  ExternalGoogleConnectorConfig,
  Ga4Property,
  Ga4FilterExpression,
  Ga4ReportCoverage,
  Ga4ReportRequest,
  Ga4ReportResponse,
  Ga4StringMatchType,
  GoogleConnectorConfig,
  GoogleConnectorSelection,
  GoogleConnectorStatus,
  GoogleDataProvider,
  GoogleInventory,
  GscAggregationType,
  GscDataState,
  GscDimensionFilter,
  GscDimensionFilterGroup,
  GscFilterDimension,
  GscFilterOperator,
  GscReportRequest,
  GscReportCoverage,
  GscReportResponse,
  GscResponseMetadata,
  GscSearchType,
  LocalGoogleConnectorConfig,
  PaginatedGscReport,
  PaginatedGa4Report,
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
  listAuditRuns,
  readAuditRun,
  saveAuditRun,
  type AuditRunDescriptor,
  type AuditRunList,
  type StoredAuditRun,
} from "./core/auditRuns.js";
export {
  EVIDENCE_CLASSES,
  evidenceJsonSchema,
  type EvidenceClass,
} from "./core/evidence.js";
export {
  capabilityRunId,
  describeCapability,
  listCapabilities,
  type CapabilityCoverage,
  type CapabilityArtifact,
  type CapabilityDefinition,
  type CapabilityRunEnvelope,
  type CapabilitySideEffects,
  type CapabilitySource,
} from "./core/capabilities.js";
export {
  analyzeLogFile,
  parseLogLine,
  type LogAnalysis,
  type LogObservation,
  type LogParseError,
  type LogParseResult,
} from "./core/logs.js";
export {
  explainQueuedOpportunity,
  listQueuedOpportunities,
  opportunityQueuePath,
  readOpportunityQueue,
  syncOpportunityQueue,
  updateOpportunityStatus,
  type OpportunityHistoryEvent,
  type OpportunityListItem,
  type OpportunityObservationState,
  type OpportunityQueueFilters,
  type OpportunityQueuePriority,
  type OpportunityQueueSource,
  type OpportunityQueueStatus,
  type OpportunityQueueStore,
  type OpportunityQueueSummary,
  type OpportunitySiteSync,
  type OpportunityStatusUpdateResult,
  type OpportunitySyncResult,
  type QueuedOpportunity,
} from "./core/opportunityQueue.js";
export {
  cliExecutablePath,
  getAgentSetupCommands,
  getMcpLaunchCommand,
  initializeProject,
  projectConfigPath,
  readProjectConfig,
  resolveReadableProjectFile,
  type AgentIntegration,
  type McpLaunchCommand,
  type ProjectAgentTarget,
  type ProjectConfig,
  type ProjectInitialization,
} from "./core/project.js";
export {
  buildAgentInstallCommand,
  detectAgentTargets,
  installAgentTarget,
  renderAgentCommand,
  type AgentDetection,
  type AgentInstallCommand,
  type AgentInstallResult,
  type AgentTarget,
} from "./onboarding/agents.js";
export {
  inspectOnboarding,
  type OnboardingInspection,
} from "./onboarding/wizard.js";
export { SCHEMA_VERSION, VERSION } from "./core/version.js";
