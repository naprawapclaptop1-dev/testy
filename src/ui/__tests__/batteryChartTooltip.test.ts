import { describe, expect, it } from 'vitest';
import {
  bindBatteryHistoryChartTooltip,
  renderBatteryHistoryChart,
} from '../charts';
import { BatteryHistoryPoint } from '../../types';

describe('Battery History chart tooltip', () => {
  const sampleHistory: BatteryHistoryPoint[] = [
    {
      timeLabel: '04:01:10',
      timestamp: new Date('2026-11-23T04:01:10').getTime(),
      dateTimeLabel: '23.11.2026, 04:01:10',
      levelPct: 86,
      powerW: 14.2,
    },
    {
      timeLabel: '04:01:15',
      timestamp: new Date('2026-11-23T04:01:15').getTime(),
      dateTimeLabel: '23.11.2026, 04:01:15',
      levelPct: 85,
      powerW: 28.6,
    },
    {
      timeLabel: '04:01:20',
      timestamp: new Date('2026-11-23T04:01:20').getTime(),
      dateTimeLabel: '23.11.2026, 04:01:20',
      levelPct: 84,
      powerW: 39.5,
    },
  ];

  it('renders interactive hover hit columns with exact date, charge level (%), and power consumption (W)', () => {
    const html = renderBatteryHistoryChart(sampleHistory, 190);

    expect(html).toContain('data-battery-chart-svg="true"');
    expect(html).toContain('data-chart-tooltip="true"');
    expect(html).toContain('data-chart-crosshair="true"');
    expect(html).toContain('data-date="23.11.2026, 04:01:15"');
    expect(html).toContain('data-level="85"');
    expect(html).toContain('data-power="28.6"');
  });

  it('shows exact date, charge %, and power W in the tooltip on mousemove and hides on mouseleave', () => {
    const listeners = new Map<string, Array<(ev: unknown) => void>>();
    const tooltipEl = {
      hidden: true,
      innerHTML: '',
      style: { left: '', right: '', top: '' },
    };
    const crosshairAttrs: Record<string, string> = {};
    const dotLevelAttrs: Record<string, string> = {};
    const dotPowerAttrs: Record<string, string> = {};

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
        if (sel === '[data-chart-tooltip]') return tooltipEl;
        if (sel === '[data-chart-crosshair]') return makeAttrNode(crosshairAttrs);
        if (sel === '[data-chart-active-level]') return makeAttrNode(dotLevelAttrs);
        if (sel === '[data-chart-active-power]') return makeAttrNode(dotPowerAttrs);
        return null;
      },
    } as unknown as HTMLElement;

    bindBatteryHistoryChartTooltip(fakeContainer);

    const hitAttrs: Record<string, string> = {
      'data-date': '23.11.2026, 04:01:15',
      'data-level': '85',
      'data-power': '28.6',
      'data-x': '340',
      'data-y-level': '40.5',
      'data-y-power': '102.3',
    };
    const fakeHit = {
      getAttribute: (k: string) => hitAttrs[k] ?? null,
      closest: (sel: string) => (sel === '[data-point-idx]' ? fakeHit : null),
    };

    // Simulate hovering over data point #1
    for (const fn of listeners.get('mousemove') ?? []) {
      fn({ target: fakeHit });
    }

    expect(tooltipEl.hidden).toBe(false);
    expect(tooltipEl.innerHTML).toContain('23.11.2026, 04:01:15');
    expect(tooltipEl.innerHTML).toContain('85%');
    expect(tooltipEl.innerHTML).toContain('28.6 W');
    expect(crosshairAttrs.opacity).toBe('0.85');
    expect(dotLevelAttrs.opacity).toBe('1');
    expect(dotPowerAttrs.opacity).toBe('1');

    // Simulate mouse leaving the chart
    for (const fn of listeners.get('mouseleave') ?? []) {
      fn({});
    }

    expect(tooltipEl.hidden).toBe(true);
    expect(crosshairAttrs.opacity).toBe('0');
    expect(dotLevelAttrs.opacity).toBe('0');
    expect(dotPowerAttrs.opacity).toBe('0');
  });
});
