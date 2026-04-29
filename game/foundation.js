// Shared constants, data tables, DOM references, and global mutable state declarations.
let viewWidth = 960;
let viewHeight = 540;
let renderScale = 1;

const TARGET_FPS = 90;
const TARGET_FRAME_TIME = 1 / TARGET_FPS;
const FIXED_STEP = 1 / TARGET_FPS;
const MAX_FRAME_TIME = 0.12;
const ENEMY_CELL_SIZE = 72;
const ENEMY_NEIGHBOR_OFFSETS = [[1, 0], [0, 1], [1, 1], [-1, 1]];
const RENDER_PIXEL_BUDGETS = [1600 * 900, 1440 * 810, 1280 * 720, 1024 * 576];

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
const TERRAIN_TILE_CACHE_MAX_ENTRIES = 48000;
const TERRAIN_TILE_CACHE_OVERFLOW_BUFFER = 2048;
const TERRAIN_TILE_CACHE_PRUNE_BATCH = 4096;
const TERRAIN_CACHE_MIN_TILE_X = Math.round(WORLD.left / TERRAIN_TILE_SIZE);
const TERRAIN_CACHE_MIN_TILE_Y = Math.round(WORLD.top / TERRAIN_TILE_SIZE);
const TERRAIN_CACHE_TILES_X = Math.round((WORLD.right - WORLD.left) / TERRAIN_TILE_SIZE) + 1;
const PARTICLE_SPRITE_CACHE = new Map();
const SOFT_BURST_SPRITE_CACHE = new Map();
const TERRAIN_CACHE_CANVAS = document.createElement("canvas");
const TERRAIN_CACHE_CTX = TERRAIN_CACHE_CANVAS.getContext("2d", { alpha: false });
const GAME_CONFIG = window.GAME_CONFIG ?? {};
const TERRAIN_PALETTE = GAME_CONFIG.terrainPalette ?? {
  grass: ["#2a472b", "#3e603f", "#4f7950"],
  sand: ["#7d683c", "#977b49", "#b0935a"],
  stone: ["#3f4a66", "#556388", "#6a7ca9"],
  water: ["#14466a", "#1d6392", "#2e84bb"],
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
const EMOJI_ATLAS = {
  requested: false,
  ready: false,
  failed: false,
  image: null,
  map: null,
  cellSize: 64,
  url: "assets/win11-emoji-atlas.png",
};
const EMOJI_TEXT_SEGMENT_REGEX = /(\p{Extended_Pictographic}\uFE0F?)/gu;
const EMOJI_TEXT_TEST_REGEX = /\p{Extended_Pictographic}\uFE0F?/u;
const EMOJI_CLUSTER_REGEX = /\p{Extended_Pictographic}(?:\uFE0F|\p{Emoji_Modifier})?(?:\u200D(?:\p{Extended_Pictographic}|\u2640|\u2642)(?:\uFE0F|\p{Emoji_Modifier})?)*/uy;
const EMOJI_SKIP_TAGS = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "TEXTAREA", "CANVAS", "SVG"]);
let emojiDomObserver = null;
let emojiDomPassScheduled = false;
const emojiPendingRoots = new Set();
let emojiAtlasKeysByLength = [];
const WINDOWS_1252_REVERSE = {
  0x20AC: 0x80,
  0x201A: 0x82,
  0x0192: 0x83,
  0x201E: 0x84,
  0x2026: 0x85,
  0x2020: 0x86,
  0x2021: 0x87,
  0x02C6: 0x88,
  0x2030: 0x89,
  0x0160: 0x8A,
  0x2039: 0x8B,
  0x0152: 0x8C,
  0x017D: 0x8E,
  0x2018: 0x91,
  0x2019: 0x92,
  0x201C: 0x93,
  0x201D: 0x94,
  0x2022: 0x95,
  0x2013: 0x96,
  0x2014: 0x97,
  0x02DC: 0x98,
  0x2122: 0x99,
  0x0161: 0x9A,
  0x203A: 0x9B,
  0x0153: 0x9C,
  0x017E: 0x9E,
  0x0178: 0x9F,
};
const EMOJI_ATLAS_FALLBACKS = {
  "🧝🏻‍♂️": "🧝",
  "🧙🏻‍♂️": "🧙",
  "🫅🏻": "🫅",
  "🧝🏿": "💀",
  "🧛🏻": "🧛",
};

function normalizeEmojiGlyphKey(value) {
  if (!value) {
    return "";
  }
  return String(value).replace(/\uFE0F/g, "");
}

function repairMojibakeEmojiKey(value) {
  if (!value || !/[ÃÂâð]/.test(value)) {
    return value;
  }
  try {
    const bytes = [];
    for (const char of String(value)) {
      const codePoint = char.codePointAt(0);
      bytes.push(WINDOWS_1252_REVERSE[codePoint] ?? (codePoint <= 255 ? codePoint : 63));
    }
    return new TextDecoder("utf-8", { fatal: true }).decode(new Uint8Array(bytes));
  } catch {
    return value;
  }
}

function getEmojiFallbackKeys(emoji) {
  const value = String(emoji ?? "");
  const repaired = repairMojibakeEmojiKey(value);
  const noTone = repaired.replace(/[\u{1F3FB}-\u{1F3FF}]/gu, "");
  const noGender = noTone.replace(/\u200D[\u2640\u2642]\uFE0F?/g, "");
  return [
    value,
    EMOJI_ATLAS_FALLBACKS[value],
    repaired,
    EMOJI_ATLAS_FALLBACKS[repaired],
    normalizeEmojiGlyphKey(repaired),
    noTone,
    EMOJI_ATLAS_FALLBACKS[noTone],
    normalizeEmojiGlyphKey(noTone),
    noGender,
    EMOJI_ATLAS_FALLBACKS[noGender],
    normalizeEmojiGlyphKey(noGender),
  ].filter(Boolean);
}

async function initWin11EmojiAtlas() {
  if (EMOJI_ATLAS.requested || EMOJI_ATLAS.ready || EMOJI_ATLAS.failed) {
    return;
  }
  EMOJI_ATLAS.requested = true;
  try {
    const response = await fetch("assets/win11-emoji-atlas.json", { cache: "force-cache" });
    if (!response.ok) {
      throw new Error(`emoji atlas json ${response.status}`);
    }
    const atlasData = await response.json();
    const image = new Image();
    image.src = EMOJI_ATLAS.url;
    await image.decode();
    EMOJI_ATLAS.image = image;
    const sourceMap = atlasData.map ?? {};
    EMOJI_ATLAS.map = {};
    for (const [key, entry] of Object.entries(sourceMap)) {
      for (const fallbackKey of getEmojiFallbackKeys(key)) {
        EMOJI_ATLAS.map[fallbackKey] = entry;
      }
    }
    EMOJI_ATLAS.cellSize = atlasData.cellSize ?? 64;
    emojiAtlasKeysByLength = Object.keys(EMOJI_ATLAS.map)
      .filter(Boolean)
      .sort((a, b) => b.length - a.length);
    EMOJI_ATLAS.ready = true;
    refreshDomEmojiSprites(document.body);
    if (typeof refreshUpgradeEmojiSprites === "function") {
      refreshUpgradeEmojiSprites(document);
    }
  } catch (error) {
    EMOJI_ATLAS.failed = true;
    console.warn("Win11 emoji atlas unavailable; falling back to system emoji.", error);
  }
}

function getEmojiAtlasEntry(emoji) {
  if (!EMOJI_ATLAS.ready || !EMOJI_ATLAS.map || !emoji) {
    return null;
  }
  for (const key of getEmojiFallbackKeys(emoji)) {
    if (EMOJI_ATLAS.map[key]) {
      return EMOJI_ATLAS.map[key];
    }
  }
  return null;
}

function drawEmojiSprite(emoji, centerX, centerY, size, options = {}) {
  const entry = getEmojiAtlasEntry(emoji);
  if (!entry || !EMOJI_ATLAS.image) {
    return false;
  }
  const alpha = options.alpha ?? 1;
  const shadowBlur = options.shadowBlur ?? 0;
  const shadowColor = options.shadowColor ?? "transparent";
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.globalAlpha *= alpha;
  if (shadowBlur > 0) {
    ctx.shadowBlur = shadowBlur;
    ctx.shadowColor = shadowColor;
  }
  ctx.drawImage(
    EMOJI_ATLAS.image,
    entry.x,
    entry.y,
    entry.w,
    entry.h,
    centerX - size * 0.5,
    centerY - size * 0.5,
    size,
    size
  );
  ctx.restore();
  return true;
}

function applyEmojiSpriteToElement(element, emoji, sizePx) {
  if (!element) {
    return;
  }
  const entry = getEmojiAtlasEntry(emoji);
  if (!entry || !EMOJI_ATLAS.image) {
    element.classList.remove("is-emoji-sprite");
    return;
  }
  const imageWidth = EMOJI_ATLAS.image.naturalWidth || (EMOJI_ATLAS.cellSize * 10);
  const imageHeight = EMOJI_ATLAS.image.naturalHeight || (EMOJI_ATLAS.cellSize * 10);
  const scale = sizePx / Math.max(1, EMOJI_ATLAS.cellSize);
  element.classList.add("is-emoji-sprite");
  element.style.setProperty("--emoji-size", `${sizePx}px`);
  element.style.backgroundImage = `url("${EMOJI_ATLAS.url}")`;
  element.style.backgroundSize = `${imageWidth * scale}px ${imageHeight * scale}px`;
  element.style.backgroundPosition = `${-entry.x * scale}px ${-entry.y * scale}px`;
}

function isEmojiTextNodeCandidate(textNode) {
  if (!textNode || textNode.nodeType !== Node.TEXT_NODE) {
    return false;
  }
  const parent = textNode.parentElement;
  if (!parent || parent.closest(".emoji-inline-sprite")) {
    return false;
  }
  if (EMOJI_SKIP_TAGS.has(parent.tagName)) {
    return false;
  }
  const text = textNode.nodeValue ?? "";
  return text.length > 0 && EMOJI_TEXT_TEST_REGEX.test(text);
}

function getEmojiInlineSizePx(element) {
  const source = element?.parentElement ?? element;
  const fontSize = parseFloat(getComputedStyle(source).fontSize) || 16;
  return Math.max(12, Math.round(fontSize * 1.15));
}

function tokenizeEmojiText(text) {
  const tokens = [];
  let index = 0;
  while (index < text.length) {
    let matched = "";
    for (const key of emojiAtlasKeysByLength) {
      const normalizedKey = normalizeEmojiGlyphKey(key);
      if (text.startsWith(key, index)) {
        matched = text.slice(index, index + key.length);
        break;
      }
      if (normalizedKey && text.startsWith(normalizedKey, index)) {
        matched = text.slice(index, index + normalizedKey.length);
        break;
      }
    }
    if (matched) {
      tokens.push({ type: "emoji", value: matched });
      index += matched.length;
      continue;
    }
    EMOJI_CLUSTER_REGEX.lastIndex = index;
    const cluster = EMOJI_CLUSTER_REGEX.exec(text)?.[0] ?? "";
    if (cluster) {
      tokens.push({ type: "emoji", value: cluster });
      index += cluster.length;
      continue;
    }
    const codePoint = text.codePointAt(index);
    const char = String.fromCodePoint(codePoint);
    tokens.push({ type: "text", value: char });
    index += char.length;
  }
  const merged = [];
  for (const token of tokens) {
    const previous = merged[merged.length - 1];
    if (previous && previous.type === token.type && token.type === "text") {
      previous.value += token.value;
    } else {
      merged.push(token);
    }
  }
  return merged;
}

function convertEmojiTextNode(textNode) {
  if (!isEmojiTextNodeCandidate(textNode)) {
    return false;
  }
  const text = textNode.nodeValue ?? "";
  const parts = emojiAtlasKeysByLength.length > 0 ? tokenizeEmojiText(text) : text.split(EMOJI_TEXT_SEGMENT_REGEX).map((part) => ({
    type: EMOJI_TEXT_TEST_REGEX.test(part) ? "emoji" : "text",
    value: part,
  }));
  if (!parts.some((part) => part.type === "emoji")) {
    return false;
  }
  const fragment = document.createDocumentFragment();
  for (const part of parts) {
    if (!part.value) {
      continue;
    }
    if (part.type === "emoji") {
      const emojiSpan = document.createElement("span");
      emojiSpan.className = "emoji-inline-sprite";
      emojiSpan.textContent = part.value;
      applyEmojiSpriteToElement(emojiSpan, part.value, getEmojiInlineSizePx(emojiSpan));
      fragment.appendChild(emojiSpan);
      continue;
    }
    fragment.appendChild(document.createTextNode(part.value));
  }
  textNode.parentNode?.replaceChild(fragment, textNode);
  return true;
}

function refreshDomEmojiSprites(root) {
  if (!root) {
    return;
  }
  if (root.nodeType === Node.TEXT_NODE) {
    convertEmojiTextNode(root);
    return;
  }
  const textNodes = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      return isEmojiTextNodeCandidate(node) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
    },
  });
  while (walker.nextNode()) {
    textNodes.push(walker.currentNode);
  }
  for (const textNode of textNodes) {
    convertEmojiTextNode(textNode);
  }
  if (root.querySelectorAll) {
    const emojiSpans = root.querySelectorAll(".emoji-inline-sprite");
    for (const emojiSpan of emojiSpans) {
      applyEmojiSpriteToElement(emojiSpan, emojiSpan.textContent, getEmojiInlineSizePx(emojiSpan));
    }
  }
}

function scheduleEmojiDomRefresh(root) {
  if (!root) {
    return;
  }
  const normalizedRoot = root.nodeType === Node.TEXT_NODE ? root.parentNode : root;
  if (!normalizedRoot) {
    return;
  }
  emojiPendingRoots.add(normalizedRoot);
  if (emojiDomPassScheduled) {
    return;
  }
  emojiDomPassScheduled = true;
  requestAnimationFrame(() => {
    emojiDomPassScheduled = false;
    const roots = [...emojiPendingRoots];
    emojiPendingRoots.clear();
    for (const pendingRoot of roots) {
      refreshDomEmojiSprites(pendingRoot);
    }
  });
}

function startGlobalEmojiSpriteSync() {
  if (emojiDomObserver) {
    return;
  }
  refreshDomEmojiSprites(document.body);
  emojiDomObserver = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.type === "characterData") {
        scheduleEmojiDomRefresh(mutation.target);
        continue;
      }
      for (const node of mutation.addedNodes) {
        scheduleEmojiDomRefresh(node);
      }
    }
  });
  emojiDomObserver.observe(document.body, {
    subtree: true,
    childList: true,
    characterData: true,
  });
}

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
const ARCHIVE_CHALLENGES = [...(GAME_CONFIG.archiveChallenges ?? [])].sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0) || a.id.localeCompare(b.id));
const ARCHIVE_ACHIEVEMENTS = [...(GAME_CONFIG.archiveAchievements ?? [])].sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0) || a.id.localeCompare(b.id));
const ARCHIVE_CHALLENGE_MAP = new Map(ARCHIVE_CHALLENGES.map((entry) => [entry.id, entry]));
const ARCHIVE_ACHIEVEMENT_MAP = new Map(ARCHIVE_ACHIEVEMENTS.map((entry) => [entry.id, entry]));
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

function getEnemyPrimaryStatus(enemy) {
  const statusVisuals = [
    { key: "freeze", value: Math.max(enemy.freezeTimer, enemy.statusFlash.freeze), hue: 190, aura: "rgba(122, 212, 255, {a})" },
    { key: "burn", value: Math.max((enemy.burnStacks ?? 0) * 0.14, enemy.statusFlash.burn), hue: 18, aura: "rgba(255, 154, 68, {a})" },
    { key: "chill", value: Math.max(enemy.slowTimer * 0.3, enemy.statusFlash.chill), hue: 180, aura: "rgba(102, 196, 255, {a})" },
    { key: "necro", value: Math.max(enemy.necroMarkTimer, enemy.statusFlash.necro), hue: 255, aura: "rgba(196, 142, 255, {a})" },
    { key: "blood", value: Math.max(enemy.bloodMarkTimer, enemy.statusFlash.blood), hue: 334, aura: "rgba(255, 96, 138, {a})" },
    { key: "wind", value: enemy.statusFlash.wind, hue: 0, aura: "rgba(255, 255, 255, {a})" },
  ];
  return statusVisuals.reduce((best, item) => {
    if (item.value <= 0) {
      return best;
    }
    if (!best) {
      return item;
    }
    return (STATUS_PRIORITY[item.key] ?? 0) >= (STATUS_PRIORITY[best.key] ?? 0) ? item : best;
  }, null);
}

const CLASS_DEFS = {
  wind: {
    id: "wind",
    icon: "\ud83c\udf2c\ufe0f",
    playerEmoji: "\uD83E\uDDDD\uD83C\uDFFB\u200D\u2642\uFE0F",
    title: "Wind Mage",
    adjective: "Wind",
    description: "Speed is your defense. Shove enemies away, eat their projectiles with wind skills, and never let them catch you. Low damage — pure disruption.",
    color: "#e8f5ff",
    projectileColor: "#d7f6ff",
    projectileRgb: "215, 246, 255",
    autoDamage: 13,
    speedMultiplier: 1.35,
    maxHpMultiplier: 0.88,
    passiveLabel: "Slipstream Force",
    passiveText: "Auto attacks violently displace enemies. Wind skills eat hostile projectiles and trigger slipstream speed bursts. Speed is your armor.",
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
    description: "Patience rewarded. Stack Chill with autos, freeze enemies solid, then hit 3× damage. Tickling damage until the freeze lands — then catastrophic.",
    color: "#8ed8ff",
    projectileColor: "#9fe2ff",
    projectileRgb: "159, 226, 255",
    autoDamage: 10,
    speedMultiplier: 1,
    maxHpMultiplier: 1,
    passiveLabel: "Cold Equation",
    passiveText: "Auto attacks stack Chill fast. Frozen enemies take 3× damage — patience is power. Build the freeze, then shatter.",
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
    description: "Weak solo, terrifying in crowds. Each nearby burning enemy multiplies your damage. Start the blaze, let it spread, then watch the chain reaction.",
    color: "#ffb25e",
    projectileColor: "#ffc16b",
    projectileRgb: "255, 193, 107",
    autoDamage: 17,
    speedMultiplier: 1,
    maxHpMultiplier: 0.96,
    passiveLabel: "Kindling",
    passiveText: "Auto attacks add Burn stacks. Damage scales with nearby burning enemies and target's burn stacks — lone targets barely feel it, burning hordes get incinerated.",
    passiveType: "fire",
    skillUnlocks: [5, 15, 25],
    unlockMessage: "Learned a new fire technique.",
    skills: [
      { id: "cinder-halo", title: "Cinder Halo", icon: "\u2604\ufe0f", slot: 1, cooldown: 7.5, role: "Panic", targeting: "self" },
      { id: "sunspot", title: "Sunspot", icon: "\ud83c\udf1e", slot: 2, cooldown: 11.2, role: "Zone", targeting: "cluster" },
      { id: "ash-comet", title: "Ash Comet", icon: "\uD83C\uDF0B", slot: 3, cooldown: 14.6, role: "Signature", targeting: "cluster" },
    ],
  },
  necro: {
    id: "necro",
    icon: "\ud83d\udc80",
    playerEmoji: "\uD83E\uDDDD\uD83C\uDFFF",
    title: "Necromancer",
    adjective: "Necrotic",
    description: "Glass cannon summoner. Your attacks are a joke — your thralls are the army. Stay out of melee, keep raising the dead, or die instantly.",
    color: "#7de0b5",
    projectileColor: "#8cf0c3",
    projectileRgb: "140, 240, 195",
    autoDamage: 8,
    speedMultiplier: 1,
    maxHpMultiplier: 0.62,
    passiveLabel: "Black Procession",
    passiveText: "Your attacks barely scratch — your thralls do the killing. Stay back, keep raising, let the dead march. Direct combat will end you.",
    passiveType: "necro",
    skillUnlocks: [5, 15, 25],
    unlockMessage: "Learned a new necrotic rite.",
    skills: [
      { id: "bone-ward", title: "Bone Ward", icon: "\ud83e\uddb4", slot: 1, cooldown: 7.6, role: "Panic", targeting: "self" },
      { id: "requiem-field", title: "Requiem Field", icon: "\ud83e\udea6", slot: 2, cooldown: 10.8, role: "Zone", targeting: "cluster" },
      { id: "grave-call", title: "Grave Call", icon: "\u26b0\ufe0f", slot: 3, cooldown: 14.2, role: "Signature", targeting: "self" },
    ],
  },
  blood: {
    id: "blood",
    icon: "\ud83e\ude78",
    playerEmoji: "\uD83E\uDDDB\uD83C\uDFFB",
    title: "Blood Mage",
    adjective: "Blood",
    description: "Thick as a wall, slow as one too. Walk into crowds, heal off everything around you. More enemies = more damage, more healing. The horde is your health bar.",
    color: "#ff6a88",
    projectileColor: "#ff7b98",
    projectileRgb: "255, 123, 152",
    autoDamage: 12,
    speedMultiplier: 0.83,
    maxHpMultiplier: 1.62,
    passiveLabel: "Hemomancy",
    passiveText: "Weak alone, monstrous in a crowd. Each nearby enemy boosts your damage and lifesteal. Wade in, let them bleed you, drink them dry.",
    passiveType: "blood",
    skillUnlocks: [5, 15, 25],
    unlockMessage: "Learned a new blood rite.",
    skills: [
      { id: "vein-burst", title: "Vein Burst", icon: "\ud83d\udca5", slot: 1, cooldown: 7.8, role: "Panic", targeting: "self" },
      { id: "crimson-pool", title: "Crimson Pool", icon: "\ud83e\ude78", slot: 2, cooldown: 10.8, role: "Zone", targeting: "self" },
      { id: "blood-rite", title: "Blood Rite", icon: "\ud83e\uddea", slot: 3, cooldown: 14.4, role: "Signature", targeting: "self" },
    ],
  },
};
const SKILL_SUMMARIES = {
  "gale-ring": "A fast circular burst that damages nearby enemies and violently clears breathing room.",
  "crosswind-strip": "Creates a wind lane in your movement direction that throws enemies sideways to open a path.",
  "tempest-node": "Summons a lingering tornado node in the densest pack to pull and carry enemies off-line.",
  "blizzard-wake": "Wraps the mage in a freezing storm that rapidly stacks Chill on everything near you. Frozen enemies take 3× damage — use this to build toward a big hit.",
  "permafrost-seal": "Marks the densest pack with a frost seal that slows first, then bursts into freeze. Frozen targets take 3× damage from all your attacks.",
  "crystal-spear": "Launches a heavy ice lance into the nearest threat. Lethal when the target is already frozen — your 3× damage multiplier turns this into an execution shot.",
  "cinder-halo": "Ignites a close halo around the caster that repeatedly burns anything trying to collapse on you.",
  "sunspot": "Plants a bright fire zone under the thickest cluster and cooks it over time.",
  "ash-comet": "Calls down a delayed comet strike that detonates into a large fire burst.",
  "bone-ward": "Calls a shell of green skull wards that screen the necromancer and seed extra thralls into the fight. Thralls follow you until enemies come close, then attack.",
  "requiem-field": "Plants a necrotic command zone that slows enemies and empowers thralls fighting inside it. Position yourself so your thrall escort engages inside the field.",
  "grave-call": "Pulls corpses into a fresh wave of thralls. If no corpses are nearby, conjures phantom skulls instead. Your thralls follow you and attack anything that enters their radius.",
  "vein-burst": "Slams a close blood burst around the caster and briefly hardens you for brawling in the pack. More effective the deeper into the crowd you are.",
  "crimson-pool": "Creates a hold-ground blood pool under your feet that slows enemies and amplifies your sustain. Stay inside — leaving cuts your crowd-scaling lifesteal.",
  "blood-rite": "Enters a blood fortress stance. Massively boosts close-range lifesteal and damage reduction. At peak effect in a dense crowd — alone it barely matters.",
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
    archive: {
      challenges: {},
      achievements: {},
    },
  };
}

function normalizeArchiveUnlockMap(candidate, validDefs) {
  const normalized = {};
  const validIds = new Set(validDefs.map((entry) => entry.id));
  if (!candidate || typeof candidate !== "object") {
    return normalized;
  }
  for (const [id, value] of Object.entries(candidate)) {
    if (!validIds.has(id)) {
      continue;
    }
    if (typeof value === "string" && value.length > 0) {
      normalized[id] = value;
      continue;
    }
    if (typeof value === "boolean" && value) {
      normalized[id] = "legacy";
      continue;
    }
    if (value && typeof value === "object" && typeof value.completedAt === "string" && value.completedAt.length > 0) {
      normalized[id] = value.completedAt;
    }
  }
  return normalized;
}

function hasCompletedArchiveChallenge(id, meta = metaProgress) {
  return Boolean(meta?.archive?.challenges?.[id]);
}

function hasCompletedArchiveAchievement(id, meta = metaProgress) {
  return Boolean(meta?.archive?.achievements?.[id]);
}

function getCompletedArchiveChallengeCount(meta = metaProgress) {
  return Object.keys(meta?.archive?.challenges ?? {}).length;
}

function getCompletedArchiveAchievementCount(meta = metaProgress) {
  return Object.keys(meta?.archive?.achievements ?? {}).length;
}

function getArchiveChallengesByCategory(category) {
  return ARCHIVE_CHALLENGES.filter((entry) => entry.category === category);
}

function getArchiveChallengeProgressPercent(meta = metaProgress) {
  if (ARCHIVE_CHALLENGES.length <= 0) {
    return 1;
  }
  return getCompletedArchiveChallengeCount(meta) / ARCHIVE_CHALLENGES.length;
}

function getPinnedArchiveChallenges(meta = metaProgress, limit = 3) {
  return ARCHIVE_CHALLENGES.filter((entry) => !hasCompletedArchiveChallenge(entry.id, meta)).slice(0, limit);
}

function getLatestArchiveUnlock(meta = metaProgress) {
  const unlocks = [
    ...Object.entries(meta?.archive?.achievements ?? {}).map(([id, completedAt]) => ({ kind: "achievement", id, completedAt })),
    ...Object.entries(meta?.archive?.challenges ?? {}).map(([id, completedAt]) => ({ kind: "challenge", id, completedAt })),
  ]
    .filter((entry) => entry.completedAt)
    .sort((a, b) => String(b.completedAt).localeCompare(String(a.completedAt)));
  return unlocks[0] ?? null;
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
    archive: {
      challenges: normalizeArchiveUnlockMap(candidate.archive?.challenges, ARCHIVE_CHALLENGES),
      achievements: normalizeArchiveUnlockMap(candidate.archive?.achievements, ARCHIVE_ACHIEVEMENTS),
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
    metrics: {
      sessions: 0,
      totalDurationSec: 0,
      totalKills: 0,
      byClass: {},
      lastPlayedAt: null,
    },
  };
}

function normalizeTelemetryStore(candidate) {
  const fallback = createDefaultTelemetryStore();
  if (!candidate || typeof candidate !== "object" || !Array.isArray(candidate.runs)) {
    return fallback;
  }
  const sourceMetrics = candidate.metrics && typeof candidate.metrics === "object" ? candidate.metrics : {};
  const byClassSource = sourceMetrics.byClass && typeof sourceMetrics.byClass === "object"
    ? sourceMetrics.byClass
    : {};
  const byClass = {};
  for (const classId of CLASS_ORDER) {
    const classEntry = byClassSource[classId] && typeof byClassSource[classId] === "object"
      ? byClassSource[classId]
      : {};
    byClass[classId] = {
      sessions: Math.max(0, Math.floor(classEntry.sessions ?? 0)),
      durationSec: Math.max(0, Number(classEntry.durationSec ?? 0)),
      kills: Math.max(0, Math.floor(classEntry.kills ?? 0)),
    };
  }
  return {
    runs: candidate.runs
      .filter((entry) => entry && typeof entry === "object")
      .slice(-40),
    metrics: {
      sessions: Math.max(0, Math.floor(sourceMetrics.sessions ?? 0)),
      totalDurationSec: Math.max(0, Number(sourceMetrics.totalDurationSec ?? 0)),
      totalKills: Math.max(0, Math.floor(sourceMetrics.totalKills ?? 0)),
      byClass,
      lastPlayedAt: typeof sourceMetrics.lastPlayedAt === "string" ? sourceMetrics.lastPlayedAt : null,
    },
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
  const classId = state.player.classId;
  const duration = Math.max(0, state.telemetry.final.duration ?? 0);
  const kills = Math.max(0, state.telemetry.final.kills ?? 0);
  telemetryStore.metrics.sessions += 1;
  telemetryStore.metrics.totalDurationSec = Number((telemetryStore.metrics.totalDurationSec + duration).toFixed(2));
  telemetryStore.metrics.totalKills += kills;
  telemetryStore.metrics.lastPlayedAt = state.telemetry.final.endedAt;
  const classMetrics = telemetryStore.metrics.byClass[classId] ?? { sessions: 0, durationSec: 0, kills: 0 };
  classMetrics.sessions += 1;
  classMetrics.durationSec = Number((classMetrics.durationSec + duration).toFixed(2));
  classMetrics.kills += kills;
  telemetryStore.metrics.byClass[classId] = classMetrics;
  saveTelemetryStore();
  return state.telemetry;
}

function getTelemetrySummary() {
  const metrics = telemetryStore?.metrics ?? createDefaultTelemetryStore().metrics;
  return {
    sessions: metrics.sessions,
    totalDurationSec: Number((metrics.totalDurationSec ?? 0).toFixed(2)),
    totalKills: metrics.totalKills,
    lastPlayedAt: metrics.lastPlayedAt,
    byClass: CLASS_ORDER.reduce((acc, classId) => {
      const entry = metrics.byClass?.[classId] ?? { sessions: 0, durationSec: 0, kills: 0 };
      acc[classId] = {
        sessions: Math.max(0, Math.floor(entry.sessions ?? 0)),
        durationSec: Number(Math.max(0, entry.durationSec ?? 0).toFixed(2)),
        kills: Math.max(0, Math.floor(entry.kills ?? 0)),
      };
      return acc;
    }, {}),
  };
}


const canvas = document.getElementById("gameCanvas");
const ctx =
  canvas.getContext("2d", { alpha: false, desynchronized: true }) ??
  canvas.getContext("2d", { alpha: false });

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
  lockBadge: element.querySelector(".skill-lock-badge"),
  icon: element.querySelector(".skill-icon"),
  fill: element.querySelector(".skill-fill"),
  masteryDots: Array.from(element.querySelectorAll(".skill-mastery-dot")),
}));
const skillTooltip = {
  root: document.getElementById("skillTooltip"),
  icon: document.getElementById("skillTooltipIcon"),
  title: document.getElementById("skillTooltipTitle"),
  meta: document.getElementById("skillTooltipMeta"),
  body: document.getElementById("skillTooltipBody"),
};
const miniMapCanvas = document.getElementById("miniMapCanvas");
const miniMapObjectives = document.getElementById("miniMapObjectives");

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
const codexTabNav = document.getElementById("codexTabNav");
const codexTabButtons = Array.from(codexTabNav?.querySelectorAll("[data-codex-tab]") ?? []);
const upgradesButton = document.getElementById("upgradesButton");
const helpButton = document.getElementById("helpButton");
const upgradesList = document.getElementById("upgradesList");
const closeUpgradesButton = document.getElementById("closeUpgradesButton");
const pauseRestartButton = document.getElementById("pauseRestartButton");
const pauseMenuScreen = document.getElementById("pauseMenuScreen");
const menuResumeButton = document.getElementById("menuResumeButton");
const menuUpgradesButton = document.getElementById("menuUpgradesButton");
const menuHelpButton = document.getElementById("menuHelpButton");
const menuEndRunButton = document.getElementById("menuEndRunButton");
const pausePanel = pauseOverlay.querySelector(".pause-panel");
const devToolsPanel = document.getElementById("devToolsPanel");
const devModeSummary = document.getElementById("devModeSummary");
const devTabNav = document.getElementById("devTabNav");
const devTabButtons = Array.from(devTabNav?.querySelectorAll("[data-dev-tab]") ?? []);
const devSkillsPanel = document.getElementById("devSkillsPanel");
const devSpawnPanel = document.getElementById("devSpawnPanel");
const devCharacterPanel = document.getElementById("devCharacterPanel");
const devClassPanel = document.getElementById("devClassPanel");
const grantAllUpgradesButton = document.getElementById("grantAllUpgradesButton");
const grantAllMinorButton = document.getElementById("grantAllMinorButton");
const grantAllMajorButton = document.getElementById("grantAllMajorButton");
const devEnemySpawnList = document.getElementById("devEnemySpawnList");
const bossSpawnSelect = document.getElementById("bossSpawnSelect");
const bossSpawnCount = document.getElementById("bossSpawnCount");
const spawnBossButton = document.getElementById("spawnBossButton");
const clearEnemiesButton = document.getElementById("clearEnemiesButton");
const devLevelInput = document.getElementById("devLevelInput");
const setLevelButton = document.getElementById("setLevelButton");
const gainLevelButton = document.getElementById("gainLevelButton");
const devHpInput = document.getElementById("devHpInput");
const devMaxHpInput = document.getElementById("devMaxHpInput");
const setHpButton = document.getElementById("setHpButton");
const devDashChargesInput = document.getElementById("devDashChargesInput");
const devDashMaxInput = document.getElementById("devDashMaxInput");
const setDashButton = document.getElementById("setDashButton");
const toggleZenModeButton = document.getElementById("toggleZenModeButton");
const toggleInvulnerableButton = document.getElementById("toggleInvulnerableButton");
const toggleManualSkillsButton = document.getElementById("toggleManualSkillsButton");
const toggleZeroCooldownButton = document.getElementById("toggleZeroCooldownButton");
const devSkillToggleList = document.getElementById("devSkillToggleList");
const devClassButtons = document.getElementById("devClassButtons");

const gameOverOverlay = document.getElementById("gameOverOverlay");
const resultValue = document.getElementById("resultValue");
const resultStats = document.getElementById("resultStats");
const archiveRevealPanel = document.getElementById("archiveRevealPanel");
const restartButton = document.getElementById("restartButton");
const returnMenuButton = document.getElementById("returnMenuButton");
const gameOverCard = gameOverOverlay.querySelector(".overlay-card");
const fpsValue = document.getElementById("fpsValue");
const perfProfiler = document.getElementById("perfProfiler");
const startOverlay = document.getElementById("startOverlay");
const classSelectGrid = document.getElementById("classSelectGrid");
const classPreviewPrev = document.getElementById("classPreviewPrev");
const classPreviewNext = document.getElementById("classPreviewNext");
const classPreviewTitle = document.getElementById("classPreviewTitle");
const classPreviewHero = document.getElementById("classPreviewHero");
const classPreviewSkills = document.getElementById("classPreviewSkills");
const mageAmbientCanvas = document.getElementById("mageAmbientCanvas");
const classThumbStrip = document.getElementById("classThumbStrip");
const startMagePanel = document.querySelector(".start-mage-panel");
const classProgressCard = document.getElementById("classProgressCard");
const archiveProgressCard = document.getElementById("archiveProgressCard");
const startRunButton = document.getElementById("startRunButton");
const startRunTransitionMask = document.getElementById("startRunTransitionMask");
const startSubtitle = document.getElementById("startSubtitle");
const audioMixer = document.getElementById("audioMixer");
const audioMixerButton = document.getElementById("audioMixerButton");
const audioMixerPanel = document.getElementById("audioMixerPanel");
const musicMuteButton = document.getElementById("musicMuteButton");
const sfxMuteButton = document.getElementById("sfxMuteButton");
const musicVolumeSlider = document.getElementById("musicVolumeSlider");
const sfxVolumeSlider = document.getElementById("sfxVolumeSlider");
const howToPlayOverlay = document.getElementById("howToPlayOverlay");
const howToPlayPanel = howToPlayOverlay?.querySelector(".howto-panel");
const howtoXpCanvas = document.getElementById("howtoXpCanvas");
const howtoHealCanvas = document.getElementById("howtoHealCanvas");
const closeHowToButton = document.getElementById("closeHowToButton");
const archiveToastLayer = document.getElementById("archiveToastLayer");
const touchControls = document.getElementById("touchControls");
const touchMoveZone = document.getElementById("touchMoveZone");
const touchJoystick = document.getElementById("touchJoystick");
const touchJoystickKnob = document.getElementById("touchJoystickKnob");
const touchDashButton = document.getElementById("touchDashButton");

const pressedActions = new Set();
const touchInput = {
  enabled: false,
  move: {
    pointerId: null,
    active: false,
    anchorX: 86,
    anchorY: 86,
    currentX: 86,
    currentY: 86,
    vectorX: 0,
    vectorY: 0,
    maxRadius: 52,
    capturePadding: 34,
  },
  dashPointerId: null,
};
const DEV_TOGGLE_KEYS = new Set(["`", "~", "ё", "Ё"]);
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
    if (type === "colossus" && (state?.bossDirector?.encounterIndex ?? 0) <= 0) {
      return false;
    }
    return atTime >= (BOSS_UNLOCK_TIMES[type] ?? 0);
  });
}

let backgroundGradient = null;
let screenVignetteGradient = null;
let hurtVignetteGradient = null;
let deathWashGradient = null;
let terrainRenderCache = {
  zoom: null,
  startWorldX: null,
  startWorldY: null,
  endWorldX: null,
  endWorldY: null,
  waterTiles: [],
  lastRebuildStartX: null,
  lastRebuildStartY: null,
};

let metaProgress;
let telemetryStore;
let state;
let previousTime = 0;
let accumulator = 0;
let deterministicSteppingEnabled = false;
