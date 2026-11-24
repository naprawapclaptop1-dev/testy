import { describe, expect, it } from 'vitest';
import {
  NETWORK_CABLE_AND_WIFI_STANDARDS,
  SPEEDTEST_SERVER_CATALOG,
  getCableCapacityComparison,
  networkTestService,
  parseLinkSpeedTextToMbps,
  parseNetAdapterPaste,
} from '../networkTest.service';
import { GAME_CATALOG, gameBenchService } from '../gameBench.service';
import { diskTestService } from '../diskTest.service';
import { hardwareScannerService } from '../hardwareScanner.service';
import { ramTestService } from '../ramTest.service';
import { GPU_SCENE_CATALOG, gpuStressEngine } from '../gpuStress.service';
import { batteryHealthService } from '../batteryHealth.service';

describe('Network Transfer Direction, Continuous Mode & LAN Diagnostics', () => {
  it('supports switching transferDirection between both, download, and upload in continuous/sampled states', () => {
    networkTestService.setTransferDirection('download');
    expect(networkTestService.getTransferDirection()).toBe('download');
    expect(networkTestService.createInitialState().transferDirection).toBe('download');

    networkTestService.setTransferDirection('upload');
    expect(networkTestService.getTransferDirection()).toBe('upload');
    expect(networkTestService.createInitialState().transferDirection).toBe('upload');

    networkTestService.setTransferDirection('both');
    expect(networkTestService.getTransferDirection()).toBe('both');
    expect(networkTestService.createInitialState().transferDirection).toBe('both');
  });

  it('parses Windows Get-NetAdapter paste output and ranks RJ-45 / Wi-Fi standards', () => {
    const sample = [
      'Name       InterfaceDescription                  Status       LinkSpeed MacAddress',
      'Ethernet   Realtek PCIe 2.5GbE Family Controller Up           2.5 Gbps  AA-BB-CC-DD-EE-01',
      'Wi-Fi      Intel(R) Wi-Fi 6E AX211 160MHz        Up           1.2 Gbps  AA-BB-CC-DD-EE-02',
    ].join('\n');

    expect(parseLinkSpeedTextToMbps('2.5 Gbps')).toBe(2500);
    expect(parseLinkSpeedTextToMbps('1000 Mbps')).toBe(1000);

    const adapters = parseNetAdapterPaste(sample);
    expect(adapters).toHaveLength(2);
    expect(adapters[0].type).toBe('Ethernet (LAN)');
    expect(adapters[0].linkSpeedMbps).toBe(2500);
    expect(adapters[1].type).toBe('Wi-Fi');

    const comp = getCableCapacityComparison(adapters, 940);
    expect(comp.primaryAdapter?.linkSpeedMbps).toBe(2500);
    expect(comp.saturationPct).toBeGreaterThan(30);
    expect(NETWORK_CABLE_AND_WIFI_STANDARDS.length).toBeGreaterThanOrEqual(6);
    expect(SPEEDTEST_SERVER_CATALOG.length).toBeGreaterThanOrEqual(30);
  });
});

describe('GameBench 3D Catalog (44 Worlds), GPU Stress (48 Scenes), Combat Campaigns, AI Graphics Tuner & Smooth Mode', () => {
  it('exposes 44 unique Game Bench worlds and 48 GPU stress tests and classifies combat/racing/flight/soccer modes', () => {
    const ids = GAME_CATALOG.map((g) => g.id);
    expect(GAME_CATALOG.length).toBe(44);
    expect(new Set(ids).size).toBe(GAME_CATALOG.length);
    expect(ids).toContain('soccer_champions_3d');
    expect(ids).toContain('bugatti_hypercar_450');
    expect(ids).toContain('f22_raptor_jet');
    expect(ids).toContain('sr71_mach_plane');
    expect(ids).toContain('apache_gunship_heli');

    // Playable AAA campaigns & new worlds
    expect(ids).toContain('tank_blitz_3d');
    expect(ids).toContain('mech_titan_3d');
    expect(ids).toContain('f18_naval_strike');
    expect(ids).toContain('submarine_hunt_3d');
    expect(ids).toContain('motogp_superbike_3d');
    expect(ids).toContain('starfighter_trench_3d');
    expect(ids).toContain('ac130_gunship_3d');
    expect(ids).toContain('cyber_hoverbike_3d');
    expect(ids).toContain('volcano_heli_rescue');
    expect(ids).toContain('battleship_yamato_3d');

    // GPU Stress 48 tests including 4 new AAA tests
    const gpuIds = GPU_SCENE_CATALOG.map((s) => s.id);
    expect(GPU_SCENE_CATALOG.length).toBe(48);
    expect(new Set(gpuIds).size).toBe(GPU_SCENE_CATALOG.length);
    expect(gpuIds).toContain('rt_reflections_hall');
    expect(gpuIds).toContain('volumetric_clouds_4k');
    expect(gpuIds).toContain('cyber_rain_neon');
    expect(gpuIds).toContain('magma_caldera_sim');

    expect(gameBenchService.isRacingScene('formula_gp')).toBe(true);
    expect(gameBenchService.isRacingScene('bugatti_hypercar')).toBe(true);
    expect(gameBenchService.isRacingScene('motogp_superbike')).toBe(true);
    expect(gameBenchService.isRacingScene('cyber_hoverbike')).toBe(true);
    expect(gameBenchService.isSoccerScene('soccer_stadium')).toBe(true);
    expect(gameBenchService.isFlightScene('f22_jet')).toBe(true);
    expect(gameBenchService.isFlightScene('f18_naval')).toBe(true);
    expect(gameBenchService.isFlightScene('apache_heli')).toBe(true);
    expect(gameBenchService.isFlightScene('ac130_gunship')).toBe(true);
    expect(gameBenchService.isFlightScene('volcano_heli')).toBe(true);
    expect(gameBenchService.isCombatScene('tank_blitz')).toBe(true);
    expect(gameBenchService.isCombatScene('mech_titan')).toBe(true);
    expect(gameBenchService.isCombatScene('submarine_hunt')).toBe(true);
    expect(gameBenchService.isCombatScene('starfighter_trench')).toBe(true);
    expect(gameBenchService.isCombatScene('battleship_yamato')).toBe(true);

    const initial = gameBenchService.createInitialMetrics();
    expect(initial.fpsMode).toBe('vsync');
    expect(initial.isSmoothMode).toBe(true);
    expect(initial.gameMaxStage).toBe(5);
    expect(initial.raceTotalLaps).toBe(5);

    gameBenchService.setSfxEnabled(false);
    gameBenchService.setSfxEnabled(true);
    gameBenchService.restartGameMission();
    expect(gameBenchService.getMetrics().gameStage).toBe(1);
  });

  it('applies AI graphics profiles and advanced graphics settings deterministically', () => {
    gameBenchService.applyAiGraphicsProfile('ai_quality_4k');
    let m = gameBenchService.getMetrics();
    expect(m.aiProfile).toBe('ai_quality_4k');
    expect(m.toneMapping).toBe('agx');
    expect(m.anisotropy).toBe(16);

    gameBenchService.applyAiGraphicsProfile('ai_esports');
    m = gameBenchService.getMetrics();
    expect(m.aiProfile).toBe('ai_esports');
    expect(m.fpsCap).toBe(144);
    expect(m.shadowsEnabled).toBe(false);

    gameBenchService.setDynamicResolution(true);
    gameBenchService.setExposure(1.25);
    gameBenchService.setSceneryDensityPct(75);
    m = gameBenchService.getMetrics();
    expect(m.dynamicResolution).toBe(true);
    expect(m.exposure).toBe(1.25);
    expect(m.sceneryDensityPct).toBe(75);

    gameBenchService.applyAiGraphicsProfile('ai_auto');
  });
});

describe('Disk Drive Selector & 12-Component Automatic Hardware Scanners', () => {
  it('lists default drives, registers SMBIOS physical drives, and allows selecting a target drive', () => {
    diskTestService.registerSmbiosDrives([
      {
        model: 'Samsung 990 PRO 2TB',
        interfaceType: 'NVMe PCIe 4.0',
        mediaType: 'NVMe SSD',
        sizeGB: 2000,
        status: 'OK',
        serial: 'S6Z2NX0T123456',
      },
    ]);
    const drives = diskTestService.getAvailableDrives();
    expect(drives.length).toBeGreaterThanOrEqual(2);
    const nvme = drives.find((d) => (d.model || '').includes('Samsung 990 PRO'));
    expect(nvme).toBeDefined();
    const selected = diskTestService.selectDrive(nvme!.id);
    expect(selected.id).toBe(nvme!.id);
    expect(diskTestService.getSelectedDrive().id).toBe(nvme!.id);
    // Reset back to default OPFS drive
    diskTestService.selectDrive('opfs_default');
  });

  it('produces 12 dedicated component scan cards automatically', async () => {
    const cards = await hardwareScannerService.scanAll12Components({
      specs: null,
      scan: null,
      ramState: ramTestService.createInitialState(256),
      diskState: diskTestService.createInitialState(),
      gpuState: gpuStressEngine.createInitialMetrics(),
      batteryState: batteryHealthService.getState(),
      networkState: networkTestService.createInitialState(),
      drives: diskTestService.getAvailableDrives(),
      liveSensorsCount: 4,
      liveCpuTempC: 48,
      liveGpuTempC: 44,
    });
    expect(cards).toHaveLength(12);
    expect(new Set(cards.map((c) => c.id)).size).toBe(12);
  });

  it('registers Windows logical partitions (C:, D:, G:), imports JSON/text scan output, and parses logicalDisks from SMBIOS dump', () => {
    diskTestService.registerLogicalDrives([
      { letter: 'C:', volumeName: 'System', fileSystem: 'NTFS', totalGB: 950, freeGB: 410, driveType: 3 },
      { letter: 'D:', volumeName: 'Gry', fileSystem: 'NTFS', totalGB: 1860, freeGB: 920, driveType: 3 },
      { letter: 'G:', volumeName: 'Backup USB', fileSystem: 'exFAT', totalGB: 256, freeGB: 180, driveType: 2 },
    ]);

    let drives = diskTestService.getAvailableDrives();
    expect(drives.some((d) => d.path === 'C:\\' && d.label.includes('System'))).toBe(true);
    expect(drives.some((d) => d.path === 'D:\\' && d.label.includes('Gry'))).toBe(true);
    expect(drives.some((d) => d.path === 'G:\\' && d.interfaceType.includes('USB'))).toBe(true);
    expect(drives.some((d) => d.id === 'opfs_default')).toBe(true);

    const textImport = diskTestService.importDiskScanText('Moje partycje to E:\\ oraz F:\\');
    expect(textImport.ok).toBe(true);
    expect(textImport.added).toBe(2);
    drives = diskTestService.getAvailableDrives();
    expect(drives.some((d) => d.path === 'E:\\')).toBe(true);
    expect(drives.some((d) => d.path === 'F:\\')).toBe(true);

    const jsonDump = JSON.stringify({
      os: 'Windows',
      sys: { Manufacturer: 'ASUS', Model: 'ROG Strix' },
      board: { Manufacturer: 'ASUS', Product: 'Z790-E' },
      cpu: { Name: 'Intel Core i9-14900K', NumberOfCores: 24, NumberOfLogicalProcessors: 32, MaxClockSpeed: 6000 },
      disks: [
        {
          Model: 'WD Black SN850X 2TB',
          InterfaceType: 'SCSI',
          MediaType: 'SSD',
          Size: 2000398934016,
          Status: 'OK',
          SerialNumber: 'WDS200T2X0E',
        },
      ],
      logicalDisks: [
        { DeviceID: 'C:', VolumeName: 'Windows', FileSystem: 'NTFS', Size: 1000202039296, FreeSpace: 512000000000, DriveType: 3 },
        { DeviceID: 'D:', VolumeName: 'DataNVMe', FileSystem: 'NTFS', Size: 1000194801664, FreeSpace: 800000000000, DriveType: 3 },
      ],
    });

    const parsedDump = hardwareScannerService.parseDeepHardwareDump(jsonDump);
    expect(parsedDump.ok).toBe(true);
    expect(parsedDump.inventory).not.toBeNull();
    expect(parsedDump.inventory!.disks.length).toBe(1);
    expect(parsedDump.inventory!.disks[0].model).toBe('WD Black SN850X 2TB');
    expect(parsedDump.inventory!.logicalDisks?.length).toBe(2);
    expect(parsedDump.inventory!.logicalDisks![0].letter).toBe('C:');
    expect(parsedDump.inventory!.logicalDisks![1].volumeName).toBe('DataNVMe');

    drives = diskTestService.getAvailableDrives();
    expect(drives.some((d) => d.path === 'C:\\' && d.label.includes('Windows'))).toBe(true);
    expect(drives.some((d) => d.path === 'D:\\' && d.label.includes('DataNVMe'))).toBe(true);

    // Reset selected drive cleanly
    diskTestService.selectDrive('opfs_default');
  });
});


