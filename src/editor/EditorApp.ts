// =============================================================
// EditorApp.ts  【開発メニュー：画面全体】
// -------------------------------------------------------------
// タイトル画面の「開発メニュー」から開く。カード・敵キャラ・イベントを
// 一覧から選んで編集したり、新しく登録したりできる。
//
//   ┌ 開発メニュー  [保存先: ローカル / Firebase]  [JSON書き出し] [閉じる]
//   │ [カード] [敵キャラ] [イベント]
//   │ ┌ 一覧 ──┐ ┌ 入力フォーム ───────┐ ┌ プレビュー ┐
//   │ │ 検索    │ │                       │ │            │
//   │ │ ＋新規  │ │                       │ │            │
//   │ └────┘ └───────────┘ └──────┘
//
// 保存すると、すぐにゲームに反映される（次の戦闘・報酬から出てくる）。
// 保存先は services/content.ts が決める（Firebase が設定されていれば Firebase、無ければこのPC）。
// ログインは不要。
// =============================================================
import { Content, type ContentDef, type ContentKind, type ContentMode } from '@/services/content';
import { isFirebaseConfigured } from '@/config/firebase';
import { asset, clear, h } from '@/view/dom';
import { ui } from '@/view/ui';
import { confirmDialog } from '@/view/components/Modal';
import { FORMS, type ContentFormSpec } from './contentForms';
import { smallBtn, type FormCtx } from './forms';
import { prepareImage, type ImageUse } from './imageTools';

const MODE_LABEL: Record<ContentMode, string> = {
  local: '保存先：このPC（Firebase 未設定）',
  remote: '保存先：Firebase（みんなに反映）',
};
const SOURCE_LABEL = { bundled: '同梱', remote: 'Firebase', local: 'このPC' } as const;

export function openEditor(): Promise<void> {
  return new Promise((resolve) => {
    const root = h('div.editor-root');
    ui.stage.modal.append(root);

    let kind: ContentKind = 'cards';
    let selectedId: string | null = null;
    let draft: any = null;
    let isNew = false;
    /** 選んだがまだ保存していない画像（slot → Blob） */
    let pending: Record<string, Blob> = {};
    let search = '';

    const header = h('div.editor-header');
    const tabs = h('div.editor-tabs');
    const listEl = h('div.editor-list');
    const formEl = h('div.editor-form');
    const previewEl = h('div.editor-preview');
    const statusEl = h('div.editor-status');
    root.append(header, tabs, h('div.editor-body', {}, [listEl, formEl, previewEl]), statusEl);

    const spec = (): ContentFormSpec => FORMS[kind];
    const setStatus = (msg: string, kindCls: 'ok' | 'err' | 'info' = 'info') => {
      statusEl.textContent = msg;
      statusEl.className = `editor-status ${kindCls}`;
    };

    // ---------------- ヘッダー ----------------
    const renderHeader = async () => {
      clear(header);
      const mode = await Content.mode();
      header.append(
        h('div.editor-title', {}, '開発メニュー'),
        h(`div.editor-mode.mode-${mode}`, {}, MODE_LABEL[mode]),
        h('div.editor-header-btns', {}, [
          mode === 'remote' && Content.lastLoad.local > 0 ? smallBtn('このPCの登録を Firebase へ送る', async () => {
            try {
              const n = await Content.pushLocalToRemote();
              setStatus(`${n} 件を Firebase に送りました`, 'ok');
              renderList();
            } catch (e) {
              setStatus(String(e), 'err');
            }
          }) : null,
          smallBtn('JSON 書き出し', () => {
            const blob = new Blob([Content.exportJson()], { type: 'application/json' });
            const a = h<'a'>('a', { href: URL.createObjectURL(blob), download: `darksurvive-content-${new Date().toISOString().slice(0, 10)}.json` });
            a.click();
            setStatus('JSON を書き出しました（バックアップや、Claude にデータのコード化を頼む時に使えます）', 'ok');
          }),
          smallBtn('閉じる', close, 'primary'),
        ]),
      );
    };

    // ---------------- タブ ----------------
    const renderTabs = () => {
      clear(tabs);
      for (const k of ['cards', 'enemies', 'events'] as ContentKind[]) {
        tabs.append(smallBtn(FORMS[k].label, () => {
          kind = k;
          selectedId = null;
          draft = null;
          renderTabs();
          renderList();
          renderForm();
        }, kind === k ? 'tab active' : 'tab'));
      }
    };

    // ---------------- 一覧 ----------------
    const renderList = () => {
      clear(listEl);
      const input = h<'input'>('input.ed-input.editor-search', { type: 'search', placeholder: '名前・IDで検索', value: search });
      input.addEventListener('input', () => {
        search = input.value;
        drawItems();
      });
      const items = h('div.editor-items');
      listEl.append(h('div.editor-list-top', {}, [input, smallBtn(`＋ 新しい${spec().label}`, () => {
        draft = spec().newDraft();
        isNew = true;
        selectedId = null;
        pending = {};
        renderForm();
        drawItems();
      }, 'add')]), items);
      const drawItems = () => {
        clear(items);
        const q = search.trim().toLowerCase();
        for (const { def, source } of Content.list(kind)) {
          const anyDef = def as any;
          const name: string = anyDef.name ?? anyDef.title ?? def.id;
          if (q && !name.toLowerCase().includes(q) && !def.id.includes(q)) continue;
          const thumb = spec().thumb(def);
          const item = h(`div.editor-item${def.id === selectedId ? '.active' : ''}`, {}, [
            h('div.editor-item-thumb', {}, thumb ? h('img', { src: asset(thumb), alt: '' }) : null),
            h('div.editor-item-text', {}, [h('div.editor-item-name', {}, name), h('div.editor-item-sub', {}, spec().subtitle(def))]),
            h(`span.editor-badge.src-${source}`, {}, SOURCE_LABEL[source]),
          ]);
          item.addEventListener('click', () => select(def));
          items.append(item);
        }
      };
      drawItems();
    };

    const select = (def: ContentDef) => {
      selectedId = def.id;
      draft = structuredClone(def);
      isNew = false;
      pending = {};
      renderList();
      renderForm();
    };

    // ---------------- フォーム ----------------
    const ctx: FormCtx = {
      changed: () => renderPreview(),
      rerender: () => renderForm(),
    };

    const pickImage = async (slot: string, use: ImageUse, file: File) => {
      try {
        setStatus('画像を変換しています…');
        const blob = await prepareImage(file, use);
        pending[slot] = blob;
        draft[slot] = URL.createObjectURL(blob);
        setStatus(`画像を読み込みました（${Math.round(blob.size / 1024)}KB）。「保存」で登録されます`, 'ok');
        renderForm();
      } catch (e) {
        setStatus(String(e), 'err');
      }
    };

    const renderForm = () => {
      clear(formEl);
      if (!draft) {
        formEl.append(h('div.editor-empty', {}, `左の一覧から${spec().label}を選ぶか、「＋ 新しい${spec().label}」を押してください。`));
        renderPreview();
        return;
      }
      const scroll = formEl.scrollTop;
      const jsonBox = h<'textarea'>('textarea.ed-input.ed-json', { rows: 14 });
      const jsonWrap = h('div.ed-json-wrap', { style: 'display:none' }, [
        jsonBox,
        smallBtn('JSON を反映', () => {
          try {
            draft = JSON.parse(jsonBox.value);
            renderForm();
            setStatus('JSON を反映しました', 'ok');
          } catch (e) {
            setStatus(`JSON の形式が正しくありません：${e}`, 'err');
          }
        }),
      ]);
      const footer = h('div.editor-form-footer', {}, [
        smallBtn(isNew ? '登録する' : '保存する', save, 'primary'),
        !isNew ? smallBtn('削除', remove, 'danger') : null,
        !isNew && Content.isBundled(kind, draft.id) ? smallBtn('同梱データに戻す', revert) : null,
        smallBtn('JSON で編集', () => {
          jsonBox.value = JSON.stringify(draft, null, 2);
          jsonWrap.style.display = jsonWrap.style.display === 'none' ? '' : 'none';
        }),
      ]);
      formEl.append(spec().build(ctx, draft, pickImage, isNew), jsonWrap, footer);
      formEl.scrollTop = scroll;
      renderPreview();
    };

    const renderPreview = () => {
      clear(previewEl);
      previewEl.append(h('div.editor-preview-title', {}, 'プレビュー'));
      if (!draft) return;
      try {
        previewEl.append(spec().preview(draft));
      } catch (e) {
        previewEl.append(h('div.ed-help.warn', {}, `プレビューを表示できません：${e}`));
      }
    };

    // ---------------- 保存・削除 ----------------
    const save = async () => {
      try {
        if (isNew && Content.list(kind).some((x) => x.def.id === draft.id)) throw new Error(`ID「${draft.id}」は既に使われています`);
        setStatus('保存しています…');
        const def = structuredClone(draft);
        // 選んだ画像をアップロードして、パスを置き換える
        for (const [slot, blob] of Object.entries(pending)) def[slot] = await Content.uploadImage(kind, def.id, slot, blob);
        const where = await Content.save(kind, def);
        pending = {};
        draft = structuredClone(def);
        selectedId = def.id;
        isNew = false;
        setStatus(`保存しました（${where === 'remote' ? 'Firebase' : 'このPC'}）。ゲームにすぐ反映されます`, 'ok');
        renderList();
        renderForm();
      } catch (e) {
        setStatus(`保存できませんでした：\n${e instanceof Error ? e.message : e}`, 'err');
      }
    };

    const remove = async () => {
      if (!(await confirmDialog(`「${draft.name ?? draft.title ?? draft.id}」を削除しますか？`))) return;
      try {
        await Content.remove(kind, draft.id);
        setStatus('削除しました', 'ok');
        draft = null;
        selectedId = null;
        renderList();
        renderForm();
      } catch (e) {
        setStatus(`削除できませんでした：${e}`, 'err');
      }
    };

    const revert = async () => {
      if (!(await confirmDialog('変更を取り消して、同梱データ（プログラムに書いてある内容）に戻しますか？'))) return;
      await Content.revert(kind, draft.id);
      const back = Content.list(kind).find((x) => x.def.id === draft.id);
      setStatus('同梱データに戻しました', 'ok');
      if (back) select(back.def);
      else {
        draft = null;
        renderList();
        renderForm();
      }
    };

    function close() {
      root.remove();
      resolve();
    }

    renderHeader();
    renderTabs();
    renderList();
    renderForm();
    setStatus(isFirebaseConfigured() ? 'Firebase に保存します。保存した内容は、公開ページを開いた全員のゲームに反映されます。' : 'Firebase が未設定のため、このPCのブラウザに保存します（docs/FIREBASE.md を参照）。');
  });
}
