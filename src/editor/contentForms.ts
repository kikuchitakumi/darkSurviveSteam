// =============================================================
// contentForms.ts  【開発メニュー：カード・敵・イベントの入力フォーム】
// -------------------------------------------------------------
// 種類ごとに「新規作成の初期値」「入力フォーム」「プレビュー」を定義する。
// EditorApp.ts はこの定義を使って画面を組み立てる。
// =============================================================
import { STATUS_EFFECTS } from '@/data/statusEffects';
import type { CardDef, EnemyDef, EventDef } from '@/model/types';
import type { ContentDef, ContentKind } from '@/services/content';
import { asset, h, img } from '@/view/dom';
import { createCardEl } from '@/view/components/CardView';
import { Combat } from '@/model/Combat';
import { GameState } from '@/model/GameState';
import { cardEffectsBuilder, describeEffects, enemyActionsBuilder, outcomesBuilder } from './builders';
import { check, chips, field, type FormCtx, imagePicker, listBuilder, num, row, section, select, smallBtn, text, textarea } from './forms';
import type { ImageUse } from './imageTools';

/** 画像を選んだ時の処理（EditorApp が実装） */
export type PickImage = (slot: string, use: ImageUse, file: File) => void;

export interface ContentFormSpec {
  kind: ContentKind;
  label: string;
  newDraft(): ContentDef;
  build(ctx: FormCtx, draft: any, pickImage: PickImage, isNew: boolean): HTMLElement;
  preview(draft: any): HTMLElement;
  /** 一覧のサムネイル画像のパス */
  thumb(def: any): string;
  subtitle(def: any): string;
}

const RARITIES: [string, string][] = [['basic', '基本'], ['common', 'コモン'], ['rare', 'レア'], ['legendary', 'レジェンド']];

/** プレビュー用の仮のプレイヤー（ステータス 攻3 防3 魔3） */
const previewGs = GameState.create(1, { hp: 3, atk: 3, def: 3, mag: 3, luk: 3 }, [], false, []);

// =============================================================
// カード
// =============================================================
export const CARD_FORM: ContentFormSpec = {
  kind: 'cards',
  label: 'カード',
  newDraft: (): CardDef => ({
    id: 'new_card',
    name: '新しいカード',
    description: '攻撃力×1（{damage}）のダメージ。',
    type: 'attack',
    rarity: 'common',
    cost: 1,
    target: 'enemy',
    effects: [{ kind: 'damage', amount: 0, scale: 'atk', mult: 1 }],
    image: 'images/cards/card_issen.png',
    price: 60,
    pools: ['reward', 'shop'],
    weight: 10,
    minFloor: 1,
  }),
  build(ctx, d: CardDef, pickImage, isNew) {
    const costSel = h<'select'>('select.ed-input', {}, [...[0, 1, 2, 3, 4, 5].map((n) => h<'option'>('option', { value: String(n) }, String(n))), h<'option'>('option', { value: 'X' }, 'X（残りAP全部）')]);
    costSel.value = String(d.cost);
    costSel.addEventListener('change', () => {
      d.cost = costSel.value === 'X' ? 'X' : Number(costSel.value);
      ctx.changed();
    });
    const descArea = textarea(ctx, d as any, 'description', 3);
    return h('div', {}, [
      section('基本', [
        row(field('ID', text(ctx, d as any, 'id', { readonly: !isNew, placeholder: 'issen など半角英数字' }), isNew ? '後から変更できません' : undefined), field('カード名', text(ctx, d as any, 'name'))),
        row(
          field('種類', select(ctx, d as any, 'type', [['attack', '攻撃'], ['defense', '防御'], ['support', 'サポート']])),
          field('系統', select(ctx, d as any, 'element', [['sword', '剣'], ['magic', '魔力'], ['blood', '血'], ['curse', '呪']], { empty: 'なし' })),
          field('レア度', select(ctx, d as any, 'rarity', RARITIES as any)),
        ),
        row(
          field('コスト', costSel),
          field('対象', select(ctx, d as any, 'target', [['enemy', '敵を1体選ぶ'], ['allEnemies', '敵全体'], ['self', '自分'], ['none', 'なし']])),
          check(ctx, d as any, 'exhaust', '使用後に廃棄'),
        ),
      ]),
      section('イラスト', [imagePicker(d.image, (f) => pickImage('image', 'card', f), { width: 190, height: 178, note: '推奨 960x900（自動で縮小・WebP変換）' })]),
      section('効果', [cardEffectsBuilder(ctx, d.effects)]),
      section('説明文', [
        descArea,
        h('div.ed-help', {}, '{damage} {hits} {block} {heal} {curse} {self} {x} は、ステータス込みの実際の数値に置き換わります。'),
        smallBtn('効果から説明文を作る', () => {
          d.description = describeEffects(d.effects, d.exhaust);
          descArea.value = d.description;
          ctx.changed();
        }),
      ]),
      section('入手・出やすさ', [
        row(field('初期デッキの枚数', num(ctx, d as any, 'starterCount', { min: 0, placeholder: '0' })), field('価格(G)', num(ctx, d as any, 'price', { min: 0, required: true }))),
        row(field('出る階（から）', num(ctx, d as any, 'minFloor', { min: 1, max: 100, placeholder: '1' })), field('出る階（まで）', num(ctx, d as any, 'maxFloor', { min: 1, max: 100, placeholder: '100' })), field('出やすさ', num(ctx, d as any, 'weight', { min: 0, placeholder: '10' }), '基本10。0で出ない')),
        field('入手場所', chips(ctx, d as any, 'pools', [['starter', '初期デッキ'], ['reward', '戦闘報酬・宝箱'], ['shop', 'ショップ'], ['dark', '闇商人']])),
        h('div.ed-help', {}, '深い階ほど、レア・レジェンドは自動で出やすくなります（cards.ts の cardWeightAt）。'),
      ]),
    ]);
  },
  preview(d: CardDef) {
    let numbers: Record<string, number> | undefined;
    try {
      numbers = Combat.previewNumbers(previewGs, d);
    } catch {
      numbers = undefined;
    }
    const el = createCardEl(d, { numbers });
    el.classList.add('ed-card-preview');
    return h('div', {}, [h('div.ed-preview-stage', {}, el), h('div.ed-help.center', {}, 'プレビューの数値は 攻撃力3・防御力3・魔力3 で計算')]);
  },
  thumb: (d: CardDef) => d.image,
  subtitle: (d: CardDef) => `${d.id} ／ コスト${d.cost} ／ ${RARITIES.find(([r]) => r === d.rarity)?.[1] ?? d.rarity}${d.starterCount ? ` ／ 初期×${d.starterCount}` : ''}`,
};

// =============================================================
// 敵
// =============================================================
export const ENEMY_FORM: ContentFormSpec = {
  kind: 'enemies',
  label: '敵キャラ',
  newDraft: (): EnemyDef => ({
    id: 'new_enemy',
    name: '新しい敵',
    description: '説明を書いてください。',
    kind: 'normal',
    zones: [1],
    hp: 12,
    pattern: 'cycle',
    actions: [{ id: 'bite', name: '噛みつき', intent: 'attack', effects: [{ kind: 'attack', amount: 5 }] }],
    image: 'images/enemies/enemy_crawler.png',
    scale: 1,
  }),
  build(ctx, d: EnemyDef, pickImage, isNew) {
    if (!d.startStatus) d.startStatus = [];
    return h('div', {}, [
      section('基本', [
        row(field('ID', text(ctx, d as any, 'id', { readonly: !isNew })), field('名前', text(ctx, d as any, 'name'))),
        field('説明', textarea(ctx, d as any, 'description', 2)),
        row(
          field('区分', select(ctx, d as any, 'kind', [['normal', '通常'], ['elite', '強敵'], ['boss', 'ボス']], { rerender: true })),
          d.kind === 'boss' ? field('出現階（ボス）', num(ctx, d as any, 'bossFloor', { min: 10, max: 100, step: 10, placeholder: '10' })) : null,
          field('HP（1F相当）', num(ctx, d as any, 'hp', { min: 1, required: true }), '階が上がると自動で強くなる'),
        ),
        field('出現ゾーン', chips(ctx, d as any, 'zones', [[1, '1〜20F'], [2, '21〜40F'], [3, '41〜60F'], [4, '61〜80F'], [5, '81〜100F']])),
        row(
          field('行動パターン', select(ctx, d as any, 'pattern', [['cycle', '上から順番'], ['random', 'ランダム（重み）']])),
          field('表示サイズ', num(ctx, d as any, 'scale', { min: 0.3, max: 2.5, step: 0.05, placeholder: '1' })),
          check(ctx, d as any, 'stunImmune', '行動キャンセル無効'),
        ),
      ]),
      section('画像（戦闘に出てくるキャラ）', [imagePicker(d.image, (f) => pickImage('image', 'enemy', f), { width: 200, height: 220, note: '背景を透過した画像がおすすめ（推奨 縦1280px まで）' })]),
      section('行動', [enemyActionsBuilder(ctx, d.actions as any[]), h('div.ed-help', {}, '特殊な行動（ここに無い効果）が必要な時は Claude に追加を頼んでください。')]),
      section('戦闘開始時の状態', [
        listBuilder(ctx, d.startStatus!, (s: any) => row(
          field('状態', select(ctx, s, 'status', Object.values(STATUS_EFFECTS).map((x) => [x.id, x.name] as [string, string]))),
          field('量', num(ctx, s, 'amount', { required: true })),
        ), () => ({ status: 'regen', amount: 5 } as any), { addLabel: '状態を追加' }),
      ]),
    ]);
  },
  preview(d: EnemyDef) {
    return h('div.ed-enemy-preview', {}, [
      h('div.ed-enemy-img', {}, d.image ? img(d.image) : null),
      h('div.ed-preview-name', {}, d.name),
      h('div.ed-help.center', {}, `${{ normal: '通常', elite: '強敵', boss: 'ボス' }[d.kind]} ／ HP ${d.hp}（1F相当）`),
      h('ol.ed-actions', {}, d.actions.map((a) => h('li', {}, `${a.name}：${a.effects.map((e: any) => e.kind === 'attack' ? `攻撃${e.amount}${e.hits > 1 ? `×${e.hits}` : ''}` : e.kind === 'block' ? `シールド${e.amount}` : e.kind === 'status' ? `${STATUS_EFFECTS[e.status as keyof typeof STATUS_EFFECTS]?.name ?? e.status}${e.amount}` : e.kind === 'heal' ? `回復${e.amount}` : e.kind === 'summon' ? `召喚` : e.kind).join('・')}`))),
    ]);
  },
  thumb: (d: EnemyDef) => d.image,
  subtitle: (d: EnemyDef) => `${d.id} ／ ${{ normal: '通常', elite: '強敵', boss: `ボス${d.bossFloor ?? ''}F` }[d.kind]} ／ HP${d.hp}`,
};

// =============================================================
// イベント
// =============================================================
export const EVENT_FORM: ContentFormSpec = {
  kind: 'events',
  label: 'イベント',
  newDraft: (): EventDef => ({
    id: 'new_event',
    title: '新しいイベント',
    text: ['薄暗い通路に、誰かが立っている……。'],
    background: 'images/bg/bg_event.webp',
    choices: [
      { label: '話しかける', success: { text: '何かを受け取った。', outcomes: [{ kind: 'gold', amount: 20 }] } },
      { label: '立ち去る', success: { text: 'あなたはその場を離れた。', outcomes: [{ kind: 'nothing' }] } },
    ],
    weight: 10,
    enabled: true,
  }),
  build(ctx, d: EventDef, pickImage, isNew) {
    // 本文：空行で区切ったまとまりが1ページ
    const textObj = { v: d.text.join('\n\n') };
    const body = textarea(ctx, textObj, 'v', 5);
    body.addEventListener('input', () => {
      d.text = textObj.v.split(/\n\s*\n/).map((s) => s.trim()).filter(Boolean);
      ctx.changed();
    });
    return h('div', {}, [
      section('基本', [
        row(field('ID', text(ctx, d as any, 'id', { readonly: !isNew })), field('イベント名', text(ctx, d as any, 'title'))),
        row(
          check(ctx, d as any, 'enabled', '出現する（ON/OFF）'),
          field('出やすさ', num(ctx, d as any, 'weight', { min: 0, required: true })),
          field('出る階（から）', num(ctx, d as any, 'minFloor', { min: 1, max: 100, placeholder: '1' })),
          field('出る階（まで）', num(ctx, d as any, 'maxFloor', { min: 1, max: 100, placeholder: '100' })),
        ),
      ]),
      section('画像', [
        row(
          field('背景', imagePicker(d.background, (f) => pickImage('background', 'background', f), { width: 240, height: 135, note: '1920x1080 推奨' })),
          field('登場キャラ', imagePicker(d.object ?? '', (f) => pickImage('object', 'character', f), { width: 140, height: 160, note: '透過画像がおすすめ' })),
        ),
        d.object ? smallBtn('登場キャラを外す', () => { delete d.object; ctx.rerender(); }) : null,
      ]),
      section('本文', [body, h('div.ed-help', {}, '空行で区切ると、メッセージウィンドウのページが分かれます。')]),
      section('選択肢', [
        listBuilder(ctx, d.choices as any[], (c: any) => {
          if (!c.success) c.success = { text: '', outcomes: [] };
          const luck = !!c.luckCheck;
          return h('div', {}, [
            field('ボタンの文言', text(ctx, c, 'label')),
            row(
              h('label.ed-check', {}, [
                (() => {
                  const cb = h<'input'>('input', { type: 'checkbox', checked: luck });
                  cb.addEventListener('change', () => {
                    if (cb.checked) {
                      c.luckCheck = { base: 0.5, perLuck: 0.01, max: 0.9 };
                      c.failure = c.failure ?? { text: '失敗した……', outcomes: [{ kind: 'damage', amount: 5 }] };
                    } else {
                      delete c.luckCheck;
                      delete c.failure;
                    }
                    ctx.rerender();
                  });
                  return cb;
                })(),
                h('span', {}, '運で成功／失敗が分かれる'),
              ]),
              luck ? field('基本の成功率', num(ctx, c.luckCheck, 'base', { step: 0.05, required: true }), '0.5 = 50%') : null,
              luck ? field('運1あたり', num(ctx, c.luckCheck, 'perLuck', { step: 0.005, required: true })) : null,
              luck ? field('上限', num(ctx, c.luckCheck, 'max', { step: 0.05 })) : null,
            ),
            field(luck ? '成功した時の文' : '結果の文', textarea(ctx, c.success, 'text', 2)),
            outcomesBuilder(ctx, c.success.outcomes),
            luck ? field('失敗した時の文', textarea(ctx, c.failure, 'text', 2)) : null,
            luck ? outcomesBuilder(ctx, c.failure.outcomes) : null,
          ]);
        }, () => ({ label: '新しい選択肢', success: { text: '', outcomes: [{ kind: 'nothing' }] } }) as any, { addLabel: '選択肢を追加', itemTitle: (c: any, i) => `選択肢 ${i + 1}：${c.label ?? ''}` }),
      ]),
    ]);
  },
  preview(d: EventDef) {
    return h('div.ed-event-preview', {}, [
      h('div.ed-event-stage', { style: { backgroundImage: d.background ? `url("${asset(d.background)}")` : 'none' } }, [
        d.object ? img(d.object, 'ed-event-object') : null,
        h('div.ed-event-title', {}, d.title),
        h('div.ed-event-text', {}, d.text[0] ?? ''),
      ]),
      h('ol.ed-actions', {}, d.choices.map((c) => h('li', {}, `${c.label}${c.luckCheck ? '（運判定）' : ''}`))),
      d.enabled ? null : h('div.ed-help.warn', {}, 'このイベントは OFF（出現しません）'),
    ]);
  },
  thumb: (d: EventDef) => d.object ?? d.background,
  subtitle: (d: EventDef) => `${d.id} ／ 出やすさ${d.weight}${d.enabled ? '' : ' ／ OFF'}`,
};

export const FORMS: Record<ContentKind, ContentFormSpec> = { cards: CARD_FORM, enemies: ENEMY_FORM, events: EVENT_FORM };
