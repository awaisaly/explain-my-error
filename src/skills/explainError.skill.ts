import { z } from "zod";
import { explainErrorWithAI } from "../services/ai.js";
import type { ExplainedError } from "../types/error.js";

const explainErrorSkillInputSchema = z.object({
  error: z.string().min(1, "error is required"),
  stack_trace: z.string().optional(),
  code_snippet: z.string().optional(),
  runtime: z.string().optional(),
  framework: z.string().optional(),
});

export type ExplainErrorSkillInput = z.infer<typeof explainErrorSkillInputSchema>;

export async function runExplainErrorSkill(input: ExplainErrorSkillInput): Promise<ExplainedError> {
  const parsedInput = explainErrorSkillInputSchema.parse(input);
  return explainErrorWithAI(parsedInput.error, {
    stackTrace: parsedInput.stack_trace,
    codeSnippet: parsedInput.code_snippet,
    runtime: parsedInput.runtime,
    framework: parsedInput.framework,
  });
}
