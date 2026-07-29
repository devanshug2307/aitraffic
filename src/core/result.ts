import { SCHEMA_VERSION } from "./version.js";

export interface CommandError {
  code: string;
  message: string;
  details?: unknown;
}

export interface CommandResult<T> {
  schemaVersion: typeof SCHEMA_VERSION;
  ok: boolean;
  command: string;
  data?: T;
  warnings: string[];
  errors: CommandError[];
}

export class AppError extends Error {
  readonly code: string;
  readonly exitCode: number;
  readonly details?: unknown;

  constructor(
    code: string,
    message: string,
    exitCode = 2,
    details?: unknown,
  ) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.exitCode = exitCode;
    if (details !== undefined) {
      this.details = details;
    }
  }
}

export function success<T>(
  command: string,
  data: T,
  warnings: string[] = [],
): CommandResult<T> {
  return {
    schemaVersion: SCHEMA_VERSION,
    ok: true,
    command,
    data,
    warnings,
    errors: [],
  };
}

export function failure(
  command: string,
  error: CommandError,
): CommandResult<never> {
  return {
    schemaVersion: SCHEMA_VERSION,
    ok: false,
    command,
    warnings: [],
    errors: [error],
  };
}
