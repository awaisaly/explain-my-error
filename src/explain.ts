import { explainErrorWithAI } from "./services/ai.js";
import type { ExplainContext, ExplainedError } from "./types/error.js";

export async function explainError(
  errorMessage: string,
  context: ExplainContext = {},
): Promise<ExplainedError> {
  return explainErrorWithAI(errorMessage, context);
}
