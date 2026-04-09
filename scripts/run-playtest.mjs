import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";
import http from "node:http";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const codexHome = process.env.CODEX_HOME || path.join(process.env.USERPROFILE || process.env.HOME || "", ".codex");
const clientPath = path.join(codexHome, "skills", "develop-web-game", "scripts", "web_game_playwright_client.js");
const port = Number(process.env.PORT || 4173);

function parseArgs(argv) {
  const args = { page: "index.html", scenario: "smoke", mage: "", casts: "", out: "" };
  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = argv[i + 1];
    if (arg === "--page" && next) {
      args.page = next;
      i += 1;
    } else if (arg === "--scenario" && next) {
      args.scenario = next;
      i += 1;
    } else if (arg === "--mage" && next) {
      args.mage = next;
      i += 1;
    } else if (arg === "--casts" && next) {
      args.casts = next;
      i += 1;
    } else if (arg === "--out" && next) {
      args.out = next;
      i += 1;
    }
  }
  return args;
}

function waitForServer(timeoutMs = 10000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const probe = () => {
      const req = http.get(`http://localhost:${port}/index.html`, (res) => {
        res.resume();
        resolve();
      });
      req.on("error", () => {
        if (Date.now() - start > timeoutMs) {
          reject(new Error("Timed out waiting for local server"));
          return;
        }
        setTimeout(probe, 200);
      });
    };
    probe();
  });
}

function makeActions(scenario) {
  if (scenario === "skilllab") {
    return { steps: [{ frames: 10 }, { buttons: [], frames: 26 }] };
  }
  return {
    steps: [
      { frames: 10 },
      { buttons: ["right"], frames: 20 },
      { buttons: [], frames: 10 },
      { buttons: ["space"], frames: 3 },
      { buttons: [], frames: 20 }
    ]
  };
}

const args = parseArgs(process.argv);
const server = spawn(process.execPath, [path.join(root, "scripts", "serve-static.mjs")], {
  cwd: root,
  stdio: "ignore",
});

const tempActionsPath = path.join(root, "output", "web-game", `actions-${args.scenario}.json`);
fs.mkdirSync(path.dirname(tempActionsPath), { recursive: true });
fs.writeFileSync(tempActionsPath, JSON.stringify(makeActions(args.scenario), null, 2));

try {
  await waitForServer();
  const urlParams = new URLSearchParams();
  if (args.mage) urlParams.set("mage", args.mage);
  if (args.casts) urlParams.set("casts", args.casts);
  const query = urlParams.toString();
  const targetUrl = `http://localhost:${port}/${args.page}${query ? `?${query}` : ""}`;
  const outDir = args.out || path.join(root, "output", "web-game", `playtest-${args.scenario}`);
  fs.mkdirSync(outDir, { recursive: true });

  const child = spawn(process.execPath, [
    clientPath,
    "--url", targetUrl,
    "--actions-file", tempActionsPath,
    "--iterations", "1",
    "--pause-ms", args.scenario === "skilllab" ? "180" : "220",
    "--screenshot-dir", outDir
  ], { cwd: root, stdio: "inherit" });

  const exitCode = await new Promise((resolve) => child.on("exit", resolve));
  process.exitCode = exitCode ?? 1;
} finally {
  server.kill();
}
