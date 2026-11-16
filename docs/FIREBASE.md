# Firebase の設定手順（カード・敵・イベントの管理）

開発メニューで登録したカード・敵キャラ・イベントを **Firebase に保存して、チーム全員とゲームで共有** するための設定です。
設定するまでは「ローカル保存モード」（このPCのブラウザだけに保存）で動きます。

対象プロジェクト：`darksurvive-75631`

---

## 1. ウェブアプリを追加して、接続情報をコピー
1. [Firebase コンソール](https://console.firebase.google.com/project/darksurvive-75631/overview) を開く
2. 左上の歯車 →「プロジェクトの設定」→ 下の方の「マイアプリ」→ `</>`（ウェブ）を押す
3. アプリ名（例：`darksurvive-web`）を入れて登録（Hosting はチェック不要）
4. 表示される `firebaseConfig` の **apiKey / messagingSenderId / appId**（ほか表示された値）を、
   [src/config/firebase.ts](../src/config/firebase.ts) の該当箇所に書き込む

> これらの値はパスワードではありません（どのプロジェクトに繋ぐかの情報）。GitHub に載せても問題ありません。
> 書き込みの制限は、手順 4 のセキュリティルールで行います。

## 2. Firestore（データ）を作る
1. 左メニュー「構築 → Firestore Database」→「データベースを作成」
2. 場所：`asia-northeast1（東京）` がおすすめ
3. 「本番環境モード」で作成

## 3. Storage（画像）を作る
1. 左メニュー「構築 → Storage」→「始める」
2. 場所は Firestore と同じものを選ぶ
   ※ Storage の利用には、プロジェクトを従量課金（Blaze）プランにする必要がある場合があります（無料枠内なら費用はかかりません）

## 4. セキュリティルールを設定（必須）
リポジトリの [firestore.rules](../firestore.rules) と [storage.rules](../storage.rules) を開き、
`editor1@example.com` を **開発メニューで登録作業をする人の Google メールアドレス** に書き換えてから：

- 「Firestore Database → ルール」に `firestore.rules` の中身を貼り付けて「公開」
- 「Storage → ルール」に `storage.rules` の中身を貼り付けて「公開」

これで「誰でも読める（ゲームが読み込む）／書き込めるのは編集者だけ」になります。

## 5. Google ログインを有効にする
1. 左メニュー「構築 → Authentication」→「始める」
2. 「ログイン方法」→「Google」を有効にする
3. 「設定 → 承認済みドメイン」に以下があることを確認（無ければ追加）
   - `localhost`
   - `kikuchitakumi.github.io`

## 6. 使い方
1. `npm run dev` でゲームを起動（または公開URLに `?debug=1` を付けて開く）
2. タイトル画面の **「開発メニュー」** を押す
3. 右上の **「Google でログイン」** でログインすると、保存先が「Firebase（チームで共有）」になる
4. カード・敵キャラ・イベントを選んで編集 →「保存する」
5. ゲームは起動時に Firebase から読み込むので、他の人の画面にも反映されます

### ローカルに保存したものを Firebase に移す
Firebase 設定前に開発メニューで登録したものは、このPCに保存されています。
ログイン後、右上の **「このPCの登録を Firebase へ送る」** を押すと画像ごとアップロードされます。

---

## データの構造（参考）
| コレクション | ドキュメントID | 中身 |
|---|---|---|
| `cards` | カードの id | `def`（カードのデータ）, `deleted`, `updatedAt`, `updatedBy` |
| `enemies` | 敵の id | 同上 |
| `events` | イベントの id | 同上 |

画像は Storage の `content/<cards|enemies|events>/<id>/` に保存されます。

- 同梱データ（`src/data/*.ts`）と同じ id で保存すると **上書き**、新しい id なら **追加** になります。
- 同梱データを削除すると `deleted: true` の印だけが保存されます（「同梱データに戻す」で元に戻せます）。
- 「JSON 書き出し」で全データを保存できます。Claude に渡せば `src/data/` のコードに組み込めます（Steam版でオフラインでも確実に遊べるように）。
