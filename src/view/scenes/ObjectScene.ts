// =============================================================
// ObjectScene.ts  【View シーン：背景＋透過オブジェクトの画面】
// -------------------------------------------------------------
// 仕様「背景画像の上に、ボタンやオブジェクトを透過画像で表示」を担当する汎用シーン。
// 1F・2F以降の分かれ道（扉）・宝物庫（宝箱）・イベント画面で共通して使う。
//
//  showObjectScene({ background, objects: [{ id, image, x, y, ... }] })
//   → handle.waitPick() でクリックされたオブジェクトの id を受け取れる
// 座標 x, y はステージ（1920x1080）上の「オブジェクトの足元中央」。
// =============================================================
import { Audio } from '@/core/AudioManager';
import { animate, clear, h, img } from '../dom';
import { ui } from '../ui';
import { attachTooltip } from '../components/Tooltip';
import type { AmbientKind } from '../effects/Particles';

export interface SceneObject {
  id: string;
  image: string;
  x: number;
  y: number;
  /** 表示の高さ(px) */
  height: number;
  /** オブジェクトの下に出す名札 */
  label?: string;
  /** 名札の下の小さな説明 */
  sub?: string;
  /** クリックできるか */
  clickable?: boolean;
  tooltip?: string;
  cls?: string;
}

export interface ObjectSceneHandle {
  root: HTMLElement;
  waitPick(): Promise<string>;
  setClass(id: string, cls: string, on: boolean): void;
  get(id: string): HTMLElement | undefined;
  /** オブジェクトを強調（ピカッと光らせる） */
  pulse(id: string): void;
}

export function showObjectScene(opts: { background: string; objects: SceneObject[]; ambient?: AmbientKind; title?: string; subtitle?: string; tint?: string }): ObjectSceneHandle {
  const root = ui.stage.scene;
  clear(root);
  ui.stage.setBackground(opts.background, { tint: opts.tint });
  ui.particles.setAmbient(opts.ambient ?? 'dust');
  const wrap = h('div.scene.object-scene');
  if (opts.title) {
    wrap.append(h('div.scene-title', {}, [h('div.scene-title-main', {}, opts.title), opts.subtitle ? h('div.scene-title-sub', {}, opts.subtitle) : null]));
  }
  const els = new Map<string, HTMLElement>();
  let pickResolver: ((id: string) => void) | null = null;

  opts.objects.forEach((o, i) => {
    const el = h(`div.scene-obj${o.clickable ? '.clickable' : ''}${o.cls ? '.' + o.cls.split(' ').join('.') : ''}`, {
      style: { left: `${o.x}px`, top: `${o.y}px` },
      dataset: { id: o.id },
    }, [
      h('div.scene-obj-shadow'),
      img(o.image, 'scene-obj-img'),
      o.label ? h('div.scene-obj-label', {}, [h('div', {}, o.label), o.sub ? h('div.scene-obj-sub', {}, o.sub) : null]) : null,
    ]);
    (el.querySelector('.scene-obj-img') as HTMLElement).style.height = `${o.height}px`;
    if (o.clickable) {
      el.addEventListener('mouseenter', () => Audio.play('se_hover'));
      el.addEventListener('click', () => {
        if (!pickResolver || el.classList.contains('disabled')) return;
        Audio.play('se_click');
        const r = pickResolver;
        pickResolver = null;
        r(o.id);
      });
    }
    if (o.tooltip) attachTooltip(el, () => o.tooltip!);
    els.set(o.id, el);
    wrap.append(el);
    animate(el, [{ opacity: 0, transform: 'translate(-50%,-100%) translateY(30px)' }, { opacity: 1, transform: 'translate(-50%,-100%)' }], { duration: 600, delay: 150 + i * 120, easing: 'cubic-bezier(.2,.9,.3,1)', fill: 'backwards' });
  });
  root.append(wrap);

  return {
    root: wrap,
    waitPick: () => new Promise((r) => (pickResolver = r)),
    setClass: (id, cls, on) => els.get(id)?.classList.toggle(cls, on),
    get: (id) => els.get(id),
    pulse: (id) => {
      const el = els.get(id);
      if (el) animate(el, [{ filter: 'brightness(2.2)' }, { filter: 'brightness(1)' }], 600);
    },
  };
}
