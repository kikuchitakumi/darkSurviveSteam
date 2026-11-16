// =============================================================
// firebase.ts  【サービス：Firebase との接続】
// -------------------------------------------------------------
// Firebase の SDK は大きいので、必要になった時だけ読み込む（動的 import）。
// 設定が無い（config/firebase.ts が空）場合は何もしない。
//   - Firestore … カード・敵・イベントのデータ
//   - Storage   … 画像
// ログインは不要（誰でも開発メニューから書き込める設定。firestore.rules / storage.rules を参照）。
// =============================================================
import { FIREBASE_CONFIG, isFirebaseConfigured } from '@/config/firebase';

type FirebaseKit = {
  app: import('firebase/app').FirebaseApp;
  db: import('firebase/firestore').Firestore;
  storage: import('firebase/storage').FirebaseStorage;
  fs: typeof import('firebase/firestore');
  st: typeof import('firebase/storage');
};

let kit: Promise<FirebaseKit> | null = null;

/** Firebase を初期化して返す（設定が無ければ null） */
export function getFirebase(): Promise<FirebaseKit> | null {
  if (!isFirebaseConfigured()) return null;
  if (!kit) {
    kit = (async () => {
      const [{ initializeApp }, fs, st] = await Promise.all([
        import('firebase/app'),
        import('firebase/firestore'),
        import('firebase/storage'),
      ]);
      const app = initializeApp(FIREBASE_CONFIG);
      return { app, db: fs.getFirestore(app), storage: st.getStorage(app), fs, st };
    })();
  }
  return kit;
}
