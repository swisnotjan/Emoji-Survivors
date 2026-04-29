import { chromium, pageUrl, verifyOutputDir, repoRoot } from './playwright-loader.mjs';
import fs from 'fs/promises';
import path from 'path';
import http from 'http';
import { spawn } from 'child_process';

const root = repoRoot;
const outDir = verifyOutputDir('verify-major-scaling');
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

await page.goto(pageUrl('index.html'));
await page.evaluate(() => {
  window.debug_game.unlockAllClasses();
  window.debug_game.selectClass('wind');
  window.debug_game.startRun();
  window.debug_game.setZenMode(true);
  window.debug_game.setSpawningEnabled(false);
});
await page.waitForTimeout(120);

await page.evaluate(() => {
  window.debug_game.giveUpgrade('split-volley', 2);
  window.debug_game.giveUpgrade('arcane-focus', 2);
});
await page.waitForTimeout(60);

const stackedState = await page.evaluate(() => window.debug_game.snapshot());

await page.evaluate(() => {
  window.debug_game.clearEnemies();
  window.debug_game.setElapsed(0);
  window.debug_game.spawnEnemyAt('grunt', 300, 0, 1);
});
await page.waitForTimeout(60);
const earlyEnemy = await page.evaluate(() => window.debug_game.snapshot());

await page.evaluate(() => {
  window.debug_game.clearEnemies();
  window.debug_game.setElapsed(1200);
  window.debug_game.spawnEnemyAt('grunt', 300, 0, 1);
});
await page.waitForTimeout(60);
const lateEnemy = await page.evaluate(() => window.debug_game.snapshot());

await page.evaluate(() => {
  window.debug_game.clearEnemies();
  window.debug_game.setElapsed(1200);
  window.debug_game.spawnBoss('countess');
});
await page.waitForTimeout(80);
const bossOne = await page.evaluate(() => window.debug_game.snapshot());

await page.evaluate(() => {
  window.debug_game.defeatPrimaryBoss();
});
await page.waitForTimeout(100);
const rewardOpen = await page.evaluate(() => window.debug_game.snapshot());
if (rewardOpen.mode === 'boss_reward') {
  await page.click('#bossRewardOptions .upgrade-button');
  await page.waitForTimeout(100);
}

await page.evaluate(() => {
  window.debug_game.setElapsed(1800);
  window.debug_game.spawnBoss('countess');
});
await page.waitForTimeout(80);
const bossTwo = await page.evaluate(() => window.debug_game.snapshot());

await page.screenshot({ path: path.join(outDir, 'major-scaling.png') });

const checks = {
  majorRanks: stackedState.majorRanks,
  majorChoices: stackedState.majorChoices,
  extraProjectiles: stackedState.player.extraProjectiles,
  projectileDamage: stackedState.player.projectileDamage,
  bothSidesStacked: (stackedState.majorRanks?.['split-volley'] ?? 0) >= 1 && (stackedState.majorRanks?.['arcane-focus'] ?? 0) >= 1,
  earlyEnemyHpScale: earlyEnemy.nearestEnemies?.[0]?.hpScale ?? null,
  lateEnemyHpScale: lateEnemy.nearestEnemies?.[0]?.hpScale ?? null,
  regularScalingIncreases: (lateEnemy.nearestEnemies?.[0]?.hpScale ?? 0) > (earlyEnemy.nearestEnemies?.[0]?.hpScale ?? 999),
  firstBossHpScale: bossOne.activeBosses?.[0]?.hpScale ?? null,
  secondBossHpScale: bossTwo.activeBosses?.[0]?.hpScale ?? null,
  bossScalingIncreases: (bossTwo.activeBosses?.[0]?.hpScale ?? 0) > (bossOne.activeBosses?.[0]?.hpScale ?? 999),
};

await fs.writeFile(path.join(outDir, 'checks.json'), JSON.stringify(checks, null, 2));

await browser.close();
server.kill();
