import axios from "axios";
import { type ExplainedError, explainedErrorSchema } from "../types/error.js";

const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
const PRIMARY_GROQ_MODEL = "llama3-70b-8192";
const FALLBACK_GROQ_MODEL = process.env.GROQ_FALLBACK_MODEL ?? "llama-3.3-70b-versatile";

type GroqChatResponse = {
  choices?: Array<{ message?: { content?: string } }>;
};

function extractJson(content: string): unknown {
  const trimmed = content.trim();

  try {
    return JSON.parse(trimmed);
  } catch {
    const match = trimmed.match(/\{[\s\S]*\}/);
    if (!match) {
      throw new Error("AI did not return valid JSON.");
    }
    return JSON.parse(match[0]);
  }
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

function normalizeResponseShape(payload: unknown): unknown {
  if (!payload || typeof payload !== "object") {
    return payload;
  }

  const data = payload as Record<string, unknown>;

  const rawCauses = data.common_causes;
  const commonCauses = Array.isArray(rawCauses)
    ? rawCauses.map((item) => stringifyField(item)).filter(Boolean)
    : stringifyField(rawCauses)
        .split(/\n|,/)
        .map((item) => item.trim())
        .filter(Boolean);

  return {
    title: stringifyField(data.title),
    explanation: stringifyField(data.explanation),
    common_causes: commonCauses,
    fix: stringifyField(data.fix),
    code_example: stringifyField(data.code_example),
    eli5: stringifyField(data.eli5),
  };
}

export async function explainErrorWithAI(errorMessage: string): Promise<ExplainedError> {
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

  const prompt =
    "You are a senior software engineer. Explain the programming error and return JSON with fields: title, explanation, common_causes, fix, code_example, eli5.";

  const requestBody = {
    messages: [
      { role: "system" as const, content: prompt },
      {
        role: "user" as const,
        content: `Error message:\n${errorMessage}\n\nReturn strict JSON only.`,
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
