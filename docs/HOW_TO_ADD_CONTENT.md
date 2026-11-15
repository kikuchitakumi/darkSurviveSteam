# コンテンツの追加方法

カード・敵・アイテム・装備・イベントは、**`src/data/` のファイルに1件追加するだけ** で
ゲームに登場します。プログラム本体を触る必要はありません。

追加したら、次のコマンドで仮画像と素材一覧を更新できます。

```bash
npm run gen:images     # 新しく追加した物の仮画像だけ作られる
npm run assets:list    # docs/ASSETS.md（素材一覧）を更新
```

---

## カードを追加する（`src/data/cards.ts`）

```ts
{
  id: 'double_slash',               // 半角英数字。後から変えない
  name: '二連斬り',
  description: '敵に {damage} ダメージを {hits} 回与える。',
  type: 'attack',                   // attack / defense / buff / debuff / special
  rarity: 'common',                 // basic / common / rare / legendary
  cost: 1,                          // 消費AP
  target: 'enemy',                  // enemy / allEnemies / self / none
  effects: [{ kind: 'damage', amount: 2, hits: 2, scale: 'atk' }],
  image: 'images/cards/card_double_slash.png',
  price: 80,
  pools: ['reward', 'shop'],        // starter / reward / shop / dark
},
```

### 使える効果（effects）
| kind | 内容 | 例 |
|---|---|---|
| `damage` | ダメージ（amount + 攻撃力）。`scale:'mag'` で魔力依存、`target:'all'` で全体 | `{ kind:'damage', amount:6, target:'all' }` |
| `block` | ブロック（amount + 防御力） | `{ kind:'block', amount:5 }` |
| `status` | 状態異常を付与 | `{ kind:'status', status:'poison', amount:3, target:'target' }` |
| `stun` | 敵の行動を1ターン封じる | `{ kind:'stun' }` |
| `draw` | カードを引く | `{ kind:'draw', amount:2 }` |
| `exhaustChoice` | 手札から選んで廃棄 | `{ kind:'exhaustChoice', amount:1 }` |
| `gainAp` | AP を得る | `{ kind:'gainAp', amount:1 }` |
| `heal` | 回復（amount + 魔力） | `{ kind:'heal', amount:5, scale:'mag' }` |
| `healPercent` | 最大HPの割合で回復 | `{ kind:'healPercent', percent:30 }` |

状態異常の種類は `src/data/statusEffects.ts`（筋力・奮起・敏捷・衰弱・脆弱・萎縮・毒・封印・封印耐性・再生・棘）。

> 新しい種類の効果（例：「カードを複製する」）が必要になったら、
> `src/model/types.ts` の `Effect` に型を足し、`src/model/Combat.ts` の `applyEffect` に処理を足します。

---

## 敵を追加する（`src/data/enemies.ts`）

```ts
{
  id: 'blood_bat', name: '血吸いコウモリ', description: '群れで襲いかかる。',
  kind: 'normal', zones: [1, 2], hp: 8, pattern: 'random',
  image: 'images/enemies/enemy_blood_bat.png', scale: 0.7,
  actions: [atk('bite', '噛みつき', 3, 1, 3), debuff('screech', '超音波', 'weak', 1)],
},
```
- `hp`・攻撃値は **1F 相当** の値。階が上がると自動で強くなります（`balance.ts`）。
- `zones`: 1=1〜20F / 2=21〜40F / 3=41〜60F / 4=61〜80F / 5=81〜100F
- ボスは `kind:'boss'` と `bossFloor: 10` のように出現階を指定。
- 行動の意図（intent）は `attack / debuff / buff / block / special` の5種類。

---

## イベントを追加する（`src/data/events.ts`）

```ts
{
  id: 'old_well', title: '古井戸', enabled: true, weight: 5,
  text: ['枯れた井戸がある。', '底から何かが光っている……。'],
  background: 'images/bg/bg_event.webp',
  object: 'images/objects/obj_well.png',
  choices: [
    {
      label: '手を伸ばす（運判定）',
      luckCheck: { base: 0.5, perLuck: 0.01, max: 0.9 },
      success: { text: '金貨を拾った！', outcomes: [{ kind: 'gold', amount: 60 }] },
      failure: { text: '何かに噛まれた！', outcomes: [{ kind: 'damage', amount: 8 }] },
    },
    { label: '立ち去る', success: { text: '何も起きなかった。', outcomes: [{ kind: 'nothing' }] } },
  ],
},
```
結果（outcomes）の種類：`gold / heal / damage / exp / card / randomCard / item / key / equipment / stat / battle / nothing`

---

## アイテム・装備を追加する
- 消費アイテム：`src/data/items.ts`（効果はカードと同じ effects）
- 装備：`src/data/equipment.ts`（`stats` でステータス補正、`ap` で最大AP増加）

---

## 画像・音を差し替える
- 一覧は **`docs/ASSETS.md`**（自動生成）を見てください。
- `public/assets/` の **同じファイル名で上書き** すれば、コードの変更は不要です。
- 推奨形式：
  - 背景（1920x1080）… **WebP**（PNG の約1/10の容量で同等の画質）
  - キャラ・アイテムなど透過画像 … **PNG**（または透過WebP）
  - BGM … **OGG または MP3**（ループする曲は OGG の方が継ぎ目がきれい）
  - 効果音 … WAV / OGG / MP3 どれでも可
- 拡張子を変える時は `src/data/` のパスも書き換えてください。

## 翻訳する
1. `npm run i18n:check` を実行 → 未翻訳のキーと日本語が一覧表示される
2. それを翻訳AIに渡して英訳してもらう
3. 結果を `src/i18n/en.ts` に貼り付ける
