import { describe, expect, it } from "vitest";
import { runExplainCommand } from "../src/commands/explain.ts";
import type { ExplainedError } from "../src/types/error.ts";

function createExplainedErrorFixture(): ExplainedError {
  return {
    title: "ReferenceError: x is not defined",
    explanation: "A variable is being used before it exists in scope.",
    common_causes: ["Variable typo", "Missing declaration"],
    fix: "Declare x before using it.",
    code_example: "const x = 1;\nconsole.log(x);",
    eli5: "You asked for a toy before putting it in the box.",
  };
}

describe("runExplainCommand", () => {
  it("warns and exits when provided empty input", async () => {
    const warnings: string[] = [];
    let explainCalled = false;

    await runExplainCommand("   ", {
      explainError: async () => {
        explainCalled = true;
        return createExplainedErrorFixture();
      },
      createSpinner: () => ({
        succeed() {},
        fail() {},
      }),
      log: {
        info() {},
        warn(message: string) {
          warnings.push(message);
        },
        error() {},
      },
    });

    expect(explainCalled).toBe(false);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toMatch(/Please provide an error message/);
  });

  it("prints formatted output on successful explanation", async () => {
    const infos: string[] = [];
    const spinnerEvents: string[] = [];
    const fixture = createExplainedErrorFixture();

    await runExplainCommand("ReferenceError: x is not defined", {
      explainError: async () => fixture,
      createSpinner: () => ({
        succeed(text: string) {
          spinnerEvents.push(`success:${text}`);
        },
        fail(text: string) {
          spinnerEvents.push(`fail:${text}`);
        },
      }),
      formatOutput: (result) => `FORMATTED:${result.title}`,
      log: {
        info(message: string) {
          infos.push(message);
        },
        warn() {},
        error() {},
      },
    });

    expect(spinnerEvents).toEqual(["success:Explanation ready."]);
    expect(infos[0]).toBe("");
    expect(infos[1]).toBe("FORMATTED:ReferenceError: x is not defined");
  });

  it("reports failures from AI service", async () => {
    const errors: string[] = [];
    const spinnerEvents: string[] = [];

    await runExplainCommand("Some error", {
      explainError: async () => {
        throw new Error("network failed");
      },
      createSpinner: () => ({
        succeed(text: string) {
          spinnerEvents.push(`success:${text}`);
        },
        fail(text: string) {
          spinnerEvents.push(`fail:${text}`);
        },
      }),
      log: {
        info() {},
        warn() {},
        error(message: string) {
          errors.push(message);
        },
      },
    });

    expect(spinnerEvents).toEqual(["fail:Could not explain this error."]);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatch(/network failed/);
  });
});
