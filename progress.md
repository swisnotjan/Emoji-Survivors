Original prompt: [@game-studio](plugin://game-studio@openai-curated)
?????? ????? ?????????? ? ????? ??????? ???? ? ????? vampire survivors. ???????? ????????? ? ?????? ?????? ??????. ?????????? ????? wasd ??? ???????. ?????????????? ????? ?? ?????????? ?????. ???? ?????? ?????? ?????? ??????????? ????? ? ??? ???? ?????? (????? ???????, ??????; ???????? ? ???????????; ???????? ?  ?????????). ????? ??????? ??????? ????????? ????????????, ????? ????????? ??? ??????? ? ????? ?????? ??????????? ? ??????

## Completed
- Created new project directory: `D:\tryings\vibecoding\emoji-survivors`.
- Implemented playable top-down survivor prototype with:
  - Movement: WASD + Arrow keys.
  - Auto-fire: nearest enemy targeting.
  - One base projectile attack.
  - Three enemy archetypes: grunt / tank / runner.
- Added HUD, game-over/restart flow, enemy legend.
- Added design-and-logic research notes with sources (`research.md`).
- Added test hooks: `window.render_game_to_text` and `window.advanceTime(ms)`.

## Test plan
- Run syntax check (`node --check app.js`).
- Run Playwright scripted movement bursts and capture screenshots/state.
- Verify no new console/page errors.

## TODO / next suggestions
- Add XP pickup + level-up weapon stats.
- Add spawn patterns per minute marks (wave scripting).
- Add touch controls for mobile playability.

## Test results
- `node --check app.js` passed.
- Playwright run (actions_keys -> `screens2`): 3 iterations, screenshots + state dumps generated, no `errors-*.json` in run directory.
- Additional visual run (`screens4`) confirmed enemy emoji visible in-frame while auto-fire is active.

## Fixes during verification
- Replaced `<script type="module" src="app.js">` with `<script src="app.js">` to avoid file:// CORS load failure in headless Playwright runs.

## Update: levels + upgrades pass
- Implemented hit response: projectile hits now apply short knockback impulse and temporary slow.
- Added full XP/leveling system with nonlinear XP curve and enemy XP rewards.
- Added bottom-screen HP and XP bars.
- Added level-up pause overlay with flash effect and 3-option upgrade selection.
- Added weighted upgrade pool with tier gates (common/uncommon/rare), stack caps, and anti-repeat weighting.
- Updated `render_game_to_text` with level/xp/level-up option payload.

## Verification notes
- `node --check app.js` passes.
- Smoke run: `output/web-game/screens-levels-smoke` (no runtime errors).
- Level-up overlay appears and pauses gameplay (`mode: level_up`, options populated).
- Automated click targeting on overlay is flaky in the headless canvas-relative test harness, so selection was validated logically via state wiring and DOM event path rather than deterministic click replay.

## Update: upgrade stacks + VFX pass
- Added visible stack labels to level-up upgrade cards and exposed `stacks/maxStacks` in `render_game_to_text`.
- Enlarged the rotating hover gradient on upgrade cards and strengthened the fantasy hover glow.
- Added combat/presentation VFX: projectile streaks, cast rings, hit sparks, death bursts, player aura, and damage vignette.
- Slowed enemies now render with a blue tint and blue aura while the slow is active.

## Latest verification
- `node --check app.js` passes after the VFX/UI changes.
- Combat smoke run: `output/web-game/screens-vfx-smoke` generated screenshot + state, no `errors-*.json`.
- Level-up capture: `output/web-game/screens-levelup-stacks/state-0.json` reports `mode: level_up` and includes `stacks/maxStacks` for all 3 options; no `errors-*.json`.

## Update: merged pause/codex menu
- Merged the pause overlay and upgrade codex into a single menu shown for manual pause, focus-loss pause, and top-right codex open.
- Moved the level chip to the left of the HP/XP bars.
- Restyled upgrade rows in the pause/codex menu to use the same chip treatment for rarity and stacks as the level-up cards.

## Latest verification
- `node --check app.js` passes after the merged-menu changes.
- Browser check: `output/web-game/screens-pause-codex-merged/state-0.json` reports `mode: paused` after clicking `#upgradesButton`; no `errors-*.json`.
- Playwright screenshot capture remains unreliable for DOM overlays in this file:// canvas setup, so merged-menu presence was validated through the pause state flow and DOM wiring rather than the PNG alone.

## Update: expanded enemy roster + bosses
- Added three new timed enemy roles:
  - `hexer`: ranged caster pressure.
  - `fang`: telegraphed charging flanker.
  - `wraith`: orbiting pulse threat.
- Added two scheduled bosses:
  - `Crimson Countess` at 120s.
  - `Grave Colossus` at 270s.
- Added hostile attack layer for enemy bolts, burst circles, meteors, and boss shockwaves.
- Added boss-specific phase logic, summon patterns, and larger nameplate/HP presentation.
- Added `window.debug_game` helpers for deterministic browser verification of bosses without changing live balance.

## Latest verification
- `node --check app.js` passes after the enemy/boss update.
- Normal gameplay smoke: `output/web-game/screens-enemies-bosses-smoke` generated screenshot + state, no `errors-*.json`.
- Boss verification script: `output/web-game/boss-check/countess.json` and `colossus.json` confirm both bosses spawn with active boss payloads and attack state.
- Visual verification:
  - `output/web-game/boss-check/countess.png`
  - `output/web-game/boss-check/colossus.png`

## Update: harder bosses + boss HUD/indicator + new roster
- Researched a second boss-design pass focused on readable difficulty escalation and large-arena boss readability.
- Made bosses substantially harder by increasing HP, contact pressure, projectile density, summon pressure, and phase-2 cadence.
- Added two new enemy archetypes:
  - `oracle`: delayed ranged burst caster.
  - `brood`: bulky close-range pulser that splits into runners on death.
- Added two new bosses:
  - `Abyss Eye` at 420s.
  - `Brood Matriarch` at 600s.
- Added persistent top-screen boss HP HUD and off-screen boss direction indicator.
- Added stronger player-damage feedback: player shake, camera shake, and heavier red vignette.

## Verification to run
- `node --check app.js`
- Boss script refresh for `countess`, `colossus`, `abyss`, `matriarch`, plus an off-screen indicator capture.
- One general Playwright smoke run covering movement/combat after the balance pass.

## Latest verification
- `node --check D:\tryings\vibecoding\emoji-survivors\app.js` passes after the harder-boss pass.
- Boss verification script now generates:
  - `output/web-game/boss-check/countess.png/.json`
  - `output/web-game/boss-check/colossus.png/.json`
  - `output/web-game/boss-check/abyss.png/.json`
  - `output/web-game/boss-check/matriarch.png/.json`
  - `output/web-game/boss-check/countess-offscreen.png/.json`
- Artifact check confirms:
  - all four bosses spawn with active boss payloads,
  - off-screen boss state reports `primaryBossIndicator.onScreen = false`,
  - full-page screenshot for `countess-offscreen.png` shows both the top boss HP bar and the direction arrow.
- General gameplay smoke run:
  - `output/web-game/screens-bosses-final-smoke/shot-0.png`
  - `output/web-game/screens-bosses-final-smoke/shot-1.png`
  - `state-0.json` = running
  - `state-1.json` = level_up
  - no `errors-*.json` were generated in the smoke directory.

## Update: dev menu + zen mode + heavier late roster
- Added developer menu on the backquote/tilde key using both `KeyboardEvent.code === Backquote` and fallback key values for `~`, `` ` ``, `ё`, `Ё`.
- Dev menu reuses the existing pause overlay and includes:
  - boss spawn select with `Random Boss` + all concrete bosses,
  - spawn boss button,
  - Zen Mode toggle.
- Zen Mode now auto-resolves level-ups with no level-up overlay or pause interruption.
- Added debug hooks for verification:
  - `window.debug_game.setZenMode(enabled)`
  - `window.debug_game.grantXp(amount)`
  - `window.debug_game.openDevMenu()`
- Rebalanced late-game archetypes so later unlocked enemy types are materially heavier than earlier timed ones:
  - `hexer < fang < wraith < oracle < brood` in base bulk/size.
- Kept the user's constraint: no time-based HP growth multiplier; roster progression is heavier by archetype, not by elapsed time scaling.

## Latest verification
- `node --check app.js` passes after the dev-menu / zen-mode pass.
- Dedicated dev-menu verification:
  - `output/web-game/dev-menu-check/dev-open.png/.json`
  - `output/web-game/dev-menu-check/dev-zen-boss.png/.json`
- Verified by artifact:
  - pressing backquote opens `Developer Menu`,
  - game enters `mode: paused`,
  - dev panel is visible,
  - `Brood Matriarch` can be spawned from the menu,
  - enabling Zen Mode and granting XP raises levels while keeping `mode !== level_up`.
- General smoke run after the pass:
  - `output/web-game/screens-dev-zen-smoke/shot-0.png`
  - `output/web-game/screens-dev-zen-smoke/shot-1.png`
  - no `errors-*.json` in that directory.
## Update: pause/codex polish + dash system + richer upgrade pool
- Reworked the pause/codex surface so it reads more like a single game menu and added a `Restart` action in the header.
- Added compact pause metadata chips for time, level, kills, HP, XP, and Zen state.
- Zen Mode now behaves like an immortal sandbox: player hit VFX still fire, but HP is not reduced.
- Expanded the upgrade pool with new families:
  - `reach`
  - `dashstep`
  - `moonwell`
  - `siphon`
  - `dashstock`
  - `bossbane`
  - `phaseweave`
- Added explicit upgrade families and changed level-up generation so the same family cannot appear more than once in one choice set.
- Codex now hides still-locked upgrades instead of listing them with lock text.
- Added dash charges HUD beside the level chip.
- Added active dash VFX and a debug hook for deterministic upgrade injection during browser verification.

## Verification run (2026-04-08)
- Syntax:
  - `node --check D:\tryings\vibecoding\emoji-survivors\app.js` passes.
- Required Playwright smoke run via `$develop-web-game` client:
  - `output/web-game/screens-upgrades-dash-smoke/shot-0.png`
  - `output/web-game/screens-upgrades-dash-smoke/shot-1.png`
  - no `errors-*.json` in that directory.
- Targeted browser verification script:
  - `output/web-game/verify-upgrades-dash/levelup.json/.png`
  - `output/web-game/verify-upgrades-dash/codex.json/.png`
  - `output/web-game/verify-upgrades-dash/zen-immortal.json/.png`
  - `output/web-game/verify-upgrades-dash/restart.json/.png`
  - `output/web-game/verify-upgrades-dash/dash-stock.json/.png`
  - `output/web-game/verify-upgrades-dash/dash-used.json/.png`
  - `output/web-game/verify-upgrades-dash/dash-recharged.json/.png`
- Verified by state/artifact:
  - level-up offers contain 3 options from 3 distinct families;
  - codex no longer renders `Unlocks at level ...` rows;
  - Zen Mode keeps HP unchanged after forced damage;
  - restart resets time and level to a fresh run;
  - `dashstock` raises max charges to 5;
  - using dash spends one charge and recharge returns the stock to full.

## Notes
- `render_game_to_text` now exposes dash charge state and upgrade-family labels for testability.
- Screenshot capture in this `file://` setup can still be somewhat inconsistent for DOM-vs-canvas composition, so the main assertions were validated against both full-page screenshots and JSON state.
## Update: UI polish follow-up (2026-04-08)
- Fixed pause/codex scrolling by allowing vertical overflow on the shared pause panel.
- Reworked upgrade-card chip layout with a left chip group + right stack chip so level-up cards no longer break their metadata row.
- Made dash HUD horizontal beside the level chip and stretched each charge into a longer pill.
- Added dash-unavailable feedback: pressing `Space` with no available dash now triggers a red shake/flash on the dash HUD.
- Increased rarity emphasis with stronger tier gradients, borders, and glow.
- Added numeric boss HP text next to the boss name in the top boss HUD.

## Verification run (UI follow-up)
- `node --check D:\tryings\vibecoding\emoji-survivors\app.js` passes.
- Smoke run:
  - `output/web-game/screens-ui-fixes-smoke/shot-0.png`
  - `output/web-game/screens-ui-fixes-smoke/shot-1.png`
  - no `errors-*.json`.
- Targeted browser verification:
  - `output/web-game/verify-ui-fixes/codex-scroll.png/.json`
  - `output/web-game/verify-ui-fixes/levelup-chips.png/.json`
  - `output/web-game/verify-ui-fixes/boss-hud.png/.json`
  - metrics files:
    - `codex-metrics.json`
    - `levelup-chip-metrics.json`
    - `hud-metrics.json`
    - `dash-fail.json`
    - `boss-hud.json`
- Visual spot-checks completed on `codex-scroll.png`, `levelup-chips.png`, and `boss-hud.png`.
## Update: locked codex + dev-click upgrades + heal pickups + boss blessings
- Restored future upgrades in the codex and marked them as locked with their unlock level.
- In the developer menu, codex rows are now clickable and add upgrade stacks directly, including future upgrades.
- Reworked dash HUD again:
  - all five slots are always visible,
  - slots are rounded squares instead of pills,
  - unavailable slots read as unavailable,
  - base dash distance reduced from `240` to `180`.
- Added periodic levitating heal pickups with center-biased spawn logic to steer the player away from arena edges.
- Added per-boss reward flow:
  - defeating a boss pauses the run,
  - opens a dedicated `boss_reward` overlay,
  - offers 3 signature blessings from that specific boss,
  - supports keyboard and mouse selection,
  - Zen Mode auto-picks a blessing.
- Added debug hooks for testing:
  - `setPlayerPosition(x, y)`
  - `spawnHealPickup()`
  - `defeatPrimaryBoss()`

## Verification run (boss rewards / pickups)
- `node --check D:\tryings\vibecoding\emoji-survivors\app.js` passes.
- Smoke run:
  - `output/web-game/screens-bossrewards-pickups-smoke/shot-0.png`
  - `output/web-game/screens-bossrewards-pickups-smoke/shot-1.png`
  - no `errors-*.json`.
- Targeted browser verification:
  - `output/web-game/verify-bossreward-pickups/start.json/.png`
  - `output/web-game/verify-bossreward-pickups/codex-locked.json/.png`
  - `output/web-game/verify-bossreward-pickups/dev-click-upgrade.json/.png`
  - `output/web-game/verify-bossreward-pickups/heal-pickups.json/.png`
  - `output/web-game/verify-bossreward-pickups/boss-reward.json/.png`
  - `output/web-game/verify-bossreward-pickups/boss-reward-picked.json/.png`
  - metrics/supporting data:
    - `codex-check.json`
- Verified by state/artifact:
  - codex again shows locked future upgrades with unlock labels;
  - clicking `Phaseweave` in dev menu immediately increases dash distance;
  - heal pickups spawned to the inward side when the player was placed near the right edge;
  - defeating `Crimson Countess` opens `mode: boss_reward` with 3 `countess-*` blessings;
  - selecting one closes the overlay and records the blessing in `bossBlessings`.

## UI polish pass (dash / overlays / dev menu)
- Added a dedicated `Space` hotkey tile inside the dash HUD so dash input matches the upgrade-card shortcut language.
- Tightened the dash HUD layout:
  - taller shortcut tile,
  - shorter right-side charge block,
  - visible 5-slot square charge array,
  - responsive mobile sizing updates.
- Upgrade cards now have rarity-specific hover gradients and idle animation support:
  - per-tier conic hover glow,
  - floating overlay cards,
  - looping icon float/glow.
- Improved run-end presentation:
  - added a larger `gameover-card`,
  - stat cards for time / total kills / upgrade stacks / unique upgrades,
  - kill breakdown list.
- Made Zen Mode preserve 5 ready dash charges permanently; repeated dash input no longer consumes charges.
- Locked codex/dev rows now look visually unavailable and show a lock status chip with unlock level.
- Developer menu got a more distinct visual skin with its own `DEV CONSOLE` tag and warmer console palette.
- Maxed upgrades in the dev menu no longer show `Click to add`.

## Verification run (UI polish pass)
- `node --check D:\tryings\vibecoding\emoji-survivors\app.js` passes.
- Smoke run:
  - `output/web-game/screens-ui-pass-final/shot-0.png`
  - `output/web-game/screens-ui-pass-final/shot-1.png`
  - `output/web-game/screens-ui-pass-final/shot-2.png`
  - no `errors-*.json`.
- Targeted browser verification:
  - `output/web-game/verify-ui-polish-final/dev-menu-open.png`
  - `output/web-game/verify-ui-polish-final/zen-dash.png`
  - `output/web-game/verify-ui-polish-final/game-over.png`
  - `output/web-game/verify-ui-polish-final/locked-row.png`
  - `output/web-game/verify-ui-polish-final/checks.json`
  - `output/web-game/verify-ui-polish-final/checks-assertions.json`
- Confirmed by DOM/state checks:
  - locked codex rows show lock status and unlock text;
  - maxed dev-menu rows no longer expose `Click to add`;
  - Zen Mode keeps all 5 dash charges ready even after repeated `Space` presses;
  - game-over overlay renders 4 stat cards plus a kill breakdown section.

## UI pass (codex shortcut / delayed bars / pickups / legendary flow)
- Added a visible `Tab` hotkey chip to the top-right `Upgrades` button and wired `Tab` to open/close the codex pause overlay.
- Renamed the pause-menu destructive action from `Restart` to `End Run`; it now ends the current run and opens the stat summary overlay instead of resetting immediately.
- Reworked the dash HUD layout again:
  - label and `Space` shortcut now share the top row,
  - dash charges sit on a dedicated second row,
  - fixed the charging animation so the first slot no longer looks permanently full.
- Split the developer controls into two side-by-side cards:
  - `Spawn Boss`
  - `Zen Mode`
- Hid the old `Paused` kicker in developer mode to avoid overlap with the `DEV CONSOLE` tag.
- Implemented delayed `lag bar` overlays for player HP and XP using a white trailing fill with tweened catch-up.
  - Reference direction came from Unity / Godot UI-bar workflows that update the main mask immediately and animate the visual follow-up with tweening.
- Added a rarer yellow XP pickup with the same levitating world treatment as the heal pickup.
- Added stronger pickup collection feedback for both heal and XP drops.
- Bosses no longer grant XP on death; their legendary choice is now the reward beat.
- Boss rewards are now framed as `Legendary` throughout the UI.
- Selected legendary boss blessings now appear in the codex, and dev mode can add legendary blessings directly.
- Dev mode now treats all upgrades as available regardless of normal unlock level.
- Zen Mode still auto-resolves normal level-ups, but boss kills now keep manual legendary selection.

## Verification run (codex / bars / pickups / legendary)
- `node --check D:\tryings\vibecoding\emoji-survivors\app.js` passes.
- Smoke run:
  - `output/web-game/screens-ui-hud-pickups-final/shot-0.png`
  - `output/web-game/screens-ui-hud-pickups-final/shot-1.png`
  - `output/web-game/screens-ui-hud-pickups-final/shot-2.png`
  - no `errors-*.json`.
- Targeted browser verification:
  - `output/web-game/verify-ui-hud-pickups-final/tab-codex.png`
  - `output/web-game/verify-ui-hud-pickups-final/dev-menu-layout.png`
  - `output/web-game/verify-ui-hud-pickups-final/zen-dash-fixed.png`
  - `output/web-game/verify-ui-hud-pickups-final/pickup-spawns.png`
  - `output/web-game/verify-ui-hud-pickups-final/pickup-collected.png`
  - `output/web-game/verify-ui-hud-pickups-final/boss-legendary-zen.png`
  - `output/web-game/verify-ui-hud-pickups-final/codex-legendary.png`
  - `output/web-game/verify-ui-hud-pickups-final/end-run-overlay.png`
  - `output/web-game/verify-ui-hud-pickups-final/checks.json`
- Confirmed by DOM/state checks:
  - `Tab` opens codex and the button hotkey label reads `Tab`;
  - dev menu renders two side-by-side cards and no `Paused` kicker;
  - Zen Mode keeps 5 dash charges ready after repeated `Space` presses;
  - HP lag fill trails the immediate HP fill (`69.37%` vs `65%` in the verification capture);
  - heal and XP pickups both spawned and were collected successfully;
  - defeating a boss in Zen Mode opens manual `mode: boss_reward` with legendary options and does not change XP;
  - chosen legendary blessings appear in the codex;
  - `End Run` opens the run summary overlay with stat cards.

## Research note
- Used these UI references for the delayed-bar implementation direction:
  - Unity Learn: `Make a Health Bar with UI Toolkit`
  - Godot docs: `Control the game's UI with code`
  - UIS thesis note on tweening health bars (`healthBar.DamageTakenTimer` / tweening concept)
- The final implementation is my own inference for this project: immediate main fill plus short-delay white lag fill, tuned for a survivors-style HUD.

## Visual / terrain / boss-cycle pass
- Made emoji idle motion more noticeable by increasing float amplitude, scale swing, rotation swing, and glow strength on upgrade icons and codex icons.
- Replaced the old whole-card bobbing on the level-up and boss-reward overlays with large rotating ray fields behind the cards.
  - Level-up uses warm yellow translucent beams.
  - Boss legendary uses a stronger pink/gold/violet beam treatment.
  - `Level` / legendary titles now pulse and glow independently.
- Slowed progression by increasing the XP-to-next formula and slightly lowering the XP pickup reward.
- Reworked the arena floor generation:
  - removed the visible gameplay grid,
  - reduced tile size to `24`,
  - switched to deterministic noise-driven terrain sampling with domain warp + multi-scale biome/detail noise,
  - generate organic patches of grass / sand / stone without visible hard grid lines.
- Added a dedicated mage favicon via `favicon.svg` and removed `Prototype` from the tab title.
- Added pressed-state animation to clickable buttons.
- Added pickup spawn animation and spawn VFX for both heal and XP pickups.
- Boss reward cards now treat `Legendary` as rarity only; the category chip is now a real category again.
- Boss reward stacks are shown as `0/1` or `1/1`.
- Once a legendary from a given boss is taken, it no longer appears on the next kill of that boss.
- Added hard boss-cycle limit: each boss can only be defeated three times total, after which further spawns of that boss are blocked.

## Verification run (terrain / overlays / boss-cycle)
- `node --check D:\tryings\vibecoding\emoji-survivors\app.js` passes.
- Smoke run:
  - `output/web-game/screens-terrain-overlays-final/shot-0.png`
  - `output/web-game/screens-terrain-overlays-final/shot-1.png`
  - `output/web-game/screens-terrain-overlays-final/shot-2.png`
  - no `errors-*.json`.
- Targeted browser verification:
  - `output/web-game/verify-terrain-overlays-final/terrain-start-fixed.png`
  - `output/web-game/verify-terrain-overlays-final/levelup-rays.png`
  - `output/web-game/verify-terrain-overlays-final/pickup-spawn-anim.png`
  - `output/web-game/verify-terrain-overlays-final/boss-legendary-first.png`
  - `output/web-game/verify-terrain-overlays-final/boss-legendary-second.png`
  - `output/web-game/verify-terrain-overlays-final/codex-after-pick-fixed-2.png`
  - `output/web-game/verify-terrain-overlays-final/checks.json`
  - `output/web-game/verify-terrain-overlays-final/boss-limit.json`
- Confirmed by DOM/state checks:
  - tab title is `Emoji Survivors` and favicon path is `favicon.svg`;
  - level-up opens with ray backdrop present;
  - second Countess kill offers only the two remaining legendary rewards;
  - Countess XP reward remains suppressed (`xp` unchanged across boss kill);
  - codex shows chosen legendary with category chip `Vitality` and stack `1/1`;
  - after three Countess defeats, fourth spawn attempt creates no new active Countess.

## Research note
- Terrain direction was based on standard procedural map principles: large-scale biome fields, smaller-scale detail noise, and domain warping to break up obvious noise contours.
- For delayed bars and UI animation pacing, I kept the already-implemented immediate-fill + lag-fill pattern and extended it with stronger overlay VFX instead of adding more UI movement.

## 2026-04-08 UI / Codex / Pickup pass
- Sorted codex/dev upgrades by rarity ascending; ordinary upgrades render first, boss blessings render as separate boss sections only after that boss has been seen.
- Added click-outside-to-close for the shared pause/codex/dev overlay.
- Added boss HUD lag-fill, brighter white lag bars, and HP-bar shake on damage for player + boss.
- Removed boss HP/name over-head bars; boss HP is now only in the top HUD.
- Reworked level-up / boss-reward idle rays into alternating bright-ray / dark-gap wedges closer to the provided reference, and strengthened the level-title pulse.
- Removed the pulsing bottom strip from upgrade cards.
- Updated emoji idle animation to a stronger float without rotation; locked upgrade icons no longer animate.
- Slowed progression again: base dash distance reduced to 145, XP pickup lowered to 13, XP-to-next formula increased.
- Added FPS readout in the bottom-right HUD.
- Pickup spawning now enforces spacing from existing pickups and adds pre-despawn fade/blink escalation.
- Added debug hook `window.debug_game.damageBoss(amount)` for targeted boss HUD verification.

## 2026-04-08 Verification
- `node --check app.js` passed.
- Skill client smoke-run passed:
  - `output/web-game/screens-codex-pickups-fps-pass/shot-0.png`
  - `output/web-game/screens-codex-pickups-fps-pass/shot-1.png`
  - `output/web-game/screens-codex-pickups-fps-pass/shot-2.png`
- Targeted DOM/browser verification passed:
  - `output/web-game/verify-codex-pickups-bars-final/codex-regular.png`
  - `output/web-game/verify-codex-pickups-bars-final/dev-open.png`
  - `output/web-game/verify-codex-pickups-bars-final/boss-grouped-codex.png`
  - `output/web-game/verify-codex-pickups-bars-final/checks.json`
- Additional boss-lag + pickup lifecycle verification passed:
  - `output/web-game/verify-pickups-bosslag-final/boss-lagbar.png`
  - `output/web-game/verify-pickups-bosslag-final/pickups-despawn-fade.png`
  - `output/web-game/verify-pickups-bosslag-final/checks.json`
- Verified outcomes:
  - codex/dev open in `mode: paused` and close back to `mode: running` on background click;
  - ordinary upgrades sort `common -> uncommon -> rare`;
  - boss group appears only after `countess` has been seen;
  - boss top HUD shows delayed white lag fill (`100% -> 82.22%` while main fill is `75.73%`);
  - pickup spacing in verification run stayed well above the new minimum (360px+ between active pickups);
  - FPS readout renders bottom-right in screenshots.

## 2026-04-08 Milestone / Spread / HUD pass
- XP pickups made noticeably rarer: longer timer window and only one active XP pickup at a time.
- Terrain generation shifted toward much larger sand coverage by raising the sand score and lowering the threshold.
- Every 10th level now becomes an `Ascendant Level`:
  - existing upgrades only, no new content;
  - high-rarity presentation for all choices;
  - amplified effect values on the same upgrades;
  - extra golden sparkles and stronger overlay treatment.
- Projectile multishot spread was rebuilt from per-projectile-step to total-cone-width logic, then narrowed substantially; splitshot/boss blessings now widen the cone much more conservatively.
- Pause/codex/dev panel width reduced and panel scroll now resets to the top on every open.
- Added quick pulse animation to changing HUD values (`time`, `kills`, `level`, `HP`, `XP`, boss HP text).
- After each selected level-up, the player now emits a holy expanding nova that deals heavy damage and knockback.
- Added overlay enter animations for pause/codex, level-up, boss reward, and game-over.
- White lag bars were made much brighter again.

## 2026-04-08 Verification
- `node --check app.js` passed.
- Smoke run passed:
  - `output/web-game/screens-milestone-hud-smoke/shot-0.png`
  - `output/web-game/screens-milestone-hud-smoke/shot-1.png`
  - `output/web-game/screens-milestone-hud-smoke/shot-2.png`
- Targeted UI / progression verification passed:
  - `output/web-game/verify-milestones-holy-ui/checks.json`
  - `output/web-game/verify-level10-holy-final/checks.json`
- Confirmed:
  - codex panel reopens with `scrollTop = 0`;
  - level 10 opens an ascendant overlay with all 3 options marked `milestone: true` and displayed as `rare`;
  - holy level-up nova renders after a normal single level-up selection;
  - HUD value pulse classes trigger for time / kills / HP / XP;
  - XP pickups are now sparse in long-run verification (`1` XP pickup active in the capture);
  - terrain screenshots show sand occupying a much larger share of the visible map.

## 2026-04-08 FX / Performance follow-up
- Pickup pre-despawn warning starts earlier and blinks much more slowly at first, with acceleration only near the final moments.
- Added adaptive FX budget:
  - dynamic particle cap based on load / FPS;
  - particle spawn counts scale down under heavy load;
  - shadow blur costs are reduced in medium/high FX tiers;
  - line effects are skipped in the heaviest tier.
- Projectile trails are now gradient tails from transparent -> opaque toward the projectile head.
- Projectile core size reduced from `6` to `5`.
- Holy level-up nova now:
  - follows the player,
  - deals much less damage than before,
  - uses a radial fade instead of a flat white disc,
  - shows floating `????? ??` text above the player.
- Codex/dev emoji animation now only runs for already-owned upgrades (`stacks > 0`).
- Level-up ray masks were adjusted again so brightness fades outward more clearly.

## 2026-04-08 Verification
- `node --check app.js` passed.
- Smoke run passed:
  - `output/web-game/screens-fx-opt-smoke/shot-0.png`
  - `output/web-game/screens-fx-opt-smoke/shot-1.png`
  - `output/web-game/screens-fx-opt-smoke/shot-2.png`
- Targeted checks passed:
  - `output/web-game/verify-fx-optimization-pass/checks.json`
  - `output/web-game/verify-pickup-codex-anim-final/checks.json`
- Confirmed:
  - low-life pickup captured at `life: 1.2` after the longer warning window;
  - codex icon animation is `upgrade-icon-float` only for owned `cadence`, while `stride/kinetic/reach` remain `none`;
  - heavy-load capture with boss + multishot still runs and reports `fps: 37` in the verification state.
## Update: death sequence + terrain palette + split HUD pulses + gradient fixes (2026-04-08)
- Added a dedicated pre-summary death sequence:
  - player falls onto their side,
  - camera zooms out and drifts off-center,
  - stronger red defeat wash + `RUN OVER` presentation,
  - summary overlay appears only after the death beat finishes.
- Reworked terrain palette to cleaner, brighter colors:
  - grass -> richer green,
  - sand -> warmer gold,
  - stone -> cleaner blue-gray.
- Split HP / XP / Boss HP HUD values into current/max spans and moved pulse animation to only the number that actually changes.
- Removed any time-value pulse.
- Switched the floating holy text back to English (`LEVEL UP`).
- Restored holy wave damage while reducing its radius substantially and keeping it attached to the player.
- Fixed the actual cause of the broken holy-wave fade: alpha helper usage on hex colors was producing opaque stops, so the gradient was being drawn as a solid disk. Replaced those stops with real RGBA colors.
- Tightened level-up / boss overlay ray masks so the rays fade outward instead of staying equally strong across the whole radius.

## Verification run (death / gradients)
- `node --check D:\tryings\vibecoding\emoji-survivors\app.js` passes.
- Required Playwright smoke run via `$develop-web-game` client:
  - `output/web-game/shot-0.png`
  - `output/web-game/shot-1.png`
  - `output/web-game/shot-2.png`
  - matching `state-0.json ... state-2.json`
  - no new `errors-*.json` in `output/web-game`.
- Targeted deterministic browser verification:
  - `output/web-game/verify-death-hud-gradients-final/death-sequence.png`
  - `output/web-game/verify-death-hud-gradients-final/death-summary.png`
  - `output/web-game/verify-death-hud-gradients-final/holy-wave-english.png`
  - `output/web-game/verify-death-hud-gradients-final/level10-rays-terrain.png`
  - `output/web-game/verify-death-hud-gradients-final/checks.json`
- Verified visually:
  - death sequence now plays before summary;
  - holy wave is a smaller player-following golden pulse instead of a solid white disk;
  - terrain colors are cleaner;
  - level-up rays now visibly fade outward.
## Update: water + impassable world props (2026-04-08)
- Added deterministic region-based world features on top of the terrain:
  - water ponds,
  - water streams/rivers,
  - trees,
  - rocks,
  - ruins,
  - bushes.
- Water blocks movement but does not block projectiles.
- Trees / rocks / ruins / bushes block both movement and projectiles.
- Player, enemies, pickup spawns, enemy spawns, and debug teleports now snap to nearby walkable space instead of landing inside blocked terrain.
- Projectile simulation now checks segment hits against blocking props and destroys the projectile on impact.
- Terrain generation remains fully connected by construction:
  - features are generated inside each region's inner area only,
  - wide margins are left clear along region borders,
  - large features are spaced apart,
  - the spawn area around the origin remains clear.
  This avoids closed islands and one-way traps while still making the map feel authored.
- Added visible feature counts and a nearby-feature debug hook for deterministic verification.

## Verification run (world features)
- `node --check D:\tryings\vibecoding\emoji-survivors\app.js` passes.
- Required Playwright smoke run via `$develop-web-game` client refreshed `output/web-game/shot-0.png ... shot-2.png` and `state-0.json ... state-2.json`; no `errors-*.json` in `output/web-game`.
- Targeted world-feature verification:
  - `output/web-game/verify-world-features/water-scene.png`
  - `output/web-game/verify-world-features/water-projectile.png`
  - `output/web-game/verify-world-features/solid-scene.png`
  - `output/web-game/verify-world-features/solid-projectile.png`
  - `output/web-game/verify-world-features/checks.json`
- Confirmed:
  - player movement is blocked before crossing the sampled pond;
  - projectiles still damage a tank placed across the pond;
  - player movement is blocked by the sampled tree;
  - projectiles do not damage a tank placed behind the tree.
## Update: darker tile palette + tile water + rock-only world props + slower death pass (2026-04-08)
- Darkened the terrain palette overall for grass, sand, stone, and water.
- Converted water presentation from blob/structure rendering to terrain-tile rendering driven by the same world-feature collision map.
- Added weak per-tile value variation across all terrain types, plus darker water toward deeper centers.
- Removed trees, ruins, and bushes from world generation; only rocks remain as solid world props.
- Increased rock density and added several rock silhouettes/cluster variants so the map reads less repetitive.
- World seed is now randomized per run, and the feature cache resets on each fresh run.
- Increased holy level-up pulse visibility and size slightly while keeping the reduced-radius design.
- Extended the death sequence and added progressive slow-motion during the defeat beat.
- Fixed death-camera background coverage by rendering terrain against the zoomed world extents instead of the unzoomed viewport.

## Verification run (map / death refresh)
- `node --check D:\tryings\vibecoding\emoji-survivors\app.js` passes.
- Required Playwright smoke run via `$develop-web-game` client refreshed `output/web-game/shot-0.png ... shot-2.png` and matching `state-0.json ... state-2.json`; still no `errors-*.json` in `output/web-game`.
- Targeted browser verification:
  - `output/web-game/verify-map-death-pass/run-a.png`
  - `output/web-game/verify-map-death-pass/run-b.png`
  - `output/web-game/verify-map-death-pass/water-tiles.png`
  - `output/web-game/verify-map-death-pass/rocks-block.png`
  - `output/web-game/verify-map-death-pass/death-mid.png`
  - `output/web-game/verify-map-death-pass/death-end.png`
  - `output/web-game/verify-map-death-pass/checks.json`
- Additional holy/death visual refresh:
  - `output/web-game/verify-death-hud-gradients-final/holy-wave-english.png`
  - `output/web-game/verify-death-hud-gradients-final/death-sequence.png`
- Confirmed:
  - separate fresh loads generate different nearby feature layouts;
  - water remains movement-blocking but shot-passable;
  - rocks remain movement-blocking and projectile-blocking;
  - death sequence now lasts longer with no missing terrain around the zoomed camera.

## Update: darker terrain + animated water + slab rocks + XP orb economy (2026-04-08)
- Darkened all terrain palettes and increased tile-to-tile contrast so biome variation reads more clearly.
- Added animated water shimmer directly at tile-sampling time; deeper water now ripples more strongly.
- Reworked rock generation/rendering from circular blobs into slab/ruin-like stone pieces while keeping circle-based collision for cheap physics.
- Converted player projectiles to white visuals and reduced projectile radius slightly.
- Replaced instant enemy XP with collectible yellow XP orbs:
  - regular enemies now spill a small number of XP orbs using a capped value distribution,
  - orbs avoid overlapping on spawn,
  - nearby orbs magnetize to the player,
  - final collection uses a short absorb animation.
- Removed periodic XP pickup spawning.
- Bosses now drop a mixed XP payout:
  - burst of XP orbs,
  - one larger XP cache pickup,
  - boss reward overlay remains separate and still pauses the run.
- Added targeted verification script: `verify-xp-water-pass.mjs`.

## Verification run (XP/water pass)
- `node --check D:\tryings\vibecoding\emoji-survivors\app.js` passes.
- Required Playwright smoke run via `$WEB_GAME_CLIENT` completed; latest artifacts landed in `output/web-game/shot-0..2.png` and `state-0..2.json` (client again wrote to the root output dir rather than a nested folder).
- Targeted browser verification script artifacts:
  - `output/web-game/verify-xp-water-pass/water-ripple-a.png/.json`
  - `output/web-game/verify-xp-water-pass/water-ripple-b.png/.json`
  - `output/web-game/verify-xp-water-pass/rock-slabs.png/.json`
  - `output/web-game/verify-xp-water-pass/xp-orbs-drop.png/.json`
  - `output/web-game/verify-xp-water-pass/xp-orbs-collect.png/.json`
  - `output/web-game/verify-xp-water-pass/boss-xp-drop.png/.json`
  - `output/web-game/verify-xp-water-pass/checks.json`
- Verified by artifact/state:
  - water is present and animated across two captures,
  - rocks render as slab-like stone pieces rather than round blobs,
  - normal enemy death produces XP orbs,
  - collecting an orb raises player XP,
  - boss death produces both XP orbs and one XP cache while still opening the boss reward overlay.

## Update: softer biome blending + ruin-style rocks + pickup magnet pass + obstacle-aware enemies (2026-04-08)
- Rebalanced terrain visuals toward lower contrast and more nuanced biome separation.
- Replaced hard surface picks with weighted grass/sand/stone blending so transitions read more naturally across tiles.
- Added subtle tint variation per tile instead of pure value-only variation.
- Softened water shoreline blending while keeping stronger animated ripple toward deeper centers.
- Reduced XP orb count while keeping total XP pacing intact by using larger orb denominations and a higher boss-cache share.
- Made XP orbs smaller.
- Increased pickup magnet radius around the player.
- Heal pickups and large XP cache pickups now also magnetize and use the same absorb-to-player collection behavior.
- Reworked rocks back toward the old ruin-like language and increased rock density, including occasional very large slabs.
- Added simple obstacle-aware steering for grounded enemies so they route around rocks instead of rubbing in place.
- Flying enemies now ignore water/solid movement collision and can travel over both.
- Strengthened and lengthened the holy level-up damage wave.
- Applied proper gradient trails to hostile projectile attacks too.
- Increased HP/XP HUD number size.

## Verification run (terrain / pickups / pathing pass)
- `node --check D:\tryings\vibecoding\emoji-survivors\app.js` passes.
- Required Playwright smoke run via `$WEB_GAME_CLIENT` completed after the patch; latest client output refreshed `output/web-game/shot-0..2.png` and matching `state-0..2.json`.
- Targeted browser verification script:
  - `output/web-game/verify-terrain-pickups-pathing/water-soft-a.png/.json`
  - `output/web-game/verify-terrain-pickups-pathing/water-soft-b.png/.json`
  - `output/web-game/verify-terrain-pickups-pathing/rock-ruin-shape.png/.json`
  - `output/web-game/verify-terrain-pickups-pathing/xp-orb-count.png/.json`
  - `output/web-game/verify-terrain-pickups-pathing/heal-absorb.png/.json`
  - `output/web-game/verify-terrain-pickups-pathing/xp-cache-absorb.png/.json`
  - `output/web-game/verify-terrain-pickups-pathing/ground-pathing.png/.json`
  - `output/web-game/verify-terrain-pickups-pathing/flying-over-obstacles.png/.json`
  - `output/web-game/verify-terrain-pickups-pathing/checks.json`
- Confirmed:
  - water/shore transition is softer and ripple is still active,
  - rocks render in the intended slab/ruin style,
  - XP orb count is reduced but drops still exist,
  - heal/cache pickups magnetize and absorb,
  - grounded enemies close the gap around rocks over time instead of staying pinned,
  - flying enemies keep moving when spawned over rock/water.

## Update: pickup suction scaling + square rock structures + cheaper detour pathing (2026-04-08)
- Pickup absorb time now scales with distance to the player: the closer the pickup is, the faster it finishes the suction animation.
- Reduced XP orb counts again and shifted more value into larger denominations / boss cache so total XP pacing stays intact with fewer entities.
- Ground enemies no longer run the expensive per-frame obstacle steering scan; replaced it with short-lived detour waypoints only when movement is actually blocked.
- Detour routing now considers water as well as rocks.
- Reworked rocks into axis-aligned square/rectangular structures with shadow, no rotation, and multiple layout variants including large blocks.
- Increased background saturation slightly.
- Increased HP/XP number size again.

## Verification run (pickup suction + square rocks + detour optimization)
- `node --check D:\tryings\vibecoding\emoji-survivors\app.js` passes.
- Required Playwright smoke run via `$WEB_GAME_CLIENT` completed again after the optimization pass; latest client output refreshed `output/web-game/shot-0..2.png` and `state-0..2.json`.
- Refreshed targeted browser verification with `verify-terrain-pickups-pathing.mjs`.
- Confirmed:
  - normal small enemy XP drops can collapse to a single orb,
  - heal and XP cache pickups still magnetize/absorb,
  - grounded enemy closes distance around a blocking rock rather than staying fully pinned,
  - flying enemies continue moving over rock/water,
  - targeted capture now shows ~55 FPS in the obstacle scene, materially better than the previous heavier steering pass.

## Update: water-only terrain + pickup/dash responsiveness pass
- Removed rock generation from live map creation; regions now generate only water reservoirs/rivers with broader variety in size.
- Increased pickup magnet responsiveness so XP orbs, heals, and XP cache accelerate harder near the player and absorb faster at close range.
- Added one-shot dash recharge pulse/highlight when a new charge becomes available.
- Raised the holy level-up nova, ring, embers, and text to a top render layer so they draw above world effects/enemies while still staying below the player sprite.
- Enlarged the HUD HP/XP numbers again for readability.
- Added terrain tile base caching and reused cached tile shading data while keeping water ripple dynamic, reducing terrain render cost.
- Slightly increased background saturation while keeping the map palette subdued.

## Latest verification
- `node --check app.js` passes after the terrain-cache and HUD changes.
- Required Playwright smoke run completed with fresh `output/web-game/state-0.json` showing `visibleFeatures.solids: 0` and `fps: 59`.
- Targeted verification: `output/web-game/verify-water-pickups-dash/checks.json` reports `waterFound: true`, `solidsVisibleAfterUpdate: 0`, `xpOrbDropCount: 1`, `dashPulseActive: true`, and `fps: 57`.
- Visual inspection confirmed: no rocks rendered, water still visible, dash recharge pulse visible, and HP/XP digits larger on HUD.

## TODO / next suggestions
- If FPS still dips later in high-entity late game, next target should be enemy/pathing/update budgeting rather than terrain.
- Water generation can still be pushed further with shoreline detail later without reintroducing solid-obstacle cost.

## Update: class/progression overhaul (2026-04-09)
- Added full class framework with 5 mage definitions:
  - `wind`
  - `frost`
  - `fire`
  - `necro`
  - `blood`
- Reworked the player bootstrap so the selected class controls:
  - base auto-attack damage
  - base speed / max HP
  - passive combat rider
  - starting weapon profile
  - 3 class skill slots
- Added meta progression with sequential unlock tracking in local storage:
  - wind unlocked by default
  - later classes unlock in order from run XP + target enemy kill counts
- Added new start/class-select overlay with locked/unlocked class cards and next-unlock progress.
- Reworked level progression into 4 reward kinds:
  - `minor`
  - `skill`
  - `major`
  - `mastery`
- Skill unlock cadence is now level `5 / 15 / 25`.
- Major upgrades now come from random fixed opposite pairs and render as 2-option choices.
- Mastery now targets class skill slots instead of the old generic late-game system.
- Added universal minor upgrade buckets (`offense / tempo / survival`) for cleaner choice generation.
- Added reward queue tracking so multi-level XP bursts no longer skip skill unlocks or major milestones.
- Added status-aware class combat plumbing:
  - wind knock status
  - frost chill/freeze/brittle
  - fire burn spread on burning kills
  - necro pierce + thrall hooks
  - blood lifesteal / crit / dash-buff hooks
- Added auto-casting class skills and first-pass implementations for all 15 skills.
- Added ally/thrall simulation support and corpse tracking for necromancer systems.
- Updated codex rendering to show:
  - universal upgrades
  - major upgrades
  - current class skills
  - seen boss legendaries
- Updated run summary counts so they include skill unlocks and masteries instead of only old stack-based upgrades.
- Added richer `render_game_to_text` payload for verification:
  - reward queue
  - active effects
  - enemy status flags
  - class/meta/dev state
- Added new debug hooks for deterministic testing:
  - `unlockAllClasses()`
  - `selectClass(classId)`
  - `setSpawningEnabled(enabled)`
  - `clearEnemies()`
  - `triggerSkill(skillRef)`

## Verification: class/progression overhaul
- Syntax:
  - `node --check D:\tryings\vibecoding\emoji-survivors\app.js`
- Targeted progression verification:
  - `D:\tryings\vibecoding\emoji-survivors\verify-class-overhaul.mjs`
  - artifacts:
    - `output/web-game/verify-class-overhaul/start-overlay.png`
    - `output/web-game/verify-class-overhaul/level5-skill.png`
    - `output/web-game/verify-class-overhaul/level10-major.png`
    - `output/web-game/verify-class-overhaul/codex-open.png`
    - `output/web-game/verify-class-overhaul/dev-menu-open.png`
    - `output/web-game/verify-class-overhaul/checks.json`
- Verified by artifact/state:
  - start screen opens in `mode: start_menu`
  - level 5 produces a 1-card skill unlock (`Gale Ring` for wind)
  - level 10 produces a 2-card major pair choice
  - codex opens in `mode: paused`
  - dev menu opens in `mode: paused` with `devMenuOpen: true`
- Targeted class behavior verification:
  - `D:\tryings\vibecoding\emoji-survivors\verify-class-behavior.mjs`
  - artifacts:
    - `output/web-game/verify-class-behavior/wind-skill.png`
    - `output/web-game/verify-class-behavior/frost-passive.png`
    - `output/web-game/verify-class-behavior/fire-passive.png`
    - `output/web-game/verify-class-behavior/necro-passive.png`
    - `output/web-game/verify-class-behavior/blood-passive.png`
    - `output/web-game/verify-class-behavior/checks.json`
- Verified by state/artifact:
  - wind auto-attacks apply `wind` status
  - frost auto-attacks apply `chill`
  - fire auto-attacks apply `burn`
  - wind slot 1 (`gale-ring`) unlocks and can be force-cast via debug hook
  - necro starts with higher max HP and projectile pierce
  - blood starts with lower max HP / higher auto-attack damage and lifesteals some HP back after dealing damage
- Required smoke run via develop-web-game client:
  - root artifacts refreshed in `output/web-game/shot-0.png`, `shot-1.png`, `shot-2.png`, `state-0.json`, `state-1.json`, `state-2.json`
  - no fresh `errors-*.json` in `output/web-game`

## Remaining follow-up ideas
- Retune exact numbers for XP curve, class passives, and cooldowns after longer live playtests.
- Decide whether boss rewards should later become partially class-aware or stay globally legendary.
- If needed, add dedicated dev hooks to force thrall raises / mastery picks for deeper deterministic tests.

## Update: class HUD + start/codex polish (2026-04-09)
- Removed the ray treatment from the class-select start overlay and kept it as a calmer archive/menu surface.
- Restyled the start button into a larger pill CTA so it matches the rest of the in-game menu language.
- Reworked bottom HUD structure:
  - moved existing level/dash/HP/XP into a 2-row cluster,
  - added a dedicated skill panel with 4 cards:
    - passive
    - slot 1
    - slot 2
    - slot 3
- Skill cards now communicate:
  - locked vs unlocked
  - charging vs ready
  - active cast flash
  - unlock pulse animation
  - cooldown text / unlock level text
- Skill unlocks at level `5 / 15 / 25` no longer open the level-up overlay:
  - they resolve automatically,
  - pulse the skill card on the HUD,
  - keep the reward queue intact.
- Fixed reward-flow edge case where the old level-up overlay could remain visible when a queued skill unlock auto-resolved after a normal level-up.
- Increased HP / XP number size and fixed the CSS selector bug that was shrinking the actual values while only the label was meant to be small.
- Added same-size slash/value presentation for HP and XP.
- Major level-up cards now stretch correctly as a 2-card layout instead of leaving an empty third column.
- Cleaned codex/dev grouping labels so major upgrades and class skills are no longer marked with the generic `Boss` kicker.
- Preserved class-skill ordering by slot in the codex.
- Extended dev behavior so class skills can also be advanced from the dev codex flow.
- Added more distinctive class-effect rendering accents for better readability:
  - extra streak lane in `Crosswind Strip`
  - spiral arcs for `Tempest Node`
  - rune/snowflake geometry for `Permafrost Seal`
  - hotter inner core for `Sunspot`
  - wisp motion for `Requiem Field`
  - inner ring/blood motes for `Crimson Pool`
  - rune spokes for `Blood Rite`

## Verification: HUD / start / codex polish
- Syntax:
  - `node --check D:\tryings\vibecoding\emoji-survivors\app.js`
- Targeted UI verification refreshed:
  - `output/web-game/verify-class-overhaul/start-overlay.png`
  - `output/web-game/verify-class-overhaul/level5-skill-hud.png`
  - `output/web-game/verify-class-overhaul/level10-major.png`
  - `output/web-game/verify-class-overhaul/codex-open.png`
  - `output/web-game/verify-class-overhaul/dev-menu-open.png`
  - `output/web-game/verify-class-overhaul/checks.json`
- Verified by artifact/state:
  - class select screen has no rotating rays,
  - level 5 no longer enters `mode: level_up`; the skill unlock is reflected directly on the HUD while the run stays in `mode: running`,
  - level 10 still produces a 2-option major choice,
  - HP and XP current/max values now compute to `29px` on both sides,
  - skill HUD reports slot 1 unlocked with cooldown text and slots 2/3 still locked at their target levels,
  - codex/dev still open in paused mode after the HUD changes.
- Targeted class behavior verification rerun after the HUD pass:
  - `output/web-game/verify-class-behavior/checks.json`
- Required smoke run via develop-web-game client rerun after the UI pass:
  - refreshed root `output/web-game/shot-0.png`, `shot-1.png`, `shot-2.png`, `state-0.json`, `state-1.json`, `state-2.json`
  - no fresh `errors-*.json` in `output/web-game`
## Update: skill HUD + upgrade card redesign + class palette pass (2026-04-09)
- Rebuilt the in-run skill HUD into compact square blocks positioned to the right of the HP/XP bars:
  - passive + 3 active slots,
  - icon-only presentation,
  - cooldown in the corner,
  - bottom-to-top recharge fill,
  - cast flash / unlock pulse states.
- Added a dedicated hover tooltip for passive/active skills with icon, title, targeting metadata, and description.
- Redesigned all reward-choice cards (level-up, major pair, boss reward) to a centered vertical layout:
  - stack chip on the left,
  - shortcut chip on the right,
  - large emoji icon,
  - category,
  - title,
  - highlighted yellow effect text,
  - description,
  - rarity footer.
- Updated major-choice layout so 2-option milestone choices stretch correctly across the container instead of reserving a third empty column.
- Reduced HP / XP numeric size back down from the oversized pass and kept current/max/slash visually aligned.
- Added class-specific projectile palettes:
  - Wind: pale cyan
  - Frost: icy blue
  - Fire: ember orange
  - Necro: violet
  - Blood: crimson
- Unified all enemy projectiles to a shared hostile purple.
- Differentiated player class presentation further with class-specific player emoji and class-tinted aura/crest treatment.
- Smoothed the holy level-up nova:
  - softer eased timing,
  - layered radial gradients,
  - gentler fade-in/fade-out envelope,
  - slightly longer visible life.
- Increased killcam render padding so death zoom-out renders more map before the black world edge becomes visible.
- Strengthened visible cast VFX for the active skills so they read as real spells instead of subtle overlays.
- Cleaned codex/dev presentation:
  - removed leftover generic `Boss` kicker usage from class-skill / major contexts,
  - preserved slot ordering for class skills.

## Verification: skill HUD / tooltip / card redesign pass
- Syntax:
  - `node --check D:\tryings\vibecoding\emoji-survivors\app.js`
- Targeted verification artifacts:
  - `output/web-game/verify-ui-skill-pass/start-overlay.png`
  - `output/web-game/verify-ui-skill-pass/wind-skill-hud.png`
  - `output/web-game/verify-ui-skill-pass/wind-skill-tooltip.png`
  - `output/web-game/verify-ui-skill-pass/major-choice.png`
  - `output/web-game/verify-ui-skill-pass/class-wind-base.png`
  - `output/web-game/verify-ui-skill-pass/class-frost-base.png`
  - `output/web-game/verify-ui-skill-pass/class-fire.png`
  - `output/web-game/verify-ui-skill-pass/class-necro-base.png`
  - `output/web-game/verify-ui-skill-pass/class-blood-base.png`
  - `output/web-game/verify-ui-skill-pass/death-killcam.png`
  - `output/web-game/verify-ui-skill-pass/checks.json`
- Verified by artifact/state:
  - skill tooltip appears on hover,
  - each compact skill card computes to `60x60`,
  - HP/XP current/max values compute to `22px`,
  - major milestone overlay computes to a real 2-column stretched layout (`356px 356px`),
  - class-select / in-run / death-sequence surfaces render after the HUD refactor without fresh syntax/runtime failures.
## Update: class select / end-run / hostile palette / skill lab pass (2026-04-09)
- Fixed class-start bug where the start overlay selection could still launch the previously initialized class state:
  - `startRun()` now rebuilds the run from `metaProgress.selectedClassId` before entering gameplay.
- Removed the overhead class icon above the player and reduced the player aura size/intensity.
- End Run from the pause menu now skips the defeat killcam entirely and jumps straight to the summary overlay.
- Retuned HUD value sizing again:
  - HP / XP current/max/slash now match the `Time` / `Kills` number size (`16px`).
- Reworked skill recharge fill from `scaleY` to explicit fill height so the top edge stays crisp near readiness.
- Added a glowing top cap on skill-fill to improve readability when a skill is almost ready.
- Necromancer palette shifted from violet to emerald:
  - class tint
  - auto projectiles
  - necro skill VFX (`Bone Ward`, `Requiem Field`, supportive summon burst)
- Unified hostile combat palette further:
  - enemy projectiles remain on shared arcane purple,
  - hostile burst / shockwave / meteor / beam payloads now also ignore per-enemy color overrides and use the shared hostile purple,
  - hostile telegraph helpers (`channel`, `line`, phase/intros) now use the same shared hostile purple.
- Smoothed the holy level-up nova further:
  - longer life,
  - softer sinusoidal fade envelope,
  - gentler gradient falloff and less abrupt ring pop.
- Increased background render padding again for death zoom-out / killcam so the black edge arrives later.
- Strengthened several under-reading player skill VFX:
  - thicker/brighter `Crosswind Strip`
  - larger/more readable `Bone Ward`
  - necro summon call now emits an on-cast ring
- Added a dedicated manual spell sandbox:
  - `skill-lab.html`
  - `skill-lab-bootstrap.js`
  - boots directly into a no-spawn lab,
  - unlocks all classes,
  - starts with all three skills available,
  - provides class buttons + Slot 1/2/3 cast buttons,
  - spawns an immortal target dummy.
- Added extra debug helpers for deterministic verification and the manual lab:
  - `debug_game.startRun()`
  - `debug_game.unlockAllCurrentSkills()`
  - `debug_game.spawnTrainingDummy()`
  - `debug_game.inspectCombat()`

## Verification: fixes + skill-lab
- Syntax:
  - `node --check D:\tryings\vibecoding\emoji-survivors\app.js`
- Targeted verification artifacts:
  - `output/web-game/verify-fixes-pass/frost-start.png`
  - `output/web-game/verify-fixes-pass/end-run-summary.png`
  - `output/web-game/verify-fixes-pass/necro-projectile.png`
  - `output/web-game/verify-fixes-pass/hostile-purple.png`
  - `output/web-game/verify-fixes-pass/skill-lab.png`
  - `output/web-game/verify-fixes-pass/checks.json`
- Verified by artifact/state:
  - starting after selecting `Frost` yields `class.id = frost`,
  - pause-menu `End Run` lands directly in `mode: game_over` with no active defeat sequence,
  - necro active projectile color resolves to `#8cf0c3`,
  - hostile combat events in the targeted boss test all report `rgba(168, 116, 255, {a})`,
  - HP / XP / Time all compute to `16px`,
  - `skill-lab.html` boots into `mode: running` with one immortal dummy and manual cast buttons available.

## Update: soft skill VFX + passive HUD cleanup + random bosses (2026-04-09)
- Reworked skill VFX rendering to be softer and less harsh:
  - added per-effect fade-in/fade-out envelope for spell effects,
  - upgraded radial/strip/ward rendering with softer gradients and gentler edge glow,
  - kept the existing silhouettes but made them appear/disappear smoothly.
- Removed recharge UI from the passive skill card:
  - passive cooldown badge hidden,
  - passive fill hidden.
- Fixed pickup collect artifact over the player:
  - removed the bright vertical pickup-collect line that was rendering at the player position during absorb,
  - replaced it with a second soft ring pulse.
- Updated class skins:
  - Wind `???????`
  - Frost `???????`
  - Fire `????`
  - Necro `????`
  - Blood `????`
- Reworked boss scheduling from predefined boss identities to weighted random boss selection per boss event:
  - boss event times remain fixed,
  - boss type is now chosen from an unlocked weighted pool,
  - immediate repeats are avoided when possible,
  - bosses already killed 3 times are excluded.

## Verification run (soft VFX / random boss pass)
- `node --check D:\tryings\vibecoding\emoji-survivors\app.js` passes.
- Targeted browser verification:
  - `output/web-game/verify-soft-vfx-random-boss/skill-lab-soft-vfx.png`
  - `output/web-game/verify-soft-vfx-random-boss/fire-pickup-collect.png`
  - `output/web-game/verify-soft-vfx-random-boss/checks.json`
- Verified by state/artifact:
  - passive HUD now reports `display: none` for both cooldown and fill;
  - skill-lab screenshot shows the softened spell VFX live on screen;
  - fire pickup test no longer reports leftover collect-line effects at sample time;
  - six fresh boss-event samples produced both `countess` and `colossus`, confirming random boss selection is live.
- Required `$develop-web-game` smoke run executed after the change set:
  - latest root artifacts refreshed in `output/web-game/shot-0.png`, `shot-1.png`, `shot-2.png`, `state-0.json`, `state-1.json`, `state-2.json`.

## Update: softer skill VFX + manual skill lab + floating damage numbers (2026-04-09)
- Softened spell VFX further:
  - removed the harsh outline-driven look from spell fields,
  - shifted them toward filled gradients / glow masses / soft interior detail,
  - adjusted crosswind and bone-ward to avoid hard contour framing.
- Added smoother end-of-life handling for spell VFX and holy wave:
  - spell effects now use a stronger fade envelope,
  - holy wave now fades with a softer alpha floor and less abrupt terminal edge.
- Added floating enemy damage numbers with source-colored tinting:
  - wind = pale white,
  - frost = icy blue,
  - fire/burn = orange-gold,
  - necro/thrall = emerald,
  - blood = crimson-pink,
  - holy = gold.
- Reworked `skill-lab` into an actual manual test mode:
  - browser tab title changed to `Emoji Survivors Skill Lab`,
  - removed top-right cast buttons,
  - skill slots in the HUD are now clickable in lab mode,
  - lab mode disables auto-skill casting,
  - unlocked skills now start on cooldown instead of firing instantly,
  - `Spawn Dummy` adds another dummy instead of resetting the map,
  - `Reset Arena` resets the current mage lab and respawns a fresh single dummy,
  - class buttons now show icon + class label,
  - utility buttons span full width.

## Verification run (manual skill lab / soft VFX)
- `node --check D:\tryings\vibecoding\emoji-survivors\app.js` passes.
- Targeted verification:
  - `output/web-game/verify-soft-vfx-lab-pass/lab-manual-casts.png`
  - `output/web-game/verify-soft-vfx-lab-pass/lab-extra-dummy.png`
  - `output/web-game/verify-soft-vfx-lab-pass/checks.json`
  - `output/web-game/verify-skill-lab-click-cast/click-cast-slot1.png`
  - `output/web-game/verify-holy-wave-fade/holy-wave-during.png`
  - `output/web-game/verify-holy-wave-fade/holy-wave-later.png`
- Verified by state/artifact:
  - manual lab mode reports `manualSkillMode: true`;
  - unlocked lab skills start with positive cooldown timers;
  - clicking a skill slot after recharge triggers the cast;
  - `Spawn Dummy` increases dummy count from 1 to 2 instead of resetting the arena.
- `$develop-web-game` smoke client was run again after the patch set; this file:// client still prefers writing root `output/web-game/shot-*.png` artifacts rather than the requested subdirectory, so targeted Playwright captures were used as the reliable evidence for this pass.

## Update: skill-lab zero-cd + soft spell VFX pass
- Added `skill-lab` zero-cooldown mode for manual casting:
  - new debug flag `zeroSkillCooldown`
  - manual lab casts ignore cooldowns and keep skill timers at `0`
  - added `Gain Level` button in the lab panel
- Skill-lab bootstrap now enables:
  - manual casts
  - zero cooldowns
  - no spawn director
  - Zen mode
- Added debug helpers:
  - `setSkillLabZeroCooldown(enabled)`
  - `gainLevel(amount)`
- Reworked skill VFX to be softer and more gradient-driven:
  - added primary/secondary color blends to spell effects
  - removed hard outline treatment from the major skill surfaces
  - improved wind strip, tempest node, blizzard, cinder halo, sunspot, bone ward, requiem field, crimson pool, blood rite, and grave call presentation
- Wind Slot 2 now unfolds progressively instead of appearing at full length immediately.
- Bone Ward orbit speed increased substantially.
- Crystal Spear now renders as a large icy lance with a stronger trail and head shape.
- Added fade-tail handling for soft skill effects and `holy-wave` so they do not hard-cut at the last frame.
- Smoothed `holy-wave` further and removed the hard ring-stroke look.

## Latest verification
- `node --check app.js` passes after the VFX/lab changes.
- `$WEB_GAME_CLIENT` smoke runs against `skill-lab.html` succeed; latest root captures confirm:
  - `state-1.json` can show `activeEffects: ["gale-ring", ...]`
  - `state-1.json` can show `activeEffects: ["tempest-node", ...]`
  - `dev.zeroSkillCooldown: true`
  - `manualSkillMode: true`
- `Gain Level` verification via latest root run:
  - `state-1.json` reported `level: 26` after clicking `#skillLabLevelUp`
  - screenshot shows the in-world `LEVEL UP` holy text/effect instead of an overlay
- Visual spot checks used latest root screenshots because the client still writes to `output/web-game` root in this `file://` setup rather than the requested subdirectory.

## Remaining follow-up ideas
- If more softness is needed, remove the remaining bright center spikes from some spell VFX and push even more of the look into layered radial gradients.
- If the skill lab needs deeper control, add buttons for mastery rank and enemy type switching.

## Update: full soft-VFX pass + tail-fade fix
- Fixed the soft-effect fade bug where a tail phase briefly re-entered and looked like a second pop-in before disappearing.
  - Tail phases now use a decay-only envelope instead of going through normal fade-in/fade-out again.
- Frost `Crystal Spear` visual scale increased dramatically:
  - added dedicated render radius
  - now renders as a large icy lance with a longer brighter trail
- `Bone Ward` orbit speed increased substantially in both simulation and rendering.
- Expanded the stylized VFX pass across all mage skills:
  - stronger primary/secondary color blending
  - softer multi-layer radial masses instead of hard outlines
  - richer interior motion for wind, frost, fire, necro, and blood skills
  - more epic treatment for ult/signature skills like `Tempest Node`, `Crystal Spear`, `Ash Comet`, `Grave Call`, and `Blood Rite`
- `Crosswind Strip` now unfolds progressively from the caster side using deploy metrics shared by update + render, so the damaging area and the visible lane match.
- `holy-wave` fade was smoothed further and its hard ring-stroke look was reduced.

## Research applied
- Used animation principles around anticipation, follow-through, slow-in/slow-out, arcs, and exaggeration as the basis for the new spell timing and shape language.
- Applied gameplay-clarity guidance: keep the core read strong, let secondary wisps/sparkles stay cosmetic, and avoid visual noise that obscures interaction.
- In practice this turned into a 3-layer spell rule for the game:
  - readable core silhouette
  - secondary motion layer
  - soft tail/follow-through fade

## Latest verification
- `node --check app.js` passes after the latest VFX pass.
- Long `skill-lab` level-up run showed the post-level holy effect disappearing cleanly from `activeEffects` over time without a second reappearance.
- Latest root smoke captures confirm:
  - `zeroSkillCooldown: true`
  - `manualSkillMode: true`
  - `activeEffects` include the clicked skill kinds during the cast window
  - later states no longer include those effects once the fade tail is over

## Update: second fade-tail fix + deeper stylized VFX tuning
- Fixed the remaining fade bug root cause:
  - fade tails previously started near full alpha, which could still read as a second brief reappearance.
  - tails now start from a small residual alpha (`tailAlphaStart`) and only decay downward.
- Reduced overuse of white in soft spell effects by switching core highlights to tinted highlights derived from the effect palette.
- Added another layer of peripheral motes to soft spell effects for a richer real-time read without hard outlines.
- Crystal Spear received another large visual scale increase and extra side-fins for a more ultimate-like silhouette.
- Crosswind Strip center highlight is now palette-tinted rather than white-heavy.

## Latest verification
- `node --check app.js` still passes.
- Long level-up skill-lab run now ends with no `holy-wave` left in `activeEffects`, and no second effect-kind reappears in state after the fade window.
- Root screenshots from the latest long run show the post-level effect sequence disappearing cleanly.

## Update: deep-research VFX overhaul
- Read and applied local research report: `C:\Users\san day\Downloads\deep-research-report.md`.
- Reworked spell rendering around the report's hierarchy:
  - stable ground-plane read layer first
  - secondary motion layer second
  - soft dissipating tail last
- Removed the old blanket additive look from `drawEffects()`:
  - no more global `lighter` across the whole effect pass
  - switched to selective per-layer compositing (`source-over` + controlled `screen` glows)
- Added VFX helper primitives for richer Canvas rendering:
  - gradient discs
  - gradient rings
  - soft particles
  - gradient strokes
- Added school-aware soft-effect profiles so the base shape language differs by school:
  - wind = lighter ribbons / crescents / low-opacity flow
  - frost = sharper radial shard read + cooler edge glow
  - fire = hotter core + stronger warm release layer
  - necro = lower-opacity field + eerie ring structure
  - blood = darker viscous core + restrained wet highlights
- Fixed the remaining tail fade bug more robustly:
  - effects now carry over their last rendered alpha/scale/progress into the fade-tail state
  - fade tails start from residual alpha instead of visually popping back in
- Added cast-release accents for skills:
  - ring burst
  - sparks
  - short line streaks
  - floating embers/motes
  This gives each cast a readable release phase instead of only a persistent zone.
- Retuned skill palettes to reduce white wash and better separate school identities.
- Crystal Spear visual scale increased again and its projectile rendering was rebuilt with a much larger lance silhouette and colder blue trail.
- Bone Ward orbit speed increased again in both damage simulation and rendering.
- Further enriched blood and necro visuals with extra pulse/droplet / inward-pull layers.

## Verification
- `node --check app.js` passes after the overhaul.
- Ran repeated `$WEB_GAME_CLIENT` captures against `skill-lab.html` for all 5 schools and saved them to:
  - `output/web-game/verify-vfx-overhaul`
  - `output/web-game/verify-vfx-overhaul-pass2`
- Visual checks completed on all five schools via saved screenshots.
- Ran an additional real game smoke run on `index.html` using `#startRunButton`.
- No new `errors-*.json` were produced by the latest runs.

## Notes for next pass
- The biggest remaining polish opportunity is not correctness but taste:
  - push even more unique silhouette language into each ultimate
  - especially make Wind less foggy, Fire more ember-rich, Blood more wet/specular, and Frost crystal impacts even sharper.
- If performance becomes a concern later, reduce secondary particles and outer haze first; keep boundary rings and primary silhouettes.

## Update: multi-tint spell color pass
- Added explicit support for richer spell palettes in `resolveEffectPalette()`:
  - `tertiaryColor`
  - `lightColor`
  - `darkColor`
- Spell effects no longer depend only on `primary -> secondary -> transparent`; they can now carry a third tint and a custom highlight tint.
- Propagated the richer palette fields through `spawnPlayerAura()` and all direct skill effect spawns.
- Retuned all five schools with multi-tint palettes:
  - Wind now includes aqua + teal + mint/green accents
  - Frost now includes icy blue + deeper blue + faint lilac accents
  - Fire now includes gold + orange + red-hot accents
  - Necro now includes emerald + sickly green + eerie violet accents
  - Blood now includes crimson + burgundy + magenta accents
- Boosted school brightness/readability slightly via `getSoftEffectProfile()` without going back to white wash.
- Skill cast accents also received richer tinting so the release phase matches the school palette better.

## Latest verification
- `node --check app.js` passes after the color pass.
- Ran another full `skill-lab` sweep for all 5 schools and saved screenshots to:
  - `output/web-game/verify-vfx-color-pass`
- Visual check confirms the spells now use multi-tint gradients instead of a single hue fading to transparency.

## Update: VFX opacity + softer particles pass
- Increased soft skill VFX opacity materially by boosting school render profiles instead of adding more white.
- Disabled fade-tail for soft spell VFX and holy-wave; effects now resolve fully inside the primary fade envelope, removing the late second pop.
- Reduced `Crystal Spear` visual size from the oversized pass to a tighter ultimate silhouette.
- Made skill particles blurrier by softening radial particle helpers and spark/ember rendering.

## Latest verification
- `node --check D:\tryings\vibecoding\emoji-survivors\app.js` passes.
- Visual validation:
  - `output/web-game/verify-vfx-opacity-pass/fire-shot-0.png`
  - `output/web-game/verify-vfx-opacity-pass-frost/shot-0.png`
- Logic validation: fade-tail is disabled for spell VFX, so the old end-of-life reappearance path is no longer reachable.

## Update: extra VFX visibility pass
- Raised soft spell opacity again across all schools.
- Increased spark/ember density in rendering without reintroducing white wash.
- Reduced `Crystal Spear` render size again to keep the frost ultimate readable without dominating the screen.

## Latest verification
- `node --check D:\tryings\vibecoding\emoji-survivors\app.js` passes.
- Fresh frost validation:
  - `output/web-game/verify-vfx-opacity-pass-frost-2/shot-0.png`
  - `output/web-game/verify-vfx-opacity-pass-frost-2/state-0.json`
- Visual check confirms denser spell read and a smaller `Crystal Spear` silhouette.

## Update: aggressive VFX density pass
- Raised soft-skill opacity again with a near-2x jump in the main fill, ring, and core layers.
- Increased the envelope alpha cap so spell bodies read as solid masses instead of haze.
- Reduced `Crystal Spear` render size again after the density boost.

## Latest verification
- `node --check D:\tryings\vibecoding\emoji-survivors\app.js` passes.
- Fresh frost capture:
  - `output/web-game/verify-vfx-opacity-pass-frost-3/shot-0.png`
  - `output/web-game/verify-vfx-opacity-pass-frost-3/state-0.json`
- Visual check confirms the spells are now substantially denser and less translucent.

## Update: skill layer + targeted VFX pass
- Moved top-layer player skill effects beneath enemies by changing render order.
- Increased opacity specifically for `crosswind-strip` and `bone-ward` so they match the rest of the current VFX set.
- Added internal motion to blood skills:
  - `vein-burst` now has rotating inner motes and a living pulse ring.
  - `blood-rite` now has animated crystal rotation and internal radial streaks.

## Latest verification
- `node --check D:\tryings\vibecoding\emoji-survivors\app.js` passes.
- Wind lane visual check:
  - `output/web-game/verify-layer-wind-strip/shot-0.png`
  - `output/web-game/verify-layer-wind-strip/state-0.json`
- Visual check confirms the enemy renders above `crosswind-strip` and the lane opacity is materially stronger.
- Blood pass was validated by code-path inspection after the file:// Playwright client stalled on the targeted capture.

## Update: ally layering fix
- Moved `drawAllies()` to render after top-layer skill VFX so necromancer thralls sit above spells instead of beneath them.

## Update: tooling retrospective + local verification loop
- Added repo-local workflow scripts:
  - `npm run check`
  - `npm run serve`
  - `npm run playtest:smoke`
  - `npm run playtest:skilllab`
  - `npm run search -- "<pattern>"`
  - `npm run verify:bosses`
- Added:
  - `scripts/serve-static.mjs`
  - `scripts/run-playtest.mjs`
  - `scripts/search.ps1`
  - `dev-retrospective.md`
- Main friction points documented:
  - unstable `file://` verification
  - no one-command dev loop
  - flaky Windows `rg.exe` resolution
  - Codex Playwright ESM warning from global `C:\Users\san day\.codex`
- Validation:
  - `npm run check` passes
  - `npm run playtest:skilllab -- --mage frost --casts 1,2,3 --out output/web-game/playtest-skilllab-local` passes
  - `npm run search -- "BOSS_SCHEDULE"` passes

## Update: random boss director + roster expansion + balance pass
- Replaced fixed boss schedule with a defeat-driven random boss director:
  - random encounter gaps from configurable windows
  - weighted type selection
  - anti-repeat still preserved
  - each boss still capped at 3 kills
- Added new enemy archetypes:
  - `banner`: support haste pulse / priority target
  - `mortar`: delayed artillery burst clusters
  - `bulwark`: mini-elite bruiser with local shockwave
- Added new bosses:
  - `harbinger` / `Void Harbinger`
  - `regent` / `Starfall Regent`
- Added new boss reward pools for both new bosses.
- Rebalanced ambient spawns:
  - lower body clutter
  - added new role weights and caps
  - reduced total on-field cap to improve readability/perf
- Rebalanced XP curve:
  - old: `44 + level * 14 + level^1.48 * 8`
  - new: `52 + level * 15 + level^1.58 * 7.6`
- Added `balance-audit.md` documenting:
  - roster-gap analysis
  - boss-randomization rationale
  - new threat-role coverage
  - progression cadence targets

## Latest verification
- `node --check D:\tryings\vibecoding\emoji-survivors\app.js` passes.
- `npm run playtest:smoke -- --out output/web-game/playtest-smoke-balance` passes.
- Deterministic boss/enemy verification:
  - `node verify-boss-random-balance.mjs`
  - artifacts in `output/web-game/verify-boss-random-balance`
- Verified:
  - `nextBossAt` is now randomized and exposed in text state
  - early boss selection varies between eligible bosses
  - `harbinger` and `regent` both spawn and execute attack patterns
  - new verification harness is reusable through `npm run verify:bosses`

## Remaining follow-up
- Do a second balance pass after live-feel playtesting with the new enemy roles.
- If performance is still a concern later, extract combat tuning tables out of `app.js` before further balance work.

## Update: class unlock enemy icons + boss focus spawns
- Added enemy requirement chips with enemy emoji to locked class cards on the start overlay and mirrored the icon in the next-unlock progress chips.
- Strongly reduced ambient enemy spawns while any boss is alive by multiplying spawn interval and enforcing a low soft cap on non-boss enemies during boss phases.
- Added targeted verification script: erify-class-boss-focus.mjs.

## Latest verification
- 
pm run check passes.
- 
pm run playtest:smoke passes.
- 
ode verify-class-boss-focus.mjs passes and confirms locked class cards show enemy requirement icons, while ambient enemies during a boss window stay far below the no-boss baseline.


## Update: telemetry + config extraction + XP economy pass
- Added persistent run telemetry store keyed by `emoji-survivors-run-telemetry-v1`.
- Telemetry now records:
  - level timings
  - reward choices
  - boss spawn/defeat timings
  - damage taken by source
  - recent damage samples
  - final run summary on game-over
- Exposed debug helpers:
  - `getTelemetryHistory()`
  - `getLastTelemetryRun()`
  - `clearTelemetryHistory()`
- Moved key tuning tables out of `app.js` into `game-config.js`:
  - XP curve
  - spawn director values
  - boss unlock times and random weights
  - enemy archetype numbers
  - class defs
  - spawn roster weights/count rules
- Rebalanced enemy XP so later/stronger enemies are more rewarding than early/weak ones:
  - runner 9
  - tank 20
  - oracle 30
  - brood 38
  - banner 36
  - mortar 42
  - bulwark 56
- Reinstated no-XP boss defeats by skipping boss XP-drop spawning; bosses now pay out through their legendary reward layer only.
- Added `class-vs-boss-audit.md` with matchup notes and tuning risks.
- Added `verify-telemetry-balance.mjs` and package script `npm run verify:telemetry`.

## Latest verification
- `npm run check` passes.
- `npm run playtest:smoke` passes; existing stale `output/web-game/screens/errors-0.json` remains from an older run, but this pass did not generate a new error artifact.
- `npm run verify:telemetry` passes.
- `npm run verify:bosses` passes.
- `output/web-game/verify-telemetry-balance/checks.json` confirms:
  - telemetry stored successfully
  - level timings captured
  - reward choices captured
  - boss encounter timing captured
  - damage-by-source payload captured
  - XP ordering checks pass for early vs late/strong threats
- `output/web-game/verify-boss-random-balance/checks.json` still confirms random boss variety and new boss roster health after the config migration.

## Next suggestions
- Add per-class telemetry aggregation (median level times, boss kill times, death-source mix) to make balance passes faster.
- Move upgrade pools / major-pair tuning into config as a second extraction pass if balancing cadence continues.
- Add a dedicated `verify-class-vs-boss.mjs` stress script for Blood/Necro against late bosses.

## Update: boss phase HUD + boss tuning pass
- Added multi-phase boss HUD rows: bosses now show a main HP bar plus one mini bar per phase with small labels.
- Added phase-rage visual treatment: phase 2 bosses now get a stronger themed aura/read so the transition is readable even without numbers.
- Restored boss XP drops and large XP pickups on boss kill.
- Moved render ordering so player skill VFX sit below pickups, player projectiles, enemy attacks/telegraphs, allies, and enemies.
- Colossus rebalance:
  - longer telegraph windows on slam/quake/meteor
  - noticeably smaller shockwave radii, especially in phase 2
  - slightly less meteor spread volume
- Abyss Eye tuned up:
  - extra phase-2 burst layering around beam/ring windows
  - stronger phase-2 summon mix
- Brood Matriarch tuned up:
  - much heavier spider/brood summoning
  - extra swarm pressure on phase-2 pounce resolution
- Void Harbinger tuned up:
  - blink now chains into multiple projectile waves instead of a single burst, creating a dodge sequence
- Starfall Regent identity reworked:
  - replaced generic salvo beat with a `crown` pattern built from inner/outer celestial ring bursts
  - phase 2 adds support reinforcements on that crown beat, but the core identity is now area scripting rather than just another projectile fan

## Latest verification
- `npm run check` passes.
- `npm run playtest:smoke` passes.
- `npm run verify:bosses` passes after one transient local-server startup miss on the first attempt; rerun succeeded cleanly.
- Visual artifacts reviewed:
  - `output/web-game/verify-boss-random-balance/harbinger-check.png`
  - `output/web-game/verify-boss-random-balance/regent-check.png`
- Phase HUD bars are visible in those boss captures.
## Update: stackable major upgrades + time-based HP scaling
- Reworked major milestones from permanent-opposition picks into stackable ranked build axes.
- Both sides of the same major pair can now be collected later in the same run; the opposite side is no longer locked.
- Added diminishing-return rank tables for every major side via `game-config.js`.
- Added weighted pair fatigue so the same major pair is less likely to repeat immediately.
- Added soft time-based HP scaling for regular enemies and bosses on spawn.
- Boss HP scaling also gets a small encounter-index bonus so repeated late bosses stay relevant.
- Extended telemetry/final run payload with `majorRanks` and exposed current major ranks + hpScale in debug snapshots.
- Added `verify-major-scaling.mjs` and `npm run verify:majors` for regression coverage.

## Latest verification
- `npm run check` passes.
- `npm run verify:majors` passes and confirms both sides of `barrage` can stack in one run plus regular/boss HP scaling increase over time.
- `npm run playtest:smoke` passes.
- `npm run verify:telemetry` passes.
- `npm run verify:bosses` passes on rerun; first attempt still occasionally hits the known local server startup race (`ERR_CONNECTION_REFUSED`).
## Update: stacked boss phase bars + verify hardening
- Replaced the single boss HP bar with two vertically stacked phase bars that together represent one continuous HP pool.
- Top bar now represents Phase 2 HP, bottom bar represents Phase 1 HP.
- Boss damage lag rendering now applies inside the stacked phase bars instead of a separate main bar.
- Hardened `verify-boss-random-balance.mjs` by moving it to a dedicated port (`4175`) and keeping retry-on-goto, which removes the common false-negative race with other local runs.

## Latest verification
- `npm run check` passes.
- `npm run verify:bosses` passes on the dedicated port.
- `npm run playtest:smoke` passes.
- Visual inspection of `output/web-game/verify-boss-random-balance/harbinger-check.png` confirms the new stacked two-bar boss HUD.
## Update: earlier first enemies + slightly closer camera
- Reduced the initial ambient spawn delay from `0.55s` to `0.18s` so the run starts engaging sooner.
- Pulled the baseline camera in by changing the default zoom from `1.0` to `0.92` while preserving the death zoom-out.

## Latest verification
- `npm run check` passes.
- `npm run playtest:smoke` passes.
- Smoke state at `0.38s` already shows 2 enemies on the field after the spawn-delay tweak.
## Update: sequential class unlock visibility + softer thresholds
- Start overlay now shows only already unlocked classes plus the single next unlock target.
- Later locked classes stay hidden until they become the current target.
- Requirement tracking remains strictly sequential: only the current next class accumulates XP and target-kill progress.
- Softened late unlock thresholds:
  - Frost: `1500 XP` + `70 runner`
  - Fire: `4200 XP` + `75 tank`
  - Necro: `7800 XP` + `40 brood`
  - Blood: `12500 XP` + `70 fang`

## Countess phase regression check
- Reproduced Countess phase transition in isolation via debug spawn.
- After forcing HP below the phase threshold and advancing time, the game stayed in `mode: running`, the boss remained active, and no console/page errors were produced.
- Start overlay verification confirms the initial state now shows only `wind` and the next target `frost`.
## Update: phase-transition crash fix + class menu clarity
- Found the real boss phase-transition freeze source: `drawEnemies()` referenced `BOSS_THEME_COLORS`, but that constant was undefined.
- Added `BOSS_THEME_COLORS` palette for all bosses, so entering phase 2 no longer throws during render.
- Added a Countess-specific `phase-shift` recovery state on phase change to avoid carrying mid-pattern state into phase 2.
- Clarified the start overlay copy: only unlocked classes plus the next unlock target are shown; later classes are intentionally hidden until their turn.

## Latest verification
- `npm run check` passes.
- `npm run playtest:smoke` passes.
- Targeted phase-transition verification across all bosses confirms they all survive phase change without page errors:
  - `output/web-game/verify-phase-transition/checks.json`
  - `output/web-game/verify-phase-transition-allphase2/checks.json`
- Default class menu now intentionally shows only `wind` and the next target `frost`, with explanatory subtitle:
  - `output/web-game/verify-phase-transition/menu-default.png`
## Update: class menu visibility cleanup
- Start overlay now shows all 5 mage cards at all times.
- Only the next unlock target shows active XP/enemy requirements.
- Later locked classes now show a clear gate message: unlock the previous class first.
- Synced `CLASS_UNLOCK_REQUIREMENTS` in `app.js` to `GAME_CONFIG.classUnlockRequirements`, so the menu no longer shows stale old thresholds.

## Latest verification
- `npm run check` passes.
- Default menu verification confirms all 5 classes render, `blood` is visible, and only `frost` shows real requirements:
  - `output/web-game/verify-class-visibility/checks.json`
  - `output/web-game/verify-class-visibility/menu.png`
## Update: unlock reconciliation fix
- Added `reconcileMetaUnlocks(meta)` so completed class requirements unlock immediately on load/save instead of waiting for one more finished run.
- Synced unlock thresholds to `GAME_CONFIG.classUnlockRequirements` inside `app.js`, removing stale legacy values from the UI/meta flow.
- Start menu now shows all mage cards; only the next unlock target shows active requirements, later classes show a previous-class gate message.
- Replaced broken bullet separator in unlock progress text with a plain hyphen.

## Latest verification
- `npm run check` passes.
- `npm run playtest:smoke` passes.
- Targeted meta restore test confirms `Necro` auto-unlocks when stored progress already satisfies its requirement:
  - `output/web-game/verify-unlock-reconcile/checks.json`
