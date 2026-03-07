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
    likely_root_cause: "Variable declaration path is skipped.",
    hypotheses: [
      {
        hypothesis: "Variable was never initialized.",
        confidence: 0.8,
        why: "ReferenceError usually indicates missing declaration.",
      },
      {
        hypothesis: "Typo in variable name.",
        confidence: 0.6,
        why: "Common in dynamic code paths.",
      },
    ],
    fix_plans: [
      {
        plan: "fast_patch",
        summary: "Guard and define a fallback.",
        steps: ["Define value before usage."],
        tradeoffs: {
          risk: "May hide broader issue.",
          performance: "Negligible.",
          maintainability: "Acceptable short-term.",
        },
      },
      {
        plan: "proper_fix",
        summary: "Fix initialization flow.",
        steps: ["Trace call path and initialize variable."],
        tradeoffs: {
          risk: "Medium.",
          performance: "Neutral.",
          maintainability: "Good.",
        },
      },
      {
        plan: "long_term_fix",
        summary: "Add stricter contracts.",
        steps: ["Enable stricter checks and tests."],
        tradeoffs: {
          risk: "Higher refactor cost.",
          performance: "Small overhead.",
          maintainability: "Excellent.",
        },
      },
    ],
    framework_recipes: [
      {
        framework: "Node.js",
        when_to_use: "General runtime",
        steps: ["Validate variable existence."],
        code_snippet: "const x = value ?? defaultValue;",
      },
    ],
    remediation_blocks: [
      {
        title: "Quick commands",
        commands: ["npm run test"],
      },
    ],
    verify_checklist: ["Run tests again."],
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

  it("prints JSON when json output mode is requested", async () => {
    const infos: string[] = [];

    await runExplainCommand(
      "ReferenceError: x is not defined",
      { output: "json" },
      {
        explainError: async () => createExplainedErrorFixture(),
        createSpinner: () => ({
          succeed() {},
          fail() {},
        }),
        log: {
          info(message: string) {
            infos.push(message);
          },
          warn() {},
          error() {},
        },
      },
    );

    expect(infos).toHaveLength(2);
    expect(infos[1]).toMatch(/"title": "ReferenceError: x is not defined"/);
    expect(infos[1]).toMatch(/"hypotheses"/);
  });
});
