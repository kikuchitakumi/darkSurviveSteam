# Steam リリースまでの手順

## 現在の状態
- `npm run electron` でデスクトップアプリとして起動できる（Web版と同じビルドを表示）。
- セーブは localStorage（Electron でもそのまま動作）。

## リリースまでにやること

### 1. パッケージ化（.exe の作成）
```bash
npm i -D electron-builder
npx electron-builder --win --dir   # release/ に出力
```
`package.json` に `build` 設定（appId、productName、files: ["dist/**", "electron/**"]）を追加する。

### 2. Steamworks の組み込み（steamworks.js）
```bash
npm i steamworks.js
```
`electron/main.cjs` で `require('steamworks.js').init(<AppID>)` を呼び、
- **実績**：ボス撃破・クリア・才能開花など
- **Steam クラウド**：`src/core/Storage.ts` を差し替えてセーブを同期
- **Steam Input**：Steam Deck のコントローラ対応（Verified の必須要件）

### 3. Steam Deck 対応
- 初期設定のコントローラで全操作ができること（カード選択・対象選択・ターン終了・メニュー）
- 画質「低」で 60fps を確認（設定 → 画質）
- 1280x800 で文字が読めるか確認（現在は 1920x1080 基準で縮小表示）

### 4. ストアページ
- カプセル画像（各サイズ）、スクリーンショット5枚以上、トレーラー
- タグ：Roguelike Deckbuilder / Horror / Card Battler / Turn-Based / Dark
- **早めに公開してウィッシュリストを集める**（Next Fest 前に）

### 5. 価格・販売戦略
`docs/MARKET_RESEARCH.md` の「収益を最大化するための今後の提案」を参照。
