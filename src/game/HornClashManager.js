import { GAME_CONFIG } from './config.js';

export class HornClashManager {
  constructor(soundManager) {
    this.soundManager = soundManager;
    this.active = false;
    this.timer = 0;
    this.gauge = GAME_CONFIG.CLASH.START_GAUGE;
    this.x = GAME_CONFIG.ARENA_CENTER_X;
    this.y = GAME_CONFIG.ARENA_CENTER_Y;
    this.sparkTimer = 0;
    this.lastClashBeat = -1;
  }

  start(player, enemy, currentBeatIndex) {
    this.active = true;
    this.timer = GAME_CONFIG.CLASH.DURATION;
    this.gauge = GAME_CONFIG.CLASH.START_GAUGE;
    this.x = (player.x + enemy.x) * 0.5;
    this.y = (player.y + enemy.y) * 0.5;
    this.lastClashBeat = currentBeatIndex;
    player.state = 'CLASHING';
    enemy.state = 'CLASHING';
    player.vx = 0;
    player.vy = 0;
    enemy.vx = 0;
    enemy.vy = 0;
    this.soundManager.playClashStart();
  }

  onPlayerInput(timingResult) {
    if (!this.active) return;
    if (timingResult.judgment === 'PERFECT') {
      this.gauge = Math.min(100, this.gauge + GAME_CONFIG.CLASH.PERFECT_PUSH);
    } else if (timingResult.judgment === 'GOOD') {
      this.gauge = Math.min(100, this.gauge + GAME_CONFIG.CLASH.GOOD_PUSH);
    } else {
      this.gauge = Math.max(0, this.gauge + GAME_CONFIG.CLASH.MISS_PUSH);
    }
  }

  update(dt, player, enemy, roundConfig, beatIndex, spawnSparks, spawnFloatingText) {
    if (!this.active) return null;

    this.timer -= dt;
    this.sparkTimer -= dt;

    // Position the two buffaloes horn-to-horn around clash point
    const ang = Math.atan2(enemy.y - player.y, enemy.x - player.x);
    const halfGap = GAME_CONFIG.CLASH_DISTANCE * 0.46;
    const jitter = Math.sin(this.timer * 48) * 2.5;
    player.x = this.x - Math.cos(ang) * (halfGap + jitter);
    player.y = this.y - Math.sin(ang) * (halfGap + jitter);
    enemy.x = this.x + Math.cos(ang) * (halfGap - jitter);
    enemy.y = this.y + Math.sin(ang) * (halfGap - jitter);
    player.angle = ang;
    enemy.angle = ang + Math.PI;

    if (this.sparkTimer <= 0) {
      this.sparkTimer = 0.06;
      spawnSparks(this.x, this.y, 4);
    }

    // AI pushes back on every drum beat
    if (beatIndex > this.lastClashBeat) {
      this.lastClashBeat = beatIndex;
      this.gauge = Math.max(0, this.gauge - roundConfig.clashPushPerBeat);
      spawnSparks(this.x, this.y, 8);
    }

    if (this.timer <= 0 || this.gauge >= 100 || this.gauge <= 0) {
      const playerWon = this.gauge >= 50;
      this.active = false;
      player.state = 'IDLE';
      enemy.state = 'IDLE';
      this.soundManager.playClashResolve(playerWon);

      const dirX = Math.cos(ang);
      const dirY = Math.sin(ang);

      if (playerWon) {
        enemy.applyDamage(GAME_CONFIG.CLASH.WIN_DAMAGE);
        enemy.applyKnockback(
          dirX * GAME_CONFIG.CLASH.WIN_KNOCKBACK,
          dirY * GAME_CONFIG.CLASH.WIN_KNOCKBACK,
          true
        );
        player.addHype(GAME_CONFIG.CLASH.WIN_HYPE);
        player.addRage(GAME_CONFIG.RAGE.GAIN_ON_CLASH_WIN);
        enemy.addRage(GAME_CONFIG.RAGE.GAIN_ON_TAKEN_HIT);
        spawnFloatingText(enemy.x, enemy.y - 45, 'THẮNG ĐẤU SỪNG!', '#fde047');
      } else {
        player.applyDamage(GAME_CONFIG.CLASH.LOSE_DAMAGE);
        player.applyKnockback(
          -dirX * GAME_CONFIG.CLASH.LOSE_KNOCKBACK,
          -dirY * GAME_CONFIG.CLASH.LOSE_KNOCKBACK,
          true
        );
        enemy.addRage(GAME_CONFIG.RAGE.GAIN_ON_CLASH_WIN);
        player.addRage(GAME_CONFIG.RAGE.GAIN_ON_TAKEN_HIT);
        spawnFloatingText(player.x, player.y - 45, 'THUA ĐẤU SỪNG!', '#ef4444');
      }

      return { resolved: true, playerWon };
    }

    return null;
  }

  renderGauge(ctx) {
    if (!this.active) return;
    const gx = this.x;
    const gy = Math.max(105, this.y - 84);
    const barW = 200;
    const barH = 18;

    ctx.save();
    ctx.fillStyle = 'rgba(12, 7, 5, 0.92)';
    ctx.strokeStyle = '#f5b82e';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(gx - barW / 2, gy - barH / 2, barW, barH, 9);
    ctx.fill();
    ctx.stroke();

    // Player push fill (left to gauge%)
    const fillW = (this.gauge / 100) * (barW - 4);
    ctx.fillStyle = this.gauge >= 50 ? '#f5b82e' : '#ef4444';
    ctx.beginPath();
    ctx.roundRect(gx - barW / 2 + 2, gy - barH / 2 + 2, fillW, barH - 4, 7);
    ctx.fill();

    // Center 50% marker
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(gx, gy - barH / 2 - 2);
    ctx.lineTo(gx, gy + barH / 2 + 2);
    ctx.stroke();

    // Remaining seconds
    ctx.font = '700 12px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#fef08a';
    ctx.fillText(`${Math.max(0, this.timer).toFixed(1)}s`, gx, gy - 14);
    ctx.restore();
  }
}
