# Emoji Survivors Project Context

## What this project is

`Emoji Survivors` is a browser survivor-like game implemented as a plain HTML/CSS/JavaScript project with a single canvas renderer and DOM-based HUD/overlays.

Current live repo:

- GitHub: [https://github.com/swisnotjan/Emoji-Survivors](https://github.com/swisnotjan/Emoji-Survivors)
- GitHub Pages: [https://swisnotjan.github.io/Emoji-Survivors/](https://swisnotjan.github.io/Emoji-Survivors/)

Primary local project path:

- [D:\tryings\vibecoding\emoji-survivors](D:\tryings\vibecoding\emoji-survivors)

The game started as a compact Vampire Survivors-inspired prototype and has since evolved into a multi-class action-survivor with:

- 5 mage classes
- class unlock progression
- minor/major/mastery progression
- random bosses with phase changes
- class skills with custom VFX
- XP pickups, heal pickups, dash, overlays, codex, dev menu, and skill lab

This document is intended as a full handoff reference for any engineer picking the project up cold.

## Product Summary

Core loop:

- player moves with WASD / arrows
- basic attack is auto-targeted
- enemies spawn continuously
- enemies drop XP orbs, player levels up
- progression unlocks skills and upgrades
- periodic bosses spawn
- bosses drop XP and legendary boss rewards
- player eventually dies or ends the run manually

Game feel goals that have already shaped the codebase:

- readable arena combat
- strong class identity
- meaningful level-up choices
- expressive VFX without losing gameplay clarity
- duel-like boss fights
- fast iteration with browser automation and debug helpers

## Tech Stack

There is no framework.

Runtime:

- plain browser JS
- one canvas render surface
- DOM HUD / overlays

Files:

- main game logic: [app.js](D:\tryings\vibecoding\emoji-survivors\app.js)
- data/tuning config: [game-config.js](D:\tryings\vibecoding\emoji-survivors\game-config.js)
- page shell: [index.html](D:\tryings\vibecoding\emoji-survivors\index.html)
- styles: [styles.css](D:\tryings\vibecoding\emoji-survivors\styles.css)

Local tooling:

- static server: [scripts\serve-static.mjs](D:\tryings\vibecoding\emoji-survivors\scripts\serve-static.mjs)
- Pages build prep: [scripts\prepare-pages.mjs](D:\tryings\vibecoding\emoji-survivors\scripts\prepare-pages.mjs)
- local playtest runner: [scripts\run-playtest.mjs](D:\tryings\vibecoding\emoji-survivors\scripts\run-playtest.mjs)

Package scripts:

- `npm run check`
- `npm run serve`
- `npm run playtest:smoke`
- `npm run playtest:skilllab`
- `npm run verify:bosses`
- `npm run verify:majors`
- `npm run verify:telemetry`

## Architecture Overview

The game is effectively a state machine plus a render pipeline.

High-level structure:

- `GAME_CONFIG` contains most tunable data
- `createInitialState()` builds a full run state
- `update()` advances simulation
- `render()` draws world and HUD
- overlays and menus are DOM, not canvas

Important architectural choices:

- simulation is deterministic enough for scripted testing because `window.advanceTime(ms)` exists
- `window.render_game_to_text()` exposes a concise JSON snapshot for automation
- debug controls are exposed through `window.debug_game`
- the game relies on imperative state mutation, not immutable reducers or ECS

This means:

- iteration is fast
- data is easy to inspect
- but changes require discipline because many systems share one large state object

## Major Runtime Systems

### 1. Meta Progress

Meta progression is stored in local storage.

Key fields:

- unlocked classes
- selected class
- current unlock target
- XP and kill progress toward next class
- lifetime totals

Current storage key:

- `emoji-survivors-meta-v2`

Important design decision:

- all classes are visible in the start menu
- only the next locked class shows active requirements
- later classes show a gate message requiring the previous class first

Important fix already made:

- if stored unlock progress already satisfies the next class requirements, the game now reconciles and unlocks that class immediately on load/save
- this logic lives in `reconcileMetaUnlocks(meta)` in [app.js](D:\tryings\vibecoding\emoji-survivors\app.js)

### 2. Run Progression

Progression cadence is intentionally segmented:

- ordinary levels: minor upgrades
- level 5 / 15 / 25: unlock class skill slot 1 / 2 / 3
- level 10 / 20 / 35 / 45 ...: major pair choices
- level 30 / 40 / 50 ...: mastery choice

Boss rewards are a separate system from level progression.

Progression layers:

- class passive
- class skill slots
- minor upgrades
- major upgrades
- slot mastery
- legendary boss rewards

### 3. Class System

There are 5 classes:

- Wind Mage
- Frost Mage
- Fire Mage
- Necromancer
- Blood Mage

All classes share:

- same base auto-attack shape
- same control scheme
- same general progression rules

Classes differ through:

- base numbers
- passive effect on auto attack / movement / sustain
- 3 class skills
- VFX palette
- player skin emoji

Current intended class identities:

- `wind`: control space and movement
- `frost`: chill/freeze/brittle control
- `fire`: burn and area denial
- `necro`: pierce, thralls, attrition tanking
- `blood`: high-risk sustain/crit duelist

### 4. Enemy System

Enemy roster currently includes:

- `grunt`
- `tank`
- `runner`
- `hexer`
- `fang`
- `wraith`
- `oracle`
- `brood`
- `banner`
- `mortar`
- `bulwark`

Design coverage by role:

- melee swarm pressure
- high-speed flankers
- ranged casters
- artillery
- support/buffing threats
- mini-elite bruiser pressure

### 5. Boss System

Boss roster:

- `countess`
- `colossus`
- `abyss`
- `matriarch`
- `harbinger`
- `regent`

Bosses are chosen by a director with random weighted selection.

Important behavior:

- bosses spawn in randomized timing windows rather than a single fixed schedule
- each boss has phases
- each boss can only be defeated a limited number of times per run
- bosses now give XP again

Boss HUD:

- top-screen boss name and HP
- two stacked HP bars representing phase segments

Important bug that was already fixed:

- phase changes previously crashed render because `drawEnemies()` referenced missing `BOSS_THEME_COLORS`
- this is fixed in [app.js](D:\tryings\vibecoding\emoji-survivors\app.js)

### 6. Skill System

Each class has:

- 1 passive
- 3 active skills

In the main game:

- active skills auto-cast on cooldown

In the skill lab:

- skills can be manually cast by clicking the HUD slots
- cooldowns can be forced to zero for repeated testing

Skill UI:

- compact bottom HUD cards
- cooldown overlay fill
- locked/ready/charging/active states
- hover tooltip with title, slot, role, targeting, description

Important layering rule:

- player skill VFX should render under pickups, enemy projectiles, enemy telegraphs, enemies, and thralls
- this was requested specifically for combat readability

### 7. Upgrade System

#### Minor upgrades

Minor upgrades are regular level-up rewards.

They are intended to be:

- positive-only
- universal across classes
- style-shaping rather than purely numeric clutter

#### Major upgrades

Major upgrades are presented as a fixed pair of opposing build directions.

Current major design:

- presented as 2-card choices
- no permanent opposite-side lock anymore
- both sides of a pair can be taken in one run
- each side has ranks
- ranks use diminishing returns

This change was deliberate:

- earlier versions permanently locked the opposite side
- that prevented long-run “broken build” fantasies
- the current design preserves choice by timing and rank value instead of permanent exclusion

#### Mastery

Mastery lets the player choose which class slot to empower.

Current rule:

- mastery choice is by slot
- exact mastery effect is encoded per class/slot, not chosen from a generic pool

### 8. Pickups

Current pickups:

- XP orbs
- heal pickups
- large XP cache / boss XP drops

Current behavior:

- pickups magnetize to player
- absorption speed increases with proximity
- pickups can fade and expire

Important visual layering rule:

- pickups should render above player skill VFX

### 9. Map / Terrain

Current map direction:

- darker tile palette
- grass / sand / stone / water
- water is blocked for movement
- no solid rock obstacles currently active in the live playfield

The terrain system has gone through multiple iterations.

Current simplification:

- rocks were removed again for performance and pathing simplicity
- water remains as terrain identity and movement constraint

### 10. Telemetry

Telemetry exists and is important.

Current telemetry captures:

- level timings
- reward choices
- boss spawns / defeats
- total damage taken
- damage taken by source
- run-final data

Access:

- `window.debug_game.getTelemetryHistory()`
- `window.debug_game.getLastTelemetryRun()`
- `window.debug_game.clearTelemetryHistory()`

This is central to future balancing work.

## Data Separation and Config

The project originally had too much balancing data hardcoded in [app.js](D:\tryings\vibecoding\emoji-survivors\app.js).

It was partially moved into [game-config.js](D:\tryings\vibecoding\emoji-survivors\game-config.js).

What is already in config:

- terrain palettes
- XP curve
- enemy scaling
- major upgrade ranks and weights
- spawn director values
- spawn roster
- boss unlock times and random weights
- class unlock requirements
- enemy archetypes
- class definitions

What still remains in `app.js` and could be moved later:

- some upgrade presentation logic
- portions of skill tuning
- some boss pattern timing
- certain VFX constants

## Rendering and Layering

Canvas render order matters a lot in this project.

Current important ordering:

- background / terrain
- low player skill effects
- pickups
- projectiles
- enemy attacks / telegraphs
- allies / thralls
- enemies / bosses
- damage numbers
- indicators
- player
- screen-space effects

Any visual bug report about “can’t see X” is likely a render-order issue first, not just an opacity issue.

## VFX Direction

The project spent a lot of time iterating on skill VFX.

Current principles:

- soft gradients instead of hard outlines
- multiple palette tones per school, not one color to transparent
- readable core silhouette first
- then secondary motion
- then soft tail/fade
- do not overuse white
- avoid VFX hiding telegraphs or targets

Known VFX-specific design outcomes:

- player skill VFX should look rich and alive
- enemy attacks and telegraphs must remain clearer than player cosmetics
- skill VFX are intentionally under enemies and hostile telegraphs now

## UI / Overlay System

Main UI surfaces:

- start/class selection overlay
- bottom status cluster with level/dash/HP/XP/skills
- pause/codex overlay
- dev menu inside pause overlay
- level-up overlay
- boss reward overlay
- game-over summary overlay
- skill lab

UI is DOM/CSS, not canvas.

This is deliberate because:

- it made iteration faster
- hover/click interactions are simpler
- card layouts are easier than drawing everything in canvas

## Skill Lab

Separate page:

- [skill-lab.html](D:\tryings\vibecoding\emoji-survivors\skill-lab.html)

Purpose:

- manual casting and VFX review
- spawning immortal training dummy
- class switching
- repeated skill spam without normal cooldown pressure

Important when tuning VFX:

- use skill lab first
- only after that validate in real gameplay

## Testing / Verification Workflow

The project relies heavily on browser automation and targeted verification scripts.

Main runtime smoke:

- `npm run playtest:smoke`

There are many focused verification scripts in repo root, for example:

- [verify-boss-random-balance.mjs](D:\tryings\vibecoding\emoji-survivors\verify-boss-random-balance.mjs)
- [verify-major-scaling.mjs](D:\tryings\vibecoding\emoji-survivors\verify-major-scaling.mjs)
- [verify-telemetry-balance.mjs](D:\tryings\vibecoding\emoji-survivors\verify-telemetry-balance.mjs)
- [verify-class-behavior.mjs](D:\tryings\vibecoding\emoji-survivors\verify-class-behavior.mjs)

Artifacts are written under:

- [output\web-game](D:\tryings\vibecoding\emoji-survivors\output\web-game)

Important caveat:

- `output/` is intentionally excluded from git and GitHub Pages publishing

## Deployment

GitHub Pages is configured through:

- [deploy-pages.yml](D:\tryings\vibecoding\emoji-survivors\.github\workflows\deploy-pages.yml)

Pages build process:

- copies only runtime files into `.dist-pages/`
- publishes static artifact via GitHub Actions

Files included in Pages artifact:

- `index.html`
- `styles.css`
- `app.js`
- `game-config.js`
- `favicon.svg`

This prevents test artifacts and local tooling from leaking into the public site.

## Current State of Git

There are two important git contexts:

1. parent workspace repo at `D:\tryings\vibecoding`
2. dedicated game repo at `D:\tryings\vibecoding\emoji-survivors`

The game now has its own `.git` directory and is pushed independently to GitHub.

Important environment quirk encountered:

- this machine sometimes triggers git `dubious ownership` checks on the project path
- commands were often run with:
  - `git -c safe.directory=D:/tryings/vibecoding/emoji-survivors ...`

If git starts acting inconsistent again, check safe-directory handling first.

## Known Historical Bugs Already Fixed

These are worth knowing so they are not reintroduced:

- boss phase transition crash due to missing `BOSS_THEME_COLORS`
- class unlock state not reconciling when stored requirements were already satisfied
- start menu hiding later classes too aggressively
- mojibake for class skins and HUD icons on production
- boss HUD previously implemented as wrong phase representation
- Countess phase transition instability mitigated with explicit `phase-shift`
- Pages deploy pipeline existed but site stayed down until Pages source was configured

## Known Remaining Risks / Areas to Watch

### 1. Encoding regressions

This project has already been bitten by encoding corruption more than once.

Safe rule:

- prefer Unicode escapes in JS for emoji literals that are critical to gameplay
- prefer HTML entities in `index.html` for static glyphs

### 2. Large `app.js`

`app.js` is still big and central.

That is workable, but risky.

Most likely future maintenance pain:

- touching unrelated systems by accident
- hard-to-track regressions in render order
- duplicated values between config and logic

### 3. Balance is improved but not “finished”

There has already been a large balance pass, but the game is still in a tuning-heavy phase.

Most sensitive balance areas:

- Blood Mage runaway or undertuned sustain
- Necromancer survivability and thrall readability/performance
- major upgrade stacking at long run durations
- late boss pressure vs class-specific strengths

### 4. Pages deploy depends on repo settings

Workflow is present, but GitHub Pages must remain configured to deploy from Actions.

If the site goes 404 again:

- first check Actions runs
- then check repository Pages settings

## Important Game Design Decisions

These decisions appear repeatedly across the codebase and should not be changed casually.

### Classes should feel genuinely different

The class system is not just cosmetic.

Do not collapse class identity by:

- moving too many class-defining effects into universal upgrades
- flattening all passives into generic stat bonuses

### Major upgrades should enable late-run fantasies

The current direction explicitly allows:

- stacking both sides of a pair eventually
- high projectile counts
- high mobility stacks

This was a conscious change away from permanent locks.

### Boss fights should feel duel-like

The game intentionally reduces ambient pressure during active bosses.

That is by design.

It makes bosses feel more readable and personal.

### VFX should be expressive but never hide danger

The player asked for stronger VFX, but also for hostile cues to remain visible.

The project has repeatedly adjusted layer ordering to satisfy this.

## File Map: What to Open First

If you are debugging a specific topic, start here:

### Core runtime

- [app.js](D:\tryings\vibecoding\emoji-survivors\app.js)

### Data and balancing

- [game-config.js](D:\tryings\vibecoding\emoji-survivors\game-config.js)
- [balance-audit.md](D:\tryings\vibecoding\emoji-survivors\balance-audit.md)
- [class-vs-boss-audit.md](D:\tryings\vibecoding\emoji-survivors\class-vs-boss-audit.md)

### Project history / context

- [progress.md](D:\tryings\vibecoding\emoji-survivors\progress.md)
- [research.md](D:\tryings\vibecoding\emoji-survivors\research.md)
- [dev-retrospective.md](D:\tryings\vibecoding\emoji-survivors\dev-retrospective.md)

### Deployment

- [package.json](D:\tryings\vibecoding\emoji-survivors\package.json)
- [deploy-pages.yml](D:\tryings\vibecoding\emoji-survivors\.github\workflows\deploy-pages.yml)
- [prepare-pages.mjs](D:\tryings\vibecoding\emoji-survivors\scripts\prepare-pages.mjs)

### UI

- [index.html](D:\tryings\vibecoding\emoji-survivors\index.html)
- [styles.css](D:\tryings\vibecoding\emoji-survivors\styles.css)

### Manual VFX / skill testing

- [skill-lab.html](D:\tryings\vibecoding\emoji-survivors\skill-lab.html)
- [skill-lab-bootstrap.js](D:\tryings\vibecoding\emoji-survivors\skill-lab-bootstrap.js)

## Recommended Next Steps

If another engineer continues this project, the best next moves are:

1. move more tuning data from `app.js` into `game-config.js`
2. add a small Pages/status checklist to `README`
3. continue telemetry-driven balance on:
   - Blood vs late bosses
   - Necro sustain and thrall performance
   - major stack pacing in long runs
4. clean remaining text separators and normalize all UI strings to ASCII-friendly punctuation where reasonable
5. keep using Unicode escapes/entities for any new emoji introduced into code

## Bottom Line

This is no longer a throwaway prototype.

It is a feature-rich browser action-survivor with:

- real progression architecture
- real class identity
- boss systems
- testing workflow
- deployment pipeline

The project is already in the phase where the main work is:

- careful balancing
- polish
- maintainability improvements

The biggest practical risks are no longer “missing features”.

They are:

- regressions from the large imperative runtime
- rendering/layering side effects
- encoding issues
- and slow balance drift as more content is added.
