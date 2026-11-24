import { describe, it, expect, beforeEach } from 'vitest';
import {
  analyzeDeepHardware,
  ParsedDeepHardwareInventory,
} from '../hardwareScanner.service';
import {
  MouseDiagnosticsService,
  buttonIndexToKey,
} from '../mouseDiagnostics.service';
import { DiskTestResult, RamTestResult, SystemSpecs } from '../../types';

function makeIdleRamState(overrides: Partial<RamTestResult> = {}): RamTestResult {
  return {
    status: 'idle',
    progress: 0,
    allocatedMB: 128,
    bandwidthReadMBs: 0,
    bandwidthWriteMBs: 0,
    latencyNs: 0,
    errorsFound: 0,
    patternErrors: 0,
    randomErrors: 0,
    walkingBitErrors: 0,
    patternTestPassed: true,
    randomTestPassed: true,
    walkingBitsPassed: true,
    healthGrade: 'WZOROWY',
    overallScore: 0,
    testLog: [],
    ...overrides,
  };
}

function makeIdleDiskState(overrides: Partial<DiskTestResult> = {}): DiskTestResult {
  return {
    status: 'idle',
    phase: 'Oczekiwanie',
    progress: 0,
    backend: 'Oczekiwanie',
    seqWriteMBs: 0,
    seqReadMBs: 0,
    rand4kWriteMBs: 0,
    rand4kReadMBs: 0,
    rand4kIops: 0,
    accessTimeAvgMs: 0,
    accessTimeMinMs: 0,
    accessTimeP95Ms: 0,
    crcVerified: true,
    quotaGB: 10,
    usedMB: 1,
    smartHealthPct: 100,
    smartStatus: 'ZDROWY',
    smartAttributes: [],
    overallScore: 0,
    ...overrides,
  };
}

function makeSampleSpecs(): SystemSpecs {
  return {
    os: 'Windows 11 Pro',
    browser: 'Chrome 134',
    platform: 'Win32',
    cpuCores: 16,
    deviceMemory: 8,
    gpuRenderer: 'ANGLE (NVIDIA GeForce RTX 4080)',
    gpuVendor: 'Google Inc. (NVIDIA)',
    webglVersion: 'WebGL 2.0',
    maxTextureSize: 16384,
    screenResolution: '2560x1440',
    viewportSize: '1920x1080',
    colorDepth: 24,
    devicePixelRatio: 1,
    estimatedRefreshRate: 165,
    online: true,
    connectionType: '4g',
    downlink: 100,
    rtt: 15,
    storageQuotaGB: 500,
    storageUsageMB: 12,
  };
}

function makeDeepInventory(
  overrides: Partial<ParsedDeepHardwareInventory> = {}
): ParsedDeepHardwareInventory {
  return {
    sourceOs: 'Windows',
    importedAt: Date.UTC(2026, 10, 23, 12, 0, 0),
    computerModel: 'Custom Workstation Z790',
    motherboard: 'ASUS ROG STRIX Z790-F GAMING WIFI',
    bios: 'American Megatrends Inc. 2202 (SMBIOS 3.5)',
    cpuModel: 'Intel Core i7-14700K',
    cpuDetails: '20 rdzeni / 28 wątków · 5600 MHz',
    gpus: [{ name: 'NVIDIA GeForce RTX 4080', vramGB: '16 GB', driver: '566.14' }],
    ramModules: [
      {
        slot: 'DIMM A2',
        manufacturer: 'G.Skill',
        partNumber: 'F5-6000J3038F16G',
        capacityGB: 16,
        speedMHz: 6000,
        memoryType: 'DDR5',
        serial: 'SN001A',
      },
      {
        slot: 'DIMM B2',
        manufacturer: 'G.Skill',
        partNumber: 'F5-6000J3038F16G',
        capacityGB: 16,
        speedMHz: 6000,
        memoryType: 'DDR5',
        serial: 'SN001B',
      },
    ],
    disks: [
      {
        model: 'Samsung SSD 990 PRO 2TB',
        interfaceType: 'NVMe PCIe 4.0',
        mediaType: 'SSD',
        sizeGB: 2000,
        status: 'OK',
        serial: 'S6Z2NJ0T001',
      },
      {
        model: 'Crucial MX500 1000GB',
        interfaceType: 'SATA',
        mediaType: 'SSD',
        sizeGB: 1000,
        status: 'OK',
        serial: 'CRU-1000',
      },
    ],
    monitors: [{ manufacturer: 'LG', model: '27GP850-B', serial: 'LG12345' }],
    battery: 'Brak (PC Stacjonarny)',
    networkAdapters: ['Intel Ethernet Controller I225-V 2.5GbE'],
    rawLineCount: 42,
    rawDumpPreview: 'SMBIOS Type 17: 2x16GB DDR5-6000',
    ...overrides,
  };
}

describe('Deep Hardware Analysis (SMBIOS Spec Sheet, DRAM Validation & SSD Endurance)', () => {
  it('falls back gracefully to Live API telemetry when no SMBIOS dump is loaded', () => {
    const sheet = analyzeDeepHardware(
      null,
      makeIdleRamState(),
      makeIdleDiskState(),
      makeSampleSpecs(),
      null
    );

    expect(sheet.hasSmbiosData).toBe(false);
    expect(sheet.specRows.length).toBeGreaterThanOrEqual(4);
    expect(sheet.specRows.every((r) => r.source === 'Live API')).toBe(true);
    expect(sheet.dramValidation.validationStatus).toBe('BRAK MODUŁÓW SMBIOS');
    expect(sheet.ssdEndurance.overallStatus).toBe('BRAK DYSKÓW SMBIOS');
  });

  it('validates Dual-Channel XMP/EXPO DDR5 DRAM speed against measured RAM bandwidth', () => {
    const deep = makeDeepInventory();
    const ram = makeIdleRamState({
      status: 'completed',
      bandwidthReadMBs: 42800,
      bandwidthWriteMBs: 39200,
      copyBandwidthMBs: 36500,
      latencyNs: 58.4,
      errorsFound: 0,
    });

    const sheet = analyzeDeepHardware(deep, ram, makeIdleDiskState(), makeSampleSpecs());

    expect(sheet.hasSmbiosData).toBe(true);
    expect(sheet.rawDumpPreview).toContain('DDR5-6000');
    expect(sheet.specRows.some((r) => r.parameter === 'Płyta główna' || r.category === 'Płyta główna')).toBe(true);

    expect(sheet.dramValidation.moduleCount).toBe(2);
    expect(sheet.dramValidation.totalCapacityGB).toBe(32);
    expect(sheet.dramValidation.dominantSpeedMHz).toBe(6000);
    expect(sheet.dramValidation.theoreticalPeakMBs).toBe(6000 * 8 * 2);
    expect(sheet.dramValidation.efficiencyPct).toBeCloseTo((42800 / 96000) * 100, 1);
    expect(sheet.dramValidation.channelConfig).toContain('Dual-Channel Symetryczny');
    expect(sheet.dramValidation.validationStatus).toBe('ZWERYFIKOWANO OK');
    expect(sheet.dramValidation.modules[0].profileStatus).toBe('XMP / EXPO Aktywny');
  });

  it('flags mismatched DRAM clocks, single-channel configs, or RAM integrity errors', () => {
    const singleChannelDeep = makeDeepInventory({
      ramModules: [
        {
          slot: 'DIMM A1',
          manufacturer: 'Crucial',
          partNumber: 'CT16G48C40U5',
          capacityGB: 16,
          speedMHz: 4800,
          memoryType: 'DDR5',
          serial: 'SC1',
        },
      ],
    });
    const sheetSingle = analyzeDeepHardware(
      singleChannelDeep,
      makeIdleRamState({ status: 'completed', bandwidthReadMBs: 21000, latencyNs: 72 }),
      makeIdleDiskState()
    );
    expect(sheetSingle.dramValidation.validationStatus).toBe('WYKRYTO NIEZGODNOŚĆ / ASYMETRIĘ');
    expect(sheetSingle.dramValidation.channelConfig).toContain('Single-Channel');
    expect(sheetSingle.dramValidation.modules[0].profileStatus).toBe('Profil JEDEC / Standardowy');

    const errorRamSheet = analyzeDeepHardware(
      makeDeepInventory(),
      makeIdleRamState({ status: 'failed', bandwidthReadMBs: 40000, errorsFound: 3 }),
      makeIdleDiskState()
    );
    expect(errorRamSheet.dramValidation.validationStatus).toBe('WYKRYTO NIEZGODNOŚĆ / ASYMETRIĘ');
    expect(errorRamSheet.dramValidation.verdictNote).toContain('3 błędów');
  });

  it('verifies SSD endurance rating (TBW/DWPD), SMART health, SLC cache retention, and CRC32', () => {
    const deep = makeDeepInventory();
    const healthyDisk = makeIdleDiskState({
      status: 'completed',
      seqReadMBs: 3400,
      seqWriteMBs: 2800,
      thermalSustainedWriteMBs: 2650,
      slcCacheCurvePct: 92,
      smartHealthPct: 99,
      smartStatus: 'ZDROWY',
      crcVerified: true,
    });

    const healthySheet = analyzeDeepHardware(deep, makeIdleRamState(), healthyDisk);
    expect(healthySheet.ssdEndurance.driveCount).toBe(2);
    expect(healthySheet.ssdEndurance.totalCapacityGB).toBe(3000);
    expect(healthySheet.ssdEndurance.overallStatus).toBe('ZWERYFIKOWANO OK');
    expect(healthySheet.ssdEndurance.drives[0].enduranceTier).toBe('Enterprise / Pro NVMe');
    expect(healthySheet.ssdEndurance.drives[0].estimatedTbwRating).toBeGreaterThanOrEqual(1200);
    expect(healthySheet.ssdEndurance.drives[0].estimatedDwpd).toBe(0.36);
    expect(healthySheet.ssdEndurance.drives[1].enduranceTier).toBe('SATA SSD');
    expect(healthySheet.ssdEndurance.drives[0].verificationStatus).toBe('WYTRZYMAŁOŚĆ WZOROWA');

    const degradedDisk = makeIdleDiskState({
      status: 'completed',
      seqReadMBs: 1200,
      seqWriteMBs: 450,
      slcCacheCurvePct: 48,
      smartHealthPct: 79,
      smartStatus: 'UWAGA',
      crcVerified: false,
    });
    const degradedSheet = analyzeDeepHardware(deep, makeIdleRamState(), degradedDisk);
    expect(degradedSheet.ssdEndurance.overallStatus).toBe('WYMAGA UWAGI');
    expect(degradedSheet.ssdEndurance.drives[0].verificationStatus).toBe('BŁĄD SMART / CRC');
  });
});

describe('Advanced Mouse & Click Diagnostic Suite', () => {
  let svc: MouseDiagnosticsService;

  beforeEach(() => {
    svc = new MouseDiagnosticsService();
  });

  it('maps DOM mouse button indices to MouseButtonKey safely', () => {
    expect(buttonIndexToKey(0)).toBe('lmb');
    expect(buttonIndexToKey(1)).toBe('mmb');
    expect(buttonIndexToKey(2)).toBe('rmb');
    expect(buttonIndexToKey(3)).toBe('side4');
    expect(buttonIndexToKey(4)).toBe('side5');
    expect(buttonIndexToKey(9)).toBeNull();
  });

  it('tracks microsecond click latency, dwell duration, double-click, and switch chatter', () => {
    // First normal click: down at 100.0ms, up at 142.5ms -> dwell = 42,500 us
    const c1 = svc.recordMouseDown(0, 100.0);
    expect(c1?.interClickUs).toBeNull();
    expect(c1?.flag).toBe('OK');
    svc.recordMouseUp(0, 142.5);
    expect(svc.getSnapshot(150).lastDwellUs).toBe(42500);

    // Bounce gap of 12.2ms after release -> CHATTER (< 25 ms bounce gap)
    const c2 = svc.recordMouseDown(0, 154.7);
    expect(c2?.flag).toBe('CHATTER');
    expect(c2?.interClickUs).toBe(54700);
    expect(c2?.bounceGapUs).toBe(12200);
    svc.recordMouseUp(0, 165.0);

    // Intentional fast double-click after 35ms release gap, 50ms inter-click -> DOUBLE_CLICK (< 65 ms)
    const c3 = svc.recordMouseDown(0, 204.7);
    expect(c3?.flag).toBe('DOUBLE_CLICK');
    expect(c3?.interClickUs).toBe(50000);

    const snap = svc.getSnapshot(210);
    expect(snap.clicks.lmb).toBe(3);
    expect(snap.chatterFaults).toBe(1);
    expect(snap.doubleClickFaults).toBe(2);
    expect(snap.minClickLatencyUs).toBe(50000);
    expect(snap.lastClickLatencyUs).toBe(50000);
    expect(snap.recentClicks[0].seq).toBe(3);
  });

  it('builds polling interval stability histogram and classifies stable 1000 Hz vs erratic sensors', () => {
    svc.setTargetPollingHz(1000);
    // Feed 35 crisp 1.0 ms intervals (1000 Hz gaming mouse)
    const cleanTimestamps: number[] = [];
    for (let i = 0; i < 36; i++) {
      cleanTimestamps.push(1000 + i * 1.0);
    }
    svc.recordPointerMoveTimestamps(cleanTimestamps, 1036);

    const cleanSnap = svc.getSnapshot(1036);
    expect(cleanSnap.targetPollingHz).toBe(1000);
    expect(cleanSnap.activeIntervalCount).toBe(35);
    expect(cleanSnap.medianIntervalUs).toBe(1000);
    expect(cleanSnap.jitterStdDevUs).toBeLessThan(100);
    expect(cleanSnap.stabilityPct).toBeGreaterThanOrEqual(95);
    expect(cleanSnap.sensorVerdict).toBe('SENSOR WZOROWY');
    expect(cleanSnap.nominalTierLabel).toContain('1000 Hz');
    const b1000 = cleanSnap.histogram.find((b) => b.id === 'b_1000');
    expect(b1000?.count).toBe(35);
    expect(b1000?.pct).toBe(100);

    // Reset and feed unstable polling intervals with severe lag drops (> 16.5 ms)
    svc.reset();
    const erraticTimestamps = [1000];
    let t = 1000;
    const intervals = [
      1, 1, 8, 22, 1, 19, 4, 24, 1, 18, 2, 21, 1, 17, 6, 23,
      1, 20, 3, 25, 1, 19, 2, 22, 1, 18, 4, 20, 1, 21,
    ];
    for (const dt of intervals) {
      t += dt;
      erraticTimestamps.push(t);
    }
    svc.recordPointerMoveTimestamps(erraticTimestamps, t);

    const erraticSnap = svc.getSnapshot(t);
    expect(erraticSnap.inconsistencyEvents).toBeGreaterThan(0);
    expect(erraticSnap.jitterStdDevUs).toBeGreaterThan(5000);
    expect(erraticSnap.sensorVerdict).toBe('WYKRYTO NIESTABILNOŚĆ SENSORA');
    const dropBucket = erraticSnap.histogram.find((b) => b.id === 'b_drop');
    expect(dropBucket?.isAnomaly).toBe(true);
    expect(dropBucket?.count).toBeGreaterThan(5);
  });
});
