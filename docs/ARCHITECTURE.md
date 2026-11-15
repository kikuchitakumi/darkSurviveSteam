# プログラムの構成（MVC）

DarkSurvive は **Model / View / Controller** の3層に分けて作っています。
「どこに何が書いてあるか」がフォルダ名だけで分かるようにしています。

```
src/
├─ main.ts                 … 起動（エントリポイント）
├─ config/                 … 設定値
│   ├─ gameConfig.ts       …   画面サイズ・保存キーなど技術的な設定
│   └─ balance.ts          …   ★ゲームバランスの数値（全部ここ）
├─ data/                   … ★追加コンテンツ（データだけで追加できる）
│   ├─ cards.ts            …   カード
│   ├─ enemies.ts          …   敵・強敵・ボス
│   ├─ items.ts            …   消費アイテム・鍵
│   ├─ equipment.ts        …   装備品（武器・防具・アクセサリー）
│   ├─ events.ts           …   ランダムイベント
│   ├─ treasures.ts        …   宝物庫の宝箱
│   ├─ statusEffects.ts    …   状態異常（バフ・デバフ）
│   ├─ floors.ts           …   ゾーン（20Fごと）・背景・1Fのセリフ
│   ├─ images.ts           …   画面共通の画像パス
│   └─ audio.ts            …   効果音・BGMのファイルパス
├─ model/                  … 【Model】ゲームのルール（画面のことは知らない）
│   ├─ types.ts            …   データの型
│   ├─ GameState.ts        …   1回の冒険の状態（セーブ対象）
│   ├─ Combat.ts           …   戦闘エンジン
│   ├─ StatRoller.ts       …   初期ステータス抽選
│   ├─ FloorGenerator.ts   …   分かれ道・敵編成
│   ├─ Loot.ts             …   報酬・ショップ・宝箱の抽選
│   └─ Outcomes.ts         …   イベント結果・戦闘外アイテム
├─ view/                   … 【View】見た目（ルールは持たない）
│   ├─ Stage.ts            …   1920x1080 の画面とレイヤー
│   ├─ ui.ts               …   共通部品の入れ物
│   ├─ components/         …   メッセージ窓・HUD・カード・モーダル・ツールチップ
│   ├─ panels/             …   デッキ一覧・ステータス・オプション・装備比較
│   ├─ scenes/             …   タイトル・抽選・戦闘・ショップ・報酬・終了画面
│   └─ effects/            …   パーティクル・画面揺れ・ダメージ数字
├─ controller/             … 【Controller】ゲームの進行役
│   ├─ GameController.ts   …   全体の流れ（タイトル→抽選→各階→クリア）
│   ├─ BattleController.ts …   戦闘の進行
│   ├─ RewardController.ts …   勝利報酬
│   ├─ ShopController.ts   …   ショップ
│   ├─ EventController.ts  …   イベント
│   └─ TreasureController.ts … 宝物庫
├─ core/                   … どこからでも使う基盤
│   ├─ AudioManager.ts     …   音の再生
│   ├─ Random.ts           …   シード付き乱数
│   ├─ Storage.ts          …   セーブ（今後 Steam クラウドに差し替え可能）
│   ├─ Settings.ts         …   オプション設定
│   └─ EventBus.ts         …   状態変化の通知
├─ i18n/                   … 多言語
│   ├─ ja.ts               …   日本語（基準）
│   ├─ en.ts               …   英語
│   └─ index.ts            …   翻訳関数 t() / td()
└─ styles/main.css         … 全画面のスタイル
```

## 戦闘の仕組み（ロジックと演出の分離）

```
 プレイヤーの操作            Model                         View
 ───────────────     ─────────────────────     ──────────────────────
 カードをクリック  →  Combat.playCard()      →  CombatEvent の一覧
                      ルール通りに状態を更新       [cardPlayed, attack, damage, death...]
                                                       ↓
                                               BattleScene.play(events)
                                               1つずつアニメーション再生
```

- **Model（Combat）** は一瞬で計算を終え、「何が起きたか」を `CombatEvent` として記録します。
- **View（BattleScene）** はその記録を順番に、斬撃・数字・揺れなどで演出します。
- この分離により、**ルールは自動テストで確認でき**（`tests/model.test.ts`）、**演出は自由に作り込めます**。

## セーブ
- 各階に着いた時・道を選んだ時・買い物をした時に自動セーブ（localStorage）。
- 道を選んだ後に中断しても、再開時は同じ道から再開（セーブ＆ロードでのやり直し防止）。
- Steam クラウドに対応する時は `core/Storage.ts` だけを差し替えます。

## ツール
| コマンド | 内容 |
|---|---|
| `npm run dev` | 開発用サーバー（http://localhost:5173） |
| `npm run build` | 公開用ビルド（dist/） |
| `npm test` | ゲームロジックの自動テスト |
| `npm run gen:images` | data/ を元に仮画像を自動生成（既存ファイルはスキップ） |
| `npm run gen:audio` | 仮の効果音・BGM を自動生成（既存ファイルはスキップ） |
| `npm run assets:list` | 素材一覧 docs/ASSETS.md を自動生成 |
| `npm run i18n:check` | 未翻訳の文言を一覧表示 |
| `npm run screenshot -- <フォルダ>` | 自動プレイしてスクリーンショットを保存（要 `npm run dev`） |
| `npm run electron` | デスクトップ版（Steam版の土台）を起動 |
