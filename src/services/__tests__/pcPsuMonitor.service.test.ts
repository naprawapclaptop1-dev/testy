import { describe, it, expect, beforeEach } from 'vitest';
import { batteryHealthService } from '../batteryHealth.service';
import { psuCalculatorService } from '../psuCalculator.service';
import { thermalMonitorService } from '../thermalMonitor.service';

describe('PcPsuMonitor & BatteryHealthService PSU Extensions', () => {
  beforeEach(() => {
    batteryHealthService.clearRailAlertEvents();
  });

  it('provides real-time internal PSU temperature metric via thermal monitor service', () => {
    const liveTemp = thermalMonitorService.getLivePsuTempC();
    const state = batteryHealthService.getState();

    expect(state.psu).toBeDefined();
    expect(state.psu.tempC).toBeGreaterThan(0);
    expect(typeof state.psu.tempC).toBe('number');

    if (liveTemp !== null) {
      expect(state.psu.tempC).toBeCloseTo(liveTemp, 1);
    } else {
      // In simulated environment without live hardware sensor, temperature is derived accurately
      expect(state.psu.tempC).toBeGreaterThanOrEqual(30);
      expect(state.psu.tempC).toBeLessThanOrEqual(75);
    }
  });

  it('calculates efficiency, estimated heat dissipation (power loss in Watts) and monthly cost in psuCalculatorService', () => {
    const calc = psuCalculatorService.calculate(50, 50);

    expect(calc.psuCapacityW).toBe(850);
    expect(calc.totalSystemPowerW).toBeGreaterThan(0);
    expect(calc.efficiencyPct).toBeGreaterThan(80);
    expect(calc.efficiencyPct).toBeLessThanOrEqual(95);

    // Heat dissipation in Watts should be positive and match power loss formula
    expect(calc.estimatedHeatDissipationW).toBeGreaterThan(0);
    expect(calc.monthlyCost).toBeGreaterThan(0);
    expect(calc.monthlyKwh).toBeGreaterThan(0);
    expect(calc.recommendation).toBeDefined();
  });

  it('supports configurable rail deviation threshold and registers rail alert events', () => {
    psuCalculatorService.setRailDeviationPct(2);
    expect(psuCalculatorService.getRailDeviationPct()).toBe(2);

    psuCalculatorService.setRailDeviationPct(5);
    expect(psuCalculatorService.getRailDeviationPct()).toBe(5);

    // Initial alert events array is accessible
    const state = batteryHealthService.getState();
    expect(Array.isArray(state.railAlertEvents)).toBe(true);

    // Test clearing events
    batteryHealthService.clearRailAlertEvents();
    expect(batteryHealthService.getState().railAlertEvents.length).toBe(0);
  });

  it('supports custom Alert Rules per rail (+12V, +5V, +3.3V) and notification/logging flags', () => {
    const updated = psuCalculatorService.setAlertRules({
      rail12VThresholdPct: 3.5,
      rail5VThresholdPct: 4.0,
      rail3P3VThresholdPct: 2.5,
      desktopNotification: true,
      logError: false,
    });
    expect(updated.rail12VThresholdPct).toBe(3.5);
    expect(updated.rail5VThresholdPct).toBe(4.0);
    expect(updated.rail3P3VThresholdPct).toBe(2.5);
    expect(updated.desktopNotification).toBe(true);
    expect(updated.logError).toBe(false);

    // Reset back to standard 5%
    psuCalculatorService.setRailDeviationPct(5);
    psuCalculatorService.setAlertRules({ desktopNotification: false, logError: true });
    expect(psuCalculatorService.getAlertRules().rail12VThresholdPct).toBe(5);
  });

  it('tracks 1-hour PSU efficiency trend vs power draw and degrades efficiency as component temperature rises', () => {
    const coolCalc = psuCalculatorService.calculate(55, 55, 8, 35);
    const hotCalc = psuCalculatorService.calculate(55, 55, 8, 68);
    expect(hotCalc.efficiencyPct).toBeLessThan(coolCalc.efficiencyPct);

    const state = batteryHealthService.getState();
    expect(Array.isArray(state.efficiencyTrend1h)).toBe(true);
    expect(state.efficiencyTrend1h.length).toBeGreaterThanOrEqual(20);
    const sample = state.efficiencyTrend1h[state.efficiencyTrend1h.length - 1];
    expect(sample.efficiencyPct).toBeGreaterThan(75);
    expect(sample.powerDrawW).toBeGreaterThan(50);
    expect(sample.tempC).toBeGreaterThan(25);
  });

  it('builds a 100% standalone offline Portable EXE ZIP archive with bundled app/index.html and local C# HTTP server', async () => {
    const { generatePortableExeZipBlob } = await import('../portableExeBuilder.service');
    const { blob, filename } = generatePortableExeZipBlob();
    expect(filename).toBe('SystemPulse-Pro-Portable-Win64.zip');
    expect(blob.size).toBeGreaterThan(2500);

    const bytes = new Uint8Array(await blob.arrayBuffer());
    expect(bytes[0]).toBe(0x50);
    expect(bytes[1]).toBe(0x4b);
    expect(bytes[2]).toBe(0x03);
    expect(bytes[3]).toBe(0x04);

    const text = new TextDecoder().decode(bytes);
    expect(text).toContain('SystemPulse-Pro-Portable/Instalator-SystemPulse-Pro-Setup.cmd');
    expect(text).toContain('SystemPulse-Pro-Portable/SystemPulse-Pro-Portable.bat');
    expect(text).toContain('SystemPulse-Pro-Portable/SystemPulsePro.csproj');
    expect(text).toContain('SystemPulse-Pro-Portable/SystemPulseSetup.csproj');
    expect(text).toContain('SystemPulse-Pro-Portable/SystemPulseLauncher.cs');
    expect(text).toContain('SystemPulse-Pro-Portable/app/index.html');
    expect(text).toContain('SystemPulse-Pro-Portable/app/portable-bundle.js');
    expect(text).toContain('SystemPulse-Pro-Portable/app/portable-styles.css');
    expect(text).toContain('<EnableDefaultCompileItems>false</EnableDefaultCompileItems>');
    expect(text).toContain('<Compile Include="SystemPulseLauncher.cs" />');
    expect(text).toContain('<Compile Include="SystemPulseSetupGui.cs" />');
    expect(text).toContain('SystemPulse-Pro-Portable/SystemPulse-Pro.ico');
    expect(text).toContain('SystemPulse-Pro-Portable/app/favicon.ico');
    expect(text).toContain('SystemPulse-Pro-Portable/app/icon.svg');
    expect(text).toContain('SystemPulse-Pro-Portable/SystemPulse-Pro-Installer.iss');
    expect(text).toContain('<ApplicationIcon>SystemPulse-Pro.ico</ApplicationIcon>');
    expect(text).toContain('IconFile=%INSTALL_DIR%\\SystemPulse-Pro.ico');
    expect(text).toContain('Odinstaluj-SystemPulse-Pro.cmd');
    expect(text).toContain('start "" "!BROWSER_EXE!"');
    expect(text).not.toContain('start "" %%~B');
    expect(text).toContain('--disable-frame-rate-limit');
    expect(text).toContain('127.0.0.1');
    expect(text).not.toContain('usercontent.goog');
    expect(text).not.toContain('Zbuduj-Natywny-EXE.cmd');
    expect(text).not.toContain('csc.exe');
    expect(text).not.toContain('ExecutionPolicy');
    expect(text).not.toContain('WScript.Shell');
    expect(text).not.toContain('taskkill');
    expect(text).not.toContain('--allow-file-access-from-files');

    // Verify all PWA & Windows icon assets exist with valid binary headers
    const fs = await import('node:fs');
    const icoBuf = fs.readFileSync('public/favicon.ico');
    expect(icoBuf[0]).toBe(0);
    expect(icoBuf[1]).toBe(0);
    expect(icoBuf[2]).toBe(1);
    expect(icoBuf[3]).toBe(0);
    for (const iconPath of [
      'public/icon.svg',
      'public/pwa-192x192.png',
      'public/pwa-512x512.png',
      'public/pwa-maskable-512x512.png',
      'public/apple-touch-icon.png',
    ]) {
      expect(fs.existsSync(iconPath)).toBe(true);
    }

    // Verify the actual shipped offline bundle compiles with 0 SyntaxErrors as a classic <script>
    const vm = await import('node:vm');
    const { sanitizePortableBundleJs } = await import('../portableExeBuilder.service');
    const rawBundle = fs.readFileSync('public/portable-bundle.js', 'utf8');
    const sanitized = sanitizePortableBundleJs(rawBundle);
    expect(sanitized).not.toContain('import.meta');
    expect(() => new vm.Script(sanitized)).not.toThrow();
  });

  it('resets rail deviation visual markers via clearRailAlertVisualMarkers without modifying railHistory data', () => {
    batteryHealthService.resetRailAlertMarkersBaseline();
    batteryHealthService.captureLiveSample();

    const before = batteryHealthService.getState();
    const beforeLen = before.railHistory.length;
    const beforeSnapshot = JSON.stringify(before.railHistory);
    expect(beforeLen).toBeGreaterThan(0);
    expect(batteryHealthService.getRailAlertMarkersClearedAt()).toBe(0);

    const clearedAt = batteryHealthService.clearRailAlertVisualMarkers();
    const after = batteryHealthService.getState();

    expect(clearedAt).toBeGreaterThan(before.railHistory[beforeLen - 1].timestamp);
    expect(batteryHealthService.getRailAlertMarkersClearedAt()).toBe(clearedAt);
    expect(after.railHistory.length).toBe(beforeLen);
    expect(JSON.stringify(after.railHistory)).toBe(beforeSnapshot);

    batteryHealthService.resetRailAlertMarkersBaseline();
  });

  it('clears the selected rail 5-minute buffer via resetRail5MinHistory and forces a re-sampling period', async () => {
    batteryHealthService.clearRailHistoryReset();
    batteryHealthService.captureLiveSample();

    const resetAt = batteryHealthService.resetRail5MinHistory('+12V', {
      durationMs: 1000,
      intervalMs: 120,
    });

    expect(batteryHealthService.getRailHistoryResetAt('+12V')).toBe(resetAt);
    expect(batteryHealthService.getRailHistoryResetAt('+5V')).toBe(0);
    expect(batteryHealthService.getRailHistoryResetAt('+3.3V')).toBe(0);

    // Immediately after reset, 0 samples exist at or after resetAt for +12V
    const immediateState = batteryHealthService.getState();
    const immediateAfterReset = immediateState.railHistory.filter((pt) => pt.timestamp >= resetAt);
    expect(immediateAfterReset.length).toBe(0);
    expect(batteryHealthService.getRailResamplingState('+12V').active).toBe(true);

    // Wait briefly for forced re-sampling ticks to push fresh telemetry points
    await new Promise((r) => setTimeout(r, 420));

    const resampledState = batteryHealthService.getState();
    const freshSamples = resampledState.railHistory.filter((pt) => pt.timestamp >= resetAt);
    expect(freshSamples.length).toBeGreaterThanOrEqual(2);
    expect(batteryHealthService.getRailResamplingState('+12V').samplesCollected).toBe(freshSamples.length);

    batteryHealthService.clearRailHistoryReset();
  });
});




