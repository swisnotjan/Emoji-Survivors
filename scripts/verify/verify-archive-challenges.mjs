import { chromium, pageUrl, verifyOutputDir, repoRoot } from './playwright-loader.mjs';
import fs from 'fs/promises';
import path from 'path';
import http from 'http';
import { spawn } from 'child_process';

const root = repoRoot;
const outDir = verifyOutputDir('verify-archive-challenges');
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
const page = await browser.newPage({ viewport: { width: 1600, height: 960 } });

try {
  await page.goto(pageUrl('index.html'));
  await page.evaluate(() => {
    window.debug_game.clearArchiveProgress();
    window.debug_game.unlockAllClasses();
    window.debug_game.selectClass('wind');
  });
  await page.waitForTimeout(120);

  const startCard = await page.locator('#archiveProgressCard').innerText();
  await page.screenshot({ path: path.join(outDir, 'start-archive.png') });

  await page.evaluate(() => {
    window.debug_game.startRun();
    window.debug_game.setZenMode(true);
    window.debug_game.setSpawningEnabled(false);
    window.debug_game.grantXp(2600);
  });
  await page.waitForTimeout(200);

  const toastVisible = await page.locator('#archiveToastLayer .archive-toast').count();
  const toastText = toastVisible ? await page.locator('#archiveToastLayer .archive-toast').innerText() : '';
  await page.screenshot({ path: path.join(outDir, 'toast.png') });

  await page.evaluate(() => {
    window.debug_game.spawnBoss('countess');
    window.advanceTime(240);
    window.debug_game.defeatPrimaryBoss();
  });
  await page.waitForTimeout(100);
  if ((await page.evaluate(() => window.debug_game.snapshot())).mode === 'boss_reward') {
    await page.click('#bossRewardOptions .upgrade-button');
    await page.waitForTimeout(80);
  }

  await page.evaluate(() => {
    window.debug_game.endRun();
    window.advanceTime(4200);
  });
  await page.waitForTimeout(160);

  const finalState = await page.evaluate(() => window.debug_game.snapshot());
  const revealVisible = await page.locator('#archiveRevealPanel .archive-reveal-card').count();
  const revealText = revealVisible ? await page.locator('#archiveRevealPanel').innerText() : '';
  await page.screenshot({ path: path.join(outDir, 'game-over-archive.png') });

  await page.goto(pageUrl('index.html'));
  await page.evaluate(() => {
    window.debug_game.startRun();
    window.debug_game.setZenMode(true);
    window.debug_game.setSpawningEnabled(false);
    document.getElementById('upgradesButton').click();
  });
  await page.waitForTimeout(100);
  await page.click('[data-codex-tab="archive"]');
  await page.waitForTimeout(100);
  const archiveTabState = await page.evaluate(() => window.debug_game.snapshot());
  const archiveRows = await page.locator('.archive-row').count();
  await page.screenshot({ path: path.join(outDir, 'pause-archive-tab.png') });

  const checks = {
    startCard,
    toastVisible,
    toastText,
    finalMode: finalState.mode,
    revealVisible,
    revealText,
    archiveCodexTab: archiveTabState.dev.codexTab,
    archiveRows,
    completedChallenges: finalState.meta.archiveChallenges,
    completedAchievements: finalState.meta.archiveAchievements,
  };

  await fs.writeFile(path.join(outDir, 'checks.json'), JSON.stringify(checks, null, 2));
} finally {
  await browser.close();
  server.kill();
}
