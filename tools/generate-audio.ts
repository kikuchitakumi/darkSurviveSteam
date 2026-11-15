// =============================================================
// generate-audio.ts  【ツール：仮の効果音(SE)・BGMを自動生成】
// -------------------------------------------------------------
// 実行: npm run gen:audio
//
// 外部素材を使わず、プログラム（簡易シンセサイザー）で音を合成する。
//  - SE  : public/assets/audio/se/*.wav（短いので無圧縮WAV）
//  - BGM : public/assets/audio/bgm/*.mp3（ループ用。容量削減のためMP3）
// 既にファイルがある場合はスキップする（本番素材を上書きしないため）。
// 全て作り直す時は `npm run gen:audio -- --force`
//
// 音の一覧は src/data/audio.ts。ここにある「レシピ」で音を作っている。
// =============================================================
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Mp3Encoder } from '@breezystack/lamejs';
import { BGM, SE } from '../src/data/audio';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'public', 'assets');
const FORCE = process.argv.includes('--force');

// =============================================================
// シンセサイザーの部品
// =============================================================
let SR = 22050;
type Wave = 'sine' | 'saw' | 'square' | 'tri';

/** 決まった乱数（毎回同じ音になるように） */
function makeRng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
let rand = makeRng(1);

const mtof = (m: number) => 440 * Math.pow(2, (m - 69) / 12);
const buf = (sec: number) => new Float32Array(Math.ceil(sec * SR));

function wave(type: Wave, ph: number): number {
  const p = ph - Math.floor(ph);
  switch (type) {
    case 'sine': return Math.sin(p * Math.PI * 2);
    case 'saw': return 2 * p - 1;
    case 'square': return p < 0.5 ? 1 : -1;
    case 'tri': return 1 - 4 * Math.abs(p - 0.5);
  }
}

interface ToneOpts {
  start: number;
  dur: number;
  freq: number | ((t: number) => number);
  type?: Wave;
  vol?: number;
  attack?: number;
  /** 減衰の時定数（秒）。指定すると指数減衰 */
  decay?: number;
  release?: number;
  /** ローパス（1極）カットオフ */
  lp?: number;
  detune?: number;
  vibrato?: [number, number];
}

/** 音を1つ足す */
function tone(out: Float32Array, o: ToneOpts): void {
  const s0 = Math.floor(o.start * SR);
  const rel = o.release ?? 0.05;
  const n = Math.floor((o.dur + rel) * SR);
  const att = o.attack ?? 0.005;
  const vol = o.vol ?? 0.3;
  const type = o.type ?? 'sine';
  let ph = 0;
  let ph2 = 0.3;
  let y = 0;
  const a = o.lp ? 1 - Math.exp((-2 * Math.PI * o.lp) / SR) : 1;
  for (let i = 0; i < n; i++) {
    const idx = s0 + i;
    if (idx < 0 || idx >= out.length) continue;
    const t = i / SR;
    let f = typeof o.freq === 'function' ? o.freq(t) : o.freq;
    if (o.vibrato) f *= 1 + Math.sin(t * Math.PI * 2 * o.vibrato[0]) * o.vibrato[1];
    ph += f / SR;
    let v = wave(type, ph);
    if (o.detune) {
      ph2 += (f * (1 + o.detune)) / SR;
      v = (v + wave(type, ph2)) * 0.5;
    }
    let env = t < att ? t / att : 1;
    if (o.decay) env *= Math.exp(-(t - Math.min(t, att)) / o.decay);
    if (t > o.dur) env *= Math.max(0, 1 - (t - o.dur) / rel);
    y += a * (v - y);
    out[idx] += y * env * vol;
  }
}

interface NoiseOpts {
  start: number;
  dur: number;
  vol?: number;
  attack?: number;
  decay?: number;
  release?: number;
  lp?: number | ((t: number) => number);
  hp?: number;
}

/** ノイズを足す（風・打撃・シャッフル音など） */
function noise(out: Float32Array, o: NoiseOpts): void {
  const s0 = Math.floor(o.start * SR);
  const rel = o.release ?? 0.02;
  const n = Math.floor((o.dur + rel) * SR);
  const att = o.attack ?? 0.002;
  const vol = o.vol ?? 0.3;
  let lpY = 0;
  let hpY = 0;
  let hpX = 0;
  const hpA = o.hp ? Math.exp((-2 * Math.PI * o.hp) / SR) : 0;
  for (let i = 0; i < n; i++) {
    const idx = s0 + i;
    if (idx < 0 || idx >= out.length) continue;
    const t = i / SR;
    let x = rand() * 2 - 1;
    if (o.lp) {
      const fc = typeof o.lp === 'function' ? o.lp(t) : o.lp;
      const a = 1 - Math.exp((-2 * Math.PI * fc) / SR);
      lpY += a * (x - lpY);
      x = lpY;
    }
    if (o.hp) {
      const yv = hpA * (hpY + x - hpX);
      hpX = x;
      hpY = yv;
      x = yv;
    }
    let env = t < att ? t / att : 1;
    if (o.decay) env *= Math.exp(-t / o.decay);
    if (t > o.dur) env *= Math.max(0, 1 - (t - o.dur) / rel);
    out[idx] += x * env * vol;
  }
}

/** キック（バスドラム） */
function kick(out: Float32Array, start: number, vol = 0.9, pitch = 1): void {
  tone(out, { start, dur: 0.35, freq: (t) => (50 + 120 * Math.exp(-t * 30)) * pitch, vol, decay: 0.12, attack: 0.001 });
  noise(out, { start, dur: 0.02, vol: vol * 0.3, lp: 3000, decay: 0.01 });
}
function snare(out: Float32Array, start: number, vol = 0.4): void {
  noise(out, { start, dur: 0.2, vol, lp: 6000, hp: 800, decay: 0.06 });
  tone(out, { start, dur: 0.1, freq: 190, vol: vol * 0.5, decay: 0.04 });
}
function hat(out: Float32Array, start: number, vol = 0.12, open = false): void {
  noise(out, { start, dur: open ? 0.2 : 0.04, vol, hp: 7000, decay: open ? 0.08 : 0.015 });
}
/** 金属的な音（非整数倍音） */
function metal(out: Float32Array, start: number, base: number, vol = 0.2, decay = 0.4): void {
  for (const r of [1, 1.47, 2.09, 2.76, 3.52]) tone(out, { start, dur: decay * 3, freq: base * r, vol: vol / (r * 1.2), decay: decay / Math.sqrt(r) });
}

/** シュレーダー型リバーブ（残響） */
function reverb(inp: Float32Array, mix = 0.3, room = 0.84): Float32Array {
  const combs = [1557, 1617, 1491, 1422].map((d) => Math.floor((d * SR) / 44100));
  const aps = [225, 556].map((d) => Math.floor((d * SR) / 44100));
  const wet = new Float32Array(inp.length);
  for (const d of combs) {
    const line = new Float32Array(d);
    let p = 0;
    let lp = 0;
    for (let i = 0; i < inp.length; i++) {
      const y = line[p];
      lp = lp * 0.25 + y * 0.75;
      line[p] = inp[i] + lp * room;
      p = (p + 1) % d;
      wet[i] += y * 0.25;
    }
  }
  for (const d of aps) {
    const line = new Float32Array(d);
    let p = 0;
    for (let i = 0; i < wet.length; i++) {
      const b = line[p];
      const y = -wet[i] + b;
      line[p] = wet[i] + b * 0.5;
      wet[i] = y;
      p = (p + 1) % d;
    }
  }
  const out = new Float32Array(inp.length);
  for (let i = 0; i < inp.length; i++) out[i] = inp[i] * (1 - mix * 0.5) + wet[i] * mix;
  return out;
}

function lowpass(inp: Float32Array, fc: number): Float32Array {
  const a = 1 - Math.exp((-2 * Math.PI * fc) / SR);
  const out = new Float32Array(inp.length);
  let y = 0;
  for (let i = 0; i < inp.length; i++) out[i] = y += a * (inp[i] - y);
  return out;
}

function drive(inp: Float32Array, amt: number): Float32Array {
  return inp.map((x) => Math.tanh(x * amt) / Math.tanh(amt));
}

function normalize(inp: Float32Array, peak = 0.89): Float32Array {
  let m = 0;
  for (const v of inp) m = Math.max(m, Math.abs(v));
  return m > 0 ? inp.map((v) => (v / m) * peak) : inp;
}

/** ループ用：末尾の余韻を先頭に重ねて、継ぎ目を自然にする */
function wrapLoop(full: Float32Array, loopLen: number): Float32Array {
  const out = full.slice(0, loopLen);
  for (let i = loopLen; i < full.length; i++) out[i - loopLen] += full[i];
  return out;
}

/** 短いフェード（クリックノイズ防止） */
function fadeEdges(inp: Float32Array, ms = 4): Float32Array {
  const n = Math.floor((ms / 1000) * SR);
  for (let i = 0; i < n && i < inp.length; i++) {
    inp[i] *= i / n;
    inp[inp.length - 1 - i] *= i / n;
  }
  return inp;
}

// =============================================================
// ファイル書き出し
// =============================================================
function toInt16(f: Float32Array): Int16Array {
  const o = new Int16Array(f.length);
  for (let i = 0; i < f.length; i++) o[i] = Math.max(-32768, Math.min(32767, Math.round(f[i] * 32767)));
  return o;
}

function writeWav(path: string, data: Float32Array): void {
  const pcm = toInt16(data);
  const b = Buffer.alloc(44 + pcm.length * 2);
  b.write('RIFF', 0);
  b.writeUInt32LE(36 + pcm.length * 2, 4);
  b.write('WAVE', 8);
  b.write('fmt ', 12);
  b.writeUInt32LE(16, 16);
  b.writeUInt16LE(1, 20);
  b.writeUInt16LE(1, 22);
  b.writeUInt32LE(SR, 24);
  b.writeUInt32LE(SR * 2, 28);
  b.writeUInt16LE(2, 32);
  b.writeUInt16LE(16, 34);
  b.write('data', 36);
  b.writeUInt32LE(pcm.length * 2, 40);
  for (let i = 0; i < pcm.length; i++) b.writeInt16LE(pcm[i], 44 + i * 2);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, b);
}

function writeMp3(path: string, data: Float32Array, kbps = 96): void {
  const pcm = toInt16(data);
  const enc = new Mp3Encoder(1, SR, kbps);
  const chunks: Uint8Array[] = [];
  for (let i = 0; i < pcm.length; i += 1152) {
    const c = enc.encodeBuffer(pcm.subarray(i, i + 1152));
    if (c.length) chunks.push(new Uint8Array(c));
  }
  const end = enc.flush();
  if (end.length) chunks.push(new Uint8Array(end));
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, Buffer.concat(chunks.map((c) => Buffer.from(c))));
}

// =============================================================
// 効果音（SE）のレシピ
// =============================================================
const SE_RECIPES: Record<string, () => Float32Array> = {
  se_click: () => { const o = buf(0.12); tone(o, { start: 0, dur: 0.05, freq: (t) => 1300 - t * 6000, vol: 0.5, decay: 0.03 }); noise(o, { start: 0, dur: 0.01, vol: 0.2, lp: 4000 }); return o; },
  se_hover: () => { const o = buf(0.06); tone(o, { start: 0, dur: 0.03, freq: 2400, vol: 0.25, decay: 0.012 }); return o; },
  se_cancel: () => { const o = buf(0.18); tone(o, { start: 0, dur: 0.1, freq: (t) => 700 - t * 3000, type: 'tri', vol: 0.4, decay: 0.05 }); return o; },
  se_error: () => { const o = buf(0.3); tone(o, { start: 0, dur: 0.08, freq: 140, type: 'square', vol: 0.25, lp: 1200 }); tone(o, { start: 0.11, dur: 0.1, freq: 110, type: 'square', vol: 0.25, lp: 1200 }); return o; },
  se_text: () => { const o = buf(0.03); tone(o, { start: 0, dur: 0.012, freq: 1700, vol: 0.3, decay: 0.006 }); return o; },
  se_card_draw: () => { const o = buf(0.18); noise(o, { start: 0, dur: 0.12, vol: 0.5, lp: (t) => 1500 + t * 30000, hp: 600, attack: 0.02, decay: 0.05 }); return o; },
  se_card_play: () => { const o = buf(0.35); noise(o, { start: 0, dur: 0.15, vol: 0.5, lp: (t) => 6000 - t * 25000, hp: 300, attack: 0.01, decay: 0.08 }); tone(o, { start: 0.05, dur: 0.15, freq: (t) => 160 - t * 300, vol: 0.5, decay: 0.06 }); return o; },
  se_card_exhaust: () => { const o = buf(0.7); noise(o, { start: 0, dur: 0.6, vol: 0.4, lp: 2500, hp: 400, attack: 0.05, decay: 0.25 }); for (let i = 0; i < 14; i++) noise(o, { start: rand() * 0.5, dur: 0.01, vol: 0.5, hp: 3000, decay: 0.004 }); tone(o, { start: 0, dur: 0.4, freq: (t) => 300 - t * 400, type: 'saw', vol: 0.12, lp: 900, decay: 0.2 }); return o; },
  se_shuffle: () => { const o = buf(0.6); for (let i = 0; i < 6; i++) noise(o, { start: i * 0.07, dur: 0.06, vol: 0.35, lp: 5000, hp: 1200, attack: 0.01, decay: 0.03 }); return o; },
  se_slash: () => { const o = buf(0.35); noise(o, { start: 0, dur: 0.14, vol: 0.7, lp: (t) => 9000 - t * 40000, hp: 1500, attack: 0.008, decay: 0.06 }); metal(o, 0.02, 1900, 0.12, 0.08); return reverb(o, 0.15); },
  se_hit: () => { const o = buf(0.4); kick(o, 0, 0.9, 1.3); noise(o, { start: 0, dur: 0.08, vol: 0.5, lp: 2500, decay: 0.03 }); return drive(o, 2); },
  se_crit: () => { const o = buf(0.9); kick(o, 0, 1, 1); noise(o, { start: 0, dur: 0.15, vol: 0.6, lp: 6000, decay: 0.05 }); metal(o, 0.0, 880, 0.3, 0.35); tone(o, { start: 0, dur: 0.5, freq: (t) => 1760 + t * 400, vol: 0.15, decay: 0.2 }); return reverb(drive(o, 2.5), 0.25); },
  se_block: () => { const o = buf(0.6); metal(o, 0, 620, 0.35, 0.18); noise(o, { start: 0, dur: 0.03, vol: 0.4, hp: 2000, decay: 0.01 }); return reverb(o, 0.2); },
  se_buff: () => { const o = buf(0.7); [62, 66, 69, 74].forEach((m, i) => tone(o, { start: i * 0.06, dur: 0.25, freq: mtof(m + 12), type: 'tri', vol: 0.25, decay: 0.15 })); return reverb(o, 0.3); },
  se_debuff: () => { const o = buf(0.8); tone(o, { start: 0, dur: 0.5, freq: (t) => 400 - t * 400, type: 'saw', vol: 0.2, lp: 1200, detune: 0.03 }); tone(o, { start: 0, dur: 0.5, freq: (t) => 566 - t * 560, type: 'saw', vol: 0.15, lp: 1200 }); return reverb(o, 0.3); },
  se_heal: () => { const o = buf(1.0); [74, 78, 81, 86, 90].forEach((m, i) => tone(o, { start: i * 0.07, dur: 0.4, freq: mtof(m), vol: 0.16, decay: 0.3, vibrato: [6, 0.01] })); return reverb(o, 0.45); },
  se_enemy_attack: () => { const o = buf(0.5); tone(o, { start: 0, dur: 0.3, freq: (t) => 90 - t * 60, type: 'saw', vol: 0.4, lp: 600, vibrato: [30, 0.1] }); noise(o, { start: 0.05, dur: 0.18, vol: 0.4, lp: (t) => 4000 - t * 15000, hp: 400, attack: 0.03, decay: 0.08 }); return drive(o, 2); },
  se_player_hurt: () => { const o = buf(0.6); kick(o, 0, 1, 0.8); noise(o, { start: 0, dur: 0.25, vol: 0.5, lp: 1500, decay: 0.1 }); tone(o, { start: 0, dur: 0.3, freq: (t) => 220 - t * 300, type: 'square', vol: 0.15, lp: 800 }); return drive(o, 3); },
  se_evade: () => { const o = buf(0.3); noise(o, { start: 0, dur: 0.2, vol: 0.5, lp: (t) => 2000 + t * 20000, hp: 1000, attack: 0.06, decay: 0.08 }); return o; },
  se_enemy_die: () => { const o = buf(1.3); tone(o, { start: 0, dur: 0.9, freq: (t) => 160 * Math.exp(-t * 2), type: 'saw', vol: 0.4, lp: 900, vibrato: [18, 0.08] }); noise(o, { start: 0.1, dur: 0.9, vol: 0.35, lp: 1200, decay: 0.4 }); kick(o, 0, 0.6, 0.7); return reverb(drive(o, 2), 0.35); },
  se_gold: () => { const o = buf(0.6); tone(o, { start: 0, dur: 0.15, freq: 1980, vol: 0.25, decay: 0.08 }); tone(o, { start: 0.07, dur: 0.3, freq: 2640, vol: 0.25, decay: 0.15 }); metal(o, 0.07, 3200, 0.05, 0.1); return reverb(o, 0.2); },
  se_levelup: () => { const o = buf(1.6); [62, 66, 69, 74, 78, 81].forEach((m, i) => tone(o, { start: i * 0.08, dur: 0.6, freq: mtof(m + 12), type: 'tri', vol: 0.18, decay: 0.5 })); tone(o, { start: 0.5, dur: 0.8, freq: mtof(86), vol: 0.15, decay: 0.6, vibrato: [5, 0.01] }); return reverb(o, 0.45); },
  se_door: () => { const o = buf(1.6); tone(o, { start: 0, dur: 0.9, freq: (t) => 180 + Math.sin(t * 23) * 40 + t * 60, type: 'saw', vol: 0.18, lp: 1400, attack: 0.1 }); noise(o, { start: 0, dur: 0.9, vol: 0.12, lp: 900, attack: 0.1 }); kick(o, 1.0, 0.8, 0.6); noise(o, { start: 1.0, dur: 0.3, vol: 0.3, lp: 600, decay: 0.15 }); return reverb(o, 0.5, 0.88); },
  se_chest: () => { const o = buf(1.5); tone(o, { start: 0, dur: 0.5, freq: (t) => 250 + Math.sin(t * 30) * 50, type: 'saw', vol: 0.15, lp: 1500, attack: 0.05 }); [79, 83, 86, 91].forEach((m, i) => tone(o, { start: 0.45 + i * 0.07, dur: 0.5, freq: mtof(m), vol: 0.14, decay: 0.4 })); return reverb(o, 0.4); },
  se_heartbeat: () => { const o = buf(0.9); kick(o, 0, 1, 0.55); kick(o, 0.22, 0.75, 0.5); return lowpass(o, 400); },
  se_roll: () => { const o = buf(0.25); tone(o, { start: 0, dur: 0.05, freq: 900, type: 'square', vol: 0.15, lp: 3000, decay: 0.03 }); metal(o, 0.02, 1400, 0.08, 0.06); return o; },
  se_talent: () => { const o = buf(2.2); [50, 57, 62, 66, 69, 74].forEach((m) => tone(o, { start: 0, dur: 1.2, freq: mtof(m + 12), type: 'saw', vol: 0.06, lp: 2500, attack: 0.3, detune: 0.004 })); [86, 90, 93, 98].forEach((m, i) => tone(o, { start: 0.2 + i * 0.1, dur: 0.6, freq: mtof(m), vol: 0.1, decay: 0.5 })); return reverb(o, 0.5, 0.88); },
  se_turn: () => { const o = buf(1.4); metal(o, 0, 220, 0.3, 0.6); return reverb(o, 0.35); },
  se_victory: () => { const o = buf(2.6); [50, 53, 57].forEach((m) => tone(o, { start: 0, dur: 0.35, freq: mtof(m + 12), type: 'saw', vol: 0.1, lp: 2000 })); [50, 54, 57, 62].forEach((m) => tone(o, { start: 0.4, dur: 1.4, freq: mtof(m + 12), type: 'saw', vol: 0.09, lp: 2500, detune: 0.004 })); metal(o, 0.4, 440, 0.25, 0.8); kick(o, 0.4, 0.6, 0.8); return reverb(o, 0.4, 0.88); },
  se_defeat: () => { const o = buf(3.5); tone(o, { start: 0, dur: 2.8, freq: (t) => 110 * Math.exp(-t * 0.25), type: 'saw', vol: 0.3, lp: 700, detune: 0.01 }); tone(o, { start: 0, dur: 2.8, freq: (t) => 155.6 * Math.exp(-t * 0.25), type: 'saw', vol: 0.2, lp: 600 }); kick(o, 0, 1, 0.5); noise(o, { start: 0, dur: 2.5, vol: 0.12, lp: 500, decay: 1.2 }); return reverb(o, 0.5, 0.9); },
  se_stun: () => { const o = buf(0.8); [0, 0.08, 0.16].forEach((s) => metal(o, s, 1200 + rand() * 400, 0.12, 0.1)); tone(o, { start: 0, dur: 0.3, freq: 300, type: 'square', vol: 0.06, lp: 1000 }); return reverb(o, 0.3); },
  se_item: () => { const o = buf(0.6); tone(o, { start: 0, dur: 0.08, freq: (t) => 400 + t * 4000, vol: 0.35, decay: 0.05 }); [84, 88, 91].forEach((m, i) => tone(o, { start: 0.08 + i * 0.05, dur: 0.2, freq: mtof(m), vol: 0.12, decay: 0.15 })); return reverb(o, 0.3); },
};

// =============================================================
// BGM のレシピ（ループ）
// =============================================================
/** 和音のパッド（デチューンしたノコギリ波＋ローパス） */
function pad(out: Float32Array, start: number, dur: number, notes: number[], vol = 0.05, lp = 900): void {
  for (const m of notes) tone(out, { start, dur, freq: mtof(m), type: 'saw', vol, lp, attack: Math.min(1.5, dur * 0.3), release: 1.2, detune: 0.006 });
}
/** オルゴール風の音 */
function musicBox(out: Float32Array, start: number, m: number, vol = 0.12): void {
  tone(out, { start, dur: 1.4, freq: mtof(m), vol, decay: 0.6, attack: 0.002 });
  tone(out, { start, dur: 0.8, freq: mtof(m) * 3, vol: vol * 0.25, decay: 0.2, attack: 0.002 });
}
/** 風のようなノイズ */
function wind(out: Float32Array, dur: number, vol = 0.05): void {
  noise(out, { start: 0, dur, vol, lp: (t) => 300 + 200 * Math.sin(t * 0.4) + 120 * Math.sin(t * 1.3), attack: 1 });
}

const BGM_RECIPES: Record<string, () => Float32Array> = {
  // ---- タイトル：重いドローン＋オルゴール ----
  bgm_title: () => {
    const L = 36;
    const o = buf(L + 4);
    tone(o, { start: 0, dur: L + 2, freq: mtof(38), vol: 0.18, attack: 0.01, lp: 400 });
    tone(o, { start: 0, dur: L + 2, freq: mtof(26), type: 'saw', vol: 0.08, lp: 220, detune: 0.004 });
    const chords = [[50, 53, 57], [46, 50, 53], [43, 46, 50], [45, 49, 52]];
    chords.forEach((c, i) => pad(o, i * 9, 9, c, 0.035, 700));
    const scale = [74, 77, 79, 81, 84, 86, 89];
    rand = makeRng(7);
    for (let t = 0.5; t < L - 1; t += 1.2 + rand() * 1.8) musicBox(o, t, scale[Math.floor(rand() * scale.length)], 0.09);
    wind(o, L + 2, 0.06);
    return normalize(wrapLoop(reverb(o, 0.45, 0.88), Math.floor(L * SR)), 0.8);
  },
  // ---- 塔の探索：不穏な環境音 ----
  bgm_tower: () => {
    const L = 32;
    const o = buf(L + 4);
    tone(o, { start: 0, dur: L + 2, freq: mtof(33), type: 'saw', vol: 0.09, lp: 180, detune: 0.003 });
    tone(o, { start: 0, dur: L + 2, freq: mtof(39), type: 'saw', vol: 0.05, lp: 160, detune: 0.004 });
    rand = makeRng(11);
    for (let t = 0.3; t < L - 1; t += 0.8 + rand() * 2.2) tone(o, { start: t, dur: 0.15, freq: (x) => 1600 - x * 4000 + rand() * 300, vol: 0.06, decay: 0.05 }); // 水滴
    for (let t = 3; t < L - 2; t += 6 + rand() * 4) metal(o, t, 90 + rand() * 60, 0.12, 1.2); // 遠くの金属音
    [0, 8, 16, 24].forEach((s, i) => pad(o, s, 8, i % 2 ? [45, 51] : [45, 48], 0.03, 500));
    for (let t = 2; t < L - 2; t += 5 + rand() * 5) musicBox(o, t, [69, 70, 75, 76][Math.floor(rand() * 4)], 0.05);
    wind(o, L + 2, 0.07);
    return normalize(wrapLoop(reverb(o, 0.5, 0.9), Math.floor(L * SR)), 0.75);
  },
  // ---- 通常戦闘：110BPM ----
  bgm_battle: () => battleTrack(110, 16, { bassPattern: [38, 38, 50, 38, 41, 38, 40, 36], drive: 1.8, seed: 21 }),
  // ---- 強敵戦：125BPM ----
  bgm_elite: () => battleTrack(125, 16, { bassPattern: [38, 38, 39, 38, 44, 38, 43, 39], drive: 2.5, sixteenth: true, seed: 33 }),
  // ---- ボス戦：140BPM・重厚 ----
  bgm_boss: () => battleTrack(140, 16, { bassPattern: [38, 38, 44, 38, 38, 44, 43, 41], drive: 3, sixteenth: true, boss: true, seed: 45 }),
  // ---- ショップ：不気味なワルツ ----
  bgm_shop: () => {
    const bpm = 96;
    const beat = 60 / bpm;
    const bars = 16;
    const L = bars * 3 * beat;
    const o = buf(L + 3);
    const melody = [74, 77, 76, 74, 73, 74, 77, 81, 79, 77, 76, 77, 74, 0, 0, 72, 74, 76, 77, 76, 74, 73, 69, 73, 74, 0, 0, 0, 77, 81, 82, 81, 79, 77, 76, 74, 73, 76, 74, 73, 70, 69, 74, 0, 0, 0, 0, 0];
    const chords = [[38, 50, 53, 57], [38, 50, 53, 57], [43, 50, 55, 58], [45, 49, 52, 55]];
    for (let b = 0; b < bars; b++) {
      const ch = chords[Math.floor(b / 1) % 4];
      tone(o, { start: b * 3 * beat, dur: beat * 0.9, freq: mtof(ch[0]), type: 'tri', vol: 0.2, decay: 0.4 });
      for (const k of [1, 2]) ch.slice(1).forEach((m) => tone(o, { start: (b * 3 + k) * beat, dur: beat * 0.4, freq: mtof(m), type: 'tri', vol: 0.04, decay: 0.15 }));
      for (let k = 0; k < 3; k++) {
        const m = melody[(b * 3 + k) % melody.length];
        if (m) musicBox(o, (b * 3 + k) * beat, m, 0.1);
      }
    }
    pad(o, 0, L, [50, 57], 0.015, 600);
    return normalize(wrapLoop(reverb(o, 0.4), Math.floor(L * SR)), 0.75);
  },
  // ---- ゲームオーバー ----
  bgm_gameover: () => {
    const L = 20;
    const o = buf(L + 5);
    tone(o, { start: 0, dur: L + 1, freq: mtof(26), type: 'saw', vol: 0.1, lp: 200, detune: 0.004 });
    const notes = [74, 72, 70, 69, 67, 65, 64, 62];
    notes.forEach((m, i) => { musicBox(o, i * 2.3 + 0.3, m, 0.11); musicBox(o, i * 2.3 + 0.3, m - 12, 0.05); });
    pad(o, 0, 10, [50, 53, 57], 0.03, 500);
    pad(o, 10, 10, [46, 50, 53], 0.03, 500);
    wind(o, L + 1, 0.05);
    return normalize(wrapLoop(reverb(o, 0.55, 0.9), Math.floor(L * SR)), 0.75);
  },
};

/** 戦闘曲を作る共通関数 */
function battleTrack(bpm: number, bars: number, opt: { bassPattern: number[]; drive: number; sixteenth?: boolean; boss?: boolean; seed: number }): Float32Array {
  rand = makeRng(opt.seed);
  const beat = 60 / bpm;
  const L = bars * 4 * beat;
  const o = buf(L + 3);
  const drums = buf(L + 3);
  const bass = buf(L + 3);
  const chords = opt.boss ? [[50, 53, 56], [50, 53, 56], [49, 52, 56], [51, 55, 58]] : [[50, 53, 57], [46, 50, 53], [48, 52, 55], [45, 49, 52]];
  for (let b = 0; b < bars; b++) {
    const t0 = b * 4 * beat;
    // ドラム
    for (let k = 0; k < 4; k++) {
      const t = t0 + k * beat;
      if (k === 0 || k === 2 || (opt.boss && k === 3)) kick(drums, t, 0.9);
      if (k === 2 && b % 2 === 1) kick(drums, t + beat * 0.5, 0.6);
      if (k === 1 || k === 3) snare(drums, t, opt.boss ? 0.45 : 0.32);
      hat(drums, t, 0.08);
      hat(drums, t + beat / 2, 0.1, b % 4 === 3 && k === 3);
      if (opt.sixteenth) { hat(drums, t + beat / 4, 0.05); hat(drums, t + (beat * 3) / 4, 0.05); }
    }
    if (b % 4 === 3) for (let k = 0; k < 4; k++) tone(drums, { start: t0 + 3 * beat + (k * beat) / 4, dur: 0.15, freq: (x) => (180 - k * 25) * Math.exp(-x * 6), vol: 0.35, decay: 0.08 });
    // ベース（8分 / 16分）
    const step = opt.sixteenth ? beat / 4 : beat / 2;
    const steps = opt.sixteenth ? 16 : 8;
    const shift = [0, -4, -2, -5][Math.floor(b / 4) % 4] * (opt.boss ? 0 : 1);
    for (let s = 0; s < steps; s++) {
      const m = opt.bassPattern[s % opt.bassPattern.length] + shift;
      tone(bass, { start: t0 + s * step, dur: step * 0.8, freq: mtof(m), type: 'saw', vol: 0.32, lp: opt.boss ? 700 : 500, decay: step * 1.5 });
    }
    // パッド（4小節ごとに和音）
    if (b % 4 === 0) pad(o, t0, 4 * 4 * beat, chords[(b / 4) % 4], opt.boss ? 0.04 : 0.03, opt.boss ? 1400 : 1000);
    // スタッカートの弦（後半）
    if (b >= bars / 2) {
      const ch = chords[Math.floor(b / 4) % 4];
      for (let s = 0; s < 8; s++) if (rand() < 0.5) tone(o, { start: t0 + (s * beat) / 2, dur: beat * 0.2, freq: mtof(ch[s % 3] + 24), type: 'saw', vol: 0.05, lp: 3000, decay: 0.08 });
    }
    // ボス：三全音のブラス風スタブ＋鐘
    if (opt.boss && b % 2 === 0) {
      for (const m of [50, 56, 62]) tone(o, { start: t0, dur: beat * 1.5, freq: mtof(m), type: 'saw', vol: 0.06, lp: 1800, attack: 0.02, detune: 0.008 });
      metal(o, t0, 147, 0.15, 1.0);
    }
  }
  const mix = new Float32Array(o.length);
  const db = drive(bass, opt.drive);
  for (let i = 0; i < mix.length; i++) mix[i] = o[i] + drums[i] * 0.9 + db[i] * 0.6;
  return normalize(wrapLoop(reverb(mix, 0.18), Math.floor(L * SR)), 0.85);
}

// =============================================================
// 実行
// =============================================================
function main() {
  let made = 0;
  let skipped = 0;
  SR = 22050;
  for (const [key, def] of Object.entries(SE)) {
    const out = join(OUT, def.file);
    if (existsSync(out) && !FORCE) { skipped++; continue; }
    const recipe = SE_RECIPES[key];
    if (!recipe) { console.warn('⚠ SEレシピが無い:', key); continue; }
    rand = makeRng(key.length * 97);
    writeWav(out, fadeEdges(normalize(recipe(), 0.9)));
    made++;
  }
  SR = 44100;
  for (const [key, def] of Object.entries(BGM)) {
    const out = join(OUT, def.file);
    if (existsSync(out) && !FORCE) { skipped++; continue; }
    const recipe = BGM_RECIPES[key];
    if (!recipe) { console.warn('⚠ BGMレシピが無い:', key); continue; }
    process.stdout.write(`  BGM ${key} ... `);
    writeMp3(out, recipe(), 96);
    console.log('ok');
    made++;
  }
  console.log(`✔ 音声生成: ${made} 個作成 / ${skipped} 個スキップ（既存）`);
}

main();
