import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";

const releaseType = process.argv[2] ?? "patch";
const validReleaseTypes = new Set(["patch", "minor", "major"]);

if (!validReleaseTypes.has(releaseType)) {
  console.error(`Invalid release type: ${releaseType}`);
  console.error("Use one of: patch, minor, major");
  process.exit(1);
}

function run(command) {
  execSync(command, { stdio: "inherit" });
}

run("pnpm run check");
run(`npm version ${releaseType} --no-git-tag-version`);
run("pnpm run format");

const packageJson = JSON.parse(readFileSync("package.json", "utf8"));
const version = packageJson.version;

run("git add package.json pnpm-lock.yaml");
run(`git commit -m "release: v${version}"`);
run(`git tag v${version}`);
run("git push --follow-tags");
