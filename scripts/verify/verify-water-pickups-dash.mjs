import { createRequire } from 'node:module';
import fs from 'node:fs/promises';
import path from 'node:path';

const require = createRequire(import.meta.url);
const { chromium } = require('C:/Users/san day/.codex/node_modules/playwright');

const root = 'D:\tryings\vibecoding\Games\emoji-survivors';
const outDir = path.join(root, 'output/web-game/verify-water-pickups-dash');
await fs.mkdir(outDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.goto('file:///D:\tryings\vibecoding\Games\emoji-survivors/index.html');
await page.waitForTimeout(220);
await page.evaluate(() => window.advanceTime(500));

async function capture(name) {
  const pngPath = path.join(outDir, `${name}.png`);
  const jsonPath = path.join(outDir, `${name}.json`);
  await page.screenshot({ path: pngPath });
  const state = await page.evaluate(() => JSON.parse(window.render_game_to_text()));
  await fs.writeFile(jsonPath, JSON.stringify(state, null, 2));
  return state;
}

async function findWater() {
  const probes = [
    [0, 0], [2500, 0], [-2500, 0], [0, 2500], [0, -2500],
    [3500, 2200], [-3500, -2200], [5600, 0], [0, 5600], [7200, 2600], [-7200, -2600]
  ];
  for (const [x, y] of probes) {
    await page.evaluate(([px, py]) => {
      window.debug_game.setPlayerPosition(px, py);
      window.advanceTime(120);
    }, [x, y]);
    const feature = await page.evaluate(() => {
      const features = window.debug_game.getNearbyFeatures(3600);
      return features.find((entry) => entry.group === 'water') || null;
    });
    if (feature) return feature;
  }
  return null;
}

const water = await findWater();
if (water) {
  await page.evaluate((feature) => {
    window.debug_game.setPlayerPosition(feature.x + feature.footprintRadius + 120, feature.y);
    window.advanceTime(100);
  }, water);
  await capture('water-a');
  await page.evaluate(() => window.advanceTime(1500));
  await capture('water-b');
}

await page.evaluate(() => {
  window.debug_game.setPlayerPosition(0, 0);
  window.advanceTime(80);
  const snap = window.debug_game.snapshot();
  window.debug_game.spawnEnemyAt('runner', snap.player.x + 150, snap.player.y, 1);
});
await page.evaluate(() => window.advanceTime(1400));
const xpDrop = await capture('xp-one-orb');

await page.evaluate(() => {
  window.debug_game.hitPlayer(26);
  window.debug_game.spawnHealPickup();
  window.advanceTime(60);
});
const healBefore = await page.evaluate(() => JSON.parse(window.render_game_to_text()));
const healPickup = healBefore.pickups.find((pickup) => pickup.type === 'heal');
if (healPickup) {
  await page.evaluate((pickup) => {
    window.debug_game.setPlayerPosition(pickup.x - 50, pickup.y);
    window.advanceTime(650);
  }, healPickup);
}
const healAfter = await capture('heal-fast-absorb');

await page.evaluate(() => {
  window.debug_game.spawnXpPickup();
  window.advanceTime(60);
});
const cacheBefore = await page.evaluate(() => JSON.parse(window.render_game_to_text()));
const xpCache = cacheBefore.pickups.find((pickup) => pickup.type === 'xp-cache');
if (xpCache) {
  await page.evaluate((pickup) => {
    window.debug_game.setPlayerPosition(pickup.x - 70, pickup.y);
    window.advanceTime(700);
  }, xpCache);
}
const cacheAfter = await capture('xp-cache-fast-absorb');

await page.evaluate(() => {
  const snap = window.debug_game.snapshot();
  window.debug_game.setPlayerPosition(snap.player.x, snap.player.y);
});
await page.keyboard.down('Space');
await page.evaluate(() => window.advanceTime(200));
await page.keyboard.up('Space');
await page.evaluate(() => window.advanceTime(4800));
const dashPulse = await capture('dash-recharge-pulse');
const dashPulseActive = await page.evaluate(() => document.querySelector('#dashCharges .dash-charge.is-pulsing') !== null);

const checks = {
  waterFound: Boolean(water),
  solidsVisibleAfterUpdate: dashPulse.visibleFeatures.solids,
  xpOrbDropCount: xpDrop.pickups.filter((pickup) => pickup.type === 'xp-orb').length,
  healAfterHp: healAfter.player.hp,
  xpAfterCache: cacheAfter.xp,
  dashChargesAfterRecharge: dashPulse.player.dashCharges,
  dashPulseActive,
  fps: dashPulse.fps,
};
await fs.writeFile(path.join(outDir, 'checks.json'), JSON.stringify(checks, null, 2));

await browser.close();
