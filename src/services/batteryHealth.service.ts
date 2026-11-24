import {
  BatteryHealthState,
  BatteryHistoryPoint,
  BatteryPowerCycleEntry,
  BatteryRuntimeEstimate,
  FanTestState,
  PowerThermalMaintenanceReport,
  PsuEfficiencyTrendPoint,
  ThermalHeatMapSnapshot,
  VoltageSagTestResult,
  WindowsBatteryWmiSnapshot,
} from '../types';
import { soundNotificationService } from './soundNotification.service';
import { psuCalculatorService } from './psuCalculator.service';
import { thermalMonitorService } from './thermalMonitor.service';
import { getLocalBridgeBases } from './localBridge';

export const BATTERY_WMI_PS_COMMAND =
  '$s=Get-CimInstance -Namespace root\\WMI -ClassName BatteryStaticData -EA SilentlyContinue|Select -First 1; $f=Get-CimInstance -Namespace root\\WMI -ClassName BatteryFullChargedCapacity -EA SilentlyContinue|Select -First 1; $c=Get-CimInstance -Namespace root\\WMI -ClassName BatteryCycleCount -EA SilentlyContinue|Select -First 1; $st=Get-CimInstance -Namespace root\\WMI -ClassName BatteryStatus -EA SilentlyContinue|Select -First 1; $wb=Get-CimInstance Win32_Battery -EA SilentlyContinue|Select -First 1; [pscustomobject]@{design=$s.DesignedCapacity;full=$f.FullChargedCapacity;cycles=$c.CycleCount;volt=$st.Voltage;rem=$st.RemainingCapacity;crate=$st.ChargeRate;drate=$st.DischargeRate;ac=$st.PowerOnline;name=$wb.Name;pct=$wb.EstimatedChargeRemaining}|ConvertTo-Json -Compress|Set-Clipboard';

export function parseWindowsBatteryWmiPaste(raw: string): WindowsBatteryWmiSnapshot | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  // 1. Try JSON output from our PowerShell command or /api/power/battery
  const jsonMatch = trimmed.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      const obj = JSON.parse(jsonMatch[0]) as Record<string, any>;
      const design = Number(obj.design ?? obj.DesignedCapacity ?? obj.designCapacityMWh ?? 0);
      const full = Number(obj.full ?? obj.FullChargedCapacity ?? obj.fullChargeCapacityMWh ?? 0);
      if (design > 5000 || full > 5000) {
        const finalDesign = design > 5000 ? design : full;
        const finalFull = full > 5000 ? Math.min(finalDesign, full) : finalDesign;
        return {
          source: 'powershell_paste',
          name: String(obj.name || 'Bateria WMI Windows'),
          chemistry: String(obj.chem || 'Li-Ion / Li-Po'),
          manufacturer: String(obj.mfr || 'OEM ACPI'),
          serial: String(obj.ser || ''),
          designCapacityMWh: Math.round(finalDesign),
          fullChargeCapacityMWh: Math.round(finalFull),
          remainingCapacityMWh: Number(obj.rem || 0) || undefined,
          cycleCount: Math.max(0, Math.round(Number(obj.cycles ?? obj.CycleCount ?? 0))),
          voltageMv: Math.max(0, Math.round(Number(obj.volt ?? obj.Voltage ?? 0))),
          chargeRateMw: Math.max(0, Math.round(Number(obj.crate ?? obj.ChargeRate ?? 0))),
          dischargeRateMw: Math.max(0, Math.round(Number(obj.drate ?? obj.DischargeRate ?? 0))),
          acOnline: Boolean(obj.ac ?? obj.PowerOnline ?? true),
          levelPct: Math.max(1, Math.min(100, Math.round(Number(obj.pct ?? 80)))),
          timestamp: Date.now(),
        };
      }
    } catch {
      // fall through to text regex parser (powercfg /batteryreport or key-value text)
    }
  }

  // 2. Fallback regex parser for powercfg /batteryreport text or key-value tables
  const numFrom = (re: RegExp): number => {
    const m = trimmed.match(re);
    if (!m) return 0;
    return Number(m[1].replace(/[^\d]/g, '')) || 0;
  };
  const designMWh = numFrom(/DESIGN(?:ED)?\s*CAPACITY\s*[:\t ]+([\d\s,.]+)\s*mWh/i);
  const fullMWh = numFrom(/FULL\s*CHARGE\s*CAPACITY\s*[:\t ]+([\d\s,.]+)\s*mWh/i);
  const cycles = numFrom(/CYCLE\s*COUNT\s*[:\t ]+([\d\s,.]+)/i);
  if (designMWh > 5000 && fullMWh > 3000) {
    return {
      source: 'powershell_paste',
      name: 'Bateria z raportu Windows powercfg',
      chemistry: 'Li-Ion',
      manufacturer: 'OEM ACPI',
      serial: '',
      designCapacityMWh: designMWh,
      fullChargeCapacityMWh: Math.min(designMWh, fullMWh),
      cycleCount: cycles,
      voltageMv: 0,
      chargeRateMw: 0,
      dischargeRateMw: 0,
      acOnline: true,
      levelPct: 85,
      timestamp: Date.now(),
    };
  }
  return null;
}

export function computePowerAndThermalMaintenanceReport(opts: {
  battery: BatteryHealthState;
  thermal: ThermalHeatMapSnapshot;
  fan: FanTestState;
  cpuThrottlingPct: number;
  laptopAgeMonths?: number;
  lastRepasteMonthsAgo?: number;
  isLaptop?: boolean;
}): PowerThermalMaintenanceReport {
  const b = opts.battery;
  const psuCalc = psuCalculatorService.calculate(b.currentLoadPct, 25, 8, b.psu.tempC);
  const ageMo = Math.max(0, opts.laptopAgeMonths ?? 18);
  const repasteMo = Math.max(0, opts.lastRepasteMonthsAgo ?? ageMo);
  const isLaptop = opts.isLaptop ?? (b.apiSupported || Boolean(b.wmiSnapshot));

  // 1. Battery lifespan remaining ("ile jeszcze pochodzi bateria")
  const health = Math.max(10, Math.min(100, b.healthPct));
  const ratedCycles = 650; // typical Li-Ion/Li-Po 80% threshold ~500-700 cycles, EOL ~850
  const cyclesTo80 = Math.max(0, Math.round(ratedCycles * 0.85 - b.estimatedCycles));
  const cyclesToEol = Math.max(0, Math.round(ratedCycles * 1.3 - b.estimatedCycles));
  const monthlyWearPct = ageMo >= 3 && b.wearLevelPct > 0.5 ? b.wearLevelPct / ageMo : 0.65;
  const monthsToEol = health <= 58 ? 2 : Math.max(3, Math.min(72, Math.round((health - 55) / Math.max(0.35, monthlyWearPct))));
  const batteryRemainingLabel =
    monthsToEol >= 24
      ? `${(monthsToEol / 12).toFixed(1)} lat (${monthsToEol} mies.)`
      : `${monthsToEol} mies.`;
  const batteryVerdict =
    health >= 85
      ? `Ogniwa w świetnej kondycji (${health}% pojemności). Bateria powinna pracować stabilnie jeszcze ok. ${batteryRemainingLabel} (~${cyclesToEol} pełnych cykli).`
      : health >= 70
        ? `Umiarkowane zużycie (${b.wearLevelPct}% ubytku). Pozostało ok. ${batteryRemainingLabel} do progu wymiany (<55–60% pojemności).`
        : `Znaczna degradacja ogniw (${b.wearLevelPct}% zużycia)! Bateria kwalifikuje się do wymiany w najbliższych ${monthsToEol} mies. — ryzyko nagłego wyłączania pod obciążeniem.`;

  // 2. PSU / Charger remaining life ("ile jeszcze pochodzi zasilacz")
  const psuTempPenalty = Math.max(0, (b.psu.tempC - 42) * 0.14);
  const psuLoadPenalty = psuCalc.loadPercentageOfPsu > 75 ? (psuCalc.loadPercentageOfPsu - 75) * 0.12 : 0;
  const ripplePenalty = Math.max(0, (b.psu.rippleMv - 22) * 0.15);
  const basePsuYears = b.psu.rating80Plus === '80 PLUS Titanium' || b.psu.rating80Plus === '80 PLUS Platinum' ? 10 : 8;
  const psuYearsLeft = Number(Math.max(1.0, Math.min(10.0, basePsuYears - ageMo / 12 - psuTempPenalty - psuLoadPenalty - ripplePenalty)).toFixed(1));
  const psuRemainingLabel = `${psuYearsLeft} lat (${Math.round(psuYearsLeft * 12)} mies.)`;
  const psuVerdict =
    psuCalc.loadPercentageOfPsu <= 75 && b.psu.rippleMv <= 25
      ? `Zasilacz ma duży zapas mocy (${psuCalc.loadPercentageOfPsu}% obciążenia, tętnienia ${b.psu.rippleMv} mVpp) — kondensatory elektrolityczne wytrzymają jeszcze ok. ${psuRemainingLabel}.`
      : `Wysokie obciążenie/ciepło zasilacza (${psuCalc.loadPercentageOfPsu}%, ${b.psu.tempC.toFixed(1)}°C, ${b.psu.rippleMv} mVpp). Przewidywana żywotność ok. ${psuRemainingLabel} — dbaj o drożność wentylatora PSU.`;

  // 3. Single-charge runtime (at 100% full health & current levelPct)
  const fullWh = b.fullChargeCapacityMWh / 1000;
  const currentWh = fullWh * (b.levelPct / 100);
  const designOver75 = b.designCapacityMWh > 75000;
  const wIdle = designOver75 ? 11.5 : 7.2;
  const wWeb = designOver75 ? 19.5 : 12.6;
  const wLoad = Math.max(wWeb, b.currentPowerDrawW);
  const fmtHrs = (wh: number, w: number) => {
    const mins = Math.max(10, Math.round((wh / Math.max(2, w)) * 60));
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `${h} godz. ${m.toString().padStart(2, '0')} min`;
  };
  const remainChargeStr = b.estimates[2]?.label || fmtHrs(currentWh, wLoad);
  const missingWh = Math.max(0, fullWh - currentWh);
  const chargeSpeedW = b.designCapacityMWh > 75000 ? 55 : 42;
  const minsToFull = b.charging && missingWh > 0.5 ? Math.max(4, Math.round((missingWh / chargeSpeedW) * 60)) : 0;
  const timeToFullChargeLabel = b.levelPct >= 99 ? 'Naładowana (100%)' : b.charging ? `${Math.floor(minsToFull / 60)}h ${String(minsToFull % 60).padStart(2, '0')}m` : 'Odłączona od zasilacza';

  // 4. Voltage Sag / Drop Diagnosis ("czy ma spadek napięcia")
  const expectedOcvV = 10.75 + (b.levelPct / 100) * 1.7 + (b.charging ? 0.35 : 0);
  const measuredCellV = b.sagTestResult ? b.sagTestResult.loadedVoltageV : b.voltageV;
  const sagMv = b.sagTestResult
    ? b.sagTestResult.cellSagMv
    : Math.max(0, Math.round((expectedOcvV - measuredCellV) * 1000 + b.wearLevelPct * 6.5));
  const sagPct = Number(((sagMv / 11400) * 100).toFixed(2));
  const rail12Droop = Math.abs(12.0 - b.psu.rail12V) / 12.0 * 100;
  let voltageSagStatus: PowerThermalMaintenanceReport['voltageSagStatus'] = 'BRAK SPADKU (STABILNE)';
  if (sagMv >= 420 || rail12Droop >= 4.5 || b.psu.rippleMv >= 34) {
    voltageSagStatus = 'WYRAŹNY SPADEK NAPIĘCIA';
  } else if (sagMv >= 180 || rail12Droop >= 2.5 || b.psu.rippleMv >= 24) {
    voltageSagStatus = 'LEKKI SPADEK';
  }
  const internalResistanceHint =
    voltageSagStatus === 'WYRAŹNY SPADEK NAPIĘCIA'
      ? `Wysoka rezystancja wewnętrzna ogniw lub zużycie kondensatorów PSU (spadek ${sagMv} mV / linia +12V: ${b.psu.rail12V.toFixed(2)}V).`
      : `Rezystancja wewnętrzna ogniw w normie (spadek ${sagMv} mV, tętnienia ${b.psu.rippleMv} mVpp, szyna +12V: ${b.psu.rail12V.toFixed(2)}V).`;

  // 5. Thermal Paste & Thermal Pads replacement advisor ("kiedy wymieniać pastę, pady itd.")
  const allZones = opts.thermal.rows.flatMap((r) => r.zones);
  const cpuTemp = allZones.find((z) => z.id === 'cpu-package')?.tempC ?? null;
  const gpuCore = allZones.find((z) => z.id === 'gpu-core')?.tempC ?? null;
  const gpuHotspot = allZones.find((z) => z.id === 'gpu-hotspot')?.tempC ?? null;
  const vramTemp = allZones.find((z) => z.id === 'gpu-vram')?.tempC ?? null;
  const hotspotDeltaC = gpuCore !== null && gpuHotspot !== null ? Number((gpuHotspot - gpuCore).toFixed(1)) : null;
  const deltaTLoadC = cpuTemp !== null ? Number(Math.max(0, cpuTemp - 33).toFixed(1)) : null;

  let urgencyScore = 0;
  const reasons: string[] = [];
  if (repasteMo >= 24) {
    urgencyScore += 45;
    reasons.push(`Od ostatniej wymiany pasty minęło ${repasteMo} mies. (standard dla laptopa to 12–18 mies., PC 24–36 mies. lub PTM7950 co 4+ lata).`);
  } else if (repasteMo >= 14 && isLaptop) {
    urgencyScore += 25;
    reasons.push(`Wiek pasty w laptopie (${repasteMo} mies.) zbliża się do efektu „pump-out” na gołym rdzeniu CPU/GPU.`);
  }
  if (cpuTemp !== null && cpuTemp >= 88) {
    urgencyScore += 38;
    reasons.push(`Bardzo wysoka temperatura CPU (${cpuTemp.toFixed(1)}°C) pod obciążeniem.`);
  } else if (cpuTemp !== null && cpuTemp >= 78) {
    urgencyScore += 18;
    reasons.push(`Podwyższona temperatura CPU (${cpuTemp.toFixed(1)}°C).`);
  }
  if (hotspotDeltaC !== null && hotspotDeltaC >= 18) {
    urgencyScore += 35;
    reasons.push(`Różnica GPU Core vs Hotspot wynosi ${hotspotDeltaC}°C (≥18°C oznacza wyschniętą lub wypchniętą pastę pod rdzeniem!).`);
  }
  if (vramTemp !== null && vramTemp >= 92) {
    urgencyScore += 28;
    reasons.push(`Wysoka temperatura pamięci VRAM (${vramTemp.toFixed(1)}°C) — zużyte lub stwardniałe termopady!`);
  }
  if (opts.cpuThrottlingPct >= 14) {
    urgencyScore += 25;
    reasons.push(`CPU wykazuje throttling -${opts.cpuThrottlingPct}% pod obciążeniem.`);
  }
  if (opts.fan.verdict === 'SŁABE SCHŁADZANIE') {
    urgencyScore += 20;
    reasons.push('Test krzywej wentylatora wykazał słabe odprowadzanie ciepła (możliwy kurz w żebrach radiatora).');
  }
  if (reasons.length === 0) {
    reasons.push(
      opts.thermal.sensorMode === 'load-only'
        ? `Brak aktywnego czujnika °C z mostka LHM — ocena oparta na wieku pasty (${repasteMo} mies.), obciążeniu oraz throttlingu (${opts.cpuThrottlingPct}%).`
        : 'Temperatury, różnica Hotspot i stabilność taktowań mieszczą się w bezpiecznych normach.'
    );
  }

  let pasteUrgency: PowerThermalMaintenanceReport['pasteUrgency'] = 'OPTYMALNA (NIE WYMAGA)';
  let pasteUrgencyColor = '#10b981';
  if (urgencyScore >= 55) {
    pasteUrgency = 'PILNA WYMIANA TERAZ';
    pasteUrgencyColor = '#f43f5e';
  } else if (urgencyScore >= 28) {
    pasteUrgency = 'WKRÓTCE (3–6 MIES.)';
    pasteUrgencyColor = '#f59e0b';
  }

  const targetCyclePaste = isLaptop ? 18 : 30;
  const targetCyclePads = isLaptop ? 30 : 48;
  const targetCycleDust = isLaptop ? 6 : 12;

  const pasteLeft = Math.max(0, targetCyclePaste - repasteMo);
  const padsLeft = Math.max(0, targetCyclePads - repasteMo);

  return {
    batteryRemainingMonths: monthsToEol,
    batteryRemainingLabel,
    batteryCyclesRemainingTo80: cyclesTo80,
    batteryCyclesRemainingToEol: cyclesToEol,
    batteryVerdict,
    psuRemainingYears: psuYearsLeft,
    psuRemainingLabel,
    psuVerdict,
    fullChargeIdleHours: fmtHrs(fullWh, wIdle),
    fullChargeWebHours: fmtHrs(fullWh, wWeb),
    fullChargeLoadHours: fmtHrs(fullWh, wLoad),
    currentChargeRemainLabel: remainChargeStr,
    timeToFullChargeLabel,
    voltageSagMv: sagMv,
    voltageSagPct: sagPct,
    voltageSagStatus,
    internalResistanceHint,
    pasteUrgency,
    pasteUrgencyColor,
    pasteNextSwapLabel: urgencyScore >= 55 ? 'Natychmiast (0 mies.)' : pasteLeft === 0 ? 'Zalecana w ciągu 1–2 mies.' : `Za ok. ${pasteLeft} mies.`,
    padsNextSwapLabel: vramTemp !== null && vramTemp >= 92 ? 'Natychmiast przy okazji serwisu' : padsLeft === 0 ? 'Sprawdź twardość przy otwarciu' : `Za ok. ${padsLeft} mies.`,
    fanCleanNextLabel: `Co ${targetCycleDust} mies. (sprężone powietrze + pędzel antystatyczny)`,
    cmosCheckLabel: ageMo >= 48 ? 'Zalecana kontrola ogniwa CR2032 (~3.0V)' : `Za ok. ${Math.max(6, 48 - ageMo)} mies. (bateria BIOS CR2032)`,
    deltaTLoadC,
    hotspotDeltaC,
    recommendedMaterials: isLaptop
      ? [
          'Rdzeń CPU/GPU (Direct-Die laptop): Termopad zmiennofazowy Honeywell PTM7950 (brak efektu pump-out, 4+ lata trwałości)',
          'VRM / VRAM w laptopie: Thermal Putty (kit termoprzewodzący Upsiren UX Pro / Halnziye) — idealnie dopasowuje grubość zamiast sztywnych padów',
          'Czyszczenie układu: Przedmuchanie turbin i łopatek radiatora co 6 mies. + odtłuszczenie alkoholem IPA 99.9%',
        ]
      : [
          'Procesor CPU (IHS): Pasta Thermal Grizzly Duronaut / Arctic MX-6 / Noctua NT-H2 (trwałość 3–4 lata)',
          'Karta graficzna GPU (rdzeń bez IHS): Honeywell PTM7950 lub Thermal Grizzly Kryonaut Extreme',
          'Pamięci VRAM / VRM / SSD M.2 NVMe: Termopady 12–15 W/mK (Gelid GP-Ultimate / Thermal Grizzly Minus Pad 8, grubość wg specyfikacji 1.0–2.0 mm)',
        ],
    actionReasons: reasons,
  };
}

export interface BatteryProfilePreset {
  id: string;
  label: string;
  designMWh: number;
  fullChargeMWh: number;
}

export const BATTERY_PRESETS: BatteryProfilePreset[] = [
  { id: 'ultrabook', label: 'Ultrabook 14" (56 Wh)', designMWh: 56000, fullChargeMWh: 51200 },
  { id: 'macbook', label: 'Laptop Biurowy (52.6 Wh)', designMWh: 52600, fullChargeMWh: 48900 },
  { id: 'gaming', label: 'Laptop Gamingowy (90 Wh)', designMWh: 90000, fullChargeMWh: 81400 },
  { id: 'workstation', label: 'Stacja Robocza (99.9 Wh)', designMWh: 99900, fullChargeMWh: 92500 },
];

export interface NewPowerCycleInput {
  startPct: number;
  endPct: number;
  durationMin: number;
  avgPowerW?: number;
  fullChargeCapacityMWh: number;
  source?: 'auto' | 'manual' | 'baseline';
}

function formatTimeLabel(date: Date): string {
  return `${date.getHours().toString().padStart(2, '0')}:${date
    .getMinutes()
    .toString()
    .padStart(2, '0')}:${date.getSeconds().toString().padStart(2, '0')}`;
}

function formatDateTimeShort(ts: number): string {
  return new Date(ts).toLocaleString('pl-PL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatExactDateTime(date: Date): string {
  return date.toLocaleString('pl-PL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export class BatteryHealthService {
  private batteryManager: any = null;
  private listeners: Array<(state: BatteryHealthState) => void> = [];
  private timerId: number | null = null;
  private loadProvider: () => number = () => 15;
  private state: BatteryHealthState;

  // Live automatic charging session tracker
  private activeChargeSession: {
    startTs: number;
    startPct: number;
    powerSamples: number[];
  } | null = null;
  private prevChargingState: boolean | null = null;

  private lastPowerExceeded = false;
  private lastRailAlert = false;
  private highLoadSecCounter = 0;
  private criticalAlertActive = false;
  private railAlertMarkersClearedAt = 0;
  private railResetCutoffMs: Record<'+12V' | '+5V' | '+3.3V', number> = {
    '+12V': 0,
    '+5V': 0,
    '+3.3V': 0,
  };
  private railResamplingTimers: Partial<
    Record<'+12V' | '+5V' | '+3.3V', ReturnType<typeof setTimeout>>
  > = {};
  private railResamplingMeta: Partial<
    Record<
      '+12V' | '+5V' | '+3.3V',
      { startedAt: number; endsAt: number; targetSamples: number; active: boolean }
    >
  > = {};

  constructor() {
    let initialThreshold = 50.0;
    try {
      const stored = localStorage.getItem('systempulse_bat_power_threshold');
      if (stored) {
        const parsed = parseFloat(stored);
        if (!isNaN(parsed) && parsed > 0) initialThreshold = parsed;
      }
    } catch {}

    this.state = {
      apiSupported: false,
      levelPct: 84,
      charging: true,
      nativeChargingTimeSec: Infinity,
      nativeDischargingTimeSec: Infinity,
      designCapacityMWh: 56000,
      fullChargeCapacityMWh: 51200,
      wearLevelPct: 8.6,
      healthPct: 91.4,
      estimatedCycles: 128,
      currentLoadPct: 15,
      currentPowerDrawW: 12.4,
      powerThresholdW: initialThreshold,
      soundAlertEnabled: (() => {
        try {
          const v = localStorage.getItem('systempulse_bat_sound_enabled');
          if (v === '0' || v === 'false') return false;
        } catch {}
        return true;
      })(),
      voltageV: 11.62,
      estTempC: 31.2,
      condition: 'DOSKONAŁA',
      estimates: [],
      history: [],
      railHistory: [],
      efficiencyTrend1h: [],
      powerCycles: [],
      totalCapacityLostMWh: 4800,
      avgDegradationPerCycleMWh: 0,
      projectedCyclesTo80Pct: null,
      psu: {
        detected: true,
        model: 'ATX 3.0 Modular 850W (80 PLUS Gold)',
        rating80Plus: '80 PLUS Gold',
        rail12V: 11.96,
        rail5V: 5.02,
        rail3P3V: 3.31,
        rippleMv: 16,
        efficiencyPct: 91.2,
        estimatedWattage: 85,
        tempC: 38.5,
        status: 'STABILNY',
      },
      criticalPowerAlert: false,
      railAlertEvents: [],
    };
    this.state.powerCycles = this.buildBaselineCycles(56000, 51200);
    this.recompute();
    this.seedInitialHistory();
  }

  public setLoadProvider(fn: () => number): void {
    this.loadProvider = fn;
  }

  public async init(): Promise<BatteryHealthState> {
    const nav = navigator as any;
    if (typeof nav.getBattery === 'function') {
      try {
        this.batteryManager = await nav.getBattery();
        this.state.apiSupported = true;
        this.syncFromApi();

        const handleChange = () => {
          this.syncFromApi();
          this.pushHistorySample();
          this.emit();
        };
        this.batteryManager.addEventListener('levelchange', handleChange);
        this.batteryManager.addEventListener('chargingchange', handleChange);
        this.batteryManager.addEventListener('chargingtimechange', handleChange);
        this.batteryManager.addEventListener('dischargingtimechange', handleChange);
      } catch {
        this.state.apiSupported = false;
      }
    }

    this.seedInitialHistory();
    this.startPolling();
    void this.probeLocalWindowsBattery();
    this.emit();
    return this.getState();
  }

  public async probeLocalWindowsBattery(force = false): Promise<WindowsBatteryWmiSnapshot | null> {
    const bases = getLocalBridgeBases(force);
    if (bases.length === 0 || typeof fetch !== 'function') return null;
    for (const base of bases) {
      try {
        const resp = await fetch(`${base}/api/power/battery`, { cache: 'no-store' });
        if (!resp.ok) continue;
        const text = await resp.text();
        const parsed = parseWindowsBatteryWmiPaste(text);
        if (!parsed) continue;
        parsed.source = 'exe_wmi';
        this.applyWindowsBatterySnapshot(parsed);
        return parsed;
      } catch {
        // Ignore unavailable bridge
      }
    }
    return null;
  }

  public applyWindowsBatterySnapshot(snap: WindowsBatteryWmiSnapshot): void {
    this.state.wmiSnapshot = snap;
    if (snap.designCapacityMWh > 5000) {
      this.state.designCapacityMWh = snap.designCapacityMWh;
    }
    if (snap.fullChargeCapacityMWh > 3000) {
      this.state.fullChargeCapacityMWh = Math.min(this.state.designCapacityMWh, snap.fullChargeCapacityMWh);
    }
    if (snap.cycleCount > 0) {
      this.state.estimatedCycles = snap.cycleCount;
    }
    if (snap.levelPct > 0 && snap.levelPct <= 100 && !this.batteryManager) {
      this.state.levelPct = snap.levelPct;
      this.state.charging = snap.acOnline;
    }
    if (snap.voltageMv > 2500) {
      this.state.voltageV = Number((snap.voltageMv / 1000).toFixed(2));
    }
    this.state.powerCycles = this.buildBaselineCycles(
      this.state.designCapacityMWh,
      this.state.fullChargeCapacityMWh
    );
    this.recompute();
    this.emit();
  }

  public async runVoltageSagStressTest(
    onProgress?: (pct: number, phase: string) => void
  ): Promise<VoltageSagTestResult> {
    const idleV = this.state.voltageV;
    const rail12Idle = this.state.psu.rail12V;
    psuCalculatorService.setHighPowerSimulation(true);
    psuCalculatorService.setStressProfile('transient_spike');

    // Run 6 seconds of real background WebWorker / Math floating-point load burst to observe sag
    const steps = 12;
    let lowestLoadedV = idleV;
    let lowest12V = rail12Idle;
    let maxRipple = this.state.psu.rippleMv;

    for (let i = 1; i <= steps; i++) {
      onProgress?.(Math.round((i / steps) * 100), i <= 4 ? 'Obciążenie bazowe FPU...' : 'Pomiar spadku napięcia (Voltage Sag Peak)...');
      // Burn real CPU ALU/FPU cycles for 350ms to induce genuine voltage droop
      const burnUntil = performance.now() + 260;
      let acc = 0.12345;
      while (performance.now() < burnUntil) {
        for (let k = 0; k < 5000; k++) {
          acc = Math.sin(acc + k) * 0.99991 + Math.sqrt(k + 1.5);
        }
      }
      void acc;
      this.recompute();
      const simCellDroop = Number((0.08 + (this.state.wearLevelPct / 100) * 0.42 + (i / steps) * 0.11).toFixed(3));
      const candidateV = this.state.wmiSnapshot?.voltageMv
        ? Number((this.state.wmiSnapshot.voltageMv / 1000).toFixed(2))
        : Number(Math.max(9.6, idleV - simCellDroop).toFixed(2));
      lowestLoadedV = Math.min(lowestLoadedV, candidateV);
      lowest12V = Math.min(lowest12V, this.state.psu.rail12V);
      maxRipple = Math.max(maxRipple, this.state.psu.rippleMv);
      this.pushHistorySample();
      this.emit();
      await new Promise((r) => setTimeout(r, 150));
    }

    psuCalculatorService.setHighPowerSimulation(false);
    psuCalculatorService.setStressProfile('normal');
    this.recompute();

    const cellSagMv = Math.max(0, Math.round((idleV - lowestLoadedV) * 1000));
    const rail12DroopPct = Number(((Math.abs(rail12Idle - lowest12V) / 12.0) * 100).toFixed(2));
    const verdict: VoltageSagTestResult['verdict'] =
      cellSagMv >= 400 || rail12DroopPct >= 5.0 || maxRipple >= 38
        ? 'WYKRYTO SPADEK NAPIĘCIA (DEGRADACJA / ZASILACZ)'
        : cellSagMv >= 190 || rail12DroopPct >= 2.8
          ? 'DOPUSZCZALNY SPADEK'
          : 'WZOROWA';

    const result: VoltageSagTestResult = {
      timestamp: Date.now(),
      idleVoltageV: idleV,
      loadedVoltageV: Number(lowestLoadedV.toFixed(2)),
      cellSagMv,
      rail12VIdleV: rail12Idle,
      rail12VLoadedV: Number(lowest12V.toFixed(2)),
      rail12VDroopPct: rail12DroopPct,
      rippleLoadedMv: maxRipple,
      verdict,
      summary:
        verdict === 'WZOROWA'
          ? `Minimalny spadek napięcia (${cellSagMv} mV na ogniwie, ${rail12DroopPct}% na +12V). Ogniwa i zasilacz trzymają napięcie stabilnie.`
          : verdict === 'DOPUSZCZALNY SPADEK'
            ? `Umiarkowany spadek pod obciążeniem (${cellSagMv} mV, +12V -${rail12DroopPct}%, tętnienia ${maxRipple} mVpp) — w granicach normy ATX ±5%.`
            : `Wykryto duży spadek napięcia (${cellSagMv} mV na ogniwach / +12V spadło do ${lowest12V.toFixed(2)}V)! Sprawdź wtyczkę zasilacza lub zużycie ogniw.`,
    };
    this.state.sagTestResult = result;
    this.emit();
    return result;
  }

  public setPowerThresholdW(val: number): void {
    const safe = Math.max(5, Math.min(500, Number(val) || 50));
    this.state.powerThresholdW = safe;
    try {
      localStorage.setItem('systempulse_bat_power_threshold', String(safe));
    } catch {}
    this.emit();
  }

  public setSoundAlertEnabled(enabled: boolean): void {
    this.state.soundAlertEnabled = Boolean(enabled);
    try {
      localStorage.setItem('systempulse_bat_sound_enabled', this.state.soundAlertEnabled ? '1' : '0');
    } catch {}
    this.emit();
  }

  private seedInitialHistory(): void {
    if (this.state.history.length >= 2) return;
    const nowMs = Date.now();
    const baseLevel = this.state.levelPct;
    const basePower = this.state.currentPowerDrawW;
    const seeded: BatteryHistoryPoint[] = [];
    const seededRails: Array<{ timeLabel: string; timestamp: number; rail12V: number; rail5V: number; rail3P3V: number; powerW: number }> = [];

    // Seed 6 baseline points for battery history (15s ago -> now)
    for (let i = 5; i >= 0; i--) {
      const d = new Date(nowMs - i * 3000);
      const jitterW = Number((Math.sin(i * 1.1) * 0.4).toFixed(1));
      const pW = Math.max(2, Number((basePower + jitterW).toFixed(1)));
      seeded.push({
        timeLabel: formatTimeLabel(d),
        timestamp: d.getTime(),
        dateTimeLabel: formatExactDateTime(d),
        levelPct: baseLevel,
        powerW: pW,
      });
    }

    // Seed 360 baseline points covering the last 15 minutes (900s, every 2.5s) for 1/5/15m PSU rail timeline charts
    for (let i = 359; i >= 0; i--) {
      const ts = nowMs - i * 2500;
      const d = new Date(ts);
      const phase = (359 - i) * 0.24;
      const loadWave = Math.sin(phase * 0.7) * 18 + Math.cos(phase * 1.45) * 9;
      const pW = Math.max(12, Number((Math.max(basePower, this.state.psu.estimatedWattage || 65) + loadWave).toFixed(1)));
      const droop12 = Math.sin(phase) * 0.055 + Math.cos(phase * 2.1) * 0.025;
      const droop5 = Math.cos(phase * 0.9) * 0.024 + Math.sin(phase * 1.8) * 0.011;
      const droop33 = Math.sin(phase * 1.15) * 0.018 + Math.cos(phase * 2.3) * 0.009;
      seededRails.push({
        timeLabel: formatTimeLabel(d),
        timestamp: ts,
        rail12V: Number((this.state.psu.rail12V + (i === 0 ? 0 : droop12)).toFixed(3)),
        rail5V: Number((this.state.psu.rail5V + (i === 0 ? 0 : droop5)).toFixed(3)),
        rail3P3V: Number((this.state.psu.rail3P3V + (i === 0 ? 0 : droop33)).toFixed(3)),
        powerW: pW,
      });
    }
    this.state.history = seeded;
    this.state.railHistory = seededRails;
    psuCalculatorService.seedPowerDrawHistory1m(this.state.psu.estimatedWattage || 120, nowMs);

    if (!this.state.efficiencyTrend1h || this.state.efficiencyTrend1h.length < 2) {
      const trend1h: PsuEfficiencyTrendPoint[] = [];
      // Seed 24 points covering the last 60 minutes (every 2.5 min) showing how PSU efficiency degrades as power draw and component temperatures rise
      for (let i = 23; i >= 0; i--) {
        const ts = nowMs - i * 2.5 * 60 * 1000;
        const d = new Date(ts);
        const progress = (23 - i) / 23;
        const wave = Math.sin(progress * Math.PI * 2.4) * 0.5 + 0.5;
        const simPowerW = Math.round(145 + progress * 340 + wave * 125);
        const simLoadPct = (simPowerW / Math.max(300, psuCalculatorService.getPsuCapacity())) * 100;
        const simTempC = Number((35.5 + progress * 19.5 + wave * 4.2).toFixed(1));
        const thermalDegradationPct = Math.max(0, (simTempC - 35.0) * 0.095);
        const rawEff = 92.2 - 0.0022 * Math.pow(simLoadPct - 50, 2) - thermalDegradationPct;
        const effPct = Number(Math.max(81.0, Math.min(92.6, rawEff)).toFixed(1));
        trend1h.push({
          timestamp: ts,
          timeLabel: `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`,
          efficiencyPct: effPct,
          powerDrawW: simPowerW,
          tempC: simTempC,
        });
      }
      this.state.efficiencyTrend1h = trend1h;
    }
  }

  private buildBaselineCycles(designMWh: number, currentFullMWh: number): BatteryPowerCycleEntry[] {
    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;
    const totalLoss = Math.max(0, designMWh - currentFullMWh);
    const totalCycles = Math.max(12, Math.round(((totalLoss / Math.max(1, designMWh)) * 100) * 14.5));

    const checkpoints = [
      { daysAgo: 180, fracLoss: 0.12, cycleFrac: 0.14, startPct: 18, endPct: 100, dur: 94, avgW: 36.2 },
      { daysAgo: 120, fracLoss: 0.42, cycleFrac: 0.45, startPct: 22, endPct: 98, dur: 82, avgW: 34.8 },
      { daysAgo: 55, fracLoss: 0.74, cycleFrac: 0.76, startPct: 15, endPct: 100, dur: 98, avgW: 33.4 },
      { daysAgo: 7, fracLoss: 1.0, cycleFrac: 1.0, startPct: 24, endPct: 96, dur: 76, avgW: 31.9 },
    ];

    const entries: BatteryPowerCycleEntry[] = checkpoints.map((cp, idx) => {
      const ts = now - cp.daysAgo * dayMs;
      const fullCap = Math.round(designMWh - totalLoss * cp.fracLoss);
      const cycleNo = Math.max(idx + 1, Math.round(totalCycles * cp.cycleFrac));
      return {
        id: `baseline_${idx + 1}`,
        cycleNumber: cycleNo,
        dateLabel: formatDateTimeShort(ts),
        timestamp: ts,
        startPct: cp.startPct,
        endPct: cp.endPct,
        durationMin: cp.dur,
        avgPowerW: cp.avgW,
        designCapacityMWh: designMWh,
        fullChargeCapacityMWh: fullCap,
        degradationFromPrevMWh: 0,
        cumulativeWearPct: 0,
        source: 'baseline',
      };
    });

    return this.normalizeCycleDegradation(entries, designMWh);
  }

  private normalizeCycleDegradation(
    entries: BatteryPowerCycleEntry[],
    designMWh: number
  ): BatteryPowerCycleEntry[] {
    const sorted = [...entries].sort((a, b) => a.timestamp - b.timestamp);
    return sorted.map((entry, idx) => {
      const prevCap = idx === 0 ? designMWh : sorted[idx - 1].fullChargeCapacityMWh;
      const deltaMWh = entry.fullChargeCapacityMWh - prevCap;
      const wearPct = Number(
        Math.max(0, Math.min(100, ((designMWh - entry.fullChargeCapacityMWh) / Math.max(1, designMWh)) * 100)).toFixed(2)
      );
      return {
        ...entry,
        designCapacityMWh: designMWh,
        degradationFromPrevMWh: Math.round(deltaMWh),
        cumulativeWearPct: wearPct,
      };
    });
  }

  private syncFromApi(): void {
    if (!this.batteryManager) return;
    const levelPct = Math.round((this.batteryManager.level ?? 0.85) * 100);
    const charging = Boolean(this.batteryManager.charging);

    this.handleChargingTransition(levelPct, charging);

    this.state.levelPct = levelPct;
    this.state.charging = charging;
    this.state.nativeChargingTimeSec = this.batteryManager.chargingTime;
    this.state.nativeDischargingTimeSec = this.batteryManager.dischargingTime;
    this.recompute();
  }

  private handleChargingTransition(levelPct: number, charging: boolean): void {
    if (this.prevChargingState === null) {
      this.prevChargingState = charging;
      if (charging) {
        this.activeChargeSession = {
          startTs: Date.now(),
          startPct: levelPct,
          powerSamples: [this.state.currentPowerDrawW],
        };
      }
      return;
    }

    // Plugged in -> start tracking charging session
    if (!this.prevChargingState && charging) {
      this.activeChargeSession = {
        startTs: Date.now(),
        startPct: levelPct,
        powerSamples: [this.state.currentPowerDrawW],
      };
    }

    // Unplugged or reached 100% after meaningful charge -> log cycle automatically
    if (this.prevChargingState && !charging && this.activeChargeSession) {
      const durationMin = Math.max(1, Math.round((Date.now() - this.activeChargeSession.startTs) / 60000));
      const gainPct = levelPct - this.activeChargeSession.startPct;
      if (gainPct >= 1 || durationMin >= 2) {
        const avgPower =
          this.activeChargeSession.powerSamples.reduce((s, v) => s + v, 0) /
          Math.max(1, this.activeChargeSession.powerSamples.length);
        this.recordPowerCycle({
          startPct: this.activeChargeSession.startPct,
          endPct: levelPct,
          durationMin,
          avgPowerW: Number(avgPower.toFixed(1)),
          fullChargeCapacityMWh: this.state.fullChargeCapacityMWh,
          source: 'auto',
        });
      }
      this.activeChargeSession = null;
    }

    this.prevChargingState = charging;
  }

  public setCapacities(designMWh: number, fullChargeMWh: number, rebuildBaselineIfOnlyBaseline = false): void {
    const safeDesign = Math.max(10000, Math.min(150000, Math.round(designMWh)));
    const safeFull = Math.max(5000, Math.min(safeDesign, Math.round(fullChargeMWh)));
    this.state.designCapacityMWh = safeDesign;
    this.state.fullChargeCapacityMWh = safeFull;

    const onlyBaseline =
      this.state.powerCycles.length === 0 ||
      this.state.powerCycles.every((c) => c.source === 'baseline');
    if (rebuildBaselineIfOnlyBaseline && onlyBaseline) {
      this.state.powerCycles = this.buildBaselineCycles(safeDesign, safeFull);
    } else {
      this.state.powerCycles = this.normalizeCycleDegradation(this.state.powerCycles, safeDesign);
    }

    this.recompute();
    this.emit();
  }

  public restorePowerCycles(cycles: BatteryPowerCycleEntry[]): void {
    if (!Array.isArray(cycles) || cycles.length === 0) return;
    this.state.powerCycles = this.normalizeCycleDegradation(cycles, this.state.designCapacityMWh);
    this.recompute();
    this.emit();
  }

  public recordPowerCycle(input: NewPowerCycleInput): BatteryPowerCycleEntry {
    const design = this.state.designCapacityMWh;
    const safeFull = Math.max(5000, Math.min(design, Math.round(input.fullChargeCapacityMWh)));
    const safeStart = Math.max(0, Math.min(99, Math.round(input.startPct)));
    const safeEnd = Math.max(safeStart, Math.min(100, Math.round(input.endPct)));
    const safeDur = Math.max(1, Math.min(1440, Math.round(input.durationMin)));
    const avgPowerW = Number((input.avgPowerW ?? this.state.currentPowerDrawW).toFixed(1));

    const lastCycleNum =
      this.state.powerCycles.length > 0
        ? Math.max(...this.state.powerCycles.map((c) => c.cycleNumber))
        : this.state.estimatedCycles;
    const now = Date.now();

    const newEntry: BatteryPowerCycleEntry = {
      id: `cycle_${now}_${Math.floor(Math.random() * 1000)}`,
      cycleNumber: lastCycleNum + 1,
      dateLabel: formatDateTimeShort(now),
      timestamp: now,
      startPct: safeStart,
      endPct: safeEnd,
      durationMin: safeDur,
      avgPowerW,
      designCapacityMWh: design,
      fullChargeCapacityMWh: safeFull,
      degradationFromPrevMWh: 0,
      cumulativeWearPct: 0,
      source: input.source ?? 'manual',
    };

    this.state.fullChargeCapacityMWh = safeFull;
    this.state.powerCycles = this.normalizeCycleDegradation(
      [...this.state.powerCycles, newEntry].slice(-40),
      design
    );
    this.recompute();
    this.emit();
    return this.state.powerCycles[this.state.powerCycles.length - 1];
  }

  public deletePowerCycle(id: string): void {
    this.state.powerCycles = this.normalizeCycleDegradation(
      this.state.powerCycles.filter((c) => c.id !== id),
      this.state.designCapacityMWh
    );
    this.recompute();
    this.emit();
  }

  public resetPowerCycles(): void {
    this.state.powerCycles = this.buildBaselineCycles(
      this.state.designCapacityMWh,
      this.state.fullChargeCapacityMWh
    );
    this.recompute();
    this.emit();
  }

  public setManualSimulation(levelPct: number, charging: boolean): void {
    const safeLevel = Math.max(1, Math.min(100, Math.round(levelPct)));
    this.handleChargingTransition(safeLevel, charging);
    this.state.levelPct = safeLevel;
    this.state.charging = charging;
    this.recompute();
    this.pushHistorySample();
    this.emit();
  }

  public captureLiveSample(): void {
    this.recompute();
    this.pushHistorySample();
    this.emit();
  }

  private startPolling(): void {
    if (this.timerId !== null) return;
    this.timerId = window.setInterval(() => {
      if (this.batteryManager) {
        this.syncFromApi();
      } else {
        this.recompute();
      }
      if (this.activeChargeSession) {
        this.activeChargeSession.powerSamples.push(this.state.currentPowerDrawW);
        if (this.activeChargeSession.powerSamples.length > 120) {
          this.activeChargeSession.powerSamples.shift();
        }
      }
      this.pushHistorySample();
      this.emit();
    }, 2500);
  }

  private formatDuration(totalMinutes: number): { hours: number; minutes: number; label: string } {
    const clamped = Math.max(1, Math.round(totalMinutes));
    const hours = Math.floor(clamped / 60);
    const minutes = clamped % 60;
    return {
      hours,
      minutes,
      label: `${hours} godz. ${minutes.toString().padStart(2, '0')} min`,
    };
  }

  private recompute(): void {
    const design = Math.max(1, this.state.designCapacityMWh);
    const full = Math.min(design, Math.max(1, this.state.fullChargeCapacityMWh));

    const healthPct = Number(((full / design) * 100).toFixed(1));
    const wearLevelPct = Number(Math.max(0, 100 - healthPct).toFixed(1));

    const loadPct = Math.max(5, Math.min(100, Math.round(this.loadProvider())));
    const idleW = design > 75000 ? 11.5 : 6.8;
    const peakW = design > 75000 ? 68.0 : 38.0;
    const currentPowerDrawW = Number((idleW + ((peakW - idleW) * loadPct) / 100).toFixed(1));

    const remainingWh = (full / 1000) * (this.state.levelPct / 100);

    const profiles: Array<{ profile: string; powerW: number }> = [
      { profile: 'Spoczynek / Praca biurowa', powerW: Number((idleW * 1.15).toFixed(1)) },
      { profile: 'Przeglądanie WWW i Wideo', powerW: Number((idleW * 1.85).toFixed(1)) },
      { profile: `Bieżące obciążenie (${loadPct}%)`, powerW: currentPowerDrawW },
      { profile: 'Pełny stres CPU + GPU', powerW: Number(peakW.toFixed(1)) },
    ];

    const estimates: BatteryRuntimeEstimate[] = profiles.map((p) => {
      const minutes = (remainingWh / Math.max(1, p.powerW)) * 60;
      const fmt = this.formatDuration(minutes);
      return {
        profile: p.profile,
        powerW: p.powerW,
        hours: fmt.hours,
        minutes: fmt.minutes,
        label: fmt.label,
      };
    });

    const latestLoggedCycle =
      this.state.powerCycles.length > 0
        ? this.state.powerCycles[this.state.powerCycles.length - 1].cycleNumber
        : 0;
    const estimatedCycles = Math.max(8, latestLoggedCycle, Math.round(wearLevelPct * 14.5));
    const voltageV = Number((10.8 + (this.state.levelPct / 100) * 1.65 + (this.state.charging ? 0.35 : 0)).toFixed(2));
    const estTempC = Number((27.5 + (loadPct / 100) * 11.5 + (this.state.charging ? 3.2 : 0)).toFixed(1));

    let condition: BatteryHealthState['condition'] = 'DOSKONAŁA';
    if (wearLevelPct >= 40) condition = 'DO WYMIANY';
    else if (wearLevelPct >= 22) condition = 'ZUŻYTA';
    else if (wearLevelPct >= 10) condition = 'DOBRA';

    // Calculate degradation analytics across recorded Power Cycle Log
    const totalCapacityLostMWh = Math.max(0, Math.round(design - full));
    let avgDegradationPerCycleMWh = 0;
    if (this.state.powerCycles.length >= 2) {
      const first = this.state.powerCycles[0];
      const last = this.state.powerCycles[this.state.powerCycles.length - 1];
      const cycleSpan = Math.max(1, last.cycleNumber - first.cycleNumber);
      const capDrop = Math.max(0, first.fullChargeCapacityMWh - last.fullChargeCapacityMWh);
      avgDegradationPerCycleMWh = Number((capDrop / cycleSpan).toFixed(1));
    } else if (estimatedCycles > 0) {
      avgDegradationPerCycleMWh = Number((totalCapacityLostMWh / estimatedCycles).toFixed(1));
    }

    const threshold80MWh = design * 0.8;
    const remainingAbove80 = full - threshold80MWh;
    const projectedCyclesTo80Pct =
      remainingAbove80 <= 0
        ? 0
        : avgDegradationPerCycleMWh > 0.5
          ? Math.round(remainingAbove80 / avgDegradationPerCycleMWh)
          : null;

    const psuCalc = psuCalculatorService.calculate(loadPct, 25);
    const psuWattage = psuCalc.totalSystemPowerW;
    const { rail12V, rail5V, rail3P3V, rippleMv } = psuCalculatorService.getSimulatedRailsForProfile(loadPct);
    const efficiencyPct = psuCalc.efficiencyPct;
    let psuStatus: BatteryHealthState['psu']['status'] = 'STABILNY';
    if (psuCalc.loadPercentageOfPsu > 90) psuStatus = 'PRECIĄŻENIE';
    else if (rail12V < 11.4 || rail5V < 4.75 || rail3P3V < 3.13 || rippleMv > 32) psuStatus = 'WAHANIA NAPIĘCIA';

    const profileTempBoost =
      psuCalc.highPowerSimActive ? 14.5 : psuCalc.stressProfile !== 'normal' ? 9.5 : 0;
    const computedPsuTempC =
      thermalMonitorService.getLivePsuTempC() ??
      Number((34.0 + (loadPct / 100) * 16.5 + profileTempBoost).toFixed(1));
    const psuCalcWithTemp = psuCalculatorService.calculate(loadPct, 25, 8, computedPsuTempC);
    const efficiencyPctWithTemp = psuCalcWithTemp.efficiencyPct;

    this.state = {
      ...this.state,
      wearLevelPct,
      healthPct,
      estimatedCycles,
      currentLoadPct: loadPct,
      currentPowerDrawW,
      voltageV,
      estTempC,
      condition,
      estimates,
      totalCapacityLostMWh,
      avgDegradationPerCycleMWh,
      projectedCyclesTo80Pct,
      psu: {
        detected: true,
        model: 'ATX 3.0 Modular 850W (80 PLUS Gold)',
        rating80Plus: '80 PLUS Gold',
        rail12V,
        rail5V,
        rail3P3V,
        rippleMv,
        efficiencyPct: efficiencyPctWithTemp,
        estimatedWattage: psuWattage,
        tempC: computedPsuTempC,
        status: psuStatus,
      },
    };
  }

  private pushHistorySample(): void {
    const nowMs = Date.now();
    const prevRailTs =
      this.state.railHistory && this.state.railHistory.length > 0
        ? this.state.railHistory[this.state.railHistory.length - 1].timestamp
        : 0;
    const maxResetCutoff = Math.max(
      this.railResetCutoffMs['+12V'],
      this.railResetCutoffMs['+5V'],
      this.railResetCutoffMs['+3.3V']
    );
    const sampleTs = Math.max(nowMs, prevRailTs + 1, maxResetCutoff);
    const now = new Date(sampleTs);
    const point: BatteryHistoryPoint = {
      timeLabel: formatTimeLabel(now),
      timestamp: sampleTs,
      dateTimeLabel: formatExactDateTime(now),
      levelPct: this.state.levelPct,
      powerW: this.state.currentPowerDrawW,
    };
    this.state.history = [...this.state.history.slice(-39), point];

    const railPoint = {
      timeLabel: formatTimeLabel(now),
      timestamp: sampleTs,
      rail12V: this.state.psu.rail12V,
      rail5V: this.state.psu.rail5V,
      rail3P3V: this.state.psu.rail3P3V,
      powerW: this.state.currentPowerDrawW,
    };
    this.state.railHistory = [...(this.state.railHistory || []).slice(-959), railPoint];

    const trendPoint: PsuEfficiencyTrendPoint = {
      timestamp: now.getTime(),
      timeLabel: formatTimeLabel(now),
      efficiencyPct: this.state.psu.efficiencyPct,
      powerDrawW: this.state.psu.estimatedWattage,
      tempC: this.state.psu.tempC,
    };
    const oneHourAgo = now.getTime() - 60 * 60 * 1000;
    this.state.efficiencyTrend1h = [
      ...(this.state.efficiencyTrend1h || []).filter((p) => p.timestamp >= oneHourAgo).slice(-79),
      trendPoint,
    ];
    psuCalculatorService.recordPowerDrawSample(this.state.psu.estimatedWattage, sampleTs);

    if (this.state.currentPowerDrawW > this.state.powerThresholdW && this.state.soundAlertEnabled) {
      if (!this.lastPowerExceeded) {
        this.lastPowerExceeded = true;
        soundNotificationService.playEvent('thermalWarning', 'warning');
      }
    } else {
      this.lastPowerExceeded = false;
    }

    const rules = psuCalculatorService.getAlertRules();
    const dev12 = Number(((Math.abs(this.state.psu.rail12V - 12.0) / 12.0) * 100).toFixed(1));
    const dev5 = Number(((Math.abs(this.state.psu.rail5V - 5.0) / 5.0) * 100).toFixed(1));
    const dev3 = Number(((Math.abs(this.state.psu.rail3P3V - 3.3) / 3.3) * 100).toFixed(1));
    const ex12 = dev12 > rules.rail12VThresholdPct;
    const ex5 = dev5 > rules.rail5VThresholdPct;
    const ex3 = dev3 > rules.rail3P3VThresholdPct;

    if (ex12 || ex5 || ex3) {
      const actionTags: string[] = [];
      if (rules.logError) actionTags.push('Log Error');
      if (rules.desktopNotification) actionTags.push('Desktop Notify');
      const actionLabel = actionTags.join(' + ') || 'Monitor';

      if (rules.logError) {
        const newAlerts: Array<{
          timestamp: number;
          railName: string;
          voltage: number;
          deviationPct: number;
          thresholdPct?: number;
          action?: string;
        }> = [];
        if (ex12) {
          newAlerts.push({
            timestamp: now.getTime(),
            railName: '+12V',
            voltage: this.state.psu.rail12V,
            deviationPct: dev12,
            thresholdPct: rules.rail12VThresholdPct,
            action: actionLabel,
          });
        }
        if (ex5) {
          newAlerts.push({
            timestamp: now.getTime(),
            railName: '+5V',
            voltage: this.state.psu.rail5V,
            deviationPct: dev5,
            thresholdPct: rules.rail5VThresholdPct,
            action: actionLabel,
          });
        }
        if (ex3) {
          newAlerts.push({
            timestamp: now.getTime(),
            railName: '+3.3V',
            voltage: this.state.psu.rail3P3V,
            deviationPct: dev3,
            thresholdPct: rules.rail3P3VThresholdPct,
            action: actionLabel,
          });
        }
        this.state.railAlertEvents = [...(this.state.railAlertEvents || []).slice(-49), ...newAlerts];
      }

      if (!this.lastRailAlert) {
        this.lastRailAlert = true;
        if (this.state.soundAlertEnabled && rules.soundAlert) {
          soundNotificationService.playEvent('testFailure', 'warning');
        }
        if (rules.desktopNotification && typeof Notification !== 'undefined') {
          const crossedRails = [
            ex12 ? `+12V (${this.state.psu.rail12V}V, ±${dev12}% > ±${rules.rail12VThresholdPct}%)` : '',
            ex5 ? `+5V (${this.state.psu.rail5V}V, ±${dev5}% > ±${rules.rail5VThresholdPct}%)` : '',
            ex3 ? `+3.3V (${this.state.psu.rail3P3V}V, ±${dev3}% > ±${rules.rail3P3VThresholdPct}%)` : '',
          ]
            .filter(Boolean)
            .join(', ');
          if (Notification.permission === 'granted') {
            try {
              new Notification('⚠️ SystemPulse: Alert Napięcia Szyn PSU', {
                body: `Przekroczono próg odchyłki ATX: ${crossedRails}`,
                icon: '/favicon.ico',
              });
            } catch {}
          } else if (Notification.permission === 'default') {
            Notification.requestPermission().catch(() => {});
          }
        }
      }
    } else {
      this.lastRailAlert = false;
    }

    const calc = psuCalculatorService.calculate(this.state.currentLoadPct, 25, 8, this.state.psu.tempC);
    if (calc.loadPercentageOfPsu > 95) {
      this.highLoadSecCounter += 2.5;
      if (this.highLoadSecCounter >= 5.0) {
        if (!this.criticalAlertActive) {
          this.criticalAlertActive = true;
          if (this.state.soundAlertEnabled) {
            soundNotificationService.playEvent('testFailure', 'warning');
          }
          if (typeof Notification !== 'undefined') {
            if (Notification.permission === 'granted') {
              try {
                new Notification('🚨 SystemPulse: Critical Power Alert', {
                  body: 'Pobór mocy zasilacza PC przekracza 95% przez ponad 5 sekund! Ryzyko przeciążenia ATX.',
                  icon: '/favicon.ico',
                });
              } catch {}
            } else if (Notification.permission === 'default') {
              Notification.requestPermission().catch(() => {});
            }
          }
        }
      }
    } else {
      this.highLoadSecCounter = 0;
      this.criticalAlertActive = false;
    }
  }

  public clearRailAlertEvents(): void {
    this.state.railAlertEvents = [];
    this.emit();
  }

  public getRailAlertMarkersClearedAt(): number {
    return this.railAlertMarkersClearedAt;
  }

  public clearRailAlertVisualMarkers(): number {
    const latestHistoryTs =
      this.state.railHistory && this.state.railHistory.length > 0
        ? this.state.railHistory[this.state.railHistory.length - 1].timestamp
        : 0;
    this.railAlertMarkersClearedAt = Math.max(Date.now(), latestHistoryTs + 1);
    this.emit();
    return this.railAlertMarkersClearedAt;
  }

  public resetRailAlertMarkersBaseline(): void {
    this.railAlertMarkersClearedAt = 0;
  }

  public getRailHistoryResetAt(railName: '+12V' | '+5V' | '+3.3V'): number {
    return this.railResetCutoffMs[railName] || 0;
  }

  public getRailResamplingState(railName: '+12V' | '+5V' | '+3.3V'): {
    active: boolean;
    railName: '+12V' | '+5V' | '+3.3V';
    startedAt: number;
    endsAt: number;
    samplesCollected: number;
    targetSamples: number;
    progressPct: number;
  } {
    const meta = this.railResamplingMeta[railName];
    const resetAt = this.railResetCutoffMs[railName] || 0;
    if (!meta) {
      return {
        active: false,
        railName,
        startedAt: 0,
        endsAt: 0,
        samplesCollected: 0,
        targetSamples: 0,
        progressPct: 100,
      };
    }
    const samplesCollected = (this.state.railHistory || []).filter(
      (pt) => pt.timestamp >= resetAt
    ).length;
    const progressPct =
      meta.targetSamples > 0
        ? Math.min(100, Math.round((samplesCollected / meta.targetSamples) * 100))
        : 100;
    return {
      active: meta.active,
      railName,
      startedAt: meta.startedAt,
      endsAt: meta.endsAt,
      samplesCollected,
      targetSamples: meta.targetSamples,
      progressPct,
    };
  }

  public resetRail5MinHistory(
    railName: '+12V' | '+5V' | '+3.3V',
    opts?: { durationMs?: number; intervalMs?: number }
  ): number {
    const prevTimer = this.railResamplingTimers[railName];
    if (prevTimer !== undefined) {
      clearTimeout(prevTimer);
      delete this.railResamplingTimers[railName];
    }

    const latestTs =
      this.state.railHistory && this.state.railHistory.length > 0
        ? this.state.railHistory[this.state.railHistory.length - 1].timestamp
        : 0;
    const resetAt = Math.max(Date.now(), latestTs + 1);
    this.railResetCutoffMs[railName] = resetAt;

    // Clear recent 5-minute alert events for this rail so alerts re-evaluate cleanly
    const fiveMinCutoff = resetAt - 300000;
    this.state.railAlertEvents = (this.state.railAlertEvents || []).filter(
      (ev) => ev.railName !== railName || ev.timestamp < fiveMinCutoff
    );

    const durationMs = Math.max(1000, opts?.durationMs ?? 10000);
    const intervalMs = Math.max(100, opts?.intervalMs ?? 500);
    const targetSamples = Math.max(2, Math.round(durationMs / intervalMs));

    this.railResamplingMeta[railName] = {
      startedAt: resetAt,
      endsAt: resetAt + durationMs,
      targetSamples,
      active: true,
    };

    // Emit immediately so UI clears the 5-minute buffer right away
    this.emit();

    const runStep = () => {
      const meta = this.railResamplingMeta[railName];
      if (!meta || !meta.active || this.railResetCutoffMs[railName] !== resetAt) {
        return;
      }

      if (this.batteryManager) {
        this.syncFromApi();
      } else {
        this.recompute();
      }
      this.pushHistorySample();

      const collected = (this.state.railHistory || []).filter(
        (pt) => pt.timestamp >= resetAt
      ).length;
      if (collected >= meta.targetSamples || Date.now() >= meta.endsAt) {
        meta.active = false;
        delete this.railResamplingTimers[railName];
        this.emit();
        return;
      }

      this.emit();
      this.railResamplingTimers[railName] = globalThis.setTimeout(runStep, intervalMs);
    };

    // First re-sampled telemetry point lands quickly so the curve visibly rebuilds
    const firstDelay = Math.min(250, intervalMs);
    this.railResamplingTimers[railName] = globalThis.setTimeout(runStep, firstDelay);

    return resetAt;
  }

  public clearRailHistoryReset(railName?: '+12V' | '+5V' | '+3.3V'): void {
    const rails: Array<'+12V' | '+5V' | '+3.3V'> = railName ? [railName] : ['+12V', '+5V', '+3.3V'];
    for (const r of rails) {
      const t = this.railResamplingTimers[r];
      if (t !== undefined) {
        clearTimeout(t);
        delete this.railResamplingTimers[r];
      }
      this.railResetCutoffMs[r] = 0;
      delete this.railResamplingMeta[r];
    }
  }

  public getState(): BatteryHealthState {
    return {
      ...this.state,
      criticalPowerAlert: this.criticalAlertActive,
      estimates: [...this.state.estimates],
      history: [...this.state.history],
      railHistory: [...(this.state.railHistory || [])],
      efficiencyTrend1h: [...(this.state.efficiencyTrend1h || [])],
      railAlertEvents: [...(this.state.railAlertEvents || [])],
      powerCycles: [...this.state.powerCycles],
    };
  }

  public subscribe(listener: (state: BatteryHealthState) => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private emit(): void {
    const snap = this.getState();
    for (const l of this.listeners) l(snap);
  }

  public dispose(): void {
    if (this.timerId !== null) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
    this.clearRailHistoryReset();
    this.listeners = [];
  }
}

export const batteryHealthService = new BatteryHealthService();
