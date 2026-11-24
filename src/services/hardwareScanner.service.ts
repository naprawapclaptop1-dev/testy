import {
  BatteryHealthState,
  ComponentScanCard,
  DetectedHardwareDevice,
  DiskDriveTarget,
  DiskTestResult,
  DisplayPanelInfo,
  GpuStressMetrics,
  NetworkTestResult,
  RamTestResult,
  SystemSpecs,
} from '../types';
import { diskTestService } from './diskTest.service';
import { getLocalBridgeBases } from './localBridge';

export interface ParsedRamModule {
  slot: string;
  manufacturer: string;
  partNumber: string;
  capacityGB: number;
  speedMHz: number;
  memoryType: string;
  serial: string;
}

export interface ParsedDiskDrive {
  model: string;
  interfaceType: string;
  mediaType: string;
  sizeGB: number;
  status: string;
  serial: string;
}

export interface ParsedLogicalDisk {
  letter: string;
  volumeName: string;
  fileSystem: string;
  totalGB: number;
  freeGB: number;
  driveType: string | number;
}

export interface ParsedDeepHardwareInventory {
  sourceOs: 'Windows' | 'Linux' | 'macOS' | 'Inny';
  importedAt: number;
  computerModel: string;
  motherboard: string;
  bios: string;
  cpuModel: string;
  cpuDetails: string;
  gpus: Array<{ name: string; vramGB: string; driver: string }>;
  ramModules: ParsedRamModule[];
  disks: ParsedDiskDrive[];
  logicalDisks?: ParsedLogicalDisk[];
  monitors: Array<{ manufacturer: string; model: string; serial: string }>;
  battery: string;
  networkAdapters: string[];
  rawLineCount: number;
  rawDumpPreview?: string;
}

export interface SmbiosSpecRow {
  category: string;
  parameter: string;
  value: string;
  source: 'SMBIOS' | 'Live API' | 'Krzyżowo';
}

export interface DramValidationModuleResult {
  slot: string;
  manufacturer: string;
  partNumber: string;
  capacityGB: number;
  memoryType: string;
  ratedSpeedMHz: number;
  jedecBaselineMHz: number;
  profileStatus: 'XMP / EXPO Aktywny' | 'Profil JEDEC / Standardowy' | 'Poniżej bazy JEDEC' | 'Brak odczytu MHz';
  theoreticalSingleChanMBs: number;
  notes: string;
}

export interface DramValidationSummary {
  totalCapacityGB: number;
  moduleCount: number;
  channelConfig: string;
  dominantSpeedMHz: number;
  theoreticalPeakMBs: number;
  measuredReadMBs: number;
  measuredWriteMBs: number;
  measuredCopyMBs: number;
  latencyNs: number;
  efficiencyPct: number | null;
  validationStatus: 'ZWERYFIKOWANO OK' | 'WYKRYTO NIEZGODNOŚĆ / ASYMETRIĘ' | 'OCZEKUJE NA TEST RAM' | 'BRAK MODUŁÓW SMBIOS';
  verdictNote: string;
  modules: DramValidationModuleResult[];
}

export interface SsdEnduranceDriveResult {
  model: string;
  interfaceType: string;
  mediaType: string;
  sizeGB: number;
  smartRawStatus: string;
  estimatedTbwRating: number | null;
  estimatedDwpd: number | null;
  enduranceTier: 'Enterprise / Pro NVMe' | 'Consumer NVMe Gen4/5' | 'SATA SSD' | 'HDD Mechaniczny';
  liveSmartHealthPct: number | null;
  liveSlcCachePct: number | null;
  liveSustainedWriteMBs: number | null;
  crcVerified: boolean | null;
  verificationStatus: 'WYTRZYMAŁOŚĆ WZOROWA' | 'PODWYŻSZONE ZUŻYCIE / SPADEK SLC' | 'BRAK TESTU DYSKU' | 'BŁĄD SMART / CRC';
  notes: string;
}

export interface SsdEnduranceSummary {
  driveCount: number;
  totalCapacityGB: number;
  overallStatus: 'ZWERYFIKOWANO OK' | 'WYMAGA UWAGI' | 'OCZEKUJE NA TEST DYSKU' | 'BRAK DYSKÓW SMBIOS';
  verdictNote: string;
  drives: SsdEnduranceDriveResult[];
}

export interface DeepHardwareAnalysisSheet {
  hasSmbiosData: boolean;
  sourceOs: string;
  importedAtLabel: string;
  rawLineCount: number;
  rawDumpPreview: string;
  specRows: SmbiosSpecRow[];
  dramValidation: DramValidationSummary;
  ssdEndurance: SsdEnduranceSummary;
}

export interface MountedVolumeInfo {
  name: string;
  entryCount: number;
  writeTestedMBs: number | null;
  readTestedMBs: number | null;
  testedAt: number;
}

export interface HardwareScanSnapshot {
  panel: DisplayPanelInfo;
  screens: Array<{
    label: string;
    resolution: string;
    dpr: number;
    isPrimary: boolean;
    isInternal: boolean | null;
  }>;
  devices: DetectedHardwareDevice[];
  usbHidDevices: Array<{ bus: 'USB' | 'HID' | 'Bluetooth' | 'Serial'; name: string; ids: string }>;
  mountedVolumes: MountedVolumeInfo[];
  deepInventory: ParsedDeepHardwareInventory | null;
  storageSummary: {
    quotaGB: number;
    usageMB: number;
    opfsSupported: boolean;
    persisted: boolean;
  };
  webGpuSummary: string;
  lastScanAt: number;
}

export const DEEP_SCAN_COMMANDS = {
  windows: `$d={param($a)if(!$a){''}else{(-join($a|Where-Object{$_ -gt 31 -and $_ -lt 127}|ForEach-Object{[char][int]$_})).Trim()}};$o=[ordered]@{os='Windows';sys=(Get-CimInstance Win32_ComputerSystem|Select Manufacturer,Model);board=(Get-CimInstance Win32_BaseBoard|Select Manufacturer,Product);bios=(Get-CimInstance Win32_BIOS|Select Manufacturer,SMBIOSBIOSVersion,ReleaseDate);cpu=(Get-CimInstance Win32_Processor|Select Name,NumberOfCores,NumberOfLogicalProcessors,MaxClockSpeed);gpu=@(Get-CimInstance Win32_VideoController|Select Name,AdapterRAM,DriverVersion);ram=@(Get-CimInstance Win32_PhysicalMemory|Select DeviceLocator,BankLabel,Manufacturer,PartNumber,Capacity,Speed,SMBIOSMemoryType,SerialNumber);disks=@(Get-CimInstance Win32_DiskDrive|Select Model,InterfaceType,MediaType,Size,Status,SerialNumber);logicalDisks=@(Get-CimInstance Win32_LogicalDisk -Filter 'DriveType=2 OR DriveType=3 OR DriveType=4'|Select DeviceID,VolumeName,FileSystem,Size,FreeSpace,DriveType);monitors=@(Get-CimInstance -Namespace root\\wmi WmiMonitorID -EA SilentlyContinue|ForEach-Object{@{m=&$d $_.ManufacturerName;n=&$d $_.UserFriendlyName;s=&$d $_.SerialNumberID}});net=@(Get-CimInstance Win32_NetworkAdapter -Filter 'PhysicalAdapter=True'|Select -Expand Name)};$j=$o|ConvertTo-Json -Depth 4 -Compress;try{Set-Clipboard -Value $j -EA Stop}catch{$j|clip};Write-Host 'SKOPIOWANO DO SCHOWKA - wklej teraz w SystemPulse Pro!' -ForegroundColor Yellow`,
  linux: `bash -c 'echo "---CPU---"; lscpu | grep -E "Model name|Core|Thread|MHz"; echo "---BOARD---"; cat /sys/devices/virtual/dmi/id/board_vendor /sys/devices/virtual/dmi/id/board_name /sys/devices/virtual/dmi/id/bios_version 2>/dev/null; echo "---RAM---"; sudo dmidecode -t memory 2>/dev/null | grep -E "Locator:|Size:|Type:|Speed:|Manufacturer:|Part Number:" || free -h; echo "---DISKS---"; lsblk -d -o NAME,MODEL,SIZE,TRAN,ROTA,SERIAL; echo "---GPU---"; lspci | grep -iE "vga|3d|display"'`,
  macos: `system_profiler SPHardwareDataType SPDisplaysDataType SPMemoryDataType SPNVMeDataType SPSerialATADataType -json | pbcopy && echo "SKOPIOWANO DO SCHOWKA - wklej w SystemPulse Pro!"`,
};

const EDID_PS_CORE = `$d={param($a)if(!$a){''}else{(-join($a|Where-Object{$_ -gt 31 -and $_ -lt 127}|ForEach-Object{[char][int]$_})).Trim()}};$ids=@(Get-CimInstance -Namespace root\\wmi -ClassName WmiMonitorID -EA SilentlyContinue);if(!$ids.Count){$ids=@(Get-WmiObject -Namespace root\\wmi -Class WmiMonitorID -EA SilentlyContinue)};$p=@(Get-CimInstance -Namespace root\\wmi -ClassName WmiMonitorBasicDisplayParams -EA SilentlyContinue);$out=@();for($i=0;$i -lt $ids.Count;$i++){$id=$ids[$i];$bp=$p|Where-Object{$_.InstanceName -eq $id.InstanceName}|Select-Object -First 1;if(!$bp -and $i -lt $p.Count){$bp=$p[$i]};$w=if($bp){[int]$bp.MaxHorizontalImageSize}else{0};$h=if($bp){[int]$bp.MaxVerticalImageSize}else{0};$in=if($w -gt 0 -and $h -gt 0){[math]::Round([math]::Sqrt($w*$w+$h*$h)/2.54,1)}else{0};$out+=[ordered]@{m=&$d $id.ManufacturerName;n=&$d $id.UserFriendlyName;p=&$d $id.ProductCodeID;s=&$d $id.SerialNumberID;y=[int]$id.YearOfManufacture;wCm=$w;hCm=$h;inch=$in}};if(!$out.Count){$out=@(Get-CimInstance Win32_PnPEntity -EA SilentlyContinue|Where-Object{$_.PNPClass -eq 'Monitor'}|ForEach-Object{[ordered]@{m='';n=[string]$_.Name;p=if($_.HardwareID){[string]$_.HardwareID[0]}else{''};s='';y=0;wCm=0;hCm=0;inch=0}})};$j=@{edidMonitors=$out}|ConvertTo-Json -Depth 4 -Compress;try{Set-Clipboard -Value $j -EA Stop}catch{$j|clip};Write-Host $j -ForegroundColor Green;Write-Host 'SKOPIOWANO EDID DO SCHOWKA - wklej (Ctrl+V) w SystemPulse Pro!' -ForegroundColor Yellow`;

export const EDID_POWERSHELL_COMMAND = EDID_PS_CORE;

// Pure native Windows CMD command using pnputil — does NOT launch powershell.exe or -ExecutionPolicy Bypass,
// so antivirus behavioral shields (Bitdefender/Defender) never block it.
export const EDID_CMD_COMMAND = `pnputil /enum-devices /class Monitor /connected | clip && pnputil /enum-devices /class Monitor /connected`;

export const EDID_SCAN_COMMAND = EDID_POWERSHELL_COMMAND;

export function buildMonitorEdidGuideText(): string {
  return [
    '================================================================',
    '  SystemPulse Pro - Odczyt chipu EDID matrycy / monitora',
    '================================================================',
    '',
    'OPCJA 1 (BEZ BLOKAD ANTYWIRUSA): Wiersz polecen (CMD - natywny pnputil)',
    '  1. Nacisnij Win+R, wpisz cmd i nacisnij Enter.',
    '  2. Wklej ponizsza komende i nacisnij Enter (nie uruchamia powershell.exe):',
    '',
    EDID_CMD_COMMAND,
    '',
    '----------------------------------------------------------------',
    'OPCJA 2 (PELNY EDID + PRZEKATNA): Windows Terminal / PowerShell',
    '  1. Nacisnij Win+X i wybierz "Terminal" lub "Windows PowerShell".',
    '  2. Wklej ponizsza komende bezposrednio w oknie PowerShell i nacisnij Enter:',
    '',
    EDID_POWERSHELL_COMMAND,
    '',
    '----------------------------------------------------------------',
    'Wynik zostanie automatycznie skopiowany do schowka.',
    'Wroc do SystemPulse Pro -> zakladka Ekran -> wklej (Ctrl+V)',
    'i kliknij "Wczytaj model EDID".',
    '',
  ].join('\r\n');
}

export function downloadMonitorEdidScript(): void {
  const txt = buildMonitorEdidGuideText();
  const blob = new Blob([txt], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'SystemPulse_EDID_Komendy.txt';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const EDID_VENDOR_MAP: Record<string, string> = {
  GSM: 'LG Electronics',
  LGD: 'LG Display (Matryca)',
  SAM: 'Samsung',
  SDC: 'Samsung Display (OLED/LCD)',
  AUO: 'AU Optronics',
  BOE: 'BOE Display',
  CMN: 'Innolux / Chi Mei',
  CSO: 'CSOT',
  SHP: 'Sharp',
  DEL: 'Dell',
  ACI: 'ASUS',
  AUS: 'ASUS',
  MSI: 'MSI',
  GBT: 'Gigabyte',
  AOC: 'AOC',
  ACR: 'Acer',
  BNQ: 'BenQ ZOWIE',
  HWP: 'HP OMEN / Envy',
  LEN: 'Lenovo Legion',
  APP: 'Apple Studio / Retina',
  PHL: 'Philips Evnia',
  VSC: 'ViewSonic',
  IIY: 'iiyama G-Master',
  NEC: 'NEC MultiSync',
  EIZ: 'EIZO ColorEdge',
  SNY: 'Sony INZONE',
};

const EDID_PRODUCT_CODE_MAP: Record<string, string> = {
  ACR0B3A: 'Acer ED270U P2 27" (2023)',
  ACR0C12: 'Acer Nitro XV272U V (27" Agile-Splendor IPS QHD 170Hz)',
  ACR09A4: 'Acer Predator XB273U GX (27" Fast IPS QHD 240Hz)',
  GSM5B7F: 'LG UltraGear 27GP850-B (27" Nano IPS QHD 180Hz)',
  GSM5B80: 'LG UltraGear 27GN800-B (27" IPS QHD 144Hz)',
  GSM5C67: 'LG UltraGear 27GR95QE-B (27" OLED QHD 240Hz)',
  GSM5BBF: 'LG UltraGear 32GP850-B (32" Nano IPS QHD 165Hz)',
  GSM7707: 'LG OLED C2/C3 42" 4K 120Hz (EVO WOLED)',
  SAM7036: 'Samsung Odyssey G7 LC27G75T (27" QLED VA QHD 240Hz)',
  SAM7149: 'Samsung Odyssey Neo G8 S32BG85 (32" Mini-LED 4K 240Hz)',
  SAM72A1: 'Samsung Odyssey OLED G8 S34BG85 (34" QD-OLED 175Hz)',
  SAM7304: 'Samsung Odyssey G6 S27BG65 (27" QHD 240Hz)',
  DEL426E: 'Dell Alienware AW3423DWF (34" QD-OLED 165Hz)',
  DEL4252: 'Dell G2724D (27" Fast IPS QHD 165Hz)',
  DEL428A: 'Dell Alienware AW2725DF (27" QD-OLED 360Hz)',
  AUS27A1: 'ASUS ROG Swift PG27AQDM (27" OLED QHD 240Hz)',
  AUS279Q: 'ASUS TUF Gaming VG27AQ (27" IPS QHD 165Hz)',
  MSI14C2: 'MSI Optix MAG274QRF-QD (27" Quantum Dot IPS QHD 165Hz)',
  MSI342C: 'MSI MEG 342C QD-OLED (34" UWQHD 175Hz)',
  GBT2701: 'Gigabyte M27Q-P (27" SS-IPS QHD 170Hz)',
  GBT2702: 'Gigabyte AORUS FO27Q3 (27" QD-OLED 360Hz)',
  AOC2702: 'AOC Q27G3XMN (27" Mini-LED QHD 180Hz)',
  IIY6698: 'iiyama G-Master GB2770QSU-B5 Red Eagle (27" Fast IPS QHD 165Hz)',
  BOE0A5E: 'Matryca BOE NE160QDM-NY1 (16" QHD+ 165Hz IPS)',
  AUO82ED: 'Matryca AUO B156HAN08.4 (15.6" FHD 240Hz AHVA)',
  SDC4161: 'Matryca Samsung ATNA60YV02-0 (16" 3.2K AMOLED 120Hz)',
  LGD06A5: 'Matryca LG Display LP173WQ1 (17.3" QHD 165Hz IPS)',
};

const EDID_STORAGE_KEY = 'sp_edid_panel_v1';

function detectColorGamut(): DisplayPanelInfo['colorGamut'] {
  if (typeof window.matchMedia === 'function') {
    if (window.matchMedia('(color-gamut: rec2020)').matches) return 'Rec.2020';
    if (window.matchMedia('(color-gamut: p3)').matches) return 'Display-P3';
  }
  return 'sRGB';
}

function detectHdrSupport(): boolean {
  if (typeof window.matchMedia === 'function') {
    return window.matchMedia('(dynamic-range: high)').matches;
  }
  return false;
}

function estimatePanelClass(
  nativeW: number,
  nativeH: number,
  hz: number,
  gamut: DisplayPanelInfo['colorGamut'],
  hdr: boolean,
  dpr: number
): string {
  const resTag =
    nativeW >= 3840
      ? '4K UHD'
      : nativeW >= 2560
        ? 'QHD / 2.5K'
        : nativeW >= 1920
          ? 'Full HD'
          : 'HD / WXGA';
  const hzTag = hz >= 120 ? `Gaming ${hz}Hz` : `${hz}Hz`;
  const panelHint =
    hdr && gamut !== 'sRGB'
      ? 'OLED / Mini-LED Wide Gamut'
      : gamut === 'Display-P3'
        ? 'IPS / Retina P3'
        : dpr >= 1.5
          ? 'HiDPI IPS'
          : 'Standard IPS / VA / TN';
  return `${resTag} · ${hzTag} · ${panelHint}`;
}

function decodeSmbiosMemoryType(code: unknown): string {
  const n = Number(code);
  if (n === 34) return 'DDR5';
  if (n === 35) return 'LPDDR5';
  if (n === 26) return 'DDR4';
  if (n === 30) return 'LPDDR4';
  if (n === 24) return 'DDR3';
  if (n === 29) return 'LPDDR3';
  if (n === 21) return 'DDR2';
  if (typeof code === 'string' && code.trim()) return code.trim();
  return 'DDR';
}

class HardwareScannerService {
  private usbHidDevices: Array<{ bus: 'USB' | 'HID' | 'Bluetooth' | 'Serial'; name: string; ids: string }> = [];
  private cachedScreens: HardwareScanSnapshot['screens'] = [];
  private multiScreenPermission: DisplayPanelInfo['multiScreenPermission'] = 'unsupported';
  private cachedPanelLabel = '';
  private mountedVolumes: MountedVolumeInfo[] = [];
  private deepInventory: ParsedDeepHardwareInventory | null = null;
  private cachedWebGpuSummary = 'Sprawdzanie...';
  private measuredExactHz: number | null = null;
  private edidDetailsNote = '';
  private autoEdidProbed = false;
  private nativeFullBridgeConnected = false;
  private nativeFullBridgeProbed = false;
  private cachedCodecSupport: Record<string, string> = {};
  private cachedAudioDac: { sampleRate: number; maxChannels: number; baseLatencyMs: number } | null = null;
  private cachedWebGlLimits: { maxTex: number; maxRb: number; maxMsaa: number; maxAniso: number; maxVertexUniforms: number } | null = null;
  private last12Scans: ComponentScanCard[] = [];

  constructor() {
    this.restoreSavedEdid();
    void this.autoProbeFullLocalBridge();
    void this.autoProbeLocalEdidBridge();
  }

  public isNativeBridgeActive(): boolean {
    return this.nativeFullBridgeConnected || diskTestService.isNativeBridgeConnected();
  }

  public getLast12ComponentScans(): ComponentScanCard[] {
    return [...this.last12Scans];
  }

  public async autoProbeFullLocalBridge(force = false): Promise<boolean> {
    if (this.nativeFullBridgeProbed && !force) return this.nativeFullBridgeConnected;
    this.nativeFullBridgeProbed = true;
    if (typeof fetch !== 'function' || typeof window === 'undefined') return false;

    const bases = getLocalBridgeBases(force);
    if (bases.length === 0) return false;

    for (const base of bases) {
      const url = `${base}/api/hardware/full`;
      try {
        const ctrl = new AbortController();
        const timer = window.setTimeout(() => ctrl.abort(), 1400);
        const resp = await fetch(url, { signal: ctrl.signal, cache: 'no-store' });
        window.clearTimeout(timer);
        if (!resp.ok) continue;
        const ct = resp.headers.get('content-type') || '';
        if (!ct.includes('json')) continue;
        const text = await resp.text();
        if (text && text.includes('"os"')) {
          const parsed = this.parseDeepHardwareDump(text);
          if (parsed.ok) {
            this.nativeFullBridgeConnected = true;
            if (this.deepInventory?.disks?.length || this.deepInventory?.logicalDisks?.length) {
              diskTestService.registerHardwareInventoryDrives(
                this.deepInventory.disks || [],
                this.deepInventory.logicalDisks || []
              );
            }
            await diskTestService.refreshAvailableDrives();
            return true;
          }
        }
      } catch {
        // Local bridge not available on this endpoint
      }
    }
    return false;
  }

  private restoreSavedEdid(): void {
    try {
      const raw = localStorage.getItem(EDID_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed.label === 'string' && parsed.label.trim()) {
        this.cachedPanelLabel = parsed.label.trim();
        this.edidDetailsNote = typeof parsed.note === 'string' ? parsed.note : 'Zapisany profil EDID matrycy';
      }
    } catch {
      // Ignore storage errors
    }
  }

  private persistSavedEdid(label: string, note: string): void {
    try {
      localStorage.setItem(EDID_STORAGE_KEY, JSON.stringify({ label, note, savedAt: Date.now() }));
    } catch {
      // Ignore
    }
  }

  public async autoProbeLocalEdidBridge(force = false): Promise<boolean> {
    if (this.autoEdidProbed && !force) return Boolean(this.cachedPanelLabel);
    this.autoEdidProbed = true;
    const bases = getLocalBridgeBases(force);
    if (bases.length === 0 || typeof fetch !== 'function') return false;
    for (const base of bases) {
      const url = `${base}/api/edid`;
      try {
        const ctrl = new AbortController();
        const timer = window.setTimeout(() => ctrl.abort(), 1400);
        const resp = await fetch(url, { signal: ctrl.signal, cache: 'no-store' });
        window.clearTimeout(timer);
        if (resp.ok) {
          const text = await resp.text();
          if (text) {
            let payload = text;
            try {
              const parsed = JSON.parse(text);
              if (parsed && typeof parsed.pnpRaw === 'string' && parsed.pnpRaw.trim()) {
                payload = parsed.pnpRaw;
              }
            } catch {
              // Raw string payload
            }
            if (payload.includes('DISPLAY\\') || payload.includes('edidMonitors') || payload.includes('Monitor')) {
              const res = this.importMonitorEdid(payload);
              if (res.ok) return true;
            }
          }
        }
      } catch {
        // Local bridge not running; continue
      }
    }
    return false;
  }

  public async readEdidFromClipboard(): Promise<{ ok: boolean; message: string }> {
    try {
      if (!navigator.clipboard?.readText) {
        return { ok: false, message: 'Schowek Clipboard API wymaga uprawnienia lub wklejenia ręcznego (Ctrl+V).' };
      }
      const clipText = await navigator.clipboard.readText();
      if (!clipText || !clipText.trim()) {
        return { ok: false, message: 'Schowek jest pusty. Najpierw uruchom komendę CMD lub PowerShell albo skopiuj nazwę monitora.' };
      }
      return this.importMonitorEdid(clipText);
    } catch {
      return { ok: false, message: 'Przeglądarka zablokowała automatyczny odczyt schowka — kliknij w pole tekstowe poniżej i naciśnij Ctrl+V.' };
    }
  }

  public getEdidDetailsNote(): string {
    return this.edidDetailsNote;
  }

  public getDeepInventory(): ParsedDeepHardwareInventory | null {
    return this.deepInventory;
  }

  public clearDeepInventory(): void {
    this.deepInventory = null;
  }

  public async scanAll(
    refreshRateHz: number,
    gpuRenderer = '',
    specs?: SystemSpecs | null
  ): Promise<HardwareScanSnapshot> {
    const dpr = Number((window.devicePixelRatio || 1).toFixed(2));
    const logicalW = window.screen.width;
    const logicalH = window.screen.height;
    const nativeW = Math.round(logicalW * dpr);
    const nativeH = Math.round(logicalH * dpr);
    const colorGamut = detectColorGamut();
    const hdrSupported = detectHdrSupport();
    const colorDepthBit = window.screen.colorDepth || 24;
    const orientation = window.screen.orientation?.type || 'landscape-primary';
    const touchPoints = navigator.maxTouchPoints || 0;

    // Check Window Management API support
    const winAny = window as any;
    if (typeof winAny.getScreenDetails === 'function') {
      if (this.multiScreenPermission === 'unsupported') {
        this.multiScreenPermission = 'prompt';
      }
      try {
        if (navigator.permissions?.query) {
          const perm = await navigator.permissions.query({
            name: 'window-management' as PermissionName,
          });
          if (perm.state === 'granted') {
            await this.probeScreenDetailsInternal();
          }
        }
      } catch {
        // Ignore
      }
    }

    // Storage estimate & OPFS check
    const storageSummary = {
      quotaGB: 0,
      usageMB: 0,
      opfsSupported: Boolean(navigator.storage && typeof navigator.storage.getDirectory === 'function'),
      persisted: false,
    };
    try {
      if (navigator.storage?.estimate) {
        const est = await navigator.storage.estimate();
        storageSummary.quotaGB = Number(((est.quota || 0) / (1024 ** 3)).toFixed(1));
        storageSummary.usageMB = Number(((est.usage || 0) / (1024 ** 2)).toFixed(1));
      }
      if (navigator.storage?.persisted) {
        storageSummary.persisted = await navigator.storage.persisted();
      }
    } catch {
      // Ignore
    }

    // Probe WebGPU adapter details
    this.cachedWebGpuSummary = await this.probeWebGpuDetails();

    const devices: DetectedHardwareDevice[] = [];

    // 0A. Core System Subsystems (CPU, GPU, RAM, Storage, Network)
    if (specs) {
      devices.push({
        category: 'Procesor (CPU)',
        name: this.deepInventory?.cpuModel || `${specs.platform} · ${specs.cpuCores} wątków logicznych`,
        details:
          this.deepInventory?.cpuDetails ||
          `${specs.os} · ${specs.browser} · Platforma: ${specs.platform}`,
        status: 'Aktywne',
      });
      devices.push({
        category: 'Karta graficzna (GPU)',
        name: this.deepInventory?.gpus[0]?.name || specs.gpuRenderer,
        details: `${specs.gpuVendor} · WebGL MaxTex: ${specs.maxTextureSize}px · ${this.cachedWebGpuSummary}`,
        status: 'Aktywne',
      });
    }

    // RAM sticks from Deep Inventory OR browser estimate
    if (this.deepInventory && this.deepInventory.ramModules.length > 0) {
      for (const stick of this.deepInventory.ramModules) {
        devices.push({
          category: 'Kość RAM (DIMM)',
          name: `${stick.manufacturer} ${stick.capacityGB} GB ${stick.memoryType} @ ${stick.speedMHz} MHz`,
          details: `Slot: ${stick.slot} · Model: ${stick.partNumber} · S/N: ${stick.serial}`,
          status: 'Aktywne',
        });
      }
    } else {
      const memGB = (navigator as any).deviceMemory as number | undefined;
      const heapInfo = (performance as any).memory;
      const heapLimitGB = heapInfo?.jsHeapSizeLimit
        ? `${(heapInfo.jsHeapSizeLimit / 1024 ** 3).toFixed(1)} GB limit JS Heap`
        : 'Pamięć operacyjna systemu';
      devices.push({
        category: 'Pamięć RAM',
        name: memGB ? `${memGB >= 8 ? '≥ ' : ''}${memGB} GB RAM (wykryto przez przeglądarkę)` : 'Pamięć operacyjna (użyj Skanera SMBIOS dla pełnej listy kości DIMM)',
        details: `${heapLimitGB} · Aby odczytać każdą fizyczną kość DIMM (slot, MHz, DDR4/DDR5, producenta), użyj Skanera 1-Klik poniżej`,
        status: 'Aktywne',
      });
    }

    // Physical Disks from Deep Inventory + Mounted Volumes + OPFS Storage
    if (this.deepInventory && this.deepInventory.disks.length > 0) {
      for (const d of this.deepInventory.disks) {
        devices.push({
          category: 'Dysk fizyczny',
          name: `${d.model} (${d.sizeGB} GB)`,
          details: `Interfejs: ${d.interfaceType} · Typ: ${d.mediaType} · SMART: ${d.status} · S/N: ${d.serial}`,
          status: d.status.toUpperCase().includes('OK') ? 'Aktywne' : 'Wykryto',
        });
      }
    } else {
      devices.push({
        category: 'Dysk / Pamięć masowa',
        name: `Przestrzeń OPFS / Dysku (${storageSummary.quotaGB > 0 ? `pula ${storageSummary.quotaGB} GB` : 'aktywna'})`,
        details: `Zajęto: ${storageSummary.usageMB} MB · OPFS: ${storageSummary.opfsSupported ? 'Tak' : 'Nie'} · Kliknij „Wskaż dysk/partycję” lub „Skaner SMBIOS”, aby odczytać modele NVMe/SSD/HDD`,
        status: 'Aktywne',
      });
    }

    for (const vol of this.mountedVolumes) {
      devices.push({
        category: 'Zamontowany wolumin',
        name: `Dysk / Folder: ${vol.name}`,
        details: `Pozycji w katalogu głównym: ${vol.entryCount}${
          vol.writeTestedMBs !== null ? ` · Zapis: ${vol.writeTestedMBs} MB/s · Odczyt: ${vol.readTestedMBs} MB/s` : ''
        }`,
        status: 'Aktywne',
      });
    }

    if (this.deepInventory?.motherboard) {
      devices.push({
        category: 'Płyta główna / BIOS',
        name: this.deepInventory.motherboard,
        details: `BIOS: ${this.deepInventory.bios || '—'} · System: ${this.deepInventory.computerModel || this.deepInventory.sourceOs}`,
        status: 'Aktywne',
      });
    }

    // 1. Display / Panel entries
    if (this.deepInventory && this.deepInventory.monitors.length > 0) {
      for (const mon of this.deepInventory.monitors) {
        devices.push({
          category: 'Ekran / Matryca EDID',
          name: `${mon.manufacturer} ${mon.model}`.trim() || 'Matryca EDID',
          details: `Natywna ${nativeW}×${nativeH} @ ${refreshRateHz} Hz · ${colorGamut} · ${colorDepthBit}-bit · S/N: ${mon.serial || '—'}`,
          status: 'Aktywne',
        });
      }
    } else if (this.cachedScreens.length > 0) {
      for (const sc of this.cachedScreens) {
        devices.push({
          category: 'Ekran / Matryca',
          name: sc.label || 'Ekran główny',
          details: `${sc.resolution} · DPR ${sc.dpr}× · ${sc.isInternal === true ? 'Matryca wbudowana laptopa' : sc.isInternal === false ? 'Monitor zewnętrzny' : 'Wyświetlacz'}`,
          status: sc.isPrimary ? 'Aktywne' : 'Wykryto',
        });
      }
    } else {
      const inferredLabel = this.cachedPanelLabel || this.buildFallbackPanelName(nativeW, nativeH, refreshRateHz, gpuRenderer);
      devices.push({
        category: 'Ekran / Matryca',
        name: inferredLabel,
        details: `Natywna ${nativeW}×${nativeH} (${logicalW}×${logicalH} @ DPR ${dpr}×) · ${refreshRateHz} Hz · ${colorGamut} · ${colorDepthBit}-bit${hdrSupported ? ' · HDR' : ''}`,
        status: 'Aktywne',
      });
    }

    // Network interfaces
    if (this.deepInventory && this.deepInventory.networkAdapters.length > 0) {
      for (const nic of this.deepInventory.networkAdapters) {
        devices.push({
          category: 'Karta sieciowa (NIC)',
          name: nic,
          details: `Stan sieci: ${navigator.onLine ? 'Online' : 'Offline'}`,
          status: navigator.onLine ? 'Aktywne' : 'Wykryto',
        });
      }
    } else {
      const conn = (navigator as any).connection;
      devices.push({
        category: 'Karta sieciowa (NIC)',
        name: conn?.type ? `Interfejs: ${String(conn.type).toUpperCase()}` : 'Interfejs Wi-Fi / Ethernet',
        details: `Profil: ${conn?.effectiveType || '—'} · Downlink: ${conn?.downlink ?? '—'} Mbps · RTT: ${conn?.rtt ?? '—'} ms`,
        status: navigator.onLine ? 'Aktywne' : 'Wykryto',
      });
    }

    // 2. Media Devices (Speakers, Microphones, Webcams)
    try {
      if (navigator.mediaDevices?.enumerateDevices) {
        const mediaList = await navigator.mediaDevices.enumerateDevices();
        let micIdx = 1;
        let spkIdx = 1;
        let camIdx = 1;
        for (const dev of mediaList) {
          if (dev.kind === 'audiooutput') {
            devices.push({
              category: 'Audio (Wyjście)',
              name: dev.label || `Wyjście audio #${spkIdx} (odblokuj nazwy przyciskiem powyżej)`,
              details: `ID: ${dev.deviceId.slice(0, 12) || 'default'} · Grupa: ${dev.groupId.slice(0, 8) || '—'}`,
              status: dev.deviceId === 'default' ? 'Aktywne' : 'Wykryto',
            });
            spkIdx++;
          } else if (dev.kind === 'audioinput') {
            devices.push({
              category: 'Mikrofon',
              name: dev.label || `Mikrofon #${micIdx} (odblokuj nazwy przyciskiem powyżej)`,
              details: `ID: ${dev.deviceId.slice(0, 12) || 'default'} · Grupa: ${dev.groupId.slice(0, 8) || '—'}`,
              status: dev.deviceId === 'default' ? 'Aktywne' : 'Wykryto',
            });
            micIdx++;
          } else if (dev.kind === 'videoinput') {
            devices.push({
              category: 'Kamera',
              name: dev.label || `Kamera #${camIdx} (odblokuj nazwy przyciskiem powyżej)`,
              details: `ID: ${dev.deviceId.slice(0, 12) || 'video'} · Grupa: ${dev.groupId.slice(0, 8) || '—'}`,
              status: 'Gotowe',
            });
            camIdx++;
          }
        }
      }
    } catch {
      // Ignore
    }

    // 3. Connected Gamepads
    if (typeof navigator.getGamepads === 'function') {
      const pads = Array.from(navigator.getGamepads()).filter((p): p is Gamepad => p !== null);
      for (const pad of pads) {
        devices.push({
          category: 'Kontroler / Pad',
          name: pad.id,
          details: `${pad.buttons.length} przycisków · ${pad.axes.length} osi · Mapping: ${pad.mapping || 'standard'}`,
          status: 'Aktywne',
        });
      }
    }

    // 4. Previously authorized WebUSB / WebHID / Serial devices
    await this.refreshAuthorizedUsbHid();
    for (const u of this.usbHidDevices) {
      devices.push({
        category: 'USB / HID / BT / Serial',
        name: `[${u.bus}] ${u.name}`,
        details: u.ids,
        status: 'Wykryto',
      });
    }

    const resolvedHz = this.measuredExactHz ?? refreshRateHz;
    const edidMonitor = this.deepInventory?.monitors[0];
    const primaryScreen = this.cachedScreens.find((s) => s.isPrimary) || this.cachedScreens[0];
    const panelLabel =
      (edidMonitor ? `${edidMonitor.manufacturer} ${edidMonitor.model}`.trim() : '') ||
      this.cachedPanelLabel ||
      primaryScreen?.label ||
      this.buildFallbackPanelName(nativeW, nativeH, resolvedHz, gpuRenderer);

    const isExtended = Boolean((window.screen as unknown as { isExtended?: boolean }).isExtended);
    const panel: DisplayPanelInfo = {
      label: panelLabel,
      isInternal: primaryScreen ? primaryScreen.isInternal : null,
      isPrimary: true,
      logicalResolution: `${logicalW} × ${logicalH}`,
      nativeResolution: `${nativeW} × ${nativeH}`,
      devicePixelRatio: dpr,
      refreshRateHz: resolvedHz,
      colorDepthBit,
      colorGamut,
      hdrSupported,
      orientation,
      touchPoints,
      estimatedClass:
        this.edidDetailsNote ||
        estimatePanelClass(nativeW, nativeH, resolvedHz, colorGamut, hdrSupported, dpr),
      screenCount: Math.max(
        isExtended ? 2 : 1,
        this.cachedScreens.length,
        this.deepInventory?.monitors.length || 0
      ),
      multiScreenPermission: this.multiScreenPermission,
    };

    return {
      panel,
      screens: this.cachedScreens,
      devices,
      usbHidDevices: [...this.usbHidDevices],
      mountedVolumes: [...this.mountedVolumes],
      deepInventory: this.deepInventory,
      storageSummary,
      webGpuSummary: this.cachedWebGpuSummary,
      lastScanAt: Date.now(),
    };
  }

  private async probeWebGpuDetails(): Promise<string> {
    try {
      const gpu = (navigator as any).gpu;
      if (!gpu?.requestAdapter) return 'WebGPU: brak';
      const adapter = await gpu.requestAdapter({ powerPreference: 'high-performance' });
      if (!adapter) return 'WebGPU: brak adaptera';
      const info = adapter.info || (typeof adapter.requestAdapterInfo === 'function' ? await adapter.requestAdapterInfo() : null);
      const maxBufMB = adapter.limits?.maxBufferSize
        ? Math.round(adapter.limits.maxBufferSize / (1024 * 1024))
        : 0;
      const desc = [info?.vendor, info?.architecture, info?.description || info?.device].filter(Boolean).join(' / ');
      return `WebGPU: ${desc || 'Aktywny'}${maxBufMB ? ` (MaxBuf ${maxBufMB} MB)` : ''}`;
    } catch {
      return 'WebGPU: niedostępny';
    }
  }

  private buildFallbackPanelName(
    nativeW: number,
    nativeH: number,
    hz: number,
    gpuRenderer: string
  ): string {
    const adapterHint = gpuRenderer
      ? gpuRenderer.replace(/ANGLE \(([^,]+),?\s*/i, '').replace(/Direct3D.*|\).*$/gi, '').trim().slice(0, 34)
      : '';
    const resName =
      nativeW >= 3840
        ? 'Matryca 4K UHD'
        : nativeW >= 2560
          ? 'Matryca QHD / 2.5K'
          : nativeW >= 1920
            ? 'Matryca Full HD 1080p'
            : `Matryca ${nativeW}×${nativeH}`;
    return adapterHint ? `${resName} ${hz}Hz (${adapterHint})` : `${resName} ${hz}Hz`;
  }

  private measurePreciseRefreshRate(): Promise<number> {
    return new Promise((resolve) => {
      const deltas: number[] = [];
      let last = 0;
      let count = 0;
      const step = (ts: number) => {
        if (last > 0) {
          const dt = ts - last;
          if (dt > 1 && dt < 60) deltas.push(dt);
        }
        last = ts;
        count++;
        if (count < 38) {
          requestAnimationFrame(step);
        } else {
          if (deltas.length < 6) {
            resolve(60);
            return;
          }
          deltas.sort((a, b) => a - b);
          const median = deltas[Math.floor(deltas.length / 2)];
          const rawHz = 1000 / Math.max(1, median);
          // Snap close to standard panel refresh rates within ±3.5%
          const standards = [60, 75, 90, 100, 120, 144, 165, 170, 175, 180, 200, 240, 280, 300, 360, 480];
          let snapped = Math.round(rawHz);
          for (const std of standards) {
            if (Math.abs(rawHz - std) / std <= 0.035) {
              snapped = std;
              break;
            }
          }
          resolve(snapped);
        }
      };
      requestAnimationFrame(step);
    });
  }

  public async requestExactScreenModel(): Promise<string> {
    const winAny = window as any;
    const measuredHz = await this.measurePreciseRefreshRate();
    this.measuredExactHz = measuredHz;

    // 1. Try local SystemPulse-Pro.exe EDID bridge (/api/edid)
    this.autoEdidProbed = false;
    const bridgeFound = await this.autoProbeLocalEdidBridge();
    if (bridgeFound && this.cachedPanelLabel) {
      return `Automatycznie odczytano fizyczny model matrycy z mostka EDID: ${this.cachedPanelLabel} (${this.edidDetailsNote}) · ${measuredHz} Hz.`;
    }

    // 2. Try reading clipboard automatically if the user already ran CMD/PowerShell EDID command
    try {
      if (navigator.clipboard?.readText) {
        const clip = await navigator.clipboard.readText();
        if (clip && (clip.includes('DISPLAY\\') || clip.includes('edidMonitors') || clip.includes('Monitor'))) {
          const parsedClip = this.importMonitorEdid(clip);
          if (parsedClip.ok) {
            return `${parsedClip.message} · Zmierzono ${measuredHz} Hz.`;
          }
        }
      }
    } catch {
      // Ignore clipboard permission errors
    }

    const dpr = Number((window.devicePixelRatio || 1).toFixed(2));
    const nativeW = Math.round(window.screen.width * dpr);
    const nativeH = Math.round(window.screen.height * dpr);
    const gamut = detectColorGamut();
    const hdr = detectHdrSupport();
    const isExtended = Boolean((window.screen as unknown as { isExtended?: boolean }).isExtended);

    if (typeof winAny.getScreenDetails === 'function') {
      try {
        await this.probeScreenDetailsInternal();
        if (this.cachedScreens.length > 0) {
          return `Wykryto ${this.cachedScreens.length} ekran(y) przez Window Management API: ${this.cachedScreens.map((s) => s.label).join(', ')} · Zmierzono ${measuredHz} Hz (${gamut}${hdr ? ', HDR' : ''}).`;
        }
      } catch {
        // Iframe Permissions-Policy or browser restriction — seamlessly fall back to real browser telemetry + EDID helper
      }
    }

    const resTag =
      nativeW >= 3840 ? '4K UHD' : nativeW >= 2560 ? 'QHD / 2.5K' : nativeW >= 1920 ? 'Full HD' : `${nativeW}×${nativeH}`;
    const detectedLabel = `Matryca ${resTag} ${measuredHz}Hz · ${gamut}${hdr ? ' HDR' : ''}${isExtended ? ' (Multi-Monitor)' : ''}`;
    if (!this.cachedPanelLabel) {
      this.cachedPanelLabel = detectedLabel;
    }
    this.cachedScreens = [
      {
        label: this.cachedPanelLabel,
        resolution: `${nativeW} × ${nativeH}`,
        dpr,
        isPrimary: true,
        isInternal: null,
      },
    ];
    return `Zmierzono na żywo: ${nativeW}×${nativeH} @ ${measuredHz} Hz · ${gamut} · ${window.screen.colorDepth || 24}-bit${hdr ? ' · HDR' : ''}. Aby wczytać dokładny kod chipu EDID z Windows, kliknij „1. Kopiuj komendę CMD”, uruchom w Win+R → cmd, a następnie kliknij „2. Wczytaj EDID ze Schowka (1-Klik)” lub wybierz model z listy szybkich profili EDID poniżej.`;
  }

  public importMonitorEdid(raw: string): { ok: boolean; message: string } {
    const trimmed = raw.trim();
    if (!trimmed) {
      return { ok: false, message: 'Wklej wynik komendy EDID z PowerShell/CMD lub wpisz nazwę monitora.' };
    }

    const firstBrace = trimmed.indexOf('{');
    const lastBrace = trimmed.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace > firstBrace) {
      try {
        const parsed = JSON.parse(trimmed.slice(firstBrace, lastBrace + 1));
        const list = Array.isArray(parsed.edidMonitors)
          ? parsed.edidMonitors
          : Array.isArray(parsed.monitors)
            ? parsed.monitors
            : parsed.m || parsed.n
              ? [parsed]
              : [];

        if (list.length > 0) {
          const dpr = Number((window.devicePixelRatio || 1).toFixed(2));
          const resStr = `${Math.round(window.screen.width * dpr)} × ${Math.round(window.screen.height * dpr)}`;
          const mappedMonitors: Array<{
            manufacturer: string;
            model: string;
            serial: string;
            productCode: string;
            wCm: number;
            hCm: number;
            inch: number;
            year: number;
          }> = list.map((item: any, idx: number) => {
            const rawVendor = String(item.m || '').trim().toUpperCase();
            const rawProd = String(item.p || '').trim().toUpperCase();
            const combinedCode = `${rawVendor}${rawProd}`;
            const knownFullModel = EDID_PRODUCT_CODE_MAP[combinedCode];
            const vendorFull = EDID_VENDOR_MAP[rawVendor] || rawVendor || 'EDID';
            const rawModelName = String(item.n || item.p || `Monitor #${idx + 1}`).trim();
            const modelName = knownFullModel
              ? rawModelName && !knownFullModel.includes(rawModelName)
                ? `${knownFullModel} [${rawModelName}]`
                : knownFullModel
              : rawModelName;
            const serial = String(item.s || '—').trim();
            const inch = Number(item.inch || 0);
            const year = Number(item.y || 0);
            const sizeTag = inch > 5 && !modelName.includes(`${inch}"`) ? ` ${inch}"` : '';
            const yearTag = year >= 2005 ? ` (${year})` : '';
            return {
              manufacturer: vendorFull,
              model: `${modelName}${sizeTag}${yearTag}`.trim(),
              serial,
              productCode: rawProd || combinedCode,
              wCm: Number(item.wCm || 0),
              hCm: Number(item.hCm || 0),
              inch,
              year,
            };
          });

          const first = mappedMonitors[0];
          this.cachedPanelLabel = `${first.manufacturer} ${first.model}`.trim();
          this.edidDetailsNote = [
            first.productCode ? `Kod EDID: ${first.productCode}` : '',
            first.wCm > 0 && first.hCm > 0 ? `Wymiar: ${first.wCm}×${first.hCm} cm (${first.inch}")` : '',
            first.serial && first.serial !== '—' ? `S/N: ${first.serial}` : '',
          ]
            .filter(Boolean)
            .join(' · ');

          this.persistSavedEdid(this.cachedPanelLabel, this.edidDetailsNote);

          this.cachedScreens = mappedMonitors.map((mon, idx) => ({
            label: `${mon.manufacturer} ${mon.model}`.trim(),
            resolution: resStr,
            dpr,
            isPrimary: idx === 0,
            isInternal: mon.inch > 0 && mon.inch <= 18.5 ? true : mon.inch >= 20 ? false : null,
          }));

          if (this.deepInventory) {
            this.deepInventory = {
              ...this.deepInventory,
              monitors: mappedMonitors.map((m) => ({
                manufacturer: m.manufacturer,
                model: m.model,
                serial: m.serial,
              })),
            };
          }

          return {
            ok: true,
            message: `Odczytano i zapisano prawdziwy EDID (${mappedMonitors.length} ekran): ${mappedMonitors.map((m) => `${m.manufacturer} ${m.model}`.trim()).join(', ')}.`,
          };
        }
      } catch {
        // Fall through to plain text model name
      }
    }

    // Native Windows `pnputil /enum-devices /class Monitor` output parser (e.g. DISPLAY\GSM5B7F\...)
    const pnpMatches = Array.from(
      trimmed.matchAll(/DISPLAY\\([A-Z]{3})([0-9A-F]{4})/gi)
    );
    if (pnpMatches.length > 0) {
      const descMatches = Array.from(
        trimmed.matchAll(/(?:Device Description|Opis urz[aą]dzenia)\s*:\s*(.+)/gi)
      ).map((m) => m[1].trim());
      const dpr = Number((window.devicePixelRatio || 1).toFixed(2));
      const resStr = `${Math.round(window.screen.width * dpr)} × ${Math.round(window.screen.height * dpr)}`;

      const seen = new Set<string>();
      const decoded: Array<{ manufacturer: string; model: string; productCode: string }> = [];
      pnpMatches.forEach((m, idx) => {
        const vendorCode = m[1].toUpperCase();
        const prodCode = m[2].toUpperCase();
        const key = `${vendorCode}${prodCode}`;
        if (seen.has(key)) return;
        seen.add(key);
        const knownModel = EDID_PRODUCT_CODE_MAP[key];
        const vendorFull = EDID_VENDOR_MAP[vendorCode] || vendorCode;
        const rawDesc = descMatches[idx] || '';
        const isGeneric = /generic|rodzajowy|pnp monitor|monitor pnp/i.test(rawDesc);
        const modelLabel = knownModel
          ? rawDesc && !isGeneric && !knownModel.includes(rawDesc)
            ? `${knownModel} (${rawDesc}) [${key}]`
            : `${knownModel} [${key}]`
          : rawDesc && !isGeneric
            ? `${rawDesc} (${key})`
            : `Matryca ${key}`;
        decoded.push({
          manufacturer: vendorFull,
          model: modelLabel,
          productCode: key,
        });
      });

      const first = decoded[0];
      this.cachedPanelLabel = `${first.manufacturer} ${first.model}`.trim();
      this.edidDetailsNote = `Kod PnP/EDID: ${first.productCode} (odczyt natywny pnputil · zapisano w pamięci)`;
      this.persistSavedEdid(this.cachedPanelLabel, this.edidDetailsNote);
      this.cachedScreens = decoded.map((mon, idx) => ({
        label: `${mon.manufacturer} ${mon.model}`.trim(),
        resolution: resStr,
        dpr,
        isPrimary: idx === 0,
        isInternal: null,
      }));
      return {
        ok: true,
        message: `Odczytano i zapisano EDID z pnputil (${decoded.length} ekran): ${decoded.map((m) => `${m.manufacturer} ${m.model}`.trim()).join(', ')}.`,
      };
    }

    // Check if user pasted a raw 7-char EDID code like GSM5B7F or DEL426E
    const directCode = trimmed.toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (EDID_PRODUCT_CODE_MAP[directCode]) {
      this.cachedPanelLabel = `${EDID_PRODUCT_CODE_MAP[directCode]} [${directCode}]`;
      this.edidDetailsNote = `Kod matrycy EDID: ${directCode} (zapisano w pamięci)`;
      this.persistSavedEdid(this.cachedPanelLabel, this.edidDetailsNote);
      return {
        ok: true,
        message: `Rozpoznano kod EDID ${directCode}: ${this.cachedPanelLabel}.`,
      };
    }

    // Plain-text fallback (e.g. user pasted monitor name or Linux xrandr/edid line)
    const firstLine = trimmed.split(/\r?\n/)[0].trim().slice(0, 90);
    this.cachedPanelLabel = firstLine;
    this.edidDetailsNote = 'Zapisany profil EDID matrycy / monitora';
    this.persistSavedEdid(this.cachedPanelLabel, this.edidDetailsNote);
    return {
      ok: true,
      message: `Zapisano model matrycy/monitora: ${firstLine}.`,
    };
  }

  private async probeScreenDetailsInternal(): Promise<void> {
    const winAny = window as any;
    const details = await winAny.getScreenDetails();
    this.multiScreenPermission = 'granted';
    this.cachedScreens = (details.screens || []).map((sc: any, idx: number) => ({
      label: sc.label || (sc.isInternal ? `Matryca wbudowana #${idx + 1}` : `Monitor zewnętrzny #${idx + 1}`),
      resolution: `${Math.round(sc.width * (sc.devicePixelRatio || 1))} × ${Math.round(sc.height * (sc.devicePixelRatio || 1))}`,
      dpr: Number((sc.devicePixelRatio || 1).toFixed(2)),
      isPrimary: Boolean(sc.isPrimary),
      isInternal: typeof sc.isInternal === 'boolean' ? sc.isInternal : null,
    }));
    const cur = details.currentScreen;
    if (cur?.label) this.cachedPanelLabel = cur.label;
  }

  public async unlockMediaDeviceNames(): Promise<string> {
    if (!navigator.mediaDevices?.getUserMedia) {
      return 'Brak wsparcia MediaDevices API w tej przeglądarce.';
    }
    try {
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
      } catch {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      }
      stream.getTracks().forEach((t) => t.stop());
      return 'Odblokowano pełne nazwy modeli mikrofonów, głośników i kamer.';
    } catch (err) {
      return err instanceof Error ? `Nie uzyskano zgody: ${err.message}` : 'Odmowa dostępu do urządzeń multimedialnych.';
    }
  }

  public async requestUsbDevice(): Promise<string> {
    const navAny = navigator as any;
    if (!navAny.usb?.requestDevice) {
      return 'WebUSB nie jest obsługiwane w tej przeglądarce (wymaga Chrome/Edge).';
    }
    try {
      const dev = await navAny.usb.requestDevice({ filters: [] });
      const name = [dev.manufacturerName, dev.productName].filter(Boolean).join(' ') || 'Urządzenie USB';
      const ids = `VID: 0x${dev.vendorId.toString(16).padStart(4, '0').toUpperCase()} · PID: 0x${dev.productId.toString(16).padStart(4, '0').toUpperCase()}`;
      this.upsertBusDevice({ bus: 'USB', name, ids });
      return `Dodano urządzenie USB: ${name} (${ids})`;
    } catch (err) {
      return err instanceof Error ? `Anulowano wybór USB: ${err.message}` : 'Anulowano skanowanie USB.';
    }
  }

  public async requestHidDevice(): Promise<string> {
    const navAny = navigator as any;
    if (!navAny.hid?.requestDevice) {
      return 'WebHID nie jest obsługiwane w tej przeglądarce (wymaga Chrome/Edge).';
    }
    try {
      const devs = await navAny.hid.requestDevice({ filters: [] });
      if (!devs || devs.length === 0) return 'Nie wybrano urządzenia HID.';
      for (const dev of devs) {
        const name = dev.productName || 'Urządzenie HID (Klawiatura/Mysz/Touchpad/Pad)';
        const ids = `VID: 0x${dev.vendorId.toString(16).padStart(4, '0').toUpperCase()} · PID: 0x${dev.productId.toString(16).padStart(4, '0').toUpperCase()}`;
        this.upsertBusDevice({ bus: 'HID', name, ids });
      }
      return `Wykryto ${devs.length} urządzenie(a) HID.`;
    } catch (err) {
      return err instanceof Error ? `Anulowano wybór HID: ${err.message}` : 'Anulowano skanowanie HID.';
    }
  }

  public async requestBluetoothDevice(): Promise<string> {
    const navAny = navigator as any;
    if (!navAny.bluetooth?.requestDevice) {
      return 'Web Bluetooth nie jest obsługiwane w tej przeglądarce.';
    }
    try {
      const dev = await navAny.bluetooth.requestDevice({ acceptAllDevices: true });
      const name = dev.name || 'Urządzenie Bluetooth';
      const ids = `BT ID: ${String(dev.id || '—').slice(0, 18)}`;
      this.upsertBusDevice({ bus: 'Bluetooth', name, ids });
      return `Wykryto Bluetooth: ${name}`;
    } catch (err) {
      return err instanceof Error ? `Anulowano skan Bluetooth: ${err.message}` : 'Anulowano skan Bluetooth.';
    }
  }

  public async requestSerialPort(): Promise<string> {
    const navAny = navigator as any;
    if (!navAny.serial?.requestPort) {
      return 'Web Serial nie jest obsługiwane w tej przeglądarce (wymaga Chrome/Edge).';
    }
    try {
      const port = await navAny.serial.requestPort();
      const info = port.getInfo?.() || {};
      const ids = info.usbVendorId
        ? `USB VID: 0x${info.usbVendorId.toString(16).padStart(4, '0').toUpperCase()} · PID: 0x${(info.usbProductId || 0).toString(16).padStart(4, '0').toUpperCase()}`
        : 'Port szeregowy COM / UART';
      this.upsertBusDevice({ bus: 'Serial', name: 'Port COM / UART', ids });
      return `Dodano port szeregowy (${ids})`;
    } catch (err) {
      return err instanceof Error ? `Anulowano wybór portu COM: ${err.message}` : 'Anulowano skan Serial.';
    }
  }

  /**
   * Uses File System Access API to pick ANY physical drive/partition (C:, D:, NVMe, USB)
   * and executes a real 16 MB temporary write/read speed probe directly on that disk!
   */
  public async pickAndProbePhysicalDrive(): Promise<string> {
    const winAny = window as any;
    if (typeof winAny.showDirectoryPicker !== 'function') {
      return 'Przeglądarka nie wspiera File System Access API (użyj Chrome/Edge desktop do testowania dowolnego dysku C:/D:/USB).';
    }
    try {
      const dirHandle = await winAny.showDirectoryPicker({ mode: 'readwrite' });
      let entryCount = 0;
      for await (const _ of dirHandle.values()) {
        entryCount++;
        if (entryCount >= 500) break;
      }

      let writeTestedMBs: number | null = null;
      let readTestedMBs: number | null = null;
      const probeFileName = `.systempulse_probe_${Date.now()}.tmp`;
      try {
        const sizeMB = 16;
        const payload = new Uint8Array(sizeMB * 1024 * 1024);
        for (let i = 0; i < payload.length; i += 4096) payload[i] = (i * 31) & 0xff;

        const fh = await dirHandle.getFileHandle(probeFileName, { create: true });
        const t0 = performance.now();
        const writable = await fh.createWritable();
        await writable.write(payload);
        await writable.close();
        const t1 = performance.now();
        writeTestedMBs = Math.round((sizeMB / Math.max(0.005, (t1 - t0) / 1000)) * 10) / 10;

        const r0 = performance.now();
        const file = await fh.getFile();
        await file.arrayBuffer();
        const r1 = performance.now();
        readTestedMBs = Math.round((sizeMB / Math.max(0.005, (r1 - r0) / 1000)) * 10) / 10;

        await dirHandle.removeEntry(probeFileName);
      } catch {
        // Read-only folder; keep count without write probe
      }

      const info: MountedVolumeInfo = {
        name: dirHandle.name || 'Wybrany dysk',
        entryCount,
        writeTestedMBs,
        readTestedMBs,
        testedAt: Date.now(),
      };
      this.mountedVolumes = [info, ...this.mountedVolumes.filter((v) => v.name !== info.name)].slice(0, 8);
      return writeTestedMBs !== null
        ? `Przetestowano dysk „${info.name}”: zapis ${writeTestedMBs} MB/s, odczyt ${readTestedMBs} MB/s.`
        : `Zamontowano wolumin „${info.name}” (${entryCount} elementów, tryb tylko do odczytu).`;
    } catch (err) {
      return err instanceof Error ? `Anulowano wybór dysku: ${err.message}` : 'Anulowano wybór dysku.';
    }
  }

  /**
   * Parses deep SMBIOS / hardware inventory output from Windows PowerShell JSON,
   * macOS system_profiler JSON, or Linux lscpu/dmidecode/lsblk text dump.
   */
  public parseDeepHardwareDump(raw: string): { ok: boolean; message: string; inventory: ParsedDeepHardwareInventory | null } {
    const trimmed = raw.trim();
    if (!trimmed) {
      return { ok: false, message: 'Wklej wynik komendy diagnostycznej z PowerShell / Terminala.', inventory: null };
    }

    const preview = trimmed.length > 1400 ? `${trimmed.slice(0, 1400)}\n... [skrócono ${trimmed.length - 1400} znaków]` : trimmed;

    // 1. Try JSON (Windows PowerShell or macOS system_profiler)
    const firstBrace = trimmed.indexOf('{');
    const lastBrace = trimmed.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace > firstBrace) {
      try {
        const json = JSON.parse(trimmed.slice(firstBrace, lastBrace + 1));
        if (json.os === 'Windows' || json.ram || json.disks || json.logicalDisks || json.board) {
          const inv = this.parseWindowsJson(json, trimmed.split('\n').length);
          inv.rawDumpPreview = preview;
          this.deepInventory = inv;
          if (inv.disks.length > 0 || (inv.logicalDisks && inv.logicalDisks.length > 0)) {
            diskTestService.registerHardwareInventoryDrives(inv.disks, inv.logicalDisks || []);
          }
          const partCount = inv.logicalDisks?.length || 0;
          return {
            ok: true,
            message: `Zaimportowano pełną specyfikację Windows: ${inv.ramModules.length} kość(ci) RAM, ${inv.disks.length} dysk(ów) fiz., ${partCount} partycji, ${inv.gpus.length} GPU, ${inv.monitors.length} matryc(y).`,
            inventory: inv,
          };
        }
        if (json.SPHardwareDataType || json.SPMemoryDataType || json.SPDisplaysDataType) {
          const inv = this.parseMacOsJson(json, trimmed.split('\n').length);
          inv.rawDumpPreview = preview;
          this.deepInventory = inv;
          if (inv.disks.length > 0) {
            diskTestService.registerHardwareInventoryDrives(inv.disks, []);
          }
          return {
            ok: true,
            message: `Zaimportowano pełną specyfikację macOS: ${inv.ramModules.length} kość(ci) RAM, ${inv.disks.length} dysk(ów).`,
            inventory: inv,
          };
        }
      } catch {
        // Fallback to plain-text Linux/generic parser
      }
    }

    // 2. Fallback Linux / Text parser (dmidecode / lsblk / lscpu / lspci / wmic)
    const inv = this.parseLinuxOrTextDump(trimmed);
    inv.rawDumpPreview = preview;
    this.deepInventory = inv;
    if (inv.disks.length > 0) {
      diskTestService.registerHardwareInventoryDrives(inv.disks, []);
    }
    return {
      ok: true,
      message: `Przeanalizowano raport tekstowy: ${inv.ramModules.length} modułów RAM, ${inv.disks.length} dysków, ${inv.gpus.length} GPU.`,
      inventory: inv,
    };
  }

  private parseWindowsJson(json: any, rawLineCount: number): ParsedDeepHardwareInventory {
    const toArr = <T>(v: T | T[] | null | undefined): T[] => (Array.isArray(v) ? v : v ? [v] : []);

    const sys = toArr(json.sys)[0] as any;
    const board = toArr(json.board)[0] as any;
    const bios = toArr(json.bios)[0] as any;
    const cpu = toArr(json.cpu)[0] as any;

    const ramModules: ParsedRamModule[] = toArr(json.ram).map((m: any, idx: number) => ({
      slot: [m.BankLabel, m.DeviceLocator].filter(Boolean).join(' / ') || `DIMM #${idx + 1}`,
      manufacturer: String(m.Manufacturer || 'Nieznany').trim(),
      partNumber: String(m.PartNumber || '—').trim(),
      capacityGB: Math.round((Number(m.Capacity || 0) / 1024 ** 3) * 10) / 10,
      speedMHz: Number(m.Speed || 0),
      memoryType: decodeSmbiosMemoryType(m.SMBIOSMemoryType),
      serial: String(m.SerialNumber || '—').trim(),
    }));

    const disks: ParsedDiskDrive[] = toArr(json.disks).map((d: any) => ({
      model: String(d.Model || 'Dysk fizyczny').trim(),
      interfaceType: String(d.InterfaceType || 'NVMe/SATA').trim(),
      mediaType: String(d.MediaType || 'Fixed').trim(),
      sizeGB: Math.round((Number(d.Size || 0) / 1000 ** 3) * 10) / 10,
      status: String(d.Status || 'OK').trim(),
      serial: String(d.SerialNumber || '—').trim(),
    }));

    const logicalDisks: ParsedLogicalDisk[] = toArr(json.logicalDisks)
      .filter((ld: any) => ld && (ld.DeviceID || ld.letter))
      .map((ld: any) => ({
        letter: String(ld.DeviceID || ld.letter).trim(),
        volumeName: String(ld.VolumeName || ld.volumeName || '').trim(),
        fileSystem: String(ld.FileSystem || ld.fileSystem || 'NTFS').trim(),
        totalGB: Number(ld.Size || 0) > 1e6 ? Math.round((Number(ld.Size) / 1024 ** 3) * 10) / 10 : Number(ld.totalGB || 0),
        freeGB: Number(ld.FreeSpace || 0) > 1e6 ? Math.round((Number(ld.FreeSpace) / 1024 ** 3) * 10) / 10 : Number(ld.freeGB || 0),
        driveType: ld.DriveType ?? ld.driveType ?? 3,
      }));

    const gpus = toArr(json.gpu).map((g: any) => {
      const vramBytes = Number(g.AdapterRAM || 0);
      const vramGB = vramBytes > 0 ? `${(vramBytes / 1024 ** 3).toFixed(1)} GB` : 'Współdzielona / >4GB';
      return {
        name: String(g.Name || 'GPU').trim(),
        vramGB,
        driver: String(g.DriverVersion || '—').trim(),
      };
    });

    const monitors = toArr(json.monitors)
      .filter((m: any) => m && (m.m || m.n))
      .map((m: any) => ({
        manufacturer: String(m.m || '').trim(),
        model: String(m.n || 'Monitor EDID').trim(),
        serial: String(m.s || '—').trim(),
      }));

    return {
      sourceOs: 'Windows',
      importedAt: Date.now(),
      computerModel: [sys?.Manufacturer, sys?.Model].filter(Boolean).join(' ').trim() || 'PC / Laptop Windows',
      motherboard: [board?.Manufacturer, board?.Product].filter(Boolean).join(' ').trim() || '—',
      bios: [bios?.Manufacturer, bios?.SMBIOSBIOSVersion].filter(Boolean).join(' ').trim() || '—',
      cpuModel: String(cpu?.Name || '').trim(),
      cpuDetails: cpu
        ? `${cpu.NumberOfCores || '?'} rdzeni / ${cpu.NumberOfLogicalProcessors || '?'} wątków · Taktowanie bazowe/max: ${cpu.MaxClockSpeed || '?'} MHz`
        : '',
      gpus,
      ramModules,
      disks,
      logicalDisks,
      monitors,
      battery: '',
      networkAdapters: toArr(json.net).map((n: any) => String(n).trim()).filter(Boolean),
      rawLineCount,
    };
  }

  private parseMacOsJson(json: any, rawLineCount: number): ParsedDeepHardwareInventory {
    const hw = (json.SPHardwareDataType || [])[0] || {};
    const displays = json.SPDisplaysDataType || [];
    const memGroups = json.SPMemoryDataType || [];
    const nvme = json.SPNVMeDataType || [];

    const ramModules: ParsedRamModule[] = [];
    for (const grp of memGroups) {
      for (const item of grp._items || []) {
        const capNum = parseFloat(String(item.dimm_size || '0')) || 0;
        ramModules.push({
          slot: String(item._name || 'DIMM'),
          manufacturer: String(item.dimm_manufacturer || 'Apple / OEM'),
          partNumber: String(item.dimm_part_number || '—'),
          capacityGB: capNum,
          speedMHz: parseInt(String(item.dimm_speed || '0'), 10) || 0,
          memoryType: String(item.dimm_type || 'LPDDR/DDR'),
          serial: String(item.dimm_serial_number || '—'),
        });
      }
    }

    const disks: ParsedDiskDrive[] = [];
    for (const ctrl of nvme) {
      for (const d of ctrl._items || []) {
        const cap = parseFloat(String(d.size || '0')) || 0;
        disks.push({
          model: String(d.device_model || d._name || 'Apple NVMe SSD'),
          interfaceType: 'NVMe PCIe',
          mediaType: 'SSD',
          sizeGB: cap > 10 ? cap : cap * 1000,
          status: String(d.smart_status || 'OK'),
          serial: String(d.device_serial || '—'),
        });
      }
    }

    const gpus = displays.map((g: any) => ({
      name: String(g.sppci_model || g._name || 'Apple/AMD GPU'),
      vramGB: String(g.spdisplays_vram || g.sppci_cores ? `${g.sppci_cores} rdzeni GPU` : 'Unified'),
      driver: 'Metal / macOS',
    }));

    return {
      sourceOs: 'macOS',
      importedAt: Date.now(),
      computerModel: `${hw.machine_name || 'Mac'} (${hw.machine_model || ''})`.trim(),
      motherboard: `Apple Logic Board (${hw.machine_model || '—'})`,
      bios: String(hw.boot_rom_version || 'EFI'),
      cpuModel: String(hw.chip_type || hw.cpu_type || 'Apple Silicon / Intel'),
      cpuDetails: `${hw.number_processors || ''} · Pamięć: ${hw.physical_memory || ''}`.trim(),
      gpus,
      ramModules,
      disks,
      monitors: [],
      battery: '',
      networkAdapters: [],
      rawLineCount,
    };
  }

  private parseLinuxOrTextDump(text: string): ParsedDeepHardwareInventory {
    const lines = text.split(/\r?\n/);
    const cpuLine = lines.find((l) => /model name\s*:/i.test(l));
    const cpuModel = cpuLine ? cpuLine.split(':').slice(1).join(':').trim() : '';

    const ramModules: ParsedRamModule[] = [];
    let currentStick: Partial<ParsedRamModule> | null = null;
    for (const line of lines) {
      if (/^\s*Size:\s*(\d+)\s*(GB|MB)/i.test(line)) {
        if (currentStick && currentStick.capacityGB) {
          ramModules.push({
            slot: currentStick.slot || `DIMM #${ramModules.length + 1}`,
            manufacturer: currentStick.manufacturer || 'OEM',
            partNumber: currentStick.partNumber || '—',
            capacityGB: currentStick.capacityGB,
            speedMHz: currentStick.speedMHz || 0,
            memoryType: currentStick.memoryType || 'DDR',
            serial: currentStick.serial || '—',
          });
        }
        const m = line.match(/Size:\s*(\d+)\s*(GB|MB)/i);
        const val = m ? Number(m[1]) / (m[2].toUpperCase() === 'MB' ? 1024 : 1) : 0;
        currentStick = { capacityGB: Math.round(val * 10) / 10 };
      } else if (currentStick) {
        if (/Locator:/i.test(line) && !currentStick.slot) currentStick.slot = line.split(':').slice(1).join(':').trim();
        if (/Type:/i.test(line) && !/Detail/i.test(line)) currentStick.memoryType = line.split(':').slice(1).join(':').trim();
        if (/Speed:\s*(\d+)/i.test(line)) currentStick.speedMHz = Number(line.match(/(\d+)/)?.[1] || 0);
        if (/Manufacturer:/i.test(line)) currentStick.manufacturer = line.split(':').slice(1).join(':').trim();
        if (/Part Number:/i.test(line)) currentStick.partNumber = line.split(':').slice(1).join(':').trim();
      }
    }
    if (currentStick && currentStick.capacityGB) {
      ramModules.push({
        slot: currentStick.slot || `DIMM #${ramModules.length + 1}`,
        manufacturer: currentStick.manufacturer || 'OEM',
        partNumber: currentStick.partNumber || '—',
        capacityGB: currentStick.capacityGB,
        speedMHz: currentStick.speedMHz || 0,
        memoryType: currentStick.memoryType || 'DDR',
        serial: currentStick.serial || '—',
      });
    }

    const disks: ParsedDiskDrive[] = [];
    let inDisks = false;
    for (const line of lines) {
      if (line.includes('---DISKS---')) {
        inDisks = true;
        continue;
      }
      if (line.startsWith('---') && inDisks) {
        inDisks = false;
        continue;
      }
      if (inDisks && /^(nvme|sd[a-z]|vd[a-z]|hd[a-z])/i.test(line.trim())) {
        const parts = line.trim().split(/\s+/);
        disks.push({
          model: parts.slice(1, -3).join(' ') || parts[0],
          interfaceType: parts[0].startsWith('nvme') ? 'NVMe' : 'SATA/SCSI',
          mediaType: parts.includes('0') ? 'SSD' : 'HDD/SSD',
          sizeGB: parseFloat(parts.find((p) => /^\d+(\.\d+)?[GT]$/i.test(p)) || '0') || 0,
          status: 'OK',
          serial: parts[parts.length - 1] || '—',
        });
      }
    }

    const gpus = lines
      .filter((l) => /vga compatible|3d controller|display controller/i.test(l))
      .map((l) => ({
        name: l.split(':').slice(2).join(':').trim() || l.trim(),
        vramGB: '—',
        driver: 'Linux DRM',
      }));

    return {
      sourceOs: 'Linux',
      importedAt: Date.now(),
      computerModel: 'PC / Laptop Linux',
      motherboard: 'Sprawdź sekcję ---BOARD---',
      bios: '—',
      cpuModel: cpuModel || 'Wykryty procesor',
      cpuDetails: '',
      gpus,
      ramModules,
      disks,
      monitors: [],
      battery: '',
      networkAdapters: [],
      rawLineCount: lines.length,
    };
  }

  private upsertBusDevice(entry: { bus: 'USB' | 'HID' | 'Bluetooth' | 'Serial'; name: string; ids: string }): void {
    const exists = this.usbHidDevices.some((d) => d.bus === entry.bus && d.ids === entry.ids && d.name === entry.name);
    if (!exists) this.usbHidDevices.push(entry);
  }

  private async refreshAuthorizedUsbHid(): Promise<void> {
    const navAny = navigator as any;
    try {
      if (navAny.usb?.getDevices) {
        const list = await navAny.usb.getDevices();
        for (const dev of list) {
          const name = [dev.manufacturerName, dev.productName].filter(Boolean).join(' ') || 'Urządzenie USB';
          const ids = `VID: 0x${dev.vendorId.toString(16).padStart(4, '0').toUpperCase()} · PID: 0x${dev.productId.toString(16).padStart(4, '0').toUpperCase()}`;
          this.upsertBusDevice({ bus: 'USB', name, ids });
        }
      }
    } catch {
      // Ignore
    }
    try {
      if (navAny.hid?.getDevices) {
        const list = await navAny.hid.getDevices();
        for (const dev of list) {
          const name = dev.productName || 'Urządzenie HID';
          const ids = `VID: 0x${dev.vendorId.toString(16).padStart(4, '0').toUpperCase()} · PID: 0x${dev.productId.toString(16).padStart(4, '0').toUpperCase()}`;
          this.upsertBusDevice({ bus: 'HID', name, ids });
        }
      }
    } catch {
      // Ignore
    }
  }

  private async probeHardwareCodecs(): Promise<Record<string, string>> {
    if (Object.keys(this.cachedCodecSupport).length > 0) return this.cachedCodecSupport;
    const out: Record<string, string> = {
      'H.264 (AVC 4K60)': 'Sprawdzanie',
      'H.265 (HEVC 4K60)': 'Sprawdzanie',
      'VP9 (4K60 HDR)': 'Sprawdzanie',
      'AV1 (4K60)': 'Sprawdzanie',
    };
    const tests: Array<[string, string]> = [
      ['H.264 (AVC 4K60)', 'video/mp4; codecs="avc1.640034"'],
      ['H.265 (HEVC 4K60)', 'video/mp4; codecs="hvc1.1.6.L153.B0"'],
      ['VP9 (4K60 HDR)', 'video/webm; codecs="vp09.02.51.10.01.09.16.09.00"'],
      ['AV1 (4K60)', 'video/mp4; codecs="av01.0.12M.08"'],
    ];
    try {
      const mc = navigator.mediaCapabilities;
      if (mc && typeof mc.decodingInfo === 'function') {
        await Promise.all(
          tests.map(async ([label, contentType]) => {
            try {
              const info = await mc.decodingInfo({
                type: 'file',
                video: { contentType, width: 3840, height: 2160, bitrate: 25000000, framerate: 60 },
              });
              out[label] = info.supported
                ? info.powerEfficient
                  ? 'Sprzętowy GPU (HW)'
                  : 'Programowy (SW)'
                : 'Brak wsparcia';
            } catch {
              out[label] = 'Nieobsługiwany';
            }
          })
        );
      }
    } catch {
      // Ignore codec capability errors
    }
    this.cachedCodecSupport = out;
    return out;
  }

  private probeAudioDacInfo(): { sampleRate: number; maxChannels: number; baseLatencyMs: number } {
    if (this.cachedAudioDac) return this.cachedAudioDac;
    const info = { sampleRate: 48000, maxChannels: 2, baseLatencyMs: 0 };
    try {
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (Ctx) {
        const ctx = new Ctx();
        info.sampleRate = ctx.sampleRate || 48000;
        info.maxChannels = ctx.destination?.maxChannelCount || 2;
        info.baseLatencyMs = Number(((ctx.baseLatency || 0) * 1000).toFixed(2));
        void ctx.close().catch(() => {});
      }
    } catch {
      // Ignore AudioContext init restrictions
    }
    this.cachedAudioDac = info;
    return info;
  }

  private probeWebGlLimits(): { maxTex: number; maxRb: number; maxMsaa: number; maxAniso: number; maxVertexUniforms: number } {
    if (this.cachedWebGlLimits) return this.cachedWebGlLimits;
    const out = { maxTex: 8192, maxRb: 8192, maxMsaa: 4, maxAniso: 16, maxVertexUniforms: 1024 };
    try {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl2');
      if (gl) {
        out.maxTex = Number(gl.getParameter(gl.MAX_TEXTURE_SIZE)) || 8192;
        out.maxRb = Number(gl.getParameter(gl.MAX_RENDERBUFFER_SIZE)) || 8192;
        out.maxMsaa = Number(gl.getParameter(gl.MAX_SAMPLES)) || 4;
        out.maxVertexUniforms = Number(gl.getParameter(gl.MAX_VERTEX_UNIFORM_VECTORS)) || 1024;
        const ext = gl.getExtension('EXT_texture_filter_anisotropic');
        if (ext) {
          out.maxAniso = Number(gl.getParameter(ext.MAX_TEXTURE_MAX_ANISOTROPY_EXT)) || 16;
        }
        gl.getExtension('WEBGL_lose_context')?.loseContext();
      }
    } catch {
      // Ignore WebGL probe failures
    }
    this.cachedWebGlLimits = out;
    return out;
  }

  public async scanAll12Components(context: {
    specs: SystemSpecs | null;
    scan: HardwareScanSnapshot | null;
    ramState: RamTestResult;
    diskState: DiskTestResult;
    gpuState: GpuStressMetrics;
    batteryState: BatteryHealthState;
    networkState: NetworkTestResult;
    drives: DiskDriveTarget[];
    liveSensorsCount: number;
    liveCpuTempC: number | null;
    liveGpuTempC: number | null;
  }): Promise<ComponentScanCard[]> {
    await this.autoProbeFullLocalBridge(false);
    const [codecs] = await Promise.all([this.probeHardwareCodecs()]);
    const audioDac = this.probeAudioDacInfo();
    const glLim = this.probeWebGlLimits();
    const deep = this.deepInventory;
    const specs = context.specs;
    const scan = context.scan;
    const now = Date.now();
    const isNative = this.isNativeBridgeActive();
    const srcDefault: ComponentScanCard['source'] = isNative ? 'Auto (.EXE Native)' : 'Auto (Web API)';

    const hasWasmSimd = typeof WebAssembly === 'object' && typeof SharedArrayBuffer !== 'undefined';
    const cpuModel = deep?.cpuModel || `${specs?.platform || 'x86-64'} · ${specs?.cpuCores || navigator.hardwareConcurrency || 4} wątków`;
    const gpuName = deep?.gpus[0]?.name || specs?.gpuRenderer || 'Wykryty GPU WebGL2';
    const ramTotalGB = deep?.ramModules?.length
      ? deep.ramModules.reduce((acc, m) => acc + m.capacityGB, 0)
      : typeof specs?.deviceMemory === 'number'
        ? specs.deviceMemory
        : 0;
    const drives = context.drives.length > 0 ? context.drives : diskTestService.getAvailableDrives();
    const activeDrive = diskTestService.getSelectedDrive();
    const mediaDevs = (scan?.devices || []).filter((d) => ['Audio (Wyjście)', 'Mikrofon', 'Kamera'].includes(d.category));
    const hwCodecsCount = Object.values(codecs).filter((v) => v.includes('HW')).length;
    const padsCount =
      typeof navigator.getGamepads === 'function'
        ? Array.from(navigator.getGamepads()).filter((p) => p !== null).length
        : 0;

    const cards: ComponentScanCard[] = [
      {
        id: 'cpu',
        title: '1. Procesor (CPU & ISA)',
        category: 'CPU',
        status: 'OK',
        score: deep?.cpuModel ? 98 : 88,
        headline: cpuModel,
        summary: deep?.cpuDetails || `${specs?.cpuCores || navigator.hardwareConcurrency || 4} wątków logicznych · WASM/SIMD: ${hasWasmSimd ? 'Aktywne' : 'Standard'}`,
        source: deep?.cpuModel ? (isNative ? 'Auto (.EXE Native)' : 'SMBIOS') : 'Auto (Web API)',
        metrics: [
          { label: 'Wątki', value: `${specs?.cpuCores || navigator.hardwareConcurrency || 4}` },
          { label: 'Architektura', value: specs?.platform?.split('·')[1]?.trim() || 'x86-64' },
          { label: 'Temp. Live', value: context.liveCpuTempC !== null ? `${context.liveCpuTempC.toFixed(1)} °C` : 'Brak LHM' },
        ],
        scannedAt: now,
      },
      {
        id: 'gpu',
        title: '2. Karta Graficzna (GPU 3D & WebGPU)',
        category: 'GPU',
        status: context.gpuState.isSoftwareGl ? 'UWAGA' : 'OK',
        score: context.gpuState.isSoftwareGl ? 52 : 96,
        headline: gpuName.slice(0, 62),
        summary: `${specs?.webglVersion || 'WebGL 2.0'} · ${scan?.webGpuSummary || 'WebGPU Gotowy'}`,
        source: deep?.gpus?.length ? (isNative ? 'Auto (.EXE Native)' : 'SMBIOS') : 'Auto (Web API)',
        metrics: [
          { label: 'Max Tekstura', value: `${glLim.maxTex}px` },
          { label: 'MSAA / AF', value: `${glLim.maxMsaa}× / ${glLim.maxAniso}×` },
          { label: 'VRAM / Ster.', value: deep?.gpus[0]?.vramGB || (context.liveGpuTempC !== null ? `${context.liveGpuTempC.toFixed(0)} °C` : 'Sprzętowy') },
        ],
        scannedAt: now,
      },
      {
        id: 'ram',
        title: '3. Pamięć RAM (DIMM & Heap)',
        category: 'RAM',
        status: context.ramState.errorsFound > 0 ? 'UWAGA' : 'OK',
        score: context.ramState.errorsFound > 0 ? 45 : deep?.ramModules?.length ? 97 : 86,
        headline: deep?.ramModules?.length
          ? `${ramTotalGB} GB (${deep.ramModules.length}× ${deep.ramModules[0].memoryType} @ ${deep.ramModules[0].speedMHz} MHz)`
          : `${ramTotalGB > 0 ? `≥ ${ramTotalGB} GB RAM` : 'Pamięć operacyjna aktywna'}`,
        summary: context.ramState.bandwidthReadMBs > 0
          ? `Odczyt ${context.ramState.bandwidthReadMBs.toLocaleString('pl-PL')} MB/s · Opóźnienie ${context.ramState.latencyNs} ns · ${context.ramState.errorsFound} błędów`
          : 'Auto-detekcja pamięci zakończona — uruchom test 14-etapowy MemTest86+ dla przepustowości.',
        source: deep?.ramModules?.length ? (isNative ? 'Auto (.EXE Native)' : 'SMBIOS') : 'Auto (Web API)',
        metrics: [
          { label: 'Kości DIMM', value: deep?.ramModules?.length ? `${deep.ramModules.length} wykryte` : 'Web Heap' },
          { label: 'Read MB/s', value: context.ramState.bandwidthReadMBs > 0 ? `${context.ramState.bandwidthReadMBs}` : '—' },
          { label: 'Błędy', value: `${context.ramState.errorsFound}` },
        ],
        scannedAt: now,
      },
      {
        id: 'disk',
        title: '4. Dyski i Partycje (NVMe / SSD / USB)',
        category: 'DISK',
        status: context.diskState.smartStatus === 'KRYTYCZNY' ? 'UWAGA' : 'OK',
        score: context.diskState.smartHealthPct || 94,
        headline: `${drives.length} dysk(ów) / woluminów · Aktywny: ${activeDrive.path}`,
        summary: deep?.disks?.length
          ? deep.disks.map((d) => `${d.model} (${d.sizeGB} GB)`).join(' · ')
          : `Aktywny cel testu: ${activeDrive.label} (${activeDrive.interfaceType})`,
        source: drives.some((d) => d.kind === 'native_exe') ? 'Auto (.EXE Native)' : 'Auto (Web API)',
        metrics: [
          { label: 'Wykryte dyski', value: `${drives.length}` },
          { label: 'Seq Read/Write', value: context.diskState.seqReadMBs > 0 ? `${context.diskState.seqReadMBs}/${context.diskState.seqWriteMBs}` : 'Gotowy' },
          { label: 'SMART', value: `${context.diskState.smartStatus} (${context.diskState.smartHealthPct}%)` },
        ],
        scannedAt: now,
      },
      {
        id: 'board',
        title: '5. Płyta Główna, BIOS & Chipset',
        category: 'BOARD',
        status: deep?.motherboard ? 'OK' : 'WYKRYTO',
        score: deep?.motherboard ? 96 : 80,
        headline: deep?.motherboard || specs?.os || 'Platforma PC / Laptop',
        summary: deep?.bios
          ? `BIOS/UEFI: ${deep.bios} · Model: ${deep.computerModel}`
          : `${specs?.platform || 'Desktop'} · Zegar precyzyjny HR-Timer aktywny`,
        source: deep?.motherboard ? (isNative ? 'Auto (.EXE Native)' : 'SMBIOS') : 'Auto (Web API)',
        metrics: [
          { label: 'System OS', value: specs?.os || 'Windows/Linux' },
          { label: 'BIOS', value: deep?.bios ? deep.bios.slice(0, 18) : 'Auto-Web' },
          { label: 'Mostek .EXE', value: isNative ? 'POŁĄCZONY' : 'Tryb Web' },
        ],
        scannedAt: now,
      },
      {
        id: 'display',
        title: '6. Ekran, Matryca & EDID',
        category: 'DISPLAY',
        status: 'OK',
        score: 95,
        headline: scan?.panel?.label || `${specs?.screenResolution || '1920×1080'} @ ${specs?.estimatedRefreshRate || 60}Hz`,
        summary: `${scan?.panel?.nativeResolution || specs?.screenResolution || '—'} · ${scan?.panel?.refreshRateHz || specs?.estimatedRefreshRate || 60} Hz · ${scan?.panel?.colorGamut || 'sRGB'} · ${scan?.panel?.hdrSupported ? 'HDR Aktywne' : 'SDR'}`,
        source: this.cachedPanelLabel ? (isNative ? 'Auto (.EXE Native)' : 'Live Probe') : 'Auto (Web API)',
        metrics: [
          { label: 'Odświeżanie', value: `${scan?.panel?.refreshRateHz || specs?.estimatedRefreshRate || 60} Hz` },
          { label: 'Gamut / Bit', value: `${scan?.panel?.colorGamut || 'sRGB'} ${scan?.panel?.colorDepthBit || 24}b` },
          { label: 'Ekrany', value: `${scan?.panel?.screenCount || 1}` },
        ],
        scannedAt: now,
      },
      {
        id: 'network',
        title: '7. Sieć, Karta NIC & Łącze PHY',
        category: 'NETWORK',
        status: navigator.onLine ? 'OK' : 'UWAGA',
        score: navigator.onLine ? 92 : 35,
        headline: context.networkState.adapters?.[0]?.name || deep?.networkAdapters[0] || (navigator.onLine ? 'Interfejs sieciowy Online' : 'Brak połączenia'),
        summary: context.networkState.downloadEstMbps > 0
          ? `DL ${context.networkState.downloadEstMbps} Mbps · UL ${context.networkState.uploadEstMbps} Mbps · Ping ${context.networkState.pingAvgMs} ms`
          : `Link: ${specs?.connectionType || 'Ethernet / Wi-Fi'} · RTT: ${specs?.rtt ?? '—'} ms · Downlink: ${specs?.downlink ?? '—'} Mbps`,
        source: context.networkState.adapters?.length ? 'Auto (.EXE Native)' : 'Auto (Web API)',
        metrics: [
          { label: 'Stan', value: navigator.onLine ? 'ONLINE' : 'OFFLINE' },
          { label: 'Ping / Jitter', value: context.networkState.pingAvgMs > 0 ? `${context.networkState.pingAvgMs} ms` : `${specs?.rtt ?? '—'} ms` },
          { label: 'Prędkość', value: context.networkState.downloadEstMbps > 0 ? `${context.networkState.downloadEstMbps} Mbps` : `${specs?.downlink ?? '—'} Mbps` },
        ],
        scannedAt: now,
      },
      {
        id: 'audio_codecs',
        title: '8. Audio DAC & Kodeki Sprzętowe (AV1/HEVC)',
        category: 'MEDIA',
        status: 'OK',
        score: Math.min(100, 78 + hwCodecsCount * 6),
        headline: `DAC ${audioDac.sampleRate / 1000} kHz (${audioDac.maxChannels} kan.) · ${hwCodecsCount}/4 kodeki 4K HW`,
        summary: Object.entries(codecs)
          .map(([k, v]) => `${k.split(' ')[0]}: ${v.includes('HW') ? 'HW' : v.includes('SW') ? 'SW' : 'Brak'}`)
          .join(' · '),
        source: 'Live Probe',
        metrics: [
          { label: 'Próbkowanie', value: `${audioDac.sampleRate} Hz` },
          { label: 'Latencja DAC', value: `${audioDac.baseLatencyMs} ms` },
          { label: 'AV1 / HEVC', value: `${codecs['AV1 (4K60)']?.includes('HW') ? 'AV1 HW' : 'SW'} / ${codecs['H.265 (HEVC 4K60)']?.includes('HW') ? 'HEVC HW' : 'SW'}` },
        ],
        scannedAt: now,
      },
      {
        id: 'power',
        title: '9. Zasilacz ATX PSU & Bateria ACPI',
        category: 'POWER',
        status: (context.batteryState.railAlertEvents?.length || 0) > 0 ? 'UWAGA' : 'OK',
        score: context.batteryState.healthPct || 94,
        headline: context.batteryState.psu?.detected
          ? `PSU +12V: ${context.batteryState.psu.rail12V.toFixed(2)}V · +5V: ${context.batteryState.psu.rail5V.toFixed(2)}V`
          : `Bateria ${context.batteryState.levelPct}% (${context.batteryState.charging ? 'Zasilacz AC' : 'Praca bateryjna'})`,
        summary: `Stan: ${context.batteryState.condition} · Zdrowie: ${context.batteryState.healthPct}% · Moc: ${context.batteryState.currentPowerDrawW} W`,
        source: srcDefault,
        metrics: [
          { label: 'Linia +12V', value: context.batteryState.psu?.detected ? `${context.batteryState.psu.rail12V.toFixed(2)}V` : '—' },
          { label: 'Moc', value: `${context.batteryState.currentPowerDrawW} W` },
          { label: 'Alerty szyn', value: `${context.batteryState.railAlertEvents?.length || 0}` },
        ],
        scannedAt: now,
      },
      {
        id: 'thermal',
        title: '10. Chłodzenie, Wentylatory & Czujniki °C',
        category: 'THERMAL',
        status: context.liveSensorsCount > 0 ? 'OK' : 'WYKRYTO',
        score: context.liveSensorsCount > 0 ? 96 : 82,
        headline: context.liveSensorsCount > 0
          ? `${context.liveSensorsCount} aktywnych czujników sprzętowych LIVE`
          : 'Czujniki termiczne (gotowy do podpięcia LHM :8085 / .EXE)',
        summary: `CPU: ${context.liveCpuTempC !== null ? `${context.liveCpuTempC.toFixed(1)} °C` : 'Brak odczytu'} · GPU: ${context.liveGpuTempC !== null ? `${context.liveGpuTempC.toFixed(1)} °C` : 'Brak odczytu'}`,
        source: context.liveSensorsCount > 0 ? 'Auto (.EXE Native)' : 'Live Probe',
        metrics: [
          { label: 'Czujniki', value: `${context.liveSensorsCount}` },
          { label: 'CPU °C', value: context.liveCpuTempC !== null ? `${context.liveCpuTempC.toFixed(1)}°` : '—' },
          { label: 'GPU °C', value: context.liveGpuTempC !== null ? `${context.liveGpuTempC.toFixed(1)}°` : '—' },
        ],
        scannedAt: now,
      },
      {
        id: 'usb_bus',
        title: '11. Magistrala USB, HID, Bluetooth & COM',
        category: 'BUS',
        status: 'OK',
        score: this.usbHidDevices.length > 0 ? 95 : 85,
        headline: `${this.usbHidDevices.length} sparowanych urządzeń USB/HID/BT/COM`,
        summary: `WebUSB: ${'usb' in navigator ? 'Tak' : 'Nie'} · WebHID: ${'hid' in navigator ? 'Tak' : 'Nie'} · WebBT: ${'bluetooth' in navigator ? 'Tak' : 'Nie'} · Serial: ${'serial' in navigator ? 'Tak' : 'Nie'}`,
        source: 'Auto (Web API)',
        metrics: [
          { label: 'USB / HID', value: `${this.usbHidDevices.filter((u) => u.bus === 'USB' || u.bus === 'HID').length}` },
          { label: 'BT / Serial', value: `${this.usbHidDevices.filter((u) => u.bus === 'Bluetooth' || u.bus === 'Serial').length}` },
          { label: 'Interfejsy', value: 'Gotowe' },
        ],
        scannedAt: now,
      },
      {
        id: 'input_media',
        title: '12. Peryferia Wejścia (Mysz, Klaw., Pad, Kamera)',
        category: 'INPUT',
        status: 'OK',
        score: 92,
        headline: `${mediaDevs.length} urz. audio/wideo · ${padsCount} kontroler(ów) · Dotyk: ${navigator.maxTouchPoints || 0} pkt`,
        summary: `Klawiatura NKRO, tester polling-rate myszy (Hz), wykrywanie dwukliku, pad + wibracje i kamera na żywo.`,
        source: 'Auto (Web API)',
        metrics: [
          { label: 'Audio/Kamery', value: `${mediaDevs.length}` },
          { label: 'Kontrolery', value: `${padsCount}` },
          { label: 'Wskaźnik', value: typeof window !== 'undefined' && window.matchMedia?.('(pointer: fine)').matches ? 'Mysz / Precyzyjny' : 'Dotykowy' },
        ],
        scannedAt: now,
      },
    ];

    this.last12Scans = cards;
    return cards;
  }
}

export const hardwareScannerService = new HardwareScannerService();

function getJedecBaselineMHz(memoryType: string): number {
  const upper = memoryType.toUpperCase();
  if (upper.includes('DDR5') || upper.includes('LPDDR5')) return 4800;
  if (upper.includes('DDR4') || upper.includes('LPDDR4')) return 2400;
  if (upper.includes('DDR3') || upper.includes('LPDDR3')) return 1333;
  return 2133;
}

export function analyzeDeepHardware(
  deep: ParsedDeepHardwareInventory | null,
  ramState: RamTestResult,
  diskState: DiskTestResult,
  specs?: SystemSpecs | null,
  scan?: HardwareScanSnapshot | null
): DeepHardwareAnalysisSheet {
  const specRows: SmbiosSpecRow[] = [];

  if (deep) {
    specRows.push(
      { category: 'Platforma / System', parameter: 'Model komputera (SMBIOS)', value: deep.computerModel || '—', source: 'SMBIOS' },
      { category: 'Płyta główna', parameter: 'Producent i model płyty', value: deep.motherboard || '—', source: 'SMBIOS' },
      { category: 'Firmware / BIOS', parameter: 'Wersja SMBIOS / UEFI', value: deep.bios || '—', source: 'SMBIOS' },
      { category: 'Procesor (CPU)', parameter: 'Nazwa układu', value: deep.cpuModel || '—', source: 'SMBIOS' },
      { category: 'Topologia CPU', parameter: 'Rdzenie / Wątki / Zegar', value: deep.cpuDetails || `${specs?.cpuCores ?? '?'} wątków logicznych`, source: 'SMBIOS' }
    );
    deep.gpus.forEach((g, idx) => {
      specRows.push({
        category: `Karta graficzna #${idx + 1}`,
        parameter: 'Adapter + VRAM + Sterownik',
        value: `${g.name} · ${g.vramGB} · Driver: ${g.driver}`,
        source: 'SMBIOS',
      });
    });
    deep.monitors.forEach((m, idx) => {
      specRows.push({
        category: `Matryca / Monitor EDID #${idx + 1}`,
        parameter: 'Panel i numer seryjny',
        value: `${[m.manufacturer, m.model].filter(Boolean).join(' ')} · S/N: ${m.serial}`,
        source: 'SMBIOS',
      });
    });
    if (deep.networkAdapters.length > 0) {
      specRows.push({
        category: 'Interfejsy sieciowe',
        parameter: `Fizyczne karty (${deep.networkAdapters.length})`,
        value: deep.networkAdapters.join(' | '),
        source: 'SMBIOS',
      });
    }
  } else {
    specRows.push(
      { category: 'System / Platforma', parameter: 'OS i architektura', value: specs ? `${specs.os} (${specs.platform})` : '—', source: 'Live API' },
      { category: 'Procesor (CPU)', parameter: 'Wątki logiczne (Navigator)', value: specs ? `${specs.cpuCores} wątków logicznych` : '—', source: 'Live API' },
      { category: 'Karta graficzna (GPU)', parameter: 'Renderer WebGL / ANGLE', value: specs?.gpuRenderer || '—', source: 'Live API' },
      { category: 'Pamięć RAM (Navigator)', parameter: 'Przybliżona pojemność', value: specs ? `${specs.deviceMemory} GB (limit API 8 GB)` : '—', source: 'Live API' },
      { category: 'Ekran / Wyświetlacz', parameter: 'Rozdzielczość & Odświeżanie', value: specs ? `${specs.screenResolution} @ ${specs.estimatedRefreshRate} Hz (DPR ${specs.devicePixelRatio}x)` : '—', source: 'Live API' }
    );
  }

  if (scan?.webGpuSummary) {
    specRows.push({ category: 'Akceleracja WebGPU', parameter: 'Adapter sprzętowy', value: scan.webGpuSummary, source: 'Live API' });
  }
  if (scan?.panel) {
    specRows.push({
      category: 'Gamut i Kolor',
      parameter: 'Przestrzeń barw / HDR',
      value: `${scan.panel.colorGamut} · ${scan.panel.hdrSupported ? 'HDR Wspierane' : 'SDR'} · ${scan.panel.colorDepthBit}-bit`,
      source: 'Live API',
    });
  }

  // --- Real-Time DRAM Module Speed Validation ---
  const ramModules = deep?.ramModules ?? [];
  const hasMeasuredRam = ramState.status === 'completed' || ramState.bandwidthReadMBs > 0;
  const totalRamGB = Math.round(ramModules.reduce((acc, m) => acc + (m.capacityGB || 0), 0) * 10) / 10;

  const validatedModules: DramValidationModuleResult[] = ramModules.map((m) => {
    const jedec = getJedecBaselineMHz(m.memoryType);
    // Theoretical single-channel 64-bit (8 bytes/transfer) effective DDR MT/s bandwidth: speed * 8 MB/s
    const theoreticalSingleChanMBs = m.speedMHz > 0 ? Math.round(m.speedMHz * 8) : 0;
    let profileStatus: DramValidationModuleResult['profileStatus'] = 'Brak odczytu MHz';
    let notes = 'Brak taktowania w raporcie SMBIOS.';

    if (m.speedMHz > 0) {
      if (m.speedMHz > jedec * 1.05) {
        profileStatus = 'XMP / EXPO Aktywny';
        notes = `Profil OC/XMP (+${Math.round(((m.speedMHz - jedec) / jedec) * 100)}% względem JEDEC ${jedec} MHz).`;
      } else if (m.speedMHz >= jedec * 0.92) {
        profileStatus = 'Profil JEDEC / Standardowy';
        notes = `Zegar nominalny JEDEC (~${jedec} MHz) — rozważ włączenie profilu XMP/EXPO w BIOS jeśli kość to wspiera.`;
      } else {
        profileStatus = 'Poniżej bazy JEDEC';
        notes = `Zegar ${m.speedMHz} MHz niższy niż standard ${jedec} MHz — możliwy fallback kontrolera lub mieszane kości.`;
      }
    }

    return {
      slot: m.slot,
      manufacturer: m.manufacturer,
      partNumber: m.partNumber,
      capacityGB: m.capacityGB,
      memoryType: m.memoryType,
      ratedSpeedMHz: m.speedMHz,
      jedecBaselineMHz: jedec,
      profileStatus,
      theoreticalSingleChanMBs,
      notes,
    };
  });

  const activeSpeeds = validatedModules.map((m) => m.ratedSpeedMHz).filter((s) => s > 0);
  const dominantSpeedMHz = activeSpeeds.length > 0 ? Math.min(...activeSpeeds) : 0;
  const uniqueSpeeds = new Set(activeSpeeds);
  const uniqueCapacities = new Set(validatedModules.map((m) => m.capacityGB).filter((c) => c > 0));
  const channelsMultiplier = validatedModules.length >= 2 ? 2 : validatedModules.length === 1 ? 1 : 0;

  let channelConfig = 'Brak danych SMBIOS';
  if (validatedModules.length === 1) {
    channelConfig = 'Single-Channel (1 moduł — 50% przepustowości magistrali)';
  } else if (validatedModules.length >= 2) {
    if (uniqueSpeeds.size <= 1 && uniqueCapacities.size <= 1) {
      channelConfig = `Dual-Channel Symetryczny (${validatedModules.length} kości × ${dominantSpeedMHz || '?'} MT/s)`;
    } else {
      channelConfig = `Flex / Asymetryczny (wykryto różnice taktowania lub pojemności)`;
    }
  }

  const theoreticalPeakMBs =
    dominantSpeedMHz > 0 && channelsMultiplier > 0 ? Math.round(dominantSpeedMHz * 8 * channelsMultiplier) : 0;
  const measuredReadMBs = Math.round(ramState.bandwidthReadMBs || 0);
  const measuredWriteMBs = Math.round(ramState.bandwidthWriteMBs || 0);
  const measuredCopyMBs = Math.round(ramState.copyBandwidthMBs || ramState.streamCopyMBs || 0);
  const latencyNs = Number((ramState.latencyNs || 0).toFixed(1));

  // Browser JS TypedArray real-world SIMD/cache peak reaches roughly ~40–65% of raw C++ native dual-channel DRAM peak
  const efficiencyPct =
    hasMeasuredRam && theoreticalPeakMBs > 0
      ? Number(Math.min(100, (measuredReadMBs / theoreticalPeakMBs) * 100).toFixed(1))
      : null;

  let dramStatus: DramValidationSummary['validationStatus'] = 'BRAK MODUŁÓW SMBIOS';
  let dramVerdict = 'Zaimportuj surowy zrzut SMBIOS powyżej, aby zweryfikować taktowanie każdej kości DIMM.';
  if (validatedModules.length > 0) {
    const hasMismatch = uniqueSpeeds.size > 1 || validatedModules.some((m) => m.profileStatus === 'Poniżej bazy JEDEC');
    if (ramState.errorsFound > 0 || hasMismatch || validatedModules.length === 1) {
      dramStatus = 'WYKRYTO NIEZGODNOŚĆ / ASYMETRIĘ';
      if (ramState.errorsFound > 0) {
        dramVerdict = `Wykryto ${ramState.errorsFound} błędów integralności RAM podczas testu na żywo — natychmiast przetestuj moduły pojedynczo.`;
      } else if (validatedModules.length === 1) {
        dramVerdict = 'Konfiguracja Single-Channel (1 kość) ogranicza przepustowość o ok. 35–45% w porównaniu z układem 2-kanałowym.';
      } else {
        dramVerdict = 'Wykryto niesymetryczne moduły lub zegar poniżej JEDEC — sprawdź ustawienia XMP/EXPO i obsadzenie slotów A2/B2.';
      }
    } else if (!hasMeasuredRam) {
      dramStatus = 'OCZEKUJE NA TEST RAM';
      dramVerdict = `Wykryto ${validatedModules.length} moduły (${totalRamGB} GB @ ${dominantSpeedMHz || '?'} MT/s). Uruchom walidację na żywo, aby zmierzyć realną przepustowość i opóźnienie ns.`;
    } else {
      dramStatus = 'ZWERYFIKOWANO OK';
      dramVerdict = `Taktowanie ${dominantSpeedMHz} MT/s w trybie ${channelsMultiplier}×Channel potwierdzone (${measuredReadMBs.toLocaleString('pl-PL')} MB/s Read, ${latencyNs} ns, 0 błędów).`;
    }
  }

  // --- SSD Endurance Rating Verification ---
  const disks = deep?.disks ?? [];
  const hasMeasuredDisk = diskState.status === 'completed' || diskState.seqReadMBs > 0;

  const verifiedDrives: SsdEnduranceDriveResult[] = disks.map((d) => {
    const upper = `${d.model} ${d.interfaceType} ${d.mediaType}`.toUpperCase();
    const isHdd = upper.includes('HDD') || upper.includes('5400') || upper.includes('7200') || upper.includes('ROTATIONAL');
    const isNvme = !isHdd && (upper.includes('NVME') || upper.includes('PCIE') || upper.includes('M.2') || upper.includes('SN850') || upper.includes('980 PRO') || upper.includes('990 PRO') || upper.includes('KC3000'));
    const isEnterprise = !isHdd && (upper.includes('PRO') || upper.includes('ENTERPRISE') || upper.includes('DC ') || upper.includes('EVO PLUS') || upper.includes('FURY') || upper.includes('BLACK'));

    let enduranceTier: SsdEnduranceDriveResult['enduranceTier'] = 'SATA SSD';
    let estimatedTbwRating: number | null = null;
    let estimatedDwpd: number | null = null;

    if (isHdd) {
      enduranceTier = 'HDD Mechaniczny';
      estimatedTbwRating = Math.round(Math.max(180, (d.sizeGB || 1000) * 0.55));
      estimatedDwpd = 0.15;
    } else if (isNvme && isEnterprise) {
      enduranceTier = 'Enterprise / Pro NVMe';
      estimatedTbwRating = Math.max(300, Math.round((d.sizeGB || 500) * 0.65));
      estimatedDwpd = 0.36;
    } else if (isNvme) {
      enduranceTier = 'Consumer NVMe Gen4/5';
      estimatedTbwRating = Math.max(150, Math.round((d.sizeGB || 500) * 0.55));
      estimatedDwpd = 0.3;
    } else {
      enduranceTier = 'SATA SSD';
      estimatedTbwRating = Math.max(120, Math.round((d.sizeGB || 256) * 0.48));
      estimatedDwpd = 0.26;
    }

    const smartOk = d.status.toUpperCase() === 'OK' || d.status.toUpperCase() === 'VERIFIED' || d.status.toUpperCase() === 'HEALTHY';
    let verificationStatus: SsdEnduranceDriveResult['verificationStatus'] = 'BRAK TESTU DYSKU';
    let notes = `Szacowana klasa TBW: ~${estimatedTbwRating} TBW (~${estimatedDwpd} DWPD / 5 lat).`;

    if (!smartOk || (hasMeasuredDisk && !diskState.crcVerified) || (hasMeasuredDisk && diskState.smartStatus === 'KRYTYCZNY')) {
      verificationStatus = 'BŁĄD SMART / CRC';
      notes = 'Ostrzeżenie S.M.A.R.T. lub błąd sumy kontrolnej CRC32 — natychmiast wykonaj kopię zapasową!';
    } else if (!hasMeasuredDisk) {
      verificationStatus = 'BRAK TESTU DYSKU';
      notes += ' Uruchom weryfikację dysku na żywo, aby ocenić bufor SLC i kondycję SMART.';
    } else if ((diskState.slcCacheCurvePct ?? 100) < 70 || diskState.smartHealthPct < 85 || diskState.smartStatus === 'UWAGA') {
      verificationStatus = 'PODWYŻSZONE ZUŻYCIE / SPADEK SLC';
      notes = `SMART ${diskState.smartHealthPct}% · Retencja zapisu SLC: ${diskState.slcCacheCurvePct ?? 100}% (bufor zapełnia się szybciej niż wzorzec).`;
    } else {
      verificationStatus = 'WYTRZYMAŁOŚĆ WZOROWA';
      notes = `SMART ${diskState.smartHealthPct}% · CRC32 OK · Stały zapis termiczny ${Math.round(diskState.thermalSustainedWriteMBs ?? diskState.seqWriteMBs)} MB/s · Bufor SLC ${diskState.slcCacheCurvePct ?? 100}%.`;
    }

    return {
      model: d.model,
      interfaceType: d.interfaceType,
      mediaType: d.mediaType,
      sizeGB: d.sizeGB,
      smartRawStatus: d.status,
      estimatedTbwRating,
      estimatedDwpd,
      enduranceTier,
      liveSmartHealthPct: hasMeasuredDisk ? diskState.smartHealthPct : null,
      liveSlcCachePct: hasMeasuredDisk ? (diskState.slcCacheCurvePct ?? null) : null,
      liveSustainedWriteMBs: hasMeasuredDisk ? Math.round(diskState.thermalSustainedWriteMBs ?? diskState.seqWriteMBs) : null,
      crcVerified: hasMeasuredDisk ? diskState.crcVerified : null,
      verificationStatus,
      notes,
    };
  });

  const totalDiskGB = Math.round(verifiedDrives.reduce((acc, d) => acc + (d.sizeGB || 0), 0) * 10) / 10;
  let ssdOverallStatus: SsdEnduranceSummary['overallStatus'] = 'BRAK DYSKÓW SMBIOS';
  let ssdVerdict = 'Zaimportuj zrzut SMBIOS powyżej, aby zweryfikować ocenę TBW/DWPD i kondycję fizycznych dysków.';

  if (verifiedDrives.length > 0) {
    const hasError = verifiedDrives.some((d) => d.verificationStatus === 'BŁĄD SMART / CRC');
    const hasWarn = verifiedDrives.some((d) => d.verificationStatus === 'PODWYŻSZONE ZUŻYCIE / SPADEK SLC');
    if (hasError || hasWarn) {
      ssdOverallStatus = 'WYMAGA UWAGI';
      ssdVerdict = hasError
        ? 'Co najmniej jeden napęd zgłosił ostrzeżenie S.M.A.R.T. lub błąd spójności CRC32.'
        : 'Wykryto degradację retencji bufora SLC lub obniżony parametr zdrowia S.M.A.R.T.';
    } else if (!hasMeasuredDisk) {
      ssdOverallStatus = 'OCZEKUJE NA TEST DYSKU';
      ssdVerdict = `Wykryto ${verifiedDrives.length} napęd(y) o łącznej pojemności ${totalDiskGB} GB. Uruchom test obciążeniowy dysku na żywo.`;
    } else {
      ssdOverallStatus = 'ZWERYFIKOWANO OK';
      ssdVerdict = `Wszystkie wykryte dyski przeszły weryfikację SMART (${diskState.smartHealthPct}%), CRC32 oraz retencję zapisu SLC (${diskState.slcCacheCurvePct ?? 100}%).`;
    }
  }

  return {
    hasSmbiosData: Boolean(deep),
    sourceOs: deep ? deep.sourceOs : specs?.os || 'Przeglądarka (Live API)',
    importedAtLabel: deep ? new Date(deep.importedAt).toLocaleTimeString('pl-PL') : 'Brak importu SMBIOS',
    rawLineCount: deep?.rawLineCount || 0,
    rawDumpPreview: deep?.rawDumpPreview || '',
    specRows,
    dramValidation: {
      totalCapacityGB: totalRamGB,
      moduleCount: validatedModules.length,
      channelConfig,
      dominantSpeedMHz,
      theoreticalPeakMBs,
      measuredReadMBs,
      measuredWriteMBs,
      measuredCopyMBs,
      latencyNs,
      efficiencyPct,
      validationStatus: dramStatus,
      verdictNote: dramVerdict,
      modules: validatedModules,
    },
    ssdEndurance: {
      driveCount: verifiedDrives.length,
      totalCapacityGB: totalDiskGB,
      overallStatus: ssdOverallStatus,
      verdictNote: ssdVerdict,
      drives: verifiedDrives,
    },
  };
}

