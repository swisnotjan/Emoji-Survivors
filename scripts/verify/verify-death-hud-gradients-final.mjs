import fs from "node:fs";
import path from "node:path";
import { chromium } from "file:///C:/Users/san%20day/.codex/node_modules/playwright/index.mjs";

const outDir = path.resolve("output/web-game/verify-death-hud-gradients-final");
fs.mkdirSync(outDir, { recursive: true });
const url = "file:///D:\tryings\vibecoding\Games\emoji-survivors/index.html";

const browser = await chromium.launch({ headless: true });

const page1 = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page1.goto(url);
await page1.waitForTimeout(700);
await page1.evaluate(() => window.debug_game.hitPlayer(999));
await page1.waitForTimeout(900);
const deathMid = await page1.evaluate(() => JSON.parse(window.render_game_to_text()));
await page1.screenshot({ path: path.join(outDir, "death-sequence.png"), fullPage: true });
await page1.waitForTimeout(1300);
const deathEnd = await page1.evaluate(() => JSON.parse(window.render_game_to_text()));
await page1.screenshot({ path: path.join(outDir, "death-summary.png"), fullPage: true });
await page1.close();

const page2 = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page2.goto(url);
await page2.waitForTimeout(700);
await page2.evaluate(() => window.debug_game.grantXp(112));
await page2.waitForTimeout(180);
await page2.keyboard.press("Digit2");
await page2.waitForTimeout(180);
const hudPulse = await page2.evaluate(() => ({
  hpCurrentAnim: getComputedStyle(document.getElementById('hpCurrent')).animationName,
  hpMaxAnim: getComputedStyle(document.getElementById('hpMax')).animationName,
  xpCurrentAnim: getComputedStyle(document.getElementById('xpCurrent')).animationName,
  xpMaxAnim: getComputedStyle(document.getElementById('xpMax')).animationName,
  timeAnim: getComputedStyle(document.getElementById('timeValue')).animationName,
}));
await page2.screenshot({ path: path.join(outDir, "holy-wave-english.png"), fullPage: true });
await page2.close();

const page3 = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page3.goto(url);
await page3.waitForTimeout(700);
await page3.evaluate(() => window.debug_game.grantXp(4137));
await page3.waitForTimeout(180);
const level10 = await page3.evaluate(() => JSON.parse(window.render_game_to_text()));
await page3.screenshot({ path: path.join(outDir, "level10-rays-terrain.png"), fullPage: true });
await page3.close();

fs.writeFileSync(path.join(outDir, "checks.json"), JSON.stringify({ deathMid, deathEnd, hudPulse, level10 }, null, 2));
await browser.close();
