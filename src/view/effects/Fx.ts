// =============================================================
// Fx.ts  【View/演出：画面揺れ・ダメージ数字・斬撃・バナー】
// -------------------------------------------------------------
// 戦闘などで使う「手触り（ジュース）」の演出をまとめたもの。
// Balatro / Slay the Spire 2 のような気持ちよさを出すため、
// 数字のポップ・ヒットストップ・画面揺れを丁寧に重ねている。
// =============================================================
import { settings } from '@/core/Settings';
import { animate, h, wait } from '../dom';
import type { Stage } from '../Stage';
import type { Particles } from './Particles';

export class Fx {
  constructor(private stage: Stage, readonly particles: Particles) {}

  /** 画面揺れ（オプションでOFFにできる） */
  shake(power = 1, ms = 320): void {
    if (!settings.current.screenShake) return;
    const p = 14 * power;
    const frames: Keyframe[] = [];
    for (let i = 0; i < 8; i++) {
      const k = 1 - i / 8;
      frames.push({ transform: `translate(${(Math.random() - 0.5) * p * k}px, ${(Math.random() - 0.5) * p * k}px)` });
    }
    frames.push({ transform: 'translate(0,0)' });
    animate(this.stage.scene, frames, { duration: ms, easing: 'linear' });
    animate(this.stage.bg, frames, { duration: ms, easing: 'linear' });
  }

  /** ヒットストップ（一瞬止めて重さを出す） */
  hitStop(ms = 70): Promise<void> {
    return wait(ms);
  }

  /**
   * ダメージなどの数字を浮かび上がらせる
   * @param kind damage / crit / block / heal / miss / status / poison
   */
  popNumber(x: number, y: number, text: string, kind: 'damage' | 'crit' | 'block' | 'heal' | 'miss' | 'status' | 'poison' | 'curse' | 'buff' | 'debuff' = 'damage'): void {
    const el = h(`div.pop-number.pop-${kind}`, { style: { left: `${x}px`, top: `${y}px` } }, text);
    this.stage.fxLayer.append(el);
    const dx = (Math.random() - 0.5) * 80;
    const big = kind === 'crit' ? 1.9 : kind === 'damage' ? 1.35 : 1.1;
    animate(
      el,
      [
        { transform: 'translate(-50%,-50%) scale(0.3)', opacity: 0 },
        { transform: `translate(-50%,-90%) scale(${big})`, opacity: 1, offset: 0.15 },
        { transform: `translate(calc(-50% + ${dx * 0.6}px),-120%) scale(1)`, opacity: 1, offset: 0.55 },
        { transform: `translate(calc(-50% + ${dx}px),-220%) scale(0.9)`, opacity: 0 },
      ],
      { duration: kind === 'crit' ? 1500 : 1100, easing: 'cubic-bezier(.2,.8,.3,1)' },
    ).then(() => el.remove());
  }

  /** 斬撃エフェクト */
  slash(x: number, y: number, crit = false): void {
    const angle = -30 + Math.random() * 60;
    const el = h(`div.slash${crit ? '.slash-crit' : ''}`, { style: { left: `${x}px`, top: `${y}px`, transform: `translate(-50%,-50%) rotate(${angle}deg)` } });
    this.stage.fxLayer.append(el);
    animate(
      el,
      [
        { clipPath: 'inset(0 100% 0 0)', opacity: 1 },
        { clipPath: 'inset(0 0 0 0)', opacity: 1, offset: 0.35 },
        { clipPath: 'inset(0 0 0 100%)', opacity: 0 },
      ],
      { duration: 340, easing: 'ease-out' },
    ).then(() => el.remove());
    if (crit) {
      const el2 = h('div.slash.slash-crit', { style: { left: `${x}px`, top: `${y}px`, transform: `translate(-50%,-50%) rotate(${angle + 90}deg)` } });
      this.stage.fxLayer.append(el2);
      animate(el2, [{ clipPath: 'inset(0 100% 0 0)' }, { clipPath: 'inset(0 0 0 0)', offset: 0.35 }, { clipPath: 'inset(0 0 0 100%)', opacity: 0 }], { duration: 340, delay: 80 }).then(() => el2.remove());
    }
  }

  /** 衝撃波リング */
  ring(x: number, y: number, color = 'rgba(255,220,180,0.9)', size = 260): void {
    const el = h('div.fx-ring', { style: { left: `${x}px`, top: `${y}px`, borderColor: color, width: `${size}px`, height: `${size}px` } });
    this.stage.fxLayer.append(el);
    animate(el, [{ transform: 'translate(-50%,-50%) scale(0.1)', opacity: 1 }, { transform: 'translate(-50%,-50%) scale(1)', opacity: 0 }], { duration: 450, easing: 'ease-out' }).then(() => el.remove());
  }

  /** 画面中央に大きな文字のバナー（ターン開始・VICTORY など） */
  async banner(text: string, opts: { sub?: string; cls?: string; hold?: number } = {}): Promise<void> {
    const el = h(`div.banner${opts.cls ? '.' + opts.cls : ''}`, {}, [h('div.banner-line'), h('div.banner-text', {}, text), opts.sub ? h('div.banner-sub', {}, opts.sub) : null]);
    this.stage.fxLayer.append(el);
    await animate(el, [{ opacity: 0, transform: 'translate(-50%,-50%) scaleY(0.2)', filter: 'blur(8px)' }, { opacity: 1, transform: 'translate(-50%,-50%) scaleY(1)', filter: 'blur(0)' }], { duration: 260, easing: 'cubic-bezier(.2,1.4,.4,1)', fill: 'forwards' });
    await wait(opts.hold ?? 650);
    await animate(el, [{ opacity: 1 }, { opacity: 0, transform: 'translate(-50%,-50%) scaleX(1.15)' }], { duration: 260, fill: 'forwards' });
    el.remove();
  }

  /** 小さな浮き文字（状態異常名など） */
  floatText(x: number, y: number, text: string, cls = ''): void {
    const el = h(`div.float-text${cls ? '.' + cls : ''}`, { style: { left: `${x}px`, top: `${y}px` } }, text);
    this.stage.fxLayer.append(el);
    animate(el, [{ opacity: 0, transform: 'translate(-50%,0)' }, { opacity: 1, transform: 'translate(-50%,-20px)', offset: 0.2 }, { opacity: 0, transform: 'translate(-50%,-70px)' }], { duration: 1200, easing: 'ease-out' }).then(() => el.remove());
  }
}
