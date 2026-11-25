import {
  FanAcousticHeatmapCell,
  FanAcousticHeatmapState,
  FanAcousticSample,
  FanBearingFailureRiskLevel,
  FanBearingHealthAcousticContext,
  FanBearingHealthDayPoint,
  FanBearingHealthTier,
  FanCurveConfig,
  FanCurvePoint,
  FanCurvePreset,
  FanFftBin,
  FanFftFrequencyBucketEntry,
  FanFftHarmonicPeak,
  FanFftSpectrumJsonExport,
  FanPwmChannelReading,
  FanPwmMonitorState,
  FanResonanceZone,
  FanTestState,
} from '../types';

export const PWM_RPM_DUTY_DEVIATION_THRESHOLD_PCT = 15;
export const PWM_RPM_DUTY_HOLD_MS = 3000;
export const DEFAULT_PREDICTIVE_MAINTENANCE_THRESHOLD_PCT = 70;
export const ACOUSTIC_FFT_SIZE = 4096;
export const ACOUSTIC_FFT_MAX_HZ = 2400;
export const ACOUSTIC_FFT_DISPLAY_BINS = 72;

/**
 * Derives a Predictive Bearing Failure Probability (%) and life-impact summary
 * from the PWM Bearing Health Index (0..100) and optional excited FFT harmonic stress.
 */
export function computePredictiveBearingFailureProbability(
  bearingHealthIndex: number,
  harmonic?: {
    prominenceDb?: number;
    persistencePct?: number;
    isMajorHarmonic?: boolean;
  }
): {
  probabilityPct: number;
  riskLevel: FanBearingFailureRiskLevel;
  impactSummary: string;
} {
  const clampedHealth = Math.max(0, Math.min(100, Number.isFinite(bearingHealthIndex) ? bearingHealthIndex : 100));
  const healthDeficit = 100 - clampedHealth;
  const baseRisk = Math.pow(healthDeficit / 100, 1.32) * 82;

  const promBonus = harmonic?.prominenceDb
    ? Math.max(0, Math.min(14, (harmonic.prominenceDb - 6) * 0.7))
    : 0;
  const persBonus = harmonic?.persistencePct
    ? Math.max(0, Math.min(6, (harmonic.persistencePct / 100) * 6))
    : 0;
  const harmonicLoad = harmonic?.isMajorHarmonic
    ? promBonus * 0.65 + persBonus * 0.65
    : promBonus * 0.25;

  const probabilityPct = Number(
    Math.max(0.5, Math.min(99.5, baseRisk + harmonicLoad)).toFixed(1)
  );

  const riskLevel: FanBearingFailureRiskLevel =
    probabilityPct >= 55
      ? 'CRITICAL'
      : probabilityPct >= 30
        ? 'ELEVATED'
        : probabilityPct >= 15
          ? 'MODERATE'
          : 'LOW';

  const impactSummary =
    riskLevel === 'CRITICAL'
      ? 'Krytyczne zużycie łożyska — wysokie ryzyko zatarcia wirnika lub spadku żywotności L10.'
      : riskLevel === 'ELEVATED'
        ? 'Podwyższone drgania harmoniczne przyspieszające zużycie filmu smarnego łożyska.'
        : riskLevel === 'MODERATE'
          ? 'Umiarkowane drgania tonalne — monitoruj indeks kondycji łożyska (Bearing Health Index).'
          : 'Niskie ryzyko zużycia łożyska — zegar PWM i stabilność obrotów w normie.';

  return { probabilityPct, riskLevel, impactSummary };
}

export const FAN_HEATMAP_RPM_BINS: Array<{ min: number; max: number; label: string }> = [
  { min: 500, max: 1000, label: '500–1k' },
  { min: 1000, max: 1500, label: '1k–1.5k' },
  { min: 1500, max: 2000, label: '1.5k–2k' },
  { min: 2000, max: 2500, label: '2k–2.5k' },
  { min: 2500, max: 3000, label: '2.5k–3k' },
  { min: 3000, max: 3500, label: '3k–3.5k' },
  { min: 3500, max: 4000, label: '3.5k–4k' },
  { min: 4000, max: 4500, label: '4k–4.5k' },
  { min: 4500, max: 5000, label: '4.5k–5k' },
  { min: 5000, max: 5500, label: '5k–5.5k' },
];

export const FAN_HEATMAP_DB_BINS: Array<{ min: number; max: number; label: string }> = [
  { min: 20, max: 36, label: '< 36 dB' },
  { min: 36, max: 42, label: '36–42 dB' },
  { min: 42, max: 48, label: '42–48 dB' },
  { min: 48, max: 54, label: '48–54 dB' },
  { min: 54, max: 60, label: '54–60 dB' },
  { min: 60, max: 85, label: '> 60 dB' },
];

export function computeExpectedAerodynamicDb(rpm: number): number {
  const clamped = Math.max(500, Math.min(5500, rpm));
  const norm = (clamped - 500) / 5000;
  return Number((27.5 + 24.5 * Math.pow(norm, 0.82)).toFixed(1));
}

/**
 * Pure TypeScript iterative Radix-2 Cooley-Tukey FFT with Hann window.
 * Converts a power-of-two time-domain PCM frame into a single-sided dBFS
 * magnitude spectrum matching Web Audio AnalyserNode.getFloatFrequencyData.
 */
export function computeRadix2FftDb(timeSamples: Float32Array): Float32Array {
  const rawLen = timeSamples.length;
  let n = 1;
  while (n * 2 <= rawLen) n *= 2;
  if (n < 64) {
    return new Float32Array(32).fill(-100);
  }

  const real = new Float32Array(n);
  const imag = new Float32Array(n);
  const twoPiOverN = (2 * Math.PI) / (n - 1);
  for (let i = 0; i < n; i++) {
    const hann = 0.5 * (1 - Math.cos(twoPiOverN * i));
    real[i] = timeSamples[i] * hann;
  }

  // Bit-reversal permutation
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) {
      j ^= bit;
    }
    j ^= bit;
    if (i < j) {
      const tr = real[i];
      real[i] = real[j];
      real[j] = tr;
      const ti = imag[i];
      imag[i] = imag[j];
      imag[j] = ti;
    }
  }

  // Butterfly stages
  for (let len = 2; len <= n; len <<= 1) {
    const half = len >> 1;
    const angle = (-2 * Math.PI) / len;
    const wStepRe = Math.cos(angle);
    const wStepIm = Math.sin(angle);
    for (let i = 0; i < n; i += len) {
      let wRe = 1;
      let wIm = 0;
      for (let j = 0; j < half; j++) {
        const uRe = real[i + j];
        const uIm = imag[i + j];
        const vRe = real[i + j + half] * wRe - imag[i + j + half] * wIm;
        const vIm = real[i + j + half] * wIm + imag[i + j + half] * wRe;
        real[i + j] = uRe + vRe;
        imag[i + j] = uIm + vIm;
        real[i + j + half] = uRe - vRe;
        imag[i + j + half] = uIm - vIm;
        const nextRe = wRe * wStepRe - wIm * wStepIm;
        wIm = wRe * wStepIm + wIm * wStepRe;
        wRe = nextRe;
      }
    }
  }

  const bins = n >> 1;
  const out = new Float32Array(bins);
  // Hann coherent gain compensation (0.5) => scale by 4 / n for single-sided amplitude
  const scale = 4 / n;
  for (let i = 0; i < bins; i++) {
    const mag = Math.hypot(real[i], imag[i]) * scale;
    const db = mag > 1e-6 ? 20 * Math.log10(mag) : -100;
    out[i] = Math.max(-100, Math.min(0, db));
  }
  return out;
}

export function classifyFanHarmonic(
  hz: number,
  rpm: number,
  bladeCount = 7
): { harmonicOrder: number | null; classification: string } {
  const f0 = Math.max(5, rpm / 60);
  const bpf = f0 * bladeCount;
  const order = Number((hz / f0).toFixed(2));

  const near = (target: number, relTol = 0.09, absTol = 8) =>
    Math.abs(hz - target) <= Math.max(absTol, target * relTol);

  if (near(f0, 0.14, 6)) {
    return { harmonicOrder: 1, classification: '1x Wał (Niewyważenie)' };
  }
  if (near(f0 * 2, 0.12, 8)) {
    return { harmonicOrder: 2, classification: '2x Wał (Osiowość)' };
  }
  if (near(f0 * 3, 0.1, 9)) {
    return { harmonicOrder: 3, classification: '3x Wał (Łożysko / Bearing)' };
  }
  if (near(bpf, 0.08, 12)) {
    return { harmonicOrder: bladeCount, classification: `Łopatki (${bladeCount}x BPF)` };
  }
  if (near(bpf * 2, 0.07, 16)) {
    return { harmonicOrder: bladeCount * 2, classification: '2x BPF (Aerodynamika)' };
  }
  if (near(bpf * 3, 0.07, 20)) {
    return { harmonicOrder: bladeCount * 3, classification: '3x BPF (Turbulencja)' };
  }

  const nearestInt = Math.round(order);
  if (nearestInt >= 4 && nearestInt <= 12 && Math.abs(order - nearestInt) <= 0.16) {
    return { harmonicOrder: nearestInt, classification: `${nearestInt}x Harmoniczna wału` };
  }
  if (hz >= 135 && hz <= 520) {
    return { harmonicOrder: order, classification: 'Rezonans obudowy / konstrukcji' };
  }
  if (hz > 950) {
    return { harmonicOrder: order, classification: 'Wysokie pasmo łożyska / cewki' };
  }
  return { harmonicOrder: order, classification: 'Drgania mechaniczne' };
}

export function computePredictiveBearingLifeDetails(
  bearingHealthIndex: number,
  longTermDriftPct: number,
  driftTrend: 'STABLE' | 'DRIFTING' | 'WORSENING',
  rpmDutyDeviationPct: number,
  label: string,
  header: string
): {
  predictedLifeExpectancyPct: number;
  estimatedRemainingHours: number;
  maintenanceInstructions: string[];
} {
  const driftPenalty = longTermDriftPct > 1.2 ? Math.min(10, (longTermDriftPct - 1.2) * 1.4) : 0;
  const trendPenalty = driftTrend === 'WORSENING' ? 5 : driftTrend === 'DRIFTING' ? 2 : 0;
  const lagPenalty =
    Math.abs(rpmDutyDeviationPct) > 8
      ? Math.min(10, (Math.abs(rpmDutyDeviationPct) - 8) * 0.45)
      : 0;
  const predictedLifeExpectancyPct = Math.max(
    4,
    Math.min(100, Math.round(bearingHealthIndex - driftPenalty - trendPenalty - lagPenalty))
  );

  // L10 bearing life curve (typical 40,000h FDB/Dual-Ball reference scaled nonlinearly by health)
  const norm = Math.max(0.02, predictedLifeExpectancyPct / 100);
  const estimatedRemainingHours = Math.max(
    120,
    Math.round(40000 * Math.pow(norm, 2.15))
  );

  const instructions: string[] = [];
  if (predictedLifeExpectancyPct < 55 || driftTrend === 'WORSENING') {
    instructions.push(
      `Sprawdź piastę wirnika i tuleję łożyska wentylatora ${label} (${header}) pod kątem kurzu, luzu osiowego lub wyschniętego smaru.`
    );
  } else {
    instructions.push(
      `Przeprowadź profilaktyczne czyszczenie łopatek i filtra przeciwkurzowego wentylatora ${label} (${header}), aby ograniczyć niewyważenie wirnika.`
    );
  }

  if (Math.abs(rpmDutyDeviationPct) >= 10) {
    instructions.push(
      `Sprawdź osadzenie wtyczki 4-pin PWM na złączu ${header} i upewnij się, że w BIOS (Q-Fan / Smart Fan) wybrano tryb PWM (a nie napięciowy DC).`
    );
  } else {
    instructions.push(
      `Sprawdź obciążenie rozdzielacza Y / koncentratora na złączu ${header} oraz stabilność zegara 25 kHz Super I/O płyty głównej.`
    );
  }

  instructions.push(
    predictedLifeExpectancyPct < 50
      ? `Przygotuj wymianę wentylatora 4-pin FDB (szacowany pozostały czas pracy L10 poniżej ${estimatedRemainingHours.toLocaleString('pl-PL')} godz.).`
      : `Dostosuj minimalny próg obrotów w Edytorze Krzywej Wentylatorów powyżej pasma rezonansu i zweryfikuj stabilność PWM przez 60 s.`
  );

  return {
    predictedLifeExpectancyPct,
    estimatedRemainingHours,
    maintenanceInstructions: instructions,
  };
}

/**
 * Analyzes an FFT dBFS magnitude spectrum to detect specific harmonic frequencies
 * excited by fan vibration, separate from broadband airflow noise.
 */
export function analyzeFftSpectrumForHarmonics(
  spectrumDb: Float32Array,
  sampleRate: number,
  fftSize: number,
  rpm: number,
  bladeCount = 7
): {
  fftBins: FanFftBin[];
  harmonics: FanFftHarmonicPeak[];
  dominantHz: number | null;
  vibrationScore: number;
} {
  const binHz = sampleRate / Math.max(64, fftSize);
  const minHz = 20;
  const maxHz = ACOUSTIC_FFT_MAX_HZ;
  const minBin = Math.max(1, Math.floor(minHz / binHz));
  const maxBin = Math.min(spectrumDb.length - 2, Math.ceil(maxHz / binHz));

  // Build 72 display bins (preserving peak dB inside each bucket so narrow tones remain sharp)
  const fftBins: FanFftBin[] = [];
  const spanHz = maxHz - minHz;
  for (let b = 0; b < ACOUSTIC_FFT_DISPLAY_BINS; b++) {
    const fStart = minHz + (b / ACOUSTIC_FFT_DISPLAY_BINS) * spanHz;
    const fEnd = minHz + ((b + 1) / ACOUSTIC_FFT_DISPLAY_BINS) * spanHz;
    const iStart = Math.max(1, Math.floor(fStart / binHz));
    const iEnd = Math.min(spectrumDb.length - 1, Math.max(iStart, Math.ceil(fEnd / binHz)));
    let maxVal = -100;
    for (let i = iStart; i <= iEnd; i++) {
      const v = Number.isFinite(spectrumDb[i]) ? spectrumDb[i] : -100;
      if (v > maxVal) maxVal = v;
    }
    const clampedDb = Math.max(-100, Math.min(0, maxVal));
    const normalized = Number(Math.max(0, Math.min(1, (clampedDb + 92) / 76)).toFixed(3));
    fftBins.push({
      hz: Math.round((fStart + fEnd) / 2),
      magnitudeDb: Number(clampedDb.toFixed(1)),
      normalized,
    });
  }

  // Peak detection with local noise floor subtraction + parabolic sub-bin interpolation
  const rawPeaks: Array<{ hz: number; magnitudeDb: number; prominenceDb: number }> = [];
  for (let i = minBin + 1; i < maxBin; i++) {
    const val = spectrumDb[i];
    if (!Number.isFinite(val) || val < -82) continue;
    const prev = spectrumDb[i - 1];
    const next = spectrumDb[i + 1];
    if (val < prev || val < next) continue;
    if (val === prev && val === next) continue;

    // Local floor excludes immediate peak skirt (±2 bins)
    let floorSum = 0;
    let floorCount = 0;
    const winStart = Math.max(minBin, i - 10);
    const winEnd = Math.min(maxBin, i + 10);
    for (let j = winStart; j <= winEnd; j++) {
      if (Math.abs(j - i) <= 2) continue;
      const fv = spectrumDb[j];
      if (Number.isFinite(fv)) {
        floorSum += fv;
        floorCount++;
      }
    }
    const localFloor = floorCount > 0 ? floorSum / floorCount : -90;
    const prominenceDb = val - localFloor;
    if (prominenceDb < 5.5) continue;

    // 3-point quadratic interpolation for sub-bin Hz accuracy
    const denom = prev - 2 * val + next;
    const delta = Math.abs(denom) > 1e-5 ? Math.max(-0.5, Math.min(0.5, (0.5 * (prev - next)) / denom)) : 0;
    const refinedHz = Math.round((i + delta) * binHz);
    if (refinedHz < minHz || refinedHz > maxHz) continue;

    rawPeaks.push({
      hz: refinedHz,
      magnitudeDb: Number(val.toFixed(1)),
      prominenceDb: Number(prominenceDb.toFixed(1)),
    });
  }

  // Merge closely spaced peaks within ~18 Hz, keeping stronger prominence
  rawPeaks.sort((a, b) => b.prominenceDb - a.prominenceDb || b.magnitudeDb - a.magnitudeDb);
  const deduped: typeof rawPeaks = [];
  const minPeakGapHz = Math.max(16, binHz * 1.5);
  for (const p of rawPeaks) {
    if (deduped.some((d) => Math.abs(d.hz - p.hz) < minPeakGapHz)) continue;
    deduped.push(p);
    if (deduped.length >= 6) break;
  }

  const harmonics: FanFftHarmonicPeak[] = deduped.map((p) => {
    const cls = classifyFanHarmonic(p.hz, rpm, bladeCount);
    return {
      hz: p.hz,
      magnitudeDb: p.magnitudeDb,
      prominenceDb: p.prominenceDb,
      harmonicOrder: cls.harmonicOrder,
      classification: cls.classification,
      isExcited: p.prominenceDb >= 8.5,
    };
  });

  const dominantHz = harmonics.length > 0 ? harmonics[0].hz : null;
  const excitedEnergy = harmonics.reduce(
    (acc, h) => acc + Math.max(0, h.prominenceDb - 4) * (h.isExcited ? 1.85 : 0.9),
    0
  );
  const vibrationScore = Math.max(
    8,
    Math.min(100, Math.round(12 + excitedEnergy * 1.15))
  );

  return { fftBins, harmonics, dominantHz, vibrationScore };
}

/**
 * Generates a physically modeled FFT dBFS spectrum for calibration sweeps / no-mic fallback
 * so the harmonic analyzer pipeline and D3 spectrum view behave identically to live microphone FFT.
 */
function synthesizeHarmonicSpectrumForRpm(
  rpm: number,
  noiseDb: number,
  bladeCount: number,
  sampleRate = 48000,
  fftSize = ACOUSTIC_FFT_SIZE
): Float32Array {
  const bins = fftSize >> 1;
  const binHz = sampleRate / fftSize;
  const spectrum = new Float32Array(bins);
  const baseFloor = -82 + Math.max(0, (noiseDb - 26) * 0.48);

  for (let i = 0; i < bins; i++) {
    const hz = i * binHz;
    // Slight pink-noise aerodynamic roll-off
    const rolloff = hz > 80 ? -Math.log2(hz / 80) * 2.1 : 0;
    const ripple = Math.sin(i * 0.9 + rpm * 0.01) * 1.1 + Math.cos(i * 1.7) * 0.8;
    spectrum[i] = Math.max(-98, Math.min(-18, baseFloor + rolloff + ripple));
  }

  const addPeak = (centerHz: number, boostDb: number, widthHz: number) => {
    if (centerHz < 20 || centerHz > ACOUSTIC_FFT_MAX_HZ) return;
    const minI = Math.max(1, Math.floor((centerHz - widthHz * 3) / binHz));
    const maxI = Math.min(bins - 1, Math.ceil((centerHz + widthHz * 3) / binHz));
    for (let i = minI; i <= maxI; i++) {
      const dist = (i * binHz - centerHz) / Math.max(4, widthHz);
      const bump = boostDb * Math.exp(-0.5 * dist * dist);
      spectrum[i] = Math.min(-4, spectrum[i] + bump);
    }
  };

  const f0 = Math.max(8, rpm / 60);
  const bpf = f0 * bladeCount;
  const inPrimaryRes = rpm >= 2000 && rpm <= 2490;
  const inSecondaryRes = rpm >= 4000 && rpm <= 4480;

  // Shaft 1x & 2x fundamentals
  addPeak(f0, inPrimaryRes ? 15.5 : 8.2, 8);
  addPeak(f0 * 2, inPrimaryRes ? 13.0 : 7.0, 9);
  // Blade pass fundamental & 2x BPF
  addPeak(bpf, inSecondaryRes ? 18.5 : 12.2, 11);
  addPeak(bpf * 2, inSecondaryRes ? 13.8 : 7.6, 14);

  // Structural chassis/shroud resonance modes excited at specific RPM bands
  if (inPrimaryRes) {
    addPeak(188, 22.5, 10);
    addPeak(376, 15.2, 12);
  }
  if (inSecondaryRes) {
    addPeak(344, 19.2, 11);
    addPeak(688, 12.4, 14);
  }

  return spectrum;
}

interface PwmChannelSpec {
  id: string;
  label: string;
  header: string;
  rpmRatio: number;
  dutyOffset: number;
  baseOffsetRatio: number;
  jitterRatio: number;
  driftMultiplier: number;
}

const DEFAULT_PWM_CHANNELS: PwmChannelSpec[] = [
  {
    id: 'cpu_fan1',
    label: 'Wentylator CPU (Chłodzenie procesora)',
    header: 'CPU_FAN1 (4-Pin)',
    rpmRatio: 1.0,
    dutyOffset: 0,
    baseOffsetRatio: 0.0025,
    jitterRatio: 0.0045,
    driftMultiplier: 0.45,
  },
  {
    id: 'cpu_opt',
    label: 'Wentylator CPU OPT / Pompa AIO',
    header: 'CPU_OPT (4-Pin)',
    rpmRatio: 0.88,
    dutyOffset: 8,
    baseOffsetRatio: -0.0038,
    jitterRatio: 0.005,
    driftMultiplier: 0.65,
  },
  {
    id: 'cha_fan1',
    label: 'Wentylator obudowy — Przód (Wlot)',
    header: 'CHA_FAN1 (4-Pin)',
    rpmRatio: 0.62,
    dutyOffset: -6,
    baseOffsetRatio: 0.005,
    jitterRatio: 0.0055,
    driftMultiplier: 0.9,
  },
  {
    id: 'cha_fan2',
    label: 'Wentylator obudowy — Tył (Wylot)',
    header: 'CHA_FAN2 (Splitter)',
    rpmRatio: 0.58,
    dutyOffset: -4,
    baseOffsetRatio: -0.0065,
    jitterRatio: 0.006,
    driftMultiplier: 1.25,
  },
  {
    id: 'gpu_fan',
    label: 'Wentylatory karty graficznej GPU',
    header: 'GPU_PWM (PCIe)',
    rpmRatio: 0.78,
    dutyOffset: 4,
    baseOffsetRatio: 0.0045,
    jitterRatio: 0.0055,
    driftMultiplier: 1.05,
  },
];

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
  private micFloatFreqData: Float32Array<ArrayBuffer> | null = null;

  private elapsedSec = 0;
  private peakAtTurboTempC = 44;
  private cooldownStartTempC = 44;
  private cooldownTicks = 0;
  private fanCurve: FanCurveConfig = createDefaultFanCurve();
  private autoCoolingEnabled = false;

  public setAutoCoolingEnabled(enabled: boolean): void {
    this.autoCoolingEnabled = Boolean(enabled);
  }

  public isAutoCoolingEnabled(): boolean {
    return this.autoCoolingEnabled;
  }

  // PWM Frequency Monitor state
  private pwmTimer: ReturnType<typeof setInterval> | null = null;
  private pwmListeners: Array<(s: FanPwmMonitorState) => void> = [];
  private pwmState: FanPwmMonitorState;
  private pwmTickIndex = 0;
  private pwmRpmDeviationSince = new Map<string, number>();
  private pwmDriftHistory = new Map<
    string,
    Array<{ deviationPct: number; jitterPct: number; rpmLagPct: number }>
  >();

  // Acoustic RPM-vs-Noise Resonance Heatmap + Real-Time FFT state
  private acousticSamples: FanAcousticSample[] = [];
  private acousticListeners: Array<(s: FanAcousticHeatmapState) => void> = [];
  private acousticCaptureTimer: ReturnType<typeof setInterval> | null = null;
  private acousticSweepTimer: ReturnType<typeof setInterval> | null = null;
  private acousticMicStream: MediaStream | null = null;
  private acousticMicCtx: AudioContext | null = null;
  private acousticMicAnalyser: AnalyserNode | null = null;
  private acousticMicTimeData: Uint8Array<ArrayBuffer> | null = null;
  private acousticMicFloatFreqData: Float32Array<ArrayBuffer> | null = null;
  private acousticCapturing = false;
  private acousticSweeping = false;
  private acousticMicActive = false;
  private acousticMicError: string | null = null;
  private acousticCurrentRpm = 1150;
  private acousticCurrentDb: number | null = null;
  private acousticCurrentVib = 0;
  private acousticCurrentDominantHz: number | null = null;
  private acousticBladeCount = 7;
  private acousticSampleRateHz = 48000;
  private acousticFftBins: FanFftBin[] = [];
  private acousticRawSpectrumDb: Float32Array | null = null;
  private acousticCurrentHarmonics: FanFftHarmonicPeak[] = [];
  private acousticUsingBaselineSeed = true;

  constructor() {
    this.state = this.createInitialState();
    this.pwmState = this.createInitialPwmState();
    this.seedBaselineAcousticSamples();
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

  private readMicMetricsFromAnalyser(
    analyser: AnalyserNode | null,
    timeData: Uint8Array<ArrayBuffer> | null,
    floatFreqData: Float32Array<ArrayBuffer> | null,
    rpm: number,
    sampleRate = 48000
  ): {
    noiseDb: number;
    vibrationScore: number;
    dominantHz: number | null;
    fftBins: FanFftBin[];
    harmonics: FanFftHarmonicPeak[];
    sampleRate: number;
  } | null {
    if (!analyser || !timeData) return null;
    analyser.getByteTimeDomainData(timeData);
    let sumSq = 0;
    for (let i = 0; i < timeData.length; i++) {
      const n = (timeData[i] - 128) / 128;
      sumSq += n * n;
    }
    const rms = Math.sqrt(sumSq / timeData.length);
    // Map normalized RMS to approximate SPL dBA (24 dBA quiet room -> 78 dBA loud turbo fan)
    const rawDb = rms > 0.0001 ? 20 * Math.log10(rms) : -60;
    const noiseDb = Math.max(24, Math.min(78, Math.round(rawDb + 84)));

    let vibrationScore = 12;
    let dominantHz: number | null = null;
    let fftBins: FanFftBin[] = [];
    let harmonics: FanFftHarmonicPeak[] = [];

    if (floatFreqData) {
      analyser.getFloatFrequencyData(floatFreqData);
      this.acousticRawSpectrumDb = new Float32Array(floatFreqData);
      const fftAnalysis = analyzeFftSpectrumForHarmonics(
        floatFreqData,
        sampleRate,
        analyser.fftSize,
        rpm,
        this.acousticBladeCount
      );
      fftBins = fftAnalysis.fftBins;
      harmonics = fftAnalysis.harmonics;
      dominantHz = fftAnalysis.dominantHz;
      // Blend FFT harmonic prominence energy with acoustic floor elevation
      vibrationScore = Math.max(
        0,
        Math.min(100, Math.round(fftAnalysis.vibrationScore * 0.78 + Math.max(0, noiseDb - 36) * 0.75))
      );
    }

    return { noiseDb, vibrationScore, dominantHz, fftBins, harmonics, sampleRate };
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
        analyser.fftSize = ACOUSTIC_FFT_SIZE;
        analyser.smoothingTimeConstant = 0.65;
        src.connect(analyser);
        this.micStream = stream;
        this.micCtx = ctx;
        this.micAnalyser = analyser;
        this.micData = new Uint8Array(new ArrayBuffer(analyser.fftSize));
        this.micFloatFreqData = new Float32Array(new ArrayBuffer(analyser.frequencyBinCount * 4));
        this.acousticSampleRateHz = ctx.sampleRate || 48000;
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
      const micMetrics = this.readMicMetricsFromAnalyser(
        this.micAnalyser,
        this.micData,
        this.micFloatFreqData,
        this.state.estRpm,
        this.micCtx?.sampleRate || 48000
      );
      const noiseDb = micMetrics ? micMetrics.noiseDb : null;

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

      if (noiseDb !== null && micMetrics) {
        this.state.currentNoiseDb = noiseDb;
        this.state.peakNoiseDb =
          this.state.peakNoiseDb === null ? noiseDb : Math.max(this.state.peakNoiseDb, noiseDb);
        if (this.state.baselineNoiseDb !== null) {
          this.state.noiseDeltaDb = Math.max(0, this.state.peakNoiseDb - this.state.baselineNoiseDb);
        }
        this.acousticFftBins = micMetrics.fftBins;
        this.acousticCurrentHarmonics = micMetrics.harmonics;
        this.acousticSampleRateHz = micMetrics.sampleRate;
        // Feed live correlated (RPM, mic dB, FFT harmonics) directly into the resonance heatmap
        this.recordAcousticSample({
          timestamp: Date.now(),
          rpm: this.state.estRpm,
          noiseDb: micMetrics.noiseDb,
          vibrationScore: micMetrics.vibrationScore,
          dominantHz: micMetrics.dominantHz,
          harmonics: micMetrics.harmonics,
          source: 'microphone',
        });
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
    this.micFloatFreqData = null;
  }

  private emit(): void {
    this.onUpdate?.(this.getState());
  }

  /* =========================================================================
     PWM FREQUENCY MONITOR (Intel 4-Pin 25 kHz Spec & Motherboard Deviation)
     ========================================================================= */

  private createInitial7DayBearingHistory(
    spec: PwmChannelSpec,
    todayScore: number
  ): FanBearingHealthDayPoint[] {
    // Realistic 7-day trend anchored so channels with higher driftMultiplier show gradual multi-day decay
    const startSlope = Math.min(8, Math.round(spec.driftMultiplier * 2.2));
    const labels = ['-6d', '-5d', '-4d', '-3d', '-2d', '-1d', 'Today'];
    return labels.map((label, idx) => {
      const dayOffset = idx - 6; // -6..0
      if (idx === 6) {
        return { dayOffset, label, score: todayScore };
      }
      const progress = idx / 6;
      const startScore = Math.min(100, todayScore + startSlope);
      const wave = Math.round(Math.sin(idx * 1.4 + spec.rpmRatio * 5) * 0.8);
      const interpolated = Math.round(startScore + (todayScore - startScore) * progress + wave);
      return {
        dayOffset,
        label,
        score: Math.max(0, Math.min(100, interpolated)),
      };
    });
  }

  private updateBearing7DayHistory(
    prevHistory: FanBearingHealthDayPoint[] | undefined,
    spec: PwmChannelSpec,
    todayScore: number
  ): FanBearingHealthDayPoint[] {
    const base =
      prevHistory && prevHistory.length === 7
        ? prevHistory.map((pt) => ({ ...pt }))
        : this.createInitial7DayBearingHistory(spec, todayScore);
    base[6] = { dayOffset: 0, label: 'Today', score: todayScore };
    // Smoothly pull day -1 halfway toward sharp degradation if today drops steeply
    if (todayScore < base[5].score - 4) {
      base[5] = {
        ...base[5],
        score: Math.max(0, Math.min(100, Math.round(base[5].score * 0.65 + todayScore * 0.35))),
      };
    }
    return base;
  }

  private createInitialPwmState(): FanPwmMonitorState {
    const programmedHz = 25000;
    const tolerancePct = 4.0;
    const thresholdPct = DEFAULT_PREDICTIVE_MAINTENANCE_THRESHOLD_PCT;
    const channels: FanPwmChannelReading[] = DEFAULT_PWM_CHANNELS.map((spec) => {
      const dutyPct = Math.max(15, Math.min(100, 35 + spec.dutyOffset));
      const expectedRpm = Math.max(300, Math.round((dutyPct / 100) * this.fanCurve.maxRpm * spec.rpmRatio));
      const initialScore = spec.id === 'cha_fan2' ? 91 : spec.id === 'gpu_fan' ? 96 : 98;
      const initialDrift = spec.id === 'cha_fan2' ? 0.9 : 0.2;
      const lifeDetails = computePredictiveBearingLifeDetails(
        initialScore,
        initialDrift,
        'STABLE',
        0,
        spec.label,
        spec.header
      );
      return {
        id: spec.id,
        label: spec.label,
        header: spec.header,
        programmedHz,
        measuredHz: programmedHz,
        deviationHz: 0,
        deviationPct: 0,
        jitterHz: 0,
        dutyPct,
        rpm: expectedRpm,
        expectedRpm,
        rpmDutyDeviationPct: 0,
        rpmDeviationDurationMs: 0,
        rpmDutyWarningPulse: false,
        rpmDutyFaultHint: null,
        bearingHealthIndex: initialScore,
        bearingHealthTier: 'HEALTHY',
        longTermDriftPct: initialDrift,
        driftTrend: 'STABLE',
        bearingPrediction: 'Prawidłowa stabilność łożyska i zegara PWM (niski dryft długoterminowy — wentylator sprawny).',
        bearingHealth7DayHistory: this.createInitial7DayBearingHistory(spec, initialScore),
        predictedLifeExpectancyPct: lifeDetails.predictedLifeExpectancyPct,
        estimatedRemainingHours: lifeDetails.estimatedRemainingHours,
        maintenanceInstructions: lifeDetails.maintenanceInstructions,
        maintenanceAlertTriggered:
          initialScore < thresholdPct || lifeDetails.predictedLifeExpectancyPct < thresholdPct,
        status: 'OK',
        reason: 'Sygnał PWM zsynchronizowany z zegarem płyty głównej',
        historyHz: [programmedHz],
      };
    });

    const lowestBearingHealthIndex = Math.min(...channels.map((c) => c.bearingHealthIndex));
    const avgBearingHealthIndex = Math.round(
      channels.reduce((a, c) => a + c.bearingHealthIndex, 0) / Math.max(1, channels.length)
    );

    return {
      active: false,
      programmedHz,
      tolerancePct,
      driftTestEnabled: false,
      sampleCount: 0,
      lastSampledAt: null,
      deviationCount: 0,
      rpmDutyWarningCount: 0,
      rpmDeviationThresholdPct: PWM_RPM_DUTY_DEVIATION_THRESHOLD_PCT,
      rpmDeviationHoldSec: PWM_RPM_DUTY_HOLD_MS / 1000,
      lowestBearingHealthIndex,
      avgBearingHealthIndex,
      predictiveMaintenanceThresholdPct: thresholdPct,
      maintenanceAlertCount: channels.filter((c) => c.maintenanceAlertTriggered).length,
      channels,
    };
  }

  private computeBearingHealthForChannel(
    channelId: string,
    deviationPct: number,
    jitterHz: number,
    programmedHz: number,
    rpmDutyDeviationPct: number
  ): {
    bearingHealthIndex: number;
    bearingHealthTier: FanBearingHealthTier;
    longTermDriftPct: number;
    driftTrend: 'STABLE' | 'DRIFTING' | 'WORSENING';
    bearingPrediction: string;
  } {
    const jitterPct = (jitterHz / Math.max(1, programmedHz)) * 100;
    const rpmLagPct = Math.abs(rpmDutyDeviationPct);
    const prev = this.pwmDriftHistory.get(channelId) || [];
    const updated = [...prev.slice(-119), { deviationPct, jitterPct, rpmLagPct }];
    this.pwmDriftHistory.set(channelId, updated);

    const n = updated.length;
    const sumSqDev = updated.reduce((acc, p) => acc + p.deviationPct * p.deviationPct, 0);
    const longTermDriftPct = Number(Math.sqrt(sumSqDev / Math.max(1, n)).toFixed(2));
    const meanJitterPct = updated.reduce((acc, p) => acc + p.jitterPct, 0) / Math.max(1, n);
    const meanRpmLagPct = updated.reduce((acc, p) => acc + p.rpmLagPct, 0) / Math.max(1, n);

    let driftTrend: 'STABLE' | 'DRIFTING' | 'WORSENING' = 'STABLE';
    if (n >= 6) {
      const split = Math.max(2, Math.floor(n / 3));
      const early = updated.slice(0, split);
      const recent = updated.slice(-split);
      const earlyAvg = early.reduce((a, p) => a + p.deviationPct + p.rpmLagPct * 0.2, 0) / early.length;
      const recentAvg = recent.reduce((a, p) => a + p.deviationPct + p.rpmLagPct * 0.2, 0) / recent.length;
      if (recentAvg - earlyAvg >= 1.35 || (longTermDriftPct >= 5.2 && recentAvg >= earlyAvg)) {
        driftTrend = 'WORSENING';
      } else if (longTermDriftPct >= 2.2 || recentAvg - earlyAvg >= 0.5) {
        driftTrend = 'DRIFTING';
      }
    } else if (longTermDriftPct >= 4.5) {
      driftTrend = 'WORSENING';
    } else if (longTermDriftPct >= 2.0) {
      driftTrend = 'DRIFTING';
    }

    const driftPenalty = Math.min(52, Math.pow(longTermDriftPct, 1.28) * 4.5);
    const jitterPenalty = Math.min(20, meanJitterPct * 5.0);
    const rpmLagPenalty = Math.min(28, Math.max(0, meanRpmLagPct - 4) * 1.15);
    const trendPenalty = driftTrend === 'WORSENING' ? 10 : driftTrend === 'DRIFTING' ? 4 : 0;

    const bearingHealthIndex = Math.max(
      0,
      Math.min(100, Math.round(100 - driftPenalty - jitterPenalty - rpmLagPenalty - trendPenalty))
    );

    const bearingHealthTier: FanBearingHealthTier =
      bearingHealthIndex >= 80
        ? 'HEALTHY'
        : bearingHealthIndex >= 60
          ? 'FAIR'
          : bearingHealthIndex >= 40
            ? 'DEGRADED'
            : 'CRITICAL';

    const bearingPrediction =
      bearingHealthTier === 'CRITICAL'
        ? `Krytyczna degradacja łożyska / sygnału PWM (dryft ${longTermDriftPct}%) — sprawdź opór wirnika lub wymień wentylator.`
        : bearingHealthTier === 'DEGRADED'
          ? `Podwyższony długoterminowy dryft (${longTermDriftPct}%) — wczesne zużycie łożyska lub niestabilny kontroler PWM.`
          : bearingHealthTier === 'FAIR'
            ? `Lekki dryft częstotliwości (${longTermDriftPct}%) — monitoruj pod długotrwałym obciążeniem.`
            : `Prawidłowa stabilność łożyska i sygnału PWM (dryft ${longTermDriftPct}% — wentylator sprawny).`;

    return {
      bearingHealthIndex,
      bearingHealthTier,
      longTermDriftPct,
      driftTrend,
      bearingPrediction,
    };
  }

  public getPwmMonitorState(): FanPwmMonitorState {
    return {
      ...this.pwmState,
      channels: this.pwmState.channels.map((ch) => ({
        ...ch,
        bearingHealth7DayHistory: ch.bearingHealth7DayHistory.map((pt) => ({ ...pt })),
        maintenanceInstructions: [...ch.maintenanceInstructions],
        historyHz: [...ch.historyHz],
      })),
    };
  }

  public isPwmMonitoring(): boolean {
    return this.pwmState.active;
  }

  public setProgrammedPwmFrequencyHz(hz: number): FanPwmMonitorState {
    const safeHz = Math.max(100, Math.min(50000, Math.round(Number(hz) || 25000)));
    this.pwmState.programmedHz = safeHz;
    this.pwmState.channels = this.pwmState.channels.map((ch) => ({
      ...ch,
      programmedHz: safeHz,
      historyHz: [safeHz],
    }));
    this.samplePwmChannelsOnce();
    return this.getPwmMonitorState();
  }

  public setPwmTolerancePct(pct: number): FanPwmMonitorState {
    const safePct = Math.max(1, Math.min(15, Number(pct) || 4));
    this.pwmState.tolerancePct = Number(safePct.toFixed(1));
    this.reEvaluatePwmChannelStatuses();
    this.emitPwm();
    return this.getPwmMonitorState();
  }

  public setPredictiveMaintenanceThresholdPct(pct: number): FanPwmMonitorState {
    const safePct = Math.max(30, Math.min(95, Math.round(Number(pct) || DEFAULT_PREDICTIVE_MAINTENANCE_THRESHOLD_PCT)));
    this.pwmState.predictiveMaintenanceThresholdPct = safePct;
    let alertCount = 0;
    this.pwmState.channels = this.pwmState.channels.map((ch) => {
      const triggered = ch.bearingHealthIndex < safePct || ch.predictedLifeExpectancyPct < safePct;
      if (triggered) alertCount++;
      return {
        ...ch,
        maintenanceAlertTriggered: triggered,
      };
    });
    this.pwmState.maintenanceAlertCount = alertCount;
    this.emitPwm();
    return this.getPwmMonitorState();
  }

  public setPwmDriftTestEnabled(enabled: boolean): FanPwmMonitorState {
    this.pwmState.driftTestEnabled = Boolean(enabled);
    if (!this.pwmState.driftTestEnabled) {
      this.pwmRpmDeviationSince.clear();
      this.pwmDriftHistory.clear();
    }
    this.samplePwmChannelsOnce();
    return this.getPwmMonitorState();
  }

  public subscribePwmMonitor(listener: (state: FanPwmMonitorState) => void): () => void {
    this.pwmListeners.push(listener);
    return () => {
      this.pwmListeners = this.pwmListeners.filter((l) => l !== listener);
    };
  }

  public startPwmFrequencyMonitor(onUpdate?: (state: FanPwmMonitorState) => void): FanPwmMonitorState {
    if (onUpdate && !this.pwmListeners.includes(onUpdate)) {
      this.pwmListeners.push(onUpdate);
    }
    if (this.pwmTimer !== null) {
      globalThis.clearInterval(this.pwmTimer);
      this.pwmTimer = null;
    }
    this.pwmState.active = true;
    this.samplePwmChannelsOnce();
    this.pwmTimer = globalThis.setInterval(() => {
      this.samplePwmChannelsOnce();
    }, 500);
    return this.getPwmMonitorState();
  }

  public stopPwmFrequencyMonitor(): FanPwmMonitorState {
    if (this.pwmTimer !== null) {
      globalThis.clearInterval(this.pwmTimer);
      this.pwmTimer = null;
    }
    this.pwmState.active = false;
    this.emitPwm();
    return this.getPwmMonitorState();
  }

  private evaluateChannelStatus(
    measuredHz: number,
    programmedHz: number,
    tolerancePct: number,
    header: string
  ): { deviationHz: number; deviationPct: number; status: 'OK' | 'DEVIATION' | 'CRITICAL'; reason: string } {
    const deviationHz = Math.round(measuredHz - programmedHz);
    const deviationPct = Number(((Math.abs(deviationHz) / Math.max(1, programmedHz)) * 100).toFixed(2));
    const criticalThreshold = Math.max(tolerancePct * 1.85, tolerancePct + 4.0);
    if (deviationPct > criticalThreshold) {
      return {
        deviationHz,
        deviationPct,
        status: 'CRITICAL',
        reason: `Krytyczna odchyłka częstotliwości PWM (${deviationHz >= 0 ? '+' : ''}${deviationHz} Hz) na ${header} — sprawdź kontroler Super I/O, rozdzielacz Y lub ustawienia Q-Fan w BIOS.`,
      };
    }
    if (deviationPct > tolerancePct) {
      return {
        deviationHz,
        deviationPct,
        status: 'DEVIATION',
        reason: `Odchyłka poza pasmem ±${tolerancePct}% (${deviationHz >= 0 ? '+' : ''}${deviationHz} Hz) — możliwy dryft generatora PWM lub obciążenie linii sygnałowej.`,
      };
    }
    return {
      deviationHz,
      deviationPct,
      status: 'OK',
      reason: `Zgodny z zaprogramowanym zegarem płyty głównej (±${tolerancePct}%).`,
    };
  }

  private reEvaluatePwmChannelStatuses(): void {
    let deviationCount = 0;
    this.pwmState.channels = this.pwmState.channels.map((ch) => {
      const evalRes = this.evaluateChannelStatus(
        ch.measuredHz,
        this.pwmState.programmedHz,
        this.pwmState.tolerancePct,
        ch.header
      );
      if (evalRes.status !== 'OK') deviationCount++;
      return {
        ...ch,
        programmedHz: this.pwmState.programmedHz,
        deviationHz: evalRes.deviationHz,
        deviationPct: evalRes.deviationPct,
        status: evalRes.status,
        reason: evalRes.reason,
      };
    });
    this.pwmState.deviationCount = deviationCount;
  }

  public samplePwmChannelsOnce(
    nowMs = Date.now(),
    overrides?: Record<string, { dutyPct?: number; rpm?: number; measuredHz?: number }>
  ): FanPwmMonitorState {
    this.pwmTickIndex += 1;
    const t = this.pwmTickIndex;
    const programmedHz = this.pwmState.programmedHz;
    const tolerancePct = this.pwmState.tolerancePct;
    const baseDutyPct = evaluateFanCurvePct(this.fanCurve, this.state.currentTempC);
    const loadFactor = this.state.running ? Math.max(0.35, this.state.targetLoadPct / 100) : 0.35;
    const driftBoost = this.pwmState.driftTestEnabled ? 1 : 0;

    let deviationCount = 0;
    let rpmDutyWarningCount = 0;
    this.pwmState.channels = DEFAULT_PWM_CHANNELS.map((spec, idx) => {
      const prev = this.pwmState.channels[idx];
      const ov = overrides?.[spec.id];
      const wave = Math.sin(t * 0.65 + idx * 1.3) * 0.65 + Math.cos(t * 1.35 + idx) * 0.35;
      const dutyPct =
        ov?.dutyPct !== undefined
          ? Math.max(1, Math.min(100, Math.round(ov.dutyPct)))
          : Math.max(12, Math.min(100, Math.round(baseDutyPct + spec.dutyOffset + wave * 3)));
      const expectedRpm = Math.max(
        300,
        Math.round((dutyPct / 100) * this.fanCurve.maxRpm * spec.rpmRatio)
      );

      let rpm: number;
      if (ov?.rpm !== undefined) {
        rpm = Math.max(0, Math.round(ov.rpm));
      } else if (driftBoost > 0 && spec.id === 'cha_fan2') {
        // Simulate bearing drag / obstruction: actual RPM lags >24% behind motherboard duty cycle
        rpm = Math.max(250, Math.round(expectedRpm * (0.73 + wave * 0.025)));
      } else if (driftBoost > 0 && spec.id === 'gpu_fan') {
        // Simulate PWM controller instability: actual RPM overshoots >21% above motherboard duty cycle
        rpm = Math.max(400, Math.round(expectedRpm * (1.22 + Math.abs(wave) * 0.03)));
      } else {
        // Normal healthy tracking within ±3.5% of motherboard duty cycle
        rpm = Math.max(300, Math.round(expectedRpm * (1 + wave * 0.028)));
      }

      const rpmDutyDeviationPct = Number(
        (((rpm - expectedRpm) / Math.max(1, expectedRpm)) * 100).toFixed(1)
      );
      const exceedsRpmDutyThreshold =
        Math.abs(rpmDutyDeviationPct) > PWM_RPM_DUTY_DEVIATION_THRESHOLD_PCT;

      let rpmDeviationDurationMs = 0;
      if (exceedsRpmDutyThreshold) {
        if (!this.pwmRpmDeviationSince.has(spec.id)) {
          this.pwmRpmDeviationSince.set(spec.id, nowMs);
        }
        rpmDeviationDurationMs = Math.max(
          0,
          nowMs - (this.pwmRpmDeviationSince.get(spec.id) ?? nowMs)
        );
      } else {
        this.pwmRpmDeviationSince.delete(spec.id);
      }

      const rpmDutyWarningPulse =
        exceedsRpmDutyThreshold && rpmDeviationDurationMs > PWM_RPM_DUTY_HOLD_MS;
      if (rpmDutyWarningPulse) rpmDutyWarningCount++;

      let rpmDutyFaultHint: string | null = null;
      if (rpmDutyWarningPulse) {
        const durSec = (rpmDeviationDurationMs / 1000).toFixed(1);
        rpmDutyFaultHint =
          rpmDutyDeviationPct < 0
            ? `Obroty RPM są niższe od wypełnienia PWM o ${Math.abs(rpmDutyDeviationPct).toFixed(1)}% przez ${durSec}s — możliwy opór łożyska (bearing), zabrudzenie lub blokada wirnika.`
            : `Obroty RPM przekraczają wypełnienie PWM o +${rpmDutyDeviationPct.toFixed(1)}% przez ${durSec}s — możliwa niestabilność kontrolera PWM lub zakłócenia tachometru.`;
      } else if (exceedsRpmDutyThreshold) {
        const durSec = (rpmDeviationDurationMs / 1000).toFixed(1);
        const sign = rpmDutyDeviationPct >= 0 ? '+' : '';
        rpmDutyFaultHint = `Odchyłka RPM/Duty ${sign}${rpmDutyDeviationPct.toFixed(1)}% (>15%) — oczekiwanie ${durSec}s / 3.0s przed wyzwoleniem alarmu.`;
      }

      // Realistic clock offset + load-induced jitter + optional drift injection (ONLY when driftBoost > 0!)
      let relOffset = spec.baseOffsetRatio + wave * spec.jitterRatio * (0.65 + loadFactor * 0.45);
      if (driftBoost > 0) {
        if (spec.id === 'cha_fan2') {
          relOffset -= 0.068 + Math.abs(wave) * 0.02;
        } else if (spec.id === 'gpu_fan') {
          relOffset += 0.056 + Math.abs(wave) * 0.014;
        } else if (spec.id === 'cpu_opt') {
          relOffset -= 0.044;
        }
      }

      const measuredHz =
        ov?.measuredHz !== undefined
          ? Math.max(50, Math.round(ov.measuredHz))
          : Math.max(50, Math.round(programmedHz * (1 + relOffset)));
      const prevHz = prev ? prev.measuredHz : programmedHz;
      const jitterHz = Math.abs(measuredHz - prevHz);
      const evalRes = this.evaluateChannelStatus(measuredHz, programmedHz, tolerancePct, spec.header);
      if (evalRes.status !== 'OK') deviationCount++;

      const bearingMetrics = this.computeBearingHealthForChannel(
        spec.id,
        evalRes.deviationPct,
        jitterHz,
        programmedHz,
        rpmDutyDeviationPct
      );

      const bearingHealth7DayHistory = this.updateBearing7DayHistory(
        prev?.bearingHealth7DayHistory,
        spec,
        bearingMetrics.bearingHealthIndex
      );
      const lifeDetails = computePredictiveBearingLifeDetails(
        bearingMetrics.bearingHealthIndex,
        bearingMetrics.longTermDriftPct,
        bearingMetrics.driftTrend,
        rpmDutyDeviationPct,
        spec.label,
        spec.header
      );
      const maintenanceAlertTriggered =
        bearingMetrics.bearingHealthIndex < this.pwmState.predictiveMaintenanceThresholdPct ||
        lifeDetails.predictedLifeExpectancyPct < this.pwmState.predictiveMaintenanceThresholdPct;

      const historyHz = [...(prev?.historyHz || []), measuredHz].slice(-24);
      return {
        id: spec.id,
        label: spec.label,
        header: spec.header,
        programmedHz,
        measuredHz,
        deviationHz: evalRes.deviationHz,
        deviationPct: evalRes.deviationPct,
        jitterHz,
        dutyPct,
        rpm,
        expectedRpm,
        rpmDutyDeviationPct,
        rpmDeviationDurationMs,
        rpmDutyWarningPulse,
        rpmDutyFaultHint,
        bearingHealthIndex: bearingMetrics.bearingHealthIndex,
        bearingHealthTier: bearingMetrics.bearingHealthTier,
        longTermDriftPct: bearingMetrics.longTermDriftPct,
        driftTrend: bearingMetrics.driftTrend,
        bearingPrediction: bearingMetrics.bearingPrediction,
        bearingHealth7DayHistory,
        predictedLifeExpectancyPct: lifeDetails.predictedLifeExpectancyPct,
        estimatedRemainingHours: lifeDetails.estimatedRemainingHours,
        maintenanceInstructions: lifeDetails.maintenanceInstructions,
        maintenanceAlertTriggered,
        status: evalRes.status,
        reason: evalRes.reason,
        historyHz,
      };
    });

    const healthScores = this.pwmState.channels.map((c) => c.bearingHealthIndex);
    const lowestBearingHealthIndex =
      healthScores.length > 0 ? Math.min(...healthScores) : 100;
    const avgBearingHealthIndex =
      healthScores.length > 0
        ? Math.round(healthScores.reduce((a, b) => a + b, 0) / healthScores.length)
        : 100;
    const maintenanceAlertCount = this.pwmState.channels.filter(
      (c) => c.maintenanceAlertTriggered
    ).length;

    this.pwmState.sampleCount += 1;
    this.pwmState.lastSampledAt = nowMs;
    this.pwmState.deviationCount = deviationCount;
    this.pwmState.rpmDutyWarningCount = rpmDutyWarningCount;
    this.pwmState.lowestBearingHealthIndex = lowestBearingHealthIndex;
    this.pwmState.avgBearingHealthIndex = avgBearingHealthIndex;
    this.pwmState.maintenanceAlertCount = maintenanceAlertCount;
    this.emitPwm();
    return this.getPwmMonitorState();
  }

  private emitPwm(): void {
    const snap = this.getPwmMonitorState();
    for (const l of this.pwmListeners) l(snap);
    if (this.acousticListeners.length > 0) {
      this.emitAcoustic();
    }
  }

  /* =========================================================================
     RPM-VS-NOISE ACOUSTIC RESONANCE HEATMAP (Microphone Correlation)
     ========================================================================= */

  private seedBaselineAcousticSamples(): void {
    const now = Date.now();
    const seeded: FanAcousticSample[] = [];
    let lastFftBins: FanFftBin[] = [];
    let lastHarmonics: FanFftHarmonicPeak[] = [];
    let lastRawSpec: Float32Array | null = null;
    // Seed a realistic aerodynamic baseline with a subtle resonance band at 2000-2500 RPM
    // so users immediately see how resonance pockets and harmonic FFT peaks are highlighted
    for (let i = 0; i < 40; i++) {
      const rpm = Math.round(620 + (i / 39) * 4680);
      const expected = computeExpectedAerodynamicDb(rpm);
      const inResonanceBand = rpm >= 2050 && rpm <= 2460;
      const inHighBand = rpm >= 4100 && rpm <= 4450;
      const resonanceSpike = inResonanceBand ? 8.2 + Math.sin(i * 1.4) * 1.8 : inHighBand ? 5.1 : 0;
      const noiseDb = Number(
        Math.max(24, Math.min(78, expected + resonanceSpike + Math.sin(i * 2.1) * 1.3)).toFixed(1)
      );
      const synthSpec = synthesizeHarmonicSpectrumForRpm(
        rpm,
        noiseDb,
        this.acousticBladeCount,
        this.acousticSampleRateHz,
        ACOUSTIC_FFT_SIZE
      );
      const fftRes = analyzeFftSpectrumForHarmonics(
        synthSpec,
        this.acousticSampleRateHz,
        ACOUSTIC_FFT_SIZE,
        rpm,
        this.acousticBladeCount
      );
      const vibrationScore = inResonanceBand
        ? Math.max(fftRes.vibrationScore, Math.round(74 + Math.sin(i) * 8))
        : inHighBand
          ? Math.max(fftRes.vibrationScore, Math.round(63 + Math.cos(i) * 6))
          : Math.min(48, Math.round(16 + ((rpm - 500) / 5000) * 26));
      if (inResonanceBand) {
        lastFftBins = fftRes.fftBins;
        lastHarmonics = fftRes.harmonics;
        lastRawSpec = synthSpec;
        this.acousticCurrentRpm = rpm;
        this.acousticCurrentDb = noiseDb;
        this.acousticCurrentVib = vibrationScore;
        this.acousticCurrentDominantHz = fftRes.dominantHz;
      }
      seeded.push({
        timestamp: now - (40 - i) * 500,
        rpm,
        noiseDb,
        vibrationScore,
        dominantHz: fftRes.dominantHz,
        harmonics: fftRes.harmonics,
        source: 'sweep',
      });
    }
    this.acousticSamples = seeded;
    this.acousticFftBins = lastFftBins;
    this.acousticRawSpectrumDb = lastRawSpec;
    this.acousticCurrentHarmonics = lastHarmonics;
    this.acousticUsingBaselineSeed = true;
  }

  public setAcousticBladeCount(bladeCount: number): FanAcousticHeatmapState {
    const safe = Math.max(3, Math.min(13, Math.round(Number(bladeCount) || 7)));
    this.acousticBladeCount = safe;
    // Re-classify current harmonics with updated blade count
    this.acousticCurrentHarmonics = this.acousticCurrentHarmonics.map((h) => {
      const cls = classifyFanHarmonic(h.hz, this.acousticCurrentRpm, safe);
      return { ...h, harmonicOrder: cls.harmonicOrder, classification: cls.classification };
    });
    this.emitAcoustic();
    return this.getAcousticHeatmapState();
  }

  /**
   * Runs a real-time Radix-2 FFT on raw time-domain PCM microphone samples,
   * identifies excited harmonic frequencies, and records the correlated point in the heatmap.
   */
  public processMicrophoneTimeDomainFrame(
    pcmSamples: Float32Array,
    sampleRate = 48000,
    rpm = this.state.running ? this.state.estRpm : this.acousticCurrentRpm
  ): FanAcousticHeatmapState {
    let sumSq = 0;
    for (let i = 0; i < pcmSamples.length; i++) {
      sumSq += pcmSamples[i] * pcmSamples[i];
    }
    const rms = Math.sqrt(sumSq / Math.max(1, pcmSamples.length));
    const rawDb = rms > 0.0001 ? 20 * Math.log10(rms) : -60;
    const noiseDb = Number(Math.max(24, Math.min(78, rawDb + 84)).toFixed(1));

    const spectrumDb = computeRadix2FftDb(pcmSamples);
    const effectiveFftSize = spectrumDb.length * 2;
    const fftRes = analyzeFftSpectrumForHarmonics(
      spectrumDb,
      sampleRate,
      effectiveFftSize,
      rpm,
      this.acousticBladeCount
    );

    this.acousticSampleRateHz = sampleRate;
    this.acousticRawSpectrumDb = spectrumDb;
    this.acousticFftBins = fftRes.fftBins;
    this.acousticCurrentHarmonics = fftRes.harmonics;

    return this.recordAcousticSample({
      timestamp: Date.now(),
      rpm,
      noiseDb,
      vibrationScore: fftRes.vibrationScore,
      dominantHz: fftRes.dominantHz,
      harmonics: fftRes.harmonics,
      source: 'microphone',
    });
  }

  public recordAcousticSample(sample: FanAcousticSample): FanAcousticHeatmapState {
    if (this.acousticUsingBaselineSeed && sample.source === 'microphone') {
      // Automatically replace preview seed with pure user microphone measurements on first live mic sample
      this.acousticSamples = [];
      this.acousticUsingBaselineSeed = false;
    }
    this.acousticSamples = [...this.acousticSamples.slice(-399), sample];
    this.acousticCurrentRpm = sample.rpm;
    this.acousticCurrentDb = sample.noiseDb;
    this.acousticCurrentVib = sample.vibrationScore;
    this.acousticCurrentDominantHz = sample.dominantHz;
    if (sample.harmonics) {
      this.acousticCurrentHarmonics = sample.harmonics;
    }
    this.emitAcoustic();
    return this.getAcousticHeatmapState();
  }

  public clearAcousticHeatmap(): FanAcousticHeatmapState {
    this.acousticSamples = [];
    this.acousticUsingBaselineSeed = false;
    this.acousticCurrentDb = null;
    this.acousticCurrentVib = 0;
    this.acousticCurrentDominantHz = null;
    this.acousticFftBins = [];
    this.acousticRawSpectrumDb = null;
    this.acousticCurrentHarmonics = [];
    this.emitAcoustic();
    return this.getAcousticHeatmapState();
  }

  public subscribeAcousticHeatmap(listener: (state: FanAcousticHeatmapState) => void): () => void {
    this.acousticListeners.push(listener);
    return () => {
      this.acousticListeners = this.acousticListeners.filter((l) => l !== listener);
    };
  }

  public async startLiveAcousticHeatmapCapture(
    onUpdate?: (state: FanAcousticHeatmapState) => void
  ): Promise<FanAcousticHeatmapState> {
    if (onUpdate && !this.acousticListeners.includes(onUpdate)) {
      this.acousticListeners.push(onUpdate);
    }
    this.stopLiveAcousticHeatmapCapture();
    this.acousticMicError = null;

    if (this.acousticUsingBaselineSeed) {
      this.acousticSamples = [];
      this.acousticUsingBaselineSeed = false;
    }

    let micOk = false;
    if (typeof navigator !== 'undefined' && navigator.mediaDevices?.getUserMedia) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        const ctx = new AudioContext();
        const src = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = ACOUSTIC_FFT_SIZE;
        analyser.smoothingTimeConstant = 0.65;
        src.connect(analyser);
        this.acousticMicStream = stream;
        this.acousticMicCtx = ctx;
        this.acousticMicAnalyser = analyser;
        this.acousticMicTimeData = new Uint8Array(new ArrayBuffer(analyser.fftSize));
        this.acousticMicFloatFreqData = new Float32Array(new ArrayBuffer(analyser.frequencyBinCount * 4));
        this.acousticSampleRateHz = ctx.sampleRate || 48000;
        micOk = true;
      } catch {
        this.acousticMicError =
          'Brak dostępu do mikrofonu — użyto modelu widma FFT (zezwól na mikrofon, aby analizować rzeczywiste harmoniczne na żywo).';
        micOk = false;
      }
    } else {
      this.acousticMicError =
        'Przeglądarka nie udostępnia API mikrofonu — użyto modelu widma FFT.';
    }

    this.acousticMicActive = micOk;
    this.acousticCapturing = true;
    let sweepStep = 0;

    this.acousticCaptureTimer = globalThis.setInterval(() => {
      sweepStep++;
      // Use live fan test RPM if running, otherwise smoothly oscillate across RPM curve for correlation
      const rpm = this.state.running
        ? this.state.estRpm
        : Math.round(900 + ((Math.sin(sweepStep * 0.14) + 1) / 2) * (this.fanCurve.maxRpm - 900));

      const micMetrics = this.readMicMetricsFromAnalyser(
        this.acousticMicAnalyser,
        this.acousticMicTimeData,
        this.acousticMicFloatFreqData,
        rpm,
        this.acousticMicCtx?.sampleRate || 48000
      );

      if (micMetrics) {
        this.acousticFftBins = micMetrics.fftBins;
        this.acousticCurrentHarmonics = micMetrics.harmonics;
        this.acousticSampleRateHz = micMetrics.sampleRate;
        this.recordAcousticSample({
          timestamp: Date.now(),
          rpm,
          noiseDb: micMetrics.noiseDb,
          vibrationScore: micMetrics.vibrationScore,
          dominantHz: micMetrics.dominantHz,
          harmonics: micMetrics.harmonics,
          source: 'microphone',
        });
      } else {
        const expected = computeExpectedAerodynamicDb(rpm);
        const resonanceBump = rpm >= 2050 && rpm <= 2480 ? 7.8 : rpm >= 4050 && rpm <= 4450 ? 5.2 : 0;
        const simDb = Number(
          Math.max(24, Math.min(78, expected + resonanceBump + (Math.random() - 0.5) * 2.4)).toFixed(1)
        );
        const synthSpec = synthesizeHarmonicSpectrumForRpm(
          rpm,
          simDb,
          this.acousticBladeCount,
          this.acousticSampleRateHz,
          ACOUSTIC_FFT_SIZE
        );
        const fftRes = analyzeFftSpectrumForHarmonics(
          synthSpec,
          this.acousticSampleRateHz,
          ACOUSTIC_FFT_SIZE,
          rpm,
          this.acousticBladeCount
        );
        this.acousticRawSpectrumDb = synthSpec;
        this.acousticFftBins = fftRes.fftBins;
        this.acousticCurrentHarmonics = fftRes.harmonics;
        const vibScore = Math.max(
          8,
          Math.min(
            100,
            Math.round(resonanceBump > 0 ? Math.max(68, fftRes.vibrationScore) : Math.min(48, fftRes.vibrationScore))
          )
        );
        this.recordAcousticSample({
          timestamp: Date.now(),
          rpm,
          noiseDb: simDb,
          vibrationScore: vibScore,
          dominantHz: fftRes.dominantHz,
          harmonics: fftRes.harmonics,
          source: 'sweep',
        });
      }
    }, 220);

    this.emitAcoustic();
    return this.getAcousticHeatmapState();
  }

  public stopLiveAcousticHeatmapCapture(): FanAcousticHeatmapState {
    if (this.acousticCaptureTimer !== null) {
      globalThis.clearInterval(this.acousticCaptureTimer);
      this.acousticCaptureTimer = null;
    }
    if (this.acousticSweepTimer !== null) {
      globalThis.clearInterval(this.acousticSweepTimer);
      this.acousticSweepTimer = null;
    }
    if (this.acousticMicStream) {
      this.acousticMicStream.getTracks().forEach((t) => t.stop());
      this.acousticMicStream = null;
    }
    if (this.acousticMicCtx) {
      void this.acousticMicCtx.close();
      this.acousticMicCtx = null;
    }
    this.acousticMicAnalyser = null;
    this.acousticMicTimeData = null;
    this.acousticMicFloatFreqData = null;
    this.acousticCapturing = false;
    this.acousticSweeping = false;
    this.acousticMicActive = false;
    this.emitAcoustic();
    return this.getAcousticHeatmapState();
  }

  public async runResonanceCalibrationSweep(
    onUpdate?: (state: FanAcousticHeatmapState) => void
  ): Promise<FanAcousticHeatmapState> {
    if (onUpdate && !this.acousticListeners.includes(onUpdate)) {
      this.acousticListeners.push(onUpdate);
    }
    if (this.acousticSweepTimer !== null) {
      globalThis.clearInterval(this.acousticSweepTimer);
      this.acousticSweepTimer = null;
    }

    this.acousticSamples = [];
    this.acousticUsingBaselineSeed = false;
    this.acousticSweeping = true;
    this.emitAcoustic();

    const totalSteps = 30;
    let step = 0;

    return new Promise<FanAcousticHeatmapState>((resolve) => {
      this.acousticSweepTimer = globalThis.setInterval(() => {
        step++;
        const rpm = Math.round(600 + ((step - 1) / Math.max(1, totalSteps - 1)) * 4750);
        const micMetrics = this.readMicMetricsFromAnalyser(
          this.acousticMicAnalyser || this.micAnalyser,
          this.acousticMicTimeData || this.micData,
          this.acousticMicFloatFreqData || this.micFloatFreqData,
          rpm,
          this.acousticMicCtx?.sampleRate || this.micCtx?.sampleRate || 48000
        );

        if (micMetrics) {
          this.acousticFftBins = micMetrics.fftBins;
          this.acousticCurrentHarmonics = micMetrics.harmonics;
          this.acousticSampleRateHz = micMetrics.sampleRate;
          this.recordAcousticSample({
            timestamp: Date.now(),
            rpm,
            noiseDb: micMetrics.noiseDb,
            vibrationScore: micMetrics.vibrationScore,
            dominantHz: micMetrics.dominantHz,
            harmonics: micMetrics.harmonics,
            source: 'microphone',
          });
        } else {
          const expected = computeExpectedAerodynamicDb(rpm);
          const inPrimaryRes = rpm >= 2000 && rpm <= 2490;
          const inSecondaryRes = rpm >= 4000 && rpm <= 4480;
          const spike = inPrimaryRes ? 8.6 : inSecondaryRes ? 5.4 : 0;
          const noiseDb = Number(
            Math.max(24, Math.min(78, expected + spike + (Math.random() - 0.5) * 1.8)).toFixed(1)
          );
          const synthSpec = synthesizeHarmonicSpectrumForRpm(
            rpm,
            noiseDb,
            this.acousticBladeCount,
            this.acousticSampleRateHz,
            ACOUSTIC_FFT_SIZE
          );
          const fftRes = analyzeFftSpectrumForHarmonics(
            synthSpec,
            this.acousticSampleRateHz,
            ACOUSTIC_FFT_SIZE,
            rpm,
            this.acousticBladeCount
          );
          this.acousticRawSpectrumDb = synthSpec;
          this.acousticFftBins = fftRes.fftBins;
          this.acousticCurrentHarmonics = fftRes.harmonics;
          const vibrationScore = inPrimaryRes
            ? Math.max(76, fftRes.vibrationScore)
            : inSecondaryRes
              ? Math.max(64, fftRes.vibrationScore)
              : Math.min(48, Math.round(14 + ((rpm - 500) / 5000) * 28));
          this.recordAcousticSample({
            timestamp: Date.now(),
            rpm,
            noiseDb,
            vibrationScore,
            dominantHz: fftRes.dominantHz,
            harmonics: fftRes.harmonics,
            source: 'sweep',
          });
        }

        if (step >= totalSteps) {
          if (this.acousticSweepTimer !== null) {
            globalThis.clearInterval(this.acousticSweepTimer);
            this.acousticSweepTimer = null;
          }
          this.acousticSweeping = false;
          this.emitAcoustic();
          resolve(this.getAcousticHeatmapState());
        }
      }, 120);
    });
  }

  public getAcousticHeatmapState(): FanAcousticHeatmapState {
    const rpmBins = FAN_HEATMAP_RPM_BINS;
    const dbBins = FAN_HEATMAP_DB_BINS;

    // Bin all samples into (rpmBin, dbBin) matrix and aggregate excited FFT harmonics per bin
    const cellAccum = new Map<
      string,
      {
        count: number;
        sumDb: number;
        maxDb: number;
        sumVib: number;
        topHarmonicHz: number | null;
        topHarmonicLabel: string | null;
        topHarmonicProminence: number;
      }
    >();
    const rpmAccum = rpmBins.map(() => ({
      count: 0,
      sumDb: 0,
      sumVib: 0,
      dominantHzSum: 0,
      dominantHzCount: 0,
      harmonicBuckets: new Map<number, { hzSum: number; count: number; maxProm: number; classification: string }>(),
    }));

    for (const s of this.acousticSamples) {
      const rIdx = Math.max(
        0,
        Math.min(rpmBins.length - 1, Math.floor((s.rpm - 500) / 500))
      );
      let dIdx = dbBins.findIndex((b) => s.noiseDb >= b.min && s.noiseDb < b.max);
      if (dIdx < 0) dIdx = s.noiseDb < dbBins[0].min ? 0 : dbBins.length - 1;

      const key = `${rIdx}:${dIdx}`;
      const existing = cellAccum.get(key) || {
        count: 0,
        sumDb: 0,
        maxDb: -Infinity,
        sumVib: 0,
        topHarmonicHz: null,
        topHarmonicLabel: null,
        topHarmonicProminence: -1,
      };
      existing.count += 1;
      existing.sumDb += s.noiseDb;
      existing.maxDb = Math.max(existing.maxDb, s.noiseDb);
      existing.sumVib += s.vibrationScore;
      const bestSampleHarmonic = s.harmonics?.[0];
      if (bestSampleHarmonic && bestSampleHarmonic.prominenceDb > existing.topHarmonicProminence) {
        existing.topHarmonicProminence = bestSampleHarmonic.prominenceDb;
        existing.topHarmonicHz = bestSampleHarmonic.hz;
        existing.topHarmonicLabel = bestSampleHarmonic.classification;
      } else if (existing.topHarmonicHz === null && s.dominantHz !== null) {
        existing.topHarmonicHz = s.dominantHz;
      }
      cellAccum.set(key, existing);

      const ra = rpmAccum[rIdx];
      ra.count += 1;
      ra.sumDb += s.noiseDb;
      ra.sumVib += s.vibrationScore;
      if (s.dominantHz !== null) {
        ra.dominantHzSum += s.dominantHz;
        ra.dominantHzCount += 1;
      }
      if (s.harmonics && s.harmonics.length > 0) {
        for (const h of s.harmonics) {
          if (!h.isExcited && h.prominenceDb < 7) continue;
          // Group nearby harmonic frequencies in 25 Hz buckets per RPM band
          const bucket = Math.round(h.hz / 25) * 25;
          const prevB = ra.harmonicBuckets.get(bucket);
          if (prevB) {
            prevB.hzSum += h.hz;
            prevB.count += 1;
            if (h.prominenceDb > prevB.maxProm) {
              prevB.maxProm = h.prominenceDb;
              prevB.classification = h.classification;
            }
          } else {
            ra.harmonicBuckets.set(bucket, {
              hzSum: h.hz,
              count: 1,
              maxProm: h.prominenceDb,
              classification: h.classification,
            });
          }
        }
      }
    }

    let maxCellCount = 1;
    for (const v of cellAccum.values()) {
      if (v.count > maxCellCount) maxCellCount = v.count;
    }

    // Compute persistent Major Harmonics across recent acoustic/FFT frames
    const recentWindow = this.acousticSamples.slice(-24);
    const harmonicFrameCount = recentWindow.filter((s) => s.harmonics && s.harmonics.length > 0).length;
    const globalBuckets = new Map<
      number,
      {
        hzSum: number;
        promSum: number;
        magMax: number;
        count: number;
        order: number | null;
        classification: string;
      }
    >();

    for (const s of recentWindow) {
      if (!s.harmonics || s.harmonics.length === 0) continue;
      // Count each frequency bucket once per FFT frame so multi-peak proximity doesn't double count
      const seenInFrame = new Set<number>();
      for (const h of s.harmonics) {
        if (h.prominenceDb < 6.0) continue;
        const bucket = Math.round(h.hz / 24) * 24;
        if (seenInFrame.has(bucket)) continue;
        seenInFrame.add(bucket);
        const cur = globalBuckets.get(bucket);
        if (cur) {
          cur.hzSum += h.hz;
          cur.promSum += h.prominenceDb;
          cur.magMax = Math.max(cur.magMax, h.magnitudeDb);
          cur.count += 1;
          if (h.prominenceDb >= 8) cur.classification = h.classification;
        } else {
          globalBuckets.set(bucket, {
            hzSum: h.hz,
            promSum: h.prominenceDb,
            magMax: h.magnitudeDb,
            count: 1,
            order: h.harmonicOrder,
            classification: h.classification,
          });
        }
      }
    }

    const bucketMetrics = new Map<
      number,
      { count: number; persistencePct: number; avgProminenceDb: number; isMajor: boolean; classification: string; avgHz: number; magMax: number; order: number | null }
    >();
    for (const [bucket, b] of globalBuckets.entries()) {
      const persistencePct =
        harmonicFrameCount > 0 ? Math.round((b.count / harmonicFrameCount) * 100) : 0;
      const avgProminenceDb = Number((b.promSum / Math.max(1, b.count)).toFixed(1));
      const isMajor =
        b.count >= 2 &&
        ((persistencePct >= 30 && avgProminenceDb >= 7.5) || (b.count >= 3 && avgProminenceDb >= 6.5));
      bucketMetrics.set(bucket, {
        count: b.count,
        persistencePct,
        avgProminenceDb,
        isMajor,
        classification: b.classification,
        avgHz: Math.round(b.hzSum / b.count),
        magMax: Number(b.magMax.toFixed(1)),
        order: b.order,
      });
    }

    const worstChannel =
      this.pwmState.channels.reduce<FanPwmChannelReading | null>(
        (worst, ch) =>
          !worst || ch.bearingHealthIndex < worst.bearingHealthIndex ? ch : worst,
        null
      );
    const lowestBearingHealthIndex = this.pwmState.lowestBearingHealthIndex;
    const baseBearingProb = computePredictiveBearingFailureProbability(lowestBearingHealthIndex);
    const bearingHealthContext: FanBearingHealthAcousticContext = {
      lowestBearingHealthIndex,
      avgBearingHealthIndex: this.pwmState.avgBearingHealthIndex,
      worstChannelId: worstChannel?.id || 'cpu_fan1',
      worstChannelLabel: worstChannel?.label || 'CPU Cooler Fan',
      worstTier: worstChannel?.bearingHealthTier || 'HEALTHY',
      predictiveFailureProbabilityPct: baseBearingProb.probabilityPct,
      riskLevel: baseBearingProb.riskLevel,
    };

    const majorHarmonics: FanFftHarmonicPeak[] = Array.from(bucketMetrics.values())
      .filter((m) => m.isMajor)
      .sort((a, b) => b.persistencePct - a.persistencePct || b.avgProminenceDb - a.avgProminenceDb)
      .slice(0, 6)
      .map((m) => {
        const failEst = computePredictiveBearingFailureProbability(lowestBearingHealthIndex, {
          prominenceDb: m.avgProminenceDb,
          persistencePct: m.persistencePct,
          isMajorHarmonic: true,
        });
        return {
          hz: m.avgHz,
          magnitudeDb: m.magMax,
          prominenceDb: m.avgProminenceDb,
          harmonicOrder: m.order,
          classification: m.classification,
          isExcited: true,
          isMajorHarmonic: true,
          persistenceCount: m.count,
          persistencePct: m.persistencePct,
          avgProminenceDb: m.avgProminenceDb,
          predictiveBearingFailurePct: failEst.probabilityPct,
          bearingFailureRiskLevel: failEst.riskLevel,
          bearingImpactSummary: failEst.impactSummary,
        };
      });

    const annotatedCurrentHarmonics: FanFftHarmonicPeak[] = this.acousticCurrentHarmonics.map((h) => {
      const bucket = Math.round(h.hz / 24) * 24;
      const m = bucketMetrics.get(bucket);
      const isMajor = Boolean(m?.isMajor);
      const persistencePct =
        m?.persistencePct ?? (harmonicFrameCount > 0 ? Math.round(100 / harmonicFrameCount) : 100);
      const avgProminenceDb = m?.avgProminenceDb ?? h.prominenceDb;
      const failEst = computePredictiveBearingFailureProbability(lowestBearingHealthIndex, {
        prominenceDb: avgProminenceDb,
        persistencePct,
        isMajorHarmonic: isMajor,
      });
      return {
        ...h,
        isMajorHarmonic: isMajor,
        persistenceCount: m?.count ?? 1,
        persistencePct,
        avgProminenceDb,
        predictiveBearingFailurePct: failEst.probabilityPct,
        bearingFailureRiskLevel: failEst.riskLevel,
        bearingImpactSummary: failEst.impactSummary,
      };
    });

    const resonanceZones: FanResonanceZone[] = [];
    const rpmSummary = rpmBins.map((bin, rIdx) => {
      const midRpm = (bin.min + bin.max) / 2;
      const expectedDb = computeExpectedAerodynamicDb(midRpm);
      const ra = rpmAccum[rIdx];
      const avgDb = ra.count > 0 ? Number((ra.sumDb / ra.count).toFixed(1)) : null;
      const avgVib = ra.count > 0 ? Math.round(ra.sumVib / ra.count) : 0;
      const excessDb = avgDb !== null ? Number((avgDb - expectedDb).toFixed(1)) : 0;
      const isResonance = ra.count > 0 && (excessDb >= 4.5 || avgVib >= 60);
      const dominantHz =
        ra.dominantHzCount > 0 ? Math.round(ra.dominantHzSum / ra.dominantHzCount) : null;

      const excitedHarmonics = Array.from(ra.harmonicBuckets.values())
        .sort((a, b) => b.maxProm - a.maxProm || b.count - a.count)
        .slice(0, 3)
        .map((b) => {
          const avgHz = Math.round(b.hzSum / b.count);
          const gm = bucketMetrics.get(Math.round(avgHz / 24) * 24);
          const localPct = ra.count > 0 ? Math.round((b.count / ra.count) * 100) : 0;
          const persistencePct = Math.max(localPct, gm?.persistencePct ?? 0);
          const isMajorHarmonic = Boolean(gm?.isMajor) || (b.count >= 2 && localPct >= 50 && b.maxProm >= 7.5);
          const failEst = computePredictiveBearingFailureProbability(lowestBearingHealthIndex, {
            prominenceDb: Number(b.maxProm.toFixed(1)),
            persistencePct,
            isMajorHarmonic,
          });
          return {
            hz: avgHz,
            classification: b.classification,
            prominenceDb: Number(b.maxProm.toFixed(1)),
            isMajorHarmonic,
            persistencePct,
            predictiveBearingFailurePct: failEst.probabilityPct,
          };
        });

      if (isResonance && avgDb !== null) {
        const severity: 'MODERATE' | 'HIGH' = excessDb >= 7.0 || avgVib >= 72 ? 'HIGH' : 'MODERATE';
        const harmonicSummary =
          excitedHarmonics.length > 0
            ? ` Wzbudzone harmoniczne FFT: ${excitedHarmonics.map((h) => `${h.hz} Hz (${h.classification}${h.isMajorHarmonic ? ', Major Harmonic' : ''})`).join(', ')}.`
            : '';
        resonanceZones.push({
          rpmMin: bin.min,
          rpmMax: bin.max,
          avgDb,
          expectedDb,
          excessDb,
          vibrationScore: avgVib,
          dominantHz: excitedHarmonics[0]?.hz ?? dominantHz,
          excitedHarmonics,
          severity,
          recommendation:
            severity === 'HIGH'
              ? `Silny rezonans mechaniczny w zakresie ${bin.min}–${bin.max} RPM (+${excessDb.toFixed(1)} dB ponad tło aerodynamiczne).${harmonicSummary} Sprawdź śruby montażowe, podkładki antywibracyjne lub pomiń ten zakres na krzywej wentylatora.`
              : `Podwyższone drgania w zakresie ${bin.min}–${bin.max} RPM (+${excessDb.toFixed(1)} dB).${harmonicSummary} Zalecane dostrojenie histerezy krzywej PWM.`,
        });
      }

      return {
        rpmMin: bin.min,
        rpmMax: bin.max,
        avgDb,
        expectedDb,
        sampleCount: ra.count,
        vibrationScore: avgVib,
        isResonance,
      };
    });

    const cells: FanAcousticHeatmapCell[] = [];
    for (let rIdx = 0; rIdx < rpmBins.length; rIdx++) {
      const rBin = rpmBins[rIdx];
      const rSum = rpmSummary[rIdx];
      for (let dIdx = 0; dIdx < dbBins.length; dIdx++) {
        const dBin = dbBins[dIdx];
        const acc = cellAccum.get(`${rIdx}:${dIdx}`);
        const count = acc ? acc.count : 0;
        const avgDb = acc && count > 0 ? Number((acc.sumDb / count).toFixed(1)) : 0;
        const maxDb = acc && count > 0 ? Number(acc.maxDb.toFixed(1)) : 0;
        const avgVib = acc && count > 0 ? Math.round(acc.sumVib / count) : 0;
        const countFactor = count > 0 ? 0.25 + 0.75 * (count / maxCellCount) : 0;
        const dbSeverity = count > 0 ? Math.max(0.15, Math.min(1, (avgDb - 26) / 38)) : 0;
        const intensity = count > 0 ? Number(Math.min(1, countFactor * 0.55 + dbSeverity * 0.45).toFixed(3)) : 0;
        const isResonance = count > 0 && ((rSum.isResonance && avgDb >= rSum.expectedDb + 3.0) || avgVib >= 62);
        const topHz = acc ? acc.topHarmonicHz : null;
        const gmTop = topHz !== null ? bucketMetrics.get(Math.round(topHz / 24) * 24) : undefined;
        const topHarmonicIsMajor = Boolean(gmTop?.isMajor);
        const cellFailEst =
          topHz !== null
            ? computePredictiveBearingFailureProbability(lowestBearingHealthIndex, {
                prominenceDb: gmTop?.avgProminenceDb ?? acc?.topHarmonicProminence,
                persistencePct: gmTop?.persistencePct,
                isMajorHarmonic: topHarmonicIsMajor,
              })
            : null;
        cells.push({
          rpmBinIndex: rIdx,
          rpmMin: rBin.min,
          rpmMax: rBin.max,
          dbBinIndex: dIdx,
          dbMin: dBin.min,
          dbMax: dBin.max,
          count,
          avgDb,
          maxDb,
          avgVibrationScore: avgVib,
          intensity,
          isResonance,
          topHarmonicHz: topHz,
          topHarmonicLabel: acc ? acc.topHarmonicLabel : null,
          topHarmonicIsMajor,
          predictiveBearingFailurePct: cellFailEst?.probabilityPct,
        });
      }
    }

    const fundamentalHz = Number((this.acousticCurrentRpm / 60).toFixed(1));
    const bladePassHz = Number((fundamentalHz * this.acousticBladeCount).toFixed(1));

    return {
      capturing: this.acousticCapturing,
      sweeping: this.acousticSweeping,
      micActive: this.acousticMicActive || this.state.micMonitoring,
      micError: this.acousticMicError,
      currentRpm: this.acousticCurrentRpm,
      currentNoiseDb: this.acousticCurrentDb,
      currentVibrationScore: this.acousticCurrentVib,
      currentDominantHz: this.acousticCurrentDominantHz,
      fundamentalHz,
      bladePassHz,
      bladeCount: this.acousticBladeCount,
      fftSize: ACOUSTIC_FFT_SIZE,
      sampleRateHz: this.acousticSampleRateHz,
      fftBins: [...this.acousticFftBins],
      currentHarmonics: annotatedCurrentHarmonics,
      majorHarmonics,
      bearingHealthContext,
      sampleCount: this.acousticSamples.length,
      rpmBins,
      dbBins,
      cells,
      rpmSummary,
      resonanceZones,
      samples: [...this.acousticSamples],
    };
  }

  public buildFftSpectrumExportData(): FanFftSpectrumJsonExport {
    const state = this.getAcousticHeatmapState();
    const binResolutionHz = Number((state.sampleRateHz / state.fftSize).toFixed(4));
    const displaySpanHz = (ACOUSTIC_FFT_MAX_HZ - 20) / Math.max(1, ACOUSTIC_FFT_DISPLAY_BINS);

    const displayBuckets: FanFftFrequencyBucketEntry[] = state.fftBins.map((bin, idx) => {
      const hzStart = Number((20 + idx * displaySpanHz).toFixed(2));
      const hzEnd = Number((20 + (idx + 1) * displaySpanHz).toFixed(2));
      return {
        binIndex: idx,
        hzStart,
        hzEnd,
        centerHz: bin.hz,
        magnitudeDb: bin.magnitudeDb,
        normalized: bin.normalized,
      };
    });

    const rawSpectrum = this.acousticRawSpectrumDb;
    const fullFrequencyBuckets: FanFftFrequencyBucketEntry[] = [];
    if (rawSpectrum && rawSpectrum.length > 0) {
      for (let i = 0; i < rawSpectrum.length; i++) {
        const hzStart = Number((i * binResolutionHz).toFixed(2));
        const hzEnd = Number(((i + 1) * binResolutionHz).toFixed(2));
        const centerHz = Number(((hzStart + hzEnd) / 2).toFixed(2));
        const rawDb = Number.isFinite(rawSpectrum[i]) ? rawSpectrum[i] : -100;
        const clampedDb = Number(Math.max(-100, Math.min(0, rawDb)).toFixed(2));
        const normalized = Number(Math.max(0, Math.min(1, (clampedDb + 92) / 76)).toFixed(4));
        fullFrequencyBuckets.push({
          binIndex: i,
          hzStart,
          hzEnd,
          centerHz,
          magnitudeDb: clampedDb,
          normalized,
        });
      }
    } else if (displayBuckets.length > 0) {
      fullFrequencyBuckets.push(...displayBuckets);
    }

    return {
      schema: 'systempulse-fft-spectrum-v1',
      exportedAt: new Date().toISOString(),
      analysisConfig: {
        fftSize: state.fftSize,
        sampleRateHz: state.sampleRateHz,
        binResolutionHz,
        totalRawBins: fullFrequencyBuckets.length,
        displayBucketCount: displayBuckets.length,
        rpm: state.currentRpm,
        bladeCount: state.bladeCount,
        fundamentalHz: state.fundamentalHz,
        bladePassHz: state.bladePassHz,
        micActive: state.micActive,
        currentNoiseDb: state.currentNoiseDb,
        currentVibrationScore: state.currentVibrationScore,
        currentDominantHz: state.currentDominantHz,
      },
      bearingHealthContext: state.bearingHealthContext,
      displayBuckets,
      fullFrequencyBuckets,
      currentHarmonics: state.currentHarmonics,
      majorHarmonics: state.majorHarmonics,
      resonanceZones: state.resonanceZones,
    };
  }

  public exportFftSpectrumToJson(): {
    filename: string;
    json: string;
    data: FanFftSpectrumJsonExport;
  } {
    const data = this.buildFftSpectrumExportData();
    const json = JSON.stringify(data, null, 2);
    const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const filename = `systempulse-fft-spectrum-${stamp}.json`;

    if (typeof document !== 'undefined' && typeof Blob !== 'undefined' && typeof URL.createObjectURL === 'function') {
      const blob = new Blob([json], { type: 'application/json;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }

    return { filename, json, data };
  }

  private emitAcoustic(): void {
    const snap = this.getAcousticHeatmapState();
    for (const l of this.acousticListeners) l(snap);
  }
}

export const fanTestService = new FanTestService();
