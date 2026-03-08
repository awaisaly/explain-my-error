import { access, readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { createInterface } from "node:readline/promises";
import { Command } from "commander";
import pc from "picocolors";
import { type ExplainCommandOptions, runExplainCommand } from "./commands/explain.js";
import type { ExplainContext } from "./types/error.js";
import { logger } from "./utils/logger.js";

const require = createRequire(import.meta.url);

function getCliVersion(): string {
  try {
    const pkg = require("../package.json") as { version?: string };
    return pkg.version ?? "0.0.0";
  } catch {
    return "0.0.0";
  }
}

async function readStdin(): Promise<string> {
  if (process.stdin.isTTY) {
    return "";
  }

  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString("utf8").trim();
}

async function safeReadText(filePath: string | undefined): Promise<string | undefined> {
  if (!filePath) {
    return undefined;
  }
  try {
    return await readFile(filePath, "utf8");
  } catch {
    return undefined;
  }
}

async function detectFrameworkFromPackageJson(): Promise<string | undefined> {
  try {
    const raw = await readFile("package.json", "utf8");
    const pkg = JSON.parse(raw) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    const deps = { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) };
    if ("next" in deps) return "Next.js";
    if ("react" in deps) return "React";
    if ("express" in deps) return "Express";
    if ("typescript" in deps) return "TypeScript";
    if ("fastify" in deps) return "Fastify";
    if ("nestjs" in deps || "@nestjs/core" in deps) return "NestJS";
  } catch {
    // Best-effort auto-detection.
  }
  return undefined;
}

type ExplainCliOptions = {
  json?: boolean;
  stack?: string;
  stackFile?: string;
  code?: string;
  codeFile?: string;
  runtime?: string;
  framework?: string;
};

async function buildExplainOptions(options: ExplainCliOptions): Promise<ExplainCommandOptions> {
  const stackFromFile = await safeReadText(options.stackFile);
  const codeFromFile = await safeReadText(options.codeFile);
  const detectedFramework = await detectFrameworkFromPackageJson();

  const context: ExplainContext = {
    stackTrace: options.stack ?? stackFromFile,
    codeSnippet: options.code ?? codeFromFile,
    runtime: options.runtime ?? `Node ${process.version}`,
    framework: options.framework ?? detectedFramework ?? "unknown",
  };

  return {
    output: options.json ? "json" : "pretty",
    context,
  };
}

async function promptForError(): Promise<string> {
  if (!process.stdin.isTTY) {
    return "";
  }

  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  try {
    logger.info(pc.cyan("Paste an error message and press Enter."));
    logger.info(pc.dim('Example: TypeError: Cannot read property "map" of undefined'));
    while (true) {
      const answer = await rl.question(pc.bold(pc.cyan("\n> Error message: ")));
      const trimmed = answer.trim();

      if (trimmed) {
        return trimmed;
      }

      logger.warn("Error message cannot be empty. Please try again.");
    }
  } finally {
    rl.close();
  }
}

async function promptForFollowUp(): Promise<string> {
  if (!process.stdin.isTTY) {
    return "";
  }

  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  try {
    const answer = await rl.question(
      pc.bold(pc.cyan("\n> Follow-up question (press Enter to finish): ")),
    );
    return answer.trim();
  } finally {
    rl.close();
  }
}

async function upsertEnvVar(filePath: string, key: string, value: string): Promise<void> {
  let existing = "";
  try {
    await access(filePath);
    existing = await readFile(filePath, "utf8");
  } catch {
    existing = "";
  }

  const envLine = `${key}=${value}`;
  const keyPattern = new RegExp(`^${key}=.*$`, "m");
  let nextContent: string;

  if (keyPattern.test(existing)) {
    nextContent = existing.replace(keyPattern, envLine);
  } else if (!existing.trim()) {
    nextContent = `${envLine}\n`;
  } else {
    const needsTrailingNewline = !existing.endsWith("\n");
    nextContent = `${existing}${needsTrailingNewline ? "\n" : ""}${envLine}\n`;
  }

  await writeFile(filePath, nextContent, "utf8");
}

async function ensureGroqApiKey(): Promise<boolean> {
  if (process.env.GROQ_API_KEY?.trim()) {
    return true;
  }

  if (!process.stdin.isTTY) {
    return false;
  }

  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  try {
    logger.warn("GROQ_API_KEY is missing.");
    logger.info(pc.cyan("Paste your Groq API key to continue."));

    while (true) {
      const key = (await rl.question(pc.bold(pc.cyan("\n> GROQ_API_KEY: ")))).trim();
      if (!key) {
        logger.warn("API key cannot be empty. Please try again.");
        continue;
      }

      process.env.GROQ_API_KEY = key;

      const saveAnswer = (
        await rl.question(pc.dim("Save this key to .env in current directory? (Y/n): "))
      )
        .trim()
        .toLowerCase();
      const shouldSave = saveAnswer === "" || saveAnswer === "y" || saveAnswer === "yes";

      if (shouldSave) {
        try {
          await upsertEnvVar(".env", "GROQ_API_KEY", key);
          logger.success("Saved GROQ_API_KEY to .env");
        } catch {
          logger.warn("Could not save key to .env, but this session will continue.");
        }
      }

      return true;
    }
  } finally {
    rl.close();
  }
}

type CliLogger = {
  warn(message: string): void;
};

type RunCliDeps = {
  runExplain?: (
    errorMessage: string,
    options?: ExplainCommandOptions,
  ) => Promise<{ title: string; likely_root_cause: string } | null | undefined>;
  readStdin?: () => Promise<string>;
  promptForError?: () => Promise<string>;
  promptForFollowUp?: () => Promise<string>;
  stdinIsTTY?: () => boolean;
  ensureApiKey?: () => Promise<boolean>;
  log?: CliLogger;
};

export async function runCli(argv: string[] = process.argv, deps: RunCliDeps = {}): Promise<void> {
  const runExplain = deps.runExplain ?? runExplainCommand;
  const readStdinFn = deps.readStdin ?? readStdin;
  const promptForErrorFn = deps.promptForError ?? promptForError;
  const promptForFollowUpFn =
    deps.promptForFollowUp ?? (deps.runExplain ? async () => "" : promptForFollowUp);
  const stdinIsTTY = deps.stdinIsTTY ?? (() => Boolean(process.stdin.isTTY));
  const ensureApiKeyFn =
    deps.ensureApiKey ?? (deps.runExplain ? async () => true : ensureGroqApiKey);
  const log = deps.log ?? logger;

  async function runInteractiveConversation(
    baseOptions: ExplainCommandOptions,
    initialPrompt?: string,
  ): Promise<void> {
    const history: Array<{ role: "user" | "assistant"; content: string }> = [];

    let currentPrompt = initialPrompt ?? (await promptForErrorFn());
    while (currentPrompt) {
      const result = await runExplain(currentPrompt, {
        ...baseOptions,
        context: {
          ...baseOptions.context,
          conversationHistory: history,
        },
      });

      if (result && typeof result === "object") {
        const title =
          "title" in result && typeof result.title === "string" ? result.title : "Analysis";
        const rootCause =
          "likely_root_cause" in result && typeof result.likely_root_cause === "string"
            ? result.likely_root_cause
            : "No root cause provided.";
        history.push({ role: "user", content: currentPrompt });
        history.push({ role: "assistant", content: `${title}. Root cause: ${rootCause}` });
      }

      const followUp = await promptForFollowUpFn();
      if (!followUp) {
        return;
      }
      currentPrompt = followUp;
    }
  }

  const program = new Command();

  program
    .name("explain-my-error")
    .description("Explain programming errors with AI")
    .version(getCliVersion())
    .addHelpText(
      "after",
      `
Input modes:
  1) Interactive (default)
     $ explain-my-error
     $ eme

  2) Inline argument
     $ explain-my-error explain "TypeError: Cannot read property 'map' of undefined"
     $ eme explain "ReferenceError: x is not defined"

  3) Pipe from files/commands
     $ cat error.txt | explain-my-error
     $ pnpm run build 2>&1 | eme

Power features:
  - Context-aware analysis: pass stack traces, code snippets, runtime, and framework.
  - Structured output: use --json for machine-readable responses.
  - Auto framework detection: best-effort detection from local package.json.
`,
    );

  program
    .command("explain")
    .description("Explain a programming error message")
    .argument("[error...]", "Error message to analyze")
    .option("--json", "Output structured JSON")
    .option("--stack <stackTrace>", "Additional stack trace context")
    .option("--stack-file <path>", "Read stack trace from a file")
    .option("--code <codeSnippet>", "Additional code snippet context")
    .option("--code-file <path>", "Read code snippet from a file")
    .option("--runtime <runtime>", "Runtime context (example: node 20, bun 1.1)")
    .option("--framework <framework>", "Framework context (example: react, nextjs, express)")
    .addHelpText(
      "after",
      `
Context options:
  --stack       inline stack trace text
  --stack-file  file path for stack trace
  --code        inline code snippet text
  --code-file   file path for code snippet
  --runtime     runtime label (default: current Node version)
  --framework   framework label (auto-detected when possible)

Output modes:
  default pretty output includes:
    - likely root cause
    - 2-3 hypotheses with confidence
    - ranked fix plans (fast/proper/long-term) with tradeoffs
    - framework-specific recipes
    - remediation commands and verify checklist

  --json output includes the same data in machine-readable JSON.

Examples:
  $ explain-my-error explain "SyntaxError: Unexpected token }"
  $ eme explain "Module not found: Can't resolve 'axios'"
  $ cat error.txt | explain-my-error explain
  $ eme explain "TypeError: Cannot read property 'map' of undefined" --framework react --runtime "node 20"
  $ eme explain --stack-file ./error.log --code-file ./src/app.ts --json
`,
    )
    .action(async (errorParts: string[], options: ExplainCliOptions) => {
      const inlineError = errorParts.join(" ").trim();
      const pipedError = inlineError ? "" : await readStdinFn();
      let apiKeyAlreadyValidated = false;
      if (!inlineError && !pipedError && stdinIsTTY()) {
        const hasApiKey = await ensureApiKeyFn();
        apiKeyAlreadyValidated = hasApiKey;
        if (!hasApiKey) {
          log.warn("GROQ_API_KEY is required. Set it and run again.");
          return;
        }
      }

      const promptedError = !inlineError && !pipedError ? await promptForErrorFn() : "";
      const finalError = inlineError || pipedError || promptedError;
      const explainOptions = await buildExplainOptions(options);
      if (!apiKeyAlreadyValidated) {
        const hasApiKey = await ensureApiKeyFn();
        if (!hasApiKey) {
          log.warn("GROQ_API_KEY is required. Set it and run again.");
          return;
        }
      }

      if (!inlineError && !pipedError && stdinIsTTY()) {
        await runInteractiveConversation(explainOptions, promptedError);
        return;
      }

      await runExplain(finalError, explainOptions);
    });

  program.action(async () => {
    if (stdinIsTTY()) {
      const hasApiKey = await ensureApiKeyFn();
      if (!hasApiKey) {
        log.warn("GROQ_API_KEY is required. Set it and run again.");
        return;
      }
      await runInteractiveConversation(await buildExplainOptions({}));
      return;
    }

    const pipedError = await readStdinFn();
    if (!pipedError) {
      log.warn('No input detected. Use: explain-my-error explain "<error message>"');
      return;
    }

    const hasApiKey = await ensureApiKeyFn();
    if (!hasApiKey) {
      log.warn("GROQ_API_KEY is required. Set it and run again.");
      return;
    }

    await runExplain(pipedError, await buildExplainOptions({}));
  });

  await program.parseAsync(argv);
}
