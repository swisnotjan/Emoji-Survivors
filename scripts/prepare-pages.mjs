import fs from "node:fs/promises";
import path from "node:path";
import url from "node:url";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const outDir = path.join(root, ".dist-pages");

const entries = [
  "index.html",
  "styles.css",
  "app.js",
  "game",
  "game-config.js",
  "favicon.svg",
  "assets",
  "audio",
];

async function copyEntry(relativePath) {
  const source = path.join(root, relativePath);
  const destination = path.join(outDir, relativePath);
  const stats = await fs.stat(source);

  if (stats.isDirectory()) {
    await fs.mkdir(destination, { recursive: true });
    const children = await fs.readdir(source);
    for (const child of children) {
      await copyEntry(path.join(relativePath, child));
    }
    return;
  }

  await fs.mkdir(path.dirname(destination), { recursive: true });
  await fs.copyFile(source, destination);
}

await fs.rm(outDir, { recursive: true, force: true });
await fs.mkdir(outDir, { recursive: true });

for (const entry of entries) {
  await copyEntry(entry);
}

await fs.writeFile(path.join(outDir, ".nojekyll"), "");
