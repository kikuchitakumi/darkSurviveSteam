// =============================================================
// forms.ts  【開発メニュー：入力フォームの部品】
// -------------------------------------------------------------
// 文字・数値・選択・チェック・複数選択・画像・リスト などの入力欄を作る。
// どの部品も「オブジェクト obj の key を直接書き換える」作りなので、
// フォームを作る側は draft（編集中のデータ）を渡すだけでよい。
//
//   ctx.changed()  … 値が変わった（プレビューだけ更新）
//   ctx.rerender() … 項目の数が変わった（フォームを作り直す）
// =============================================================
import { h, img } from '@/view/dom';

export interface FormCtx {
  changed: () => void;
  rerender: () => void;
}

type Obj = Record<string, any>;

/** ラベル付きの1行 */
export function field(label: string, control: HTMLElement | HTMLElement[], help?: string): HTMLElement {
  return h('label.ed-field', {}, [
    h('span.ed-label', {}, label),
    h('span.ed-control', {}, control),
    help ? h('span.ed-help', {}, help) : null,
  ]);
}

/** 横並び */
export function row(...children: (HTMLElement | null)[]): HTMLElement {
  return h('div.ed-row', {}, children);
}

/** 見出し付きのまとまり */
export function section(title: string, children: (HTMLElement | null)[], extra?: HTMLElement): HTMLElement {
  return h('div.ed-section', {}, [h('div.ed-section-title', {}, [h('span', {}, title), extra ?? null]), ...children]);
}

export function text(ctx: FormCtx, obj: Obj, key: string, opts: { placeholder?: string; readonly?: boolean; onInput?: (v: string) => void } = {}): HTMLInputElement {
  const el = h<'input'>('input.ed-input', { type: 'text', value: obj[key] ?? '', placeholder: opts.placeholder ?? '', readOnly: !!opts.readonly });
  el.addEventListener('input', () => {
    obj[key] = el.value;
    opts.onInput?.(el.value);
    ctx.changed();
  });
  return el;
}

/** 数値（空欄にすると項目ごと消える＝既定値を使う） */
export function num(ctx: FormCtx, obj: Obj, key: string, opts: { min?: number; max?: number; step?: number; placeholder?: string; required?: boolean } = {}): HTMLInputElement {
  const el = h<'input'>('input.ed-input.ed-num', { type: 'number', value: obj[key] ?? '', placeholder: opts.placeholder ?? '', step: String(opts.step ?? 1) });
  if (opts.min !== undefined) el.min = String(opts.min);
  if (opts.max !== undefined) el.max = String(opts.max);
  el.addEventListener('input', () => {
    if (el.value === '' && !opts.required) delete obj[key];
    else obj[key] = Number(el.value);
    ctx.changed();
  });
  return el;
}

export function select<T extends string | number>(ctx: FormCtx, obj: Obj, key: string, options: [T, string][], opts: { empty?: string; rerender?: boolean; onChange?: (v: T | undefined) => void } = {}): HTMLSelectElement {
  const el = h<'select'>('select.ed-input', {}, [
    opts.empty !== undefined ? h<'option'>('option', { value: '' }, opts.empty) : null,
    ...options.map(([v, label]) => h<'option'>('option', { value: String(v) }, label)),
  ]);
  el.value = obj[key] === undefined ? '' : String(obj[key]);
  el.addEventListener('change', () => {
    if (el.value === '' && opts.empty !== undefined) delete obj[key];
    else {
      const opt = options.find(([v]) => String(v) === el.value);
      obj[key] = opt ? opt[0] : el.value;
    }
    opts.onChange?.(obj[key]);
    if (opts.rerender) ctx.rerender();
    else ctx.changed();
  });
  return el;
}

export function check(ctx: FormCtx, obj: Obj, key: string, label: string, opts: { rerender?: boolean } = {}): HTMLElement {
  const el = h<'input'>('input', { type: 'checkbox', checked: !!obj[key] });
  el.addEventListener('change', () => {
    if (el.checked) obj[key] = true;
    else delete obj[key];
    if (opts.rerender) ctx.rerender();
    else ctx.changed();
  });
  return h('label.ed-check', {}, [el, h('span', {}, label)]);
}

export function textarea(ctx: FormCtx, obj: Obj, key: string, rows = 3, opts: { placeholder?: string } = {}): HTMLTextAreaElement {
  const el = h<'textarea'>('textarea.ed-input.ed-textarea', { rows, placeholder: opts.placeholder ?? '' });
  el.value = obj[key] ?? '';
  el.addEventListener('input', () => {
    obj[key] = el.value;
    ctx.changed();
  });
  return el;
}

/** 複数選択（押すと ON/OFF が切り替わるチップ） */
export function chips<T extends string | number>(ctx: FormCtx, obj: Obj, key: string, options: [T, string][]): HTMLElement {
  const wrap = h('div.ed-chips');
  const draw = () => {
    wrap.innerHTML = '';
    const arr: T[] = obj[key] ?? [];
    for (const [v, label] of options) {
      const on = arr.includes(v);
      const b = h(`button.ed-chip${on ? '.on' : ''}`, { type: 'button' }, label);
      b.addEventListener('click', (e) => {
        e.preventDefault();
        const cur: T[] = obj[key] ?? [];
        obj[key] = on ? cur.filter((x) => x !== v) : [...cur, v];
        draw();
        ctx.changed();
      });
      wrap.append(b);
    }
  };
  draw();
  return wrap;
}

/** 小さなボタン */
export function smallBtn(label: string, onClick: () => void, cls = ''): HTMLButtonElement {
  const b = h<'button'>(`button.ed-btn${cls ? '.' + cls.trim().split(/\s+/).join('.') : ''}`, { type: 'button' }, label);
  b.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    onClick();
  });
  return b;
}

/**
 * 並べ替え・削除・追加ができるリスト
 * @param render 1件分の入力欄を作る
 * @param create 「＋追加」で作る新しい1件
 */
export function listBuilder<T>(ctx: FormCtx, arr: T[], render: (item: T, i: number) => HTMLElement, create: () => T, opts: { addLabel: string; itemTitle?: (item: T, i: number) => string }): HTMLElement {
  const wrap = h('div.ed-list');
  arr.forEach((item, i) => {
    const tools = h('div.ed-list-tools', {}, [
      opts.itemTitle ? h('span.ed-list-title', {}, opts.itemTitle(item, i)) : h('span.ed-list-title', {}, `#${i + 1}`),
      smallBtn('▲', () => { if (i > 0) { [arr[i - 1], arr[i]] = [arr[i], arr[i - 1]]; ctx.rerender(); } }),
      smallBtn('▼', () => { if (i < arr.length - 1) { [arr[i + 1], arr[i]] = [arr[i], arr[i + 1]]; ctx.rerender(); } }),
      smallBtn('削除', () => { arr.splice(i, 1); ctx.rerender(); }, 'danger'),
    ]);
    wrap.append(h('div.ed-list-item', {}, [tools, render(item, i)]));
  });
  wrap.append(smallBtn(`＋ ${opts.addLabel}`, () => { arr.push(create()); ctx.rerender(); }, 'add'));
  return wrap;
}

/**
 * 画像の選択（ボタン or ドラッグ＆ドロップ）。選んだ画像は onPick に渡す。
 * @param currentPath 今の画像のパス（images/～ / https の URL / idb:～）
 */
export function imagePicker(currentPath: string, onPick: (file: File) => void, opts: { width?: number; height?: number; note?: string } = {}): HTMLElement {
  const input = h<'input'>('input', { type: 'file', accept: 'image/*', style: 'display:none' });
  const preview = h('div.ed-image-preview', { style: { width: `${opts.width ?? 160}px`, height: `${opts.height ?? 160}px` } }, currentPath ? img(currentPath) : h('span', {}, '画像なし'));
  const pick = () => input.click();
  input.addEventListener('change', () => {
    const f = input.files?.[0];
    if (f) onPick(f);
  });
  preview.addEventListener('click', pick);
  preview.addEventListener('dragover', (e) => {
    e.preventDefault();
    preview.classList.add('drag');
  });
  preview.addEventListener('dragleave', () => preview.classList.remove('drag'));
  preview.addEventListener('drop', (e) => {
    e.preventDefault();
    preview.classList.remove('drag');
    const f = e.dataTransfer?.files?.[0];
    if (f) onPick(f);
  });
  return h('div.ed-image', {}, [preview, h('div.ed-image-side', {}, [smallBtn('画像を選ぶ', pick), h('div.ed-help', {}, opts.note ?? 'クリック or ドラッグ＆ドロップ'), input])]);
}
