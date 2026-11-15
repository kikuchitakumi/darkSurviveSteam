// =============================================================
// AudioManager.ts  【Core：BGM・効果音の再生】
// -------------------------------------------------------------
// Web Audio API を使って音を鳴らす。
//  - SE は起動時に先読みして、遅延なく鳴らせるようにしている
//  - SE はピッチを少しだけランダムにずらし、同じ音の連打でも単調にならない
//  - BGM はクロスフェード（前の曲をフェードアウトしながら次の曲をフェードイン）
//  - ブラウザの仕様で、最初のクリックまでは音が出せないため unlock() で解除する
// 鳴らす音の一覧・ファイルパスは data/audio.ts で管理している。
// =============================================================
import { GAME_CONFIG } from '@/config/gameConfig';
import { BGM, SE, type BgmKey, type SeKey } from '@/data/audio';
import { settings } from './Settings';
import { bus } from './EventBus';

class AudioManagerImpl {
  private ctx: AudioContext | null = null;
  private seGain!: GainNode;
  private bgmGain!: GainNode;
  private buffers = new Map<string, AudioBuffer>();
  private loading = new Map<string, Promise<AudioBuffer | null>>();
  private currentBgm: { key: BgmKey; source: AudioBufferSourceNode; gain: GainNode } | null = null;
  private wantedBgm: BgmKey | null = null;
  /** 同じSEが同時に鳴りすぎないための最終再生時刻 */
  private lastPlayed = new Map<string, number>();

  /** AudioContext を作成（最初のユーザー操作時に呼ぶ） */
  unlock(): void {
    if (!this.ctx) {
      const Ctx = window.AudioContext || (window as any).webkitAudioContext;
      if (!Ctx) return;
      this.ctx = new Ctx();
      this.seGain = this.ctx.createGain();
      this.bgmGain = this.ctx.createGain();
      this.seGain.connect(this.ctx.destination);
      this.bgmGain.connect(this.ctx.destination);
      this.applyVolume();
      bus.on('settingsChanged', () => this.applyVolume());
      // SE を先読み
      (Object.keys(SE) as SeKey[]).forEach((k) => this.load(SE[k].file));
      if (this.wantedBgm) this.playBgm(this.wantedBgm);
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }

  private applyVolume(): void {
    if (!this.ctx) return;
    const s = settings.current;
    this.seGain.gain.value = s.seVolume;
    this.bgmGain.gain.setTargetAtTime(s.bgmVolume, this.ctx.currentTime, 0.05);
  }

  /** 音声ファイルを読み込んでデコードする（失敗しても null を返すだけでゲームは止めない） */
  private load(file: string): Promise<AudioBuffer | null> {
    if (this.buffers.has(file)) return Promise.resolve(this.buffers.get(file)!);
    if (this.loading.has(file)) return this.loading.get(file)!;
    const p = fetch(`${GAME_CONFIG.ASSET_ROOT}/${file}`)
      .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(r.statusText))))
      .then((ab) => this.ctx!.decodeAudioData(ab))
      .then((buf) => {
        this.buffers.set(file, buf);
        return buf;
      })
      .catch((e) => {
        console.warn('[Audio] load failed:', file, e);
        return null;
      });
    this.loading.set(file, p);
    return p;
  }

  /**
   * 効果音を鳴らす
   * @param opts.pitch   再生速度（1=そのまま）
   * @param opts.volume  音量倍率
   */
  play(key: SeKey, opts: { pitch?: number; volume?: number; vary?: boolean } = {}): void {
    if (!this.ctx) return;
    const def = SE[key];
    const now = performance.now();
    if (now - (this.lastPlayed.get(key) ?? 0) < 30) return; // 30ms以内の連打は間引く
    this.lastPlayed.set(key, now);
    const buf = this.buffers.get(def.file);
    if (!buf) {
      this.load(def.file);
      return;
    }
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const vary = opts.vary ?? true;
    src.playbackRate.value = (opts.pitch ?? 1) * (vary ? 0.95 + Math.random() * 0.1 : 1);
    const g = this.ctx.createGain();
    g.gain.value = def.volume * (opts.volume ?? 1);
    src.connect(g).connect(this.seGain);
    src.start();
  }

  /** BGM を再生（同じ曲なら何もしない）。クロスフェードで切り替える */
  async playBgm(key: BgmKey, fadeSec = 1.2): Promise<void> {
    this.wantedBgm = key;
    if (!this.ctx) return;
    if (this.currentBgm?.key === key) return;
    const buf = await this.load(BGM[key].file);
    if (!buf || this.wantedBgm !== key || this.currentBgm?.key === key) return;
    this.fadeOutCurrent(fadeSec);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    // MP3 は先頭と末尾にエンコーダーが無音を足すため、ループ範囲から除外して継ぎ目の途切れを防ぐ
    const [ls, le] = this.loopRange(buf);
    src.loopStart = ls;
    src.loopEnd = le;
    const g = this.ctx.createGain();
    g.gain.value = 0;
    g.gain.linearRampToValueAtTime(BGM[key].volume, this.ctx.currentTime + fadeSec);
    src.connect(g).connect(this.bgmGain);
    src.start(0, ls);
    this.currentBgm = { key, source: src, gain: g };
  }

  /** 先頭・末尾の無音を除いたループ範囲（秒）を求める */
  private loopRange(buf: AudioBuffer): [number, number] {
    const d = buf.getChannelData(0);
    const th = 1e-4;
    let s = 0;
    while (s < d.length && Math.abs(d[s]) < th) s++;
    let e = d.length - 1;
    while (e > s && Math.abs(d[e]) < th) e--;
    return [s / buf.sampleRate, (e + 1) / buf.sampleRate];
  }

  /** BGM を止める */
  stopBgm(fadeSec = 1): void {
    this.wantedBgm = null;
    this.fadeOutCurrent(fadeSec);
  }

  private fadeOutCurrent(fadeSec: number): void {
    if (!this.ctx || !this.currentBgm) return;
    const { source, gain } = this.currentBgm;
    const t = this.ctx.currentTime;
    gain.gain.cancelScheduledValues(t);
    gain.gain.setValueAtTime(gain.gain.value, t);
    gain.gain.linearRampToValueAtTime(0, t + fadeSec);
    source.stop(t + fadeSec + 0.05);
    this.currentBgm = null;
  }

  /** BGM を一時的に小さくする（演出用：ボス登場など） */
  duck(on: boolean): void {
    if (!this.ctx) return;
    const target = on ? settings.current.bgmVolume * 0.3 : settings.current.bgmVolume;
    this.bgmGain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.2);
  }
}

export const Audio = new AudioManagerImpl();
