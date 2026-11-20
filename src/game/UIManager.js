import { GAME_CONFIG } from './config.js';
import { getBuffaloTemplate } from './GameConfig.js';
import { ShopUI } from './ShopUI.js';
import { StageSelectUI } from './StageSelectUI.js';

export class UIManager {
  constructor(saveManager, soundManager, assets) {
    this.saveManager = saveManager;
    this.soundManager = soundManager;
    this.assets = assets;

    this.touchMode = 'auto'; // auto | always | hide
    this.introSceneIndex = 0;
    this.handlers = {};

    this.shopUI = new ShopUI(saveManager, soundManager, assets, () => {
      this.refreshMenuStats();
      this.handlers.onDataChanged?.();
    });

    this.stageSelectUI = new StageSelectUI(saveManager, soundManager, assets, {
      onSelectStage: (stageCfg) => {
        this.closeModals();
        this.handlers.onStartTrainingStage?.(stageCfg);
      },
      onBuffaloChanged: () => {
        this.refreshMenuStats();
        this.handlers.onDataChanged?.();
      },
    });

    this.cacheElements();
    this.bindEvents();
    this.applyTouchVisibility();
    this.refreshMenuStats();
  }

  cacheElements() {
    this.stageFrame = document.getElementById('stage-frame');
    this.canvas = document.getElementById('game-canvas');

    this.screens = {
      MENU: document.getElementById('screen-menu'),
      INTRO: document.getElementById('screen-intro'),
      PLAYING: document.getElementById('gameplay-hud'),
      PAUSED: document.getElementById('screen-paused'),
      ROUND_RESULT: document.getElementById('screen-round-result'),
      VICTORY: document.getElementById('screen-victory'),
      GAME_OVER: document.getElementById('screen-gameover'),
    };

    this.modals = {
      STAGES: document.getElementById('modal-stages'),
      SHOP: document.getElementById('modal-shop'),
      GUIDE: document.getElementById('modal-guide'),
      SETTINGS: document.getElementById('modal-settings'),
      HISTORY: document.getElementById('modal-history'),
    };

    // HUD refs
    this.elPlayerHudName = document.getElementById('player-hud-name');
    this.elPlayerHpFill = document.getElementById('player-hp-fill');
    this.elPlayerHpText = document.getElementById('player-hp-text');
    this.elPlayerStamFill = document.getElementById('player-stamina-fill');
    this.elPlayerStamText = document.getElementById('player-stamina-text');
    this.elPlayerHypeFill = document.getElementById('player-hype-fill');
    this.elPlayerHypeText = document.getElementById('player-hype-text');
    this.elPlayerHypeTrack = document.getElementById('player-hype-track');
    this.elPlayerRageFill = document.getElementById('player-rage-fill');
    this.elPlayerRageText = document.getElementById('player-rage-text');
    this.elPlayerRageTrack = document.getElementById('player-rage-track');
    this.elPlayerWeakPoint = document.getElementById('player-weakpoint-badge');
    this.elPlayerBalText = document.getElementById('player-balance-text');
    this.elPlayerStatus = document.getElementById('player-status-line');

    this.elEnemyName = document.getElementById('enemy-name');
    this.elEnemyHpFill = document.getElementById('enemy-hp-fill');
    this.elEnemyHpText = document.getElementById('enemy-hp-text');
    this.elEnemyStamFill = document.getElementById('enemy-stamina-fill');
    this.elEnemyStamText = document.getElementById('enemy-stamina-text');
    this.elEnemyHypeFill = document.getElementById('enemy-hype-fill');
    this.elEnemyHypeText = document.getElementById('enemy-hype-text');
    this.elEnemyRageFill = document.getElementById('enemy-rage-fill');
    this.elEnemyRageText = document.getElementById('enemy-rage-text');
    this.elEnemyBalText = document.getElementById('enemy-balance-text');
    this.elEnemyStatus = document.getElementById('enemy-status-line');

    this.elHudRoundLabel = document.getElementById('hud-round-label');
    this.elHudTimer = document.getElementById('hud-timer');
    this.elHudBpm = document.getElementById('hud-bpm');
    this.elHudCombo = document.getElementById('hud-combo');
    this.elLinhNguuBanner = document.getElementById('linh-nguu-banner');
    this.elClashBanner = document.getElementById('clash-banner');

    this.skillBtns = {
      NO: document.getElementById('skill-btn-NO'),
      HUC: document.getElementById('skill-btn-HUC'),
      LAO: document.getElementById('skill-btn-LAO'),
      MOC: document.getElementById('skill-btn-MOC'),
      NE: document.getElementById('skill-btn-NE'),
    };
    this.skillCds = {
      NO: document.querySelector('[data-cd="NO"]'),
      HUC: document.querySelector('[data-cd="HUC"]'),
      LAO: document.querySelector('[data-cd="LAO"]'),
      MOC: document.querySelector('[data-cd="MOC"]'),
      NE: document.querySelector('[data-cd="NE"]'),
    };
  }

  setHandlers(handlers) {
    this.handlers = handlers;
  }

  bindEvents() {
    // Menu buttons
    document.getElementById('btn-start-festival').addEventListener('click', () => {
      this.soundManager.ensureContext();
      this.openStages();
    });
    document.getElementById('btn-start-tutorial').addEventListener('click', () => {
      this.soundManager.ensureContext();
      this.handlers.onStartTutorial?.();
    });
    document.getElementById('btn-open-shop').addEventListener('click', () => {
      this.soundManager.ensureContext();
      this.openShop();
    });
    document.getElementById('btn-open-guide').addEventListener('click', () => {
      this.openModal('GUIDE');
    });
    document.getElementById('btn-open-settings').addEventListener('click', () => {
      this.openModal('SETTINGS');
    });
    document.getElementById('btn-open-history').addEventListener('click', () => {
      this.openHistory();
    });

    // Stage modal quick links
    document.getElementById('btn-close-stages').addEventListener('click', () => this.closeModals());
    document.getElementById('btn-stages-to-shop').addEventListener('click', () => this.openShop());
    document.getElementById('btn-stages-classic').addEventListener('click', () => {
      this.closeModals();
      this.openIntro();
    });

    // Modal closes
    document.getElementById('btn-close-shop').addEventListener('click', () => this.closeModals());
    document.getElementById('btn-close-guide').addEventListener('click', () => this.closeModals());
    document.getElementById('btn-close-settings').addEventListener('click', () => this.closeModals());
    document.getElementById('btn-close-history').addEventListener('click', () => this.closeModals());

    // Intro controls
    document.getElementById('btn-intro-next').addEventListener('click', () => {
      if (this.introSceneIndex < GAME_CONFIG.INTRO_SCENES.length - 1) {
        this.introSceneIndex += 1;
        this.renderIntroScene();
      } else {
        this.handlers.onAfterIntro?.();
      }
    });
    document.getElementById('btn-intro-skip').addEventListener('click', () => {
      this.handlers.onAfterIntro?.();
    });

    // Tutorial controls
    document.getElementById('btn-skip-tutorial').addEventListener('click', () => {
      this.soundManager.ensureContext();
      this.handlers.onSkipTutorial?.();
    });
    document.getElementById('btn-enter-round1').addEventListener('click', () => {
      this.soundManager.ensureContext();
      this.handlers.onEnterRound1FromTutorial?.();
    });

    // Pause controls
    document.getElementById('btn-pause').addEventListener('click', () => this.handlers.onPause?.());
    document.getElementById('btn-resume').addEventListener('click', () => this.handlers.onResume?.());
    document.getElementById('btn-restart-from-pause').addEventListener('click', () => {
      this.handlers.onRetryRound?.();
    });
    document.getElementById('btn-toggle-sound-pause').addEventListener('click', () => {
      const next = !this.soundManager.enabled;
      this.soundManager.setEnabled(next);
      document.getElementById('setting-sound-toggle').checked = next;
      document.getElementById('btn-toggle-sound-pause').textContent = `Âm Thanh: ${next ? 'Bật' : 'Tắt'}`;
    });
    document.getElementById('btn-toggle-touch-pause').addEventListener('click', () => {
      const modes = ['auto', 'always', 'hide'];
      const next = modes[(modes.indexOf(this.touchMode) + 1) % modes.length];
      this.touchMode = next;
      document.getElementById('setting-touch-mode').value = next;
      this.applyTouchVisibility();
      const label = next === 'auto' ? 'Tự Động' : next === 'always' ? 'Hiện' : 'Ẩn';
      document.getElementById('btn-toggle-touch-pause').textContent = `Nút Cảm Ứng: ${label}`;
    });
    document.getElementById('btn-exit-menu-pause').addEventListener('click', () => {
      this.handlers.onReturnToMenu?.();
    });

    // Round result / Victory / Game Over
    document.getElementById('btn-next-round').addEventListener('click', () => {
      this.handlers.onNextRound?.();
    });
    document.getElementById('btn-victory-next-stage').addEventListener('click', () => {
      this.handlers.onNextTrainingStage?.();
    });
    document.getElementById('btn-victory-replay').addEventListener('click', () => {
      this.handlers.onReplayVictory?.();
    });
    document.getElementById('btn-victory-menu').addEventListener('click', () => {
      this.handlers.onReturnToMenu?.();
    });
    document.getElementById('btn-retry-round').addEventListener('click', () => {
      this.handlers.onRetryRound?.();
    });
    document.getElementById('btn-gameover-shop').addEventListener('click', () => {
      this.handlers.onReturnToMenu?.();
      this.openShop();
    });
    document.getElementById('btn-gameover-menu').addEventListener('click', () => {
      this.handlers.onReturnToMenu?.();
    });

    // Settings inputs
    document.getElementById('setting-sound-toggle').addEventListener('change', (e) => {
      this.soundManager.setEnabled(e.target.checked);
    });
    document.getElementById('setting-haptic-toggle').addEventListener('change', (e) => {
      this.soundManager.setHapticEnabled(e.target.checked);
    });
    document.getElementById('setting-touch-mode').addEventListener('change', (e) => {
      this.touchMode = e.target.value;
      this.applyTouchVisibility();
    });

    // Export / Import JSON
    document.getElementById('btn-export-json').addEventListener('click', () => {
      const fname = this.saveManager.exportJSON();
      this.showHistoryFeedback(`Đã xuất tệp sao lưu: ${fname}`, false);
    });

    document.getElementById('input-import-json').addEventListener('change', (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        const res = this.saveManager.importAndMergeJSON(String(reader.result || ''));
        this.showHistoryFeedback(res.message, !res.ok);
        this.renderHistoryTable();
        this.refreshMenuStats();
      };
      reader.readAsText(file);
      e.target.value = '';
    });

    // Skill Buttons (Pointerdown for zero-latency mobile + mouse)
    for (const [skillId, btn] of Object.entries(this.skillBtns)) {
      btn.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.soundManager.ensureContext();
        btn.classList.add('active-press');
        this.handlers.onSkillInput?.(skillId);
      });
      btn.addEventListener('pointerup', () => btn.classList.remove('active-press'));
      btn.addEventListener('pointerleave', () => btn.classList.remove('active-press'));
    }

    // PC Keyboard controls (Combat skills + Pause)
    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      const k = e.key.toLowerCase();
      if (k === 'escape' || k === 'p') {
        this.handlers.onTogglePause?.();
        return;
      }
      if (k === 'j') this.handlers.onSkillInput?.('HUC');
      else if (k === 'k' || e.code === 'Space') {
        if (this.screens.PLAYING && !this.screens.PLAYING.classList.contains('hidden')) {
          e.preventDefault();
        }
        this.handlers.onSkillInput?.('LAO');
      } else if (k === 'l') this.handlers.onSkillInput?.('MOC');
      else if (e.key === 'Shift') this.handlers.onSkillInput?.('NE');
      else if (k === 'u' || k === 'r') this.handlers.onSkillInput?.('NO');
    });

    // Canvas clicks: interactive Lobby Buffaloes on MENU, or Combat Skills on PLAYING
    this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    this.canvas.addEventListener('pointerdown', (e) => {
      if (!this.screens.MENU.classList.contains('hidden')) {
        const rect = this.canvas.getBoundingClientRect();
        const cx = ((e.clientX - rect.left) / rect.width) * GAME_CONFIG.CANVAS_WIDTH;
        const cy = ((e.clientY - rect.top) / rect.height) * GAME_CONFIG.CANVAS_HEIGHT;
        this.soundManager.ensureContext();
        this.handlers.onLobbyCanvasClick?.(cx, cy);
        return;
      }
      if (e.pointerType === 'touch') return;
      if (this.screens.PLAYING.classList.contains('hidden')) return;
      this.soundManager.ensureContext();
      if (e.button === 0) this.handlers.onSkillInput?.('HUC');
      else if (e.button === 2) this.handlers.onSkillInput?.('MOC');
    });

    window.addEventListener('resize', () => this.applyTouchVisibility());
  }

  applyTouchVisibility() {
    const isCoarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
    const show =
      this.touchMode === 'always' || (this.touchMode === 'auto' && (isCoarse || window.innerWidth <= 920));
    const inTutorial = this.stageFrame.classList.contains('tutorial-mode');
    if (show) {
      this.stageFrame.classList.remove('touch-hidden');
    } else {
      this.stageFrame.classList.toggle('touch-hidden', !inTutorial && this.touchMode === 'hide');
    }
  }

  showTutorialScreen(visible) {
    const tutOverlay = document.getElementById('tutorial-overlay');
    if (visible) {
      this.showScreen('PLAYING');
      this.stageFrame.classList.add('tutorial-mode');
      this.stageFrame.classList.remove('touch-hidden');
      tutOverlay.classList.remove('hidden');
      document.getElementById('tut-complete-card').classList.add('hidden');
    } else {
      this.stageFrame.classList.remove('tutorial-mode');
      tutOverlay.classList.add('hidden');
      this.clearTutorialHighlights();
      this.applyTouchVisibility();
    }
  }

  clearTutorialHighlights() {
    for (const btn of Object.values(this.skillBtns)) {
      btn.classList.remove('tutorial-spotlight');
    }
  }

  updateTutorialBanner(info) {
    document.getElementById('tut-step-title').textContent = info.title;
    document.getElementById('tut-dialogue-text').textContent = info.dialogue;
    document.getElementById('tut-progress-text').textContent = `${info.progress}/${info.targetTotal}`;

    this.clearTutorialHighlights();

    if (info.completed) {
      document.getElementById('tut-complete-card').classList.remove('hidden');
      return;
    }

    if (this.skillBtns[info.highlightTarget]) {
      this.skillBtns[info.highlightTarget].classList.add('tutorial-spotlight');
    }
  }

  showScreen(screenName) {
    this.closeModals();
    for (const [name, el] of Object.entries(this.screens)) {
      if (!el) continue;
      if (name === screenName) el.classList.remove('hidden');
      else el.classList.add('hidden');
    }
    if (screenName === 'MENU') {
      this.refreshMenuStats();
    }
  }

  openModal(modalName) {
    for (const [name, el] of Object.entries(this.modals)) {
      if (name === modalName) el.classList.remove('hidden');
      else el.classList.add('hidden');
    }
  }

  closeModals() {
    for (const el of Object.values(this.modals)) {
      el.classList.add('hidden');
    }
  }

  refreshMenuStats() {
    const {
      playerName,
      farmName,
      meritPoints,
      unlockedStage,
      stats,
      inventory,
    } = this.saveManager.data;
    const selected = this.saveManager.getSelectedBuffalo();

    const nameEl = document.getElementById('menu-player-name');
    if (nameEl) nameEl.textContent = playerName;

    const buffEl = document.getElementById('menu-selected-buffalo');
    if (buffEl && selected) {
      buffEl.textContent = `${selected.name} · Cấp ${selected.level}`;
    }

    const levelEl = document.getElementById('menu-player-level');
    if (levelEl && selected) levelEl.textContent = `Cấp ${selected.level}`;

    document.getElementById('menu-stat-points').textContent = `${meritPoints} Chiến Tích`;
    const stagesEl = document.getElementById('menu-stat-stages');
    if (stagesEl) stagesEl.textContent = `Ải: ${unlockedStage}/10`;
    document.getElementById('menu-stat-champs').textContent = `Vô Địch: ${stats.championshipCount}`;
    document.getElementById('menu-stat-combo').textContent = `Combo: ${stats.maxBeatCombo}`;

    const farmEl = document.getElementById('menu-farm-name');
    if (farmEl) farmEl.textContent = farmName;

    const horn = GAME_CONFIG.SHOP_HORNS.find((h) => h.id === inventory.equippedHorn);
    const track = GAME_CONFIG.SHOP_TRACKS.find((t) => t.id === inventory.equippedTrack);
    document.getElementById('menu-equipped-horn').textContent = horn ? horn.name : 'Sừng Cánh Cung';
    document.getElementById('menu-equipped-track').textContent = track ? track.name : 'Trống Hội & Sáo Trúc';
    this.soundManager.setTrack(inventory.equippedTrack);
    this.renderProfileAvatar();
  }

  renderProfileAvatar() {
    const c = document.getElementById('menu-avatar-canvas');
    if (!c) return;
    const ctx = c.getContext('2d');
    ctx.clearRect(0, 0, c.width, c.height);

    const selected = this.saveManager.getSelectedBuffalo();
    const tpl = getBuffaloTemplate(selected?.id);
    const frame = this.assets.getBuffaloFrame(tpl.spriteRow, 1);
    if (frame && frame.canvas) {
      ctx.drawImage(frame.canvas, -6, -4, 76, 76);
    } else {
      ctx.fillStyle = tpl.bodyColor;
      ctx.beginPath();
      ctx.arc(32, 34, 18, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = tpl.accentColor;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(32, 22, 16, Math.PI * 0.15, Math.PI * 0.85, true);
      ctx.stroke();
    }
  }

  openIntro() {
    this.introSceneIndex = 0;
    this.showScreen('INTRO');
    this.renderIntroScene();
  }

  renderIntroScene() {
    const idx = this.introSceneIndex;
    const scene = GAME_CONFIG.INTRO_SCENES[idx];
    document.getElementById('intro-step-label').textContent = `Nghi Lễ ${idx + 1} / ${GAME_CONFIG.INTRO_SCENES.length}`;
    document.getElementById('intro-title').textContent = scene.title;
    document.getElementById('intro-text').textContent = scene.text;
    document.getElementById('btn-intro-next').textContent =
      idx === GAME_CONFIG.INTRO_SCENES.length - 1 ? 'Bước Vào Sới Chọi' : 'Tiếp Tục';

    const c = document.getElementById('intro-canvas');
    const ctx = c.getContext('2d');
    ctx.clearRect(0, 0, c.width, c.height);

    // Draw narrative scene illustration
    const sky = ctx.createLinearGradient(0, 0, 0, c.height);
    if (idx === 0) {
      sky.addColorStop(0, '#f59e0b');
      sky.addColorStop(1, '#78350f');
    } else if (idx === 1) {
      sky.addColorStop(0, '#1e1b4b');
      sky.addColorStop(1, '#451a03');
    } else {
      sky.addColorStop(0, '#450a0a');
      sky.addColorStop(1, '#1c1917');
    }
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, c.width, c.height);

    // Sea waves or sun
    ctx.fillStyle = idx === 0 ? '#fef08a' : idx === 1 ? '#38bdf8' : '#ef4444';
    ctx.beginPath();
    ctx.arc(320, 96, idx === 0 ? 44 : 34, 0, Math.PI * 2);
    ctx.fill();

    // Draw festival icons from assets/tool.png or procedural fallback
    if (this.assets.hasTool) {
      if (this.assets.tools.flag) ctx.drawImage(this.assets.tools.flag, 64, 48, 120, 120);
      if (this.assets.tools.drum) ctx.drawImage(this.assets.tools.drum, 250, 56, 140, 140);
      if (this.assets.tools.sticks) ctx.drawImage(this.assets.tools.sticks, 456, 52, 118, 118);
    } else {
      this.assets.drawFiveColorFlag(ctx, 130, 140, 1.5, 1.2, 0);
      this.assets.drawFiveColorFlag(ctx, 510, 140, 1.5, 1.2, 1.5);
    }

    if (idx === 2 && this.assets.hasTrau) {
      const f = this.assets.getBuffaloFrame(0, 2);
      if (f) ctx.drawImage(f.canvas, 256, 84, 128, 128);
    }
  }

  openStages() {
    this.openModal('STAGES');
    this.stageSelectUI.open();
  }

  openShop(tab = null) {
    this.openModal('SHOP');
    this.shopUI.open(tab);
  }

  openHistory() {
    this.openModal('HISTORY');
    document.getElementById('history-feedback').classList.add('hidden');
    this.renderHistoryTable();
  }

  showHistoryFeedback(msg, isError) {
    const box = document.getElementById('history-feedback');
    box.textContent = msg;
    box.classList.remove('hidden', 'error');
    if (isError) box.classList.add('error');
  }

  renderHistoryTable() {
    const { meritPoints, stats, matchHistory } = this.saveManager.data;
    document.getElementById('hist-total-points').textContent = `Chiến Tích: ${meritPoints}`;
    document.getElementById('hist-total-champs').textContent = `Vô Địch: ${stats.championshipCount}`;
    document.getElementById('hist-max-combo').textContent = `Max Combo: ${stats.maxBeatCombo}`;

    const tbody = document.getElementById('history-tbody');
    const emptyEl = document.getElementById('history-empty');
    tbody.innerHTML = '';

    if (!matchHistory.length) {
      emptyEl.classList.remove('hidden');
      return;
    }
    emptyEl.classList.add('hidden');

    for (const m of matchHistory) {
      const tr = document.createElement('tr');
      const d = new Date(m.timestamp);
      const dateStr = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
      const isWin = m.result === 'VICTORY';
      tr.innerHTML = `
        <td class="tabular-nums">${dateStr}</td>
        <td class="${isWin ? 'history-win' : 'history-loss'}">${isWin ? 'THẮNG' : 'THẤT BẠI'}</td>
        <td>${m.highestRound} · ${m.opponentName}</td>
        <td>${m.endReason}</td>
        <td class="tabular-nums">${m.perfectCount} / ${m.goodCount} / ${m.missCount}</td>
        <td class="tabular-nums">${m.maxComboInMatch}</td>
        <td class="tabular-nums highlight-gold">+${m.harvestPointsEarned}</td>
      `;
      tbody.appendChild(tr);
    }
  }

  updateHUD(player, enemy, roundConfig, timeRemaining, beatCombo, clashActive) {
    if (this.elPlayerHudName) {
      this.elPlayerHudName.textContent = player.name;
    }
    const pHpPct = Math.max(0, Math.min(100, (player.hp / player.maxHp) * 100));
    this.elPlayerHpFill.style.width = `${pHpPct}%`;
    this.elPlayerHpText.textContent = `${Math.ceil(player.hp)}/${player.maxHp}`;
    this.elPlayerStamFill.style.width = `${Math.max(0, player.stamina)}%`;
    this.elPlayerStamText.textContent = `Thể lực ${Math.floor(player.stamina)}%`;
    this.elPlayerHypeFill.style.width = `${Math.max(0, player.remixHype)}%`;

    const tpl = getBuffaloTemplate(this.saveManager.getSelectedBuffalo()?.id);
    this.elPlayerHypeText.textContent = player.isLinhNguu()
      ? `${tpl.rageSkillName.toUpperCase()} ${player.linhNguuTimer.toFixed(1)}s`
      : `Sĩ khí ${Math.floor(player.remixHype)}%`;
    this.elPlayerHypeTrack.classList.toggle('linh-nguu-ready', player.isLinhNguu());

    const playerRageReady = player.rage >= GAME_CONFIG.RAGE.MAX;
    this.elPlayerRageFill.style.width = `${Math.max(0, Math.min(100, player.rage))}%`;
    this.elPlayerRageText.textContent = playerRageReady
      ? 'NỘ ĐẦY! [U]'
      : `Nộ khí ${Math.floor(player.rage)}%`;
    this.elPlayerRageTrack.classList.toggle('rage-ready', playerRageReady);

    const wpStacks = player.weakPointStacks || 0;
    const wpBonus = wpStacks * Math.round(GAME_CONFIG.WEAK_POINT.STACK_DAMAGE_BONUS * 100);
    this.elPlayerWeakPoint.textContent = wpStacks > 0 ? `Điểm yếu ${wpStacks}/5 (+${wpBonus}%)` : 'Điểm yếu 0/5';
    this.elPlayerWeakPoint.classList.toggle('active', wpStacks > 0);

    this.elPlayerBalText.textContent = `Thế Trụ ${Math.round(player.balance)}%`;
    this.elPlayerStatus.textContent = player.stunTimer > 0
      ? `Choáng ${player.stunTimer.toFixed(1)}s`
      : player.isLinhNguu()
        ? `Kích hoạt: ${tpl.rageSkillName}!`
        : player.flankAdvantageTimer > 0
          ? 'Góc sườn mở! Đánh Điểm Yếu!'
          : player.balance < 55
            ? 'Cảnh báo: Sát vạch vôi!'
            : 'Vững nhịp trống';

    this.elEnemyName.textContent = enemy.name;
    const eHpPct = Math.max(0, Math.min(100, (enemy.hp / enemy.maxHp) * 100));
    this.elEnemyHpFill.style.width = `${eHpPct}%`;
    this.elEnemyHpText.textContent = `${Math.ceil(enemy.hp)}/${enemy.maxHp}`;
    this.elEnemyStamFill.style.width = `${Math.max(0, enemy.stamina)}%`;
    this.elEnemyStamText.textContent = `Thể lực ${Math.floor(enemy.stamina)}%`;
    this.elEnemyHypeFill.style.width = `${Math.max(0, enemy.remixHype)}%`;
    this.elEnemyHypeText.textContent = enemy.isLinhNguu()
      ? `NỘ ${enemy.linhNguuTimer.toFixed(1)}s`
      : `Sĩ khí ${Math.floor(enemy.remixHype)}%`;
    this.elEnemyRageFill.style.width = `${Math.max(0, Math.min(100, enemy.rage))}%`;
    this.elEnemyRageText.textContent =
      enemy.rage >= GAME_CONFIG.RAGE.MAX ? 'NỘ ĐẦY!' : `Nộ khí ${Math.floor(enemy.rage)}%`;
    this.elEnemyBalText.textContent = `Thế Trụ ${Math.round(enemy.balance)}%`;
    this.elEnemyStatus.textContent = enemy.stunTimer > 0
      ? `Choáng ${enemy.stunTimer.toFixed(1)}s`
      : enemy.basePoiseMultiplier < 0.7
        ? 'Giáp Chống Đẩy Lùi'
        : 'Đang giao chiến';

    this.elHudRoundLabel.textContent = roundConfig.shortLabel;
    this.elHudTimer.textContent = Math.max(0, timeRemaining).toFixed(1);
    this.elHudBpm.textContent = `${roundConfig.bpm} BPM`;
    this.elHudCombo.textContent = `Combo ${beatCombo}`;

    if (player.isLinhNguu()) {
      this.elLinhNguuBanner.textContent = `${tpl.rageSkillName.toUpperCase()} · ${player.linhNguuTimer.toFixed(1)}s`;
    }
    this.elLinhNguuBanner.classList.toggle('hidden', !player.isLinhNguu());
    this.elClashBanner.classList.toggle('hidden', !clashActive);

    // Update Skill Buttons cooldown, exhausted, and Rage ready states
    for (const [id, btn] of Object.entries(this.skillBtns)) {
      const skill = GAME_CONFIG.SKILLS[id];
      const cd = player.cooldowns[id] || 0;
      if (id === 'NO') {
        btn.classList.toggle('rage-ready', playerRageReady);
        btn.classList.toggle('rage-locked', !playerRageReady);
      } else {
        const exhausted = !player.isLinhNguu() && player.stamina < skill.staminaCost;
        btn.classList.toggle('exhausted', exhausted);
      }
      const cdEl = this.skillCds[id];
      if (cd > 0.05) {
        cdEl.textContent = cd.toFixed(1);
        cdEl.classList.add('visible');
      } else {
        cdEl.classList.remove('visible');
      }
    }
  }

  showRoundResult(roundNum, outcomeLabel, beatStats) {
    document.getElementById('round-result-reason').textContent = outcomeLabel;
    document.getElementById('round-result-title').textContent = `Chiến Thắng Vòng ${roundNum}`;
    document.getElementById('rr-perfect').textContent = String(beatStats.perfectCount);
    document.getElementById('rr-good').textContent = String(beatStats.goodCount);
    document.getElementById('rr-miss').textContent = String(beatStats.missCount);
    document.getElementById('rr-combo').textContent = String(beatStats.maxComboInMatch);
    this.showScreen('ROUND_RESULT');
  }

  showVictory(record, stageInfo = null) {
    const kickerEl = document.getElementById('vic-kicker');
    const titleEl = document.getElementById('vic-title');
    const rewardBanner = document.getElementById('vic-reward-banner');
    const nextStageBtn = document.getElementById('btn-victory-next-stage');
    const replayBtn = document.getElementById('btn-victory-replay');

    if (stageInfo) {
      kickerEl.textContent = `${stageInfo.stageName} · Vượt Ải Thành Công`;
      titleEl.textContent = `Chiến Thắng! Nhận +${stageInfo.earnedMerit} Điểm Chiến Tích`;
      rewardBanner.textContent = stageInfo.newlyUnlockedStage
        ? `Chiến Thắng! Nhận +${stageInfo.earnedMerit} Điểm Chiến Tích · Đã mở khóa Ải ${stageInfo.newlyUnlockedStage}!`
        : `Chiến Thắng! Nhận +${stageInfo.earnedMerit} Điểm Chiến Tích`;
      rewardBanner.classList.remove('hidden');

      const hasNextStage = stageInfo.stageId < 10;
      nextStageBtn.classList.toggle('hidden', !hasNextStage);
      replayBtn.textContent = 'Đấu Lại Ải Này';
    } else {
      kickerEl.textContent = 'Vô Địch Đại Lễ · Rước Kiệu Cầu Mùa';
      titleEl.textContent = 'Mưa Thuận Gió Hòa, Sóng Yên Biển Lặng';
      rewardBanner.classList.add('hidden');
      nextStageBtn.classList.add('hidden');
      replayBtn.textContent = 'Mở Đại Lễ Mới';
    }

    document.getElementById('vic-points').textContent = `+${record.harvestPointsEarned}`;
    document.getElementById('vic-perfect').textContent = String(record.perfectCount);
    document.getElementById('vic-combo').textContent = String(record.maxComboInMatch);
    document.getElementById('vic-reason').textContent = record.endReason;
    this.showScreen('VICTORY');
    this.renderVictoryCanvas();
  }

  renderVictoryCanvas() {
    const c = document.getElementById('victory-canvas');
    const ctx = c.getContext('2d');
    ctx.clearRect(0, 0, c.width, c.height);

    const sky = ctx.createLinearGradient(0, 0, 0, c.height);
    sky.addColorStop(0, '#0ea5e9');
    sky.addColorStop(0.65, '#bae6fd');
    sky.addColorStop(1, '#fde68a');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, c.width, c.height);

    const rainbow = ['#ef4444', '#f97316', '#facc15', '#22c55e', '#3b82f6', '#6366f1', '#a855f7'];
    for (let i = 0; i < rainbow.length; i++) {
      ctx.strokeStyle = rainbow[i];
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(280, 170, 140 - i * 5, Math.PI, Math.PI * 2);
      ctx.stroke();
    }

    ctx.fillStyle = '#78350f';
    ctx.fillRect(0, 145, c.width, 45);

    if (this.assets.hasTool && this.assets.tools.palanquin) {
      ctx.drawImage(this.assets.tools.palanquin, 210, 42, 140, 130);
    }
    const selected = this.saveManager.getSelectedBuffalo();
    const tpl = getBuffaloTemplate(selected?.id);
    if (this.assets.hasTrau) {
      const hero = this.assets.getBuffaloFrame(tpl.spriteRow, 2);
      if (hero) ctx.drawImage(hero.canvas, 86, 62, 110, 110);
    }
    if (this.assets.hasTool && this.assets.tools.flag) {
      ctx.drawImage(this.assets.tools.flag, 390, 62, 92, 92);
    }
  }

  showGameOver(stageOrRoundLabel, outcomeLabel, record, isTrainingStage = false) {
    document.getElementById('go-reason').textContent = outcomeLabel;
    document.getElementById('go-round').textContent = String(stageOrRoundLabel);
    document.getElementById('go-points').textContent = `+${record.harvestPointsEarned}`;
    document.getElementById('go-perfect').textContent = String(record.perfectCount);
    document.getElementById('go-combo').textContent = String(record.maxComboInMatch);

    const advice = isTrainingStage
      ? 'Bô Lão khuyên: Bạn nhận +0 Điểm Chiến Tích. Hãy vào Cửa Hàng nâng cấp chỉ số Trâu/Skill Nộ hoặc luyện lại nhịp trống để phục thù!'
      : record.endReason === 'RING_OUT'
        ? 'Bô Lão khuyên: Khi Thế Trụ giảm sát mép vôi, hãy dùng Né Bước (Shift) lách vào trong!'
        : 'Bô Lão khuyên: Canh chuẩn Vòng Tròn Nhịp Trống để hồi Thể lực và kích hoạt Linh Ngưu!';
    document.getElementById('go-advice').textContent = advice;
    this.showScreen('GAME_OVER');
  }
}
