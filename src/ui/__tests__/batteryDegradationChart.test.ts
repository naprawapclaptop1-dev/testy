import { describe, expect, it } from 'vitest';
import {
  bindBatteryDegradationChartTooltip,
  computeLinearTrend,
  renderBatteryDegradationTrendChart,
} from '../charts';
import { BatteryPowerCycleEntry } from '../../types';

const SAMPLE_CYCLES: BatteryPowerCycleEntry[] = [
  {
    id: 'cyc-1',
    cycleNumber: 120,
    dateLabel: '01.06.2026',
    timestamp: new Date('2026-06-01T10:00:00Z').getTime(),
    startPct: 18,
    endPct: 95,
    durationMin: 74,
    avgPowerW: 36.2,
    designCapacityMWh: 60000,
    fullChargeCapacityMWh: 55200,
    degradationFromPrevMWh: 0,
    cumulativeWearPct: 8.0,
    source: 'baseline',
  },
  {
    id: 'cyc-2',
    cycleNumber: 150,
    dateLabel: '01.08.2026',
    timestamp: new Date('2026-08-01T10:00:00Z').getTime(),
    startPct: 22,
    endPct: 98,
    durationMin: 68,
    avgPowerW: 34.8,
    designCapacityMWh: 60000,
    fullChargeCapacityMWh: 53800,
    degradationFromPrevMWh: -1400,
    cumulativeWearPct: 10.3,
    source: 'baseline',
  },
  {
    id: 'cyc-3',
    cycleNumber: 180,
    dateLabel: '01.10.2026',
    timestamp: new Date('2026-10-01T10:00:00Z').getTime(),
    startPct: 15,
    endPct: 100,
    durationMin: 81,
    avgPowerW: 33.4,
    designCapacityMWh: 60000,
    fullChargeCapacityMWh: 52400,
    degradationFromPrevMWh: -1400,
    cumulativeWearPct: 12.7,
    source: 'manual',
  },
];

describe('Battery Full Charge Capacity Degradation Trend Chart', () => {
  it('computes exact linear regression slope and intercept for degrading capacities', () => {
    const trend = computeLinearTrend([
      { x: 0, y: 55200 },
      { x: 1, y: 53800 },
      { x: 2, y: 52400 },
    ]);

    expect(trend.slope).toBeCloseTo(-1400, 5);
    expect(trend.intercept).toBeCloseTo(55200, 5);
    expect(trend.predict(3)).toBeCloseTo(51000, 5);
  });

  it('renders SVG trend line, 80% threshold, and powerCycle hover targets', () => {
    const html = renderBatteryDegradationTrendChart(SAMPLE_CYCLES, 60000, 215);

    expect(html).toContain('data-degradation-chart-svg="true"');
    expect(html).toContain('data-deg-trend-line="true"');
    expect(html).toContain('Próg 80%');
    expect(html).toContain('-1400 mWh/cykl');
    expect(html).toContain('data-full-cap="52400"');
    expect(html).toContain('data-cycle="#180"');
  });

  it('renders a graceful empty state when no power cycles exist', () => {
    const html = renderBatteryDegradationTrendChart([], 60000, 215);
    expect(html).toContain('Brak zarejestrowanych cykli');
    expect(html).not.toContain('data-deg-trend-line');
  });

  it('shows exact cycle capacity, regression trend, wear, and delta on hover and hides on mouseleave', () => {
    const listeners = new Map<string, Array<(ev: unknown) => void>>();
    const tooltipEl = {
      hidden: true,
      innerHTML: '',
      style: { left: '', right: '', top: '' },
    };
    const crosshairAttrs: Record<string, string> = {};
    const dotAttrs: Record<string, string> = {};

    const makeAttrNode = (store: Record<string, string>) => ({
      setAttribute: (k: string, v: string) => {
        store[k] = v;
      },
    });

    const fakeContainer = {
      addEventListener: (name: string, fn: (ev: unknown) => void) => {
        const list = listeners.get(name) ?? [];
        list.push(fn);
        listeners.set(name, list);
      },
      querySelector: (sel: string) => {
        if (sel === '[data-deg-tooltip]') return tooltipEl;
        if (sel === '[data-deg-crosshair]') return makeAttrNode(crosshairAttrs);
        if (sel === '[data-deg-active-dot]') return makeAttrNode(dotAttrs);
        return null;
      },
    } as unknown as HTMLElement;

    bindBatteryDegradationChartTooltip(fakeContainer);

    const hitAttrs: Record<string, string> = {
      'data-cycle': '#180',
      'data-date': '01.10.2026',
      'data-full-cap': '52400',
      'data-trend-cap': '52400',
      'data-wear': '12.7',
      'data-delta': '-1400',
      'data-x': '654',
      'data-y': '118',
    };
    const fakeHit = {
      getAttribute: (k: string) => hitAttrs[k] ?? null,
      closest: (sel: string) => (sel === '[data-deg-idx]' ? fakeHit : null),
    };

    for (const fn of listeners.get('mousemove') ?? []) {
      fn({ target: fakeHit });
    }

    expect(tooltipEl.hidden).toBe(false);
    expect(tooltipEl.innerHTML).toContain('#180');
    expect(tooltipEl.innerHTML).toContain('01.10.2026');
    expect(tooltipEl.innerHTML).toContain('52');
    expect(tooltipEl.innerHTML).toContain('400 mWh');
    expect(tooltipEl.innerHTML).toContain('12.7%');
    expect(crosshairAttrs.opacity).toBe('0.85');
    expect(dotAttrs.opacity).toBe('1');

    for (const fn of listeners.get('mouseleave') ?? []) {
      fn({});
    }

    expect(tooltipEl.hidden).toBe(true);
    expect(crosshairAttrs.opacity).toBe('0');
    expect(dotAttrs.opacity).toBe('0');
  });
});
