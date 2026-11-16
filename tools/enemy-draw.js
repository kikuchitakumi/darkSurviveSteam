// =============================================================
// enemy-draw.js  【ツール：敵の仮画像（ブラウザ内で実行）】
// -------------------------------------------------------------
// generate-placeholders.ts から placeholder-draw.js の後に読み込まれる。
// 敵1体ごとに「設計図（DESIGNS）」を持ち、部品を組み合わせて描く。
//
// 目指す見た目：重厚なダークファンタジーのボス
//   - 頭は小さく肩は広く。見上げるような威圧感のあるシルエット
//   - 鈍い鉄の鎧・ぼろぼろの外套・巨大な武器
//   - 体の大部分は暗く沈め、背後からの逆光（リムライト）で輪郭を浮かせる
//   - 闇の中で光る目、足元の霧、舞い上がる火の粉
//
// 新しい敵を追加したら DESIGNS に1件足す（無ければ種類ごとの汎用デザインになる）。
// =============================================================
/* eslint-disable */
(function () {
  const { TAU, hash, rng, glow } = window.__pd;
  const lerp = (a, b, t) => a + (b - a) * t;
  const rgba = (c, a) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;
  const rgbaA = (c) => `rgba(${c[0]},${c[1]},${c[2]},A)`;

  // ゾーンごとの光（逆光・目・霧・火の粉）
  const ZONE_LIGHT = [
    { rim: [255, 150, 90], eye: [255, 80, 40], fog: [70, 50, 44], ember: [255, 140, 60] }, // 地下牢：松明
    { rim: [150, 255, 205], eye: [180, 255, 100], fog: [40, 70, 60], ember: [160, 255, 140] }, // 研究棟：薬液
    { rim: [255, 205, 150], eye: [255, 70, 100], fog: [70, 50, 64], ember: [255, 200, 120] }, // 礼拝堂：蝋燭
    { rim: [255, 175, 80], eye: [255, 190, 50], fog: [72, 56, 40], ember: [255, 160, 50] }, // 機関区画：炉
    { rim: [200, 150, 255], eye: [230, 150, 255], fog: [52, 40, 76], ember: [210, 160, 255] }, // 深淵
  ];

  // 素材の色（明・中・暗）
  const MATS = {
    steel: ['#80838a', '#2e3035', '#0a0b0d'],
    dsteel: ['#5a5c63', '#1e1f23', '#050506'],
    rust: ['#7e5538', '#3a261a', '#0d0806'],
    cloth: ['#34302e', '#171414', '#040303'],
    red: ['#661a1a', '#2c0a0a', '#0a0202'],
    purple: ['#3e2a52', '#1a1024', '#060309'],
    flesh: ['#a48676', '#523c34', '#160c0a'],
    pale: ['#c2b9a8', '#625b50', '#16140f'],
    green: ['#86937a', '#3c4734', '#0c100a'],
    bone: ['#e6dabe', '#938668', '#2a241a'],
    leather: ['#5a412e', '#2b1d13', '#0a0604'],
    gold: ['#dcae58', '#7a541c', '#1e1406'],
    brass: ['#c89c54', '#6c4e1e', '#1c1206'],
    shadow: ['#28222f', '#0e0b14', '#020104'],
    wax: ['#f2e8cc', '#b0a080', '#3a3226'],
    fur: ['#5c4e40', '#281f18', '#080605'],
    char: ['#54423a', '#211814', '#070504'],
    porcelain: ['#f2eee6', '#a6a096', '#2e2b26'],
    white: ['#e2dfd6', '#8f8c84', '#252420'],
    meat: ['#b0565a', '#5e1c22', '#1a0508'],
    stone: ['#77736e', '#36332f', '#0e0d0c'],
  };
  const METALLIC = { steel: 1, dsteel: 1, rust: 1, gold: 1, brass: 1 };
  const CLOTHY = { cloth: 1, red: 1, purple: 1, shadow: 1 };
  const FLESHY = { flesh: 1, pale: 1, green: 1, char: 1, meat: 1 };

  // ---------------------------------------------------------
  // 形の部品
  // ---------------------------------------------------------
  function bez(p0, p1, p2, p3, n = 20) {
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
  /** 折れ線に沿った太さのある帯（腕・脚・尾・柄） */
  function band(pts, w0, w1) {
    const L = [];
    const R = [];
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i];
      const q = pts[Math.min(pts.length - 1, i + 1)];
      const pr = pts[Math.max(0, i - 1)];
      const dx = q[0] - pr[0];
      const dy = q[1] - pr[1];
      const len = Math.hypot(dx, dy) || 1;
      const t = i / (pts.length - 1);
      const wd = typeof w1 === 'function' ? w1(t) : lerp(w0, w1, t);
      L.push([p[0] - (dy / len) * wd, p[1] + (dx / len) * wd]);
      R.push([p[0] + (dy / len) * wd, p[1] - (dx / len) * wd]);
    }
    return L.concat(R.reverse());
  }
  /**
   * 関節(b)を通る、筋肉の膨らみがある手足（a→b→c）
   * 前半（上腕・腿）と後半（前腕・脛）にそれぞれ膨らみを付け、関節で細くする
   */
  function limbCurve(a, b, c, wd, o = {}) {
    const C = [2 * b[0] - (a[0] + c[0]) / 2, 2 * b[1] - (a[1] + c[1]) / 2];
    const n = 22;
    const pts = [];
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const u = 1 - t;
      pts.push([u * u * a[0] + 2 * u * t * C[0] + t * t * c[0], u * u * a[1] + 2 * u * t * C[1] + t * t * c[1]]);
    }
    const taper = o.taper ?? 0.45;
    const bulge = o.bulge ?? 0.28;
    return band(pts, wd, (t) => wd * (1 - taper * t) * (1 + (t < 0.5 ? bulge * Math.sin(Math.PI * t * 2) : bulge * 0.6 * Math.sin(Math.PI * (t * 2 - 1)))));
  }
  const seg = (a, b, n = 6) => bez(a, [lerp(a[0], b[0], 0.33), lerp(a[1], b[1], 0.33)], [lerp(a[0], b[0], 0.66), lerp(a[1], b[1], 0.66)], b, n);
  function boxOf(pts) {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const [x, y] of pts) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
    return { x: x0, y: y0, w: Math.max(1, x1 - x0), h: Math.max(1, y1 - y0) };
  }
  function polyPath(ctx, pts) {
    ctx.beginPath();
    pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
    ctx.closePath();
  }
  function smoothPath(ctx, pts) {
    ctx.beginPath();
    const n = pts.length;
    for (let i = 0; i <= n; i++) {
      const p = pts[i % n];
      const q = pts[(i + 1) % n];
      const mx = (p[0] + q[0]) / 2;
      const my = (p[1] + q[1]) / 2;
      i ? ctx.quadraticCurveTo(p[0], p[1], mx, my) : ctx.moveTo(mx, my);
    }
    ctx.closePath();
  }
  function ellipsePts(cx, cy, rx, ry, n = 40, wob = 0, r = Math.random) {
    const ph = [r() * TAU, r() * TAU];
    const pts = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU;
      const k = 1 + wob * (0.6 * Math.sin(a * 3 + ph[0]) + 0.4 * Math.sin(a * 7 + ph[1]));
      pts.push([cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k]);
    }
    return pts;
  }

  // ---------------------------------------------------------
  // 陰影（素材の色 → 質感 → 下側の陰 → 逆光 → 輪郭）
  // ---------------------------------------------------------
  function texture(D, b, mat) {
    const { ctx, r } = D;
    if (METALLIC[mat]) {
      // 縦に走る鈍い反射
      const sx = b.x + b.w * (0.28 + r() * 0.12);
      const sg = ctx.createLinearGradient(sx - b.w * 0.08, 0, sx + b.w * 0.08, 0);
      sg.addColorStop(0, 'rgba(255,255,255,0)');
      sg.addColorStop(0.5, `rgba(235,240,255,${mat === 'rust' ? 0.12 : 0.22})`);
      sg.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = sg;
      ctx.fillRect(b.x, b.y, b.w, b.h);
      // 擦り傷
      ctx.lineWidth = 1;
      for (let i = 0; i < Math.min(30, (b.w * b.h) / 900); i++) {
        const x = b.x + r() * b.w;
        const y = b.y + r() * b.h;
        const l = 4 + r() * 14;
        const a = r() * TAU;
        ctx.strokeStyle = r() < 0.5 ? 'rgba(255,255,255,0.14)' : 'rgba(0,0,0,0.35)';
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l);
        ctx.stroke();
      }
      // 錆
      const rustN = mat === 'rust' ? 26 : mat === 'gold' || mat === 'brass' ? 0 : 8;
      for (let i = 0; i < rustN; i++) {
        ctx.fillStyle = `rgba(${120 + r() * 50},${50 + r() * 25},${18 + r() * 10},${0.15 + r() * 0.25})`;
        ctx.beginPath();
        ctx.ellipse(b.x + r() * b.w, b.y + r() * b.h, 3 + r() * 12, 2 + r() * 7, r() * 3, 0, TAU);
        ctx.fill();
      }
    } else if (CLOTHY[mat]) {
      // 布のひだ
      for (let i = 0; i < 9; i++) {
        const x = b.x + r() * b.w;
        ctx.strokeStyle = r() < 0.7 ? `rgba(0,0,0,${0.25 + r() * 0.3})` : 'rgba(255,255,255,0.05)';
        ctx.lineWidth = 2 + r() * 6;
        ctx.beginPath();
        ctx.moveTo(x, b.y + r() * b.h * 0.3);
        ctx.bezierCurveTo(x + (r() - 0.5) * 30, b.y + b.h * 0.4, x + (r() - 0.5) * 40, b.y + b.h * 0.7, x + (r() - 0.5) * 30, b.y + b.h);
        ctx.stroke();
      }
    } else if (FLESHY[mat]) {
      for (let i = 0; i < Math.min(40, (b.w * b.h) / 500); i++) {
        ctx.fillStyle = `rgba(${mat === 'green' ? '10,30,10' : '40,0,0'},${0.06 + r() * 0.14})`;
        ctx.beginPath();
        ctx.arc(b.x + r() * b.w, b.y + r() * b.h, 2 + r() * 7, 0, TAU);
        ctx.fill();
      }
      for (let i = 0; i < 8; i++) {
        let x = b.x + r() * b.w;
        let y = b.y + r() * b.h;
        ctx.strokeStyle = `rgba(${mat === 'green' ? '30,60,30' : '90,10,20'},${0.2 + r() * 0.3})`;
        ctx.lineWidth = 1 + r() * 1.5;
        ctx.beginPath();
        ctx.moveTo(x, y);
        for (let k = 0; k < 5; k++) { x += (r() - 0.5) * 22; y += (r() - 0.3) * 18; ctx.lineTo(x, y); }
        ctx.stroke();
      }
    } else if (mat === 'fur') {
      for (let i = 0; i < Math.min(160, (b.w * b.h) / 120); i++) {
        const x = b.x + r() * b.w;
        const y = b.y + r() * b.h;
        ctx.strokeStyle = r() < 0.6 ? 'rgba(0,0,0,0.35)' : 'rgba(255,230,200,0.08)';
        ctx.lineWidth = 1 + r();
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + 6 + r() * 8, y + 4 + r() * 10);
        ctx.stroke();
      }
    } else if (mat === 'bone' || mat === 'wax' || mat === 'porcelain' || mat === 'white' || mat === 'stone') {
      ctx.lineWidth = 1;
      for (let i = 0; i < 6; i++) {
        let x = b.x + r() * b.w;
        let y = b.y + r() * b.h;
        ctx.strokeStyle = 'rgba(30,20,10,0.45)';
        ctx.beginPath();
        ctx.moveTo(x, y);
        for (let k = 0; k < 4; k++) { x += (r() - 0.5) * 18; y += r() * 14; ctx.lineTo(x, y); }
        ctx.stroke();
      }
      if (mat === 'white') {
        // 血の染み
        for (let i = 0; i < 7; i++) {
          ctx.fillStyle = `rgba(110,10,10,${0.25 + r() * 0.35})`;
          ctx.beginPath();
          ctx.ellipse(b.x + r() * b.w, b.y + b.h * (0.3 + r() * 0.7), 4 + r() * 16, 3 + r() * 20, r(), 0, TAU);
          ctx.fill();
        }
      }
    }
  }

  function shade(D, path, b, mat, o = {}) {
    const { ctx, L } = D;
    const c = MATS[mat] || MATS.cloth;
    path();
    const g = ctx.createLinearGradient(b.x + b.w * 0.2, b.y, b.x + b.w * 0.8, b.y + b.h);
    g.addColorStop(0, c[0]);
    g.addColorStop(0.42, c[1]);
    g.addColorStop(1, c[2]);
    ctx.fillStyle = g;
    ctx.fill();
    ctx.save();
    path();
    ctx.clip();
    if (!o.plain) texture(D, b, mat);
    // 下側を闇に沈める
    const ao = ctx.createLinearGradient(0, b.y + b.h * 0.35, 0, b.y + b.h);
    ao.addColorStop(0, 'rgba(0,0,0,0)');
    ao.addColorStop(1, `rgba(0,0,0,${o.ao ?? 0.5})`);
    ctx.fillStyle = ao;
    ctx.fillRect(b.x - 2, b.y - 2, b.w + 4, b.h + 4);
    // 逆光（右上から）
    ctx.globalCompositeOperation = 'lighter';
    const rg = ctx.createLinearGradient(b.x, b.y + b.h, b.x + b.w, b.y);
    rg.addColorStop(0, rgba(L.rim, 0));
    rg.addColorStop(0.55, rgba(L.rim, 0));
    rg.addColorStop(1, rgba(L.rim, o.rim ?? (METALLIC[mat] ? 0.7 : 0.5)));
    path();
    ctx.strokeStyle = rg;
    ctx.lineWidth = o.rimW ?? 6;
    ctx.stroke();
    // 冷たい環境光（左上から、ごく弱く）
    const kg = ctx.createLinearGradient(b.x, b.y, b.x + b.w * 0.6, b.y + b.h * 0.6);
    kg.addColorStop(0, 'rgba(170,185,220,0.22)');
    kg.addColorStop(0.5, 'rgba(170,185,220,0)');
    path();
    ctx.strokeStyle = kg;
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.restore();
    path();
    ctx.strokeStyle = 'rgba(0,0,0,0.8)';
    ctx.lineWidth = 1.4;
    ctx.stroke();
  }
  /** 点列をそのまま陰影つきで塗る */
  function fillPts(D, pts, mat, o = {}) {
    const { ctx } = D;
    const path = o.smooth ? () => smoothPath(ctx, pts) : () => polyPath(ctx, pts);
    shade(D, path, boxOf(pts), mat, o);
  }
  function fillEllipse(D, cx, cy, rx, ry, mat, o = {}) {
    const { ctx } = D;
    shade(D, () => { ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, o.rot || 0, 0, TAU); }, { x: cx - rx, y: cy - ry, w: rx * 2, h: ry * 2 }, mat, o);
  }
  function line(D, a, b, color, wd) {
    const { ctx } = D;
    ctx.strokeStyle = color;
    ctx.lineWidth = wd;
    ctx.beginPath();
    ctx.moveTo(a[0], a[1]);
    ctx.lineTo(b[0], b[1]);
    ctx.stroke();
  }

  // ---------------------------------------------------------
  // 効果
  // ---------------------------------------------------------
  function eyes(D, pts, size, o = {}) {
    const { ctx, L } = D;
    const col = o.color || L.eye;
    for (const [x, y] of pts) {
      glow(ctx, x, y, size * 5, rgbaA(col), 0.55);
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = rgba(col, 0.95);
      ctx.beginPath();
      ctx.ellipse(x, y, size * (o.wide ?? 1.1), size * 0.6, o.tilt ?? 0, 0, TAU);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,250,220,0.95)';
      ctx.beginPath();
      ctx.ellipse(x, y, size * 0.45, size * 0.28, 0, 0, TAU);
      ctx.fill();
      ctx.restore();
    }
  }
  function embers(D, n, area) {
    const { ctx, r, L } = D;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < n; i++) {
      const x = area.x + r() * area.w;
      const y = area.y + r() * area.h;
      const s = 0.8 + r() * 2.2;
      glow(ctx, x, y, s * 5, rgbaA(L.ember), 0.35);
      ctx.fillStyle = rgba(L.ember, 0.9);
      ctx.beginPath();
      ctx.arc(x, y, s, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }
  function groundFog(D, y, spread) {
    const { ctx, w, r, L } = D;
    // 足元の濃い影
    const g = ctx.createRadialGradient(w / 2, y, 0, w / 2, y, w * 0.45 * spread);
    g.addColorStop(0, 'rgba(0,0,0,0.85)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(w / 2, y, w * 0.45 * spread, w * 0.06, 0, 0, TAU);
    ctx.fill();
    return () => {
      // 前景の霧（体の手前に薄く）
      ctx.save();
      for (let i = 0; i < 10; i++) {
        const fx = w * (0.1 + r() * 0.8);
        const fy = y - r() * w * 0.05;
        const rw = w * (0.12 + r() * 0.2) * spread;
        const fg = ctx.createRadialGradient(fx, fy, 0, fx, fy, rw);
        fg.addColorStop(0, rgba(L.fog, 0.22 + r() * 0.18));
        fg.addColorStop(1, rgba(L.fog, 0));
        ctx.fillStyle = fg;
        ctx.beginPath();
        ctx.ellipse(fx, fy, rw, rw * 0.3, 0, 0, TAU);
        ctx.fill();
      }
      ctx.restore();
    };
  }
  function aura(D, x, y, rad, a = 0.25) {
    glow(D.ctx, x, y, rad, rgbaA(D.L.rim), a);
  }
  function steam(D, x, y, n, s) {
    const { ctx, r } = D;
    ctx.save();
    for (let i = 0; i < n; i++) {
      const px = x + (r() - 0.5) * s * 1.4;
      const py = y - r() * s * 2.2;
      const rad = s * (0.25 + r() * 0.45);
      const g = ctx.createRadialGradient(px, py, 0, px, py, rad);
      g.addColorStop(0, `rgba(230,225,215,${0.18 + r() * 0.15})`);
      g.addColorStop(1, 'rgba(230,225,215,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(px, py, rad, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }
  function blood(D, x, y, n, len) {
    const { ctx, r } = D;
    for (let i = 0; i < n; i++) {
      const dx = x + (r() - 0.5) * len * 0.8;
      const dl = len * (0.3 + r() * 0.7);
      ctx.fillStyle = `rgba(${90 + r() * 40},0,0,0.9)`;
      ctx.beginPath();
      ctx.moveTo(dx - 2, y);
      ctx.lineTo(dx + 2, y);
      ctx.lineTo(dx + 2.6, y + dl);
      ctx.arc(dx, y + dl, 2.6, 0, Math.PI);
      ctx.closePath();
      ctx.fill();
    }
  }
  /** 牙の並んだ裂けた口 */
  function maw(D, cx, cy, mw, mh, o = {}) {
    const { ctx, r } = D;
    ctx.fillStyle = '#080000';
    ctx.beginPath();
    ctx.ellipse(cx, cy, mw / 2, mh / 2, o.rot || 0, 0, TAU);
    ctx.fill();
    glow(ctx, cx, cy, mw * 0.5, 'rgba(160,20,10,A)', 0.25);
    const n = Math.max(5, Math.round(mw / 9));
    for (const row of [-1, 1]) {
      for (let i = 0; i < n; i++) {
        const t = (i + 0.5) / n;
        const tx = cx - mw / 2 + mw * t;
        const edge = cy + row * (mh / 2) * Math.sqrt(Math.max(0, 1 - Math.pow(t * 2 - 1, 2)));
        const tl = mh * (0.3 + r() * 0.35) * (1 - Math.abs(t - 0.5));
        ctx.fillStyle = '#d8cdb2';
        ctx.beginPath();
        ctx.moveTo(tx - mw / n / 2.4, edge);
        ctx.lineTo(tx, edge - row * tl);
        ctx.lineTo(tx + mw / n / 2.4, edge);
        ctx.fill();
      }
    }
  }
  function chain(D, pts, s) {
    const { ctx } = D;
    let acc = 0;
    for (let i = 1; i < pts.length; i++) {
      const [x0, y0] = pts[i - 1];
      const [x1, y1] = pts[i];
      const d = Math.hypot(x1 - x0, y1 - y0);
      const a = Math.atan2(y1 - y0, x1 - x0);
      for (let t = 0; t < d; t += s * 1.5) {
        const x = x0 + Math.cos(a) * t;
        const y = y0 + Math.sin(a) * t;
        ctx.strokeStyle = 'rgba(0,0,0,0.85)';
        ctx.lineWidth = s * 0.55;
        ctx.beginPath();
        ctx.ellipse(x, y, s, s * 0.55, a + (acc % 2 ? Math.PI / 2 : 0) * 0.5, 0, TAU);
        ctx.stroke();
        ctx.strokeStyle = acc % 2 ? 'rgba(120,122,128,0.95)' : 'rgba(80,82,88,0.95)';
        ctx.lineWidth = s * 0.32;
        ctx.stroke();
        acc++;
      }
    }
  }
  function spike(D, x, y, a, len, wd, mat = 'dsteel') {
    const pts = [[x + Math.cos(a + Math.PI / 2) * wd, y + Math.sin(a + Math.PI / 2) * wd], [x + Math.cos(a) * len, y + Math.sin(a) * len], [x - Math.cos(a + Math.PI / 2) * wd, y - Math.sin(a + Math.PI / 2) * wd]];
    fillPts(D, pts, mat, { rimW: 3, plain: true });
  }
  function hornCurve(D, x, y, side, len, wd, up = 1, mat = 'bone') {
    const pts = bez([x, y], [x + side * len * 0.55, y - len * 0.15 * up], [x + side * len * 0.95, y - len * 0.5 * up], [x + side * len * 0.75, y - len * 0.95 * up], 16);
    fillPts(D, band(pts, wd, 0.5), mat, { rimW: 3 });
    // 節
    for (let i = 2; i < pts.length - 3; i += 2) {
      const [px, py] = pts[i];
      line(D, [px - wd * 0.6, py - wd * 0.2], [px + wd * 0.6, py + wd * 0.2], 'rgba(40,30,20,0.4)', 1.2);
    }
  }
  /** ぼろぼろの裾をもつ布（左上→左下→ギザギザの裾→右下→右上） */
  function tatter(D, tl, tr, bl, br, o = {}) {
    const { r } = D;
    const pts = [];
    const left = bez(tl, [lerp(tl[0], bl[0], 0.3) - (o.billow || 0), lerp(tl[1], bl[1], 0.35)], [lerp(tl[0], bl[0], 0.7) - (o.billow || 0), lerp(tl[1], bl[1], 0.7)], bl, 10);
    pts.push(...left);
    const n = o.teeth || 12;
    const depth = o.depth || 40;
    for (let i = 1; i < n; i++) {
      const t = i / n;
      const x = lerp(bl[0], br[0], t);
      const y = lerp(bl[1], br[1], t);
      pts.push([x + (r() - 0.5) * 8, y - (i % 2 ? depth * (0.4 + r() * 0.8) : -depth * r() * 0.35)]);
    }
    const right = bez(br, [lerp(br[0], tr[0], 0.3) + (o.billow || 0), lerp(br[1], tr[1], 0.3)], [lerp(br[0], tr[0], 0.65) + (o.billow || 0), lerp(br[1], tr[1], 0.65)], tr, 10);
    pts.push(...right);
    if (o.topCurve) pts.push([lerp(tl[0], tr[0], 0.5), Math.min(tl[1], tr[1]) - o.topCurve]);
    return pts;
  }

  // ---------------------------------------------------------
  // 武器
  // ---------------------------------------------------------
  function greatsword(D, hilt, tip, wd, o = {}) {
    const { ctx } = D;
    const a = Math.atan2(tip[1] - hilt[1], tip[0] - hilt[0]);
    const len = Math.hypot(tip[0] - hilt[0], tip[1] - hilt[1]);
    const nx = Math.cos(a + Math.PI / 2);
    const ny = Math.sin(a + Math.PI / 2);
    const P = (t, s) => [hilt[0] + Math.cos(a) * len * t + nx * wd * s, hilt[1] + Math.sin(a) * len * t + ny * wd * s];
    const blade = [P(0, -1), P(0.82, -0.85), P(1, 0), P(0.82, 0.85), P(0, 1)];
    fillPts(D, blade, o.mat || 'steel', { rim: 0.8 });
    // 樋（中央の溝）
    line(D, P(0.02, 0), P(0.7, 0), 'rgba(0,0,0,0.55)', wd * 0.25);
    // 刃こぼれ
    ctx.fillStyle = 'rgba(0,0,0,0.9)';
    for (let i = 0; i < 4; i++) {
      const t = 0.2 + D.r() * 0.6;
      const p = P(t, 1);
      ctx.beginPath();
      ctx.arc(p[0], p[1], wd * 0.18, 0, TAU);
      ctx.fill();
    }
    if (o.glowing) {
      glow(ctx, P(0.5, 0)[0], P(0.5, 0)[1], len * 0.45, rgbaA(D.L.rim), 0.25);
    }
    // 鍔・柄・柄頭
    const g0 = [hilt[0] - nx * wd * 2.6, hilt[1] - ny * wd * 2.6];
    const g1 = [hilt[0] + nx * wd * 2.6, hilt[1] + ny * wd * 2.6];
    fillPts(D, band(seg(g0, g1), wd * 0.38, wd * 0.38), 'dsteel', { rimW: 3 });
    const gripEnd = [hilt[0] - Math.cos(a) * wd * 4.5, hilt[1] - Math.sin(a) * wd * 4.5];
    fillPts(D, band(seg(hilt, gripEnd), wd * 0.32, wd * 0.32), 'leather', { rimW: 2 });
    fillEllipse(D, gripEnd[0], gripEnd[1], wd * 0.55, wd * 0.55, 'dsteel', { rimW: 2 });
  }
  function cleaver(D, grip, tip, wd) {
    const a = Math.atan2(tip[1] - grip[1], tip[0] - grip[0]);
    const len = Math.hypot(tip[0] - grip[0], tip[1] - grip[1]);
    const nx = Math.cos(a + Math.PI / 2);
    const ny = Math.sin(a + Math.PI / 2);
    const P = (t, s) => [grip[0] + Math.cos(a) * len * t + nx * wd * s, grip[1] + Math.sin(a) * len * t + ny * wd * s];
    // 柄
    fillPts(D, band(seg(P(-0.12, 0), P(0.12, 0)), wd * 0.12, wd * 0.12), 'leather', { rimW: 2 });
    const blade = [P(0.1, -0.35), P(0.95, -0.55), P(1.0, -0.1), P(0.96, 1.0), P(0.12, 0.7)];
    fillPts(D, blade, 'rust', { rim: 0.6 });
    // 刃先の血
    const { ctx, r } = D;
    ctx.save();
    polyPath(ctx, blade);
    ctx.clip();
    for (let i = 0; i < 14; i++) {
      const p = P(0.15 + r() * 0.8, 0.6 + r() * 0.4);
      ctx.fillStyle = `rgba(${80 + r() * 50},0,0,${0.4 + r() * 0.4})`;
      ctx.beginPath();
      ctx.ellipse(p[0], p[1], 4 + r() * 12, 3 + r() * 8, r(), 0, TAU);
      ctx.fill();
    }
    ctx.restore();
    // 穴
    const hole = P(0.85, -0.2);
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.arc(hole[0], hole[1], wd * 0.12, 0, TAU);
    ctx.fill();
  }
  function polearm(D, bottom, top, wd, head, o = {}) {
    const { ctx } = D;
    fillPts(D, band(seg(bottom, top, 4), wd, wd * 0.9), o.poleMat || 'leather', { rimW: 3 });
    const a = Math.atan2(top[1] - bottom[1], top[0] - bottom[0]);
    const ux = Math.cos(a), uy = Math.sin(a);
    const nx = Math.cos(a + Math.PI / 2), ny = Math.sin(a + Math.PI / 2);
    const T = (t, s) => [top[0] + ux * t + nx * s, top[1] + uy * t + ny * s];
    const S = wd * 10;
    if (head === 'halberd' || head === 'spear') {
      fillPts(D, [T(-S * 0.1, -wd * 1.4), T(S * 0.9, 0), T(-S * 0.1, wd * 1.4)], 'steel', { rim: 0.8 });
      if (head === 'halberd') {
        // 斧刃（片側）と鉤爪（反対側）
        fillPts(D, [T(-S * 0.55, wd), T(-S * 0.75, S * 0.55), T(-S * 0.25, S * 0.85), T(-S * 0.05, S * 0.55), T(-S * 0.1, wd)], o.headMat || 'steel', { rim: 0.8 });
        fillPts(D, [T(-S * 0.4, -wd), T(-S * 0.15, -S * 0.5), T(-S * 0.25, -wd)], 'dsteel');
      }
    } else if (head === 'scythe') {
      const pts = bez(T(0, 0), T(S * 0.1, -S * 0.6), T(-S * 0.2, -S * 1.5), T(-S * 0.9, -S * 1.9), 18);
      fillPts(D, band(pts, wd * 1.6, (t) => wd * (1.8 - t * 1.7) * (t < 0.15 ? 0.8 : 1)), o.headMat || 'dsteel', { rim: 0.9 });
    } else if (head === 'hammer') {
      const hp = [T(-S * 0.2, -S * 0.55), T(S * 0.35, -S * 0.55), T(S * 0.35, S * 0.55), T(-S * 0.2, S * 0.55)];
      fillPts(D, hp, o.headMat || 'dsteel', { rim: 0.7 });
      for (const s of [-0.5, 0, 0.5]) spike(D, ...T(S * 0.08, S * s * 0.9), a, S * 0.55, wd * 0.8);
      if (o.ember) glow(ctx, ...T(S * 0.1, 0), S * 1.6, 'rgba(255,120,30,A)', 0.4);
    } else if (head === 'eye') {
      // 司祭の杖：輪と浮かぶ眼
      const c = T(S * 0.5, 0);
      ctx.strokeStyle = 'rgba(0,0,0,0.9)';
      ctx.lineWidth = wd * 1.4;
      ctx.beginPath();
      ctx.arc(c[0], c[1], S * 0.55, 0, TAU);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(200,160,90,0.95)';
      ctx.lineWidth = wd * 0.8;
      ctx.stroke();
      for (let k = 0; k < 8; k++) {
        const aa = (k / 8) * TAU;
        spike(D, c[0] + Math.cos(aa) * S * 0.55, c[1] + Math.sin(aa) * S * 0.55, aa, S * 0.35, wd * 0.6, 'gold');
      }
      aura(D, c[0], c[1], S * 2.2, 0.5);
      fillEllipse(D, c[0], c[1], S * 0.3, S * 0.3, 'pale', { plain: true });
      eyes(D, [c], S * 0.16, { wide: 1 });
    } else if (head === 'lantern') {
      const c = T(-S * 0.2, S * 0.35);
      line(D, top, [c[0], c[1] - S * 0.4], 'rgba(30,30,30,0.95)', 2);
      glow(ctx, c[0], c[1], S * 2.4, 'rgba(255,180,90,A)', 0.55);
      fillPts(D, [[c[0] - S * 0.25, c[1] - S * 0.4], [c[0] + S * 0.25, c[1] - S * 0.4], [c[0] + S * 0.3, c[1] + S * 0.35], [c[0] - S * 0.3, c[1] + S * 0.35]], 'dsteel', { plain: true });
      ctx.fillStyle = 'rgba(255,220,140,0.95)';
      ctx.fillRect(c[0] - S * 0.18, c[1] - S * 0.25, S * 0.36, S * 0.5);
    }
  }
  function flail(D, hand, ball, s) {
    const pts = bez(hand, [hand[0], hand[1] + s * 2], [ball[0] - s, ball[1] - s * 2], ball, 12);
    chain(D, pts, s * 0.22);
    fillEllipse(D, ball[0], ball[1], s, s, 'dsteel', { rim: 0.8 });
    for (let k = 0; k < 9; k++) {
      const a = (k / 9) * TAU + 0.3;
      spike(D, ball[0] + Math.cos(a) * s * 0.9, ball[1] + Math.sin(a) * s * 0.9, a, s * 0.6, s * 0.18);
    }
  }
  function scissors(D, pivot, tip, wd) {
    const a = Math.atan2(tip[1] - pivot[1], tip[0] - pivot[0]);
    const len = Math.hypot(tip[0] - pivot[0], tip[1] - pivot[1]);
    for (const off of [-0.13, 0.13]) {
      const aa = a + off;
      const nx = Math.cos(aa + Math.PI / 2), ny = Math.sin(aa + Math.PI / 2);
      const P = (t, s) => [pivot[0] + Math.cos(aa) * len * t + nx * wd * s, pivot[1] + Math.sin(aa) * len * t + ny * wd * s];
      fillPts(D, [P(-0.05, -1), P(0.95, -0.15), P(1, 0.3), P(-0.05, 0.9)], 'steel', { rim: 0.85 });
      // 持ち手の輪
      const ring = P(-0.28, off < 0 ? -1.4 : 1.4);
      const { ctx } = D;
      ctx.strokeStyle = 'rgba(0,0,0,0.9)';
      ctx.lineWidth = wd * 0.8;
      ctx.beginPath();
      ctx.ellipse(ring[0], ring[1], wd * 1.3, wd * 0.9, aa, 0, TAU);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(110,112,118,0.95)';
      ctx.lineWidth = wd * 0.45;
      ctx.stroke();
    }
    fillEllipse(D, pivot[0], pivot[1], wd * 0.5, wd * 0.5, 'brass', { plain: true });
    blood(D, tip[0] - 6, tip[1] - 30, 3, 28);
  }

  // ---------------------------------------------------------
  // 頭
  // ---------------------------------------------------------
  function head(D, type, hx, hy, R, o = {}) {
    const { ctx, r } = D;
    const eyeS = R * 0.16;
    switch (type) {
      case 'greathelm':
      case 'bucket':
      case 'horned':
      case 'crown': {
        const rust = o.mat || (type === 'bucket' ? 'rust' : 'dsteel');
        const top = hy - R * 1.25;
        const bot = hy + R * 1.05;
        const pts = [[hx - R * 0.95, top + R * 0.25], [hx - R * 0.7, top], [hx + R * 0.7, top], [hx + R * 0.95, top + R * 0.25], [hx + R * 1.05, bot - R * 0.3], [hx + R * 0.55, bot], [hx - R * 0.55, bot], [hx - R * 1.05, bot - R * 0.3]];
        fillPts(D, pts, rust, { rim: 0.85, rimW: 4 });
        // 中央の稜線
        line(D, [hx, top + 2], [hx, bot - 2], 'rgba(255,255,255,0.12)', 2);
        // 目のスリット（T字）
        ctx.fillStyle = '#000';
        ctx.fillRect(hx - R * 0.8, hy - R * 0.22, R * 1.6, R * 0.2);
        ctx.fillRect(hx - R * 0.09, hy - R * 0.22, R * 0.18, R * 0.85);
        eyes(D, [[hx - R * 0.38, hy - R * 0.12], [hx + R * 0.38, hy - R * 0.12]], eyeS, { wide: 1.6 });
        // 通気孔
        ctx.fillStyle = 'rgba(0,0,0,0.85)';
        for (let i = 0; i < 6; i++) for (const s of [-1, 1]) {
          ctx.beginPath();
          ctx.arc(hx + s * R * (0.28 + (i % 3) * 0.15), hy + R * (0.32 + Math.floor(i / 3) * 0.18), R * 0.045, 0, TAU);
          ctx.fill();
        }
        if (type === 'horned') {
          hornCurve(D, hx - R * 0.8, top + R * 0.35, -1, R * 2.4, R * 0.28);
          hornCurve(D, hx + R * 0.8, top + R * 0.35, 1, R * 2.4, R * 0.28);
        }
        if (type === 'crown') crown(D, hx, top + R * 0.15, R * 1.05, R * 0.9);
        if (o.plume) {
          // 兜飾り（ぼろぼろの房）
          const pp = bez([hx, top], [hx + R * 0.4, top - R * 1.2], [hx + R * 1.6, top - R * 0.6], [hx + R * 2.4, top + R * 1.8], 16);
          fillPts(D, band(pp, R * 0.25, (t) => R * (0.25 + Math.sin(t * Math.PI) * 0.35)), 'red', { plain: true });
        }
        break;
      }
      case 'mask': {
        // 革の頭巾＋鉄仮面
        fillPts(D, ellipsePts(hx, hy - R * 0.05, R * 1.15, R * 1.3, 30, 0.02, r), 'leather', { rimW: 4 });
        const pts = ellipsePts(hx, hy + R * 0.08, R * 0.85, R * 1.05, 30, 0, r);
        fillPts(D, pts, 'rust', { rim: 0.8 });
        ctx.fillStyle = '#000';
        for (const s of [-1, 1]) { ctx.beginPath(); ctx.arc(hx + s * R * 0.33, hy - R * 0.12, R * 0.17, 0, TAU); ctx.fill(); }
        eyes(D, [[hx - R * 0.33, hy - R * 0.12], [hx + R * 0.33, hy - R * 0.12]], eyeS, { wide: 1 });
        for (let i = 0; i < 5; i++) line(D, [hx - R * 0.35 + i * R * 0.175, hy + R * 0.35], [hx - R * 0.35 + i * R * 0.175, hy + R * 0.75], 'rgba(0,0,0,0.85)', R * 0.07);
        ctx.fillStyle = 'rgba(200,190,170,0.8)';
        for (const [px, py] of [[-0.7, -0.5], [0.7, -0.5], [-0.75, 0.4], [0.75, 0.4], [0, -0.85]]) { ctx.beginPath(); ctx.arc(hx + px * R, hy + py * R, R * 0.06, 0, TAU); ctx.fill(); }
        break;
      }
      case 'executioner': {
        // 尖り頭巾
        const pts = [[hx, hy - R * 2.6], [hx + R * 1.15, hy + R * 0.6], [hx + R * 1.5, hy + R * 1.6], [hx - R * 1.5, hy + R * 1.6], [hx - R * 1.15, hy + R * 0.6]];
        fillPts(D, pts, o.mat || 'red', { smooth: false, rim: 0.6 });
        ctx.fillStyle = '#000';
        for (const s of [-1, 1]) { ctx.beginPath(); ctx.ellipse(hx + s * R * 0.4, hy + R * 0.05, R * 0.24, R * 0.14, s * 0.25, 0, TAU); ctx.fill(); }
        eyes(D, [[hx - R * 0.4, hy + R * 0.05], [hx + R * 0.4, hy + R * 0.05]], eyeS * 1.1);
        break;
      }
      case 'hood':
      case 'mitre': {
        if (o.halo) halo(D, hx, hy - R * 0.3, R * 2.6);
        const pts = [[hx, hy - R * 1.9], [hx + R * 1.2, hy - R * 0.9], [hx + R * 1.35, hy + R * 0.6], [hx + R * 1.7, hy + R * 1.6], [hx - R * 1.7, hy + R * 1.6], [hx - R * 1.35, hy + R * 0.6], [hx - R * 1.2, hy - R * 0.9]];
        fillPts(D, pts, o.mat || 'cloth', { smooth: true, rim: 0.6 });
        if (type === 'mitre') {
          const mp = [[hx - R * 0.85, hy - R * 1.1], [hx - R * 0.6, hy - R * 3.0], [hx, hy - R * 3.9], [hx + R * 0.6, hy - R * 3.0], [hx + R * 0.85, hy - R * 1.1]];
          fillPts(D, mp, 'purple', { rim: 0.7 });
          line(D, [hx, hy - R * 3.7], [hx, hy - R * 1.2], 'rgba(220,180,100,0.8)', R * 0.12);
          line(D, [hx - R * 0.5, hy - R * 2.3], [hx + R * 0.5, hy - R * 2.3], 'rgba(220,180,100,0.8)', R * 0.12);
        }
        // 顔は闇
        ctx.fillStyle = '#020102';
        ctx.beginPath();
        ctx.ellipse(hx, hy + R * 0.15, R * 0.78, R * 0.95, 0, 0, TAU);
        ctx.fill();
        const ne = o.eyes || 2;
        const ep = [];
        for (let i = 0; i < ne; i++) {
          if (ne <= 2) ep.push([hx + (i ? 1 : -1) * R * 0.3, hy + R * 0.05]);
          else ep.push([hx + (r() - 0.5) * R * 1.0, hy + (r() - 0.4) * R * 1.1]);
        }
        eyes(D, ep, eyeS * (ne > 2 ? 0.7 : 1));
        break;
      }
      case 'skull':
      case 'thorns': {
        if (o.halo) halo(D, hx, hy - R * 0.3, R * 2.4, true);
        const pts = ellipsePts(hx, hy - R * 0.1, R * 0.85, R * 1.05, 30, 0.02, r);
        fillPts(D, pts, 'bone', { rimW: 3 });
        fillPts(D, [[hx - R * 0.55, hy + R * 0.5], [hx + R * 0.55, hy + R * 0.5], [hx + R * 0.35, hy + R * 1.25], [hx - R * 0.35, hy + R * 1.25]], 'bone', { plain: true });
        ctx.fillStyle = '#050202';
        for (const s of [-1, 1]) { ctx.beginPath(); ctx.ellipse(hx + s * R * 0.35, hy - R * 0.05, R * 0.26, R * 0.3, s * 0.2, 0, TAU); ctx.fill(); }
        ctx.beginPath();
        ctx.moveTo(hx, hy + R * 0.25); ctx.lineTo(hx - R * 0.12, hy + R * 0.48); ctx.lineTo(hx + R * 0.12, hy + R * 0.48); ctx.fill();
        for (let i = 0; i < 6; i++) line(D, [hx - R * 0.38 + i * R * 0.15, hy + R * 0.7], [hx - R * 0.38 + i * R * 0.15, hy + R * 1.05], 'rgba(0,0,0,0.6)', 1.5);
        eyes(D, [[hx - R * 0.35, hy - R * 0.02], [hx + R * 0.35, hy - R * 0.02]], eyeS * 0.8, { wide: 0.8 });
        if (type === 'thorns') {
          ctx.strokeStyle = 'rgba(40,25,15,0.95)';
          ctx.lineWidth = R * 0.1;
          for (let k = 0; k < 3; k++) {
            ctx.beginPath();
            ctx.ellipse(hx, hy - R * 0.75 + k * 3, R * 0.95, R * 0.28, (r() - 0.5) * 0.2, 0, TAU);
            ctx.stroke();
          }
          for (let k = 0; k < 12; k++) {
            const a = (k / 12) * TAU;
            spike(D, hx + Math.cos(a) * R * 0.95, hy - R * 0.75 + Math.sin(a) * R * 0.28, a - 0.6, R * 0.35, R * 0.05, 'leather');
          }
          blood(D, hx - R * 0.2, hy - R * 0.5, 3, R * 0.8);
        }
        break;
      }
      case 'nurse': {
        // うなだれた頭・長い黒髪・縫われた口・看護帽
        const hair = tatter(D, [hx - R * 1.0, hy - R * 0.8], [hx + R * 1.0, hy - R * 0.8], [hx - R * 1.35, hy + R * 2.6], [hx + R * 1.35, hy + R * 2.6], { teeth: 14, depth: R * 0.9, topCurve: R * 0.6 });
        fillPts(D, hair, 'shadow', { rim: 0.4 });
        fillPts(D, ellipsePts(hx, hy + R * 0.1, R * 0.7, R * 0.95, 30, 0, r), 'pale', { rimW: 3 });
        // 包帯
        ctx.strokeStyle = 'rgba(220,210,190,0.9)';
        ctx.lineWidth = R * 0.2;
        ctx.beginPath(); ctx.moveTo(hx - R * 0.75, hy - R * 0.35); ctx.lineTo(hx + R * 0.7, hy + R * 0.05); ctx.stroke();
        eyes(D, [[hx - R * 0.28, hy - R * 0.05]], eyeS, {});
        line(D, [hx - R * 0.35, hy + R * 0.55], [hx + R * 0.35, hy + R * 0.55], 'rgba(40,0,0,0.9)', 2);
        for (let i = 0; i < 6; i++) line(D, [hx - R * 0.3 + i * R * 0.12, hy + R * 0.45], [hx - R * 0.26 + i * R * 0.12, hy + R * 0.66], 'rgba(20,10,10,0.95)', 1.5);
        blood(D, hx, hy + R * 0.6, 2, R * 0.6);
        const cap = [[hx - R * 0.7, hy - R * 0.75], [hx - R * 0.55, hy - R * 1.35], [hx + R * 0.55, hy - R * 1.35], [hx + R * 0.7, hy - R * 0.75]];
        fillPts(D, cap, 'white', { plain: true });
        ctx.fillStyle = 'rgba(120,10,10,0.85)';
        ctx.fillRect(hx - R * 0.06, hy - R * 1.25, R * 0.12, R * 0.38);
        ctx.fillRect(hx - R * 0.19, hy - R * 1.12, R * 0.38, R * 0.12);
        break;
      }
      case 'goggles': {
        fillPts(D, ellipsePts(hx, hy, R * 0.85, R * 1.05, 30, 0.03, r), 'pale', { rimW: 3 });
        // 包帯
        ctx.strokeStyle = 'rgba(200,190,170,0.85)';
        ctx.lineWidth = R * 0.16;
        for (let k = 0; k < 4; k++) { ctx.beginPath(); ctx.moveTo(hx - R * 0.9, hy - R * 0.8 + k * R * 0.28); ctx.lineTo(hx + R * 0.9, hy - R * 0.6 + k * R * 0.3); ctx.stroke(); }
        // マスク
        fillPts(D, [[hx - R * 0.7, hy + R * 0.2], [hx + R * 0.7, hy + R * 0.2], [hx + R * 0.5, hy + R * 0.95], [hx - R * 0.5, hy + R * 0.95]], 'white', { plain: true });
        for (const s of [-1, 1]) {
          fillEllipse(D, hx + s * R * 0.38, hy - R * 0.15, R * 0.3, R * 0.3, 'brass', { plain: true });
          ctx.fillStyle = '#000';
          ctx.beginPath(); ctx.arc(hx + s * R * 0.38, hy - R * 0.15, R * 0.21, 0, TAU); ctx.fill();
        }
        eyes(D, [[hx - R * 0.38, hy - R * 0.15], [hx + R * 0.38, hy - R * 0.15]], R * 0.17, { wide: 1 });
        break;
      }
      case 'sack': {
        const pts = ellipsePts(hx, hy - R * 0.1, R * 1.0, R * 1.15, 26, 0.06, r);
        fillPts(D, pts, 'leather', { rimW: 4 });
        ctx.strokeStyle = 'rgba(0,0,0,0.6)';
        ctx.lineWidth = 2;
        for (const s of [-1, 1]) {
          const ex = hx + s * R * 0.4;
          const ey = hy - R * 0.15;
          line(D, [ex - R * 0.15, ey - R * 0.15], [ex + R * 0.15, ey + R * 0.15], 'rgba(10,5,0,0.95)', 3);
          line(D, [ex + R * 0.15, ey - R * 0.15], [ex - R * 0.15, ey + R * 0.15], 'rgba(10,5,0,0.95)', 3);
        }
        eyes(D, [[hx + R * 0.05, hy + R * 0.35]], eyeS, { wide: 1 });
        // 首の縄
        ctx.strokeStyle = 'rgba(120,95,60,0.95)';
        ctx.lineWidth = R * 0.14;
        ctx.beginPath(); ctx.ellipse(hx, hy + R * 0.95, R * 0.8, R * 0.18, 0, 0, TAU); ctx.stroke();
        break;
      }
      case 'faceless': {
        fillPts(D, ellipsePts(hx, hy, R * 0.85, R * 1.1, 30, 0.04, r), o.mat || 'flesh', { rimW: 3 });
        // 縦に裂けた口
        maw(D, hx, hy + R * 0.1, R * 0.6, R * 1.3);
        if (o.eyes) eyes(D, [[hx - R * 0.5, hy - R * 0.6], [hx + R * 0.45, hy - R * 0.4], [hx + R * 0.1, hy - R * 0.85]], eyeS * 0.7);
        break;
      }
      case 'split': {
        // 裂けた頭から触手と眼
        for (const s of [-1, 1]) {
          const pts = [[hx, hy + R], [hx + s * R * 0.9, hy + R * 0.5], [hx + s * R * 1.0, hy - R * 0.4], [hx + s * R * 0.55, hy - R * 1.05], [hx + s * R * 0.2, hy - R * 0.6]];
          fillPts(D, pts, 'pale', { smooth: true, rimW: 3 });
        }
        for (let k = 0; k < 5; k++) {
          const a = -Math.PI / 2 + (k - 2) * 0.35;
          const tp = bez([hx, hy], [hx + Math.cos(a) * R, hy + Math.sin(a) * R * 1.5], [hx + Math.cos(a) * R * 2 + (r() - 0.5) * R, hy + Math.sin(a) * R * 2.4], [hx + Math.cos(a) * R * 2.2, hy + Math.sin(a) * R * 3.2], 14);
          fillPts(D, band(tp, R * 0.2, 1), 'meat', { rimW: 3 });
        }
        eyes(D, [[hx, hy - R * 0.1], [hx - R * 0.1, hy + R * 0.45]], eyeS * 1.2, { wide: 0.9 });
        break;
      }
      case 'marionette': {
        fillPts(D, ellipsePts(hx, hy, R * 0.85, R * 1.1, 30, 0, r), 'porcelain', { rimW: 3 });
        // ひび
        ctx.strokeStyle = 'rgba(20,10,10,0.85)';
        ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(hx + R * 0.2, hy - R * 1.1); ctx.lineTo(hx + R * 0.05, hy - R * 0.5); ctx.lineTo(hx + R * 0.3, hy - R * 0.1); ctx.lineTo(hx + R * 0.15, hy + R * 0.4); ctx.stroke();
        ctx.fillStyle = '#000';
        for (const s of [-1, 1]) { ctx.beginPath(); ctx.ellipse(hx + s * R * 0.32, hy - R * 0.1, R * 0.17, R * 0.24, 0, 0, TAU); ctx.fill(); }
        eyes(D, [[hx + R * 0.32, hy - R * 0.08]], eyeS * 0.8, { wide: 0.7 });
        // 描かれた笑み
        ctx.strokeStyle = 'rgba(130,10,20,0.95)';
        ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.arc(hx, hy + R * 0.2, R * 0.5, 0.25, Math.PI - 0.25); ctx.stroke();
        // 頬の紅と涙
        line(D, [hx - R * 0.32, hy + R * 0.12], [hx - R * 0.34, hy + R * 0.55], 'rgba(20,10,30,0.8)', 2);
        break;
      }
      case 'wax': {
        // 溶けた蝋燭の束が頭
        fillPts(D, ellipsePts(hx, hy, R * 0.9, R * 1.0, 30, 0.08, r), 'wax', { rimW: 3 });
        for (let k = 0; k < 5; k++) {
          const cx = hx + (k - 2) * R * 0.38;
          const ch = R * (0.8 + r() * 1.2);
          const cy = hy - R * 0.6 - ch;
          fillPts(D, [[cx - R * 0.14, hy - R * 0.5], [cx - R * 0.14, cy], [cx + R * 0.14, cy], [cx + R * 0.14, hy - R * 0.5]], 'wax', { plain: true, rimW: 2 });
          flameTip(D, cx, cy - 2, R * 0.28);
        }
        ctx.fillStyle = '#060303';
        for (const s of [-1, 1]) { ctx.beginPath(); ctx.ellipse(hx + s * R * 0.32, hy, R * 0.2, R * 0.3, 0, 0, TAU); ctx.fill(); }
        eyes(D, [[hx - R * 0.32, hy], [hx + R * 0.32, hy]], eyeS * 0.8);
        // 垂れる蝋
        for (let k = 0; k < 6; k++) {
          const dx = hx + (r() - 0.5) * R * 1.6;
          fillPts(D, band(seg([dx, hy + R * 0.5], [dx, hy + R * (0.9 + r() * 0.9)]), R * 0.07, R * 0.1), 'wax', { plain: true, rimW: 1 });
        }
        break;
      }
      case 'bell': {
        // 鐘そのものが頭（中は闇と眼）
        const bp = [[hx - R * 0.6, hy - R * 1.4], [hx + R * 0.6, hy - R * 1.4], [hx + R * 0.95, hy + R * 0.3], [hx + R * 1.5, hy + R * 1.2], [hx - R * 1.5, hy + R * 1.2], [hx - R * 0.95, hy + R * 0.3]];
        fillPts(D, bp, 'brass', { smooth: true, rim: 0.9 });
        ctx.fillStyle = '#000';
        ctx.beginPath(); ctx.ellipse(hx, hy + R * 1.15, R * 1.35, R * 0.35, 0, 0, TAU); ctx.fill();
        eyes(D, [[hx - R * 0.45, hy + R * 1.12], [hx + R * 0.45, hy + R * 1.12]], eyeS);
        fillEllipse(D, hx, hy - R * 1.55, R * 0.3, R * 0.22, 'brass', { plain: true });
        break;
      }
      default: {
        fillPts(D, ellipsePts(hx, hy, R * 0.85, R * 1.05, 30, 0.04, r), o.mat || 'pale', { rimW: 3 });
        ctx.fillStyle = '#060202';
        for (const s of [-1, 1]) { ctx.beginPath(); ctx.ellipse(hx + s * R * 0.32, hy - R * 0.1, R * 0.2, R * 0.24, 0, 0, TAU); ctx.fill(); }
        eyes(D, [[hx - R * 0.32, hy - R * 0.1], [hx + R * 0.32, hy - R * 0.1]], eyeS * 0.8);
        maw(D, hx, hy + R * 0.5, R * 0.7, R * 0.35);
      }
    }
  }
  function crown(D, cx, by, hw, ht) {
    const pts = [[cx - hw, by]];
    const n = 7;
    for (let i = 0; i <= n; i++) {
      const x = cx - hw + (i / n) * hw * 2;
      pts.push([x, by - (i % 2 ? ht * 0.35 : ht * (i === n / 2 || i === Math.floor(n / 2) ? 1.2 : 0.95))]);
    }
    pts.push([cx + hw, by]);
    fillPts(D, pts, 'gold', { rim: 0.9, rimW: 3 });
  }
  function halo(D, x, y, R, broken = false) {
    const { ctx, r } = D;
    glow(ctx, x, y, R * 1.4, rgbaA(D.L.rim), 0.35);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = rgba(D.L.rim, 0.85);
    ctx.lineWidth = R * 0.06;
    ctx.beginPath();
    if (broken) { ctx.arc(x, y, R, -2.6, 0.2); ctx.stroke(); ctx.beginPath(); ctx.arc(x, y, R, 0.5, 1.9); }
    else ctx.arc(x, y, R, 0, TAU);
    ctx.stroke();
    ctx.lineWidth = R * 0.015;
    for (let k = 0; k < 24; k++) {
      const a = (k / 24) * TAU;
      ctx.beginPath();
      ctx.moveTo(x + Math.cos(a) * R * 1.05, y + Math.sin(a) * R * 1.05);
      ctx.lineTo(x + Math.cos(a) * R * (1.15 + r() * 0.25), y + Math.sin(a) * R * (1.15 + r() * 0.25));
      ctx.stroke();
    }
    ctx.restore();
  }
  function flameTip(D, x, y, s) {
    const { ctx } = D;
    glow(ctx, x, y - s * 0.5, s * 4, 'rgba(255,170,70,A)', 0.6);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = 'rgba(255,200,110,0.95)';
    ctx.beginPath();
    ctx.moveTo(x, y - s * 1.6);
    ctx.quadraticCurveTo(x + s * 0.6, y - s * 0.4, x, y);
    ctx.quadraticCurveTo(x - s * 0.6, y - s * 0.4, x, y - s * 1.6);
    ctx.fill();
    ctx.restore();
  }

  // ---------------------------------------------------------
  // 腕
  // ---------------------------------------------------------
  /**
   * 肩 → 肘 → 手。mat に応じて鎧の腕・痩せた腕・袖などを描く
   */
  function arm(D, sh, el, hd, wd, mat, o = {}) {
    const side = hd[0] >= sh[0] ? 1 : -1;
    const up = band(seg(sh, el, 8), wd, wd * 0.85);
    const fo = band(seg(el, hd, 8), wd * 0.82, wd * (o.thinHand ? 0.45 : 0.7));
    if (o.sleeve) {
      // 広がる袖（肩から手首まで一枚の布）
      const s = tatter(D, [sh[0] - wd, sh[1] - wd * 0.5], [sh[0] + wd, sh[1] - wd * 0.5], [hd[0] - wd * 2.0, hd[1] - wd * 0.4], [hd[0] + wd * 2.0, hd[1] - wd * 0.4], { teeth: 6, depth: wd * 0.9 });
      fillPts(D, band(seg(sh, el, 8), wd * 0.6, wd * 0.5), o.skin || 'pale', { plain: true });
      hand(D, hd, wd * 0.9, side, o.skin || 'pale', o);
      fillPts(D, s, o.sleeve, { rim: 0.45 });
      return;
    }
    if (!METALLIC[mat]) {
      fillPts(D, limbCurve(sh, el, hd, wd * 1.05, { taper: o.thinHand ? 0.6 : 0.42 }), mat, {});
      hand(D, hd, wd * (o.thinHand ? 0.6 : 0.75), side, mat, o);
      return;
    }
    fillPts(D, up, mat, {});
    fillPts(D, fo, mat, {});
    if (METALLIC[mat]) {
      // 肘当て
      fillEllipse(D, el[0], el[1], wd * 1.05, wd * 0.9, mat === 'rust' ? 'rust' : 'dsteel', { rim: 0.8 });
      spike(D, el[0] + side * wd * 0.6, el[1] + wd * 0.2, side > 0 ? 0.3 : Math.PI - 0.3, wd * 1.2, wd * 0.3);
      // 篭手
      const gp = band(seg([lerp(el[0], hd[0], 0.55), lerp(el[1], hd[1], 0.55)], hd, 4), wd * 0.95, wd * 0.95);
      fillPts(D, gp, mat === 'rust' ? 'rust' : 'dsteel', { rim: 0.8 });
      fillEllipse(D, hd[0], hd[1] + wd * 0.35, wd * 0.95, wd * 0.85, 'dsteel', { rim: 0.8 });
    } else {
      hand(D, hd, wd, side, mat, o);
    }
  }
  function hand(D, hd, wd, side, mat, o = {}) {
    // 長い指・爪
    fillEllipse(D, hd[0], hd[1] + wd * 0.3, wd * 0.75, wd * 0.9, mat, { plain: true, rimW: 3 });
    if (o.fist) return;
    for (let k = 0; k < 4; k++) {
      const a = Math.PI / 2 + side * (-0.35 + k * 0.22);
      const len = wd * (o.claws ? 3.2 : 2.2) * (k === 0 ? 0.75 : 1);
      const p0 = [hd[0] + Math.cos(a) * wd * 0.5, hd[1] + wd * 0.6];
      const p1 = [p0[0] + Math.cos(a) * len * 0.5, p0[1] + Math.sin(a) * len * 0.5];
      const p2 = [p1[0] + Math.cos(a + side * 0.4) * len * 0.5, p1[1] + Math.sin(a + side * 0.4) * len * 0.5];
      fillPts(D, band([p0, p1, p2], wd * 0.18, wd * 0.09), mat, { plain: true, rimW: 2 });
      if (o.claws) fillPts(D, band([p2, [p2[0] + Math.cos(a + side * 0.7) * wd * 0.9, p2[1] + Math.sin(a + side * 0.7) * wd * 0.9]], wd * 0.09, 0.5), 'bone', { plain: true, rimW: 1 });
    }
  }
  function pauldron(D, x, y, s, side, mat, o = {}) {
    // 3段に重なった肩鎧
    for (let k = 2; k >= 0; k--) {
      const yy = y + k * s * 0.32;
      const pts = [];
      for (let i = 0; i <= 16; i++) {
        const a = Math.PI + (i / 16) * Math.PI;
        pts.push([x + side * s * 0.15 + Math.cos(a) * s * (1.05 - k * 0.08), yy + Math.sin(a) * s * (0.62 - k * 0.1)]);
      }
      pts.push([x + side * s * 0.15 + s * (0.95 - k * 0.08), yy + s * 0.18]);
      pts.push([x + side * s * 0.15 - s * (0.95 - k * 0.08), yy + s * 0.18]);
      fillPts(D, pts, mat, { rim: 0.85 });
    }
    if (o.spikes) for (let k = 0; k < o.spikes; k++) {
      const a = -Math.PI / 2 + side * (0.2 + k * 0.35);
      spike(D, x + side * s * 0.15 + Math.cos(a) * s * 0.7, y + Math.sin(a) * s * 0.45, a, s * 0.75, s * 0.12);
    }
    if (o.fur) {
      const fp = [];
      for (let i = 0; i <= 14; i++) fp.push([x - side * s * 0.6 + side * (i / 14) * s * 1.8, y - s * 0.35 + Math.sin((i / 14) * Math.PI) * -s * 0.25 + (i % 2 ? 0 : s * 0.12)]);
      fp.push([x + side * s * 1.1, y + s * 0.25]);
      fp.push([x - side * s * 0.6, y + s * 0.25]);
      fillPts(D, fp, 'fur', {});
    }
  }

  // ---------------------------------------------------------
  // 人型（騎士・亡者・信徒・処刑人・看護婦…）
  // ---------------------------------------------------------
  function humanoid(D, d) {
    const { ctx, w, h, r } = D;
    const cx = w * 0.5;
    const ground = h * 0.955;
    const Ht = h * 0.9 * (d.size || 1);
    const top = ground - Ht;
    const R = Ht * (d.headR || 0.06);
    const hunch = d.hunch || 0;
    const shW = w * 0.155 * (d.bulk || 1);
    const headY = top + R * 1.3 + hunch * R * 1.8;
    const shY = top + R * 2.55 + Ht * 0.02 + hunch * R * 0.4;
    const waistY = shY + Ht * (d.torsoLen || 0.26);
    const waistW = shW * (d.waist || 0.62);
    const hipY = waistY + Ht * 0.07;
    const hipW = shW * 0.72;
    const lift = (d.lift || 0) * h;
    const base = ground - lift;
    const armor = d.armor || 'plate';
    const plate = armor === 'plate' || armor === 'rust';
    const bodyMat = d.bodyMat || (armor === 'rust' ? 'rust' : armor === 'plate' ? 'dsteel' : armor === 'robe' ? 'cloth' : armor === 'coat' ? 'white' : 'flesh');
    const skin = d.skin || (armor === 'flesh' ? bodyMat : 'pale');
    const fog = groundFog(D, ground, d.fogSpread || 1);
    if (d.aura) aura(D, cx, shY, Ht * 0.6, d.aura);
    if (d.halo) halo(D, cx, headY - R * 0.5, R * 3.4, d.halo === 'broken');

    ctx.save();
    ctx.translate(0, -lift);

    // ---- 背後 ----
    if (d.extraArms) {
      for (let k = 0; k < d.extraArms; k++) {
        for (const s of [-1, 1]) {
          const sh = [cx + s * shW * 0.6, shY + Ht * 0.05 + k * Ht * 0.05];
          const el = [cx + s * shW * (1.9 + k * 0.25), shY - Ht * (0.06 - k * 0.12)];
          const hd = [cx + s * shW * (2.3 + k * 0.1), shY + Ht * (0.08 + k * 0.14)];
          arm(D, sh, el, hd, shW * 0.11, skin, { claws: true, thinHand: true });
        }
      }
    }
    if (d.tentacles) {
      for (let k = 0; k < d.tentacles; k++) {
        const s = k % 2 ? 1 : -1;
        const sx = cx + s * shW * (0.2 + r() * 0.5);
        const sy = shY + Ht * 0.05;
        const ex = cx + s * (shW * (1.6 + r() * 1.4));
        const ey = top + r() * Ht * 0.5;
        const tp = bez([sx, sy], [sx + s * shW * 0.6, sy - Ht * 0.2], [ex - s * shW * 0.8, ey + Ht * 0.25], [ex, ey], 20);
        fillPts(D, band(tp, shW * 0.24, 1.5), 'meat', { rimW: 5 });
        for (let i = 4; i < tp.length - 3; i += 3) fillEllipse(D, tp[i][0], tp[i][1], shW * 0.035, shW * 0.035, 'pale', { plain: true, rimW: 1 });
      }
    }
    if (d.backTank) {
      fillPts(D, [[cx - shW * 0.75, shY - R * 0.5], [cx + shW * 0.75, shY - R * 0.5], [cx + shW * 0.8, waistY], [cx - shW * 0.8, waistY]], 'brass', { smooth: false, rim: 0.8 });
      for (const s of [-1, 1]) {
        fillPts(D, band(bez([cx + s * shW * 0.55, shY - R * 0.5], [cx + s * shW * 0.65, shY - R * 3], [cx + s * shW * 1.15, shY - R * 3.2], [cx + s * shW * 1.25, shY - R * 2.2], 12), shW * 0.07, shW * 0.07), 'brass', { rimW: 2 });
        steam(D, cx + s * shW * 1.25, shY - R * 2.4, 6, shW * 0.5);
      }
    }
    if (d.cape) {
      const tl = [cx - shW * 0.95, shY - R * 0.2];
      const tr = [cx + shW * 0.95, shY - R * 0.2];
      const bl = [cx - shW * (1.55 + (d.capeFlare || 0)), ground - lift * 0.3 - h * 0.01];
      const br = [cx + shW * (1.7 + (d.capeFlare || 0)), ground - lift * 0.3 - h * 0.03];
      fillPts(D, tatter(D, tl, tr, bl, br, { teeth: 16, depth: h * 0.06, billow: shW * 0.15 }), d.cape === true ? 'cloth' : d.cape, { rim: 0.55 });
    }
    if (d.weapon && d.weapon.behind) weapon(D, d, { cx, shW, shY, waistY, hipY, top, base, R, Ht });

    // ---- 脚 ----
    const kneeY = lerp(hipY, base, 0.5);
    const legMat = plate ? bodyMat : armor === 'coat' ? 'cloth' : armor === 'flesh' ? bodyMat : 'cloth';
    if (armor !== 'robe') {
      for (const s of [-1, 1]) {
        const p0 = [cx + s * hipW * 0.5, hipY - Ht * 0.02];
        const pk = [cx + s * hipW * (0.85 + (d.stance || 0) * 0.3), kneeY];
        const pa = [cx + s * hipW * (0.95 + (d.stance || 0) * 0.5), base - Ht * 0.04];
        const lw = hipW * (plate ? 0.4 : d.thin ? 0.22 : 0.33) * (d.legBulk || 1);
        if (d.limp) {
          // 吊られた人形：だらりと垂れた脚
          pk[0] = cx + s * hipW * 0.45;
          pa[0] = cx + s * hipW * 0.3;
          pa[1] = base + Ht * 0.02;
        }
        if (plate) {
          fillPts(D, band(seg(p0, pk), lw, lw * 0.85), legMat, {});
          fillPts(D, band(seg(pk, pa), lw * 0.85, lw * 0.7), legMat, {});
        } else {
          fillPts(D, limbCurve(p0, pk, pa, lw * 1.1, { taper: 0.5, bulge: 0.22 }), legMat, {});
        }
        if (plate) {
          fillEllipse(D, pk[0], pk[1], lw * 1.05, lw * 0.85, bodyMat, { rim: 0.85 });
          spike(D, pk[0], pk[1] - lw * 0.2, -Math.PI / 2 + s * 0.2, lw * 0.9, lw * 0.25);
          // 鉄靴
          fillPts(D, [[pa[0] - lw * 0.9, pa[1] - lw * 0.4], [pa[0] + lw * 0.9, pa[1] - lw * 0.4], [pa[0] + s * lw * 1.6, base], [pa[0] - s * lw * 0.3 - lw * 0.6 * s, base]], bodyMat, { rim: 0.8 });
        } else if (d.limp || d.joints) {
          fillEllipse(D, pk[0], pk[1], lw * 0.9, lw * 0.9, 'porcelain', { plain: true });
          fillEllipse(D, pa[0], pa[1] + lw * 0.6, lw * 0.7, lw * 0.9, 'porcelain', { plain: true });
        } else {
          // 素足（爪）
          const fp = [[pa[0] - lw * 0.8, pa[1] - lw * 0.2], [pa[0] + lw * 0.8, pa[1] - lw * 0.2], [pa[0] + s * lw * 1.5, base], [pa[0] - s * lw * 0.9, base]];
          fillPts(D, fp, armor === 'coat' ? 'leather' : skin, { plain: true });
        }
      }
    }

    // ---- 腰回り・胴 ----
    if (armor === 'robe') {
      const tl = [cx - shW * 0.9, shY];
      const tr = [cx + shW * 0.9, shY];
      const bl = [cx - shW * (d.robeFlare || 1.3), base];
      const br = [cx + shW * (d.robeFlare || 1.3), base];
      fillPts(D, tatter(D, tl, tr, bl, br, { teeth: 14, depth: Ht * 0.06, topCurve: R * 0.6 }), bodyMat, { rim: 0.55 });
      // 縄の帯
      ctx.strokeStyle = 'rgba(110,85,55,0.95)';
      ctx.lineWidth = Ht * 0.012;
      ctx.beginPath();
      ctx.moveTo(cx - waistW * 1.05, waistY);
      ctx.quadraticCurveTo(cx, waistY + Ht * 0.02, cx + waistW * 1.05, waistY);
      ctx.stroke();
      line(D, [cx + waistW * 0.3, waistY + Ht * 0.01], [cx + waistW * 0.4, waistY + Ht * 0.15], 'rgba(110,85,55,0.95)', Ht * 0.01);
      if (d.apron) {
        fillPts(D, [[cx - waistW * 0.8, shY + Ht * 0.08], [cx + waistW * 0.8, shY + Ht * 0.08], [cx + waistW * 1.0, base - Ht * 0.1], [cx - waistW * 1.0, base - Ht * 0.1]], 'white', {});
      }
    } else {
      if (plate) {
        // 鎖帷子の腰垂れ
        const sk = [[cx - waistW * 1.05, waistY], [cx + waistW * 1.05, waistY], [cx + hipW * 1.25, kneeY - Ht * 0.04], [cx - hipW * 1.25, kneeY - Ht * 0.04]];
        fillPts(D, sk, 'dsteel', { plain: true });
        ctx.save();
        polyPath(ctx, sk);
        ctx.clip();
        ctx.strokeStyle = 'rgba(150,150,160,0.25)';
        ctx.lineWidth = 1;
        for (let y = waistY; y < kneeY; y += 5) for (let x = cx - hipW * 1.3; x < cx + hipW * 1.3; x += 6) { ctx.beginPath(); ctx.arc(x + ((y / 5) % 2) * 3, y, 2.4, 0, Math.PI); ctx.stroke(); }
        ctx.restore();
      }
      if (d.tabard) {
        const tb = tatter(D, [cx - waistW * 0.55, waistY - Ht * 0.02], [cx + waistW * 0.55, waistY - Ht * 0.02], [cx - waistW * 0.62, kneeY + Ht * 0.12], [cx + waistW * 0.62, kneeY + Ht * 0.12], { teeth: 6, depth: Ht * 0.05 });
        fillPts(D, tb, d.tabard, { rim: 0.4 });
      }
      if (armor === 'coat') {
        // 白衣の裾（前が開いている）
        for (const s of [-1, 1]) {
          const cp = tatter(D, [cx + s * waistW * 0.15, waistY - Ht * 0.05], [cx + s * waistW * 1.1, waistY - Ht * 0.05], [cx + s * waistW * 0.2, kneeY + Ht * 0.12], [cx + s * hipW * 1.5, kneeY + Ht * 0.12], { teeth: 5, depth: Ht * 0.04 });
          fillPts(D, s < 0 ? cp : cp.map(([x, y]) => [x, y]), 'white', {});
        }
      }
      // 胴
      const chestW = shW * (d.chest || 1);
      const torso = [
        [cx - shW * 0.92, shY - R * 0.2],
        [cx - chestW * 1.02, shY + Ht * 0.08],
        [cx - waistW * 1.05, waistY - Ht * 0.03],
        [cx - waistW * 0.95, waistY + Ht * 0.015],
        [cx, waistY + Ht * 0.04],
        [cx + waistW * 0.95, waistY + Ht * 0.015],
        [cx + waistW * 1.05, waistY - Ht * 0.03],
        [cx + chestW * 1.02, shY + Ht * 0.08],
        [cx + shW * 0.92, shY - R * 0.2],
        [cx, shY - R * 0.55],
      ];
      fillPts(D, torso, armor === 'coat' ? 'white' : bodyMat, { smooth: !plate, rim: plate ? 0.8 : 0.5 });
      if (plate) {
        line(D, [cx, shY], [cx, waistY], 'rgba(255,255,255,0.14)', 2.5);
        line(D, [cx + 2, shY], [cx + 2, waistY], 'rgba(0,0,0,0.5)', 1.5);
        for (let k = 0; k < 3; k++) {
          const y = lerp(shY + Ht * 0.13, waistY, k / 3);
          ctx.strokeStyle = 'rgba(0,0,0,0.6)';
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.moveTo(cx - chestW * 0.85, y);
          ctx.quadraticCurveTo(cx, y + Ht * 0.025, cx + chestW * 0.85, y);
          ctx.stroke();
        }
        // ベルト
        fillPts(D, [[cx - waistW * 1.1, waistY - Ht * 0.012], [cx + waistW * 1.1, waistY - Ht * 0.012], [cx + waistW * 1.1, waistY + Ht * 0.02], [cx - waistW * 1.1, waistY + Ht * 0.02]], 'leather', { plain: true, rimW: 3 });
        fillPts(D, [[cx - Ht * 0.02, waistY - Ht * 0.02], [cx + Ht * 0.02, waistY - Ht * 0.02], [cx + Ht * 0.02, waistY + Ht * 0.028], [cx - Ht * 0.02, waistY + Ht * 0.028]], 'brass', { plain: true, rimW: 2 });
      } else if (armor === 'coat') {
        // 襟元（はだけた胸に肋骨）
        const v = [[cx - shW * 0.4, shY - R * 0.3], [cx + shW * 0.4, shY - R * 0.3], [cx + waistW * 0.2, waistY - Ht * 0.03], [cx - waistW * 0.2, waistY - Ht * 0.03]];
        fillPts(D, v, skin, { plain: true });
        for (let k = 0; k < 5; k++) {
          const y = shY + Ht * 0.03 + k * Ht * 0.03;
          line(D, [cx - shW * 0.3 + k * 2, y], [cx + shW * 0.3 - k * 2, y], 'rgba(0,0,0,0.45)', 2);
        }
        line(D, [cx - shW * 0.42, shY - R * 0.3], [cx - waistW * 0.2, waistY - Ht * 0.03], 'rgba(0,0,0,0.5)', 2);
        line(D, [cx + shW * 0.42, shY - R * 0.3], [cx + waistW * 0.2, waistY - Ht * 0.03], 'rgba(0,0,0,0.5)', 2);
      } else {
        // 肉体：肋骨・腹
        for (let k = 0; k < 5; k++) {
          const y = shY + Ht * (0.06 + k * 0.032);
          for (const s of [-1, 1]) {
            ctx.strokeStyle = 'rgba(0,0,0,0.38)';
            ctx.lineWidth = 2.5;
            ctx.beginPath();
            ctx.moveTo(cx + s * shW * 0.08, y);
            ctx.quadraticCurveTo(cx + s * chestW * 0.6, y - Ht * 0.01, cx + s * chestW * 0.9, y + Ht * 0.03);
            ctx.stroke();
          }
        }
        line(D, [cx, shY + Ht * 0.02], [cx, waistY], 'rgba(0,0,0,0.3)', 3);
      }
    }
    if (d.straps) {
      ctx.save();
      for (const [a, b] of [[[cx - shW * 0.9, shY], [cx + waistW, waistY]], [[cx + shW * 0.9, shY + Ht * 0.04], [cx - waistW, waistY - Ht * 0.04]]]) {
        fillPts(D, band(seg(a, b), Ht * 0.012, Ht * 0.012), 'leather', { plain: true, rimW: 2 });
        const m = [lerp(a[0], b[0], 0.5), lerp(a[1], b[1], 0.5)];
        fillPts(D, [[m[0] - 5, m[1] - 5], [m[0] + 5, m[1] - 5], [m[0] + 5, m[1] + 5], [m[0] - 5, m[1] + 5]], 'brass', { plain: true, rimW: 1 });
      }
      ctx.restore();
    }
    if (d.stitches) {
      ctx.strokeStyle = 'rgba(25,8,8,0.95)';
      ctx.lineWidth = 2;
      const sx0 = cx - shW * 0.3;
      ctx.beginPath(); ctx.moveTo(sx0, shY + Ht * 0.04); ctx.quadraticCurveTo(cx + shW * 0.2, shY + Ht * 0.14, cx + shW * 0.1, waistY - Ht * 0.02); ctx.stroke();
      const sp = bez([sx0, shY + Ht * 0.04], [sx0 + shW * 0.3, shY + Ht * 0.09], [cx + shW * 0.2, shY + Ht * 0.16], [cx + shW * 0.1, waistY - Ht * 0.02], 10);
      for (const [x, y] of sp) line(D, [x - 6, y - 3], [x + 6, y + 3], 'rgba(25,8,8,0.95)', 1.8);
    }
    if (d.furnace) {
      // 胸の炉
      const fy = shY + Ht * 0.11;
      fillEllipse(D, cx, fy, shW * 0.42, shW * 0.36, 'dsteel', { rim: 0.8 });
      glow(ctx, cx, fy, shW * 1.6, 'rgba(255,120,30,A)', 0.7);
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = 'rgba(255,170,60,0.95)';
      ctx.beginPath(); ctx.ellipse(cx, fy, shW * 0.3, shW * 0.24, 0, 0, TAU); ctx.fill();
      ctx.restore();
      for (let k = 0; k < 5; k++) line(D, [cx - shW * 0.3 + k * shW * 0.15, fy - shW * 0.26], [cx - shW * 0.3 + k * shW * 0.15, fy + shW * 0.26], 'rgba(20,10,5,0.95)', 3);
    }
    if (d.chains) {
      chain(D, bez([cx - shW * 0.9, shY + Ht * 0.02], [cx - shW * 0.2, shY + Ht * 0.18], [cx + shW * 0.3, waistY], [cx + waistW * 1.1, waistY + Ht * 0.02], 14), Ht * 0.01);
    }
    if (d.gears) {
      for (const [gx, gy, gr] of [[cx - shW * 0.35, shY + Ht * 0.1, shW * 0.22], [cx + shW * 0.25, shY + Ht * 0.17, shW * 0.16]]) gear(D, gx, gy, gr);
    }

    // ---- 武器（手より奥） ----
    if (d.weapon && !d.weapon.behind) weapon(D, d, { cx, shW, shY, waistY, hipY, top, base, R, Ht });

    // ---- 腕 ----
    const aw = shW * (plate ? 0.24 : d.thin ? 0.13 : 0.19) * (d.armBulk || 1);
    const armMat = plate ? bodyMat : armor === 'flesh' ? bodyMat : skin;
    const sleeve = armor === 'robe' ? bodyMat : armor === 'coat' ? 'white' : null;
    for (const s of [-1, 1]) {
      const sh = [cx + s * shW * 0.95, shY + R * 0.3];
      const pose = s > 0 && d.weapon ? 'grip' : d.pose || 'hang';
      let el, hd;
      const reach = d.longArms ? 1.35 : 1;
      if (pose === 'grip') {
        const g = gripPoint(d, { cx, shW, shY, waistY, hipY, top, base, R, Ht });
        el = [lerp(sh[0], g[0], 0.5) + s * shW * 0.3, lerp(sh[1], g[1], 0.55)];
        hd = g;
      } else if (pose === 'pray') {
        el = [cx + s * shW * 0.95, shY + Ht * 0.17];
        hd = [cx + s * shW * 0.08, shY + Ht * 0.07];
      } else if (pose === 'wide') {
        el = [cx + s * shW * 1.6, shY + Ht * 0.08];
        hd = [cx + s * shW * 2.0, shY + Ht * 0.24 * reach];
      } else if (pose === 'reach') {
        el = [cx + s * shW * 1.5, shY + Ht * 0.15];
        hd = [cx + s * shW * 1.45, shY + Ht * 0.36 * reach];
      } else {
        el = [cx + s * shW * 1.2, shY + Ht * 0.16];
        hd = [cx + s * shW * 1.3, shY + Ht * 0.32 * reach];
      }
      if (d.limp && pose !== 'grip') hd = [cx + s * shW * 1.15, shY + Ht * 0.34];
      arm(D, sh, el, hd, aw, armMat, { sleeve: sleeve && (d.sleeves !== false) ? sleeve : null, skin, claws: d.claws, fist: plate });
      if (d.joints) { fillEllipse(D, el[0], el[1], aw * 0.95, aw * 0.95, 'porcelain', { plain: true }); }
      if (plate || d.pauldrons) pauldron(D, sh[0], sh[1] - R * 0.2, shW * (d.pauldronSize || 0.55), s, d.pauldronMat || bodyMat, { spikes: d.spikes, fur: d.fur });
      else if (armor === 'flesh') fillPts(D, ellipsePts(sh[0] - s * aw * 0.2, sh[1] + aw * 0.3, aw * 1.35, aw * 1.15, 26, 0.04, r), armMat, { smooth: true });
      if (d.leftItem && s < 0) leftItem(D, d.leftItem, hd, aw, Ht);
    }

    // ---- 頭 ----
    if (d.neckFur) {
      const fp = [];
      for (let i = 0; i <= 18; i++) fp.push([cx - shW * 0.85 + (i / 18) * shW * 1.7, shY - R * 0.8 + (i % 2 ? -R * 0.4 : R * 0.2) - Math.sin((i / 18) * Math.PI) * R * 0.6]);
      fp.push([cx + shW * 0.8, shY + R * 0.9]);
      fp.push([cx - shW * 0.8, shY + R * 0.9]);
      fillPts(D, fp, 'fur', {});
    }
    head(D, d.head || 'greathelm', cx, headY, R, d.headOpt || {});
    if (d.headFront) d.headFront(D, cx, headY, R);

    ctx.restore();

    // ---- 吊り糸 ----
    if (d.strings) {
      ctx.save();
      ctx.strokeStyle = 'rgba(220,210,190,0.55)';
      ctx.lineWidth = 1.2;
      for (const x of [cx - shW * 1.15, cx + shW * 1.15, cx, cx - hipW * 0.3, cx + hipW * 0.3]) {
        ctx.beginPath();
        ctx.moveTo(x + (r() - 0.5) * 20, 0);
        ctx.lineTo(x, x === cx ? headY - R - lift : shY + Ht * 0.33 - lift);
        ctx.stroke();
      }
      // 操り棒
      fillPts(D, [[cx - shW * 1.4, 4], [cx + shW * 1.4, 4], [cx + shW * 1.4, 14], [cx - shW * 1.4, 14]], 'leather', { plain: true });
      ctx.restore();
    }
    if (d.steam) steam(D, cx, shY + Ht * 0.1, 14, shW * 1.2);
    fog();
    embers(D, d.embers ?? 18, { x: w * 0.1, y: h * 0.25, w: w * 0.8, h: h * 0.7 });
  }

  function gear(D, x, y, R) {
    const { ctx } = D;
    const pts = [];
    const n = 10;
    for (let i = 0; i < n * 2; i++) {
      const a = (i / (n * 2)) * TAU;
      const rr = i % 2 ? R : R * 1.25;
      pts.push([x + Math.cos(a - 0.12) * rr, y + Math.sin(a - 0.12) * rr], [x + Math.cos(a + 0.12) * rr, y + Math.sin(a + 0.12) * rr]);
    }
    fillPts(D, pts, 'brass', { rim: 0.8, rimW: 3 });
    ctx.fillStyle = 'rgba(0,0,0,0.9)';
    ctx.beginPath(); ctx.arc(x, y, R * 0.35, 0, TAU); ctx.fill();
  }

  function gripPoint(d, g) {
    const { cx, shW, shY, waistY, hipY, Ht } = g;
    switch (d.weapon.pose) {
      case 'planted': return [cx + shW * 1.35, waistY + Ht * 0.02];
      case 'drag': return [cx + shW * 1.4, hipY + Ht * 0.06];
      case 'raised': return [cx + shW * 1.5, shY - Ht * 0.02];
      default: return [cx + shW * 1.4, waistY];
    }
  }
  function weapon(D, d, g) {
    const wp = d.weapon;
    const { cx, shW, shY, waistY, hipY, top, base, Ht, R } = g;
    const gp = gripPoint(d, g);
    const wd = Ht * (wp.width || 0.022);
    switch (wp.type) {
      case 'greatsword':
        if (wp.pose === 'planted') greatsword(D, [gp[0], gp[1] + wd * 1.5], [gp[0] + shW * 0.15, base - 2], wd * 1.4, { glowing: wp.glowing });
        else greatsword(D, gp, [gp[0] + shW * 0.6, top - Ht * 0.02], wd * 1.4, { glowing: wp.glowing });
        break;
      case 'cleaver':
        cleaver(D, gp, [gp[0] + shW * 0.6, base + Ht * 0.01], Ht * (wp.width || 0.14));
        break;
      case 'halberd':
      case 'spear':
      case 'scythe':
      case 'hammer':
      case 'eye':
      case 'lantern':
        polearm(D, [gp[0] - shW * 0.05, base - 2], [gp[0] + shW * 0.12, top + Ht * (wp.type === 'scythe' ? 0.02 : -0.04)], wd * 0.45, wp.type, { headMat: wp.headMat, ember: wp.ember, poleMat: wp.poleMat });
        break;
      case 'flail':
        flail(D, gp, [gp[0] + shW * 0.3, base - Ht * 0.08], Ht * 0.055);
        break;
      case 'scissors':
        scissors(D, gp, [gp[0] + shW * 0.4, base - Ht * 0.02], wd * 0.9);
        break;
      case 'sickle': {
        const p = bez(gp, [gp[0] + shW * 0.5, gp[1] - Ht * 0.02], [gp[0] + shW * 0.9, gp[1] + Ht * 0.12], [gp[0] + shW * 0.55, gp[1] + Ht * 0.2], 14);
        fillPts(D, band(p, wd * 0.6, 0.5), 'steel', { rim: 0.9 });
        break;
      }
      case 'saw': {
        const a = [gp[0], gp[1]];
        const b = [gp[0] + shW * 0.5, base - Ht * 0.05];
        const pts = band(seg(a, b, 10), wd * 1.6, wd * 1.3);
        fillPts(D, pts, 'rust', { rim: 0.7 });
        const sp = seg(a, b, 14);
        for (const [x, y] of sp) spike(D, x + wd * 1.5, y, 0.2, wd * 0.9, wd * 0.3, 'rust');
        break;
      }
    }
  }
  function leftItem(D, type, hd, aw, Ht) {
    const { ctx } = D;
    if (type === 'chain') {
      chain(D, bez(hd, [hd[0] - 10, hd[1] + Ht * 0.1], [hd[0] + 20, hd[1] + Ht * 0.2], [hd[0] - Ht * 0.02, hd[1] + Ht * 0.3], 12), Ht * 0.01);
    } else if (type === 'keys') {
      chain(D, seg(hd, [hd[0], hd[1] + Ht * 0.08], 4), Ht * 0.008);
      for (let k = 0; k < 4; k++) {
        const x = hd[0] + (k - 1.5) * aw * 0.6;
        const y = hd[1] + Ht * 0.1;
        fillPts(D, band(seg([x, y], [x + (k - 1.5) * 3, y + Ht * 0.06]), 2.5, 2.5), 'brass', { plain: true, rimW: 1 });
        ctx.strokeStyle = 'rgba(200,160,80,0.9)';
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(x, y, 5, 0, TAU); ctx.stroke();
      }
    } else if (type === 'censer') {
      chain(D, seg(hd, [hd[0], hd[1] + Ht * 0.12], 4), Ht * 0.007);
      const c = [hd[0], hd[1] + Ht * 0.16];
      fillEllipse(D, c[0], c[1], Ht * 0.04, Ht * 0.045, 'brass', { rim: 0.9 });
      glow(ctx, c[0], c[1], Ht * 0.12, 'rgba(255,150,60,A)', 0.4);
      steam(D, c[0], c[1] - Ht * 0.03, 8, Ht * 0.06);
    } else if (type === 'lantern') {
      chain(D, seg(hd, [hd[0], hd[1] + Ht * 0.05], 3), Ht * 0.006);
      const c = [hd[0], hd[1] + Ht * 0.09];
      glow(ctx, c[0], c[1], Ht * 0.2, 'rgba(255,190,100,A)', 0.6);
      fillPts(D, [[c[0] - 10, c[1] - 14], [c[0] + 10, c[1] - 14], [c[0] + 12, c[1] + 14], [c[0] - 12, c[1] + 14]], 'dsteel', { plain: true });
      ctx.fillStyle = 'rgba(255,225,150,0.95)';
      ctx.fillRect(c[0] - 6, c[1] - 9, 12, 19);
    } else if (type === 'head') {
      // 髪を掴んで生首を提げる
      const c = [hd[0], hd[1] + Ht * 0.08];
      fillPts(D, band(seg(hd, [c[0], c[1] - Ht * 0.03]), 3, 6), 'shadow', { plain: true });
      fillEllipse(D, c[0], c[1], Ht * 0.03, Ht * 0.038, 'pale', {});
      blood(D, c[0], c[1] + Ht * 0.03, 3, Ht * 0.06);
    } else if (type === 'syringe') {
      const a = hd;
      const b = [hd[0] - Ht * 0.02, hd[1] + Ht * 0.16];
      fillPts(D, band(seg(a, b), 6, 6), 'white', { plain: true });
      glow(ctx, lerp(a[0], b[0], 0.5), lerp(a[1], b[1], 0.5), 30, rgbaA(D.L.eye), 0.5);
      line(D, b, [b[0] - 3, b[1] + Ht * 0.07], 'rgba(220,220,230,0.95)', 2);
    }
  }

  // ---------------------------------------------------------
  // 亡霊（脚が無く、裾が霧に溶ける）
  // ---------------------------------------------------------
  function wraith(D, d) {
    const { ctx, w, h, r } = D;
    const cx = w * 0.5;
    const Ht = h * 0.86 * (d.size || 1);
    const top = h * 0.06 + (1 - (d.size || 1)) * h * 0.5;
    const R = Ht * (d.headR || 0.075);
    const shW = w * 0.15 * (d.bulk || 1);
    const headY = top + R * 1.6 + (d.hunch || 0) * R;
    const shY = top + R * 3.0;
    aura(D, cx, shY + Ht * 0.15, Ht * 0.6, 0.3);
    if (d.bellBack) {
      // 背負った大鐘
      const by = shY - R * 0.5;
      const bp = [[cx - shW * 0.9, by - Ht * 0.18], [cx + shW * 0.9, by - Ht * 0.18], [cx + shW * 1.4, by + Ht * 0.2], [cx + shW * 2.0, by + Ht * 0.34], [cx - shW * 2.0, by + Ht * 0.34], [cx - shW * 1.4, by + Ht * 0.2]];
      fillPts(D, bp, 'brass', { smooth: true, rim: 0.9 });
      ctx.fillStyle = '#000';
      ctx.beginPath(); ctx.ellipse(cx, by + Ht * 0.33, shW * 1.85, Ht * 0.04, 0, 0, TAU); ctx.fill();
      chain(D, [[cx - shW * 1.4, by - Ht * 0.12], [cx - shW * 2.2, by - Ht * 0.3]], Ht * 0.01);
      chain(D, [[cx + shW * 1.4, by - Ht * 0.12], [cx + shW * 2.2, by - Ht * 0.3]], Ht * 0.01);
    }
    // 裾（何本にも裂けて下に消える）
    const bodyMat = d.mat || 'shadow';
    for (let k = 0; k < 7; k++) {
      const sx = cx + (k - 3) * shW * 0.32;
      const p0 = [sx, shY + Ht * 0.3];
      const p3 = [sx + (r() - 0.5) * shW * 1.6, top + Ht * (0.92 + r() * 0.06)];
      const pts = bez(p0, [p0[0] + (r() - 0.5) * shW, p0[1] + Ht * 0.2], [p3[0] + (r() - 0.5) * shW, p3[1] - Ht * 0.2], p3, 16);
      fillPts(D, band(pts, shW * 0.3, 1), bodyMat, { rim: 0.35 });
    }
    const robe = tatter(D, [cx - shW * 0.85, shY], [cx + shW * 0.85, shY], [cx - shW * 1.5, shY + Ht * 0.55], [cx + shW * 1.5, shY + Ht * 0.55], { teeth: 12, depth: Ht * 0.1, topCurve: R * 0.5 });
    fillPts(D, robe, bodyMat, { rim: 0.55 });
    // 腕
    for (const s of [-1, 1]) {
      const sh = [cx + s * shW * 0.85, shY + R * 0.4];
      const el = [cx + s * shW * 1.55, shY + Ht * 0.12];
      const hd = s > 0 && d.holdRight ? [cx + shW * 1.6, shY + Ht * 0.02] : [cx + s * shW * 1.85, shY + Ht * 0.3];
      arm(D, sh, el, hd, shW * 0.16, 'bone', { sleeve: bodyMat, skin: 'bone', claws: true });
      if (s > 0 && d.holdRight) d.holdRight(D, hd, Ht);
      if (s < 0 && d.leftItem) leftItem(D, d.leftItem, hd, shW * 0.16, Ht);
    }
    head(D, d.head || 'hood', cx, headY, R, d.headOpt || {});
    embers(D, d.embers ?? 24, { x: w * 0.1, y: h * 0.1, w: w * 0.8, h: h * 0.85 });
  }

  // ---------------------------------------------------------
  // 獣（横向き・左を向く）
  // ---------------------------------------------------------
  function beast(D, d) {
    const { ctx, w, h, r } = D;
    const s = d.size || 1;
    const ground = h * 0.94;
    const fog = groundFog(D, ground, 1.1);
    const L = w * 0.68 * s; // 体長
    const x0 = w * 0.5 - L * 0.28; // 胸の前端（頭と後ろ脚が収まる位置）
    const hump = ground - h * (d.tall || 0.5) * s; // 肩の頂点
    const chestY = ground - h * 0.2 * s;
    const hipX = x0 + L * 0.78;
    const hipTop = hump + h * 0.1 * s;
    const fur = d.mat || 'fur';
    // 尾
    if (d.tail !== false) {
      const tp = bez([hipX + L * 0.08, hipTop + h * 0.04], [hipX + L * 0.22, hipTop - h * 0.05], [hipX + L * 0.26, ground - h * 0.12], [hipX + L * (d.tail === 'long' ? 0.1 : 0.24), ground - h * (d.tail === 'long' ? 0.02 : 0.2)], 18);
      fillPts(D, band(tp, h * 0.028 * s, 1), d.tail === 'long' ? 'meat' : fur, { rimW: 3 });
    }
    // 奥の脚（暗く）
    const legs = (fx, kneeOff, near) => {
      const m = near ? fur : 'shadow';
      // 前脚
      const f0 = [fx, chestY - h * 0.08];
      const f1 = [fx - L * 0.01 + kneeOff, ground - h * 0.11 * s];
      const f2 = [fx - L * 0.05 + kneeOff, ground - 2];
      fillPts(D, limbCurve(f0, f1, f2, L * 0.075, { taper: 0.55, bulge: 0.3 }), m, {});
      fillPts(D, [[f2[0] - L * 0.06, ground], [f2[0] + L * 0.02, ground], [f2[0] + L * 0.025, ground - h * 0.03], [f2[0] - L * 0.03, ground - h * 0.03]], m, { plain: true });
      for (let k = 0; k < 3; k++) spike(D, f2[0] - L * 0.055, ground - 2 - k * 3, Math.PI + 0.15, L * 0.03, 2, 'bone');
      // 後脚（逆関節）
      const hx = fx + L * 0.62;
      const h0 = [hx, hipTop + h * 0.08];
      const h1 = [hx + L * 0.09 + kneeOff * 0.5, ground - h * 0.17 * s];
      const h2 = [hx + L * 0.02 + kneeOff * 0.5, ground - 2];
      fillPts(D, limbCurve(h0, h1, h2, L * 0.1, { taper: 0.68, bulge: 0.35 }), m, {});
      fillPts(D, [[h2[0] - L * 0.055, ground], [h2[0] + L * 0.02, ground], [h2[0] + L * 0.02, ground - h * 0.03], [h2[0] - L * 0.03, ground - h * 0.03]], m, { plain: true });
    };
    legs(x0 + L * 0.2, L * 0.04, false);
    // 胴（胸が深く、腰がくびれる）
    const body = [
      [x0 + L * 0.06, chestY - h * 0.02],
      [x0 + L * 0.03, hump + h * 0.12 * s],
      [x0 + L * 0.18, hump],
      [x0 + L * 0.4, hump + h * 0.02],
      [x0 + L * 0.6, hipTop + h * 0.02],
      [hipX + L * 0.06, hipTop - h * 0.02],
      [hipX + L * 0.12, hipTop + h * 0.08],
      [hipX + L * 0.05, hipTop + h * 0.2 * s],
      [x0 + L * 0.58, chestY - h * 0.08 * s],
      [x0 + L * 0.35, chestY + h * 0.01],
      [x0 + L * 0.15, chestY + h * 0.02],
    ];
    fillPts(D, body, d.bodyMat || fur, { smooth: true, rim: 0.6, rimW: 8 });
    // 肋骨
    if (d.ribs !== false) {
      for (let k = 0; k < 6; k++) {
        const rx = x0 + L * (0.26 + k * 0.055);
        ctx.strokeStyle = 'rgba(0,0,0,0.5)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(rx, hump + h * 0.06);
        ctx.quadraticCurveTo(rx + L * 0.03, lerp(hump, chestY, 0.5), rx - L * 0.01, chestY - h * 0.03);
        ctx.stroke();
        ctx.strokeStyle = rgba(D.L.rim, 0.12);
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
    }
    if (d.gears) {
      gear(D, x0 + L * 0.42, lerp(hump, chestY, 0.45), h * 0.06 * s);
      gear(D, x0 + L * 0.58, lerp(hipTop, chestY, 0.5), h * 0.04 * s);
      for (let k = 0; k < 3; k++) fillPts(D, band(bez([x0 + L * 0.3, hump + 6], [x0 + L * 0.45, hump - h * 0.06], [x0 + L * 0.6, hump - h * 0.02], [x0 + L * (0.65 + k * 0.05), hipTop + 4], 10), 4, 4), 'brass', { rimW: 2 });
    }
    if (d.stitches) {
      ctx.strokeStyle = 'rgba(20,5,5,0.95)';
      ctx.lineWidth = 2;
      const sp = bez([x0 + L * 0.3, hump + h * 0.02], [x0 + L * 0.38, chestY - h * 0.1], [x0 + L * 0.5, chestY - h * 0.1], [x0 + L * 0.6, hipTop + h * 0.05], 12);
      ctx.beginPath(); sp.forEach((p, i) => (i ? ctx.lineTo(...p) : ctx.moveTo(...p))); ctx.stroke();
      for (const [x, y] of sp) line(D, [x - 5, y - 5], [x + 5, y + 5], 'rgba(20,5,5,0.95)', 1.8);
    }
    // たてがみ（背中のぼさぼさの毛・棘）
    const maneN = d.mane || 16;
    for (let k = 0; k < maneN; k++) {
      const t = k / maneN;
      const bx = lerp(x0 + L * 0.02, x0 + L * 0.62, t);
      const by = lerp(hump + h * 0.08, hump, Math.min(1, t * 3)) + (t > 0.4 ? (t - 0.4) * h * 0.05 : 0);
      const len = h * (0.05 + r() * 0.06) * s * (1 - t * 0.5) * (d.spiky ? 1.4 : 1);
      const a = -Math.PI / 2 + 0.7 + (r() - 0.5) * 0.4;
      if (d.spiky) spike(D, bx, by + 4, a, len, len * 0.15, 'bone');
      else fillPts(D, [[bx - len * 0.18, by + 6], [bx + Math.cos(a) * len, by + Math.sin(a) * len], [bx + len * 0.18, by + 6]], fur, { plain: true, rimW: 2 });
    }
    legs(x0 + L * 0.24, 0, true);
    // 首と頭（頭は低く、牙を剥く）
    const heads = d.heads || 1;
    for (let k = heads - 1; k >= 0; k--) {
      const off = k * h * 0.13 * s;
      const nx = x0 + L * 0.06 - k * L * 0.02;
      const ny = hump + h * 0.12 * s - off;
      const S = h * 0.115 * s * (d.headSize || 1);
      const hx = Math.max(x0 - L * 0.04 - k * L * 0.03, S * 1.85 + w * 0.02);
      const hy = chestY - h * 0.14 * s - off * 1.1;
      fillPts(D, band(bez([nx + L * 0.14, ny + h * 0.06], [nx, ny], [hx + L * 0.1, hy - h * 0.04], [hx + S * 0.5, hy], 10), L * 0.1, S * 0.75), k ? 'shadow' : fur, { rim: 0.6 });
      beastHead(D, hx, hy, S, d, k > 0);
    }
    if (d.collar) chain(D, bez([x0 + L * 0.02, hump + h * 0.1], [x0 - L * 0.02, hump + h * 0.18], [x0 + L * 0.06, chestY - h * 0.02], [x0 + L * 0.12, chestY - h * 0.05], 10), h * 0.012);
    fog();
    embers(D, d.embers ?? 14, { x: w * 0.05, y: h * 0.25, w: w * 0.9, h: h * 0.7 });
  }
  function beastHead(D, hx, hy, S, d, far) {
    const { ctx } = D;
    const mat = far ? 'shadow' : d.headMat || d.mat || 'fur';
    // 頭蓋＋長い鼻面（左向き）
    const skull = [[hx + S * 0.9, hy - S * 0.7], [hx + S * 0.2, hy - S * 0.85], [hx - S * 0.6, hy - S * 0.45], [hx - S * 1.6, hy - S * 0.15], [hx - S * 1.75, hy + S * 0.15], [hx - S * 0.8, hy + S * 0.25], [hx + S * 0.7, hy + S * 0.55]];
    // 下顎（大きく開く）
    const jaw = [[hx + S * 0.5, hy + S * 0.45], [hx - S * 0.4, hy + S * 0.55], [hx - S * 1.45, hy + S * 1.0], [hx - S * 1.5, hy + S * 1.2], [hx - S * 0.6, hy + S * 1.0], [hx + S * 0.5, hy + S * 0.9]];
    ctx.fillStyle = '#100000';
    polyPath(ctx, [[hx + S * 0.4, hy + S * 0.3], [hx - S * 1.6, hy + S * 0.1], [hx - S * 1.45, hy + S * 1.05], [hx + S * 0.4, hy + S * 0.75]]);
    ctx.fill();
    glow(ctx, hx - S * 0.5, hy + S * 0.55, S * 0.9, 'rgba(150,15,10,A)', 0.3);
    // 牙
    for (let k = 0; k < 7; k++) {
      const t = k / 6;
      const tx = lerp(hx - S * 1.55, hx + S * 0.1, t);
      const ty = lerp(hy + S * 0.12, hy + S * 0.4, t);
      spike(D, tx, ty, Math.PI / 2 + 0.1, S * (k < 2 ? 0.45 : 0.3) * (d.incisors && k === 0 ? 1.8 : 1), S * 0.06, 'bone');
      const bx = lerp(hx - S * 1.4, hx + S * 0.1, t);
      const by = lerp(hy + S * 1.0, hy + S * 0.7, t);
      spike(D, bx, by, -Math.PI / 2 - 0.1, S * (k < 2 ? 0.35 : 0.25), S * 0.05, 'bone');
    }
    fillPts(D, jaw, mat, { smooth: true, rimW: 4 });
    fillPts(D, skull, d.skullMat || mat, { smooth: true, rimW: 5 });
    if (d.metalJaw) {
      fillPts(D, [[hx - S * 0.2, hy + S * 0.5], [hx - S * 1.5, hy + S * 1.0], [hx - S * 1.5, hy + S * 1.22], [hx - S * 0.2, hy + S * 0.95]], 'brass', { rim: 0.8 });
      for (let k = 0; k < 4; k++) fillEllipse(D, hx - S * (0.4 + k * 0.3), hy + S * 0.85, 2.5, 2.5, 'dsteel', { plain: true });
    }
    // 耳・角
    if (d.ears !== false) {
      for (const k of [0, 1]) fillPts(D, [[hx + S * (0.3 + k * 0.3), hy - S * 0.75], [hx + S * (0.75 + k * 0.4), hy - S * (1.6 - k * 0.3)], [hx + S * (0.8 + k * 0.3), hy - S * 0.55]], mat, { plain: true, rimW: 3 });
    }
    if (d.horns) hornCurve(D, hx + S * 0.2, hy - S * 0.6, 1, S * 1.8, S * 0.18);
    // 目
    const ne = d.manyEyes ? 4 : 1;
    const ep = [];
    for (let i = 0; i < ne; i++) ep.push([hx - S * (0.35 - i * 0.28), hy - S * (0.28 + (i % 2) * 0.18)]);
    eyes(D, ep, S * 0.11, { wide: 1.4, tilt: -0.2 });
    // 涎
    blood(D, hx - S * 1.2, hy + S * 1.1, 2, S * 0.6);
  }

  // ---------------------------------------------------------
  // 這いずる者（上半身だけで這う）
  // ---------------------------------------------------------
  function crawler(D, d) {
    const { ctx, w, h, r } = D;
    const ground = h * 0.94;
    const fog = groundFog(D, ground, 1);
    const cx = w * 0.55;
    // 引きずる背骨と臓物
    const sp = bez([cx + w * 0.05, ground - h * 0.2], [cx + w * 0.2, ground - h * 0.1], [cx + w * 0.3, ground - h * 0.02], [cx + w * 0.42, ground - h * 0.01], 18);
    fillPts(D, band(sp, h * 0.035, 3), 'meat', { rimW: 3 });
    for (let i = 2; i < sp.length - 2; i += 2) fillEllipse(D, sp[i][0], sp[i][1] - h * 0.01, h * 0.022, h * 0.016, 'bone', { plain: true, rimW: 1 });
    // 胴（前傾して地面すれすれ）
    const torso = [[cx - w * 0.2, ground - h * 0.42], [cx + w * 0.02, ground - h * 0.4], [cx + w * 0.12, ground - h * 0.25], [cx + w * 0.07, ground - h * 0.13], [cx - w * 0.12, ground - h * 0.16], [cx - w * 0.24, ground - h * 0.3]];
    fillPts(D, torso, 'pale', { smooth: true, rim: 0.55 });
    for (let k = 0; k < 4; k++) {
      ctx.strokeStyle = 'rgba(0,0,0,0.4)';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(cx - w * 0.1 + k * w * 0.04, ground - h * 0.38);
      ctx.quadraticCurveTo(cx - w * 0.06 + k * w * 0.04, ground - h * 0.28, cx - w * 0.1 + k * w * 0.04, ground - h * 0.18);
      ctx.stroke();
    }
    // 長い腕で這う（左腕は前へ伸び、右腕は地面を掴む）
    arm(D, [cx - w * 0.17, ground - h * 0.38], [cx - w * 0.36, ground - h * 0.5], [cx - w * 0.44, ground - h * 0.06], h * 0.021, 'pale', { claws: true });
    arm(D, [cx - w * 0.05, ground - h * 0.36], [cx - w * 0.1, ground - h * 0.52], [cx - w * 0.22, ground - h * 0.03], h * 0.022, 'pale', { claws: true });
    // 頭（顎が外れたように開く）
    const hx = cx - w * 0.24;
    const hy = ground - h * 0.48;
    const R = h * 0.065;
    fillPts(D, tatter(D, [hx - R * 0.9, hy - R * 0.7], [hx + R * 0.9, hy - R * 0.7], [hx - R * 1.2, hy + R * 1.6], [hx + R * 1.3, hy + R * 1.4], { teeth: 10, depth: R * 0.7, topCurve: R * 0.6 }), 'shadow', { rim: 0.4 });
    fillPts(D, ellipsePts(hx, hy, R * 0.75, R * 0.95, 30, 0.04, r), 'pale', { rimW: 3 });
    maw(D, hx, hy + R * 0.55, R * 0.7, R * 0.9);
    ctx.fillStyle = '#050202';
    for (const s of [-1, 1]) { ctx.beginPath(); ctx.ellipse(hx + s * R * 0.3, hy - R * 0.25, R * 0.18, R * 0.22, 0, 0, TAU); ctx.fill(); }
    eyes(D, [[hx - R * 0.3, hy - R * 0.25], [hx + R * 0.3, hy - R * 0.25]], R * 0.12);
    blood(D, hx, hy + R * 1.0, 4, R * 1.2);
    fog();
    embers(D, 12, { x: w * 0.1, y: h * 0.3, w: w * 0.8, h: h * 0.6 });
  }

  // ---------------------------------------------------------
  // 異形（肉塊・蛭・心臓・眼の群れ・聖歌隊・母体・深淵の主）
  // ---------------------------------------------------------
  function faceIn(D, x, y, R) {
    // 肉に埋まった人の顔
    const { ctx } = D;
    fillEllipse(D, x, y, R * 0.75, R, 'pale', { plain: true, rimW: 2 });
    ctx.fillStyle = '#060202';
    for (const s of [-1, 1]) { ctx.beginPath(); ctx.ellipse(x + s * R * 0.3, y - R * 0.15, R * 0.16, R * 0.2, 0, 0, TAU); ctx.fill(); }
    ctx.beginPath(); ctx.ellipse(x, y + R * 0.45, R * 0.2, R * 0.3, 0, 0, TAU); ctx.fill();
  }
  function tendril(D, a, b, wd, mat = 'meat', bend = 0.3) {
    const { r } = D;
    const mx = lerp(a[0], b[0], 0.5) + (r() - 0.5) * Math.abs(b[1] - a[1]) * bend * 2;
    const my = lerp(a[1], b[1], 0.5) + (r() - 0.5) * Math.abs(b[0] - a[0]) * bend;
    const pts = bez(a, [lerp(a[0], mx, 0.7), lerp(a[1], my, 0.7)], [lerp(b[0], mx, 0.7), lerp(b[1], my, 0.7)], b, 16);
    fillPts(D, band(pts, wd, 1), mat, { rimW: 3 });
    return pts;
  }

  function fleshGolem(D, d) {
    // 肉塊の番人：巨大な肉の巨人（humanoid に任せる）
    humanoid(D, d);
  }

  function worm(D, d) {
    // 培養液の蛭：S字に立ち上がる体節と円形の口
    const { ctx, w, h, r } = D;
    const ground = h * 0.94;
    const fog = groundFog(D, ground, 0.9);
    const pts = bez([w * 0.72, ground - h * 0.03], [w * 0.95, ground - h * 0.35], [w * 0.2, ground - h * 0.45], [w * 0.45, ground - h * 0.78], 30);
    // 体節を奥から順に
    for (let i = 0; i < pts.length; i++) {
      const t = i / (pts.length - 1);
      const R = h * (0.09 + Math.sin(t * Math.PI) * 0.06);
      fillEllipse(D, pts[i][0], pts[i][1], R, R * 0.8, 'green', { rimW: 6, ao: 0.7 });
      if (i % 3 === 0) {
        ctx.strokeStyle = 'rgba(0,0,0,0.35)';
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.ellipse(pts[i][0], pts[i][1], R * 0.95, R * 0.75, 0, 0.2, Math.PI - 0.2); ctx.stroke();
      }
    }
    // 管に繋がれた跡
    for (let k = 0; k < 3; k++) {
      const p = pts[8 + k * 6];
      tendril(D, p, [p[0] + w * (0.15 + r() * 0.1), p[1] - h * (0.1 + r() * 0.1)], 4, 'dsteel', 0.4);
    }
    // 口（同心円の牙）
    const m = pts[pts.length - 1];
    const R = h * 0.13;
    fillEllipse(D, m[0], m[1], R, R * 0.9, 'meat', { rimW: 6 });
    ctx.fillStyle = '#0a0000';
    ctx.beginPath(); ctx.ellipse(m[0], m[1], R * 0.75, R * 0.65, 0, 0, TAU); ctx.fill();
    glow(ctx, m[0], m[1], R * 1.2, rgbaA(D.L.eye), 0.35);
    for (let ring = 0; ring < 3; ring++) {
      const rr = R * (0.72 - ring * 0.2);
      const n = 16 - ring * 4;
      for (let k = 0; k < n; k++) {
        const a = (k / n) * TAU + ring * 0.3;
        spike(D, m[0] + Math.cos(a) * rr, m[1] + Math.sin(a) * rr * 0.87, a + Math.PI, rr * 0.35, rr * 0.08, 'bone');
      }
    }
    blood(D, m[0], m[1] + R * 0.8, 4, R * 0.8);
    fog();
    embers(D, 10, { x: w * 0.1, y: h * 0.2, w: w * 0.8, h: h * 0.7 });
  }

  function mass(D, d) {
    // 塔の落とし子：石と肉が混ざった塊から無数の腕が伸びる
    const { ctx, w, h, r } = D;
    const ground = h * 0.95;
    const fog = groundFog(D, ground, 1.2);
    const cx = w * 0.5;
    const cy = ground - h * 0.32;
    aura(D, cx, cy, h * 0.6, 0.3);
    // 伸びる腕（奥）
    for (let k = 0; k < 9; k++) {
      const a = Math.PI + (k / 8) * Math.PI + (r() - 0.5) * 0.2;
      const len = h * (0.32 + r() * 0.15);
      const p0 = [cx + Math.cos(a) * w * 0.15, cy + Math.sin(a) * h * 0.12];
      const el = [cx + Math.cos(a) * len * 0.7, cy + Math.sin(a) * len * 0.9];
      const hd = [cx + Math.cos(a + (r() - 0.5) * 0.4) * len, cy + Math.sin(a) * len * 1.1 + h * 0.05];
      arm(D, p0, el, hd, h * 0.022, k % 3 ? 'pale' : 'char', { claws: true, thinHand: true });
    }
    // 塊
    const body = ellipsePts(cx, cy, w * 0.3, h * 0.27, 48, 0.07, r);
    fillPts(D, body, 'meat', { smooth: true, rim: 0.6, rimW: 9 });
    // 埋まった石片
    for (let k = 0; k < 6; k++) {
      const sx = cx + (r() - 0.5) * w * 0.45;
      const sy = cy + (r() - 0.5) * h * 0.35;
      const s = h * (0.03 + r() * 0.04);
      fillPts(D, [[sx - s, sy - s * 0.4], [sx - s * 0.2, sy - s], [sx + s, sy - s * 0.5], [sx + s * 0.8, sy + s * 0.6], [sx - s * 0.6, sy + s * 0.7]], 'stone', { rimW: 3 });
    }
    for (let k = 0; k < 4; k++) faceIn(D, cx + (r() - 0.5) * w * 0.35, cy + (r() - 0.3) * h * 0.25, h * 0.04);
    maw(D, cx, cy + h * 0.08, w * 0.24, h * 0.1);
    eyes(D, [[cx - w * 0.08, cy - h * 0.1], [cx + w * 0.07, cy - h * 0.12], [cx, cy - h * 0.18]], h * 0.015);
    fog();
    embers(D, 18, { x: w * 0.1, y: h * 0.1, w: w * 0.8, h: h * 0.8 });
  }

  function heart(D, d) {
    // 塔の心臓：石に食い込んだ巨大な心臓、太い血管と鎖
    const { ctx, w, h, r } = D;
    const ground = h * 0.95;
    const fog = groundFog(D, ground, 1.2);
    const cx = w * 0.5;
    const cy = h * 0.5;
    glow(ctx, cx, cy, h * 0.6, 'rgba(255,40,30,A)', 0.4);
    // 血管（四方の闇へ伸びる）
    for (let k = 0; k < 10; k++) {
      const a = (k / 10) * TAU + r() * 0.3;
      tendril(D, [cx + Math.cos(a) * w * 0.12, cy + Math.sin(a) * h * 0.12], [cx + Math.cos(a) * w * 0.55, cy + Math.sin(a) * h * 0.55], h * (0.02 + r() * 0.015), k % 3 ? 'meat' : 'purple', 0.4);
    }
    // 大動脈
    for (const [ox, oy, rr] of [[-0.08, -0.25, 0.05], [0.04, -0.28, 0.06], [0.13, -0.2, 0.04]]) {
      const p0 = [cx + ox * w, cy - h * 0.08];
      fillPts(D, band(bez(p0, [p0[0], cy + oy * h], [p0[0] + ox * w * 2, cy + oy * h * 1.3], [p0[0] + ox * w * 2.5, h * 0.04], 14), h * rr, h * rr * 0.8), 'meat', { rimW: 5 });
    }
    const body = [[cx - w * 0.05, cy - h * 0.2], [cx + w * 0.22, cy - h * 0.18], [cx + w * 0.28, cy + h * 0.02], [cx + w * 0.08, cy + h * 0.3], [cx - w * 0.04, cy + h * 0.33], [cx - w * 0.25, cy + h * 0.1], [cx - w * 0.27, cy - h * 0.1]];
    fillPts(D, body, 'meat', { smooth: true, rim: 0.7, rimW: 10 });
    // 表面の血管
    ctx.save();
    smoothPath(ctx, body);
    ctx.clip();
    for (let k = 0; k < 12; k++) {
      let x = cx + (r() - 0.5) * w * 0.4;
      let y = cy - h * 0.15;
      ctx.strokeStyle = `rgba(${40 + r() * 40},10,${60 + r() * 40},0.7)`;
      ctx.lineWidth = 2 + r() * 3;
      ctx.beginPath();
      ctx.moveTo(x, y);
      for (let i = 0; i < 8; i++) { x += (r() - 0.5) * 30; y += h * 0.04; ctx.lineTo(x, y); }
      ctx.stroke();
    }
    ctx.restore();
    // 締め付ける鎖と杭
    chain(D, bez([cx - w * 0.4, cy - h * 0.35], [cx - w * 0.1, cy - h * 0.05], [cx + w * 0.15, cy + h * 0.1], [cx + w * 0.42, cy + h * 0.38], 18), h * 0.014);
    chain(D, bez([cx + w * 0.42, cy - h * 0.3], [cx + w * 0.15, cy - h * 0.02], [cx - w * 0.1, cy + h * 0.12], [cx - w * 0.42, cy + h * 0.36], 18), h * 0.014);
    for (const [px, py, a] of [[-0.15, 0.05, -0.6], [0.18, -0.06, -2.4], [0.02, 0.22, -1.9]]) spike(D, cx + px * w, cy + py * h, a, h * 0.14, h * 0.018, 'rust');
    for (let k = 0; k < 4; k++) eyes(D, [[cx + (r() - 0.5) * w * 0.3, cy + (r() - 0.4) * h * 0.3]], h * 0.012);
    blood(D, cx + w * 0.02, cy + h * 0.3, 6, h * 0.1);
    fog();
    embers(D, 24, { x: w * 0.05, y: h * 0.05, w: w * 0.9, h: h * 0.9 });
  }

  function eyeCluster(D, d) {
    const { ctx, w, h, r } = D;
    const cx = w * 0.5;
    const cy = h * 0.42;
    aura(D, cx, cy, h * 0.5, 0.35);
    // 垂れ下がる視神経
    for (let k = 0; k < 9; k++) tendril(D, [cx + (r() - 0.5) * w * 0.3, cy + h * 0.08], [cx + (r() - 0.5) * w * 0.6, h * (0.82 + r() * 0.1)], h * 0.012, k % 2 ? 'meat' : 'purple', 0.5);
    const list = [];
    for (let k = 0; k < 15; k++) {
      const a = r() * TAU;
      const dd = Math.sqrt(r());
      list.push([cx + Math.cos(a) * dd * w * 0.25, cy + Math.sin(a) * dd * h * 0.22, h * (0.035 + r() * 0.05)]);
    }
    list.sort((a, b) => a[2] - b[2]);
    for (const [x, y, R] of list) {
      fillEllipse(D, x, y, R, R, 'porcelain', { rimW: 4, plain: true });
      // 充血
      ctx.save();
      ctx.beginPath(); ctx.arc(x, y, R, 0, TAU); ctx.clip();
      for (let i = 0; i < 6; i++) {
        const a = r() * TAU;
        line(D, [x + Math.cos(a) * R, y + Math.sin(a) * R], [x + Math.cos(a) * R * 0.5, y + Math.sin(a) * R * 0.5], 'rgba(160,20,20,0.6)', 1.2);
      }
      ctx.restore();
      const lx = x - R * 0.25;
      const ly = y + R * 0.05;
      ctx.fillStyle = rgba(D.L.eye, 0.95);
      ctx.beginPath(); ctx.arc(lx, ly, R * 0.45, 0, TAU); ctx.fill();
      ctx.fillStyle = '#000';
      ctx.beginPath(); ctx.ellipse(lx, ly, R * 0.12, R * 0.35, 0, 0, TAU); ctx.fill();
      glow(ctx, lx, ly, R * 1.4, rgbaA(D.L.eye), 0.3);
    }
    embers(D, 20, { x: w * 0.1, y: h * 0.1, w: w * 0.8, h: h * 0.8 });
  }

  function choir(D, d) {
    // 聖歌隊の首：燭台のような環に吊るされた首たち
    const { ctx, w, h, r } = D;
    const cx = w * 0.5;
    const cy = h * 0.4;
    halo(D, cx, cy - h * 0.05, h * 0.3);
    // 吊り鎖
    for (const x of [cx - w * 0.3, cx, cx + w * 0.3]) chain(D, [[x * 0.8 + cx * 0.2, 0], [x, cy - h * 0.12]], h * 0.01);
    // 鉄の環
    ctx.strokeStyle = 'rgba(0,0,0,0.9)';
    ctx.lineWidth = h * 0.03;
    ctx.beginPath(); ctx.ellipse(cx, cy - h * 0.1, w * 0.36, h * 0.07, 0, 0, TAU); ctx.stroke();
    ctx.strokeStyle = 'rgba(110,90,60,0.95)';
    ctx.lineWidth = h * 0.015;
    ctx.stroke();
    for (let k = 0; k < 7; k++) {
      const a = (k / 7) * TAU;
      const x = cx + Math.cos(a) * w * 0.36;
      const y = cy - h * 0.1 + Math.sin(a) * h * 0.07;
      if (Math.sin(a) < 0) flameTip(D, x, y - 6, h * 0.02);
    }
    const heads = [[-0.3, 0.12], [-0.12, 0.2], [0.08, 0.22], [0.27, 0.13], [-0.2, 0.42], [0.02, 0.46], [0.22, 0.4]];
    heads.forEach(([ox, oy], i) => {
      const x = cx + ox * w;
      const y = cy + oy * h * 0.8;
      const R = h * (i < 4 ? 0.07 : 0.06);
      line(D, [x, cy - h * 0.1], [x, y - R], 'rgba(150,140,120,0.6)', 1.5);
      // 髪
      fillPts(D, tatter(D, [x - R * 0.9, y - R * 0.8], [x + R * 0.9, y - R * 0.8], [x - R * 1.0, y + R * 0.9], [x + R * 1.0, y + R * 0.9], { teeth: 8, depth: R * 0.5, topCurve: R * 0.5 }), 'shadow', { rim: 0.3 });
      fillPts(D, ellipsePts(x, y, R * 0.7, R * 0.9, 26, 0.03, r), 'pale', { rimW: 3 });
      ctx.fillStyle = '#060202';
      for (const s of [-1, 1]) { ctx.beginPath(); ctx.ellipse(x + s * R * 0.28, y - R * 0.15, R * 0.15, R * 0.2, 0, 0, TAU); ctx.fill(); }
      eyes(D, [[x - R * 0.28, y - R * 0.15], [x + R * 0.28, y - R * 0.15]], R * 0.09, { wide: 0.8 });
      ctx.fillStyle = '#050000';
      ctx.beginPath(); ctx.ellipse(x, y + R * 0.45, R * 0.18, R * 0.3, 0, 0, TAU); ctx.fill();
      blood(D, x, y + R * 0.85, 2, R * 0.7);
    });
    embers(D, 22, { x: w * 0.1, y: h * 0.05, w: w * 0.8, h: h * 0.9 });
  }

  function mother(D, d) {
    // 寄生体マザー：卵嚢の腹と蜘蛛の脚、その上に痩せた女の上半身
    const { ctx, w, h, r } = D;
    const ground = h * 0.95;
    const fog = groundFog(D, ground, 1.3);
    const cx = w * 0.5;
    const ay = ground - h * 0.24;
    // 脚（奥）
    for (let k = 0; k < 8; k++) {
      const s = k % 2 ? 1 : -1;
      const i = Math.floor(k / 2);
      const p0 = [cx + s * w * 0.1, ay - h * 0.02];
      const kn = [cx + s * w * (0.28 + i * 0.05), ay - h * (0.25 - i * 0.03)];
      const ft = [cx + s * w * (0.36 + i * 0.03), ground - 2];
      const m = i < 2 ? 'char' : 'shadow';
      fillPts(D, band(seg(p0, kn), h * 0.018, h * 0.014), m, {});
      fillPts(D, band(seg(kn, ft), h * 0.014, 1), m, {});
      spike(D, kn[0], kn[1], -Math.PI / 2 + s * 0.3, h * 0.04, h * 0.008, 'bone');
    }
    // 卵嚢
    const sac = ellipsePts(cx + w * 0.02, ay, w * 0.22, h * 0.16, 40, 0.06, r);
    fillPts(D, sac, 'meat', { smooth: true, rimW: 8 });
    for (let k = 0; k < 14; k++) {
      const ex = cx + (r() - 0.5) * w * 0.32;
      const ey = ay + (r() - 0.5) * h * 0.2;
      const er = h * (0.014 + r() * 0.018);
      glow(ctx, ex, ey, er * 3, rgbaA(D.L.eye), 0.35);
      fillEllipse(D, ex, ey, er, er * 0.8, 'wax', { plain: true, rimW: 1 });
    }
    // 上半身
    const ty = ay - h * 0.14;
    const torso = [[cx - w * 0.07, ty - h * 0.24], [cx + w * 0.07, ty - h * 0.24], [cx + w * 0.05, ty - h * 0.08], [cx + w * 0.08, ty + h * 0.04], [cx - w * 0.08, ty + h * 0.04], [cx - w * 0.05, ty - h * 0.08]];
    fillPts(D, torso, 'pale', { smooth: true, rim: 0.6 });
    for (let k = 0; k < 4; k++) line(D, [cx - w * 0.05, ty - h * (0.18 - k * 0.03)], [cx + w * 0.05, ty - h * (0.18 - k * 0.03)], 'rgba(0,0,0,0.35)', 2);
    for (const s of [-1, 1]) arm(D, [cx + s * w * 0.07, ty - h * 0.22], [cx + s * w * 0.2, ty - h * 0.3], [cx + s * w * 0.26, ty - h * 0.12], h * 0.016, 'pale', { claws: true });
    // 頭と棘の冠・長い髪
    const hx = cx;
    const hy = ty - h * 0.31;
    const R = h * 0.05;
    fillPts(D, tatter(D, [hx - R, hy - R * 0.8], [hx + R, hy - R * 0.8], [hx - R * 1.8, hy + R * 4], [hx + R * 1.8, hy + R * 4], { teeth: 14, depth: R, topCurve: R * 0.6 }), 'shadow', { rim: 0.4 });
    fillPts(D, ellipsePts(hx, hy, R * 0.75, R * 1.0, 30, 0, r), 'pale', { rimW: 3 });
    for (let k = 0; k < 7; k++) {
      const a = -Math.PI / 2 + (k - 3) * 0.32;
      spike(D, hx + Math.cos(a) * R * 0.8, hy + Math.sin(a) * R * 0.9, a, R * (1.2 + (k === 3 ? 0.8 : 0)), R * 0.12, 'bone');
    }
    ctx.fillStyle = '#060202';
    for (const s of [-1, 1]) { ctx.beginPath(); ctx.ellipse(hx + s * R * 0.3, hy - R * 0.1, R * 0.18, R * 0.24, 0, 0, TAU); ctx.fill(); }
    eyes(D, [[hx - R * 0.3, hy - R * 0.1], [hx + R * 0.3, hy - R * 0.1]], R * 0.14);
    line(D, [hx - R * 0.3, hy + R * 0.5], [hx + R * 0.3, hy + R * 0.5], 'rgba(30,0,0,0.9)', 2);
    fog();
    embers(D, 18, { x: w * 0.05, y: h * 0.1, w: w * 0.9, h: h * 0.85 });
  }

  function devourer(D, d) {
    // 夜明けを喰らうもの：黒い太陽（日蝕）を背負い、王冠と無数の腕を持つ巨影
    const { ctx, w, h, r } = D;
    const cx = w * 0.5;
    const ground = h * 0.96;
    const sunY = h * 0.3;
    const sunR = w * 0.3;
    // コロナ
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let k = 0; k < 60; k++) {
      const a = (k / 60) * TAU + r() * 0.05;
      const l = sunR * (1.15 + r() * 0.55);
      const g = ctx.createLinearGradient(cx + Math.cos(a) * sunR, sunY + Math.sin(a) * sunR, cx + Math.cos(a) * l, sunY + Math.sin(a) * l);
      g.addColorStop(0, 'rgba(255,200,120,0.55)');
      g.addColorStop(1, 'rgba(255,120,60,0)');
      ctx.strokeStyle = g;
      ctx.lineWidth = 2 + r() * 5;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * sunR * 0.98, sunY + Math.sin(a) * sunR * 0.98);
      ctx.lineTo(cx + Math.cos(a) * l, sunY + Math.sin(a) * l);
      ctx.stroke();
    }
    ctx.restore();
    glow(ctx, cx, sunY, sunR * 1.6, 'rgba(255,170,90,A)', 0.45);
    ctx.fillStyle = '#000';
    ctx.beginPath(); ctx.arc(cx, sunY, sunR, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(255,230,180,0.9)';
    ctx.lineWidth = 3;
    ctx.stroke();
    // 本体：humanoid 風の巨影（ローブ）
    humanoid(D, {
      armor: 'robe', bodyMat: 'shadow', skin: 'char', size: 1.0, bulk: 1.5, headR: 0.055, robeFlare: 1.6,
      head: 'mitre', headOpt: { mat: 'shadow', eyes: 7 }, extraArms: 3, claws: true, pose: 'wide', embers: 30, cape: 'shadow', capeFlare: 0.6,
    });
    // 王冠を上書き
  }

  // ---------------------------------------------------------
  // 敵ごとの設計図
  // ---------------------------------------------------------
  const DESIGNS = {
    // --- 地下牢 ---
    rot_rat: { kind: 'beast', mat: 'fur', tail: 'long', incisors: true, tall: 0.42, size: 0.95, headSize: 1.05, mane: 22, embers: 8 },
    crawler: { kind: 'crawler' },
    rusted_sentry: { kind: 'humanoid', armor: 'rust', head: 'bucket', size: 0.95, bulk: 1.0, tabard: 'red', weapon: { type: 'halberd', headMat: 'rust' }, embers: 10 },
    iron_jailer: { kind: 'humanoid', armor: 'rust', head: 'mask', bulk: 1.25, hunch: 0.6, weapon: { type: 'flail', pose: 'drag' }, leftItem: 'keys', chains: true, tabard: 'leather', size: 0.97 },
    // --- 研究棟 ---
    specimen7: { kind: 'humanoid', armor: 'flesh', bodyMat: 'green', head: 'sack', bulk: 1.55, chest: 1.25, hunch: 1, headR: 0.06, straps: true, stitches: true, longArms: true, claws: true, armBulk: 1.5, legBulk: 1.3, size: 0.98 },
    vat_leech: { kind: 'worm' },
    labcoat_revenant: { kind: 'humanoid', armor: 'coat', head: 'goggles', thin: true, bulk: 0.9, hunch: 0.5, longArms: true, claws: true, pose: 'reach', leftItem: 'syringe', skin: 'pale', size: 1.0 },
    failed_chimera: { kind: 'beast', mat: 'flesh', heads: 2, horns: true, stitches: true, spiky: true, tall: 0.55, headSize: 0.9, tail: 'long', ribs: true },
    // --- 礼拝堂 ---
    praying_corpse: { kind: 'humanoid', armor: 'robe', bodyMat: 'cloth', skin: 'pale', head: 'thorns', pose: 'pray', thin: true, bulk: 0.95, hunch: 0.8, halo: 'broken', size: 0.95 },
    candle_wraith: { kind: 'wraith', head: 'wax', mat: 'cloth', size: 0.9, leftItem: 'lantern' },
    black_zealot: { kind: 'humanoid', armor: 'robe', bodyMat: 'cloth', skin: 'pale', head: 'hood', headOpt: { mat: 'cloth' }, weapon: { type: 'sickle' }, leftItem: 'censer', bulk: 0.95, chains: false, size: 0.97 },
    choir_heads: { kind: 'choir' },
    // --- 機関区画 ---
    cog_hound: { kind: 'beast', mat: 'dsteel', bodyMat: 'rust', headMat: 'rust', gears: true, metalJaw: true, ribs: true, tall: 0.5, ears: false, spiky: true, mane: 12 },
    steam_husk: { kind: 'humanoid', armor: 'flesh', bodyMat: 'char', skin: 'char', head: 'faceless', headOpt: { mat: 'char' }, backTank: true, steam: true, hunch: 0.5, headR: 0.065, bulk: 1.15, longArms: true, claws: true },
    hanged_marionette: { kind: 'humanoid', armor: 'robe', bodyMat: 'red', skin: 'porcelain', head: 'marionette', lift: 0.08, limp: true, strings: true, joints: true, bulk: 0.85, thin: true, sleeves: false, robeFlare: 1.1, size: 0.88, weapon: { type: 'sickle' } },
    incinerator_keeper: { kind: 'humanoid', armor: 'plate', bodyMat: 'dsteel', head: 'greathelm', furnace: true, bulk: 1.35, hunch: 0.4, weapon: { type: 'hammer', ember: true, headMat: 'rust' }, cape: 'char', spikes: 2, embers: 40 },
    // --- 深淵 ---
    shade_eater: { kind: 'beast', mat: 'shadow', manyEyes: true, tall: 0.55, spiky: false, mane: 26, ribs: false, ears: true, embers: 30 },
    eye_swarm: { kind: 'eyes' },
    empty_armor: { kind: 'humanoid', armor: 'plate', bodyMat: 'steel', head: 'greathelm', headOpt: { plume: true }, cape: 'red', weapon: { type: 'greatsword', pose: 'planted', glowing: true }, bulk: 1.15, spikes: 0, size: 1.0, embers: 20 },
    tower_spawn: { kind: 'mass' },
    // --- ボス ---
    boss_flesh_warden: { kind: 'humanoid', armor: 'flesh', bodyMat: 'meat', skin: 'meat', head: 'faceless', headOpt: { mat: 'meat', eyes: true }, bulk: 1.75, chest: 1.3, hunch: 1, headR: 0.058, longArms: true, claws: true, armBulk: 1.7, legBulk: 1.5, chains: true, weapon: { type: 'cleaver', pose: 'drag', width: 0.12 }, stitches: true, size: 1.0 },
    boss_stitched_nurse: { kind: 'humanoid', armor: 'robe', bodyMat: 'cloth', apron: true, skin: 'pale', head: 'nurse', thin: true, bulk: 1.0, size: 1.0, headR: 0.055, extraArms: 1, claws: true, weapon: { type: 'scissors' }, robeFlare: 1.2 },
    boss_writhing_researcher: { kind: 'humanoid', armor: 'coat', head: 'split', thin: true, bulk: 1.05, tentacles: 11, longArms: true, claws: true, pose: 'wide', size: 1.0, skin: 'pale' },
    boss_twin_hound: { kind: 'beast', mat: 'fur', heads: 2, tall: 0.6, size: 1.0, collar: true, mane: 26, headSize: 1.0, horns: false, embers: 20 },
    boss_belfry_wraith: { kind: 'wraith', head: 'bell', mat: 'shadow', size: 1.0, bulk: 1.15, bellBack: false, holdRight: (D, hd, Ht) => polearm(D, [hd[0] + 4, hd[1] + Ht * 0.45], [hd[0] - 6, hd[1] - Ht * 0.18], Ht * 0.008, 'hammer', {}) , leftItem: 'chain' },
    boss_parasite_mother: { kind: 'mother' },
    boss_iron_executioner: { kind: 'humanoid', armor: 'plate', bodyMat: 'dsteel', head: 'executioner', headOpt: { mat: 'red' }, bulk: 1.5, hunch: 0.3, headR: 0.06, weapon: { type: 'cleaver', pose: 'drag', width: 0.17 }, leftItem: 'head', cape: 'red', spikes: 3, size: 1.0 },
    boss_abyss_priest: { kind: 'humanoid', armor: 'robe', bodyMat: 'purple', skin: 'char', head: 'mitre', headOpt: { mat: 'purple', eyes: 5 }, halo: true, weapon: { type: 'eye', poleMat: 'dsteel' }, extraArms: 1, claws: true, bulk: 1.1, size: 1.0, cape: 'shadow', robeFlare: 1.45, aura: 0.3 },
    boss_tower_heart: { kind: 'heart' },
    boss_dawn_devourer: { kind: 'devourer' },
  };
  const FALLBACK = {
    humanoid: { kind: 'humanoid', armor: 'plate', head: 'horned', cape: true, weapon: { type: 'greatsword', pose: 'planted' } },
    beast: { kind: 'beast' },
    floating: { kind: 'wraith' },
    blob: { kind: 'mass' },
  };

  window.drawEnemyArt = function (ctx, w, h, spec) {
    const r = rng(hash(spec.id || spec.path));
    const L = ZONE_LIGHT[Math.max(0, Math.min(4, (spec.zone || 1) - 1))];
    const D = { ctx, w, h, r, L };
    const d = DESIGNS[spec.id] || FALLBACK[spec.archetype] || FALLBACK.blob;
    switch (d.kind) {
      case 'humanoid': humanoid(D, d); break;
      case 'wraith': wraith(D, d); break;
      case 'beast': beast(D, d); break;
      case 'crawler': crawler(D, d); break;
      case 'worm': worm(D, d); break;
      case 'mass': mass(D, d); break;
      case 'heart': heart(D, d); break;
      case 'eyes': eyeCluster(D, d); break;
      case 'choir': choir(D, d); break;
      case 'mother': mother(D, d); break;
      case 'devourer': devourer(D, d); break;
      default: mass(D, d);
    }
  };
})();
