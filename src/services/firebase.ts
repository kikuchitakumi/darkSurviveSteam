// =============================================================
// firebase.ts  【サービス：Firebase との接続】
// -------------------------------------------------------------
// Firebase の SDK は大きいので、必要になった時だけ読み込む（動的 import）。
// 設定が無い（config/firebase.ts が空）場合は何もしない。
//   - Firestore … カード・敵・イベントのデータ
//   - Storage   … 画像
//   - Auth      … 開発メニューで書き込む人のログイン（Google）
// =============================================================
import { FIREBASE_CONFIG, isFirebaseConfigured } from '@/config/firebase';

type FirebaseKit = {
  app: import('firebase/app').FirebaseApp;
  db: import('firebase/firestore').Firestore;
  storage: import('firebase/storage').FirebaseStorage;
  auth: import('firebase/auth').Auth;
  fs: typeof import('firebase/firestore');
  st: typeof import('firebase/storage');
  au: typeof import('firebase/auth');
};

let kit: Promise<FirebaseKit> | null = null;

/** Firebase を初期化して返す（設定が無ければ null） */
export function getFirebase(): Promise<FirebaseKit> | null {
  if (!isFirebaseConfigured()) return null;
  if (!kit) {
    kit = (async () => {
      const [{ initializeApp }, fs, st, au] = await Promise.all([
        import('firebase/app'),
        import('firebase/firestore'),
        import('firebase/storage'),
        import('firebase/auth'),
      ]);
      const app = initializeApp(FIREBASE_CONFIG);
      return { app, db: fs.getFirestore(app), storage: st.getStorage(app), auth: au.getAuth(app), fs, st, au };
    })();
  }
  return kit;
}

/** ログイン中のユーザー（いなければ null） */
export async function currentUser(): Promise<{ email: string | null; uid: string } | null> {
  const f = getFirebase();
  if (!f) return null;
  const { auth, au } = await f;
  await new Promise<void>((resolve) => {
    const off = au.onAuthStateChanged(auth, () => {
      off();
      resolve();
    });
  });
  const u = auth.currentUser;
  return u ? { email: u.email, uid: u.uid } : null;
}

/** Google アカウントでログイン（ポップアップ） */
export async function signIn(): Promise<void> {
  const f = getFirebase();
  if (!f) throw new Error('Firebase が設定されていません');
  const { auth, au } = await f;
  await au.signInWithPopup(auth, new au.GoogleAuthProvider());
}

export async function signOut(): Promise<void> {
  const f = getFirebase();
  if (!f) return;
  const { auth, au } = await f;
  await au.signOut(auth);
}
