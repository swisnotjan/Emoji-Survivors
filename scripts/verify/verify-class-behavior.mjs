import { chromium } from 'file:///C:/Users/san%20day/.codex/node_modules/playwright/index.mjs';
import fs from 'fs/promises';
import path from 'path';

const outDir = 'D:\tryings\vibecoding\Games\emoji-survivors/output/web-game/verify-class-behavior';
await fs.mkdir(outDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const url = 'file:///D:\tryings\vibecoding\Games\emoji-survivors/index.html';

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

async function safeScreenshot(name) {
  try {
    await page.screenshot({ path: path.join(outDir, name), timeout: 5000 });
  } catch {
    // Verification relies on state assertions; screenshots are best-effort.
  }
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
  const gale = state.player.skills.find((skill) => skill.id === 'gale-ring');
  if (gale) {
    gale.unlocked = true;
    gale.timer = 0;
  }
  window.debug_game.clearEnemies();
  window.debug_game.spawnEnemyAt('tank', 170, 0, 1);
  window.debug_game.triggerSkill('gale-ring');
  state.enemyAttacks.push({
    kind: 'projectile',
    ownerType: 'test',
    x: 86,
    y: 0,
    vx: 120,
    vy: 0,
    radius: 10,
    damage: 6,
    life: 1.1,
    color: 'rgba(255, 0, 0, 0.9)',
    dead: false,
  });
  window.advanceTime(700);
});
checks.windAfterSkill = await readState();
await safeScreenshot('wind-skill.png');

await clearToStartMenu();
await startRunWithClass('frost');
await page.evaluate(() => {
  window.debug_game.clearEnemies();
  window.debug_game.spawnEnemyAt('tank', 160, 0, 1);
  window.advanceTime(40);
  const enemy = state.enemies[state.enemies.length - 1];
  enemy.brittleTimer = 3.2;
  const spear = state.player.skills.find((skill) => skill.id === 'crystal-spear');
  if (spear) {
    spear.unlocked = true;
    spear.timer = 0;
  }
  window.debug_game.triggerSkill('crystal-spear');
  window.advanceTime(380);
});
checks.frost = await readState();
await safeScreenshot('frost-passive.png');

await clearToStartMenu();
await startRunWithClass('fire');
await page.evaluate(() => {
  window.debug_game.clearEnemies();
  window.debug_game.spawnEnemyAt('tank', 140, 0, 1);
  window.advanceTime(650);
});
checks.fire = await readState();
await safeScreenshot('fire-passive.png');

await clearToStartMenu();
await startRunWithClass('necro');
await page.evaluate(() => {
  window.debug_game.clearEnemies();
  window.debug_game.spawnEnemyAt('tank', 240, 0, 1);
  window.advanceTime(40);
  for (const corpseIndex of [0, 1, 2, 3]) {
    state.corpses.push({ x: 40 + corpseIndex * 18, y: 20, type: 'grunt', life: 10, radius: 12 });
  }
  const grave = state.player.skills.find((skill) => skill.id === 'grave-call');
  if (grave) {
    grave.unlocked = true;
    grave.timer = 0;
  }
  window.debug_game.triggerSkill('grave-call');
  window.advanceTime(220);
});
checks.necro = await readState();
await safeScreenshot('necro-passive.png');

await clearToStartMenu();
await startRunWithClass('blood');
await page.evaluate(() => {
  window.debug_game.clearEnemies();
  window.debug_game.spawnEnemyAt('tank', 120, 0, 1);
  window.debug_game.spawnEnemyAt('tank', -120, 0, 1);
  const pool = state.player.skills.find((skill) => skill.id === 'crimson-pool');
  if (pool) {
    pool.unlocked = true;
    pool.timer = 0;
  }
  window.debug_game.triggerSkill('crimson-pool');
  window.advanceTime(240);
});
checks.blood = await readState();
await page.evaluate(() => {
  window.debug_game.clearEnemies();
  window.debug_game.spawnEnemyAt('tank', 140, 0, 1);
  const rite = state.player.skills.find((skill) => skill.id === 'blood-rite');
  if (rite) {
    rite.unlocked = true;
    rite.timer = 0;
  }
  const hpBefore = state.player.hp;
  window.debug_game.triggerSkill('blood-rite');
  window.advanceTime(120);
  window.__verifyBloodHpBefore = hpBefore;
});
checks.bloodAfterRite = await readState();
checks.bloodHpBeforeRite = await page.evaluate(() => window.__verifyBloodHpBefore);
await safeScreenshot('blood-passive.png');

const summary = {
  wind: {
    class: checks.wind.class.id,
    projectileDamage: checks.wind.player.projectileDamage,
    moveSpeed: checks.wind.player.moveSpeed,
    nearestStatuses: checks.wind.nearestEnemies[0]?.statuses ?? null,
    unlockedSkillsAfterLevel5: checks.windAfterSkill.player.unlockedSkills.map((skill) => skill.id),
    activeEffectsAfterSkill: checks.windAfterSkill.activeEffects,
    enemyProjectilesRemaining: checks.windAfterSkill.enemyAttacksOnField,
    windRushActive: checks.windAfterSkill.player.windRushActive,
  },
  frost: {
    class: checks.frost.class.id,
    projectileDamage: checks.frost.player.projectileDamage,
    nearestStatuses: checks.frost.nearestEnemies[0]?.statuses ?? null,
    freezeResist: checks.frost.nearestEnemies[0]?.freezeResist ?? null,
    lastCritActive: checks.frost.player.lastCritActive,
    lastCritSource: checks.frost.player.lastCritSource,
  },
  fire: {
    class: checks.fire.class.id,
    projectileDamage: checks.fire.player.projectileDamage,
    nearestStatuses: checks.fire.nearestEnemies[0]?.statuses ?? null,
    burnStacks: checks.fire.nearestEnemies[0]?.burnStacks ?? null,
  },
  necro: {
    class: checks.necro.class.id,
    projectileDamage: checks.necro.player.projectileDamage,
    projectilePierce: checks.necro.player.projectilePierce,
    maxHp: checks.necro.player.maxHp,
    alliesOnField: checks.necro.alliesOnField,
    siphonActive: checks.necro.player.necroSiphonActive,
  },
  blood: {
    class: checks.blood.class.id,
    projectileDamage: checks.blood.player.projectileDamage,
    maxHp: checks.blood.player.maxHp,
    hp: checks.blood.player.hp,
    damageReduction: checks.blood.player.damageReduction,
    nearestStatuses: checks.blood.nearestEnemies[0]?.statuses ?? null,
    hpBeforeRite: checks.bloodHpBeforeRite,
    hpAfterRite: checks.bloodAfterRite.player.hp,
    bloodRiteActive: checks.bloodAfterRite.player.bloodRiteActive,
    lastCritActive: checks.bloodAfterRite.player.lastCritActive,
  },
};

await fs.writeFile(path.join(outDir, 'checks.json'), JSON.stringify(summary, null, 2));
await browser.close();
