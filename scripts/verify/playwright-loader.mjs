import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";

const require = createRequire(import.meta.url);
const verifyDir = path.dirname(fileURLToPath(import.meta.url));
export const repoRoot = path.resolve(verifyDir, "../..");

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function ancestorDirs(startDir) {
  const dirs = [];
  let current = path.resolve(startDir);
  while (current && !dirs.includes(current)) {
    dirs.push(current);
    const parent = path.dirname(current);
    if (parent === current) {
      break;
    }
    current = parent;
  }
  return dirs;
}

function candidatePlaywrightPaths() {
  const codexHome = process.env.CODEX_HOME
    || (process.env.USERPROFILE ? path.join(process.env.USERPROFILE, ".codex") : "")
    || (process.env.HOME ? path.join(process.env.HOME, ".codex") : "");
  const roots = unique([
    repoRoot,
    process.cwd(),
    ...ancestorDirs(repoRoot),
    ...ancestorDirs(process.cwd()).filter((dir) => dir.toLowerCase().startsWith("d:\\tryings\\vibecoding")),
    codexHome,
    process.env.PLAYWRIGHT_ROOT,
  ]);
  return unique([
    process.env.PLAYWRIGHT_PATH,
    ...roots.map((root) => path.join(root, "node_modules", "playwright")),
  ]);
}

export function pageUrl(file = "index.html") {
  return pathToFileURL(path.join(repoRoot, file)).href;
}

export function verifyOutputDir(name) {
  return path.join(repoRoot, "output", "web-game", name);
}

async function loadPlaywright() {
  try {
    return await import("playwright");
  } catch {
    // Try explicit locations below.
  }

  for (const candidate of candidatePlaywrightPaths()) {
    if (!candidate || !fs.existsSync(candidate)) {
      continue;
    }
    try {
      return require(candidate);
    } catch {
      // Keep looking.
    }
  }

  throw new Error(
    [
      "Playwright was not found.",
      "Install it in this repo or any parent under D:\\tryings\\vibecoding with: npm install",
      "You can also set PLAYWRIGHT_PATH to a Playwright package directory.",
    ].join(" ")
  );
}

export const { chromium } = await loadPlaywright();
