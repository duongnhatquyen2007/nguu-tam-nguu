import { GAME_CONFIG } from './config.js';
import {
  BUFFALO_ROSTER,
  LEVEL_UP_GAIN,
  SHOP_UPGRADE_ITEMS,
  getBuffaloTemplate,
} from './GameConfig.js';

export class ShopUI {
  constructor(saveManager, soundManager, assets, onShopUpdated) {
    this.saveManager = saveManager;
    this.soundManager = soundManager;
    this.assets = assets;
    this.onShopUpdated = onShopUpdated;
    this.activeTab = 'buffaloes';

    this.bindTabEvents();
  }

  bindTabEvents() {
    const tabBtns = document.querySelectorAll('[data-shop-tab]');
    tabBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        this.activeTab = btn.getAttribute('data-shop-tab') || 'buffaloes';
        this.render();
      });
    });
  }

  open(defaultTab = null) {
    if (defaultTab) {
      this.activeTab = defaultTab;
    }
    this.clearFeedback();
    this.render();
  }

  clearFeedback() {
    const fb = document.getElementById('shop-feedback');
    if (fb) fb.classList.add('hidden');
  }

  showFeedback(message, isError = false) {
    const fb = document.getElementById('shop-feedback');
    if (!fb) return;
    fb.textContent = message;
    fb.classList.remove('hidden', 'error');
    if (isError) fb.classList.add('error');
  }

  notifyUpdate() {
    if (this.onShopUpdated) {
      this.onShopUpdated();
    }
  }

  render() {
    const { meritPoints, selectedBuffaloId } = this.saveManager.data;
    const balanceEl = document.getElementById('shop-points-balance');
    if (balanceEl) balanceEl.textContent = String(meritPoints);

    // Update active tab buttons & panels
    document.querySelectorAll('[data-shop-tab]').forEach((btn) => {
      const tab = btn.getAttribute('data-shop-tab');
      btn.classList.toggle('active', tab === this.activeTab);
    });
    const panels = {
      buffaloes: document.getElementById('shop-panel-buffaloes'),
      upgrades: document.getElementById('shop-panel-upgrades'),
      skills: document.getElementById('shop-panel-skills'),
    };
    for (const [k, el] of Object.entries(panels)) {
      if (el) el.classList.toggle('hidden', k !== this.activeTab);
    }

    if (this.activeTab === 'buffaloes') {
      this.renderBuffaloesTab(meritPoints, selectedBuffaloId);
    } else if (this.activeTab === 'upgrades') {
      this.renderUpgradesTab(meritPoints);
    } else {
      this.renderSkillsTab(meritPoints);
    }
  }

  drawBuffaloThumb(canvas, tpl) {
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const frame = this.assets ? this.assets.getBuffaloFrame(tpl.spriteRow, 1) : null;
    if (frame && frame.canvas) {
      ctx.drawImage(frame.canvas, -4, -4, canvas.width + 8, canvas.height + 8);
    } else {
      ctx.fillStyle = tpl.bodyColor;
      ctx.beginPath();
      ctx.arc(canvas.width / 2, canvas.height / 2 + 4, 20, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = tpl.accentColor;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(canvas.width / 2, canvas.height / 2 - 8, 16, Math.PI * 0.15, Math.PI * 0.85, true);
      ctx.stroke();
    }
  }

  renderBuffaloesTab(meritPoints, selectedBuffaloId) {
    const container = document.getElementById('shop-buffaloes-grid');
    if (!container) return;
    container.innerHTML = '';

    for (const tpl of BUFFALO_ROSTER) {
      const owned = this.saveManager.data.ownedBuffaloes.find((b) => b.id === tpl.id);
      const isSelected = owned && selectedBuffaloId === tpl.id;
      const stats = owned ? owned.stats : tpl.baseStats;

      const card = document.createElement('div');
      card.className = `buffalo-shop-card ${isSelected ? 'selected' : ''} ${owned ? 'owned' : ''}`;

      const head = document.createElement('div');
      head.className = 'buffalo-card-head';

      const thumb = document.createElement('canvas');
      thumb.width = 68;
      thumb.height = 68;
      thumb.className = 'buffalo-thumb-canvas';
      this.drawBuffaloThumb(thumb, tpl);

      const titleBox = document.createElement('div');
      titleBox.className = 'buffalo-card-title';
      titleBox.innerHTML = `
        <div class="buffalo-name-row">
          <strong>${tpl.name}</strong>
          ${owned ? `<span class="badge-lvl tabular-nums">Cấp ${owned.level}</span>` : '<span class="badge-lock">Chưa Sở Hữu</span>'}
        </div>
        <div class="buffalo-subtitle">${tpl.title}</div>
      `;

      head.appendChild(thumb);
      head.appendChild(titleBox);
      card.appendChild(head);

      const statsRow = document.createElement('div');
      statsRow.className = 'buffalo-stats-grid tabular-nums';
      statsRow.innerHTML = `
        <span>Máu: <strong>${stats.maxHp}</strong></span>
        <span>Công: <strong>${stats.attack}</strong></span>
        <span>Thủ: <strong>${stats.defense}</strong></span>
        <span>Đẩy: <strong>${stats.knockback}</strong></span>
      `;
      card.appendChild(statsRow);

      const skillBox = document.createElement('div');
      skillBox.className = 'buffalo-rage-box';
      skillBox.innerHTML = `
        <div class="rage-skill-title">Skill Nộ: ${tpl.rageSkillName} ${owned ? `(Lv.${owned.skillLevel}/5)` : ''}</div>
        <p class="rage-skill-desc">${tpl.rageSkillDesc}</p>
      `;
      card.appendChild(skillBox);

      const actionBtn = document.createElement('button');
      actionBtn.type = 'button';
      if (isSelected) {
        actionBtn.className = 'btn-primary btn-sm buffalo-action-btn';
        actionBtn.textContent = 'Đang Xuất Chiến';
        actionBtn.disabled = true;
      } else if (owned) {
        actionBtn.className = 'btn-secondary btn-sm buffalo-action-btn';
        actionBtn.textContent = 'Chọn Xuất Chiến';
        actionBtn.addEventListener('click', () => {
          this.saveManager.selectBuffalo(tpl.id);
          this.soundManager.playTone(260, 390, 0.14, 'triangle', 0.16);
          this.showFeedback(`Đã chọn ${tpl.name} xuất chiến!`);
          this.render();
          this.notifyUpdate();
        });
      } else {
        actionBtn.className = 'btn-primary btn-sm buffalo-action-btn';
        actionBtn.textContent = `Tuyển (${tpl.unlockCost} Chiến Tích)`;
        actionBtn.disabled = meritPoints < tpl.unlockCost;
        actionBtn.addEventListener('click', () => {
          const res = this.saveManager.buyBuffalo(tpl.id);
          if (res.ok) {
            this.soundManager.playCounterCrit();
            this.showFeedback(res.message);
            this.render();
            this.notifyUpdate();
          } else {
            this.showFeedback(res.message, true);
          }
        });
      }
      card.appendChild(actionBtn);
      container.appendChild(card);
    }
  }

  renderUpgradesTab(meritPoints) {
    const target = this.saveManager.getSelectedBuffalo();
    const tpl = getBuffaloTemplate(target.id);
    const upgradeCost = this.saveManager.getBuffaloUpgradeCost(target);

    const summaryEl = document.getElementById('shop-upgrade-target');
    if (summaryEl) {
      summaryEl.innerHTML = `
        <div class="upgrade-target-title">
          <strong>${target.name}</strong>
          <span class="badge-lvl tabular-nums">Cấp ${target.level} &rarr; Cấp ${target.level + 1}</span>
        </div>
        <div class="upgrade-target-stats tabular-nums">
          <span>Máu: ${target.stats.maxHp} <em>(+${LEVEL_UP_GAIN.maxHp})</em></span>
          <span>Công: ${target.stats.attack} <em>(+${LEVEL_UP_GAIN.attack})</em></span>
          <span>Thủ: ${target.stats.defense} <em>(+${LEVEL_UP_GAIN.defense})</em></span>
          <span>Đẩy: ${target.stats.knockback} <em>(+${LEVEL_UP_GAIN.knockback})</em></span>
        </div>
      `;
    }

    const itemsList = document.getElementById('shop-upgrade-items-list');
    if (itemsList) {
      itemsList.innerHTML = '';
      for (const item of SHOP_UPGRADE_ITEMS.LEVEL_UPGRADES) {
        const usedCount = this.saveManager.data.inventory[item.id] || 0;
        const row = document.createElement('div');
        row.className = 'shop-item equipped';
        row.innerHTML = `
          <div class="shop-item-info">
            <strong style="color:#fde047">${item.name} <span class="item-count-tag tabular-nums">(Đã dùng: ${usedCount})</span></strong>
            <span>${item.desc}</span>
          </div>
        `;
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'btn-primary btn-sm';
        btn.textContent = `Nâng Cấp (${upgradeCost} đ)`;
        btn.disabled = meritPoints < upgradeCost;
        btn.addEventListener('click', () => {
          const res = this.saveManager.upgradeSelectedBuffalo(item.id);
          if (res.ok) {
            this.soundManager.playCounterCrit();
            this.showFeedback(res.message);
            this.render();
            this.notifyUpdate();
          } else {
            this.showFeedback(res.message, true);
          }
        });
        row.appendChild(btn);
        itemsList.appendChild(row);
      }
    }

    // Cosmetic Horns & Music Tracks inside Upgrades tab
    const { inventory } = this.saveManager.data;
    const hornsList = document.getElementById('shop-horns-list');
    if (hornsList) {
      hornsList.innerHTML = '';
      for (const h of GAME_CONFIG.SHOP_HORNS) {
        const owned = inventory.unlockedHorns.includes(h.id);
        const equipped = inventory.equippedHorn === h.id;
        const row = document.createElement('div');
        row.className = `shop-item ${equipped ? 'equipped' : ''}`;
        row.innerHTML = `
          <div class="shop-item-info">
            <strong style="color:${h.color}">${h.name}</strong>
            <span>${h.desc}</span>
          </div>
        `;
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = equipped ? 'btn-primary btn-sm' : 'btn-secondary btn-sm';
        if (equipped) {
          btn.textContent = 'Đang Dùng';
          btn.disabled = true;
        } else if (owned) {
          btn.textContent = 'Trang Bị';
          btn.addEventListener('click', () => {
            this.saveManager.equipHorn(h.id);
            this.render();
            this.notifyUpdate();
          });
        } else {
          btn.textContent = `Mở (${h.cost} đ)`;
          btn.disabled = meritPoints < h.cost;
          btn.addEventListener('click', () => {
            if (this.saveManager.unlockHorn(h.id, h.cost)) {
              this.showFeedback(`Đã mở khóa ${h.name}!`);
              this.render();
              this.notifyUpdate();
            }
          });
        }
        row.appendChild(btn);
        hornsList.appendChild(row);
      }
    }

    const tracksList = document.getElementById('shop-tracks-list');
    if (tracksList) {
      tracksList.innerHTML = '';
      for (const t of GAME_CONFIG.SHOP_TRACKS) {
        const owned = inventory.unlockedTracks.includes(t.id);
        const equipped = inventory.equippedTrack === t.id;
        const row = document.createElement('div');
        row.className = `shop-item ${equipped ? 'equipped' : ''}`;
        row.innerHTML = `
          <div class="shop-item-info">
            <strong>${t.name}</strong>
            <span>${t.desc}</span>
          </div>
        `;
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = equipped ? 'btn-primary btn-sm' : 'btn-secondary btn-sm';
        if (equipped) {
          btn.textContent = 'Đang Chọn';
          btn.disabled = true;
        } else if (owned) {
          btn.textContent = 'Chọn Nhạc';
          btn.addEventListener('click', () => {
            this.saveManager.equipTrack(t.id);
            this.render();
            this.notifyUpdate();
          });
        } else {
          btn.textContent = `Mở (${t.cost} đ)`;
          btn.disabled = meritPoints < t.cost;
          btn.addEventListener('click', () => {
            if (this.saveManager.unlockTrack(t.id, t.cost)) {
              this.showFeedback(`Đã mở khóa nhạc ${t.name}!`);
              this.render();
              this.notifyUpdate();
            }
          });
        }
        row.appendChild(btn);
        tracksList.appendChild(row);
      }
    }

    // Keep tpl referenced cleanly
    void tpl;
  }

  renderSkillsTab(meritPoints) {
    const target = this.saveManager.getSelectedBuffalo();
    const tpl = getBuffaloTemplate(target.id);
    const maxLvl = SHOP_UPGRADE_ITEMS.SKILL_UPGRADE.maxLevel;
    const isMax = target.skillLevel >= maxLvl;
    const cost = this.saveManager.getSkillUpgradeCost(target);
    const currentDur = 8 + (target.skillLevel - 1) * 1.0;
    const currentBonus = (target.skillLevel - 1) * 15;
    const nextDur = 8 + target.skillLevel * 1.0;
    const nextBonus = target.skillLevel * 15;

    const panel = document.getElementById('shop-skill-card-wrap');
    if (!panel) return;
    panel.innerHTML = '';

    const card = document.createElement('div');
    card.className = 'skill-upgrade-panel';
    card.innerHTML = `
      <div class="skill-upgrade-header">
        <div>
          <div class="modal-kicker">Tuyệt Kỹ Nộ (Kích hoạt khi 100% Sĩ Khí)</div>
          <h3>${target.name} &middot; ${tpl.rageSkillName}</h3>
        </div>
        <span class="badge-lvl tabular-nums">Skill Cấp ${target.skillLevel} / ${maxLvl}</span>
      </div>
      <p class="skill-upgrade-desc">${tpl.rageSkillDesc}</p>
      <div class="skill-scaling-row tabular-nums">
        <div class="scaling-cell">
          <span>Thời gian duy trì</span>
          <strong>${currentDur.toFixed(1)}s ${!isMax ? `&rarr; ${nextDur.toFixed(1)}s` : '(Tối đa)'}</strong>
        </div>
        <div class="scaling-cell">
          <span>Cường hóa hiệu quả</span>
          <strong>+${currentBonus}% ${!isMax ? `&rarr; +${nextBonus}%` : '(Tối đa)'}</strong>
        </div>
      </div>
    `;

    const book = SHOP_UPGRADE_ITEMS.SKILL_UPGRADE;
    const usedCount = this.saveManager.data.inventory[book.id] || 0;
    const actionRow = document.createElement('div');
    actionRow.className = 'shop-item equipped';
    actionRow.innerHTML = `
      <div class="shop-item-info">
        <strong style="color:#fde047">${book.name} <span class="item-count-tag tabular-nums">(Đã dùng: ${usedCount})</span></strong>
        <span>${book.desc}</span>
      </div>
    `;

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn-primary btn-sm';
    if (isMax) {
      btn.textContent = 'Đã Đạt Cấp Tối Đa (Lv.5)';
      btn.disabled = true;
    } else {
      btn.textContent = `Đột Phá (${cost} Chiến Tích)`;
      btn.disabled = meritPoints < cost;
      btn.addEventListener('click', () => {
        const res = this.saveManager.upgradeSelectedSkill();
        if (res.ok) {
          this.soundManager.playLinhNguuDrop();
          this.showFeedback(res.message);
          this.render();
          this.notifyUpdate();
        } else {
          this.showFeedback(res.message, true);
        }
      });
    }
    actionRow.appendChild(btn);
    card.appendChild(actionRow);
    panel.appendChild(card);
  }
}
