import { describe, expect, it } from 'vitest';
import { buildBatteryPowerCyclesCsv, buildPsuRailHistoryCsv, formatCycleDateTime } from '../batteryExport.service';
import { GPU_SCENE_CATALOG } from '../gpuStress.service';
import { BatteryPowerCycleEntry } from '../../types';

const SAMPLE_CYCLES: BatteryPowerCycleEntry[] = [
  {
    id: 'cyc-001',
    cycleNumber: 1,
    timestamp: new Date('2026-09-10T08:30:00Z').getTime(),
    dateLabel: '10.09.2026',
    startPct: 18,
    endPct: 98,
    durationMin: 74,
    avgPowerW: 36.4,
    designCapacityMWh: 56000,
    fullChargeCapacityMWh: 54800,
    degradationFromPrevMWh: -1200,
    cumulativeWearPct: 2.1,
    source: 'baseline',
  },
  {
    id: 'cyc-002',
    cycleNumber: 2,
    timestamp: new Date('2026-10-05T19:15:00Z').getTime(),
    dateLabel: '05.10.2026',
    startPct: 22,
    endPct: 100,
    durationMin: 68,
    avgPowerW: 34.2,
    designCapacityMWh: 56000,
    fullChargeCapacityMWh: 54120,
    degradationFromPrevMWh: -680,
    cumulativeWearPct: 3.4,
    source: 'manual',
  },
];

describe('Battery Power Cycles Export & GPU 3D Scene Catalog', () => {
  it('formats power cycle timestamp into a readable date/time string with fallback', () => {
    const formatted = formatCycleDateTime(SAMPLE_CYCLES[0]);
    expect(formatted).toMatch(/\d{2}\.\d{2}\.\d{4}/);
    expect(formatted).toMatch(/\d{2}:\d{2}/);

    const fallback = formatCycleDateTime({ ...SAMPLE_CYCLES[0], timestamp: 0 });
    expect(fallback).toBe('10.09.2026');
  });

  it('exports recorded battery power cycles to UTF-8 BOM CSV with all required columns', () => {
    const csv = buildBatteryPowerCyclesCsv(SAMPLE_CYCLES);
    expect(csv.startsWith('\uFEFF')).toBe(true);

    const lines = csv.slice(1).split('\r\n');
    expect(lines).toHaveLength(3);
    expect(lines[0]).toBe(
      'Cycle_ID,Cykl_Nr,Data_Czas,Start_Charge_Pct,End_Charge_Pct,Przyrost_Pct,Duration_Min,Avg_Power_W,Design_Capacity_mWh,Measured_Full_Capacity_mWh,Degradation_From_Prev_mWh,Cumulative_Wear_Pct,Zrodlo'
    );
    // Most recent cycle listed first
    expect(lines[1]).toContain('cyc-002,2,');
    expect(lines[1]).toContain(',22,100,78,68,34.2,56000,54120,-680,3.4,manual');
    expect(lines[2]).toContain('cyc-001,1,');
    expect(lines[2]).toContain(',18,98,80,74,36.4,56000,54800,-1200,2.1,baseline');
  });

  it('builds CSV for PSU rail voltage fluctuations with UTF-8 BOM and correct headers', () => {
    const now = Date.now();
    const railHistory = [
      { timeLabel: '12:00:00', timestamp: now - 30000, rail12V: 11.95, rail5V: 5.01, rail3P3V: 3.30, powerW: 85.0 },
      { timeLabel: '12:00:05', timestamp: now - 10000, rail12V: 11.88, rail5V: 4.99, rail3P3V: 3.28, powerW: 145.2 },
    ];
    const csv = buildPsuRailHistoryCsv(railHistory);
    expect(csv.startsWith('\uFEFF')).toBe(true);
    const lines = csv.slice(1).split('\r\n');
    expect(lines[0]).toBe('Czas_Etykieta,Timestamp,Data_Czas,Szyna_+12V_V,Szyna_+5V_V,Szyna_+3.3V_V,Pobor_Mocy_W');
    expect(lines).toHaveLength(3);
    expect(lines[1]).toContain('12:00:00');
    expect(lines[1]).toContain('11.95');
    expect(lines[2]).toContain('12:00:05');
    expect(lines[2]).toContain('145.2');
  });

  it('exposes 44 distinct WebGL 3D GPU stress scenes including all next-gen scenes', () => {
    expect(GPU_SCENE_CATALOG).toHaveLength(44);
    const ids = GPU_SCENE_CATALOG.map((s) => s.id);
    expect(new Set(ids).size).toBe(44);
    expect(ids).toContain('volumetric_nebula');
    expect(ids).toContain('crystal_caustics');
    expect(ids).toContain('blackhole_lensing');
    expect(ids).toContain('dna_megastructure');
    expect(ids).toContain('pathtraced_cornell');
    expect(ids).toContain('subsurface_dragon');
    expect(ids).toContain('cloth_aerodynamics');
    expect(ids).toContain('volumetric_godrays');
    expect(ids).toContain('voronoi_shatter');
    expect(ids).toContain('supernova_remnant');
    expect(ids).toContain('cyber_tunnel_warp');
    expect(ids).toContain('magnetic_ferrofluid');
    expect(ids).toContain('fractal_julia4d');
    expect(ids).toContain('tokamak_fusion');
    expect(ids).toContain('raytraced_metaballs');
    expect(ids).toContain('ocean_gerstner_fft');
    expect(ids).toContain('fluid_navier_stokes');
    expect(ids).toContain('gi_radiosity_temple');
    expect(ids).toContain('particle_collider_cern');
    expect(ids).toContain('procedural_planet_atmo');
    expect(ids).toContain('volumetric_fire_tornado');
    expect(ids).toContain('cyber_matrix_hypercube');
  });
});


