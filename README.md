# Emoji Survivors

Top-down survivor-like browser game with 5 mage classes, random bosses, unlock progression, and automated skill casting.

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

## GitHub Pages

This repo includes a GitHub Actions workflow that publishes a minimal static artifact to GitHub Pages.

Published files:

- `index.html`
- `styles.css`
- `app.js`
- `game-config.js`
- `favicon.svg`

The workflow builds these into `.dist-pages/` before deployment.
