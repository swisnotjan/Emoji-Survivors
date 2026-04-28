// Core gameplay state transitions, simulation, spawning, skills, and enemy behavior.
let startRunTransitionRunning = false;
const PERFORMANCE_RECORDER = {
  enabled: false,
  forceProfiler: false,
  sampleEverySec: 0.5,
  maxSamplesPerRun: 800,
  maxRuns: 14,
  nextRunId: 1,
  sampleTimer: 0,
  activeRun: null,
  runs: [],
};

function createInitialState(classId = "wind") {
  WORLD_FEATURE_CACHE.clear();
  TERRAIN_TILE_CACHE.clear();
  invalidateBackgroundCache();
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
    hudPendingForce: false,
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
      moveVX: 0,
      moveVY: 0,
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
      windRushTimer: 0,
      windRushBonus: classId === "wind" ? 0.28 : 0,
      bloodRiteTimer: 0,
      lifesteal: classId === "blood" ? 0.03 : 0,
      bloodGuardTimer: 0,
      bloodStandReduction: classId === "blood" ? 0.08 : 0,
      bloodPoolReduction: classId === "blood" ? 0.1 : 0,
      bloodRiteReduction: classId === "blood" ? 0.16 : 0,
      bloodMarkedReduction: classId === "blood" ? 0.03 : 0,
      bloodCloseRangeBonus: classId === "blood" ? 0.06 : 0,
      bloodRiteLifestealBonus: classId === "blood" ? 0.10 : 0,
      frozenDamageMultiplier: classId === "frost" ? 3.0 : 1.0,
      lastCritTimer: 0,
      lastCritSource: null,
      thrallLifestealPerHit: 0,
      necroSummonCap: classId === "necro" ? 6 : 0,
      necroRaiseChanceBonus: classId === "necro" ? 0.05 : 0,
      necroSiphonHeal: 0,
      necroSiphonReduction: 0,
      necroSiphonRadius: 0,
      necroSiphonThreshold: 0,
      necroSiphonTickTimer: 0,
      necroSiphonActive: false,
      weapon: {
        fireInterval: 0.42,
        projectileSpeed: 470,
        projectileDamage: classDef.autoDamage,
        projectileRadius: 5.2,
        projectileLife: 1.2,
        projectilePierce: classId === "necro" ? 2 : 1,
        extraProjectiles: 0,
        spreadAngle: 0.1,
        targetingRange: 920,
        knockback: classId === "wind" ? 430 : 34,
        bossDamageMultiplier: classId === "wind" ? 0.85 : 1,
      },
      dash: {
        charges: 1,
        maxCharges: 1,
        rechargeTime: classId === "wind" ? 4.25 : 4.8,
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
    bossIntro: {
      active: false,
      timer: 0,
      duration: 2.25,
      targetEnemyId: null,
      targetBossName: "",
    },
    pause: {
      manual: false,
      focus: false,
      upgradesPanel: false,
      helpPanel: false,
      devMenu: false,
      codexTab: "build",
    },
    dev: {
      activeTab: "skills",
      zenMode: false,
      bossChoice: "random",
      disableSpawns: false,
      manualSkillMode: false,
      zeroSkillCooldown: false,
      playerInvulnerable: false,
    },
    bossDirector: {
      encounterIndex: 0,
      nextTime: rollBossEncounterDelay(0),
      warningLead: 9,
      bag: [],
      bagSignature: "",
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
    portal: null,
    enemyGrid: {
      map: new Map(),
      cells: [],
      typeCounts: Object.create(null),
      bossCount: 0,
    },
    pickupDirector: {
      healTimer: randRange(8.5, 12.5),
      maxHealPickups: 5,
    },
    metaRun: {
      xpCollected: 0,
      unlockedClassThisRun: null,
      activeDuration: 0,
    },
    archiveRun: createArchiveRunState(),
    telemetry: createRunTelemetry(classId),
    queryCache: {
      tick: -1,
      values: new Map(),
    },
    performance: {
      fpsDisplay: 0,
      fpsSmooth: 60,
      fpsTimer: 0,
      tier: 0,
      renderScaleTarget: 1,
      profiler: {
        enabled: false,
        refreshTimer: 0,
        frameIndex: 0,
        frameBudgetMs: 1000 / TARGET_FPS,
        windowFrames: 0,
        windowCpuMs: 0,
        windowUpdateMs: 0,
        windowRenderMs: 0,
        windowStageMs: Object.create(null),
        avgCpuMs: 0,
        avgUpdateMs: 0,
        avgRenderMs: 0,
        avgStageMs: Object.create(null),
        worstCpuMs: 0,
        worstAt: 0,
        current: null,
      },
    },
  };
}

function createArchiveRunState() {
  return {
    completedChallenges: [],
    completedAchievements: [],
    revealEntries: [],
    toastQueue: [],
    toastCurrent: null,
    bossesDefeated: {},
    bossCount: 0,
    skillUnlocks: 0,
    masteryChoices: 0,
    majorChoices: 0,
    blessingChoices: 0,
    totalHealing: 0,
    timeLowHp: 0,
    burnKillCount: 0,
    burnKillStreak: 0,
    burnKillStreakTimer: 0,
    maxBurnKillStreak: 0,
    afflictedKills: 0,
    thrallsSpawned: 0,
    maxThralls: 0,
    currentBossType: null,
    bossEncounterContactDamage: 0,
    windTouchlessBossDefeat: false,
    windChargedBossDefeat: false,
    frostBossShatter: false,
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

function buildArchiveUnlockEntry(kind, id) {
  const def = kind === "achievement" ? ARCHIVE_ACHIEVEMENT_MAP.get(id) : ARCHIVE_CHALLENGE_MAP.get(id);
  if (!def) {
    return null;
  }
  return {
    kind,
    id,
    icon: def.icon,
    title: def.title,
    description: def.description,
    category: def.category ?? "achievement",
  };
}

function queueArchiveUnlock(kind, id, showToast = true) {
  const entry = buildArchiveUnlockEntry(kind, id);
  if (!entry) {
    return;
  }
  state.archiveRun.revealEntries.push(entry);
  if (showToast) {
    state.archiveRun.toastQueue.push(entry);
    window.sfx?.play("archiveUnlock");
    renderArchiveToast();
  }
}

function markArchiveChallengeCompleted(id, showToast = true) {
  if (hasCompletedArchiveChallenge(id)) {
    return false;
  }
  metaProgress.archive.challenges[id] = new Date().toISOString();
  saveMetaProgress();
  state.archiveRun.completedChallenges.push(id);
  queueArchiveUnlock("challenge", id, showToast);
  return true;
}

function markArchiveAchievementCompleted(id, showToast = true) {
  if (hasCompletedArchiveAchievement(id)) {
    return false;
  }
  metaProgress.archive.achievements[id] = new Date().toISOString();
  saveMetaProgress();
  state.archiveRun.completedAchievements.push(id);
  queueArchiveUnlock("achievement", id, showToast);
  return true;
}

function getArchiveChallengeCurrentValue(id) {
  const run = state.archiveRun;
  switch (id) {
    case "journey-survive-5":
      return state.metaRun.activeDuration;
    case "journey-level-10":
      return state.progression.level;
    case "journey-full-kit":
      return run.skillUnlocks;
    case "journey-mastery":
      return run.masteryChoices;
    case "journey-boss-rush":
      return run.bossCount;
    case "boss-countess":
      return Number(Boolean(run.bossesDefeated.countess || state.bossDefeats.countess));
    case "boss-colossus":
      return Number(Boolean(run.bossesDefeated.colossus || state.bossDefeats.colossus));
    case "boss-abyss":
      return Number(Boolean(run.bossesDefeated.abyss || state.bossDefeats.abyss));
    case "boss-matriarch":
      return Number(Boolean(run.bossesDefeated.matriarch || state.bossDefeats.matriarch));
    case "boss-harbinger":
      return Number(Boolean(run.bossesDefeated.harbinger || state.bossDefeats.harbinger));
    case "boss-regent":
      return Number(Boolean(run.bossesDefeated.regent || state.bossDefeats.regent));
    case "wind-reservoir":
      return state.player.dash.maxCharges;
    case "frost-afflicted":
      return run.afflictedKills;
    case "fire-streak":
      return run.maxBurnKillStreak;
    case "fire-burn-kills":
      return run.burnKillCount;
    case "necro-thralls":
      return run.maxThralls;
    case "necro-summoner":
      return run.thrallsSpawned;
    case "blood-low-hp":
      return run.timeLowHp;
    case "blood-healing":
      return run.totalHealing;
    default:
      return 0;
  }
}

function isArchiveChallengeComplete(def) {
  const run = state.archiveRun;
  switch (def.id) {
    case "journey-survive-5":
      return state.metaRun.activeDuration >= def.target;
    case "journey-level-10":
      return state.progression.level >= def.target;
    case "journey-full-kit":
      return getUnlockedSkillStates().length >= def.target || run.skillUnlocks >= def.target;
    case "journey-mastery":
      return run.masteryChoices >= def.target;
    case "journey-trinity":
      return run.majorChoices >= 1 && run.masteryChoices >= 1 && run.blessingChoices >= 1;
    case "journey-boss-rush":
      return run.bossCount >= def.target;
    case "boss-countess":
    case "boss-colossus":
    case "boss-abyss":
    case "boss-matriarch":
    case "boss-harbinger":
    case "boss-regent":
      return Boolean(run.bossesDefeated[def.bossType] || state.bossDefeats[def.bossType]);
    case "wind-touchless":
      return state.player.classId === "wind" && run.windTouchlessBossDefeat;
    case "wind-reservoir":
      return state.player.classId === "wind" && run.windChargedBossDefeat;
    case "frost-afflicted":
      return state.player.classId === "frost" && run.afflictedKills >= def.target;
    case "frost-shatter":
      return state.player.classId === "frost" && Boolean(run.frostBossShatter);
    case "fire-streak":
      return state.player.classId === "fire" && run.maxBurnKillStreak >= def.target;
    case "fire-burn-kills":
      return state.player.classId === "fire" && run.burnKillCount >= def.target;
    case "necro-thralls":
      return state.player.classId === "necro" && run.maxThralls >= def.target;
    case "necro-summoner":
      return state.player.classId === "necro" && run.thrallsSpawned >= def.target;
    case "blood-low-hp":
      return state.player.classId === "blood" && run.timeLowHp >= def.target;
    case "blood-healing":
      return state.player.classId === "blood" && run.totalHealing >= def.target;
    default:
      return false;
  }
}

function getArchiveAchievementCurrentValue(def) {
  if (def.kind === "count") {
    return getCompletedArchiveChallengeCount();
  }
  if (def.kind === "category") {
    const items = getArchiveChallengesByCategory(def.category);
    return items.filter((entry) => hasCompletedArchiveChallenge(entry.id)).length;
  }
  if (def.kind === "all") {
    return getCompletedArchiveChallengeCount();
  }
  return 0;
}

function isArchiveAchievementComplete(def) {
  if (def.kind === "count") {
    return getCompletedArchiveChallengeCount() >= def.target;
  }
  if (def.kind === "category") {
    const items = getArchiveChallengesByCategory(def.category);
    return items.length > 0 && items.every((entry) => hasCompletedArchiveChallenge(entry.id));
  }
  if (def.kind === "all") {
    return ARCHIVE_CHALLENGES.length > 0 && getCompletedArchiveChallengeCount() >= ARCHIVE_CHALLENGES.length;
  }
  return false;
}

function evaluateArchiveUnlocks(showToast = true) {
  let unlockedSomething = false;
  for (const challenge of ARCHIVE_CHALLENGES) {
    if (hasCompletedArchiveChallenge(challenge.id)) {
      continue;
    }
    if (isArchiveChallengeComplete(challenge)) {
      if (markArchiveChallengeCompleted(challenge.id, showToast)) {
        unlockedSomething = true;
      }
    }
  }
  for (const achievement of ARCHIVE_ACHIEVEMENTS) {
    if (hasCompletedArchiveAchievement(achievement.id)) {
      continue;
    }
    if (isArchiveAchievementComplete(achievement)) {
      if (markArchiveAchievementCompleted(achievement.id, showToast)) {
        unlockedSomething = true;
      }
    }
  }
  return unlockedSomething;
}

function trackArchiveEvent(eventType, payload = {}) {
  const run = state.archiveRun;
  switch (eventType) {
    case "damage_taken":
      if (payload.sourceKey === "contact" && run.currentBossType) {
        run.bossEncounterContactDamage += payload.amount;
      }
      break;
    case "boss_spawned":
      run.currentBossType = payload.bossType ?? null;
      run.bossEncounterContactDamage = 0;
      break;
    case "boss_defeated":
      run.bossCount += 1;
      run.currentBossType = null;
      run.bossesDefeated[payload.bossType] = true;
      if (state.player.classId === "wind" && run.bossEncounterContactDamage <= 0.1) {
        run.windTouchlessBossDefeat = true;
      }
      if (state.player.classId === "wind" && state.player.dash.maxCharges >= 3) {
        run.windChargedBossDefeat = true;
      }
      if (state.player.classId === "frost" && (payload.enemy?.freezeTimer > 0 || payload.enemy?.brittleTimer > 0)) {
        run.frostBossShatter = true;
      }
      break;
    case "skill_unlocked":
      run.skillUnlocks += 1;
      break;
    case "major_picked":
      run.majorChoices += 1;
      break;
    case "mastery_picked":
      run.masteryChoices += 1;
      break;
    case "boss_blessing_picked":
      run.blessingChoices += 1;
      break;
    case "enemy_defeated":
      if (payload.enemy?.burnStacks > 0) {
        run.burnKillCount += 1;
        run.burnKillStreak += 1;
        run.burnKillStreakTimer = 3.2;
        run.maxBurnKillStreak = Math.max(run.maxBurnKillStreak, run.burnKillStreak);
      }
      if (
        payload.enemy?.freezeTimer > 0 ||
        payload.enemy?.brittleTimer > 0 ||
        payload.enemy?.chillStacks > 0 ||
        payload.enemy?.slowTimer > 0
      ) {
        run.afflictedKills += 1;
      }
      break;
    case "thrall_spawned":
      run.thrallsSpawned += 1;
      break;
    case "healed":
      run.totalHealing += payload.amount;
      break;
    default:
      break;
  }
  evaluateArchiveUnlocks(true);
}

function updateArchiveRunProgress(dt) {
  const run = state.archiveRun;
  if (state.player.classId === "blood" && state.player.maxHp > 0 && state.player.hp / state.player.maxHp <= 0.35) {
    run.timeLowHp += dt;
  }
  run.maxThralls = Math.max(run.maxThralls, countActiveThralls());
  if (run.burnKillStreakTimer > 0) {
    run.burnKillStreakTimer = Math.max(0, run.burnKillStreakTimer - dt);
    if (run.burnKillStreakTimer <= 0) {
      run.burnKillStreak = 0;
    }
  }
}

function updateArchiveToast(dt) {
  const run = state.archiveRun;
  if (!run.toastCurrent && run.toastQueue.length > 0) {
    run.toastCurrent = {
      ...run.toastQueue.shift(),
      age: 0,
    };
    renderArchiveToast();
  }
  if (!run.toastCurrent) {
    return;
  }
  run.toastCurrent.age += dt;
  if (run.toastCurrent.age >= 4.8) {
    run.toastCurrent = null;
    renderArchiveToast();
    if (run.toastQueue.length > 0) {
      updateArchiveToast(0);
    }
  } else if (run.toastCurrent.age <= 0.5 || run.toastCurrent.age >= 4) {
    renderArchiveToast();
  }
}

function getArchiveToastPhase(entry) {
  if (!entry) {
    return "hidden";
  }
  if (entry.age < 0.42) {
    return "enter";
  }
  if (entry.age > 3.92) {
    return "exit";
  }
  return "steady";
}

function renderArchiveToast() {
  if (!archiveToastLayer) {
    return;
  }
  const entry = state.archiveRun.toastCurrent;
  if (!entry) {
    archiveToastLayer.innerHTML = "";
    archiveToastLayer.classList.add("hidden");
    return;
  }
  const phase = getArchiveToastPhase(entry);
  const kicker = entry.kind === "achievement" ? "Achievement Unlocked" : "Challenge Complete";
  archiveToastLayer.classList.remove("hidden");
  archiveToastLayer.innerHTML = [
    `<div class="archive-toast is-${phase}" data-kind="${entry.kind}">`,
    `<div class="archive-toast-glow"></div>`,
    `<div class="archive-toast-rays"></div>`,
    `<div class="archive-toast-shimmer"></div>`,
    `<div class="archive-toast-icon">${entry.icon}</div>`,
    `<div class="archive-toast-copy">`,
    `<span class="archive-toast-kicker">${kicker}</span>`,
    `<strong>${entry.title}</strong>`,
    `<p>${entry.description}</p>`,
    `</div>`,
    `</div>`,
  ].join("");
}

function formatArchiveMetric(value, challenge) {
  if (challenge?.id === "journey-survive-5" || challenge?.id === "blood-low-hp") {
    return `${Math.floor(value)}s`;
  }
  return `${Math.floor(value)}`;
}

function getArchiveChallengeStatus(challenge) {
  if (hasCompletedArchiveChallenge(challenge.id)) {
    return "Completed";
  }
  if (challenge.id === "journey-trinity") {
    return `${state.archiveRun.majorChoices}/1 Major - ${state.archiveRun.masteryChoices}/1 Mastery - ${state.archiveRun.blessingChoices}/1 Blessing`;
  }
  if (challenge.id === "wind-touchless" || challenge.id === "frost-shatter") {
    return challenge.description;
  }
  const current = getArchiveChallengeCurrentValue(challenge.id);
  if (challenge.target) {
    return `${formatArchiveMetric(current, challenge)} / ${formatArchiveMetric(challenge.target, challenge)}`;
  }
  return challenge.description;
}

function getArchiveAchievementStatus(achievement) {
  if (hasCompletedArchiveAchievement(achievement.id)) {
    return "Unlocked";
  }
  const current = getArchiveAchievementCurrentValue(achievement);
  if (achievement.kind === "category") {
    const total = getArchiveChallengesByCategory(achievement.category).length;
    return `${current} / ${total}`;
  }
  if (achievement.target) {
    return `${current} / ${achievement.target}`;
  }
  return `${current} / ${ARCHIVE_CHALLENGES.length}`;
}

function hasAffliction(enemy) {
  return enemy.freezeTimer > 0 || enemy.brittleTimer > 0 || enemy.chillStacks > 0 || enemy.burnStacks > 0 || enemy.necroMarkTimer > 0 || enemy.bloodMarkTimer > 0;
}

const HOW_TO_PLAY_STORAGE_KEY = "emoji-survivors-howto-seen-v1";
const START_OVERLAY_SHORT_DESCRIPTION = "Survive the horde, evolve your build, and erase the map with spellcraft.";
let startOverlayFocusClassId = null;
let classHoverTooltipElement = null;
let audioMixerCloseTimer = null;
let lastMusicUiVolume = 0.5;
let lastSfxUiVolume = 0.5;
let pauseMenuEndRunConfirm = false;
let pauseMenuEndRunConfirmTimer = null;
let howtoPickupPreviewFrame = 0;
let howtoPickupPreviewStart = 0;
let mageAmbientAnimFrame = 0;
let mageAmbientLastTime = 0;
const mageAmbientState = {
  classId: "wind",
  particles: [],
  pointerScreenX: window.innerWidth * 0.5,
  pointerScreenY: window.innerHeight * 0.26,
  windX: 0,
};

function cancelAudioMixerClose() {
  if (audioMixerCloseTimer) {
    clearTimeout(audioMixerCloseTimer);
    audioMixerCloseTimer = null;
  }
}

function openAudioMixerPanel() {
  if (!audioMixer) {
    return;
  }
  cancelAudioMixerClose();
  audioMixer.classList.add("is-open");
}

function queueAudioMixerClose() {
  if (!audioMixer) {
    return;
  }
  cancelAudioMixerClose();
  audioMixerCloseTimer = setTimeout(() => {
    audioMixer?.classList.remove("is-open");
    audioMixerCloseTimer = null;
  }, 220);
}

function clearPauseMenuEndRunConfirm() {
  if (pauseMenuEndRunConfirmTimer) {
    clearTimeout(pauseMenuEndRunConfirmTimer);
    pauseMenuEndRunConfirmTimer = null;
  }
  pauseMenuEndRunConfirm = false;
  if (menuEndRunButton) {
    menuEndRunButton.textContent = "End Run";
    menuEndRunButton.classList.remove("is-confirming");
  }
}

function requestPauseMenuEndRunConfirm() {
  if (!menuEndRunButton) {
    return;
  }
  pauseMenuEndRunConfirm = true;
  menuEndRunButton.textContent = "You sure?";
  menuEndRunButton.classList.add("is-confirming");
  if (pauseMenuEndRunConfirmTimer) {
    clearTimeout(pauseMenuEndRunConfirmTimer);
  }
  pauseMenuEndRunConfirmTimer = setTimeout(() => {
    clearPauseMenuEndRunConfirm();
  }, 2800);
}

function parseRgbaChannels(color, fallback = [190, 200, 255]) {
  const match = String(color ?? "").match(/rgba?\((\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})/i);
  if (!match) {
    return fallback;
  }
  return [
    clamp(Number(match[1]), 0, 255),
    clamp(Number(match[2]), 0, 255),
    clamp(Number(match[3]), 0, 255),
  ];
}

function toRgba(color, alpha) {
  const [r, g, b] = parseRgbaChannels(color);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function resizeMageAmbientCanvas() {
  if (!mageAmbientCanvas) {
    return;
  }
  const rect = mageAmbientCanvas.getBoundingClientRect();
  const width = Math.max(1, Math.round(rect.width));
  const height = Math.max(1, Math.round(rect.height));
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const pixelWidth = Math.max(1, Math.round(width * dpr));
  const pixelHeight = Math.max(1, Math.round(height * dpr));
  if (mageAmbientCanvas.width === pixelWidth && mageAmbientCanvas.height === pixelHeight) {
    return;
  }
  mageAmbientCanvas.width = pixelWidth;
  mageAmbientCanvas.height = pixelHeight;
}

function createMageAmbientParticle(width, height) {
  return {
    x: Math.random() * width,
    y: Math.random() * height,
    vx: randRange(-10, 10),
    vy: randRange(28, 74),
    size: Math.random() < 0.22 ? 3 : 2,
    phase: Math.random() * Math.PI * 2,
    phaseSpeed: randRange(0.8, 1.9),
    colorIndex: Math.floor(Math.random() * 3),
  };
}

function syncMageAmbientParticlePool(width, height) {
  const particleCount = 58;
  while (mageAmbientState.particles.length < particleCount) {
    mageAmbientState.particles.push(createMageAmbientParticle(width, height));
  }
  if (mageAmbientState.particles.length > particleCount) {
    mageAmbientState.particles.length = particleCount;
  }
}

function drawMageAmbient(nowMs) {
  if (!mageAmbientCanvas) {
    return;
  }
  if (!mageAmbientAnimFrame) {
    return;
  }
  mageAmbientAnimFrame = requestAnimationFrame(drawMageAmbient);
  if (!startOverlay || startOverlay.classList.contains("hidden")) {
    mageAmbientLastTime = nowMs;
    return;
  }

  resizeMageAmbientCanvas();
  const ctx2d = mageAmbientCanvas.getContext("2d");
  if (!ctx2d) {
    return;
  }
  const cssWidth = Math.max(1, mageAmbientCanvas.clientWidth);
  const cssHeight = Math.max(1, mageAmbientCanvas.clientHeight);
  if (cssWidth < 2 || cssHeight < 2) {
    return;
  }
  syncMageAmbientParticlePool(cssWidth, cssHeight);
  if (!Number.isFinite(mageAmbientLastTime) || mageAmbientLastTime <= 0) {
    mageAmbientLastTime = nowMs;
  }
  const dt = clamp((nowMs - mageAmbientLastTime) / 1000, 0.001, 0.05);
  mageAmbientLastTime = nowMs;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  ctx2d.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx2d.imageSmoothingEnabled = false;

  const palette = getClassThemePalette(mageAmbientState.classId);
  const isWindTheme = mageAmbientState.classId === "wind";
  const topGlow = toRgba(palette.a, isWindTheme ? 0.38 : 0.26);
  const centerGlow = toRgba(palette.b, isWindTheme ? 0.24 : 0.16);
  const bottomFade = "rgba(14, 16, 25, 0)";
  const backgroundGradient = ctx2d.createLinearGradient(0, 0, 0, cssHeight);
  backgroundGradient.addColorStop(0, topGlow);
  backgroundGradient.addColorStop(0.48, centerGlow);
  backgroundGradient.addColorStop(1, bottomFade);
  ctx2d.clearRect(0, 0, cssWidth, cssHeight);
  ctx2d.fillStyle = backgroundGradient;
  ctx2d.fillRect(0, 0, cssWidth, cssHeight);

  const pointerRatio = clamp(mageAmbientState.pointerScreenX / Math.max(1, window.innerWidth), 0, 1);
  const targetWindX = (pointerRatio - 0.5) * 56;
  mageAmbientState.windX += (targetWindX - mageAmbientState.windX) * Math.min(1, dt * 2.1);

  const particleColors = [
    toRgba(palette.a, 0.88),
    toRgba(palette.b, 0.82),
    toRgba(palette.c, 0.74),
  ];

  for (const particle of mageAmbientState.particles) {
    particle.phase += dt * particle.phaseSpeed * 2.4;
    const flutterX = Math.cos(particle.phase) * 16 + Math.sin(particle.phase * 0.47) * 8;
    particle.vx += (mageAmbientState.windX - particle.vx) * Math.min(1, dt * 1.9);
    particle.x += (particle.vx + flutterX) * dt;
    particle.y += particle.vy * dt;
    if (particle.x < -12) particle.x = cssWidth + randRange(2, 18);
    if (particle.x > cssWidth + 12) particle.x = -randRange(2, 18);
    if (particle.y > cssHeight + 10) {
      particle.y = -randRange(2, 22);
      particle.x = Math.random() * cssWidth;
      particle.vy = randRange(28, 74);
      particle.phase = Math.random() * Math.PI * 2;
    }
    ctx2d.fillStyle = particleColors[particle.colorIndex] ?? particleColors[0];
    ctx2d.fillRect(Math.round(particle.x), Math.round(particle.y), particle.size, particle.size);
  }
}

function setMageAmbientClassTheme(classId) {
  mageAmbientState.classId = classId || "wind";
}

function onMageAmbientPointerMove(event) {
  mageAmbientState.pointerScreenX = event.clientX;
  mageAmbientState.pointerScreenY = event.clientY;
}

function startMageAmbientEffect() {
  if (!mageAmbientCanvas || mageAmbientAnimFrame) {
    return;
  }
  resizeMageAmbientCanvas();
  mageAmbientState.windX = 0;
  mageAmbientLastTime = 0;
  mageAmbientAnimFrame = requestAnimationFrame(drawMageAmbient);
}

function drawHowtoPickupPreview(canvas, type, timeSec) {
  if (!canvas) {
    return;
  }
  const ctx2d = canvas.getContext("2d");
  if (!ctx2d) {
    return;
  }
  const cssSize = Math.max(32, Math.round(canvas.clientWidth || canvas.width || 84));
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const pixelSize = Math.max(1, Math.round(cssSize * dpr));
  if (canvas.width !== pixelSize || canvas.height !== pixelSize) {
    canvas.width = pixelSize;
    canvas.height = pixelSize;
  }

  const center = cssSize * 0.5;
  const bobOffset = Math.sin(timeSec * 2.4) * 4;
  const isXp = type === "xp-orb";
  const coreColor = isXp ? "rgba(255, 214, 92, 0.96)" : "rgba(87, 244, 167, 0.94)";
  const glowColor = isXp ? "rgba(255, 225, 128, 0.4)" : "rgba(126, 255, 183, 0.32)";
  const crossColor = isXp ? "rgba(255, 252, 233, 0.82)" : "rgba(231, 255, 241, 0.92)";
  const auraColor = isXp ? "rgba(255, 214, 92, 0.18)" : "rgba(107, 255, 178, 0.16)";
  const scale = cssSize / 84;

  ctx2d.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx2d.clearRect(0, 0, cssSize, cssSize);

  ctx2d.save();
  ctx2d.globalAlpha = 0.45;
  ctx2d.fillStyle = "rgba(6, 12, 10, 0.32)";
  ctx2d.beginPath();
  ctx2d.ellipse(center, center + 18 * scale, isXp ? 8 * scale : 11 * scale, 5 * scale, 0, 0, Math.PI * 2);
  ctx2d.fill();
  ctx2d.restore();

  ctx2d.save();
  ctx2d.fillStyle = auraColor;
  ctx2d.beginPath();
  ctx2d.arc(center, center + bobOffset, (isXp ? 11 : 16) * scale, 0, Math.PI * 2);
  ctx2d.fill();
  ctx2d.restore();

  ctx2d.save();
  ctx2d.translate(center, center + bobOffset);
  ctx2d.rotate(isXp ? 0 : Math.PI * 0.25);
  ctx2d.fillStyle = coreColor;
  ctx2d.shadowBlur = 18 * scale;
  ctx2d.shadowColor = glowColor;
  if (isXp) {
    ctx2d.beginPath();
    ctx2d.arc(0, 0, 6.2 * scale, 0, Math.PI * 2);
    ctx2d.fill();
  } else {
    ctx2d.fillRect(-9 * scale, -9 * scale, 18 * scale, 18 * scale);
  }
  ctx2d.restore();

  ctx2d.save();
  ctx2d.fillStyle = crossColor;
  if (isXp) {
    ctx2d.beginPath();
    ctx2d.arc(center, center + bobOffset, 3.3 * scale, 0, Math.PI * 2);
    ctx2d.fill();
    ctx2d.strokeStyle = "rgba(255, 252, 233, 0.82)";
    ctx2d.lineWidth = 1.1 * scale;
    ctx2d.beginPath();
    ctx2d.arc(center - 2.1 * scale, center + bobOffset - 2.1 * scale, 5.2 * scale, -1.15, -0.1);
    ctx2d.stroke();
  } else {
    const vBarX = center - 3 * scale;
    const vBarY = center + bobOffset - 8 * scale;
    const hBarX = center - 8 * scale;
    const hBarY = center + bobOffset - 3 * scale;
    if (typeof ctx2d.roundRect === "function") {
      ctx2d.beginPath();
      ctx2d.roundRect(vBarX, vBarY, 6 * scale, 16 * scale, 2 * scale);
      ctx2d.fill();
      ctx2d.beginPath();
      ctx2d.roundRect(hBarX, hBarY, 16 * scale, 6 * scale, 2 * scale);
      ctx2d.fill();
    } else {
      ctx2d.fillRect(vBarX, vBarY, 6 * scale, 16 * scale);
      ctx2d.fillRect(hBarX, hBarY, 16 * scale, 6 * scale);
    }
  }
  ctx2d.restore();
}

function stopHowtoPickupPreviewAnimation() {
  if (howtoPickupPreviewFrame) {
    cancelAnimationFrame(howtoPickupPreviewFrame);
    howtoPickupPreviewFrame = 0;
  }
}

function tickHowtoPickupPreview(nowMs) {
  if (!howToPlayOverlay || howToPlayOverlay.classList.contains("hidden")) {
    stopHowtoPickupPreviewAnimation();
    return;
  }
  if (!howtoPickupPreviewStart) {
    howtoPickupPreviewStart = nowMs;
  }
  const timeSec = (nowMs - howtoPickupPreviewStart) / 1000;
  drawHowtoPickupPreview(howtoXpCanvas, "xp-orb", timeSec);
  drawHowtoPickupPreview(howtoHealCanvas, "heal", timeSec + 0.45);
  howtoPickupPreviewFrame = requestAnimationFrame(tickHowtoPickupPreview);
}

function startHowtoPickupPreviewAnimation() {
  if ((!howtoXpCanvas && !howtoHealCanvas) || howtoPickupPreviewFrame) {
    return;
  }
  howtoPickupPreviewStart = 0;
  howtoPickupPreviewFrame = requestAnimationFrame(tickHowtoPickupPreview);
}

function hasSeenHowToPlay() {
  try {
    return window.localStorage?.getItem(HOW_TO_PLAY_STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

function markHowToPlaySeen() {
  try {
    window.localStorage?.setItem(HOW_TO_PLAY_STORAGE_KEY, "true");
  } catch {
    // ignore
  }
}

function openHowToPlay(options = {}) {
  if (!howToPlayOverlay) {
    return;
  }
  state.pause.helpPanel = true;
  pressedActions.clear();
  resetTouchControls();
  howToPlayOverlay.classList.remove("hidden");
  retriggerEnterAnimation(howToPlayOverlay, howToPlayPanel ?? howToPlayOverlay);
  startHowtoPickupPreviewAnimation();
  howToPlayOverlay.classList.toggle("is-first-run", Boolean(options.firstRun));
  if (options.firstRun) {
    markHowToPlaySeen();
  }
  syncMusicPauseState();
}

function closeHowToPlay() {
  if (!howToPlayOverlay) {
    return;
  }
  state.pause.helpPanel = false;
  howToPlayOverlay.classList.add("hidden");
  stopHowtoPickupPreviewAnimation();
  howToPlayOverlay.classList.remove("is-first-run");
  syncMusicPauseState();
}

function shouldPauseRunMusic() {
  return state.running
    && !state.runEnd.active
    && (state.pause.manual || state.pause.focus || state.pause.upgradesPanel || state.pause.helpPanel || state.pause.devMenu);
}

function syncMusicPauseState() {
  if (shouldPauseRunMusic()) {
    window.sfx?.pauseRunMusic?.();
  } else {
    window.sfx?.resumeRunMusic?.();
  }
}

function updateAudioMixerUI() {
  if (!audioMixer) {
    return;
  }
  const muted = Boolean(window.sfx?.isMuted?.());
  const musicMuted = muted || Boolean(window.sfx?.isMusicMuted?.());
  const sfxMuted = muted || Boolean(window.sfx?.isSfxMuted?.());
  const musicVolume = Math.max(0, Math.min(1, Number(window.sfx?.getMusicVolume?.() ?? 0.5)));
  const sfxVolume = Math.max(0, Math.min(1, Number(window.sfx?.getSfxVolume?.() ?? window.sfx?.getVolume?.() ?? 0.5)));

  audioMixer.classList.toggle("is-master-muted", muted);
  audioMixerButton?.setAttribute("aria-pressed", muted ? "true" : "false");
  if (audioMixerButton) {
    audioMixerButton.innerHTML = `${muted ? "\uD83D\uDD07" : "\uD83D\uDD0A"}<span class="audio-mixer-label">Sound</span>`;
    audioMixerButton.title = muted ? "Sound off (M)" : "Sound on (M)";
  }

  if (musicVolumeSlider) {
    musicVolumeSlider.value = String(Math.round(musicVolume * 100));
  }
  if (sfxVolumeSlider) {
    sfxVolumeSlider.value = String(Math.round(sfxVolume * 100));
  }
  if (musicVolume > 0.001) {
    lastMusicUiVolume = musicVolume;
  }
  if (sfxVolume > 0.001) {
    lastSfxUiVolume = sfxVolume;
  }
  musicMuteButton?.classList.toggle("is-muted", musicMuted || musicVolume <= 0.001);
  sfxMuteButton?.classList.toggle("is-muted", sfxMuted || sfxVolume <= 0.001);
}

function toggleStartSound() {
  if (!window.sfx) {
    return;
  }
  const prevMusicVolume = Math.max(0, Math.min(1, Number(window.sfx.getMusicVolume?.() ?? 0)));
  const prevSfxVolume = Math.max(0, Math.min(1, Number(window.sfx.getSfxVolume?.() ?? window.sfx.getVolume?.() ?? 0)));
  if (prevMusicVolume > 0.001) {
    lastMusicUiVolume = prevMusicVolume;
  }
  if (prevSfxVolume > 0.001) {
    lastSfxUiVolume = prevSfxVolume;
  }
  const muted = window.sfx.toggleMuted();
  if (muted) {
    window.sfx.setMusicMuted?.(true);
    window.sfx.setSfxMuted?.(true);
    window.sfx.setMusicVolume?.(0);
    window.sfx.setSfxVolume?.(0);
  } else {
    const restoredMusic = Math.max(0.05, lastMusicUiVolume);
    const restoredSfx = Math.max(0.05, lastSfxUiVolume);
    window.sfx.setMusicVolume?.(restoredMusic);
    window.sfx.setSfxVolume?.(restoredSfx);
    window.sfx.setMusicMuted?.(false);
    window.sfx.setSfxMuted?.(false);
    if (state.running && !window.sfx.isRunMusicActive?.()) {
      window.sfx.startRunMusic?.();
    }
  }
  updateAudioMixerUI();
}

function setMusicVolumeFromUi(rawValue) {
  if (!window.sfx?.setMusicVolume) {
    return;
  }
  const hadAudibleMusic = (window.sfx.getMusicVolume?.() ?? 0) > 0.001
    && !window.sfx.isMusicMuted?.();
  const value = Math.max(0, Math.min(1, Number(rawValue)));
  if (value > 0.001) {
    lastMusicUiVolume = value;
  }
  window.sfx.setMusicVolume(value);
  window.sfx.setMusicMuted?.(value <= 0.001);
  if (value > 0.001 && window.sfx.isMuted?.()) {
    window.sfx.setMuted?.(false);
  }
  if (!window.sfx.isMuted?.() && state.running && value > 0.001 && !hadAudibleMusic && !window.sfx.isRunMusicActive?.()) {
    window.sfx.startRunMusic?.();
  }
  updateAudioMixerUI();
}

function setSfxVolumeFromUi(rawValue) {
  if (!window.sfx?.setSfxVolume) {
    return;
  }
  const value = Math.max(0, Math.min(1, Number(rawValue)));
  if (value > 0.001) {
    lastSfxUiVolume = value;
  }
  window.sfx.setSfxVolume(value);
  window.sfx.setSfxMuted?.(value <= 0.001);
  if (value > 0.001 && window.sfx.isMuted?.()) {
    window.sfx.setMuted?.(false);
  }
  updateAudioMixerUI();
}

function toggleMusicMuteFromUi() {
  if (!window.sfx) {
    return;
  }
  const muted = Boolean(window.sfx.isMusicMuted?.()) || (window.sfx.getMusicVolume?.() ?? 0) <= 0.001;
  const currentVolume = Math.max(0, Math.min(1, Number(window.sfx.getMusicVolume?.() ?? 0)));
  if (muted) {
    const restored = Math.max(0.05, lastMusicUiVolume);
    if (window.sfx.isMuted?.()) {
      window.sfx.setMuted?.(false);
    }
    window.sfx.setMusicVolume?.(restored);
    window.sfx.setMusicMuted?.(false);
    if (!window.sfx.isMuted?.() && state.running && !window.sfx.isRunMusicActive?.()) {
      window.sfx.startRunMusic?.();
    }
  } else {
    if (currentVolume > 0.001) {
      lastMusicUiVolume = currentVolume;
    }
    window.sfx.setMusicMuted?.(true);
    window.sfx.setMusicVolume?.(0);
  }
  updateAudioMixerUI();
}

function toggleSfxMuteFromUi() {
  if (!window.sfx) {
    return;
  }
  const muted = Boolean(window.sfx.isSfxMuted?.()) || (window.sfx.getSfxVolume?.() ?? 0) <= 0.001;
  const currentVolume = Math.max(0, Math.min(1, Number(window.sfx.getSfxVolume?.() ?? 0)));
  if (muted) {
    const restored = Math.max(0.05, lastSfxUiVolume);
    if (window.sfx.isMuted?.()) {
      window.sfx.setMuted?.(false);
    }
    window.sfx.setSfxVolume?.(restored);
    window.sfx.setSfxMuted?.(false);
  } else {
    if (currentVolume > 0.001) {
      lastSfxUiVolume = currentVolume;
    }
    window.sfx.setSfxMuted?.(true);
    window.sfx.setSfxVolume?.(0);
  }
  updateAudioMixerUI();
}

function playShortcutUiClick() {
  window.sfx?.play("uiClick");
}

function getCurrentFocusClassId() {
  if (startOverlayFocusClassId && CLASS_DEFS[startOverlayFocusClassId]) {
    return startOverlayFocusClassId;
  }
  return metaProgress.selectedClassId;
}

function setStartOverlayFocusClass(classId, options = {}) {
  if (!CLASS_DEFS[classId]) {
    return;
  }
  startOverlayFocusClassId = classId;
  const unlocked = Boolean(metaProgress.unlocked[classId]);
  if (unlocked && options.persistSelection !== false) {
    metaProgress.selectedClassId = classId;
    saveMetaProgress();
  }
}

function cycleStartOverlayFocus(delta) {
  const currentClassId = getCurrentFocusClassId();
  const currentIndex = Math.max(0, CLASS_ORDER.indexOf(currentClassId));
  let attempts = 0;
  let nextIndex = currentIndex;
  do {
    nextIndex = (nextIndex + delta + CLASS_ORDER.length) % CLASS_ORDER.length;
    attempts += 1;
    if (metaProgress.unlocked[CLASS_ORDER[nextIndex]]) {
      break;
    }
  } while (attempts < CLASS_ORDER.length);
  const nextClassId = CLASS_ORDER[nextIndex];
  setStartOverlayFocusClass(nextClassId, { persistSelection: true });
  renderStartOverlay();
}

function triggerLockedClassFeedback(button) {
  if (!button) {
    return;
  }
  button.classList.remove("is-failing");
  void button.offsetWidth;
  button.classList.add("is-failing");
  window.setTimeout(() => {
    button.classList.remove("is-failing");
  }, 280);
  window.sfx?.play("dashFail");
}

function ensureClassHoverTooltip() {
  if (classHoverTooltipElement) {
    return classHoverTooltipElement;
  }
  classHoverTooltipElement = document.createElement("div");
  classHoverTooltipElement.className = "class-hover-tooltip hidden";
  document.querySelector(".game-root")?.appendChild(classHoverTooltipElement);
  return classHoverTooltipElement;
}

function hideClassHoverTooltip() {
  if (!classHoverTooltipElement) {
    return;
  }
  classHoverTooltipElement.classList.add("hidden");
}

function showClassHoverTooltip(button, classId) {
  const tooltip = ensureClassHoverTooltip();
  tooltip.innerHTML = buildClassHoverTooltipHtml(classId);
  tooltip.classList.remove("hidden");
  positionClassHoverTooltip(button, tooltip);
}

function positionClassHoverTooltip(anchor, tooltip) {
  const anchorRect = anchor.getBoundingClientRect();
  const tooltipRect = tooltip.getBoundingClientRect();
  const x = clamp(anchorRect.left + anchorRect.width * 0.5 - tooltipRect.width * 0.5, 12, window.innerWidth - tooltipRect.width - 12);
  const aboveY = anchorRect.top - tooltipRect.height - 10;
  const y = aboveY >= 10 ? aboveY : Math.min(window.innerHeight - tooltipRect.height - 10, anchorRect.bottom + 10);
  tooltip.style.left = `${Math.round(x)}px`;
  tooltip.style.top = `${Math.round(y)}px`;
}

function buildClassHoverTooltipHtml(classId) {
  const classDef = CLASS_DEFS[classId];
  const requirement = CLASS_UNLOCK_REQUIREMENTS[classId];
  const targetClassId = getCurrentUnlockTargetId(metaProgress);
  const isCurrentTarget = classId === targetClassId;
  if (!requirement || !requirement.enemyType) {
    return [
      `<div class="class-hover-head">🔓 ${classDef?.title ?? "Class"} is unlocked</div>`,
    ].join("");
  }
  const enemyLabel = formatEnemyTypeLabel(requirement.enemyType);
  const enemyEmoji = ENEMY_ARCHETYPES[requirement.enemyType]?.emoji ?? "\u2620\uFE0F";
  const xpCurrent = isCurrentTarget ? Math.min(requirement.xp, metaProgress.unlockState.xp) : 0;
  const killCurrent = isCurrentTarget ? Math.min(requirement.enemyKills, metaProgress.unlockState.kills) : 0;
  const xpDone = isCurrentTarget && xpCurrent >= requirement.xp;
  const killsDone = isCurrentTarget && killCurrent >= requirement.enemyKills;
  const gateNote = isCurrentTarget
    ? ""
    : `<div class="class-hover-note">First unlock the previous mage in the chain.</div>`;
  return [
    `<div class="class-hover-head">\uD83D\uDD12 Unlock ${classDef?.title ?? "Class"}</div>`,
    gateNote,
    `<div class="class-hover-steps">`,
    `<div class="class-hover-step ${xpDone ? "is-complete" : ""}"><span class="class-hover-index">${xpDone ? "✓" : "1"}</span><div class="class-hover-copy"><strong>${xpDone ? "Complete: " : ""}Gain XP</strong><span>${xpCurrent} / ${requirement.xp}</span></div></div>`,
    `<div class="class-hover-step ${killsDone ? "is-complete" : ""}"><span class="class-hover-index">${killsDone ? "✓" : "2"}</span><div class="class-hover-copy"><strong>${killsDone ? "Complete: " : ""}<span class="class-hover-enemy">${enemyEmoji}</span> Defeat ${enemyLabel}</strong><span>${killCurrent} / ${requirement.enemyKills}</span></div></div>`,
    `</div>`,
  ].join("");
}

function onClassThumbPointerMove(event) {
  const button = event.target.closest(".class-thumb");
  if (!button || !classThumbStrip?.contains(button)) {
    hideClassHoverTooltip();
    return;
  }
  const classId = button.dataset.classId;
  if (!classId || metaProgress.unlocked[classId]) {
    hideClassHoverTooltip();
    return;
  }
  showClassHoverTooltip(button, classId);
}

function isSkillSoundSource(source) {
  const sourceName = String(source ?? "");
  return sourceName === "gale-ring" ||
    sourceName === "crosswind-strip" ||
    sourceName === "tempest-node" ||
    sourceName === "blizzard-wake" ||
    sourceName === "permafrost-seal" ||
    sourceName === "crystal-spear" ||
    sourceName === "cinder-halo" ||
    sourceName === "sunspot" ||
    sourceName === "ash-comet" ||
    sourceName === "bone-ward" ||
    sourceName === "requiem-field" ||
    sourceName === "grave-call" ||
    sourceName === "thrall" ||
    sourceName === "vein-burst" ||
    sourceName === "crimson-pool" ||
    sourceName === "blood-rite" ||
    sourceName === "holy-wave";
}

function bindEvents() {
  document.addEventListener("click", (event) => {
    const button = event.target.closest("button");
    if (!button) {
      return;
    }
    if (button.dataset.noUiClick === "true") {
      return;
    }
    window.sfx?.play("uiClick");
  });

  window.addEventListener("keydown", (event) => {
    if (event.code === "F8" && !event.repeat && !event.ctrlKey && !event.metaKey) {
      togglePerformanceProfiler();
      event.preventDefault();
      return;
    }
    if (event.code === "F9" && !event.repeat && !event.ctrlKey && !event.metaKey) {
      togglePerformanceRecorder();
      renderProfilerOverlay();
      event.preventDefault();
      return;
    }

    if (isDevToggleEvent(event)) {
      if (state.running && !state.levelUp.active && !state.bossReward.active) {
        toggleDevMenu();
      }
      event.preventDefault();
      return;
    }

    if (event.code === "Escape") {
      if (state.pause.helpPanel) {
        playShortcutUiClick();
        closeHowToPlay();
        event.preventDefault();
        return;
      }

      if (!state.running) {
        return;
      }

      if (state.levelUp.active || state.bossReward.active) {
        event.preventDefault();
        return;
      }

      if (state.pause.upgradesPanel) {
        playShortcutUiClick();
        closeUpgradesPanel();
      } else if (isPauseActive()) {
        playShortcutUiClick();
        clearPause();
      } else {
        playShortcutUiClick();
        setPause("manual", true);
      }

      event.preventDefault();
      return;
    }

    if (event.code === "Tab") {
      if (state.running && !state.levelUp.active && !state.bossReward.active) {
        playShortcutUiClick();
        if (state.pause.upgradesPanel) {
          closeUpgradesPanel();
        } else {
          openUpgradesPanel();
        }
      }
      event.preventDefault();
      return;
    }

    if (event.code === "KeyH" && !event.repeat && !event.ctrlKey && !event.metaKey) {
      if (state.running && !state.levelUp.active && !state.bossReward.active) {
        playShortcutUiClick();
        if (state.pause.helpPanel) {
          closeHowToPlay();
        } else {
          openHowToPlay();
        }
      }
      event.preventDefault();
      return;
    }

    if (event.code === "KeyM" && !event.repeat && !event.ctrlKey && !event.metaKey) {
      const wasMuted = Boolean(window.sfx?.isMuted?.());
      if (!wasMuted) {
        playShortcutUiClick();
      }
      toggleStartSound();
      if (wasMuted) {
        playShortcutUiClick();
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

    if (isDashEvent(event) && state.running && !isPauseActive() && !event.repeat) {
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
      playShortcutUiClick();
      event.preventDefault();
      if (!startOverlay.classList.contains("hidden")) {
        startRun();
      } else {
        restartSameClassRunWithArchiveOutro();
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
    resetTouchControls();
    hideSkillTooltip();
    hideClassHoverTooltip();
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
  window.addEventListener("pointermove", onMageAmbientPointerMove, { passive: true });
  restartButton.addEventListener("click", restartSameClassRunWithArchiveOutro);
  returnMenuButton?.addEventListener("click", returnToMainMenuWithArchiveOutro);
  pauseRestartButton.addEventListener("click", () => endRun({ instant: true, cause: "ended" }));
  upgradeOptions.addEventListener("click", onUpgradeOptionClick);
  bossRewardOptions.addEventListener("click", onBossRewardOptionClick);
  upgradesButton.addEventListener("click", toggleUpgradesPanel);
  menuResumeButton?.addEventListener("click", clearPause);
  menuUpgradesButton?.addEventListener("click", openUpgradesPanel);
  menuHelpButton?.addEventListener("click", () => {
    if (state.running && !state.levelUp.active && !state.bossReward.active) {
      openHowToPlay();
    }
  });
  menuEndRunButton?.addEventListener("click", () => {
    if (!pauseMenuEndRunConfirm) {
      requestPauseMenuEndRunConfirm();
      return;
    }
    clearPauseMenuEndRunConfirm();
    endRun({ instant: true, cause: "ended" });
  });
  helpButton?.addEventListener("click", () => {
    if (state.running && !state.levelUp.active && !state.bossReward.active) {
      openHowToPlay();
    }
  });
  closeHowToButton?.addEventListener("click", closeHowToPlay);
  howToPlayOverlay?.addEventListener("click", (event) => {
    if (event.target === howToPlayOverlay) {
      closeHowToPlay();
    }
  });
  closeUpgradesButton.addEventListener("click", closeUpgradesPanel);
  upgradesList.addEventListener("click", onUpgradeRowClick);
  pauseOverlay.addEventListener("click", (event) => {
    if (event.target !== pauseOverlay || !isPauseActive()) {
      return;
    }
    clearPause();
  });
  devTabNav.addEventListener("click", onDevTabClick);
  grantAllUpgradesButton.addEventListener("click", () => window.debug_game?.grantAllUpgrades());
  grantAllMinorButton.addEventListener("click", () => window.debug_game?.grantAllMinorUpgrades());
  grantAllMajorButton.addEventListener("click", () => window.debug_game?.grantAllMajorUpgrades());
  spawnBossButton.addEventListener("click", handleSpawnBossClick);
  clearEnemiesButton.addEventListener("click", () => window.debug_game?.clearEnemies());
  setLevelButton.addEventListener("click", () => {
    window.debug_game?.setPlayerLevel(Number(devLevelInput.value));
  });
  gainLevelButton.addEventListener("click", () => window.debug_game?.gainLevel(1));
  setHpButton.addEventListener("click", () => {
    window.debug_game?.setPlayerMaxHp(Number(devMaxHpInput.value));
    window.debug_game?.setPlayerHp(Number(devHpInput.value));
  });
  setDashButton.addEventListener("click", () => {
    window.debug_game?.setDashCharges(Number(devDashChargesInput.value), Number(devDashMaxInput.value));
  });
  toggleZenModeButton.addEventListener("click", () => {
    window.debug_game?.setZenMode(!state.dev.zenMode);
  });
  toggleInvulnerableButton.addEventListener("click", () => {
    window.debug_game?.setPlayerInvulnerable(!state.dev.playerInvulnerable);
  });
  toggleManualSkillsButton.addEventListener("click", () => {
    window.debug_game?.setManualSkillMode(!state.dev.manualSkillMode);
  });
  toggleZeroCooldownButton.addEventListener("click", () => {
    window.debug_game?.setSkillLabZeroCooldown(!state.dev.zeroSkillCooldown);
  });
  devEnemySpawnList.addEventListener("click", onDevEnemySpawnClick);
  devSkillToggleList.addEventListener("click", onDevSkillToggleClick);
  devClassButtons.addEventListener("click", onDevClassButtonClick);
  startRunButton.addEventListener("click", startRun);
  classThumbStrip?.addEventListener("click", onClassThumbClick);
  classThumbStrip?.addEventListener("pointermove", onClassThumbPointerMove);
  classThumbStrip?.addEventListener("pointerleave", hideClassHoverTooltip);
  classPreviewPrev?.addEventListener("click", () => cycleStartOverlayFocus(-1));
  classPreviewNext?.addEventListener("click", () => cycleStartOverlayFocus(1));
  audioMixerButton?.addEventListener("click", (event) => {
    event.preventDefault();
    toggleStartSound();
    openAudioMixerPanel();
  });
  audioMixer?.addEventListener("pointerenter", openAudioMixerPanel);
  audioMixer?.addEventListener("pointerleave", queueAudioMixerClose);
  audioMixerPanel?.addEventListener("pointerenter", openAudioMixerPanel);
  audioMixerPanel?.addEventListener("pointerleave", queueAudioMixerClose);
  musicMuteButton?.addEventListener("click", toggleMusicMuteFromUi);
  sfxMuteButton?.addEventListener("click", toggleSfxMuteFromUi);
  musicVolumeSlider?.addEventListener("input", (event) => setMusicVolumeFromUi(Number(event.target.value) / 100));
  sfxVolumeSlider?.addEventListener("input", (event) => setSfxVolumeFromUi(Number(event.target.value) / 100));
  audioMixerPanel?.addEventListener("pointerdown", (event) => {
    event.stopPropagation();
  });
  for (const card of [passiveSkillCard, ...skillCardElements.map((entry) => entry.root)]) {
    if (!card) {
      continue;
    }
    card.setAttribute("tabindex", "0");
    card.addEventListener("pointerenter", () => showSkillTooltip(card));
    card.addEventListener("pointermove", () => showSkillTooltip(card));
    card.addEventListener("pointerleave", hideSkillTooltip);
    card.addEventListener("pointercancel", hideSkillTooltip);
    card.addEventListener("mouseenter", () => showSkillTooltip(card));
    card.addEventListener("mousemove", () => showSkillTooltip(card));
    card.addEventListener("mouseleave", hideSkillTooltip);
    card.addEventListener("focus", () => showSkillTooltip(card));
    card.addEventListener("blur", hideSkillTooltip);
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
  touchMoveZone.addEventListener("pointerdown", onTouchMovePointerDown);
  touchDashButton.addEventListener("pointerdown", onTouchDashPointerDown);
  window.addEventListener("pointermove", onTouchPointerMove, { passive: false });
  window.addEventListener("pointerup", onTouchPointerEnd);
  window.addEventListener("pointercancel", onTouchPointerEnd);
  audioMixer?.classList.add("hidden");
  startMageAmbientEffect();
  updateAudioMixerUI();
}

function resizeCanvas() {
  viewWidth = Math.max(360, window.innerWidth);
  viewHeight = Math.max(240, window.innerHeight);
  applyRenderResolution(true);
  resizeMageAmbientCanvas();
  updateTouchInterface();
}

function getHardwareRenderBudgetFactor() {
  const deviceMemory = navigator.deviceMemory ?? 4;
  const cpuCores = navigator.hardwareConcurrency ?? 4;
  if (deviceMemory <= 2 || cpuCores <= 2) {
    return 0.78;
  }
  if (deviceMemory <= 4 || cpuCores <= 4) {
    return 0.9;
  }
  return 1;
}

function getTargetRenderScale() {
  const viewportPixels = viewWidth * viewHeight;
  const perfTier = state?.performance?.tier ?? 0;
  const baseBudget = RENDER_PIXEL_BUDGETS[Math.min(RENDER_PIXEL_BUDGETS.length - 1, perfTier)];
  const adjustedBudget = baseBudget * getHardwareRenderBudgetFactor();
  if (viewportPixels <= adjustedBudget) {
    return 1;
  }
  return clamp(Math.sqrt(adjustedBudget / viewportPixels), 0.7, 1);
}

function applyVisualPixelScale(targetScale) {
  const factor = targetScale >= 0.9 ? 0.92 : 0.97;
  return clamp(targetScale * factor, 0.66, 1);
}

function applyRenderResolution(force = false) {
  const baseScale = Math.round(getTargetRenderScale() * 20) / 20;
  const targetScale = applyVisualPixelScale(baseScale);
  const nextScale = clamp(targetScale, 0.66, 1);
  const nextWidth = Math.max(1, Math.round(viewWidth * nextScale));
  const nextHeight = Math.max(1, Math.round(viewHeight * nextScale));
  if (!force && canvas.width === nextWidth && canvas.height === nextHeight && Math.abs(renderScale - nextScale) < 0.001) {
    state.performance.renderScaleTarget = nextScale;
    return false;
  }

  renderScale = nextScale;
  state.performance.renderScaleTarget = nextScale;
  canvas.width = nextWidth;
  canvas.height = nextHeight;
  ctx.setTransform(renderScale, 0, 0, renderScale, 0, 0);
  ctx.imageSmoothingEnabled = false;
  invalidateBackgroundCache();
  refreshScreenGradients();
  return true;
}

function refreshScreenGradients() {
  backgroundGradient = ctx.createLinearGradient(0, 0, 0, viewHeight);
  backgroundGradient.addColorStop(0, "#1a2b4a");
  backgroundGradient.addColorStop(1, "#2b3f66");

  screenVignetteGradient = ctx.createRadialGradient(
    viewWidth * 0.5,
    viewHeight * 0.5,
    Math.min(viewWidth, viewHeight) * 0.12,
    viewWidth * 0.5,
    viewHeight * 0.5,
    Math.max(viewWidth, viewHeight) * 0.78
  );
  screenVignetteGradient.addColorStop(0, "rgba(0, 0, 0, 0)");
  screenVignetteGradient.addColorStop(1, "rgba(3, 10, 28, 1)");

  hurtVignetteGradient = ctx.createRadialGradient(
    viewWidth * 0.5,
    viewHeight * 0.5,
    Math.min(viewWidth, viewHeight) * 0.18,
    viewWidth * 0.5,
    viewHeight * 0.5,
    Math.max(viewWidth, viewHeight) * 0.72
  );
  hurtVignetteGradient.addColorStop(0, "rgba(0, 0, 0, 0)");
  hurtVignetteGradient.addColorStop(0.72, "rgba(138, 34, 32, 0.54)");
  hurtVignetteGradient.addColorStop(1, "rgba(186, 44, 38, 1)");

  deathWashGradient = ctx.createLinearGradient(0, 0, 0, viewHeight);
  deathWashGradient.addColorStop(0, "rgba(244, 132, 114, 1)");
  deathWashGradient.addColorStop(1, "rgba(122, 32, 34, 1)");
}

function invalidateBackgroundCache() {
  terrainRenderCache.zoom = null;
  terrainRenderCache.startWorldX = null;
  terrainRenderCache.startWorldY = null;
  terrainRenderCache.endWorldX = null;
  terrainRenderCache.endWorldY = null;
  terrainRenderCache.waterTiles = [];
  terrainRenderCache.lastRebuildStartX = null;
  terrainRenderCache.lastRebuildStartY = null;
  // Force drawWorldFeatures to re-collect features on next frame (world seed may have changed)
  worldFeaturesDrawCache.startRX = null;
}

function requestHudRefresh(force = false) {
  state.hudTimer = 0;
  if (force) {
    state.hudPendingForce = true;
  }
}

function actionFromEvent(event) {
  const byCode = ACTIONS_BY_CODE[event.code];
  if (byCode) {
    return byCode;
  }

  const normalizedKey = (event.key ?? "").toLowerCase();
  return ACTIONS_BY_KEY[normalizedKey] ?? null;
}

function isTouchInterfaceEnabled() {
  const coarsePointer = window.matchMedia?.("(hover: none) and (pointer: coarse)")?.matches ?? false;
  return coarsePointer || ((navigator.maxTouchPoints ?? 0) > 0 && Math.min(window.innerWidth, window.innerHeight) <= 900);
}

function updateTouchInterface() {
  const enabled = isTouchInterfaceEnabled();
  touchInput.enabled = enabled;
  document.body.classList.toggle("touch-ui-active", enabled);
  touchControls.classList.toggle("hidden", !enabled);
  touchControls.setAttribute("aria-hidden", enabled ? "false" : "true");
  if (!enabled) {
    resetTouchControls();
  } else {
    updateTouchJoystickVisual();
  }
}

function isTouchGameplayBlocked() {
  return !state.running || state.levelUp.active || state.bossReward.active || isPauseActive();
}

function resetTouchControls() {
  resetTouchMove();
  touchInput.dashPointerId = null;
  touchDashButton.classList.remove("is-active");
}

function resetTouchMove() {
  const move = touchInput.move;
  move.pointerId = null;
  move.active = false;
  move.anchorX = 86;
  move.anchorY = 86;
  move.currentX = 86;
  move.currentY = 86;
  move.vectorX = 0;
  move.vectorY = 0;
  updateTouchJoystickVisual();
}

function updateTouchJoystickVisual() {
  const move = touchInput.move;
  const anchorX = move.active ? move.anchorX : 86;
  const anchorY = move.active ? move.anchorY : 86;
  const knobX = move.active ? move.currentX : anchorX;
  const knobY = move.active ? move.currentY : anchorY;
  touchJoystick.style.left = `${anchorX}px`;
  touchJoystick.style.top = `${anchorY}px`;
  touchJoystickKnob.style.left = `${knobX}px`;
  touchJoystickKnob.style.top = `${knobY}px`;
  touchJoystick.classList.toggle("is-active", move.active);
}

function clampTouchMovePoint(clientX, clientY) {
  const rect = touchMoveZone.getBoundingClientRect();
  const padding = touchInput.move.capturePadding;
  return {
    x: clamp(clientX - rect.left, padding, rect.width - padding),
    y: clamp(clientY - rect.top, padding, rect.height - padding),
  };
}

function updateTouchMoveState(clientX, clientY) {
  const move = touchInput.move;
  const nextPoint = clampTouchMovePoint(clientX, clientY);
  const dx = nextPoint.x - move.anchorX;
  const dy = nextPoint.y - move.anchorY;
  const distance = Math.hypot(dx, dy);
  const clampedDistance = Math.min(move.maxRadius, distance);
  const ratio = distance > 0.0001 ? clampedDistance / move.maxRadius : 0;
  const dirX = distance > 0.0001 ? dx / distance : 0;
  const dirY = distance > 0.0001 ? dy / distance : 0;
  move.currentX = move.anchorX + dirX * clampedDistance;
  move.currentY = move.anchorY + dirY * clampedDistance;
  move.vectorX = dirX * ratio;
  move.vectorY = dirY * ratio;
  updateTouchJoystickVisual();
}

function onTouchMovePointerDown(event) {
  if (!touchInput.enabled || event.pointerType === "mouse" || isTouchGameplayBlocked()) {
    return;
  }
  const move = touchInput.move;
  const nextAnchor = clampTouchMovePoint(event.clientX, event.clientY);
  move.pointerId = event.pointerId;
  move.active = true;
  move.anchorX = nextAnchor.x;
  move.anchorY = nextAnchor.y;
  move.currentX = nextAnchor.x;
  move.currentY = nextAnchor.y;
  move.vectorX = 0;
  move.vectorY = 0;
  touchMoveZone.setPointerCapture?.(event.pointerId);
  updateTouchMoveState(event.clientX, event.clientY);
  event.preventDefault();
}

function onTouchDashPointerDown(event) {
  if (!touchInput.enabled || event.pointerType === "mouse" || isTouchGameplayBlocked()) {
    return;
  }
  touchInput.dashPointerId = event.pointerId;
  touchDashButton.classList.add("is-active");
  touchDashButton.setPointerCapture?.(event.pointerId);
  if (!tryDash()) {
    triggerDashUnavailableFeedback();
  }
  event.preventDefault();
}

function onTouchPointerMove(event) {
  if (!touchInput.enabled || event.pointerType === "mouse") {
    return;
  }
  if (event.pointerId !== touchInput.move.pointerId) {
    return;
  }
  if (isTouchGameplayBlocked()) {
    resetTouchMove();
    return;
  }
  updateTouchMoveState(event.clientX, event.clientY);
  event.preventDefault();
}

function onTouchPointerEnd(event) {
  if (event.pointerId === touchInput.move.pointerId) {
    resetTouchMove();
  }
  if (event.pointerId === touchInput.dashPointerId) {
    touchInput.dashPointerId = null;
    touchDashButton.classList.remove("is-active");
  }
}

function isDevToggleEvent(event) {
  return event.code === "Slash";
}

function isDashEvent(event) {
  return event.code === "Space" || event.code === "ShiftLeft" || event.code === "ShiftRight";
}

function onDevTabClick(event) {
  const button = event.target.closest("[data-dev-tab]");
  if (!button) {
    return;
  }
  setDevTab(button.dataset.devTab);
}

function onDevEnemySpawnClick(event) {
  const button = event.target.closest("[data-enemy-type]");
  if (!button) {
    return;
  }

  const row = button.closest(".dev-spawn-row");
  const countInput = row?.querySelector("input");
  const count = Number(countInput?.value ?? 1);
  window.debug_game?.spawnEnemy(button.dataset.enemyType, count);
}

function onDevSkillToggleClick(event) {
  const button = event.target.closest("[data-skill-id]");
  if (!button) {
    return;
  }

  const enabled = button.dataset.skillEnabled === "true";
  window.debug_game?.setSkillEnabled(button.dataset.skillId, !enabled);
}

function onDevClassButtonClick(event) {
  const button = event.target.closest("[data-class-id]");
  if (!button) {
    return;
  }

  window.debug_game?.selectClass(button.dataset.classId);
}

function setDevTab(tabId) {
  if (!["skills", "spawn", "character", "class"].includes(tabId)) {
    return;
  }
  state.dev.activeTab = tabId;
  refreshPauseOverlay();
}

function gameLoop(nowMs) {
  if (deterministicSteppingEnabled) {
    render();
    requestAnimationFrame(gameLoop);
    return;
  }

  const now = nowMs / 1000;
  const elapsed = now - previousTime;
  const frameTime = Math.min(elapsed, MAX_FRAME_TIME);
  previousTime = now;
  updateFps(frameTime);
  beginProfilerFrame(frameTime);
  accumulator += frameTime;

  while (accumulator >= FIXED_STEP) {
    update(FIXED_STEP);
    accumulator -= FIXED_STEP;
  }

  const renderStart = profilerNow();
  render();
  profileCurrentFrameRenderTotal(profilerNow() - renderStart);
  finalizeProfilerFrame();
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
  perf.tier = getPerformanceTier();
  applyRenderResolution();
  const label = `FPS ${perf.fpsDisplay}`;
  if (state.hudCache.fps !== label) {
    state.hudCache.fps = label;
    fpsValue.textContent = label;
  }
}

function profilerNow() {
  return performance.now();
}

function getProfilerState() {
  return state?.performance?.profiler ?? null;
}

function isProfilerEnabled() {
  return Boolean(getProfilerState()?.enabled);
}

function clampProfilerRecorderValue(value, min, max, fallback) {
  if (!Number.isFinite(value)) {
    return fallback;
  }
  return clamp(value, min, max);
}

function getPerformanceRecorderCounts() {
  return {
    enemies: state.enemies.length,
    projectiles: state.projectiles.length,
    effects: state.effects.length,
    enemyAttacks: state.enemyAttacks.length,
    damageNumbers: state.damageNumbers.length,
    allies: state.allies.length,
  };
}

function createPerformanceRecorderRunSession() {
  const classDef = getClassDef();
  return {
    runId: PERFORMANCE_RECORDER.nextRunId++,
    classId: state.player.classId,
    classTitle: classDef?.title ?? state.player.classId,
    startedAtIso: new Date().toISOString(),
    startedAtSec: Number(state.elapsed.toFixed(2)),
    samples: [],
    droppedSamples: 0,
    peakCpuMs: 0,
    peakAtSec: 0,
    minFps: Number.POSITIVE_INFINITY,
    maxCounts: getPerformanceRecorderCounts(),
    topStages: Object.create(null),
  };
}

function bumpRecorderTopStages(recorderRun, stagePairs) {
  for (const [stageId, value] of stagePairs) {
    const previous = recorderRun.topStages[stageId] ?? 0;
    if (value > previous) {
      recorderRun.topStages[stageId] = value;
    }
  }
}

function pushPerformanceRecorderSample(force = false) {
  const recorder = PERFORMANCE_RECORDER;
  const profiler = getProfilerState();
  if (!recorder.enabled || !recorder.activeRun || !profiler?.enabled) {
    return;
  }
  if (!force) {
    recorder.sampleTimer -= 0.25;
    if (recorder.sampleTimer > 0) {
      return;
    }
  }
  recorder.sampleTimer = recorder.sampleEverySec;
  const sampleCounts = getPerformanceRecorderCounts();
  const sample = {
    timeSec: Number(state.elapsed.toFixed(2)),
    fps: state.performance.fpsDisplay,
    cpuMs: Number(profiler.avgCpuMs.toFixed(3)),
    updateMs: Number(profiler.avgUpdateMs.toFixed(3)),
    renderMs: Number(profiler.avgRenderMs.toFixed(3)),
    counts: sampleCounts,
    topStages: getProfilerTopStages(4).map(([stageId, value]) => ({
      stageId,
      ms: Number(value.toFixed(3)),
    })),
  };
  if (recorder.activeRun.samples.length >= recorder.maxSamplesPerRun) {
    recorder.activeRun.droppedSamples += 1;
  } else {
    recorder.activeRun.samples.push(sample);
  }
  recorder.activeRun.peakCpuMs = Math.max(recorder.activeRun.peakCpuMs, sample.cpuMs);
  if (sample.cpuMs >= recorder.activeRun.peakCpuMs) {
    recorder.activeRun.peakAtSec = sample.timeSec;
  }
  recorder.activeRun.minFps = Math.min(recorder.activeRun.minFps, sample.fps);
  recorder.activeRun.maxCounts.enemies = Math.max(recorder.activeRun.maxCounts.enemies, sampleCounts.enemies);
  recorder.activeRun.maxCounts.projectiles = Math.max(recorder.activeRun.maxCounts.projectiles, sampleCounts.projectiles);
  recorder.activeRun.maxCounts.effects = Math.max(recorder.activeRun.maxCounts.effects, sampleCounts.effects);
  recorder.activeRun.maxCounts.enemyAttacks = Math.max(recorder.activeRun.maxCounts.enemyAttacks, sampleCounts.enemyAttacks);
  recorder.activeRun.maxCounts.damageNumbers = Math.max(recorder.activeRun.maxCounts.damageNumbers, sampleCounts.damageNumbers);
  recorder.activeRun.maxCounts.allies = Math.max(recorder.activeRun.maxCounts.allies, sampleCounts.allies);
  bumpRecorderTopStages(
    recorder.activeRun,
    Object.entries(profiler.avgStageMs).sort((a, b) => b[1] - a[1]).slice(0, 8)
  );
}

function ensurePerformanceRecorderRun() {
  const recorder = PERFORMANCE_RECORDER;
  if (!recorder.enabled || !state.running) {
    return;
  }
  if (!isProfilerEnabled()) {
    recorder.forceProfiler = true;
    setPerformanceProfilerEnabled(true);
  } else {
    resetProfilerStats();
  }
  if (!recorder.activeRun) {
    recorder.activeRun = createPerformanceRecorderRunSession();
    recorder.sampleTimer = 0;
  }
}

function finalizePerformanceRecorderRun(cause = "ended") {
  const recorder = PERFORMANCE_RECORDER;
  if (!recorder.activeRun) {
    return null;
  }
  pushPerformanceRecorderSample(true);
  const completedRun = recorder.activeRun;
  completedRun.endedAtIso = new Date().toISOString();
  completedRun.durationSec = Number(state.elapsed.toFixed(2));
  completedRun.endCause = String(cause ?? "ended");
  completedRun.minFps = Number.isFinite(completedRun.minFps) ? completedRun.minFps : state.performance.fpsDisplay;
  completedRun.topStages = Object.entries(completedRun.topStages)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([stageId, ms]) => ({ stageId, ms: Number(ms.toFixed(3)) }));
  completedRun.finalSnapshot = getPerformanceProfilerSnapshot();
  recorder.runs.push(completedRun);
  if (recorder.runs.length > recorder.maxRuns) {
    recorder.runs.splice(0, recorder.runs.length - recorder.maxRuns);
  }
  recorder.activeRun = null;
  recorder.sampleTimer = 0;
  return completedRun;
}

function setPerformanceRecorderEnabled(enabled, options = null) {
  const recorder = PERFORMANCE_RECORDER;
  if (options && typeof options === "object") {
    if (Object.prototype.hasOwnProperty.call(options, "sampleEverySec")) {
      recorder.sampleEverySec = clampProfilerRecorderValue(Number(options.sampleEverySec), 0.2, 4, recorder.sampleEverySec);
    }
    if (Object.prototype.hasOwnProperty.call(options, "maxSamplesPerRun")) {
      recorder.maxSamplesPerRun = Math.round(clampProfilerRecorderValue(Number(options.maxSamplesPerRun), 120, 4000, recorder.maxSamplesPerRun));
    }
    if (Object.prototype.hasOwnProperty.call(options, "maxRuns")) {
      recorder.maxRuns = Math.round(clampProfilerRecorderValue(Number(options.maxRuns), 1, 50, recorder.maxRuns));
      if (recorder.runs.length > recorder.maxRuns) {
        recorder.runs.splice(0, recorder.runs.length - recorder.maxRuns);
      }
    }
  }

  const next = Boolean(enabled);
  if (next === recorder.enabled) {
    return recorder.enabled;
  }

  recorder.enabled = next;
  recorder.sampleTimer = 0;
  if (recorder.enabled) {
    ensurePerformanceRecorderRun();
    return true;
  }

  if (state?.running) {
    finalizePerformanceRecorderRun("recording_stopped");
  }
  if (recorder.forceProfiler) {
    recorder.forceProfiler = false;
    setPerformanceProfilerEnabled(false);
  }
  return false;
}

function togglePerformanceRecorder(forceState = null, options = null) {
  const next = forceState == null ? !PERFORMANCE_RECORDER.enabled : Boolean(forceState);
  return setPerformanceRecorderEnabled(next, options);
}

function clearPerformanceRecorderData() {
  PERFORMANCE_RECORDER.runs = [];
  PERFORMANCE_RECORDER.activeRun = null;
  PERFORMANCE_RECORDER.sampleTimer = 0;
  ensurePerformanceRecorderRun();
}

function getPerformanceRecorderSnapshot() {
  return {
    enabled: PERFORMANCE_RECORDER.enabled,
    sampleEverySec: PERFORMANCE_RECORDER.sampleEverySec,
    maxSamplesPerRun: PERFORMANCE_RECORDER.maxSamplesPerRun,
    maxRuns: PERFORMANCE_RECORDER.maxRuns,
    activeRun: PERFORMANCE_RECORDER.activeRun
      ? JSON.parse(JSON.stringify(PERFORMANCE_RECORDER.activeRun))
      : null,
    runs: PERFORMANCE_RECORDER.runs.map((run) => JSON.parse(JSON.stringify(run))),
  };
}

function getPerformanceRecorderSummary() {
  const lastRun = PERFORMANCE_RECORDER.runs.at(-1) ?? null;
  return {
    enabled: PERFORMANCE_RECORDER.enabled,
    runsCaptured: PERFORMANCE_RECORDER.runs.length,
    hasActiveRun: Boolean(PERFORMANCE_RECORDER.activeRun),
    sampleEverySec: PERFORMANCE_RECORDER.sampleEverySec,
    lastRun: lastRun
      ? {
        runId: lastRun.runId,
        classId: lastRun.classId,
        durationSec: lastRun.durationSec,
        endCause: lastRun.endCause,
        peakCpuMs: lastRun.peakCpuMs,
        minFps: lastRun.minFps,
        samples: lastRun.samples.length,
      }
      : null,
  };
}

function beginProfilerFrame(frameTime) {
  const profiler = getProfilerState();
  if (!profiler || !profiler.enabled) {
    return;
  }
  profiler.current = {
    updateMs: 0,
    renderMs: 0,
    stages: Object.create(null),
  };
  profiler.frameBudgetMs = frameTime * 1000;
}

function profileStage(kind, name, callback) {
  const profiler = getProfilerState();
  const current = profiler?.current;
  if (!profiler?.enabled || !current) {
    callback();
    return;
  }
  const started = profilerNow();
  callback();
  const elapsed = profilerNow() - started;
  const key = `${kind}:${name}`;
  current.stages[key] = (current.stages[key] ?? 0) + elapsed;
  if (kind === "u") {
    current.updateMs += elapsed;
  } else {
    current.renderMs += elapsed;
  }
}

function profileUpdateStage(name, callback) {
  profileStage("u", name, callback);
}

function profileRenderStage(name, callback) {
  profileStage("r", name, callback);
}

function profileCurrentFrameRenderTotal(elapsedMs) {
  const profiler = getProfilerState();
  if (!profiler?.enabled || !profiler.current) {
    return;
  }
  profiler.current.renderMs = Math.max(profiler.current.renderMs, elapsedMs);
}

function finalizeProfilerFrame() {
  const profiler = getProfilerState();
  if (!profiler?.enabled || !profiler.current) {
    return;
  }

  const frame = profiler.current;
  const cpuMs = frame.updateMs + frame.renderMs;
  profiler.frameIndex += 1;
  profiler.windowFrames += 1;
  profiler.windowCpuMs += cpuMs;
  profiler.windowUpdateMs += frame.updateMs;
  profiler.windowRenderMs += frame.renderMs;
  for (const [key, value] of Object.entries(frame.stages)) {
    profiler.windowStageMs[key] = (profiler.windowStageMs[key] ?? 0) + value;
  }

  if (cpuMs > profiler.worstCpuMs) {
    profiler.worstCpuMs = cpuMs;
    profiler.worstAt = state.elapsed;
  }

  profiler.refreshTimer -= TARGET_FRAME_TIME;
  if (profiler.refreshTimer > 0) {
    profiler.current = null;
    return;
  }
  profiler.refreshTimer = 0.25;

  const frames = Math.max(1, profiler.windowFrames);
  profiler.avgCpuMs = profiler.windowCpuMs / frames;
  profiler.avgUpdateMs = profiler.windowUpdateMs / frames;
  profiler.avgRenderMs = profiler.windowRenderMs / frames;
  profiler.avgStageMs = Object.create(null);
  for (const [key, value] of Object.entries(profiler.windowStageMs)) {
    profiler.avgStageMs[key] = value / frames;
  }
  pushPerformanceRecorderSample(false);
  profiler.windowFrames = 0;
  profiler.windowCpuMs = 0;
  profiler.windowUpdateMs = 0;
  profiler.windowRenderMs = 0;
  profiler.windowStageMs = Object.create(null);
  renderProfilerOverlay();
  profiler.current = null;
}

function getProfilerTopStages(limit = 5) {
  const profiler = getProfilerState();
  if (!profiler?.enabled) {
    return [];
  }
  return Object.entries(profiler.avgStageMs)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit);
}

function formatProfilerStageLabel(key) {
  if (!key || key.length < 3) {
    return key ?? "";
  }
  if (key.startsWith("u:")) {
    return `U ${key.slice(2)}`;
  }
  if (key.startsWith("r:")) {
    return `R ${key.slice(2)}`;
  }
  return key;
}

function renderProfilerOverlay() {
  const profiler = getProfilerState();
  if (!perfProfiler) {
    return;
  }
  if (!profiler?.enabled) {
    perfProfiler.classList.add("hidden");
    perfProfiler.textContent = "";
    return;
  }

  const budget = profiler.frameBudgetMs || (1000 / TARGET_FPS);
  const slack = budget - profiler.avgCpuMs;
  const topStages = getProfilerTopStages(6)
    .map(([name, value]) => `${formatProfilerStageLabel(name)} ${value.toFixed(2)}ms`)
    .join(" | ");
  const lines = [
    `Profiler F8 | Record F9: ${PERFORMANCE_RECORDER.enabled ? "ON" : "OFF"} | CPU ${profiler.avgCpuMs.toFixed(2)}ms (U ${profiler.avgUpdateMs.toFixed(2)} / R ${profiler.avgRenderMs.toFixed(2)}) | Budget ${budget.toFixed(2)} | Slack ${slack.toFixed(2)}`,
    `Top: ${topStages || "no samples yet"}`,
    `Counts: E ${state.enemies.length} | P ${state.projectiles.length} | FX ${state.effects.length} | ATK ${state.enemyAttacks.length} | DMG ${state.damageNumbers.length} | Ally ${state.allies.length}`,
    `Caches: Terrain ${TERRAIN_TILE_CACHE.size}/${TERRAIN_TILE_CACHE_MAX_ENTRIES} | Regions ${WORLD_FEATURE_CACHE.size}`,
    `Worst: ${profiler.worstCpuMs.toFixed(2)}ms @ ${formatTime(profiler.worstAt)}`,
  ];
  perfProfiler.textContent = lines.join("\n");
  perfProfiler.classList.remove("hidden");
}

function resetProfilerStats() {
  const profiler = getProfilerState();
  if (!profiler) {
    return;
  }
  profiler.refreshTimer = 0;
  profiler.frameIndex = 0;
  profiler.windowFrames = 0;
  profiler.windowCpuMs = 0;
  profiler.windowUpdateMs = 0;
  profiler.windowRenderMs = 0;
  profiler.windowStageMs = Object.create(null);
  profiler.avgCpuMs = 0;
  profiler.avgUpdateMs = 0;
  profiler.avgRenderMs = 0;
  profiler.avgStageMs = Object.create(null);
  profiler.worstCpuMs = 0;
  profiler.worstAt = 0;
  profiler.current = null;
}

function setPerformanceProfilerEnabled(enabled) {
  if (!enabled && PERFORMANCE_RECORDER.enabled) {
    return;
  }
  const profiler = getProfilerState();
  if (!profiler) {
    return;
  }
  profiler.enabled = Boolean(enabled);
  if (profiler.enabled) {
    resetProfilerStats();
    renderProfilerOverlay();
  } else if (perfProfiler) {
    perfProfiler.classList.add("hidden");
    perfProfiler.textContent = "";
  }
}

function togglePerformanceProfiler(forceState = null) {
  const profiler = getProfilerState();
  if (!profiler) {
    return false;
  }
  const next = forceState == null ? !profiler.enabled : Boolean(forceState);
  setPerformanceProfilerEnabled(next);
  return next;
}

function getPerformanceProfilerSnapshot() {
  const profiler = getProfilerState();
  if (!profiler) {
    return null;
  }
  return {
    enabled: profiler.enabled,
    budgetMs: profiler.frameBudgetMs,
    avgCpuMs: profiler.avgCpuMs,
    avgUpdateMs: profiler.avgUpdateMs,
    avgRenderMs: profiler.avgRenderMs,
    avgStages: { ...profiler.avgStageMs },
    worstCpuMs: profiler.worstCpuMs,
    worstAt: profiler.worstAt,
    counts: {
      enemies: state.enemies.length,
      projectiles: state.projectiles.length,
      effects: state.effects.length,
      enemyAttacks: state.enemyAttacks.length,
      damageNumbers: state.damageNumbers.length,
      allies: state.allies.length,
    },
    caches: {
      terrainTiles: TERRAIN_TILE_CACHE.size,
      terrainTilesMax: TERRAIN_TILE_CACHE_MAX_ENTRIES,
      worldRegions: WORLD_FEATURE_CACHE.size,
    },
  };
}

function getPerformanceTier() {
  const perf = state.performance;
  const loadScore =
    state.enemies.length * 1 +
    state.effects.length * 1.4 +
    state.projectiles.length * 0.85 +
    state.enemyAttacks.length * 1.15 +
    state.damageNumbers.length * 0.4 +
    state.allies.length * 0.75;
  if (perf.fpsSmooth < 30 || loadScore > 340) {
    return 3;
  }
  if (perf.fpsSmooth < 42 || loadScore > 250) {
    return 2;
  }
  if (perf.fpsSmooth < 54 || loadScore > 170) {
    return 1;
  }
  return 0;
}

function getFxTier() {
  return Math.min(2, getPerformanceTier());
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
  if (!state?.hudMotion) {
    return;
  }
  const profilerActive = isProfilerEnabled();
  if (profilerActive) {
    profileUpdateStage("hudBars", () => updateHudBarAnimations(dt));
    profileUpdateStage("archiveToast", () => updateArchiveToast(dt));
  } else {
    updateHudBarAnimations(dt);
    updateArchiveToast(dt);
  }

  if (state.runEnd.active) {
    if (profilerActive) {
      profileUpdateStage("runEnd", () => updateRunEndSequence(dt));
      profileUpdateStage("effects", () => updateEffects(dt));
      profileUpdateStage("cleanup", cleanupDeadEntities);
    } else {
      updateRunEndSequence(dt);
      updateEffects(dt);
      cleanupDeadEntities();
    }
    return;
  }

  if (!state.running || state.levelUp.active || state.bossReward.active || isPauseActive()) {
    return;
  }

  let simDt = dt;
  if (state.bossIntro.active) {
    updateBossIntroCinematic(dt);
    simDt *= 0.14;
  }

  state.tick += 1;
  state.elapsed += simDt;
  state.metaRun.activeDuration += simDt;
  const hpRatio = state.player.hp / Math.max(1, state.player.maxHp);
  if (hpRatio < 0.35) {
    const danger = Math.max(0, 1 - hpRatio * 1.35);
    window.sfx?.play("heartbeat", { intensity: 0.6 + danger * 0.5 });
  }

  if (profilerActive) {
    profileUpdateStage("playerMove", () => updatePlayerMovement(simDt));
    profileUpdateStage("playerRegen", () => updatePlayerRegeneration(simDt));
    profileUpdateStage("classBuffs", () => updatePlayerClassBuffs(simDt));
    profileUpdateStage("autoFire", () => updateAutoFire(simDt));
    profileUpdateStage("autoSkills", () => updateAutoSkills(simDt));
    profileUpdateStage("projectiles", () => updateProjectiles(simDt));
    profileUpdateStage("effects", () => updateEffects(simDt));
    profileUpdateStage("spawn", () => spawnEnemies(simDt));
    profileUpdateStage("bossSpawn", maybeSpawnBosses);
    profileUpdateStage("enemies", () => updateEnemiesAndSpatialGrid(simDt));
    profileUpdateStage("allies", () => updateAllies(simDt));
    profileUpdateStage("projVsEnemy", () => resolveProjectileEnemyCollisions(state.enemyGrid));
    profileUpdateStage("allyVsEnemy", () => resolveAllyEnemyCollisions(state.enemyGrid));
    profileUpdateStage("enemyAttacks", () => updateEnemyAttacks(simDt));
    profileUpdateStage("playerDamage", () => resolvePlayerEnemyDamage(simDt, state.enemyGrid));
    profileUpdateStage("pickups", () => updatePickups(simDt));
    profileUpdateStage("portal", () => updatePortal?.(simDt));
    profileUpdateStage("cleanup", cleanupDeadEntities);
    profileUpdateStage("archiveProgress", () => updateArchiveRunProgress(simDt));
  } else {
    updatePlayerMovement(simDt);
    updatePlayerRegeneration(simDt);
    updatePlayerClassBuffs(simDt);
    updateAutoFire(simDt);
    updateAutoSkills(simDt);
    updateProjectiles(simDt);
    updateEffects(simDt);
    spawnEnemies(simDt);
    maybeSpawnBosses();
    updateEnemiesAndSpatialGrid(simDt);
    updateAllies(simDt);
    resolveProjectileEnemyCollisions(state.enemyGrid);
    resolveAllyEnemyCollisions(state.enemyGrid);
    updateEnemyAttacks(simDt);
    resolvePlayerEnemyDamage(simDt, state.enemyGrid);
    updatePickups(simDt);
    updatePortal?.(simDt);
    cleanupDeadEntities();
    updateArchiveRunProgress(simDt);
  }

  state.hudTimer -= simDt;
  if (state.hudTimer <= 0) {
    state.hudTimer = 0.08;
    if (profilerActive) {
      profileUpdateStage("hud", () => updateHud(state.hudPendingForce));
    } else {
      updateHud(state.hudPendingForce);
    }
    state.hudPendingForce = false;
  }
}

function updatePlayerMovement(dt) {
  const player = state.player;
  updateDashState(dt);

  if (player.dash.activeTimer > 0) {
    const dashProgress = clamp(1 - player.dash.activeTimer / Math.max(0.0001, player.dash.duration), 0, 1);
    const dashEase = 1 - dashProgress * 0.52;
    moveCircleEntity(player, player.dash.vx * dashEase * dt, player.dash.vy * dashEase * dt, player.radius);
    return;
  }

  const movement = getMovementAxis();
  const hasInput = movement.x !== 0 || movement.y !== 0;
  let targetVX = 0;
  let targetVY = 0;

  if (hasInput) {
    const length = Math.hypot(movement.x, movement.y) || 1;
    const normalizedX = movement.x / length;
    const normalizedY = movement.y / length;
    const haste = player.afterDashBuffTimer > 0 ? 1 + player.afterDashHaste : 1;
    const windRush = player.windRushTimer > 0 ? 1 + player.windRushBonus : 1;
    const moveSpeed = player.speed * player.speedMultiplier * haste * windRush;
    targetVX = normalizedX * moveSpeed;
    targetVY = normalizedY * moveSpeed;
  }

  const response = hasInput ? 15.5 : 10.5;
  const blend = 1 - Math.exp(-response * dt);
  player.moveVX += (targetVX - player.moveVX) * blend;
  player.moveVY += (targetVY - player.moveVY) * blend;

  const moveLength = Math.hypot(player.moveVX, player.moveVY);
  if (!hasInput && moveLength < 5) {
    player.moveVX = 0;
    player.moveVY = 0;
    return;
  }
  if (moveLength > 0.0001) {
    player.lastMoveX = player.moveVX / moveLength;
    player.lastMoveY = player.moveVY / moveLength;
  }
  moveCircleEntity(player, player.moveVX * dt, player.moveVY * dt, player.radius);
}

function getMovementAxis() {
  const keyboardX = Number(pressedActions.has("right")) - Number(pressedActions.has("left"));
  const keyboardY = Number(pressedActions.has("down")) - Number(pressedActions.has("up"));
  const x = clamp(keyboardX + touchInput.move.vectorX, -1, 1);
  const y = clamp(keyboardY + touchInput.move.vectorY, -1, 1);
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
    if (Math.hypot(dash.vx, dash.vy) > 0.0001) {
      state.player.moveVX = dash.vx * 0.22;
      state.player.moveVY = dash.vy * 0.22;
    }
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

function getPlayerMissingHpRatio() {
  return clamp(1 - state.player.hp / Math.max(1, state.player.maxHp), 0, 0.85);
}

function updateNecroSiphon(dt) {
  const player = state.player;
  if (player.classId !== "necro") {
    player.necroSiphonActive = false;
    return;
  }
  const activeThralls = countActiveThralls();
  player.necroSiphonActive = activeThralls >= Math.max(3, player.necroSummonCap - 4);
}

function updatePlayerClassBuffs(dt) {
  state.player.afterDashBuffTimer = Math.max(0, state.player.afterDashBuffTimer - dt);
  state.player.windRushTimer = Math.max(0, state.player.windRushTimer - dt);
  state.player.bloodRiteTimer = Math.max(0, state.player.bloodRiteTimer - dt);
  state.player.bloodGuardTimer = Math.max(0, state.player.bloodGuardTimer - dt);
  state.player.lastCritTimer = Math.max(0, state.player.lastCritTimer - dt);
  if (state.player.lastCritTimer <= 0) {
    state.player.lastCritSource = null;
  }
  state.player.damageReduction = 0;
  updateNecroSiphon(dt);
  updateBloodHoldBonuses();
  for (const skill of state.player.skills) {
    skill.unlockPulseTimer = Math.max(0, skill.unlockPulseTimer - dt);
    skill.castFlashTimer = Math.max(0, skill.castFlashTimer - dt);
  }
}

function countActiveThralls() {
  return state.allies.reduce((count, ally) => count + (!ally.dead && ally.kind === "thrall" ? 1 : 0), 0);
}

function isPointInsideEffect(x, y, effectKind) {
  return state.effects.some((effect) => {
    if (effect.life <= 0 || effect.kind !== effectKind) {
      return false;
    }
    return Math.hypot(effect.x - x, effect.y - y) <= effect.radius;
  });
}

function countNearbyBloodMarkedEnemies(radius) {
  let count = 0;
  visitEnemiesInRange(state.player.x, state.player.y, radius, (enemy) => {
    if (enemy.dead || enemy.bloodMarkTimer <= 0) {
      return;
    }
    if (Math.hypot(enemy.x - state.player.x, enemy.y - state.player.y) <= radius + enemy.radius) {
      count += 1;
    }
  });
  return count;
}

function updateBloodHoldBonuses() {
  const player = state.player;
  if (player.classId !== "blood") {
    return;
  }

  const markedNearby = countNearbyBloodMarkedEnemies(178);
  const insidePool = isPointInsideEffect(player.x, player.y, "crimson-pool");
  const inRite = player.bloodRiteTimer > 0;
  const guardActive = player.bloodGuardTimer > 0;

  let reduction = 0;
  if (markedNearby >= 2) {
    reduction += player.bloodStandReduction + Math.min(0.06, (markedNearby - 2) * player.bloodMarkedReduction);
  }
  if (insidePool) {
    reduction += player.bloodPoolReduction;
  }
  if (inRite) {
    reduction += player.bloodRiteReduction;
  }
  if (guardActive) {
    reduction += 0.12;
  }
  player.damageReduction = Math.max(player.damageReduction, Math.min(0.52, reduction));
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
  if (player.classId === "wind") {
    player.windRushTimer = Math.max(player.windRushTimer, 1.05);
  }
  const speed = dash.distance / dash.duration;
  dash.vx = dirX * speed;
  dash.vy = dirY * speed;
  player.moveVX = dash.vx * 0.18;
  player.moveVY = dash.vy * 0.18;
  if (!state.dev.zenMode && dash.charges < dash.maxCharges && dash.rechargeTimer <= 0) {
    dash.rechargeTimer = Math.max(0.85, dash.rechargeTime / (1 + player.dash.rechargeMultiplier));
  }

  spawnDashEffect(player.x, player.y, dirX, dirY);
  window.sfx?.play("dash");
  updateHud(true);
  return true;
}

function triggerDashUnavailableFeedback() {
  const dash = state.player.dash;
  dash.failFlashTimer = Math.max(dash.failFlashTimer, 0.34);
  window.sfx?.play("dashFail");
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

    pickup.floatTime += dt;
    pickup.spawnTimer = Math.max(0, (pickup.spawnTimer ?? 0) - dt);
    pickup.absorbTimer = Math.max(0, pickup.absorbTimer ?? 0);
    pickup.expireTimer = Math.max(0, pickup.expireTimer ?? 0);

    if (pickup.expiring) {
      pickup.expireTimer -= dt;
      if (pickup.expireTimer <= 0) {
        pickup.dead = true;
      }
      continue;
    }

    pickup.life -= dt;
    if (pickup.life <= 0) {
      beginPickupExpire(pickup);
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

    if (shouldAutoAbsorbPickup(pickup, player)) {
      beginPickupAbsorb(pickup);
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

function isXpPickup(pickup) {
  return pickup.type === "xp-orb" || pickup.type === "xp-cache";
}

function getPickupMotionProfile(pickup, player = state.player) {
  const magnetBonus = player.pickupMagnetRadius ?? 0;
  if (pickup.type === "xp-cache") {
    return {
      magnetRadius: 272 + magnetBonus,
      basePull: 620,
      curvePull: 1720,
      closePull: 2800,
      drag: 6.9,
      maxSpeed: 980,
      absorbCommitRadius: 78 + magnetBonus * 0.24,
      nearDuration: 0.085,
      farDuration: 0.18,
      collectEarly: true,
    };
  }
  if (pickup.type === "xp-orb") {
    return {
      magnetRadius: 214 + magnetBonus,
      basePull: 560,
      curvePull: 1440,
      closePull: 2450,
      drag: 6.7,
      maxSpeed: 860,
      absorbCommitRadius: 58 + magnetBonus * 0.2,
      nearDuration: 0.068,
      farDuration: 0.135,
      collectEarly: true,
    };
  }
  return {
    magnetRadius: 220 + magnetBonus,
    basePull: 520,
    curvePull: 1260,
    closePull: 980,
    drag: 7.5,
    maxSpeed: 780,
    absorbCommitRadius: 0,
    nearDuration: 0.09,
    farDuration: 0.18,
    collectEarly: false,
  };
}

function updateMagneticPickupMotion(pickup, player, dt) {
  const profile = getPickupMotionProfile(pickup, player);
  pickup.vx = (pickup.vx ?? 0) * Math.exp(-profile.drag * dt);
  pickup.vy = (pickup.vy ?? 0) * Math.exp(-profile.drag * dt);

  const dx = player.x - pickup.x;
  const dy = player.y - pickup.y;
  const distance = Math.hypot(dx, dy) || 1;
  if (distance <= profile.magnetRadius) {
    const distanceFactor = 1 - distance / profile.magnetRadius;
    const curvedFactor = distanceFactor * distanceFactor;
    const closeFactor = curvedFactor * curvedFactor;
    const pull = profile.basePull + curvedFactor * profile.curvePull + closeFactor * profile.closePull;
    pickup.vx += (dx / distance) * pull * dt;
    pickup.vy += (dy / distance) * pull * dt;
    const speed = Math.hypot(pickup.vx, pickup.vy);
    const maxSpeed = profile.maxSpeed + closeFactor * 320;
    if (speed > maxSpeed) {
      const speedScale = maxSpeed / Math.max(1, speed);
      pickup.vx *= speedScale;
      pickup.vy *= speedScale;
    }
  }

  pickup.x += pickup.vx * dt;
  pickup.y += pickup.vy * dt;
}

function shouldAutoAbsorbPickup(pickup, player) {
  if (!isXpPickup(pickup) || pickup.absorbing || pickup.expiring) {
    return false;
  }
  const profile = getPickupMotionProfile(pickup, player);
  if (profile.absorbCommitRadius <= 0) {
    return false;
  }
  return circlesOverlap(
    player.x,
    player.y,
    player.radius + profile.absorbCommitRadius,
    pickup.x,
    pickup.y,
    pickup.radius
  );
}

function beginPickupAbsorb(pickup) {
  if (pickup.absorbing || pickup.expiring) {
    return false;
  }
  pickup.absorbing = true;
  pickup.absorbStartX = pickup.x;
  pickup.absorbStartY = pickup.y;
  const distance = Math.hypot(state.player.x - pickup.x, state.player.y - pickup.y);
  const profile = getPickupMotionProfile(pickup);
  const normalized = clamp(distance / Math.max(1, profile.magnetRadius * 0.72), 0, 1);
  pickup.absorbDuration = lerp(profile.nearDuration, profile.farDuration, normalized);
  pickup.absorbTimer = pickup.absorbDuration;
  pickup.vx = 0;
  pickup.vy = 0;
  if (profile.collectEarly && !pickup.claimed) {
    pickup.claimed = true;
    grantExperience(pickup.xpAmount);
  }
  return true;
}

function beginPickupExpire(pickup) {
  if (pickup.expiring || pickup.dead || pickup.absorbing) {
    return false;
  }
  pickup.expiring = true;
  pickup.expireDuration = pickup.type === "xp-cache" ? 0.28 : pickup.type === "xp-orb" ? 0.24 : 0.26;
  pickup.expireTimer = pickup.expireDuration;
  pickup.vx = 0;
  pickup.vy = 0;
  return true;
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
  window.sfx?.play("pickupHeal");
  updateHud(false);
}

function collectXpPickup(pickup) {
  pickup.dead = true;
  spawnXpPickupEffect(pickup.x, pickup.y, pickup.type === "xp-cache" ? 1.22 : 0.86);
  if (pickup.type === "xp-cache") {
    window.sfx?.play("pickupCache");
  } else {
    const chain = Math.min(12, Math.max(0, Math.floor(state.metaRun.xpCollected / 60)));
    window.sfx?.play("pickupXp", { chain });
  }
  if (!pickup.claimed) {
    grantExperience(pickup.xpAmount);
  }
  updateHud(false);
}

function findNearestEnemy(originX, originY, maxRange = Number.POSITIVE_INFINITY, predicate = null) {
  const cacheKey = !predicate && Number.isFinite(maxRange)
    ? buildQueryKey("nearest", originX, originY, maxRange)
    : null;
  const queryCache = cacheKey ? getFrameQueryCache() : null;
  if (queryCache?.has(cacheKey)) {
    const cached = queryCache.get(cacheKey);
    if (!cached || !cached.dead) {
      return cached;
    }
    queryCache.delete(cacheKey);
  }

  let nearest = null;
  let nearestDistanceSq = maxRange * maxRange;
  visitEnemiesInRange(originX, originY, maxRange, (enemy) => {
    if (predicate && !predicate(enemy)) {
      return;
    }

    const dx = enemy.x - originX;
    const dy = enemy.y - originY;
    const distanceSq = dx * dx + dy * dy;

    if (distanceSq < nearestDistanceSq) {
      nearestDistanceSq = distanceSq;
      nearest = enemy;
    }
  });

  if (queryCache) {
    queryCache.set(cacheKey, nearest);
  }
  return nearest;
}

function findDensestEnemyCluster(originX, originY, radius = 220, maxRange = 820) {
  const cacheKey = buildQueryKey("cluster", originX, originY, maxRange, radius);
  const queryCache = getFrameQueryCache();
  if (queryCache.has(cacheKey)) {
    return queryCache.get(cacheKey);
  }

  let best = null;
  let bestScore = -1;
  const radiusSq = radius * radius;
  const maxRangeSq = maxRange * maxRange;
  const anchors = [];
  visitEnemiesInRange(originX, originY, maxRange, (enemy) => {
    const originDx = enemy.x - originX;
    const originDy = enemy.y - originY;
    if (originDx * originDx + originDy * originDy <= maxRangeSq) {
      anchors.push(enemy);
    }
  });

  const perfTier = getPerformanceTier();
  const anchorStride = perfTier >= 3 ? 4 : perfTier >= 2 ? 3 : perfTier >= 1 ? 2 : 1;
  for (let index = 0; index < anchors.length; index += anchorStride) {
    const anchor = anchors[index];
    let score = 0;
    let centerX = 0;
    let centerY = 0;

    visitEnemiesInRange(anchor.x, anchor.y, radius, (enemy) => {
      const dx = enemy.x - anchor.x;
      const dy = enemy.y - anchor.y;
      const distanceSq = dx * dx + dy * dy;
      if (distanceSq > radiusSq) {
        return;
      }
      const weight = 1 + Math.max(0, 1 - Math.sqrt(distanceSq) / radius) * 1.4 + enemy.radius * 0.03;
      score += weight;
      centerX += enemy.x * weight;
      centerY += enemy.y * weight;
    });

    if (score > bestScore && score > 0) {
      bestScore = score;
      best = {
        x: centerX / score,
        y: centerY / score,
        score,
      };
    }
  }

  queryCache.set(cacheKey, best);
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
        damage: 3,
        masteryDamage: 2.5,
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
      didCast = castCrosswindStrip(skillState.mastery);
      break;
    case "tempest-node":
      didCast = castTempestNode(skillState.mastery);
      break;
    case "blizzard-wake":
      spawnPlayerAura("blizzard-wake", {
        radius: 126,
        life: 1.2,
        damage: 2,
        masteryDamage: 1.5,
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
        damage: 3,
        masteryDamage: 2.5,
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
    if (state.player.classId === "wind") {
      state.player.windRushTimer = Math.max(state.player.windRushTimer, 1.45);
    }
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
    damage: (spec.damage + (spec.masteryDamage ?? 0) * mastery) * state.player.skillDamageMultiplier * state.player.zoneDamageMultiplier,
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

function castCrosswindStrip(mastery) {
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
    damage: (2.5 + mastery * 2) * state.player.skillDamageMultiplier,
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
    damage: (2 + mastery * 1.5) * state.player.skillDamageMultiplier,
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
    damage: (8 + mastery * 4) * state.player.skillDamageMultiplier,
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
    damage: (22 + mastery * 16) * state.player.skillDamageMultiplier,
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
    damage: (2.5 + mastery * 2) * state.player.skillDamageMultiplier * state.player.zoneDamageMultiplier,
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
    damage: (30 + mastery * 22) * state.player.skillDamageMultiplier,
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
    life: 4.6 * (1 + state.player.skillDurationMultiplier) + mastery * 0.45,
    maxLife: 4.6 * (1 + state.player.skillDurationMultiplier) + mastery * 0.45,
    orbitCount: 4 + mastery,
    radius: 88 + mastery * 16,
    damage: (2 + mastery * 1) * state.player.skillDamageMultiplier,
    interval: 0.2,
    tickTimer: 0.02,
    color: "rgba(170, 239, 202, {a})",
    secondaryColor: "rgba(66, 176, 120, {a})",
    tertiaryColor: "rgba(121, 144, 247, {a})",
    lightColor: "rgba(224, 255, 240, {a})",
    tailLife: 0.3,
  });
  for (let index = 0; index < 1 + mastery; index += 1) {
    spawnNecroThrall(
      state.player.x + Math.cos((index / Math.max(1, 1 + mastery)) * Math.PI * 2) * 42,
      state.player.y + Math.sin((index / Math.max(1, 1 + mastery)) * Math.PI * 2) * 42,
      {
        sourceType: "bone-ward",
        speed: 160 + mastery * 8,
        damage: 11 + mastery * 2,
        life: 10 + mastery * 1.2,
        radius: 13,
      }
    );
  }
  return true;
}

function castRequiemField(mastery) {
  const cluster = findDensestEnemyCluster(state.player.x, state.player.y, 180, 460) ?? { x: state.player.x, y: state.player.y };
  pushEffect({
    kind: "requiem-field",
    renderLayer: "top",
    x: cluster.x,
    y: cluster.y,
    life: 4.2 * (1 + state.player.skillDurationMultiplier),
    maxLife: 4.2 * (1 + state.player.skillDurationMultiplier),
    radius: 142 * (1 + state.player.skillAreaMultiplier + mastery * 0.08),
    damage: (2 + mastery * 1) * state.player.skillDamageMultiplier * state.player.zoneDamageMultiplier,
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
    .slice(0, 1 + mastery);
  const fallbackCount = nearbyCorpses.length === 0 ? 1 : 0;
  for (const corpse of nearbyCorpses) {
    corpse.life = 0;
    spawnNecroThrall(corpse.x, corpse.y, {
      sourceType: corpse.type,
      radius: Math.max(12, corpse.radius * 0.72),
      speed: 160 + mastery * 8,
      damage: 12 + mastery * 2,
      life: 14 + mastery * 2,
    });
  }
  for (let index = 0; index < fallbackCount; index += 1) {
    const angle = (index / Math.max(1, fallbackCount)) * Math.PI * 2 + randRange(-0.22, 0.22);
    spawnNecroThrall(
      state.player.x + Math.cos(angle) * randRange(24, 56),
      state.player.y + Math.sin(angle) * randRange(24, 56),
      {
        sourceType: "phantom",
        speed: 162 + mastery * 8,
        damage: 10 + mastery * 2,
        life: 11 + mastery * 2,
      }
    );
  }
  return true;
}

function castVeinBurst(mastery) {
  state.player.bloodGuardTimer = Math.max(state.player.bloodGuardTimer, 1.55 + mastery * 0.24);
  pushEffect({
    kind: "vein-burst",
    renderLayer: "top",
    followPlayer: true,
    x: state.player.x,
    y: state.player.y,
    life: 0.84,
    maxLife: 0.84,
    radius: 112 * (1 + state.player.skillAreaMultiplier + mastery * 0.08),
    damage: (4 + mastery * 5) * state.player.skillDamageMultiplier,
    interval: 0.14,
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
  pushEffect({
    kind: "crimson-pool",
    renderLayer: "top",
    x: state.player.x,
    y: state.player.y,
    life: 4 * (1 + state.player.skillDurationMultiplier),
    maxLife: 4 * (1 + state.player.skillDurationMultiplier),
    radius: 132 * (1 + state.player.skillAreaMultiplier + mastery * 0.08),
    damage: 1.5 * state.player.skillDamageMultiplier * state.player.zoneDamageMultiplier,
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
  state.player.bloodGuardTimer = Math.max(state.player.bloodGuardTimer, 2.25 + mastery * 0.34);
  state.player.bloodRiteTimer = Math.max(state.player.bloodRiteTimer, 4.6 + mastery * 0.8);
  requestHudRefresh(false);
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
  const pressure = Math.min(1.2, Math.max(0, state.elapsed - 30) / 180);
  const latePressure = Math.max(0, state.elapsed - 170) / 230;
  const bossActive = hasLivingBoss();
  let ambientEnemyCount = state.enemies.reduce(
    (total, enemy) => total + (enemy.isBoss ? 0 : 1),
    0
  );
  let dynamicInterval =
    director.baseInterval - Math.min(1, pressure) * (director.baseInterval - director.minInterval);
  dynamicInterval *= Math.max(0.62, 1 - Math.min(0.34, latePressure * 0.28));
  if (bossActive) {
    dynamicInterval *= SPAWN_DIRECTOR_CONFIG.bossSpawnIntervalMultiplier;
  }
  const earlyCapScale = Math.min(1, state.elapsed / SPAWN_DIRECTOR_CONFIG.earlyCapRampTime);
  const earlyCapBase = SPAWN_DIRECTOR_CONFIG.earlyCapMin + (director.maxEnemiesOnField - SPAWN_DIRECTOR_CONFIG.earlyCapMin) * earlyCapScale;
  const dynamicMaxEnemies = Math.round(earlyCapBase * (1 + Math.min(0.55, latePressure * 0.34)));
  const dynamicBossAmbientCap = Math.round(SPAWN_DIRECTOR_CONFIG.bossAmbientCap * (1 + Math.min(0.4, latePressure * 0.22)));

  director.timer -= dt;

  let safety = 0;
  const safetyLimit = bossActive ? 3 : 10;
  while (director.timer <= 0 && safety < safetyLimit) {
    director.timer += dynamicInterval;
    safety += 1;

    if (state.enemies.length >= dynamicMaxEnemies) {
      director.timer = Math.max(director.timer, 0.06);
      return;
    }

    if (bossActive && ambientEnemyCount >= dynamicBossAmbientCap) {
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
      if (state.enemies.length >= dynamicMaxEnemies) {
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

function buildBossBagSignature(eligible) {
  return eligible.map((type) => `${type}:${state.bossDefeats[type] ?? 0}`).join("|");
}

function buildWeightedBossBag(eligible, atTime) {
  const bag = [];
  for (const type of eligible) {
    const baseWeight = BOSS_RANDOM_WEIGHTS[type] ?? 1;
    const defeatCount = state.bossDefeats[type] ?? 0;
    const unlockTime = BOSS_UNLOCK_TIMES[type] ?? 0;
    const timeSinceUnlock = Math.max(0, atTime - unlockTime);
    const freshnessBias = 1 + Math.min(0.32, timeSinceUnlock / 900);
    const defeatPenalty = 1 / (1 + defeatCount * 0.9);
    const tickets = Math.max(1, Math.round(baseWeight * freshnessBias * defeatPenalty * 2));
    for (let i = 0; i < tickets; i += 1) {
      bag.push(type);
    }
  }

  for (let i = bag.length - 1; i > 0; i -= 1) {
    const swapIndex = Math.floor(Math.random() * (i + 1));
    const current = bag[i];
    bag[i] = bag[swapIndex];
    bag[swapIndex] = current;
  }

  return bag;
}

function ensureBossBag(atTime, eligible) {
  const director = state.bossDirector;
  const signature = buildBossBagSignature(eligible);
  const filteredBag = director.bag.filter((type) => eligible.includes(type));

  if (signature !== director.bagSignature || filteredBag.length === 0) {
    director.bag = buildWeightedBossBag(eligible, atTime);
    director.bagSignature = signature;
    return;
  }

  director.bag = filteredBag;
}

function pickRandomBossType(atTime = state.elapsed) {
  const eligible = getEligibleBossTypes(atTime);

  if (eligible.length === 0) {
    return null;
  }

  ensureBossBag(atTime, eligible);

  const director = state.bossDirector;
  let bagIndex = 0;
  if (eligible.length > 1 && state.lastBossType) {
    const nonRepeatIndex = director.bag.findIndex((type) => type !== state.lastBossType);
    if (nonRepeatIndex >= 0) {
      bagIndex = nonRepeatIndex;
    }
  }

  const [pickedType] = director.bag.splice(bagIndex, 1);
  return pickedType ?? eligible[0] ?? null;
}

function scheduleNextBossEncounter(baseTime = state.elapsed) {
  const eligible = getEligibleBossTypes(baseTime);
  if (eligible.length === 0) {
    state.bossDirector.nextTime = Number.POSITIVE_INFINITY;
    return;
  }
  const director = state.bossDirector;
  director.bag = director.bag.filter((type) => eligible.includes(type));
  if (buildBossBagSignature(eligible) !== director.bagSignature) {
    director.bag = [];
    director.bagSignature = "";
  }
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
  trackArchiveEvent("boss_spawned", { bossType: enemyType });
  spawnBossIntroEffect(boss);
  startBossIntroCinematic(boss);
  window.sfx?.play("bossSpawn");
  return boss;
}

function startBossIntroCinematic(boss) {
  if (!boss || boss.dead || state.runEnd.active || state.levelUp.active || state.bossReward.active) {
    return;
  }
  const intro = state.bossIntro;
  intro.active = true;
  intro.timer = 0;
  intro.targetEnemyId = boss.id;
  intro.targetBossName = boss.bossName ?? boss.name ?? "Boss";
}

function updateBossIntroCinematic(dt) {
  const intro = state.bossIntro;
  if (!intro.active) {
    return;
  }
  intro.timer += dt;
  const boss = state.enemies.find((enemy) => !enemy.dead && enemy.id === intro.targetEnemyId && enemy.isBoss);
  if (!boss || intro.timer >= intro.duration) {
    intro.active = false;
    intro.timer = 0;
    intro.targetEnemyId = null;
    intro.targetBossName = "";
  }
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
  if (state.enemyGrid) {
    return (state.enemyGrid.bossCount ?? 0) > 0;
  }
  return state.enemies.some((enemy) => !enemy.dead && enemy.isBoss);
}

function createEnemy(enemyType, anchor, index, totalCount, options = {}) {
  const profile = ENEMY_ARCHETYPES[enemyType];

  let x = anchor.x;
  let y = anchor.y;

  if (totalCount > 1) {
    const angle = (index / totalCount) * Math.PI * 2 + randRange(-0.35, 0.35);
    const spread = randRange(options.spawnDistanceMin ?? 16, options.spawnDistanceMax ?? 56);
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
    freezeResist: 0,
    freezeResistTimer: 0,
    brittleTimer: 0,
    burnStacks: 0,
    burnStackTimer: 0,
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
    noSeparationTimer: 0,
    airborne: false,
    visualHeight: 0,
    dead: false,
    aiVx: 0,
    aiVy: 0,
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

    const sf = enemy.statusFlash;
    if (sf.wind > 0) sf.wind = Math.max(0, sf.wind - dt);
    if (sf.burn > 0) sf.burn = Math.max(0, sf.burn - dt);
    if (sf.chill > 0) sf.chill = Math.max(0, sf.chill - dt);
    if (sf.freeze > 0) sf.freeze = Math.max(0, sf.freeze - dt);
    if (sf.necro > 0) sf.necro = Math.max(0, sf.necro - dt);
    if (sf.blood > 0) sf.blood = Math.max(0, sf.blood - dt);
    enemy.freezeTimer = Math.max(0, enemy.freezeTimer - dt);
    enemy.freezeResistTimer = Math.max(0, enemy.freezeResistTimer - dt);
    enemy.brittleTimer = Math.max(0, enemy.brittleTimer - dt);
    enemy.necroMarkTimer = Math.max(0, enemy.necroMarkTimer - dt);
    enemy.bloodMarkTimer = Math.max(0, enemy.bloodMarkTimer - dt);
    enemy.hasteTimer = Math.max(0, enemy.hasteTimer - dt);
    enemy.noSeparationTimer = Math.max(0, (enemy.noSeparationTimer ?? 0) - dt);
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

    if (enemy.burnStacks > 0) {
      enemy.burnStackTimer -= dt;
      enemy.burnTickTimer -= dt;
      if (enemy.burnTickTimer <= 0) {
        enemy.burnTickTimer += 0.34;
        const stackScale = enemy.isBoss ? 0.78 : 1;
        const burnDamage = enemy.burnStacks * 9.4 * stackScale;
        dealDamageToEnemy(enemy, burnDamage * dt * 3, "burn");
      }
      if (enemy.burnStackTimer <= 0) {
        enemy.burnStacks = Math.max(0, enemy.burnStacks - 1);
        enemy.burnStackTimer = enemy.burnStacks > 0 ? (enemy.isBoss ? 0.44 : 0.58) : 0;
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
      const edx = enemy.x - player.x;
      const edy = enemy.y - player.y;
      const farFromPlayer = edx * edx + edy * edy > 490000; // 700px
      const skipAI = farFromPlayer && !enemy.isBoss && (state.tick + enemy.id) % 2 !== 0;

      if (skipAI) {
        moveCircleEntity(enemy, enemy.aiVx * dt, enemy.aiVy * dt, enemy.radius, getEntityCollisionOptions(enemy));
      } else {
        const phaseBefore = enemy.phase;
        const prevX = enemy.x;
        const prevY = enemy.y;
        updateEnemyBehavior(enemy, dt, moveMultiplier, player);
        if (enemy.isBoss && phaseBefore !== enemy.phase) {
          window.sfx?.play("bossPhase");
        }
        const dtSafe = Math.max(dt, 0.0001);
        enemy.aiVx = (enemy.x - prevX) / dtSafe;
        enemy.aiVy = (enemy.y - prevY) / dtSafe;
      }
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
  applyEnemySeparation(state.enemyGrid, separationIntensity, player);
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
  const countessProjectileColor = HOSTILE_ARCANE_COLOR;
  if (!enemy.phaseTriggered && enemy.hp <= enemy.maxHp * 0.58) {
    enemy.phaseTriggered = true;
    enemy.phase = 2;
    enemy.state = "phase-shift";
    enemy.stateTimer = 0.46;
    enemy.attackCooldown = Math.max(enemy.attackCooldown, 0.8);
    enemy.secondaryTriggered = false;
    enemy.knockbackVX = 0;
    enemy.knockbackVY = 0;
    enemy.pathTargetX = null;
    enemy.pathTargetY = null;
    enemy.pathTimer = 0;
    spawnBossPhaseEffect(enemy.x, enemy.y, "rgba(255, 109, 142, {a})");
  }

  if (enemy.state === "phase-shift") {
    holdEnemyBand(enemy, player, 240, 360, enemy.speed * 0.8 * moveMultiplier, dt);
    if (enemy.stateTimer <= 0) {
      enemy.state = "recover";
      enemy.stateTimer = 0.24;
      enemy.attackCooldown = Math.max(enemy.attackCooldown, 0.75);
    }
    return;
  }

  if (enemy.state === "strafe-shot") {
    holdEnemyBand(enemy, player, 250, 390, enemy.speed * 0.9 * moveMultiplier, dt);
    if (enemy.stateTimer <= 0) {
      spawnBossFan(
        enemy,
        player,
        enemy.phase === 1 ? 5 : 6,
        enemy.phase === 1 ? 0.48 : 0.62,
        enemy.phase === 1 ? 330 : 370,
        enemy.phase === 1 ? 14 : 18,
        countessProjectileColor
      );
      enemy.state = "recover";
      enemy.stateTimer = 0.22;
      enemy.attackCooldown = enemy.phase === 1 ? 1.45 : 1.05;
    }
    return;
  }

  if (enemy.state === "charge-windup") {
    holdEnemyBand(enemy, player, 230, 360, enemy.speed * 0.72 * moveMultiplier, dt);
    if (enemy.stateTimer <= 0) {
      const dx = player.x - enemy.x;
      const dy = player.y - enemy.y;
      const length = Math.hypot(dx, dy) || 1;
      enemy.memoryX = dx / length;
      enemy.memoryY = dy / length;
      enemy.secondaryTriggered = false;
      enemy.state = "charge";
      enemy.stateTimer = enemy.phase === 1 ? 0.3 : 0.36;
    }
    return;
  }

  if (enemy.state === "charge") {
    moveEnemyVector(enemy, enemy.memoryX, enemy.memoryY, enemy.speed * (enemy.phase === 1 ? 6.6 : 7.2) * moveMultiplier, dt);
    if (enemy.stateTimer < (enemy.phase === 1 ? 0.16 : 0.22) && !enemy.secondaryTriggered) {
      enemy.secondaryTriggered = true;
      spawnBossFan(
        enemy,
        player,
        enemy.phase === 1 ? 4 : 5,
        enemy.phase === 1 ? 0.34 : 0.46,
        enemy.phase === 1 ? 320 : 360,
        enemy.phase === 1 ? 12 : 16,
        countessProjectileColor
      );
    }
    if (enemy.stateTimer <= 0) {
      enemy.memoryBurstsLeft = Math.max(0, (enemy.memoryBurstsLeft ?? 1) - 1);
      if ((enemy.memoryBurstsLeft ?? 0) > 0) {
        enemy.state = "charge-windup";
        enemy.stateTimer = enemy.phase === 1 ? 0.48 : 0.46;
        spawnLineEffect(enemy.x, enemy.y, player.x, player.y, enemy.stateTimer, countessProjectileColor, 10);
        spawnChannelEffect(enemy.x, enemy.y, countessProjectileColor, 28, enemy.stateTimer);
      } else {
        enemy.state = "recover";
        enemy.stateTimer = 0.26;
        enemy.attackCooldown = enemy.phase === 1 ? 1.4 : 0.95;
      }
    }
    return;
  }

  if (enemy.state === "recover") {
    holdEnemyBand(enemy, player, 250, 390, enemy.speed * 0.95 * moveMultiplier, dt);
    if (enemy.stateTimer <= 0) {
      enemy.state = "idle";
    }
    return;
  }

  holdEnemyBand(enemy, player, 250, 390, enemy.speed * 0.82 * moveMultiplier, dt);
  if (enemy.attackCooldown > 0) {
    return;
  }

  const pattern = enemy.phase === 1
    ? ["charge", "strafe-shot", "charge", "strafe-shot"]
    : ["charge", "strafe-shot", "charge", "charge", "strafe-shot"];
  const nextIndex = (enemy.patternIndex + 1 + pattern.length) % pattern.length;
  const nextPattern = pattern[nextIndex];
  enemy.patternIndex = nextIndex;

  if (nextPattern === "charge") {
    enemy.memoryBurstsLeft = enemy.phase === 1 ? 1 : 2;
    enemy.state = "charge-windup";
    enemy.stateTimer = enemy.phase === 1 ? 0.52 : 0.5;
    spawnLineEffect(enemy.x, enemy.y, player.x, player.y, enemy.stateTimer, countessProjectileColor, 11);
    spawnChannelEffect(enemy.x, enemy.y, countessProjectileColor, 34, enemy.stateTimer);
  } else {
    enemy.state = "strafe-shot";
    enemy.stateTimer = enemy.phase === 1 ? 0.42 : 0.34;
    spawnChannelEffect(enemy.x, enemy.y, countessProjectileColor, 28, enemy.stateTimer);
  }
}

function updateColossusBoss(enemy, dt, moveMultiplier, player) {
  const maxLandingRadius = enemy.phase === 1 ? 392 : 516;
  if (!enemy.phaseTriggered && enemy.hp <= enemy.maxHp * 0.56) {
    enemy.phaseTriggered = true;
    enemy.phase = 2;
    enemy.state = "phase-shift";
    enemy.stateTimer = 0.5;
    enemy.attackCooldown = Math.max(enemy.attackCooldown, 0.9);
    spawnBossPhaseEffect(enemy.x, enemy.y, "rgba(242, 183, 109, {a})");
  }

  if (enemy.state === "phase-shift") {
    moveEnemyToward(enemy, player.x, player.y, enemy.speed * 0.14 * moveMultiplier, dt);
    if (enemy.stateTimer <= 0) {
      enemy.state = "recover";
      enemy.stateTimer = 0.34;
      enemy.attackCooldown = Math.max(enemy.attackCooldown, 0.9);
    }
    return;
  }

  if (enemy.state === "jump-windup") {
    moveEnemyToward(enemy, player.x, player.y, enemy.speed * 0.16 * moveMultiplier, dt);
    if (enemy.stateTimer <= 0) {
      enemy.airborne = true;
      enemy.visualHeight = 0;
      enemy.jumpStartX = enemy.x;
      enemy.jumpStartY = enemy.y;
      enemy.jumpTotalTime = enemy.phase === 1 ? 1.12 : 1.18;
      enemy.state = "jump-air";
      enemy.stateTimer = enemy.jumpTotalTime;
      enemy.knockbackVX = 0;
      enemy.knockbackVY = 0;
    }
    return;
  }

  if (enemy.state === "jump-air") {
    enemy.airborne = true;
    enemy.knockbackVX = 0;
    enemy.knockbackVY = 0;
    const totalTime = enemy.jumpTotalTime || 0.8;
    const progress = clamp(1 - enemy.stateTimer / totalTime, 0, 1);
    enemy.x = enemy.jumpStartX + (enemy.memoryX - enemy.jumpStartX) * progress;
    enemy.y = enemy.jumpStartY + (enemy.memoryY - enemy.jumpStartY) * progress;
    const riseFall = Math.sin(progress * Math.PI);
    const sculptedHeight = progress < 0.5
      ? Math.pow(riseFall, 0.38)
      : Math.pow(riseFall, 0.26);
    enemy.visualHeight = sculptedHeight * (enemy.phase === 1 ? 144 : 172);
    if (enemy.stateTimer <= 0) {
      enemy.airborne = false;
      enemy.visualHeight = 0;
      enemy.x = enemy.memoryX;
      enemy.y = enemy.memoryY;
      const waves = enemy.phase === 1 ? 2 : 3;
      spawnEnemyBurst(enemy.x, enemy.y, {
        radius: enemy.phase === 1 ? 124 : 148,
        telegraphTime: 0.05,
        damage: enemy.phase === 1 ? 22 : 28,
        color: "rgba(242, 183, 109, {a})",
      });
      for (let i = 0; i < waves; i += 1) {
        spawnShockwave(enemy.x, enemy.y, {
          telegraphTime: 0.14 + i * 0.12,
          radius: enemy.phase === 1 ? 320 + i * 72 : 360 + i * 78,
          speed: enemy.phase === 1 ? 430 : 470,
          thickness: enemy.phase === 1 ? 20 : 24,
          damage: enemy.phase === 1 ? 24 : 30,
          color: "rgba(242, 183, 109, {a})",
        });
      }
      enemy.memoryBurstsLeft = Math.max(0, (enemy.memoryBurstsLeft ?? 1) - 1);
      if ((enemy.memoryBurstsLeft ?? 0) > 0) {
        const aimX = player.x + player.lastMoveX * 90 + randRange(-50, 50);
        const aimY = player.y + player.lastMoveY * 90 + randRange(-50, 50);
        enemy.memoryX = clamp(aimX, WORLD.left + enemy.radius, WORLD.right - enemy.radius);
        enemy.memoryY = clamp(aimY, WORLD.top + enemy.radius, WORLD.bottom - enemy.radius);
        enemy.state = "jump-windup";
        enemy.stateTimer = enemy.phase === 1 ? 0.86 : 1.02;
        spawnLineEffect(enemy.x, enemy.y, enemy.memoryX, enemy.memoryY, enemy.stateTimer, "rgba(242, 183, 109, {a})", 10);
        spawnEnemyBurst(enemy.memoryX, enemy.memoryY, {
          radius: maxLandingRadius,
          telegraphTime: enemy.stateTimer,
          damage: 0,
          color: "rgba(242, 183, 109, {a})",
        });
      } else {
        enemy.state = "recover";
        enemy.stateTimer = enemy.phase === 1 ? 0.54 : 0.64;
        enemy.attackCooldown = enemy.phase === 1 ? 2.65 : 3.1;
      }
    }
    return;
  }

  if (enemy.state === "ground-slam") {
    moveEnemyToward(enemy, player.x, player.y, enemy.speed * 0.18 * moveMultiplier, dt);
    if (enemy.stateTimer <= 0) {
      const waveCount = enemy.phase === 1 ? 2 : 3;
      for (let i = 0; i < waveCount; i += 1) {
        spawnShockwave(enemy.x, enemy.y, {
          telegraphTime: 0.08 + i * 0.14,
          radius: enemy.phase === 1 ? 260 + i * 86 : 300 + i * 92,
          speed: enemy.phase === 1 ? 440 : 480,
          thickness: enemy.phase === 1 ? 18 : 22,
          damage: enemy.phase === 1 ? 20 : 26,
          color: "rgba(242, 183, 109, {a})",
        });
      }
      enemy.state = "recover";
      enemy.stateTimer = 0.34;
      enemy.attackCooldown = enemy.phase === 1 ? 2.05 : 1.9;
    }
    return;
  }

  if (enemy.state === "recover") {
    moveEnemyToward(enemy, player.x, player.y, enemy.speed * 0.26 * moveMultiplier, dt);
    if (enemy.stateTimer <= 0) {
      enemy.state = "idle";
    }
    return;
  }

  moveEnemyToward(enemy, player.x, player.y, enemy.speed * 0.34 * moveMultiplier, dt);
  if (enemy.attackCooldown > 0) {
    return;
  }

  const pattern = enemy.phase === 1 ? ["jump", "ground-slam", "jump"] : ["jump", "ground-slam", "jump"];
  const nextIndex = (enemy.patternIndex + 1 + pattern.length) % pattern.length;
  const nextPattern = pattern[nextIndex];
  enemy.patternIndex = nextIndex;

  if (nextPattern === "jump") {
    const aimX = player.x + player.lastMoveX * 90 + randRange(-70, 70);
    const aimY = player.y + player.lastMoveY * 90 + randRange(-70, 70);
    enemy.memoryX = clamp(aimX, WORLD.left + enemy.radius, WORLD.right - enemy.radius);
    enemy.memoryY = clamp(aimY, WORLD.top + enemy.radius, WORLD.bottom - enemy.radius);
    enemy.memoryBurstsLeft = enemy.phase === 1 ? 1 : 2;
    enemy.state = "jump-windup";
    enemy.stateTimer = enemy.phase === 1 ? 1.02 : 1.16;
    spawnLineEffect(enemy.x, enemy.y, enemy.memoryX, enemy.memoryY, enemy.stateTimer, "rgba(242, 183, 109, {a})", 11);
    spawnEnemyBurst(enemy.memoryX, enemy.memoryY, {
      radius: maxLandingRadius,
      telegraphTime: enemy.stateTimer,
      damage: 0,
      color: "rgba(242, 183, 109, {a})",
    });
    spawnChannelEffect(enemy.x, enemy.y, "rgba(242, 183, 109, {a})", 54, enemy.stateTimer);
  } else {
    enemy.state = "ground-slam";
    enemy.stateTimer = enemy.phase === 1 ? 0.7 : 0.58;
    spawnChannelEffect(enemy.x, enemy.y, "rgba(242, 183, 109, {a})", 48, enemy.stateTimer);
  }
}

function updateAbyssBoss(enemy, dt, moveMultiplier, player) {
  const abyssProjectileColor = "rgba(173, 116, 255, {a})";
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
        color: abyssProjectileColor,
      });
      if (enemy.phase === 2) {
        spawnBeamAttack(enemy.x, enemy.y, player.x, player.y, {
          telegraphTime: 0.76,
          activeTime: 0.4,
          width: 52,
          damage: 30,
          color: abyssProjectileColor,
        });
        spawnEnemyBurst(player.x, player.y, {
          radius: 88,
          telegraphTime: 0.82,
          damage: 22,
          color: abyssProjectileColor,
        });
      }
      enemy.state = "recover";
      enemy.stateTimer = 0.36;
      enemy.attackCooldown = enemy.phase === 1 ? 1.7 : 1.42;
    }
    return;
  }

  if (enemy.state === "zones") {
    holdEnemyBand(enemy, player, 450, 650, enemy.speed * 0.3 * moveMultiplier, dt);
    if (enemy.stateTimer <= 0) {
      const forwardX = player.lastMoveX || Math.cos(state.elapsed * 0.7);
      const forwardY = player.lastMoveY || Math.sin(state.elapsed * 0.7);
      const forwardLength = Math.hypot(forwardX, forwardY) || 1;
      const sideX = -forwardY / forwardLength;
      const sideY = forwardX / forwardLength;
      const anchors = [
        { x: player.x + (forwardX / forwardLength) * 86, y: player.y + (forwardY / forwardLength) * 86, radius: 82, delay: 0.6 },
        { x: player.x + sideX * 124, y: player.y + sideY * 124, radius: 74, delay: 0.7 },
        { x: player.x - sideX * 124, y: player.y - sideY * 124, radius: 74, delay: 0.7 },
      ];
      if (enemy.phase === 2) {
        anchors.push(
          { x: player.x - (forwardX / forwardLength) * 118, y: player.y - (forwardY / forwardLength) * 118, radius: 88, delay: 0.82 },
          { x: player.x + sideX * 210, y: player.y + sideY * 210, radius: 68, delay: 0.9 }
        );
      }
      for (const anchor of anchors) {
        spawnEnemyBurst(anchor.x, anchor.y, {
          radius: anchor.radius,
          telegraphTime: anchor.delay,
          damage: enemy.phase === 1 ? 18 : 23,
          color: abyssProjectileColor,
        });
      }
      enemy.state = "recover";
      enemy.stateTimer = 0.32;
      enemy.attackCooldown = enemy.phase === 1 ? 1.55 : 1.35;
    }
    return;
  }

  if (enemy.state === "ring") {
    holdEnemyBand(enemy, player, 450, 650, enemy.speed * 0.28 * moveMultiplier, dt);
    if (enemy.stateTimer <= 0) {
      const primaryCount = enemy.phase === 1 ? 22 : 24;
      spawnBossRadial(enemy, primaryCount, enemy.phase === 1 ? 305 : 330, enemy.phase === 1 ? 16 : 19, abyssProjectileColor);
      if (enemy.phase === 2) {
        const secondaryCount = 12;
        const offset = Math.PI / secondaryCount;
        for (let i = 0; i < secondaryCount; i += 1) {
          const angle = (i / secondaryCount) * Math.PI * 2 + offset;
          state.enemyAttacks.push({
            kind: "projectile",
            x: enemy.x,
            y: enemy.y,
            vx: Math.cos(angle) * 390,
            vy: Math.sin(angle) * 390,
            radius: 7.5,
            damage: 17,
            color: abyssProjectileColor,
            life: 3.6,
            dead: false,
          });
        }
        spawnEnemyBurst(player.x, player.y, {
          radius: 72,
          telegraphTime: 0.7,
          damage: 18,
          color: abyssProjectileColor,
        });
      } else {
        spawnEnemyBurst(player.x, player.y, {
          radius: 62,
          telegraphTime: 0.64,
          damage: 16,
          color: abyssProjectileColor,
        });
      }
      enemy.state = "recover";
      enemy.stateTimer = 0.3;
      enemy.attackCooldown = enemy.phase === 1 ? 1.45 : 1.22;
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

  const pattern = enemy.phase === 1 ? ["ring", "beam", "zones", "ring", "beam"] : ["beam", "zones", "ring", "beam", "zones"];
  const nextIndex = (enemy.patternIndex + 1 + pattern.length) % pattern.length;
  const nextPattern = pattern[nextIndex];
  enemy.patternIndex = nextIndex;

  if (nextPattern === "beam") {
    enemy.state = "beam";
    enemy.stateTimer = enemy.phase === 1 ? 0.62 : 0.56;
    enemy.memoryX = player.x;
    enemy.memoryY = player.y;
    spawnLineEffect(enemy.x, enemy.y, player.x, player.y, enemy.stateTimer, abyssProjectileColor, enemy.phase === 1 ? 12 : 16);
    spawnChannelEffect(enemy.x, enemy.y, abyssProjectileColor, 40, enemy.stateTimer);
  } else if (nextPattern === "ring") {
    enemy.state = "ring";
    enemy.stateTimer = enemy.phase === 1 ? 0.58 : 0.5;
    spawnChannelEffect(enemy.x, enemy.y, abyssProjectileColor, 40, enemy.stateTimer);
  } else {
    enemy.state = "zones";
    enemy.stateTimer = enemy.phase === 1 ? 0.62 : 0.56;
    spawnChannelEffect(enemy.x, enemy.y, abyssProjectileColor, 46, enemy.stateTimer);
  }
}

function updateMatriarchBoss(enemy, dt, moveMultiplier, player) {
  enemy.summonAnchorTimer = Math.max(0, (enemy.summonAnchorTimer ?? 0) - dt);
  if (!enemy.phaseTriggered && enemy.hp <= enemy.maxHp * 0.6) {
    enemy.phaseTriggered = true;
    enemy.phase = 2;
    spawnBossPhaseEffect(enemy.x, enemy.y, "rgba(204, 122, 255, {a})");
  }

  if (enemy.state === "venom-burst") {
    moveEnemyToward(enemy, player.x, player.y, enemy.speed * 0.1 * moveMultiplier, dt);
    if (enemy.stateTimer <= 0) {
      const count = enemy.phase === 1 ? 4 : 6;
      for (let i = 0; i < count; i += 1) {
        const angle = (i / count) * Math.PI * 2 + randRange(-0.35, 0.35);
        const distance = randRange(64, enemy.phase === 1 ? 180 : 220);
        spawnEnemyBurst(player.x + Math.cos(angle) * distance, player.y + Math.sin(angle) * distance, {
          radius: 74,
          telegraphTime: 0.64 + i * 0.05,
          damage: enemy.phase === 1 ? 16 : 21,
          color: "rgba(204, 122, 255, {a})",
        });
      }
      enemy.state = "recover";
      enemy.stateTimer = 0.36;
      enemy.attackCooldown = enemy.phase === 1 ? 1.7 : 1.2;
    }
    return;
  }

  if (enemy.state === "brood-call") {
    enemy.summonAnchorX ??= enemy.x;
    enemy.summonAnchorY ??= enemy.y;
    enemy.x = enemy.summonAnchorX;
    enemy.y = enemy.summonAnchorY;
    enemy.knockbackVX = 0;
    enemy.knockbackVY = 0;
    enemy.pathTargetX = null;
    enemy.pathTargetY = null;
    enemy.pathTimer = 0;
    if (enemy.stateTimer <= 0) {
      spawnBossMinions(
        enemy,
        enemy.phase === 1
          ? ["brood", "brood", "brood", "runner", "runner", "runner"]
          : ["brood", "brood", "brood", "brood", "runner", "runner", "runner", "runner"],
        {
          minDistance: enemy.radius + 26,
          maxDistance: enemy.radius + 86,
          noSeparationTimer: 0.32,
        }
      );
      enemy.x = enemy.summonAnchorX;
      enemy.y = enemy.summonAnchorY;
      enemy.noSeparationTimer = 0.32;
      enemy.summonAnchorTimer = 0.24;
      spawnEnemyBurst(enemy.x, enemy.y, {
        radius: enemy.phase === 1 ? 102 : 126,
        telegraphTime: enemy.phase === 1 ? 0.26 : 0.22,
        damage: enemy.phase === 1 ? 17 : 23,
        color: "rgba(204, 122, 255, {a})",
      });
      enemy.state = "recover";
      enemy.stateTimer = 0.38;
      enemy.attackCooldown = enemy.phase === 1 ? 1.8 : 1.25;
    }
    return;
  }

  if (enemy.state === "egg-clutch") {
    enemy.summonAnchorX ??= enemy.x;
    enemy.summonAnchorY ??= enemy.y;
    enemy.x = enemy.summonAnchorX;
    enemy.y = enemy.summonAnchorY;
    enemy.knockbackVX = 0;
    enemy.knockbackVY = 0;
    enemy.pathTargetX = null;
    enemy.pathTargetY = null;
    enemy.pathTimer = 0;
    if (enemy.stateTimer <= 0) {
      const clutchPoints = enemy.phase === 1 ? 3 : 5;
      for (let i = 0; i < clutchPoints; i += 1) {
        const angle = (i / clutchPoints) * Math.PI * 2 + randRange(-0.18, 0.18);
        const distance = enemy.phase === 1 ? 120 : 155;
        const hatchX = enemy.x + Math.cos(angle) * distance;
        const hatchY = enemy.y + Math.sin(angle) * distance;
        spawnEnemyBurst(hatchX, hatchY, {
          radius: 64,
          telegraphTime: 0.48 + i * 0.04,
          damage: enemy.phase === 1 ? 14 : 18,
          color: "rgba(204, 122, 255, {a})",
        });
      }
      spawnBossMinions(
        enemy,
        enemy.phase === 1 ? ["brood", "brood", "runner"] : ["brood", "brood", "brood", "runner", "runner"],
        {
          minDistance: enemy.radius + 32,
          maxDistance: enemy.radius + 92,
          noSeparationTimer: 0.32,
        }
      );
      enemy.x = enemy.summonAnchorX;
      enemy.y = enemy.summonAnchorY;
      enemy.noSeparationTimer = 0.32;
      enemy.summonAnchorTimer = 0.24;
      enemy.state = "recover";
      enemy.stateTimer = 0.38;
      enemy.attackCooldown = enemy.phase === 1 ? 1.75 : 1.2;
    }
    return;
  }

  if (enemy.state === "recover") {
    if ((enemy.summonAnchorTimer ?? 0) > 0) {
      enemy.x = enemy.summonAnchorX ?? enemy.x;
      enemy.y = enemy.summonAnchorY ?? enemy.y;
      enemy.knockbackVX = 0;
      enemy.knockbackVY = 0;
      enemy.pathTargetX = null;
      enemy.pathTargetY = null;
      enemy.pathTimer = 0;
      if (enemy.stateTimer <= 0) {
        enemy.state = "idle";
      }
      return;
    }
    enemy.summonAnchorX = null;
    enemy.summonAnchorY = null;
    moveEnemyToward(enemy, player.x, player.y, enemy.speed * 0.3 * moveMultiplier, dt);
    if (enemy.stateTimer <= 0) {
      enemy.state = "idle";
    }
    return;
  }

  moveEnemyToward(enemy, player.x, player.y, enemy.speed * 0.52 * moveMultiplier, dt);
  if (enemy.attackCooldown > 0) {
    return;
  }

  const pattern = enemy.phase === 1
    ? ["brood-call", "venom-burst", "egg-clutch", "brood-call", "venom-burst"]
    : ["brood-call", "egg-clutch", "brood-call", "venom-burst", "egg-clutch"];
  const nextIndex = (enemy.patternIndex + 1 + pattern.length) % pattern.length;
  const nextPattern = pattern[nextIndex];
  enemy.patternIndex = nextIndex;

  if (nextPattern === "venom-burst") {
    enemy.summonAnchorX = null;
    enemy.summonAnchorY = null;
    enemy.state = "venom-burst";
    enemy.stateTimer = enemy.phase === 1 ? 0.66 : 0.54;
    spawnChannelEffect(enemy.x, enemy.y, "rgba(204, 122, 255, {a})", 48, enemy.stateTimer);
  } else if (nextPattern === "egg-clutch") {
    enemy.summonAnchorX = enemy.x;
    enemy.summonAnchorY = enemy.y;
    enemy.state = "egg-clutch";
    enemy.stateTimer = enemy.phase === 1 ? 0.74 : 0.62;
    spawnChannelEffect(enemy.x, enemy.y, "rgba(204, 122, 255, {a})", 54, enemy.stateTimer);
  } else {
    enemy.summonAnchorX = enemy.x;
    enemy.summonAnchorY = enemy.y;
    enemy.state = "brood-call";
    enemy.stateTimer = enemy.phase === 1 ? 0.82 : 0.66;
    spawnChannelEffect(enemy.x, enemy.y, "rgba(204, 122, 255, {a})", 52, enemy.stateTimer);
  }
}

function blinkBossToBand(enemy, player, innerRadius, outerRadius) {
  const moveLength = Math.hypot(player.lastMoveX, player.lastMoveY);
  const baseAngle = moveLength > 0.15
    ? Math.atan2(player.lastMoveY, player.lastMoveX) + Math.PI
    : Math.atan2(enemy.y - player.y, enemy.x - player.x);
  const angle = baseAngle + randRange(-0.32, 0.32);
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
    holdEnemyBand(enemy, player, 300, 470, enemy.speed * 0.62 * moveMultiplier, dt);
    if (enemy.stateTimer <= 0) {
      const baseAngle = Math.atan2(player.y - enemy.y, player.x - enemy.x);
      const angles = enemy.phase === 1
        ? [baseAngle, baseAngle + Math.PI / 2]
        : [baseAngle, baseAngle + Math.PI / 3, baseAngle + (Math.PI * 2) / 3];
      spawnBossLattice(player.x, player.y, enemy.phase === 1 ? 520 : 620, {
        telegraphTime: enemy.phase === 1 ? 0.46 : 0.4,
        activeTime: enemy.phase === 1 ? 0.32 : 0.38,
        width: enemy.phase === 1 ? 34 : 42,
        damage: enemy.phase === 1 ? 24 : 30,
      }, angles);
      enemy.state = "recover";
      enemy.stateTimer = 0.24;
      enemy.attackCooldown = enemy.phase === 1 ? 1.7 : 1.18;
    }
    return;
  }

  if (enemy.state === "blink") {
    holdEnemyBand(enemy, player, 320, 480, enemy.speed * 0.74 * moveMultiplier, dt);
    if (enemy.stateTimer <= 0) {
      blinkBossToBand(enemy, player, 300, 420);
      enemy.memoryBurstsLeft = enemy.phase === 1 ? 2 : 3;
      enemy.memoryAimX = player.x;
      enemy.memoryAimY = player.y;
      enemy.state = "barrage-windup";
      enemy.stateTimer = enemy.phase === 1 ? 0.24 : 0.2;
      spawnLineEffect(enemy.x, enemy.y, enemy.memoryAimX, enemy.memoryAimY, enemy.stateTimer, HOSTILE_ARCANE_COLOR, enemy.phase === 1 ? 8 : 10);
      spawnChannelEffect(enemy.x, enemy.y, HOSTILE_ARCANE_COLOR, 30, enemy.stateTimer);
      enemy.attackCooldown = 0;
    }
    return;
  }

  if (enemy.state === "barrage-windup") {
    holdEnemyBand(enemy, player, 300, 460, enemy.speed * 0.38 * moveMultiplier, dt);
    if (enemy.stateTimer <= 0) {
      enemy.state = "barrage";
      enemy.stateTimer = 0.1;
    }
    return;
  }

  if (enemy.state === "barrage") {
    holdEnemyBand(enemy, player, 300, 460, enemy.speed * 0.46 * moveMultiplier, dt);
    if (enemy.stateTimer <= 0) {
      const burstIndex = (enemy.phase === 1 ? 2 : 3) - enemy.memoryBurstsLeft;
      spawnBossFan(
        enemy,
        { x: enemy.memoryAimX ?? player.x, y: enemy.memoryAimY ?? player.y },
        enemy.phase === 1 ? 8 : 10,
        (enemy.phase === 1 ? 0.62 : 0.8) + burstIndex * 0.08,
        enemy.phase === 1 ? 390 : 430,
        enemy.phase === 1 ? 19 : 24,
        HOSTILE_ARCANE_COLOR
      );
      enemy.memoryBurstsLeft -= 1;
      if (enemy.memoryBurstsLeft > 0) {
        enemy.stateTimer = enemy.phase === 1 ? 0.18 : 0.16;
      } else {
        enemy.state = "recover";
        enemy.stateTimer = 0.22;
        enemy.attackCooldown = enemy.phase === 1 ? 1.5 : 1.02;
      }
    }
    return;
  }

  if (enemy.state === "ring") {
    holdEnemyBand(enemy, player, 300, 460, enemy.speed * 0.56 * moveMultiplier, dt);
    if (enemy.stateTimer <= 0) {
      spawnBossRadial(enemy, enemy.phase === 1 ? 18 : 26, enemy.phase === 1 ? 320 : 390, enemy.phase === 1 ? 16 : 22, HOSTILE_ARCANE_COLOR);
      enemy.state = "recover";
      enemy.stateTimer = 0.24;
      enemy.attackCooldown = enemy.phase === 1 ? 1.62 : 1.08;
    }
    return;
  }

  if (enemy.state === "recover") {
    holdEnemyBand(enemy, player, 320, 500, enemy.speed * 0.74 * moveMultiplier, dt);
    if (enemy.stateTimer <= 0) {
      enemy.state = "idle";
    }
    return;
  }

  holdEnemyBand(enemy, player, 320, 500, enemy.speed * 1.16 * moveMultiplier, dt);
  if (enemy.attackCooldown > 0) {
    return;
  }

  const pattern = enemy.phase === 1
    ? ["blink", "lattice", "ring", "blink"]
    : ["blink", "lattice", "ring", "blink", "lattice"];
  const nextIndex = (enemy.patternIndex + 1 + pattern.length) % pattern.length;
  const nextPattern = pattern[nextIndex];
  enemy.patternIndex = nextIndex;

  if (nextPattern === "lattice") {
    enemy.state = "lattice";
    enemy.stateTimer = enemy.phase === 1 ? 0.58 : 0.46;
    spawnChannelEffect(enemy.x, enemy.y, HOSTILE_ARCANE_COLOR, 46, enemy.stateTimer);
  } else if (nextPattern === "blink") {
    enemy.state = "blink";
    enemy.stateTimer = enemy.phase === 1 ? 0.42 : 0.32;
    spawnChannelEffect(enemy.x, enemy.y, HOSTILE_ARCANE_COLOR, 36, enemy.stateTimer);
  } else {
    enemy.state = "ring";
    enemy.stateTimer = enemy.phase === 1 ? 0.54 : 0.42;
    spawnChannelEffect(enemy.x, enemy.y, HOSTILE_ARCANE_COLOR, 40, enemy.stateTimer);
  }
}

function updateRegentBoss(enemy, dt, moveMultiplier, player) {
  const regentProjectileColor = "rgba(173, 116, 255, {a})";
  if (!enemy.phaseTriggered && enemy.hp <= enemy.maxHp * 0.56) {
    enemy.phaseTriggered = true;
    enemy.phase = 2;
    spawnBossPhaseEffect(enemy.x, enemy.y, "rgba(255, 194, 112, {a})");
  }

  if (enemy.state === "spiral") {
    holdEnemyBand(enemy, player, 500, 720, enemy.speed * 0.14 * moveMultiplier, dt);
    enemy.memoryShotTimer = (enemy.memoryShotTimer ?? 0) - dt;
    while ((enemy.memoryShotsLeft ?? 0) > 0 && enemy.memoryShotTimer <= 0) {
      const armCount = enemy.phase === 1 ? 5 : 7;
      for (let i = 0; i < armCount; i += 1) {
        const angle = (enemy.memoryAngle ?? 0) + (i / armCount) * Math.PI * 2;
        state.enemyAttacks.push({
          kind: "projectile",
          x: enemy.x,
          y: enemy.y,
          vx: Math.cos(angle) * (enemy.phase === 1 ? 305 : 380),
          vy: Math.sin(angle) * (enemy.phase === 1 ? 305 : 380),
          radius: enemy.phase === 1 ? 7 : 7.5,
          damage: enemy.phase === 1 ? 16 : 21,
          color: regentProjectileColor,
          life: 4.2,
          dead: false,
        });
      }
      enemy.memoryAngle = (enemy.memoryAngle ?? 0) + (enemy.phase === 1 ? 0.42 : 0.34);
      enemy.memoryShotsLeft -= 1;
      enemy.memoryShotTimer += enemy.phase === 1 ? 0.085 : 0.055;
    }
    if ((enemy.memoryShotsLeft ?? 0) <= 0 || enemy.stateTimer <= 0) {
      enemy.state = "recover";
      enemy.stateTimer = 0.32;
      enemy.attackCooldown = enemy.phase === 1 ? 1.6 : 1.28;
    }
    return;
  }

  if (enemy.state === "orbital") {
    holdEnemyBand(enemy, player, 520, 730, enemy.speed * 0.16 * moveMultiplier, dt);
    if (enemy.stateTimer <= 0) {
      const count = enemy.phase === 1 ? 20 : 28;
      for (let i = 0; i < count; i += 1) {
        const angle = (i / count) * Math.PI * 2 + state.elapsed * 0.42;
        const distance = enemy.phase === 1 ? 190 : 230;
        spawnEnemyBurst(player.x + Math.cos(angle) * distance, player.y + Math.sin(angle) * distance, {
          radius: enemy.phase === 1 ? 72 : 76,
          telegraphTime: 0.66 + (i % 2) * 0.07,
          damage: enemy.phase === 1 ? 17 : 23,
          color: regentProjectileColor,
        });
      }
      enemy.state = "recover";
      enemy.stateTimer = 0.34;
      enemy.attackCooldown = enemy.phase === 1 ? 1.65 : 1.32;
    }
    return;
  }

  if (enemy.state === "crown") {
    holdEnemyBand(enemy, player, 500, 720, enemy.speed * 0.18 * moveMultiplier, dt);
    if (enemy.stateTimer <= 0) {
      const outerCount = enemy.phase === 1 ? 34 : 46;
      const innerCount = enemy.phase === 1 ? 20 : 28;
      const baseAngle = state.elapsed * 0.65;
      for (let i = 0; i < outerCount; i += 1) {
        const angle = baseAngle + (i / outerCount) * Math.PI * 2;
        state.enemyAttacks.push({
          kind: "projectile",
          x: enemy.x,
          y: enemy.y,
          vx: Math.cos(angle) * (enemy.phase === 1 ? 285 : 350),
          vy: Math.sin(angle) * (enemy.phase === 1 ? 285 : 350),
          radius: 7.5,
          damage: enemy.phase === 1 ? 16 : 20,
          color: regentProjectileColor,
          life: 4.6,
          dead: false,
        });
      }
      for (let i = 0; i < innerCount; i += 1) {
        const angle = -baseAngle + (i / innerCount) * Math.PI * 2 + Math.PI / innerCount;
        state.enemyAttacks.push({
          kind: "projectile",
          x: enemy.x,
          y: enemy.y,
          vx: Math.cos(angle) * (enemy.phase === 1 ? 390 : 490),
          vy: Math.sin(angle) * (enemy.phase === 1 ? 390 : 490),
          radius: 6.8,
          damage: enemy.phase === 1 ? 14 : 18,
          color: regentProjectileColor,
          life: 4.2,
          dead: false,
        });
      }
      enemy.state = "recover";
      enemy.stateTimer = 0.38;
      enemy.attackCooldown = enemy.phase === 1 ? 1.72 : 1.42;
    }
    return;
  }

  if (enemy.state === "recover") {
    holdEnemyBand(enemy, player, 520, 730, enemy.speed * 0.2 * moveMultiplier, dt);
    if (enemy.stateTimer <= 0) {
      enemy.state = "idle";
    }
    return;
  }

  holdEnemyBand(enemy, player, 520, 730, enemy.speed * 0.28 * moveMultiplier, dt);
  if (enemy.attackCooldown > 0) {
    return;
  }

  const pattern = enemy.phase === 1
    ? ["spiral", "orbital", "crown", "spiral"]
    : ["orbital", "spiral", "crown", "spiral", "orbital"];
  const nextIndex = (enemy.patternIndex + 1 + pattern.length) % pattern.length;
  const nextPattern = pattern[nextIndex];
  enemy.patternIndex = nextIndex;

  if (nextPattern === "spiral") {
    enemy.state = "spiral";
    enemy.stateTimer = enemy.phase === 1 ? 1.22 : 1.3;
    enemy.memoryShotsLeft = enemy.phase === 1 ? 30 : 44;
    enemy.memoryShotTimer = 0.04;
    enemy.memoryAngle = state.elapsed * 0.85;
    spawnChannelEffect(enemy.x, enemy.y, HOSTILE_ARCANE_COLOR, 48, enemy.stateTimer);
  } else if (nextPattern === "orbital") {
    enemy.state = "orbital";
    enemy.stateTimer = enemy.phase === 1 ? 0.66 : 0.54;
    spawnChannelEffect(enemy.x, enemy.y, HOSTILE_ARCANE_COLOR, 44, enemy.stateTimer);
  } else {
    enemy.state = "crown";
    enemy.stateTimer = enemy.phase === 1 ? 0.72 : 0.58;
    spawnChannelEffect(enemy.x, enemy.y, regentProjectileColor, 50, enemy.stateTimer);
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
  const typeCounts = Object.create(null);
  let bossCount = 0;

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
    typeCounts[enemy.type] = (typeCounts[enemy.type] ?? 0) + 1;
    if (enemy.isBoss) {
      bossCount += 1;
    }
  }

  return { map, cells, typeCounts, bossCount };
}

function visitEnemiesInRange(originX, originY, range, visitor) {
  const grid = state.enemyGrid;
  if (!grid || grid.map.size === 0 || !Number.isFinite(range)) {
    for (const enemy of state.enemies) {
      if (!enemy.dead) {
        visitor(enemy);
      }
    }
    return;
  }

  const minCellX = Math.floor((originX - range) / ENEMY_CELL_SIZE);
  const maxCellX = Math.floor((originX + range) / ENEMY_CELL_SIZE);
  const minCellY = Math.floor((originY - range) / ENEMY_CELL_SIZE);
  const maxCellY = Math.floor((originY + range) / ENEMY_CELL_SIZE);

  for (let cellY = minCellY; cellY <= maxCellY; cellY += 1) {
    for (let cellX = minCellX; cellX <= maxCellX; cellX += 1) {
      const cell = grid.map.get(cellKey(cellX, cellY));
      if (!cell) {
        continue;
      }
      for (const enemy of cell.enemies) {
        if (!enemy.dead) {
          visitor(enemy);
        }
      }
    }
  }
}

function getFrameQueryCache() {
  if (state.queryCache.tick !== state.tick) {
    state.queryCache.tick = state.tick;
    state.queryCache.values.clear();
  }
  return state.queryCache.values;
}

function buildQueryKey(kind, originX, originY, range, extra = "") {
  return [
    kind,
    Math.round(originX),
    Math.round(originY),
    Math.round(range),
    extra,
  ].join(":");
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
    const target = findNearestEnemy(ally.x, ally.y, 360);
    let moveX, moveY;
    if (target) {
      const dx = target.x - ally.x;
      const dy = target.y - ally.y;
      const length = Math.hypot(dx, dy) || 1;
      const drift = 0.18 * Math.sin(state.elapsed * 2.6 + ally.orbitSeed);
      moveX = dx / length + (-dy / length) * drift;
      moveY = dy / length + (dx / length) * drift;
    } else {
      const dx = state.player.x - ally.x;
      const dy = state.player.y - ally.y;
      const dist = Math.hypot(dx, dy);
      if (dist < 30) {
        continue;
      }
      moveX = dx / dist;
      moveY = dy / dist;
    }
    const moveLen = Math.hypot(moveX, moveY) || 1;
    const requiemBonus = getRequiemFieldBonusAt(ally.x, ally.y);
    moveCircleEntity(
      ally,
      (moveX / moveLen) * ally.speed * requiemBonus.speedMultiplier * dt,
      (moveY / moveLen) * ally.speed * requiemBonus.speedMultiplier * dt,
      ally.radius,
      { water: false, solids: false }
    );
  }

  resolveAllySeparation();
}

function resolveAllySeparation() {
  for (let i = 0; i < state.allies.length; i += 1) {
    const allyA = state.allies[i];
    if (!allyA || allyA.dead) {
      continue;
    }
    for (let j = i + 1; j < state.allies.length; j += 1) {
      const allyB = state.allies[j];
      if (!allyB || allyB.dead) {
        continue;
      }
      const dx = allyB.x - allyA.x;
      const dy = allyB.y - allyA.y;
      const distance = Math.hypot(dx, dy) || 0.0001;
      const minDistance = allyA.radius + allyB.radius;
      if (distance >= minDistance) {
        continue;
      }
      const overlap = minDistance - distance;
      const pushX = (dx / distance) * overlap * 0.5;
      const pushY = (dy / distance) * overlap * 0.5;
      allyA.x -= pushX;
      allyA.y -= pushY;
      allyB.x += pushX;
      allyB.y += pushY;
    }
  }
}

function getRequiemFieldBonusAt(x, y) {
  let speedMultiplier = 1;
  let damageMultiplier = 1;
  for (const effect of state.effects) {
    if (effect.life <= 0 || effect.kind !== "requiem-field") {
      continue;
    }
    if (Math.hypot(effect.x - x, effect.y - y) > effect.radius) {
      continue;
    }
    speedMultiplier = Math.max(speedMultiplier, 1.18);
    damageMultiplier = Math.max(damageMultiplier, 1.22);
  }
  return { speedMultiplier, damageMultiplier };
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
          const requiemBonus = getRequiemFieldBonusAt(ally.x, ally.y);
          dealDamageToEnemy(enemy, ally.damage * requiemBonus.damageMultiplier, ally.sourceType === "bone-ward" ? "bone-ward" : "thrall");
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

function applyEnemySeparation(grid, intensity, player) {
  if (intensity <= 0) {
    return;
  }

  const px = player?.x ?? 0;
  const py = player?.y ?? 0;
  const skipFarOddTick = state.tick % 2 !== 0;

  for (const cell of grid.cells) {
    const cellCX = (cell.x + 0.5) * ENEMY_CELL_SIZE;
    const cellCY = (cell.y + 0.5) * ENEMY_CELL_SIZE;
    const cdx = cellCX - px;
    const cdy = cellCY - py;
    if (cdx * cdx + cdy * cdy > 490000 && skipFarOddTick) {
      continue;
    }

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
  if ((a.noSeparationTimer ?? 0) > 0 || (b.noSeparationTimer ?? 0) > 0) {
    return;
  }
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
  const stacksToAdd = Math.max(1, Math.round(strength * potency * (enemy.isBoss ? 0.35 : 0.26)));
  const maxStacks = enemy.isBoss ? 12 : 8;
  enemy.burnStacks = Math.min(maxStacks, enemy.burnStacks + stacksToAdd);
  enemy.burnStackTimer = Math.max(enemy.burnStackTimer, duration * state.player.statusDurationMultiplier);
  enemy.burnTickTimer = Math.min(enemy.burnTickTimer || 0.22, 0.22);
  setEnemyStatusFlash(enemy, "burn", 0.45);
}

function applyEnemyChill(enemy, amount, duration) {
  const potency = 1 + state.player.statusPotency;
  const frostBossControlFloor = state.player.classId === "frost" && enemy.isBoss ? 0.52 : 0;
  const controlMultiplier = Math.max(frostBossControlFloor, 1 - enemy.controlResist);
  const effectiveAmount = amount * potency * controlMultiplier;
  enemy.chillStacks = Math.min(enemy.isBoss ? 5 : 6, enemy.chillStacks + effectiveAmount);
  enemy.chillDecayTimer = Math.max(enemy.chillDecayTimer, duration * state.player.statusDurationMultiplier);
  enemy.slowAmount = Math.max(enemy.slowAmount, 0.15 + enemy.chillStacks * 0.08);
  enemy.slowTimer = Math.max(enemy.slowTimer, 0.5 * state.player.statusDurationMultiplier);
  setEnemyStatusFlash(enemy, "chill", 0.45);

  const freezeThreshold = enemy.isBoss ? 5.5 : 4.0;
  if (enemy.chillStacks >= freezeThreshold) {
    enemy.chillStacks = 0;
    enemy.chillDecayTimer = 0;
    const baseFreezeDuration = enemy.isBoss ? 0.55 : 1.5;
    const resistScale = enemy.isBoss ? Math.max(0.24, 1 - enemy.freezeResist) : 1;
    enemy.freezeTimer = Math.max(enemy.freezeTimer, baseFreezeDuration * (1 - enemy.controlResist) * resistScale);
    if (enemy.isBoss) {
      enemy.freezeResist = Math.min(0.72, enemy.freezeResist + 0.24);
      enemy.freezeResistTimer = 4.6;
    }
    enemy.brittleTimer = Math.max(enemy.brittleTimer, enemy.isBoss ? 1.8 : 2.5);
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
  visitEnemiesInRange(source.x, source.y, radius, (enemy) => {
    if (enemy.dead || enemy.id === source.id) {
      return;
    }
    if (enemy.isBoss && !includeBosses) {
      return;
    }
    const dx = enemy.x - source.x;
    const dy = enemy.y - source.y;
    if (dx * dx + dy * dy > radiusSq) {
      return;
    }
    applyEnemyHaste(enemy, amount, duration);
  });
  applyEnemyHaste(source, amount * 0.8, duration);
  pushEffect({
    kind: "enemy-buff-field",
    x: source.x,
    y: source.y,
    life: 0.82,
    maxLife: 0.82,
    radius,
    color: "rgba(152, 118, 255, {a})",
    secondaryColor: "rgba(188, 134, 255, {a})",
    tertiaryColor: "rgba(221, 176, 255, {a})",
    lightColor: "rgba(243, 223, 255, {a})",
    fadeInRatio: 0.2,
    fadeOutRatio: 0.42,
    renderLayer: "top",
  });
}

function computePlayerProjectileDamage(enemy, projectile) {
  let damage = state.player.weapon.projectileDamage;
  if (enemy.isBoss) {
    damage *= state.player.weapon.bossDamageMultiplier;
  }
  if (hasAffliction(enemy)) {
    damage *= 1 + state.player.damageVsAfflicted;
  }
  if (state.player.afterDashBuffTimer > 0) {
    damage *= 1 + state.player.afterDashPower;
  }
  if (state.player.classId === "frost" && enemy.freezeTimer > 0) {
    damage *= state.player.frozenDamageMultiplier;
  }
  if (state.player.classId === "fire") {
    let burningNearby = 0;
    visitEnemiesInRange(enemy.x, enemy.y, 220, (e) => {
      if (!e.dead && e.id !== enemy.id && e.burnStacks > 0) burningNearby += 1;
    });
    damage *= 1 + Math.min(burningNearby, 10) * 0.06;
    damage *= 1 + Math.min(enemy.burnStacks ?? 0, 8) * 0.05;
  }
  if (state.player.classId === "blood") {
    let nearbyCount = 0;
    visitEnemiesInRange(state.player.x, state.player.y, 180, (e) => {
      if (!e.dead) nearbyCount += 1;
    });
    damage *= 1 + Math.min(nearbyCount, 8) * 0.06;
  }
  const crit = false;
  return { damage, crit };
}

function healPlayer(amount) {
  if (amount <= 0) {
    return;
  }
  const actualHeal = Math.max(0, Math.min(state.player.maxHp - state.player.hp, amount * state.player.healingMultiplier));
  state.player.hp = Math.min(state.player.maxHp, state.player.hp + actualHeal);
  if (actualHeal > 0) {
    trackArchiveEvent("healed", { amount: actualHeal });
  }
}

function dealDamageToEnemy(enemy, amount, source = "generic") {
  if (enemy.dead || amount <= 0) {
    return false;
  }
  spawnDamageNumber(enemy.x, enemy.y - enemy.radius * 0.4, amount, source);
  enemy.hp -= amount;
  if (!isSkillSoundSource(source)) {
    if (enemy.isBoss) {
      window.sfx?.play("bossHit");
    } else if (source === "crit") {
      window.sfx?.play("crit", { intensity: 1 });
    } else {
      window.sfx?.play("hit", { intensity: Math.min(1, 0.6 + amount / 120) });
    }
  }
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
  const perfTier = getPerformanceTier();
  if (perfTier >= 3) {
    return;
  }
  const cap = perfTier >= 2 ? 18 : perfTier >= 1 ? 30 : 52;
  if (state.damageNumbers.length >= cap) {
    state.damageNumbers.splice(0, state.damageNumbers.length - (cap - 1));
  }
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

function spawnNecroThrall(x, y, spec = {}) {
  if (state.player.classId !== "necro") {
    return false;
  }
  if (countActiveThralls() >= state.player.necroSummonCap) {
    return false;
  }
  const life = spec.life ?? 14;
  state.allies.push({
    id: state.nextEntityId++,
    kind: "thrall",
    sourceType: spec.sourceType ?? "phantom",
    emoji: "\u2620",
    tint: "rgba(72, 255, 122, {a})",
    shadowTint: "rgba(72, 255, 122, {a})",
    x,
    y,
    radius: spec.radius ?? 14,
    speed: spec.speed ?? 140,
    damage: spec.damage ?? 11,
    life,
    maxLife: life,
    hitCooldown: 0,
    orbitSeed: Math.random() * Math.PI * 2,
    dead: false,
  });
  trackArchiveEvent("thrall_spawned");
  return true;
}

function maybeRaiseThrall(enemy) {
  if (state.player.classId !== "necro" || enemy.isBoss) {
    return;
  }
  const activeThralls = countActiveThralls();
  if (activeThralls >= state.player.necroSummonCap) {
    return;
  }
  const baseChance = enemy.type === "grunt" || enemy.type === "runner" ? 0.12 : enemy.type === "tank" ? 0.08 : 0.05;
  const chance = baseChance + state.player.necroRaiseChanceBonus + (enemy.necroMarkTimer > 0 ? 0.08 : 0);
  if (Math.random() > chance) {
    return;
  }
  spawnNecroThrall(enemy.x, enemy.y, {
    sourceType: enemy.type,
    radius: Math.max(12, enemy.radius * 0.76),
    speed: Math.max(160, enemy.speed * 0.88),
    damage: 10 + enemy.radius * 0.10,
    life: 14,
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

          const playerOwned = projectile.owner === "player" || projectile.owner === "skill";
          const damageInfo = playerOwned ? computePlayerProjectileDamage(enemy, projectile) : { damage: projectile.damage, crit: false };
          applyHitResponse(enemy, projectile, state.player.weapon, damageInfo.crit);
          dealDamageToEnemy(enemy, damageInfo.damage, damageInfo.crit ? "crit" : projectile.skillType ?? projectile.owner ?? "projectile");

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
    applyEnemyChill(enemy, enemy.isBoss ? 1.0 : 1.6, 2.5);
  } else if (passiveType === "fire") {
    applyEnemyBurn(enemy, enemy.isBoss ? 3 : 4, 3.1);
  } else if (passiveType === "necro") {
    applyEnemyNecroMark(enemy);
  } else if (passiveType === "blood") {
    applyEnemyBloodMark(enemy);
  }

  if (state.player.classId === "blood") {
    const closeRange = Math.hypot(enemy.x - state.player.x, enemy.y - state.player.y) <= 182;
    const insidePool = isPointInsideEffect(state.player.x, state.player.y, "crimson-pool");
    let crowdNearby = 0;
    visitEnemiesInRange(state.player.x, state.player.y, 180, (e) => {
      if (!e.dead) crowdNearby += 1;
    });
    const crowdLifesteal = Math.min(crowdNearby, 8) * 0.022;
    const lifestealRatio =
      state.player.lifesteal +
      crowdLifesteal +
      (state.player.bloodRiteTimer > 0 ? state.player.bloodRiteLifestealBonus : 0) +
      (insidePool ? 0.06 : 0) +
      (closeRange ? state.player.bloodCloseRangeBonus : 0);
    healPlayer(weapon.projectileDamage * lifestealRatio);
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
  if (state.player.classId === "fire" && enemy.burnStacks > 0) {
    const spreadStrength = Math.max(1, Math.ceil(enemy.burnStacks * 0.5));
    visitEnemiesInRange(enemy.x, enemy.y, 150, (nearby) => {
      if (nearby.dead || nearby.id === enemy.id) {
        return;
      }
      const distance = Math.hypot(nearby.x - enemy.x, nearby.y - enemy.y);
      if (distance > 150) {
        return;
      }
      applyEnemyBurn(nearby, spreadStrength * (nearby.isBoss ? 0.8 : 1), 2.2);
    });
  }
  maybeRaiseThrall(enemy);
  trackArchiveEvent("enemy_defeated", { enemy, source });
  if (enemy.isBoss) {
    window.sfx?.play("bossKill");
    recordTelemetryBossDefeat(enemy);
    state.bossDefeats[enemy.type] = (state.bossDefeats[enemy.type] ?? 0) + 1;
    trackArchiveEvent("boss_defeated", { bossType: enemy.type, enemy, source });
    state.bossDirector.encounterIndex += 1;
    scheduleNextBossEncounter(state.elapsed);
    openBossRewardChoices(enemy);
    return;
  }
  if (!isSkillSoundSource(source)) {
    window.sfx?.play("kill");
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
        if (enemy.dead || enemy.airborne) {
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
      applyEnemyChill(enemy, enemy.isBoss ? 1.05 : 1.7, 1.95);
      break;
    case "cinder-halo":
    case "sunspot":
    case "ash-comet":
      applyEnemyBurn(enemy, enemy.isBoss ? 2 : 3, 3.2);
      break;
    case "requiem-field":
      applyEnemyNecroMark(enemy);
      enemy.slowAmount = Math.max(enemy.slowAmount, 0.26);
      enemy.slowTimer = Math.max(enemy.slowTimer, 0.45);
      break;
    case "vein-burst":
    case "crimson-pool":
      applyEnemyBloodMark(enemy);
      healPlayer(damage * (effect.kind === "crimson-pool" ? 0.04 : 0.055));
      enemy.slowAmount = Math.max(enemy.slowAmount, effect.kind === "crimson-pool" ? 0.24 : 0.1);
      enemy.slowTimer = Math.max(enemy.slowTimer, effect.kind === "crimson-pool" ? 0.34 : 0.16);
      break;
    default:
      break;
  }
}

function destroyEnemyProjectile(attack) {
  spawnHostileImpactEffect(attack.x, attack.y, attack.color);
  attack.dead = true;
}

function windEffectIntersectsProjectile(effect, attack) {
  if (effect.kind === "gale-ring") {
    return circlesOverlap(effect.x, effect.y, effect.radius, attack.x, attack.y, attack.radius);
  }

  if (effect.kind === "crosswind-strip") {
    const { currentLength, currentWidth, centerX, centerY } = getCrosswindMetrics(effect, clamp(effect.life / effect.maxLife, 0, 1));
    return pointInRotatedRect(attack.x, attack.y, centerX, centerY, effect.angle, currentLength * 0.5, currentWidth * 0.5 + attack.radius);
  }

  if (effect.kind === "tempest-node") {
    return circlesOverlap(effect.x, effect.y, effect.radius * 0.92, attack.x, attack.y, attack.radius);
  }

  return false;
}

function resolveWindProjectileInterception(attack) {
  if (attack.kind !== "projectile") {
    return false;
  }

  for (const effect of state.effects) {
    if (effect.life <= 0) {
      continue;
    }
    if (effect.kind !== "gale-ring" && effect.kind !== "crosswind-strip" && effect.kind !== "tempest-node") {
      continue;
    }
    if (!windEffectIntersectsProjectile(effect, attack)) {
      continue;
    }
    destroyEnemyProjectile(attack);
    return true;
  }

  return false;
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

    if (effect.kind === "particle-burst") {
      let aliveCount = 0;
      let maxParticleLife = 0;
      for (const particle of effect.particles) {
        particle.life -= dt;
        if (particle.life <= 0) {
          continue;
        }
        particle.x += particle.vx * dt;
        particle.y += particle.vy * dt;
        particle.vx *= Math.exp(-4.4 * dt);
        particle.vy *= Math.exp(-4.4 * dt);
        aliveCount += 1;
        maxParticleLife = Math.max(maxParticleLife, particle.life);
      }
      effect.life = aliveCount > 0 ? maxParticleLife : 0;
      continue;
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
        visitEnemiesInRange(effect.x, effect.y, effect.radius + 48, (enemy) => {
          if (enemy.dead) {
            return;
          }
          const distance = Math.hypot(enemy.x - effect.x, enemy.y - effect.y);
          if (distance > effect.radius + enemy.radius) {
            return;
          }
          applyZoneTick(effect, enemy, 1 - Math.min(0.55, distance / Math.max(1, effect.radius) * 0.35));
        });
      }
      continue;
    }

    if (effect.kind === "crosswind-strip") {
      effect.tickTimer -= dt;
      if (effect.tickTimer <= 0) {
        effect.tickTimer += effect.interval;
        const { currentLength, currentWidth, centerX, centerY } = getCrosswindMetrics(effect, clamp(effect.life / effect.maxLife, 0, 1));
        visitEnemiesInRange(centerX, centerY, Math.max(currentLength, currentWidth) * 0.6 + 48, (enemy) => {
          if (enemy.dead) {
            return;
          }
          if (!pointInRotatedRect(enemy.x, enemy.y, centerX, centerY, effect.angle, currentLength * 0.5, currentWidth * 0.5 + enemy.radius)) {
            return;
          }
          applyZoneTick(effect, enemy, 1);
          const sidewaysX = -Math.sin(effect.angle);
          const sidewaysY = Math.cos(effect.angle);
          const side = Math.sign((enemy.x - effect.x) * sidewaysX + (enemy.y - effect.y) * sidewaysY) || 1;
          enemy.knockbackVX += sidewaysX * side * 260;
          enemy.knockbackVY += sidewaysY * side * 260;
        });
      }
      continue;
    }

    if (effect.kind === "tempest-node") {
      effect.tickTimer -= dt;
      if (effect.tickTimer <= 0) {
        effect.tickTimer += effect.interval;
        visitEnemiesInRange(effect.x, effect.y, effect.radius + 48, (enemy) => {
          if (enemy.dead) {
            return;
          }
          const dx = effect.x - enemy.x;
          const dy = effect.y - enemy.y;
          const distance = Math.hypot(dx, dy);
          if (distance > effect.radius + enemy.radius) {
            return;
          }
          applyZoneTick(effect, enemy, 1);
          const pull = 120 + (1 - distance / Math.max(1, effect.radius)) * 220;
          enemy.knockbackVX += (dx / Math.max(1, distance)) * pull;
          enemy.knockbackVY += (dy / Math.max(1, distance)) * pull;
        });
      }
      continue;
    }

    if (effect.kind === "permafrost-seal" || effect.kind === "ash-comet") {
      effect.armTime -= dt;
      if (!effect.burstDone && effect.armTime <= 0) {
        effect.burstDone = true;
        visitEnemiesInRange(effect.x, effect.y, effect.radius + 48, (enemy) => {
          if (enemy.dead) {
            return;
          }
          const distance = Math.hypot(enemy.x - effect.x, enemy.y - effect.y);
          if (distance > effect.radius + enemy.radius) {
            return;
          }
          applyZoneTick(effect, enemy, 1);
          if (effect.kind === "permafrost-seal") {
            applyEnemyChill(enemy, enemy.isBoss ? 3.4 : 5, 2.6);
          } else {
            applyEnemyBurn(enemy, enemy.isBoss ? 5 : 7, 4.2);
          }
        });
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
        visitEnemiesInRange(effect.x, effect.y, effect.radius + 48, (enemy) => {
          if (enemy.dead) {
            return;
          }
          const distance = Math.hypot(enemy.x - effect.x, enemy.y - effect.y);
          if (distance > effect.radius + enemy.radius) {
            return;
          }
          applyZoneTick(effect, enemy, 1);
        });
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
          visitEnemiesInRange(orbX, orbY, 36, (enemy) => {
            if (enemy.dead || !circlesOverlap(orbX, orbY, 18, enemy.x, enemy.y, enemy.radius)) {
              return;
            }
            applyZoneTick(effect, enemy, 1);
            applyEnemyNecroMark(enemy);
          });
        }
      }
      continue;
    }

    if (effect.kind === "holy-wave") {
      const progress = 1 - effect.life / effect.maxLife;
      const radius = effect.size + progress * effect.growth;
      visitEnemiesInRange(effect.x, effect.y, radius + effect.thickness + 36, (enemy) => {
        if (enemy.dead || effect.hitIds.has(enemy.id)) {
          return;
        }

        const distance = Math.hypot(enemy.x - effect.x, enemy.y - effect.y);
        if (Math.abs(distance - radius) > enemy.radius + effect.thickness) {
          return;
        }

        effect.hitIds.add(enemy.id);
        const damage = effect.damage * (enemy.isBoss ? 0.62 : 1);
        enemy.knockbackVX += ((enemy.x - effect.x) / Math.max(1, distance)) * 280;
        enemy.knockbackVY += ((enemy.y - effect.y) / Math.max(1, distance)) * 280;
        enemy.slowAmount = Math.max(enemy.slowAmount, 0.2);
        enemy.slowTimer = Math.max(enemy.slowTimer, 0.32);
        spawnHitEffect(enemy.x, enemy.y, "holy", enemy.x - effect.x, enemy.y - effect.y);
        dealDamageToEnemy(enemy, damage, "holy-wave");
      });
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

      if (resolveWindProjectileInterception(attack)) {
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
    window.sfx?.play("levelUp");
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

function renderArchiveReveal() {
  if (!archiveRevealPanel) {
    return;
  }
  const entries = state.archiveRun.revealEntries;
  if (entries.length <= 0) {
    archiveRevealPanel.innerHTML = "";
    archiveRevealPanel.classList.add("hidden");
    return;
  }

  archiveRevealPanel.classList.remove("hidden");
  archiveRevealPanel.innerHTML = [
    `<div class="archive-reveal-head">`,
    `<span class="archive-reveal-kicker">Archive Ignited</span>`,
    `<strong>New Archive unlocks this run</strong>`,
    `<span class="archive-reveal-meta">${entries.length} unlocked</span>`,
    `</div>`,
    `<div class="archive-reveal-grid">`,
    entries.map((entry, index) => [
      `<article class="archive-reveal-card" data-kind="${entry.kind}" style="animation-delay:${index * 90}ms">`,
      `<div class="archive-reveal-card-glow"></div>`,
      `<span class="archive-reveal-card-icon">${entry.icon}</span>`,
      `<span class="archive-reveal-card-kicker">${entry.kind === "achievement" ? "Achievement" : "Challenge"}</span>`,
      `<strong>${entry.title}</strong>`,
      `<p>${entry.description}</p>`,
      `</article>`,
    ].join("")).join(""),
    `</div>`,
  ].join("");
}

function renderArchiveProgressCard() {
  if (!archiveProgressCard) {
    return;
  }
  const completedChallenges = getCompletedArchiveChallengeCount();
  const completedAchievements = getCompletedArchiveAchievementCount();
  const percent = Math.round(getArchiveChallengeProgressPercent() * 100);
  const latest = getLatestArchiveUnlock();
  const latestDef = latest
    ? (latest.kind === "achievement" ? ARCHIVE_ACHIEVEMENT_MAP.get(latest.id) : ARCHIVE_CHALLENGE_MAP.get(latest.id))
    : null;
  const pinned = getPinnedArchiveChallenges().map((challenge) => [
    `<div class="archive-progress-row">`,
    `<span class="archive-progress-icon">${challenge.icon}</span>`,
    `<div class="archive-progress-copy"><strong>${challenge.title}</strong><span>${challenge.description}</span></div>`,
    `</div>`,
  ].join("")).join("");

  archiveProgressCard.innerHTML = [
    `<div class="archive-progress-head">`,
    `<div><span class="archive-progress-chip archive-progress-chip-primary">Achievements ${completedAchievements} / ${ARCHIVE_ACHIEVEMENTS.length}</span><strong>${completedChallenges} / ${ARCHIVE_CHALLENGES.length} Trials</strong></div>`,
    `</div>`,
    `<div class="archive-progress-meter" role="progressbar" aria-label="Archive progress" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${percent}">`,
    `<div class="archive-progress-meter-fill" style="width:${percent}%"></div>`,
    `<span class="archive-progress-meter-label">${percent}%</span>`,
    `</div>`,
    pinned
      ? `<div class="archive-progress-list">${pinned}</div>`
      : `<div class="archive-progress-empty">Every Archive Trial is complete. The archive now glows with full memory.</div>`,
    latestDef ? `<div class="archive-progress-latest"><span>Latest unlock</span><strong>${latestDef.icon} ${latestDef.title}</strong></div>` : "",
  ].join("");
}

function buildArchiveCodexEntries(entries, kind) {
  return entries.map((entry) => {
    const completed = kind === "achievement" ? hasCompletedArchiveAchievement(entry.id) : hasCompletedArchiveChallenge(entry.id);
    return {
      id: entry.id,
      icon: entry.icon,
      title: entry.title,
      description: entry.description,
      tier: kind === "achievement" ? "legendary" : entry.category === "boss" ? "rare" : entry.category === "class" ? "uncommon" : "common",
      familyLabel: kind === "achievement" ? "Achievement" : entry.category === "class" ? `${CLASS_DEFS[entry.classId]?.title ?? "Class"} Trial` : `${entry.category} Trial`,
      stacks: Number(completed),
      maxStacks: 1,
      locked: false,
      isMaxed: completed,
      status: kind === "achievement" ? getArchiveAchievementStatus(entry) : getArchiveChallengeStatus(entry),
      archiveEntry: true,
      archiveKind: kind,
    };
  });
}

function createUpgradeMetaMarkup(option) {
  const milestoneMarkup = option.milestone
    ? `<span class="upgrade-family upgrade-family-ascendant">Ascendant</span>`
    : "";
  const familyMarkup = "";

  return `<span class="upgrade-meta-row"><span class="upgrade-meta-left"><span class="upgrade-tier tier-${option.tier}">${option.tier}</span>${milestoneMarkup}${familyMarkup}</span><span class="upgrade-stacks">${getUpgradeStackLabel(option)}</span></span>`;
}

function createUpgradeChoiceMarkup(option, hotkeyLabel) {
  const categoryLabel = option.familyLabel || option.family || "Upgrade";
  return [
    `<span class="upgrade-hotkey">${hotkeyLabel}</span>`,
    `<span class="upgrade-choice-head"><span class="upgrade-stacks">${getUpgradeStackLabel(option)}</span><span></span></span>`,
    `<span class="upgrade-choice-main">`,
    `<span class="upgrade-icon emoji-sprite-icon">${option.icon}</span>`,
    `<span class="upgrade-category">${categoryLabel}</span>`,
    `<span class="upgrade-title">${option.title}</span>`,
    `<span class="upgrade-effect">${option.effectText}</span>`,
    `<span class="upgrade-description">${option.description}</span>`,
    `</span>`,
    `<span class="upgrade-choice-foot"><span class="upgrade-tier tier-${option.tier}">${option.tier}</span></span>`,
  ].join("");
}

function refreshUpgradeEmojiSprites(rootElement) {
  if (!rootElement) {
    return;
  }
  const icons = rootElement.querySelectorAll(".emoji-sprite-icon");
  for (const icon of icons) {
    const emoji = icon.textContent?.trim();
    applyEmojiSpriteToElement(icon, emoji, 40);
  }
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
  refreshUpgradeEmojiSprites(upgradeOptions);
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
    trackArchiveEvent("boss_blessing_picked", { id });
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
        trackArchiveEvent("skill_unlocked", { id });
      } else if (skillState.mastery < 2) {
        skillState.mastery += 1;
        skillState.unlockPulseTimer = Math.max(skillState.unlockPulseTimer, 0.7);
        trackArchiveEvent("mastery_picked", { id });
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
    trackArchiveEvent("major_picked", { id });
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
  if (option.family !== "skill" && option.family !== "mastery") {
    window.sfx?.play("upgradeSelect");
  }
  recordTelemetryReward(rewardKind, option, {
    rewardLevel,
    stacksBefore,
    stacksAfter: option.family !== "skill" && option.family !== "mastery" ? stacksBefore + 1 : stacksBefore,
  });
  if (option.family !== "skill" && option.family !== "mastery") {
    state.upgrades[option.id] = (state.upgrades[option.id] ?? 0) + 1;
  }
  if (option.family === "skill") {
    trackArchiveEvent("skill_unlocked", { option });
  } else if (option.family === "mastery") {
    trackArchiveEvent("mastery_picked", { option });
  } else if (rewardKind === "major") {
    trackArchiveEvent("major_picked", { option });
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
  refreshUpgradeEmojiSprites(bossRewardOptions);
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
  window.sfx?.play("upgradeSelect");
  recordTelemetryReward("boss", option, {
    bossType: state.bossReward.bossType,
    bossName: state.bossReward.bossName,
  });
  state.bossBlessings[option.id] = (state.bossBlessings[option.id] ?? 0) + 1;
  trackArchiveEvent("boss_blessing_picked", { option });
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
  return state.pause.manual || state.pause.focus || state.pause.upgradesPanel || state.pause.helpPanel || state.pause.devMenu;
}

function setPause(kind, value) {
  state.pause[kind] = value;
  if (value) {
    pressedActions.clear();
    resetTouchControls();
  }
  refreshPauseOverlay();
  syncMusicPauseState();
}

function clearPause() {
  state.pause.manual = false;
  state.pause.focus = false;
  state.pause.upgradesPanel = false;
  state.pause.helpPanel = false;
  state.pause.devMenu = false;
  state.pause.codexTab = "build";
  clearPauseMenuEndRunConfirm();
  howToPlayOverlay?.classList.add("hidden");
  stopHowtoPickupPreviewAnimation();
  refreshPauseOverlay();
  syncMusicPauseState();
}

function refreshPauseOverlay() {
  const wasHidden = pauseOverlay.classList.contains("hidden");
  const visible = state.running && !state.levelUp.active && !state.bossReward.active && (state.pause.manual || state.pause.focus || state.pause.upgradesPanel || state.pause.devMenu);
  const menuMode = !state.pause.devMenu && !state.pause.upgradesPanel;
  if (!menuMode || !visible) {
    clearPauseMenuEndRunConfirm();
  }
  if (audioMixer) {
    audioMixer.classList.toggle("hidden", !(visible && menuMode));
    if (!visible || !menuMode) {
      audioMixer.classList.remove("is-open");
    }
  }
  document.body.classList.toggle("pause-menu-mode-audio", visible && menuMode);
  pauseOverlay.classList.toggle("hidden", !visible);
  pauseOverlay.classList.toggle("is-menu-mode", visible && menuMode);
  pauseOverlay.classList.toggle("is-upgrades-mode", visible && state.pause.upgradesPanel && !state.pause.devMenu);
  syncMusicPauseState();
  if (!visible) {
    return;
  }

  if (wasHidden) {
    pausePanel.scrollTop = 0;
    retriggerEnterAnimation(pauseOverlay, pausePanel);
  }

  renderDevToolsPanel();
  if (!state.pause.devMenu && state.pause.upgradesPanel) {
    renderPauseMeta();
  }
  if (!state.pause.devMenu && state.pause.upgradesPanel) {
    renderUpgradesCodex();
  }
  if (pauseMenuScreen) {
    pauseMenuScreen.classList.toggle("hidden", !menuMode || state.pause.devMenu);
  }
  pauseMeta?.classList.toggle("hidden", menuMode && !state.pause.devMenu);
  upgradesList.classList.toggle("hidden", menuMode || (state.pause.devMenu && state.dev.activeTab !== "skills"));
  if (state.pause.devMenu) {
    menuKicker.classList.add("hidden");
    pauseTitle.textContent = "Developer Menu";
    pauseSubtitle.textContent = "Open with / on any layout. Use tabs to inspect upgrades, spawn enemies, tune the character, or switch class. Press / or Esc to resume.";
    return;
  }

  menuKicker.classList.remove("hidden");
  if (menuMode) {
    menuKicker.textContent = "Menu";
    pauseTitle.textContent = "Paused";
    pauseSubtitle.textContent = state.pause.focus
      ? "Game is paused because focus changed. Resume when ready."
      : "Choose your next action.";
    return;
  }
  menuKicker.textContent = "Codex";
  pauseTitle.textContent = "Upgrades";
  pauseSubtitle.textContent = "Review your build and return stronger.";
}

function toggleUpgradesPanel() {
  if (!state.running || state.levelUp.active || state.bossReward.active) {
    return;
  }

  if (state.pause.upgradesPanel) {
    closeUpgradesPanel();
    return;
  }

  openUpgradesPanel();
}

function openUpgradesPanel() {
  if (!state.running || state.levelUp.active || state.bossReward.active) {
    return;
  }
  state.pause.devMenu = false;
  state.pause.upgradesPanel = true;
  state.pause.manual = true;
  state.pause.codexTab = "build";
  pressedActions.clear();
  refreshPauseOverlay();
}

function openPauseMenu() {
  if (!state.running || state.levelUp.active || state.bossReward.active) {
    return;
  }
  state.pause.devMenu = false;
  state.pause.upgradesPanel = false;
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
  if (!state.pause.devMenu) {
    return;
  }

  const tabLabels = {
    skills: "Skills",
    spawn: "Spawn",
    character: "Character",
    class: "Class",
  };

  bossSpawnSelect.value = state.dev.bossChoice;
  devModeSummary.textContent = tabLabels[state.dev.activeTab] ?? "Skills";

  for (const button of devTabButtons) {
    const active = button.dataset.devTab === state.dev.activeTab;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-selected", active ? "true" : "false");
  }

  devSkillsPanel.classList.toggle("hidden", state.dev.activeTab !== "skills");
  devSpawnPanel.classList.toggle("hidden", state.dev.activeTab !== "spawn");
  devCharacterPanel.classList.toggle("hidden", state.dev.activeTab !== "character");
  devClassPanel.classList.toggle("hidden", state.dev.activeTab !== "class");

  renderDevSpawnPanel();
  renderDevCharacterPanel();
  renderDevClassPanel();
}

function handleSpawnBossClick() {
  const type = state.dev.bossChoice === "random" ? chooseRandomBossType() : state.dev.bossChoice;
  if (!type) {
    return;
  }
  window.debug_game?.spawnBoss(type, Number(bossSpawnCount.value));
}

function renderDevSpawnPanel() {
  const orderedEnemyTypes = Array.from(new Set([
    ...SPAWN_ROSTER.map((entry) => entry.type),
    ...Object.keys(ENEMY_ARCHETYPES).filter((type) => !ENEMY_ARCHETYPES[type].isBoss),
  ]));
  devEnemySpawnList.innerHTML = orderedEnemyTypes.map((type) => {
    const enemy = ENEMY_ARCHETYPES[type];
    return [
      `<div class="dev-spawn-row">`,
      `<div class="dev-spawn-label"><span class="dev-spawn-emoji">${enemy.emoji ?? "\u2620\uFE0F"}</span><strong>${formatEnemyTypeLabel(type)}</strong></div>`,
      `<input class="dev-number-input" type="number" min="1" max="999" step="1" value="1" />`,
      `<button type="button" class="dev-button" data-enemy-type="${type}">Spawn</button>`,
      `</div>`,
    ].join("");
  }).join("");
}

function renderDevCharacterPanel() {
  devLevelInput.value = String(state.progression.level);
  devHpInput.value = String(Math.round(state.player.hp));
  devMaxHpInput.value = String(state.player.maxHp);
  devDashChargesInput.value = String(state.player.dash.charges);
  devDashMaxInput.value = String(state.player.dash.maxCharges);

  toggleZenModeButton.textContent = state.dev.zenMode ? "Disable Zen Mode" : "Enable Zen Mode";
  toggleZenModeButton.classList.toggle("is-on", state.dev.zenMode);
  toggleInvulnerableButton.textContent = state.dev.playerInvulnerable ? "Disable Invulnerability" : "Enable Invulnerability";
  toggleInvulnerableButton.classList.toggle("is-on", state.dev.playerInvulnerable);
  toggleManualSkillsButton.textContent = state.dev.manualSkillMode ? "Disable Manual Skills" : "Enable Manual Skills";
  toggleManualSkillsButton.classList.toggle("is-on", state.dev.manualSkillMode);
  toggleZeroCooldownButton.textContent = state.dev.zeroSkillCooldown ? "Disable Zero Cooldown" : "Enable Zero Cooldown";
  toggleZeroCooldownButton.classList.toggle("is-on", state.dev.zeroSkillCooldown);

  devSkillToggleList.innerHTML = getClassDef().skills.map((skill) => {
    const skillState = state.player.skills.find((entry) => entry.id === skill.id);
    const enabled = Boolean(skillState?.unlocked);
    return [
      `<div class="dev-skill-toggle-row">`,
      `<div class="dev-skill-toggle-copy"><span>${skill.icon}</span><strong>${skill.title}</strong><small>Slot ${skill.slot} - Mastery ${skillState?.mastery ?? 0}/2</small></div>`,
      `<button type="button" class="dev-button ${enabled ? "dev-button-accent is-on" : ""}" data-skill-id="${skill.id}" data-skill-enabled="${enabled}">${enabled ? "Enabled" : "Disabled"}</button>`,
      `</div>`,
    ].join("");
  }).join("");
}

function renderDevClassPanel() {
  devClassButtons.innerHTML = CLASS_ORDER.map((classId) => {
    const classDef = CLASS_DEFS[classId];
    const active = state.player.classId === classId;
    return [
      `<button type="button" class="dev-class-button ${active ? "is-active" : ""}" data-class-id="${classId}">`,
      `<span class="dev-class-icon">${classDef.icon}</span>`,
      `<span class="dev-class-copy"><strong>${classDef.title}</strong><small>${classDef.passiveLabel}</small></span>`,
      `</button>`,
    ].join("");
  }).join("");
}

function onClassThumbClick(event) {
  const button = event.target.closest(".class-thumb");
  if (!button) {
    return;
  }
  const classId = button.dataset.classId;
  if (!CLASS_DEFS[classId]) {
    return;
  }
  const unlocked = Boolean(metaProgress.unlocked[classId]);
  if (!unlocked) {
    triggerLockedClassFeedback(button);
    showClassHoverTooltip(button, classId);
    return;
  }
  setStartOverlayFocusClass(classId, { persistSelection: true });
  renderStartOverlay();
}

function getUnlockProgressText(classId) {
  const requirement = CLASS_UNLOCK_REQUIREMENTS[classId];
  if (!requirement || !requirement.enemyType) {
    return "Unlocked by default.";
  }
  const xp = `${Math.min(requirement.xp, metaProgress.unlockState.xp)} / ${requirement.xp} XP`;
  const kills = `${Math.min(requirement.enemyKills, metaProgress.unlockState.kills)} / ${requirement.enemyKills} ${formatEnemyTypeLabel(requirement.enemyType)} kills`;
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

function getUnlockInstructionText(classId) {
  const requirement = CLASS_UNLOCK_REQUIREMENTS[classId];
  if (!requirement || !requirement.enemyType) {
    return "This class is available by default.";
  }
  const enemyLabel = formatEnemyTypeLabel(requirement.enemyType);
  const xpCurrent = Math.min(requirement.xp, metaProgress.unlockState.xp);
  const killsCurrent = Math.min(requirement.enemyKills, metaProgress.unlockState.kills);
  return [
    `Unlock ${CLASS_DEFS[classId]?.title ?? "class"}:`,
    `1) Gain XP: ${xpCurrent} / ${requirement.xp}`,
    `2) Defeat ${enemyLabel}: ${killsCurrent} / ${requirement.enemyKills}`,
  ].join("\n");
}

function getClassThemePalette(classId) {
  switch (classId) {
    case "wind":
      return { a: "rgba(194, 239, 255, 0.56)", b: "rgba(156, 220, 255, 0.44)", c: "rgba(213, 248, 255, 0.3)" };
    case "frost":
      return { a: "rgba(119, 176, 255, 0.44)", b: "rgba(78, 132, 240, 0.34)", c: "rgba(146, 207, 255, 0.22)" };
    case "fire":
      return { a: "rgba(255, 179, 112, 0.44)", b: "rgba(255, 124, 74, 0.34)", c: "rgba(255, 210, 132, 0.22)" };
    case "necro":
      return { a: "rgba(136, 223, 158, 0.4)", b: "rgba(88, 178, 116, 0.34)", c: "rgba(176, 236, 176, 0.2)" };
    case "blood":
      return { a: "rgba(255, 160, 198, 0.42)", b: "rgba(236, 119, 164, 0.34)", c: "rgba(255, 198, 214, 0.22)" };
    default:
      return { a: "rgba(255, 214, 140, 0.34)", b: "rgba(189, 129, 75, 0.3)", c: "rgba(255, 228, 168, 0.2)" };
  }
}

function getSkillPreviewCopy(classId, skillId) {
  const map = {
    wind: {
      "gale-ring": "Point-blank knockback burst.",
      "crosswind-strip": "Moving wind lane that shreds packs.",
      "tempest-node": "Storm core that chains displacement.",
    },
    frost: {
      "blizzard-wake": "Icy ring that rapidly chills nearby foes.",
      "permafrost-seal": "Freeze field for hard crowd control.",
      "crystal-spear": "Priority spear that cracks tough targets.",
    },
    fire: {
      "cinder-halo": "Burning nova around the caster.",
      "sunspot": "Persistent fire zone for stack pressure.",
      "ash-comet": "Heavy comet impact on enemy clusters.",
    },
    necro: {
      "bone-ward": "Defensive cast with close-range punish.",
      "requiem-field": "Decay zone that feeds summon tempo.",
      "grave-call": "Signature summon spike and reset.",
    },
    blood: {
      "vein-burst": "Blood shockwave for burst sustain.",
      "crimson-pool": "Healing pool that controls close space.",
      "blood-rite": "Risk spike for damage and lifedrain.",
    },
  };
  return map[classId]?.[skillId] ?? "Class skill.";
}

function renderStartOverlay() {
  hideClassHoverTooltip();
  classThumbStrip.innerHTML = "";
  const targetClassId = getCurrentUnlockTargetId(metaProgress);
  const visibleClassIds = CLASS_ORDER.slice();
  const focusedClassId = getCurrentFocusClassId();
  const focusedClassDef = CLASS_DEFS[focusedClassId];
  const focusedUnlocked = Boolean(metaProgress.unlocked[focusedClassId]);
  const focusTheme = getClassThemePalette(focusedClassId);
  setMageAmbientClassTheme(focusedClassId);
  if (startSubtitle) {
    startSubtitle.textContent = START_OVERLAY_SHORT_DESCRIPTION;
  }
  if (startMagePanel) {
    startMagePanel.style.setProperty("--class-a", focusTheme.a);
    startMagePanel.style.setProperty("--class-b", focusTheme.b);
    startMagePanel.style.setProperty("--class-c", focusTheme.c);
  }
  resizeMageAmbientCanvas();

  if (classPreviewHero) {
    classPreviewHero.textContent = focusedClassDef?.playerEmoji ?? "\uD83E\uDDD9\uFE0F";
    classPreviewHero.classList.toggle("is-locked", !focusedUnlocked);
  }
  if (classPreviewTitle) {
    classPreviewTitle.textContent = focusedClassDef?.title ?? "Mage";
  }

  if (classPreviewSkills) {
    classPreviewSkills.innerHTML = (focusedClassDef?.skills ?? []).map((skill) => [
      `<div class="mage-skill-row">`,
      `<div class="mage-skill-icon">${skill.icon}</div>`,
      `<div class="mage-skill-copy"><strong>${skill.title}</strong><span>${getSkillPreviewCopy(focusedClassId, skill.id)}</span></div>`,
      `</div>`,
    ].join("")).join("");
  }

  for (let index = 0; index < visibleClassIds.length; index += 1) {
    const classId = visibleClassIds[index];
    const classDef = CLASS_DEFS[classId];
    const unlocked = Boolean(metaProgress.unlocked[classId]);
    const isCurrentTarget = classId === targetClassId;
    const selected = focusedClassId === classId;
    const classTheme = getClassThemePalette(classId);
    const button = document.createElement("button");
    button.type = "button";
    button.className = "class-thumb";
    button.style.setProperty("--card-index", String(index));
    button.dataset.classId = classId;
    button.classList.toggle("is-selected", selected);
    button.classList.toggle("is-locked", !unlocked);
    const lockChipMarkup = unlocked
      ? ""
      : `<span class="class-thumb-chip"><span class="class-lock-icon">\uD83D\uDD12</span><span>Locked</span></span>`;
    if (!unlocked) {
      const tooltipText = isCurrentTarget
        ? getUnlockInstructionText(classId)
        : `Unlock ${CLASS_DEFS[classId].title}:\n1) Unlock the previous mage first.\n2) Then complete this class objective.`;
      button.dataset.lockedTooltip = tooltipText;
    } else {
      button.removeAttribute("data-locked-tooltip");
    }
    button.style.setProperty("--class-a", classTheme.a);
    button.style.setProperty("--class-b", classTheme.b);
    button.style.setProperty("--class-c", classTheme.c);
    button.innerHTML = [
      `<span class="class-thumb-icon">${classDef.playerEmoji}</span>`,
      unlocked ? `<div class="class-thumb-title">${classDef.title}</div>` : "",
      lockChipMarkup,
    ].join("");
    classThumbStrip.appendChild(button);
  }

  if (classProgressCard) {
    classProgressCard.innerHTML = "";
    classProgressCard.classList.add("hidden");
  }

  renderArchiveProgressCard();
  const selectedClassDef = CLASS_DEFS[metaProgress.selectedClassId];
  startRunButton.textContent = focusedUnlocked
    ? `${focusedClassDef.playerEmoji} Start as ${focusedClassDef.title}`
    : `${selectedClassDef.playerEmoji} Start as ${selectedClassDef.title}`;
  updateAudioMixerUI();
  startOverlay.classList.toggle("hidden", state.running);
}

async function startRun() {
  if (state.running || startRunTransitionRunning) {
    return;
  }
  const mask = startRunTransitionMask;
  if (!mask) {
    startRunImmediate();
    return;
  }
  const maxRadius = Math.hypot(window.innerWidth, window.innerHeight) * 0.5 + 52;
  startRunTransitionRunning = true;
  mask.classList.remove("hidden");
  mask.classList.add("is-active");
  try {
    await animateStartRunTransition(mask, maxRadius, 0, 460, easeInOutQuart);
    startRunImmediate();
    await animateStartRunTransition(mask, 0, maxRadius, 560, easeOutQuint);
  } finally {
    mask.classList.remove("is-active");
    mask.classList.add("hidden");
    startRunTransitionRunning = false;
  }
}

function startRunImmediate() {
  const shouldShowHowTo = !hasSeenHowToPlay();
  hideClassHoverTooltip();
  resetTouchControls();
  state = createInitialState(metaProgress.selectedClassId);
  state.running = true;
  ensurePerformanceRecorderRun();
  initPortal?.();
  startOverlay.classList.add("hidden");
  window.sfx?.play("runStart");
  window.sfx?.startRunMusic?.();
  updateHud(true);
  render();
  if (shouldShowHowTo) {
    openHowToPlay({ firstRun: true });
  }
}

function easeInOutQuart(t) {
  return t < 0.5
    ? 8 * t * t * t * t
    : 1 - Math.pow(-2 * t + 2, 4) / 2;
}

function easeOutQuint(t) {
  return 1 - Math.pow(1 - t, 5);
}

function animateStartRunTransition(mask, fromRadius, toRadius, durationMs, easing) {
  return new Promise((resolve) => {
    const startTime = performance.now();
    const step = (now) => {
      const progress = clamp((now - startTime) / durationMs, 0, 1);
      const eased = easing(progress);
      const radius = fromRadius + (toRadius - fromRadius) * eased;
      mask.style.setProperty("--iris-radius", `${radius.toFixed(2)}px`);
      if (progress >= 1) {
        resolve();
        return;
      }
      requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  });
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
    { label: "Kills", value: state.kills },
  ];

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
  if (entries.some((entry) => entry.archiveEntry)) {
    section.classList.add("archive-group");
  }

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
    if (entry.archiveEntry) {
      row.classList.add("archive-row");
      row.dataset.archiveKind = entry.archiveKind ?? "challenge";
    }
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
    const visuallyLocked = !clickableInDev && (entry.locked || entry.stacks <= 0);
    if (visuallyLocked) {
      row.classList.add("locked");
    }

    const clickHint = clickableInDev && !entry.isMaxed ? " - Click to add" : "";
    const statusPrefix = visuallyLocked ? "&#128274; " : entry.isMaxed ? "&#10003; " : "";

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
