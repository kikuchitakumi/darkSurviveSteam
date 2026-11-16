// =============================================================
// events.ts  【データ：ランダムイベント】
// -------------------------------------------------------------
// ★イベントを追加したい時はこのファイルに1件追加するだけでよい。
//
//  - text      : 本文。配列の1要素がメッセージウィンドウの1ページ。
//  - background: 背景画像 / object: 背景の上に置く透過画像
//  - choices   : 選択肢。success.outcomes に結果を並べる。
//      outcomes の種類は model/types.ts の EventOutcome を参照
//      （gold / heal / damage / exp / card / randomCard / item / key /
//        equipment / stat / battle / nothing）
//  - luckCheck : 運判定付きの選択肢。成功率 = base + 運×perLuck（上限 max）
//                失敗時は failure の結果になる。
//  - enabled   : false にすると出現しない（作りかけ・テスト用）
//  - requireGold: 所持金が足りないと選べない（※自動では引かれないので
//                 outcomes に { kind: 'gold', amount: -N } を入れること）
//  - minFloor / maxFloor : 出現する階の範囲（ゾーン限定イベント用）
//      1-20F 地下牢 / 21-40F 研究棟 / 41-60F 礼拝堂 / 61-80F 機関区画 / 81-100F 深淵
// =============================================================
import type { EventDef, EventOutcome } from '@/model/types';

const BG = 'images/bg/bg_event.webp';
const OBJ = {
  altar: 'images/objects/obj_altar.png',
  box: 'images/objects/obj_bloody_box.png',
  soldier: 'images/objects/obj_dying_soldier.png',
  darkMerchant: 'images/objects/obj_dark_merchant.png',
  chest: 'images/objects/chest_yellow.png',
};
const NOTHING: EventOutcome[] = [{ kind: 'nothing' }];
/** 「立ち去る」系の選択肢 */
const leave = (label = '立ち去る', text = 'あなたは関わらないことにした。') => ({ label, success: { text, outcomes: NOTHING } });

export const EVENTS: EventDef[] = [
  {
    id: 'whispering_altar',
    title: '囁く祭壇',
    text: [
      '薄暗い通路の奥に、小さな祭壇がある。',
      '燭台の火が揺れ、どこからか囁き声が聞こえる……。',
      '「……ひとつだけ……与えよう……」',
    ],
    background: 'images/bg/bg_event.webp',
    object: 'images/objects/obj_altar.png',
    weight: 10,
    enabled: true,
    choices: [
      {
        label: '金貨を受け取る（20G）',
        success: { text: '祭壇の上に金貨が現れた。20G を手に入れた。', outcomes: [{ kind: 'gold', amount: 20 }] },
      },
      {
        label: '傷を癒やしてもらう（HP 20回復）',
        success: { text: '温かな光に包まれ、傷が癒えていく……。HP が 20 回復した。', outcomes: [{ kind: 'heal', amount: 20 }] },
      },
    ],
  },

  {
    id: 'bloody_box',
    title: '血塗れの木箱',
    text: ['床に血塗れの木箱が転がっている。', '中から何かが動く音がする……。'],
    background: 'images/bg/bg_event.webp',
    object: 'images/objects/obj_bloody_box.png',
    weight: 8,
    enabled: true,
    choices: [
      {
        label: '箱を開ける（運判定）',
        luckCheck: { base: 0.4, perLuck: 0.01, max: 0.9 },
        success: { text: '中には古い薬が入っていた！', outcomes: [{ kind: 'item', itemId: 'potion' }] },
        failure: { text: '中から腐肉ネズミが飛び出した！', outcomes: [{ kind: 'battle' }] },
      },
      {
        label: '立ち去る',
        success: { text: 'あなたは足早にその場を離れた。', outcomes: [{ kind: 'nothing' }] },
      },
    ],
  },
  {
    id: 'dying_soldier',
    title: '瀕死の兵士',
    text: ['壁にもたれかかった兵士が、かすれた声で何かを訴えている。', '「頼む……これを……持って行ってくれ……」'],
    background: 'images/bg/bg_event.webp',
    object: 'images/objects/obj_dying_soldier.png',
    weight: 6,
    enabled: true,
    choices: [
      {
        label: '受け取る',
        success: { text: '兵士は安らかな顔で息を引き取った。鍵を受け取った。', outcomes: [{ kind: 'key', color: 'random' }] },
      },
      {
        label: '止めを刺す（経験値）',
        success: { text: '……あなたは何かを失った気がする。', outcomes: [{ kind: 'exp', amount: 30 }, { kind: 'stat', stat: 'luk', amount: -1 }] },
      },
    ],
  },

  // =========================================================
  // ▼ 全階層で出るイベント
  // =========================================================
  {
    id: 'fallen_adventurer',
    title: '冒険者の亡骸',
    text: ['通路の隅に、自分と同じように塔へ挑んだ者の亡骸がある。', '腰の革袋は、まだ膨らんだままだ。'],
    background: BG,
    object: OBJ.soldier,
    weight: 8,
    enabled: true,
    choices: [
      {
        label: '革袋を漁る（40G）',
        success: { text: '死者に詫びながら、革袋の中身をいただいた。40G を手に入れた。', outcomes: [{ kind: 'gold', amount: 40 }] },
      },
      {
        label: '手を合わせて弔う（運 +1）',
        success: { text: '静かに祈りを捧げると、背中がふっと軽くなった気がした。', outcomes: [{ kind: 'stat', stat: 'luk', amount: 1 }] },
      },
    ],
  },
  {
    id: 'rusty_vending',
    title: '錆びた自販機',
    text: ['こんな場所に、なぜか自動販売機がある。', '電源は生きているらしく、ボタンがひとつだけ赤く光っている。'],
    background: BG,
    weight: 7,
    enabled: true,
    choices: [
      {
        label: '30G を入れてボタンを押す（運判定）',
        requireGold: 30,
        luckCheck: { base: 0.55, perLuck: 0.01, max: 0.95 },
        success: { text: 'ガコン、と音がして回復薬が出てきた。', outcomes: [{ kind: 'gold', amount: -30 }, { kind: 'item', itemId: 'potion' }] },
        failure: { text: '……何も出てこない。金だけ飲み込まれた。', outcomes: [{ kind: 'gold', amount: -30 }] },
      },
      {
        label: '思い切り蹴飛ばす（運判定）',
        luckCheck: { base: 0.3, perLuck: 0.015, max: 0.8 },
        success: { text: '釣り銭口から硬貨がじゃらじゃらと溢れ出た！ 25G を手に入れた。', outcomes: [{ kind: 'gold', amount: 25 }] },
        failure: { text: '自販機がぐらりと傾き、あなたの上に倒れてきた！', outcomes: [{ kind: 'damage', amount: 8 }] },
      },
      leave(),
    ],
  },
  {
    id: 'mirror_self',
    title: '鏡の中の自分',
    text: ['ひび割れた姿見に、自分の姿が映っている。', '……鏡の中の自分だけが、こちらに手招きをしている。'],
    background: BG,
    weight: 6,
    enabled: true,
    choices: [
      {
        label: '鏡に手を伸ばす（運判定）',
        luckCheck: { base: 0.45, perLuck: 0.01, max: 0.85 },
        success: { text: '鏡の自分と手が重なり、力が流れ込んでくる。攻撃力が上がった。', outcomes: [{ kind: 'stat', stat: 'atk', amount: 1 }] },
        failure: { text: '鏡の自分があなたの腕を掴み、爪を立てた！', outcomes: [{ kind: 'damage', amount: 10 }] },
      },
      {
        label: '鏡を叩き割る（戦闘）',
        success: { text: '割れた鏡の破片から、歪んだ何かが這い出してきた！', outcomes: [{ kind: 'battle' }] },
      },
      leave('目を逸らす', 'あなたは鏡を見ないようにして通り過ぎた。背後で、くすくすと笑う声がした。'),
    ],
  },
  {
    id: 'blood_fountain',
    title: '血の泉',
    text: ['石造りの泉から、生温かい赤い液体が湧き出している。', '鉄の匂いが鼻をつく。それでも、なぜか喉が渇く……。'],
    background: BG,
    weight: 6,
    enabled: true,
    choices: [
      {
        label: '飲む（HP 30回復 / 運 -1）',
        success: { text: '体の奥から力が湧いてくる。だが、何か大切なものが濁った気がする。', outcomes: [{ kind: 'heal', amount: 30 }, { kind: 'stat', stat: 'luk', amount: -1 }] },
      },
      {
        label: '腕を浸す（HP -8 / 魔力 +1）',
        success: { text: '腕に血の紋様が刻まれていく。焼けるように痛むが、魔力が高まった。', outcomes: [{ kind: 'damage', amount: 8 }, { kind: 'stat', stat: 'mag', amount: 1 }] },
      },
      leave(),
    ],
  },
  {
    id: 'skeleton_gambler',
    title: '賭博師の骸骨',
    text: ['テーブルについた骸骨が、骨の指でサイコロを転がしている。', '「……一勝負、どうだい。賭け金は 50G だ」'],
    background: BG,
    weight: 6,
    enabled: true,
    choices: [
      {
        label: '50G 賭ける（運判定）',
        requireGold: 50,
        luckCheck: { base: 0.45, perLuck: 0.01, max: 0.8 },
        success: { text: '「……お前の勝ちだ」骸骨はカタカタと笑い、100G を差し出した。', outcomes: [{ kind: 'gold', amount: 50 }] },
        failure: { text: '「残念だったな」骸骨は 50G をかき集め、また一人でサイコロを振り始めた。', outcomes: [{ kind: 'gold', amount: -50 }] },
      },
      {
        label: 'イカサマを見破る（運判定）',
        luckCheck: { base: 0.25, perLuck: 0.015, max: 0.7 },
        success: { text: '骸骨の袖から予備のサイコロが転がり落ちた。「……持っていけ」口止め料に 60G を得た。', outcomes: [{ kind: 'gold', amount: 60 }] },
        failure: { text: '「言いがかりはよくねえなあ」骸骨が立ち上がった！', outcomes: [{ kind: 'battle' }] },
      },
      leave('断る', '「つまらん奴だ」骸骨はそれきり、あなたに興味を失った。'),
    ],
  },
  {
    id: 'caged_voice',
    title: '檻の中の声',
    text: ['布をかけられた小さな檻から、すすり泣く子供の声がする。', '「……出して……ここから出して……」'],
    background: BG,
    weight: 6,
    enabled: true,
    choices: [
      {
        label: '檻を開ける（運判定）',
        luckCheck: { base: 0.5, perLuck: 0.01, max: 0.9 },
        success: { text: '中にいたのは、半透明の小さな子供だった。「ありがとう」と微笑み、光になって消えた。', outcomes: [{ kind: 'stat', stat: 'luk', amount: 2 }] },
        failure: { text: '布の下から現れたのは、子供の声を真似る化け物だった！', outcomes: [{ kind: 'battle' }] },
      },
      leave('聞かなかったことにする', 'あなたは足早に立ち去った。泣き声は、いつまでも背中についてきた。'),
    ],
  },
  {
    id: 'rotten_library',
    title: '朽ちた書庫',
    text: ['湿気で膨らんだ本が、崩れかけた棚に並んでいる。', '一冊だけ、鎖で縛られた黒い本がある。'],
    background: BG,
    weight: 6,
    enabled: true,
    choices: [
      {
        label: '読める本を読み漁る（経験値 +20）',
        success: { text: '塔の怪物について記された手記を見つけた。知識が身についた。', outcomes: [{ kind: 'exp', amount: 20 }] },
      },
      {
        label: '鎖の本を開く（運判定）',
        luckCheck: { base: 0.4, perLuck: 0.01, max: 0.8 },
        success: { text: '頁から黒い文字が浮かび上がり、頭の中に流れ込んできた。', outcomes: [{ kind: 'randomCard' }, { kind: 'stat', stat: 'mag', amount: 1 }] },
        failure: { text: '本が勝手に閉じ、あなたの指を噛みちぎらんばかりに挟み込んだ！', outcomes: [{ kind: 'damage', amount: 12 }] },
      },
      {
        label: '本を枕に少し休む（HP 15回復）',
        success: { text: 'かび臭いが、静かな場所だ。少しだけ眠ることができた。', outcomes: [{ kind: 'heal', amount: 15 }] },
      },
    ],
  },
  {
    id: 'starving_dog',
    title: '痩せた犬',
    text: ['あばら骨の浮いた犬が、こちらをじっと見ている。', '尻尾が、ほんの少しだけ揺れた。'],
    background: BG,
    weight: 6,
    enabled: true,
    choices: [
      {
        label: '撫でてやる（運判定）',
        luckCheck: { base: 0.6, perLuck: 0.01, max: 0.95 },
        success: { text: '犬は嬉しそうに鳴き、どこからか鍵をくわえて戻ってきた。', outcomes: [{ kind: 'key', color: 'random' }] },
        failure: { text: '犬は怯えて、あなたの手に噛みついて逃げていった。', outcomes: [{ kind: 'damage', amount: 5 }] },
      },
      leave('そっとしておく', '犬はしばらくあなたを見送っていた。'),
    ],
  },
  {
    id: 'blood_circle',
    title: '血の魔法陣',
    text: ['床一面に、乾いた血で魔法陣が描かれている。', '中心に立てば、何かが起こりそうだ……。'],
    background: BG,
    object: OBJ.altar,
    weight: 5,
    enabled: true,
    choices: [
      {
        label: '自らの血を捧げる（HP -15 / 魔力 +2）',
        success: { text: '魔法陣が赤く脈打ち、あなたの血を啜った。代わりに、禍々しい力が宿る。', outcomes: [{ kind: 'damage', amount: 15 }, { kind: 'stat', stat: 'mag', amount: 2 }] },
      },
      {
        label: '中心に立つ（運判定）',
        luckCheck: { base: 0.35, perLuck: 0.01, max: 0.75 },
        success: { text: '魔法陣が白く輝き、全身に力がみなぎった！', outcomes: [{ kind: 'stat', stat: 'atk', amount: 1 }, { kind: 'stat', stat: 'def', amount: 1 }, { kind: 'stat', stat: 'mag', amount: 1 }] },
        failure: { text: '魔法陣が黒く染まり、何かを喚び出してしまった！', outcomes: [{ kind: 'battle', elite: true }] },
      },
      {
        label: '魔法陣を消す（経験値 +15）',
        success: { text: '靴底で血の線を削り取った。魔法陣の仕組みが少しわかった気がする。', outcomes: [{ kind: 'exp', amount: 15 }] },
      },
    ],
  },
  {
    id: 'collapsed_floor',
    title: '崩れかけた床',
    text: ['床に大きな穴が開いている。', '穴の底に、宝箱がひとつ見える。飛び降りられない高さではないが……。'],
    background: BG,
    object: OBJ.chest,
    weight: 6,
    enabled: true,
    choices: [
      {
        label: '飛び降りる（運判定）',
        luckCheck: { base: 0.5, perLuck: 0.01, max: 0.9 },
        success: { text: 'うまく着地し、宝箱を開けた。中には 70G が入っていた。', outcomes: [{ kind: 'gold', amount: 70 }] },
        failure: { text: '着地に失敗した。宝箱は空っぽだった……。', outcomes: [{ kind: 'damage', amount: 15 }] },
      },
      leave('迂回する'),
    ],
  },
  {
    id: 'music_box',
    title: '少女のオルゴール',
    text: ['埃をかぶったオルゴールが置かれている。', '蓋には「わたしのたからもの」と、拙い文字で彫られている。'],
    background: BG,
    weight: 6,
    enabled: true,
    choices: [
      {
        label: 'ゼンマイを巻く（HP 25回復）',
        success: { text: '優しい子守唄が流れた。張り詰めていた心がほどけていく。', outcomes: [{ kind: 'heal', amount: 25 }] },
      },
      {
        label: '逆向きに巻く（運判定）',
        luckCheck: { base: 0.4, perLuck: 0.01, max: 0.8 },
        success: { text: '奇妙な旋律が、忘れていた戦い方を思い出させた。', outcomes: [{ kind: 'randomCard' }] },
        failure: { text: '耳をつんざく悲鳴のような音が鳴り響いた！', outcomes: [{ kind: 'damage', amount: 10 }] },
      },
      {
        label: '分解して部品を売る（30G）',
        success: { text: '中の金属部品は意外と上等だった。どこからか、少女の泣き声が聞こえた気がした。', outcomes: [{ kind: 'gold', amount: 30 }, { kind: 'stat', stat: 'luk', amount: -1 }] },
      },
    ],
  },
  {
    id: 'two_doors',
    title: '二つの扉',
    text: ['同じ形をした扉が二つ並んでいる。', '壁には爪で「片方は宝、片方は死」と刻まれている。'],
    background: BG,
    weight: 6,
    enabled: true,
    choices: [
      {
        label: '左の扉を開ける（運判定）',
        luckCheck: { base: 0.5, perLuck: 0.01, max: 0.9 },
        success: { text: '小部屋には金貨と薬が残されていた！', outcomes: [{ kind: 'gold', amount: 50 }, { kind: 'item', itemId: 'potion' }] },
        failure: { text: '扉の裏に仕掛けられた刃が振り下ろされた！', outcomes: [{ kind: 'damage', amount: 18 }] },
      },
      {
        label: '右の扉を開ける（戦闘）',
        success: { text: '扉の向こうで、何かが待ち構えていた！', outcomes: [{ kind: 'battle' }] },
      },
      leave('どちらも開けない', 'あなたは賢明にも、どちらにも触れなかった。'),
    ],
  },
  {
    id: 'puppet_theater',
    title: '無人の人形劇',
    text: ['小さな舞台の上で、糸もないのに人形たちが劇を演じている。', '観客席には、あなたの分の椅子がひとつだけ空いている。'],
    background: BG,
    weight: 5,
    enabled: true,
    choices: [
      {
        label: '最後まで観る（経験値 +20）',
        success: { text: '劇は、塔に挑んで死んでいく騎士の物語だった。多くを学んだ。', outcomes: [{ kind: 'exp', amount: 20 }] },
      },
      {
        label: '人形をひとつ盗む（運判定）',
        luckCheck: { base: 0.45, perLuck: 0.01, max: 0.85 },
        success: { text: '人形の腹を裂くと、閃光弾が詰め込まれていた。', outcomes: [{ kind: 'item', itemId: 'flashbang' }] },
        failure: { text: '人形たちが一斉にこちらを向いた。「上演中のお静かに」', outcomes: [{ kind: 'battle' }] },
      },
      leave('席を立つ', 'あなたが立ち上がると、人形たちは一斉にお辞儀をした。'),
    ],
  },
  {
    id: 'wishing_well',
    title: '願いの井戸',
    text: ['古い井戸の底で、無数の硬貨がきらめいている。', 'ここで願いをかけた者は、少なくないようだ。'],
    background: BG,
    weight: 6,
    enabled: true,
    choices: [
      {
        label: '10G 投げ入れて願う（運判定）',
        requireGold: 10,
        luckCheck: { base: 0.5, perLuck: 0.01, max: 0.9 },
        success: { text: '井戸の底から、ちりん、と澄んだ音が返ってきた。運が向いてきた気がする。', outcomes: [{ kind: 'gold', amount: -10 }, { kind: 'stat', stat: 'luk', amount: 2 }] },
        failure: { text: '硬貨は音もなく闇に消えた。', outcomes: [{ kind: 'gold', amount: -10 }] },
      },
      {
        label: '底の硬貨を拾い集める（45G / 運 -1）',
        success: { text: '冷たい水に腕を突っ込み、硬貨をかき集めた。誰かの願いを奪ってしまった。', outcomes: [{ kind: 'gold', amount: 45 }, { kind: 'stat', stat: 'luk', amount: -1 }] },
      },
      {
        label: '水を飲む（HP 15回復）',
        success: { text: '驚くほど澄んだ水だった。', outcomes: [{ kind: 'heal', amount: 15 }] },
      },
    ],
  },
  {
    id: 'masked_dealer',
    title: '仮面のディーラー',
    text: ['白い仮面をつけた男が、カードの束を扇のように広げている。', '「一枚、引いていきなさい。……二枚でも構いませんよ。代償はいただきますが」'],
    background: BG,
    object: OBJ.darkMerchant,
    weight: 5,
    enabled: true,
    choices: [
      {
        label: '一枚引く（カード +1）',
        success: { text: '「良い引きです」男は満足そうに頷いた。', outcomes: [{ kind: 'randomCard' }] },
      },
      {
        label: '二枚引く（カード +2 / HP -12）',
        success: { text: '「では、代償を」男の指先が触れた箇所から、血が滲んだ。', outcomes: [{ kind: 'randomCard' }, { kind: 'randomCard' }, { kind: 'damage', amount: 12 }] },
      },
      leave('断る', '「賢明ですね」仮面の奥で、男が笑った気がした。'),
    ],
  },
  {
    id: 'cursed_armor',
    title: '呪われた鎧',
    text: ['鎧立てに、傷ひとつない防弾ベストが掛けられている。', '持ち主がいた形跡はない。ただ、内側に古い血がこびりついている。'],
    background: BG,
    weight: 4,
    enabled: true,
    choices: [
      {
        label: '着てみる（運判定）',
        luckCheck: { base: 0.4, perLuck: 0.01, max: 0.85 },
        success: { text: '驚くほど体に馴染んだ。呪いなど、ただの噂だったようだ。', outcomes: [{ kind: 'equipment', equipmentId: 'riot_vest' }] },
        failure: { text: 'ベストが勝手に締まり、肋骨が軋んだ！ 慌てて脱ぎ捨てた。', outcomes: [{ kind: 'damage', amount: 15 }] },
      },
      {
        label: '叩き壊して金具を取る（20G）',
        success: { text: '金具を剥ぎ取った。少しは金になりそうだ。', outcomes: [{ kind: 'gold', amount: 20 }] },
      },
    ],
  },
  {
    id: 'training_dummy',
    title: '動く木人',
    text: ['無数の傷が刻まれた木人が、ひとりでに構えを取った。', 'どうやら、稽古をつけてくれるらしい。'],
    background: BG,
    weight: 5,
    enabled: true,
    choices: [
      {
        label: '本気で打ち合う（HP -12 / 経験値 +30）',
        success: { text: '激しい打ち合いの末、木人は満足したように動きを止めた。', outcomes: [{ kind: 'damage', amount: 12 }, { kind: 'exp', amount: 30 }] },
      },
      {
        label: '守りの型を真似る（運判定）',
        luckCheck: { base: 0.5, perLuck: 0.01, max: 0.9 },
        success: { text: '木人の動きを盗み、受け流しのコツを掴んだ。防御力が上がった。', outcomes: [{ kind: 'stat', stat: 'def', amount: 1 }] },
        failure: { text: '見とれているうちに、木人の一撃をまともに受けた。', outcomes: [{ kind: 'damage', amount: 6 }] },
      },
      leave('一礼して去る', '木人は静かに構えを解いた。'),
    ],
  },
  {
    id: 'sleeping_giant',
    title: '眠る巨人',
    text: ['通路を塞ぐように、巨大な何かが眠っている。', '寝息のたびに、腰に下げた金袋がじゃらりと鳴る。'],
    background: BG,
    weight: 4,
    enabled: true,
    choices: [
      {
        label: '金袋を盗む（運判定）',
        luckCheck: { base: 0.4, perLuck: 0.012, max: 0.85 },
        success: { text: '息を殺して金袋を外した。ずっしりと重い。100G を手に入れた。', outcomes: [{ kind: 'gold', amount: 100 }] },
        failure: { text: '巨人の目が、ゆっくりと開いた……。', outcomes: [{ kind: 'battle', elite: true }] },
      },
      leave('起こさないように通り抜ける', 'あなたは巨人の脇を、つま先立ちで通り抜けた。'),
    ],
  },
  {
    id: 'hanging_cages',
    title: '吊るされた檻',
    text: ['天井から無数の鳥籠が吊るされている。', 'その一つの中で、小さな鍵が光っている。'],
    background: BG,
    weight: 5,
    enabled: true,
    choices: [
      {
        label: '鎖をよじ登る（運判定）',
        luckCheck: { base: 0.55, perLuck: 0.01, max: 0.95 },
        success: { text: '籠の扉をこじ開け、鍵を手に入れた。', outcomes: [{ kind: 'key', color: 'random' }] },
        failure: { text: '鎖が切れ、籠ごと床に叩きつけられた！', outcomes: [{ kind: 'damage', amount: 12 }] },
      },
      leave('諦める'),
    ],
  },
  {
    id: 'lost_wanderer',
    title: '迷い人',
    text: ['ランタンを持った老人が、同じ場所をぐるぐると歩き回っている。', '「出口は……出口はどこかね……」'],
    background: BG,
    weight: 5,
    enabled: true,
    choices: [
      {
        label: '道を教えてやる（経験値 +10 / HP 10回復）',
        success: { text: '「ありがとう、ありがとう」老人は温かいスープを分けてくれた。', outcomes: [{ kind: 'exp', amount: 10 }, { kind: 'heal', amount: 10 }] },
      },
      {
        label: 'ランタンを譲ってもらう（30G）',
        requireGold: 30,
        success: { text: '老人は快くランタンを売ってくれた。灯りの下で、床に転がっていた火炎瓶を見つけた。', outcomes: [{ kind: 'gold', amount: -30 }, { kind: 'item', itemId: 'molotov' }] },
      },
      {
        label: '顔をよく見る',
        success: { text: 'ランタンに照らされた顔には、目も鼻もなかった。老人は笑いながら闇に溶けた。', outcomes: [{ kind: 'stat', stat: 'luk', amount: -1 }, { kind: 'exp', amount: 15 }] },
      },
    ],
  },

  // =========================================================
  // ▼ 地下牢（1F〜40F）
  // =========================================================
  {
    id: 'rat_swarm',
    title: '鼠の大群',
    text: ['足元を黒い波が流れていく。おびただしい数の鼠だ。', '群れの先頭で、ひときわ大きな鼠がこちらを睨んでいる。'],
    background: BG,
    weight: 6,
    maxFloor: 40,
    enabled: true,
    choices: [
      {
        label: '金貨をばらまいて気を引く（20G）',
        requireGold: 20,
        success: { text: '鼠たちが金貨に群がっている隙に、通り抜けた。', outcomes: [{ kind: 'gold', amount: -20 }] },
      },
      {
        label: '群れを突っ切る（HP -10）',
        success: { text: '無数の小さな歯に噛まれながら、なんとか抜け出した。', outcomes: [{ kind: 'damage', amount: 10 }] },
      },
      {
        label: '鼠の王に挑む（戦闘）',
        success: { text: '大鼠が甲高く鳴き、群れが一斉に襲いかかってきた！', outcomes: [{ kind: 'battle' }] },
      },
    ],
  },
  {
    id: 'chained_prisoner',
    title: '鎖に繋がれた囚人',
    text: ['壁に鎖で繋がれた男が、うつろな目でこちらを見上げた。', '「……鍵を……鎖の鍵を、壊してくれ……」'],
    background: BG,
    object: OBJ.soldier,
    weight: 6,
    maxFloor: 40,
    enabled: true,
    choices: [
      {
        label: '鎖を壊してやる（運判定）',
        luckCheck: { base: 0.55, perLuck: 0.01, max: 0.9 },
        success: { text: '「恩に着る」男は礼として、隠し持っていた鍵をくれた。', outcomes: [{ kind: 'key', color: 'random' }, { kind: 'exp', amount: 10 }] },
        failure: { text: '自由になった男の目が、獣のように光った！', outcomes: [{ kind: 'battle' }] },
      },
      {
        label: '持ち物を奪う（30G / 運 -1）',
        success: { text: '男は抵抗できなかった。罵声を背に、あなたは立ち去った。', outcomes: [{ kind: 'gold', amount: 30 }, { kind: 'stat', stat: 'luk', amount: -1 }] },
      },
      leave('見捨てる', '「待ってくれ……」声はすぐに聞こえなくなった。'),
    ],
  },
  {
    id: 'torture_rack',
    title: '拷問台',
    text: ['錆びた拷問台に、まだ新しい血が残っている。', '台の下に、看守のものらしき道具箱が置き忘れられている。'],
    background: BG,
    object: OBJ.box,
    weight: 5,
    maxFloor: 40,
    enabled: true,
    choices: [
      {
        label: '道具箱を開ける（運判定）',
        luckCheck: { base: 0.5, perLuck: 0.01, max: 0.9 },
        success: { text: '中には救急スプレーが入っていた。看守たちも怪我が多かったらしい。', outcomes: [{ kind: 'item', itemId: 'first_aid_spray' }] },
        failure: { text: '箱には罠が仕掛けられていた！ 毒針が指に刺さった。', outcomes: [{ kind: 'damage', amount: 10 }] },
      },
      {
        label: '拷問台に横たわってみる（HP -10 / 体力 +1）',
        success: { text: '骨が軋むほど体を引き伸ばされた。地獄のような痛みの後、体が一回り頑丈になった気がする。', outcomes: [{ kind: 'damage', amount: 10 }, { kind: 'stat', stat: 'hp', amount: 1 }] },
      },
      leave(),
    ],
  },

  // =========================================================
  // ▼ 研究棟（21F〜60F）
  // =========================================================
  {
    id: 'surgery_machine',
    title: '自動手術台',
    text: ['手術台の上で、無数のアームを持つ機械が待機している。', 'モニターには「被験者ヲ 寝台ヘ」と表示されている。'],
    background: BG,
    weight: 6,
    minFloor: 21,
    maxFloor: 60,
    enabled: true,
    choices: [
      {
        label: '身を委ねる（運判定）',
        luckCheck: { base: 0.45, perLuck: 0.01, max: 0.85 },
        success: { text: '「施術完了」目を覚ますと、体の奥に新しい力が宿っていた。', outcomes: [{ kind: 'stat', stat: 'hp', amount: 2 }] },
        failure: { text: '「エラー。エラー。エラー」アームが暴走し、あなたを切り刻んだ！', outcomes: [{ kind: 'damage', amount: 20 }] },
      },
      {
        label: '部品を剥ぎ取る（45G）',
        success: { text: '高価そうな部品をいくつか外した。機械は最後に「イタイ」と表示して停止した。', outcomes: [{ kind: 'gold', amount: 45 }] },
      },
      leave(),
    ],
  },
  {
    id: 'specimen_jar',
    title: '標本瓶',
    text: ['緑色に光る液体の中に、何かの臓器が浮かんでいる。', 'ラベルには「被検体7号 ─ 再生能力 極メテ高シ」とある。'],
    background: BG,
    weight: 6,
    minFloor: 21,
    maxFloor: 60,
    enabled: true,
    choices: [
      {
        label: '液体を飲む（運判定）',
        luckCheck: { base: 0.4, perLuck: 0.01, max: 0.8 },
        success: { text: '全身が熱くなり、傷がみるみる塞がっていく！', outcomes: [{ kind: 'heal', amount: 40 }, { kind: 'stat', stat: 'mag', amount: 1 }] },
        failure: { text: '激しい吐き気に襲われた。体の中で何かが暴れている……。', outcomes: [{ kind: 'damage', amount: 12 }] },
      },
      {
        label: '瓶を割って液体を採取する',
        success: { text: '液体を小瓶に移した。どう見ても毒だが、使い道はありそうだ。', outcomes: [{ kind: 'item', itemId: 'poison_vial' }] },
      },
      leave(),
    ],
  },
  {
    id: 'medicine_cabinet',
    title: '薬品棚',
    text: ['研究員の休憩室らしい部屋に、鍵の壊れた薬品棚がある。', 'ラベルの剥がれた瓶が、色とりどりに並んでいる。'],
    background: BG,
    weight: 6,
    minFloor: 21,
    maxFloor: 60,
    enabled: true,
    choices: [
      {
        label: '赤い瓶を飲む（HP 30回復）',
        success: { text: 'ただの栄養剤だった。だが、今はそれがありがたい。', outcomes: [{ kind: 'heal', amount: 30 }] },
      },
      {
        label: '青い瓶を飲む（運判定）',
        luckCheck: { base: 0.5, perLuck: 0.01, max: 0.9 },
        success: { text: '皮膚が硬質化していく。防御力が上がった。', outcomes: [{ kind: 'stat', stat: 'def', amount: 1 }] },
        failure: { text: '舌が痺れ、視界が回る……。', outcomes: [{ kind: 'damage', amount: 8 }] },
      },
      {
        label: '棚ごと漁る（運判定）',
        luckCheck: { base: 0.35, perLuck: 0.01, max: 0.8 },
        success: { text: '使えそうな薬をいくつか見つけた。', outcomes: [{ kind: 'item', itemId: 'potion' }, { kind: 'item', itemId: 'stimulant' }] },
        failure: { text: '棚が倒れてきて、割れた瓶の薬品を浴びてしまった！', outcomes: [{ kind: 'damage', amount: 15 }] },
      },
    ],
  },

  // =========================================================
  // ▼ 礼拝堂（41F〜80F）
  // =========================================================
  {
    id: 'confession_booth',
    title: '懺悔室',
    text: ['朽ちた懺悔室の格子窓の向こうに、誰かが座っている気配がする。', '「……罪を、告白なさい」'],
    background: BG,
    weight: 6,
    minFloor: 41,
    maxFloor: 80,
    enabled: true,
    choices: [
      {
        label: '罪を告白する（HP 35回復）',
        success: { text: '「赦しましょう」柔らかな声とともに、温かな光が降り注いだ。', outcomes: [{ kind: 'heal', amount: 35 }] },
      },
      {
        label: '格子の向こうを覗く（運判定）',
        luckCheck: { base: 0.4, perLuck: 0.01, max: 0.8 },
        success: { text: '誰もいなかった。代わりに、献金箱が置かれていた。80G を手に入れた。', outcomes: [{ kind: 'gold', amount: 80 }] },
        failure: { text: '格子の向こうの「それ」と、目が合った。', outcomes: [{ kind: 'battle', elite: true }] },
      },
      leave('黙って去る', '「……また、来なさい」声は、どこか寂しげだった。'),
    ],
  },
  {
    id: 'weeping_statue',
    title: '涙を流す聖像',
    text: ['ひび割れた聖女像の両目から、赤い涙が流れ続けている。', '両目には、大粒の宝石がはめ込まれている。'],
    background: BG,
    weight: 5,
    minFloor: 41,
    maxFloor: 80,
    enabled: true,
    choices: [
      {
        label: '涙を受ける（HP 40回復）',
        success: { text: '涙に触れた傷が、跡形もなく消えていった。', outcomes: [{ kind: 'heal', amount: 40 }] },
      },
      {
        label: '宝石の目を抉り取る（120G / 運 -2）',
        success: { text: '宝石を手に入れた。聖像の慟哭が、礼拝堂に響き渡った。', outcomes: [{ kind: 'gold', amount: 120 }, { kind: 'stat', stat: 'luk', amount: -2 }] },
      },
      {
        label: '祈りを捧げる（運判定）',
        luckCheck: { base: 0.45, perLuck: 0.01, max: 0.85 },
        success: { text: '聖像が微笑んだ気がした。加護が身を包む。', outcomes: [{ kind: 'stat', stat: 'def', amount: 1 }, { kind: 'stat', stat: 'mag', amount: 1 }] },
        failure: { text: '何も起こらなかった。', outcomes: NOTHING },
      },
    ],
  },
  {
    id: 'bell_rope',
    title: '鐘楼の綱',
    text: ['天井の闇から、太い綱が一本垂れ下がっている。', '遥か上の鐘楼に繋がっているらしい。'],
    background: BG,
    weight: 5,
    minFloor: 41,
    maxFloor: 80,
    enabled: true,
    choices: [
      {
        label: '綱を引く（運判定）',
        luckCheck: { base: 0.5, perLuck: 0.01, max: 0.9 },
        success: { text: '清らかな鐘の音が響き渡り、塔の闇がわずかに退いた。', outcomes: [{ kind: 'stat', stat: 'luk', amount: 2 }, { kind: 'heal', amount: 15 }] },
        failure: { text: '鐘の音に、何か大きなものが目を覚ました……。', outcomes: [{ kind: 'battle', elite: true }] },
      },
      leave('触らない'),
    ],
  },

  // =========================================================
  // ▼ 機関区画（61F〜100F）
  // =========================================================
  {
    id: 'runaway_boiler',
    title: '暴走するボイラー',
    text: ['巨大なボイラーが、悲鳴のような音を立てて蒸気を噴き出している。', '圧力計の針は、とっくに赤い目盛りを振り切っている。'],
    background: BG,
    weight: 6,
    minFloor: 61,
    enabled: true,
    choices: [
      {
        label: 'バルブを閉める（運判定）',
        luckCheck: { base: 0.5, perLuck: 0.01, max: 0.9 },
        success: { text: 'なんとか暴走を止めた。制御盤の裏に、整備士の給金が隠されていた。', outcomes: [{ kind: 'gold', amount: 80 }, { kind: 'exp', amount: 30 }] },
        failure: { text: 'バルブが吹き飛び、高温の蒸気をまともに浴びた！', outcomes: [{ kind: 'damage', amount: 25 }] },
      },
      {
        label: '炎で武器を鍛え直す（HP -15 / 攻撃力 +2）',
        success: { text: '熱に焼かれながら、武器を打ち直した。鋭さが増した。', outcomes: [{ kind: 'damage', amount: 15 }, { kind: 'stat', stat: 'atk', amount: 2 }] },
      },
      leave('逃げる', 'あなたが走り去った直後、背後で爆音が轟いた。'),
    ],
  },
  {
    id: 'scrap_heap',
    title: 'スクラップの山',
    text: ['壊れた機械が山のように積み上げられている。', '中には、まだ動いているものもあるようだ。'],
    background: BG,
    weight: 6,
    minFloor: 61,
    enabled: true,
    choices: [
      {
        label: '使えそうな物を探す（運判定）',
        luckCheck: { base: 0.5, perLuck: 0.01, max: 0.9 },
        success: { text: '山の中から、まだ使える弾薬と換金できそうな部品を掘り出した！', outcomes: [{ kind: 'gold', amount: 60 }, { kind: 'item', itemId: 'handgun_ammo' }] },
        failure: { text: 'スクラップの山が崩れ、生き埋めになりかけた！', outcomes: [{ kind: 'damage', amount: 18 }] },
      },
      {
        label: '動いている機械を叩き起こす（戦闘）',
        success: { text: 'スクラップの山が身を起こした。それは山ではなく、一体の機械だった！', outcomes: [{ kind: 'battle', elite: true }] },
      },
      leave(),
    ],
  },

  // =========================================================
  // ▼ 深淵（81F〜）
  // =========================================================
  {
    id: 'abyss_whisper',
    title: '深淵の囁き',
    text: ['足元に、底の見えない裂け目が口を開けている。', '裂け目の奥から、あなたの名前を呼ぶ声がする。'],
    background: BG,
    weight: 7,
    minFloor: 81,
    enabled: true,
    choices: [
      {
        label: '声に応える（魔力 +3 / 体力 -1）',
        success: { text: '深淵の力が流れ込んでくる。代わりに、体の一部が冷たくなった。', outcomes: [{ kind: 'stat', stat: 'mag', amount: 3 }, { kind: 'stat', stat: 'hp', amount: -1 }] },
      },
      {
        label: '深淵を覗き込む（運判定）',
        luckCheck: { base: 0.3, perLuck: 0.01, max: 0.75 },
        success: { text: '深淵の奥底に、塔の真実の一端を見た。', outcomes: [{ kind: 'randomCard' }, { kind: 'randomCard' }, { kind: 'exp', amount: 60 }] },
        failure: { text: '深淵もまた、あなたを覗き込んでいた。', outcomes: [{ kind: 'damage', amount: 30 }] },
      },
      {
        label: '耳を塞いで進む（HP 20回復）',
        success: { text: '声を振り切ると、不思議と体が軽くなっていた。', outcomes: [{ kind: 'heal', amount: 20 }] },
      },
    ],
  },
  {
    id: 'previous_self',
    title: 'かつての自分',
    text: ['行く手に、自分とまったく同じ装備の亡骸が倒れている。', '握りしめた手帳には、あなたの筆跡でこう書かれていた。「次こそは」'],
    background: BG,
    object: OBJ.soldier,
    weight: 5,
    minFloor: 81,
    enabled: true,
    choices: [
      {
        label: '手帳を読む（経験値 +60）',
        success: { text: '何度も繰り返された挑戦の記録だった。その全てが、今のあなたの糧になる。', outcomes: [{ kind: 'exp', amount: 60 }] },
      },
      {
        label: '亡骸の装備を受け継ぐ',
        success: { text: '「……頼んだぞ」そんな声が聞こえた気がした。', outcomes: [{ kind: 'equipment', equipmentId: 'dog_tag' }, { kind: 'gold', amount: 50 }] },
      },
    ],
  },
];

/** イベントを追加・上書きする（開発メニュー / Firebase から） */
export function upsertEvents(defs: EventDef[]): void {
  for (const d of defs) {
    const i = EVENTS.findIndex((e) => e.id === d.id);
    if (i >= 0) EVENTS[i] = d;
    else EVENTS.push(d);
  }
}

/** イベントを取り除く */
export function removeEvents(ids: string[]): void {
  for (const id of ids) {
    const i = EVENTS.findIndex((e) => e.id === id);
    if (i >= 0) EVENTS.splice(i, 1);
  }
}

export function getEvent(id: string): EventDef {
  const e = EVENTS.find((x) => x.id === id);
  if (!e) throw new Error(`Unknown event id: ${id}`);
  return e;
}
