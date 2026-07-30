import type {
  Ga4ReportRequest,
  Ga4ReportResponse,
  Ga4Row,
  GoogleDataProvider,
  GscReportRequest,
  GscReportResponse,
  PaginatedGscReport,
  PaginatedGa4Report,
} from "./types.js";

const MAX_GSC_PAGE_SIZE = 25_000;
const DEFAULT_MAX_ROWS = 50_000;
const DEFAULT_GA4_PAGE_SIZE = 10_000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function ga4IncompleteReasons(response: Ga4ReportResponse): string[] {
  if (!isRecord(response.metadata)) {
    return [];
  }
  const reasons: string[] = [];
  if (response.metadata.subjectToThresholding === true) {
    reasons.push("GA4 subject-to-thresholding metadata is true");
  }
  if (response.metadata.dataLossFromOtherRow === true) {
    reasons.push("GA4 data-loss-from-other-row metadata is true");
  }
  return reasons;
}

export async function fetchPaginatedGa4Report(
  provider: GoogleDataProvider,
  property: string,
  request: Ga4ReportRequest,
  options: { maxRows?: number; pageSize?: number } = {},
): Promise<PaginatedGa4Report> {
  const maxRows = options.maxRows ?? DEFAULT_MAX_ROWS;
  const pageSize = Math.min(
    options.pageSize ?? DEFAULT_GA4_PAGE_SIZE,
    250_000,
    maxRows,
  );
  if (!Number.isInteger(maxRows) || maxRows < 1) {
    throw new Error("maxRows must be a positive integer.");
  }
  if (!Number.isInteger(pageSize) || pageSize < 1) {
    throw new Error("pageSize must be a positive integer.");
  }

  const rows: Ga4Row[] = [];
  const responses: Ga4ReportResponse[] = [];
  let offset = request.offset ?? 0;
  let reportedRowCount: number | undefined;
  let lastPageWasFull = false;

  while (rows.length < maxRows) {
    const remaining = maxRows - rows.length;
    const limit = Math.min(pageSize, remaining);
    const response = await provider.ga4Report(property, {
      ...request,
      limit,
      offset,
    });
    responses.push(response);
    const pageRows = response.rows ?? [];
    rows.push(...pageRows);
    if (response.rowCount !== undefined) {
      reportedRowCount = response.rowCount;
    }
    lastPageWasFull = pageRows.length === limit;
    if (
      !lastPageWasFull ||
      (reportedRowCount !== undefined && rows.length >= reportedRowCount)
    ) {
      break;
    }
    offset += pageRows.length;
  }

  const firstResponse = responses[0];
  const finalResponse = responses.at(-1);
  const reasons = [
    ...new Set(responses.flatMap(ga4IncompleteReasons)),
  ];
  const truncated =
    (reportedRowCount !== undefined && reportedRowCount > rows.length) ||
    (rows.length >= maxRows && lastPageWasFull);
  if (truncated) {
    reasons.push(`row cap reached: ${maxRows}`);
  }

  return {
    response: {
      rows,
      ...(firstResponse?.dimensionHeaders !== undefined
        ? { dimensionHeaders: firstResponse.dimensionHeaders }
        : {}),
      ...(firstResponse?.metricHeaders !== undefined
        ? { metricHeaders: firstResponse.metricHeaders }
        : {}),
      ...(reportedRowCount !== undefined
        ? { rowCount: reportedRowCount }
        : {}),
      ...(finalResponse?.metadata !== undefined
        ? { metadata: finalResponse.metadata }
        : {}),
      ...(finalResponse?.propertyQuota !== undefined
        ? { propertyQuota: finalResponse.propertyQuota }
        : {}),
    },
    coverage: {
      requestedRows: maxRows,
      observedRows: rows.length,
      pagesFetched: responses.length,
      pageSize,
      truncated,
      partial: truncated || reasons.length > 0,
      incompleteReasons: reasons,
    },
  };
}

function incompleteReasons(
  response: GscReportResponse,
  request: GscReportRequest,
): string[] {
  const reasons: string[] = [];
  if (request.dataState !== undefined && request.dataState !== "final") {
    reasons.push(`dataState=${request.dataState} can include incomplete data`);
  }
  if (response.metadata?.first_incomplete_date) {
    reasons.push(
      `first incomplete date: ${response.metadata.first_incomplete_date}`,
    );
  }
  if (response.metadata?.first_incomplete_hour) {
    reasons.push(
      `first incomplete hour: ${response.metadata.first_incomplete_hour}`,
    );
  }
  return reasons;
}

export async function fetchPaginatedGscReport(
  provider: GoogleDataProvider,
  site: string,
  request: GscReportRequest,
  options: { maxRows?: number; pageSize?: number } = {},
): Promise<PaginatedGscReport> {
  const maxRows = options.maxRows ?? DEFAULT_MAX_ROWS;
  const pageSize = Math.min(
    options.pageSize ?? MAX_GSC_PAGE_SIZE,
    MAX_GSC_PAGE_SIZE,
    maxRows,
  );
  if (!Number.isInteger(maxRows) || maxRows < 1) {
    throw new Error("maxRows must be a positive integer.");
  }
  if (!Number.isInteger(pageSize) || pageSize < 1) {
    throw new Error("pageSize must be a positive integer.");
  }

  const rows = [];
  const responses: GscReportResponse[] = [];
  let offset = request.offset ?? 0;
  let lastPageWasFull = false;

  while (rows.length < maxRows) {
    const remaining = maxRows - rows.length;
    const limit = Math.min(pageSize, remaining);
    const response = await provider.gscReport(site, {
      ...request,
      limit,
      offset,
    });
    responses.push(response);
    const pageRows = response.rows ?? [];
    rows.push(...pageRows);
    lastPageWasFull = pageRows.length === limit;
    if (!lastPageWasFull) {
      break;
    }
    offset += pageRows.length;
  }

  const finalResponse = responses.at(-1);
  const reasons = responses.flatMap((response) =>
    incompleteReasons(response, request),
  );
  const uniqueReasons = [...new Set(reasons)];
  const truncated = rows.length >= maxRows && lastPageWasFull;
  if (truncated) {
    uniqueReasons.push(`row cap reached: ${maxRows}`);
  }

  return {
    response: {
      rows,
      ...(finalResponse?.responseAggregationType !== undefined
        ? {
            responseAggregationType:
              finalResponse.responseAggregationType,
          }
        : {}),
      ...(finalResponse?.metadata !== undefined
        ? { metadata: finalResponse.metadata }
        : {}),
    },
    coverage: {
      requestedRows: maxRows,
      observedRows: rows.length,
      pagesFetched: responses.length,
      pageSize,
      topRowsOnly: true,
      truncated,
      partial: uniqueReasons.length > 0 || truncated,
      incompleteReasons: uniqueReasons,
    },
  };
}
