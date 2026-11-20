import { GAME_CONFIG } from './config.js';

function removeWhiteBackground(canvas, threshold = 236) {
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;
  const imgData = ctx.getImageData(0, 0, w, h);
  const d = imgData.data;

  // Flood-fill from outer border so exterior white background is cleanly removed
  // without eating bright highlights inside the buffalo's coat or horns.
  const isNearWhite = (idx) => {
    const r = d[idx];
    const g = d[idx + 1];
    const b = d[idx + 2];
    const minC = Math.min(r, g, b);
    const maxC = Math.max(r, g, b);
    return minC >= threshold && maxC - minC < 26;
  };

  const visited = new Uint8Array(w * h);
  const queue = new Int32Array(w * h);
  let head = 0;
  let tail = 0;

  const pushIfWhite = (x, y) => {
    const p = y * w + x;
    if (visited[p]) return;
    if (isNearWhite(p * 4)) {
      visited[p] = 1;
      queue[tail++] = p;
    }
  };

  for (let x = 0; x < w; x++) {
    pushIfWhite(x, 0);
    pushIfWhite(x, h - 1);
  }
  for (let y = 0; y < h; y++) {
    pushIfWhite(0, y);
    pushIfWhite(w - 1, y);
  }

  while (head < tail) {
    const p = queue[head++];
    const px = p % w;
    const py = (p - px) / w;
    d[p * 4 + 3] = 0;

    if (px > 0) pushIfWhite(px - 1, py);
    if (px < w - 1) pushIfWhite(px + 1, py);
    if (py > 0) pushIfWhite(px, py - 1);
    if (py < h - 1) pushIfWhite(px, py + 1);
  }

  // Also clear pure isolated white pockets (e.g. between legs/horns) and feather fringe
  for (let i = 0; i < w * h; i++) {
    const idx = i * 4;
    if (d[idx + 3] === 0) continue;
    const r = d[idx];
    const g = d[idx + 1];
    const b = d[idx + 2];
    const minC = Math.min(r, g, b);
    const maxC = Math.max(r, g, b);
    if (minC >= 247 && maxC - minC < 12) {
      d[idx + 3] = 0;
    } else if (minC >= threshold - 12 && maxC - minC < 24) {
      // Soften 1px anti-aliased edge adjacent to transparent pixels
      const x = i % w;
      const y = (i - x) / w;
      const hasTransparentNeighbor =
        (x > 0 && d[(i - 1) * 4 + 3] === 0) ||
        (x < w - 1 && d[(i + 1) * 4 + 3] === 0) ||
        (y > 0 && d[(i - w) * 4 + 3] === 0) ||
        (y < h - 1 && d[(i + w) * 4 + 3] === 0);
      if (hasTransparentNeighbor) {
        const ratio = (255 - minC) / (255 - (threshold - 18));
        d[idx + 3] = Math.min(d[idx + 3], Math.max(0, Math.floor(ratio * 255)));
      }
    }
  }

  ctx.putImageData(imgData, 0, 0);
}

function sliceToCanvas(img, box, targetW, targetH, removeWhite = true) {
  const c = document.createElement('canvas');
  c.width = targetW;
  c.height = targetH;
  const ctx = c.getContext('2d');
  const pad = 4;
  const scale = Math.min((targetW - pad * 2) / box.w, (targetH - pad * 2) / box.h);
  const dw = box.w * scale;
  const dh = box.h * scale;
  const dx = (targetW - dw) / 2;
  const dy = (targetH - dh) / 2;
  ctx.drawImage(img, box.x, box.y, box.w, box.h, dx, dy, dw, dh);
  if (removeWhite) {
    removeWhiteBackground(c, 232);
  }
  return c;
}

const TRAU_LAYOUT = [
  // Row 0: Ông Cầu Hắc Phong (Col 0 pure top-down facing down)
  [
    { x: 428, y: 36, w: 258, h: 556, topDown: true, baseAngle: Math.PI / 2 },
    { x: 836, y: 110, w: 550, h: 410, topDown: false, baseAngle: 0 },
    { x: 1424, y: 102, w: 588, h: 402, topDown: false, baseAngle: 0 },
  ],
  // Row 1: Bạch Tạng Sơn Cước
  [
    { x: 342, y: 644, w: 486, h: 296, topDown: false, baseAngle: 0 },
    { x: 850, y: 628, w: 556, h: 330, topDown: false, baseAngle: 0 },
    { x: 1434, y: 624, w: 566, h: 340, topDown: false, baseAngle: 0 },
  ],
  // Row 2: Xích Hỏa Hải Long
  [
    { x: 338, y: 1050, w: 486, h: 408, topDown: false, baseAngle: 0 },
    { x: 852, y: 1080, w: 556, h: 354, topDown: false, baseAngle: 0 },
    { x: 1428, y: 1038, w: 582, h: 418, topDown: false, baseAngle: 0 },
  ],
  // Row 3: Thần Ngưu Lôi Đình (Col 0 pure top-down facing down)
  [
    { x: 344, y: 1516, w: 426, h: 502, topDown: true, baseAngle: Math.PI / 2 },
    { x: 846, y: 1536, w: 572, h: 436, topDown: false, baseAngle: 0 },
    { x: 1424, y: 1528, w: 592, h: 442, topDown: false, baseAngle: 0 },
  ],
];

const TOOL_LAYOUT = {
  drum: { x: 94, y: 66, w: 660, h: 594, size: 128 },
  flag: { x: 812, y: 72, w: 540, h: 598, size: 112 },
  sticks: { x: 1482, y: 94, w: 464, h: 570, size: 112 },
  horns: { x: 76, y: 852, w: 908, h: 456, size: 128 },
  mud1: { x: 1198, y: 856, w: 686, h: 446, size: 128 },
  mud2: { x: 132, y: 1446, w: 872, h: 430, size: 128 },
  palanquin: { x: 1176, y: 1304, w: 778, h: 588, size: 160 },
};

export class AssetLoader {
  constructor() {
    this.bgImage = null;
    this.hasBg = false;
    this.lobbyImage = null;
    this.hasLobby = false;
    this.hasTrau = false;
    this.hasTool = false;
    this.trauFrames = [];
    this.tools = {};
    this.ready = false;
  }

  loadImageWithFallback(paths) {
    return new Promise((resolve) => {
      let idx = 0;
      const tryNext = () => {
        if (idx >= paths.length) {
          resolve(null);
          return;
        }
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => {
          idx += 1;
          tryNext();
        };
        img.src = paths[idx];
      };
      tryNext();
    });
  }

  async loadAll() {
    const [bgImg, lobbyImg, trauImg, toolImg] = await Promise.all([
      this.loadImageWithFallback(['bg.png', 'assets/aistudio/bg_72a90888.png']),
      this.loadImageWithFallback(['assets/aistudio/wait_91ecae59.png', 'wait.png']),
      this.loadImageWithFallback(['assets/trau.png', 'assets/aistudio/trau_dbef4866.png']),
      this.loadImageWithFallback(['assets/tool.png', 'assets/aistudio/tool_293ae6e5.png']),
    ]);

    if (bgImg && bgImg.naturalWidth > 0) {
      this.bgImage = bgImg;
      this.hasBg = true;
    }

    if (lobbyImg && lobbyImg.naturalWidth > 0) {
      this.lobbyImage = lobbyImg;
      this.hasLobby = true;
    }

    if (trauImg && trauImg.naturalWidth >= 1024) {
      this.trauFrames = TRAU_LAYOUT.map((row) =>
        row.map((box) => ({
          canvas: sliceToCanvas(
            trauImg,
            box,
            GAME_CONFIG.SPRITE_SIZE,
            GAME_CONFIG.SPRITE_SIZE,
            true
          ),
          topDown: box.topDown,
          baseAngle: box.baseAngle,
        }))
      );
      this.hasTrau = true;
    }

    if (toolImg && toolImg.naturalWidth >= 1024) {
      for (const [key, box] of Object.entries(TOOL_LAYOUT)) {
        this.tools[key] = sliceToCanvas(toolImg, box, box.size, box.size, true);
      }
      this.hasTool = true;
    }

    this.ready = true;
  }

  getBuffaloFrame(rowIndex, poseIndex) {
    if (!this.hasTrau) return null;
    const row = this.trauFrames[rowIndex];
    if (!row) return null;
    return row[poseIndex] || row[0];
  }

  drawFiveColorFlag(ctx, x, y, scale, time, phaseOffset = 0) {
    ctx.save();
    ctx.translate(x, y);
    const sway = Math.sin(time * 4.5 + phaseOffset) * 0.14;
    ctx.rotate(sway);
    ctx.scale(scale, scale);

    if (this.hasTool && this.tools.flag) {
      ctx.drawImage(this.tools.flag, -28, -42, 56, 56);
    } else {
      // Procedural vector Five-Color Festival Flag (Cờ Ngũ Sắc)
      ctx.strokeStyle = '#d9b468';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(0, 14);
      ctx.lineTo(0, -34);
      ctx.stroke();

      const wave = Math.sin(time * 6 + phaseOffset) * 3;
      const colors = ['#dc2626', '#16a34a', '#facc15', '#2563eb', '#f8fafc'];
      const sizes = [28, 22, 16, 11, 6];
      for (let i = 0; i < colors.length; i++) {
        const s = sizes[i];
        const off = (28 - s) * 0.5;
        ctx.fillStyle = colors[i];
        ctx.beginPath();
        ctx.moveTo(2 + off, -32 + off);
        ctx.quadraticCurveTo(2 + off + s * 0.5, -32 + off + wave, 2 + off + s, -32 + off);
        ctx.lineTo(2 + off + s, -32 + off + s);
        ctx.quadraticCurveTo(
          2 + off + s * 0.5,
          -32 + off + s + wave,
          2 + off,
          -32 + off + s
        );
        ctx.closePath();
        ctx.fill();
      }
    }
    ctx.restore();
  }

  drawArena(ctx, time, beatPulse, roundConfig, warningIntensity, hoofMarks) {
    const W = GAME_CONFIG.CANVAS_WIDTH;
    const H = GAME_CONFIG.CANVAS_HEIGHT;
    const cx = GAME_CONFIG.ARENA_CENTER_X;
    const cy = GAME_CONFIG.ARENA_CENTER_Y;
    const R = GAME_CONFIG.ARENA_RADIUS;

    // Seamless overscan outer backdrop so camera shake / zoom never exposes empty canvas borders
    ctx.fillStyle =
      roundConfig.arenaTheme === 'storm'
        ? '#0d0f1a'
        : roundConfig.arenaTheme === 'sunset'
          ? '#240f0a'
          : '#21140d';
    ctx.fillRect(-320, -320, W + 640, H + 640);

    if (this.hasBg && this.bgImage) {
      // Draw bg.png filling 1280x720
      ctx.drawImage(this.bgImage, 0, 0, W, H);

      // Round atmosphere tint (morning / sunset / storm)
      if (roundConfig.arenaTheme === 'sunset') {
        ctx.fillStyle = 'rgba(180, 48, 12, 0.16)';
        ctx.fillRect(0, 0, W, H);
      } else if (roundConfig.arenaTheme === 'storm') {
        ctx.fillStyle = 'rgba(12, 18, 46, 0.34)';
        ctx.fillRect(0, 0, W, H);
      }
    } else {
      // Complete Procedural Vector Fallback Arena
      this.drawProceduralArenaBase(ctx, W, H, cx, cy, R, time, beatPulse, roundConfig);
    }

    // Hoof marks & mud scuffs inside the arena floor
    if (hoofMarks && hoofMarks.length > 0) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, R - 2, 0, Math.PI * 2);
      ctx.clip();
      for (const m of hoofMarks) {
        ctx.fillStyle = `rgba(54, 34, 20, ${m.alpha * 0.42})`;
        ctx.beginPath();
        ctx.ellipse(m.x, m.y, m.r * 1.3, m.r * 0.75, m.angle, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    // Crisp logic-accurate White Chalk Boundary Ring (ARENA_RADIUS = 320px)
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 252, 240, 0.88)';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.stroke();

    // Inner safe zone subtle dotted ring (0.70R = 224px)
    ctx.strokeStyle = 'rgba(245, 184, 46, 0.16)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([8, 10]);
    ctx.beginPath();
    ctx.arc(cx, cy, R * GAME_CONFIG.BALANCE_SAFE_RATIO, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    // Beat Pulse glow around the white ring
    if (beatPulse > 0.02) {
      ctx.strokeStyle =
        roundConfig.arenaTheme === 'storm'
          ? `rgba(56, 189, 248, ${beatPulse * 0.48})`
          : `rgba(245, 184, 46, ${beatPulse * 0.45})`;
      ctx.lineWidth = 8 + beatPulse * 10;
      ctx.beginPath();
      ctx.arc(cx, cy, R + 2, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Red Ring-Out Warning Glow when a buffalo is near the edge (>= 0.75R)
    if (warningIntensity > 0) {
      const pulse = 0.45 + 0.55 * Math.abs(Math.sin(time * 12));
      ctx.strokeStyle = `rgba(239, 68, 68, ${warningIntensity * pulse * 0.88})`;
      ctx.lineWidth = 12;
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();

    // Animated waving 5-color festival flags around outer stand
    const flagPositions = [
      { x: 245, y: 120 },
      { x: 1035, y: 120 },
      { x: 210, y: 585 },
      { x: 1070, y: 585 },
    ];
    for (let i = 0; i < flagPositions.length; i++) {
      const fp = flagPositions[i];
      this.drawFiveColorFlag(ctx, fp.x, fp.y, 0.75 + beatPulse * 0.06, time, i * 1.4);
    }

    // Pulsing festival drums around the outer stand when using procedural fallback or overlay
    const drumPositions = [
      { x: 300, y: 205 },
      { x: 980, y: 205 },
      { x: 300, y: 515 },
      { x: 980, y: 515 },
    ];
    for (const dp of drumPositions) {
      if (beatPulse > 0.1) {
        ctx.save();
        ctx.strokeStyle = `rgba(253, 224, 71, ${beatPulse * 0.55})`;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(dp.x, dp.y, 26 + (1 - beatPulse) * 32, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
    }
  }

  drawProceduralArenaBase(ctx, W, H, cx, cy, R, time, beatPulse, roundConfig) {
    // Outer stand dark earth
    const bgGrad = ctx.createRadialGradient(cx, cy, R * 0.5, cx, cy, W * 0.65);
    if (roundConfig.arenaTheme === 'morning') {
      bgGrad.addColorStop(0, '#6a7a3a');
      bgGrad.addColorStop(0.55, '#59422b');
      bgGrad.addColorStop(1, '#261710');
    } else if (roundConfig.arenaTheme === 'sunset') {
      bgGrad.addColorStop(0, '#7c5f32');
      bgGrad.addColorStop(0.55, '#662b1c');
      bgGrad.addColorStop(1, '#240f0a');
    } else {
      bgGrad.addColorStop(0, '#3a4a3f');
      bgGrad.addColorStop(0.55, '#25263a');
      bgGrad.addColorStop(1, '#0d0f1a');
    }
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, W, H);

    // Arena mud-grass floor circle
    const floorGrad = ctx.createRadialGradient(cx, cy, 30, cx, cy, R + 18);
    floorGrad.addColorStop(0, '#7d8c45');
    floorGrad.addColorStop(0.65, '#696935');
    floorGrad.addColorStop(1, '#58442a');
    ctx.fillStyle = floorGrad;
    ctx.beginPath();
    ctx.arc(cx, cy, R + 18, 0, Math.PI * 2);
    ctx.fill();

    // Dong Son Bronze Drum sun motif in the center
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(time * 0.04);
    ctx.strokeStyle = `rgba(245, 184, 46, ${0.22 + beatPulse * 0.25})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, 128, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, 90, 0, Math.PI * 2);
    ctx.stroke();

    // 12-point Lac star
    ctx.beginPath();
    for (let i = 0; i < 24; i++) {
      const a = (i * Math.PI) / 12;
      const rad = i % 2 === 0 ? 78 : 36;
      const px = Math.cos(a) * rad;
      const py = Math.sin(a) * rad;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.stroke();
    ctx.restore();

    // Outer bamboo fence & red cloth drapes
    ctx.save();
    ctx.strokeStyle = '#8b6939';
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.arc(cx, cy, R + 32, 0, Math.PI * 2);
    ctx.stroke();

    for (let i = 0; i < 24; i++) {
      const a = (i * Math.PI * 2) / 24;
      const px = cx + Math.cos(a) * (R + 32);
      const py = cy + Math.sin(a) * (R + 32);
      ctx.fillStyle = '#b91c1c';
      ctx.beginPath();
      ctx.arc(px, py, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#d9b468';
      ctx.beginPath();
      ctx.arc(px, py, 4, 0, Math.PI * 2);
      ctx.fill();
    }

    // 8 Festival Drums around stand
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI * 2) / 8 + Math.PI / 8;
      const dx = cx + Math.cos(a) * (R + 78);
      const dy = cy + Math.sin(a) * (R + 78);
      const scale = 1 + beatPulse * 0.14;
      ctx.save();
      ctx.translate(dx, dy);
      ctx.scale(scale, scale);
      if (this.hasTool && this.tools.drum) {
        ctx.drawImage(this.tools.drum, -26, -26, 52, 52);
      } else {
        ctx.fillStyle = '#991b1b';
        ctx.beginPath();
        ctx.arc(0, 0, 22, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#fde68a';
        ctx.beginPath();
        ctx.arc(0, 0, 15, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#f5b82e';
        ctx.lineWidth = 2;
        ctx.stroke();
      }
      ctx.restore();
    }
    ctx.restore();
  }
}
