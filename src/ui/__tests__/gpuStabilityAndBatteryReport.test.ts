import { describe, expect, it } from 'vitest';
import {
  GPU_STABILITY_THRESHOLDS,
  GpuStabilityPoint,
  computeGpuStabilityStats,
  evaluateGpuStabilityAlert,
  filterGpuStabilityWindow,
  renderGpuStabilityAlertBannerHtml,
  renderGpuStabilityAlertIndicatorHtml,
  renderGpuStabilityThresholdLegendHtml,
} from '../gpuStabilityChart';
import {
  SAMPLE_WINDOWS_BATTERY_REPORT,
  parseWindowsBatteryReport,
  renderPowercfgBatteryReportSectionHtml,
} from '../batteryReportParser';
import {
  buildWindowsLnkShortcut,
  generatePortableExeZipBlob,
} from '../../services/portableExeBuilder.service';
import { computeSteadyStateThroughput } from '../../services/networkTest.service';

describe('GPU Stability D3.js Line Chart Helpers', () => {
  const samplePoints: GpuStabilityPoint[] = [
    { timeSec: 1, stabilityPct: 96.4, fps: 144, frameTimeMs: 6.9 },
    { timeSec: 15, stabilityPct: 93.2, fps: 141, frameTimeMs: 7.1 },
    { timeSec: 32, stabilityPct: 88.5, fps: 132, frameTimeMs: 7.6 },
    { timeSec: 55, stabilityPct: 71.2, fps: 94, frameTimeMs: 10.6 },
    { timeSec: 70, stabilityPct: 91.0, fps: 138, frameTimeMs: 7.2 },
    { timeSec: 90, stabilityPct: 94.8, fps: 143, frameTimeMs: 7.0 },
  ];

  it('computes accurate stability session summary statistics and anomaly counts', () => {
    const stats = computeGpuStabilityStats(samplePoints);
    expect(stats.sampleCount).toBe(6);
    expect(stats.currentPct).toBe(94.8);
    expect(stats.minPct).toBe(71.2);
    expect(stats.maxPct).toBe(96.4);
    expect(stats.avgPct).toBe(89.2);
    expect(stats.belowCriticalCount).toBe(1);
    expect(stats.belowWarningCount).toBe(1);
    expect(stats.verdictLabel).toContain('wahania');
  });

  it('filters points properly for 30s, 60s, and full session windows', () => {
    expect(filterGpuStabilityWindow(samplePoints, 'all')).toHaveLength(6);
    const win60 = filterGpuStabilityWindow(samplePoints, '60s');
    expect(win60.every((p) => p.timeSec >= 30)).toBe(true);
    expect(win60).toHaveLength(4);

    const win30 = filterGpuStabilityWindow(samplePoints, '30s');
    expect(win30.every((p) => p.timeSec >= 60)).toBe(true);
    expect(win30).toHaveLength(2);
  });

  it('returns clean idle stats when telemetry is empty', () => {
    const stats = computeGpuStabilityStats([]);
    expect(stats.sampleCount).toBe(0);
    expect(stats.avgPct).toBe(0);
    expect(stats.verdictLabel).toBe('Oczekiwanie na próbki');
  });

  it('renders an interactive tooltip legend explaining both 90% and 75% thresholds and all 3 stability zones', () => {
    expect(GPU_STABILITY_THRESHOLDS.optimalPct).toBe(90);
    expect(GPU_STABILITY_THRESHOLDS.criticalPct).toBe(75);
    expect(GPU_STABILITY_THRESHOLDS.items).toHaveLength(3);
    const html = renderGpuStabilityThresholdLegendHtml('test-tip', 'center');
    expect(html).toContain('data-gpu-stability-threshold-legend="true"');
    expect(html).toContain('is-centered');
    expect(html).toContain('role="tooltip"');
    expect(html).toContain('Próg 90%');
    expect(html).toContain('Strefa 75%–89%');
    expect(html).toContain('Próg 75%');
    expect(html).toContain('frame pacing');
    expect(html).toContain('thermal throttling');
  });

  it('triggers the live stability alert indicator strictly when GPU stability drops below 75%', () => {
    const idleAlert = evaluateGpuStabilityAlert([], false);
    expect(renderGpuStabilityAlertIndicatorHtml(idleAlert, false)).toContain(
      'data-gpu-stability-alert="standby"'
    );

    const healthyPoints: GpuStabilityPoint[] = [
      { timeSec: 1, stabilityPct: 92, fps: 140, frameTimeMs: 7.1 },
      { timeSec: 5, stabilityPct: 75.0, fps: 112, frameTimeMs: 8.9 },
    ];
    const boundaryAlert = evaluateGpuStabilityAlert(healthyPoints, true);
    expect(boundaryAlert.triggered).toBe(false);
    expect(boundaryAlert.isLiveAlert).toBe(false);
    expect(renderGpuStabilityAlertBannerHtml(boundaryAlert)).toBe('');
    expect(renderGpuStabilityAlertIndicatorHtml(boundaryAlert, true)).toContain(
      'data-gpu-stability-alert="ok"'
    );

    const justBelowBoundary = evaluateGpuStabilityAlert(
      [
        { timeSec: 1, stabilityPct: 90, fps: 140, frameTimeMs: 7.1 },
        { timeSec: 2, stabilityPct: 74.9, fps: 102, frameTimeMs: 9.8 },
      ],
      true
    );
    expect(justBelowBoundary.triggered).toBe(true);
    expect(justBelowBoundary.isLiveAlert).toBe(true);

    const droppingPoints: GpuStabilityPoint[] = [
      { timeSec: 1, stabilityPct: 91.5, fps: 140, frameTimeMs: 7.1 },
      { timeSec: 4, stabilityPct: 72.4, fps: 96, frameTimeMs: 10.4 },
      { timeSec: 7, stabilityPct: 68.3, fps: 88, frameTimeMs: 11.4 },
    ];
    const activeAlert = evaluateGpuStabilityAlert(droppingPoints, true);
    expect(activeAlert.triggered).toBe(true);
    expect(activeAlert.isLiveAlert).toBe(true);
    expect(activeAlert.currentPct).toBe(68.3);
    expect(activeAlert.dropCountBelow75).toBe(2);
    expect(activeAlert.lowestPct).toBe(68.3);
    expect(activeAlert.headline).toContain('ALERT STABILNOŚCI LIVE');

    const indicatorHtml = renderGpuStabilityAlertIndicatorHtml(activeAlert, true);
    expect(indicatorHtml).toContain('data-gpu-stability-alert="active"');
    expect(indicatorHtml).toContain('role="alert"');
    expect(indicatorHtml).toContain('68.3%');

    const bannerHtml = renderGpuStabilityAlertBannerHtml(activeAlert);
    expect(bannerHtml).toContain('data-gpu-stability-alert-banner="active"');
    expect(bannerHtml).toContain('role="alert"');
    expect(bannerHtml).toContain('68.3%');
  });
});

describe('Windows powercfg /batteryreport Parser', () => {
  it('parses the English sample powercfg /batteryreport text accurately', () => {
    const report = parseWindowsBatteryReport(SAMPLE_WINDOWS_BATTERY_REPORT);
    expect(report.valid).toBe(true);
    expect(report.computerName).toBe('WORKSTATION-LAPTOP');
    expect(report.systemProductName).toContain('ThinkPad X1 Carbon');
    expect(report.batteries).toHaveLength(1);
    expect(report.batteries[0].manufacturer).toBe('Celxpert');
    expect(report.batteries[0].chemistry).toBe('LiP');
    expect(report.totalDesignCapacityMWh).toBe(57000);
    expect(report.totalFullChargeCapacityMWh).toBe(49320);
    expect(report.overallHealthPct).toBe(86.5);
    expect(report.overallWearLevelPct).toBe(13.5);
    expect(report.totalCycleCount).toBe(184);
    expect(report.capacityHistory.length).toBeGreaterThanOrEqual(4);
    expect(report.estimatedLifeAtFullCharge).toBe('7:42:15');
    expect(report.estimatedLifeAtDesignCapacity).toBe('8:54:20');
  });

  it('parses raw Windows battery-report.html and Polish locale labels', () => {
    const polishHtml = `
      <!doctype html>
      <html><body>
        <h1>Raport dotyczący baterii</h1>
        <table>
          <tr><td>NAZWA KOMPUTERA</td><td>LAPTOP-SERWIS-01</td></tr>
          <tr><td>NAZWA PRODUKTU SYSTEMOWEGO</td><td>ASUS ROG Zephyrus G14</td></tr>
          <tr><td>BIOS</td><td>GA402RJ.319</td></tr>
          <tr><td>KOMPILACJA SYSTEMU OPERACYJNEGO</td><td>22631.1.amd64fre</td></tr>
        </table>
        <h2>Zainstalowane baterie</h2>
        <table>
          <tr><td>NAZWA</td><td>C41N2101</td></tr>
          <tr><td>PRODUCENT</td><td>ASUSTeK</td></tr>
          <tr><td>NUMER SERYJNY</td><td>99120</td></tr>
          <tr><td>SKŁAD CHEMICZNY</td><td>LIon</td></tr>
          <tr><td>POJEMNOŚĆ FABRYCZNA</td><td>76 000 mWh</td></tr>
          <tr><td>POJEMNOŚĆ PEŁNEGO NAŁADOWANIA</td><td>68 400 mWh</td></tr>
          <tr><td>LICZBA CYKLI</td><td>142</td></tr>
        </table>
        <h2>Historia pojemności baterii</h2>
        <table>
          <tr><td>2025-09-01 - 2025-10-01</td><td>73 200 mWh</td><td>76 000 mWh</td></tr>
          <tr><td>2026-01-01 - 2026-02-01</td><td>68 400 mWh</td><td>76 000 mWh</td></tr>
        </table>
      </body></html>
    `;

    const report = parseWindowsBatteryReport(polishHtml);
    expect(report.valid).toBe(true);
    expect(report.sourceFormat).toBe('html');
    expect(report.computerName).toBe('LAPTOP-SERWIS-01');
    expect(report.totalDesignCapacityMWh).toBe(76000);
    expect(report.totalFullChargeCapacityMWh).toBe(68400);
    expect(report.overallHealthPct).toBe(90);
    expect(report.overallWearLevelPct).toBe(10);
    expect(report.totalCycleCount).toBe(142);
    expect(report.capacityHistory).toHaveLength(2);

    const html = renderPowercfgBatteryReportSectionHtml(report, '', '');
    expect(html).toContain('90%');
    expect(html).toContain('powercfg-apply-calibration-btn');
  });

  it('marks invalid/unrelated input as valid: false with helpful message', () => {
    const emptyRes = parseWindowsBatteryReport('');
    expect(emptyRes.valid).toBe(false);
    expect(emptyRes.errorMessage).toBeTruthy();

    const garbageRes = parseWindowsBatteryReport('Hello world, no battery data here at all.');
    expect(garbageRes.valid).toBe(false);
  });
});

describe('Honest Steady-State Speed Test Throughput Estimator', () => {
  it('excludes initial 1.5s proxy/TCP buffer burst spikes and measures exact wire speed', () => {
    // Simulate a real 500 Mbps (62.5 MB/s) line where an antivirus proxy dumps a huge 250 MB burst in the first 1.0s
    const bytesPerSec = (500 * 1_000_000) / 8; // 62,500,000 B/s
    const timeline = [
      { elapsedMs: 0, totalBytes: 0 },
      { elapsedMs: 500, totalBytes: 150_000_000 }, // fake proxy RAM flush during warmup (2400 Mbps!)
      { elapsedMs: 1000, totalBytes: 250_000_000 },
      { elapsedMs: 1500, totalBytes: 281_250_000 }, // warmup boundary
      { elapsedMs: 2500, totalBytes: 281_250_000 + bytesPerSec * 1 },
      { elapsedMs: 3500, totalBytes: 281_250_000 + bytesPerSec * 2 },
      { elapsedMs: 4500, totalBytes: 281_250_000 + bytesPerSec * 3 },
      { elapsedMs: 5500, totalBytes: 281_250_000 + bytesPerSec * 4 },
    ];

    const res = computeSteadyStateThroughput(timeline, 1500);
    expect(res.sustainedMbps).toBe(500);
    expect(res.peakMbps).toBe(500);
    expect(res.steadyDurationSec).toBe(4);
  });
});

describe('Standalone Windows Desktop Shortcut (.lnk) & Installer ZIP', () => {
  it('builds a valid MS-SHLLINK binary .lnk shortcut pointing to Desktop App mode', () => {
    const lnk = buildWindowsLnkShortcut({
      targetEnvPath: '%SystemRoot%\\System32\\cmd.exe',
      arguments: '/c "%LOCALAPPDATA%\\Programs\\SystemPulsePro\\SystemPulse-Pro-Portable.bat"',
      workingDir: '%LOCALAPPDATA%\\Programs\\SystemPulsePro',
      iconEnvPath: '%LOCALAPPDATA%\\Programs\\SystemPulsePro\\SystemPulse-Pro.ico',
      description: 'SystemPulse Pro',
      showCommand: 7,
    });

    const dv = new DataView(lnk.buffer, lnk.byteOffset, lnk.byteLength);
    expect(dv.getUint32(0, true)).toBe(0x0000004c);
    expect(dv.getUint32(0x3c, true)).toBe(7);
    expect(dv.getUint32(lnk.length - 4, true)).toBe(0);
    const ascii = new TextDecoder('latin1').decode(lnk);
    expect(ascii).toContain('%SystemRoot%\\System32\\cmd.exe');
    expect(ascii).toContain('%LOCALAPPDATA%\\Programs\\SystemPulsePro\\SystemPulse-Pro.ico');
  });

  it('bundles SystemPulse Pro.lnk inside the Portable Win64 ZIP and cleans legacy .url browser shortcuts', async () => {
    const { blob } = generatePortableExeZipBlob();
    const bytes = new Uint8Array(await blob.arrayBuffer());
    const text = new TextDecoder().decode(bytes);
    expect(text).toContain('SystemPulse-Pro-Portable/SystemPulse Pro.lnk');
    expect(text).toContain('--app="file:///!APP_URI!?v=');
    expect(text).toContain('del /F /Q "%%~D\\SystemPulse Pro.url"');
  });
});
