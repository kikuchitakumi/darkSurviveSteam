// =============================================================
// content.ts  【サービス：カード・敵・イベントの登録と読み込み】
// -------------------------------------------------------------
// ゲームのコンテンツ（カード・敵・イベント）は3段重ねで決まる：
//
//   1. 同梱データ   … src/data/cards.ts など（プログラムに書いてあるもの）
//   2. Firebase     … 開発メニューから登録したもの（公開ページを開いた全員に反映）
//   3. ローカル     … Firebase 未設定の時に、このPCのブラウザに保存したもの
//
// 起動時に loadAll() で 2 → 3 の順に上書き・追加する。
// 開発メニュー（src/editor/）は、このファイルの save / remove / uploadImage を使う。
//
// 画像の保存先：
//   - Firebase … Storage の content/<種類>/<id>/... に保存し、https の URL を記録
//   - ローカル … ブラウザの IndexedDB に保存し、'idb:...' という名前を記録
// =============================================================
import { CARDS, removeCards, upsertCards } from '@/data/cards';
import { ENEMIES, removeEnemies, upsertEnemies } from '@/data/enemies';
import { EVENTS, removeEvents, upsertEvents } from '@/data/events';
import { isFirebaseConfigured } from '@/config/firebase';
import type { CardDef, EnemyDef, EventDef } from '@/model/types';
import { localImageUrls } from '@/view/dom';
import { getFirebase } from './firebase';

export type ContentKind = 'cards' | 'enemies' | 'events';
export type ContentDef = CardDef | EnemyDef | EventDef;
export type ContentSource = 'bundled' | 'remote' | 'local';
export const CONTENT_KINDS: ContentKind[] = ['cards', 'enemies', 'events'];

/** 保存される1件分（Firestore のドキュメント／ローカル保存の中身） */
interface StoredDoc {
  id: string;
  def?: ContentDef;
  /** true = 同梱データを「削除した」印 */
  deleted?: boolean;
  updatedAt: number;
  updatedBy?: string;
}

/** 同梱データの控え（上書きを取り消して元に戻す時に使う） */
const BUNDLED: Record<ContentKind, Map<string, ContentDef>> = {
  cards: new Map(CARDS.map((c) => [c.id, structuredClone(c)])),
  enemies: new Map(ENEMIES.map((e) => [e.id, structuredClone(e)])),
  events: new Map(EVENTS.map((e) => [e.id, structuredClone(e)])),
};

/** 各コンテンツがどこから来たか */
const sources: Record<ContentKind, Map<string, ContentSource>> = { cards: new Map(), enemies: new Map(), events: new Map() };
const LOCAL_KEY = 'darksurvive.content.v1';

// =============================================================
// ゲームのデータ（src/data）への反映
// =============================================================
function registryOf(kind: ContentKind): ContentDef[] {
  return kind === 'cards' ? CARDS : kind === 'enemies' ? ENEMIES : EVENTS;
}

function applyDoc(kind: ContentKind, doc: StoredDoc, source: ContentSource): void {
  if (doc.deleted) {
    if (kind === 'cards') removeCards([doc.id]);
    if (kind === 'enemies') removeEnemies([doc.id]);
    if (kind === 'events') removeEvents([doc.id]);
    sources[kind].set(doc.id, source);
    return;
  }
  if (!doc.def) return;
  const errors = validate(kind, doc.def);
  if (errors.length) {
    console.warn(`[content] ${kind}/${doc.id} を読み込めませんでした:`, errors);
    return;
  }
  if (kind === 'cards') upsertCards([doc.def as CardDef]);
  if (kind === 'enemies') upsertEnemies([doc.def as EnemyDef]);
  if (kind === 'events') upsertEvents([doc.def as EventDef]);
  sources[kind].set(doc.id, source);
}

/** 上書きを取り消し、同梱データの状態に戻す（同梱に無ければ削除） */
function restoreBundled(kind: ContentKind, id: string): void {
  const b = BUNDLED[kind].get(id);
  sources[kind].delete(id);
  if (b) applyDoc(kind, { id, def: structuredClone(b), updatedAt: 0 }, 'bundled');
  else applyDoc(kind, { id, deleted: true, updatedAt: 0 }, 'bundled');
  sources[kind].delete(id);
}

// =============================================================
// 入力チェック（壊れたデータでゲームが止まらないように）
// =============================================================
export function validate(kind: ContentKind, def: any): string[] {
  const e: string[] = [];
  if (!def || typeof def !== 'object') return ['データが空です'];
  if (!/^[a-z0-9_]+$/.test(def.id ?? '')) e.push('ID は半角の小文字英数字と _ だけで入力してください');
  if (kind === 'cards') {
    if (!def.name) e.push('カード名が空です');
    if (!(def.cost === 'X' || (Number.isFinite(def.cost) && def.cost >= 0))) e.push('コストは 0 以上の数か X にしてください');
    if (!Array.isArray(def.effects)) e.push('効果がありません');
    if (!['attack', 'defense', 'support', 'buff', 'debuff', 'special'].includes(def.type)) e.push('種類が不正です');
    if (!def.image) e.push('画像がありません');
  }
  if (kind === 'enemies') {
    if (!def.name) e.push('敵の名前が空です');
    if (!(def.hp > 0)) e.push('HP は 1 以上にしてください');
    if (!Array.isArray(def.actions) || def.actions.length === 0) e.push('行動を1つ以上登録してください');
    if (!def.image) e.push('画像がありません');
  }
  if (kind === 'events') {
    if (!def.title) e.push('イベント名が空です');
    if (!Array.isArray(def.text) || def.text.length === 0) e.push('本文が空です');
    if (!Array.isArray(def.choices) || def.choices.length === 0) e.push('選択肢を1つ以上登録してください');
    if (!def.background) e.push('背景画像がありません');
  }
  return e;
}

// =============================================================
// ローカル保存（localStorage ＋ 画像は IndexedDB）
// =============================================================
type LocalStore = Record<ContentKind, Record<string, StoredDoc>>;

function readLocal(): LocalStore {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    const v = raw ? JSON.parse(raw) : {};
    return { cards: v.cards ?? {}, enemies: v.enemies ?? {}, events: v.events ?? {} };
  } catch {
    return { cards: {}, enemies: {}, events: {} };
  }
}
function writeLocal(s: LocalStore): void {
  localStorage.setItem(LOCAL_KEY, JSON.stringify(s));
}

function idb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('darksurvive-content', 1);
    req.onupgradeneeded = () => req.result.createObjectStore('images');
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function idbPut(key: string, blob: Blob): Promise<void> {
  const db = await idb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction('images', 'readwrite');
    tx.objectStore('images').put(blob, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
async function idbGet(key: string): Promise<Blob | undefined> {
  const db = await idb();
  return new Promise((resolve, reject) => {
    const req = db.transaction('images').objectStore('images').get(key);
    req.onsuccess = () => resolve(req.result as Blob | undefined);
    req.onerror = () => reject(req.error);
  });
}
async function idbAllKeys(): Promise<string[]> {
  const db = await idb();
  return new Promise((resolve, reject) => {
    const req = db.transaction('images').objectStore('images').getAllKeys();
    req.onsuccess = () => resolve(req.result as string[]);
    req.onerror = () => reject(req.error);
  });
}

/** IndexedDB の画像を全て表示用 URL にする */
async function loadLocalImages(): Promise<void> {
  try {
    for (const key of await idbAllKeys()) {
      if (localImageUrls.has(key)) continue;
      const blob = await idbGet(key);
      if (blob) localImageUrls.set(key, URL.createObjectURL(blob));
    }
  } catch (e) {
    console.warn('[content] ローカル画像を読み込めませんでした', e);
  }
}

// =============================================================
// Firebase（Firestore / Storage）
// =============================================================
async function fetchRemote(): Promise<Record<ContentKind, StoredDoc[]> | null> {
  const f = getFirebase();
  if (!f) return null;
  const { db, fs } = await f;
  const out = { cards: [], enemies: [], events: [] } as Record<ContentKind, StoredDoc[]>;
  for (const kind of CONTENT_KINDS) {
    const snap = await fs.getDocs(fs.collection(db, kind));
    snap.forEach((d) => {
      const v = d.data() as any;
      out[kind].push({ id: d.id, def: v.def, deleted: !!v.deleted, updatedAt: v.updatedAt?.toMillis?.() ?? 0, updatedBy: v.updatedBy });
    });
  }
  return out;
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([p, new Promise<T>((_, reject) => setTimeout(() => reject(new Error('timeout')), ms))]);
}

// =============================================================
// 公開API
// =============================================================
export type ContentMode = 'local' | 'remote';

export const Content = {
  /** 最後に読み込んだ結果（開発メニューの表示用） */
  lastLoad: { remote: 0, local: 0, error: '' as string },

  /** いまの保存先：local（Firebase 未設定）/ remote（Firebase。ログイン不要） */
  async mode(): Promise<ContentMode> {
    return isFirebaseConfigured() ? 'remote' : 'local';
  },

  /** 起動時：Firebase → ローカル の順に読み込んでゲームに反映 */
  async loadAll(timeoutMs = 6000): Promise<void> {
    await loadLocalImages();
    this.lastLoad = { remote: 0, local: 0, error: '' };
    try {
      const remote = await withTimeout(fetchRemote(), timeoutMs);
      if (remote) {
        for (const kind of CONTENT_KINDS) for (const d of remote[kind]) applyDoc(kind, d, 'remote');
        this.lastLoad.remote = CONTENT_KINDS.reduce((s, k) => s + remote[k].length, 0);
      }
    } catch (e) {
      // ネットに繋がらなくてもゲームは同梱データで遊べる
      this.lastLoad.error = String(e);
      console.warn('[content] Firebase から読み込めませんでした（同梱データで続行）', e);
    }
    const local = readLocal();
    for (const kind of CONTENT_KINDS) for (const d of Object.values(local[kind])) applyDoc(kind, d, 'local');
    this.lastLoad.local = CONTENT_KINDS.reduce((s, k) => s + Object.keys(local[k]).length, 0);
  },

  /** 一覧（ゲームで使われている現在の内容） */
  list(kind: ContentKind): { def: ContentDef; source: ContentSource; bundled: boolean }[] {
    return registryOf(kind).map((def) => ({ def, source: sources[kind].get(def.id) ?? 'bundled', bundled: BUNDLED[kind].has(def.id) }));
  },

  /** 同梱データにある id か */
  isBundled(kind: ContentKind, id: string): boolean {
    return BUNDLED[kind].has(id);
  },

  /** 登録・更新 */
  async save(kind: ContentKind, def: ContentDef): Promise<ContentSource> {
    const errors = validate(kind, def);
    if (errors.length) throw new Error(errors.join('\n'));
    const mode = await this.mode();
    const doc: StoredDoc = { id: def.id, def: structuredClone(def), updatedAt: Date.now() };
    if (mode === 'remote') {
      const { db, fs } = await getFirebase()!;
      await fs.setDoc(fs.doc(db, kind, def.id), { def: doc.def, deleted: false, updatedAt: fs.serverTimestamp() });
      // 同じ id のローカル保存は不要になるので消す
      const local = readLocal();
      delete local[kind][def.id];
      writeLocal(local);
      applyDoc(kind, doc, 'remote');
      return 'remote';
    }
    const local = readLocal();
    local[kind][def.id] = doc;
    writeLocal(local);
    applyDoc(kind, doc, 'local');
    return 'local';
  },

  /**
   * 削除。同梱データは「削除した印」を保存し、
   * 開発メニューで追加したものは保存データごと消す。
   */
  async remove(kind: ContentKind, id: string): Promise<void> {
    const bundled = BUNDLED[kind].has(id);
    const mode = await this.mode();
    const local = readLocal();
    delete local[kind][id];
    if (mode === 'remote') {
      const { db, fs } = await getFirebase()!;
      if (bundled) await fs.setDoc(fs.doc(db, kind, id), { deleted: true, updatedAt: fs.serverTimestamp() });
      else await fs.deleteDoc(fs.doc(db, kind, id));
    } else if (bundled) {
      local[kind][id] = { id, deleted: true, updatedAt: Date.now() };
    }
    writeLocal(local);
    applyDoc(kind, { id, deleted: true, updatedAt: Date.now() }, mode === 'remote' ? 'remote' : 'local');
  },

  /** 変更を取り消して同梱データに戻す（同梱にある id のみ） */
  async revert(kind: ContentKind, id: string): Promise<void> {
    const mode = await this.mode();
    const local = readLocal();
    delete local[kind][id];
    writeLocal(local);
    if (mode === 'remote') {
      const { db, fs } = await getFirebase()!;
      await fs.deleteDoc(fs.doc(db, kind, id));
    }
    restoreBundled(kind, id);
  },

  /**
   * 画像を保存し、データに書くパス（https の URL または idb:～）を返す
   * @param slot 'image' | 'background' | 'object' など、同じデータ内での画像の種類
   */
  async uploadImage(kind: ContentKind, id: string, slot: string, blob: Blob): Promise<string> {
    const name = `${slot}_${Date.now()}.webp`;
    if ((await this.mode()) === 'remote') {
      const { storage, st } = await getFirebase()!;
      const r = st.ref(storage, `content/${kind}/${id}/${name}`);
      await st.uploadBytes(r, blob, { contentType: blob.type || 'image/webp' });
      return st.getDownloadURL(r);
    }
    const key = `idb:${kind}/${id}/${name}`;
    await idbPut(key, blob);
    localImageUrls.set(key, URL.createObjectURL(blob));
    return key;
  },

  /** ローカルに保存したものを Firebase にまとめてアップロード（画像も含む） */
  async pushLocalToRemote(): Promise<number> {
    if ((await this.mode()) !== 'remote') throw new Error('Firebase が設定されていません');
    const local = readLocal();
    let n = 0;
    for (const kind of CONTENT_KINDS) {
      for (const d of Object.values(local[kind])) {
        if (d.deleted) {
          await this.remove(kind, d.id);
          n++;
          continue;
        }
        const def = structuredClone(d.def!) as any;
        for (const field of ['image', 'background', 'object']) {
          if (typeof def[field] === 'string' && def[field].startsWith('idb:')) {
            const blob = await idbGet(def[field]);
            if (blob) def[field] = await this.uploadImage(kind, d.id, field, blob);
          }
        }
        await this.save(kind, def);
        n++;
      }
    }
    return n;
  },

  /** 現在のゲーム内容を JSON にする（バックアップ・Claude にコード化を頼む時に使う） */
  exportJson(): string {
    const out: Record<string, unknown> = { exportedAt: new Date().toISOString() };
    for (const kind of CONTENT_KINDS) out[kind] = this.list(kind).map((x) => ({ source: x.source, ...x.def }));
    return JSON.stringify(out, null, 2);
  },
};
