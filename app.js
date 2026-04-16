// Bootstrap entrypoint for the split browser game scripts.
metaProgress = loadMetaProgress();
telemetryStore = loadTelemetryStore();
state = createInitialState(metaProgress.selectedClassId);
previousTime = performance.now() / 1000;
accumulator = 0;
deterministicSteppingEnabled = false;

resizeCanvas();
bindEvents();
populateBossSpawnSelect();
renderStartOverlay();
updateHud(true);
requestAnimationFrame(gameLoop);
