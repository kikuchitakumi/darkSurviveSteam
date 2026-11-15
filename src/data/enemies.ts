// =============================================================
// enemies.ts  【データ：敵（通常・強敵・ボス）】
// -------------------------------------------------------------
// ★敵を追加したい時はこのファイルに1件追加するだけでよい。
//
//  - kind     : normal(通常) / elite(強敵) / boss(ボス)
//  - zones    : 出現ゾーン（1:1-20F / 2:21-40F / 3:41-60F / 4:61-80F / 5:81-100F）
//  - bossFloor: ボスの出現階（10,20,...,100）
//  - hp       : 「1F相当」の HP。実際は階数倍率（balance.ts）が掛かる
//  - pattern  : cycle(上から順番に行動) / random(weight の重みでランダム)
//  - actions  : 行動リスト。intent は意図アイコンの種類
//               attack(攻撃) / debuff(デバフ) / buff(バフ) / block(ブロック) / special(特殊)
//  - 数値（攻撃力・ブロック量）も「1F相当」で書く。階数倍率が掛かる。
//    ※状態異常の量（毒3など）には倍率は掛からない。
//
// 強敵は「同じフロアの通常敵の倍の強さ」になるよう、
// balance.ts の ELITE_HP_MULTIPLIER / ELITE_DMG_MULTIPLIER が掛かる。
// =============================================================
import type { EnemyActionDef, EnemyDef, StatusId } from '@/model/types';

// ---- 行動を短く書くための補助関数 ----
const atk = (id: string, name: string, amount: number, hits = 1, weight = 1): EnemyActionDef => ({
  id, name, intent: 'attack', weight, effects: [{ kind: 'attack', amount, hits }],
});
const blk = (id: string, name: string, amount: number, weight = 1): EnemyActionDef => ({
  id, name, intent: 'block', weight, effects: [{ kind: 'block', amount }],
});
const debuff = (id: string, name: string, status: StatusId, amount: number, weight = 1): EnemyActionDef => ({
  id, name, intent: 'debuff', weight, effects: [{ kind: 'status', status, amount, target: 'player' }],
});
const buff = (id: string, name: string, status: StatusId, amount: number, weight = 1): EnemyActionDef => ({
  id, name, intent: 'buff', weight, effects: [{ kind: 'status', status, amount, target: 'self' }],
});

export const ENEMIES: EnemyDef[] = [
  // =========================================================
  // ゾーン1（1F～20F）：塔の下層・地下牢
  // =========================================================
  {
    id: 'rot_rat', name: '腐肉ネズミ', description: '腐った肉を好む巨大なネズミ。群れで現れる。',
    kind: 'normal', zones: [1], hp: 9, pattern: 'random', image: 'images/enemies/enemy_rot_rat.png', scale: 0.75,
    actions: [atk('bite', '噛みつき', 3, 1, 3), debuff('disease', '病原菌', 'weak', 1, 1)],
  },
  {
    id: 'crawler', name: '這いずる者', description: '下半身を失ってなお、獲物を求めて這い回る。',
    kind: 'normal', zones: [1], hp: 14, pattern: 'cycle', image: 'images/enemies/enemy_crawler.png',
    actions: [atk('grab', '掴みかかる', 4), atk('bite', '喰らいつく', 6), blk('crouch', 'うずくまる', 4)],
  },
  {
    id: 'rusted_sentry', name: '錆びた番兵', description: '塔を守る為に作られた機械仕掛けの兵士。',
    kind: 'normal', zones: [1, 2], hp: 16, pattern: 'cycle', image: 'images/enemies/enemy_rusted_sentry.png',
    actions: [blk('guard', '防御態勢', 5), atk('halberd', '斧槍の一撃', 7)],
  },
  {
    id: 'iron_jailer', name: '鉄仮面の看守', description: '囚人を拷問し続けた看守の成れの果て。',
    kind: 'elite', zones: [1], hp: 22, pattern: 'cycle', image: 'images/enemies/elite_iron_jailer.png', scale: 1.15,
    actions: [
      atk('chain', '鎖鞭', 3, 2),
      debuff('shackle', '枷をはめる', 'frail', 2),
      { id: 'torture', name: '拷問', intent: 'attack', effects: [{ kind: 'attack', amount: 6 }, { kind: 'status', status: 'vulnerable', amount: 1, target: 'player' }] },
    ],
  },

  // =========================================================
  // ゾーン2（21F～40F）：研究棟
  // =========================================================
  {
    id: 'specimen7', name: '実験体No.7', description: '投薬実験で肥大化した被験者。',
    kind: 'normal', zones: [2], hp: 15, pattern: 'random', image: 'images/enemies/enemy_specimen7.png',
    actions: [atk('smash', '叩き潰す', 7, 1, 2), buff('mutate', '変異', 'strength', 2, 1)],
  },
  {
    id: 'vat_leech', name: '培養液の蛭', description: '培養槽から逃げ出した巨大な蛭。血を吸って再生する。',
    kind: 'normal', zones: [2], hp: 12, pattern: 'cycle', image: 'images/enemies/enemy_vat_leech.png', scale: 0.85,
    actions: [
      { id: 'drain', name: '吸血', intent: 'attack', effects: [{ kind: 'attack', amount: 4 }, { kind: 'heal', amount: 3 }] },
      debuff('acid', '酸を吐く', 'poison', 3),
    ],
  },
  {
    id: 'labcoat_revenant', name: '白衣の亡者', description: '実験の記録を探し続ける研究者の亡霊。',
    kind: 'normal', zones: [2, 3], hp: 13, pattern: 'cycle', image: 'images/enemies/enemy_labcoat_revenant.png',
    actions: [debuff('inject', '注射', 'weak', 2), atk('scalpel', 'メス', 3, 2), blk('notes', '記録を守る', 5)],
  },
  {
    id: 'failed_chimera', name: '失敗作キメラ', description: '複数の生物を継ぎ接ぎした失敗作。制御不能。',
    kind: 'elite', zones: [2], hp: 26, pattern: 'cycle', image: 'images/enemies/elite_failed_chimera.png', scale: 1.2,
    actions: [
      atk('maul', '引き裂く', 4, 2),
      buff('roar', '咆哮', 'strength', 3),
      { id: 'rampage', name: '暴走', intent: 'special', effects: [{ kind: 'attack', amount: 10 }, { kind: 'status', status: 'vulnerable', amount: 1, target: 'self' }] },
    ],
  },

  // =========================================================
  // ゾーン3（41F～60F）：礼拝堂
  // =========================================================
  {
    id: 'praying_corpse', name: '祈る屍', description: '祈りの姿勢のまま動き出した死体。',
    kind: 'normal', zones: [3], hp: 15, pattern: 'cycle', image: 'images/enemies/enemy_praying_corpse.png',
    actions: [blk('pray', '祈り', 6), atk('strangle', '絞め上げる', 8)],
  },
  {
    id: 'candle_wraith', name: '蝋燭の亡霊', description: '消えかけた蝋燭に宿る怨念。',
    kind: 'normal', zones: [3], hp: 10, pattern: 'random', image: 'images/enemies/enemy_candle_wraith.png', scale: 0.8,
    actions: [atk('flame', '鬼火', 5, 1, 2), debuff('curse', '呪詛', 'vulnerable', 2, 1)],
  },
  {
    id: 'black_zealot', name: '黒衣の信徒', description: '塔の頂に神がいると信じる狂信者。',
    kind: 'normal', zones: [3, 4], hp: 16, pattern: 'cycle', image: 'images/enemies/enemy_black_zealot.png',
    actions: [
      { id: 'hymn', name: '狂信の讃歌', intent: 'buff', effects: [{ kind: 'status', status: 'strength', amount: 2, target: 'allAllies' }] },
      atk('sacrifice_knife', '生贄の刃', 7),
    ],
  },
  {
    id: 'choir_heads', name: '聖歌隊の首', description: '切り落とされた首が今も聖歌を歌い続けている。',
    kind: 'elite', zones: [3], hp: 28, pattern: 'cycle', image: 'images/enemies/elite_choir_heads.png', scale: 1.15,
    actions: [
      { id: 'dirge', name: '葬送歌', intent: 'debuff', effects: [{ kind: 'status', status: 'weak', amount: 2, target: 'player' }, { kind: 'status', status: 'frail', amount: 2, target: 'player' }] },
      atk('scream', '絶叫', 3, 3),
      { id: 'chorus', name: '合唱', intent: 'buff', effects: [{ kind: 'status', status: 'strength', amount: 2, target: 'self' }, { kind: 'block', amount: 8 }] },
    ],
  },

  // =========================================================
  // ゾーン4（61F～80F）：機関区画
  // =========================================================
  {
    id: 'cog_hound', name: '歯車の犬', description: '歯車と肉で組み上げられた番犬。',
    kind: 'normal', zones: [4], hp: 14, pattern: 'random', image: 'images/enemies/enemy_cog_hound.png', scale: 0.9,
    actions: [atk('bite', '噛み砕く', 4, 2, 2), blk('spin', '回転防御', 6, 1)],
  },
  {
    id: 'steam_husk', name: '蒸気の亡骸', description: '全身から高温の蒸気を噴き出す死体。',
    kind: 'normal', zones: [4], hp: 18, pattern: 'cycle', image: 'images/enemies/enemy_steam_husk.png',
    actions: [debuff('scald', '蒸気噴射', 'weak', 2), atk('burst', '破裂', 9)],
  },
  {
    id: 'hanged_marionette', name: '吊るされた人形', description: '天井から吊られた等身大の操り人形。',
    kind: 'normal', zones: [4, 5], hp: 13, pattern: 'cycle', image: 'images/enemies/enemy_hanged_marionette.png',
    actions: [atk('strings', '糸の斬撃', 2, 4), debuff('entangle', '絡みつく糸', 'frail', 2)],
  },
  {
    id: 'incinerator_keeper', name: '焼却炉の主', description: '全てを燃やし尽くす焼却炉の管理者。',
    kind: 'elite', zones: [4], hp: 32, pattern: 'cycle', image: 'images/enemies/elite_incinerator_keeper.png', scale: 1.25,
    actions: [
      blk('stoke', '炉に薪をくべる', 10),
      atk('furnace', '業火', 13),
      { id: 'ash', name: '灰を撒く', intent: 'debuff', effects: [{ kind: 'status', status: 'poison', amount: 4, target: 'player' }, { kind: 'status', status: 'weak', amount: 1, target: 'player' }] },
    ],
  },

  // =========================================================
  // ゾーン5（81F～100F）：頂上・深淵
  // =========================================================
  {
    id: 'shade_eater', name: '影喰い', description: '光を喰らい、影の中から襲いかかる。',
    kind: 'normal', zones: [5], hp: 17, pattern: 'random', image: 'images/enemies/enemy_shade_eater.png',
    actions: [atk('devour', '捕食', 8, 1, 2), debuff('darkness', '闇', 'vulnerable', 2, 1)],
  },
  {
    id: 'eye_swarm', name: '眼の群れ', description: '無数の眼球が一つの意志で蠢いている。',
    kind: 'normal', zones: [5], hp: 12, pattern: 'cycle', image: 'images/enemies/enemy_eye_swarm.png', scale: 0.9,
    actions: [debuff('gaze', '凝視', 'weak', 2), atk('beam', '視線', 3, 3)],
  },
  {
    id: 'empty_armor', name: '虚ろな甲冑', description: '中身のない甲冑。かつての勇者のものだという。',
    kind: 'normal', zones: [5], hp: 20, pattern: 'cycle', image: 'images/enemies/enemy_empty_armor.png',
    actions: [blk('shield', '大盾', 8), atk('greatsword', '大剣', 11)],
  },
  {
    id: 'tower_spawn', name: '塔の落とし子', description: '塔そのものが産み落とした異形。',
    kind: 'elite', zones: [5], hp: 36, pattern: 'cycle', image: 'images/enemies/elite_tower_spawn.png', scale: 1.3,
    actions: [
      atk('tentacle', '触手', 5, 3),
      { id: 'absorb', name: '吸収', intent: 'special', effects: [{ kind: 'attack', amount: 8 }, { kind: 'heal', amount: 8 }] },
      { id: 'shriek', name: '産声', intent: 'debuff', effects: [{ kind: 'status', status: 'vulnerable', amount: 2, target: 'player' }, { kind: 'status', status: 'frail', amount: 2, target: 'player' }] },
    ],
  },

  // =========================================================
  // ボス（10Fごと）
  // hp・攻撃値は「1F相当」なので、実際は階数倍率で大きくなる。
  // =========================================================
  {
    id: 'boss_flesh_warden', name: '肉塊の番人', description: '下層への侵入者を阻む、巨大な肉の塊。',
    kind: 'boss', zones: [1], bossFloor: 10, hp: 44, pattern: 'cycle', image: 'images/enemies/boss_flesh_warden.png', scale: 1.5,
    actions: [
      atk('slam', '叩きつけ', 7),
      blk('harden', '硬化', 8),
      { id: 'crush', name: '圧し潰す', intent: 'special', effects: [{ kind: 'attack', amount: 5, hits: 2 }, { kind: 'status', status: 'weak', amount: 1, target: 'player' }] },
    ],
  },
  {
    id: 'boss_stitched_nurse', name: '縫われた看護婦', description: '患者を「治療」し続ける看護婦。その手術は終わらない。',
    kind: 'boss', zones: [1], bossFloor: 20, hp: 46, pattern: 'cycle', image: 'images/enemies/boss_stitched_nurse.png', scale: 1.4,
    actions: [
      debuff('anesthesia', '麻酔', 'weak', 2),
      atk('scalpels', 'メスの雨', 3, 4),
      { id: 'suture', name: '縫合', intent: 'buff', effects: [{ kind: 'heal', amount: 10 }, { kind: 'block', amount: 8 }] },
    ],
  },
  {
    id: 'boss_writhing_researcher', name: '蠢く研究者', description: '自らを実験台にした主任研究者。体内で何かが蠢く。',
    kind: 'boss', zones: [2], bossFloor: 30, hp: 48, pattern: 'cycle', image: 'images/enemies/boss_writhing_researcher.png', scale: 1.45,
    actions: [
      { id: 'summon', name: '実験体を解放', intent: 'special', effects: [{ kind: 'summon', enemyId: 'vat_leech' }] },
      atk('tendril', '触腕', 6, 2),
      debuff('serum', '変異血清', 'poison', 5),
    ],
  },
  {
    id: 'boss_twin_hound', name: '双頭の猟犬', description: '二つの頭を持つ巨大な猟犬。獲物を逃さない。',
    kind: 'boss', zones: [2], bossFloor: 40, hp: 52, pattern: 'cycle', image: 'images/enemies/boss_twin_hound.png', scale: 1.45,
    actions: [
      atk('twin_bite', '双頭の牙', 6, 2),
      buff('howl', '遠吠え', 'strength', 3),
      { id: 'pounce', name: '飛びかかり', intent: 'attack', effects: [{ kind: 'attack', amount: 14 }, { kind: 'status', status: 'vulnerable', amount: 1, target: 'player' }] },
    ],
  },
  {
    id: 'boss_belfry_wraith', name: '鐘楼の亡霊', description: '鐘を鳴らすたびに、誰かが死ぬという。',
    kind: 'boss', zones: [3], bossFloor: 50, hp: 50, pattern: 'cycle', image: 'images/enemies/boss_belfry_wraith.png', scale: 1.5,
    actions: [
      { id: 'toll', name: '弔鐘', intent: 'debuff', effects: [{ kind: 'status', status: 'weak', amount: 2, target: 'player' }, { kind: 'status', status: 'frail', amount: 2, target: 'player' }] },
      atk('wail', '嘆き', 4, 3),
      { id: 'phase', name: '霊体化', intent: 'block', effects: [{ kind: 'block', amount: 14 }] },
      atk('reap', '刈り取り', 15),
    ],
  },
  {
    id: 'boss_parasite_mother', name: '寄生体マザー', description: '塔中に寄生体をばら撒く母体。',
    kind: 'boss', zones: [3], bossFloor: 60, hp: 54, pattern: 'cycle', image: 'images/enemies/boss_parasite_mother.png', scale: 1.55,
    actions: [
      { id: 'brood', name: '産卵', intent: 'special', effects: [{ kind: 'summon', enemyId: 'rot_rat' }, { kind: 'block', amount: 6 }] },
      debuff('spores', '胞子', 'poison', 6),
      atk('lash', '鞭打つ触手', 5, 3),
    ],
  },
  {
    id: 'boss_iron_executioner', name: '鋼鉄の処刑人', description: '巨大な鉈を引きずる処刑人。決して止まらない。',
    kind: 'boss', zones: [4], bossFloor: 70, hp: 60, pattern: 'cycle', image: 'images/enemies/boss_iron_executioner.png', scale: 1.6,
    stunImmune: true,
    actions: [
      blk('advance', '前進', 12),
      atk('cleaver', '大鉈', 18),
      { id: 'execute', name: '処刑宣告', intent: 'special', effects: [{ kind: 'status', status: 'vulnerable', amount: 3, target: 'player' }, { kind: 'status', status: 'strength', amount: 3, target: 'self' }] },
    ],
  },
  {
    id: 'boss_abyss_priest', name: '深淵の司祭', description: '深淵の神に仕える司祭。信徒を盾にする。',
    kind: 'boss', zones: [4], bossFloor: 80, hp: 52, pattern: 'cycle', image: 'images/enemies/boss_abyss_priest.png', scale: 1.5,
    actions: [
      { id: 'call', name: '信徒の召喚', intent: 'special', effects: [{ kind: 'summon', enemyId: 'black_zealot' }] },
      { id: 'dark_rite', name: '暗黒の儀式', intent: 'buff', effects: [{ kind: 'status', status: 'strength', amount: 3, target: 'allAllies' }, { kind: 'block', amount: 10, target: 'allAllies' }] },
      atk('abyss_ray', '深淵の光', 7, 2),
    ],
  },
  {
    id: 'boss_tower_heart', name: '塔の心臓', description: '塔全体に血を送り続ける巨大な心臓。',
    kind: 'boss', zones: [5], bossFloor: 90, hp: 64, pattern: 'cycle', image: 'images/enemies/boss_tower_heart.png', scale: 1.6,
    startStatus: [{ status: 'regen', amount: 30 }],
    actions: [
      atk('pulse', '脈動', 4, 4),
      { id: 'pump', name: '鼓動', intent: 'buff', effects: [{ kind: 'status', status: 'strength', amount: 2, target: 'self' }, { kind: 'block', amount: 12 }] },
      { id: 'bloodflood', name: '血の奔流', intent: 'special', effects: [{ kind: 'attack', amount: 16 }, { kind: 'status', status: 'weak', amount: 2, target: 'player' }] },
    ],
  },
  {
    id: 'boss_dawn_devourer', name: '夜明けを喰らうもの', description: '塔の頂に棲む、全ての元凶。この悪夢の終わり。',
    kind: 'boss', zones: [5], bossFloor: 100, hp: 70, pattern: 'cycle', image: 'images/enemies/boss_dawn_devourer.png', scale: 1.75,
    stunImmune: true,
    actions: [
      { id: 'eclipse', name: '日蝕', intent: 'debuff', effects: [{ kind: 'status', status: 'weak', amount: 2, target: 'player' }, { kind: 'status', status: 'vulnerable', amount: 2, target: 'player' }, { kind: 'status', status: 'frail', amount: 2, target: 'player' }] },
      atk('devour', '喰らう', 8, 3),
      { id: 'void_shell', name: '虚無の殻', intent: 'block', effects: [{ kind: 'block', amount: 20 }, { kind: 'status', status: 'strength', amount: 3, target: 'self' }] },
      { id: 'end_of_dawn', name: '夜明けの終焉', intent: 'special', effects: [{ kind: 'attack', amount: 26 }] },
    ],
  },
];

const ENEMY_MAP = new Map(ENEMIES.map((e) => [e.id, e]));
export function getEnemy(id: string): EnemyDef {
  const e = ENEMY_MAP.get(id);
  if (!e) throw new Error(`Unknown enemy id: ${id}`);
  return e;
}
