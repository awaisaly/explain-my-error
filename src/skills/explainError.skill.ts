import { z } from "zod";
import { explainErrorWithAI } from "../services/ai.js";
import type { ExplainedError } from "../types/error.js";

const explainErrorSkillInputSchema = z.object({
  error: z.string().min(1, "error is required"),
});

export type ExplainErrorSkillInput = z.infer<typeof explainErrorSkillInputSchema>;

export async function runExplainErrorSkill(input: ExplainErrorSkillInput): Promise<ExplainedError> {
  const parsedInput = explainErrorSkillInputSchema.parse(input);
  return explainErrorWithAI(parsedInput.error);
}
