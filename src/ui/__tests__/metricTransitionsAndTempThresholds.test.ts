import { describe, expect, it } from 'vitest';
import { triggerMetricCardEntranceTransitions } from '../metricAnimation';
import {
  clampSensorThresholdC,
  createTemperatureAlertRuntimeState,
  evaluateTemperatureThresholds,
  getDefaultTemperatureThresholds,
  renderTemperatureThresholdsPanelHtml,
} from '../temperatureThresholds';

describe('Custom Temperature Warning Thresholds (CPU / GPU / PSU)', () => {
  it('clamps sensor thresholds to valid hardware ranges', () => {
    expect(clampSensorThresholdC('cpu', 10)).toBe(40);
    expect(clampSensorThresholdC('cpu', 200)).toBe(115);
    expect(clampSensorThresholdC('cpu', 87.6)).toBe(88);

    expect(clampSensorThresholdC('gpu', 35)).toBe(40);
    expect(clampSensorThresholdC('gpu', 120)).toBe(115);

    expect(clampSensorThresholdC('psu', 15)).toBe(30);
    expect(clampSensorThresholdC('psu', 105)).toBe(95);
    expect(clampSensorThresholdC('psu', Number.NaN)).toBe(55);
  });

  it('triggers alerts with the configured sound preset when thresholds are exceeded and respects cooldown + hysteresis', () => {
    const settings = getDefaultTemperatureThresholds();
    settings.cpu.thresholdC = 80;
    settings.cpu.soundPreset = 'beep';
    settings.gpu.thresholdC = 78;
    settings.gpu.soundPreset = 'custom';
    settings.psu.thresholdC = 50;
    settings.psu.soundPreset = 'chime';
    settings.cooldownSec = 15;

    const runtime = createTemperatureAlertRuntimeState();

    // Below all thresholds -> no alerts
    const ev0 = evaluateTemperatureThresholds(
      { cpuTempC: 65, gpuTempC: 62, psuTempC: 41 },
      settings,
      runtime,
      1_000
    );
    expect(ev0.exceededCount).toBe(0);
    expect(ev0.newlyTriggered).toHaveLength(0);
    expect(ev0.sensors.cpu.status).toBe('ok');

    // Cross CPU and GPU thresholds -> both trigger immediately with selected presets
    const ev1 = evaluateTemperatureThresholds(
      { cpuTempC: 83.4, gpuTempC: 79.0, psuTempC: 46 },
      settings,
      runtime,
      2_000
    );
    expect(ev1.exceededCount).toBe(2);
    expect(ev1.newlyTriggered).toHaveLength(2);
    expect(ev1.newlyTriggered[0]).toMatchObject({
      sensor: 'cpu',
      tempC: 83.4,
      thresholdC: 80,
      soundPreset: 'beep',
    });
    expect(ev1.newlyTriggered[1]).toMatchObject({
      sensor: 'gpu',
      tempC: 79,
      thresholdC: 78,
      soundPreset: 'custom',
    });

    // 5 seconds later (within 15s cooldown) -> still exceeded, does NOT re-fire
    const ev2 = evaluateTemperatureThresholds(
      { cpuTempC: 84, gpuTempC: 80, psuTempC: 46 },
      settings,
      runtime,
      7_000
    );
    expect(ev2.exceededCount).toBe(2);
    expect(ev2.newlyTriggered).toHaveLength(0);

    // 16 seconds after initial trigger -> cooldown expired, re-fires
    const ev3 = evaluateTemperatureThresholds(
      { cpuTempC: 85, gpuTempC: 81, psuTempC: 52 },
      settings,
      runtime,
      18_000
    );
    expect(ev3.exceededCount).toBe(3);
    expect(ev3.newlyTriggered.map((t) => t.sensor)).toEqual(['cpu', 'gpu', 'psu']);

    // Drop CPU by 1°C below threshold (not yet 2°C hysteresis) -> latch stays set
    const ev4 = evaluateTemperatureThresholds(
      { cpuTempC: 79, gpuTempC: 70, psuTempC: 40 },
      settings,
      runtime,
      19_000
    );
    expect(ev4.sensors.cpu.status).toBe('ok');
    expect(runtime.exceededLatched.cpu).toBe(true);
    expect(runtime.exceededLatched.gpu).toBe(false);
    expect(runtime.exceededLatched.psu).toBe(false);

    // Drop CPU by >= 2°C below threshold -> hysteresis clears latch, re-crossing triggers immediately
    evaluateTemperatureThresholds(
      { cpuTempC: 77.5, gpuTempC: 70, psuTempC: 40 },
      settings,
      runtime,
      20_000
    );
    expect(runtime.exceededLatched.cpu).toBe(false);

    const ev5 = evaluateTemperatureThresholds(
      { cpuTempC: 81, gpuTempC: 70, psuTempC: 40 },
      settings,
      runtime,
      21_000
    );
    expect(ev5.newlyTriggered).toHaveLength(1);
    expect(ev5.newlyTriggered[0].sensor).toBe('cpu');
  });

  it('handles disabled sensors and missing live readings gracefully', () => {
    const settings = getDefaultTemperatureThresholds();
    settings.psu.enabled = false;
    const runtime = createTemperatureAlertRuntimeState();

    const ev = evaluateTemperatureThresholds(
      { cpuTempC: null, gpuTempC: null, psuTempC: 70 },
      settings,
      runtime,
      10_000
    );

    expect(ev.exceededCount).toBe(0);
    expect(ev.newlyTriggered).toHaveLength(0);
    expect(ev.sensors.cpu.status).toBe('no_sensor');
    expect(ev.sensors.gpu.status).toBe('no_sensor');
    expect(ev.sensors.psu.status).toBe('disabled');
  });

  it('renders the Dashboard temperature thresholds panel with exceeded state and custom audio option', () => {
    const settings = getDefaultTemperatureThresholds();
    settings.gpu.thresholdC = 75;
    settings.gpu.soundPreset = 'custom';
    const runtime = createTemperatureAlertRuntimeState();
    const evaluation = evaluateTemperatureThresholds(
      { cpuTempC: 62, gpuTempC: 78.5, psuTempC: 42 },
      settings,
      runtime,
      5_000
    );

    const html = renderTemperatureThresholdsPanelHtml(settings, evaluation, 'my-siren.wav');
    expect(html).toContain('id="dash-temp-thresholds-panel"');
    expect(html).toContain('data-temp-sensor-card="cpu"');
    expect(html).toContain('data-temp-sensor-card="gpu"');
    expect(html).toContain('data-temp-sensor-card="psu"');
    expect(html).toContain('metric-card temp-threshold-exceeded');
    expect(html).toContain('PRZEKROCZENIE PROGU (1)');
    expect(html).toContain('Własny dźwięk (my-siren.wav)');
    expect(html).not.toContain('value="custom" selected disabled');
  });
});

describe('Metric Card CSS Entrance Transitions', () => {
  it('marks metric-card elements as entered immediately when requestAnimationFrame is absent', () => {
    const classSets = [new Set<string>(['metric-card']), new Set<string>(['metric-card'])];
    const mockCards = classSets.map((set) => ({
      isConnected: true,
      style: { transitionDelay: '' },
      classList: {
        add: (cls: string) => set.add(cls),
        remove: (cls: string) => set.delete(cls),
      },
    }));
    const mockContainer = {
      querySelectorAll: () => mockCards,
    } as unknown as ParentNode;

    const count = triggerMetricCardEntranceTransitions(mockContainer, 45);
    expect(count).toBe(2);
    expect(classSets[0].has('metric-card-entered')).toBe(true);
    expect(classSets[1].has('metric-card-entered')).toBe(true);
    expect(classSets[0].has('metric-card-enter-ready')).toBe(false);
  });

  it('returns 0 safely when container is null', () => {
    expect(triggerMetricCardEntranceTransitions(null)).toBe(0);
  });
});
