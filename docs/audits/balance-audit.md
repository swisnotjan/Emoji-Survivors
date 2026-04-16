# Balance Audit

## Scope

This pass focused on four systemic issues:

1. Boss encounters were only partially random.
2. The enemy roster lacked support, artillery, and mini-elite pressure roles.
3. Late-run pressure skewed too hard toward familiar threat families.
4. Progression cadence needed a cleaner relationship between skill unlocks, milestone choices, and boss beats.

## Research used

- Game Developer, "Enemy Attacks and Telegraphing"  
  https://www.gamedeveloper.com/design/enemy-attacks-and-telegraphing
- Game Developer, "Trinity, Part 5 - Setups"  
  https://www.gamedeveloper.com/design/trinity-part-5---setups
- Game Developer, "Meaningful Choice in Games: Practical Guide & Case Studies"  
  https://www.gamedeveloper.com/design/meaningful-choice-in-games-practical-guide-case-studies
- Game Developer, "The Rational Design Handbook: Four Primary Metrics"  
  https://www.gamedeveloper.com/design/the-rational-design-handbook-four-primary-metrics
- A guide to videogame Boss Design  
  https://kistofe.github.io/Boss-Design/
- Brotato Wiki, "Upgrades"  
  https://brotato.wiki.spellsandguns.com/Upgrades
- Vampire Survivors Wiki, "Stages"  
  https://vampire-survivors.fandom.com/wiki/Stages

## Audit findings before the pass

### 1. Boss randomness was incomplete

- The game already randomized boss type, but encounter timing was still fixed.
- That meant the player could learn exact boss timestamps and the run cadence still felt scripted.
- It also meant the design was only random in roster selection, not in pressure timing.

### 2. Threat-role coverage was incomplete

The roster already covered:

- baseline melee (`grunt`)
- fast flankers (`runner`)
- heavy stat checks (`tank`)
- ranged casters (`hexer`, `oracle`)
- chargers (`fang`)
- orbit/pulse flyers (`wraith`)
- swarm heavies (`brood`)

The missing roles were:

- support priority target
- long-range artillery that punishes static play
- bruiser/mini-elite that creates local area denial without being a boss

### 3. Boss families were skewed toward already-covered behaviors

Existing bosses covered:

- mobile pressure + summon (`countess`)
- brute zone shockwaves (`colossus`)
- ranged beam/radial control (`abyss`)
- brood/pounce swarm pressure (`matriarch`)

The missing boss-level fantasies were:

- support/command boss that changes nearby enemies
- true artillery/constellation boss that pressures player location over time

### 4. Progression pacing was still slightly front-loaded

The previous XP curve was:

- `44 + level * 14 + level^1.48 * 8`

That produced these cumulative thresholds:

- level 5: `449`
- level 10: `1883`
- level 15: `4533`
- level 20: `8599`
- level 25: `14245`
- level 30: `21615`

This was workable, but in practice it delivered the midgame a bit early once field XP and boss rewards started stacking.

## Changes implemented

## Addendum: telemetry and XP economy pass

After the original pass, two more systemic issues were addressed:

### Real run telemetry

The game now records:

- level timings
- reward choices
- boss spawn/defeat timings
- incoming damage by source
- recent damage history
- final run summary payload

Why this matters:

- future balancing no longer needs to rely on feel alone
- class-vs-boss matchup tuning can be measured instead of guessed
- XP pacing can be compared against actual level timing targets

### Enemy XP economy rebalance

XP was reweighted so later and stronger enemies are more worthwhile than early or weak ones.

Current baseline:

- `grunt`: `8`
- `runner`: `9`
- `tank`: `20`
- `hexer`: `16`
- `fang`: `19`
- `wraith`: `24`
- `oracle`: `30`
- `brood`: `38`
- `banner`: `36`
- `mortar`: `42`
- `bulwark`: `56`

Design intent:

- fast fragile trash is still good tempo XP, but no longer the dominant farm target
- elites and late threats are clearly worth killing
- progression should reward solving harder board states, not only vacuuming runners

### Boss encounter director

Replaced fixed boss schedule with a defeat-driven random encounter director.

Rules now:

- first boss arrives after a random early gap
- every later boss is scheduled from a random gap window
- no second boss can stack on top of a living boss
- boss type is still weighted and anti-repeat filtered
- each boss can still only be defeated 3 times

Gap windows used:

- encounter 1: `112s - 132s`
- encounter 2: `120s - 146s`
- encounter 3: `132s - 160s`
- encounter 4: `146s - 178s`
- later encounters widen up to `170s - 208s`

Design effect:

- the run retains readable pacing
- boss timing is no longer memorized to exact seconds
- later runs feel less scripted even on the same map

### New enemy roles

#### `banner`

Role:

- support priority target
- buffs nearby enemies with haste

Reason:

- adds target-priority decisions
- punishes ignoring support pieces
- gives the roster a non-damage threat that still meaningfully changes pressure

#### `mortar`

Role:

- long-range artillery
- punishes standing still with delayed burst clusters

Reason:

- forces relocation without requiring boss presence
- improves the value of dash and movement builds

#### `bulwark`

Role:

- mini-elite bruiser
- slow frontline that creates a local shockwave zone

Reason:

- fills the gap between stat-heavy `tank` and true boss pressure
- creates spatial danger without relying on projectile spam

### New boss archetypes

#### `harbinger` / `Void Harbinger`

Design role:

- command-and-control boss
- mixes lattice beams, blink volleys, and enemy empowerment

What it adds:

- a boss that changes the rest of the screen state instead of only attacking the player directly
- more pressure on target priority and positioning under mixed threats

#### `regent` / `Starfall Regent`

Design role:

- artillery constellation boss
- uses meteor constellations, orbital burst rings, and support reinforcements

What it adds:

- sustained location pressure
- stronger anti-turtle play
- a late-run boss that checks movement rhythm more than raw face-tanking

### Spawn pacing

Normal wave director tuned to reduce clutter and make room for the new roles:

- `baseInterval`: `1.04`
- `minInterval`: `0.24`
- `maxEnemiesOnField`: `280`

This is a deliberate performance and readability compromise:

- fewer total bodies
- more differentiated threats
- less late-run visual sludge

### XP curve

## Addendum: stackable major upgrades and late-run HP scaling

Two more systemic changes were added after the telemetry pass.

### Stackable major pairs

Major milestone upgrades no longer permanently lock the opposite side of a pair.

New rules:

- major rewards still present a fixed pair of opposing directions
- choosing one side does not ban the other side later in the run
- both sides can now be stacked over time
- each major now has ranked gains with diminishing returns
- the same pair is less likely to appear twice in a row
- pairs that already have many total picks are weighted down slightly

Design effect:

- long runs can now build into real excess fantasies like multishot + focus, reserve + surge, or fieldcraft + pursuit
- the build stays expressive without collapsing into a one-time binary lock
- opportunity cost now comes from timing and RNG cadence rather than permanent exclusion

### Enemy and boss HP scaling

To stop late runs from being solved purely by stacked majors, all enemies now gain soft time-based HP scaling on spawn.

Regular enemy scaling:

- starts after minute `2`
- grows with a light linear term and a light quadratic term

Boss scaling:

- starts after minute `2`
- grows a little faster than regular enemies
- also gets a small bonus per boss encounter index

Design effect:

- early game remains readable and class kits still come online cleanly
- midgame and late game hold more pressure against stacked player growth
- enemies become tougher much more slowly than the player, which keeps the power fantasy intact

Important constraint:

- only HP was meaningfully scaled
- outgoing enemy damage was intentionally left mostly alone to preserve fairness and duel readability

Updated to:

- `52 + level * 15 + level^1.58 * 7.6`

New cumulative thresholds:

- level 5: `500`
- level 10: `2123`
- level 15: `5222`
- level 20: `10108`
- level 25: `17048`
- level 30: `26282`

Why:

- keep level 5 early enough for the first skill unlock
- slow the midgame and late-midgame enough that major choices and later skill unlocks feel earned
- reduce the chance that XP scaling outpaces encounter escalation

## Class-vs-threat audit

### Wind

Still strongest at:

- lane-clearing
- anti-swarm safety
- banner/mortar disruption

Risk after this pass:

- if `banner` stacks become common, Wind may become too universally safe

### Frost

Still strongest at:

- converting dangerous elites into safe damage windows
- punishing `bulwark` and bosses with predictable telegraphs

Risk:

- if chill/freeze math is pushed further, Frost can become the default safest class

### Fire

Still strongest at:

- persistent zone damage
- wearing down clustered late waves
- punishing `bulwark` and summon-heavy bosses

Risk:

- if new support/artillery enemies remain too static, Fire may overperform in static screens

### Necro

Still strongest at:

- long attrition fights
- surviving mixed-pressure screens

Risk:

- support-heavy enemy mixes can snowball thrall value too hard
- still the highest technical risk class because ally count affects clarity and FPS

### Blood

Still strongest at:

- deleting priority targets
- sustaining under high contact pressure

Risk:

- artillery-heavy screens punish Blood hardest
- this is acceptable because Blood is intended to be the highest-risk class

## Practical conclusions

The game now has a healthier pressure triangle:

- direct melee pressure
- ranged/telegraphed area pressure
- support/tempo pressure

That is better than just adding more HP or more bullets.

The boss layer is also healthier:

- more random in timing
- more diverse in encounter fantasy
- better aligned with the existing class fantasies

## Remaining recommended work

1. Telemetry-style pass on actual average unlock times:
- measure mean time-to-level-5/10/15/20/25 across several controlled runs
- compare against intended cadence

2. Class-targeted boss tuning:
- check whether Blood collapses too hard against Regent
- check whether Wind trivializes Harbinger reinforcement screens

3. Extract combat tuning tables from `app.js`:
- enemy HP
- spawn weights
- boss gap windows
- boss reward magnitudes
- XP curve

That is the next highest-value step once the new archetypes settle.
