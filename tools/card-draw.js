// =============================================================
// card-draw.js  【ツール：カードの仮画像の描画（ブラウザ内で実行）】
// -------------------------------------------------------------
// placeholder-draw.js の後に読み込まれ、カードに関係する画像だけを描く。
// （部品の関数は placeholder-draw.js が window.__pd に公開したものを使う）
//
// 目指す見た目：「黒鉄の枠に、古びた羊皮紙と銅版画の挿絵を収めた重厚なカード」
//   - 枠：黒く焼けた鉄板（ざらつき・錆・槌目）＋レア度ごとの金属の縁取り
//   - イラスト窓：尖頭アーチ（ゴシック窓）。窓の内側に影を落として奥行きを出す
//   - 説明欄：焦げ跡・染み・繊維のある羊皮紙。文字は墨色（CSS）
//   - 挿絵：ろうそくの光に照らされた、線影（ハッチング）入りの版画風
//   - 紋章：羊皮紙に押した墨の印
//
//   種類            spec.type   大きさ（2倍解像度）  表示サイズ
//   ----------------------------------------------------------
//   枠              cardFrame   440 x 616           220 x 308
//   名札            cardPlate   440 x 76            220 x 38
//   コスト          costGem     128 x 128           56 x 56
//   裏面            cardBack    440 x 616
//   挿絵            cardArt     480 x 450           200 x 180
//   紋章（墨の印）  sigil       96 x 96
//
// ★座標は CSS（src/styles/card.css）の配置と対応している。変える時は両方そろえること。
// =============================================================
/* eslint-disable */
(function () {
  const { TAU, EMOJI, hash, rng, canvasOf, metal, roundRectPath, bevelStroke, gem, glow, vignette } = window.__pd;

  /** レア度ごとの縁取りの金属と、宝石の色相 */
  const RARITY = {
    basic: { trim: 'bronze', gem: 24 },
    common: { trim: 'silver', gem: 205 },
    rare: { trim: 'gold', gem: 40 },
    legendary: { trim: 'gold', gem: 352 },
  };
  /** 種類・系統ごとの光の色（挿絵の背景の灯り） */
  const TINT = {
    attack: [190, 72, 46], defense: [96, 132, 176], support: [206, 150, 60], buff: [206, 150, 60], debuff: [128, 80, 210], special: [70, 160, 116],
    sword: [200, 96, 62], magic: [126, 86, 222], blood: [178, 18, 34], curse: [96, 158, 70],
  };
  const rgba = (c, a) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;
  const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));

  // =============================================================
  // 質感
  // =============================================================
  /** 点々のざらつき */
  function speckle(ctx, x, y, w, h, r, count, dark = 0.12, light = 0.05, size = 1.6) {
    for (let i = 0; i < count; i++) {
      const d = r() < 0.6;
      ctx.fillStyle = d ? `rgba(0,0,0,${dark * r()})` : `rgba(255,236,210,${light * r()})`;
      const s = 0.6 + r() * size;
      ctx.fillRect(x + r() * w, y + r() * h, s, s);
    }
  }

  /** 黒く焼けた鉄板（pathFn の内側を塗る） */
  function ironFill(ctx, pathFn, box, r) {
    const [x, y, w, h] = box;
    ctx.save();
    pathFn();
    let g = ctx.createLinearGradient(x, y, x + w * 0.4, y + h);
    g.addColorStop(0, '#2a2724');
    g.addColorStop(0.45, '#141210');
    g.addColorStop(1, '#1f1b18');
    ctx.fillStyle = g;
    ctx.fill();
    pathFn();
    ctx.clip();
    // 槌目（ハンマーで叩いた凹凸）
    for (let i = 0; i < (w * h) / 900; i++) {
      const px = x + r() * w;
      const py = y + r() * h;
      const rr = 4 + r() * 10;
      const hg = ctx.createRadialGradient(px - rr * 0.3, py - rr * 0.3, 0, px, py, rr);
      hg.addColorStop(0, 'rgba(255,240,220,0.05)');
      hg.addColorStop(0.6, 'rgba(0,0,0,0)');
      hg.addColorStop(1, 'rgba(0,0,0,0.08)');
      ctx.fillStyle = hg;
      ctx.fillRect(px - rr, py - rr, rr * 2, rr * 2);
    }
    // 錆
    for (let i = 0; i < 7; i++) {
      const px = x + r() * w;
      const py = y + r() * h;
      const rr = 10 + r() * 40;
      const rg = ctx.createRadialGradient(px, py, 0, px, py, rr);
      rg.addColorStop(0, `rgba(120,52,18,${0.1 + r() * 0.12})`);
      rg.addColorStop(1, 'rgba(120,52,18,0)');
      ctx.fillStyle = rg;
      ctx.fillRect(px - rr, py - rr, rr * 2, rr * 2);
    }
    speckle(ctx, x, y, w, h, r, (w * h) / 40, 0.22, 0.06);
    // 上からの光
    g = ctx.createLinearGradient(0, y, 0, y + h);
    g.addColorStop(0, 'rgba(255,240,220,0.07)');
    g.addColorStop(0.5, 'rgba(255,240,220,0)');
    g.addColorStop(1, 'rgba(0,0,0,0.25)');
    ctx.fillStyle = g;
    ctx.fillRect(x, y, w, h);
    ctx.restore();
  }

  /** 縁が少し欠けた四角のパス（羊皮紙用） */
  function raggedRectPath(ctx, x, y, w, h, r, amp = 2.4) {
    const pts = [];
    const step = 7;
    for (let i = 0; i <= w; i += step) pts.push([x + i, y + r() * amp]);
    for (let i = 0; i <= h; i += step) pts.push([x + w - r() * amp, y + i]);
    for (let i = w; i >= 0; i -= step) pts.push([x + i, y + h - r() * amp]);
    for (let i = h; i >= 0; i -= step) pts.push([x + r() * amp, y + i]);
    ctx.beginPath();
    pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
    ctx.closePath();
  }

  /** 古びた羊皮紙 */
  function parchment(ctx, x, y, w, h, r) {
    // 何度呼んでも同じ形になるよう、縁のギザギザは固定の乱数で作る
    const seed = Math.floor(r() * 1e9);
    const path = () => raggedRectPath(ctx, x, y, w, h, rng(seed));
    ctx.save();
    path();
    let g = ctx.createRadialGradient(x + w * 0.45, y + h * 0.4, 10, x + w / 2, y + h / 2, w * 0.7);
    g.addColorStop(0, '#e6d4ae');
    g.addColorStop(0.6, '#d2b886');
    g.addColorStop(1, '#a8854e');
    ctx.fillStyle = g;
    ctx.fill();
    path();
    ctx.clip();
    // 染み
    for (let i = 0; i < 14; i++) {
      const px = x + r() * w;
      const py = y + r() * h;
      const rr = 6 + r() * 30;
      const sg = ctx.createRadialGradient(px, py, 0, px, py, rr);
      sg.addColorStop(0, `rgba(120,78,30,${0.03 + r() * 0.06})`);
      sg.addColorStop(1, 'rgba(120,78,30,0)');
      ctx.fillStyle = sg;
      ctx.fillRect(px - rr, py - rr, rr * 2, rr * 2);
    }
    // 輪じみ
    for (let i = 0; i < 2; i++) {
      ctx.strokeStyle = `rgba(110,66,24,${0.08 + r() * 0.07})`;
      ctx.lineWidth = 1 + r() * 1.5;
      ctx.beginPath();
      ctx.arc(x + r() * w, y + r() * h, 18 + r() * 26, r() * TAU, r() * TAU + 4.5);
      ctx.stroke();
    }
    // 繊維
    for (let i = 0; i < (w * h) / 160; i++) {
      const px = x + r() * w;
      const py = y + r() * h;
      const a = (r() - 0.5) * 0.6;
      const len = 3 + r() * 9;
      ctx.strokeStyle = r() < 0.5 ? `rgba(90,58,26,${0.05 + r() * 0.06})` : `rgba(255,248,230,${0.05 + r() * 0.06})`;
      ctx.lineWidth = 0.6;
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(px + Math.cos(a) * len, py + Math.sin(a) * len);
      ctx.stroke();
    }
    // 小さな点（そばかす状の古い染み）
    for (let i = 0; i < 40; i++) {
      ctx.fillStyle = `rgba(110,60,20,${0.1 + r() * 0.2})`;
      ctx.beginPath();
      ctx.arc(x + r() * w, y + r() * h, 0.6 + r() * 1.6, 0, TAU);
      ctx.fill();
    }
    speckle(ctx, x, y, w, h, r, (w * h) / 30, 0.08, 0.08);
    // 焦げた縁（内側の影）
    path();
    ctx.shadowColor = 'rgba(70,32,8,0.95)';
    ctx.shadowBlur = 18;
    ctx.strokeStyle = 'rgba(60,28,8,0.75)';
    ctx.lineWidth = 9;
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.restore();
    path();
    ctx.strokeStyle = 'rgba(40,18,6,0.85)';
    ctx.lineWidth = 1.6;
    ctx.stroke();
  }

  /** 尖頭アーチ（ゴシック窓）のパス */
  function archPath(ctx, x, y, w, h, spring, rb = 10) {
    ctx.beginPath();
    ctx.moveTo(x, y + spring);
    // 頂点で接線が折れる＝尖ったアーチになる
    ctx.bezierCurveTo(x, y + spring * 0.5, x + w * 0.3, y + spring * 0.2, x + w / 2, y);
    ctx.bezierCurveTo(x + w * 0.7, y + spring * 0.2, x + w, y + spring * 0.5, x + w, y + spring);
    ctx.lineTo(x + w, y + h - rb);
    ctx.quadraticCurveTo(x + w, y + h, x + w - rb, y + h);
    ctx.lineTo(x + rb, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - rb);
    ctx.closePath();
  }

  /** 鋲（ドーム状の金属） */
  function rivet(ctx, x, y, s, kind) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, s, 0, TAU);
    ctx.shadowColor = 'rgba(0,0,0,0.85)';
    ctx.shadowBlur = s * 0.8;
    ctx.shadowOffsetY = s * 0.3;
    const g = ctx.createRadialGradient(x - s * 0.35, y - s * 0.4, 0, x, y, s);
    const m = { gold: ['#fff2c4', '#c0882e', '#3a2306'], silver: ['#ffffff', '#8a909a', '#1e2026'], bronze: ['#ffd8a8', '#9a5a26', '#2a1406'], iron: ['#a8a8ac', '#3a3a3e', '#0c0c0e'] }[kind] || ['#ccc', '#555', '#111'];
    g.addColorStop(0, m[0]);
    g.addColorStop(0.45, m[1]);
    g.addColorStop(1, m[2]);
    ctx.fillStyle = g;
    ctx.fill();
    ctx.restore();
  }

  /** 角の金具（とがった L 字の留め金） */
  function cornerBracket(ctx, x, y, rot, size, kind, gemHue) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    const t = size * 0.2;
    const path = () => {
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(size, 0);
      ctx.lineTo(size + t * 1.6, t * 0.5); // 先端のとげ
      ctx.lineTo(size, t);
      ctx.lineTo(t * 1.25, t);
      ctx.quadraticCurveTo(t, t, t, t * 1.25);
      ctx.lineTo(t, size);
      ctx.lineTo(t * 0.5, size + t * 1.6);
      ctx.lineTo(0, size);
      ctx.closePath();
    };
    path();
    ctx.shadowColor = 'rgba(0,0,0,0.8)';
    ctx.shadowBlur = 8;
    ctx.shadowOffsetY = 3;
    ctx.fillStyle = metal(ctx, 0, 0, size, size, kind);
    ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.strokeStyle = 'rgba(0,0,0,0.7)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    // 彫り込みの線
    ctx.strokeStyle = 'rgba(0,0,0,0.45)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(t * 0.5, size * 0.92);
    ctx.lineTo(t * 0.5, t * 0.5);
    ctx.lineTo(size * 0.92, t * 0.5);
    ctx.stroke();
    if (gemHue !== undefined) gem(ctx, t * 1.55, t * 1.55, t * 0.62, gemHue, 6, kind);
    else rivet(ctx, t * 1.5, t * 1.5, t * 0.5, kind);
    ctx.restore();
  }

  /** 古びた金属にする（くすみ） */
  function tarnish(ctx, pathFn, box, r, amount = 0.35) {
    const [x, y, w, h] = box;
    ctx.save();
    pathFn();
    ctx.clip();
    ctx.globalCompositeOperation = 'multiply';
    for (let i = 0; i < 20; i++) {
      const px = x + r() * w;
      const py = y + r() * h;
      const rr = 20 + r() * 80;
      const g = ctx.createRadialGradient(px, py, 0, px, py, rr);
      g.addColorStop(0, `rgba(60,44,30,${amount * r()})`);
      g.addColorStop(1, 'rgba(60,44,30,0)');
      ctx.fillStyle = g;
      ctx.fillRect(px - rr, py - rr, rr * 2, rr * 2);
    }
    ctx.restore();
  }

  // =============================================================
  // 枠（イラスト窓は透明。説明欄の羊皮紙までを含む）
  //   CSS 換算：イラスト窓 x14〜206 / y14〜184、羊皮紙 x14〜206 / y202〜290
  // =============================================================
  function drawCardFrame(ctx, w, h, spec) {
    const st = RARITY[spec.variant] || RARITY.basic;
    const kind = st.trim;
    const r = rng(hash('frame' + spec.variant));
    const box = [0, 0, w, h];
    const body = () => roundRectPath(ctx, 2, 2, w - 4, h - 4, 24);
    ironFill(ctx, body, box, r);

    // 縁取り（外周）
    const rim = () => roundRectPath(ctx, 9, 9, w - 18, h - 18, 18);
    bevelStroke(ctx, rim, 9, kind, box);
    // 内側の彫り線
    ctx.strokeStyle = 'rgba(0,0,0,0.65)';
    ctx.lineWidth = 2;
    roundRectPath(ctx, 19, 19, w - 38, h - 38, 12);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,230,190,0.07)';
    ctx.lineWidth = 1;
    roundRectPath(ctx, 20.5, 20.5, w - 38, h - 38, 12);
    ctx.stroke();
    if (spec.variant === 'legendary') {
      // 血の象嵌（ルビー色の細い線）
      ctx.save();
      ctx.shadowColor = 'rgba(255,40,40,0.8)';
      ctx.shadowBlur = 8;
      ctx.strokeStyle = metal(ctx, 0, 0, w, h, 'ruby');
      ctx.lineWidth = 3;
      roundRectPath(ctx, 19, 19, w - 38, h - 38, 12);
      ctx.stroke();
      ctx.restore();
    }

    // ---- イラスト窓（尖頭アーチ） ----
    const ax = 28, ay = 28, aw = 384, ah = 340, spring = 150;
    const arch = () => archPath(ctx, ax, ay, aw, ah, spring);
    // 窓の外周の段（彫り込み）
    ctx.save();
    archPath(ctx, ax - 8, ay - 10, aw + 16, ah + 18, spring + 4, 14);
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.shadowColor = 'rgba(0,0,0,0.9)';
    ctx.shadowBlur = 10;
    ctx.fill();
    ctx.restore();
    ctx.save();
    ctx.globalCompositeOperation = 'destination-out';
    arch();
    ctx.fill();
    ctx.restore();
    // 窓の内側に落ちる影（挿絵の上に重なって奥行きが出る）
    ctx.save();
    arch();
    ctx.clip();
    ctx.shadowColor = 'rgba(0,0,0,0.95)';
    ctx.shadowBlur = 26;
    ctx.lineWidth = 34;
    ctx.strokeStyle = 'rgba(0,0,0,0.7)';
    archPath(ctx, ax - 17, ay - 22, aw + 34, ah + 34, spring + 10, 20);
    ctx.stroke();
    ctx.restore();
    bevelStroke(ctx, arch, 7, kind, box);
    // アーチの頂点の要石（宝石）
    gem(ctx, w / 2, ay + 4, 12, st.gem, 6, kind);

    // ---- 説明欄（羊皮紙） ----
    const px = 28, py = 404, pw = 384, ph = 176;
    ctx.save();
    roundRectPath(ctx, px - 7, py - 7, pw + 14, ph + 14, 10);
    ctx.fillStyle = '#080706';
    ctx.shadowColor = 'rgba(0,0,0,0.9)';
    ctx.shadowBlur = 8;
    ctx.fill();
    ctx.restore();
    bevelStroke(ctx, () => roundRectPath(ctx, px - 7, py - 7, pw + 14, ph + 14, 10), 4, kind, box);
    parchment(ctx, px, py, pw, ph, r);

    // ---- 金具・鋲 ----
    const legendaryGem = spec.variant === 'legendary' ? 352 : undefined;
    cornerBracket(ctx, 5, 8, 0, 86, kind, legendaryGem);
    cornerBracket(ctx, w - 5, 8, Math.PI / 2, 86, kind, legendaryGem);
    cornerBracket(ctx, w - 5, h - 5, Math.PI, 86, kind, legendaryGem);
    cornerBracket(ctx, 5, h - 5, -Math.PI / 2, 86, kind, legendaryGem);
    for (const y of [200, 300]) {
      rivet(ctx, 15, y, 4.5, kind);
      rivet(ctx, w - 15, y, 4.5, kind);
    }
    rivet(ctx, 15, 490, 4.5, kind);
    rivet(ctx, w - 15, 490, 4.5, kind);
    // 下部中央：レア度の宝石
    gem(ctx, w / 2, h - 13, 12, st.gem, 8, kind);
    tarnish(ctx, body, box, r, spec.variant === 'basic' ? 0.4 : 0.28);
  }

  // =============================================================
  // 名札（カード名の台座）。両端の宝石は CSS で種類の色に塗る
  // =============================================================
  function drawCardPlate(ctx, w, h, spec) {
    const st = RARITY[spec.variant] || RARITY.basic;
    const kind = st.trim;
    const r = rng(hash('plate' + spec.variant));
    const cy = h / 2;
    const path = () => {
      ctx.beginPath();
      ctx.moveTo(6, cy);
      ctx.lineTo(34, 8);
      ctx.lineTo(w - 34, 8);
      ctx.lineTo(w - 6, cy);
      ctx.lineTo(w - 34, h - 8);
      ctx.lineTo(34, h - 8);
      ctx.closePath();
    };
    ctx.save();
    path();
    ctx.shadowColor = 'rgba(0,0,0,0.9)';
    ctx.shadowBlur = 10;
    ctx.shadowOffsetY = 4;
    ctx.fillStyle = '#000';
    ctx.fill();
    ctx.restore();
    ironFill(ctx, path, [0, 0, w, h], r);
    // 中央を少し明るく（文字の下地）
    ctx.save();
    path();
    ctx.clip();
    const g = ctx.createLinearGradient(0, 8, 0, h - 8);
    g.addColorStop(0, 'rgba(255,230,190,0.10)');
    g.addColorStop(0.5, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(0,0,0,0.35)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
    bevelStroke(ctx, path, 5, kind, [0, 0, w, h]);
    // 内側の細い線
    ctx.strokeStyle = 'rgba(0,0,0,0.6)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(42, 15);
    ctx.lineTo(w - 42, 15);
    ctx.moveTo(42, h - 15);
    ctx.lineTo(w - 42, h - 15);
    ctx.stroke();
    tarnish(ctx, path, [0, 0, w, h], r, 0.25);
  }

  // =============================================================
  // コスト（血色のガラス玉を収めた、とげのある鉄の台座）
  // =============================================================
  function drawCostGem(ctx, w, h) {
    const cx = w / 2;
    const cy = h / 2;
    const R = w * 0.46;
    // とげ
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.9)';
    ctx.shadowBlur = 8;
    ctx.shadowOffsetY = 3;
    ctx.beginPath();
    const n = 8;
    for (let i = 0; i <= n * 2; i++) {
      const a = (i / (n * 2)) * TAU - Math.PI / 2;
      const rr = i % 2 ? R * 0.74 : R;
      i ? ctx.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr) : ctx.moveTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
    }
    ctx.closePath();
    ctx.fillStyle = metal(ctx, 0, 0, w, h, 'bronze');
    ctx.fill();
    ctx.restore();
    ctx.strokeStyle = 'rgba(0,0,0,0.6)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    // 鉄の輪
    ctx.beginPath();
    ctx.arc(cx, cy, R * 0.74, 0, TAU);
    ctx.fillStyle = metal(ctx, 0, 0, w, h, 'iron');
    ctx.fill();
    bevelStroke(ctx, () => { ctx.beginPath(); ctx.arc(cx, cy, R * 0.72, 0, TAU); }, 4, 'gold', [0, 0, w, h]);
    // ガラス玉
    ctx.beginPath();
    ctx.arc(cx, cy, R * 0.6, 0, TAU);
    ctx.fillStyle = '#000';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx, cy, R * 0.56, 0, TAU);
    const g = ctx.createRadialGradient(cx - R * 0.16, cy - R * 0.2, R * 0.04, cx, cy + R * 0.05, R * 0.6);
    g.addColorStop(0, '#ff7a52');
    g.addColorStop(0.35, '#b81410');
    g.addColorStop(0.75, '#4a0404');
    g.addColorStop(1, '#170101');
    ctx.fillStyle = g;
    ctx.fill();
    // 中の灯り（下から）
    glow(ctx, cx, cy + R * 0.25, R * 0.45, 'rgba(255,90,40,A)', 0.45);
    // 反射
    ctx.beginPath();
    ctx.ellipse(cx - R * 0.14, cy - R * 0.3, R * 0.3, R * 0.13, -0.35, 0, TAU);
    ctx.fillStyle = 'rgba(255,240,230,0.35)';
    ctx.fill();
  }

  // =============================================================
  // 紋章（羊皮紙に押した墨の印）
  // =============================================================
  function drawSigil(ctx, w, h, spec) {
    const r = rng(hash('sigil' + spec.path));
    const size = w * 0.56;
    const m = canvasOf(w, h);
    const mc = m.getContext('2d');
    mc.font = `${size}px ${EMOJI}`;
    mc.textAlign = 'center';
    mc.textBaseline = 'middle';
    mc.filter = 'grayscale(1) contrast(1.6)';
    mc.fillText(spec.symbol, w / 2, h / 2 + size * 0.04);
    mc.filter = 'none';
    // 明るさを「墨の濃さ」に変える（暗い線ほど濃く、明るい面は薄く）→ 絵柄の線が残る
    const id = mc.getImageData(0, 0, w, h);
    const px = id.data;
    for (let i = 0; i < px.length; i += 4) {
      const L = px[i] / 255;
      px[i + 3] = Math.round(px[i + 3] * (0.28 + 0.72 * (1 - L)));
      px[i] = 42; px[i + 1] = 20; px[i + 2] = 8;
    }
    mc.putImageData(id, 0, 0);
    // かすれ
    mc.globalCompositeOperation = 'destination-out';
    for (let i = 0; i < 160; i++) {
      mc.fillStyle = `rgba(0,0,0,${0.3 + r() * 0.6})`;
      mc.beginPath();
      mc.arc(r() * w, r() * h, 0.4 + r() * 1.4, 0, TAU);
      mc.fill();
    }
    ctx.globalAlpha = 0.92;
    ctx.drawImage(m, 0, 0);
    ctx.globalAlpha = 1;
    if (spec.ring !== false) {
      // 印の輪（二重線）
      ctx.strokeStyle = 'rgba(42,20,8,0.75)';
      ctx.lineWidth = w * 0.035;
      ctx.beginPath();
      ctx.arc(w / 2, h / 2, w * 0.47, 0, TAU);
      ctx.stroke();
      ctx.lineWidth = w * 0.015;
      ctx.beginPath();
      ctx.arc(w / 2, h / 2, w * 0.41, 0, TAU);
      ctx.stroke();
    }
  }

  // =============================================================
  // 挿絵（ろうそくの光の中に浮かぶ、版画風のモチーフ）
  // =============================================================
  /** 平行線の模様（線影） */
  function hatch(w, h, spacing, angle, color, lw) {
    const c = canvasOf(w, h);
    const x = c.getContext('2d');
    x.strokeStyle = color;
    x.lineWidth = lw;
    x.translate(w / 2, h / 2);
    x.rotate(angle);
    const L = Math.hypot(w, h);
    for (let i = -L; i < L; i += spacing) {
      x.beginPath();
      x.moveTo(-L, i);
      x.lineTo(L, i);
      x.stroke();
    }
    return c;
  }

  /** モチーフ（絵文字を版画風に加工） */
  function subject(ctx, ch, cx, cy, size, tint, r) {
    const S = Math.ceil(size * 1.6);
    const ox = cx - S / 2;
    const oy = cy - S / 2;
    const mask = canvasOf(S, S);
    const m = mask.getContext('2d');
    m.font = `${size}px ${EMOJI}`;
    m.textAlign = 'center';
    m.textBaseline = 'middle';
    m.fillText(ch, S / 2, S / 2 + size * 0.04);
    const solid = (color) => {
      const c = canvasOf(S, S);
      const x = c.getContext('2d');
      x.drawImage(mask, 0, 0);
      x.globalCompositeOperation = 'source-in';
      x.fillStyle = color;
      x.fillRect(0, 0, S, S);
      return c;
    };

    // 背後の灯り（シルエットを浮かび上がらせる）
    ctx.save();
    ctx.shadowColor = rgba(mix(tint, [255, 220, 170], 0.3), 0.95);
    ctx.shadowBlur = size * 0.28;
    ctx.drawImage(solid('rgba(10,6,4,1)'), ox, oy);
    ctx.restore();

    // 本体：色を落として古い彩色版画のように
    const art = canvasOf(S, S);
    const a = art.getContext('2d');
    a.filter = 'grayscale(0.4) sepia(0.45) contrast(1.35) brightness(0.92) saturate(1.2)';
    a.drawImage(mask, 0, 0);
    a.filter = 'none';
    a.globalCompositeOperation = 'color';
    a.fillStyle = rgba(tint, 0.3);
    a.fillRect(0, 0, S, S);
    // 光と影（左上から光、右下は闇に沈む）
    a.globalCompositeOperation = 'multiply';
    const sh = a.createLinearGradient(S * 0.3, S * 0.25, S * 0.72, S * 0.82);
    sh.addColorStop(0, 'rgba(255,250,240,1)');
    sh.addColorStop(0.55, 'rgba(190,160,135,1)');
    sh.addColorStop(1, 'rgba(45,30,24,1)');
    a.fillStyle = sh;
    a.fillRect(0, 0, S, S);
    // 線影（影側ほど濃い。交差させて銅版画の調子に）
    const hs = canvasOf(S, S);
    const hx = hs.getContext('2d');
    hx.drawImage(hatch(S, S, 4, -0.7, 'rgba(30,18,10,1)', 1.2), 0, 0);
    hx.drawImage(hatch(S, S, 5, 0.65, 'rgba(30,18,10,1)', 1), 0, 0);
    hx.globalCompositeOperation = 'destination-in';
    const hm = hx.createLinearGradient(S * 0.35, S * 0.3, S * 0.75, S * 0.8);
    hm.addColorStop(0, 'rgba(0,0,0,0.05)');
    hm.addColorStop(1, 'rgba(0,0,0,0.9)');
    hx.fillStyle = hm;
    hx.fillRect(0, 0, S, S);
    a.globalCompositeOperation = 'multiply';
    a.drawImage(hs, 0, 0);
    // 光の当たる側にハイライト
    a.globalCompositeOperation = 'screen';
    const hl = a.createRadialGradient(S * 0.36, S * 0.3, 0, S * 0.36, S * 0.3, S * 0.35);
    hl.addColorStop(0, rgba(mix(tint, [255, 236, 200], 0.7), 0.45));
    hl.addColorStop(1, 'rgba(0,0,0,0)');
    a.fillStyle = hl;
    a.fillRect(0, 0, S, S);
    a.globalCompositeOperation = 'destination-in';
    a.drawImage(mask, 0, 0);

    // 輪郭（墨の線）
    const ink = solid('rgba(14,8,4,0.95)');
    const d = Math.max(2, size * 0.014);
    for (let i = 0; i < 8; i++) ctx.drawImage(ink, ox + Math.cos((i / 8) * TAU) * d, oy + Math.sin((i / 8) * TAU) * d);
    ctx.drawImage(art, ox, oy);

    // 縁の光（左上から）
    const rim = canvasOf(S, S);
    const rc = rim.getContext('2d');
    rc.drawImage(mask, 0, 0);
    rc.globalCompositeOperation = 'source-in';
    rc.fillStyle = rgba(mix(tint, [255, 228, 180], 0.65), 1);
    rc.fillRect(0, 0, S, S);
    rc.globalCompositeOperation = 'destination-out';
    rc.drawImage(mask, size * 0.03, size * 0.035);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.75;
    ctx.drawImage(rim, ox, oy);
    ctx.restore();
  }

  /** 背景の尖頭アーチの回廊（奥行き） */
  function archways(ctx, w, h, r) {
    ctx.save();
    for (let i = 0; i < 3; i++) {
      const s = 1 - i * 0.22;
      const aw = w * 0.86 * s;
      const ahh = h * 1.0 * s;
      const x = (w - aw) / 2;
      const y = h * 0.92 - ahh;
      archPath(ctx, x, y, aw, ahh, aw * 0.42, 0);
      ctx.strokeStyle = `rgba(6,4,3,${0.85 - i * 0.18})`;
      ctx.lineWidth = 34 * s;
      ctx.stroke();
      archPath(ctx, x - 17 * s, y - 14 * s, aw + 34 * s, ahh + 14 * s, aw * 0.45, 0);
      ctx.strokeStyle = `rgba(255,220,180,${0.05 - i * 0.012})`;
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawCardArt(ctx, w, h, spec) {
    const r = rng(hash(spec.path));
    const tint = TINT[spec.variant] || TINT.attack;
    // 下地
    ctx.fillStyle = '#0c0806';
    ctx.fillRect(0, 0, w, h);
    // 灯り
    const lx = w / 2;
    const ly = h * 0.46;
    let g = ctx.createRadialGradient(lx, ly, 6, lx, ly, w * 0.62);
    g.addColorStop(0, rgba(mix(tint, [255, 224, 170], 0.45), 0.95));
    g.addColorStop(0.3, rgba(tint, 0.55));
    g.addColorStop(0.7, rgba(mix(tint, [0, 0, 0], 0.7), 0.35));
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    // 背景の回廊
    archways(ctx, w, h, r);
    // 床
    g = ctx.createLinearGradient(0, h * 0.7, 0, h);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(0,0,0,0.75)');
    ctx.fillStyle = g;
    ctx.fillRect(0, h * 0.7, w, h * 0.3);
    ctx.save();
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.lineWidth = 1.5;
    for (let i = -8; i <= 8; i++) {
      ctx.beginPath();
      ctx.moveTo(lx + i * 14, h * 0.8);
      ctx.lineTo(lx + i * 90, h);
      ctx.stroke();
    }
    ctx.restore();
    // 背景全体の線影（外側ほど濃い＝銅版画の調子）
    const hc = canvasOf(w, h);
    const hx = hc.getContext('2d');
    hx.drawImage(hatch(w, h, 4, -0.75, 'rgba(0,0,0,1)', 1.2), 0, 0);
    hx.drawImage(hatch(w, h, 6, 0.55, 'rgba(0,0,0,1)', 1), 0, 0);
    hx.globalCompositeOperation = 'destination-in';
    const hm = hx.createRadialGradient(lx, ly, w * 0.12, lx, ly, w * 0.7);
    hm.addColorStop(0, 'rgba(0,0,0,0)');
    hm.addColorStop(1, 'rgba(0,0,0,0.75)');
    hx.fillStyle = hm;
    hx.fillRect(0, 0, w, h);
    ctx.drawImage(hc, 0, 0);
    // 床に落ちる影
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(lx, h * 0.8, w * 0.24, h * 0.04, 0, 0, TAU);
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.filter = 'blur(6px)';
    ctx.fill();
    ctx.restore();
    // モチーフ
    subject(ctx, spec.symbol, lx, h * 0.5, h * 0.56, tint, r);
    // 火の粉・塵
    for (let i = 0; i < 46; i++) {
      const px = r() * w;
      const py = r() * h;
      const big = r() < 0.2;
      glow(ctx, px, py, big ? 3 + r() * 5 : 1 + r() * 2, rgba(mix(tint, [255, 210, 150], 0.6), 'A'), big ? 0.7 : 0.9);
    }
    // 霧
    for (let i = 0; i < 6; i++) {
      const fx = r() * w;
      const fy = h * (0.72 + r() * 0.3);
      const rw = 120 + r() * 180;
      const fg = ctx.createRadialGradient(fx, fy, 0, fx, fy, rw);
      fg.addColorStop(0, rgba(mix(tint, [200, 190, 170], 0.6), 0.1 + r() * 0.08));
      fg.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = fg;
      ctx.beginPath();
      ctx.ellipse(fx, fy, rw, rw * 0.3, 0, 0, TAU);
      ctx.fill();
    }
    vignette(ctx, w, h, 0.88, 0.46);
    // 紙に刷ったような質感（温かい色をかけ、ざらつき・擦り傷を足す）
    ctx.save();
    ctx.globalCompositeOperation = 'multiply';
    ctx.fillStyle = 'rgba(232,206,166,1)';
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
    speckle(ctx, 0, 0, w, h, r, (w * h) / 22, 0.25, 0.08);
    ctx.save();
    for (let i = 0; i < 14; i++) {
      ctx.strokeStyle = `rgba(255,235,205,${0.03 + r() * 0.05})`;
      ctx.lineWidth = 0.7;
      ctx.beginPath();
      const sx = r() * w;
      const sy = r() * h;
      ctx.moveTo(sx, sy);
      ctx.lineTo(sx + (r() - 0.5) * 120, sy + (r() - 0.5) * 60);
      ctx.stroke();
    }
    ctx.restore();
  }

  // =============================================================
  // 裏面（黒鉄の枠に、型押しの革と真鍮の「眼」の紋章）
  // =============================================================
  function drawCardBack(ctx, w, h) {
    const r = rng(hash('cardback'));
    const box = [0, 0, w, h];
    const body = () => roundRectPath(ctx, 2, 2, w - 4, h - 4, 24);
    ironFill(ctx, body, box, r);
    bevelStroke(ctx, () => roundRectPath(ctx, 9, 9, w - 18, h - 18, 18), 9, 'gold', box);
    // 革のパネル
    const lx = 34, ly = 34, lw = w - 68, lh = h - 68;
    const leather = () => roundRectPath(ctx, lx, ly, lw, lh, 12);
    ctx.save();
    leather();
    let g = ctx.createRadialGradient(w / 2, h / 2, 10, w / 2, h / 2, w * 0.8);
    g.addColorStop(0, '#4a1210');
    g.addColorStop(0.6, '#260807');
    g.addColorStop(1, '#100302');
    ctx.fillStyle = g;
    ctx.fill();
    leather();
    ctx.clip();
    speckle(ctx, lx, ly, lw, lh, r, (lw * lh) / 18, 0.3, 0.05, 1.2);
    // 型押しの菱形模様
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.lineWidth = 2;
    for (let i = -h; i < w + h; i += 36) {
      ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i - h * 0.6, h); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i + h * 0.6, h); ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(255,200,170,0.04)';
    ctx.lineWidth = 1;
    for (let i = -h; i < w + h; i += 36) {
      ctx.beginPath(); ctx.moveTo(i + 2, 0); ctx.lineTo(i + 2 - h * 0.6, h); ctx.stroke();
    }
    // 内側の影
    leather();
    ctx.shadowColor = 'rgba(0,0,0,1)';
    ctx.shadowBlur = 24;
    ctx.strokeStyle = 'rgba(0,0,0,0.8)';
    ctx.lineWidth = 14;
    ctx.stroke();
    ctx.restore();
    bevelStroke(ctx, leather, 4, 'gold', box);
    ctx.strokeStyle = 'rgba(217,178,106,0.35)';
    ctx.lineWidth = 1.5;
    roundRectPath(ctx, lx + 14, ly + 14, lw - 28, lh - 28, 8);
    ctx.stroke();
    // 中央の光線（とげ）
    const cx = w / 2, cy = h / 2;
    ctx.save();
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * TAU;
      const len = i % 2 ? 120 : 165;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a - 0.07) * 70, cy + Math.sin(a - 0.07) * 70);
      ctx.lineTo(cx + Math.cos(a) * len, cy + Math.sin(a) * len);
      ctx.lineTo(cx + Math.cos(a + 0.07) * 70, cy + Math.sin(a + 0.07) * 70);
      ctx.closePath();
      ctx.fillStyle = metal(ctx, cx - len, cy - len, cx + len, cy + len, 'gold');
      ctx.shadowColor = 'rgba(0,0,0,0.8)';
      ctx.shadowBlur = 6;
      ctx.fill();
    }
    ctx.restore();
    // 眼のメダリオン
    ctx.beginPath();
    ctx.arc(cx, cy, 80, 0, TAU);
    ctx.fillStyle = metal(ctx, cx - 80, cy - 80, cx + 80, cy + 80, 'gold');
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx, cy, 68, 0, TAU);
    ctx.fillStyle = '#0c0504';
    ctx.fill();
    bevelStroke(ctx, () => { ctx.beginPath(); ctx.arc(cx, cy, 68, 0, TAU); }, 3, 'gold', box);
    // 眼（アーモンド形＋瞳）
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(cx - 54, cy);
    ctx.quadraticCurveTo(cx, cy - 46, cx + 54, cy);
    ctx.quadraticCurveTo(cx, cy + 46, cx - 54, cy);
    ctx.closePath();
    ctx.fillStyle = metal(ctx, cx - 54, cy - 30, cx + 54, cy + 30, 'gold');
    ctx.shadowColor = 'rgba(0,0,0,0.9)';
    ctx.shadowBlur = 6;
    ctx.fill();
    ctx.restore();
    ctx.beginPath();
    ctx.arc(cx, cy, 20, 0, TAU);
    g = ctx.createRadialGradient(cx - 5, cy - 6, 1, cx, cy, 20);
    g.addColorStop(0, '#ff6a4a');
    g.addColorStop(0.5, '#a80c0a');
    g.addColorStop(1, '#200202');
    ctx.fillStyle = g;
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(cx, cy, 4, 14, 0, 0, TAU);
    ctx.fillStyle = '#080202';
    ctx.fill();
    glow(ctx, cx, cy, 60, 'rgba(255,60,30,A)', 0.35);
    // 角の金具
    cornerBracket(ctx, 8, 8, 0, 70, 'gold');
    cornerBracket(ctx, w - 8, 8, Math.PI / 2, 70, 'gold');
    cornerBracket(ctx, w - 8, h - 8, Math.PI, 70, 'gold');
    cornerBracket(ctx, 8, h - 8, -Math.PI / 2, 70, 'gold');
    tarnish(ctx, body, box, r, 0.3);
  }

  // =============================================================
  // 入口（placeholder-draw.js の drawAsset から呼ばれる）
  // =============================================================
  window.drawCardAsset = function (ctx, w, h, spec) {
    switch (spec.type) {
      case 'cardFrame': drawCardFrame(ctx, w, h, spec); return true;
      case 'cardPlate': drawCardPlate(ctx, w, h, spec); return true;
      case 'costGem': drawCostGem(ctx, w, h, spec); return true;
      case 'cardBack': drawCardBack(ctx, w, h, spec); return true;
      case 'cardArt': drawCardArt(ctx, w, h, spec); return true;
      case 'sigil': drawSigil(ctx, w, h, spec); return true;
    }
    return false;
  };
})();
