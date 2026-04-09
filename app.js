let viewWidth = 960;
let viewHeight = 540;

const FIXED_STEP = 1 / 60;
const MAX_FRAME_TIME = 0.12;
const ENEMY_CELL_SIZE = 72;
const ENEMY_NEIGHBOR_OFFSETS = [[1, 0], [0, 1], [1, 1], [-1, 1]];

const WORLD = {
  left: -18000,
  right: 18000,
  top: -12000,
  bottom: 12000,
};

const TERRAIN_TILE_SIZE = 24;
const TERRAIN_SEED = 91723;
const WORLD_FEATURE_REGION_SIZE = 1600;
const WORLD_FEATURE_MARGIN = 280;
const WORLD_FEATURE_START_CLEAR_RADIUS = 760;
const WORLD_FEATURE_CACHE = new Map();
const TERRAIN_TILE_CACHE = new Map();
const GAME_CONFIG = window.GAME_CONFIG ?? {};
const TERRAIN_PALETTE = GAME_CONFIG.terrainPalette ?? {
  grass: ["#1e4131", "#2b5642", "#3a6953"],
  sand: ["#6b5633", "#806744", "#987b55"],
  stone: ["#46525a", "#57646d", "#69767f"],
  water: ["#18394e", "#244d66", "#2f617c"],
};
const XP_ORB_VALUES = GAME_CONFIG.xpOrbValues ?? [1, 2, 3, 5, 8, 13, 21, 34, 55];
const XP_CURVE = GAME_CONFIG.xpCurve ?? {
  base: 52,
  linear: 15,
  exponent: 1.58,
  exponentialScale: 7.6,
};
const SPAWN_DIRECTOR_CONFIG = GAME_CONFIG.spawnDirector ?? {
  baseInterval: 1.04,
  minInterval: 0.24,
  maxEnemiesOnField: 280,
  bossSpawnIntervalMultiplier: 8.4,
  bossAmbientCap: 6,
};
const SPAWN_ROSTER = GAME_CONFIG.spawnRoster ?? [];
const ENEMY_ARCHETYPES = GAME_CONFIG.enemyArchetypes ?? {};
const BOSS_GAP_RANGES = GAME_CONFIG.bossGapRanges ?? [];
const BOSS_UNLOCK_TIMES = GAME_CONFIG.bossUnlockTimes ?? {};
const BOSS_RANDOM_WEIGHTS = GAME_CONFIG.bossRandomWeights ?? {};
const ENEMY_SCALING_CONFIG = GAME_CONFIG.enemyScaling ?? {
  startMinute: 2,
  regularLinear: 0.015,
  regularQuadratic: 0.0009,
  bossLinear: 0.02,
  bossQuadratic: 0.0012,
  bossEncounterBonus: 0.06,
};
const MAJOR_UPGRADE_CONFIG = GAME_CONFIG.majorUpgrades ?? {
  pairWeights: {},
  repeatPairWeight: 0.42,
  fatiguePerPairPick: 0.14,
  ranks: {},
};

const PLAYER_FONT = '44px "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif';

const ACTIONS_BY_CODE = {
  KeyW: "up",
  ArrowUp: "up",
  KeyS: "down",
  ArrowDown: "down",
  KeyA: "left",
  ArrowLeft: "left",
  KeyD: "right",
  ArrowRight: "right",
};

const ACTIONS_BY_KEY = {
  w: "up",
  arrowup: "up",
  s: "down",
  arrowdown: "down",
  a: "left",
  arrowleft: "left",
  d: "right",
  arrowright: "right",
};

const UPGRADE_POOL = [
  {
    id: "cadence",
    family: "cadence",
    familyLabel: "Cadence",
    tier: "common",
    minLevel: 1,
    maxStacks: 10,
    weight: 24,
    icon: "\u23f1\ufe0f",
    title: "Arcane Cadence",
    description: "Cast faster and keep pressure on the closest enemies.",
    effect(state, level) {
      const msReduction = Math.round(Math.max(14, state.player.weapon.fireInterval * 1000 * (0.09 + level * 0.0025)));
      return { msReduction };
    },
    effectText(effect) {
      return `Attack interval -${effect.msReduction} ms`;
    },
    apply(state, effect) {
      state.player.weapon.fireInterval = Math.max(0.12, state.player.weapon.fireInterval - effect.msReduction / 1000);
    },
  },
  {
    id: "spellforce",
    family: "damage",
    familyLabel: "Damage",
    tier: "common",
    minLevel: 1,
    maxStacks: 12,
    weight: 22,
    icon: "\u2728",
    title: "Spellforce",
    description: "More raw projectile damage for steady scaling.",
    effect(state, level, stacks) {
      return { damage: 3 + Math.floor(level * 0.9 + stacks * 0.8) };
    },
    effectText(effect) {
      return `Projectile damage +${effect.damage}`;
    },
    apply(state, effect) {
      state.player.weapon.projectileDamage += effect.damage;
    },
  },
  {
    id: "stride",
    family: "movement",
    familyLabel: "Movement",
    tier: "common",
    minLevel: 1,
    maxStacks: 8,
    weight: 15,
    icon: "\ud83d\udc62",
    title: "Fleet Stride",
    description: "Increase movement speed for cleaner dodges.",
    effect(state, level) {
      return { speed: 10 + Math.floor(level * 0.45) };
    },
    effectText(effect) {
      return `Move speed +${effect.speed}`;
    },
    apply(state, effect) {
      state.player.speed += effect.speed;
    },
  },
  {
    id: "vitality",
    family: "vitality",
    familyLabel: "Vitality",
    tier: "common",
    minLevel: 1,
    maxStacks: 7,
    weight: 14,
    icon: "\u2764\ufe0f",
    title: "Vital Bloom",
    description: "Raise max HP and recover a chunk immediately.",
    effect(state, level) {
      const maxHpGain = 12 + Math.floor(level * 0.7);
      return { maxHpGain, heal: Math.round(maxHpGain * 0.6) };
    },
    effectText(effect) {
      return `+${effect.maxHpGain} max HP, heal ${effect.heal}`;
    },
    apply(state, effect) {
      state.player.maxHp += effect.maxHpGain;
      state.player.hp = Math.min(state.player.maxHp, state.player.hp + effect.heal);
    },
  },
  {
    id: "propulsion",
    family: "projectile-speed",
    familyLabel: "Velocity",
    tier: "common",
    minLevel: 2,
    maxStacks: 8,
    weight: 13,
    icon: "\ud83d\udca8",
    title: "Propulsion",
    description: "Projectiles travel faster and connect sooner.",
    effect(state, level) {
      return { speed: 32 + Math.floor(level * 2.2) };
    },
    effectText(effect) {
      return `Projectile speed +${effect.speed}`;
    },
    apply(state, effect) {
      state.player.weapon.projectileSpeed += effect.speed;
    },
  },
  {
    id: "kinetic",
    family: "control",
    familyLabel: "Control",
    tier: "common",
    minLevel: 1,
    maxStacks: 8,
    weight: 13,
    icon: "\ud83d\udee1\ufe0f",
    title: "Kinetic Strike",
    description: "Hits push enemies back harder.",
    effect(state, level) {
      return { knockback: 20 + Math.floor(level * 2.4) };
    },
    effectText(effect) {
      return `Knockback force +${effect.knockback}`;
    },
    apply(state, effect) {
      state.player.weapon.knockback += effect.knockback;
    },
  },
  {
    id: "reach",
    family: "reach",
    familyLabel: "Reach",
    tier: "common",
    minLevel: 3,
    maxStacks: 6,
    weight: 12,
    icon: "\ud83c\udff9",
    title: "Long Reach",
    description: "Shots last longer and gain a little extra body.",
    effect(state, level) {
      return {
        life: 0.1 + level * 0.005,
        radius: 0.35 + level * 0.025,
      };
    },
    effectText(effect) {
      return `Projectile life +${effect.life.toFixed(2)}s, size +${effect.radius.toFixed(1)}`;
    },
    apply(state, effect) {
      state.player.weapon.projectileLife += effect.life;
      state.player.weapon.projectileRadius = Math.min(11, state.player.weapon.projectileRadius + effect.radius);
    },
  },
  {
    id: "frost",
    family: "slow",
    familyLabel: "Slow",
    tier: "uncommon",
    minLevel: 4,
    maxStacks: 6,
    weight: 11,
    icon: "\u2744\ufe0f",
    title: "Cryo Echo",
    description: "Hit enemies are slowed longer and harder.",
    effect(state, level) {
      return { slow: 0.04 + level * 0.002, duration: 0.03 + level * 0.001 };
    },
    effectText(effect) {
      return `On-hit slow +${Math.round(effect.slow * 100)}%`;
    },
    apply(state, effect) {
      state.player.weapon.hitSlow = clamp(state.player.weapon.hitSlow + effect.slow, 0, 0.7);
      state.player.weapon.hitSlowDuration = Math.min(1.1, state.player.weapon.hitSlowDuration + effect.duration);
    },
  },
  {
    id: "pierce",
    family: "pierce",
    familyLabel: "Pierce",
    tier: "uncommon",
    minLevel: 5,
    maxStacks: 4,
    weight: 10,
    icon: "\ud83d\udde1\ufe0f",
    title: "Piercing Sigil",
    description: "Each projectile can pass through one more enemy.",
    effect() {
      return { pierce: 1 };
    },
    effectText(effect) {
      return `Projectile pierce +${effect.pierce}`;
    },
    apply(state, effect) {
      state.player.weapon.projectilePierce += effect.pierce;
    },
  },
  {
    id: "scholar",
    family: "economy",
    familyLabel: "Economy",
    tier: "uncommon",
    minLevel: 6,
    maxStacks: 6,
    weight: 9,
    icon: "\ud83d\udcda",
    title: "Scholar Spark",
    description: "Gain more XP from each kill.",
    effect(state, level) {
      return { gain: 0.12 + level * 0.003 };
    },
    effectText(effect) {
      return `XP gain +${Math.round(effect.gain * 100)}%`;
    },
    apply(state, effect) {
      state.player.xpMultiplier += effect.gain;
    },
  },
  {
    id: "dashstep",
    family: "dash-cadence",
    familyLabel: "Dash Tempo",
    tier: "uncommon",
    minLevel: 5,
    maxStacks: 6,
    weight: 10,
    icon: "\u26a1",
    title: "Blink Step",
    description: "Dash charges refill faster.",
    effect(state, level) {
      return { recharge: 0.26 + level * 0.015 };
    },
    effectText(effect) {
      return `Dash recharge -${effect.recharge.toFixed(2)}s`;
    },
    apply(state, effect) {
      state.player.dash.rechargeTime = Math.max(1.4, state.player.dash.rechargeTime - effect.recharge);
      if (state.player.dash.charges < state.player.dash.maxCharges && state.player.dash.rechargeTimer > 0) {
        state.player.dash.rechargeTimer = Math.min(state.player.dash.rechargeTimer, state.player.dash.rechargeTime);
      }
    },
  },
  {
    id: "moonwell",
    family: "regen",
    familyLabel: "Regen",
    tier: "uncommon",
    minLevel: 5,
    maxStacks: 6,
    weight: 8,
    icon: "\ud83c\udf19",
    title: "Moonwell",
    description: "Recover HP slowly over time.",
    effect(state, level) {
      return { regen: Number((0.45 + level * 0.06).toFixed(2)) };
    },
    effectText(effect) {
      return `Regeneration +${effect.regen}/s`;
    },
    apply(state, effect) {
      state.player.regenPerSecond += effect.regen;
    },
  },
  {
    id: "siphon",
    family: "sustain",
    familyLabel: "Sustain",
    tier: "uncommon",
    minLevel: 7,
    maxStacks: 5,
    weight: 8,
    icon: "\ud83e\ude78",
    title: "Soul Siphon",
    description: "Kills restore a small amount of HP.",
    effect(state, level, stacks) {
      return { heal: Math.min(5, 1 + Math.floor(level / 7) + Math.floor(stacks / 2)) };
    },
    effectText(effect) {
      return `Heal ${effect.heal} HP on kill`;
    },
    apply(state, effect) {
      state.player.onKillHeal += effect.heal;
    },
  },
  {
    id: "splitshot",
    family: "multishot",
    familyLabel: "Multishot",
    tier: "uncommon",
    minLevel: 8,
    maxStacks: 2,
    weight: 8,
    icon: "\ud83c\udfaf",
    title: "Twin Burst",
    description: "Fire additional projectiles with angular spread.",
    effect() {
      return { extra: 1 };
    },
    effectText(effect) {
      return `Extra projectiles +${effect.extra}`;
    },
    apply(state, effect) {
      state.player.weapon.extraProjectiles += effect.extra;
      state.player.weapon.spreadAngle = Math.min(0.24, state.player.weapon.spreadAngle + 0.025);
    },
  },
  {
    id: "dashstock",
    family: "dash-capacity",
    familyLabel: "Dash Stock",
    tier: "uncommon",
    minLevel: 8,
    maxStacks: 4,
    weight: 9,
    icon: "\ud83d\udd37",
    title: "Reserve Glyph",
    description: "Store another dash charge, up to five total.",
    effect() {
      return { charges: 1 };
    },
    effectText(effect, state) {
      return `Max dash charges +${effect.charges} (now ${Math.min(5, state.player.dash.maxCharges + effect.charges)})`;
    },
    apply(state, effect) {
      state.player.dash.maxCharges = Math.min(5, state.player.dash.maxCharges + effect.charges);
      state.player.dash.charges = Math.min(state.player.dash.maxCharges, state.player.dash.charges + effect.charges);
    },
  },
  {
    id: "overdrive",
    family: "damage",
    familyLabel: "Damage",
    tier: "rare",
    minLevel: 10,
    maxStacks: 5,
    weight: 7,
    icon: "\ud83d\udd25",
    title: "Overdrive",
    description: "A late spike to both damage and fire cadence.",
    effect(state, level) {
      return { damage: 8 + Math.floor(level * 1.1), msReduction: 28 + Math.floor(level * 0.9) };
    },
    effectText(effect) {
      return `+${effect.damage} damage, -${effect.msReduction} ms interval`;
    },
    apply(state, effect) {
      state.player.weapon.projectileDamage += effect.damage;
      state.player.weapon.fireInterval = Math.max(0.1, state.player.weapon.fireInterval - effect.msReduction / 1000);
    },
  },
  {
    id: "bossbane",
    family: "boss",
    familyLabel: "Boss Hunt",
    tier: "rare",
    minLevel: 11,
    maxStacks: 4,
    weight: 7,
    icon: "\ud83d\udc51",
    title: "Bossbane",
    description: "Specialize into chunking boss HP bars.",
    effect(state, level) {
      return { multiplier: Number((0.12 + level * 0.004).toFixed(2)) };
    },
    effectText(effect) {
      return `Boss damage +${Math.round(effect.multiplier * 100)}%`;
    },
    apply(state, effect) {
      state.player.weapon.bossDamageMultiplier += effect.multiplier;
    },
  },
  {
    id: "bastion",
    family: "bastion",
    familyLabel: "Bastion",
    tier: "rare",
    minLevel: 12,
    maxStacks: 4,
    weight: 6,
    icon: "\ud83c\udff0",
    title: "Bastion Core",
    description: "Huge survivability spike for deeper runs.",
    effect(state, level) {
      return { maxHpGain: 18 + Math.floor(level * 1.3), reduction: 0.03 + level * 0.0015 };
    },
    effectText(effect) {
      return `+${effect.maxHpGain} max HP, damage taken -${Math.round(effect.reduction * 100)}%`;
    },
    apply(state, effect) {
      state.player.maxHp += effect.maxHpGain;
      state.player.hp = Math.min(state.player.maxHp, state.player.hp + Math.round(effect.maxHpGain * 0.5));
      state.player.damageReduction = clamp(state.player.damageReduction + effect.reduction, 0, 0.55);
    },
  },
  {
    id: "phaseweave",
    family: "dash-mastery",
    familyLabel: "Dash Mastery",
    tier: "rare",
    minLevel: 13,
    maxStacks: 4,
    weight: 6,
    icon: "\ud83c\udf0c",
    title: "Phaseweave",
    description: "Dash farther and stay untouchable slightly longer.",
    effect(state, level) {
      return {
        distance: 18 + Math.floor(level * 1.8),
        invuln: Number((0.018 + level * 0.0014).toFixed(3)),
      };
    },
    effectText(effect) {
      return `Dash distance +${effect.distance}, i-frames +${Math.round(effect.invuln * 1000)} ms`;
    },
    apply(state, effect) {
      state.player.dash.distance += effect.distance;
      state.player.dash.invulnDuration = Math.min(0.42, state.player.dash.invulnDuration + effect.invuln);
    },
  },
  {
    id: "impact",
    family: "control",
    familyLabel: "Control",
    tier: "rare",
    minLevel: 14,
    maxStacks: 3,
    weight: 6,
    icon: "\ud83c\udf29\ufe0f",
    title: "Impact Resonance",
    description: "Massive crowd-control on hit.",
    effect(state, level) {
      return { knockback: 44 + Math.floor(level * 3.1), slow: 0.08 + level * 0.002 };
    },
    effectText(effect) {
      return `Knockback +${effect.knockback}, slow +${Math.round(effect.slow * 100)}%`;
    },
    apply(state, effect) {
      state.player.weapon.knockback += effect.knockback;
      state.player.weapon.hitSlow = clamp(state.player.weapon.hitSlow + effect.slow, 0, 0.78);
      state.player.weapon.hitSlowDuration = Math.min(1.3, state.player.weapon.hitSlowDuration + 0.08);
    },
  },
];

const BOSS_REWARD_POOLS = {
  countess: [
    {
      id: "countess-bloodfeast",
      bossType: "countess",
      family: "vitality",
      familyLabel: "Vitality",
      icon: "\ud83e\ude78",
      title: "Blood Feast",
      description: "Turn kills into sustain and thicken your lifeline for the midgame.",
      priority: 2,
      effectText() {
        return "+30 max HP, +3 HP on kill, +1.4 HP/s";
      },
      apply(state) {
        state.player.maxHp += 30;
        state.player.hp = Math.min(state.player.maxHp, state.player.hp + 24);
        state.player.onKillHeal += 3;
        state.player.regenPerSecond += 1.4;
      },
    },
    {
      id: "countess-nightstorm",
      bossType: "countess",
      family: "barrage",
      familyLabel: "Barrage",
      icon: "\ud83e\udd87",
      title: "Nightstorm",
      description: "Explode your screen presence with a large spike to shot count and cadence.",
      priority: 3,
      effectText() {
        return "+1 projectile, -55 ms interval, +6 damage";
      },
      apply(state) {
        state.player.weapon.extraProjectiles += 1;
        state.player.weapon.spreadAngle = Math.min(0.26, state.player.weapon.spreadAngle + 0.02);
        state.player.weapon.fireInterval = Math.max(0.09, state.player.weapon.fireInterval - 0.055);
        state.player.weapon.projectileDamage += 6;
      },
    },
    {
      id: "countess-scarletstep",
      bossType: "countess",
      family: "mobility",
      familyLabel: "Mobility",
      icon: "\ud83d\udcae",
      title: "Scarlet Step",
      description: "Convert the Countess fantasy into aggressive repositioning.",
      priority: 1,
      effectText() {
        return "+50 move speed, dash recharge -1.1s, dash distance +40";
      },
      apply(state) {
        state.player.speed += 50;
        state.player.dash.rechargeTime = Math.max(1.3, state.player.dash.rechargeTime - 1.1);
        state.player.dash.distance += 40;
      },
    },
  ],
  colossus: [
    {
      id: "colossus-graveaegis",
      bossType: "colossus",
      family: "fortress",
      familyLabel: "Fortress",
      icon: "\ud83d\uddff",
      title: "Grave Aegis",
      description: "Take the boss's entire fantasy and turn it into raw refusal to die.",
      priority: 3,
      effectText() {
        return "+48 max HP, damage taken -12%, +1 dash charge";
      },
      apply(state) {
        state.player.maxHp += 48;
        state.player.hp = Math.min(state.player.maxHp, state.player.hp + 34);
        state.player.damageReduction = clamp(state.player.damageReduction + 0.12, 0, 0.7);
        state.player.dash.maxCharges = Math.min(5, state.player.dash.maxCharges + 1);
        state.player.dash.charges = Math.min(state.player.dash.maxCharges, state.player.dash.charges + 1);
      },
    },
    {
      id: "colossus-quakecore",
      bossType: "colossus",
      family: "control",
      familyLabel: "Control",
      icon: "\ud83c\udf0b",
      title: "Quake Core",
      description: "Turn every hit into a much heavier control event.",
      priority: 2,
      effectText() {
        return "+140 knockback, +14% slow, +0.18s slow duration";
      },
      apply(state) {
        state.player.weapon.knockback += 140;
        state.player.weapon.hitSlow = clamp(state.player.weapon.hitSlow + 0.14, 0, 0.85);
        state.player.weapon.hitSlowDuration = Math.min(1.6, state.player.weapon.hitSlowDuration + 0.18);
      },
    },
    {
      id: "colossus-tombengine",
      bossType: "colossus",
      family: "boss-hunt",
      familyLabel: "Boss Hunt",
      icon: "\u26cf\ufe0f",
      title: "Tomb Engine",
      description: "A giant late-game stat package aimed at piercing bulky waves and bosses.",
      priority: 1,
      effectText() {
        return "+16 damage, +1 pierce, boss damage +24%";
      },
      apply(state) {
        state.player.weapon.projectileDamage += 16;
        state.player.weapon.projectilePierce += 1;
        state.player.weapon.bossDamageMultiplier += 0.24;
      },
    },
  ],
  abyss: [
    {
      id: "abyss-voidfocus",
      bossType: "abyss",
      family: "precision",
      familyLabel: "Precision",
      icon: "\ud83d\udc41",
      title: "Void Focus",
      description: "Distill the Eye into long-range lethality and boss pressure.",
      priority: 3,
      effectText() {
        return "+90 projectile speed, +0.3s life, boss damage +28%";
      },
      apply(state) {
        state.player.weapon.projectileSpeed += 90;
        state.player.weapon.projectileLife += 0.3;
        state.player.weapon.bossDamageMultiplier += 0.28;
      },
    },
    {
      id: "abyss-omensight",
      bossType: "abyss",
      family: "cadence",
      familyLabel: "Cadence",
      icon: "\ud83d\udd2e",
      title: "Omen Sight",
      description: "A tempo-and-knowledge reward that accelerates the rest of the run.",
      priority: 2,
      effectText() {
        return "-70 ms interval, +18% XP gain, +8 damage";
      },
      apply(state) {
        state.player.weapon.fireInterval = Math.max(0.085, state.player.weapon.fireInterval - 0.07);
        state.player.xpMultiplier += 0.18;
        state.player.weapon.projectileDamage += 8;
      },
    },
    {
      id: "abyss-eclipsewarp",
      bossType: "abyss",
      family: "warp",
      familyLabel: "Warp",
      icon: "\ud83c\udf0c",
      title: "Eclipse Warp",
      description: "The evasive option: faster pathing, deeper dash, longer invulnerability.",
      priority: 1,
      effectText() {
        return "+40 move speed, dash distance +80, i-frames +70 ms";
      },
      apply(state) {
        state.player.speed += 40;
        state.player.dash.distance += 80;
        state.player.dash.invulnDuration = Math.min(0.45, state.player.dash.invulnDuration + 0.07);
      },
    },
  ],
  matriarch: [
    {
      id: "matriarch-broodharvest",
      bossType: "matriarch",
      family: "sustain",
      familyLabel: "Sustain",
      icon: "\ud83d\udd78\ufe0f",
      title: "Brood Harvest",
      description: "Weaponize the swarm fantasy into scaling sustain and progression.",
      priority: 2,
      effectText() {
        return "+2.2 HP/s, +4 HP on kill, +16% XP gain";
      },
      apply(state) {
        state.player.regenPerSecond += 2.2;
        state.player.onKillHeal += 4;
        state.player.xpMultiplier += 0.16;
      },
    },
    {
      id: "matriarch-webstorm",
      bossType: "matriarch",
      family: "swarm",
      familyLabel: "Swarm",
      icon: "\ud83d\udd77\ufe0f",
      title: "Webstorm",
      description: "Overwhelm the map with denser spread and stronger crowd drag.",
      priority: 3,
      effectText() {
        return "+1 projectile, +12 damage, +16% slow";
      },
      apply(state) {
        state.player.weapon.extraProjectiles += 1;
        state.player.weapon.spreadAngle = Math.min(0.3, state.player.weapon.spreadAngle + 0.03);
        state.player.weapon.projectileDamage += 12;
        state.player.weapon.hitSlow = clamp(state.player.weapon.hitSlow + 0.16, 0, 0.9);
      },
    },
    {
      id: "matriarch-apexshell",
      bossType: "matriarch",
      family: "bulwark",
      familyLabel: "Bulwark",
      icon: "\ud83e\udeb2",
      title: "Apex Shell",
      description: "A brutish survival package for the harshest late-run screens.",
      priority: 1,
      effectText() {
        return "+60 max HP, damage taken -10%, +1 pierce";
      },
      apply(state) {
        state.player.maxHp += 60;
        state.player.hp = Math.min(state.player.maxHp, state.player.hp + 40);
        state.player.damageReduction = clamp(state.player.damageReduction + 0.1, 0, 0.72);
        state.player.weapon.projectilePierce += 1;
      },
    },
  ],
  harbinger: [
    {
      id: "harbinger-voidedict",
      bossType: "harbinger",
      family: "command",
      familyLabel: "Command",
      icon: "\u{1F9FF}",
      title: "Void Edict",
      description: "Push tempo and battlefield control upward in one clean package.",
      priority: 3,
      effectText() {
        return "Skill cooldowns -14%, move speed +26, status potency +12%";
      },
      apply(state) {
        state.player.skillCooldownRecovery += 0.14;
        state.player.speed += 26;
        state.player.statusPotency += 0.12;
      },
    },
    {
      id: "harbinger-latticecrown",
      bossType: "harbinger",
      family: "precision",
      familyLabel: "Precision",
      icon: "\u{1F539}",
      title: "Lattice Crown",
      description: "Convert the Harbinger into cleaner range, sharper execution, and stronger boss pressure.",
      priority: 2,
      effectText() {
        return "+110 projectile speed, +0.25s life, boss damage +20%";
      },
      apply(state) {
        state.player.weapon.projectileSpeed += 110;
        state.player.weapon.projectileLife += 0.25;
        state.player.weapon.bossDamageMultiplier += 0.2;
      },
    },
    {
      id: "harbinger-warchoir",
      bossType: "harbinger",
      family: "field",
      familyLabel: "Field",
      icon: "\u{1F3BC}",
      title: "War Choir",
      description: "Stronger zones and smoother movement let every class carry space more easily.",
      priority: 1,
      effectText() {
        return "Skill area +18%, skill duration +16%, dash recharge -0.8s";
      },
      apply(state) {
        state.player.skillAreaMultiplier += 0.18;
        state.player.skillDurationMultiplier += 0.16;
        state.player.dash.rechargeTime = Math.max(1.2, state.player.dash.rechargeTime - 0.8);
      },
    },
  ],
  regent: [
    {
      id: "regent-starforged",
      bossType: "regent",
      family: "artillery",
      familyLabel: "Artillery",
      icon: "\u{1FA90}",
      title: "Starforged Salvo",
      description: "Turn the Regent into pure screen coverage and heavier spell damage.",
      priority: 3,
      effectText() {
        return "+20% skill damage, +20% skill area, +1 projectile";
      },
      apply(state) {
        state.player.skillDamageMultiplier += 0.2;
        state.player.skillAreaMultiplier += 0.2;
        state.player.weapon.extraProjectiles += 1;
      },
    },
    {
      id: "regent-siegeclock",
      bossType: "regent",
      family: "tempo",
      familyLabel: "Tempo",
      icon: "\u23f0",
      title: "Siege Clock",
      description: "Raw throughput for runs that want to win by keeping the entire kit online.",
      priority: 2,
      effectText() {
        return "-65 ms interval, skill cooldowns -12%, +10 damage";
      },
      apply(state) {
        state.player.weapon.fireInterval = Math.max(0.08, state.player.weapon.fireInterval - 0.065);
        state.player.skillCooldownRecovery += 0.12;
        state.player.weapon.projectileDamage += 10;
      },
    },
    {
      id: "regent-celestialaegis",
      bossType: "regent",
      family: "bulwark",
      familyLabel: "Bulwark",
      icon: "\u2728",
      title: "Celestial Aegis",
      description: "A heavy late-run survival reward for the worst screens and the hardest bosses.",
      priority: 1,
      effectText() {
        return "+58 max HP, damage taken -11%, +1 dash charge";
      },
      apply(state) {
        state.player.maxHp += 58;
        state.player.hp = Math.min(state.player.maxHp, state.player.hp + 42);
        state.player.damageReduction = clamp(state.player.damageReduction + 0.11, 0, 0.74);
        state.player.dash.maxCharges = Math.min(5, state.player.dash.maxCharges + 1);
        state.player.dash.charges = Math.min(state.player.dash.maxCharges, state.player.dash.charges + 1);
      },
    },
  ],
};

const BOSS_BLESSING_LIBRARY = Object.entries(BOSS_REWARD_POOLS).flatMap(([bossType, rewards]) =>
  rewards.map((reward) => ({
    ...reward,
    bossType,
  }))
);

const META_STORAGE_KEY = "emoji-survivors-meta-v2";
const CLASS_ORDER = ["wind", "frost", "fire", "necro", "blood"];
const CLASS_UNLOCK_REQUIREMENTS = GAME_CONFIG.classUnlockRequirements ?? {
  wind: { xp: 0, enemyType: null, enemyKills: 0 },
  frost: { xp: 1500, enemyType: "runner", enemyKills: 70 },
  fire: { xp: 4200, enemyType: "tank", enemyKills: 75 },
  necro: { xp: 7800, enemyType: "brood", enemyKills: 40 },
  blood: { xp: 12500, enemyType: "fang", enemyKills: 70 },
};
const STATUS_PRIORITY = {
  wind: 1,
  chill: 2,
  burn: 3,
  freeze: 4,
  necro: 5,
  blood: 6,
};
const CLASS_DEFS = {
  wind: {
    id: "wind",
    icon: "\ud83c\udf2c\ufe0f",
    playerEmoji: "\uD83E\uDDDD\uD83C\uDFFB\u200D\u2642\uFE0F",
    title: "Wind Mage",
    adjective: "Wind",
    description: "Fast control mage that wins by clearing space and shoving packs apart.",
    color: "#e8f5ff",
    projectileColor: "#d7f6ff",
    projectileRgb: "215, 246, 255",
    autoDamage: 22,
    speedMultiplier: 1.12,
    maxHpMultiplier: 1,
    passiveLabel: "Slipstream Force",
    passiveText: "Auto attacks always knock harder, and movement speed is increased by 12%.",
    passiveType: "wind",
    skillUnlocks: [5, 15, 25],
    unlockMessage: "Learned a new wind technique.",
    skills: [
      { id: "gale-ring", title: "Gale Ring", icon: "\ud83c\udf00", slot: 1, cooldown: 7.2, role: "Panic", targeting: "self" },
      { id: "crosswind-strip", title: "Crosswind Strip", icon: "\ud83d\udca8", slot: 2, cooldown: 10.8, role: "Zone", targeting: "movement" },
      { id: "tempest-node", title: "Tempest Node", icon: "\ud83c\udf2a\ufe0f", slot: 3, cooldown: 15.5, role: "Signature", targeting: "cluster" },
    ],
  },
  frost: {
    id: "frost",
    icon: "\u2744\ufe0f",
    playerEmoji: "\uD83E\uDDD9\uD83C\uDFFB\u200D\u2642\uFE0F",
    title: "Frost Mage",
    adjective: "Frost",
    description: "Control mage that stacks chill into short freezes and brittle burst windows.",
    color: "#8ed8ff",
    projectileColor: "#9fe2ff",
    projectileRgb: "159, 226, 255",
    autoDamage: 24,
    speedMultiplier: 1,
    maxHpMultiplier: 1,
    passiveLabel: "Cold Equation",
    passiveText: "Auto attacks apply Chill. Repeated hits freeze targets briefly and leave them Brittle.",
    passiveType: "frost",
    skillUnlocks: [5, 15, 25],
    unlockMessage: "Learned a new frost technique.",
    skills: [
      { id: "blizzard-wake", title: "Blizzard Wake", icon: "\ud83c\udf28\ufe0f", slot: 1, cooldown: 7.6, role: "Panic", targeting: "self" },
      { id: "permafrost-seal", title: "Permafrost Seal", icon: "\u2746", slot: 2, cooldown: 11.8, role: "Zone", targeting: "cluster" },
      { id: "crystal-spear", title: "Crystal Spear", icon: "\ud83d\udd37", slot: 3, cooldown: 13.8, role: "Signature", targeting: "threat" },
    ],
  },
  fire: {
    id: "fire",
    icon: "\ud83d\udd25",
    playerEmoji: "\uD83E\uDEC5\uD83C\uDFFB",
    title: "Fire Mage",
    adjective: "Fire",
    description: "Area-denial mage that burns crowds down and turns chokepoints into kill zones.",
    color: "#ffb25e",
    projectileColor: "#ffc16b",
    projectileRgb: "255, 193, 107",
    autoDamage: 22,
    speedMultiplier: 1,
    maxHpMultiplier: 1,
    passiveLabel: "Kindling",
    passiveText: "Auto attacks apply Burn. Burning deaths splash embers into nearby enemies.",
    passiveType: "fire",
    skillUnlocks: [5, 15, 25],
    unlockMessage: "Learned a new fire technique.",
    skills: [
      { id: "cinder-halo", title: "Cinder Halo", icon: "\u2604\ufe0f", slot: 1, cooldown: 7.5, role: "Panic", targeting: "self" },
      { id: "sunspot", title: "Sunspot", icon: "\ud83c\udf1e", slot: 2, cooldown: 11.2, role: "Zone", targeting: "cluster" },
      { id: "ash-comet", title: "Ash Comet", icon: "\u2604", slot: 3, cooldown: 14.6, role: "Signature", targeting: "cluster" },
    ],
  },
  necro: {
    id: "necro",
    icon: "\ud83d\udc80",
    playerEmoji: "\uD83E\uDDDD\uD83C\uDFFF",
    title: "Necromancer",
    adjective: "Necrotic",
    description: "Durable attrition mage whose attacks pierce and whose thralls keep the frontline alive.",
    color: "#7de0b5",
    projectileColor: "#8cf0c3",
    projectileRgb: "140, 240, 195",
    autoDamage: 20,
    speedMultiplier: 0.94,
    maxHpMultiplier: 1.32,
    passiveLabel: "Black Procession",
    passiveText: "Auto attacks pierce. Kills can raise Thralls, and Thrall hits heal you slightly.",
    passiveType: "necro",
    skillUnlocks: [5, 15, 25],
    unlockMessage: "Learned a new necrotic rite.",
    skills: [
      { id: "bone-ward", title: "Bone Ward", icon: "\ud83e\uddb4", slot: 1, cooldown: 8.2, role: "Panic", targeting: "self" },
      { id: "requiem-field", title: "Requiem Field", icon: "\ud83e\udea6", slot: 2, cooldown: 12.2, role: "Zone", targeting: "cluster" },
      { id: "grave-call", title: "Grave Call", icon: "\u26b0\ufe0f", slot: 3, cooldown: 16.4, role: "Signature", targeting: "cluster" },
    ],
  },
  blood: {
    id: "blood",
    icon: "\ud83e\ude78",
    playerEmoji: "\uD83E\uDDDB\uD83C\uDFFB",
    title: "Blood Mage",
    adjective: "Blood",
    description: "High-risk duelist that sustains through damage, crits hard, and spikes after dashing.",
    color: "#ff6a88",
    projectileColor: "#ff7b98",
    projectileRgb: "255, 123, 152",
    autoDamage: 26,
    speedMultiplier: 1.08,
    maxHpMultiplier: 0.74,
    passiveLabel: "Hemomancy",
    passiveText: "Auto attacks lifesteal, can crit, and gain a short offensive buff after dashing.",
    passiveType: "blood",
    skillUnlocks: [5, 15, 25],
    unlockMessage: "Learned a new blood rite.",
    skills: [
      { id: "vein-burst", title: "Vein Burst", icon: "\ud83d\udca5", slot: 1, cooldown: 7.1, role: "Panic", targeting: "self" },
      { id: "crimson-pool", title: "Crimson Pool", icon: "\ud83e\ude78", slot: 2, cooldown: 11.4, role: "Zone", targeting: "cluster" },
      { id: "blood-rite", title: "Blood Rite", icon: "\ud83e\uddea", slot: 3, cooldown: 15.2, role: "Signature", targeting: "self" },
    ],
  },
};
const SKILL_SUMMARIES = {
  "gale-ring": "A fast circular burst that damages nearby enemies and violently clears breathing room.",
  "crosswind-strip": "Creates a wind lane in your movement direction that throws enemies sideways to open a path.",
  "tempest-node": "Summons a lingering tornado node in the densest pack to pull and carry enemies off-line.",
  "blizzard-wake": "Wraps the mage in a freezing storm that rapidly stacks Chill on everything near you.",
  "permafrost-seal": "Marks the densest pack with a frost seal that slows first, then bursts into freeze and Brittle.",
  "crystal-spear": "Launches a heavy ice lance into the nearest threat for sharp single-target burst.",
  "cinder-halo": "Ignites a close halo around the caster that repeatedly burns anything trying to collapse on you.",
  "sunspot": "Plants a bright fire zone under the thickest cluster and cooks it over time.",
  "ash-comet": "Calls down a delayed comet strike that detonates into a large fire burst.",
  "bone-ward": "Spins bone wards around the necromancer to grind nearby enemies and hold the line.",
  "requiem-field": "Spreads a necrotic field that weakens enemies and feeds your corpse economy.",
  "grave-call": "Raises fresh thralls from nearby corpses, or conjures a temporary one if none are ready.",
  "vein-burst": "Detonates a blood burst around the caster for close-range sustain and emergency damage.",
  "crimson-pool": "Drops a blood pool under a cluster to slow, drain, and fuel your sustain.",
  "blood-rite": "Enters a short ritual frenzy that amplifies blood offense and dash follow-up pressure.",
};
const HOSTILE_ARCANE_COLOR = "rgba(168, 116, 255, {a})";
const ENEMY_PROJECTILE_COLOR = HOSTILE_ARCANE_COLOR;
const BOSS_THEME_COLORS = Object.freeze({
  countess: "rgba(255, 109, 142, {a})",
  colossus: "rgba(242, 183, 109, {a})",
  abyss: "rgba(145, 162, 255, {a})",
  matriarch: "rgba(204, 122, 255, {a})",
  harbinger: "rgba(173, 150, 255, {a})",
  regent: "rgba(255, 194, 112, {a})",
});
const UPGRADE_BUCKETS = {
  offense: "Offense",
  tempo: "Tempo",
  survival: "Survival",
};
const MINOR_UPGRADES = [
  {
    id: "force",
    family: "force",
    familyLabel: "Offense",
    bucket: "offense",
    tier: "common",
    minLevel: 2,
    maxStacks: 10,
    weight: 20,
    icon: "\u2728",
    title: "Arcane Force",
    description: "Increase the raw damage of your auto attack.",
    effect(state, level, stacks) {
      return { damage: 2 + Math.floor(level * 0.5 + stacks * 0.35) };
    },
    effectText(effect) {
      return `Auto attack damage +${effect.damage}`;
    },
    apply(state, effect) {
      state.player.weapon.projectileDamage += effect.damage;
    },
  },
  {
    id: "spellforce",
    family: "spellforce",
    familyLabel: "Offense",
    bucket: "offense",
    tier: "common",
    minLevel: 2,
    maxStacks: 9,
    weight: 18,
    icon: "\ud83c\udf20",
    title: "Spellforce",
    description: "Increase the damage of all active skills.",
    effect(state, level, stacks) {
      return { multiplier: Number((0.08 + level * 0.0015 + stacks * 0.01).toFixed(3)) };
    },
    effectText(effect) {
      return `Skill damage +${Math.round(effect.multiplier * 100)}%`;
    },
    apply(state, effect) {
      state.player.skillDamageMultiplier += effect.multiplier;
    },
  },
  {
    id: "reach",
    family: "reach",
    familyLabel: "Offense",
    bucket: "offense",
    tier: "common",
    minLevel: 2,
    maxStacks: 8,
    weight: 16,
    icon: "\ud83c\udff9",
    title: "Long Reach",
    description: "Projectiles fly farther and lock onto targets from farther away.",
    effect(state, level) {
      return { life: 0.08 + level * 0.0035, targeting: 34 + level * 1.6, speed: 22 + level * 1.8 };
    },
    effectText(effect) {
      return `Range +${Math.round(effect.targeting)}, speed +${Math.round(effect.speed)}`;
    },
    apply(state, effect) {
      state.player.weapon.projectileLife += effect.life;
      state.player.weapon.projectileSpeed += effect.speed;
      state.player.weapon.targetingRange += effect.targeting;
    },
  },
  {
    id: "zonecraft",
    family: "zonecraft",
    familyLabel: "Offense",
    bucket: "offense",
    tier: "uncommon",
    minLevel: 6,
    maxStacks: 7,
    weight: 13,
    icon: "\ud83c\udf10",
    title: "Zonecraft",
    description: "Expand fields, rings, strips, and other lingering spells.",
    effect(state, level, stacks) {
      return {
        area: Number((0.08 + level * 0.001 + stacks * 0.012).toFixed(3)),
        duration: Number((0.04 + stacks * 0.01).toFixed(3)),
      };
    },
    effectText(effect) {
      return `Area +${Math.round(effect.area * 100)}%, duration +${Math.round(effect.duration * 100)}%`;
    },
    apply(state, effect) {
      state.player.skillAreaMultiplier += effect.area;
      state.player.skillDurationMultiplier += effect.duration;
    },
  },
  {
    id: "cadence",
    family: "cadence",
    familyLabel: "Tempo",
    bucket: "tempo",
    tier: "common",
    minLevel: 2,
    maxStacks: 10,
    weight: 18,
    icon: "\u23f1\ufe0f",
    title: "Arcane Cadence",
    description: "Fire your auto attack faster.",
    effect(state, level, stacks) {
      return { msReduction: Math.round(18 + level * 1.1 + stacks * 4.5) };
    },
    effectText(effect) {
      return `Attack interval -${effect.msReduction} ms`;
    },
    apply(state, effect) {
      state.player.weapon.fireInterval = Math.max(0.12, state.player.weapon.fireInterval - effect.msReduction / 1000);
    },
  },
  {
    id: "stride",
    family: "movement",
    familyLabel: "Tempo",
    bucket: "tempo",
    tier: "common",
    minLevel: 2,
    maxStacks: 8,
    weight: 16,
    icon: "\ud83d\udc62",
    title: "Fleet Stride",
    description: "Move faster and reposition more cleanly.",
    effect(state, level) {
      return { speedMultiplier: Number((0.06 + level * 0.0018).toFixed(3)) };
    },
    effectText(effect) {
      return `Move speed +${Math.round(effect.speedMultiplier * 100)}%`;
    },
    apply(state, effect) {
      state.player.speedMultiplier += effect.speedMultiplier;
    },
  },
  {
    id: "flow",
    family: "flow",
    familyLabel: "Tempo",
    bucket: "tempo",
    tier: "uncommon",
    minLevel: 4,
    maxStacks: 8,
    weight: 14,
    icon: "\u267e\ufe0f",
    title: "Flow State",
    description: "Active skills come back sooner.",
    effect(state, level, stacks) {
      return { cooldownMultiplier: Number((0.06 + level * 0.001 + stacks * 0.008).toFixed(3)) };
    },
    effectText(effect) {
      return `Skill cooldown recovery +${Math.round(effect.cooldownMultiplier * 100)}%`;
    },
    apply(state, effect) {
      state.player.skillCooldownRecovery += effect.cooldownMultiplier;
    },
  },
  {
    id: "dashstep",
    family: "dashstep",
    familyLabel: "Tempo",
    bucket: "tempo",
    tier: "uncommon",
    minLevel: 4,
    maxStacks: 6,
    weight: 13,
    icon: "\u26a1",
    title: "Blink Step",
    description: "Dash charges refill faster.",
    effect(state, level, stacks) {
      return { recovery: Number((0.09 + level * 0.0015 + stacks * 0.01).toFixed(3)) };
    },
    effectText(effect) {
      return `Dash recharge +${Math.round(effect.recovery * 100)}%`;
    },
    apply(state, effect) {
      state.player.dash.rechargeMultiplier += effect.recovery;
    },
  },
  {
    id: "magnetism",
    family: "magnetism",
    familyLabel: "Tempo",
    bucket: "tempo",
    tier: "common",
    minLevel: 3,
    maxStacks: 7,
    weight: 14,
    icon: "\ud83e\uddf2",
    title: "Magnetism",
    description: "Increase pickup attraction range for orbs and heals.",
    effect(state, level) {
      return { magnet: 28 + level * 2.2 };
    },
    effectText(effect) {
      return `Pickup magnet +${Math.round(effect.magnet)}`;
    },
    apply(state, effect) {
      state.player.pickupMagnetRadius += effect.magnet;
    },
  },
  {
    id: "vitality",
    family: "vitality",
    familyLabel: "Survival",
    bucket: "survival",
    tier: "common",
    minLevel: 2,
    maxStacks: 8,
    weight: 16,
    icon: "\u2764\ufe0f",
    title: "Vital Bloom",
    description: "Raise max HP and recover some of it instantly.",
    effect(state, level) {
      const maxHpGain = 10 + Math.floor(level * 0.75);
      return { maxHpGain, heal: Math.round(maxHpGain * 0.7) };
    },
    effectText(effect) {
      return `+${effect.maxHpGain} max HP, heal ${effect.heal}`;
    },
    apply(state, effect) {
      state.player.maxHp += effect.maxHpGain;
      state.player.hp = Math.min(state.player.maxHp, state.player.hp + effect.heal);
    },
  },
  {
    id: "bastion",
    family: "bastion",
    familyLabel: "Survival",
    bucket: "survival",
    tier: "uncommon",
    minLevel: 4,
    maxStacks: 6,
    weight: 13,
    icon: "\ud83d\udee1\ufe0f",
    title: "Bastion Weave",
    description: "Reduce incoming damage.",
    effect(state, level, stacks) {
      return { reduction: Number((0.035 + level * 0.0008 + stacks * 0.004).toFixed(3)) };
    },
    effectText(effect) {
      return `Damage taken -${Math.round(effect.reduction * 100)}%`;
    },
    apply(state, effect) {
      state.player.damageReduction = clamp(state.player.damageReduction + effect.reduction, 0, 0.58);
    },
  },
  {
    id: "moonwell",
    family: "moonwell",
    familyLabel: "Survival",
    bucket: "survival",
    tier: "uncommon",
    minLevel: 5,
    maxStacks: 6,
    weight: 11,
    icon: "\ud83c\udf19",
    title: "Moonwell",
    description: "Improve passive sustain and the value of healing pickups.",
    effect(state, level, stacks) {
      return {
        regen: Number((0.32 + level * 0.035 + stacks * 0.08).toFixed(2)),
        healAmp: Number((0.12 + stacks * 0.03).toFixed(3)),
      };
    },
    effectText(effect) {
      return `Regen +${effect.regen}/s, healing +${Math.round(effect.healAmp * 100)}%`;
    },
    apply(state, effect) {
      state.player.regenPerSecond += effect.regen;
      state.player.healingMultiplier += effect.healAmp;
    },
  },
];
const MAJOR_UPGRADE_PAIRS = [
  {
    id: "barrage",
    label: "Coverage vs Focus",
    left: {
      id: "split-volley",
      family: "major-barrage",
      familyLabel: "Coverage",
      tier: "rare",
      icon: "\ud83c\udfaf",
      title: "Split Volley",
      description: "Add one projectile and widen your screen presence.",
      effectText() {
        return "+1 projectile, +10% projectile speed";
      },
      apply(state) {
        state.player.weapon.extraProjectiles += 1;
        state.player.weapon.projectileSpeed += 48;
      },
    },
    right: {
      id: "arcane-focus",
      family: "major-barrage",
      familyLabel: "Focus",
      tier: "rare",
      icon: "\ud83d\udca0",
      title: "Arcane Focus",
      description: "Keep one accurate stream and hit much harder with it.",
      effectText() {
        return "+22% auto attack damage, +18% boss damage";
      },
      apply(state) {
        state.player.weapon.projectileDamage *= 1.22;
        state.player.weapon.bossDamageMultiplier += 0.18;
      },
    },
  },
  {
    id: "dash",
    label: "Reserve vs Tempo",
    left: {
      id: "reservoir",
      family: "major-dash",
      familyLabel: "Reserve",
      tier: "rare",
      icon: "\ud83d\udd37",
      title: "Reservoir",
      description: "Store another dash for layered safety.",
      effectText() {
        return "+1 dash charge";
      },
      apply(state) {
        state.player.dash.maxCharges = Math.min(5, state.player.dash.maxCharges + 1);
        state.player.dash.charges = Math.min(state.player.dash.maxCharges, state.player.dash.charges + 1);
      },
    },
    right: {
      id: "surge",
      family: "major-dash",
      familyLabel: "Tempo",
      tier: "rare",
      icon: "\u26a1",
      title: "Surge",
      description: "Make every dash come back faster and spike your movement right after using it.",
      effectText() {
        return "Dash recharge +30%, post-dash haste +18%";
      },
      apply(state) {
        state.player.dash.rechargeMultiplier += 0.3;
        state.player.afterDashHaste += 0.18;
      },
    },
  },
  {
    id: "shape",
    label: "Area vs Precision",
    left: {
      id: "wide-reach",
      family: "major-shape",
      familyLabel: "Area",
      tier: "rare",
      icon: "\ud83c\udf0d",
      title: "Wide Reach",
      description: "Expand fields, rings, and strips into larger control tools.",
      effectText() {
        return "Skill area +24%, duration +12%";
      },
      apply(state) {
        state.player.skillAreaMultiplier += 0.24;
        state.player.skillDurationMultiplier += 0.12;
      },
    },
    right: {
      id: "needle-casting",
      family: "major-shape",
      familyLabel: "Precision",
      tier: "rare",
      icon: "\ud83d\udccc",
      title: "Needle Casting",
      description: "Turn your output into cleaner single-target execution.",
      effectText() {
        return "Auto attack damage +18%, skill damage +16%";
      },
      apply(state) {
        state.player.weapon.projectileDamage *= 1.18;
        state.player.skillDamageMultiplier += 0.16;
      },
    },
  },
  {
    id: "survival",
    label: "Reserve vs Overclock",
    left: {
      id: "vital-reserve",
      family: "major-survival",
      familyLabel: "Reserve",
      tier: "rare",
      icon: "\ud83e\udde1",
      title: "Vital Reserve",
      description: "A heavy package of health, mitigation, and better healing.",
      effectText() {
        return "+38 max HP, damage taken -10%, healing +24%";
      },
      apply(state) {
        state.player.maxHp += 38;
        state.player.hp = Math.min(state.player.maxHp, state.player.hp + 30);
        state.player.damageReduction = clamp(state.player.damageReduction + 0.1, 0, 0.68);
        state.player.healingMultiplier += 0.24;
      },
    },
    right: {
      id: "overclock",
      family: "major-survival",
      familyLabel: "Overclock",
      tier: "rare",
      icon: "\ud83d\udd25",
      title: "Overclock",
      description: "Lean hard into aggression and ability tempo.",
      effectText() {
        return "Attack cadence +18%, skill cooldown recovery +20%";
      },
      apply(state) {
        state.player.weapon.fireInterval = Math.max(0.11, state.player.weapon.fireInterval * 0.82);
        state.player.skillCooldownRecovery += 0.2;
      },
    },
  },
  {
    id: "control",
    label: "Lockdown vs Execution",
    left: {
      id: "lockdown",
      family: "major-control",
      familyLabel: "Lockdown",
      tier: "rare",
      icon: "\ud83e\uddca",
      title: "Lockdown",
      description: "Push statuses further and make control windows easier to hold.",
      effectText() {
        return "Status potency +18%, status duration +18%";
      },
      apply(state) {
        state.player.statusPotency += 0.18;
        state.player.statusDurationMultiplier += 0.18;
      },
    },
    right: {
      id: "execution",
      family: "major-control",
      familyLabel: "Execution",
      tier: "rare",
      icon: "\u2694\ufe0f",
      title: "Execution",
      description: "Exploit controlled targets for far more damage.",
      effectText() {
        return "Damage to afflicted enemies +22%";
      },
      apply(state) {
        state.player.damageVsAfflicted += 0.22;
      },
    },
  },
  {
    id: "stance",
    label: "Fieldcraft vs Pursuit",
    left: {
      id: "fieldcraft",
      family: "major-stance",
      familyLabel: "Fieldcraft",
      tier: "rare",
      icon: "\ud83e\ude84",
      title: "Fieldcraft",
      description: "Strengthen all stationary zones and fields.",
      effectText() {
        return "Zone damage +20%, zone duration +16%";
      },
      apply(state) {
        state.player.zoneDamageMultiplier += 0.2;
        state.player.skillDurationMultiplier += 0.16;
      },
    },
    right: {
      id: "pursuit",
      family: "major-stance",
      familyLabel: "Pursuit",
      tier: "rare",
      icon: "\ud83c\udfc3",
      title: "Pursuit",
      description: "Turn movement and dash rhythm into more pressure.",
      effectText() {
        return "Move speed +16%, dash distance +24, post-dash power +14%";
      },
      apply(state) {
        state.player.speedMultiplier += 0.16;
        state.player.dash.distance += 24;
        state.player.afterDashPower += 0.14;
      },
    },
  },
];
const ALL_UPGRADES_BY_ID = new Map(
  MINOR_UPGRADES.map((entry) => [entry.id, { ...entry, kind: "minor" }]).concat(
    MAJOR_UPGRADE_PAIRS.flatMap((pair) => [
      [pair.left.id, { ...pair.left, kind: "major", pairId: pair.id }],
      [pair.right.id, { ...pair.right, kind: "major", pairId: pair.id }],
    ])
  )
);
const MAJOR_PAIR_BY_ID = new Map(MAJOR_UPGRADE_PAIRS.map((pair) => [pair.id, pair]));
const MAJOR_ENTRY_TO_PAIR_ID = new Map(
  MAJOR_UPGRADE_PAIRS.flatMap((pair) => [
    [pair.left.id, pair.id],
    [pair.right.id, pair.id],
  ])
);

function getMajorRankList(entryId) {
  return MAJOR_UPGRADE_CONFIG.ranks?.[entryId] ?? [];
}

function getMajorMaxStacks(entryId) {
  return getMajorRankList(entryId).length;
}

function getMajorRankSpec(entryId, currentStacks = state?.upgrades?.[entryId] ?? 0) {
  const ranks = getMajorRankList(entryId);
  if (ranks.length === 0) {
    return null;
  }
  return ranks[Math.min(currentStacks, ranks.length - 1)] ?? null;
}

function formatPercentValue(value) {
  return `${Math.round(value * 100)}%`;
}

function joinEffectParts(parts) {
  return parts.filter(Boolean).join(", ");
}

function getMajorEffectText(entryId, currentStacks = state?.upgrades?.[entryId] ?? 0) {
  const spec = getMajorRankSpec(entryId, currentStacks);
  if (!spec) {
    return "";
  }
  switch (entryId) {
    case "split-volley":
      return joinEffectParts([
        `+${spec.projectiles} projectile`,
        `+${Math.round((spec.projectileSpeed / 470) * 100)}% projectile speed`,
      ]);
    case "arcane-focus":
      return joinEffectParts([
        `+${formatPercentValue(spec.autoDamageMultiplier)} auto attack damage`,
        `+${formatPercentValue(spec.bossDamageBonus)} boss damage`,
      ]);
    case "reservoir":
      return joinEffectParts([
        spec.dashCharges ? `+${spec.dashCharges} dash charge` : "",
        spec.rechargeMultiplier ? `Dash recharge +${formatPercentValue(spec.rechargeMultiplier)}` : "",
        spec.invulnDuration ? `Dash i-frames +${spec.invulnDuration.toFixed(2)}s` : "",
      ]);
    case "surge":
      return joinEffectParts([
        `Dash recharge +${formatPercentValue(spec.rechargeMultiplier)}`,
        `Post-dash haste +${formatPercentValue(spec.haste)}`,
      ]);
    case "wide-reach":
      return joinEffectParts([
        `Skill area +${formatPercentValue(spec.area)}`,
        `Duration +${formatPercentValue(spec.duration)}`,
      ]);
    case "needle-casting":
      return joinEffectParts([
        `Auto attack damage +${formatPercentValue(spec.autoDamageMultiplier)}`,
        `Skill damage +${formatPercentValue(spec.skillDamageBonus)}`,
        `Projectile speed +${Math.round((spec.projectileSpeed / 470) * 100)}%`,
      ]);
    case "vital-reserve":
      return joinEffectParts([
        `+${spec.maxHp} max HP`,
        `Damage taken -${formatPercentValue(spec.damageReduction)}`,
        `Healing +${formatPercentValue(spec.healAmp)}`,
      ]);
    case "overclock":
      return joinEffectParts([
        `Attack cadence +${Math.round((1 - spec.fireIntervalFactor) * 100)}%`,
        `Skill cooldown recovery +${formatPercentValue(spec.skillCooldownRecovery)}`,
      ]);
    case "lockdown":
      return joinEffectParts([
        `Status potency +${formatPercentValue(spec.statusPotency)}`,
        `Status duration +${formatPercentValue(spec.statusDuration)}`,
      ]);
    case "execution":
      return `Damage to afflicted enemies +${formatPercentValue(spec.damageVsAfflicted)}`;
    case "fieldcraft":
      return joinEffectParts([
        `Zone damage +${formatPercentValue(spec.zoneDamage)}`,
        `Zone duration +${formatPercentValue(spec.duration)}`,
      ]);
    case "pursuit":
      return joinEffectParts([
        `Move speed +${formatPercentValue(spec.speedMultiplier)}`,
        `Dash distance +${Math.round(spec.dashDistance)}`,
        `Post-dash power +${formatPercentValue(spec.afterDashPower)}`,
      ]);
    default:
      return "";
  }
}

function applyMajorUpgradeRank(entryId, gameState, currentStacks = gameState.upgrades?.[entryId] ?? 0) {
  const spec = getMajorRankSpec(entryId, currentStacks);
  if (!spec) {
    return false;
  }
  switch (entryId) {
    case "split-volley":
      gameState.player.weapon.extraProjectiles += spec.projectiles;
      gameState.player.weapon.projectileSpeed += spec.projectileSpeed;
      break;
    case "arcane-focus":
      gameState.player.weapon.projectileDamage *= 1 + spec.autoDamageMultiplier;
      gameState.player.weapon.bossDamageMultiplier += spec.bossDamageBonus;
      break;
    case "reservoir":
      if (spec.dashCharges) {
        gameState.player.dash.maxCharges = Math.min(5, gameState.player.dash.maxCharges + spec.dashCharges);
      }
      if (spec.rechargeMultiplier) {
        gameState.player.dash.rechargeMultiplier += spec.rechargeMultiplier;
      }
      if (spec.invulnDuration) {
        gameState.player.dash.invulnDuration += spec.invulnDuration;
      }
      if (spec.restoreCharge) {
        gameState.player.dash.charges = Math.min(
          gameState.player.dash.maxCharges,
          gameState.player.dash.charges + spec.restoreCharge
        );
      } else if (spec.dashCharges) {
        gameState.player.dash.charges = Math.min(gameState.player.dash.maxCharges, gameState.player.dash.charges + 1);
      }
      break;
    case "surge":
      gameState.player.dash.rechargeMultiplier += spec.rechargeMultiplier;
      gameState.player.afterDashHaste += spec.haste;
      break;
    case "wide-reach":
      gameState.player.skillAreaMultiplier += spec.area;
      gameState.player.skillDurationMultiplier += spec.duration;
      break;
    case "needle-casting":
      gameState.player.weapon.projectileDamage *= 1 + spec.autoDamageMultiplier;
      gameState.player.skillDamageMultiplier += spec.skillDamageBonus;
      gameState.player.weapon.projectileSpeed += spec.projectileSpeed;
      break;
    case "vital-reserve":
      gameState.player.maxHp += spec.maxHp;
      gameState.player.hp = Math.min(gameState.player.maxHp, gameState.player.hp + spec.healNow);
      gameState.player.damageReduction = clamp(gameState.player.damageReduction + spec.damageReduction, 0, 0.74);
      gameState.player.healingMultiplier += spec.healAmp;
      break;
    case "overclock":
      gameState.player.weapon.fireInterval = Math.max(0.11, gameState.player.weapon.fireInterval * spec.fireIntervalFactor);
      gameState.player.skillCooldownRecovery += spec.skillCooldownRecovery;
      break;
    case "lockdown":
      gameState.player.statusPotency += spec.statusPotency;
      gameState.player.statusDurationMultiplier += spec.statusDuration;
      break;
    case "execution":
      gameState.player.damageVsAfflicted += spec.damageVsAfflicted;
      break;
    case "fieldcraft":
      gameState.player.zoneDamageMultiplier += spec.zoneDamage;
      gameState.player.skillDurationMultiplier += spec.duration;
      break;
    case "pursuit":
      gameState.player.speedMultiplier += spec.speedMultiplier;
      gameState.player.dash.distance += spec.dashDistance;
      gameState.player.afterDashPower += spec.afterDashPower;
      break;
    default:
      return false;
  }
  return true;
}

function getMajorPairStacks(pair) {
  return (state.upgrades[pair.left.id] ?? 0) + (state.upgrades[pair.right.id] ?? 0);
}

function getAvailableMajorPairs() {
  const fullChoicePairs = [];
  const partialChoicePairs = [];
  for (const pair of MAJOR_UPGRADE_PAIRS) {
    const leftAvailable = (state.upgrades[pair.left.id] ?? 0) < getMajorMaxStacks(pair.left.id);
    const rightAvailable = (state.upgrades[pair.right.id] ?? 0) < getMajorMaxStacks(pair.right.id);
    if (leftAvailable && rightAvailable) {
      fullChoicePairs.push(pair);
    } else if (leftAvailable || rightAvailable) {
      partialChoicePairs.push(pair);
    }
  }
  return fullChoicePairs.length > 0 ? fullChoicePairs : partialChoicePairs;
}

function pickMajorUpgradePair() {
  const availablePairs = getAvailableMajorPairs();
  if (availablePairs.length === 0) {
    return null;
  }
  let totalWeight = 0;
  const weightedPairs = availablePairs.map((pair) => {
    const baseWeight = MAJOR_UPGRADE_CONFIG.pairWeights?.[pair.id] ?? 1;
    const fatigue = 1 / (1 + getMajorPairStacks(pair) * (MAJOR_UPGRADE_CONFIG.fatiguePerPairPick ?? 0.14));
    const repeatPenalty = state.lastMajorPairId === pair.id ? MAJOR_UPGRADE_CONFIG.repeatPairWeight ?? 0.42 : 1;
    const weight = Math.max(0.05, baseWeight * fatigue * repeatPenalty);
    totalWeight += weight;
    return { pair, weight };
  });
  let roll = Math.random() * totalWeight;
  for (const entry of weightedPairs) {
    roll -= entry.weight;
    if (roll <= 0) {
      return entry.pair;
    }
  }
  return weightedPairs[weightedPairs.length - 1]?.pair ?? availablePairs[availablePairs.length - 1];
}

function getElapsedMinutes(atTime = state?.elapsed ?? 0) {
  return atTime / 60;
}

function getEnemyHpScale(profile, options = {}) {
  const minutes = getElapsedMinutes(options.atTime ?? state?.elapsed ?? 0);
  const scaledMinutes = Math.max(0, minutes - (ENEMY_SCALING_CONFIG.startMinute ?? 2));
  if (scaledMinutes <= 0) {
    return 1;
  }
  if (profile?.isBoss) {
    const encounterIndex = options.bossEncounterIndex ?? 0;
    return (
      1 +
      scaledMinutes * (ENEMY_SCALING_CONFIG.bossLinear ?? 0.02) +
      scaledMinutes * scaledMinutes * (ENEMY_SCALING_CONFIG.bossQuadratic ?? 0.0012) +
      encounterIndex * (ENEMY_SCALING_CONFIG.bossEncounterBonus ?? 0.06)
    );
  }
  return (
    1 +
    scaledMinutes * (ENEMY_SCALING_CONFIG.regularLinear ?? 0.015) +
    scaledMinutes * scaledMinutes * (ENEMY_SCALING_CONFIG.regularQuadratic ?? 0.0009)
  );
}

function getCurrentUnlockTargetId(meta = null) {
  const source = meta ?? metaProgress;
  return CLASS_ORDER.find((classId) => !(source.unlocked[classId] ?? false)) ?? null;
}

function reconcileMetaUnlocks(meta) {
  if (!meta || typeof meta !== "object") {
    return createDefaultMetaProgress();
  }

  let nextTargetId = getCurrentUnlockTargetId(meta);
  while (nextTargetId) {
    const requirement = CLASS_UNLOCK_REQUIREMENTS[nextTargetId];
    const currentXp = Math.max(0, meta.unlockState?.targetClassId === nextTargetId ? meta.unlockState.xp ?? 0 : 0);
    const currentKills = Math.max(0, meta.unlockState?.targetClassId === nextTargetId ? meta.unlockState.kills ?? 0 : 0);
    const clampedXp = Math.min(requirement.xp, currentXp);
    const clampedKills = Math.min(requirement.enemyKills, currentKills);

    if (clampedXp < requirement.xp || clampedKills < requirement.enemyKills) {
      meta.unlockState = {
        targetClassId: nextTargetId,
        xp: clampedXp,
        kills: clampedKills,
      };
      return meta;
    }

    meta.unlocked[nextTargetId] = true;
    meta.selectedClassId = nextTargetId;
    meta.unlockState = {
      targetClassId: null,
      xp: 0,
      kills: 0,
    };
    nextTargetId = getCurrentUnlockTargetId(meta);
  }

  meta.unlockState = {
    targetClassId: null,
    xp: 0,
    kills: 0,
  };
  return meta;
}

function createDefaultMetaProgress() {
  const unlocked = {};
  for (const classId of CLASS_ORDER) {
    unlocked[classId] = classId === "wind";
  }
  return {
    selectedClassId: "wind",
    unlocked,
    unlockState: {
      targetClassId: "frost",
      xp: 0,
      kills: 0,
    },
    lifetime: {
      runs: 0,
      totalXpCollected: 0,
      totalKills: 0,
    },
  };
}

function normalizeMetaProgress(candidate) {
  const fallback = createDefaultMetaProgress();
  if (!candidate || typeof candidate !== "object") {
    return fallback;
  }
  const unlocked = { ...fallback.unlocked, ...(candidate.unlocked ?? {}) };
  unlocked.wind = true;
  const selectedClassId = unlocked[candidate.selectedClassId] ? candidate.selectedClassId : "wind";
  const targetClassId = getCurrentUnlockTargetId({ unlocked }) ?? null;
  return reconcileMetaUnlocks({
    selectedClassId,
    unlocked,
    unlockState: {
      targetClassId,
      xp: targetClassId && candidate.unlockState?.targetClassId === targetClassId ? Math.max(0, candidate.unlockState.xp ?? 0) : 0,
      kills: targetClassId && candidate.unlockState?.targetClassId === targetClassId ? Math.max(0, candidate.unlockState.kills ?? 0) : 0,
    },
    lifetime: {
      runs: Math.max(0, candidate.lifetime?.runs ?? 0),
      totalXpCollected: Math.max(0, candidate.lifetime?.totalXpCollected ?? 0),
      totalKills: Math.max(0, candidate.lifetime?.totalKills ?? 0),
    },
  });
}

function loadMetaProgress() {
  try {
    const raw = localStorage.getItem(META_STORAGE_KEY);
    if (!raw) {
      return createDefaultMetaProgress();
    }
    return normalizeMetaProgress(JSON.parse(raw));
  } catch {
    return createDefaultMetaProgress();
  }
}

function saveMetaProgress() {
  try {
    metaProgress = reconcileMetaUnlocks(metaProgress);
    localStorage.setItem(META_STORAGE_KEY, JSON.stringify(metaProgress));
  } catch {
    // ignore storage errors in file:// or private contexts
  }
}

function createDefaultTelemetryStore() {
  return {
    runs: [],
  };
}

function normalizeTelemetryStore(candidate) {
  const fallback = createDefaultTelemetryStore();
  if (!candidate || typeof candidate !== "object" || !Array.isArray(candidate.runs)) {
    return fallback;
  }
  return {
    runs: candidate.runs
      .filter((entry) => entry && typeof entry === "object")
      .slice(-40),
  };
}

function loadTelemetryStore() {
  try {
    const raw = localStorage.getItem(TELEMETRY_STORAGE_KEY);
    if (!raw) {
      return createDefaultTelemetryStore();
    }
    return normalizeTelemetryStore(JSON.parse(raw));
  } catch {
    return createDefaultTelemetryStore();
  }
}

function saveTelemetryStore() {
  try {
    localStorage.setItem(TELEMETRY_STORAGE_KEY, JSON.stringify(telemetryStore));
  } catch {
    // ignore storage errors in private or restricted contexts
  }
}

function createRunTelemetry(classId) {
  return {
    runId: `run-${Date.now()}-${Math.floor(Math.random() * 100000)}`,
    classId,
    startedAt: new Date().toISOString(),
    levelTimings: { 1: 0 },
    rewardChoices: [],
    bossEncounters: [],
    totalDamageTaken: 0,
    damageTakenBySource: {},
    recentDamage: [],
    final: null,
  };
}

function recordTelemetryLevel(level) {
  if (!state?.telemetry || state.telemetry.levelTimings[level] !== undefined) {
    return;
  }
  state.telemetry.levelTimings[level] = Number(state.elapsed.toFixed(2));
}

function recordTelemetryReward(kind, option, detail = {}) {
  if (!state?.telemetry || !option) {
    return;
  }
  state.telemetry.rewardChoices.push({
    at: Number(state.elapsed.toFixed(2)),
    level: state.progression.level,
    kind,
    id: option.id,
    title: option.title,
    family: option.familyLabel ?? option.family ?? "",
    tier: option.tier ?? null,
    ...detail,
  });
}

function recordTelemetryBossSpawn(enemy) {
  if (!state?.telemetry || !enemy?.isBoss) {
    return;
  }
  state.telemetry.bossEncounters.push({
    enemyId: enemy.id,
    type: enemy.type,
    spawnedAt: Number(state.elapsed.toFixed(2)),
    defeatedAt: null,
  });
}

function recordTelemetryBossDefeat(enemy) {
  if (!state?.telemetry || !enemy?.isBoss) {
    return;
  }
  const encounter = [...state.telemetry.bossEncounters].reverse().find((entry) => entry.enemyId === enemy.id);
  if (encounter) {
    encounter.defeatedAt = Number(state.elapsed.toFixed(2));
  }
}

function recordTelemetryDamage(rawDamage, reducedDamage, source = null) {
  if (!state?.telemetry) {
    return;
  }
  const sourceKey = source?.key ?? `${source?.kind ?? "unknown"}:${source?.source ?? "unknown"}`;
  state.telemetry.totalDamageTaken = Number((state.telemetry.totalDamageTaken + reducedDamage).toFixed(2));
  state.telemetry.damageTakenBySource[sourceKey] = Number(
    ((state.telemetry.damageTakenBySource[sourceKey] ?? 0) + reducedDamage).toFixed(2)
  );
  state.telemetry.recentDamage.push({
    at: Number(state.elapsed.toFixed(2)),
    raw: Number(rawDamage.toFixed(2)),
    reduced: Number(reducedDamage.toFixed(2)),
    key: sourceKey,
    label: source?.label ?? sourceKey,
    details: source?.details ?? null,
  });
  if (state.telemetry.recentDamage.length > 18) {
    state.telemetry.recentDamage.shift();
  }
}

function finalizeRunTelemetry() {
  if (!state?.telemetry || state.telemetry.final) {
    return state?.telemetry ?? null;
  }
  const majorRanks = {};
  for (const pair of MAJOR_UPGRADE_PAIRS) {
    if ((state.upgrades[pair.left.id] ?? 0) > 0) {
      majorRanks[pair.left.id] = state.upgrades[pair.left.id];
    }
    if ((state.upgrades[pair.right.id] ?? 0) > 0) {
      majorRanks[pair.right.id] = state.upgrades[pair.right.id];
    }
  }
  state.telemetry.final = {
    endedAt: new Date().toISOString(),
    duration: Number(state.elapsed.toFixed(2)),
    level: state.progression.level,
    kills: state.kills,
    xpCollected: Math.round(state.metaRun.xpCollected),
    cause: state.runEnd.cause || "unknown",
    killBreakdown: { ...state.killBreakdown },
    majorChoices: { ...state.majorChoices },
    majorRanks,
    bossDefeats: { ...state.bossDefeats },
  };
  telemetryStore.runs.push(state.telemetry);
  telemetryStore.runs = telemetryStore.runs.slice(-40);
  saveTelemetryStore();
  return state.telemetry;
}


const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d", { alpha: false });

const hud = {
  time: document.getElementById("timeValue"),
  level: document.getElementById("levelValue"),
  kills: document.getElementById("killsValue"),
  hpValue: document.getElementById("hpValue"),
  hpCurrent: document.getElementById("hpCurrent"),
  hpMax: document.getElementById("hpMax"),
  hpLagFill: document.getElementById("hpLagFill"),
  hpFill: document.getElementById("hpFill"),
  xpValue: document.getElementById("xpValue"),
  xpCurrent: document.getElementById("xpCurrent"),
  xpMax: document.getElementById("xpMax"),
  xpLagFill: document.getElementById("xpLagFill"),
  xpFill: document.getElementById("xpFill"),
};
const dashChargeElements = Array.from(document.querySelectorAll("#dashCharges .dash-charge"));
const dashChargeFills = dashChargeElements.map((element) => element.querySelector(".dash-charge-fill"));
const dashHud = document.getElementById("dashHud");
const passiveSkillCard = document.querySelector('[data-skill-panel="passive"]');
const skillCardElements = Array.from(document.querySelectorAll("[data-skill-slot]")).map((element) => ({
  root: element,
  slot: Number(element.dataset.skillSlot),
  cooldown: element.querySelector(".skill-cd"),
  icon: element.querySelector(".skill-icon"),
  fill: element.querySelector(".skill-fill"),
}));
const skillTooltip = {
  root: document.getElementById("skillTooltip"),
  icon: document.getElementById("skillTooltipIcon"),
  title: document.getElementById("skillTooltipTitle"),
  meta: document.getElementById("skillTooltipMeta"),
  body: document.getElementById("skillTooltipBody"),
};

const bossHud = {
  root: document.getElementById("bossHud"),
  name: document.getElementById("bossNameValue"),
  hp: document.getElementById("bossHpValue"),
  hpCurrent: document.getElementById("bossHpCurrent"),
  hpMax: document.getElementById("bossHpMax"),
  phaseTracks: document.getElementById("bossPhaseTracks"),
};

const levelUpOverlay = document.getElementById("levelUpOverlay");
const levelUpTitle = document.getElementById("levelUpTitle");
const levelUpFlash = levelUpOverlay.querySelector(".levelup-flash");
const levelUpCard = levelUpOverlay.querySelector(".levelup-card");
const levelUpKicker = levelUpOverlay.querySelector(".levelup-kicker");
const levelUpSubtitle = levelUpOverlay.querySelector(".levelup-subtitle");
const upgradeOptions = document.getElementById("upgradeOptions");
const bossRewardOverlay = document.getElementById("bossRewardOverlay");
const bossRewardCard = document.getElementById("bossRewardCard");
const bossRewardTitle = document.getElementById("bossRewardTitle");
const bossRewardSubtitle = document.getElementById("bossRewardSubtitle");
const bossRewardFlash = bossRewardOverlay.querySelector(".boss-reward-flash");
const bossRewardOptions = document.getElementById("bossRewardOptions");

const pauseOverlay = document.getElementById("pauseOverlay");
const menuKicker = pauseOverlay.querySelector(".menu-kicker");
const pauseTitle = document.getElementById("pauseTitle");
const pauseSubtitle = document.getElementById("pauseSubtitle");
const pauseMeta = document.getElementById("pauseMeta");
const upgradesButton = document.getElementById("upgradesButton");
const upgradesList = document.getElementById("upgradesList");
const closeUpgradesButton = document.getElementById("closeUpgradesButton");
const pauseRestartButton = document.getElementById("pauseRestartButton");
const pausePanel = pauseOverlay.querySelector(".pause-panel");
const devToolsPanel = document.getElementById("devToolsPanel");
const bossSpawnSelect = document.getElementById("bossSpawnSelect");
const spawnBossButton = document.getElementById("spawnBossButton");
const zenModeButton = document.getElementById("zenModeButton");
const zenModeStatus = document.getElementById("zenModeStatus");

const gameOverOverlay = document.getElementById("gameOverOverlay");
const resultValue = document.getElementById("resultValue");
const resultStats = document.getElementById("resultStats");
const restartButton = document.getElementById("restartButton");
const gameOverCard = gameOverOverlay.querySelector(".overlay-card");
const fpsValue = document.getElementById("fpsValue");
const startOverlay = document.getElementById("startOverlay");
const classSelectGrid = document.getElementById("classSelectGrid");
const classProgressCard = document.getElementById("classProgressCard");
const startRunButton = document.getElementById("startRunButton");
const startSubtitle = document.getElementById("startSubtitle");

const pressedActions = new Set();
const DEV_TOGGLE_KEYS = new Set(["`", "~", "Ñ‘", "Ð"]);
const BOSS_TYPES = Object.keys(ENEMY_ARCHETYPES).filter((type) => ENEMY_ARCHETYPES[type].isBoss);
const TIER_ORDER = {
  common: 0,
  uncommon: 1,
  rare: 2,
  legendary: 3,
};

function rollBossEncounterDelay(encounterIndex) {
  const range = BOSS_GAP_RANGES[Math.min(encounterIndex, BOSS_GAP_RANGES.length - 1)];
  return randRange(range.min, range.max);
}

function getEligibleBossTypes(atTime = state?.elapsed ?? 0) {
  return BOSS_TYPES.filter((type) => {
    if ((state?.bossDefeats?.[type] ?? 0) >= 3) {
      return false;
    }
    return atTime >= (BOSS_UNLOCK_TIMES[type] ?? 0);
  });
}

let backgroundGradient = null;
let metaProgress = loadMetaProgress();
let telemetryStore = loadTelemetryStore();
let state = createInitialState(metaProgress.selectedClassId);
let previousTime = performance.now() / 1000;
let accumulator = 0;
let deterministicSteppingEnabled = false;

resizeCanvas();
bindEvents();
populateBossSpawnSelect();
renderStartOverlay();
updateHud(true);
requestAnimationFrame(gameLoop);

function createInitialState(classId = "wind") {
  WORLD_FEATURE_CACHE.clear();
  TERRAIN_TILE_CACHE.clear();
  const worldSeed = Math.floor(Math.random() * 2147483647);
  const classDef = CLASS_DEFS[classId] ?? CLASS_DEFS.wind;
  const baseSpeed = 220 * classDef.speedMultiplier;
  const baseMaxHp = Math.round(100 * classDef.maxHpMultiplier);
  return {
    running: false,
    elapsed: 0,
    kills: 0,
    score: 0,
    killBreakdown: {},
    nextEntityId: 1,
    tick: 0,
    hudTimer: 0,
    world: {
      seed: worldSeed,
    },
    hudCache: {
      time: "",
      level: "",
      kills: "",
      hp: "",
      xp: "",
      hpCurrent: "",
      hpMax: "",
      xpCurrent: "",
      xpMax: "",
      hpRatio: 1,
      xpRatio: 0,
      hpFill: "",
      hpLagFill: "",
      xpFill: "",
      xpLagFill: "",
      bossRatio: 1,
      bossName: "",
      bossHp: "",
      bossHpCurrent: "",
      bossHpMax: "",
      bossFill: "",
      bossLagFill: "",
      bossVisible: false,
      fps: "",
    },
    hudMotion: {
      hpLagRatio: 1,
      xpLagRatio: 0,
      bossLagRatio: 1,
      hpLagDelay: 0,
      xpLagDelay: 0,
      bossLagDelay: 0,
      playerBarShakeTimer: 0,
      bossBarShakeTimer: 0,
    },
    player: {
      classId,
      x: 0,
      y: 0,
      radius: 16,
      speed: baseSpeed,
      speedMultiplier: 1,
      maxHp: baseMaxHp,
      hp: baseMaxHp,
      damageReduction: 0,
      xpMultiplier: 1,
      emoji: classDef.playerEmoji,
      classColor: classDef.color,
      hitFlash: 0,
      hitShakeTimer: 0,
      hitShakePower: 0,
      lastMoveX: 1,
      lastMoveY: 0,
      fireCooldown: 0,
      regenPerSecond: 0,
      onKillHeal: 0,
      healingMultiplier: 1,
      pickupMagnetRadius: 0,
      skillDamageMultiplier: 1,
      zoneDamageMultiplier: 1,
      skillAreaMultiplier: 1,
      skillDurationMultiplier: 1,
      skillCooldownRecovery: 0,
      statusPotency: 0,
      statusDurationMultiplier: 1,
      damageVsAfflicted: 0,
      afterDashHaste: 0,
      afterDashPower: 0,
      afterDashBuffTimer: 0,
      bloodRiteTimer: 0,
      bloodCritChance: classId === "blood" ? 0.12 : 0,
      bloodCritMultiplier: classId === "blood" ? 1.9 : 1.5,
      lifesteal: classId === "blood" ? 0.08 : 0,
      thrallLifestealPerHit: classId === "necro" ? 0.8 : 0,
      weapon: {
        fireInterval: 0.34,
        projectileSpeed: 470,
        projectileDamage: classDef.autoDamage,
        projectileRadius: 4.4,
        projectileLife: 1.2,
        projectilePierce: classId === "necro" ? 2 : 1,
        extraProjectiles: 0,
        spreadAngle: 0.1,
        targetingRange: 920,
        knockback: classId === "wind" ? 240 : 150,
        bossDamageMultiplier: 1,
      },
      dash: {
        charges: 1,
        maxCharges: 1,
        rechargeTime: 4.8,
        rechargeMultiplier: 0,
        rechargeTimer: 0,
        pulseIndex: -1,
        pulseTimer: 0,
        failFlashTimer: 0,
        distance: 145,
        duration: 0.15,
        invulnDuration: 0.16,
        activeTimer: 0,
        iFramesTimer: 0,
        vx: 0,
        vy: 0,
      },
      skills: classDef.skills.map((skill) => ({
        id: skill.id,
        slot: skill.slot,
        cooldown: skill.cooldown,
        timer: randRange(skill.cooldown * 0.35, skill.cooldown * 0.85),
        unlocked: false,
        mastery: 0,
        unlockPulseTimer: 0,
        castFlashTimer: 0,
      })),
    },
    progression: {
      level: 1,
      xp: 0,
      xpToNext: getXpToNext(1),
      pendingLevelUps: 0,
      rewardQueue: [],
    },
    upgrades: {},
    majorChoices: {},
    lastMajorPairId: null,
    skillUnlocksClaimed: 0,
    masteryChoicesClaimed: 0,
    bossBlessings: {},
    bossDefeats: {},
    bossSeen: {},
    corpses: [],
    allies: [],
    cameraShake: {
      timer: 0,
      power: 0,
      offsetX: 0,
      offsetY: 0,
    },
    runEnd: {
      active: false,
      timer: 0,
      duration: 3.2,
      cause: "",
    },
    levelUp: {
      active: false,
      options: [],
      recentIds: [],
      category: "minor",
      rewardLevel: 1,
    },
    bossReward: {
      active: false,
      bossType: null,
      bossName: "",
      options: [],
    },
    pause: {
      manual: false,
      focus: false,
      upgradesPanel: false,
      devMenu: false,
    },
    dev: {
      zenMode: false,
      bossChoice: "random",
      disableSpawns: false,
      manualSkillMode: false,
      zeroSkillCooldown: false,
    },
    bossDirector: {
      encounterIndex: 0,
      nextTime: rollBossEncounterDelay(0),
      warningLead: 9,
    },
    lastBossType: null,
    spawnDirector: {
      timer: 0.18,
      baseInterval: SPAWN_DIRECTOR_CONFIG.baseInterval,
      minInterval: SPAWN_DIRECTOR_CONFIG.minInterval,
      maxEnemiesOnField: SPAWN_DIRECTOR_CONFIG.maxEnemiesOnField,
    },
    enemies: [],
    projectiles: [],
    enemyAttacks: [],
    pickups: [],
    effects: [],
    damageNumbers: [],
    enemyGrid: {
      map: new Map(),
      cells: [],
    },
    pickupDirector: {
      healTimer: randRange(8.5, 12.5),
      maxHealPickups: 5,
    },
    metaRun: {
      xpCollected: 0,
      unlockedClassThisRun: null,
    },
    telemetry: createRunTelemetry(classId),
    performance: {
      fpsDisplay: 0,
      fpsSmooth: 60,
      fpsTimer: 0,
    },
  };
}

function getClassDef(classId = state.player.classId) {
  return CLASS_DEFS[classId] ?? CLASS_DEFS.wind;
}

function getLevelRewardKind(level) {
  if (level === 5 || level === 15 || level === 25) {
    return "skill";
  }
  if (level === 10 || level === 20 || (level >= 35 && level % 10 === 5)) {
    return "major";
  }
  if (level >= 30 && level % 10 === 0) {
    return "mastery";
  }
  return "minor";
}

function getSkillUnlockIndexForLevel(level) {
  if (level === 5) {
    return 0;
  }
  if (level === 15) {
    return 1;
  }
  if (level === 25) {
    return 2;
  }
  return -1;
}

function getMasteryTier(level) {
  if (level < 30 || level % 10 !== 0) {
    return 0;
  }
  return Math.min(2, Math.floor((level - 20) / 10));
}

function getUnlockedSkillStates() {
  return state.player.skills.filter((skill) => skill.unlocked);
}

function getSkillState(slot) {
  return state.player.skills.find((skill) => skill.slot === slot) ?? null;
}

function hasAffliction(enemy) {
  return enemy.freezeTimer > 0 || enemy.brittleTimer > 0 || enemy.chillStacks > 0 || enemy.burnTimer > 0 || enemy.necroMarkTimer > 0 || enemy.bloodMarkTimer > 0;
}

function bindEvents() {
  window.addEventListener("keydown", (event) => {
    if (isDevToggleEvent(event)) {
      if (state.running && !state.levelUp.active && !state.bossReward.active) {
        toggleDevMenu();
      }
      event.preventDefault();
      return;
    }

    if (event.code === "Escape") {
      if (!state.running) {
        return;
      }

      if (state.levelUp.active || state.bossReward.active) {
        event.preventDefault();
        return;
      }

      if (state.pause.upgradesPanel) {
        closeUpgradesPanel();
      } else if (isPauseActive()) {
        clearPause();
      } else {
        setPause("manual", true);
      }

      event.preventDefault();
      return;
    }

    if (event.code === "Tab") {
      if (state.running && !state.levelUp.active && !state.bossReward.active) {
        toggleUpgradesPanel();
      }
      event.preventDefault();
      return;
    }

    if (state.levelUp.active) {
      if (event.code === "Digit1" || event.code === "Numpad1") {
        trySelectUpgradeByIndex(0);
        event.preventDefault();
      } else if (event.code === "Digit2" || event.code === "Numpad2") {
        trySelectUpgradeByIndex(1);
        event.preventDefault();
      } else if (event.code === "Digit3" || event.code === "Numpad3") {
        trySelectUpgradeByIndex(2);
        event.preventDefault();
      }
      return;
    }

    if (state.bossReward.active) {
      if (event.code === "Digit1" || event.code === "Numpad1") {
        trySelectBossRewardByIndex(0);
        event.preventDefault();
      } else if (event.code === "Digit2" || event.code === "Numpad2") {
        trySelectBossRewardByIndex(1);
        event.preventDefault();
      } else if (event.code === "Digit3" || event.code === "Numpad3") {
        trySelectBossRewardByIndex(2);
        event.preventDefault();
      }
      return;
    }

    if (event.code === "Space" && state.running && !event.repeat) {
      if (!tryDash()) {
        triggerDashUnavailableFeedback();
      }
      event.preventDefault();
      return;
    }

    const action = actionFromEvent(event);
    if (action) {
      pressedActions.add(action);
      event.preventDefault();
      return;
    }

    if (!state.running && (event.code === "Space" || event.code === "Enter")) {
      event.preventDefault();
      if (!startOverlay.classList.contains("hidden")) {
        startRun();
      } else {
        restartRun();
      }
    }
  });

  window.addEventListener("keyup", (event) => {
    const action = actionFromEvent(event);
    if (!action) {
      return;
    }
    pressedActions.delete(action);
    event.preventDefault();
  });

  window.addEventListener("blur", () => {
    pressedActions.clear();
    hideSkillTooltip();
    if (state.running && !state.levelUp.active && !state.pause.upgradesPanel) {
      setPause("focus", true);
    }
  });

  document.addEventListener("visibilitychange", () => {
    if (document.hidden && state.running && !state.levelUp.active && !state.pause.upgradesPanel) {
      setPause("focus", true);
    }
  });

  window.addEventListener("focus", () => {
    // Keep paused after focus returns; user resumes with Esc.
  });

  window.addEventListener("resize", resizeCanvas);
  restartButton.addEventListener("click", restartRun);
  pauseRestartButton.addEventListener("click", () => endRun({ instant: true, cause: "ended" }));
  upgradeOptions.addEventListener("click", onUpgradeOptionClick);
  bossRewardOptions.addEventListener("click", onBossRewardOptionClick);
  upgradesButton.addEventListener("click", toggleUpgradesPanel);
  closeUpgradesButton.addEventListener("click", closeUpgradesPanel);
  upgradesList.addEventListener("click", onUpgradeRowClick);
  pauseOverlay.addEventListener("click", (event) => {
    if (event.target !== pauseOverlay || !isPauseActive()) {
      return;
    }
    clearPause();
  });
  spawnBossButton.addEventListener("click", handleSpawnBossClick);
  zenModeButton.addEventListener("click", toggleZenMode);
  startRunButton.addEventListener("click", startRun);
  classSelectGrid.addEventListener("click", onClassCardClick);
  for (const card of [passiveSkillCard, ...skillCardElements.map((entry) => entry.root)]) {
    if (!card) {
      continue;
    }
    card.addEventListener("mouseenter", () => showSkillTooltip(card));
    card.addEventListener("mousemove", () => showSkillTooltip(card));
    card.addEventListener("mouseleave", hideSkillTooltip);
    if (card.dataset.skillSlot) {
      card.addEventListener("click", () => {
        if (!state.dev.manualSkillMode) {
          return;
        }
        window.debug_game?.triggerSkill(Number(card.dataset.skillSlot));
      });
    }
  }
  bossSpawnSelect.addEventListener("change", () => {
    state.dev.bossChoice = bossSpawnSelect.value;
  });
}

function resizeCanvas() {
  viewWidth = Math.max(360, window.innerWidth);
  viewHeight = Math.max(240, window.innerHeight);

  canvas.width = viewWidth;
  canvas.height = viewHeight;

  backgroundGradient = ctx.createLinearGradient(0, 0, 0, viewHeight);
  backgroundGradient.addColorStop(0, "#102520");
  backgroundGradient.addColorStop(1, "#1f392f");
}

function actionFromEvent(event) {
  const byCode = ACTIONS_BY_CODE[event.code];
  if (byCode) {
    return byCode;
  }

  const normalizedKey = event.key.toLowerCase();
  return ACTIONS_BY_KEY[normalizedKey] ?? null;
}

function isDevToggleEvent(event) {
  return event.code === "Backquote" || DEV_TOGGLE_KEYS.has(event.key);
}

function gameLoop(nowMs) {
  if (deterministicSteppingEnabled) {
    render();
    requestAnimationFrame(gameLoop);
    return;
  }

  const now = nowMs / 1000;
  const frameTime = Math.min(now - previousTime, MAX_FRAME_TIME);
  previousTime = now;
  updateFps(frameTime);
  accumulator += frameTime;

  while (accumulator >= FIXED_STEP) {
    update(FIXED_STEP);
    accumulator -= FIXED_STEP;
  }

  render();
  requestAnimationFrame(gameLoop);
}

function updateFps(frameTime) {
  const perf = state.performance;
  const instantaneousFps = frameTime > 0 ? 1 / frameTime : 0;
  perf.fpsSmooth = perf.fpsSmooth * 0.88 + instantaneousFps * 0.12;
  perf.fpsTimer -= frameTime;
  if (perf.fpsTimer > 0) {
    return;
  }

  perf.fpsTimer = 0.22;
  perf.fpsDisplay = Math.max(0, Math.round(perf.fpsSmooth));
  const label = `FPS ${perf.fpsDisplay}`;
  if (state.hudCache.fps !== label) {
    state.hudCache.fps = label;
    fpsValue.textContent = label;
  }
}

function getFxTier() {
  const perf = state.performance;
  const loadScore = state.enemies.length * 0.9 + state.effects.length * 1.35 + state.projectiles.length * 0.8;
  if (perf.fpsSmooth < 42 || loadScore > 250) {
    return 2;
  }
  if (perf.fpsSmooth < 54 || loadScore > 160) {
    return 1;
  }
  return 0;
}

function scaleFxCount(count) {
  const tier = getFxTier();
  if (tier >= 2) {
    return Math.max(1, Math.round(count * 0.35));
  }
  if (tier >= 1) {
    return Math.max(1, Math.round(count * 0.6));
  }
  return count;
}

function update(dt) {
  updateHudBarAnimations(dt);

  if (state.runEnd.active) {
    updateRunEndSequence(dt);
    updateEffects(dt);
    cleanupDeadEntities();
    return;
  }

  if (!state.running || state.levelUp.active || state.bossReward.active || isPauseActive()) {
    return;
  }

  state.tick += 1;
  state.elapsed += dt;

  updatePlayerMovement(dt);
  updatePlayerRegeneration(dt);
  updatePlayerClassBuffs(dt);
  updateAutoFire(dt);
  updateAutoSkills(dt);
  updateProjectiles(dt);
  updateEffects(dt);
  spawnEnemies(dt);
  maybeSpawnBosses();
  updateEnemiesAndSpatialGrid(dt);
  updateAllies(dt);
  resolveProjectileEnemyCollisions(state.enemyGrid);
  resolveAllyEnemyCollisions(state.enemyGrid);
  updateEnemyAttacks(dt);
  resolvePlayerEnemyDamage(dt, state.enemyGrid);
  updatePickups(dt);
  cleanupDeadEntities();

  state.hudTimer -= dt;
  if (state.hudTimer <= 0) {
    state.hudTimer = 0.08;
    updateHud(false);
  }
}

function updatePlayerMovement(dt) {
  updateDashState(dt);

  if (state.player.dash.activeTimer > 0) {
    moveCircleEntity(state.player, state.player.dash.vx * dt, state.player.dash.vy * dt, state.player.radius);
    return;
  }

  const movement = getMovementAxis();
  if (movement.x === 0 && movement.y === 0) {
    return;
  }

  const length = Math.hypot(movement.x, movement.y) || 1;
  const normalizedX = movement.x / length;
  const normalizedY = movement.y / length;

  state.player.lastMoveX = normalizedX;
  state.player.lastMoveY = normalizedY;
  const haste = state.player.afterDashBuffTimer > 0 ? 1 + state.player.afterDashHaste : 1;
  const moveSpeed = state.player.speed * state.player.speedMultiplier * haste;
  moveCircleEntity(state.player, normalizedX * moveSpeed * dt, normalizedY * moveSpeed * dt, state.player.radius);
}

function getMovementAxis() {
  const x = Number(pressedActions.has("right")) - Number(pressedActions.has("left"));
  const y = Number(pressedActions.has("down")) - Number(pressedActions.has("up"));
  return { x, y };
}

function updateDashState(dt) {
  const dash = state.player.dash;
  const effectiveRechargeTime = Math.max(0.85, dash.rechargeTime / (1 + state.player.dash.rechargeMultiplier));
  if (state.dev.zenMode) {
    dash.activeTimer = Math.max(0, dash.activeTimer - dt);
    dash.iFramesTimer = Math.max(0, dash.iFramesTimer - dt);
    dash.pulseTimer = Math.max(0, dash.pulseTimer - dt);
    dash.failFlashTimer = Math.max(0, dash.failFlashTimer - dt);
    if (dash.activeTimer <= 0) {
      dash.vx = 0;
      dash.vy = 0;
    }
    dash.maxCharges = 5;
    dash.charges = 5;
    dash.rechargeTimer = 0;
    return;
  }

  dash.activeTimer = Math.max(0, dash.activeTimer - dt);
  dash.iFramesTimer = Math.max(0, dash.iFramesTimer - dt);
  dash.pulseTimer = Math.max(0, dash.pulseTimer - dt);
  dash.failFlashTimer = Math.max(0, dash.failFlashTimer - dt);

  if (dash.activeTimer <= 0) {
    dash.vx = 0;
    dash.vy = 0;
  }

  if (dash.charges >= dash.maxCharges) {
    dash.rechargeTimer = 0;
    return;
  }

  dash.rechargeTimer = Math.max(0, dash.rechargeTimer - dt);
  while (dash.rechargeTimer <= 0 && dash.charges < dash.maxCharges) {
    dash.charges += 1;
    dash.pulseIndex = dash.charges - 1;
    dash.pulseTimer = 0.48;
    if (dash.charges < dash.maxCharges) {
      dash.rechargeTimer += effectiveRechargeTime;
    }
  }

  if (dash.charges >= dash.maxCharges) {
    dash.rechargeTimer = 0;
  }
}

function updatePlayerRegeneration(dt) {
  const player = state.player;
  if (player.regenPerSecond <= 0) {
    return;
  }
  player.hp = Math.min(player.maxHp, player.hp + player.regenPerSecond * player.healingMultiplier * dt);
}

function updatePlayerClassBuffs(dt) {
  state.player.afterDashBuffTimer = Math.max(0, state.player.afterDashBuffTimer - dt);
  state.player.bloodRiteTimer = Math.max(0, state.player.bloodRiteTimer - dt);
  for (const skill of state.player.skills) {
    skill.unlockPulseTimer = Math.max(0, skill.unlockPulseTimer - dt);
    skill.castFlashTimer = Math.max(0, skill.castFlashTimer - dt);
  }
}

function tryDash() {
  const player = state.player;
  const dash = player.dash;
  if (dash.activeTimer > 0) {
    return false;
  }
  if (!state.dev.zenMode && dash.charges <= 0) {
    return false;
  }

  const movement = getMovementAxis();
  let dirX = movement.x;
  let dirY = movement.y;
  if (dirX === 0 && dirY === 0) {
    dirX = player.lastMoveX;
    dirY = player.lastMoveY;
  }

  const length = Math.hypot(dirX, dirY);
  if (length <= 0.0001) {
    return false;
  }

  dirX /= length;
  dirY /= length;
  player.lastMoveX = dirX;
  player.lastMoveY = dirY;

  if (!state.dev.zenMode) {
    dash.charges -= 1;
  }
  dash.activeTimer = dash.duration;
  dash.iFramesTimer = Math.max(dash.iFramesTimer, dash.invulnDuration);
  player.afterDashBuffTimer = Math.max(player.afterDashBuffTimer, player.classId === "blood" ? 2.2 : 1.1);
  const speed = dash.distance / dash.duration;
  dash.vx = dirX * speed;
  dash.vy = dirY * speed;
  if (!state.dev.zenMode && dash.charges < dash.maxCharges && dash.rechargeTimer <= 0) {
    dash.rechargeTimer = Math.max(0.85, dash.rechargeTime / (1 + player.dash.rechargeMultiplier));
  }

  spawnDashEffect(player.x, player.y, dirX, dirY);
  updateHud(true);
  return true;
}

function triggerDashUnavailableFeedback() {
  const dash = state.player.dash;
  dash.failFlashTimer = Math.max(dash.failFlashTimer, 0.34);
  updateDashHud();
}

function clampPlayerToWorld() {
  const resolved = resolveCircleAgainstWorld(
    clamp(state.player.x, WORLD.left + state.player.radius, WORLD.right - state.player.radius),
    clamp(state.player.y, WORLD.top + state.player.radius, WORLD.bottom - state.player.radius),
    state.player.radius,
    { water: true, solids: true }
  );
  state.player.x = resolved.x;
  state.player.y = resolved.y;
}

function updateAutoFire(dt) {
  const player = state.player;
  player.fireCooldown -= dt;

  while (player.fireCooldown <= 0) {
    const target = findNearestEnemy(player.x, player.y, player.weapon.targetingRange);
    if (!target) {
      player.fireCooldown = 0;
      return;
    }

    spawnProjectileSpread(player, target);
    player.fireCooldown += player.weapon.fireInterval;
  }
}

function spawnProjectileSpread(player, target) {
  const dx = target.x - player.x;
  const dy = target.y - player.y;
  const baseAngle = Math.atan2(dy, dx);
  const total = 1 + player.weapon.extraProjectiles;
  const totalConeWidth = player.weapon.spreadAngle;

  for (let i = 0; i < total; i += 1) {
    const normalizedIndex = total <= 1 ? 0 : i / (total - 1) - 0.5;
    const spreadAngle = baseAngle + normalizedIndex * totalConeWidth;
    spawnProjectile(player, Math.cos(spreadAngle), Math.sin(spreadAngle));
  }
}

function spawnProjectile(player, dirX, dirY) {
  spawnCastEffect(player.x, player.y, dirX, dirY);
  const classDef = getClassDef();
  state.projectiles.push({
    id: state.nextEntityId++,
    owner: "player",
    x: player.x,
    y: player.y,
    vx: dirX * player.weapon.projectileSpeed,
    vy: dirY * player.weapon.projectileSpeed,
    radius: player.weapon.projectileRadius,
    damage: player.weapon.projectileDamage,
    life: player.weapon.projectileLife,
    pierce: player.weapon.projectilePierce,
    color: classDef.projectileColor,
    rgb: classDef.projectileRgb,
    dead: false,
  });
}

function updatePickups(dt) {
  const player = state.player;
  const director = state.pickupDirector;

  director.healTimer -= dt;
  const healCount = state.pickups.filter((pickup) => !pickup.dead && pickup.type === "heal").length;
  if (director.healTimer <= 0 && healCount < director.maxHealPickups) {
    spawnHealPickup();
    director.healTimer = randRange(9.2, 14.5);
  }

  for (const pickup of state.pickups) {
    if (pickup.dead) {
      continue;
    }

    pickup.life -= dt;
    pickup.floatTime += dt;
    pickup.spawnTimer = Math.max(0, (pickup.spawnTimer ?? 0) - dt);
    pickup.absorbTimer = Math.max(0, pickup.absorbTimer ?? 0);
    if (pickup.life <= 0) {
      pickup.dead = true;
      continue;
    }

    if (isMagneticPickup(pickup)) {
      updateMagneticPickupMotion(pickup, player, dt);
    }

    if (pickup.absorbing) {
      pickup.absorbTimer -= dt;
      const absorbProgress = clamp(1 - pickup.absorbTimer / pickup.absorbDuration, 0, 1);
      pickup.x = lerp(pickup.absorbStartX, player.x, easeInOut(absorbProgress));
      pickup.y = lerp(pickup.absorbStartY, player.y, easeInOut(absorbProgress));
      if (pickup.absorbTimer <= 0) {
        if (pickup.type === "heal") {
          collectHealPickup(pickup);
        } else {
          collectXpPickup(pickup);
        }
      }
      continue;
    }

    const collectPadding = pickup.type === "xp-orb" ? 18 : pickup.type === "xp-cache" ? 20 : pickup.type === "heal" ? 18 : 5;
    if (circlesOverlap(player.x, player.y, player.radius, pickup.x, pickup.y, pickup.radius + collectPadding)) {
      if (isMagneticPickup(pickup)) {
        beginPickupAbsorb(pickup);
      } else {
        collectHealPickup(pickup);
      }
    }
  }
}

function isMagneticPickup(pickup) {
  return pickup.type === "xp-orb" || pickup.type === "xp-cache" || pickup.type === "heal";
}

function updateMagneticPickupMotion(pickup, player, dt) {
  pickup.vx = (pickup.vx ?? 0) * Math.exp(-7.5 * dt);
  pickup.vy = (pickup.vy ?? 0) * Math.exp(-7.5 * dt);

  const dx = player.x - pickup.x;
  const dy = player.y - pickup.y;
  const distance = Math.hypot(dx, dy) || 1;
  const magnetBonus = player.pickupMagnetRadius ?? 0;
  const magnetRadius = (pickup.type === "xp-cache" ? 240 : pickup.type === "heal" ? 220 : 190) + magnetBonus;
  if (distance <= magnetRadius) {
    const distanceFactor = 1 - distance / magnetRadius;
    const pull =
      520 +
      distanceFactor * distanceFactor *
        (pickup.type === "xp-cache" ? 1480 : pickup.type === "heal" ? 1260 : 1180);
    pickup.vx += (dx / distance) * pull * dt;
    pickup.vy += (dy / distance) * pull * dt;
  }

  pickup.x += pickup.vx * dt;
  pickup.y += pickup.vy * dt;
}

function beginPickupAbsorb(pickup) {
  if (pickup.absorbing) {
    return;
  }
  pickup.absorbing = true;
  pickup.absorbStartX = pickup.x;
  pickup.absorbStartY = pickup.y;
  const distance = Math.hypot(state.player.x - pickup.x, state.player.y - pickup.y);
  const normalized = clamp(distance / 180, 0, 1);
  const farDuration = pickup.type === "xp-cache" ? 0.2 : pickup.type === "heal" ? 0.18 : 0.15;
  const nearDuration = pickup.type === "xp-cache" ? 0.1 : pickup.type === "heal" ? 0.09 : 0.07;
  pickup.absorbDuration = lerp(nearDuration, farDuration, normalized);
  pickup.absorbTimer = pickup.absorbDuration;
  pickup.vx = 0;
  pickup.vy = 0;
}

function spawnHealPickup() {
  const anchor = pickPickupPoint(260, 420);
  state.pickups.push({
    id: state.nextEntityId++,
    type: "heal",
    x: anchor.x,
    y: anchor.y,
    radius: 18,
    healAmount: 26,
    life: 22,
    maxLife: 22,
    despawnWarning: 7.2,
    floatTime: Math.random() * Math.PI * 2,
    spawnTimer: 0.28,
    spawnDuration: 0.28,
    vx: 0,
    vy: 0,
    absorbing: false,
    dead: false,
  });
  spawnPickupSpawnEffect(anchor.x, anchor.y, "heal");
}

function spawnXpDrops(enemy) {
  const { x: sourceX, y: sourceY, xpReward: totalXp, isBoss } = enemy;
  const scaledXp = Math.max(1, Math.round(totalXp * state.player.xpMultiplier));
  let orbBudget = scaledXp;
  if (isBoss) {
    const cacheValue = Math.max(26, Math.round(scaledXp * 0.42));
    const cacheAnchor = pickXpDropPosition(sourceX, sourceY, 18, 20, 88);
    spawnXpCache(cacheAnchor.x, cacheAnchor.y, cacheValue);
    orbBudget = Math.max(1, scaledXp - cacheValue);
  }

  const values = distributeXpIntoOrbs(orbBudget, enemy);
  for (let i = 0; i < values.length; i += 1) {
    const orbitRadius = isBoss ? randRange(20, 110) : randRange(10, 42);
    const angle = (i / Math.max(1, values.length)) * Math.PI * 2 + randRange(-0.3, 0.3);
    const anchor = pickXpDropPosition(
      sourceX + Math.cos(angle) * orbitRadius,
      sourceY + Math.sin(angle) * orbitRadius,
      12,
      16,
      isBoss ? 124 : 56
    );
    state.pickups.push({
      id: state.nextEntityId++,
      type: "xp-orb",
      x: anchor.x,
      y: anchor.y,
      radius: values[i] >= 21 ? 7.2 : values[i] >= 8 ? 6.2 : 5.3,
      xpAmount: values[i],
      life: isBoss ? 28 : 20,
      maxLife: isBoss ? 28 : 20,
      despawnWarning: isBoss ? 9.4 : 7.8,
      floatTime: Math.random() * Math.PI * 2,
      spawnTimer: 0.24,
      spawnDuration: 0.24,
      vx: Math.cos(angle) * randRange(30, isBoss ? 115 : 75),
      vy: Math.sin(angle) * randRange(30, isBoss ? 115 : 75) - randRange(12, 36),
      absorbing: false,
      dead: false,
    });
    spawnPickupSpawnEffect(anchor.x, anchor.y, "xp-orb");
  }
}

function spawnXpCache(x, y, xpAmount) {
  state.pickups.push({
    id: state.nextEntityId++,
    type: "xp-cache",
    x,
    y,
    radius: 17,
    xpAmount,
    life: 26,
    maxLife: 26,
    despawnWarning: 8.5,
    floatTime: Math.random() * Math.PI * 2,
    spawnTimer: 0.3,
    spawnDuration: 0.3,
    vx: 0,
    vy: 0,
    absorbing: false,
    dead: false,
  });
  spawnPickupSpawnEffect(x, y, "xp-cache");
}

function distributeXpIntoOrbs(totalXp, enemy) {
  const values = [];
  let remaining = Math.max(1, Math.round(totalXp));
  const cap = getXpOrbCap(enemy);
  while (remaining > 0 && values.length < cap) {
    const ideal = remaining / Math.max(1, cap - values.length);
    let best = XP_ORB_VALUES[0];
    for (const candidate of XP_ORB_VALUES) {
      if (candidate > remaining) {
        break;
      }
      if (candidate <= ideal * 1.48 || candidate === remaining) {
        best = candidate;
      }
    }
    values.push(best);
    remaining -= best;
  }
  if (remaining > 0) {
    values[values.length - 1] += remaining;
  }
  return values;
}

function getXpOrbCap(enemy) {
  if (enemy.isBoss) {
    return 4;
  }
  if (enemy.type === "grunt" || enemy.type === "runner" || enemy.type === "fang" || enemy.type === "hexer") {
    return 1;
  }
  if (enemy.type === "tank" || enemy.type === "wraith" || enemy.type === "oracle" || enemy.type === "banner") {
    return 2;
  }
  return 3;
}

function pickXpDropPosition(anchorX, anchorY, radius, minSpacing, searchRadius) {
  const nearby = state.pickups.filter(
    (pickup) =>
      !pickup.dead &&
      (pickup.type === "xp-orb" || pickup.type === "xp-cache" || pickup.type === "heal")
  );

  for (let attempt = 0; attempt < 28; attempt += 1) {
    const angle = Math.random() * Math.PI * 2;
    const distance = attempt === 0 ? 0 : randRange(6, searchRadius);
    const rawX = clamp(anchorX + Math.cos(angle) * distance, WORLD.left + 48, WORLD.right - 48);
    const rawY = clamp(anchorY + Math.sin(angle) * distance, WORLD.top + 48, WORLD.bottom - 48);
    const point = findNearbyWalkablePoint(rawX, rawY, radius, 72);
    const clear = nearby.every((pickup) => Math.hypot(point.x - pickup.x, point.y - pickup.y) >= radius + pickup.radius + minSpacing);
    if (clear) {
      return point;
    }
  }

  return findNearbyWalkablePoint(anchorX, anchorY, radius, 96);
}

function pickPickupPoint(minDistance, maxDistance) {
  const halfWorldWidth = (WORLD.right - WORLD.left) * 0.5;
  const halfWorldHeight = (WORLD.bottom - WORLD.top) * 0.5;
  const normalizedX = clamp(state.player.x / halfWorldWidth, -1, 1);
  const normalizedY = clamp(state.player.y / halfWorldHeight, -1, 1);
  const edgePressure = clamp(Math.max(Math.abs(normalizedX), Math.abs(normalizedY)), 0, 1);

  let pullX = -normalizedX;
  let pullY = -normalizedY;
  if (Math.abs(pullX) + Math.abs(pullY) < 0.12) {
    const angle = Math.random() * Math.PI * 2;
    pullX = Math.cos(angle);
    pullY = Math.sin(angle);
  }

  const centerAngle = Math.atan2(pullY, pullX);
  const spread = (1 - edgePressure) * 1.45 + 0.28;
  const minimumPickupSpacing = 148;

  for (let attempt = 0; attempt < 28; attempt += 1) {
    const angle = centerAngle + randRange(-spread, spread);
    const distance = randRange(minDistance, maxDistance + edgePressure * 180);
    const x = clamp(state.player.x + Math.cos(angle) * distance, WORLD.left + 64, WORLD.right - 64);
    const y = clamp(state.player.y + Math.sin(angle) * distance, WORLD.top + 64, WORLD.bottom - 64);
    const farEnoughFromPlayer = Math.hypot(x - state.player.x, y - state.player.y) >= 200;
    const farEnoughFromPickups = state.pickups.every(
      (pickup) => pickup.dead || Math.hypot(x - pickup.x, y - pickup.y) >= minimumPickupSpacing
    );
    if (farEnoughFromPlayer && farEnoughFromPickups && isWalkablePoint(x, y, 20)) {
      return { x, y };
    }
  }

  for (let attempt = 0; attempt < 12; attempt += 1) {
    const x = clamp(state.player.x + randRange(-1, 1) * maxDistance, WORLD.left + 64, WORLD.right - 64);
    const y = clamp(state.player.y + randRange(-1, 1) * maxDistance, WORLD.top + 64, WORLD.bottom - 64);
    const farEnoughFromPickups = state.pickups.every(
      (pickup) => pickup.dead || Math.hypot(x - pickup.x, y - pickup.y) >= minimumPickupSpacing * 0.75
    );
    if (farEnoughFromPickups && isWalkablePoint(x, y, 20)) {
      return { x, y };
    }
  }

  return findNearbyWalkablePoint(
    clamp(state.player.x - normalizedX * 340, WORLD.left + 64, WORLD.right - 64),
    clamp(state.player.y - normalizedY * 340, WORLD.top + 64, WORLD.bottom - 64),
    20,
    260
  );
}

function collectHealPickup(pickup) {
  pickup.dead = true;
  state.player.hp = Math.min(state.player.maxHp, state.player.hp + pickup.healAmount * state.player.healingMultiplier);
  spawnHealPickupEffect(pickup.x, pickup.y);
  updateHud(false);
}

function collectXpPickup(pickup) {
  pickup.dead = true;
  spawnXpPickupEffect(pickup.x, pickup.y, pickup.type === "xp-cache" ? 1.22 : 0.86);
  grantExperience(pickup.xpAmount);
  updateHud(false);
}

function findNearestEnemy(originX, originY, maxRange = Number.POSITIVE_INFINITY, predicate = null) {
  let nearest = null;
  let nearestDistanceSq = maxRange * maxRange;

  for (const enemy of state.enemies) {
    if (enemy.dead || (predicate && !predicate(enemy))) {
      continue;
    }

    const dx = enemy.x - originX;
    const dy = enemy.y - originY;
    const distanceSq = dx * dx + dy * dy;

    if (distanceSq < nearestDistanceSq) {
      nearestDistanceSq = distanceSq;
      nearest = enemy;
    }
  }

  return nearest;
}

function findDensestEnemyCluster(originX, originY, radius = 220, maxRange = 820) {
  let best = null;
  let bestScore = -1;
  const radiusSq = radius * radius;
  const maxRangeSq = maxRange * maxRange;

  for (const anchor of state.enemies) {
    if (anchor.dead) {
      continue;
    }
    const originDx = anchor.x - originX;
    const originDy = anchor.y - originY;
    if (originDx * originDx + originDy * originDy > maxRangeSq) {
      continue;
    }

    let score = 0;
    let centerX = 0;
    let centerY = 0;
    for (const enemy of state.enemies) {
      if (enemy.dead) {
        continue;
      }
      const dx = enemy.x - anchor.x;
      const dy = enemy.y - anchor.y;
      const distanceSq = dx * dx + dy * dy;
      if (distanceSq > radiusSq) {
        continue;
      }
      const weight = 1 + Math.max(0, 1 - Math.sqrt(distanceSq) / radius) * 1.4 + enemy.radius * 0.03;
      score += weight;
      centerX += enemy.x * weight;
      centerY += enemy.y * weight;
    }

    if (score > bestScore && score > 0) {
      bestScore = score;
      best = {
        x: centerX / score,
        y: centerY / score,
        score,
      };
    }
  }

  return best;
}

function updateAutoSkills(dt) {
  if (state.dev.manualSkillMode) {
    for (const skillState of getUnlockedSkillStates()) {
      if (hasUnlimitedSkillCooldowns()) {
        skillState.timer = 0;
        continue;
      }
      skillState.timer = Math.max(0, skillState.timer - dt);
    }
    return;
  }

  const unlockedSkills = getUnlockedSkillStates();
  if (unlockedSkills.length === 0) {
    return;
  }

  for (const skillState of unlockedSkills) {
    const cooldown = getSkillCooldown(skillState);
    skillState.timer -= dt;
    if (skillState.timer > 0) {
      continue;
    }
    const didCast = castPlayerSkill(skillState);
    skillState.timer = didCast ? cooldown : Math.min(1.2, cooldown * 0.32);
  }
}

function getSkillCooldown(skillState) {
  if (hasUnlimitedSkillCooldowns()) {
    return 0;
  }
  return Math.max(1.8, skillState.cooldown / (1 + state.player.skillCooldownRecovery));
}

function castPlayerSkill(skillState) {
  if (state.enemies.length === 0) {
    return false;
  }
  const skillDef = getClassDef().skills.find((skill) => skill.id === skillState.id);
  if (!skillDef) {
    return false;
  }
  let didCast = false;
  switch (skillDef.id) {
    case "gale-ring":
      spawnPlayerAura("gale-ring", {
        radius: 118,
        life: 1.05,
        damage: 52,
        interval: 0.22,
        color: "rgba(176, 229, 237, {a})",
        secondaryColor: "rgba(116, 187, 214, {a})",
        tertiaryColor: "rgba(181, 233, 205, {a})",
        lightColor: "rgba(232, 255, 248, {a})",
        tailLife: 0.22,
      });
      didCast = true;
      break;
    case "crosswind-strip":
      didCast = castCrosswindStrip();
      break;
    case "tempest-node":
      didCast = castTempestNode(skillState.mastery);
      break;
    case "blizzard-wake":
      spawnPlayerAura("blizzard-wake", {
        radius: 126,
        life: 1.2,
        damage: 24,
        interval: 0.18,
        color: "rgba(176, 228, 255, {a})",
        secondaryColor: "rgba(84, 156, 239, {a})",
        tertiaryColor: "rgba(170, 189, 255, {a})",
        lightColor: "rgba(240, 248, 255, {a})",
        tailLife: 0.24,
      });
      didCast = true;
      break;
    case "permafrost-seal":
      didCast = castPermafrostSeal(skillState.mastery);
      break;
    case "crystal-spear":
      didCast = castCrystalSpear(skillState.mastery);
      break;
    case "cinder-halo":
      spawnPlayerAura("cinder-halo", {
        radius: 122,
        life: 1.05,
        damage: 34,
        interval: 0.18,
        color: "rgba(255, 197, 84, {a})",
        secondaryColor: "rgba(232, 86, 34, {a})",
        tertiaryColor: "rgba(255, 110, 38, {a})",
        lightColor: "rgba(255, 236, 170, {a})",
        tailLife: 0.24,
      });
      didCast = true;
      break;
    case "sunspot":
      didCast = castSunspot(skillState.mastery);
      break;
    case "ash-comet":
      didCast = castAshComet(skillState.mastery);
      break;
    case "bone-ward":
      didCast = castBoneWard(skillState.mastery);
      break;
    case "requiem-field":
      didCast = castRequiemField(skillState.mastery);
      break;
    case "grave-call":
      didCast = castGraveCall(skillState.mastery);
      break;
    case "vein-burst":
      didCast = castVeinBurst(skillState.mastery);
      break;
    case "crimson-pool":
      didCast = castCrimsonPool(skillState.mastery);
      break;
    case "blood-rite":
      didCast = castBloodRite(skillState.mastery);
      break;
    default:
      didCast = false;
  }
  if (didCast) {
    spawnSkillCastAccent(skillDef.id, state.player.x, state.player.y);
    skillState.castFlashTimer = Math.max(skillState.castFlashTimer, 0.45);
  }
  return didCast;
}

function spawnPlayerAura(kind, spec) {
  const mastery = getSkillState(spec.slot ?? 1)?.mastery ?? 0;
  pushEffect({
    kind,
    renderLayer: "top",
    followPlayer: true,
    x: state.player.x,
    y: state.player.y,
    life: spec.life * (1 + state.player.skillDurationMultiplier),
    maxLife: spec.life * (1 + state.player.skillDurationMultiplier),
    radius: spec.radius * (1 + state.player.skillAreaMultiplier + mastery * 0.08),
    damage: spec.damage * state.player.skillDamageMultiplier * state.player.zoneDamageMultiplier,
    interval: spec.interval,
    tickTimer: 0.02,
    color: spec.color,
    secondaryColor: spec.secondaryColor ?? spec.color,
    tertiaryColor: spec.tertiaryColor ?? null,
    lightColor: spec.lightColor ?? null,
    darkColor: spec.darkColor ?? null,
    tailLife: spec.tailLife ?? 0.22,
    tailAlphaStart: spec.tailAlphaStart ?? 0.14,
  });
  return true;
}

function castCrosswindStrip() {
  const movement = getMovementAxis();
  const target = movement.x || movement.y ? { x: state.player.x + movement.x, y: state.player.y + movement.y } : findNearestEnemy(state.player.x, state.player.y, 720);
  if (!target) {
    return false;
  }
  const angle = Math.atan2(target.y - state.player.y, target.x - state.player.x);
  pushEffect({
    kind: "crosswind-strip",
    renderLayer: "top",
    x: state.player.x + Math.cos(angle) * 120,
    y: state.player.y + Math.sin(angle) * 120,
    originX: state.player.x + Math.cos(angle) * 30,
    originY: state.player.y + Math.sin(angle) * 30,
    angle,
    life: 1.25 * (1 + state.player.skillDurationMultiplier),
    maxLife: 1.25 * (1 + state.player.skillDurationMultiplier),
    length: 340 * (1 + state.player.skillAreaMultiplier),
    width: 76 * (1 + state.player.skillAreaMultiplier),
    damage: 26 * state.player.skillDamageMultiplier,
    interval: 0.18,
    tickTimer: 0.01,
    color: "rgba(236, 248, 255, {a})",
    secondaryColor: "rgba(112, 184, 212, {a})",
    tertiaryColor: "rgba(176, 232, 205, {a})",
    lightColor: "rgba(236, 255, 249, {a})",
    deployRatio: 0.28,
    tailLife: 0.22,
  });
  return true;
}

function castTempestNode(mastery) {
  const cluster = findDensestEnemyCluster(state.player.x, state.player.y, 240, 860);
  if (!cluster) {
    return false;
  }
  pushEffect({
    kind: "tempest-node",
    renderLayer: "top",
    x: cluster.x,
    y: cluster.y,
    life: 3.1 * (1 + state.player.skillDurationMultiplier) + mastery * 0.35,
    maxLife: 3.1 * (1 + state.player.skillDurationMultiplier) + mastery * 0.35,
    radius: 136 * (1 + state.player.skillAreaMultiplier + mastery * 0.08),
    damage: 20 * state.player.skillDamageMultiplier,
    interval: 0.16,
    tickTimer: 0.01,
    color: "rgba(169, 230, 236, {a})",
    secondaryColor: "rgba(94, 176, 201, {a})",
    tertiaryColor: "rgba(133, 223, 194, {a})",
    lightColor: "rgba(225, 255, 248, {a})",
    tailLife: 0.34,
  });
  return true;
}

function castPermafrostSeal(mastery) {
  const cluster = findDensestEnemyCluster(state.player.x, state.player.y, 220, 860);
  if (!cluster) {
    return false;
  }
  pushEffect({
    kind: "permafrost-seal",
    renderLayer: "top",
    x: cluster.x,
    y: cluster.y,
    life: 2.9 * (1 + state.player.skillDurationMultiplier),
    maxLife: 2.9 * (1 + state.player.skillDurationMultiplier),
    armTime: 0.65,
    radius: 132 * (1 + state.player.skillAreaMultiplier + mastery * 0.08),
    damage: 42 * state.player.skillDamageMultiplier,
    burstDone: false,
    color: "rgba(186, 235, 255, {a})",
    secondaryColor: "rgba(76, 156, 236, {a})",
    tertiaryColor: "rgba(169, 185, 255, {a})",
    lightColor: "rgba(239, 247, 255, {a})",
    tailLife: 0.28,
  });
  return true;
}

function castCrystalSpear(mastery) {
  const target = findNearestEnemy(state.player.x, state.player.y, 980);
  if (!target) {
    return false;
  }
  const dx = target.x - state.player.x;
  const dy = target.y - state.player.y;
  const length = Math.hypot(dx, dy) || 1;
  state.projectiles.push({
    id: state.nextEntityId++,
    owner: "skill",
    skillType: "crystal-spear",
    x: state.player.x,
    y: state.player.y,
    vx: (dx / length) * (620 + mastery * 40),
    vy: (dy / length) * (620 + mastery * 40),
    radius: 6.2,
    renderRadius: 48,
    damage: (92 + mastery * 18) * state.player.skillDamageMultiplier,
    life: 1.35,
    pierce: 2 + mastery,
    color: "#dff6ff",
    rgb: "223, 246, 255",
    accentColor: "#6ebcff",
    accentRgb: "110, 188, 255",
    dead: false,
  });
  return true;
}

function castSunspot(mastery) {
  const cluster = findDensestEnemyCluster(state.player.x, state.player.y, 220, 860);
  if (!cluster) {
    return false;
  }
  pushEffect({
    kind: "sunspot",
    renderLayer: "top",
    x: cluster.x,
    y: cluster.y,
    life: 3.4 * (1 + state.player.skillDurationMultiplier) + mastery * 0.3,
    maxLife: 3.4 * (1 + state.player.skillDurationMultiplier) + mastery * 0.3,
    radius: 126 * (1 + state.player.skillAreaMultiplier + mastery * 0.08),
    damage: 28 * state.player.skillDamageMultiplier * state.player.zoneDamageMultiplier,
    interval: 0.18,
    tickTimer: 0.02,
    color: "rgba(255, 201, 92, {a})",
    secondaryColor: "rgba(232, 84, 30, {a})",
    tertiaryColor: "rgba(255, 112, 44, {a})",
    lightColor: "rgba(255, 237, 168, {a})",
    tailLife: 0.28,
  });
  return true;
}

function castAshComet(mastery) {
  const cluster = findDensestEnemyCluster(state.player.x, state.player.y, 240, 860);
  if (!cluster) {
    return false;
  }
  pushEffect({
    kind: "ash-comet",
    renderLayer: "top",
    x: cluster.x,
    y: cluster.y,
    life: 1.1,
    maxLife: 1.1,
    armTime: 0.52,
    radius: 86 * (1 + state.player.skillAreaMultiplier),
    damage: (120 + mastery * 20) * state.player.skillDamageMultiplier,
    burstDone: false,
    color: "rgba(255, 214, 120, {a})",
    secondaryColor: "rgba(226, 72, 18, {a})",
    tertiaryColor: "rgba(255, 117, 36, {a})",
    lightColor: "rgba(255, 241, 185, {a})",
    tailLife: 0.3,
  });
  return true;
}

function castBoneWard(mastery) {
  pushEffect({
    kind: "bone-ward",
    renderLayer: "top",
    followPlayer: true,
    x: state.player.x,
    y: state.player.y,
    life: 4.1 * (1 + state.player.skillDurationMultiplier) + mastery * 0.4,
    maxLife: 4.1 * (1 + state.player.skillDurationMultiplier) + mastery * 0.4,
    orbitCount: 3 + mastery,
    radius: 88 + mastery * 16,
    damage: 30 * state.player.skillDamageMultiplier,
    interval: 0.16,
    tickTimer: 0.02,
    color: "rgba(170, 239, 202, {a})",
    secondaryColor: "rgba(66, 176, 120, {a})",
    tertiaryColor: "rgba(121, 144, 247, {a})",
    lightColor: "rgba(224, 255, 240, {a})",
    tailLife: 0.3,
  });
  return true;
}

function castRequiemField(mastery) {
  const cluster = findDensestEnemyCluster(state.player.x, state.player.y, 220, 860) ?? { x: state.player.x, y: state.player.y };
  pushEffect({
    kind: "requiem-field",
    renderLayer: "top",
    x: cluster.x,
    y: cluster.y,
    life: 3.8 * (1 + state.player.skillDurationMultiplier),
    maxLife: 3.8 * (1 + state.player.skillDurationMultiplier),
    radius: 134 * (1 + state.player.skillAreaMultiplier + mastery * 0.08),
    damage: 20 * state.player.skillDamageMultiplier * state.player.zoneDamageMultiplier,
    interval: 0.18,
    tickTimer: 0.02,
    color: "rgba(160, 232, 198, {a})",
    secondaryColor: "rgba(62, 166, 117, {a})",
    tertiaryColor: "rgba(114, 138, 235, {a})",
    lightColor: "rgba(220, 255, 238, {a})",
    tailLife: 0.28,
  });
  return true;
}

function castGraveCall(mastery) {
  pushEffect({
    kind: "grave-call",
    x: state.player.x,
    y: state.player.y,
    life: 1.15,
    maxLife: 1.15,
    radius: 122 + mastery * 12,
    color: "rgba(178, 244, 212, {a})",
    secondaryColor: "rgba(58, 158, 118, {a})",
    tertiaryColor: "rgba(126, 144, 232, {a})",
    lightColor: "rgba(228, 255, 241, {a})",
    renderLayer: "top",
    tailLife: 0.32,
  });
  const nearbyCorpses = state.corpses
    .filter((corpse) => Math.hypot(corpse.x - state.player.x, corpse.y - state.player.y) < 520)
    .slice(0, 2 + mastery);
  if (nearbyCorpses.length === 0) {
    state.allies.push({
      id: state.nextEntityId++,
      kind: "thrall",
      sourceType: "phantom",
      emoji: "\ud83d\udc80",
      x: state.player.x + randRange(-34, 34),
      y: state.player.y + randRange(-34, 34),
      radius: 14,
      speed: 150,
      damage: 12 + mastery * 2,
      life: 12 + mastery * 2,
      maxLife: 12 + mastery * 2,
      hitCooldown: 0,
      orbitSeed: Math.random() * Math.PI * 2,
      dead: false,
    });
    return true;
  }
  for (const corpse of nearbyCorpses) {
    corpse.life = 0;
    state.allies.push({
      id: state.nextEntityId++,
      kind: "thrall",
      sourceType: corpse.type,
      emoji: ENEMY_ARCHETYPES[corpse.type]?.emoji ?? "\ud83d\udc80",
      x: corpse.x,
      y: corpse.y,
      radius: Math.max(12, corpse.radius * 0.72),
      speed: 158 + mastery * 10,
      damage: 12 + mastery * 2,
      life: 15 + mastery * 2.5,
      maxLife: 15 + mastery * 2.5,
      hitCooldown: 0,
      orbitSeed: Math.random() * Math.PI * 2,
      dead: false,
    });
  }
  return true;
}

function castVeinBurst(mastery) {
  pushEffect({
    kind: "vein-burst",
    renderLayer: "top",
    followPlayer: true,
    x: state.player.x,
    y: state.player.y,
    life: 0.68,
    maxLife: 0.68,
    radius: 112 * (1 + state.player.skillAreaMultiplier + mastery * 0.08),
    damage: (84 + mastery * 14) * state.player.skillDamageMultiplier,
    interval: 0.12,
    tickTimer: 0.01,
    color: "rgba(232, 126, 154, {a})",
    secondaryColor: "rgba(124, 20, 49, {a})",
    tertiaryColor: "rgba(255, 82, 183, {a})",
    lightColor: "rgba(255, 205, 220, {a})",
    tailLife: 0.22,
  });
  return true;
}

function castCrimsonPool(mastery) {
  const cluster = findDensestEnemyCluster(state.player.x, state.player.y, 220, 860);
  if (!cluster) {
    return false;
  }
  pushEffect({
    kind: "crimson-pool",
    renderLayer: "top",
    x: cluster.x,
    y: cluster.y,
    life: 3.6 * (1 + state.player.skillDurationMultiplier),
    maxLife: 3.6 * (1 + state.player.skillDurationMultiplier),
    radius: 122 * (1 + state.player.skillAreaMultiplier + mastery * 0.08),
    damage: 24 * state.player.skillDamageMultiplier * state.player.zoneDamageMultiplier,
    interval: 0.16,
    tickTimer: 0.02,
    color: "rgba(206, 82, 116, {a})",
    secondaryColor: "rgba(98, 16, 39, {a})",
    tertiaryColor: "rgba(220, 56, 154, {a})",
    lightColor: "rgba(255, 186, 205, {a})",
    tailLife: 0.28,
  });
  return true;
}

function castBloodRite(mastery) {
  state.player.afterDashBuffTimer = Math.max(state.player.afterDashBuffTimer, 4.2 + mastery * 0.8);
  state.player.bloodRiteTimer = Math.max(state.player.bloodRiteTimer, 4.2 + mastery * 0.8);
  pushEffect({
    kind: "blood-rite",
    renderLayer: "top",
    followPlayer: true,
    x: state.player.x,
    y: state.player.y,
    life: 1.1,
    maxLife: 1.1,
    radius: 68,
    color: "rgba(226, 96, 126, {a})",
    secondaryColor: "rgba(105, 18, 45, {a})",
    tertiaryColor: "rgba(247, 73, 183, {a})",
    lightColor: "rgba(255, 194, 216, {a})",
    tailLife: 0.24,
  });
  return true;
}

function updateProjectiles(dt) {
  const worldPadding = 240;

  for (const projectile of state.projectiles) {
    if (projectile.dead) {
      continue;
    }

    const previousX = projectile.x;
    const previousY = projectile.y;
    projectile.x += projectile.vx * dt;
    projectile.y += projectile.vy * dt;
    projectile.life -= dt;

    if (
      projectile.life <= 0 ||
      projectile.x < WORLD.left - worldPadding ||
      projectile.x > WORLD.right + worldPadding ||
      projectile.y < WORLD.top - worldPadding ||
      projectile.y > WORLD.bottom + worldPadding
    ) {
      projectile.dead = true;
      continue;
    }

    if (segmentHitsBlockingFeature(previousX, previousY, projectile.x, projectile.y, projectile.radius)) {
      projectile.dead = true;
      spawnSparkBurst(projectile.x, projectile.y, "rgba(255, 222, 149, {a})", 4);
    }
  }
}

function spawnEnemies(dt) {
  if (state.dev.disableSpawns) {
    return;
  }
  const director = state.spawnDirector;
  const pressure = Math.min(1, state.elapsed / 190);
  const bossActive = hasLivingBoss();
  let ambientEnemyCount = state.enemies.reduce(
    (total, enemy) => total + (enemy.isBoss ? 0 : 1),
    0
  );
  let dynamicInterval =
    director.baseInterval - pressure * (director.baseInterval - director.minInterval);
  if (bossActive) {
    dynamicInterval *= SPAWN_DIRECTOR_CONFIG.bossSpawnIntervalMultiplier;
  }

  director.timer -= dt;

  let safety = 0;
  const safetyLimit = bossActive ? 2 : 8;
  while (director.timer <= 0 && safety < safetyLimit) {
    director.timer += dynamicInterval;
    safety += 1;

    if (state.enemies.length >= director.maxEnemiesOnField) {
      director.timer = Math.max(director.timer, 0.06);
      return;
    }

    if (bossActive && ambientEnemyCount >= SPAWN_DIRECTOR_CONFIG.bossAmbientCap) {
      director.timer = Math.max(director.timer, 0.18);
      return;
    }

    const plan = chooseSpawnPlan(pressure);
    if (!plan) {
      return;
    }
    const anchor = pickSpawnPoint();

    const spawnCount = bossActive ? 1 : plan.count;
    for (let i = 0; i < spawnCount; i += 1) {
      if (state.enemies.length >= director.maxEnemiesOnField) {
        return;
      }
      state.enemies.push(createEnemy(plan.type, anchor, i, spawnCount));
      ambientEnemyCount += 1;
    }
  }
}

function chooseSpawnPlan(pressure) {
  const available = [];
  let totalWeight = 0;

  for (const entry of SPAWN_ROSTER) {
    if (entry.unlockTime && state.elapsed < entry.unlockTime) {
      continue;
    }
    if (entry.cap && countLivingEnemiesOfType(entry.type) >= entry.cap) {
      continue;
    }

    const weight = Math.max(0.02, entry.weightBase + pressure * entry.weightPressureDelta);
    available.push({ ...entry, weight });
    totalWeight += weight;
  }

  if (available.length === 0 || totalWeight <= 0) {
    return null;
  }

  let roll = Math.random() * totalWeight;
  for (const entry of available) {
    roll -= entry.weight;
    if (roll <= 0) {
      return { type: entry.type, count: resolveSpawnCount(entry, pressure) };
    }
  }

  const fallback = available[available.length - 1];
  return { type: fallback.type, count: resolveSpawnCount(fallback, pressure) };
}

function resolveSpawnCount(entry, pressure) {
  if (entry.countFixed) {
    return entry.countFixed;
  }

  let total = entry.countBase ?? 1;
  const chances = entry.countChances ?? [];
  const chanceDeltas = entry.countPressureDeltas ?? [];
  for (let index = 0; index < chances.length; index += 1) {
    const chance = chances[index] + pressure * (chanceDeltas[index] ?? 0);
    if (Math.random() < chance) {
      total += 1;
    }
  }

  for (const threshold of entry.countThresholds ?? []) {
    if (Math.random() < threshold.chance) {
      total = Math.max(total, threshold.amount);
    }
  }

  return total;
}

function maybeSpawnBosses() {
  if (hasLivingBoss()) {
    return;
  }

  if (state.elapsed < state.bossDirector.nextTime) {
    return;
  }

  const chosenType = pickRandomBossType(state.elapsed);
  if (!chosenType) {
    state.bossDirector.nextTime = Number.POSITIVE_INFINITY;
    return;
  }

  if (spawnBoss(chosenType)) {
    state.bossDirector.nextTime = Number.POSITIVE_INFINITY;
  }
}

function pickRandomBossType(atTime = state.elapsed) {
  const eligible = getEligibleBossTypes(atTime);

  if (eligible.length === 0) {
    return null;
  }

  let pool = eligible;
  if (eligible.length > 1 && state.lastBossType) {
    const withoutRepeat = eligible.filter((type) => type !== state.lastBossType);
    if (withoutRepeat.length > 0) {
      pool = withoutRepeat;
    }
  }

  let totalWeight = 0;
  const weightedPool = pool.map((type) => {
    const baseWeight = BOSS_RANDOM_WEIGHTS[type] ?? 1;
    const defeatCount = state.bossDefeats[type] ?? 0;
    const unlockTime = BOSS_UNLOCK_TIMES[type] ?? 0;
    const timeSinceUnlock = Math.max(0, atTime - unlockTime);
    const freshnessBias = 1 + Math.min(0.32, timeSinceUnlock / 900);
    const defeatPenalty = 1 / (1 + defeatCount * 0.9);
    const weight = baseWeight * freshnessBias * defeatPenalty;
    totalWeight += weight;
    return { type, weight };
  });

  let roll = Math.random() * totalWeight;
  for (const entry of weightedPool) {
    roll -= entry.weight;
    if (roll <= 0) {
      return entry.type;
    }
  }

  return weightedPool[weightedPool.length - 1]?.type ?? pool[pool.length - 1] ?? null;
}

function scheduleNextBossEncounter(baseTime = state.elapsed) {
  const eligible = getEligibleBossTypes(baseTime);
  if (eligible.length === 0) {
    state.bossDirector.nextTime = Number.POSITIVE_INFINITY;
    return;
  }
  const director = state.bossDirector;
  director.nextTime = baseTime + rollBossEncounterDelay(director.encounterIndex);
}

function spawnBoss(enemyType) {
  if ((state.bossDefeats[enemyType] ?? 0) >= 3) {
    return null;
  }
  const anchor = pickSpawnPoint(Math.max(520, Math.min(viewWidth, viewHeight) * 0.58));
  const boss = createEnemy(enemyType, anchor, 0, 1, { bossEncounterIndex: state.bossDirector.encounterIndex });
  boss.attackCooldown = 1.4;
  state.bossSeen[enemyType] = true;
  state.lastBossType = enemyType;
  state.enemies.push(boss);
  recordTelemetryBossSpawn(boss);
  spawnBossIntroEffect(boss);
  return boss;
}

function countLivingEnemiesOfType(enemyType) {
  let count = 0;
  for (const enemy of state.enemies) {
    if (!enemy.dead && enemy.type === enemyType) {
      count += 1;
    }
  }
  return count;
}

function hasLivingBoss() {
  return state.enemies.some((enemy) => !enemy.dead && enemy.isBoss);
}

function createEnemy(enemyType, anchor, index, totalCount, options = {}) {
  const profile = ENEMY_ARCHETYPES[enemyType];

  let x = anchor.x;
  let y = anchor.y;

  if (totalCount > 1) {
    const angle = (index / totalCount) * Math.PI * 2 + randRange(-0.35, 0.35);
    const spread = randRange(16, 56);
    x += Math.cos(angle) * spread;
    y += Math.sin(angle) * spread;
  }

  const hpRoll = randRange(0.92, 1.08);
  const speedRoll = randRange(0.95, 1.08);
  const hpScale = getEnemyHpScale(profile, {
    atTime: options.atTime ?? state.elapsed,
    bossEncounterIndex: options.bossEncounterIndex ?? 0,
  });
  const maxHp = profile.hp * hpRoll * hpScale;
  const spawnPoint = profile.flying
    ? {
        x: clamp(x, WORLD.left + profile.radius, WORLD.right - profile.radius),
        y: clamp(y, WORLD.top + profile.radius, WORLD.bottom - profile.radius),
      }
    : findNearbyWalkablePoint(
        clamp(x, WORLD.left + profile.radius, WORLD.right - profile.radius),
        clamp(y, WORLD.top + profile.radius, WORLD.bottom - profile.radius),
        profile.radius,
        260
      );

  return {
    id: state.nextEntityId++,
    type: enemyType,
    x: spawnPoint.x,
    y: spawnPoint.y,
    emoji: profile.emoji,
    radius: profile.radius,
    speed: profile.speed * speedRoll,
    maxHp,
    hp: maxHp,
    hpScale,
    touchDamage: profile.touchDamage,
    reward: profile.reward,
    xpReward: profile.xp,
    isBoss: Boolean(profile.isBoss),
    flying: Boolean(profile.flying),
    bossName: profile.name ?? null,
    knockbackVX: 0,
    knockbackVY: 0,
    slowAmount: 0,
    slowTimer: 0,
    statusFlash: {
      wind: 0,
      burn: 0,
      chill: 0,
      freeze: 0,
      necro: 0,
      blood: 0,
    },
    chillStacks: 0,
    chillDecayTimer: 0,
    freezeTimer: 0,
    brittleTimer: 0,
    burnTimer: 0,
    burnDamage: 0,
    burnTickTimer: 0,
    necroMarkTimer: 0,
    bloodMarkTimer: 0,
    hasteTimer: 0,
    hasteAmount: 0,
    pushResist: profile.isBoss ? 0.86 : enemyType === "tank" || enemyType === "brood" ? 0.42 : 0.16,
    controlResist: profile.isBoss ? 0.82 : enemyType === "tank" || enemyType === "brood" || enemyType === "bulwark" ? 0.38 : 0,
    state: "idle",
    stateTimer: 0,
    attackCooldown: randRange(1.2, 2.2),
    memoryX: x,
    memoryY: y,
    patternIndex: -1,
    moveAngle: Math.random() * Math.PI * 2,
    phase: 1,
    phaseTriggered: false,
    pathTargetX: null,
    pathTargetY: null,
    pathTimer: 0,
    pathSide: Math.random() < 0.5 ? -1 : 1,
    dead: false,
  };
}

function pickSpawnPoint(marginOverride) {
  const cameraX = state.player.x;
  const cameraY = state.player.y;
  const halfWidth = viewWidth / 2;
  const halfHeight = viewHeight / 2;
  const margin = marginOverride ?? Math.max(280, Math.min(viewWidth, viewHeight) * 0.45);

  for (let attempt = 0; attempt < 24; attempt += 1) {
    const edge = Math.floor(Math.random() * 4);
    let x = cameraX;
    let y = cameraY;

    if (edge === 0) {
      x = cameraX - halfWidth - margin;
      y = randRange(cameraY - halfHeight - margin, cameraY + halfHeight + margin);
    } else if (edge === 1) {
      x = cameraX + halfWidth + margin;
      y = randRange(cameraY - halfHeight - margin, cameraY + halfHeight + margin);
    } else if (edge === 2) {
      x = randRange(cameraX - halfWidth - margin, cameraX + halfWidth + margin);
      y = cameraY - halfHeight - margin;
    } else {
      x = randRange(cameraX - halfWidth - margin, cameraX + halfWidth + margin);
      y = cameraY + halfHeight + margin;
    }

    x = clamp(x, WORLD.left + 24, WORLD.right - 24);
    y = clamp(y, WORLD.top + 24, WORLD.bottom - 24);

    if (isPointOutsideCamera(x, y, cameraX, cameraY, 48) && isWalkablePoint(x, y, 36)) {
      return { x, y };
    }
  }

  const fallbackX =
    cameraX + (Math.random() < 0.5 ? -1 : 1) * (halfWidth + margin * 0.8);
  const fallbackY =
    cameraY + (Math.random() < 0.5 ? -1 : 1) * (halfHeight + margin * 0.8);

  return findNearbyWalkablePoint(
    clamp(fallbackX, WORLD.left + 24, WORLD.right - 24),
    clamp(fallbackY, WORLD.top + 24, WORLD.bottom - 24),
    36,
    320
  );
}

function updateEnemiesAndSpatialGrid(dt) {
  const player = state.player;
  const knockbackDamping = Math.exp(-8.5 * dt);

  for (const enemy of state.enemies) {
    if (enemy.dead) {
      continue;
    }

    for (const key of Object.keys(enemy.statusFlash)) {
      enemy.statusFlash[key] = Math.max(0, enemy.statusFlash[key] - dt);
    }
    enemy.freezeTimer = Math.max(0, enemy.freezeTimer - dt);
    enemy.brittleTimer = Math.max(0, enemy.brittleTimer - dt);
    enemy.necroMarkTimer = Math.max(0, enemy.necroMarkTimer - dt);
    enemy.bloodMarkTimer = Math.max(0, enemy.bloodMarkTimer - dt);
    enemy.hasteTimer = Math.max(0, enemy.hasteTimer - dt);
    if (enemy.hasteTimer <= 0) {
      enemy.hasteAmount = 0;
    }

    if (enemy.chillDecayTimer > 0) {
      enemy.chillDecayTimer -= dt;
      if (enemy.chillDecayTimer <= 0) {
        enemy.chillStacks = Math.max(0, enemy.chillStacks - 1);
        enemy.chillDecayTimer = enemy.chillStacks > 0 ? 0.6 : 0;
      }
    }

    if (enemy.burnTimer > 0) {
      enemy.burnTimer -= dt;
      enemy.burnTickTimer -= dt;
      if (enemy.burnTickTimer <= 0) {
        enemy.burnTickTimer += 0.34;
        const burnDamage = enemy.burnDamage * (enemy.isBoss ? 0.4 : 1);
        dealDamageToEnemy(enemy, burnDamage * dt * 3, "burn");
      }
      if (enemy.burnTimer <= 0) {
        enemy.burnTimer = 0;
        enemy.burnDamage = 0;
      }
    }

    if (enemy.slowTimer > 0) {
      enemy.slowTimer -= dt;
      if (enemy.slowTimer <= 0) {
        enemy.slowTimer = 0;
        enemy.slowAmount = 0;
      }
    }

    const hasteMultiplier = 1 + enemy.hasteAmount;
    const timeFactor = enemy.freezeTimer > 0 && !enemy.isBoss ? 0 : 1;
    enemy.attackCooldown -= dt * timeFactor * hasteMultiplier;
    enemy.stateTimer = Math.max(0, enemy.stateTimer - dt * Math.max(0.15, timeFactor));

    const freezeMultiplier = enemy.freezeTimer > 0 ? (enemy.isBoss ? 0.28 : 0) : 1;
    const moveMultiplier = (1 - clamp(enemy.slowAmount, 0, 0.75)) * freezeMultiplier * hasteMultiplier;
    if (moveMultiplier > 0) {
      updateEnemyBehavior(enemy, dt, moveMultiplier, player);
    }

    moveCircleEntity(enemy, enemy.knockbackVX * dt, enemy.knockbackVY * dt, enemy.radius, getEntityCollisionOptions(enemy));

    enemy.knockbackVX *= knockbackDamping;
    enemy.knockbackVY *= knockbackDamping;

    if (Math.abs(enemy.knockbackVX) < 0.4) {
      enemy.knockbackVX = 0;
    }
    if (Math.abs(enemy.knockbackVY) < 0.4) {
      enemy.knockbackVY = 0;
    }

    enemy.x = clamp(enemy.x, WORLD.left + enemy.radius, WORLD.right - enemy.radius);
    enemy.y = clamp(enemy.y, WORLD.top + enemy.radius, WORLD.bottom - enemy.radius);
  }

  state.enemyGrid = buildEnemyGrid(state.enemies);

  const manyEnemies = state.enemies.length >= 110;
  const separationIntensity = manyEnemies && state.tick % 2 === 1 ? 0.6 : 1;
  applyEnemySeparation(state.enemyGrid, separationIntensity);
}

function getEntityCollisionOptions(entity) {
  if (entity?.flying) {
    return { water: false, solids: false };
  }
  return { water: true, solids: true };
}

function updateEnemyBehavior(enemy, dt, moveMultiplier, player) {
  switch (enemy.type) {
    case "hexer":
      updateHexerEnemy(enemy, dt, moveMultiplier, player);
      return;
    case "fang":
      updateFangEnemy(enemy, dt, moveMultiplier, player);
      return;
    case "wraith":
      updateWraithEnemy(enemy, dt, moveMultiplier, player);
      return;
    case "oracle":
      updateOracleEnemy(enemy, dt, moveMultiplier, player);
      return;
    case "brood":
      updateBroodEnemy(enemy, dt, moveMultiplier, player);
      return;
    case "banner":
      updateBannerEnemy(enemy, dt, moveMultiplier, player);
      return;
    case "mortar":
      updateMortarEnemy(enemy, dt, moveMultiplier, player);
      return;
    case "bulwark":
      updateBulwarkEnemy(enemy, dt, moveMultiplier, player);
      return;
    case "countess":
      updateCountessBoss(enemy, dt, moveMultiplier, player);
      return;
    case "colossus":
      updateColossusBoss(enemy, dt, moveMultiplier, player);
      return;
    case "abyss":
      updateAbyssBoss(enemy, dt, moveMultiplier, player);
      return;
    case "matriarch":
      updateMatriarchBoss(enemy, dt, moveMultiplier, player);
      return;
    case "harbinger":
      updateHarbingerBoss(enemy, dt, moveMultiplier, player);
      return;
    case "regent":
      updateRegentBoss(enemy, dt, moveMultiplier, player);
      return;
    default:
      moveEnemyToward(enemy, player.x, player.y, enemy.speed * moveMultiplier, dt);
  }
}

function moveEnemyToward(enemy, targetX, targetY, speed, dt) {
  navigateEnemy(enemy, targetX, targetY, speed, dt);
}

function moveEnemyVector(enemy, dirX, dirY, speed, dt) {
  const length = Math.hypot(dirX, dirY);
  if (length <= 0.0001) {
    return;
  }

  navigateEnemy(enemy, enemy.x + (dirX / length) * 180, enemy.y + (dirY / length) * 180, speed, dt);
}

function navigateEnemy(enemy, targetX, targetY, speed, dt) {
  const options = getEntityCollisionOptions(enemy);
  if (enemy.flying) {
    const dx = targetX - enemy.x;
    const dy = targetY - enemy.y;
    const length = Math.hypot(dx, dy);
    if (length <= 0.0001) {
      return;
    }
    moveCircleEntity(enemy, (dx / length) * speed * dt, (dy / length) * speed * dt, enemy.radius, options);
    return;
  }

  enemy.pathTimer = Math.max(0, enemy.pathTimer - dt);
  let destinationX = targetX;
  let destinationY = targetY;
  if (enemy.pathTimer > 0 && enemy.pathTargetX !== null && enemy.pathTargetY !== null) {
    const detourDistance = Math.hypot(enemy.pathTargetX - enemy.x, enemy.pathTargetY - enemy.y);
    if (detourDistance > enemy.radius + 14) {
      destinationX = enemy.pathTargetX;
      destinationY = enemy.pathTargetY;
    } else {
      enemy.pathTimer = 0;
      enemy.pathTargetX = null;
      enemy.pathTargetY = null;
    }
  }

  const dx = destinationX - enemy.x;
  const dy = destinationY - enemy.y;
  const length = Math.hypot(dx, dy);
  if (length <= 0.0001) {
    return;
  }

  const beforeX = enemy.x;
  const beforeY = enemy.y;
  const stepX = (dx / length) * speed * dt;
  const stepY = (dy / length) * speed * dt;
  moveCircleEntity(enemy, stepX, stepY, enemy.radius, options);
  const movedRatio = Math.hypot(enemy.x - beforeX, enemy.y - beforeY) / Math.max(1, Math.hypot(stepX, stepY));

  if (movedRatio >= 0.42) {
    return;
  }

  const detour = findEnemyDetourWaypoint(enemy, targetX, targetY);
  if (!detour) {
    return;
  }
  enemy.pathTargetX = detour.x;
  enemy.pathTargetY = detour.y;
  enemy.pathTimer = detour.duration;
  enemy.pathSide = detour.side;
}

function findEnemyDetourWaypoint(enemy, targetX, targetY) {
  let best = null;
  const dx = targetX - enemy.x;
  const dy = targetY - enemy.y;
  const length = Math.hypot(dx, dy) || 1;
  const dirX = dx / length;
  const dirY = dy / length;
  const lookDistance = Math.min(260, length);

  iterateWorldFeaturesInBounds(
    enemy.x - 240,
    enemy.y - 240,
    enemy.x + 240,
    enemy.y + 240,
    (feature) => {
      if (!feature.blocksMovement) {
        return;
      }
      const proximity = distancePointToSegment(feature.anchorX, feature.anchorY, enemy.x, enemy.y, enemy.x + dirX * lookDistance, enemy.y + dirY * lookDistance);
      if (proximity > feature.footprintRadius + enemy.radius + 28) {
        return;
      }

      for (const side of [enemy.pathSide, -enemy.pathSide]) {
        const tangentX = -dirY * side;
        const tangentY = dirX * side;
        const clearance = feature.footprintRadius + enemy.radius + 42;
        const candidateX = clamp(feature.anchorX + tangentX * clearance + dirX * 18, WORLD.left + enemy.radius, WORLD.right - enemy.radius);
        const candidateY = clamp(feature.anchorY + tangentY * clearance + dirY * 18, WORLD.top + enemy.radius, WORLD.bottom - enemy.radius);
        if (!isWalkablePoint(candidateX, candidateY, enemy.radius)) {
          continue;
        }
        const score = Math.hypot(candidateX - enemy.x, candidateY - enemy.y) * 0.7 + Math.hypot(targetX - candidateX, targetY - candidateY);
        if (!best || score < best.score) {
          best = { x: candidateX, y: candidateY, duration: 1.05, score, side };
        }
      }
    }
  );

  return best;
}

function updateHexerEnemy(enemy, dt, moveMultiplier, player) {
  const dx = player.x - enemy.x;
  const dy = player.y - enemy.y;
  const distance = Math.hypot(dx, dy) || 1;

  if (enemy.state === "cast") {
    holdEnemyBand(enemy, player, 360, 480, enemy.speed * 0.45 * moveMultiplier, dt);
    if (enemy.stateTimer <= 0) {
      spawnEnemyBolt(enemy, player.x, player.y, {
        speed: 250,
        radius: 8,
        life: 3.1,
        damage: 11,
        color: "rgba(173, 116, 255, {a})",
      });
      enemy.state = "idle";
      enemy.attackCooldown = randRange(2.5, 3.4);
    }
    return;
  }

  holdEnemyBand(enemy, player, 340, 500, enemy.speed * moveMultiplier, dt);

  if (distance < 760 && enemy.attackCooldown <= 0) {
    enemy.state = "cast";
    enemy.stateTimer = 0.62;
    spawnChannelEffect(enemy.x, enemy.y, "rgba(173, 116, 255, {a})", 24, 0.62);
  }
}

function updateFangEnemy(enemy, dt, moveMultiplier, player) {
  if (enemy.state === "windup") {
    if (enemy.stateTimer <= 0) {
      const dirX = enemy.memoryX - enemy.x;
      const dirY = enemy.memoryY - enemy.y;
      const length = Math.hypot(dirX, dirY) || 1;
      enemy.memoryX = (dirX / length) * 390;
      enemy.memoryY = (dirY / length) * 390;
      enemy.state = "charge";
      enemy.stateTimer = 0.42;
    }
    return;
  }

  if (enemy.state === "charge") {
    moveEnemyVector(enemy, enemy.memoryX, enemy.memoryY, enemy.speed * 4.4 * moveMultiplier, dt);
    if (enemy.stateTimer <= 0) {
      enemy.state = "recover";
      enemy.stateTimer = 0.4;
      enemy.attackCooldown = randRange(2.2, 3);
    }
    return;
  }

  if (enemy.state === "recover") {
    if (enemy.stateTimer <= 0) {
      enemy.state = "idle";
    }
    return;
  }

  const dx = player.x - enemy.x;
  const dy = player.y - enemy.y;
  const distance = Math.hypot(dx, dy) || 1;
  moveEnemyToward(enemy, player.x, player.y, enemy.speed * moveMultiplier, dt);

  if (distance < 560 && enemy.attackCooldown <= 0) {
    enemy.state = "windup";
    enemy.stateTimer = 0.55;
    enemy.memoryX = player.x;
    enemy.memoryY = player.y;
    spawnLineEffect(enemy.x, enemy.y, player.x, player.y, 0.55, "rgba(255, 176, 110, {a})", 7);
  }
}

function updateWraithEnemy(enemy, dt, moveMultiplier, player) {
  const dx = player.x - enemy.x;
  const dy = player.y - enemy.y;
  const distance = Math.hypot(dx, dy) || 1;

  if (enemy.state === "pulse") {
    if (enemy.stateTimer <= 0) {
      spawnEnemyBurst(enemy.x, enemy.y, {
        radius: 92,
        telegraphTime: 0.78,
        damage: 16,
        color: "rgba(128, 218, 255, {a})",
      });
      enemy.state = "idle";
      enemy.attackCooldown = randRange(3.2, 4.2);
    }
    return;
  }

  const orbitX = -dy / distance;
  const orbitY = dx / distance;
  enemy.moveAngle += dt * 1.3;

  const inwardBias = distance > 330 ? 0.8 : distance < 240 ? -0.7 : 0;
  const moveX = orbitX + (dx / distance) * inwardBias;
  const moveY = orbitY + (dy / distance) * inwardBias;
  moveEnemyVector(enemy, moveX, moveY, enemy.speed * moveMultiplier, dt);

  if (distance < 420 && enemy.attackCooldown <= 0) {
    enemy.state = "pulse";
    enemy.stateTimer = 0.45;
    spawnChannelEffect(enemy.x, enemy.y, "rgba(128, 218, 255, {a})", 28, 0.45);
  }
}

function updateOracleEnemy(enemy, dt, moveMultiplier, player) {
  const dx = player.x - enemy.x;
  const dy = player.y - enemy.y;
  const distance = Math.hypot(dx, dy) || 1;

  if (enemy.state === "cast") {
    holdEnemyBand(enemy, player, 430, 620, enemy.speed * 0.35 * moveMultiplier, dt);
    if (enemy.stateTimer <= 0) {
      const predictedX = player.x + dx / distance * 48;
      const predictedY = player.y + dy / distance * 48;
      spawnEnemyBurst(predictedX, predictedY, {
        radius: 70,
        telegraphTime: 0.72,
        damage: 18,
        color: "rgba(129, 193, 255, {a})",
      });
      enemy.state = "idle";
      enemy.attackCooldown = randRange(3.1, 3.8);
    }
    return;
  }

  holdEnemyBand(enemy, player, 430, 620, enemy.speed * moveMultiplier, dt);

  if (distance < 860 && enemy.attackCooldown <= 0) {
    enemy.state = "cast";
    enemy.stateTimer = 0.58;
    spawnChannelEffect(enemy.x, enemy.y, "rgba(129, 193, 255, {a})", 26, 0.58);
  }
}

function updateBroodEnemy(enemy, dt, moveMultiplier, player) {
  const dx = player.x - enemy.x;
  const dy = player.y - enemy.y;
  const distance = Math.hypot(dx, dy) || 1;

  if (enemy.state === "pulse") {
    if (enemy.stateTimer <= 0) {
      spawnEnemyBurst(enemy.x, enemy.y, {
        radius: 88,
        telegraphTime: 0.52,
        damage: 16,
        color: "rgba(189, 152, 255, {a})",
      });
      enemy.state = "idle";
      enemy.attackCooldown = randRange(2.9, 3.8);
    }
    return;
  }

  moveEnemyToward(enemy, player.x, player.y, enemy.speed * moveMultiplier, dt);
  if (distance < 280 && enemy.attackCooldown <= 0) {
    enemy.state = "pulse";
    enemy.stateTimer = 0.46;
    spawnChannelEffect(enemy.x, enemy.y, "rgba(189, 152, 255, {a})", 24, 0.46);
  }
}

function updateBannerEnemy(enemy, dt, moveMultiplier, player) {
  const dx = player.x - enemy.x;
  const dy = player.y - enemy.y;
  const distance = Math.hypot(dx, dy) || 1;

  if (enemy.state === "chant") {
    holdEnemyBand(enemy, player, 320, 520, enemy.speed * 0.38 * moveMultiplier, dt);
    if (enemy.stateTimer <= 0) {
      empowerNearbyEnemies(enemy, 250, 0.32, 3.8);
      enemy.state = "idle";
      enemy.attackCooldown = randRange(4.1, 5);
    }
    return;
  }

  holdEnemyBand(enemy, player, 320, 520, enemy.speed * moveMultiplier, dt);
  if (distance < 760 && enemy.attackCooldown <= 0) {
    enemy.state = "chant";
    enemy.stateTimer = 0.78;
    spawnChannelEffect(enemy.x, enemy.y, HOSTILE_ARCANE_COLOR, 26, 0.78);
  }
}

function updateMortarEnemy(enemy, dt, moveMultiplier, player) {
  const dx = player.x - enemy.x;
  const dy = player.y - enemy.y;
  const distance = Math.hypot(dx, dy) || 1;

  if (enemy.state === "salvo") {
    holdEnemyBand(enemy, player, 520, 760, enemy.speed * 0.28 * moveMultiplier, dt);
    if (enemy.stateTimer <= 0) {
      const spread = enemy.phase === 2 ? 4 : 3;
      for (let i = 0; i < spread; i += 1) {
        const angle = Math.atan2(dy, dx) + (i - (spread - 1) / 2) * 0.38;
        const distanceBias = 30 + i * 28;
        spawnEnemyBurst(player.x + Math.cos(angle) * distanceBias, player.y + Math.sin(angle) * distanceBias, {
          radius: 74 + i * 7,
          telegraphTime: 0.72 + i * 0.06,
          damage: 18 + i * 2,
        });
      }
      enemy.state = "idle";
      enemy.attackCooldown = randRange(3.4, 4.2);
    }
    return;
  }

  holdEnemyBand(enemy, player, 520, 760, enemy.speed * moveMultiplier, dt);
  if (distance < 960 && enemy.attackCooldown <= 0) {
    enemy.state = "salvo";
    enemy.stateTimer = 0.66;
    spawnChannelEffect(enemy.x, enemy.y, HOSTILE_ARCANE_COLOR, 24, 0.66);
  }
}

function updateBulwarkEnemy(enemy, dt, moveMultiplier, player) {
  const dx = player.x - enemy.x;
  const dy = player.y - enemy.y;
  const distance = Math.hypot(dx, dy) || 1;

  if (enemy.state === "slam") {
    moveEnemyToward(enemy, player.x, player.y, enemy.speed * 0.22 * moveMultiplier, dt);
    if (enemy.stateTimer <= 0) {
      spawnShockwave(enemy.x, enemy.y, {
        telegraphTime: 0.5,
        radius: 280,
        speed: 470,
        thickness: 18,
        damage: 23,
      });
      enemy.state = "recover";
      enemy.stateTimer = 0.36;
      enemy.attackCooldown = randRange(3.2, 4);
    }
    return;
  }

  if (enemy.state === "recover") {
    moveEnemyToward(enemy, player.x, player.y, enemy.speed * 0.32 * moveMultiplier, dt);
    if (enemy.stateTimer <= 0) {
      enemy.state = "idle";
    }
    return;
  }

  moveEnemyToward(enemy, player.x, player.y, enemy.speed * moveMultiplier, dt);
  if (distance < 320 && enemy.attackCooldown <= 0) {
    enemy.state = "slam";
    enemy.stateTimer = 0.62;
    spawnChannelEffect(enemy.x, enemy.y, HOSTILE_ARCANE_COLOR, 30, 0.62);
  }
}

function updateCountessBoss(enemy, dt, moveMultiplier, player) {
  if (!enemy.phaseTriggered && enemy.hp <= enemy.maxHp * 0.58) {
    enemy.phaseTriggered = true;
    enemy.phase = 2;
    enemy.state = "phase-shift";
    enemy.stateTimer = 0.62;
    enemy.attackCooldown = Math.max(enemy.attackCooldown, 1.05);
    enemy.secondaryTriggered = false;
    enemy.knockbackVX = 0;
    enemy.knockbackVY = 0;
    enemy.pathTargetX = null;
    enemy.pathTargetY = null;
    enemy.pathTimer = 0;
    spawnBossPhaseEffect(enemy.x, enemy.y, "rgba(255, 109, 142, {a})");
  }

  if (enemy.state === "phase-shift") {
    holdEnemyBand(enemy, player, 320, 450, enemy.speed * 0.26 * moveMultiplier, dt);
    if (enemy.stateTimer <= 0) {
      enemy.state = "recover";
      enemy.stateTimer = 0.42;
      enemy.attackCooldown = Math.max(enemy.attackCooldown, 1.1);
    }
    return;
  }

  if (enemy.state === "nova") {
    holdEnemyBand(enemy, player, 320, 460, enemy.speed * 0.34 * moveMultiplier, dt);
    if (enemy.stateTimer <= 0) {
      spawnBossRadial(enemy, enemy.phase === 1 ? 14 : 22, enemy.phase === 1 ? 300 : 348, enemy.phase === 1 ? 16 : 20, "rgba(255, 109, 142, {a})");
      enemy.state = "recover";
      enemy.stateTimer = 0.36;
      enemy.attackCooldown = enemy.phase === 1 ? 2.15 : 1.45;
    }
    return;
  }

  if (enemy.state === "volley") {
    holdEnemyBand(enemy, player, 320, 460, enemy.speed * 0.55 * moveMultiplier, dt);
    if (enemy.stateTimer <= 0) {
      const arcCount = enemy.phase === 1 ? 11 : 15;
      spawnBossFan(enemy, player, arcCount, enemy.phase === 1 ? 0.86 : 1.06, enemy.phase === 1 ? 360 : 390, enemy.phase === 1 ? 18 : 22, "rgba(255, 116, 144, {a})");
      enemy.state = "recover";
      enemy.stateTimer = 0.3;
      enemy.attackCooldown = enemy.phase === 1 ? 1.95 : 1.38;
    }
    return;
  }

  if (enemy.state === "swoop-windup") {
    holdEnemyBand(enemy, player, 320, 450, enemy.speed * 0.3 * moveMultiplier, dt);
    if (enemy.stateTimer <= 0) {
      enemy.state = "swoop";
      enemy.stateTimer = enemy.phase === 1 ? 0.46 : 0.54;
    }
    return;
  }

  if (enemy.state === "swoop") {
    moveEnemyVector(enemy, enemy.memoryX, enemy.memoryY, enemy.speed * (enemy.phase === 1 ? 5.5 : 6.25) * moveMultiplier, dt);
    if (enemy.stateTimer < 0.24 && !enemy.secondaryTriggered) {
      enemy.secondaryTriggered = true;
      spawnBossFan(enemy, player, enemy.phase === 1 ? 6 : 8, enemy.phase === 1 ? 0.52 : 0.64, 300, enemy.phase === 1 ? 14 : 18, "rgba(255, 109, 142, {a})");
    }
    if (enemy.stateTimer <= 0) {
      enemy.state = "recover";
      enemy.stateTimer = 0.38;
      enemy.attackCooldown = enemy.phase === 1 ? 1.9 : 1.28;
    }
    return;
  }

  if (enemy.state === "summon") {
    holdEnemyBand(enemy, player, 320, 470, enemy.speed * 0.42 * moveMultiplier, dt);
    if (enemy.stateTimer <= 0) {
      spawnBossMinions(
        enemy,
        enemy.phase === 1
          ? ["runner", "runner", "runner", "fang", "grunt", "grunt"]
          : ["runner", "runner", "fang", "fang", "hexer", "hexer", "grunt"]
      );
      enemy.state = "recover";
      enemy.stateTimer = 0.34;
      enemy.attackCooldown = enemy.phase === 1 ? 2.3 : 1.62;
    }
    return;
  }

  if (enemy.state === "recover") {
    holdEnemyBand(enemy, player, 320, 450, enemy.speed * 0.55 * moveMultiplier, dt);
    if (enemy.stateTimer <= 0) {
      enemy.state = "idle";
    }
    return;
  }

  holdEnemyBand(enemy, player, 320, 450, enemy.speed * moveMultiplier, dt);
  if (enemy.attackCooldown > 0) {
    return;
  }

  const pattern = enemy.phase === 1 ? ["volley", "swoop", "summon", "nova", "volley"] : ["volley", "swoop", "nova", "volley", "summon", "nova"];
  const nextIndex = (enemy.patternIndex + 1 + pattern.length) % pattern.length;
  const nextPattern = pattern[nextIndex];
  enemy.patternIndex = nextIndex;

  if (nextPattern === "volley") {
    enemy.state = "volley";
    enemy.stateTimer = enemy.phase === 1 ? 0.66 : 0.52;
    spawnChannelEffect(enemy.x, enemy.y, "rgba(255, 109, 142, {a})", 34, enemy.stateTimer);
  } else if (nextPattern === "swoop") {
    enemy.state = "swoop-windup";
    enemy.stateTimer = enemy.phase === 1 ? 0.68 : 0.58;
    const dx = player.x - enemy.x;
    const dy = player.y - enemy.y;
    const length = Math.hypot(dx, dy) || 1;
    enemy.memoryX = dx / length;
    enemy.memoryY = dy / length;
    enemy.secondaryTriggered = false;
    spawnLineEffect(enemy.x, enemy.y, player.x, player.y, enemy.stateTimer, "rgba(255, 109, 142, {a})", 11);
  } else if (nextPattern === "nova") {
    enemy.state = "nova";
    enemy.stateTimer = enemy.phase === 1 ? 0.72 : 0.6;
    spawnChannelEffect(enemy.x, enemy.y, "rgba(255, 109, 142, {a})", 44, enemy.stateTimer);
  } else {
    enemy.state = "summon";
    enemy.stateTimer = enemy.phase === 1 ? 0.78 : 0.64;
    spawnChannelEffect(enemy.x, enemy.y, "rgba(255, 109, 142, {a})", 40, enemy.stateTimer);
  }
}

function updateColossusBoss(enemy, dt, moveMultiplier, player) {
  if (!enemy.phaseTriggered && enemy.hp <= enemy.maxHp * 0.56) {
    enemy.phaseTriggered = true;
    enemy.phase = 2;
    spawnBossPhaseEffect(enemy.x, enemy.y, "rgba(242, 183, 109, {a})");
  }

  if (enemy.state === "quake") {
    moveEnemyToward(enemy, player.x, player.y, enemy.speed * 0.26 * moveMultiplier, dt);
    if (enemy.stateTimer <= 0) {
      const arcs = enemy.phase === 1 ? 3 : 4;
      for (let i = 0; i < arcs; i += 1) {
        spawnShockwave(enemy.x, enemy.y, {
          telegraphTime: 0.84 + i * 0.18,
          radius: enemy.phase === 1 ? 420 + i * 44 : 450 + i * 42,
          speed: enemy.phase === 1 ? 470 : 520,
          thickness: enemy.phase === 1 ? 20 : 22,
          damage: enemy.phase === 1 ? 24 : 31,
          color: "rgba(242, 183, 109, {a})",
        });
      }
      enemy.state = "recover";
      enemy.stateTimer = 0.44;
      enemy.attackCooldown = enemy.phase === 1 ? 2.45 : 1.72;
    }
    return;
  }

  if (enemy.state === "slam") {
    if (enemy.stateTimer <= 0) {
      spawnShockwave(enemy.x, enemy.y, {
        telegraphTime: 0.92,
        radius: enemy.phase === 1 ? 470 : 520,
        speed: enemy.phase === 1 ? 500 : 540,
        thickness: enemy.phase === 1 ? 22 : 24,
        damage: enemy.phase === 1 ? 26 : 34,
        color: "rgba(242, 183, 109, {a})",
      });
      enemy.state = "recover";
      enemy.stateTimer = 0.42;
      enemy.attackCooldown = enemy.phase === 1 ? 2.55 : 1.78;
    }
    return;
  }

  if (enemy.state === "meteor") {
    if (enemy.stateTimer <= 0) {
      const impacts = enemy.phase === 1 ? 7 : 10;
      for (let i = 0; i < impacts; i += 1) {
        const angle = (i / impacts) * Math.PI * 2 + randRange(-0.45, 0.45);
        const distance = randRange(60, enemy.phase === 1 ? 240 : 300);
        spawnMeteorStrike(player.x + Math.cos(angle) * distance, player.y + Math.sin(angle) * distance, {
          telegraphTime: 0.9 + i * 0.08,
          radius: 42 + (i % 3) * 6,
          damage: enemy.phase === 1 ? 22 : 29,
          color: "rgba(255, 140, 94, {a})",
        });
      }
      enemy.state = "recover";
      enemy.stateTimer = 0.42;
      enemy.attackCooldown = enemy.phase === 1 ? 2.55 : 1.84;
    }
    return;
  }

  if (enemy.state === "summon") {
    moveEnemyToward(enemy, player.x, player.y, enemy.speed * 0.35 * moveMultiplier, dt);
    if (enemy.stateTimer <= 0) {
      spawnBossMinions(
        enemy,
        enemy.phase === 1
          ? ["tank", "grunt", "grunt", "brood", "runner"]
          : ["tank", "tank", "hexer", "brood", "wraith", "runner"]
      );
      enemy.state = "recover";
      enemy.stateTimer = 0.44;
      enemy.attackCooldown = enemy.phase === 1 ? 2.7 : 1.95;
    }
    return;
  }

  if (enemy.state === "recover") {
    moveEnemyToward(enemy, player.x, player.y, enemy.speed * 0.45 * moveMultiplier, dt);
    if (enemy.stateTimer <= 0) {
      enemy.state = "idle";
    }
    return;
  }

  moveEnemyToward(enemy, player.x, player.y, enemy.speed * moveMultiplier, dt);
  if (enemy.attackCooldown > 0) {
    return;
  }

  const pattern = enemy.phase === 1 ? ["slam", "meteor", "summon", "quake", "slam"] : ["slam", "quake", "meteor", "slam", "summon", "quake"];
  const nextIndex = (enemy.patternIndex + 1 + pattern.length) % pattern.length;
  const nextPattern = pattern[nextIndex];
  enemy.patternIndex = nextIndex;

  if (nextPattern === "slam") {
    enemy.state = "slam";
    enemy.stateTimer = enemy.phase === 1 ? 0.62 : 0.54;
    spawnChannelEffect(enemy.x, enemy.y, "rgba(242, 183, 109, {a})", 44, enemy.stateTimer);
  } else if (nextPattern === "quake") {
    enemy.state = "quake";
    enemy.stateTimer = enemy.phase === 1 ? 0.76 : 0.62;
    spawnChannelEffect(enemy.x, enemy.y, "rgba(242, 183, 109, {a})", 56, enemy.stateTimer);
  } else if (nextPattern === "meteor") {
    enemy.state = "meteor";
    enemy.stateTimer = enemy.phase === 1 ? 0.72 : 0.6;
    spawnChannelEffect(enemy.x, enemy.y, "rgba(255, 140, 94, {a})", 46, enemy.stateTimer);
  } else {
    enemy.state = "summon";
    enemy.stateTimer = enemy.phase === 1 ? 0.76 : 0.64;
    spawnChannelEffect(enemy.x, enemy.y, "rgba(242, 183, 109, {a})", 42, enemy.stateTimer);
  }
}

function updateAbyssBoss(enemy, dt, moveMultiplier, player) {
  if (!enemy.phaseTriggered && enemy.hp <= enemy.maxHp * 0.58) {
    enemy.phaseTriggered = true;
    enemy.phase = 2;
    spawnBossPhaseEffect(enemy.x, enemy.y, "rgba(145, 162, 255, {a})");
  }

  if (enemy.state === "beam") {
    holdEnemyBand(enemy, player, 440, 620, enemy.speed * 0.28 * moveMultiplier, dt);
    if (enemy.stateTimer <= 0) {
      spawnBeamAttack(enemy.x, enemy.y, enemy.memoryX, enemy.memoryY, {
        telegraphTime: 0.55,
        activeTime: enemy.phase === 1 ? 0.36 : 0.5,
        width: enemy.phase === 1 ? 44 : 58,
        damage: enemy.phase === 1 ? 28 : 35,
        color: "rgba(145, 162, 255, {a})",
      });
      if (enemy.phase === 2) {
        spawnBeamAttack(enemy.x, enemy.y, player.x, player.y, {
          telegraphTime: 0.76,
          activeTime: 0.4,
          width: 52,
          damage: 30,
          color: "rgba(145, 162, 255, {a})",
        });
        spawnEnemyBurst(player.x, player.y, {
          radius: 88,
          telegraphTime: 0.82,
          damage: 22,
          color: "rgba(145, 162, 255, {a})",
        });
      }
      enemy.state = "recover";
      enemy.stateTimer = 0.36;
      enemy.attackCooldown = enemy.phase === 1 ? 2.1 : 1.42;
    }
    return;
  }

  if (enemy.state === "ring") {
    holdEnemyBand(enemy, player, 450, 650, enemy.speed * 0.3 * moveMultiplier, dt);
    if (enemy.stateTimer <= 0) {
      spawnBossRadial(enemy, enemy.phase === 1 ? 18 : 28, enemy.phase === 1 ? 280 : 350, enemy.phase === 1 ? 15 : 19, "rgba(145, 162, 255, {a})");
      if (enemy.phase === 2) {
        const sideAngle = Math.atan2(player.y - enemy.y, player.x - enemy.x) + Math.PI * 0.5;
        const sideDistance = 124;
        spawnEnemyBurst(player.x + Math.cos(sideAngle) * sideDistance, player.y + Math.sin(sideAngle) * sideDistance, {
          radius: 72,
          telegraphTime: 0.72,
          damage: 20,
          color: "rgba(145, 162, 255, {a})",
        });
        spawnEnemyBurst(player.x - Math.cos(sideAngle) * sideDistance, player.y - Math.sin(sideAngle) * sideDistance, {
          radius: 72,
          telegraphTime: 0.72,
          damage: 20,
          color: "rgba(145, 162, 255, {a})",
        });
      }
      enemy.state = "recover";
      enemy.stateTimer = 0.3;
      enemy.attackCooldown = enemy.phase === 1 ? 1.85 : 1.28;
    }
    return;
  }

  if (enemy.state === "summon") {
    holdEnemyBand(enemy, player, 430, 640, enemy.speed * 0.2 * moveMultiplier, dt);
    if (enemy.stateTimer <= 0) {
      spawnBossMinions(
        enemy,
        enemy.phase === 1
          ? ["hexer", "hexer", "oracle", "oracle", "wraith"]
          : ["hexer", "hexer", "oracle", "oracle", "wraith", "wraith", "fang"]
      );
      enemy.state = "recover";
      enemy.stateTimer = 0.38;
      enemy.attackCooldown = enemy.phase === 1 ? 2.25 : 1.55;
    }
    return;
  }

  if (enemy.state === "recover") {
    holdEnemyBand(enemy, player, 430, 620, enemy.speed * 0.44 * moveMultiplier, dt);
    if (enemy.stateTimer <= 0) {
      enemy.state = "idle";
    }
    return;
  }

  holdEnemyBand(enemy, player, 430, 620, enemy.speed * moveMultiplier, dt);
  if (enemy.attackCooldown > 0) {
    return;
  }

  const pattern = enemy.phase === 1 ? ["ring", "beam", "summon", "ring", "beam"] : ["beam", "ring", "summon", "beam", "ring", "summon"];
  const nextIndex = (enemy.patternIndex + 1 + pattern.length) % pattern.length;
  const nextPattern = pattern[nextIndex];
  enemy.patternIndex = nextIndex;

  if (nextPattern === "beam") {
    enemy.state = "beam";
    enemy.stateTimer = enemy.phase === 1 ? 0.7 : 0.56;
    enemy.memoryX = player.x;
    enemy.memoryY = player.y;
    spawnLineEffect(enemy.x, enemy.y, player.x, player.y, enemy.stateTimer, "rgba(145, 162, 255, {a})", enemy.phase === 1 ? 12 : 16);
    spawnChannelEffect(enemy.x, enemy.y, "rgba(145, 162, 255, {a})", 40, enemy.stateTimer);
  } else if (nextPattern === "ring") {
    enemy.state = "ring";
    enemy.stateTimer = enemy.phase === 1 ? 0.66 : 0.52;
    spawnChannelEffect(enemy.x, enemy.y, "rgba(145, 162, 255, {a})", 40, enemy.stateTimer);
  } else {
    enemy.state = "summon";
    enemy.stateTimer = enemy.phase === 1 ? 0.78 : 0.66;
    spawnChannelEffect(enemy.x, enemy.y, "rgba(145, 162, 255, {a})", 46, enemy.stateTimer);
  }
}

function updateMatriarchBoss(enemy, dt, moveMultiplier, player) {
  if (!enemy.phaseTriggered && enemy.hp <= enemy.maxHp * 0.6) {
    enemy.phaseTriggered = true;
    enemy.phase = 2;
    spawnBossPhaseEffect(enemy.x, enemy.y, "rgba(204, 122, 255, {a})");
  }

  if (enemy.state === "spit") {
    moveEnemyToward(enemy, player.x, player.y, enemy.speed * 0.28 * moveMultiplier, dt);
    if (enemy.stateTimer <= 0) {
      const count = enemy.phase === 1 ? 5 : 7;
      for (let i = 0; i < count; i += 1) {
        const angle = (i / count) * Math.PI * 2 + randRange(-0.35, 0.35);
        const distance = randRange(54, enemy.phase === 1 ? 220 : 270);
        spawnEnemyBurst(player.x + Math.cos(angle) * distance, player.y + Math.sin(angle) * distance, {
          radius: 80,
          telegraphTime: 0.68 + i * 0.05,
          damage: enemy.phase === 1 ? 20 : 27,
          color: "rgba(204, 122, 255, {a})",
        });
      }
      enemy.state = "recover";
      enemy.stateTimer = 0.36;
      enemy.attackCooldown = enemy.phase === 1 ? 2.15 : 1.48;
    }
    return;
  }

  if (enemy.state === "brood") {
    moveEnemyToward(enemy, player.x, player.y, enemy.speed * 0.18 * moveMultiplier, dt);
    if (enemy.stateTimer <= 0) {
      spawnBossMinions(
        enemy,
        enemy.phase === 1
          ? ["brood", "brood", "runner", "runner", "runner", "fang", "fang"]
          : ["brood", "brood", "brood", "runner", "runner", "runner", "fang", "fang", "wraith"]
      );
      enemy.state = "recover";
      enemy.stateTimer = 0.38;
      enemy.attackCooldown = enemy.phase === 1 ? 2.35 : 1.65;
    }
    return;
  }

  if (enemy.state === "pounce-windup") {
    if (enemy.stateTimer <= 0) {
      enemy.state = "pounce";
      enemy.stateTimer = enemy.phase === 1 ? 0.38 : 0.5;
    }
    return;
  }

  if (enemy.state === "pounce") {
    moveEnemyVector(enemy, enemy.memoryX, enemy.memoryY, enemy.speed * (enemy.phase === 1 ? 5.6 : 6.8) * moveMultiplier, dt);
    if (enemy.stateTimer <= 0) {
      spawnEnemyBurst(enemy.x, enemy.y, {
        radius: enemy.phase === 1 ? 110 : 142,
        telegraphTime: 0.32,
        damage: enemy.phase === 1 ? 24 : 34,
        color: "rgba(204, 122, 255, {a})",
      });
      if (enemy.phase === 2) {
        const sideOffset = 84;
        const sideX = -enemy.memoryY;
        const sideY = enemy.memoryX;
        spawnBossMinions(enemy, ["brood", "runner", "runner"]);
        spawnEnemyBurst(enemy.x + sideX * sideOffset, enemy.y + sideY * sideOffset, {
          radius: 82,
          telegraphTime: 0.38,
          damage: 20,
          color: "rgba(204, 122, 255, {a})",
        });
        spawnEnemyBurst(enemy.x - sideX * sideOffset, enemy.y - sideY * sideOffset, {
          radius: 82,
          telegraphTime: 0.38,
          damage: 20,
          color: "rgba(204, 122, 255, {a})",
        });
      }
      enemy.state = "recover";
      enemy.stateTimer = 0.38;
      enemy.attackCooldown = enemy.phase === 1 ? 2 : 1.32;
    }
    return;
  }

  if (enemy.state === "recover") {
    moveEnemyToward(enemy, player.x, player.y, enemy.speed * 0.38 * moveMultiplier, dt);
    if (enemy.stateTimer <= 0) {
      enemy.state = "idle";
    }
    return;
  }

  moveEnemyToward(enemy, player.x, player.y, enemy.speed * moveMultiplier, dt);
  if (enemy.attackCooldown > 0) {
    return;
  }

  const pattern = enemy.phase === 1 ? ["spit", "pounce", "brood", "spit"] : ["spit", "brood", "pounce", "spit", "pounce"];
  const nextIndex = (enemy.patternIndex + 1 + pattern.length) % pattern.length;
  const nextPattern = pattern[nextIndex];
  enemy.patternIndex = nextIndex;

  if (nextPattern === "spit") {
    enemy.state = "spit";
    enemy.stateTimer = enemy.phase === 1 ? 0.7 : 0.56;
    spawnChannelEffect(enemy.x, enemy.y, "rgba(204, 122, 255, {a})", 48, enemy.stateTimer);
  } else if (nextPattern === "pounce") {
    enemy.state = "pounce-windup";
    enemy.stateTimer = enemy.phase === 1 ? 0.64 : 0.5;
    const dx = player.x - enemy.x;
    const dy = player.y - enemy.y;
    const length = Math.hypot(dx, dy) || 1;
    enemy.memoryX = dx / length;
    enemy.memoryY = dy / length;
    spawnLineEffect(enemy.x, enemy.y, player.x, player.y, enemy.stateTimer, "rgba(204, 122, 255, {a})", 13);
  } else {
    enemy.state = "brood";
    enemy.stateTimer = enemy.phase === 1 ? 0.84 : 0.68;
    spawnChannelEffect(enemy.x, enemy.y, "rgba(204, 122, 255, {a})", 52, enemy.stateTimer);
  }
}

function blinkBossToBand(enemy, player, innerRadius, outerRadius) {
  const angle = Math.random() * Math.PI * 2;
  const distance = randRange(innerRadius, outerRadius);
  const targetX = clamp(player.x + Math.cos(angle) * distance, WORLD.left + enemy.radius, WORLD.right - enemy.radius);
  const targetY = clamp(player.y + Math.sin(angle) * distance, WORLD.top + enemy.radius, WORLD.bottom - enemy.radius);
  const spawnPoint = enemy.flying
    ? { x: targetX, y: targetY }
    : findNearbyWalkablePoint(targetX, targetY, enemy.radius, 260);
  spawnLineEffect(enemy.x, enemy.y, spawnPoint.x, spawnPoint.y, 0.42, HOSTILE_ARCANE_COLOR, 10);
  enemy.x = spawnPoint.x;
  enemy.y = spawnPoint.y;
}

function spawnBossLattice(centerX, centerY, beamLength, spec, angles) {
  for (const angle of angles) {
    const dirX = Math.cos(angle);
    const dirY = Math.sin(angle);
    spawnBeamAttack(
      centerX - dirX * beamLength,
      centerY - dirY * beamLength,
      centerX + dirX * beamLength,
      centerY + dirY * beamLength,
      spec
    );
  }
}

function spawnBossStarfall(player, count, minRadius, maxRadius, spec) {
  for (let i = 0; i < count; i += 1) {
    const angle = (i / count) * Math.PI * 2 + randRange(-0.22, 0.22);
    const distance = randRange(minRadius, maxRadius);
    spawnMeteorStrike(player.x + Math.cos(angle) * distance, player.y + Math.sin(angle) * distance, {
      telegraphTime: spec.telegraphTime + i * spec.stagger,
      radius: spec.radius + (i % 3) * spec.radiusStep,
      damage: spec.damage,
    });
  }
}

function updateHarbingerBoss(enemy, dt, moveMultiplier, player) {
  if (!enemy.phaseTriggered && enemy.hp <= enemy.maxHp * 0.58) {
    enemy.phaseTriggered = true;
    enemy.phase = 2;
    spawnBossPhaseEffect(enemy.x, enemy.y, "rgba(173, 150, 255, {a})");
  }

  if (enemy.state === "lattice") {
    holdEnemyBand(enemy, player, 380, 560, enemy.speed * 0.3 * moveMultiplier, dt);
    if (enemy.stateTimer <= 0) {
      const baseAngle = Math.atan2(player.y - enemy.y, player.x - enemy.x);
      const angles = enemy.phase === 1
        ? [baseAngle, baseAngle + Math.PI / 2]
        : [baseAngle, baseAngle + Math.PI / 3, baseAngle + (Math.PI * 2) / 3];
      spawnBossLattice(player.x, player.y, enemy.phase === 1 ? 520 : 620, {
        telegraphTime: enemy.phase === 1 ? 0.54 : 0.48,
        activeTime: enemy.phase === 1 ? 0.34 : 0.42,
        width: enemy.phase === 1 ? 34 : 44,
        damage: enemy.phase === 1 ? 25 : 31,
      }, angles);
      enemy.state = "recover";
      enemy.stateTimer = 0.34;
      enemy.attackCooldown = enemy.phase === 1 ? 2.2 : 1.55;
    }
    return;
  }

  if (enemy.state === "blink") {
    holdEnemyBand(enemy, player, 420, 600, enemy.speed * 0.24 * moveMultiplier, dt);
    if (enemy.stateTimer <= 0) {
      blinkBossToBand(enemy, player, 300, 420);
      enemy.memoryBurstsLeft = enemy.phase === 1 ? 2 : 3;
      enemy.state = "barrage";
      enemy.stateTimer = 0.14;
      enemy.attackCooldown = 0;
    }
    return;
  }

  if (enemy.state === "barrage") {
    holdEnemyBand(enemy, player, 360, 520, enemy.speed * 0.18 * moveMultiplier, dt);
    if (enemy.stateTimer <= 0) {
      const burstIndex = (enemy.phase === 1 ? 2 : 3) - enemy.memoryBurstsLeft;
      spawnBossFan(
        enemy,
        player,
        enemy.phase === 1 ? 7 : 9,
        (enemy.phase === 1 ? 0.56 : 0.74) + burstIndex * 0.06,
        360,
        enemy.phase === 1 ? 18 : 22,
        HOSTILE_ARCANE_COLOR
      );
      enemy.memoryBurstsLeft -= 1;
      if (enemy.memoryBurstsLeft > 0) {
        enemy.stateTimer = enemy.phase === 1 ? 0.26 : 0.22;
      } else {
        enemy.state = "recover";
        enemy.stateTimer = 0.36;
        enemy.attackCooldown = enemy.phase === 1 ? 2.05 : 1.45;
      }
    }
    return;
  }

  if (enemy.state === "edict") {
    holdEnemyBand(enemy, player, 420, 620, enemy.speed * 0.22 * moveMultiplier, dt);
    if (enemy.stateTimer <= 0) {
      empowerNearbyEnemies(enemy, enemy.phase === 1 ? 300 : 360, enemy.phase === 1 ? 0.26 : 0.34, enemy.phase === 1 ? 4.2 : 5.2, true);
      spawnBossMinions(
        enemy,
        enemy.phase === 1
          ? ["banner", "wraith", "runner", "runner"]
          : ["banner", "banner", "mortar", "wraith", "runner"]
      );
      enemy.state = "recover";
      enemy.stateTimer = 0.4;
      enemy.attackCooldown = enemy.phase === 1 ? 2.45 : 1.7;
    }
    return;
  }

  if (enemy.state === "ring") {
    holdEnemyBand(enemy, player, 390, 560, enemy.speed * 0.36 * moveMultiplier, dt);
    if (enemy.stateTimer <= 0) {
      spawnBossRadial(enemy, enemy.phase === 1 ? 16 : 24, enemy.phase === 1 ? 300 : 360, enemy.phase === 1 ? 17 : 22, HOSTILE_ARCANE_COLOR);
      enemy.state = "recover";
      enemy.stateTimer = 0.32;
      enemy.attackCooldown = enemy.phase === 1 ? 2.05 : 1.42;
    }
    return;
  }

  if (enemy.state === "recover") {
    holdEnemyBand(enemy, player, 400, 580, enemy.speed * 0.42 * moveMultiplier, dt);
    if (enemy.stateTimer <= 0) {
      enemy.state = "idle";
    }
    return;
  }

  holdEnemyBand(enemy, player, 400, 580, enemy.speed * moveMultiplier, dt);
  if (enemy.attackCooldown > 0) {
    return;
  }

  const pattern = enemy.phase === 1
    ? ["lattice", "blink", "edict", "ring", "blink"]
    : ["blink", "lattice", "ring", "edict", "blink", "lattice"];
  const nextIndex = (enemy.patternIndex + 1 + pattern.length) % pattern.length;
  const nextPattern = pattern[nextIndex];
  enemy.patternIndex = nextIndex;

  if (nextPattern === "lattice") {
    enemy.state = "lattice";
    enemy.stateTimer = enemy.phase === 1 ? 0.74 : 0.58;
    spawnChannelEffect(enemy.x, enemy.y, HOSTILE_ARCANE_COLOR, 46, enemy.stateTimer);
  } else if (nextPattern === "blink") {
    enemy.state = "blink";
    enemy.stateTimer = enemy.phase === 1 ? 0.54 : 0.44;
    spawnChannelEffect(enemy.x, enemy.y, HOSTILE_ARCANE_COLOR, 36, enemy.stateTimer);
  } else if (nextPattern === "edict") {
    enemy.state = "edict";
    enemy.stateTimer = enemy.phase === 1 ? 0.82 : 0.66;
    spawnChannelEffect(enemy.x, enemy.y, HOSTILE_ARCANE_COLOR, 42, enemy.stateTimer);
  } else {
    enemy.state = "ring";
    enemy.stateTimer = enemy.phase === 1 ? 0.7 : 0.56;
    spawnChannelEffect(enemy.x, enemy.y, HOSTILE_ARCANE_COLOR, 40, enemy.stateTimer);
  }
}

function updateRegentBoss(enemy, dt, moveMultiplier, player) {
  if (!enemy.phaseTriggered && enemy.hp <= enemy.maxHp * 0.56) {
    enemy.phaseTriggered = true;
    enemy.phase = 2;
    spawnBossPhaseEffect(enemy.x, enemy.y, "rgba(255, 194, 112, {a})");
  }

  if (enemy.state === "starfall") {
    holdEnemyBand(enemy, player, 430, 620, enemy.speed * 0.22 * moveMultiplier, dt);
    if (enemy.stateTimer <= 0) {
      spawnBossStarfall(player, enemy.phase === 1 ? 7 : 10, 70, enemy.phase === 1 ? 260 : 340, {
        telegraphTime: enemy.phase === 1 ? 0.68 : 0.62,
        stagger: 0.06,
        radius: 34,
        radiusStep: 5,
        damage: enemy.phase === 1 ? 22 : 29,
      });
      enemy.state = "recover";
      enemy.stateTimer = 0.36;
      enemy.attackCooldown = enemy.phase === 1 ? 2.35 : 1.62;
    }
    return;
  }

  if (enemy.state === "orbital") {
    holdEnemyBand(enemy, player, 440, 650, enemy.speed * 0.2 * moveMultiplier, dt);
    if (enemy.stateTimer <= 0) {
      const count = enemy.phase === 1 ? 7 : 9;
      for (let i = 0; i < count; i += 1) {
        const angle = (i / count) * Math.PI * 2 + state.elapsed * 0.45;
        const distance = enemy.phase === 1 ? 170 : 205;
        spawnEnemyBurst(player.x + Math.cos(angle) * distance, player.y + Math.sin(angle) * distance, {
          radius: 76,
          telegraphTime: 0.7 + (i % 2) * 0.08,
          damage: enemy.phase === 1 ? 20 : 26,
        });
      }
      enemy.state = "recover";
      enemy.stateTimer = 0.34;
      enemy.attackCooldown = enemy.phase === 1 ? 2.05 : 1.44;
    }
    return;
  }

  if (enemy.state === "crown") {
    holdEnemyBand(enemy, player, 420, 620, enemy.speed * 0.3 * moveMultiplier, dt);
    if (enemy.stateTimer <= 0) {
      const outerCount = enemy.phase === 1 ? 5 : 6;
      const innerCount = enemy.phase === 1 ? 3 : 4;
      const baseAngle = state.elapsed * 0.8;
      for (let i = 0; i < outerCount; i += 1) {
        const angle = baseAngle + (i / outerCount) * Math.PI * 2;
        spawnEnemyBurst(player.x + Math.cos(angle) * 250, player.y + Math.sin(angle) * 250, {
          radius: 82,
          telegraphTime: 0.72 + (i % 2) * 0.08,
          damage: enemy.phase === 1 ? 22 : 28,
          color: "rgba(255, 194, 112, {a})",
        });
      }
      for (let i = 0; i < innerCount; i += 1) {
        const angle = -baseAngle + (i / innerCount) * Math.PI * 2;
        spawnEnemyBurst(player.x + Math.cos(angle) * 132, player.y + Math.sin(angle) * 132, {
          radius: 68,
          telegraphTime: 0.84 + (i % 2) * 0.06,
          damage: enemy.phase === 1 ? 18 : 24,
          color: "rgba(255, 214, 132, {a})",
        });
      }
      if (enemy.phase === 2) {
        spawnBossMinions(enemy, ["mortar", "banner"]);
      }
      enemy.state = "recover";
      enemy.stateTimer = 0.38;
      enemy.attackCooldown = enemy.phase === 1 ? 2.55 : 1.78;
    }
    return;
  }

  if (enemy.state === "recover") {
    holdEnemyBand(enemy, player, 430, 620, enemy.speed * 0.38 * moveMultiplier, dt);
    if (enemy.stateTimer <= 0) {
      enemy.state = "idle";
    }
    return;
  }

  holdEnemyBand(enemy, player, 430, 620, enemy.speed * moveMultiplier, dt);
  if (enemy.attackCooldown > 0) {
    return;
  }

  const pattern = enemy.phase === 1
    ? ["starfall", "orbital", "crown", "starfall"]
    : ["orbital", "starfall", "crown", "orbital", "starfall"];
  const nextIndex = (enemy.patternIndex + 1 + pattern.length) % pattern.length;
  const nextPattern = pattern[nextIndex];
  enemy.patternIndex = nextIndex;

  if (nextPattern === "starfall") {
    enemy.state = "starfall";
    enemy.stateTimer = enemy.phase === 1 ? 0.76 : 0.62;
    spawnChannelEffect(enemy.x, enemy.y, HOSTILE_ARCANE_COLOR, 48, enemy.stateTimer);
  } else if (nextPattern === "orbital") {
    enemy.state = "orbital";
    enemy.stateTimer = enemy.phase === 1 ? 0.7 : 0.58;
    spawnChannelEffect(enemy.x, enemy.y, HOSTILE_ARCANE_COLOR, 44, enemy.stateTimer);
  } else {
    enemy.state = "crown";
    enemy.stateTimer = enemy.phase === 1 ? 0.74 : 0.62;
    spawnChannelEffect(enemy.x, enemy.y, "rgba(255, 194, 112, {a})", 50, enemy.stateTimer);
  }
}

function holdEnemyBand(enemy, player, innerRadius, outerRadius, speed, dt) {
  const dx = player.x - enemy.x;
  const dy = player.y - enemy.y;
  const distance = Math.hypot(dx, dy) || 1;
  let moveX = 0;
  let moveY = 0;

  if (distance < innerRadius) {
    moveX -= dx / distance;
    moveY -= dy / distance;
  } else if (distance > outerRadius) {
    moveX += dx / distance;
    moveY += dy / distance;
  }

  enemy.moveAngle += dt * 1.6;
  moveX += (-dy / distance) * 0.65;
  moveY += (dx / distance) * 0.65;
  moveEnemyVector(enemy, moveX, moveY, speed, dt);
}

function buildEnemyGrid(enemies) {
  const map = new Map();
  const cells = [];

  for (const enemy of enemies) {
    if (enemy.dead) {
      continue;
    }

    const cellX = Math.floor(enemy.x / ENEMY_CELL_SIZE);
    const cellY = Math.floor(enemy.y / ENEMY_CELL_SIZE);
    const key = cellKey(cellX, cellY);

    let cell = map.get(key);
    if (!cell) {
      cell = { x: cellX, y: cellY, enemies: [] };
      map.set(key, cell);
      cells.push(cell);
    }

    cell.enemies.push(enemy);
  }

  return { map, cells };
}

function updateAllies(dt) {
  for (const corpse of state.corpses) {
    corpse.life -= dt;
  }
  state.corpses = state.corpses.filter((corpse) => corpse.life > 0);

  for (const ally of state.allies) {
    if (ally.dead) {
      continue;
    }
    ally.life -= dt;
    ally.hitCooldown = Math.max(0, ally.hitCooldown - dt);
    if (ally.life <= 0) {
      ally.dead = true;
      continue;
    }
    const target = findNearestEnemy(ally.x, ally.y, 860);
    if (!target) {
      continue;
    }
    const dx = target.x - ally.x;
    const dy = target.y - ally.y;
    const length = Math.hypot(dx, dy) || 1;
    const drift = 0.18 * Math.sin(state.elapsed * 2.6 + ally.orbitSeed);
    const moveX = dx / length + (-dy / length) * drift;
    const moveY = dy / length + (dx / length) * drift;
    moveCircleEntity(ally, (moveX / Math.hypot(moveX, moveY)) * ally.speed * dt, (moveY / Math.hypot(moveX, moveY)) * ally.speed * dt, ally.radius, { water: false, solids: false });
  }
}

function resolveAllyEnemyCollisions(grid) {
  for (const ally of state.allies) {
    if (ally.dead || ally.hitCooldown > 0) {
      continue;
    }
    const cellX = Math.floor(ally.x / ENEMY_CELL_SIZE);
    const cellY = Math.floor(ally.y / ENEMY_CELL_SIZE);
    for (let offsetY = -1; offsetY <= 1; offsetY += 1) {
      for (let offsetX = -1; offsetX <= 1; offsetX += 1) {
        const cell = grid.map.get(cellKey(cellX + offsetX, cellY + offsetY));
        if (!cell) {
          continue;
        }
        let hit = false;
        for (const enemy of cell.enemies) {
          if (enemy.dead) {
            continue;
          }
          if (!circlesOverlap(ally.x, ally.y, ally.radius, enemy.x, enemy.y, enemy.radius)) {
            continue;
          }
          dealDamageToEnemy(enemy, ally.damage, "thrall");
          applyEnemyNecroMark(enemy);
          ally.hitCooldown = 0.42;
          healPlayer(state.player.thrallLifestealPerHit);
          hit = true;
          break;
        }
        if (hit) {
          break;
        }
      }
    }
  }
  state.allies = state.allies.filter((ally) => !ally.dead);
}

function applyEnemySeparation(grid, intensity) {
  if (intensity <= 0) {
    return;
  }

  for (const cell of grid.cells) {
    resolveSeparationInBucket(cell.enemies, intensity);

    for (const [offsetX, offsetY] of ENEMY_NEIGHBOR_OFFSETS) {
      const neighbor = grid.map.get(cellKey(cell.x + offsetX, cell.y + offsetY));
      if (!neighbor) {
        continue;
      }
      resolveSeparationAcrossBuckets(cell.enemies, neighbor.enemies, intensity);
    }
  }
}

function resolveSeparationInBucket(enemies, intensity) {
  for (let i = 0; i < enemies.length; i += 1) {
    const a = enemies[i];
    if (a.dead) {
      continue;
    }

    for (let j = i + 1; j < enemies.length; j += 1) {
      const b = enemies[j];
      if (b.dead) {
        continue;
      }

      separateEnemyPair(a, b, intensity);
    }
  }
}

function resolveSeparationAcrossBuckets(groupA, groupB, intensity) {
  for (const a of groupA) {
    if (a.dead) {
      continue;
    }

    for (const b of groupB) {
      if (b.dead) {
        continue;
      }

      separateEnemyPair(a, b, intensity);
    }
  }
}

function separateEnemyPair(a, b, intensity) {
  let dx = b.x - a.x;
  let dy = b.y - a.y;
  let distanceSq = dx * dx + dy * dy;
  const minimumDistance = a.radius + b.radius;

  if (distanceSq >= minimumDistance * minimumDistance) {
    return;
  }

  if (distanceSq < 0.0001) {
    const angle = Math.random() * Math.PI * 2;
    dx = Math.cos(angle) * 0.01;
    dy = Math.sin(angle) * 0.01;
    distanceSq = dx * dx + dy * dy;
  }

  const distance = Math.sqrt(distanceSq);
  const overlap = minimumDistance - distance;
  const nx = dx / distance;
  const ny = dy / distance;
  const push = overlap * 0.5 * intensity;

  a.x -= nx * push;
  a.y -= ny * push;
  b.x += nx * push;
  b.y += ny * push;
}

function setEnemyStatusFlash(enemy, type, duration) {
  enemy.statusFlash[type] = Math.max(enemy.statusFlash[type] ?? 0, duration);
}

function applyEnemyBurn(enemy, strength, duration) {
  const potency = 1 + state.player.statusPotency;
  enemy.burnTimer = Math.max(enemy.burnTimer, duration * state.player.statusDurationMultiplier);
  enemy.burnDamage = Math.max(enemy.burnDamage, strength * potency);
  enemy.burnTickTimer = Math.min(enemy.burnTickTimer || 0.22, 0.22);
  setEnemyStatusFlash(enemy, "burn", 0.45);
}

function applyEnemyChill(enemy, amount, duration) {
  const potency = 1 + state.player.statusPotency;
  const effectiveAmount = amount * potency * (1 - enemy.controlResist);
  enemy.chillStacks = Math.min(enemy.isBoss ? 5 : 6, enemy.chillStacks + effectiveAmount);
  enemy.chillDecayTimer = Math.max(enemy.chillDecayTimer, duration * state.player.statusDurationMultiplier);
  enemy.slowAmount = Math.max(enemy.slowAmount, 0.15 + enemy.chillStacks * 0.08);
  enemy.slowTimer = Math.max(enemy.slowTimer, 0.5 * state.player.statusDurationMultiplier);
  setEnemyStatusFlash(enemy, "chill", 0.45);

  const freezeThreshold = enemy.isBoss ? 4.6 : 3.4;
  if (enemy.chillStacks >= freezeThreshold) {
    enemy.chillStacks = 0;
    enemy.chillDecayTimer = 0;
    enemy.freezeTimer = Math.max(enemy.freezeTimer, enemy.isBoss ? 0.4 : 0.85 * (1 - enemy.controlResist));
    enemy.brittleTimer = Math.max(enemy.brittleTimer, enemy.isBoss ? 1.2 : 1.75);
    enemy.slowAmount = Math.max(enemy.slowAmount, enemy.isBoss ? 0.5 : 0.95);
    enemy.slowTimer = Math.max(enemy.slowTimer, enemy.freezeTimer);
    setEnemyStatusFlash(enemy, "freeze", 0.7);
  }
}

function applyEnemyWind(enemy, projectile) {
  const velocityLength = Math.hypot(projectile.vx, projectile.vy) || 1;
  const dirX = projectile.vx / velocityLength;
  const dirY = projectile.vy / velocityLength;
  const force = state.player.weapon.knockback * (1 + state.player.statusPotency * 0.35) * (1 - enemy.pushResist);
  enemy.knockbackVX += dirX * force;
  enemy.knockbackVY += dirY * force;
  setEnemyStatusFlash(enemy, "wind", 0.28);
}

function applyEnemyNecroMark(enemy) {
  enemy.necroMarkTimer = Math.max(enemy.necroMarkTimer, 0.55);
  setEnemyStatusFlash(enemy, "necro", 0.45);
}

function applyEnemyBloodMark(enemy) {
  enemy.bloodMarkTimer = Math.max(enemy.bloodMarkTimer, 0.45);
  setEnemyStatusFlash(enemy, "blood", 0.35);
}

function applyEnemyHaste(enemy, amount, duration) {
  enemy.hasteTimer = Math.max(enemy.hasteTimer, duration);
  enemy.hasteAmount = Math.max(enemy.hasteAmount, amount);
}

function empowerNearbyEnemies(source, radius, amount, duration, includeBosses = false) {
  const radiusSq = radius * radius;
  for (const enemy of state.enemies) {
    if (enemy.dead || enemy.id === source.id) {
      continue;
    }
    if (enemy.isBoss && !includeBosses) {
      continue;
    }
    const dx = enemy.x - source.x;
    const dy = enemy.y - source.y;
    if (dx * dx + dy * dy > radiusSq) {
      continue;
    }
    applyEnemyHaste(enemy, amount, duration);
  }
  applyEnemyHaste(source, amount * 0.8, duration);
  pushEffect({
    kind: "ring",
    x: source.x,
    y: source.y,
    life: 0.55,
    maxLife: 0.55,
    size: 18,
    growth: radius * 0.82,
    lineWidth: 5,
    color: "rgba(168, 116, 255, {a})",
    renderLayer: "top",
  });
}

function computePlayerProjectileDamage(enemy) {
  let damage = state.player.weapon.projectileDamage;
  if (enemy.isBoss) {
    damage *= state.player.weapon.bossDamageMultiplier;
  }
  if (hasAffliction(enemy)) {
    damage *= 1 + state.player.damageVsAfflicted;
  }
  if (enemy.brittleTimer > 0) {
    damage *= enemy.isBoss ? 1.14 : 1.28;
  }
  if (state.player.afterDashBuffTimer > 0) {
    damage *= 1 + state.player.afterDashPower;
  }
  let crit = false;
  if (state.player.classId === "blood") {
    const critChance = state.player.bloodCritChance + (state.player.afterDashBuffTimer > 0 ? 0.1 : 0) + (state.player.bloodRiteTimer > 0 ? 0.12 : 0);
    if (Math.random() < critChance) {
      damage *= state.player.bloodCritMultiplier;
      crit = true;
    }
  }
  return { damage, crit };
}

function healPlayer(amount) {
  if (amount <= 0) {
    return;
  }
  state.player.hp = Math.min(state.player.maxHp, state.player.hp + amount * state.player.healingMultiplier);
}

function dealDamageToEnemy(enemy, amount, source = "generic") {
  if (enemy.dead || amount <= 0) {
    return false;
  }
  spawnDamageNumber(enemy.x, enemy.y - enemy.radius * 0.4, amount, source);
  enemy.hp -= amount;
  if (enemy.isBoss) {
    state.hudMotion.bossBarShakeTimer = 0.24;
  }
  if (enemy.hp <= 0) {
    onEnemyDefeated(enemy, source);
    return true;
  }
  return false;
}

function getDamageNumberColor(source) {
  const sourceName = String(source ?? "");
  if (sourceName === "burn") {
    return "#ffb056";
  }
  if (sourceName === "holy-wave" || sourceName === "holy") {
    return "#ffe89d";
  }
  if (sourceName === "thrall" || sourceName === "grave-call" || sourceName === "bone-ward" || sourceName === "requiem-field") {
    return "#8cf0c3";
  }
  if (
    sourceName === "blood-rite" ||
    sourceName === "vein-burst" ||
    sourceName === "crimson-pool" ||
    sourceName === "blood"
  ) {
    return "#ff87a3";
  }
  if (
    sourceName === "blizzard-wake" ||
    sourceName === "permafrost-seal" ||
    sourceName === "crystal-spear" ||
    sourceName === "frost"
  ) {
    return "#aee8ff";
  }
  if (
    sourceName === "gale-ring" ||
    sourceName === "crosswind-strip" ||
    sourceName === "tempest-node" ||
    sourceName === "wind"
  ) {
    return "#f7fbff";
  }
  if (
    sourceName === "cinder-halo" ||
    sourceName === "sunspot" ||
    sourceName === "ash-comet" ||
    sourceName === "fire"
  ) {
    return "#ffc673";
  }
  switch (state.player.classId) {
    case "frost":
      return "#aee8ff";
    case "fire":
      return "#ffc673";
    case "necro":
      return "#8cf0c3";
    case "blood":
      return "#ff87a3";
    default:
      return "#f7fbff";
  }
}

function spawnDamageNumber(x, y, amount, source) {
  state.damageNumbers.push({
    id: state.nextEntityId++,
    x: x + randRange(-8, 8),
    y: y + randRange(-6, 6),
    vx: randRange(-10, 10),
    vy: -randRange(28, 42),
    life: 0.56,
    maxLife: 0.56,
    amount: Math.max(1, Math.round(amount)),
    color: getDamageNumberColor(source),
  });
}

function maybeRaiseThrall(enemy) {
  if (state.player.classId !== "necro" || enemy.isBoss) {
    return;
  }
  const activeThralls = state.allies.filter((ally) => !ally.dead && ally.kind === "thrall").length;
  if (activeThralls >= 6) {
    return;
  }
  const chance = enemy.type === "grunt" || enemy.type === "runner" ? 0.24 : enemy.type === "tank" ? 0.2 : 0.16;
  if (Math.random() > chance) {
    return;
  }
  state.allies.push({
    id: state.nextEntityId++,
    kind: "thrall",
    sourceType: enemy.type,
    emoji: enemy.emoji,
    x: enemy.x,
    y: enemy.y,
    radius: Math.max(12, enemy.radius * 0.76),
    speed: enemy.speed * 0.82,
    damage: 11 + enemy.radius * 0.12,
    life: 16,
    maxLife: 16,
    hitCooldown: 0,
    orbitSeed: Math.random() * Math.PI * 2,
    dead: false,
  });
}

function resolveProjectileEnemyCollisions(grid) {
  for (const projectile of state.projectiles) {
    if (projectile.dead) {
      continue;
    }

    const cellX = Math.floor(projectile.x / ENEMY_CELL_SIZE);
    const cellY = Math.floor(projectile.y / ENEMY_CELL_SIZE);

    for (let offsetY = -1; offsetY <= 1; offsetY += 1) {
      for (let offsetX = -1; offsetX <= 1; offsetX += 1) {
        const cell = grid.map.get(cellKey(cellX + offsetX, cellY + offsetY));
        if (!cell) {
          continue;
        }

        for (const enemy of cell.enemies) {
          if (enemy.dead) {
            continue;
          }

          const hitDistance = projectile.radius + enemy.radius;
          const dx = enemy.x - projectile.x;
          const dy = enemy.y - projectile.y;

          if (dx * dx + dy * dy > hitDistance * hitDistance) {
            continue;
          }

          const damageInfo = projectile.owner === "player" ? computePlayerProjectileDamage(enemy) : { damage: projectile.damage, crit: false };
          applyHitResponse(enemy, projectile, state.player.weapon, damageInfo.crit);
          dealDamageToEnemy(enemy, damageInfo.damage, projectile.owner ?? "projectile");

          projectile.pierce -= 1;

          if (projectile.pierce <= 0) {
            projectile.dead = true;
            break;
          }
        }

        if (projectile.dead) {
          break;
        }
      }

      if (projectile.dead) {
        break;
      }
    }
  }
}

function applyHitResponse(enemy, projectile, weapon, crit = false) {
  if (projectile.skillType === "crystal-spear") {
    applyEnemyChill(enemy, enemy.isBoss ? 1.8 : 3, 2.5);
    if (enemy.brittleTimer > 0) {
      enemy.brittleTimer = Math.max(enemy.brittleTimer, 2.2);
    }
  }
  const velocityLength = Math.hypot(projectile.vx, projectile.vy) || 1;
  const dirX = projectile.vx / velocityLength;
  const dirY = projectile.vy / velocityLength;

  const passiveType = getClassDef().passiveType;
  if (passiveType === "wind") {
    applyEnemyWind(enemy, projectile);
  } else {
    enemy.knockbackVX += dirX * weapon.knockback * (1 - enemy.pushResist);
    enemy.knockbackVY += dirY * weapon.knockback * (1 - enemy.pushResist);
  }

  if (passiveType === "frost") {
    applyEnemyChill(enemy, enemy.isBoss ? 0.8 : 1.2, 2.1);
  } else if (passiveType === "fire") {
    applyEnemyBurn(enemy, enemy.isBoss ? 8 : 11, 3.1);
  } else if (passiveType === "necro") {
    applyEnemyNecroMark(enemy);
  } else if (passiveType === "blood") {
    applyEnemyBloodMark(enemy);
  }

  if (state.player.classId === "blood") {
    const lifestealRatio = state.player.lifesteal + (state.player.afterDashBuffTimer > 0 ? 0.04 : 0) + (state.player.bloodRiteTimer > 0 ? 0.05 : 0);
    healPlayer(projectile.damage * lifestealRatio * (crit ? 1.2 : 1));
  }

  spawnHitEffect(enemy.x, enemy.y, passiveType === "fire" ? "ember" : passiveType === "frost" ? "icy" : passiveType === "wind" ? "holy" : "arcane", dirX, dirY);
}

function onEnemyDefeated(enemy, source = "unknown") {
  enemy.dead = true;
  state.kills += 1;
  state.killBreakdown[enemy.type] = (state.killBreakdown[enemy.type] ?? 0) + 1;
  state.score += enemy.reward;
  state.corpses.push({ x: enemy.x, y: enemy.y, type: enemy.type, life: 12, radius: enemy.radius });
  spawnDefeatEffect(enemy);
  spawnXpDrops(enemy);
  if (enemy.type === "brood") {
    spawnBossMinions(enemy, ["runner", "runner"]);
  }
  if (state.player.onKillHeal > 0) {
    state.player.hp = Math.min(state.player.maxHp, state.player.hp + state.player.onKillHeal);
  }
  if (state.player.classId === "fire" && enemy.burnTimer > 0) {
    for (const nearby of state.enemies) {
      if (nearby.dead || nearby.id === enemy.id) {
        continue;
      }
      const distance = Math.hypot(nearby.x - enemy.x, nearby.y - enemy.y);
      if (distance > 150) {
        continue;
      }
      applyEnemyBurn(nearby, nearby.isBoss ? 5 : 8, 2.2);
    }
  }
  maybeRaiseThrall(enemy);
  if (enemy.isBoss) {
    recordTelemetryBossDefeat(enemy);
    state.bossDefeats[enemy.type] = (state.bossDefeats[enemy.type] ?? 0) + 1;
    state.bossDirector.encounterIndex += 1;
    scheduleNextBossEncounter(state.elapsed);
    openBossRewardChoices(enemy);
    return;
  }
}

function resolvePlayerEnemyDamage(dt, grid) {
  const player = state.player;
  let incomingDamage = 0;
  const byType = {};

  const cellX = Math.floor(player.x / ENEMY_CELL_SIZE);
  const cellY = Math.floor(player.y / ENEMY_CELL_SIZE);

  for (let offsetY = -1; offsetY <= 1; offsetY += 1) {
    for (let offsetX = -1; offsetX <= 1; offsetX += 1) {
      const cell = grid.map.get(cellKey(cellX + offsetX, cellY + offsetY));
      if (!cell) {
        continue;
      }

      for (const enemy of cell.enemies) {
        if (enemy.dead) {
          continue;
        }

        const dx = player.x - enemy.x;
        const dy = player.y - enemy.y;
        const distanceSq = dx * dx + dy * dy;
        const contactDistance = player.radius + enemy.radius;

        if (distanceSq >= contactDistance * contactDistance) {
          continue;
        }

        const distance = Math.sqrt(Math.max(distanceSq, 0.0001));
        const overlap = contactDistance - distance;

        const damage = enemy.touchDamage * dt;
        incomingDamage += damage;
        byType[enemy.type] = Number(((byType[enemy.type] ?? 0) + damage).toFixed(2));
        enemy.x -= (dx / distance) * Math.min(6, overlap);
        enemy.y -= (dy / distance) * Math.min(6, overlap);
      }
    }
  }

  if (incomingDamage <= 0) {
    return;
  }

  damagePlayer(incomingDamage, {
    key: "contact",
    label: "Enemy Contact",
    details: { byType },
  });
}

function cleanupDeadEntities() {
  state.projectiles = state.projectiles.filter((projectile) => !projectile.dead);
  state.enemyAttacks = state.enemyAttacks.filter((attack) => !attack.dead);
  state.pickups = state.pickups.filter((pickup) => !pickup.dead);
  state.enemies = state.enemies.filter((enemy) => !enemy.dead);
}

function applyZoneTick(effect, enemy, distanceRatio = 1) {
  const damage = effect.damage * (enemy.isBoss ? 0.65 : 1) * distanceRatio;
  dealDamageToEnemy(enemy, damage, effect.kind);
  switch (effect.kind) {
    case "gale-ring":
    case "crosswind-strip":
    case "tempest-node":
      setEnemyStatusFlash(enemy, "wind", 0.3);
      enemy.knockbackVX += ((enemy.x - effect.x) / Math.max(1, Math.hypot(enemy.x - effect.x, enemy.y - effect.y))) * 180;
      enemy.knockbackVY += ((enemy.y - effect.y) / Math.max(1, Math.hypot(enemy.x - effect.x, enemy.y - effect.y))) * 180;
      break;
    case "blizzard-wake":
    case "permafrost-seal":
      applyEnemyChill(enemy, enemy.isBoss ? 0.7 : 1.1, 1.8);
      break;
    case "cinder-halo":
    case "sunspot":
    case "ash-comet":
      applyEnemyBurn(enemy, enemy.isBoss ? 9 : 13, 3.2);
      break;
    case "requiem-field":
      applyEnemyNecroMark(enemy);
      enemy.slowAmount = Math.max(enemy.slowAmount, 0.18);
      enemy.slowTimer = Math.max(enemy.slowTimer, 0.35);
      break;
    case "vein-burst":
    case "crimson-pool":
      applyEnemyBloodMark(enemy);
      healPlayer(damage * 0.05);
      enemy.slowAmount = Math.max(enemy.slowAmount, effect.kind === "crimson-pool" ? 0.22 : enemy.slowAmount);
      enemy.slowTimer = Math.max(enemy.slowTimer, effect.kind === "crimson-pool" ? 0.32 : enemy.slowTimer);
      break;
    default:
      break;
  }
}

function pointInRotatedRect(px, py, cx, cy, angle, halfLength, halfWidth) {
  const dx = px - cx;
  const dy = py - cy;
  const cos = Math.cos(-angle);
  const sin = Math.sin(-angle);
  const localX = dx * cos - dy * sin;
  const localY = dx * sin + dy * cos;
  return Math.abs(localX) <= halfLength && Math.abs(localY) <= halfWidth;
}

function updateEffects(dt) {
  state.player.hitFlash = Math.max(0, state.player.hitFlash - dt * 2.8);
  state.player.hitShakeTimer = Math.max(0, state.player.hitShakeTimer - dt);
  state.player.hitShakePower *= Math.exp(-11 * dt);
  state.cameraShake.timer = Math.max(0, state.cameraShake.timer - dt);
  state.cameraShake.power *= Math.exp(-10 * dt);

  if (state.cameraShake.timer > 0 && state.cameraShake.power > 0.01) {
    state.cameraShake.offsetX = randRange(-1, 1) * state.cameraShake.power;
    state.cameraShake.offsetY = randRange(-1, 1) * state.cameraShake.power;
  } else {
    state.cameraShake.offsetX = 0;
    state.cameraShake.offsetY = 0;
  }

  for (const effect of state.effects) {
    effect.life -= dt;
    if (effect.life <= 0) {
      if (beginEffectFadeTail(effect)) {
        continue;
      }
      continue;
    }

    if (effect.followPlayer) {
      effect.x = state.player.x + (effect.followOffsetX ?? 0);
      effect.y = state.player.y + (effect.followOffsetY ?? 0);
    }

    if (effect.kind === "spark" || effect.kind === "ember") {
      effect.x += effect.vx * dt;
      effect.y += effect.vy * dt;
      effect.vx *= Math.exp(-4.4 * dt);
      effect.vy *= Math.exp(-4.4 * dt);
      continue;
    }

    if (effect.inFadeTail) {
      continue;
    }

    if (
      effect.kind === "gale-ring" ||
      effect.kind === "blizzard-wake" ||
      effect.kind === "cinder-halo" ||
      effect.kind === "vein-burst" ||
      effect.kind === "blood-rite"
    ) {
      effect.tickTimer -= dt;
      if (effect.kind === "blood-rite") {
        continue;
      }
      if (effect.tickTimer <= 0) {
        effect.tickTimer += effect.interval;
        for (const enemy of state.enemies) {
          if (enemy.dead) {
            continue;
          }
          const distance = Math.hypot(enemy.x - effect.x, enemy.y - effect.y);
          if (distance > effect.radius + enemy.radius) {
            continue;
          }
          applyZoneTick(effect, enemy, 1 - Math.min(0.55, distance / Math.max(1, effect.radius) * 0.35));
        }
      }
      continue;
    }

    if (effect.kind === "crosswind-strip") {
      effect.tickTimer -= dt;
      if (effect.tickTimer <= 0) {
        effect.tickTimer += effect.interval;
        const { currentLength, currentWidth, centerX, centerY } = getCrosswindMetrics(effect, clamp(effect.life / effect.maxLife, 0, 1));
        for (const enemy of state.enemies) {
          if (enemy.dead) {
            continue;
          }
          if (!pointInRotatedRect(enemy.x, enemy.y, centerX, centerY, effect.angle, currentLength * 0.5, currentWidth * 0.5 + enemy.radius)) {
            continue;
          }
          applyZoneTick(effect, enemy, 1);
          const sidewaysX = -Math.sin(effect.angle);
          const sidewaysY = Math.cos(effect.angle);
          const side = Math.sign((enemy.x - effect.x) * sidewaysX + (enemy.y - effect.y) * sidewaysY) || 1;
          enemy.knockbackVX += sidewaysX * side * 260;
          enemy.knockbackVY += sidewaysY * side * 260;
        }
      }
      continue;
    }

    if (effect.kind === "tempest-node") {
      effect.tickTimer -= dt;
      if (effect.tickTimer <= 0) {
        effect.tickTimer += effect.interval;
        for (const enemy of state.enemies) {
          if (enemy.dead) {
            continue;
          }
          const dx = effect.x - enemy.x;
          const dy = effect.y - enemy.y;
          const distance = Math.hypot(dx, dy);
          if (distance > effect.radius + enemy.radius) {
            continue;
          }
          applyZoneTick(effect, enemy, 1);
          const pull = 120 + (1 - distance / Math.max(1, effect.radius)) * 220;
          enemy.knockbackVX += (dx / Math.max(1, distance)) * pull;
          enemy.knockbackVY += (dy / Math.max(1, distance)) * pull;
        }
      }
      continue;
    }

    if (effect.kind === "permafrost-seal" || effect.kind === "ash-comet") {
      effect.armTime -= dt;
      if (!effect.burstDone && effect.armTime <= 0) {
        effect.burstDone = true;
        for (const enemy of state.enemies) {
          if (enemy.dead) {
            continue;
          }
          const distance = Math.hypot(enemy.x - effect.x, enemy.y - effect.y);
          if (distance > effect.radius + enemy.radius) {
            continue;
          }
          applyZoneTick(effect, enemy, 1);
          if (effect.kind === "permafrost-seal") {
            applyEnemyChill(enemy, enemy.isBoss ? 2.8 : 4.2, 2.4);
          } else {
            applyEnemyBurn(enemy, enemy.isBoss ? 15 : 22, 4.2);
          }
        }
        if (effect.kind === "ash-comet") {
          pushEffect({
            kind: "sunspot",
            renderLayer: "top",
            x: effect.x,
            y: effect.y,
            life: 2.4 * (1 + state.player.skillDurationMultiplier),
            maxLife: 2.4 * (1 + state.player.skillDurationMultiplier),
            radius: effect.radius * 1.05,
            damage: 24 * state.player.skillDamageMultiplier * state.player.zoneDamageMultiplier,
            interval: 0.18,
            tickTimer: 0.02,
            color: "rgba(255, 154, 68, {a})",
          });
        }
      }
      continue;
    }

    if (effect.kind === "sunspot" || effect.kind === "requiem-field" || effect.kind === "crimson-pool") {
      effect.tickTimer -= dt;
      if (effect.tickTimer <= 0) {
        effect.tickTimer += effect.interval;
        for (const enemy of state.enemies) {
          if (enemy.dead) {
            continue;
          }
          const distance = Math.hypot(enemy.x - effect.x, enemy.y - effect.y);
          if (distance > effect.radius + enemy.radius) {
            continue;
          }
          applyZoneTick(effect, enemy, 1);
        }
      }
      continue;
    }

    if (effect.kind === "bone-ward") {
      effect.tickTimer -= dt;
      if (effect.tickTimer <= 0) {
        effect.tickTimer += effect.interval;
        const progress = 1 - effect.life / effect.maxLife;
        for (let orb = 0; orb < effect.orbitCount; orb += 1) {
          const angle = progress * 24.6 + (orb / effect.orbitCount) * Math.PI * 2;
          const orbX = effect.x + Math.cos(angle) * effect.radius;
          const orbY = effect.y + Math.sin(angle) * effect.radius;
          for (const enemy of state.enemies) {
            if (enemy.dead || !circlesOverlap(orbX, orbY, 18, enemy.x, enemy.y, enemy.radius)) {
              continue;
            }
            applyZoneTick(effect, enemy, 1);
            applyEnemyNecroMark(enemy);
          }
        }
      }
      continue;
    }

    if (effect.kind === "holy-wave") {
      const progress = 1 - effect.life / effect.maxLife;
      const radius = effect.size + progress * effect.growth;
      for (const enemy of state.enemies) {
        if (enemy.dead || effect.hitIds.has(enemy.id)) {
          continue;
        }

        const distance = Math.hypot(enemy.x - effect.x, enemy.y - effect.y);
        if (Math.abs(distance - radius) > enemy.radius + effect.thickness) {
          continue;
        }

        effect.hitIds.add(enemy.id);
        const damage = effect.damage * (enemy.isBoss ? 0.62 : 1);
        enemy.knockbackVX += ((enemy.x - effect.x) / Math.max(1, distance)) * 280;
        enemy.knockbackVY += ((enemy.y - effect.y) / Math.max(1, distance)) * 280;
        enemy.slowAmount = Math.max(enemy.slowAmount, 0.2);
        enemy.slowTimer = Math.max(enemy.slowTimer, 0.32);
        spawnHitEffect(enemy.x, enemy.y, "holy", enemy.x - effect.x, enemy.y - effect.y);
        dealDamageToEnemy(enemy, damage, "holy-wave");
      }
      continue;
    }

    if (effect.kind === "holy-text") {
      effect.followOffsetY -= dt * 44;
      continue;
    }

    if (effect.kind === "grave-call") {
      continue;
    }
  }

  state.effects = state.effects.filter((effect) => effect.life > 0);

  for (const number of state.damageNumbers) {
    number.life -= dt;
    if (number.life <= 0) {
      continue;
    }
    number.x += number.vx * dt;
    number.y += number.vy * dt;
    number.vx *= Math.exp(-5.4 * dt);
    number.vy = number.vy * Math.exp(-4.2 * dt) - 12 * dt;
  }
  state.damageNumbers = state.damageNumbers.filter((number) => number.life > 0);
}

function updateEnemyAttacks(dt) {
  const player = state.player;

  for (const attack of state.enemyAttacks) {
    if (attack.dead) {
      continue;
    }

    attack.life -= dt;
    if (attack.life <= 0) {
      attack.dead = true;
      continue;
    }

    if (attack.kind === "projectile") {
      attack.x += attack.vx * dt;
      attack.y += attack.vy * dt;

      if (!isInsideWorld(attack.x, attack.y, 120)) {
        attack.dead = true;
        continue;
      }

      if (circlesOverlap(attack.x, attack.y, attack.radius, player.x, player.y, player.radius)) {
        damagePlayer(attack.damage, {
          key: `attack:projectile:${attack.ownerType ?? "enemy"}`,
          label: "Enemy Projectile",
          details: { ownerType: attack.ownerType ?? null },
        });
        spawnHostileImpactEffect(attack.x, attack.y, attack.color);
        attack.dead = true;
      }
      continue;
    }

    attack.telegraphTime -= dt;
    if (attack.telegraphTime > 0) {
      continue;
    }

    if (attack.kind === "burst") {
      if (!attack.triggered) {
        if (circlesOverlap(attack.x, attack.y, attack.radius, player.x, player.y, player.radius)) {
          damagePlayer(attack.damage, {
            key: `attack:burst:${attack.ownerType ?? "enemy"}`,
            label: "Burst Zone",
            details: { ownerType: attack.ownerType ?? null },
          });
        }
        spawnHostileImpactEffect(attack.x, attack.y, attack.color);
        attack.triggered = true;
      }
      attack.dead = true;
      continue;
    }

    if (attack.kind === "meteor") {
      if (!attack.triggered) {
        if (circlesOverlap(attack.x, attack.y, attack.radius, player.x, player.y, player.radius)) {
          damagePlayer(attack.damage, {
            key: `attack:meteor:${attack.ownerType ?? "enemy"}`,
            label: "Meteor",
            details: { ownerType: attack.ownerType ?? null },
          });
        }
        spawnMeteorImpactEffect(attack.x, attack.y, attack.color);
        attack.triggered = true;
      }
      attack.dead = true;
      continue;
    }

    if (attack.kind === "shockwave") {
      attack.currentRadius += attack.speed * dt;
      if (
        !attack.hitPlayer &&
        isPlayerTouchingRing(player, attack.x, attack.y, attack.currentRadius, attack.thickness + player.radius)
      ) {
        damagePlayer(attack.damage, {
          key: `attack:shockwave:${attack.ownerType ?? "enemy"}`,
          label: "Shockwave",
          details: { ownerType: attack.ownerType ?? null },
        });
        attack.hitPlayer = true;
      }
      if (attack.currentRadius >= attack.maxRadius) {
        attack.dead = true;
      }
      continue;
    }

    if (attack.kind === "beam") {
      if (attack.activeTime > 0) {
        attack.activeTime -= dt;
        if (!attack.hitPlayer && distancePointToSegment(player.x, player.y, attack.x, attack.y, attack.x2, attack.y2) <= attack.width * 0.5 + player.radius) {
          damagePlayer(attack.damage, {
            key: `attack:beam:${attack.ownerType ?? "enemy"}`,
            label: "Beam",
            details: { ownerType: attack.ownerType ?? null },
          });
          attack.hitPlayer = true;
        }
        if (attack.activeTime <= 0) {
          attack.dead = true;
        }
      }
    }
  }
}

function grantExperience(baseXp) {
  const xpGain = Math.max(1, Math.round(baseXp * state.player.xpMultiplier));
  const progression = state.progression;

  progression.xp += xpGain;
  state.metaRun.xpCollected += xpGain;

  let gainedLevel = false;
  while (progression.xp >= progression.xpToNext) {
    progression.xp -= progression.xpToNext;
    progression.level += 1;
    recordTelemetryLevel(progression.level);
    progression.xpToNext = getXpToNext(progression.level);
    progression.pendingLevelUps += 1;
    progression.rewardQueue.push(progression.level);
    gainedLevel = true;
  }

  if (gainedLevel) {
    startLevelUpPauseIfNeeded();
  }

  updateHud(false);
}

function getXpToNext(level) {
  return Math.round(
    XP_CURVE.base +
    level * XP_CURVE.linear +
    Math.pow(level, XP_CURVE.exponent) * XP_CURVE.exponentialScale
  );
}

function startLevelUpPauseIfNeeded() {
  if (!state.running || state.levelUp.active || state.bossReward.active || state.progression.rewardQueue.length <= 0) {
    return;
  }

  resolveAutomaticSkillUnlocks();
  if (state.progression.rewardQueue.length <= 0 || state.levelUp.active || state.bossReward.active) {
    return;
  }

  if (state.dev.zenMode) {
    autoResolvePendingLevelUps();
    return;
  }

  if (state.pause.upgradesPanel) {
    closeUpgradesPanel();
  }

  state.levelUp.active = true;
  pressedActions.clear();
  openLevelUpChoices();
  updateHud(true);
}

function openLevelUpChoices() {
  const rewardLevel = state.progression.rewardQueue[0] ?? state.progression.level;
  const rewardKind = getLevelRewardKind(rewardLevel);
  if (rewardKind === "skill") {
    levelUpOverlay.classList.add("hidden");
    levelUpOverlay.classList.remove("is-ascendant");
    resolveAutomaticSkillUnlocks();
    if (state.progression.rewardQueue.length > 0) {
      openLevelUpChoices();
    } else {
      state.levelUp.active = false;
    }
    return;
  }
  const options = generateUpgradeOptions(rewardKind);
  if (options.length === 0) {
    state.progression.rewardQueue.shift();
    state.progression.pendingLevelUps = Math.max(0, state.progression.pendingLevelUps - 1);
    state.levelUp.active = false;
    levelUpOverlay.classList.add("hidden");
    return;
  }

  state.levelUp.rewardLevel = rewardLevel;
  state.levelUp.category = rewardKind;
  state.levelUp.options = options;
  levelUpTitle.textContent = `Level ${rewardLevel}`;
  levelUpKicker.textContent = getLevelUpKicker(rewardKind);
  levelUpSubtitle.textContent = getLevelUpSubtitle(rewardKind);
  levelUpOverlay.classList.toggle("is-ascendant", rewardKind === "major" || rewardKind === "mastery");
  renderUpgradeButtons(options);
  levelUpOverlay.classList.remove("hidden");
  retriggerLevelUpFlash();
  retriggerEnterAnimation(levelUpOverlay, levelUpCard);
}

function autoResolvePendingLevelUps() {
  let safety = 32;
  state.levelUp.active = false;
  levelUpOverlay.classList.add("hidden");

  while (state.progression.rewardQueue.length > 0 && safety > 0) {
    safety -= 1;
    const rewardLevel = state.progression.rewardQueue[0];
    const rewardKind = getLevelRewardKind(rewardLevel);
    if (rewardKind === "skill") {
      resolveAutomaticSkillUnlocks();
      continue;
    }
    const options = generateUpgradeOptions(rewardKind, rewardLevel);
    if (options.length === 0) {
      state.progression.rewardQueue.shift();
      state.progression.pendingLevelUps = Math.max(0, state.progression.pendingLevelUps - 1);
      continue;
    }
    applyUpgradeOption(pickAutoUpgradeOption(options));
  }

  updateHud(true);
}

function getLevelUpKicker(kind) {
  if (kind === "skill") {
    return "New Technique";
  }
  if (kind === "major") {
    return "Major Upgrade";
  }
  if (kind === "mastery") {
    return "Mastery";
  }
  return "Level Up";
}

function getLevelUpSubtitle(kind) {
  if (kind === "skill") {
    return "Your class kit grows with a new active spell.";
  }
  if (kind === "major") {
    return "Choose a strong build direction. The opposite side can still appear later.";
  }
  if (kind === "mastery") {
    return "Choose which active slot to empower further.";
  }
  return "Choose one universal upgrade.";
}

function resolveAutomaticSkillUnlocks() {
  let changed = false;
  while (state.progression.rewardQueue.length > 0 && getLevelRewardKind(state.progression.rewardQueue[0]) === "skill") {
    const rewardLevel = state.progression.rewardQueue[0];
    const options = generateSkillUnlockOptions(rewardLevel);
    if (options.length === 0) {
      state.progression.rewardQueue.shift();
      state.progression.pendingLevelUps = Math.max(0, state.progression.pendingLevelUps - 1);
      continue;
    }
    applyUpgradeOption(options[0], { skipLevelFx: true, deferNextOpen: true });
    changed = true;
  }
  if (changed) {
    updateHud(true);
  }
  return changed;
}

function pickAutoUpgradeOption(options) {
  const tierRank = {
    common: 1,
    uncommon: 2,
    rare: 3,
    legendary: 4,
  };

  let best = options[0];
  for (const option of options.slice(1)) {
    const bestTier = tierRank[best.tier] ?? 0;
    const optionTier = tierRank[option.tier] ?? 0;
    if (optionTier > bestTier) {
      best = option;
      continue;
    }
    if (optionTier < bestTier) {
      continue;
    }

    const bestRatio = best.maxStacks ? best.stacks / best.maxStacks : best.stacks;
    const optionRatio = option.maxStacks ? option.stacks / option.maxStacks : option.stacks;
    if (optionRatio < bestRatio) {
      best = option;
      continue;
    }
    if (optionRatio > bestRatio) {
      continue;
    }

    if ((option.weight ?? 0) > (best.weight ?? 0)) {
      best = option;
    }
  }

  return best;
}

function generateUpgradeOptions(kind, rewardLevel = state.levelUp.rewardLevel || state.progression.level) {
  if (kind === "skill") {
    return generateSkillUnlockOptions(rewardLevel);
  }
  if (kind === "major") {
    return generateMajorUpgradeOptions();
  }
  if (kind === "mastery") {
    return generateMasteryOptions();
  }
  return generateMinorUpgradeOptions();
}

function generateMinorUpgradeOptions() {
  const options = [];
  for (const bucket of Object.keys(UPGRADE_BUCKETS)) {
    const bucketOptions = [];
    for (const upgrade of MINOR_UPGRADES) {
      if (upgrade.bucket !== bucket) {
        continue;
      }
      const stacks = state.upgrades[upgrade.id] ?? 0;
      if (state.progression.level < upgrade.minLevel) {
        continue;
      }
      if (upgrade.maxStacks && stacks >= upgrade.maxStacks) {
        continue;
      }
      if (upgrade.id === "zonecraft" && getUnlockedSkillStates().length === 0) {
        continue;
      }
      let weight = upgrade.weight;
      if (state.levelUp.recentIds.includes(upgrade.id)) {
        weight *= 0.42;
      }
      const effect = upgrade.effect(state, state.progression.level, stacks);
      bucketOptions.push({
        id: upgrade.id,
        icon: upgrade.icon,
        title: upgrade.title,
        description: upgrade.description,
        family: upgrade.family,
        familyLabel: upgrade.familyLabel,
        tier: upgrade.tier,
        stacks,
        maxStacks: upgrade.maxStacks ?? null,
        effect,
        effectText: upgrade.effectText(effect, state, state.progression.level, stacks),
        apply: (gameState) => upgrade.apply(gameState, effect),
        weight,
      });
    }
    const picked = weightedPickWithoutReplacement(bucketOptions, 1);
    if (picked[0]) {
      options.push(picked[0]);
    }
  }
  return shuffleArray(options);
}

function generateMajorUpgradeOptions() {
  const pair = pickMajorUpgradePair();
  if (!pair) {
    return generateMinorUpgradeOptions();
  }
  return [pair.left, pair.right].map((entry) => ({
    ...entry,
    pairId: pair.id,
    stacks: state.upgrades[entry.id] ?? 0,
    maxStacks: getMajorMaxStacks(entry.id),
    milestone: true,
    effectText: getMajorEffectText(entry.id, state.upgrades[entry.id] ?? 0),
    apply: (gameState) => {
      const stacks = gameState.upgrades[entry.id] ?? 0;
      if (!applyMajorUpgradeRank(entry.id, gameState, stacks)) {
        return false;
      }
      gameState.majorChoices[pair.id] = entry.id;
      gameState.lastMajorPairId = pair.id;
      return true;
    },
  }));
}

function generateSkillUnlockOptions(rewardLevel = state.progression.level) {
  const unlockIndex = getSkillUnlockIndexForLevel(rewardLevel);
  if (unlockIndex < 0) {
    return [];
  }
  const classDef = getClassDef();
  const skill = classDef.skills[unlockIndex];
  if (!skill) {
    return [];
  }
  return [{
    id: `skill-unlock-${skill.id}`,
    icon: skill.icon,
    title: skill.title,
    description: `${skill.role} slot for ${classDef.title}.`,
    family: "skill",
    familyLabel: `Slot ${skill.slot}`,
    tier: "rare",
    stacks: Number(state.player.skills[unlockIndex].unlocked),
    maxStacks: 1,
    milestone: true,
    effectText: classDef.unlockMessage,
    apply(gameState) {
      const skillState = gameState.player.skills[unlockIndex];
      skillState.unlocked = true;
      skillState.timer = Math.min(skillState.timer, skillState.cooldown * 0.55);
      skillState.unlockPulseTimer = Math.max(skillState.unlockPulseTimer, 0.9);
      gameState.skillUnlocksClaimed += 1;
    },
  }];
}

function generateMasteryOptions() {
  return getUnlockedSkillStates().map((skillState) => {
    const skillDef = getClassDef().skills.find((skill) => skill.id === skillState.id);
    return {
      id: `mastery-${skillState.id}`,
      icon: skillDef?.icon ?? "\u2728",
      title: `Empower ${skillDef?.title ?? `Slot ${skillState.slot}`}`,
      description: `Increase the power of Slot ${skillState.slot}.`,
      family: "mastery",
      familyLabel: `Slot ${skillState.slot}`,
      tier: "legendary",
      stacks: skillState.mastery,
      maxStacks: 2,
      milestone: true,
      effectText: getSkillMasteryText(skillState.slot, skillState.mastery + 1),
      apply(gameState) {
        const target = getSkillState(skillState.slot);
        if (!target || target.mastery >= 2) {
          return;
        }
        target.mastery += 1;
        gameState.masteryChoicesClaimed += 1;
      },
    };
  }).filter((option) => option.stacks < option.maxStacks);
}

function weightedPickWithoutReplacement(candidates, count) {
  const pool = [...candidates];
  const picked = [];
  const pickedFamilies = new Set();

  while (pool.length > 0 && picked.length < count) {
    const eligiblePool = pool.filter((option) => !pickedFamilies.has(option.choiceFamily));
    const sourcePool = eligiblePool.length > 0 ? eligiblePool : pool;
    const totalWeight = sourcePool.reduce((sum, option) => sum + option.weight, 0);
    if (totalWeight <= 0) {
      break;
    }

    let roll = Math.random() * totalWeight;
    let chosen = sourcePool[sourcePool.length - 1];

    for (let i = 0; i < sourcePool.length; i += 1) {
      roll -= sourcePool[i].weight;
      if (roll <= 0) {
        chosen = sourcePool[i];
        break;
      }
    }

    picked.push(chosen);
    pickedFamilies.add(chosen.choiceFamily);

    const chosenIndex = pool.findIndex((option) => option.id === chosen.id);
    if (chosenIndex >= 0) {
      pool.splice(chosenIndex, 1);
    }
  }

  return picked;
}

function shuffleArray(items) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const swapIndex = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[swapIndex]] = [copy[swapIndex], copy[i]];
  }
  return copy;
}

function getSkillMasteryText(slot, nextRank) {
  return `Empower Slot ${slot} to mastery ${nextRank}.`;
}

function getUpgradeStackLabel(option) {
  return option.maxStacks
    ? `Stacks ${option.stacks}/${option.maxStacks}`
    : `Stacks ${option.stacks}`;
}

function getUpgradeCodexStatus(upgrade, stacks) {
  if (state.progression.level < upgrade.minLevel) {
    return `Unlocks at level ${upgrade.minLevel}`;
  }
  if (stacks <= 0) {
    return "Available";
  }
  if (upgrade.maxStacks && stacks >= upgrade.maxStacks) {
    return "Maxed";
  }
  return "Collected";
}

function getTotalUpgradeStacks() {
  let total = 0;
  for (const value of Object.values(state.upgrades)) {
    total += value;
  }
  for (const value of Object.values(state.bossBlessings)) {
    total += value;
  }
  for (const skill of state.player.skills) {
    total += Number(skill.unlocked);
    total += skill.mastery;
  }
  return total;
}

function getUniqueUpgradeCount() {
  let total = 0;
  total += Object.keys(state.upgrades).length;
  total += Object.keys(state.bossBlessings).length;
  total += state.player.skills.filter((skill) => skill.unlocked).length;
  total += state.player.skills.filter((skill) => skill.mastery > 0).length;
  return total;
}

function renderResultStats() {
  const totalUpgradeStacks = getTotalUpgradeStacks();
  const uniqueUpgrades = getUniqueUpgradeCount();
  const killEntries = Object.entries(state.killBreakdown)
    .sort((a, b) => b[1] - a[1])
    .map(([type, count]) => {
      const profile = ENEMY_ARCHETYPES[type];
      const label = profile?.name ?? type.charAt(0).toUpperCase() + type.slice(1);
      const emoji = profile?.emoji ?? "";
      return `<div class="result-kill-row"><span class="result-kill-name">${emoji} ${label}</span><strong>${count}</strong></div>`;
    })
    .join("");

  resultStats.innerHTML = [
    `<div class="result-stat-grid">`,
    `<div class="result-stat-card"><span class="label">Time</span><strong>${formatTime(state.elapsed)}</strong></div>`,
    `<div class="result-stat-card"><span class="label">Total Kills</span><strong>${state.kills}</strong></div>`,
    `<div class="result-stat-card"><span class="label">Upgrade Stacks</span><strong>${totalUpgradeStacks}</strong></div>`,
    `<div class="result-stat-card"><span class="label">Unique Upgrades</span><strong>${uniqueUpgrades}</strong></div>`,
    `</div>`,
    `<div class="result-breakdown"><div class="result-breakdown-head"><span class="label">Kill Breakdown</span><strong>${state.kills}</strong></div>${killEntries || '<div class="result-kill-row"><span class="result-kill-name">No kills</span><strong>0</strong></div>'}</div>`,
  ].join("");
}

function createUpgradeMetaMarkup(option) {
  const milestoneMarkup = option.milestone
    ? `<span class="upgrade-family upgrade-family-ascendant">Ascendant</span>`
    : "";
  const familyMarkup = option.familyLabel
    ? `<span class="upgrade-family">${option.familyLabel}</span>`
    : "";

  return `<span class="upgrade-meta-row"><span class="upgrade-meta-left"><span class="upgrade-tier tier-${option.tier}">${option.tier}</span>${milestoneMarkup}${familyMarkup}</span><span class="upgrade-stacks">${getUpgradeStackLabel(option)}</span></span>`;
}

function createUpgradeChoiceMarkup(option, hotkeyLabel) {
  const categoryLabel = option.familyLabel || option.family || "Upgrade";
  return [
    `<span class="upgrade-hotkey">${hotkeyLabel}</span>`,
    `<span class="upgrade-choice-head"><span class="upgrade-stacks">${getUpgradeStackLabel(option)}</span><span></span></span>`,
    `<span class="upgrade-choice-main">`,
    `<span class="upgrade-icon">${option.icon}</span>`,
    `<span class="upgrade-category">${categoryLabel}</span>`,
    `<span class="upgrade-title">${option.title}</span>`,
    `<span class="upgrade-effect">${option.effectText}</span>`,
    `<span class="upgrade-description">${option.description}</span>`,
    `</span>`,
    `<span class="upgrade-choice-foot"><span class="upgrade-tier tier-${option.tier}">${option.tier}</span></span>`,
  ].join("");
}

function renderUpgradeButtons(options) {
  upgradeOptions.innerHTML = "";
  upgradeOptions.dataset.count = String(options.length);

  for (let index = 0; index < options.length; index += 1) {
    const option = options[index];
    const button = document.createElement("button");
    button.type = "button";
    button.className = "upgrade-button";
    button.dataset.upgradeIndex = String(index);
    button.dataset.tier = option.tier;
    button.innerHTML = createUpgradeChoiceMarkup(option, index + 1);

    upgradeOptions.appendChild(button);
  }
}

function retriggerLevelUpFlash() {
  levelUpFlash.classList.remove("play");
  void levelUpFlash.offsetWidth;
  levelUpFlash.classList.add("play");
}

function retriggerEnterAnimation(overlay, card) {
  overlay.classList.remove("play-enter");
  card.classList.remove("play-enter-card");
  void overlay.offsetWidth;
  overlay.classList.add("play-enter");
  card.classList.add("play-enter-card");
}

function retriggerValuePulse(element) {
  if (!element) {
    return;
  }
  element.classList.remove("value-pop");
  void element.offsetWidth;
  element.classList.add("value-pop");
}

function onUpgradeOptionClick(event) {
  const button = event.target.closest("button[data-upgrade-index]");
  if (!button) {
    return;
  }

  trySelectUpgradeByIndex(Number(button.dataset.upgradeIndex));
}

function onBossRewardOptionClick(event) {
  const button = event.target.closest("button[data-reward-index]");
  if (!button) {
    return;
  }

  trySelectBossRewardByIndex(Number(button.dataset.rewardIndex));
}

function onUpgradeRowClick(event) {
  if (!state.pause.devMenu) {
    return;
  }

  const row = event.target.closest("[data-upgrade-id]");
  if (!row) {
    return;
  }

  applyUpgradeById(row.dataset.upgradeId);
}

function applyUpgradeById(id) {
  const upgrade = ALL_UPGRADES_BY_ID.get(id);
  const blessing = BOSS_BLESSING_LIBRARY.find((entry) => entry.id === id);
  const classSkill = getClassDef().skills.find((skill) => skill.id === id);
  if (blessing) {
    const stacks = state.bossBlessings[id] ?? 0;
    if (stacks >= 1) {
      return false;
    }

    blessing.apply(state);
    state.bossBlessings[id] = 1;
    updateHud(true);
    refreshPauseOverlay();
    return true;
  }

  if (!upgrade) {
    if (classSkill) {
      const skillState = state.player.skills.find((entry) => entry.id === id);
      if (!skillState) {
        return false;
      }
      if (!skillState.unlocked) {
        skillState.unlocked = true;
        skillState.timer = Math.min(skillState.timer, skillState.cooldown * 0.55);
        skillState.unlockPulseTimer = Math.max(skillState.unlockPulseTimer, 0.9);
      } else if (skillState.mastery < 2) {
        skillState.mastery += 1;
        skillState.unlockPulseTimer = Math.max(skillState.unlockPulseTimer, 0.7);
      } else {
        return false;
      }
      updateHud(true);
      refreshPauseOverlay();
      return true;
    }
    return false;
  }

  const stacks = state.upgrades[id] ?? 0;
  if (upgrade.kind === "major") {
    const maxStacks = getMajorMaxStacks(id);
    if (maxStacks > 0 && stacks >= maxStacks) {
      return false;
    }
    if (!applyMajorUpgradeRank(id, state, stacks)) {
      return false;
    }
    state.upgrades[id] = stacks + 1;
    state.majorChoices[upgrade.pairId] = id;
    state.lastMajorPairId = upgrade.pairId;
    updateHud(true);
    refreshPauseOverlay();
    return true;
  }

  if (upgrade.maxStacks && stacks >= upgrade.maxStacks) {
    return false;
  }

  const effect = upgrade.effect(state, state.progression.level, stacks);
  if (!effect) {
    return false;
  }

  upgrade.apply(state, effect);
  state.upgrades[id] = stacks + 1;
  updateHud(true);
  refreshPauseOverlay();
  return true;
}

function trySelectUpgradeByIndex(index) {
  if (!state.levelUp.active) {
    return;
  }

  const option = state.levelUp.options[index];
  if (!option) {
    return;
  }

  applyUpgradeOption(option);
}

function applyUpgradeOption(option, config = {}) {
  const {
    skipLevelFx = false,
    deferNextOpen = false,
  } = config;
  const rewardLevel = state.levelUp.rewardLevel || state.progression.level;
  const rewardKind = state.levelUp.category || getLevelRewardKind(rewardLevel);
  const stacksBefore = state.upgrades[option.id] ?? 0;
  const applied = option.apply(state);
  if (applied === false) {
    return;
  }
  recordTelemetryReward(rewardKind, option, {
    rewardLevel,
    stacksBefore,
    stacksAfter: option.family !== "skill" && option.family !== "mastery" ? stacksBefore + 1 : stacksBefore,
  });
  if (option.family !== "skill" && option.family !== "mastery") {
    state.upgrades[option.id] = (state.upgrades[option.id] ?? 0) + 1;
  }
  if (!skipLevelFx) {
    spawnHolyLevelUpNova(state.player.x, state.player.y, state.progression.level);
  }

  if (option.family !== "skill" && option.family !== "mastery") {
    state.levelUp.recentIds.push(option.id);
    if (state.levelUp.recentIds.length > 5) {
      state.levelUp.recentIds.shift();
    }
  }

  state.progression.rewardQueue.shift();
  state.progression.pendingLevelUps = Math.max(0, state.progression.pendingLevelUps - 1);

  if (deferNextOpen) {
    updateHud(true);
    return;
  }

  if (state.progression.rewardQueue.length > 0) {
    if (state.dev.zenMode) {
      state.levelUp.active = false;
      levelUpOverlay.classList.add("hidden");
    } else {
      openLevelUpChoices();
    }
  } else {
    state.levelUp.active = false;
    levelUpOverlay.classList.add("hidden");
  }
  levelUpOverlay.classList.remove("is-ascendant");

  updateHud(true);
}

function openBossRewardChoices(enemy) {
  const pool = (BOSS_REWARD_POOLS[enemy.type] ?? []).filter((reward) => !(state.bossBlessings[reward.id] ?? 0));
  if (pool.length === 0) {
    startLevelUpPauseIfNeeded();
    return;
  }

  const options = pool.map((reward) => ({
    ...reward,
    tier: "legendary",
  }));

  state.bossReward.active = true;
  state.bossReward.bossType = enemy.type;
  state.bossReward.bossName = enemy.bossName;
  state.bossReward.options = options;
  pressedActions.clear();

  bossRewardCard.dataset.theme = enemy.type;
  bossRewardTitle.textContent = `${enemy.bossName} Legendary`;
  bossRewardSubtitle.textContent = "Choose one legendary blessing from the fallen boss.";
  renderBossRewardButtons(options);
  retriggerBossRewardFlash();
  bossRewardOverlay.classList.remove("hidden");
  retriggerEnterAnimation(bossRewardOverlay, bossRewardCard);
  updateHud(true);
}

function pickAutoBossRewardOption(options) {
  let best = options[0];
  for (const option of options.slice(1)) {
    if ((option.priority ?? 0) > (best.priority ?? 0)) {
      best = option;
    }
  }
  return best;
}

function renderBossRewardButtons(options) {
  bossRewardOptions.innerHTML = "";
  bossRewardOptions.dataset.count = String(options.length);

  for (let index = 0; index < options.length; index += 1) {
    const option = options[index];
    const button = document.createElement("button");
    button.type = "button";
    button.className = "upgrade-button boss-reward-button";
    button.dataset.rewardIndex = String(index);
    button.dataset.tier = "legendary";
    button.innerHTML = createUpgradeChoiceMarkup({
      icon: option.icon,
      title: option.title,
      effectText: option.effectText(),
      description: option.description,
      familyLabel: option.familyLabel,
      tier: "legendary",
      stacks: state.bossBlessings[option.id] ?? 0,
      maxStacks: 1,
    }, index + 1);

    bossRewardOptions.appendChild(button);
  }
}

function retriggerBossRewardFlash() {
  bossRewardFlash.classList.remove("play");
  void bossRewardFlash.offsetWidth;
  bossRewardFlash.classList.add("play");
}

function trySelectBossRewardByIndex(index) {
  if (!state.bossReward.active) {
    return;
  }

  const option = state.bossReward.options[index];
  if (!option) {
    return;
  }

  applyBossRewardOption(option);
}

function applyBossRewardOption(option) {
  option.apply(state);
  recordTelemetryReward("boss", option, {
    bossType: state.bossReward.bossType,
    bossName: state.bossReward.bossName,
  });
  state.bossBlessings[option.id] = (state.bossBlessings[option.id] ?? 0) + 1;
  state.bossReward.active = false;
  state.bossReward.bossType = null;
  state.bossReward.bossName = "";
  state.bossReward.options = [];
  bossRewardOverlay.classList.add("hidden");
  bossRewardCard.dataset.theme = "";
  updateHud(true);
  startLevelUpPauseIfNeeded();
}

function isPauseActive() {
  return state.pause.manual || state.pause.focus || state.pause.upgradesPanel || state.pause.devMenu;
}

function setPause(kind, value) {
  state.pause[kind] = value;
  if (value) {
    pressedActions.clear();
  }
  refreshPauseOverlay();
}

function clearPause() {
  state.pause.manual = false;
  state.pause.focus = false;
  state.pause.upgradesPanel = false;
  state.pause.devMenu = false;
  refreshPauseOverlay();
}

function refreshPauseOverlay() {
  const wasHidden = pauseOverlay.classList.contains("hidden");
  const visible = state.running && !state.levelUp.active && isPauseActive();
  pauseOverlay.classList.toggle("hidden", !visible);
  if (!visible) {
    return;
  }

  if (wasHidden) {
    pausePanel.scrollTop = 0;
    retriggerEnterAnimation(pauseOverlay, pausePanel);
  }

  renderDevToolsPanel();
  renderPauseMeta();
  renderUpgradesCodex();
  if (state.pause.devMenu) {
    menuKicker.classList.add("hidden");
    pauseTitle.textContent = "Developer Menu";
    pauseSubtitle.textContent = "Spawn bosses, toggle Zen Mode, or click any upgrade below to add a stack. Press ~ or Esc to resume.";
    return;
  }

  menuKicker.classList.remove("hidden");
  menuKicker.textContent = state.pause.upgradesPanel ? "Codex" : "Paused";
  pauseTitle.textContent = state.pause.upgradesPanel ? "Upgrade Codex" : "Paused";
  pauseSubtitle.textContent = state.pause.focus
    ? "Focus left the game, so the run is paused. Review your build and press Esc or Resume when you are ready."
    : "Review your build while the run is paused. Press Esc or Resume to continue.";
}

function toggleUpgradesPanel() {
  if (!state.running || state.levelUp.active || state.bossReward.active) {
    return;
  }

  if (state.pause.upgradesPanel) {
    closeUpgradesPanel();
    return;
  }

  state.pause.devMenu = false;
  state.pause.upgradesPanel = true;
  state.pause.manual = true;
  pressedActions.clear();
  refreshPauseOverlay();
}

function closeUpgradesPanel() {
  clearPause();
}

function toggleDevMenu() {
  if (!state.running || state.levelUp.active || state.bossReward.active) {
    return;
  }

  if (state.pause.devMenu) {
    clearPause();
    return;
  }

  state.pause.devMenu = true;
  state.pause.upgradesPanel = false;
  state.pause.manual = true;
  pressedActions.clear();
  refreshPauseOverlay();
}

function populateBossSpawnSelect() {
  bossSpawnSelect.innerHTML = "";
  const options = [{ value: "random", label: "Random Boss" }];
  for (const type of BOSS_TYPES) {
    options.push({ value: type, label: ENEMY_ARCHETYPES[type].name });
  }

  for (const entry of options) {
    const option = document.createElement("option");
    option.value = entry.value;
    option.textContent = entry.label;
    bossSpawnSelect.appendChild(option);
  }

  bossSpawnSelect.value = state.dev.bossChoice;
}

function renderDevToolsPanel() {
  devToolsPanel.classList.toggle("hidden", !state.pause.devMenu);
  pauseOverlay.classList.toggle("is-dev-mode", state.pause.devMenu);
  bossSpawnSelect.value = state.dev.bossChoice;
  zenModeStatus.textContent = state.dev.zenMode ? "Zen Mode On" : "Zen Mode Off";
  zenModeStatus.classList.toggle("is-on", state.dev.zenMode);
  zenModeButton.textContent = state.dev.zenMode ? "Disable Zen Mode" : "Enable Zen Mode";
  zenModeButton.classList.toggle("is-on", state.dev.zenMode);
}

function handleSpawnBossClick() {
  const type = state.dev.bossChoice === "random" ? chooseRandomBossType() : state.dev.bossChoice;
  if (!type) {
    return;
  }
  spawnBoss(type);
  updateHud(true);
  render();
}

function onClassCardClick(event) {
  const button = event.target.closest(".class-card");
  if (!button) {
    return;
  }
  const classId = button.dataset.classId;
  if (!metaProgress.unlocked[classId]) {
    return;
  }
  metaProgress.selectedClassId = classId;
  saveMetaProgress();
  renderStartOverlay();
}

function getUnlockProgressText(classId) {
  const requirement = CLASS_UNLOCK_REQUIREMENTS[classId];
  if (!requirement || !requirement.enemyType) {
    return "Unlocked by default.";
  }
  const xp = `${Math.min(requirement.xp, metaProgress.unlockState.xp)} / ${requirement.xp} XP`;
  const kills = `${Math.min(requirement.enemyKills, metaProgress.unlockState.kills)} / ${requirement.enemyKills} ${requirement.enemyType} kills`;
  return `${xp} - ${kills}`;
}

function formatEnemyTypeLabel(enemyType) {
  if (!enemyType) {
    return "";
  }
  return enemyType
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function buildUnlockEnemyMarkup(requirement) {
  if (!requirement?.enemyType) {
    return "";
  }
  const enemyProfile = ENEMY_ARCHETYPES[requirement.enemyType];
  const enemyEmoji = enemyProfile?.emoji ?? "\u2620\uFE0F";
  const currentKills = Math.min(requirement.enemyKills, metaProgress.unlockState.kills);
  return [
    `<div class="class-card-requirement">`,
    `<span class="class-card-requirement-icon">${enemyEmoji}</span>`,
    `<span class="class-card-requirement-text">Kill ${currentKills} / ${requirement.enemyKills} ${formatEnemyTypeLabel(requirement.enemyType)}</span>`,
    `</div>`,
  ].join("");
}

function renderStartOverlay() {
  classSelectGrid.innerHTML = "";
  const targetClassId = getCurrentUnlockTargetId(metaProgress);
  const visibleClassIds = CLASS_ORDER.slice();
  if (startSubtitle) {
    startSubtitle.textContent = targetClassId
      ? "Unlock classes in sequence. Only the next locked mage shows active requirements."
      : "All mage archives recovered. Choose any unlocked class.";
  }
  for (const classId of visibleClassIds) {
    const classDef = CLASS_DEFS[classId];
    const unlocked = Boolean(metaProgress.unlocked[classId]);
    const isCurrentTarget = classId === targetClassId;
    const selected = metaProgress.selectedClassId === classId;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "class-card";
    button.dataset.classId = classId;
    button.classList.toggle("is-selected", selected);
    button.classList.toggle("is-locked", !unlocked);
    const requirementMarkup = !unlocked && isCurrentTarget ? buildUnlockEnemyMarkup(CLASS_UNLOCK_REQUIREMENTS[classId]) : "";
    const lockedText = unlocked
      ? "Unlocked"
      : isCurrentTarget
        ? `Locked - ${getUnlockProgressText(classId)}`
        : "Locked - Unlock the previous class first";
    button.innerHTML = [
      `<div class="class-card-icon">${classDef.icon}</div>`,
      `<div class="class-card-title">${classDef.title}</div>`,
      `<div class="class-card-meta">${classDef.passiveText}</div>`,
      requirementMarkup,
      `<div class="class-card-lock">${lockedText}</div>`,
    ].join("");
    classSelectGrid.appendChild(button);
  }

  if (!targetClassId) {
    classProgressCard.innerHTML = `<div class="class-progress-head"><span class="class-progress-title">All classes unlocked</span><strong>Complete</strong></div><div class="class-progress-meta"><span class="class-progress-chip">All mage archives recovered.</span></div>`;
  } else {
    const requirement = CLASS_UNLOCK_REQUIREMENTS[targetClassId];
    const enemyProfile = requirement.enemyType ? ENEMY_ARCHETYPES[requirement.enemyType] : null;
    const enemyEmoji = enemyProfile?.emoji ?? "\u2620\uFE0F";
    classProgressCard.innerHTML = [
      `<div class="class-progress-head"><span class="class-progress-title">Next unlock: ${CLASS_DEFS[targetClassId].title}</span><strong>${CLASS_DEFS[targetClassId].icon}</strong></div>`,
      `<div class="class-progress-meta">`,
      `<span class="class-progress-chip">XP ${Math.min(metaProgress.unlockState.xp, requirement.xp)} / ${requirement.xp}</span>`,
      `<span class="class-progress-chip">${enemyEmoji} ${formatEnemyTypeLabel(requirement.enemyType)} ${Math.min(metaProgress.unlockState.kills, requirement.enemyKills)} / ${requirement.enemyKills}</span>`,
      `<span class="class-progress-chip">Runs ${metaProgress.lifetime.runs}</span>`,
      `</div>`,
    ].join("");
  }

  startRunButton.textContent = `Start ${CLASS_DEFS[metaProgress.selectedClassId].title}`;
  startOverlay.classList.toggle("hidden", state.running);
}

function startRun() {
  state = createInitialState(metaProgress.selectedClassId);
  state.running = true;
  startOverlay.classList.add("hidden");
  updateHud(true);
  render();
}

function chooseRandomBossType() {
  return pickRandomBossType(state.elapsed);
}

function toggleZenMode() {
  setZenMode(!state.dev.zenMode);
}

function setZenMode(enabled) {
  state.dev.zenMode = enabled;
  if (enabled) {
    state.player.hp = state.player.maxHp;
    state.player.dash.maxCharges = 5;
    state.player.dash.charges = 5;
    state.player.dash.rechargeTimer = 0;
  }
  if (enabled && (state.progression.pendingLevelUps > 0 || state.levelUp.active)) {
    autoResolvePendingLevelUps();
  }
  updateHud(true);
  refreshPauseOverlay();
}

function renderPauseMeta() {
  const items = [
    { label: "Class", value: getClassDef().title },
    { label: "Time", value: formatTime(state.elapsed) },
    { label: "Level", value: state.progression.level },
    { label: "Kills", value: state.kills },
    { label: "HP", value: `${Math.round(state.player.hp)} / ${state.player.maxHp}` },
    { label: "XP", value: `${Math.floor(state.progression.xp)} / ${state.progression.xpToNext}` },
  ];

  if (state.dev.zenMode) {
    items.push({ label: "Zen", value: "Immortal" });
  }

  pauseMeta.innerHTML = items
    .map((item) => `<span class="pause-meta-item">${item.label} <strong>${item.value}</strong></span>`)
    .join("");
}

function compareCodexEntries(a, b) {
  return (TIER_ORDER[a.tier] ?? 99) - (TIER_ORDER[b.tier] ?? 99)
    || a.title.localeCompare(b.title)
    || a.id.localeCompare(b.id);
}

function renderCodexSection(entries, clickableInDev, title = "", kicker = "", preserveOrder = false) {
  const section = document.createElement("section");
  section.className = "upgrade-group";

  if (title) {
    const heading = document.createElement("div");
    heading.className = "upgrade-group-head";
    heading.innerHTML = `${kicker ? `<span class="upgrade-group-kicker">${kicker}</span>` : ""}<strong>${title}</strong>`;
    section.appendChild(heading);
  }

  const list = document.createElement("div");
  list.className = "upgrade-group-list";

  const orderedEntries = preserveOrder ? entries : [...entries].sort(compareCodexEntries);
  for (const entry of orderedEntries) {
    const row = document.createElement(clickableInDev ? "button" : "div");
    row.className = "upgrade-row";
    row.dataset.upgradeId = entry.id;

    if (clickableInDev) {
      row.type = "button";
      row.classList.add("is-dev-action");
    }
    if (entry.isMaxed) {
      row.classList.add("is-maxed");
    }
    if (entry.stacks > 0) {
      row.classList.add("has-stack");
    }
    if (entry.locked) {
      row.classList.add("locked");
    }

    const clickHint = clickableInDev && !entry.isMaxed ? " - Click to add" : "";
    const statusPrefix = entry.locked ? "&#128274; " : entry.isMaxed ? "&#10003; " : "";

    row.innerHTML = [
      `<div class="upgrade-row-icon">${entry.icon}</div>`,
      `<div class="upgrade-row-body">${createUpgradeMetaMarkup({
        tier: entry.tier,
        familyLabel: entry.familyLabel,
        stacks: entry.stacks,
        maxStacks: entry.maxStacks,
      })}<div class="upgrade-row-title">${entry.title}</div><div class="upgrade-row-meta">${entry.description}</div><div class="upgrade-row-lock">${statusPrefix}${entry.status}${clickHint}</div></div>`,
    ].join("");

    list.appendChild(row);
  }

  section.appendChild(list);
  upgradesList.appendChild(section);
}

function renderUpgradesCodex() {
  upgradesList.innerHTML = "";
  const clickableInDev = state.pause.devMenu;
  const ordinaryEntries = MINOR_UPGRADES.map((upgrade) => {
    const stacks = state.upgrades[upgrade.id] ?? 0;
    const locked = !clickableInDev && state.progression.level < upgrade.minLevel;
    const isMaxed = Boolean(upgrade.maxStacks && stacks >= upgrade.maxStacks);
    return {
      id: upgrade.id,
      icon: upgrade.icon,
      title: upgrade.title,
      description: upgrade.description,
      tier: upgrade.tier,
      familyLabel: upgrade.familyLabel,
      stacks,
      maxStacks: upgrade.maxStacks ?? null,
      locked,
      isMaxed,
      status: clickableInDev
        ? isMaxed
          ? "Maxed"
          : "Available"
        : getUpgradeCodexStatus(upgrade, stacks),
    };
  });

  renderCodexSection(ordinaryEntries, clickableInDev);

  const majorEntries = MAJOR_UPGRADE_PAIRS.flatMap((pair) => [pair.left, pair.right]).map((entry) => {
    const pairId = MAJOR_ENTRY_TO_PAIR_ID.get(entry.id);
    const selectedId = pairId ? state.majorChoices[pairId] : null;
    const stacks = state.upgrades[entry.id] ?? 0;
    const maxStacks = getMajorMaxStacks(entry.id);
    const isChosen = selectedId === entry.id || stacks > 0;
    const isMaxed = maxStacks > 0 && stacks >= maxStacks;
    return {
      id: entry.id,
      icon: entry.icon,
      title: entry.title,
      description: entry.description,
      tier: "rare",
      familyLabel: entry.familyLabel,
      stacks,
      maxStacks,
      locked: false,
      isMaxed,
      status: isMaxed
        ? "Maxed"
        : stacks > 0
          ? `Rank ${stacks}/${maxStacks}`
          : "Available at milestone levels",
      effectText: getMajorEffectText(entry.id, stacks),
    };
  });

  renderCodexSection(majorEntries, clickableInDev, "Major Upgrades", "Major");

  const classDef = getClassDef();
  const skillEntries = classDef.skills.map((skill) => {
    const skillState = state.player.skills.find((entry) => entry.id === skill.id);
    const unlockLevel = classDef.skillUnlocks[skill.slot - 1];
    return {
      id: skill.id,
      icon: skill.icon,
      title: skill.title,
      description: `${skill.role} slot. ${skill.targeting} targeting.`,
      tier: skillState?.mastery > 0 ? "legendary" : "uncommon",
      familyLabel: `Slot ${skill.slot}`,
      stacks: skillState?.mastery ?? 0,
      maxStacks: 2,
      locked: !clickableInDev && !(skillState?.unlocked),
      isMaxed: (skillState?.mastery ?? 0) >= 2,
      status: clickableInDev
        ? !(skillState?.unlocked)
          ? "Available"
          : (skillState?.mastery ?? 0) >= 2
            ? "Maxed"
            : "Available"
        : skillState?.unlocked
          ? `Unlocked - Mastery ${skillState.mastery}/2`
          : `Unlocks at level ${unlockLevel}`,
    };
  });

  renderCodexSection(skillEntries, clickableInDev, `${classDef.title} Skills`, "Class", true);

  for (const bossType of BOSS_TYPES) {
    if (!state.bossSeen[bossType]) {
      continue;
    }

    const bossName = ENEMY_ARCHETYPES[bossType].name;
    const entries = BOSS_BLESSING_LIBRARY
      .filter((blessing) => blessing.bossType === bossType)
      .map((blessing) => {
        const stacks = state.bossBlessings[blessing.id] ?? 0;
        const isMaxed = stacks >= 1;
        return {
          id: blessing.id,
          icon: blessing.icon,
          title: blessing.title,
          description: blessing.description,
          tier: "legendary",
          familyLabel: blessing.familyLabel,
          stacks,
          maxStacks: 1,
          locked: false,
          isMaxed,
          status: clickableInDev
            ? isMaxed
              ? "Maxed"
              : "Available"
            : isMaxed
              ? "Chosen Legendary"
              : "Boss Reward",
        };
      });

    if (entries.length > 0) {
      renderCodexSection(entries, clickableInDev, bossName, "Legendary");
    }
  }
}

function render() {
  drawBackground();
  drawEffects("base");
  drawEffects("top");
  drawPickups();
  drawProjectiles();
  drawEnemyAttacks();
  drawAllies();
  drawEnemies();
  drawDamageNumbers();
  drawBossIndicator();
  drawPlayer();
  drawScreenVignette();
}

function drawBackground() {
  ctx.clearRect(0, 0, viewWidth, viewHeight);
  ctx.fillStyle = "#000000";
  ctx.fillRect(0, 0, viewWidth, viewHeight);

  const worldTopLeft = worldToScreen(WORLD.left, WORLD.top);
  const zoom = getCameraZoom();
  const worldWidth = (WORLD.right - WORLD.left) / zoom;
  const worldHeight = (WORLD.bottom - WORLD.top) / zoom;

  ctx.save();
  ctx.beginPath();
  ctx.rect(worldTopLeft.x, worldTopLeft.y, worldWidth, worldHeight);
  ctx.clip();

  ctx.fillStyle = "#0f1a15";
  ctx.fillRect(0, 0, viewWidth, viewHeight);

  const tileSize = TERRAIN_TILE_SIZE;
  const halfWorldViewWidth = viewWidth * 0.5 * zoom;
  const halfWorldViewHeight = viewHeight * 0.5 * zoom;
  const renderPaddingTiles = 8 + Math.ceil(Math.max(0, zoom - 1) * 20);
  const renderPadding = tileSize * renderPaddingTiles;
  const startWorldX = Math.floor((state.player.x - halfWorldViewWidth) / tileSize) * tileSize - renderPadding;
  const startWorldY = Math.floor((state.player.y - halfWorldViewHeight) / tileSize) * tileSize - renderPadding;
  const endWorldX = Math.ceil((state.player.x + halfWorldViewWidth) / tileSize) * tileSize + renderPadding;
  const endWorldY = Math.ceil((state.player.y + halfWorldViewHeight) / tileSize) * tileSize + renderPadding;

  for (let worldY = startWorldY; worldY <= endWorldY; worldY += tileSize) {
    for (let worldX = startWorldX; worldX <= endWorldX; worldX += tileSize) {
      const screen = worldToScreen(worldX, worldY);
      const terrain = sampleTerrainTile(worldX + tileSize * 0.5, worldY + tileSize * 0.5);
      ctx.fillStyle = terrain.fill;
      const drawSize = Math.ceil(tileSize / zoom) + 1;
      ctx.fillRect(Math.floor(screen.x), Math.floor(screen.y), drawSize, drawSize);

      if (terrain.speckAlpha > 0.03) {
        ctx.fillStyle = tintAlpha(terrain.speckColor, terrain.speckAlpha);
        ctx.fillRect(
          Math.floor(screen.x + terrain.speckX / zoom),
          Math.floor(screen.y + terrain.speckY / zoom),
          Math.max(1, Math.ceil(terrain.speckSize / zoom)),
          Math.max(1, Math.ceil(terrain.speckSize / zoom))
        );
      }
    }
  }

  drawWorldFeatures(startWorldX, startWorldY, endWorldX, endWorldY);

  ctx.restore();

  ctx.strokeStyle = "rgba(255, 255, 255, 0.22)";
  ctx.lineWidth = 2;
  ctx.strokeRect(worldTopLeft.x + 0.5, worldTopLeft.y + 0.5, worldWidth, worldHeight);
}

function drawWorldFeatures(minX, minY, maxX, maxY) {
  const features = [];
  iterateWorldFeaturesInBounds(minX, minY, maxX, maxY, (feature) => {
    features.push(feature);
  });

  for (const feature of features) {
    if (feature.group !== "solid") {
      continue;
    }
    drawSolidFeature(feature);
  }
}

function drawSolidFeature(feature) {
  drawRockFeature(feature);
}

function drawRockFeature(feature) {
  ctx.save();
  for (const block of feature.blocks ?? []) {
    const topLeft = worldToScreen(block.x - block.w * 0.5, block.y - block.h * 0.5);
    const width = Math.max(2, block.w / getCameraZoom());
    const height = Math.max(2, block.h / getCameraZoom());

    ctx.fillStyle = "rgba(14, 18, 23, 0.22)";
    ctx.fillRect(topLeft.x + 4, topLeft.y + 6, width, height);

    const gradient = ctx.createLinearGradient(topLeft.x, topLeft.y, topLeft.x + width, topLeft.y + height);
    gradient.addColorStop(0, "rgba(137, 152, 160, 0.98)");
    gradient.addColorStop(0.34, "rgba(102, 117, 125, 0.98)");
    gradient.addColorStop(1, "rgba(67, 79, 88, 0.99)");
    ctx.fillStyle = gradient;
    ctx.fillRect(topLeft.x, topLeft.y, width, height);

    ctx.strokeStyle = "rgba(219, 228, 232, 0.16)";
    ctx.lineWidth = Math.max(1, width * 0.03);
    ctx.strokeRect(topLeft.x + 0.5, topLeft.y + 0.5, Math.max(1, width - 1), Math.max(1, height - 1));
  }
  ctx.restore();
}

function drawProjectiles() {
  const fxTier = getFxTier();
  for (const projectile of state.projectiles) {
    const pos = worldToScreen(projectile.x, projectile.y);
    if (!isVisible(pos.x, pos.y, 22)) {
      continue;
    }

    const speed = Math.hypot(projectile.vx, projectile.vy) || 1;
    const tailX = (projectile.vx / speed) * 14;
    const tailY = (projectile.vy / speed) * 14;
    const projectileRgb = projectile.rgb ?? "255, 255, 255";
    const projectileColor = projectile.color ?? "#ffffff";
    const accentColor = projectile.accentColor ?? projectileColor;
    const accentRgb = projectile.accentRgb ?? projectileRgb;
    const renderRadius = projectile.renderRadius ?? projectile.radius;

    ctx.save();
    if (projectile.skillType === "crystal-spear") {
      drawGradientTrail(pos.x, pos.y, tailX * 2.8, tailY * 2.8, renderRadius * 0.64, accentRgb, 0.92);
      const angle = Math.atan2(projectile.vy, projectile.vx);
      ctx.translate(pos.x, pos.y);
      ctx.rotate(angle);
      const spearGradient = ctx.createLinearGradient(-renderRadius * 1.4, 0, renderRadius * 1.5, 0);
      spearGradient.addColorStop(0, `rgba(${accentRgb}, 0)`);
      spearGradient.addColorStop(0.28, `rgba(${accentRgb}, 0.16)`);
      spearGradient.addColorStop(0.78, projectileColor);
      spearGradient.addColorStop(1, `rgba(${accentRgb}, 0.88)`);
      ctx.fillStyle = spearGradient;
      ctx.shadowBlur = fxTier >= 1 ? 16 : 24;
      ctx.shadowColor = tintAlpha(accentColor, 0.42);
      ctx.beginPath();
      ctx.moveTo(renderRadius * 1.45, 0);
      ctx.lineTo(-renderRadius * 0.28, -renderRadius * 0.5);
      ctx.lineTo(-renderRadius * 1.1, 0);
      ctx.lineTo(-renderRadius * 0.28, renderRadius * 0.5);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = `rgba(${accentRgb}, 0.22)`;
      ctx.beginPath();
      ctx.moveTo(renderRadius * 0.24, -renderRadius * 1.08);
      ctx.lineTo(-renderRadius * 0.34, -renderRadius * 0.2);
      ctx.lineTo(renderRadius * 0.56, -renderRadius * 0.1);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(renderRadius * 0.24, renderRadius * 1.08);
      ctx.lineTo(-renderRadius * 0.34, renderRadius * 0.2);
      ctx.lineTo(renderRadius * 0.56, renderRadius * 0.1);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = `rgba(${accentRgb}, 0.7)`;
      ctx.beginPath();
      ctx.arc(renderRadius * 0.44, 0, renderRadius * 0.16, 0, Math.PI * 2);
      ctx.fill();
    } else {
      drawGradientTrail(pos.x, pos.y, tailX, tailY, renderRadius * 1.3, projectileRgb, 0.94);

      ctx.shadowBlur = fxTier >= 1 ? 12 : 20;
      ctx.shadowColor = tintAlpha(projectileColor, 0.62);
      ctx.fillStyle = projectileColor;
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, renderRadius, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}

function drawGradientTrail(headX, headY, tailX, tailY, width, rgb, headAlpha = 0.92) {
  ctx.lineCap = "round";
  const trail = ctx.createLinearGradient(headX - tailX, headY - tailY, headX, headY);
  trail.addColorStop(0, `rgba(${rgb}, 0)`);
  trail.addColorStop(0.52, `rgba(${rgb}, ${Math.max(0.12, headAlpha * 0.26).toFixed(3)})`);
  trail.addColorStop(1, `rgba(${rgb}, ${headAlpha.toFixed(3)})`);
  ctx.strokeStyle = trail;
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.moveTo(headX - tailX, headY - tailY);
  ctx.lineTo(headX, headY);
  ctx.stroke();
}

function drawEnemyAttacks() {
  ctx.save();

  for (const attack of state.enemyAttacks) {
    if (attack.dead) {
      continue;
    }

    const pos = worldToScreen(attack.x, attack.y);
    if (!isVisible(pos.x, pos.y, (attack.radius ?? attack.maxRadius ?? 24) + 30)) {
      continue;
    }

    if (attack.kind === "projectile") {
      const speed = Math.hypot(attack.vx, attack.vy) || 1;
      const tailX = (attack.vx / speed) * 18;
      const tailY = (attack.vy / speed) * 18;
      ctx.save();
      const color = parseColorComponents(attack.color.startsWith("rgba") ? attack.color.replace("{a}", "1") : attack.color);
      drawGradientTrail(pos.x, pos.y, tailX, tailY, attack.radius * 1.25, `${color.r}, ${color.g}, ${color.b}`, 0.88);
      ctx.shadowBlur = 18;
      ctx.shadowColor = tintAlpha(attack.color, 0.42);
      ctx.fillStyle = tintAlpha(attack.color, 0.9);
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, attack.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      continue;
    }

    if (attack.kind === "beam") {
      const end = worldToScreen(attack.x2, attack.y2);
      if (attack.telegraphTime > 0) {
        const telegraphRatio = 1 - attack.telegraphTime / attack.maxTelegraphTime;
        ctx.save();
        ctx.strokeStyle = tintAlpha(attack.color, 0.18 + telegraphRatio * 0.32);
        ctx.lineWidth = attack.width * 0.45;
        ctx.setLineDash([16, 10]);
        ctx.beginPath();
        ctx.moveTo(pos.x, pos.y);
        ctx.lineTo(end.x, end.y);
        ctx.stroke();
        ctx.restore();
        continue;
      }

      ctx.save();
      ctx.strokeStyle = tintAlpha(attack.color, 0.88);
      ctx.lineWidth = attack.width;
      ctx.shadowBlur = 18;
      ctx.shadowColor = tintAlpha(attack.color, 0.35);
      ctx.beginPath();
      ctx.moveTo(pos.x, pos.y);
      ctx.lineTo(end.x, end.y);
      ctx.stroke();
      ctx.restore();
      continue;
    }

    if (attack.telegraphTime > 0) {
      const telegraphRatio = 1 - attack.telegraphTime / attack.maxTelegraphTime;
      ctx.save();
      ctx.strokeStyle = tintAlpha(attack.color, 0.2 + telegraphRatio * 0.35);
      ctx.lineWidth = 2;
      ctx.setLineDash([8, 8]);
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, attack.radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
      continue;
    }

    if (attack.kind === "shockwave") {
      ctx.save();
      ctx.strokeStyle = tintAlpha(attack.color, 0.58);
      ctx.lineWidth = attack.thickness;
      ctx.shadowBlur = 16;
      ctx.shadowColor = tintAlpha(attack.color, 0.3);
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, attack.currentRadius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
      continue;
    }

    ctx.save();
    ctx.fillStyle = tintAlpha(attack.color, 0.24);
    ctx.shadowBlur = 12;
    ctx.shadowColor = tintAlpha(attack.color, 0.3);
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, attack.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  ctx.restore();
}

function getEffectVisibilityPadding(effect) {
  if (Number.isFinite(effect.size)) {
    return effect.size + 20;
  }
  if (Number.isFinite(effect.radius)) {
    return effect.radius + 24;
  }
  if (Number.isFinite(effect.length) || Number.isFinite(effect.width)) {
    return Math.max(effect.length ?? 0, effect.width ?? 0) * 0.6 + 28;
  }
  if (Number.isFinite(effect.lineWidth)) {
    return effect.lineWidth + 24;
  }
  return 48;
}

const SOFT_SKILL_EFFECT_KINDS = new Set([
  "gale-ring",
  "blizzard-wake",
  "cinder-halo",
  "vein-burst",
  "sunspot",
  "requiem-field",
  "crimson-pool",
  "tempest-node",
  "permafrost-seal",
  "ash-comet",
  "blood-rite",
  "crosswind-strip",
  "bone-ward",
  "grave-call",
]);

const WIND_EFFECT_KINDS = new Set(["gale-ring", "crosswind-strip", "tempest-node"]);
const FROST_EFFECT_KINDS = new Set(["blizzard-wake", "permafrost-seal", "crystal-spear"]);
const FIRE_EFFECT_KINDS = new Set(["cinder-halo", "sunspot", "ash-comet"]);
const NECRO_EFFECT_KINDS = new Set(["bone-ward", "requiem-field", "grave-call"]);
const BLOOD_EFFECT_KINDS = new Set(["vein-burst", "crimson-pool", "blood-rite"]);

function hasUnlimitedSkillCooldowns() {
  return state.dev.manualSkillMode && state.dev.zeroSkillCooldown;
}

function getEffectEnvelope(effect, lifeRatio) {
  if (effect.inFadeTail) {
    const tailLifeRatio = clamp(lifeRatio, 0, 1);
    const alpha = (effect.tailAlphaStart ?? 0.08) * easeOutQuad(tailLifeRatio);
    const scale = lerp(
      effect.tailStartScale ?? 1,
      effect.tailEndScale ?? 0.96,
      1 - tailLifeRatio
    );
    return {
      progress: effect.tailCarryProgress ?? 1,
      enter: 1,
      exit: alpha,
      alpha,
      scale,
    };
  }
  const progress = clamp(1 - lifeRatio, 0, 1);
  const fadeInRatio = effect.fadeInRatio ?? 0.18;
  const fadeOutRatio = effect.fadeOutRatio ?? 0.34;
  const enter = easeOutQuad(clamp(progress / fadeInRatio, 0, 1));
  const exit = easeOutQuad(clamp(lifeRatio / fadeOutRatio, 0, 1));
  const alpha = enter * exit;
  const scale = lerp(effect.startScale ?? 0.9, 1, enter) * lerp(effect.endScale ?? 0.94, 1, exit);
  return { progress, enter, exit, alpha, scale };
}

function shouldUseFadeTail(effect) {
  // Soft spell VFX now resolve entirely inside their main fade envelope.
  // The previous tail phase caused a visible second "pop" near the end.
  return false;
}

function beginEffectFadeTail(effect) {
  if (effect.inFadeTail || !shouldUseFadeTail(effect)) {
    return false;
  }
  effect.inFadeTail = true;
  effect.life = effect.tailLife ?? 0.26;
  effect.maxLife = effect.life;
  effect.tailCarryProgress = effect.lastEnvelopeProgress ?? 1;
  effect.tailStartScale = effect.lastEnvelopeScale ?? effect.tailStartScale ?? 1;
  effect.tailEndScale = effect.tailEndScale ?? Math.max(0.88, (effect.tailStartScale ?? 1) - 0.06);
  effect.tailAlphaStart = Math.min(
    effect.tailAlphaStart ?? 0.08,
    Math.max(0.01, (effect.lastEnvelopeAlpha ?? 0.04) * 0.72)
  );
  effect.tickTimer = Infinity;
  effect.damage = 0;
  effect.interval = Infinity;
  if (effect.hitIds) {
    effect.hitIds.clear();
  }
  return true;
}

function getCrosswindMetrics(effect, lifeRatio) {
  const envelope = getEffectEnvelope(effect, lifeRatio);
  const deploy = easeOutCubic(clamp(envelope.progress / (effect.deployRatio ?? 0.26), 0, 1));
  const currentLength = effect.length * (0.08 + deploy * 0.92);
  const currentWidth = effect.width * (0.42 + deploy * 0.58) * envelope.scale;
  const originX = effect.originX ?? (effect.x - Math.cos(effect.angle) * currentLength * 0.5);
  const originY = effect.originY ?? (effect.y - Math.sin(effect.angle) * currentLength * 0.5);
  const centerX = originX + Math.cos(effect.angle) * currentLength * 0.5;
  const centerY = originY + Math.sin(effect.angle) * currentLength * 0.5;
  return { envelope, deploy, currentLength, currentWidth, centerX, centerY };
}

function withComposite(mode, drawFn) {
  ctx.save();
  ctx.globalCompositeOperation = mode;
  drawFn();
  ctx.restore();
}

function buildRadialGradient(x, y, innerRadius, outerRadius, stops) {
  const gradient = ctx.createRadialGradient(x, y, innerRadius, x, y, outerRadius);
  for (const [offset, color] of stops) {
    gradient.addColorStop(offset, color);
  }
  return gradient;
}

function fillGradientDisc(x, y, radius, stops, composite = "source-over") {
  withComposite(composite, () => {
    ctx.fillStyle = buildRadialGradient(x, y, 0, radius, stops);
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
  });
}

function getSoftEffectProfile(kind) {
  if (WIND_EFFECT_KINDS.has(kind)) {
    return {
      discScale: 0.58,
      ringInnerScale: 0.5,
      ringOuterScale: 0.92,
      coreScale: 0.16,
      baseAlpha: 1.77,
      ringAlpha: 2.08,
      coreAlpha: 1.35,
      opacityBoost: 2.38,
    };
  }
  if (FROST_EFFECT_KINDS.has(kind)) {
    return {
      discScale: 0.74,
      ringInnerScale: 0.58,
      ringOuterScale: 0.96,
      coreScale: 0.14,
      baseAlpha: 1.87,
      ringAlpha: 2.2,
      coreAlpha: 1.32,
      opacityBoost: 2.49,
    };
  }
  if (FIRE_EFFECT_KINDS.has(kind)) {
    return {
      discScale: 0.76,
      ringInnerScale: 0.54,
      ringOuterScale: 0.98,
      coreScale: 0.22,
      baseAlpha: 1.95,
      ringAlpha: 2.28,
      coreAlpha: 1.63,
      opacityBoost: 2.46,
    };
  }
  if (NECRO_EFFECT_KINDS.has(kind)) {
    return {
      discScale: 0.66,
      ringInnerScale: 0.48,
      ringOuterScale: 0.9,
      coreScale: 0.12,
      baseAlpha: 1.7,
      ringAlpha: 1.96,
      coreAlpha: 1.21,
      opacityBoost: 2.31,
    };
  }
  if (BLOOD_EFFECT_KINDS.has(kind)) {
    return {
      discScale: 0.72,
      ringInnerScale: 0.52,
      ringOuterScale: 0.93,
      coreScale: 0.16,
      baseAlpha: 1.79,
      ringAlpha: 2.03,
      coreAlpha: 1.35,
      opacityBoost: 2.35,
    };
  }
  return {
    discScale: 0.72,
    ringInnerScale: 0.56,
    ringOuterScale: 0.94,
    coreScale: 0.18,
    baseAlpha: 1.57,
    ringAlpha: 1.81,
    coreAlpha: 1.16,
    opacityBoost: 2.13,
  };
}

function fillGradientRing(x, y, innerRadius, outerRadius, stops, composite = "source-over") {
  withComposite(composite, () => {
    ctx.fillStyle = buildRadialGradient(x, y, innerRadius, outerRadius, stops);
    ctx.beginPath();
    ctx.arc(x, y, outerRadius, 0, Math.PI * 2);
    ctx.arc(x, y, innerRadius, 0, Math.PI * 2, true);
    ctx.fill("evenodd");
  });
}

function drawSoftBurstParticle(x, y, radius, innerColor, outerColor, composite = "screen") {
  withComposite(composite, () => {
    ctx.filter = `blur(${Math.max(1.8, radius * 0.34).toFixed(2)}px)`;
    const mote = ctx.createRadialGradient(x, y, 0, x, y, radius);
    mote.addColorStop(0, innerColor);
    mote.addColorStop(0.42, innerColor);
    mote.addColorStop(1, outerColor);
    ctx.fillStyle = mote;
    ctx.shadowBlur = Math.max(8, radius * 1.4);
    ctx.shadowColor = innerColor;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
  });
}

function drawGradientStroke(x1, y1, x2, y2, width, stops, composite = "source-over") {
  withComposite(composite, () => {
    const gradient = ctx.createLinearGradient(x1, y1, x2, y2);
    for (const [offset, color] of stops) {
      gradient.addColorStop(offset, color);
    }
    ctx.strokeStyle = gradient;
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  });
}

function drawEffects(layer = "base") {
  ctx.save();
  const fxTier = getFxTier();

  for (const effect of state.effects) {
    const effectLayer = effect.renderLayer ?? "base";
    if (effectLayer !== layer) {
      continue;
    }
    const pos = worldToScreen(effect.x, effect.y);
    if (!isVisible(pos.x, pos.y, getEffectVisibilityPadding(effect))) {
      continue;
    }

    const lifeRatio = clamp(effect.life / effect.maxLife, 0, 1);

    if (effect.kind === "line") {
      if (fxTier >= 2) {
        continue;
      }
      const end = worldToScreen(effect.x2, effect.y2);
      withComposite("screen", () => {
        ctx.strokeStyle = tintAlpha(effect.color, 0.15 + lifeRatio * 0.3);
        ctx.lineWidth = effect.lineWidth * Math.max(0.4, lifeRatio);
        ctx.shadowBlur = fxTier >= 1 ? 6 : 12;
        ctx.shadowColor = tintAlpha(effect.color, 0.26);
        ctx.beginPath();
        ctx.moveTo(pos.x, pos.y);
        ctx.lineTo(end.x, end.y);
        ctx.stroke();
      });
      continue;
    }

    if (effect.kind === "ring") {
      const radius = effect.size + (1 - lifeRatio) * effect.growth;
      withComposite("screen", () => {
        ctx.strokeStyle = tintAlpha(effect.color, 0.24 + lifeRatio * 0.46);
        ctx.lineWidth = Math.max(1.2, effect.lineWidth * lifeRatio);
        ctx.shadowBlur = fxTier >= 1 ? 8 : 14;
        ctx.shadowColor = tintAlpha(effect.color, 0.42);
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, radius, 0, Math.PI * 2);
        ctx.stroke();
      });
      continue;
    }

    if (SOFT_SKILL_EFFECT_KINDS.has(effect.kind) && effect.kind !== "crosswind-strip" && effect.kind !== "bone-ward") {
      const envelope = getEffectEnvelope(effect, lifeRatio);
      effect.lastEnvelopeAlpha = envelope.alpha;
      effect.lastEnvelopeScale = envelope.scale;
      effect.lastEnvelopeProgress = envelope.progress;
      const radius = (effect.radius ?? effect.size) * envelope.scale;
      const palette = resolveEffectPalette(effect);
      const primary = effect.color;
      const secondary = effect.secondaryColor ?? effect.color;
      const profile = getSoftEffectProfile(effect.kind);
      envelope.alpha = Math.min(2.26, envelope.alpha * (profile.opacityBoost ?? 2.06));
      fillGradientDisc(
        pos.x,
        pos.y,
        radius * profile.discScale,
        [
          [0, palette.dark((0.06 + envelope.alpha * 0.06) * profile.baseAlpha)],
          [0.18, palette.primary((0.1 + envelope.alpha * 0.12) * profile.baseAlpha)],
          [0.54, palette.tertiary((0.12 + envelope.alpha * 0.14) * profile.baseAlpha)],
          [1, palette.secondary(0)],
        ]
      );
      fillGradientRing(
        pos.x,
        pos.y,
        radius * profile.ringInnerScale,
        radius * profile.ringOuterScale,
        [
          [0, palette.secondary(0)],
          [0.28, palette.secondary((0.08 + envelope.alpha * 0.12) * profile.ringAlpha)],
          [0.58, palette.tertiary((0.12 + envelope.alpha * 0.18) * profile.ringAlpha)],
          [0.84, palette.secondary((0.08 + envelope.alpha * 0.12) * profile.ringAlpha)],
          [1, palette.secondary(0)],
        ],
        "screen"
      );
      fillGradientDisc(
        pos.x,
        pos.y,
        radius * profile.coreScale,
        [
          [0, palette.light((0.08 + envelope.alpha * 0.08) * profile.coreAlpha)],
          [0.54, palette.primary((0.12 + envelope.alpha * 0.1) * profile.coreAlpha)],
          [1, palette.secondary(0)],
        ],
        "screen"
      );

      if (fxTier < 2) {
        const moteCount = effect.kind === "tempest-node" || effect.kind === "ash-comet" || effect.kind === "grave-call" ? 6 : 4;
        for (let i = 0; i < moteCount; i += 1) {
          const angle = state.elapsed * (0.7 + i * 0.08) + i * (Math.PI * 2 / moteCount);
          const orbit = radius * (0.22 + ((i % 3) * 0.17));
          const mx = pos.x + Math.cos(angle) * orbit;
          const my = pos.y + Math.sin(angle * 1.15) * orbit;
          drawSoftBurstParticle(
            mx,
            my,
            8 + (i % 2) * 3,
            colorWithAlpha(shadeColor(primary.includes("{a}") ? primary.replace("{a}", "1") : primary, 0.22), 0.1 + envelope.alpha * 0.14),
            tintAlpha(i % 2 === 0 ? secondary : primary, 0),
            "screen"
          );
        }
      }

      if (effect.kind === "gale-ring") {
        for (let i = 0; i < 3; i += 1) {
          const arcRadius = radius * (0.54 + i * 0.12);
          const start = effect.seed + state.elapsed * (0.9 + i * 0.22) + i * 1.6;
          const end = start + 0.9;
          withComposite("screen", () => {
            ctx.strokeStyle = i === 0 ? palette.secondary(0.035 + envelope.alpha * 0.09) : palette.tertiary(0.03 + envelope.alpha * 0.07);
            ctx.lineWidth = 7 - i * 1.3;
            ctx.beginPath();
            ctx.arc(pos.x, pos.y, arcRadius, start, end);
            ctx.stroke();
          });
        }
        for (let i = 0; i < 8; i += 1) {
          const angle = effect.seed + state.elapsed * 2.6 + i * (Math.PI * 2 / 8);
          const sparkRadius = radius * (0.34 + (i % 3) * 0.11);
          ctx.fillStyle = tintAlpha(i % 2 === 0 ? primary : secondary, 0.04 + envelope.alpha * 0.12);
          ctx.beginPath();
          ctx.ellipse(pos.x + Math.cos(angle) * sparkRadius, pos.y + Math.sin(angle) * sparkRadius, 10, 5.5, angle, 0, Math.PI * 2);
          ctx.fill();
        }
        fillGradientRing(
          pos.x,
          pos.y,
          radius * 0.38,
          radius * 0.78,
          [
            [0, palette.secondary(0)],
            [0.56, palette.primary(0.03 + envelope.alpha * 0.07)],
            [1, palette.secondary(0)],
          ],
          "screen"
        );
      } else if (effect.kind === "blizzard-wake") {
        for (let i = 0; i < 7; i += 1) {
          const angle = effect.seed + state.elapsed * 2.4 + i * (Math.PI * 2 / 7);
          const drift = radius * (0.28 + (i % 3) * 0.13);
          ctx.fillStyle = tintAlpha(i % 2 === 0 ? primary : secondary, 0.08 + envelope.alpha * 0.22);
          ctx.beginPath();
          ctx.ellipse(pos.x + Math.cos(angle) * drift, pos.y + Math.sin(angle * 1.25) * drift, 7.5, 14, angle, 0, Math.PI * 2);
          ctx.fill();
        }
        for (let i = 0; i < 6; i += 1) {
          const angle = effect.seed2 + i * (Math.PI * 2 / 6);
          const inner = radius * 0.22;
          const outer = radius * 0.76;
          const shard = ctx.createLinearGradient(
            pos.x + Math.cos(angle) * inner,
            pos.y + Math.sin(angle) * inner,
            pos.x + Math.cos(angle) * outer,
            pos.y + Math.sin(angle) * outer
          );
          shard.addColorStop(0, palette.light(0.01 + envelope.alpha * 0.03));
          shard.addColorStop(0.62, palette.secondary(0.05 + envelope.alpha * 0.11));
          shard.addColorStop(1, palette.secondary(0));
          ctx.strokeStyle = shard;
          ctx.lineWidth = 6;
          ctx.beginPath();
          ctx.moveTo(pos.x + Math.cos(angle) * inner, pos.y + Math.sin(angle) * inner);
          ctx.lineTo(pos.x + Math.cos(angle) * outer, pos.y + Math.sin(angle) * outer);
          ctx.stroke();
        }
        for (let i = 0; i < 4; i += 1) {
          const angle = state.elapsed * -1.8 + i * (Math.PI * 2 / 4);
          const armGradient = ctx.createLinearGradient(
            pos.x,
            pos.y,
            pos.x + Math.cos(angle) * radius * 0.92,
            pos.y + Math.sin(angle) * radius * 0.92
          );
          armGradient.addColorStop(0, palette.light(0.008 + envelope.alpha * 0.02));
          armGradient.addColorStop(0.52, tintAlpha(secondary, 0.03 + envelope.alpha * 0.07));
          armGradient.addColorStop(1, tintAlpha(secondary, 0));
          ctx.strokeStyle = armGradient;
          ctx.lineWidth = 10;
          ctx.beginPath();
          ctx.moveTo(pos.x, pos.y);
          ctx.lineTo(pos.x + Math.cos(angle) * radius * 0.92, pos.y + Math.sin(angle) * radius * 0.92);
          ctx.stroke();
        }
      } else if (effect.kind === "cinder-halo") {
        fillGradientDisc(
          pos.x,
          pos.y,
          radius * 0.54,
          [
            [0, palette.light(0.03 + envelope.alpha * 0.06)],
            [0.32, palette.primary(0.06 + envelope.alpha * 0.12)],
            [1, palette.secondary(0)],
          ],
          "screen"
        );
        for (let i = 0; i < 10; i += 1) {
          const angle = effect.seed + state.elapsed * 1.7 + i * (Math.PI * 2 / 10);
          const tongue = ctx.createLinearGradient(
            pos.x + Math.cos(angle) * radius * 0.26,
            pos.y + Math.sin(angle) * radius * 0.26,
            pos.x + Math.cos(angle) * radius * 0.92,
            pos.y + Math.sin(angle) * radius * 0.92
          );
          tongue.addColorStop(0, palette.primary(0.02 + envelope.alpha * 0.06));
          tongue.addColorStop(0.5, palette.secondary(0.06 + envelope.alpha * 0.16));
          tongue.addColorStop(1, palette.secondary(0));
          ctx.strokeStyle = tongue;
          ctx.lineWidth = 9 - (i % 3);
          ctx.beginPath();
          ctx.moveTo(pos.x + Math.cos(angle) * radius * 0.26, pos.y + Math.sin(angle) * radius * 0.26);
          ctx.lineTo(pos.x + Math.cos(angle) * radius * 0.92, pos.y + Math.sin(angle) * radius * 0.92);
          ctx.stroke();
        }
        for (let i = 0; i < 9; i += 1) {
          const angle = effect.seed2 + state.elapsed * 3.4 + i * (Math.PI * 2 / 9);
          const inner = radius * 0.38;
          const outer = radius * (0.8 + Math.sin(state.elapsed * 7 + i) * 0.06);
          const midX = pos.x + Math.cos(angle) * ((inner + outer) * 0.5);
          const midY = pos.y + Math.sin(angle) * ((inner + outer) * 0.5);
          drawSoftBurstParticle(midX, midY, 14, palette.light(0.018 + envelope.alpha * 0.04), tintAlpha(secondary, 0), "screen");
        }
      } else if (effect.kind === "vein-burst") {
        for (let i = 0; i < 10; i += 1) {
          const angle = effect.seed + state.elapsed * 2.6 + Math.PI / 10 + i * (Math.PI * 2 / 10);
          const pulse = 0.58 + Math.sin(state.elapsed * 7.2 + i * 0.8) * 0.12;
          const dropletX = pos.x + Math.cos(angle) * radius * 0.64 * pulse;
          const dropletY = pos.y + Math.sin(angle) * radius * 0.64 * pulse;
          ctx.fillStyle = palette.secondary(0.06 + envelope.alpha * 0.18);
          ctx.beginPath();
          ctx.ellipse(dropletX, dropletY, 11, 5.8, angle, 0, Math.PI * 2);
          ctx.fill();
        }
        for (let i = 0; i < 4; i += 1) {
          const angle = effect.seed2 + i * (Math.PI * 2 / 4);
          const spray = ctx.createLinearGradient(
            pos.x + Math.cos(angle) * radius * 0.12,
            pos.y + Math.sin(angle) * radius * 0.12,
            pos.x + Math.cos(angle) * radius * 0.88,
            pos.y + Math.sin(angle) * radius * 0.88
          );
          spray.addColorStop(0, palette.primary(0.02 + envelope.alpha * 0.04));
          spray.addColorStop(0.46, palette.secondary(0.04 + envelope.alpha * 0.14));
          spray.addColorStop(1, palette.secondary(0));
          ctx.strokeStyle = spray;
          ctx.lineWidth = 7;
          ctx.beginPath();
          ctx.moveTo(pos.x + Math.cos(angle) * radius * 0.12, pos.y + Math.sin(angle) * radius * 0.12);
          ctx.lineTo(pos.x + Math.cos(angle) * radius * 0.88, pos.y + Math.sin(angle) * radius * 0.88);
          ctx.stroke();
        }
        for (let i = 0; i < 6; i += 1) {
          const swirlAngle = effect.seed2 + state.elapsed * (3.4 + i * 0.18) + i * (Math.PI * 2 / 6);
          const swirlRadius = radius * (0.22 + (i % 3) * 0.11);
          const swirlX = pos.x + Math.cos(swirlAngle) * swirlRadius;
          const swirlY = pos.y + Math.sin(swirlAngle) * swirlRadius;
          drawSoftBurstParticle(
            swirlX,
            swirlY,
            8 + (i % 2) * 3,
            palette.light(0.04 + envelope.alpha * 0.05),
            tintAlpha(secondary, 0),
            "screen"
          );
        }
        fillGradientRing(
          pos.x,
          pos.y,
          radius * 0.22,
          radius * 0.74,
          [
            [0, palette.secondary(0)],
            [0.42, palette.primary(0.08 + envelope.alpha * 0.1)],
            [0.68, palette.tertiary(0.1 + envelope.alpha * 0.12)],
            [1, palette.secondary(0)],
          ],
          "screen"
        );
      } else if (effect.kind === "tempest-node") {
        fillGradientRing(
          pos.x,
          pos.y,
          radius * 0.22,
          radius * 0.96,
          [
            [0, palette.secondary(0)],
            [0.36, palette.secondary(0.02 + envelope.alpha * 0.06)],
            [0.66, palette.tertiary(0.05 + envelope.alpha * 0.1)],
            [1, palette.secondary(0)],
          ],
          "screen"
        );
        for (let i = 0; i < 4; i += 1) {
          const spiralRadius = radius * (0.26 + i * 0.16);
          withComposite("screen", () => {
            ctx.strokeStyle = i % 2 === 0 ? palette.secondary(0.04 + envelope.alpha * 0.08) : palette.tertiary(0.03 + envelope.alpha * 0.07);
            ctx.lineWidth = 9 - i * 1.4;
            ctx.beginPath();
            for (let step = 0; step <= 30; step += 1) {
              const t = step / 30;
              const theta = effect.seed + state.elapsed * (2.4 + i * 0.3) + t * Math.PI * 2.1;
              const r = spiralRadius * (0.16 + t * 0.84);
              const x = pos.x + Math.cos(theta) * r;
              const y = pos.y + Math.sin(theta) * r * 0.68 - (1 - t) * 34;
              if (step === 0) {
                ctx.moveTo(x, y);
              } else {
                ctx.lineTo(x, y);
              }
            }
            ctx.stroke();
          });
        }
        for (let i = 0; i < 5; i += 1) {
          const layerT = i / 4;
          const layerRadius = radius * (0.25 + layerT * 0.58);
          const offsetY = Math.sin(effect.seed + state.elapsed * 2.2 + i) * 8;
          const layer = ctx.createRadialGradient(pos.x, pos.y + offsetY, 0, pos.x, pos.y + offsetY, layerRadius);
          layer.addColorStop(0, palette.light(0.008 + envelope.alpha * 0.025));
          layer.addColorStop(0.5, tintAlpha(i % 2 === 0 ? primary : secondary, 0.03 + envelope.alpha * 0.08));
          layer.addColorStop(1, tintAlpha(secondary, 0));
          ctx.fillStyle = layer;
          ctx.beginPath();
          ctx.ellipse(pos.x, pos.y + offsetY, layerRadius * (1 - layerT * 0.24), layerRadius * 0.44, 0, 0, Math.PI * 2);
          ctx.fill();
        }
        for (let i = 0; i < 4; i += 1) {
          const swirlAngle = state.elapsed * (1.8 + i * 0.44) + i * (Math.PI * 2 / 4);
          const swirlX = pos.x + Math.cos(swirlAngle) * radius * (0.18 + i * 0.14);
          const swirlY = pos.y + Math.sin(swirlAngle) * radius * (0.18 + i * 0.14);
          drawSoftBurstParticle(swirlX, swirlY, 12 + i * 4, palette.light(0.01 + envelope.alpha * 0.03), tintAlpha(secondary, 0), "screen");
        }
        ctx.fillStyle = tintAlpha(secondary, 0.06 + envelope.alpha * 0.2);
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, radius * 0.18, 0, Math.PI * 2);
        ctx.fill();
      } else if (effect.kind === "permafrost-seal") {
        for (let i = 0; i < 3; i += 1) {
          const ringRadius = radius * (0.52 + i * 0.14);
          ctx.strokeStyle = i === 0 ? palette.secondary(0.03 + envelope.alpha * 0.1) : palette.tertiary(0.02 + envelope.alpha * 0.08);
          ctx.lineWidth = 5 - i;
          ctx.setLineDash([18 - i * 2, 12 + i * 3]);
          ctx.beginPath();
          ctx.arc(pos.x, pos.y, ringRadius, effect.seed + i * 0.4, effect.seed + i * 0.4 + Math.PI * 1.8);
          ctx.stroke();
          ctx.setLineDash([]);
        }
        for (let i = 0; i < 8; i += 1) {
          const angle = effect.seed + Math.PI / 8 + i * (Math.PI / 4);
          const px = pos.x + Math.cos(angle) * radius * 0.68;
          const py = pos.y + Math.sin(angle) * radius * 0.68;
          ctx.fillStyle = tintAlpha(i % 2 === 0 ? primary : secondary, 0.06 + envelope.alpha * 0.18);
          ctx.beginPath();
          ctx.ellipse(px, py, 4.5, 13, angle, 0, Math.PI * 2);
          ctx.fill();
        }
        for (let i = 0; i < 6; i += 1) {
          const angle = state.elapsed * 0.2 + i * (Math.PI * 2 / 6);
          const shardGradient = ctx.createLinearGradient(
            pos.x,
            pos.y,
            pos.x + Math.cos(angle) * radius * 0.84,
            pos.y + Math.sin(angle) * radius * 0.84
          );
          shardGradient.addColorStop(0, `rgba(245, 251, 255, ${(0.02 + envelope.alpha * 0.08).toFixed(3)})`);
          shardGradient.addColorStop(0.6, tintAlpha(secondary, 0.04 + envelope.alpha * 0.12));
          shardGradient.addColorStop(1, tintAlpha(secondary, 0));
          ctx.strokeStyle = shardGradient;
          ctx.lineWidth = 9;
          ctx.beginPath();
          ctx.moveTo(pos.x, pos.y);
          ctx.lineTo(pos.x + Math.cos(angle) * radius * 0.84, pos.y + Math.sin(angle) * radius * 0.84);
          ctx.stroke();
        }
      } else if (effect.kind === "sunspot") {
        fillGradientDisc(
          pos.x,
          pos.y,
          radius * 0.58,
          [
            [0, palette.light(0.025 + envelope.alpha * 0.05)],
            [0.24, palette.primary(0.08 + envelope.alpha * 0.15)],
            [0.7, palette.secondary(0.03 + envelope.alpha * 0.08)],
            [1, palette.secondary(0)],
          ],
          "screen"
        );
        const corona = ctx.createRadialGradient(pos.x, pos.y, radius * 0.24, pos.x, pos.y, radius * 0.9);
        corona.addColorStop(0, tintAlpha(primary, 0));
        corona.addColorStop(0.54, tintAlpha(secondary, 0.04 + envelope.alpha * 0.12));
        corona.addColorStop(1, tintAlpha(secondary, 0));
        ctx.fillStyle = corona;
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, radius * 0.9, 0, Math.PI * 2);
        ctx.fill();
        for (let i = 0; i < 12; i += 1) {
          const angle = effect.seed + state.elapsed * 2.6 + i * (Math.PI * 2 / 12);
          const x0 = pos.x + Math.cos(angle) * radius * 0.18;
          const y0 = pos.y + Math.sin(angle) * radius * 0.18;
          const x1 = pos.x + Math.cos(angle) * radius * 0.86;
          const y1 = pos.y + Math.sin(angle) * radius * 0.86;
          const flame = ctx.createLinearGradient(x0, y0, x1, y1);
          flame.addColorStop(0, palette.primary(0.02 + envelope.alpha * 0.06));
          flame.addColorStop(0.52, palette.secondary(0.04 + envelope.alpha * 0.12));
          flame.addColorStop(1, palette.secondary(0));
          ctx.strokeStyle = flame;
          ctx.lineWidth = 7 - (i % 3);
          ctx.beginPath();
          ctx.moveTo(x0, y0);
          ctx.lineTo(x1, y1);
          ctx.stroke();
        }
      } else if (effect.kind === "ash-comet" && !effect.burstDone) {
        const column = ctx.createLinearGradient(pos.x, pos.y - radius * 1.3, pos.x, pos.y + radius * 0.4);
        column.addColorStop(0, "rgba(255, 245, 196, 0)");
        column.addColorStop(0.3, tintAlpha(primary, 0.04 + envelope.alpha * 0.12));
        column.addColorStop(0.58, tintAlpha(secondary, 0.1 + envelope.alpha * 0.22));
        column.addColorStop(1, tintAlpha(secondary, 0));
        ctx.fillStyle = column;
        ctx.fillRect(pos.x - radius * 0.12, pos.y - radius * 1.3, radius * 0.24, radius * 1.7);
        const cometHead = ctx.createRadialGradient(pos.x, pos.y - radius * 0.1, 0, pos.x, pos.y - radius * 0.1, radius * 0.42);
        cometHead.addColorStop(0, palette.light(0.02 + envelope.alpha * 0.04));
        cometHead.addColorStop(0.5, tintAlpha(primary, 0.06 + envelope.alpha * 0.16));
        cometHead.addColorStop(1, tintAlpha(secondary, 0));
        ctx.fillStyle = cometHead;
        ctx.beginPath();
        ctx.arc(pos.x, pos.y - radius * 0.1, radius * 0.42, 0, Math.PI * 2);
        ctx.fill();
        for (let i = 0; i < 3; i += 1) {
          const wingAngle = effect.seed + (i - 1) * 0.34;
          const sx = pos.x + Math.cos(wingAngle) * radius * 0.12;
          const sy = pos.y - radius * 0.18 + Math.sin(wingAngle) * radius * 0.12;
          const ex = pos.x + Math.cos(wingAngle) * radius * 0.78;
          const ey = pos.y - radius * 0.88 + Math.sin(wingAngle) * radius * 0.48;
          const wing = ctx.createLinearGradient(sx, sy, ex, ey);
          wing.addColorStop(0, palette.primary(0.02 + envelope.alpha * 0.04));
          wing.addColorStop(0.58, palette.secondary(0.04 + envelope.alpha * 0.14));
          wing.addColorStop(1, palette.secondary(0));
          ctx.strokeStyle = wing;
          ctx.lineWidth = 10 - i * 2;
          ctx.beginPath();
          ctx.moveTo(sx, sy);
          ctx.lineTo(ex, ey);
          ctx.stroke();
        }
      } else if (effect.kind === "crimson-pool") {
        for (let i = 0; i < 6; i += 1) {
          const angle = effect.seed + i * (Math.PI * 2 / 6);
          const lobeX = pos.x + Math.cos(angle) * radius * 0.16;
          const lobeY = pos.y + Math.sin(angle) * radius * 0.16;
          const lobe = ctx.createRadialGradient(lobeX, lobeY, radius * 0.08, lobeX, lobeY, radius * 0.42);
          lobe.addColorStop(0, palette.primary(0.03 + envelope.alpha * 0.08));
          lobe.addColorStop(0.76, palette.secondary(0.03 + envelope.alpha * 0.08));
          lobe.addColorStop(1, palette.secondary(0));
          ctx.fillStyle = lobe;
          ctx.beginPath();
          ctx.ellipse(lobeX, lobeY, radius * 0.32, radius * 0.2, angle, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.fillStyle = palette.dark(0.03 + envelope.alpha * 0.1);
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, radius * 0.28, 0, Math.PI * 2);
        ctx.fill();
        for (let i = 0; i < 3; i += 1) {
          const angle = effect.seed2 + state.elapsed * 1.4 + i * (Math.PI * 2 / 3);
          ctx.beginPath();
          ctx.arc(pos.x + Math.cos(angle) * radius * 0.34, pos.y + Math.sin(angle) * radius * 0.34, 5, 0, Math.PI * 2);
          ctx.fillStyle = palette.secondary(0.05 + envelope.alpha * 0.14);
          ctx.fill();
        }
        const veinGlow = ctx.createRadialGradient(pos.x, pos.y, radius * 0.16, pos.x, pos.y, radius * 0.72);
        veinGlow.addColorStop(0, palette.light(0.012 + envelope.alpha * 0.028));
        veinGlow.addColorStop(0.58, tintAlpha(secondary, 0.04 + envelope.alpha * 0.12));
        veinGlow.addColorStop(1, tintAlpha(secondary, 0));
        ctx.fillStyle = veinGlow;
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, radius * 0.72, 0, Math.PI * 2);
        ctx.fill();
      } else if (effect.kind === "blood-rite") {
        for (let i = 0; i < 3; i += 1) {
          const pulseRadius = radius * (0.48 + i * 0.18) * (0.94 + Math.sin(state.elapsed * 3.8 + i * 0.9) * 0.05);
          fillGradientRing(
            pos.x,
            pos.y,
            pulseRadius - (6 - i) * 0.9,
            pulseRadius + (6 - i) * 0.7,
            [
              [0, palette.secondary(0)],
              [0.48, i === 0 ? palette.secondary(0.03 + envelope.alpha * 0.09) : palette.tertiary(0.02 + envelope.alpha * 0.08)],
              [1, palette.secondary(0)],
            ],
            "screen"
          );
        }
        fillGradientDisc(
          pos.x,
          pos.y,
          radius * 0.36,
          [
            [0, palette.light(0.02 + envelope.alpha * 0.04)],
            [0.28, palette.primary(0.06 + envelope.alpha * 0.11)],
            [1, palette.secondary(0)],
          ],
          "screen"
        );
        for (let i = 0; i < 6; i += 1) {
          const angle = effect.seed + state.elapsed * 1.7 + Math.PI / 6 + i * (Math.PI / 3);
          const crystalX = pos.x + Math.cos(angle) * radius * 0.52;
          const crystalY = pos.y + Math.sin(angle) * radius * 0.52;
          ctx.fillStyle = tintAlpha(i % 2 === 0 ? primary : secondary, 0.06 + envelope.alpha * 0.16);
          ctx.beginPath();
          ctx.ellipse(crystalX, crystalY, 6.5, 14, angle, 0, Math.PI * 2);
          ctx.fill();
        }
        for (let i = 0; i < 7; i += 1) {
          const angle = effect.seed2 + state.elapsed * 1.45 + i * (Math.PI * 2 / 7);
          const dropX = pos.x + Math.cos(angle) * radius * 0.38;
          const dropY = pos.y + Math.sin(angle) * radius * 0.38;
          drawSoftBurstParticle(
            dropX,
            dropY,
            7 + (i % 2) * 2,
            palette.light(0.012 + envelope.alpha * 0.03),
            tintAlpha(secondary, 0),
            "screen"
          );
        }
        for (let i = 0; i < 4; i += 1) {
          const theta = effect.seed + state.elapsed * (2.2 + i * 0.24) + i * (Math.PI * 2 / 4);
          const inner = radius * 0.16;
          const outer = radius * 0.82;
          const streak = ctx.createLinearGradient(
            pos.x + Math.cos(theta) * inner,
            pos.y + Math.sin(theta) * inner,
            pos.x + Math.cos(theta) * outer,
            pos.y + Math.sin(theta) * outer
          );
          streak.addColorStop(0, palette.primary(0.06 + envelope.alpha * 0.08));
          streak.addColorStop(0.42, palette.tertiary(0.08 + envelope.alpha * 0.12));
          streak.addColorStop(1, palette.secondary(0));
          ctx.strokeStyle = streak;
          ctx.lineWidth = 6.5;
          ctx.beginPath();
          ctx.moveTo(pos.x + Math.cos(theta) * inner, pos.y + Math.sin(theta) * inner);
          ctx.lineTo(pos.x + Math.cos(theta) * outer, pos.y + Math.sin(theta) * outer);
          ctx.stroke();
        }
      } else if (effect.kind === "requiem-field" || effect.kind === "grave-call") {
        const ringCount = effect.kind === "grave-call" ? 3 : 2;
        for (let i = 0; i < ringCount; i += 1) {
          const ringRadius = radius * (0.42 + i * 0.18);
          ctx.strokeStyle = i === 0 ? palette.secondary(0.03 + envelope.alpha * 0.08) : palette.tertiary(0.02 + envelope.alpha * 0.08);
          ctx.lineWidth = effect.kind === "grave-call" ? 5 : 4;
          ctx.setLineDash([12 + i * 3, 10 + i * 2]);
          ctx.beginPath();
          ctx.arc(pos.x, pos.y, ringRadius, effect.seed + i * 0.5, effect.seed + i * 0.5 + Math.PI * 1.6);
          ctx.stroke();
          ctx.setLineDash([]);
        }
        for (let i = 0; i < (effect.kind === "grave-call" ? 5 : 3); i += 1) {
          const angle = effect.seed + state.elapsed * 0.9 + i * (Math.PI * 2 / Math.max(3, effect.kind === "grave-call" ? 5 : 3));
          const wispX = pos.x + Math.cos(angle) * radius * (effect.kind === "grave-call" ? 0.48 : 0.32);
          const wispY = pos.y + Math.sin(angle) * radius * (effect.kind === "grave-call" ? 0.48 : 0.32);
          ctx.fillStyle = tintAlpha(i % 2 === 0 ? secondary : primary, 0.06 + envelope.alpha * 0.2);
          ctx.beginPath();
          ctx.ellipse(wispX, wispY, effect.kind === "grave-call" ? 9 : 7, effect.kind === "grave-call" ? 24 : 16, angle, 0, Math.PI * 2);
          ctx.fill();
        }
        for (let i = 0; i < (effect.kind === "grave-call" ? 6 : 4); i += 1) {
          const angle = effect.seed2 + i * (Math.PI * 2 / Math.max(4, effect.kind === "grave-call" ? 6 : 4));
          drawGradientStroke(
            pos.x + Math.cos(angle) * radius * 0.82,
            pos.y + Math.sin(angle) * radius * 0.82,
            pos.x + Math.cos(angle) * radius * 0.28,
            pos.y + Math.sin(angle) * radius * 0.28,
            effect.kind === "grave-call" ? 6 : 4,
            [
              [0, palette.secondary(0)],
              [0.34, palette.tertiary(0.02 + envelope.alpha * 0.05)],
              [0.82, palette.secondary(0.04 + envelope.alpha * 0.1)],
              [1, palette.secondary(0)],
            ],
            "screen"
          );
        }
        const necroCenter = ctx.createRadialGradient(pos.x, pos.y, radius * 0.08, pos.x, pos.y, radius * (effect.kind === "grave-call" ? 0.42 : 0.26));
        necroCenter.addColorStop(0, palette.light(0.01 + envelope.alpha * 0.03));
        necroCenter.addColorStop(0.7, tintAlpha(secondary, 0.03 + envelope.alpha * 0.1));
        necroCenter.addColorStop(1, tintAlpha(secondary, 0));
        ctx.fillStyle = necroCenter;
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, radius * (effect.kind === "grave-call" ? 0.42 : 0.26), 0, Math.PI * 2);
        ctx.fill();
      }
      continue;
    }

    if (effect.kind === "crosswind-strip") {
      const { envelope, currentLength, currentWidth, centerX, centerY } = getCrosswindMetrics(effect, lifeRatio);
      effect.lastEnvelopeAlpha = envelope.alpha;
      effect.lastEnvelopeScale = envelope.scale;
      effect.lastEnvelopeProgress = envelope.progress;
      envelope.alpha = Math.min(2.36, envelope.alpha * 2.08);
      const centerPos = worldToScreen(centerX, centerY);
      const palette = resolveEffectPalette(effect);
      ctx.save();
      ctx.translate(centerPos.x, centerPos.y);
      ctx.rotate(effect.angle);
      const halfLength = currentLength * 0.5;
      const halfWidth = currentWidth * 0.5;
      const widthGradient = ctx.createLinearGradient(0, -halfWidth, 0, halfWidth);
      widthGradient.addColorStop(0, palette.secondary(0));
      widthGradient.addColorStop(0.18, palette.secondary(0.12 + envelope.alpha * 0.12));
      widthGradient.addColorStop(0.5, palette.tertiary(0.18 + envelope.alpha * 0.16));
      widthGradient.addColorStop(0.82, palette.secondary(0.12 + envelope.alpha * 0.12));
      widthGradient.addColorStop(1, palette.secondary(0));
      ctx.fillStyle = widthGradient;
      ctx.fillRect(-halfLength, -halfWidth, currentLength, halfWidth * 2);

      const lengthGradient = ctx.createLinearGradient(-halfLength, 0, halfLength, 0);
      lengthGradient.addColorStop(0, palette.secondary(0));
      lengthGradient.addColorStop(0.2, palette.secondary(0.12 + envelope.alpha * 0.12));
      lengthGradient.addColorStop(0.5, palette.light(0.1 + envelope.alpha * 0.08));
      lengthGradient.addColorStop(0.8, palette.primary(0.14 + envelope.alpha * 0.14));
      lengthGradient.addColorStop(1, palette.secondary(0));
      withComposite("screen", () => {
        ctx.fillStyle = lengthGradient;
        ctx.fillRect(-halfLength, -halfWidth * 0.72, currentLength, halfWidth * 1.44);
      });

      for (let i = 0; i < 3; i += 1) {
        const offset = -halfWidth * 0.42 + i * halfWidth * 0.42;
        const lane = ctx.createLinearGradient(-halfLength, offset, halfLength, offset);
        lane.addColorStop(0, palette.secondary(0));
        lane.addColorStop(0.22, palette.secondary(0.14 + envelope.alpha * 0.14));
        lane.addColorStop(0.55, palette.tertiary(0.12 + envelope.alpha * 0.1));
        lane.addColorStop(1, palette.secondary(0));
        ctx.strokeStyle = lane;
        ctx.lineWidth = 5.5;
        ctx.beginPath();
        ctx.moveTo(-halfLength, offset);
        ctx.lineTo(halfLength, offset + Math.sin(effect.seed + state.elapsed * 5 + i) * halfWidth * 0.12);
        ctx.stroke();
      }

      for (let i = 0; i < 7; i += 1) {
        const phase = positiveModulo(state.elapsed * 140 + effect.seed * 30 + i * 37, currentLength + 80);
        const x = -halfLength + phase;
        const y = Math.sin(state.elapsed * 4 + i * 1.1) * halfWidth * 0.24;
        const streak = ctx.createRadialGradient(x, y, 0, x, y, 18);
        streak.addColorStop(0, palette.light(0.12 + envelope.alpha * 0.1));
        streak.addColorStop(1, palette.secondary(0));
        withComposite("screen", () => {
          ctx.fillStyle = streak;
          ctx.beginPath();
          ctx.arc(x, y, 18, 0, Math.PI * 2);
          ctx.fill();
        });
      }
      ctx.restore();
      continue;
    }

    if (effect.kind === "bone-ward") {
      const envelope = getEffectEnvelope(effect, lifeRatio);
      effect.lastEnvelopeAlpha = envelope.alpha;
      effect.lastEnvelopeScale = envelope.scale;
      effect.lastEnvelopeProgress = envelope.progress;
      envelope.alpha = Math.min(2.34, envelope.alpha * 2.02);
      const progress = effect.inFadeTail ? 1 : 1 - lifeRatio;
      const palette = resolveEffectPalette(effect);
      ctx.save();
      fillGradientRing(
        pos.x,
        pos.y,
        effect.radius * 0.34,
        effect.radius + 12,
        [
          [0, palette.secondary(0)],
          [0.42, palette.tertiary(0.12 + envelope.alpha * 0.12)],
          [0.78, palette.secondary(0.14 + envelope.alpha * 0.14)],
          [1, palette.secondary(0)],
        ]
      );
      for (let i = 0; i < effect.orbitCount; i += 1) {
        const angle = effect.seed + progress * 18.8 + (i / effect.orbitCount) * Math.PI * 2;
        const arcRadius = effect.radius * (0.82 + (i % 2) * 0.1);
        ctx.strokeStyle = i % 2 === 0 ? palette.secondary(0.14 + envelope.alpha * 0.14) : palette.tertiary(0.12 + envelope.alpha * 0.12);
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, arcRadius, angle, angle + 0.72);
        ctx.stroke();
      }
      ctx.restore();
      for (let orb = 0; orb < effect.orbitCount; orb += 1) {
        const angle = progress * 24.6 + (orb / effect.orbitCount) * Math.PI * 2;
        const orbX = pos.x + Math.cos(angle) * effect.radius * envelope.scale;
        const orbY = pos.y + Math.sin(angle) * effect.radius * envelope.scale;
        const orbGradient = ctx.createRadialGradient(orbX, orbY, 0, orbX, orbY, 20);
        orbGradient.addColorStop(0, palette.light(0.14 + envelope.alpha * 0.12));
        orbGradient.addColorStop(0.45, palette.secondary(0.16 + envelope.alpha * 0.18));
        orbGradient.addColorStop(1, palette.secondary(0));
        ctx.fillStyle = orbGradient;
        ctx.shadowBlur = 28;
        ctx.shadowColor = palette.secondary(0.18 + envelope.alpha * 0.2);
        ctx.beginPath();
        ctx.arc(orbX, orbY, 20, 0, Math.PI * 2);
        ctx.fill();
      }
      continue;
    }

    if (effect.kind === "holy-wave") {
      const envelope = getEffectEnvelope(
        { ...effect, fadeInRatio: 0.24, fadeOutRatio: 0.48, startScale: 0.9, endScale: 0.88 },
        lifeRatio
      );
      effect.lastEnvelopeAlpha = envelope.alpha;
      effect.lastEnvelopeScale = envelope.scale;
      effect.lastEnvelopeProgress = envelope.progress;
      const progress = effect.inFadeTail ? 1 : easeOutQuad(1 - lifeRatio);
      const radius = (effect.size + progress * effect.growth) * envelope.scale;
      const alpha = envelope.alpha * 0.34;
      fillGradientRing(
        pos.x,
        pos.y,
        Math.max(0, radius - effect.thickness * 1.8),
        radius + effect.thickness * 0.55,
        [
          [0, "rgba(255, 228, 150, 0)"],
          [0.42, `rgba(255, 228, 150, ${(alpha * 0.22).toFixed(3)})`],
          [0.62, `rgba(255, 221, 128, ${(alpha * 0.52).toFixed(3)})`],
          [0.82, `rgba(255, 214, 106, ${(alpha * 0.18).toFixed(3)})`],
          [1, "rgba(255, 214, 106, 0)"],
        ],
        "screen"
      );
      fillGradientDisc(
        pos.x,
        pos.y,
        radius * 0.72,
        [
          [0, `rgba(255, 236, 176, ${(alpha * 0.16).toFixed(3)})`],
          [0.5, `rgba(255, 220, 116, ${(alpha * 0.08).toFixed(3)})`],
          [1, "rgba(255, 216, 111, 0)"],
        ],
        "screen"
      );
      continue;
    }

    if (effect.kind === "holy-text") {
      ctx.save();
      ctx.globalCompositeOperation = "source-over";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = '700 22px "Trebuchet MS", "Segoe UI", sans-serif';
      ctx.shadowBlur = 18;
      ctx.shadowColor = "rgba(255, 227, 121, 0.62)";
      ctx.fillStyle = `rgba(255, 236, 157, ${0.22 + lifeRatio * 0.78})`;
      ctx.fillText("LEVEL UP", pos.x, pos.y);
      ctx.restore();
      continue;
    }

    const radius = Math.max(0.8, effect.size * lifeRatio);
    withComposite(effect.kind === "spark" || effect.kind === "ember" ? "screen" : "source-over", () => {
      if (effect.kind === "spark" || effect.kind === "ember") {
        ctx.filter = `blur(${Math.max(1.8, radius * 0.42).toFixed(2)}px)`;
      }
      ctx.fillStyle = tintAlpha(effect.color, 0.28 + lifeRatio * 0.82);
      ctx.shadowBlur = effect.kind === "spark" || effect.kind === "ember"
        ? (fxTier >= 1 ? 12 : 20)
        : (fxTier >= 1 ? 6 : 12);
      ctx.shadowColor = tintAlpha(effect.color, effect.kind === "spark" || effect.kind === "ember" ? 0.62 : 0.45);
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, radius, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  ctx.restore();
}

function drawPickups() {
  for (const pickup of state.pickups) {
    if (pickup.dead) {
      continue;
    }

    const pos = worldToScreen(pickup.x, pickup.y);
    if (!isVisible(pos.x, pos.y, 44)) {
      continue;
    }

    const bobOffset = Math.sin(pickup.floatTime * 2.4) * 6;
    const introRatio = pickup.spawnDuration > 0
      ? clamp(1 - pickup.spawnTimer / pickup.spawnDuration, 0, 1)
      : 1;
    const introScale = 0.42 + easeOutBack(introRatio) * 0.58;
    const warningWindow = pickup.despawnWarning ?? 4;
    const fadeProgress = pickup.life < warningWindow
      ? clamp(1 - pickup.life / warningWindow, 0, 1)
      : 0;
    const blinkSpeed = 1.8 + fadeProgress * 5.2;
    const blinkWave = 0.5 + 0.5 * Math.sin(pickup.floatTime * blinkSpeed);
    const despawnAlpha = fadeProgress > 0
      ? clamp(1 - fadeProgress * 0.42 - blinkWave * fadeProgress * 0.22, 0.24, 1)
      : 1;
    const isXpOrb = pickup.type === "xp-orb";
    const isXpCache = pickup.type === "xp-cache";
    const isXp = isXpOrb || isXpCache;
    const absorbProgress = pickup.absorbing ? clamp(1 - pickup.absorbTimer / pickup.absorbDuration, 0, 1) : 0;
    const absorbScale = pickup.absorbing ? 1 - absorbProgress * 0.78 : 1;
    const absorbAlpha = pickup.absorbing ? 1 - absorbProgress * 0.85 : 1;
    const introAlpha = (0.32 + introRatio * 0.68) * despawnAlpha * absorbAlpha;
    const auraColor = isXp ? "rgba(255, 214, 92, 0.18)" : "rgba(107, 255, 178, 0.16)";
    const coreColor = isXpCache ? "rgba(255, 190, 70, 0.96)" : isXpOrb ? "rgba(255, 214, 92, 0.96)" : "rgba(87, 244, 167, 0.94)";
    const glowColor = isXp ? "rgba(255, 225, 128, 0.4)" : "rgba(126, 255, 183, 0.32)";
    const crossColor = isXp ? "rgba(255, 246, 214, 0.94)" : "rgba(231, 255, 241, 0.92)";
    const auraScale = 1 + fadeProgress * 0.1 + blinkWave * fadeProgress * 0.08;
    ctx.save();
    ctx.globalAlpha = 0.45 * despawnAlpha;
    ctx.fillStyle = "rgba(6, 12, 10, 0.32)";
    ctx.beginPath();
    ctx.ellipse(pos.x, pos.y + 16, isXpOrb ? 8 : 11, 5, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = auraColor;
    ctx.beginPath();
    ctx.arc(pos.x, pos.y + bobOffset, (isXpCache ? 18 : isXpOrb ? 11 : 16) * introScale * auraScale * absorbScale, 0, Math.PI * 2);
    ctx.fill();

    ctx.translate(pos.x, pos.y + bobOffset);
    ctx.scale(introScale * (1 + fadeProgress * 0.03) * absorbScale, introScale * (1 + fadeProgress * 0.03) * absorbScale);
    ctx.rotate(isXpOrb ? 0 : Math.PI * 0.25);
    ctx.globalAlpha = introAlpha;
    ctx.fillStyle = coreColor;
    ctx.shadowBlur = 18 + fadeProgress * 6;
    ctx.shadowColor = glowColor;
    if (isXpOrb) {
      ctx.beginPath();
      ctx.arc(0, 0, 6.2, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillRect(-9, -9, 18, 18);
    }
    ctx.restore();

    ctx.save();
    ctx.globalAlpha = introAlpha;
    ctx.fillStyle = crossColor;
    if (isXpCache) {
      ctx.beginPath();
      ctx.moveTo(pos.x, pos.y + bobOffset - 9);
      ctx.lineTo(pos.x + 8, pos.y + bobOffset);
      ctx.lineTo(pos.x, pos.y + bobOffset + 9);
      ctx.lineTo(pos.x - 8, pos.y + bobOffset);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = "rgba(255, 248, 227, 0.82)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(pos.x, pos.y + bobOffset - 13);
      ctx.lineTo(pos.x, pos.y + bobOffset + 13);
      ctx.moveTo(pos.x - 13, pos.y + bobOffset);
      ctx.lineTo(pos.x + 13, pos.y + bobOffset);
      ctx.stroke();
    } else if (isXpOrb) {
      ctx.beginPath();
      ctx.arc(pos.x, pos.y + bobOffset, 3.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "rgba(255, 252, 233, 0.82)";
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      ctx.arc(pos.x - 2.1, pos.y + bobOffset - 2.1, 5.2, -1.15, -0.1);
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.roundRect(pos.x - 3, pos.y + bobOffset - 8, 6, 16, 2);
      ctx.fill();
      ctx.beginPath();
      ctx.roundRect(pos.x - 8, pos.y + bobOffset - 3, 16, 6, 2);
      ctx.fill();
    }
    ctx.restore();
  }
}

function updateHudBarAnimations(dt) {
  const hudMotion = state.hudMotion;
  const hpTarget = state.hudCache.hpRatio;
  const xpTarget = state.hudCache.xpRatio;
  const bossTarget = state.hudCache.bossRatio;

  hudMotion.playerBarShakeTimer = Math.max(0, hudMotion.playerBarShakeTimer - dt);
  hudMotion.bossBarShakeTimer = Math.max(0, hudMotion.bossBarShakeTimer - dt);
  hud.hpFill.parentElement.classList.toggle("is-damaged", hudMotion.playerBarShakeTimer > 0);
  bossHud.root.classList.toggle("is-damaged", hudMotion.bossBarShakeTimer > 0 && state.hudCache.bossVisible);

  if (hudMotion.hpLagDelay > 0 && hpTarget < hudMotion.hpLagRatio) {
    hudMotion.hpLagDelay = Math.max(0, hudMotion.hpLagDelay - dt);
  } else {
    const hpRate = hpTarget < hudMotion.hpLagRatio ? 7.8 : 15.5;
    hudMotion.hpLagRatio = damp(hudMotion.hpLagRatio, hpTarget, hpRate, dt);
  }

  if (hudMotion.xpLagDelay > 0 && xpTarget < hudMotion.xpLagRatio) {
    hudMotion.xpLagDelay = Math.max(0, hudMotion.xpLagDelay - dt);
  } else {
    const xpRate = xpTarget < hudMotion.xpLagRatio ? 8.8 : 16.5;
    hudMotion.xpLagRatio = damp(hudMotion.xpLagRatio, xpTarget, xpRate, dt);
  }

  if (state.hudCache.bossVisible) {
    if (hudMotion.bossLagDelay > 0 && bossTarget < hudMotion.bossLagRatio) {
      hudMotion.bossLagDelay = Math.max(0, hudMotion.bossLagDelay - dt);
    } else {
      const bossRate = bossTarget < hudMotion.bossLagRatio ? 7.2 : 13.5;
      hudMotion.bossLagRatio = damp(hudMotion.bossLagRatio, bossTarget, bossRate, dt);
    }
  } else {
    hudMotion.bossLagDelay = 0;
    hudMotion.bossLagRatio = 1;
  }

  const hpLagFill = `${(clamp(hudMotion.hpLagRatio, 0, 1) * 100).toFixed(2)}%`;
  if (state.hudCache.hpLagFill !== hpLagFill) {
    state.hudCache.hpLagFill = hpLagFill;
    hud.hpLagFill.style.width = hpLagFill;
  }

  const xpLagFill = `${(clamp(hudMotion.xpLagRatio, 0, 1) * 100).toFixed(2)}%`;
  if (state.hudCache.xpLagFill !== xpLagFill) {
    state.hudCache.xpLagFill = xpLagFill;
    hud.xpLagFill.style.width = xpLagFill;
  }

  const bossLagFill = `${(clamp(hudMotion.bossLagRatio, 0, 1) * 100).toFixed(2)}%`;
  if (state.hudCache.bossLagFill !== bossLagFill) {
    state.hudCache.bossLagFill = bossLagFill;
  }
}

function drawEnemies() {
  let activeFont = "";

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#ffffff";
  ctx.filter = "none";

  for (const enemy of state.enemies) {
    const pos = worldToScreen(enemy.x, enemy.y);
    if (!isVisible(pos.x, pos.y, 58)) {
      continue;
    }

    const font = ENEMY_ARCHETYPES[enemy.type].font;
    if (font !== activeFont) {
      ctx.font = font;
      activeFont = font;
    }

    if (enemy.isBoss && enemy.phase >= 2) {
      const rageColor = BOSS_THEME_COLORS[enemy.type] ?? "rgba(255, 160, 120, {a})";
      const ragePulse = 0.62 + Math.sin(state.elapsed * 5.6 + enemy.id) * 0.14;
      ctx.save();
      fillGradientRing(
        pos.x,
        pos.y,
        enemy.radius + 10,
        enemy.radius + 24 + ragePulse * 10,
        [
          [0, tintAlpha(rageColor, 0)],
          [0.42, tintAlpha(rageColor, 0.08 + ragePulse * 0.05)],
          [0.72, tintAlpha(rageColor, 0.18 + ragePulse * 0.08)],
          [1, tintAlpha(rageColor, 0)],
        ],
        "screen"
      );
      ctx.restore();
    }

    const statusVisuals = [
      { key: "freeze", value: Math.max(enemy.freezeTimer, enemy.statusFlash.freeze), hue: 190, aura: "rgba(122, 212, 255, {a})" },
      { key: "burn", value: Math.max(enemy.burnTimer * 0.25, enemy.statusFlash.burn), hue: 18, aura: "rgba(255, 154, 68, {a})" },
      { key: "chill", value: Math.max(enemy.slowTimer * 0.3, enemy.statusFlash.chill), hue: 180, aura: "rgba(102, 196, 255, {a})" },
      { key: "necro", value: Math.max(enemy.necroMarkTimer, enemy.statusFlash.necro), hue: 255, aura: "rgba(196, 142, 255, {a})" },
      { key: "blood", value: Math.max(enemy.bloodMarkTimer, enemy.statusFlash.blood), hue: 334, aura: "rgba(255, 96, 138, {a})" },
      { key: "wind", value: enemy.statusFlash.wind, hue: 0, aura: "rgba(255, 255, 255, {a})" },
    ];
    const status = statusVisuals.reduce((best, item) => {
      if (item.value <= 0) {
        return best;
      }
      if (!best) {
        return item;
      }
      return (STATUS_PRIORITY[item.key] ?? 0) >= (STATUS_PRIORITY[best.key] ?? 0) ? item : best;
    }, null);

    if (status) {
      const auraStrength = clamp(status.value, 0.18, 0.95);
      ctx.save();
      ctx.fillStyle = tintAlpha(status.aura, 0.12 + auraStrength * 0.18);
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, enemy.radius + 8 + auraStrength * 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      ctx.save();
      const hueRotate = status.key === "wind" ? 0 : status.hue;
      ctx.filter = `saturate(1.18) hue-rotate(${hueRotate}deg) brightness(${1.04 + auraStrength * 0.08})`;
      ctx.shadowBlur = 18;
      ctx.shadowColor = tintAlpha(status.aura, 0.2 + auraStrength * 0.35);
      ctx.fillText(enemy.emoji, pos.x, pos.y + 1);
      ctx.restore();
    } else {
      if (enemy.isBoss && enemy.phase >= 2) {
        ctx.save();
        ctx.filter = "saturate(1.18) brightness(1.1)";
        ctx.shadowBlur = 20;
        ctx.shadowColor = tintAlpha(BOSS_THEME_COLORS[enemy.type] ?? "rgba(255, 160, 120, {a})", 0.34);
        ctx.fillText(enemy.emoji, pos.x, pos.y + 1);
        ctx.restore();
      } else {
        ctx.fillText(enemy.emoji, pos.x, pos.y + 1);
      }
    }

    if (enemy.hasteTimer > 0) {
      const hasteStrength = clamp(enemy.hasteTimer / 3.6, 0.2, 0.9);
      ctx.save();
      ctx.strokeStyle = tintAlpha("rgba(168, 116, 255, {a})", 0.18 + hasteStrength * 0.28);
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, enemy.radius + 11, state.elapsed * 2.2, state.elapsed * 2.2 + Math.PI * 1.35);
      ctx.stroke();
      ctx.restore();
    }

    if (enemy.isBoss || enemy.hp >= enemy.maxHp - 0.01) {
      continue;
    }

    const hpRatio = clamp(enemy.hp / enemy.maxHp, 0, 1);
    const barWidth = enemy.radius * 2.2;
    const barX = pos.x - barWidth / 2;
    const barY = pos.y - enemy.radius - 12;

    ctx.fillStyle = "rgba(5, 11, 9, 0.62)";
    ctx.fillRect(barX, barY, barWidth, 4);
    ctx.fillStyle = getHealthBarColor(hpRatio);
    ctx.fillRect(barX, barY, barWidth * hpRatio, 4);
    ctx.fillStyle = "#ffffff";
  }
}

function drawAllies() {
  if (state.allies.length === 0) {
    return;
  }
  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = '28px "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif';
  for (const ally of state.allies) {
    if (ally.dead) {
      continue;
    }
    const pos = worldToScreen(ally.x, ally.y);
    if (!isVisible(pos.x, pos.y, 46)) {
      continue;
    }
    const alpha = clamp(ally.life / ally.maxLife, 0.3, 1);
    ctx.fillStyle = `rgba(220, 203, 255, ${alpha})`;
    ctx.shadowBlur = 12;
    ctx.shadowColor = `rgba(195, 151, 255, ${0.35 + alpha * 0.2})`;
    ctx.fillText(ally.emoji, pos.x, pos.y);
  }
  ctx.restore();
}

function drawPlayer() {
  const center = worldToScreen(state.player.x, state.player.y);
  const classDef = getClassDef();
  const pulse = 0.58 + Math.sin(state.elapsed * 5.8) * 0.16;
  const shake = state.player.hitShakeTimer > 0 ? state.player.hitShakePower : 0;
  const jitterX = shake > 0.01 ? randRange(-1, 1) * shake : 0;
  const jitterY = shake > 0.01 ? randRange(-1, 1) * shake : 0;
  const runEnd = state.runEnd;
  const deathProgress = runEnd.active ? clamp(runEnd.timer / runEnd.duration, 0, 1) : 0;
  const deathTilt = deathProgress * 1.56;

  ctx.save();
  const aura = ctx.createRadialGradient(center.x + jitterX, center.y + jitterY, 1, center.x + jitterX, center.y + jitterY, 28);
  aura.addColorStop(0, tintAlpha(classDef.color, 0.08 + pulse * 0.04));
  aura.addColorStop(0.38, tintAlpha(classDef.color, 0.06));
  aura.addColorStop(1, "rgba(19, 40, 33, 0)");
  ctx.fillStyle = aura;
  ctx.beginPath();
  ctx.arc(center.x + jitterX, center.y + jitterY, 28, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.globalAlpha = 1;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = PLAYER_FONT;
  ctx.save();
  ctx.translate(center.x + jitterX, center.y + 1 + jitterY);
  if (runEnd.active) {
    ctx.rotate(deathTilt);
    ctx.translate(deathProgress * 10, deathProgress * 8);
    ctx.globalAlpha = 1 - deathProgress * 0.16;
  }
  ctx.shadowBlur = 18;
  ctx.shadowColor = "rgba(255, 223, 138, 0.35)";
  ctx.fillText(state.player.emoji, 0, 0);
  ctx.restore();
  ctx.shadowBlur = 0;
}

function drawBossIndicator() {
  const boss = getPrimaryBoss();
  if (!boss) {
    return;
  }

  const bossScreen = worldToScreen(boss.x, boss.y);
  if (isVisible(bossScreen.x, bossScreen.y, boss.radius + 28)) {
    return;
  }

  const centerX = viewWidth * 0.5;
  const centerY = viewHeight * 0.5;
  const dx = bossScreen.x - centerX;
  const dy = bossScreen.y - centerY;
  const angle = Math.atan2(dy, dx);
  const margin = 52;
  const indicatorX = centerX + Math.cos(angle) * (Math.min(viewWidth, viewHeight) * 0.5 - margin);
  const indicatorY = centerY + Math.sin(angle) * (Math.min(viewWidth, viewHeight) * 0.5 - margin);

  ctx.save();
  ctx.translate(indicatorX, indicatorY);
  ctx.rotate(angle);
  ctx.fillStyle = "rgba(255, 105, 102, 0.92)";
  ctx.strokeStyle = "rgba(255, 235, 190, 0.9)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(16, 0);
  ctx.lineTo(-10, -10);
  ctx.lineTo(-4, 0);
  ctx.lineTo(-10, 10);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function drawDamageNumbers() {
  if (state.damageNumbers.length === 0) {
    return;
  }

  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = '700 18px "Trebuchet MS", "Segoe UI", sans-serif';
  for (const number of state.damageNumbers) {
    const pos = worldToScreen(number.x, number.y);
    if (!isVisible(pos.x, pos.y, 40)) {
      continue;
    }
    const lifeRatio = clamp(number.life / number.maxLife, 0, 1);
    const alpha = easeInOut(lifeRatio);
    const scale = 0.92 + (1 - lifeRatio) * 0.14;
    ctx.save();
    ctx.translate(pos.x, pos.y);
    ctx.scale(scale, scale);
    ctx.shadowBlur = 12;
    ctx.shadowColor = tintAlpha("rgba(255, 248, 235, {a})", alpha * 0.28);
    ctx.strokeStyle = `rgba(22, 28, 25, ${(alpha * 0.88).toFixed(3)})`;
    ctx.lineWidth = 4;
    ctx.fillStyle = hexToRgba(number.color, alpha);
    ctx.strokeText(String(number.amount), 0, 0);
    ctx.fillText(String(number.amount), 0, 0);
    ctx.restore();
  }
  ctx.restore();
}

function drawScreenVignette() {
  const vignette = ctx.createRadialGradient(
    viewWidth * 0.5,
    viewHeight * 0.5,
    Math.min(viewWidth, viewHeight) * 0.12,
    viewWidth * 0.5,
    viewHeight * 0.5,
    Math.max(viewWidth, viewHeight) * 0.78
  );
  vignette.addColorStop(0, "rgba(0, 0, 0, 0)");
  vignette.addColorStop(1, "rgba(2, 8, 7, 0.22)");
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, viewWidth, viewHeight);

  const hpRatio = clamp(state.player.hp / state.player.maxHp, 0, 1);
  const danger = Math.max(0, 1 - hpRatio * 1.35);
  const damageGlow = Math.max(danger, state.player.hitFlash * 1.25);
  const deathOverlay = state.runEnd.active ? clamp(state.runEnd.timer / state.runEnd.duration, 0, 1) : 0;
  const totalGlow = Math.max(damageGlow, deathOverlay * 0.92);
  if (totalGlow <= 0.02) {
    return;
  }

  const hurt = ctx.createRadialGradient(
    viewWidth * 0.5,
    viewHeight * 0.5,
    Math.min(viewWidth, viewHeight) * 0.18,
    viewWidth * 0.5,
    viewHeight * 0.5,
    Math.max(viewWidth, viewHeight) * 0.72
  );
  hurt.addColorStop(0, "rgba(0, 0, 0, 0)");
  hurt.addColorStop(0.72, `rgba(120, 20, 22, ${0.08 + totalGlow * 0.12})`);
  hurt.addColorStop(1, `rgba(196, 22, 28, ${0.16 + totalGlow * 0.34})`);
  ctx.fillStyle = hurt;
  ctx.fillRect(0, 0, viewWidth, viewHeight);

  if (!state.runEnd.active) {
    return;
  }

  const deathProgress = clamp(state.runEnd.timer / state.runEnd.duration, 0, 1);
  const redWash = ctx.createLinearGradient(0, 0, 0, viewHeight);
  redWash.addColorStop(0, `rgba(255, 124, 124, ${0.06 + deathProgress * 0.12})`);
  redWash.addColorStop(1, `rgba(118, 18, 24, ${0.12 + deathProgress * 0.26})`);
  ctx.fillStyle = redWash;
  ctx.fillRect(0, 0, viewWidth, viewHeight);

  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = '700 54px "Trebuchet MS", "Segoe UI", sans-serif';
  ctx.shadowBlur = 22;
  ctx.shadowColor = "rgba(255, 120, 120, 0.46)";
  ctx.fillStyle = `rgba(255, 228, 216, ${clamp(deathProgress * 1.1, 0, 1)})`;
  ctx.fillText("RUN OVER", viewWidth * 0.5, viewHeight * (0.24 - deathProgress * 0.03));
  ctx.font = '600 18px "Trebuchet MS", "Segoe UI", sans-serif';
  ctx.fillStyle = `rgba(255, 206, 198, ${clamp(deathProgress * 0.92, 0, 0.9)})`;
  ctx.fillText("The swarm breaks the line.", viewWidth * 0.5, viewHeight * (0.3 - deathProgress * 0.02));
  ctx.restore();
}

function getCameraZoom() {
  const runEnd = state.runEnd;
  const deathProgress = runEnd.active ? clamp(runEnd.timer / runEnd.duration, 0, 1) : 0;
  return 0.92 + deathProgress * 0.42;
}

function worldToScreen(worldX, worldY) {
  const runEnd = state.runEnd;
  const deathProgress = runEnd.active ? clamp(runEnd.timer / runEnd.duration, 0, 1) : 0;
  const zoomOut = getCameraZoom();
  const centerX = viewWidth * (0.5 - deathProgress * 0.03);
  const centerY = viewHeight * (0.5 + deathProgress * 0.075);
  return {
    x: Math.round((worldX - state.player.x) / zoomOut + centerX + state.cameraShake.offsetX),
    y: Math.round((worldY - state.player.y) / zoomOut + centerY + state.cameraShake.offsetY),
  };
}

function isVisible(x, y, padding) {
  return x > -padding && x < viewWidth + padding && y > -padding && y < viewHeight + padding;
}

function isPointOutsideCamera(x, y, cameraX, cameraY, extraPadding) {
  const limitX = viewWidth * 0.5 + extraPadding;
  const limitY = viewHeight * 0.5 + extraPadding;
  return Math.abs(x - cameraX) > limitX || Math.abs(y - cameraY) > limitY;
}

function updateHud(force) {
  const progression = state.progression;
  const player = state.player;
  const hudMotion = state.hudMotion;

  const nextTime = formatTime(state.elapsed);
  const nextLevel = String(progression.level);
  const nextKills = String(state.kills);
  const nextHp = `${Math.round(player.hp)} / ${player.maxHp}`;
  const nextXp = `${Math.floor(progression.xp)} / ${progression.xpToNext}`;
  const nextHpCurrent = String(Math.round(player.hp));
  const nextHpMax = String(player.maxHp);
  const nextXpCurrent = String(Math.floor(progression.xp));
  const nextXpMax = String(progression.xpToNext);

  const hpRatio = clamp(player.hp / player.maxHp, 0, 1);
  const xpRatio = clamp(progression.xp / progression.xpToNext, 0, 1);
  const hpFill = `${(hpRatio * 100).toFixed(2)}%`;
  const xpFill = `${(xpRatio * 100).toFixed(2)}%`;

  if (force) {
    hudMotion.hpLagRatio = hpRatio;
    hudMotion.xpLagRatio = xpRatio;
    hudMotion.bossLagRatio = state.hudCache.bossRatio;
    hudMotion.hpLagDelay = 0;
    hudMotion.xpLagDelay = 0;
    hudMotion.bossLagDelay = 0;
  } else {
    if (hpRatio < state.hudCache.hpRatio) {
      hudMotion.hpLagDelay = 0.17;
      hudMotion.hpLagRatio = Math.max(hudMotion.hpLagRatio, state.hudCache.hpRatio);
    } else if (hpRatio > hudMotion.hpLagRatio) {
      hudMotion.hpLagDelay = 0;
    }

    if (xpRatio < state.hudCache.xpRatio) {
      hudMotion.xpLagDelay = 0.14;
      hudMotion.xpLagRatio = Math.max(hudMotion.xpLagRatio, state.hudCache.xpRatio);
    } else if (xpRatio > hudMotion.xpLagRatio) {
      hudMotion.xpLagDelay = 0;
    }
  }

  state.hudCache.hpRatio = hpRatio;
  state.hudCache.xpRatio = xpRatio;

  if (force || state.hudCache.time !== nextTime) {
    state.hudCache.time = nextTime;
    hud.time.textContent = nextTime;
  }

  if (force || state.hudCache.level !== nextLevel) {
    state.hudCache.level = nextLevel;
    hud.level.textContent = nextLevel;
    if (!force) {
      retriggerValuePulse(hud.level);
    }
  }

  if (force || state.hudCache.kills !== nextKills) {
    state.hudCache.kills = nextKills;
    hud.kills.textContent = nextKills;
    if (!force) {
      retriggerValuePulse(hud.kills);
    }
  }

  if (force || state.hudCache.hp !== nextHp) {
    state.hudCache.hp = nextHp;
    hud.hpValue.dataset.value = nextHp;
  }

  if (force || state.hudCache.hpCurrent !== nextHpCurrent) {
    state.hudCache.hpCurrent = nextHpCurrent;
    hud.hpCurrent.textContent = nextHpCurrent;
    if (!force) {
      retriggerValuePulse(hud.hpCurrent);
    }
  }

  if (force || state.hudCache.hpMax !== nextHpMax) {
    state.hudCache.hpMax = nextHpMax;
    hud.hpMax.textContent = nextHpMax;
    if (!force) {
      retriggerValuePulse(hud.hpMax);
    }
  }

  if (force || state.hudCache.xp !== nextXp) {
    state.hudCache.xp = nextXp;
    hud.xpValue.dataset.value = nextXp;
  }

  if (force || state.hudCache.xpCurrent !== nextXpCurrent) {
    state.hudCache.xpCurrent = nextXpCurrent;
    hud.xpCurrent.textContent = nextXpCurrent;
    if (!force) {
      retriggerValuePulse(hud.xpCurrent);
    }
  }

  if (force || state.hudCache.xpMax !== nextXpMax) {
    state.hudCache.xpMax = nextXpMax;
    hud.xpMax.textContent = nextXpMax;
    if (!force) {
      retriggerValuePulse(hud.xpMax);
    }
  }

  if (force || state.hudCache.hpFill !== hpFill) {
    state.hudCache.hpFill = hpFill;
    hud.hpFill.style.width = hpFill;
  }

  if (force) {
    const hpLagFill = `${(hudMotion.hpLagRatio * 100).toFixed(2)}%`;
    state.hudCache.hpLagFill = hpLagFill;
    hud.hpLagFill.style.width = hpLagFill;
  }

  if (force || state.hudCache.xpFill !== xpFill) {
    state.hudCache.xpFill = xpFill;
    hud.xpFill.style.width = xpFill;
  }

  if (force) {
    const xpLagFill = `${(hudMotion.xpLagRatio * 100).toFixed(2)}%`;
    state.hudCache.xpLagFill = xpLagFill;
    hud.xpLagFill.style.width = xpLagFill;
  }

  updateDashHud();
  updateSkillHud();
  updateBossHud(force);
}

function updateDashHud() {
  const dash = state.player.dash;
  if (state.dev.zenMode) {
    dash.maxCharges = 5;
    dash.charges = 5;
    dash.rechargeTimer = 0;
  }
  const chargingIndex = dash.charges < dash.maxCharges ? dash.charges : -1;
  const chargeProgress = dash.rechargeTime > 0 && dash.rechargeTimer > 0
    ? clamp(1 - dash.rechargeTimer / dash.rechargeTime, 0, 1)
    : 0;

  dashHud.classList.toggle("is-failing", dash.failFlashTimer > 0);

  for (let i = 0; i < dashChargeElements.length; i += 1) {
    const charge = dashChargeElements[i];
    const fill = dashChargeFills[i];
    const unlocked = i < dash.maxCharges;
    const ready = unlocked && i < dash.charges;
    const charging = unlocked && i === chargingIndex;
    const pulsing = dash.pulseTimer > 0 && i === dash.pulseIndex;

    charge.classList.toggle("locked", !unlocked);
    charge.classList.toggle("ready", ready);
    charge.classList.toggle("charging", charging);
    charge.classList.toggle("is-pulsing", pulsing);

    if (!unlocked) {
      fill.style.transform = "scaleY(0)";
      continue;
    }

    if (ready) {
      fill.style.transform = "scaleY(1)";
      continue;
    }

    if (charging) {
      fill.style.transform = `scaleY(${Math.max(0.06, chargeProgress)})`;
      continue;
    }

    fill.style.transform = "scaleY(0)";
  }
}

function updateSkillHud() {
  const classDef = getClassDef();
  const zeroCooldown = hasUnlimitedSkillCooldowns();
  if (passiveSkillCard) {
    passiveSkillCard.querySelector(".skill-icon").textContent = classDef.icon;
    passiveSkillCard.querySelector(".skill-cd").textContent = "";
    passiveSkillCard.querySelector(".skill-fill").style.height = "0%";
    passiveSkillCard.dataset.tooltipIcon = classDef.icon;
    passiveSkillCard.dataset.tooltipTitle = classDef.passiveLabel;
    passiveSkillCard.dataset.tooltipMeta = `${classDef.title} Passive`;
    passiveSkillCard.dataset.tooltipBody = classDef.passiveText;
  }

  for (const card of skillCardElements) {
    const skillDef = classDef.skills.find((skill) => skill.slot === card.slot);
    const skillState = state.player.skills.find((skill) => skill.slot === card.slot);
    if (!skillDef || !skillState) {
      continue;
    }

    const unlockLevel = classDef.skillUnlocks[card.slot - 1];
    const cooldown = getSkillCooldown(skillState);
    const progress = skillState.unlocked
      ? zeroCooldown
        ? 1
        : skillState.timer > 0
        ? clamp(1 - skillState.timer / cooldown, 0, 1)
        : 1
      : 0;
    const isReady = skillState.unlocked && (zeroCooldown || skillState.timer <= 0.04);
    const isCharging = skillState.unlocked && !isReady;
    const isActive = skillState.castFlashTimer > 0;
    const isUnlocking = skillState.unlockPulseTimer > 0;

    card.root.classList.toggle("locked", !skillState.unlocked);
    card.root.classList.toggle("ready", isReady);
    card.root.classList.toggle("charging", isCharging);
    card.root.classList.toggle("active", isActive);
    card.root.classList.toggle("is-unlocking", isUnlocking);

    card.icon.textContent = skillDef.icon;
    card.fill.style.height = `${(progress * 100).toFixed(1)}%`;
    card.root.dataset.tooltipIcon = skillDef.icon;
    card.root.dataset.tooltipTitle = skillDef.title;
    card.root.dataset.tooltipMeta = `Slot ${card.slot} - ${skillDef.role} - ${formatTargetingLabel(skillDef.targeting)}`;
    card.root.dataset.tooltipBody = !skillState.unlocked
      ? `Unlocks at level ${unlockLevel}. ${SKILL_SUMMARIES[skillDef.id] ?? ""}`.trim()
      : `${SKILL_SUMMARIES[skillDef.id] ?? skillDef.title}. Cooldown ${cooldown.toFixed(1)}s.${skillState.mastery > 0 ? ` Mastery ${skillState.mastery}/2.` : ""}`;

    if (!skillState.unlocked) {
      card.cooldown.textContent = `Lv ${unlockLevel}`;
      continue;
    }

    if (isActive) {
      card.cooldown.textContent = "0.0";
      continue;
    }

    if (isReady) {
      card.cooldown.textContent = "0.0";
      continue;
    }

    card.cooldown.textContent = zeroCooldown ? "0.0" : `${skillState.timer.toFixed(1)}s`;
  }
}

function formatTargetingLabel(targeting) {
  switch (targeting) {
    case "self":
      return "Self";
    case "movement":
      return "Movement";
    case "cluster":
      return "Cluster";
    case "threat":
      return "Threat";
    default:
      return "Auto";
  }
}

function showSkillTooltip(card) {
  if (!card || !skillTooltip.root) {
    return;
  }
  skillTooltip.icon.textContent = card.dataset.tooltipIcon ?? "\u2728";
  skillTooltip.title.textContent = card.dataset.tooltipTitle ?? "Skill";
  skillTooltip.meta.textContent = card.dataset.tooltipMeta ?? "";
  skillTooltip.body.textContent = card.dataset.tooltipBody ?? "";
  skillTooltip.root.classList.remove("is-hidden");

  const rect = card.getBoundingClientRect();
  const tooltipRect = skillTooltip.root.getBoundingClientRect();
  const x = clamp(rect.left + rect.width * 0.5 - tooltipRect.width * 0.5, 12, window.innerWidth - tooltipRect.width - 12);
  const preferredAbove = rect.top - tooltipRect.height - 14;
  const y = preferredAbove > 12 ? preferredAbove : rect.bottom + 12;
  skillTooltip.root.style.left = `${Math.round(x)}px`;
  skillTooltip.root.style.top = `${Math.round(y)}px`;
}

function hideSkillTooltip() {
  if (!skillTooltip.root) {
    return;
  }
  skillTooltip.root.classList.add("is-hidden");
}

function getBossPhaseThreshold(enemy) {
  switch (enemy?.type) {
    case "countess":
      return 0.58;
    case "colossus":
      return 0.56;
    case "abyss":
      return 0.58;
    case "matriarch":
      return 0.6;
    case "harbinger":
      return 0.58;
    case "regent":
      return 0.56;
    default:
      return 0.5;
  }
}

function renderBossPhaseTracks(enemy, bossRatio, lagRatio) {
  if (!bossHud.phaseTracks) {
    return;
  }
  const threshold = getBossPhaseThreshold(enemy);
  const phaseOneSpan = Math.max(0.001, 1 - threshold);
  const phaseTwoSpan = Math.max(0.001, threshold);
  const phaseOneFill = clamp((bossRatio - threshold) / phaseOneSpan, 0, 1);
  const phaseOneLag = clamp((lagRatio - threshold) / phaseOneSpan, 0, 1);
  const phaseTwoFill = bossRatio > threshold ? 1 : clamp(bossRatio / phaseTwoSpan, 0, 1);
  const phaseTwoLag = lagRatio > threshold ? 1 : clamp(lagRatio / phaseTwoSpan, 0, 1);

  const phases = [
    { label: "Phase 2", fill: phaseTwoFill, lag: phaseTwoLag, active: enemy.phase === 2 },
    { label: "Phase 1", fill: phaseOneFill, lag: phaseOneLag, active: enemy.phase === 1 },
  ];

  bossHud.phaseTracks.innerHTML = phases.map((phase, index) => `
    <div class="boss-phase-row${phase.active ? " is-active" : ""}" data-phase-index="${index + 1}">
      <span class="boss-phase-label">${phase.label}</span>
      <div class="boss-phase-track">
        <div class="boss-phase-lag" style="width:${(phase.lag * 100).toFixed(2)}%"></div>
        <div class="boss-phase-fill" style="width:${(phase.fill * 100).toFixed(2)}%"></div>
      </div>
    </div>
  `).join("");
}

function updateBossHud(force) {
  const boss = getPrimaryBoss();
  const visible = Boolean(boss);

  if (force || state.hudCache.bossVisible !== visible) {
    state.hudCache.bossVisible = visible;
    bossHud.root.classList.toggle("hidden", !visible);
  }

  if (!boss) {
    state.hudCache.bossRatio = 1;
    state.hudCache.bossFill = "0.00%";
    state.hudCache.bossLagFill = "0.00%";
    if (bossHud.phaseTracks) {
      bossHud.phaseTracks.innerHTML = "";
    }
    return;
  }

  const bossName = boss.bossName;
  const bossRatio = clamp(boss.hp / boss.maxHp, 0, 1);
  const bossHp = `${Math.max(0, Math.ceil(boss.hp))} / ${Math.ceil(boss.maxHp)}`;
  const bossHpCurrent = String(Math.max(0, Math.ceil(boss.hp)));
  const bossHpMax = String(Math.ceil(boss.maxHp));
  const bossFill = `${(bossRatio * 100).toFixed(2)}%`;

  if (force) {
    state.hudMotion.bossLagRatio = bossRatio;
    state.hudMotion.bossLagDelay = 0;
  } else {
    if (bossRatio < state.hudCache.bossRatio) {
      state.hudMotion.bossLagDelay = 0.2;
      state.hudMotion.bossLagRatio = Math.max(state.hudMotion.bossLagRatio, state.hudCache.bossRatio);
    } else if (bossRatio > state.hudMotion.bossLagRatio) {
      state.hudMotion.bossLagDelay = 0;
    }
  }

  state.hudCache.bossRatio = bossRatio;

  if (force || state.hudCache.bossName !== bossName) {
    state.hudCache.bossName = bossName;
    bossHud.name.textContent = bossName;
  }

  if (force || state.hudCache.bossHp !== bossHp) {
    state.hudCache.bossHp = bossHp;
    bossHud.hp.dataset.value = bossHp;
  }

  if (force || state.hudCache.bossHpCurrent !== bossHpCurrent) {
    state.hudCache.bossHpCurrent = bossHpCurrent;
    bossHud.hpCurrent.textContent = bossHpCurrent;
    if (!force) {
      retriggerValuePulse(bossHud.hpCurrent);
    }
  }

  if (force || state.hudCache.bossHpMax !== bossHpMax) {
    state.hudCache.bossHpMax = bossHpMax;
    bossHud.hpMax.textContent = bossHpMax;
    if (!force) {
      retriggerValuePulse(bossHud.hpMax);
    }
  }

  if (force || state.hudCache.bossFill !== bossFill) {
    state.hudCache.bossFill = bossFill;
  }

  if (force) {
    const bossLagFill = `${(state.hudMotion.bossLagRatio * 100).toFixed(2)}%`;
    state.hudCache.bossLagFill = bossLagFill;
  }

  renderBossPhaseTracks(boss, bossRatio, state.hudMotion.bossLagRatio);
}

function endRun(options = {}) {
  const instant = Boolean(options.instant);
  const cause = options.cause ?? "defeat";
  if (state.runEnd.active) {
    return;
  }
  if (!state.running) {
    return;
  }

  if (instant) {
    state.runEnd.active = false;
    state.runEnd.timer = 0;
    state.runEnd.cause = cause;
    pressedActions.clear();
    finishRunSummary();
    return;
  }

  state.runEnd.active = true;
  state.runEnd.timer = 0;
  state.runEnd.cause = cause;
  pressedActions.clear();
}

function applyRunMetaProgress() {
  metaProgress.lifetime.runs += 1;
  metaProgress.lifetime.totalXpCollected += Math.round(state.metaRun.xpCollected);
  metaProgress.lifetime.totalKills += state.kills;
  const targetClassId = getCurrentUnlockTargetId(metaProgress);
  if (!targetClassId) {
    saveMetaProgress();
    return null;
  }
  const requirement = CLASS_UNLOCK_REQUIREMENTS[targetClassId];
  metaProgress.unlockState.targetClassId = targetClassId;
  metaProgress.unlockState.xp = Math.min(requirement.xp, metaProgress.unlockState.xp + Math.round(state.metaRun.xpCollected));
  metaProgress.unlockState.kills = Math.min(requirement.enemyKills, metaProgress.unlockState.kills + (state.killBreakdown[requirement.enemyType] ?? 0));
  if (metaProgress.unlockState.xp >= requirement.xp && metaProgress.unlockState.kills >= requirement.enemyKills) {
    const unlockedBefore = { ...metaProgress.unlocked };
    metaProgress = reconcileMetaUnlocks(metaProgress);
    const unlockedClassId = CLASS_ORDER.find((classId) => !unlockedBefore[classId] && metaProgress.unlocked[classId]) ?? targetClassId;
    saveMetaProgress();
    return unlockedClassId;
  }
  saveMetaProgress();
  return null;
}

function finishRunSummary() {
  state.running = false;
  state.runEnd.active = false;
  state.levelUp.active = false;
  clearPause();
  pauseOverlay.classList.add("hidden");
  levelUpOverlay.classList.add("hidden");
  bossRewardOverlay.classList.add("hidden");
  finalizeRunTelemetry();
  const unlockedClassId = applyRunMetaProgress();
  updateHud(true);
  resultValue.textContent = unlockedClassId
    ? `Survived ${formatTime(state.elapsed)} and unlocked ${CLASS_DEFS[unlockedClassId].title}.`
    : `Survived ${formatTime(state.elapsed)} before the run collapsed.`;
  renderResultStats();
  gameOverOverlay.classList.remove("hidden");
  retriggerEnterAnimation(gameOverOverlay, gameOverCard);
}

function updateRunEndSequence(dt) {
  state.runEnd.timer = Math.min(state.runEnd.duration, state.runEnd.timer + dt);
  const deathProgress = clamp(state.runEnd.timer / state.runEnd.duration, 0, 1);
  const timeScale = lerp(1, 0.18, smoothstep(0.08, 1, deathProgress));
  state.elapsed += dt * timeScale;
  updateEffects(dt * timeScale);
  if (state.runEnd.timer >= state.runEnd.duration) {
    finishRunSummary();
  }
}

function restartRun() {
  state = createInitialState(metaProgress.selectedClassId);
  pressedActions.clear();
  accumulator = 0;
  previousTime = performance.now() / 1000;
  pauseOverlay.classList.add("hidden");
  levelUpOverlay.classList.add("hidden");
  bossRewardOverlay.classList.add("hidden");
  gameOverOverlay.classList.add("hidden");
  renderStartOverlay();
  updateHud(true);
}

function formatTime(totalSeconds) {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(rest).padStart(2, "0")}`;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function damp(current, target, smoothing, dt) {
  const t = 1 - Math.exp(-smoothing * dt);
  return current + (target - current) * t;
}

function smoothstep(edge0, edge1, value) {
  const t = clamp((value - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

function hash2D(x, y, seed = 0) {
  const value = Math.sin(x * 127.1 + y * 311.7 + seed * 74.7) * 43758.5453123;
  return value - Math.floor(value);
}

function valueNoise2D(x, y, seed = 0) {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const x1 = x0 + 1;
  const y1 = y0 + 1;
  const sx = smoothstep(0, 1, x - x0);
  const sy = smoothstep(0, 1, y - y0);

  const n00 = hash2D(x0, y0, seed);
  const n10 = hash2D(x1, y0, seed);
  const n01 = hash2D(x0, y1, seed);
  const n11 = hash2D(x1, y1, seed);

  const ix0 = lerp(n00, n10, sx);
  const ix1 = lerp(n01, n11, sx);
  return lerp(ix0, ix1, sy);
}

function fbm2D(x, y, octaves, seed = 0) {
  let total = 0;
  let amplitude = 0.5;
  let frequency = 1;
  let weight = 0;

  for (let i = 0; i < octaves; i += 1) {
    total += valueNoise2D(x * frequency, y * frequency, seed + i * 17.17) * amplitude;
    weight += amplitude;
    amplitude *= 0.5;
    frequency *= 2;
  }

  return weight > 0 ? total / weight : 0;
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function easeOutBack(t) {
  const s = 1.70158;
  const x = t - 1;
  return 1 + (s + 1) * x * x * x + s * x * x;
}

function easeInOut(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function easeOutQuad(t) {
  return 1 - (1 - t) * (1 - t);
}

function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3);
}

function parseColorComponents(color) {
  if (color.startsWith("#")) {
    return {
      r: parseInt(color.slice(1, 3), 16),
      g: parseInt(color.slice(3, 5), 16),
      b: parseInt(color.slice(5, 7), 16),
    };
  }

  const match = color.match(/rgba?\(([^)]+)\)/i);
  if (!match) {
    return { r: 255, g: 255, b: 255 };
  }

  const parts = match[1].split(",").map((part) => Number.parseFloat(part.trim()));
  return {
    r: parts[0] ?? 255,
    g: parts[1] ?? 255,
    b: parts[2] ?? 255,
  };
}

function mixHexColor(a, b, t) {
  const left = parseColorComponents(a);
  const right = parseColorComponents(b);
  const r = Math.round(lerp(left.r, right.r, t));
  const g = Math.round(lerp(left.g, right.g, t));
  const bMix = Math.round(lerp(left.b, right.b, t));
  return `rgb(${r}, ${g}, ${bMix})`;
}

function shadeColor(color, amount) {
  const source = parseColorComponents(color);
  const target = amount >= 0 ? { r: 255, g: 255, b: 255 } : { r: 0, g: 0, b: 0 };
  const mix = Math.abs(amount);
  const r = Math.round(lerp(source.r, target.r, mix));
  const g = Math.round(lerp(source.g, target.g, mix));
  const b = Math.round(lerp(source.b, target.b, mix));
  return `rgb(${r}, ${g}, ${b})`;
}

function hexToRgba(color, alpha) {
  const r = parseInt(color.slice(1, 3), 16);
  const g = parseInt(color.slice(3, 5), 16);
  const b = parseInt(color.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function createSeededRandom(seed) {
  let stateValue = seed >>> 0;
  return function nextRandom() {
    stateValue += 0x6d2b79f5;
    let t = stateValue;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function getWorldSeed() {
  return state?.world?.seed ?? TERRAIN_SEED;
}

function makeRegionSeed(regionX, regionY, salt) {
  let seed = (salt ^ 0x9e3779b9) >>> 0;
  seed = Math.imul(seed ^ (regionX + 0x7f4a7c15), 2246822519);
  seed = Math.imul(seed ^ (regionY + 0x165667b1), 3266489917);
  return (seed ^ (seed >>> 16)) >>> 0;
}

function regionIndexX(worldX) {
  return Math.floor((worldX - WORLD.left) / WORLD_FEATURE_REGION_SIZE);
}

function regionIndexY(worldY) {
  return Math.floor((worldY - WORLD.top) / WORLD_FEATURE_REGION_SIZE);
}

function getFeatureKey(regionX, regionY) {
  return `${getWorldSeed()}:${regionX},${regionY}`;
}

function computeFeatureBounds(circles) {
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;

  for (const circle of circles) {
    minX = Math.min(minX, circle.x - circle.r);
    minY = Math.min(minY, circle.y - circle.r);
    maxX = Math.max(maxX, circle.x + circle.r);
    maxY = Math.max(maxY, circle.y + circle.r);
  }

  return { minX, minY, maxX, maxY };
}

function finalizeWorldFeature(feature) {
  const bounds = computeFeatureBounds(feature.circles);
  feature.minX = bounds.minX;
  feature.minY = bounds.minY;
  feature.maxX = bounds.maxX;
  feature.maxY = bounds.maxY;
  feature.footprintRadius = Math.max(feature.footprintRadius ?? 0, Math.max(
    feature.maxX - feature.anchorX,
    feature.anchorX - feature.minX,
    feature.maxY - feature.anchorY,
    feature.anchorY - feature.minY
  ));
  return feature;
}

function isFeatureWithinInnerRegion(feature, innerLeft, innerTop, innerRight, innerBottom) {
  return (
    feature.minX >= innerLeft &&
    feature.maxX <= innerRight &&
    feature.minY >= innerTop &&
    feature.maxY <= innerBottom
  );
}

function isFeatureNearOrigin(feature) {
  return Math.hypot(feature.anchorX, feature.anchorY) < WORLD_FEATURE_START_CLEAR_RADIUS;
}

function isFeatureTooCloseToOthers(feature, features) {
  for (const other of features) {
    const dx = feature.anchorX - other.anchorX;
    const dy = feature.anchorY - other.anchorY;
    const minimumDistance = feature.footprintRadius + other.footprintRadius + 180;
    if (dx * dx + dy * dy < minimumDistance * minimumDistance) {
      return true;
    }
  }
  return false;
}

function createPondFeature(rng, innerLeft, innerTop, innerRight, innerBottom) {
  const sizeRoll = rng();
  const scale = sizeRoll > 0.84 ? 1.9 + rng() * 0.5 : sizeRoll > 0.52 ? 1.25 + rng() * 0.45 : 0.8 + rng() * 0.35;
  const radiusX = (120 + rng() * 90) * scale;
  const radiusY = (88 + rng() * 72) * scale;
  const centerX = lerp(innerLeft + radiusX + 50, innerRight - radiusX - 50, rng());
  const centerY = lerp(innerTop + radiusY + 50, innerBottom - radiusY - 50, rng());
  const circles = [];

  for (let gridY = -1; gridY <= 1; gridY += 1) {
    for (let gridX = -1; gridX <= 1; gridX += 1) {
      const offsetX = gridX * radiusX * 0.46 + (rng() - 0.5) * 34;
      const offsetY = gridY * radiusY * 0.42 + (rng() - 0.5) * 30;
      const ellipseDistance = (offsetX * offsetX) / (radiusX * radiusX) + (offsetY * offsetY) / (radiusY * radiusY);
      if (ellipseDistance > 1.05) {
        continue;
      }
      circles.push({
        x: centerX + offsetX,
        y: centerY + offsetY,
        r: lerp(Math.min(radiusX, radiusY) * 0.34, Math.min(radiusX, radiusY) * 0.56, 1 - ellipseDistance * 0.55),
      });
    }
  }

  return finalizeWorldFeature({
    type: "water-pond",
    group: "water",
    anchorX: centerX,
    anchorY: centerY,
    circles,
    blocksMovement: true,
    blocksProjectiles: false,
    footprintRadius: Math.max(radiusX, radiusY) + 50,
  });
}

function createRiverFeature(rng, innerLeft, innerTop, innerRight, innerBottom) {
  const centerX = lerp(innerLeft + 280, innerRight - 280, rng());
  const centerY = lerp(innerTop + 280, innerBottom - 280, rng());
  const angle = rng() * Math.PI * 2;
  const scale = rng() > 0.7 ? 1.35 + rng() * 0.55 : 0.9 + rng() * 0.35;
  const length = (520 + rng() * 260) * scale;
  const width = (64 + rng() * 22) * (0.88 + scale * 0.18);
  const bendAmplitude = (92 + rng() * 66) * (0.9 + scale * 0.2);
  const phase = rng() * Math.PI * 2;
  const points = [];
  const circleSpacing = Math.max(42, width * 0.62);
  let travel = 0;
  let previousX = centerX;
  let previousY = centerY;

  for (let i = 0; i <= 8; i += 1) {
    const t = i / 8;
    const along = (t - 0.5) * length;
    const bend = Math.sin(t * Math.PI * 2 + phase) * bendAmplitude * (0.75 + rng() * 0.35);
    const x = centerX + Math.cos(angle) * along + Math.cos(angle + Math.PI / 2) * bend;
    const y = centerY + Math.sin(angle) * along + Math.sin(angle + Math.PI / 2) * bend;
    points.push({ x, y });
    if (i > 0) {
      travel += Math.hypot(x - previousX, y - previousY);
    }
    previousX = x;
    previousY = y;
  }

  const circles = [];
  for (let i = 0; i < points.length - 1; i += 1) {
    const start = points[i];
    const end = points[i + 1];
    const segmentLength = Math.hypot(end.x - start.x, end.y - start.y) || 1;
    const steps = Math.max(1, Math.ceil(segmentLength / circleSpacing));
    for (let step = 0; step <= steps; step += 1) {
      const t = step / steps;
      circles.push({
        x: lerp(start.x, end.x, t),
        y: lerp(start.y, end.y, t),
        r: width * (0.92 + rng() * 0.22),
      });
    }
  }

  return finalizeWorldFeature({
    type: "water-river",
    group: "water",
    anchorX: centerX,
    anchorY: centerY,
    points,
    width,
    circles,
    blocksMovement: true,
    blocksProjectiles: false,
    footprintRadius: travel * 0.22 + width * 1.4,
  });
}

function createTreeFeature(rng, innerLeft, innerTop, innerRight, innerBottom) {
  const x = lerp(innerLeft + 90, innerRight - 90, rng());
  const y = lerp(innerTop + 90, innerBottom - 90, rng());
  const trunkRadius = 22 + rng() * 10;
  const canopyRadius = trunkRadius + 18 + rng() * 10;
  return finalizeWorldFeature({
    type: "tree",
    group: "solid",
    anchorX: x,
    anchorY: y,
    canopyRadius,
    circles: [{ x, y, r: trunkRadius }],
    blocksMovement: true,
    blocksProjectiles: true,
    footprintRadius: canopyRadius + 12,
  });
}

function createBushFeature(rng, innerLeft, innerTop, innerRight, innerBottom) {
  const x = lerp(innerLeft + 80, innerRight - 80, rng());
  const y = lerp(innerTop + 80, innerBottom - 80, rng());
  const angle = rng() * Math.PI * 2;
  const spread = 16 + rng() * 10;
  return finalizeWorldFeature({
    type: "bush",
    group: "solid",
    anchorX: x,
    anchorY: y,
    circles: [
      { x: x + Math.cos(angle) * spread * 0.6, y: y + Math.sin(angle) * spread * 0.6, r: 24 + rng() * 6 },
      { x: x - Math.cos(angle) * spread, y: y - Math.sin(angle) * spread, r: 19 + rng() * 6 },
      { x, y, r: 22 + rng() * 5 },
    ],
    blocksMovement: true,
    blocksProjectiles: true,
    footprintRadius: 52,
  });
}

function createRockFeature(rng, innerLeft, innerTop, innerRight, innerBottom) {
  const x = lerp(innerLeft + 90, innerRight - 90, rng());
  const y = lerp(innerTop + 90, innerBottom - 90, rng());
  const patterns = [
    [{ x: 0, y: 0, w: 34, h: 34 }],
    [{ x: 0, y: 0, w: 54, h: 54 }],
    [{ x: 0, y: 0, w: 80, h: 80 }],
    [{ x: -26, y: 0, w: 34, h: 34 }, { x: 20, y: 0, w: 46, h: 46 }],
    [{ x: -28, y: -28, w: 40, h: 40 }, { x: 18, y: -28, w: 40, h: 40 }, { x: -28, y: 18, w: 40, h: 40 }],
    [{ x: 0, y: -34, w: 42, h: 42 }, { x: -46, y: 12, w: 42, h: 42 }, { x: 0, y: 12, w: 42, h: 42 }, { x: 46, y: 12, w: 42, h: 42 }],
    [{ x: -54, y: 0, w: 42, h: 42 }, { x: 0, y: 0, w: 42, h: 42 }, { x: 54, y: 0, w: 42, h: 42 }, { x: 54, y: -54, w: 42, h: 42 }],
    [{ x: -38, y: -38, w: 34, h: 34 }, { x: 6, y: -38, w: 34, h: 34 }, { x: -38, y: 6, w: 34, h: 34 }, { x: 6, y: 6, w: 66, h: 66 }],
    [{ x: -72, y: 0, w: 54, h: 54 }, { x: 0, y: 0, w: 54, h: 54 }, { x: 72, y: 0, w: 54, h: 54 }, { x: 0, y: 72, w: 54, h: 54 }],
    [{ x: -64, y: -64, w: 56, h: 56 }, { x: 0, y: -64, w: 56, h: 56 }, { x: 64, y: -64, w: 56, h: 56 }, { x: -64, y: 0, w: 56, h: 56 }, { x: 64, y: 0, w: 56, h: 56 }, { x: 0, y: 64, w: 74, h: 74 }],
  ];
  const hugeRoll = rng();
  const scale = hugeRoll > 0.9 ? 2.2 + rng() * 0.55 : hugeRoll > 0.66 ? 1.45 + rng() * 0.4 : 1;
  const pattern = patterns[Math.floor(rng() * patterns.length)];
  const blocks = pattern.map((block) => ({
    x: x + block.x * scale,
    y: y + block.y * scale,
    w: block.w * scale,
    h: block.h * scale,
  }));

  const circles = [];
  for (const block of blocks) {
    const major = Math.max(block.w, block.h);
    const minor = Math.min(block.w, block.h);
    const count = major > minor * 1.35 ? 3 : major > 88 ? 4 : 2;
    const horizontal = block.w >= block.h;
    for (let i = 0; i < count; i += 1) {
      const t = count === 1 ? 0.5 : i / (count - 1);
      circles.push({
        x: horizontal ? block.x - block.w * 0.32 + block.w * 0.64 * t : block.x,
        y: horizontal ? block.y : block.y - block.h * 0.32 + block.h * 0.64 * t,
        r: Math.max(14, Math.min(block.w, block.h) * 0.34),
      });
    }
  }

  let footprintRadius = 0;
  for (const block of blocks) {
    footprintRadius = Math.max(
      footprintRadius,
      Math.abs(block.x - x) + block.w * 0.5,
      Math.abs(block.y - y) + block.h * 0.5
    );
  }

  return finalizeWorldFeature({
    type: "rock",
    group: "solid",
    anchorX: x,
    anchorY: y,
    circles,
    blocks,
    blocksMovement: true,
    blocksProjectiles: true,
    footprintRadius,
  });
}

function createRuinFeature(rng, innerLeft, innerTop, innerRight, innerBottom) {
  const x = lerp(innerLeft + 120, innerRight - 120, rng());
  const y = lerp(innerTop + 120, innerBottom - 120, rng());
  const angle = rng() * Math.PI * 2;
  const perpX = Math.cos(angle + Math.PI / 2);
  const perpY = Math.sin(angle + Math.PI / 2);
  const dirX = Math.cos(angle);
  const dirY = Math.sin(angle);
  const length = 56 + rng() * 34;
  const width = 18 + rng() * 8;
  return finalizeWorldFeature({
    type: "ruin",
    group: "solid",
    anchorX: x,
    anchorY: y,
    points: [
      { x: x - dirX * length * 0.5, y: y - dirY * length * 0.5 },
      { x: x + dirX * length * 0.5, y: y + dirY * length * 0.5 },
    ],
    circles: [
      { x: x - dirX * length * 0.45, y: y - dirY * length * 0.45, r: width },
      { x, y, r: width + 3 },
      { x: x + dirX * length * 0.45, y: y + dirY * length * 0.45, r: width },
      { x: x + perpX * width * 1.4, y: y + perpY * width * 1.4, r: width * 0.8 },
    ],
    blocksMovement: true,
    blocksProjectiles: true,
    footprintRadius: length * 0.6 + width * 1.8,
  });
}

function generateRegionFeatures(regionX, regionY) {
  const key = getFeatureKey(regionX, regionY);
  if (WORLD_FEATURE_CACHE.has(key)) {
    return WORLD_FEATURE_CACHE.get(key);
  }

  const rng = createSeededRandom(makeRegionSeed(regionX, regionY, getWorldSeed() + 503));
  const regionLeft = WORLD.left + regionX * WORLD_FEATURE_REGION_SIZE;
  const regionTop = WORLD.top + regionY * WORLD_FEATURE_REGION_SIZE;
  const regionRight = Math.min(WORLD.right, regionLeft + WORLD_FEATURE_REGION_SIZE);
  const regionBottom = Math.min(WORLD.bottom, regionTop + WORLD_FEATURE_REGION_SIZE);
  const innerLeft = regionLeft + WORLD_FEATURE_MARGIN;
  const innerTop = regionTop + WORLD_FEATURE_MARGIN;
  const innerRight = regionRight - WORLD_FEATURE_MARGIN;
  const innerBottom = regionBottom - WORLD_FEATURE_MARGIN;
  const features = [];

  if (innerRight - innerLeft > 240 && innerBottom - innerTop > 240) {
    const desiredWater = 1 + (rng() > 0.46 ? 1 : 0) + (rng() > 0.82 ? 1 : 0);
    let attempts = 0;
    while (features.length < desiredWater && attempts < 9) {
      attempts += 1;
      const waterFeature = rng() > 0.38
        ? createPondFeature(rng, innerLeft, innerTop, innerRight, innerBottom)
        : createRiverFeature(rng, innerLeft, innerTop, innerRight, innerBottom);
      if (!isFeatureWithinInnerRegion(waterFeature, innerLeft, innerTop, innerRight, innerBottom)) {
        continue;
      }
      if (isFeatureNearOrigin(waterFeature) || isFeatureTooCloseToOthers(waterFeature, features)) {
        continue;
      }
      features.push(waterFeature);
    }
  }

  WORLD_FEATURE_CACHE.set(key, features);
  return features;
}

function iterateWorldFeaturesInBounds(minX, minY, maxX, maxY, visitor) {
  const startRegionX = Math.max(0, regionIndexX(minX));
  const startRegionY = Math.max(0, regionIndexY(minY));
  const endRegionX = Math.max(startRegionX, regionIndexX(maxX));
  const endRegionY = Math.max(startRegionY, regionIndexY(maxY));

  for (let regionY = startRegionY; regionY <= endRegionY; regionY += 1) {
    for (let regionX = startRegionX; regionX <= endRegionX; regionX += 1) {
      const features = generateRegionFeatures(regionX, regionY);
      for (const feature of features) {
        if (feature.maxX < minX || feature.minX > maxX || feature.maxY < minY || feature.minY > maxY) {
          continue;
        }
        visitor(feature);
      }
    }
  }
}

function resolveCircleAgainstWorld(x, y, radius, options = { water: true, solids: true }) {
  let resolvedX = x;
  let resolvedY = y;

  for (let iteration = 0; iteration < 3; iteration += 1) {
    let changed = false;
    iterateWorldFeaturesInBounds(
      resolvedX - radius - 120,
      resolvedY - radius - 120,
      resolvedX + radius + 120,
      resolvedY + radius + 120,
      (feature) => {
        if (!feature.blocksMovement) {
          return;
        }
        if (feature.group === "water" && !options.water) {
          return;
        }
        if (feature.group === "solid" && !options.solids) {
          return;
        }

        for (const circle of feature.circles) {
          let dx = resolvedX - circle.x;
          let dy = resolvedY - circle.y;
          let distanceSq = dx * dx + dy * dy;
          const minimumDistance = radius + circle.r;
          if (distanceSq >= minimumDistance * minimumDistance) {
            continue;
          }

          if (distanceSq <= 0.0001) {
            dx = 0.01;
            dy = -0.01;
            distanceSq = dx * dx + dy * dy;
          }

          const distance = Math.sqrt(distanceSq);
          const overlap = minimumDistance - distance;
          resolvedX += (dx / distance) * overlap;
          resolvedY += (dy / distance) * overlap;
          changed = true;
        }
      }
    );

    if (!changed) {
      break;
    }
  }

  return {
    x: clamp(resolvedX, WORLD.left + radius, WORLD.right - radius),
    y: clamp(resolvedY, WORLD.top + radius, WORLD.bottom - radius),
  };
}

function moveCircleEntity(entity, deltaX, deltaY, radius, options = { water: true, solids: true }) {
  if (deltaX !== 0) {
    const resolvedX = resolveCircleAgainstWorld(entity.x + deltaX, entity.y, radius, options);
    entity.x = resolvedX.x;
    entity.y = resolvedX.y;
  }

  if (deltaY !== 0) {
    const resolvedY = resolveCircleAgainstWorld(entity.x, entity.y + deltaY, radius, options);
    entity.x = resolvedY.x;
    entity.y = resolvedY.y;
  }
}

function isWalkablePoint(x, y, radius) {
  const resolved = resolveCircleAgainstWorld(x, y, radius, { water: true, solids: true });
  return Math.hypot(resolved.x - x, resolved.y - y) < 1;
}

function findNearbyWalkablePoint(x, y, radius, searchDistance = 220) {
  const clampedX = clamp(x, WORLD.left + radius, WORLD.right - radius);
  const clampedY = clamp(y, WORLD.top + radius, WORLD.bottom - radius);
  if (isWalkablePoint(clampedX, clampedY, radius)) {
    return { x: clampedX, y: clampedY };
  }

  for (let ring = 1; ring <= 5; ring += 1) {
    const distance = (searchDistance / 5) * ring;
    for (let step = 0; step < 16; step += 1) {
      const angle = (step / 16) * Math.PI * 2;
      const candidateX = clamp(clampedX + Math.cos(angle) * distance, WORLD.left + radius, WORLD.right - radius);
      const candidateY = clamp(clampedY + Math.sin(angle) * distance, WORLD.top + radius, WORLD.bottom - radius);
      if (isWalkablePoint(candidateX, candidateY, radius)) {
        return { x: candidateX, y: candidateY };
      }
    }
  }

  return resolveCircleAgainstWorld(clampedX, clampedY, radius, { water: true, solids: true });
}

function segmentHitsBlockingFeature(ax, ay, bx, by, radius) {
  let hit = false;
  iterateWorldFeaturesInBounds(
    Math.min(ax, bx) - radius - 96,
    Math.min(ay, by) - radius - 96,
    Math.max(ax, bx) + radius + 96,
    Math.max(ay, by) + radius + 96,
    (feature) => {
      if (hit || !feature.blocksProjectiles) {
        return;
      }
      for (const circle of feature.circles) {
        if (distancePointToSegment(circle.x, circle.y, ax, ay, bx, by) <= circle.r + radius) {
          hit = true;
          return;
        }
      }
    }
  );
  return hit;
}

function getTerrainTileBase(worldX, worldY) {
  const seed = getWorldSeed();
  const tileX = Math.round(worldX / TERRAIN_TILE_SIZE);
  const tileY = Math.round(worldY / TERRAIN_TILE_SIZE);
  const cacheKey = `${seed}:${tileX}:${tileY}`;
  const cached = TERRAIN_TILE_CACHE.get(cacheKey);
  if (cached) {
    return cached;
  }

  const warpX = (fbm2D(worldX * 0.00022, worldY * 0.00022, 3, seed + 11) - 0.5) * 340;
  const warpY = (fbm2D(worldX * 0.00022, worldY * 0.00022, 3, seed + 29) - 0.5) * 340;
  const biomeNoise = fbm2D((worldX + warpX) * 0.00058, (worldY + warpY) * 0.00058, 4, seed + 7);
  const drynessNoise = fbm2D((worldX - warpY * 0.4) * 0.00076, (worldY + warpX * 0.35) * 0.00076, 3, seed + 41);
  const roughnessNoise = fbm2D((worldX + 9000) * 0.00118, (worldY - 6000) * 0.00118, 2, seed + 93);
  const detailNoise = fbm2D(worldX * 0.00125, worldY * 0.00125, 3, seed + 131);
  const materialNoise = fbm2D(worldX * 0.00145, worldY * 0.00145, 2, seed + 171);

  const stoneScore = biomeNoise * 0.6 + roughnessNoise * 0.55 + materialNoise * 0.18;
  const sandScore = drynessNoise * 1.04 - biomeNoise * 0.16 + (1 - roughnessNoise) * 0.18 + detailNoise * 0.05;
  const sandWeightRaw = clamp((sandScore - 0.34) / 0.28, 0, 1);
  const stoneWeightRaw = clamp((stoneScore - 0.58) / 0.26, 0, 1) * (1 - sandWeightRaw * 0.34);
  const grassWeightRaw = Math.max(0.14, 1 - sandWeightRaw * 0.95 - stoneWeightRaw * 0.95);
  const weightSum = grassWeightRaw + sandWeightRaw + stoneWeightRaw;
  const grassWeight = grassWeightRaw / weightSum;
  const sandWeight = sandWeightRaw / weightSum;
  const stoneWeight = stoneWeightRaw / weightSum;

  let terrainType = "grass";
  if (stoneWeight > sandWeight && stoneWeight > 0.34) {
    terrainType = "stone";
  } else if (sandWeight > 0.34) {
    terrainType = "sand";
  }

  const blend = clamp(0.18 + detailNoise * 0.64, 0, 1);
  const grassColor = blend < 0.5
    ? mixHexColor(TERRAIN_PALETTE.grass[0], TERRAIN_PALETTE.grass[1], blend * 2)
    : mixHexColor(TERRAIN_PALETTE.grass[1], TERRAIN_PALETTE.grass[2], (blend - 0.5) * 2);
  const sandColor = blend < 0.5
    ? mixHexColor(TERRAIN_PALETTE.sand[0], TERRAIN_PALETTE.sand[1], blend * 2)
    : mixHexColor(TERRAIN_PALETTE.sand[1], TERRAIN_PALETTE.sand[2], (blend - 0.5) * 2);
  const stoneColor = blend < 0.5
    ? mixHexColor(TERRAIN_PALETTE.stone[0], TERRAIN_PALETTE.stone[1], blend * 2)
    : mixHexColor(TERRAIN_PALETTE.stone[1], TERRAIN_PALETTE.stone[2], (blend - 0.5) * 2);

  let fill = mixHexColor(
    mixHexColor(grassColor, sandColor, sandWeight),
    stoneColor,
    stoneWeight
  );

  const tintNoise = hash2D(worldX * 0.16, worldY * 0.16, seed + 287) * 2 - 1;
  const tintColor = tintNoise > 0 ? "rgb(134, 120, 92)" : "rgb(84, 110, 113)";
  fill = mixHexColor(fill, tintColor, 0.02 + Math.abs(tintNoise) * 0.045);
  fill = shadeColor(fill, (detailNoise - 0.5) * 0.1 + (materialNoise - 0.5) * 0.06);

  let speckColor = terrainType === "sand" ? "rgba(108, 86, 44, {a})" : terrainType === "stone" ? "rgba(66, 76, 84, {a})" : "rgba(76, 104, 86, {a})";
  const microContrast = (hash2D(worldX * 0.18, worldY * 0.18, seed + 287) - 0.5) * 0.26;
  fill = shadeColor(fill, microContrast * 0.38);
  let speckAlpha = materialNoise > 0.7 ? 0.022 + materialNoise * 0.03 : 0;

  let waterDepth = 0;
  iterateWorldFeaturesInBounds(
    worldX - TERRAIN_TILE_SIZE,
    worldY - TERRAIN_TILE_SIZE,
    worldX + TERRAIN_TILE_SIZE,
    worldY + TERRAIN_TILE_SIZE,
    (feature) => {
      if (feature.group !== "water") {
        return;
      }
      for (const circle of feature.circles) {
        const distance = Math.hypot(worldX - circle.x, worldY - circle.y);
        if (distance >= circle.r) {
          continue;
        }
        waterDepth = Math.max(waterDepth, 1 - distance / circle.r);
      }
    }
  );

  if (waterDepth > 0.06) {
    terrainType = "water";
    speckColor = "rgba(180, 224, 246, {a})";
    speckAlpha = 0.01 + waterDepth * 0.018;
    const waterBlend = clamp(0.08 + detailNoise * 0.32 + waterDepth * 0.58, 0, 1);
    const waterColor = waterBlend < 0.5
      ? mixHexColor(TERRAIN_PALETTE.water[0], TERRAIN_PALETTE.water[1], waterBlend * 2)
      : mixHexColor(TERRAIN_PALETTE.water[1], TERRAIN_PALETTE.water[2], (waterBlend - 0.5) * 2);
    const shoreBlend = smoothstep(0.06, 0.24, waterDepth);
    fill = mixHexColor(fill, waterColor, shoreBlend);
  }

  const base = {
    type: terrainType,
    baseFill: fill,
    waterDepth,
    speckColor,
    speckAlpha,
    speckX: 4 + Math.floor(hash2D(worldX * 0.1, worldY * 0.1, seed + 303) * 10),
    speckY: 4 + Math.floor(hash2D(worldX * 0.12, worldY * 0.12, seed + 317) * 10),
    speckSize: 1 + Math.floor(hash2D(worldX * 0.08, worldY * 0.08, seed + 331) * 2),
  };
  TERRAIN_TILE_CACHE.set(cacheKey, base);
  return base;
}

function sampleTerrainTile(worldX, worldY) {
  const base = getTerrainTileBase(worldX, worldY);
  let fill = base.baseFill;

  if (base.waterDepth > 0.06) {
    const rippleWave =
      Math.sin(state.elapsed * (1.8 + base.waterDepth * 1.6) + worldX * 0.02 + worldY * 0.016) * 0.5 +
      Math.sin(state.elapsed * (2.6 + base.waterDepth * 2.2) - worldX * 0.017 + worldY * 0.022) * 0.5;
    const rippleStrength = base.waterDepth * 0.16;
    fill = shadeColor(fill, rippleWave * rippleStrength);
  }

  return {
    type: base.type,
    fill,
    speckColor: base.speckColor,
    speckAlpha: base.speckAlpha,
    speckX: base.speckX,
    speckY: base.speckY,
    speckSize: base.speckSize,
  };
}

function positiveModulo(value, modulo) {
  return ((value % modulo) + modulo) % modulo;
}

function randRange(min, max) {
  return min + Math.random() * (max - min);
}

function tintAlpha(color, alpha) {
  return color.replace("{a}", alpha.toFixed(3));
}

function colorWithAlpha(color, alpha) {
  const resolved = color.includes("{a}") ? color.replace("{a}", "1") : color;
  const rgb = parseColorComponents(resolved);
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha.toFixed(3)})`;
}

function resolveEffectPalette(effect) {
  const primaryRaw = effect.color.includes("{a}") ? effect.color.replace("{a}", "1") : effect.color;
  const secondaryRaw = (effect.secondaryColor ?? effect.color).includes("{a}")
    ? (effect.secondaryColor ?? effect.color).replace("{a}", "1")
    : (effect.secondaryColor ?? effect.color);
  const tertiaryRaw = effect.tertiaryColor
    ? (effect.tertiaryColor.includes("{a}") ? effect.tertiaryColor.replace("{a}", "1") : effect.tertiaryColor)
    : mixHexColor(primaryRaw, secondaryRaw, 0.5);
  const darkRaw = effect.darkColor
    ? (effect.darkColor.includes("{a}") ? effect.darkColor.replace("{a}", "1") : effect.darkColor)
    : shadeColor(secondaryRaw, -0.24);
  const lightRaw = effect.lightColor
    ? (effect.lightColor.includes("{a}") ? effect.lightColor.replace("{a}", "1") : effect.lightColor)
    : shadeColor(tertiaryRaw, 0.18);
  return {
    primaryRaw,
    secondaryRaw,
    tertiaryRaw,
    darkRaw,
    lightRaw,
    primary: (alpha) => colorWithAlpha(primaryRaw, alpha),
    secondary: (alpha) => colorWithAlpha(secondaryRaw, alpha),
    tertiary: (alpha) => colorWithAlpha(tertiaryRaw, alpha),
    dark: (alpha) => colorWithAlpha(darkRaw, alpha),
    light: (alpha) => colorWithAlpha(lightRaw, alpha),
  };
}

function pushEffect(effect) {
  const tier = getFxTier();
  const cap = tier >= 2 ? 90 : tier >= 1 ? 140 : 220;
  if (state.effects.length >= cap) {
    state.effects.splice(0, state.effects.length - (cap - 1));
  }
  effect.seed ??= Math.random() * Math.PI * 2;
  effect.seed2 ??= Math.random() * Math.PI * 2;
  state.effects.push(effect);
}

function spawnCastEffect(x, y, dirX, dirY) {
  const classDef = getClassDef();
  const color = parseColorComponents(classDef.color);
  pushEffect({
    kind: "ring",
    x: x + dirX * 8,
    y: y + dirY * 8,
    life: 0.16,
    maxLife: 0.16,
    size: 5,
    growth: 15,
    lineWidth: 2.5,
    color: `rgba(${color.r}, ${color.g}, ${color.b}, {a})`,
  });
}

function spawnDashEffect(x, y, dirX, dirY) {
  pushEffect({
    kind: "ring",
    x,
    y,
    life: 0.24,
    maxLife: 0.24,
    size: 10,
    growth: 36,
    lineWidth: 3,
    color: "rgba(146, 239, 203, {a})",
  });

  for (let i = 0; i < scaleFxCount(8); i += 1) {
    const spreadX = dirX * randRange(120, 220) + randRange(-70, 70);
    const spreadY = dirY * randRange(120, 220) + randRange(-70, 70);
    pushEffect({
      kind: "spark",
      x: x - dirX * randRange(4, 16),
      y: y - dirY * randRange(4, 16),
      vx: spreadX,
      vy: spreadY,
      life: randRange(0.16, 0.28),
      maxLife: 0.28,
      size: randRange(2.4, 4.2),
      color: "rgba(166, 250, 214, {a})",
    });
  }
}

function spawnHealPickupEffect(x, y) {
  spawnPickupCollectEffect(x, y, {
    ringColor: "rgba(120, 255, 173, {a})",
    sparkColor: "rgba(163, 255, 196, {a})",
    lineColor: "rgba(204, 255, 221, {a})",
  });
}

function spawnXpPickupEffect(x, y, scale = 1) {
  spawnPickupCollectEffect(x, y, {
    ringColor: "rgba(255, 221, 92, {a})",
    sparkColor: "rgba(255, 235, 154, {a})",
    lineColor: "rgba(255, 248, 208, {a})",
  }, scale);
}

function spawnPickupCollectEffect(x, y, palette, scale = 1) {
  pushEffect({
    kind: "ring",
    x,
    y,
    life: 0.28,
    maxLife: 0.28,
    size: 8 * scale,
    growth: 26 * scale,
    lineWidth: 3 * Math.sqrt(scale),
    color: palette.ringColor,
  });

  for (let i = 0; i < scaleFxCount(Math.round(6 * Math.max(1, scale))); i += 1) {
    const angle = (i / 6) * Math.PI * 2 + randRange(-0.16, 0.16);
    const speed = randRange(52, 120);
    pushEffect({
      kind: "spark",
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 18,
      life: randRange(0.18, 0.32),
      maxLife: 0.32,
      size: randRange(2.6, 4.2) * Math.min(1.35, Math.sqrt(scale)),
      color: palette.sparkColor,
    });
  }

  for (let i = 0; i < scaleFxCount(Math.round(4 * Math.max(1, scale))); i += 1) {
    pushEffect({
      kind: "ember",
      x: x + randRange(-5, 5),
      y: y - randRange(2, 10),
      vx: randRange(-20, 20),
      vy: -randRange(70, 125),
      life: randRange(0.28, 0.44),
      maxLife: 0.44,
      size: randRange(3.4, 5.2) * Math.min(1.35, Math.sqrt(scale)),
      color: palette.sparkColor,
    });
  }

  pushEffect({
    kind: "ring",
    x,
    y,
    life: 0.2,
    maxLife: 0.2,
    size: 4 * scale,
    growth: 14 * scale,
    lineWidth: 2.4 * Math.sqrt(scale),
    color: palette.lineColor,
  });
}

function spawnPickupSpawnEffect(x, y, type) {
  const isXp = type === "xp-orb" || type === "xp-cache";
  const ringColor = isXp ? "rgba(255, 223, 104, {a})" : "rgba(124, 255, 183, {a})";
  const glowColor = isXp ? "rgba(255, 239, 178, {a})" : "rgba(200, 255, 221, {a})";

  pushEffect({
    kind: "ring",
    x,
    y,
    life: 0.24,
    maxLife: 0.24,
    size: 3,
    growth: 18,
    lineWidth: 2.2,
    color: ringColor,
  });

  for (let i = 0; i < scaleFxCount(5); i += 1) {
    const angle = (i / 5) * Math.PI * 2 + randRange(-0.22, 0.22);
    pushEffect({
      kind: "spark",
      x,
      y,
      vx: Math.cos(angle) * randRange(18, 54),
      vy: Math.sin(angle) * randRange(18, 54) - 12,
      life: randRange(0.16, 0.24),
      maxLife: 0.24,
      size: randRange(2, 3.2),
      color: glowColor,
    });
  }
}

function getSkillCastPalette(skillId) {
  if (WIND_EFFECT_KINDS.has(skillId)) {
    return {
      ringColor: "rgba(167, 227, 235, {a})",
      sparkColor: "rgba(188, 241, 245, {a})",
      emberColor: "rgba(155, 226, 190, {a})",
      lineColor: "rgba(208, 245, 247, {a})",
    };
  }
  if (FROST_EFFECT_KINDS.has(skillId)) {
    return {
      ringColor: "rgba(158, 218, 255, {a})",
      sparkColor: "rgba(208, 240, 255, {a})",
      emberColor: "rgba(166, 177, 255, {a})",
      lineColor: "rgba(221, 245, 255, {a})",
    };
  }
  if (FIRE_EFFECT_KINDS.has(skillId)) {
    return {
      ringColor: "rgba(255, 189, 82, {a})",
      sparkColor: "rgba(255, 221, 140, {a})",
      emberColor: "rgba(255, 112, 40, {a})",
      lineColor: "rgba(255, 208, 112, {a})",
    };
  }
  if (NECRO_EFFECT_KINDS.has(skillId)) {
    return {
      ringColor: "rgba(121, 210, 163, {a})",
      sparkColor: "rgba(181, 244, 211, {a})",
      emberColor: "rgba(121, 141, 234, {a})",
      lineColor: "rgba(187, 244, 219, {a})",
    };
  }
  return {
    ringColor: "rgba(220, 92, 128, {a})",
    sparkColor: "rgba(248, 168, 192, {a})",
    emberColor: "rgba(236, 72, 170, {a})",
    lineColor: "rgba(255, 198, 214, {a})",
  };
}

function spawnSkillCastAccent(skillId, x, y) {
  const palette = getSkillCastPalette(skillId);
  pushEffect({
    kind: "ring",
    x,
    y,
    life: 0.18,
    maxLife: 0.18,
    size: 6,
    growth: 28,
    lineWidth: 2.6,
    color: palette.ringColor,
    renderLayer: "top",
  });

  for (let i = 0; i < scaleFxCount(8); i += 1) {
    const angle = (i / 8) * Math.PI * 2 + randRange(-0.16, 0.16);
    const speed = randRange(44, 116);
    pushEffect({
      kind: "spark",
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: randRange(0.16, 0.28),
      maxLife: 0.28,
      size: randRange(2.2, 4.2),
      color: palette.sparkColor,
      renderLayer: "top",
    });
  }

  for (let i = 0; i < scaleFxCount(4); i += 1) {
    const angle = (i / 4) * Math.PI * 2 + randRange(-0.2, 0.2);
    const reach = randRange(18, 42);
    pushEffect({
      kind: "line",
      x,
      y,
      x2: x + Math.cos(angle) * reach,
      y2: y + Math.sin(angle) * reach,
      life: 0.16,
      maxLife: 0.16,
      lineWidth: randRange(2.6, 4.2),
      size: reach,
      color: palette.lineColor,
      renderLayer: "top",
    });
  }

  for (let i = 0; i < scaleFxCount(4); i += 1) {
    pushEffect({
      kind: "ember",
      x: x + randRange(-6, 6),
      y: y + randRange(-6, 6),
      vx: randRange(-26, 26),
      vy: -randRange(28, 82),
      life: randRange(0.2, 0.34),
      maxLife: 0.34,
      size: randRange(2.6, 4.4),
      color: palette.emberColor,
      renderLayer: "top",
    });
  }
}

function spawnHolyLevelUpNova(x, y, level) {
  pushEffect({
    kind: "holy-wave",
    x,
    y,
    followPlayer: true,
    followOffsetX: 0,
    followOffsetY: 0,
    life: 1.36,
    maxLife: 1.36,
    size: 24,
    growth: 62,
    thickness: 22,
    lineWidth: 13,
    damage: 118 + level * 4,
    color: "rgba(255, 235, 168, {a})",
    tailLife: 0.34,
    tailAlphaStart: 0.12,
    renderLayer: "top",
    hitIds: new Set(),
  });

  pushEffect({
    kind: "ring",
    x,
    y,
    followPlayer: true,
    followOffsetX: 0,
    followOffsetY: 0,
    life: 0.82,
    maxLife: 0.82,
    size: 12,
    growth: 46,
    lineWidth: 7.5,
    color: "rgba(255, 246, 206, {a})",
    renderLayer: "top",
  });

  pushEffect({
    kind: "holy-text",
    x,
    y: y - 30,
    followPlayer: true,
    followOffsetX: 0,
    followOffsetY: -30,
    life: 1.02,
    maxLife: 1.02,
    size: 24,
    color: "rgba(255, 234, 150, {a})",
    renderLayer: "top",
  });

  for (let i = 0; i < scaleFxCount(18); i += 1) {
    const angle = (i / 14) * Math.PI * 2 + randRange(-0.12, 0.12);
    const speed = randRange(54, 150);
    pushEffect({
      kind: "ember",
      x: x + Math.cos(angle) * randRange(6, 14),
      y: y + Math.sin(angle) * randRange(6, 14),
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - randRange(18, 44),
      life: randRange(0.24, 0.42),
      maxLife: 0.42,
      size: randRange(2.6, 5.2),
      color: "rgba(255, 234, 150, {a})",
      renderLayer: "top",
    });
  }
}

function spawnSparkBurst(x, y, color, amount = 4) {
  pushEffect({
    kind: "ring",
    x,
    y,
    life: 0.14,
    maxLife: 0.14,
    size: 3,
    growth: 11,
    lineWidth: 1.8,
    color,
  });

  for (let i = 0; i < scaleFxCount(amount); i += 1) {
    const angle = (i / Math.max(1, amount)) * Math.PI * 2 + randRange(-0.35, 0.35);
    const speed = randRange(40, 118);
    pushEffect({
      kind: "spark",
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: randRange(0.1, 0.18),
      maxLife: 0.18,
      size: randRange(1.8, 3.2),
      color,
    });
  }
}

function spawnHitEffect(x, y, palette, dirX, dirY) {
  const color =
    palette === "icy"
      ? "rgba(100, 196, 255, {a})"
      : palette === "holy"
        ? "rgba(255, 239, 168, {a})"
        : "rgba(255, 211, 116, {a})";

  pushEffect({
    kind: "ring",
    x,
    y,
    life: 0.2,
    maxLife: 0.2,
    size: 4,
    growth: 17,
    lineWidth: 2.6,
    color,
  });

  for (let i = 0; i < scaleFxCount(4); i += 1) {
    const spreadX = dirX * randRange(40, 120) + randRange(-90, 90);
    const spreadY = dirY * randRange(40, 120) + randRange(-90, 90);
    pushEffect({
      kind: "spark",
      x: x + randRange(-3, 3),
      y: y + randRange(-3, 3),
      vx: spreadX,
      vy: spreadY,
      life: randRange(0.14, 0.26),
      maxLife: 0.26,
      size: randRange(2.4, 4.8),
      color,
    });
  }
}

function spawnDefeatEffect(enemy) {
  const colorByType = {
    grunt: "rgba(141, 228, 162, {a})",
    tank: "rgba(255, 190, 122, {a})",
    runner: "rgba(150, 216, 255, {a})",
    hexer: "rgba(173, 116, 255, {a})",
    fang: "rgba(255, 176, 110, {a})",
    wraith: "rgba(128, 218, 255, {a})",
    oracle: "rgba(129, 193, 255, {a})",
    brood: "rgba(189, 152, 255, {a})",
    banner: "rgba(168, 116, 255, {a})",
    mortar: "rgba(214, 148, 255, {a})",
    bulwark: "rgba(232, 182, 144, {a})",
    countess: "rgba(255, 109, 142, {a})",
    colossus: "rgba(242, 183, 109, {a})",
    abyss: "rgba(145, 162, 255, {a})",
    matriarch: "rgba(204, 122, 255, {a})",
    harbinger: "rgba(176, 148, 255, {a})",
    regent: "rgba(255, 194, 112, {a})",
  };
  const color = colorByType[enemy.type] ?? "rgba(255, 219, 148, {a})";

  pushEffect({
    kind: "ring",
    x: enemy.x,
    y: enemy.y,
    life: 0.34,
    maxLife: 0.34,
    size: enemy.radius * 0.5,
    growth: enemy.radius + 12,
    lineWidth: 3,
    color,
  });

  for (let i = 0; i < scaleFxCount(6); i += 1) {
    const angle = (i / 6) * Math.PI * 2 + randRange(-0.28, 0.28);
    const speed = randRange(70, 160);
    pushEffect({
      kind: "ember",
      x: enemy.x,
      y: enemy.y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: randRange(0.26, 0.4),
      maxLife: 0.4,
      size: randRange(2.6, 5.8),
      color,
    });
  }
}

function spawnPlayerDamageEffect(x, y, intensity) {
  const safeIntensity = clamp(intensity, 0.06, 0.38);
  pushEffect({
    kind: "ring",
    x,
    y,
    life: 0.22,
    maxLife: 0.22,
    size: 12,
    growth: 24 + safeIntensity * 40,
    lineWidth: 3,
    color: "rgba(255, 104, 104, {a})",
  });
}

function spawnHostileImpactEffect(x, y, color) {
  pushEffect({
    kind: "ring",
    x,
    y,
    life: 0.18,
    maxLife: 0.18,
    size: 8,
    growth: 20,
    lineWidth: 3,
    color,
  });
}

function spawnMeteorImpactEffect(x, y, color) {
  pushEffect({
    kind: "ring",
    x,
    y,
    life: 0.28,
    maxLife: 0.28,
    size: 12,
    growth: 30,
    lineWidth: 4,
    color,
  });
  for (let i = 0; i < 8; i += 1) {
    const angle = (i / 8) * Math.PI * 2 + randRange(-0.25, 0.25);
    const speed = randRange(90, 180);
    pushEffect({
      kind: "ember",
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: randRange(0.18, 0.34),
      maxLife: 0.34,
      size: randRange(3, 5.8),
      color,
    });
  }
}

function spawnChannelEffect(x, y, color, size, duration) {
  pushEffect({
    kind: "ring",
    x,
    y,
    life: duration,
    maxLife: duration,
    size,
    growth: 10,
    lineWidth: 2.4,
    color: HOSTILE_ARCANE_COLOR,
  });
}

function spawnBossPhaseEffect(x, y, color) {
  pushEffect({
    kind: "ring",
    x,
    y,
    life: 0.45,
    maxLife: 0.45,
    size: 38,
    growth: 54,
    lineWidth: 5,
    color: HOSTILE_ARCANE_COLOR,
  });
}

function spawnBossIntroEffect(enemy) {
  pushEffect({
    kind: "ring",
    x: enemy.x,
    y: enemy.y,
    life: 0.55,
    maxLife: 0.55,
    size: enemy.radius * 0.8,
    growth: enemy.radius + 44,
    lineWidth: 5,
    color: HOSTILE_ARCANE_COLOR,
  });
}

function spawnLineEffect(x1, y1, x2, y2, duration, color, thickness) {
  pushEffect({
    kind: "line",
    x: x1,
    y: y1,
    x2,
    y2,
    life: duration,
    maxLife: duration,
    color: HOSTILE_ARCANE_COLOR,
    lineWidth: thickness,
    size: 12,
  });
}

function spawnEnemyBolt(enemy, targetX, targetY, spec) {
  const dx = targetX - enemy.x;
  const dy = targetY - enemy.y;
  const distance = Math.hypot(dx, dy) || 1;
  state.enemyAttacks.push({
    kind: "projectile",
    x: enemy.x,
    y: enemy.y,
    vx: (dx / distance) * spec.speed,
    vy: (dy / distance) * spec.speed,
    radius: spec.radius,
    damage: spec.damage,
    color: ENEMY_PROJECTILE_COLOR,
    life: spec.life,
    dead: false,
  });
}

function spawnEnemyBurst(x, y, spec) {
  state.enemyAttacks.push({
    kind: "burst",
    x,
    y,
    radius: spec.radius,
    damage: spec.damage,
    color: HOSTILE_ARCANE_COLOR,
    telegraphTime: spec.telegraphTime,
    maxTelegraphTime: spec.telegraphTime,
    life: spec.telegraphTime + 0.05,
    triggered: false,
    dead: false,
  });
}

function spawnShockwave(x, y, spec) {
  state.enemyAttacks.push({
    kind: "shockwave",
    x,
    y,
    radius: spec.radius,
    maxRadius: spec.radius,
    currentRadius: 24,
    speed: spec.speed,
    thickness: spec.thickness,
    damage: spec.damage,
    color: HOSTILE_ARCANE_COLOR,
    telegraphTime: spec.telegraphTime,
    maxTelegraphTime: spec.telegraphTime,
    life: spec.telegraphTime + spec.radius / spec.speed + 0.2,
    hitPlayer: false,
    dead: false,
  });
}

function spawnMeteorStrike(x, y, spec) {
  state.enemyAttacks.push({
    kind: "meteor",
    x,
    y,
    radius: spec.radius,
    damage: spec.damage,
    color: HOSTILE_ARCANE_COLOR,
    telegraphTime: spec.telegraphTime,
    maxTelegraphTime: spec.telegraphTime,
    life: spec.telegraphTime + 0.05,
    triggered: false,
    dead: false,
  });
}

function spawnBossFan(enemy, player, count, spread, speed, damage, color) {
  const dx = player.x - enemy.x;
  const dy = player.y - enemy.y;
  const baseAngle = Math.atan2(dy, dx);

  for (let i = 0; i < count; i += 1) {
    const offset = count === 1 ? 0 : (i / (count - 1) - 0.5) * spread;
    const angle = baseAngle + offset;
    state.enemyAttacks.push({
      kind: "projectile",
      x: enemy.x,
      y: enemy.y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      radius: 8,
      damage,
      color: ENEMY_PROJECTILE_COLOR,
      life: 3.5,
      dead: false,
    });
  }
}

function spawnBossRadial(enemy, count, speed, damage, color) {
  for (let i = 0; i < count; i += 1) {
    const angle = (i / count) * Math.PI * 2;
    state.enemyAttacks.push({
      kind: "projectile",
      x: enemy.x,
      y: enemy.y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      radius: 8,
      damage,
      color: ENEMY_PROJECTILE_COLOR,
      life: 3.8,
      dead: false,
    });
  }
}

function spawnBeamAttack(x1, y1, x2, y2, spec) {
  state.enemyAttacks.push({
    kind: "beam",
    x: x1,
    y: y1,
    x2,
    y2,
    width: spec.width,
    damage: spec.damage,
    color: HOSTILE_ARCANE_COLOR,
    telegraphTime: spec.telegraphTime,
    maxTelegraphTime: spec.telegraphTime,
    activeTime: spec.activeTime,
    life: spec.telegraphTime + spec.activeTime + 0.02,
    hitPlayer: false,
    dead: false,
  });
}

function spawnBossMinions(enemy, roster) {
  for (let i = 0; i < roster.length; i += 1) {
    if (state.enemies.length >= state.spawnDirector.maxEnemiesOnField) {
      return;
    }
    state.enemies.push(createEnemy(roster[i], { x: enemy.x, y: enemy.y }, i, roster.length));
  }
}

function damagePlayer(rawDamage, source = null) {
  if (rawDamage <= 0 || !state.running) {
    return;
  }

  const player = state.player;
  if (player.dash.iFramesTimer > 0) {
    return;
  }

  const reducedDamage = rawDamage * (1 - player.damageReduction);
  recordTelemetryDamage(rawDamage, reducedDamage, source);
  player.hitFlash = clamp(player.hitFlash + reducedDamage / player.maxHp, 0, 1);
  player.hitShakeTimer = 0.22;
  player.hitShakePower = Math.max(player.hitShakePower, 3.6 + reducedDamage * 0.2);
  state.hudMotion.playerBarShakeTimer = 0.24;
  state.cameraShake.timer = 0.2;
  state.cameraShake.power = Math.max(state.cameraShake.power, 5.4 + reducedDamage * 0.24);
  spawnPlayerDamageEffect(player.x, player.y, reducedDamage / Math.max(8, player.maxHp));

  if (state.dev.zenMode) {
    player.hp = player.maxHp;
    updateHud(false);
    return;
  }

  player.hp = Math.max(0, player.hp - reducedDamage);
  updateHud(false);
  if (player.hp <= 0) {
    endRun();
  }
}

function cellKey(x, y) {
  return `${x},${y}`;
}

function getHealthBarColor(hpRatio) {
  if (hpRatio > 0.66) {
    return "#6fd46d";
  }
  if (hpRatio > 0.33) {
    return "#f0c25e";
  }
  return "#ea6658";
}

function circlesOverlap(ax, ay, ar, bx, by, br) {
  const dx = bx - ax;
  const dy = by - ay;
  const distance = ar + br;
  return dx * dx + dy * dy <= distance * distance;
}

function isPlayerTouchingRing(player, x, y, radius, thickness) {
  const distance = Math.hypot(player.x - x, player.y - y);
  return Math.abs(distance - radius) <= thickness;
}

function distancePointToSegment(px, py, ax, ay, bx, by) {
  const abX = bx - ax;
  const abY = by - ay;
  const abLengthSq = abX * abX + abY * abY;
  if (abLengthSq <= 0.0001) {
    return Math.hypot(px - ax, py - ay);
  }

  const t = clamp(((px - ax) * abX + (py - ay) * abY) / abLengthSq, 0, 1);
  const closestX = ax + abX * t;
  const closestY = ay + abY * t;
  return Math.hypot(px - closestX, py - closestY);
}

function isInsideWorld(x, y, padding) {
  return (
    x >= WORLD.left - padding &&
    x <= WORLD.right + padding &&
    y >= WORLD.top - padding &&
    y <= WORLD.bottom + padding
  );
}

function getPrimaryBoss() {
  for (const enemy of state.enemies) {
    if (!enemy.dead && enemy.isBoss) {
      return enemy;
    }
  }
  return null;
}

function collectNearestEnemies(limit) {
  const nearest = [];

  for (const enemy of state.enemies) {
    if (enemy.dead) {
      continue;
    }

    const dx = enemy.x - state.player.x;
    const dy = enemy.y - state.player.y;
    const distanceSq = dx * dx + dy * dy;

    if (nearest.length < limit) {
      nearest.push({ enemy, distanceSq });
      nearest.sort((a, b) => a.distanceSq - b.distanceSq);
      continue;
    }

    if (distanceSq >= nearest[nearest.length - 1].distanceSq) {
      continue;
    }

    nearest[nearest.length - 1] = { enemy, distanceSq };
    nearest.sort((a, b) => a.distanceSq - b.distanceSq);
  }

  return nearest.map((entry) => entry.enemy);
}

window.render_game_to_text = function renderGameToText() {
  let mode = "running";
  if (!state.running && !startOverlay.classList.contains("hidden")) {
    mode = "start_menu";
  } else if (!state.running) {
    mode = "game_over";
  } else if (state.bossReward.active) {
    mode = "boss_reward";
  } else if (state.levelUp.active) {
    mode = "level_up";
  } else if (isPauseActive()) {
    mode = "paused";
  }

  const visibleFeatures = { water: 0, solids: 0 };
  iterateWorldFeaturesInBounds(
    state.player.x - viewWidth * 0.75,
    state.player.y - viewHeight * 0.75,
    state.player.x + viewWidth * 0.75,
    state.player.y + viewHeight * 0.75,
    (feature) => {
      if (feature.group === "water") {
        visibleFeatures.water += 1;
      } else {
        visibleFeatures.solids += 1;
      }
    }
  );

  const payload = {
    mode,
    coordinateSystem: {
      origin: "world(0,0) at arena center",
      axes: "+x right, +y down",
    },
    timeSeconds: Number(state.elapsed.toFixed(2)),
    kills: state.kills,
    level: state.progression.level,
    xp: Number(state.progression.xp.toFixed(1)),
    xpToNext: state.progression.xpToNext,
    rewardQueue: [...state.progression.rewardQueue],
    class: {
      id: state.player.classId,
      title: getClassDef().title,
    },
    player: {
      x: Number(state.player.x.toFixed(1)),
      y: Number(state.player.y.toFixed(1)),
      hp: Number(state.player.hp.toFixed(1)),
      maxHp: state.player.maxHp,
      fireCooldown: Number(state.player.fireCooldown.toFixed(3)),
      fireInterval: Number(state.player.weapon.fireInterval.toFixed(3)),
      projectileDamage: Number(state.player.weapon.projectileDamage.toFixed(1)),
      projectilePierce: state.player.weapon.projectilePierce,
      extraProjectiles: state.player.weapon.extraProjectiles,
      dashCharges: state.player.dash.charges,
      dashMaxCharges: state.player.dash.maxCharges,
      dashRechargeTime: Number(state.player.dash.rechargeTime.toFixed(2)),
      dashRechargeTimer: Number(state.player.dash.rechargeTimer.toFixed(2)),
      dashDistance: Number(state.player.dash.distance.toFixed(1)),
      isDashing: state.player.dash.activeTimer > 0,
      unlockedSkills: getUnlockedSkillStates().map((skill) => ({
        id: skill.id,
        slot: skill.slot,
        mastery: skill.mastery,
        timer: Number(skill.timer.toFixed(2)),
      })),
    },
    levelUpOptions: state.levelUp.options.map((option) => ({
      id: option.id,
      icon: option.icon,
      title: option.title,
      family: option.familyLabel ?? option.family,
      tier: option.tier,
      milestone: Boolean(option.milestone),
      effect: option.effectText,
      stacks: option.stacks,
      maxStacks: option.maxStacks,
    })),
    bossRewardOptions: state.bossReward.options.map((option) => ({
      id: option.id,
      title: option.title,
      icon: option.icon,
      boss: state.bossReward.bossName,
      effect: option.effectText(),
    })),
    enemiesOnField: state.enemies.length,
    activeBosses: state.enemies
      .filter((enemy) => !enemy.dead && enemy.isBoss)
      .map((enemy) => ({
        type: enemy.type,
        name: enemy.bossName,
        hp: Number(enemy.hp.toFixed(1)),
        maxHp: Number(enemy.maxHp.toFixed(1)),
        hpScale: Number((enemy.hpScale ?? 1).toFixed(3)),
        state: enemy.state,
        phase: enemy.phase,
      })),
    primaryBossIndicator: (() => {
      const boss = getPrimaryBoss();
      if (!boss) {
        return null;
      }
      const screen = worldToScreen(boss.x, boss.y);
      return {
        name: boss.bossName,
        onScreen: isVisible(screen.x, screen.y, boss.radius + 28),
        screenX: screen.x,
        screenY: screen.y,
      };
    })(),
    nextBossAt: Number.isFinite(state.bossDirector.nextTime) ? Number(state.bossDirector.nextTime.toFixed(1)) : null,
    bossEncounterIndex: state.bossDirector.encounterIndex,
    enemyAttacksOnField: state.enemyAttacks.length,
    nearestEnemies: collectNearestEnemies(20).map((enemy) => ({
      type: enemy.type,
      x: Number(enemy.x.toFixed(1)),
      y: Number(enemy.y.toFixed(1)),
      hp: Number(enemy.hp.toFixed(1)),
      hpScale: Number((enemy.hpScale ?? 1).toFixed(3)),
      slow: Number(enemy.slowAmount.toFixed(2)),
      statuses: {
        wind: (enemy.statusFlash?.wind ?? 0) > 0,
        chill: enemy.chillStacks > 0,
        freeze: enemy.freezeTimer > 0,
        brittle: enemy.brittleTimer > 0,
        burn: enemy.burnTimer > 0,
        necro: enemy.necroMarkTimer > 0,
        blood: enemy.bloodMarkTimer > 0,
        haste: enemy.hasteTimer > 0,
      },
    })),
    projectilesOnField: state.projectiles.length,
    alliesOnField: state.allies.length,
    activeEffects: state.effects.map((effect) => effect.kind),
    visibleFeatures,
    pickups: state.pickups.map((pickup) => ({
      type: pickup.type,
      x: Number(pickup.x.toFixed(1)),
      y: Number(pickup.y.toFixed(1)),
      life: Number(pickup.life.toFixed(1)),
      xpAmount: pickup.xpAmount ?? null,
      absorbing: Boolean(pickup.absorbing),
    })),
    bossBlessings: { ...state.bossBlessings },
    bossDefeats: { ...state.bossDefeats },
    bossSeen: { ...state.bossSeen },
    majorChoices: { ...state.majorChoices },
    majorRanks: Object.fromEntries(
      MAJOR_UPGRADE_PAIRS.flatMap((pair) => [pair.left.id, pair.right.id])
        .map((id) => [id, state.upgrades[id] ?? 0])
        .filter(([, stacks]) => stacks > 0)
    ),
    meta: {
      unlockedClasses: { ...metaProgress.unlocked },
      selectedClassId: metaProgress.selectedClassId,
      targetClassId: metaProgress.unlockState.targetClassId,
      targetXp: metaProgress.unlockState.xp,
      targetKills: metaProgress.unlockState.kills,
    },
    telemetry: state.telemetry ? {
      levelTimings: { ...state.telemetry.levelTimings },
      rewardChoices: state.telemetry.rewardChoices.slice(-8),
      bossEncounters: state.telemetry.bossEncounters,
      totalDamageTaken: state.telemetry.totalDamageTaken,
      damageTakenBySource: { ...state.telemetry.damageTakenBySource },
      recentDamage: state.telemetry.recentDamage,
      final: state.telemetry.final,
    } : null,
    fps: state.performance.fpsDisplay,
    dev: {
      zenMode: state.dev.zenMode,
      devMenuOpen: state.pause.devMenu,
      bossChoice: state.dev.bossChoice,
      disableSpawns: state.dev.disableSpawns,
      manualSkillMode: state.dev.manualSkillMode,
      zeroSkillCooldown: state.dev.zeroSkillCooldown,
    },
  };

  return JSON.stringify(payload, null, 2);
};

window.advanceTime = function advanceTime(ms) {
  deterministicSteppingEnabled = true;
  const steps = Math.max(1, Math.round(ms / (FIXED_STEP * 1000)));
  for (let i = 0; i < steps; i += 1) {
    update(FIXED_STEP);
  }
  render();
};

window.debug_game = {
  spawnBoss(type) {
    spawnBoss(type);
    render();
  },
  damageBoss(amount) {
    const boss = getPrimaryBoss();
    if (!boss) {
      return;
    }
    boss.hp = Math.max(0, boss.hp - amount);
    state.hudMotion.bossBarShakeTimer = 0.24;
    updateHud(false);
    if (boss.hp <= 0) {
      onEnemyDefeated(boss);
    }
    render();
  },
  setZenMode(enabled) {
    setZenMode(Boolean(enabled));
    render();
  },
  setSpawningEnabled(enabled) {
    state.dev.disableSpawns = !enabled;
    render();
  },
  grantXp(amount) {
    grantExperience(amount);
    render();
  },
  giveUpgrade(id, times = 1) {
    for (let i = 0; i < times; i += 1) {
      if (!applyUpgradeById(id)) {
        break;
      }
    }
    render();
  },
  hitPlayer(amount) {
    damagePlayer(amount, {
      key: "debug:manual-hit",
      label: "Debug Manual Hit",
    });
    render();
  },
  openDevMenu() {
    toggleDevMenu();
    render();
  },
  spawnEnemy(type, count = 1) {
    const anchor = pickSpawnPoint();
    for (let i = 0; i < count; i += 1) {
      state.enemies.push(createEnemy(type, anchor, i, count));
    }
    render();
  },
  spawnEnemyAt(type, x, y, count = 1) {
    const anchor = { x, y };
    for (let i = 0; i < count; i += 1) {
      state.enemies.push(createEnemy(type, anchor, i, count));
    }
    render();
  },
  clearEnemies() {
    state.enemies = [];
    state.enemyAttacks = [];
    render();
  },
  triggerSkill(skillRef) {
    const skillState = typeof skillRef === "number"
      ? getSkillState(skillRef)
      : state.player.skills.find((skill) => skill.id === skillRef);
    const bypassCooldown = hasUnlimitedSkillCooldowns();
    if (!skillState || !skillState.unlocked || (!bypassCooldown && skillState.timer > 0.04)) {
      return false;
    }
    const didCast = castPlayerSkill(skillState);
    if (didCast) {
      skillState.timer = bypassCooldown ? 0 : getSkillCooldown(skillState);
    }
    render();
    return didCast;
  },
  setPlayerPosition(x, y) {
    const target = findNearbyWalkablePoint(x, y, state.player.radius, 360);
    state.player.x = target.x;
    state.player.y = target.y;
    render();
  },
  spawnHealPickup() {
    spawnHealPickup();
    render();
  },
  spawnXpPickup() {
    const point = pickPickupPoint(260, 360);
    spawnXpCache(point.x, point.y, 48);
    render();
  },
  getTelemetryHistory() {
    return structuredClone(telemetryStore.runs);
  },
  getLastTelemetryRun() {
    return structuredClone(telemetryStore.runs[telemetryStore.runs.length - 1] ?? null);
  },
  clearTelemetryHistory() {
    telemetryStore = createDefaultTelemetryStore();
    saveTelemetryStore();
    render();
  },
  getNearbyFeatures(radius = 1400) {
    const features = [];
    iterateWorldFeaturesInBounds(
      state.player.x - radius,
      state.player.y - radius,
      state.player.x + radius,
      state.player.y + radius,
      (feature) => {
        features.push({
          type: feature.type,
          group: feature.group,
          x: Number(feature.anchorX.toFixed(1)),
          y: Number(feature.anchorY.toFixed(1)),
          footprintRadius: Number(feature.footprintRadius.toFixed(1)),
        });
      }
    );
    return features;
  },
  unlockAllClasses() {
    for (const classId of CLASS_ORDER) {
      metaProgress.unlocked[classId] = true;
    }
    metaProgress.unlockState = {
      targetClassId: null,
      xp: 0,
      kills: 0,
    };
    saveMetaProgress();
    renderStartOverlay();
  },
  selectClass(classId) {
    if (!CLASS_DEFS[classId]) {
      return false;
    }
    metaProgress.unlocked[classId] = true;
    metaProgress.selectedClassId = classId;
    saveMetaProgress();
    restartRun();
    return true;
  },
  startRun() {
    startRun();
    render();
  },
  unlockAllCurrentSkills() {
    const classDef = getClassDef();
    state.progression.level = Math.max(state.progression.level, 25);
    state.progression.xpToNext = getXpToNext(state.progression.level);
    state.skillUnlocksClaimed = classDef.skills.length;
    for (const skill of state.player.skills) {
      skill.unlocked = true;
      skill.timer = 0;
      skill.unlockPulseTimer = Math.max(skill.unlockPulseTimer, 0.8);
    }
    updateHud(true);
    render();
  },
  primeSkillCooldowns() {
    for (const skill of state.player.skills) {
      if (!skill.unlocked) {
        continue;
      }
      skill.timer = getSkillCooldown(skill);
      skill.castFlashTimer = 0;
    }
    updateHud(true);
    render();
  },
  setManualSkillMode(enabled) {
    state.dev.manualSkillMode = Boolean(enabled);
    if (state.dev.manualSkillMode && state.dev.zeroSkillCooldown) {
      for (const skill of state.player.skills) {
        if (skill.unlocked) {
          skill.timer = 0;
        }
      }
      updateHud(true);
    }
    render();
  },
  setSkillLabZeroCooldown(enabled) {
    state.dev.zeroSkillCooldown = Boolean(enabled);
    for (const skill of state.player.skills) {
      if (skill.unlocked) {
        skill.timer = state.dev.zeroSkillCooldown ? 0 : getSkillCooldown(skill);
      }
    }
    updateHud(true);
    render();
  },
  gainLevel(amount = 1) {
    const levels = Math.max(1, Math.floor(amount));
    for (let i = 0; i < levels; i += 1) {
      grantExperience(Math.max(1, state.progression.xpToNext - state.progression.xp));
    }
    render();
  },
  spawnTrainingDummy(offsetX = 220, offsetY = 0) {
    const enemy = createEnemy("tank", { x: state.player.x + offsetX, y: state.player.y + offsetY }, 0, 1);
    enemy.isTrainingDummy = true;
    enemy.emoji = "\uD83C\uDFAF";
    enemy.speed = 0;
    enemy.contactDamage = 0;
    enemy.maxHp = 999999;
    enemy.hp = 999999;
    enemy.touchCooldown = 999;
    enemy.attackCooldown = 999;
    state.enemies.push(enemy);
    render();
  },
  defeatPrimaryBoss() {
    const boss = getPrimaryBoss();
    if (!boss) {
      return;
    }
    onEnemyDefeated(boss);
    cleanupDeadEntities();
    render();
  },
  setElapsed(seconds) {
    state.elapsed = seconds;
    render();
  },
  endRun() {
    endRun();
    render();
  },
  snapshot() {
    return JSON.parse(window.render_game_to_text());
  },
  inspectCombat() {
    return {
      projectiles: state.projectiles.map((projectile) => ({
        owner: projectile.owner,
        color: projectile.color ?? null,
        rgb: projectile.rgb ?? null,
      })),
      enemyAttacks: state.enemyAttacks.map((attack) => ({
        kind: attack.kind,
        color: attack.color ?? null,
      })),
    };
  },
};

