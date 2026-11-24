import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  FanTestService,
  computeExpectedAerodynamicDb,
  computePredictiveBearingFailureProbability,
} from '../fanTest.service';
import {
  renderFanAcousticHeatmapPanelHtml,
  renderFanBearingHistorySummaryHtml,
  renderFanFftHarmonicsStripHtml,
  renderFanPwmMonitorInnerHtml,
  renderFanResonanceZonesHtml,
  renderPredictiveBearingAlertModalHtml,
} from '../../ui/fanDiagnosticsVisuals';

describe('FanTestService PWM Frequency Monitor & Acoustic Resonance Heatmap', () => {
  let service: FanTestService;

  beforeEach(() => {
    service = new FanTestService();
  });

  afterEach(() => {
    service.stop();
    service.stopPwmFrequencyMonitor();
    service.stopLiveAcousticHeatmapCapture();
  });

  it('measures actual PWM signal frequency in Hz for each fan and highlights deviations from motherboard programmed frequency', () => {
    const initial = service.getPwmMonitorState();
    expect(initial.active).toBe(false);
    expect(initial.programmedHz).toBe(25000);
    expect(initial.channels.length).toBeGreaterThanOrEqual(4);

    // Start PWM monitoring and sample frequencies
    const started = service.startPwmFrequencyMonitor();
    expect(started.active).toBe(true);
    expect(started.sampleCount).toBeGreaterThanOrEqual(1);
    for (const ch of started.channels) {
      expect(ch.measuredHz).toBeGreaterThan(10000);
      expect(ch.programmedHz).toBe(25000);
      expect(ch.historyHz.length).toBeGreaterThanOrEqual(2);
    }

    // Enabling drift test must flag channels deviating past tolerance
    const drifted = service.setPwmDriftTestEnabled(true);
    expect(drifted.deviationCount).toBeGreaterThan(0);
    const flagged = drifted.channels.filter((c) => c.status !== 'OK');
    expect(flagged.length).toBe(drifted.deviationCount);
    for (const bad of flagged) {
      expect(bad.deviationPct).toBeGreaterThan(drifted.tolerancePct);
      expect(Math.abs(bad.deviationHz)).toBeGreaterThan(0);
    }

    // Updating motherboard programmed frequency updates every channel target
    const lowFreq = service.setProgrammedPwmFrequencyHz(1000);
    expect(lowFreq.programmedHz).toBe(1000);
    for (const ch of lowFreq.channels) {
      expect(ch.programmedHz).toBe(1000);
      expect(ch.measuredHz).toBeGreaterThan(500);
      expect(ch.measuredHz).toBeLessThan(1500);
    }

    const stopped = service.stopPwmFrequencyMonitor();
    expect(stopped.active).toBe(false);
  });

  it('correlates fan RPM with microphone noise levels in a 2D heatmap and identifies resonance/vibration RPM zones', () => {
    service.clearAcousticHeatmap();
    expect(service.getAcousticHeatmapState().sampleCount).toBe(0);

    // Record smooth baseline airflow samples across low and mid-high RPM
    for (const rpm of [800, 1200, 1700, 2800, 3300]) {
      service.recordAcousticSample({
        timestamp: Date.now(),
        rpm,
        noiseDb: computeExpectedAerodynamicDb(rpm),
        vibrationScore: 22,
        dominantHz: 110,
        source: 'microphone',
      });
    }

    expect(service.getAcousticHeatmapState().resonanceZones.length).toBe(0);

    // Inject loud mechanical vibration/resonance spike in the 2000-2500 RPM band
    for (const rpm of [2100, 2250, 2380]) {
      service.recordAcousticSample({
        timestamp: Date.now(),
        rpm,
        noiseDb: computeExpectedAerodynamicDb(rpm) + 11.5,
        vibrationScore: 84,
        dominantHz: 192,
        source: 'microphone',
      });
    }

    const hm = service.getAcousticHeatmapState();
    expect(hm.sampleCount).toBe(8);
    expect(hm.cells.length).toBe(hm.rpmBins.length * hm.dbBins.length);

    // Verify 2000-2500 RPM resonance zone is detected
    const resZone = hm.resonanceZones.find((z) => z.rpmMin === 2000 && z.rpmMax === 2500);
    expect(resZone).toBeDefined();
    expect(resZone!.severity).toBe('HIGH');
    expect(resZone!.excessDb).toBeGreaterThanOrEqual(7);
    expect(resZone!.dominantHz).toBe(192);

    // Verify corresponding heatmap cells are flagged as resonance
    const flaggedCells = hm.cells.filter((c) => c.rpmMin === 2000 && c.count > 0 && c.isResonance);
    expect(flaggedCells.length).toBeGreaterThan(0);
  });

  it('triggers visual warning pulse only when fan RPM deviates from motherboard duty cycle by >15% for longer than 3 seconds', () => {
    const t0 = 1_000_000;

    // Initial sample with healthy matching RPM (within ±15%)
    const okState = service.samplePwmChannelsOnce(t0);
    expect(okState.rpmDutyWarningCount).toBe(0);
    expect(okState.channels.every((c) => !c.rpmDutyWarningPulse)).toBe(true);

    // Inject >25% RPM lag on cpu_fan1 at t = 1s (starts deviation timer, NOT yet > 3s)
    const expectedCpuRpm = okState.channels.find((c) => c.id === 'cpu_fan1')!.expectedRpm;
    const devStart = service.samplePwmChannelsOnce(t0 + 1000, {
      cpu_fan1: { dutyPct: okState.channels[0].dutyPct, rpm: Math.round(expectedCpuRpm * 0.7) },
    });
    const chAtStart = devStart.channels.find((c) => c.id === 'cpu_fan1')!;
    expect(Math.abs(chAtStart.rpmDutyDeviationPct)).toBeGreaterThan(15);
    expect(chAtStart.rpmDeviationDurationMs).toBe(0);
    expect(chAtStart.rpmDutyWarningPulse).toBe(false);

    // At +2.5s of sustained deviation (still <= 3.0s): no warning pulse yet
    const devMid = service.samplePwmChannelsOnce(t0 + 3500, {
      cpu_fan1: { dutyPct: okState.channels[0].dutyPct, rpm: Math.round(expectedCpuRpm * 0.7) },
    });
    const chAtMid = devMid.channels.find((c) => c.id === 'cpu_fan1')!;
    expect(chAtMid.rpmDeviationDurationMs).toBe(2500);
    expect(chAtMid.rpmDutyWarningPulse).toBe(false);

    // At +3.5s (> 3000ms): visual warning pulse must fire
    const devTriggered = service.samplePwmChannelsOnce(t0 + 4500, {
      cpu_fan1: { dutyPct: okState.channels[0].dutyPct, rpm: Math.round(expectedCpuRpm * 0.7) },
    });
    const chTriggered = devTriggered.channels.find((c) => c.id === 'cpu_fan1')!;
    expect(chTriggered.rpmDeviationDurationMs).toBe(3500);
    expect(chTriggered.rpmDutyWarningPulse).toBe(true);
    expect(chTriggered.rpmDutyFaultHint).toContain('bearing');
    expect(devTriggered.rpmDutyWarningCount).toBeGreaterThanOrEqual(1);

    // Returning RPM back within duty tolerance clears the warning pulse immediately
    const recovered = service.samplePwmChannelsOnce(t0 + 5000, {
      cpu_fan1: { dutyPct: okState.channels[0].dutyPct, rpm: expectedCpuRpm },
    });
    const chRecovered = recovered.channels.find((c) => c.id === 'cpu_fan1')!;
    expect(chRecovered.rpmDutyWarningPulse).toBe(false);
    expect(chRecovered.rpmDeviationDurationMs).toBe(0);
  });

  it('performs real-time FFT analysis on PCM microphone input to identify specific excited harmonic frequencies', () => {
    service.clearAcousticHeatmap();

    // Synthesize 4096 PCM samples @ 48 kHz for a 2400 RPM fan (f0 = 40 Hz, 7-blade BPF = 280 Hz)
    // with strong structural resonance excitation at 280 Hz (BPF) and 560 Hz (2x BPF)
    const sampleRate = 48000;
    const N = 4096;
    const pcm = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      const t = i / sampleRate;
      const noiseFloor = 0.004 * Math.sin(i * 1.93) * Math.cos(i * 0.47);
      pcm[i] =
        noiseFloor +
        0.04 * Math.sin(2 * Math.PI * 40 * t) +
        0.18 * Math.sin(2 * Math.PI * 280 * t) +
        0.09 * Math.sin(2 * Math.PI * 560 * t);
    }

    const state = service.processMicrophoneTimeDomainFrame(pcm, sampleRate, 2400);
    expect(state.fftBins.length).toBeGreaterThan(20);
    expect(state.fundamentalHz).toBeCloseTo(40, 1);
    expect(state.bladePassHz).toBeCloseTo(280, 1);
    expect(state.currentHarmonics.length).toBeGreaterThanOrEqual(2);

    // Dominant harmonic peak should pinpoint ~280 Hz Blade Pass Frequency
    const bpfPeak = state.currentHarmonics.find((h) => Math.abs(h.hz - 280) <= 15);
    expect(bpfPeak).toBeDefined();
    expect(bpfPeak!.isExcited).toBe(true);
    expect(bpfPeak!.classification).toContain('BPF');

    // Resonance zone in 2000-2500 RPM should list the excited 280 Hz FFT harmonic
    const resZone = state.resonanceZones.find((z) => z.rpmMin === 2000 && z.rpmMax === 2500);
    expect(resZone).toBeDefined();
    expect(resZone!.excitedHarmonics.some((h) => Math.abs(h.hz - 280) <= 15)).toBe(true);
  });

  it('tracks long-term PWM frequency drift to compute predictive Bearing Health Index with color-coded tiers', () => {
    const t0 = 2_000_000;
    const healthyState = service.samplePwmChannelsOnce(t0);
    const healthyCpu = healthyState.channels.find((c) => c.id === 'cpu_fan1')!;
    expect(healthyCpu.bearingHealthIndex).toBeGreaterThanOrEqual(80);
    expect(healthyCpu.bearingHealthTier).toBe('HEALTHY');
    expect(healthyState.lowestBearingHealthIndex).toBeLessThanOrEqual(healthyState.avgBearingHealthIndex);

    // Inject sustained long-term frequency drift + RPM/duty lag on cpu_opt channel
    let latest = healthyState;
    for (let step = 1; step <= 18; step++) {
      latest = service.samplePwmChannelsOnce(t0 + step * 500, {
        cpu_opt: {
          measuredHz: Math.round(latest.programmedHz * (1 - (0.04 + step * 0.0045))),
          dutyPct: 60,
          rpm: 1650, // Heavy RPM lag vs 60% of 5000*0.88 = 2640 expected RPM
        },
      });
    }

    const degradedOpt = latest.channels.find((c) => c.id === 'cpu_opt')!;
    expect(degradedOpt.longTermDriftPct).toBeGreaterThan(5);
    expect(['DRIFTING', 'WORSENING']).toContain(degradedOpt.driftTrend);
    expect(degradedOpt.bearingHealthIndex).toBeLessThan(60);
    expect(['DEGRADED', 'CRITICAL']).toContain(degradedOpt.bearingHealthTier);
    expect(latest.lowestBearingHealthIndex).toBeLessThan(60);
  });

  it('badges persistent baseline-exceeding FFT frequencies as Major Harmonic while ignoring transient one-off spikes', () => {
    service.clearAcousticHeatmap();
    const sampleRate = 48000;
    const N = 4096;

    const makeFrame = (includeTransient740Hz: boolean): Float32Array => {
      const pcm = new Float32Array(N);
      for (let i = 0; i < N; i++) {
        const t = i / sampleRate;
        const floor = 0.004 * Math.sin(i * 1.93) * Math.cos(i * 0.47);
        pcm[i] =
          floor +
          0.19 * Math.sin(2 * Math.PI * 280 * t) +
          (includeTransient740Hz ? 0.14 * Math.sin(2 * Math.PI * 740 * t) : 0);
      }
      return pcm;
    };

    // Feed 4 consecutive FFT frames: 280 Hz appears in all 4 frames; 740 Hz appears only once
    service.processMicrophoneTimeDomainFrame(makeFrame(false), sampleRate, 2400);
    service.processMicrophoneTimeDomainFrame(makeFrame(false), sampleRate, 2400);
    service.processMicrophoneTimeDomainFrame(makeFrame(false), sampleRate, 2400);
    const finalState = service.processMicrophoneTimeDomainFrame(makeFrame(true), sampleRate, 2400);

    // 280 Hz must be promoted to Major Harmonic with high persistence
    const major280 = finalState.majorHarmonics.find((h) => Math.abs(h.hz - 280) <= 20);
    expect(major280).toBeDefined();
    expect(major280!.isMajorHarmonic).toBe(true);
    expect(major280!.persistenceCount).toBe(4);
    expect(major280!.persistencePct).toBe(100);

    // One-off 740 Hz transient spike must NOT be flagged as a Major Harmonic
    const current740 = finalState.currentHarmonics.find((h) => Math.abs(h.hz - 740) <= 20);
    expect(current740).toBeDefined();
    expect(current740!.isMajorHarmonic).toBe(false);
    expect(finalState.majorHarmonics.some((h) => Math.abs(h.hz - 740) <= 20)).toBe(false);

    // Resonance zone tags must also reflect Major Harmonic status for 280 Hz
    const resZone = finalState.resonanceZones.find((z) => z.rpmMin === 2000 && z.rpmMax === 2500);
    expect(resZone).toBeDefined();
    const zone280 = resZone!.excitedHarmonics.find((h) => Math.abs(h.hz - 280) <= 20);
    expect(zone280?.isMajorHarmonic).toBe(true);
  });

  it('derives Predictive Bearing Failure Probability from Bearing Health Index onto Major Harmonic badges and tooltips', () => {
    const healthyProb = computePredictiveBearingFailureProbability(95, {
      prominenceDb: 12,
      persistencePct: 100,
      isMajorHarmonic: true,
    });
    const degradedProb = computePredictiveBearingFailureProbability(42, {
      prominenceDb: 12,
      persistencePct: 100,
      isMajorHarmonic: true,
    });
    expect(degradedProb.probabilityPct).toBeGreaterThan(healthyProb.probabilityPct);
    expect(healthyProb.riskLevel).toBe('LOW');
    expect(['ELEVATED', 'CRITICAL']).toContain(degradedProb.riskLevel);

    // Degrade PWM Bearing Health Index on a channel, then feed persistent FFT frames
    const t0 = 3_000_000;
    const basePwm = service.samplePwmChannelsOnce(t0);
    for (let step = 1; step <= 16; step++) {
      service.samplePwmChannelsOnce(t0 + step * 500, {
        cha_fan2: {
          measuredHz: Math.round(basePwm.programmedHz * (1 - (0.05 + step * 0.005))),
          dutyPct: 65,
          rpm: 1100,
        },
      });
    }

    service.clearAcousticHeatmap();
    const sampleRate = 48000;
    const N = 4096;
    const pcm = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      const t = i / sampleRate;
      pcm[i] = 0.004 * Math.sin(i * 1.93) + 0.2 * Math.sin(2 * Math.PI * 280 * t);
    }
    service.processMicrophoneTimeDomainFrame(pcm, sampleRate, 2400);
    const hmState = service.processMicrophoneTimeDomainFrame(pcm, sampleRate, 2400);

    expect(hmState.bearingHealthContext.lowestBearingHealthIndex).toBeLessThan(60);
    const major = hmState.majorHarmonics.find((h) => Math.abs(h.hz - 280) <= 20)!;
    expect(major).toBeDefined();
    expect(major.predictiveBearingFailurePct).toBeGreaterThan(30);
    expect(['ELEVATED', 'CRITICAL']).toContain(major.bearingFailureRiskLevel);

    const chipsHtml = renderFanFftHarmonicsStripHtml(hmState);
    expect(chipsHtml).toContain('Predictive Bearing Failure Probability');
    expect(chipsHtml).toContain(`${major.predictiveBearingFailurePct!.toFixed(1)}%`);

    const zonesHtml = renderFanResonanceZonesHtml(hmState);
    expect(zonesHtml).toContain('Predictive Bearing Failure Probability');
  });

  it('exports full FFT frequency bucket data as structured JSON for advanced vibration diagnostics', () => {
    const state = service.getAcousticHeatmapState();
    const panelHtml = renderFanAcousticHeatmapPanelHtml(state);
    expect(panelHtml).toContain('id="fan-heatmap-export-fft-btn"');
    expect(panelHtml).toContain('Export FFT Spectrum');

    const exported = service.exportFftSpectrumToJson();
    expect(exported.filename).toMatch(/^systempulse-fft-spectrum-.*\.json$/);
    const parsed = JSON.parse(exported.json);
    expect(parsed.schema).toBe('systempulse-fft-spectrum-v1');
    expect(parsed.analysisConfig.fftSize).toBe(4096);
    expect(parsed.analysisConfig.sampleRateHz).toBe(48000);
    expect(parsed.fullFrequencyBuckets.length).toBe(2048);
    expect(parsed.displayBuckets.length).toBe(72);
    expect(parsed.bearingHealthContext).toBeDefined();
    expect(parsed.bearingHealthContext.predictiveFailureProbabilityPct).toBeGreaterThan(0);
    expect(Array.isArray(parsed.majorHarmonics)).toBe(true);
    expect(Array.isArray(parsed.resonanceZones)).toBe(true);
    // Verify ordered frequency buckets
    expect(parsed.fullFrequencyBuckets[0].hzStart).toBe(0);
    expect(parsed.fullFrequencyBuckets[1].hzStart).toBeGreaterThan(parsed.fullFrequencyBuckets[0].hzStart);
  });

  it('renders 7-day Bearing Health mini sparkline and supports custom predictive maintenance threshold slider in tooltip', () => {
    const initial = service.getPwmMonitorState();
    expect(initial.predictiveMaintenanceThresholdPct).toBe(70);
    expect(initial.maintenanceAlertCount).toBe(0);

    const cha2 = initial.channels.find((c) => c.id === 'cha_fan2')!;
    expect(cha2.bearingHealth7DayHistory.length).toBe(7);
    expect(cha2.bearingHealth7DayHistory[0].label).toBe('-6d');
    expect(cha2.bearingHealth7DayHistory[6].label).toBe('Today');
    expect(cha2.bearingHealth7DayHistory[6].score).toBe(cha2.bearingHealthIndex);
    expect(cha2.maintenanceAlertTriggered).toBe(false);

    // Raising predictive maintenance threshold above cha_fan2 (91) to 92 must trigger maintenance alert
    const strictState = service.setPredictiveMaintenanceThresholdPct(92);
    expect(strictState.predictiveMaintenanceThresholdPct).toBe(92);
    const strictCha2 = strictState.channels.find((c) => c.id === 'cha_fan2')!;
    expect(strictCha2.maintenanceAlertTriggered).toBe(true);
    expect(strictState.maintenanceAlertCount).toBeGreaterThanOrEqual(1);

    // Lowering threshold clamps to 30% minimum and clears the alert
    const lenientState = service.setPredictiveMaintenanceThresholdPct(15);
    expect(lenientState.predictiveMaintenanceThresholdPct).toBe(30);
    expect(lenientState.maintenanceAlertCount).toBe(0);

    // Inject degradation so Today score in 7-day history reflects drop
    const t0 = 4_000_000;
    let degraded = service.samplePwmChannelsOnce(t0);
    for (let step = 1; step <= 14; step++) {
      degraded = service.samplePwmChannelsOnce(t0 + step * 500, {
        cha_fan2: {
          measuredHz: Math.round(degraded.programmedHz * (1 - (0.06 + step * 0.005))),
          dutyPct: 60,
          rpm: 950,
        },
      });
    }
    const degCha2 = degraded.channels.find((c) => c.id === 'cha_fan2')!;
    expect(degCha2.bearingHealth7DayHistory[6].score).toBe(degCha2.bearingHealthIndex);
    expect(degCha2.bearingHealthIndex).toBeLessThan(70);

    // Raise threshold back to 75% and verify rendered card includes sparkline SVG, tooltip range slider & alert pill
    const alertState = service.setPredictiveMaintenanceThresholdPct(75);
    const html = renderFanPwmMonitorInnerHtml(alertState);
    expect(html).toContain('fan-pwm-bearing-sparkline');
    expect(html).toContain('7-Day Trend');
    expect(html).toContain('fan-bearing-tooltip');
    expect(html).toContain('class="fan-bearing-threshold-slider"');
    expect(html).toContain('value="75"');
    expect(html).toContain('Predictive Maintenance Alert');
    expect(html).toContain('fan-pwm-bearing-maint-pill');
  });

  it('computes predicted life expectancy, renders Bearing Health History tab, and builds Predictive Bearing Health Alert modal', () => {
    const t0 = 5_000_000;
    let state = service.samplePwmChannelsOnce(t0);
    const healthyCpu = state.channels.find((c) => c.id === 'cpu_fan1')!;
    expect(healthyCpu.predictedLifeExpectancyPct).toBeGreaterThanOrEqual(75);
    expect(healthyCpu.estimatedRemainingHours).toBeGreaterThan(20000);
    expect(healthyCpu.maintenanceInstructions.length).toBeGreaterThanOrEqual(3);

    // Inject severe bearing drift and RPM lag on cha_fan2 so predicted life drops sharply
    for (let step = 1; step <= 18; step++) {
      state = service.samplePwmChannelsOnce(t0 + step * 500, {
        cha_fan2: {
          measuredHz: Math.round(state.programmedHz * (1 - (0.06 + step * 0.0055))),
          dutyPct: 65,
          rpm: 820,
        },
      });
    }

    const degradedCha2 = state.channels.find((c) => c.id === 'cha_fan2')!;
    expect(degradedCha2.predictedLifeExpectancyPct).toBeLessThan(healthyCpu.predictedLifeExpectancyPct);
    expect(degradedCha2.estimatedRemainingHours).toBeLessThan(healthyCpu.estimatedRemainingHours);

    // Raise threshold above degraded channel's predicted life expectancy to trigger alert
    const threshold = Math.min(95, Math.max(70, degradedCha2.predictedLifeExpectancyPct + 12));
    const alertState = service.setPredictiveMaintenanceThresholdPct(threshold);
    const alertedCha2 = alertState.channels.find((c) => c.id === 'cha_fan2')!;
    expect(alertedCha2.maintenanceAlertTriggered).toBe(true);
    expect(alertState.maintenanceAlertCount).toBeGreaterThanOrEqual(1);

    // Verify Bearing Health History tab HTML & summary cards
    const hmState = service.getAcousticHeatmapState();
    const panelHtml = renderFanAcousticHeatmapPanelHtml(hmState, alertState, 'bearing_history');
    expect(panelHtml).toContain('id="fan-tab-btn-resonance"');
    expect(panelHtml).toContain('id="fan-tab-btn-bearing-history"');
    expect(panelHtml).toContain('fan-tab-alert-pill');
    expect(panelHtml).toContain('id="fan-bearing-history-d3"');
    expect(panelHtml).toContain('Bearing Health History');

    const summaryHtml = renderFanBearingHistorySummaryHtml(alertState);
    expect(summaryHtml).toContain('fan-bearing-history-card is-alert');
    expect(summaryHtml).toContain('Predictive Bearing Health Alert');
    expect(summaryHtml).toContain('Maintenance Instructions');

    // Verify Predictive Bearing Health Alert Modal HTML with instructions & controls
    const modalHtml = renderPredictiveBearingAlertModalHtml(alertState, 'cha_fan2');
    expect(modalHtml).toContain('Predictive Bearing Health Alert');
    expect(modalHtml).toContain('Predicted Life Expectancy');
    expect(modalHtml).toContain('Est. Remaining L10 Life');
    expect(modalHtml).toContain('Diagnostic Summary:');
    expect(modalHtml).toContain('Actionable Maintenance Instructions');
    expect(modalHtml).toContain('id="predictive-bearing-alert-history-btn"');
    expect(modalHtml).toContain('id="predictive-bearing-alert-ack-btn"');
  });
});



