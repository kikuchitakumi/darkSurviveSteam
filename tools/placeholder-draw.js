// =============================================================
// placeholder-draw.js  【ツール：仮画像の描画（ブラウザ内で実行）】
// -------------------------------------------------------------
// generate-placeholders.ts から Edge(ヘッドレス) に読み込まれ、
// Canvas で仮画像を描いて PNG(dataURL) を返す。
// 画像には「何に使う画像か」「ファイル名」を文字で書き込む。
// 本番の絵ができたら、同じファイル名で上書きするだけで差し替わる。
// =============================================================
/* eslint-disable */
(function () {
  // ---------------- 乱数（id から毎回同じ絵になるように） ----------------
  function hash(s) {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  function rng(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const FONT = '"Yu Gothic UI", "Meiryo", sans-serif';
  const EMOJI = '"Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif';

  // ---------------- 共通：用途ラベル ----------------
  function labelPlate(ctx, w, h, lines, pos) {
    const size = Math.max(11, Math.min(26, Math.round(w / 22)));
    ctx.save();
    ctx.font = `bold ${size}px ${FONT}`;
    const lw = Math.min(w - 8, Math.max(...lines.map((l) => ctx.measureText(l).width)) + 20);
    const lh = size * 1.3;
    const bh = lh * lines.length + 10;
    let x = (w - lw) / 2;
    let y = h - bh - 4;
    if (pos === 'top-left') { x = 24; y = 100; }
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.strokeStyle = 'rgba(255,220,150,0.6)';
    ctx.lineWidth = 1;
    ctx.fillRect(x, y, lw, bh);
    ctx.strokeRect(x + 0.5, y + 0.5, lw - 1, bh - 1);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    lines.forEach((l, i) => {
      ctx.fillStyle = i === 0 ? '#ffe9b8' : '#c9b8a0';
      ctx.font = `${i === 0 ? 'bold ' : ''}${i === 0 ? size : Math.round(size * 0.8)}px ${FONT}`;
      ctx.fillText(l, x + lw / 2, y + 5 + i * lh, lw - 10);
    });
    ctx.restore();
  }

  function emoji(ctx, ch, x, y, size, glow) {
    ctx.save();
    ctx.font = `${size}px ${EMOJI}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    if (glow) { ctx.shadowColor = glow; ctx.shadowBlur = size * 0.3; }
    ctx.fillText(ch, x, y);
    ctx.restore();
  }

  // ---------------- 背景 ----------------
  const THEMES = {
    tower1: { top: '#1a1512', bottom: '#050404', stone: [52, 44, 38], light: 'rgba(255,150,60,0.35)', fog: 'rgba(40,50,40,0.25)' },
    tower2: { top: '#121a1a', bottom: '#030505', stone: [40, 52, 52], light: 'rgba(120,255,200,0.22)', fog: 'rgba(60,90,80,0.25)' },
    tower3: { top: '#1a0f14', bottom: '#050203', stone: [56, 40, 46], light: 'rgba(255,60,60,0.3)', fog: 'rgba(80,30,40,0.25)' },
    tower4: { top: '#1c140c', bottom: '#060402', stone: [60, 46, 32], light: 'rgba(255,120,30,0.4)', fog: 'rgba(90,60,30,0.3)' },
    tower5: { top: '#0f0a18', bottom: '#030206', stone: [40, 32, 56], light: 'rgba(170,80,255,0.3)', fog: 'rgba(60,30,90,0.3)' },
    entrance: { top: '#171310', bottom: '#040303', stone: [58, 50, 42], light: 'rgba(255,170,90,0.35)', fog: 'rgba(50,50,50,0.2)' },
    treasure: { top: '#1a150a', bottom: '#050402', stone: [64, 54, 34], light: 'rgba(255,210,90,0.4)', fog: 'rgba(80,70,30,0.2)' },
    shop: { top: '#1d140c', bottom: '#060402', stone: [62, 48, 34], light: 'rgba(255,180,80,0.5)', fog: 'rgba(60,40,20,0.2)' },
    darkshop: { top: '#120a1a', bottom: '#040206', stone: [44, 32, 58], light: 'rgba(170,90,255,0.45)', fog: 'rgba(70,30,100,0.3)' },
    event: { top: '#14110f', bottom: '#040303', stone: [50, 44, 40], light: 'rgba(255,230,160,0.3)', fog: 'rgba(60,60,60,0.25)' },
    roll: { top: '#120808', bottom: '#020101', stone: [46, 30, 30], light: 'rgba(200,30,30,0.35)', fog: 'rgba(80,10,10,0.3)' },
    gameover: { top: '#1a0202', bottom: '#000000', stone: [50, 16, 16], light: 'rgba(160,0,0,0.5)', fog: 'rgba(90,0,0,0.35)' },
    clear: { top: '#3a2a20', bottom: '#0c0806', stone: [90, 76, 64], light: 'rgba(255,220,160,0.6)', fog: 'rgba(255,200,150,0.15)' },
  };

  function drawStoneWall(ctx, w, h, theme, r, horizon) {
    const [sr, sg, sb] = theme.stone;
    const bh = 54;
    for (let y = 0; y < horizon; y += bh) {
      const off = (Math.floor(y / bh) % 2) * 60;
      for (let x = -off; x < w; x += 120) {
        const v = 0.6 + r() * 0.5;
        const depth = 0.35 + 0.65 * (y / horizon);
        ctx.fillStyle = `rgb(${Math.round(sr * v * depth)},${Math.round(sg * v * depth)},${Math.round(sb * v * depth)})`;
        ctx.fillRect(x + 2, y + 2, 116, bh - 4);
      }
    }
  }

  function drawBackground(ctx, w, h, spec) {
    const theme = THEMES[spec.theme] || THEMES.tower1;
    const r = rng(hash(spec.path));
    const horizon = h * 0.68;
    // ベースのグラデーション
    let g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, theme.top);
    g.addColorStop(1, theme.bottom);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    if (spec.theme === 'title' || spec.theme === 'clear') {
      drawTitleScene(ctx, w, h, spec, r);
    } else {
      drawStoneWall(ctx, w, h, theme, r, horizon);
      // アーチと柱
      ctx.fillStyle = 'rgba(0,0,0,0.75)';
      const arches = spec.kind === 'battle' ? 2 : 3;
      for (let i = 0; i < arches; i++) {
        const cx = w * ((i + 0.5) / arches);
        const aw = w / arches * 0.42;
        const top = horizon * 0.25;
        ctx.beginPath();
        ctx.moveTo(cx - aw / 2, horizon);
        ctx.lineTo(cx - aw / 2, top + aw / 2);
        ctx.arc(cx, top + aw / 2, aw / 2, Math.PI, 0);
        ctx.lineTo(cx + aw / 2, horizon);
        ctx.closePath();
        const ag = ctx.createLinearGradient(0, top, 0, horizon);
        ag.addColorStop(0, 'rgba(0,0,0,0.95)');
        ag.addColorStop(1, 'rgba(10,8,8,0.8)');
        ctx.fillStyle = ag;
        ctx.fill();
        ctx.strokeStyle = 'rgba(120,100,80,0.25)';
        ctx.lineWidth = 6;
        ctx.stroke();
      }
      for (let i = 0; i <= arches; i++) {
        const px = w * (i / arches);
        const pg = ctx.createLinearGradient(px - 60, 0, px + 60, 0);
        pg.addColorStop(0, 'rgba(0,0,0,0.9)');
        pg.addColorStop(0.5, `rgba(${theme.stone.join(',')},1)`);
        pg.addColorStop(1, 'rgba(0,0,0,0.9)');
        ctx.fillStyle = pg;
        ctx.fillRect(px - 60, 0, 120, horizon);
      }
      // 床（遠近）
      g = ctx.createLinearGradient(0, horizon, 0, h);
      g.addColorStop(0, `rgb(${theme.stone.map((c) => Math.round(c * 0.5)).join(',')})`);
      g.addColorStop(1, '#030202');
      ctx.fillStyle = g;
      ctx.fillRect(0, horizon, w, h - horizon);
      ctx.strokeStyle = 'rgba(0,0,0,0.5)';
      ctx.lineWidth = 3;
      for (let i = -10; i <= 10; i++) {
        ctx.beginPath();
        ctx.moveTo(w / 2 + i * 60, horizon);
        ctx.lineTo(w / 2 + i * 420, h);
        ctx.stroke();
      }
      for (let k = 1; k < 7; k++) {
        const y = horizon + (h - horizon) * Math.pow(k / 7, 1.6);
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
      }
      // 血痕
      for (let i = 0; i < 4; i++) {
        const bx = r() * w, by = horizon + r() * (h - horizon) * 0.9;
        const bg = ctx.createRadialGradient(bx, by, 0, bx, by, 60 + r() * 120);
        bg.addColorStop(0, 'rgba(90,0,0,0.55)');
        bg.addColorStop(1, 'rgba(60,0,0,0)');
        ctx.fillStyle = bg;
        ctx.beginPath(); ctx.ellipse(bx, by, 140, 40, 0, 0, Math.PI * 2); ctx.fill();
      }
      // 光源（松明など）
      const lights = spec.theme === 'shop' || spec.theme === 'darkshop' ? [[w * 0.2, h * 0.35]] : [[w * 0.12, h * 0.3], [w * 0.88, h * 0.3]];
      for (const [lx, ly] of lights) {
        const lg = ctx.createRadialGradient(lx, ly, 0, lx, ly, 520);
        lg.addColorStop(0, theme.light);
        lg.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = lg;
        ctx.fillRect(0, 0, w, h);
        emoji(ctx, spec.theme === 'darkshop' ? '🕯️' : '🔥', lx, ly, 70, 'rgba(255,150,50,0.9)');
      }
      if (spec.theme === 'treasure') {
        for (let i = 0; i < 40; i++) {
          ctx.fillStyle = `rgba(255,${200 + r() * 55},${80 + r() * 60},${0.4 + r() * 0.5})`;
          ctx.beginPath(); ctx.arc(r() * w, horizon + r() * 160, 4 + r() * 10, 0, Math.PI * 2); ctx.fill();
        }
      }
    }
    // 霧
    g = ctx.createLinearGradient(0, h * 0.5, 0, h);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, theme.fog);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    // 周辺減光
    const vg = ctx.createRadialGradient(w / 2, h * 0.45, h * 0.3, w / 2, h * 0.45, w * 0.7);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, 'rgba(0,0,0,0.75)');
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, w, h);
  }

  function drawTitleScene(ctx, w, h, spec, r) {
    const clear = spec.theme === 'clear';
    let g = ctx.createLinearGradient(0, 0, 0, h);
    if (clear) { g.addColorStop(0, '#2a3a5a'); g.addColorStop(0.55, '#e0a070'); g.addColorStop(1, '#3a2010'); }
    else { g.addColorStop(0, '#050206'); g.addColorStop(0.5, '#2a0606'); g.addColorStop(1, '#0a0202'); }
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    // 月 / 朝日
    const mx = clear ? w * 0.5 : w * 0.72, my = clear ? h * 0.62 : h * 0.24;
    const mg = ctx.createRadialGradient(mx, my, 0, mx, my, 360);
    mg.addColorStop(0, clear ? 'rgba(255,240,200,1)' : 'rgba(255,200,190,0.95)');
    mg.addColorStop(0.25, clear ? 'rgba(255,200,120,0.6)' : 'rgba(200,40,40,0.5)');
    mg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = mg;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = clear ? '#fff4d8' : '#e8c8c0';
    ctx.beginPath(); ctx.arc(mx, my, 90, 0, Math.PI * 2); ctx.fill();
    // 雲
    for (let i = 0; i < 18; i++) {
      ctx.fillStyle = clear ? `rgba(255,220,200,${0.05 + r() * 0.08})` : `rgba(0,0,0,${0.2 + r() * 0.3})`;
      ctx.beginPath(); ctx.ellipse(r() * w, r() * h * 0.5, 200 + r() * 300, 30 + r() * 40, 0, 0, Math.PI * 2); ctx.fill();
    }
    // 塔のシルエット
    const tx = w * 0.5;
    ctx.fillStyle = clear ? '#1a120c' : '#000';
    ctx.beginPath();
    ctx.moveTo(tx - 170, h);
    ctx.lineTo(tx - 120, h * 0.25);
    ctx.lineTo(tx - 140, h * 0.22);
    ctx.lineTo(tx - 60, h * 0.1);
    ctx.lineTo(tx, -20);
    ctx.lineTo(tx + 60, h * 0.1);
    ctx.lineTo(tx + 140, h * 0.22);
    ctx.lineTo(tx + 120, h * 0.25);
    ctx.lineTo(tx + 170, h);
    ctx.closePath();
    ctx.fill();
    // 窓の灯り
    for (let i = 0; i < 26; i++) {
      const wy = h * 0.2 + r() * h * 0.75;
      const span = 90 + (wy / h) * 60;
      const wx = tx + (r() - 0.5) * span * 1.6;
      ctx.fillStyle = r() < 0.7 ? 'rgba(255,170,80,0.85)' : 'rgba(255,60,40,0.9)';
      ctx.shadowColor = '#f60'; ctx.shadowBlur = 12;
      ctx.fillRect(wx, wy, 7, 14);
    }
    ctx.shadowBlur = 0;
    // 地面・枯れ木
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.moveTo(0, h);
    for (let x = 0; x <= w; x += 40) ctx.lineTo(x, h * 0.88 + Math.sin(x * 0.01) * 18 + r() * 10);
    ctx.lineTo(w, h);
    ctx.fill();
    ctx.strokeStyle = '#000'; ctx.lineCap = 'round';
    for (const bx of [w * 0.12, w * 0.85]) {
      const tree = (x, y, len, ang, wdt) => {
        if (len < 12) return;
        const x2 = x + Math.cos(ang) * len, y2 = y + Math.sin(ang) * len;
        ctx.lineWidth = wdt; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x2, y2); ctx.stroke();
        tree(x2, y2, len * 0.72, ang - 0.4 - r() * 0.3, wdt * 0.7);
        tree(x2, y2, len * 0.68, ang + 0.35 + r() * 0.3, wdt * 0.7);
      };
      tree(bx, h * 0.92, 150, -Math.PI / 2, 22);
    }
  }

  // ---------------- 敵 ----------------
  function drawEnemy(ctx, w, h, spec) {
    const r = rng(hash(spec.id));
    const palette = [
      ['#4a3a30', '#1a120e', '#ff3030'],
      ['#3a4a44', '#0e1a16', '#9cff6b'],
      ['#4a3040', '#1a0e14', '#ff4060'],
      ['#4a3a24', '#1a120a', '#ffa020'],
      ['#3a3050', '#120e1a', '#c070ff'],
    ][(spec.zone || 1) - 1];
    const [c1, c2, eyeC] = palette;
    const cx = w / 2, base = h * 0.92;
    const big = spec.kind === 'boss' ? 1.15 : spec.kind === 'elite' ? 1.05 : 1;
    const bodyW = w * (0.28 + r() * 0.12) * big;
    const bodyH = h * (0.42 + r() * 0.15) * big;
    const by = base - bodyH * 0.55;

    ctx.save();
    // 触手・腕
    const limbs = 2 + Math.floor(r() * 4) + (spec.kind === 'boss' ? 3 : 0);
    for (let i = 0; i < limbs; i++) {
      const side = i % 2 ? 1 : -1;
      const sx = cx + side * bodyW * 0.5;
      const sy = by - bodyH * (0.1 + r() * 0.4);
      const ex = cx + side * (bodyW * 0.9 + r() * w * 0.2);
      const ey = base - r() * h * 0.2;
      ctx.strokeStyle = c2;
      ctx.lineWidth = 10 + r() * 16;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.bezierCurveTo(sx + side * 80, sy - 80 - r() * 60, ex - side * 40, ey - 120, ex, ey);
      ctx.stroke();
      // 爪
      ctx.fillStyle = '#d8ccb0';
      for (let k = 0; k < 3; k++) {
        ctx.beginPath();
        ctx.moveTo(ex, ey);
        ctx.lineTo(ex + side * (10 + k * 8), ey + 18 + k * 4);
        ctx.lineTo(ex + side * (4 + k * 8), ey + 6);
        ctx.fill();
      }
    }
    // 胴体（ゆがんだ塊）
    const g = ctx.createRadialGradient(cx - bodyW * 0.2, by - bodyH * 0.3, 10, cx, by, bodyW);
    g.addColorStop(0, c1);
    g.addColorStop(1, c2);
    ctx.fillStyle = g;
    ctx.beginPath();
    const pts = 24;
    for (let i = 0; i <= pts; i++) {
      const a = (i / pts) * Math.PI * 2;
      const rr = 1 + (r() - 0.5) * 0.25;
      const x = cx + Math.cos(a) * bodyW * 0.55 * rr;
      const y = by + Math.sin(a) * bodyH * 0.55 * rr;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,120,100,0.25)';
    ctx.lineWidth = 3;
    ctx.stroke();
    // トゲ・角
    if (spec.kind !== 'normal') {
      ctx.fillStyle = '#c8bca0';
      const n = spec.kind === 'boss' ? 7 : 4;
      for (let i = 0; i < n; i++) {
        const a = -Math.PI * (0.15 + 0.7 * (i / (n - 1)));
        const x = cx + Math.cos(a) * bodyW * 0.5, y = by + Math.sin(a) * bodyH * 0.5;
        ctx.beginPath();
        ctx.moveTo(x - 12, y);
        ctx.lineTo(x + Math.cos(a) * 70, y + Math.sin(a) * 90);
        ctx.lineTo(x + 12, y);
        ctx.fill();
      }
    }
    // 目
    const eyes = spec.kind === 'boss' ? 3 + Math.floor(r() * 5) : 1 + Math.floor(r() * 3);
    for (let i = 0; i < eyes; i++) {
      const ex = cx + (r() - 0.5) * bodyW * 0.7;
      const ey = by - bodyH * (0.05 + r() * 0.3);
      const er = 8 + r() * 14 * big;
      ctx.shadowColor = eyeC;
      ctx.shadowBlur = 30;
      ctx.fillStyle = eyeC;
      ctx.beginPath(); ctx.ellipse(ex, ey, er, er * 0.7, 0, 0, Math.PI * 2); ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#000';
      ctx.beginPath(); ctx.ellipse(ex, ey, er * 0.25, er * 0.6, 0, 0, Math.PI * 2); ctx.fill();
    }
    // 口（牙）
    const mw = bodyW * (0.3 + r() * 0.3);
    const my = by + bodyH * 0.12;
    ctx.fillStyle = '#1a0000';
    ctx.beginPath(); ctx.ellipse(cx, my, mw / 2, 24 * big, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#e8dcc0';
    const teeth = 6 + Math.floor(r() * 6);
    for (let i = 0; i < teeth; i++) {
      const tx = cx - mw / 2 + (mw / teeth) * (i + 0.5);
      ctx.beginPath(); ctx.moveTo(tx - 6, my - 18 * big); ctx.lineTo(tx, my + 4); ctx.lineTo(tx + 6, my - 18 * big); ctx.fill();
    }
    // 血のしずく
    ctx.fillStyle = 'rgba(140,0,0,0.85)';
    for (let i = 0; i < 5; i++) {
      const dx = cx + (r() - 0.5) * mw;
      ctx.beginPath(); ctx.ellipse(dx, my + 20 + r() * 40, 4, 10 + r() * 10, 0, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
    labelPlate(ctx, w, h, [spec.title, spec.file], 'bottom');
  }

  // ---------------- 扉 ----------------
  function drawDoor(ctx, w, h, spec) {
    const glow = { battle: '#ff6040', elite: '#ff9020', event: '#a0c0ff', shop: '#ffd070', boss: '#ff0000', hidden: '#ffe080', '1f': '#ffb060' }[spec.variant] || '#ff8040';
    const dx = w * 0.12, dy = h * 0.14, dw = w * 0.76, dh = h * 0.84;
    // 光漏れ
    const lg = ctx.createRadialGradient(w / 2, h * 0.6, 10, w / 2, h * 0.6, w * 0.7);
    lg.addColorStop(0, glow + '55');
    lg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = lg;
    ctx.fillRect(0, 0, w, h);
    // 石枠
    ctx.fillStyle = '#3a332c';
    ctx.beginPath();
    ctx.moveTo(dx - 20, h);
    ctx.lineTo(dx - 20, dy + dw / 2);
    ctx.arc(w / 2, dy + dw / 2, dw / 2 + 20, Math.PI, 0);
    ctx.lineTo(dx + dw + 20, h);
    ctx.closePath();
    ctx.fill();
    // 扉本体（木）
    const wg = ctx.createLinearGradient(dx, 0, dx + dw, 0);
    wg.addColorStop(0, '#2a1a10'); wg.addColorStop(0.5, '#4a3020'); wg.addColorStop(1, '#2a1a10');
    ctx.fillStyle = wg;
    ctx.beginPath();
    ctx.moveTo(dx, h);
    ctx.lineTo(dx, dy + dw / 2);
    ctx.arc(w / 2, dy + dw / 2, dw / 2, Math.PI, 0);
    ctx.lineTo(dx + dw, h);
    ctx.closePath();
    ctx.fill();
    ctx.save();
    ctx.clip();
    ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 3;
    for (let x = dx; x < dx + dw; x += dw / 6) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
    ctx.fillStyle = '#1a1a1a';
    for (const y of [h * 0.45, h * 0.8]) ctx.fillRect(dx, y, dw, 18);
    // 隙間の光
    ctx.fillStyle = glow;
    ctx.shadowColor = glow; ctx.shadowBlur = 30;
    ctx.fillRect(w / 2 - 2, dy + 30, 4, h);
    ctx.restore();
    // 取っ手
    ctx.strokeStyle = '#8a7a60'; ctx.lineWidth = 6;
    ctx.beginPath(); ctx.arc(w / 2 + dw * 0.25, h * 0.62, 16, 0, Math.PI * 2); ctx.stroke();
    // 看板（記号）
    if (spec.symbol) {
      ctx.fillStyle = 'rgba(0,0,0,0.75)';
      ctx.beginPath(); ctx.arc(w / 2, dy + dw * 0.35, w * 0.17, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = glow; ctx.lineWidth = 4; ctx.stroke();
      emoji(ctx, spec.symbol, w / 2, dy + dw * 0.35, w * 0.17, glow);
    }
    labelPlate(ctx, w, h, [spec.title, spec.file], 'bottom');
  }

  // ---------------- 宝箱 ----------------
  function drawChest(ctx, w, h, spec) {
    const col = { red: ['#b02020', '#5a0a0a'], blue: ['#2050c0', '#0a1a5a'], yellow: ['#d0a020', '#6a4a08'], green: ['#20a050', '#0a4a20'] }[spec.variant];
    const x = w * 0.1, y = h * 0.35, cw = w * 0.8, ch = h * 0.45;
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.beginPath(); ctx.ellipse(w / 2, y + ch + 10, cw * 0.55, 18, 0, 0, Math.PI * 2); ctx.fill();
    let g = ctx.createLinearGradient(0, y, 0, y + ch);
    g.addColorStop(0, col[0]); g.addColorStop(1, col[1]);
    ctx.fillStyle = g; ctx.fillRect(x, y, cw, ch);
    // ふた
    g = ctx.createLinearGradient(0, h * 0.12, 0, y);
    g.addColorStop(0, col[0]); g.addColorStop(1, col[1]);
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, h * 0.25); ctx.quadraticCurveTo(w / 2, h * 0.02, x + cw, h * 0.25); ctx.lineTo(x + cw, y); ctx.closePath(); ctx.fill();
    // 金具
    ctx.fillStyle = '#c8a860';
    for (const bx of [x + cw * 0.15, x + cw * 0.85 - 18]) ctx.fillRect(bx, h * 0.14, 18, ch + y - h * 0.14);
    ctx.fillRect(x, y - 6, cw, 12);
    ctx.fillStyle = '#e8d090';
    ctx.fillRect(w / 2 - 22, y - 16, 44, 50);
    ctx.fillStyle = '#000';
    ctx.beginPath(); ctx.arc(w / 2, y + 4, 6, 0, Math.PI * 2); ctx.fill();
    ctx.fillRect(w / 2 - 3, y + 4, 6, 16);
    labelPlate(ctx, w, h, [spec.title, spec.file], 'bottom');
  }

  // ---------------- 人物・オブジェクト ----------------
  function drawFigure(ctx, w, h, spec) {
    const dark = spec.variant === 'dark';
    // フードの人物
    const g = ctx.createLinearGradient(0, h * 0.1, 0, h);
    g.addColorStop(0, dark ? '#2a1a3a' : '#3a2a20');
    g.addColorStop(1, dark ? '#08040c' : '#0c0806');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(w * 0.5, h * 0.08);
    ctx.quadraticCurveTo(w * 0.82, h * 0.12, w * 0.75, h * 0.35);
    ctx.lineTo(w * 0.95, h);
    ctx.lineTo(w * 0.05, h);
    ctx.lineTo(w * 0.25, h * 0.35);
    ctx.quadraticCurveTo(w * 0.18, h * 0.12, w * 0.5, h * 0.08);
    ctx.fill();
    // 顔の闇
    ctx.fillStyle = '#000';
    ctx.beginPath(); ctx.ellipse(w * 0.5, h * 0.24, w * 0.13, h * 0.08, 0, 0, Math.PI * 2); ctx.fill();
    // 目
    const ec = dark ? '#c070ff' : '#ffcc66';
    ctx.shadowColor = ec; ctx.shadowBlur = 20; ctx.fillStyle = ec;
    const eyes = dark ? [[-0.06, 0], [0.06, 0], [0, -0.035], [-0.03, 0.03], [0.04, 0.035]] : [[-0.05, 0], [0.05, 0]];
    for (const [ox, oy] of eyes) { ctx.beginPath(); ctx.arc(w * (0.5 + ox), h * (0.24 + oy), 6, 0, Math.PI * 2); ctx.fill(); }
    ctx.shadowBlur = 0;
    // ランタン
    const lx = w * 0.78, ly = h * 0.58;
    const lg = ctx.createRadialGradient(lx, ly, 0, lx, ly, 160);
    lg.addColorStop(0, dark ? 'rgba(180,100,255,0.7)' : 'rgba(255,190,90,0.8)');
    lg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = lg; ctx.fillRect(0, 0, w, h);
    emoji(ctx, '🏮', lx, ly, 70);
    labelPlate(ctx, w, h, [spec.title, spec.file], 'bottom');
  }

  function drawObject(ctx, w, h, spec) {
    // 祭壇などの汎用オブジェクト：石台＋記号
    ctx.fillStyle = '#2e2824';
    ctx.fillRect(w * 0.15, h * 0.55, w * 0.7, h * 0.35);
    ctx.fillStyle = '#4a4038';
    ctx.fillRect(w * 0.1, h * 0.5, w * 0.8, h * 0.07);
    const lg = ctx.createRadialGradient(w / 2, h * 0.35, 0, w / 2, h * 0.35, w * 0.5);
    lg.addColorStop(0, 'rgba(255,200,120,0.5)');
    lg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = lg; ctx.fillRect(0, 0, w, h);
    emoji(ctx, spec.symbol || '🕯️', w / 2, h * 0.32, w * 0.3, 'rgba(255,170,80,0.9)');
    emoji(ctx, '🕯️', w * 0.22, h * 0.42, w * 0.1);
    emoji(ctx, '🕯️', w * 0.78, h * 0.42, w * 0.1);
    labelPlate(ctx, w, h, [spec.title, spec.file], 'bottom');
  }

  // ---------------- アイコン（アイテム・装備・状態異常など） ----------------
  function drawIcon(ctx, w, h, spec) {
    const ring = spec.ring || 'rgba(255,220,150,0.6)';
    if (spec.circle !== false) {
      const g = ctx.createRadialGradient(w / 2, h * 0.42, 4, w / 2, h / 2, w * 0.48);
      g.addColorStop(0, spec.bg || 'rgba(60,40,30,0.95)');
      g.addColorStop(1, 'rgba(10,6,6,0.95)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(w / 2, h / 2, w * 0.46, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = ring; ctx.lineWidth = Math.max(2, w * 0.03); ctx.stroke();
    }
    if (spec.tint) {
      ctx.save();
      emoji(ctx, spec.symbol, w / 2, h * 0.47, w * 0.56);
      ctx.globalCompositeOperation = 'source-atop';
      ctx.fillStyle = spec.tint;
      ctx.fillRect(0, 0, w, h);
      ctx.restore();
    } else emoji(ctx, spec.symbol || '?', w / 2, h * 0.47, w * 0.56, spec.glow);
    if (w >= 120) {
      ctx.save();
      ctx.font = `bold ${Math.round(w / 9)}px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(0,0,0,0.65)';
      ctx.fillRect(0, h - w / 7, w, w / 7);
      ctx.fillStyle = '#ffe9b8';
      ctx.fillText(spec.short || spec.title, w / 2, h - w / 32, w - 4);
      ctx.restore();
    }
  }

  // ---------------- カードイラスト ----------------
  function drawCardArt(ctx, w, h, spec) {
    const c = { attack: ['#5a1010', '#120202'], defense: ['#10305a', '#020612'], buff: ['#5a400a', '#120c02'], debuff: ['#3a1a5a', '#08020e'], special: ['#104a2a', '#020e06'] }[spec.variant] || ['#333', '#000'];
    const g = ctx.createRadialGradient(w / 2, h / 2, 10, w / 2, h / 2, w * 0.7);
    g.addColorStop(0, c[0]); g.addColorStop(1, c[1]);
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    const r = rng(hash(spec.path));
    for (let i = 0; i < 6; i++) {
      ctx.strokeStyle = `rgba(255,255,255,${0.04 + r() * 0.05})`;
      ctx.lineWidth = 2 + r() * 6;
      ctx.beginPath(); ctx.moveTo(r() * w, 0); ctx.lineTo(r() * w, h); ctx.stroke();
    }
    emoji(ctx, spec.symbol, w / 2, h * 0.45, h * 0.55, 'rgba(255,200,150,0.6)');
    labelPlate(ctx, w, h, [spec.title, spec.file], 'bottom');
  }

  // ---------------- UI ----------------
  function drawCardFrame(ctx, w, h, spec) {
    const col = { attack: '#b02a2a', defense: '#2f6db0', buff: '#c08a1e', debuff: '#6b3fd1', special: '#3b8f63' }[spec.variant];
    // 外枠
    ctx.lineWidth = 16;
    const g = ctx.createLinearGradient(0, 0, w, h);
    g.addColorStop(0, col); g.addColorStop(0.5, '#1a1010'); g.addColorStop(1, col);
    ctx.strokeStyle = g;
    roundRect(ctx, 8, 8, w - 16, h - 16, 22); ctx.stroke();
    ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(217,178,106,0.8)';
    roundRect(ctx, 20, 20, w - 40, h - 40, 14); ctx.stroke();
    // 名前帯
    ctx.fillStyle = 'rgba(0,0,0,0.65)';
    ctx.fillRect(20, 20, w - 40, 64);
    // イラスト枠
    ctx.strokeStyle = 'rgba(217,178,106,0.7)'; ctx.lineWidth = 4;
    ctx.strokeRect(28, 92, w - 56, 240);
    // 説明欄
    ctx.fillStyle = 'rgba(10,6,6,0.82)';
    roundRect(ctx, 28, 380, w - 56, h - 408, 10); ctx.fill();
    ctx.strokeStyle = 'rgba(217,178,106,0.35)'; ctx.lineWidth = 2; ctx.stroke();
    ctx.font = `14px ${FONT}`; ctx.fillStyle = 'rgba(255,233,184,0.35)'; ctx.textAlign = 'right';
    ctx.fillText(`${spec.title} / ${spec.file}`, w - 30, h - 24);
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }

  function drawButton(ctx, w, h, spec) {
    // 透過ボタン枠：角飾り＋細線（背景は CSS のグラデーションが透ける）
    ctx.strokeStyle = 'rgba(217,178,106,0.55)'; ctx.lineWidth = 2;
    ctx.strokeRect(6, 6, w - 12, h - 12);
    ctx.strokeStyle = 'rgba(217,178,106,0.95)'; ctx.lineWidth = 4;
    const c = 26;
    for (const [x, y, sx, sy] of [[4, 4, 1, 1], [w - 4, 4, -1, 1], [4, h - 4, 1, -1], [w - 4, h - 4, -1, -1]]) {
      ctx.beginPath(); ctx.moveTo(x, y + sy * c); ctx.lineTo(x, y); ctx.lineTo(x + sx * c, y); ctx.stroke();
    }
    const g = ctx.createLinearGradient(0, 0, w, 0);
    g.addColorStop(0, 'rgba(160,20,20,0)'); g.addColorStop(0.5, 'rgba(200,40,40,0.5)'); g.addColorStop(1, 'rgba(160,20,20,0)');
    ctx.fillStyle = g; ctx.fillRect(20, h - 10, w - 40, 2);
    ctx.font = `10px ${FONT}`; ctx.fillStyle = 'rgba(255,233,184,0.25)'; ctx.textAlign = 'right';
    ctx.fillText(spec.file, w - 12, h - 14);
  }

  function drawPanel(ctx, w, h, spec) {
    ctx.fillStyle = 'rgba(12,8,8,0.9)'; ctx.fillRect(0, 0, w, h);
    drawButton(ctx, w, h, spec);
    labelPlate(ctx, w, h, [spec.title, spec.file], 'bottom');
  }

  function drawCardBack(ctx, w, h, spec) {
    const g = ctx.createRadialGradient(w / 2, h / 2, 10, w / 2, h / 2, w);
    g.addColorStop(0, '#4a0a0a'); g.addColorStop(1, '#0a0202');
    ctx.fillStyle = g; roundRect(ctx, 0, 0, w, h, 20); ctx.fill();
    ctx.strokeStyle = '#b08d57'; ctx.lineWidth = 6; roundRect(ctx, 12, 12, w - 24, h - 24, 14); ctx.stroke();
    emoji(ctx, '👁️', w / 2, h / 2, w * 0.4, 'rgba(255,0,0,0.8)');
    labelPlate(ctx, w, h, [spec.title, spec.file], 'bottom');
  }

  function drawLogo(ctx, w, h, spec) {
    ctx.font = `900 ${h * 0.55}px "Cinzel", "Times New Roman", serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(200,0,0,0.9)'; ctx.shadowBlur = 40;
    ctx.fillStyle = '#d4c4a8';
    ctx.fillText('DarkSurvive', w / 2, h * 0.45);
    ctx.shadowBlur = 0;
    labelPlate(ctx, w, h, [spec.title, spec.file], 'bottom');
  }

  // ---------------- 入口 ----------------
  window.drawAsset = function (spec) {
    const canvas = document.createElement('canvas');
    canvas.width = spec.w;
    canvas.height = spec.h;
    const ctx = canvas.getContext('2d');
    const w = spec.w, h = spec.h;
    switch (spec.type) {
      case 'background': drawBackground(ctx, w, h, spec); labelPlate(ctx, w, h, [spec.title, spec.file, `${w}x${h}`], 'top-left'); break;
      case 'enemy': drawEnemy(ctx, w, h, spec); break;
      case 'door': drawDoor(ctx, w, h, spec); break;
      case 'chest': drawChest(ctx, w, h, spec); break;
      case 'figure': drawFigure(ctx, w, h, spec); break;
      case 'object': drawObject(ctx, w, h, spec); break;
      case 'icon': drawIcon(ctx, w, h, spec); break;
      case 'cardArt': drawCardArt(ctx, w, h, spec); break;
      case 'cardFrame': drawCardFrame(ctx, w, h, spec); break;
      case 'button': drawButton(ctx, w, h, spec); break;
      case 'panel': drawPanel(ctx, w, h, spec); break;
      case 'cardBack': drawCardBack(ctx, w, h, spec); break;
      case 'logo': drawLogo(ctx, w, h, spec); break;
    }
    return spec.path.endsWith('.webp') ? canvas.toDataURL('image/webp', 0.86) : canvas.toDataURL('image/png');
  };
})();
