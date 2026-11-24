export type TransientHighlightRail = '+12V' | '+5V' | '+3.3V';

export const TRANSIENT_RAIL_SPIKE_DEVIATION_PCT = 5;
export const TRANSIENT_RAIL_HIGHLIGHT_DURATION_MS = 2000;

interface RailTransientState {
  wasOver5Pct: boolean;
  highlightUntilMs: number;
  prevVoltageV: number | null;
}

export function getNominalRailVoltage(rail: TransientHighlightRail): number {
  return rail === '+12V' ? 12.0 : rail === '+5V' ? 5.0 : 3.3;
}

export function computeRailDeviationPct(rail: TransientHighlightRail, voltageV: number): number {
  const nominalV = getNominalRailVoltage(rail);
  if (!Number.isFinite(voltageV) || nominalV <= 0) return 0;
  return (Math.abs(voltageV - nominalV) / nominalV) * 100;
}

export class PsuRailTransientHighlightTracker {
  private states = new Map<TransientHighlightRail, RailTransientState>();

  public updateRail(
    rail: TransientHighlightRail,
    voltageV: number,
    nowMs: number = Date.now()
  ): boolean {
    if (!Number.isFinite(voltageV)) return false;

    const nominalV = getNominalRailVoltage(rail);
    const devPct = computeRailDeviationPct(rail, voltageV);
    const isOver5Pct = devPct > TRANSIENT_RAIL_SPIKE_DEVIATION_PCT;

    const prev: RailTransientState = this.states.get(rail) ?? {
      wasOver5Pct: false,
      highlightUntilMs: 0,
      prevVoltageV: null,
    };

    const jumpPct =
      prev.prevVoltageV !== null
        ? (Math.abs(voltageV - prev.prevVoltageV) / nominalV) * 100
        : 0;

    let triggered = false;
    if ((!prev.wasOver5Pct && isOver5Pct) || (isOver5Pct && jumpPct >= 1.5)) {
      prev.highlightUntilMs = nowMs + TRANSIENT_RAIL_HIGHLIGHT_DURATION_MS;
      triggered = true;
    }

    prev.wasOver5Pct = isOver5Pct;
    prev.prevVoltageV = voltageV;
    this.states.set(rail, prev);
    return triggered;
  }

  public isHighlighted(rail: TransientHighlightRail, nowMs: number = Date.now()): boolean {
    const state = this.states.get(rail);
    return Boolean(state && nowMs < state.highlightUntilMs);
  }

  public getRemainingMs(rail: TransientHighlightRail, nowMs: number = Date.now()): number {
    const state = this.states.get(rail);
    if (!state) return 0;
    return Math.max(0, state.highlightUntilMs - nowMs);
  }

  public reset(): void {
    this.states.clear();
  }
}
