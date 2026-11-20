import { GAME_CONFIG } from './config.js';

export class RhythmBeatEngine {
  constructor(soundManager) {
    this.soundManager = soundManager;
    this.bpm = 115;
    this.beatDuration = 60 / 115;
    this.anchorTime = 0;
    this.pausedAccum = 0;
    this.lastBeatIndex = -1;
    this.beatPhase = 0;
    this.beatPulse = 0;
    this.onBeatCallbacks = [];

    this.beatCombo = 0;
    this.maxComboInMatch = 0;
    this.perfectCount = 0;
    this.goodCount = 0;
    this.missCount = 0;
  }

  reset(bpm) {
    this.bpm = bpm;
    this.beatDuration = 60 / bpm;
    this.anchorTime = this.soundManager.getTime();
    this.lastBeatIndex = -1;
    this.beatPhase = 0;
    this.beatPulse = 1;
    this.beatCombo = 0;
    this.onBeatCallbacks = [];
  }

  resetMatchCounters() {
    this.beatCombo = 0;
    this.maxComboInMatch = 0;
    this.perfectCount = 0;
    this.goodCount = 0;
    this.missCount = 0;
  }

  shiftAnchorAfterPause(pauseDurationSec) {
    this.anchorTime += pauseDurationSec;
  }

  onBeat(cb) {
    this.onBeatCallbacks.push(cb);
  }

  update(dt) {
    this.soundManager.updateScheduler();

    const now = this.soundManager.getTime();
    const elapsed = Math.max(0, now - this.anchorTime);
    const beatFloat = elapsed / this.beatDuration;
    const currentBeatIdx = Math.floor(beatFloat);
    this.beatPhase = beatFloat - currentBeatIdx;

    if (currentBeatIdx > this.lastBeatIndex) {
      this.lastBeatIndex = currentBeatIdx;
      this.beatPulse = 1.0;
      for (const cb of this.onBeatCallbacks) {
        cb(currentBeatIdx);
      }
    } else {
      this.beatPulse = Math.max(0, this.beatPulse - dt * 3.2);
    }
  }

  getTimeDeltaToNearestBeat() {
    const now = this.soundManager.getTime();
    const elapsed = Math.max(0, now - this.anchorTime);
    const beatFloat = elapsed / this.beatDuration;
    const nearestIdx = Math.round(beatFloat);
    const nearestTime = this.anchorTime + nearestIdx * this.beatDuration;
    return Math.abs(now - nearestTime);
  }

  evaluateInputTiming(forcePerfect = false) {
    const delta = forcePerfect ? 0 : this.getTimeDeltaToNearestBeat();
    let judgment = 'MISS';
    if (delta <= GAME_CONFIG.TIMING_WINDOWS.PERFECT) {
      judgment = 'PERFECT';
      this.perfectCount += 1;
      this.beatCombo += 1;
      if (this.beatCombo > this.maxComboInMatch) {
        this.maxComboInMatch = this.beatCombo;
      }
    } else if (delta <= GAME_CONFIG.TIMING_WINDOWS.GOOD) {
      judgment = 'GOOD';
      this.goodCount += 1;
      this.beatCombo += 1;
      if (this.beatCombo > this.maxComboInMatch) {
        this.maxComboInMatch = this.beatCombo;
      }
    } else {
      judgment = 'MISS';
      this.missCount += 1;
      this.beatCombo = 0;
    }

    const reward = GAME_CONFIG.TIMING_REWARDS[judgment];
    this.soundManager.playTimingFeedback(judgment);

    return {
      judgment,
      deltaMs: Math.round(delta * 1000),
      label: reward.label,
      multiplier: reward.multiplier,
      hypeGain: reward.hypeGain,
      staminaGain: reward.staminaGain,
      color: reward.color,
    };
  }

  // Beat Ring converging under Ông Cầu Hắc Phong
  renderBeatRing(ctx, x, y, linhNguuActive) {
    const baseRadius = 46;
    const maxExtra = 52;
    // As beatPhase goes 0 -> 1, ring shrinks from baseRadius + maxExtra down to baseRadius
    const remaining = 1 - this.beatPhase;
    const ringRadius = baseRadius + remaining * maxExtra;
    const inPerfectWindow =
      this.beatPhase * this.beatDuration <= GAME_CONFIG.TIMING_WINDOWS.PERFECT ||
      remaining * this.beatDuration <= GAME_CONFIG.TIMING_WINDOWS.PERFECT;

    ctx.save();
    // Fixed target ring
    ctx.strokeStyle = linhNguuActive
      ? 'rgba(253, 224, 71, 0.85)'
      : 'rgba(255, 248, 225, 0.55)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(x, y, baseRadius, 0, Math.PI * 2);
    ctx.stroke();

    // Perfect target glow when inside timing window
    if (inPerfectWindow || this.beatPulse > 0.65) {
      ctx.strokeStyle = 'rgba(253, 224, 71, 0.95)';
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.arc(x, y, baseRadius, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Shrinking beat ring
    ctx.strokeStyle = inPerfectWindow
      ? '#fde047'
      : remaining < 0.25
        ? '#2dd4bf'
        : 'rgba(251, 146, 60, 0.82)';
    ctx.lineWidth = inPerfectWindow ? 4 : 2.5;
    ctx.beginPath();
    ctx.arc(x, y, ringRadius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  // Bottom Beat Bar synchronized with the same Audio DSP clock
  renderBeatBar(ctx, canvasWidth, canvasHeight, assets) {
    const barW = 460;
    const barH = 44;
    const barX = (canvasWidth - barW) / 2;
    const barY = canvasHeight - barH - 12;
    const centerX = canvasWidth / 2;
    const centerY = barY + barH / 2;

    ctx.save();
    // Bar backdrop
    ctx.fillStyle = 'rgba(18, 10, 8, 0.86)';
    ctx.strokeStyle = 'rgba(245, 184, 46, 0.45)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(barX, barY, barW, barH, 22);
    ctx.fill();
    ctx.stroke();

    // Sweet-spot zone
    ctx.fillStyle = `rgba(245, 184, 46, ${0.14 + this.beatPulse * 0.25})`;
    ctx.beginPath();
    ctx.arc(centerX, centerY, 20 + this.beatPulse * 4, 0, Math.PI * 2);
    ctx.fill();

    // Incoming beat markers from both left and right converging into center
    const travelHalf = barW / 2 - 22;
    for (let offsetBeat = 0; offsetBeat <= 2; offsetBeat++) {
      const progress = offsetBeat + (1 - this.beatPhase); // 0 = at center, 2 = outer edge
      if (progress > 2.1) continue;
      const dist = (progress / 2.0) * travelHalf;
      const alpha = Math.max(0.15, 1 - progress / 2.2);

      // Left note & Right note
      for (const dir of [-1, 1]) {
        const nx = centerX + dir * dist;
        ctx.fillStyle =
          progress < 0.22
            ? `rgba(253, 224, 71, ${alpha})`
            : `rgba(45, 212, 191, ${alpha})`;
        ctx.beginPath();
        ctx.roundRect(nx - 4, centerY - 12, 8, 24, 4);
        ctx.fill();
      }
    }

    // Center Bronze Drum emblem
    const drumSize = 30 + this.beatPulse * 6;
    if (assets && assets.hasTool && assets.tools.drum) {
      ctx.drawImage(
        assets.tools.drum,
        centerX - drumSize / 2,
        centerY - drumSize / 2,
        drumSize,
        drumSize
      );
    } else {
      ctx.fillStyle = '#b45309';
      ctx.strokeStyle = '#fde047';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(centerX, centerY, drumSize * 0.45, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }

    // Combo label above Beat Bar
    if (this.beatCombo > 0) {
      ctx.font = '700 13px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#fde047';
      ctx.fillText(`BEAT COMBO ×${this.beatCombo}`, centerX, barY - 6);
    }

    ctx.restore();
  }
}
