import { afterEach, describe, expect, it } from 'vitest';
import { psuCalculatorService } from '../../services/psuCalculator.service';
import {
  PSU_CAPACITY_ALERT_THRESHOLD_PCT,
  clampPsuCapacityThresholdPct,
  isPsuCapacityOver95,
  renderPsuCapacityAlertBannerHtml,
} from '../psuCapacityAlert';

describe('PSU rail card >95% capacity visual alert & custom threshold override', () => {
  afterEach(() => {
    psuCalculatorService.setHighPowerSimulation(false);
    psuCalculatorService.setStressProfile('normal');
    psuCalculatorService.setPsuCapacity(750);
    psuCalculatorService.setPowerAlertThresholdPct(PSU_CAPACITY_ALERT_THRESHOLD_PCT);
  });

  it('triggers strictly when power draw exceeds 95% of calculated PSU capacity by default', () => {
    expect(PSU_CAPACITY_ALERT_THRESHOLD_PCT).toBe(95);
    expect(isPsuCapacityOver95(0, 750)).toBe(false);
    expect(isPsuCapacityOver95(712, 750, 94.9)).toBe(false);
    expect(isPsuCapacityOver95(712.5, 750, 95.0)).toBe(false);
    expect(isPsuCapacityOver95(714, 750, 95.2)).toBe(true);
    expect(isPsuCapacityOver95(735, 750)).toBe(true);
    expect(isPsuCapacityOver95(500, 0)).toBe(false);
    expect(isPsuCapacityOver95(-10, 750)).toBe(false);
  });

  it('allows manual percentage threshold override and clamps invalid values', () => {
    expect(clampPsuCapacityThresholdPct(undefined)).toBe(95);
    expect(clampPsuCapacityThresholdPct(Number.NaN)).toBe(95);
    expect(clampPsuCapacityThresholdPct(-10)).toBe(1);
    expect(clampPsuCapacityThresholdPct(150)).toBe(100);
    expect(clampPsuCapacityThresholdPct(72.46)).toBe(72.5);

    expect(isPsuCapacityOver95(600, 750, 80.0, 80)).toBe(false);
    expect(isPsuCapacityOver95(608, 750, 81.1, 80)).toBe(true);
    expect(isPsuCapacityOver95(735, 750, 98.0, 99)).toBe(false);

    expect(psuCalculatorService.getPowerAlertThresholdPct()).toBe(95);
    expect(psuCalculatorService.setPowerAlertThresholdPct(70)).toBe(70);
    expect(psuCalculatorService.getPowerAlertThresholdPct()).toBe(70);
    expect(psuCalculatorService.setPowerAlertThresholdPct(250)).toBe(100);
    expect(psuCalculatorService.setPowerAlertThresholdPct(0)).toBe(1);
  });

  it('renders alert banner HTML dynamically using the overridden threshold', () => {
    expect(renderPsuCapacityAlertBannerHtml(650, 750, 86.7)).toBe('');
    expect(renderPsuCapacityAlertBannerHtml(712.5, 750, 95)).toBe('');

    const defaultHtml = renderPsuCapacityAlertBannerHtml(735, 750, 98.0);
    expect(defaultHtml).toContain('role="alert"');
    expect(defaultHtml).toContain('data-psu-capacity-alert="true"');
    expect(defaultHtml).toContain('data-psu-threshold-pct="95"');
    expect(defaultHtml).toContain('psu-rail-capacity-alert-banner');
    expect(defaultHtml).toContain('&gt;95% PSU');
    expect(defaultHtml).toContain('735 W / 750 W');
    expect(defaultHtml).toContain('98.0%');

    const customHtml = renderPsuCapacityAlertBannerHtml(608, 750, 81.1, 80);
    expect(customHtml).toContain('data-psu-threshold-pct="80"');
    expect(customHtml).toContain('&gt;80% PSU');
    expect(customHtml).toContain('Przekroczono 80% mocy PSU');
  });

  it('triggers with psuCalculatorService when high power load pushes draw past 95% capacity', () => {
    psuCalculatorService.setPsuCapacity(650);
    const normalCalc = psuCalculatorService.calculate(20, 25, 8, 38);
    expect(
      isPsuCapacityOver95(
        normalCalc.totalSystemPowerW,
        normalCalc.psuCapacityW,
        normalCalc.loadPercentageOfPsu
      )
    ).toBe(false);

    psuCalculatorService.setHighPowerSimulation(true);
    const highCalc = psuCalculatorService.calculate(95, 95, 16, 52);
    expect(highCalc.loadPercentageOfPsu).toBeGreaterThan(95);
    expect(
      isPsuCapacityOver95(
        highCalc.totalSystemPowerW,
        highCalc.psuCapacityW,
        highCalc.loadPercentageOfPsu
      )
    ).toBe(true);
    expect(
      renderPsuCapacityAlertBannerHtml(
        highCalc.totalSystemPowerW,
        highCalc.psuCapacityW,
        highCalc.loadPercentageOfPsu
      )
    ).toContain('data-psu-capacity-alert="true"');
  });
});
