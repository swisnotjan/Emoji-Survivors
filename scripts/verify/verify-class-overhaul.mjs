import { chromium } from 'file:///C:/Users/san%20day/.codex/node_modules/playwright/index.mjs';
import fs from 'fs/promises';
import path from 'path';

const outDir = 'D:\tryings\vibecoding\Games\emoji-survivors/output/web-game/verify-class-overhaul';
await fs.mkdir(outDir, { recursive: true });
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const url = 'file:///D:\tryings\vibecoding\Games\emoji-survivors/index.html';

async function pickOption(index = 1, waitMs = 120) {
  await page.keyboard.press(`Digit${index}`);
  await page.waitForTimeout(waitMs);
}

await page.goto(url);
await page.screenshot({ path: path.join(outDir, 'start-overlay.png') });
const startMode = JSON.parse(await page.evaluate(() => window.render_game_to_text()));
await page.click('#startRunButton');
await page.waitForTimeout(250);
const afterStart = JSON.parse(await page.evaluate(() => window.render_game_to_text()));
await page.evaluate(() => window.debug_game.grantXp(449));
await page.waitForTimeout(100);
await pickOption(1);
await pickOption(1);
await pickOption(1);
const skillUnlockState = JSON.parse(await page.evaluate(() => window.render_game_to_text()));
await page.screenshot({ path: path.join(outDir, 'level5-skill-hud.png') });
await page.evaluate(() => window.debug_game.grantXp(1434));
await page.waitForTimeout(120);
await pickOption(1);
await pickOption(1);
await pickOption(1);
await pickOption(1);
const level10 = JSON.parse(await page.evaluate(() => window.render_game_to_text()));
await page.screenshot({ path: path.join(outDir, 'level10-major.png') });
await pickOption(1);
await page.keyboard.press('Tab');
await page.waitForTimeout(120);
const codexState = JSON.parse(await page.evaluate(() => window.render_game_to_text()));
await page.screenshot({ path: path.join(outDir, 'codex-open.png') });
const codexUi = await page.evaluate(() => ({
  kickers: Array.from(document.querySelectorAll('.upgrade-group-head')).map((node) => node.textContent.trim()),
  hpCurrentSize: window.getComputedStyle(document.getElementById('hpCurrent')).fontSize,
  hpMaxSize: window.getComputedStyle(document.getElementById('hpMax')).fontSize,
  xpCurrentSize: window.getComputedStyle(document.getElementById('xpCurrent')).fontSize,
  xpMaxSize: window.getComputedStyle(document.getElementById('xpMax')).fontSize,
  skillCards: Array.from(document.querySelectorAll('[data-skill-slot]')).map((node) => ({
    slot: node.getAttribute('data-skill-slot'),
    locked: node.classList.contains('locked'),
    ready: node.classList.contains('ready'),
    cooldown: node.querySelector('.skill-cd')?.textContent ?? '',
    status: node.querySelector('.skill-status')?.textContent ?? '',
  })),
}));
await page.keyboard.press('Backquote');
await page.waitForTimeout(120);
const devMenuState = JSON.parse(await page.evaluate(() => window.render_game_to_text()));
await page.screenshot({ path: path.join(outDir, 'dev-menu-open.png') });
const checks = {
  startMode: startMode.mode,
  selectedClass: startMode.meta.selectedClassId,
  afterStartMode: afterStart.mode,
  skillUnlockMode: skillUnlockState.mode,
  unlockedSkillsAfterLevel5: skillUnlockState.player.unlockedSkills.map((skill) => skill.id),
  level10Mode: level10.mode,
  level10OptionCount: level10.levelUpOptions.length,
  level10OptionTitles: level10.levelUpOptions.map((option) => option.title),
  codexMode: codexState.mode,
  devMenuMode: devMenuState.mode,
  devMenuOpen: devMenuState.dev.devMenuOpen,
  codexUi,
};
await fs.writeFile(path.join(outDir, 'checks.json'), JSON.stringify(checks, null, 2));
await browser.close();
