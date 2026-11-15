// =============================================================
// i18n/index.ts  【多言語：翻訳関数】
// -------------------------------------------------------------
//  t('title.start')                 … UI の文言を現在の言語で取得
//  t('floor.enter', { n: 3 })       … {n} を置き換え
//  td('card', 'strike', 'name', '斬りつけ')
//                                   … データの文言を翻訳（無ければ日本語）
// =============================================================
import { settings } from '@/core/Settings';
import { ja, type I18nKey } from './ja';
import { en } from './en';

const DICTS: Record<string, Record<string, string>> = { ja, en };

/** {name} 形式のパラメータを置き換える */
function format(s: string, params?: Record<string, string | number>): string {
  if (!params) return s;
  return s.replace(/\{(\w+)\}/g, (m, k) => (params[k] !== undefined ? String(params[k]) : m));
}

/** UI 文言の翻訳 */
export function t(key: I18nKey, params?: Record<string, string | number>): string {
  const lang = settings.current.language;
  const s = DICTS[lang]?.[key] ?? ja[key] ?? key;
  return format(s, params);
}

/**
 * データ（カード・敵・アイテム等）の文言の翻訳
 * @param category 'card' | 'enemy' | 'item' | 'equipment' | 'status' | 'event' | 'key'
 * @param jaText   data/ に書かれている日本語（翻訳が無い時はこれを返す）
 */
export function td(category: string, id: string, field: string, jaText: string, params?: Record<string, string | number>): string {
  const lang = settings.current.language;
  const s = lang === 'ja' ? jaText : DICTS[lang]?.[`${category}.${id}.${field}`] ?? jaText;
  return format(s, params);
}

export const LANGUAGES: { code: 'ja' | 'en'; label: string }[] = [
  { code: 'ja', label: '日本語' },
  { code: 'en', label: 'English' },
];
