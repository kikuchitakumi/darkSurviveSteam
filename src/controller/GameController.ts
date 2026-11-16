// =============================================================
// GameController.ts  【Controller：ゲーム全体の流れ】
// -------------------------------------------------------------
// ゲームの「進行役」。画面遷移の順番は全てこのファイルを読めば分かる。
//
//  起動 → ローディング → タイトル
//    START    → ステータス抽選 → 1F → 2F → … → 100F（ラスボス）→ クリア
//    CONTINUE → セーブした階から再開
//
//  各階の流れ（runLoop）
//    1F       : 扉を開ける / 帰る / 探索（隠し通路→宝物庫）/ 祈る
//    10Fごと  : ボス戦
//    それ以外 : 2択（戦闘・戦闘(危険)・イベント・ショップ）＋たまに隠し通路
//
// 実際の処理は各 Controller（Battle/Reward/Shop/Event/Treasure）に任せる。
// =============================================================
import { Audio } from '@/core/AudioManager';
import { Random } from '@/core/Random';
import { Storage } from '@/core/Storage';
import { BALANCE, zoneOfFloor } from '@/config/balance';
import { getStarterDeck, getCard } from '@/data/cards';
import { getEquipment } from '@/data/equipment';
import { FIRST_FLOOR, ROUTE_VISUALS, getZone } from '@/data/floors';
import { getItem } from '@/data/items';
import { IMAGES, collectAllImagePaths } from '@/data/images';
import { t } from '@/i18n';
import { GameState } from '@/model/GameState';
import { Content } from '@/services/content';
import { rollStats } from '@/model/StatRoller';
import { generateRoutes, isBossFloor } from '@/model/FloorGenerator';
import { useItemOutOfBattle } from '@/model/Outcomes';
import type { RouteType } from '@/model/types';
import { asset, button, h, wait } from '@/view/dom';
import { ui } from '@/view/ui';
import { showTitle } from '@/view/scenes/TitleScene';
import { showStatRoll } from '@/view/scenes/StatRollScene';
import { showObjectScene } from '@/view/scenes/ObjectScene';
import { showClear, showGameOver, showLoading, waitFirstClick } from '@/view/scenes/EndScenes';
import { confirmDialog, openModal } from '@/view/components/Modal';
import { setDeckNumbersProvider, showDeck } from '@/view/panels/DeckViewer';
import { Combat } from '@/model/Combat';
import { openStatusPanel } from '@/view/panels/StatusPanel';
import { openOptions } from '@/view/panels/OptionsPanel';
import { askEquipSwap } from '@/view/panels/EquipDialog';
import { equipName, itemDesc, itemName } from '@/view/text';
import { runBattle } from './BattleController';
import { runRewards } from './RewardController';
import { runShop } from './ShopController';
import { runEvent } from './EventController';
import { runTreasure } from './TreasureController';

type RouteResult = 'ok' | 'lost' | 'clear';

/** アイテム説明の {heal} に入れる回復量 */
function healAmount(def: ReturnType<typeof getItem>, mag: number): number {
  const e = def.effects.find((x) => x.kind === 'heal');
  return e && e.kind === 'heal' ? e.amount + (e.scale === 'mag' ? mag : 0) : 0;
}

export class GameController {
  /** 現在のラン（タイトル画面では null） */
  gs: GameState | null = null;
  /** デバッグ開始（好きな階から）で始めたランか。最高到達階の記録を汚さないために使う */
  private isDebugRun = false;
  /** デバッグ・自動テスト用：次の階の選択肢を固定する（通常は null） */
  debugRoutes: RouteType[] | null = null;

  // =========================================================
  // 起動
  // =========================================================
  async boot(): Promise<void> {
    // 開発メニュー・Firebase で登録したカード・敵・イベントを読み込む（失敗しても同梱データで続行）
    await Content.loadAll();
    await this.preload();
    await waitFirstClick();
    this.restoreHudHandlers();
    await this.titleLoop();
  }

  /** 画像の先読み（ローディング画面） */
  private async preload(): Promise<void> {
    const loader = showLoading();
    const paths = collectAllImagePaths();
    let done = 0;
    await Promise.all(paths.map((p) => new Promise<void>((resolve) => {
      const im = new Image();
      im.onload = im.onerror = () => {
        done++;
        loader.progress(done / paths.length);
        resolve();
      };
      im.src = asset(p);
    })));
    await loader.done();
  }

  // =========================================================
  // タイトル
  // =========================================================
  private async titleLoop(): Promise<void> {
    while (true) {
      this.gs = null;
      this.isDebugRun = false;
      ui.hud.bind(null);
      Audio.playBgm('bgm_title');
      const meta = Storage.loadMeta();
      const choice = await showTitle({ hasSave: Storage.hasSave(), bestFloor: meta.bestFloor });
      if (choice.action === 'start') {
        if (Storage.hasSave() && !(await confirmDialog(t('title.confirmNew')))) continue;
        Storage.deleteRun();
        await this.newRun();
      } else if (choice.action === 'debug') {
        if (Storage.hasSave() && !(await confirmDialog(t('title.confirmNew')))) continue;
        Storage.deleteRun();
        await this.newDebugRun(choice.floor);
      } else {
        const data = Storage.loadRun();
        if (!data) continue;
        this.gs = new GameState(data);
      }
      await this.runLoop();
    }
  }

  // =========================================================
  // デバッグ：好きな階から開始（ステータスはランダム・初期デッキ）
  // =========================================================
  private async newDebugRun(floor: number): Promise<void> {
    const seed = Random.randomSeed();
    const rng = new Random(seed ^ 0x5eed);
    const result = rollStats(rng);
    this.gs = GameState.create(seed, result.stats, result.talents, result.rich, getStarterDeck());
    this.gs.data.floor = Math.min(BALANCE.MAX_FLOOR, Math.max(1, Math.floor(floor)));
    this.isDebugRun = true;
  }

  // =========================================================
  // 新しいラン（ステータス抽選）
  // =========================================================
  private async newRun(): Promise<void> {
    const seed = Random.randomSeed();
    const rng = new Random(seed ^ 0x5eed);
    let view!: ReturnType<typeof showStatRoll>;
    await ui.stage.fadeTransition(() => {
      view = showStatRoll(seed);
    });
    let rerolls = BALANCE.STAT_REROLLS;
    let result = rollStats(rng);
    while (true) {
      await view.reveal(result, rerolls);
      const c = await view.waitChoice();
      if (c === 'accept') break;
      rerolls--;
      result = rollStats(rng);
    }
    this.gs = GameState.create(seed, result.stats, result.talents, result.rich, getStarterDeck());
    const meta = Storage.loadMeta();
    meta.totalRuns++;
    Storage.saveMeta(meta);
    this.save();
  }

  /** セーブ（各階の到着時・選択時・購入時など） */
  save(): void {
    if (!this.gs || this.gs.isDead) return;
    Storage.saveRun(this.gs.serialize());
    const meta = Storage.loadMeta();
    if (!this.isDebugRun && this.gs.data.floor > meta.bestFloor) {
      meta.bestFloor = this.gs.data.floor;
      Storage.saveMeta(meta);
    }
  }

  // =========================================================
  // 塔を登るメインループ
  // =========================================================
  private async runLoop(): Promise<void> {
    const gs = this.gs!;
    ui.hud.bind(gs);
    setDeckNumbersProvider((id) => Combat.previewNumbers(gs, getCard(id)));
    while (true) {
      this.save();
      const floor = gs.data.floor;

      // ---- 1F（塔の入口） ----
      if (floor === 1) {
        await this.firstFloor();
        gs.advanceFloor();
        continue;
      }

      // ---- 2F以降：選択肢を決める（再開時は保存済みのものを使う） ----
      if (!gs.data.currentRoutes) {
        gs.data.currentRoutes = this.debugRoutes ?? generateRoutes(floor, gs.rng, gs.totalKeys > 0);
        this.debugRoutes = null;
        this.save();
      }
      const route = gs.data.chosenRoute ?? (await this.chooseRoute(gs.data.currentRoutes));
      gs.data.chosenRoute = route;
      this.save();

      const result = await this.runRoute(route);
      if (result === 'lost') {
        await this.gameOver();
        return;
      }
      if (result === 'clear') {
        await this.gameClear();
        return;
      }
      gs.advanceFloor();
    }
  }

  /** 選んだ道を実行する */
  private async runRoute(route: RouteType): Promise<RouteResult> {
    const gs = this.gs!;
    switch (route) {
      case 'battle':
      case 'elite':
      case 'boss': {
        const kind = route === 'battle' ? 'normal' : route;
        const r = await runBattle(this, kind);
        if (r === 'lost') return 'lost';
        if (route === 'boss' && gs.data.floor >= BALANCE.MAX_FLOOR) return 'clear';
        await runRewards(this, kind);
        return 'ok';
      }
      case 'event':
        return runEvent(this);
      case 'shop':
        await runShop(this);
        return 'ok';
      case 'hidden':
        await runTreasure(this);
        return 'ok';
    }
  }

  // =========================================================
  // 1F
  // =========================================================
  private async firstFloor(): Promise<void> {
    const build = () => showObjectScene({
      background: FIRST_FLOOR.background,
      ambient: 'dust',
      objects: [{ id: 'door', image: IMAGES.door1F, x: 960, y: 700, height: 500 }],
    });
    Audio.playBgm('bgm_tower');
    await ui.stage.fadeTransition(() => { build(); });
    await this.floorBanner(1);
    await ui.msg.sayAll(FIRST_FLOOR.intro);

    while (true) {
      const c = await ui.msg.choose([
        { label: t('f1.openDoor'), cls: 'accent' },
        { label: t('f1.goHome') },
        { label: t('f1.explore') },
        { label: t('f1.pray') },
      ]);
      if (c === 0) {
        Audio.play('se_door');
        ui.msg.hide();
        return;
      }
      if (c === 1) {
        ui.fx.shake(0.5);
        await ui.msg.say(this.gs!.rng.pick(FIRST_FLOOR.goHomeScold));
      } else if (c === 2) {
        await ui.msg.say(FIRST_FLOOR.explore);
        const go = await ui.msg.choose([{ label: t('f1.proceed'), cls: 'accent' }, { label: t('f1.stop') }], FIRST_FLOOR.exploreConfirm);
        if (go === 0) {
          await runTreasure(this);
          await ui.stage.fadeTransition(() => { build(); });
        }
      } else {
        await ui.msg.say(FIRST_FLOOR.pray);
      }
    }
  }

  // =========================================================
  // 2F以降：分かれ道
  // =========================================================
  private async chooseRoute(routes: RouteType[]): Promise<RouteType> {
    const gs = this.gs!;
    const floor = gs.data.floor;
    const zone = getZone(zoneOfFloor(floor));
    Audio.playBgm(zone.bgm as any);
    const xs = routes.length === 1 ? [960] : routes.length === 2 ? [620, 1300] : [480, 960, 1440];
    let scene!: ReturnType<typeof showObjectScene>;
    await ui.stage.fadeTransition(() => {
      scene = showObjectScene({
        background: zone.floorBackground,
        ambient: zone.zone >= 4 ? 'embers' : zone.zone === 3 ? 'ash' : 'dust',
        tint: isBossFloor(floor) ? 'rgba(80,0,0,0.3)' : undefined,
        objects: routes.map((r, i) => ({
          id: `${i}`,
          image: ROUTE_VISUALS[r].image,
          x: xs[i],
          y: 690,
          height: r === 'boss' ? 540 : 460,
          label: ROUTE_VISUALS[r].label,
          sub: ROUTE_VISUALS[r].description,
          clickable: true,
          cls: `route-${r}`,
        })),
      });
    });
    await this.floorBanner(floor);
    ui.msg.say(isBossFloor(floor) ? t('floor.bossWarning') : `${gs.rng.pick(zone.flavor)}\n${t('floor.choose')}`, { wait: false });
    const id = await scene.waitPick();
    ui.msg.hide();
    return routes[Number(id)];
  }

  /** 階数の大きな表示 */
  private async floorBanner(floor: number): Promise<void> {
    const zone = getZone(zoneOfFloor(floor));
    await ui.fx.banner(`${floor}F`, { sub: zone.name, cls: 'banner-floor', hold: 700 });
  }

  // =========================================================
  // 共通処理（他の Controller から呼ばれる）
  // =========================================================
  /** 装備品を入手（同じ部位に装備があれば入れ替え確認） */
  async giveEquipment(id: string): Promise<void> {
    const gs = this.gs!;
    const def = getEquipment(id);
    const current = gs.data.equipment[def.slot];
    if (!current || (await askEquipSwap(current, id))) {
      gs.equip(id);
      Audio.play('se_buff');
      ui.toast(t('equip.got', { name: equipName(def) }), 'good');
    }
  }

  /** HUD ボタンの処理を通常（マップ画面）用に戻す */
  restoreHudHandlers(): void {
    ui.hudHandlers = {
      onDeck: () => this.gs && showDeck(this.gs.data.deck),
      onStatus: () => this.gs && openStatusPanel(this.gs),
      onMenu: () => openOptions(this.gs ? {
        onToTitle: () => { this.save(); location.reload(); },
        onAbandon: () => { Storage.deleteRun(); location.reload(); },
      } : undefined),
      onItem: (i) => this.itemMenu(i),
    };
  }

  /** マップ画面でアイテムをクリックした時のメニュー（使う／捨てる） */
  private itemMenu(index: number): void {
    const gs = this.gs;
    if (!gs) return;
    const id = gs.data.items[index];
    if (!id) return;
    const def = getItem(id);
    const canUse = def.usable === 'anytime';
    const m = openModal(itemName(def), h('div.item-menu', {}, [
      h('img.item-menu-icon', { src: asset(def.image) }),
      h('div.item-menu-desc', {}, itemDesc(def).replace('{heal}', String(healAmount(def, gs.stats.mag)))),
      canUse ? null : h('div.item-menu-note', {}, t('item.cannotUseHere')),
    ]), {
      cls: 'modal-small',
      footer: [
        button(t('item.discard'), () => { gs.removeItemAt(index); this.save(); m.close(); }, { se: 'se_cancel' }),
        button(t('item.use'), () => {
          if (useItemOutOfBattle(gs, index)) {
            Audio.play('se_heal');
            ui.particles.burst(960, 600, 'heal', 1.5);
            this.save();
          }
          m.close();
        }, { cls: 'primary', disabled: !canUse }),
      ],
    });
  }

  // =========================================================
  // ゲームオーバー・クリア
  // =========================================================
  private async gameOver(): Promise<void> {
    const gs = this.gs!;
    Storage.deleteRun();
    const r = await showGameOver(gs);
    if (r === 'retry') {
      await this.newRun();
      await this.runLoop();
    }
  }

  private async gameClear(): Promise<void> {
    const gs = this.gs!;
    Storage.deleteRun();
    const meta = Storage.loadMeta();
    meta.clears++;
    meta.bestFloor = Math.max(meta.bestFloor, gs.data.floor);
    Storage.saveMeta(meta);
    await wait(300);
    await showClear(gs);
  }
}
