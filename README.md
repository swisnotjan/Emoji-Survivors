# Emoji Survivors

Top-down survivor-like browser game with 5 mage classes, random bosses, unlock progression, and automated skill casting.

## Structure

- Runtime entry files stay in the repo root for static hosting: `index.html`, `skill-lab.html`, `styles.css`, `app.js`, `game-config.js`, `favicon.svg`
- Game source is split under `game/`
- Automation and local tooling live under `scripts/`
- Verification scripts live under `scripts/verify/`
- Working notes, audits, and project context live under `docs/`

## Local run

```bash
npm run serve
```

Open `http://localhost:4173/index.html`.

## Checks

```bash
npm run check
npm run playtest:smoke
```

## Search

This repo bundles a local `rg` fallback because the packaged `WindowsApps` binary may be non-executable in some shells.

```bash
npm run rg -- --files
npm run search -- "bossReward"
```

## GitHub Pages

This repo includes a GitHub Actions workflow that publishes a minimal static artifact to GitHub Pages.

Published files:

- `index.html`
- `styles.css`
- `app.js`
- `game/`
- `game-config.js`
- `favicon.svg`

The workflow builds these into `.dist-pages/` before deployment.
