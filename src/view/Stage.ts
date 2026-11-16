// =============================================================
// Stage.ts  【View：画面全体の土台（レイヤー構成と拡大縮小）】
// -------------------------------------------------------------
// 1920x1080 の「ステージ」を作り、ウィンドウサイズに合わせて
// 縦横比を保ったまま拡大縮小する（余白は黒帯＝レターボックス）。
//
// ■ レイヤー（下から順に重なる）
//   bg        … 背景画像（シーンごとに切り替え、クロスフェード）
//   scene     … 各シーンの中身（敵・ボタン・カードなど）
//   fx        … パーティクル（塵・火の粉）用 canvas
//   overlay   … ビネット（周辺減光）・フィルムグレイン・赤い点滅
//   hud       … 上部のステータスバー
//   message   … 下部のメッセージウィンドウ
//   modal     … モーダルウィンドウ（デッキ一覧・オプション等）
//   toast     … 短い通知
//   transition… 画面切り替えの暗転
// =============================================================
import { GAME_CONFIG } from '@/config/gameConfig';
import { asset, h, wait } from './dom';

export class Stage {
  readonly root: HTMLElement;
  readonly el: HTMLElement;
  readonly bg: HTMLElement;
  readonly scene: HTMLElement;
  readonly fxCanvas: HTMLCanvasElement;
  readonly overlay: HTMLElement;
  readonly hud: HTMLElement;
  readonly message: HTMLElement;
  readonly modal: HTMLElement;
  readonly toast: HTMLElement;
  readonly transition: HTMLElement;
  readonly fxLayer: HTMLElement;
  /** 現在の拡大率（ステージ座標 → 画面座標） */
  scale = 1;

  private currentBg: string | null = null;

  constructor(root: HTMLElement) {
    this.root = root;
    this.bg = h('div.layer.layer-bg');
    this.scene = h('div.layer.layer-scene');
    this.fxCanvas = h<'canvas'>('canvas.layer.layer-fx', { width: GAME_CONFIG.STAGE_WIDTH, height: GAME_CONFIG.STAGE_HEIGHT });
    this.fxLayer = h('div.layer.layer-fx-dom');
    this.overlay = h('div.layer.layer-overlay', {}, [h('div.vignette'), h('div.grain'), h('div.hurt-flash'), h('div.lowhp-pulse')]);
    this.hud = h('div.layer.layer-hud');
    this.message = h('div.layer.layer-message');
    this.modal = h('div.layer.layer-modal');
    this.toast = h('div.layer.layer-toast');
    this.transition = h('div.layer.layer-transition');
    this.el = h('div#stage', {}, [this.bg, this.scene, this.fxCanvas, this.fxLayer, this.overlay, this.hud, this.message, this.modal, this.toast, this.transition]);
    root.append(this.el);
    window.addEventListener('resize', () => this.fit());
    // マウスの位置に合わせて背景をわずかにずらす（奥行き感＝パララックス）
    let raf = 0;
    window.addEventListener('pointermove', (e) => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        this.bg.style.setProperty('--px', ((e.clientX / window.innerWidth) * 2 - 1).toFixed(3));
        this.bg.style.setProperty('--py', ((e.clientY / window.innerHeight) * 2 - 1).toFixed(3));
      });
    });
    // 要素へのフォーカス等でブラウザが勝手にスクロールすると画面がずれるため、常に0に戻す。
    // ただし overflow: auto / scroll の要素（一覧・開発メニューの各欄など）は
    // スクロールさせるための場所なので戻さない。
    document.addEventListener('scroll', (e) => {
      const t = e.target as HTMLElement | Document;
      if (t instanceof HTMLElement && (t.scrollTop || t.scrollLeft) && !isScrollArea(t)) {
        t.scrollTop = 0;
        t.scrollLeft = 0;
      }
    }, true);
    this.fit();
  }

  /** ウィンドウに合わせて拡大縮小 */
  fit(): void {
    const W = GAME_CONFIG.STAGE_WIDTH;
    const H = GAME_CONFIG.STAGE_HEIGHT;
    this.scale = Math.min(window.innerWidth / W, window.innerHeight / H);
    const x = (window.innerWidth - W * this.scale) / 2;
    const y = (window.innerHeight - H * this.scale) / 2;
    this.el.style.transform = `translate(${x}px, ${y}px) scale(${this.scale})`;
  }

  /** 背景画像を切り替える（クロスフェード） */
  setBackground(path: string | null, opts: { tint?: string; zoom?: boolean } = {}): void {
    if (path === this.currentBg && !opts.tint) return;
    this.currentBg = path;
    const layer = h('div.bg-image', {
      style: { backgroundImage: path ? `url("${asset(path)}")` : 'none' },
    });
    if (opts.zoom !== false) layer.classList.add('bg-drift');
    if (opts.tint) layer.append(h('div.bg-tint', { style: { background: opts.tint } }));
    this.bg.append(layer);
    requestAnimationFrame(() => layer.classList.add('visible'));
    const olds = Array.from(this.bg.children).slice(0, -1);
    setTimeout(() => olds.forEach((o) => o.remove()), 900);
  }

  /** 暗転 → 処理 → 明転 */
  async fadeTransition(during: () => void | Promise<void>, ms = 450): Promise<void> {
    this.transition.classList.add('active');
    await wait(ms);
    await during();
    await wait(60);
    this.transition.classList.remove('active');
    await wait(ms * 0.6);
  }

  /** 被ダメージ時の赤いフラッシュ */
  hurtFlash(strength = 1): void {
    const el = this.overlay.querySelector('.hurt-flash') as HTMLElement;
    el.style.setProperty('--strength', String(strength));
    el.classList.remove('on');
    void el.offsetWidth;
    el.classList.add('on');
  }

  /** 低HP時の赤い脈動 ON/OFF */
  setLowHp(on: boolean): void {
    this.overlay.querySelector('.lowhp-pulse')!.classList.toggle('on', on);
  }
}

/** ユーザーがスクロールするための要素か（CSS で overflow: auto / scroll を指定した要素） */
function isScrollArea(el: HTMLElement): boolean {
  const cs = getComputedStyle(el);
  return /auto|scroll/.test(cs.overflowY) || /auto|scroll/.test(cs.overflowX);
}
