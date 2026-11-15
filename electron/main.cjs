// =============================================================
// electron/main.cjs  【Steam版（デスクトップアプリ）の起動スクリプト】
// -------------------------------------------------------------
// Web版と全く同じビルド成果物（dist/）を、Electron のウィンドウで表示する。
// 実行: npm run electron   （内部で npm run build してから起動）
//
//  - app:// という独自プロトコルで dist/ を配信する
//    （file:// だと fetch で音声ファイルを読めないため）
//  - F11 でフルスクリーン切り替え
//  - Steamworks（実績・クラウドセーブ）は steamworks.js を追加して
//    このファイルから初期化する予定（docs/STEAM_RELEASE.md 参照）
// =============================================================
const { app, BrowserWindow, protocol, net } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const { pathToFileURL } = require('node:url');

const DIST = path.join(__dirname, '..', 'dist');

// app:// を通常の https と同じように扱えるよう登録（fetch・ESモジュールが使える）
protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true } },
]);

function createWindow() {
  const win = new BrowserWindow({
    width: 1600,
    height: 900,
    minWidth: 960,
    minHeight: 540,
    backgroundColor: '#000000',
    autoHideMenuBar: true,
    title: 'DarkSurvive',
    webPreferences: { contextIsolation: true, sandbox: true },
  });
  win.setMenuBarVisibility(false);
  win.loadURL('app://game/index.html');

  // F11 でフルスクリーン
  win.webContents.on('before-input-event', (_e, input) => {
    if (input.type === 'keyDown' && input.key === 'F11') win.setFullScreen(!win.isFullScreen());
  });

  // 動作確認用：DS_SMOKE=1 で起動すると、コンソール出力を表示して数秒後に終了する
  if (process.env.DS_SMOKE) {
    win.webContents.on('console-message', (_e, level, message) => console.log(`[renderer:${level}] ${message}`));
    win.webContents.on('did-finish-load', () => console.log('[smoke] page loaded'));
    setTimeout(async () => {
      const ok = await win.webContents.executeJavaScript("!!document.querySelector('.loading-screen, .click-to-start')");
      console.log(`[smoke] game ui present: ${ok}`);
      app.quit();
    }, 6000);
  }
}

app.whenReady().then(() => {
  // app://game/... → dist/... を返す
  protocol.handle('app', (req) => {
    const { pathname } = new URL(req.url);
    const file = path.normalize(path.join(DIST, decodeURIComponent(pathname)));
    if (!file.startsWith(DIST)) return new Response('Forbidden', { status: 403 });
    if (!fs.existsSync(file)) return new Response('Not Found', { status: 404 });
    return net.fetch(pathToFileURL(file).toString());
  });
  createWindow();
});

app.on('window-all-closed', () => app.quit());
