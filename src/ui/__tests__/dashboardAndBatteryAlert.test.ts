import { afterEach, describe, expect, it, vi } from 'vitest';
import { batteryHealthService } from '../../services/batteryHealth.service';
import { BatteryHealthState } from '../../types';
import {
  LOW_BATTERY_HEALTH_THRESHOLD_PCT,
  isLowBatteryHealth,
  renderLowBatteryHealthAlertHtml,
} from '../batteryLowHealthAlert';
import { animateMetricValueElements, formatAnimatedMetricNumber } from '../metricAnimation';

function makeBatteryState(overrides: Partial<BatteryHealthState> = {}): BatteryHealthState {
  return {
    ...batteryHealthService.getState(),
    ...overrides,
  };
}

describe('low battery health visual alert', () => {
  it('triggers strictly below 75% healthPct and stays hidden at or above 75%', () => {
    expect(LOW_BATTERY_HEALTH_THRESHOLD_PCT).toBe(75);
    expect(isLowBatteryHealth(100)).toBe(false);
    expect(isLowBatteryHealth(75)).toBe(false);
    expect(isLowBatteryHealth(74.9)).toBe(true);
    expect(isLowBatteryHealth(74)).toBe(true);
    expect(isLowBatteryHealth(52)).toBe(true);

    expect(renderLowBatteryHealthAlertHtml(makeBatteryState({ healthPct: 75 }))).toBe('');
  });

  it('renders warning/critical banner with manufacturer warranty recommendation below 75%', () => {
    const warnHtml = renderLowBatteryHealthAlertHtml(
      makeBatteryState({ healthPct: 71, wearLevelPct: 29, fullChargeCapacityMWh: 42600 })
    );
    expect(warnHtml).toContain('data-low-battery-health-alert="true"');
    expect(warnHtml).toContain('data-severity="warning"');
    expect(warnHtml).toContain('71%');
    expect(warnHtml.toLowerCase()).toContain('manufacturer warranty');
    expect(warnHtml.toLowerCase()).toContain('gwarancj');

    const critHtml = renderLowBatteryHealthAlertHtml(
      makeBatteryState({ healthPct: 54, wearLevelPct: 46, fullChargeCapacityMWh: 32400 }),
      true
    );
    expect(critHtml).toContain('data-severity="critical"');
    expect(critHtml).toContain('54%');
    expect(critHtml.toLowerCase()).toContain('manufacturer warranty');
  });
});

describe('metricAnimation helper for .metric-value updates', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('formats localized integers and decimals consistently', () => {
    expect(formatAnimatedMetricNumber(42.34, 1, false)).toBe('42.3');
    expect(formatAnimatedMetricNumber(1200, 0, false, '', ' / 100')).toBe('1200 / 100');
  });

  it('animates .metric-value element text when hardware scan target updates', () => {
    const rafQueue: Array<(ts: number) => void> = [];
    vi.stubGlobal('window', {
      matchMedia: () => ({ matches: false }),
      setTimeout: (fn: () => void) => {
        fn();
        return 1;
      },
      clearTimeout: () => {},
    });
    vi.stubGlobal('requestAnimationFrame', (cb: (ts: number) => void) => {
      rafQueue.push(cb);
      return rafQueue.length;
    });
    vi.stubGlobal('cancelAnimationFrame', () => {});
    vi.stubGlobal('performance', { now: () => 0 });

    const classes = new Set<string>();
    const fakeEl = {
      isConnected: true,
      dataset: {
        metricKey: 'dash-hw-devices',
        metricTarget: '8',
        metricLocale: 'false',
      },
      textContent: '8',
      classList: {
        add: (c: string) => classes.add(c),
        remove: (c: string) => classes.delete(c),
        has: (c: string) => classes.has(c),
      },
    } as unknown as HTMLElement;

    const fakeContainer = {
      querySelectorAll: () => [fakeEl],
    } as unknown as ParentNode;

    const prevMap = new Map<string, number>();
    animateMetricValueElements(fakeContainer, prevMap, { durationMs: 300 });
    expect(prevMap.get('dash-hw-devices')).toBe(8);
    expect(rafQueue.length).toBe(0);

    // Update target from 8 -> 16
    fakeEl.dataset.metricTarget = '16';
    animateMetricValueElements(fakeContainer, prevMap, { durationMs: 300 });
    expect(prevMap.get('dash-hw-devices')).toBe(16);
    expect(fakeEl.textContent).toBe('8');

    // Step outer RAF and mid-animation RAF
    rafQueue.shift()?.(0);
    expect(classes.has('is-updating')).toBe(true);
    rafQueue.shift()?.(150);
    expect(Number(fakeEl.textContent)).toBeGreaterThan(8);
    expect(Number(fakeEl.textContent)).toBeLessThan(16);

    // Finish animation
    rafQueue.shift()?.(350);
    expect(fakeEl.textContent).toBe('16');
    expect(classes.has('is-updating')).toBe(false);
  });
});
