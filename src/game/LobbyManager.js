import { GAME_CONFIG } from './config.js';
import { getBuffaloTemplate } from './GameConfig.js';

// Safe isometric yard waypoints inside the bamboo fence of wait_91ecae59.png (1280x720)
const YARD_POLYGON = [
  { x: 300, y: 455 },
  { x: 470, y: 365 },
  { x: 645, y: 360 },
  { x: 775, y: 435 },
  { x: 750, y: 545 },
  { x: 560, y: 598 },
  { x: 355, y: 550 },
];

const SPAWN_SLOTS = [
  { x: 470, y: 445, targetX: 545, targetY: 465, facingRight: true, state: 'ROAM', timer: 2.2 },
  { x: 655, y: 425, targetX: 655, targetY: 425, facingRight: false, state: 'REST', timer: 3.4 },
  { x: 420, y: 530, targetX: 515, targetY: 540, facingRight: true, state: 'ROAM', timer: 2.8 },
  { x: 585, y: 515, targetX: 500, targetY: 485, facingRight: false, state: 'ROAM', timer: 3.1 },
];

const LANTERN_SPOTS = [
  { x: 72, y: 325, r: 58 },
  { x: 583, y: 114, r: 66 },
  { x: 700, y: 156, r: 64 },
  { x: 831, y: 204, r: 64 },
  { x: 956, y: 247, r: 64 },
  { x: 1156, y: 248, r: 58 },
];

function pointInPolygon(px, py, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i].x;
    const yi = poly[i].y;
    const xj = poly[j].x;
    const yj = poly[j].y;
    const intersect =
      yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi + 0.0001) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

function randomYardPoint() {
  for (let tries = 0; tries < 25; tries++) {
    const x = 310 + Math.random() * 450;
    const y = 368 + Math.random() * 220;
    if (pointInPolygon(x, y, YARD_POLYGON)) {
      return { x, y };
    }
  }
  return { x: 535, y: 468 };
}

export class LobbyManager {
  constructor(soundManager) {
    this.soundManager = soundManager;
    this.time = 0;
    this.selectedBuffaloId = 'buffalo_hac_phong';
    this.buffaloes = [];

    this.fireflies = Array.from({ length: 18 }, () => ({
      x: 120 + Math.random() * 1040,
      y: 120 + Math.random() * 520,
      vx: (Math.random() - 0.5) * 14,
      vy: -6 - Math.random() * 12,
      r: 1.6 + Math.random() * 2.2,
      phase: Math.random() * Math.PI * 2,
    }));

    this.floatingNotes = [];
  }

  syncOwnedBuffaloes(ownedBuffaloes, selectedBuffaloId) {
    this.selectedBuffaloId = selectedBuffaloId || 'buffalo_hac_phong';
    const existingById = new Map(this.buffaloes.map((b) => [b.id, b]));
    const nextList = [];

    (ownedBuffaloes || []).forEach((owned, idx) => {
      const tpl = getBuffaloTemplate(owned.id);
      const prev = existingById.get(owned.id);
      if (prev) {
        prev.level = owned.level || 1;
        prev.skillLevel = owned.skillLevel || 1;
        prev.scale = tpl.visualScale || 1.0;
        nextList.push(prev);
      } else {
        const slot = SPAWN_SLOTS[idx % SPAWN_SLOTS.length] || randomYardPoint();
        const pt = idx === 0 ? slot : randomYardPoint();
        const isFirstBoot = this.buffaloes.length === 0;
        nextList.push({
          id: tpl.id,
          name: tpl.name,
          level: owned.level || 1,
          skillLevel: owned.skillLevel || 1,
          spriteRow: tpl.spriteRow,
          poseIdx: tpl.id === 'buffalo_hac_phong' ? 1 : 0,
          x: slot.x || pt.x,
          y: slot.y || pt.y,
          targetX: slot.targetX || pt.x,
          targetY: slot.targetY || pt.y,
          facingRight: slot.facingRight !== undefined ? slot.facingRight : true,
          state: slot.state || 'ROAM',
          timer: slot.timer || 2.4,
          scale: tpl.visualScale || 1.0,
          hopTimer: isFirstBoot ? 0 : 0.55,
          bodyColor: tpl.bodyColor,
          accentColor: tpl.accentColor,
          phase: idx * 1.9,
        });
        if (!isFirstBoot) {
          this.floatingNotes.push({
            x: slot.x || pt.x,
            y: (slot.y || pt.y) - 50,
            text: `${tpl.name} nhập trại!`,
            color: '#fde047',
            life: 1.8,
            maxLife: 1.8,
          });
        }
      }
    });

    this.buffaloes = nextList;
  }

  handleClick(canvasX, canvasY) {
    for (const b of this.buffaloes) {
      const dist = Math.hypot(canvasX - b.x, canvasY - b.y);
      if (dist <= 56) {
        b.hopTimer = 0.42;
        this.soundManager.playTone(190, 130, 0.16, 'triangle', 0.18);
        this.floatingNotes.push({
          x: b.x,
          y: b.y - 46,
          text: `${b.name} ♥`,
          color: '#fde047',
          life: 1.15,
          maxLife: 1.15,
        });
        return true;
      }
    }
    return false;
  }

  update(dt) {
    this.time += dt;

    // Gentle roaming & peaceful resting state machine
    for (let i = 0; i < this.buffaloes.length; i++) {
      const b = this.buffaloes[i];
      if (b.hopTimer > 0) {
        b.hopTimer = Math.max(0, b.hopTimer - dt);
      }

      b.timer -= dt;
      if (b.state === 'ROAM') {
        const dx = b.targetX - b.x;
        const dy = b.targetY - b.y;
        const dist = Math.hypot(dx, dy);

        if (dist > 6) {
          const speed = 26;
          const step = Math.min(dist, speed * dt);
          b.x += (dx / dist) * step;
          b.y += (dy / dist) * step;
          if (Math.abs(dx) > 1.5) {
            b.facingRight = dx >= 0;
          }
        } else {
          b.state = 'REST';
          b.timer = 2.6 + Math.random() * 3.4;
        }

        if (b.timer <= 0) {
          b.state = 'REST';
          b.timer = 2.4 + Math.random() * 3.0;
        }
      } else {
        if (b.timer <= 0) {
          // Pick a new waypoint well spaced from the other 2 buffaloes
          let best = randomYardPoint();
          for (let attempt = 0; attempt < 8; attempt++) {
            const cand = randomYardPoint();
            const clear = this.buffaloes.every(
              (other, idx) => idx === i || Math.hypot(cand.x - other.x, cand.y - other.y) > 92
            );
            if (clear) {
              best = cand;
              break;
            }
          }
          b.targetX = best.x;
          b.targetY = best.y;
          b.state = 'ROAM';
          b.timer = 4.5 + Math.random() * 3.5;
        }
      }
    }

    // Soft separation so two buffaloes never stack on top of each other
    for (let i = 0; i < this.buffaloes.length; i++) {
      for (let j = i + 1; j < this.buffaloes.length; j++) {
        const a = this.buffaloes[i];
        const b = this.buffaloes[j];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const d = Math.hypot(dx, dy) || 0.01;
        const minSep = 74;
        if (d < minSep) {
          const push = (minSep - d) * 0.45 * dt * 5;
          a.x -= (dx / d) * push;
          a.y -= (dy / d) * push;
          b.x += (dx / d) * push;
          b.y += (dy / d) * push;
        }
      }
    }

    // Update ambient warm fireflies
    for (const f of this.fireflies) {
      f.x += (f.vx + Math.sin(this.time * 1.6 + f.phase) * 8) * dt;
      f.y += f.vy * dt;
      if (f.y < 60) {
        f.y = 660;
        f.x = 120 + Math.random() * 1040;
      }
      if (f.x < 40) f.x = 1240;
      if (f.x > 1240) f.x = 40;
    }

    for (let i = this.floatingNotes.length - 1; i >= 0; i--) {
      const n = this.floatingNotes[i];
      n.y -= 28 * dt;
      n.life -= dt;
      if (n.life <= 0) this.floatingNotes.splice(i, 1);
    }
  }

  render(ctx, assets, hornCfg) {
    const W = GAME_CONFIG.CANVAS_WIDTH;
    const H = GAME_CONFIG.CANVAS_HEIGHT;

    ctx.clearRect(0, 0, W, H);

    // 1. Isometric Ngưu Trại Hắc Phong background
    if (assets && assets.hasLobby && assets.lobbyImage) {
      ctx.drawImage(assets.lobbyImage, 0, 0, W, H);
    } else {
      const grad = ctx.createLinearGradient(0, 0, 0, H);
      grad.addColorStop(0, '#3b2416');
      grad.addColorStop(0.55, '#59422b');
      grad.addColorStop(1, '#261710');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, W, H);
    }

    // 2. Warm flickering lantern halos
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    for (let i = 0; i < LANTERN_SPOTS.length; i++) {
      const spot = LANTERN_SPOTS[i];
      const pulse = 0.85 + 0.15 * Math.sin(this.time * 3.8 + i * 1.3);
      const rad = spot.r * pulse;
      const g = ctx.createRadialGradient(spot.x, spot.y, 4, spot.x, spot.y, rad);
      g.addColorStop(0, 'rgba(255, 196, 86, 0.42)');
      g.addColorStop(0.55, 'rgba(234, 88, 12, 0.16)');
      g.addColorStop(1, 'rgba(234, 88, 12, 0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(spot.x, spot.y, rad, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // 3. Render owned water buffaloes sorted by depth (Y)
    const sorted = [...this.buffaloes].sort((a, b) => a.y - b.y);
    for (const b of sorted) {
      const isSelected = b.id === this.selectedBuffaloId;
      this.renderLobbyBuffalo(ctx, b, assets, isSelected ? hornCfg : null, isSelected);
    }

    // 4. Floating warm golden firefly motes
    ctx.save();
    for (const f of this.fireflies) {
      const alpha = 0.25 + 0.55 * (0.5 + 0.5 * Math.sin(this.time * 3 + f.phase));
      ctx.fillStyle = `rgba(253, 224, 71, ${alpha})`;
      ctx.beginPath();
      ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // 5. Affection floating notes when user clicks a buffalo
    for (const n of this.floatingNotes) {
      const alpha = Math.min(1, (n.life / n.maxLife) * 1.4);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.font = '800 16px "Bricolage Grotesque", sans-serif';
      ctx.textAlign = 'center';
      ctx.lineWidth = 4;
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.85)';
      ctx.strokeText(n.text, n.x, n.y);
      ctx.fillStyle = n.color;
      ctx.fillText(n.text, n.x, n.y);
      ctx.restore();
    }
  }

  renderLobbyBuffalo(ctx, b, assets, hornCfg, isSelected) {
    const isRoaming = b.state === 'ROAM';
    const walkBob = isRoaming ? Math.abs(Math.sin(this.time * 6.5 + b.phase)) * 3.5 : 0;
    const breathScale = 1 + Math.sin(this.time * 2.4 + b.phase) * 0.018;
    const hopLift = b.hopTimer > 0 ? Math.sin((b.hopTimer / 0.42) * Math.PI) * 18 : 0;

    ctx.save();

    // Golden pedestal ring under currently selected buffalo
    if (isSelected) {
      const pulse = 0.85 + 0.15 * Math.sin(this.time * 4);
      ctx.strokeStyle = `rgba(253, 224, 71, ${0.72 * pulse})`;
      ctx.lineWidth = 2.5;
      ctx.setLineDash([7, 5]);
      ctx.beginPath();
      ctx.ellipse(b.x, b.y + 18, 44 * b.scale, 20 * b.scale, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Soft isometric ground shadow
    ctx.fillStyle = 'rgba(12, 7, 5, 0.42)';
    ctx.beginPath();
    ctx.ellipse(b.x, b.y + 18, 36 * b.scale, 16 * b.scale, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.translate(b.x, b.y - walkBob - hopLift);
    const frame = assets ? assets.getBuffaloFrame(b.spriteRow, b.poseIdx) : null;

    ctx.save();
    if (!b.facingRight) {
      ctx.scale(-1, 1);
    }
    ctx.scale(b.scale * breathScale, b.scale * (2 - breathScale));

    if (frame && frame.canvas) {
      ctx.drawImage(frame.canvas, -48, -48, 96, 96);
    } else {
      // Crisp isometric fallback silhouette
      ctx.fillStyle = b.bodyColor;
      ctx.strokeStyle = '#0f0907';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.ellipse(0, 4, 30, 18, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.beginPath();
      ctx.ellipse(24, -2, 13, 11, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      if (b.id === 'buffalo_hac_phong') {
        ctx.fillStyle = '#dc2626';
        ctx.fillRect(10, -8, 8, 16);
      }
    }
    ctx.restore();

    // Equipped horn aura hint on selected buffalo if custom horn equipped
    if (hornCfg && hornCfg.id !== 'horn_default') {
      ctx.save();
      ctx.strokeStyle = hornCfg.color;
      ctx.shadowColor = hornCfg.glow;
      ctx.shadowBlur = 8;
      ctx.lineWidth = 2;
      const hx = b.facingRight ? 26 : -26;
      ctx.beginPath();
      ctx.arc(hx, -10, 6, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // Subtle peaceful resting or selected indicator
    if (!isRoaming && b.hopTimer <= 0) {
      const floatY = -42 + Math.sin(this.time * 2 + b.phase) * 3;
      ctx.font = '700 11px "Plus Jakarta Sans", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = isSelected ? '#fde047' : 'rgba(253, 230, 138, 0.78)';
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.75)';
      ctx.lineWidth = 2.5;
      const label = isSelected
        ? `★ ${b.name} (Lv.${b.level || 1})`
        : Math.sin(this.time * 0.7 + b.phase) > 0.25
          ? 'Zzz'
          : b.name;
      ctx.strokeText(label, 0, floatY);
      ctx.fillText(label, 0, floatY);
    }

    ctx.restore();
  }
}
