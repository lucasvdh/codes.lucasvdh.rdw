#!/usr/bin/env node
// Publishes a Draft from this machine, but only from a clean, tagged release commit that validates.
import { execFileSync, spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

function git(...args) {
  return execFileSync("git", args, { encoding: "utf8" }).trim();
}

function fail(message) {
  console.error(`publish: ${message}`);
  process.exit(1);
}

const { version } = JSON.parse(readFileSync(".homeycompose/app.json", "utf8"));
const tag = `v${version}`;

if (git("status", "--porcelain", "--untracked-files=normal") !== "") {
  fail("the working tree has changes or untracked files. Publish from a clean checkout of the release commit.");
}
if (!git("tag", "--points-at", "HEAD").split("\n").includes(tag)) {
  fail(`HEAD is not tagged ${tag}. Merge the release PR, tag the merge commit and check it out first.`);
}

const run = (cmd, args) => spawnSync(cmd, args, { stdio: "inherit", shell: process.platform === "win32" }).status;

if (run("npm", ["run", "homey-validate"]) !== 0) fail("validation failed.");

console.log(`\npublish: uploading ${tag} as a Draft. Answer "No" when the CLI offers to change the version.\n`);
process.exit(run("npx", ["homey", "app", "publish"]) ?? 1);
