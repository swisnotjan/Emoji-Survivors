Original prompt: 1. в D:\tryings\vibecoding\Games\emoji-survivors-enhanced версии есть синтезатор звуков. забери его оттуда и встрой в эту версию. нужны все звуки кроме тех, которые делают скиллы
2. везде где в интерфейсе игры есть упоминание названия игры оно должно быть Emoji Survivors
3. на экране выбора мага (стартовом экране) раздели экран так: слева раздел с выбором мага, справа раздел с ачивками
4. на стартовом экране фона игры не должно быть видно
5. сделай на стартовом экране красивые идл анимации у всего
6. при первом старте игры (именно когда на карту попадает) юзеру нужно показывать попап где рассказывается как играть. там должна быть прям графика кнопок — что для чего нажимать
7. в остальное время этот попап должен быть доступен из кнопки которую размести слева от кнопки апгрейдов, и придумай какой-то шорткат

## 2026-04-26

- Ported procedural WebAudio SFX from the enhanced worktree, excluding skill-specific patches.
- Reworked the main start screen into mage selection and achievements columns with an opaque background and idle animation hooks.
- Added the first-run/how-to-play overlay with key graphics, `H` shortcut, and a HUD help button beside upgrades.
- `node --check` for changed JS and `npm run check` passed.
- Installed the Playwright browser expected by the bundled web-game client, then `npm run playtest:smoke` passed.
- Added and ran `scripts/verify/verify-start-help.mjs`; captured start screen, first-run help popup, gameplay help button, and manual help popup with no console errors.

TODO:
- No open TODOs from this pass.

## 2026-04-26 (UI refresh branch: `codex/ui-retro-pixel-refresh`)

- Created dedicated branch for UI improvements and kept existing unrelated local changes intact.
- Added a global pixel-font stack (`Silkscreen` + monospace fallbacks) via `index.html`.
- Ran a color usage audit on `styles.css` (`rg` frequency scan for HEX/RGBA) before changing theme tokens.
- Added a centralized retro UI override layer in `styles.css`:
  - replaced green/yellow-oriented UI accents with blue/violet + orange palette tokens;
  - switched rounded UI to small-radius pixel corners;
  - introduced thicker, pixel-like borders and shadow/light edge simulation across panels, buttons, bars, chips, overlays, joystick/button controls, and HUD cards.
- Preserved gameplay layout and DOM structure; the change is styling-only.

## 2026-04-27

- Removed decorative plants from world generation and kept trees + candles only.
- Expanded tree variety and generation: added mixed tree emoji variants and small clustered forest patches in each region.
- Removed candle trample mechanic entirely; candles now remain purely decorative with glow.
- Added boss intro cinematic state/flow:
  - gameplay freeze during intro,
  - fast camera pan+zoom to boss and return to player,
  - cinematic boss name banner.
- Updated camera math so terrain/background and entity transforms use the same cinematic camera state.
- Polished run-end overlay text rendering with stronger gradient/stroke/glow treatment for a more epic death moment.
- Unified normal and boss reward card sizing and aligned boss-reward visual palette with current UI direction.
- Implemented Win11 emoji lock-in pipeline:
  - generated `assets/win11-emoji-atlas.png` + `assets/win11-emoji-atlas.json` from Segoe UI Emoji,
  - added atlas loader/helpers in `game/foundation.js`,
  - switched major in-run emoji rendering paths (player/enemies/allies/trees/candles) to atlas-first with fallback,
  - added sprite styling support for upgrade card icons.
- Added pre-init guards for debug/smoke flow (`update`, `render`, camera helpers, `render_game_to_text`) so automation does not crash before bootstrap.
- Verification:
  - `node --check game/foundation.js game/runtime.js game/render.js`
  - `npm run playtest:smoke` (pass)

TODO:
- Expand atlas-driven emoji replacement to any remaining DOM/UI emoji surfaces outside upgrade cards if strict full-UI consistency is required.
- Run a manual desktop gameplay pass to visually verify boss intro pacing and forest density in active combat scenarios.
