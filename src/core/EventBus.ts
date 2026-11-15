// =============================================================
// EventBus.ts  【Core：イベント通知】
// -------------------------------------------------------------
// Model（ゲームの状態）が変わった時に View（画面）へ知らせるための仕組み。
// Model は View を直接知らなくてよくなり、MVC の分離が保たれる。
//
// 例) gameState.gold が変わった → bus.emit('stateChanged')
//     → HUD が受け取って所持金表示を更新
// =============================================================

type Handler<T> = (payload: T) => void;

export interface BusEvents {
  /** ゲーム状態（HP・所持金など）が変わった */
  stateChanged: void;
  /** 設定（音量・言語など）が変わった */
  settingsChanged: void;
  /** 言語が切り替わった（画面の文字を再描画する） */
  languageChanged: void;
  /** トースト通知（画面上部に短いメッセージを出す） */
  toast: { text: string; kind?: 'info' | 'good' | 'bad' };
}

export class EventBus {
  private handlers = new Map<keyof BusEvents, Set<Handler<any>>>();

  /** 購読する。戻り値の関数を呼ぶと購読解除 */
  on<K extends keyof BusEvents>(name: K, fn: Handler<BusEvents[K]>): () => void {
    if (!this.handlers.has(name)) this.handlers.set(name, new Set());
    this.handlers.get(name)!.add(fn);
    return () => this.handlers.get(name)?.delete(fn);
  }

  emit<K extends keyof BusEvents>(name: K, ...payload: BusEvents[K] extends void ? [] : [BusEvents[K]]): void {
    this.handlers.get(name)?.forEach((fn) => fn(payload[0]));
  }
}

/** ゲーム全体で共有する唯一の EventBus */
export const bus = new EventBus();
