// =============================================================
// Storage.ts  【Core：セーブデータ・設定の保存】
// -------------------------------------------------------------
// 現在はブラウザの localStorage に保存している（Electron でもそのまま動く）。
// Steam 版で「Steam クラウドセーブ」に対応する時は、このファイルの
// 中身だけを差し替えれば他のコードは変更不要。
// =============================================================
import { GAME_CONFIG } from '@/config/gameConfig';
import type { RunData } from '@/model/GameState';

/** オプション設定 */
export interface Settings {
  bgmVolume: number; // 0～1
  seVolume: number; // 0～1
  /** 画質：low=演出控えめ（Steam Deck向け） / high=全演出 */
  quality: 'low' | 'medium' | 'high';
  language: 'ja' | 'en';
  /** 文字送りの速さ（1文字あたりのミリ秒） */
  textSpeed: number;
  /** 画面揺れ（酔いやすい人向けにOFFにできる） */
  screenShake: boolean;
  fullscreen: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  bgmVolume: 0.6,
  seVolume: 0.8,
  quality: 'high',
  language: 'ja',
  textSpeed: 28,
  screenShake: true,
  fullscreen: false,
};

/** 周回をまたいで残る記録（最高到達階など） */
export interface MetaData {
  bestFloor: number;
  totalRuns: number;
  clears: number;
}

function read<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function write(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* 保存できない環境（プライベートモード等）では何もしない */
  }
}

export const Storage = {
  // ---- セーブデータ（ローグライクなので1枠のみ） ----
  hasSave(): boolean {
    return read<RunData>(GAME_CONFIG.STORAGE_KEY_SAVE) !== null;
  },
  loadRun(): RunData | null {
    return read<RunData>(GAME_CONFIG.STORAGE_KEY_SAVE);
  },
  saveRun(data: RunData): void {
    write(GAME_CONFIG.STORAGE_KEY_SAVE, data);
  },
  deleteRun(): void {
    try {
      localStorage.removeItem(GAME_CONFIG.STORAGE_KEY_SAVE);
    } catch {
      /* noop */
    }
  },

  // ---- 設定 ----
  loadSettings(): Settings {
    return { ...DEFAULT_SETTINGS, ...(read<Partial<Settings>>(GAME_CONFIG.STORAGE_KEY_SETTINGS) ?? {}) };
  },
  saveSettings(s: Settings): void {
    write(GAME_CONFIG.STORAGE_KEY_SETTINGS, s);
  },

  // ---- 周回記録 ----
  loadMeta(): MetaData {
    return { bestFloor: 0, totalRuns: 0, clears: 0, ...(read<Partial<MetaData>>(GAME_CONFIG.STORAGE_KEY_META) ?? {}) };
  },
  saveMeta(m: MetaData): void {
    write(GAME_CONFIG.STORAGE_KEY_META, m);
  },
};
