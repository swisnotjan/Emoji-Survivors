// Rendering, HUD updates, world visuals, shared utilities, and gameplay support helpers.
const VIGNETTE_CACHE = {
  width: 0,
  height: 0,
  canvas: null,
};
const MINIMAP_CACHE = {
  width: 0,
  height: 0,
  key: "",
  canvas: null,
};
const MINIMAP_OBJECTIVES_CACHE = {
  html: "",
};
const MINIMAP_RUNTIME = {
  centerX: null,
  centerY: null,
};

function render() {
  if (!state?.player) {
    return;
  }
  ctx.setTransform(renderScale, 0, 0, renderScale, 0, 0);
  if (!isProfilerEnabled()) {
    drawBackground();
    drawPortal?.();
    drawEffects("base");
    drawEffects("top");
    drawPickups();
    drawProjectiles();
    drawEnemyTelegraphs();
    drawEnemyAttacks();
    drawAllies();
    drawEnemies();
    drawScreenVignette();
    drawDamageNumbers();
    drawBossIndicator();
    drawBossIntroBanner();
    drawPlayer();
    return;
  }

  profileRenderStage("background", drawBackground);
  profileRenderStage("portal", () => drawPortal?.());
  profileRenderStage("effectsBase", () => drawEffects("base"));
  profileRenderStage("effectsTop", () => drawEffects("top"));
  profileRenderStage("pickups", drawPickups);
  profileRenderStage("projectiles", drawProjectiles);
  profileRenderStage("telegraphs", drawEnemyTelegraphs);
  profileRenderStage("enemyAttacks", drawEnemyAttacks);
  profileRenderStage("allies", drawAllies);
  profileRenderStage("enemies", drawEnemies);
  profileRenderStage("vignette", drawScreenVignette);
  profileRenderStage("damageNumbers", drawDamageNumbers);
  profileRenderStage("bossIndicator", drawBossIndicator);
  profileRenderStage("bossIntroBanner", drawBossIntroBanner);
  profileRenderStage("player", drawPlayer);
}

function ensureVignetteCache() {
  if (VIGNETTE_CACHE.canvas && VIGNETTE_CACHE.width === viewWidth && VIGNETTE_CACHE.height === viewHeight) {
    return;
  }

  const canvas = document.createElement("canvas");
  canvas.width = viewWidth;
  canvas.height = viewHeight;
  const cacheCtx = canvas.getContext("2d");

  const centerX = viewWidth * 0.5;
  const centerY = viewHeight * 0.5;
  const minSide = Math.min(viewWidth, viewHeight);
  const maxSide = Math.max(viewWidth, viewHeight);

  const warmCenter = cacheCtx.createRadialGradient(
    centerX,
    centerY,
    minSide * 0.03,
    centerX,
    centerY,
    minSide * 0.48
  );
  warmCenter.addColorStop(0, "rgba(255, 170, 74, 0.58)");
  warmCenter.addColorStop(0.22, "rgba(247, 152, 58, 0.32)");
  warmCenter.addColorStop(0.46, "rgba(232, 146, 56, 0.14)");
  warmCenter.addColorStop(1, "rgba(0, 0, 0, 0)");
  cacheCtx.fillStyle = warmCenter;
  cacheCtx.fillRect(0, 0, viewWidth, viewHeight);

  const coolEdges = cacheCtx.createRadialGradient(
    centerX,
    centerY,
    minSide * 0.12,
    centerX,
    centerY,
    maxSide * 0.9
  );
  coolEdges.addColorStop(0, "rgba(0, 0, 0, 0)");
  coolEdges.addColorStop(0.24, "rgba(10, 27, 78, 0.5)");
  coolEdges.addColorStop(0.44, "rgba(7, 20, 66, 0.86)");
  coolEdges.addColorStop(0.7, "rgba(4, 12, 42, 0.95)");
  coolEdges.addColorStop(1, "rgba(0, 0, 0, 0.94)");
  cacheCtx.fillStyle = coolEdges;
  cacheCtx.fillRect(0, 0, viewWidth, viewHeight);

  VIGNETTE_CACHE.width = viewWidth;
  VIGNETTE_CACHE.height = viewHeight;
  VIGNETTE_CACHE.canvas = canvas;
}

function worldToMiniMap(worldX, worldY, width, height, bounds) {
  const xRatio = (worldX - bounds.left) / Math.max(1, bounds.right - bounds.left);
  const yRatio = (worldY - bounds.top) / Math.max(1, bounds.bottom - bounds.top);
  return {
    x: xRatio * width,
    y: yRatio * height,
  };
}

function getMiniMapBounds() {
  const zoom = getCameraZoom();
  const screenHeightWorld = viewHeight * zoom;
  const span = clamp(screenHeightWorld * 1.15, 240, 760);
  const worldWidth = WORLD.right - WORLD.left;
  const worldHeight = WORLD.bottom - WORLD.top;
  const spanX = Math.min(span, worldWidth);
  const spanY = Math.min(span, worldHeight);
  MINIMAP_RUNTIME.centerX = state.player.x;
  MINIMAP_RUNTIME.centerY = state.player.y;
  const left = MINIMAP_RUNTIME.centerX - spanX * 0.5;
  const top = MINIMAP_RUNTIME.centerY - spanY * 0.5;
  return {
    left,
    top,
    right: left + spanX,
    bottom: top + spanY,
  };
}

function ensureMiniMapCache(width, height, bounds) {
  const key = [
    width,
    height,
    Math.round(bounds.left / 24),
    Math.round(bounds.top / 24),
    Math.round((bounds.right - bounds.left) / 24),
    Math.round((bounds.bottom - bounds.top) / 24),
  ].join(":");
  if (MINIMAP_CACHE.canvas && MINIMAP_CACHE.width === width && MINIMAP_CACHE.height === height && MINIMAP_CACHE.key === key) {
    return;
  }

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const cacheCtx = canvas.getContext("2d");
  if (!cacheCtx) {
    return;
  }
  cacheCtx.imageSmoothingEnabled = false;
  cacheCtx.clearRect(0, 0, width, height);
  cacheCtx.fillStyle = "#030712";
  cacheCtx.fillRect(0, 0, width, height);

  const sampleStep = 6;
  for (let py = 0; py < height; py += sampleStep) {
    for (let px = 0; px < width; px += sampleStep) {
      const worldX = bounds.left + ((px + 0.5) / width) * (bounds.right - bounds.left);
      const worldY = bounds.top + ((py + 0.5) / height) * (bounds.bottom - bounds.top);
      const terrain = getTerrainTileBase(worldX, worldY);
      let color = "#0a1330";
      if (terrain.type === "water") {
        color = "#0f2456";
      }
      cacheCtx.fillStyle = color;
      cacheCtx.fillRect(px, py, sampleStep, sampleStep);
    }
  }

  MINIMAP_CACHE.width = width;
  MINIMAP_CACHE.height = height;
  MINIMAP_CACHE.key = key;
  MINIMAP_CACHE.canvas = canvas;
}

function drawMiniMap() {
  if (!miniMapCanvas) {
    return;
  }
  const cssWidth = Math.max(120, Math.round(miniMapCanvas.clientWidth || miniMapCanvas.width || 196));
  const cssHeight = Math.max(120, Math.round(miniMapCanvas.clientHeight || miniMapCanvas.height || 196));
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const pixelWidth = Math.max(1, Math.round(cssWidth * dpr));
  const pixelHeight = Math.max(1, Math.round(cssHeight * dpr));
  if (miniMapCanvas.width !== pixelWidth || miniMapCanvas.height !== pixelHeight) {
    miniMapCanvas.width = pixelWidth;
    miniMapCanvas.height = pixelHeight;
  }

  const miniCtx = miniMapCanvas.getContext("2d");
  if (!miniCtx) {
    return;
  }
  const miniBounds = getMiniMapBounds();
  miniCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
  miniCtx.imageSmoothingEnabled = false;
  ensureMiniMapCache(cssWidth, cssHeight, miniBounds);
  miniCtx.clearRect(0, 0, cssWidth, cssHeight);
  if (MINIMAP_CACHE.canvas) {
    miniCtx.drawImage(MINIMAP_CACHE.canvas, 0, 0, cssWidth, cssHeight);
  }

  const enemyCount = state.enemies.length;
  const maxMarkers = 220;
  const enemyStep = Math.max(1, Math.ceil(enemyCount / maxMarkers));
  for (let i = 0; i < enemyCount; i += enemyStep) {
    const enemy = state.enemies[i];
    if (!enemy || enemy.dead) {
      continue;
    }
    const point = worldToMiniMap(enemy.x, enemy.y, cssWidth, cssHeight, miniBounds);
    if (point.x < 0 || point.x > cssWidth || point.y < 0 || point.y > cssHeight) {
      continue;
    }
    miniCtx.fillStyle = enemy.isBoss ? "#ff8ed9" : "#ff6d6d";
    const size = enemy.isBoss ? 7 : 5;
    miniCtx.fillRect(Math.round(point.x - size * 0.5), Math.round(point.y - size * 0.5), size, size);
  }

  const edgeTopLeft = worldToMiniMap(WORLD.left, WORLD.top, cssWidth, cssHeight, miniBounds);
  const edgeBottomRight = worldToMiniMap(WORLD.right, WORLD.bottom, cssWidth, cssHeight, miniBounds);
  miniCtx.strokeStyle = "rgba(102, 137, 212, 0.88)";
  miniCtx.lineWidth = 1;
  miniCtx.strokeRect(
    Math.floor(clamp(edgeTopLeft.x, 0, cssWidth)) + 0.5,
    Math.floor(clamp(edgeTopLeft.y, 0, cssHeight)) + 0.5,
    Math.max(2, Math.floor(clamp(edgeBottomRight.x, 0, cssWidth) - clamp(edgeTopLeft.x, 0, cssWidth))),
    Math.max(2, Math.floor(clamp(edgeBottomRight.y, 0, cssHeight) - clamp(edgeTopLeft.y, 0, cssHeight)))
  );

  const playerPoint = worldToMiniMap(state.player.x, state.player.y, cssWidth, cssHeight, miniBounds);
  miniCtx.fillStyle = "#9eefff";
  miniCtx.fillRect(Math.round(playerPoint.x - 5), Math.round(playerPoint.y - 5), 10, 10);
  miniCtx.strokeStyle = "#dcfaff";
  miniCtx.lineWidth = 1;
  miniCtx.strokeRect(Math.round(playerPoint.x - 6) + 0.5, Math.round(playerPoint.y - 6) + 0.5, 12, 12);
}

function updateMiniMapObjectives() {
  if (!miniMapObjectives) {
    return;
  }
  if (!state.running) {
    if (MINIMAP_OBJECTIVES_CACHE.html) {
      MINIMAP_OBJECTIVES_CACHE.html = "";
      miniMapObjectives.innerHTML = "";
    }
    return;
  }
  const pending = ARCHIVE_CHALLENGES.filter((challenge) => !hasCompletedArchiveChallenge(challenge.id, metaProgress));
  const currentClassId = state.player.classId;
  const classPending = pending.filter((challenge) => challenge.category === "class");
  const classPriority = classPending.filter((challenge) => challenge.classId === currentClassId);
  const pinnedClass = classPriority.slice(0, 2);
  const archivePending = pending.filter((challenge) => challenge.category !== "class");
  const pinnedArchive = archivePending.slice(0, 2);
  const groups = [];

  const nextClassId = getCurrentUnlockTargetId(metaProgress);
  const nextClassDef = nextClassId ? CLASS_DEFS[nextClassId] : null;
  const nextClassReq = nextClassId ? CLASS_UNLOCK_REQUIREMENTS[nextClassId] : null;
  if (nextClassId && nextClassDef && nextClassReq) {
    const isTargetActive = metaProgress.unlockState?.targetClassId === nextClassId;
    const xpCurrent = isTargetActive ? Math.min(nextClassReq.xp, Math.max(0, metaProgress.unlockState?.xp ?? 0)) : 0;
    const killsCurrent = isTargetActive ? Math.min(nextClassReq.enemyKills, Math.max(0, metaProgress.unlockState?.kills ?? 0)) : 0;
    const ratio = clamp(
      ((xpCurrent / Math.max(1, nextClassReq.xp)) + (killsCurrent / Math.max(1, nextClassReq.enemyKills))) * 0.5,
      0,
      1
    );
    groups.push([
      `<section class="mini-map-objective-group">`,
      `<header class="mini-map-objective-group-head"><span class="mini-map-objective-group-kicker">Next Mage</span></header>`,
      `<div class="mini-map-objective-row mini-map-objective-row-mage">`,
      `<div class="mini-map-objective-head"><span class="mini-map-objective-icon">${nextClassDef.icon ?? "🧙"}</span><strong>Unlock ${nextClassDef.title}</strong></div>`,
      `<span class="mini-map-objective-status">XP ${Math.floor(xpCurrent)} / ${nextClassReq.xp} · ${formatEnemyTypeLabel(nextClassReq.enemyType)} ${Math.floor(killsCurrent)} / ${nextClassReq.enemyKills}</span>`,
      `<div class="mini-map-objective-track"><div class="mini-map-objective-fill" style="width:${(ratio * 100).toFixed(1)}%"></div></div>`,
      `</div>`,
      `</section>`,
    ].join(""));
  }

  const archiveRows = pinnedArchive.length
    ? pinnedArchive.map((challenge) => {
        const status = getArchiveChallengeStatus(challenge);
        const current = getArchiveChallengeCurrentValue(challenge.id);
        const ratio = challenge.target ? clamp(current / Math.max(1, challenge.target), 0, 1) : hasCompletedArchiveChallenge(challenge.id) ? 1 : 0;
        return [
          `<div class="mini-map-objective-row">`,
          `<div class="mini-map-objective-head"><span class="mini-map-objective-icon">${challenge.icon ?? "✦"}</span><strong>${challenge.title}</strong></div>`,
          `<span class="mini-map-objective-status">${status}</span>`,
          `<div class="mini-map-objective-track"><div class="mini-map-objective-fill" style="width:${(ratio * 100).toFixed(1)}%"></div></div>`,
          `</div>`,
        ].join("");
      }).join("")
    : `<div class="mini-map-objective-row is-complete"><span class="mini-map-objective-status">All archive challenges complete.</span></div>`;
  groups.push([
    `<section class="mini-map-objective-group">`,
    `<header class="mini-map-objective-group-head"><span class="mini-map-objective-group-kicker">Archive Objectives</span></header>`,
    archiveRows,
    `</section>`,
  ].join(""));

  if (pinnedClass.length > 0) {
    const classRows = pinnedClass.map((challenge) => {
      const status = getArchiveChallengeStatus(challenge);
      const current = getArchiveChallengeCurrentValue(challenge.id);
      const ratio = challenge.target ? clamp(current / Math.max(1, challenge.target), 0, 1) : hasCompletedArchiveChallenge(challenge.id) ? 1 : 0;
      const statusText = challenge.target
        ? `${challenge.description} | ${status}`
        : challenge.description;
      return [
        `<div class="mini-map-objective-row">`,
        `<div class="mini-map-objective-head"><span class="mini-map-objective-icon">${challenge.icon ?? "✦"}</span><strong>${challenge.title}</strong></div>`,
        `<span class="mini-map-objective-status">${statusText}</span>`,
        `<div class="mini-map-objective-track"><div class="mini-map-objective-fill" style="width:${(ratio * 100).toFixed(1)}%"></div></div>`,
        `</div>`,
      ].join("");
    }).join("");
    groups.push([
      `<section class="mini-map-objective-group">`,
      `<header class="mini-map-objective-group-head"><span class="mini-map-objective-group-kicker">Class Objectives</span></header>`,
      classRows,
      `</section>`,
    ].join(""));
  }
  const html = groups.join("");
  if (html !== MINIMAP_OBJECTIVES_CACHE.html) {
    MINIMAP_OBJECTIVES_CACHE.html = html;
    miniMapObjectives.innerHTML = html;
  }
}

function ensureTerrainRenderCache(zoom, startWorldX, startWorldY, endWorldX, endWorldY) {
  // Rebuild only when zoom changes or camera moves 4+ tiles — reduces rebuild frequency ~4x
  const hysteresisWorld = TERRAIN_TILE_SIZE * 4;
  if (
    terrainRenderCache.zoom === zoom &&
    terrainRenderCache.lastRebuildStartX !== null &&
    Math.abs(startWorldX - terrainRenderCache.lastRebuildStartX) < hysteresisWorld &&
    Math.abs(startWorldY - terrainRenderCache.lastRebuildStartY) < hysteresisWorld
  ) {
    return;
  }

  const tileSize = TERRAIN_TILE_SIZE;
  const drawSize = Math.ceil(tileSize / zoom) + 1;
  const tilesWide = Math.floor((endWorldX - startWorldX) / tileSize) + 1;
  const tilesHigh = Math.floor((endWorldY - startWorldY) / tileSize) + 1;
  const tilePositionsX = Array.from({ length: tilesWide }, (_, index) =>
    Math.round((index * tileSize) / zoom)
  );
  const tilePositionsY = Array.from({ length: tilesHigh }, (_, index) =>
    Math.round((index * tileSize) / zoom)
  );
  const lastTileX = tilePositionsX[tilePositionsX.length - 1] ?? 0;
  const lastTileY = tilePositionsY[tilePositionsY.length - 1] ?? 0;
  const newCacheWidth = Math.max(1, lastTileX + drawSize + 2);
  const newCacheHeight = Math.max(1, lastTileY + drawSize + 2);
  // Assigning canvas.width always clears + resets GPU context state — only do it when size actually changes
  if (TERRAIN_CACHE_CANVAS.width !== newCacheWidth || TERRAIN_CACHE_CANVAS.height !== newCacheHeight) {
    TERRAIN_CACHE_CANVAS.width = newCacheWidth;
    TERRAIN_CACHE_CANVAS.height = newCacheHeight;
  } else {
    TERRAIN_CACHE_CTX.clearRect(0, 0, newCacheWidth, newCacheHeight);
  }
  TERRAIN_CACHE_CTX.fillStyle = "#111629";
  TERRAIN_CACHE_CTX.fillRect(0, 0, newCacheWidth, newCacheHeight);
  terrainRenderCache.waterTiles = [];

  // Pre-generate all world feature regions for this viewport in one pass,
  // so generateRegionFeatures() spikes don't happen scattered inside the tile loop
  iterateWorldFeaturesInBounds(startWorldX, startWorldY, endWorldX, endWorldY, () => {});

  for (let tileYIndex = 0, worldY = startWorldY; worldY <= endWorldY; worldY += tileSize, tileYIndex += 1) {
    const screenY = tilePositionsY[tileYIndex];
    for (let tileXIndex = 0, worldX = startWorldX; worldX <= endWorldX; worldX += tileSize, tileXIndex += 1) {
      const screenX = tilePositionsX[tileXIndex];
      const terrain = getTerrainTileBase(worldX + tileSize * 0.5, worldY + tileSize * 0.5);
      TERRAIN_CACHE_CTX.fillStyle = terrain.baseFill;
      TERRAIN_CACHE_CTX.fillRect(screenX, screenY, drawSize, drawSize);

      if (terrain.speckAlpha > 0.03) {
        TERRAIN_CACHE_CTX.fillStyle = tintAlpha(terrain.speckColor, terrain.speckAlpha);
        TERRAIN_CACHE_CTX.fillRect(
          Math.floor(screenX + terrain.speckX / zoom),
          Math.floor(screenY + terrain.speckY / zoom),
          Math.max(1, Math.ceil(terrain.speckSize / zoom)),
          Math.max(1, Math.ceil(terrain.speckSize / zoom))
        );
      }
      if (terrain.type === "water") {
        terrainRenderCache.waterTiles.push({ worldX, worldY, screenX, screenY, drawSize });
      }
    }
  }

  terrainRenderCache.zoom = zoom;
  terrainRenderCache.startWorldX = startWorldX;
  terrainRenderCache.startWorldY = startWorldY;
  terrainRenderCache.endWorldX = endWorldX;
  terrainRenderCache.endWorldY = endWorldY;
  terrainRenderCache.lastRebuildStartX = startWorldX;
  terrainRenderCache.lastRebuildStartY = startWorldY;
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

  ctx.fillStyle = "#141b30";
  ctx.fillRect(0, 0, viewWidth, viewHeight);

  const tileSize = TERRAIN_TILE_SIZE;
  const halfWorldViewWidth = viewWidth * 0.5 * zoom;
  const halfWorldViewHeight = viewHeight * 0.5 * zoom;
  const renderPaddingTiles = 8 + Math.ceil(Math.max(0, zoom - 1) * 20);
  const renderPadding = tileSize * renderPaddingTiles;
  const camera = getCameraState();
  const startWorldX = Math.floor((camera.worldX - halfWorldViewWidth) / tileSize) * tileSize - renderPadding;
  const startWorldY = Math.floor((camera.worldY - halfWorldViewHeight) / tileSize) * tileSize - renderPadding;
  const endWorldX = Math.ceil((camera.worldX + halfWorldViewWidth) / tileSize) * tileSize + renderPadding;
  const endWorldY = Math.ceil((camera.worldY + halfWorldViewHeight) / tileSize) * tileSize + renderPadding;
  ensureTerrainRenderCache(zoom, startWorldX, startWorldY, endWorldX, endWorldY);
  // Use stored cache origin (not current-frame startWorldX) so canvas stays aligned between rebuilds
  const terrainOrigin = worldToScreen(terrainRenderCache.startWorldX, terrainRenderCache.startWorldY);
  const terrainOriginX = Math.floor(terrainOrigin.x);
  const terrainOriginY = Math.floor(terrainOrigin.y);
  ctx.drawImage(TERRAIN_CACHE_CANVAS, terrainOriginX, terrainOriginY);
  for (const tile of terrainRenderCache.waterTiles) {
    const terrain = sampleTerrainTile(tile.worldX + tileSize * 0.5, tile.worldY + tileSize * 0.5);
    ctx.fillStyle = terrain.fill;
    ctx.fillRect(terrainOriginX + tile.screenX, terrainOriginY + tile.screenY, tile.drawSize, tile.drawSize);
    if (terrain.speckAlpha > 0.03) {
      ctx.fillStyle = tintAlpha(terrain.speckColor, terrain.speckAlpha);
      ctx.fillRect(
        Math.floor(terrainOriginX + tile.screenX + terrain.speckX / zoom),
        Math.floor(terrainOriginY + tile.screenY + terrain.speckY / zoom),
        Math.max(1, Math.ceil(terrain.speckSize / zoom)),
        Math.max(1, Math.ceil(terrain.speckSize / zoom))
      );
    }
  }

  drawWorldFeatures(startWorldX, startWorldY, endWorldX, endWorldY);

  ctx.restore();

  ctx.strokeStyle = "rgba(255, 255, 255, 0.22)";
  ctx.lineWidth = 2;
  ctx.strokeRect(worldTopLeft.x + 0.5, worldTopLeft.y + 0.5, worldWidth, worldHeight);
}

// Feature list is static once generated — only re-collect when a different set of regions enters the viewport
let worldFeaturesDrawCache = { startRX: null, startRY: null, endRX: null, endRY: null, features: [] };

function drawWorldFeatures(minX, minY, maxX, maxY) {
  const startRX = regionIndexX(minX);
  const startRY = regionIndexY(minY);
  const endRX = regionIndexX(maxX);
  const endRY = regionIndexY(maxY);

  if (
    worldFeaturesDrawCache.startRX !== startRX ||
    worldFeaturesDrawCache.startRY !== startRY ||
    worldFeaturesDrawCache.endRX !== endRX ||
    worldFeaturesDrawCache.endRY !== endRY
  ) {
    const features = [];
    iterateWorldFeaturesInBounds(minX, minY, maxX, maxY, (feature) => { features.push(feature); });
    features.sort((a, b) => (a.anchorY ?? 0) - (b.anchorY ?? 0));
    worldFeaturesDrawCache.startRX = startRX;
    worldFeaturesDrawCache.startRY = startRY;
    worldFeaturesDrawCache.endRX = endRX;
    worldFeaturesDrawCache.endRY = endRY;
    worldFeaturesDrawCache.features = features;
  }

  for (const feature of worldFeaturesDrawCache.features) {
    if (feature.group === "solid") {
      drawSolidFeature(feature);
      continue;
    }
    if (feature.group === "props") {
      drawDecorFeature(feature);
    }
  }
}

function drawSolidFeature(feature) {
  if (feature.type === "rock" || feature.type === "ruin") {
    drawRockFeature(feature);
    return;
  }
  if (feature.type === "tree") {
    drawTreeFeature(feature);
  }
}

function drawDecorFeature(feature) {
  if (feature.type === "candle") {
    drawCandleFeature(feature);
  }
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

function drawTreeFeature(feature) {
  const pos = worldToScreen(feature.anchorX, feature.anchorY);
  const treeSize = Math.max(22, ((feature.canopyRadius ?? 52) * 1.3) / getCameraZoom());
  if (!isVisible(pos.x, pos.y, treeSize * 0.7 + 20)) {
    return;
  }
  const perfTier = getPerformanceTier();
  const treeEmoji = feature.treeEmoji ?? "🌲";
  if (drawEmojiSprite(treeEmoji, pos.x, pos.y - treeSize * 0.16, treeSize, {
    shadowBlur: perfTier <= 1 ? 14 : 0,
    shadowColor: "rgba(20, 30, 22, 0.34)",
  })) {
    return;
  }
  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `${Math.round(treeSize)}px "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif`;
  if (perfTier <= 1) {
    ctx.shadowBlur = 14;
    ctx.shadowColor = "rgba(20, 30, 22, 0.34)";
  }
  ctx.fillText(treeEmoji, pos.x, pos.y - treeSize * 0.16);
  ctx.restore();
}

function drawCandleFeature(feature) {
  const pos = worldToScreen(feature.anchorX, feature.anchorY);
  const zoom = getCameraZoom();
  const size = Math.max(14, (feature.visualSize ?? 18) / zoom);
  const glowRadius = 24 / zoom;
  if (!isVisible(pos.x, pos.y, size + glowRadius + 16)) {
    return;
  }
  const flicker = 0.74 + Math.sin(state.elapsed * 8.4 + (feature.anchorX + feature.anchorY) * 0.02) * 0.16;
  ctx.save();
  ctx.globalAlpha = 0.82;
  const glow = ctx.createRadialGradient(pos.x, pos.y - size * 0.22, 1, pos.x, pos.y - size * 0.22, glowRadius);
  glow.addColorStop(0, `rgba(255, 215, 132, ${(0.22 + flicker * 0.18).toFixed(3)})`);
  glow.addColorStop(1, "rgba(255, 215, 132, 0)");
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(pos.x, pos.y - size * 0.22, 24 / getCameraZoom(), 0, Math.PI * 2);
  ctx.fill();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `${Math.round(size)}px "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif`;
  ctx.globalAlpha = 0.96;
  if (!drawEmojiSprite("🕯️", pos.x, pos.y, size, { alpha: 0.96 })) {
    ctx.fillText("🕯️", pos.x, pos.y);
  }
  ctx.restore();
}

function drawProjectiles() {
  const perfTier = getPerformanceTier();
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
    if (perfTier >= 2) {
      ctx.fillStyle = projectileColor;
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, Math.max(2, renderRadius * 0.9), 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      continue;
    }
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

function getAttackTelegraphProgress(attack) {
  const maxTelegraphTime = Math.max(0.001, attack.maxTelegraphTime ?? attack.telegraphTime ?? 0.001);
  const progress = clamp(1 - attack.telegraphTime / maxTelegraphTime, 0, 1);
  const appear = easeOutQuad(clamp(progress / 0.18, 0, 1));
  const fill = easeInOut(clamp((progress - 0.05) / 0.95, 0, 1));
  const pulse = 0.5 + 0.5 * Math.sin(state.elapsed * 10.5 + attack.x * 0.017 + attack.y * 0.013);
  return { progress, appear, fill, pulse };
}

function drawEnemyTelegraphs() {
  const perfTier = getPerformanceTier();
  ctx.save();
  for (const attack of state.enemyAttacks) {
    if (attack.dead || !(attack.telegraphTime > 0)) {
      continue;
    }

    const pos = worldToScreen(attack.x, attack.y);
    if (!isVisible(pos.x, pos.y, (attack.radius ?? attack.maxRadius ?? attack.width ?? 24) + 48)) {
      continue;
    }

    if (attack.kind === "beam") {
      drawBeamTelegraph(attack, pos, worldToScreen(attack.x2, attack.y2), perfTier);
    } else {
      drawCircularTelegraph(attack, pos, perfTier);
    }
  }
  ctx.restore();
}

function drawCircularTelegraph(attack, pos, perfTier = 0) {
  const radius = attack.radius ?? attack.maxRadius ?? 24;
  const telegraph = getAttackTelegraphProgress(attack);
  const fillRadius = radius * (0.16 + telegraph.fill * 0.84);
  const dashOffset = -state.elapsed * (140 + telegraph.fill * 150);

  fillGradientDisc(
    pos.x,
    pos.y,
    radius,
    [
      [0, colorWithAlpha(attack.color, 0.02 + telegraph.appear * 0.02)],
      [0.78, colorWithAlpha(attack.color, 0.04 + telegraph.fill * 0.08)],
      [1, colorWithAlpha(attack.color, 0)],
    ],
    "screen"
  );
  fillGradientDisc(
    pos.x,
    pos.y,
    fillRadius,
    [
      [0, colorWithAlpha(attack.color, 0.04 + telegraph.fill * 0.08)],
      [0.82, colorWithAlpha(attack.color, 0.12 + telegraph.fill * 0.15)],
      [1, colorWithAlpha(attack.color, 0)],
    ],
    "screen"
  );

  const mainW = 3.2 + telegraph.fill * 2.6;
  ctx.save();
  ctx.lineCap = "round";
  if (perfTier < 2) {
    ctx.setLineDash([]);
    ctx.strokeStyle = colorWithAlpha(attack.color, 0.14 + telegraph.fill * 0.12);
    ctx.lineWidth = mainW * 3.8;
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, radius, 0, Math.PI * 2);
  }
  ctx.strokeStyle = colorWithAlpha(attack.color, 0.42 + telegraph.fill * 0.32);
  ctx.lineWidth = mainW;
  ctx.setLineDash([14, 10]);
  ctx.lineDashOffset = dashOffset;
  ctx.beginPath();
  ctx.arc(pos.x, pos.y, radius, 0, Math.PI * 2);
  ctx.stroke();

  ctx.strokeStyle = colorWithAlpha(attack.color, 0.2 + telegraph.fill * 0.24 + telegraph.pulse * 0.08);
  ctx.lineWidth = 1.8 + telegraph.appear * 1.4;
  ctx.setLineDash([4, 12]);
  ctx.lineDashOffset = dashOffset * -0.66;
  ctx.beginPath();
  ctx.arc(pos.x, pos.y, radius * (0.88 + telegraph.pulse * 0.03), 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function drawBeamTelegraph(attack, start, end, perfTier = 0) {
  const telegraph = getAttackTelegraphProgress(attack);
  const beamWidth = attack.width * (0.32 + telegraph.fill * 0.36);
  const dashOffset = -state.elapsed * (180 + telegraph.fill * 190);
  const coreAlpha = 0.14 + telegraph.fill * 0.18;

  drawGradientStroke(
    start.x,
    start.y,
    end.x,
    end.y,
    attack.width * (0.56 + telegraph.fill * 0.22),
    [
      [0, colorWithAlpha(attack.color, 0)],
      [0.12, colorWithAlpha(attack.color, 0.05 + telegraph.appear * 0.06)],
      [0.5, colorWithAlpha(attack.color, 0.08 + telegraph.fill * 0.1)],
      [0.88, colorWithAlpha(attack.color, 0.05 + telegraph.appear * 0.06)],
      [1, colorWithAlpha(attack.color, 0)],
    ],
    "screen"
  );
  drawGradientStroke(
    start.x,
    start.y,
    end.x,
    end.y,
    beamWidth,
    [
      [0, colorWithAlpha(attack.color, 0)],
      [0.18, colorWithAlpha(attack.color, coreAlpha)],
      [0.82, colorWithAlpha(attack.color, coreAlpha)],
      [1, colorWithAlpha(attack.color, 0)],
    ],
    "screen"
  );

  const beamMainW = attack.width * (0.2 + telegraph.fill * 0.12);
  ctx.save();
  ctx.lineCap = "round";
  if (perfTier < 2) {
    ctx.setLineDash([]);
    ctx.strokeStyle = colorWithAlpha(attack.color, 0.14 + telegraph.fill * 0.12);
    ctx.lineWidth = beamMainW * 3.5;
    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    ctx.lineTo(end.x, end.y);
    ctx.stroke();
  }
  ctx.strokeStyle = colorWithAlpha(attack.color, 0.48 + telegraph.fill * 0.24);
  ctx.lineWidth = beamMainW;
  ctx.setLineDash([22, 12]);
  ctx.lineDashOffset = dashOffset;
  ctx.beginPath();
  ctx.moveTo(start.x, start.y);
  ctx.lineTo(end.x, end.y);
  ctx.stroke();

  ctx.strokeStyle = colorWithAlpha(attack.color, 0.16 + telegraph.fill * 0.18 + telegraph.pulse * 0.08);
  ctx.lineWidth = attack.width * 0.08 + 1.5;
  ctx.setLineDash([6, 13]);
  ctx.lineDashOffset = dashOffset * -0.72;
  ctx.beginPath();
  ctx.moveTo(start.x, start.y);
  ctx.lineTo(end.x, end.y);
  ctx.stroke();
  ctx.restore();

  fillGradientDisc(
    end.x,
    end.y,
    attack.width * (0.32 + telegraph.fill * 0.18),
    [
      [0, colorWithAlpha(attack.color, 0.16 + telegraph.fill * 0.12)],
      [0.7, colorWithAlpha(attack.color, 0.06 + telegraph.fill * 0.08)],
      [1, colorWithAlpha(attack.color, 0)],
    ],
    "screen"
  );
}

function drawEnemyAttacks() {
  const perfTier = getPerformanceTier();
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
      attack.rgb ??= (() => {
        const parsed = parseColorComponents(attack.color.startsWith("rgba") ? attack.color.replace("{a}", "1") : attack.color);
        return `${parsed.r}, ${parsed.g}, ${parsed.b}`;
      })();
      if (perfTier === 0) {
        drawGradientTrail(pos.x, pos.y, tailX, tailY, attack.radius * 1.25, attack.rgb, 0.88);
        ctx.shadowBlur = 18;
        ctx.shadowColor = tintAlpha(attack.color, 0.42);
      }
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
        continue;
      }

      ctx.save();
      ctx.strokeStyle = tintAlpha(attack.color, 0.88);
      ctx.lineWidth = attack.width;
      if (perfTier < 2) {
        ctx.shadowBlur = 18;
        ctx.shadowColor = tintAlpha(attack.color, 0.35);
      }
      ctx.beginPath();
      ctx.moveTo(pos.x, pos.y);
      ctx.lineTo(end.x, end.y);
      ctx.stroke();
      ctx.restore();
      continue;
    }

    if (attack.telegraphTime > 0) {
      continue;
    }

    if (attack.kind === "shockwave") {
      ctx.save();
      ctx.strokeStyle = tintAlpha(attack.color, 0.58);
      ctx.lineWidth = attack.thickness;
      if (perfTier < 2) {
        ctx.shadowBlur = 16;
        ctx.shadowColor = tintAlpha(attack.color, 0.3);
      }
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, attack.currentRadius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
      continue;
    }

    ctx.save();
    ctx.fillStyle = tintAlpha(attack.color, 0.24);
    if (perfTier < 2) {
      ctx.shadowBlur = 12;
      ctx.shadowColor = tintAlpha(attack.color, 0.3);
    }
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
    const sprite = getSoftBurstSprite(innerColor, outerColor, radius);
    ctx.drawImage(sprite, x - sprite.width * 0.5, y - sprite.height * 0.5);
  });
}

function getParticleSprite(color, radius) {
  const roundedRadius = Math.max(1, Math.round(radius * 2) / 2);
  const resolved = color.includes("{a}") ? color.replace("{a}", "1") : color;
  const rgb = parseColorComponents(resolved);
  const cacheKey = `${rgb.r},${rgb.g},${rgb.b}:${roundedRadius}`;
  const cached = PARTICLE_SPRITE_CACHE.get(cacheKey);
  if (cached) {
    return cached;
  }

  const spriteRadius = roundedRadius;
  const padding = Math.ceil(spriteRadius * 2.6);
  const size = Math.max(8, Math.ceil(spriteRadius * 2 + padding * 2));
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const spriteCtx = canvas.getContext("2d");
  const center = size / 2;
  const gradient = spriteCtx.createRadialGradient(center, center, 0, center, center, spriteRadius);
  gradient.addColorStop(0, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 1)`);
  gradient.addColorStop(0.42, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 1)`);
  gradient.addColorStop(1, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0)`);
  spriteCtx.fillStyle = gradient;
  spriteCtx.shadowBlur = Math.max(8, spriteRadius * 1.4);
  spriteCtx.shadowColor = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 1)`;
  spriteCtx.beginPath();
  spriteCtx.arc(center, center, spriteRadius, 0, Math.PI * 2);
  spriteCtx.fill();
  PARTICLE_SPRITE_CACHE.set(cacheKey, canvas);
  return canvas;
}

function normalizeColorCacheKey(color) {
  const match = color.match(/rgba?\(([^)]+)\)/i);
  if (!match) {
    return color;
  }
  const parts = match[1].split(",").map((part) => part.trim());
  const r = Number.parseFloat(parts[0] ?? "255");
  const g = Number.parseFloat(parts[1] ?? "255");
  const b = Number.parseFloat(parts[2] ?? "255");
  const a = parts.length > 3 ? Math.round(Number.parseFloat(parts[3] ?? "1") * 20) / 20 : 1;
  return `rgba(${r},${g},${b},${a})`;
}

function getSoftBurstSprite(innerColor, outerColor, radius) {
  const roundedRadius = Math.max(1, Math.round(radius * 2) / 2);
  const cacheKey = `${normalizeColorCacheKey(innerColor)}|${normalizeColorCacheKey(outerColor)}|${roundedRadius}`;
  const cached = SOFT_BURST_SPRITE_CACHE.get(cacheKey);
  if (cached) {
    return cached;
  }

  const padding = Math.ceil(roundedRadius * 2.8);
  const size = Math.max(8, Math.ceil(roundedRadius * 2 + padding * 2));
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const spriteCtx = canvas.getContext("2d");
  const center = size / 2;
  spriteCtx.filter = `blur(${Math.max(1.8, roundedRadius * 0.34).toFixed(2)}px)`;
  const mote = spriteCtx.createRadialGradient(center, center, 0, center, center, roundedRadius);
  mote.addColorStop(0, innerColor);
  mote.addColorStop(0.42, innerColor);
  mote.addColorStop(1, outerColor);
  spriteCtx.fillStyle = mote;
  spriteCtx.shadowBlur = Math.max(8, roundedRadius * 1.4);
  spriteCtx.shadowColor = innerColor;
  spriteCtx.beginPath();
  spriteCtx.arc(center, center, roundedRadius, 0, Math.PI * 2);
  spriteCtx.fill();
  SOFT_BURST_SPRITE_CACHE.set(cacheKey, canvas);
  return canvas;
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

    if (effect.kind === "skill-accent") {
      const progress = 1 - lifeRatio;
      const alpha = easeOutQuad(lifeRatio);
      const radius = effect.size + progress * effect.growth;
      const palette = getEffectPalette(effect);

      withComposite("screen", () => {
        ctx.strokeStyle = palette.primary(0.12 + alpha * 0.36);
        ctx.lineWidth = Math.max(1.2, effect.lineWidth * lifeRatio);
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, radius, 0, Math.PI * 2);
        ctx.stroke();
      });

      for (const spark of effect.sparks ?? []) {
        const sparkRadius = radius * (spark.reach / Math.max(1, effect.growth + effect.size));
        const sparkX = pos.x + Math.cos(spark.angle) * sparkRadius;
        const sparkY = pos.y + Math.sin(spark.angle) * sparkRadius;
        drawSoftBurstParticle(
          sparkX,
          sparkY,
          spark.size,
          palette.secondary(0.12 + alpha * 0.26),
          palette.secondary(0),
          "screen"
        );
      }

      for (const ray of effect.rays ?? []) {
        const x2 = pos.x + Math.cos(ray.angle) * ray.reach;
        const y2 = pos.y + Math.sin(ray.angle) * ray.reach;
        drawGradientStroke(
          pos.x,
          pos.y,
          x2,
          y2,
          ray.lineWidth,
          [
            [0, palette.tertiary(0.04 + alpha * 0.12)],
            [0.58, palette.tertiary(0.08 + alpha * 0.18)],
            [1, palette.tertiary(0)],
          ],
          "screen"
        );
      }

      for (const ember of effect.embers ?? []) {
        const emberX = pos.x + ember.offsetX + ember.driftX * progress * 0.18;
        const emberY = pos.y + ember.offsetY - ember.rise * progress * 0.18;
        drawSoftBurstParticle(
          emberX,
          emberY,
          ember.size,
          palette.light(0.1 + alpha * 0.16),
          palette.light(0),
          "screen"
        );
      }
      continue;
    }

    if (effect.kind === "particle-burst") {
      ctx.save();
      ctx.globalCompositeOperation = effect.composite ?? "screen";
      for (const particle of effect.particles) {
        if (particle.life <= 0) {
          continue;
        }
        const particlePos = worldToScreen(particle.x, particle.y);
        if (!isVisible(particlePos.x, particlePos.y, particle.size + 20)) {
          continue;
        }
        const particleLifeRatio = clamp(particle.life / particle.maxLife, 0, 1);
        const radius = Math.max(0.8, particle.size * particleLifeRatio);
        const sprite = getParticleSprite(effect.color, radius);
        ctx.globalAlpha = 0.22 + particleLifeRatio * 0.52;
        ctx.drawImage(sprite, particlePos.x - sprite.width * 0.5, particlePos.y - sprite.height * 0.5);
      }
      ctx.restore();
      continue;
    }

    if (effect.kind === "line") {
      if (fxTier >= 2) {
        continue;
      }
      const end = worldToScreen(effect.x2, effect.y2);
      if (effect.hostile || fxTier >= 1) {
        ctx.strokeStyle = tintAlpha(effect.color, 0.18 + lifeRatio * 0.26);
        ctx.lineWidth = Math.max(1, effect.lineWidth * Math.max(0.45, lifeRatio));
        ctx.beginPath();
        ctx.moveTo(pos.x, pos.y);
        ctx.lineTo(end.x, end.y);
        ctx.stroke();
        continue;
      }
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
      if (effect.hostile || fxTier >= 1) {
        ctx.strokeStyle = tintAlpha(effect.color, 0.22 + lifeRatio * 0.28);
        ctx.lineWidth = Math.max(1, effect.lineWidth * Math.max(0.5, lifeRatio));
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, radius, 0, Math.PI * 2);
        ctx.stroke();
        continue;
      }
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

    if (effect.kind === "enemy-buff-field") {
      const envelope = getEffectEnvelope(effect, lifeRatio);
      const radius = (effect.radius ?? 120) * lerp(0.94, 1.02, envelope.enter);
      const palette = getEffectPalette(effect);
      fillGradientDisc(
        pos.x,
        pos.y,
        radius,
        [
          [0, palette.light(0.012 + envelope.alpha * 0.03)],
          [0.48, palette.primary(0.02 + envelope.alpha * 0.06)],
          [0.82, palette.tertiary(0.035 + envelope.alpha * 0.08)],
          [1, palette.secondary(0)],
        ],
        "screen"
      );
      fillGradientRing(
        pos.x,
        pos.y,
        radius * 0.6,
        radius * 0.98,
        [
          [0, palette.secondary(0)],
          [0.42, palette.secondary(0.02 + envelope.alpha * 0.07)],
          [0.68, palette.tertiary(0.04 + envelope.alpha * 0.1)],
          [1, palette.secondary(0)],
        ],
        "screen"
      );
      const runeCount = fxTier >= 2 ? 0 : fxTier >= 1 ? 4 : 8;
      for (let i = 0; i < runeCount; i += 1) {
        const angle = effect.seed2 + state.elapsed * 0.72 + i * (Math.PI * 2 / runeCount);
        const drift = 0.88 + Math.sin(state.elapsed * 1.8 + i * 0.9) * 0.08;
        const runeX = pos.x + Math.cos(angle) * radius * (0.26 + (i % 3) * 0.18) * drift;
        const runeY = pos.y + Math.sin(angle * 1.08) * radius * (0.24 + (i % 2) * 0.22) * drift;
        const plusSize = 5.5 + (i % 3) * 1.6;
        const lineWidth = 2 + (i % 2) * 0.45;
        drawGradientStroke(
          runeX - plusSize,
          runeY,
          runeX + plusSize,
          runeY,
          lineWidth,
          [
            [0, palette.light(0)],
            [0.5, palette.light(0.06 + envelope.alpha * 0.1)],
            [1, palette.light(0)],
          ],
          "screen"
        );
        drawGradientStroke(
          runeX,
          runeY - plusSize,
          runeX,
          runeY + plusSize,
          lineWidth,
          [
            [0, palette.light(0)],
            [0.5, palette.light(0.06 + envelope.alpha * 0.1)],
            [1, palette.light(0)],
          ],
          "screen"
        );
      }
      continue;
    }

    if (SOFT_SKILL_EFFECT_KINDS.has(effect.kind) && effect.kind !== "crosswind-strip" && effect.kind !== "bone-ward") {
      const envelope = getEffectEnvelope(effect, lifeRatio);
      effect.lastEnvelopeAlpha = envelope.alpha;
      effect.lastEnvelopeScale = envelope.scale;
      effect.lastEnvelopeProgress = envelope.progress;
      const radius = (effect.radius ?? effect.size) * envelope.scale;
      const palette = getEffectPalette(effect);
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
      const palette = getEffectPalette(effect);
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
      const palette = getEffectPalette(effect);
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
        const sprite = getParticleSprite(effect.color, radius);
        ctx.globalAlpha = 0.28 + lifeRatio * 0.82;
        ctx.drawImage(sprite, pos.x - sprite.width * 0.5, pos.y - sprite.height * 0.5);
      } else {
        ctx.fillStyle = tintAlpha(effect.color, 0.28 + lifeRatio * 0.82);
        ctx.shadowBlur = fxTier >= 1 ? 6 : 12;
        ctx.shadowColor = tintAlpha(effect.color, 0.45);
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, radius, 0, Math.PI * 2);
        ctx.fill();
      }
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
    const isXpOrb = pickup.type === "xp-orb";
    const isXpCache = pickup.type === "xp-cache";
    const isXp = isXpOrb || isXpCache;
    const warningWindow = pickup.despawnWarning ?? 4;
    const fadeProgress = !pickup.expiring && pickup.life < warningWindow
      ? clamp(1 - pickup.life / warningWindow, 0, 1)
      : 0;
    const blinkSpeed = 1.8 + fadeProgress * 5.2;
    const blinkWave = 0.5 + 0.5 * Math.sin(pickup.floatTime * blinkSpeed);
    const expireProgress = pickup.expiring && pickup.expireDuration > 0
      ? clamp(1 - pickup.expireTimer / pickup.expireDuration, 0, 1)
      : 0;
    const expireEase = easeInOut(expireProgress);
    const despawnAlpha = pickup.expiring
      ? 1 - easeOutQuad(expireProgress)
      : fadeProgress > 0
        ? isXp
          ? clamp(1 - fadeProgress * 0.3, 0.3, 1)
          : clamp(1 - fadeProgress * 0.42 - blinkWave * fadeProgress * 0.22, 0.24, 1)
        : 1;
    const absorbProgress = pickup.absorbing ? clamp(1 - pickup.absorbTimer / pickup.absorbDuration, 0, 1) : 0;
    const absorbScale = pickup.absorbing ? 1 - absorbProgress * 0.78 : pickup.expiring ? 1 - expireEase * 0.76 : 1;
    const absorbAlpha = pickup.absorbing ? 1 - absorbProgress * 0.85 : 1;
    const introAlpha = (0.32 + introRatio * 0.68) * despawnAlpha * absorbAlpha;
    const auraColor = isXp ? "rgba(255, 214, 92, 0.18)" : "rgba(107, 255, 178, 0.16)";
    const coreColor = isXpCache ? "rgba(255, 190, 70, 0.96)" : isXpOrb ? "rgba(255, 214, 92, 0.96)" : "rgba(87, 244, 167, 0.94)";
    const glowColor = isXp ? "rgba(255, 225, 128, 0.4)" : "rgba(126, 255, 183, 0.32)";
    const crossColor = isXp ? "rgba(255, 246, 214, 0.94)" : "rgba(231, 255, 241, 0.92)";
    const auraScale = pickup.expiring
      ? 1 + expireEase * 0.24
      : isXp
        ? 1 + fadeProgress * 0.06
        : 1 + fadeProgress * 0.1 + blinkWave * fadeProgress * 0.08;
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
    const bodyScale = introScale * (1 + fadeProgress * 0.03) * absorbScale;
    ctx.scale(bodyScale, bodyScale);
    ctx.rotate(isXpOrb ? 0 : Math.PI * 0.25);
    ctx.globalAlpha = introAlpha;
    ctx.fillStyle = coreColor;
    ctx.shadowBlur = 18 + fadeProgress * 6 + expireEase * 4;
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
  const perfTier = getPerformanceTier();
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
    const visualHeight = enemy.visualHeight ?? 0;
    const drawX = pos.x;
    const drawY = pos.y - visualHeight;
    const jumpScale = visualHeight > 0 ? 1 + Math.min(0.18, visualHeight / 900) : 1;
    const font = ENEMY_ARCHETYPES[enemy.type].font;
    const enemyEmojiSize = Math.max(26, (parseInt(font, 10) || 36) + 2);
    if (font !== activeFont) {
      ctx.font = font;
      activeFont = font;
    }

    if (visualHeight > 0) {
      const squash = 1 + Math.min(0.3, visualHeight / 240);
      ctx.save();
      ctx.fillStyle = "rgba(9, 13, 11, 0.26)";
      ctx.beginPath();
      ctx.ellipse(pos.x, pos.y + enemy.radius * 0.48, enemy.radius * (0.8 + squash * 0.2), enemy.radius * 0.34, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    if (perfTier === 0 && enemy.isBoss && enemy.phase >= 2) {
      const rageColor = BOSS_THEME_COLORS[enemy.type] ?? "rgba(255, 160, 120, {a})";
      const ragePulse = 0.62 + Math.sin(state.elapsed * 5.6 + enemy.id) * 0.14;
      ctx.save();
      fillGradientRing(
        drawX,
        drawY,
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

    const status = perfTier >= 2 ? null : getEnemyPrimaryStatus(enemy);

    if (status) {
      const auraStrength = clamp(status.value, 0.18, 0.95);
      ctx.save();
      ctx.fillStyle = tintAlpha(status.aura, 0.12 + auraStrength * 0.18);
      ctx.beginPath();
      ctx.arc(drawX, drawY, enemy.radius + 8 + auraStrength * 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      ctx.save();
      const hueRotate = status.key === "wind" ? 0 : status.hue;
      if (perfTier === 0) {
        ctx.filter = `saturate(1.18) hue-rotate(${hueRotate}deg) brightness(${1.04 + auraStrength * 0.08})`;
        ctx.shadowBlur = 18;
        ctx.shadowColor = tintAlpha(status.aura, 0.2 + auraStrength * 0.35);
      }
      if (jumpScale !== 1) {
        ctx.translate(drawX, drawY + 1);
        ctx.scale(jumpScale, jumpScale);
        if (!drawEmojiSprite(enemy.emoji, 0, 0, enemyEmojiSize)) {
          ctx.fillText(enemy.emoji, 0, 0);
        }
      } else {
        if (!drawEmojiSprite(enemy.emoji, drawX, drawY + 1, enemyEmojiSize)) {
          ctx.fillText(enemy.emoji, drawX, drawY + 1);
        }
      }
      ctx.restore();
    } else {
      if (enemy.isBoss && enemy.phase >= 2 && perfTier === 0) {
        ctx.save();
        ctx.filter = "saturate(1.18) brightness(1.1)";
        ctx.shadowBlur = 20;
        ctx.shadowColor = tintAlpha(BOSS_THEME_COLORS[enemy.type] ?? "rgba(255, 160, 120, {a})", 0.34);
        if (jumpScale !== 1) {
          ctx.translate(drawX, drawY + 1);
          ctx.scale(jumpScale, jumpScale);
          if (!drawEmojiSprite(enemy.emoji, 0, 0, enemyEmojiSize)) {
            ctx.fillText(enemy.emoji, 0, 0);
          }
        } else {
          if (!drawEmojiSprite(enemy.emoji, drawX, drawY + 1, enemyEmojiSize)) {
            ctx.fillText(enemy.emoji, drawX, drawY + 1);
          }
        }
        ctx.restore();
      } else {
        if (jumpScale !== 1) {
          ctx.save();
          ctx.translate(drawX, drawY + 1);
          ctx.scale(jumpScale, jumpScale);
          if (!drawEmojiSprite(enemy.emoji, 0, 0, enemyEmojiSize)) {
            ctx.fillText(enemy.emoji, 0, 0);
          }
          ctx.restore();
        } else {
          if (!drawEmojiSprite(enemy.emoji, drawX, drawY + 1, enemyEmojiSize)) {
            ctx.fillText(enemy.emoji, drawX, drawY + 1);
          }
        }
      }
    }

    if (perfTier === 0 && enemy.hasteTimer > 0) {
      const hasteStrength = clamp(enemy.hasteTimer / 3.6, 0.2, 0.9);
      ctx.save();
      ctx.strokeStyle = tintAlpha("rgba(168, 116, 255, {a})", 0.18 + hasteStrength * 0.28);
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(drawX, drawY, enemy.radius + 11, state.elapsed * 2.2, state.elapsed * 2.2 + Math.PI * 1.35);
      ctx.stroke();
      ctx.restore();
    }

    if (perfTier >= 2 || enemy.isBoss || enemy.hp >= enemy.maxHp - 0.01) {
      continue;
    }

    const hpRatio = clamp(enemy.hp / enemy.maxHp, 0, 1);
    const barWidth = enemy.radius * 2.2;
    const barX = drawX - barWidth / 2;
    const barY = drawY - enemy.radius - 12;

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
    const tint = ally.tint ?? "rgba(220, 203, 255, {a})";
    const shadowTint = ally.shadowTint ?? "rgba(195, 151, 255, {a})";
    ctx.save();
    ctx.fillStyle = tint.replace("{a}", alpha.toFixed(3));
    ctx.shadowBlur = 12;
    ctx.shadowColor = shadowTint.replace("{a}", (0.35 + alpha * 0.2).toFixed(3));
    if (!drawEmojiSprite(ally.emoji, pos.x, pos.y, 28, {
      alpha,
      shadowBlur: 12,
      shadowColor: shadowTint.replace("{a}", (0.35 + alpha * 0.2).toFixed(3)),
    })) {
      ctx.fillText(ally.emoji, pos.x, pos.y);
    }
    ctx.restore();
  }
  ctx.restore();
}

function drawPlayer() {
  const perfTier = getPerformanceTier();
  const center = worldToScreen(state.player.x, state.player.y);
  const classDef = getClassDef();
  const pulse = 0.58 + Math.sin(state.elapsed * 5.8) * 0.16;
  const shake = state.player.hitShakeTimer > 0 ? state.player.hitShakePower : 0;
  const jitterX = shake > 0.01 ? randRange(-1, 1) * shake : 0;
  const jitterY = shake > 0.01 ? randRange(-1, 1) * shake : 0;
  const runEnd = state.runEnd;
  const deathProgress = runEnd.active ? clamp(runEnd.timer / runEnd.duration, 0, 1) : 0;
  const deathTilt = deathProgress * 1.56;

  if (perfTier <= 1) {
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
  }

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
  if (perfTier < 2) {
    ctx.shadowBlur = 18;
    ctx.shadowColor = "rgba(255, 223, 138, 0.35)";
  }
  if (!drawEmojiSprite(state.player.emoji, 0, 0, 44, {
    shadowBlur: perfTier < 2 ? 18 : 0,
    shadowColor: "rgba(255, 223, 138, 0.35)",
  })) {
    ctx.fillText(state.player.emoji, 0, 0);
  }
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
  const margin = 178;
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

function drawBossIntroBanner() {
  const intro = state.bossIntro;
  if (!intro?.active) {
    return;
  }
  const t = clamp(intro.timer / Math.max(0.0001, intro.duration), 0, 1);
  const alpha = t < 0.18 ? t / 0.18 : t > 0.84 ? (1 - t) / 0.16 : 1;
  const pulse = 0.55 + Math.sin(intro.timer * 11.2) * 0.18;
  const bossName = intro.targetBossName || "Boss";
  ctx.save();
  ctx.globalAlpha = clamp(alpha, 0, 1);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const y = viewHeight * 0.21;
  const grad = ctx.createLinearGradient(viewWidth * 0.28, y - 24, viewWidth * 0.72, y + 24);
  grad.addColorStop(0, "rgba(255, 205, 128, 0.94)");
  grad.addColorStop(0.55, "rgba(255, 236, 194, 0.98)");
  grad.addColorStop(1, "rgba(255, 168, 110, 0.94)");
  ctx.fillStyle = grad;
  if (getPerformanceTier() < 2) {
    ctx.shadowBlur = 28 + pulse * 18;
    ctx.shadowColor = "rgba(255, 161, 110, 0.62)";
  }
  ctx.font = '800 18px "Trebuchet MS", "Segoe UI", sans-serif';
  ctx.fillText("BOSS APPROACHING", viewWidth * 0.5, y - 28);
  ctx.font = '900 48px "Trebuchet MS", "Segoe UI", sans-serif';
  ctx.fillText(bossName.toUpperCase(), viewWidth * 0.5, y + 8);
  ctx.restore();
}

function drawDamageNumbers() {
  if (state.damageNumbers.length === 0) {
    return;
  }
  const perfTier = getPerformanceTier();
  if (perfTier >= 3) {
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
    if (perfTier === 0) {
      ctx.shadowBlur = 12;
      ctx.shadowColor = tintAlpha("rgba(255, 248, 235, {a})", alpha * 0.28);
      ctx.strokeStyle = `rgba(22, 28, 25, ${(alpha * 0.88).toFixed(3)})`;
      ctx.lineWidth = 4;
      ctx.strokeText(String(number.amount), 0, 0);
    }
    ctx.fillStyle = hexToRgba(number.color, alpha);
    ctx.fillText(String(number.amount), 0, 0);
    ctx.restore();
  }
  ctx.restore();
}

function drawScreenVignette() {
  const perfTier = getPerformanceTier();
  ensureVignetteCache();
  ctx.save();
  ctx.globalAlpha = perfTier >= 2 ? 0.82 : 0.88;
  ctx.drawImage(VIGNETTE_CACHE.canvas, 0, 0);
  ctx.restore();

  const hpRatio = clamp(state.player.hp / state.player.maxHp, 0, 1);
  const danger = Math.max(0, 1 - hpRatio * 1.35);
  const damageGlow = Math.max(danger, state.player.hitFlash * 1.25);
  const deathOverlay = state.runEnd.active ? clamp(state.runEnd.timer / state.runEnd.duration, 0, 1) : 0;
  const totalGlow = Math.max(damageGlow, deathOverlay * 0.92);
  if (totalGlow <= 0.02) {
    return;
  }

  ctx.save();
  ctx.globalAlpha = perfTier >= 2 ? 0.08 + totalGlow * 0.2 : 0.14 + totalGlow * 0.28;
  ctx.fillStyle = hurtVignetteGradient;
  ctx.fillRect(0, 0, viewWidth, viewHeight);
  ctx.restore();

  if (!state.runEnd.active) {
    return;
  }

  const deathProgress = clamp(state.runEnd.timer / state.runEnd.duration, 0, 1);
  ctx.save();
  ctx.globalAlpha = 0.12 + deathProgress * 0.26;
  ctx.fillStyle = deathWashGradient;
  ctx.fillRect(0, 0, viewWidth, viewHeight);
  ctx.restore();

  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const titleAlpha = clamp(deathProgress * 1.1, 0, 1);
  const titleY = viewHeight * (0.24 - deathProgress * 0.03);
  const titleGradient = ctx.createLinearGradient(viewWidth * 0.3, titleY - 36, viewWidth * 0.7, titleY + 36);
  titleGradient.addColorStop(0, `rgba(255, 205, 162, ${titleAlpha})`);
  titleGradient.addColorStop(0.45, `rgba(255, 239, 214, ${titleAlpha})`);
  titleGradient.addColorStop(1, `rgba(255, 149, 123, ${titleAlpha})`);
  ctx.font = '900 62px "Trebuchet MS", "Segoe UI", sans-serif';
  ctx.shadowBlur = 36 + deathProgress * 20;
  ctx.shadowColor = `rgba(255, 114, 114, ${(0.4 + deathProgress * 0.44).toFixed(3)})`;
  ctx.strokeStyle = `rgba(54, 16, 24, ${(0.44 + deathProgress * 0.38).toFixed(3)})`;
  ctx.lineWidth = 4;
  ctx.strokeText("RUN OVER", viewWidth * 0.5, titleY);
  ctx.fillStyle = titleGradient;
  ctx.fillText("RUN OVER", viewWidth * 0.5, viewHeight * (0.24 - deathProgress * 0.03));
  ctx.font = '600 18px "Trebuchet MS", "Segoe UI", sans-serif';
  ctx.fillStyle = `rgba(255, 214, 194, ${clamp(deathProgress * 0.92, 0, 0.94)})`;
  ctx.shadowBlur = 18;
  ctx.shadowColor = `rgba(255, 130, 100, ${(0.22 + deathProgress * 0.4).toFixed(3)})`;
  ctx.fillText("The swarm breaks the line.", viewWidth * 0.5, viewHeight * (0.3 - deathProgress * 0.02));
  ctx.restore();
}

function getCameraZoom() {
  const camera = getCameraState();
  return camera.zoom;
}

function worldToScreen(worldX, worldY) {
  const camera = getCameraState();
  const zoomOut = camera.zoom;
  const centerX = camera.centerX;
  const centerY = camera.centerY;
  return {
    x: Math.round((worldX - camera.worldX) / zoomOut + centerX + (state?.cameraShake?.offsetX ?? 0)),
    y: Math.round((worldY - camera.worldY) / zoomOut + centerY + (state?.cameraShake?.offsetY ?? 0)),
  };
}

function getCameraState() {
  if (!state?.player) {
    return {
      worldX: 0,
      worldY: 0,
      centerX: viewWidth * 0.5,
      centerY: viewHeight * 0.5,
      zoom: 0.78,
    };
  }
  const runEnd = state.runEnd;
  const deathProgress = runEnd.active ? clamp(runEnd.timer / runEnd.duration, 0, 1) : 0;
  const playerX = state.player.x;
  const playerY = state.player.y;
  const centerX = viewWidth * (0.5 - deathProgress * 0.03);
  const centerY = viewHeight * (0.5 + deathProgress * 0.075);
  const baseZoom = 0.78 + deathProgress * 0.36;
  const intro = state.bossIntro;
  if (!intro?.active) {
    return { worldX: playerX, worldY: playerY, centerX, centerY, zoom: baseZoom };
  }
  const boss = state.enemies.find((enemy) => !enemy.dead && enemy.id === intro.targetEnemyId && enemy.isBoss);
  if (!boss) {
    return { worldX: playerX, worldY: playerY, centerX, centerY, zoom: baseZoom };
  }
  const t = clamp(intro.timer / Math.max(0.0001, intro.duration), 0, 1);
  const zoomInPeak = 0.34;
  const approachEnd = 0.46;
  const holdEnd = 0.82;
  const easeOutCubic = (v) => 1 - Math.pow(1 - v, 3);
  const easeInOutCubic = (v) => (v < 0.5 ? 4 * v * v * v : 1 - Math.pow(-2 * v + 2, 3) / 2);
  let travel = 0;
  if (t < approachEnd) {
    travel = easeOutCubic(clamp(t / approachEnd, 0, 1));
  } else if (t < holdEnd) {
    travel = 1;
  } else {
    travel = 1 - easeInOutCubic(clamp((t - holdEnd) / (1 - holdEnd), 0, 1));
  }
  const zoom = lerp(baseZoom, zoomInPeak, travel);
  return {
    worldX: lerp(playerX, boss.x, travel),
    worldY: lerp(playerY, boss.y, travel),
    centerX,
    centerY,
    zoom,
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
    if (!force) {
      retriggerValuePulse(hud.time);
    }
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
  drawMiniMap();
  updateMiniMapObjectives();
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
    card.lockBadge?.classList.toggle("is-visible", !skillState.unlocked);
    const mastery = clamp(skillState.mastery ?? 0, 0, 2);
    card.masteryDots?.forEach((dot, index) => {
      dot.classList.toggle("is-filled", skillState.unlocked && mastery > index);
    });
    card.root.dataset.tooltipIcon = skillDef.icon;
    card.root.dataset.tooltipTitle = skillDef.title;
    card.root.dataset.tooltipMeta = `Slot ${card.slot} - ${skillDef.role} - ${formatTargetingLabel(skillDef.targeting)}`;
    card.root.dataset.tooltipBody = !skillState.unlocked
      ? `Unlocks at level ${unlockLevel}. ${SKILL_SUMMARIES[skillDef.id] ?? ""}`.trim()
      : `${SKILL_SUMMARIES[skillDef.id] ?? skillDef.title}. Cooldown ${cooldown.toFixed(1)}s.${skillState.mastery > 0 ? ` Mastery ${skillState.mastery}/2.` : ""}`;

    if (!skillState.unlocked) {
      card.cooldown.textContent = "";
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
  if (!instant) {
    window.sfx?.play("runOver");
  }

  if (instant) {
    window.sfx?.stopRunMusic?.({ immediate: true });
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
  window.sfx?.setRunMusicDeathProgress?.(0);
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
  window.sfx?.stopRunMusic?.({ immediate: false });
  finalizePerformanceRecorderRun(state.runEnd.cause || "ended");
  state.running = false;
  state.runEnd.active = false;
  state.levelUp.active = false;
  clearPause();
  pauseOverlay.classList.add("hidden");
  levelUpOverlay.classList.add("hidden");
  bossRewardOverlay.classList.add("hidden");
  evaluateArchiveUnlocks(false);
  state.archiveRun.toastCurrent = null;
  state.archiveRun.toastQueue = [];
  renderArchiveToast();
  finalizeRunTelemetry();
  const unlockedClassId = applyRunMetaProgress();
  updateHud(true);
  resultValue.textContent = unlockedClassId
    ? `Survived ${formatTime(state.elapsed)} and unlocked ${CLASS_DEFS[unlockedClassId].title}.`
    : `Survived ${formatTime(state.elapsed)} before the run collapsed.`;
  renderResultStats();
  renderArchiveReveal();
  gameOverOverlay.classList.remove("hidden");
  retriggerEnterAnimation(gameOverOverlay, gameOverCard);
}

function updateRunEndSequence(dt) {
  state.runEnd.timer = Math.min(state.runEnd.duration, state.runEnd.timer + dt);
  const deathProgress = clamp(state.runEnd.timer / state.runEnd.duration, 0, 1);
  window.sfx?.setRunMusicDeathProgress?.(deathProgress);
  const timeScale = lerp(1, 0.18, smoothstep(0.08, 1, deathProgress));
  state.elapsed += dt * timeScale;
  updateEffects(dt * timeScale);
  if (state.runEnd.timer >= state.runEnd.duration) {
    finishRunSummary();
  }
}

function restartRun(classId = metaProgress.selectedClassId, autoStart = false) {
  window.sfx?.stopRunMusic?.({ immediate: true });
  state = createInitialState(classId);
  metaProgress.selectedClassId = classId;
  saveMetaProgress();
  pressedActions.clear();
  accumulator = 0;
  previousTime = performance.now() / 1000;
  pauseOverlay.classList.add("hidden");
  levelUpOverlay.classList.add("hidden");
  bossRewardOverlay.classList.add("hidden");
  gameOverOverlay.classList.add("hidden");
  if (archiveRevealPanel) {
    archiveRevealPanel.innerHTML = "";
    archiveRevealPanel.classList.add("hidden");
  }
  renderArchiveToast();
  if (autoStart) {
    state.running = true;
    startOverlay.classList.add("hidden");
    window.sfx?.play("runStart");
    window.sfx?.startRunMusic?.();
  } else {
    renderStartOverlay();
  }
  updateHud(true);
  render();
}

function restartRunWithArchiveOutro() {
  if (!gameOverOverlay.classList.contains("hidden") && archiveRevealPanel && !archiveRevealPanel.classList.contains("hidden")) {
    gameOverCard.classList.add("is-leaving");
    archiveRevealPanel.classList.add("is-leaving");
    setTimeout(() => {
      gameOverCard.classList.remove("is-leaving");
      archiveRevealPanel.classList.remove("is-leaving");
      restartRun(metaProgress.selectedClassId, false);
    }, 320);
    return;
  }
  restartRun(metaProgress.selectedClassId, false);
}

function restartSameClassRunWithArchiveOutro() {
  const classId = state?.player?.classId ?? metaProgress.selectedClassId;
  if (!gameOverOverlay.classList.contains("hidden") && archiveRevealPanel && !archiveRevealPanel.classList.contains("hidden")) {
    gameOverCard.classList.add("is-leaving");
    archiveRevealPanel.classList.add("is-leaving");
    setTimeout(() => {
      gameOverCard.classList.remove("is-leaving");
      archiveRevealPanel.classList.remove("is-leaving");
      restartRun(classId, true);
    }, 320);
    return;
  }
  restartRun(classId, true);
}

function returnToMainMenuWithArchiveOutro() {
  const classId = state?.player?.classId ?? metaProgress.selectedClassId;
  if (!gameOverOverlay.classList.contains("hidden") && archiveRevealPanel && !archiveRevealPanel.classList.contains("hidden")) {
    gameOverCard.classList.add("is-leaving");
    archiveRevealPanel.classList.add("is-leaving");
    setTimeout(() => {
      gameOverCard.classList.remove("is-leaving");
      archiveRevealPanel.classList.remove("is-leaving");
      restartRun(classId, false);
    }, 320);
    return;
  }
  restartRun(classId, false);
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

function isFeatureTooCloseToOthers(feature, features, padding = 180) {
  for (const other of features) {
    const dx = feature.anchorX - other.anchorX;
    const dy = feature.anchorY - other.anchorY;
    const minimumDistance = feature.footprintRadius + other.footprintRadius + padding;
    if (dx * dx + dy * dy < minimumDistance * minimumDistance) {
      return true;
    }
  }
  return false;
}

function isPointNearWaterFeature(x, y, features, extraRadius = 130) {
  for (const feature of features) {
    if (feature.group !== "water") {
      continue;
    }
    for (const circle of feature.circles ?? []) {
      const limit = circle.r + extraRadius;
      const dx = x - circle.x;
      const dy = y - circle.y;
      if (dx * dx + dy * dy <= limit * limit) {
        return true;
      }
    }
  }
  return false;
}

function isTreePlacementTooClose(treeFeature, features, solidPadding = 64, waterPadding = 8) {
  for (const other of features) {
    const dx = treeFeature.anchorX - other.anchorX;
    const dy = treeFeature.anchorY - other.anchorY;
    const padding = other.group === "water" ? waterPadding : solidPadding;
    const minimumDistance = treeFeature.footprintRadius + other.footprintRadius + padding;
    if (dx * dx + dy * dy < minimumDistance * minimumDistance) {
      return true;
    }
  }
  return false;
}

function pickTreeEmojiForLocation(rng, x, y, features) {
  const baseTrees = ["🌲", "🌳"];
  if (isPointNearWaterFeature(x, y, features, 300)) {
    return rng() > 0.2 ? "🌴" : baseTrees[Math.floor(rng() * baseTrees.length)];
  }
  return baseTrees[Math.floor(rng() * baseTrees.length)];
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

function createTreeFeature(rng, innerLeft, innerTop, innerRight, innerBottom, options = {}) {
  const x = options.x ?? lerp(innerLeft + 90, innerRight - 90, rng());
  const y = options.y ?? lerp(innerTop + 90, innerBottom - 90, rng());
  const sizeScale = options.sizeScale ?? 1;
  const trunkRadius = (18 + rng() * 10) * sizeScale;
  const canopyRadius = trunkRadius + (17 + rng() * 14) * sizeScale;
  const treeEmojis = ["🌲", "🌳", "🌴"];
  const treeEmoji = options.treeEmoji ?? treeEmojis[Math.floor(rng() * treeEmojis.length)];
  return finalizeWorldFeature({
    type: "tree",
    group: "solid",
    anchorX: x,
    anchorY: y,
    treeEmoji,
    canopyRadius,
    circles: [{ x, y, r: trunkRadius }],
    blocksMovement: true,
    blocksProjectiles: true,
    footprintRadius: canopyRadius + 12,
  });
}

function createCandleFeature(rng, innerLeft, innerTop, innerRight, innerBottom) {
  const x = lerp(innerLeft + 42, innerRight - 42, rng());
  const y = lerp(innerTop + 42, innerBottom - 42, rng());
  const visualSize = 16 + rng() * 6;
  return finalizeWorldFeature({
    type: "candle",
    group: "props",
    anchorX: x,
    anchorY: y,
    visualSize,
    circles: [{ x, y, r: 8 }],
    blocksMovement: false,
    blocksProjectiles: false,
    footprintRadius: 15,
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

    const waterFeatures = features.filter((feature) => feature.group === "water");
    if (waterFeatures.length > 0) {
      const desiredPalms = 2 + (rng() > 0.4 ? 1 : 0) + (rng() > 0.78 ? 1 : 0);
      attempts = 0;
      let palmsPlaced = 0;
      while (palmsPlaced < desiredPalms && attempts < 28) {
        attempts += 1;
        const waterFeature = waterFeatures[Math.floor(rng() * waterFeatures.length)];
        const waterCircle = (waterFeature.circles ?? [])[Math.floor(rng() * Math.max(1, waterFeature.circles?.length ?? 1))];
        if (!waterCircle) {
          continue;
        }
        const angle = rng() * Math.PI * 2;
        const shoreDistance = waterCircle.r + 18 + rng() * 86;
        const palmX = waterCircle.x + Math.cos(angle) * shoreDistance;
        const palmY = waterCircle.y + Math.sin(angle) * shoreDistance;
        const palmTree = createTreeFeature(rng, innerLeft, innerTop, innerRight, innerBottom, {
          x: palmX,
          y: palmY,
          sizeScale: 0.85 + rng() * 0.28,
          treeEmoji: "🌴",
        });
        if (!isFeatureWithinInnerRegion(palmTree, innerLeft, innerTop, innerRight, innerBottom)) {
          continue;
        }
        if (isFeatureNearOrigin(palmTree) || isTreePlacementTooClose(palmTree, features, 42, 0)) {
          continue;
        }
        features.push(palmTree);
        palmsPlaced += 1;
      }
    }

    const desiredTrees = 4 + (rng() > 0.4 ? 1 : 0) + (rng() > 0.72 ? 1 : 0) + (rng() > 0.9 ? 1 : 0);
    attempts = 0;
    let treesPlaced = 0;
    while (treesPlaced < desiredTrees && attempts < 28) {
      attempts += 1;
      const treeFeature = createTreeFeature(rng, innerLeft, innerTop, innerRight, innerBottom);
      treeFeature.treeEmoji = pickTreeEmojiForLocation(rng, treeFeature.anchorX, treeFeature.anchorY, features);
      if (!isFeatureWithinInnerRegion(treeFeature, innerLeft, innerTop, innerRight, innerBottom)) {
        continue;
      }
      if (isFeatureNearOrigin(treeFeature) || isTreePlacementTooClose(treeFeature, features, 88, 2)) {
        continue;
      }
      features.push(treeFeature);
      treesPlaced += 1;
    }

    const forestPatchCount = 1 + (rng() > 0.5 ? 1 : 0) + (rng() > 0.86 ? 1 : 0);
    attempts = 0;
    let patchesPlaced = 0;
    while (patchesPlaced < forestPatchCount && attempts < 26) {
      attempts += 1;
      const patchCenterX = lerp(innerLeft + 200, innerRight - 200, rng());
      const patchCenterY = lerp(innerTop + 200, innerBottom - 200, rng());
      const patchProbe = finalizeWorldFeature({
        type: "tree-patch-probe",
        group: "solid",
        anchorX: patchCenterX,
        anchorY: patchCenterY,
        circles: [{ x: patchCenterX, y: patchCenterY, r: 40 }],
        blocksMovement: false,
        blocksProjectiles: false,
        footprintRadius: 170,
      });
      if (isFeatureNearOrigin(patchProbe) || isFeatureTooCloseToOthers(patchProbe, features, 96)) {
        continue;
      }
      const treeCount = 3 + Math.floor(rng() * 4);
      let planted = 0;
      let patchAttempts = 0;
      while (planted < treeCount && patchAttempts < 20) {
        patchAttempts += 1;
        const angle = rng() * Math.PI * 2;
        const distance = 24 + rng() * 122;
        const treeX = patchCenterX + Math.cos(angle) * distance;
        const treeY = patchCenterY + Math.sin(angle) * distance;
        const treeFeature = createTreeFeature(rng, innerLeft, innerTop, innerRight, innerBottom, {
          x: treeX,
          y: treeY,
          sizeScale: 0.8 + rng() * 0.42,
        });
        treeFeature.treeEmoji = pickTreeEmojiForLocation(rng, treeFeature.anchorX, treeFeature.anchorY, features);
        if (!isFeatureWithinInnerRegion(treeFeature, innerLeft, innerTop, innerRight, innerBottom)) {
          continue;
        }
        if (isFeatureNearOrigin(treeFeature) || isTreePlacementTooClose(treeFeature, features, 40, 0)) {
          continue;
        }
        features.push(treeFeature);
        planted += 1;
      }
      patchesPlaced += 1;
    }

    const desiredCandles = 2 + Math.floor(rng() * 4);
    attempts = 0;
    let candlesPlaced = 0;
    while (candlesPlaced < desiredCandles && attempts < 20) {
      attempts += 1;
      const candleFeature = createCandleFeature(rng, innerLeft, innerTop, innerRight, innerBottom);
      if (isFeatureNearOrigin(candleFeature) || isFeatureTooCloseToOthers(candleFeature, features, 34)) {
        continue;
      }
      features.push(candleFeature);
      candlesPlaced += 1;
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

function getCachedTerrainTile(cacheKey) {
  return TERRAIN_TILE_CACHE.get(cacheKey) ?? null;
}

function getTerrainTileCacheKey(tileX, tileY) {
  return (tileY - TERRAIN_CACHE_MIN_TILE_Y) * TERRAIN_CACHE_TILES_X + (tileX - TERRAIN_CACHE_MIN_TILE_X);
}

function setCachedTerrainTile(cacheKey, value) {
  TERRAIN_TILE_CACHE.set(cacheKey, value);
  // Evict one oldest entry per insertion when over limit — spreads pruning cost across frames
  // instead of a single 4096-deletion spike when the high-water mark is crossed
  if (TERRAIN_TILE_CACHE.size > TERRAIN_TILE_CACHE_MAX_ENTRIES) {
    TERRAIN_TILE_CACHE.delete(TERRAIN_TILE_CACHE.keys().next().value);
  }
}

function getTerrainTileBase(worldX, worldY) {
  const seed = getWorldSeed();
  const tileX = Math.round(worldX / TERRAIN_TILE_SIZE);
  const tileY = Math.round(worldY / TERRAIN_TILE_SIZE);
  const cacheKey = getTerrainTileCacheKey(tileX, tileY);
  const cached = getCachedTerrainTile(cacheKey);
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
  const tintColor = tintNoise > 0 ? "rgb(136, 106, 56)" : "rgb(56, 96, 168)";
  fill = mixHexColor(fill, tintColor, 0.032 + Math.abs(tintNoise) * 0.058);
  fill = shadeColor(fill, (detailNoise - 0.5) * 0.1 + (materialNoise - 0.5) * 0.06);

  let speckColor = terrainType === "sand" ? "rgba(136, 104, 46, {a})" : terrainType === "stone" ? "rgba(72, 92, 136, {a})" : "rgba(88, 120, 96, {a})";
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
    speckColor = "rgba(132, 206, 255, {a})";
    speckAlpha = 0.01 + waterDepth * 0.018;
    const waterBlend = clamp(0.08 + detailNoise * 0.32 + waterDepth * 0.58, 0, 1);
    const waterColor = waterBlend < 0.5
      ? mixHexColor(TERRAIN_PALETTE.water[0], TERRAIN_PALETTE.water[1], waterBlend * 2)
      : mixHexColor(TERRAIN_PALETTE.water[1], TERRAIN_PALETTE.water[2], (waterBlend - 0.5) * 2);
    const shoreBlend = smoothstep(0.06, 0.24, waterDepth);
    fill = mixHexColor(fill, waterColor, shoreBlend);
  }

  const fillRgb = parseColorComponents(fill);
  const base = {
    type: terrainType,
    baseFill: fill,
    baseFillR: fillRgb.r,
    baseFillG: fillRgb.g,
    baseFillB: fillRgb.b,
    waterDepth,
    speckColor,
    speckAlpha,
    speckX: 4 + Math.floor(hash2D(worldX * 0.1, worldY * 0.1, seed + 303) * 10),
    speckY: 4 + Math.floor(hash2D(worldX * 0.12, worldY * 0.12, seed + 317) * 10),
    speckSize: 1 + Math.floor(hash2D(worldX * 0.08, worldY * 0.08, seed + 331) * 2),
  };
  setCachedTerrainTile(cacheKey, base);
  return base;
}

function sampleTerrainTile(worldX, worldY) {
  const base = getTerrainTileBase(worldX, worldY);
  let fill = base.baseFill;

  if (base.waterDepth > 0.06) {
    const rippleWave =
      Math.sin(state.elapsed * (1.8 + base.waterDepth * 1.6) + worldX * 0.02 + worldY * 0.016) * 0.5 +
      Math.sin(state.elapsed * (2.6 + base.waterDepth * 2.2) - worldX * 0.017 + worldY * 0.022) * 0.5;
    const mix = rippleWave * base.waterDepth * 0.16;
    const target = mix >= 0 ? 255 : 0;
    const abs = Math.abs(mix);
    fill = `rgb(${Math.round(base.baseFillR + (target - base.baseFillR) * abs)}, ${Math.round(base.baseFillG + (target - base.baseFillG) * abs)}, ${Math.round(base.baseFillB + (target - base.baseFillB) * abs)})`;
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

function getEffectPalette(effect) {
  if (!effect.paletteCache) {
    effect.paletteCache = resolveEffectPalette(effect);
  }
  return effect.paletteCache;
}

function getEffectRetentionPriority(effect) {
  if (effect.retentionPriority != null) {
    return effect.retentionPriority;
  }
  if (effect.followPlayer || SOFT_SKILL_EFFECT_KINDS.has(effect.kind) || effect.kind === "holy-wave") {
    return 3;
  }
  if (effect.kind === "skill-accent" || effect.kind === "holy-text") {
    return 2;
  }
  if (effect.kind === "enemy-buff-field") {
    return 1;
  }
  if (
    effect.kind === "particle-burst" ||
    effect.kind === "spark" ||
    effect.kind === "ember" ||
    effect.kind === "ring"
  ) {
    return 0;
  }
  return 1;
}

function getEffectRemainingLife(effect) {
  return Math.max(effect.life ?? 0, effect.armTime ?? 0, effect.absorbDuration ?? 0);
}

function findEffectTrimIndex(incomingPriority) {
  let bestIndex = -1;
  let bestPriority = Number.POSITIVE_INFINITY;
  let bestLife = Number.POSITIVE_INFINITY;

  for (let i = 0; i < state.effects.length; i += 1) {
    const candidate = state.effects[i];
    const priority = getEffectRetentionPriority(candidate);
    const remainingLife = getEffectRemainingLife(candidate);
    if (
      priority < bestPriority ||
      (priority === bestPriority && remainingLife < bestLife)
    ) {
      bestPriority = priority;
      bestLife = remainingLife;
      bestIndex = i;
    }
  }

  if (bestIndex === -1 || bestPriority > incomingPriority) {
    return -1;
  }
  return bestIndex;
}

function pushEffect(effect) {
  const tier = getFxTier();
  const cap = tier >= 2 ? 90 : tier >= 1 ? 140 : 220;
  const incomingPriority = getEffectRetentionPriority(effect);
  while (state.effects.length >= cap) {
    const trimIndex = findEffectTrimIndex(incomingPriority);
    if (trimIndex === -1) {
      return;
    }
    state.effects.splice(trimIndex, 1);
  }
  effect.seed ??= Math.random() * Math.PI * 2;
  effect.seed2 ??= Math.random() * Math.PI * 2;
  state.effects.push(effect);
}

function pushParticleBurst(x, y, color, particles, options = {}) {
  if (!particles || particles.length === 0) {
    return;
  }
  pushEffect({
    kind: "particle-burst",
    x,
    y,
    life: Math.max(...particles.map((particle) => particle.life)),
    maxLife: Math.max(...particles.map((particle) => particle.life)),
    color,
    renderLayer: options.renderLayer ?? "base",
    composite: options.composite ?? "screen",
    particles,
  });
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

  const particles = [];
  for (let i = 0; i < scaleFxCount(Math.round(6 * Math.max(1, scale))); i += 1) {
    const angle = (i / 6) * Math.PI * 2 + randRange(-0.16, 0.16);
    const speed = randRange(52, 120);
    const life = randRange(0.18, 0.32);
    particles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 18,
      life,
      maxLife: life,
      size: randRange(2.6, 4.2) * Math.min(1.35, Math.sqrt(scale)),
    });
  }

  for (let i = 0; i < scaleFxCount(Math.round(4 * Math.max(1, scale))); i += 1) {
    const life = randRange(0.28, 0.44);
    particles.push({
      x: x + randRange(-5, 5),
      y: y - randRange(2, 10),
      vx: randRange(-20, 20),
      vy: -randRange(70, 125),
      life,
      maxLife: life,
      size: randRange(3.4, 5.2) * Math.min(1.35, Math.sqrt(scale)),
    });
  }
  pushParticleBurst(x, y, palette.sparkColor, particles);

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

  const particles = [];
  for (let i = 0; i < scaleFxCount(5); i += 1) {
    const angle = (i / 5) * Math.PI * 2 + randRange(-0.22, 0.22);
    const life = randRange(0.16, 0.24);
    particles.push({
      x,
      y,
      vx: Math.cos(angle) * randRange(18, 54),
      vy: Math.sin(angle) * randRange(18, 54) - 12,
      life,
      maxLife: life,
      size: randRange(2, 3.2),
    });
  }
  pushParticleBurst(x, y, glowColor, particles);
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
    kind: "skill-accent",
    x,
    y,
    life: 0.22,
    maxLife: 0.22,
    size: 6,
    growth: 28,
    lineWidth: 2.6,
    color: palette.ringColor,
    secondaryColor: palette.sparkColor,
    tertiaryColor: palette.lineColor,
    lightColor: palette.emberColor,
    renderLayer: "top",
    sparks: Array.from({ length: 8 }, (_, i) => ({
      angle: (i / 8) * Math.PI * 2 + randRange(-0.16, 0.16),
      reach: randRange(16, 34),
      size: randRange(2.2, 4.2),
    })),
    rays: Array.from({ length: 4 }, (_, i) => ({
      angle: (i / 4) * Math.PI * 2 + randRange(-0.2, 0.2),
      reach: randRange(18, 42),
      lineWidth: randRange(2.6, 4.2),
    })),
    embers: Array.from({ length: 4 }, () => ({
      offsetX: randRange(-6, 6),
      offsetY: randRange(-6, 6),
      driftX: randRange(-26, 26),
      rise: randRange(28, 82),
      size: randRange(2.6, 4.4),
    })),
  });
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

  const particles = [];
  for (let i = 0; i < scaleFxCount(amount); i += 1) {
    const angle = (i / Math.max(1, amount)) * Math.PI * 2 + randRange(-0.35, 0.35);
    const speed = randRange(40, 118);
    const life = randRange(0.1, 0.18);
    particles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life,
      maxLife: life,
      size: randRange(1.8, 3.2),
    });
  }
  pushParticleBurst(x, y, color, particles);
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

  const particles = [];
  for (let i = 0; i < scaleFxCount(4); i += 1) {
    const spreadX = dirX * randRange(40, 120) + randRange(-90, 90);
    const spreadY = dirY * randRange(40, 120) + randRange(-90, 90);
    const life = randRange(0.14, 0.26);
    particles.push({
      x: x + randRange(-3, 3),
      y: y + randRange(-3, 3),
      vx: spreadX,
      vy: spreadY,
      life,
      maxLife: life,
      size: randRange(2.4, 4.8),
    });
  }
  pushParticleBurst(x, y, color, particles);
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

  const particles = [];
  for (let i = 0; i < scaleFxCount(6); i += 1) {
    const angle = (i / 6) * Math.PI * 2 + randRange(-0.28, 0.28);
    const speed = randRange(70, 160);
    const life = randRange(0.26, 0.4);
    particles.push({
      x: enemy.x,
      y: enemy.y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life,
      maxLife: life,
      size: randRange(2.6, 5.8),
    });
  }
  pushParticleBurst(enemy.x, enemy.y, color, particles);
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
  const particles = [];
  for (let i = 0; i < 8; i += 1) {
    const angle = (i / 8) * Math.PI * 2 + randRange(-0.25, 0.25);
    const speed = randRange(90, 180);
    const life = randRange(0.18, 0.34);
    particles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life,
      maxLife: life,
      size: randRange(3, 5.8),
    });
  }
  pushParticleBurst(x, y, color, particles);
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
    color,
    hostile: true,
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
    color,
    hostile: true,
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
    color: BOSS_THEME_COLORS[enemy.type] ?? HOSTILE_ARCANE_COLOR,
    hostile: true,
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
    color,
    lineWidth: thickness,
    size: 12,
    hostile: true,
  });
}

function spawnEnemyBolt(enemy, targetX, targetY, spec) {
  const dx = targetX - enemy.x;
  const dy = targetY - enemy.y;
  const distance = Math.hypot(dx, dy) || 1;
  const color = spec.color ?? ENEMY_PROJECTILE_COLOR;
  state.enemyAttacks.push({
    kind: "projectile",
    x: enemy.x,
    y: enemy.y,
    vx: (dx / distance) * spec.speed,
    vy: (dy / distance) * spec.speed,
    radius: spec.radius,
    damage: spec.damage,
    color,
    rgb: (() => {
      const parsed = parseColorComponents(color.includes("{a}") ? color.replace("{a}", "1") : color);
      return `${parsed.r}, ${parsed.g}, ${parsed.b}`;
    })(),
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
      color: color ?? ENEMY_PROJECTILE_COLOR,
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
      color: color ?? ENEMY_PROJECTILE_COLOR,
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

function spawnBossMinions(enemy, roster, options = {}) {
  for (let i = 0; i < roster.length; i += 1) {
    if (state.enemies.length >= state.spawnDirector.maxEnemiesOnField) {
      return;
    }
    const minion = createEnemy(
      roster[i],
      { x: enemy.x, y: enemy.y },
      i,
      roster.length,
      {
        spawnDistanceMin: options.minDistance ?? 16,
        spawnDistanceMax: options.maxDistance ?? 56,
      }
    );
    minion.noSeparationTimer = Math.max(minion.noSeparationTimer ?? 0, options.noSeparationTimer ?? 0);
    state.enemies.push(minion);
  }
}

function damagePlayer(rawDamage, source = null) {
  if (rawDamage <= 0 || !state.running) {
    return;
  }

  const player = state.player;
  if (player.dash.iFramesTimer > 0 || state.dev.playerInvulnerable) {
    return;
  }

  const reducedDamage = rawDamage * (1 - player.damageReduction);
  window.sfx?.play("damage");
  const perfTier = getPerformanceTier();
  const shakeScale = perfTier >= 3 ? 0 : perfTier >= 2 ? 0.4 : perfTier >= 1 ? 0.68 : 1;
  trackArchiveEvent("damage_taken", { amount: reducedDamage, sourceKey: source?.key ?? null });
  recordTelemetryDamage(rawDamage, reducedDamage, source);
  player.hitFlash = clamp(player.hitFlash + reducedDamage / player.maxHp, 0, 1);
  player.hitShakeTimer = Math.max(player.hitShakeTimer, 0.22 * shakeScale);
  player.hitShakePower = Math.max(player.hitShakePower, (3.6 + reducedDamage * 0.2) * shakeScale);
  state.hudMotion.playerBarShakeTimer = 0.24;
  state.cameraShake.timer = Math.max(state.cameraShake.timer, 0.2 * shakeScale);
  state.cameraShake.power = Math.max(state.cameraShake.power, (5.4 + reducedDamage * 0.24) * shakeScale);
  if (perfTier < 3) {
    spawnPlayerDamageEffect(player.x, player.y, reducedDamage / Math.max(8, player.maxHp));
  }

  if (state.dev.zenMode) {
    player.hp = player.maxHp;
    requestHudRefresh(false);
    return;
  }

  player.hp = Math.max(0, player.hp - reducedDamage);
  requestHudRefresh(false);
  if (player.hp <= 0) {
    endRun();
  }
}

function cellKey(x, y) {
  return (x + 4096) * 8192 + (y + 4096);
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
  const cacheKey = buildQueryKey("nearest-list", state.player.x, state.player.y, limit, limit);
  const queryCache = getFrameQueryCache();
  if (queryCache.has(cacheKey)) {
    return queryCache.get(cacheKey);
  }

  const nearest = [];
  const searchRadius = Math.max(viewWidth, viewHeight) * 1.6;
  visitEnemiesInRange(state.player.x, state.player.y, searchRadius, (enemy) => {
    const dx = enemy.x - state.player.x;
    const dy = enemy.y - state.player.y;
    const distanceSq = dx * dx + dy * dy;

    if (nearest.length < limit) {
      nearest.push({ enemy, distanceSq });
      nearest.sort((a, b) => a.distanceSq - b.distanceSq);
      return;
    }

    if (distanceSq >= nearest[nearest.length - 1].distanceSq) {
      return;
    }

    nearest[nearest.length - 1] = { enemy, distanceSq };
    nearest.sort((a, b) => a.distanceSq - b.distanceSq);
  });

  const result = nearest.map((entry) => entry.enemy);
  queryCache.set(cacheKey, result);
  return result;
}

