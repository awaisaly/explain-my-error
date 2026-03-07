import axios from "axios";
import { type ExplainContext, type ExplainedError, explainedErrorSchema } from "../types/error.js";

const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
const PRIMARY_GROQ_MODEL = "llama3-70b-8192";
const FALLBACK_GROQ_MODEL = process.env.GROQ_FALLBACK_MODEL ?? "llama-3.3-70b-versatile";

type GroqChatResponse = {
  choices?: Array<{ message?: { content?: string } }>;
};

function extractJson(content: string): unknown {
  const trimmed = content.trim();

  const tryParse = (input: string): unknown | null => {
    try {
      return JSON.parse(input);
    } catch {
      return null;
    }
  };

  const sanitizeControlCharsInStrings = (input: string): string => {
    let result = "";
    let inString = false;
    let escaping = false;

    for (let i = 0; i < input.length; i += 1) {
      const ch = input[i];

      if (!inString) {
        result += ch;
        if (ch === '"') {
          inString = true;
        }
        continue;
      }

      if (escaping) {
        result += ch;
        escaping = false;
        continue;
      }

      if (ch === "\\") {
        result += ch;
        escaping = true;
        continue;
      }

      if (ch === '"') {
        result += ch;
        inString = false;
        continue;
      }

      if (ch === "\n") {
        result += "\\n";
        continue;
      }
      if (ch === "\r") {
        result += "\\r";
        continue;
      }
      if (ch === "\t") {
        result += "\\t";
        continue;
      }

      const code = ch.charCodeAt(0);
      if (code < 0x20) {
        result += `\\u${code.toString(16).padStart(4, "0")}`;
        continue;
      }

      result += ch;
    }

    return result;
  };

  const direct = tryParse(trimmed);
  if (direct !== null) {
    return direct;
  }

  const match = trimmed.match(/\{[\s\S]*\}/);
  if (!match) {
    throw new Error("AI did not return valid JSON.");
  }

  const extracted = match[0];
  const extractedParsed = tryParse(extracted);
  if (extractedParsed !== null) {
    return extractedParsed;
  }

  const sanitized = sanitizeControlCharsInStrings(extracted);
  const sanitizedParsed = tryParse(sanitized);
  if (sanitizedParsed !== null) {
    return sanitizedParsed;
  }

  throw new Error("AI did not return valid JSON.");
}

function stringifyField(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }
  if (value == null) {
    return "";
  }
  if (typeof value === "object") {
    try {
      return JSON.stringify(value, null, 2);
    } catch {
      return String(value);
    }
  }
  return String(value);
}

function toStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map((item) => stringifyField(item))
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return stringifyField(value)
    .split(/\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function toConfidence(value: unknown): number {
  if (typeof value === "number") {
    return Math.max(0, Math.min(1, value));
  }
  const parsed = Number(stringifyField(value));
  if (!Number.isNaN(parsed)) {
    return Math.max(0, Math.min(1, parsed));
  }
  return 0.5;
}

function normalizeResponseShape(payload: unknown): unknown {
  if (!payload || typeof payload !== "object") {
    return payload;
  }

  const data = payload as Record<string, unknown>;

  const commonCauses = toStringArray(data.common_causes);

  const hypothesesRaw = Array.isArray(data.hypotheses) ? data.hypotheses : [];
  const hypotheses = hypothesesRaw
    .map((item) => {
      const row = item as Record<string, unknown>;
      return {
        hypothesis: stringifyField(row?.hypothesis),
        confidence: toConfidence(row?.confidence),
        why: stringifyField(row?.why),
      };
    })
    .filter((item) => item.hypothesis && item.why)
    .slice(0, 3);

  const fixPlansRaw = Array.isArray(data.fix_plans) ? data.fix_plans : [];
  const normalizedFixPlans = fixPlansRaw
    .map((item, index) => {
      const row = item as Record<string, unknown>;
      const defaultPlan = index === 0 ? "fast_patch" : index === 1 ? "proper_fix" : "long_term_fix";
      const planText = stringifyField(row?.plan || defaultPlan).toLowerCase();
      const plan =
        planText === "fast_patch" || planText === "proper_fix" || planText === "long_term_fix"
          ? planText
          : defaultPlan;

      const tradeoffs = (row?.tradeoffs ?? {}) as Record<string, unknown>;
      return {
        plan,
        summary: stringifyField(row?.summary),
        steps: toStringArray(row?.steps),
        tradeoffs: {
          risk: stringifyField(tradeoffs.risk || "Unknown"),
          performance: stringifyField(tradeoffs.performance || "Unknown"),
          maintainability: stringifyField(tradeoffs.maintainability || "Unknown"),
        },
      };
    })
    .filter((item) => item.summary && item.steps.length > 0);

  const fixPlans =
    normalizedFixPlans.length >= 3
      ? normalizedFixPlans.slice(0, 3)
      : [
          {
            plan: "fast_patch",
            summary: stringifyField(data.fix),
            steps: [stringifyField(data.fix) || "Apply a defensive guard around the failing line."],
            tradeoffs: {
              risk: "May hide deeper data contract issues.",
              performance: "Minimal runtime overhead.",
              maintainability: "Good short-term, revisit for root-cause cleanup.",
            },
          },
          {
            plan: "proper_fix",
            summary: "Fix data flow and initialization path.",
            steps: [
              "Trace where the failing value is created.",
              "Initialize value before usage and add proper null checks.",
              "Add a regression test for this scenario.",
            ],
            tradeoffs: {
              risk: "Moderate code changes.",
              performance: "Neutral to slightly improved.",
              maintainability: "Better long-term readability and reliability.",
            },
          },
          {
            plan: "long_term_fix",
            summary: "Enforce stronger contracts and prevention tooling.",
            steps: [
              "Enable stricter type checks and lint rules.",
              "Introduce runtime validation for external inputs.",
              "Create reusable utility guards in shared modules.",
            ],
            tradeoffs: {
              risk: "Requires broader refactor.",
              performance: "Potential minor validation overhead.",
              maintainability: "Highest long-term stability.",
            },
          },
        ];

  const frameworkRecipesRaw = Array.isArray(data.framework_recipes) ? data.framework_recipes : [];
  const frameworkRecipes = frameworkRecipesRaw
    .map((item) => {
      const row = item as Record<string, unknown>;
      return {
        framework: stringifyField(row?.framework),
        when_to_use: stringifyField(row?.when_to_use),
        steps: toStringArray(row?.steps),
        code_snippet: stringifyField(row?.code_snippet),
      };
    })
    .filter(
      (item) => item.framework && item.when_to_use && item.steps.length > 0 && item.code_snippet,
    );

  const remediationBlocksRaw = Array.isArray(data.remediation_blocks)
    ? data.remediation_blocks
    : [];
  const remediationBlocks = remediationBlocksRaw
    .map((item) => {
      const row = item as Record<string, unknown>;
      return {
        title: stringifyField(row?.title),
        commands: toStringArray(row?.commands),
        snippet: stringifyField(row?.snippet) || undefined,
      };
    })
    .filter((item) => item.title && item.commands.length > 0);

  const verifyChecklist = toStringArray(data.verify_checklist);

  const title = stringifyField(data.title);
  const explanation = stringifyField(data.explanation);
  const codeExample = stringifyField(data.code_example);
  const fix = stringifyField(data.fix);
  const likelyRootCause =
    stringifyField(data.likely_root_cause) ||
    commonCauses[0] ||
    "Insufficient context from error text.";

  return {
    title: title || "Unknown error",
    explanation: explanation || "Unable to derive explanation from model response.",
    common_causes:
      commonCauses.length > 0 ? commonCauses : ["Insufficient context in provided error text."],
    fix: fix || "Add guards and trace value initialization before the failing line.",
    code_example: codeExample || "// Add null checks around the failing line.",
    eli5: stringifyField(data.eli5) || "Your code expected one thing, but got something different.",
    likely_root_cause: likelyRootCause,
    hypotheses:
      hypotheses.length > 0
        ? hypotheses
        : [
            {
              hypothesis: likelyRootCause,
              confidence: 0.6,
              why: "Derived from error pattern and available context.",
            },
          ],
    fix_plans: fixPlans,
    framework_recipes:
      frameworkRecipes.length > 0
        ? frameworkRecipes
        : [
            {
              framework: "Node.js",
              when_to_use: "Default runtime fallback when framework is unknown.",
              steps: [
                "Validate all external data before use.",
                "Guard nullable values before method calls.",
                "Add test coverage for this failure path.",
              ],
              code_snippet: "const safeValue = input ?? defaultValue;",
            },
          ],
    remediation_blocks:
      remediationBlocks.length > 0
        ? remediationBlocks
        : [
            {
              title: "Quick remediation commands",
              commands: ["npm run test", "npm run lint"],
            },
          ],
    verify_checklist:
      verifyChecklist.length > 0
        ? verifyChecklist
        : ["Re-run failing command.", "Confirm no regression in related flows."],
  };
}

export async function explainErrorWithAI(
  errorMessage: string,
  context: ExplainContext = {},
): Promise<ExplainedError> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error(
      [
        "Missing GROQ_API_KEY environment variable.",
        "",
        "Quick setup:",
        "  macOS/Linux (zsh/bash):",
        '    export GROQ_API_KEY="your_groq_api_key"',
        "",
        "  Windows PowerShell:",
        '    $env:GROQ_API_KEY="your_groq_api_key"',
        "",
        "Then run the CLI again.",
      ].join("\n"),
    );
  }

  const prompt = `You are a senior software engineer helping debug errors with context.
Return STRICT JSON only (no markdown) with fields:
- title
- explanation
- common_causes (string[])
- fix
- code_example
- eli5
- likely_root_cause
- hypotheses (2-3 items): [{ hypothesis, confidence (0..1), why }]
- fix_plans (exactly 3): [
  { plan: "fast_patch", summary, steps[], tradeoffs: { risk, performance, maintainability } },
  { plan: "proper_fix", summary, steps[], tradeoffs: { risk, performance, maintainability } },
  { plan: "long_term_fix", summary, steps[], tradeoffs: { risk, performance, maintainability } }
]
- framework_recipes (1+): [{ framework, when_to_use, steps[], code_snippet }]
- remediation_blocks (1+): [{ title, commands[], snippet? }]
- verify_checklist (string[])

Use provided runtime/framework/code/stack context to produce context-aware likely root cause and framework-specific fixes.`;

  const contextBlock = [
    `Error message:\n${errorMessage}`,
    `Runtime:\n${context.runtime ?? "unknown"}`,
    `Framework:\n${context.framework ?? "unknown"}`,
    `Stack trace:\n${context.stackTrace ?? "not provided"}`,
    `Code snippet:\n${context.codeSnippet ?? "not provided"}`,
  ].join("\n\n");

  const requestBody = {
    messages: [
      { role: "system" as const, content: prompt },
      {
        role: "user" as const,
        content: `${contextBlock}\n\nReturn strict JSON only.`,
      },
    ],
    temperature: 0.2,
  };

  const requestConfig = {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    timeout: 30000,
  };

  let response: { data?: GroqChatResponse };
  try {
    response = await axios.post(
      GROQ_API_URL,
      { model: PRIMARY_GROQ_MODEL, ...requestBody },
      requestConfig,
    );
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const providerMessage =
        typeof error.response?.data?.error?.message === "string"
          ? error.response.data.error.message
          : error.message;

      const isModelDecommissioned =
        providerMessage.toLowerCase().includes("decommissioned") ||
        providerMessage.toLowerCase().includes("no longer supported");

      if (isModelDecommissioned) {
        response = await axios.post(
          GROQ_API_URL,
          { model: FALLBACK_GROQ_MODEL, ...requestBody },
          requestConfig,
        );
      } else {
        throw new Error(`Groq API request failed: ${providerMessage}`);
      }
    } else {
      throw error;
    }
  }

  const content = response.data?.choices?.[0]?.message?.content;
  if (typeof content !== "string" || !content.trim()) {
    throw new Error("AI response was empty.");
  }

  const parsed = extractJson(content);
  const normalized = normalizeResponseShape(parsed);
  return explainedErrorSchema.parse(normalized);
}
