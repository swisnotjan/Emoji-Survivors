import fs from "node:fs/promises";
import path from "node:path";
import url from "node:url";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const outDir = path.join(root, ".dist-pages");

const files = [
  "index.html",
  "styles.css",
  "app.js",
  "game-config.js",
  "favicon.svg",
];

await fs.rm(outDir, { recursive: true, force: true });
await fs.mkdir(outDir, { recursive: true });

for (const file of files) {
  await fs.copyFile(path.join(root, file), path.join(outDir, file));
}

await fs.writeFile(path.join(outDir, ".nojekyll"), "");
