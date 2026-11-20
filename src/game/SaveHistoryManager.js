const STORAGE_KEY = 'choi_trau_remix_save_v1';
const MAX_HISTORY = 50;

function createDefaultSave() {
  return {
    schemaVersion: 1,
    tutorial_completed: false,
    lastUpdated: new Date().toISOString(),
    stats: {
      totalHarvestPoints: 0,
      maxBeatCombo: 0,
      championshipCount: 0,
    },
    inventory: {
      unlockedHorns: ['horn_default'],
      equippedHorn: 'horn_default',
      unlockedTracks: ['track_folk_edm_1'],
      equippedTrack: 'track_folk_edm_1',
    },
    matchHistory: [],
  };
}

export class SaveHistoryManager {
  constructor() {
    this.data = this.load();
  }

  load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        const fresh = createDefaultSave();
        this.saveRaw(fresh);
        return fresh;
      }
      const parsed = JSON.parse(raw);
      if (!this.isValidSave(parsed)) {
        const fresh = createDefaultSave();
        this.saveRaw(fresh);
        return fresh;
      }
      return this.normalizeSave(parsed);
    } catch {
      const fresh = createDefaultSave();
      this.saveRaw(fresh);
      return fresh;
    }
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

  markTutorialCompleted() {
    if (!this.data.tutorial_completed) {
      this.data.tutorial_completed = true;
      this.save();
    }
  }

  isValidSave(obj) {
    if (!obj || typeof obj !== 'object') return false;
    if (obj.schemaVersion !== 1) return false;
    if (!obj.stats || typeof obj.stats !== 'object') return false;
    if (typeof obj.stats.totalHarvestPoints !== 'number') return false;
    if (typeof obj.stats.maxBeatCombo !== 'number') return false;
    if (typeof obj.stats.championshipCount !== 'number') return false;
    if (!obj.inventory || typeof obj.inventory !== 'object') return false;
    if (!Array.isArray(obj.inventory.unlockedHorns)) return false;
    if (!Array.isArray(obj.inventory.unlockedTracks)) return false;
    if (!Array.isArray(obj.matchHistory)) return false;
    return true;
  }

  normalizeSave(obj) {
    const def = createDefaultSave();
    const horns = Array.from(new Set(['horn_default', ...obj.inventory.unlockedHorns]));
    const tracks = Array.from(new Set(['track_folk_edm_1', ...obj.inventory.unlockedTracks]));
    const equippedHorn = horns.includes(obj.inventory.equippedHorn)
      ? obj.inventory.equippedHorn
      : 'horn_default';
    const equippedTrack = tracks.includes(obj.inventory.equippedTrack)
      ? obj.inventory.equippedTrack
      : 'track_folk_edm_1';

    const cleanHistory = obj.matchHistory
      .filter((m) => m && typeof m.matchId === 'string' && typeof m.timestamp === 'string')
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, MAX_HISTORY);

    return {
      schemaVersion: 1,
      tutorial_completed: Boolean(obj.tutorial_completed),
      lastUpdated: obj.lastUpdated || def.lastUpdated,
      stats: {
        totalHarvestPoints: Math.max(0, Math.floor(obj.stats.totalHarvestPoints || 0)),
        maxBeatCombo: Math.max(0, Math.floor(obj.stats.maxBeatCombo || 0)),
        championshipCount: Math.max(0, Math.floor(obj.stats.championshipCount || 0)),
      },
      inventory: {
        unlockedHorns: horns,
        equippedHorn,
        unlockedTracks: tracks,
        equippedTrack,
      },
      matchHistory: cleanHistory,
    };
  }

  recordMatch(record) {
    const hex = Math.floor(Math.random() * 0xffff)
      .toString(16)
      .padStart(4, '0');
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
      harvestPointsEarned: record.harvestPointsEarned,
    };

    this.data.matchHistory.unshift(matchEntry);
    this.data.matchHistory = this.data.matchHistory.slice(0, MAX_HISTORY);

    this.data.stats.totalHarvestPoints += matchEntry.harvestPointsEarned;
    if (matchEntry.maxComboInMatch > this.data.stats.maxBeatCombo) {
      this.data.stats.maxBeatCombo = matchEntry.maxComboInMatch;
    }
    if (matchEntry.result === 'VICTORY') {
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
    if (this.data.stats.totalHarvestPoints < cost) return false;
    this.data.stats.totalHarvestPoints -= cost;
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
    if (this.data.stats.totalHarvestPoints < cost) return false;
    this.data.stats.totalHarvestPoints -= cost;
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
    const filename = `hoso_ongcau_${y}${m}${d}.json`;
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
        message: 'Cấu trúc tệp không hợp lệ (yêu cầu schemaVersion: 1, stats, inventory, matchHistory).',
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
    let newUniqueChampionships = 0;

    for (const m of imported.matchHistory) {
      if (!mergedMap.has(m.matchId)) {
        mergedMap.set(m.matchId, m);
        newUniquePoints += Math.max(0, Number(m.harvestPointsEarned) || 0);
        if (m.result === 'VICTORY') {
          newUniqueChampionships += 1;
        }
      }
    }

    const mergedHistory = Array.from(mergedMap.values())
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, MAX_HISTORY);

    const mergedPoints = Math.max(
      local.stats.totalHarvestPoints + newUniquePoints,
      imported.stats.totalHarvestPoints
    );
    const mergedMaxCombo = Math.max(local.stats.maxBeatCombo, imported.stats.maxBeatCombo);
    const mergedChamps = Math.max(
      local.stats.championshipCount + newUniqueChampionships,
      imported.stats.championshipCount
    );

    const unlockedHorns = Array.from(
      new Set([...local.inventory.unlockedHorns, ...imported.inventory.unlockedHorns])
    );
    const unlockedTracks = Array.from(
      new Set([...local.inventory.unlockedTracks, ...imported.inventory.unlockedTracks])
    );

    this.data = {
      schemaVersion: 1,
      tutorial_completed: Boolean(local.tutorial_completed || imported.tutorial_completed),
      lastUpdated: new Date().toISOString(),
      stats: {
        totalHarvestPoints: mergedPoints,
        maxBeatCombo: mergedMaxCombo,
        championshipCount: mergedChamps,
      },
      inventory: {
        unlockedHorns,
        equippedHorn: local.inventory.equippedHorn,
        unlockedTracks,
        equippedTrack: local.inventory.equippedTrack,
      },
      matchHistory: mergedHistory,
    };

    this.save();
    return {
      ok: true,
      message: `Đã gộp dữ liệu thành công! Tổng cộng ${mergedHistory.length} trận được lưu.`,
    };
  }
}
