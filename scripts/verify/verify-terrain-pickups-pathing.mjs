import { createRequire } from 'node:module';
import fs from 'node:fs/promises';
import path from 'node:path';

const require = createRequire(import.meta.url);
const { chromium, pageUrl, verifyOutputDir, repoRoot } = await import('./playwright-loader.mjs');

const root = repoRoot;
const outDir = verifyOutputDir('verify-terrain-pickups-pathing');
await fs.mkdir(outDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.goto(pageUrl('index.html'));
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

async function findFeature(group) {
  const probes = [
    [0, 0], [2500, 0], [-2500, 0], [0, 2500], [0, -2500],
    [3500, 2200], [-3500, -2200], [5600, 0], [0, 5600], [7000, 2800], [-7000, -2800]
  ];
  for (const [x, y] of probes) {
    await page.evaluate(([px, py]) => {
      window.debug_game.setPlayerPosition(px, py);
      window.advanceTime(120);
    }, [x, y]);
    const feature = await page.evaluate((targetGroup) => {
      const features = window.debug_game.getNearbyFeatures(3400);
      return features.find((entry) => entry.group === targetGroup) || null;
    }, group);
    if (feature) return feature;
  }
  return null;
}

const waterFeature = await findFeature('water');
if (waterFeature) {
  await page.evaluate((feature) => {
    window.debug_game.setPlayerPosition(feature.x + feature.footprintRadius + 120, feature.y);
    window.advanceTime(80);
  }, waterFeature);
  await capture('water-soft-a');
  await page.evaluate(() => window.advanceTime(1500));
  await capture('water-soft-b');
}

const rockFeature = await findFeature('solid');
if (rockFeature) {
  await page.evaluate((feature) => {
    window.debug_game.setPlayerPosition(feature.x + feature.footprintRadius + 150, feature.y + 20);
    window.advanceTime(80);
  }, rockFeature);
  await capture('rock-ruin-shape');
}

await page.evaluate(() => {
  window.debug_game.setPlayerPosition(0, 0);
  window.advanceTime(80);
  const snap = window.debug_game.snapshot();
  window.debug_game.spawnEnemyAt('grunt', snap.player.x + 165, snap.player.y, 1);
});
await page.evaluate(() => window.advanceTime(1200));
const xpDrop = await capture('xp-orb-count');

await page.evaluate(() => {
  window.debug_game.hitPlayer(26);
  window.debug_game.spawnHealPickup();
  window.advanceTime(60);
});
const healBefore = await page.evaluate(() => JSON.parse(window.render_game_to_text()));
const healPickup = healBefore.pickups.find((pickup) => pickup.type === 'heal');
if (healPickup) {
  await page.evaluate((pickup) => {
    window.debug_game.setPlayerPosition(pickup.x - 70, pickup.y);
    window.advanceTime(900);
  }, healPickup);
}
const healAfter = await capture('heal-absorb');

await page.evaluate(() => {
  window.debug_game.spawnXpPickup();
  window.advanceTime(60);
});
const cacheBefore = await page.evaluate(() => JSON.parse(window.render_game_to_text()));
const xpCache = cacheBefore.pickups.find((pickup) => pickup.type === 'xp-cache');
if (xpCache) {
  await page.evaluate((pickup) => {
    window.debug_game.setPlayerPosition(pickup.x - 95, pickup.y);
    window.advanceTime(900);
  }, xpCache);
}
const cacheAfter = await capture('xp-cache-absorb');

let pathing = null;
if (rockFeature) {
  pathing = await page.evaluate((feature) => {
    const playerX = feature.x - feature.footprintRadius - 150;
    const playerY = feature.y;
    window.debug_game.setPlayerPosition(playerX, playerY);
    window.debug_game.spawnEnemyAt('tank', feature.x + feature.footprintRadius + 130, feature.y, 1);
    window.advanceTime(120);
    const before = JSON.parse(window.render_game_to_text());
    const tankBefore = before.nearestEnemies.find((enemy) => enemy.type === 'tank');
    window.advanceTime(5200);
    const after = JSON.parse(window.render_game_to_text());
    const tankAfter = after.nearestEnemies.find((enemy) => enemy.type === 'tank');
    return {
      before: tankBefore,
      after: tankAfter,
      player: after.player,
    };
  }, rockFeature);
  await capture('ground-pathing');
}

let flying = null;
if (rockFeature && waterFeature) {
  flying = await page.evaluate(({ rock, water }) => {
    window.debug_game.setPlayerPosition(rock.x + rock.footprintRadius + 240, rock.y);
    window.debug_game.spawnEnemyAt('wraith', rock.x, rock.y, 1);
    window.advanceTime(1400);
    const afterRock = JSON.parse(window.render_game_to_text()).nearestEnemies.find((enemy) => enemy.type === 'wraith');

    window.debug_game.setPlayerPosition(water.x + water.footprintRadius + 220, water.y);
    window.debug_game.spawnEnemyAt('countess', water.x, water.y, 1);
    window.advanceTime(1000);
    const afterWater = JSON.parse(window.render_game_to_text()).activeBosses.find((enemy) => enemy.type === 'countess');
    return { afterRock, afterWater };
  }, { rock: rockFeature, water: waterFeature });
  await capture('flying-over-obstacles');
}

const checks = {
  waterFound: Boolean(waterFeature),
  rockFound: Boolean(rockFeature),
  xpOrbDropCount: xpDrop.pickups.filter((pickup) => pickup.type === 'xp-orb').length,
  healAfterHp: healAfter.player.hp,
  xpAfterCache: cacheAfter.xp,
  pathingBeforeDistance: pathing?.before ? Math.hypot(pathing.before.x - pathing.player.x, pathing.before.y - pathing.player.y) : null,
  pathingAfterDistance: pathing?.after ? Math.hypot(pathing.after.x - pathing.player.x, pathing.after.y - pathing.player.y) : null,
  flyingRock: flying?.afterRock ?? null,
  flyingWater: flying?.afterWater ?? null
};
await fs.writeFile(path.join(outDir, 'checks.json'), JSON.stringify(checks, null, 2));

await browser.close();
