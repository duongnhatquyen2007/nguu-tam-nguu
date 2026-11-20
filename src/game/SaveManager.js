import { getBuffaloTemplate, LEVEL_UP_GAIN, SHOP_UPGRADE_ITEMS } from './GameConfig.js';

const STORAGE_KEY = 'choi_trau_remix_player_v2';
const LEGACY_STORAGE_KEY = 'choi_trau_remix_save_v1';
const MAX_HISTORY = 50;

function createDefaultBuffalo() {
  return {
    id: 'buffalo_hac_phong',
    name: 'Ông Cầu Hắc Phong',
    level: 1,
    skillLevel: 1,
    rageSkillId: 'skill_linh_nguu_xung_kich',
    stats: {
      maxHp: 100,
      attack: 15,
      defense: 10,
      knockback: 12,
    },
  };
}

function createDefaultPlayerData() {
  return {
    schemaVersion: 2,
    playerName: 'Chủ Trại Tân Thủ',
    farmName: 'Ngưu Trại Đại Lễ',
    meritPoints: 0,
    selectedBuffaloId: 'buffalo_hac_phong',
    unlockedStage: 1,
    ownedBuffaloes: [createDefaultBuffalo()],
    inventory: {
      co_non_linh_khi: 0,
      cao_sung_trau: 0,
      bi_kip_vo_nghe: 0,
      unlockedHorns: ['horn_default'],
      equippedHorn: 'horn_default',
      unlockedTracks: ['track_folk_edm_1'],
      equippedTrack: 'track_folk_edm_1',
    },
    tutorial_completed: false,
    lastUpdated: new Date().toISOString(),
    stats: {
      maxBeatCombo: 0,
      championshipCount: 0,
    },
    matchHistory: [],
  };
}

export class SaveManager {
  constructor() {
    this.data = this.load();
  }

  load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (this.isValidSave(parsed)) {
          return this.normalizeSave(parsed);
        }
      }

      // Migrate seamlessly from v1 save if present
      const legacyRaw = localStorage.getItem(LEGACY_STORAGE_KEY);
      if (legacyRaw) {
        const legacy = JSON.parse(legacyRaw);
        const migrated = this.migrateFromV1(legacy);
        this.saveRaw(migrated);
        return migrated;
      }

      const fresh = createDefaultPlayerData();
      this.saveRaw(fresh);
      return fresh;
    } catch {
      const fresh = createDefaultPlayerData();
      this.saveRaw(fresh);
      return fresh;
    }
  }

  migrateFromV1(v1) {
    const def = createDefaultPlayerData();
    if (!v1 || typeof v1 !== 'object') return def;

    const legacyPoints = Math.max(0, Math.floor(v1.stats?.totalHarvestPoints || 0));
    const horns = Array.isArray(v1.inventory?.unlockedHorns)
      ? Array.from(new Set(['horn_default', ...v1.inventory.unlockedHorns]))
      : ['horn_default'];
    const tracks = Array.isArray(v1.inventory?.unlockedTracks)
      ? Array.from(new Set(['track_folk_edm_1', ...v1.inventory.unlockedTracks]))
      : ['track_folk_edm_1'];

    return this.normalizeSave({
      ...def,
      meritPoints: legacyPoints,
      tutorial_completed: Boolean(v1.tutorial_completed),
      inventory: {
        ...def.inventory,
        unlockedHorns: horns,
        equippedHorn: v1.inventory?.equippedHorn || 'horn_default',
        unlockedTracks: tracks,
        equippedTrack: v1.inventory?.equippedTrack || 'track_folk_edm_1',
      },
      stats: {
        maxBeatCombo: Math.max(0, Math.floor(v1.stats?.maxBeatCombo || 0)),
        championshipCount: Math.max(0, Math.floor(v1.stats?.championshipCount || 0)),
      },
      matchHistory: Array.isArray(v1.matchHistory) ? v1.matchHistory : [],
    });
  }

  saveRaw(obj) {
    obj.lastUpdated = new Date().toISOString();
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(obj));
    } catch {
      // Ignore quota errors gracefully
    }
  }

  save() {
    this.saveRaw(this.data);
  }

  isValidSave(obj) {
    if (!obj || typeof obj !== 'object') return false;
    if (obj.schemaVersion !== 2 && obj.schemaVersion !== 1) return false;
    if (obj.schemaVersion === 2) {
      if (typeof obj.meritPoints !== 'number') return false;
      if (!Array.isArray(obj.ownedBuffaloes) || obj.ownedBuffaloes.length === 0) return false;
      if (!obj.inventory || typeof obj.inventory !== 'object') return false;
      return true;
    }
    return Boolean(obj.stats && obj.inventory && Array.isArray(obj.matchHistory));
  }

  normalizeBuffaloEntry(entry) {
    const tpl = getBuffaloTemplate(entry?.id);
    const level = Math.max(1, Math.floor(Number(entry?.level) || 1));
    const skillLevel = Math.min(
      SHOP_UPGRADE_ITEMS.SKILL_UPGRADE.maxLevel,
      Math.max(1, Math.floor(Number(entry?.skillLevel) || 1))
    );
    const lvlBonus = level - 1;
    const rawStats = entry?.stats || {};
    return {
      id: tpl.id,
      name: tpl.name,
      level,
      skillLevel,
      rageSkillId: tpl.rageSkillId,
      stats: {
        maxHp: Math.max(
          tpl.baseStats.maxHp + lvlBonus * LEVEL_UP_GAIN.maxHp,
          Math.floor(Number(rawStats.maxHp) || tpl.baseStats.maxHp)
        ),
        attack: Math.max(
          tpl.baseStats.attack + lvlBonus * LEVEL_UP_GAIN.attack,
          Math.floor(Number(rawStats.attack) || tpl.baseStats.attack)
        ),
        defense: Math.max(
          tpl.baseStats.defense + lvlBonus * LEVEL_UP_GAIN.defense,
          Math.floor(Number(rawStats.defense) || tpl.baseStats.defense)
        ),
        knockback: Math.max(
          tpl.baseStats.knockback + lvlBonus * LEVEL_UP_GAIN.knockback,
          Math.floor(Number(rawStats.knockback) || tpl.baseStats.knockback)
        ),
      },
    };
  }

  normalizeSave(obj) {
    if (obj.schemaVersion === 1) {
      return this.migrateFromV1(obj);
    }

    const def = createDefaultPlayerData();
    const buffMap = new Map();
    if (Array.isArray(obj.ownedBuffaloes)) {
      for (const b of obj.ownedBuffaloes) {
        if (b && typeof b.id === 'string') {
          const norm = this.normalizeBuffaloEntry(b);
          buffMap.set(norm.id, norm);
        }
      }
    }
    if (!buffMap.has('buffalo_hac_phong')) {
      buffMap.set('buffalo_hac_phong', createDefaultBuffalo());
    }

    const ownedBuffaloes = Array.from(buffMap.values());
    const selectedBuffaloId = buffMap.has(obj.selectedBuffaloId)
      ? obj.selectedBuffaloId
      : 'buffalo_hac_phong';

    const inv = obj.inventory || {};
    const horns = Array.from(
      new Set(['horn_default', ...(Array.isArray(inv.unlockedHorns) ? inv.unlockedHorns : [])])
    );
    const tracks = Array.from(
      new Set(['track_folk_edm_1', ...(Array.isArray(inv.unlockedTracks) ? inv.unlockedTracks : [])])
    );

    const cleanHistory = Array.isArray(obj.matchHistory)
      ? obj.matchHistory
          .filter((m) => m && typeof m.matchId === 'string' && typeof m.timestamp === 'string')
          .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
          .slice(0, MAX_HISTORY)
      : [];

    return {
      schemaVersion: 2,
      playerName:
        typeof obj.playerName === 'string' && obj.playerName.trim()
          ? obj.playerName.trim()
          : def.playerName,
      farmName:
        typeof obj.farmName === 'string' && obj.farmName.trim()
          ? obj.farmName.trim()
          : def.farmName,
      meritPoints: Math.max(0, Math.floor(Number(obj.meritPoints) || 0)),
      selectedBuffaloId,
      unlockedStage: Math.min(10, Math.max(1, Math.floor(Number(obj.unlockedStage) || 1))),
      ownedBuffaloes,
      inventory: {
        co_non_linh_khi: Math.max(0, Math.floor(Number(inv.co_non_linh_khi) || 0)),
        cao_sung_trau: Math.max(0, Math.floor(Number(inv.cao_sung_trau) || 0)),
        bi_kip_vo_nghe: Math.max(0, Math.floor(Number(inv.bi_kip_vo_nghe) || 0)),
        unlockedHorns: horns,
        equippedHorn: horns.includes(inv.equippedHorn) ? inv.equippedHorn : 'horn_default',
        unlockedTracks: tracks,
        equippedTrack: tracks.includes(inv.equippedTrack) ? inv.equippedTrack : 'track_folk_edm_1',
      },
      tutorial_completed: Boolean(obj.tutorial_completed),
      lastUpdated: obj.lastUpdated || def.lastUpdated,
      stats: {
        maxBeatCombo: Math.max(0, Math.floor(Number(obj.stats?.maxBeatCombo) || 0)),
        championshipCount: Math.max(0, Math.floor(Number(obj.stats?.championshipCount) || 0)),
      },
      matchHistory: cleanHistory,
    };
  }

  markTutorialCompleted() {
    if (!this.data.tutorial_completed) {
      this.data.tutorial_completed = true;
      this.save();
    }
  }

  getSelectedBuffalo() {
    const found = this.data.ownedBuffaloes.find((b) => b.id === this.data.selectedBuffaloId);
    return found || this.data.ownedBuffaloes[0];
  }

  ownsBuffalo(buffaloId) {
    return this.data.ownedBuffaloes.some((b) => b.id === buffaloId);
  }

  selectBuffalo(buffaloId) {
    if (!this.ownsBuffalo(buffaloId)) return false;
    this.data.selectedBuffaloId = buffaloId;
    this.save();
    return true;
  }

  buyBuffalo(buffaloId) {
    if (this.ownsBuffalo(buffaloId)) {
      return { ok: false, message: 'Chiến trâu này đã có trong Ngưu Trại!' };
    }
    const tpl = getBuffaloTemplate(buffaloId);
    if (!tpl || tpl.id !== buffaloId) {
      return { ok: false, message: 'Không tìm thấy chiến trâu.' };
    }
    if (this.data.meritPoints < tpl.unlockCost) {
      return { ok: false, message: 'Chưa đủ Điểm Chiến Tích để tuyển chiến trâu này.' };
    }

    this.data.meritPoints -= tpl.unlockCost;
    const newBuffalo = {
      id: tpl.id,
      name: tpl.name,
      level: 1,
      skillLevel: 1,
      rageSkillId: tpl.rageSkillId,
      stats: { ...tpl.baseStats },
    };
    this.data.ownedBuffaloes.push(newBuffalo);
    this.data.selectedBuffaloId = tpl.id;
    this.save();
    return {
      ok: true,
      buffalo: newBuffalo,
      message: `Đã tuyển ${tpl.name} vào Ngưu Trại & chọn xuất chiến!`,
    };
  }

  getBuffaloUpgradeCost(buffalo) {
    const target = buffalo || this.getSelectedBuffalo();
    return 50 * target.level;
  }

  upgradeSelectedBuffalo(itemId) {
    if (itemId !== 'co_non_linh_khi' && itemId !== 'cao_sung_trau') {
      return { ok: false, message: 'Vật phẩm nâng cấp không hợp lệ.' };
    }
    const target = this.getSelectedBuffalo();
    const cost = this.getBuffaloUpgradeCost(target);
    if (this.data.meritPoints < cost) {
      return { ok: false, message: `Cần ${cost} Điểm Chiến Tích để nâng cấp!` };
    }

    this.data.meritPoints -= cost;
    this.data.inventory[itemId] = (this.data.inventory[itemId] || 0) + 1;
    target.level += 1;
    target.stats.maxHp += LEVEL_UP_GAIN.maxHp;
    target.stats.attack += LEVEL_UP_GAIN.attack;
    target.stats.defense += LEVEL_UP_GAIN.defense;
    target.stats.knockback += LEVEL_UP_GAIN.knockback;
    this.save();

    return {
      ok: true,
      buffalo: target,
      cost,
      message: `${target.name} đã lên Cấp ${target.level}! (+15 Máu, +3 Công, +2 Thủ, +2 Đẩy)`,
    };
  }

  getSkillUpgradeCost(buffalo) {
    const target = buffalo || this.getSelectedBuffalo();
    return 100 * target.skillLevel;
  }

  upgradeSelectedSkill() {
    const target = this.getSelectedBuffalo();
    const maxLvl = SHOP_UPGRADE_ITEMS.SKILL_UPGRADE.maxLevel;
    if (target.skillLevel >= maxLvl) {
      return { ok: false, message: 'Skill Nộ đã đạt cấp tối đa (Cấp 5)!' };
    }
    const cost = this.getSkillUpgradeCost(target);
    if (this.data.meritPoints < cost) {
      return { ok: false, message: `Cần ${cost} Điểm Chiến Tích để đột phá Skill Nộ!` };
    }

    this.data.meritPoints -= cost;
    this.data.inventory.bi_kip_vo_nghe = (this.data.inventory.bi_kip_vo_nghe || 0) + 1;
    target.skillLevel += 1;
    this.save();

    return {
      ok: true,
      buffalo: target,
      cost,
      message: `Skill Nộ của ${target.name} đã lên Cấp ${target.skillLevel}! (+1.0s duy trì, +15% uy lực)`,
    };
  }

  completeStage(stageCfg, won) {
    let earnedMerit = 0;
    let newlyUnlockedStage = null;

    if (won && stageCfg) {
      earnedMerit = Math.max(0, Math.round(stageCfg.powerRating || 0));
      this.data.meritPoints += earnedMerit;
      if (stageCfg.stageId >= this.data.unlockedStage && stageCfg.stageId < 10) {
        this.data.unlockedStage = stageCfg.stageId + 1;
        newlyUnlockedStage = this.data.unlockedStage;
      }
      if (stageCfg.stageId === 10) {
        this.data.stats.championshipCount += 1;
      }
    }

    this.save();
    return {
      earnedMerit,
      unlockedStage: this.data.unlockedStage,
      newlyUnlockedStage,
      meritPoints: this.data.meritPoints,
    };
  }

  recordMatch(record, grantPoints = true) {
    const hex = Math.floor(Math.random() * 0xffff)
      .toString(16)
      .padStart(4, '0');
    const earned = Math.max(0, Math.round(Number(record.harvestPointsEarned) || 0));
    const matchEntry = {
      matchId: `match_${Date.now()}_${hex}`,
      timestamp: new Date().toISOString(),
      result: record.result,
      endReason: record.endReason,
      highestRound: record.highestRound,
      opponentName: record.opponentName,
      perfectCount: record.perfectCount,
      goodCount: record.goodCount,
      missCount: record.missCount,
      maxComboInMatch: record.maxComboInMatch,
      harvestPointsEarned: earned,
    };

    this.data.matchHistory.unshift(matchEntry);
    this.data.matchHistory = this.data.matchHistory.slice(0, MAX_HISTORY);

    if (grantPoints && earned > 0) {
      this.data.meritPoints += earned;
    }
    if (matchEntry.maxComboInMatch > this.data.stats.maxBeatCombo) {
      this.data.stats.maxBeatCombo = matchEntry.maxComboInMatch;
    }
    if (record.isFestivalChampion) {
      this.data.stats.championshipCount += 1;
    }
    this.save();
    return matchEntry;
  }

  unlockHorn(id, cost) {
    if (this.data.inventory.unlockedHorns.includes(id)) {
      this.data.inventory.equippedHorn = id;
      this.save();
      return true;
    }
    if (this.data.meritPoints < cost) return false;
    this.data.meritPoints -= cost;
    this.data.inventory.unlockedHorns.push(id);
    this.data.inventory.equippedHorn = id;
    this.save();
    return true;
  }

  equipHorn(id) {
    if (!this.data.inventory.unlockedHorns.includes(id)) return false;
    this.data.inventory.equippedHorn = id;
    this.save();
    return true;
  }

  unlockTrack(id, cost) {
    if (this.data.inventory.unlockedTracks.includes(id)) {
      this.data.inventory.equippedTrack = id;
      this.save();
      return true;
    }
    if (this.data.meritPoints < cost) return false;
    this.data.meritPoints -= cost;
    this.data.inventory.unlockedTracks.push(id);
    this.data.inventory.equippedTrack = id;
    this.save();
    return true;
  }

  equipTrack(id) {
    if (!this.data.inventory.unlockedTracks.includes(id)) return false;
    this.data.inventory.equippedTrack = id;
    this.save();
    return true;
  }

  exportJSON() {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    const filename = `hoso_nguutrai_${y}${m}${d}.json`;
    const blob = new Blob([JSON.stringify(this.data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    return filename;
  }

  importAndMergeJSON(jsonText) {
    let importedRaw;
    try {
      importedRaw = JSON.parse(jsonText);
    } catch {
      return { ok: false, message: 'Tệp JSON không đúng cú pháp.' };
    }

    if (!this.isValidSave(importedRaw)) {
      return {
        ok: false,
        message: 'Cấu trúc tệp PlayerData không hợp lệ.',
      };
    }

    const local = this.data;
    const imported = this.normalizeSave(importedRaw);

    const localMap = new Map();
    for (const m of local.matchHistory) {
      localMap.set(m.matchId, m);
    }

    const mergedMap = new Map(localMap);
    let newUniquePoints = 0;

    for (const m of imported.matchHistory) {
      if (!mergedMap.has(m.matchId)) {
        mergedMap.set(m.matchId, m);
        newUniquePoints += Math.max(0, Number(m.harvestPointsEarned) || 0);
      }
    }

    const mergedHistory = Array.from(mergedMap.values())
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, MAX_HISTORY);

    // Merge owned buffaloes by taking highest level & skillLevel per id
    const mergedBuffMap = new Map();
    for (const b of [...local.ownedBuffaloes, ...imported.ownedBuffaloes]) {
      const prev = mergedBuffMap.get(b.id);
      if (!prev) {
        mergedBuffMap.set(b.id, this.normalizeBuffaloEntry(b));
      } else {
        mergedBuffMap.set(
          b.id,
          this.normalizeBuffaloEntry({
            ...prev,
            level: Math.max(prev.level, b.level),
            skillLevel: Math.max(prev.skillLevel, b.skillLevel),
            stats: {
              maxHp: Math.max(prev.stats.maxHp, b.stats.maxHp),
              attack: Math.max(prev.stats.attack, b.stats.attack),
              defense: Math.max(prev.stats.defense, b.stats.defense),
              knockback: Math.max(prev.stats.knockback, b.stats.knockback),
            },
          })
        );
      }
    }

    const unlockedHorns = Array.from(
      new Set([...local.inventory.unlockedHorns, ...imported.inventory.unlockedHorns])
    );
    const unlockedTracks = Array.from(
      new Set([...local.inventory.unlockedTracks, ...imported.inventory.unlockedTracks])
    );

    this.data = this.normalizeSave({
      schemaVersion: 2,
      playerName: local.playerName || imported.playerName,
      farmName: local.farmName || imported.farmName,
      meritPoints: Math.max(local.meritPoints + newUniquePoints, imported.meritPoints),
      selectedBuffaloId: local.selectedBuffaloId,
      unlockedStage: Math.max(local.unlockedStage, imported.unlockedStage),
      ownedBuffaloes: Array.from(mergedBuffMap.values()),
      inventory: {
        co_non_linh_khi: Math.max(local.inventory.co_non_linh_khi, imported.inventory.co_non_linh_khi),
        cao_sung_trau: Math.max(local.inventory.cao_sung_trau, imported.inventory.cao_sung_trau),
        bi_kip_vo_nghe: Math.max(local.inventory.bi_kip_vo_nghe, imported.inventory.bi_kip_vo_nghe),
        unlockedHorns,
        equippedHorn: local.inventory.equippedHorn,
        unlockedTracks,
        equippedTrack: local.inventory.equippedTrack,
      },
      tutorial_completed: Boolean(local.tutorial_completed || imported.tutorial_completed),
      stats: {
        maxBeatCombo: Math.max(local.stats.maxBeatCombo, imported.stats.maxBeatCombo),
        championshipCount: Math.max(local.stats.championshipCount, imported.stats.championshipCount),
      },
      matchHistory: mergedHistory,
    });

    this.save();
    return {
      ok: true,
      message: `Đã nhập & đồng bộ dữ liệu Ngưu Trại! (${mergedBuffMap.size} trâu, Mở khóa Ải ${this.data.unlockedStage})`,
    };
  }
}
