// =============================================================
// Vite 設定ファイル
//  - base: './' にすることで、GitHub Pages（/darkSurviveSteam/ 配下）でも
//    Electron（file:// 読み込み）でも同じビルド成果物が動くようにしている。
//  - '@/' は src/ を指す別名。Windows ではドライブ名の大文字小文字の違いで
//    同じファイルが二重に読み込まれることがあるため、ルート相対の '/src' を使う。
// =============================================================
import { defineConfig } from 'vite';
import { resolve } from 'node:path';
import { realpathSync } from 'node:fs';

// Windows でカレントディレクトリが小文字ドライブ（c:\）だと、同じモジュールが
// 二重に読み込まれて動かなくなることがあるため、正式な表記（C:\）に揃える。
try {
  process.chdir(realpathSync.native(process.cwd()));
} catch {
  /* noop */
}

export default defineConfig({
  base: './',
  resolve: {
    alias: [{ find: /^@\//, replacement: '/src/' }],
  },
  build: {
    outDir: 'dist',
    assetsInlineLimit: 0, // 画像・音声は常にファイルとして出力（差し替えしやすくするため）
    chunkSizeWarningLimit: 2000,
  },
  server: { port: 5173, open: false },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    alias: [{ find: /^@\//, replacement: resolve(process.cwd(), 'src') + '/' }],
  },
} as any);
