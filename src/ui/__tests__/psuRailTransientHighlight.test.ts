import { describe, expect, it } from 'vitest';
import {
  PsuRailTransientHighlightTracker,
  TRANSIENT_RAIL_HIGHLIGHT_DURATION_MS,
  TRANSIENT_RAIL_SPIKE_DEVIATION_PCT,
  computeRailDeviationPct,
} from '../psuRailTransientHighlight';

describe('PSU rail transient >5% spike 2-second highlight tracker', () => {
  it('computes absolute percentage deviation relative to nominal rail voltage', () => {
    expect(TRANSIENT_RAIL_SPIKE_DEVIATION_PCT).toBe(5);
    expect(TRANSIENT_RAIL_HIGHLIGHT_DURATION_MS).toBe(2000);
    expect(computeRailDeviationPct('+12V', 12.0)).toBeCloseTo(0, 4);
    expect(computeRailDeviationPct('+12V', 11.4)).toBeCloseTo(5.0, 4);
    expect(computeRailDeviationPct('+12V', 11.34)).toBeCloseTo(5.5, 4);
    expect(computeRailDeviationPct('+5V', 5.3)).toBeCloseTo(6.0, 4);
    expect(computeRailDeviationPct('+3.3V', 3.1)).toBeCloseTo(6.06, 2);
  });

  it('does not trigger highlight at or below 5% deviation', () => {
    const tracker = new PsuRailTransientHighlightTracker();
    expect(tracker.updateRail('+12V', 12.0, 1000)).toBe(false);
    expect(tracker.updateRail('+12V', 11.4, 1500)).toBe(false);
    expect(tracker.isHighlighted('+12V', 1500)).toBe(false);
    expect(tracker.getRemainingMs('+12V', 1500)).toBe(0);
  });

  it('highlights the rail for 2000 ms when crossing beyond 5% deviation', () => {
    const tracker = new PsuRailTransientHighlightTracker();
    expect(tracker.updateRail('+12V', 11.98, 1000)).toBe(false);

    // Drop below 11.40V (>5% deviation) -> trigger 2s highlight
    expect(tracker.updateRail('+12V', 11.28, 2000)).toBe(true);
    expect(tracker.isHighlighted('+12V', 2000)).toBe(true);
    expect(tracker.isHighlighted('+12V', 3999)).toBe(true);
    expect(tracker.getRemainingMs('+12V', 3500)).toBe(500);
    expect(tracker.isHighlighted('+12V', 4000)).toBe(false);
    expect(tracker.getRemainingMs('+12V', 4000)).toBe(0);
  });

  it('does not continuously re-trigger on steady >5% values, but re-triggers on fresh spike or >=1.5% secondary jump', () => {
    const tracker = new PsuRailTransientHighlightTracker();

    // Initial >5% crossing on +5V (5.30V is +6%)
    expect(tracker.updateRail('+5V', 5.3, 1000)).toBe(true);
    // Steady reading at 5.31V (jump 0.2%) -> no re-trigger
    expect(tracker.updateRail('+5V', 5.31, 2500)).toBe(false);
    expect(tracker.isHighlighted('+5V', 3000)).toBe(false);

    // Secondary jump >= 1.5% while still >5% (5.31V -> 5.42V = +2.2% of nominal) -> re-triggers for 2s
    expect(tracker.updateRail('+5V', 5.42, 3200)).toBe(true);
    expect(tracker.isHighlighted('+5V', 5199)).toBe(true);
    expect(tracker.isHighlighted('+5V', 5200)).toBe(false);

    // Recovers within <=5%, then spikes again on +5V -> re-triggers
    expect(tracker.updateRail('+5V', 5.02, 5500)).toBe(false);
    expect(tracker.updateRail('+5V', 4.7, 6000)).toBe(true);
    expect(tracker.isHighlighted('+5V', 7999)).toBe(true);
    expect(tracker.isHighlighted('+5V', 8000)).toBe(false);
  });

  it('tracks +12V, +5V, and +3.3V independently and supports reset', () => {
    const tracker = new PsuRailTransientHighlightTracker();
    expect(tracker.updateRail('+3.3V', 3.1, 1000)).toBe(true);
    expect(tracker.isHighlighted('+3.3V', 1500)).toBe(true);
    expect(tracker.isHighlighted('+12V', 1500)).toBe(false);

    tracker.reset();
    expect(tracker.isHighlighted('+3.3V', 1500)).toBe(false);
  });
});
