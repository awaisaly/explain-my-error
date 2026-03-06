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

export function formatExplainedError(result: ExplainedError): string {
  const commonCauses = result.common_causes
    .map((cause, index) => pc.white(`${index + 1}. ${cause}`))
    .join("\n");
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
    "",
    block("EXPLANATION", result.explanation),
    "",
    block("COMMON CAUSES", commonCauses),
    "",
    `${pc.bold(pc.green("FIX"))}\n${pc.white(result.fix)}`,
    "",
    block("CODE EXAMPLE", result.code_example),
    "",
    block("ELI5", result.eli5),
    "",
    pc.dim('Tip: run `eme explain "<error>"` for quick mode.'),
  ].join("\n");
}
