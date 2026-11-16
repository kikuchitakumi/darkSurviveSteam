// =============================================================
// events.ts  【データ：ランダムイベント】
// -------------------------------------------------------------
// ★イベントを追加したい時はこのファイルに1件追加するだけでよい。
//
//  - text      : 本文。配列の1要素がメッセージウィンドウの1ページ。
//  - background: 背景画像 / object: 背景の上に置く透過画像
//  - choices   : 選択肢。success.outcomes に結果を並べる。
//      outcomes の種類は model/types.ts の EventOutcome を参照
//      （gold / heal / damage / exp / card / randomCard / item / key /
//        equipment / stat / battle / nothing）
//  - luckCheck : 運判定付きの選択肢。成功率 = base + 運×perLuck（上限 max）
//                失敗時は failure の結果になる。
//  - enabled   : false にすると出現しない（作りかけ・テスト用）
//
// 仕様書の指示により、現在有効なイベントは「20Gもらう / HP20回復」の
// 2択イベントのみ。下にある enabled:false のイベントは今後の追加用テンプレート。
// =============================================================
import type { EventDef } from '@/model/types';

export const EVENTS: EventDef[] = [
  {
    id: 'whispering_altar',
    title: '囁く祭壇',
    text: [
      '薄暗い通路の奥に、小さな祭壇がある。',
      '燭台の火が揺れ、どこからか囁き声が聞こえる……。',
      '「……ひとつだけ……与えよう……」',
    ],
    background: 'images/bg/bg_event.webp',
    object: 'images/objects/obj_altar.png',
    weight: 10,
    enabled: true,
    choices: [
      {
        label: '金貨を受け取る（20G）',
        success: { text: '祭壇の上に金貨が現れた。20G を手に入れた。', outcomes: [{ kind: 'gold', amount: 20 }] },
      },
      {
        label: '傷を癒やしてもらう（HP 20回復）',
        success: { text: '温かな光に包まれ、傷が癒えていく……。HP が 20 回復した。', outcomes: [{ kind: 'heal', amount: 20 }] },
      },
    ],
  },

  // ---------------------------------------------------------
  // ▼ 以下は今後追加するイベントのテンプレート（enabled: false）
  //   有効にしたい場合は enabled を true にするだけで出現するようになる。
  // ---------------------------------------------------------
  {
    id: 'bloody_box',
    title: '血塗れの木箱',
    text: ['床に血塗れの木箱が転がっている。', '中から何かが動く音がする……。'],
    background: 'images/bg/bg_event.webp',
    object: 'images/objects/obj_bloody_box.png',
    weight: 8,
    enabled: false,
    choices: [
      {
        label: '箱を開ける（運判定）',
        luckCheck: { base: 0.4, perLuck: 0.01, max: 0.9 },
        success: { text: '中には古い薬が入っていた！', outcomes: [{ kind: 'item', itemId: 'potion' }] },
        failure: { text: '中から腐肉ネズミが飛び出した！', outcomes: [{ kind: 'battle' }] },
      },
      {
        label: '立ち去る',
        success: { text: 'あなたは足早にその場を離れた。', outcomes: [{ kind: 'nothing' }] },
      },
    ],
  },
  {
    id: 'dying_soldier',
    title: '瀕死の兵士',
    text: ['壁にもたれかかった兵士が、かすれた声で何かを訴えている。', '「頼む……これを……持って行ってくれ……」'],
    background: 'images/bg/bg_event.webp',
    object: 'images/objects/obj_dying_soldier.png',
    weight: 6,
    enabled: false,
    choices: [
      {
        label: '受け取る',
        success: { text: '兵士は安らかな顔で息を引き取った。鍵を受け取った。', outcomes: [{ kind: 'key', color: 'random' }] },
      },
      {
        label: '止めを刺す（経験値）',
        success: { text: '……あなたは何かを失った気がする。', outcomes: [{ kind: 'exp', amount: 30 }, { kind: 'stat', stat: 'luk', amount: -1 }] },
      },
    ],
  },
];

/** イベントを追加・上書きする（開発メニュー / Firebase から） */
export function upsertEvents(defs: EventDef[]): void {
  for (const d of defs) {
    const i = EVENTS.findIndex((e) => e.id === d.id);
    if (i >= 0) EVENTS[i] = d;
    else EVENTS.push(d);
  }
}

/** イベントを取り除く */
export function removeEvents(ids: string[]): void {
  for (const id of ids) {
    const i = EVENTS.findIndex((e) => e.id === id);
    if (i >= 0) EVENTS.splice(i, 1);
  }
}

export function getEvent(id: string): EventDef {
  const e = EVENTS.find((x) => x.id === id);
  if (!e) throw new Error(`Unknown event id: ${id}`);
  return e;
}
