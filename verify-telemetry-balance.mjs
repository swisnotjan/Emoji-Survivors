import { chromium } from 'file:///C:/Users/san%20day/.codex/node_modules/playwright/index.mjs';
import fs from 'fs/promises';
import path from 'path';
import http from 'http';
import { spawn } from 'child_process';

const root = 'D:/tryings/vibecoding/emoji-survivors';
const outDir = path.join(root, 'output/web-game/verify-telemetry-balance');
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

await page.goto('http://localhost:4173/index.html');
await page.evaluate(() => {
  window.debug_game.clearTelemetryHistory();
  window.debug_game.unlockAllClasses();
  window.debug_game.selectClass('blood');
  window.debug_game.startRun();
  window.debug_game.setZenMode(true);
  window.debug_game.setSpawningEnabled(false);
});
await page.waitForTimeout(120);

const baseline = await page.evaluate(() => window.debug_game.snapshot());

await page.evaluate(() => {
  window.debug_game.hitPlayer(18);
  window.debug_game.grantXp(2600);
});
await page.waitForTimeout(60);

await page.evaluate(() => {
  window.debug_game.spawnBoss('countess');
  window.advanceTime(240);
  window.debug_game.defeatPrimaryBoss();
});
await page.waitForTimeout(80);

const bossRewardOpen = await page.evaluate(() => window.debug_game.snapshot());
if (bossRewardOpen.mode === 'boss_reward') {
  await page.click('#bossRewardOptions .upgrade-button');
  await page.waitForTimeout(80);
}

await page.evaluate(() => {
  window.debug_game.endRun();
  window.advanceTime(4200);
});
await page.waitForTimeout(120);

const finalState = await page.evaluate(() => window.debug_game.snapshot());
const telemetryRuns = await page.evaluate(() => window.debug_game.getTelemetryHistory());
const telemetry = telemetryRuns.at(-1) ?? null;
const xpTable = await page.evaluate(() => {
  const roster = window.GAME_CONFIG.enemyArchetypes;
  return {
    grunt: roster.grunt.xp,
    runner: roster.runner.xp,
    tank: roster.tank.xp,
    hexer: roster.hexer.xp,
    fang: roster.fang.xp,
    wraith: roster.wraith.xp,
    oracle: roster.oracle.xp,
    brood: roster.brood.xp,
    banner: roster.banner.xp,
    mortar: roster.mortar.xp,
    bulwark: roster.bulwark.xp,
  };
});

await page.screenshot({ path: path.join(outDir, 'game-over.png') });

const checks = {
  baselineClass: baseline.class.id,
  finalMode: finalState.mode,
  telemetryPresent: Boolean(telemetry),
  levelTimings: telemetry?.levelTimings ?? null,
  rewardChoiceCount: telemetry?.rewardChoices?.length ?? 0,
  bossEncounters: telemetry?.bossEncounters ?? [],
  telemetryFinalMajorRanks: telemetry?.final?.majorRanks ?? null,
  totalDamageTaken: telemetry?.totalDamageTaken ?? 0,
  damageTakenBySource: telemetry?.damageTakenBySource ?? {},
  xpTable,
  xpProgressionChecks: {
    runnerGreaterThanGrunt: xpTable.runner > xpTable.grunt,
    tankGreaterThanRunner: xpTable.tank > xpTable.runner,
    oracleGreaterThanHexer: xpTable.oracle > xpTable.hexer,
    bulwarkGreaterThanTank: xpTable.bulwark > xpTable.tank,
    lateThreatsBeatEarlyThreats: xpTable.bulwark > xpTable.grunt && xpTable.mortar > xpTable.runner,
  },
};

await fs.writeFile(path.join(outDir, 'checks.json'), JSON.stringify(checks, null, 2));

await browser.close();
server.kill();
