import ora from "ora";
import { explainErrorWithAI } from "../services/ai.js";
import type { ExplainedError } from "../types/error.js";
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
  explainError?: (errorMessage: string) => Promise<ExplainedError>;
  createSpinner?: (text: string) => SpinnerLike;
  formatOutput?: (result: ExplainedError) => string;
  log?: ExplainLogger;
};

export async function runExplainCommand(
  errorMessage: string,
  deps: RunExplainDeps = {},
): Promise<void> {
  const explainError = deps.explainError ?? explainErrorWithAI;
  const createSpinner = deps.createSpinner ?? ((text: string) => ora(text).start());
  const formatOutput = deps.formatOutput ?? formatExplainedError;
  const log = deps.log ?? logger;

  if (!errorMessage?.trim()) {
    log.warn("Please provide an error message.");
    return;
  }

  const spinner = createSpinner("Analyzing your error...");

  try {
    const result = await explainError(errorMessage.trim());
    spinner.succeed("Explanation ready.");
    log.info("");
    log.info(formatOutput(result));
  } catch (error) {
    spinner.fail("Could not explain this error.");
    const message = error instanceof Error ? error.message : "Unknown error";
    log.error(message);
  }
}
