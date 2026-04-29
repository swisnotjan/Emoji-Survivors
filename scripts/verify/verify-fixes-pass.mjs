import { chromium } from 'file:///C:/Users/san%20day/.codex/node_modules/playwright/index.mjs';
import fs from 'fs/promises';
import path from 'path';

const outDir = 'D:\tryings\vibecoding\Games\emoji-survivors/output/web-game/verify-fixes-pass';
await fs.mkdir(outDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1600, height: 960 } });
const gameUrl = 'file:///D:\tryings\vibecoding\Games\emoji-survivors/index.html';
const labUrl = 'file:///D:\tryings\vibecoding\Games\emoji-survivors/skill-lab.html';

async function snapshot() {
  return JSON.parse(await page.evaluate(() => window.render_game_to_text()));
}

await page.goto(gameUrl);
await page.evaluate(() => window.debug_game.unlockAllClasses());
await page.click('[data-class-id="frost"]');
await page.waitForTimeout(80);
await page.click('#startRunButton');
await page.waitForTimeout(150);
const frostState = await snapshot();
await page.screenshot({ path: path.join(outDir, 'frost-start.png') });

await page.keyboard.press('Escape');
await page.waitForTimeout(100);
await page.click('#pauseRestartButton');
await page.waitForTimeout(120);
const endRunState = await snapshot();
await page.screenshot({ path: path.join(outDir, 'end-run-summary.png') });

await page.goto(gameUrl);
await page.evaluate(() => {
  window.debug_game.unlockAllClasses();
  window.debug_game.selectClass('necro');
  window.debug_game.startRun();
  window.debug_game.setSpawningEnabled(false);
  const s = window.debug_game.snapshot();
  window.debug_game.spawnEnemyAt('grunt', s.player.x + 200, s.player.y, 1);
});
await page.waitForTimeout(420);
const necroCombat = await page.evaluate(() => window.debug_game.inspectCombat());
await page.screenshot({ path: path.join(outDir, 'necro-projectile.png') });

await page.evaluate(() => {
  window.debug_game.clearEnemies();
  window.debug_game.spawnBoss('countess');
});
await page.evaluate(() => window.advanceTime(4200));
await page.waitForTimeout(120);
const hostileCombat = await page.evaluate(() => window.debug_game.inspectCombat());
await page.screenshot({ path: path.join(outDir, 'hostile-purple.png') });

const fontSizes = await page.evaluate(() => ({
  hp: getComputedStyle(document.querySelector('.bar-head strong')).fontSize,
  time: getComputedStyle(document.getElementById('timeValue')).fontSize,
  xp: getComputedStyle(document.getElementById('xpValue')).fontSize,
  skillFillHeight: document.querySelector('[data-skill-slot="1"] .skill-fill').style.height,
}));

await page.goto(labUrl);
await page.waitForTimeout(1400);
const labState = await snapshot();
await page.click('#skillLabCast1');
await page.waitForTimeout(180);
await page.click('#skillLabCast2');
await page.waitForTimeout(180);
await page.click('#skillLabCast3');
await page.waitForTimeout(180);
await page.screenshot({ path: path.join(outDir, 'skill-lab.png') });
const labSnapshot = await snapshot();

const checks = {
  frostStartClass: frostState.class.id,
  endRunMode: endRunState.mode,
  endRunRunEndActive: endRunState.activeEffects?.includes?.('runEnd') ?? false,
  necroProjectileColors: necroCombat.projectiles.map((p) => p.color),
  hostileAttackColors: hostileCombat.enemyAttacks.map((a) => ({ kind: a.kind, color: a.color })),
  fontSizes,
  labMode: labState.mode,
  labEnemies: labState.enemiesOnField,
  labAfterCastMode: labSnapshot.mode,
  labAfterCastEnemies: labSnapshot.enemiesOnField,
};
await fs.writeFile(path.join(outDir, 'checks.json'), JSON.stringify(checks, null, 2));
await browser.close();
