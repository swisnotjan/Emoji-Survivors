// Vibe Jam 2026 webring portal — exit portal each run + optional return portal if player came from another game.

const PORTAL_COLLISION_RADIUS = 58;
const PORTAL_VISUAL_OUTER = 72;
const PORTAL_SPAWN_MIN = 2400;
const PORTAL_SPAWN_MAX = 3400;
const PORTAL_RETURN_DIST = 500;
const PORTAL_DEST = "https://vibej.am/portal/2026";

function initPortal() {
  const params = new URLSearchParams(window.location.search);
  const refUrl = params.get("ref") || null;

  const exitPos = findPortalSpawnPosition(PORTAL_SPAWN_MIN, PORTAL_SPAWN_MAX);

  let returnPos = null;
  if (refUrl) {
    returnPos = findPortalSpawnPosition(PORTAL_RETURN_DIST - 80, PORTAL_RETURN_DIST + 120);
  }

  state.portal = {
    x: exitPos.x,
    y: exitPos.y,
    t: Math.random() * Math.PI * 2,
    entered: false,
    refUrl,
    returnX: returnPos?.x ?? null,
    returnY: returnPos?.y ?? null,
    returnEntered: false,
  };
}

function findPortalSpawnPosition(minDist, maxDist) {
  const angle = Math.random() * Math.PI * 2;
  const dist = minDist + Math.random() * (maxDist - minDist);
  const cx = Math.cos(angle) * dist;
  const cy = Math.sin(angle) * dist;
  return findNearbyWalkablePoint(cx, cy, PORTAL_COLLISION_RADIUS, 400);
}

function updatePortal(dt) {
  const portal = state.portal;
  if (!portal || portal.entered) return;

  portal.t += dt;

  const player = state.player;
  const dx = player.x - portal.x;
  const dy = player.y - portal.y;

  if (Math.hypot(dx, dy) < PORTAL_COLLISION_RADIUS + player.radius) {
    portal.entered = true;
    redirectToPortal(PORTAL_DEST);
    return;
  }

  if (portal.refUrl && !portal.returnEntered && portal.returnX != null) {
    const rdx = player.x - portal.returnX;
    const rdy = player.y - portal.returnY;
    if (Math.hypot(rdx, rdy) < PORTAL_COLLISION_RADIUS + player.radius) {
      portal.returnEntered = true;
      redirectToPortal(portal.refUrl);
    }
  }
}

function redirectToPortal(base) {
  const player = state.player;
  const params = new URLSearchParams();
  params.set("ref", window.location.href.split("?")[0]);
  params.set("speed", ((player.speed * (player.speedMultiplier ?? 1)) / 100).toFixed(1));
  params.set("hp", String(Math.round((player.hp / Math.max(1, player.maxHp)) * 100)));
  if (player.classColor) params.set("color", player.classColor);
  window.location.href = `${base}?${params}`;
}

function drawPortal() {
  const portal = state.portal;
  if (!portal) return;
  drawSinglePortal(portal.x, portal.y, portal.t, false);
  if (portal.refUrl && portal.returnX != null) {
    drawSinglePortal(portal.returnX, portal.returnY, portal.t, true);
  }
}

function drawSinglePortal(worldX, worldY, t, isReturn) {
  const pos = worldToScreen(worldX, worldY);
  if (!isVisible(pos.x, pos.y, 140)) return;

  const cx = pos.x;
  const cy = pos.y;
  const pulse = 0.5 + 0.5 * Math.sin(t * 2.1);

  ctx.save();

  // Ground shadow oval
  ctx.globalAlpha = 0.38;
  ctx.fillStyle = "rgba(0, 8, 40, 0.6)";
  ctx.beginPath();
  ctx.ellipse(cx, cy + 70, 46, 13, 0, 0, Math.PI * 2);
  ctx.fill();

  // Outer atmospheric glow — layered arcs (no shadowBlur)
  for (let i = 5; i >= 0; i--) {
    const r = PORTAL_VISUAL_OUTER + i * 9;
    const alpha = (0.055 - i * 0.008) * (0.7 + pulse * 0.3);
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = "rgba(60, 160, 255, 1)";
    ctx.lineWidth = 8 + i * 5;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Outer rotating dashed ring
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(t * 0.55);
  ctx.globalAlpha = 0.85;
  ctx.strokeStyle = "rgba(100, 195, 255, 0.92)";
  ctx.lineWidth = 3.5;
  ctx.setLineDash([20, 11]);
  ctx.beginPath();
  ctx.arc(0, 0, PORTAL_VISUAL_OUTER, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();

  // Inner rotating dashed ring (opposite dir)
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(-t * 1.05);
  ctx.globalAlpha = 0.62;
  ctx.strokeStyle = "rgba(150, 215, 255, 0.85)";
  ctx.lineWidth = 2.5;
  ctx.setLineDash([12, 16]);
  ctx.beginPath();
  ctx.arc(0, 0, 54, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();

  // Inner disc — concentric fills simulate bloom
  const discLayers = [
    [62, `rgba(0,  35, 110, 0.88)`],
    [52, `rgba(0,  55, 150, 0.78)`],
    [40, `rgba(15, 95, 195, ${0.65 + pulse * 0.14})`],
    [28, `rgba(60, 148, 240, ${0.58 + pulse * 0.18})`],
    [16, `rgba(130, 205, 255, ${0.68 + pulse * 0.16})`],
    [7,  `rgba(210, 238, 255, ${0.82 + pulse * 0.12})`],
  ];
  ctx.globalAlpha = 1;
  for (const [r, color] of discLayers) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // Orbiting dots (outer ring)
  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2 + t * 1.35;
    const px = cx + Math.cos(angle) * 59;
    const py = cy + Math.sin(angle) * 59;
    ctx.globalAlpha = 0.58 + 0.4 * Math.sin(t * 3.1 + i * 0.9);
    ctx.fillStyle = "rgba(175, 228, 255, 0.95)";
    ctx.beginPath();
    ctx.arc(px, py, 3.6, 0, Math.PI * 2);
    ctx.fill();
  }

  // Inner sparkle dots (faster, counter-rotate)
  for (let i = 0; i < 5; i++) {
    const angle = (i / 5) * Math.PI * 2 - t * 2.15;
    const px = cx + Math.cos(angle) * 29;
    const py = cy + Math.sin(angle) * 29;
    ctx.globalAlpha = 0.38 + 0.52 * Math.sin(t * 4.2 + i * 1.8);
    ctx.fillStyle = "rgba(220, 245, 255, 0.92)";
    ctx.beginPath();
    ctx.arc(px, py, 2.6, 0, Math.PI * 2);
    ctx.fill();
  }

  // Floating label with levitation bob
  const labelText = isReturn ? "Return Portal" : "Vibe Jam Portal";
  const labelY = cy - 95 - Math.sin(t * 1.75) * 6;

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = 'bold 13px "Silkscreen", monospace';

  // Cheap text shadow — draw dark copy at small offsets
  ctx.globalAlpha = 0.55;
  ctx.fillStyle = "rgba(0, 15, 70, 1)";
  const shadowOffsets = [[-2, -1], [2, -1], [-1, 2], [1, 2], [0, 2]];
  for (const [ox, oy] of shadowOffsets) {
    ctx.fillText(labelText, cx + ox, labelY + oy);
  }

  ctx.globalAlpha = 1;
  ctx.fillStyle = "rgba(205, 238, 255, 1)";
  ctx.fillText(labelText, cx, labelY);

  // Small portal icon dots above label
  const iconY = labelY - 18;
  for (let i = 0; i < 3; i++) {
    const dotX = cx + (i - 1) * 10;
    const dotAlpha = 0.5 + 0.4 * Math.sin(t * 2.5 + i * 1.2);
    ctx.globalAlpha = dotAlpha;
    ctx.fillStyle = "rgba(140, 210, 255, 1)";
    ctx.beginPath();
    ctx.arc(dotX, iconY, 3, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}
