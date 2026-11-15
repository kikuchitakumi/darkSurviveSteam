// =============================================================
// statusEffects.ts  【データ：状態異常（バフ／デバフ）】
// -------------------------------------------------------------
// 状態異常の「表示名・説明・アイコン・減り方」を定義する。
// 実際の効果（ダメージ計算など）は model/Combat.ts に実装されている。
//
//  decay:
//    'turnEnd'   … ターン終了時に1減る
//    'removeTurnEnd' … ターン終了時に全て消える
//    'none'      … 戦闘中は減らない
//    'custom'    … Combat.ts 内で個別に処理（毒・封印など）
// =============================================================
import type { StatusId } from '@/model/types';

export interface StatusDef {
  id: StatusId;
  name: string;
  description: string;
  /** buff = 良い効果 / debuff = 悪い効果 */
  polarity: 'buff' | 'debuff';
  decay: 'turnEnd' | 'removeTurnEnd' | 'none' | 'custom';
  icon: string;
}

export const STATUS_EFFECTS: Record<StatusId, StatusDef> = {
  strength: {
    id: 'strength',
    name: '筋力',
    description: '攻撃ダメージが {n} 増加する。',
    polarity: 'buff',
    decay: 'none',
    icon: 'images/ui/status_strength.png',
  },
  turnStrength: {
    id: 'turnStrength',
    name: '奮起',
    description: 'このターン、攻撃ダメージが {n} 増加する。',
    polarity: 'buff',
    decay: 'removeTurnEnd',
    icon: 'images/ui/status_turnStrength.png',
  },
  dexterity: {
    id: 'dexterity',
    name: '敏捷',
    description: '獲得するブロックが {n} 増加する。',
    polarity: 'buff',
    decay: 'none',
    icon: 'images/ui/status_dexterity.png',
  },
  weak: {
    id: 'weak',
    name: '衰弱',
    description: '与える攻撃ダメージが 25% 減少する。（残り {n} ターン）',
    polarity: 'debuff',
    decay: 'turnEnd',
    icon: 'images/ui/status_weak.png',
  },
  vulnerable: {
    id: 'vulnerable',
    name: '脆弱',
    description: '受ける攻撃ダメージが 50% 増加する。（残り {n} ターン）',
    polarity: 'debuff',
    decay: 'turnEnd',
    icon: 'images/ui/status_vulnerable.png',
  },
  frail: {
    id: 'frail',
    name: '萎縮',
    description: '獲得するブロックが 25% 減少する。（残り {n} ターン）',
    polarity: 'debuff',
    decay: 'turnEnd',
    icon: 'images/ui/status_frail.png',
  },
  poison: {
    id: 'poison',
    name: '毒',
    description: 'ターン開始時に {n} ダメージを受け、毒が1減る。',
    polarity: 'debuff',
    decay: 'custom',
    icon: 'images/ui/status_poison.png',
  },
  stun: {
    id: 'stun',
    name: '封印',
    description: '次の行動ができない。',
    polarity: 'debuff',
    decay: 'custom',
    icon: 'images/ui/status_stun.png',
  },
  stunResist: {
    id: 'stunResist',
    name: '封印耐性',
    description: '封印を受け付けない。（残り {n} ターン）',
    polarity: 'buff',
    decay: 'turnEnd',
    icon: 'images/ui/status_stunResist.png',
  },
  regen: {
    id: 'regen',
    name: '再生',
    description: 'ターン終了時に HP を {n} 回復し、再生が1減る。',
    polarity: 'buff',
    decay: 'custom',
    icon: 'images/ui/status_regen.png',
  },
  thorns: {
    id: 'thorns',
    name: '棘',
    description: '攻撃を受けると、攻撃者に {n} ダメージを返す。',
    polarity: 'buff',
    decay: 'none',
    icon: 'images/ui/status_thorns.png',
  },
};
