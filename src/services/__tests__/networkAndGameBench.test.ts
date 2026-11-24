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

describe('GameBench 3D Catalog, Genres, AI Graphics Tuner & Smooth Mode', () => {
  it('exposes racing, playable 3D soccer, flight jets/helicopters, and defaults to smooth VSync pacing', () => {
    const ids = GAME_CATALOG.map((g) => g.id);
    expect(new Set(ids).size).toBe(GAME_CATALOG.length);
    expect(ids).toContain('soccer_champions_3d');
    expect(ids).toContain('bugatti_hypercar_450');
    expect(ids).toContain('f22_raptor_jet');
    expect(ids).toContain('sr71_mach_plane');
    expect(ids).toContain('apache_gunship_heli');

    expect(gameBenchService.isRacingScene('formula_gp')).toBe(true);
    expect(gameBenchService.isRacingScene('bugatti_hypercar')).toBe(true);
    expect(gameBenchService.isSoccerScene('soccer_stadium')).toBe(true);
    expect(gameBenchService.isFlightScene('f22_jet')).toBe(true);
    expect(gameBenchService.isFlightScene('apache_heli')).toBe(true);

    const initial = gameBenchService.createInitialMetrics();
    expect(initial.fpsMode).toBe('vsync');
    expect(initial.isSmoothMode).toBe(true);
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
