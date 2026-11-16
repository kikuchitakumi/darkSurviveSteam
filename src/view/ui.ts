// =============================================================
// ui.ts  【View：画面全体で共有する部品の入れ物】
// -------------------------------------------------------------
// ステージ・演出・メッセージウィンドウ・HUD など、どのシーンからも
// 使う部品を1か所にまとめ、`ui.msg.say(...)` のように呼べるようにする。
// =============================================================
import { Stage } from './Stage';
import { Particles } from './effects/Particles';
import { Fx } from './effects/Fx';
import { MessageBox } from './components/MessageBox';
import { Hud, type HudHandlers } from './components/Hud';
import { initTooltip } from './components/Tooltip';
import { initModal } from './components/Modal';
import { bus } from '@/core/EventBus';
import { animate, asset, h } from './dom';
import { IMAGES } from '@/data/images';

class UI {
  stage!: Stage;
  particles!: Particles;
  fx!: Fx;
  msg!: MessageBox;
  hud!: Hud;
  /** HUD のボタンが押された時の処理（Controller が差し替える） */
  hudHandlers: HudHandlers = { onItem: () => {}, onDeck: () => {}, onStatus: () => {}, onMenu: () => {} };

  init(root: HTMLElement): void {
    this.stage = new Stage(root);
    this.particles = new Particles(this.stage.fxCanvas);
    this.fx = new Fx(this.stage, this.particles);
    this.msg = new MessageBox(this.stage.message);
    this.hud = new Hud(this.stage.hud, {
      onItem: (i, el) => this.hudHandlers.onItem(i, el),
      onDeck: () => this.hudHandlers.onDeck(),
      onStatus: () => this.hudHandlers.onStatus(),
      onMenu: () => this.hudHandlers.onMenu(),
    });
    initTooltip(this.stage.el, () => this.stage.scale);
    initModal(this.stage.modal);
    bus.on('toast', ({ text, kind }) => this.toast(text, kind));
    this.makeGrainTexture();
    // UI部品の画像を CSS 変数に登録（data/images.ts の画像を差し替えれば全画面に反映される）
    const vars: Record<string, string> = {
      '--btn-img': IMAGES.button,
      '--btn-primary-img': IMAGES.buttonPrimary,
      '--panel-img': IMAGES.panel,
      '--end-turn-img': IMAGES.endTurn,
      '--card-back-img': IMAGES.cardBack,
    };
    // CSS 変数の相対パスは「使う側の CSS ファイル」基準で解決されてしまう（本番では assets/assets/... になる）ため、絶対 URL にして渡す
    for (const [k, path] of Object.entries(vars)) document.documentElement.style.setProperty(k, `url("${new URL(asset(path), document.baseURI).href}")`);
  }

  /** 画面上部に短い通知を出す */
  toast(text: string, kind: 'info' | 'good' | 'bad' = 'info'): void {
    const el = h(`div.toast.toast-${kind}`, {}, text);
    this.stage.toast.append(el);
    animate(el, [{ opacity: 0, transform: 'translateY(-20px)' }, { opacity: 1, transform: 'translateY(0)', offset: 0.1 }, { opacity: 1, offset: 0.8 }, { opacity: 0 }], { duration: 2400 }).then(() => el.remove());
  }

  /** フィルムグレイン用のノイズ画像を実行時に生成（画像ファイル不要） */
  private makeGrainTexture(): void {
    const c = document.createElement('canvas');
    c.width = c.height = 256;
    const ctx = c.getContext('2d')!;
    const data = ctx.createImageData(256, 256);
    for (let i = 0; i < data.data.length; i += 4) {
      const v = Math.random() * 255;
      data.data[i] = data.data[i + 1] = data.data[i + 2] = v;
      data.data[i + 3] = 255;
    }
    ctx.putImageData(data, 0, 0);
    document.documentElement.style.setProperty('--grain-url', `url(${c.toDataURL()})`);
  }
}

export const ui = new UI();
