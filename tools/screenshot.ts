// =============================================================
// screenshot.ts  【ツール：自動プレイ＆スクリーンショット】
// -------------------------------------------------------------
// 実行: npm run dev を起動した状態で
//       npm run screenshot -- <保存先フォルダ> [URL]
//
// Edge（ヘッドレス）でゲームを開き、タイトル → ステータス抽選 → 1F →
// 宝物庫 → 2F → 戦闘 → 報酬 まで自動で操作しながら画面を保存する。
// 見た目の確認や、大きな変更後の動作確認（スモークテスト）に使う。
// コンソールのエラーも最後に一覧表示する。
// =============================================================
import { chromium, type Page } from 'playwright-core';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const outDir = process.argv[2] ?? 'screenshots';
const url = process.argv[3] ?? 'http://localhost:5173/';
mkdirSync(outDir, { recursive: true });

const errors: string[] = [];
let shot = 0;

async function snap(page: Page, name: string) {
  const file = join(outDir, `${String(++shot).padStart(2, '0')}_${name}.png`);
  await page.screenshot({ path: file });
  console.log('📸', file);
}

/** メッセージを読み進めて選択肢が出るまで待つ */
async function advanceUntilChoices(page: Page, max = 15) {
  for (let i = 0; i < max; i++) {
    if (await page.locator('.msg-choices.visible .ds-btn').count()) return;
    await page.keyboard.press('Enter');
    await page.waitForTimeout(350);
  }
}

async function clickChoice(page: Page, text: string) {
  await advanceUntilChoices(page);
  await page.locator('.msg-choices.visible .ds-btn', { hasText: text }).first().click();
}

async function main() {
  const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--autoplay-policy=no-user-gesture-required'] });
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(url);
  await page.waitForSelector('.click-to-start', { timeout: 30000 });
  await snap(page, 'click_to_start');
  await page.click('.click-to-start');
  await page.waitForTimeout(2600);
  await snap(page, 'title');

  // ---- オプション画面 ----
  await page.locator('.title-btn', { hasText: 'OPTION' }).click();
  await page.waitForTimeout(500);
  await snap(page, 'options');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(400);

  // ---- START → ステータス抽選 ----
  await page.locator('.title-btn', { hasText: 'START' }).click();
  await page.waitForSelector('.roll-buttons .ds-btn', { timeout: 15000 });
  await page.waitForTimeout(800);
  await snap(page, 'stat_roll');
  await page.locator('.roll-buttons .ds-btn.primary').click();

  // ---- 1F ----
  await page.waitForTimeout(1500);
  await advanceUntilChoices(page);
  await page.waitForTimeout(600);
  await snap(page, 'floor1');
  await clickChoice(page, '帰る');
  await page.waitForTimeout(1200);
  await snap(page, 'floor1_gohome');
  await clickChoice(page, '周りを探索する');
  await clickChoice(page, '進む');
  await page.waitForTimeout(1500);
  await advanceUntilChoices(page);
  await snap(page, 'treasure_room');
  await clickChoice(page, '帰る');
  await page.waitForTimeout(1500);
  // 2F は必ず戦闘が出るように固定（デバッグ用フック）
  await page.evaluate(() => ((window as any).__game.debugRoutes = ['battle', 'elite']));
  await clickChoice(page, '扉を開ける');

  // ---- 2F：分かれ道 ----
  await page.waitForSelector('.scene-obj.clickable', { timeout: 15000 });
  await page.waitForTimeout(1800);
  await snap(page, 'floor2_routes');
  // デッキ・ステータス画面
  await page.locator('.hud-btn', { hasText: 'ステータス' }).click();
  await page.waitForTimeout(500);
  await snap(page, 'status_panel');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  await page.locator('.hud-btn', { hasText: 'デッキ' }).click();
  await page.waitForTimeout(500);
  await snap(page, 'deck');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);

  // 戦闘の扉を優先して選ぶ
  const battleDoor = page.locator('.scene-obj.route-battle, .scene-obj.route-elite');
  if (await battleDoor.count()) await battleDoor.first().click();
  else await page.locator('.scene-obj.clickable').first().click();

  // ---- 戦闘 ----
  if (await page.waitForSelector('.battle-scene', { timeout: 8000 }).catch(() => null)) {
    await page.waitForTimeout(3500);
    await snap(page, 'battle_start');
    // カードにホバー
    const firstCard = page.locator('.card.in-hand').first();
    if (await firstCard.count()) {
      await firstCard.hover();
      await page.waitForTimeout(400);
      await snap(page, 'battle_hover');
    }
    for (let turn = 0; turn < 25; turn++) {
      const won = await page.locator('.reward-overlay').count();
      const died = await page.locator('.gameover-overlay, .end-scene').count();
      if (won || died) break;
      // 使えるカードを数字キーで順に使う
      for (let k = 0; k < 6; k++) {
        await page.keyboard.press('1');
        await page.waitForTimeout(150);
        // 狙いが必要なら一番左の生きている敵をクリック
        if (await page.locator('.battle-scene.is-targeting').count()) {
          await page.locator('.enemy:not(.dead) .enemy-sprite').first().click({ force: true });
        }
        if (await page.locator('.battle-scene.is-choosing').count()) {
          await page.locator('.card.in-hand').first().click({ force: true });
        }
        await page.waitForTimeout(900);
        if (turn === 0 && k === 1) await snap(page, 'battle_action');
        if (await page.locator('.reward-overlay').count()) break;
      }
      if (await page.locator('.reward-overlay').count()) break;
      await page.keyboard.press('e');
      await page.waitForTimeout(3500);
      if (turn === 0) await snap(page, 'battle_after_enemy_turn');
    }
    await page.waitForTimeout(2500);
    await snap(page, 'battle_result');
    // ---- 報酬：カードを1枚選ぶ → 次の階はショップ ----
    if (await page.locator('.reward-card').count()) {
      await page.evaluate(() => ((window as any).__game.debugRoutes = ['shop', 'event']));
      await page.locator('.reward-card').first().click();
      await page.waitForTimeout(1500);
      if (await page.locator('.modal-status').count()) {
        await snap(page, 'level_up');
        await page.locator('.modal-footer .ds-btn.primary').click();
      }
      await page.waitForSelector('.scene-obj.route-shop', { timeout: 15000 });
      await page.waitForTimeout(1500);
      await page.locator('.scene-obj.route-shop').click();
      await page.waitForSelector('.shop-scene', { timeout: 15000 });
      await page.waitForTimeout(1500);
      await snap(page, 'shop');
      // ---- ショップを出たら 10F（ボス）へ ----
      await page.evaluate(() => ((window as any).__game.gs.data.floor = 9));
      await page.locator('.shop-leave .ds-btn').click();
      await page.waitForSelector('.scene-obj.route-boss', { timeout: 15000 });
      await page.waitForTimeout(1800);
      await snap(page, 'boss_door');
      await page.locator('.scene-obj.route-boss').click();
      await page.waitForSelector('.battle-scene', { timeout: 15000 });
      await page.waitForTimeout(2600);
      await snap(page, 'boss_intro');
      await page.waitForTimeout(4000);
      await snap(page, 'boss_battle');
    }
  } else {
    await page.waitForTimeout(2500);
    await snap(page, 'non_battle_route');
  }

  console.log(errors.length ? `\n❌ コンソールエラー ${errors.length} 件:\n${errors.join('\n')}` : '\n✅ コンソールエラーなし');
  await browser.close();
}

main().catch((e) => {
  console.error(e);
  console.log(errors.join('\n'));
  process.exit(1);
});
