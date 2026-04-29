import { chromium } from 'file:///C:/Users/san%20day/.codex/node_modules/playwright/index.mjs';
import fs from 'fs/promises';
import path from 'path';

const outDir = 'D:\tryings\vibecoding\Games\emoji-survivors/output/web-game/verify-ui-skill-pass';
await fs.mkdir(outDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1600, height: 960 } });
const url = 'file:///D:\tryings\vibecoding\Games\emoji-survivors/index.html';

async function readState() {
  return JSON.parse(await page.evaluate(() => window.render_game_to_text()));
}

async function chooseUntilRunning(maxSteps = 20) {
  for (let i = 0; i < maxSteps; i += 1) {
    const state = await readState();
    if (state.mode === 'running') {
      return state;
    }
    if (state.mode === 'level_up') {
      await page.keyboard.press('Digit1');
      await page.waitForTimeout(90);
      continue;
    }
    if (state.mode === 'boss_reward') {
      await page.keyboard.press('Digit1');
      await page.waitForTimeout(90);
      continue;
    }
    return state;
  }
  return readState();
}

async function startRunFor(classId) {
  await page.evaluate((selectedClassId) => {
    window.debug_game.unlockAllClasses();
    window.debug_game.selectClass(selectedClassId);
  }, classId);
  await page.waitForTimeout(80);
  await page.click('#startRunButton');
  await page.waitForTimeout(180);
  await page.evaluate(() => {
    window.debug_game.setSpawningEnabled(false);
    window.debug_game.clearEnemies();
  });
  await page.waitForTimeout(60);
}

async function prepareSkillShowcase(classId) {
  await startRunFor(classId);
  await page.evaluate(() => {
    const state = JSON.parse(window.render_game_to_text());
    window.debug_game.spawnEnemyAt('grunt', state.player.x + 180, state.player.y, 5);
    window.debug_game.spawnEnemyAt('runner', state.player.x + 220, state.player.y + 60, 3);
    window.debug_game.grantXp(16000);
  });
  await page.waitForTimeout(120);
  await chooseUntilRunning(64);
  await page.waitForTimeout(100);
}

await page.goto(url);
await page.evaluate(() => window.debug_game.unlockAllClasses());
await page.screenshot({ path: path.join(outDir, 'start-overlay.png') });

await startRunFor('wind');
await page.evaluate(() => window.debug_game.grantXp(700));
await page.waitForTimeout(120);
await chooseUntilRunning(8);
await page.screenshot({ path: path.join(outDir, 'wind-skill-hud.png') });
await page.hover('[data-skill-slot="1"]');
await page.waitForTimeout(120);
await page.screenshot({ path: path.join(outDir, 'wind-skill-tooltip.png') });
const tooltipVisible = await page.evaluate(() => !document.getElementById('skillTooltip').classList.contains('is-hidden'));

await page.evaluate(() => window.debug_game.grantXp(1700));
await page.waitForTimeout(120);
for (let i = 0; i < 16; i += 1) {
  const state = await readState();
  if (state.mode === 'level_up' && state.levelUpOptions.length === 2) {
    break;
  }
  if (state.mode === 'level_up') {
    await page.keyboard.press('Digit1');
    await page.waitForTimeout(90);
    continue;
  }
  await page.waitForTimeout(80);
}
await page.screenshot({ path: path.join(outDir, 'major-choice.png') });
const majorColumns = await page.evaluate(() => window.getComputedStyle(document.getElementById('upgradeOptions')).gridTemplateColumns);
await chooseUntilRunning(12);

for (const classId of ['wind', 'frost', 'fire', 'necro', 'blood']) {
  await startRunFor(classId);
  await page.screenshot({ path: path.join(outDir, `class-${classId}-base.png`) });
  await prepareSkillShowcase(classId);
  await page.evaluate(() => {
    window.debug_game.triggerSkill(1);
    window.debug_game.triggerSkill(2);
    window.debug_game.triggerSkill(3);
  });
  await page.waitForTimeout(180);
  await page.screenshot({ path: path.join(outDir, `class-${classId}.png`) });
}

await startRunFor('fire');
await page.evaluate(() => {
  const state = JSON.parse(window.render_game_to_text());
  window.debug_game.spawnEnemyAt('tank', state.player.x + 180, state.player.y, 1);
});
await page.waitForTimeout(400);
await page.screenshot({ path: path.join(outDir, 'fire-projectile-color.png') });

await startRunFor('wind');
await page.evaluate(() => window.debug_game.hitPlayer(999));
await page.waitForTimeout(1250);
await page.screenshot({ path: path.join(outDir, 'death-killcam.png') });

const checks = {
  finalState: await readState(),
  skillTooltipVisible: tooltipVisible,
  skillHudCards: await page.evaluate(() => Array.from(document.querySelectorAll('#skillHud .skill-card')).map((node) => ({
    slot: node.getAttribute('data-skill-slot') || 'passive',
    cooldown: node.querySelector('.skill-cd')?.textContent ?? '',
    width: window.getComputedStyle(node).width,
    height: window.getComputedStyle(node).height,
  }))),
  hpCurrentSize: await page.evaluate(() => window.getComputedStyle(document.getElementById('hpCurrent')).fontSize),
  xpCurrentSize: await page.evaluate(() => window.getComputedStyle(document.getElementById('xpCurrent')).fontSize),
  majorColumns,
};

await fs.writeFile(path.join(outDir, 'checks.json'), JSON.stringify(checks, null, 2));
await browser.close();
