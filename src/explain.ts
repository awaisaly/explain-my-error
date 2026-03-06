import { explainErrorWithAI } from "./services/ai.js";
import type { ExplainedError } from "./types/error.js";

export async function explainError(errorMessage: string): Promise<ExplainedError> {
  return explainErrorWithAI(errorMessage);
}
