# Class Rework Spec

Date: 2026-04-16

Purpose: redesign the 5 player classes so they are more mechanically exclusive, more legible in live play, and easier to implement in the current codebase without unnecessary new abstractions.

Primary implementation targets:

- [game-config.js](D:\tryings\vibecoding\Games\emoji-survivors/game-config.js)
- [game/runtime.js](D:\tryings\vibecoding\Games\emoji-survivors/game/runtime.js)
- verification scripts under [scripts/verify](D:\tryings\vibecoding\Games\emoji-survivors/scripts/verify)

This spec is written so another model or engineer can implement it in order with minimal interpretation.

## 1. Design goals

The current class pass already gives each class a status hook and 3 skills, but the classes still overlap too much in the actual combat loop:

- all classes still push enemies to some degree
- frost already controls, but control is not yet its dominant answer
- fire burns, but burn is not yet a true stack-based economy
- necro survives, but is not strongly rewarded for entering dense packs
- blood sustains and crits, but HP is not yet a real spendable combat resource

The rework should produce a roster where each class owns one primary answer that the others cannot replicate well:

- `wind`: displacement and anti-projectile defense
- `frost`: stacked control into freeze windows
- `fire`: best AoE through burn stacking
- `necro`: pack-diving attrition tank with summon-led damage
- `blood`: high-speed HP economy duelist with volatile crit sustain

## 2. Research principles used

These principles should guide all tuning and implementation decisions.

### 2.1 Orthogonal differentiation

Enemy and combat rosters work best when each option has a clear strength, weakness, and combat use case instead of differing only by numbers. The roster should create diversity, hierarchy, longevity, emergence, and consistency. That applies to player classes too, not only enemies.

Applied here:

- each class must answer different board states better than the others
- the answer must come from mechanics, not only larger numbers
- each class should be visibly worse at at least one important combat question

Source:

- [The Level Design Book: Enemy design](https://book.leveldesignbook.com/process/combat/enemy)

### 2.2 Fair combat asks must be legible

When the player is supposed to dodge, exploit a window, or commit to a risk, the game must clearly communicate what is happening. The challenge should come from overlapping readable asks, not from ambiguity.

Applied here:

- frost freeze windows must be readable and earned by stack buildup
- blood low-HP power spikes must be visible and predictable
- wind projectile denial must show clear interception behavior
- necro pack-diving must have visible sustain signals

Source:

- [Game Developer: Enemy Attacks and Telegraphing](https://www.gamedeveloper.com/design/enemy-attacks-and-telegraphing)

### 2.3 Costs and benefits must stay explicit

Combat systems and progression systems are economies. Good class design depends on clear cost-benefit relationships in short-term player state, timing, and progression.

Applied here:

- blood uses HP as a real short-term economy
- necro trades speed and direct DPS for safety in density
- fire trades safety and control for damage throughput
- wind trades damage for safety and tempo control

Source:

- [The Level Design Book: Combat](https://book.leveldesignbook.com/process/combat)

### 2.4 Choice should have clear consequence and reminder

Meaningful choice requires awareness, consequence, reminder, and some permanence. In a survivor-like, class selection is one of the most important strategic choices, so the run must repeatedly remind the player what that class does differently.

Applied here:

- passive behavior must appear every few seconds, not only in edge cases
- skill kits should reinforce the passive instead of pulling in different directions
- major and mastery upgrades should scale the class answer, not blur it

Source:

- [Game Developer: Meaningful Choice in Games](https://www.gamedeveloper.com/design/meaningful-choice-in-games-practical-guide-case-studies)

### 2.5 Stack behavior must match player-facing intuition

When a status stacks, the player should not feel that new hits made the effect weaker or more confusing. Stack logic should preserve the visible fantasy of the effect.

Applied here:

- fire burn should move to explicit stacks instead of only maxing timer and damage
- frost chill should remain a visible buildup toward freeze
- stacking rules should favor predictable front-loaded payoff over opaque blending

Source:

- [Game Developer: A Status Effect Stacking Algorithm](https://www.gamedeveloper.com/design/a-status-effect-stacking-algorithm)

## 3. Constraints from the current codebase

This spec intentionally fits the current architecture.

Existing reusable systems already in place:

- class definitions and passive metadata in `CLASS_DEFS`
- player baseline stats in `createInitialState()`
- projectile hit routing through `applyHitResponse()`
- enemy statuses on the enemy object
- skill casting per class in `castPlayerSkill()` and specific `cast...` helpers
- area effects through `pushEffect()` and `applyZoneTick()`
- hostile projectiles in `state.enemyAttacks`

Important constraint:

- do not introduce a new generalized status framework unless implementation becomes impossible without it

Preferred implementation style:

- extend existing enemy/player fields
- adjust existing helper functions
- add only a few narrowly named fields where needed

## 4. System-wide changes before class-specific tuning

These changes should be implemented first because they make the rest of the rework coherent.

### 4.1 Make strong knockback exclusive to wind

Problem:

- all classes currently apply physical hit push because the non-wind branch in `applyHitResponse()` still adds meaningful knockback

Required changes:

- reduce non-wind projectile knockback to a minimal readability amount
- keep only `wind` as the class with strong sustained displacement
- keep occasional one-off push on some non-wind skills if needed, but only as minor texture, not as core control

Implementation notes:

- in `createInitialState()`, reduce `player.weapon.knockback` for non-wind to a much lower value
- in `applyHitResponse()`, keep strong force only through `applyEnemyWind()`
- review `gale-ring`, `crosswind-strip`, and `tempest-node` so their push/pull values stay clearly above everything else

Acceptance criteria:

- a tank standing in auto-fire range should noticeably move only when hit by wind
- other classes may slightly flinch enemies but should not reposition packs reliably

### 4.2 Add wind projectile denial without a new combat subsystem

Problem:

- the desired fantasy says wind should defend from projectiles, but no player skill currently interacts with `state.enemyAttacks`

Required changes:

- allow wind skills to destroy or deflect hostile projectiles
- do this by adding interception checks inside `updateEnemyAttacks()` or by a small helper called from there

Recommended rule:

- `gale-ring`: destroys hostile projectiles entering the aura
- `crosswind-strip`: destroys or sweeps projectiles crossing the strip
- `tempest-node`: repels or destroys projectiles near the node center

Implementation notes:

- this does not require a new abstraction; use existing `effect.kind` and `state.enemyAttacks`
- if deflection is too noisy, prefer destruction plus a small visual burst
- bosses that use burst zones or meteors should not be fully countered by wind; only `attack.kind === "projectile"` should be intercepted

Acceptance criteria:

- wind can create safe lanes against projectile-heavy bosses and enemies
- wind does not invalidate burst circles, meteors, or contact damage

### 4.3 Add frost control resistance decay for bosses

Problem:

- frost needs stronger control identity, but repeated hard freeze on bosses can easily become degenerate

Required changes:

- keep current `chill -> freeze -> brittle` pattern
- add a lightweight frost-specific boss DR model

Recommended minimal implementation:

- add `enemy.freezeResist` and `enemy.freezeResistTimer`
- when a boss is frozen, increase `freezeResist`
- subsequent freezes on that boss during the timer have reduced duration
- when not frozen for a while, resistance decays back down

Do not:

- add a universal crowd-control resistance framework unless later systems force it

Acceptance criteria:

- frost can reliably create short boss vulnerability windows
- frost cannot permanently lock bosses or turn every slow boss into a trivial loop

### 4.4 Convert fire burn into explicit stacks

Problem:

- current burn behavior tracks timer and a single damage value; that supports burn flavor, but not true stack gameplay

Required changes:

- burn must become a stack economy
- each fire auto hit or fire skill hit adds stacks
- stacks decay over time
- DoT scales with stack count
- stack transfer or splash on kill should remain

Recommended minimal implementation:

- replace or extend:
  - `burnTimer`
  - `burnDamage`
  - `burnTickTimer`
- with:
  - `burnStacks`
  - `burnStackTimer`
  - `burnTickTimer`

Recommended behavior:

- auto hits add small stacks
- zone skills add stacks per tick
- `ash-comet` burst adds a large stack spike
- stack decay happens one step at a time, not full wipe

Reason:

- gradual decay preserves the feeling of maintaining combustion
- this matches player intuition better than overwriting a stronger or weaker burn

Acceptance criteria:

- fire damage ramps up visibly on targets that remain inside fire
- moving enemies out of fire or killing them quickly becomes the natural counterplay

### 4.5 Make blood HP an active economy

Problem:

- blood currently benefits from dash and low survivability, but does not truly spend HP to gain power

Required changes:

- at least one core blood action must spend HP
- missing HP must improve one or more blood outputs
- sustain must be high enough to recover from correct aggression, but not from passive kiting

Recommended minimal implementation:

- `blood-rite` costs a percentage of current or max HP on cast
- blood passive gains scaling based on missing HP:
  - crit chance
  - lifesteal
  - maybe move speed or attack cadence

Acceptance criteria:

- blood has a visible low-HP power band
- blood fails quickly when piloted greedily into projectile-heavy screens
- blood recovers aggressively when it finds real uptime

### 4.6 Shift necro reward toward density, not only kills

Problem:

- necro currently raises thralls from kills and gets sustain from thrall hits, but the desired fantasy is a tank that wants to enter dense packs and drain them

Required changes:

- add a passive reward for being near enemies, especially marked enemies
- reduce personal projectile impact somewhat
- increase summon and pack-presence value

Recommended minimal implementation:

- add a periodic passive siphon when enough enemies are near the player
- or grant damage reduction / healing per nearby marked enemy, with a cap

Acceptance criteria:

- necro feels weakest in sparse fights and strongest inside heavy density
- the player is rewarded for entering danger, not just for standing behind thralls

## 5. Target class identities

This section defines the intended finished identity of each class.

### 5.1 Wind Mage

Role:

- control specialist
- anti-projectile defender
- lowest personal damage profile

Board states wind should solve best:

- ranged pressure
- swarm spillover
- unsafe projectile lanes
- reinforcement screens where spacing matters more than kill speed

Board states wind should solve poorly:

- boss time-to-kill
- bruiser deletion
- sustained single-target burn-down

Core promise:

- "I control where enemies and projectiles are allowed to exist."

### 5.2 Frost Mage

Role:

- control conversion specialist
- freeze and brittle setup mage
- slightly higher damage than wind

Board states frost should solve best:

- elite control
- telegraphed bosses
- medium-density fights where locking one danger creates room

Board states frost should solve poorly:

- full-screen raw AoE race against fire
- projectile denial against wind
- sustain attrition against necro

Core promise:

- "I build freeze windows and cash them into safe damage."

### 5.3 Fire Mage

Role:

- AoE damage specialist
- burn-stack ramp class
- highest screen-clearing damage

Board states fire should solve best:

- static or clustered enemies
- summon-heavy waves
- late dense screens

Board states fire should solve poorly:

- emergency safety
- burst defense
- precise control on priority targets

Core promise:

- "If enemies stay together, they die faster than any other class can kill them."

### 5.4 Necromancer

Role:

- density tank
- summon-led attrition class
- lowest direct projectile impact

Board states necro should solve best:

- long crowded fights
- contact-heavy screens
- mixed attrition pressure

Board states necro should solve poorly:

- sparse mobility checks
- chasing distant artillery quickly
- immediate burst solutions

Core promise:

- "The more enemies crowd me, the more my engine turns on."

### 5.5 Blood Mage

Role:

- high-speed duelist
- HP economy skirmisher
- highest volatility class

Board states blood should solve best:

- priority target removal
- aggressive opportunistic sustain windows
- high-execution boss pressure

Board states blood should solve poorly:

- layered projectile denial
- passive safe play
- long periods without damage uptime

Core promise:

- "I trade HP for tempo and recover it by playing on the edge."

## 6. Detailed class specs

Each class spec below should be implemented in this order:

1. baseline stats
2. passive
3. auto attack behavior
4. skill role tuning
5. mastery tuning
6. failure states and balance checks

---

## 6A. Wind Mage detailed spec

### Fantasy

Wind should be the only class that truly reshapes the battlefield. The player should feel safer because attacks and packs are physically displaced, not because enemies are dying quickly.

### Baseline tuning direction

Target profile:

- lowest direct DPS
- above-average mobility
- average HP
- strongest control

Recommended first-pass stat direction:

- `autoDamage`: lower than current baseline
- `speedMultiplier`: keep highest or near-highest among mages except blood
- `maxHpMultiplier`: remain around baseline
- `weapon.knockback`: highest by a large margin
- `weapon.bossDamageMultiplier`: slightly reduced

Practical first-pass numbers:

- class `autoDamage`: `18-20`
- `speedMultiplier`: `1.12-1.14`
- `weapon.knockback`: `300-340`
- `bossDamageMultiplier`: `0.9`

### Passive

Passive goal:

- reinforce space control every second
- make non-skill gameplay already feel unique

New passive intent:

- auto attacks apply strong push
- wind hits briefly weaken hostile projectile lanes by making skill projectile denial stronger
- movement speed remains above baseline

Recommended passive text:

- "Your basic attacks strongly displace enemies. Wind skills disperse hostile projectiles. Move speed is increased."

### Auto attacks

Required behavior:

- real knockback on every hit
- no bonus burn, freeze, or sustain rider
- noticeably lower projectile damage than other DPS classes

Do not:

- give wind free damage scaling to compensate for its lower DPS; the safety is the compensation

### Skill kit

#### Gale Ring

Keep as:

- self-centered panic and anti-projectile aura

Behavior goals:

- knocks enemies away every tick
- destroys hostile projectiles entering the ring
- modest damage only

Implementation notes:

- reuse current aura
- add hostile projectile cleanup inside aura radius

#### Crosswind Strip

Keep as:

- directional lane control tool

Behavior goals:

- splits packs sideways
- clears a projectile lane
- creates a brief safe path to move through or retreat through

Implementation notes:

- existing sideways knockback is already close to the right fantasy
- interception against `state.enemyAttacks` should happen along the rotated rectangle

#### Tempest Node

Keep as:

- signature battlefield manipulator

Behavior goals:

- gathers enemies into a predictable zone
- destabilizes incoming projectiles near the node
- moderate damage only

Implementation notes:

- keep the current pull
- if deflection feels messy, simply destroy projectiles near the node core

### Mastery scaling

Mastery should improve control coverage, not damage race.

Preferred mastery gains:

- bigger area
- longer uptime
- more reliable projectile denial

Avoid:

- large mastery-driven damage spikes

### Failure states to preserve

Wind must remain bad at:

- fast boss killing
- deleting isolated heavies
- brute-force DPS races

### Success checks

- against projectile enemies and projectile bosses, wind should feel safest
- against a lone high-HP boss, wind should feel slower than frost, fire, and blood

---

## 6B. Frost Mage detailed spec

### Fantasy

Frost wins by forcing the fight into stop-start rhythm. It should not compete with wind on safety through displacement, but through control conversion.

### Baseline tuning direction

Target profile:

- medium mobility
- average HP
- slightly above wind direct damage
- strongest hard CC

Recommended first-pass stat direction:

- `autoDamage`: `23-25`
- `speedMultiplier`: `1.0`
- `maxHpMultiplier`: `1.0`
- keep normal knockback low

### Passive

Passive goal:

- basic fire should quickly build toward freeze

New passive intent:

- auto attacks apply more meaningful `chill`
- repeated hits create frequent freeze windows on normal enemies
- freeze on bosses is shorter, but brittle windows remain valuable

Recommended passive text:

- "Basic attacks stack Chill aggressively. Chill converts to Freeze, then leaves Brittle targets open to follow-up damage."

### Auto attacks

Required behavior:

- auto attacks should be the main source of reliable chill buildup
- freeze threshold should be tuned so normal enemies freeze often enough to define the class

Recommended system change:

- slightly lower threshold for normal enemies if needed
- keep boss threshold higher
- use boss `freezeResist` instead of only raising threshold forever

### Skill kit

#### Blizzard Wake

Keep as:

- self-centered emergency control aura

Behavior goals:

- low direct damage
- rapid chill stacking
- brief freeze on nearby enemies

Implementation notes:

- increase stack application more than damage

#### Permafrost Seal

Keep as:

- delayed setup into control spike

Behavior goals:

- arm time creates readable telegraph
- detonation adds a large chill burst or immediate freeze progress
- establishes the strongest non-boss lock moment in the frost kit

Implementation notes:

- this should be a primary conversion skill, not just a damage burst

#### Crystal Spear

Keep as:

- precision single-target conversion tool

Behavior goals:

- heavy chill application on hit
- especially good against already chilled or brittle targets
- strong elite and boss setup

Implementation notes:

- current `crystal-spear` already applies high chill
- increase its value mainly through freeze/brittle reliability, not pure damage inflation

### Mastery scaling

Mastery should improve:

- chill application
- brittle duration
- consistency of freeze windows

Avoid:

- turning frost into the highest raw DPS class

### Failure states to preserve

Frost must remain worse than:

- fire at full-screen AoE clear
- wind at projectile safety
- necro at attrition tanking

### Success checks

- frost should feel best against slow elites and telegraphed bosses
- frost should not permanently control bosses without downtime

---

## 6C. Fire Mage detailed spec

### Fantasy

Fire is the class that turns occupancy into death. If enemies stand together or keep walking through the same zones, fire should dominate the screen harder than any other class.

### Baseline tuning direction

Target profile:

- average movement
- average or slightly below-average safety
- highest AoE throughput
- high damage with low forgiveness

Recommended first-pass stat direction:

- `autoDamage`: `22-24` direct hit, but lower than blood in single-hit pressure
- `speedMultiplier`: `1.0`
- `maxHpMultiplier`: `0.94-1.0`
- no meaningful knockback advantage

### Passive

Passive goal:

- make burn maintenance the natural loop

New passive intent:

- auto attacks add burn stacks
- burning deaths spread burn stacks or embers
- fire damage accelerates strongly as stacks rise

Recommended passive text:

- "Basic attacks add Burn stacks. Fire zones build stacks quickly, and burning deaths spread the blaze to nearby enemies."

### Burn stack model

Recommended first implementation:

- normal enemy cap: around `6-8` stacks
- boss cap: around `10-12` stacks but with slower gain or faster decay
- each stack adds DoT potency
- decay removes one stack at a time after a short no-refresh window

Design note:

- use stacks for ramp identity, but still allow fire to feel immediately impactful through zone damage

### Auto attacks

Required behavior:

- each auto adds a small number of burn stacks
- autos should matter for maintaining stacks on elites and bosses between skill casts

### Skill kit

#### Cinder Halo

Keep as:

- self-centered panic burn aura

Behavior goals:

- high local stack application
- discourages enemies from staying in contact range
- emergency wave thinning

#### Sunspot

Keep as:

- bread-and-butter zone pressure

Behavior goals:

- strong stack generation over time
- best when enemies stay clustered or path through the area
- lower immediate burst than comet, higher total ramp value

#### Ash Comet

Keep as:

- signature burst plus persistent aftermath

Behavior goals:

- impact adds a large stack spike
- impact is strongest AoE burst in the class
- aftermath sunspot sustains the burn economy

Implementation notes:

- current shape is already close to the desired fantasy
- the key change is stack behavior, not skill geometry

### Balance compensation

Fire needs strong output, so it must pay elsewhere.

Recommended tradeoffs:

- lower emergency safety than wind/frost
- little to no hard CC
- poor projectile defense
- only modest sustain

Optional boss safety valve if needed:

- bosses take full initial stack application, but stack decay is slightly faster on bosses

### Mastery scaling

Mastery should improve:

- stack cap
- area coverage
- persistence

Avoid:

- adding control riders that steal frost or wind identity

### Failure states to preserve

Fire must feel vulnerable when:

- cornered by projectiles
- forced to leave zones constantly
- fighting spread-out fast priority targets

### Success checks

- fire should lead all classes in dense-wave clear
- fire should not become the safest class

---

## 6D. Necromancer detailed spec

### Fantasy

Necro should feel like a slow engine that becomes harder to kill when it commits into density. The player is not meant to kite elegantly; they are meant to survive the crush and let proximity plus summons win.

### Baseline tuning direction

Target profile:

- lowest or near-lowest speed
- highest HP
- lowest direct projectile damage
- strongest attrition sustain in dense packs

Recommended first-pass stat direction:

- `autoDamage`: `16-18`
- `speedMultiplier`: `0.9-0.94`
- `maxHpMultiplier`: `1.35-1.45`
- `projectilePierce`: keep above most classes

### Passive

Passive goal:

- reward proximity to enemies, not only kills

New passive intent:

- basic attacks pierce and apply necro mark
- being near marked enemies grants siphon healing, damage reduction, or both up to a cap
- kills can still raise thralls
- thrall hits continue to heal

Recommended passive text:

- "Basic attacks pierce and mark enemies. Marked kills and necrotic skills call additional Thralls, and your summon cap is increased."

### Proximity engine

Recommended minimal implementation:

- every short interval, count nearby enemies or nearby marked enemies
- if count exceeds a threshold, heal the player for a small amount
- optionally grant capped damage reduction while the threshold is met

Preferred version:

- proximity reward should key off `necroMarkTimer`

Reason:

- this keeps the class loop interactive
- the player wants to enter packs they have already tagged

### Auto attacks

Required behavior:

- low direct damage
- pierce remains central
- mark application should help both siphon and summon value

### Thrall design direction

Do not solve necro by adding more and more thralls.

Preferred direction:

- fewer but sturdier and more relevant thralls
- raise cap only if clarity and FPS remain acceptable

Possible first-pass changes:

- keep max active thralls near current cap
- increase individual thrall usefulness slightly
- increase value of `grave-call` as the intentional summon spike

### Skill kit

#### Bone Ward

Keep as:

- self-centered safety ring

Behavior goals:

- strong anti-contact layer
- good when necro intentionally walks into density
- lower raw damage than fire circles

#### Requiem Field

Shift toward:

- density amplifier

Behavior goals:

- centered near necro or only slightly offset from necro
- marks enemies
- modestly slows enemies
- rewards standing in the crowd instead of casting far away and leaving

Implementation note:

- if preserving target cluster cast, bias it to nearby clusters only

#### Grave Call

Keep as:

- signature summon tempo button

Behavior goals:

- converts corpses into a real frontline spike
- if no corpses exist, still provides at least one phantom thrall so the button never whiffs
- strongest when used after diving into and surviving a crowd

### Mastery scaling

Mastery should improve:

- thrall durability
- proximity sustain reliability
- pack-control uptime

Avoid:

- turning necro into a ranged turret class

### Failure states to preserve

Necro must remain weak at:

- quick priority-target execution
- sparse projectile kiting duels
- reposition-heavy fights

### Success checks

- necro should feel best when many enemies are close
- necro should not out-burst fire or blood

---

## 6E. Blood Mage detailed spec

### Fantasy

Blood is the most volatile class in the roster. It should move fastest, die fastest, and recover fastest when piloted well. Its defining emotional state is controlled greed.

### Baseline tuning direction

Target profile:

- highest speed
- lowest HP
- highest single-target volatility
- strongest dependence on uptime

Recommended first-pass stat direction:

- `autoDamage`: `26-28`
- `speedMultiplier`: `1.14-1.18`
- `maxHpMultiplier`: `0.68-0.74`
- crit and lifesteal remain unique

### Passive

Passive goal:

- make missing HP and aggression feel rewarding every few seconds

New passive intent:

- auto attacks lifesteal
- auto attacks can crit
- crit chance, lifesteal, or haste increase as HP gets lower
- dash still gives a short offensive spike, but should no longer be the only identity anchor

Recommended passive text:

- "Basic attacks lifesteal and can crit. The lower your HP, the faster and deadlier blood magic becomes. Dashing sharpens the next engage."

### Missing-HP scaling

Recommended minimal implementation:

- compute missing-HP ratio
- grant:
  - bonus crit chance
  - bonus lifesteal
  - optional move speed or fire rate

Keep it capped:

- low HP should be lucrative, not mandatory

Recommended target shape:

- mild bonus above 70% HP missing band
- strongest bonus in the `20-50% HP` survival band
- avoid making `1 HP` mathematically optimal

### HP-spend mechanic

At least one blood action must spend HP. This is mandatory for the class fantasy.

Recommended first implementation:

- `blood-rite` costs `8-12%` current HP or `10%` max HP on cast
- in return it grants:
  - crit chance
  - lifesteal
  - after-dash power
  - maybe temporary fire interval boost if easy to add

Important rule:

- the cast should not kill the player outright
- if HP is too low, either clamp to `1 HP` minimum or fail-cast with a short UI flash

### Auto attacks

Required behavior:

- strongest basic dueling feel
- reward staying in range
- do not give blood the best AoE

### Skill kit

#### Vein Burst

Keep as:

- self-centered bailout plus commit tool

Behavior goals:

- immediate local damage
- short emergency sustain
- strongest when used inside enemy density, not before contact

#### Crimson Pool

Keep as:

- area sustain trap

Behavior goals:

- rewards fighting in or around the pool
- slows slightly
- provides healing only if blood stays engaged enough to convert it into hits

Implementation note:

- avoid making the pool a passive heal zone that supports safe kiting

#### Blood Rite

Keep as:

- signature self-sacrifice steroid

Behavior goals:

- explicit HP cost
- strongest short offensive window in the class
- creates the "go in now" moment

### Mastery scaling

Mastery should improve:

- window quality
- sustain conversion
- crit volatility

Avoid:

- making blood durable

### Failure states to preserve

Blood must remain weak when:

- it cannot touch enemies consistently
- projectiles deny its routes
- it tries to play passively

### Success checks

- blood should have the fastest priority-target kills when piloted well
- blood should remain the easiest class to throw away with bad positioning

## 7. Per-class implementation checklist

Another model can follow this section almost mechanically.

### Step 1. Update `CLASS_DEFS` text and baseline values in `game-config.js`

For each class:

- update `description`
- update `passiveText`
- adjust `autoDamage`
- adjust `speedMultiplier`
- adjust `maxHpMultiplier`

Do not change skill identities here unless a name or role label is misleading.

### Step 2. Update player baseline setup in `createInitialState()` in `game/runtime.js`

Adjust:

- `bloodCritChance`
- `bloodCritMultiplier`
- `lifesteal`
- `thrallLifestealPerHit`
- `weapon.knockback`
- `weapon.bossDamageMultiplier`
- any new lightweight fields needed for:
  - boss freeze DR
  - burn stacks
  - blood missing-HP scaling
  - necro proximity siphon

### Step 3. Expand enemy state in enemy creation

Add only the minimum needed fields:

- `burnStacks`
- `burnStackTimer`
- `freezeResist`
- `freezeResistTimer`

If necro needs a passive proximity marker count, do not add more enemy state unless necessary; use existing `necroMarkTimer`.

### Step 4. Rework status helpers

Adjust:

- `applyEnemyBurn()`
- `applyEnemyChill()`
- enemy status update section in `updateEnemiesAndSpatialGrid()`

Goals:

- burn uses stacks
- boss freeze uses DR decay

### Step 5. Rework projectile-vs-wind interaction

Adjust:

- `updateEnemyAttacks()`
- possibly add a helper like `resolveWindProjectileInterception(attack)`

Use only existing effect kinds:

- `gale-ring`
- `crosswind-strip`
- `tempest-node`

### Step 6. Rework passive hit routing

Adjust:

- `applyHitResponse()`
- `computePlayerProjectileDamage()`

Goals:

- wind owns real knockback
- frost autos build more reliable chill value
- fire autos add burn stacks
- necro autos mark efficiently
- blood autos use missing-HP and blood-rite bonuses

### Step 7. Rework class-specific skill numbers and riders

Adjust:

- `cast...` helpers for all 15 skills only where needed
- `applyZoneTick()`
- per-effect update logic

Rule:

- keep current skill shapes whenever possible
- prefer numeric and rider changes over geometry rewrites

### Step 8. Add blood HP-spend and necro proximity sustain

Adjust:

- `castBloodRite()`
- the main player update loop or another existing periodic update path

Goals:

- blood explicitly spends HP
- necro gets rewarded for fighting inside density

### Step 9. Rebalance masteries

Review skill mastery scaling so it reinforces class identity instead of flattening it.

Preferred mastery bias:

- wind: area and uptime
- frost: freeze consistency and brittle
- fire: stack coverage and persistence
- necro: summon durability and density sustain
- blood: offensive window quality and conversion

### Step 10. Update verification

Extend or add checks in:

- [scripts/verify/verify-class-behavior.mjs](D:\tryings\vibecoding\Games\emoji-survivors/scripts/verify/verify-class-behavior.mjs)
- optionally [scripts/verify/verify-class-overhaul.mjs](D:\tryings\vibecoding\Games\emoji-survivors/scripts/verify/verify-class-overhaul.mjs)

Recommended assertions:

- `wind` destroys at least one hostile projectile during a skill window
- `frost` can freeze a tank or boss surrogate after repeated hits
- `fire` increases burn stack count over repeated hits and carries stacks through zone play
- `necro` gains measurable sustain when surrounded
- `blood` loses HP on `blood-rite` cast and gains stronger recovery under active hits

## 8. Tuning priorities

Implement in this order:

1. wind exclusivity
2. fire burn stack system
3. frost freeze reliability plus boss DR
4. necro density reward
5. blood HP economy
6. final number tuning

Reason:

- wind and fire need systemic changes that immediately make the roster read better
- frost depends on those systems being settled
- necro and blood are the highest-variance tuning risks and should be tuned after the clearer identities are locked

## 9. Balance guardrails

These are non-negotiable.

### Wind guardrails

- must not become a safe high-DPS generalist
- projectile denial should not trivialize non-projectile boss mechanics

### Frost guardrails

- must not hard-lock bosses indefinitely
- freeze should create windows, not permanent shutdown

### Fire guardrails

- must remain vulnerable when reposition forced
- best AoE must not also become best safety

### Necro guardrails

- summon count must stay readable and performant
- necro direct DPS must stay low enough that summons and pack presence matter

### Blood guardrails

- low HP should be powerful, but not always mathematically optimal
- HP-spend must never feel like fake flavor with no real cost

## 10. Definition of done

The rework is successful when all of the following are true:

- class fantasy is visible from the first 20-30 seconds of a run
- each class has a dominant answer the others cannot imitate well
- each class also has at least one clearly bad board state
- passives matter frequently, not only in rare edge cases
- skill kits reinforce the passive instead of diluting it
- the implementation remains localized to the current code structure
- no large new framework was introduced unless absolutely required by implementation

## 11. Suggested follow-up after implementation

After the first pass lands, run targeted playtests and telemetry checks for:

- `wind` versus `abyss`, `regent`, and `mortar`
- `frost` versus `colossus` and `bulwark`
- `fire` versus `matriarch`, `bulwark`, and dense late waves
- `necro` versus `harbinger` and general late-run density
- `blood` versus `countess`, `regent`, and artillery-heavy screens

Metrics to compare:

- average run duration by class
- boss clear time by class
- incoming damage by source and class
- damage source mix by class
- FPS impact for necro specifically

## 12. Sources

- [The Level Design Book: Combat](https://book.leveldesignbook.com/process/combat)
- [The Level Design Book: Enemy design](https://book.leveldesignbook.com/process/combat/enemy)
- [Game Developer: Enemy Attacks and Telegraphing](https://www.gamedeveloper.com/design/enemy-attacks-and-telegraphing)
- [Game Developer: Meaningful Choice in Games](https://www.gamedeveloper.com/design/meaningful-choice-in-games-practical-guide-case-studies)
- [Game Developer: A Status Effect Stacking Algorithm](https://www.gamedeveloper.com/design/a-status-effect-stacking-algorithm)
