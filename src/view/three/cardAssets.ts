// =============================================================
// cardAssets.ts  【3D：カードの部品（テクスチャ・形・材質）】
// -------------------------------------------------------------
// three.js で描くカード（CardLayer.ts）の部品を作り、使い回せるように保存する。
//
// ■ 座標：カードの中心が原点、1 = CSS の 1px（カードは 220 x 308）、Y は上向き
//
// ■ カードの立体の構造（手前 → 奥）
//   コスト    … 星形の台座＋金の輪＋血色のガラス玉＋数字（+14px ほど飛び出す）
//   名札      … 六角形の板（+4px）。両端に種類の色の宝石
//   金具・鋲  … 角の L 字金具、側面の鋲、アーチの要石
//   表面      … 枠の画像＋羊皮紙＋説明文（金属部分は反射し、凹凸がある）
//   本体      … 厚み 8px の板。イラスト窓の部分は穴が開いている
//   窓の奥    … 穴の奥に 30px の「箱」があり、その底に挿絵（傾けると覗き込める）
//
// 文字は Canvas に描いてテクスチャにする（説明文の数値は戦闘中に変わるので、
// 表示内容が変わったら作り直す）。
// =============================================================
import * as THREE from 'three';
import { IMAGES } from '@/data/images';
import type { CardDef, Rarity } from '@/model/types';
import { asset } from '../dom';

export const CARD_W = 220;
export const CARD_H = 308;
/** 本体の厚み */
export const BODY_D = 8;
const BEVEL = 1.2;
/** 表面の Z（本体の手前の面） */
export const FRONT_Z = BODY_D + BEVEL + 0.05;
/** 窓の奥の深さ */
const BOX_DEPTH = 30;
/** テクスチャの解像度（CSS px の何倍で描くか） */
const K = 3;

// ---------------------------------------------------------------
// 画像の読み込み
// ---------------------------------------------------------------
const imgCache = new Map<string, Promise<HTMLImageElement>>();
export function loadImage(path: string): Promise<HTMLImageElement> {
  let p = imgCache.get(path);
  if (!p) {
    p = new Promise((resolve, reject) => {
      const im = new Image();
      im.crossOrigin = 'anonymous';
      im.onload = () => resolve(im);
      im.onerror = () => reject(new Error(`image load failed: ${path}`));
      im.src = /^(https?:|data:|blob:)/.test(path) ? path : asset(path);
    });
    imgCache.set(path, p);
  }
  return p;
}

/** フォントの読み込みを待つ（Canvas の文字は読み込み済みのフォントでしか描けない） */
let fontsReady: Promise<unknown> | null = null;
export function waitFonts(): Promise<unknown> {
  fontsReady ??= Promise.all([
    document.fonts.load('700 14px "Shippori Mincho B1"'),
    document.fonts.load('800 17px "Shippori Mincho B1"'),
    document.fonts.load('900 20px "Cinzel"'),
  ]).catch(() => null);
  return fontsReady;
}

function canvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = Math.ceil(w);
  c.height = Math.ceil(h);
  return [c, c.getContext('2d')!];
}

function colorTexture(c: HTMLCanvasElement | HTMLImageElement): THREE.Texture {
  const t = c instanceof HTMLCanvasElement ? new THREE.CanvasTexture(c) : new THREE.Texture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  t.needsUpdate = true;
  return t;
}

// ---------------------------------------------------------------
// 形（パス）
// ---------------------------------------------------------------
/** CSS 座標（左上原点・Y 下向き）→ カード座標（中心原点・Y 上向き） */
const X = (x: number) => x - CARD_W / 2;
const Y = (y: number) => CARD_H / 2 - y;

function roundRectShape(x: number, y: number, w: number, h: number, r: number): THREE.Shape {
  // x, y はカード座標の左下
  const s = new THREE.Shape();
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r);
  s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h);
  s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r);
  s.quadraticCurveTo(x, y, x + r, y);
  return s;
}

/** イラスト窓（尖頭アーチ）。tools/card-draw.js の archPath と同じ形（CSS 座標 x14, y14, 192x170, spring 75） */
function archPath(p: THREE.Path | THREE.Shape, inset = 0): void {
  const x = 14 + inset, y = 14 + inset, w = 192 - inset * 2, h = 170 - inset * 2, sp = 75, rb = 5;
  p.moveTo(X(x), Y(y + sp));
  p.bezierCurveTo(X(x), Y(y + sp * 0.5), X(x + w * 0.3), Y(y + sp * 0.2), X(x + w / 2), Y(y));
  p.bezierCurveTo(X(x + w * 0.7), Y(y + sp * 0.2), X(x + w), Y(y + sp * 0.5), X(x + w), Y(y + sp));
  p.lineTo(X(x + w), Y(y + h - rb));
  p.quadraticCurveTo(X(x + w), Y(y + h), X(x + w - rb), Y(y + h));
  p.lineTo(X(x + rb), Y(y + h));
  p.quadraticCurveTo(X(x), Y(y + h), X(x), Y(y + h - rb));
  p.closePath();
}

// ---------------------------------------------------------------
// 形（ジオメトリ）… 全カードで共通なので1回だけ作る
// ---------------------------------------------------------------
let geo: ReturnType<typeof buildGeometries> | null = null;
export function geometries() {
  geo ??= buildGeometries();
  return geo;
}

function buildGeometries() {
  // 本体（窓の穴あき）
  const body = roundRectShape(-CARD_W / 2, -CARD_H / 2, CARD_W, CARD_H, 12);
  const hole = new THREE.Path();
  archPath(hole);
  body.holes.push(hole);
  const bodyGeo = new THREE.ExtrudeGeometry(body, { depth: BODY_D, bevelEnabled: true, bevelThickness: BEVEL, bevelSize: BEVEL, bevelSegments: 3, curveSegments: 24 });

  // 窓の奥の箱（内側の壁だけ使う）
  const win = new THREE.Shape();
  archPath(win);
  const boxGeo = new THREE.ExtrudeGeometry(win, { depth: BOX_DEPTH, bevelEnabled: false, curveSegments: 24 });
  boxGeo.translate(0, 0, -BOX_DEPTH + 0.5);

  // 名札（六角形の板）
  const plate = new THREE.Shape();
  const pw = 214, ph = 30;
  plate.moveTo(-pw / 2, 0);
  plate.lineTo(-pw / 2 + 13, ph / 2);
  plate.lineTo(pw / 2 - 13, ph / 2);
  plate.lineTo(pw / 2, 0);
  plate.lineTo(pw / 2 - 13, -ph / 2);
  plate.lineTo(-pw / 2 + 13, -ph / 2);
  plate.closePath();
  const plateGeo = new THREE.ExtrudeGeometry(plate, { depth: 3, bevelEnabled: true, bevelThickness: 0.8, bevelSize: 0.8, bevelSegments: 2 });

  // 角の金具（L 字。先端がとがる）
  const s = 43, t = 8.6;
  const br = new THREE.Shape();
  br.moveTo(0, 0);
  br.lineTo(s, 0);
  br.lineTo(s + t * 1.6, -t * 0.5);
  br.lineTo(s, -t);
  br.lineTo(t, -t);
  br.lineTo(t, -s);
  br.lineTo(t * 0.5, -s - t * 1.6);
  br.lineTo(0, -s);
  br.closePath();
  const bracketGeo = new THREE.ExtrudeGeometry(br, { depth: 1.6, bevelEnabled: true, bevelThickness: 0.9, bevelSize: 0.7, bevelSegments: 2 });

  // コストの台座（8つのとげ）
  const star = new THREE.Shape();
  for (let i = 0; i <= 16; i++) {
    const a = (i / 16) * Math.PI * 2 + Math.PI / 2;
    const r = i % 2 ? 19 : 26;
    i ? star.lineTo(Math.cos(a) * r, Math.sin(a) * r) : star.moveTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  const starGeo = new THREE.ExtrudeGeometry(star, { depth: 3, bevelEnabled: true, bevelThickness: 1, bevelSize: 0.8, bevelSegments: 2 });

  const plane = (w: number, h: number) => new THREE.PlaneGeometry(w, h);
  return {
    body: bodyGeo,
    box: boxGeo,
    plate: plateGeo,
    bracket: bracketGeo,
    star: starGeo,
    ring: new THREE.TorusGeometry(17.5, 2.6, 16, 48),
    orb: new THREE.SphereGeometry(15, 40, 24),
    gem: new THREE.OctahedronGeometry(5.5, 0),
    rivet: new THREE.SphereGeometry(2.4, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2),
    face: plane(CARD_W, CARD_H),
    art: plane(214, 200),
    plateFace: plane(220, 38),
    costNum: plane(56, 56),
    glow: plane(CARD_W * 1.55, CARD_H * 1.4),
    shadow: plane(CARD_W * 1.25, CARD_H * 1.2),
    mote: new THREE.PlaneGeometry(3, 3),
  };
}

// ---------------------------------------------------------------
// 材質
// ---------------------------------------------------------------
/** レア度ごとの縁取りの金属の色 */
const TRIM: Record<Rarity, number> = { basic: 0xb07a46, common: 0xc9ced6, rare: 0xe0b050, legendary: 0xe8b84e };
/** 種類・系統の色（名札の宝石） */
export const TYPE_COLOR: Record<string, number> = {
  attack: 0xc8342a, defense: 0x3a78d0, support: 0xc99626, buff: 0xd09a24, debuff: 0x8a4ad8, special: 0x2fa868,
  sword: 0xd0443a, magic: 0x7a62f0, blood: 0xb0101e, curse: 0x4ea052,
};

const matCache = new Map<string, THREE.Material>();
function cached<T extends THREE.Material>(key: string, make: () => T): T {
  let m = matCache.get(key) as T | undefined;
  if (!m) {
    m = make();
    matCache.set(key, m);
  }
  return m;
}

export function trimMetal(r: Rarity): THREE.MeshStandardMaterial {
  return cached(`trim-${r}`, () => new THREE.MeshStandardMaterial({ color: TRIM[r], metalness: 1, roughness: 0.28, envMapIntensity: 1.3 }));
}
export function ironMetal(): THREE.MeshStandardMaterial {
  return cached('iron', () => new THREE.MeshStandardMaterial({ color: 0x2a2520, metalness: 0.85, roughness: 0.5 }));
}
export function boxWall(): THREE.MeshStandardMaterial {
  return cached('box-wall', () => new THREE.MeshStandardMaterial({ color: 0x6a4a28, metalness: 0.9, roughness: 0.42, side: THREE.BackSide }));
}
export function invisible(): THREE.Material {
  return cached('invisible', () => new THREE.MeshBasicMaterial({ visible: false }));
}
export function orbGlass(): THREE.MeshPhysicalMaterial {
  return cached('orb', () => new THREE.MeshPhysicalMaterial({ color: 0x9a0a08, emissive: 0x5a0402, emissiveIntensity: 0.9, metalness: 0, roughness: 0.06, clearcoat: 1, clearcoatRoughness: 0.04, envMapIntensity: 1.6 }));
}
export function gemMat(color: number): THREE.MeshPhysicalMaterial {
  return cached(`gem-${color}`, () => new THREE.MeshPhysicalMaterial({ color, emissive: color, emissiveIntensity: 0.35, metalness: 0.1, roughness: 0.08, clearcoat: 1, envMapIntensity: 2 }));
}

// ---------------------------------------------------------------
// 枠の「反射・凹凸」の情報（枠の画像から自動で作る。レア度ごとに1回）
//   roughness（ざらつき）= 緑、metalness（金属らしさ）= 青、凹凸 = 法線マップ
// ---------------------------------------------------------------
const frameMaps = new Map<Rarity, Promise<{ color: THREE.Texture; rm: THREE.Texture; normal: THREE.Texture; img: HTMLImageElement }>>();
export function frameMapsFor(r: Rarity) {
  let p = frameMaps.get(r);
  if (!p) {
    p = loadImage(IMAGES.cardFrame[r]).then((img) => {
      const w = img.width, hgt = img.height;
      const [, ctx] = canvas(w, hgt);
      ctx.drawImage(img, 0, 0);
      const src = ctx.getImageData(0, 0, w, hgt).data;
      const sx = w / CARD_W, sy = hgt / CARD_H;
      // 羊皮紙の範囲（CSS 座標 x14〜206, y202〜290）
      const inParch = (x: number, y: number) => x > 14 * sx && x < 206 * sx && y > 202 * sy && y < 290 * sy;
      const height = new Float32Array(w * hgt);
      const [rmC, rmCtx] = canvas(w, hgt);
      const rm = rmCtx.createImageData(w, hgt);
      for (let y = 0; y < hgt; y++) {
        for (let x = 0; x < w; x++) {
          const i = (y * w + x) * 4;
          const R = src[i] / 255, G = src[i + 1] / 255, B = src[i + 2] / 255;
          const L = 0.3 * R + 0.59 * G + 0.11 * B;
          const mx = Math.max(R, G, B), mn = Math.min(R, G, B);
          const sat = mx ? (mx - mn) / mx : 0;
          let rough: number, metal: number, hgtV: number;
          if (inParch(x, y)) {
            rough = 0.88; metal = 0; hgtV = 0.25 + L * 0.12;
          } else if (L > 0.3 && (sat > 0.18 || L > 0.55)) {
            // 縁取り・金具（明るい金属）
            rough = 0.22 + (1 - L) * 0.15; metal = 1; hgtV = 0.35 + L * 0.65;
          } else {
            // 黒鉄
            rough = 0.55 + (1 - L) * 0.15; metal = 0.75; hgtV = L * 0.5;
          }
          rm.data[i] = 255;
          rm.data[i + 1] = Math.round(rough * 255);
          rm.data[i + 2] = Math.round(metal * 255);
          rm.data[i + 3] = 255;
          height[y * w + x] = hgtV;
        }
      }
      rmCtx.putImageData(rm, 0, 0);
      // 法線マップ（高さの傾きから）
      const [nC, nCtx] = canvas(w, hgt);
      const nd = nCtx.createImageData(w, hgt);
      const H = (x: number, y: number) => height[Math.min(hgt - 1, Math.max(0, y)) * w + Math.min(w - 1, Math.max(0, x))];
      const strength = 3.2;
      for (let y = 0; y < hgt; y++) {
        for (let x = 0; x < w; x++) {
          const dx = (H(x + 1, y) - H(x - 1, y)) * strength;
          const dy = (H(x, y + 1) - H(x, y - 1)) * strength;
          const len = Math.hypot(dx, dy, 1);
          const i = (y * w + x) * 4;
          nd.data[i] = Math.round(((-dx / len) * 0.5 + 0.5) * 255);
          nd.data[i + 1] = Math.round(((dy / len) * 0.5 + 0.5) * 255);
          nd.data[i + 2] = Math.round(((1 / len) * 0.5 + 0.5) * 255);
          nd.data[i + 3] = 255;
        }
      }
      nCtx.putImageData(nd, 0, 0);
      const rmT = new THREE.CanvasTexture(rmC);
      const nT = new THREE.CanvasTexture(nC);
      rmT.anisotropy = nT.anisotropy = 8;
      return { color: colorTexture(img), rm: rmT, normal: nT, img };
    });
    frameMaps.set(r, p);
  }
  return p;
}

// ---------------------------------------------------------------
// 文字の描画
// ---------------------------------------------------------------
interface Token { text: string; num?: 'up' | 'down' | 'base' }

/** カードの DOM（.card-desc-inner）から、文字と数値の並びを取り出す */
export function readDescTokens(el: HTMLElement | null): Token[][] {
  const paras: Token[][] = [[]];
  if (!el) return paras;
  el.childNodes.forEach((n) => {
    if (n.nodeType === Node.TEXT_NODE) {
      if (n.textContent) paras[paras.length - 1].push({ text: n.textContent });
    } else if (n instanceof HTMLElement) {
      if (n.tagName === 'BR') paras.push([]);
      else if (n.classList.contains('num')) paras[paras.length - 1].push({ text: n.textContent ?? '', num: n.classList.contains('num-up') ? 'up' : n.classList.contains('num-down') ? 'down' : 'base' });
      else paras[paras.length - 1].push({ text: n.textContent ?? '' });
    }
  });
  return paras;
}

/** 行頭に来てはいけない文字（禁則） */
const NO_HEAD = '、。，．）」』】ー・！？）%';

/**
 * 説明文を羊皮紙の中央に描く（自動で改行。行の長さはなるべくそろえる）
 */
function drawDescription(ctx: CanvasRenderingContext2D, paras: Token[][], long: boolean): void {
  const left = 22, right = 198, top = long ? 210 : 222, bottom = 288;
  const maxW = right - left;
  const size = long ? 12 : 13.5;
  const lineH = size * (long ? 1.32 : 1.42);
  const textFont = `700 ${size}px "Shippori Mincho B1", serif`;
  const numFont = `900 ${size + 3.5}px "Cinzel", serif`;
  type Piece = { text: string; font: string; color: string; w: number };
  const colorOf = (t: Token) => (t.num === 'up' ? '#1d6a26' : t.num === 'down' ? '#a04000' : t.num ? '#7a0c0c' : '#22120a');
  const lines: Piece[][] = [];
  for (const para of paras) {
    // 1文字（数値は1かたまり）ずつの部品にする
    const pieces: Piece[] = [];
    for (const t of para) {
      if (t.num) {
        ctx.font = numFont;
        pieces.push({ text: ` ${t.text} `, font: numFont, color: colorOf(t), w: ctx.measureText(` ${t.text} `).width * 0.85 });
      } else {
        ctx.font = textFont;
        for (const ch of t.text) pieces.push({ text: ch, font: textFont, color: colorOf(t), w: ctx.measureText(ch).width });
      }
    }
    if (!pieces.length) continue;
    const total = pieces.reduce((s, p) => s + p.w, 0);
    const n = Math.max(1, Math.ceil(total / maxW));
    const target = Math.min(maxW, total / n + size * 1.2);
    let cur: Piece[] = [];
    let w = 0;
    for (const p of pieces) {
      if (w + p.w > target && cur.length && !NO_HEAD.includes(p.text)) {
        lines.push(cur);
        cur = [];
        w = 0;
      }
      cur.push(p);
      w += p.w;
    }
    if (cur.length) lines.push(cur);
  }
  const blockH = lines.length * lineH;
  let y = top + (bottom - top - blockH) / 2 + lineH / 2;
  ctx.textBaseline = 'middle';
  for (const line of lines) {
    const lw = line.reduce((s, p) => s + p.w, 0);
    let x = 110 - lw / 2;
    for (const p of line) {
      ctx.font = p.font;
      ctx.fillStyle = 'rgba(255,244,220,0.45)';
      ctx.fillText(p.text.trim() ? p.text : p.text, x, y + 0.8, p.w + 2);
      ctx.fillStyle = p.color;
      ctx.fillText(p.text, x, y, p.w + 2);
      x += p.w;
    }
    y += lineH;
  }
}

export interface FaceInput {
  def: CardDef;
  desc: Token[][];
  long: boolean;
  typeLabel: string;
}

/** 表面（枠＋羊皮紙＋紋章＋説明文）のテクスチャ */
export async function renderFace(inp: FaceInput): Promise<THREE.Texture> {
  await waitFonts();
  const sigilPath = inp.def.element ? IMAGES.cardElement[inp.def.element] : IMAGES.cardType[inp.def.type];
  const [frame, sigil] = await Promise.all([loadImage(IMAGES.cardFrame[inp.def.rarity]), loadImage(sigilPath)]);
  const [c, ctx] = canvas(CARD_W * K, CARD_H * K);
  ctx.scale(K, K);
  ctx.drawImage(frame, 0, 0, CARD_W, CARD_H);
  // 紋章の透かし
  ctx.globalAlpha = 0.1;
  ctx.drawImage(sigil, 70, 212, 80, 80);
  ctx.globalAlpha = 1;
  if (!inp.long) {
    ctx.font = '700 10.5px "Shippori Mincho B1", serif';
    (ctx as any).letterSpacing = '2.3px';
    const tw = ctx.measureText(inp.typeLabel).width;
    const x0 = 110 - (tw + 19) / 2;
    ctx.globalAlpha = 0.85;
    ctx.drawImage(sigil, x0, 206, 15, 15);
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#5a3a1e';
    ctx.textBaseline = 'middle';
    ctx.fillText(inp.typeLabel, x0 + 19, 214);
    (ctx as any).letterSpacing = '0px';
  }
  drawDescription(ctx, inp.desc, inp.long);
  return colorTexture(c);
}

/** 名札（板の画像＋カード名） */
export async function renderPlate(def: CardDef, name: string): Promise<THREE.Texture> {
  await waitFonts();
  const plate = await loadImage(IMAGES.cardPlate[def.rarity]);
  const [c, ctx] = canvas(220 * K, 38 * K);
  ctx.scale(K, K);
  ctx.drawImage(plate, 0, 0, 220, 38);
  let size = 17;
  ctx.font = `800 ${size}px "Shippori Mincho B1", serif`;
  (ctx as any).letterSpacing = '1.4px';
  let w = ctx.measureText(name).width;
  if (w > 158) {
    size = (size * 158) / w;
    ctx.font = `800 ${size}px "Shippori Mincho B1", serif`;
    w = ctx.measureText(name).width;
  }
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'center';
  ctx.shadowColor = 'rgba(0,0,0,0.9)';
  ctx.shadowBlur = 6;
  ctx.fillStyle = 'rgba(0,0,0,0.95)';
  ctx.fillText(name, 110, 18);
  ctx.shadowBlur = 0;
  ctx.fillStyle = 'rgba(255,220,160,0.3)';
  ctx.fillText(name, 110, 20);
  const g = ctx.createLinearGradient(0, 10, 0, 28);
  g.addColorStop(0, '#fff6dc');
  g.addColorStop(0.55, '#f0d9a8');
  g.addColorStop(1, '#c9a46a');
  ctx.fillStyle = g;
  ctx.fillText(name, 110, 19);
  return colorTexture(c);
}

/** コストの数字（透明の上に光る数字） */
export function renderCostNumber(text: string, reduced: boolean): THREE.Texture {
  const [c, ctx] = canvas(56 * K, 56 * K);
  ctx.scale(K, K);
  ctx.font = '900 27px "Cinzel", serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = reduced ? 'rgba(80,255,120,1)' : 'rgba(255,120,60,1)';
  ctx.shadowBlur = 10;
  ctx.fillStyle = reduced ? '#a8ffb4' : '#fff4e2';
  ctx.fillText(text, 28, 29);
  ctx.shadowColor = 'rgba(0,0,0,0.95)';
  ctx.shadowBlur = 3;
  ctx.fillText(text, 28, 29);
  return colorTexture(c);
}

/** 挿絵 */
const artCache = new Map<string, Promise<THREE.Texture>>();
export function artTexture(path: string): Promise<THREE.Texture> {
  let p = artCache.get(path);
  if (!p) {
    p = loadImage(path).then((im) => colorTexture(im)).catch(() => {
      const [c, ctx] = canvas(64, 64);
      ctx.fillStyle = '#120a06';
      ctx.fillRect(0, 0, 64, 64);
      return colorTexture(c);
    });
    artCache.set(path, p);
  }
  return p;
}

/** 裏面 */
let backTex: Promise<THREE.Texture> | null = null;
export function backTexture(): Promise<THREE.Texture> {
  backTex ??= loadImage(IMAGES.cardBack).then(colorTexture);
  return backTex;
}

/** ぼかした円（光・影・塵に使う） */
const blobCache = new Map<string, THREE.Texture>();
export function blobTexture(kind: 'glow' | 'shadow' | 'mote' | 'sheen'): THREE.Texture {
  let t = blobCache.get(kind);
  if (t) return t;
  const S = 256;
  const [c, ctx] = canvas(S, S);
  if (kind === 'sheen') {
    // 斜めに流れる光の帯
    const g = ctx.createLinearGradient(0, 0, S, S);
    g.addColorStop(0, 'rgba(255,255,255,0)');
    g.addColorStop(0.42, 'rgba(255,255,255,0)');
    g.addColorStop(0.5, 'rgba(255,255,255,1)');
    g.addColorStop(0.58, 'rgba(255,255,255,0)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, S, S);
  } else {
    const g = ctx.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
    if (kind === 'shadow') {
      g.addColorStop(0, 'rgba(0,0,0,0.95)');
      g.addColorStop(0.55, 'rgba(0,0,0,0.6)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
    } else if (kind === 'mote') {
      g.addColorStop(0, 'rgba(255,255,255,1)');
      g.addColorStop(0.3, 'rgba(255,255,255,0.6)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
    } else {
      g.addColorStop(0, 'rgba(255,255,255,0.9)');
      g.addColorStop(0.45, 'rgba(255,255,255,0.35)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
    }
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, S, S);
  }
  t = new THREE.CanvasTexture(c);
  if (kind === 'sheen') t.wrapS = t.wrapT = THREE.RepeatWrapping;
  blobCache.set(kind, t);
  return t;
}

/** 金属が映り込む周囲の景色（暗い部屋＋ろうそくの灯り）。レンダラーごとに1回 */
export function buildEnvMap(renderer: THREE.WebGLRenderer): THREE.Texture {
  const scene = new THREE.Scene();
  const room = new THREE.Mesh(new THREE.BoxGeometry(40, 20, 40), new THREE.MeshBasicMaterial({ color: 0x120c08, side: THREE.BackSide }));
  scene.add(room);
  const panel = (color: number, intensity: number, x: number, y: number, z: number, w: number, h: number) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(intensity), side: THREE.DoubleSide }));
    m.position.set(x, y, z);
    m.lookAt(0, 0, 0);
    scene.add(m);
  };
  panel(0xffb060, 9, -8, 6, 10, 4, 6); // 左手前のろうそく
  panel(0xff9040, 7, 9, 4, 8, 3, 5); // 右のろうそく
  panel(0xffe0b0, 5, 0, 9.5, 0, 14, 4); // 天井の明かり
  panel(0x6080c0, 1.6, 0, 2, -19, 20, 8); // 奥の青白い光
  panel(0xc03020, 1.5, -18, -2, -6, 6, 6); // 赤い反射
  const pmrem = new THREE.PMREMGenerator(renderer);
  const env = pmrem.fromScene(scene, 0.03).texture;
  pmrem.dispose();
  room.geometry.dispose();
  return env;
}
