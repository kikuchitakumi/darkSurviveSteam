// =============================================================
// ja.ts  【多言語：日本語（基準言語）】
// -------------------------------------------------------------
// 画面に表示する UI の文言は全てここに書く。
// ★翻訳の流れ：
//   1. まず日本語でここに追加する
//   2. en.ts に同じキーで英訳を追加する（無ければ日本語が表示される）
//   3. `npm run i18n:check` で未翻訳のキーを一覧できる
//
// カード名・敵名などのデータの文言は data/ に日本語で書き、
// 英訳は en.ts の "card.<id>.name" のようなキーで上書きする。
//
// {name} のような部分は t('key', { name: '...' }) で置き換えられる。
// =============================================================

export const ja = {
  // ---- 共通 ----
  'common.ok': '決定',
  'common.cancel': 'キャンセル',
  'common.close': '閉じる',
  'common.back': '戻る',
  'common.yes': 'はい',
  'common.no': 'いいえ',
  'common.confirm': '確認',
  'common.skip': 'スキップ',
  'common.gold': '{n}G',
  'common.floor': '{n}F',
  'common.loading': '読み込み中…',
  'common.clickToContinue': 'クリックで進む',

  // ---- ステータス名 ----
  'stat.level': 'レベル',
  'stat.hp': '体力',
  'stat.atk': '攻撃力',
  'stat.def': '防御力',
  'stat.mag': '魔力',
  'stat.luk': '運',
  'stat.ap': 'AP',
  'stat.exp': '経験値',
  'stat.hp.desc': '最大HP = 20 + 体力 × 10',
  'stat.atk.desc': '攻撃カードのダメージに加算',
  'stat.def.desc': '防御カードのブロックに加算',
  'stat.mag.desc': '魔法カード・回復量に加算',
  'stat.luk.desc': 'クリティカル率・回避率（各最大50%）、イベントの成功率が上がる',
  'stat.ap.desc': 'カードを使うためのポイント（毎ターン回復）',

  // ---- タイトル ----
  'title.start': 'START',
  'title.continue': 'CONTINUE',
  'title.option': 'OPTION',
  'title.quit': 'QUIT',
  'title.best': '最高到達: {n}F',
  'title.confirmNew': 'セーブデータがあります。\n新しく始めるとセーブデータは消えます。よろしいですか？',
  'title.pressStart': '— クリックして始める —',
  'title.debug': 'DEBUG',
  'title.devMenu': '開発メニュー',
  'title.sourceUpdated': 'ソース更新: {date}',
  'debug.title': 'デバッグ：好きな階から開始',
  'debug.floor': '開始する階（1〜{max}）',
  'debug.start': 'この階から開始',
  'debug.note': 'ステータスはランダム、デッキは初期デッキで始まります。',

  // ---- オプション ----
  'option.title': 'OPTION',
  'option.bgm': 'BGM 音量',
  'option.se': 'SE 音量',
  'option.quality': '画質',
  'option.quality.low': '低（軽量）',
  'option.quality.medium': '中',
  'option.quality.high': '高',
  'option.language': 'Language / 言語',
  'option.textSpeed': '文字送り速度',
  'option.textSpeed.slow': '遅い',
  'option.textSpeed.normal': '普通',
  'option.textSpeed.fast': '速い',
  'option.screenShake': '画面の揺れ',
  'option.fullscreen': 'フルスクリーン',
  'option.on': 'ON',
  'option.off': 'OFF',
  'option.toTitle': 'タイトルへ戻る（自動セーブ）',
  'option.abandon': '冒険を諦める',
  'option.abandonConfirm': '本当に諦めますか？\nこの冒険のデータは失われます。',

  // ---- ステータス決定 ----
  'roll.title': '運命の選定',
  'roll.subtitle': 'あなたの素質が決まる……',
  'roll.reroll': '振り直す（残り {n} 回）',
  'roll.rerollNone': '振り直し不可',
  'roll.accept': 'この素質で塔に挑む',
  'roll.talent': '才能開花！',
  'roll.rich': '金持ちの才能が覚醒！',
  'roll.startGold': '初期所持金',
  'roll.seed': 'SEED',

  // ---- 1F ----
  'f1.openDoor': '扉を開ける',
  'f1.goHome': '帰る',
  'f1.explore': '周りを探索する',
  'f1.pray': '祈る',
  'f1.proceed': '進む',
  'f1.stop': 'やめておく',

  // ---- 2F以降 ----
  'floor.choose': '進む道を選べ',
  'floor.enter': '{n}F に到着した。',
  'floor.bossWarning': '強大な気配がする……この先に、この区画の主がいる。',
  'floor.zone': 'ZONE {n}',

  // ---- 宝物庫 ----
  'treasure.title': '宝物庫',
  'treasure.intro': '隠し通路の先には、埃をかぶった宝物庫があった。\n赤・青・黄・緑、4つの宝箱が並んでいる。',
  'treasure.open': '{color}の宝箱を開ける',
  'treasure.locked': '{color}の鍵が必要だ。',
  'treasure.opened': '空っぽだ。',
  'treasure.leave': '帰る',
  'treasure.got': '{name} を手に入れた！',
  'treasure.color.red': '赤',
  'treasure.color.blue': '青',
  'treasure.color.yellow': '黄',
  'treasure.color.green': '緑',

  // ---- 戦闘 ----
  'battle.endTurn': 'ターン終了',
  'battle.enemyTurn': '敵のターン',
  'battle.yourTurn': 'あなたのターン',
  'battle.turn': 'ターン {n}',
  'battle.notEnoughAp': 'AP が足りない！',
  'battle.selectTarget': '対象を選んでください',
  'battle.selectExhaust': '廃棄するカードを {n} 枚選んでください',
  'battle.selectReduceCost': 'コストを下げるカードを1枚選んでください',
  'battle.drawPile': '山札',
  'battle.discardPile': '捨て札',
  'battle.exhaustPile': '廃棄',
  'battle.critical': 'CRITICAL!',
  'battle.evade': 'MISS',
  'battle.resist': '無効',
  'battle.stunned': '封印中…',
  'battle.block': 'ブロック',
  'battle.victory': 'VICTORY',
  'battle.defeat': 'YOU DIED',
  'battle.bossAppear': 'BOSS',
  'battle.eliteAppear': 'DANGER',
  'battle.encounter': '敵が現れた！',
  'battle.reshuffle': '捨て札をシャッフルした',
  'battle.intent.attack': '攻撃',
  'battle.intent.debuff': '弱体化',
  'battle.intent.buff': '強化',
  'battle.intent.block': '防御',
  'battle.intent.special': '特殊行動',
  'battle.intent.stun': '行動できない',
  'battle.intent.tooltip': '{name}：{type}',
  'battle.items': 'アイテム',

  // ---- 報酬 ----
  'reward.title': '戦利品',
  'reward.gold': '{n} G',
  'reward.exp': '経験値 +{n}',
  'reward.chooseCard': 'デッキに加えるカードを1枚選べ',
  'reward.skipCard': 'カードを受け取らない',
  'reward.item': 'アイテム：{name}',
  'reward.itemFull': 'アイテムがいっぱいで {name} を持てなかった',
  'reward.equipment': '装備品：{name}',
  'reward.key': '{name} を手に入れた',
  'reward.next': '次の階へ',
  'reward.cardAdded': '{name} をデッキに加えた',

  // ---- レベルアップ ----
  'level.up': 'LEVEL UP!',
  'level.reached': 'レベル {n} になった！',
  'level.points': 'ステータスポイント：{n}',
  'level.bonus': '10レベルボーナス +5！',
  'level.allocate': 'ステータスを割り振る',
  'level.confirm': '決定',
  'level.later': 'あとで振る',
  'level.reset': 'リセット',

  // ---- ショップ ----
  'shop.title': '商人',
  'shop.darkTitle': '闇商人',
  'shop.greeting': '「いらっしゃい……こんな所まで、よく来たね」',
  'shop.darkGreeting': '「ヒヒッ……運がいいねぇ。ここでしか手に入らない品ばかりさ……高いけどね」',
  'shop.cards': 'カード',
  'shop.items': 'アイテム',
  'shop.equipment': '装備品',
  'shop.keys': '鍵',
  'shop.services': 'サービス',
  'shop.removeCard': 'カード削除',
  'shop.removeCardDesc': 'デッキからカードを1枚取り除く',
  'shop.chooseRemove': '削除するカードを選んでください',
  'shop.buy': '購入',
  'shop.sold': 'SOLD',
  'shop.notEnoughGold': 'お金が足りない……',
  'shop.itemFull': 'アイテムがいっぱいだ',
  'shop.thanks': '「まいど……」',
  'shop.leave': '店を出る',

  // ---- 装備 ----
  'equip.slot.weapon': '武器',
  'equip.slot.armor': '防具',
  'equip.slot.accessory': 'アクセサリー',
  'equip.none': 'なし',
  'equip.got': '{name} を手に入れた！',
  'equip.swapTitle': '装備を変更しますか？',
  'equip.current': '現在の装備',
  'equip.new': '新しい装備',
  'equip.equip': '装備する',
  'equip.discard': '捨てる',

  // ---- イベント ----
  'event.luck': '（成功率 {n}%）',

  // ---- HUD / メニュー ----
  'hud.deck': 'デッキ',
  'hud.status': 'ステータス',
  'hud.menu': 'メニュー',
  'hud.keys': '鍵',
  'hud.seed': 'SEED',
  'hud.pointsAvailable': '未使用ポイント {n}',
  'deck.title': 'デッキ（{n}枚）',
  'status.title': 'ステータス',
  'status.equipment': '装備',
  'status.crit': 'クリティカル率',
  'status.evade': '回避率',
  'item.use': '使う',
  'item.discard': '捨てる',
  'item.cannotUseHere': 'ここでは使えない',

  // ---- ゲームオーバー / クリア ----
  'gameover.title': 'YOU DIED',
  'gameover.reached': '到達階：{n}F',
  'gameover.stats': '記録',
  'gameover.toTitle': 'タイトルへ',
  'gameover.retry': 'もう一度挑む',
  'clear.title': 'THE NIGHTMARE ENDS',
  'clear.message': '夜明けを喰らうものは倒れた。\n塔の頂から、本物の朝日が差し込んでくる……。',
  'stats.battlesWon': '勝利した戦闘',
  'stats.enemiesKilled': '倒した敵',
  'stats.damageDealt': '与えたダメージ',
  'stats.maxHit': '最大ダメージ',
  'stats.cardsPlayed': '使ったカード',
  'stats.goldEarned': '稼いだお金',
  'stats.crits': 'クリティカル',
  'stats.level': '最終レベル',
  'stats.time': 'プレイ時間',

  // ---- カード種別 ----
  'cardType.attack': '攻撃',
  'cardType.support': 'サポート',
  'cardElement.sword': '剣',
  'cardElement.magic': '魔力',
  'cardElement.blood': '血',
  'cardElement.curse': '呪',
  'cardType.defense': '防御',
  'cardType.buff': 'バフ',
  'cardType.debuff': 'デバフ',
  'cardType.special': 'その他',
  'card.exhaust': '廃棄',
  'rarity.basic': '基本',
  'rarity.common': 'コモン',
  'rarity.rare': 'レア',
  'rarity.legendary': 'レジェンド',

  // ---- チュートリアル的ヒント ----
  'hint.battle': 'カードをドラッグして敵に放つか、クリックで選んでから敵をクリック。\n[1-9]キーでカード選択 / [E]でターン終了',
} as const;

export type I18nKey = keyof typeof ja;
