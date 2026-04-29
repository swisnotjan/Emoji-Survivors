import fs from "node:fs";
import path from "node:path";
import { chromium, pageUrl, verifyOutputDir, repoRoot } from './playwright-loader.mjs';

const outDir = verifyOutputDir('verify-map-death-pass');
fs.mkdirSync(outDir, { recursive: true });
const url = pageUrl('index.html');

const browser = await chromium.launch({ headless: true });

const page1 = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page1.goto(url);
await page1.waitForTimeout(300);
const snap1 = await page1.evaluate(() => window.debug_game.snapshot());
const features1 = await page1.evaluate(() => window.debug_game.getNearbyFeatures(5000));
await page1.screenshot({ path: path.join(outDir, 'run-a.png'), fullPage: true });
await page1.close();

const page2 = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page2.goto(url);
await page2.waitForTimeout(300);
const snap2 = await page2.evaluate(() => window.debug_game.snapshot());
const features2 = await page2.evaluate(() => window.debug_game.getNearbyFeatures(5000));
await page2.screenshot({ path: path.join(outDir, 'run-b.png'), fullPage: true });
await page2.close();

const page3 = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page3.goto(url);
await page3.waitForTimeout(300);
const features3 = await page3.evaluate(() => window.debug_game.getNearbyFeatures(5000));
const water = features3.find((feature) => feature.group === 'water');
const rock = features3.find((feature) => feature.group === 'solid');
if (!water || !rock) throw new Error('Missing water or rock feature');
await page3.evaluate(({ water }) => window.debug_game.setPlayerPosition(water.x - water.footprintRadius - 120, water.y), { water });
await page3.keyboard.down('KeyD');
await page3.evaluate(() => window.advanceTime(900));
await page3.keyboard.up('KeyD');
const waterMove = await page3.evaluate(() => window.debug_game.snapshot());
await page3.evaluate(({ water }) => window.debug_game.spawnEnemyAt('tank', water.x + water.footprintRadius * 0.5, water.y, 1), { water });
await page3.evaluate(() => window.advanceTime(1200));
const waterShot = await page3.evaluate(() => window.debug_game.snapshot());
await page3.screenshot({ path: path.join(outDir, 'water-tiles.png'), fullPage: true });
await page3.close();

const page4 = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page4.goto(url);
await page4.waitForTimeout(300);
const features4 = await page4.evaluate(() => window.debug_game.getNearbyFeatures(5000));
const rock2 = features4.find((feature) => feature.group === 'solid');
await page4.evaluate(({ rock2 }) => window.debug_game.setPlayerPosition(rock2.x - rock2.footprintRadius - 100, rock2.y), { rock2 });
await page4.evaluate(({ rock2 }) => window.debug_game.spawnEnemyAt('tank', rock2.x + rock2.footprintRadius * 0.7, rock2.y, 1), { rock2 });
await page4.evaluate(() => window.advanceTime(1200));
const rockShot = await page4.evaluate(() => window.debug_game.snapshot());
await page4.screenshot({ path: path.join(outDir, 'rocks-block.png'), fullPage: true });
await page4.close();

const page5 = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page5.goto(url);
await page5.waitForTimeout(400);
await page5.evaluate(() => window.debug_game.hitPlayer(999));
await page5.waitForTimeout(1200);
const deathMid = await page5.evaluate(() => window.debug_game.snapshot());
await page5.screenshot({ path: path.join(outDir, 'death-mid.png'), fullPage: true });
await page5.waitForTimeout(2400);
const deathEnd = await page5.evaluate(() => window.debug_game.snapshot());
await page5.screenshot({ path: path.join(outDir, 'death-end.png'), fullPage: true });
await page5.close();

fs.writeFileSync(path.join(outDir, 'checks.json'), JSON.stringify({
  snap1,
  snap2,
  features1,
  features2,
  waterMove,
  waterShot,
  rockShot,
  deathMid,
  deathEnd
}, null, 2));

await browser.close();
