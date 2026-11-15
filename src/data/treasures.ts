// =============================================================
// treasures.ts  【データ：宝物庫の宝箱】
// -------------------------------------------------------------
// 宝物庫には 赤・青・黄・緑 の4つの宝箱が置かれている。
// 対応する色の鍵を持っていれば開けられる（鍵は1つ消費）。
// 中身はここで定義する（contents に並べたもの全てが手に入る）。
// =============================================================
import type { KeyColor, TreasureChestDef } from '@/model/types';

export const TREASURE_CHESTS: Record<KeyColor, TreasureChestDef> = {
  red: {
    color: 'red',
    name: '赤い宝箱',
    image: 'images/objects/chest_red.png',
    contents: [{ kind: 'randomEquipment', slot: 'weapon', minRarity: 'rare' }],
  },
  blue: {
    color: 'blue',
    name: '青い宝箱',
    image: 'images/objects/chest_blue.png',
    contents: [{ kind: 'randomEquipment', slot: 'armor', minRarity: 'rare' }],
  },
  yellow: {
    color: 'yellow',
    name: '黄色い宝箱',
    image: 'images/objects/chest_yellow.png',
    contents: [{ kind: 'gold', min: 150, max: 300 }, { kind: 'randomItem', count: 1 }],
  },
  green: {
    color: 'green',
    name: '緑の宝箱',
    image: 'images/objects/chest_green.png',
    contents: [{ kind: 'randomEquipment', slot: 'accessory', minRarity: 'rare' }, { kind: 'randomItem', count: 1 }],
  },
};
