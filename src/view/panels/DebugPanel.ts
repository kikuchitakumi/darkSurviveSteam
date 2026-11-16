// =============================================================
// DebugPanel.ts  【View パネル：デバッグ用「好きな階から開始」】
// -------------------------------------------------------------
// タイトル画面の DEBUG ボタンから開く。階数を入力して決定すると
// その階数を Promise で返す（閉じた場合は null）。URL に ?debug=1 が
// 付いている時だけタイトル画面に表示される。
// =============================================================
import { BALANCE } from '@/config/balance';
import { t } from '@/i18n';
import { button, h } from '../dom';
import { openModal } from '../components/Modal';

/** よく使う階（ボスの手前・各ゾーンの入口など） */
const PRESETS = [2, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100];

export function openDebugStart(): Promise<number | null> {
  return new Promise((resolve) => {
    let picked: number | null = null;
    const max = BALANCE.MAX_FLOOR;
    const input = h<'input'>('input.debug-floor-input', { type: 'number', min: 1, max, value: '10' });
    const clamp = () => Math.min(max, Math.max(1, Math.floor(Number(input.value) || 1)));

    const submit = () => {
      picked = clamp();
      modal.close();
    };
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        submit();
      }
      e.stopPropagation(); // 数字キーなどがゲーム側のショートカットに渡らないように
    });

    const presets = h('div.debug-presets', {}, PRESETS.map((f) => button(`${f}F`, () => { input.value = String(f); }, { cls: 'debug-preset' })));
    const modal = openModal(t('debug.title'), [
      h('label.debug-label', {}, t('debug.floor', { max })),
      input,
      presets,
      h('div.debug-note', {}, t('debug.note')),
    ], {
      cls: 'modal-small',
      onClose: () => resolve(picked),
      footer: [button(t('debug.start'), submit, { cls: 'primary' })],
    });
    setTimeout(() => input.select(), 50);
  });
}
