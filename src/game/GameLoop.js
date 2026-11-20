import { GAME_CONFIG } from './config.js';
import { TRAINING_STAGES, getBuffaloTemplate } from './GameConfig.js';
import { BuffaloEntity } from './BuffaloEntity.js';
import { RhythmBeatEngine } from './RhythmBeatEngine.js';
import { ArenaRingPhysics } from './ArenaRingPhysics.js';
import { HornClashManager } from './HornClashManager.js';
import { EnemyAI } from './EnemyAI.js';
import { TutorialManager } from './TutorialManager.js';
import { LobbyManager } from './LobbyManager.js';

export class GameLoop {
  constructor(canvas, assets, saveManager, soundManager, uiManager) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.assets = assets;
    this.saveManager = saveManager;
    this.soundManager = soundManager;
    this.ui = uiManager;

    this.beatEngine = new RhythmBeatEngine(soundManager);
    this.physics = new ArenaRingPhysics(soundManager);
    this.clashManager = new HornClashManager(soundManager);
    this.enemyAI = new EnemyAI(soundManager);
    this.tutorialManager = new TutorialManager(soundManager, this.beatEngine, saveManager, uiManager);
    this.lobbyManager = new LobbyManager(soundManager);
    this.syncLobbyBuffaloes();

    this.state = 'MENU'; // MENU, TUTORIAL, PLAYING, PAUSED, ROUND_RESULT, VICTORY, GAME_OVER
    this.matchMode = 'TRAINING'; // TRAINING | CLASSIC
    this.activeStageConfig = null;
    this.activeRoundCfg = GAME_CONFIG.ROUNDS[0];
    this.currentRoundIdx = 0;
    this.roundsWon = 0;
    this.timeRemaining = 75;
    this.player = null;
    this.enemy = null;

    this.totalTime = 0;
    this.lastFrameMs = performance.now();
    this.pauseStartedAudioTime = 0;

    // Camera juice & FX
    this.cameraZoom = GAME_CONFIG.CAMERA.BASE_ZOOM;
    this.cameraPivotX = GAME_CONFIG.ARENA_CENTER_X;
    this.cameraPivotY = GAME_CONFIG.ARENA_CENTER_Y;
    this.shakeIntensity = 0;
    this.shakeDuration = 0;
    this.hitStopTimer = 0;
    this.warningIntensity = 0;

    this.particles = [];
    this.floatingTexts = [];
    this.hoofMarks = [];

    this.wireUIHandlers();
  }

  syncLobbyBuffaloes() {
    this.lobbyManager.syncOwnedBuffaloes(
      this.saveManager.data.ownedBuffaloes,
      this.saveManager.data.selectedBuffaloId
    );
  }

  wireUIHandlers() {
    this.ui.setHandlers({
      onDataChanged: () => this.syncLobbyBuffaloes(),
      onAfterIntro: () => {
        if (!this.saveManager.data.tutorial_completed) {
          this.startTutorial();
        } else {
          this.startCampaign();
        }
      },
      onStartTutorial: () => this.startTutorial(),
      onSkipTutorial: () => {
        this.tutorialManager.stop();
        this.saveManager.markTutorialCompleted();
        this.startCampaign();
      },
      onEnterRound1FromTutorial: () => {
        this.tutorialManager.stop();
        this.startCampaign();
      },
      onStartTrainingStage: (stageCfg) => this.startTrainingStage(stageCfg),
      onNextTrainingStage: () => this.advanceToNextTrainingStage(),
      onReplayVictory: () => {
        if (this.matchMode === 'TRAINING' && this.activeStageConfig) {
          this.startTrainingStage(this.activeStageConfig);
        } else {
          this.startCampaign();
        }
      },
      onStartCampaign: () => this.startCampaign(),
      onNextRound: () => this.advanceToNextRound(),
      onRetryRound: () => this.retryCurrentRound(),
      onPause: () => this.pauseGame(),
      onResume: () => this.resumeGame(),
      onTogglePause: () => {
        if (this.state === 'PLAYING') this.pauseGame();
        else if (this.state === 'PAUSED') this.resumeGame();
      },
      onReturnToMenu: () => this.returnToMenu(),
      onSkillInput: (skillId) => this.handlePlayerSkill(skillId),
      onLobbyCanvasClick: (x, y) => {
        if (this.state === 'MENU') {
          this.lobbyManager.handleClick(x, y);
        }
      },
    });
  }

  start() {
    this.lastFrameMs = performance.now();
    const tick = (now) => {
      const rawDt = (now - this.lastFrameMs) / 1000;
      this.lastFrameMs = now;
      const dt = Math.min(GAME_CONFIG.MAX_DELTA_TIME, Math.max(0, rawDt));

      this.update(dt);
      this.render();
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  startTutorial() {
    this.state = 'TUTORIAL';
    this.tutorialManager.start();
  }

  startTrainingStage(stageCfg) {
    this.tutorialManager.stop();
    this.matchMode = 'TRAINING';
    this.activeStageConfig = stageCfg;
    this.beatEngine.resetMatchCounters();
    this.initPlayerEntity();

    const bot = stageCfg.botConfig;
    const roundCfg = {
      roundNumber: stageCfg.stageId <= 3 ? 1 : stageCfg.stageId <= 7 ? 2 : 3,
      shortLabel: `Ải ${stageCfg.stageId} · Lv.${bot.botLevel}`,
      opponentName: bot.name,
      spriteRow: bot.spriteRow,
      duration: stageCfg.duration,
      bpm: stageCfg.bpm,
      maxSpeed: bot.maxSpeed,
      decisionBeats: bot.decisionBeats,
      timingRates: bot.timingRates,
      counterRate: bot.counterRate,
      skillWeights: bot.skillWeights,
      poiseMultiplier: bot.poiseMultiplier,
      perfectBypassPoise: bot.perfectBypassPoise,
      clashPushPerBeat: bot.clashPushPerBeat,
      telegraphBeats: bot.telegraphBeats,
      thunderStompEveryBeats: bot.thunderStompEveryBeats || 0,
      thunderStompSpeed: bot.thunderStompSpeed || 260,
      thunderStompDamage: bot.thunderStompDamage || 8,
      thunderStompKnockback: bot.thunderStompKnockback || 280,
      thunderStompStun: bot.thunderStompStun || 0.5,
      arenaTheme: stageCfg.arenaTheme,
      bodyColor: bot.bodyColor,
      accentColor: bot.accentColor,
      botStats: bot,
    };

    this.startRoundWithConfig(roundCfg, false);
  }

  advanceToNextTrainingStage() {
    if (!this.activeStageConfig) {
      this.returnToMenu();
      return;
    }
    const next = TRAINING_STAGES.find((s) => s.stageId === this.activeStageConfig.stageId + 1);
    if (next) {
      this.startTrainingStage(next);
    } else {
      this.returnToMenu();
    }
  }

  startCampaign() {
    this.tutorialManager.stop();
    this.matchMode = 'CLASSIC';
    this.activeStageConfig = null;
    this.currentRoundIdx = 0;
    this.roundsWon = 0;
    this.beatEngine.resetMatchCounters();
    this.initPlayerEntity();
    this.startRound(0, false);
  }

  retryCurrentRound() {
    if (this.matchMode === 'TRAINING' && this.activeStageConfig) {
      this.startTrainingStage(this.activeStageConfig);
      return;
    }
    this.beatEngine.resetMatchCounters();
    this.initPlayerEntity();
    this.startRound(this.currentRoundIdx, false);
  }

  advanceToNextRound() {
    this.currentRoundIdx += 1;
    if (this.currentRoundIdx >= GAME_CONFIG.ROUNDS.length) {
      this.returnToMenu();
      return;
    }
    const healAmt = Math.round(this.player.maxHp * (GAME_CONFIG.ROUND_WIN_HEAL_PERCENT / 100));
    this.player.hp = Math.min(this.player.maxHp, this.player.hp + healAmt);
    this.startRound(this.currentRoundIdx, true);
  }

  initPlayerEntity() {
    const owned = this.saveManager.getSelectedBuffalo();
    const tpl = getBuffaloTemplate(owned.id);
    this.player = new BuffaloEntity({
      isPlayer: true,
      name: owned.name,
      spriteRow: tpl.spriteRow,
      maxSpeed: GAME_CONFIG.PLAYER_MAX_SPEED,
      poiseMultiplier: 1.0,
      perfectBypassPoise: false,
      bodyColor: tpl.bodyColor,
      accentColor: tpl.accentColor,
      maxHp: owned.stats.maxHp,
      attack: owned.stats.attack,
      defense: owned.stats.defense,
      knockbackStat: owned.stats.knockback,
      rageSkillId: owned.rageSkillId,
      rageLevel: owned.skillLevel,
      visualScale: tpl.visualScale || 1.0,
    });
  }

  startRound(roundIdx, keepPlayerHp) {
    this.currentRoundIdx = roundIdx;
    this.startRoundWithConfig(GAME_CONFIG.ROUNDS[roundIdx], keepPlayerHp);
  }

  startRoundWithConfig(cfg, keepPlayerHp) {
    this.activeRoundCfg = cfg;
    this.timeRemaining = cfg.duration;
    this.particles = [];
    this.floatingTexts = [];
    this.hoofMarks = [];
    this.physics.reset();
    this.clashManager.active = false;
    this.shakeIntensity = 0;
    this.shakeDuration = 0;
    this.hitStopTimer = 0;
    this.cameraZoom = GAME_CONFIG.CAMERA.BASE_ZOOM;
    this.cameraPivotX = GAME_CONFIG.ARENA_CENTER_X;
    this.cameraPivotY = GAME_CONFIG.ARENA_CENTER_Y;

    this.player.resetForRound(
      GAME_CONFIG.ARENA_CENTER_X - 140,
      GAME_CONFIG.ARENA_CENTER_Y,
      0,
      keepPlayerHp
    );

    const bot = cfg.botStats;
    this.enemy = new BuffaloEntity({
      isPlayer: false,
      name: cfg.opponentName,
      spriteRow: cfg.spriteRow,
      maxSpeed: cfg.maxSpeed,
      poiseMultiplier: cfg.poiseMultiplier,
      perfectBypassPoise: cfg.perfectBypassPoise,
      bodyColor: cfg.bodyColor,
      accentColor: cfg.accentColor,
      maxHp: bot ? bot.maxHp : 100,
      attack: bot ? bot.attack : 15,
      defense: bot ? bot.defense : 10,
      knockbackStat: bot ? bot.knockback : 12,
      rageSkillId: bot ? bot.rageSkillId : 'skill_linh_nguu_xung_kich',
      rageLevel: bot ? Math.min(5, Math.max(1, Math.ceil(bot.botLevel / 2))) : 1,
      visualScale: bot ? bot.visualScale : 1.0,
    });
    this.enemy.resetForRound(
      GAME_CONFIG.ARENA_CENTER_X + 140,
      GAME_CONFIG.ARENA_CENTER_Y,
      Math.PI,
      false
    );

    const trackId = this.saveManager.data.inventory.equippedTrack;
    this.soundManager.startMusic(cfg.bpm, trackId);
    this.beatEngine.reset(cfg.bpm);
    this.enemyAI.reset(cfg);

    this.state = 'PLAYING';
    this.ui.showScreen('PLAYING');
  }

  pauseGame() {
    if (this.state !== 'PLAYING') return;
    this.state = 'PAUSED';
    this.pauseStartedAudioTime = this.soundManager.getTime();
    this.soundManager.stopMusic();
    this.ui.showScreen('PAUSED');
  }

  resumeGame() {
    if (this.state !== 'PAUSED') return;
    const pausedDuration = Math.max(0, this.soundManager.getTime() - this.pauseStartedAudioTime);
    this.beatEngine.shiftAnchorAfterPause(pausedDuration);
    const cfg = this.activeRoundCfg || GAME_CONFIG.ROUNDS[this.currentRoundIdx];
    this.soundManager.startMusic(cfg.bpm, this.saveManager.data.inventory.equippedTrack);
    this.state = 'PLAYING';
    this.ui.showScreen('PLAYING');
  }

  returnToMenu() {
    this.tutorialManager.stop();
    this.soundManager.stopMusic();
    this.clashManager.active = false;
    this.syncLobbyBuffaloes();
    this.state = 'MENU';
    this.ui.showScreen('MENU');
  }

  handlePlayerSkill(skillId) {
    if (this.state === 'TUTORIAL') {
      this.tutorialManager.handleSkillInput(skillId);
      return;
    }
    if (this.state !== 'PLAYING' || !this.player || !this.enemy) return;

    // During Horn-Lock Clash, pressing attack skills (HUC / LAO) feeds clash gauge
    if (this.clashManager.active) {
      if (skillId === 'HUC' || skillId === 'LAO') {
        const timing = this.beatEngine.evaluateInputTiming(this.player.isAutoPerfect());
        this.clashManager.onPlayerInput(timing);
        this.spawnFloatingText(this.player.x, this.player.y - 54, timing.label, timing.color);
        this.spawnSparks(this.clashManager.x, this.clashManager.y, 6);
      }
      return;
    }

    const check = this.player.canUseSkill(skillId);
    if (!check.ok) {
      if (check.reason === 'exhausted') {
        this.spawnFloatingText(this.player.x, this.player.y - 46, 'HỤT HƠI!', '#fb923c');
      } else if (check.reason === 'no_rage') {
        this.spawnFloatingText(
          this.player.x,
          this.player.y - 46,
          `CHƯA ĐỦ NỘ (${Math.floor(this.player.rage)}%)`,
          '#f97316'
        );
      }
      return;
    }

    const wasLinhNguu = this.player.isLinhNguu();
    const timing = this.beatEngine.evaluateInputTiming(this.player.isAutoPerfect() || skillId === 'NO');
    const targetAng = Math.atan2(this.enemy.y - this.player.y, this.enemy.x - this.player.x);

    const started = this.player.startSkill(
      skillId,
      timing,
      targetAng,
      this.beatEngine.beatDuration,
      this.enemy
    );
    if (!started) return;

    this.soundManager.playSkill(skillId);
    if (skillId === 'NO') {
      this.triggerShake(16, 0.30);
      this.physics.spawnShockwave(this.player.x, this.player.y, 200, 560, true, '#f97316', false);
      this.spawnFloatingText(this.player.x, this.player.y - 62, 'LÔI NGƯU CUỒNG NỘ!', '#f97316');
    } else {
      this.spawnFloatingText(this.player.x, this.player.y - 52, timing.label, timing.color);
    }

    // Check if Unique 8s+ Rage Skill (Linh Ngưu) just triggered!
    if (!wasLinhNguu && this.player.isLinhNguu()) {
      const tpl = getBuffaloTemplate(this.saveManager.getSelectedBuffalo()?.id);
      this.soundManager.playLinhNguuDrop();
      this.triggerShake(18, 0.35);
      this.physics.spawnShockwave(this.player.x, this.player.y, 260, 620, true, '#fde047', false);
      this.spawnFloatingText(
        this.player.x,
        this.player.y - 72,
        `${tpl.rageSkillName.toUpperCase()}!`,
        '#fde047'
      );
    } else if (timing.judgment === 'PERFECT' && skillId !== 'NE' && skillId !== 'NO') {
      this.physics.spawnShockwave(this.player.x, this.player.y, 120, 460, true, '#fde047', false);
    }
  }

  update(dt) {
    this.totalTime += dt;

    if (this.state === 'MENU') {
      this.lobbyManager.update(dt);
      // Subtle ambient festival beat on menu background
      this.beatEngine.beatPulse = Math.max(0, this.beatEngine.beatPulse - dt * 1.4);
      if (this.beatEngine.beatPulse <= 0.01) {
        this.beatEngine.beatPulse = 0.85;
      }
      return;
    }

    if (this.state === 'TUTORIAL') {
      this.tutorialManager.update(dt);
      return;
    }

    if (this.state !== 'PLAYING') return;

    this.beatEngine.update(dt);
    this.updateFX(dt);

    // Hit-stop freezes entity movement for 50ms on heavy PERFECT impact
    if (this.hitStopTimer > 0) {
      this.hitStopTimer = Math.max(0, this.hitStopTimer - dt);
      return;
    }

    this.timeRemaining = Math.max(0, this.timeRemaining - dt);
    const roundCfg = this.activeRoundCfg || GAME_CONFIG.ROUNDS[this.currentRoundIdx];

    const fxBridge = {
      triggerShake: (amp, dur) => this.triggerShake(amp, dur),
      triggerHitStop: (dur) => {
        this.hitStopTimer = Math.max(this.hitStopTimer, dur);
      },
      spawnMudBurst: (x, y) => this.spawnMudBurst(x, y),
      spawnSparks: (x, y, count) => this.spawnSparks(x, y, count),
      spawnFloatingText: (x, y, text, color) => this.spawnFloatingText(x, y, text, color),
    };

    if (this.clashManager.active) {
      const clashRes = this.clashManager.update(
        dt,
        this.player,
        this.enemy,
        roundCfg,
        this.beatEngine.lastBeatIndex,
        (x, y, c) => this.spawnSparks(x, y, c),
        (x, y, t, col) => this.spawnFloatingText(x, y, t, col)
      );
      if (clashRes && clashRes.resolved) {
        this.triggerShake(22, 0.35);
      }
    } else {
      this.player.updateTimers(dt);
      this.enemy.updateTimers(dt);

      this.enemyAI.update(
        dt,
        this.enemy,
        this.player,
        this.beatEngine.lastBeatIndex,
        this.beatEngine.beatDuration,
        this.physics,
        this.clashManager.active,
        (x, y, t, col) => this.spawnFloatingText(x, y, t, col)
      );

      this.warningIntensity = this.physics.updateMovementAndBounds(
        dt,
        this.player,
        this.enemy,
        this.hoofMarks
      );

      this.physics.resolveCombat(
        dt,
        this.player,
        this.enemy,
        this.clashManager,
        this.beatEngine.lastBeatIndex,
        fxBridge
      );
    }

    // Dynamic Camera Zoom & Clamped Pivot smoothing (keeps bgImage completely inside screen)
    const targetZoom = this.clashManager.active
      ? GAME_CONFIG.CLASH.CAMERA_ZOOM
      : this.player.isLinhNguu()
        ? GAME_CONFIG.LINH_NGUU.CAMERA_ZOOM
        : GAME_CONFIG.CAMERA.BASE_ZOOM;
    this.cameraZoom += (targetZoom - this.cameraZoom) * Math.min(1, dt * 7);

    const rawPivotX = this.clashManager.active ? this.clashManager.x : GAME_CONFIG.ARENA_CENTER_X;
    const rawPivotY = this.clashManager.active ? this.clashManager.y : GAME_CONFIG.ARENA_CENTER_Y;
    this.cameraPivotX += (rawPivotX - this.cameraPivotX) * Math.min(1, dt * 6);
    this.cameraPivotY += (rawPivotY - this.cameraPivotY) * Math.min(1, dt * 6);

    const W = GAME_CONFIG.CANVAS_WIDTH;
    const H = GAME_CONFIG.CANVAS_HEIGHT;
    const visHalfW = W / (2 * this.cameraZoom);
    const visHalfH = H / (2 * this.cameraZoom);
    const maxShiftX = Math.max(0, W / 2 - visHalfW - 14);
    const maxShiftY = Math.max(0, H / 2 - visHalfH - 10);
    this.cameraPivotX = Math.max(
      GAME_CONFIG.ARENA_CENTER_X - maxShiftX,
      Math.min(GAME_CONFIG.ARENA_CENTER_X + maxShiftX, this.cameraPivotX)
    );
    this.cameraPivotY = Math.max(
      GAME_CONFIG.ARENA_CENTER_Y - maxShiftY,
      Math.min(GAME_CONFIG.ARENA_CENTER_Y + maxShiftY, this.cameraPivotY)
    );

    // Update HUD
    this.ui.updateHUD(
      this.player,
      this.enemy,
      roundCfg,
      this.timeRemaining,
      this.beatEngine.beatCombo,
      this.clashManager.active
    );

    // Check Round Win / Loss conditions
    const outcome = this.physics.checkRoundOutcome(
      this.player,
      this.enemy,
      this.timeRemaining,
      this.beatEngine
    );
    if (outcome.finished) {
      this.onRoundFinished(outcome);
    }
  }

  onRoundFinished(outcome) {
    this.soundManager.stopMusic();
    this.clashManager.active = false;
    this.triggerShake(22, 0.35);

    const roundCfg = this.activeRoundCfg || GAME_CONFIG.ROUNDS[this.currentRoundIdx];

    // Training Stage Campaign Resolution
    if (this.matchMode === 'TRAINING' && this.activeStageConfig) {
      const stageCfg = this.activeStageConfig;
      const won = outcome.winner === 'player';
      const stageRes = this.saveManager.completeStage(stageCfg, won);

      const record = this.saveManager.recordMatch(
        {
          result: won ? 'VICTORY' : 'GAME_OVER',
          endReason: outcome.reason,
          highestRound: `Ải ${stageCfg.stageId}`,
          opponentName: stageCfg.botConfig.name,
          perfectCount: this.beatEngine.perfectCount,
          goodCount: this.beatEngine.goodCount,
          missCount: this.beatEngine.missCount,
          maxComboInMatch: this.beatEngine.maxComboInMatch,
          harvestPointsEarned: stageRes.earnedMerit,
        },
        false
      );

      this.ui.refreshMenuStats();

      if (won) {
        this.soundManager.playVictory();
        this.state = 'VICTORY';
        this.ui.showVictory(record, {
          stageId: stageCfg.stageId,
          stageName: stageCfg.stageName,
          earnedMerit: stageRes.earnedMerit,
          newlyUnlockedStage: stageRes.newlyUnlockedStage,
        });
      } else {
        this.soundManager.playDefeat();
        this.state = 'GAME_OVER';
        this.ui.showGameOver(`Ải ${stageCfg.stageId} / 10`, outcome.label, record, true);
      }
      return;
    }

    // Classic 3-Round Đại Lễ Resolution
    if (outcome.winner === 'player') {
      this.roundsWon += 1;
      this.soundManager.playVictory();

      if (this.currentRoundIdx >= GAME_CONFIG.ROUNDS.length - 1) {
        const earned = this.computeHarvestPoints(true);
        const record = this.saveManager.recordMatch(
          {
            result: 'VICTORY',
            endReason: outcome.reason,
            highestRound: 'V3',
            opponentName: roundCfg.opponentName,
            perfectCount: this.beatEngine.perfectCount,
            goodCount: this.beatEngine.goodCount,
            missCount: this.beatEngine.missCount,
            maxComboInMatch: this.beatEngine.maxComboInMatch,
            harvestPointsEarned: earned,
            isFestivalChampion: true,
          },
          true
        );
        this.state = 'VICTORY';
        this.ui.showVictory(record, null);
      } else {
        this.state = 'ROUND_RESULT';
        this.ui.showRoundResult(roundCfg.roundNumber, outcome.label, {
          perfectCount: this.beatEngine.perfectCount,
          goodCount: this.beatEngine.goodCount,
          missCount: this.beatEngine.missCount,
          maxComboInMatch: this.beatEngine.maxComboInMatch,
        });
      }
    } else {
      this.soundManager.playDefeat();
      const earned = this.computeHarvestPoints(false);
      const record = this.saveManager.recordMatch(
        {
          result: 'GAME_OVER',
          endReason: outcome.reason,
          highestRound: `V${roundCfg.roundNumber}`,
          opponentName: roundCfg.opponentName,
          perfectCount: this.beatEngine.perfectCount,
          goodCount: this.beatEngine.goodCount,
          missCount: this.beatEngine.missCount,
          maxComboInMatch: this.beatEngine.maxComboInMatch,
          harvestPointsEarned: earned,
        },
        true
      );
      this.state = 'GAME_OVER';
      this.ui.showGameOver(`${roundCfg.roundNumber} / 3`, outcome.label, record, false);
    }
  }

  computeHarvestPoints(isChampion) {
    const bonus = isChampion ? GAME_CONFIG.VICTORY_BONUS_POINTS : 0;
    return (
      this.roundsWon * 100 +
      this.beatEngine.perfectCount * 5 +
      this.beatEngine.maxComboInMatch * 10 +
      bonus
    );
  }

  triggerShake(intensity, duration) {
    if (intensity >= this.shakeIntensity) {
      this.shakeIntensity = intensity;
      this.shakeDuration = duration;
    }
  }

  spawnMudBurst(x, y) {
    for (let i = 0; i < 10; i++) {
      const a = Math.random() * Math.PI * 2;
      const spd = 70 + Math.random() * 170;
      this.particles.push({
        kind: 'mud',
        x,
        y,
        vx: Math.cos(a) * spd,
        vy: Math.sin(a) * spd,
        size: 5 + Math.random() * 6,
        life: 0.45 + Math.random() * 0.2,
        maxLife: 0.65,
        color: '#6b4423',
      });
    }
  }

  spawnSparks(x, y, count) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const spd = 120 + Math.random() * 240;
      this.particles.push({
        kind: 'spark',
        x,
        y,
        vx: Math.cos(a) * spd,
        vy: Math.sin(a) * spd,
        size: 3 + Math.random() * 3.5,
        life: 0.25 + Math.random() * 0.2,
        maxLife: 0.45,
        color: Math.random() < 0.5 ? '#fde047' : '#fb923c',
      });
    }
  }

  spawnFloatingText(x, y, text, color) {
    this.floatingTexts.push({
      x,
      y,
      text,
      color,
      life: 0.72,
      maxLife: 0.72,
    });
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
      p.vx *= Math.max(0, 1 - 5 * dt);
      p.vy *= Math.max(0, 1 - 5 * dt);
      p.life -= dt;
      if (p.life <= 0) this.particles.splice(i, 1);
    }

    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      const ft = this.floatingTexts[i];
      ft.y -= 44 * dt;
      ft.life -= dt;
      if (ft.life <= 0) this.floatingTexts.splice(i, 1);
    }
  }

  render() {
    const ctx = this.ctx;
    if (this.state === 'MENU') {
      const equippedHornId = this.saveManager.data.inventory.equippedHorn;
      const hornCfg =
        GAME_CONFIG.SHOP_HORNS.find((h) => h.id === equippedHornId) || GAME_CONFIG.SHOP_HORNS[0];
      this.lobbyManager.render(ctx, this.assets, hornCfg);
      return;
    }
    if (this.state === 'TUTORIAL') {
      this.tutorialManager.render(ctx, this.assets);
      return;
    }
    const W = GAME_CONFIG.CANVAS_WIDTH;
    const H = GAME_CONFIG.CANVAS_HEIGHT;
    const roundCfg = this.activeRoundCfg || GAME_CONFIG.ROUNDS[this.currentRoundIdx] || GAME_CONFIG.ROUNDS[0];

    ctx.clearRect(0, 0, W, H);
    ctx.save();

    // Camera Zoom & Shake around smoothed, clamped pivot so bg never leaves viewport
    const cappedShake = Math.min(this.shakeIntensity, GAME_CONFIG.CAMERA.MAX_SHAKE_OFFSET);
    const shakeX = this.shakeDuration > 0 ? (Math.random() - 0.5) * 2 * cappedShake : 0;
    const shakeY = this.shakeDuration > 0 ? (Math.random() - 0.5) * 2 * cappedShake : 0;

    ctx.translate(W / 2 + shakeX, H / 2 + shakeY);
    ctx.scale(this.cameraZoom, this.cameraZoom);
    ctx.translate(-this.cameraPivotX, -this.cameraPivotY);

    // 1. Arena Background, White Chalk Ring, Flags & Pulsing Drums
    this.assets.drawArena(
      ctx,
      this.totalTime,
      this.beatEngine.beatPulse,
      roundCfg,
      this.state === 'PLAYING' ? this.warningIntensity : 0,
      this.hoofMarks
    );

    if (this.player && this.enemy && this.state !== 'MENU') {
      // 2. Beat Ring under Ông Cầu Hắc Phong
      this.beatEngine.renderBeatRing(
        ctx,
        this.player.x,
        this.player.y,
        this.player.isLinhNguu()
      );

      // 3. Shockwaves
      this.physics.renderShockwaves(ctx);

      // 4. Buffaloes (96x96 frames / procedural vector)
      const equippedHornId = this.saveManager.data.inventory.equippedHorn;
      const hornCfg =
        GAME_CONFIG.SHOP_HORNS.find((h) => h.id === equippedHornId) || GAME_CONFIG.SHOP_HORNS[0];
      this.enemy.render(ctx, this.assets, null, this.totalTime);
      this.player.render(ctx, this.assets, hornCfg, this.totalTime);

      // 5. Particles (Mud & Sparks)
      for (const p of this.particles) {
        const alpha = Math.max(0, p.life / p.maxLife);
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // 6. Horn-Lock Clash Gauge
      this.clashManager.renderGauge(ctx);

      // 7. Floating Judgment & Status Texts (PERFECT! / GOOD! / MISS)
      for (const ft of this.floatingTexts) {
        const alpha = Math.min(1, (ft.life / ft.maxLife) * 1.4);
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.font = '800 20px "Bricolage Grotesque", sans-serif';
        ctx.textAlign = 'center';
        ctx.lineWidth = 4;
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.85)';
        ctx.strokeText(ft.text, ft.x, ft.y);
        ctx.fillStyle = ft.color;
        ctx.fillText(ft.text, ft.x, ft.y);
        ctx.restore();
      }
    }

    ctx.restore();

    // 8. Bottom Beat Bar (Screen space, always crisp at bottom center during play)
    if (this.state === 'PLAYING') {
      this.beatEngine.renderBeatBar(ctx, W, H, this.assets);
    }
  }
}
