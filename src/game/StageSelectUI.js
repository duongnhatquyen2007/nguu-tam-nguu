import { TRAINING_STAGES, getBuffaloTemplate } from './GameConfig.js';

export class StageSelectUI {
  constructor(saveManager, soundManager, assets, callbacks) {
    this.saveManager = saveManager;
    this.soundManager = soundManager;
    this.assets = assets;
    this.callbacks = callbacks; // { onSelectStage, onBuffaloChanged, onOpenShop }
  }

  open() {
    this.render();
  }

  render() {
    const { unlockedStage, meritPoints, ownedBuffaloes, selectedBuffaloId } = this.saveManager.data;
    const selected = this.saveManager.getSelectedBuffalo();

    const meritEl = document.getElementById('stages-merit-balance');
    if (meritEl) meritEl.textContent = String(meritPoints);

    const progressEl = document.getElementById('stages-unlocked-progress');
    if (progressEl) progressEl.textContent = `${unlockedStage} / ${TRAINING_STAGES.length}`;

    // Render quick owned buffalo selector bar
    const switcher = document.getElementById('stages-buffalo-switcher');
    if (switcher) {
      switcher.innerHTML = '';
      for (const owned of ownedBuffaloes) {
        const btn = document.createElement('button');
        btn.type = 'button';
        const active = owned.id === selectedBuffaloId;
        btn.className = `stage-buffalo-pill ${active ? 'active' : ''}`;
        btn.textContent = `${owned.name} (Lv.${owned.level})`;
        btn.addEventListener('click', () => {
          this.saveManager.selectBuffalo(owned.id);
          this.soundManager.playTone(240, 340, 0.1, 'triangle', 0.15);
          this.render();
          this.callbacks?.onBuffaloChanged?.();
        });
        switcher.appendChild(btn);
      }
    }

    const activeStatsEl = document.getElementById('stages-active-stats');
    if (activeStatsEl && selected) {
      const tpl = getBuffaloTemplate(selected.id);
      activeStatsEl.innerHTML = `
        <strong>${selected.name}</strong> (Cấp ${selected.level}) &middot;
        Máu <b>${selected.stats.maxHp}</b> ·
        Công <b>${selected.stats.attack}</b> ·
        Thủ <b>${selected.stats.defense}</b> ·
        Đẩy <b>${selected.stats.knockback}</b> ·
        Nộ <b>${tpl.rageSkillName} (Lv.${selected.skillLevel})</b>
      `;
    }

    const grid = document.getElementById('stages-grid');
    if (!grid) return;
    grid.innerHTML = '';

    for (const stage of TRAINING_STAGES) {
      const unlocked = stage.stageId <= unlockedStage;
      const cleared = stage.stageId < unlockedStage;
      const bot = stage.botConfig;

      const card = document.createElement('div');
      card.className = `stage-card ${unlocked ? 'unlocked' : 'locked'} ${cleared ? 'cleared' : ''}`;

      const thumb = document.createElement('canvas');
      thumb.width = 56;
      thumb.height = 56;
      thumb.className = 'stage-bot-thumb';
      const tCtx = thumb.getContext('2d');
      const frame = this.assets ? this.assets.getBuffaloFrame(bot.spriteRow, 1) : null;
      if (frame && frame.canvas) {
        tCtx.drawImage(frame.canvas, -4, -4, 64, 64);
      } else {
        tCtx.fillStyle = bot.bodyColor;
        tCtx.beginPath();
        tCtx.arc(28, 30, 17, 0, Math.PI * 2);
        tCtx.fill();
      }

      const info = document.createElement('div');
      info.className = 'stage-card-info';
      info.innerHTML = `
        <div class="stage-card-top">
          <strong class="stage-title">${stage.stageName}</strong>
          <span class="stage-status-badge ${cleared ? 'cleared' : unlocked ? 'open' : 'locked'}">
            ${cleared ? 'Đã Vượt' : unlocked ? 'Sẵn Sàng' : 'Khóa'}
          </span>
        </div>
        <div class="stage-bot-line">
          <span>Địch: <strong>${bot.name}</strong> (Cấp ${bot.botLevel})</span>
          <span class="tabular-nums">${stage.bpm} BPM · ${stage.duration}s</span>
        </div>
        <div class="stage-power-row tabular-nums">
          <span>Lực Chiến: <strong>${stage.powerRating}</strong></span>
          <span class="stage-reward">Thưởng: +${stage.powerRating} Chiến Tích</span>
        </div>
      `;

      const rowTop = document.createElement('div');
      rowTop.className = 'stage-card-body';
      rowTop.appendChild(thumb);
      rowTop.appendChild(info);
      card.appendChild(rowTop);

      const actionBtn = document.createElement('button');
      actionBtn.type = 'button';
      actionBtn.className = unlocked ? 'btn-primary btn-sm stage-play-btn' : 'btn-secondary btn-sm stage-play-btn';
      actionBtn.textContent = unlocked ? 'Xuất Trận Ải Này' : `Cần Vượt Ải ${stage.stageId - 1}`;
      actionBtn.disabled = !unlocked;
      if (unlocked) {
        actionBtn.addEventListener('click', () => {
          this.soundManager.ensureContext();
          this.callbacks?.onSelectStage?.(stage);
        });
      }
      card.appendChild(actionBtn);
      grid.appendChild(card);
    }
  }
}
