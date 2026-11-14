import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

const ROOT = join(__dirname, "..", "..");
const DRIVERS = join(ROOT, "drivers");

function drivers(): string[] {
  return readdirSync(DRIVERS).filter((d) => existsSync(join(DRIVERS, d, "driver.compose.json")));
}

function methodBody(source: string, name: string): string | undefined {
  const start = source.search(new RegExp(`async ${name}\\(`));
  if (start === -1) return undefined;
  const open = source.indexOf("{", start);
  let depth = 0;
  for (let i = open; i < source.length; i++) {
    if (source[i] === "{") depth++;
    if (source[i] === "}" && --depth === 0) return source.slice(open + 1, i);
  }
  return undefined;
}

describe("Homey wiring", () => {
  for (const driver of drivers()) {
    it(`${driver}: onUninit and onDeleted share one teardown`, () => {
      const source = readFileSync(join(DRIVERS, driver, "device.ts"), "utf8");
      const onUninit = methodBody(source, "onUninit");
      if (onUninit === undefined) return;

      const onDeleted = methodBody(source, "onDeleted");
      assert.ok(onDeleted !== undefined, "a device that cleans up in onUninit must clean up in onDeleted too");
      assert.match(onUninit, /this\.teardown\(\)/);
      assert.match(onDeleted, /this\.teardown\(\)/);
    });
  }
});
