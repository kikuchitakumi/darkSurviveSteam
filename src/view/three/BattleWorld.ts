// =============================================================
// BattleWorld.ts  【3D：戦闘画面の背景（ろうそくの灯る広間）】
// -------------------------------------------------------------
// three.js で戦闘の舞台を立体的に描く。敵・HUD・ボタンは DOM のまま上に重なる。
//
//   奥    : ゾーンの背景画像（data/floors.ts の battleBackground）を遠景に
//   中景  : 石の床・ゴシックの柱・床に刻まれた魔法陣（敵はこの上に立つ）
//   手前  : 木と金の装飾のテーブル（手札はこの上に浮かぶ）、燭台
//   空気  : 霧・天井から差す光の筋・漂う塵・ろうそくの揺らぎ
//
// マウスの位置に合わせてカメラがわずかに動き、奥行きが分かるようになっている。
// 質感の画像（石・木）は実行時に Canvas で作るので、画像ファイルは要らない。
// =============================================================
import * as THREE from 'three';
import { settings } from '@/core/Settings';
import { ui } from '../ui';
import { loadImage } from './cardAssets';
import { FrameBudget } from './frameBudget';
import { IS_MOBILE } from '@/core/device';

const W = 1920;
const H = 1080;

/** ランダム（毎回同じ見た目にする） */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function canvasTex(w: number, h: number, draw: (ctx: CanvasRenderingContext2D) => void, srgb = true, repeat?: [number, number]): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d')!);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  if (repeat) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(repeat[0], repeat[1]);
  }
  return t;
}

/** 石畳 */
function stoneTexture(r: () => number): { map: THREE.Texture; bump: THREE.Texture } {
  const S = 512;
  const tiles: [number, number, number, number, number][] = [];
  for (let y = 0; y < S; y += 128) {
    const off = (y / 128) % 2 ? 64 : 0;
    for (let x = -128; x < S; x += 128) tiles.push([x + off, y, 128, 128, 0.75 + r() * 0.3]);
  }
  const draw = (bump: boolean) => (ctx: CanvasRenderingContext2D) => {
    ctx.fillStyle = bump ? '#000' : '#0d0a08';
    ctx.fillRect(0, 0, S, S);
    for (const [x, y, w, h, l] of tiles) {
      const g = ctx.createLinearGradient(x, y, x + w, y + h);
      if (bump) {
        g.addColorStop(0, '#d0d0d0');
        g.addColorStop(1, '#909090');
      } else {
        const c = Math.round(58 * l);
        g.addColorStop(0, `rgb(${c},${c - 6},${c - 12})`);
        g.addColorStop(1, `rgb(${c - 18},${c - 22},${c - 26})`);
      }
      ctx.fillStyle = g;
      ctx.fillRect(x + 4, y + 4, w - 8, h - 8);
    }
    // 傷・ざらつき
    for (let i = 0; i < 9000; i++) {
      ctx.fillStyle = bump ? `rgba(0,0,0,${r() * 0.35})` : `rgba(${r() < 0.5 ? '0,0,0' : '180,160,140'},${r() * 0.12})`;
      ctx.fillRect(r() * S, r() * S, 1 + r() * 3, 1 + r() * 3);
    }
    for (let i = 0; i < 40; i++) {
      ctx.strokeStyle = bump ? 'rgba(0,0,0,0.5)' : 'rgba(0,0,0,0.35)';
      ctx.lineWidth = 1 + r() * 1.5;
      ctx.beginPath();
      const x = r() * S, y = r() * S;
      ctx.moveTo(x, y);
      ctx.lineTo(x + (r() - 0.5) * 60, y + (r() - 0.5) * 60);
      ctx.stroke();
    }
  };
  return { map: canvasTex(S, S, draw(false), true, [6, 6]), bump: canvasTex(S, S, draw(true), false, [6, 6]) };
}

/** 黒檀の木目 */
function woodTexture(r: () => number): THREE.Texture {
  return canvasTex(1024, 256, (ctx) => {
    ctx.fillStyle = '#1a0e08';
    ctx.fillRect(0, 0, 1024, 256);
    for (let i = 0; i < 160; i++) {
      const y = r() * 256;
      ctx.strokeStyle = `rgba(${r() < 0.5 ? '60,32,16' : '8,4,2'},${0.2 + r() * 0.4})`;
      ctx.lineWidth = 0.5 + r() * 2.5;
      ctx.beginPath();
      ctx.moveTo(0, y);
      for (let x = 0; x <= 1024; x += 32) ctx.lineTo(x, y + Math.sin(x * 0.01 + i) * 4 + (r() - 0.5) * 2);
      ctx.stroke();
    }
  }, true, [2, 1]);
}

/** 深紅のビロードの布（ダマスク柄＋金の刺繍の縁取り） */
function clothTexture(r: () => number): THREE.Texture {
  const W2 = 2048, H2 = 968;
  return canvasTex(W2, H2, (ctx) => {
    ctx.fillStyle = '#5a0a10';
    ctx.fillRect(0, 0, W2, H2);
    // 毛足のむら
    for (let i = 0; i < 60000; i++) {
      ctx.fillStyle = r() < 0.5 ? `rgba(0,0,0,${r() * 0.18})` : `rgba(255,120,120,${r() * 0.06})`;
      ctx.fillRect(r() * W2, r() * H2, 2, 2);
    }
    // ダマスク柄（少し暗い色で、菱形に並べた百合の紋）
    const motif = (x: number, y: number, s: number) => {
      ctx.save();
      ctx.translate(x, y);
      ctx.fillStyle = 'rgba(20,0,2,0.32)';
      ctx.beginPath();
      ctx.moveTo(0, -s);
      ctx.bezierCurveTo(s * 0.5, -s * 0.5, s * 0.5, 0, 0, s * 0.35);
      ctx.bezierCurveTo(-s * 0.5, 0, -s * 0.5, -s * 0.5, 0, -s);
      ctx.fill();
      for (const sx of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(0, s * 0.1);
        ctx.bezierCurveTo(sx * s * 0.9, -s * 0.3, sx * s * 1.1, s * 0.5, sx * s * 0.4, s * 0.6);
        ctx.bezierCurveTo(sx * s * 0.7, s * 0.3, sx * s * 0.5, s * 0.1, 0, s * 0.3);
        ctx.fill();
      }
      ctx.fillRect(-s * 0.08, s * 0.3, s * 0.16, s * 0.6);
      ctx.restore();
    };
    for (let y = 0; y < H2 + 120; y += 120) for (let x = (y / 120) % 2 ? 60 : 0; x < W2 + 120; x += 120) motif(x, y, 34);
    // 金の刺繍の縁取り
    const border = (inset: number, w: number, a: number) => {
      ctx.strokeStyle = `rgba(230,180,80,${a})`;
      ctx.lineWidth = w;
      ctx.strokeRect(inset, inset, W2 - inset * 2, H2 - inset * 2);
    };
    border(26, 6, 0.85);
    border(44, 2, 0.6);
    border(78, 2, 0.6);
    ctx.fillStyle = 'rgba(230,180,80,0.75)';
    for (let x = 60; x < W2 - 40; x += 28) {
      for (const y of [61, H2 - 61]) {
        ctx.beginPath();
        ctx.moveTo(x, y - 7); ctx.lineTo(x + 7, y); ctx.lineTo(x, y + 7); ctx.lineTo(x - 7, y);
        ctx.fill();
      }
    }
    for (let y = 60; y < H2 - 40; y += 28) {
      for (const x of [61, W2 - 61]) {
        ctx.beginPath();
        ctx.moveTo(x, y - 7); ctx.lineTo(x + 7, y); ctx.lineTo(x, y + 7); ctx.lineTo(x - 7, y);
        ctx.fill();
      }
    }
  });
}

/** 床に刻まれた魔法陣（発光） */
function runeTexture(): THREE.Texture {
  return canvasTex(1024, 1024, (ctx) => {
    const c = 512;
    ctx.translate(c, c);
    ctx.strokeStyle = 'rgba(255,120,60,1)';
    ctx.shadowColor = 'rgba(255,80,30,1)';
    ctx.shadowBlur = 18;
    const ring = (r: number, w: number) => {
      ctx.lineWidth = w;
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.stroke();
    };
    ring(480, 6);
    ring(455, 2);
    ring(330, 4);
    ring(170, 3);
    // 星形（7芒星）
    ctx.lineWidth = 3;
    ctx.beginPath();
    for (let i = 0; i <= 7; i++) {
      const a = ((i * 3) / 7) * Math.PI * 2 - Math.PI / 2;
      i ? ctx.lineTo(Math.cos(a) * 330, Math.sin(a) * 330) : ctx.moveTo(Math.cos(a) * 330, Math.sin(a) * 330);
    }
    ctx.stroke();
    // 文字のような刻み
    ctx.font = '42px serif';
    ctx.fillStyle = 'rgba(255,150,80,1)';
    ctx.textAlign = 'center';
    const glyphs = 'ᚠᚢᚦᚨᚱᚲᚷᚹᚺᚾᛁᛃᛇᛈᛉᛊᛏᛒᛖᛗᛚᛜᛞᛟ';
    for (let i = 0; i < 24; i++) {
      ctx.save();
      ctx.rotate((i / 24) * Math.PI * 2);
      ctx.fillText(glyphs[i % glyphs.length], 0, -395);
      ctx.restore();
    }
  });
}

/** 光の筋（上から下へ薄れる） */
function beamTexture(): THREE.Texture {
  return canvasTex(64, 256, (ctx) => {
    const g = ctx.createLinearGradient(0, 0, 0, 256);
    g.addColorStop(0, 'rgba(255,255,255,0.9)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 64, 256);
    const h = ctx.createLinearGradient(0, 0, 64, 0);
    h.addColorStop(0, 'rgba(0,0,0,1)');
    h.addColorStop(0.5, 'rgba(0,0,0,0)');
    h.addColorStop(1, 'rgba(0,0,0,1)');
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillStyle = h;
    ctx.fillRect(0, 0, 64, 256);
  });
}

function softDot(): THREE.Texture {
  return canvasTex(64, 64, (ctx) => {
    const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.25, 'rgba(255,240,200,0.8)');
    g.addColorStop(1, 'rgba(255,200,120,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 64, 64);
  });
}

interface Candle {
  light: THREE.PointLight;
  flame: THREE.Sprite;
  halo: THREE.Sprite;
  base: number;
  seed: number;
}

// -------------------------------------------------------------
// 戦闘ごとに作り直さず、使い回すもの
// -------------------------------------------------------------
// WebGL の環境（レンダラー）を戦闘のたびに作り直すと、シェーダー（GPU 用の小さなプログラム）の
// 準備に毎回 1 秒近くかかり、その間画面が止まる。レンダラーと質感の画像は1つを使い回す。
let shared: { renderer: THREE.WebGLRenderer; canvas: HTMLCanvasElement; aa: boolean } | null = null;
/** いま shared のキャンバスを使っている戦闘背景 */
let active: BattleWorld | null = null;
const texCache = new Map<string, unknown>();
function cached<T>(key: string, make: () => T): T {
  if (!texCache.has(key)) texCache.set(key, make());
  return texCache.get(key) as T;
}

export interface BattleWorldOptions {
  /** 遠景に使う背景画像（ゾーンの戦闘背景） */
  backdrop: string;
  /** 灯りの色（ゾーンの雰囲気） */
  accent?: number;
  /** ボス戦（光を赤く・強く） */
  boss?: boolean;
}

export class BattleWorld {
  readonly canvas: HTMLCanvasElement;
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(42, W / H, 1, 6000);
  private candles: Candle[] = [];
  private dust!: THREE.Points;
  private beams: THREE.Mesh[] = [];
  private rune!: THREE.Mesh;
  private raf = 0;
  /** 前回描いた時刻（背景なので 30fps に間引く） */
  private lastDraw = 0;
  /** 重い時に解像度を下げる倍率（1 → 0.8 → 0.64 …） */
  private dynScale = 1;
  private budget = new FrameBudget();
  private disposed = false;
  private pointer = { x: 0, y: 0 };
  // カメラ：敵の足元（床の z=-250）が画面の y≈640、テーブルの奥の縁が y≈800 に来る位置
  private camBase = new THREE.Vector3(0, 420, 1500);
  private lookAt = new THREE.Vector3(0, 60, -600);
  private disposables: { dispose(): void }[] = [];
  private onMove = (e: PointerEvent) => {
    this.pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
    this.pointer.y = (e.clientY / window.innerHeight) * 2 - 1;
  };
  private onResize = () => this.renderer.setPixelRatio(this.pixelRatio());

  /**
   * 下準備：タイトル画面などの暇な時間に、見えないところで一度描いてシェーダーを作っておく。
   * （最初の戦闘に入った時に画面が止まらないようにする）
   */
  static prewarm(): void {
    if (IS_MOBILE) return;
    if (shared && shared.aa === (settings.current.quality === 'high')) return;
    try {
      const w = new BattleWorld(document.createElement('div'), null, { backdrop: '' }, true);
      w.dispose();
    } catch (e) {
      console.warn('3D の背景の下準備に失敗しました', e);
    }
  }

  static attach(parent: HTMLElement, before: Node | null, opts: BattleWorldOptions): BattleWorld | null {
    try {
      return new BattleWorld(parent, before, opts);
    } catch (e) {
      console.warn('3D の背景を使えないため、通常の背景で表示します', e);
      return null;
    }
  }

  private constructor(parent: HTMLElement, before: Node | null, private opts: BattleWorldOptions, warmOnly = false) {
    const q = settings.current.quality;
    // 背景は多少ぼけても目立たないので、アンチエイリアスは「高」画質の時だけ
    const aa = q === 'high' && !IS_MOBILE;
    active?.dispose();
    if (!shared || shared.aa !== aa) {
      shared?.renderer.dispose();
      shared?.renderer.forceContextLoss();
      const canvas = document.createElement('canvas');
      canvas.className = 'battle-world-canvas';
      shared = { renderer: new THREE.WebGLRenderer({ canvas, antialias: aa, powerPreference: 'high-performance' }), canvas, aa };
    }
    active = this;
    this.canvas = shared.canvas;
    this.renderer = shared.renderer;
    this.renderer.setPixelRatio(this.pixelRatio());
    this.renderer.setSize(W, H, false);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    // 影：柱や燭台は動かないので、影は最初に1回だけ計算して使い回す（毎フレーム計算すると重い）
    this.renderer.shadowMap.enabled = q !== 'low' && !IS_MOBILE;
    this.renderer.shadowMap.type = q === 'high' ? THREE.PCFSoftShadowMap : THREE.PCFShadowMap;
    this.renderer.shadowMap.autoUpdate = false;
    this.renderer.shadowMap.needsUpdate = true;
    this.build();
    if (warmOnly) {
      // 影も含めて全部のシェーダーを作るため、実際に1回描く（画面には出ない）
      this.renderer.shadowMap.needsUpdate = true;
      this.renderer.render(this.scene, this.camera);
      return;
    }
    // シェーダーの準備が終わるまでは透明にしておき（下の通常の背景が見える）、画面を止めずに裏で準備する
    this.canvas.style.transition = 'opacity 0.4s ease';
    this.canvas.style.opacity = '0';
    parent.insertBefore(this.canvas, before);
    window.addEventListener('pointermove', this.onMove);
    window.addEventListener('resize', this.onResize);
    this.renderer.compileAsync(this.scene, this.camera).catch(() => {}).then(() => {
      if (this.disposed) return;
      this.canvas.style.opacity = '1';
      this.loop();
    });
  }

  /** 描画解像度の倍率。背景なので画面の解像度より上げない（高画質でも 1 まで） */
  private pixelRatio(): number {
    const q = settings.current.quality;
    const cap = q === 'high' ? 1 : q === 'medium' ? 0.85 : 0.7;
    return Math.min(cap, Math.max(0.6, window.devicePixelRatio * ui.stage.scale)) * this.dynScale;
  }

  private track<T extends { dispose(): void }>(o: T): T {
    this.disposables.push(o);
    return o;
  }

  private build(): void {
    const r = rng(1234);
    const s = this.scene;
    const accent = new THREE.Color(this.opts.accent ?? 0xff8a40);
    s.background = new THREE.Color(0x050304);
    s.fog = new THREE.FogExp2(0x0a0605, 0.00042);

    // ---- 遠景：ゾーンの背景画像 ----
    // 画像が読み込まれるまでは仮の1色の画像を貼っておく（後から画像を付けるとシェーダーの作り直しになるため）
    const backMat = this.track(new THREE.MeshBasicMaterial({ color: 0x8a7a70, fog: false, map: cached('blank', () => { const t = new THREE.DataTexture(new Uint8Array([20, 14, 12, 255]), 1, 1); t.colorSpace = THREE.SRGBColorSpace; t.needsUpdate = true; return t; }) }));
    const back = new THREE.Mesh(this.track(new THREE.PlaneGeometry(4200, 2360)), backMat);
    back.position.set(0, 700, -1900);
    s.add(back);
    loadImage(this.opts.backdrop).then((im) => {
      const t = new THREE.Texture(im);
      t.colorSpace = THREE.SRGBColorSpace;
      t.needsUpdate = true;
      this.track(t);
      backMat.map = t;
      backMat.needsUpdate = true;
    }).catch(() => {});

    // ---- 床（石畳） ----
    // 質感の画像は作るのに時間がかかるので、最初の戦闘で作ったものを使い回す（dispose しない）
    const stone = cached('stone', () => stoneTexture(rng(11)));
    const floorMat = this.track(new THREE.MeshStandardMaterial({ map: stone.map, bumpMap: stone.bump, bumpScale: 3, roughness: 0.82, metalness: 0.05, color: 0x9a8a80 }));
    const floor = new THREE.Mesh(this.track(new THREE.PlaneGeometry(5000, 3400)), floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(0, 0, -400);
    floor.receiveShadow = true;
    s.add(floor);

    // ---- 魔法陣（敵の足元） ----
    const runeTex = cached('rune', runeTexture);
    this.rune = new THREE.Mesh(this.track(new THREE.PlaneGeometry(1300, 1300)), this.track(new THREE.MeshBasicMaterial({ map: runeTex, color: accent.clone().multiplyScalar(0.9), transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false })));
    this.rune.rotation.x = -Math.PI / 2;
    this.rune.position.set(0, 1.5, -250);
    s.add(this.rune);

    // ---- ゴシックの柱 ----
    const pillarMat = this.track(new THREE.MeshStandardMaterial({ map: stone.map, bumpMap: stone.bump, bumpScale: 2, color: 0x6a5e58, roughness: 0.9 }));
    const shaft = this.track(new THREE.CylinderGeometry(55, 62, 1500, 16));
    const plinth = this.track(new THREE.BoxGeometry(180, 90, 180));
    const capital = this.track(new THREE.CylinderGeometry(90, 60, 70, 16));
    const ribs = this.track(new THREE.CylinderGeometry(14, 14, 1500, 6));
    for (const side of [-1, 1]) {
      for (const [x, z] of [[1050, 150], [900, -500], [820, -1150]] as [number, number][]) {
        const g = new THREE.Group();
        const p = new THREE.Mesh(shaft, pillarMat);
        p.position.y = 750;
        p.castShadow = true;
        p.receiveShadow = true;
        g.add(p);
        for (let i = 0; i < 4; i++) {
          const rb = new THREE.Mesh(ribs, pillarMat);
          const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
          rb.position.set(Math.cos(a) * 58, 750, Math.sin(a) * 58);
          g.add(rb);
        }
        const b = new THREE.Mesh(plinth, pillarMat);
        b.position.y = 45;
        g.add(b);
        const c = new THREE.Mesh(capital, pillarMat);
        c.position.y = 1250;
        g.add(c);
        g.position.set(side * x, 0, z);
        s.add(g);
      }
    }

    // ---- 手前のテーブル（黒檀＋金の縁） ----
    const wood = cached('wood', () => woodTexture(rng(12)));
    const tableMat = this.track(new THREE.MeshStandardMaterial({ map: wood, roughness: 0.68, metalness: 0, color: 0x8a6650 }));
    const goldMat = this.track(new THREE.MeshStandardMaterial({ color: 0xd8a84a, metalness: 1, roughness: 0.3 }));
    // ビロード：sheen（毛足の艶）で、光の角度によって縁が明るく光る
    const clothMat = this.track(new THREE.MeshPhysicalMaterial({ map: cached('cloth', () => clothTexture(rng(13))), color: 0x6a4242, roughness: 0.9, sheen: 1, sheenColor: new THREE.Color(0xd04040), sheenRoughness: 0.35 }));
    const table = new THREE.Group();
    const top = new THREE.Mesh(this.track(new THREE.BoxGeometry(2600, 40, 600)), tableMat);
    top.receiveShadow = true;
    table.add(top);
    // 深紅の布
    const cloth = new THREE.Mesh(this.track(new THREE.BoxGeometry(1100, 4, 520)), clothMat);
    cloth.position.set(0, 22, 40);
    cloth.receiveShadow = true;
    table.add(cloth);
    // 金の縁取り（布の縁と、テーブルの手前の縁）
    for (const [w, d, x, z] of [[1110, 10, 0, -222], [10, 530, -552, 40], [10, 530, 552, 40], [2600, 14, 0, -300]] as number[][]) {
      const m = new THREE.Mesh(this.track(new THREE.BoxGeometry(w, 8, d)), goldMat);
      m.position.set(x, 26, z);
      table.add(m);
    }
    table.position.set(0, 130, 1062);
    s.add(table);

    // ---- 燭台（テーブルの両端と、奥の左右） ----
    const dot = cached('dot', softDot);
    const waxMat = this.track(new THREE.MeshStandardMaterial({ color: 0xe8dcc0, roughness: 0.6, emissive: 0x402010, emissiveIntensity: 0.4 }));
    const holderMat = goldMat;
    const addCandle = (x: number, y: number, z: number, h: number, scale = 1, light = true, power = 1) => {
      const g = new THREE.Group();
      const dish = new THREE.Mesh(this.track(new THREE.CylinderGeometry(26 * scale, 18 * scale, 8 * scale, 20)), holderMat);
      g.add(dish);
      const stem = new THREE.Mesh(this.track(new THREE.CylinderGeometry(6 * scale, 9 * scale, h * 0.5, 12)), holderMat);
      stem.position.y = -h * 0.25;
      g.add(stem);
      const foot = new THREE.Mesh(this.track(new THREE.CylinderGeometry(30 * scale, 36 * scale, 10 * scale, 20)), holderMat);
      foot.position.y = -h * 0.5;
      g.add(foot);
      const wax = new THREE.Mesh(this.track(new THREE.CylinderGeometry(11 * scale, 12 * scale, h * 0.45, 16)), waxMat);
      wax.position.y = h * 0.225;
      wax.castShadow = true;
      g.add(wax);
      const flame = new THREE.Sprite(new THREE.SpriteMaterial({ map: dot, color: 0xffc070, blending: THREE.AdditiveBlending, depthWrite: false }));
      flame.scale.set(18 * scale, 38 * scale, 1);
      flame.position.y = h * 0.45 + 18 * scale;
      g.add(flame);
      const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: dot, color: accent, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false }));
      halo.scale.set(170 * scale, 170 * scale, 1);
      halo.position.y = flame.position.y;
      g.add(halo);
      this.track(flame.material);
      this.track(halo.material);
      g.position.set(x, y + h * 0.5, z);
      s.add(g);
      const pl = new THREE.PointLight(0xffa860, 0, 1600, 1.6);
      pl.position.set(x, y + h + 20 * scale, z);
      if (light) s.add(pl);
      this.candles.push({ light: pl, flame, halo, base: light ? 90000 * scale * power : 0, seed: r() * 100 });
    };
    // テーブルの上の燭台は近いので、光を弱めにする
    addCandle(-560, 150, 800, 120, 0.9, true, 0.3);
    addCandle(560, 150, 800, 120, 0.9, true, 0.3);
    addCandle(-640, 0, -180, 280, 1.5);
    addCandle(640, 0, -180, 280, 1.5);
    addCandle(-600, 0, -900, 240, 1.4, false);
    addCandle(600, 0, -900, 240, 1.4, false);

    // ---- 天井から差す光（敵を照らす） ----
    const spot = new THREE.SpotLight(this.opts.boss ? 0xff5a40 : 0xffd8a8, this.opts.boss ? 9e6 : 6e6, 4000, Math.PI / 7, 0.6, 1.8);
    spot.position.set(0, 2200, -100);
    spot.target.position.set(0, 0, -250);
    spot.castShadow = true;
    spot.shadow.mapSize.set(1024, 1024);
    s.add(spot, spot.target);
    const beamTex = cached('beam', beamTexture);
    for (let i = 0; i < 5; i++) {
      const beam = new THREE.Mesh(this.track(new THREE.PlaneGeometry(260 + r() * 260, 2400)), this.track(new THREE.MeshBasicMaterial({ map: beamTex, color: this.opts.boss ? 0xff7050 : 0xffd0a0, transparent: true, opacity: 0.08 + r() * 0.06, blending: THREE.AdditiveBlending, depthWrite: false, fog: false })));
      beam.position.set((r() - 0.5) * 700, 1150, -350 + (r() - 0.5) * 300);
      beam.rotation.z = (r() - 0.5) * 0.35;
      s.add(beam);
      this.beams.push(beam);
    }
    // 全体を薄く照らす光
    s.add(new THREE.HemisphereLight(0x8a90b0, 0x1a0c06, 0.35));
    const fill = new THREE.DirectionalLight(0xffc890, 0.5);
    fill.position.set(-0.3, 1, 1);
    s.add(fill);

    // ---- 漂う塵 ----
    const n = settings.current.quality === 'low' ? 150 : settings.current.quality === 'medium' ? 300 : 500;
    const pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      pos[i * 3] = (r() - 0.5) * 3000;
      pos[i * 3 + 1] = r() * 1400;
      pos[i * 3 + 2] = -1500 + r() * 2300;
    }
    const pg = this.track(new THREE.BufferGeometry());
    pg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.dust = new THREE.Points(pg, this.track(new THREE.PointsMaterial({ map: dot, color: 0xffc890, size: 7, transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false })));
    s.add(this.dust);
  }

  private loop = (): void => {
    if (this.disposed) return;
    if (!this.canvas.isConnected) {
      this.dispose();
      return;
    }
    this.raf = requestAnimationFrame(this.loop);
    const now = performance.now();
    // 重い状態が続いたら解像度を一段下げる（下限は元の半分）
    if (this.budget.tick(now) && this.dynScale > 0.5) {
      this.dynScale *= 0.8;
      this.renderer.setPixelRatio(this.pixelRatio());
    }
    // 背景はゆっくりした動きしかないので 30fps で十分（GPU の負担を半分にする）
    if (now - this.lastDraw < 30) return;
    this.lastDraw = now;
    // 画面を覆うパネル（山札の一覧など）が開いている間は描かない
    if (ui.stage.modal.childElementCount > 0) return;
    const t = now / 1000;
    // ろうそくの揺らぎ
    for (const c of this.candles) {
      const f = 0.82 + Math.sin(t * 9 + c.seed) * 0.06 + Math.sin(t * 23 + c.seed * 2) * 0.05 + Math.sin(t * 3.1 + c.seed) * 0.07;
      c.light.intensity = c.base * f;
      c.flame.scale.y = c.flame.scale.x * (2 + Math.sin(t * 17 + c.seed) * 0.25);
      (c.halo.material as THREE.SpriteMaterial).opacity = 0.28 * f;
    }
    // 魔法陣はゆっくり回り、明滅する
    this.rune.rotation.z = t * 0.03;
    (this.rune.material as THREE.MeshBasicMaterial).opacity = 0.42 + Math.sin(t * 1.3) * 0.12;
    // 光の筋がゆらぐ
    this.beams.forEach((b, i) => ((b.material as THREE.MeshBasicMaterial).opacity = 0.07 + Math.sin(t * 0.6 + i * 1.7) * 0.035));
    // 塵がゆっくり舞う
    const p = this.dust.geometry.getAttribute('position') as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) {
      let y = p.getY(i) + 0.5 + (i % 7) * 0.1; // 30fps なので1回の移動量は2倍
      if (y > 1400) y = 0;
      p.setY(i, y);
      p.setX(i, p.getX(i) + Math.sin(t * 0.3 + i) * 0.5);
    }
    p.needsUpdate = true;
    // マウスに合わせてカメラをわずかに動かす（視差）
    const target = this.camBase.clone().add(new THREE.Vector3(this.pointer.x * 60, -this.pointer.y * 30, 0));
    this.camera.position.lerp(target, 0.1);
    this.camera.lookAt(this.lookAt);
    this.renderer.render(this.scene, this.camera);
  };

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    window.removeEventListener('pointermove', this.onMove);
    window.removeEventListener('resize', this.onResize);
    // マテリアルは dispose しない（dispose するとシェーダーも捨てられ、次の戦闘で作り直しになる）
    // （スマホはメモリが少ないため、マテリアルもレンダラーもすぐに解放する）
    this.disposables.forEach((d) => { if (IS_MOBILE || !(d instanceof THREE.Material)) d.dispose(); });
    // レンダラーとキャンバスは次の戦闘で使い回す（シェーダーを作り直さないため）
    if (active === this) {
      active = null;
      this.canvas.remove();
      this.renderer.renderLists.dispose();
      if (IS_MOBILE && shared) {
        shared.renderer.dispose();
        shared.renderer.forceContextLoss();
        shared = null;
      }
    }
  }
}
