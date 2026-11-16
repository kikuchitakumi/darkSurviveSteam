// =============================================================
// audio.ts  【データ：効果音(SE)・BGM の一覧】
// -------------------------------------------------------------
// 音声ファイルは public/assets/audio/ 以下に置く。
// 現在のファイルは tools/generate-audio.ts で自動生成した仮音源（SE=.wav / BGM=.mp3）。
//
// ★差し替え方法：
//   1. 新しい mp3 / ogg を public/assets/audio/se/ や bgm/ に置く
//   2. 下の file のパスを書き換える（例: 'audio/se/se_click.wav' → 'audio/se/se_click.mp3'）
//   3. 音量が合わなければ volume（0.0～1.0）を調整
// =============================================================

export interface SoundDef {
  /** public/assets/ からの相対パス */
  file: string;
  /** 基本音量（0.0～1.0）。オプションの音量設定と掛け算される */
  volume: number;
  /** 何に使う音か（メモ） */
  usage: string;
  /**
   * 長い曲（数分ある市販・外部の曲）は true にする。
   * 全体をメモリに展開せず、少しずつ読み込みながら再生する（1曲で数百MB使うのを防ぐ）。
   * 短いループ曲（自動生成のBGM）は false のまま＝継ぎ目なくループする。
   */
  stream?: boolean;
}

/** 効果音（SE） */
export const SE = {
  se_click: { file: 'audio/se/se_click.wav', volume: 0.6, usage: 'ボタン決定' },
  se_hover: { file: 'audio/se/se_hover.wav', volume: 0.25, usage: 'ボタンにカーソルが乗った時' },
  se_cancel: { file: 'audio/se/se_cancel.wav', volume: 0.5, usage: 'キャンセル・戻る' },
  se_error: { file: 'audio/se/se_error.wav', volume: 0.5, usage: 'AP不足など操作できない時' },
  se_text: { file: 'audio/se/se_text.wav', volume: 0.12, usage: 'メッセージの文字送り' },
  se_card_draw: { file: 'audio/se/se_card_draw.wav', volume: 0.35, usage: 'カードを引く' },
  se_card_play: { file: 'audio/se/se_card_play.wav', volume: 0.5, usage: 'カードを使う' },
  se_card_exhaust: { file: 'audio/se/se_card_exhaust.wav', volume: 0.5, usage: 'カードを廃棄' },
  se_shuffle: { file: 'audio/se/se_shuffle.wav', volume: 0.5, usage: '捨て札をシャッフル' },
  se_slash: { file: 'audio/se/se_slash.wav', volume: 0.6, usage: '攻撃（斬撃）' },
  se_hit: { file: 'audio/se/se_hit.wav', volume: 0.7, usage: '攻撃が命中' },
  se_crit: { file: 'audio/se/se_crit.wav', volume: 0.8, usage: 'クリティカル' },
  se_block: { file: 'audio/se/se_block.wav', volume: 0.6, usage: 'ブロック獲得・防御' },
  se_buff: { file: 'audio/se/se_buff.wav', volume: 0.55, usage: 'バフ' },
  se_debuff: { file: 'audio/se/se_debuff.wav', volume: 0.55, usage: 'デバフ' },
  se_heal: { file: 'audio/se/se_heal.wav', volume: 0.55, usage: '回復' },
  se_enemy_attack: { file: 'audio/se/se_enemy_attack.wav', volume: 0.75, usage: '敵の攻撃' },
  se_player_hurt: { file: 'audio/se/se_player_hurt.wav', volume: 0.8, usage: 'プレイヤー被弾' },
  se_evade: { file: 'audio/se/se_evade.wav', volume: 0.6, usage: '回避' },
  se_enemy_die: { file: 'audio/se/se_enemy_die.wav', volume: 0.7, usage: '敵撃破' },
  se_gold: { file: 'audio/se/se_gold.wav', volume: 0.55, usage: 'お金を得る・購入' },
  se_levelup: { file: 'audio/se/se_levelup.wav', volume: 0.7, usage: 'レベルアップ' },
  se_door: { file: 'audio/se/se_door.wav', volume: 0.7, usage: '扉を開ける・階移動' },
  se_chest: { file: 'audio/se/se_chest.wav', volume: 0.7, usage: '宝箱を開ける' },
  se_heartbeat: { file: 'audio/se/se_heartbeat.wav', volume: 0.7, usage: 'HP低下時の心音' },
  se_roll: { file: 'audio/se/se_roll.wav', volume: 0.4, usage: 'ステータスのルーレット' },
  se_talent: { file: 'audio/se/se_talent.wav', volume: 0.8, usage: '才能開花' },
  se_turn: { file: 'audio/se/se_turn.wav', volume: 0.5, usage: 'ターン開始' },
  se_victory: { file: 'audio/se/se_victory.wav', volume: 0.7, usage: '戦闘勝利ジングル' },
  se_defeat: { file: 'audio/se/se_defeat.wav', volume: 0.8, usage: 'ゲームオーバー' },
  se_stun: { file: 'audio/se/se_stun.wav', volume: 0.6, usage: '封印' },
  se_item: { file: 'audio/se/se_item.wav', volume: 0.55, usage: 'アイテム使用' },
} satisfies Record<string, SoundDef>;

/** BGM（ループ再生） */
export const BGM = {
  bgm_title: { file: 'audio/bgm/bgm_title_choir.mp3', volume: 0.6, usage: 'タイトル画面（合成の聖歌隊）' },
  bgm_tower: { file: 'audio/bgm/bgm_tower.mp3', volume: 0.5, usage: '塔の探索中' },
  bgm_battle: { file: 'audio/bgm/bgm_battle.mp3', volume: 0.5, usage: '通常戦闘' },
  bgm_elite: { file: 'audio/bgm/bgm_elite.mp3', volume: 0.5, usage: '強敵戦' },
  bgm_boss: { file: 'audio/bgm/bgm_boss.mp3', volume: 0.55, usage: 'ボス戦（自動生成・BOSS_BGM に無いボス用）' },
  bgm_boss_queens: { file: 'audio/bgm/bgm_boss_queens.mp3', volume: 0.5, usage: 'ボス戦（Battle Queens）', stream: true },
  bgm_boss_queens2: { file: 'audio/bgm/bgm_boss_queens2.mp3', volume: 0.5, usage: 'ボス戦（Battle Queens 別バージョン）', stream: true },
  bgm_boss_brains: { file: 'audio/bgm/bgm_boss_brains.mp3', volume: 0.5, usage: 'ボス戦（Battle of the Brains）', stream: true },
  bgm_boss_final: { file: 'audio/bgm/bgm_boss_final.mp3', volume: 0.55, usage: '最終ボス戦（旧タイトル曲）', stream: true },
  bgm_shop: { file: 'audio/bgm/bgm_shop.mp3', volume: 0.45, usage: 'ショップ（闇商人含む）' },
  bgm_gameover: { file: 'audio/bgm/bgm_gameover.mp3', volume: 0.5, usage: 'ゲームオーバー' },
} satisfies Record<string, SoundDef>;

export type SeKey = keyof typeof SE;
export type BgmKey = keyof typeof BGM;

/** ボスごとの曲（敵ID → BGM）。ここに無いボスは bgm_boss */
export const BOSS_BGM: Partial<Record<string, BgmKey>> = {
  boss_flesh_warden: 'bgm_boss', // 10F
  boss_stitched_nurse: 'bgm_boss_queens', // 20F
  boss_writhing_researcher: 'bgm_boss_brains', // 30F
  boss_twin_hound: 'bgm_boss_queens2', // 40F
  boss_belfry_wraith: 'bgm_boss', // 50F
  boss_parasite_mother: 'bgm_boss_queens', // 60F
  boss_iron_executioner: 'bgm_boss_brains', // 70F
  boss_abyss_priest: 'bgm_boss_queens2', // 80F
  boss_tower_heart: 'bgm_boss', // 90F
  boss_dawn_devourer: 'bgm_boss_final', // 100F 最終ボス
};
