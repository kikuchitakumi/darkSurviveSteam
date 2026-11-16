// =============================================================
// gameConfig.ts
// -------------------------------------------------------------
// ゲーム全体の「技術的な」設定値をまとめたファイル。
// （バランス調整用の数値は balance.ts に分離している）
// =============================================================

export const GAME_CONFIG = {
  /** ゲームタイトル */
  TITLE: 'DarkSurvive',
  /** バージョン表記（タイトル画面右下に表示） */
  VERSION: '0.1.0',

  /**
   * 論理解像度。全ての画面はこのサイズ（1920x1080）を基準にレイアウトし、
   * 実際のウィンドウサイズに合わせて拡大縮小（レターボックス）される。
   * Steam Deck(1280x800) でも 16:9 で崩れずに表示される。
   */
  STAGE_WIDTH: 1920,
  STAGE_HEIGHT: 1080,

  /** localStorage のキー（セーブデータ・設定） */
  STORAGE_KEY_SAVE: 'darksurvive.save.v1',
  STORAGE_KEY_SETTINGS: 'darksurvive.settings.v1',
  STORAGE_KEY_META: 'darksurvive.meta.v1',

  /** 画像・音声のルートパス（public/ 配下）。相対パスなので Pages / Electron 両対応 */
  ASSET_ROOT: './assets',

  /** 手元のPC（npm run dev）で動かしているか。開発メニューの表示に使う */
  DEV_HOST: typeof location !== 'undefined' && ['localhost', '127.0.0.1'].includes(location.hostname),

  /** デバッグ機能（URL に ?debug=1 を付けると有効化） */
  DEBUG: typeof location !== 'undefined' && new URLSearchParams(location.search).has('debug'),
} as const;
