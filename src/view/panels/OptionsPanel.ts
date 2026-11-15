// =============================================================
// OptionsPanel.ts  【View パネル：オプション（音量・画質・言語など）】
// -------------------------------------------------------------
// 仕様：OPTION で 音量 / SE / 画質 / Language を設定できる。
// 値の保存は core/Settings.ts が行う。
// ゲーム中に開いた場合は「タイトルへ戻る」「冒険を諦める」も表示する。
// =============================================================
import { Audio } from '@/core/AudioManager';
import { settings } from '@/core/Settings';
import { LANGUAGES, t } from '@/i18n';
import type { Settings } from '@/core/Storage';
import { button, clear, h } from '../dom';
import { confirmDialog, openModal } from '../components/Modal';

export function openOptions(inGame?: { onToTitle: () => void; onAbandon: () => void }): void {
  const body = h('div.options');

  const slider = (key: 'bgmVolume' | 'seVolume', label: string) => {
    const val = h('div.opt-val', {}, `${Math.round(settings.current[key] * 100)}`);
    const input = h<'input'>('input.opt-slider', { type: 'range', min: '0', max: '100', value: String(Math.round(settings.current[key] * 100)) });
    input.addEventListener('input', () => {
      settings.update({ [key]: Number(input.value) / 100 } as Partial<Settings>);
      val.textContent = input.value;
    });
    input.addEventListener('change', () => key === 'seVolume' && Audio.play('se_click'));
    return h('div.opt-row', {}, [h('div.opt-label', {}, label), input, val]);
  };

  const segmented = <K extends keyof Settings>(key: K, label: string, options: { v: Settings[K]; label: string }[]) => {
    const wrap = h('div.opt-seg');
    const draw = () => {
      clear(wrap);
      for (const o of options) {
        wrap.append(button(o.label, () => {
          settings.update({ [key]: o.v } as Partial<Settings>);
          if (key === 'fullscreen') toggleFullscreen(!!o.v);
          render();
        }, { cls: settings.current[key] === o.v ? 'seg active' : 'seg' }));
      }
    };
    draw();
    return h('div.opt-row', {}, [h('div.opt-label', {}, label), wrap]);
  };

  const render = () => {
    clear(body);
    body.append(
      slider('bgmVolume', t('option.bgm')),
      slider('seVolume', t('option.se')),
      segmented('quality', t('option.quality'), [
        { v: 'low', label: t('option.quality.low') },
        { v: 'medium', label: t('option.quality.medium') },
        { v: 'high', label: t('option.quality.high') },
      ]),
      segmented('language', t('option.language'), LANGUAGES.map((l) => ({ v: l.code, label: l.label }))),
      segmented('textSpeed', t('option.textSpeed'), [
        { v: 45, label: t('option.textSpeed.slow') },
        { v: 28, label: t('option.textSpeed.normal') },
        { v: 10, label: t('option.textSpeed.fast') },
      ]),
      segmented('screenShake', t('option.screenShake'), [
        { v: true, label: t('option.on') },
        { v: false, label: t('option.off') },
      ]),
      segmented('fullscreen', t('option.fullscreen'), [
        { v: true, label: t('option.on') },
        { v: false, label: t('option.off') },
      ]),
    );
    if (inGame) {
      body.append(h('div.opt-ingame', {}, [
        button(t('option.toTitle'), () => { m.close(); inGame.onToTitle(); }),
        button(t('option.abandon'), async () => {
          if (await confirmDialog(t('option.abandonConfirm'))) { m.close(); inGame.onAbandon(); }
        }, { cls: 'danger' }),
      ]));
    }
  };
  render();
  const m = openModal(t('option.title'), body, { cls: 'modal-options' });
}

function toggleFullscreen(on: boolean): void {
  try {
    if (on && !document.fullscreenElement) document.documentElement.requestFullscreen?.();
    else if (!on && document.fullscreenElement) document.exitFullscreen?.();
  } catch {
    /* 対応していない環境では無視 */
  }
}
