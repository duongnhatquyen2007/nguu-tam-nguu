import { GAME_CONFIG } from './config.js';

export class EnemyAI {
  constructor(soundManager) {
    this.soundManager = soundManager;
    this.beatCounter = 0;
    this.lastProcessedBeat = -1;
    this.nextDecisionBeat = 2;
    this.pendingThunderBeat = -1;
    this.pendingAttack = null;
  }

  reset(roundConfig) {
    this.roundConfig = roundConfig;
    this.beatCounter = 0;
    this.lastProcessedBeat = -1;
    this.nextDecisionBeat = Math.ceil(roundConfig.decisionBeats);
    this.pendingThunderBeat = -1;
    this.pendingAttack = null;
  }

  rollTiming() {
    const rates = this.roundConfig.timingRates;
    const r = Math.random();
    let judgment = 'MISS';
    if (r < rates.perfect) judgment = 'PERFECT';
    else if (r < rates.perfect + rates.good) judgment = 'GOOD';
    const reward = GAME_CONFIG.TIMING_REWARDS[judgment];
    return {
      judgment,
      multiplier: reward.multiplier,
      hypeGain: reward.hypeGain,
      staminaGain: reward.staminaGain,
    };
  }

  pickWeightedSkill(player) {
    // Smart counter logic based on counterRate
    if (
      (player.state === 'WINDUP' || player.state === 'ATTACK') &&
      Math.random() < this.roundConfig.counterRate
    ) {
      if (player.activeSkill === 'LAO') return 'MOC';
      if (player.activeSkill === 'HUC') return 'LAO';
      if (player.activeSkill === 'MOC') return 'HUC';
    }

    // Round 2 special: Xích Hỏa Hải Long favors NE when player is near edge
    const playerDistCenter = Math.hypot(
      player.x - GAME_CONFIG.ARENA_CENTER_X,
      player.y - GAME_CONFIG.ARENA_CENTER_Y
    );
    if (this.roundConfig.roundNumber === 2 && playerDistCenter > 180 && Math.random() < 0.45) {
      return 'NE';
    }

    const w = this.roundConfig.skillWeights;
    const r = Math.random();
    if (r < w.HUC) return 'HUC';
    if (r < w.HUC + w.LAO) return 'LAO';
    if (r < w.HUC + w.LAO + w.MOC) return 'MOC';
    return 'NE';
  }

  update(dt, enemy, player, beatIndex, beatDuration, physics, clashActive, spawnFloatingText) {
    if (clashActive || enemy.stunTimer > 0) {
      this.pendingAttack = null;
      return;
    }

    // Wait until recovering from knockback before starting a new move
    if (enemy.knockbackTimer > 0) {
      return;
    }

    // Execute Boss Thunder Stomp if charged
    if (enemy.state === 'THUNDER_CHARGE') {
      enemy.thunderChargeTimer -= dt;
      if (enemy.thunderChargeTimer <= 0) {
        enemy.state = 'IDLE';
        this.soundManager.playThunderStomp();
        physics.spawnShockwave(
          enemy.x,
          enemy.y,
          GAME_CONFIG.ARENA_RADIUS * 2.1,
          this.roundConfig.thunderStompSpeed,
          false,
          '#a855f7',
          true
        );
        spawnFloatingText(enemy.x, enemy.y - 54, 'LÔI CHẤN DẬM SỚI!', '#c084fc');
      }
      return;
    }

    if (beatIndex <= this.lastProcessedBeat) return;
    this.lastProcessedBeat = beatIndex;
    this.beatCounter += 1;

    // Round 3 Boss: Every 6 beats, charge Thunder Stomp for 1 beat
    if (
      this.roundConfig.thunderStompEveryBeats > 0 &&
      this.beatCounter > 0 &&
      this.beatCounter % this.roundConfig.thunderStompEveryBeats === 0 &&
      enemy.state !== 'ATTACK' &&
      enemy.state !== 'WINDUP'
    ) {
      enemy.state = 'THUNDER_CHARGE';
      enemy.thunderChargeTimer = beatDuration * 0.92;
      enemy.vx = 0;
      enemy.vy = 0;
      this.soundManager.playThunderWarning();
      spawnFloatingText(enemy.x, enemy.y - 50, 'GỒNG LÔI CHẤN...', '#c084fc');
      return;
    }

    // Execute telegraphed attack (Round 1 or Rage Ult NO)
    if (this.pendingAttack && this.beatCounter >= this.pendingAttack.executeAtBeat) {
      const skillId = this.pendingAttack.skillId;
      this.pendingAttack = null;
      const dist = Math.hypot(player.x - enemy.x, player.y - enemy.y);
      if (dist <= 200) {
        const timing = this.rollTiming();
        const ang = Math.atan2(player.y - enemy.y, player.x - enemy.x);
        if (enemy.startSkill(skillId, timing, ang, beatDuration, player)) {
          this.soundManager.playSkill(skillId);
        }
      }
      return;
    }

    if (this.beatCounter < this.nextDecisionBeat) return;
    this.nextDecisionBeat = this.beatCounter + this.roundConfig.decisionBeats;

    const dist = Math.hypot(player.x - enemy.x, player.y - enemy.y);
    if (dist > 175) return;

    // Telegraph & unleash Chiêu Nộ (NO) when Rage reaches 100%
    if (enemy.rage >= GAME_CONFIG.RAGE.MAX && enemy.canUseSkill('NO').ok) {
      enemy.telegraphSkill = 'NO';
      enemy.telegraphTimer = beatDuration * 0.9;
      this.pendingAttack = {
        skillId: 'NO',
        executeAtBeat: this.beatCounter + 1,
      };
      this.soundManager.playThunderWarning();
      spawnFloatingText(enemy.x, enemy.y - 52, 'ĐỐI THỦ TỤ NỘ!', '#f97316');
      return;
    }

    const chosenSkill = this.pickWeightedSkill(player);
    const check = enemy.canUseSkill(chosenSkill);
    if (!check.ok) return;

    // Round 1 telegraphs attacks clearly before executing
    if (this.roundConfig.roundNumber === 1 && chosenSkill !== 'NE') {
      enemy.telegraphSkill = chosenSkill;
      enemy.telegraphTimer = beatDuration * (this.roundConfig.telegraphBeats - 0.15);
      this.pendingAttack = {
        skillId: chosenSkill,
        executeAtBeat: this.beatCounter + this.roundConfig.telegraphBeats,
      };
      return;
    }

    const timing = this.rollTiming();
    const ang = Math.atan2(player.y - enemy.y, player.x - enemy.x);
    if (enemy.startSkill(chosenSkill, timing, ang, beatDuration, player)) {
      this.soundManager.playSkill(chosenSkill);
    }
  }
}
