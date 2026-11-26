export interface ParsedBatteryUnit {
  name: string;
  manufacturer: string;
  serialNumber: string;
  chemistry: string;
  designCapacityMWh: number;
  fullChargeCapacityMWh: number;
  cycleCount: number | null;
  healthPct: number;
  wearLevelPct: number;
  lostCapacityMWh: number;
}

export interface ParsedBatteryHistoryEntry {
  period: string;
  fullChargeMWh: number;
  designMWh: number;
  healthPct: number;
}

export interface ParsedBatteryReport {
  valid: boolean;
  errorMessage?: string;
  parsedAtIso: string;
  sourceFormat: 'html' | 'text';
  computerName: string;
  systemProductName: string;
  biosVersion: string;
  osBuild: string;
  reportTime: string;
  batteries: ParsedBatteryUnit[];
  totalDesignCapacityMWh: number;
  totalFullChargeCapacityMWh: number;
  overallHealthPct: number;
  overallWearLevelPct: number;
  totalLostCapacityMWh: number;
  totalCycleCount: number | null;
  estimatedLifeAtFullCharge: string;
  estimatedLifeAtDesignCapacity: string;
  estimatedLifeSinceOsInstall: string;
  connectedStandbyAtFullCharge: string;
  capacityHistory: ParsedBatteryHistoryEntry[];
  historyDropMWh: number | null;
  recentUsageEventsCount: number;
  conditionLabel: 'DOSKONAŁA' | 'DOBRA' | 'ZUŻYTA' | 'WYMAGANA WYMIANA';
  serviceRecommendation: string;
}

const STORAGE_KEY_POWERCFG_REPORT = 'sp_saved_powercfg_batteryreport_v1';

export const POWERCFG_WINDOWS_COMMAND =
  'powercfg /batteryreport /output "%USERPROFILE%\\Desktop\\battery-report.html"';

export const SAMPLE_WINDOWS_BATTERY_REPORT = `Battery report
COMPUTER NAME\tWORKSTATION-LAPTOP
SYSTEM PRODUCT NAME\tLENOVO 21CB0012PB ThinkPad X1 Carbon Gen 10
BIOS\tN3AET79W (1.44 ) 11/27/2025
OS BUILD\t26100.1.amd64fre.ge_release.240331-1435
PLATFORM ROLE\tMobile
CONNECTED STANDBY\tSupported
REPORT TIME\t2026-11-25 18:42:11

Installed batteries
Information about each currently installed battery
\tBATTERY 1
NAME\t5B10W51867
MANUFACTURER\tCelxpert
SERIAL NUMBER\t4128
CHEMISTRY\tLiP
DESIGN CAPACITY\t57,000 mWh
FULL CHARGE CAPACITY\t49,320 mWh
CYCLE COUNT\t184

Recent usage
2026-11-23 09:12:04\tActive\tBattery\t94 %\t46,360 mWh
2026-11-24 14:20:10\tActive\tAC\t82 %\t40,442 mWh
2026-11-25 08:15:33\tActive\tBattery\t100 %\t49,320 mWh

Battery capacity history
Charge capacity history of the system's batteries
PERIOD\tFULL CHARGE CAPACITY\tDESIGN CAPACITY
2025-11-01 - 2025-12-01\t55,890 mWh\t57,000 mWh
2026-02-01 - 2026-03-01\t53,410 mWh\t57,000 mWh
2026-06-01 - 2026-07-01\t51,240 mWh\t57,000 mWh
2026-11-18 - 2026-11-25\t49,320 mWh\t57,000 mWh

Battery life estimates
Battery life estimates based on observed drains
AT FULL CHARGE\tAT DESIGN CAPACITY
PERIOD\tACTIVE\tCONNECTED STANDBY\tACTIVE\tCONNECTED STANDBY
2026-11-18 - 2026-11-25\t7:42:15\t42:18:00\t8:54:20\t48:52:10
Since OS install\t8:14:30\t44:10:00\t9:31:12\t51:02:45`;

function escHtml(input: string | number | null | undefined): string {
  return String(input ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function parseMWhNumber(raw: string): number {
  const cleaned = raw
    .replace(/mWh/gi, '')
    .replace(/\u00A0/g, '')
    .replace(/[\s,._']/g, '')
    .trim();
  const num = Number.parseInt(cleaned, 10);
  return Number.isFinite(num) && num > 0 ? num : 0;
}

function parseOptionalInt(raw: string): number | null {
  const cleaned = raw.replace(/\u00A0/g, '').replace(/[\s,._']/g, '').trim();
  if (!cleaned || cleaned === '-' || cleaned === '—') return null;
  const num = Number.parseInt(cleaned, 10);
  return Number.isFinite(num) && num >= 0 ? num : null;
}

/**
 * Converts raw `battery-report.html` into structured tab-separated lines
 * so the same regex/line parser handles both pasted HTML and pasted plain text.
 */
function normalizeReportToText(rawInput: string): { text: string; sourceFormat: 'html' | 'text' } {
  const trimmed = rawInput.trim();
  const looksLikeHtml = /<(html|body|table|tr|td|th|h1|h2|div)\b/i.test(trimmed);
  if (!looksLikeHtml) {
    return {
      text: trimmed.replace(/\r\n/g, '\n').replace(/\r/g, '\n'),
      sourceFormat: 'text',
    };
  }

  let normalized = trimmed
    .replace(/<style[\s\S]*?<\/style>/gi, '\n')
    .replace(/<script[\s\S]*?<\/script>/gi, '\n')
    .replace(/<head[\s\S]*?<\/head>/gi, '\n')
    .replace(/<\/(td|th)>/gi, '\t')
    .replace(/<\/(tr|p|div|h1|h2|h3|h4|li|br)>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");

  normalized = normalized
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .map((line) =>
      line
        .replace(/[ \t]*\t[ \t]*/g, '\t')
        .replace(/^\t+|\t+$/g, '')
        .trim()
    )
    .filter((line) => line.length > 0)
    .join('\n');

  return { text: normalized, sourceFormat: 'html' };
}

function extractFieldByLabels(lines: string[], labels: string[]): string {
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    for (const label of labels) {
      const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const sameLineRe = new RegExp(`^${escaped}\\s*(?:[:\\t]|\\s{2,})\\s*(.+)$`, 'i');
      const m = line.match(sameLineRe);
      if (m && m[1]?.trim()) {
        return m[1].trim().split('\t')[0].trim();
      }
      // Sometimes HTML paste splits label and value across adjacent lines
      const exactLabelRe = new RegExp(`^${escaped}\\s*:?$`, 'i');
      if (exactLabelRe.test(line) && i + 1 < lines.length) {
        const nextVal = lines[i + 1].trim();
        if (nextVal && nextVal.length < 140) return nextVal;
      }
    }
  }
  return '';
}

function extractMultiColumnValues(lines: string[], labels: string[]): string[] {
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    for (const label of labels) {
      const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const re = new RegExp(`^${escaped}\\s*(?:[:\\t]|\\s{2,})\\s*(.+)$`, 'i');
      const m = line.match(re);
      if (m && m[1]?.trim()) {
        const parts = m[1]
          .trim()
          .split(/\t+|\s{2,}/)
          .map((s) => s.trim())
          .filter(Boolean);
        if (parts.length > 0) return parts;
      }
      const exactLabelRe = new RegExp(`^${escaped}\\s*:?$`, 'i');
      if (exactLabelRe.test(line) && i + 1 < lines.length) {
        const nextVal = lines[i + 1].trim();
        if (nextVal && nextVal.length < 140) return [nextVal];
      }
    }
  }
  return [];
}

/**
 * Parses a pasted Windows `powercfg /batteryreport` output (either copied text or raw HTML file)
 * in English or Polish locales into structured summary statistics.
 */
export function parseWindowsBatteryReport(rawInput: string): ParsedBatteryReport {
  const nowIso = new Date().toISOString();
  const baseInvalid = (errorMessage: string): ParsedBatteryReport => ({
    valid: false,
    errorMessage,
    parsedAtIso: nowIso,
    sourceFormat: 'text',
    computerName: '—',
    systemProductName: '—',
    biosVersion: '—',
    osBuild: '—',
    reportTime: '—',
    batteries: [],
    totalDesignCapacityMWh: 0,
    totalFullChargeCapacityMWh: 0,
    overallHealthPct: 0,
    overallWearLevelPct: 0,
    totalLostCapacityMWh: 0,
    totalCycleCount: null,
    estimatedLifeAtFullCharge: '—',
    estimatedLifeAtDesignCapacity: '—',
    estimatedLifeSinceOsInstall: '—',
    connectedStandbyAtFullCharge: '—',
    capacityHistory: [],
    historyDropMWh: null,
    recentUsageEventsCount: 0,
    conditionLabel: 'DOBRA',
    serviceRecommendation: '',
  });

  if (!rawInput || rawInput.trim().length < 20) {
    return baseInvalid('Wklej zawartość raportu z Windows (powercfg /batteryreport) lub wczytaj plik battery-report.html.');
  }

  const { text, sourceFormat } = normalizeReportToText(rawInput);
  const lines = text
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const computerName = extractFieldByLabels(lines, ['COMPUTER NAME', 'NAZWA KOMPUTERA']) || '—';
  const systemProductName =
    extractFieldByLabels(lines, ['SYSTEM PRODUCT NAME', 'NAZWA PRODUKTU SYSTEMOWEGO', 'NAZWA PRODUKTU SYSTEMU']) || '—';
  const biosVersion = extractFieldByLabels(lines, ['BIOS']) || '—';
  const osBuild = extractFieldByLabels(lines, ['OS BUILD', 'KOMPILACJA SYSTEMU OPERACYJNEGO']) || '—';
  const reportTime = extractFieldByLabels(lines, ['REPORT TIME', 'CZAS RAPORTU']) || '—';

  // Extract installed battery columns (Windows reports 1 or 2+ batteries in parallel columns)
  const names = extractMultiColumnValues(lines, ['NAME', 'NAZWA']);
  const manufacturers = extractMultiColumnValues(lines, ['MANUFACTURER', 'PRODUCENT']);
  const serials = extractMultiColumnValues(lines, ['SERIAL NUMBER', 'NUMER SERYJNY']);
  const chemistries = extractMultiColumnValues(lines, ['CHEMISTRY', 'CHEMIA', 'SKŁAD CHEMICZNY']);
  const designRaw = extractMultiColumnValues(lines, [
    'DESIGN CAPACITY',
    'POJEMNOŚĆ PROJEKTOWA',
    'POJEMNOŚĆ ZNAMIONOWA',
    'POJEMNOŚĆ FABRYCZNA',
  ]);
  const fullRaw = extractMultiColumnValues(lines, [
    'FULL CHARGE CAPACITY',
    'POJEMNOŚĆ PO PEŁNYM NAŁADOWANIU',
    'POJEMNOŚĆ PEŁNEGO NAŁADOWANIA',
  ]);
  const cyclesRaw = extractMultiColumnValues(lines, ['CYCLE COUNT', 'LICZBA CYKLI']);

  // Parse capacity history rows (lines containing two mWh values + date/period prefix)
  const capacityHistory: ParsedBatteryHistoryEntry[] = [];
  const historyRowRe =
    /^(\d{4}-\d{2}-\d{2}(?:\s*[-–]\s*\d{4}-\d{2}-\d{2})?)\s+([0-9][0-9\s,._']*)\s*mWh\s+([0-9][0-9\s,._']*)\s*mWh/i;
  for (const line of lines) {
    const hm = line.match(historyRowRe);
    if (hm) {
      const fullMWh = parseMWhNumber(hm[2]);
      const designMWh = parseMWhNumber(hm[3]);
      if (fullMWh > 1000 && designMWh > 1000) {
        const healthPct = Number(Math.min(100, (fullMWh / designMWh) * 100).toFixed(1));
        capacityHistory.push({
          period: hm[1].trim(),
          fullChargeMWh: fullMWh,
          designMWh,
          healthPct,
        });
      }
    }
  }

  // Build installed battery array
  const batteryCount = Math.max(designRaw.length, fullRaw.length);
  const batteries: ParsedBatteryUnit[] = [];

  for (let i = 0; i < batteryCount; i++) {
    const designCap = parseMWhNumber(designRaw[i] || '');
    const fullCap = parseMWhNumber(fullRaw[i] || '');
    if (designCap <= 0 && fullCap <= 0) continue;

    const effectiveDesign = designCap > 0 ? designCap : fullCap;
    const effectiveFull = fullCap > 0 ? fullCap : effectiveDesign;
    const healthPct = Number(Math.max(1, Math.min(100, (effectiveFull / effectiveDesign) * 100)).toFixed(1));
    const wearLevelPct = Number(Math.max(0, 100 - healthPct).toFixed(1));
    const lostCapacityMWh = Math.max(0, effectiveDesign - effectiveFull);

    batteries.push({
      name: names[i] || `Bateria #${i + 1}`,
      manufacturer: manufacturers[i] || 'Nieznany',
      serialNumber: serials[i] || '—',
      chemistry: chemistries[i] || 'Li-Ion / LiPo',
      designCapacityMWh: effectiveDesign,
      fullChargeCapacityMWh: effectiveFull,
      cycleCount: parseOptionalInt(cyclesRaw[i] || ''),
      healthPct,
      wearLevelPct,
      lostCapacityMWh,
    });
  }

  // Fallback: if Design/Full rows weren't found in the Installed Batteries block, use latest capacity history row
  if (batteries.length === 0 && capacityHistory.length > 0) {
    const latest = capacityHistory[capacityHistory.length - 1];
    const wear = Number(Math.max(0, 100 - latest.healthPct).toFixed(1));
    batteries.push({
      name: names[0] || 'Bateria główna',
      manufacturer: manufacturers[0] || 'Nieznany',
      serialNumber: serials[0] || '—',
      chemistry: chemistries[0] || 'Li-Ion',
      designCapacityMWh: latest.designMWh,
      fullChargeCapacityMWh: latest.fullChargeMWh,
      cycleCount: parseOptionalInt(cyclesRaw[0] || ''),
      healthPct: latest.healthPct,
      wearLevelPct: wear,
      lostCapacityMWh: Math.max(0, latest.designMWh - latest.fullChargeMWh),
    });
  }

  if (batteries.length === 0) {
    return baseInvalid(
      'Nie wykryto parametrów Design Capacity / Full Charge Capacity (mWh). Skopiuj pełną zawartość raportu powercfg /batteryreport lub wczytaj plik battery-report.html.'
    );
  }

  const totalDesignCapacityMWh = batteries.reduce((sum, b) => sum + b.designCapacityMWh, 0);
  const totalFullChargeCapacityMWh = batteries.reduce((sum, b) => sum + b.fullChargeCapacityMWh, 0);
  const overallHealthPct = Number(
    Math.max(1, Math.min(100, (totalFullChargeCapacityMWh / Math.max(1, totalDesignCapacityMWh)) * 100)).toFixed(1)
  );
  const overallWearLevelPct = Number(Math.max(0, 100 - overallHealthPct).toFixed(1));
  const totalLostCapacityMWh = Math.max(0, totalDesignCapacityMWh - totalFullChargeCapacityMWh);

  const knownCycles = batteries.map((b) => b.cycleCount).filter((c): c is number => c !== null);
  const totalCycleCount = knownCycles.length > 0 ? knownCycles.reduce((s, v) => s + v, 0) : null;

  // Parse Battery life estimates (HH:MM:SS tokens)
  let estimatedLifeAtFullCharge = '—';
  let estimatedLifeAtDesignCapacity = '—';
  let estimatedLifeSinceOsInstall = '—';
  let connectedStandbyAtFullCharge = '—';

  const lifeSectionIdx = lines.findIndex((l) =>
    /Battery life estimates|Szacowany czas pracy baterii/i.test(l)
  );
  const searchLifeLines = lifeSectionIdx >= 0 ? lines.slice(lifeSectionIdx) : lines;
  const durationTokenRe = /\b\d{1,3}:\d{2}:\d{2}\b/g;

  for (const line of searchLifeLines) {
    const times = line.match(durationTokenRe);
    if (!times || times.length === 0) continue;
    if (/Since OS install|Od zainstalowania systemu/i.test(line)) {
      estimatedLifeSinceOsInstall = times[0];
      if (estimatedLifeAtFullCharge === '—') estimatedLifeAtFullCharge = times[0];
      if (estimatedLifeAtDesignCapacity === '—' && times.length >= 3) {
        estimatedLifeAtDesignCapacity = times[2];
      } else if (estimatedLifeAtDesignCapacity === '—' && times.length === 2) {
        estimatedLifeAtDesignCapacity = times[1];
      }
    } else if (/^\d{4}-\d{2}-\d{2}/.test(line)) {
      estimatedLifeAtFullCharge = times[0];
      if (times.length >= 4) {
        connectedStandbyAtFullCharge = times[1];
        estimatedLifeAtDesignCapacity = times[2];
      } else if (times.length === 3) {
        estimatedLifeAtDesignCapacity = times[1];
      } else if (times.length === 2) {
        estimatedLifeAtDesignCapacity = times[1];
      }
    }
  }

  // Count recent usage events (timestamp + Active/Suspended + AC/Battery)
  const recentUsageEventsCount = lines.filter((l) =>
    /^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}.*(Active|Suspended|Connected standby|Aktywny|Wstrzymany)/i.test(l)
  ).length;

  const historyDropMWh =
    capacityHistory.length >= 2
      ? Math.max(0, capacityHistory[0].fullChargeMWh - capacityHistory[capacityHistory.length - 1].fullChargeMWh)
      : null;

  let conditionLabel: ParsedBatteryReport['conditionLabel'] = 'DOSKONAŁA';
  let serviceRecommendation =
    'Ogniwa w bardzo dobrej kondycji fabrycznej. Zalecane utrzymywanie progu ładowania 80% podczas stałej pracy na zasilaczu.';
  if (overallHealthPct < 55) {
    conditionLabel = 'WYMAGANA WYMIANA';
    serviceRecommendation =
      'Krytyczna degradacja ogniw (<55% pojemności fabrycznej). Zalecana wymiana akumulatora oraz weryfikacja układu ładowania laptopa.';
  } else if (overallHealthPct < 75) {
    conditionLabel = 'ZUŻYTA';
    serviceRecommendation =
      'Widoczny spadek pojemności ogniw (zużycie >25%). Czas pracy bez zasilacza jest zauważalnie skrócony — warto zaplanować wymianę baterii.';
  } else if (overallHealthPct < 88) {
    conditionLabel = 'DOBRA';
    serviceRecommendation =
      'Normalne zużycie eksploatacyjne. Bateria zachowuje dobrą wydajność i bezpieczną rezerwę pojemności.';
  }

  return {
    valid: true,
    parsedAtIso: nowIso,
    sourceFormat,
    computerName,
    systemProductName,
    biosVersion,
    osBuild,
    reportTime,
    batteries,
    totalDesignCapacityMWh,
    totalFullChargeCapacityMWh,
    overallHealthPct,
    overallWearLevelPct,
    totalLostCapacityMWh,
    totalCycleCount,
    estimatedLifeAtFullCharge,
    estimatedLifeAtDesignCapacity,
    estimatedLifeSinceOsInstall,
    connectedStandbyAtFullCharge,
    capacityHistory,
    historyDropMWh,
    recentUsageEventsCount,
    conditionLabel,
    serviceRecommendation,
  };
}

export function loadSavedPowercfgReport(): ParsedBatteryReport | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_POWERCFG_REPORT);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ParsedBatteryReport;
    return parsed && parsed.valid && Array.isArray(parsed.batteries) && parsed.batteries.length > 0
      ? parsed
      : null;
  } catch {
    return null;
  }
}

export function savePowercfgReport(report: ParsedBatteryReport | null): void {
  try {
    if (!report) {
      localStorage.removeItem(STORAGE_KEY_POWERCFG_REPORT);
    } else {
      localStorage.setItem(STORAGE_KEY_POWERCFG_REPORT, JSON.stringify(report));
    }
  } catch {
    // Ignore storage quota errors
  }
}

export function renderPowercfgBatteryReportSectionHtml(
  parsed: ParsedBatteryReport | null,
  rawInputText = '',
  errorMsg = ''
): string {
  const healthCls =
    parsed && parsed.valid
      ? parsed.overallHealthPct >= 80
        ? 'status-ok'
        : parsed.overallHealthPct >= 60
          ? 'status-warn'
          : 'status-err'
      : 'status-cyan';

  const summaryHtml =
    parsed && parsed.valid
      ? `
        <div id="powercfg-parsed-summary" class="stack-md" style="margin-top:4px;">
          <div class="grid-4">
            <div class="metric-card">
              <span class="metric-label">Kondycja ogniw (Health)</span>
              <div class="metric-row">
                <span class="metric-value ${healthCls}">${parsed.overallHealthPct.toFixed(1)}</span>
                <span class="metric-unit">%</span>
              </div>
              <span class="metric-foot">Wear Level: <strong class="font-mono">${parsed.overallWearLevelPct.toFixed(1)}%</strong> · ${escHtml(parsed.conditionLabel)}</span>
            </div>

            <div class="metric-card">
              <span class="metric-label">Pojemność (Full / Design)</span>
              <div class="metric-row">
                <span class="metric-value status-cyan" style="font-size:20px;">${parsed.totalFullChargeCapacityMWh.toLocaleString('pl-PL')}</span>
                <span class="metric-unit">mWh</span>
              </div>
              <span class="metric-foot">Fabryczna: <strong class="font-mono">${parsed.totalDesignCapacityMWh.toLocaleString('pl-PL')} mWh</strong> (Utrata: -${parsed.totalLostCapacityMWh.toLocaleString('pl-PL')} mWh)</span>
            </div>

            <div class="metric-card">
              <span class="metric-label">Liczba cykli ładowania</span>
              <div class="metric-row">
                <span class="metric-value">${parsed.totalCycleCount !== null ? parsed.totalCycleCount.toLocaleString('pl-PL') : '—'}</span>
                <span class="metric-unit">${parsed.totalCycleCount !== null ? 'cykli' : 'brak w raporcie'}</span>
              </div>
              <span class="metric-foot">Baterie: <strong class="font-mono">${parsed.batteries.length}</strong> · Zdarzenia użycia: <strong class="font-mono">${parsed.recentUsageEventsCount}</strong></span>
            </div>

            <div class="metric-card">
              <span class="metric-label">Szacowany czas pracy (Active)</span>
              <div class="metric-row">
                <span class="metric-value status-ok" style="font-size:20px;">${escHtml(parsed.estimatedLifeAtFullCharge)}</span>
              </div>
              <span class="metric-foot">Fabrycznie: <strong class="font-mono">${escHtml(parsed.estimatedLifeAtDesignCapacity)}</strong> · Od instalacji OS: <strong class="font-mono">${escHtml(parsed.estimatedLifeSinceOsInstall)}</strong></span>
            </div>
          </div>

          <div class="panel" style="padding:12px 14px;background:var(--bg-inset);">
            <div class="row-between" style="flex-wrap:wrap;gap:8px;margin-bottom:8px;">
              <span style="font-size:12.5px;font-weight:700;color:var(--text-primary);">Metadane systemu i ogniw z raportu Windows</span>
              <div class="row-wrap" style="gap:8px;align-items:center;">
                <span class="font-mono" style="font-size:11px;color:var(--text-muted);">Format: ${parsed.sourceFormat.toUpperCase()} · Raport: ${escHtml(parsed.reportTime)}</span>
                <button id="powercfg-apply-calibration-btn" type="button" class="btn btn-primary btn-sm">
                  Zastosuj do kalibracji baterii (${parsed.totalDesignCapacityMWh.toLocaleString('pl-PL')} / ${parsed.totalFullChargeCapacityMWh.toLocaleString('pl-PL')} mWh)
                </button>
              </div>
            </div>
            <div class="kv-list">
              <div class="kv-row">
                <span class="kv-key">Komputer / Model laptopa</span>
                <span class="kv-val">${escHtml(parsed.computerName)} · ${escHtml(parsed.systemProductName)}</span>
              </div>
              <div class="kv-row">
                <span class="kv-key">BIOS / Kompilacja Windows</span>
                <span class="kv-val">${escHtml(parsed.biosVersion)} · OS Build ${escHtml(parsed.osBuild)}</span>
              </div>
              ${parsed.batteries
                .map(
                  (bat, idx) => `
              <div class="kv-row">
                <span class="kv-key">Bateria #${idx + 1} (${escHtml(bat.name)})</span>
                <span class="kv-val">${escHtml(bat.manufacturer)} · ${escHtml(bat.chemistry)} · S/N: ${escHtml(bat.serialNumber)} · ${bat.fullChargeCapacityMWh.toLocaleString('pl-PL')} / ${bat.designCapacityMWh.toLocaleString('pl-PL')} mWh (${bat.healthPct}%)${bat.cycleCount !== null ? ` · ${bat.cycleCount} cykli` : ''}</span>
              </div>`
                )
                .join('')}
            </div>
            <div style="margin-top:10px;padding:8px 10px;border-radius:8px;border:1px solid var(--border-subtle);background:rgba(6,182,212,0.06);font-size:12px;color:var(--text-secondary);">
              <strong class="${healthCls}">Werdykt serwisowy (${escHtml(parsed.conditionLabel)}):</strong> ${escHtml(parsed.serviceRecommendation)}
            </div>
          </div>

          ${
            parsed.capacityHistory.length > 0
              ? `
            <div style="overflow-x:auto;">
              <div class="row-between" style="margin-bottom:6px;flex-wrap:wrap;gap:6px;">
                <span style="font-size:12.5px;font-weight:600;">Historia degradacji pojemności z raportu (${parsed.capacityHistory.length} okresów)</span>
                ${
                  parsed.historyDropMWh !== null
                    ? `<span class="font-mono" style="font-size:11.5px;color:var(--text-muted);">Łączny spadek w historii raportu: <strong class="status-warn">-${parsed.historyDropMWh.toLocaleString('pl-PL')} mWh</strong></span>`
                    : ''
                }
              </div>
              <table class="data-table">
                <thead>
                  <tr>
                    <th>Okres (Period)</th>
                    <th>Pełna pojemność (Full Charge)</th>
                    <th>Pojemność fabryczna (Design)</th>
                    <th>Kondycja (%)</th>
                  </tr>
                </thead>
                <tbody>
                  ${parsed.capacityHistory
                    .slice(-8)
                    .map(
                      (row) => `
                    <tr>
                      <td class="font-mono">${escHtml(row.period)}</td>
                      <td class="font-mono status-cyan" style="font-weight:600;">${row.fullChargeMWh.toLocaleString('pl-PL')} mWh</td>
                      <td class="font-mono">${row.designMWh.toLocaleString('pl-PL')} mWh</td>
                      <td class="font-mono ${row.healthPct >= 80 ? 'status-ok' : row.healthPct >= 60 ? 'status-warn' : 'status-err'}" style="font-weight:700;">${row.healthPct.toFixed(1)}%</td>
                    </tr>`
                    )
                    .join('')}
                </tbody>
              </table>
            </div>`
              : ''
          }
        </div>`
      : '';

  return `
    <div id="powercfg-battery-report-section" class="panel stack-md">
      <div class="panel-header" style="margin-bottom:0;flex-wrap:wrap;gap:8px;">
        <div>
          <h2 class="panel-title">Parser raportu Windows (powercfg /batteryreport)</h2>
          <p style="margin:3px 0 0;font-size:12px;color:var(--text-secondary);">
            Wklej skopiowany tekst raportu <span class="font-mono">powercfg /batteryreport</span> (PL/EN) lub wczytaj plik <span class="font-mono">battery-report.html</span>, aby automatycznie wyodrębnić statystyki kondycji ogniw, liczbę cykli, historię degradacji i czasy pracy.
          </p>
        </div>
        <div class="row-wrap" style="gap:6px;">
          <button id="powercfg-copy-cmd-btn" type="button" class="btn btn-secondary btn-sm" title="Skopiuj komendę Windows CMD / PowerShell">
            Kopiuj komendę CMD
          </button>
          <label class="btn btn-secondary btn-sm" style="cursor:pointer;">
            <span>Wczytaj battery-report.html</span>
            <input id="powercfg-file-input" type="file" accept=".html,.htm,.txt" style="display:none;" />
          </label>
          <button id="powercfg-load-sample-btn" type="button" class="btn btn-secondary btn-sm">
            Wczytaj przykład
          </button>
        </div>
      </div>

      <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;padding:8px 12px;border-radius:8px;background:var(--bg-inset);border:1px solid var(--border-subtle);">
        <code class="font-mono" style="font-size:11.5px;color:var(--accent-cyan);word-break:break-all;">${escHtml(POWERCFG_WINDOWS_COMMAND)}</code>
        <span id="powercfg-cmd-feedback" class="font-mono" style="font-size:11px;color:var(--text-muted);">Wklej wynik poniżej (Ctrl+V)</span>
      </div>

      <div class="field-group">
        <label class="field-label" for="powercfg-raw-textarea">Treść raportu Windows powercfg /batteryreport (tekst lub źródło HTML)</label>
        <textarea
          id="powercfg-raw-textarea"
          class="field-input font-mono"
          rows="5"
          placeholder="Wklej tutaj skopiowaną zawartość strony battery-report.html (Ctrl+A → Ctrl+C → Ctrl+V)..."
          style="width:100%;resize:vertical;font-size:11.5px;line-height:1.45;min-height:105px;"
        >${escHtml(rawInputText)}</textarea>
      </div>

      <div class="row-wrap" style="gap:8px;align-items:center;">
        <button id="powercfg-parse-btn" type="button" class="btn btn-primary btn-sm">
          Analizuj raport powercfg
        </button>
        <button id="powercfg-clear-btn" type="button" class="btn btn-secondary btn-sm">
          Wyczyść
        </button>
        ${
          errorMsg
            ? `<span id="powercfg-error-msg" class="status-err" style="font-size:12px;font-weight:600;">${escHtml(errorMsg)}</span>`
            : `<span id="powercfg-error-msg" class="status-err" style="font-size:12px;font-weight:600;display:none;"></span>`
        }
      </div>

      ${summaryHtml}
    </div>
  `;
}

export interface BindPowercfgReportCallbacks {
  onParsed: (report: ParsedBatteryReport, rawText: string) => void;
  onCleared: () => void;
  onApplyCalibration: (designMWh: number, fullChargeMWh: number, report: ParsedBatteryReport) => void;
  onError: (message: string, rawText: string) => void;
}

export function bindPowercfgBatteryReportEvents(
  host: HTMLElement,
  currentParsed: ParsedBatteryReport | null,
  callbacks: BindPowercfgReportCallbacks
): void {
  const textarea = host.querySelector<HTMLTextAreaElement>('#powercfg-raw-textarea');
  const feedbackEl = host.querySelector<HTMLElement>('#powercfg-cmd-feedback');

  host.querySelector('#powercfg-copy-cmd-btn')?.addEventListener('click', () => {
    void navigator.clipboard?.writeText(POWERCFG_WINDOWS_COMMAND).catch(() => {});
    if (feedbackEl) {
      feedbackEl.textContent = '✓ Skopiowano komendę — uruchom w CMD/PowerShell!';
      feedbackEl.style.color = '#10b981';
    }
  });

  const runParse = (raw: string) => {
    const res = parseWindowsBatteryReport(raw);
    if (!res.valid) {
      callbacks.onError(res.errorMessage || 'Nie udało się sparsować raportu.', raw);
      return;
    }
    savePowercfgReport(res);
    callbacks.onParsed(res, raw);
  };

  host.querySelector('#powercfg-parse-btn')?.addEventListener('click', () => {
    runParse(textarea?.value ?? '');
  });

  host.querySelector('#powercfg-load-sample-btn')?.addEventListener('click', () => {
    if (textarea) textarea.value = SAMPLE_WINDOWS_BATTERY_REPORT;
    runParse(SAMPLE_WINDOWS_BATTERY_REPORT);
  });

  host.querySelector('#powercfg-clear-btn')?.addEventListener('click', () => {
    savePowercfgReport(null);
    callbacks.onCleared();
  });

  host.querySelector<HTMLInputElement>('#powercfg-file-input')?.addEventListener('change', (e) => {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const content = typeof reader.result === 'string' ? reader.result : '';
      if (textarea) textarea.value = content;
      runParse(content);
    };
    reader.readAsText(file);
  });

  host.querySelector('#powercfg-apply-calibration-btn')?.addEventListener('click', () => {
    if (!currentParsed || !currentParsed.valid) return;
    callbacks.onApplyCalibration(
      currentParsed.totalDesignCapacityMWh,
      currentParsed.totalFullChargeCapacityMWh,
      currentParsed
    );
  });
}
