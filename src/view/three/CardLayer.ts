// =============================================================
// CardLayer.ts  【3D：カードを three.js で立体的に描く層】
// -------------------------------------------------------------
// ■ 仕組み
//   カードの位置・回転・大きさ・ドラッグ・アニメーションは、これまで通り
//   DOM のカード（CardView.ts が作る .card）が受け持つ。
//   この層は毎フレーム、host の中の .card を探して画面上の位置を読み取り、
//   同じ場所に three.js の立体のカードを描く。DOM のカードは透明にして、
//   クリックやドラッグの「当たり判定」としてだけ使う。
//   → 戦闘・報酬・ショップ・デッキ一覧のロジックを変えずに 3D 化できる。
//
// ■ 使い方
//   const layer = CardLayer.attach({ host, parent, before, clip });
//   …シーン終了時 layer?.dispose()（host が DOM から外れた時も自動で片付く）
//   WebGL が使えない環境では null が返り、従来の CSS のカードがそのまま表示される。
//
// ■ 光
//   ・環境マップ（暗い部屋とろうそく）が金属に映り込む
//   ・マウスの位置に点光源があり、カードの上の反射がマウスに付いてくる
// =============================================================
import * as THREE from 'three';
import { CARDS, getCard, hasCard } from '@/data/cards';
import type { CardDef } from '@/model/types';
import { settings } from '@/core/Settings';
import { ui } from '../ui';
import { createCardEl } from '../components/CardView';
import { FrameBudget } from './frameBudget';
import { IS_MOBILE } from '@/core/device';
import {
  BODY_D, CARD_H, CARD_W, FRONT_Z, TYPE_COLOR, artTexture, blobTexture, boxWall, buildEnvMap, frameMapsFor, gemMat, geometries, invisible,
  ironMetal, orbGlass, readDescTokens, renderCostNumber, renderFace, renderPlate, trimMetal,
} from './cardAssets';

const STAGE_W = 1920;
const STAGE_H = 1080;
const FOV = 30;
/** カメラまでの距離（Z=0 の面で 1 = ステージの 1px になる距離） */
const CAM_Z = STAGE_H / 2 / Math.tan(THREE.MathUtils.degToRad(FOV / 2));

export interface CardLayerOptions {
  /** この要素の中の .card を 3D で描く */
  host: HTMLElement;
  /** canvas を入れる要素（ステージ全体を覆う位置にあること） */
  parent: HTMLElement;
  /** canvas をこの要素の直前に入れる（重なり順の調整） */
  before?: Node | null;
  /** この要素の範囲の外は描かない（スクロールする一覧など） */
  clip?: HTMLElement;
  /** 手札のカードを少し寝かせる角度（度） */
  handPitch?: number;
}

// テクスチャの使い回し（同じ内容のカードは同じテクスチャ）
const faceCache = new Map<string, Promise<THREE.Texture>>();
const plateCache = new Map<string, Promise<THREE.Texture>>();
const costCache = new Map<string, THREE.Texture>();
function remember<T>(map: Map<string, T>, key: string, make: () => T, limit = 120): T {
  let v = map.get(key);
  if (v === undefined) {
    v = make();
    map.set(key, v);
    if (map.size > limit) {
      const [oldKey, old] = map.entries().next().value as [string, any];
      map.delete(oldKey);
      Promise.resolve(old).then((t: THREE.Texture) => t?.dispose?.());
    }
  }
  return v;
}

/** 1枚のカードの立体 */
class Card3D {
  readonly root = new THREE.Group(); // 位置・回転（Z）・大きさ
  private tilt = new THREE.Group(); // マウスでの傾き
  private faceMat: THREE.MeshStandardMaterial | null = null;
  private plateMat: THREE.MeshBasicMaterial | null = null;
  private costMat: THREE.MeshBasicMaterial | null = null;
  private glow: THREE.Mesh;
  private shadow: THREE.Mesh;
  private sheen: THREE.Mesh | null = null;
  private motes: THREE.Points;
  private faceKey = '';
  private plateKey = '';
  private costKey = '';
  private mats: THREE.Material[] = [];
  ready = false;
  /** 表示の滑らかな追従用 */
  lift = 0;
  glowLevel = 0;
  seen = true;
  /** 描く順番（DOM の重なり順） */
  drawOrder = 0;
  /** このフレームで見えているか */
  shown = false;
  /** 使えないカード（暗く描く） */
  dim = false;

  constructor(readonly def: CardDef) {
    const g = geometries();
    this.root.add(this.tilt);
    // 影（カードの下に落ちる）
    this.shadow = new THREE.Mesh(g.shadow, new THREE.MeshBasicMaterial({ map: blobTexture('shadow'), color: 0x000000, transparent: true, opacity: 0.55, depthWrite: false }));
    this.shadow.position.set(14, -24, -40);
    this.shadow.renderOrder = -2;
    this.root.add(this.shadow);
    // 光の縁取り（使えるカードなど）
    this.glow = new THREE.Mesh(g.glow, new THREE.MeshBasicMaterial({ map: blobTexture('glow'), color: 0xff8a30, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
    this.glow.position.z = -30;
    this.glow.renderOrder = -1;
    this.tilt.add(this.glow);

    const r = def.rarity;
    // 本体（側面と窓の縁は金属、前後の面は黒鉄）
    const body = new THREE.Mesh(g.body, [ironMetal(), trimMetal(r)]);
    this.tilt.add(body);
    // 窓の奥の箱（内側の壁）
    const box = new THREE.Mesh(g.box, [invisible(), boxWall()]);
    this.tilt.add(box);
    // 挿絵（箱の底）
    const artMat = new THREE.MeshBasicMaterial({ color: 0xe8ddd0 });
    this.mats.push(artMat);
    const art = new THREE.Mesh(g.art, artMat);
    art.position.set(0, (154 - 101), -29);
    this.tilt.add(art);
    artTexture(def.image).then((t) => {
      artMat.map = t;
      artMat.needsUpdate = true;
    });
    // 窓の中を漂う塵（奥行きの手がかり）
    const n = 16;
    const pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 170;
      pos[i * 3 + 1] = 53 + (Math.random() - 0.5) * 150;
      pos[i * 3 + 2] = -27 + Math.random() * 26;
    }
    const pg = new THREE.BufferGeometry();
    pg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const pm = new THREE.PointsMaterial({ map: blobTexture('mote'), color: 0xffc890, size: 3.2, transparent: true, opacity: 0.75, blending: THREE.AdditiveBlending, depthWrite: false });
    this.mats.push(pm);
    this.motes = new THREE.Points(pg, pm);
    this.tilt.add(this.motes);
    // レア・レジェンド：挿絵に流れる光沢
    if (r === 'rare' || r === 'legendary') {
      const sm = new THREE.MeshBasicMaterial({ map: blobTexture('sheen'), color: r === 'legendary' ? 0xff8080 : 0xffd890, transparent: true, opacity: r === 'legendary' ? 0.35 : 0.22, blending: THREE.AdditiveBlending, depthWrite: false });
      this.mats.push(sm);
      this.sheen = new THREE.Mesh(g.art, sm);
      this.sheen.position.set(0, 53, -2);
      this.tilt.add(this.sheen);
    }
    // 角の金具
    const trim = trimMetal(r);
    const corners: [number, number, number][] = [
      [-CARD_W / 2 + 2.5, CARD_H / 2 - 2.5, 0],
      [CARD_W / 2 - 2.5, CARD_H / 2 - 2.5, -Math.PI / 2],
      [CARD_W / 2 - 2.5, -CARD_H / 2 + 2.5, Math.PI],
      [-CARD_W / 2 + 2.5, -CARD_H / 2 + 2.5, Math.PI / 2],
    ];
    for (const [x, y, rot] of corners) {
      const m = new THREE.Mesh(g.bracket, trim);
      m.position.set(x, y, FRONT_Z - 0.8);
      m.rotation.z = rot;
      this.tilt.add(m);
    }
    // 側面の鋲
    for (const cy of [100, 150, 245]) {
      for (const cx of [7.5, 212.5]) {
        const m = new THREE.Mesh(g.rivet, trim);
        m.position.set(cx - CARD_W / 2, CARD_H / 2 - cy, FRONT_Z - 0.3);
        m.rotation.x = Math.PI / 2;
        this.tilt.add(m);
      }
    }
    // アーチの要石・下部のレア度の宝石
    const gemColor = { basic: 0xd0802a, common: 0x5a9ae0, rare: 0xffb030, legendary: 0xff2030 }[r];
    for (const cy of [16, 301.5]) {
      const m = new THREE.Mesh(g.gem, gemMat(gemColor));
      m.position.set(0, CARD_H / 2 - cy, FRONT_Z + 1.5);
      m.scale.set(1, 1, 0.6);
      this.tilt.add(m);
    }
    // 名札
    const plate = new THREE.Mesh(g.plate, [ironMetal(), trim]);
    plate.position.set(0, -31, FRONT_Z + 0.4);
    this.tilt.add(plate);
    const typeColor = TYPE_COLOR[def.element ?? def.type] ?? 0xc8342a;
    for (const sx of [-90, 90]) {
      const m = new THREE.Mesh(g.gem, gemMat(typeColor));
      m.position.set(sx, -31, FRONT_Z + 5.5);
      m.scale.set(0.95, 0.95, 0.55);
      this.tilt.add(m);
    }
    // コスト
    const star = new THREE.Mesh(g.star, trimMetal('basic'));
    star.position.set(-92, 136, FRONT_Z + 1);
    this.tilt.add(star);
    const ring = new THREE.Mesh(g.ring, trimMetal('rare'));
    ring.position.set(-92, 136, FRONT_Z + 5);
    this.tilt.add(ring);
    const orb = new THREE.Mesh(g.orb, orbGlass());
    orb.position.set(-92, 136, FRONT_Z + 4);
    orb.scale.set(1, 1, 0.55);
    this.tilt.add(orb);
  }

  /** DOM の内容（説明文・コスト・名前）に合わせて、文字のテクスチャを更新する */
  updateContent(el: HTMLElement): void {
    const g = geometries();
    const descEl = el.querySelector<HTMLElement>('.card-desc-inner');
    const long = !!el.querySelector('.card-desc.long');
    const faceKey = `${this.def.id}|${this.def.rarity}|${long}|${descEl?.innerHTML ?? ''}`;
    if (faceKey !== this.faceKey) {
      this.faceKey = faceKey;
      const typeLabel = el.querySelector('.card-type span')?.textContent ?? '';
      const tokens = readDescTokens(descEl);
      Promise.all([remember(faceCache, faceKey, () => renderFace({ def: this.def, desc: tokens, long, typeLabel })), frameMapsFor(this.def.rarity)]).then(([tex, maps]) => {
        if (this.faceKey !== faceKey) return;
        if (!this.faceMat) {
          this.faceMat = new THREE.MeshStandardMaterial({ map: tex, roughnessMap: maps.rm, metalnessMap: maps.rm, normalMap: maps.normal, metalness: 1, roughness: 1, transparent: true, envMapIntensity: 1.15 });
          this.mats.push(this.faceMat);
          const face = new THREE.Mesh(g.face, this.faceMat);
          face.position.z = FRONT_Z;
          this.tilt.add(face);
        } else {
          this.faceMat.map = tex;
          this.faceMat.needsUpdate = true;
        }
        this.ready = true;
      });
    }
    const name = el.querySelector('.card-name')?.textContent ?? this.def.name;
    const plateKey = `${this.def.rarity}|${name}`;
    if (plateKey !== this.plateKey) {
      this.plateKey = plateKey;
      remember(plateCache, plateKey, () => renderPlate(this.def, name)).then((tex) => {
        if (this.plateKey !== plateKey) return;
        if (!this.plateMat) {
          this.plateMat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false });
          this.mats.push(this.plateMat);
          const face = new THREE.Mesh(g.plateFace, this.plateMat);
          face.position.set(0, -31, FRONT_Z + 0.4 + 3 + 0.85);
          this.tilt.add(face);
        } else {
          this.plateMat.map = tex;
          this.plateMat.needsUpdate = true;
        }
      });
    }
    const costText = el.querySelector('.card-cost span')?.textContent ?? String(this.def.cost);
    const reduced = el.classList.contains('cost-down');
    const costKey = `${costText}|${reduced}`;
    if (costKey !== this.costKey) {
      this.costKey = costKey;
      const tex = remember(costCache, costKey, () => renderCostNumber(costText, reduced));
      if (!this.costMat) {
        this.costMat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false });
        this.mats.push(this.costMat);
        const m = new THREE.Mesh(g.costNum, this.costMat);
        m.position.set(-92, 136, FRONT_Z + 14);
        this.tilt.add(m);
      } else {
        this.costMat.map = tex;
        this.costMat.needsUpdate = true;
      }
    }
  }

  /** 毎フレームの動き（塵・光沢） */
  animate(time: number, dt: number): void {
    const p = this.motes.geometry.getAttribute('position') as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) {
      let y = p.getY(i) + dt * (6 + (i % 5) * 2);
      if (y > 128) y = -20;
      p.setY(i, y);
      p.setX(i, p.getX(i) + Math.sin(time * 0.8 + i) * dt * 3);
    }
    p.needsUpdate = true;
    if (this.sheen) {
      const map = (this.sheen.material as THREE.MeshBasicMaterial).map!;
      map.offset.set(-((time * 0.12) % 1) * 1.6, 0);
      if (this.def.rarity === 'legendary') (this.sheen.material as THREE.MeshBasicMaterial).color.setHSL((time * 0.08) % 1, 0.8, 0.6);
    }
  }

  setTilt(rx: number, ry: number): void {
    this.tilt.rotation.x = rx;
    this.tilt.rotation.y = ry;
  }

  setGlow(color: number | null, level: number): void {
    const m = this.glow.material as THREE.MeshBasicMaterial;
    if (color !== null) m.color.setHex(color);
    m.opacity = level;
  }

  setOpacity(o: number): void {
    this.shown = o > 0.02 && this.ready;
    (this.shadow.material as THREE.MeshBasicMaterial).opacity = 0.55 * o;
  }

  dispose(): void {
    // マテリアルは dispose しない。dispose すると three.js がシェーダーも捨ててしまい、
    // 次に同じ種類のカードを出した時に作り直しで画面が止まるため（マテリアル自体は GC で消える）
    this.motes.geometry.dispose();
  }
}

/**
 * 使い終わったレンダラーの置き場。
 * 画面を開くたびに WebGL の環境を作り直すと、シェーダーの準備で毎回画面が止まるため、
 * 閉じた画面のレンダラーをここに戻して次の画面で使い回す。
 */
const pool: { renderer: THREE.WebGLRenderer; canvas: HTMLCanvasElement; env: THREE.Texture }[] = [];
// スマホはメモリが少ないため置いておかない（使い終わったらすぐ解放する）
const POOL_MAX = IS_MOBILE ? 0 : 3;

export class CardLayer {
  readonly canvas: HTMLCanvasElement;
  private renderer: THREE.WebGLRenderer;
  private gl: (typeof pool)[number];
  /** 重い時に解像度を下げる倍率 */
  private dynScale = 1;
  private budget = new FrameBudget();
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(FOV, STAGE_W / STAGE_H, 50, CAM_Z * 3);
  private mouseLight = new THREE.PointLight(0xffd6a0, 2.4, 0, 0);
  private cards = new Map<HTMLElement, Card3D>();
  private raf = 0;
  private last = performance.now();
  private pointer = { x: 960, y: 700 };
  private disposed = false;
  private onMove = (e: PointerEvent) => {
    const r = ui.stage.el.getBoundingClientRect();
    this.pointer.x = (e.clientX - r.left) / ui.stage.scale;
    this.pointer.y = (e.clientY - r.top) / ui.stage.scale;
  };
  private onResize = () => this.renderer.setPixelRatio(this.pixelRatio());

  /**
   * 下準備：タイトル画面などの暇な時間に、見えないカードを何枚か描いてシェーダーを作っておく。
   * （作ったレンダラーは置き場に戻るので、最初の戦闘でカードを出した時に画面が止まらない）
   */
  static prewarm(): void {
    if (pool.length || IS_MOBILE) return;
    const rarities = ['basic', 'common', 'rare', 'legendary'];
    const defs = rarities.map((r) => CARDS.find((c) => c.rarity === r)).filter((c): c is CardDef => !!c);
    const host = document.createElement('div');
    host.style.cssText = 'position:absolute;left:0;top:0;width:1920px;height:1080px;visibility:hidden;pointer-events:none;';
    defs.forEach((d, i) => {
      const el = createCardEl(d);
      el.style.cssText += `position:absolute;left:${200 + i * 300}px;top:400px;`;
      host.append(el);
    });
    ui.stage.el.append(host);
    const layer = CardLayer.attach({ host, parent: host });
    // 文字の画像ができてから数フレーム描かせて、片付ける
    window.setTimeout(() => {
      layer?.dispose();
      host.remove();
    }, 2500);
  }

  /** 作れなかった（WebGL が使えない）場合は null */
  static attach(opts: CardLayerOptions): CardLayer | null {
    try {
      return new CardLayer(opts);
    } catch (e) {
      console.warn('3D カードを使えないため、通常のカードで表示します', e);
      return null;
    }
  }

  private constructor(private opts: CardLayerOptions) {
    let gl = pool.pop();
    if (!gl) {
      const canvas = document.createElement('canvas');
      canvas.className = 'card-gl-canvas';
      const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: !IS_MOBILE, premultipliedAlpha: true });
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.setClearColor(0x000000, 0);
      gl = { renderer, canvas, env: buildEnvMap(renderer) };
    }
    this.gl = gl;
    this.canvas = gl.canvas;
    this.renderer = gl.renderer;
    this.renderer.setPixelRatio(this.pixelRatio());
    this.renderer.setSize(STAGE_W, STAGE_H, false);
    this.renderer.toneMappingExposure = 1.15;
    this.renderer.setScissorTest(false);
    this.renderer.clear();
    this.scene.environment = gl.env;
    this.camera.position.set(0, 0, CAM_Z);
    // 光：暖色の主光（左上）、奥からの縁の光、マウスの点光源
    this.scene.add(new THREE.AmbientLight(0xffeedd, 0.25));
    const key = new THREE.DirectionalLight(0xffd2a0, 1.5);
    key.position.set(-0.5, 0.7, 1);
    this.scene.add(key);
    const rim = new THREE.DirectionalLight(0x9ab0ff, 0.6);
    rim.position.set(0.4, 1, -0.6);
    this.scene.add(rim);
    this.scene.add(this.mouseLight);

    opts.parent.insertBefore(this.canvas, opts.before ?? null);
    opts.host.classList.add('gl-cards');
    window.addEventListener('pointermove', this.onMove);
    window.addEventListener('resize', this.onResize);
    this.loop();
  }

  /** 描画解像度の倍率（画質設定で上限を変える。高解像度の画面で 2倍描くと重い） */
  private pixelRatio(): number {
    const q = settings.current.quality;
    const cap = IS_MOBILE ? 1 : q === 'high' ? 1.5 : q === 'medium' ? 1.25 : 1;
    return Math.min(cap, Math.max(1, window.devicePixelRatio * ui.stage.scale)) * this.dynScale;
  }

  private loop = (): void => {
    if (this.disposed) return;
    if (!this.opts.host.isConnected) {
      this.dispose();
      return;
    }
    this.raf = requestAnimationFrame(this.loop);
    const now = performance.now();
    // 重い状態が続いたら解像度を一段下げる（下限は 0.75 倍）
    if (this.budget.tick(now) && this.dynScale > 0.75) {
      this.dynScale = Math.max(0.75, this.dynScale * 0.85);
      this.renderer.setPixelRatio(this.pixelRatio());
    }
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    this.sync(now / 1000, dt);
    this.mouseLight.position.set(this.pointer.x - 960, 540 - this.pointer.y, 320);
    // 範囲外を描かない（スクロールする一覧）
    if (this.opts.clip) {
      const c = this.stageRect(this.opts.clip);
      this.renderer.setScissorTest(true);
      this.renderer.setScissor(c.x, STAGE_H - c.y - c.h, c.w, c.h);
    }
    // カードは重なり順に1枚ずつ描き、そのたびに奥行きの情報を消す。
    // （カードには厚みと窓の奥の箱があるので、まとめて描くと重なったカード同士が
    //   突き抜けて見える。1枚ずつ描けば DOM の重なり順どおりにきれいに重なる）
    const list = [...this.cards.values()].filter((c) => c.shown).sort((a, b) => a.drawOrder - b.drawOrder);
    this.cards.forEach((c) => (c.root.visible = false));
    this.renderer.autoClear = false;
    this.renderer.clear();
    for (const c of list) {
      c.root.visible = true;
      this.renderer.toneMappingExposure = c.dim ? 0.42 : 1.15;
      this.renderer.render(this.scene, this.camera);
      this.renderer.clearDepth();
      c.root.visible = false;
    }
  };

  /** 要素の、ステージ座標での位置と大きさ */
  private stageRect(el: Element): { x: number; y: number; w: number; h: number } {
    const s = ui.stage.el.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    const k = ui.stage.scale;
    return { x: (r.left - s.left) / k, y: (r.top - s.top) / k, w: r.width / k, h: r.height / k };
  }

  /** DOM のカードの状態を 3D に写す */
  private sync(time: number, dt: number): void {
    const els = this.opts.host.querySelectorAll<HTMLElement>('.card');
    this.cards.forEach((c) => (c.seen = false));
    const clip = this.opts.clip ? this.stageRect(this.opts.clip) : null;
    let order = 0;
    for (const el of els) {
      const id = el.dataset.cardId;
      if (!id || !hasCard(id)) continue;
      let c = this.cards.get(el);
      if (!c) {
        c = new Card3D(getCard(id));
        this.cards.set(el, c);
        this.scene.add(c.root);
      }
      c.seen = true;
      order++;
      c.updateContent(el);

      // ---- 位置・回転・大きさ ----
      const r = this.stageRect(el);
      const cx = r.x + r.w / 2;
      const cy = r.y + r.h / 2;
      const tf = getComputedStyle(el).transform;
      let angle = 0;
      if (tf && tf !== 'none') {
        const m = new DOMMatrixReadOnly(tf);
        angle = Math.atan2(m.b, m.a);
      }
      const cos = Math.abs(Math.cos(angle));
      const sin = Math.abs(Math.sin(angle));
      const scale = r.w / (CARD_W * cos + CARD_H * sin);

      // ---- 見えているか（透明度は親もたどって掛け合わせる） ----
      let opacity = 1;
      for (let p: HTMLElement | null = el; p && p !== this.opts.host.parentElement; p = p.parentElement) opacity *= parseFloat(getComputedStyle(p).opacity || '1');
      const outside = clip && (cx + r.w / 2 < clip.x || cx - r.w / 2 > clip.x + clip.w || cy + r.h / 2 < clip.y || cy - r.h / 2 > clip.y + clip.h);
      if (outside || el.offsetParent === null) opacity = 0;
      c.setOpacity(opacity);

      // ---- 手前に出す量（重なり順・ホバー） ----
      const hovered = el.matches(':hover');
      const zIndex = parseInt(el.style.zIndex || '0', 10) || 0;
      const lift = (hovered ? 40 : 0) + (el.classList.contains('dragging') ? 60 : 0) + (el.classList.contains('played') ? 50 : 0);
      c.lift += (lift - c.lift) * Math.min(1, dt * 12);
      c.root.position.set(cx - STAGE_W / 2, STAGE_H / 2 - cy, c.lift);
      c.drawOrder = zIndex * 10000 + order;
      c.root.rotation.z = -angle;
      c.root.scale.setScalar(scale);

      // ---- 傾き（CSS の --rx/--ry をそのまま使う）＋手札は少し寝かせる ----
      const rx = parseFloat(el.style.getPropertyValue('--rx')) || 0;
      const ry = parseFloat(el.style.getPropertyValue('--ry')) || 0;
      const inHand = el.classList.contains('in-hand') && !hovered && !el.classList.contains('dragging') && !el.classList.contains('played');
      const pitch = inHand ? (this.opts.handPitch ?? 0) : 0;
      c.setTilt(THREE.MathUtils.degToRad(-rx * 1.25 - pitch), THREE.MathUtils.degToRad(ry * 1.25));

      // ---- 光の縁取り ----
      let glowColor: number | null = null;
      let glow = 0;
      if (el.classList.contains('will-play')) [glowColor, glow] = [0xffd060, 1];
      else if (el.closest('.is-choosing') && el.classList.contains('in-hand')) [glowColor, glow] = [0xb080ff, 0.8];
      else if (el.classList.contains('played') || el.classList.contains('picked')) [glowColor, glow] = [0xfff0c0, 1];
      else if (el.classList.contains('playable')) [glowColor, glow] = [0xff7a28, 0.55 + Math.sin(time * 2.8) * 0.15 + (hovered ? 0.3 : 0)];
      else if (hovered && !el.classList.contains('unplayable')) [glowColor, glow] = [0xffc070, 0.7];
      else if (c.def.rarity === 'legendary') [glowColor, glow] = [0xff2020, 0.3 + Math.sin(time * 1.7) * 0.12];
      c.glowLevel += (glow - c.glowLevel) * Math.min(1, dt * 10);
      c.setGlow(glowColor, c.glowLevel * opacity);
      c.dim = el.classList.contains('unplayable') && !el.closest('.is-choosing');
      c.animate(time, dt);
    }
    // DOM から消えたカードを片付ける
    for (const [el, c] of this.cards) {
      if (!c.seen) {
        this.scene.remove(c.root);
        c.dispose();
        this.cards.delete(el);
      }
    }
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    window.removeEventListener('pointermove', this.onMove);
    window.removeEventListener('resize', this.onResize);
    this.cards.forEach((c) => c.dispose());
    this.cards.clear();
    this.opts.host.classList.remove('gl-cards');
    this.canvas.remove();
    // レンダラーは次の画面で使い回す（シェーダーを作り直さないため）
    this.renderer.renderLists.dispose();
    if (pool.length < POOL_MAX) pool.push(this.gl);
    else {
      this.gl.env.dispose();
      this.renderer.dispose();
      this.renderer.forceContextLoss();
    }
  }
}

/** カードの厚み（他のファイルから参照する場合用） */
export const CARD_THICKNESS = BODY_D;
