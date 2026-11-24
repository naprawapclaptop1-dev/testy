import { afterEach, describe, expect, it } from 'vitest';
import { psuCalculatorService } from '../../services/psuCalculator.service';
import { computePowerDrawTrend1m, renderPsuPowerDrawTrendHtml } from '../psuPowerDrawTrend';
import {
  extractRail5sWindow,
  PsuRailHistoryEntry,
  renderRail5sSparklinePreviewHtml,
} from '../psuRailSparklinePreview';

function makeRailHistory(nowMs: number): PsuRailHistoryEntry[] {
  return [
    { timeLabel: '12:00:00', timestamp: nowMs - 15000, rail12V: 12.01, rail5V: 5.01, rail3P3V: 3.31, powerW: 150 },
    { timeLabel: '12:00:11', timestamp: nowMs - 4000, rail12V: 11.98, rail5V: 5.0, rail3P3V: 3.3, powerW: 210 },
    { timeLabel: '12:00:13', timestamp: nowMs - 2000, rail12V: 11.92, rail5V: 4.98, rail3P3V: 3.28, powerW: 260 },
    { timeLabel: '12:00:15', timestamp: nowMs, rail12V: 12.03, rail5V: 5.02, rail3P3V: 3.32, powerW: 220 },
  ];
}

describe('PSU rail 5-second sparkline hover preview', () => {
  it('extracts 5-second window and computes min/max/mV delta & interactive SVG markup', () => {
    const nowMs = 1_700_000_015_000;
    const history = makeRailHistory(nowMs);

    const window5s = extractRail5sWindow(history, '+12V', 12.03, 0, nowMs);
    expect(window5s.length).toBe(3);
    expect(window5s[0].voltageV).toBe(11.98);
    expect(window5s[2].voltageV).toBe(12.03);

    const { html, coords } = renderRail5sSparklinePreviewHtml(history, '+12V', 12.03, 5, 0, nowMs);
    expect(coords.length).toBe(3);
    expect(html).toContain('data-psu-5s-sparkline="true"');
    expect(html).toContain('5s Voltage Preview (+12V)');
    expect(html).toContain('11.920–12.030V');
    expect(html).toContain('Δ 110.0 mV');
    expect(html).toContain('psu-rail-5s-sparkline-plot');
    expect(html).toContain('<polyline');
  });

  it('respects rail resetAtMs boundary when rendering 5s preview', () => {
    const nowMs = 1_700_000_015_000;
    const history = makeRailHistory(nowMs);
    const windowAfterReset = extractRail5sWindow(history, '+5V', 5.02, nowMs - 1000, nowMs);
    expect(windowAfterReset.length).toBe(2);
    expect(windowAfterReset[1].voltageV).toBe(5.02);
  });
});

describe('PSU 1-minute moving average Power Draw Trend indicator', () => {
  afterEach(() => {
    psuCalculatorService.clearPowerDrawHistory();
  });

  it('computes 1-minute moving average and detects transient power spikes', () => {
    const nowMs = 1_700_000_100_000;
    const samples = [
      // Excluded (> 60s old)
      { timestamp: nowMs - 90_000, totalPowerW: 700 },
      // Inside last 60s around ~160W idle baseline
      { timestamp: nowMs - 45_000, totalPowerW: 155 },
      { timestamp: nowMs - 30_000, totalPowerW: 165 },
      { timestamp: nowMs - 15_000, totalPowerW: 160 },
      { timestamp: nowMs - 5_000, totalPowerW: 160 },
    ];

    const steadyTrend = computePowerDrawTrend1m(samples, 162, 850, nowMs);
    expect(steadyTrend.sampleCount).toBe(4);
    expect(steadyTrend.movingAvg1mW).toBe(160);
    expect(steadyTrend.isTransientSpike).toBe(false);
    expect(steadyTrend.status).toBe('steady');

    const spikeTrend = computePowerDrawTrend1m(samples, 620, 850, nowMs);
    expect(spikeTrend.movingAvg1mW).toBe(160);
    expect(spikeTrend.deltaW).toBe(460);
    expect(spikeTrend.isTransientSpike).toBe(true);
    expect(spikeTrend.status).toBe('spike');

    const spikeHtml = renderPsuPowerDrawTrendHtml(spikeTrend, 850);
    expect(spikeHtml).toContain('data-psu-power-trend="true"');
    expect(spikeHtml).toContain('data-trend-status="spike"');
    expect(spikeHtml).toContain('TRANSIENT SPIKE');
    expect(spikeHtml).toContain('160 W');
    expect(spikeHtml).toContain('+460 W');
  });

  it('records and prunes 1-minute power draw samples in psuCalculatorService', () => {
    const nowMs = 1_700_000_200_000;
    psuCalculatorService.clearPowerDrawHistory();
    psuCalculatorService.seedPowerDrawHistory1m(150, nowMs - 5000);
    expect(psuCalculatorService.getPowerDrawSamples1m(nowMs).length).toBeGreaterThanOrEqual(20);

    psuCalculatorService.recordPowerDrawSample(680, nowMs);
    const samples = psuCalculatorService.getPowerDrawSamples1m(nowMs);
    expect(samples[samples.length - 1].totalPowerW).toBe(680);

    const trend = computePowerDrawTrend1m(samples, 680, 850, nowMs);
    expect(trend.isTransientSpike).toBe(true);
  });
});
