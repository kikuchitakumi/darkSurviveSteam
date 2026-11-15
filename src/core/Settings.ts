// =============================================================
// Settings.ts  【Core：現在のオプション設定を保持】
// -------------------------------------------------------------
// ゲーム中どこからでも settings.current で設定を参照できる。
// 変更は update() を通して行い、自動で保存＆画面に通知される。
// =============================================================
import { bus } from './EventBus';
import { Storage, type Settings } from './Storage';

class SettingsStore {
  current: Settings = Storage.loadSettings();

  update(patch: Partial<Settings>): void {
    const langChanged = patch.language !== undefined && patch.language !== this.current.language;
    this.current = { ...this.current, ...patch };
    Storage.saveSettings(this.current);
    bus.emit('settingsChanged');
    if (langChanged) bus.emit('languageChanged');
  }
}

export const settings = new SettingsStore();
