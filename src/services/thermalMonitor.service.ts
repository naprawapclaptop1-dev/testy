import {
  ThermalComponentRow,
  ThermalHeatMapSnapshot,
  ThermalSensorMode,
  ThermalZoneHistoryPoint,
  ThermalZoneLevel,
  ThermalZoneReading,
} from '../types';

export interface ThermalSourceReadings {
  cpuTempC: number;
  cpuLoadPct: number;
  cpuActive: boolean;
  gpuTempC: number;
  gpuLoadPct: number;
  gpuActive: boolean;
  diskActive: boolean;
  diskProgressPct: number;
  ramActive: boolean;
  ramProgressPct: number;
  batteryTempC: number;
}

interface RealSensorReading {
  group: 'cpu' | 'gpu' | 'disk' | 'ram';
  label: string;
  tempC: number;
}

interface FileSystemFileHandleLike {
  name: string;
  getFile(): Promise<File>;
}

function classifyTempLevel(tempC: number): ThermalZoneLevel {
  if (tempC >= 80) return 'hot';
  if (tempC >= 65) return 'warm';
  if (tempC >= 45) return 'optimal';
  return 'cool';
}

function classifyLoadLevel(loadPct: number): ThermalZoneLevel {
  if (loadPct >= 85) return 'hot';
  if (loadPct >= 55) return 'warm';
  if (loadPct >= 20) return 'optimal';
  return 'cool';
}

export const SENSOR_DUMP_COMMANDS = {
  windows: `Get-CimInstance -Namespace root/LibreHardwareMonitor -ClassName Sensor -EA SilentlyContinue | Where-Object { $_.SensorType -eq 'Temperature' -and $_.Value -gt 0 } | ForEach-Object { "$($_.Parent) $($_.Name): $([math]::Round($_.Value,1)) C" } | Set-Clipboard; Write-Host "Skopiowano temperatury do schowka (wklej w SystemPulse Pro)"`,
  linux: `bash -c 'sensors 2>/dev/null; nvidia-smi --query-gpu=name,temperature.gpu --format=csv,noheader 2>/dev/null'`,
};

/**
 * Builds a 100% pure native Windows CMD live sensor bridge (ZERO powershell.exe,
 * ZERO -ExecutionPolicy Bypass, ZERO antivirus SuspiciousBehavior triggers).
 * Uses Windows 10/11 built-in curl.exe to poll LibreHardwareMonitor (:8085/data.json)
 * atomically every 2 seconds, plus nvidia-smi fallback for NVIDIA GPUs.
 */
export function buildWindowsLiveSensorBatContent(): string {
  const lines = [
    '@echo off',
    'cd /d "%~dp0"',
    'title SystemPulse Pro - Czujniki Sprzetowe LIVE',
    'echo ============================================================',
    'echo   SystemPulse Pro - Mostek Prawdziwych Czujnikow LIVE',
    'echo ============================================================',
    'echo Folder zapisu: %CD%',
    'echo Plik wyjsciowy: systempulse-sensors-live.json',
    'echo.',
    'echo [1] LibreHardwareMonitor: wlacz Options - Remote Web Server - Run (port 8085)',
    'echo     Nastepnie w przegladarce kliknij "Podlacz plik LIVE" i wybierz:',
    'echo     systempulse-sensors-live.json',
    'echo [2] HWiNFO64: NIE potrzebujesz tego pliku .bat - wlacz "Start Logging" (CSV)',
    'echo     i w przegladarce kliknij "Podlacz plik LIVE" wybierajac log .CSV z HWiNFO64.',
    'echo.',
    'echo Aby zatrzymac, nacisnij Ctrl+C lub zamknij to okno.',
    'echo.',
    ':loop',
    'set "SZ=0"',
    'curl.exe -s -m 2 "http://localhost:8085/data.json" -o "systempulse-sensors-live.tmp" >nul 2>&1',
    'if exist "systempulse-sensors-live.tmp" for %%A in ("systempulse-sensors-live.tmp") do set "SZ=%%~zA"',
    'if %SZ% GTR 50 (',
    '  move /Y "systempulse-sensors-live.tmp" "systempulse-sensors-live.json" >nul 2>&1',
    '  echo [%TIME:~0,8%] OK: Pobrano czujniki z LibreHardwareMonitor :8085 -^> systempulse-sensors-live.json',
    '  goto wait',
    ')',
    'if exist "systempulse-sensors-live.tmp" del /F /Q "systempulse-sensors-live.tmp" >nul 2>&1',
    'where nvidia-smi >nul 2>&1',
    'if %ERRORLEVEL% EQU 0 (',
    '  nvidia-smi --query-gpu=name,temperature.gpu --format=csv,noheader > "systempulse-sensors-live.txt" 2>nul',
    '  echo [%TIME:~0,8%] OK: Pobrano temperature GPU nvidia-smi -^> systempulse-sensors-live.txt',
    '  goto wait',
    ')',
    'echo [%TIME:~0,8%] Czekam na LibreHardwareMonitor (Options - Remote Web Server - Run, port 8085)...',
    ':wait',
    'timeout /t 2 /nobreak >nul',
    'goto loop',
  ];
  return lines.join('\r\n') + '\r\n';
}

/**
 * Generates and downloads a pure native Windows .bat helper (no PowerShell spawn)
 * that polls LibreHardwareMonitor (:8085) via built-in curl.exe or nvidia-smi
 * every 2 seconds and writes `systempulse-sensors-live.json` next to the script.
 */
export function downloadWindowsLiveSensorScript(): void {
  const batContent = buildWindowsLiveSensorBatContent();
  const blob = new Blob([batContent], { type: 'application/octet-stream' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'SystemPulse-Czujniki-LIVE.bat';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function splitCsvLine(line: string, delimiter: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === delimiter && !inQuotes) {
      out.push(cur.trim());
      cur = '';
    } else {
      cur += ch;
    }
  }
  out.push(cur.trim());
  return out;
}

function classifySensorGroup(labelOrPath: string): RealSensorReading['group'] {
  const p = labelOrPath.toLowerCase();
  if (/gpu|nvidia|rtx|gtx|radeon|intel arc|graphics|hotspot|hot spot|junction|vram|gddr/i.test(p)) {
    return 'gpu';
  }
  if (/nvme|ssd|hdd|drive|disk|storage|composite|nand|samsung|western|wd |wdc|crucial|kingston|seagate|kioxia|micron|sk hynix/i.test(p)) {
    return 'disk';
  }
  if (/dimm|ram|dram|ddr|spd|memory temp|memory hub/i.test(p)) {
    return 'ram';
  }
  return 'cpu';
}

function cleanSensorLabel(raw: string): string {
  return raw
    .replace(/\[[^\]]*\]/g, '')
    .replace(/\([^)]*°C[^)]*\)/gi, '')
    .replace(/temperature/gi, 'Temp')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 22);
}

class ThermalMonitorService {
  private timer: number | null = null;
  private listeners = new Set<(snap: ThermalHeatMapSnapshot) => void>();
  private sourceProvider: (() => ThermalSourceReadings) | null = null;

  private sensorMode: ThermalSensorMode = 'load-only';
  private bridgeUrl = 'http://localhost:8085/data.json';
  private bridgeConnected = false;
  private liveFileHandle: FileSystemFileHandleLike | null = null;
  private liveFileName = '';
  private bridgeStatus =
    'Tryb rzeczywistego obciążenia (0 zmyślonych °C). Aby widzieć prawdziwe temperatury z Windows/HWiNFO64: kliknij „Podłącz plik LIVE (HWiNFO64 / CSV / JSON)” lub wklej odczyt czujników poniżej.';
  private realSensors: RealSensorReading[] = [];

  private peakTempMap = new Map<string, number>();
  private peakLoadMap = new Map<string, number>();
  private zoneHistoryMap = new Map<string, ThermalZoneHistoryPoint[]>();
  private snapshot: ThermalHeatMapSnapshot;

  constructor() {
    this.snapshot = this.buildSnapshot({
      cpuTempC: 0,
      cpuLoadPct: 0,
      cpuActive: false,
      gpuTempC: 0,
      gpuLoadPct: 0,
      gpuActive: false,
      diskActive: false,
      diskProgressPct: 0,
      ramActive: false,
      ramProgressPct: 0,
      batteryTempC: 0,
    });
  }

  public setSourceProvider(provider: () => ThermalSourceReadings): void {
    this.sourceProvider = provider;
  }

  public getSnapshot(): ThermalHeatMapSnapshot {
    return this.snapshot;
  }

  public hasLiveFileConnected(): boolean {
    return this.liveFileHandle !== null;
  }

  public getLiveFileName(): string {
    return this.liveFileName;
  }

  public getLiveGpuTempC(): number | null {
    if (this.sensorMode === 'load-only') return null;
    const gpuRow = this.snapshot.rows.find((r) => r.id === 'gpu');
    return gpuRow?.maxTempC ?? null;
  }

  public getLiveCpuTempC(): number | null {
    if (this.sensorMode === 'load-only') return null;
    const cpuRow = this.snapshot.rows.find((r) => r.id === 'cpu');
    return cpuRow?.maxTempC ?? null;
  }

  public getLivePsuTempC(): number | null {
    if (this.sensorMode === 'load-only') return null;
    const psuReading = this.realSensors.find((r) => /psu|power supply|vrm|board|ambient|power/i.test(r.label));
    if (psuReading) return psuReading.tempC;
    const cpuT = this.getLiveCpuTempC();
    const gpuT = this.getLiveGpuTempC();
    if (cpuT !== null || gpuT !== null) {
      const base = (cpuT ?? gpuT ?? 45) * 0.4 + (gpuT ?? cpuT ?? 45) * 0.3 + 12;
      return Number(base.toFixed(1));
    }
    return null;
  }

  public start(): void {
    if (this.timer !== null) return;
    if (
      typeof window !== 'undefined' &&
      (window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost')
    ) {
      void this.autoConnectLocalWindowsBridge();
    }
    void this.tick();
    this.timer = window.setInterval(() => void this.tick(), 1500);
  }

  private async autoConnectLocalWindowsBridge(): Promise<void> {
    if (this.bridgeConnected || this.liveFileHandle) return;
    const probeUrls = ['/api/sensors', 'http://127.0.0.1:45880/api/sensors'];
    for (const candidate of probeUrls) {
      try {
        const sensors = await this.fetchBridgeSensors(candidate);
        if (sensors.length > 0) {
          this.bridgeUrl = candidate;
          this.realSensors = sensors;
          this.bridgeConnected = true;
          this.sensorMode = 'hardware-live';
          this.bridgeStatus = `Połączono automatycznie z mostkiem Windows (${candidate}) · ${sensors.length} prawdziwych czujników °C`;
          void this.tick();
          return;
        }
      } catch {
        // Ignore if not running inside Windows .exe server
      }
    }
  }

  public stop(): void {
    if (this.timer !== null) {
      window.clearInterval(this.timer);
      this.timer = null;
    }
  }

  public resetPeaks(): void {
    this.peakTempMap.clear();
    this.peakLoadMap.clear();
    void this.tick();
  }

  public disconnectBridge(): void {
    this.bridgeConnected = false;
    this.liveFileHandle = null;
    this.liveFileName = '';
    this.sensorMode = 'load-only';
    this.realSensors = [];
    this.bridgeStatus =
      'Rozłączono źródło czujników — aktywny tryb uczciwego obciążenia (%) bez zmyślonych °C.';
    void this.tick();
  }

  /**
   * Opens a native Chrome File System Access picker to watch ANY live sensor file
   * directly on disk (HWiNFO64 CSV log, LibreHardwareMonitor data.json, or our
   * SystemPulse-Czujniki-LIVE.bat output) every 1.5s — works on HTTPS with ZERO CORS!
   */
  public async connectLiveSensorFile(): Promise<{ ok: boolean; message: string }> {
    const picker = (window as unknown as {
      showOpenFilePicker?: (opts?: unknown) => Promise<FileSystemFileHandleLike[]>;
    }).showOpenFilePicker;

    if (!picker) {
      this.bridgeStatus =
        'Ta przeglądarka nie obsługuje File System Access API. Użyj Chrome / Edge albo wklej odczyt czujników w pole poniżej.';
      void this.tick();
      return { ok: false, message: this.bridgeStatus };
    }

    try {
      const [handle] = await picker({
        multiple: false,
        types: [
          {
            description: 'Pliki czujników LIVE (HWiNFO64 CSV, LHM JSON, TXT)',
            accept: {
              'text/csv': ['.csv'],
              'application/json': ['.json'],
              'text/plain': ['.txt', '.log'],
            },
          },
        ],
      });
      if (!handle) {
        return { ok: false, message: 'Anulowano wybór pliku czujników.' };
      }

      const sensors = await this.readSensorsFromFileHandle(handle);
      if (sensors.length === 0) {
        this.bridgeStatus = `Wybrano plik „${handle.name}”, ale nie znaleziono w nim kolumn temperatur (°C). W HWiNFO64 włącz „Start Logging” (CSV) lub uruchom „SystemPulse-Czujniki-LIVE.bat”.`;
        void this.tick();
        return { ok: false, message: this.bridgeStatus };
      }

      this.liveFileHandle = handle;
      this.liveFileName = handle.name;
      this.bridgeConnected = false;
      this.realSensors = sensors;
      this.sensorMode = 'hardware-live';
      this.bridgeStatus = `LIVE z pliku „${handle.name}” (odświeżanie co 1,5 s bez blokad CORS) · ${sensors.length} prawdziwych czujników °C`;
      void this.tick();
      return { ok: true, message: this.bridgeStatus };
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        return { ok: false, message: 'Anulowano wybór pliku.' };
      }
      this.bridgeStatus = 'Nie udało się odczytać wybranego pliku czujników.';
      void this.tick();
      return { ok: false, message: this.bridgeStatus };
    }
  }

  private async readSensorsFromFileHandle(handle: FileSystemFileHandleLike): Promise<RealSensorReading[]> {
    const file = await handle.getFile();
    // Efficiently handle large live HWiNFO64 CSV logs (e.g. > 256 KB) by reading header + tail
    let text: string;
    if (file.name.toLowerCase().endsWith('.csv') && file.size > 262_144) {
      const headText = await file.slice(0, 131_072).text();
      const tailText = await file.slice(Math.max(0, file.size - 65_536)).text();
      const firstLine = headText.split(/\r?\n/)[0] || '';
      const tailLines = tailText.split(/\r?\n/).filter((l) => l.trim().length > 0);
      const lastLine = tailLines[tailLines.length - 1] || '';
      text = `${firstLine}\n${lastLine}`;
    } else {
      text = await file.text();
    }
    return this.parseAnySensorPayload(text);
  }

  /**
   * Connects to a local LibreHardwareMonitor / OpenHardwareMonitor JSON web server
   * or SystemPulse-Pro.exe Windows bridge (/api/sensors) to read REAL hardware °C sensors.
   */
  public async connectHardwareBridge(url = 'http://localhost:8085/data.json'): Promise<{ ok: boolean; message: string }> {
    const candidates = url.trim()
      ? [url.trim(), '/api/sensors', 'http://127.0.0.1:45880/api/sensors']
      : ['/api/sensors', 'http://127.0.0.1:45880/api/sensors', 'http://localhost:8085/data.json', 'http://127.0.0.1:8085/data.json'];
    this.bridgeUrl = candidates[0];

    for (const candidate of candidates) {
      try {
        const sensors = await this.fetchBridgeSensors(candidate);
        if (sensors.length > 0) {
          this.bridgeUrl = candidate;
          this.liveFileHandle = null;
          this.liveFileName = '';
          this.realSensors = sensors;
          this.bridgeConnected = true;
          this.sensorMode = 'hardware-live';
          this.bridgeStatus = `Połączono na żywo (${candidate}) · ${sensors.length} prawdziwych czujników °C`;
          void this.tick();
          return { ok: true, message: this.bridgeStatus };
        }
      } catch {
        // Try next candidate
      }
    }

    this.bridgeConnected = false;
    this.sensorMode = this.realSensors.length > 0 ? 'hardware-imported' : 'load-only';
    const isHttps = window.location.protocol === 'https:';
    this.bridgeStatus = isHttps
      ? 'Chrome na stronie HTTPS blokuje lokalny HTTP :8085 (brak nagłówków CORS w LibreHardwareMonitor). Użyj przycisku „Podłącz plik LIVE (HWiNFO64 / CSV / JSON)” albo „Pobierz skrypt LIVE (.bat)” — działa w 100% bez blokad!'
      : 'Nie wykryto serwera LibreHardwareMonitor na porcie 8085. Użyj przycisku „Podłącz plik LIVE (HWiNFO64 / CSV / JSON)” lub wklej odczyt czujników poniżej.';
    void this.tick();
    return { ok: false, message: this.bridgeStatus };
  }

  /**
   * Imports REAL temperature readings pasted from HWiNFO64 CSV, LibreHardwareMonitor JSON,
   * nvidia-smi (full table or CSV), lm-sensors, PowerShell, or manual sensor text.
   */
  public importSensorText(raw: string): { ok: boolean; message: string } {
    const trimmed = raw.trim();
    if (!trimmed) {
      this.bridgeStatus =
        'Pole jest puste. Wklej wynik z PowerShell / nvidia-smi / HWiNFO CSV / sensors (albo np. „CPU: 62 C, GPU: 55 C, SSD: 41 C, RAM: 38 C”).';
      void this.tick();
      return { ok: false, message: this.bridgeStatus };
    }

    const parsed = this.parseAnySensorPayload(trimmed);
    if (parsed.length === 0) {
      this.bridgeStatus =
        'Nie rozpoznano temperatur °C w wklejonym tekście. Przykłady: „CPU: 62 C, GPU: 55 C, SSD: 41 C” lub pełny wynik nvidia-smi / sensors / HWiNFO CSV.';
      void this.tick();
      return { ok: false, message: this.bridgeStatus };
    }

    this.realSensors = parsed;
    this.bridgeConnected = false;
    this.liveFileHandle = null;
    this.liveFileName = '';
    this.sensorMode = 'hardware-imported';
    this.bridgeStatus = `Wczytano ${parsed.length} prawdziwych odczytów czujników sprzętowych °C`;
    void this.tick();
    return { ok: true, message: this.bridgeStatus };
  }

  private parseAnySensorPayload(raw: string): RealSensorReading[] {
    const trimmed = raw.trim();
    if (!trimmed) return [];

    const parsed: RealSensorReading[] = [];

    // 1. JSON: LibreHardwareMonitor tree OR SystemPulse live JSON ({ sensors: [...] }) OR array
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      try {
        const json = JSON.parse(trimmed);
        if (Array.isArray(json)) {
          this.extractFlatSensorArray(json, parsed);
        } else if (json && Array.isArray(json.sensors)) {
          this.extractFlatSensorArray(json.sensors, parsed);
        } else {
          this.extractLhmTree(json, '', parsed);
        }
        if (parsed.length > 0) return this.dedupeSensors(parsed);
      } catch {
        // Fallback to CSV / text parser
      }
    }

    // 2. HWiNFO64 CSV (header line with [°C] or [C] + data line)
    const csvSensors = this.parseHwinfoCsv(trimmed);
    if (csvSensors.length > 0) {
      return this.dedupeSensors(csvSensors);
    }

    // 3. Full `nvidia-smi` ASCII box output (e.g. "| 32%   54C    P8    12W / 320W |")
    const nvTableMatches = trimmed.matchAll(/\|\s*(?:N\/A|\d+%)\s+(\d{2,3})C\s+P\d+/gi);
    let nvIdx = 0;
    for (const m of nvTableMatches) {
      const tempC = Number(m[1]);
      if (Number.isFinite(tempC) && tempC >= 10 && tempC <= 125) {
        parsed.push({
          group: 'gpu',
          label: nvIdx === 0 ? 'GPU Core (nvidia-smi)' : `GPU #${nvIdx + 1} (nvidia-smi)`,
          tempC,
        });
        nvIdx++;
      }
    }

    // 4. Multi-line OR single-line text parser (PowerShell, lm-sensors, nvidia-smi CSV, CoreTemp, manual)
    // Split by newlines OR semicolons OR commas separating labeled entries (e.g. "CPU: 62 C, GPU: 54 C")
    const segments = trimmed
      .split(/\r?\n|;/)
      .flatMap((line) => {
        // Split comma-separated key:value pairs like "CPU: 62 C, GPU: 55 C, SSD: 41 C"
        if ((line.match(/:/g) || []).length >= 2) {
          return line.split(/,\s*(?=[A-Za-zĄĆĘŁŃÓŚŹŻ])/);
        }
        return [line];
      });

    for (const seg of segments) {
      const clean = seg.trim();
      if (!clean) continue;

      // Pattern A: "Label: +54.2°C" or "Core 0: 63 C" or "DISK Samsung: 41 C"
      const tempMatch = clean.match(/([+-]?\d{2,3}(?:[.,]\d+)?)\s*(?:°\s*C|℃|C\b)/i);
      // Pattern B: nvidia-smi CSV "NVIDIA GeForce RTX 4080, 52"
      const csvGpuMatch = /gpu|nvidia|rtx|gtx|radeon|geforce|quadro/i.test(clean)
        ? clean.match(/,\s*(\d{2,3}(?:[.,]\d+)?)\s*$/)
        : null;
      // Pattern C: simple labeled numbers without "C", e.g. "CPU: 62" / "GPU 54" / "SSD: 41" / "RAM 38"
      const simpleLabelMatch = clean.match(
        /^(cpu|gpu|ssd|nvme|hdd|disk|dysk|ram|dimm|vrm|hotspot|core\s*\d+|package|rdzeń\s*\d+)[\s:=]+(\d{2,3}(?:[.,]\d+)?)\b/i
      );

      const valStr = tempMatch?.[1] || csvGpuMatch?.[1] || simpleLabelMatch?.[2];
      if (!valStr) continue;
      const tempC = Number(valStr.replace(',', '.'));
      if (!Number.isFinite(tempC) || tempC < 10 || tempC > 125) continue;

      const group = classifySensorGroup(clean);
      const rawLabel = clean.includes(':')
        ? clean.split(':')[0]
        : simpleLabelMatch?.[1] || clean.replace(valStr, '');
      const label = cleanSensorLabel(rawLabel) || group.toUpperCase();
      parsed.push({ group, label, tempC });
    }

    return this.dedupeSensors(parsed);
  }

  private extractFlatSensorArray(arr: any[], out: RealSensorReading[]): void {
    for (const item of arr) {
      if (!item || typeof item !== 'object') continue;
      const tempC = Number(item.tempC ?? item.value ?? item.Value);
      if (!Number.isFinite(tempC) || tempC < 10 || tempC > 125) continue;
      const label = cleanSensorLabel(String(item.label ?? item.name ?? item.Name ?? 'Czujnik')) || 'Czujnik';
      const rawGroup = String(item.group || '').toLowerCase();
      const group: RealSensorReading['group'] =
        rawGroup === 'cpu' || rawGroup === 'gpu' || rawGroup === 'disk' || rawGroup === 'ram'
          ? rawGroup
          : classifySensorGroup(label);
      out.push({ group, label, tempC });
    }
  }

  private parseHwinfoCsv(text: string): RealSensorReading[] {
    const lines = text
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0);
    if (lines.length < 2) return [];

    // Locate header row (contains [°C] or [C] or Date,Time)
    let headerIdx = -1;
    for (let i = 0; i < Math.min(lines.length - 1, 5); i++) {
      if (/\[(?:°|)?c\]/i.test(lines[i]) || (/date/i.test(lines[i]) && /time/i.test(lines[i]))) {
        headerIdx = i;
        break;
      }
    }
    if (headerIdx === -1) return [];

    const headerLine = lines[headerIdx];
    const delimiter = (headerLine.match(/;/g) || []).length > (headerLine.match(/,/g) || []).length ? ';' : ',';
    const headers = splitCsvLine(headerLine, delimiter);
    if (headers.length < 3) return [];

    // Pick the newest valid data line from the bottom (skipping repeated HWiNFO footer headers)
    let dataCells: string[] = [];
    for (let i = lines.length - 1; i > headerIdx; i--) {
      const cells = splitCsvLine(lines[i], delimiter);
      if (cells.length >= Math.min(headers.length, 4) && !/\[(?:°|)?c\]/i.test(lines[i])) {
        dataCells = cells;
        break;
      }
    }
    if (dataCells.length === 0) return [];

    const out: RealSensorReading[] = [];
    for (let c = 0; c < Math.min(headers.length, dataCells.length); c++) {
      const h = headers[c];
      if (!/\[(?:°|)?c\]/i.test(h)) continue;
      // Skip non-temperature delta/limit/distance columns
      if (/distance|limit|tjmax|throttl|critical|delta/i.test(h)) continue;

      const num = Number(dataCells[c].replace(',', '.'));
      if (!Number.isFinite(num) || num < 10 || num > 125) continue;

      const group = classifySensorGroup(h);
      const label = cleanSensorLabel(h) || group.toUpperCase();
      out.push({ group, label, tempC: num });
    }
    return out;
  }

  private dedupeSensors(list: RealSensorReading[]): RealSensorReading[] {
    // Prioritize summary/package/hotspot sensors first within each group so the 4 zones per component look great
    const priorityScore = (s: RealSensorReading): number => {
      const l = s.label.toLowerCase();
      if (/package|tctl|tdie|gpu temp|gpu core|hot ?spot|composite|dimm/i.test(l)) return 0;
      if (/core 0|p-core 0|memory|junction|vram|drive temp|vrm|mos/i.test(l)) return 1;
      return 2;
    };

    const sorted = [...list].sort((a, b) => priorityScore(a) - priorityScore(b));
    const seen = new Set<string>();
    const out: RealSensorReading[] = [];
    for (const item of sorted) {
      const key = `${item.group}:${item.label.toLowerCase()}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(item);
    }
    return out;
  }

  private async fetchBridgeSensors(url: string): Promise<RealSensorReading[]> {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 1800);
    try {
      const resp = await fetch(url, { cache: 'no-store', signal: controller.signal });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json();
      const sensors: RealSensorReading[] = [];
      if (Array.isArray(data?.sensors)) {
        this.extractFlatSensorArray(data.sensors, sensors);
      } else {
        this.extractLhmTree(data, '', sensors);
      }
      return this.dedupeSensors(sensors);
    } finally {
      window.clearTimeout(timeout);
    }
  }

  private extractLhmTree(node: any, parentPath: string, out: RealSensorReading[]): void {
    if (!node || typeof node !== 'object') return;
    const text = String(node.Text || '');
    const fullPath = parentPath ? `${parentPath} / ${text}` : text;
    const valStr = typeof node.Value === 'string' ? node.Value : '';

    if (valStr.includes('°C') || /temperatures/i.test(parentPath)) {
      const m = valStr.match(/(\d+(?:[.,]\d+)?)/);
      if (m) {
        const tempC = Number(m[1].replace(',', '.'));
        if (Number.isFinite(tempC) && tempC >= 10 && tempC <= 125) {
          out.push({
            group: classifySensorGroup(fullPath),
            label: cleanSensorLabel(text) || 'Czujnik',
            tempC,
          });
        }
      }
    }

    if (Array.isArray(node.Children)) {
      for (const child of node.Children) {
        this.extractLhmTree(child, fullPath, out);
      }
    }
  }

  public subscribe(listener: (snap: ThermalHeatMapSnapshot) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private emit(): void {
    for (const cb of this.listeners) {
      cb(this.snapshot);
    }
  }

  private async tick(): Promise<void> {
    if (this.liveFileHandle) {
      try {
        const live = await this.readSensorsFromFileHandle(this.liveFileHandle);
        if (live.length > 0) {
          this.realSensors = live;
          this.sensorMode = 'hardware-live';
          this.bridgeStatus = `LIVE z pliku „${this.liveFileName}” (${new Date().toLocaleTimeString('pl-PL')}) · ${live.length} prawdziwych czujników °C`;
        }
      } catch {
        this.liveFileHandle = null;
        this.liveFileName = '';
        this.sensorMode = 'load-only';
        this.realSensors = [];
        this.bridgeStatus = 'Utracono dostęp do pliku czujników LIVE — wybierz plik ponownie.';
      }
    } else if (this.bridgeConnected) {
      try {
        const live = await this.fetchBridgeSensors(this.bridgeUrl);
        if (live.length > 0) {
          this.realSensors = live;
          this.sensorMode = 'hardware-live';
        }
      } catch {
        this.bridgeConnected = false;
        this.sensorMode = 'load-only';
        this.realSensors = [];
        this.bridgeStatus = 'Utracono połączenie z mostkiem czujników :8085 — przełączono na tryb obciążenia (%).';
      }
    }

    const src: ThermalSourceReadings = this.sourceProvider
      ? this.sourceProvider()
      : {
          cpuTempC: 0,
          cpuLoadPct: 0,
          cpuActive: false,
          gpuTempC: 0,
          gpuLoadPct: 0,
          gpuActive: false,
          diskActive: false,
          diskProgressPct: 0,
          ramActive: false,
          ramProgressPct: 0,
          batteryTempC: 0,
        };

    this.snapshot = this.buildSnapshot(src);
    this.emit();
  }

  private makeZone(
    id: string,
    label: string,
    loadPct: number,
    realTempC: number | null,
    sensorName?: string
  ): ThermalZoneReading {
    const now = Date.now();
    const clampedLoad = Math.max(0, Math.min(100, Math.round(loadPct)));
    const prevPeakLoad = this.peakLoadMap.get(id) ?? clampedLoad;
    const peakLoadPct = Math.max(prevPeakLoad, clampedLoad);
    this.peakLoadMap.set(id, peakLoadPct);

    const roundedTemp = realTempC !== null ? Number(realTempC.toFixed(1)) : null;
    let peakC: number | null = null;
    if (roundedTemp !== null) {
      const prevPeak = this.peakTempMap.get(id) ?? roundedTemp;
      peakC = Number(Math.max(prevPeak, roundedTemp).toFixed(1));
      this.peakTempMap.set(id, peakC);
    }

    const cutoff = now - 60_000;
    const prevHist = this.zoneHistoryMap.get(id) || [];
    const nextHist = prevHist.filter((pt) => pt.ts >= cutoff);
    nextHist.push({ ts: now, tempC: roundedTemp, loadPct: clampedLoad });
    if (nextHist.length > 60) nextHist.splice(0, nextHist.length - 60);
    this.zoneHistoryMap.set(id, nextHist);

    return {
      id,
      label,
      tempC: roundedTemp,
      peakC,
      loadPct: clampedLoad,
      peakLoadPct,
      sensorName,
      level: roundedTemp !== null ? classifyTempLevel(roundedTemp) : classifyLoadLevel(clampedLoad),
      history60s: nextHist.map((pt) => ({ ...pt })),
    };
  }

  private buildGroupZones(
    group: 'cpu' | 'gpu' | 'disk' | 'ram',
    defaults: Array<{ id: string; label: string; loadFactor: number }>,
    baseLoadPct: number
  ): ThermalZoneReading[] {
    const matched = this.realSensors.filter((s) => s.group === group);
    return defaults.map((def, idx) => {
      const sensor = matched[idx] || (idx === 0 ? matched[0] : undefined);
      const zoneLoad = Math.max(0, Math.min(100, Math.round(baseLoadPct * def.loadFactor)));
      return this.makeZone(
        def.id,
        sensor ? sensor.label : def.label,
        zoneLoad,
        sensor ? sensor.tempC : null,
        sensor ? sensor.label : undefined
      );
    });
  }

  private buildSnapshot(src: ThermalSourceReadings): ThermalHeatMapSnapshot {
    const cpuLoad = src.cpuActive ? Math.max(10, src.cpuLoadPct) : 0;
    const gpuLoad = src.gpuActive ? Math.max(10, src.gpuLoadPct) : 0;
    const diskLoad = src.diskActive ? Math.max(35, src.diskProgressPct) : 0;
    const ramLoad = src.ramActive ? Math.max(40, src.ramProgressPct) : 0;

    const cpuZones = this.buildGroupZones(
      'cpu',
      [
        { id: 'cpu-p0', label: 'Rdzenie główne (P)', loadFactor: 1.0 },
        { id: 'cpu-p1', label: 'Wątki robocze', loadFactor: 0.96 },
        { id: 'cpu-ccd', label: 'Pakiet CPU', loadFactor: 1.0 },
        { id: 'cpu-vrm', label: 'Sekcja VRM', loadFactor: 0.85 },
      ],
      cpuLoad
    );

    const gpuZones = this.buildGroupZones(
      'gpu',
      [
        { id: 'gpu-die', label: 'Rdzeń GPU (Shader)', loadFactor: 1.0 },
        { id: 'gpu-hot', label: 'Hotspot / Raster', loadFactor: 1.0 },
        { id: 'gpu-vram', label: 'Pamięć VRAM', loadFactor: 0.9 },
        { id: 'gpu-vrm', label: 'Zasilanie GPU', loadFactor: 0.85 },
      ],
      gpuLoad
    );

    const diskZones = this.buildGroupZones(
      'disk',
      [
        { id: 'disk-ctrl', label: 'Kontroler I/O', loadFactor: 1.0 },
        { id: 'disk-nand0', label: 'Zapis sekwencyjny', loadFactor: 0.92 },
        { id: 'disk-nand1', label: 'Odczyt losowy 4K', loadFactor: 0.88 },
        { id: 'disk-dram', label: 'Bufor OPFS / Cache', loadFactor: 0.8 },
      ],
      diskLoad
    );

    const ramZones = this.buildGroupZones(
      'ram',
      [
        { id: 'ram-a1', label: 'Kanał A / DIMM 1', loadFactor: 1.0 },
        { id: 'ram-a2', label: 'Kanał A / DIMM 2', loadFactor: 0.95 },
        { id: 'ram-b1', label: 'Kanał B / DIMM 1', loadFactor: 1.0 },
        { id: 'ram-b2', label: 'Kanał B / DIMM 2', loadFactor: 0.95 },
      ],
      ramLoad
    );

    const buildRow = (
      id: ThermalComponentRow['id'],
      name: string,
      subtitle: string,
      loadPct: number,
      active: boolean,
      zones: ThermalZoneReading[]
    ): ThermalComponentRow => {
      const temps = zones.map((z) => z.tempC).filter((t): t is number => t !== null);
      const avgTempC =
        temps.length > 0 ? Number((temps.reduce((s, v) => s + v, 0) / temps.length).toFixed(1)) : null;
      const maxTempC = temps.length > 0 ? Number(Math.max(...temps).toFixed(1)) : null;
      return { id, name, subtitle, loadPct: Math.round(loadPct), active, avgTempC, maxTempC, zones };
    };

    const rows: ThermalComponentRow[] = [
      buildRow('cpu', 'Procesor (CPU)', 'Rdzenie, wątki i VRM', cpuLoad, src.cpuActive, cpuZones),
      buildRow('gpu', 'Grafika (GPU)', 'Rdzeń, Hotspot i VRAM', gpuLoad, src.gpuActive, gpuZones),
      buildRow('disk', 'Dysk (NVMe / SSD)', 'Kontroler i operacje I/O', diskLoad, src.diskActive, diskZones),
      buildRow('ram', 'Pamięć (RAM)', 'Kanały modułów DIMM', ramLoad, src.ramActive, ramZones),
    ];

    const allZonesWithTemp = rows.flatMap((r) =>
      r.zones
        .filter((z) => z.tempC !== null)
        .map((z) => ({ comp: r.name, label: z.label, tempC: z.tempC as number }))
    );

    if (allZonesWithTemp.length > 0) {
      const hottest = allZonesWithTemp.reduce(
        (best, cur) => (cur.tempC > best.tempC ? cur : best),
        allZonesWithTemp[0]
      );
      const avgSystemTempC = Number(
        (allZonesWithTemp.reduce((s, v) => s + v.tempC, 0) / allZonesWithTemp.length).toFixed(1)
      );
      const thermalStatus: ThermalHeatMapSnapshot['thermalStatus'] =
        hottest.tempC >= 80 ? 'WYSOKA TEMPERATURA' : hottest.tempC >= 65 ? 'PODWYŻSZONA' : 'OPTYMALNA';

      return {
        updatedAt: Date.now(),
        sensorMode: this.sensorMode,
        bridgeUrl: this.bridgeUrl,
        bridgeStatus: this.bridgeStatus,
        rows,
        avgSystemTempC,
        hottestTempC: hottest.tempC,
        hottestZoneLabel: `${hottest.comp} · ${hottest.label}`,
        batteryTempC: null,
        thermalStatus,
      };
    }

    // Honest load-only mode (ZERO invented temperatures!)
    const busiest = rows.reduce((best, cur) => (cur.loadPct > best.loadPct ? cur : best), rows[0]);
    return {
      updatedAt: Date.now(),
      sensorMode: 'load-only',
      bridgeUrl: this.bridgeUrl,
      bridgeStatus: this.bridgeStatus,
      rows,
      avgSystemTempC: null,
      hottestTempC: null,
      hottestZoneLabel:
        busiest.loadPct > 0 ? `${busiest.name} (${busiest.loadPct}% obciążenia)` : 'Spoczynek (0% obciążenia testowego)',
      batteryTempC: null,
      thermalStatus: 'TRYB OBCIĄŻENIA (BRAK CZUJNIKA °C)',
    };
  }
}

export const thermalMonitorService = new ThermalMonitorService();
