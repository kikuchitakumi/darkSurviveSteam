// =============================================================
// DeckViewer.ts  【View パネル：デッキ一覧／カード選択】
// -------------------------------------------------------------
//  - showDeck()   … 所持カードを一覧表示
//  - pickCard()   … カードを1枚選ばせる（ショップのカード削除など）
//  - showPile()   … 戦闘中の山札・捨て札・廃棄の一覧
// =============================================================
import { getCard } from '@/data/cards';
import { t } from '@/i18n';
import type { DeckCard } from '@/model/GameState';
import { h } from '../dom';
import { createCardEl } from '../components/CardView';
import { openModal, type ModalHandle } from '../components/Modal';
import { CardLayer } from '../three/CardLayer';

/** 一覧のカードを 3D で描く（モーダルの本文の範囲だけ。閉じると自動で片付く） */
function attach3D(m: ModalHandle, grid: HTMLElement): void {
  const wrap = m.el.parentElement;
  if (wrap) CardLayer.attach({ host: grid, parent: wrap, clip: m.body });
}

/** 種類 → コスト → 名前 の順に並べる */
function sortDeck(cards: DeckCard[]): DeckCard[] {
  const order = ['attack', 'defense', 'support', 'buff', 'debuff', 'special'];
  const cost = (c: number | 'X') => (c === 'X' ? 99 : c);
  return cards.slice().sort((a, b) => {
    const da = getCard(a.cardId);
    const db = getCard(b.cardId);
    return order.indexOf(da.type) - order.indexOf(db.type) || cost(da.cost) - cost(db.cost) || da.id.localeCompare(db.id);
  });
}

/** カードの説明文に入れる数値（現在のステータス込み）。設定しておくと一覧表示に反映される */
let numbersProvider: ((cardId: string) => Record<string, number>) | null = null;
export function setDeckNumbersProvider(fn: ((cardId: string) => Record<string, number>) | null): void {
  numbersProvider = fn;
}

export function showDeck(cards: DeckCard[], title = t('deck.title', { n: cards.length })): void {
  const grid = h('div.card-grid', {}, sortDeck(cards).map((c) => createCardEl(getCard(c.cardId), { uid: c.uid, numbers: numbersProvider?.(c.cardId) })));
  attach3D(openModal(title, grid, { cls: 'modal-wide' }), grid);
}

/** 山札の中身は順番が分からないよう並べ替えて表示する */
export function showPile(cards: DeckCard[], title: string): void {
  showDeck(cards, `${title}（${cards.length}）`);
}

/** カードを1枚選ばせる。キャンセル時は null */
export function pickCard(cards: DeckCard[], title: string): Promise<DeckCard | null> {
  return new Promise((resolve) => {
    let picked: DeckCard | null = null;
    const grid = h('div.card-grid.pickable', {}, sortDeck(cards).map((c) => {
      const el = createCardEl(getCard(c.cardId), { uid: c.uid, numbers: numbersProvider?.(c.cardId) });
      el.addEventListener('click', () => {
        picked = c;
        m.close();
      });
      return el;
    }));
    const m = openModal(title, grid, { cls: 'modal-wide', onClose: () => resolve(picked) });
    attach3D(m, grid);
  });
}
