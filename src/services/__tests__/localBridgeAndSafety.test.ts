import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getLocalBridgeBases, isHostedOnExeBridge } from '../localBridge';
import { diskTestService } from '../diskTest.service';
import { hardwareScannerService } from '../hardwareScanner.service';
import { batteryHealthService } from '../batteryHealth.service';
import { probeLocalNetworkAdapters } from '../networkTest.service';

describe('localBridge guard and zero startup failed fetches', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function mockBrowserLocation(opts: {
    protocol: string;
    hostname: string;
    port: string;
    exeFlag?: boolean;
  }) {
    vi.stubGlobal('window', {
      location: {
        protocol: opts.protocol,
        hostname: opts.hostname,
        port: opts.port,
        origin: `${opts.protocol}//${opts.hostname}${opts.port ? `:${opts.port}` : ''}`,
      },
      setTimeout: globalThis.setTimeout.bind(globalThis),
      clearTimeout: globalThis.clearTimeout.bind(globalThis),
      __SYSTEMPULSE_EXE_BRIDGE__: opts.exeFlag,
    });
  }

  it('returns empty bridge bases on Vite dev (http://localhost:3000) unless forced', () => {
    mockBrowserLocation({ protocol: 'http:', hostname: 'localhost', port: '3000' });
    expect(isHostedOnExeBridge()).toBe(false);
    expect(getLocalBridgeBases(false)).toEqual([]);
    expect(getLocalBridgeBases(true)).toEqual(['http://127.0.0.1:45880']);
  });

  it('never probes http://127.0.0.1 even when forced on HTTPS preview origins (no Mixed Content)', () => {
    mockBrowserLocation({ protocol: 'https:', hostname: 'preview.run.app', port: '' });
    expect(isHostedOnExeBridge()).toBe(false);
    expect(getLocalBridgeBases(false)).toEqual([]);
    expect(getLocalBridgeBases(true)).toEqual([]);
  });

  it('uses same-origin bridge when hosted on 127.0.0.1:45880 or with __SYSTEMPULSE_EXE_BRIDGE__', () => {
    mockBrowserLocation({ protocol: 'http:', hostname: '127.0.0.1', port: '45880' });
    expect(isHostedOnExeBridge()).toBe(true);
    expect(getLocalBridgeBases(false)).toEqual(['']);

    mockBrowserLocation({ protocol: 'http:', hostname: 'localhost', port: '3000', exeFlag: true });
    expect(isHostedOnExeBridge()).toBe(true);
    expect(getLocalBridgeBases(false)).toEqual(['']);
  });

  it('fires zero network fetches during background startup probes outside the EXE host', async () => {
    mockBrowserLocation({ protocol: 'http:', hostname: 'localhost', port: '3000' });
    vi.stubGlobal('navigator', { onLine: true });
    const fetchSpy = vi.fn().mockRejectedValue(new Error('should not fetch'));
    vi.stubGlobal('fetch', fetchSpy);

    await hardwareScannerService.autoProbeFullLocalBridge(false);
    await hardwareScannerService.autoProbeLocalEdidBridge(false);
    await diskTestService.refreshAvailableDrives(false);
    await batteryHealthService.probeLocalWindowsBattery(false);
    await probeLocalNetworkAdapters(false);

    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('probes 127.0.0.1:45880/api/disks/list when refreshAvailableDrives(true) is triggered on HTTP localhost', async () => {
    mockBrowserLocation({ protocol: 'http:', hostname: 'localhost', port: '3000' });
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({
        drives: [
          {
            letter: 'D:',
            volumeLabel: 'Games NVMe',
            totalGB: 1000,
            freeGB: 420,
            fileSystem: 'NTFS',
            status: 'OK',
          },
        ],
      }),
    });
    vi.stubGlobal('fetch', fetchSpy);

    const drives = await diskTestService.refreshAvailableDrives(true);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(String(fetchSpy.mock.calls[0][0])).toBe('http://127.0.0.1:45880/api/disks/list');
    expect(drives.some((d) => d.kind === 'native_exe' && d.path.startsWith('D:'))).toBe(true);
  });
});
