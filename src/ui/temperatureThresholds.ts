import type { SoundPreset } from '../services/soundNotification.service';

export const TEMP_THRESHOLDS_STORAGE_KEY = 'systempulse_temp_thresholds_v1';

export type TempSensorKey = 'cpu' | 'gpu' | 'psu';

export interface SensorTempThresholdConfig {
  enabled: boolean;
  thresholdC: number;
  soundPreset: SoundPreset;
}

export interface TemperatureThresholdSettings {
  cpu: SensorTempThresholdConfig;
  gpu: SensorTempThresholdConfig;
  psu: SensorTempThresholdConfig;
  cooldownSec: number;
}

export interface TemperatureSensorReadings {
  cpuTempC: number | null;
  gpuTempC: number | null;
  psuTempC: number | null;
}

export interface TemperatureAlertRuntimeState {
  lastTriggeredAt: Record<TempSensorKey, number>;
  exceededLatched: Record<TempSensorKey, boolean>;
}

export type SensorThresholdStatus = 'ok' | 'exceeded' | 'disabled' | 'no_sensor';

export interface SensorThresholdEvalItem {
  sensor: TempSensorKey;
  label: string;
  currentTempC: number | null;
  thresholdC: number;
  enabled: boolean;
  soundPreset: SoundPreset;
  status: SensorThresholdStatus;
  deltaC: number | null;
  fillPct: number;
}

export interface TriggeredTemperatureAlert {
  sensor: TempSensorKey;
  label: string;
  tempC: number;
  thresholdC: number;
  soundPreset: SoundPreset;
}

export interface TemperatureThresholdEvaluation {
  sensors: Record<TempSensorKey, SensorThresholdEvalItem>;
  exceededCount: number;
  newlyTriggered: TriggeredTemperatureAlert[];
}

export const TEMP_SENSOR_META: Record<
  TempSensorKey,
  {
    label: string;
    shortLabel: string;
    minC: number;
    maxC: number;
    defaultC: number;
    defaultSound: SoundPreset;
    quickPresetsC: number[];
    sourceHint: string;
  }
> = {
  cpu: {
    label: 'Procesor (CPU)',
    shortLabel: 'CPU',
    minC: 40,
    maxC: 115,
    defaultC: 85,
    defaultSound: 'beep',
    quickPresetsC: [75, 85, 95],
    sourceHint: 'Czujnik LIVE (LibreHardwareMonitor / HWiNFO64)',
  },
  gpu: {
    label: 'Karta graficzna (GPU)',
    shortLabel: 'GPU',
    minC: 40,
    maxC: 115,
    defaultC: 82,
    defaultSound: 'pulse',
    quickPresetsC: [75, 82, 90],
    sourceHint: 'Czujnik LIVE (LibreHardwareMonitor / HWiNFO64 / nvidia-smi)',
  },
  psu: {
    label: 'Zasilacz PC (PSU)',
    shortLabel: 'PSU',
    minC: 30,
    maxC: 95,
    defaultC: 55,
    defaultSound: 'chime',
    quickPresetsC: [45, 55, 65],
    sourceHint: 'Telemetria wewnętrzna zasilacza ATX / PSU',
  },
};

const VALID_SOUND_PRESETS = new Set<SoundPreset>(['harmonic', 'chime', 'beep', 'pulse', 'custom']);
const HYSTERESIS_DROP_C = 2;

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function clampSensorThresholdC(sensor: TempSensorKey, tempC: number): number {
  const meta = TEMP_SENSOR_META[sensor];
  if (!Number.isFinite(tempC)) return meta.defaultC;
  return Math.max(meta.minC, Math.min(meta.maxC, Math.round(tempC)));
}

export function getDefaultTemperatureThresholds(): TemperatureThresholdSettings {
  return {
    cpu: {
      enabled: true,
      thresholdC: TEMP_SENSOR_META.cpu.defaultC,
      soundPreset: TEMP_SENSOR_META.cpu.defaultSound,
    },
    gpu: {
      enabled: true,
      thresholdC: TEMP_SENSOR_META.gpu.defaultC,
      soundPreset: TEMP_SENSOR_META.gpu.defaultSound,
    },
    psu: {
      enabled: true,
      thresholdC: TEMP_SENSOR_META.psu.defaultC,
      soundPreset: TEMP_SENSOR_META.psu.defaultSound,
    },
    cooldownSec: 15,
  };
}

export function createTemperatureAlertRuntimeState(): TemperatureAlertRuntimeState {
  return {
    lastTriggeredAt: { cpu: 0, gpu: 0, psu: 0 },
    exceededLatched: { cpu: false, gpu: false, psu: false },
  };
}

export function loadTemperatureThresholds(): TemperatureThresholdSettings {
  const defaults = getDefaultTemperatureThresholds();
  try {
    if (typeof localStorage === 'undefined') return defaults;
    const raw = localStorage.getItem(TEMP_THRESHOLDS_STORAGE_KEY);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw) as Partial<TemperatureThresholdSettings>;
    const result: TemperatureThresholdSettings = {
      cpu: { ...defaults.cpu },
      gpu: { ...defaults.gpu },
      psu: { ...defaults.psu },
      cooldownSec:
        typeof parsed.cooldownSec === 'number' && Number.isFinite(parsed.cooldownSec)
          ? Math.max(5, Math.min(120, Math.round(parsed.cooldownSec)))
          : defaults.cooldownSec,
    };

    (['cpu', 'gpu', 'psu'] as TempSensorKey[]).forEach((key) => {
      const src = parsed[key];
      if (!src) return;
      result[key] = {
        enabled: typeof src.enabled === 'boolean' ? src.enabled : defaults[key].enabled,
        thresholdC: clampSensorThresholdC(key, Number(src.thresholdC)),
        soundPreset: VALID_SOUND_PRESETS.has(src.soundPreset)
          ? src.soundPreset
          : defaults[key].soundPreset,
      };
    });
    return result;
  } catch {
    return defaults;
  }
}

export function saveTemperatureThresholds(settings: TemperatureThresholdSettings): void {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(TEMP_THRESHOLDS_STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Ignore storage restrictions
  }
}

export function evaluateTemperatureThresholds(
  readings: TemperatureSensorReadings,
  settings: TemperatureThresholdSettings,
  runtime: TemperatureAlertRuntimeState,
  nowMs = Date.now()
): TemperatureThresholdEvaluation {
  const readingMap: Record<TempSensorKey, number | null> = {
    cpu:
      typeof readings.cpuTempC === 'number' && Number.isFinite(readings.cpuTempC) && readings.cpuTempC > 0
        ? Number(readings.cpuTempC.toFixed(1))
        : null,
    gpu:
      typeof readings.gpuTempC === 'number' && Number.isFinite(readings.gpuTempC) && readings.gpuTempC > 0
        ? Number(readings.gpuTempC.toFixed(1))
        : null,
    psu:
      typeof readings.psuTempC === 'number' && Number.isFinite(readings.psuTempC) && readings.psuTempC > 0
        ? Number(readings.psuTempC.toFixed(1))
        : null,
  };

  const sensors = {} as Record<TempSensorKey, SensorThresholdEvalItem>;
  const newlyTriggered: TriggeredTemperatureAlert[] = [];
  let exceededCount = 0;
  const cooldownMs = Math.max(5, settings.cooldownSec) * 1000;

  (['cpu', 'gpu', 'psu'] as TempSensorKey[]).forEach((key) => {
    const cfg = settings[key];
    const meta = TEMP_SENSOR_META[key];
    const currentTempC = readingMap[key];
    const thresholdC = clampSensorThresholdC(key, cfg.thresholdC);

    let status: SensorThresholdStatus = 'ok';
    let deltaC: number | null = null;
    let fillPct = 0;

    if (!cfg.enabled) {
      status = 'disabled';
      runtime.exceededLatched[key] = false;
      if (currentTempC !== null) {
        fillPct = Math.max(0, Math.min(100, Math.round((currentTempC / thresholdC) * 100)));
      }
    } else if (currentTempC === null) {
      status = 'no_sensor';
      runtime.exceededLatched[key] = false;
    } else {
      deltaC = Number((currentTempC - thresholdC).toFixed(1));
      fillPct = Math.max(0, Math.min(100, Math.round((currentTempC / thresholdC) * 100)));

      if (currentTempC >= thresholdC) {
        status = 'exceeded';
        exceededCount++;
        const elapsedSinceLast = nowMs - (runtime.lastTriggeredAt[key] || 0);
        const shouldFire = !runtime.exceededLatched[key] || elapsedSinceLast >= cooldownMs;
        if (shouldFire) {
          runtime.lastTriggeredAt[key] = nowMs;
          runtime.exceededLatched[key] = true;
          newlyTriggered.push({
            sensor: key,
            label: meta.label,
            tempC: currentTempC,
            thresholdC,
            soundPreset: cfg.soundPreset,
          });
        }
      } else {
        status = 'ok';
        if (currentTempC <= thresholdC - HYSTERESIS_DROP_C) {
          runtime.exceededLatched[key] = false;
        }
      }
    }

    sensors[key] = {
      sensor: key,
      label: meta.label,
      currentTempC,
      thresholdC,
      enabled: cfg.enabled,
      soundPreset: cfg.soundPreset,
      status,
      deltaC,
      fillPct,
    };
  });

  return {
    sensors,
    exceededCount,
    newlyTriggered,
  };
}

export function renderTemperatureThresholdsPanelHtml(
  settings: TemperatureThresholdSettings,
  evaluation: TemperatureThresholdEvaluation,
  customAudioName: string | null
): string {
  const badgeHtml =
    evaluation.exceededCount > 0
      ? `<span class="font-mono status-err" style="padding:3px 9px;border-radius:999px;background:rgba(244,63,94,0.16);border:1px solid rgba(244,63,94,0.5);font-size:11.5px;font-weight:700;">⚠ PRZEKROCZENIE PROGU (${evaluation.exceededCount})</span>`
      : `<span class="font-mono status-ok" style="padding:3px 9px;border-radius:999px;background:rgba(16,185,129,0.14);border:1px solid rgba(16,185,129,0.4);font-size:11.5px;font-weight:600;">✓ Czujniki w normie</span>`;

  const customOptLabel = customAudioName
    ? `Własny dźwięk (${customAudioName})`
    : 'Własny dźwięk (najpierw wgraj/nagraj w System Alerts)';

  return `
    <div class="panel stack-md" id="dash-temp-thresholds-panel">
      <div class="panel-header" style="margin-bottom:0;flex-wrap:wrap;gap:10px;">
        <div>
          <h2 class="panel-title">Progi ostrzegawcze temperatur (CPU / GPU / PSU — °C)</h2>
          <span class="panel-caption">
            Ustaw własne limity temperatur w °C dla CPU, GPU i zasilacza PSU oraz wybierz sygnał dźwiękowy uruchamiany automatycznie po przekroczeniu progu
          </span>
        </div>
        <div class="row-wrap" style="gap:8px;align-items:center;">
          ${badgeHtml}
          <select id="temp-thresh-cooldown" class="field-input" style="width:auto;padding:5px 8px;font-size:12px;" title="Minimalny odstęp między kolejnymi alarmami dźwiękowymi dla tego samego czujnika">
            ${[5, 15, 30, 60]
              .map(
                (sec) =>
                  `<option value="${sec}" ${settings.cooldownSec === sec ? 'selected' : ''}>Odstęp alarmu: ${sec}s</option>`
              )
              .join('')}
          </select>
          <button type="button" class="btn btn-secondary btn-sm" id="temp-thresh-reset-btn">
            Domyślne progi
          </button>
        </div>
      </div>

      <div class="grid-3" style="gap:12px;">
        ${(['cpu', 'gpu', 'psu'] as TempSensorKey[])
          .map((key) => {
            const meta = TEMP_SENSOR_META[key];
            const cfg = settings[key];
            const ev = evaluation.sensors[key];
            const exceeded = ev.status === 'exceeded';
            const valueCls = exceeded
              ? 'status-err'
              : ev.status === 'ok'
                ? 'status-ok'
                : 'status-cyan';
            const barColor = exceeded
              ? '#f43f5e'
              : ev.fillPct >= 85
                ? '#f59e0b'
                : '#10b981';

            const statusNote =
              ev.status === 'disabled'
                ? 'Monitor progu wyłączony'
                : ev.status === 'no_sensor'
                  ? 'Brak aktywnego czujnika LIVE °C (podłącz HWiNFO64 / LHM powyżej)'
                  : exceeded
                    ? `⚠ PRZEKROCZONO o +${Math.abs(ev.deltaC ?? 0).toFixed(1)} °C powyżej progu ${ev.thresholdC} °C`
                    : `Zapas termiczny: ${Math.abs(ev.deltaC ?? 0).toFixed(1)} °C poniżej progu ${ev.thresholdC} °C`;

            return `
              <div class="metric-card ${exceeded ? 'temp-threshold-exceeded' : ''}" data-temp-sensor-card="${key}">
                <div class="row-between" style="align-items:center;gap:8px;">
                  <label class="row-wrap" style="gap:6px;cursor:pointer;">
                    <input type="checkbox" data-temp-thresh-enabled="${key}" ${cfg.enabled ? 'checked' : ''} />
                    <span class="metric-label" style="font-weight:700;color:var(--text-primary);">${esc(meta.label)}</span>
                  </label>
                  <button type="button" class="btn btn-secondary btn-sm" style="padding:2px 8px;font-size:11px;" data-temp-thresh-test="${key}" title="Odtwórz wybrany dźwięk alarmu dla ${esc(meta.shortLabel)}">
                    Test dźwięku
                  </button>
                </div>

                <div class="row-between" style="align-items:baseline;margin-top:2px;">
                  <div class="metric-row">
                    <span class="metric-value ${valueCls}" style="font-size:22px;" data-metric-key="temp-thresh-live-${key}" data-metric-target="${ev.currentTempC ?? 0}" data-metric-decimals="1">
                      ${ev.currentTempC !== null ? ev.currentTempC.toFixed(1) : '—'}
                    </span>
                    <span class="metric-unit">°C / próg <strong class="font-mono" style="color:var(--text-primary);">${cfg.thresholdC}°C</strong></span>
                  </div>
                </div>

                <div style="width:100%;height:6px;border-radius:999px;background:rgba(148,163,184,0.16);overflow:hidden;">
                  <div style="width:${ev.fillPct}%;height:100%;background:${barColor};transition:width 260ms ease, background-color 260ms ease;"></div>
                </div>

                <div style="font-size:11px;color:${exceeded ? '#fda4af' : 'var(--text-muted)'};font-weight:${exceeded ? '600' : '400'};">
                  ${esc(statusNote)}
                </div>

                <div class="row-wrap" style="gap:8px;align-items:center;margin-top:4px;">
                  <input
                    type="range"
                    min="${meta.minC}"
                    max="${meta.maxC}"
                    step="1"
                    value="${cfg.thresholdC}"
                    data-temp-thresh-range="${key}"
                    aria-label="Próg temperatury ${esc(meta.shortLabel)} w °C"
                    style="flex:1;accent-color:${exceeded ? '#f43f5e' : '#06b6d4'};"
                    ${!cfg.enabled ? 'disabled' : ''}
                  />
                  <input
                    type="number"
                    min="${meta.minC}"
                    max="${meta.maxC}"
                    step="1"
                    value="${cfg.thresholdC}"
                    data-temp-thresh-input="${key}"
                    class="field-input font-mono"
                    style="width:66px;padding:4px 6px;font-size:12px;text-align:right;"
                    ${!cfg.enabled ? 'disabled' : ''}
                  />
                  <span class="font-mono" style="font-size:11.5px;color:var(--text-muted);">°C</span>
                </div>

                <div class="row-wrap" style="gap:4px;">
                  ${meta.quickPresetsC
                    .map(
                      (p) =>
                        `<button type="button" class="btn btn-sm ${cfg.thresholdC === p ? 'btn-primary' : 'btn-secondary'}" style="padding:2px 7px;font-size:10.5px;" data-temp-thresh-quick="${key}:${p}" ${!cfg.enabled ? 'disabled' : ''}>${p}°C</button>`
                    )
                    .join('')}
                </div>

                <div class="field-group" style="margin-top:4px;margin-bottom:0;">
                  <label class="field-label" style="font-size:11px;">Dźwięk alarmu po przekroczeniu</label>
                  <select class="field-input" style="font-size:11.5px;padding:4px 8px;" data-temp-thresh-sound="${key}" ${!cfg.enabled ? 'disabled' : ''}>
                    <option value="beep" ${cfg.soundPreset === 'beep' ? 'selected' : ''}>Sharp Beep (Krótki pik)</option>
                    <option value="pulse" ${cfg.soundPreset === 'pulse' ? 'selected' : ''}>Sawtooth Pulse (Pulsujący)</option>
                    <option value="chime" ${cfg.soundPreset === 'chime' ? 'selected' : ''}>Dual Chime (Dwuton)</option>
                    <option value="harmonic" ${cfg.soundPreset === 'harmonic' ? 'selected' : ''}>Harmonic Chime (Delikatny)</option>
                    <option value="custom" ${cfg.soundPreset === 'custom' ? 'selected' : ''} ${!customAudioName ? 'disabled' : ''}>${esc(customOptLabel)}</option>
                  </select>
                </div>

                <span class="metric-foot" style="font-size:10.5px;">${esc(meta.sourceHint)}</span>
              </div>
            `;
          })
          .join('')}
      </div>
    </div>
  `;
}
