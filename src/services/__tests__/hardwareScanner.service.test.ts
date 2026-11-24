import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  EDID_CMD_COMMAND,
  EDID_POWERSHELL_COMMAND,
  buildMonitorEdidGuideText,
  hardwareScannerService,
} from '../hardwareScanner.service';

describe('hardwareScannerService EDID commands and parser', () => {
  beforeEach(() => {
    vi.stubGlobal('window', {
      devicePixelRatio: 1,
      screen: { width: 2560, height: 1440 },
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('uses antivirus-safe native pnputil in CMD and avoids -ExecutionPolicy Bypass and Encoding.ASCII.GetString', () => {
    expect(EDID_POWERSHELL_COMMAND).not.toContain('Encoding]::ASCII.GetString');
    expect(EDID_POWERSHELL_COMMAND).not.toContain('ExecutionPolicy Bypass');
    expect(EDID_POWERSHELL_COMMAND).toContain('WmiMonitorID');
    expect(EDID_POWERSHELL_COMMAND).toContain('Win32_PnPEntity');

    // CMD command must use native Windows pnputil instead of launching powershell.exe
    expect(EDID_CMD_COMMAND).toContain('pnputil /enum-devices /class Monitor /connected');
    expect(EDID_CMD_COMMAND).not.toContain('powershell');
    expect(EDID_CMD_COMMAND).not.toContain('ExecutionPolicy');
  });

  it('builds a Chrome-safe .txt guide containing both PowerShell and CMD commands without chcp 65001', () => {
    const guide = buildMonitorEdidGuideText();
    expect(guide).toContain(EDID_POWERSHELL_COMMAND);
    expect(guide).toContain(EDID_CMD_COMMAND);
    expect(guide).not.toContain('chcp 65001');
  });

  it('parses Windows PowerShell EDID JSON output and maps vendor codes to readable names', () => {
    const json = JSON.stringify({
      edidMonitors: [
        {
          m: 'GSM',
          n: 'LG ULTRAGEAR',
          p: '5B7F',
          s: '304NTGY8A123',
          y: 2023,
          wCm: 60,
          hCm: 34,
          inch: 27.1,
        },
      ],
    });

    const result = hardwareScannerService.importMonitorEdid(json);
    expect(result.ok).toBe(true);
    expect(result.message).toContain('LG Electronics');
    expect(result.message).toContain('LG ULTRAGEAR');
    expect(result.message).toContain('27.1"');
    expect(hardwareScannerService.getEdidDetailsNote()).toContain('Kod EDID: 5B7F');
    expect(hardwareScannerService.getEdidDetailsNote()).toContain('60×34 cm');
  });

  it('parses native Windows pnputil Monitor output and decodes EDID manufacturer prefix', () => {
    const pnpOut = [
      'Microsoft PnP Utility',
      'Instance ID:                DISPLAY\\GSM5B7F\\5&2c4b3f1&0&UID4353',
      'Device Description:         LG ULTRAGEAR',
      'Class Name:                 Monitor',
      'Status:                     Started',
    ].join('\r\n');

    const result = hardwareScannerService.importMonitorEdid(pnpOut);
    expect(result.ok).toBe(true);
    expect(result.message).toContain('LG Electronics');
    expect(result.message).toContain('LG ULTRAGEAR');
    expect(hardwareScannerService.getEdidDetailsNote()).toContain('GSM5B7F');
  });

  it('accepts plain-text manual monitor model input and rejects empty input', () => {
    const empty = hardwareScannerService.importMonitorEdid('   ');
    expect(empty.ok).toBe(false);

    const manual = hardwareScannerService.importMonitorEdid('ASUS ROG Swift PG279QM');
    expect(manual.ok).toBe(true);
    expect(manual.message).toContain('ASUS ROG Swift PG279QM');
  });
});
