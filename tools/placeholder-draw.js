// =============================================================
// placeholder-draw.js  【ツール：仮画像の描画（ブラウザ内で実行）】
// -------------------------------------------------------------
// generate-placeholders.ts から Edge(ヘッドレス) に読み込まれ、
// Canvas で仮画像を描いて PNG / WebP(dataURL) を返す。
//
// 目指す見た目：Shadowverse のような「重厚で高級感のあるダークファンタジー」
//   - 金属（金・銀・銅）の質感：多段グラデーション＋面取り（ベベル）＋ハイライト
//   - 唐草模様（フィリグリー）・カット宝石・メダリオン
//   - 絵文字を「金の浮き彫り」に加工してアイコン化
//   - 背景はゴシック建築を遠近法で描き、光の筋・霧・色調補正で空気感を出す
//
// 画像の右下に「何に使う画像か／ファイル名」を小さく書き込む（本番画像で上書きすれば消える）。
// UIの枠・ボタンなど“部品”の画像は見た目を損なうため文字を入れず、docs/ASSETS.md で管理する。
// =============================================================
/* eslint-disable */
(function () {
  const FONT = '"Yu Gothic UI", "Meiryo", sans-serif';
  const EMOJI = '"Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif';
  const TAU = Math.PI * 2;

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
  const canvasOf = (w, h) => { const c = document.createElement('canvas'); c.width = Math.ceil(w); c.height = Math.ceil(h); return c; };

  // =============================================================
  // 金属・宝石・装飾の部品
  // =============================================================
  /** 金属の色（暗→明→暗 を繰り返すことで光沢感を出す） */
  const METALS = {
    gold: ['#3a2405', '#8c5f16', '#e0aa45', '#fff3c0', '#e6b54e', '#93641a', '#f2cf72', '#4a2f08'],
    silver: ['#23262c', '#666d78', '#c8cdd5', '#ffffff', '#b3b9c3', '#626973', '#e2e6ec', '#30343b'],
    bronze: ['#251306', '#6a3b17', '#b4703a', '#ffd5a4', '#c07a40', '#6e3d18', '#dd9f69', '#321a09'],
    iron: ['#0d0d0f', '#2c2d31', '#55575d', '#9a9ca2', '#4c4e54', '#232428', '#6c6e74', '#121214'],
    crimson: ['#1e0303', '#5e0b0b', '#b51e1e', '#ff8c7a', '#c0281f', '#5e0b0b', '#e04a3a', '#2a0505'],
    ruby: ['#2a0306', '#7a0f1c', '#d62f3e', '#ffb3b8', '#d9303f', '#6e0d18', '#f25866', '#300409'],
    sapphire: ['#020a26', '#0d2a78', '#2e6ad6', '#bcd8ff', '#3274e0', '#0c2a74', '#5a9af2', '#04102e'],
    emerald: ['#02180c', '#0b5a2c', '#1fa65a', '#b8ffd6', '#22b060', '#0a5229', '#4cd486', '#03200f'],
    topaz: ['#2a1a02', '#7a520a', '#e0a81e', '#fff0a8', '#ecb52a', '#7a5208', '#f8d050', '#302002'],
    amethyst: ['#12041e', '#43166e', '#8a46cf', '#e6c8ff', '#9450d8', '#40146a', '#b07ae8', '#180626'],
  };
  function metal(ctx, x0, y0, x1, y1, kind) {
    const g = ctx.createLinearGradient(x0, y0, x1, y1);
    const s = METALS[kind] || METALS.gold;
    s.forEach((c, i) => g.addColorStop(i / (s.length - 1), c));
    return g;
  }

  function roundRectPath(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  /**
   * 面取りされた金属の線（外側に黒い縁、中に金属、上側に光）
   * @param pathFn パスを作る関数（何度も呼ばれる）
   */
  function bevelStroke(ctx, pathFn, width, kind, box) {
    ctx.save();
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    pathFn();
    ctx.shadowColor = 'rgba(0,0,0,0.7)';
    ctx.shadowBlur = width * 0.8;
    ctx.shadowOffsetY = width * 0.25;
    ctx.strokeStyle = 'rgba(0,0,0,0.9)';
    ctx.lineWidth = width + 3;
    ctx.stroke();
    ctx.shadowColor = 'transparent';
    ctx.strokeStyle = metal(ctx, box[0], box[1], box[2], box[3], kind);
    ctx.lineWidth = width;
    ctx.stroke();
    // 上側のハイライト
    ctx.save();
    ctx.translate(-width * 0.12, -width * 0.18);
    pathFn();
    ctx.strokeStyle = 'rgba(255,250,230,0.38)';
    ctx.lineWidth = Math.max(1, width * 0.22);
    ctx.stroke();
    ctx.restore();
    // 下側の影
    ctx.save();
    ctx.translate(width * 0.1, width * 0.2);
    pathFn();
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.lineWidth = Math.max(1, width * 0.18);
    ctx.stroke();
    ctx.restore();
    ctx.restore();
  }

  /** 渦巻き（唐草の先端）の点列 */
  function spiralPoints(cx, cy, r, a0, turns, dir) {
    const pts = [];
    const n = 40;
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const a = a0 + dir * t * turns * TAU;
      const rr = r * (1 - t * 0.85);
      pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]);
    }
    return pts;
  }

  /**
   * 唐草模様の“腕”を1本描く（始点から方向 ang に伸び、先端が渦を巻く）
   */
  function scrollArm(ctx, x, y, ang, len, width, kind, curlDir) {
    const pts = [];
    const n = 30;
    // 少しうねりながら伸びる
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const bend = Math.sin(t * Math.PI) * len * 0.12 * curlDir;
      const px = x + Math.cos(ang) * len * t - Math.sin(ang) * bend;
      const py = y + Math.sin(ang) * len * t + Math.cos(ang) * bend;
      pts.push([px, py]);
    }
    const [ex, ey] = pts[pts.length - 1];
    const r = len * 0.2;
    const cx = ex - Math.sin(ang) * r * curlDir;
    const cy = ey + Math.cos(ang) * r * curlDir;
    const a0 = Math.atan2(ey - cy, ex - cx);
    pts.push(...spiralPoints(cx, cy, r, a0, 1.1, curlDir));
    const path = () => {
      ctx.beginPath();
      pts.forEach(([px, py], i) => (i ? ctx.lineTo(px, py) : ctx.moveTo(px, py)));
    };
    bevelStroke(ctx, path, width, kind, [x - len, y - len, x + len, y + len]);
    // 腕に付く小さな葉
    const mid = pts[Math.floor(n * 0.55)];
    leaf(ctx, mid[0], mid[1], len * 0.22, ang - curlDir * 0.9, kind);
  }

  /** 葉っぱ（尖った楕円） */
  function leaf(ctx, x, y, size, ang, kind) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(ang);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(size * 0.5, -size * 0.45, size, 0);
    ctx.quadraticCurveTo(size * 0.5, size * 0.45, 0, 0);
    ctx.fillStyle = metal(ctx, 0, -size * 0.5, 0, size * 0.5, kind);
    ctx.shadowColor = 'rgba(0,0,0,0.6)';
    ctx.shadowBlur = 3;
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.5)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();
  }

  /** 角の飾り（唐草2本＋中央の宝石） */
  function cornerOrnament(ctx, x, y, size, rot, kind, gemHue) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    const w = Math.max(2, size * 0.07);
    scrollArm(ctx, size * 0.12, size * 0.04, 0.05, size * 0.85, w, kind, 1);
    scrollArm(ctx, size * 0.04, size * 0.12, Math.PI / 2 - 0.05, size * 0.85, w, kind, -1);
    leaf(ctx, size * 0.05, size * 0.05, size * 0.55, Math.PI / 4, kind);
    if (gemHue !== undefined) gem(ctx, size * 0.2, size * 0.2, size * 0.13, gemHue, 6, kind);
    ctx.restore();
  }

  /**
   * カットされた宝石（多角形のファセット＋金の台座）
   * @param hue 色相（0=赤, 30=琥珀, 120=緑, 210=青, 280=紫）。'prism' で虹色
   */
  function gem(ctx, cx, cy, r, hue, sides = 6, settingKind = 'gold', rot = -Math.PI / 2) {
    ctx.save();
    // 台座
    ctx.beginPath();
    ctx.arc(cx, cy, r * 1.28, 0, TAU);
    ctx.fillStyle = metal(ctx, cx - r, cy - r, cx + r, cy + r, settingKind);
    ctx.shadowColor = 'rgba(0,0,0,0.75)';
    ctx.shadowBlur = r * 0.5;
    ctx.shadowOffsetY = r * 0.12;
    ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.strokeStyle = 'rgba(0,0,0,0.6)';
    ctx.lineWidth = Math.max(1, r * 0.06);
    ctx.stroke();
    const outer = [];
    const inner = [];
    for (let i = 0; i < sides; i++) {
      const a = rot + (i / sides) * TAU;
      outer.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
      inner.push([cx + Math.cos(a) * r * 0.52 - r * 0.08, cy + Math.sin(a) * r * 0.52 - r * 0.08]);
    }
    const col = (light, i) => {
      if (hue === 'prism') return `hsl(${(i * 60 + light * 2) % 360}, 90%, ${light}%)`;
      return `hsl(${hue}, 85%, ${light}%)`;
    };
    // 外周のファセット（左上から光が当たる）
    for (let i = 0; i < sides; i++) {
      const j = (i + 1) % sides;
      const mid = Math.atan2((outer[i][1] + outer[j][1]) / 2 - cy, (outer[i][0] + outer[j][0]) / 2 - cx);
      const lightness = 22 + 30 * (0.5 + 0.5 * Math.cos(mid - (-2.3)));
      ctx.beginPath();
      ctx.moveTo(...outer[i]);
      ctx.lineTo(...outer[j]);
      ctx.lineTo(...inner[j]);
      ctx.lineTo(...inner[i]);
      ctx.closePath();
      ctx.fillStyle = col(lightness, i);
      ctx.fill();
    }
    // テーブル面
    ctx.beginPath();
    inner.forEach((p, i) => (i ? ctx.lineTo(...p) : ctx.moveTo(...p)));
    ctx.closePath();
    const tg = ctx.createRadialGradient(cx - r * 0.25, cy - r * 0.3, 0, cx, cy, r * 0.6);
    tg.addColorStop(0, hue === 'prism' ? '#ffffff' : `hsl(${hue}, 90%, 82%)`);
    tg.addColorStop(1, hue === 'prism' ? 'hsl(200, 90%, 60%)' : `hsl(${hue}, 85%, 45%)`);
    ctx.fillStyle = tg;
    ctx.fill();
    // 輪郭
    ctx.beginPath();
    outer.forEach((p, i) => (i ? ctx.lineTo(...p) : ctx.moveTo(...p)));
    ctx.closePath();
    ctx.strokeStyle = 'rgba(0,0,0,0.45)';
    ctx.lineWidth = Math.max(1, r * 0.05);
    ctx.stroke();
    // きらめき
    ctx.globalCompositeOperation = 'lighter';
    const sg = ctx.createRadialGradient(cx - r * 0.35, cy - r * 0.4, 0, cx - r * 0.35, cy - r * 0.4, r * 0.45);
    sg.addColorStop(0, 'rgba(255,255,255,0.95)');
    sg.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = sg;
    ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
    sparkle(ctx, cx - r * 0.35, cy - r * 0.4, r * 0.55, 'rgba(255,255,255,0.9)');
    ctx.restore();
  }

  /** 十字のきらめき */
  function sparkle(ctx, x, y, s, color) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x - s, y);
    ctx.quadraticCurveTo(x, y, x, y - s);
    ctx.quadraticCurveTo(x, y, x + s, y);
    ctx.quadraticCurveTo(x, y, x, y + s);
    ctx.quadraticCurveTo(x, y, x - s, y);
    ctx.fill();
    ctx.restore();
  }

  /**
   * 絵文字を加工して描く
   * @param mode 'relief' = 金属の浮き彫り（色は金属の色、陰影は絵文字のまま）
   *             'graded' = 元の色を残しつつ、暗く重厚な色調に補正
   */
  function emblem(ctx, ch, cx, cy, size, mode = 'relief', kind = 'gold', glow) {
    const pad = size * 0.4;
    const S = size + pad * 2;
    const mask = canvasOf(S, S);
    const m = mask.getContext('2d');
    m.font = `${size}px ${EMOJI}`;
    m.textAlign = 'center';
    m.textBaseline = 'middle';
    m.fillText(ch, S / 2, S / 2 + size * 0.04);

    const art = canvasOf(S, S);
    const a = art.getContext('2d');
    a.drawImage(mask, 0, 0);
    if (mode === 'relief') {
      // 明るさ(陰影)は絵文字から、色は金属のグラデーションから取る
      a.globalCompositeOperation = 'color';
      a.fillStyle = metal(a, 0, pad, 0, S - pad, kind);
      a.fillRect(0, 0, S, S);
      a.globalCompositeOperation = 'overlay';
      a.fillStyle = metal(a, pad, pad, S - pad, S - pad, kind);
      a.fillRect(0, 0, S, S);
    } else {
      // 彩度を落として暗く・暖色寄りに
      a.globalCompositeOperation = 'multiply';
      a.fillStyle = 'rgba(205,185,165,1)';
      a.fillRect(0, 0, S, S);
      a.globalCompositeOperation = 'soft-light';
      const g = a.createLinearGradient(0, pad, 0, S - pad);
      g.addColorStop(0, 'rgba(255,240,210,0.9)');
      g.addColorStop(1, 'rgba(20,10,5,0.9)');
      a.fillStyle = g;
      a.fillRect(0, 0, S, S);
    }
    a.globalCompositeOperation = 'destination-in';
    a.drawImage(mask, 0, 0);

    ctx.save();
    // 外側の暗い縁取り
    const outline = canvasOf(S, S);
    const o = outline.getContext('2d');
    o.drawImage(mask, 0, 0);
    o.globalCompositeOperation = 'source-in';
    o.fillStyle = 'rgba(10,5,2,0.95)';
    o.fillRect(0, 0, S, S);
    const ox = cx - S / 2;
    const oy = cy - S / 2;
    if (glow) {
      ctx.shadowColor = glow;
      ctx.shadowBlur = size * 0.35;
    }
    const d = Math.max(1.5, size * 0.025);
    for (let i = 0; i < 8; i++) ctx.drawImage(outline, ox + Math.cos((i / 8) * TAU) * d, oy + Math.sin((i / 8) * TAU) * d);
    ctx.shadowColor = 'rgba(0,0,0,0.7)';
    ctx.shadowBlur = size * 0.12;
    ctx.shadowOffsetY = size * 0.05;
    ctx.drawImage(art, ox, oy);
    ctx.restore();
  }

  /** メダリオン（金の縁取り＋エナメルの円盤） */
  function medallion(ctx, cx, cy, r, hue, kind = 'gold', sat = 60) {
    ctx.save();
    // 外周の金属リング
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, TAU);
    ctx.fillStyle = metal(ctx, cx - r, cy - r, cx + r, cy + r, kind);
    ctx.shadowColor = 'rgba(0,0,0,0.8)';
    ctx.shadowBlur = r * 0.15;
    ctx.shadowOffsetY = r * 0.05;
    ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.strokeStyle = 'rgba(0,0,0,0.75)';
    ctx.lineWidth = Math.max(1, r * 0.03);
    ctx.stroke();
    // 縁の粒（ビーズ）
    const beads = Math.max(12, Math.round(r / 3.2));
    for (let i = 0; i < beads; i++) {
      const a = (i / beads) * TAU;
      const bx = cx + Math.cos(a) * r * 0.91;
      const by = cy + Math.sin(a) * r * 0.91;
      const bg = ctx.createRadialGradient(bx - r * 0.015, by - r * 0.015, 0, bx, by, r * 0.045);
      bg.addColorStop(0, '#fff6d0');
      bg.addColorStop(1, 'rgba(90,60,15,0.9)');
      ctx.fillStyle = bg;
      ctx.beginPath();
      ctx.arc(bx, by, r * 0.04, 0, TAU);
      ctx.fill();
    }
    // 内側の溝
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.82, 0, TAU);
    ctx.fillStyle = 'rgba(0,0,0,0.85)';
    ctx.fill();
    // エナメル
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.78, 0, TAU);
    const eg = ctx.createRadialGradient(cx - r * 0.2, cy - r * 0.3, r * 0.05, cx, cy, r * 0.8);
    eg.addColorStop(0, `hsl(${hue}, ${sat}%, 42%)`);
    eg.addColorStop(0.6, `hsl(${hue}, ${sat}%, 20%)`);
    eg.addColorStop(1, `hsl(${hue}, ${sat}%, 7%)`);
    ctx.fillStyle = eg;
    ctx.fill();
    ctx.strokeStyle = metal(ctx, cx - r, cy - r, cx + r, cy + r, kind);
    ctx.lineWidth = Math.max(1, r * 0.04);
    ctx.stroke();
    // ガラスの反射
    ctx.beginPath();
    ctx.ellipse(cx - r * 0.15, cy - r * 0.38, r * 0.5, r * 0.22, -0.3, 0, TAU);
    const hg = ctx.createLinearGradient(0, cy - r * 0.6, 0, cy - r * 0.15);
    hg.addColorStop(0, 'rgba(255,255,255,0.28)');
    hg.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = hg;
    ctx.fill();
    ctx.restore();
  }

  /** 光の筋（ゴッドレイ） */
  function godRays(ctx, x, y, len, spread, count, color, r, baseAngle = Math.PI / 2) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < count; i++) {
      const a = baseAngle + (r() - 0.5) * spread;
      const w = 0.02 + r() * 0.05;
      const g = ctx.createLinearGradient(x, y, x + Math.cos(a) * len, y + Math.sin(a) * len);
      g.addColorStop(0, color.replace('A', (0.18 + r() * 0.12).toFixed(2)));
      g.addColorStop(1, color.replace('A', '0'));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + Math.cos(a - w) * len, y + Math.sin(a - w) * len);
      ctx.lineTo(x + Math.cos(a + w) * len, y + Math.sin(a + w) * len);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  /** 柔らかい光の玉 */
  function glow(ctx, x, y, r, color, alpha = 1) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, color.replace('A', alpha.toFixed(2)));
    g.addColorStop(0.4, color.replace('A', (alpha * 0.35).toFixed(2)));
    g.addColorStop(1, color.replace('A', '0'));
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
    ctx.restore();
  }

  /** 霧の層 */
  function fog(ctx, w, h, y0, y1, color, r, count = 14) {
    ctx.save();
    for (let i = 0; i < count; i++) {
      const fx = r() * w;
      const fy = y0 + r() * (y1 - y0);
      const rw = 200 + r() * 500;
      const g = ctx.createRadialGradient(fx, fy, 0, fx, fy, rw);
      g.addColorStop(0, color.replace('A', (0.08 + r() * 0.1).toFixed(2)));
      g.addColorStop(1, color.replace('A', '0'));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(fx, fy, rw, rw * 0.28, 0, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }

  /** 周辺減光 */
  function vignette(ctx, w, h, strength = 0.85, cy = 0.45) {
    const g = ctx.createRadialGradient(w / 2, h * cy, Math.min(w, h) * 0.25, w / 2, h * cy, Math.max(w, h) * 0.75);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, `rgba(0,0,0,${strength})`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }

  /** ざらつき（質感）。量は控えめにして容量を抑える */
  function grain(ctx, x, y, w, h, amount, r, alpha = 0.06) {
    ctx.save();
    for (let i = 0; i < amount; i++) {
      ctx.fillStyle = r() < 0.5 ? `rgba(255,240,220,${alpha * r()})` : `rgba(0,0,0,${alpha * 1.5 * r()})`;
      ctx.fillRect(x + r() * w, y + r() * h, 1 + r() * 2, 1 + r() * 2);
    }
    ctx.restore();
  }

  /** 用途ラベル（右下に小さく・控えめに） */
  function tag(ctx, w, h, text) {
    const size = Math.max(10, Math.min(18, Math.round(w / 34)));
    ctx.save();
    ctx.font = `bold ${size}px ${FONT}`;
    const tw = Math.min(w - 8, ctx.measureText(text).width + 14);
    const th = size + 8;
    const x = w - tw - 4;
    const y = h - th - 4;
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    roundRectPath(ctx, x, y, tw, th, th / 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,233,190,0.6)';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, x + tw / 2, y + th / 2 + 1, tw - 8);
    ctx.restore();
  }

  // =============================================================
  // 背景（ゴシック建築の広間）
  // =============================================================
  const THEMES = {
    tower1: { sky: ['#1b140f', '#070504'], stone: [70, 58, 48], light: 'rgba(255,150,70,A)', fog: 'rgba(90,80,70,A)', window: [30, 70], grade: 'rgba(40,20,5,0.25)' },
    tower2: { sky: ['#0f1817', '#030606'], stone: [52, 66, 66], light: 'rgba(120,255,210,A)', fog: 'rgba(70,110,100,A)', window: [160, 60], grade: 'rgba(0,30,25,0.3)' },
    tower3: { sky: ['#1a0c12', '#050203'], stone: [70, 50, 58], light: 'rgba(255,70,70,A)', fog: 'rgba(110,40,50,A)', window: [350, 75], grade: 'rgba(40,0,10,0.3)' },
    tower4: { sky: ['#1d140a', '#060402'], stone: [76, 58, 40], light: 'rgba(255,130,40,A)', fog: 'rgba(120,80,40,A)', window: [25, 90], grade: 'rgba(50,20,0,0.3)' },
    tower5: { sky: ['#0e0a1a', '#030206'], stone: [50, 42, 72], light: 'rgba(180,100,255,A)', fog: 'rgba(80,50,130,A)', window: [275, 70], grade: 'rgba(20,0,40,0.35)' },
    entrance: { sky: ['#17120e', '#040303'], stone: [74, 64, 54], light: 'rgba(255,170,100,A)', fog: 'rgba(80,80,80,A)', window: [35, 60], grade: 'rgba(30,15,5,0.2)' },
    treasure: { sky: ['#1c160a', '#050402'], stone: [80, 68, 44], light: 'rgba(255,210,100,A)', fog: 'rgba(120,100,50,A)', window: [45, 85], grade: 'rgba(40,25,0,0.2)' },
    shop: { sky: ['#1e150c', '#060402'], stone: [78, 60, 42], light: 'rgba(255,180,90,A)', fog: 'rgba(90,60,30,A)', window: [30, 80], grade: 'rgba(40,20,0,0.2)' },
    darkshop: { sky: ['#120a1a', '#040206'], stone: [56, 40, 74], light: 'rgba(180,100,255,A)', fog: 'rgba(90,40,140,A)', window: [280, 80], grade: 'rgba(25,0,45,0.35)' },
    event: { sky: ['#14110f', '#040303'], stone: [64, 58, 52], light: 'rgba(255,230,170,A)', fog: 'rgba(80,80,80,A)', window: [40, 40], grade: 'rgba(20,15,10,0.2)' },
    roll: { sky: ['#140808', '#020101'], stone: [56, 36, 36], light: 'rgba(220,30,30,A)', fog: 'rgba(110,10,10,A)', window: [0, 85], grade: 'rgba(40,0,0,0.35)' },
    gameover: { sky: ['#1a0202', '#000000'], stone: [56, 20, 20], light: 'rgba(170,0,0,A)', fog: 'rgba(110,0,0,A)', window: [0, 90], grade: 'rgba(60,0,0,0.4)' },
  };

  function stoneColor(theme, k) {
    const [r, g, b] = theme.stone;
    return `rgb(${Math.round(r * k)},${Math.round(g * k)},${Math.round(b * k)})`;
  }

  /** ステンドグラスのバラ窓 */
  function roseWindow(ctx, cx, cy, R, theme, r) {
    ctx.save();
    const [hue, sat] = theme.window;
    // 外周の石
    ctx.beginPath();
    ctx.arc(cx, cy, R * 1.12, 0, TAU);
    ctx.fillStyle = stoneColor(theme, 0.55);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, TAU);
    ctx.clip();
    const petals = 12;
    for (let i = 0; i < petals; i++) {
      const a0 = (i / petals) * TAU;
      const a1 = ((i + 1) / petals) * TAU;
      for (let ring = 0; ring < 3; ring++) {
        const r0 = R * (0.25 + ring * 0.25);
        const r1 = R * (0.5 + ring * 0.25);
        ctx.beginPath();
        ctx.arc(cx, cy, r1, a0, a1);
        ctx.arc(cx, cy, r0, a1, a0, true);
        ctx.closePath();
        const hh = (hue + (i % 3) * 25 + ring * 40 + (r() - 0.5) * 30 + 360) % 360;
        ctx.fillStyle = `hsl(${hh}, ${sat}%, ${28 + r() * 22}%)`;
        ctx.fill();
        ctx.strokeStyle = '#120d0a';
        ctx.lineWidth = R * 0.03;
        ctx.stroke();
      }
    }
    ctx.beginPath();
    ctx.arc(cx, cy, R * 0.25, 0, TAU);
    ctx.fillStyle = `hsl(${hue}, ${sat}%, 55%)`;
    ctx.fill();
    ctx.strokeStyle = '#120d0a';
    ctx.lineWidth = R * 0.04;
    ctx.stroke();
    ctx.restore();
    glow(ctx, cx, cy, R * 2.2, theme.light, 0.55);
  }

  /** 尖頭アーチのパス */
  function gothicArchPath(ctx, x, y, w, h) {
    // x,y = 左下, w,h = 幅・高さ
    const spring = y - h + w * 0.55;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x, spring);
    ctx.quadraticCurveTo(x, y - h + w * 0.1, x + w / 2, y - h);
    ctx.quadraticCurveTo(x + w, y - h + w * 0.1, x + w, spring);
    ctx.lineTo(x + w, y);
    ctx.closePath();
  }

  /** 燭台・松明の炎 */
  function flame(ctx, x, y, s, theme) {
    glow(ctx, x, y, s * 9, theme.light, 0.7);
    ctx.save();
    const g = ctx.createRadialGradient(x, y + s * 0.3, 0, x, y, s * 1.4);
    g.addColorStop(0, 'rgba(255,255,230,1)');
    g.addColorStop(0.35, 'rgba(255,200,90,0.95)');
    g.addColorStop(1, 'rgba(255,80,0,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(x, y - s * 1.6);
    ctx.quadraticCurveTo(x + s * 0.8, y, x, y + s * 0.6);
    ctx.quadraticCurveTo(x - s * 0.8, y, x, y - s * 1.6);
    ctx.fill();
    ctx.restore();
  }

  function drawHall(ctx, w, h, spec) {
    const theme = THEMES[spec.theme] || THEMES.tower1;
    const r = rng(hash(spec.path));
    const vx = w / 2;
    const vy = h * 0.47; // 消失点
    const floorY = h * 0.62;

    // 空気（奥行きのグラデーション）
    let g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, theme.sky[0]);
    g.addColorStop(1, theme.sky[1]);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    // 奥の壁と大きな窓
    const backW = w * 0.34;
    const backH = h * 0.5;
    ctx.fillStyle = stoneColor(theme, 0.42);
    ctx.fillRect(vx - backW / 2, floorY - backH, backW, backH);
    // 奥の壁の石積み
    for (let y = floorY - backH; y < floorY; y += 22) {
      const off = (Math.round(y / 22) % 2) * 30;
      for (let x = vx - backW / 2 - off; x < vx + backW / 2; x += 60) {
        ctx.fillStyle = stoneColor(theme, 0.32 + r() * 0.16);
        ctx.fillRect(Math.max(vx - backW / 2, x + 1), y + 1, 58, 20);
      }
    }
    // 戦闘画面は敵が中央に立つので窓は置かず、天井からの光で明るさを出す
    const isWindow = spec.kind !== 'battle';
    if (!isWindow) {
      godRays(ctx, vx, -80, h * 1.2, 0.7, 14, theme.light, r, Math.PI / 2);
      glow(ctx, vx, floorY + 40, w * 0.45, theme.light, 0.35);
    }
    if (isWindow) roseWindow(ctx, vx, floorY - backH * 0.62, backW * 0.24, theme, r);
    // 奥の扉口（暗い）
    gothicArchPath(ctx, vx - backW * 0.13, floorY, backW * 0.26, backH * 0.42);
    const dg = ctx.createLinearGradient(0, floorY - backH * 0.42, 0, floorY);
    dg.addColorStop(0, 'rgba(0,0,0,0.95)');
    dg.addColorStop(1, theme.light.replace('A', '0.25'));
    ctx.fillStyle = dg;
    ctx.fill();

    // 天井のリブ（消失点へ向かう線）
    ctx.save();
    ctx.strokeStyle = stoneColor(theme, 0.25);
    ctx.lineWidth = 10;
    for (let i = -6; i <= 6; i++) {
      ctx.beginPath();
      ctx.moveTo(vx + i * 30, floorY - backH);
      ctx.lineTo(vx + i * 420, -40);
      ctx.stroke();
    }
    ctx.restore();

    // 床（遠近のタイル＋濡れた反射）
    g = ctx.createLinearGradient(0, floorY, 0, h);
    g.addColorStop(0, stoneColor(theme, 0.38));
    g.addColorStop(1, stoneColor(theme, 0.08));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(vx - backW / 2, floorY);
    ctx.lineTo(vx + backW / 2, floorY);
    ctx.lineTo(w + 400, h);
    ctx.lineTo(-400, h);
    ctx.closePath();
    ctx.fill();
    ctx.save();
    ctx.strokeStyle = 'rgba(0,0,0,0.45)';
    ctx.lineWidth = 2;
    for (let i = -14; i <= 14; i++) {
      ctx.beginPath();
      ctx.moveTo(vx + i * (backW / 28), floorY);
      ctx.lineTo(vx + i * 170, h);
      ctx.stroke();
    }
    for (let k = 1; k < 10; k++) {
      const y = floorY + (h - floorY) * Math.pow(k / 10, 1.8);
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }
    ctx.restore();
    // 床の反射（窓の光）
    if (isWindow) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const rg = ctx.createRadialGradient(vx, floorY + (h - floorY) * 0.35, 0, vx, floorY + (h - floorY) * 0.35, w * 0.35);
      rg.addColorStop(0, theme.light.replace('A', '0.22'));
      rg.addColorStop(1, theme.light.replace('A', '0'));
      ctx.fillStyle = rg;
      ctx.beginPath();
      ctx.ellipse(vx, floorY + (h - floorY) * 0.35, w * 0.35, (h - floorY) * 0.3, 0, 0, TAU);
      ctx.fill();
      ctx.restore();
    }

    // 左右の柱とアーチ（手前ほど大きい）
    const depths = [0.12, 0.3, 0.55, 0.85];
    for (const side of [-1, 1]) {
      for (let di = 0; di < depths.length; di++) {
        const d = depths[di];
        const s = 0.25 + d * 1.6; // 大きさ
        const px = vx + side * (backW / 2 + (w / 2 - backW / 2 + 140) * d * 1.05);
        const top = floorY - backH - (floorY - backH + 60) * d;
        const bottom = floorY + (h - floorY) * d * 0.95;
        const pw = 34 * s;
        // 柱と柱の間のアーチ（壁）
        if (di < depths.length - 1) {
          const d2 = depths[di + 1];
          const px2 = vx + side * (backW / 2 + (w / 2 - backW / 2 + 140) * d2 * 1.05);
          ctx.fillStyle = stoneColor(theme, 0.2 + d * 0.15);
          ctx.beginPath();
          ctx.moveTo(px, top);
          ctx.lineTo(px2, top - (floorY - backH + 60) * (d2 - d));
          ctx.lineTo(px2, floorY + (h - floorY) * d2 * 0.95);
          ctx.lineTo(px, bottom);
          ctx.closePath();
          ctx.fill();
          // 壁の窪み（尖頭アーチの暗がり）
          const ax = Math.min(px, px2) + Math.abs(px2 - px) * 0.18;
          const aw = Math.abs(px2 - px) * 0.64;
          const ay = (bottom + floorY + (h - floorY) * d2 * 0.95) / 2 - 10 * s;
          gothicArchPath(ctx, ax, ay, aw, (ay - top) * 0.75);
          ctx.fillStyle = 'rgba(0,0,0,0.6)';
          ctx.fill();
          // 壁の燭台
          if (r() < 0.75) flame(ctx, ax + aw / 2, ay - (ay - top) * 0.42, 5 * s, theme);
        }
        // 柱
        const pg = ctx.createLinearGradient(px - pw / 2, 0, px + pw / 2, 0);
        pg.addColorStop(0, stoneColor(theme, 0.12));
        pg.addColorStop(0.35, stoneColor(theme, 0.55 + d * 0.25));
        pg.addColorStop(0.6, stoneColor(theme, 0.35));
        pg.addColorStop(1, stoneColor(theme, 0.08));
        ctx.fillStyle = pg;
        ctx.fillRect(px - pw / 2, top - 40, pw, bottom - top + 40);
        // 柱頭と台座
        ctx.fillStyle = stoneColor(theme, 0.5);
        ctx.fillRect(px - pw * 0.7, top + 20 * s, pw * 1.4, 10 * s);
        ctx.fillRect(px - pw * 0.7, bottom - 14 * s, pw * 1.4, 14 * s);
      }
    }

    // 窓からの光の筋
    if (isWindow) godRays(ctx, vx, floorY - backH * 0.62, h * 1.1, 0.9, 16, theme.light, r, Math.PI / 2);

    // テーマごとの小物
    if (spec.theme === 'treasure') {
      for (let i = 0; i < 60; i++) {
        const x = vx + (r() - 0.5) * w * 0.8;
        const y = floorY + 40 + r() * 220;
        const cr = 4 + r() * 9;
        const cg = ctx.createRadialGradient(x - cr * 0.3, y - cr * 0.3, 0, x, y, cr);
        cg.addColorStop(0, '#fff2b0');
        cg.addColorStop(1, '#8a5a10');
        ctx.fillStyle = cg;
        ctx.beginPath();
        ctx.ellipse(x, y, cr, cr * 0.5, 0, 0, TAU);
        ctx.fill();
      }
      glow(ctx, vx, floorY + 120, 500, theme.light, 0.35);
    }
    if (spec.theme === 'shop' || spec.theme === 'darkshop') {
      // 棚と瓶
      for (const side of [-1, 1]) {
        const sx = vx + side * w * 0.33;
        for (let k = 0; k < 4; k++) {
          const sy = h * 0.3 + k * 90;
          ctx.fillStyle = '#1a120c';
          ctx.fillRect(sx - 170, sy, 340, 12);
          for (let b = 0; b < 8; b++) {
            const bx = sx - 150 + b * 40 + r() * 10;
            const bh = 30 + r() * 30;
            const hue = spec.theme === 'darkshop' ? 260 + r() * 60 : r() * 360;
            ctx.fillStyle = `hsla(${hue}, 60%, ${25 + r() * 20}%, 0.9)`;
            roundRectPath(ctx, bx, sy - bh, 18, bh, 6);
            ctx.fill();
            ctx.fillStyle = 'rgba(255,255,255,0.25)';
            ctx.fillRect(bx + 3, sy - bh + 6, 3, bh - 12);
          }
        }
      }
      for (const lx of [w * 0.18, w * 0.82]) flame(ctx, lx, h * 0.22, 14, theme);
    }
    if (spec.theme === 'roll') {
      // 床の魔法陣
      ctx.save();
      ctx.translate(vx, floorY + (h - floorY) * 0.45);
      ctx.scale(1, 0.28);
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = 'rgba(255,40,40,0.55)';
      ctx.shadowColor = 'rgba(255,0,0,0.9)';
      ctx.shadowBlur = 20;
      for (const rr of [380, 340, 220]) {
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(0, 0, rr, 0, TAU);
        ctx.stroke();
      }
      ctx.beginPath();
      for (let i = 0; i <= 5; i++) {
        const a = -Math.PI / 2 + (i * 2 * TAU) / 5;
        const px = Math.cos(a) * 340;
        const py = Math.sin(a) * 340;
        i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
      }
      ctx.stroke();
      ctx.font = '42px serif';
      ctx.fillStyle = 'rgba(255,60,60,0.7)';
      const runes = 'ᚠᚢᚦᚨᚱᚲᚷᚹᚺᚾᛁᛃᛇᛈᛉᛊᛏᛒᛖᛗᛚᛜᛞᛟ';
      for (let i = 0; i < 24; i++) {
        const a = (i / 24) * TAU;
        ctx.save();
        ctx.translate(Math.cos(a) * 362, Math.sin(a) * 362);
        ctx.rotate(a + Math.PI / 2);
        ctx.fillText(runes[i % runes.length], -12, 14);
        ctx.restore();
      }
      ctx.restore();
    }
    if (spec.theme === 'gameover') {
      for (let i = 0; i < 10; i++) {
        const bx = r() * w;
        const by = floorY + r() * (h - floorY);
        const bg2 = ctx.createRadialGradient(bx, by, 0, bx, by, 80 + r() * 160);
        bg2.addColorStop(0, 'rgba(110,0,0,0.6)');
        bg2.addColorStop(1, 'rgba(60,0,0,0)');
        ctx.fillStyle = bg2;
        ctx.beginPath();
        ctx.ellipse(bx, by, 220, 60, 0, 0, TAU);
        ctx.fill();
      }
    }

    // 霧・色調補正・周辺減光
    fog(ctx, w, h, floorY - 80, h, theme.fog, r, 18);
    fog(ctx, w, h, h * 0.2, floorY, theme.fog, r, 6);
    ctx.save();
    ctx.globalCompositeOperation = 'multiply';
    ctx.fillStyle = theme.grade;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
    vignette(ctx, w, h, 0.88, 0.45);
  }

  /** タイトル・エンディングの屋外（塔と月） */
  function drawSkyScene(ctx, w, h, spec) {
    const clear = spec.theme === 'clear';
    const r = rng(hash(spec.path));
    let g = ctx.createLinearGradient(0, 0, 0, h);
    if (clear) {
      g.addColorStop(0, '#1d2a48'); g.addColorStop(0.45, '#7a4a52'); g.addColorStop(0.7, '#f0a060'); g.addColorStop(1, '#2a1408');
    } else {
      g.addColorStop(0, '#030104'); g.addColorStop(0.45, '#2a0508'); g.addColorStop(0.75, '#140204'); g.addColorStop(1, '#030101');
    }
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    // 星
    if (!clear) for (let i = 0; i < 160; i++) { ctx.fillStyle = `rgba(255,230,230,${r() * 0.6})`; ctx.fillRect(r() * w, r() * h * 0.5, 1.5, 1.5); }
    // 月 / 朝日
    const mx = clear ? w * 0.5 : w * 0.7;
    const my = clear ? h * 0.66 : h * 0.26;
    glow(ctx, mx, my, 700, clear ? 'rgba(255,200,130,A)' : 'rgba(200,30,30,A)', 0.7);
    const mg = ctx.createRadialGradient(mx - 30, my - 30, 10, mx, my, 120);
    mg.addColorStop(0, clear ? '#fffbe8' : '#ffe4dc');
    mg.addColorStop(1, clear ? '#ffd08a' : '#c25a50');
    ctx.fillStyle = mg;
    ctx.beginPath();
    ctx.arc(mx, my, 115, 0, TAU);
    ctx.fill();
    if (!clear) {
      // 月のクレーター
      for (let i = 0; i < 9; i++) {
        ctx.fillStyle = 'rgba(120,30,30,0.25)';
        ctx.beginPath();
        ctx.arc(mx + (r() - 0.5) * 150, my + (r() - 0.5) * 150, 8 + r() * 22, 0, TAU);
        ctx.fill();
      }
    }
    // 雲（重ねて立体感）
    for (let layer = 0; layer < 3; layer++) {
      for (let i = 0; i < 10; i++) {
        const cx = r() * w;
        const cy = h * (0.1 + layer * 0.12) + r() * h * 0.15;
        const cw = 300 + r() * 500;
        const cg = ctx.createRadialGradient(cx, cy - 20, 0, cx, cy, cw);
        cg.addColorStop(0, clear ? `rgba(255,200,170,${0.12 + layer * 0.05})` : `rgba(${60 - layer * 15},${8},${10},${0.5 + layer * 0.15})`);
        cg.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = cg;
        ctx.beginPath();
        ctx.ellipse(cx, cy, cw, cw * 0.18, 0, 0, TAU);
        ctx.fill();
      }
    }
    // 遠くの山
    ctx.fillStyle = clear ? '#2a1a14' : '#0c0306';
    ctx.beginPath();
    ctx.moveTo(0, h);
    for (let x = 0; x <= w; x += 30) ctx.lineTo(x, h * 0.74 + Math.sin(x * 0.004) * 50 + Math.sin(x * 0.013) * 20 + r() * 8);
    ctx.lineTo(w, h);
    ctx.fill();
    // 塔（段のある尖塔）
    const tx = w * 0.5;
    ctx.fillStyle = clear ? '#140c08' : '#000000';
    const tiers = [[190, h], [160, h * 0.62], [130, h * 0.38], [100, h * 0.2], [60, h * 0.08]];
    ctx.beginPath();
    ctx.moveTo(tx - tiers[0][0], h);
    for (let i = 0; i < tiers.length; i++) {
      const [tw, ty] = tiers[i];
      const next = tiers[i + 1];
      ctx.lineTo(tx - tw, ty);
      if (next) {
        ctx.lineTo(tx - tw - 20, next[1] + 30);
        ctx.lineTo(tx - next[0], next[1] + 30);
      }
    }
    ctx.lineTo(tx, -30);
    for (let i = tiers.length - 1; i >= 0; i--) {
      const [tw, ty] = tiers[i];
      const next = tiers[i + 1];
      if (next) {
        ctx.lineTo(tx + next[0], next[1] + 30);
        ctx.lineTo(tx + tw + 20, next[1] + 30);
      }
      ctx.lineTo(tx + tw, ty);
    }
    ctx.closePath();
    ctx.fill();
    // 塔の縁取りの月明かり
    ctx.save();
    ctx.strokeStyle = clear ? 'rgba(255,180,120,0.35)' : 'rgba(255,80,60,0.28)';
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.restore();
    // 窓の灯り
    for (let i = 0; i < 40; i++) {
      const wy = h * 0.12 + r() * h * 0.8;
      const span = 60 + (wy / h) * 110;
      const wx = tx + (r() - 0.5) * span * 1.6;
      const lit = r() < 0.7;
      ctx.fillStyle = lit ? 'rgba(255,170,80,0.95)' : 'rgba(255,40,30,0.95)';
      ctx.shadowColor = lit ? '#ff9a30' : '#ff2010';
      ctx.shadowBlur = 16;
      roundRectPath(ctx, wx, wy, 7, 16, 3);
      ctx.fill();
    }
    ctx.shadowBlur = 0;
    // 稲妻
    if (!clear) {
      ctx.save();
      ctx.strokeStyle = 'rgba(255,220,255,0.75)';
      ctx.shadowColor = 'rgba(200,150,255,1)';
      ctx.shadowBlur = 25;
      ctx.lineWidth = 3;
      let lx = w * 0.18;
      let ly = 0;
      ctx.beginPath();
      ctx.moveTo(lx, ly);
      while (ly < h * 0.55) {
        lx += (r() - 0.45) * 60;
        ly += 30 + r() * 40;
        ctx.lineTo(lx, ly);
      }
      ctx.stroke();
      ctx.restore();
      // カラス
      ctx.fillStyle = '#000';
      for (let i = 0; i < 9; i++) {
        const bx = w * 0.55 + r() * w * 0.35;
        const by = h * 0.1 + r() * h * 0.3;
        const s = 6 + r() * 10;
        ctx.beginPath();
        ctx.moveTo(bx - s * 2, by - s * 0.6);
        ctx.quadraticCurveTo(bx - s, by - s * 1.2, bx, by);
        ctx.quadraticCurveTo(bx + s, by - s * 1.2, bx + s * 2, by - s * 0.6);
        ctx.quadraticCurveTo(bx + s, by - s * 0.3, bx, by + s * 0.3);
        ctx.quadraticCurveTo(bx - s, by - s * 0.3, bx - s * 2, by - s * 0.6);
        ctx.fill();
      }
    }
    // 手前の地面と枯れ木
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.moveTo(0, h);
    for (let x = 0; x <= w; x += 40) ctx.lineTo(x, h * 0.9 + Math.sin(x * 0.006) * 22 + r() * 8);
    ctx.lineTo(w, h);
    ctx.fill();
    ctx.strokeStyle = '#000';
    ctx.lineCap = 'round';
    const tree = (x, y, len, ang, wd) => {
      if (len < 10) return;
      const x2 = x + Math.cos(ang) * len;
      const y2 = y + Math.sin(ang) * len;
      ctx.lineWidth = wd;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x2, y2);
      ctx.stroke();
      tree(x2, y2, len * 0.72, ang - 0.35 - r() * 0.3, wd * 0.68);
      tree(x2, y2, len * 0.66, ang + 0.3 + r() * 0.35, wd * 0.68);
    };
    tree(w * 0.1, h * 0.94, 170, -Math.PI / 2 + 0.1, 26);
    tree(w * 0.9, h * 0.94, 150, -Math.PI / 2 - 0.12, 22);
    fog(ctx, w, h, h * 0.75, h, clear ? 'rgba(255,200,170,A)' : 'rgba(120,20,20,A)', r, 16);
    vignette(ctx, w, h, 0.8, 0.4);
  }

  function drawBackground(ctx, w, h, spec) {
    if (spec.theme === 'title' || spec.theme === 'clear') drawSkyScene(ctx, w, h, spec);
    else drawHall(ctx, w, h, spec);
    tag(ctx, w, h, `${spec.title} ／ ${spec.file}`);
  }

  // =============================================================
  // 敵（陰影・リムライト・質感つきのクリーチャー）
  // =============================================================
  const ENEMY_PALETTES = [
    { skin: ['#5a4234', '#2a1c14', '#120b07'], rim: 'rgba(255,120,70,A)', eye: '#ff3a2a', vein: 'rgba(120,20,20,A)' },
    { skin: ['#4a5c52', '#1c2a24', '#08100c'], rim: 'rgba(120,255,200,A)', eye: '#b6ff5a', vein: 'rgba(40,90,40,A)' },
    { skin: ['#5a3a48', '#2a1420', '#10060a'], rim: 'rgba(255,90,110,A)', eye: '#ff3a6a', vein: 'rgba(110,10,40,A)' },
    { skin: ['#5e4a30', '#2c2010', '#120c04'], rim: 'rgba(255,160,60,A)', eye: '#ffb020', vein: 'rgba(120,60,10,A)' },
    { skin: ['#463a60', '#1c1430', '#0a0614'], rim: 'rgba(190,120,255,A)', eye: '#d080ff', vein: 'rgba(80,30,120,A)' },
  ];

  /** 先細りの手足（ポリゴン） */
  function taperedLimb(ctx, pts, w0, w1, fill, rim) {
    const left = [];
    const right = [];
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i];
      const q = pts[Math.min(pts.length - 1, i + 1)];
      const pr = pts[Math.max(0, i - 1)];
      const dx = q[0] - pr[0];
      const dy = q[1] - pr[1];
      const len = Math.hypot(dx, dy) || 1;
      const nx = -dy / len;
      const ny = dx / len;
      const wd = w0 + (w1 - w0) * (i / (pts.length - 1));
      left.push([p[0] + nx * wd, p[1] + ny * wd]);
      right.push([p[0] - nx * wd, p[1] - ny * wd]);
    }
    ctx.beginPath();
    left.forEach((p, i) => (i ? ctx.lineTo(...p) : ctx.moveTo(...p)));
    right.reverse().forEach((p) => ctx.lineTo(...p));
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
    if (rim) {
      ctx.save();
      ctx.beginPath();
      left.forEach((p, i) => (i ? ctx.lineTo(...p) : ctx.moveTo(...p)));
      ctx.strokeStyle = rim;
      ctx.lineWidth = 2.5;
      ctx.stroke();
      ctx.restore();
    }
  }

  function bezierPts(p0, p1, p2, p3, n = 24) {
    const pts = [];
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const u = 1 - t;
      pts.push([
        u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0],
        u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1],
      ]);
    }
    return pts;
  }

  /** パスを“生き物の皮膚”として塗る（陰影・質感・リムライト・輪郭） */
  function shadeFlesh(ctx, pathFn, bx, by, bw, bh, pal, r, opts = {}) {
    pathFn();
    const g = ctx.createRadialGradient(bx - bw * 0.25, by - bh * 0.35, 4, bx, by, Math.max(bw, bh) * 0.8);
    const skin = opts.metal ? ['#8a8c92', '#3a3b40', '#121214'] : pal.skin;
    g.addColorStop(0, skin[0]);
    g.addColorStop(0.55, skin[1]);
    g.addColorStop(1, skin[2]);
    ctx.fillStyle = g;
    ctx.fill();
    ctx.save();
    pathFn();
    ctx.clip();
    if (!opts.metal) {
      // 血管・斑点
      for (let i = 0; i < 18; i++) {
        let x = bx + (r() - 0.5) * bw;
        let y = by + (r() - 0.5) * bh;
        ctx.strokeStyle = pal.vein.replace('A', (0.2 + r() * 0.35).toFixed(2));
        ctx.lineWidth = 1 + r() * 2.2;
        ctx.beginPath();
        ctx.moveTo(x, y);
        for (let k = 0; k < 5; k++) { x += (r() - 0.5) * 26; y += (r() - 0.3) * 20; ctx.lineTo(x, y); }
        ctx.stroke();
      }
      for (let i = 0; i < 26; i++) {
        ctx.fillStyle = `rgba(0,0,0,${0.08 + r() * 0.14})`;
        ctx.beginPath();
        ctx.arc(bx + (r() - 0.5) * bw, by + (r() - 0.5) * bh, 2 + r() * 6, 0, TAU);
        ctx.fill();
      }
    } else {
      // 錆と擦り傷
      for (let i = 0; i < 20; i++) {
        ctx.fillStyle = `rgba(${110 + r() * 50},${50 + r() * 20},20,${0.12 + r() * 0.2})`;
        ctx.beginPath();
        ctx.ellipse(bx + (r() - 0.5) * bw, by + (r() - 0.5) * bh, 4 + r() * 14, 2 + r() * 6, r() * 3, 0, TAU);
        ctx.fill();
      }
      // 金属の反射
      const sg = ctx.createLinearGradient(bx - bw / 2, by - bh / 2, bx + bw / 2, by + bh / 2);
      sg.addColorStop(0.3, 'rgba(255,255,255,0)');
      sg.addColorStop(0.42, 'rgba(255,255,255,0.22)');
      sg.addColorStop(0.5, 'rgba(255,255,255,0)');
      ctx.fillStyle = sg;
      ctx.fillRect(bx - bw, by - bh, bw * 2, bh * 2);
    }
    // 下側の陰
    const ao = ctx.createLinearGradient(0, by, 0, by + bh * 0.6);
    ao.addColorStop(0, 'rgba(0,0,0,0)');
    ao.addColorStop(1, 'rgba(0,0,0,0.65)');
    ctx.fillStyle = ao;
    ctx.fillRect(bx - bw, by, bw * 2, bh);
    // 背後からのリムライト
    ctx.globalCompositeOperation = 'lighter';
    const rg = ctx.createRadialGradient(bx + bw * 0.6, by - bh * 0.25, 0, bx + bw * 0.6, by - bh * 0.25, bw * 0.6);
    rg.addColorStop(0, pal.rim.replace('A', '0.4'));
    rg.addColorStop(1, pal.rim.replace('A', '0'));
    ctx.fillStyle = rg;
    ctx.fillRect(bx - bw, by - bh, bw * 2, bh * 2);
    ctx.restore();
    pathFn();
    ctx.strokeStyle = pal.rim.replace('A', '0.4');
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.strokeStyle = 'rgba(0,0,0,0.6)';
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  /** なめらかな閉じた形（点列を二次曲線でつなぐ） */
  function smoothClosed(ctx, pts) {
    ctx.beginPath();
    const n = pts.length;
    for (let i = 0; i < n; i++) {
      const p = pts[i];
      const q = pts[(i + 1) % n];
      const mx = (p[0] + q[0]) / 2;
      const my = (p[1] + q[1]) / 2;
      i ? ctx.quadraticCurveTo(p[0], p[1], mx, my) : ctx.moveTo(mx, my);
    }
    ctx.closePath();
  }

  /** 有機的な塊の点列 */
  function blobPts(cx, cy, rx, ry, r, wobble = 1, flatBottom = true) {
    const pts = [];
    const N = 56;
    const ph = [r() * TAU, r() * TAU, r() * TAU];
    for (let i = 0; i < N; i++) {
      const a = (i / N) * TAU;
      const k = 1 + wobble * (0.08 * Math.sin(a * 3 + ph[0]) + 0.05 * Math.sin(a * 5 + ph[1]) + 0.035 * Math.sin(a * 8 + ph[2]));
      const fb = flatBottom && Math.sin(a) > 0.55 ? 0.92 : 1;
      pts.push([cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k * fb]);
    }
    return pts;
  }

  /** 目の色を rgba(…,A) 形式に */
  function eyeGlowColor(pal) {
    const c = pal.eye;
    return `rgba(${parseInt(c.slice(1, 3), 16)},${parseInt(c.slice(3, 5), 16)},${parseInt(c.slice(5, 7), 16)},A)`;
  }

  /** 光る目 */
  function creatureEye(ctx, ex, ey, er, pal, slit = true) {
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.beginPath();
    ctx.ellipse(ex, ey - er * 0.2, er * 1.5, er * 1.05, 0, 0, TAU);
    ctx.fill();
    glow(ctx, ex, ey, er * 4, eyeGlowColor(pal), 0.55);
    const eg = ctx.createRadialGradient(ex - er * 0.3, ey - er * 0.3, 0, ex, ey, er);
    eg.addColorStop(0, '#fff6c0');
    eg.addColorStop(0.35, pal.eye);
    eg.addColorStop(1, '#300000');
    ctx.fillStyle = eg;
    ctx.beginPath();
    ctx.ellipse(ex, ey, er, er * 0.72, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#050000';
    ctx.beginPath();
    if (slit) ctx.ellipse(ex, ey, er * 0.18, er * 0.62, 0, 0, TAU);
    else ctx.arc(ex, ey, er * 0.35, 0, TAU);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.beginPath();
    ctx.arc(ex - er * 0.35, ey - er * 0.28, er * 0.14, 0, TAU);
    ctx.fill();
  }

  /** 牙の並んだ口 */
  function creatureMouth(ctx, cx, my, mw, mh, big, r) {
    const g = ctx.createRadialGradient(cx, my, 0, cx, my, mw * 0.6);
    g.addColorStop(0, '#000');
    g.addColorStop(1, '#3a0606');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(cx, my, mw / 2, mh, 0, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = 'rgba(160,30,40,0.8)';
    ctx.lineWidth = 2.5;
    ctx.stroke();
    const teeth = Math.max(5, Math.round(mw / 12));
    for (const row of [-1, 1]) {
      for (let i = 0; i < teeth; i++) {
        const t = (i + 0.5) / teeth;
        const tx = cx - mw / 2 + mw * t;
        const edge = my + row * mh * Math.sqrt(Math.max(0, 1 - Math.pow(t * 2 - 1, 2))) * 0.95;
        const tl = (8 + r() * 12) * big * (1 - Math.abs(t - 0.5) * 0.9);
        const tg = ctx.createLinearGradient(tx, edge, tx, edge - row * tl);
        tg.addColorStop(0, '#6a5a40');
        tg.addColorStop(1, '#f6eedc');
        ctx.fillStyle = tg;
        ctx.beginPath();
        ctx.moveTo(tx - 4.5 * big, edge);
        ctx.lineTo(tx, edge - row * tl);
        ctx.lineTo(tx + 4.5 * big, edge);
        ctx.fill();
      }
    }
    for (let i = 0; i < 4; i++) {
      const dx = cx + (r() - 0.5) * mw * 0.7;
      const dy = my + mh * 0.7;
      const dl = 10 + r() * 24;
      const bg = ctx.createLinearGradient(dx, dy, dx, dy + dl);
      bg.addColorStop(0, 'rgba(120,0,0,0.95)');
      bg.addColorStop(1, 'rgba(60,0,0,0.9)');
      ctx.fillStyle = bg;
      ctx.beginPath();
      ctx.moveTo(dx - 2.5, dy);
      ctx.lineTo(dx + 2.5, dy);
      ctx.lineTo(dx + 3.5, dy + dl);
      ctx.arc(dx, dy + dl, 3.5, 0, Math.PI);
      ctx.closePath();
      ctx.fill();
    }
  }

  /** 爪 */
  function claws(ctx, hx, hy, side, big) {
    for (let k = 0; k < 3; k++) {
      const cg = ctx.createLinearGradient(hx, hy, hx + side * (14 + k * 8), hy + 18);
      cg.addColorStop(0, '#4a3c2c');
      cg.addColorStop(1, '#f0e4c8');
      ctx.fillStyle = cg;
      ctx.beginPath();
      ctx.moveTo(hx - 4 + k * 6 * side, hy - 4);
      ctx.quadraticCurveTo(hx + side * (18 + k * 7) * big, hy - 2, hx + side * (14 + k * 8) * big, hy + 16 * big);
      ctx.lineTo(hx + 4 + k * 6 * side, hy + 2);
      ctx.closePath();
      ctx.fill();
    }
  }

  /** 角・トゲ */
  function horn(ctx, sx, sy, a, len, wd, curve) {
    const ex = sx + Math.cos(a) * len + curve;
    const ey = sy + Math.sin(a) * len - Math.abs(curve) * 0.5;
    const hg = ctx.createLinearGradient(sx, sy, ex, ey);
    hg.addColorStop(0, '#3a2c20');
    hg.addColorStop(0.6, '#bfae8e');
    hg.addColorStop(1, '#f2e6c8');
    taperedLimb(ctx, bezierPts([sx, sy], [sx + Math.cos(a) * len * 0.45, sy + Math.sin(a) * len * 0.45], [ex - curve * 0.3, ey + 12], [ex, ey], 14), wd, 0.5, hg, 'rgba(255,255,255,0.35)');
  }

  function limbGrad(ctx, pal, x0, y0, x1, y1, metalLimb) {
    const lg = ctx.createLinearGradient(x0, y0, x1, y1);
    lg.addColorStop(0, metalLimb ? '#55575d' : pal.skin[1]);
    lg.addColorStop(1, metalLimb ? '#141416' : pal.skin[2]);
    return lg;
  }

  // ---- 肉塊型（触手つきの塊） ----
  function enemyBlob(ctx, w, h, spec, pal, r, big) {
    const cx = w / 2;
    const base = h * 0.9;
    const bw = w * (0.27 + r() * 0.1) * big;
    const bh = h * (0.36 + r() * 0.12) * big;
    const by = base - bh * 0.62;
    const back = 2 + Math.floor(r() * 3) + (spec.kind === 'boss' ? 3 : 0);
    for (let i = 0; i < back; i++) {
      const side = i % 2 ? 1 : -1;
      const p0 = [cx + side * bw * 0.25, by - bh * (0.1 + r() * 0.3)];
      const p3 = [cx + side * (bw * 0.8 + r() * w * 0.2), base - r() * h * 0.45];
      taperedLimb(ctx, bezierPts(p0, [p0[0] + side * 60, p0[1] - 120 - r() * 80], [p3[0] - side * 30, p3[1] - 140], p3), 12 + r() * 8, 2, limbGrad(ctx, pal, p0[0], p0[1], p3[0], p3[1]), pal.rim.replace('A', '0.3'));
    }
    const pts = blobPts(cx, by, bw * 0.55, bh * 0.6, r);
    shadeFlesh(ctx, () => smoothClosed(ctx, pts), cx, by, bw, bh, pal, r);
    if (spec.kind !== 'normal') {
      const n = spec.kind === 'boss' ? 6 : 3;
      for (let i = 0; i < n; i++) {
        const t = i / (n - 1 || 1);
        const a = -Math.PI * (0.2 + 0.6 * t);
        horn(ctx, cx + Math.cos(a) * bw * 0.48, by + Math.sin(a) * bh * 0.5, a, (60 + r() * 50) * big, 9 * big, (t - 0.5) * 30);
      }
    }
    const eyes = spec.multiEye ? 7 : spec.kind === 'boss' ? 3 + Math.floor(r() * 3) : 1 + Math.floor(r() * 3);
    for (let i = 0; i < eyes; i++) {
      const ex = cx + (eyes === 1 ? 0 : (i / (eyes - 1) - 0.5) * bw * 0.6) + (r() - 0.5) * 14;
      creatureEye(ctx, ex, by - bh * 0.18 + (r() - 0.5) * bh * 0.2, (9 + r() * 9) * big, pal);
    }
    creatureMouth(ctx, cx, by + bh * 0.12, bw * (0.38 + r() * 0.25), (20 + r() * 16) * big, big, r);
    for (const side of [-1, 1]) {
      const p0 = [cx + side * bw * 0.42, by + bh * 0.05];
      const p3 = [cx + side * (bw * 0.75 + r() * 30), base - 8];
      taperedLimb(ctx, bezierPts(p0, [p0[0] + side * 70, p0[1] + 10], [p3[0] + side * 20, p3[1] - 60], p3), 15 * big, 7 * big, limbGrad(ctx, pal, p0[0], p0[1], p3[0], p3[1]), pal.rim.replace('A', '0.35'));
      claws(ctx, p3[0], p3[1], side, big);
    }
  }

  // ---- 人型（屍・信徒・鎧・看護婦など） ----
  function enemyHumanoid(ctx, w, h, spec, pal, r, big) {
    const cx = w / 2;
    const base = h * 0.92;
    const metalBody = !!spec.armored;
    const H = h * 0.8 * big;
    const shoulderW = w * (0.2 + r() * 0.05) * big;
    const waistW = shoulderW * 0.62;
    const topY = base - H;
    const headR = H * 0.11;
    const headY = topY + headR * 1.4;
    const shY = headY + headR * 1.6;
    const hipY = shY + H * 0.38;
    const robe = !!spec.hooded;
    // 脚
    if (!robe) {
      for (const side of [-1, 1]) {
        const p0 = [cx + side * waistW * 0.6, hipY - 10];
        const p3 = [cx + side * waistW * 0.75, base];
        taperedLimb(ctx, bezierPts(p0, [p0[0] + side * 6, p0[1] + 60], [p3[0] - side * 4, p3[1] - 60], p3), waistW * 0.32, waistW * 0.18, limbGrad(ctx, pal, p0[0], p0[1], p3[0], p3[1], metalBody), pal.rim.replace('A', '0.3'));
      }
    }
    // 胴体（ローブなら裾を広げる）
    const bottomY = robe ? base : hipY;
    const torso = () => {
      ctx.beginPath();
      ctx.moveTo(cx - shoulderW, shY);
      ctx.bezierCurveTo(cx - shoulderW * 1.05, shY + H * 0.12, cx - waistW, hipY - H * 0.12, cx - (robe ? shoulderW * 1.15 : waistW * 1.05), bottomY);
      ctx.lineTo(cx + (robe ? shoulderW * 1.15 : waistW * 1.05), bottomY);
      ctx.bezierCurveTo(cx + waistW, hipY - H * 0.12, cx + shoulderW * 1.05, shY + H * 0.12, cx + shoulderW, shY);
      ctx.quadraticCurveTo(cx, shY - headR * 0.6, cx - shoulderW, shY);
      ctx.closePath();
    };
    const tH = bottomY - shY;
    shadeFlesh(ctx, torso, cx, shY + tH * 0.4, shoulderW * 2, tH, pal, r, { metal: metalBody });
    // 肋骨・鎧の板
    ctx.save();
    torso();
    ctx.clip();
    for (let i = 0; i < 4; i++) {
      const y = shY + tH * (0.18 + i * 0.12);
      ctx.strokeStyle = metalBody ? 'rgba(0,0,0,0.6)' : 'rgba(0,0,0,0.35)';
      ctx.lineWidth = metalBody ? 3 : 2;
      ctx.beginPath();
      ctx.moveTo(cx - waistW * 0.9, y + 6);
      ctx.quadraticCurveTo(cx, y - 8, cx + waistW * 0.9, y + 6);
      ctx.stroke();
      if (metalBody) for (const sx of [-0.7, 0.7]) { ctx.fillStyle = '#c8cad0'; ctx.beginPath(); ctx.arc(cx + sx * waistW, y + 3, 3, 0, TAU); ctx.fill(); }
    }
    ctx.restore();
    // 腕（長く垂れ下がる）
    for (const side of [-1, 1]) {
      const p0 = [cx + side * shoulderW * 0.92, shY + 8];
      const p3 = [cx + side * (shoulderW * 1.35 + r() * 20), hipY + H * 0.12];
      taperedLimb(ctx, bezierPts(p0, [p0[0] + side * 30, p0[1] + 50], [p3[0] + side * 10, p3[1] - 70], p3), shoulderW * 0.2, shoulderW * 0.1, limbGrad(ctx, pal, p0[0], p0[1], p3[0], p3[1], metalBody), pal.rim.replace('A', '0.35'));
      claws(ctx, p3[0], p3[1], side, big);
      if (metalBody) {
        ctx.beginPath();
        ctx.ellipse(p0[0], p0[1] - 4, shoulderW * 0.34, shoulderW * 0.22, side * 0.3, 0, TAU);
        ctx.fillStyle = metal(ctx, p0[0] - 30, p0[1] - 20, p0[0] + 30, p0[1] + 20, 'iron');
        ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,0.7)';
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    }
    if (spec.weapon) {
      // 巨大な鉈・斧槍
      const wx = cx + shoulderW * 1.5;
      ctx.fillStyle = metal(ctx, wx - 10, topY, wx + 40, hipY, 'iron');
      ctx.fillRect(wx - 4, topY + H * 0.02, 8, H * 0.9);
      ctx.beginPath();
      ctx.moveTo(wx + 4, topY + H * 0.04);
      ctx.quadraticCurveTo(wx + 80 * big, topY + H * 0.12, wx + 62 * big, topY + H * 0.34);
      ctx.lineTo(wx + 4, topY + H * 0.3);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = 'rgba(140,0,0,0.6)';
      ctx.lineWidth = 3;
      ctx.stroke();
    }
    // 頭
    if (robe) {
      // フード
      const hood = () => {
        ctx.beginPath();
        ctx.moveTo(cx, headY - headR * 2.0);
        ctx.bezierCurveTo(cx + headR * 2.0, headY - headR * 1.6, cx + headR * 2.1, headY + headR * 0.8, cx + shoulderW * 0.9, shY + 6);
        ctx.lineTo(cx - shoulderW * 0.9, shY + 6);
        ctx.bezierCurveTo(cx - headR * 2.1, headY + headR * 0.8, cx - headR * 2.0, headY - headR * 1.6, cx, headY - headR * 2.0);
        ctx.closePath();
      };
      shadeFlesh(ctx, hood, cx, headY, headR * 4, headR * 4, pal, r);
      ctx.beginPath();
      ctx.ellipse(cx, headY + headR * 0.1, headR * 1.05, headR * 1.25, 0, 0, TAU);
      ctx.fillStyle = '#030101';
      ctx.fill();
      for (const sx of [-0.35, 0.35]) creatureEye(ctx, cx + sx * headR, headY, headR * 0.18, pal, false);
      return;
    }
    if (metalBody) {
      // 兜（スリットから光る目）
      roundRectPath(ctx, cx - headR * 1.1, headY - headR * 1.3, headR * 2.2, headR * 2.5, headR * 0.6);
      ctx.fillStyle = metal(ctx, cx - headR, headY - headR, cx + headR, headY + headR, 'iron');
      ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.8)';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = '#000';
      ctx.fillRect(cx - headR * 0.85, headY - headR * 0.2, headR * 1.7, headR * 0.28);
      glow(ctx, cx, headY - headR * 0.06, headR * 1.8, eyeGlowColor(pal), 0.8);
      if (spec.kind !== 'normal') {
        horn(ctx, cx - headR * 0.9, headY - headR * 0.9, -Math.PI * 0.75, 60 * big, 8 * big, -14);
        horn(ctx, cx + headR * 0.9, headY - headR * 0.9, -Math.PI * 0.25, 60 * big, 8 * big, 14);
      }
      return;
    }
    shadeFlesh(ctx, () => { ctx.beginPath(); ctx.ellipse(cx, headY, headR * 0.9, headR * 1.15, 0, 0, TAU); }, cx, headY, headR * 2, headR * 2.4, pal, r);
    const eyes = spec.kind === 'boss' ? 3 : 2;
    for (let i = 0; i < eyes; i++) creatureEye(ctx, cx + (i / (eyes - 1) - 0.5) * headR * 0.9, headY - headR * 0.15, headR * 0.22, pal, false);
    creatureMouth(ctx, cx, headY + headR * 0.55, headR * 1.0, headR * 0.28, 0.6, r);
    if (spec.stitches) {
      ctx.strokeStyle = 'rgba(30,10,10,0.9)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(cx, shY + 10);
      ctx.lineTo(cx, shY + tH * 0.8);
      ctx.stroke();
      for (let k = 0; k < 7; k++) {
        const y = shY + 18 + k * (tH * 0.1);
        ctx.beginPath();
        ctx.moveTo(cx - 9, y);
        ctx.lineTo(cx + 9, y + 5);
        ctx.stroke();
      }
    }
    if (spec.kind !== 'normal') {
      horn(ctx, cx - headR * 0.6, headY - headR * 0.8, -Math.PI * 0.65, 50 * big, 7 * big, -10);
      horn(ctx, cx + headR * 0.6, headY - headR * 0.8, -Math.PI * 0.35, 50 * big, 7 * big, 10);
    }
  }

  // ---- 獣型（四つ足・こちらを向く） ----
  function enemyBeast(ctx, w, h, spec, pal, r, big) {
    const cx = w / 2;
    const base = h * 0.92;
    const bw = w * 0.36 * big;
    const bh = h * 0.28 * big;
    const by = base - bh * 1.15;
    // 後ろ脚（奥）
    for (const side of [-1, 1]) {
      const p0 = [cx + side * bw * 0.7, by + bh * 0.1];
      const p3 = [cx + side * bw * 0.95, base - 4];
      taperedLimb(ctx, bezierPts(p0, [p0[0] + side * 20, p0[1] + 40], [p3[0] + side * 10, p3[1] - 30], p3), bw * 0.13, bw * 0.06, limbGrad(ctx, pal, p0[0], p0[1], p3[0], p3[1]), null);
    }
    // 胴体（横長）
    const body = blobPts(cx, by, bw, bh * 0.7, r, 0.8, false);
    shadeFlesh(ctx, () => smoothClosed(ctx, body), cx, by, bw * 2, bh * 1.4, pal, r);
    // 背中のトゲ
    for (let i = 0; i < 7; i++) {
      const t = i / 6;
      const sx = cx + (t - 0.5) * bw * 1.4;
      const sy = by - bh * 0.6 * Math.sin(Math.PI * (0.15 + t * 0.7));
      horn(ctx, sx, sy, -Math.PI / 2 + (t - 0.5) * 1.2, (26 + r() * 30) * big, 6 * big, 0);
    }
    // 前脚
    for (const side of [-1, 1]) {
      const p0 = [cx + side * bw * 0.42, by + bh * 0.25];
      const p3 = [cx + side * bw * 0.55, base];
      taperedLimb(ctx, bezierPts(p0, [p0[0] + side * 26, p0[1] + 40], [p3[0] - side * 6, p3[1] - 40], p3), bw * 0.16, bw * 0.08, limbGrad(ctx, pal, p0[0], p0[1], p3[0], p3[1]), pal.rim.replace('A', '0.35'));
      claws(ctx, p3[0], p3[1] - 4, side, big);
    }
    // 頭（双頭なら2つ）
    const heads = spec.twinHead ? [-0.42, 0.42] : [0];
    for (const off of heads) {
      const hx = cx + off * bw;
      const hy = by + bh * 0.15;
      const hr = bh * (spec.twinHead ? 0.55 : 0.68);
      const headPts = blobPts(hx, hy, hr * 1.05, hr * 0.95, r, 0.6, false);
      shadeFlesh(ctx, () => smoothClosed(ctx, headPts), hx, hy, hr * 2.1, hr * 1.9, pal, r);
      horn(ctx, hx - hr * 0.6, hy - hr * 0.7, -Math.PI * 0.7, hr * 0.9, hr * 0.14, -6);
      horn(ctx, hx + hr * 0.6, hy - hr * 0.7, -Math.PI * 0.3, hr * 0.9, hr * 0.14, 6);
      creatureEye(ctx, hx - hr * 0.38, hy - hr * 0.25, hr * 0.17, pal);
      creatureEye(ctx, hx + hr * 0.38, hy - hr * 0.25, hr * 0.17, pal);
      creatureMouth(ctx, hx, hy + hr * 0.38, hr * 1.25, hr * 0.32, big * 0.9, r);
    }
  }

  // ---- 浮遊型（亡霊・眼の群れ・首の聖歌隊） ----
  function enemyFloating(ctx, w, h, spec, pal, r, big) {
    const cx = w / 2;
    const top = h * 0.12;
    const R = w * 0.25 * big;
    const cy = top + R;
    glow(ctx, cx, cy + R * 0.3, R * 2.6, pal.rim, 0.3);
    // 霊体の尾（下に向かって細く消える）
    for (let k = 0; k < 4; k++) {
      const sx = cx + (k - 1.5) * R * 0.45;
      const p0 = [sx, cy + R * 0.5];
      const p3 = [sx + (r() - 0.5) * R * 1.2, h * 0.92];
      const lg = ctx.createLinearGradient(0, p0[1], 0, p3[1]);
      lg.addColorStop(0, pal.skin[1]);
      lg.addColorStop(1, 'rgba(0,0,0,0)');
      taperedLimb(ctx, bezierPts(p0, [p0[0] + (r() - 0.5) * 120, p0[1] + 100], [p3[0] + (r() - 0.5) * 120, p3[1] - 100], p3), R * 0.32, 1, lg, null);
    }
    // 本体（鐘型）
    const body = () => {
      ctx.beginPath();
      ctx.moveTo(cx, cy - R);
      ctx.bezierCurveTo(cx + R * 1.15, cy - R, cx + R * 1.05, cy + R * 0.4, cx + R * 0.95, cy + R * 0.95);
      ctx.quadraticCurveTo(cx, cy + R * 0.7, cx - R * 0.95, cy + R * 0.95);
      ctx.bezierCurveTo(cx - R * 1.05, cy + R * 0.4, cx - R * 1.15, cy - R, cx, cy - R);
      ctx.closePath();
    };
    shadeFlesh(ctx, body, cx, cy, R * 2, R * 2, pal, r);
    // 腕（細い霊の腕）
    for (const side of [-1, 1]) {
      const p0 = [cx + side * R * 0.9, cy + R * 0.2];
      const p3 = [cx + side * R * 1.8, cy + R * 1.2 + r() * 40];
      taperedLimb(ctx, bezierPts(p0, [p0[0] + side * 60, p0[1] - 30], [p3[0] - side * 20, p3[1] - 80], p3), R * 0.12, 2, limbGrad(ctx, pal, p0[0], p0[1], p3[0], p3[1]), pal.rim.replace('A', '0.4'));
      claws(ctx, p3[0], p3[1], side, big * 0.8);
    }
    if (spec.multiHead) {
      // 聖歌隊の首：小さな頭が並ぶ
      const n = 5;
      for (let i = 0; i < n; i++) {
        const a = Math.PI * (1.15 + (i / (n - 1)) * 0.7);
        const hx = cx + Math.cos(a) * R * 0.75;
        const hy = cy + Math.sin(a) * R * 0.55 + R * 0.25;
        const hr = R * 0.28;
        shadeFlesh(ctx, () => { ctx.beginPath(); ctx.ellipse(hx, hy, hr * 0.8, hr, 0, 0, TAU); }, hx, hy, hr * 1.6, hr * 2, pal, r);
        creatureEye(ctx, hx - hr * 0.3, hy - hr * 0.2, hr * 0.18, pal, false);
        creatureEye(ctx, hx + hr * 0.3, hy - hr * 0.2, hr * 0.18, pal, false);
        ctx.fillStyle = '#000';
        ctx.beginPath();
        ctx.ellipse(hx, hy + hr * 0.45, hr * 0.22, hr * 0.32, 0, 0, TAU);
        ctx.fill();
      }
      return;
    }
    const eyes = spec.multiEye ? 9 : spec.kind === 'boss' ? 3 : 2;
    for (let i = 0; i < eyes; i++) {
      const a = r() * TAU;
      const d = r() * R * 0.6;
      const ex = spec.multiEye ? cx + Math.cos(a) * d : cx + (eyes === 1 ? 0 : (i / (eyes - 1) - 0.5) * R * 0.9);
      const ey = spec.multiEye ? cy + Math.sin(a) * d * 0.8 : cy - R * 0.2;
      creatureEye(ctx, ex, ey, spec.multiEye ? R * (0.1 + r() * 0.1) : R * 0.15, pal, !spec.multiEye);
    }
    if (!spec.multiEye) creatureMouth(ctx, cx, cy + R * 0.3, R * 0.9, R * 0.25, big, r);
    if (spec.candle) flame(ctx, cx, cy - R * 1.1, 14, THEMES.event);
  }

  function drawEnemy(ctx, w, h, spec) {
    const r = rng(hash(spec.id));
    const pal = ENEMY_PALETTES[(spec.zone || 1) - 1];
    const big = spec.kind === 'boss' ? 1.1 : spec.kind === 'elite' ? 1.04 : 1;
    // 足元の影（小さく・体の後ろに）
    const base = h * 0.92;
    const g = ctx.createRadialGradient(w / 2, base, 0, w / 2, base, w * 0.42);
    g.addColorStop(0, 'rgba(0,0,0,0.8)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(w / 2, base, w * 0.42, h * 0.05, 0, 0, TAU);
    ctx.fill();
    switch (spec.archetype) {
      case 'humanoid': enemyHumanoid(ctx, w, h, spec, pal, r, big); break;
      case 'beast': enemyBeast(ctx, w, h, spec, pal, r, big); break;
      case 'floating': enemyFloating(ctx, w, h, spec, pal, r, big); break;
      default: enemyBlob(ctx, w, h, spec, pal, r, big);
    }
    tag(ctx, w, h, `${spec.title} ／ ${spec.file}`);
  }

  // =============================================================
  // オブジェクト（扉・宝箱・人物・祭壇）
  // =============================================================
  function drawDoor(ctx, w, h, spec) {
    const glowCol = {
      battle: 'rgba(255,90,60,A)', elite: 'rgba(255,140,30,A)', event: 'rgba(150,180,255,A)', shop: 'rgba(255,210,110,A)',
      boss: 'rgba(255,20,20,A)', hidden: 'rgba(255,225,130,A)', '1f': 'rgba(255,170,90,A)',
    }[spec.variant] || 'rgba(255,120,60,A)';
    const hue = { battle: 5, elite: 28, event: 220, shop: 45, boss: 355, hidden: 48, '1f': 30 }[spec.variant] ?? 10;
    const r = rng(hash(spec.path));
    const ax = w * 0.08;
    const aw = w * 0.84;
    const ab = h * 0.985;
    const ah = h * 0.86;
    // 扉の向こうの光（下と隙間から漏れる）
    glow(ctx, w / 2, ab, w * 0.7, glowCol, 0.55);
    // 石のアーチ（迫石）
    const stones = 13;
    for (let i = 0; i < stones; i++) {
      const t0 = i / stones;
      const t1 = (i + 1) / stones;
      const pt = (t) => {
        // 尖頭アーチに沿った点（外側）
        const ang = Math.PI * (1 - t);
        const sx = w / 2 + Math.cos(ang) * (aw / 2 + 26);
        const sy = ab - ah * 0.55 - Math.sin(ang) * (ah * 0.45 + 26) * (1 - Math.abs(Math.cos(ang)) * 0.1);
        return [sx, sy];
      };
      const pti = (t) => {
        const ang = Math.PI * (1 - t);
        return [w / 2 + Math.cos(ang) * (aw / 2 - 2), ab - ah * 0.55 - Math.sin(ang) * (ah * 0.45 - 2)];
      };
      const [a1, a2, b1, b2] = [pt(t0), pt(t1), pti(t1), pti(t0)];
      ctx.beginPath();
      ctx.moveTo(...a1);
      ctx.lineTo(...a2);
      ctx.lineTo(...b1);
      ctx.lineTo(...b2);
      ctx.closePath();
      const sg = ctx.createLinearGradient(a1[0], a1[1], b1[0], b1[1]);
      const k = 0.85 + r() * 0.3;
      sg.addColorStop(0, `rgb(${Math.round(92 * k)},${Math.round(82 * k)},${Math.round(72 * k)})`);
      sg.addColorStop(1, `rgb(${Math.round(40 * k)},${Math.round(34 * k)},${Math.round(30 * k)})`);
      ctx.fillStyle = sg;
      ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.7)';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    // 側柱
    for (const sx of [ax - 26, ax + aw]) {
      const pg = ctx.createLinearGradient(sx, 0, sx + 26, 0);
      pg.addColorStop(0, '#2a241f');
      pg.addColorStop(0.5, '#6a5e52');
      pg.addColorStop(1, '#1e1a16');
      ctx.fillStyle = pg;
      ctx.fillRect(sx, ab - ah * 0.55, 26, ah * 0.55);
    }
    // 扉の板（両開き）
    const doorPath = () => {
      ctx.beginPath();
      ctx.moveTo(ax, ab);
      ctx.lineTo(ax, ab - ah * 0.55);
      ctx.ellipse(w / 2, ab - ah * 0.55, aw / 2, ah * 0.45, 0, Math.PI, 0);
      ctx.lineTo(ax + aw, ab);
      ctx.closePath();
    };
    doorPath();
    let g = ctx.createLinearGradient(ax, 0, ax + aw, 0);
    g.addColorStop(0, '#1e120a');
    g.addColorStop(0.25, '#4a2e1a');
    g.addColorStop(0.48, '#2a1a0e');
    g.addColorStop(0.52, '#2a1a0e');
    g.addColorStop(0.75, '#4a2e1a');
    g.addColorStop(1, '#1e120a');
    ctx.fillStyle = g;
    ctx.fill();
    ctx.save();
    doorPath();
    ctx.clip();
    // 板目
    for (let x = ax; x < ax + aw; x += aw / 8) {
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      ctx.fillRect(x, 0, 3, h);
      for (let k = 0; k < 6; k++) {
        ctx.strokeStyle = `rgba(0,0,0,${0.15 + r() * 0.2})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        const yy = r() * h;
        ctx.moveTo(x + 6 + r() * 20, yy);
        ctx.bezierCurveTo(x + 10, yy + 40, x + 20, yy + 80, x + 8 + r() * 20, yy + 140);
        ctx.stroke();
      }
    }
    // 鉄の帯と鋲
    for (const by of [ab - ah * 0.2, ab - ah * 0.55, ab - ah * 0.8]) {
      const ig = ctx.createLinearGradient(0, by - 12, 0, by + 12);
      ig.addColorStop(0, '#5a5c62');
      ig.addColorStop(0.5, '#1c1d20');
      ig.addColorStop(1, '#0a0a0b');
      ctx.fillStyle = ig;
      ctx.fillRect(ax, by - 12, aw, 24);
      for (let x = ax + 14; x < ax + aw; x += 30) {
        const rg = ctx.createRadialGradient(x - 2, by - 2, 0, x, by, 6);
        rg.addColorStop(0, '#c8cad0');
        rg.addColorStop(1, '#202124');
        ctx.fillStyle = rg;
        ctx.beginPath();
        ctx.arc(x, by, 5, 0, TAU);
        ctx.fill();
      }
    }
    // 中央の隙間から漏れる光
    ctx.globalCompositeOperation = 'lighter';
    const sl = ctx.createLinearGradient(w / 2 - 14, 0, w / 2 + 14, 0);
    sl.addColorStop(0, glowCol.replace('A', '0'));
    sl.addColorStop(0.5, glowCol.replace('A', '0.9'));
    sl.addColorStop(1, glowCol.replace('A', '0'));
    ctx.fillStyle = sl;
    ctx.fillRect(w / 2 - 14, ab - ah, 28, ah);
    ctx.globalCompositeOperation = 'source-over';
    // 上からの陰
    g = ctx.createLinearGradient(0, ab - ah, 0, ab);
    g.addColorStop(0, 'rgba(0,0,0,0.65)');
    g.addColorStop(0.5, 'rgba(0,0,0,0.1)');
    g.addColorStop(1, 'rgba(0,0,0,0.45)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
    // 取っ手（輪）
    for (const side of [-1, 1]) {
      const hx = w / 2 + side * aw * 0.1;
      const hy = ab - ah * 0.38;
      ctx.beginPath();
      ctx.arc(hx, hy + 14, 15, 0, TAU);
      ctx.strokeStyle = metal(ctx, hx - 15, hy, hx + 15, hy + 30, 'iron');
      ctx.lineWidth = 6;
      ctx.stroke();
    }
    // 紋章（どの道かを示す）
    if (spec.symbol) {
      const my = ab - ah * 0.72;
      const mr = w * 0.16;
      glow(ctx, w / 2, my, mr * 3, glowCol, 0.6);
      medallion(ctx, w / 2, my, mr, hue, spec.variant === 'boss' ? 'crimson' : 'gold', 70);
      emblem(ctx, spec.symbol, w / 2, my, mr * 1.05, 'relief', spec.variant === 'boss' ? 'ruby' : 'gold', glowCol.replace('A', '0.9'));
    }
    tag(ctx, w, h, spec.file);
  }

  function drawChest(ctx, w, h, spec) {
    const kind = { red: 'ruby', blue: 'sapphire', yellow: 'topaz', green: 'emerald' }[spec.variant];
    const hue = { red: 355, blue: 215, yellow: 45, green: 140 }[spec.variant];
    const x = w * 0.1;
    const cw = w * 0.8;
    const top = h * 0.36;
    const bottom = h * 0.9;
    glow(ctx, w / 2, h * 0.55, w * 0.6, `hsla(${hue},90%,60%,A)`, 0.35);
    // 影
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.beginPath();
    ctx.ellipse(w / 2, bottom + 6, cw * 0.55, 14, 0, 0, TAU);
    ctx.fill();
    // 本体
    let g = ctx.createLinearGradient(0, top, 0, bottom);
    g.addColorStop(0, `hsl(${hue}, 55%, 28%)`);
    g.addColorStop(1, `hsl(${hue}, 55%, 10%)`);
    ctx.fillStyle = g;
    roundRectPath(ctx, x, top, cw, bottom - top, 10);
    ctx.fill();
    // ふた（丸み）
    ctx.beginPath();
    ctx.moveTo(x, top + 4);
    ctx.lineTo(x, h * 0.2);
    ctx.bezierCurveTo(x, h * 0.02, x + cw, h * 0.02, x + cw, h * 0.2);
    ctx.lineTo(x + cw, top + 4);
    ctx.closePath();
    g = ctx.createLinearGradient(0, h * 0.05, 0, top);
    g.addColorStop(0, `hsl(${hue}, 60%, 40%)`);
    g.addColorStop(1, `hsl(${hue}, 55%, 16%)`);
    ctx.fillStyle = g;
    ctx.fill();
    // 金の縁取り
    const rim = () => {
      ctx.beginPath();
      roundRectPath(ctx, x, top, cw, bottom - top, 10);
    };
    bevelStroke(ctx, rim, 7, 'gold', [x, top, x + cw, bottom]);
    bevelStroke(ctx, () => { ctx.beginPath(); ctx.moveTo(x, h * 0.2); ctx.bezierCurveTo(x, h * 0.02, x + cw, h * 0.02, x + cw, h * 0.2); }, 7, 'gold', [x, 0, x + cw, top]);
    for (const bx of [x + cw * 0.2, x + cw * 0.8]) {
      bevelStroke(ctx, () => { ctx.beginPath(); ctx.moveTo(bx, h * 0.1); ctx.lineTo(bx, bottom); }, 10, 'gold', [bx - 5, 0, bx + 5, h]);
    }
    // 角金具
    for (const [cx2, cy2, rot] of [[x, top, 0], [x + cw, top, Math.PI / 2], [x + cw, bottom, Math.PI], [x, bottom, -Math.PI / 2]]) cornerOrnament(ctx, cx2, cy2, 40, rot, 'gold');
    // 錠前（宝石つき）
    const lx = w / 2;
    const ly = top + 6;
    ctx.fillStyle = metal(ctx, lx - 26, ly - 30, lx + 26, ly + 30, 'gold');
    roundRectPath(ctx, lx - 26, ly - 30, 52, 62, 10);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.6)';
    ctx.lineWidth = 2;
    ctx.stroke();
    gem(ctx, lx, ly - 8, 13, hue, 8, 'gold');
    ctx.fillStyle = '#100800';
    ctx.beginPath();
    ctx.arc(lx, ly + 14, 5, 0, TAU);
    ctx.fill();
    ctx.fillRect(lx - 2.5, ly + 14, 5, 12);
    // ふたの宝石
    for (const gx of [x + cw * 0.08, x + cw * 0.92]) gem(ctx, gx, h * 0.25, 8, hue, 6, kind);
    tag(ctx, w, h, spec.file);
  }

  function drawFigure(ctx, w, h, spec) {
    const dark = spec.variant === 'dark';
    const r = rng(hash(spec.path));
    const cx = w * 0.46;
    const lantern = [w * 0.8, h * 0.6];
    const lightCol = dark ? 'rgba(190,110,255,A)' : 'rgba(255,180,90,A)';
    // ローブ
    const robe = () => {
      ctx.beginPath();
      ctx.moveTo(cx, h * 0.07);
      ctx.bezierCurveTo(cx + w * 0.3, h * 0.08, cx + w * 0.3, h * 0.3, cx + w * 0.26, h * 0.38);
      ctx.bezierCurveTo(cx + w * 0.42, h * 0.6, cx + w * 0.5, h * 0.85, cx + w * 0.52, h);
      ctx.lineTo(cx - w * 0.46, h);
      ctx.bezierCurveTo(cx - w * 0.42, h * 0.8, cx - w * 0.36, h * 0.55, cx - w * 0.26, h * 0.38);
      ctx.bezierCurveTo(cx - w * 0.3, h * 0.3, cx - w * 0.3, h * 0.08, cx, h * 0.07);
      ctx.closePath();
    };
    robe();
    let g = ctx.createLinearGradient(cx - w * 0.4, 0, cx + w * 0.5, 0);
    g.addColorStop(0, dark ? '#0a0612' : '#0c0806');
    g.addColorStop(0.55, dark ? '#24163a' : '#2e2016');
    g.addColorStop(1, dark ? '#3a2458' : '#4a3424');
    ctx.fillStyle = g;
    ctx.fill();
    ctx.save();
    robe();
    ctx.clip();
    // 布のしわ
    for (let i = 0; i < 14; i++) {
      const fx = cx - w * 0.35 + r() * w * 0.75;
      ctx.strokeStyle = `rgba(0,0,0,${0.25 + r() * 0.3})`;
      ctx.lineWidth = 2 + r() * 5;
      ctx.beginPath();
      ctx.moveTo(fx, h * 0.4 + r() * 60);
      ctx.bezierCurveTo(fx + (r() - 0.5) * 50, h * 0.6, fx + (r() - 0.5) * 60, h * 0.8, fx + (r() - 0.5) * 70, h);
      ctx.stroke();
    }
    // ランタンからの照り返し
    ctx.globalCompositeOperation = 'lighter';
    g = ctx.createRadialGradient(lantern[0], lantern[1], 0, lantern[0], lantern[1], w * 0.6);
    g.addColorStop(0, lightCol.replace('A', '0.3'));
    g.addColorStop(1, lightCol.replace('A', '0'));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
    // フードの中の闇
    ctx.beginPath();
    ctx.ellipse(cx + w * 0.02, h * 0.22, w * 0.15, h * 0.09, 0, 0, TAU);
    g = ctx.createRadialGradient(cx, h * 0.22, 0, cx, h * 0.22, w * 0.16);
    g.addColorStop(0, '#000');
    g.addColorStop(1, '#0a0605');
    ctx.fillStyle = g;
    ctx.fill();
    // 目
    const ec = dark ? 'rgba(210,130,255,A)' : 'rgba(255,200,90,A)';
    const eyes = dark ? [[-0.06, 0], [0.06, 0], [0, -0.035], [-0.03, 0.03], [0.04, 0.032], [-0.1, -0.02]] : [[-0.045, 0], [0.05, 0]];
    for (const [ox, oy] of eyes) {
      glow(ctx, cx + w * (0.02 + ox), h * (0.225 + oy), 18, ec, 0.9);
      ctx.fillStyle = ec.replace('A', '1');
      ctx.beginPath();
      ctx.ellipse(cx + w * (0.02 + ox), h * (0.225 + oy), 4.5, 3, 0, 0, TAU);
      ctx.fill();
    }
    // ランタン
    glow(ctx, lantern[0], lantern[1], 200, lightCol, 0.9);
    ctx.strokeStyle = metal(ctx, lantern[0] - 30, lantern[1] - 60, lantern[0] + 30, lantern[1] + 40, 'iron');
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(lantern[0], lantern[1] - 70);
    ctx.lineTo(lantern[0], lantern[1] - 46);
    ctx.stroke();
    roundRectPath(ctx, lantern[0] - 24, lantern[1] - 46, 48, 70, 10);
    ctx.stroke();
    g = ctx.createRadialGradient(lantern[0], lantern[1] - 10, 0, lantern[0], lantern[1] - 10, 30);
    g.addColorStop(0, '#fffbe0');
    g.addColorStop(1, lightCol.replace('A', '0.6'));
    ctx.fillStyle = g;
    roundRectPath(ctx, lantern[0] - 20, lantern[1] - 42, 40, 62, 8);
    ctx.fill();
    tag(ctx, w, h, `${spec.title} ／ ${spec.file}`);
  }

  function drawAltarObject(ctx, w, h, spec) {
    const r = rng(hash(spec.path));
    glow(ctx, w / 2, h * 0.4, w * 0.6, 'rgba(255,190,110,A)', 0.4);
    // 石の祭壇
    let g = ctx.createLinearGradient(0, h * 0.52, 0, h * 0.95);
    g.addColorStop(0, '#5a5048');
    g.addColorStop(1, '#1a1612');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(w * 0.2, h * 0.56);
    ctx.lineTo(w * 0.8, h * 0.56);
    ctx.lineTo(w * 0.76, h * 0.95);
    ctx.lineTo(w * 0.24, h * 0.95);
    ctx.closePath();
    ctx.fill();
    g = ctx.createLinearGradient(0, h * 0.5, 0, h * 0.58);
    g.addColorStop(0, '#8a7c6c');
    g.addColorStop(1, '#3a322a');
    ctx.fillStyle = g;
    ctx.fillRect(w * 0.12, h * 0.5, w * 0.76, h * 0.07);
    // ひび
    for (let i = 0; i < 6; i++) {
      ctx.strokeStyle = 'rgba(0,0,0,0.5)';
      ctx.lineWidth = 1.5;
      let px = w * (0.25 + r() * 0.5);
      let py = h * (0.6 + r() * 0.3);
      ctx.beginPath();
      ctx.moveTo(px, py);
      for (let k = 0; k < 4; k++) { px += (r() - 0.5) * 30; py += r() * 18; ctx.lineTo(px, py); }
      ctx.stroke();
    }
    // 祭壇の上の象徴（浮き彫り）
    emblem(ctx, spec.symbol || '💀', w / 2, h * 0.36, w * 0.3, 'graded', 'gold', 'rgba(255,160,80,0.8)');
    // 蝋燭
    for (const cxp of [0.2, 0.32, 0.68, 0.8]) {
      const cx = w * cxp;
      const ch = h * (0.08 + r() * 0.06);
      const cy = h * 0.5 - ch;
      g = ctx.createLinearGradient(cx - 7, 0, cx + 7, 0);
      g.addColorStop(0, '#9a8a70');
      g.addColorStop(0.5, '#f2e8d0');
      g.addColorStop(1, '#8a7a60');
      ctx.fillStyle = g;
      ctx.fillRect(cx - 7, cy, 14, ch);
      flame(ctx, cx, cy - 8, 6, THEMES.event);
    }
    tag(ctx, w, h, `${spec.title} ／ ${spec.file}`);
  }

  // =============================================================
  // アイコン類
  // =============================================================
  /** 金の浮き彫りメダリオン（意図・状態異常・UIアイコン） */
  function drawMedallionIcon(ctx, w, h, spec) {
    const r = w * 0.46;
    medallion(ctx, w / 2, h / 2, r, spec.hue ?? 30, spec.metal || 'gold', spec.sat ?? 60);
    emblem(ctx, spec.symbol, w / 2, h / 2, r * 1.0, spec.mode || 'relief', spec.emblemMetal || 'gold', spec.glow);
  }

  /** アイテム・装備：元の色を活かした重厚なアイコン */
  function drawItemIcon(ctx, w, h, spec) {
    const r = w * 0.47;
    const rimKind = spec.rim || 'bronze';
    medallion(ctx, w / 2, h / 2, r, spec.hue ?? 25, rimKind, 35);
    glow(ctx, w / 2, h / 2, r * 0.9, 'rgba(255,220,160,A)', 0.25);
    emblem(ctx, spec.symbol, w / 2, h / 2 + 2, r * 1.05, spec.mode || 'graded', spec.emblemMetal || 'gold', 'rgba(255,200,120,0.55)');
    if (spec.rim === 'gold') sparkle(ctx, w * 0.78, h * 0.22, w * 0.08, 'rgba(255,240,200,0.9)');
  }

  function drawKeyIcon(ctx, w, h, spec) {
    const kind = { red: 'ruby', blue: 'sapphire', yellow: 'topaz', green: 'emerald' }[spec.variant];
    const hue = { red: 355, blue: 215, yellow: 45, green: 140 }[spec.variant];
    glow(ctx, w / 2, h / 2, w * 0.5, `hsla(${hue},90%,60%,A)`, 0.5);
    emblem(ctx, '🗝️', w / 2, h / 2, w * 0.8, 'relief', kind, `hsla(${hue},90%,60%,0.9)`);
  }

  function drawCoin(ctx, w, h) {
    const r = w * 0.44;
    ctx.save();
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, r, 0, TAU);
    ctx.fillStyle = metal(ctx, 0, 0, w, h, 'gold');
    ctx.shadowColor = 'rgba(0,0,0,0.7)';
    ctx.shadowBlur = 6;
    ctx.fill();
    ctx.restore();
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, r * 0.78, 0, TAU);
    ctx.strokeStyle = 'rgba(90,55,10,0.8)';
    ctx.lineWidth = r * 0.08;
    ctx.stroke();
    ctx.font = `900 ${r * 1.1}px "Cinzel", serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(110,70,10,0.9)';
    ctx.fillText('G', w / 2 + 1, h / 2 + 3);
    ctx.fillStyle = metal(ctx, 0, h * 0.3, 0, h * 0.7, 'gold');
    ctx.fillText('G', w / 2, h / 2 + 1);
    sparkle(ctx, w * 0.32, h * 0.3, w * 0.12, 'rgba(255,255,240,0.9)');
  }

  function drawShieldIcon(ctx, w, h) {
    const path = () => {
      ctx.beginPath();
      ctx.moveTo(w / 2, h * 0.06);
      ctx.bezierCurveTo(w * 0.7, h * 0.14, w * 0.86, h * 0.14, w * 0.9, h * 0.16);
      ctx.bezierCurveTo(w * 0.9, h * 0.6, w * 0.75, h * 0.82, w / 2, h * 0.95);
      ctx.bezierCurveTo(w * 0.25, h * 0.82, w * 0.1, h * 0.6, w * 0.1, h * 0.16);
      ctx.bezierCurveTo(w * 0.14, h * 0.14, w * 0.3, h * 0.14, w / 2, h * 0.06);
      ctx.closePath();
    };
    path();
    const g = ctx.createLinearGradient(0, 0, w, h);
    g.addColorStop(0, '#3a6ab8');
    g.addColorStop(0.5, '#14305e');
    g.addColorStop(1, '#081830');
    ctx.fillStyle = g;
    ctx.fill();
    bevelStroke(ctx, path, w * 0.07, 'silver', [0, 0, w, h]);
    ctx.save();
    path();
    ctx.clip();
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.beginPath();
    ctx.ellipse(w * 0.36, h * 0.3, w * 0.25, h * 0.14, -0.5, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  // =============================================================
  // カード
  // =============================================================
  const RARITY_STYLE = {
    basic: { metal: 'bronze', gem: 25 },
    common: { metal: 'silver', gem: 205 },
    rare: { metal: 'gold', gem: 215 },
    legendary: { metal: 'gold', gem: 'prism' },
  };
  const TYPE_HUE = { attack: 0, defense: 215, buff: 38, debuff: 275, special: 150, support: 42, sword: 355, magic: 255, blood: 345, curse: 125 };

  /**
   * カード枠（2倍解像度 440x616 / 表示は 220x308）
   * 透明部分：イラスト窓。半透明：説明欄。名前のリボンは CSS で上に重ねる。
   */
  function drawCardFrame(ctx, w, h, spec) {
    const st = RARITY_STYLE[spec.variant] || RARITY_STYLE.basic;
    const kind = st.metal;
    const box = [0, 0, w, h];
    // 本体（暗い金属）
    roundRectPath(ctx, 8, 8, w - 16, h - 16, 26);
    let g = ctx.createLinearGradient(0, 0, w, h);
    g.addColorStop(0, '#2a2119');
    g.addColorStop(0.5, '#120d0a');
    g.addColorStop(1, '#221a14');
    ctx.fillStyle = g;
    ctx.fill();
    // 本体の模様（細い格子＋ざらつき）
    ctx.save();
    roundRectPath(ctx, 8, 8, w - 16, h - 16, 26);
    ctx.clip();
    ctx.strokeStyle = 'rgba(255,220,160,0.035)';
    ctx.lineWidth = 1;
    for (let i = -h; i < w; i += 14) {
      ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i + h, h); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(i + h, 0); ctx.lineTo(i, h); ctx.stroke();
    }
    ctx.restore();

    // イラスト窓をくり抜く（CSS: left 15 / top 15 / 190x178 → 2倍）
    const ax = 30, ay = 30, aw = 380, ah = 356;
    ctx.save();
    ctx.globalCompositeOperation = 'destination-out';
    roundRectPath(ctx, ax, ay, aw, ah, 14);
    ctx.fill();
    ctx.restore();
    // イラスト窓の内側の影（額縁の奥行き）
    ctx.save();
    roundRectPath(ctx, ax, ay, aw, ah, 14);
    ctx.clip();
    ctx.shadowColor = 'rgba(0,0,0,0.95)';
    ctx.shadowBlur = 26;
    ctx.lineWidth = 30;
    ctx.strokeStyle = 'rgba(0,0,0,0.85)';
    roundRectPath(ctx, ax - 15, ay - 15, aw + 30, ah + 30, 24);
    ctx.stroke();
    ctx.restore();
    bevelStroke(ctx, () => roundRectPath(ctx, ax, ay, aw, ah, 14), 7, kind, box);

    // 説明欄（CSS: left 15 / top 214 / 190x80 → 2倍）
    const dx = 30, dy = 428, dw = 380, dh = 160;
    roundRectPath(ctx, dx, dy, dw, dh, 12);
    g = ctx.createLinearGradient(0, dy, 0, dy + dh);
    g.addColorStop(0, 'rgba(26,20,16,0.97)');
    g.addColorStop(1, 'rgba(10,8,6,0.97)');
    ctx.fillStyle = g;
    ctx.fill();
    bevelStroke(ctx, () => roundRectPath(ctx, dx, dy, dw, dh, 12), 4, kind, box);
    ctx.strokeStyle = 'rgba(217,178,106,0.22)';
    ctx.lineWidth = 1.5;
    roundRectPath(ctx, dx + 9, dy + 9, dw - 18, dh - 18, 8);
    ctx.stroke();

    // 外枠（太い金属のベベル＋内側の細線）
    bevelStroke(ctx, () => roundRectPath(ctx, 12, 12, w - 24, h - 24, 24), 15, kind, box);
    ctx.strokeStyle = 'rgba(0,0,0,0.6)';
    ctx.lineWidth = 2;
    roundRectPath(ctx, 21, 21, w - 42, h - 42, 18);
    ctx.stroke();

    // 角の唐草
    const cs = 74;
    cornerOrnament(ctx, 16, 16, cs, 0, kind);
    cornerOrnament(ctx, w - 16, 16, cs, Math.PI / 2, kind);
    cornerOrnament(ctx, w - 16, h - 16, cs, Math.PI, kind);
    cornerOrnament(ctx, 16, h - 16, cs, -Math.PI / 2, kind);
    // 側面の留め具（宝石）
    for (const sx of [14, w - 14]) gem(ctx, sx, 404, 11, st.gem === 'prism' ? 'prism' : st.gem, 6, kind);
    // 下部中央のレア度の宝石
    gem(ctx, w / 2, h - 16, 17, st.gem, 8, kind);
    // 上部中央の飾り
    leaf(ctx, w / 2 - 2, 16, 40, -Math.PI + 0.25, kind);
    leaf(ctx, w / 2 + 2, 16, 40, -0.25, kind);
    if (spec.variant === 'legendary') {
      // 虹色の光沢を縁に重ねる
      ctx.save();
      ctx.globalCompositeOperation = 'overlay';
      const cg = ctx.createConicGradient ? ctx.createConicGradient(0, w / 2, h / 2) : null;
      if (cg) {
        ['#ff5a5a', '#ffd25a', '#5aff8a', '#5ac8ff', '#b05aff', '#ff5a5a'].forEach((c, i) => cg.addColorStop(i / 5, c));
        ctx.strokeStyle = cg;
        ctx.lineWidth = 15;
        roundRectPath(ctx, 12, 12, w - 24, h - 24, 24);
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  /** コストの宝石（燃える琥珀のクリスタル＋金の台座と羽飾り） */
  function drawCostGem(ctx, w, h) {
    const cx = w / 2;
    const cy = h / 2;
    const r = w * 0.32;
    // 羽飾り
    leaf(ctx, cx - r * 0.6, cy + r * 0.5, r * 1.1, Math.PI * 0.8, 'gold');
    leaf(ctx, cx + r * 0.6, cy + r * 0.5, r * 1.1, Math.PI * 0.2, 'gold');
    glow(ctx, cx, cy, r * 1.7, 'rgba(255,120,40,A)', 0.6);
    gem(ctx, cx, cy, r, 18, 8, 'gold', -Math.PI / 2 + Math.PI / 8);
    // 中央を少し暗くして数字を読みやすく
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r * 0.6);
    g.addColorStop(0, 'rgba(60,10,0,0.55)');
    g.addColorStop(1, 'rgba(60,10,0,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.6, 0, TAU);
    ctx.fill();
  }

  /** AP のクリスタル（点灯／消灯） */
  function drawApCrystal(ctx, w, h, spec) {
    const lit = spec.variant === 'lit';
    const cx = w / 2;
    const top = h * 0.06;
    const bottom = h * 0.94;
    const mid = h * 0.42;
    const half = w * 0.34;
    if (lit) glow(ctx, cx, h / 2, w * 0.75, 'rgba(255,130,40,A)', 0.7);
    const facets = [
      [[cx, top], [cx - half, mid], [cx, mid + h * 0.06]],
      [[cx, top], [cx + half, mid], [cx, mid + h * 0.06]],
      [[cx - half, mid], [cx, bottom], [cx, mid + h * 0.06]],
      [[cx + half, mid], [cx, bottom], [cx, mid + h * 0.06]],
    ];
    const shades = lit ? ['#ffd28a', '#ff8a2a', '#c4400e', '#7a1e04'] : ['#3a3434', '#262222', '#171414', '#0d0b0b'];
    facets.forEach((f, i) => {
      ctx.beginPath();
      f.forEach((p, k) => (k ? ctx.lineTo(...p) : ctx.moveTo(...p)));
      ctx.closePath();
      ctx.fillStyle = shades[i];
      ctx.fill();
      ctx.strokeStyle = lit ? 'rgba(255,240,200,0.5)' : 'rgba(120,110,100,0.35)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    });
    if (lit) {
      const g = ctx.createRadialGradient(cx, h * 0.45, 0, cx, h * 0.45, w * 0.3);
      g.addColorStop(0, 'rgba(255,255,220,0.9)');
      g.addColorStop(1, 'rgba(255,200,100,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
      sparkle(ctx, cx - half * 0.35, h * 0.28, w * 0.18, 'rgba(255,255,255,0.85)');
    }
    // 台座
    ctx.beginPath();
    ctx.ellipse(cx, bottom - 2, half * 0.9, h * 0.05, 0, 0, TAU);
    ctx.fillStyle = metal(ctx, cx - half, 0, cx + half, 0, lit ? 'gold' : 'iron');
    ctx.fill();
  }

  /** ターン終了ボタン（丸いメダリオン） */
  function drawEndTurn(ctx, w, h) {
    const cx = w / 2;
    const cy = h / 2;
    const R = w * 0.46;
    // 外周の歯車状の縁
    ctx.save();
    ctx.beginPath();
    const teeth = 24;
    for (let i = 0; i <= teeth * 2; i++) {
      const a = (i / (teeth * 2)) * TAU;
      const rr = i % 2 ? R : R * 0.95;
      i ? ctx.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr) : ctx.moveTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
    }
    ctx.closePath();
    ctx.fillStyle = metal(ctx, 0, 0, w, h, 'gold');
    ctx.shadowColor = 'rgba(0,0,0,0.85)';
    ctx.shadowBlur = 18;
    ctx.fill();
    ctx.restore();
    medallion(ctx, cx, cy, R * 0.88, 0, 'gold', 75);
    // 内側の赤いガラスのドーム
    ctx.beginPath();
    ctx.arc(cx, cy, R * 0.66, 0, TAU);
    const g = ctx.createRadialGradient(cx - R * 0.15, cy - R * 0.25, R * 0.05, cx, cy, R * 0.7);
    g.addColorStop(0, '#ff6a4a');
    g.addColorStop(0.45, '#8a0e0a');
    g.addColorStop(1, '#2a0202');
    ctx.fillStyle = g;
    ctx.fill();
    bevelStroke(ctx, () => { ctx.beginPath(); ctx.arc(cx, cy, R * 0.66, 0, TAU); }, R * 0.05, 'gold', [0, 0, w, h]);
    // 東西南北の宝石
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * TAU - Math.PI / 2;
      gem(ctx, cx + Math.cos(a) * R * 0.8, cy + Math.sin(a) * R * 0.8, R * 0.07, 0, 6, 'gold');
    }
    ctx.beginPath();
    ctx.ellipse(cx - R * 0.1, cy - R * 0.38, R * 0.42, R * 0.16, -0.25, 0, TAU);
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.fill();
  }

  /** リーダー（主人公）の肖像の枠 */
  function drawLeaderFrame(ctx, w, h) {
    const cx = w / 2;
    const cy = h * 0.46;
    const R = w * 0.36;
    // 左右の翼飾り
    for (const side of [-1, 1]) {
      for (let i = 0; i < 4; i++) {
        leaf(ctx, cx + side * R * 0.9, cy + R * 0.1, R * (0.75 - i * 0.12), side > 0 ? -0.6 + i * 0.35 : Math.PI + 0.6 - i * 0.35, 'gold');
      }
    }
    // リング（中は透明）
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, R * 1.12, 0, TAU);
    ctx.arc(cx, cy, R, 0, TAU, true);
    ctx.fillStyle = metal(ctx, cx - R, cy - R, cx + R, cy + R, 'gold');
    ctx.shadowColor = 'rgba(0,0,0,0.8)';
    ctx.shadowBlur = 16;
    ctx.fill();
    ctx.restore();
    bevelStroke(ctx, () => { ctx.beginPath(); ctx.arc(cx, cy, R * 1.06, 0, TAU); }, R * 0.05, 'gold', [0, 0, w, h]);
    ctx.strokeStyle = 'rgba(0,0,0,0.8)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, TAU);
    ctx.stroke();
    // 上の宝石と下の台座
    gem(ctx, cx, cy - R * 1.1, R * 0.12, 0, 8, 'gold');
    cornerOrnament(ctx, cx - R * 0.55, cy + R * 1.0, R * 0.5, -Math.PI / 2 + 0.2, 'gold');
    cornerOrnament(ctx, cx + R * 0.55, cy + R * 1.0, R * 0.5, Math.PI - 0.2, 'gold');
  }

  /** 主人公の肖像（フードの生存者・仮） */
  function drawPortrait(ctx, w, h, spec) {
    const r = rng(hash(spec.path));
    let g = ctx.createRadialGradient(w * 0.4, h * 0.35, 10, w / 2, h / 2, w * 0.75);
    g.addColorStop(0, '#3a1a14');
    g.addColorStop(1, '#070404');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    fog(ctx, w, h, h * 0.2, h * 0.9, 'rgba(160,40,30,A)', r, 6);
    // 肩とフード
    ctx.beginPath();
    ctx.moveTo(w * 0.05, h);
    ctx.bezierCurveTo(w * 0.1, h * 0.72, w * 0.25, h * 0.62, w * 0.33, h * 0.58);
    ctx.bezierCurveTo(w * 0.22, h * 0.4, w * 0.3, h * 0.12, w * 0.5, h * 0.1);
    ctx.bezierCurveTo(w * 0.72, h * 0.12, w * 0.8, h * 0.4, w * 0.68, h * 0.58);
    ctx.bezierCurveTo(w * 0.76, h * 0.62, w * 0.92, h * 0.72, w * 0.96, h);
    ctx.closePath();
    g = ctx.createLinearGradient(0, 0, w, 0);
    g.addColorStop(0, '#2a1c14');
    g.addColorStop(0.6, '#140c08');
    g.addColorStop(1, '#3a2418');
    ctx.fillStyle = g;
    ctx.fill();
    // 顔（下から照らされる）
    ctx.beginPath();
    ctx.ellipse(w * 0.5, h * 0.42, w * 0.13, h * 0.17, 0, 0, TAU);
    g = ctx.createLinearGradient(0, h * 0.28, 0, h * 0.6);
    g.addColorStop(0, '#120a08');
    g.addColorStop(0.55, '#6a4030');
    g.addColorStop(1, '#c08060');
    ctx.fillStyle = g;
    ctx.fill();
    // 目
    for (const ex of [0.45, 0.555]) {
      ctx.fillStyle = 'rgba(255,230,200,0.9)';
      ctx.beginPath();
      ctx.ellipse(w * ex, h * 0.415, 6, 2.6, 0, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#2a0e06';
      ctx.beginPath();
      ctx.arc(w * ex, h * 0.415, 2.4, 0, TAU);
      ctx.fill();
    }
    // 頬の傷
    ctx.strokeStyle = 'rgba(140,20,20,0.8)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(w * 0.56, h * 0.45);
    ctx.lineTo(w * 0.6, h * 0.5);
    ctx.stroke();
    glow(ctx, w * 0.5, h * 0.9, w * 0.45, 'rgba(255,140,60,A)', 0.35);
    vignette(ctx, w, h, 0.7, 0.45);
    tag(ctx, w, h, spec.file);
  }

  /** ボタン（9スライス用：角32px は引き伸ばされない） */
  function drawButton(ctx, w, h, spec) {
    const primary = spec.variant === 'primary';
    roundRectPath(ctx, 4, 4, w - 8, h - 8, 14);
    const g = ctx.createLinearGradient(0, 0, 0, h);
    if (primary) {
      g.addColorStop(0, 'rgba(140,24,22,0.98)');
      g.addColorStop(0.5, 'rgba(84,10,10,0.98)');
      g.addColorStop(1, 'rgba(40,4,4,0.98)');
    } else {
      g.addColorStop(0, 'rgba(46,36,30,0.96)');
      g.addColorStop(0.5, 'rgba(22,16,13,0.96)');
      g.addColorStop(1, 'rgba(12,9,7,0.96)');
    }
    ctx.fillStyle = g;
    ctx.fill();
    // 上半分の光沢
    ctx.save();
    roundRectPath(ctx, 4, 4, w - 8, h - 8, 14);
    ctx.clip();
    const hg = ctx.createLinearGradient(0, 4, 0, h * 0.5);
    hg.addColorStop(0, 'rgba(255,240,210,0.16)');
    hg.addColorStop(1, 'rgba(255,240,210,0)');
    ctx.fillStyle = hg;
    ctx.fillRect(0, 0, w, h * 0.5);
    ctx.restore();
    bevelStroke(ctx, () => roundRectPath(ctx, 5, 5, w - 10, h - 10, 13), 4, 'gold', [0, 0, w, h]);
    ctx.strokeStyle = 'rgba(217,178,106,0.35)';
    ctx.lineWidth = 1.5;
    roundRectPath(ctx, 12, 12, w - 24, h - 24, 8);
    ctx.stroke();
    // 角の小さな飾り
    for (const [x, y, rot] of [[6, 6, 0], [w - 6, 6, Math.PI / 2], [w - 6, h - 6, Math.PI], [6, h - 6, -Math.PI / 2]]) {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(rot);
      leaf(ctx, 3, 3, 22, Math.PI / 4, 'gold');
      ctx.restore();
    }
  }

  /** パネル（9スライス用：角110px） */
  function drawPanel(ctx, w, h) {
    roundRectPath(ctx, 10, 10, w - 20, h - 20, 22);
    let g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, 'rgba(28,21,17,0.94)');
    g.addColorStop(1, 'rgba(10,7,6,0.96)');
    ctx.fillStyle = g;
    ctx.fill();
    ctx.save();
    roundRectPath(ctx, 10, 10, w - 20, h - 20, 22);
    ctx.clip();
    g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w * 0.6);
    g.addColorStop(0, 'rgba(90,20,15,0.12)');
    g.addColorStop(1, 'rgba(0,0,0,0.25)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
    bevelStroke(ctx, () => roundRectPath(ctx, 14, 14, w - 28, h - 28, 20), 7, 'gold', [0, 0, w, h]);
    ctx.strokeStyle = 'rgba(217,178,106,0.4)';
    ctx.lineWidth = 2;
    roundRectPath(ctx, 28, 28, w - 56, h - 56, 12);
    ctx.stroke();
    const cs = 100;
    cornerOrnament(ctx, 18, 18, cs, 0, 'gold', 0);
    cornerOrnament(ctx, w - 18, 18, cs, Math.PI / 2, 'gold', 0);
    cornerOrnament(ctx, w - 18, h - 18, cs, Math.PI, 'gold', 0);
    cornerOrnament(ctx, 18, h - 18, cs, -Math.PI / 2, 'gold', 0);
  }

  function drawCardBack(ctx, w, h) {
    roundRectPath(ctx, 6, 6, w - 12, h - 12, 26);
    let g = ctx.createRadialGradient(w / 2, h / 2, 10, w / 2, h / 2, w * 0.8);
    g.addColorStop(0, '#5a0c0c');
    g.addColorStop(0.6, '#240404');
    g.addColorStop(1, '#0c0101');
    ctx.fillStyle = g;
    ctx.fill();
    // 放射状の模様
    ctx.save();
    roundRectPath(ctx, 6, 6, w - 12, h - 12, 26);
    ctx.clip();
    ctx.strokeStyle = 'rgba(255,190,120,0.08)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 48; i++) {
      const a = (i / 48) * TAU;
      ctx.beginPath();
      ctx.moveTo(w / 2, h / 2);
      ctx.lineTo(w / 2 + Math.cos(a) * w, h / 2 + Math.sin(a) * w);
      ctx.stroke();
    }
    ctx.restore();
    bevelStroke(ctx, () => roundRectPath(ctx, 14, 14, w - 28, h - 28, 22), 14, 'gold', [0, 0, w, h]);
    bevelStroke(ctx, () => roundRectPath(ctx, 40, 40, w - 80, h - 80, 14), 4, 'gold', [0, 0, w, h]);
    for (const [x, y, rot] of [[18, 18, 0], [w - 18, 18, Math.PI / 2], [w - 18, h - 18, Math.PI], [18, h - 18, -Math.PI / 2]]) cornerOrnament(ctx, x, y, 80, rot, 'gold');
    medallion(ctx, w / 2, h / 2, w * 0.28, 0, 'gold', 70);
    emblem(ctx, '👁️', w / 2, h / 2, w * 0.3, 'relief', 'gold', 'rgba(255,60,40,0.9)');
  }

  /** カードイラスト（劇的な光＋金の浮き彫りの紋章） */
  function drawCardArt(ctx, w, h, spec) {
    const r = rng(hash(spec.path));
    const hue = TYPE_HUE[spec.variant] ?? 0;
    let g = ctx.createRadialGradient(w / 2, h * 0.45, 10, w / 2, h / 2, w * 0.8);
    g.addColorStop(0, `hsl(${hue}, 55%, 30%)`);
    g.addColorStop(0.5, `hsl(${hue}, 60%, 12%)`);
    g.addColorStop(1, `hsl(${hue}, 50%, 4%)`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    // 背景の渦（魔力のうねり）
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 7; i++) {
      ctx.strokeStyle = `hsla(${hue + (r() - 0.5) * 40}, 80%, 60%, ${0.04 + r() * 0.07})`;
      ctx.lineWidth = 6 + r() * 26;
      ctx.beginPath();
      ctx.arc(w / 2 + (r() - 0.5) * 80, h / 2 + (r() - 0.5) * 80, 80 + r() * 220, r() * TAU, r() * TAU + 2);
      ctx.stroke();
    }
    ctx.restore();
    godRays(ctx, w / 2, h * 0.42, w * 0.9, TAU, 22, `hsla(${hue}, 90%, 70%, A)`, r, 0);
    glow(ctx, w / 2, h * 0.45, w * 0.45, `hsla(${hue}, 90%, 60%, A)`, 0.6);
    // 紋章
    emblem(ctx, spec.symbol, w / 2, h * 0.46, h * 0.52, 'relief', spec.variant === 'defense' ? 'silver' : 'gold', `hsla(${hue}, 100%, 60%, 0.95)`);
    // 火の粉
    for (let i = 0; i < 40; i++) {
      const px = r() * w;
      const py = r() * h;
      glow(ctx, px, py, 2 + r() * 6, `hsla(${hue + 20}, 100%, 70%, A)`, 0.8);
    }
    fog(ctx, w, h, h * 0.7, h, `hsla(${hue}, 40%, 30%, A)`, r, 6);
    vignette(ctx, w, h, 0.75, 0.45);
    tag(ctx, w, h, spec.file);
  }

  /** タイトルロゴ（金属の文字） */
  function drawLogo(ctx, w, h) {
    ctx.font = `900 ${h * 0.5}px "Cinzel", "Times New Roman", serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(200,0,0,0.9)';
    ctx.shadowBlur = 40;
    ctx.fillStyle = '#2a0000';
    ctx.fillText('DarkSurvive', w / 2, h * 0.5);
    ctx.shadowBlur = 0;
    ctx.fillStyle = metal(ctx, 0, h * 0.25, 0, h * 0.75, 'gold');
    ctx.fillText('DarkSurvive', w / 2, h * 0.48);
  }

  // =============================================================
  // 入口
  // =============================================================
  window.drawAsset = function (spec) {
    const canvas = canvasOf(spec.w, spec.h);
    const ctx = canvas.getContext('2d');
    const w = spec.w;
    const h = spec.h;
    switch (spec.type) {
      case 'background': drawBackground(ctx, w, h, spec); break;
      case 'enemy': drawEnemy(ctx, w, h, spec); break;
      case 'door': drawDoor(ctx, w, h, spec); break;
      case 'chest': drawChest(ctx, w, h, spec); break;
      case 'figure': drawFigure(ctx, w, h, spec); break;
      case 'object': drawAltarObject(ctx, w, h, spec); break;
      case 'medallionIcon': drawMedallionIcon(ctx, w, h, spec); break;
      case 'itemIcon': drawItemIcon(ctx, w, h, spec); break;
      case 'keyIcon': drawKeyIcon(ctx, w, h, spec); break;
      case 'coin': drawCoin(ctx, w, h, spec); break;
      case 'shield': drawShieldIcon(ctx, w, h, spec); break;
      case 'cardArt': drawCardArt(ctx, w, h, spec); break;
      case 'cardFrame': drawCardFrame(ctx, w, h, spec); break;
      case 'costGem': drawCostGem(ctx, w, h, spec); break;
      case 'apCrystal': drawApCrystal(ctx, w, h, spec); break;
      case 'endTurn': drawEndTurn(ctx, w, h, spec); break;
      case 'leaderFrame': drawLeaderFrame(ctx, w, h, spec); break;
      case 'portrait': drawPortrait(ctx, w, h, spec); break;
      case 'button': drawButton(ctx, w, h, spec); break;
      case 'panel': drawPanel(ctx, w, h, spec); break;
      case 'cardBack': drawCardBack(ctx, w, h, spec); break;
      case 'logo': drawLogo(ctx, w, h, spec); break;
    }
    return spec.path.endsWith('.webp') ? canvas.toDataURL('image/webp', 0.88) : canvas.toDataURL('image/png');
  };
})();
