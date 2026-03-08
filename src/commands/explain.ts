import ora from "ora";
import { explainErrorWithAI } from "../services/ai.js";
import type { ExplainContext, ExplainedError } from "../types/error.js";
import { formatExplainedError } from "../utils/formatter.js";
import { logger } from "../utils/logger.js";

type SpinnerLike = {
  succeed(text: string): void;
  fail(text: string): void;
};

type ExplainLogger = {
  info(message: string): void;
  warn(message: string): void;
  error(message: string): void;
};

type RunExplainDeps = {
  explainError?: (errorMessage: string, context?: ExplainContext) => Promise<ExplainedError>;
  createSpinner?: (text: string) => SpinnerLike;
  formatOutput?: (result: ExplainedError) => string;
  log?: ExplainLogger;
};

export type ExplainCommandOptions = {
  output: "pretty" | "json";
  context?: ExplainContext;
};

function isDepsObject(value: unknown): value is RunExplainDeps {
  if (!value || typeof value !== "object") {
    return false;
  }
  const candidate = value as Record<string, unknown>;
  return (
    "explainError" in candidate ||
    "createSpinner" in candidate ||
    "formatOutput" in candidate ||
    "log" in candidate
  );
}

export async function runExplainCommand(
  errorMessage: string,
  optionsOrDeps: ExplainCommandOptions | RunExplainDeps = { output: "pretty" },
  depsArg: RunExplainDeps = {},
): Promise<ExplainedError | null> {
  const options = isDepsObject(optionsOrDeps) ? { output: "pretty" as const } : optionsOrDeps;
  const deps = isDepsObject(optionsOrDeps) ? optionsOrDeps : depsArg;

  const explainError = deps.explainError ?? explainErrorWithAI;
  const createSpinner = deps.createSpinner ?? ((text: string) => ora(text).start());
  const formatOutput = deps.formatOutput ?? formatExplainedError;
  const log = deps.log ?? logger;

  if (!errorMessage?.trim()) {
    log.warn("Please provide an error message.");
    return null;
  }

  const spinner = createSpinner("Analyzing your error...");

  try {
    const result = await explainError(errorMessage.trim(), options.context);
    spinner.succeed("Explanation ready.");
    log.info("");
    if (options.output === "json") {
      log.info(JSON.stringify(result, null, 2));
    } else {
      log.info(formatOutput(result));
    }
    return result;
  } catch (error) {
    spinner.fail("Could not explain this error.");
    const message = error instanceof Error ? error.message : "Unknown error";
    log.error(message);
    return null;
  }
}
