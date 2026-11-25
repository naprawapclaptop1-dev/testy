export type GameSfxWeaponStyle = 'chaingun' | 'plasma' | 'cannon' | 'torpedo' | 'railgun';

class GameAudioService {
  private ctx: AudioContext | null = null;
  private enabled = true;
  private noiseBuffer: AudioBuffer | null = null;
  private lastShotTs = 0;

  public isEnabled(): boolean {
    return this.enabled;
  }

  public setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  private ensureContext(): AudioContext | null {
    if (!this.enabled || typeof window === 'undefined') return null;
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return null;
    if (!this.ctx) {
      try {
        this.ctx = new AudioCtx();
      } catch {
        return null;
      }
    }
    if (this.ctx.state === 'suspended') {
      void this.ctx.resume().catch(() => {});
    }
    if (!this.noiseBuffer && this.ctx) {
      const length = Math.floor(this.ctx.sampleRate * 0.6);
      const buf = this.ctx.createBuffer(1, length, this.ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < length; i++) {
        data[i] = Math.random() * 2 - 1;
      }
      this.noiseBuffer = buf;
    }
    return this.ctx;
  }

  public playWeaponFire(style: GameSfxWeaponStyle): void {
    const nowMs = performance.now();
    if (nowMs - this.lastShotTs < 55) return;
    this.lastShotTs = nowMs;

    const ctx = this.ensureContext();
    if (!ctx) return;
    const t = ctx.currentTime;

    if (style === 'cannon') {
      // Heavy 120mm tank cannon boom
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(145, t);
      osc.frequency.exponentialRampToValueAtTime(34, t + 0.28);
      gain.gain.setValueAtTime(0.24, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.31);
      this.triggerFilteredNoise(ctx, 0.22, 650, 0.16);
      return;
    }

    if (style === 'chaingun') {
      // Crisp 30mm Apache rotary autocannon thump
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(210, t);
      osc.frequency.exponentialRampToValueAtTime(58, t + 0.08);
      gain.gain.setValueAtTime(0.11, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.09);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.095);
      this.triggerFilteredNoise(ctx, 0.06, 1600, 0.09);
      return;
    }

    if (style === 'torpedo') {
      // Underwater sonar ping + launch bubble rush
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(980, t);
      osc.frequency.exponentialRampToValueAtTime(620, t + 0.24);
      gain.gain.setValueAtTime(0.12, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.26);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.27);
      this.triggerFilteredNoise(ctx, 0.18, 420, 0.08);
      return;
    }

    // Plasma / Railgun laser pulse
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = style === 'railgun' ? 'square' : 'sawtooth';
    osc.frequency.setValueAtTime(style === 'railgun' ? 860 : 680, t);
    osc.frequency.exponentialRampToValueAtTime(style === 'railgun' ? 120 : 190, t + 0.13);
    gain.gain.setValueAtTime(0.1, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.145);
  }

  public playExplosion(isBoss = false): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const t = ctx.currentTime;
    const dur = isBoss ? 0.58 : 0.34;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(isBoss ? 115 : 130, t);
    osc.frequency.exponentialRampToValueAtTime(24, t + dur);
    gain.gain.setValueAtTime(isBoss ? 0.28 : 0.18, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + dur + 0.02);

    this.triggerFilteredNoise(ctx, dur * 0.9, isBoss ? 480 : 820, isBoss ? 0.22 : 0.14);
  }

  public playGateChime(combo = 1): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const t = ctx.currentTime;
    const base = 440 * Math.pow(1.06, Math.min(10, combo - 1));
    [base, base * 1.25, base * 1.5].forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      const st = t + idx * 0.045;
      osc.frequency.setValueAtTime(freq, st);
      gain.gain.setValueAtTime(0.09, st);
      gain.gain.exponentialRampToValueAtTime(0.001, st + 0.22);
      osc.connect(gain).connect(ctx.destination);
      osc.start(st);
      osc.stop(st + 0.23);
    });
  }

  public playStageClear(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const t = ctx.currentTime;
    [523.25, 659.25, 783.99, 1046.5].forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      const st = t + idx * 0.08;
      osc.frequency.setValueAtTime(freq, st);
      gain.gain.setValueAtTime(0.11, st);
      gain.gain.exponentialRampToValueAtTime(0.001, st + 0.32);
      osc.connect(gain).connect(ctx.destination);
      osc.start(st);
      osc.stop(st + 0.34);
    });
  }

  public playRocketLaunch(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const t = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(140, t);
    osc.frequency.exponentialRampToValueAtTime(520, t + 0.18);
    osc.frequency.exponentialRampToValueAtTime(95, t + 0.42);
    gain.gain.setValueAtTime(0.13, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.44);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.45);

    this.triggerFilteredNoise(ctx, 0.38, 1850, 0.11);
  }

  public playNitroBoost(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const t = ctx.currentTime;

    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();
    osc1.type = 'sawtooth';
    osc2.type = 'triangle';
    osc1.frequency.setValueAtTime(110, t);
    osc1.frequency.exponentialRampToValueAtTime(380, t + 0.35);
    osc2.frequency.setValueAtTime(220, t);
    osc2.frequency.exponentialRampToValueAtTime(760, t + 0.35);
    gain.gain.setValueAtTime(0.11, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.48);
    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(ctx.destination);
    osc1.start(t);
    osc2.start(t);
    osc1.stop(t + 0.5);
    osc2.stop(t + 0.5);

    this.triggerFilteredNoise(ctx, 0.42, 2400, 0.09);
  }

  private triggerFilteredNoise(ctx: AudioContext, durationSec: number, cutoffHz: number, volume: number): void {
    if (!this.noiseBuffer) return;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(cutoffHz, t);
    filter.frequency.exponentialRampToValueAtTime(Math.max(80, cutoffHz * 0.2), t + durationSec);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(volume, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + durationSec);
    src.connect(filter).connect(gain).connect(ctx.destination);
    src.start(t);
    src.stop(t + durationSec + 0.02);
  }
}

export const gameAudioService = new GameAudioService();
