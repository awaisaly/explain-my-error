#!/usr/bin/env node
import "dotenv/config";
import { runCli } from "./cli.js";

runCli().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Unexpected CLI failure";
  process.stderr.write(`${message}\n`);
  process.exit(1);
});
