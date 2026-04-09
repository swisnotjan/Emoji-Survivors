import { chromium } from 'file:///C:/Users/san%20day/.codex/node_modules/playwright/index.mjs';
import fs from 'fs/promises';
import path from 'path';

const outDir = 'D:/tryings/vibecoding/emoji-survivors/output/web-game/verify-class-behavior';
await fs.mkdir(outDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const url = 'file:///D:/tryings/vibecoding/emoji-survivors/index.html';

async function readState() {
  return JSON.parse(await page.evaluate(() => window.render_game_to_text()));
}

async function startRunWithClass(classId) {
  await page.evaluate((targetClassId) => {
    window.debug_game.unlockAllClasses();
    window.debug_game.selectClass(targetClassId);
  }, classId);
  await page.waitForTimeout(120);
  await page.click('#startRunButton');
  await page.waitForTimeout(120);
  await page.evaluate(() => {
    window.debug_game.setSpawningEnabled(false);
    window.debug_game.clearEnemies();
  });
}

async function clearToStartMenu() {
  await page.reload();
  await page.waitForTimeout(120);
}

await page.goto(url);

const checks = {};

await startRunWithClass('wind');
await page.evaluate(() => {
  window.debug_game.clearEnemies();
  window.debug_game.spawnEnemyAt('tank', 140, 0, 1);
  window.advanceTime(800);
});
checks.wind = await readState();
await page.evaluate(() => window.debug_game.grantXp(449));
for (let i = 0; i < 4; i += 1) {
  await page.keyboard.press('Digit1');
  await page.waitForTimeout(90);
}
await page.evaluate(() => {
  window.debug_game.clearEnemies();
  window.debug_game.spawnEnemyAt('tank', 170, 0, 1);
  window.debug_game.triggerSkill('gale-ring');
  window.advanceTime(700);
});
checks.windAfterSkill = await readState();
await page.screenshot({ path: path.join(outDir, 'wind-skill.png') });

await clearToStartMenu();
await startRunWithClass('frost');
await page.evaluate(() => {
  window.debug_game.clearEnemies();
  window.debug_game.spawnEnemyAt('tank', 140, 0, 1);
  window.advanceTime(520);
});
checks.frost = await readState();
await page.screenshot({ path: path.join(outDir, 'frost-passive.png') });

await clearToStartMenu();
await startRunWithClass('fire');
await page.evaluate(() => {
  window.debug_game.clearEnemies();
  window.debug_game.spawnEnemyAt('tank', 140, 0, 1);
  window.advanceTime(520);
});
checks.fire = await readState();
await page.screenshot({ path: path.join(outDir, 'fire-passive.png') });

await clearToStartMenu();
await startRunWithClass('necro');
await page.evaluate(() => {
  window.debug_game.clearEnemies();
  window.debug_game.spawnEnemyAt('grunt', 130, 0, 1);
  window.advanceTime(1200);
});
checks.necro = await readState();
await page.screenshot({ path: path.join(outDir, 'necro-passive.png') });

await clearToStartMenu();
await startRunWithClass('blood');
await page.evaluate(() => {
  window.debug_game.hitPlayer(24);
  window.debug_game.clearEnemies();
  window.debug_game.spawnEnemyAt('tank', 140, 0, 1);
  window.advanceTime(900);
});
checks.blood = await readState();
await page.screenshot({ path: path.join(outDir, 'blood-passive.png') });

const summary = {
  wind: {
    class: checks.wind.class.id,
    projectileDamage: checks.wind.player.projectileDamage,
    speedExpectedBoost: checks.wind.class.id === 'wind',
    nearestStatuses: checks.wind.nearestEnemies[0]?.statuses ?? null,
    unlockedSkillsAfterLevel5: checks.windAfterSkill.player.unlockedSkills.map((skill) => skill.id),
    activeEffectsAfterSkill: checks.windAfterSkill.activeEffects,
  },
  frost: {
    class: checks.frost.class.id,
    projectileDamage: checks.frost.player.projectileDamage,
    nearestStatuses: checks.frost.nearestEnemies[0]?.statuses ?? null,
  },
  fire: {
    class: checks.fire.class.id,
    projectileDamage: checks.fire.player.projectileDamage,
    nearestStatuses: checks.fire.nearestEnemies[0]?.statuses ?? null,
  },
  necro: {
    class: checks.necro.class.id,
    projectileDamage: checks.necro.player.projectileDamage,
    projectilePierce: checks.necro.player.projectilePierce,
    maxHp: checks.necro.player.maxHp,
    alliesOnField: checks.necro.alliesOnField,
  },
  blood: {
    class: checks.blood.class.id,
    projectileDamage: checks.blood.player.projectileDamage,
    maxHp: checks.blood.player.maxHp,
    hp: checks.blood.player.hp,
    nearestStatuses: checks.blood.nearestEnemies[0]?.statuses ?? null,
  },
};

await fs.writeFile(path.join(outDir, 'checks.json'), JSON.stringify(summary, null, 2));
await browser.close();
