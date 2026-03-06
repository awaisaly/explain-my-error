import { z } from "zod";

export const explainedErrorSchema = z.object({
  title: z.string().min(1),
  explanation: z.string().min(1),
  common_causes: z.array(z.string().min(1)).min(1),
  fix: z.string().min(1),
  code_example: z.string().min(1),
  eli5: z.string().min(1),
});

export type ExplainedError = z.infer<typeof explainedErrorSchema>;
