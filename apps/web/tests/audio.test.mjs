import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  SOUND_CONFIG,
  SOUND_FILES,
  getSoundVolume,
} from "../src/platform/audio/config.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");

test("Sound Config: includes required sound keys with valid percentage ranges (0 - 100)", () => {
  const expectedKeys = ["buttonClick", "dropBall", "tileBreak"];
  for (const key of expectedKeys) {
    assert.ok(key in SOUND_CONFIG, `Missing expected sound key: ${key}`);
    const val = SOUND_CONFIG[key];
    assert.equal(typeof val, "number", `${key} volume must be a number`);
    assert.ok(val >= 0 && val <= 100, `${key} volume must be between 0 and 100`);
  }
});

test("Sound Config: volume conversion correctly scales percentages (0 - 100) to (0.0 - 1.0)", () => {
  assert.equal(getSoundVolume("buttonClick"), SOUND_CONFIG.buttonClick / 100);
  assert.equal(getSoundVolume("dropBall"), SOUND_CONFIG.dropBall / 100);
  assert.equal(getSoundVolume("tileBreak"), SOUND_CONFIG.tileBreak / 100);

  // Default values check
  assert.equal(SOUND_CONFIG.buttonClick, 60);
  assert.equal(getSoundVolume("buttonClick"), 0.6);

  assert.equal(SOUND_CONFIG.dropBall, 70);
  assert.equal(getSoundVolume("dropBall"), 0.7);

  assert.equal(SOUND_CONFIG.tileBreak, 50);
  assert.equal(getSoundVolume("tileBreak"), 0.5);
});

test("Sound Files: maps every effect to an existing physical audio file in public/", () => {
  for (const [key, url] of Object.entries(SOUND_FILES)) {
    assert.ok(url.startsWith("/audio/"), `Audio URL ${url} must start with /audio/`);
    const filePath = path.join(projectRoot, "public", url.slice(1));
    assert.ok(
      fs.existsSync(filePath),
      `Audio file for ${key} must exist at ${filePath}`
    );
    const stats = fs.statSync(filePath);
    assert.ok(stats.size > 0, `Audio file for ${key} must not be empty`);
  }
});
