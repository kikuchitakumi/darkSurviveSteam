// =============================================================
// Tooltip.ts  【View部品：マウスを乗せた時の説明表示】
// -------------------------------------------------------------
// attachTooltip(要素, () => 説明) で、どの要素にも説明を付けられる。
// 内容は関数で渡すので、表示する瞬間の最新の値が使われる。
// =============================================================
import { h } from '../dom';

let tipEl: HTMLElement | null = null;
let stageEl: HTMLElement | null = null;
let getScale: () => number = () => 1;

export function initTooltip(stage: HTMLElement, scaleFn: () => number): void {
  stageEl = stage;
  getScale = scaleFn;
  tipEl = h('div.tooltip');
  stage.append(tipEl);
}

export type TipContent = string | { title: string; body?: string; footer?: string };

export function showTip(target: Element, content: TipContent): void {
  if (!tipEl || !stageEl) return;
  tipEl.innerHTML = '';
  if (typeof content === 'string') tipEl.append(h('div.tip-body', {}, content));
  else {
    tipEl.append(h('div.tip-title', {}, content.title));
    if (content.body) tipEl.append(h('div.tip-body', {}, content.body));
    if (content.footer) tipEl.append(h('div.tip-footer', {}, content.footer));
  }
  const s = getScale();
  const r = target.getBoundingClientRect();
  const sr = stageEl.getBoundingClientRect();
  tipEl.classList.add('visible');
  const tw = tipEl.offsetWidth;
  const th = tipEl.offsetHeight;
  let x = (r.left - sr.left) / s + r.width / s / 2 - tw / 2;
  let y = (r.top - sr.top) / s - th - 12;
  if (y < 80) y = (r.bottom - sr.top) / s + 12;
  x = Math.max(10, Math.min(1920 - tw - 10, x));
  y = Math.max(10, Math.min(1080 - th - 10, y));
  tipEl.style.left = `${x}px`;
  tipEl.style.top = `${y}px`;
}

export function hideTip(): void {
  tipEl?.classList.remove('visible');
}

export function attachTooltip(el: HTMLElement, content: () => TipContent | null): void {
  el.addEventListener('mouseenter', () => {
    const c = content();
    if (c) showTip(el, c);
  });
  el.addEventListener('mouseleave', hideTip);
  el.addEventListener('pointerdown', hideTip);
}
