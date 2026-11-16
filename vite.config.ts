// =============================================================
// Vite 設定ファイル
//  - base: './' にすることで、GitHub Pages（/darkSurviveSteam/ 配下）でも
//    Electron（file:// 読み込み）でも同じビルド成果物が動くようにしている。
//  - '@/' は src/ を指す別名。Windows ではドライブ名の大文字小文字の違いで
//    同じファイルが二重に読み込まれることがあるため、ルート相対の '/src' を使う。
// =============================================================
import { defineConfig } from 'vite';
import { resolve } from 'node:path';
import { readdirSync, realpathSync, statSync } from 'node:fs';
import { execSync } from 'node:child_process';

// Windows でカレントディレクトリが小文字ドライブ（c:\）だと、同じモジュールが
// 二重に読み込まれて動かなくなることがあるため、正式な表記（C:\）に揃える。
try {
  process.chdir(realpathSync.native(process.cwd()));
} catch {
  /* noop */
}

/** フォルダ内で最も新しいファイルの更新時刻（ミリ秒） */
function newestMtime(dir: string): number {
  let newest = 0;
  for (const name of readdirSync(dir)) {
    const p = resolve(dir, name);
    const st = statSync(p);
    newest = Math.max(newest, st.isDirectory() ? newestMtime(p) : st.mtimeMs);
  }
  return newest;
}

/**
 * 「ソースの更新日時」（タイトル画面のデバッグ表示用）。
 *  - src/ public/ に未コミットの変更がある → 最も新しいファイルの更新時刻
 *  - 変更がない → 最後のコミット日時
 *  どちらも取れなければビルド時刻。
 */
function sourceUpdatedAt(): string {
  try {
    const dirty = execSync('git status --porcelain -- src public', { encoding: 'utf8' }).trim();
    if (!dirty) {
      const commit = execSync('git log -1 --format=%cI -- src public', { encoding: 'utf8' }).trim();
      if (commit) return new Date(commit).toISOString();
    }
    return new Date(Math.max(newestMtime('src'), newestMtime('public'))).toISOString();
  } catch {
    return new Date().toISOString();
  }
}

export default defineConfig({
  base: './',
  define: {
    __SOURCE_UPDATED__: JSON.stringify(sourceUpdatedAt()),
  },
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
