// Bootstrap entrypoint for the split browser game scripts.
function shouldBlockGameplay() {
  const ua = navigator.userAgent || "";
  const platform = navigator.platform || "";
  const uaDataMobile = navigator.userAgentData?.mobile === true;
  const touchPoints = navigator.maxTouchPoints || 0;
  const mobileTabletUa = /Android|iPhone|iPad|iPod|Mobile|Tablet|Silk|Kindle|PlayBook/i.test(ua);
  // Block by viewport size (browser window), not physical monitor size.
  const viewportWidth = window.innerWidth || document.documentElement.clientWidth || 0;
  const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0;
  const shortestSide = Math.min(viewportWidth, viewportHeight);
  const narrowScreen = shortestSide <= 920;
  const touchCapableMac = platform === "MacIntel" && touchPoints > 1 && shortestSide <= 1024;
  return uaDataMobile || mobileTabletUa || touchCapableMac || narrowScreen;
}

function applyGameplayAccessGate() {
  const blocked = shouldBlockGameplay();
  const startOverlay = document.getElementById("startOverlay");
  const mobileBlockOverlay = document.getElementById("mobileBlockOverlay");
  if (blocked) {
    if (typeof state !== "undefined" && state?.running && typeof setPause === "function") {
      setPause("manual", true);
    }
    startOverlay?.classList.add("hidden");
    mobileBlockOverlay?.classList.remove("hidden");
    return true;
  }
  mobileBlockOverlay?.classList.add("hidden");
  if (typeof state !== "undefined" && state && typeof renderStartOverlay === "function") {
    if (!state.running) {
      renderStartOverlay();
    }
  } else {
    startOverlay?.classList.remove("hidden");
  }
  return false;
}

function bootstrapGame() {
  initWin11EmojiAtlas?.();
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
}

let gameBootstrapped = false;
if (!applyGameplayAccessGate()) {
  bootstrapGame();
  gameBootstrapped = true;
}

window.addEventListener("resize", () => {
  const blocked = applyGameplayAccessGate();
  if (!blocked && !gameBootstrapped) {
    bootstrapGame();
    gameBootstrapped = true;
    return;
  }
  if (!blocked && gameBootstrapped && typeof state !== "undefined" && state && !state.running && typeof renderStartOverlay === "function") {
    renderStartOverlay();
  }
});
