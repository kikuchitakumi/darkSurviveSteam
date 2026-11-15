// =============================================================
// main.ts  【エントリポイント】
// -------------------------------------------------------------
// ブラウザ / Electron が最初に実行するファイル。
//  1. フォント・CSS を読み込む
//  2. 画面（ui）を初期化する
//  3. GameController を起動する
// =============================================================
import '@fontsource/shippori-mincho-b1/400.css';
import '@fontsource/shippori-mincho-b1/700.css';
import '@fontsource/shippori-mincho-b1/800.css';
import '@fontsource/cinzel/400.css';
import '@fontsource/cinzel/700.css';
import '@fontsource/cinzel/900.css';
import './styles/main.css';

import { ui } from './view/ui';
import { GameController } from './controller/GameController';
import { settings } from './core/Settings';
import { bus } from './core/EventBus';

/** 画質設定を <html> の属性に反映（CSS 側で演出の量を切り替える） */
function applyQuality(): void {
  document.documentElement.dataset.quality = settings.current.quality;
  document.documentElement.lang = settings.current.language;
}
applyQuality();
bus.on('settingsChanged', applyQuality);

ui.init(document.getElementById('app')!);

// 右クリックメニュー・ドラッグ選択を無効化（ゲームらしい操作感にする）
window.addEventListener('contextmenu', (e) => e.preventDefault());

const game = new GameController();
// デバッグ用にコンソールから触れるようにしておく（例: __game.gs.data.gold = 9999）
(window as any).__game = game;
game.boot();
