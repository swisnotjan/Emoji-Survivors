# Emoji Survivors: Research Notes

## Цель исследования

Собрать минимальный, но корректный фундамент для Survivor-like прототипа:

- управление только перемещением;
- автоатака;
- рост давления через волны;
- читаемые архетипы врагов с разными профилями угрозы;
- стабильный loop и предсказуемая логика симуляции.

## Что взяли из референсов

1. **Формула Vampire Survivors**
- Официальное описание игры указывает на `time survival`, минималистичный геймплей и fantasy "be the bullet hell".
- Для MVP это означает: не перегружать ввод и оставить 1 главный action-verb игрока (перемещение).

2. **Рост давления во времени**
- На вики по Vampire Survivors встречаются явные `timed enemy spawn` события.
- Поэтому директор спавна сделан с сокращающимся интервалом + пакетным спавном (burst) в поздней фазе.

3. **Три архетипа врага для раннего combat-space**
- `grunt`: базовый слабый преследователь, задает плотность.
- `tank`: медленнее, но держит больше урона и сильнее давит при контакте.
- `runner`: хрупкий, но быстрый, ломает "идеальную орбиту" уклонения.

4. **Стабильность симуляции**
- Использован фиксированный шаг (`1/60`) + аккумулятор.
- Это снижает зависимость геймплея от FPS и делает поведение (скорости, кулдауны, урон в секунду) более предсказуемым.

5. **Управление и совместимость**
- Основная карта ввода через `KeyboardEvent.code` (физические клавиши: WASD и стрелки).
- Есть fallback по `event.key`.

6. **Коллизии и массовость**
- Для hit logic применены простые круговые hitbox'ы (дешево и достаточно для top-down прототипа).
- Добавлен легкий enemy separation, чтобы мобы не схлопывались в одну точку.

## Тюнинг первой версии

- Игрок: `HP 100`, скорость `220`, автоогонь каждые `0.34s`.
- Снаряд: урон `24`, скорость `470`, `pierce 1`.
- Враги:
  - `grunt`: `HP 24`, скорость `76`.
  - `tank`: `HP 62`, скорость `48`.
  - `runner`: `HP 16`, скорость `126`.

Баланс выбран так, чтобы:

- первые ~20 секунд игрок устойчиво "читает" бой;
- на 1-2 минуте появляется смешанный pressure и риск от runner/tank комбинаций;
- за счет автоогня решение игрока концентрируется на позиционировании.

## Источники

- Steam: Vampire Survivors  
  https://store.steampowered.com/app/1794680/Vampire_Survivors/
- Poncle (официальное описание/FAQ формулировки по жанровой рамке)  
  https://poncle.games/egs-faq
- Vampire Survivors Wiki (timed spawn behavior и событийные спавны)  
  https://vampire.survivors.wiki/w/The_Drowner
- Gaffer On Games: Fix Your Timestep  
  https://gafferongames.com/post/fix_your_timestep/
- MDN: requestAnimationFrame  
  https://developer.mozilla.org/en-US/docs/Web/API/Window/requestAnimationFrame
- MDN: KeyboardEvent.code  
  https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/code
- MDN: 2D collision detection  
  https://developer.mozilla.org/en-US/docs/Games/Techniques/2D_collision_detection
- Craig Reynolds: Steering Behaviors for Autonomous Characters  
  https://www.red3d.com/cwr/steer/gdc99/

## Leveling and Upgrade Research (2026-04-08)

### What was researched

1. Vampire Survivors style level-up loop:
- Level-up interrupts active gameplay and presents a short random choice set.
- This validates pausing combat during upgrade selection and using a random option pool.

2. Brotato progression references:
- Upgrade rarities are guaranteed at specific level milestones, while the rest are weighted by progression and luck.
- This supports using tier gates and level-weighted rarity instead of fixed per-level rewards.

3. XP curve pacing references:
- Brotato and similar survivor-likes accelerate XP requirements by level, so early levels are frequent but late levels are meaningfully harder.
- This supports a smooth nonlinear XP formula rather than a fixed increment.

4. Combat response references:
- Impulse + damping is a standard model for temporary knockback and velocity recovery in 2D game physics.
- This supports "small pushback + short slow" on hit instead of permanent speed debuffs.

### Design decisions implemented

- XP curve: `xp_to_next(level) = 32 + 10*level + 8*level^1.35`.
  - Early level-ups happen quickly to teach the system.
  - Mid/late levels require sustained kills and stronger builds.

- Enemy XP values:
  - grunt: 8 XP
  - runner: 11 XP
  - tank: 18 XP

- Upgrade pool architecture:
  - No fixed "level N reward" table.
  - Weighted random selection without replacement for each level-up screen.
  - Tier gating:
    - common always available
    - uncommon from level 4+
    - rare from level 9+
  - Recent options get temporary weight penalty to reduce repetition.

- Scaling philosophy:
  - Late-game upgrades have larger effect magnitudes and unlock stronger categories (pierce, split-shot, overdrive, mitigation spikes).
  - Repeatable upgrades have stack caps to avoid infinite runaway scaling.

- Level-up UX:
  - Hard pause while choosing.
  - "Level Up" flash effect.
  - Three options shown each time.

### Additional sources for this iteration

- Vampire Survivors level-up page:
  https://vampire-survivors.fandom.com/wiki/Level_up
- Brotato upgrades and rarity behavior:
  https://brotato.wiki.spellsandguns.com/Upgrades
- Brotato upgrades (fandom mirror with tier table):
  https://brotato.fandom.com/wiki/Upgrades
- Box2D docs (impulses / damping API surface):
  https://box2d.org/doc_version_2_4/functions_func.html

## Enemy and Boss Research (2026-04-08)

### Research focus

- Expand the roster without turning every enemy into "same chaser, different stats".
- Add bosses that feel fair, readable, and large enough to change the playfield.
- Keep the survivor-like pacing rule: new threats should appear as new questions over time, and bosses should test combinations of questions the player has already seen.

### Practical principles used

1. Enemy roles should ask different questions.
- Mike Stout's Game Developer articles frame enemies as questions asked to the player and show why a roster needs distinct archetypes such as swarmer, heavy, far, and near.
- For this project, that means new enemies should not just differ by HP/speed. Each one should force a different movement response.

2. Telegraphing is mandatory in an avoidance-based combat game.
- The Game Developer telegraphing article argues that if players are meant to dodge, they must be told the damage is coming through wind-up time and effects.
- This directly informed the new ranged casts, charge wind-ups, boss dash lines, shockwave circles, and meteor markers.

3. Bosses should test learned skills, not introduce unreadable randomness.
- The boss-design guide emphasizes that bosses work best as mastery checks, should stay visually distinct, and should not rely on inflated HP or unexplained gimmicks.
- That led to two bosses with clear silhouettes, readable telegraphs, and attack sets built from already-taught ideas: projectiles, charges, summon pressure, zones, and shockwaves.

4. Time-based survivor pacing benefits from explicit event stamps.
- Vampire Survivors stage/event documentation reinforces that survivor-like runs work well when major escalations happen at recognizable timestamps.
- That supports unlocking enemy classes and bosses on fixed run times instead of purely random escalation.

### Design decisions derived from the research

#### New regular enemies

- `hexer` (unlock: 45s)
  - Role: ranged keep-away pressure.
  - Question: can the player read a cast and sidestep a projectile while the melee pack still closes?
  - Reason for timing: enters after the player has stabilized against pure contact pressure.

- `fang` (unlock: 95s)
  - Role: telegraphed charger.
  - Question: can the player break their orbit path and sidestep a committed rush?
  - Reason for timing: appears once the player has already seen fast runners and can understand "speed spike plus wind-up".

- `wraith` (unlock: 165s)
  - Role: orbiting zone threat.
  - Question: can the player manage space against enemies that do not simply chase in a straight line?
  - Reason for timing: late enough that the run needs spatial disruption, not only density.

#### Boss pacing

- Boss 1: `Crimson Countess` at 120s
  - Purpose: first real mastery check of the midgame.
  - What it tests:
    - reaction to ranged volleys,
    - reading a long dash line,
    - handling summoned adds while a large target remains active.
  - Why 120s:
    - by then the player has seen contact swarms, tanks, runners, and the first ranged enemy,
    - but the fight still lands early enough to feel like a midpoint climax rather than an endgame wall.

- Boss 2: `Grave Colossus` at 270s
  - Purpose: late-run area-control boss.
  - What it tests:
    - shockwave timing,
    - reading delayed ground impacts,
    - handling a giant body plus adds without losing spacing.
  - Why 270s:
    - late enough that the player should have a partial build online,
    - late enough to justify a slower, heavier boss with stronger zone denial.

### Implemented boss kits

- `Crimson Countess`
  - Very large mobile bat boss.
  - Attacks:
    - blood fan volley,
    - telegraphed swoop dash,
    - add summon cycle.
  - Phase 2:
    - faster cadence,
    - larger volleys,
    - stronger summon mix.

- `Grave Colossus`
  - Very large slow-moving monument boss.
  - Attacks:
    - expanding shockwave slam,
    - delayed meteor/gravefall markers around the player,
    - summon cycle.
  - Phase 2:
    - larger shockwave,
    - denser meteor pattern,
    - faster attack loop.

### External sources for this iteration

- Game Developer, "Enemy Attacks and Telegraphing"
  https://www.gamedeveloper.com/design/enemy-attacks-and-telegraphing
- Game Developer, "Trinity, Part 5 - Setups"
  https://www.gamedeveloper.com/design/trinity-part-5---setups
- A guide to videogame Boss Design
  https://kistofe.github.io/Boss-Design/
- Vampire Survivors wiki, stages and timed events context
  https://vampire-survivors.fandom.com/wiki/Stages

## Boss Escalation and Readability Research (2026-04-08)

### Additional focus

- Make bosses meaningfully harder without turning them into unreadable stat walls.
- Preserve the survivor-like rule that difficulty should rise through layered, legible pressure.
- Improve boss readability when the arena is large and the boss can move off-camera.

### Design conclusions used in this pass

1. Harder bosses should increase decision density, not just HP.
- Based on telegraphing and boss-design references, difficulty is strongest when bosses force more overlapping but still readable choices.
- Applied here as denser phase-2 patterns, more adds, wider projectile spreads, and shorter recovery windows.

2. Boss UI must survive camera separation.
- Large arenas create a readability problem: the player can be fighting screen-space threats while the boss body is off-screen.
- Applied here as a persistent top-of-screen boss HP bar plus an off-screen directional indicator for the primary boss.

3. Damage feedback should be split into local and global channels.
- Strong action-game feedback typically combines avatar reaction and screen-level feedback so hits feel immediate without obscuring control.
- Applied here as player sprite shake plus a stronger red vignette and camera shake on damage.

4. Late bosses should remix learned threat families.
- New bosses were designed as mastery checks over already taught verbs:
  - `Abyss Eye`: ranged control, beam lanes, radial bullet pressure, caster summons.
  - `Brood Matriarch`: area denial, pounce displacement, brood swarms, close-range punishment.

### Sources reused for this pass

- Game Developer, "Enemy Attacks and Telegraphing"
  https://www.gamedeveloper.com/design/enemy-attacks-and-telegraphing
- Game Developer, "Trinity, Part 5 - Setups"
  https://www.gamedeveloper.com/design/trinity-part-5---setups
- A guide to videogame Boss Design
  https://kistofe.github.io/Boss-Design/
## Upgrade Choice and Dash Research (2026-04-08)

### Research focus

- Improve the pause/codex UI without covering the playfield more than necessary.
- Add more upgrades while keeping level-up choices meaningful instead of dominated.
- Add an active dash with charges that feels strong enough to matter, but still sits inside survivor-like pacing.

### Sources used for this pass

- Meaningful Choice in Games: Practical Guide & Case Studies
  https://www.gamedeveloper.com/design/meaningful-choice-in-games-practical-guide-case-studies
- Brotato Wiki: Upgrades
  https://brotato.wiki.spellsandguns.com/Upgrades
- Hades Wiki: Greatest Reflex
  https://hades.wiki.fextralife.com/Greatest%2BReflex
- Vampire Survivors Wiki: Level up
  https://vampire-survivors.fandom.com/wiki/Level_up

### Practical conclusions

1. Dominated upgrade sets are bad choices.
- The Game Developer article frames meaningful choice around player awareness and gameplay consequences.
- For this project that means a level-up screen should not present two or three options that all answer the same question in nearly the same way, such as multiple move-speed offers at once.
- Implemented rule: one option per upgrade family in a single level-up offer set.

2. Survivor-like upgrade pools work best when categories are legible.
- Brotato's upgrade structure is heavily stat-category driven, with tiered quality and readable buckets such as HP, regen, damage, speed, armor, range, and economy.
- Implemented rule: the pool is grouped into explicit families such as damage, cadence, movement, vitality, control, economy, sustain, dash tempo, dash stock, and boss damage.
- Result: the player sees broader build questions instead of micro-variations of the same stat.

3. Extra dash charges are a build-defining mobility reward.
- Hades' Greatest Reflex is a strong reference for how one more dash materially changes survivability and pathing.
- Implemented rule: the run starts with one dash charge, but a dedicated upgrade can expand storage up to five charges.
- To keep the decision space clean, charge count, recharge speed, and dash mastery are split into different upgrade families.

4. Auto-picking upgrades should mirror survivor conventions.
- The Vampire Survivors level-up reference confirms a paused choice screen with unique options, removal of ineligible options, and a random-auto-selection mode via Random LevelUp.
- Implemented rule: Zen Mode now auto-resolves level-ups with no overlay, matching the spirit of a random/automatic level-up mode while preserving the regular paused choice flow outside Zen.

### Math decisions used

- Dash baseline:
  - start charges: 1
  - max charges cap: 5
  - recharge time: 4.8s
  - distance: 240
  - active duration: 0.15s
  - i-frames: 0.16s
- Dash upgrade split:
  - `dashstock`: +1 stored charge per stack, capped at 5 total.
  - `dashstep`: reduces recharge time per stack, but with a hard floor to avoid permanent chain-dash.
  - `phaseweave`: increases dash distance and i-frames rather than raw stock/recharge.
- New upgrade families added in this pass:
  - `reach`, `dashstep`, `moonwell`, `siphon`, `dashstock`, `bossbane`, `phaseweave`.

### UX decisions used

- The pause menu and codex remain one shared surface, but the header now carries the high-frequency actions: Resume and Restart.
- Codex now hides not-yet-unlocked upgrades entirely, because locked rows add noise but not decision value.
- Pause metadata is surfaced as compact chips so the player can inspect run state without losing room for the codex list.
## Boss Reward and Healing Pickup Research (2026-04-08)

### Research focus

- Add a boss-defeat reward flow that feels more special than a normal level-up.
- Keep the reward tied to the identity of the defeated boss instead of giving a generic stat pack.
- Add periodic healing pickups in a way that supports arena navigation and pacing rather than letting the player drift to the edge forever.

### Sources used for this pass

- Vampire Survivors Wiki: Treasure Chest
  https://vampire-survivors.fandom.com/wiki/Treasure_Chest
- Vampire Survivors Wiki: Floor Chicken
  https://vampire-survivors.fandom.com/wiki/Floor_Chicken
- Hades Wiki: Boons
  https://hades.fandom.com/wiki/Boons
- Hades Wiki: Chambers and Encounters
  https://hades.fandom.com/wiki/Chambers_and_Encounters
- Game Developer: Meaningful Choice in Games
  https://www.gamedeveloper.com/design/meaningful-choice-in-games-practical-guide-case-studies

### Practical conclusions used

1. Boss kills should create a stronger reward beat than a normal level-up.
- Vampire Survivors uses boss-linked treasure chests and evolution rewards as a high-salience payoff moment.
- Hades uses room-clear reward beats and boon selection to give major fights a clear emotional release followed by an immediate build decision.
- Applied here: boss deaths now trigger a separate paused overlay with only three large, boss-specific blessings.

2. Reward identity matters.
- The meaningful-choice framing is that the player should understand what question is being asked and what kind of future it changes.
- Applied here: each boss has its own trio of rewards, all themed around that boss's pressure pattern and silhouette instead of sharing one global boss pool.

3. Healing pickups should stabilize pacing, not erase mistakes.
- Floor Chicken in Vampire Survivors is a simple, readable healing pickup that breaks up pure attrition.
- Applied here: heal pickups restore a moderate amount, expire after a while, and are capped on the field so they behave like steering incentives rather than permanent stockpiles.

4. Center-biased pickup spawning is an inference for arena control.
- I did not find a primary source that prescribes this exact spawn rule.
- This is a design inference: in a bounded arena, if healing appears more strongly toward the center when the player approaches an edge, the game can gently pull movement back into the healthier combat space without adding hard anti-edge punishments.
- Applied here: the nearer the player gets to the map edge, the tighter the pickup spawn cone becomes toward the arena center.

### Design choices implemented

- Boss reward flow:
  - separate `boss_reward` pause state;
  - separate overlay, visually stronger than normal level-up;
  - three blessings per boss;
  - mouse and `1/2/3` selection;
  - Zen Mode auto-selects the highest-priority boss blessing.

- Boss reward fantasy mapping:
  - `Crimson Countess`: sustain, storm-fire, aggressive repositioning.
  - `Grave Colossus`: armor, control, anti-boss siege power.
  - `Abyss Eye`: long-range pressure, tempo/knowledge, deep warp mobility.
  - `Brood Matriarch`: swarm sustain, webstorm offense, brute survival.

- Healing pickup rules:
  - periodic spawn timer;
  - capped active count;
  - moderate heal amount;
  - levitating visual presentation;
  - center-biased spawn based on edge pressure.

## 2026-04-08 Milestone Level Research
- Looked at milestone reward framing in survivors/roguelite references before changing every-10-level progression.
- Main sources used:
  - Game Developer: Meaningful choice should preserve real build decisions rather than present numerically redundant options.
  - Hades Wiki / Boons: rarity is a separate axis from level, and higher rarity changes the strength profile of the same boon instead of inventing a new reward type.
  - Vampire Survivors Wiki / Arcanas: large run-defining spikes are delivered as discrete cadence beats instead of flat constant scaling.
- Design inference applied here:
  - every 10th level should feel like a cadence break / power spike;
  - it should reuse the existing upgrade pool, but with a higher rarity floor and stronger effect scaling;
  - this preserves familiarity while still producing a memorable milestone.
- Implemented outcome:
  - every 10th level is now an `Ascendant Level`;
  - all options are promoted to high-rarity presentation and get amplified effect values;
  - ascendant level-up visuals also get extra sparkle VFX so the cadence is visible, not just mathematical.
