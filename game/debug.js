// Debug/test browser hooks used by local tooling and verification scripts.
window.render_game_to_text = function renderGameToText() {
  if (!state?.player) {
    return JSON.stringify({
      mode: "boot",
      render: {
        scale: Number((renderScale ?? 1).toFixed(2)),
        width: canvas?.width ?? 0,
        height: canvas?.height ?? 0,
        viewportWidth: viewWidth ?? 0,
        viewportHeight: viewHeight ?? 0,
      },
    });
  }
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
    render: {
      scale: Number(renderScale.toFixed(2)),
      width: canvas.width,
      height: canvas.height,
      viewportWidth: viewWidth,
      viewportHeight: viewHeight,
    },
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
      moveSpeed: Number((state.player.speed * state.player.speedMultiplier).toFixed(1)),
      isDashing: state.player.dash.activeTimer > 0,
      damageReduction: Number(state.player.damageReduction.toFixed(3)),
      bloodRiteActive: state.player.bloodRiteTimer > 0,
      necroSiphonActive: Boolean(state.player.necroSiphonActive),
      windRushActive: state.player.windRushTimer > 0,
      lastCritActive: state.player.lastCritTimer > 0,
      lastCritSource: state.player.lastCritSource ?? null,
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
        burn: enemy.burnStacks > 0,
        necro: enemy.necroMarkTimer > 0,
        blood: enemy.bloodMarkTimer > 0,
        haste: enemy.hasteTimer > 0,
      },
      burnStacks: enemy.burnStacks ?? 0,
      freezeResist: Number((enemy.freezeResist ?? 0).toFixed(3)),
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
      archiveChallenges: { ...(metaProgress.archive?.challenges ?? {}) },
      archiveAchievements: { ...(metaProgress.archive?.achievements ?? {}) },
    },
    archiveRun: {
      completedChallenges: state.archiveRun.completedChallenges.slice(),
      completedAchievements: state.archiveRun.completedAchievements.slice(),
      revealEntries: state.archiveRun.revealEntries.slice(),
      toastCurrent: state.archiveRun.toastCurrent ? { ...state.archiveRun.toastCurrent } : null,
      toastQueueLength: state.archiveRun.toastQueue.length,
      bossCount: state.archiveRun.bossCount,
      skillUnlocks: state.archiveRun.skillUnlocks,
      masteryChoices: state.archiveRun.masteryChoices,
      majorChoices: state.archiveRun.majorChoices,
      blessingChoices: state.archiveRun.blessingChoices,
      totalHealing: Number(state.archiveRun.totalHealing.toFixed(1)),
      timeLowHp: Number(state.archiveRun.timeLowHp.toFixed(1)),
      burnKillCount: state.archiveRun.burnKillCount,
      maxBurnKillStreak: state.archiveRun.maxBurnKillStreak,
      afflictedKills: state.archiveRun.afflictedKills,
      thrallsSpawned: state.archiveRun.thrallsSpawned,
      maxThralls: state.archiveRun.maxThralls,
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
      activeTab: state.dev.activeTab,
      codexTab: state.pause.codexTab,
      zenMode: state.dev.zenMode,
      devMenuOpen: state.pause.devMenu,
      bossChoice: state.dev.bossChoice,
      disableSpawns: state.dev.disableSpawns,
      manualSkillMode: state.dev.manualSkillMode,
      zeroSkillCooldown: state.dev.zeroSkillCooldown,
      playerInvulnerable: state.dev.playerInvulnerable,
    },
    touch: {
      enabled: touchInput.enabled,
      moveActive: touchInput.move.active,
      dashPressed: touchInput.dashPointerId != null,
      moveVectorX: Number(touchInput.move.vectorX.toFixed(2)),
      moveVectorY: Number(touchInput.move.vectorY.toFixed(2)),
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
  spawnBoss(type, count = 1) {
    const spawnType = type === "random" ? chooseRandomBossType() : type;
    if (!spawnType || !ENEMY_ARCHETYPES[spawnType]?.isBoss) {
      return;
    }
    const anchor = pickSpawnPoint(Math.max(520, Math.min(viewWidth, viewHeight) * 0.58));
    for (let i = 0; i < Math.max(1, Math.floor(count)); i += 1) {
      const boss = createEnemy(spawnType, anchor, i, Math.max(1, Math.floor(count)), {
        bossEncounterIndex: state.bossDirector.encounterIndex,
      });
      boss.attackCooldown = 1.4;
      state.bossSeen[spawnType] = true;
      state.lastBossType = spawnType;
      state.enemies.push(boss);
      trackArchiveEvent("boss_spawned", { bossType: spawnType });
      spawnBossIntroEffect(boss);
    }
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
  grantAllMinorUpgrades() {
    for (const upgrade of MINOR_UPGRADES) {
      while (applyUpgradeById(upgrade.id)) {
        // Max out each minor stack.
      }
    }
    render();
  },
  grantAllMajorUpgrades() {
    for (const upgrade of MAJOR_UPGRADE_PAIRS.flatMap((pair) => [pair.left, pair.right])) {
      while (applyUpgradeById(upgrade.id)) {
        // Max out each major branch for debug scenarios.
      }
    }
    render();
  },
  grantAllUpgrades() {
    window.debug_game.grantAllMinorUpgrades();
    window.debug_game.grantAllMajorUpgrades();
    for (const skill of getClassDef().skills) {
      while (applyUpgradeById(skill.id)) {
        // Unlock and max all class skills.
      }
    }
    for (const blessing of BOSS_BLESSING_LIBRARY) {
      applyUpgradeById(blessing.id);
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
  setPlayerLevel(level) {
    const nextLevel = Math.max(1, Math.floor(level || 1));
    state.progression.level = nextLevel;
    state.progression.xp = 0;
    state.progression.xpToNext = getXpToNext(nextLevel);
    state.progression.pendingLevelUps = 0;
    state.progression.rewardQueue = [];
    state.levelUp.active = false;
    levelUpOverlay.classList.add("hidden");
    updateHud(true);
    refreshPauseOverlay();
    render();
  },
  setPlayerHp(value) {
    state.player.hp = clamp(value, 0, state.player.maxHp);
    updateHud(true);
    refreshPauseOverlay();
    render();
  },
  setPlayerMaxHp(value) {
    state.player.maxHp = Math.max(1, Math.floor(value || 1));
    state.player.hp = Math.min(state.player.hp, state.player.maxHp);
    updateHud(true);
    refreshPauseOverlay();
    render();
  },
  setDashCharges(current, max = current) {
    state.player.dash.maxCharges = Math.max(0, Math.floor(max || 0));
    state.player.dash.charges = clamp(Math.floor(current || 0), 0, state.player.dash.maxCharges);
    updateHud(true);
    refreshPauseOverlay();
    render();
  },
  setPlayerInvulnerable(enabled) {
    state.dev.playerInvulnerable = Boolean(enabled);
    refreshPauseOverlay();
    render();
  },
  setSkillEnabled(skillId, enabled) {
    const skillState = state.player.skills.find((skill) => skill.id === skillId);
    if (!skillState) {
      return false;
    }
    skillState.unlocked = Boolean(enabled);
    skillState.timer = enabled ? 0 : getSkillCooldown(skillState);
    skillState.castFlashTimer = 0;
    updateHud(true);
    refreshPauseOverlay();
    render();
    return true;
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
  clearArchiveProgress() {
    metaProgress.archive = {
      challenges: {},
      achievements: {},
    };
    saveMetaProgress();
    renderStartOverlay();
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
    refreshPauseOverlay();
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
    refreshPauseOverlay();
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
