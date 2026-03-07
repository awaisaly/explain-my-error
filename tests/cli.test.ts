import { describe, expect, it } from "vitest";
import { runCli } from "../src/cli.ts";
import type { ExplainCommandOptions } from "../src/commands/explain.ts";

describe("CLI", () => {
  it("runs explain subcommand with inline error argument", async () => {
    const calls: string[] = [];

    await runCli(
      ["node", "explain-my-error", "explain", "ReferenceError:", "x", "is", "not", "defined"],
      {
        runExplain: async (errorMessage) => {
          calls.push(errorMessage);
        },
        readStdin: async () => "",
        promptForError: async () => "",
        stdinIsTTY: () => true,
      },
    );

    expect(calls).toEqual(["ReferenceError: x is not defined"]);
  });

  it("runs interactive prompt when no command is provided in tty mode", async () => {
    const calls: string[] = [];

    await runCli(["node", "explain-my-error"], {
      runExplain: async (errorMessage) => {
        calls.push(errorMessage);
      },
      promptForError: async () => "TypeError: Cannot read property 'map' of undefined",
      readStdin: async () => "",
      stdinIsTTY: () => true,
    });

    expect(calls).toEqual(["TypeError: Cannot read property 'map' of undefined"]);
  });

  it("uses piped input when no command is provided in non-tty mode", async () => {
    const calls: string[] = [];

    await runCli(["node", "explain-my-error"], {
      runExplain: async (errorMessage) => {
        calls.push(errorMessage);
      },
      readStdin: async () => "SyntaxError: Unexpected token }",
      promptForError: async () => "",
      stdinIsTTY: () => false,
    });

    expect(calls).toEqual(["SyntaxError: Unexpected token }"]);
  });

  it("warns when non-tty mode receives empty stdin", async () => {
    const warnings: string[] = [];
    let runCalled = false;

    await runCli(["node", "explain-my-error"], {
      runExplain: async () => {
        runCalled = true;
      },
      readStdin: async () => "",
      promptForError: async () => "",
      stdinIsTTY: () => false,
      log: {
        warn(message: string) {
          warnings.push(message);
        },
      },
    });

    expect(runCalled).toBe(false);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toMatch(/No input detected/);
  });

  it("passes context options and json output mode", async () => {
    const calls: Array<{ message: string; options?: ExplainCommandOptions }> = [];

    await runCli(
      [
        "node",
        "explain-my-error",
        "explain",
        "TypeError: boom",
        "--json",
        "--framework",
        "react",
        "--runtime",
        "node 20",
      ],
      {
        runExplain: async (errorMessage, options) => {
          calls.push({ message: errorMessage, options });
        },
        readStdin: async () => "",
        promptForError: async () => "",
        stdinIsTTY: () => true,
      },
    );

    expect(calls).toHaveLength(1);
    expect(calls[0].message).toBe("TypeError: boom");
    expect(calls[0].options?.output).toBe("json");
    expect(calls[0].options?.context?.framework).toBe("react");
    expect(calls[0].options?.context?.runtime).toBe("node 20");
  });
});
