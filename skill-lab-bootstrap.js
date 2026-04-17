const LAB_CLASS_ORDER = ["wind", "frost", "fire", "necro", "blood"];
const LAB_QUERY = new URLSearchParams(window.location.search);
const LAB_DEFAULT_CLASS = LAB_QUERY.get("mage") || "wind";
const LAB_AUTO_CAST_SLOTS = (LAB_QUERY.get("casts") || "")
  .split(",")
  .map((value) => Number(value.trim()))
  .filter((value) => Number.isFinite(value) && value >= 1 && value <= 3);

function spawnPracticeDummy() {
  window.debug_game.setPlayerPosition(0, 0);
  window.debug_game.spawnTrainingDummy(240, 0);
}

function bootPracticeLabFor(classId) {
  window.debug_game.unlockAllClasses();
  window.debug_game.selectClass(classId);
  window.debug_game.startRun();
  window.debug_game.setSpawningEnabled(false);
  window.debug_game.setZenMode(true);
  window.debug_game.setPlayerInvulnerable(true);
  window.debug_game.setManualSkillMode(true);
  window.debug_game.setSkillLabZeroCooldown(true);
  window.debug_game.unlockAllCurrentSkills();
  window.debug_game.clearEnemies();
  spawnPracticeDummy();

  if (LAB_AUTO_CAST_SLOTS.length > 0) {
    window.setTimeout(() => {
      for (const slot of LAB_AUTO_CAST_SLOTS) {
        window.debug_game.triggerSkill(slot);
      }
    }, 240);
  }
}

function bindPracticeLab() {
  if (!window.debug_game) {
    window.setTimeout(bindPracticeLab, 60);
    return;
  }

  window.addEventListener("keydown", (event) => {
    if (event.code === "Digit1") {
      window.debug_game.triggerSkill(1);
    } else if (event.code === "Digit2") {
      window.debug_game.triggerSkill(2);
    } else if (event.code === "Digit3") {
      window.debug_game.triggerSkill(3);
    } else if (event.code === "KeyR") {
      spawnPracticeDummy();
    } else {
      return;
    }
    event.preventDefault();
  });

  const classId = LAB_CLASS_ORDER.includes(LAB_DEFAULT_CLASS) ? LAB_DEFAULT_CLASS : "wind";
  bootPracticeLabFor(classId);
}

bindPracticeLab();
