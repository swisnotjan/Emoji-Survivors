import fs from "node:fs";
import path from "node:path";
import { chromium } from "file:///C:/Users/san%20day/.codex/node_modules/playwright/index.mjs";

const outDir = path.resolve("output/web-game/verify-world-features");
fs.mkdirSync(outDir, { recursive: true });
const url = "file:///D:/tryings/vibecoding/emoji-survivors/index.html";

function pickNearest(features, group) {
  const filtered = features.filter((feature) => feature.group === group);
  filtered.sort((a, b) => Math.hypot(a.x, a.y) - Math.hypot(b.x, b.y));
  return filtered[0] ?? null;
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto(url);
await page.waitForTimeout(250);

const features = await page.evaluate(() => window.debug_game.getNearbyFeatures(5000));
const water = pickNearest(features, "water");
const solid = pickNearest(features, "solid");
if (!water || !solid) {
  throw new Error(`Missing required feature groups. water=${!!water} solid=${!!solid}`);
}

const waterOffset = water.footprintRadius + 140;
await page.evaluate(({ water, waterOffset }) => {
  window.debug_game.setPlayerPosition(water.x - waterOffset, water.y);
}, { water, waterOffset });
await page.screenshot({ path: path.join(outDir, "water-scene.png"), fullPage: true });
const waterBefore = await page.evaluate(() => window.debug_game.snapshot());
await page.keyboard.down("KeyD");
await page.evaluate(() => window.advanceTime(900));
await page.keyboard.up("KeyD");
const waterAfterMove = await page.evaluate(() => window.debug_game.snapshot());
await page.evaluate(({ water, waterOffset }) => {
  window.debug_game.spawnEnemyAt("tank", water.x + waterOffset * 0.72, water.y, 1);
}, { water, waterOffset });
await page.evaluate(() => window.advanceTime(1400));
const waterAfterShots = await page.evaluate(() => window.debug_game.snapshot());
await page.screenshot({ path: path.join(outDir, "water-projectile.png"), fullPage: true });

await page.goto(url);
await page.waitForTimeout(250);
const features2 = await page.evaluate(() => window.debug_game.getNearbyFeatures(5000));
const solid2 = pickNearest(features2, "solid");
const solidOffset = solid2.footprintRadius + 130;
await page.evaluate(({ solid2, solidOffset }) => {
  window.debug_game.setPlayerPosition(solid2.x - solidOffset, solid2.y);
}, { solid2, solidOffset });
await page.screenshot({ path: path.join(outDir, "solid-scene.png"), fullPage: true });
const solidBefore = await page.evaluate(() => window.debug_game.snapshot());
await page.keyboard.down("KeyD");
await page.evaluate(() => window.advanceTime(900));
await page.keyboard.up("KeyD");
const solidAfterMove = await page.evaluate(() => window.debug_game.snapshot());
await page.evaluate(({ solid2, solidOffset }) => {
  window.debug_game.spawnEnemyAt("tank", solid2.x + solidOffset * 0.72, solid2.y, 1);
}, { solid2, solidOffset });
await page.evaluate(() => window.advanceTime(1400));
const solidAfterShots = await page.evaluate(() => window.debug_game.snapshot());
await page.screenshot({ path: path.join(outDir, "solid-projectile.png"), fullPage: true });

fs.writeFileSync(path.join(outDir, "checks.json"), JSON.stringify({
  features: { water, solid },
  waterBefore,
  waterAfterMove,
  waterAfterShots,
  solidBefore,
  solidAfterMove,
  solidAfterShots,
}, null, 2));

await browser.close();
