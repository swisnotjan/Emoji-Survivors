# Class-vs-Boss Audit

## Scope

This document audits the current five classes against the active boss roster under the present duel-heavy boss framing. The goal is not to remove dueling pressure, but to identify where matchup risk is too skewed and where the current numbers should be monitored through telemetry.

## Method

Inputs used:

- class baselines from [game-config.js](D:\tryings\vibecoding\emoji-survivors\game-config.js)
- boss stats and unlock windows from [game-config.js](D:\tryings\vibecoding\emoji-survivors\game-config.js)
- skill roles and cooldown cadence from [game-config.js](D:\tryings\vibecoding\emoji-survivors\game-config.js)
- enemy and boss behavior from [app.js](D:\tryings\vibecoding\emoji-survivors\app.js)

External references:

- [Enemy Attacks and Telegraphing](https://www.gamedeveloper.com/design/enemy-attacks-and-telegraphing)
- [A guide to videogame Boss Design](https://kistofe.github.io/Boss-Design/)
- [Meaningful Choice in Games](https://www.gamedeveloper.com/design/meaningful-choice-in-games-practical-guide-case-studies)

## Matchup scale

- `Favored`: class kit naturally answers the boss question
- `Skill`: matchup is fair but depends on execution and build
- `Risky`: matchup is structurally pressured and should be watched in telemetry

## Matchup matrix

| Boss | Wind | Frost | Fire | Necro | Blood |
| --- | --- | --- | --- | --- | --- |
| Crimson Countess | Favored | Skill | Skill | Risky | Skill |
| Grave Colossus | Skill | Favored | Favored | Skill | Risky |
| Abyss Eye | Skill | Favored | Skill | Skill | Risky |
| Brood Matriarch | Favored | Skill | Favored | Favored | Risky |
| Void Harbinger | Skill | Skill | Skill | Risky | Risky |
| Starfall Regent | Skill | Skill | Skill | Skill | Risky |

## Boss-by-boss notes

### Crimson Countess

Question:

- can the player keep a safe lane while the boss repositions and dives?

Read:

- `Wind` is strongest here because pushback and lane-clearing make Countess summons much less oppressive.
- `Frost` is solid, but only if boss control resistance stays disciplined.
- `Necro` is the most fragile here despite high HP because Countess can desync thralls and break formation.
- `Blood` is not unwinnable, but the matchup amplifies every positioning mistake.

Recommendation:

- keep Countess dive damage where it is for now
- monitor `Blood` death timing here first

### Grave Colossus

Question:

- can the player survive heavy telegraphs and capitalize on slow windows?

Read:

- `Frost` and `Fire` both answer the Colossus cleanly: frost converts telegraphs into brittle windows, fire keeps area pressure on a slow target.
- `Blood` is the main risk because the boss asks for disciplined spacing more than burst.
- `Necro` is acceptable if thralls do not obstruct movement reading.

Recommendation:

- do not nerf Colossus until telemetry shows a real skew
- this is a good anchor matchup for testing single-target burst balance

### Abyss Eye

Question:

- can the player read ranged telegraphs and respect beam geometry?

Read:

- `Frost` is currently best-positioned because it can punish beam downtime safely.
- `Wind` stays okay thanks to lateral movement and control against adds.
- `Blood` is under the most pressure because the fight denies free sustain windows.

Recommendation:

- watch for Frost overperformance here before touching the boss itself

### Brood Matriarch

Question:

- can the player solve body pressure and swarm spillover without losing boss focus?

Read:

- `Wind`, `Fire`, and `Necro` all naturally answer the screen state.
- `Blood` is again the most at risk because summons reduce safe lifesteal windows.

Recommendation:

- if Matriarch becomes too easy for Wind/Fire, raise summon timing instead of raw boss HP

### Void Harbinger

Question:

- can the player manage mixed control layers and support pressure at once?

Read:

- this is the most system-stressful boss in the roster.
- `Necro` is risky because screen ownership becomes contested.
- `Blood` is risky because too many simultaneous asks reduce sustain uptime.
- no class currently hard-counters Harbinger, which is healthy.

Recommendation:

- keep Harbinger as the benchmark for “mixed-threat” late-game testing
- use telemetry before making any numeric change

### Starfall Regent

Question:

- can the player maintain rhythm under repeated location denial?

Read:

- this boss is mostly a movement test.
- `Blood` is again the most sensitive because the fight weakens greedy uptime.
- most other classes land in acceptable “Skill” territory.

Recommendation:

- keep Regent dangerous for greedy melee-range play
- avoid adding more ambient pressure here; the duel framing is doing the right job

## Priority tuning risks

### P0: Blood across late bosses

`Blood` should be the highest-skill, highest single-target payoff class. That is good. The problem is not that it has risky matchups. The problem would be if its risky matchups collapse too hard relative to the rest of the cast.

Telemetry to watch:

- run duration by class
- boss defeat rate by class and boss type
- damage taken per minute by class during boss windows

### P1: Frost control conversion

If `Frost` reliably turns every slow boss into a free brittle cycle, it becomes the safest generalist without paying enough for that comfort.

Telemetry to watch:

- boss clear timing for `Frost`
- late-level survival rate for `Frost` vs `Wind`

### P1: Necro screen ownership

`Necro` should feel stable, not cluttered. If late bosses plus thralls plus boss VFX turn the screen unreadable, this becomes a presentation and performance problem before it becomes a numeric one.

Telemetry to watch:

- FPS dips by class during boss encounters
- damage source mix while playing `Necro`

## Recommendations

1. Keep boss encounters duel-focused as requested.
2. Use telemetry before touching boss HP again; bosses now also gain soft HP scaling over time and encounter count.
3. Prioritize audits in this order:
   - `Blood vs Countess`
   - `Blood vs Regent`
   - `Frost vs Colossus`
   - `Necro vs Harbinger`
4. If a boss needs help, prefer tuning pattern cadence or support overlap before raising raw HP.
