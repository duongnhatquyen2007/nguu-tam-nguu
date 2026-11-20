import { GAME_CONFIG } from './config.js';

export class ArenaRingPhysics {
  constructor(soundManager) {
    this.soundManager = soundManager;
    this.shockwaves = [];
    this.lightningBolts = [];
  }

  reset() {
    this.shockwaves = [];
    this.lightningBolts = [];
  }

  spawnLightningBolt(x, y) {
    const segments = [];
    const topY = Math.max(0, y - 340);
    const steps = 7;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const jitter = i === 0 || i === steps ? 0 : (Math.random() - 0.5) * 26;
      segments.push({
        x: x + jitter,
        y: topY + (y - topY) * t,
      });
    }
    this.lightningBolts.push({
      x,
      y,
      segments,
      life: 0.34,
      maxLife: 0.34,
    });
  }

  spawnShockwave(x, y, maxRadius, speed, ownerIsPlayer, color, isThunder = false) {
    this.shockwaves.push({
      x,
      y,
      radius: 20,
      maxRadius,
      speed,
      ownerIsPlayer,
      color,
      isThunder,
      hitTarget: false,
    });
  }

  updateMovementAndBounds(dt, player, enemy, hoofMarks) {
    const entities = [player, enemy];

    // Auto-Engage & Magnetic Tether when in IDLE or MOVING
    const dx = enemy.x - player.x;
    const dy = enemy.y - player.y;
    const pairDist = Math.hypot(dx, dy) || 0.001;
    const anglePtoE = Math.atan2(dy, dx);

    if (player.state === 'IDLE' || player.state === 'MOVING') {
      player.angle = anglePtoE;
    }
    if (enemy.state === 'IDLE' || enemy.state === 'MOVING') {
      enemy.angle = anglePtoE + Math.PI;
    }

    // Auto-approach up to ENGAGE_DISTANCE = 110px (paused while knocked back!)
    for (const ent of entities) {
      if ((ent.state === 'IDLE' || ent.state === 'MOVING') && ent.knockbackTimer <= 0) {
        const targetAngle = ent.isPlayer ? anglePtoE : anglePtoE + Math.PI;
        if (pairDist > GAME_CONFIG.ENGAGE_DISTANCE) {
          ent.state = 'MOVING';
          ent.vx += Math.cos(targetAngle) * GAME_CONFIG.AUTO_ACCEL * dt;
          ent.vy += Math.sin(targetAngle) * GAME_CONFIG.AUTO_ACCEL * dt;
        } else {
          ent.state = 'IDLE';
        }

        const spd = Math.hypot(ent.vx, ent.vy);
        if (spd > ent.maxSpeed && pairDist > GAME_CONFIG.ENGAGE_DISTANCE * 0.8) {
          if (spd < ent.maxSpeed * 1.35) {
            ent.vx = (ent.vx / spd) * ent.maxSpeed;
            ent.vy = (ent.vy / spd) * ent.maxSpeed;
          }
        }
      } else if (ent.state === 'DODGE') {
        // Steer dodge tangentially around opponent & slightly inward if near boundary
        const other = ent.isPlayer ? enemy : player;
        const toOtherAng = Math.atan2(other.y - ent.y, other.x - ent.x);
        const tangentAng = toOtherAng + (Math.PI / 2) * ent.dodgeDir;
        const distC = Math.hypot(ent.x - GAME_CONFIG.ARENA_CENTER_X, ent.y - GAME_CONFIG.ARENA_CENTER_Y);
        const edgeBias = distC > GAME_CONFIG.ARENA_RADIUS * 0.65 ? 0.35 : 0.08;
        const toCenterAng = Math.atan2(GAME_CONFIG.ARENA_CENTER_Y - ent.y, GAME_CONFIG.ARENA_CENTER_X - ent.x);
        const dodgeSpeed = GAME_CONFIG.SKILLS.NE.dodgeSpeed;
        const steerX = Math.cos(tangentAng) * (1 - edgeBias) + Math.cos(toCenterAng) * edgeBias;
        const steerY = Math.sin(tangentAng) * (1 - edgeBias) + Math.sin(toCenterAng) * edgeBias;
        const norm = Math.hypot(steerX, steerY) || 1;
        ent.vx = (steerX / norm) * dodgeSpeed;
        ent.vy = (steerY / norm) * dodgeSpeed;
        ent.angle = toOtherAng;
      }
    }

    // Apply position & ground friction (lighter friction when sliding from knockback)
    const normalDecay = Math.max(0, 1 - GAME_CONFIG.GROUND_FRICTION * dt);
    const knockbackDecay = Math.max(0, 1 - GAME_CONFIG.KNOCKBACK.FRICTION * dt);
    for (const ent of entities) {
      if (ent.state === 'CLASHING') continue;

      ent.x += ent.vx * dt;
      ent.y += ent.vy * dt;

      if (ent.state !== 'ATTACK' && ent.state !== 'DODGE') {
        const decay = ent.knockbackTimer > 0 ? knockbackDecay : normalDecay;
        ent.vx *= decay;
        ent.vy *= decay;
      }

      // Emit hoof / skid marks when moving fast or launched
      const spd = Math.hypot(ent.vx, ent.vy);
      if ((spd > 130 || ent.knockbackTimer > 0) && Math.random() < dt * 18) {
        hoofMarks.push({
          x: ent.x + (Math.random() - 0.5) * 18,
          y: ent.y + (Math.random() - 0.5) * 18,
          r: ent.knockbackTimer > 0 ? 6 + Math.random() * 4 : 4 + Math.random() * 3,
          angle: ent.angle,
          alpha: ent.knockbackTimer > 0 ? 0.9 : 0.75,
        });
        if (hoofMarks.length > 70) hoofMarks.shift();
      }
    }

    // Prevent entity overlap (soft circle separation when not clashing)
    const minSep = player.radius + enemy.radius - 4;
    const ndx = enemy.x - player.x;
    const ndy = enemy.y - player.y;
    const ndist = Math.hypot(ndx, ndy) || 0.001;
    if (ndist < minSep && player.state !== 'CLASHING' && enemy.state !== 'CLASHING') {
      const overlap = (minSep - ndist) * 0.5;
      const ux = ndx / ndist;
      const uy = ndy / ndist;
      player.x -= ux * overlap;
      player.y -= uy * overlap;
      enemy.x += ux * overlap;
      enemy.y += uy * overlap;
    }

    // Update Balance & Edge Warning
    let maxWarning = 0;
    for (const ent of entities) {
      const distCenter = Math.hypot(
        ent.x - GAME_CONFIG.ARENA_CENTER_X,
        ent.y - GAME_CONFIG.ARENA_CENTER_Y
      );
      const safeR = GAME_CONFIG.ARENA_RADIUS * GAME_CONFIG.BALANCE_SAFE_RATIO;
      if (distCenter <= safeR) {
        ent.balance = 100;
      } else {
        const ratio = Math.min(
          1,
          (distCenter - safeR) / (GAME_CONFIG.ARENA_RADIUS - safeR)
        );
        ent.balance = Math.max(GAME_CONFIG.BALANCE_MIN, 100 - 75 * ratio);
      }

      const warnR = GAME_CONFIG.ARENA_RADIUS * GAME_CONFIG.WARNING_RADIUS_RATIO;
      if (distCenter >= warnR) {
        const intensity = Math.min(
          1,
          (distCenter - warnR) / (GAME_CONFIG.ARENA_RADIUS - warnR)
        );
        maxWarning = Math.max(maxWarning, intensity);
      }
    }

    return maxWarning;
  }

  resolveCombat(dt, player, enemy, clashManager, currentBeatIndex, fx) {
    const dx = enemy.x - player.x;
    const dy = enemy.y - player.y;
    const dist = Math.hypot(dx, dy) || 0.001;
    const ux = dx / dist;
    const uy = dy / dist;

    // 1. Check Horn-Lock Clash trigger (HUC vs HUC or LAO vs LAO at <= 85px)
    if (
      !clashManager.active &&
      player.state === 'ATTACK' &&
      enemy.state === 'ATTACK' &&
      dist <= GAME_CONFIG.CLASH_DISTANCE
    ) {
      const sameClashSkill =
        (player.activeSkill === 'HUC' && enemy.activeSkill === 'HUC') ||
        (player.activeSkill === 'LAO' && enemy.activeSkill === 'LAO');
      if (sameClashSkill) {
        clashManager.start(player, enemy, currentBeatIndex);
        fx.triggerShake(22, 0.35);
        fx.spawnFloatingText(
          (player.x + enemy.x) * 0.5,
          (player.y + enemy.y) * 0.5 - 50,
          'ĐẤU SỪNG!',
          '#fde047'
        );
        return;
      }
    }

    // 2. Check Dodging Sidestep & Pin Counter (NE)
    this.checkDodgeCounter(player, enemy, fx);
    this.checkDodgeCounter(enemy, player, fx);

    // 3. Resolve Active Attacks according to Counter Matrix
    this.resolveSingleAttack(player, enemy, ux, uy, dist, fx);
    this.resolveSingleAttack(enemy, player, -ux, -uy, dist, fx);

    // 4. Update & Resolve Boss Thunder Stomp Shockwaves
    for (let i = this.shockwaves.length - 1; i >= 0; i--) {
      const sw = this.shockwaves[i];
      sw.radius += sw.speed * dt;
      if (sw.isThunder && !sw.hitTarget) {
        const target = sw.ownerIsPlayer ? enemy : player;
        const dToWave = Math.hypot(target.x - sw.x, target.y - sw.y);
        if (Math.abs(dToWave - sw.radius) < 28) {
          sw.hitTarget = true;
          if (target.invulnTimer > 0) {
            // Dodged cleanly with NE!
            target.addHype(15);
            target.addRage(GAME_CONFIG.RAGE.GAIN_ON_DODGE);
            fx.spawnFloatingText(target.x, target.y - 42, 'NÉ SÓNG! +15% SĨ KHÍ', '#2dd4bf');
          } else {
            const round3 = GAME_CONFIG.ROUNDS[2];
            const reduce =
              target.isLinhNguu() && target.rageSkillId === 'skill_thach_son_bat_hoai'
                ? 0.4
                : target.isLinhNguu()
                  ? 0.55
                  : 1.0;
            const defRed = 100 / (100 + target.defense * 2.0);
            target.applyDamage(round3.thunderStompDamage * reduce * defRed);
            target.addRage(GAME_CONFIG.RAGE.GAIN_ON_TAKEN_HIT);
            const ang = Math.atan2(target.y - sw.y, target.x - sw.x);
            const poise = target.getPoiseMultiplier(false);
            const balMult = 1 + ((100 - target.balance) / 100) * GAME_CONFIG.BALANCE_KNOCKBACK_FACTOR;
            const imp = round3.thunderStompKnockback * poise * balMult;
            target.applyKnockback(Math.cos(ang) * imp, Math.sin(ang) * imp, false);
            target.applyStun(round3.thunderStompStun);
            this.soundManager.playImpact(true);
            fx.triggerShake(18, 0.25);
            fx.spawnFloatingText(target.x, target.y - 42, 'LÔI CHẤN!', '#c084fc');
          }
        }
      }
      if (sw.radius >= sw.maxRadius) {
        this.shockwaves.splice(i, 1);
      }
    }

    // 5. Update vertical lightning bolts (Thần Ngưu Lôi Đình Rage Skill)
    for (let i = this.lightningBolts.length - 1; i >= 0; i--) {
      this.lightningBolts[i].life -= dt;
      if (this.lightningBolts[i].life <= 0) {
        this.lightningBolts.splice(i, 1);
      }
    }
  }

  checkDodgeCounter(dodger, attacker, fx) {
    if (dodger.state !== 'DODGE' || dodger.dodgeCounterUsed) return;
    if (attacker.state !== 'ATTACK' || attacker.hasHitCurrentAttack) return;
    if (attacker.activeSkill !== 'HUC' && attacker.activeSkill !== 'MOC') return;

    const dist = Math.hypot(attacker.x - dodger.x, attacker.y - dodger.y);
    if (dist <= 132) {
      dodger.dodgeCounterUsed = true;
      attacker.hasHitCurrentAttack = true;
      const skill = GAME_CONFIG.SKILLS.NE;

      // Push attacker toward the nearest boundary edge
      const dirToEdgeX = attacker.x - GAME_CONFIG.ARENA_CENTER_X;
      const dirToEdgeY = attacker.y - GAME_CONFIG.ARENA_CENTER_Y;
      const edgeLen = Math.hypot(dirToEdgeX, dirToEdgeY) || 1;
      const px = dirToEdgeX / edgeLen;
      const py = dirToEdgeY / edgeLen;

      const rhythmMult = dodger.isAutoPerfect() ? 1.45 : dodger.activeTiming?.multiplier || 1.0;
      const linhMult = dodger.isLinhNguu() ? GAME_CONFIG.LINH_NGUU.DAMAGE_MULTIPLIER : 1.0;
      const weakStackMult = 1 + dodger.weakPointStacks * GAME_CONFIG.WEAK_POINT.STACK_DAMAGE_BONUS;
      const balMult = 1 + ((100 - attacker.balance) / 100) * GAME_CONFIG.BALANCE_KNOCKBACK_FACTOR;
      const poise = attacker.getPoiseMultiplier(dodger.activeTiming?.judgment === 'PERFECT');

      const atkScale = dodger.attack / 15;
      const defReduction = 100 / (100 + attacker.defense * 2.5);
      const kbScale = Math.max(0.85, Math.min(1.8, dodger.knockbackStat / 12));

      let dmg =
        skill.damage *
        rhythmMult *
        linhMult *
        weakStackMult *
        atkScale *
        defReduction *
        1.25;

      // Bạch Tạng Thạch Sơn Bất Hoại (-60% incoming + 30% reflect)
      if (attacker.isLinhNguu() && attacker.rageSkillId === 'skill_thach_son_bat_hoai') {
        const reflected = dmg * 0.3 * attacker.getRageEffectMultiplier();
        dmg *= 0.4;
        dodger.applyDamage(reflected);
        fx.spawnFloatingText(dodger.x, dodger.y - 72, `PHẢN ĐÒN -${Math.round(reflected)}`, '#cbd5e1');
      }

      dodger.addWeakPointStack();
      dodger.addRage(GAME_CONFIG.RAGE.GAIN_ON_DODGE + GAME_CONFIG.RAGE.GAIN_ON_WEAK_POINT);
      attacker.addRage(GAME_CONFIG.RAGE.GAIN_ON_TAKEN_HIT);

      attacker.applyDamage(dmg);
      const impulse = skill.knockback * rhythmMult * balMult * poise * kbScale;
      attacker.applyKnockback(px * impulse, py * impulse, false);

      this.soundManager.playCounterCrit();
      fx.triggerShake(14, 0.22);
      fx.spawnMudBurst(attacker.x, attacker.y);
      fx.spawnFloatingText(
        dodger.x,
        dodger.y - 44,
        `GHÌ SỪNG ĐIỂM YẾU! (${dodger.weakPointStacks}/5)`,
        '#2dd4bf'
      );
    }
  }

  evaluateWeakPointHit(attacker, defender, isCritCounter) {
    if (isCritCounter || attacker.activeSkill === 'NO' || attacker.flankAdvantageTimer > 0) {
      return true;
    }
    if (defender.exposedWeakSide === 'FRONT') {
      return true;
    }
    // Check attack vector relative to defender's facing angle
    const atkAng = Math.atan2(attacker.y - defender.y, attacker.x - defender.x);
    let rel = atkAng - defender.angle;
    while (rel > Math.PI) rel -= Math.PI * 2;
    while (rel < -Math.PI) rel += Math.PI * 2;
    if (defender.exposedWeakSide === 'LEFT' && rel < -0.25) return true;
    if (defender.exposedWeakSide === 'RIGHT' && rel > 0.25) return true;
    return false;
  }

  resolveSingleAttack(attacker, defender, ux, uy, dist, fx) {
    if (attacker.state !== 'ATTACK' || attacker.hasHitCurrentAttack) return;
    const skill = GAME_CONFIG.SKILLS[attacker.activeSkill];
    if (!skill || dist > skill.range) return;

    // Defender invincible via Sidestep (NE)
    if (defender.invulnTimer > 0) {
      attacker.hasHitCurrentAttack = true;
      defender.addRage(GAME_CONFIG.RAGE.GAIN_ON_DODGE);
      fx.spawnFloatingText(defender.x, defender.y - 40, 'NÉ ĐÒN! +NỘ', '#2dd4bf');
      return;
    }

    // Counter Matrix checks when defender is also attacking
    let isCritCounter = false;
    if (defender.state === 'ATTACK' || defender.state === 'WINDUP') {
      if (attacker.activeSkill === 'NO') {
        // Chiêu Nộ breaks normal opponent attacks cleanly!
        if (defender.activeSkill !== 'NO') {
          defender.state = 'IDLE';
          defender.activeSkill = null;
        }
      } else if (defender.activeSkill === 'NO' && defender.state === 'ATTACK') {
        return;
      } else if (attacker.activeSkill === 'MOC' && defender.activeSkill === 'LAO') {
        // Móc Cống critically counters Hổ Lao!
        isCritCounter = true;
        defender.state = 'IDLE';
        defender.activeSkill = null;
        defender.applyStun(skill.stunDuration);
      } else if (attacker.activeSkill === 'LAO' && defender.activeSkill === 'MOC' && defender.state === 'ATTACK') {
        return;
      } else if (attacker.activeSkill === 'HUC' && defender.activeSkill === 'LAO' && defender.state === 'ATTACK') {
        return;
      } else if (attacker.activeSkill === 'HUC' && defender.activeSkill === 'MOC') {
        defender.state = 'IDLE';
        defender.activeSkill = null;
      }
    }

    attacker.hasHitCurrentAttack = true;

    const timing = attacker.isAutoPerfect()
      ? { judgment: 'PERFECT', multiplier: GAME_CONFIG.TIMING_REWARDS.PERFECT.multiplier }
      : attacker.activeTiming || { judgment: 'GOOD', multiplier: 1.0 };

    const wasPerfect = timing.judgment === 'PERFECT';
    const wasOnBeat = timing.judgment === 'PERFECT' || timing.judgment === 'GOOD';
    const isRageUlt = attacker.activeSkill === 'NO';
    const isWeakHit = this.evaluateWeakPointHit(attacker, defender, isCritCounter);

    let weakStackCount = attacker.weakPointStacks;
    if (isWeakHit) {
      weakStackCount = attacker.addWeakPointStack();
      attacker.flankAdvantageTimer = 0;
      defender.cycleWeakSide();
    }

    const atkScale = attacker.attack / 15;
    const defReduction = 100 / (100 + defender.defense * 2.5);
    const kbScale = Math.max(0.85, Math.min(1.8, attacker.knockbackStat / 12));

    const weakStackMult = 1 + weakStackCount * GAME_CONFIG.WEAK_POINT.STACK_DAMAGE_BONUS;
    const weakCritMult = isWeakHit ? GAME_CONFIG.WEAK_POINT.HIT_CRIT_MULTIPLIER : 1.0;
    const linhDmgMult = attacker.isLinhNguu()
      ? GAME_CONFIG.LINH_NGUU.DAMAGE_MULTIPLIER * attacker.getRageEffectMultiplier()
      : 1.0;

    let linhKbMult = 1.0;
    if (attacker.isLinhNguu()) {
      linhKbMult = GAME_CONFIG.LINH_NGUU.KNOCKBACK_MULTIPLIER;
      if (attacker.rageSkillId === 'skill_hai_long_cuon_song') {
        // +50% knockback scaled by skillLevel
        linhKbMult = 1 + 0.5 * attacker.getRageEffectMultiplier();
      }
    }

    const counterDmgMult = isCritCounter ? skill.counterLaoDamageMultiplier : 1.0;

    let finalDmg =
      skill.damage *
      timing.multiplier *
      linhDmgMult *
      counterDmgMult *
      weakStackMult *
      weakCritMult *
      atkScale *
      defReduction *
      1.25;

    // Bạch Tạng Sơn Cước: Thạch Sơn Bất Hoại (-60% incoming damage, reflects 30% damage)
    let reflectedDmg = 0;
    if (defender.isLinhNguu() && defender.rageSkillId === 'skill_thach_son_bat_hoai') {
      reflectedDmg = finalDmg * 0.3 * defender.getRageEffectMultiplier();
      finalDmg *= 0.4;
      attacker.applyDamage(reflectedDmg);
      fx.spawnFloatingText(
        attacker.x,
        attacker.y - 68,
        `THẠCH SƠN PHẢN -${Math.round(reflectedDmg)}`,
        '#e2e8f0'
      );
    }

    // Launch / Hất Văng chance!
    const heavy = isRageUlt || attacker.activeSkill === 'LAO' || attacker.activeSkill === 'MOC' || isCritCounter;
    const launchChance = heavy
      ? GAME_CONFIG.KNOCKBACK.LAUNCH_CHANCE_HEAVY
      : GAME_CONFIG.KNOCKBACK.LAUNCH_CHANCE_BASE;
    const isLaunch =
      isRageUlt ||
      (wasPerfect && isWeakHit) ||
      Math.random() < launchChance;

    const balMult = 1 + ((100 - defender.balance) / 100) * GAME_CONFIG.BALANCE_KNOCKBACK_FACTOR;
    const poise = defender.getPoiseMultiplier(wasPerfect || isRageUlt);
    const launchMult = isLaunch ? GAME_CONFIG.KNOCKBACK.LAUNCH_MULTIPLIER : 1.0;
    const finalImpulse =
      skill.knockback * timing.multiplier * linhKbMult * balMult * poise * launchMult * kbScale;

    // Xích Hỏa Hải Long Rage Skill: pull/steer push vector toward the nearest white chalk boundary edge
    let pushX = ux;
    let pushY = uy;
    if (attacker.isLinhNguu() && attacker.rageSkillId === 'skill_hai_long_cuon_song') {
      const ex = defender.x - GAME_CONFIG.ARENA_CENTER_X;
      const ey = defender.y - GAME_CONFIG.ARENA_CENTER_Y;
      const eLen = Math.hypot(ex, ey) || 1;
      const blendX = ux * 0.55 + (ex / eLen) * 0.45;
      const blendY = uy * 0.55 + (ey / eLen) * 0.45;
      const bLen = Math.hypot(blendX, blendY) || 1;
      pushX = blendX / bLen;
      pushY = blendY / bLen;
    }

    defender.applyDamage(finalDmg);
    defender.applyKnockback(pushX * finalImpulse, pushY * finalImpulse, isLaunch);

    // Thần Ngưu Lôi Đình Rage Skill: on-beat hits summon a vertical lightning bolt onto opponent's head
    if (
      attacker.isLinhNguu() &&
      attacker.rageSkillId === 'skill_loi_dinh_giang_the' &&
      wasOnBeat
    ) {
      const trueLightningDmg = 10 * attacker.getRageEffectMultiplier();
      defender.applyDamage(trueLightningDmg);
      defender.applyStun(0.5);
      this.spawnLightningBolt(defender.x, defender.y);
      this.soundManager.playThunderStomp();
      fx.triggerShake(16, 0.24);
      fx.spawnFloatingText(
        defender.x,
        defender.y - 88,
        `LÔI ĐÌNH! -${Math.round(trueLightningDmg)} CHUẨN`,
        '#38bdf8'
      );
    }

    // Rage accumulation
    if (!isRageUlt) {
      const rageGain =
        GAME_CONFIG.RAGE.GAIN_ON_HIT +
        (wasPerfect ? GAME_CONFIG.RAGE.GAIN_ON_PERFECT_BONUS : 0) +
        (isWeakHit ? GAME_CONFIG.RAGE.GAIN_ON_WEAK_POINT : 0);
      attacker.addRage(rageGain);
    }
    defender.addRage(GAME_CONFIG.RAGE.GAIN_ON_TAKEN_HIT);

    if (skill.stunDuration > 0) {
      defender.applyStun(skill.stunDuration);
    }

    // Visual & Audio Juice
    if (isRageUlt) {
      this.soundManager.playLaunchKnockback();
      fx.spawnFloatingText(
        defender.x,
        defender.y - 60,
        `CUỒNG NỘ! -${Math.round(finalDmg)}`,
        '#f97316'
      );
    } else if (isCritCounter) {
      this.soundManager.playCounterCrit();
      fx.spawnFloatingText(defender.x, defender.y - 52, 'KHẮC CHẾ MÓC CỐNG!', '#fde047');
    } else if (isWeakHit) {
      this.soundManager.playWeakPointHit();
      fx.spawnFloatingText(
        defender.x,
        defender.y - 52,
        `ĐIỂM YẾU! (+${weakStackCount * 15}% DMG)`,
        '#fb7185'
      );
    } else if (isLaunch) {
      this.soundManager.playLaunchKnockback();
    } else {
      this.soundManager.playImpact(heavy);
    }

    if (isLaunch && !isRageUlt) {
      fx.spawnFloatingText(defender.x, defender.y - 74, 'HẤT VĂNG!', '#fde047');
    }

    if (wasPerfect || isRageUlt) {
      fx.triggerHitStop(isRageUlt ? GAME_CONFIG.HIT_STOP_DURATION * 1.4 : GAME_CONFIG.HIT_STOP_DURATION);
      this.spawnShockwave(
        (attacker.x + defender.x) * 0.5,
        (attacker.y + defender.y) * 0.5,
        isRageUlt ? 220 : 150,
        isRageUlt ? 640 : 520,
        attacker.isPlayer,
        isRageUlt ? '#f97316' : '#fde047',
        false
      );
    }

    const shakeAmp = isRageUlt ? 18 : heavy ? (wasPerfect ? 14 : 9) : isLaunch ? 11 : wasPerfect ? 6 : 4;
    const shakeDur = isRageUlt ? 0.28 : heavy ? 0.22 : 0.14;
    fx.triggerShake(shakeAmp, shakeDur);
    fx.spawnMudBurst(defender.x, defender.y);
    if (isLaunch) fx.spawnMudBurst(defender.x, defender.y);
    fx.spawnSparks(
      (attacker.x + defender.x) * 0.5,
      (attacker.y + defender.y) * 0.5,
      isRageUlt ? 16 : wasPerfect ? 12 : 6
    );
  }

  checkRoundOutcome(player, enemy, timeRemaining, beatStats) {
    // 1. Knock-Out check
    if (enemy.hp <= 0) {
      return { finished: true, winner: 'player', reason: 'KNOCK_OUT', label: 'HẠ GỤC (KNOCK-OUT)' };
    }
    if (player.hp <= 0) {
      return { finished: true, winner: 'enemy', reason: 'KNOCK_OUT', label: 'CẠN SINH LỰC (KNOCK-OUT)' };
    }

    // 2. Ring-Out check (d_center > ARENA_RADIUS = 320px)
    const dEnemy = Math.hypot(
      enemy.x - GAME_CONFIG.ARENA_CENTER_X,
      enemy.y - GAME_CONFIG.ARENA_CENTER_Y
    );
    if (dEnemy > GAME_CONFIG.ARENA_RADIUS) {
      return { finished: true, winner: 'player', reason: 'RING_OUT', label: 'RING-OUT · ĐẨY KHỎI VẠCH VÔI' };
    }

    const dPlayer = Math.hypot(
      player.x - GAME_CONFIG.ARENA_CENTER_X,
      player.y - GAME_CONFIG.ARENA_CENTER_Y
    );
    if (dPlayer > GAME_CONFIG.ARENA_RADIUS) {
      return { finished: true, winner: 'enemy', reason: 'RING_OUT', label: 'RING-OUT · RA KHỎI VẠCH VÔI' };
    }

    // 3. Time Out check (TotalScore = HP% + RemixHype%, tie-breaker by roundPerfectCount)
    if (timeRemaining <= 0) {
      const playerScore = (player.hp / player.maxHp) * 100 + player.remixHype;
      const enemyScore = (enemy.hp / enemy.maxHp) * 100 + enemy.remixHype;
      if (playerScore > enemyScore) {
        return { finished: true, winner: 'player', reason: 'TIME_OUT', label: 'THẮNG ĐIỂM HẾT GIỜ' };
      }
      if (playerScore === enemyScore && player.roundPerfectCount >= enemy.roundPerfectCount) {
        return { finished: true, winner: 'player', reason: 'TIME_OUT', label: 'THẮNG ĐIỂM HẾT GIỜ' };
      }
      return { finished: true, winner: 'enemy', reason: 'TIME_OUT', label: 'THUA ĐIỂM HẾT GIỜ' };
    }

    return { finished: false };
  }

  renderShockwaves(ctx) {
    for (const sw of this.shockwaves) {
      const alpha = Math.max(0, 1 - sw.radius / sw.maxRadius);
      ctx.save();
      ctx.strokeStyle = sw.isThunder
        ? `rgba(168, 85, 247, ${alpha * 0.95})`
        : `rgba(253, 224, 71, ${alpha * 0.9})`;
      ctx.lineWidth = sw.isThunder ? 8 : 5;
      ctx.beginPath();
      ctx.arc(sw.x, sw.y, sw.radius, 0, Math.PI * 2);
      ctx.stroke();

      if (sw.isThunder) {
        ctx.strokeStyle = `rgba(56, 189, 248, ${alpha * 0.85})`;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(sw.x, sw.y, Math.max(4, sw.radius - 10), 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();
    }

    // Vertical Lightning Bolts (Thần Ngưu Lôi Đình Rage Skill)
    for (const lb of this.lightningBolts) {
      const alpha = Math.max(0, lb.life / lb.maxLife);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = '#38bdf8';
      ctx.shadowColor = '#7dd3fc';
      ctx.shadowBlur = 18;
      ctx.lineWidth = 7;
      ctx.beginPath();
      lb.segments.forEach((pt, idx) => {
        if (idx === 0) ctx.moveTo(pt.x, pt.y);
        else ctx.lineTo(pt.x, pt.y);
      });
      ctx.stroke();

      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2.5;
      ctx.stroke();

      ctx.fillStyle = 'rgba(56, 189, 248, 0.45)';
      ctx.beginPath();
      ctx.arc(lb.x, lb.y, 28 * (1 - alpha * 0.5), 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }
}
