import { chromium, pageUrl, verifyOutputDir, repoRoot } from './playwright-loader.mjs';
import fs from 'fs/promises';
import path from 'path';
import http from 'http';
import { spawn } from 'child_process';

const root = repoRoot;
const outDir = verifyOutputDir('verify-class-boss-focus');
await fs.mkdir(outDir, { recursive: true });

const server = spawn(process.execPath, [path.join(root, 'scripts/serve-static.mjs')], {
  cwd: root,
  stdio: 'ignore',
});

async function waitForServer(timeoutMs = 10000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      await new Promise((resolve, reject) => {
        const req = http.get('http://localhost:4173/index.html', (res) => {
          res.resume();
          resolve();
        });
        req.on('error', reject);
      });
      return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 120));
    }
  }
  throw new Error('Timed out waiting for local server');
}

await waitForServer();
const browser = await chromium.launch({ headless: true });

async function captureStartOverlay() {
  const page = await browser.newPage({ viewport: { width: 1600, height: 960 } });
  await page.addInitScript(() => {
    localStorage.removeItem('emoji-survivors-meta-v2');
  });
  await page.goto(pageUrl('index.html'));
  await page.waitForTimeout(120);
  const lockedCards = await page.evaluate(() => Array.from(document.querySelectorAll('.class-card.is-locked')).map((card) => ({
    classId: card.dataset.classId,
    requirementIcon: card.querySelector('.class-card-requirement-icon')?.textContent?.trim() ?? null,
    requirementText: card.querySelector('.class-card-requirement-text')?.textContent?.trim() ?? null,
    lockText: card.querySelector('.class-card-lock')?.textContent?.trim() ?? null,
  })));
  const nextUnlock = await page.evaluate(() => ({
    title: document.querySelector('.class-progress-title')?.textContent?.trim() ?? null,
    chips: Array.from(document.querySelectorAll('.class-progress-chip')).map((chip) => chip.textContent?.trim() ?? null),
  }));
  await page.screenshot({ path: path.join(outDir, 'start-overlay.png') });
  await page.close();
  return { lockedCards, nextUnlock };
}

async function captureBossSpawnFocus() {
  const page = await browser.newPage({ viewport: { width: 1600, height: 960 } });
  await page.goto(pageUrl('index.html'));
  await page.evaluate(() => {
    window.debug_game.unlockAllClasses();
    window.debug_game.startRun();
  });
  await page.waitForTimeout(50);

  const baseline = await page.evaluate(() => {
    window.debug_game.clearEnemies();
    window.debug_game.setElapsed(420);
    state.bossDirector.nextTime = Number.POSITIVE_INFINITY;
    state.spawnDirector.timer = 0.01;
    window.advanceTime(12000);
    return {
      ambientCount: state.enemies.filter((enemy) => !enemy.isBoss).length,
      snapshot: window.debug_game.snapshot(),
    };
  });

  const bossCase = await page.evaluate(() => {
    window.debug_game.clearEnemies();
    window.debug_game.setElapsed(420);
    state.bossDirector.nextTime = Number.POSITIVE_INFINITY;
    state.spawnDirector.timer = 0.01;
    window.debug_game.spawnBoss('countess');
    window.advanceTime(12000);
    return {
      ambientCount: state.enemies.filter((enemy) => !enemy.isBoss).length,
      snapshot: window.debug_game.snapshot(),
    };
  });
  await page.screenshot({ path: path.join(outDir, 'boss-focus.png') });
  await page.close();
  return {
    baselineAmbient: baseline.ambientCount,
    bossAmbient: bossCase.ambientCount,
    activeBosses: bossCase.snapshot.activeBosses,
    baselineNearest: baseline.snapshot.nearestEnemies,
    bossNearest: bossCase.snapshot.nearestEnemies,
  };
}

try {
  const startOverlay = await captureStartOverlay();
  const bossFocus = await captureBossSpawnFocus();
  const checks = {
    startOverlay,
    bossFocus,
  };
  await fs.writeFile(path.join(outDir, 'checks.json'), JSON.stringify(checks, null, 2));
} finally {
  await browser.close();
  server.kill();
}
