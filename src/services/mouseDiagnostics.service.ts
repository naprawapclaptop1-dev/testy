export type MouseButtonKey = 'lmb' | 'mmb' | 'rmb' | 'side4' | 'side5';

export interface MouseClickLatencySample {
  seq: number;
  button: MouseButtonKey;
  buttonLabel: string;
  interClickUs: number | null;
  bounceGapUs: number | null;
  dwellUs: number | null;
  flag: 'OK' | 'CHATTER' | 'DOUBLE_CLICK';
  timestampMs: number;
}

export interface MousePollingHistogramBucket {
  id: string;
  label: string;
  hzRangeLabel: string;
  minMs: number;
  maxMs: number;
  count: number;
  pct: number;
  isAnomaly: boolean;
}

export interface MouseDiagnosticsSnapshot {
  pollingHz: number;
  peakPollingHz: number;
  nominalTierLabel: string;
  targetPollingHz: number; // 0 = auto
  sampleCount: number;
  activeIntervalCount: number;
  meanIntervalUs: number;
  medianIntervalUs: number;
  p99IntervalUs: number;
  minIntervalUs: number;
  maxIntervalUs: number;
  jitterStdDevUs: number;
  stabilityPct: number;
  inconsistencyEvents: number;
  sensorVerdict: 'OCZEKIWANIE' | 'SENSOR WZOROWY' | 'LEKKIE WAHANIA USB' | 'WYKRYTO NIESTABILNOŚĆ SENSORA';
  sensorVerdictNote: string;
  histogram: MousePollingHistogramBucket[];
  clicks: Record<MouseButtonKey, number>;
  scrollDeltaPx: number;
  doubleClickFaults: number;
  chatterFaults: number;
  lastClickLatencyUs: number | null;
  minClickLatencyUs: number | null;
  avgClickLatencyUs: number | null;
  lastDwellUs: number | null;
  recentClicks: MouseClickLatencySample[];
}

const BUTTON_LABELS: Record<MouseButtonKey, string> = {
  lmb: 'LPM',
  mmb: 'ŚPM',
  rmb: 'PPM',
  side4: 'B4 (Wstecz)',
  side5: 'B5 (Dalej)',
};

const HISTOGRAM_DEFS: Array<{
  id: string;
  label: string;
  hzRangeLabel: string;
  minMs: number;
  maxMs: number;
  isAnomaly?: boolean;
}> = [
  { id: 'b_hyper', label: '< 0.75 ms', hzRangeLabel: '>1333 Hz (2K–8K)', minMs: 0, maxMs: 0.75 },
  { id: 'b_1000', label: '0.75–1.25 ms', hzRangeLabel: '~1000 Hz', minMs: 0.75, maxMs: 1.25 },
  { id: 'b_750', label: '1.25–1.75 ms', hzRangeLabel: '~750 Hz', minMs: 1.25, maxMs: 1.75 },
  { id: 'b_500', label: '1.75–2.50 ms', hzRangeLabel: '~500 Hz', minMs: 1.75, maxMs: 2.5 },
  { id: 'b_250', label: '2.50–4.50 ms', hzRangeLabel: '~250 Hz', minMs: 2.5, maxMs: 4.5 },
  { id: 'b_125', label: '4.50–8.50 ms', hzRangeLabel: '~125 Hz', minMs: 4.5, maxMs: 8.5 },
  { id: 'b_vsync', label: '8.50–16.5 ms', hzRangeLabel: '60–115 Hz', minMs: 8.5, maxMs: 16.5 },
  { id: 'b_drop', label: '> 16.5 ms', hzRangeLabel: 'Spadki / Lag', minMs: 16.5, maxMs: 50.0, isAnomaly: true },
];

export function buttonIndexToKey(button: number): MouseButtonKey | null {
  if (button === 0) return 'lmb';
  if (button === 1) return 'mmb';
  if (button === 2) return 'rmb';
  if (button === 3) return 'side4';
  if (button === 4) return 'side5';
  return null;
}

export class MouseDiagnosticsService {
  private pointerTimestampsMs: number[] = [];
  private activeIntervalsMs: number[] = [];
  private bucketCounts = new Array<number>(HISTOGRAM_DEFS.length).fill(0);
  private lastMoveEventMs = 0;
  private peakPollingHz = 0;
  private targetPollingHz = 0; // 0 = auto detect
  private inconsistencyEvents = 0;

  private clicks: Record<MouseButtonKey, number> = {
    lmb: 0,
    mmb: 0,
    rmb: 0,
    side4: 0,
    side5: 0,
  };
  private scrollDeltaPx = 0;
  private doubleClickFaults = 0;
  private chatterFaults = 0;

  private lastDownByButton = new Map<MouseButtonKey, number>();
  private lastUpByButton = new Map<MouseButtonKey, number>();
  private pendingDwellStartByButton = new Map<MouseButtonKey, number>();
  private clickInterUsHistory: number[] = [];
  private lastClickLatencyUs: number | null = null;
  private minClickLatencyUs: number | null = null;
  private lastDwellUs: number | null = null;
  private clickSeq = 0;
  private recentClicks: MouseClickLatencySample[] = [];

  public setTargetPollingHz(hz: number): void {
    this.targetPollingHz = [0, 125, 250, 500, 1000, 2000].includes(hz) ? hz : 0;
  }

  public getTargetPollingHz(): number {
    return this.targetPollingHz;
  }

  public recordPointerMoveTimestamps(timestampsMs: number[], nowMs = performance.now()): void {
    if (timestampsMs.length === 0) return;

    for (const rawTs of timestampsMs) {
      const ts = Number.isFinite(rawTs) && rawTs > 0 ? rawTs : nowMs;
      this.pointerTimestampsMs.push(ts);

      if (this.lastMoveEventMs > 0) {
        const dtMs = ts - this.lastMoveEventMs;
        // Ignore pauses longer than 50 ms (hand lifted or mouse resting) and zero/negative duplicates
        if (dtMs > 0.02 && dtMs <= 50.0) {
          this.activeIntervalsMs.push(dtMs);
          if (this.activeIntervalsMs.length > 600) {
            this.activeIntervalsMs.shift();
          }

          let placed = false;
          for (let b = 0; b < HISTOGRAM_DEFS.length; b++) {
            const def = HISTOGRAM_DEFS[b];
            if (dtMs >= def.minMs && (dtMs < def.maxMs || b === HISTOGRAM_DEFS.length - 1)) {
              this.bucketCounts[b]++;
              placed = true;
              break;
            }
          }
          if (!placed) {
            this.bucketCounts[HISTOGRAM_DEFS.length - 1]++;
          }

          // Detect outlier polling spike during continuous swipe
          if (this.activeIntervalsMs.length >= 16) {
            const recentMed = this.computeRecentMedianMs(24);
            if (recentMed > 0 && (dtMs > recentMed * 2.4 || dtMs > 16.5)) {
              this.inconsistencyEvents++;
            }
          }
        }
      }
      if (ts >= this.lastMoveEventMs) {
        this.lastMoveEventMs = ts;
      }
    }

    const latestTs = this.pointerTimestampsMs[this.pointerTimestampsMs.length - 1] ?? nowMs;
    const cutoff = latestTs - 1000;
    while (this.pointerTimestampsMs.length > 0 && this.pointerTimestampsMs[0] < cutoff) {
      this.pointerTimestampsMs.shift();
    }

    const hz = this.pointerTimestampsMs.length;
    if (hz > this.peakPollingHz) {
      this.peakPollingHz = hz;
    }
  }

  public recordMouseDown(button: number, eventTimestampMs = performance.now()): MouseClickLatencySample | null {
    const key = buttonIndexToKey(button);
    if (!key) return null;

    this.clicks[key]++;
    this.pendingDwellStartByButton.set(key, eventTimestampMs);

    const prevDown = this.lastDownByButton.get(key);
    const prevUp = this.lastUpByButton.get(key);

    let interClickUs: number | null = null;
    if (prevDown !== undefined && eventTimestampMs >= prevDown) {
      interClickUs = Math.max(1, Math.round((eventTimestampMs - prevDown) * 1000));
      this.lastClickLatencyUs = interClickUs;
      this.clickInterUsHistory.push(interClickUs);
      if (this.clickInterUsHistory.length > 120) this.clickInterUsHistory.shift();
      if (this.minClickLatencyUs === null || interClickUs < this.minClickLatencyUs) {
        this.minClickLatencyUs = interClickUs;
      }
    }

    let bounceGapUs: number | null = null;
    if (prevUp !== undefined && eventTimestampMs >= prevUp) {
      bounceGapUs = Math.max(1, Math.round((eventTimestampMs - prevUp) * 1000));
    }

    let flag: MouseClickLatencySample['flag'] = 'OK';
    if (bounceGapUs !== null && bounceGapUs < 25000) {
      flag = 'CHATTER';
      this.chatterFaults++;
      this.doubleClickFaults++;
    } else if (interClickUs !== null && interClickUs < 65000) {
      flag = 'DOUBLE_CLICK';
      this.doubleClickFaults++;
    }

    this.lastDownByButton.set(key, eventTimestampMs);

    const sample: MouseClickLatencySample = {
      seq: ++this.clickSeq,
      button: key,
      buttonLabel: BUTTON_LABELS[key],
      interClickUs,
      bounceGapUs,
      dwellUs: null,
      flag,
      timestampMs: eventTimestampMs,
    };
    this.recentClicks.unshift(sample);
    if (this.recentClicks.length > 14) {
      this.recentClicks.pop();
    }
    return sample;
  }

  public recordMouseUp(button: number, eventTimestampMs = performance.now()): void {
    const key = buttonIndexToKey(button);
    if (!key) return;
    this.lastUpByButton.set(key, eventTimestampMs);

    const downTs = this.pendingDwellStartByButton.get(key);
    if (downTs !== undefined && eventTimestampMs >= downTs) {
      const dwellUs = Math.max(1, Math.round((eventTimestampMs - downTs) * 1000));
      this.lastDwellUs = dwellUs;
      // Attach dwell time to the matching most recent sample for this button
      const match = this.recentClicks.find((c) => c.button === key && c.dwellUs === null);
      if (match) {
        match.dwellUs = dwellUs;
      }
    }
    this.pendingDwellStartByButton.delete(key);
  }

  public recordWheel(deltaY: number): void {
    this.scrollDeltaPx += Math.round(deltaY);
  }

  public reset(): void {
    this.pointerTimestampsMs = [];
    this.activeIntervalsMs = [];
    this.bucketCounts.fill(0);
    this.lastMoveEventMs = 0;
    this.peakPollingHz = 0;
    this.inconsistencyEvents = 0;
    this.clicks = { lmb: 0, mmb: 0, rmb: 0, side4: 0, side5: 0 };
    this.scrollDeltaPx = 0;
    this.doubleClickFaults = 0;
    this.chatterFaults = 0;
    this.lastDownByButton.clear();
    this.lastUpByButton.clear();
    this.pendingDwellStartByButton.clear();
    this.clickInterUsHistory = [];
    this.lastClickLatencyUs = null;
    this.minClickLatencyUs = null;
    this.lastDwellUs = null;
    this.clickSeq = 0;
    this.recentClicks = [];
  }

  private computeRecentMedianMs(count: number): number {
    const slice = this.activeIntervalsMs.slice(-count).sort((a, b) => a - b);
    if (slice.length === 0) return 0;
    return slice[Math.floor(slice.length / 2)];
  }

  public getSnapshot(nowMs = performance.now()): MouseDiagnosticsSnapshot {
    const cutoff = nowMs - 1000;
    const recentPollCount = this.pointerTimestampsMs.filter((t) => t >= cutoff).length;
    const totalBucketCount = this.bucketCounts.reduce((acc, v) => acc + v, 0);

    const histogram: MousePollingHistogramBucket[] = HISTOGRAM_DEFS.map((def, idx) => ({
      id: def.id,
      label: def.label,
      hzRangeLabel: def.hzRangeLabel,
      minMs: def.minMs,
      maxMs: def.maxMs,
      count: this.bucketCounts[idx],
      pct: totalBucketCount > 0 ? Math.round((this.bucketCounts[idx] / totalBucketCount) * 100) : 0,
      isAnomaly: Boolean(def.isAnomaly),
    }));

    let meanUs = 0;
    let medianUs = 0;
    let p99Us = 0;
    let minUs = 0;
    let maxUs = 0;
    let jitterStdDevUs = 0;
    let stabilityPct = 100;

    if (this.activeIntervalsMs.length > 0) {
      const sorted = [...this.activeIntervalsMs].sort((a, b) => a - b);
      const sumMs = sorted.reduce((a, b) => a + b, 0);
      const meanMs = sumMs / sorted.length;
      const medianMs = sorted[Math.floor(sorted.length / 2)];
      const p99Ms = sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.99))];
      const varianceMs = sorted.reduce((acc, v) => acc + (v - meanMs) ** 2, 0) / sorted.length;
      const stdDevMs = Math.sqrt(varianceMs);
      const cv = stdDevMs / Math.max(0.25, medianMs);
      const dropRate = totalBucketCount > 0 ? this.bucketCounts[this.bucketCounts.length - 1] / totalBucketCount : 0;

      meanUs = Math.round(meanMs * 1000);
      medianUs = Math.round(medianMs * 1000);
      p99Us = Math.round(p99Ms * 1000);
      minUs = Math.round(sorted[0] * 1000);
      maxUs = Math.round(sorted[sorted.length - 1] * 1000);
      jitterStdDevUs = Math.round(stdDevMs * 1000);

      let penalty = cv * 48 + dropRate * 90;
      if (this.targetPollingHz > 0 && medianMs > 0) {
        const expectedMs = 1000 / this.targetPollingHz;
        const deviationRatio = Math.abs(medianMs - expectedMs) / expectedMs;
        if (deviationRatio > 0.25) penalty += Math.min(30, deviationRatio * 22);
      }
      stabilityPct = Number(Math.max(15, Math.min(100, 100 - penalty)).toFixed(1));
    }

    const estTierHz =
      medianUs > 0
        ? Math.round(1_000_000 / medianUs)
        : this.peakPollingHz;
    const nominalTierLabel =
      estTierHz >= 1600
        ? '2000+ Hz (Hyper-Poll)'
        : estTierHz >= 820
          ? '1000 Hz (1 ms Esports)'
          : estTierHz >= 410
            ? '500 Hz (2 ms)'
            : estTierHz >= 210
              ? '250 Hz (4 ms)'
              : estTierHz >= 90
                ? '125 Hz (8 ms / Office)'
                : estTierHz > 0
                  ? `${estTierHz} Hz`
                  : 'Oczekiwanie na ruch';

    let sensorVerdict: MouseDiagnosticsSnapshot['sensorVerdict'] = 'OCZEKIWANIE';
    let sensorVerdictNote = 'Poruszaj myszą szybko w kółko po padzie, aby zebrać min. 25 interwałów sensora.';
    if (this.activeIntervalsMs.length >= 20) {
      if (stabilityPct >= 86 && this.inconsistencyEvents <= 2) {
        sensorVerdict = 'SENSOR WZOROWY';
        sensorVerdictNote = `Równomierne próbkowanie (mediana ${medianUs.toLocaleString('pl-PL')} µs, jitter ±${jitterStdDevUs.toLocaleString('pl-PL')} µs) — brak gubionych ramek USB.`;
      } else if (stabilityPct >= 66) {
        sensorVerdict = 'LEKKIE WAHANIA USB';
        sensorVerdictNote = `Wykryto umiarkowany jitter (±${jitterStdDevUs.toLocaleString('pl-PL')} µs) lub ${this.inconsistencyEvents} pik(i) interwału — sprawdź port USB / odbiornik 2.4 GHz.`;
      } else {
        sensorVerdict = 'WYKRYTO NIESTABILNOŚĆ SENSORA';
        sensorVerdictNote = `Wysoka niestabilność sensora (${stabilityPct}%, ${this.inconsistencyEvents} anomalii interwału, max ${(maxUs / 1000).toFixed(2)} ms) — możliwa interferencja RF, brudny sensor lub oszczędzanie energii USB.`;
      }
    }

    const avgClickLatencyUs =
      this.clickInterUsHistory.length > 0
        ? Math.round(this.clickInterUsHistory.reduce((a, b) => a + b, 0) / this.clickInterUsHistory.length)
        : null;

    return {
      pollingHz: recentPollCount,
      peakPollingHz: this.peakPollingHz,
      nominalTierLabel,
      targetPollingHz: this.targetPollingHz,
      sampleCount: this.pointerTimestampsMs.length,
      activeIntervalCount: this.activeIntervalsMs.length,
      meanIntervalUs: meanUs,
      medianIntervalUs: medianUs,
      p99IntervalUs: p99Us,
      minIntervalUs: minUs,
      maxIntervalUs: maxUs,
      jitterStdDevUs,
      stabilityPct,
      inconsistencyEvents: this.inconsistencyEvents,
      sensorVerdict,
      sensorVerdictNote,
      histogram,
      clicks: { ...this.clicks },
      scrollDeltaPx: this.scrollDeltaPx,
      doubleClickFaults: this.doubleClickFaults,
      chatterFaults: this.chatterFaults,
      lastClickLatencyUs: this.lastClickLatencyUs,
      minClickLatencyUs: this.minClickLatencyUs,
      avgClickLatencyUs,
      lastDwellUs: this.lastDwellUs,
      recentClicks: [...this.recentClicks],
    };
  }
}

export const mouseDiagnosticsService = new MouseDiagnosticsService();
