import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, pageUrl, verifyOutputDir, repoRoot } from './playwright-loader.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const outDir = path.join(root, "output", "web-game", "verify-start-help");
const port = 4173;
fs.mkdirSync(outDir, { recursive: true });

const server = spawn(process.execPath, [path.join(root, "scripts", "serve-static.mjs")], {
  cwd: root,
  stdio: "ignore",
});

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForServer() {
  const deadline = Date.now() + 10000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`http://localhost:${port}/index.html`);
      if (response.ok) return;
    } catch {
      // retry
    }
    await wait(150);
  }
  throw new Error("Timed out waiting for local server");
}

try {
  await waitForServer();
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  page.on("console", (message) => {
    if (message.type() === "error") {
      errors.push(message.text());
    }
  });
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(pageUrl('index.html'));
  await page.evaluate(() => localStorage.removeItem("emoji-survivors-howto-seen-v1"));
  await page.reload();
  await page.waitForSelector("#startOverlay:not(.hidden)");
  await page.screenshot({ path: path.join(outDir, "start.png"), fullPage: true });
  await page.click("#startRunButton", { force: true });
  await page.waitForSelector("#howToPlayOverlay:not(.hidden)");
  await page.screenshot({ path: path.join(outDir, "first-run-help.png"), fullPage: true });
  await page.click("#closeHowToButton");
  await page.waitForFunction(() => document.querySelector("#howToPlayOverlay")?.classList.contains("hidden"));
  await page.screenshot({ path: path.join(outDir, "gameplay-help-button.png"), fullPage: true });
  await page.click("#helpButton", { force: true });
  await page.waitForSelector("#howToPlayOverlay:not(.hidden)");
  await page.screenshot({ path: path.join(outDir, "manual-help.png"), fullPage: true });
  const checks = await page.evaluate(() => ({
    title: document.title,
    startTitle: document.querySelector(".start-title")?.textContent ?? "",
    helpButtonText: document.querySelector("#helpButton")?.textContent?.trim() ?? "",
    howToVisible: !document.querySelector("#howToPlayOverlay")?.classList.contains("hidden"),
    runningMode: JSON.parse(window.render_game_to_text()).mode,
  }));
  await browser.close();
  fs.writeFileSync(path.join(outDir, "checks.json"), JSON.stringify({ checks, errors }, null, 2));
  if (errors.length > 0) {
    throw new Error(`Console errors: ${errors.join(" | ")}`);
  }
} finally {
  server.kill();
}
