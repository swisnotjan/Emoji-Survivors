const LAB_CLASS_ORDER = ["wind", "frost", "fire", "necro", "blood"];
const LAB_QUERY = new URLSearchParams(window.location.search);
const LAB_DEFAULT_CLASS = LAB_QUERY.get("mage") || "wind";
const LAB_AUTO_CAST_SLOTS = (LAB_QUERY.get("casts") || "")
  .split(",")
  .map((value) => Number(value.trim()))
  .filter((value) => Number.isFinite(value) && value >= 1 && value <= 3);
const LAB_CLASS_LABELS = {
  wind: "🧝🏻‍♂️ Wind",
  frost: "🧙🏻‍♂️ Frost",
  fire: "🫅🏻 Fire",
  necro: "🧝🏿 Necro",
  blood: "🧛🏻 Blood",
};

function updateSkillLabStatus() {
  const status = document.getElementById("skillLabStatus");
  if (!status || !window.debug_game) {
    return;
  }
  const snapshot = window.debug_game.snapshot();
  status.textContent = `${snapshot.class.title} | level ${snapshot.level} | enemies ${snapshot.enemiesOnField} | manual casts | zero cd`;
}

function spawnLabDummy() {
  window.debug_game.setPlayerPosition(0, 0);
  window.debug_game.spawnTrainingDummy(240, 0);
  const status = document.getElementById("skillLabStatus");
  const snapshot = window.debug_game.snapshot();
  if (status) {
    status.textContent = `${snapshot.class.title} | level ${snapshot.level} | enemies ${snapshot.enemiesOnField} | manual casts`;
  }
}

function bootSkillLabFor(classId) {
  const status = document.getElementById("skillLabStatus");
  if (status) {
    status.textContent = `Loading ${classId} lab...`;
  }
  window.debug_game.unlockAllClasses();
  window.debug_game.selectClass(classId);
  window.debug_game.startRun();
  window.debug_game.setSpawningEnabled(false);
  window.debug_game.setZenMode(true);
  window.debug_game.setManualSkillMode(true);
  window.debug_game.setSkillLabZeroCooldown(true);
  window.debug_game.unlockAllCurrentSkills();
  window.debug_game.clearEnemies();
  spawnLabDummy();
  if (LAB_AUTO_CAST_SLOTS.length > 0) {
    window.setTimeout(() => {
      for (const slot of LAB_AUTO_CAST_SLOTS) {
        window.debug_game.triggerSkill(slot);
      }
      updateSkillLabStatus();
    }, 240);
  }
  if (status) {
    status.textContent = `${CLASS_DEFS_LABEL(classId)} ready | dummy active`;
  }
}

function CLASS_DEFS_LABEL(classId) {
  return LAB_CLASS_LABELS[classId] ?? `${classId[0].toUpperCase() + classId.slice(1)}`;
}

function bindSkillLab() {
  if (!window.debug_game) {
    window.setTimeout(bindSkillLab, 60);
    return;
  }

  const classButtons = document.getElementById("skillLabClassButtons");
  for (const classId of LAB_CLASS_ORDER) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "dev-button";
    button.textContent = CLASS_DEFS_LABEL(classId);
    button.addEventListener("click", () => bootSkillLabFor(classId));
    classButtons.appendChild(button);
  }

  document.getElementById("skillLabSpawnDummy")?.addEventListener("click", spawnLabDummy);
  document.getElementById("skillLabLevelUp")?.addEventListener("click", () => {
    window.debug_game.gainLevel(1);
    updateSkillLabStatus();
  });
  document.getElementById("skillLabResetDummy")?.addEventListener("click", () => {
    bootSkillLabFor(window.debug_game.snapshot().class.id);
  });

  window.addEventListener("keydown", (event) => {
    if (event.code === "Digit1") {
      window.debug_game.triggerSkill(1);
    } else if (event.code === "Digit2") {
      window.debug_game.triggerSkill(2);
    } else if (event.code === "Digit3") {
      window.debug_game.triggerSkill(3);
    } else {
      return;
    }
    event.preventDefault();
  });

  bootSkillLabFor(LAB_CLASS_ORDER.includes(LAB_DEFAULT_CLASS) ? LAB_DEFAULT_CLASS : "wind");
  window.setInterval(updateSkillLabStatus, 250);
}

bindSkillLab();

