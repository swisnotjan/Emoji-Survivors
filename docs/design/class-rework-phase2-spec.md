# Class Rework Phase 2 Spec

Date: 2026-04-16

Purpose: replace the current class identity mapping with a cleaner roster split:

- `wind`: mobility-control mage
- `frost`: crit-control mage
- `fire`: burn-AoE mage
- `necro`: fragile summoner
- `blood`: blood tank

This document is intended as an implementation-ready spec for a second class overhaul pass. It supersedes the role assumptions in the earlier rework spec, but does not require throwing away the existing code architecture.

Primary files:

- [game/foundation.js](D:\tryings\vibecoding\Games\emoji-survivors/game/foundation.js)
- [game/runtime.js](D:\tryings\vibecoding\Games\emoji-survivors/game/runtime.js)
- [game/render.js](D:\tryings\vibecoding\Games\emoji-survivors/game/render.js)
- [scripts/verify/verify-class-behavior.mjs](D:\tryings\vibecoding\Games\emoji-survivors/scripts/verify/verify-class-behavior.mjs)

## 1. Design goals

The current role map still has two overlaps:

- `necro` and `blood` both lean into attrition and survivability
- `frost` and `blood` both touch spike damage identities

The new map should separate the source of power for each class:

- `wind`: wins by movement and tempo control
- `frost`: wins by critting controlled targets
- `fire`: wins by burn ramp and clustered AoE
- `necro`: wins by persistent board ownership through summons
- `blood`: wins by standing power, sustain, and face-tank pressure

The key requirement is that each class should now answer a different combat question.

## 2. Research principles

### 2.1 Orthogonal differentiation

Classes should not differ only by higher or lower versions of the same metric. The strongest versions of the roster make each choice feel like a different combat toolset, not a recolor.

Source:

- [The Level Design Book: Enemy design](https://book.leveldesignbook.com/process/combat/enemy)

### 2.2 Readable payoff loops

If a class gains power from setup, risk, or states on enemies, the player should be able to read when the payoff is online.

Applied here:

- frost crit windows must clearly follow chill/freeze/brittle setup
- blood tank windows must clearly follow entering or holding ground
- necro summon power must clearly follow summon count and summon uptime

Source:

- [Game Developer: Enemy Attacks and Telegraphing](https://www.gamedeveloper.com/design/enemy-attacks-and-telegraphing)

### 2.3 Cost should match fantasy

Power should come from a cost that matches the class fantasy:

- wind pays with low damage
- frost pays with dependency on control windows
- fire pays with low safety
- necro pays with personal fragility
- blood pays with low mobility and commitment risk

Source:

- [The Level Design Book: Combat](https://book.leveldesignbook.com/process/combat)

## 3. Constraints

Do not redesign the whole combat engine.

Preferred implementation style:

- reuse `CLASS_DEFS`
- reuse current skill ids where possible
- move logic by retargeting existing helpers such as:
  - `computePlayerProjectileDamage()`
  - `applyHitResponse()`
  - `updatePlayerClassBuffs()`
  - `cast...` helpers
  - `applyZoneTick()`

Avoid:

- introducing a new generic combat framework
- adding deep upgrade-system dependencies before the class identities are stable

## 4. New class map

### Wind

Primary answer:

- safest movement and best repositioning

What only wind should feel best at:

- opening escape paths
- traversing projectile screens
- correcting bad positioning

Cost:

- weakest throughput
- weakest boss kill speed

### Frost

Primary answer:

- crit burst against prepared targets

What only frost should feel best at:

- turning setup into execution
- killing elites or bosses during control windows

Cost:

- crits should depend on setup, not be always-on
- poor against chaotic spread fights compared to fire

### Fire

Primary answer:

- strongest clustered damage

What only fire should feel best at:

- deleting dense waves
- punishing enemies that path through persistent zones

Cost:

- weak emergency safety
- weak precision

### Necro

Primary answer:

- summon-led screen control

What only necro should feel best at:

- owning space with many bodies
- maintaining pressure through multiple autonomous units

Cost:

- fragile player body
- weak direct dueling

### Blood

Primary answer:

- tanking pressure and sustaining through close combat

What only blood should feel best at:

- holding ground inside enemy density
- surviving long close-range trades

Cost:

- much lower mobility than wind
- less burst volatility than old blood

## 5. Detailed class specs

## 5A. Wind Mage

### Target profile

- fastest class
- average HP
- lowest damage
- strongest utility

### Stat direction

Recommended first-pass values:

- `autoDamage`: `17-19`
- `speedMultiplier`: `1.2-1.24`
- `maxHpMultiplier`: `0.96-1.0`
- `dash.rechargeTime`: slightly better than current baseline
- keep strong wind knockback and projectile denial

### Passive

Passive fantasy:

- always in motion
- gains value from moving and repositioning

Recommended passive:

- movement speed bonus
- wind skills create short mobility windows
- auto attacks keep strong displacement

Minimal implementation:

- keep current wind control logic
- add a short move-speed burst when a wind skill is cast or while a wind skill is active

### Skill goals

`gale-ring`
- panic tool
- anti-projectile shield
- short movement freedom window

`crosswind-strip`
- corridor creator
- strongest reposition skill in the game
- should help both advancing and retreating

`tempest-node`
- setup anchor for safe rerouting
- should manipulate traffic more than kill enemies

### Mastery bias

- area
- duration
- movement utility
- projectile denial reliability

### Guardrails

- do not let wind become a safe high-DPS generalist
- do not add hidden damage steroids to compensate for speed

## 5B. Frost Mage

### Target profile

- medium speed
- average HP
- medium damage floor
- very high damage ceiling during control windows

### Stat direction

Recommended first-pass values:

- `autoDamage`: `22-24`
- `speedMultiplier`: `1.0`
- `maxHpMultiplier`: `1.0`
- base crit chance: low or zero outside setup

### Crit model

Crits move from `blood` to `frost`.

Important rule:

- frost crits must be state-dependent, not generic RNG DPS

Recommended first implementation:

- no meaningful baseline crit chance on neutral targets
- increased crit chance against:
  - `chilled`
  - `frozen`
  - `brittle`
- `crystal-spear` gets the strongest crit conversion

Recommended shape:

- neutral target: little or no crit
- chilled target: moderate crit chance
- brittle target: high crit chance or guaranteed crit on spear

### Passive

Recommended passive text:

- "Auto attacks stack Chill. Controlled enemies are vulnerable to critical hits, and Brittle targets are your cleanest execution windows."

### Skill goals

`blizzard-wake`
- fast setup engine
- should rapidly prepare nearby enemies for crit conversion

`permafrost-seal`
- delayed setup spike
- should create the clearest "crit now" moment

`crystal-spear`
- execution tool
- highest single-target payoff in the class
- should be the primary crit finisher

### Mastery bias

- chill application
- brittle duration
- crit conversion reliability

### Guardrails

- do not let frost crit constantly on unprepared enemies
- do not make frost better than blood at face-tanking

## 5C. Fire Mage

### Target profile

- unchanged core role
- keeps burn-AoE identity

### Stat direction

- `autoDamage`: `22-24`
- `speedMultiplier`: `1.0`
- `maxHpMultiplier`: `0.94-0.98`

### Passive

No fundamental role change needed.

Fire remains:

- the strongest clustered AoE class
- the ramping burn class

### Skill goals

No class-fantasy rewrite required.

Current direction remains correct:

- `cinder-halo`: local panic burn
- `sunspot`: sustained zone
- `ash-comet`: burst into persistent burn field

### Guardrails

- do not let later class changes accidentally give fire crit or tank identity

## 5D. Necromancer

### Target profile

- low HP
- low personal damage
- medium mobility
- highest summon count and summon uptime

### Stat direction

Recommended first-pass values:

- `autoDamage`: `14-16`
- `speedMultiplier`: `0.98-1.02`
- `maxHpMultiplier`: `0.72-0.82`
- projectile pierce can remain, but should be secondary to summon identity

### Core fantasy

Necro is no longer a density tank.

Necro should now feel like:

- a fragile commander
- protected by bodies, not by personal HP
- strongest when the board contains many green summons

### Passive

Recommended passive:

- auto attacks pierce and mark enemies
- marked kills or marked targets feed summon generation
- summon cap increases
- summon count is the defensive screen, not player HP

Recommended passive text:

- "Auto attacks pierce and mark enemies. Marked kills and necrotic skills call additional Thralls, and your summon cap is increased."

### Summon direction

Required changes:

- increase max active summons
- reduce dependence on rare corpse availability
- make summon generation much more consistent

Recommended first-pass direction:

- active thrall cap from `6` to around `9-10`
- kills from marked enemies have improved summon chance
- `grave-call` should always generate multiple bodies, not just one fallback summon

### Skill rewrite

`bone-ward`
- change from personal grinder to orbiting summon shell
- should spawn several skulls or wards that act like defensive minions
- purpose: protect the fragile necro body and add visible summon density

`requiem-field`
- change from self-centered attrition field to summon amplifier field
- inside the field:
  - summons move faster
  - summons hit harder
  - enemies are weakened or slowed
- purpose: create a command zone

`grave-call`
- must become the primary summon spike skill
- should pull corpses into multiple fresh summons
- if no corpses exist, should still create several temporary green skull thralls

### Mastery bias

- summon count
- summon uptime
- summon durability
- summon command-field effectiveness

### Guardrails

- necro player body must remain fragile
- do not recreate tank-necro by stealth through personal DR or high HP
- summon count must stay readable and performant

## 5E. Blood Mage

### Target profile

- high HP
- medium or low speed
- no crit identity
- strongest close-range sustain

### Stat direction

Recommended first-pass values:

- `autoDamage`: `22-24`
- `speedMultiplier`: `0.92-0.98`
- `maxHpMultiplier`: `1.35-1.5`
- remove crit chance and crit multiplier hooks from blood

### Core fantasy

Blood is now a bruiser/tank, not an assassin.

Blood should feel like:

- the class most willing to stand in the fight
- the class that stabilizes through blood conversion
- the class with the strongest short-range sustain and hold-ground play

### Passive

Recommended passive:

- auto attacks lifesteal
- blood-marked enemies improve sustain or reduce incoming damage
- blood becomes stronger when already committed to the fight, not when staying mobile

Recommended passive text:

- "Auto attacks drain life. Blood-marked enemies feed your sustain, and blood magic hardens you while you hold your ground."

### Skill rewrite

`vein-burst`
- no longer assassin bailout
- should become a short-range bruiser slam
- on cast:
  - damage nearby enemies
  - gain brief damage reduction, barrier, or blood armor

`crimson-pool`
- becomes the class's hold-ground zone
- inside the pool:
  - blood mage heals more
  - blood mage is harder to kill
  - enemies are softened or slowed

`blood-rite`
- no longer HP-spend crit steroid
- becomes tank stance / overdrive
- recommended effect:
  - short blood fortress window
  - stronger lifesteal
  - stronger DR
  - stronger close-range damage conversion

Optional design choice:

- remove HP cost entirely if the tank fantasy reads cleaner without it

### Mastery bias

- sustain conversion
- defensive uptime
- hold-ground zone strength

### Guardrails

- do not keep leftover crit logic on blood
- do not let blood become both tankiest and fastest
- blood should survive through commitment, not through kiting

## 6. Implementation plan

Implement in this order:

1. Move crit logic from `blood` to `frost`
2. Rebuild `blood` passive and skills as bruiser/tank tools
3. Lower `necro` player durability and increase summon count/consistency
4. Rework `bone-ward` and `requiem-field` around summon identity
5. Increase `wind` mobility and movement windows
6. Final numeric balance pass

## 7. Concrete code targets

### `game/foundation.js`

Update:

- `CLASS_DEFS`
- passive text
- descriptions
- skill summary text where it conflicts with the new role

### `game/runtime.js`

Update:

- `createInitialState()`
- `computePlayerProjectileDamage()`
- `applyHitResponse()`
- `updatePlayerClassBuffs()`
- `castBoneWard()`
- `castRequiemField()`
- `castGraveCall()`
- `castVeinBurst()`
- `castCrimsonPool()`
- `castBloodRite()`
- `applyZoneTick()`
- summon creation helpers and summon cap logic

### `game/render.js`

Potential updates:

- clearer frost crit feedback
- stronger necro summon readability if summon count rises further
- tank-blood feedback during hold-ground windows

### `scripts/verify/verify-class-behavior.mjs`

Update checks to confirm:

- `wind` moves faster and still clears projectiles
- `frost` crits or pseudo-crits only after setup
- `necro` gets more summons while having lower HP
- `blood` no longer exposes crit behavior and instead shows defensive/sustain windows

## 8. First-pass numbers

These are recommended starting points, not final balance.

### Wind

- `autoDamage`: `18`
- `speedMultiplier`: `1.22`
- `maxHpMultiplier`: `0.98`

### Frost

- `autoDamage`: `23`
- `speedMultiplier`: `1.0`
- `maxHpMultiplier`: `1.0`
- crit chance:
  - neutral: `0-3%`
  - chilled: `12-18%`
  - brittle: `30-45%`
  - spear on brittle: can be guaranteed crit if needed

### Fire

- `autoDamage`: `23`
- `speedMultiplier`: `1.0`
- `maxHpMultiplier`: `0.96`

### Necro

- `autoDamage`: `15`
- `speedMultiplier`: `1.0`
- `maxHpMultiplier`: `0.78`
- summon cap: `9` as first pass

### Blood

- `autoDamage`: `23`
- `speedMultiplier`: `0.95`
- `maxHpMultiplier`: `1.42`
- no crit hooks

## 9. Definition of done

This phase is successful when:

- wind is visibly the fastest and best at repositioning
- frost visibly spikes hardest when it has already controlled a target
- necro is visibly fragile without summons but overwhelming with summon uptime
- blood visibly survives through bruiser/tank tools rather than crit volatility
- fire still owns clustered AoE
- none of the five classes feel like minor variants of one another

## 10. Sources

- [The Level Design Book: Combat](https://book.leveldesignbook.com/process/combat)
- [The Level Design Book: Enemy design](https://book.leveldesignbook.com/process/combat/enemy)
- [Game Developer: Enemy Attacks and Telegraphing](https://www.gamedeveloper.com/design/enemy-attacks-and-telegraphing)
- [Game Developer: Meaningful Choice in Games](https://www.gamedeveloper.com/design/meaningful-choice-in-games-practical-guide-case-studies)
