import pc from "picocolors";

export const logger = {
  info(message: string): void {
    process.stdout.write(`${pc.white(message)}\n`);
  },
  success(message: string): void {
    process.stdout.write(`${pc.green(`OK: ${message}`)}\n`);
  },
  warn(message: string): void {
    process.stderr.write(`${pc.yellow(`WARN: ${message}`)}\n`);
  },
  error(message: string): void {
    process.stderr.write(`${pc.red(`ERROR: ${message}`)}\n`);
  },
};
