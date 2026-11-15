// =============================================================
// floors.ts  【データ：塔のゾーン（20Fごと）・背景・セリフ】
// -------------------------------------------------------------
// 塔は 20F ごとに「ゾーン」が切り替わり、背景・BGM・出現する敵が変わる。
// 1F の固定セリフ（帰る・祈る など）もここで管理する。
// =============================================================
import type { RouteType } from '@/model/types';

export interface ZoneDef {
  /** ゾーン番号（1～5） */
  zone: number;
  name: string;
  /** 探索画面（2択を選ぶ画面）の背景 */
  floorBackground: string;
  /** 戦闘画面の背景 */
  battleBackground: string;
  /** 探索中のBGM（data/audio.ts のキー） */
  bgm: string;
  /** 階に入った時に流れる短い描写（ランダムで1つ） */
  flavor: string[];
}

export const ZONES: ZoneDef[] = [
  {
    zone: 1, name: '塔の下層・地下牢',
    floorBackground: 'images/bg/bg_tower_zone1.webp', battleBackground: 'images/bg/bg_battle_zone1.webp', bgm: 'bgm_tower',
    flavor: ['湿った石壁から、水の滴る音が響いている。', '錆びた鉄格子の向こうで、何かが動いた気がした。', '血の匂いが鼻をつく……。'],
  },
  {
    zone: 2, name: '研究棟',
    floorBackground: 'images/bg/bg_tower_zone2.webp', battleBackground: 'images/bg/bg_battle_zone2.webp', bgm: 'bgm_tower',
    flavor: ['割れた培養槽が並んでいる。中身はどこへ行ったのか。', '消毒液と腐臭が混じった空気が漂う。', '壁に爪で引っ掻いたような文字が刻まれている。'],
  },
  {
    zone: 3, name: '礼拝堂',
    floorBackground: 'images/bg/bg_tower_zone3.webp', battleBackground: 'images/bg/bg_battle_zone3.webp', bgm: 'bgm_tower',
    flavor: ['ステンドグラスから赤い光が差し込んでいる。', 'どこからか聖歌が聞こえる……誰もいないのに。', '祭壇の蝋燭が、ひとりでに灯った。'],
  },
  {
    zone: 4, name: '機関区画',
    floorBackground: 'images/bg/bg_tower_zone4.webp', battleBackground: 'images/bg/bg_battle_zone4.webp', bgm: 'bgm_tower',
    flavor: ['巨大な歯車が軋みながら回っている。', '蒸気が噴き出し、視界が白く霞む。', '焼け焦げた何かが、まだ燻っている。'],
  },
  {
    zone: 5, name: '頂上・深淵',
    floorBackground: 'images/bg/bg_tower_zone5.webp', battleBackground: 'images/bg/bg_battle_zone5.webp', bgm: 'bgm_tower',
    flavor: ['壁が脈打っている。この塔は……生きている。', '足元に無数の眼が開き、こちらを見ている。', '頂上は近い。だが、空気が重い。'],
  },
];

export function getZone(zone: number): ZoneDef {
  return ZONES[Math.min(ZONES.length, Math.max(1, zone)) - 1];
}

// -------------------------------------------------------------
// 1F（塔の入口）
// -------------------------------------------------------------
export const FIRST_FLOOR = {
  background: 'images/bg/bg_tower_1f.webp',
  intro: [
    '……気がつくと、私は巨大な塔の中に立っていた。',
    '背後の扉は固く閉ざされ、前には上へと続く扉がひとつ。',
    '生き延びるには、登るしかない。',
  ],
  /** 「帰る」を選んだ時に怒られるセリフ（ランダム） */
  goHomeScold: [
    '「……帰る？ どこへだ。お前に帰る場所などない」\nどこからか冷たい声が響いた。',
    '入ってきた扉を押してみた。……びくともしない。\n「逃げるな。登れ」と、誰かが囁いた。',
    '「臆病者め！」\n天井から怒声が降ってきた。扉は開かない。',
  ],
  /** 「祈る」を選んだ時のセリフ */
  pray: '静かに目を閉じ、祈りを捧げた。\n……特に何も起きなかった……神はいないのか……',
  /** 「探索する」で隠し通路を見つけた時 */
  explore: '壁を調べていると、一部の石がわずかに動いた。\n……隠し通路だ！ 奥へと続いている。',
  exploreConfirm: '隠し通路に進みますか？',
};

// -------------------------------------------------------------
// 2F以降の選択肢（扉）の見た目
// -------------------------------------------------------------
export const ROUTE_VISUALS: Record<RouteType, { label: string; description: string; image: string }> = {
  battle: { label: '戦闘', description: '敵の気配がする。', image: 'images/objects/door_battle.png' },
  elite: { label: '戦闘（危険）', description: '強烈な殺気を感じる……。', image: 'images/objects/door_elite.png' },
  event: { label: 'イベント', description: '何かが起こりそうだ。', image: 'images/objects/door_event.png' },
  shop: { label: 'ショップ', description: '灯りが漏れている。商人がいるようだ。', image: 'images/objects/door_shop.png' },
  boss: { label: 'ボス', description: 'この先に、この区画の主がいる。', image: 'images/objects/door_boss.png' },
  hidden: { label: '隠し通路', description: '壁の隙間から冷たい風が吹いている。', image: 'images/objects/door_hidden.png' },
};
