import { PsuStressProfile, PsuRailAlertRules } from '../types';
import type { PowerDrawSample } from '../ui/psuPowerDrawTrend';

export interface PsuPowerCalculation {
  totalSystemPowerW: number;
  cpuPowerW: number;
  gpuPowerW: number;
  boardRamStoragePowerW: number;
  psuCapacityW: number;
  loadPercentageOfPsu: number;
  efficiencyPct: number;
  estimatedHeatDissipationW: number;
  electricityPricePerKwh: number;
  usageHoursPerDay: number;
  monthlyKwh: number;
  monthlyCost: number;
  recommendation: string;
  highPowerSimActive: boolean;
  stressProfile: PsuStressProfile;
}

export interface PsuStressProfileMeta {
  id: PsuStressProfile;
  label: string;
  shortDesc: string;
  cpuLoadBoost: number;
  gpuLoadBoost: number;
  extraDrawW: number;
  rail12VDroopV: number;
  rail5VDroopV: number;
  rail3P3VDroopV: number;
  rippleBoostMv: number;
}

export const PSU_STRESS_PROFILES: PsuStressProfileMeta[] = [
  {
    id: 'normal',
    label: 'Normalny (Live Telemetria)',
    shortDesc: 'Rzeczywiste obciążenie CPU/GPU z bieżących testów',
    cpuLoadBoost: 0,
    gpuLoadBoost: 0,
    extraDrawW: 0,
    rail12VDroopV: 0,
    rail5VDroopV: 0,
    rail3P3VDroopV: 0,
    rippleBoostMv: 0,
  },
  {
    id: 'gpu_intense',
    label: 'GPU Intense (3D OC / Raymarch Peak)',
    shortDesc: 'Maksymalny pobór linii +12V PCIe 5.0 (12VHPWR) — spadek +12V >5%',
    cpuLoadBoost: 45,
    gpuLoadBoost: 100,
    extraDrawW: 215,
    rail12VDroopV: 0.68, // drops +12V to ~11.18V (>5% deviation!)
    rail5VDroopV: 0.06,
    rail3P3VDroopV: 0.04,
    rippleBoostMv: 26,
  },
  {
    id: 'cpu_multicore',
    label: 'Full Multi-Core CPU Load (AVX2 VRM)',
    shortDesc: 'Pełne obciążenie wielordzeniowe EPS +12V oraz kontrolerów +5V/+3.3V',
    cpuLoadBoost: 100,
    gpuLoadBoost: 40,
    extraDrawW: 155,
    rail12VDroopV: 0.42,
    rail5VDroopV: 0.31, // drops +5V to ~4.67V (>5% deviation!)
    rail3P3VDroopV: 0.19, // drops +3.3V to ~3.10V (>5% deviation!)
    rippleBoostMv: 22,
  },
  {
    id: 'transient_spike',
    label: 'Transient Power Spike (ATX 3.0 Cross-Load)',
    shortDesc: 'Ekstremalny impuls przeciążeniowy >94% PSU (wszystkie szyny poza ±5%)',
    cpuLoadBoost: 100,
    gpuLoadBoost: 100,
    extraDrawW: 295,
    rail12VDroopV: 0.78,
    rail5VDroopV: 0.34,
    rail3P3VDroopV: 0.23,
    rippleBoostMv: 38,
  },
];

class PsuCalculatorService {
  private psuCapacityW = 850; // Default 850W ATX 3.0 Gold PSU
  private electricityPricePerKwh = 0.85; // PLN per kWh
  private usageHoursPerDay = 5; // hours / day
  private railDeviationPct = 5.0; // 5% default tolerance
  private powerAlertThresholdPct = 95; // 95% default capacity alert threshold
  private highPowerSimulationEnabled = false;
  private stressProfile: PsuStressProfile = 'normal';
  private powerDrawHistory1m: PowerDrawSample[] = [];
  private alertRules: PsuRailAlertRules = {
    rail12VThresholdPct: 5.0,
    rail5VThresholdPct: 5.0,
    rail3P3VThresholdPct: 5.0,
    desktopNotification: true,
    logError: true,
    soundAlert: true,
  };

  constructor() {
    try {
      const p = localStorage.getItem('systempulse_psu_price_kwh');
      if (p !== null) this.electricityPricePerKwh = Math.max(0.01, Number(p) || 0.85);
      const h = localStorage.getItem('systempulse_psu_hours_day');
      if (h !== null) this.usageHoursPerDay = Math.max(1, Math.min(24, Number(h) || 5));
      const d = localStorage.getItem('systempulse_psu_rail_deviation_pct');
      if (d !== null) {
        this.railDeviationPct = Math.max(1, Math.min(20, Number(d) || 5.0));
        this.alertRules.rail12VThresholdPct = this.railDeviationPct;
        this.alertRules.rail5VThresholdPct = this.railDeviationPct;
        this.alertRules.rail3P3VThresholdPct = this.railDeviationPct;
      }
      const r = localStorage.getItem('systempulse_psu_alert_rules_v1');
      if (r) {
        const parsed = JSON.parse(r) as Partial<PsuRailAlertRules>;
        this.alertRules = {
          rail12VThresholdPct: Math.max(0.5, Math.min(20, Number(parsed.rail12VThresholdPct) || this.railDeviationPct)),
          rail5VThresholdPct: Math.max(0.5, Math.min(20, Number(parsed.rail5VThresholdPct) || this.railDeviationPct)),
          rail3P3VThresholdPct: Math.max(0.5, Math.min(20, Number(parsed.rail3P3VThresholdPct) || this.railDeviationPct)),
          desktopNotification: parsed.desktopNotification ?? true,
          logError: parsed.logError ?? true,
          soundAlert: parsed.soundAlert ?? true,
        };
      }
      const pThresh = localStorage.getItem('systempulse_psu_power_alert_threshold_pct');
      if (pThresh !== null) {
        const parsedThresh = Number(pThresh);
        if (Number.isFinite(parsedThresh) && parsedThresh >= 1 && parsedThresh <= 100) {
          this.powerAlertThresholdPct = Number(parsedThresh.toFixed(1));
        }
      }
    } catch {}
  }

  public getAlertRules(): PsuRailAlertRules {
    return { ...this.alertRules };
  }

  public setAlertRules(patch: Partial<PsuRailAlertRules>): PsuRailAlertRules {
    this.alertRules = {
      ...this.alertRules,
      ...patch,
      rail12VThresholdPct: Math.max(0.5, Math.min(20, Number(patch.rail12VThresholdPct ?? this.alertRules.rail12VThresholdPct) || 5)),
      rail5VThresholdPct: Math.max(0.5, Math.min(20, Number(patch.rail5VThresholdPct ?? this.alertRules.rail5VThresholdPct) || 5)),
      rail3P3VThresholdPct: Math.max(0.5, Math.min(20, Number(patch.rail3P3VThresholdPct ?? this.alertRules.rail3P3VThresholdPct) || 5)),
    };
    try {
      localStorage.setItem('systempulse_psu_alert_rules_v1', JSON.stringify(this.alertRules));
    } catch {}
    return this.getAlertRules();
  }

  public setPsuCapacity(capacityW: number): void {
    this.psuCapacityW = Math.max(300, Math.min(2000, Math.round(capacityW)));
  }

  public getPsuCapacity(): number {
    return this.psuCapacityW;
  }

  public setElectricityPrice(val: number): void {
    this.electricityPricePerKwh = Math.max(0.01, Number(val) || 0.85);
    try { localStorage.setItem('systempulse_psu_price_kwh', String(this.electricityPricePerKwh)); } catch {}
  }

  public getElectricityPrice(): number {
    return this.electricityPricePerKwh;
  }

  public setUsageHoursPerDay(val: number): void {
    this.usageHoursPerDay = Math.max(1, Math.min(24, Math.round(Number(val) || 5)));
    try { localStorage.setItem('systempulse_psu_hours_day', String(this.usageHoursPerDay)); } catch {}
  }

  public getUsageHoursPerDay(): number {
    return this.usageHoursPerDay;
  }

  public setRailDeviationPct(val: number): void {
    this.railDeviationPct = Math.max(0.5, Math.min(20, Number(val) || 5.0));
    this.setAlertRules({
      rail12VThresholdPct: this.railDeviationPct,
      rail5VThresholdPct: this.railDeviationPct,
      rail3P3VThresholdPct: this.railDeviationPct,
    });
    try { localStorage.setItem('systempulse_psu_rail_deviation_pct', String(this.railDeviationPct)); } catch {}
  }

  public getRailDeviationPct(): number {
    return this.railDeviationPct;
  }

  public getPowerAlertThresholdPct(): number {
    return this.powerAlertThresholdPct;
  }

  public setPowerAlertThresholdPct(val: number): number {
    const parsed = Number(val);
    const clamped = Number.isFinite(parsed)
      ? Number(Math.max(1, Math.min(100, parsed)).toFixed(1))
      : 95;
    this.powerAlertThresholdPct = clamped;
    try {
      localStorage.setItem('systempulse_psu_power_alert_threshold_pct', String(this.powerAlertThresholdPct));
    } catch {}
    return this.powerAlertThresholdPct;
  }

  public setHighPowerSimulation(enabled: boolean): void {
    this.highPowerSimulationEnabled = Boolean(enabled);
  }

  public isHighPowerSimulationEnabled(): boolean {
    return this.highPowerSimulationEnabled;
  }

  public setStressProfile(profile: PsuStressProfile): void {
    this.stressProfile = profile;
  }

  public getStressProfile(): PsuStressProfile {
    return this.stressProfile;
  }

  public getStressProfileMeta(): PsuStressProfileMeta {
    return PSU_STRESS_PROFILES.find((p) => p.id === this.stressProfile) || PSU_STRESS_PROFILES[0];
  }

  public seedPowerDrawHistory1m(baselineW: number, nowMs: number = Date.now()): void {
    if (this.powerDrawHistory1m.length >= 4) return;
    const safeBase = Math.max(40, Math.round(Number.isFinite(baselineW) ? baselineW : 120));
    const seeded: PowerDrawSample[] = [];
    for (let i = 23; i >= 0; i--) {
      const ts = nowMs - i * 2500;
      const jitter = Math.round(Math.sin((23 - i) * 0.45) * 6 + Math.cos((23 - i) * 0.9) * 3);
      seeded.push({
        timestamp: ts,
        totalPowerW: Math.max(35, safeBase + jitter),
      });
    }
    this.powerDrawHistory1m = seeded;
  }

  public recordPowerDrawSample(totalSystemPowerW: number, nowMs: number = Date.now()): void {
    if (!Number.isFinite(totalSystemPowerW) || totalSystemPowerW < 0) return;
    const last = this.powerDrawHistory1m[this.powerDrawHistory1m.length - 1];
    const roundedW = Math.round(totalSystemPowerW);
    if (last && nowMs - last.timestamp < 500 && Math.abs(last.totalPowerW - roundedW) < 2) {
      return;
    }
    const cutoff = nowMs - 65_000;
    const pruned = this.powerDrawHistory1m.filter((s) => s.timestamp >= cutoff).slice(-119);
    pruned.push({ timestamp: nowMs, totalPowerW: roundedW });
    this.powerDrawHistory1m = pruned;
  }

  public getPowerDrawSamples1m(nowMs: number = Date.now()): PowerDrawSample[] {
    const cutoff = nowMs - 60_000;
    return this.powerDrawHistory1m.filter((s) => s.timestamp >= cutoff);
  }

  public clearPowerDrawHistory(): void {
    this.powerDrawHistory1m = [];
  }

  public getSimulatedRailsForProfile(baseLoadPct: number): {
    rail12V: number;
    rail5V: number;
    rail3P3V: number;
    rippleMv: number;
  } {
    const profileMeta = this.getStressProfileMeta();
    const effLoad = this.highPowerSimulationEnabled
      ? Math.max(94, baseLoadPct)
      : Math.max(baseLoadPct, profileMeta.cpuLoadBoost, profileMeta.gpuLoadBoost);

    const highPowerDroop12 = this.highPowerSimulationEnabled ? 0.52 : 0;
    const highPowerDroop5 = this.highPowerSimulationEnabled ? 0.14 : 0;
    const highPowerDroop3 = this.highPowerSimulationEnabled ? 0.08 : 0;

    const rail12V = Number(
      (12.04 - (effLoad / 100) * 0.18 - profileMeta.rail12VDroopV - highPowerDroop12).toFixed(2)
    );
    const rail5V = Number(
      (5.03 - (effLoad / 100) * 0.05 - profileMeta.rail5VDroopV - highPowerDroop5).toFixed(2)
    );
    const rail3P3V = Number(
      (3.32 - (effLoad / 100) * 0.03 - profileMeta.rail3P3VDroopV - highPowerDroop3).toFixed(2)
    );
    const rippleMv = Math.round(
      14 + (effLoad / 100) * 18 + profileMeta.rippleBoostMv + (this.highPowerSimulationEnabled ? 18 : 0)
    );

    return { rail12V, rail5V, rail3P3V, rippleMv };
  }

  public calculate(cpuLoadPct: number, gpuLoadPct: number, coreCount = 8, psuTempC = 38.0): PsuPowerCalculation {
    const profileMeta = this.getStressProfileMeta();

    const effectiveCpuLoad = this.highPowerSimulationEnabled
      ? 98
      : Math.max(cpuLoadPct, profileMeta.cpuLoadBoost);
    const effectiveGpuLoad = this.highPowerSimulationEnabled
      ? 98
      : Math.max(gpuLoadPct, profileMeta.gpuLoadBoost);

    const safeCpuLoad = Math.max(0, Math.min(100, effectiveCpuLoad));
    const safeGpuLoad = Math.max(0, Math.min(100, effectiveGpuLoad));

    // Base TDP estimates for high-end desktop/laptop rig
    const maxCpuTdpW = coreCount >= 12 ? 165 : coreCount >= 8 ? 125 : 65;
    const maxGpuTdpW = 320; // e.g., RTX 4080 / RX 7900 XTX class

    const baseCpuW = 15 + (maxCpuTdpW - 15) * (safeCpuLoad / 100);
    const baseGpuW = 20 + (maxGpuTdpW - 20) * (safeGpuLoad / 100);
    const highPowerExtraW = this.highPowerSimulationEnabled ? 315 : profileMeta.extraDrawW;

    const cpuPowerW = Number((baseCpuW + (this.stressProfile === 'cpu_multicore' ? 85 : 0) + (this.highPowerSimulationEnabled ? 80 : 0)).toFixed(1));
    const gpuPowerW = Number((baseGpuW + (this.stressProfile === 'gpu_intense' ? 165 : 0) + (this.highPowerSimulationEnabled ? 195 : 0)).toFixed(1));
    const boardRamStoragePowerW = Number((35.0 + (highPowerExtraW > 200 ? 40 : 0)).toFixed(1));

    const rawTotalW = Math.min(this.psuCapacityW * 0.98, cpuPowerW + gpuPowerW + boardRamStoragePowerW);
    const loadPercentageOfPsu = Number(((rawTotalW / this.psuCapacityW) * 100).toFixed(1));

    // Realistic 80 PLUS Gold parabolic efficiency curve peaking at ~92.2% at 50% load,
    // plus realistic thermal degradation as internal PSU/component temperatures rise above 35°C
    const thermalDropPct = Math.max(0, (psuTempC - 35.0) * 0.095);
    const curveEff = 92.2 - 0.0022 * Math.pow(loadPercentageOfPsu - 50, 2) - thermalDropPct;
    const efficiencyPct = Number(Math.max(80.5, Math.min(92.8, curveEff)).toFixed(1));
    const acTotalPowerW = Number((rawTotalW / (efficiencyPct / 100)).toFixed(1));

    const estimatedHeatDissipationW = Number((acTotalPowerW - rawTotalW).toFixed(1));

    // Projected Monthly Cost calculation: (AC Power kW) * (hours/day) * 30 days * price/kWh
    const monthlyKwh = Number(((acTotalPowerW / 1000) * this.usageHoursPerDay * 30).toFixed(1));
    const monthlyCost = Number((monthlyKwh * this.electricityPricePerKwh).toFixed(2));

    let recommendation = 'Zasilacz pracuje w optymalnym zakresie obciążenia (40–60% — najwyższa sprawność).';
    if (loadPercentageOfPsu > 90) {
      recommendation = 'ALARM: Obciążenie zasilacza przekracza 90% pojemności znamionowej! Aktywowano pulsowanie ostrzegawcze Load Gauge.';
    } else if (loadPercentageOfPsu > 85) {
      recommendation = 'UWAGA: Obciążenie zasilacza przekracza 85%! Zalecany mocniejszy zasilacz ATX 3.0.';
    } else if (loadPercentageOfPsu < 40) {
      recommendation = 'Obciążenie poniżej optymalnej strefy 40–60%. Sprawdź wskazówki Predictive Efficiency Advisor poniżej.';
    }

    return {
      totalSystemPowerW: Math.round(rawTotalW),
      cpuPowerW,
      gpuPowerW,
      boardRamStoragePowerW,
      psuCapacityW: this.psuCapacityW,
      loadPercentageOfPsu,
      efficiencyPct,
      estimatedHeatDissipationW,
      electricityPricePerKwh: this.electricityPricePerKwh,
      usageHoursPerDay: this.usageHoursPerDay,
      monthlyKwh,
      monthlyCost,
      recommendation,
      highPowerSimActive: this.highPowerSimulationEnabled,
      stressProfile: this.stressProfile,
    };
  }
}

export const psuCalculatorService = new PsuCalculatorService();
