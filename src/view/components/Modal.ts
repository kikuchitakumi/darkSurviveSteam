// =============================================================
// Modal.ts  【View部品：モーダルウィンドウ】
// -------------------------------------------------------------
// 画面中央に重ねて表示するウィンドウ。Esc / 背景クリックで閉じられる。
//  - openModal(...)    … 任意の中身を表示
//  - confirmDialog(...) … はい/いいえ の確認
// =============================================================
import { Audio } from '@/core/AudioManager';
import { t } from '@/i18n';
import { animate, button, h } from '../dom';

let layer: HTMLElement;
const stack: { el: HTMLElement; close: () => void }[] = [];

export function initModal(modalLayer: HTMLElement): void {
  layer = modalLayer;
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && stack.length) {
      e.preventDefault();
      stack[stack.length - 1].close();
    }
  });
}

export function isModalOpen(): boolean {
  return stack.length > 0;
}

export interface ModalHandle {
  el: HTMLElement;
  body: HTMLElement;
  close: () => void;
  closed: Promise<void>;
}

/**
 * モーダルを開く
 * @param opts.dismissable false にすると Esc・背景クリックで閉じない
 */
export function openModal(title: string, content: HTMLElement | HTMLElement[], opts: { cls?: string; dismissable?: boolean; onClose?: () => void; footer?: HTMLElement[] } = {}): ModalHandle {
  const body = h('div.modal-body', {}, content);
  const dismissable = opts.dismissable !== false;
  let resolveClosed!: () => void;
  const closed = new Promise<void>((r) => (resolveClosed = r));
  let isClosed = false;
  const close = () => {
    if (isClosed) return;
    isClosed = true;
    Audio.play('se_cancel');
    const idx = stack.findIndex((s) => s.el === wrap);
    if (idx >= 0) stack.splice(idx, 1);
    animate(win, [{ opacity: 1, transform: 'scale(1)' }, { opacity: 0, transform: 'scale(0.96)' }], { duration: 160, fill: 'forwards' });
    animate(wrap, [{ opacity: 1 }, { opacity: 0 }], { duration: 180, fill: 'forwards' }).then(() => wrap.remove());
    opts.onClose?.();
    resolveClosed();
  };
  const header = h('div.modal-header', {}, [h('div.modal-title', {}, title), dismissable ? button('✕', close, { cls: 'modal-close', se: 'se_cancel' }) : null]);
  const footer = opts.footer ? h('div.modal-footer', {}, opts.footer) : null;
  const win = h(`div.modal-window${opts.cls ? '.' + opts.cls : ''}`, {}, [header, body, footer]);
  const wrap = h('div.modal-wrap', {}, [h('div.modal-backdrop', { onclick: () => dismissable && close() }), win]);
  layer.append(wrap);
  animate(win, [{ opacity: 0, transform: 'scale(0.94) translateY(20px)' }, { opacity: 1, transform: 'scale(1) translateY(0)' }], { duration: 220, easing: 'cubic-bezier(.2,1.2,.4,1)' });
  stack.push({ el: wrap, close: () => dismissable && close() });
  return { el: win, body, close, closed };
}

/** はい / いいえ の確認ダイアログ */
export function confirmDialog(message: string, yes = t('common.yes'), no = t('common.no')): Promise<boolean> {
  return new Promise((resolve) => {
    let answered = false;
    const m = openModal(t('common.confirm'), h('div.confirm-text', {}, message), {
      cls: 'modal-small',
      onClose: () => !answered && resolve(false),
      footer: [
        button(no, () => { answered = true; resolve(false); m.close(); }, { se: 'se_cancel' }),
        button(yes, () => { answered = true; resolve(true); m.close(); }, { cls: 'primary' }),
      ],
    });
  });
}
