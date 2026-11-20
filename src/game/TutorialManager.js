import { GAME_CONFIG } from './config.js';
import { BuffaloEntity } from './BuffaloEntity.js';

export const TUTORIAL_STEPS = [
  {
    step: 1,
    title: 'Bước 1 · Đánh Theo Nhịp Trống Hội (100 BPM)',
    dialogue:
      'Chào mừng tới Sới Tập Khai Hội! Hai trâu tự động tiến vào sới đấu. Quan sát vòng tròn ánh sáng thu nhỏ dưới chân và nhấn [Phím J / Nút Đánh] ngay khoảnh khắc vòng sáng chạm viền trống!',
    targetTotal: 3,
    highlightTarget: 'HUC',
  },
  {
    step: 2,
    title: 'Bước 2 · Tuyệt Kỹ Móc Cống Khắc Chế Hổ Lao',
    dialogue:
      'Cẩn thận, đối thủ đang dùng chiêu Hổ Lao! Muốn hất tung và làm choáng đối thủ, hãy nhấn ngay vào [Phím L / Nút Tuyệt Kỹ] để tung chiêu Móc Cống!',
    targetTotal: 1,
    highlightTarget: 'MOC',
  },
  {
    step: 3,
    title: 'Bước 3 · Né Bước Tránh Sóng Xung Kích',
    dialogue:
      'Sóng trống đang lan tới! Muốn lách mình né tránh sát thương, hãy nhấn vào [Phím Shift / Nút Né] để thực hiện Né Bước!',
    targetTotal: 1,
    highlightTarget: 'NE',
  },
  {
    step: 4,
    title: 'Bước 4 · Đẩy Văng Khỏi Vạch Vôi (Ring-Out)',
    dialogue:
      'Đối thủ đã lùi sát mép sới! Muốn đẩy văng đối thủ ra khỏi vạch vôi trắng để giành chiến thắng Ring-Out, hãy nhấn vào [Phím K / Nút Hổ Lao]!',
    targetTotal: 1,
    highlightTarget: 'LAO',
  },
];

export class TutorialManager {
  constructor(soundManager, beatEngine, saveManager, uiManager) {
    this.soundManager = soundManager;
    this.beatEngine = beatEngine;
    this.saveManager = saveManager;
    this.ui = uiManager;

    this.active = false;
    this.completed = false;
    this.stepIndex = 0; // 0..3
    this.progress = 0;
    this.stepTransitionTimer = 0;

    this.player = null;
    this.strawDummy = null;

    this.scriptPhase = 'WAIT';
    this.scriptTimer = 0;
    this.shockwaves = [];
    this.confetti = [];
    this.floatingTexts = [];
    this.particles = [];
    this.time = 0;
    this.shakeIntensity = 0;
    this.shakeDuration = 0;
  }

  start() {
    this.active = true;
    this.completed = false;
    this.stepIndex = 0;
    this.confetti = [];
    this.floatingTexts = [];
    this.particles = [];
    this.shockwaves = [];
    this.shakeIntensity = 0;
    this.shakeDuration = 0;

    this.player = new BuffaloEntity({
      isPlayer: true,
      name: 'Ông Cầu Hắc Phong',
      spriteRow: 0,
      maxSpeed: GAME_CONFIG.PLAYER_MAX_SPEED,
      poiseMultiplier: 1.0,
      perfectBypassPoise: false,
      bodyColor: '#1b191b',
      accentColor: '#e5e7eb',
    });

    this.strawDummy = new BuffaloEntity({
      isPlayer: false,
      name: 'Bù Nhìn Trâu Rơm',
      spriteRow: 1,
      maxSpeed: 120,
      poiseMultiplier: 1.0,
      perfectBypassPoise: false,
      bodyColor: '#c29248',
      accentColor: '#fde68a',
    });

    this.soundManager.startMusic(100, this.saveManager.data.inventory.equippedTrack);
    this.beatEngine.reset(100);
    this.setupStep(0);
    this.ui.showTutorialScreen(true);
    this.syncUI();
  }

  stop() {
    this.active = false;
    this.ui.clearTutorialHighlights();
    this.ui.showTutorialScreen(false);
  }

  setupStep(idx) {
    this.stepIndex = idx;
    this.progress = 0;
    this.stepTransitionTimer = 0;
    this.shockwaves = [];
    this.scriptPhase = 'WAIT';
    this.scriptTimer = 0.7;

    const cx = GAME_CONFIG.ARENA_CENTER_X;
    const cy = GAME_CONFIG.ARENA_CENTER_Y;

    if (idx === 0) {
      // Step 1: Beat-Sync HUC against stationary Bù Nhìn Trâu Rơm
      this.player.resetForRound(cx - 95, cy, 0, false);
      this.strawDummy.resetForRound(cx + 15, cy, Math.PI, false);
    } else if (idx === 1) {
      // Step 2: Móc Cống countering slow-motion Hổ Lao
      this.player.resetForRound(cx - 115, cy, 0, false);
      this.strawDummy.resetForRound(cx + 75, cy, Math.PI, false);
      this.scriptPhase = 'TELEGRAPH';
      this.scriptTimer = 1.0;
    } else if (idx === 2) {
      // Step 3: Né Bước dodging slow expanding shockwave
      this.player.resetForRound(cx - 115, cy, 0, false);
      this.strawDummy.resetForRound(cx + 85, cy, Math.PI, false);
      this.scriptPhase = 'CHARGE_WAVE';
      this.scriptTimer = 0.85;
    } else if (idx === 3) {
      // Step 4: Bù Nhìn Trâu Rơm stands near white chalk edge for Ring-Out
      this.player.resetForRound(cx + 145, cy, 0, false);
      this.strawDummy.resetForRound(cx + 258, cy, Math.PI, false);
    }

    this.syncUI();
  }

  syncUI() {
    const cfg = TUTORIAL_STEPS[this.stepIndex];
    this.ui.updateTutorialBanner({
      stepNumber: cfg.step,
      totalSteps: TUTORIAL_STEPS.length,
      title: cfg.title,
      dialogue: cfg.dialogue,
      progress: this.progress,
      targetTotal: cfg.targetTotal,
      highlightTarget: cfg.highlightTarget,
      completed: this.completed,
    });
  }

  handleSkillInput(skillId) {
    if (!this.active || this.completed || this.stepTransitionTimer > 0) return;

    const cfg = TUTORIAL_STEPS[this.stepIndex];
    this.player.stamina = 100;
    this.player.cooldowns[skillId] = 0;

    const targetAng = Math.atan2(
      this.strawDummy.y - this.player.y,
      this.strawDummy.x - this.player.x
    );

    if (this.stepIndex === 0) {
      // Beat-Sync HUC
      if (skillId !== 'HUC') {
        this.spawnFloatingText(this.player.x, this.player.y - 45, 'Hãy bấm [J / HÚC]!', '#fb923c');
        return;
      }
      const timing = this.beatEngine.evaluateInputTiming(false);
      this.player.startSkill('HUC', timing, targetAng, this.beatEngine.beatDuration);
      this.soundManager.playSkill('HUC');
      this.spawnFloatingText(this.player.x, this.player.y - 54, timing.label, timing.color);

      if (timing.judgment === 'GOOD' || timing.judgment === 'PERFECT') {
        this.progress += 1;
        this.soundManager.playImpact(timing.judgment === 'PERFECT');
        this.strawDummy.hitFlashTimer = 0.18;
        this.spawnMudBurst(this.strawDummy.x, this.strawDummy.y);
        this.triggerShake(timing.judgment === 'PERFECT' ? 10 : 6, 0.15);
        this.syncUI();
        if (this.progress >= cfg.targetTotal) {
          this.queueNextStep();
        }
      } else {
        this.spawnFloatingText(
          this.player.x,
          this.player.y - 78,
          'Chờ vòng sáng chạm tâm nhé!',
          '#fca5a5'
        );
      }
      return;
    }

    if (this.stepIndex === 1) {
      // Móc Cống (L) counters slow-motion Hổ Lao
      if (skillId !== 'MOC') {
        this.spawnFloatingText(this.player.x, this.player.y - 45, 'Hãy bấm [L / MÓC]!', '#fb923c');
        return;
      }
      const timing = this.beatEngine.evaluateInputTiming(true);
      this.player.startSkill('MOC', timing, targetAng, this.beatEngine.beatDuration);
      this.soundManager.playSkill('MOC');

      const dist = Math.hypot(this.strawDummy.x - this.player.x, this.strawDummy.y - this.player.y);
      if (
        (this.scriptPhase === 'SLOW_CHARGE' || this.scriptPhase === 'TELEGRAPH') &&
        dist <= 220
      ) {
        this.strawDummy.state = 'STUNNED';
        this.strawDummy.stunTimer = 1.1;
        this.strawDummy.vx = 260;
        this.strawDummy.vy = 0;
        this.strawDummy.hitFlashTimer = 0.25;
        this.soundManager.playCounterCrit();
        this.triggerShake(14, 0.25);
        this.spawnMudBurst(this.strawDummy.x, this.strawDummy.y);
        this.spawnFloatingText(
          this.strawDummy.x,
          this.strawDummy.y - 54,
          'KHẮC CHẾ MÓC CỐNG!',
          '#fde047'
        );
        this.progress = 1;
        this.syncUI();
        this.queueNextStep();
      }
      return;
    }

    if (this.stepIndex === 2) {
      // Né Bước (Shift) dodges shockwave
      if (skillId !== 'NE') {
        this.spawnFloatingText(this.player.x, this.player.y - 45, 'Hãy bấm [Shift / NÉ]!', '#fb923c');
        return;
      }
      const timing = this.beatEngine.evaluateInputTiming(true);
      this.player.startSkill('NE', timing, targetAng, this.beatEngine.beatDuration);
      this.player.invulnTimer = 0.74;
      this.player.stateTimer = 0.68;
      this.soundManager.playSkill('NE');
      this.spawnFloatingText(this.player.x, this.player.y - 48, 'NÉ BƯỚC!', '#2dd4bf');
      return;
    }

    if (this.stepIndex === 3) {
      // Hổ Lao (K) pushes Bù Nhìn past white chalk line -> Ring-Out!
      if (skillId !== 'LAO') {
        this.spawnFloatingText(this.player.x, this.player.y - 45, 'Hãy bấm [K / LAO]!', '#fb923c');
        return;
      }
      const timing = this.beatEngine.evaluateInputTiming(true);
      this.player.startSkill('LAO', timing, targetAng, this.beatEngine.beatDuration);
      this.soundManager.playSkill('LAO');
    }
  }

  queueNextStep() {
    this.stepTransitionTimer = 0.95;
  }

  completeTutorial() {
    this.completed = true;
    this.saveManager.markTutorialCompleted();
    this.soundManager.playVictory();
    this.spawnConfettiExplosion();
    this.syncUI();
  }

  update(dt) {
    if (!this.active) return;
    this.time += dt;
    this.beatEngine.update(dt);
    this.updateFX(dt);

    if (this.completed) {
      this.updateConfetti(dt);
      return;
    }

    if (this.stepTransitionTimer > 0) {
      this.stepTransitionTimer -= dt;
      if (this.stepTransitionTimer <= 0) {
        if (this.stepIndex < TUTORIAL_STEPS.length - 1) {
          this.setupStep(this.stepIndex + 1);
        } else {
          this.completeTutorial();
        }
      }
      return;
    }

    this.player.updateTimers(dt);
    this.strawDummy.updateTimers(dt);

    const cx = GAME_CONFIG.ARENA_CENTER_X;
    const cy = GAME_CONFIG.ARENA_CENTER_Y;

    // Auto-Engage facing
    if (this.player.state === 'IDLE' || this.player.state === 'MOVING') {
      this.player.angle = Math.atan2(
        this.strawDummy.y - this.player.y,
        this.strawDummy.x - this.player.x
      );
    }
    this.strawDummy.angle = Math.atan2(
      this.player.y - this.strawDummy.y,
      this.player.x - this.strawDummy.x
    );

    // Apply player velocity & friction
    this.player.x += this.player.vx * dt;
    this.player.y += this.player.vy * dt;
    if (this.player.state !== 'ATTACK' && this.player.state !== 'DODGE') {
      this.player.vx *= Math.max(0, 1 - 7 * dt);
      this.player.vy *= Math.max(0, 1 - 7 * dt);
    }

    // Keep player safely inside arena during tutorial
    const dp = Math.hypot(this.player.x - cx, this.player.y - cy);
    if (dp > GAME_CONFIG.ARENA_RADIUS - 42) {
      const ang = Math.atan2(this.player.y - cy, this.player.x - cx);
      this.player.x = cx + Math.cos(ang) * (GAME_CONFIG.ARENA_RADIUS - 42);
      this.player.y = cy + Math.sin(ang) * (GAME_CONFIG.ARENA_RADIUS - 42);
    }

    if (this.stepIndex === 0) {
      // Auto-Engage spacing around stationary Bù Nhìn Trâu Rơm
      const dx = this.strawDummy.x - this.player.x;
      const dy = this.strawDummy.y - this.player.y;
      const dist = Math.hypot(dx, dy) || 1;
      if (this.player.state === 'IDLE' && dist > 110) {
        this.player.x += (dx / dist) * 140 * dt;
        this.player.y += (dy / dist) * 140 * dt;
      }
      if (dist < 76) {
        this.player.x -= (dx / dist) * (76 - dist) * 0.5;
      }
      this.strawDummy.x += (cx + 15 - this.strawDummy.x) * Math.min(1, dt * 6);
      this.strawDummy.y += (cy - this.strawDummy.y) * Math.min(1, dt * 6);
    } else if (this.stepIndex === 1) {
      // Slow-motion Hổ Lao cycle
      this.strawDummy.x += this.strawDummy.vx * dt;
      this.strawDummy.y += this.strawDummy.vy * dt;
      if (this.strawDummy.stunTimer > 0) {
        this.strawDummy.vx *= Math.max(0, 1 - 5 * dt);
        return;
      }

      this.scriptTimer -= dt;
      if (this.scriptPhase === 'TELEGRAPH') {
        this.strawDummy.telegraphSkill = 'LAO';
        this.strawDummy.telegraphTimer = 0.2;
        if (this.scriptTimer <= 0) {
          this.scriptPhase = 'SLOW_CHARGE';
          this.scriptTimer = 1.25;
          this.strawDummy.state = 'ATTACK';
          this.strawDummy.activeSkill = 'LAO';
          this.strawDummy.stateTimer = 1.25;
          this.strawDummy.vx = -155;
          this.strawDummy.vy = 0;
        }
      } else if (this.scriptPhase === 'SLOW_CHARGE') {
        const dist = Math.hypot(this.strawDummy.x - this.player.x, this.strawDummy.y - this.player.y);
        if (dist <= 62 || this.scriptTimer <= 0) {
          this.strawDummy.vx = 0;
          this.strawDummy.state = 'IDLE';
          this.strawDummy.activeSkill = null;
          this.spawnFloatingText(
            this.player.x,
            this.player.y - 52,
            'Thử lại: Bấm [L / MÓC] sớm hơn!',
            '#fca5a5'
          );
          this.player.resetForRound(cx - 115, cy, 0, false);
          this.strawDummy.resetForRound(cx + 75, cy, Math.PI, false);
          this.scriptPhase = 'TELEGRAPH';
          this.scriptTimer = 1.0;
        }
      }
    } else if (this.stepIndex === 2) {
      // Slow shockwave ring dodge
      this.scriptTimer -= dt;
      if (this.scriptPhase === 'CHARGE_WAVE') {
        this.strawDummy.state = 'THUNDER_CHARGE';
        if (this.scriptTimer <= 0) {
          this.strawDummy.state = 'IDLE';
          this.scriptPhase = 'WAVE_ACTIVE';
          this.soundManager.playThunderStomp();
          this.shockwaves.push({
            x: this.strawDummy.x,
            y: this.strawDummy.y,
            radius: 24,
            maxRadius: 340,
            speed: 145,
            resolved: false,
          });
        }
      }
      for (let i = this.shockwaves.length - 1; i >= 0; i--) {
        const sw = this.shockwaves[i];
        sw.radius += sw.speed * dt;
        const dPlayer = Math.hypot(this.player.x - sw.x, this.player.y - sw.y);
        if (!sw.resolved && Math.abs(dPlayer - sw.radius) < 26) {
          sw.resolved = true;
          if (this.player.invulnTimer > 0) {
            this.progress = 1;
            this.soundManager.playTimingFeedback('PERFECT');
            this.spawnFloatingText(this.player.x, this.player.y - 54, 'NÉ THÀNH CÔNG!', '#2dd4bf');
            this.syncUI();
            this.queueNextStep();
          } else {
            this.soundManager.playImpact(false);
            this.player.hitFlashTimer = 0.2;
            this.spawnFloatingText(
              this.player.x,
              this.player.y - 54,
              'Trúng sóng! Bấm [Shift / NÉ] khi sóng tới!',
              '#fca5a5'
            );
          }
        }
        if (sw.radius >= sw.maxRadius) {
          this.shockwaves.splice(i, 1);
          if (this.progress === 0) {
            this.scriptPhase = 'CHARGE_WAVE';
            this.scriptTimer = 0.9;
          }
        }
      }
    } else if (this.stepIndex === 3) {
      // Push Bù Nhìn Trâu Rơm over the white chalk ring using LAO
      this.strawDummy.x += this.strawDummy.vx * dt;
      this.strawDummy.y += this.strawDummy.vy * dt;
      this.strawDummy.vx *= Math.max(0, 1 - 4.5 * dt);
      this.strawDummy.vy *= Math.max(0, 1 - 4.5 * dt);

      if (this.player.state === 'ATTACK' && this.player.activeSkill === 'LAO' && !this.player.hasHitCurrentAttack) {
        const dist = Math.hypot(this.strawDummy.x - this.player.x, this.strawDummy.y - this.player.y);
        if (dist <= 115) {
          this.player.hasHitCurrentAttack = true;
          this.player.vx *= 0.15;
          this.player.vy *= 0.15;
          const ang = Math.atan2(this.strawDummy.y - cy, this.strawDummy.x - cx);
          this.strawDummy.vx = Math.cos(ang) * 480;
          this.strawDummy.vy = Math.sin(ang) * 480;
          this.strawDummy.hitFlashTimer = 0.22;
          this.soundManager.playImpact(true);
          this.triggerShake(18, 0.28);
          this.spawnMudBurst(this.strawDummy.x, this.strawDummy.y);
          this.spawnFloatingText(this.strawDummy.x, this.strawDummy.y - 50, 'HỔ LAO!', '#fde047');
        }
      }

      const dDummy = Math.hypot(this.strawDummy.x - cx, this.strawDummy.y - cy);
      if (dDummy > GAME_CONFIG.ARENA_RADIUS) {
        this.progress = 1;
        this.syncUI();
        this.spawnFloatingText(
          this.strawDummy.x - 30,
          this.strawDummy.y - 50,
          'RING-OUT!',
          '#fde047'
        );
        this.queueNextStep();
      }
    }
  }

  triggerShake(amp, dur) {
    this.shakeIntensity = amp;
    this.shakeDuration = dur;
  }

  spawnMudBurst(x, y) {
    for (let i = 0; i < 10; i++) {
      const a = Math.random() * Math.PI * 2;
      const spd = 70 + Math.random() * 160;
      this.particles.push({
        x,
        y,
        vx: Math.cos(a) * spd,
        vy: Math.sin(a) * spd,
        size: 4 + Math.random() * 5,
        life: 0.45,
        maxLife: 0.45,
        color: '#b45309',
      });
    }
  }

  spawnFloatingText(x, y, text, color) {
    this.floatingTexts.push({ x, y, text, color, life: 0.9, maxLife: 0.9 });
  }

  spawnConfettiExplosion() {
    const colors = ['#ef4444', '#facc15', '#22c55e', '#38bdf8', '#f97316', '#fde047'];
    for (let i = 0; i < 120; i++) {
      const a = Math.random() * Math.PI * 2;
      const spd = 90 + Math.random() * 340;
      this.confetti.push({
        x: GAME_CONFIG.ARENA_CENTER_X + (Math.random() - 0.5) * 260,
        y: GAME_CONFIG.ARENA_CENTER_Y + (Math.random() - 0.5) * 140,
        vx: Math.cos(a) * spd,
        vy: Math.sin(a) * spd - 160,
        w: 7 + Math.random() * 7,
        h: 4 + Math.random() * 5,
        rot: Math.random() * Math.PI * 2,
        vRot: (Math.random() - 0.5) * 10,
        color: colors[i % colors.length],
      });
    }
  }

  updateConfetti(dt) {
    for (const c of this.confetti) {
      c.x += c.vx * dt;
      c.y += c.vy * dt;
      c.vy += 260 * dt;
      c.vx *= 0.985;
      c.rot += c.vRot * dt;
    }
  }

  updateFX(dt) {
    if (this.shakeDuration > 0) {
      this.shakeDuration = Math.max(0, this.shakeDuration - dt);
      if (this.shakeDuration === 0) this.shakeIntensity = 0;
    }
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
      if (p.life <= 0) this.particles.splice(i, 1);
    }
    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      const ft = this.floatingTexts[i];
      ft.y -= 36 * dt;
      ft.life -= dt;
      if (ft.life <= 0) this.floatingTexts.splice(i, 1);
    }
  }

  render(ctx, assets) {
    if (!this.active) return;
    const W = GAME_CONFIG.CANVAS_WIDTH;
    const H = GAME_CONFIG.CANVAS_HEIGHT;
    const round1Cfg = GAME_CONFIG.ROUNDS[0];

    ctx.clearRect(0, 0, W, H);
    ctx.save();

    const cappedShake = Math.min(this.shakeIntensity, GAME_CONFIG.CAMERA.MAX_SHAKE_OFFSET);
    const shakeX = this.shakeDuration > 0 ? (Math.random() - 0.5) * 2 * cappedShake : 0;
    const shakeY = this.shakeDuration > 0 ? (Math.random() - 0.5) * 2 * cappedShake : 0;
    const baseZoom = GAME_CONFIG.CAMERA.BASE_ZOOM;
    ctx.translate(W / 2 + shakeX, H / 2 + shakeY);
    ctx.scale(baseZoom, baseZoom);
    ctx.translate(-W / 2, -H / 2);

    assets.drawArena(ctx, this.time, this.beatEngine.beatPulse, round1Cfg, 0, []);

    // Beat Ring under Ông Cầu
    this.beatEngine.renderBeatRing(ctx, this.player.x, this.player.y, this.stepIndex === 0);

    // Shockwave rings
    for (const sw of this.shockwaves) {
      const alpha = Math.max(0, 1 - sw.radius / sw.maxRadius);
      ctx.save();
      ctx.strokeStyle = `rgba(192, 132, 252, ${alpha})`;
      ctx.lineWidth = 7;
      ctx.beginPath();
      ctx.arc(sw.x, sw.y, sw.radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // Bù Nhìn Trâu Rơm
    this.drawStrawDummy(ctx);

    // Player Ông Cầu Hắc Phong
    const equippedHornId = this.saveManager.data.inventory.equippedHorn;
    const hornCfg =
      GAME_CONFIG.SHOP_HORNS.find((h) => h.id === equippedHornId) || GAME_CONFIG.SHOP_HORNS[0];
    this.player.render(ctx, assets, hornCfg, this.time);

    // Particles
    for (const p of this.particles) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Floating texts
    for (const ft of this.floatingTexts) {
      ctx.save();
      ctx.globalAlpha = Math.min(1, (ft.life / ft.maxLife) * 1.4);
      ctx.font = '800 20px "Bricolage Grotesque", sans-serif';
      ctx.textAlign = 'center';
      ctx.lineWidth = 4;
      ctx.strokeStyle = 'rgba(0,0,0,0.85)';
      ctx.strokeText(ft.text, ft.x, ft.y);
      ctx.fillStyle = ft.color;
      ctx.fillText(ft.text, ft.x, ft.y);
      ctx.restore();
    }

    // Celebratory paper confetti fireworks
    for (const c of this.confetti) {
      ctx.save();
      ctx.translate(c.x, c.y);
      ctx.rotate(c.rot);
      ctx.fillStyle = c.color;
      ctx.fillRect(-c.w / 2, -c.h / 2, c.w, c.h);
      ctx.restore();
    }

    ctx.restore();

    if (!this.completed) {
      this.beatEngine.renderBeatBar(ctx, W, H, assets);
    }
  }

  drawStrawDummy(ctx) {
    const d = this.strawDummy;
    ctx.save();

    if (d.telegraphTimer > 0) {
      const pulse = 0.5 + 0.5 * Math.sin(this.time * 22);
      ctx.strokeStyle = `rgba(239, 68, 68, ${0.5 + pulse * 0.5})`;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(d.x, d.y, 48 + pulse * 8, 0, Math.PI * 2);
      ctx.stroke();
    }

    if (d.state === 'THUNDER_CHARGE') {
      ctx.strokeStyle = 'rgba(192, 132, 252, 0.85)';
      ctx.fillStyle = 'rgba(192, 132, 252, 0.18)';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(d.x, d.y, 56, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }

    ctx.fillStyle = 'rgba(0, 0, 0, 0.32)';
    ctx.beginPath();
    ctx.ellipse(d.x, d.y + 8, 34, 24, d.angle, 0, Math.PI * 2);
    ctx.fill();

    ctx.translate(d.x, d.y);
    ctx.rotate(d.angle);
    if (d.hitFlashTimer > 0) {
      ctx.filter = 'brightness(1.75)';
    }

    ctx.fillStyle = '#78350f';
    ctx.beginPath();
    ctx.arc(-8, 0, 11, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#d4a348';
    ctx.strokeStyle = '#5c3a11';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.ellipse(-2, 0, 30, 20, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.strokeStyle = '#991b1b';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(-12, -18);
    ctx.lineTo(-12, 18);
    ctx.moveTo(6, -18);
    ctx.lineTo(6, 18);
    ctx.stroke();

    ctx.fillStyle = '#e6b85c';
    ctx.strokeStyle = '#5c3a11';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(22, 0, 13, 11, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#fef3c7';
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(20, side * 9);
      ctx.quadraticCurveTo(36, side * 25, 42, side * 10);
      ctx.quadraticCurveTo(33, side * 16, 24, side * 6);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }

    ctx.restore();

    ctx.save();
    ctx.font = '700 12px "Plus Jakarta Sans", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#fef3c7';
    ctx.strokeStyle = 'rgba(0,0,0,0.85)';
    ctx.lineWidth = 3;
    ctx.strokeText('Bù Nhìn Trâu Rơm', d.x, d.y - 44);
    ctx.fillText('Bù Nhìn Trâu Rơm', d.x, d.y - 44);
    ctx.restore();
  }
}
