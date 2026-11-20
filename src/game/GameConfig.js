export const BUFFALO_ROSTER = [
  {
    id: 'buffalo_hac_phong',
    name: 'Ông Cầu Hắc Phong',
    title: 'Chiến Ngưu Đeo Dải Lụa Đỏ',
    unlockCost: 0,
    spriteRow: 0,
    visualScale: 1.0,
    bodyColor: '#1b191b',
    accentColor: '#dc2626',
    rageSkillId: 'skill_linh_nguu_xung_kich',
    rageSkillName: 'Linh Ngưu Hộ Thể',
    rageSkillDesc:
      'Rực sáng hoa văn trống đồng đỏ, miễn nhiễm đẩy lùi và tự động tính mọi đòn đánh là PERFECT.',
    baseStats: {
      maxHp: 100,
      attack: 15,
      defense: 10,
      knockback: 12,
    },
  },
  {
    id: 'buffalo_bach_tang',
    name: 'Bạch Tạng Sơn Cước',
    title: 'Kình Ngưu Giáp Đá Miền Núi',
    unlockCost: 300,
    spriteRow: 1,
    visualScale: 1.02,
    bodyColor: '#8d8f8b',
    accentColor: '#e5d4b0',
    rageSkillId: 'skill_thach_son_bat_hoai',
    rageSkillName: 'Thạch Sơn Bất Hoại',
    rageSkillDesc:
      'Hóa giáp đá trong 8 giây, giảm 60% sát thương nhận vào và phản lại 30% sát thương khi bị húc.',
    baseStats: {
      maxHp: 145,
      attack: 13,
      defense: 22,
      knockback: 11,
    },
  },
  {
    id: 'buffalo_xich_hoa',
    name: 'Xích Hỏa Hải Long',
    title: 'Cuồng Ngưu Sóng Đỏ Miền Biển',
    unlockCost: 650,
    spriteRow: 2,
    visualScale: 1.0,
    bodyColor: '#9e361c',
    accentColor: '#fb923c',
    rageSkillId: 'skill_hai_long_cuon_song',
    rageSkillName: 'Hải Long Cuộn Sóng',
    rageSkillDesc:
      'Tạo lốc xoáy lửa quanh sừng, tăng 50% lực đẩy lùi và hút nhẹ đối thủ về phía mép vạch vôi.',
    baseStats: {
      maxHp: 110,
      attack: 17,
      defense: 12,
      knockback: 22,
    },
  },
  {
    id: 'buffalo_than_nguu',
    name: 'Thần Ngưu Lôi Đình',
    title: 'Trâu Thần Sấm Sét Đại Lễ',
    unlockCost: 1200,
    spriteRow: 3,
    visualScale: 1.16,
    bodyColor: '#1e1b2e',
    accentColor: '#38bdf8',
    rageSkillId: 'skill_loi_dinh_giang_the',
    rageSkillName: 'Lôi Đình Giáng Thế',
    rageSkillDesc:
      'Mỗi cú húc đúng nhịp trống triệu hồi tia sét đánh thẳng xuống đầu đối thủ, gây sát thương chuẩn và làm choáng 0.5 giây.',
    baseStats: {
      maxHp: 155,
      attack: 24,
      defense: 20,
      knockback: 20,
    },
  },
];

export const SHOP_UPGRADE_ITEMS = {
  LEVEL_UPGRADES: [
    {
      id: 'co_non_linh_khi',
      name: 'Bó Cỏ Non Linh Khí',
      desc: 'Bồi bổ sinh lực & thể chất: Cấp +1 (Máu +15, Công +3, Thủ +2, Đẩy +2).',
      tag: 'Sinh Lực & Thể Chất',
    },
    {
      id: 'cao_sung_trau',
      name: 'Sáp Dưỡng Sừng Trống Đồng',
      desc: 'Tôi luyện cặp sừng sắc bén: Cấp +1 (Máu +15, Công +3, Thủ +2, Đẩy +2).',
      tag: 'Sức Mạnh & Đẩy Lùi',
    },
  ],
  SKILL_UPGRADE: {
    id: 'bi_kip_vo_nghe',
    name: 'Bí Kíp Trống Hội',
    desc: 'Nâng cấp Skill Nộ (Tối đa Cấp 5): +1.0 giây duy trì Nộ & +15% hiệu quả mỗi cấp.',
    maxLevel: 5,
  },
};

export const LEVEL_UP_GAIN = {
  maxHp: 15,
  attack: 3,
  defense: 2,
  knockback: 2,
};

export function getBuffaloTemplate(buffaloId) {
  return BUFFALO_ROSTER.find((b) => b.id === buffaloId) || BUFFALO_ROSTER[0];
}

export function computePowerRating(botMaxHp, botAttack, botLevel) {
  return Math.round(botMaxHp * 0.5 + botAttack * 4 + botLevel * 25);
}

function createStage(stageId, stageName, bpm, duration, arenaTheme, buffaloId, botLevel, aiOverrides) {
  const tpl = getBuffaloTemplate(buffaloId);
  const lvlBonus = botLevel - 1;
  const botMaxHp = Math.round(tpl.baseStats.maxHp + lvlBonus * 16);
  const botAttack = Math.round(tpl.baseStats.attack + lvlBonus * 2.5);
  const botDefense = Math.round(tpl.baseStats.defense + lvlBonus * 2);
  const botKnockback = Math.round(tpl.baseStats.knockback + lvlBonus * 1.5);
  const powerRating = computePowerRating(botMaxHp, botAttack, botLevel);

  return {
    stageId,
    stageName,
    bpm,
    duration,
    arenaTheme,
    powerRating,
    botConfig: {
      buffaloId: tpl.id,
      name: tpl.name,
      spriteRow: tpl.spriteRow,
      visualScale: tpl.visualScale,
      bodyColor: tpl.bodyColor,
      accentColor: tpl.accentColor,
      rageSkillId: tpl.rageSkillId,
      botLevel,
      maxHp: botMaxHp,
      attack: botAttack,
      defense: botDefense,
      knockback: botKnockback,
      powerRating,
      ...aiOverrides,
    },
  };
}

export const TRAINING_STAGES = [
  createStage(1, 'Ải 1: Sân Đình Làng Đông', 110, 75, 'morning', 'buffalo_bach_tang', 1, {
    maxSpeed: 138,
    decisionBeats: 3,
    timingRates: { perfect: 0.10, good: 0.38, miss: 0.52 },
    counterRate: 0.12,
    skillWeights: { HUC: 0.55, LAO: 0.25, MOC: 0.10, NE: 0.10 },
    poiseMultiplier: 1.0,
    perfectBypassPoise: false,
    clashPushPerBeat: 6,
    telegraphBeats: 2,
    thunderStompEveryBeats: 0,
  }),
  createStage(2, 'Ải 2: Bãi Bồi Cửa Sông', 115, 75, 'morning', 'buffalo_hac_phong', 2, {
    maxSpeed: 148,
    decisionBeats: 2.5,
    timingRates: { perfect: 0.15, good: 0.42, miss: 0.43 },
    counterRate: 0.20,
    skillWeights: { HUC: 0.45, LAO: 0.30, MOC: 0.15, NE: 0.10 },
    poiseMultiplier: 0.96,
    perfectBypassPoise: false,
    clashPushPerBeat: 7,
    telegraphBeats: 2,
    thunderStompEveryBeats: 0,
  }),
  createStage(3, 'Ải 3: Đấu Trường Giáp Hạt', 118, 80, 'morning', 'buffalo_xich_hoa', 2, {
    maxSpeed: 158,
    decisionBeats: 2.5,
    timingRates: { perfect: 0.20, good: 0.45, miss: 0.35 },
    counterRate: 0.28,
    skillWeights: { HUC: 0.35, LAO: 0.30, MOC: 0.15, NE: 0.20 },
    poiseMultiplier: 0.92,
    perfectBypassPoise: false,
    clashPushPerBeat: 8,
    telegraphBeats: 1,
    thunderStompEveryBeats: 0,
  }),
  createStage(4, 'Ải 4: Bến Đò Đồ Sơn', 122, 80, 'sunset', 'buffalo_bach_tang', 3, {
    maxSpeed: 162,
    decisionBeats: 2,
    timingRates: { perfect: 0.24, good: 0.48, miss: 0.28 },
    counterRate: 0.35,
    skillWeights: { HUC: 0.30, LAO: 0.25, MOC: 0.20, NE: 0.25 },
    poiseMultiplier: 0.88,
    perfectBypassPoise: false,
    clashPushPerBeat: 9,
    telegraphBeats: 1,
    thunderStompEveryBeats: 0,
  }),
  createStage(5, 'Ải 5: Sới Hội Hải Lựu', 126, 80, 'sunset', 'buffalo_xich_hoa', 4, {
    maxSpeed: 174,
    decisionBeats: 2,
    timingRates: { perfect: 0.28, good: 0.48, miss: 0.24 },
    counterRate: 0.45,
    skillWeights: { HUC: 0.25, LAO: 0.28, MOC: 0.17, NE: 0.30 },
    poiseMultiplier: 0.85,
    perfectBypassPoise: false,
    clashPushPerBeat: 10,
    telegraphBeats: 1,
    thunderStompEveryBeats: 0,
  }),
  createStage(6, 'Ải 6: Bãi Triều Sóng Dữ', 130, 85, 'sunset', 'buffalo_hac_phong', 5, {
    maxSpeed: 180,
    decisionBeats: 2,
    timingRates: { perfect: 0.32, good: 0.48, miss: 0.20 },
    counterRate: 0.52,
    skillWeights: { HUC: 0.28, LAO: 0.26, MOC: 0.22, NE: 0.24 },
    poiseMultiplier: 0.80,
    perfectBypassPoise: false,
    clashPushPerBeat: 11,
    telegraphBeats: 1,
    thunderStompEveryBeats: 0,
  }),
  createStage(7, 'Ải 7: Đền Thiêng Trống Đồng', 134, 85, 'storm', 'buffalo_bach_tang', 6, {
    maxSpeed: 182,
    decisionBeats: 1.5,
    timingRates: { perfect: 0.38, good: 0.45, miss: 0.17 },
    counterRate: 0.60,
    skillWeights: { HUC: 0.25, LAO: 0.25, MOC: 0.25, NE: 0.25 },
    poiseMultiplier: 0.72,
    perfectBypassPoise: true,
    clashPushPerBeat: 11,
    telegraphBeats: 1,
    thunderStompEveryBeats: 0,
  }),
  createStage(8, 'Ải 8: Giông Bão Cửa Biển', 138, 90, 'storm', 'buffalo_xich_hoa', 7, {
    maxSpeed: 192,
    decisionBeats: 1.5,
    timingRates: { perfect: 0.42, good: 0.42, miss: 0.16 },
    counterRate: 0.68,
    skillWeights: { HUC: 0.20, LAO: 0.30, MOC: 0.20, NE: 0.30 },
    poiseMultiplier: 0.68,
    perfectBypassPoise: true,
    clashPushPerBeat: 12,
    telegraphBeats: 1,
    thunderStompEveryBeats: 7,
    thunderStompSpeed: 245,
    thunderStompDamage: 7,
    thunderStompKnockback: 260,
    thunderStompStun: 0.45,
  }),
  createStage(9, 'Ải 9: Lôi Đài Bách Thắng', 142, 90, 'storm', 'buffalo_than_nguu', 8, {
    maxSpeed: 196,
    decisionBeats: 1.5,
    timingRates: { perfect: 0.46, good: 0.40, miss: 0.14 },
    counterRate: 0.74,
    skillWeights: { HUC: 0.20, LAO: 0.25, MOC: 0.25, NE: 0.30 },
    poiseMultiplier: 0.62,
    perfectBypassPoise: true,
    clashPushPerBeat: 13,
    telegraphBeats: 1,
    thunderStompEveryBeats: 6,
    thunderStompSpeed: 260,
    thunderStompDamage: 8,
    thunderStompKnockback: 280,
    thunderStompStun: 0.50,
  }),
  createStage(10, 'Ải 10: Đại Lễ Vô Địch Thiên Hạ', 145, 95, 'storm', 'buffalo_than_nguu', 10, {
    maxSpeed: 205,
    decisionBeats: 1.25,
    timingRates: { perfect: 0.52, good: 0.36, miss: 0.12 },
    counterRate: 0.80,
    skillWeights: { HUC: 0.18, LAO: 0.27, MOC: 0.27, NE: 0.28 },
    poiseMultiplier: 0.58,
    perfectBypassPoise: true,
    clashPushPerBeat: 14,
    telegraphBeats: 1,
    thunderStompEveryBeats: 5,
    thunderStompSpeed: 275,
    thunderStompDamage: 9,
    thunderStompKnockback: 300,
    thunderStompStun: 0.55,
  }),
];
