// =============================================================
// Particles.ts  【View/演出：パーティクル（塵・火の粉・血しぶき）】
// -------------------------------------------------------------
// fx レイヤーの canvas に、軽量なパーティクルを描画する。
//  - 環境パーティクル：画面を漂う塵・火の粉・灰（雰囲気づくり）
//  - バースト：攻撃が当たった時の火花・血しぶき・回復の光など
// 画質設定（low/medium/high）で量を変え、Steam Deck でも重くならないようにする。
// =============================================================
import { settings } from '@/core/Settings';

interface P {
  x: number; y: number; vx: number; vy: number;
  life: number; max: number; size: number;
  color: string; gravity: number; drag: number;
  glow: boolean; ambient: boolean; shape: 'dot' | 'spark';
}

export type AmbientKind = 'dust' | 'embers' | 'ash' | 'spores' | 'none';

export class Particles {
  private ctx: CanvasRenderingContext2D;
  private list: P[] = [];
  private ambient: AmbientKind = 'dust';
  private last = performance.now();
  private spawnAcc = 0;

  constructor(private canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext('2d')!;
    requestAnimationFrame((t) => this.loop(t));
  }

  /** 画質に応じた量の倍率 */
  private get density(): number {
    const q = settings.current.quality;
    return q === 'low' ? 0.25 : q === 'medium' ? 0.6 : 1;
  }

  setAmbient(kind: AmbientKind): void {
    this.ambient = kind;
  }

  /**
   * 1点から飛び散るパーティクル
   * @param kind hit=火花 / blood=血 / heal=回復の光 / block=青い破片 / death=黒い霧 / gold=金貨のきらめき
   */
  burst(x: number, y: number, kind: 'hit' | 'blood' | 'heal' | 'block' | 'death' | 'gold' | 'buff' | 'debuff', power = 1): void {
    const n = Math.round((kind === 'death' ? 60 : 26) * power * Math.max(0.35, this.density));
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      let sp = (2 + Math.random() * 7) * power;
      let color = '#ffd27a';
      let gravity = 0.18;
      let size = 2 + Math.random() * 3;
      let life = 30 + Math.random() * 30;
      let glow = true;
      let shape: P['shape'] = 'spark';
      let vy0 = 0;
      switch (kind) {
        case 'blood': color = ['#8a0000', '#b30000', '#5a0000'][i % 3]; gravity = 0.35; glow = false; shape = 'dot'; size = 2 + Math.random() * 5; break;
        case 'heal': color = ['#7dffb0', '#c8ffdc'][i % 2]; gravity = -0.06; sp *= 0.4; vy0 = -1.5; shape = 'dot'; life += 20; break;
        case 'block': color = ['#7fc4ff', '#cfe8ff'][i % 2]; gravity = 0.1; break;
        case 'death': color = ['#1a0a0a', '#3a0b0b', '#000000', '#5a1010'][i % 4]; gravity = -0.04; sp *= 0.5; glow = false; shape = 'dot'; size = 4 + Math.random() * 10; life = 50 + Math.random() * 40; break;
        case 'gold': color = ['#ffe28a', '#ffc94a'][i % 2]; gravity = 0.15; break;
        case 'buff': color = ['#ffb347', '#ffd98a'][i % 2]; gravity = -0.08; sp *= 0.5; vy0 = -2; shape = 'dot'; break;
        case 'debuff': color = ['#a070ff', '#6b3fd1'][i % 2]; gravity = 0.05; sp *= 0.5; shape = 'dot'; break;
      }
      this.list.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp + vy0, life, max: life, size, color, gravity, drag: 0.94, glow, ambient: false, shape });
    }
  }

  private spawnAmbient(): void {
    const W = this.canvas.width;
    const H = this.canvas.height;
    switch (this.ambient) {
      case 'dust':
        this.list.push({ x: Math.random() * W, y: Math.random() * H, vx: (Math.random() - 0.5) * 0.25, vy: (Math.random() - 0.3) * 0.2, life: 400, max: 400, size: 1 + Math.random() * 2, color: 'rgba(220,200,170,0.5)', gravity: 0, drag: 1, glow: false, ambient: true, shape: 'dot' });
        break;
      case 'embers':
        this.list.push({ x: Math.random() * W, y: H + 10, vx: (Math.random() - 0.5) * 0.8, vy: -0.8 - Math.random() * 1.5, life: 500, max: 500, size: 1 + Math.random() * 2.5, color: Math.random() < 0.5 ? '#ff6a2a' : '#ffb15a', gravity: 0, drag: 1, glow: true, ambient: true, shape: 'dot' });
        break;
      case 'ash':
        this.list.push({ x: Math.random() * W, y: -10, vx: (Math.random() - 0.5) * 0.6, vy: 0.4 + Math.random() * 0.8, life: 700, max: 700, size: 1 + Math.random() * 2.5, color: 'rgba(160,160,160,0.6)', gravity: 0, drag: 1, glow: false, ambient: true, shape: 'dot' });
        break;
      case 'spores':
        this.list.push({ x: Math.random() * W, y: Math.random() * H, vx: (Math.random() - 0.5) * 0.4, vy: -0.2 - Math.random() * 0.3, life: 500, max: 500, size: 1.5 + Math.random() * 2, color: '#b4ff9a', gravity: 0, drag: 1, glow: true, ambient: true, shape: 'dot' });
        break;
    }
  }

  /** 前のフレームで何か描いたか（何も無いフレームは消去も省く） */
  private drewLast = true;

  private loop(t: number): void {
    const dt = Math.min(3, (t - this.last) / 16.67);
    this.last = t;
    const ctx = this.ctx;
    if (!this.list.length && this.ambient === 'none') {
      if (this.drewLast) ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      this.drewLast = false;
      requestAnimationFrame((tt) => this.loop(tt));
      return;
    }
    this.drewLast = true;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // 環境パーティクルの補充
    if (this.ambient !== 'none') {
      const target = 70 * this.density;
      const count = this.list.filter((p) => p.ambient).length;
      this.spawnAcc += dt * 0.6;
      while (this.spawnAcc > 1) {
        this.spawnAcc -= 1;
        if (count < target) this.spawnAmbient();
      }
    }

    const alive: P[] = [];
    for (const p of this.list) {
      p.life -= dt;
      if (p.life <= 0) continue;
      p.vx *= Math.pow(p.drag, dt);
      p.vy = p.vy * Math.pow(p.drag, dt) + p.gravity * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.ambient) p.x += Math.sin((t / 1000) + p.y * 0.01) * 0.15;
      const k = p.life / p.max;
      const alpha = p.ambient ? Math.min(1, (1 - k) * 4, k * 3) : Math.min(1, k * 1.6);
      ctx.globalAlpha = alpha;
      ctx.globalCompositeOperation = p.glow ? 'lighter' : 'source-over';
      ctx.fillStyle = p.color;
      if (p.shape === 'spark') {
        ctx.strokeStyle = p.color;
        ctx.lineWidth = p.size * 0.8;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x - p.vx * 2.2, p.y - p.vy * 2.2);
        ctx.stroke();
      } else {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * (p.ambient ? 1 : 0.5 + k * 0.5), 0, Math.PI * 2);
        ctx.fill();
      }
      alive.push(p);
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    this.list = alive;
    requestAnimationFrame((tt) => this.loop(tt));
  }
}
