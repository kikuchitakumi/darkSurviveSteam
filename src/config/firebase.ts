// =============================================================
// firebase.ts  【設定：Firebase の接続情報】
// -------------------------------------------------------------
// カード・敵・イベントのデータと画像を Firebase で管理するための設定。
//
// ★設定方法（docs/FIREBASE.md に画像付きの詳しい手順あり）
//   1. Firebase コンソール → プロジェクトの設定 → 「マイアプリ」でウェブアプリを追加
//   2. 表示される firebaseConfig の値を下にコピーする
//      （または .env.local に VITE_FIREBASE_API_KEY などを書く）
//
// ※ここの値（apiKey など）は「どのプロジェクトに繋ぐか」を示すだけで、
//   パスワードではありません。書き込みの制限は Firebase のセキュリティルールで行います
//   （firestore.rules / storage.rules）。
// =============================================================

const env = import.meta.env;

export const FIREBASE_CONFIG = {
  apiKey: env.VITE_FIREBASE_API_KEY ?? '',
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN ?? 'darksurvive-75631.firebaseapp.com',
  projectId: env.VITE_FIREBASE_PROJECT_ID ?? 'darksurvive-75631',
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET ?? 'darksurvive-75631.firebasestorage.app',
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID ?? '',
  appId: env.VITE_FIREBASE_APP_ID ?? '',
};

/** apiKey と appId が入っていれば Firebase を使う。無ければ「ローカル保存モード」 */
export function isFirebaseConfigured(): boolean {
  return !!FIREBASE_CONFIG.apiKey && !!FIREBASE_CONFIG.appId;
}
