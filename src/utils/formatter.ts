import pc from "picocolors";
import type { ExplainedError } from "../types/error.js";

const CARD_WIDTH = 72;

function line(char = "-"): string {
  return char.repeat(CARD_WIDTH);
}

function pad(text: string): string {
  return text.length > CARD_WIDTH - 4 ? `${text.slice(0, CARD_WIDTH - 7)}...` : text;
}

function framedLine(text: string): string {
  return `| ${pad(text).padEnd(CARD_WIDTH - 4)} |`;
}

function block(title: string, body: string): string {
  const rows = body.split("\n").map((row) => pc.white(row));
  return [pc.cyan(line()), pc.bold(pc.cyan(title)), ...rows, pc.cyan(line())].join("\n");
}

function list(items: string[]): string {
  return items.map((item, index) => `${index + 1}. ${item}`).join("\n");
}

export function formatExplainedError(result: ExplainedError): string {
  const commonCauses = list(result.common_causes);
  const hypotheses = result.hypotheses
    .map(
      (item, index) =>
        `${index + 1}. ${item.hypothesis}\n   confidence: ${(item.confidence * 100).toFixed(0)}%\n   why: ${item.why}`,
    )
    .join("\n\n");
  const fixPlans = result.fix_plans
    .map((plan) => {
      const label =
        plan.plan === "fast_patch"
          ? "Fast Patch"
          : plan.plan === "proper_fix"
            ? "Proper Fix"
            : "Long-Term Fix";
      return [
        `${pc.bold(pc.green(label))}: ${plan.summary}`,
        ...plan.steps.map((step, index) => `  ${index + 1}. ${step}`),
        `  tradeoffs -> risk: ${plan.tradeoffs.risk}; performance: ${plan.tradeoffs.performance}; maintainability: ${plan.tradeoffs.maintainability}`,
      ].join("\n");
    })
    .join("\n\n");
  const frameworkRecipes = result.framework_recipes
    .map((recipe) =>
      [
        `${pc.bold(pc.cyan(recipe.framework))}: ${recipe.when_to_use}`,
        ...recipe.steps.map((step, index) => `  ${index + 1}. ${step}`),
        "  snippet:",
        recipe.code_snippet
          .split("\n")
          .map((lineText) => `    ${lineText}`)
          .join("\n"),
      ].join("\n"),
    )
    .join("\n\n");
  const remediationBlocks = result.remediation_blocks
    .map((blockItem) => {
      const snippet = blockItem.snippet?.trim()
        ? `\n  snippet:\n${blockItem.snippet
            .split("\n")
            .map((lineText) => `    ${lineText}`)
            .join("\n")}`
        : "";
      return (
        [
          `${pc.bold(pc.green(blockItem.title))}`,
          ...blockItem.commands.map((command) => `  $ ${command}`),
        ].join("\n") + snippet
      );
    })
    .join("\n\n");
  const verifyChecklist = list(result.verify_checklist);
  const hero = [
    pc.cyan(line("=")),
    framedLine(pc.bold(pc.cyan("EXPLAIN MY ERROR"))),
    framedLine(pc.dim("AI powered debugging for humans")),
    pc.cyan(line("=")),
  ].join("\n");

  return [
    hero,
    "",
    `${pc.bold(pc.cyan("ERROR"))}: ${pc.bold(pc.white(result.title))}`,
    `${pc.bold(pc.yellow("LIKELY ROOT CAUSE"))}: ${pc.white(result.likely_root_cause)}`,
    "",
    block("EXPLANATION", result.explanation),
    "",
    block("COMMON CAUSES", commonCauses),
    "",
    block("HYPOTHESES (WITH CONFIDENCE)", hypotheses),
    "",
    block("RANKED FIX PLANS", fixPlans),
    "",
    `${pc.bold(pc.green("FIX"))}\n${pc.white(result.fix)}`,
    "",
    block("CODE EXAMPLE", result.code_example),
    "",
    block("FRAMEWORK-SPECIFIC RECIPES", frameworkRecipes),
    "",
    block("COPY-PASTE REMEDIATION", remediationBlocks),
    "",
    block("VERIFY CHECKLIST", verifyChecklist),
    "",
    block("ELI5", result.eli5),
    "",
    pc.dim('Tip: run `eme explain "<error>"` for quick mode.'),
  ].join("\n");
}
