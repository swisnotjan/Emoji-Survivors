import { chromium } from 'file:///C:/Users/san%20day/.codex/node_modules/playwright/index.mjs';
import fs from 'fs/promises';
import path from 'path';
import http from 'http';
import { spawn } from 'child_process';

const root = process.cwd();
const port = 4175;
const baseUrl = `http://localhost:${port}`;
const outDir = path.join(root, 'output/web-game/verify-boss-random-balance');
await fs.mkdir(outDir, { recursive: true });

const server = spawn(process.execPath, [path.join(root, 'scripts/serve-static.mjs')], {
  cwd: root,
  env: { ...process.env, PORT: String(port) },
  stdio: 'ignore',
});

async function waitForServer(timeoutMs = 10000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      await new Promise((resolve, reject) => {
        const req = http.get(`${baseUrl}/index.html`, (res) => {
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

async function gotoWithRetry(page, url, attempts = 4) {
  let lastError = null;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      await page.goto(url);
      return;
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 180 * (attempt + 1)));
    }
  }
  throw lastError;
}

async function newGamePage() {
  const page = await browser.newPage({ viewport: { width: 1600, height: 960 } });
  await gotoWithRetry(page, `${baseUrl}/index.html`);
  await page.evaluate(() => {
    window.debug_game.unlockAllClasses();
    window.debug_game.startRun();
    window.debug_game.setSpawningEnabled(false);
  });
  await page.waitForTimeout(120);
  return page;
}

async function snapshot(page) {
  return JSON.parse(await page.evaluate(() => window.render_game_to_text()));
}

const randomBossTypes = [];
for (let i = 0; i < 6; i += 1) {
  const page = await newGamePage();
  await page.evaluate(() => {
    state.bossDirector.nextTime = 700;
    window.debug_game.setElapsed(700.4);
    window.advanceTime(180);
  });
  await page.waitForTimeout(90);
  const after = await snapshot(page);
  randomBossTypes.push(after.activeBosses[0]?.type ?? null);
  await page.screenshot({ path: path.join(outDir, `random-boss-${i}.png`) });
  await page.close();
}

const page = await newGamePage();
const base = await snapshot(page);
const lateBossRolls = await page.evaluate(() => Array.from({ length: 18 }, () => pickRandomBossType(700)));

await page.evaluate((player) => {
  window.debug_game.spawnEnemyAt('banner', player.x + 320, player.y, 1);
  window.debug_game.spawnEnemyAt('tank', player.x + 250, player.y, 1);
  for (const enemy of state.enemies) {
    enemy.maxHp = Math.max(enemy.maxHp, 99999);
    enemy.hp = enemy.maxHp;
    if (enemy.type === 'banner') {
      enemy.attackCooldown = 0.01;
    }
  }
  window.advanceTime(3600);
}, base.player);
const bannerState = await snapshot(page);
await page.screenshot({ path: path.join(outDir, 'banner-check.png') });

await page.evaluate(() => {
  window.debug_game.clearEnemies();
  const s = window.debug_game.snapshot();
  window.debug_game.spawnEnemyAt('mortar', s.player.x + 520, s.player.y, 1);
  for (const enemy of state.enemies) {
    enemy.maxHp = Math.max(enemy.maxHp, 99999);
    enemy.hp = enemy.maxHp;
    enemy.attackCooldown = 0.01;
  }
  window.advanceTime(1500);
});
const mortarCombat = await page.evaluate(() => window.debug_game.inspectCombat());
await page.screenshot({ path: path.join(outDir, 'mortar-check.png') });

await page.evaluate(() => {
  window.debug_game.clearEnemies();
  const s = window.debug_game.snapshot();
  window.debug_game.spawnEnemyAt('bulwark', s.player.x + 240, s.player.y, 1);
  for (const enemy of state.enemies) {
    enemy.maxHp = Math.max(enemy.maxHp, 99999);
    enemy.hp = enemy.maxHp;
    enemy.attackCooldown = 0.01;
  }
  window.advanceTime(1100);
});
const bulwarkCombat = await page.evaluate(() => window.debug_game.inspectCombat());
await page.screenshot({ path: path.join(outDir, 'bulwark-check.png') });

await page.evaluate(() => {
  window.debug_game.clearEnemies();
  window.debug_game.spawnBoss('harbinger');
  window.advanceTime(5200);
});
const harbingerState = await snapshot(page);
const harbingerCombat = await page.evaluate(() => window.debug_game.inspectCombat());
await page.screenshot({ path: path.join(outDir, 'harbinger-check.png') });

await page.evaluate(() => {
  window.debug_game.clearEnemies();
  window.debug_game.spawnBoss('regent');
  window.advanceTime(1800);
});
const regentState = await snapshot(page);
const regentCombat = await page.evaluate(() => window.debug_game.inspectCombat());
await page.screenshot({ path: path.join(outDir, 'regent-check.png') });

const checks = {
  randomBossTypes,
  uniqueRandomBossTypes: [...new Set(randomBossTypes.filter(Boolean))],
  lateBossRolls,
  uniqueLateBossRolls: [...new Set(lateBossRolls.filter(Boolean))],
  nextBossAtInitial: base.nextBossAt,
  bannerStatuses: bannerState.nearestEnemies.map((enemy) => ({ type: enemy.type, statuses: enemy.statuses })),
  mortarAttackKinds: mortarCombat.enemyAttacks.map((attack) => attack.kind),
  bulwarkAttackKinds: bulwarkCombat.enemyAttacks.map((attack) => attack.kind),
  harbingerBosses: harbingerState.activeBosses,
  harbingerAttackKinds: harbingerCombat.enemyAttacks.map((attack) => attack.kind),
  regentBosses: regentState.activeBosses,
  regentAttackKinds: regentCombat.enemyAttacks.map((attack) => attack.kind),
};

await fs.writeFile(path.join(outDir, 'checks.json'), JSON.stringify(checks, null, 2));
await browser.close();
server.kill();
