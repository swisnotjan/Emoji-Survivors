import { chromium } from 'file:///C:/Users/san%20day/.codex/node_modules/playwright/index.mjs';
import fs from 'fs/promises';
import path from 'path';

const outDir = 'D:/tryings/vibecoding/emoji-survivors/output/web-game/verify-soft-vfx-lab-pass';
await fs.mkdir(outDir, { recursive: true });
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1600, height: 960 } });

await page.goto('file:///D:/tryings/vibecoding/emoji-survivors/skill-lab.html');
await page.waitForTimeout(1400);
const initial = JSON.parse(await page.evaluate(() => window.render_game_to_text()));
await page.click('[data-skill-slot="1"]');
await page.waitForTimeout(120);
await page.click('[data-skill-slot="2"]');
await page.waitForTimeout(160);
await page.click('[data-skill-slot="3"]');
await page.waitForTimeout(260);
const afterCast = JSON.parse(await page.evaluate(() => window.render_game_to_text()));
await page.screenshot({ path: path.join(outDir, 'lab-manual-casts.png') });

await page.click('#skillLabSpawnDummy');
await page.waitForTimeout(120);
const afterExtraDummy = JSON.parse(await page.evaluate(() => window.render_game_to_text()));
await page.screenshot({ path: path.join(outDir, 'lab-extra-dummy.png') });

await page.goto('file:///D:/tryings/vibecoding/emoji-survivors/index.html');
await page.waitForTimeout(120);
await page.evaluate(() => { window.debug_game.unlockAllClasses(); window.debug_game.selectClass('fire'); window.debug_game.startRun(); window.debug_game.setSpawningEnabled(false); window.debug_game.grantXp(1000); });
await page.waitForTimeout(200);
await page.evaluate(() => window.advanceTime(800));
await page.waitForTimeout(180);
const holyState = JSON.parse(await page.evaluate(() => window.render_game_to_text()));
await page.screenshot({ path: path.join(outDir, 'holy-wave-smooth.png') });

const checks = {
  initialMode: initial.mode,
  initialSkillTimers: initial.player.unlockedSkills.map((s) => s.timer),
  initialActiveEffects: initial.activeEffects,
  afterCastEffects: afterCast.activeEffects,
  afterCastEnemies: afterCast.enemiesOnField,
  afterExtraDummyEnemies: afterExtraDummy.enemiesOnField,
  manualSkillMode: afterCast.dev.manualSkillMode,
  holyEffects: holyState.activeEffects,
};
await fs.writeFile(path.join(outDir, 'checks.json'), JSON.stringify(checks, null, 2));
await browser.close();
