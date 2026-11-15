// =============================================================
// MessageBox.ts  【View部品：画面下のメッセージウィンドウ】
// -------------------------------------------------------------
// 仕様「セリフとかは下にテキストが流れる形でゲームが進行する」を担当。
//  - say(text)      … 1文字ずつ表示（タイプライター）→ クリックで次へ
//  - choose(list)   … 選択肢ボタンを並べ、選ばれた番号を返す
//  - クリック / Enter / Space で文字送り、表示途中なら全文表示
// =============================================================
import { Audio } from '@/core/AudioManager';
import { settings } from '@/core/Settings';
import { t } from '@/i18n';
import { button, clear, h } from '../dom';

export interface ChoiceOption {
  label: string;
  sub?: string;
  disabled?: boolean;
  cls?: string;
}

export class MessageBox {
  private box: HTMLElement;
  private nameEl: HTMLElement;
  private textEl: HTMLElement;
  private choicesEl: HTMLElement;
  private cursor: HTMLElement;
  private skipRequested = false;
  private advanceResolver: (() => void) | null = null;

  constructor(layer: HTMLElement) {
    this.nameEl = h('div.msg-name');
    this.textEl = h('div.msg-text');
    this.cursor = h('div.msg-cursor', {}, '▼');
    this.choicesEl = h('div.msg-choices');
    this.box = h('div.msg-box', {}, [this.nameEl, this.textEl, this.cursor]);
    layer.append(this.choicesEl, this.box);
    this.box.addEventListener('click', () => this.advance());
    window.addEventListener('keydown', (e) => {
      if ((e.key === 'Enter' || e.key === ' ') && this.isVisible()) {
        e.preventDefault();
        this.advance();
      }
    });
  }

  private isVisible(): boolean {
    return this.box.classList.contains('visible');
  }

  private advance(): void {
    if (this.advanceResolver) {
      const r = this.advanceResolver;
      this.advanceResolver = null;
      r();
    } else this.skipRequested = true;
  }

  show(): void {
    this.box.classList.add('visible');
  }

  hide(): void {
    this.box.classList.remove('visible');
    clear(this.choicesEl);
    this.choicesEl.classList.remove('visible');
  }

  /**
   * 文章を表示する。
   * @param wait true の場合、表示後にクリックされるまで待つ
   */
  async say(text: string, opts: { name?: string; wait?: boolean } = {}): Promise<void> {
    this.show();
    clear(this.choicesEl);
    this.choicesEl.classList.remove('visible');
    this.nameEl.textContent = opts.name ?? '';
    this.nameEl.classList.toggle('visible', !!opts.name);
    this.textEl.textContent = '';
    this.cursor.classList.remove('visible');
    this.skipRequested = false;
    const speed = settings.current.textSpeed;
    let count = 0;
    for (const ch of text) {
      if (this.skipRequested) {
        this.textEl.textContent = text;
        break;
      }
      this.textEl.textContent += ch;
      if (ch.trim() && count++ % 2 === 0) Audio.play('se_text', { vary: true });
      await new Promise((r) => setTimeout(r, ch === '。' || ch === '…' || ch === '\n' ? speed * 4 : speed));
    }
    this.skipRequested = false;
    if (opts.wait !== false) {
      this.cursor.classList.add('visible');
      await new Promise<void>((r) => (this.advanceResolver = r));
      this.cursor.classList.remove('visible');
    }
  }

  /** 複数ページを順に表示 */
  async sayAll(pages: string[], opts: { name?: string } = {}): Promise<void> {
    for (const p of pages) await this.say(p, opts);
  }

  /**
   * 選択肢を表示し、選ばれた番号を返す。
   * @param prompt 選択肢の上に表示する文章（省略時は現在の文章のまま）
   */
  async choose(options: ChoiceOption[], prompt?: string): Promise<number> {
    if (prompt !== undefined) await this.say(prompt, { wait: false });
    this.show();
    clear(this.choicesEl);
    return new Promise<number>((resolve) => {
      options.forEach((o, i) => {
        const b = button(o.label, () => {
          this.choicesEl.classList.remove('visible');
          resolve(i);
        }, { cls: `choice ${o.cls ?? ''}`.trim(), disabled: o.disabled, sub: o.sub });
        b.style.animationDelay = `${i * 70}ms`;
        this.choicesEl.append(b);
      });
      this.choicesEl.classList.add('visible');
    });
  }

  /** 「クリックで進む」だけを表示 */
  hint(): string {
    return t('common.clickToContinue');
  }
}
