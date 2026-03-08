import { z } from "zod";

export const hypothesisSchema = z.object({
  hypothesis: z.string().min(1),
  confidence: z.number().min(0).max(1),
  why: z.string().min(1),
});

export const fixPlanSchema = z.object({
  plan: z.enum(["fast_patch", "proper_fix", "long_term_fix"]),
  summary: z.string().min(1),
  steps: z.array(z.string().min(1)).min(1),
  tradeoffs: z.object({
    risk: z.string().min(1),
    performance: z.string().min(1),
    maintainability: z.string().min(1),
  }),
});

export const frameworkRecipeSchema = z.object({
  framework: z.string().min(1),
  when_to_use: z.string().min(1),
  steps: z.array(z.string().min(1)).min(1),
  code_snippet: z.string().min(1),
});

export const remediationBlockSchema = z.object({
  title: z.string().min(1),
  commands: z.array(z.string().min(1)).min(1),
  snippet: z.string().optional(),
});

export const explainedErrorSchema = z.object({
  title: z.string().min(1),
  explanation: z.string().min(1),
  common_causes: z.array(z.string().min(1)).min(1),
  fix: z.string().min(1),
  code_example: z.string().min(1),
  eli5: z.string().min(1),
  likely_root_cause: z.string().min(1),
  hypotheses: z.array(hypothesisSchema).min(1).max(3),
  fix_plans: z.array(fixPlanSchema).min(3),
  framework_recipes: z.array(frameworkRecipeSchema).min(1),
  remediation_blocks: z.array(remediationBlockSchema).min(1),
  verify_checklist: z.array(z.string().min(1)).min(1),
});

export type ExplainedError = z.infer<typeof explainedErrorSchema>;
export type ExplainHypothesis = z.infer<typeof hypothesisSchema>;
export type FixPlan = z.infer<typeof fixPlanSchema>;
export type FrameworkRecipe = z.infer<typeof frameworkRecipeSchema>;
export type RemediationBlock = z.infer<typeof remediationBlockSchema>;

export type ExplainContext = {
  stackTrace?: string;
  codeSnippet?: string;
  runtime?: string;
  framework?: string;
  conversationHistory?: Array<{
    role: "user" | "assistant";
    content: string;
  }>;
};
