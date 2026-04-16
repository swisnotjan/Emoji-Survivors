// Core gameplay state transitions, simulation, spawning, skills, and enemy behavior.
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
    },
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
    resetTouchControls();
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
  touchMoveZone.addEventListener("pointerdown", onTouchMovePointerDown);
  touchDashButton.addEventListener("pointerdown", onTouchDashPointerDown);
  window.addEventListener("pointermove", onTouchPointerMove, { passive: false });
  window.addEventListener("pointerup", onTouchPointerEnd);
  window.addEventListener("pointercancel", onTouchPointerEnd);
}

function resizeCanvas() {
  viewWidth = Math.max(360, window.innerWidth);
  viewHeight = Math.max(240, window.innerHeight);
  applyRenderResolution(true);
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

function applyRenderResolution(force = false) {
  const targetScale = Math.round(getTargetRenderScale() * 20) / 20;
  const nextScale = clamp(targetScale, 0.7, 1);
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
  ctx.imageSmoothingEnabled = true;
  invalidateBackgroundCache();
  refreshScreenGradients();
  return true;
}

function refreshScreenGradients() {
  backgroundGradient = ctx.createLinearGradient(0, 0, 0, viewHeight);
  backgroundGradient.addColorStop(0, "#102520");
  backgroundGradient.addColorStop(1, "#1f392f");

  screenVignetteGradient = ctx.createRadialGradient(
    viewWidth * 0.5,
    viewHeight * 0.5,
    Math.min(viewWidth, viewHeight) * 0.12,
    viewWidth * 0.5,
    viewHeight * 0.5,
    Math.max(viewWidth, viewHeight) * 0.78
  );
  screenVignetteGradient.addColorStop(0, "rgba(0, 0, 0, 0)");
  screenVignetteGradient.addColorStop(1, "rgba(2, 8, 7, 1)");

  hurtVignetteGradient = ctx.createRadialGradient(
    viewWidth * 0.5,
    viewHeight * 0.5,
    Math.min(viewWidth, viewHeight) * 0.18,
    viewWidth * 0.5,
    viewHeight * 0.5,
    Math.max(viewWidth, viewHeight) * 0.72
  );
  hurtVignetteGradient.addColorStop(0, "rgba(0, 0, 0, 0)");
  hurtVignetteGradient.addColorStop(0.72, "rgba(120, 20, 22, 0.58)");
  hurtVignetteGradient.addColorStop(1, "rgba(196, 22, 28, 1)");

  deathWashGradient = ctx.createLinearGradient(0, 0, 0, viewHeight);
  deathWashGradient.addColorStop(0, "rgba(255, 124, 124, 1)");
  deathWashGradient.addColorStop(1, "rgba(118, 18, 24, 1)");
}

function invalidateBackgroundCache() {
  terrainRenderCache.zoom = null;
  terrainRenderCache.startWorldX = null;
  terrainRenderCache.startWorldY = null;
  terrainRenderCache.endWorldX = null;
  terrainRenderCache.endWorldY = null;
  terrainRenderCache.waterTiles = [];
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
  perf.tier = getPerformanceTier();
  applyRenderResolution();
  const label = `FPS ${perf.fpsDisplay}`;
  if (state.hudCache.fps !== label) {
    state.hudCache.fps = label;
    fpsValue.textContent = label;
  }
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
    updateHud(state.hudPendingForce);
    state.hudPendingForce = false;
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
  updateHud(false);
}

function collectXpPickup(pickup) {
  pickup.dead = true;
  spawnXpPickupEffect(pickup.x, pickup.y, pickup.type === "xp-cache" ? 1.22 : 0.86);
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
    visitEnemiesInRange(enemy.x, enemy.y, 150, (nearby) => {
      if (nearby.dead || nearby.id === enemy.id) {
        return;
      }
      const distance = Math.hypot(nearby.x - enemy.x, nearby.y - enemy.y);
      if (distance > 150) {
        return;
      }
      applyEnemyBurn(nearby, nearby.isBoss ? 5 : 8, 2.2);
    });
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
            applyEnemyChill(enemy, enemy.isBoss ? 2.8 : 4.2, 2.4);
          } else {
            applyEnemyBurn(enemy, enemy.isBoss ? 15 : 22, 4.2);
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
    resetTouchControls();
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
  resetTouchControls();
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

