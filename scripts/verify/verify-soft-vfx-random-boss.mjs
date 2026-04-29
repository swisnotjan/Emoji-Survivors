import { chromium } from 'file:///C:/Users/san%20day/.codex/node_modules/playwright/index.mjs';
import fs from 'fs/promises';
import path from 'path';

const outDir = 'D:\tryings\vibecoding\Games\emoji-survivors/output/web-game/verify-soft-vfx-random-boss';
await fs.mkdir(outDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1600, height: 960 } });
const gameUrl = 'file:///D:\tryings\vibecoding\Games\emoji-survivors/index.html';
const labUrl = 'file:///D:\tryings\vibecoding\Games\emoji-survivors/skill-lab.html';

async function snapshot() {
  return JSON.parse(await page.evaluate(() => window.render_game_to_text()));
}

await page.goto(labUrl);
await page.waitForTimeout(1200);
const passiveUi = await page.evaluate(() => ({
  passiveCdDisplay: getComputedStyle(document.querySelector('[data-skill-panel="passive"] .skill-cd')).display,
  passiveFillDisplay: getComputedStyle(document.querySelector('[data-skill-panel="passive"] .skill-card-fill')).display,
}));
await page.click('#skillLabCast1');
await page.waitForTimeout(120);
await page.click('#skillLabCast2');
await page.waitForTimeout(150);
await page.click('#skillLabCast3');
await page.waitForTimeout(260);
const labState = await snapshot();
await page.screenshot({ path: path.join(outDir, 'skill-lab-soft-vfx.png') });

await page.goto(gameUrl);
await page.evaluate(() => {
  window.debug_game.unlockAllClasses();
  window.debug_game.selectClass('fire');
  window.debug_game.startRun();
  window.debug_game.setSpawningEnabled(false);
  const snap = window.debug_game.snapshot();
  window.debug_game.spawnEnemyAt('grunt', snap.player.x + 110, snap.player.y, 1);
});
await page.waitForTimeout(2600);
const firePickupState = await snapshot();
await page.screenshot({ path: path.join(outDir, 'fire-pickup-collect.png') });

const randomBosses = [];
for (let i = 0; i < 6; i += 1) {
  await page.goto(gameUrl);
  await page.evaluate(() => {
    window.debug_game.startRun();
    window.debug_game.setSpawningEnabled(false);
  });
  await page.evaluate(() => window.advanceTime(125000));
  const state = await snapshot();
  randomBosses.push(state.activeBosses[0]?.type ?? null);
}

const checks = {
  passiveUi,
  labEffects: labState.activeEffects,
  fireClass: firePickupState.class.id,
  firePickupTypes: firePickupState.pickups.map((pickup) => pickup.type),
  firePickupEffects: firePickupState.activeEffects,
  randomBosses,
  randomBossUniqueCount: new Set(randomBosses.filter(Boolean)).size,
};
await fs.writeFile(path.join(outDir, 'checks.json'), JSON.stringify(checks, null, 2));
await browser.close();
