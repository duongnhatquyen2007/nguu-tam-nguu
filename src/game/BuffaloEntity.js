import { GAME_CONFIG } from './config.js';

export class BuffaloEntity {
  constructor({
    isPlayer,
    name,
    spriteRow,
    maxSpeed,
    poiseMultiplier,
    perfectBypassPoise,
    bodyColor,
    accentColor,
    maxHp = 100,
    attack = 15,
    defense = 10,
    knockbackStat = 12,
    rageSkillId = 'skill_linh_nguu_xung_kich',
    rageLevel = 1,
    visualScale = 1.0,
  }) {
    this.isPlayer = isPlayer;
    this.name = name;
    this.spriteRow = spriteRow;
    this.maxSpeed = maxSpeed;
    this.basePoiseMultiplier = poiseMultiplier;
    this.perfectBypassPoise = Boolean(perfectBypassPoise);
    this.bodyColor = bodyColor;
    this.accentColor = accentColor;

    this.maxHp = Math.max(50, maxHp);
    this.attack = attack;
    this.defense = defense;
    this.knockbackStat = knockbackStat;
    this.rageSkillId = rageSkillId;
    this.rageLevel = Math.max(1, rageLevel);
    this.visualScale = visualScale;

    this.x = GAME_CONFIG.ARENA_CENTER_X;
    this.y = GAME_CONFIG.ARENA_CENTER_Y;
    this.vx = 0;
    this.vy = 0;
    this.angle = isPlayer ? 0 : Math.PI;
    this.radius = Math.round(GAME_CONFIG.BUFFALO_HITBOX_RADIUS * Math.min(1.12, visualScale));

    this.hp = this.maxHp;
    this.stamina = 100;
    this.balance = 100;
    this.remixHype = 0;
    this.rage = 0;

    this.weakPointStacks = 0;
    this.weakPointStackTimer = 0;
    this.exposedWeakSide = 'FRONT'; // FRONT, LEFT, RIGHT
    this.weakPointSwitchTimer = GAME_CONFIG.WEAK_POINT.SWITCH_INTERVAL;
    this.flankAdvantageTimer = 0;

    this.knockbackTimer = 0;
    this.launchAirTimer = 0;
    this.launchAirDuration = 0;

    this.state = 'IDLE'; // IDLE, MOVING, WINDUP, ATTACK, DODGE, STUNNED, CLASHING, THUNDER_CHARGE
    this.activeSkill = null;
    this.activeTiming = null;
    this.stateTimer = 0;
    this.stunTimer = 0;
    this.invulnTimer = 0;
    this.hitFlashTimer = 0;
    this.linhNguuTimer = 0;
    this.hasHitCurrentAttack = false;
    this.dodgeCounterUsed = false;
    this.dodgeDir = 1;

    this.cooldowns = { HUC: 0, LAO: 0, MOC: 0, NE: 0, NO: 0 };
    this.telegraphSkill = null;
    this.telegraphTimer = 0;
    this.thunderChargeTimer = 0;
    this.roundPerfectCount = 0;

    this.linhNguuDuration = 8.0 + (this.rageLevel - 1) * 1.0;

    // Flowing red silk ribbon trail for Ông Cầu Hắc Phong
    this.silkTrail = [];
    for (let i = 0; i < 7; i++) {
      this.silkTrail.push({ x: this.x, y: this.y });
    }
  }

  resetForRound(x, y, angle, keepHp = false) {
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;
    this.angle = angle;
    if (!keepHp) {
      this.hp = this.maxHp;
    }
    this.stamina = 100;
    this.balance = 100;
    this.remixHype = 0;
    this.rage = 0;
    this.weakPointStacks = 0;
    this.weakPointStackTimer = 0;
    this.exposedWeakSide = 'FRONT';
    this.weakPointSwitchTimer = GAME_CONFIG.WEAK_POINT.SWITCH_INTERVAL;
    this.flankAdvantageTimer = 0;
    this.knockbackTimer = 0;
    this.launchAirTimer = 0;
    this.launchAirDuration = 0;
    this.state = 'IDLE';
    this.activeSkill = null;
    this.activeTiming = null;
    this.stateTimer = 0;
    this.stunTimer = 0;
    this.invulnTimer = 0;
    this.hitFlashTimer = 0;
    this.linhNguuTimer = 0;
    this.linhNguuDuration = 8.0 + (this.rageLevel - 1) * 1.0;
    this.hasHitCurrentAttack = false;
    this.dodgeCounterUsed = false;
    this.cooldowns = { HUC: 0, LAO: 0, MOC: 0, NE: 0, NO: 0 };
    this.telegraphSkill = null;
    this.telegraphTimer = 0;
    this.thunderChargeTimer = 0;
    this.roundPerfectCount = 0;
    this.silkTrail = Array.from({ length: 7 }, () => ({ x, y }));
  }

  isLinhNguu() {
    return this.linhNguuTimer > 0;
  }

  isAutoPerfect() {
    return this.isLinhNguu() && this.rageSkillId === 'skill_linh_nguu_xung_kich';
  }

  getRageEffectMultiplier() {
    return 1 + (this.rageLevel - 1) * 0.15;
  }

  getPoiseMultiplier(wasPerfectHit) {
    if (this.isLinhNguu()) {
      if (this.rageSkillId === 'skill_linh_nguu_xung_kich') {
        return 0; // Knockback immune during Linh Ngưu Hộ Thể
      }
      return GAME_CONFIG.LINH_NGUU.POISE_MULTIPLIER;
    }
    if (this.perfectBypassPoise && wasPerfectHit) {
      return 1.0;
    }
    return this.basePoiseMultiplier;
  }

  canUseSkill(skillId) {
    if (this.stunTimer > 0 || this.state === 'CLASHING' || this.state === 'THUNDER_CHARGE') {
      return { ok: false, reason: 'locked' };
    }
    if (this.state === 'WINDUP' || this.state === 'ATTACK' || this.state === 'DODGE') {
      return { ok: false, reason: 'busy' };
    }
    if ((this.cooldowns[skillId] || 0) > 0) {
      return { ok: false, reason: 'cooldown' };
    }
    const skill = GAME_CONFIG.SKILLS[skillId];
    if (!skill) return { ok: false, reason: 'invalid' };

    if (skillId === 'NO') {
      if (this.rage < GAME_CONFIG.RAGE.MAX) {
        return { ok: false, reason: 'no_rage' };
      }
      return { ok: true };
    }

    if (!this.isLinhNguu() && this.stamina < skill.staminaCost) {
      return { ok: false, reason: 'exhausted' };
    }
    return { ok: true };
  }

  startSkill(skillId, timingResult, targetAngle, beatDuration, opponent = null) {
    const check = this.canUseSkill(skillId);
    if (!check.ok) return false;

    const skill = GAME_CONFIG.SKILLS[skillId];
    if (skillId === 'NO') {
      this.rage = 0;
    } else if (!this.isLinhNguu()) {
      this.stamina = Math.max(0, this.stamina - skill.staminaCost);
    }

    if (timingResult.staminaGain > 0) {
      this.stamina = Math.min(100, this.stamina + timingResult.staminaGain);
    }
    if (timingResult.hypeGain > 0 && !this.isLinhNguu()) {
      this.addHype(timingResult.hypeGain);
    }

    this.cooldowns[skillId] = skill.cooldown;
    this.activeSkill = skillId;
    this.activeTiming = timingResult;
    if (timingResult && timingResult.judgment === 'PERFECT') {
      this.roundPerfectCount += 1;
    }
    this.hasHitCurrentAttack = false;
    this.angle = targetAngle;

    if (skillId === 'NE') {
      this.state = 'DODGE';
      this.stateTimer = skill.dodgeDuration;
      this.invulnTimer = skill.dodgeDuration;
      this.dodgeCounterUsed = false;
      this.flankAdvantageTimer = GAME_CONFIG.WEAK_POINT.FLANK_WINDOW;

      // Smartly sidestep toward opponent's exposed weak flank if LEFT or RIGHT
      if (opponent && opponent.exposedWeakSide === 'LEFT') {
        this.dodgeDir = -1;
      } else if (opponent && opponent.exposedWeakSide === 'RIGHT') {
        this.dodgeDir = 1;
      } else {
        this.dodgeDir = Math.random() < 0.5 ? 1 : -1;
      }

      const perpAngle = targetAngle + (Math.PI / 2) * this.dodgeDir;
      this.vx = Math.cos(perpAngle) * skill.dodgeSpeed;
      this.vy = Math.sin(perpAngle) * skill.dodgeSpeed;
    } else {
      this.state = 'WINDUP';
      this.stateTimer = Math.max(0.06, skill.windupBeats * beatDuration);
    }
    return true;
  }

  addHype(amount) {
    if (this.isLinhNguu()) return false;
    this.remixHype = Math.min(100, this.remixHype + amount);
    if (this.remixHype >= 100) {
      this.linhNguuDuration = 8.0 + (this.rageLevel - 1) * 1.0;
      this.linhNguuTimer = this.linhNguuDuration;
      this.stunTimer = 0;
      if (this.state === 'STUNNED') {
        this.state = 'IDLE';
      }
      return true;
    }
    return false;
  }

  addRage(amount) {
    this.rage = Math.min(GAME_CONFIG.RAGE.MAX, this.rage + amount);
  }

  addWeakPointStack() {
    this.weakPointStacks = Math.min(
      GAME_CONFIG.WEAK_POINT.MAX_STACKS,
      this.weakPointStacks + 1
    );
    this.weakPointStackTimer = GAME_CONFIG.WEAK_POINT.STACK_DURATION;
    return this.weakPointStacks;
  }

  cycleWeakSide() {
    const sides = ['FRONT', 'LEFT', 'RIGHT'];
    const other = sides.filter((s) => s !== this.exposedWeakSide);
    this.exposedWeakSide = other[Math.floor(Math.random() * other.length)];
    this.weakPointSwitchTimer = GAME_CONFIG.WEAK_POINT.SWITCH_INTERVAL;
  }

  applyKnockback(vx, vy, isLaunch = false) {
    this.vx += vx;
    this.vy += vy;
    this.knockbackTimer = Math.max(
      this.knockbackTimer,
      isLaunch ? GAME_CONFIG.KNOCKBACK.LOCK_DURATION * 1.35 : GAME_CONFIG.KNOCKBACK.LOCK_DURATION
    );
    if (isLaunch) {
      this.launchAirDuration = GAME_CONFIG.KNOCKBACK.LAUNCH_AIR_DURATION;
      this.launchAirTimer = GAME_CONFIG.KNOCKBACK.LAUNCH_AIR_DURATION;
    }
  }

  applyDamage(dmg) {
    this.hp = Math.max(0, this.hp - dmg);
    this.hitFlashTimer = 0.16;
  }

  applyStun(duration) {
    if (this.isLinhNguu() || this.activeSkill === 'NO') return;
    this.stunTimer = Math.max(this.stunTimer, duration);
    this.state = 'STUNNED';
    this.activeSkill = null;
    this.telegraphSkill = null;
    this.telegraphTimer = 0;
  }

  updateTimers(dt) {
    for (const k of Object.keys(this.cooldowns)) {
      if (this.cooldowns[k] > 0) {
        this.cooldowns[k] = Math.max(0, this.cooldowns[k] - dt);
      }
    }

    if (this.invulnTimer > 0) this.invulnTimer = Math.max(0, this.invulnTimer - dt);
    if (this.hitFlashTimer > 0) this.hitFlashTimer = Math.max(0, this.hitFlashTimer - dt);
    if (this.telegraphTimer > 0) this.telegraphTimer = Math.max(0, this.telegraphTimer - dt);
    if (this.knockbackTimer > 0) this.knockbackTimer = Math.max(0, this.knockbackTimer - dt);
    if (this.launchAirTimer > 0) this.launchAirTimer = Math.max(0, this.launchAirTimer - dt);
    if (this.flankAdvantageTimer > 0) this.flankAdvantageTimer = Math.max(0, this.flankAdvantageTimer - dt);

    if (this.weakPointStackTimer > 0) {
      this.weakPointStackTimer = Math.max(0, this.weakPointStackTimer - dt);
      if (this.weakPointStackTimer === 0) {
        this.weakPointStacks = 0;
      }
    }

    this.weakPointSwitchTimer -= dt;
    if (this.weakPointSwitchTimer <= 0) {
      this.cycleWeakSide();
    }

    if (this.linhNguuTimer > 0) {
      this.linhNguuTimer = Math.max(0, this.linhNguuTimer - dt);
      const dur = this.linhNguuDuration || GAME_CONFIG.LINH_NGUU.DURATION;
      this.remixHype = (this.linhNguuTimer / dur) * 100;
    }

    if (this.stunTimer > 0) {
      this.stunTimer = Math.max(0, this.stunTimer - dt);
      if (this.stunTimer === 0 && this.state === 'STUNNED') {
        this.state = 'IDLE';
      }
    }

    if (this.state === 'IDLE' || this.state === 'MOVING') {
      this.stamina = Math.min(100, this.stamina + GAME_CONFIG.STAMINA_REGEN_PER_SEC * dt);
    }

    if (this.state === 'WINDUP') {
      this.stateTimer -= dt;
      if (this.stateTimer <= 0) {
        const skill = GAME_CONFIG.SKILLS[this.activeSkill];
        this.state = 'ATTACK';
        this.stateTimer = skill.activeDuration;
        const speedBoost = this.activeTiming?.judgment === 'PERFECT' ? 1.15 : 1.0;
        this.vx = Math.cos(this.angle) * skill.lungeSpeed * speedBoost;
        this.vy = Math.sin(this.angle) * skill.lungeSpeed * speedBoost;
      }
    } else if (this.state === 'ATTACK') {
      this.stateTimer -= dt;
      if (this.stateTimer <= 0) {
        this.state = 'IDLE';
        this.activeSkill = null;
      }
    } else if (this.state === 'DODGE') {
      this.stateTimer -= dt;
      if (this.stateTimer <= 0) {
        this.state = 'IDLE';
        this.activeSkill = null;
      }
    }

    // Update silk ribbon physics trail anchored behind neck/shoulders
    const neckX = this.x + Math.cos(this.angle) * 6;
    const neckY = this.y + Math.sin(this.angle) * 6;
    this.silkTrail[0].x = neckX;
    this.silkTrail[0].y = neckY;
    for (let i = 1; i < this.silkTrail.length; i++) {
      const prev = this.silkTrail[i - 1];
      const cur = this.silkTrail[i];
      const dx = cur.x - prev.x;
      const dy = cur.y - prev.y;
      const dist = Math.hypot(dx, dy) || 0.001;
      const segLen = 7;
      if (dist > segLen) {
        cur.x = prev.x + (dx / dist) * segLen;
        cur.y = prev.y + (dy / dist) * segLen;
      }
      cur.x -= Math.cos(this.angle) * 26 * dt;
      cur.y -= Math.sin(this.angle) * 26 * dt;
    }
  }

  render(ctx, assets, hornConfig, time) {
    ctx.save();

    // Telegraph ring for Round 1 or Boss Thunder Stomp / Rage Ult
    if (this.telegraphTimer > 0 && this.telegraphSkill) {
      const pulse = 0.5 + 0.5 * Math.sin(time * 20);
      ctx.strokeStyle =
        this.telegraphSkill === 'NO'
          ? `rgba(249, 115, 22, ${0.55 + pulse * 0.45})`
          : `rgba(239, 68, 68, ${0.45 + pulse * 0.45})`;
      ctx.lineWidth = this.telegraphSkill === 'NO' ? 6 : 4;
      ctx.beginPath();
      ctx.arc(this.x, this.y, 48 + pulse * 10, 0, Math.PI * 2);
      ctx.stroke();
    }

    if (this.state === 'THUNDER_CHARGE') {
      const pulse = 0.5 + 0.5 * Math.sin(time * 28);
      ctx.strokeStyle = `rgba(168, 85, 247, ${0.6 + pulse * 0.4})`;
      ctx.fillStyle = `rgba(168, 85, 247, 0.16)`;
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.arc(this.x, this.y, 62 + pulse * 12, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }

    // Air-hop offset when launched backward ("HẤT VĂNG!")
    let airLift = 0;
    if (this.launchAirTimer > 0 && this.launchAirDuration > 0) {
      const p = 1 - this.launchAirTimer / this.launchAirDuration;
      airLift = Math.sin(p * Math.PI) * 26;
    }

    // Ground shadow stays grounded while entity lifts into the air
    ctx.fillStyle = 'rgba(0, 0, 0, 0.36)';
    ctx.beginPath();
    const shadowScale = Math.max(0.65, 1 - airLift * 0.012);
    ctx.ellipse(this.x, this.y + 8, 36 * shadowScale, 26 * shadowScale, this.angle, 0, Math.PI * 2);
    ctx.fill();

    // Crimson-Gold Chiêu Nộ (Rage Ultimate) Blaze Aura
    if (this.activeSkill === 'NO') {
      const auraR = 60 + Math.sin(time * 24) * 6;
      const grad = ctx.createRadialGradient(this.x, this.y - airLift, 10, this.x, this.y - airLift, auraR);
      grad.addColorStop(0, 'rgba(239, 68, 68, 0.65)');
      grad.addColorStop(0.55, 'rgba(245, 158, 11, 0.42)');
      grad.addColorStop(1, 'rgba(239, 68, 68, 0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(this.x, this.y - airLift, auraR, 0, Math.PI * 2);
      ctx.fill();
    }

    // Unique 8s+ Rage Skill Aura when Sĩ Khí hits 100%
    if (this.isLinhNguu()) {
      const auraY = this.y - airLift;
      const auraR = (54 + Math.sin(time * 14) * 5) * this.visualScale;

      if (this.rageSkillId === 'skill_thach_son_bat_hoai') {
        // Stone Mountain Armor (Bạch Tạng Sơn Cước)
        const grad = ctx.createRadialGradient(this.x, auraY, 12, this.x, auraY, auraR);
        grad.addColorStop(0, 'rgba(226, 232, 240, 0.55)');
        grad.addColorStop(0.65, 'rgba(100, 116, 139, 0.35)');
        grad.addColorStop(1, 'rgba(100, 116, 139, 0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(this.x, auraY, auraR, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = 'rgba(226, 232, 240, 0.9)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
          const a = time * 1.4 + (i * Math.PI) / 3;
          const rx = this.x + Math.cos(a) * (46 * this.visualScale);
          const ry = auraY + Math.sin(a) * (46 * this.visualScale);
          if (i === 0) ctx.moveTo(rx, ry);
          else ctx.lineTo(rx, ry);
        }
        ctx.closePath();
        ctx.stroke();
      } else if (this.rageSkillId === 'skill_hai_long_cuon_song') {
        // Fire Cyclone around Horns (Xích Hỏa Hải Long)
        const grad = ctx.createRadialGradient(this.x, auraY, 12, this.x, auraY, auraR + 8);
        grad.addColorStop(0, 'rgba(251, 146, 60, 0.62)');
        grad.addColorStop(0.6, 'rgba(220, 38, 38, 0.38)');
        grad.addColorStop(1, 'rgba(220, 38, 38, 0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(this.x, auraY, auraR + 8, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = 'rgba(251, 146, 60, 0.92)';
        ctx.lineWidth = 3;
        for (let arm = 0; arm < 2; arm++) {
          ctx.beginPath();
          const baseA = time * 7 + arm * Math.PI;
          for (let step = 0; step <= 14; step++) {
            const r = 22 + step * 2.5;
            const a = baseA + step * 0.25;
            const fx = this.x + Math.cos(a) * r;
            const fy = auraY + Math.sin(a) * r;
            if (step === 0) ctx.moveTo(fx, fy);
            else ctx.lineTo(fx, fy);
          }
          ctx.stroke();
        }
      } else if (this.rageSkillId === 'skill_loi_dinh_giang_the') {
        // Divine Thunder Aura (Thần Ngưu Lôi Đình)
        const grad = ctx.createRadialGradient(this.x, auraY, 14, this.x, auraY, auraR + 10);
        grad.addColorStop(0, 'rgba(56, 189, 248, 0.62)');
        grad.addColorStop(0.6, 'rgba(168, 85, 247, 0.38)');
        grad.addColorStop(1, 'rgba(168, 85, 247, 0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(this.x, auraY, auraR + 10, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = '#7dd3fc';
        ctx.lineWidth = 2.4;
        for (let b = 0; b < 4; b++) {
          const a = time * 5 + (b * Math.PI) / 2;
          const x1 = this.x + Math.cos(a) * 38;
          const y1 = auraY + Math.sin(a) * 38;
          const x2 = this.x + Math.cos(a + 0.45) * 56;
          const y2 = auraY + Math.sin(a + 0.45) * 56;
          ctx.beginPath();
          ctx.moveTo(x1, y1);
          ctx.lineTo((x1 + x2) * 0.5 + Math.sin(time * 30 + b) * 6, (y1 + y2) * 0.5 - 5);
          ctx.lineTo(x2, y2);
          ctx.stroke();
        }
      } else {
        // Red Bronze-Drum Aura (Ông Cầu Hắc Phong - Linh Ngưu Hộ Thể)
        const grad = ctx.createRadialGradient(this.x, auraY, 12, this.x, auraY, auraR);
        grad.addColorStop(0, 'rgba(239, 68, 68, 0.58)');
        grad.addColorStop(0.6, 'rgba(253, 224, 71, 0.36)');
        grad.addColorStop(1, 'rgba(239, 68, 68, 0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(this.x, auraY, auraR, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = 'rgba(253, 224, 71, 0.9)';
        ctx.lineWidth = 2.5;
        ctx.setLineDash([10, 6]);
        ctx.beginPath();
        ctx.arc(this.x, auraY, 48 * this.visualScale, time * 2.5, time * 2.5 + Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }

    // Flowing red silk ribbon behind Ông Cầu Hắc Phong (only drawn in vector fallback)
    if (this.isPlayer && (!assets || !assets.hasTrau)) {
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 5;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(this.silkTrail[0].x, this.silkTrail[0].y - airLift);
      for (let i = 1; i < this.silkTrail.length; i++) {
        ctx.lineTo(this.silkTrail[i].x, this.silkTrail[i].y - airLift);
      }
      ctx.stroke();
    }

    // Choose sprite pose: 0=Idle/TopDown, 1=Attack/Charge, 2=Linh Nguu
    const poseIdx = this.isLinhNguu() || this.activeSkill === 'NO'
      ? 2
      : this.state === 'ATTACK' || this.state === 'WINDUP'
        ? 1
        : 0;
    const spriteFrame = assets ? assets.getBuffaloFrame(this.spriteRow, poseIdx) : null;

    ctx.save();
    ctx.translate(this.x, this.y - airLift);

    if (this.invulnTimer > 0) {
      ctx.globalAlpha = 0.62;
    }
    if (this.hitFlashTimer > 0) {
      ctx.filter = 'brightness(1.85)';
    }

    const animScale =
      this.activeSkill === 'NO'
        ? 1.15
        : this.state === 'ATTACK'
          ? 1.08
          : this.state === 'WINDUP'
            ? 0.94
            : 1.0;
    const totalScale = animScale * this.visualScale;
    ctx.scale(totalScale, totalScale);

    if (spriteFrame && spriteFrame.canvas) {
      if (spriteFrame.topDown) {
        ctx.rotate(this.angle - spriteFrame.baseAngle);
        ctx.drawImage(spriteFrame.canvas, -48, -48, 96, 96);
      } else {
        // Side-3/4 pose: flip horizontally when facing left so buffalo never renders upside-down
        const cosA = Math.cos(this.angle);
        const sinA = Math.sin(this.angle);
        const tilt = Math.atan2(sinA, Math.abs(cosA)) * 0.45;
        if (cosA < 0) {
          ctx.scale(-1, 1);
        }
        ctx.rotate(tilt);
        ctx.drawImage(spriteFrame.canvas, -48, -48, 96, 96);
      }
    } else {
      // Crisp Top-Down Vector Fallback (96x96 logical footprint)
      ctx.rotate(this.angle);
      this.drawVectorBuffalo(ctx, hornConfig, time);
    }

    ctx.restore();

    // Weak Point Target Reticle on Opponent so player can see exposed side (FRONT / LEFT / RIGHT)
    if (!this.isPlayer && this.state !== 'CLASHING') {
      const sideOffsetAngle =
        this.exposedWeakSide === 'LEFT'
          ? -Math.PI * 0.55
          : this.exposedWeakSide === 'RIGHT'
            ? Math.PI * 0.55
            : 0;
      const wpAngle = this.angle + sideOffsetAngle;
      const wpDist = this.exposedWeakSide === 'FRONT' ? 30 : 26;
      const wx = this.x + Math.cos(wpAngle) * wpDist;
      const wy = this.y - airLift + Math.sin(wpAngle) * wpDist;
      const pulse = 0.75 + 0.25 * Math.sin(time * 12);

      ctx.save();
      ctx.translate(wx, wy);
      ctx.strokeStyle = `rgba(244, 63, 94, ${0.85 * pulse})`;
      ctx.fillStyle = 'rgba(253, 224, 71, 0.9)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, 10 * pulse, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, 0, 3.2, 0, Math.PI * 2);
      ctx.fill();
      // Crosshair ticks
      ctx.beginPath();
      ctx.moveTo(-14, 0);
      ctx.lineTo(-7, 0);
      ctx.moveTo(7, 0);
      ctx.lineTo(14, 0);
      ctx.moveTo(0, -14);
      ctx.lineTo(0, -7);
      ctx.moveTo(0, 7);
      ctx.lineTo(0, 14);
      ctx.stroke();
      ctx.restore();
    }

    // Horn glow overlay when equipped custom horn or attacking
    if (this.isPlayer && hornConfig && hornConfig.id !== 'horn_default') {
      ctx.save();
      ctx.translate(this.x, this.y - airLift);
      ctx.rotate(this.angle);
      ctx.strokeStyle = hornConfig.color;
      ctx.shadowColor = hornConfig.glow;
      ctx.shadowBlur = 10;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(22, -14);
      ctx.quadraticCurveTo(42, -22, 46, -6);
      ctx.moveTo(22, 14);
      ctx.quadraticCurveTo(42, 22, 46, 6);
      ctx.stroke();
      ctx.restore();
    }

    // Stun stars indicator
    if (this.stunTimer > 0) {
      ctx.save();
      ctx.fillStyle = '#fde047';
      for (let i = 0; i < 3; i++) {
        const a = time * 6 + (i * Math.PI * 2) / 3;
        const sx = this.x + Math.cos(a) * 26;
        const sy = this.y - airLift - 36 + Math.sin(a) * 9;
        ctx.beginPath();
        ctx.arc(sx, sy, 4, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    ctx.restore();
  }

  drawVectorBuffalo(ctx, hornConfig, time) {
    const breath = 1 + Math.sin(time * 5) * 0.025;
    ctx.scale(breath, breath);

    // Tail
    ctx.strokeStyle = this.bodyColor;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(-34, 0);
    ctx.quadraticCurveTo(-44, Math.sin(time * 8) * 6, -48, Math.sin(time * 8) * 10);
    ctx.stroke();

    // Muscular torso (Top-down)
    ctx.fillStyle = this.isLinhNguu() ? '#7c2d12' : this.bodyColor;
    ctx.strokeStyle = '#0f0907';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.ellipse(-4, 0, 32, 21, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Shoulders & back markings
    ctx.strokeStyle = this.isLinhNguu() ? '#fde047' : this.accentColor;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(-2, 0, 20, 11, 0, 0, Math.PI * 2);
    ctx.stroke();

    // Red silk scarf knot on Ông Cầu Hắc Phong
    if (this.isPlayer) {
      ctx.fillStyle = '#dc2626';
      ctx.beginPath();
      ctx.ellipse(15, 0, 6, 15, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // Head
    ctx.fillStyle = this.isLinhNguu() ? '#9a3412' : this.bodyColor;
    ctx.strokeStyle = '#0f0907';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(24, 0, 14, 12, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Curved sharp horns
    const hornColor = this.isPlayer && hornConfig ? hornConfig.color : this.accentColor;
    ctx.fillStyle = hornColor;
    ctx.strokeStyle = '#111827';
    ctx.lineWidth = 1.8;

    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(22, side * 9);
      ctx.quadraticCurveTo(38, side * 28, 46, side * 12);
      ctx.quadraticCurveTo(36, side * 18, 26, side * 6);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }

    // Glowing eyes
    ctx.fillStyle = this.isLinhNguu() ? '#fde047' : this.isPlayer ? '#ef4444' : '#38bdf8';
    ctx.beginPath();
    ctx.arc(31, -6, 2.5, 0, Math.PI * 2);
    ctx.arc(31, 6, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }
}
