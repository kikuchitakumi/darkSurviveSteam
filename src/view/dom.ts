// =============================================================
// dom.ts  【View：DOM操作の小さな補助関数】
// -------------------------------------------------------------
// 画面は HTML 要素（DOM）で組み立てている。
// フレームワークを使わない代わりに、要素作成を短く書ける h() を用意した。
//   h('div.card.attack', { onclick: fn }, [子要素...])
// =============================================================
import { GAME_CONFIG } from '@/config/gameConfig';
import { Audio } from '@/core/AudioManager';
import type { SeKey } from '@/data/audio';

type Child = Node | string | number | null | undefined | false;
type Props = Partial<Omit<HTMLElement, 'style' | 'dataset'>> & {
  style?: Partial<CSSStyleDeclaration> | string;
  dataset?: Record<string, string>;
  [key: string]: unknown;
};

/**
 * 要素を作る。
 * @param sel  'div.class1.class2#id' 形式
 */
export function h<K extends keyof HTMLElementTagNameMap = 'div'>(sel: string, props: Props = {}, children: Child[] | Child = []): HTMLElementTagNameMap[K] {
  const m = sel.match(/^([a-z0-9]+)?((?:[.#][\w-]+)*)$/i);
  const tag = (m?.[1] || 'div') as K;
  const el = document.createElement(tag);
  (m?.[2] ?? '').replace(/([.#])([\w-]+)/g, (_, t, name) => {
    if (t === '.') el.classList.add(name);
    else el.id = name;
    return '';
  });
  for (const [k, v] of Object.entries(props)) {
    if (v === undefined) continue;
    if (k === 'style') {
      if (typeof v === 'string') el.setAttribute('style', v);
      else Object.assign(el.style, v);
    } else if (k === 'dataset') Object.assign(el.dataset, v);
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v as EventListener);
    else if (k in el) (el as any)[k] = v;
    else el.setAttribute(k, String(v));
  }
  const list = Array.isArray(children) ? children : [children];
  for (const c of list) {
    if (c === null || c === undefined || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}

/** assets/ 以下の画像パスを URL に変換 */
/**
 * 開発メニューでブラウザ内（IndexedDB）に保存した画像の「idb:～」→ 表示用URL の対応表。
 * services/content.ts が起動時に登録する。
 */
export const localImageUrls = new Map<string, string>();

/**
 * 画像パスを表示用の URL に変換する。
 *  - 'images/～'          … public/assets/ 以下のファイル
 *  - 'https://～'          … Firebase Storage などの URL（そのまま）
 *  - 'idb:～'              … ブラウザ内に保存した画像（ローカル保存モード）
 */
export function asset(path: string): string {
  if (/^(https?:|data:|blob:)/.test(path)) return path;
  if (path.startsWith('idb:')) return localImageUrls.get(path) ?? '';
  return `${GAME_CONFIG.ASSET_ROOT}/${path}`;
}

/** 画像要素を作る（ドラッグ不可） */
export function img(path: string, cls = ''): HTMLImageElement {
  const el = h<'img'>(`img${cls ? '.' + cls.split(' ').join('.') : ''}`, { src: asset(path), draggable: false, alt: '' });
  return el;
}

/** 演出の速さ（将来「高速モード」用） */
export let SPEED = 1;
export function setSpeed(s: number): void {
  SPEED = s;
}

/** ms ミリ秒待つ */
export function wait(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms / SPEED));
}

/** Web Animations API をPromiseで待てるようにしたもの */
export function animate(el: Element, keyframes: Keyframe[] | PropertyIndexedKeyframes, opts: KeyframeAnimationOptions | number): Promise<void> {
  const o: KeyframeAnimationOptions = typeof opts === 'number' ? { duration: opts } : { ...opts };
  if (typeof o.duration === 'number') o.duration = o.duration / SPEED;
  if (typeof o.delay === 'number') o.delay = o.delay / SPEED;
  const a = el.animate(keyframes, o);
  return a.finished.then(() => undefined).catch(() => undefined);
}

/** 要素の中身を空にする */
export function clear(el: Element): void {
  while (el.firstChild) el.removeChild(el.firstChild);
}

/**
 * ゲーム内ボタン（透過画像の枠＋文字）。ホバー音・決定音つき。
 */
export function button(label: string, onClick: () => void, opts: { cls?: string; se?: SeKey; disabled?: boolean; sub?: string } = {}): HTMLButtonElement {
  const b = h<'button'>(`button.ds-btn${opts.cls ? '.' + opts.cls.split(' ').join('.') : ''}`, {}, [
    h('span.ds-btn-label', {}, label),
    opts.sub ? h('span.ds-btn-sub', {}, opts.sub) : null,
  ]);
  b.disabled = !!opts.disabled;
  b.addEventListener('mouseenter', () => !b.disabled && Audio.play('se_hover'));
  b.addEventListener('click', (e) => {
    e.stopPropagation();
    if (b.disabled) return;
    Audio.play(opts.se ?? 'se_click');
    onClick();
  });
  return b;
}

/** ステージ座標系での要素の中心位置（エフェクトの位置決め用） */
export function centerOf(el: Element, stage: HTMLElement, scale: number): { x: number; y: number } {
  const r = el.getBoundingClientRect();
  const s = stage.getBoundingClientRect();
  return { x: (r.left + r.width / 2 - s.left) / scale, y: (r.top + r.height / 2 - s.top) / scale };
}

/** 数値を3桁区切りに */
export function fmt(n: number): string {
  return n.toLocaleString('en-US');
}
