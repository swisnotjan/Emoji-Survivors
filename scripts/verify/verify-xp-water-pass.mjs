import { createRequire } from 'node:module';
import fs from 'node:fs/promises';
import path from 'node:path';

const require = createRequire(import.meta.url);
const { chromium } = require('C:/Users/san day/.codex/node_modules/playwright');

const root = 'D:\tryings\vibecoding\Games\emoji-survivors';
const outDir = path.join(root, 'output/web-game/verify-xp-water-pass');
await fs.mkdir(outDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.goto('file:///D:\tryings\vibecoding\Games\emoji-survivors/index.html');
await page.waitForTimeout(250);
await page.evaluate(() => window.advanceTime(500));

async function capture(name) {
  const pngPath = path.join(outDir, `${name}.png`);
  const jsonPath = path.join(outDir, `${name}.json`);
  await page.screenshot({ path: pngPath });
  const state = await page.evaluate(() => JSON.parse(window.render_game_to_text()));
  await fs.writeFile(jsonPath, JSON.stringify(state, null, 2));
  return state;
}

async function findFeature(group) {
  const probes = [
    [0, 0], [2500, 0], [-2500, 0], [0, 2500], [0, -2500],
    [3500, 2200], [-3500, -2200], [5600, 0], [0, 5600]
  ];
  for (const [x, y] of probes) {
    await page.evaluate(([px, py]) => {
      window.debug_game.setPlayerPosition(px, py);
      window.advanceTime(100);
    }, [x, y]);
    const feature = await page.evaluate((targetGroup) => {
      const features = window.debug_game.getNearbyFeatures(3200);
      return features.find((entry) => entry.group === targetGroup) || null;
    }, group);
    if (feature) {
      return feature;
    }
  }
  return null;
}

const waterFeature = await findFeature('water');
if (waterFeature) {
  await page.evaluate((feature) => {
    window.debug_game.setPlayerPosition(feature.x + feature.footprintRadius + 120, feature.y);
    window.advanceTime(80);
  }, waterFeature);
  await capture('water-ripple-a');
  await page.evaluate(() => window.advanceTime(1200));
  await capture('water-ripple-b');
}

const rockFeature = await findFeature('solid');
if (rockFeature) {
  await page.evaluate((feature) => {
    window.debug_game.setPlayerPosition(feature.x + feature.footprintRadius + 140, feature.y + 40);
    window.advanceTime(80);
  }, rockFeature);
  await capture('rock-slabs');
}

await page.evaluate(() => {
  window.debug_game.setPlayerPosition(0, 0);
  window.advanceTime(80);
  const snap = window.debug_game.snapshot();
  window.debug_game.spawnEnemyAt('grunt', snap.player.x + 160, snap.player.y, 1);
});
await page.evaluate(() => window.advanceTime(2400));
const xpDrop = await capture('xp-orbs-drop');

const firstOrb = xpDrop.pickups.find((pickup) => pickup.type === 'xp-orb');
if (firstOrb) {
  await page.evaluate((pickup) => {
    window.debug_game.setPlayerPosition(pickup.x - 48, pickup.y);
    window.advanceTime(600);
  }, firstOrb);
}
const xpCollect = await capture('xp-orbs-collect');

await page.evaluate(() => {
  window.debug_game.spawnBoss('countess');
  window.advanceTime(100);
  window.debug_game.damageBoss(999999);
});
const bossXp = await capture('boss-xp-drop');

const checks = {
  waterFound: Boolean(waterFeature),
  solidFound: Boolean(rockFeature),
  xpOrbDropCount: xpDrop.pickups.filter((pickup) => pickup.type === 'xp-orb').length,
  xpAfterCollect: xpCollect.xp,
  bossXpOrbCount: bossXp.pickups.filter((pickup) => pickup.type === 'xp-orb').length,
  bossXpCacheCount: bossXp.pickups.filter((pickup) => pickup.type === 'xp-cache').length,
  bossMode: bossXp.mode,
  bossRewardOptions: bossXp.bossRewardOptions.length
};
await fs.writeFile(path.join(outDir, 'checks.json'), JSON.stringify(checks, null, 2));

await browser.close();
