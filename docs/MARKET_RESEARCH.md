# 市場調査と技術選定（2026年11月時点）

DarkSurvive の開発を始める前に行った調査のまとめです。
「どの技術で作ると今後進めやすいか」「何が流行っていて、何を取り入れるべきか」を整理しています。

---

## 1. 市場の状況

| 項目 | 内容 | 出典 |
|---|---|---|
| ジャンルの勢い | 2026年3月5日に発売された Slay the Spire 2 が Steam の売上1位。最大同時接続は約50〜57万人で、アナリストは「史上最も成功したデッキ構築ゲーム」と評価 | [PC Gamer](https://www.pcgamer.com/games/roguelike/analysts-say-slay-the-spire-2-is-the-best-performing-deckbuilder-of-all-time-and-the-competition-isnt-close/), [Sensor Tower](https://sensortower.com/blog/mega-crits-slay-the-spire-ii-slays-with-7-million-units-sold) |
| 市場規模 | ローグライク全体で、2026年上半期だけで Steam の総売上が約5億ドル | [Tech4Gamers](https://tech4gamers.com/roguelikes-steam-500m-2026/) |
| 競争 | 「Roguelike Deckbuilder」タグの新作は 2026年だけで 316本（前年同期比 +93%）。**競争は激しく、差別化が必須** | [Steam Page Analyzer](https://www.steampageanalyzer.com/niches/roguelike-deckbuilder) |
| 価格帯 | ジャンルの多くは $5〜9.99。ただし **$15〜19.99 の方が「十分なレビュー数」に届いた割合が高い（22.7%）** | 同上 |

### ここから言えること
- 需要は非常に大きい（StS2 でジャンルの新規プレイヤーが急増している）。
- 一方で作品数も倍増しているため、**「ホラー × デッキ構築 × 100階の塔」という明確な個性** と、**触って気持ちいい演出** が生命線になる。
- 安売りせず、$9.99〜$14.99（1,200〜2,000円）程度の品質を目指すのが良い。

---

## 2. 技術選定

### 検討した選択肢

| 選択肢 | 長所 | 短所 |
|---|---|---|
| **Godot** | StS2 も Godot 製。Steam での採用数が急増中 | Web版の配布がやや重い。AI によるコード生成の精度は TypeScript に劣る |
| **Unity** | Steam のシェア最大、資料が豊富 | 料金体系の不安。今回の「AIで作る・URLで遊べる」に対しては重い |
| **Phaser / PixiJS** | Web で動く2Dゲーム向け。Electron で Steam 版も作れる | カードゲームの UI（ツールチップ・パネル・文字）は結局 DOM の方が作りやすい |
| **TypeScript + DOM/CSS/Canvas（採用）** | AI が最も得意な言語。UI中心のカードゲームと相性抜群。**同じコードで「URLで遊べるWeb版」と「Steam版（Electron）」の両方を作れる** | Electron 版は容量が大きめ（約150MB）。Steam Deck のコントローラ対応は steamworks.js が必要 |

[参考: Phaser+Electron で Steam 版を出した事例 / Godot の伸び](https://respawn.outlookindia.com/gaming/gaming-guides/godot-for-indie-developers-why-its-gaining-ground-in-2026)

### 採用した構成
- **言語**: TypeScript（型があるので AI が書いたコードの間違いを早期に発見できる）
- **ビルド**: Vite（起動が速く、保存するとすぐ画面に反映される）
- **描画**: HTML/CSS（UI・カード）＋ Canvas（パーティクル）＋ Web Animations API（演出）
- **音**: Web Audio API（BGM のクロスフェード、SE のピッチ揺らし）
- **Web公開**: GitHub Pages（push するだけで自動公開）
- **Steam版**: Electron（同じビルドをそのまま表示）＋ 今後 steamworks.js で実績・クラウドセーブ

---

## 3. Steam Deck 対応で注意すること

| 要件 | 対応状況 |
|---|---|
| 初期設定のコントローラ操作で全機能が使えること（Verified の必須要件） | 今後対応（steamworks.js の Steam Input を使う予定） |
| 文字入力時にオンスクリーンキーボードを出すこと | 現在、文字入力は無いので対象外 |
| 初期設定が重すぎないこと | **画質設定（低/中/高）を実装済み**。低ではグレイン・揺れアニメ等を省略 |
| 画面比率 | 1920x1080 基準で拡大縮小。1280x800 でも崩れない |

Electron の Gamepad API は Proton 環境で動かない事例があるため、Steam Input 経由での実装を推奨。
[参考: Steamworks 公式の推奨事項](https://partner.steamgames.com/doc/steamdeck/recommendations) / [Electron アプリの Steam Deck 対応事例](https://brainhub.eu/library/making-electron-apps-steam-deck-compatible)

---

## 4. 取り入れた「流行り」と「売れる要素」

| 要素 | なぜ効くか | 実装 |
|---|---|---|
| **気持ちいい演出（ジュース）** | Balatro・StS2 の評価の柱は「触って気持ちいい」こと | ダメージ数字のポップ、クリティカル時のヒットストップ＆画面揺れ、斬撃・血しぶき、HPバーの遅れて減る白帯 |
| **判断材料をはっきり見せる** | StS2 のレビューで「情報が見えるので勝利に納得感がある」と評価 | 敵の次の行動（意図）と数値を常時表示。カードの数値はステータス込みで即時計算して表示 |
| **シード表示・共有** | 配信者・SNS で「同じシードで遊んでみた」が広がりやすい | 画面右上にシードを表示。同じシードなら同じ展開 |
| **運の要素とドラマ** | 「才能開花」「金持ち」など、ランごとの物語が生まれる | ステータス抽選のスロット演出、才能開花（3%）、金持ち（1%） |
| **短いセッション＆中断再開** | Steam Deck・携帯機で遊ばれる時代 | 各階で自動セーブ。CONTINUE で再開 |
| **アクセシビリティ** | レビューの減点を防ぐ | 画面揺れ OFF、文字送り速度、画質設定、キーボード操作（1〜9でカード、Eでターン終了） |
| **多言語** | Steam の売上の多くは英語圏・中国語圏 | 日本語＋英語の切り替え。翻訳キーの仕組みを用意済み。次は簡体字中国語を推奨 |

---

## 5. 収益を最大化するための今後の提案

1. **Steam ストアページを早く公開してウィッシュリストを集める**（発売前に1万件が目安）
2. **体験版（〜20F まで）を Steam Next Fest に出展**
3. 価格は **$12.99〜$14.99**（日本円 1,500〜2,000円）を目安に
4. 配信者向けに **デイリーチャレンジ（全員同じシード）** と **ランキング** を追加
5. 発売後の売上を伸ばすため、**新キャラクター（別の初期デッキ）DLC** と **サウンドトラック DLC** を用意
6. **実績（Steam Achievements）** を 30〜50 個（ボス撃破・才能開花・ノーダメージクリア等）
