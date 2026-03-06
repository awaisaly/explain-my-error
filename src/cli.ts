import { access, readFile, writeFile } from "node:fs/promises";
import { createInterface } from "node:readline/promises";
import { Command } from "commander";
import pc from "picocolors";
import { runExplainCommand } from "./commands/explain.js";
import { logger } from "./utils/logger.js";

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
  runExplain?: (errorMessage: string) => Promise<void>;
  readStdin?: () => Promise<string>;
  promptForError?: () => Promise<string>;
  stdinIsTTY?: () => boolean;
  ensureApiKey?: () => Promise<boolean>;
  log?: CliLogger;
};

export async function runCli(argv: string[] = process.argv, deps: RunCliDeps = {}): Promise<void> {
  const runExplain = deps.runExplain ?? runExplainCommand;
  const readStdinFn = deps.readStdin ?? readStdin;
  const promptForErrorFn = deps.promptForError ?? promptForError;
  const stdinIsTTY = deps.stdinIsTTY ?? (() => Boolean(process.stdin.isTTY));
  const ensureApiKeyFn =
    deps.ensureApiKey ?? (deps.runExplain ? async () => true : ensureGroqApiKey);
  const log = deps.log ?? logger;

  const program = new Command();

  program
    .name("explain-my-error")
    .description("Explain programming errors with AI")
    .version("1.0.0")
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
`,
    );

  program
    .command("explain")
    .description("Explain a programming error message")
    .argument("[error...]", "Error message to analyze")
    .addHelpText(
      "after",
      `
Examples:
  $ explain-my-error explain "SyntaxError: Unexpected token }"
  $ eme explain "Module not found: Can't resolve 'axios'"
  $ cat error.txt | explain-my-error explain
`,
    )
    .action(async (errorParts: string[]) => {
      const inlineError = errorParts.join(" ").trim();
      const pipedError = inlineError ? "" : await readStdinFn();
      const promptedError = !inlineError && !pipedError ? await promptForErrorFn() : "";
      const finalError = inlineError || pipedError || promptedError;
      const hasApiKey = await ensureApiKeyFn();
      if (!hasApiKey) {
        log.warn("GROQ_API_KEY is required. Set it and run again.");
        return;
      }
      await runExplain(finalError);
    });

  program.action(async () => {
    if (stdinIsTTY()) {
      const promptedError = await promptForErrorFn();
      await runExplain(promptedError);
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

    await runExplain(pipedError);
  });

  await program.parseAsync(argv);
}
