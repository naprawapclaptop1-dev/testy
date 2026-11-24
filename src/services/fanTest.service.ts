import { FanCurveConfig, FanCurvePoint, FanCurvePreset, FanTestState } from '../types';

export const FAN_CURVE_PRESETS: Record<Exclude<FanCurvePreset, 'custom'>, FanCurvePoint[]> = {
  silent: [
    { id: 'p1', tempC: 35, rpmPct: 15 },
    { id: 'p2', tempC: 50, rpmPct: 24 },
    { id: 'p3', tempC: 65, rpmPct: 40 },
    { id: 'p4', tempC: 78, rpmPct: 68 },
    { id: 'p5', tempC: 90, rpmPct: 95 },
  ],
  balanced: [
    { id: 'p1', tempC: 35, rpmPct: 22 },
    { id: 'p2', tempC: 50, rpmPct: 38 },
    { id: 'p3', tempC: 65, rpmPct: 58 },
    { id: 'p4', tempC: 78, rpmPct: 82 },
    { id: 'p5', tempC: 88, rpmPct: 100 },
  ],
  performance: [
    { id: 'p1', tempC: 32, rpmPct: 32 },
    { id: 'p2', tempC: 48, rpmPct: 52 },
    { id: 'p3', tempC: 62, rpmPct: 75 },
    { id: 'p4', tempC: 74, rpmPct: 92 },
    { id: 'p5', tempC: 82, rpmPct: 100 },
  ],
  turbo: [
    { id: 'p1', tempC: 30, rpmPct: 55 },
    { id: 'p2', tempC: 45, rpmPct: 78 },
    { id: 'p3', tempC: 60, rpmPct: 92 },
    { id: 'p4', tempC: 72, rpmPct: 100 },
    { id: 'p5', tempC: 85, rpmPct: 100 },
  ],
};

export function createDefaultFanCurve(): FanCurveConfig {
  return {
    preset: 'balanced',
    maxRpm: 5000,
    points: FAN_CURVE_PRESETS.balanced.map((p) => ({ ...p })),
  };
}

export function evaluateFanCurvePct(curve: FanCurveConfig, tempC: number): number {
  const pts = [...curve.points].sort((a, b) => a.tempC - b.tempC);
  if (pts.length === 0) return 40;
  if (tempC <= pts[0].tempC) return pts[0].rpmPct;
  if (tempC >= pts[pts.length - 1].tempC) return pts[pts.length - 1].rpmPct;
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i];
    const b = pts[i + 1];
    if (tempC >= a.tempC && tempC <= b.tempC) {
      const span = Math.max(0.001, b.tempC - a.tempC);
      const t = (tempC - a.tempC) / span;
      return Math.round(a.rpmPct + (b.rpmPct - a.rpmPct) * t);
    }
  }
  return pts[pts.length - 1].rpmPct;
}

export function evaluateFanCurveRpm(curve: FanCurveConfig, tempC: number): number {
  const pct = evaluateFanCurvePct(curve, tempC);
  return Math.round((pct / 100) * curve.maxRpm);
}

const FAN_BURN_WORKER = `
let active = false;
let duty = 0.5;
self.onmessage = function(e) {
  if (e.data.cmd === 'set') {
    duty = e.data.duty;
    if (!active && duty > 0) {
      active = true;
      loop();
    } else if (duty <= 0) {
      active = false;
    }
  } else if (e.data.cmd === 'stop') {
    active = false;
  }
};
function loop() {
  if (!active) return;
  const sliceMs = 50;
  const workMs = Math.max(2, sliceMs * duty);
  const t0 = performance.now();
  let x = 1.1337;
  while (performance.now() - t0 < workMs) {
    for (let i = 0; i < 4000; i++) {
      x = Math.sin(x + i * 0.001) * Math.cos(x) + Math.sqrt(Math.abs(x) + 1.2);
    }
  }
  const restMs = Math.max(1, sliceMs - workMs);
  setTimeout(loop, restMs);
}
`;

export class FanTestService {
  private workerUrl: string | null = null;
  private workers: Worker[] = [];
  private timer: number | null = null;
  private state: FanTestState;
  private onUpdate: ((s: FanTestState) => void) | null = null;

  // Optional acoustic noise tracking via microphone
  private micStream: MediaStream | null = null;
  private micCtx: AudioContext | null = null;
  private micAnalyser: AnalyserNode | null = null;
  private micData: Uint8Array<ArrayBuffer> | null = null;

  private elapsedSec = 0;
  private peakAtTurboTempC = 44;
  private cooldownStartTempC = 44;
  private cooldownTicks = 0;
  private fanCurve: FanCurveConfig = createDefaultFanCurve();

  constructor() {
    this.state = this.createInitialState();
  }

  public getFanCurve(): FanCurveConfig {
    return {
      ...this.fanCurve,
      points: this.fanCurve.points.map((p) => ({ ...p })),
    };
  }

  public setFanCurve(curve: FanCurveConfig): void {
    const sorted = [...curve.points]
      .map((p) => ({
        id: p.id,
        tempC: Math.max(30, Math.min(100, Math.round(p.tempC))),
        rpmPct: Math.max(0, Math.min(100, Math.round(p.rpmPct))),
      }))
      .sort((a, b) => a.tempC - b.tempC);
    this.fanCurve = {
      preset: curve.preset,
      maxRpm: Math.max(1500, Math.min(8000, Math.round(curve.maxRpm))),
      points: sorted.length >= 2 ? sorted : createDefaultFanCurve().points,
    };
  }

  public applyCurvePreset(preset: Exclude<FanCurvePreset, 'custom'>): FanCurveConfig {
    this.fanCurve = {
      preset,
      maxRpm: this.fanCurve.maxRpm,
      points: FAN_CURVE_PRESETS[preset].map((p) => ({ ...p })),
    };
    return this.getFanCurve();
  }

  public createInitialState(): FanTestState {
    return {
      running: false,
      stage: 'idle',
      stageLabel: 'Gotowy do testu chłodzenia i rozruchu wentylatorów',
      progressPct: 0,
      targetLoadPct: 0,
      estRpm: 1150,
      peakRpm: 1150,
      currentTempC: 43,
      peakTempC: 43,
      baselineNoiseDb: null,
      peakNoiseDb: null,
      currentNoiseDb: null,
      noiseDeltaDb: null,
      cooldownRateCPerMin: 0,
      micMonitoring: false,
      verdict: 'OCZEKIWANIE',
      history: [],
    };
  }

  public getState(): FanTestState {
    return { ...this.state, history: [...this.state.history] };
  }

  public isRunning(): boolean {
    return this.state.running;
  }

  private getWorkerUrl(): string {
    if (!this.workerUrl) {
      this.workerUrl = URL.createObjectURL(new Blob([FAN_BURN_WORKER], { type: 'application/javascript' }));
    }
    return this.workerUrl;
  }

  private spawnWorkers(duty: number): void {
    const cores = Math.max(2, navigator.hardwareConcurrency || 4);
    if (this.workers.length === 0) {
      const url = this.getWorkerUrl();
      for (let i = 0; i < cores; i++) {
        const w = new Worker(url);
        this.workers.push(w);
      }
    }
    for (const w of this.workers) {
      w.postMessage({ cmd: 'set', duty });
    }
  }

  private terminateWorkers(): void {
    for (const w of this.workers) {
      w.postMessage({ cmd: 'stop' });
      w.terminate();
    }
    this.workers = [];
  }

  private readMicDb(): number | null {
    if (!this.micAnalyser || !this.micData) return null;
    this.micAnalyser.getByteTimeDomainData(this.micData);
    let sumSq = 0;
    for (let i = 0; i < this.micData.length; i++) {
      const n = (this.micData[i] - 128) / 128;
      sumSq += n * n;
    }
    const rms = Math.sqrt(sumSq / this.micData.length);
    // Map normalized RMS to approximate SPL dBA (28 dBA quiet room -> 74 dBA loud turbo fan)
    const rawDb = rms > 0.0001 ? 20 * Math.log10(rms) : -60;
    const estDba = Math.max(24, Math.min(78, Math.round(rawDb + 84)));
    return estDba;
  }

  public async startFanRampTest(
    enableMicAcoustic: boolean,
    onUpdate: (state: FanTestState) => void
  ): Promise<void> {
    this.stop();
    this.onUpdate = onUpdate;
    this.elapsedSec = 0;
    this.cooldownTicks = 0;

    let micOk = false;
    if (enableMicAcoustic && navigator.mediaDevices?.getUserMedia) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        const ctx = new AudioContext();
        const src = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        src.connect(analyser);
        this.micStream = stream;
        this.micCtx = ctx;
        this.micAnalyser = analyser;
        this.micData = new Uint8Array(new ArrayBuffer(analyser.frequencyBinCount));
        micOk = true;
      } catch {
        micOk = false;
      }
    }

    this.state = {
      ...this.createInitialState(),
      running: true,
      stage: 'idle_baseline',
      stageLabel: 'Faza 1/4: Pomiar bazowy spoczynku (0% obciążenia)',
      micMonitoring: micOk,
    };
    this.emit();

    const totalSec = 24;
    this.timer = window.setInterval(() => {
      this.elapsedSec++;
      const sec = this.elapsedSec;
      const noiseDb = this.readMicDb();

      let targetLoad = 0;
      let targetTemp = 43;
      let targetRpm = 1150;

      if (sec <= 3) {
        // Stage 1: Baseline idle (0..3s)
        this.state.stage = 'idle_baseline';
        this.state.stageLabel = 'Faza 1/4: Pomiar bazowy spoczynku (0% obciążenia)';
        targetLoad = 0;
        targetTemp = 42;
        if (noiseDb !== null) {
          this.state.baselineNoiseDb =
            this.state.baselineNoiseDb === null
              ? noiseDb
              : Math.round((this.state.baselineNoiseDb + noiseDb) / 2);
        }
      } else if (sec <= 9) {
        // Stage 2: Medium load (4..9s)
        this.state.stage = 'medium_load';
        this.state.stageLabel = 'Faza 2/4: Średnie obciążenie 55% (Rozpędzanie wg krzywej wentylatora)';
        targetLoad = 55;
        targetTemp = 68;
        this.spawnWorkers(0.55);
      } else if (sec <= 17) {
        // Stage 3: Full Turbo 100% (10..17s)
        this.state.stage = 'max_turbo';
        this.state.stageLabel = 'Faza 3/4: Maksymalne obciążenie Turbo 100% (Test pełnych obrotów)';
        targetLoad = 100;
        targetTemp = 87;
        this.spawnWorkers(0.98);
        this.peakAtTurboTempC = Math.max(this.peakAtTurboTempC, this.state.currentTempC);
        this.cooldownStartTempC = this.state.currentTempC;
      } else if (sec <= totalSec) {
        // Stage 4: Cooldown recovery (18..24s)
        if (this.workers.length > 0) this.terminateWorkers();
        this.state.stage = 'cooldown';
        this.state.stageLabel = 'Faza 4/4: Zrzut obciążenia — test tempa schładzania i wyciszania';
        targetLoad = 0;
        targetTemp = 45;
        this.cooldownTicks++;
      }

      const jitterTemp = (Math.random() - 0.5) * 1.1;
      this.state.currentTempC = Number(
        (this.state.currentTempC + (targetTemp - this.state.currentTempC) * 0.28 + jitterTemp).toFixed(1)
      );
      this.state.peakTempC = Math.max(this.state.peakTempC, this.state.currentTempC);

      targetRpm = evaluateFanCurveRpm(this.fanCurve, this.state.currentTempC);
      const jitterRpm = Math.round((Math.random() - 0.5) * 65);
      this.state.estRpm = Math.max(
        0,
        Math.round(this.state.estRpm + (targetRpm - this.state.estRpm) * 0.36 + jitterRpm)
      );
      this.state.peakRpm = Math.max(this.state.peakRpm, this.state.estRpm);
      this.state.targetLoadPct = targetLoad;
      this.state.progressPct = Math.min(100, Math.round((sec / totalSec) * 100));

      if (noiseDb !== null) {
        this.state.currentNoiseDb = noiseDb;
        this.state.peakNoiseDb =
          this.state.peakNoiseDb === null ? noiseDb : Math.max(this.state.peakNoiseDb, noiseDb);
        if (this.state.baselineNoiseDb !== null) {
          this.state.noiseDeltaDb = Math.max(0, this.state.peakNoiseDb - this.state.baselineNoiseDb);
        }
      }

      if (this.cooldownTicks > 0) {
        const dropC = Math.max(0, this.cooldownStartTempC - this.state.currentTempC);
        this.state.cooldownRateCPerMin = Number(((dropC / this.cooldownTicks) * 60).toFixed(1));
      }

      this.state.history.push({
        sec,
        rpm: this.state.estRpm,
        tempC: this.state.currentTempC,
        db: noiseDb,
      });

      if (sec >= totalSec) {
        this.finish();
      } else {
        this.emit();
      }
    }, 1000);
  }

  private finish(): void {
    this.terminateWorkers();
    this.stopMic();
    if (this.timer !== null) {
      window.clearInterval(this.timer);
      this.timer = null;
    }

    const loud = this.state.noiseDeltaDb !== null && this.state.noiseDeltaDb >= 18;
    const weakCooling = this.state.cooldownRateCPerMin > 0 && this.state.cooldownRateCPerMin < 25;

    this.state.running = false;
    this.state.stage = 'completed';
    this.state.progressPct = 100;
    this.state.targetLoadPct = 0;
    this.state.stageLabel = 'Test wentylatorów i krzywej chłodzenia zakończony';
    this.state.verdict = weakCooling
      ? 'SŁABE SCHŁADZANIE'
      : loud
        ? 'GŁOŚNA PRACA / OBCIĄŻENIE'
        : 'CHŁODZENIE SPRAWNE';
    this.emit();
  }

  public stop(): void {
    this.terminateWorkers();
    this.stopMic();
    if (this.timer !== null) {
      window.clearInterval(this.timer);
      this.timer = null;
    }
    if (this.state.running) {
      this.state.running = false;
      this.state.targetLoadPct = 0;
      this.state.stage = 'idle';
      this.state.stageLabel = 'Test wentylatorów zatrzymany przez użytkownika';
      this.emit();
    }
  }

  private stopMic(): void {
    if (this.micStream) {
      this.micStream.getTracks().forEach((t) => t.stop());
      this.micStream = null;
    }
    if (this.micCtx) {
      void this.micCtx.close();
      this.micCtx = null;
    }
    this.micAnalyser = null;
    this.micData = null;
  }

  private emit(): void {
    this.onUpdate?.(this.getState());
  }
}

export const fanTestService = new FanTestService();
