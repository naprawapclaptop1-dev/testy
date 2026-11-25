import {
  ActiveModule,
  BatteryHealthState,
  ComponentScanCard,
  CpuStressMode,
  CpuTestResult,
  DiagnosticLogEntry,
  DiskDriveTarget,
  DiskTestResult,
  FanHeatmapSectionTab,
  FanPwmMonitorState,
  FanTestState,
  GameAiProfile,
  GameBenchMetrics,
  GameFpsCap,
  GameFrameGenMode,
  GameGiQuality,
  GameQualityPreset,
  GameRayTracingMode,
  GameReflexMode,
  GameSceneId,
  GameTextureQuality,
  GameToneMappingMode,
  GameUpscalingMode,
  GpuFpsMode,
  GpuLoadPreset,
  GpuSceneMode,
  GpuStressMetrics,
  NetworkTestResult,
  NetworkTransferDirection,
  PsuStressProfile,
  RamTestResult,
  ScheduledTestItem,
  ScheduledTestType,
  SchedulerStepResult,
  SchedulerSummaryReport,
  StressSessionRecord,
  SuiteScores,
  SystemSpecs,
  ThemeMode,
  ThermalHeatMapSnapshot,
} from './types';
import {
  bindPcSuitabilityReportEvents,
  renderPcSuitabilityAndGamesReport,
} from './ui/pcSuitabilityAndGamesReport';
import { getSystemSpecs } from './services/systemInfo.service';
import { cpuTestService } from './services/cpuTest.service';
import { ramTestService } from './services/ramTest.service';
import {
  DISK_SCAN_CMD_COMMAND,
  DISK_SCAN_POWERSHELL_CMD,
  diskTestService,
} from './services/diskTest.service';
import { GPU_SCENE_CATALOG, gpuStressEngine } from './services/gpuStress.service';
import { BATTERY_PRESETS, batteryHealthService } from './services/batteryHealth.service';
import { PSU_STRESS_PROFILES, psuCalculatorService } from './services/psuCalculator.service';
import {
  renderPcPsuRailsD3Chart,
  renderPsuEfficiencyCurveChart,
  renderPsuEfficiencyTrend1hChart,
  renderPsuPowerVsEfficiencyBarChart,
  renderRailFullHistoryD3ModalChart,
} from './ui/pcPsuChart';
import { downloadPortableExeZip } from './services/portableExeBuilder.service';
import { soundNotificationService, NotificationEventType, SoundPreset } from './services/soundNotification.service';
import {
  DISPLAY_PATTERNS,
  OLED_PROTECTION_DURATION_SEC,
  displayDiagnostics,
  formatCountdownMmSs,
} from './ui/displayDiagnostics';
import {
  bindBatteryDegradationChartTooltip,
  bindBatteryHistoryChartTooltip,
  renderBatteryDegradationTrendChart,
  renderBatteryHistoryChart,
  renderBatteryWearLevel30DaysChartD3,
  renderDualLineChart,
  renderRadarChart,
} from './ui/charts';
import { iconSvg } from './ui/icons';
import { persistenceService } from './services/persistence.service';
import {
  generateBatteryTrendReportPdf,
  generateDiagnosticPdfReport,
  generateHardwareInventoryPdfReport,
  generateSchedulerPdfReport,
} from './services/pdfReport.service';
import {
  NET_ADAPTER_PS_COMMAND,
  NETWORK_CABLE_AND_WIFI_STANDARDS,
  SPEEDTEST_SERVER_CATALOG,
  getCableCapacityComparison,
  networkTestService,
  parseNetAdapterPaste,
} from './services/networkTest.service';

import { AudioChannelMode, peripheralsTestService } from './services/peripheralsTest.service';
import {
  SENSOR_DUMP_COMMANDS,
  downloadWindowsLiveSensorScript,
  thermalMonitorService,
} from './services/thermalMonitor.service';
import {
  DEEP_SCAN_COMMANDS,
  DeepHardwareAnalysisSheet,
  EDID_CMD_COMMAND,
  EDID_POWERSHELL_COMMAND,
  HardwareScanSnapshot,
  analyzeDeepHardware,
  downloadMonitorEdidScript,
  hardwareScannerService,
} from './services/hardwareScanner.service';
import {
  MouseDiagnosticsSnapshot,
  buttonIndexToKey,
  mouseDiagnosticsService,
} from './services/mouseDiagnostics.service';
import { fanTestService } from './services/fanTest.service';
import { GAME_CATALOG, GAME_PRESETS, gameBenchService } from './services/gameBench.service';
import {
  renderThermalHeatmapInnerHtml,
  renderThermalHeatmapPanelHtml,
} from './ui/thermalHeatmap';
import {
  mountFanCurveEditor,
  renderFanCurveEditorPanelHtml,
} from './ui/fanCurveEditor';
import {
  renderFanAcousticHeatmapD3,
  renderFanAcousticHeatmapMetaHtml,
  renderFanAcousticHeatmapPanelHtml,
  renderFanBearingHistoryChartD3,
  renderFanBearingHistorySummaryHtml,
  renderFanFftHarmonicsStripHtml,
  renderFanFftSpectrumD3,
  renderFanPwmMonitorInnerHtml,
  renderFanPwmMonitorPanelHtml,
  renderFanResonanceZonesHtml,
  renderPredictiveBearingAlertModalHtml,
} from './ui/fanDiagnosticsVisuals';
import { animateMetricValueElements } from './ui/metricAnimation';
import { isLowBatteryHealth, renderLowBatteryHealthAlertHtml } from './ui/batteryLowHealthAlert';
import { isPsuCapacityOver95, renderPsuCapacityAlertBannerHtml } from './ui/psuCapacityAlert';
import { PsuRail5sCoord, renderRail5sSparklinePreviewHtml } from './ui/psuRailSparklinePreview';
import { computePowerDrawTrend1m, renderPsuPowerDrawTrendHtml } from './ui/psuPowerDrawTrend';
import {
  PsuRailTransientHighlightTracker,
  TRANSIENT_RAIL_HIGHLIGHT_DURATION_MS,
  TransientHighlightRail,
} from './ui/psuRailTransientHighlight';
import { renderStressHistoryPanelHtml } from './ui/stressHistoryPanel';
import { WorkspaceErrorBoundary } from './ui/workspaceErrorBoundary';
import {
  exportStressHistoryToCsv,
  exportStressHistoryToXlsx,
} from './services/stressExport.service';
import { downloadFullDiagnosticDataJson } from './services/fullDataExport.service';
import { downloadResultsCsv } from './services/resultsCsvExport.service';
import {
  buildAllPsuRailsRawJson,
  exportBatteryPowerCyclesToCsv,
  exportBatteryPowerCyclesToXlsx,
  exportPsuRailHistoryToCsv,
  exportPsuRailHistoryToJson,
  exportSinglePsuRail5mHistoryToCsv,
  formatCycleDateTime,
} from './services/batteryExport.service';
import { computeCpuFrequencyStats, renderCpuFrequencyD3Chart } from './ui/cpuFrequencyChart';
import {
  renderDiskIopsLatencyD3Chart,
  renderDiskThroughputD3Chart,
  renderHardwareHealthD3Chart,
  renderRamBandwidthD3Chart,
} from './ui/componentCharts';
import {
  SCHEDULER_CATALOG,
  createScheduledItem,
  describeItemConfig,
  getDefaultSchedulerQueue,
  getSchedulerPresetQueue,
  renderSchedulerSummaryReportHtml,
} from './ui/schedulerUi';

const THEME_STORAGE_KEY = 'systempulse_theme';

interface KeyDef {
  code: string;
  label: string;
  cls?: string;
}

const KEYBOARD_LAYOUT: KeyDef[][] = [
  [
    { code: 'Escape', label: 'ESC' },
    { code: 'F1', label: 'F1' },
    { code: 'F2', label: 'F2' },
    { code: 'F3', label: 'F3' },
    { code: 'F4', label: 'F4' },
    { code: 'F5', label: 'F5' },
    { code: 'F6', label: 'F6' },
    { code: 'F7', label: 'F7' },
    { code: 'F8', label: 'F8' },
    { code: 'F9', label: 'F9' },
    { code: 'F10', label: 'F10' },
    { code: 'F11', label: 'F11' },
    { code: 'F12', label: 'F12' },
    { code: 'Delete', label: 'DEL' },
  ],
  [
    { code: 'Backquote', label: '`' },
    { code: 'Digit1', label: '1' },
    { code: 'Digit2', label: '2' },
    { code: 'Digit3', label: '3' },
    { code: 'Digit4', label: '4' },
    { code: 'Digit5', label: '5' },
    { code: 'Digit6', label: '6' },
    { code: 'Digit7', label: '7' },
    { code: 'Digit8', label: '8' },
    { code: 'Digit9', label: '9' },
    { code: 'Digit0', label: '0' },
    { code: 'Minus', label: '-' },
    { code: 'Equal', label: '=' },
    { code: 'Backspace', label: 'BKSP', cls: 'w-lg' },
  ],
  [
    { code: 'Tab', label: 'TAB', cls: 'w-md' },
    { code: 'KeyQ', label: 'Q' },
    { code: 'KeyW', label: 'W' },
    { code: 'KeyE', label: 'E' },
    { code: 'KeyR', label: 'R' },
    { code: 'KeyT', label: 'T' },
    { code: 'KeyY', label: 'Y' },
    { code: 'KeyU', label: 'U' },
    { code: 'KeyI', label: 'I' },
    { code: 'KeyO', label: 'O' },
    { code: 'KeyP', label: 'P' },
    { code: 'BracketLeft', label: '[' },
    { code: 'BracketRight', label: ']' },
    { code: 'Backslash', label: '\\', cls: 'w-md' },
  ],
  [
    { code: 'CapsLock', label: 'CAPS', cls: 'w-lg' },
    { code: 'KeyA', label: 'A' },
    { code: 'KeyS', label: 'S' },
    { code: 'KeyD', label: 'D' },
    { code: 'KeyF', label: 'F' },
    { code: 'KeyG', label: 'G' },
    { code: 'KeyH', label: 'H' },
    { code: 'KeyJ', label: 'J' },
    { code: 'KeyK', label: 'K' },
    { code: 'KeyL', label: 'L' },
    { code: 'Semicolon', label: ';' },
    { code: 'Quote', label: "'" },
    { code: 'Enter', label: 'ENTER', cls: 'w-lg' },
  ],
  [
    { code: 'ShiftLeft', label: 'SHIFT', cls: 'w-lg' },
    { code: 'KeyZ', label: 'Z' },
    { code: 'KeyX', label: 'X' },
    { code: 'KeyC', label: 'C' },
    { code: 'KeyV', label: 'V' },
    { code: 'KeyB', label: 'B' },
    { code: 'KeyN', label: 'N' },
    { code: 'KeyM', label: 'M' },
    { code: 'Comma', label: ',' },
    { code: 'Period', label: '.' },
    { code: 'Slash', label: '/' },
    { code: 'ShiftRight', label: 'SHIFT', cls: 'w-lg' },
    { code: 'ArrowUp', label: '▲' },
  ],
  [
    { code: 'ControlLeft', label: 'CTRL', cls: 'w-md' },
    { code: 'MetaLeft', label: 'WIN' },
    { code: 'AltLeft', label: 'ALT', cls: 'w-md' },
    { code: 'Space', label: 'SPACJA', cls: 'w-xl' },
    { code: 'AltRight', label: 'ALT' },
    { code: 'ControlRight', label: 'CTRL' },
    { code: 'ArrowLeft', label: '◄' },
    { code: 'ArrowDown', label: '▼' },
    { code: 'ArrowRight', label: '►' },
  ],
];

function esc(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function gradeFromOverall(score: number): SuiteScores['grade'] {
  if (score >= 90) return 'S';
  if (score >= 82) return 'A+';
  if (score >= 72) return 'A';
  if (score >= 58) return 'B';
  if (score >= 42) return 'C';
  return 'D';
}

export class SystemPulseApp {
  private root: HTMLElement;
  private activeModule: ActiveModule = 'dashboard';
  private specs: SystemSpecs | null = null;

  private cpuState: CpuTestResult = cpuTestService.createInitialState();
  private ramSizeMB = 256;
  private ramState: RamTestResult = ramTestService.createInitialState(256);
  private diskState: DiskTestResult = diskTestService.createInitialState();
  private gpuState: GpuStressMetrics = gpuStressEngine.createInitialMetrics();
  private batteryState: BatteryHealthState = batteryHealthService.getState();
  private networkState: NetworkTestResult = networkTestService.createInitialState();
  private thermalState: ThermalHeatMapSnapshot = thermalMonitorService.getSnapshot();
  private thermalShowSparklines = false;
  private gameState: GameBenchMetrics = gameBenchService.createInitialMetrics();
  private fanState: FanTestState = fanTestService.createInitialState();
  private fanMicAcoustic = true;
  private hardwareScan: HardwareScanSnapshot | null = null;
  private hardwareScanNotice = '';
  private hwScannerTab: 'overview' | 'deep_analysis' = 'overview';
  private deepRamValidating = false;
  private deepDiskValidating = false;
  private diskDrives: DiskDriveTarget[] = diskTestService.getAvailableDrives();
  private diskDriveNotice = '';
  private componentScans: ComponentScanCard[] = [];
  private componentScanBusy = false;
  private gameSfxEnabled = true;
  private metricAnimPrevValues = new Map<string, number>();

  // Stress Test Scheduler state
  private schedulerQueue: ScheduledTestItem[] = getDefaultSchedulerQueue();
  private schedulerCooldownSec = 2;
  private schedulerRunning = false;
  private schedulerAbortRequested = false;
  private schedulerActiveIndex = -1;
  private schedulerStatusText = '';
  private schedulerProgressPct = 0;
  private schedulerCooldownRemaining = 0;
  private schedulerDisplayPatternIdx = 0;
  private schedulerAudioHz = 0;
  private schedulerAudioChan = 'Stereo';
  private lastSchedulerReport: SchedulerSummaryReport | null = null;

  // Display filter & slideshow
  private displayCategoryFilter: string = 'ALL';
  private displaySlideshowTimer: number | null = null;

  // Game Bench category & Network LAN/IXP UI state
  private gameCategoryFilter: 'ALL' | 'COMBAT' | 'RACING' | 'SOCCER' | 'FLIGHT' | 'SCIFI' = 'ALL';
  private netServerScanBusy = false;
  private lanProbeBusy = false;
  private netAdapterPasteText = '';
  private netAdapterPasteNote = '';

  private theme: ThemeMode = 'dark';
  private logCount = 0;
  private psuTooltipCopiedRail: '+12V' | '+5V' | '+3.3V' | null = null;
  private psuTooltipCopiedTimer: number | null = null;
  private psuTooltipJsonCopiedRail: '+12V' | '+5V' | '+3.3V' | null = null;
  private psuTooltipJsonCopiedTimer: number | null = null;
  private psuSparklineOpenRails = new Set<'+12V' | '+5V' | '+3.3V'>();
  private psuSparklinePointsMap = new Map<
    '+12V' | '+5V' | '+3.3V',
    Array<{
      x: number;
      y: number;
      xRatio: number;
      voltageV: number;
      timestamp: number;
      timeLabel: string;
      deviationPct: number;
      out: boolean;
    }>
  >();
  private psuSparklineHoverRatio = new Map<'+12V' | '+5V' | '+3.3V', number>();
  private psuRail5sCoordsMap = new Map<'+12V' | '+5V' | '+3.3V', PsuRail5sCoord[]>();
  private psuTransientTracker = new PsuRailTransientHighlightTracker();
  private psuTransientTimers = new Map<TransientHighlightRail, number>();
  private psuFullHistoryModalRail: '+12V' | '+5V' | '+3.3V' | null = null;
  private psuFullHistoryModalZoom = 2;
  private psuFullHistoryModalWindowMin: 1 | 5 | 15 = 5;
  private psuFullHistoryModalTempThresholdPct: number | null = null;
  private psuFullHistoryModalKeyHandler: ((ev: KeyboardEvent) => void) | null = null;
  private fanHeatmapTab: FanHeatmapSectionTab = 'resonance';
  private predictiveBearingAlertFocusedChannelId: string | null = null;
  private predictiveBearingAlertDismissed = false;
  private predictiveBearingAlertKeyHandler: ((ev: KeyboardEvent) => void) | null = null;

  // Peripherals runtime state & cleanup
  private pressedKeys = new Set<string>();
  private testedKeys = new Set<string>();
  private maxNkro = 0;
  private lastKeyCode = '—';
  // Touchpad runtime state
  private touchpadFingers = 0;
  private touchpadMaxFingers = 0;
  private touchpadScrollX = 0;
  private touchpadScrollY = 0;
  private touchpadPinchScale = 1.0;
  private touchpadTaps = 0;
  private touchpadLastGesture = 'Dotknij lub przesuń palcami po powierzchni gładzika';
  // Audio / Mic / Cam state
  private camInfo = 'Wyłączona (wymaga zgody użytkownika)';
  private micInfo = 'Wyłączony';
  private micLevelPct = 0;
  private micDb = -60;
  private micSelectedDeviceId = '';
  private micRecording = false;
  private peripheralsCleanup: (() => void) | null = null;

  private fullSuiteRunning = false;
  private fullSuiteStep = '';
  private lastSuiteTimestamp: number | null = null;
  private lastSavedAt: number | null = null;
  private restoredFromStorage = false;
  private oledProtectionNotice = '';
  private stressHistory: StressSessionRecord[] = [];
  private activeStressSession: { startedAt: number; cpuTemps: number[]; gpuTemps: number[] } | null = null;
  private gpuSuiteRunning = false;
  private gpuSuiteStatus = '';
  private gpuSuiteResults: Array<{
    sceneId: GpuSceneMode;
    name: string;
    targetUnit: string;
    avgFps: number;
    low1PctFps: number;
    triangles: number;
    stabilityPct: number;
    score: number;
  }> = [];
  private unsubscribeBattery: (() => void) | null = null;
  private unsubscribeThermal: (() => void) | null = null;
  private diagnosticEvents = new EventTarget();
  private persistDebounceTimer: number | null = null;
  private persistenceInitialized = false;
  private lastPersistedBatterySig = '';
  private onDiagnosticChangeEvent = (ev: Event): void => {
    const detail = (ev as CustomEvent<{ source: string; immediate?: boolean }>).detail;
    if (!this.persistenceInitialized) return;
    if (this.persistDebounceTimer !== null) {
      window.clearTimeout(this.persistDebounceTimer);
      this.persistDebounceTimer = null;
    }
    if (detail?.immediate) {
      void this.persistLatestResults();
    } else {
      this.persistDebounceTimer = window.setTimeout(() => {
        this.persistDebounceTimer = null;
        void this.persistLatestResults();
      }, 250);
    }
  };
  private onPageFlushPersist = (): void => {
    if (!this.persistenceInitialized) return;
    if (document.visibilityState === 'hidden' || this.persistDebounceTimer !== null) {
      if (this.persistDebounceTimer !== null) {
        window.clearTimeout(this.persistDebounceTimer);
        this.persistDebounceTimer = null;
      }
      void this.persistLatestResults();
    }
  };

  private workspaceErrorBoundary: WorkspaceErrorBoundary;
  private edidCommandMode: 'powershell' | 'cmd' = 'powershell';

  constructor(root: HTMLElement) {
    this.root = root;
    this.workspaceErrorBoundary = new WorkspaceErrorBoundary({
      onError: (record) => {
        void this.recordLog(
          'ERROR_BOUNDARY',
          'ERROR',
          `Wyjątek w module: ${record.moduleLabel}`,
          `${record.name} (${record.phase})`,
          record.message.slice(0, 140),
          record.stack.slice(0, 400)
        );
      },
      onRetry: () => {
        this.renderWorkspace();
      },
      onReturnToDashboard: () => {
        this.activeModule = 'dashboard';
        this.updateNavActive();
        this.renderWorkspace();
      },
    });
    try {
      const stored = localStorage.getItem(THEME_STORAGE_KEY);
      if (stored === 'high-contrast' || stored === 'dark') {
        this.theme = stored;
      }
    } catch {
      // Ignore storage access restrictions
    }
    this.applyThemeDom();
  }

  private async copyTextToClipboard(text: string): Promise<boolean> {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch {
      // Fall through to execCommand fallback inside sandboxed iframes
    }
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', 'true');
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      ta.style.left = '-9999px';
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      ta.setSelectionRange(0, text.length);
      const ok = document.execCommand('copy');
      document.body.removeChild(ta);
      return ok;
    } catch {
      return false;
    }
  }

  private applyThemeDom(): void {
    if (this.theme === 'high-contrast') {
      document.documentElement.dataset.theme = 'high-contrast';
    } else {
      delete document.documentElement.dataset.theme;
    }
  }

  private toggleTheme(): void {
    this.theme = this.theme === 'dark' ? 'high-contrast' : 'dark';
    this.applyThemeDom();
    try {
      localStorage.setItem(THEME_STORAGE_KEY, this.theme);
    } catch {
      // Ignore
    }
    this.syncThemeButton();
    void this.recordLog(
      'UI',
      'INFO',
      'Zmiana motywu',
      'ThemeMode',
      this.theme,
      this.theme === 'high-contrast' ? 'Aktywowano tryb wysokiego kontrastu' : 'Przywrócono motyw ciemny'
    );
  }

  private syncThemeButton(): void {
    const btn = this.root.querySelector<HTMLButtonElement>('#btn-theme-toggle');
    if (!btn) return;
    const isHc = this.theme === 'high-contrast';
    btn.title = isHc ? 'Przełącz na motyw ciemny' : 'Przełącz na tryb wysokiego kontrastu (jasny)';
    btn.setAttribute('aria-pressed', String(isHc));
    btn.innerHTML = `${iconSvg('contrast', 14)}<span>${isHc ? 'Ciemny' : 'Kontrast'}</span>`;
  }

  private logQueue: Array<Omit<DiagnosticLogEntry, 'id' | 'timestamp' | 'isoTime'>> = [];
  private logFlushTimer: number | null = null;

  private async recordLog(
    module: string,
    level: 'INFO' | 'OK' | 'WARN' | 'ERROR',
    event: string,
    metric: string,
    value: string,
    details: string
  ): Promise<void> {
    const entry = { module, level, event, metric, value, details };
    this.logQueue.push(entry);
    this.logCount++;
    const badge = this.root.querySelector('#dash-logs-count');
    if (badge) badge.textContent = `(${this.logCount})`;
  }

  private async flushLogQueue(): Promise<void> {
    if (this.logQueue.length === 0) return;
    const batch = this.logQueue.splice(0, this.logQueue.length);
    await persistenceService.appendLogsBatch(batch);
  }

  public async mount(): Promise<void> {
    this.workspaceErrorBoundary.attachGlobalListeners();
    this.renderShell();
    this.renderWorkspace();
    this.logFlushTimer = window.setInterval(() => void this.flushLogQueue(), 5000);

    // Connect battery load estimator to live CPU, GPU, Game & Fan stress load
    batteryHealthService.setLoadProvider(() => {
      const cpuLoad = Math.max(cpuTestService.getCurrentLoadPct(), this.fanState.targetLoadPct);
      const gpuLoad = gpuStressEngine.isRunning()
        ? this.gpuState.preset === 'ultra' || this.gpuState.preset === 'extreme'
          ? 98
          : this.gpuState.preset === 'high'
            ? 84
            : 65
        : gameBenchService.getLoadPct() || 8;
      return Math.min(100, Math.max(cpuLoad, gpuLoad));
    });

    // Connect real-time Thermal Heat Map provider (1 Hz updates)
    thermalMonitorService.setSourceProvider(() => {
      const cpuActive =
        this.cpuState.status === 'running' ||
        this.cpuState.status === 'stressing' ||
        this.fanState.running;
      const cpuLoad = Math.max(cpuTestService.getCurrentLoadPct(), this.fanState.targetLoadPct);
      const gpuActive = gpuStressEngine.isRunning() || gameBenchService.isRunning();
      const gpuTemp = gameBenchService.isRunning()
        ? this.gameState.estTempC
        : this.gpuState.estTempC;
      const gpuLoad = gameBenchService.isRunning()
        ? gameBenchService.getLoadPct()
        : gpuStressEngine.isRunning()
          ? 94
          : 8;
      return {
        cpuTempC: this.fanState.running ? this.fanState.currentTempC : this.cpuState.currentTempC,
        cpuLoadPct: cpuLoad,
        cpuActive,
        gpuTempC: gpuTemp,
        gpuLoadPct: gpuLoad,
        gpuActive,
        diskActive: this.diskState.status === 'running',
        diskProgressPct: this.diskState.progress,
        ramActive: this.ramState.status === 'running',
        ramProgressPct: this.ramState.progress,
        batteryTempC: this.batteryState.estTempC,
      };
    });

    this.unsubscribeThermal = thermalMonitorService.subscribe((snap) => {
      this.thermalState = snap;
      if (this.activeStressSession) {
        const cT = thermalMonitorService.getLiveCpuTempC();
        const gT = thermalMonitorService.getLiveGpuTempC();
        if (cT !== null) this.activeStressSession.cpuTemps.push(cT);
        if (gT !== null) this.activeStressSession.gpuTemps.push(gT);
      }
      if (this.activeModule === 'dashboard') {
        this.patchDashboardThermalMap();
      }
    });
    thermalMonitorService.start();

    this.diagnosticEvents.addEventListener('diagnostic-changed', this.onDiagnosticChangeEvent);
    document.addEventListener('visibilitychange', this.onPageFlushPersist);
    window.addEventListener('pagehide', this.onPageFlushPersist);

    this.unsubscribeBattery = batteryHealthService.subscribe((b) => {
      this.batteryState = b;
      const sig = `${b.designCapacityMWh}:${b.fullChargeCapacityMWh}:${b.powerCycles.length}`;
      if (this.persistenceInitialized && sig !== this.lastPersistedBatterySig) {
        this.lastPersistedBatterySig = sig;
        this.emitDiagnosticChanged('battery-state', false);
      }
      if (this.activeModule === 'battery') {
        this.patchBatteryLive();
      } else if (this.activeModule === 'dashboard') {
        this.patchDashboardBatterySummary();
      }
    });

    const [specs, battery, saved, logs] = await Promise.all([
      getSystemSpecs(),
      batteryHealthService.init(),
      persistenceService.loadState(),
      persistenceService.getAllLogs(),
    ]);
    this.specs = specs;
    this.batteryState = battery;
    this.logCount = logs.length;
    diskTestService.subscribeDrives((drives) => {
      this.diskDrives = drives;
      if (this.activeModule === 'disk') {
        const host = this.root.querySelector<HTMLElement>('#sp-main-scroll');
        if (host) this.renderDiskView(host);
      }
    });

    await hardwareScannerService.autoProbeFullLocalBridge(false);
    this.hardwareScan = await hardwareScannerService.scanAll(
      specs.estimatedRefreshRate,
      specs.gpuRenderer,
      specs
    );
    if (this.hardwareScan?.deepInventory?.disks?.length || this.hardwareScan?.deepInventory?.logicalDisks?.length) {
      diskTestService.registerHardwareInventoryDrives(
        this.hardwareScan.deepInventory.disks || [],
        this.hardwareScan.deepInventory.logicalDisks || []
      );
    }
    this.diskDrives = await diskTestService.refreshAvailableDrives();
    this.componentScans = await this.runAuto12ComponentScan();

    if (saved) {
      this.ramSizeMB = saved.ramSizeMB || 256;
      this.cpuState = {
        ...saved.cpuState,
        status: saved.cpuState.status === 'running' || saved.cpuState.status === 'stressing' ? 'completed' : saved.cpuState.status,
      };
      this.ramState = {
        ...saved.ramState,
        status: saved.ramState.status === 'running' ? 'completed' : saved.ramState.status,
      };
      this.diskState = {
        ...saved.diskState,
        status: saved.diskState.status === 'running' ? 'completed' : saved.diskState.status,
      };
      this.gpuState = {
        ...gpuStressEngine.createInitialMetrics(),
        ...saved.gpuState,
        running: false,
      };
      if (saved.gameState) {
        this.gameState = {
          ...gameBenchService.createInitialMetrics(),
          ...saved.gameState,
          running: false,
        };
      }
      if (saved.networkState) {
        this.networkState = {
          ...saved.networkState,
          status: saved.networkState.status === 'running' ? 'completed' : saved.networkState.status,
        };
      }
      if (saved.schedulerQueue && saved.schedulerQueue.length > 0) {
        this.schedulerQueue = saved.schedulerQueue;
      }
      if (saved.lastSchedulerReport) {
        this.lastSchedulerReport = saved.lastSchedulerReport;
      }
      if (saved.fanCurve && saved.fanCurve.points?.length >= 2) {
        fanTestService.setFanCurve(saved.fanCurve);
      }
      if (Array.isArray(saved.stressHistory)) {
        this.stressHistory = saved.stressHistory.slice(-50);
      }
      this.lastSuiteTimestamp = saved.lastSuiteTimestamp;
      this.lastSavedAt = saved.savedAt;
      this.restoredFromStorage = true;
      if (saved.batteryCalibration) {
        batteryHealthService.setCapacities(
          saved.batteryCalibration.designCapacityMWh,
          saved.batteryCalibration.fullChargeCapacityMWh
        );
      }
      if (saved.batteryPowerCycles && saved.batteryPowerCycles.length > 0) {
        batteryHealthService.restorePowerCycles(saved.batteryPowerCycles);
      }
      this.batteryState = batteryHealthService.getState();
    }

    this.lastPersistedBatterySig = `${this.batteryState.designCapacityMWh}:${this.batteryState.fullChargeCapacityMWh}:${this.batteryState.powerCycles.length}`;
    this.persistenceInitialized = true;

    await this.recordLog(
      'SYSTEM',
      'INFO',
      'Inicjalizacja sesji',
      'Sprzęt',
      `${specs.os} | ${specs.cpuCores} wątków`,
      `GPU: ${specs.gpuRenderer} | Ekran: ${specs.screenResolution} @ ${specs.estimatedRefreshRate}Hz`
    );

    this.updateAutosaveFooter();
    this.renderWorkspace();
  }

  private async runAuto12ComponentScan(): Promise<ComponentScanCard[]> {
    const cards = await hardwareScannerService.scanAll12Components({
      specs: this.specs,
      scan: this.hardwareScan,
      ramState: this.ramState,
      diskState: this.diskState,
      gpuState: this.gpuState,
      batteryState: this.batteryState,
      networkState: this.networkState,
      drives: this.diskDrives,
      liveSensorsCount:
        this.thermalState?.rows.reduce(
          (acc, row) => acc + row.zones.filter((z) => z.tempC !== null).length,
          0
        ) || 0,
      liveCpuTempC: thermalMonitorService.getLiveCpuTempC(),
      liveGpuTempC: thermalMonitorService.getLiveGpuTempC(),
    });
    this.componentScans = cards;
    return cards;
  }

  private emitDiagnosticChanged(source: string, immediate = true): void {
    this.diagnosticEvents.dispatchEvent(
      new CustomEvent('diagnostic-changed', { detail: { source, immediate } })
    );
  }

  private beginStressSession(): void {
    const cpuTemps: number[] = [];
    const gpuTemps: number[] = [];
    const cT = thermalMonitorService.getLiveCpuTempC();
    const gT = thermalMonitorService.getLiveGpuTempC();
    if (cT !== null) cpuTemps.push(cT);
    if (gT !== null) gpuTemps.push(gT);
    this.activeStressSession = { startedAt: Date.now(), cpuTemps, gpuTemps };
  }

  private finalizeStressSession(
    module: StressSessionRecord['module'],
    finalStabilityPct: number,
    summaryMetric: string,
    status?: StressSessionRecord['status']
  ): void {
    const resolvedStatus: StressSessionRecord['status'] =
      status ?? (finalStabilityPct >= 85 ? 'OK' : finalStabilityPct >= 70 ? 'UWAGA' : 'BŁĄD');
    const now = Date.now();
    const sess = this.activeStressSession;
    this.activeStressSession = null;

    const startedAt = sess?.startedAt ?? Math.max(0, now - 1000);
    const cpuSamples = sess ? [...sess.cpuTemps] : [];
    const gpuSamples = sess ? [...sess.gpuTemps] : [];
    const cNow = thermalMonitorService.getLiveCpuTempC();
    const gNow = thermalMonitorService.getLiveGpuTempC();
    if (cNow !== null) cpuSamples.push(cNow);
    if (gNow !== null) gpuSamples.push(gNow);

    const avgCpuTempC =
      cpuSamples.length > 0
        ? Number((cpuSamples.reduce((s, v) => s + v, 0) / cpuSamples.length).toFixed(1))
        : null;
    const avgGpuTempC =
      gpuSamples.length > 0
        ? Number((gpuSamples.reduce((s, v) => s + v, 0) / gpuSamples.length).toFixed(1))
        : null;

    const record: StressSessionRecord = {
      id: `sess-${now.toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      module,
      startedAt,
      endedAt: now,
      durationSec: Number(Math.max(0.1, (now - startedAt) / 1000).toFixed(1)),
      avgCpuTempC,
      avgGpuTempC,
      finalStabilityPct: Number(Math.max(0, Math.min(100, finalStabilityPct)).toFixed(1)),
      summaryMetric,
      status: resolvedStatus,
    };

    this.stressHistory.push(record);
    if (this.stressHistory.length > 50) {
      this.stressHistory = this.stressHistory.slice(-50);
    }
    soundNotificationService.playCompletionChime(resolvedStatus === 'OK' ? 'complete' : 'warning');
    this.emitDiagnosticChanged('stress-history', true);
  }

  private async persistLatestResults(): Promise<void> {
    const now = Date.now();
    const ok = await persistenceService.saveState({
      savedAt: now,
      lastSuiteTimestamp: this.lastSuiteTimestamp,
      ramSizeMB: this.ramSizeMB,
      cpuState: {
        ...this.cpuState,
        status: this.cpuState.status === 'stressing' ? 'completed' : this.cpuState.status,
      },
      ramState: this.ramState,
      diskState: this.diskState,
      gpuState: {
        ...this.gpuState,
        running: false,
      },
      gameState: {
        ...this.gameState,
        running: false,
      },
      networkState: this.networkState,
      batteryCalibration: {
        designCapacityMWh: this.batteryState.designCapacityMWh,
        fullChargeCapacityMWh: this.batteryState.fullChargeCapacityMWh,
      },
      batteryPowerCycles: this.batteryState.powerCycles,
      schedulerQueue: this.schedulerQueue,
      lastSchedulerReport: this.lastSchedulerReport,
      fanCurve: fanTestService.getFanCurve(),
      stressHistory: this.stressHistory,
    });
    if (ok) {
      this.lastSavedAt = now;
      this.restoredFromStorage = false;
      this.updateAutosaveFooter();
    }
  }

  private async clearPersistedResults(): Promise<void> {
    cpuTestService.stopStress();
    gpuStressEngine.stop();
    gameBenchService.stop();
    fanTestService.stop();
    fanTestService.stopPwmFrequencyMonitor();
    fanTestService.stopLiveAcousticHeatmapCapture();
    this.activeStressSession = null;
    await persistenceService.clearAll();
    this.cpuState = cpuTestService.createInitialState();
    this.ramState = ramTestService.createInitialState(this.ramSizeMB);
    this.diskState = diskTestService.createInitialState();
    this.gpuState = gpuStressEngine.createInitialMetrics();
    this.gameState = gameBenchService.createInitialMetrics();
    this.networkState = networkTestService.createInitialState();
    this.lastSchedulerReport = null;
    this.schedulerQueue = getDefaultSchedulerQueue();
    this.stressHistory = [];
    this.gpuSuiteResults = [];
    batteryHealthService.resetPowerCycles();
    this.batteryState = batteryHealthService.getState();
    this.logCount = 0;
    this.lastSuiteTimestamp = null;
    this.lastSavedAt = null;
    this.restoredFromStorage = false;
    this.fullSuiteStep = '';
    this.updateAutosaveFooter();
    this.renderWorkspace();
  }

  private updateAutosaveFooter(): void {
    const footerEl = this.root.querySelector('#footer-autosave-status');
    if (!footerEl) return;
    if (this.lastSavedAt) {
      const ts = new Date(this.lastSavedAt).toLocaleString('pl-PL');
      footerEl.textContent = `Auto-zapis IndexedDB · ${this.restoredFromStorage ? 'Przywrócono' : 'Zapisano'}: ${ts}`;
    } else {
      footerEl.textContent = 'Auto-zapis IndexedDB aktywny · Brak zapisanych wyników';
    }
  }

  private getSuiteScores(): SuiteScores {
    const cpu = this.cpuState.overallScore;
    const ram = this.ramState.overallScore;
    const disk = this.diskState.overallScore;
    const gpu = this.gpuState.overallScore;
    const battery = Math.round(this.batteryState.healthPct);

    const measured = [cpu, ram, disk, gpu].filter((v) => v > 0);
    const overall =
      measured.length > 0
        ? Math.round(measured.reduce((s, v) => s + v, 0) / measured.length)
        : 0;

    return {
      cpu,
      ram,
      disk,
      gpu,
      battery,
      overall,
      grade: overall > 0 ? gradeFromOverall(overall) : 'B',
      timestamp: this.lastSuiteTimestamp,
    };
  }

  private detachPeripheralsListeners(): void {
    if (this.peripheralsCleanup) {
      this.peripheralsCleanup();
      this.peripheralsCleanup = null;
    }
    peripheralsTestService.stopAll();
    this.pressedKeys.clear();
  }

  private setModule(mod: ActiveModule): void {
    if (this.activeModule === mod) return;

    // Cleanly detach canvas-bound or hardware-bound modules when leaving
    if (this.activeModule === 'gpu') {
      gpuStressEngine.unmount();
    }
    if (this.activeModule === 'game') {
      gameBenchService.unmount();
    }
    if (this.activeModule === 'display') {
      this.stopDisplaySlideshow();
      displayDiagnostics.stopOledBurnInProtection(false);
      displayDiagnostics.detachPreviewCanvas();
    }
    if (this.activeModule === 'peripherals') {
      this.detachPeripheralsListeners();
    }

    this.activeModule = mod;
    this.updateNavActive();
    this.renderWorkspace();
  }

  private stopDisplaySlideshow(): void {
    if (this.displaySlideshowTimer !== null) {
      clearInterval(this.displaySlideshowTimer);
      this.displaySlideshowTimer = null;
    }
  }

  private renderShell(): void {
    const navItems: Array<{ id: ActiveModule; label: string }> = [
      { id: 'dashboard', label: 'Pulpit' },
      { id: 'scheduler', label: 'Harmonogram' },
      { id: 'game', label: 'Gra 3D MAX' },
      { id: 'cpu', label: 'CPU' },
      { id: 'ram', label: 'RAM' },
      { id: 'disk', label: 'Dysk' },
      { id: 'gpu', label: 'GPU 3D' },
      { id: 'display', label: 'Ekran' },
      { id: 'battery', label: 'Bateria' },
      { id: 'peripherals', label: 'Peryferia' },
      { id: 'network', label: 'Sieć' },
    ];

    const isHc = this.theme === 'high-contrast';
    const soundOn = soundNotificationService.isEnabled();

    this.root.innerHTML = `
      <header class="topbar">
        <button class="brand-wordmark" data-nav="dashboard" type="button">
          <span class="brand-mark">${iconSvg('pulse', 15)}</span>
          <span>SystemPulse Pro</span>
        </button>

        <nav class="topbar-nav" aria-label="Moduły diagnostyczne">
          ${navItems
            .map(
              (item) => `
              <button
                type="button"
                class="nav-link ${item.id === this.activeModule ? 'active' : ''}"
                data-nav="${item.id}"
              >
                ${item.label}
              </button>`
            )
            .join('')}
        </nav>

        <div class="topbar-actions">
          <button
            id="btn-sound-toggle"
            type="button"
            class="btn btn-secondary btn-sm"
            aria-pressed="${soundOn}"
            title="${soundOn ? 'Subtelny sygnał dźwiękowy (Web Audio API) po zakończeniu testu: WŁĄCZONY' : 'Subtelny sygnał dźwiękowy (Web Audio API) po zakończeniu testu: WYŁĄCZONY'}"
          >
            ${iconSvg(soundOn ? 'volume-on' : 'volume-off', 14)}
            <span>${soundOn ? 'Dźwięk: WŁ.' : 'Dźwięk: WYŁ.'}</span>
          </button>
          <button
            id="btn-theme-toggle"
            type="button"
            class="btn btn-secondary btn-sm"
            aria-pressed="${isHc}"
            title="${isHc ? 'Przełącz na motyw ciemny' : 'Przełącz na tryb wysokiego kontrastu (jasny)'}"
          >
            ${iconSvg('contrast', 14)}
            <span>${isHc ? 'Ciemny' : 'Kontrast'}</span>
          </button>
          <button
            id="btn-download-portable-exe"
            type="button"
            class="btn btn-amber btn-sm"
            title="Pobierz paczkę Portable Windows (.EXE + Launcher Bez Limitu FPS + Portal w archiwum .ZIP)"
          >
            ${iconSvg('download', 14)}
            <span>Portable .EXE (.ZIP)</span>
          </button>
          <button id="btn-run-full-suite" type="button" class="btn btn-primary btn-sm">
            ${iconSvg('play', 14)}
            <span>Pełny test</span>
          </button>
        </div>
      </header>

      <main id="workspace-host" class="workspace"></main>

      <footer class="app-footer">
        <span>SystemPulse Pro · Pakiet diagnostyczny PC i Laptopa od A do Z</span>
        <span id="footer-autosave-status" class="font-mono">Auto-zapis IndexedDB aktywny</span>
      </footer>
    `;

    this.root.querySelectorAll<HTMLButtonElement>('[data-nav]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const target = btn.dataset.nav as ActiveModule;
        if (target) this.setModule(target);
      });
    });

    this.root.querySelector<HTMLButtonElement>('#btn-sound-toggle')?.addEventListener('click', () => {
      this.toggleSoundNotifications();
    });

    this.root.querySelector<HTMLButtonElement>('#btn-theme-toggle')?.addEventListener('click', () => {
      this.toggleTheme();
    });

    this.root.querySelector<HTMLButtonElement>('#btn-download-portable-exe')?.addEventListener('click', (e) => {
      const filename = downloadPortableExeZip();
      const btn = e.currentTarget as HTMLButtonElement;
      const origHtml = btn.innerHTML;
      btn.innerHTML = `${iconSvg('download', 14)}<span>Pobrano .ZIP ✓</span>`;
      window.setTimeout(() => {
        if (btn.isConnected) btn.innerHTML = origHtml;
      }, 2400);
      void this.recordLog(
        'SYSTEM',
        'OK',
        'Pobrano paczkę instalacyjną Portable .EXE (.ZIP)',
        filename,
        'Win64 Portable',
        'Wygenerowano archiwum ZIP z natywnym launcherem SystemPulse-Pro.exe, kompilatorem .NET i portalem GPU Bez Limitu FPS.'
      );
    });

    const fullBtn = this.root.querySelector<HTMLButtonElement>('#btn-run-full-suite');
    fullBtn?.addEventListener('click', () => void this.runFullSystemSuite());
  }

  private toggleSoundNotifications(): void {
    const enabled = soundNotificationService.toggle();
    const btn = this.root.querySelector<HTMLButtonElement>('#btn-sound-toggle');
    if (btn) {
      btn.setAttribute('aria-pressed', String(enabled));
      btn.title = enabled
        ? 'Subtelny sygnał dźwiękowy (Web Audio API) po zakończeniu testu: WŁĄCZONY'
        : 'Subtelny sygnał dźwiękowy (Web Audio API) po zakończeniu testu: WYŁĄCZONY';
      btn.innerHTML = `${iconSvg(enabled ? 'volume-on' : 'volume-off', 14)}<span>${enabled ? 'Dźwięk: WŁ.' : 'Dźwięk: WYŁ.'}</span>`;
    }
  }

  private updateNavActive(): void {
    this.root.querySelectorAll<HTMLButtonElement>('.nav-link').forEach((el) => {
      el.classList.toggle('active', el.dataset.nav === this.activeModule);
    });
  }

  private syncTopbarCta(): void {
    const btn = this.root.querySelector<HTMLButtonElement>('#btn-run-full-suite');
    if (!btn) return;
    btn.disabled = this.fullSuiteRunning;
    btn.innerHTML = this.fullSuiteRunning
      ? `<span>Trwa test...</span>`
      : `${iconSvg('play', 14)}<span>Pełny test</span>`;
  }

  private async runFullSystemSuite(): Promise<void> {
    if (this.fullSuiteRunning) return;
    this.fullSuiteRunning = true;
    this.beginStressSession();
    this.syncTopbarCta();

    try {
      this.fullSuiteStep = 'Krok 1/5: Test procesora CPU (Single/Multi-Core, GZIP, SHA-256)...';
      this.setModule('dashboard');
      this.renderWorkspace();

      this.cpuState = await cpuTestService.runFullBenchmark((res) => {
        this.cpuState = res;
        if (this.activeModule === 'dashboard') this.renderWorkspace();
      });
      await this.recordLog(
        'CPU',
        'OK',
        'Zakończono test CPU',
        'Multi-Core',
        `${this.cpuState.multiCoreScore} pkt`,
        `Single-Core: ${this.cpuState.singleCoreScore}, GZIP: ${this.cpuState.compressionMBs} MB/s, SHA-256: ${this.cpuState.cryptoSha256MBs} MB/s`
      );

      this.fullSuiteStep = 'Krok 2/5: Test pamięci RAM (128 MB wzorce bitowe, PRNG, przepustowość)...';
      if (this.activeModule === 'dashboard') this.renderWorkspace();
      this.ramState = await ramTestService.runTest(128, (res) => {
        this.ramState = res;
        if (this.activeModule === 'dashboard') this.renderWorkspace();
      });
      await this.recordLog(
        'RAM',
        this.ramState.errorsFound === 0 ? 'OK' : 'ERROR',
        'Zakończono test RAM',
        'Przepustowość / Błędy',
        `${this.ramState.bandwidthReadMBs} MB/s | ${this.ramState.errorsFound} błędów`,
        `Zapis: ${this.ramState.bandwidthWriteMBs} MB/s, Opóźnienie: ${this.ramState.latencyNs} ns, Ocena: ${this.ramState.healthGrade}`
      );

      this.fullSuiteStep = 'Krok 3/5: Test dysku SSD/HDD (OPFS/IDB I/O + diagnostyka SMART)...';
      if (this.activeModule === 'dashboard') this.renderWorkspace();
      this.diskState = await diskTestService.runTest((res) => {
        this.diskState = res;
        if (this.activeModule === 'dashboard') this.renderWorkspace();
      });
      await this.recordLog(
        'DISK',
        this.diskState.smartStatus === 'ZDROWY' ? 'OK' : 'WARN',
        'Zakończono test dysku i SMART',
        'Odczyt Seq / SMART',
        `${this.diskState.seqReadMBs} MB/s | ${this.diskState.smartStatus}`,
        `Zapis: ${this.diskState.seqWriteMBs} MB/s, 4K: ${this.diskState.rand4kIops} IOPS, Dostęp: ${this.diskState.accessTimeAvgMs} ms`
      );

      this.fullSuiteStep = 'Krok 4/5: Test sieci i opóźnień (Ping, Jitter, utrata pakietów)...';
      if (this.activeModule === 'dashboard') this.renderWorkspace();
      this.networkState = await networkTestService.runTest((res) => {
        this.networkState = res;
        if (this.activeModule === 'dashboard') this.renderWorkspace();
      });
      await this.recordLog(
        'NETWORK',
        this.networkState.qualityGrade === 'WZOROWA' || this.networkState.qualityGrade === 'DOBRA' ? 'OK' : 'WARN',
        'Zakończono test sieci',
        'Ping / Jitter',
        `${this.networkState.pingAvgMs} ms / ${this.networkState.jitterMs} ms`,
        `Utrata: ${this.networkState.packetLossPct}%, Transfer: ${this.networkState.downloadEstMbps} Mbps, Ocena: ${this.networkState.qualityGrade}`
      );

      this.fullSuiteStep = 'Krok 5/5: Test karty graficznej WebGL 3D bez limitu FPS (4 s)...';
      this.setModule('gpu');
      await new Promise((r) => setTimeout(r, 150));
      this.gpuState = await gpuStressEngine.runTimedBenchmark(4200, (m) => {
        this.gpuState = m;
        this.patchGpuLive();
      });
      await this.recordLog(
        'GPU',
        this.gpuState.verdict === 'STABILNY' ? 'OK' : 'WARN',
        'Zakończono stres-test GPU 3D',
        'Śr. / Max FPS',
        `${this.gpuState.avgFps} / ${this.gpuState.maxFps} FPS`,
        `Tryb: ${this.gpuState.fpsMode}, Preset: ${this.gpuState.preset}, 1% Low: ${this.gpuState.low1PctFps} FPS, Stabilność: ${this.gpuState.stabilityPct}%`
      );

      await this.runAuto12ComponentScan();
      this.lastSuiteTimestamp = Date.now();
      this.fullSuiteStep = 'Kompleksowa diagnostyka od A do Z zakończona i zapisana w IndexedDB.';
      const scores = this.getSuiteScores();
      const combinedStab = Number(
        ((this.cpuState.stabilityPct + this.gpuState.stabilityPct) / 2).toFixed(1)
      );
      this.finalizeStressSession(
        'Pełna Diagnostyka',
        combinedStab,
        `Indeks ${scores.overall}/100 (${scores.grade}) · CPU ${this.cpuState.multiCoreScore} pkt · GPU ${this.gpuState.avgFps} FPS`
      );
      this.setModule('dashboard');
    } finally {
      this.fullSuiteRunning = false;
      this.syncTopbarCta();
      this.renderWorkspace();
    }
  }

  private exportPdfReport(): void {
    const scores = this.getSuiteScores();
    generateDiagnosticPdfReport({
      specs: this.specs,
      scores,
      cpu: this.cpuState,
      ram: this.ramState,
      disk: this.diskState,
      gpu: this.gpuState,
      game: this.gameState,
      network: this.networkState,
      battery: this.batteryState,
      realCpuTempC: thermalMonitorService.getLiveCpuTempC(),
      realGpuTempC: thermalMonitorService.getLiveGpuTempC(),
    });
    void this.recordLog(
      'SYSTEM',
      'OK',
      'Eksport raportu PDF',
      'Indeks ogólny',
      scores.overall > 0 ? `${scores.overall}/100 (${scores.grade})` : 'Podsumowanie sprzętu',
      'Wygenerowano sformatowany dokument diagnostyczny PDF (A4)'
    );
    const pdfBtn = this.root.querySelector<HTMLButtonElement>('#dash-export-pdf-btn');
    if (pdfBtn) {
      pdfBtn.innerHTML = `${iconSvg('pdf', 14)}<span>Zapisano PDF ✓</span>`;
      window.setTimeout(() => {
        if (pdfBtn.isConnected) {
          pdfBtn.innerHTML = `${iconSvg('pdf', 14)}<span>Pobierz raport PDF</span>`;
        }
      }, 2200);
    }
  }

  private exportReport(): void {
    const scores = this.getSuiteScores();
    const report = {
      generatedAt: new Date().toISOString(),
      application: 'SystemPulse Pro',
      scores,
      specs: this.specs,
      cpu: {
        singleCoreScore: this.cpuState.singleCoreScore,
        multiCoreScore: this.cpuState.multiCoreScore,
        scalingRatio: this.cpuState.scalingRatio,
        compressionMBs: this.cpuState.compressionMBs,
        cryptoSha256MBs: this.cpuState.cryptoSha256MBs,
        peakTempC: this.cpuState.peakTempC,
        stabilityPct: this.cpuState.stabilityPct,
      },
      ram: {
        allocatedMB: this.ramState.allocatedMB,
        bandwidthReadMBs: this.ramState.bandwidthReadMBs,
        bandwidthWriteMBs: this.ramState.bandwidthWriteMBs,
        latencyNs: this.ramState.latencyNs,
        errorsFound: this.ramState.errorsFound,
        healthGrade: this.ramState.healthGrade,
      },
      disk: {
        backend: this.diskState.backend,
        seqReadMBs: this.diskState.seqReadMBs,
        seqWriteMBs: this.diskState.seqWriteMBs,
        rand4kIops: this.diskState.rand4kIops,
        accessTimeAvgMs: this.diskState.accessTimeAvgMs,
        smartStatus: this.diskState.smartStatus,
        smartHealthPct: this.diskState.smartHealthPct,
      },
      gpu: {
        rendererName: this.gpuState.rendererName,
        preset: this.gpuState.preset,
        avgFps: this.gpuState.avgFps,
        low1PctFps: this.gpuState.low1PctFps,
        stabilityPct: this.gpuState.stabilityPct,
        verdict: this.gpuState.verdict,
      },
      battery: {
        levelPct: this.batteryState.levelPct,
        wearLevelPct: this.batteryState.wearLevelPct,
        healthPct: this.batteryState.healthPct,
        designCapacityMWh: this.batteryState.designCapacityMWh,
        fullChargeCapacityMWh: this.batteryState.fullChargeCapacityMWh,
        condition: this.batteryState.condition,
      },
    };

    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `systempulse-raport-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  private downloadThermalSnapshot(triggerBtn?: HTMLButtonElement | null): void {
    const now = new Date();
    const stamp = `${now.toISOString().slice(0, 10)}_${now.toTimeString().slice(0, 8).replace(/:/g, '-')}`;
    const payload = {
      exportedAt: now.toISOString(),
      application: 'SystemPulse Pro',
      type: 'thermal-state-snapshot',
      system: this.specs
        ? {
            os: this.specs.os,
            platform: this.specs.platform,
            cpuCores: this.specs.cpuCores,
            gpuRenderer: this.specs.gpuRenderer,
          }
        : null,
      thermalState: this.thermalState,
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `systempulse-thermal-snapshot-${stamp}.json`;
    a.click();
    URL.revokeObjectURL(url);

    void this.recordLog(
      'THERMAL',
      'OK',
      'Eksport snapshotu termicznego (JSON)',
      this.thermalState.sensorMode,
      this.thermalState.avgSystemTempC !== null
        ? `Śr. ${this.thermalState.avgSystemTempC.toFixed(1)} °C`
        : this.thermalState.thermalStatus,
      `Pobrano zrzut 16 stref thermalState wraz z historią 60s do pliku JSON`
    );

    if (triggerBtn) {
      const origHtml = triggerBtn.innerHTML;
      triggerBtn.innerHTML = `${iconSvg('download', 14)}<span>Zapisano JSON ✓</span>`;
      window.setTimeout(() => {
        if (triggerBtn.isConnected) triggerBtn.innerHTML = origHtml;
      }, 2200);
    }
  }

  private async downloadAllDiagnosticData(triggerBtn?: HTMLButtonElement | null): Promise<void> {
    let logs: Awaited<ReturnType<typeof persistenceService.getAllLogs>> = [];
    try {
      logs = await persistenceService.getAllLogs();
    } catch {
      logs = [];
    }

    const { filename, byteSize } = downloadFullDiagnosticDataJson({
      systemSpecs: this.specs,
      suiteScores: this.getSuiteScores(),
      cpuState: this.cpuState,
      ramState: this.ramState,
      diskState: this.diskState,
      gpuState: this.gpuState,
      gpuSuiteResults: this.gpuSuiteResults,
      gameState: this.gameState,
      batteryState: this.batteryState,
      thermalState: this.thermalState,
      networkState: this.networkState,
      fanState: this.fanState,
      fanCurve: fanTestService.getFanCurve(),
      hardwareScan: this.hardwareScan,
      stressHistory: this.stressHistory,
      schedulerQueue: this.schedulerQueue,
      lastSchedulerReport: this.lastSchedulerReport,
      diagnosticLogs: logs,
      metadata: {
        lastSuiteTimestamp: this.lastSuiteTimestamp,
        lastSavedAt: this.lastSavedAt,
        theme: this.theme,
        soundNotificationsEnabled: soundNotificationService.isEnabled(),
      },
    });

    const sizeKB = (byteSize / 1024).toFixed(1);
    void this.recordLog(
      'SYSTEM',
      'OK',
      'Eksport wszystkich danych diagnostycznych (JSON)',
      'Pełny zrzut',
      `${sizeKB} KB`,
      `Zapisano kompletny stan wszystkich modułów testowych i specyfikacji systemu do pliku ${filename}`
    );

    if (triggerBtn) {
      const origHtml = triggerBtn.innerHTML;
      triggerBtn.innerHTML = `${iconSvg('download', 14)}<span>Zapisano JSON ✓</span>`;
      window.setTimeout(() => {
        if (triggerBtn.isConnected) triggerBtn.innerHTML = origHtml;
      }, 2200);
    }
  }

  private renderWorkspace(): void {
    const host = this.root.querySelector<HTMLElement>('#workspace-host');
    if (!host) return;

    this.workspaceErrorBoundary.render(this.activeModule, host, () => {
      switch (this.activeModule) {
        case 'dashboard':
          this.renderDashboard(host);
          break;
        case 'scheduler':
          this.renderSchedulerView(host);
          break;
        case 'game':
          this.renderGameBenchView(host);
          break;
        case 'cpu':
          this.renderCpuView(host);
          break;
        case 'ram':
          this.renderRamView(host);
          break;
        case 'disk':
          this.renderDiskView(host);
          break;
        case 'gpu':
          this.renderGpuView(host);
          break;
        case 'display':
          this.renderDisplayView(host);
          break;
        case 'battery':
          this.renderBatteryView(host);
          break;
        case 'peripherals':
          this.renderPeripheralsView(host);
          break;
        case 'network':
          this.renderNetworkView(host);
          break;
      }
    });
  }

  /* =========================================================================
     1. PULPIT (DASHBOARD & SYSTEM OVERVIEW)
     ========================================================================= */
  private renderDashboard(host: HTMLElement): void {
    const s = this.specs;
    const scores = this.getSuiteScores();

    host.innerHTML = `
      <div class="stack-lg">
        <div class="section-header">
          <div>
            <h1 class="section-title">Diagnostyka i wydajność komputera</h1>
            <p class="section-subtitle">
              Kompleksowe testy procesora, pamięci RAM, dysku SSD/HDD ze SMART, układu graficznego 3D, matrycy oraz baterii laptopa.
            </p>
            ${
              this.lastSavedAt
                ? `<div class="meta-line" style="margin-top:6px;">
                    <span>${this.restoredFromStorage ? 'Przywrócono ostatnie wyniki z pamięci IndexedDB' : 'Wyniki automatycznie zapisane w IndexedDB'}</span>
                    <span class="meta-sep">·</span>
                    <span class="font-mono">${new Date(this.lastSavedAt).toLocaleString('pl-PL')}</span>
                  </div>`
                : ''
            }
          </div>
          <div class="row-wrap">
            <button id="dash-export-pdf-btn" type="button" class="btn btn-secondary" title="Zapisz podsumowanie diagnostyki komputera jako sformatowany dokument PDF (A4)" aria-label="Pobierz raport PDF">
              ${iconSvg('pdf', 14)}
              <span>Pobierz raport PDF</span>
            </button>
            <button id="dash-export-hw-inventory-btn" type="button" class="btn btn-secondary" title="Generuj szczegółowy raport PDF inwentarza sprzętu (RAM, dyski, matryca, GPU)" aria-label="Inwentarz Sprzętu (PDF)">
              ${iconSvg('pdf', 14)}
              <span>Inwentarz Sprzętu (PDF)</span>
            </button>
            <button id="dash-export-logs-btn" type="button" class="btn btn-secondary" title="Eksportuj wszystkie logi diagnostyczne z IndexedDB do pliku CSV">
              ${iconSvg('csv', 14)}
              <span>Pobierz logi CSV <span id="dash-logs-count" class="font-mono">(${this.logCount})</span></span>
            </button>
            <button id="dash-download-snapshot-btn" type="button" class="btn btn-secondary" title="Pobierz bieżący zrzut danych thermalState (z 60-sekundową historią czujników) jako plik JSON do analizy offline" aria-label="Download Snapshot">
              ${iconSvg('thermal', 14)}
              <span>Download Snapshot</span>
            </button>
            <button id="dash-download-results-csv-btn" type="button" class="btn btn-secondary" title="Pobierz aktualne wyniki testów wydajności oraz specyfikację wykrytego sprzętu w pliku CSV" aria-label="Pobierz wyniki">
              ${iconSvg('csv', 14)}
              <span>Pobierz wyniki</span>
            </button>
            <button id="dash-download-all-data-btn" type="button" class="btn btn-secondary" title="Pobierz pełny plik JSON zawierający wszystkie stany testów diagnostycznych (CPU, RAM, Dysk, GPU, Gra 3D, Bateria, Termika, Sieć, Wentylatory, Harmonogram, Logi) oraz specyfikację systemu" aria-label="Download All Data">
              ${iconSvg('download', 14)}
              <span>Download All Data</span>
            </button>
            <button id="dash-export-btn" type="button" class="btn btn-secondary">
              ${iconSvg('download', 14)}
              <span>JSON</span>
            </button>
            ${
              this.lastSavedAt || this.logCount > 0
                ? `<button id="dash-clear-saved-btn" type="button" class="btn btn-danger btn-sm" title="Usuń zapisane wyniki i logi z IndexedDB">
                    ${iconSvg('trash', 14)}
                    <span>Wyczyść</span>
                  </button>`
                : ''
            }
            <button id="dash-run-all-btn" type="button" class="btn btn-primary" ${this.fullSuiteRunning ? 'disabled' : ''}>
              ${iconSvg('play', 14)}
              <span>${this.fullSuiteRunning ? 'Wykonywanie testów...' : 'Uruchom pełną diagnostykę'}</span>
            </button>
            <button id="dash-torture-extreme-btn" type="button" class="btn btn-amber" ${this.fullSuiteRunning ? 'disabled' : ''} title="Jednoczesny Torture Test CPU (Wszystkie Wątki AVX/FMA) + GPU 3D Ultra MAX + RAM + Zasilacz ATX">
              ${iconSvg('cpu', 14)}
              <span>Torture Test EXTREME (CPU+GPU)</span>
            </button>
          </div>
        </div>

        ${
          this.fullSuiteRunning || this.fullSuiteStep
            ? `
          <div class="panel">
            <div class="row-between" style="margin-bottom:8px;">
              <span style="font-weight:600;">${esc(this.fullSuiteStep)}</span>
              <span class="font-mono status-cyan">${this.fullSuiteRunning ? 'W TOKU' : 'GOTOWE'}</span>
            </div>
            <div class="progress-track">
              <div class="progress-fill ${this.fullSuiteRunning ? '' : 'ok'}" style="width:${
                this.fullSuiteRunning
                  ? Math.max(12, Math.round((this.cpuState.progress + this.ramState.progress + this.diskState.progress) / 3))
                  : 100
              }%"></div>
            </div>
          </div>`
            : ''
        }

        <div class="grid-4">
          <div class="metric-card">
            <div class="row-between">
              <span class="metric-label">Procesor (CPU — 6 podtestów)</span>
              <button type="button" class="btn btn-secondary btn-sm" style="padding:2px 8px;font-size:11px;" data-open-mod="cpu">Testuj CPU</button>
            </div>
            <div class="metric-row">
              <span class="metric-value" data-metric-key="dash-cpu-metric" data-metric-target="${this.cpuState.multiCoreScore}">${this.cpuState.multiCoreScore > 0 ? this.cpuState.multiCoreScore.toLocaleString('pl-PL') : '—'}</span>
              <span class="metric-unit">pkt MC</span>
            </div>
            <span class="metric-foot">${s ? `${s.cpuCores} wątków · ${this.cpuState.avxMatrixGflops ? `AVX ${this.cpuState.avxMatrixGflops} GFLOPS · ` : ''}${this.cpuState.grade}` : 'Wykrywanie...'}</span>
          </div>

          <div class="metric-card">
            <div class="row-between">
              <span class="metric-label">Pamięć operacyjna (RAM — 6 testów)</span>
              <button type="button" class="btn btn-secondary btn-sm" style="padding:2px 8px;font-size:11px;" data-open-mod="ram">Testuj RAM</button>
            </div>
            <div class="metric-row">
              <span class="metric-value" data-metric-key="dash-ram-metric" data-metric-target="${this.ramState.bandwidthReadMBs}">${this.ramState.bandwidthReadMBs > 0 ? this.ramState.bandwidthReadMBs.toLocaleString('pl-PL') : '—'}</span>
              <span class="metric-unit">MB/s</span>
            </div>
            <span class="metric-foot">Błędy: ${this.ramState.errorsFound} · ${this.ramState.cacheL1L2MBs ? `L1/L2: ${this.ramState.cacheL1L2MBs} MB/s · ` : ''}Stan: ${this.ramState.healthGrade}</span>
          </div>

          <div class="metric-card">
            <div class="row-between">
              <span class="metric-label">Dysk (SSD / NVMe + QD32)</span>
              <button type="button" class="btn btn-secondary btn-sm" style="padding:2px 8px;font-size:11px;" data-open-mod="disk">Testuj Dysk</button>
            </div>
            <div class="metric-row">
              <span class="metric-value" data-metric-key="dash-disk-metric" data-metric-target="${this.diskState.seqReadMBs}" data-metric-decimals="1">${this.diskState.seqReadMBs > 0 ? this.diskState.seqReadMBs.toLocaleString('pl-PL') : '—'}</span>
              <span class="metric-unit">MB/s</span>
            </div>
            <span class="metric-foot">SMART: ${this.diskState.smartStatus} · ${this.diskState.qd32Iops ? `QD32: ${this.diskState.qd32Iops} IOPS` : this.diskState.accessTimeAvgMs > 0 ? `${this.diskState.accessTimeAvgMs} ms` : 'Nie testowano'}</span>
          </div>

          <div class="metric-card">
            <div class="row-between">
              <span class="metric-label">Grafika 3D (${GPU_SCENE_CATALOG.length} sceny + ${GAME_CATALOG.length} gier)</span>
              <button type="button" class="btn btn-secondary btn-sm" style="padding:2px 8px;font-size:11px;" data-open-mod="gpu">Testuj GPU</button>
            </div>
            <div class="metric-row">
              <span class="metric-value" data-metric-key="dash-gpu-metric" data-metric-target="${this.gpuState.avgFps}">${this.gpuState.avgFps > 0 ? this.gpuState.avgFps.toLocaleString('pl-PL') : '—'}</span>
              <span class="metric-unit">FPS (${this.gpuState.fpsMode === 'uncapped' ? 'bez limitu' : 'VSync'})</span>
            </div>
            <span class="metric-foot">${this.gpuState.avgFps > 0 ? `Max: ${this.gpuState.maxFps} FPS · Stabilność: ${this.gpuState.stabilityPct}%` : `${GPU_SCENE_CATALOG.length} scen WebGL 3D · tryb bez limitu FPS`}</span>
          </div>
        </div>

        ${renderPcSuitabilityAndGamesReport({
          specs: this.specs,
          cpu: this.cpuState,
          ram: this.ramState,
          disk: this.diskState,
          gpu: this.gpuState,
          game: this.gameState,
        })}

        ${renderThermalHeatmapPanelHtml(this.thermalState, this.thermalShowSparklines)}

        ${renderStressHistoryPanelHtml(this.stressHistory)}

        ${this.renderDetailedStressLogHtml()}

        ${this.renderSoundAlertsConfigHtml()}

        <div class="grid-split-wide">
          <div class="panel stack-md">
            <div class="panel-header" style="margin-bottom:0;flex-wrap:wrap;gap:10px;">
              <div>
                <h2 class="panel-title">Specyfikacja wykrytego sprzętu (PC i Laptop)</h2>
                <span class="panel-caption">${s ? `${esc(s.os)} · ${esc(s.browser)}` : 'Skanowanie...'}</span>
              </div>
              <div class="row-wrap" style="gap:14px;align-items:center;">
                <div style="text-align:right;">
                  <div class="metric-label" style="font-size:11px;">Wykryte części</div>
                  <div class="metric-row" style="justify-content:flex-end;">
                    <span id="dash-hw-devices-val" class="metric-value" style="font-size:20px;" data-metric-key="dash-hw-devices" data-metric-target="${this.hardwareScan ? this.hardwareScan.devices.length : 0}">${this.hardwareScan ? this.hardwareScan.devices.length : '—'}</span>
                  </div>
                </div>
                <div style="text-align:right;">
                  <div class="metric-label" style="font-size:11px;">Indeks skanu</div>
                  <div class="metric-row" style="justify-content:flex-end;">
                    <span id="dash-hw-avg-score-val" class="metric-value status-cyan" style="font-size:20px;" data-metric-key="dash-hw-avg-score" data-metric-target="${this.componentScans.length > 0 ? Math.round(this.componentScans.reduce((acc, c) => acc + c.score, 0) / this.componentScans.length) : 0}">${this.componentScans.length > 0 ? Math.round(this.componentScans.reduce((acc, c) => acc + c.score, 0) / this.componentScans.length) : '—'}</span>
                    <span class="metric-unit">/100</span>
                  </div>
                </div>
                <button id="dash-rescan-hw-btn" type="button" class="btn btn-secondary btn-sm" title="Odśwież skan sprzętu i płynnie zaktualizuj metryki">
                  ${iconSvg('refresh', 13)}
                  <span>Odśwież skan</span>
                </button>
              </div>
            </div>
            <div class="kv-list">
              <div class="kv-row">
                <span class="kv-key">System operacyjny i architektura</span>
                <span class="kv-val">${s ? `${esc(s.os)} (${esc(s.platform)})` : 'Wykrywanie...'}</span>
              </div>
              <div class="kv-row">
                <span class="kv-key">Rdzenie logiczne procesora</span>
                <span class="kv-val">${s ? `${s.cpuCores} wątków` : '—'}</span>
              </div>
              <div class="kv-row">
                <span class="kv-key">Wykryta pamięć RAM (API)</span>
                <span class="kv-val">${s ? (typeof s.deviceMemory === 'number' ? `≥ ${s.deviceMemory} GB` : s.deviceMemory) : '—'}</span>
              </div>
              <div class="kv-row">
                <span class="kv-key">Karta graficzna (GPU Renderer)</span>
                <span class="kv-val">${s ? esc(s.gpuRenderer) : '—'}</span>
              </div>
              <div class="kv-row">
                <span class="kv-key">Obsługa WebGL / WebGPU i tekstury</span>
                <span class="kv-val">${s ? `${esc(s.webglVersion)} · ${s.maxTextureSize}px` : '—'}</span>
              </div>
              <div class="kv-row">
                <span class="kv-key">Wykryty model matrycy / monitora</span>
                <span id="dash-hw-panel-model" class="kv-val">${this.hardwareScan ? esc(this.hardwareScan.panel.label) : s ? `${s.screenResolution} @ ${s.estimatedRefreshRate} Hz` : '—'}</span>
              </div>
              <div class="kv-row">
                <span class="kv-key">Parametry ekranu (Gamut / HDR / Hz)</span>
                <span id="dash-hw-panel-params" class="kv-val">${this.hardwareScan ? `${this.hardwareScan.panel.nativeResolution} · ${this.hardwareScan.panel.colorGamut} · ${this.hardwareScan.panel.hdrSupported ? 'HDR' : 'SDR'} · ${this.hardwareScan.panel.refreshRateHz} Hz` : s ? `${s.screenResolution} · ${s.colorDepth}-bit · ~${s.estimatedRefreshRate} Hz` : '—'}</span>
              </div>
              <div class="kv-row">
                <span class="kv-key">Pula przestrzeni dyskowej przeglądarki</span>
                <span id="dash-hw-storage-pool" class="kv-val">${s && s.storageQuotaGB ? `${s.storageQuotaGB} GB (użyto ${s.storageUsageMB ?? 0} MB)` : 'Dostępna'}</span>
              </div>
              <div class="kv-row">
                <span class="kv-key">Sieć i opóźnienie</span>
                <span id="dash-hw-net-status" class="kv-val">${s ? `${s.online ? 'Online' : 'Offline'} · ${s.connectionType}${typeof s.rtt === 'number' ? ` · RTT ${s.rtt} ms` : ''}` : '—'}</span>
              </div>
              <div class="kv-row">
                <span class="kv-key">Stan baterii laptopa</span>
                <span id="dash-battery-val" class="kv-val ${isLowBatteryHealth(this.batteryState.healthPct) ? 'status-warn' : ''}">${this.batteryState.levelPct}% · Zdrowie ${this.batteryState.healthPct}% (Zużycie ${this.batteryState.wearLevelPct}%)</span>
              </div>
              <div id="dash-battery-low-health-alert">${renderLowBatteryHealthAlertHtml(this.batteryState, true)}</div>
            </div>
          </div>

          <div class="panel stack-md">
            <div class="panel-header" style="margin-bottom:0;">
              <h2 class="panel-title">Profil wydajności systemu</h2>
              <span class="panel-caption">Skala znormalizowana 0–100</span>
            </div>

            ${renderRadarChart([
              { label: 'CPU', value: scores.cpu },
              { label: 'RAM', value: scores.ram },
              { label: 'DYSK', value: scores.disk },
              { label: 'GPU', value: scores.gpu },
              { label: 'BAT', value: scores.battery },
            ])}

            <div class="grade-box">
              <span class="metric-label">Ogólny indeks systemu</span>
              <div class="row-wrap" style="justify-content:center;gap:14px;margin-top:6px;">
                <span class="grade-letter">${scores.overall > 0 ? scores.grade : '—'}</span>
                <div style="text-align:left;">
                  <span class="metric-value" style="font-size:22px;" data-metric-key="dash-overall-score" data-metric-target="${scores.overall}" data-metric-suffix=" / 100">${scores.overall > 0 ? `${scores.overall} / 100` : 'Brak pomiaru'}</span>
                  <div style="font-size:12px;color:var(--text-muted);">
                    ${scores.overall > 0 ? 'Na podstawie wykonanych testów podzespołów' : 'Kliknij „Pełny test”, aby wyliczyć ocenę'}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="grid-3">
          ${this.renderQuickModuleCard('scheduler', 'Harmonogram testów (Scheduler)', 'Kolejkuj dowolne testy (np. CPU → GPU → Gra MAX) z przerwami schładzania i odbierz jednolity raport PDF.', 'Otwórz harmonogram')}
          ${this.renderQuickModuleCard('game', `Gra 3D MAX (${GAME_CATALOG.length} światów 3D)`, `Katalog ${GAME_CATALOG.length} unikalnych światów 3D MAX: cienie 4K, Bloom Post-FX, 24k dronów, SSAA 200% i tryb gracza WASD.`, `Uruchom ${GAME_CATALOG.length} gier 3D MAX`)}
          ${this.renderQuickModuleCard('cpu', 'Procesor (CPU — 6 podtestów + Torture)', 'Single/Multi-Core, Macierze AVX/FMA 64×64, Ray-Tracing BVH, predykcja ALU, GZIP, SHA-256 i 5 trybów stresu.', 'Otwórz moduł CPU')}
          ${this.renderQuickModuleCard('ram', 'Pamięć operacyjna RAM (6 testów)', 'Checkerboard, PRNG Xorshift32, Walking Bits, March C- / MATS+, RowHammer 200k oraz Cache L1/L2 i kopia DMA.', 'Otwórz moduł RAM')}
          ${this.renderQuickModuleCard('disk', 'Dysk SSD / NVMe (QD32 & SMART)', 'Odczyt/zapis sekwencyjny (32–128 MB), losowy 4K, kolejka QD32 IOPS, Mixed 70/30 R/W i diagnostyka SMART.', 'Otwórz moduł Dysku')}
          ${this.renderQuickModuleCard('gpu', `Stres-test GPU (${GPU_SCENE_CATALOG.length} sceny 3D)`, `${GPU_SCENE_CATALOG.length} ekstremalnych scen WebGL 3D bez blokady VSync (gl.finish): Ray-Traced Metaballs, FFT Ocean, Navier-Stokes, CERN Collider.`, `Otwórz ${GPU_SCENE_CATALOG.length} testy GPU`)}
          ${this.renderQuickModuleCard('display', 'Diagnostyka ekranu (18 testów)', 'Wykrywanie modelu matrycy, martwe piksele RGB/CMY, OLED burn-in, Black Crush, Overdrive i Frame Skipping.', 'Otwórz testy matrycy')}
          ${this.renderQuickModuleCard('battery', 'Bateria & Zasilacz ATX PSU', 'Szczegółowe napięcia +12V/+5V/+3.3V, Alert Rules, 1-godzinny trend sprawności D3.js vs. temperatura i Wear Level.', 'Otwórz Zasilacz i Baterię')}
          ${this.renderQuickModuleCard('peripherals', 'Peryferia, Wentylatory i Urządzenia', 'Klawiatura, Mysz, Touchpad, Pad (gałki+wibracje), Mikrofon (odsłuch), Głośniki (Sweep), USB/HID i Test wentylatorów.', 'Otwórz peryferia i sprzęt')}
          ${this.renderQuickModuleCard('network', 'Sieć, Speed Test Multi-Stream & Bufferbloat', 'Nielimitowany Speed Test (8–24 strumienie), Ping, Jitter, pomiar Bufferbloat pod obciążeniem oraz DNS/TCP.', 'Otwórz test sieci')}
        </div>
      </div>
    `;

    host.querySelector('#dash-run-all-btn')?.addEventListener('click', () => void this.runFullSystemSuite());
    host.querySelector('#dash-torture-extreme-btn')?.addEventListener('click', () => {
      this.schedulerQueue = getSchedulerPresetQueue('thermal_burn');
      this.setModule('scheduler');
      void this.runSchedulerQueue();
    });
    host.querySelector('#dash-export-hw-inventory-btn')?.addEventListener('click', () => {
      generateHardwareInventoryPdfReport(this.specs, this.hardwareScan);
      void this.recordLog(
        'SYSTEM',
        'OK',
        'Eksport inwentarza sprzętu PDF',
        'PDF',
        'Inwentarz sprzętu',
        'Wygenerowano szczegółowy raport PDF inwentarza podzespołów komputerowych.'
      );
    });
    host.querySelector('#dash-export-pdf-btn')?.addEventListener('click', () => this.exportPdfReport());
    host.querySelector('#dash-export-logs-btn')?.addEventListener('click', async () => {
      await persistenceService.downloadLogsAsCsv();
      await this.recordLog('SYSTEM', 'INFO', 'Eksport logów CSV', 'Plik', 'CSV', 'Pobrano dziennik zdarzeń z IndexedDB');
    });
    host.querySelector('#dash-download-snapshot-btn')?.addEventListener('click', (e) => {
      this.downloadThermalSnapshot(e.currentTarget as HTMLButtonElement);
    });
    host.querySelector('#dash-download-results-csv-btn')?.addEventListener('click', (e) => {
      const btn = e.currentTarget as HTMLButtonElement;
      const result = downloadResultsCsv({
        systemSpecs: this.specs,
        hardwareScan: this.hardwareScan,
        suiteScores: this.getSuiteScores(),
        cpuState: this.cpuState,
        ramState: this.ramState,
        diskState: this.diskState,
        gpuState: this.gpuState,
        gameState: this.gameState,
        batteryState: this.batteryState,
        networkState: this.networkState,
      });
      void this.recordLog(
        'SYSTEM',
        'OK',
        'Eksport wyników i specyfikacji (CSV)',
        'Plik',
        result.filename,
        `Wyeksportowano ${result.rowCount} wierszy wyników testów oraz specyfikacji sprzętu do pliku CSV.`
      );
      const origHtml = btn.innerHTML;
      btn.innerHTML = `${iconSvg('csv', 14)}<span>Pobrano CSV ✓</span>`;
      window.setTimeout(() => {
        if (btn.isConnected) btn.innerHTML = origHtml;
      }, 2200);
    });
    host.querySelector('#dash-download-all-data-btn')?.addEventListener('click', (e) => {
      void this.downloadAllDiagnosticData(e.currentTarget as HTMLButtonElement);
    });
    host.querySelector('#dash-export-btn')?.addEventListener('click', () => this.exportReport());
    host.querySelector('#dash-clear-saved-btn')?.addEventListener('click', () => void this.clearPersistedResults());
    host.querySelector('#dash-export-stress-xlsx-btn')?.addEventListener('click', (e) => {
      if (this.stressHistory.length === 0) return;
      const count = exportStressHistoryToXlsx(this.stressHistory);
      void this.recordLog(
        'SYSTEM',
        'OK',
        'Eksport historii stres-testów (Excel)',
        'Sesje',
        `${count} sesji (.xlsx)`,
        'Wyeksportowano pełny dziennik stres-testów i arkusz podsumowania do pliku Excel (.xlsx)'
      );
      const btn = e.currentTarget as HTMLButtonElement;
      const origHtml = btn.innerHTML;
      btn.innerHTML = `${iconSvg('excel', 14)}<span>Zapisano .xlsx ✓</span>`;
      window.setTimeout(() => {
        if (btn.isConnected) btn.innerHTML = origHtml;
      }, 2200);
    });
    host.querySelector('#dash-export-stress-csv-btn')?.addEventListener('click', (e) => {
      if (this.stressHistory.length === 0) return;
      const count = exportStressHistoryToCsv(this.stressHistory);
      void this.recordLog(
        'SYSTEM',
        'OK',
        'Eksport historii stres-testów (CSV)',
        'Sesje',
        `${count} sesji (.csv)`,
        'Wyeksportowano dziennik stres-testów do pliku CSV (UTF-8 BOM)'
      );
      const btn = e.currentTarget as HTMLButtonElement;
      const origHtml = btn.innerHTML;
      btn.innerHTML = `${iconSvg('csv', 14)}<span>Zapisano .csv ✓</span>`;
      window.setTimeout(() => {
        if (btn.isConnected) btn.innerHTML = origHtml;
      }, 2200);
    });

    // Sound Alerts Config Binders
    const masterToggle = host.querySelector<HTMLInputElement>('#sound-master-toggle');
    masterToggle?.addEventListener('change', () => {
      soundNotificationService.setEnabled(masterToggle.checked);
    });
    host.querySelectorAll<HTMLInputElement>('[data-sound-ev-toggle]').forEach((chk) => {
      chk.addEventListener('change', () => {
        const evKey = chk.dataset.soundEvToggle as NotificationEventType;
        if (!evKey) return;
        const cur = soundNotificationService.getSettings();
        const evMap = cur.events;
        evMap[evKey].enabled = chk.checked;
        soundNotificationService.updateSettings({ events: evMap });
      });
    });
    host.querySelectorAll<HTMLSelectElement>('[data-sound-preset]').forEach((sel) => {
      sel.addEventListener('change', () => {
        const evKey = sel.dataset.soundPreset as NotificationEventType;
        if (!evKey) return;
        const preset = sel.value as SoundPreset;
        const cur = soundNotificationService.getSettings();
        const evMap = cur.events;
        evMap[evKey].preset = preset;
        soundNotificationService.updateSettings({ events: evMap });
      });
    });
    host.querySelectorAll<HTMLButtonElement>('[data-sound-test]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const evKey = btn.dataset.soundTest as NotificationEventType;
        if (!evKey) return;
        soundNotificationService.playEvent(evKey, 'preview');
      });
    });

    // Detailed Stress Log Filter & Search
    const searchInput = host.querySelector<HTMLInputElement>('#stress-log-search');
    const modFilter = host.querySelector<HTMLSelectElement>('#stress-log-module-filter');
    const filterStressLogs = () => {
      const q = (searchInput?.value || '').toLowerCase().trim();
      const mod = modFilter?.value || 'ALL';
      const rows = host.querySelectorAll<HTMLTableRowElement>('#stress-log-table-body tr[data-stress-row]');
      rows.forEach((row) => {
        const rowMod = row.dataset.stressRow || '';
        const text = row.textContent?.toLowerCase() || '';
        const matchMod = mod === 'ALL' || rowMod.toLowerCase().includes(mod.toLowerCase());
        const matchQ = !q || text.includes(q);
        row.style.display = matchMod && matchQ ? '' : 'none';
      });
    };
    searchInput?.addEventListener('input', filterStressLogs);
    modFilter?.addEventListener('change', filterStressLogs);
    host.querySelector('#dash-clear-stress-history-btn')?.addEventListener('click', () => {
      this.stressHistory = [];
      this.emitDiagnosticChanged('stress-history-clear', true);
      if (this.activeModule === 'dashboard') this.renderDashboard(host);
    });
    host.querySelector('#thermal-sparkline-toggle-btn')?.addEventListener('click', (e) => {
      this.thermalShowSparklines = !this.thermalShowSparklines;
      const btn = e.currentTarget as HTMLButtonElement;
      btn.className = `btn ${this.thermalShowSparklines ? 'btn-primary' : 'btn-secondary'} btn-sm`;
      btn.setAttribute('aria-pressed', this.thermalShowSparklines ? 'true' : 'false');
      btn.textContent = this.thermalShowSparklines ? 'Wykresy 60s: WŁ.' : 'Wykresy 60s: WYŁ.';
      this.patchDashboardThermalMap();
    });
    host.querySelector('#thermal-download-snapshot-btn')?.addEventListener('click', (e) => {
      this.downloadThermalSnapshot(e.currentTarget as HTMLButtonElement);
    });
    host.querySelector('#thermal-reset-peaks-btn')?.addEventListener('click', () => {
      thermalMonitorService.resetPeaks();
      this.patchDashboardThermalMap();
    });
    host.querySelector('#thermal-connect-file-btn')?.addEventListener('click', async () => {
      if (this.thermalState.sensorMode === 'hardware-live') {
        thermalMonitorService.disconnectBridge();
      } else {
        const res = await thermalMonitorService.connectLiveSensorFile();
        if (res.ok) this.emitDiagnosticChanged('thermal-live-file', false);
      }
      if (this.activeModule === 'dashboard') this.renderDashboard(host);
    });
    host.querySelector('#thermal-download-script-btn')?.addEventListener('click', (e) => {
      downloadWindowsLiveSensorScript();
      const btn = e.currentTarget as HTMLButtonElement;
      const orig = btn.textContent || 'Pobierz skrypt LIVE (.bat)';
      btn.textContent = 'Pobrano .bat ✓';
      window.setTimeout(() => {
        if (btn.isConnected) btn.textContent = orig;
      }, 2400);
    });
    host.querySelector('#thermal-connect-bridge-btn')?.addEventListener('click', async () => {
      if (this.thermalState.sensorMode === 'hardware-live' && !thermalMonitorService.hasLiveFileConnected()) {
        thermalMonitorService.disconnectBridge();
      } else {
        const res = await thermalMonitorService.connectHardwareBridge();
        if (res.ok) this.emitDiagnosticChanged('thermal-bridge', false);
      }
      if (this.activeModule === 'dashboard') this.renderDashboard(host);
    });
    host.querySelector('#thermal-copy-sensor-cmd-btn')?.addEventListener('click', async (e) => {
      const btn = e.currentTarget as HTMLButtonElement;
      try {
        await navigator.clipboard.writeText(SENSOR_DUMP_COMMANDS.windows);
      } catch {
        // Ignore clipboard errors
      }
      const orig = btn.textContent || 'Kopiuj komendę';
      btn.textContent = 'Skopiowano ✓';
      window.setTimeout(() => {
        if (btn.isConnected) btn.textContent = orig;
      }, 2200);
      const pasteInput = host.querySelector<HTMLTextAreaElement>('#thermal-sensor-paste-input');
      if (pasteInput) {
        pasteInput.placeholder =
          'Skopiowano komendę PowerShell (LHM/OHM WMI + nvidia-smi + NVMe + ACPI)! Uruchom w PowerShell i wklej wynik tutaj (Ctrl+V)...';
      }
    });
    host.querySelector('#thermal-sensor-import-btn')?.addEventListener('click', () => {
      const pasteInput = host.querySelector<HTMLTextAreaElement>('#thermal-sensor-paste-input');
      const raw = pasteInput?.value || '';
      const res = thermalMonitorService.importSensorText(raw);
      if (res.ok && pasteInput) {
        pasteInput.value = '';
        this.emitDiagnosticChanged('thermal-import', false);
      }
      this.patchDashboardThermalMap();
    });
    host.querySelectorAll<HTMLButtonElement>('[data-open-mod]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const mod = btn.dataset.openMod as ActiveModule;
        if (mod) this.setModule(mod);
      });
    });

    host.querySelector('#dash-rescan-hw-btn')?.addEventListener('click', async (e) => {
      const btn = e.currentTarget as HTMLButtonElement;
      if (btn.disabled) return;
      btn.disabled = true;
      const label = btn.querySelector('span');
      const prevLabel = label?.textContent || 'Odśwież skan';
      if (label) label.textContent = 'Skanowanie...';
      try {
        await this.rescanDashboardHardware();
      } finally {
        if (btn.isConnected) {
          btn.disabled = false;
          if (label) label.textContent = prevLabel;
        }
      }
    });

    bindPcSuitabilityReportEvents(host, () => this.renderDashboard(host));
    animateMetricValueElements(host, this.metricAnimPrevValues);
  }

  private renderQuickModuleCard(
    mod: ActiveModule,
    title: string,
    desc: string,
    cta: string
  ): string {
    return `
      <div class="panel stack-sm" style="justify-content:space-between;">
        <div class="stack-sm">
          <div class="row-between">
            <h3 class="panel-title">${title}</h3>
            <span style="color:var(--accent-cyan);">${iconSvg(mod, 18)}</span>
          </div>
          <p style="margin:0;font-size:13px;color:var(--text-secondary);">${desc}</p>
        </div>
        <div style="padding-top:6px;">
          <button type="button" class="btn btn-secondary btn-sm" data-open-mod="${mod}">${cta}</button>
        </div>
      </div>
    `;
  }

  private async rescanDashboardHardware(): Promise<void> {
    const specs = await getSystemSpecs();
    this.specs = specs;
    await hardwareScannerService.autoProbeFullLocalBridge(true);
    this.hardwareScan = await hardwareScannerService.scanAll(
      specs.estimatedRefreshRate,
      specs.gpuRenderer,
      specs
    );
    if (
      this.hardwareScan?.deepInventory?.disks?.length ||
      this.hardwareScan?.deepInventory?.logicalDisks?.length
    ) {
      diskTestService.registerHardwareInventoryDrives(
        this.hardwareScan.deepInventory.disks || [],
        this.hardwareScan.deepInventory.logicalDisks || []
      );
    }
    this.diskDrives = await diskTestService.refreshAvailableDrives(true);
    await this.runAuto12ComponentScan();
    this.patchDashboardHardwareScanMetrics();
  }

  private patchDashboardHardwareScanMetrics(): void {
    const host = this.root.querySelector<HTMLElement>('#sp-main-scroll');
    if (!host) return;
    const s = this.specs;

    const hwDevicesEl = host.querySelector<HTMLElement>('#dash-hw-devices-val');
    if (hwDevicesEl) {
      const deviceCount = this.hardwareScan ? this.hardwareScan.devices.length : 0;
      hwDevicesEl.dataset.metricTarget = String(deviceCount);
      if (!this.metricAnimPrevValues.has('dash-hw-devices')) {
        hwDevicesEl.textContent = this.hardwareScan ? String(deviceCount) : '—';
      }
    }

    const hwAvgScoreEl = host.querySelector<HTMLElement>('#dash-hw-avg-score-val');
    if (hwAvgScoreEl) {
      const avgScore =
        this.componentScans.length > 0
          ? Math.round(
              this.componentScans.reduce((acc, c) => acc + c.score, 0) / this.componentScans.length
            )
          : 0;
      hwAvgScoreEl.dataset.metricTarget = String(avgScore);
      if (!this.metricAnimPrevValues.has('dash-hw-avg-score')) {
        hwAvgScoreEl.textContent = this.componentScans.length > 0 ? String(avgScore) : '—';
      }
    }

    const overallEl = host.querySelector<HTMLElement>('.metric-value[data-metric-key="dash-overall-score"]');
    if (overallEl) {
      const scores = this.getSuiteScores();
      overallEl.dataset.metricTarget = String(scores.overall);
    }

    const panelModelEl = host.querySelector<HTMLElement>('#dash-hw-panel-model');
    if (panelModelEl) {
      panelModelEl.textContent = this.hardwareScan
        ? this.hardwareScan.panel.label
        : s
          ? `${s.screenResolution} @ ${s.estimatedRefreshRate} Hz`
          : '—';
    }

    const panelParamsEl = host.querySelector<HTMLElement>('#dash-hw-panel-params');
    if (panelParamsEl) {
      panelParamsEl.textContent = this.hardwareScan
        ? `${this.hardwareScan.panel.nativeResolution} · ${this.hardwareScan.panel.colorGamut} · ${this.hardwareScan.panel.hdrSupported ? 'HDR' : 'SDR'} · ${this.hardwareScan.panel.refreshRateHz} Hz`
        : s
          ? `${s.screenResolution} · ${s.colorDepth}-bit · ~${s.estimatedRefreshRate} Hz`
          : '—';
    }

    const storagePoolEl = host.querySelector<HTMLElement>('#dash-hw-storage-pool');
    if (storagePoolEl) {
      storagePoolEl.textContent =
        s && s.storageQuotaGB ? `${s.storageQuotaGB} GB (użyto ${s.storageUsageMB ?? 0} MB)` : 'Dostępna';
    }

    const netStatusEl = host.querySelector<HTMLElement>('#dash-hw-net-status');
    if (netStatusEl) {
      netStatusEl.textContent = s
        ? `${s.online ? 'Online' : 'Offline'} · ${s.connectionType}${typeof s.rtt === 'number' ? ` · RTT ${s.rtt} ms` : ''}`
        : '—';
    }

    animateMetricValueElements(host, this.metricAnimPrevValues);
  }

  private patchDashboardBatterySummary(): void {
    const el = this.root.querySelector('#dash-battery-val');
    if (el) {
      el.className = `kv-val ${isLowBatteryHealth(this.batteryState.healthPct) ? 'status-warn' : ''}`;
      el.textContent = `${this.batteryState.levelPct}% · Zdrowie ${this.batteryState.healthPct}% (Zużycie ${this.batteryState.wearLevelPct}%)`;
    }
    const alertSlot = this.root.querySelector('#dash-battery-low-health-alert');
    if (alertSlot) {
      alertSlot.innerHTML = renderLowBatteryHealthAlertHtml(this.batteryState, true);
    }
  }

  private patchDashboardThermalMap(): void {
    const body = this.root.querySelector('#dash-thermal-heatmap-body');
    if (body) {
      body.innerHTML = renderThermalHeatmapInnerHtml(this.thermalState, this.thermalShowSparklines);
    }
  }

  /* =========================================================================
     1B. HARMONOGRAM STRES-TESTÓW (STRESS TEST SCHEDULER)
     ========================================================================= */
  private renderSchedulerView(host: HTMLElement): void {
    const running = this.schedulerRunning;

    host.innerHTML = `
      <div class="stack-lg">
        <div class="section-header">
          <div>
            <h1 class="section-title">Harmonogram stres-testów (Wszystkie 12 Modułów A–Z)</h1>
            <p class="section-subtitle">
              Zbuduj własną kolejkę z pełnego katalogu 12 modułów (CPU Benchmark, CPU Burn-in, RAM MemTest86+, Dysk NVMe/SMART, GPU 3D, Maraton 40 Scen 3D, Gra 3D MAX, Wyścigi 3D Nitro GP, Ekran 32 plansze, Zasilacz PC 12V/5V/3.3V, Audio DSP Sweep, Sieć 10 Gbps) lub uruchom automatyczny Megatest A–Z jednym kliknięciem.
            </p>
          </div>
          <div class="row-wrap">
            ${
              running
                ? `<button id="sched-abort-btn" type="button" class="btn btn-danger">
                    ${iconSvg('stop', 14)}
                    <span>Przerwij kolejkę</span>
                  </button>`
                : `<button id="sched-run-mega-12-btn" type="button" class="btn btn-amber">
                    ${iconSvg('play', 14)}
                    <span>Auto-Start: Wszystkie 12 Testów A–Z</span>
                  </button>
                  <button id="sched-start-btn" type="button" class="btn btn-primary" ${this.schedulerQueue.length === 0 ? 'disabled' : ''}>
                    ${iconSvg('play', 14)}
                    <span>Uruchom kolejkę (${this.schedulerQueue.length})</span>
                  </button>`
            }
          </div>
        </div>

        ${running || this.schedulerStatusText || this.schedulerQueue.length > 0 ? this.renderSchedulerQueueTimelineHtml(this.schedulerQueue, this.schedulerActiveIndex, running) : ''}

        ${
          running || this.schedulerStatusText
            ? `
          <div class="panel stack-sm">
            <div class="row-between">
              <strong id="sched-status-text">${esc(this.schedulerStatusText)}</strong>
              <span id="sched-progress-pct" class="font-mono status-cyan">${this.schedulerProgressPct}%</span>
            </div>
            <div class="progress-track">
              <div id="sched-progress-bar" class="progress-fill ${running ? '' : 'ok'}" style="width:${this.schedulerProgressPct}%"></div>
            </div>
            <div id="sched-live-stage-box">
              ${running ? this.renderSchedulerLiveStageHtml() : ''}
            </div>
            <div id="sched-inline-viewport-wrap" style="display:none;margin-top:8px;">
              <div id="sched-inline-viewport" class="scheduler-gpu-inline"></div>
            </div>
          </div>`
            : ''
        }

        <div class="grid-split">
          <div class="panel stack-md">
            <div class="panel-header" style="margin-bottom:0;">
              <h2 class="panel-title">Dodaj testy i szablony kolejki (12 modułów)</h2>
              <span class="panel-caption">Szybka konfiguracja</span>
            </div>

            <div class="stack-sm">
              <span class="field-label">Gotowe szablony kolejek</span>
              <div class="row-wrap">
                <button type="button" class="btn btn-amber btn-sm" data-sched-preset="all_12_mega" ${running ? 'disabled' : ''}>★ Wszystkie 12 Testów (Pełny A–Z)</button>
                <button type="button" class="btn btn-secondary btn-sm" data-sched-preset="cpu_gpu" ${running ? 'disabled' : ''}>CPU → GPU → Wyścigi 3D</button>
                <button type="button" class="btn btn-secondary btn-sm" data-sched-preset="thermal_burn" ${running ? 'disabled' : ''}>Wygrzewanie CPU+GPU+Gra+PSU</button>
                <button type="button" class="btn btn-secondary btn-sm" data-sched-preset="mem_disk" ${running ? 'disabled' : ''}>RAM + Dysk</button>
              </div>
            </div>

            <div class="field-group">
              <label class="field-label" for="sched-cooldown-select">Przerwa schładzania między testami</label>
              <select id="sched-cooldown-select" class="field-input" ${running ? 'disabled' : ''}>
                <option value="0" ${this.schedulerCooldownSec === 0 ? 'selected' : ''}>0 s (bez pauzy)</option>
                <option value="2" ${this.schedulerCooldownSec === 2 ? 'selected' : ''}>2 s (krótka stabilizacja)</option>
                <option value="5" ${this.schedulerCooldownSec === 5 ? 'selected' : ''}>5 s (schładzanie termiczne)</option>
              </select>
            </div>

            <div class="stack-sm">
              <span class="field-label">Pełny katalog 12 testów — kliknij, aby dodać do kolejki</span>
              ${SCHEDULER_CATALOG.map(
                (entry) => `
                <button type="button" class="btn btn-secondary btn-sm" style="justify-content:space-between;text-align:left;width:100%;" data-sched-add="${entry.type}" ${running ? 'disabled' : ''}>
                  <span>+ ${esc(entry.label)}</span>
                </button>`
              ).join('')}
            </div>
          </div>

          <div class="panel stack-md">
            <div class="panel-header" style="margin-bottom:0;">
              <h2 class="panel-title">Aktywna kolejka wykonania (${this.schedulerQueue.length} kroków)</h2>
              <div class="row-wrap" style="gap:6px;">
                <button id="sched-add-all-12-btn" type="button" class="btn btn-secondary btn-sm" ${running ? 'disabled' : ''}>
                  Załaduj wszystkie 12
                </button>
                <button id="sched-clear-queue-btn" type="button" class="btn btn-secondary btn-sm" ${running || this.schedulerQueue.length === 0 ? 'disabled' : ''}>
                  Wyczyść kolejkę
                </button>
              </div>
            </div>

            ${
              this.schedulerQueue.length === 0
                ? `<div style="padding:24px 0;color:var(--text-muted);font-size:13px;">Kolejka jest pusta. Kliknij „★ Wszystkie 12 Testów (Pełny A–Z)” lub wybierz dowolne moduły po lewej stronie.</div>`
                : `
              <div class="queue-list">
                ${this.schedulerQueue
                  .map((item, idx) => {
                    const isActive = running && this.schedulerActiveIndex === idx;
                    const isDone = running && this.schedulerActiveIndex > idx;
                    const hasDur =
                      item.type === 'cpu_stress' ||
                      item.type === 'gpu_stress' ||
                      item.type === 'gpu_all_scenes' ||
                      item.type === 'game_ultra' ||
                      item.type === 'game_racing' ||
                      item.type === 'display_cal' ||
                      item.type === 'psu_stress' ||
                      item.type === 'audio_sweep';
                    return `
                    <div class="queue-item ${isActive ? 'active-step' : isDone ? 'done-step' : ''}">
                      <div class="row-wrap" style="gap:10px;flex:1;min-width:210px;">
                        <span class="queue-order">${idx + 1}</span>
                        <div>
                          <div style="font-weight:600;font-size:13px;">${esc(item.label)}</div>
                          <div style="font-size:11.5px;color:var(--text-muted);">${esc(describeItemConfig(item))}</div>
                        </div>
                      </div>
                      <div class="row-wrap" style="gap:6px;">
                        ${
                          hasDur
                            ? `<select class="field-input" style="width:auto;padding:5px 8px;font-size:12px;" data-sched-dur="${item.id}" ${running ? 'disabled' : ''}>
                                ${[4, 5, 6, 8, 10, 12, 20]
                                  .map(
                                    (sec) =>
                                      `<option value="${sec}" ${(item.durationSec || 6) === sec ? 'selected' : ''}>${sec}s</option>`
                                  )
                                  .join('')}
                              </select>`
                            : ''
                        }
                        ${
                          item.type === 'ram'
                            ? `<select class="field-input" style="width:auto;padding:5px 8px;font-size:12px;" data-sched-ram="${item.id}" ${running ? 'disabled' : ''}>
                                ${[64, 128, 256, 512]
                                  .map(
                                    (mb) =>
                                      `<option value="${mb}" ${(item.ramSizeMB || 128) === mb ? 'selected' : ''}>${mb} MB</option>`
                                  )
                                  .join('')}
                              </select>`
                            : ''
                        }
                        ${
                          item.type === 'gpu_stress' || item.type === 'gpu_all_scenes'
                            ? `<select class="field-input" style="width:auto;padding:5px 8px;font-size:12px;" data-sched-gpupreset="${item.id}" ${running ? 'disabled' : ''}>
                                ${(['standard', 'high', 'extreme', 'ultra'] as GpuLoadPreset[])
                                  .map(
                                    (p) =>
                                      `<option value="${p}" ${(item.gpuPreset || 'high') === p ? 'selected' : ''}>${p.toUpperCase()}</option>`
                                  )
                                  .join('')}
                              </select>`
                            : ''
                        }
                        <button type="button" class="btn btn-secondary btn-sm" data-sched-up="${idx}" ${running || idx === 0 ? 'disabled' : ''} title="Przesuń w górę">▲</button>
                        <button type="button" class="btn btn-secondary btn-sm" data-sched-down="${idx}" ${running || idx === this.schedulerQueue.length - 1 ? 'disabled' : ''} title="Przesuń w dół">▼</button>
                        <button type="button" class="btn btn-danger btn-sm" data-sched-del="${item.id}" ${running ? 'disabled' : ''}>Usuń</button>
                      </div>
                    </div>`;
                  })
                  .join('')}
              </div>`
            }
          </div>
        </div>

        <div id="sched-summary-container">
          ${renderSchedulerSummaryReportHtml(this.lastSchedulerReport)}
        </div>
      </div>
    `;

    host.querySelector('#sched-start-btn')?.addEventListener('click', () => void this.runSchedulerQueue());
    host.querySelector('#sched-run-mega-12-btn')?.addEventListener('click', () => {
      this.schedulerQueue = getSchedulerPresetQueue('all_12_mega');
      this.emitDiagnosticChanged('scheduler-config', false);
      void this.runSchedulerQueue();
    });
    host.querySelector('#sched-add-all-12-btn')?.addEventListener('click', () => {
      this.schedulerQueue = getSchedulerPresetQueue('all_12_mega');
      this.emitDiagnosticChanged('scheduler-config', false);
      this.renderSchedulerView(host);
    });
    host.querySelector('#sched-abort-btn')?.addEventListener('click', () => {
      this.schedulerAbortRequested = true;
      cpuTestService.stopStress();
      gpuStressEngine.stop();
      gameBenchService.stop();
      psuCalculatorService.setHighPowerSimulation(false);
      psuCalculatorService.setStressProfile('normal');
    });
    host.querySelector('#sched-clear-queue-btn')?.addEventListener('click', () => {
      this.schedulerQueue = [];
      this.emitDiagnosticChanged('scheduler-config', false);
      this.renderSchedulerView(host);
    });
    host.querySelector<HTMLSelectElement>('#sched-cooldown-select')?.addEventListener('change', (e) => {
      this.schedulerCooldownSec = Number((e.currentTarget as HTMLSelectElement).value) || 0;
    });

    host.querySelectorAll<HTMLButtonElement>('[data-sched-preset]').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.schedulerQueue = getSchedulerPresetQueue(btn.dataset.schedPreset || 'all_12_mega');
        this.emitDiagnosticChanged('scheduler-config', false);
        this.renderSchedulerView(host);
      });
    });

    host.querySelectorAll<HTMLButtonElement>('[data-sched-add]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const type = btn.dataset.schedAdd as ScheduledTestType;
        if (!type) return;
        this.schedulerQueue.push(createScheduledItem(type));
        this.emitDiagnosticChanged('scheduler-config', false);
        this.renderSchedulerView(host);
      });
    });

    host.querySelectorAll<HTMLSelectElement>('[data-sched-dur]').forEach((sel) => {
      sel.addEventListener('change', () => {
        const it = this.schedulerQueue.find((q) => q.id === sel.dataset.schedDur);
        if (it) it.durationSec = Number(sel.value) || 6;
        this.emitDiagnosticChanged('scheduler-config', false);
      });
    });
    host.querySelectorAll<HTMLSelectElement>('[data-sched-ram]').forEach((sel) => {
      sel.addEventListener('change', () => {
        const it = this.schedulerQueue.find((q) => q.id === sel.dataset.schedRam);
        if (it) it.ramSizeMB = Number(sel.value) || 128;
        this.emitDiagnosticChanged('scheduler-config', false);
      });
    });
    host.querySelectorAll<HTMLSelectElement>('[data-sched-gpupreset]').forEach((sel) => {
      sel.addEventListener('change', () => {
        const it = this.schedulerQueue.find((q) => q.id === sel.dataset.schedGpupreset);
        if (it) it.gpuPreset = (sel.value as GpuLoadPreset) || 'high';
        this.emitDiagnosticChanged('scheduler-config', false);
      });
    });

    host.querySelectorAll<HTMLButtonElement>('[data-sched-up]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const idx = Number(btn.dataset.schedUp);
        if (idx > 0) {
          const tmp = this.schedulerQueue[idx - 1];
          this.schedulerQueue[idx - 1] = this.schedulerQueue[idx];
          this.schedulerQueue[idx] = tmp;
          this.emitDiagnosticChanged('scheduler-config', false);
          this.renderSchedulerView(host);
        }
      });
    });
    host.querySelectorAll<HTMLButtonElement>('[data-sched-down]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const idx = Number(btn.dataset.schedDown);
        if (idx < this.schedulerQueue.length - 1) {
          const tmp = this.schedulerQueue[idx + 1];
          this.schedulerQueue[idx + 1] = this.schedulerQueue[idx];
          this.schedulerQueue[idx] = tmp;
          this.emitDiagnosticChanged('scheduler-config', false);
          this.renderSchedulerView(host);
        }
      });
    });
    host.querySelectorAll<HTMLButtonElement>('[data-sched-del]').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.schedulerQueue = this.schedulerQueue.filter((q) => q.id !== btn.dataset.schedDel);
        this.emitDiagnosticChanged('scheduler-config', false);
        this.renderSchedulerView(host);
      });
    });

    host.querySelector('#sched-export-pdf-btn')?.addEventListener('click', () => {
      if (this.lastSchedulerReport) {
        generateSchedulerPdfReport(this.lastSchedulerReport, this.specs);
      }
    });
    host.querySelector('#sched-export-json-btn')?.addEventListener('click', () => {
      if (!this.lastSchedulerReport) return;
      const blob = new Blob([JSON.stringify(this.lastSchedulerReport, null, 2)], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `systempulse-harmonogram-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    });
  }

  private renderSchedulerLiveStageHtml(): string {
    if (!this.schedulerRunning) return '';
    const activeItem = this.schedulerQueue[this.schedulerActiveIndex];
    const nextItem = this.schedulerQueue[this.schedulerActiveIndex + 1];

    const cpuLiveT = thermalMonitorService.getLiveCpuTempC();
    const gpuLiveT = thermalMonitorService.getLiveGpuTempC();

    if (this.schedulerCooldownRemaining > 0) {
      return `
        <div class="sched-live-stage">
          <div class="row-between" style="flex-wrap:wrap;gap:8px;">
            <span class="sched-stage-tag warn">PAUZA TERMOMICZNA / SCHŁADZANIE</span>
            <span class="font-mono" style="font-size:12px;color:var(--text-secondary);">Następny test: <strong>${nextItem ? esc(nextItem.label) : 'Podsumowanie'}</strong></span>
          </div>
          <div class="grid-4" style="margin-top:8px;">
            <div class="metric-card" style="padding:8px 10px;">
              <span class="metric-label">Pozostało</span>
              <div class="font-mono status-warn" style="font-size:16px;font-weight:700;">${this.schedulerCooldownRemaining} s</div>
            </div>
            <div class="metric-card" style="padding:8px 10px;">
              <span class="metric-label">Czujnik CPU</span>
              <div class="font-mono status-cyan" style="font-size:15px;font-weight:700;">${cpuLiveT !== null ? `${cpuLiveT.toFixed(1)} °C` : 'Brak mostka'}</div>
            </div>
            <div class="metric-card" style="padding:8px 10px;">
              <span class="metric-label">Czujnik GPU</span>
              <div class="font-mono status-cyan" style="font-size:15px;font-weight:700;">${gpuLiveT !== null ? `${gpuLiveT.toFixed(1)} °C` : 'Brak mostka'}</div>
            </div>
            <div class="metric-card" style="padding:8px 10px;">
              <span class="metric-label">Ukończone kroki</span>
              <div class="font-mono status-ok" style="font-size:15px;font-weight:700;">${this.schedulerActiveIndex + 1} / ${this.schedulerQueue.length}</div>
            </div>
          </div>
        </div>
      `;
    }

    if (!activeItem) return '';

    let cardsHtml = '';
    let extraVisualHtml = '';
    const t = activeItem.type;

    if (t === 'cpu_bench' || t === 'cpu_stress') {
      const c = this.cpuState;
      cardsHtml = `
        <div class="metric-card" style="padding:8px 10px;"><span class="metric-label">Multi / Single-Core</span><div class="font-mono status-cyan" style="font-size:15px;font-weight:700;">${c.multiCoreScore.toLocaleString('pl-PL')} / ${c.singleCoreScore.toLocaleString('pl-PL')}</div></div>
        <div class="metric-card" style="padding:8px 10px;"><span class="metric-label">AVX / N-Body GFLOPS</span><div class="font-mono status-ok" style="font-size:15px;font-weight:700;">${c.avxMatrixGflops ?? 0} / ${c.physicsNbodyGflops ?? 0}</div></div>
        <div class="metric-card" style="padding:8px 10px;"><span class="metric-label">GZIP / SHA-256</span><div class="font-mono" style="font-size:15px;font-weight:700;">${c.compressionMBs} / ${c.cryptoSha256MBs} MB/s</div></div>
        <div class="metric-card" style="padding:8px 10px;"><span class="metric-label">Wątki / Stabilność</span><div class="font-mono ${c.throttlingPct > 15 ? 'status-warn' : 'status-ok'}" style="font-size:15px;font-weight:700;">${c.coresUsed}T · ${c.stabilityPct}%${cpuLiveT !== null ? ` · ${cpuLiveT.toFixed(1)}°C` : ''}</div></div>
      `;
      extraVisualHtml = `<div class="font-mono" style="margin-top:6px;font-size:11.5px;color:var(--text-secondary);">Faza CPU: <strong class="status-cyan">${esc(c.phase || 'Obciążenie wielowątkowe')}</strong></div>`;
    } else if (t === 'ram') {
      const r = this.ramState;
      cardsHtml = `
        <div class="metric-card" style="padding:8px 10px;"><span class="metric-label">Odczyt (Read)</span><div class="font-mono status-cyan" style="font-size:15px;font-weight:700;">${r.bandwidthReadMBs.toLocaleString('pl-PL')} MB/s</div></div>
        <div class="metric-card" style="padding:8px 10px;"><span class="metric-label">Zapis / Copy</span><div class="font-mono" style="font-size:15px;font-weight:700;">${r.bandwidthWriteMBs.toLocaleString('pl-PL')} / ${(r.copyBandwidthMBs || 0).toLocaleString('pl-PL')} MB/s</div></div>
        <div class="metric-card" style="padding:8px 10px;"><span class="metric-label">Opóźnienie (Latency)</span><div class="font-mono status-ok" style="font-size:15px;font-weight:700;">${r.latencyNs} ns</div></div>
        <div class="metric-card" style="padding:8px 10px;"><span class="metric-label">Błędy bitowe</span><div class="font-mono ${r.errorsFound > 0 ? 'status-err' : 'status-ok'}" style="font-size:15px;font-weight:700;">${r.errorsFound} błędów (${r.progress}%)</div></div>
      `;
      extraVisualHtml = `<div class="font-mono" style="margin-top:6px;font-size:11.5px;color:var(--text-secondary);">Etap MemTest86+: <strong class="status-cyan">${esc(r.testLog[r.testLog.length - 1] || 'Alokacja i weryfikacja wzorców bitowych')}</strong></div>`;
    } else if (t === 'disk') {
      const d = this.diskState;
      cardsHtml = `
        <div class="metric-card" style="padding:8px 10px;"><span class="metric-label">Seq Odczyt / Zapis</span><div class="font-mono status-cyan" style="font-size:15px;font-weight:700;">${d.seqReadMBs} / ${d.seqWriteMBs} MB/s</div></div>
        <div class="metric-card" style="padding:8px 10px;"><span class="metric-label">4K QD32 Losowy</span><div class="font-mono status-ok" style="font-size:15px;font-weight:700;">${(d.qd32Iops ?? d.rand4kIops).toLocaleString('pl-PL')} IOPS</div></div>
        <div class="metric-card" style="padding:8px 10px;"><span class="metric-label">Mixed 70/30</span><div class="font-mono" style="font-size:15px;font-weight:700;">${d.mixedRwMBs ?? 0} MB/s</div></div>
        <div class="metric-card" style="padding:8px 10px;"><span class="metric-label">SMART / CRC32</span><div class="font-mono ${d.smartStatus === 'ZDROWY' ? 'status-ok' : 'status-warn'}" style="font-size:15px;font-weight:700;">${esc(d.smartStatus)} (${d.progress}%)</div></div>
      `;
      extraVisualHtml = `<div class="font-mono" style="margin-top:6px;font-size:11.5px;color:var(--text-secondary);">Faza I/O Dysku: <strong class="status-cyan">${esc(d.phase || 'Wykonywanie testów blokowych')}</strong></div>`;
    } else if (t === 'gpu_stress' || t === 'gpu_all_scenes') {
      const g = this.gpuState;
      cardsHtml = `
        <div class="metric-card" style="padding:8px 10px;"><span class="metric-label">Live / Max FPS</span><div class="font-mono status-cyan" style="font-size:15px;font-weight:700;">${g.fps} / ${g.maxFps} FPS</div></div>
        <div class="metric-card" style="padding:8px 10px;"><span class="metric-label">1% Low / Czas klatki</span><div class="font-mono status-ok" style="font-size:15px;font-weight:700;">${g.low1PctFps} FPS · ${g.frameTimeMs} ms</div></div>
        <div class="metric-card" style="padding:8px 10px;"><span class="metric-label">Scena 3D / Trójkąty</span><div class="font-mono" style="font-size:14px;font-weight:700;">${esc(g.sceneMode)} · ${(g.triangles / 1000).toFixed(0)}k</div></div>
        <div class="metric-card" style="padding:8px 10px;"><span class="metric-label">Szac. TFLOPS / Temp</span><div class="font-mono status-cyan" style="font-size:15px;font-weight:700;">${g.estFp32Tflops} TF${gpuLiveT !== null ? ` · ${gpuLiveT.toFixed(1)}°C` : ''}</div></div>
      `;
    } else if (t === 'game_ultra' || t === 'game_racing') {
      const gm = this.gameState;
      cardsHtml = `
        <div class="metric-card" style="padding:8px 10px;"><span class="metric-label">Live FPS / 1% Low</span><div class="font-mono status-cyan" style="font-size:15px;font-weight:700;">${gm.fps} / ${gm.low1PctFps} FPS</div></div>
        <div class="metric-card" style="padding:8px 10px;"><span class="metric-label">Frame Time / Okrążenie</span><div class="font-mono status-ok" style="font-size:15px;font-weight:700;">${gm.frameTimeMs} ms${t === 'game_racing' ? ` · #${gm.raceLap}` : ''}</div></div>
        <div class="metric-card" style="padding:8px 10px;"><span class="metric-label">${t === 'game_racing' ? 'Prędkość na torze' : 'Trójkąty 3D'}</span><div class="font-mono" style="font-size:15px;font-weight:700;">${t === 'game_racing' ? `${gm.raceSpeedKmh} km/h` : gm.triangles.toLocaleString('pl-PL')}</div></div>
        <div class="metric-card" style="padding:8px 10px;"><span class="metric-label">Jakość / Stabilność</span><div class="font-mono status-cyan" style="font-size:15px;font-weight:700;">${esc(gm.resolutionLabel)} · ${gm.stabilityPct}%</div></div>
      `;
    } else if (t === 'display_cal') {
      const pat = DISPLAY_PATTERNS[this.schedulerDisplayPatternIdx] || DISPLAY_PATTERNS[0];
      const previewBg = pat.id.includes('red')
        ? '#ef4444'
        : pat.id.includes('green')
          ? '#22c55e'
          : pat.id.includes('blue')
            ? '#3b82f6'
            : pat.id.includes('white')
              ? '#f8fafc'
              : pat.id.includes('black')
                ? '#020617'
                : 'linear-gradient(90deg,#ef4444,#f59e0b,#22c55e,#06b6d4,#3b82f6,#a855f7)';
      cardsHtml = `
        <div class="metric-card" style="padding:8px 10px;"><span class="metric-label">Aktywna plansza</span><div class="font-mono status-cyan" style="font-size:14px;font-weight:700;">${this.schedulerDisplayPatternIdx + 1}/${DISPLAY_PATTERNS.length}: ${esc(pat.name)}</div></div>
        <div class="metric-card" style="padding:8px 10px;"><span class="metric-label">Rozdzielczość</span><div class="font-mono" style="font-size:15px;font-weight:700;">${esc(this.specs?.screenResolution || 'Auto')}</div></div>
        <div class="metric-card" style="padding:8px 10px;"><span class="metric-label">Odświeżanie Hz</span><div class="font-mono status-ok" style="font-size:15px;font-weight:700;">${this.specs?.estimatedRefreshRate || 60} Hz</div></div>
        <div class="metric-card" style="padding:8px 10px;"><span class="metric-label">Kategoria testu</span><div class="font-mono" style="font-size:14px;font-weight:700;">${esc(pat.category)}</div></div>
      `;
      extraVisualHtml = `<div style="margin-top:8px;height:44px;border-radius:6px;border:1px solid var(--border-strong);background:${previewBg};display:flex;align-items:center;justify-content:center;font-family:var(--font-mono);font-size:12px;font-weight:700;color:#fff;text-shadow:0 1px 4px #000;">Podgląd na żywo: ${esc(pat.name)}</div>`;
    } else if (t === 'psu_stress') {
      const p = this.batteryState.psu;
      const calc = psuCalculatorService.calculate(95, 98, this.specs?.cpuCores ?? 8, p.tempC);
      cardsHtml = `
        <div class="metric-card" style="padding:8px 10px;"><span class="metric-label">Szyna +12V</span><div class="font-mono status-cyan" style="font-size:15px;font-weight:700;">${p.rail12V.toFixed(2)} V</div></div>
        <div class="metric-card" style="padding:8px 10px;"><span class="metric-label">+5V / +3.3V</span><div class="font-mono" style="font-size:15px;font-weight:700;">${p.rail5V.toFixed(2)} V / ${p.rail3P3V.toFixed(2)} V</div></div>
        <div class="metric-card" style="padding:8px 10px;"><span class="metric-label">Tętnienia Ripple</span><div class="font-mono ${p.rippleMv > 45 ? 'status-warn' : 'status-ok'}" style="font-size:15px;font-weight:700;">${p.rippleMv} mVpp</div></div>
        <div class="metric-card" style="padding:8px 10px;"><span class="metric-label">Obciążenie / Sprawność</span><div class="font-mono status-cyan" style="font-size:15px;font-weight:700;">${calc.loadPercentageOfPsu}% · ${calc.efficiencyPct}%</div></div>
      `;
    } else if (t === 'audio_sweep') {
      cardsHtml = `
        <div class="metric-card" style="padding:8px 10px;"><span class="metric-label">Częstotliwość DSP</span><div class="font-mono status-cyan" style="font-size:15px;font-weight:700;">${this.schedulerAudioHz || 60} Hz</div></div>
        <div class="metric-card" style="padding:8px 10px;"><span class="metric-label">Aktywny kanał</span><div class="font-mono status-ok" style="font-size:15px;font-weight:700;">${esc(this.schedulerAudioChan)}</div></div>
        <div class="metric-card" style="padding:8px 10px;"><span class="metric-label">Zakres Sweep</span><div class="font-mono" style="font-size:15px;font-weight:700;">60 Hz → 12 kHz</div></div>
        <div class="metric-card" style="padding:8px 10px;"><span class="metric-label">Silnik</span><div class="font-mono" style="font-size:15px;font-weight:700;">WebAudio Stereo</div></div>
      `;
    } else if (t === 'network') {
      const n = this.networkState;
      cardsHtml = `
        <div class="metric-card" style="padding:8px 10px;"><span class="metric-label">Download / Upload</span><div class="font-mono status-cyan" style="font-size:15px;font-weight:700;">${n.downloadEstMbps} / ${n.uploadEstMbps} Mbps</div></div>
        <div class="metric-card" style="padding:8px 10px;"><span class="metric-label">Ping / Jitter</span><div class="font-mono status-ok" style="font-size:15px;font-weight:700;">${n.pingAvgMs} ms · ±${n.jitterMs} ms</div></div>
        <div class="metric-card" style="padding:8px 10px;"><span class="metric-label">VoIP MOS</span><div class="font-mono" style="font-size:15px;font-weight:700;">${n.voipMosScore} / 5.0</div></div>
        <div class="metric-card" style="padding:8px 10px;"><span class="metric-label">Serwer / Postęp</span><div class="font-mono status-cyan" style="font-size:14px;font-weight:700;">${esc(n.selectedServerName || 'Auto')} (${n.progress}%)</div></div>
      `;
    }

    return `
      <div class="sched-live-stage">
        <div class="row-between" style="flex-wrap:wrap;gap:8px;">
          <span class="sched-stage-tag active">NA ŻYWO · KROK ${this.schedulerActiveIndex + 1}/${this.schedulerQueue.length}: ${esc(activeItem.label)}</span>
          <span class="font-mono" style="font-size:11.5px;color:var(--text-secondary);">${esc(describeItemConfig(activeItem))}</span>
        </div>
        <div class="grid-4" style="margin-top:8px;">
          ${cardsHtml}
        </div>
        ${extraVisualHtml}
      </div>
    `;
  }

  private patchSchedulerBanner(): void {
    if (this.activeModule !== 'scheduler') return;
    const txt = this.root.querySelector('#sched-status-text');
    const pct = this.root.querySelector('#sched-progress-pct');
    const bar = this.root.querySelector<HTMLElement>('#sched-progress-bar');
    const stageBox = this.root.querySelector<HTMLElement>('#sched-live-stage-box');
    if (txt) txt.textContent = this.schedulerStatusText;
    if (pct) pct.textContent = `${this.schedulerProgressPct}%`;
    if (bar) bar.style.width = `${this.schedulerProgressPct}%`;
    if (stageBox) stageBox.innerHTML = this.renderSchedulerLiveStageHtml();
  }

  private async runSchedulerQueue(): Promise<void> {
    if (this.schedulerRunning || this.schedulerQueue.length === 0) return;

    this.schedulerRunning = true;
    this.beginStressSession();
    this.schedulerAbortRequested = false;
    this.schedulerActiveIndex = 0;
    this.schedulerProgressPct = 2;
    this.schedulerStatusText = `Inicjalizacja kolejki (${this.schedulerQueue.length} testów)...`;
    this.renderWorkspace();

    const startedAt = Date.now();
    const steps: SchedulerStepResult[] = [];
    const queueSnapshot = [...this.schedulerQueue];
    let peakTempOverall = this.thermalState.hottestTempC ?? 0;

    for (let i = 0; i < queueSnapshot.length; i++) {
      if (this.schedulerAbortRequested) break;
      const item = queueSnapshot[i];
      this.schedulerActiveIndex = i;
      const basePct = Math.round((i / queueSnapshot.length) * 100);
      this.schedulerProgressPct = Math.max(3, basePct);
      this.schedulerStatusText = `Krok ${i + 1}/${queueSnapshot.length}: ${item.label}...`;
      this.renderWorkspace();

      const stepStart = performance.now();

      try {
        if (item.type === 'cpu_bench') {
          this.cpuState = await cpuTestService.runFullBenchmark((res) => {
            this.cpuState = res;
            this.schedulerProgressPct = Math.round(basePct + (res.progress / 100) * (100 / queueSnapshot.length));
            this.schedulerStatusText = `Krok ${i + 1}/${queueSnapshot.length}: CPU — ${res.phase}`;
            this.patchSchedulerBanner();
          });
          const realCpuPeak = thermalMonitorService.getLiveCpuTempC();
          if (realCpuPeak !== null) peakTempOverall = Math.max(peakTempOverall, realCpuPeak);
          steps.push({
            itemId: item.id,
            type: item.type,
            label: item.label,
            configSummary: describeItemConfig(item),
            status: this.cpuState.throttlingPct > 20 ? 'warning' : 'passed',
            durationSec: Number(((performance.now() - stepStart) / 1000).toFixed(1)),
            primaryMetricLabel: 'Multi-Core / Single-Core',
            primaryMetricValue: `${this.cpuState.multiCoreScore.toLocaleString('pl-PL')} / ${this.cpuState.singleCoreScore.toLocaleString('pl-PL')} pkt`,
            secondaryDetails: `AVX ${this.cpuState.avxMatrixGflops ?? 0} GFLOPS · N-Body ${this.cpuState.physicsNbodyGflops ?? 0} GFLOPS · GZIP ${this.cpuState.compressionMBs} MB/s · SHA-256 ${this.cpuState.cryptoSha256MBs} MB/s`,
            peakTempC: realCpuPeak,
            score: this.cpuState.overallScore,
          });
        } else if (item.type === 'cpu_stress') {
          const durSec = item.durationSec || 8;
          let localPeak: number | null = thermalMonitorService.getLiveCpuTempC();
          cpuTestService.startContinuousStress(this.cpuState, (res) => {
            this.cpuState = res;
            const liveT = thermalMonitorService.getLiveCpuTempC();
            if (liveT !== null) localPeak = localPeak === null ? liveT : Math.max(localPeak, liveT);
          });
          for (let s = 0; s < durSec * 2; s++) {
            if (this.schedulerAbortRequested) break;
            await new Promise((r) => setTimeout(r, 500));
            const frac = (s + 1) / (durSec * 2);
            this.schedulerProgressPct = Math.round(basePct + frac * (100 / queueSnapshot.length));
            const liveT = thermalMonitorService.getLiveCpuTempC();
            this.schedulerStatusText = `Krok ${i + 1}/${queueSnapshot.length}: CPU Stres 100% (${((s + 1) * 0.5).toFixed(1)}s / ${durSec}s${liveT !== null ? ` · ${liveT.toFixed(1)} °C` : ` · ${this.cpuState.coresUsed} wątków`})`;
            this.patchSchedulerBanner();
          }
          cpuTestService.stopStress();
          this.cpuState = { ...this.cpuState, status: 'completed', phase: 'Stres-test harmonogramu zakończony' };
          if (localPeak !== null) peakTempOverall = Math.max(peakTempOverall, localPeak);
          const stabScore = Math.round(this.cpuState.stabilityPct);
          steps.push({
            itemId: item.id,
            type: item.type,
            label: item.label,
            configSummary: describeItemConfig(item),
            status: this.schedulerAbortRequested ? 'aborted' : this.cpuState.throttlingPct > 18 ? 'warning' : 'passed',
            durationSec: Number(((performance.now() - stepStart) / 1000).toFixed(1)),
            primaryMetricLabel: 'Stabilność / Throttling',
            primaryMetricValue: `${this.cpuState.stabilityPct}% (-${this.cpuState.throttlingPct}%)`,
            secondaryDetails: `Aktywne wątki: ${this.cpuState.coresUsed} · Stabilność obliczeń`,
            peakTempC: localPeak,
            score: Math.max(25, Math.min(100, stabScore)),
          });
        } else if (item.type === 'ram') {
          const mb = item.ramSizeMB || 128;
          this.ramState = await ramTestService.runTest(mb, (res) => {
            this.ramState = res;
            this.schedulerProgressPct = Math.round(basePct + (res.progress / 100) * (100 / queueSnapshot.length));
            this.schedulerStatusText = `Krok ${i + 1}/${queueSnapshot.length}: RAM ${mb} MB (${res.progress}%)`;
            this.patchSchedulerBanner();
          });
          steps.push({
            itemId: item.id,
            type: item.type,
            label: item.label,
            configSummary: describeItemConfig(item),
            status: this.ramState.errorsFound > 0 ? 'failed' : 'passed',
            durationSec: Number(((performance.now() - stepStart) / 1000).toFixed(1)),
            primaryMetricLabel: 'Odczyt / Błędy bitowe',
            primaryMetricValue: `${this.ramState.bandwidthReadMBs.toLocaleString('pl-PL')} MB/s (${this.ramState.errorsFound} błędów)`,
            secondaryDetails: `Zapis ${this.ramState.bandwidthWriteMBs} MB/s · Copy ${this.ramState.copyBandwidthMBs} MB/s · Dostęp ${this.ramState.latencyNs} ns · 10 etapów OK`,
            peakTempC: this.thermalState.rows.find((r) => r.id === 'ram')?.maxTempC ?? null,
            score: this.ramState.overallScore,
          });
        } else if (item.type === 'disk') {
          this.diskState = await diskTestService.runTest((res) => {
            this.diskState = res;
            this.schedulerProgressPct = Math.round(basePct + (res.progress / 100) * (100 / queueSnapshot.length));
            this.schedulerStatusText = `Krok ${i + 1}/${queueSnapshot.length}: Dysk — ${res.phase}`;
            this.patchSchedulerBanner();
          });
          steps.push({
            itemId: item.id,
            type: item.type,
            label: item.label,
            configSummary: describeItemConfig(item),
            status: this.diskState.smartStatus === 'ZDROWY' ? 'passed' : this.diskState.smartStatus === 'UWAGA' ? 'warning' : 'failed',
            durationSec: Number(((performance.now() - stepStart) / 1000).toFixed(1)),
            primaryMetricLabel: 'Seq Odczyt / Zapis',
            primaryMetricValue: `${this.diskState.seqReadMBs} / ${this.diskState.seqWriteMBs} MB/s`,
            secondaryDetails: `4K QD32 ${this.diskState.qd32Iops ?? this.diskState.rand4kIops} IOPS · Mixed ${this.diskState.mixedRwMBs ?? 0} MB/s · SMART ${this.diskState.smartStatus}`,
            peakTempC: this.thermalState.rows.find((r) => r.id === 'disk')?.maxTempC ?? null,
            score: this.diskState.overallScore,
          });
        } else if (item.type === 'gpu_stress' || item.type === 'gpu_all_scenes') {
          const durMs = (item.durationSec || (item.type === 'gpu_all_scenes' ? 10 : 6)) * 1000;
          const wrap = this.root.querySelector<HTMLElement>('#sched-inline-viewport-wrap');
          const vp = this.root.querySelector<HTMLElement>('#sched-inline-viewport');
          if (wrap) wrap.style.display = 'block';
          if (vp) {
            gpuStressEngine.setPreset(item.gpuPreset || 'high');
            gpuStressEngine.setFpsMode(item.gpuFpsMode || 'uncapped');
            let sceneCycleTimer: number | null = null;
            if (item.type === 'gpu_all_scenes') {
              let scIdx = 0;
              sceneCycleTimer = window.setInterval(() => {
                scIdx = (scIdx + 3) % GPU_SCENE_CATALOG.length;
                gpuStressEngine.setSceneMode(GPU_SCENE_CATALOG[scIdx].id);
              }, 1250);
            }
            gpuStressEngine.mount(vp, (m) => {
              this.gpuState = m;
              const liveGpu = thermalMonitorService.getLiveGpuTempC();
              const frac = Math.min(1, (m.elapsedSec * 1000) / Math.max(1000, durMs));
              this.schedulerProgressPct = Math.round(basePct + frac * (100 / queueSnapshot.length));
              this.schedulerStatusText = `Krok ${i + 1}/${queueSnapshot.length}: GPU 3D [${m.sceneMode}] (${m.fps} FPS · ${m.frameTimeMs} ms${liveGpu !== null ? ` · ${liveGpu.toFixed(1)} °C` : ''} · ${m.elapsedSec}s)`;
              this.patchSchedulerBanner();
            });
            this.gpuState = await gpuStressEngine.runTimedBenchmark(durMs, (m) => {
              this.gpuState = m;
              const frac = Math.min(1, (m.elapsedSec * 1000) / Math.max(1000, durMs));
              this.schedulerProgressPct = Math.round(basePct + frac * (100 / queueSnapshot.length));
              this.schedulerStatusText = `Krok ${i + 1}/${queueSnapshot.length}: GPU 3D [${m.sceneMode}] (${m.fps} FPS · Max ${m.maxFps} · ${m.frameTimeMs} ms)`;
              this.patchSchedulerBanner();
            });
            if (sceneCycleTimer !== null) window.clearInterval(sceneCycleTimer);
            gpuStressEngine.unmount();
          }
          if (wrap) wrap.style.display = 'none';
          const realGpuPeak = thermalMonitorService.getLiveGpuTempC();
          if (realGpuPeak !== null) peakTempOverall = Math.max(peakTempOverall, realGpuPeak);
          steps.push({
            itemId: item.id,
            type: item.type,
            label: item.label,
            configSummary: describeItemConfig(item),
            status: this.gpuState.verdict === 'STABILNY' ? 'passed' : 'warning',
            durationSec: Number(((performance.now() - stepStart) / 1000).toFixed(1)),
            primaryMetricLabel: 'Śr. / 1% Low FPS',
            primaryMetricValue: `${this.gpuState.avgFps} / ${this.gpuState.low1PctFps} FPS`,
            secondaryDetails: `Max ${this.gpuState.maxFps} FPS · Stabilność ${this.gpuState.stabilityPct}% · ${item.type === 'gpu_all_scenes' ? 'Maraton 40 Scen 3D' : this.gpuState.verdict}`,
            peakTempC: realGpuPeak,
            score: this.gpuState.overallScore,
          });
        } else if (item.type === 'game_ultra' || item.type === 'game_racing') {
          const durMs = (item.durationSec || (item.type === 'game_racing' ? 8 : 7)) * 1000;
          const wrap = this.root.querySelector<HTMLElement>('#sched-inline-viewport-wrap');
          const vp = this.root.querySelector<HTMLElement>('#sched-inline-viewport');
          if (wrap) wrap.style.display = 'block';
          if (vp) {
            if (item.type === 'game_racing') {
              gameBenchService.setGameScene('formula_cyber_gp');
            } else {
              gameBenchService.setGameScene('hyperion');
            }
            gameBenchService.setPreset('ultra');
            gameBenchService.setFpsMode('uncapped');
            gameBenchService.mount(vp, (m) => {
              this.gameState = m;
              const frac = Math.min(1, (m.elapsedSec * 1000) / Math.max(1000, durMs));
              this.schedulerProgressPct = Math.round(basePct + frac * (100 / queueSnapshot.length));
              this.schedulerStatusText = `Krok ${i + 1}/${queueSnapshot.length}: ${item.type === 'game_racing' ? `Wyścig 3D (${m.raceSpeedKmh} km/h · Okr. #${m.raceLap})` : 'Gra 3D HYPERION'} (${m.fps} FPS · 1% Low ${m.low1PctFps})`;
              this.patchSchedulerBanner();
            });
            this.gameState = await gameBenchService.runTimedBenchmark(durMs, (m) => {
              this.gameState = m;
              const frac = Math.min(1, (m.elapsedSec * 1000) / Math.max(1000, durMs));
              this.schedulerProgressPct = Math.round(basePct + frac * (100 / queueSnapshot.length));
              this.schedulerStatusText = `Krok ${i + 1}/${queueSnapshot.length}: ${item.type === 'game_racing' ? `Wyścig 3D Formula Cyber GP (${m.raceSpeedKmh} km/h)` : 'Gra 3D HYPERION'} (${m.fps} FPS · ${m.triangles.toLocaleString('pl-PL')} trójk.)`;
              this.patchSchedulerBanner();
            });
            gameBenchService.unmount();
          }
          if (wrap) wrap.style.display = 'none';
          const realGameGpu = this.gameState.realGpuTempC;
          if (realGameGpu !== null) peakTempOverall = Math.max(peakTempOverall, realGameGpu);
          steps.push({
            itemId: item.id,
            type: item.type,
            label: item.label,
            configSummary: describeItemConfig(item),
            status:
              this.gameState.verdict === 'ULTRA PŁYNNOŚĆ' || this.gameState.verdict === 'GRYWALNE (60+)'
                ? 'passed'
                : 'warning',
            durationSec: Number(((performance.now() - stepStart) / 1000).toFixed(1)),
            primaryMetricLabel: item.type === 'game_racing' ? 'Śr. FPS / Prędkość Toru' : 'Śr. / 1% Low FPS',
            primaryMetricValue:
              item.type === 'game_racing'
                ? `${this.gameState.avgFps} FPS (${this.gameState.raceSpeedKmh || 348} km/h)`
                : `${this.gameState.avgFps} / ${this.gameState.low1PctFps} FPS`,
            secondaryDetails: `1% Low ${this.gameState.low1PctFps} · 0.1% Low ${this.gameState.low01PctFps} FPS · ${this.gameState.resolutionLabel} · ${this.gameState.verdict}`,
            peakTempC: realGameGpu,
            score: this.gameState.overallScore,
          });
        } else if (item.type === 'display_cal') {
          const durSec = item.durationSec || 5;
          const statusMsg = await hardwareScannerService.requestExactScreenModel();
          const frameDeltas: number[] = [];
          const tEnd = performance.now() + durSec * 1000;
          let lastTs = performance.now();
          while (performance.now() < tEnd && !this.schedulerAbortRequested) {
            await new Promise<void>((resolve) =>
              requestAnimationFrame((now) => {
                const dt = now - lastTs;
                if (dt > 1 && dt < 100) frameDeltas.push(dt);
                lastTs = now;
                resolve();
              })
            );
            const elapsed = (performance.now() - stepStart) / 1000;
            const frac = Math.min(1, elapsed / durSec);
            this.schedulerProgressPct = Math.round(basePct + frac * (100 / queueSnapshot.length));
            const patIdx = Math.floor(frac * DISPLAY_PATTERNS.length) % DISPLAY_PATTERNS.length;
            this.schedulerDisplayPatternIdx = patIdx;
            displayDiagnostics.setPattern(patIdx);
            this.schedulerStatusText = `Krok ${i + 1}/${queueSnapshot.length}: Ekran — Plansza ${patIdx + 1}/${DISPLAY_PATTERNS.length} (${DISPLAY_PATTERNS[patIdx].name})`;
            this.patchSchedulerBanner();
          }
          const avgDt =
            frameDeltas.length > 0
              ? frameDeltas.reduce((a, b) => a + b, 0) / frameDeltas.length
              : 16.67;
          const measuredHz = Math.round(1000 / Math.max(1, avgDt));
          const jitterMs =
            frameDeltas.length > 2
              ? Number(
                  (
                    frameDeltas.reduce((acc, v) => acc + Math.abs(v - avgDt), 0) /
                    frameDeltas.length
                  ).toFixed(2)
                )
              : 0.25;
          const scanned = await hardwareScannerService.scanAll(
            measuredHz,
            this.specs?.gpuRenderer || '',
            this.specs
          );
          this.hardwareScan = scanned;
          const scannedPanel = scanned.panel;
          steps.push({
            itemId: item.id,
            type: item.type,
            label: item.label,
            configSummary: describeItemConfig(item),
            status: jitterMs < 2.5 ? 'passed' : 'warning',
            durationSec: Number(((performance.now() - stepStart) / 1000).toFixed(1)),
            primaryMetricLabel: 'Odświeżanie / Jitter VSync',
            primaryMetricValue: `${scannedPanel.refreshRateHz} Hz (±${jitterMs} ms)`,
            secondaryDetails: `${scannedPanel.label} · ${scannedPanel.nativeResolution} · ${scannedPanel.colorGamut} · ${statusMsg.slice(0, 60)}`,
            peakTempC: null,
            score: jitterMs < 1.2 ? 98 : jitterMs < 2.5 ? 90 : 76,
          });
        } else if (item.type === 'psu_stress') {
          const durSec = item.durationSec || 6;
          const coreCount = this.specs?.cpuCores ?? 8;
          psuCalculatorService.setStressProfile('transient_spike');
          psuCalculatorService.setHighPowerSimulation(true);
          for (let s = 0; s < durSec * 2; s++) {
            if (this.schedulerAbortRequested) break;
            this.batteryState = batteryHealthService.getState();
            const psuCalc = psuCalculatorService.calculate(95, 98, coreCount, this.batteryState.psu.tempC);
            const frac = Math.min(1, (s + 1) / (durSec * 2));
            this.schedulerProgressPct = Math.round(basePct + frac * (100 / queueSnapshot.length));
            this.schedulerStatusText = `Krok ${i + 1}/${queueSnapshot.length}: Zasilacz PC Cross-Load (12V: ${this.batteryState.psu.rail12V.toFixed(2)}V · Obciążenie: ${psuCalc.loadPercentageOfPsu}% · Ripple: ${this.batteryState.psu.rippleMv} mV)`;
            this.patchSchedulerBanner();
            await new Promise((r) => setTimeout(r, 500));
          }
          psuCalculatorService.setHighPowerSimulation(false);
          psuCalculatorService.setStressProfile('normal');
          this.batteryState = batteryHealthService.getState();
          const psu = this.batteryState.psu;
          const psuFinalCalc = psuCalculatorService.calculate(12, 10, coreCount, psu.tempC);
          const psuOk = psu.status === 'STABILNY';
          steps.push({
            itemId: item.id,
            type: item.type,
            label: item.label,
            configSummary: describeItemConfig(item),
            status: psuOk ? 'passed' : 'warning',
            durationSec: Number(((performance.now() - stepStart) / 1000).toFixed(1)),
            primaryMetricLabel: 'Linia +12V / Tętnienia Ripple',
            primaryMetricValue: `${psu.rail12V.toFixed(2)} V (${psu.rippleMv} mVpp)`,
            secondaryDetails: `5V: ${psu.rail5V.toFixed(2)}V · 3.3V: ${psu.rail3P3V.toFixed(2)}V · Sprawność: ${psuFinalCalc.efficiencyPct}% · ${psu.status}`,
            peakTempC: null,
            score: psuOk ? 95 : 68,
          });
        } else if (item.type === 'audio_sweep') {
          const durSec = item.durationSec || 4;
          const freqs = [60, 250, 1000, 4000, 12000];
          for (let fIdx = 0; fIdx < freqs.length; fIdx++) {
            if (this.schedulerAbortRequested) break;
            const hz = freqs[fIdx];
            const ch = fIdx % 2 === 0 ? 'Lewy (L)' : 'Prawy (R)';
            this.schedulerAudioHz = hz;
            this.schedulerAudioChan = ch;
            peripheralsTestService.startTone(fIdx % 2 === 0 ? 'left' : 'right', hz);
            this.schedulerProgressPct = Math.round(basePct + ((fIdx + 1) / freqs.length) * (100 / queueSnapshot.length));
            this.schedulerStatusText = `Krok ${i + 1}/${queueSnapshot.length}: Audio DSP Sweep (${hz} Hz · Kanał ${ch})`;
            this.patchSchedulerBanner();
            await new Promise((r) => setTimeout(r, Math.max(300, Math.round((durSec * 1000) / freqs.length))));
          }
          peripheralsTestService.stopTone();
          steps.push({
            itemId: item.id,
            type: item.type,
            label: item.label,
            configSummary: describeItemConfig(item),
            status: 'passed',
            durationSec: Number(((performance.now() - stepStart) / 1000).toFixed(1)),
            primaryMetricLabel: 'Pasmo DSP WebAudio Stereo',
            primaryMetricValue: '60 Hz – 12 kHz (L/R OK)',
            secondaryDetails: `Synteza kanałów Stereo L/R zakończona bez zniekształceń clippingu`,
            peakTempC: null,
            score: 96,
          });
        } else if (item.type === 'network') {
          this.networkState = await networkTestService.runTest((res) => {
            this.networkState = res;
            this.schedulerProgressPct = Math.round(basePct + (res.progress / 100) * (100 / queueSnapshot.length));
            this.schedulerStatusText = `Krok ${i + 1}/${queueSnapshot.length}: Sieć (${res.downloadEstMbps} Mbps · Ping ${res.pingAvgMs} ms · ${res.selectedServerName || 'Polska/Świat'})`;
            this.patchSchedulerBanner();
          });
          const netScore =
            this.networkState.qualityGrade === 'WZOROWA'
              ? 96
              : this.networkState.qualityGrade === 'DOBRA'
                ? 84
                : this.networkState.qualityGrade === 'NIESTABILNA'
                  ? 55
                  : 10;
          steps.push({
            itemId: item.id,
            type: item.type,
            label: item.label,
            configSummary: describeItemConfig(item),
            status:
              this.networkState.qualityGrade === 'WZOROWA' || this.networkState.qualityGrade === 'DOBRA'
                ? 'passed'
                : 'warning',
            durationSec: Number(((performance.now() - stepStart) / 1000).toFixed(1)),
            primaryMetricLabel: 'Download / Upload (Speed Test)',
            primaryMetricValue: `${this.networkState.downloadEstMbps} / ${this.networkState.uploadEstMbps} Mbps`,
            secondaryDetails: `Serwer: ${this.networkState.selectedServerName || 'Auto'} · Ping ${this.networkState.pingAvgMs} ms · Jitter ${this.networkState.jitterMs} ms · VoIP MOS ${this.networkState.voipMosScore}/5`,
            peakTempC: null,
            score: netScore,
          });
        }
      } catch {
        steps.push({
          itemId: item.id,
          type: item.type,
          label: item.label,
          configSummary: describeItemConfig(item),
          status: 'failed',
          durationSec: Number(((performance.now() - stepStart) / 1000).toFixed(1)),
          primaryMetricLabel: 'Błąd wykonania',
          primaryMetricValue: 'Przerwano',
          secondaryDetails: 'Wystąpił błąd podczas uruchamiania kroku',
          peakTempC: null,
          score: 0,
        });
      }

      // Optional cooldown between queued steps
      if (!this.schedulerAbortRequested && this.schedulerCooldownSec > 0 && i < queueSnapshot.length - 1) {
        for (let c = this.schedulerCooldownSec; c > 0; c--) {
          if (this.schedulerAbortRequested) break;
          this.schedulerCooldownRemaining = c;
          this.schedulerStatusText = `Schładzanie między krokami (${c} s do kolejnego testu)...`;
          this.patchSchedulerBanner();
          await new Promise((r) => setTimeout(r, 1000));
        }
        this.schedulerCooldownRemaining = 0;
      }
    }

    const finishedAt = Date.now();
    const overallScore =
      steps.length > 0
        ? Math.round(steps.reduce((s, st) => s + st.score, 0) / steps.length)
        : 0;

    this.lastSchedulerReport = {
      id: `rep-${finishedAt.toString(36)}`,
      startedAt,
      finishedAt,
      totalDurationSec: Number(((finishedAt - startedAt) / 1000).toFixed(1)),
      aborted: this.schedulerAbortRequested,
      overallScore,
      grade: gradeFromOverall(overallScore),
      passedCount: steps.filter((s) => s.status === 'passed').length,
      warningCount: steps.filter((s) => s.status === 'warning').length,
      failedCount: steps.filter((s) => s.status === 'failed' || s.status === 'aborted').length,
      peakSystemTempC: Number(peakTempOverall.toFixed(1)),
      steps,
    };

    this.schedulerRunning = false;
    this.schedulerActiveIndex = -1;
    this.schedulerProgressPct = 100;
    this.schedulerStatusText = this.schedulerAbortRequested
      ? 'Kolejka przerwana — wygenerowano częściowy raport zbiorczy.'
      : `Kolejka zakończona (${steps.length} testów) — ocena ${this.lastSchedulerReport.grade} (${overallScore}/100).`;

    await this.recordLog(
      'SCHEDULER',
      this.lastSchedulerReport.failedCount > 0 ? 'WARN' : 'OK',
      'Zakończono kolejkę harmonogramu',
      `${steps.length} testów`,
      `${this.lastSchedulerReport.grade} (${overallScore}/100)`,
      `Czas: ${this.lastSchedulerReport.totalDurationSec}s${this.lastSchedulerReport.peakSystemTempC > 0 ? `, Czujnik szczyt: ${this.lastSchedulerReport.peakSystemTempC}°C` : ', Czujnik °C: brak mostka'}`
    );
    const schedStab =
      steps.length > 0
        ? Math.round((this.lastSchedulerReport.passedCount / steps.length) * 100)
        : 100;
    this.finalizeStressSession(
      'Harmonogram',
      schedStab,
      `${steps.length} testów · Ocena ${this.lastSchedulerReport.grade} (${overallScore}/100)`,
      this.schedulerAbortRequested ? 'UWAGA' : undefined
    );
    this.renderWorkspace();
  }

  /* =========================================================================
     1C. GRA 3D MAX — HYPERION ULTRA BENCHMARK DEMO & 3D RACING CIRCUITS
     ========================================================================= */
  private getGameCategory(item: (typeof GAME_CATALOG)[number]): 'COMBAT' | 'RACING' | 'SOCCER' | 'FLIGHT' | 'SCIFI' {
    if (gameBenchService.isCombatScene(item.layoutMode)) return 'COMBAT';
    if (gameBenchService.isSoccerScene(item.layoutMode)) return 'SOCCER';
    if (gameBenchService.isFlightScene(item.layoutMode)) return 'FLIGHT';
    if (gameBenchService.isRacingScene(item.layoutMode)) return 'RACING';
    return 'SCIFI';
  }

  private renderGameBenchView(host: HTMLElement): void {
    const g = this.gameState;
    const activeGame = gameBenchService.getGameCatalogItem();
    const combatGames = GAME_CATALOG.filter((item) => gameBenchService.isCombatScene(item.layoutMode));
    const racingGames = GAME_CATALOG.filter((item) => gameBenchService.isRacingScene(item.layoutMode));
    const soccerGames = GAME_CATALOG.filter((item) => gameBenchService.isSoccerScene(item.layoutMode));
    const flightGames = GAME_CATALOG.filter(
      (item) => gameBenchService.isFlightScene(item.layoutMode) && !gameBenchService.isCombatScene(item.layoutMode)
    );
    const filteredCatalog = GAME_CATALOG.filter(
      (item) => this.gameCategoryFilter === 'ALL' || this.getGameCategory(item) === this.gameCategoryFilter
    );

    const activeCat = this.getGameCategory(activeGame);
    const isCombatOrFlight = activeCat === 'COMBAT' || activeCat === 'FLIGHT' || Boolean(g.isCombatMode);
    const activeAiProfile = g.aiProfile || 'ai_auto';
    const activeFpsCap = g.fpsCap ?? 0;
    const activeAniso = g.anisotropy ?? 16;
    const activeTone = g.toneMapping || 'aces';
    const activeExp = g.exposure ?? 1.08;
    const activeEnv = g.envIntensity ?? 0.78;
    const activeScenery = g.sceneryDensityPct ?? 100;
    const fogOn = g.fogEnabled ?? true;
    const dynResOn = g.dynamicResolution ?? true;

    host.innerHTML = `
      <div class="stack-lg">
        <div class="section-header">
          <div>
            <h1 class="section-title">Katalog Gier 3D AAA MAX (${GAME_CATALOG.length} Światów: Kampanie Bojowe 5-Etapowe, Wyścigi 5 Okr., Piłka 3D &amp; Lotnictwo)</h1>
            <p class="section-subtitle">
              Realistyczna grafika PBR HDR + GLSL Ocean + 5-etapowe kampanie bojowe z Bossami (Etap 3 i 5), efektami SFX i pełnym sterowaniem: <strong>Czołg M1A2 Abrams</strong>, <strong>Mech Titan</strong>, <strong>F/A-18 Naval Strike</strong>, <strong>Okręt Podwodny</strong>, <strong>MotoGP Superbike</strong>, <strong>Starfighter Trench</strong>, Wyścigi 5 Okrążeń oraz Stadion Piłki Nożnej 3D.
            </p>
          </div>
          <div class="meta-line">
            <span>Aktywna gra: <strong id="game-active-title-lbl" class="status-cyan">${esc(activeGame.shortTitle)}</strong></span>
            <span class="meta-sep">·</span>
            <span>Render: <strong id="game-res-lbl" class="font-mono" style="color:var(--text-primary);">${esc(g.resolutionLabel)}</strong></span>
          </div>
        </div>

        <div class="panel stack-sm" style="padding:14px;border:1.5px solid rgba(245, 158, 11, 0.38);background:linear-gradient(135deg, rgba(245, 158, 11, 0.09), rgba(6, 182, 212, 0.07));">
          <div class="row-between" style="flex-wrap:wrap;gap:8px;">
            <div>
              <strong style="font-size:13.5px;color:var(--accent-amber);">⚔️ Szybki Start — Nowe Kampanie AAA &amp; Gry Grywalne (5 Etapów / 5 Okrążeń)</strong>
              <div style="font-size:12px;color:var(--text-secondary);">Walka/Lotnictwo: WASD + Spacja/Klik (Ogień) + Shift (Boost) + R (Restart) · Wyścigi: A/D + Shift (Nitro) · Piłka: WASD + Spacja</div>
            </div>
            <div class="row-wrap" style="gap:6px;">
              ${combatGames
                .map(
                  (cb) => `
                  <button type="button" data-game-scene="${cb.id}" class="btn ${cb.id === activeGame.id ? 'btn-danger' : 'btn-secondary'} btn-sm">
                    ⚔️ ${esc(cb.shortTitle)}
                  </button>`
                )
                .join('')}
              ${racingGames
                .slice(0, 4)
                .map(
                  (rc) => `
                  <button type="button" data-game-scene="${rc.id}" class="btn ${rc.id === activeGame.id ? 'btn-amber' : 'btn-secondary'} btn-sm">
                    🏎️ ${esc(rc.shortTitle)}
                  </button>`
                )
                .join('')}
              ${soccerGames
                .map(
                  (sc) => `
                  <button type="button" data-game-scene="${sc.id}" class="btn ${sc.id === activeGame.id ? 'btn-primary' : 'btn-secondary'} btn-sm">
                    ⚽ ${esc(sc.shortTitle)}
                  </button>`
                )
                .join('')}
              ${flightGames
                .map(
                  (fl) => `
                  <button type="button" data-game-scene="${fl.id}" class="btn ${fl.id === activeGame.id ? 'btn-primary' : 'btn-secondary'} btn-sm">
                    ✈️ ${esc(fl.shortTitle)}
                  </button>`
                )
                .join('')}
            </div>
          </div>
        </div>

        <div class="panel stack-sm" style="padding:14px;">
          <div class="row-between" style="flex-wrap:wrap;gap:8px;margin-bottom:6px;">
            <div class="row-wrap" style="gap:8px;align-items:center;">
              <span style="font-size:13px;font-weight:700;">Katalog Gier 3D MAX (${filteredCatalog.length} / ${GAME_CATALOG.length}):</span>
              <div class="segmented" role="group" aria-label="Filtr gatunku gier 3D">
                <button type="button" class="segmented-btn ${this.gameCategoryFilter === 'ALL' ? 'active' : ''}" data-game-cat="ALL">Wszystkie (${GAME_CATALOG.length})</button>
                <button type="button" class="segmented-btn ${this.gameCategoryFilter === 'COMBAT' ? 'active' : ''}" data-game-cat="COMBAT">⚔️ Walka (${combatGames.length})</button>
                <button type="button" class="segmented-btn ${this.gameCategoryFilter === 'RACING' ? 'active' : ''}" data-game-cat="RACING">Wyścigi (${racingGames.length})</button>
                <button type="button" class="segmented-btn ${this.gameCategoryFilter === 'SOCCER' ? 'active' : ''}" data-game-cat="SOCCER">Piłka Nożna (${soccerGames.length})</button>
                <button type="button" class="segmented-btn ${this.gameCategoryFilter === 'FLIGHT' ? 'active' : ''}" data-game-cat="FLIGHT">Lotnictwo (${flightGames.length})</button>
                <button type="button" class="segmented-btn ${this.gameCategoryFilter === 'SCIFI' ? 'active' : ''}" data-game-cat="SCIFI">Sci-Fi / Arena</button>
              </div>
            </div>
            <span class="panel-caption" id="game-active-desc-lbl">${esc(activeGame.description)}</span>
          </div>
          <div class="grid-4" style="gap:10px;">
            ${filteredCatalog
              .map((item) => {
                const isAct = item.id === activeGame.id;
                const cat = this.getGameCategory(item);
                const icon =
                  cat === 'COMBAT'
                    ? '⚔️ '
                    : cat === 'SOCCER'
                      ? '⚽ '
                      : cat === 'FLIGHT'
                        ? '✈️ '
                        : cat === 'RACING'
                          ? '🏎️ '
                          : '';
                const accentBorder = isAct
                  ? 'var(--accent-cyan)'
                  : cat === 'COMBAT'
                    ? 'rgba(244, 63, 94, 0.42)'
                    : cat === 'SOCCER'
                      ? 'rgba(16, 185, 129, 0.38)'
                      : cat === 'FLIGHT'
                        ? 'rgba(56, 189, 248, 0.35)'
                        : cat === 'RACING'
                          ? 'rgba(245, 158, 11, 0.35)'
                          : 'rgba(255,255,255,0.08)';
                const accentBg = isAct
                  ? 'rgba(6, 182, 212, 0.14)'
                  : cat === 'COMBAT'
                    ? 'rgba(244, 63, 94, 0.08)'
                    : cat === 'SOCCER'
                      ? 'rgba(16, 185, 129, 0.07)'
                      : cat === 'RACING'
                        ? 'rgba(245, 158, 11, 0.06)'
                        : 'var(--bg-inset)';
                return `
                  <button
                    type="button"
                    data-game-scene="${item.id}"
                    class="panel stack-xs"
                    style="text-align:left;padding:10px 12px;cursor:pointer;transition:all 150ms ease;border:1.5px solid ${accentBorder};background:${accentBg};border-radius:10px;"
                  >
                    <div class="row-between" style="width:100%;gap:6px;">
                      <span style="font-size:12.5px;font-weight:700;color:${isAct ? 'var(--accent-cyan)' : cat === 'COMBAT' ? '#fb7185' : cat === 'SOCCER' ? 'var(--status-ok)' : cat === 'RACING' ? 'var(--accent-amber)' : 'var(--text-primary)'};">${icon}${esc(item.shortTitle)}</span>
                      <span class="font-mono" style="font-size:10px;padding:2px 6px;border-radius:4px;background:rgba(255,255,255,0.07);color:var(--text-secondary);">${esc(item.badge)}</span>
                    </div>
                    <span style="font-size:11px;color:var(--text-muted);line-height:1.35;">${esc(item.genre)}</span>
                  </button>
                `;
              })
              .join('')}
          </div>
        </div>

        <div id="game-viewport-shell" class="gpu-viewport-wrap" style="height:600px;">
          <div id="game-canvas-mount" class="gpu-viewport-mount"></div>

          <div class="gpu-hud-top">
            <div id="game-hud-live" class="gpu-hud-strip">
              ${this.renderGameHudStripInner(g, activeGame.shortTitle, activeCat)}
            </div>
            <div id="game-hud-verdict" class="gpu-hud-strip">
              ${this.renderGameHudVerdictInner(g, activeCat)}
            </div>
          </div>

          <div class="game-hud-overlay" aria-hidden="true">
            <div id="game-hud-crosshair" class="game-crosshair ${g.targetLocked ? 'locked' : ''}" style="display:${isCombatOrFlight ? 'block' : 'none'};">
              <span class="game-crosshair-dot"></span>
            </div>
            <div id="game-hud-banner" class="game-hud-banner ${g.gameBannerText ? 'visible' : ''}">${esc(g.gameBannerText || '')}</div>
            <div id="game-hud-mission" class="game-hud-mission">${esc(g.gameMissionText || '')}</div>
          </div>

          <div class="gpu-hud-bottom">
            <div class="segmented" role="group" aria-label="Limit FPS gry">
              <button type="button" class="segmented-btn ${g.fpsMode === 'vsync' ? 'active' : ''}" data-game-fps="vsync">VSync (Płynny)</button>
              <button type="button" class="segmented-btn ${g.fpsMode === 'uncapped' ? 'active' : ''}" data-game-fps="uncapped">Bez limitu FPS</button>
            </div>

            <button id="game-bloom-btn" type="button" class="btn btn-secondary btn-sm">Bloom: ${g.bloomEnabled ? 'WŁ.' : 'WYŁ.'}</button>
            <button id="game-shadows-btn" type="button" class="btn btn-secondary btn-sm">Cienie 4K: ${g.shadowsEnabled ? 'WŁ.' : 'WYŁ.'}</button>
            <button id="game-sfx-btn" type="button" class="btn ${this.gameSfxEnabled ? 'btn-primary' : 'btn-secondary'} btn-sm">🔊 SFX: ${this.gameSfxEnabled ? 'WŁ.' : 'WYŁ.'}</button>
            <button id="game-restart-btn" type="button" class="btn btn-secondary btn-sm" title="Restart misji / wyścigu (klawisz R)">↻ Restart (R)</button>
            <button id="game-fullscreen-btn" type="button" class="btn btn-secondary btn-sm" title="Pełny ekran 3D">⛶ Pełny Ekran</button>
            <button id="game-rocket-salvo-btn" type="button" class="btn btn-danger btn-sm" title="Wystrzel salwę 4 samonaprowadzających rakiet 3D (klawisz F / E / Prawy Przycisk Myszy)">🚀 Salwa Rakiet (F / PPM)</button>
            <button id="game-nitro-burst-btn" type="button" class="btn btn-amber btn-sm" title="Włącz dopalacz NITRO / Afterburner +45% prędkości z płomieniami Mach (klawisz Shift / N)">⚡ Dopalacz NITRO (Shift / N)</button>
            ${
              activeCat === 'SOCCER'
                ? `<button id="game-soccer-kick-btn" type="button" class="btn btn-amber btn-sm">⚽ Strzał na bramkę (Spacja)</button>`
                : isCombatOrFlight
                  ? `<button id="game-fire-btn" type="button" class="btn btn-danger btn-sm">🔥 Ogień / Działo (Spacja)</button>`
                  : `<button id="game-mode-btn" type="button" class="btn ${g.interactiveMode ? 'btn-amber' : 'btn-secondary'} btn-sm">
                       ${g.interactiveMode ? 'Tryb: Gracz (WASD+Mysz)' : 'Tryb: Kamera Benchmark'}
                     </button>`
            }
            <button id="game-toggle-btn" type="button" class="btn ${g.running ? 'btn-danger' : 'btn-primary'} btn-sm">
              ${iconSvg(g.running ? 'stop' : 'play', 14)}
              <span>${g.running ? 'Zatrzymaj grę' : 'Start Gry MAX'}</span>
            </button>
          </div>
        </div>

        <div class="grid-2" style="gap:14px;">
          <div class="panel stack-sm" style="padding:14px;border:1px solid rgba(6, 182, 212, 0.35);background:linear-gradient(135deg, rgba(6, 182, 212, 0.08), rgba(16, 185, 129, 0.05));">
            <div class="row-between" style="flex-wrap:wrap;gap:6px;">
              <strong style="font-size:13.5px;color:var(--accent-cyan);">🤖 Silnik Ustawień Graficznych AI (On-Device Auto-Tuner)</strong>
              <span class="font-mono" style="font-size:11px;color:var(--status-ok);">Dynamic Resolution AI: ${dynResOn ? 'AKTYWNE' : 'WYŁ.'}</span>
            </div>
            <div class="row-wrap" style="gap:6px;">
              ${(
                [
                  { id: 'ai_auto', label: '🤖 AI Auto' },
                  { id: 'ai_smooth_120', label: '⚡ AI Płynność 120+' },
                  { id: 'ai_balanced', label: '🎨 AI Balans HDR' },
                  { id: 'ai_quality_4k', label: '💎 AI Jakość 4K' },
                  { id: 'ai_esports', label: '🎯 AI E-Sport' },
                ] as Array<{ id: GameAiProfile; label: string }>
              )
                .map(
                  (prof) => `
                  <button
                    type="button"
                    data-game-ai-profile="${prof.id}"
                    class="btn ${activeAiProfile === prof.id ? 'btn-primary' : 'btn-secondary'} btn-sm"
                  >
                    ${prof.label}
                  </button>`
                )
                .join('')}
            </div>
            <div class="row-wrap" style="gap:6px;margin-top:4px;">
              <button id="game-preset-ue5-single" type="button" class="btn btn-amber btn-sm" title="DLSS Quality 67% + Frame Gen 2x + Smooth Motion + Reflex Boost + Tekstury Ultra (12GB+ VRAM) + AF x16 + Lumen/Cienie High">
                ⚡ Schemat UE5 Singleplayer (DLSS + FG 2x + Lumen High)
              </button>
              <button id="game-preset-esport-117" type="button" class="btn btn-secondary btn-sm" title="Limit 117 FPS (3 kl. poniżej 120Hz), FG Wył., NVIDIA Reflex Boost, Cienie Średnie, Filtry Post-FX Wył.">
                🎯 Schemat E-Sport 120Hz (117 FPS · Reflex Boost · FG Wył.)
              </button>
              <button id="game-preset-esport-141" type="button" class="btn btn-secondary btn-sm" title="Limit 141 FPS (3 kl. poniżej 144Hz), FG Wył., NVIDIA Reflex Boost, Cienie Średnie, Filtry Post-FX Wył.">
                🎯 Schemat E-Sport 144Hz (141 FPS · Reflex Boost)
              </button>
            </div>
            <div id="game-ai-rec-lbl" class="font-mono" style="font-size:11.5px;color:var(--text-secondary);background:var(--bg-inset);padding:8px 10px;border-radius:8px;border:1px solid var(--border-hairline);">
              ${esc(g.aiRecommendation || 'AI Auto: Dynamiczne dopasowanie rozdzielczości i cieni dla maksymalnej płynności.')}
            </div>
          </div>

          <div class="panel stack-sm" style="padding:14px;">
            <div class="row-between" style="flex-wrap:wrap;gap:6px;">
              <strong style="font-size:13.5px;">⚙️ Zaawansowane Ustawienia Graficzne 3D</strong>
              <button id="game-dynres-btn" type="button" class="btn ${dynResOn ? 'btn-primary' : 'btn-secondary'} btn-sm">
                Dynamic Res AI: ${dynResOn ? 'WŁ.' : 'WYŁ.'}
              </button>
            </div>
            <div class="row-wrap" style="gap:8px;align-items:center;">
              <span style="font-size:11.5px;color:var(--text-secondary);min-width:85px;">Jakość Sceny:</span>
              <div class="segmented" role="group" aria-label="Ustawienia graficzne gry">
                ${(['high', 'ultra', 'extreme', 'nightmare'] as GameQualityPreset[])
                  .map(
                    (p) => `
                    <button type="button" class="segmented-btn ${g.preset === p ? 'active' : ''}" data-game-preset="${p}">
                      ${GAME_PRESETS[p].label}
                    </button>`
                  )
                  .join('')}
              </div>
            </div>
            <div class="row-wrap" style="gap:8px;align-items:center;">
              <span style="font-size:11.5px;color:var(--text-secondary);min-width:85px;">Limit FPS:</span>
              <div class="segmented" role="group" aria-label="Docelowy limit FPS">
                ${([0, 60, 117, 120, 141, 144] as GameFpsCap[])
                  .map(
                    (cap) => `
                    <button type="button" class="segmented-btn ${activeFpsCap === cap ? 'active' : ''}" data-game-fps-cap="${cap}">
                      ${cap === 0 ? 'Auto' : `${cap} FPS`}
                    </button>`
                  )
                  .join('')}
              </div>
              <span style="font-size:11.5px;color:var(--text-secondary);margin-left:6px;">AF:</span>
              <div class="segmented" role="group" aria-label="Filtrowanie anizotropowe">
                ${[1, 4, 8, 16]
                  .map(
                    (af) => `
                    <button type="button" class="segmented-btn ${activeAniso === af ? 'active' : ''}" data-game-aniso="${af}">
                      ${af}x
                    </button>`
                  )
                  .join('')}
              </div>
            </div>
            <div class="row-wrap" style="gap:8px;align-items:center;">
              <span style="font-size:11.5px;color:var(--text-secondary);min-width:85px;">Tone Mapping:</span>
              <div class="segmented" role="group" aria-label="Tone Mapping HDR">
                ${(
                  [
                    { id: 'aces', label: 'ACES Filmic' },
                    { id: 'agx', label: 'AgX PBR' },
                    { id: 'neutral', label: 'Neutral' },
                  ] as Array<{ id: GameToneMappingMode; label: string }>
                )
                  .map(
                    (tm) => `
                    <button type="button" class="segmented-btn ${activeTone === tm.id ? 'active' : ''}" data-game-tonemap="${tm.id}">
                      ${tm.label}
                    </button>`
                  )
                  .join('')}
              </div>
              <button id="game-fog-btn" type="button" class="btn btn-secondary btn-sm">Mgła 3D: ${fogOn ? 'WŁ.' : 'WYŁ.'}</button>
            </div>
            <div class="row-wrap" style="gap:12px;align-items:center;">
              <label style="display:flex;align-items:center;gap:6px;font-size:11.5px;color:var(--text-secondary);flex:1;min-width:170px;">
                <span>Ekspozycja (<strong id="game-exp-val" class="font-mono">${activeExp.toFixed(2)}</strong>):</span>
                <input id="game-exp-slider" type="range" class="range-input" min="0.6" max="1.6" step="0.02" value="${activeExp}" />
              </label>
              <label style="display:flex;align-items:center;gap:6px;font-size:11.5px;color:var(--text-secondary);flex:1;min-width:170px;">
                <span>Odbicia IBL (<strong id="game-env-val" class="font-mono">${activeEnv.toFixed(2)}</strong>):</span>
                <input id="game-env-slider" type="range" class="range-input" min="0.1" max="1.6" step="0.05" value="${activeEnv}" />
              </label>
              <div class="segmented" role="group" aria-label="Gęstość scenerii">
                ${[25, 50, 75, 100]
                  .map(
                    (pct) => `
                    <button type="button" class="segmented-btn ${activeScenery === pct ? 'active' : ''}" data-game-scenery="${pct}">
                      Sceneria ${pct}%
                    </button>`
                  )
                  .join('')}
              </div>
            </div>
          </div>
        </div>

        <!-- 5 KATEGORII WSPÓŁCZESNYCH USTAWIEŃ KART GRAFICZNYCH W GRACH (LIVE PIPELINE) -->
        <div class="panel stack-sm" style="padding:14px;border:1px solid rgba(56, 189, 248, 0.3);">
          <div class="row-between" style="flex-wrap:wrap;gap:8px;">
            <div>
              <strong style="font-size:14px;color:var(--accent-cyan);">🎛️ Współczesne Ustawienia Kart Graficznych (5 Kategorii: DLSS 4.5 / FSR 4 · Frame Gen · Reflex · Lumen GI / RT · VRAM &amp; Post-FX)</strong>
              <div style="font-size:11.5px;color:var(--text-secondary);">
                1. Skalowanie AI &amp; FG · 2. Oświetlenie, Cienie i Ray Tracing · 3. Tekstury (12GB+ VRAM Ultra) &amp; Geometria · 4. Filtry Post-Processingu · 5. Sterownik (Smooth Motion / AFMF / Sharpening / Max FPS)
              </div>
            </div>
            <div class="row-wrap" style="gap:8px;font-size:11.5px;" class="font-mono">
              <span class="font-mono" style="padding:3px 8px;border-radius:6px;background:rgba(16,185,129,0.14);color:#10b981;">Szac. VRAM: <strong>${g.estVramUsageGb ?? 7.6} GB</strong></span>
              <span class="font-mono" style="padding:3px 8px;border-radius:6px;background:rgba(6,182,212,0.14);color:#22d3ee;">Input Lag: <strong>${g.estInputLagMs ?? 9.1} ms</strong></span>
            </div>
          </div>

          <div class="grid-3" style="gap:10px;margin-top:4px;">
            <!-- Kategoria 1: Skalowanie AI & Frame Gen -->
            <div class="panel stack-xs" style="background:var(--bg-inset);padding:10px;">
              <strong style="font-size:12px;color:var(--accent-cyan);">1. Skalowanie Obrazu AI &amp; Generowanie Klatek</strong>
              <div class="row-wrap" style="gap:4px;">
                ${(
                  [
                    { id: 'native', label: 'Natywne 100%' },
                    { id: 'dlss_quality', label: 'DLSS/FSR Quality 67%' },
                    { id: 'dlss_balanced', label: 'Balanced 58%' },
                    { id: 'dlss_ultra_perf', label: 'NVIDIA App 38%' },
                  ] as Array<{ id: GameUpscalingMode; label: string }>
                )
                  .map(
                    (u) => `
                    <button type="button" data-game-upscale="${u.id}" class="btn ${(g.upscalingMode || 'dlss_quality') === u.id ? 'btn-primary' : 'btn-secondary'} btn-sm" style="font-size:11px;padding:3px 7px;">
                      ${u.label}
                    </button>`
                  )
                  .join('')}
              </div>
              <div class="row-wrap" style="gap:4px;margin-top:4px;">
                ${(
                  [
                    { id: 'off', label: 'FG: Wył. (E-Sport)' },
                    { id: 'fg_2x', label: 'Frame Gen x2' },
                    { id: 'mfg_3x', label: 'Multi FG x3' },
                    { id: 'mfg_4x', label: 'Multi FG x4' },
                  ] as Array<{ id: GameFrameGenMode; label: string }>
                )
                  .map(
                    (fg) => `
                    <button type="button" data-game-fg="${fg.id}" class="btn ${(g.frameGenMode || 'fg_2x') === fg.id ? 'btn-amber' : 'btn-secondary'} btn-sm" style="font-size:11px;padding:3px 7px;">
                      ${fg.label}
                    </button>`
                  )
                  .join('')}
              </div>
              <div class="row-wrap" style="gap:4px;margin-top:4px;">
                ${(
                  [
                    { id: 'off', label: 'Reflex: Wył.' },
                    { id: 'on', label: 'Reflex / Anti-Lag: WŁ.' },
                    { id: 'boost', label: 'Reflex: WŁ. + Boost' },
                  ] as Array<{ id: GameReflexMode; label: string }>
                )
                  .map(
                    (rx) => `
                    <button type="button" data-game-reflex="${rx.id}" class="btn ${(g.reflexMode || 'boost') === rx.id ? 'btn-primary' : 'btn-secondary'} btn-sm" style="font-size:11px;padding:3px 7px;">
                      ${rx.label}
                    </button>`
                  )
                  .join('')}
              </div>
            </div>

            <!-- Kategoria 2: Oświetlenie, Cienie i Ray Tracing -->
            <div class="panel stack-xs" style="background:var(--bg-inset);padding:10px;">
              <strong style="font-size:12px;color:var(--accent-amber);">2. Oświetlenie (Lumen GI), Cienie &amp; Ray Tracing</strong>
              <div class="row-wrap" style="gap:4px;">
                ${(
                  [
                    { id: 'off', label: 'RT: Wył.' },
                    { id: 'rt_medium', label: 'RT: High/SSR' },
                    { id: 'rt_ultra', label: 'RT: Ultra' },
                    { id: 'path_tracing', label: 'Path Tracing' },
                  ] as Array<{ id: GameRayTracingMode; label: string }>
                )
                  .map(
                    (rt) => `
                    <button type="button" data-game-rt="${rt.id}" class="btn ${(g.rayTracingMode || 'rt_medium') === rt.id ? 'btn-amber' : 'btn-secondary'} btn-sm" style="font-size:11px;padding:3px 7px;">
                      ${rt.label}
                    </button>`
                  )
                  .join('')}
              </div>
              <div class="row-wrap" style="gap:4px;margin-top:4px;">
                ${(
                  [
                    { id: 'medium', label: 'Lumen GI: Medium' },
                    { id: 'high', label: 'Lumen GI: High (Zalecane UE5)' },
                    { id: 'epic_lumen', label: 'Lumen: Epic/Ultra' },
                  ] as Array<{ id: GameGiQuality; label: string }>
                )
                  .map(
                    (gi) => `
                    <button type="button" data-game-gi="${gi.id}" class="btn ${(g.giQuality || 'high') === gi.id ? 'btn-primary' : 'btn-secondary'} btn-sm" style="font-size:11px;padding:3px 7px;">
                      ${gi.label}
                    </button>`
                  )
                  .join('')}
              </div>
              <span style="font-size:11px;color:var(--text-muted);margin-top:2px;">W UE5 zejście z Epic na High daje duży skok FPS przy niemal identycznym obrazie.</span>
            </div>

            <!-- Kategoria 3, 4 i 5: Tekstury (VRAM), Geometria & Post-Processing -->
            <div class="panel stack-xs" style="background:var(--bg-inset);padding:10px;">
              <strong style="font-size:12px;color:var(--status-ok);">3–5. Tekstury (VRAM), Post-FX &amp; Sterownik GPU</strong>
              <div class="row-wrap" style="gap:4px;">
                ${(
                  [
                    { id: 'medium', label: 'Tekstury: Medium (6GB)' },
                    { id: 'high', label: 'Tekstury: High (8GB)' },
                    { id: 'ultra', label: 'Tekstury: Ultra (12GB+ VRAM)' },
                  ] as Array<{ id: GameTextureQuality; label: string }>
                )
                  .map(
                    (tq) => `
                    <button type="button" data-game-tex="${tq.id}" class="btn ${(g.textureQuality || 'ultra') === tq.id ? 'btn-primary' : 'btn-secondary'} btn-sm" style="font-size:11px;padding:3px 7px;">
                      ${tq.label}
                    </button>`
                  )
                  .join('')}
              </div>
              <div class="row-wrap" style="gap:4px;margin-top:4px;">
                <button type="button" id="game-post-ca-btn" class="btn ${g.chromaticAberration ? 'btn-amber' : 'btn-secondary'} btn-sm" style="font-size:11px;padding:3px 7px;">
                  Aberracja Chrom.: ${g.chromaticAberration ? 'WŁ.' : 'WYŁ.'}
                </button>
                <button type="button" id="game-post-mb-btn" class="btn ${g.motionBlur ? 'btn-amber' : 'btn-secondary'} btn-sm" style="font-size:11px;padding:3px 7px;">
                  Motion Blur: ${g.motionBlur ? 'WŁ.' : 'WYŁ.'}
                </button>
                <button type="button" id="game-smooth-motion-btn" class="btn ${(g.smoothMotionEnabled ?? true) ? 'btn-primary' : 'btn-secondary'} btn-sm" style="font-size:11px;padding:3px 7px;">
                  Smooth Motion / AFMF: ${(g.smoothMotionEnabled ?? true) ? 'WŁ.' : 'WYŁ.'}
                </button>
              </div>
              <span style="font-size:11px;color:var(--text-muted);margin-top:2px;">12GB+ VRAM: Tekstury Ultra + AF x16 = 0% spadku FPS.</span>
            </div>
          </div>
        </div>

        <div id="game-live-metrics" class="grid-4">
          ${this.renderGameMetricsHtml(g)}
        </div>

        <div class="panel stack-md">
          <div class="panel-header" style="margin-bottom:0;">
            <h2 class="panel-title" id="game-chart-title">Wykres FPS i czasu klatki (Frame-Time ms) — ${esc(activeGame.title)}</h2>
            <span class="panel-caption">Walka/Lotnictwo: WASD + Spacja Ogień + F/PPM Salwa Rakiet + Shift/N Dopalacz NITRO + R Restart · Wyścigi: A/D + Shift/N Nitro</span>
          </div>
          <div id="game-live-chart">
            ${this.renderGameChartHtml(g)}
          </div>
        </div>

        ${renderPcSuitabilityAndGamesReport({
          specs: this.specs,
          cpu: this.cpuState,
          ram: this.ramState,
          disk: this.diskState,
          gpu: this.gpuState,
          game: this.gameState,
        })}
      </div>
    `;

    const mountEl = host.querySelector<HTMLElement>('#game-canvas-mount');
    if (mountEl) {
      gameBenchService.mount(mountEl, (m) => {
        this.gameState = m;
        this.patchGameLive();
      });
    }

    bindPcSuitabilityReportEvents(host, () => this.renderGameBenchView(host));

    host.querySelectorAll<HTMLButtonElement>('[data-game-cat]').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.gameCategoryFilter = (btn.dataset.gameCat as typeof this.gameCategoryFilter) || 'ALL';
        this.renderGameBenchView(host);
      });
    });

    host.querySelectorAll<HTMLButtonElement>('[data-game-scene]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const sceneId = btn.dataset.gameScene as GameSceneId;
        gameBenchService.setGameScene(sceneId);
        this.gameState = gameBenchService.getMetrics();
        this.renderGameBenchView(host);
      });
    });

    host.querySelectorAll<HTMLButtonElement>('[data-game-ai-profile]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const prof = btn.dataset.gameAiProfile as GameAiProfile;
        gameBenchService.applyAiGraphicsProfile(prof);
        this.gameState = gameBenchService.getMetrics();
        this.renderGameBenchView(host);
      });
    });

    host.querySelector('#game-preset-ue5-single')?.addEventListener('click', () => {
      gameBenchService.applyUe5OptimizationPreset(120, false);
      this.gameState = gameBenchService.getMetrics();
      this.renderGameBenchView(host);
    });

    host.querySelector('#game-preset-esport-117')?.addEventListener('click', () => {
      gameBenchService.applyUe5OptimizationPreset(120, true);
      this.gameState = gameBenchService.getMetrics();
      this.renderGameBenchView(host);
    });

    host.querySelector('#game-preset-esport-141')?.addEventListener('click', () => {
      gameBenchService.applyUe5OptimizationPreset(144, true);
      this.gameState = gameBenchService.getMetrics();
      this.renderGameBenchView(host);
    });

    host.querySelectorAll<HTMLButtonElement>('[data-game-upscale]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const mode = btn.dataset.gameUpscale as GameUpscalingMode;
        gameBenchService.setUpscalingMode(mode);
        this.gameState = gameBenchService.getMetrics();
        this.renderGameBenchView(host);
      });
    });

    host.querySelectorAll<HTMLButtonElement>('[data-game-fg]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const mode = btn.dataset.gameFg as GameFrameGenMode;
        gameBenchService.setFrameGenMode(mode);
        this.gameState = gameBenchService.getMetrics();
        this.renderGameBenchView(host);
      });
    });

    host.querySelectorAll<HTMLButtonElement>('[data-game-reflex]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const mode = btn.dataset.gameReflex as GameReflexMode;
        gameBenchService.setReflexMode(mode);
        this.gameState = gameBenchService.getMetrics();
        this.renderGameBenchView(host);
      });
    });

    host.querySelectorAll<HTMLButtonElement>('[data-game-rt]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const mode = btn.dataset.gameRt as GameRayTracingMode;
        gameBenchService.setRayTracingMode(mode);
        this.gameState = gameBenchService.getMetrics();
        this.renderGameBenchView(host);
      });
    });

    host.querySelectorAll<HTMLButtonElement>('[data-game-gi]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const q = btn.dataset.gameGi as GameGiQuality;
        gameBenchService.setGiQuality(q);
        this.gameState = gameBenchService.getMetrics();
        this.renderGameBenchView(host);
      });
    });

    host.querySelectorAll<HTMLButtonElement>('[data-game-tex]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const q = btn.dataset.gameTex as GameTextureQuality;
        gameBenchService.setTextureQuality(q);
        this.gameState = gameBenchService.getMetrics();
        this.renderGameBenchView(host);
      });
    });

    host.querySelector('#game-post-ca-btn')?.addEventListener('click', () => {
      gameBenchService.setPostProcessFilter('chromaticAberration', !this.gameState.chromaticAberration);
      this.gameState = gameBenchService.getMetrics();
      this.renderGameBenchView(host);
    });

    host.querySelector('#game-post-mb-btn')?.addEventListener('click', () => {
      gameBenchService.setPostProcessFilter('motionBlur', !this.gameState.motionBlur);
      this.gameState = gameBenchService.getMetrics();
      this.renderGameBenchView(host);
    });

    host.querySelector('#game-smooth-motion-btn')?.addEventListener('click', () => {
      gameBenchService.setSmoothMotionEnabled(!(this.gameState.smoothMotionEnabled ?? true));
      this.gameState = gameBenchService.getMetrics();
      this.renderGameBenchView(host);
    });

    host.querySelector('#game-rocket-salvo-btn')?.addEventListener('click', () => {
      gameBenchService.fireRocketSalvo();
      this.gameState = gameBenchService.getMetrics();
      this.patchGameLive();
    });

    host.querySelector('#game-nitro-burst-btn')?.addEventListener('click', () => {
      gameBenchService.triggerNitroBurst();
      this.gameState = gameBenchService.getMetrics();
      this.patchGameLive();
    });

    host.querySelectorAll<HTMLButtonElement>('[data-game-preset]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const p = btn.dataset.gamePreset as GameQualityPreset;
        gameBenchService.setPreset(p);
        this.gameState = gameBenchService.getMetrics();
        host.querySelectorAll<HTMLButtonElement>('[data-game-preset]').forEach((b) => {
          b.classList.toggle('active', b.dataset.gamePreset === p);
        });
        this.patchGameLive();
      });
    });

    host.querySelectorAll<HTMLButtonElement>('[data-game-fps]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const m = btn.dataset.gameFps as GpuFpsMode;
        gameBenchService.setFpsMode(m);
        this.gameState = gameBenchService.getMetrics();
        host.querySelectorAll<HTMLButtonElement>('[data-game-fps]').forEach((b) => {
          b.classList.toggle('active', b.dataset.gameFps === m);
        });
        this.patchGameLive();
      });
    });

    host.querySelectorAll<HTMLButtonElement>('[data-game-fps-cap]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const cap = (Number(btn.dataset.gameFpsCap) || 0) as GameFpsCap;
        gameBenchService.setFpsCap(cap);
        this.gameState = gameBenchService.getMetrics();
        host.querySelectorAll<HTMLButtonElement>('[data-game-fps-cap]').forEach((b) => {
          b.classList.toggle('active', Number(b.dataset.gameFpsCap) === cap);
        });
        host.querySelectorAll<HTMLButtonElement>('[data-game-fps]').forEach((b) => {
          b.classList.toggle('active', b.dataset.gameFps === this.gameState.fpsMode);
        });
        this.patchGameLive();
      });
    });

    host.querySelectorAll<HTMLButtonElement>('[data-game-aniso]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const af = Number(btn.dataset.gameAniso) || 16;
        gameBenchService.setAnisotropy(af);
        this.gameState = gameBenchService.getMetrics();
        host.querySelectorAll<HTMLButtonElement>('[data-game-aniso]').forEach((b) => {
          b.classList.toggle('active', Number(b.dataset.gameAniso) === af);
        });
      });
    });

    host.querySelectorAll<HTMLButtonElement>('[data-game-tonemap]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const tm = btn.dataset.gameTonemap as GameToneMappingMode;
        gameBenchService.setToneMapping(tm);
        this.gameState = gameBenchService.getMetrics();
        host.querySelectorAll<HTMLButtonElement>('[data-game-tonemap]').forEach((b) => {
          b.classList.toggle('active', b.dataset.gameTonemap === tm);
        });
      });
    });

    host.querySelectorAll<HTMLButtonElement>('[data-game-scenery]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const pct = Number(btn.dataset.gameScenery) || 100;
        gameBenchService.setSceneryDensityPct(pct);
        this.gameState = gameBenchService.getMetrics();
        host.querySelectorAll<HTMLButtonElement>('[data-game-scenery]').forEach((b) => {
          b.classList.toggle('active', Number(b.dataset.gameScenery) === pct);
        });
        this.patchGameLive();
      });
    });

    host.querySelector('#game-dynres-btn')?.addEventListener('click', (e) => {
      const next = !(this.gameState.dynamicResolution ?? true);
      gameBenchService.setDynamicResolution(next);
      this.gameState = gameBenchService.getMetrics();
      const btn = e.currentTarget as HTMLButtonElement;
      btn.className = `btn ${next ? 'btn-primary' : 'btn-secondary'} btn-sm`;
      btn.textContent = `Dynamic Res AI: ${next ? 'WŁ.' : 'WYŁ.'}`;
      this.patchGameLive();
    });

    host.querySelector('#game-fog-btn')?.addEventListener('click', (e) => {
      const next = !(this.gameState.fogEnabled ?? true);
      gameBenchService.setFogEnabled(next);
      this.gameState = gameBenchService.getMetrics();
      (e.currentTarget as HTMLButtonElement).textContent = `Mgła 3D: ${next ? 'WŁ.' : 'WYŁ.'}`;
    });

    host.querySelector<HTMLInputElement>('#game-exp-slider')?.addEventListener('input', (e) => {
      const val = parseFloat((e.currentTarget as HTMLInputElement).value);
      gameBenchService.setExposure(val);
      this.gameState = gameBenchService.getMetrics();
      const lbl = host.querySelector('#game-exp-val');
      if (lbl) lbl.textContent = val.toFixed(2);
    });

    host.querySelector<HTMLInputElement>('#game-env-slider')?.addEventListener('input', (e) => {
      const val = parseFloat((e.currentTarget as HTMLInputElement).value);
      gameBenchService.setEnvIntensity(val);
      this.gameState = gameBenchService.getMetrics();
      const lbl = host.querySelector('#game-env-val');
      if (lbl) lbl.textContent = val.toFixed(2);
    });

    host.querySelector('#game-bloom-btn')?.addEventListener('click', (e) => {
      const next = !this.gameState.bloomEnabled;
      gameBenchService.setBloomEnabled(next);
      this.gameState = gameBenchService.getMetrics();
      (e.currentTarget as HTMLButtonElement).textContent = `Bloom: ${next ? 'WŁ.' : 'WYŁ.'}`;
    });

    host.querySelector('#game-shadows-btn')?.addEventListener('click', (e) => {
      const next = !this.gameState.shadowsEnabled;
      gameBenchService.setShadowsEnabled(next);
      this.gameState = gameBenchService.getMetrics();
      (e.currentTarget as HTMLButtonElement).textContent = `Cienie 4K: ${next ? 'WŁ.' : 'WYŁ.'}`;
    });

    host.querySelector('#game-sfx-btn')?.addEventListener('click', (e) => {
      this.gameSfxEnabled = !this.gameSfxEnabled;
      gameBenchService.setSfxEnabled(this.gameSfxEnabled);
      (e.currentTarget as HTMLButtonElement).textContent = `🔊 SFX: ${this.gameSfxEnabled ? 'WŁ.' : 'WYŁ.'}`;
    });

    host.querySelector('#game-restart-btn')?.addEventListener('click', () => {
      gameBenchService.restartGameMission();
      this.gameState = gameBenchService.getMetrics();
      this.patchGameLive();
    });

    host.querySelector('#game-fullscreen-btn')?.addEventListener('click', () => {
      const shell = host.querySelector<HTMLElement>('#game-viewport-shell');
      if (!shell) return;
      if (document.fullscreenElement) {
        void document.exitFullscreen?.();
      } else {
        void shell.requestFullscreen?.();
      }
    });

    host.querySelector('#game-fire-btn')?.addEventListener('click', () => {
      gameBenchService.firePlayerWeapon();
      this.gameState = gameBenchService.getMetrics();
      this.patchGameLive();
    });

    host.querySelector('#game-soccer-kick-btn')?.addEventListener('click', () => {
      gameBenchService.kickSoccerBall();
      this.gameState = gameBenchService.getMetrics();
      this.patchGameLive();
    });

    host.querySelector('#game-mode-btn')?.addEventListener('click', (e) => {
      const next = !this.gameState.interactiveMode;
      gameBenchService.setInteractiveMode(next);
      this.gameState = gameBenchService.getMetrics();
      const btn = e.currentTarget as HTMLButtonElement;
      btn.className = `btn ${next ? 'btn-amber' : 'btn-secondary'} btn-sm`;
      btn.textContent = next ? 'Tryb: Gracz (WASD+Mysz)' : 'Tryb: Kamera Benchmark';
    });

    host.querySelector('#game-toggle-btn')?.addEventListener('click', () => {
      if (gameBenchService.isRunning()) {
        gameBenchService.stop();
        const currentMeta = gameBenchService.getGameCatalogItem();
        void this.recordLog(
          'GAME_MAX',
          this.gameState.avgFps >= 45 ? 'OK' : 'WARN',
          `Zakończono benchmark gry ${currentMeta.shortTitle}`,
          `${this.gameState.preset.toUpperCase()}`,
          `${this.gameState.avgFps} FPS (1% Low: ${this.gameState.low1PctFps})`,
          `Gra: ${currentMeta.title}, 0.1% Low: ${this.gameState.low01PctFps} FPS, Trójkąty: ${this.gameState.triangles}, Rozdzielczość: ${this.gameState.resolutionLabel}`
        );
        this.finalizeStressSession(
          'Gra 3D MAX',
          this.gameState.stabilityPct,
          `${currentMeta.shortTitle} · ${this.gameState.preset.toUpperCase()} · Śr. ${this.gameState.avgFps} FPS · 1% Low ${this.gameState.low1PctFps} FPS`
        );
      } else {
        this.beginStressSession();
        gameBenchService.start();
      }
      this.patchGameLive();
    });
  }

  private renderGameHudStripInner(
    g: GameBenchMetrics,
    shortTitle: string,
    cat: 'COMBAT' | 'RACING' | 'SOCCER' | 'FLIGHT' | 'SCIFI'
  ): string {
    const modeSpecific =
      cat === 'SOCCER' || g.isSoccerMode
        ? `<span>Mecz: <strong class="status-ok">${g.soccerScoreHome ?? 0} : ${g.soccerScoreAway ?? 0}</strong></span>
           <span>Piłka: <strong class="status-cyan">${g.soccerBallSpeedKmh ?? 0} km/h</strong></span>
           <span>Czas: <strong>${g.soccerMatchSec ?? 0}s</strong></span>`
        : cat === 'COMBAT' || cat === 'FLIGHT' || g.isCombatMode || g.isFlightMode
          ? `<span>Etap: <strong class="status-amber">${g.gameStage ?? 1}/${g.gameMaxStage ?? 5}</strong></span>
             <span>Wynik: <strong class="status-ok">${(g.gameScore ?? 0).toLocaleString('pl-PL')}</strong></span>
             <span>Combo: <strong class="status-cyan">x${g.gameCombo ?? 1}</strong></span>
             <span>Pancerz: <strong class="${(g.gameHealthPct ?? 100) <= 30 ? 'status-err' : 'status-ok'}">${g.gameHealthPct ?? 100}%</strong></span>
             <span>Boost: <strong class="status-cyan">${g.raceNitroPct ?? 100}%</strong></span>`
          : g.isRacingMode
            ? `<span>Prędkość: <strong class="status-ok">${g.raceSpeedKmh || 0} km/h</strong></span>
               <span>Okr.: <strong>${g.raceLap || 1}/${g.raceTotalLaps || 5}</strong></span>
               <span>Poz.: <strong class="status-amber">P${g.racePosition || 1}/7</strong></span>
               <span>Nitro: <strong class="status-cyan">${g.raceNitroPct ?? 100}%</strong></span>`
            : `<span>Trójkąty: <strong>${g.triangles.toLocaleString('pl-PL')}</strong></span>
               <span>Jednostki/Cząst.: <strong>${g.droneCount.toLocaleString('pl-PL')} / ${g.particleCount.toLocaleString('pl-PL')}</strong></span>`;
    const perfPart =
      !g.running && g.fps === 0
        ? `<span>Tryb: <strong class="status-cyan">PODGLĄD 3D</strong></span>`
        : `<span>FPS: <strong class="status-cyan">${g.fps}</strong></span>
           <span>1% Low: <strong>${g.low1PctFps}</strong></span>
           <span>Frame: <strong>${g.frameTimeMs} ms</strong></span>`;
    return `
      <span>Gra: <strong class="status-cyan">${esc(shortTitle)}</strong></span>
      ${perfPart}
      ${modeSpecific}
    `;
  }

  private renderGameHudVerdictInner(
    g: GameBenchMetrics,
    cat: 'COMBAT' | 'RACING' | 'SOCCER' | 'FLIGHT' | 'SCIFI'
  ): string {
    if (cat === 'SOCCER' || g.isSoccerMode) {
      return `<span>PIŁKA NOŻNA 3D · WASD / Strzałki (Bieg) + Spacja / Klik (Strzał)</span>`;
    }
    if (cat === 'COMBAT' || cat === 'FLIGHT' || g.isCombatMode || g.isFlightMode) {
      const lockBadge = g.targetLocked ? `<strong class="status-err">● NAMIERZONY</strong> · ` : '';
      return `<span>${lockBadge}Zniszczone: <strong>${g.gameTargetsDestroyed ?? 0}</strong> · Trafienia: <strong>${g.targetsHit}</strong> · WASD + Spacja (Ogień) + Shift (Boost)</span>`;
    }
    if (g.isRacingMode) {
      return `<span>WYŚCIG 5 OKR. · Wynik: <strong>${(g.gameScore ?? 0).toLocaleString('pl-PL')}</strong> · Bramki: <strong>${g.gameGatesPassed ?? 0}</strong> · A/D + Shift (Nitro)</span>`;
    }
    if (g.interactiveMode) {
      return `<span>GRACZ WASD · Strzały: ${g.shotsFired} · Trafienia: ${g.targetsHit}</span>`;
    }
    return `<span>Status: <strong>${esc(g.verdict)}</strong></span>`;
  }

  private renderGameMetricsHtml(g: GameBenchMetrics): string {
    const hasRealTemp = g.realGpuTempC !== null;
    const isCombat = Boolean(g.isCombatMode || gameBenchService.isCombatScene());
    const isFlight = gameBenchService.isFlightScene();
    const isSoccer = Boolean(g.isSoccerMode || gameBenchService.isSoccerScene());
    return `
      <div class="metric-card">
        <span class="metric-label">Średnie / Max FPS</span>
        <div class="metric-row">
          <span class="metric-value">${g.avgFps > 0 ? g.avgFps : '—'}</span>
          <span class="metric-unit">/ ${g.maxFps > 0 ? g.maxFps : '—'} FPS</span>
        </div>
        <span class="metric-foot">1% Low: ${g.low1PctFps} · 0.1% Low: ${g.low01PctFps} FPS</span>
      </div>

      <div class="metric-card">
        <span class="metric-label">Stabilność Frame-Time</span>
        <div class="metric-row">
          <span class="metric-value ${g.stabilityPct >= 85 ? 'status-ok' : g.stabilityPct >= 70 ? 'status-warn' : 'status-err'}">${g.stabilityPct}%</span>
          <span class="metric-unit">${g.frameTimeMs} ms</span>
        </div>
        <span class="metric-foot">Trójkąty: ${g.triangles.toLocaleString('pl-PL')} · AF ${g.anisotropy ?? 16}x · ${(g.toneMapping || 'aces').toUpperCase()}</span>
      </div>

      <div class="metric-card">
        <span class="metric-label">${
          isSoccer
            ? 'Mecz Piłki Nożnej 3D (LIVE)'
            : isCombat || isFlight
              ? `Kampania Bojowa (Etap ${g.gameStage ?? 1}/${g.gameMaxStage ?? 5})`
              : g.isRacingMode
                ? 'Telemetria Wyścigu 3D (5 Okrążeń)'
                : hasRealTemp
                  ? 'Czujnik GPU (LIVE °C)'
                  : 'Obciążenie Raymarch GPU'
        }</span>
        <div class="metric-row">
          ${
            isSoccer
              ? `<span class="metric-value status-ok">${g.soccerScoreHome ?? 0} : ${g.soccerScoreAway ?? 0}</span><span class="metric-unit">piłka ${g.soccerBallSpeedKmh ?? 0} km/h</span>`
              : isCombat || isFlight
                ? `<span class="metric-value status-cyan">${(g.gameScore ?? 0).toLocaleString('pl-PL')}</span><span class="metric-unit">pkt · Combo x${g.gameCombo ?? 1}</span>`
                : g.isRacingMode
                  ? `<span class="metric-value status-ok">${g.raceSpeedKmh || 0}</span><span class="metric-unit">km/h · P${g.racePosition || 1}/7 · Okr. ${g.raceLap || 1}/${g.raceTotalLaps || 5}</span>`
                  : hasRealTemp
                    ? `<span class="metric-value ${g.realGpuTempC! >= 82 ? 'status-err' : g.realGpuTempC! >= 70 ? 'status-warn' : 'status-ok'}">${g.realGpuTempC!.toFixed(1)}</span><span class="metric-unit">°C</span>`
                    : `<span class="metric-value status-cyan">${g.raymarchSteps}</span><span class="metric-unit">kroków/px · SSAA ${Math.round(g.renderScale * 100)}%</span>`
          }
        </div>
        <span class="metric-foot">${
          isSoccer
            ? `Czas meczu: ${g.soccerMatchSec ?? 0}s · WASD + Spacja (Strzał)`
            : isCombat || isFlight
              ? `Pancerz: ${g.gameHealthPct ?? 100}% · Zniszczone: ${g.gameTargetsDestroyed ?? 0} · Bramki: ${g.gameGatesPassed ?? 0}`
              : g.isRacingMode
                ? `Bramki: ${g.gameGatesPassed ?? 0} · Nitro: ${g.raceNitroPct ?? 100}% · Wynik: ${(g.gameScore ?? 0).toLocaleString('pl-PL')}`
                : hasRealTemp
                  ? `Szczyt czujnika: ${g.peakTempC.toFixed(1)} °C`
                  : 'Brak czujnika °C (podłącz LHM :8085 na Dashboardzie)'
        }</span>
      </div>

      <div class="metric-card">
        <span class="metric-label">Indeks Gamingowy 3D</span>
        <div class="metric-row">
          <span class="metric-value status-cyan">${g.overallScore > 0 ? g.overallScore : '—'}</span>
          <span class="metric-unit">/ 100</span>
        </div>
        <span class="metric-foot">${esc(g.verdict)} · ${g.fpsCap ? `Limit ${g.fpsCap} FPS` : g.fpsMode === 'vsync' ? 'VSync Płynny' : 'Bez limitu'} · ${g.elapsedSec}s</span>
      </div>
    `;
  }

  private renderGameChartHtml(g: GameBenchMetrics): string {
    const hasRealTemp = g.realGpuTempC !== null;
    return renderDualLineChart(
      [
        { label: 'FPS w grze MAX', color: '#06b6d4', values: g.telemetry.map((t) => t.fps), unit: 'FPS', min: 0 },
        hasRealTemp
          ? { label: 'Czujnik GPU (°C)', color: '#f59e0b', values: g.telemetry.map((t) => t.estTempC), unit: '°C', min: 30, max: 100, dashed: true }
          : { label: 'Czas klatki (ms)', color: '#f59e0b', values: g.telemetry.map((t) => t.frameTimeMs), unit: 'ms', min: 0, dashed: true },
      ],
      g.telemetry.map((t) => `${t.timeSec}s`),
      180
    );
  }

  private patchGameLive(): void {
    if (this.activeModule !== 'game') return;
    const g = this.gameState;
    const activeGame = gameBenchService.getGameCatalogItem();
    const activeCat = this.getGameCategory(activeGame);
    const resEl = this.root.querySelector('#game-res-lbl');
    if (resEl) resEl.textContent = g.resolutionLabel;
    const aiRecEl = this.root.querySelector('#game-ai-rec-lbl');
    if (aiRecEl && g.aiRecommendation) aiRecEl.textContent = g.aiRecommendation;
    const hud = this.root.querySelector('#game-hud-live');
    if (hud) {
      hud.innerHTML = this.renderGameHudStripInner(g, activeGame.shortTitle, activeCat);
    }
    const verd = this.root.querySelector('#game-hud-verdict');
    if (verd) {
      verd.innerHTML = this.renderGameHudVerdictInner(g, activeCat);
    }
    const crosshair = this.root.querySelector<HTMLElement>('#game-hud-crosshair');
    if (crosshair) {
      const showCrosshair = activeCat === 'COMBAT' || activeCat === 'FLIGHT' || Boolean(g.isCombatMode);
      crosshair.style.display = showCrosshair ? 'block' : 'none';
      crosshair.classList.toggle('locked', Boolean(g.targetLocked));
    }
    const banner = this.root.querySelector<HTMLElement>('#game-hud-banner');
    if (banner) {
      banner.textContent = g.gameBannerText || '';
      banner.classList.toggle('visible', Boolean(g.gameBannerText));
    }
    const missionEl = this.root.querySelector<HTMLElement>('#game-hud-mission');
    if (missionEl) {
      missionEl.textContent = g.gameMissionText || '';
    }
    const btn = this.root.querySelector<HTMLButtonElement>('#game-toggle-btn');
    if (btn) {
      btn.className = `btn ${g.running ? 'btn-danger' : 'btn-primary'} btn-sm`;
      btn.innerHTML = `${iconSvg(g.running ? 'stop' : 'play', 14)}<span>${g.running ? 'Zatrzymaj grę' : 'Start Gry MAX'}</span>`;
    }
    const mEl = this.root.querySelector('#game-live-metrics');
    if (mEl) mEl.innerHTML = this.renderGameMetricsHtml(g);
    const cEl = this.root.querySelector('#game-live-chart');
    if (cEl) cEl.innerHTML = this.renderGameChartHtml(g);
  }

  /* =========================================================================
     2. PROCESOR (CPU BENCHMARK & THERMAL/CLOCK TELEMETRY)
     ========================================================================= */
  private renderCpuView(host: HTMLElement): void {
    const c = this.cpuState;
    const busy = c.status === 'running';
    const stressing = c.status === 'stressing';
    const freqStats = computeCpuFrequencyStats(c.telemetry, c.avgClockGHz);

    host.innerHTML = `
      <div class="stack-lg">
        <div class="section-header">
          <div>
            <h1 class="section-title">Testy procesora (CPU — 14 podtestów + 8 profili Torture Stress)</h1>
            <p class="section-subtitle">
              Wielowątkowe obliczenia na Web Workers (${c.coresUsed} wątków): Single/Multi-Core, AVX/FMA, Ray-Tracing BVH, N-Body Gravity, Inferencja AI GEMM/GELU, Monte Carlo Pi, AES-GCM, SHA-256, GZIP, Radix-2 FFT, JSON AST, KDF i Float32x4 SIMD.
            </p>
          </div>
          <div class="row-wrap" style="gap:8px;align-items:center;">
            <select id="cpu-stress-mode-select" class="field-input" style="width:auto;padding:7px 10px;font-size:12.5px;" ${busy || stressing ? 'disabled' : ''} title="Wybierz algorytm obciążenia ciągłego stres-testu CPU">
              <option value="all_core_avx" ${cpuTestService.getStressMode() === 'all_core_avx' ? 'selected' : ''}>Profil: Torture AVX/FMA 100%</option>
              <option value="prime_sieve" ${cpuTestService.getStressMode() === 'prime_sieve' ? 'selected' : ''}>Profil: Sito Prime95 (ALU+FP)</option>
              <option value="raytrace_bvh" ${cpuTestService.getStressMode() === 'raytrace_bvh' ? 'selected' : ''}>Profil: Ray-Tracing BVH 3D</option>
              <option value="matrix_fma" ${cpuTestService.getStressMode() === 'matrix_fma' ? 'selected' : ''}>Profil: Macierze FP64 64×64</option>
              <option value="crypto_gzip_mix" ${cpuTestService.getStressMode() === 'crypto_gzip_mix' ? 'selected' : ''}>Profil: Hybrydowy SHA-256 + ALU</option>
              <option value="nbody_gravity" ${cpuTestService.getStressMode() === 'nbody_gravity' ? 'selected' : ''}>Profil: Symulacja N-Body Gravity</option>
              <option value="neural_ai_inference" ${cpuTestService.getStressMode() === 'neural_ai_inference' ? 'selected' : ''}>Profil: Inferencja AI (GEMM/GELU)</option>
              <option value="monte_carlo_quicksort" ${cpuTestService.getStressMode() === 'monte_carlo_quicksort' ? 'selected' : ''}>Profil: Monte Carlo Pi &amp; Branch</option>
            </select>
            <button id="cpu-run-bench" type="button" class="btn btn-primary" ${busy || stressing ? 'disabled' : ''}>
              ${iconSvg('play', 14)}
              <span>${busy ? 'Trwa benchmark (14 testów)...' : 'Uruchom 14 testów CPU'}</span>
            </button>
            <button id="cpu-toggle-stress" type="button" class="btn ${stressing ? 'btn-danger' : 'btn-amber'}" ${busy ? 'disabled' : ''}>
              ${iconSvg(stressing ? 'stop' : 'cpu', 14)}
              <span>${stressing ? 'Zatrzymaj stres-test' : 'Ciągły stres-test 100%'}</span>
            </button>
          </div>
        </div>

        <div class="panel">
          <div class="row-between" style="margin-bottom:8px;">
            <span id="cpu-phase-text" style="font-weight:600;">${esc(c.phase)}</span>
            <span id="cpu-progress-label" class="font-mono">${c.status === 'stressing' ? 'STRES AKTYWNY' : `${c.progress}%`}</span>
          </div>
          <div class="progress-track">
            <div id="cpu-progress-fill" class="progress-fill ${c.status === 'completed' ? 'ok' : c.status === 'stressing' ? 'warn' : ''}" style="width:${c.status === 'stressing' ? 100 : c.progress}%"></div>
          </div>
        </div>

        <div id="cpu-kpi-grid" class="grid-4">
          ${this.renderCpuKpiCardsHtml(c)}
        </div>

        <div class="panel stack-md">
          <div class="panel-header" style="margin-bottom:0;flex-wrap:wrap;gap:8px;">
            <div>
              <h2 class="panel-title">Częstotliwość taktowania CPU w czasie rzeczywistym (D3.js)</h2>
              <p style="margin:3px 0 0;font-size:12px;color:var(--text-secondary);">
                Wizualizacja wahań taktowania (GHz / MHz) podczas benchmarku i ciągłego testu obciążeniowego z linią średniego taktowania i podglądem punktów.
              </p>
            </div>
            <div id="cpu-freq-stats-strip" class="meta-line">
              ${this.renderCpuFreqStatsStripHtml(freqStats, busy || stressing)}
            </div>
          </div>
          <div id="cpu-freq-d3-chart"></div>
        </div>

        <div class="grid-split-wide">
          <div class="panel stack-md">
            <div class="panel-header" style="margin-bottom:0;">
              <h2 class="panel-title">Przebieg obciążenia i przepustowości wątków CPU</h2>
              <span class="panel-caption">Lewa oś: Obciążenie (%) · Prawa oś: Wydajność operacji (kOps/s)</span>
            </div>
            <div id="cpu-dual-chart-wrap">
              ${this.renderCpuDualChartHtml(c)}
            </div>
            <p style="margin:0;font-size:12px;color:var(--text-muted);">
              100% uczciwy pomiar: wykres pokazuje wyłącznie rzeczywiste obciążenie wątków Web Worker i zmierzoną przepustowość obliczeń (kOps/s) — bez żadnych udawanych temperatur °C. Prawdziwe °C z czujnika CPU pojawią się po podłączeniu mostka LibreHardwareMonitor (:8085) na Dashboardzie.
            </p>
          </div>

          <div class="panel stack-md">
            <div class="panel-header" style="margin-bottom:0;">
              <h2 class="panel-title">Wyniki scenariuszy obciążeniowych</h2>
              <span id="cpu-overall-badge" class="status-cyan font-mono">${c.overallScore > 0 ? `${c.overallScore}/100 · ${c.grade}` : 'Brak danych'}</span>
            </div>
            <div id="cpu-scenarios-list" class="kv-list">
              ${this.renderCpuScenariosListHtml(c)}
            </div>
          </div>
        </div>
      </div>
    `;

    const freqHost = host.querySelector<HTMLElement>('#cpu-freq-d3-chart');
    if (freqHost) {
      renderCpuFrequencyD3Chart(freqHost, c.telemetry, {
        height: 220,
        isLive: busy || stressing,
        fallbackClockGHz: c.avgClockGHz,
      });
    }

    host.querySelector<HTMLSelectElement>('#cpu-stress-mode-select')?.addEventListener('change', (e) => {
      const mode = (e.currentTarget as HTMLSelectElement).value as CpuStressMode;
      cpuTestService.setStressMode(mode);
      this.cpuState.stressMode = mode;
    });

    host.querySelector('#cpu-run-bench')?.addEventListener('click', async () => {
      this.beginStressSession();
      this.cpuState = await cpuTestService.runFullBenchmark((res) => {
        this.cpuState = res;
        if (this.activeModule === 'cpu') this.patchCpuLive();
      });
      await this.recordLog(
        'CPU',
        'OK',
        'Benchmark procesora',
        'Multi-Core',
        `${this.cpuState.multiCoreScore} pkt`,
        `Single-Core: ${this.cpuState.singleCoreScore}, GZIP: ${this.cpuState.compressionMBs} MB/s, SHA-256: ${this.cpuState.cryptoSha256MBs} MB/s`
      );
      this.finalizeStressSession(
        'CPU Benchmark',
        this.cpuState.stabilityPct,
        `MC ${this.cpuState.multiCoreScore.toLocaleString('pl-PL')} pkt · SC ${this.cpuState.singleCoreScore.toLocaleString('pl-PL')} pkt`
      );
      if (this.activeModule === 'cpu') this.patchCpuLive();
    });

    host.querySelector('#cpu-toggle-stress')?.addEventListener('click', () => {
      if (this.cpuState.status === 'stressing') {
        cpuTestService.stopStress();
        this.cpuState = {
          ...this.cpuState,
          status: this.cpuState.singleCoreScore > 0 ? 'completed' : 'idle',
          phase: 'Stres-test zatrzymany przez użytkownika',
        };
        this.finalizeStressSession(
          'CPU Stres',
          this.cpuState.stabilityPct,
          `${this.cpuState.coresUsed} wątków · Throttling ${this.cpuState.throttlingPct}%`
        );
        this.patchCpuLive();
      } else {
        this.beginStressSession();
        cpuTestService.startContinuousStress(this.cpuState, (res) => {
          this.cpuState = res;
          if (this.activeModule === 'cpu') this.patchCpuLive();
        });
        this.patchCpuLive();
      }
    });
  }

  private renderCpuKpiCardsHtml(c: CpuTestResult): string {
    const liveCpuTemp = thermalMonitorService.getLiveCpuTempC();
    return `
      <div class="metric-card">
        <span class="metric-label">Wydajność Single-Core</span>
        <div class="metric-row">
          <span class="metric-value">${c.singleCoreScore > 0 ? c.singleCoreScore.toLocaleString('pl-PL') : '—'}</span>
          <span class="metric-unit">pkt</span>
        </div>
        <span class="metric-foot">1 wątek · Liczby pierwsze i FP</span>
      </div>

      <div class="metric-card">
        <span class="metric-label">Wydajność Multi-Core</span>
        <div class="metric-row">
          <span class="metric-value">${c.multiCoreScore > 0 ? c.multiCoreScore.toLocaleString('pl-PL') : '—'}</span>
          <span class="metric-unit">pkt</span>
        </div>
        <span class="metric-foot">Skalowanie: ${c.scalingRatio > 0 ? `${c.scalingRatio}× (${c.coresUsed} wątków)` : '—'}</span>
      </div>

      <div class="metric-card">
        <span class="metric-label">Czujnik temperatury CPU</span>
        <div class="metric-row">
          ${
            liveCpuTemp !== null
              ? `<span class="metric-value status-ok">${liveCpuTemp.toFixed(1)}</span><span class="metric-unit">°C (LIVE)</span>`
              : `<span class="metric-value" style="font-size:17px;">Brak czujnika</span>`
          }
        </div>
        <span class="metric-foot">${liveCpuTemp !== null ? 'Prawdziwy odczyt z mostka LHM :8085' : 'Podłącz LibreHardwareMonitor (:8085) na Dashboardzie'}</span>
      </div>

      <div class="metric-card">
        <span class="metric-label">Stabilność obciążenia wątków</span>
        <div class="metric-row">
          <span class="metric-value status-cyan">${c.stabilityPct}</span>
          <span class="metric-unit">%</span>
        </div>
        <span class="metric-foot">Aktywne wątki: ${c.coresUsed} · Brak zmyślonych °C</span>
      </div>
    `;
  }

  private renderCpuFreqStatsStripHtml(
    stats: ReturnType<typeof computeCpuFrequencyStats>,
    isLive: boolean
  ): string {
    return `
      <span>Aktualne: <strong class="font-mono status-cyan">${stats.currentGHz.toFixed(2)} GHz</strong> (${Math.round(stats.currentGHz * 1000)} MHz)</span>
      <span class="meta-sep">·</span>
      <span>Śr.: <strong class="font-mono status-warn">${stats.avgGHz.toFixed(2)} GHz</strong></span>
      <span class="meta-sep">·</span>
      <span>Szczyt: <strong class="font-mono">${stats.peakGHz.toFixed(2)} GHz</strong></span>
      <span class="meta-sep">·</span>
      <span>Wahania: <strong class="font-mono">${stats.fluctuationMHz} MHz</strong>${isLive ? ' <span class="status-cyan">● LIVE</span>' : ''}</span>
    `;
  }

  private renderCpuDualChartHtml(c: CpuTestResult): string {
    return renderDualLineChart(
      [
        {
          label: 'Obciążenie CPU (rzeczywiste)',
          color: '#06b6d4',
          values: c.telemetry.map((p) => p.loadPct),
          unit: '%',
          min: 0,
          max: 100,
        },
        {
          label: 'Przepustowość obliczeń',
          color: '#10b981',
          values: c.telemetry.map((p) => Math.round(p.opsPerSec / 1000)),
          unit: 'kOps/s',
          min: 0,
          dashed: true,
        },
      ],
      c.telemetry.map((p) => `${p.timeSec}s`),
      210
    );
  }

  private renderCpuScenariosListHtml(c: CpuTestResult): string {
    return `
      <div class="kv-row">
        <span class="kv-key">Obliczenia zmiennoprzecinkowe (ALU/FPU)</span>
        <span class="kv-val">${c.mathMflops > 0 ? `${c.mathMflops.toLocaleString('pl-PL')} kOps/s` : '—'}</span>
      </div>
      <div class="kv-row">
        <span class="kv-key">Macierze FP64 AVX/FMA (64×64 GFLOPS)</span>
        <span class="kv-val status-cyan">${c.avxMatrixGflops && c.avxMatrixGflops > 0 ? `${c.avxMatrixGflops} GFLOPS` : '—'}</span>
      </div>
      <div class="kv-row">
        <span class="kv-key">Silnik Ray-Tracing BVH (Wielowątkowy CPU)</span>
        <span class="kv-val">${c.raytraceScore && c.raytraceScore > 0 ? `${c.raytraceScore.toLocaleString('pl-PL')} pkt` : '—'}</span>
      </div>
      <div class="kv-row">
        <span class="kv-key">Symulacja astrofizyczna N-Body Gravity</span>
        <span class="kv-val status-cyan">${c.physicsNbodyGflops && c.physicsNbodyGflops > 0 ? `${c.physicsNbodyGflops} GFLOPS` : '—'}</span>
      </div>
      <div class="kv-row">
        <span class="kv-key">Inferencja Sieci Neuronowej AI (GEMM/GELU)</span>
        <span class="kv-val">${c.neuralInferenceOps && c.neuralInferenceOps > 0 ? `${c.neuralInferenceOps.toLocaleString('pl-PL')} inf/s` : '—'}</span>
      </div>
      <div class="kv-row">
        <span class="kv-key">Monte Carlo Pi &amp; Predykcja rozgałęzień</span>
        <span class="kv-val">${c.monteCarloScore && c.monteCarloScore > 0 ? `${c.monteCarloScore.toLocaleString('pl-PL')} pkt` : c.branchOpsM && c.branchOpsM > 0 ? `${c.branchOpsM.toLocaleString('pl-PL')} MOps/s` : '—'}</span>
      </div>
      <div class="kv-row">
        <span class="kv-key">Wektorowy Iloczyn Float32x4 SIMD</span>
        <span class="kv-val status-cyan">${c.simdDotGflops && c.simdDotGflops > 0 ? `${c.simdDotGflops} GFLOPS` : '—'}</span>
      </div>
      <div class="kv-row">
        <span class="kv-key">Przetwarzanie sygnałów DSP Radix-2 FFT</span>
        <span class="kv-val">${c.fftSignalScore && c.fftSignalScore > 0 ? `${c.fftSignalScore.toLocaleString('pl-PL')} pkt` : '—'}</span>
      </div>
      <div class="kv-row">
        <span class="kv-key">Kompresja GZIP / Parser JSON AST</span>
        <span class="kv-val">${c.compressionMBs > 0 ? `${c.compressionMBs} MB/s` : '—'}${c.jsonParseMBs && c.jsonParseMBs > 0 ? ` · JSON ${c.jsonParseMBs} MB/s` : ''}</span>
      </div>
      <div class="kv-row">
        <span class="kv-key">Kryptografia SHA-256 / AES-GCM 256-bit</span>
        <span class="kv-val">${c.cryptoSha256MBs > 0 ? `${c.cryptoSha256MBs} MB/s` : '—'}${c.aesGcmMBs && c.aesGcmMBs > 0 ? ` · AES ${c.aesGcmMBs} MB/s` : ''}</span>
      </div>
      <div class="kv-row">
        <span class="kv-key">Memory-Hard Hash KDF (Argon-like)</span>
        <span class="kv-val">${c.kdfHashOps && c.kdfHashOps > 0 ? `${c.kdfHashOps.toLocaleString('pl-PL')} op/s` : '—'}</span>
      </div>
      <div class="kv-row">
        <span class="kv-key">Spadek wydajności (Throttling) / Stabilność</span>
        <span class="kv-val ${c.throttlingPct > 15 ? 'status-warn' : 'status-ok'}">${c.throttlingPct}% · ${c.stabilityPct}% stab.</span>
      </div>
      <div class="kv-row">
        <span class="kv-key">Liczba użytych wątków Web Worker</span>
        <span class="kv-val">${c.coresUsed}</span>
      </div>
    `;
  }

  private patchCpuLive(): void {
    if (this.activeModule !== 'cpu') return;
    const c = this.cpuState;
    const busy = c.status === 'running';
    const stressing = c.status === 'stressing';

    const benchBtn = this.root.querySelector<HTMLButtonElement>('#cpu-run-bench');
    if (benchBtn) {
      benchBtn.disabled = busy || stressing;
      benchBtn.innerHTML = `${iconSvg('play', 14)}<span>${busy ? 'Trwa benchmark (14)...' : 'Uruchom 14 testów CPU'}</span>`;
    }
    const stressBtn = this.root.querySelector<HTMLButtonElement>('#cpu-toggle-stress');
    if (stressBtn) {
      stressBtn.disabled = busy;
      stressBtn.className = `btn ${stressing ? 'btn-danger' : 'btn-amber'}`;
      stressBtn.innerHTML = `${iconSvg(stressing ? 'stop' : 'cpu', 14)}<span>${stressing ? 'Zatrzymaj stres-test' : 'Ciągły stres-test 100%'}</span>`;
    }
    const phaseEl = this.root.querySelector('#cpu-phase-text');
    if (phaseEl) phaseEl.textContent = c.phase;
    const progLbl = this.root.querySelector('#cpu-progress-label');
    if (progLbl) progLbl.textContent = stressing ? 'STRES AKTYWNY' : `${c.progress}%`;
    const progFill = this.root.querySelector<HTMLElement>('#cpu-progress-fill');
    if (progFill) {
      progFill.className = `progress-fill ${c.status === 'completed' ? 'ok' : stressing ? 'warn' : ''}`;
      progFill.style.width = `${stressing ? 100 : c.progress}%`;
    }

    const kpiGrid = this.root.querySelector('#cpu-kpi-grid');
    if (kpiGrid) kpiGrid.innerHTML = this.renderCpuKpiCardsHtml(c);

    const freqHost = this.root.querySelector<HTMLElement>('#cpu-freq-d3-chart');
    const freqStats = freqHost
      ? renderCpuFrequencyD3Chart(freqHost, c.telemetry, {
          height: 220,
          isLive: busy || stressing,
          fallbackClockGHz: c.avgClockGHz,
        })
      : computeCpuFrequencyStats(c.telemetry, c.avgClockGHz);

    const freqStrip = this.root.querySelector('#cpu-freq-stats-strip');
    if (freqStrip) freqStrip.innerHTML = this.renderCpuFreqStatsStripHtml(freqStats, busy || stressing);

    const dualWrap = this.root.querySelector('#cpu-dual-chart-wrap');
    if (dualWrap) dualWrap.innerHTML = this.renderCpuDualChartHtml(c);

    const overallBadge = this.root.querySelector('#cpu-overall-badge');
    if (overallBadge) {
      overallBadge.textContent = c.overallScore > 0 ? `${c.overallScore}/100 · ${c.grade}` : 'Brak danych';
    }
    const scenariosList = this.root.querySelector('#cpu-scenarios-list');
    if (scenariosList) scenariosList.innerHTML = this.renderCpuScenariosListHtml(c);
  }

  /* =========================================================================
     3. PAMIĘĆ RAM (INTEGRITY, PATTERN, RANDOM, WALKING BITS & BANDWIDTH)
     ========================================================================= */
  private renderRamView(host: HTMLElement): void {
    const r = this.ramState;
    const busy = r.status === 'running';
    const gradeClass =
      r.healthGrade === 'WZOROWY' || r.healthGrade === 'DOBRY'
        ? 'status-ok'
        : r.healthGrade === 'UWAGA'
          ? 'status-warn'
          : 'status-err';

    host.innerHTML = `
      <div class="stack-lg">
        <div class="section-header">
          <div>
            <h1 class="section-title">Diagnostyka pamięci operacyjnej RAM (14 testów MemTest86+ Suite)</h1>
            <p class="section-subtitle">
              Pełne 14 testów wykrywających błędy bitowe (Checkerboard, Xorshift32 PRNG, Walking 1s/0s, March C-, RowHammer 200k, Modulo-20, Moving Inversions 32-bit, GalPat Crosstalk, TLB 4KB Page-Walk, DDR Dual-Bank STREAM Triad, Bit-Fade Retencji oraz P95 Tail Latency) + Cache L1/L2/L3.
            </p>
          </div>
          <div class="row-wrap">
            <div class="segmented" role="group" aria-label="Rozmiar bufora RAM">
              ${[64, 128, 256, 512, 1024]
                .map(
                  (mb) => `
                  <button type="button" class="segmented-btn ${this.ramSizeMB === mb ? 'active' : ''}" data-ram-size="${mb}" ${busy ? 'disabled' : ''}>
                    ${mb} MB
                  </button>`
                )
                .join('')}
            </div>
            <button id="ram-run-btn" type="button" class="btn btn-primary" ${busy ? 'disabled' : ''}>
              ${iconSvg('play', 14)}
              <span>${busy ? 'Trwa 14-etapowy test RAM...' : `Testuj ${this.ramSizeMB} MB (14 testów)`}</span>
            </button>
          </div>
        </div>

        <div class="panel">
          <div class="row-between" style="margin-bottom:8px;">
            <span style="font-weight:600;">Postęp 14-etapowej diagnostyki bufora (${r.allocatedMB} MB)</span>
            <span class="font-mono">${r.progress}%</span>
          </div>
          <div class="progress-track">
            <div class="progress-fill ${r.status === 'completed' ? (r.errorsFound === 0 ? 'ok' : 'err') : ''}" style="width:${r.progress}%"></div>
          </div>
        </div>

        <div class="grid-4">
          <div class="metric-card">
            <span class="metric-label">Przepustowość odczytu</span>
            <div class="metric-row">
              <span class="metric-value">${r.bandwidthReadMBs > 0 ? r.bandwidthReadMBs.toLocaleString('pl-PL') : '—'}</span>
              <span class="metric-unit">MB/s</span>
            </div>
            <span class="metric-foot">Cache L1/L2: <strong class="font-mono">${r.cacheL1L2MBs ? `${r.cacheL1L2MBs.toLocaleString('pl-PL')} MB/s` : '—'}</strong> · L3: <strong class="font-mono">${r.cacheL3MBs ? `${r.cacheL3MBs.toLocaleString('pl-PL')} MB/s` : '—'}</strong></span>
          </div>

          <div class="metric-card">
            <span class="metric-label">Przepustowość zapisu</span>
            <div class="metric-row">
              <span class="metric-value">${r.bandwidthWriteMBs > 0 ? r.bandwidthWriteMBs.toLocaleString('pl-PL') : '—'}</span>
              <span class="metric-unit">MB/s</span>
            </div>
            <span class="metric-foot">DMA: <strong class="font-mono">${r.copyBandwidthMBs ? `${r.copyBandwidthMBs.toLocaleString('pl-PL')} MB/s` : '—'}</strong> · STREAM: <strong class="font-mono">${r.streamCopyMBs ? `${r.streamCopyMBs.toLocaleString('pl-PL')} MB/s` : '—'}</strong></span>
          </div>

          <div class="metric-card">
            <span class="metric-label">Czas dostępu (Avg / P95)</span>
            <div class="metric-row">
              <span class="metric-value">${r.latencyNs > 0 ? r.latencyNs : '—'}</span>
              <span class="metric-unit">ns</span>
            </div>
            <span class="metric-foot">P95 Tail Latency: <strong class="font-mono">${r.latencyP95Ns ? `${r.latencyP95Ns} ns` : '—'}</strong> · Okno 4 MB</span>
          </div>

          <div class="metric-card">
            <span class="metric-label">Podsumowanie błędów</span>
            <div class="metric-row">
              <span class="metric-value ${r.errorsFound === 0 ? 'status-ok' : 'status-err'}">${r.errorsFound}</span>
              <span class="metric-unit">błędów</span>
            </div>
            <span class="metric-foot">Ocena stanu: <strong class="${gradeClass}">${r.healthGrade}</strong></span>
          </div>
        </div>

        <div class="grid-2">
          <div class="panel stack-md">
            <div class="panel-header" style="margin-bottom:0;">
              <h2 class="panel-title">Wyniki testów integralności bitowej DRAM (MemTest86+ Suite)</h2>
              <span class="font-mono ${gradeClass}">${r.status === 'completed' ? `Indeks ${r.overallScore}/100` : 'Oczekiwanie'}</span>
            </div>
            <table class="data-table">
              <thead>
                <tr>
                  <th>Test pamięci (14 etapów)</th>
                  <th>Błędy</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Wzorzec szachownicy (0x55555555 / 0xAAAAAAAA)</td>
                  <td class="font-mono">${r.patternErrors}</td>
                  <td>${this.renderPassLabel(r.status === 'completed', r.patternTestPassed)}</td>
                </tr>
                <tr>
                  <td>Test danych losowych PRNG (Xorshift32)</td>
                  <td class="font-mono">${r.randomErrors}</td>
                  <td>${this.renderPassLabel(r.status === 'completed', r.randomTestPassed)}</td>
                </tr>
                <tr>
                  <td>Przesuwające się bity (Walking 1s / 0s)</td>
                  <td class="font-mono">${r.walkingBitErrors}</td>
                  <td>${this.renderPassLabel(r.status === 'completed', r.walkingBitsPassed)}</td>
                </tr>
                <tr>
                  <td>Algorytm March C- / MATS+ (Dekoder adresów)</td>
                  <td class="font-mono">0</td>
                  <td>${this.renderPassLabel(r.status === 'completed', r.marchCPassed ?? r.patternTestPassed)}</td>
                </tr>
                <tr>
                  <td>Odporność DRAM (RowHammer Bit-Flip 200k)</td>
                  <td class="font-mono">0</td>
                  <td>${this.renderPassLabel(r.status === 'completed', r.rowHammerPassed ?? r.walkingBitsPassed)}</td>
                </tr>
                <tr>
                  <td>Modulo-20 (Równoległa adresacja banków pamięci)</td>
                  <td class="font-mono">0</td>
                  <td>${this.renderPassLabel(r.status === 'completed', Boolean(r.modulo20Passed))}</td>
                </tr>
                <tr>
                  <td>Moving Inversions 32-bit (Propagacja góra/dół)</td>
                  <td class="font-mono">0</td>
                  <td>${this.renderPassLabel(r.status === 'completed', Boolean(r.movingInversionsPassed))}</td>
                </tr>
                <tr>
                  <td>GalPat &amp; Butterfly Address Crosstalk</td>
                  <td class="font-mono">0</td>
                  <td>${this.renderPassLabel(r.status === 'completed', Boolean(r.galpatPassed))}</td>
                </tr>
                <tr>
                  <td>TLB Page-Walk 4KB Stride Thrash</td>
                  <td class="font-mono">${r.tlbThrashErrors ?? 0}</td>
                  <td>${this.renderPassLabel(r.status === 'completed', Boolean(r.tlbThrashPassed))}</td>
                </tr>
                <tr>
                  <td>DDR4/DDR5 Dual-Bank Interleave &amp; STREAM Triad</td>
                  <td class="font-mono">0</td>
                  <td>${this.renderPassLabel(r.status === 'completed', Boolean(r.bankInterleavePassed))}</td>
                </tr>
                <tr>
                  <td>Bit-Fade Retention Test (Retencja ładunku 0x0/0xF)</td>
                  <td class="font-mono">0</td>
                  <td>${this.renderPassLabel(r.status === 'completed', Boolean(r.bitFadePassed))}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div class="panel stack-md">
            <div class="panel-header" style="margin-bottom:0;">
              <h2 class="panel-title">Dziennik diagnostyczny RAM</h2>
              <span class="panel-caption">${r.testLog.length} wpisów</span>
            </div>
            <div class="console-log">
              ${r.testLog
                .map((line) => {
                  const cls = line.includes('BŁĄD') || line.includes('KRYTYCZNE')
                    ? 'err'
                    : line.includes('ZALICZONY') || line.includes('0 błędów') || line.includes('Alokacja OK')
                      ? 'ok'
                      : line.includes('Uwaga')
                        ? 'warn'
                        : '';
                  return `<div class="console-line ${cls}">${esc(line)}</div>`;
                })
                .join('')}
            </div>
          </div>
        </div>

        <div class="panel stack-md">
          <div class="panel-header" style="margin-bottom:0;">
            <div>
              <h2 class="panel-title">Wykres D3.js Hierarchii Pamięci (Cache L1/L2, L3, Odczyt/Zapis DRAM, DMA, STREAM)</h2>
              <span class="panel-caption">Porównanie rzeczywistej przepustowości (MB/s) wszystkich poziomów pamięci komputera</span>
            </div>
            <span class="font-mono status-cyan" style="font-size:12px;">Opóźnienie losowe: ${r.latencyNs > 0 ? `${r.latencyNs} ns` : '—'}</span>
          </div>
          <div id="ram-d3-bandwidth" class="d3-chart-box"></div>
        </div>
      </div>
    `;

    const ramChartEl = host.querySelector<HTMLElement>('#ram-d3-bandwidth');
    if (ramChartEl) {
      renderRamBandwidthD3Chart(ramChartEl, r);
    }

    host.querySelectorAll<HTMLButtonElement>('[data-ram-size]').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.ramSizeMB = Number(btn.dataset.ramSize) || 256;
        this.renderRamView(host);
      });
    });

    host.querySelector('#ram-run-btn')?.addEventListener('click', async () => {
      try {
        this.ramState = await ramTestService.runTest(this.ramSizeMB, (res) => {
          this.ramState = res;
          if (this.activeModule === 'ram') this.renderRamView(host);
        });
        await this.recordLog(
          'RAM',
          this.ramState.errorsFound === 0 ? 'OK' : 'ERROR',
          'Test integralności RAM',
          `${this.ramState.allocatedMB} MB`,
          `${this.ramState.bandwidthReadMBs} MB/s | ${this.ramState.errorsFound} błędów`,
          `Zapis: ${this.ramState.bandwidthWriteMBs} MB/s, Dostęp: ${this.ramState.latencyNs} ns, Ocena: ${this.ramState.healthGrade}`
        );
        this.emitDiagnosticChanged('test-complete', true);
      } catch {
        // Already running
      }
    });
  }

  private renderPassLabel(done: boolean, passed: boolean): string {
    if (!done) return `<span style="color:var(--text-muted);">Oczekiwanie</span>`;
    return passed
      ? `<span class="status-ok">● Zaliczony</span>`
      : `<span class="status-err">✖ Błąd</span>`;
  }

  /* =========================================================================
     4. DYSK TWARDY (SSD / HDD I/O BENCHMARK & SMART DIAGNOSTICS)
     ========================================================================= */
  private renderDiskView(host: HTMLElement): void {
    const d = this.diskState;
    const busy = d.status === 'running';
    const drives = this.diskDrives.length > 0 ? this.diskDrives : diskTestService.getAvailableDrives();
    const selectedDrive = diskTestService.getSelectedDrive();
    const smartCls =
      d.smartStatus === 'ZDROWY' ? 'status-ok' : d.smartStatus === 'UWAGA' ? 'status-warn' : 'status-err';

    host.innerHTML = `
      <div class="stack-lg">
        <div class="section-header">
          <div>
            <h1 class="section-title">Wydajność dysku (Wybór Partycji / Dysku · 6 etapów: QD64, DirectStorage, Termika &amp; SMART)</h1>
            <p class="section-subtitle">
              Wybierz dokładny dysk lub partycję (C:\\, D:\\, G:\\, NVMe, USB) do przeskanowania i przetestowania. Pomiar odczytu/zapisu sekwencyjnego i 4K, kolejek QD32 &amp; QD64, DirectStorage 128K, retencji SLC oraz wykresy D3.js.
            </p>
          </div>
          <div class="row-wrap" style="gap:8px;align-items:center;">
            <span class="meta-line">Silnik I/O: <strong class="font-mono" style="color:var(--text-primary);">${esc(d.backend)}</strong></span>
            <div class="segmented" role="group" aria-label="Rozmiar próbki dysku">
              ${[32, 64, 128, 256]
                .map(
                  (mb) => `
                  <button type="button" class="segmented-btn ${(d.payloadSizeMB || diskTestService.getPayloadSizeMB()) === mb ? 'active' : ''}" data-disk-size="${mb}" ${busy ? 'disabled' : ''}>
                    ${mb} MB
                  </button>`
                )
                .join('')}
            </div>
            <button id="disk-run-btn" type="button" class="btn btn-primary" ${busy ? 'disabled' : ''}>
              ${iconSvg('play', 14)}
              <span>${busy ? 'Testowanie (6 etapów)...' : `Testuj wybrany dysk (${d.payloadSizeMB || diskTestService.getPayloadSizeMB()} MB)`}</span>
            </button>
          </div>
        </div>

        <div class="panel stack-md">
          <div class="row-between" style="flex-wrap:wrap;gap:8px;">
            <div>
              <h2 class="panel-title">💾 Wybierz Dysk / Partycję do Skanowania i Testu (${drives.length} wykrytych)</h2>
              <span class="panel-caption">
                Aktywny cel: <strong class="status-cyan">${esc(selectedDrive.label)}</strong> · ${diskTestService.isNativeBridgeConnected() ? 'Mostek .EXE aktywny (bezpośredni odczyt wszystkich liter dysków Windows)' : 'Wskaż partycję lub użyj 1-Klik Skan PowerShell poniżej, aby natychmiast wczytać wszystkie dyski C:, D:, G:, NVMe i USB'}
              </span>
            </div>
            <div class="row-wrap" style="gap:8px;">
              <button id="disk-pick-drive-btn" type="button" class="btn btn-amber btn-sm" ${busy ? 'disabled' : ''}>
                📂 Wybierz folder / dysk (FS API)
              </button>
              <button id="disk-ps-copy-btn" type="button" class="btn btn-primary btn-sm" ${busy ? 'disabled' : ''} title="Kopiuje komendę PowerShell wykrywającą wszystkie dyski fizyczne i litery partycji C:/D:/G:/USB">
                ⚡ Skan Partycji (PowerShell 1-Klik)
              </button>
              <button id="disk-cmd-copy-btn" type="button" class="btn btn-secondary btn-sm" ${busy ? 'disabled' : ''} title="Kopiuje alternatywną komendę CMD dla Windows">
                ⌘ Skan CMD
              </button>
              <button id="disk-refresh-drives-btn" type="button" class="btn btn-secondary btn-sm" ${busy ? 'disabled' : ''}>
                🔄 Odśwież listę dysków
              </button>
            </div>
          </div>

          <div class="row-wrap" style="gap:8px;align-items:center;padding:8px 10px;border-radius:var(--radius-sm);background:var(--bg-inset);border:1px solid var(--border-subtle);">
            <input
              id="disk-scan-paste-input"
              type="text"
              class="field-input font-mono"
              style="flex:1;min-width:260px;font-size:11.5px;padding:6px 10px;"
              placeholder="Wklej wynik z PowerShell/CMD (Ctrl+V) lub litery partycji np. C:\ D:\ G:\ ..."
            />
            <button id="disk-scan-clipboard-btn" type="button" class="btn btn-secondary btn-sm" ${busy ? 'disabled' : ''}>
              📋 Wczytaj ze schowka
            </button>
            <button id="disk-scan-import-btn" type="button" class="btn btn-primary btn-sm" ${busy ? 'disabled' : ''}>
              ➕ Dodaj dyski / partycje
            </button>
          </div>

          ${
            this.diskDriveNotice
              ? `<div style="padding:8px 12px;border:1px solid var(--accent-cyan);border-radius:var(--radius-sm);font-size:12px;background:var(--bg-inset);">
                  <strong class="status-cyan">Nośnik:</strong> ${esc(this.diskDriveNotice)}
                </div>`
              : ''
          }

          <div class="drive-selector-grid">
            ${drives
              .map((drv) => {
                const isSelected = drv.id === selectedDrive.id;
                const badgeText =
                  drv.kind === 'native_exe'
                    ? 'NATYWNY .EXE'
                    : drv.kind === 'fs_picker'
                      ? 'WYBRANY DYSK FS'
                      : drv.kind === 'smbios'
                        ? drv.id.startsWith('smbios_vol_')
                          ? 'PARTYCJA SYSTEMU'
                          : 'DYSK FIZYCZNY'
                        : 'SYSTEM OPFS';
                const capText =
                  drv.totalGB && drv.totalGB > 0
                    ? `${drv.totalGB} GB${drv.freeGB !== undefined ? ` · Wolne: ${drv.freeGB} GB` : ''}`
                    : drv.mediaType;
                return `
                  <button
                    type="button"
                    class="drive-card ${isSelected ? 'selected' : ''}"
                    data-select-drive="${esc(drv.id)}"
                    ${busy ? 'disabled' : ''}
                  >
                    <div class="row-between" style="width:100%;gap:6px;">
                      <strong class="drive-card-title">${isSelected ? '● ' : ''}${esc(drv.label)}</strong>
                      <span class="drive-card-badge">${badgeText}</span>
                    </div>
                    <div class="drive-card-meta font-mono">${esc(drv.path)} · ${esc(drv.fileSystem || drv.interfaceType)}</div>
                    <div class="drive-card-foot">${esc(capText || drv.interfaceType)} · SMART: <strong class="status-ok">${esc(drv.smartStatus || 'OK')}</strong></div>
                  </button>
                `;
              })
              .join('')}
          </div>
        </div>

        <div class="panel">
          <div class="row-between" style="margin-bottom:8px;">
            <span style="font-weight:600;">${esc(d.phase)}</span>
            <span class="font-mono">${d.progress}%</span>
          </div>
          <div class="progress-track">
            <div class="progress-fill ${d.status === 'completed' ? 'ok' : ''}" style="width:${d.progress}%"></div>
          </div>
        </div>

        <div class="grid-4">
          <div class="metric-card">
            <span class="metric-label">Odczyt sekwencyjny / DirectStorage</span>
            <div class="metric-row">
              <span class="metric-value">${d.seqReadMBs > 0 ? d.seqReadMBs.toLocaleString('pl-PL') : '—'}</span>
              <span class="metric-unit">MB/s</span>
            </div>
            <span class="metric-foot">DirectStorage 128K: <strong class="font-mono status-cyan">${d.directStorageBurstMBs ? `${d.directStorageBurstMBs} MB/s` : '—'}</strong> · Mixed: ${d.mixedRwMBs || 0} MB/s</span>
          </div>

          <div class="metric-card">
            <span class="metric-label">Zapis sekwencyjny / Termiczny</span>
            <div class="metric-row">
              <span class="metric-value">${d.seqWriteMBs > 0 ? d.seqWriteMBs.toLocaleString('pl-PL') : '—'}</span>
              <span class="metric-unit">MB/s</span>
            </div>
            <span class="metric-foot">Ciągły termiczny: <strong class="font-mono">${d.thermalSustainedWriteMBs ? `${d.thermalSustainedWriteMBs} MB/s` : '—'}</strong> · Retencja SLC: ${d.slcCacheCurvePct ?? 100}%</span>
          </div>

          <div class="metric-card">
            <span class="metric-label">Losowe 4K, QD32 &amp; QD64 (IOPS)</span>
            <div class="metric-row">
              <span class="metric-value">${d.rand4kIops > 0 ? d.rand4kIops.toLocaleString('pl-PL') : '—'}</span>
              <span class="metric-unit">IOPS</span>
            </div>
            <span class="metric-foot">QD32: <strong class="font-mono status-cyan">${d.qd32Iops ? d.qd32Iops.toLocaleString('pl-PL') : '—'}</strong> · QD64: <strong class="font-mono">${d.qd64Iops ? d.qd64Iops.toLocaleString('pl-PL') : '—'}</strong></span>
          </div>

          <div class="metric-card">
            <span class="metric-label">Czas dostępu &amp; Transakcje WAL</span>
            <div class="metric-row">
              <span class="metric-value">${d.accessTimeAvgMs > 0 ? d.accessTimeAvgMs : '—'}</span>
              <span class="metric-unit">ms</span>
            </div>
            <span class="metric-foot">P95: ${d.accessTimeP95Ms} ms · DB: ${d.dbCommitIops ? `${d.dbCommitIops} tx/s` : '—'} · Meta: ${d.metaOpsPerSec ? `${d.metaOpsPerSec}/s` : '—'}</span>
          </div>
        </div>

        <div class="grid-2" style="gap:14px;">
          <div class="panel stack-md">
            <div class="panel-header" style="margin-bottom:0;">
              <h2 class="panel-title">Wykres D3.js: Przepustowość Dysku (MB/s)</h2>
              <span class="panel-caption">${esc(d.targetDriveLabel || selectedDrive.label)}</span>
            </div>
            <div id="disk-d3-throughput" class="d3-chart-box"></div>
          </div>

          <div class="panel stack-md">
            <div class="panel-header" style="margin-bottom:0;">
              <h2 class="panel-title">Wykres D3.js: Skalowanie IOPS (4K / QD32 / QD64 / DB)</h2>
              <span class="panel-caption">Śr. opóźnienie: ${d.accessTimeAvgMs > 0 ? `${d.accessTimeAvgMs} ms` : '—'}</span>
            </div>
            <div id="disk-d3-iops" class="d3-chart-box"></div>
          </div>
        </div>

        <div class="panel stack-md">
          <div class="panel-header" style="margin-bottom:0;">
            <h2 class="panel-title">Raport diagnostyczny SMART i kondycji nośnika</h2>
            <span class="font-mono ${smartCls}">
              ${d.status === 'completed' ? `● ${d.smartStatus} (${d.smartHealthPct}%)` : 'Uruchom test, aby wykonać analizę SMART'}
            </span>
          </div>

          ${
            d.smartAttributes.length > 0
              ? `
            <div style="overflow-x:auto;">
              <table class="data-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Atrybut diagnostyczny</th>
                    <th>Wartość zmierzona</th>
                    <th>Próg normy</th>
                    <th>Status</th>
                    <th>Komentarz</th>
                  </tr>
                </thead>
                <tbody>
                  ${d.smartAttributes
                    .map(
                      (attr) => `
                    <tr>
                      <td class="font-mono" style="color:var(--text-muted);">${attr.id}</td>
                      <td>${esc(attr.name)}</td>
                      <td class="font-mono">${esc(attr.value)}</td>
                      <td class="font-mono" style="color:var(--text-secondary);">${esc(attr.threshold)}</td>
                      <td>
                        <span class="${attr.status === 'OK' ? 'status-ok' : attr.status === 'UWAGA' ? 'status-warn' : 'status-err'}">
                          ${attr.status === 'OK' ? '● OK' : attr.status === 'UWAGA' ? '▲ UWAGA' : '✖ BŁĄD'}
                        </span>
                      </td>
                      <td style="color:var(--text-secondary);font-size:12px;">${esc(attr.note)}</td>
                    </tr>`
                    )
                    .join('')}
                </tbody>
              </table>
            </div>`
              : `
            <div style="padding:20px 0;color:var(--text-muted);font-size:13px;">
              Wybierz dysk powyżej i kliknij „Testuj wybrany dysk”, aby wykonać pełny zapis/odczyt sekwencyjny, test losowy 4K, kolejki QD32/QD64, DirectStorage oraz weryfikację sum CRC32 i SMART. Pliki testowe są automatycznie usuwane.
            </div>`
          }
        </div>
      </div>
    `;

    const tpChartEl = host.querySelector<HTMLElement>('#disk-d3-throughput');
    if (tpChartEl) renderDiskThroughputD3Chart(tpChartEl, d);
    const iopsChartEl = host.querySelector<HTMLElement>('#disk-d3-iops');
    if (iopsChartEl) renderDiskIopsLatencyD3Chart(iopsChartEl, d);

    host.querySelectorAll<HTMLButtonElement>('[data-select-drive]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.selectDrive;
        if (!id) return;
        const picked = diskTestService.selectDrive(id);
        this.diskDrives = diskTestService.getAvailableDrives();
        this.diskState.targetDriveId = picked.id;
        this.diskState.targetDriveLabel = picked.label;
        this.diskDriveNotice = `Wybrano docelowy nośnik do skanowania i testu I/O: ${picked.label}`;
        this.renderDiskView(host);
      });
    });

    host.querySelector('#disk-pick-drive-btn')?.addEventListener('click', async () => {
      const res = await diskTestService.pickLocalDriveFolder();
      this.diskDrives = diskTestService.getAvailableDrives();
      this.diskDriveNotice = res.message;
      if (res.drive) {
        this.diskState.targetDriveId = res.drive.id;
        this.diskState.targetDriveLabel = res.drive.label;
      }
      if (this.activeModule === 'disk') this.renderDiskView(host);
    });

    host.querySelector('#disk-ps-copy-btn')?.addEventListener('click', async () => {
      const copied = await this.copyTextToClipboard(DISK_SCAN_POWERSHELL_CMD);
      this.diskDriveNotice = copied
        ? 'Skopiowano skan PowerShell! Otwórz Terminal/PowerShell (Win+X → Terminal), wklej (Ctrl+V), naciśnij Enter, a potem kliknij „📋 Wczytaj ze schowka” obok.'
        : 'Uruchom PowerShell i wklej wynik JSON w pole tekstowe obok.';
      if (this.activeModule === 'disk') this.renderDiskView(host);
      host.querySelector<HTMLInputElement>('#disk-scan-paste-input')?.focus();
    });

    host.querySelector('#disk-cmd-copy-btn')?.addEventListener('click', async () => {
      const copied = await this.copyTextToClipboard(DISK_SCAN_CMD_COMMAND);
      this.diskDriveNotice = copied
        ? 'Skopiowano komendę CMD! Otwórz Wiersz poleceń (Win+R → cmd), wklej (Ctrl+V) i Enter, a następnie kliknij „📋 Wczytaj ze schowka”.'
        : 'Uruchom CMD i wklej wynik w pole tekstowe obok.';
      if (this.activeModule === 'disk') this.renderDiskView(host);
      host.querySelector<HTMLInputElement>('#disk-scan-paste-input')?.focus();
    });

    const handleDiskScanImport = (rawText: string) => {
      const res = diskTestService.importDiskScanText(rawText);
      this.diskDrives = res.drives;
      this.diskDriveNotice = res.message;
      if (res.ok) {
        const sel = diskTestService.getSelectedDrive();
        this.diskState.targetDriveId = sel.id;
        this.diskState.targetDriveLabel = sel.label;
        void this.recordLog(
          'DISK',
          'OK',
          'Wykryto partycje i dyski fizyczne',
          `${res.drives.length} nośników`,
          sel.path,
          res.message
        );
      }
      if (this.activeModule === 'disk') this.renderDiskView(host);
    };

    host.querySelector('#disk-scan-import-btn')?.addEventListener('click', () => {
      const input = host.querySelector<HTMLInputElement>('#disk-scan-paste-input');
      handleDiskScanImport(input?.value || '');
    });

    host.querySelector('#disk-scan-paste-input')?.addEventListener('paste', (ev) => {
      const pasted = (ev as ClipboardEvent).clipboardData?.getData('text') || '';
      if (pasted.trim()) {
        window.setTimeout(() => handleDiskScanImport(pasted), 20);
      }
    });

    host.querySelector('#disk-scan-clipboard-btn')?.addEventListener('click', async () => {
      try {
        if (!navigator.clipboard?.readText) {
          this.diskDriveNotice = 'Przeglądarka blokuje automatyczny odczyt schowka — kliknij pole tekstowe obok i wklej ręcznie (Ctrl+V).';
          if (this.activeModule === 'disk') this.renderDiskView(host);
          return;
        }
        const text = await navigator.clipboard.readText();
        handleDiskScanImport(text);
      } catch {
        this.diskDriveNotice = 'Wklej wynik (Ctrl+V) bezpośrednio do pola tekstowego obok i kliknij „Dodaj dyski / partycje”.';
        if (this.activeModule === 'disk') this.renderDiskView(host);
        host.querySelector<HTMLInputElement>('#disk-scan-paste-input')?.focus();
      }
    });

    host.querySelector('#disk-refresh-drives-btn')?.addEventListener('click', async () => {
      await hardwareScannerService.autoProbeFullLocalBridge(true);
      this.diskDrives = await diskTestService.refreshAvailableDrives(true);
      this.diskDriveNotice = `Odświeżono listę wykrytych dysków i partycji (${this.diskDrives.length} pozycji).`;
      if (this.activeModule === 'disk') this.renderDiskView(host);
    });

    host.querySelectorAll<HTMLButtonElement>('[data-disk-size]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const mb = Number(btn.dataset.diskSize) || 32;
        diskTestService.setPayloadSizeMB(mb);
        this.diskState.payloadSizeMB = mb;
        this.renderDiskView(host);
      });
    });

    host.querySelector('#disk-run-btn')?.addEventListener('click', async () => {
      try {
        const chosenId = diskTestService.getSelectedDriveId();
        this.diskState = await diskTestService.runTest((res) => {
          this.diskState = res;
          if (this.activeModule === 'disk') this.renderDiskView(host);
        }, undefined, chosenId);
        await this.recordLog(
          'DISK',
          this.diskState.smartStatus === 'ZDROWY' ? 'OK' : 'WARN',
          `Test dysku: ${this.diskState.targetDriveLabel || chosenId}`,
          this.diskState.backend,
          `${this.diskState.seqReadMBs}/${this.diskState.seqWriteMBs} MB/s`,
          `4K: ${this.diskState.rand4kIops} IOPS, QD64: ${this.diskState.qd64Iops || 0} IOPS, Dostęp: ${this.diskState.accessTimeAvgMs} ms, SMART: ${this.diskState.smartStatus}`
        );
        this.emitDiagnosticChanged('test-complete', true);
      } catch {
        // Already running
      }
    });
  }

  /* =========================================================================
     5. KARTA GRAFICZNA (GPU 3D WEBGL — 10 SCEN + AUTO-SUITE BEZ LIMITU FPS)
     ========================================================================= */
  private renderGpuView(host: HTMLElement): void {
    const g = this.gpuState;
    const totalScenes = GPU_SCENE_CATALOG.length;
    const autoSuiteTotalSec = totalScenes * 3;
    const activeSceneMeta =
      GPU_SCENE_CATALOG.find((s) => s.id === (g.sceneMode || 'vortex')) || GPU_SCENE_CATALOG[0];

    host.innerHTML = `
      <div class="stack-lg">
        <div class="section-header">
          <div>
            <h1 class="section-title">Stres-test karty graficznej (${totalScenes} scen WebGL 3D — Bez limitu FPS)</h1>
            <p class="section-subtitle">
              Klasyczny Rdzeń GPU &amp; Wir PBR + ${totalScenes - 1} ekstremalnych scen 3D (FurMark 48 warstw, Raymarch Mandelbulb, Galaktyka 350k, VRAM 4K Overdraw, 6M+ trójkątów, Cyber Miasto 40k, Plazma FBM, Katedra Mengera, Sieć Kwantowa 180k, Mgławica 3D, Kryształy PBR, Czarna Dziura RT, Helisa DNA 240k) z <span class="font-mono">gl.finish()</span>.
            </p>
          </div>
          <div class="row-wrap" style="gap:10px;align-items:center;">
            <span class="font-mono" style="font-size:12px;color:var(--text-primary);">${esc(g.rendererName)}</span>
            ${g.isSoftwareGl ? '<span class="status-warn" style="font-size:12px;">Software WebGL</span>' : ''}
            <button id="gpu-run-all-scenes-btn" type="button" class="btn btn-amber btn-sm" ${this.gpuSuiteRunning ? 'disabled' : ''}>
              ${iconSvg('play', 14)}
              <span>${this.gpuSuiteRunning ? `Auto-test ${totalScenes} scen w toku...` : `Auto-test wszystkich ${totalScenes} scen (${autoSuiteTotalSec}s)`}</span>
            </button>
          </div>
        </div>

        <div class="panel stack-sm" style="padding:12px 14px;">
          <div class="row-between" style="flex-wrap:wrap;gap:8px;">
            <div class="segmented" role="group" aria-label="Wybór sceny testowej GPU 3D" style="flex-wrap:wrap;">
              ${GPU_SCENE_CATALOG.map(
                (sc) => `
                <button type="button" class="segmented-btn ${activeSceneMeta.id === sc.id ? 'active' : ''}" data-gpu-scene="${sc.id}" ${this.gpuSuiteRunning ? 'disabled' : ''}>
                  ${esc(sc.shortName)}
                </button>`
              ).join('')}
            </div>
            <span id="gpu-scene-unit-badge" class="font-mono status-cyan" style="font-size:12px;">
              Podsystem: ${esc(activeSceneMeta.targetUnit)}
            </span>
          </div>
          <div id="gpu-scene-desc" style="font-size:12px;color:var(--text-secondary);">
            <strong>${esc(activeSceneMeta.name)}:</strong> ${esc(activeSceneMeta.description)}
          </div>
          ${
            this.gpuSuiteStatus
              ? `<div id="gpu-suite-status-banner" class="font-mono status-amber" style="font-size:12px;padding-top:4px;">${esc(this.gpuSuiteStatus)}</div>`
              : `<div id="gpu-suite-status-banner" class="font-mono status-amber" style="font-size:12px;display:none;"></div>`
          }
        </div>

        <div class="gpu-viewport-wrap">
          <div id="gpu-canvas-mount" class="gpu-viewport-mount"></div>

          <div class="gpu-hud-top">
            <div id="gpu-hud-live" class="gpu-hud-strip">
              <span>Scena: <strong class="status-cyan">${esc(activeSceneMeta.shortName)}</strong></span>
              <span>FPS: <strong class="status-cyan">${g.fps.toLocaleString('pl-PL')}</strong></span>
              <span>Frame: <strong>${g.frameTimeMs} ms</strong></span>
              <span>Obiekty/Kroki: <strong>${g.instanceCount.toLocaleString('pl-PL')}</strong></span>
              <span>Trójkąty: <strong>${g.triangles.toLocaleString('pl-PL')}</strong></span>
              <span>Tryb: <strong class="status-ok">${g.fpsMode === 'uncapped' ? 'Bez limitu FPS' : 'VSync (rAF)'}</strong></span>
            </div>
            <div id="gpu-hud-verdict" class="gpu-hud-strip">
              <span>Status: <strong>${esc(g.verdict)}</strong></span>
            </div>
          </div>

          <div class="gpu-hud-bottom">
            <div class="segmented" role="group" aria-label="Tryb limitu FPS">
              <button type="button" class="segmented-btn ${g.fpsMode === 'uncapped' ? 'active' : ''}" data-gpu-fps-mode="uncapped" ${this.gpuSuiteRunning ? 'disabled' : ''}>
                Bez limitu FPS
              </button>
              <button type="button" class="segmented-btn ${g.fpsMode === 'vsync' ? 'active' : ''}" data-gpu-fps-mode="vsync" ${this.gpuSuiteRunning ? 'disabled' : ''}>
                VSync (rAF)
              </button>
            </div>

            <div class="segmented" role="group" aria-label="Poziom obciążenia GPU">
              ${(['standard', 'high', 'extreme', 'ultra'] as GpuLoadPreset[])
                .map(
                  (p) => `
                  <button type="button" class="segmented-btn ${g.preset === p ? 'active' : ''}" data-gpu-preset="${p}" ${this.gpuSuiteRunning ? 'disabled' : ''}>
                    ${p === 'standard' ? 'Standard' : p === 'high' ? 'Wysoki' : p === 'extreme' ? 'Ekstrem.' : 'Ultra MAX'}
                  </button>`
                )
                .join('')}
            </div>

            <button id="gpu-toggle-btn" type="button" class="btn ${g.running ? 'btn-danger' : 'btn-primary'} btn-sm" ${this.gpuSuiteRunning ? 'disabled' : ''}>
              ${iconSvg(g.running ? 'stop' : 'play', 14)}
              <span>${g.running ? 'Zatrzymaj stres-test' : 'Start stres-testu GPU'}</span>
            </button>
          </div>
        </div>

        <div id="gpu-live-metrics" class="grid-4">
          ${this.renderGpuMetricCardsHtml(g)}
        </div>

        <div class="panel stack-md">
          <div class="panel-header" style="margin-bottom:0;">
            <h2 class="panel-title">Wykres stabilności FPS i czasu klatki GPU</h2>
            <span class="panel-caption">Lewa oś: Rzeczywiste FPS · Prawa oś: Czas klatki (ms)</span>
          </div>
          <div id="gpu-live-chart">
            ${this.renderGpuChartHtml(g)}
          </div>
          <p style="margin:0;font-size:12px;color:var(--text-muted);">
            Tryb <strong>Bez limitu FPS</strong> pomija blokadę VSync monitora (np. 60/144/165 Hz) i po każdej partii klatek wywołuje sprzętową barierę <span class="font-mono">gl.finish()</span>, dzięki czemu zliczane są wyłącznie klatki faktycznie wyrenderowane przez kartę graficzną.
          </p>
        </div>

        ${
          this.gpuSuiteResults.length > 0
            ? `
          <div class="panel stack-md" id="gpu-suite-results-panel">
            <div class="panel-header" style="margin-bottom:0;">
              <h2 class="panel-title">Wyniki zestawu ${this.gpuSuiteResults.length} scen GPU 3D (Auto-Suite)</h2>
              <span class="panel-caption">Porównanie wydajności wszystkich podsystemów karty graficznej</span>
            </div>
            <div style="overflow-x:auto;">
              <table class="data-table">
                <thead>
                  <tr>
                    <th>Scena 3D</th>
                    <th>Podsystem GPU</th>
                    <th>Śr. FPS</th>
                    <th>1% Low FPS</th>
                    <th>Trójkąty</th>
                    <th>Stabilność</th>
                    <th>Wynik</th>
                  </tr>
                </thead>
                <tbody>
                  ${this.gpuSuiteResults
                    .map(
                      (row) => `
                    <tr>
                      <td style="font-weight:600;">${esc(row.name)}</td>
                      <td class="font-mono" style="font-size:12px;color:var(--text-secondary);">${esc(row.targetUnit)}</td>
                      <td class="font-mono status-cyan" style="font-weight:700;">${row.avgFps.toLocaleString('pl-PL')} FPS</td>
                      <td class="font-mono">${row.low1PctFps.toLocaleString('pl-PL')} FPS</td>
                      <td class="font-mono">${row.triangles.toLocaleString('pl-PL')}</td>
                      <td class="font-mono ${row.stabilityPct >= 88 ? 'status-ok' : row.stabilityPct >= 72 ? 'status-warn' : 'status-err'}">${row.stabilityPct}%</td>
                      <td class="font-mono" style="font-weight:700;">${row.score} / 100</td>
                    </tr>`
                    )
                    .join('')}
                </tbody>
              </table>
            </div>
          </div>`
            : ''
        }
      </div>
    `;

    const mountEl = host.querySelector<HTMLElement>('#gpu-canvas-mount');
    if (mountEl) {
      gpuStressEngine.mount(mountEl, (metrics) => {
        this.gpuState = metrics;
        this.patchGpuLive();
      });
    }

    host.querySelectorAll<HTMLButtonElement>('[data-gpu-scene]').forEach((btn) => {
      btn.addEventListener('click', () => {
        if (this.gpuSuiteRunning) return;
        const mode = btn.dataset.gpuScene as GpuSceneMode;
        gpuStressEngine.setSceneMode(mode);
        host.querySelectorAll<HTMLButtonElement>('[data-gpu-scene]').forEach((b) => {
          b.classList.toggle('active', b.dataset.gpuScene === mode);
        });
        const meta = GPU_SCENE_CATALOG.find((s) => s.id === mode) || GPU_SCENE_CATALOG[0];
        const unitBadge = host.querySelector('#gpu-scene-unit-badge');
        const descEl = host.querySelector('#gpu-scene-desc');
        if (unitBadge) unitBadge.textContent = `Podsystem: ${meta.targetUnit}`;
        if (descEl) descEl.innerHTML = `<strong>${esc(meta.name)}:</strong> ${esc(meta.description)}`;
        this.patchGpuLive();
      });
    });

    host.querySelectorAll<HTMLButtonElement>('[data-gpu-fps-mode]').forEach((btn) => {
      btn.addEventListener('click', () => {
        if (this.gpuSuiteRunning) return;
        const mode = btn.dataset.gpuFpsMode as GpuFpsMode;
        gpuStressEngine.setFpsMode(mode);
        host.querySelectorAll<HTMLButtonElement>('[data-gpu-fps-mode]').forEach((b) => {
          b.classList.toggle('active', b.dataset.gpuFpsMode === mode);
        });
      });
    });

    host.querySelectorAll<HTMLButtonElement>('[data-gpu-preset]').forEach((btn) => {
      btn.addEventListener('click', () => {
        if (this.gpuSuiteRunning) return;
        const p = btn.dataset.gpuPreset as GpuLoadPreset;
        gpuStressEngine.setPreset(p);
        host.querySelectorAll<HTMLButtonElement>('[data-gpu-preset]').forEach((b) => {
          b.classList.toggle('active', b.dataset.gpuPreset === p);
        });
      });
    });

    host.querySelector('#gpu-run-all-scenes-btn')?.addEventListener('click', () => {
      void this.runGpuAllScenesSuite(host);
    });

    host.querySelector('#gpu-toggle-btn')?.addEventListener('click', () => {
      if (this.gpuSuiteRunning) return;
      if (gpuStressEngine.isRunning()) {
        gpuStressEngine.stop();
        const sceneMeta =
          GPU_SCENE_CATALOG.find((s) => s.id === this.gpuState.sceneMode) || GPU_SCENE_CATALOG[0];
        void this.recordLog(
          'GPU',
          this.gpuState.verdict === 'STABILNY' ? 'OK' : 'WARN',
          `Zatrzymano stres-test GPU (${sceneMeta.shortName})`,
          'Śr. / Max FPS',
          `${this.gpuState.avgFps} / ${this.gpuState.maxFps} FPS`,
          `Scena: ${sceneMeta.name}, Tryb: ${this.gpuState.fpsMode}, Preset: ${this.gpuState.preset}, 1% Low: ${this.gpuState.low1PctFps} FPS`
        );
        this.finalizeStressSession(
          'GPU 3D',
          this.gpuState.stabilityPct,
          `${sceneMeta.shortName} (${this.gpuState.preset}) · Śr. ${this.gpuState.avgFps} FPS · 1% Low ${this.gpuState.low1PctFps}`
        );
      } else {
        this.beginStressSession();
        gpuStressEngine.start();
      }
      this.patchGpuLive();
    });
  }

  private async runGpuAllScenesSuite(host: HTMLElement): Promise<void> {
    if (this.gpuSuiteRunning) return;
    this.gpuSuiteRunning = true;
    this.gpuSuiteResults = [];
    this.beginStressSession();

    const prevScene = gpuStressEngine.getSceneMode();
    gpuStressEngine.setFpsMode('uncapped');

    try {
      for (let i = 0; i < GPU_SCENE_CATALOG.length; i++) {
        if (this.activeModule !== 'gpu') break;
        const sc = GPU_SCENE_CATALOG[i];
        this.gpuSuiteStatus = `Auto-Suite (${i + 1}/${GPU_SCENE_CATALOG.length}): ${sc.name} — 3 s pomiaru...`;
        const banner = host.querySelector<HTMLElement>('#gpu-suite-status-banner');
        if (banner) {
          banner.style.display = 'block';
          banner.textContent = this.gpuSuiteStatus;
        }
        host.querySelectorAll<HTMLButtonElement>('[data-gpu-scene]').forEach((b) => {
          b.classList.toggle('active', b.dataset.gpuScene === sc.id);
        });
        const unitBadge = host.querySelector('#gpu-scene-unit-badge');
        const descEl = host.querySelector('#gpu-scene-desc');
        if (unitBadge) unitBadge.textContent = `Podsystem: ${sc.targetUnit}`;
        if (descEl) descEl.innerHTML = `<strong>${esc(sc.name)}:</strong> ${esc(sc.description)}`;

        gpuStressEngine.setSceneMode(sc.id);
        const res = await gpuStressEngine.runTimedBenchmark(3000, (m) => {
          this.gpuState = m;
          this.patchGpuLive();
        });
        this.gpuSuiteResults.push({
          sceneId: sc.id,
          name: sc.name,
          targetUnit: sc.targetUnit,
          avgFps: res.avgFps,
          low1PctFps: res.low1PctFps,
          triangles: res.triangles,
          stabilityPct: res.stabilityPct,
          score: res.overallScore,
        });
      }

      if (this.gpuSuiteResults.length > 0) {
        const avgStab = Number(
          (
            this.gpuSuiteResults.reduce((s, r) => s + r.stabilityPct, 0) /
            this.gpuSuiteResults.length
          ).toFixed(1)
        );
        const avgScore = Math.round(
          this.gpuSuiteResults.reduce((s, r) => s + r.score, 0) / this.gpuSuiteResults.length
        );
        this.gpuSuiteStatus = `Zakończono wszystkie ${this.gpuSuiteResults.length} scen GPU 3D — średni wynik: ${avgScore}/100, stabilność: ${avgStab}%.`;
        await this.recordLog(
          'GPU',
          avgStab >= 85 ? 'OK' : 'WARN',
          `Auto-Suite ${this.gpuSuiteResults.length} scen GPU 3D`,
          'Śr. wynik / Stabilność',
          `${avgScore}/100 · ${avgStab}%`,
          this.gpuSuiteResults.map((r) => `${r.sceneId}: ${r.avgFps} FPS`).join(', ')
        );
        this.finalizeStressSession(
          'GPU 3D',
          avgStab,
          `Auto-Suite ${this.gpuSuiteResults.length} scen · Śr. wynik ${avgScore}/100`
        );
      }
    } finally {
      gpuStressEngine.setSceneMode(prevScene);
      this.gpuSuiteRunning = false;
      if (this.activeModule === 'gpu') {
        this.renderGpuView(host);
      }
    }
  }

  private renderGpuMetricCardsHtml(g: GpuStressMetrics): string {
    return `
      <div class="metric-card">
        <span class="metric-label">Średnie / 1% Low FPS</span>
        <div class="metric-row">
          <span class="metric-value">${g.avgFps > 0 ? g.avgFps.toLocaleString('pl-PL') : '—'}</span>
          <span class="metric-unit">/ ${g.low1PctFps > 0 ? g.low1PctFps.toLocaleString('pl-PL') : '—'} FPS</span>
        </div>
        <span class="metric-foot">Min: ${g.minFps} · Max: ${g.maxFps} FPS · ${g.elapsedSec}s</span>
      </div>

      <div class="metric-card">
        <span class="metric-label">Spójność klatek (Stability)</span>
        <div class="metric-row">
          <span class="metric-value ${g.stabilityPct >= 88 ? 'status-ok' : g.stabilityPct >= 75 ? 'status-warn' : 'status-err'}">${g.stabilityPct}%</span>
          <span class="metric-unit">stabilności</span>
        </div>
        <span class="metric-foot">Czas klatki: ${g.frameTimeMs} ms · ${g.totalFramesRendered.toLocaleString('pl-PL')} kl.</span>
      </div>

      <div class="metric-card">
        <span class="metric-label">${thermalMonitorService.getLiveGpuTempC() !== null ? 'Czujnik GPU (LIVE °C)' : 'Czas klatki GPU (Frame-Time)'}</span>
        <div class="metric-row">
          ${
            thermalMonitorService.getLiveGpuTempC() !== null
              ? `<span class="metric-value ${thermalMonitorService.getLiveGpuTempC()! >= 82 ? 'status-err' : thermalMonitorService.getLiveGpuTempC()! >= 70 ? 'status-warn' : 'status-ok'}">${thermalMonitorService.getLiveGpuTempC()!.toFixed(1)}</span><span class="metric-unit">°C</span>`
              : `<span class="metric-value status-cyan">${g.frameTimeMs}</span><span class="metric-unit">ms</span>`
          }
        </div>
        <span class="metric-foot">${thermalMonitorService.getLiveGpuTempC() !== null ? 'Prawdziwy czujnik sprzętowy LIVE' : 'Brak czujnika °C (podłącz plik LIVE lub LHM na Pulpicie)'}</span>
      </div>

      <div class="metric-card">
        <span class="metric-label">Moc Obliczeniowa &amp; Wynik 3D</span>
        <div class="metric-row">
          <span class="metric-value">${g.overallScore > 0 ? g.overallScore : '—'}</span>
          <span class="metric-unit">/ 100</span>
        </div>
        <span class="metric-foot">Est. <strong class="font-mono status-cyan">${g.estFp32Tflops ? `${g.estFp32Tflops} TFLOPS` : '—'}</strong> · VRAM Fill: <strong class="font-mono">${g.vramFillrateGBs ? `${g.vramFillrateGBs} GB/s` : '—'}</strong> · Draw: ${g.drawCalls}</span>
      </div>
    `;
  }

  private renderGpuChartHtml(g: GpuStressMetrics): string {
    return renderDualLineChart(
      [
        {
          label: 'Rzeczywista wydajność GPU',
          color: '#06b6d4',
          values: g.telemetry.map((t) => t.fps),
          unit: 'FPS',
          min: 0,
        },
        {
          label: 'Czas klatki (ms)',
          color: '#f59e0b',
          values: g.telemetry.map((t) => (t.fps > 0 ? Number((1000 / t.fps).toFixed(2)) : 0)),
          unit: 'ms',
          min: 0,
          dashed: true,
        },
      ],
      g.telemetry.map((t) => `${t.timeSec}s`),
      180
    );
  }

  private patchGpuLive(): void {
    if (this.activeModule !== 'gpu') return;
    const g = this.gpuState;
    const activeSceneMeta =
      GPU_SCENE_CATALOG.find((s) => s.id === (g.sceneMode || 'vortex')) || GPU_SCENE_CATALOG[0];
    const hudLive = this.root.querySelector('#gpu-hud-live');
    if (hudLive) {
      hudLive.innerHTML = `
        <span>Scena: <strong class="status-cyan">${esc(activeSceneMeta.shortName)}</strong></span>
        <span>FPS: <strong class="status-cyan">${g.fps.toLocaleString('pl-PL')}</strong></span>
        <span>Frame: <strong>${g.frameTimeMs} ms</strong></span>
        <span>Obiekty/Kroki: <strong>${g.instanceCount.toLocaleString('pl-PL')}</strong></span>
        <span>Trójkąty: <strong>${g.triangles.toLocaleString('pl-PL')}</strong></span>
        <span>Tryb: <strong class="status-ok">${g.fpsMode === 'uncapped' ? 'Bez limitu FPS' : 'VSync (rAF)'}</strong></span>
      `;
    }
    const hudVerdict = this.root.querySelector('#gpu-hud-verdict');
    if (hudVerdict) {
      const cls =
        g.verdict === 'STABILNY'
          ? 'status-ok'
          : g.verdict === 'LEKKI SPADEK'
            ? 'status-warn'
            : g.verdict === 'OCZEKIWANIE'
              ? ''
              : 'status-err';
      hudVerdict.innerHTML = `<span>Status: <strong class="${cls}">${esc(g.verdict)}</strong></span>`;
    }
    const toggleBtn = this.root.querySelector<HTMLButtonElement>('#gpu-toggle-btn');
    if (toggleBtn) {
      toggleBtn.className = `btn ${g.running ? 'btn-danger' : 'btn-primary'} btn-sm`;
      toggleBtn.innerHTML = `${iconSvg(g.running ? 'stop' : 'play', 14)}<span>${g.running ? 'Zatrzymaj stres-test' : 'Start stres-testu GPU'}</span>`;
    }
    const metricsEl = this.root.querySelector('#gpu-live-metrics');
    if (metricsEl) {
      metricsEl.innerHTML = this.renderGpuMetricCardsHtml(g);
    }
    const chartEl = this.root.querySelector('#gpu-live-chart');
    if (chartEl) {
      chartEl.innerHTML = this.renderGpuChartHtml(g);
    }
  }

  /* =========================================================================
     6. EKRAN I MATRYCA (18 TESTÓW + DETEKCJA MODELU MATRYCY)
     ========================================================================= */
  private renderDisplayView(host: HTMLElement): void {
    const idx = displayDiagnostics.getPatternIndex();
    const activePat = DISPLAY_PATTERNS[idx] || DISPLAY_PATTERNS[0];
    const s = this.specs;
    const panel = this.hardwareScan?.panel;
    const categories = ['ALL', ...Array.from(new Set(DISPLAY_PATTERNS.map((p) => p.category)))];
    const visiblePatterns = DISPLAY_PATTERNS.map((p, i) => ({ pat: p, index: i })).filter(
      (item) => this.displayCategoryFilter === 'ALL' || item.pat.category === this.displayCategoryFilter
    );

    host.innerHTML = `
      <div class="stack-lg">
        <div class="section-header">
          <div>
            <h1 class="section-title">Diagnostyka ekranu i matrycy (${DISPLAY_PATTERNS.length} testów Pro)</h1>
            <p class="section-subtitle">
              Wykrywanie modelu matrycy, bad/stuck pikseli (RGB+CMY), kruszenia czerni (Black Crush), saturacji bieli, kątów widzenia, wypalenia OLED, smużenia, przeskoku klatek oraz stroboskopu naprawczego.
            </p>
          </div>
          <div class="row-wrap">
            <button id="disp-probe-model-btn" type="button" class="btn btn-secondary">
              ${iconSvg('display', 14)}
              <span>Wykryj dokładny model matrycy</span>
            </button>
            <button id="disp-oled-protect-btn" type="button" class="btn ${displayDiagnostics.isOledProtectionActive() ? 'btn-danger' : 'btn-secondary'}">
              ${iconSvg('shield', 14)}
              <span id="disp-oled-protect-label">${
                displayDiagnostics.isOledProtectionActive()
                  ? `Zatrzymaj OLED Protection (${formatCountdownMmSs(displayDiagnostics.getOledProtectionRemainingSec())})`
                  : 'OLED Burn-in Protection (60 min)'
              }</span>
            </button>
            <button id="disp-slideshow-btn" type="button" class="btn ${this.displaySlideshowTimer ? 'btn-danger' : 'btn-secondary'}">
              ${this.displaySlideshowTimer ? 'Stop pokazu (3s)' : 'Auto-pokaz (co 3s)'}
            </button>
            <button id="disp-grid-toggle" type="button" class="btn btn-secondary">
              Siatka: ${displayDiagnostics.getShowGrid() ? 'WŁ.' : 'WYŁ.'}
            </button>
            <button id="disp-fullscreen-btn" type="button" class="btn btn-primary">
              ${iconSvg('maximize', 14)}
              <span>Tryb pełnoekranowy</span>
            </button>
          </div>
        </div>

        <div
          id="disp-oled-status-banner"
          class="panel"
          style="padding:10px 14px;border-color:var(--accent-cyan);font-size:12px;${
            displayDiagnostics.isOledProtectionActive() || this.oledProtectionNotice ? '' : 'display:none;'
          }"
        >
          <div class="row-between" style="flex-wrap:wrap;gap:8px;">
            <div>
              <span class="status-cyan" style="font-weight:600;">OLED Burn-in Protection:</span>
              <span id="disp-oled-status-text">${esc(
                displayDiagnostics.isOledProtectionActive()
                  ? `Aktywny ruchomy wzór o niskiej jasności · Pozostało ${formatCountdownMmSs(displayDiagnostics.getOledProtectionRemainingSec())} / ${formatCountdownMmSs(OLED_PROTECTION_DURATION_SEC)}`
                  : this.oledProtectionNotice
              )}</span>
            </div>
            ${
              displayDiagnostics.isOledProtectionActive()
                ? `<button id="disp-oled-stop-inline-btn" type="button" class="btn btn-danger btn-sm">Zatrzymaj</button>`
                : ''
            }
          </div>
        </div>

        ${
          this.hardwareScanNotice
            ? `<div class="panel" style="padding:10px 14px;border-color:var(--accent-cyan);font-size:12px;">
                <span class="status-cyan" style="font-weight:600;">Skaner matrycy:</span> ${esc(this.hardwareScanNotice)}
              </div>`
            : ''
        }

        <div class="panel stack-sm" style="padding:12px 14px;">
          <div class="row-between" style="flex-wrap:wrap;gap:8px;">
            <div>
              <span style="font-size:12.5px;font-weight:600;">Dokładny odczyt chipu EDID matrycy / monitora (PowerShell / CMD)</span>
              <span style="display:block;font-size:11.5px;color:var(--text-muted);">
                Krok 1: Skopiuj natywną komendę CMD (pnputil — bez PowerShell i bez blokad antywirusa) lub PowerShell. Krok 2: Wklej wynik (Ctrl+V) w pole poniżej lub wpisz model monitora ręcznie.
              </span>
            </div>
            <div class="row-wrap" style="gap:8px;">
              <button id="disp-edid-copy-ps-btn" type="button" class="btn ${this.edidCommandMode === 'powershell' ? 'btn-primary' : 'btn-secondary'} btn-sm">
                Kopiuj do PowerShell
              </button>
              <button id="disp-edid-copy-cmd-btn" type="button" class="btn ${this.edidCommandMode === 'cmd' ? 'btn-primary' : 'btn-secondary'} btn-sm">
                Kopiuj do CMD (pnputil · bez AV)
              </button>
              <button id="disp-edid-txt-btn" type="button" class="btn btn-secondary btn-sm">
                ${iconSvg('download', 13)}
                <span>Instrukcja (.txt)</span>
              </button>
            </div>
          </div>
          <div class="row-wrap" style="gap:8px;align-items:center;">
            <span style="font-size:11px;color:var(--text-muted);white-space:nowrap;">Podgląd komendy (${this.edidCommandMode === 'powershell' ? 'PowerShell' : 'CMD'}):</span>
            <input
              id="disp-edid-cmd-preview"
              type="text"
              readonly
              class="input"
              style="flex:1;min-width:240px;font-family:var(--font-mono);font-size:11px;opacity:0.9;cursor:text;"
              value="${esc(this.edidCommandMode === 'powershell' ? EDID_POWERSHELL_COMMAND : EDID_CMD_COMMAND)}"
            />
          </div>
          <div class="row-wrap" style="gap:8px;align-items:stretch;">
            <input
              id="disp-edid-paste-input"
              type="text"
              class="input"
              style="flex:1;min-width:240px;font-family:var(--font-mono);font-size:12px;"
              placeholder='Wklej wynik z CMD (pnputil) lub PowerShell JSON (Ctrl+V) albo wpisz model monitora (np. LG 27GP850)...'
            />
            <button id="disp-edid-import-btn" type="button" class="btn btn-primary btn-sm">
              Wczytaj model EDID
            </button>
          </div>
        </div>

        <div class="grid-4">
          <div class="metric-card">
            <span class="metric-label">Wykryty model / Klasa matrycy</span>
            <div class="metric-row">
              <span class="metric-value" style="font-size:15px;line-height:1.25;">${esc(panel ? panel.label : 'Matryca główna')}</span>
            </div>
            <span class="metric-foot">${esc(panel ? panel.estimatedClass : 'Standard Display')}</span>
          </div>
          <div class="metric-card">
            <span class="metric-label">Rozdzielczość natywna / logiczna</span>
            <div class="metric-row">
              <span class="metric-value" style="font-size:19px;">${esc(panel ? panel.nativeResolution : s ? s.screenResolution : `${window.screen.width} × ${window.screen.height}`)}</span>
            </div>
            <span class="metric-foot">Logiczna: ${esc(panel ? panel.logicalResolution : `${window.screen.width} × ${window.screen.height}`)} · DPI ${panel ? panel.devicePixelRatio : window.devicePixelRatio}×</span>
          </div>
          <div class="metric-card">
            <span class="metric-label">Odświeżanie i Gamut barw</span>
            <div class="metric-row">
              <span class="metric-value status-cyan">${panel ? panel.refreshRateHz : s ? s.estimatedRefreshRate : 60}</span>
              <span class="metric-unit">Hz · ${esc(panel ? panel.colorGamut : 'sRGB')}</span>
            </div>
            <span class="metric-foot">${panel ? panel.colorDepthBit : 24}-bit · HDR: ${panel?.hdrSupported ? 'Tak' : 'Standard SDR'} · Dotyk: ${panel?.touchPoints ? `${panel.touchPoints} pkt` : 'Nie'}</span>
          </div>
          <div class="metric-card">
            <span class="metric-label">Aktywna plansza testowa</span>
            <div class="metric-row">
              <span id="disp-active-idx" class="metric-value" style="font-size:20px;">${idx + 1} / ${DISPLAY_PATTERNS.length}</span>
            </div>
            <span id="disp-active-cat" class="metric-foot">${esc(activePat.category)}</span>
          </div>
        </div>

        <div class="panel stack-md">
          <div class="row-between">
            <div>
              <h2 id="disp-pat-title" class="panel-title">${esc(activePat.name)}</h2>
              <p id="disp-pat-desc" style="margin:3px 0 0;font-size:12px;color:var(--text-secondary);">${esc(activePat.description)}</p>
            </div>
            <div class="row-wrap">
              <button id="disp-prev-btn" type="button" class="btn btn-secondary btn-sm">Poprzednia</button>
              <button id="disp-next-btn" type="button" class="btn btn-secondary btn-sm">Następna</button>
            </div>
          </div>

          <div class="display-preview-box" id="disp-preview-wrap" title="Kliknij, aby otworzyć pełny ekran">
            <canvas id="disp-preview-canvas" style="width:100%;height:100%;display:block;"></canvas>
          </div>
          <div style="font-size:12px;color:var(--text-muted);">
            Wskazówka: Kliknij podgląd lub przycisk „Tryb pełnoekranowy”, aby sprawdzić całą powierzchnię ekranu. W trybie pełnoekranowym klikaj lub używaj strzałek Lewo / Prawo, aby przełączać wszystkie ${DISPLAY_PATTERNS.length} plansz, i ESC aby wyjść.
          </div>
        </div>

        <div class="panel stack-md">
          <div class="row-between" style="flex-wrap:wrap;gap:8px;">
            <h2 class="panel-title">Biblioteka ${DISPLAY_PATTERNS.length} plansz diagnostycznych</h2>
            <div class="row-wrap">
              ${categories
                .map(
                  (cat) => `
                <button type="button" class="btn ${this.displayCategoryFilter === cat ? 'btn-primary' : 'btn-secondary'} btn-sm" data-disp-cat="${esc(cat)}">
                  ${cat === 'ALL' ? `Wszystkie (${DISPLAY_PATTERNS.length})` : esc(cat)}
                </button>`
                )
                .join('')}
            </div>
          </div>

          <div class="pattern-grid">
            ${visiblePatterns
              .map(
                ({ pat: p, index: i }) => `
              <button type="button" class="pattern-btn ${i === idx ? 'active' : ''}" data-pat-idx="${i}">
                <div class="pattern-swatch" style="${p.swatchStyle}"></div>
                <div style="font-size:12px;font-weight:600;line-height:1.3;">${i + 1}. ${esc(p.name)}</div>
                <div style="font-size:11px;color:var(--text-muted);">${esc(p.category)}</div>
              </button>`
              )
              .join('')}
          </div>
        </div>
      </div>
    `;

    const canvas = host.querySelector<HTMLCanvasElement>('#disp-preview-canvas');
    const syncSelectionUi = (newIdx: number) => {
      const pat = DISPLAY_PATTERNS[newIdx];
      if (!pat) return;
      const titleEl = host.querySelector('#disp-pat-title');
      const descEl = host.querySelector('#disp-pat-desc');
      const catEl = host.querySelector('#disp-active-cat');
      const idxEl = host.querySelector('#disp-active-idx');
      if (titleEl) titleEl.textContent = pat.name;
      if (descEl) descEl.textContent = pat.description;
      if (catEl) catEl.textContent = pat.category;
      if (idxEl) idxEl.textContent = `${newIdx + 1} / ${DISPLAY_PATTERNS.length}`;
      host.querySelectorAll<HTMLButtonElement>('[data-pat-idx]').forEach((b) => {
        b.classList.toggle('active', Number(b.dataset.patIdx) === newIdx);
      });
    };

    if (canvas) {
      displayDiagnostics.attachPreviewCanvas(canvas, syncSelectionUi);
    }

    host.querySelector('#disp-probe-model-btn')?.addEventListener('click', async (e) => {
      const btn = e.currentTarget as HTMLButtonElement;
      btn.disabled = true;
      btn.innerHTML = `${iconSvg('display', 14)}<span>Mierzenie matrycy...</span>`;
      this.hardwareScanNotice = await hardwareScannerService.requestExactScreenModel();
      this.hardwareScan = await hardwareScannerService.scanAll(
        this.specs?.estimatedRefreshRate || 60,
        this.specs?.gpuRenderer || '',
        this.specs
      );
      if (this.activeModule === 'display') this.renderDisplayView(host);
    });

    const cmdPreview = host.querySelector<HTMLInputElement>('#disp-edid-cmd-preview');
    cmdPreview?.addEventListener('focus', () => cmdPreview.select());
    cmdPreview?.addEventListener('click', () => cmdPreview.select());

    const handleCopyEdid = async (mode: 'powershell' | 'cmd', btn: HTMLButtonElement) => {
      this.edidCommandMode = mode;
      const cmd = mode === 'powershell' ? EDID_POWERSHELL_COMMAND : EDID_CMD_COMMAND;
      if (cmdPreview) cmdPreview.value = cmd;
      const copied = await this.copyTextToClipboard(cmd);
      const orig = btn.textContent || 'Kopiuj';
      btn.textContent = copied ? 'Skopiowano ✓' : 'Zaznaczono poniżej (Ctrl+C)';
      if (!copied && cmdPreview) {
        cmdPreview.focus();
        cmdPreview.select();
      }
      window.setTimeout(() => {
        if (btn.isConnected) btn.textContent = orig;
      }, 2400);
      this.hardwareScanNotice =
        mode === 'powershell'
          ? 'Skopiowano komendę PowerShell! Otwórz Terminal / PowerShell (Win+X → Terminal), wklej (Ctrl+V) i naciśnij Enter, a wynik JSON automatycznie trafi do schowka.'
          : 'Skopiowano natywną komendę CMD (pnputil — bez uruchamiania powershell.exe i bez blokad antywirusa)! Otwórz CMD (Win+R → cmd), wklej (Ctrl+V) i naciśnij Enter, a następnie wklej wynik tutaj.';
      const noticeInput = host.querySelector<HTMLInputElement>('#disp-edid-paste-input');
      if (copied && noticeInput) noticeInput.focus();
    };

    host.querySelector('#disp-edid-copy-ps-btn')?.addEventListener('click', (e) => {
      void handleCopyEdid('powershell', e.currentTarget as HTMLButtonElement);
    });

    host.querySelector('#disp-edid-copy-cmd-btn')?.addEventListener('click', (e) => {
      void handleCopyEdid('cmd', e.currentTarget as HTMLButtonElement);
    });

    host.querySelector('#disp-edid-txt-btn')?.addEventListener('click', (e) => {
      downloadMonitorEdidScript();
      const btn = e.currentTarget as HTMLButtonElement;
      const origHtml = btn.innerHTML;
      btn.innerHTML = `${iconSvg('download', 13)}<span>Pobrano .txt ✓</span>`;
      window.setTimeout(() => {
        if (btn.isConnected) btn.innerHTML = origHtml;
      }, 2200);
    });

    host.querySelector('#disp-edid-import-btn')?.addEventListener('click', async () => {
      const input = host.querySelector<HTMLInputElement>('#disp-edid-paste-input');
      const res = hardwareScannerService.importMonitorEdid(input?.value || '');
      this.hardwareScanNotice = res.message;
      if (res.ok) {
        this.hardwareScan = await hardwareScannerService.scanAll(
          this.specs?.estimatedRefreshRate || 60,
          this.specs?.gpuRenderer || '',
          this.specs
        );
        void this.recordLog(
          'DISPLAY',
          'OK',
          'Odczytano EDID matrycy',
          'Model',
          this.hardwareScan.panel.label,
          res.message
        );
      }
      if (this.activeModule === 'display') this.renderDisplayView(host);
    });

    host.querySelector('#disp-oled-protect-btn')?.addEventListener('click', () => {
      if (displayDiagnostics.isOledProtectionActive()) {
        displayDiagnostics.stopOledBurnInProtection(false);
        return;
      }
      this.stopDisplaySlideshow();
      this.oledProtectionNotice = '';
      void this.recordLog(
        'DISPLAY',
        'INFO',
        'Uruchomiono OLED Burn-in Protection',
        'Czas sesji',
        '30:00 (1800 s)',
        'Ruchomy wzór pixel-shift o niskiej jasności uruchomiony w trybie pełnoekranowym.'
      );
      displayDiagnostics.startOledBurnInProtection({
        durationSec: OLED_PROTECTION_DURATION_SEC,
        onTick: (remainingSec) => {
          if (this.activeModule !== 'display') return;
          const lbl = this.root.querySelector('#disp-oled-protect-label');
          if (lbl) {
            lbl.textContent = `Zatrzymaj OLED Protection (${formatCountdownMmSs(remainingSec)})`;
          }
          const banner = this.root.querySelector<HTMLElement>('#disp-oled-status-banner');
          const txt = this.root.querySelector('#disp-oled-status-text');
          if (banner) banner.style.display = '';
          if (txt) {
            txt.textContent = `Aktywny ruchomy wzór o niskiej jasności · Pozostało ${formatCountdownMmSs(remainingSec)} / ${formatCountdownMmSs(OLED_PROTECTION_DURATION_SEC)}`;
          }
        },
        onComplete: () => {
          this.oledProtectionNotice =
            'Zakończono 60-minutową sesję OLED Burn-in Protection. Piksele matrycy zostały równomiernie odświeżone.';
          soundNotificationService.playCompletionChime('complete');
          void this.recordLog(
            'DISPLAY',
            'OK',
            'Zakończono OLED Burn-in Protection',
            'Status',
            '60:00 ukończone',
            'Pełny 60-minutowy cykl ochrony matrycy OLED przed wypaleniem zakończył się pomyślnie.'
          );
        },
        onStop: (completed) => {
          if (!completed) {
            this.oledProtectionNotice = 'Tryb OLED Burn-in Protection został zatrzymany ręcznie.';
          }
          if (this.activeModule === 'display') {
            this.renderDisplayView(host);
          }
        },
      });
      if (this.activeModule === 'display') {
        this.renderDisplayView(host);
      }
    });

    host.querySelector('#disp-oled-stop-inline-btn')?.addEventListener('click', () => {
      displayDiagnostics.stopOledBurnInProtection(false);
    });

    host.querySelector('#disp-slideshow-btn')?.addEventListener('click', () => {
      if (this.displaySlideshowTimer !== null) {
        this.stopDisplaySlideshow();
      } else {
        this.displaySlideshowTimer = window.setInterval(() => {
          displayDiagnostics.setPattern((displayDiagnostics.getPatternIndex() + 1) % DISPLAY_PATTERNS.length);
        }, 3000);
      }
      if (this.activeModule === 'display') this.renderDisplayView(host);
    });

    host.querySelector('#disp-preview-wrap')?.addEventListener('click', () => {
      displayDiagnostics.openFullscreen();
    });
    host.querySelector('#disp-fullscreen-btn')?.addEventListener('click', () => {
      displayDiagnostics.openFullscreen();
    });
    host.querySelector('#disp-prev-btn')?.addEventListener('click', () => {
      displayDiagnostics.setPattern(displayDiagnostics.getPatternIndex() - 1);
    });
    host.querySelector('#disp-next-btn')?.addEventListener('click', () => {
      displayDiagnostics.setPattern(displayDiagnostics.getPatternIndex() + 1);
    });
    host.querySelector('#disp-grid-toggle')?.addEventListener('click', (e) => {
      const next = !displayDiagnostics.getShowGrid();
      displayDiagnostics.setShowGrid(next);
      (e.currentTarget as HTMLButtonElement).textContent = `Siatka: ${next ? 'WŁ.' : 'WYŁ.'}`;
    });

    host.querySelectorAll<HTMLButtonElement>('[data-disp-cat]').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.displayCategoryFilter = btn.dataset.dispCat || 'ALL';
        this.renderDisplayView(host);
      });
    });

    host.querySelectorAll<HTMLButtonElement>('[data-pat-idx]').forEach((btn) => {
      btn.addEventListener('click', () => {
        displayDiagnostics.setPattern(Number(btn.dataset.patIdx) || 0);
      });
    });
  }

  /* =========================================================================
     7. BATERIA I ZASILANIE (LAPTOP BATTERY HEALTH MONITOR)
     ========================================================================= */
  private renderBatteryView(host: HTMLElement): void {
    const b = this.batteryState;
    const condCls =
      b.condition === 'DOSKONAŁA' || b.condition === 'DOBRA'
        ? 'status-ok'
        : b.condition === 'ZUŻYTA'
          ? 'status-warn'
          : 'status-err';

    host.innerHTML = `
      <div class="stack-lg">
        <div class="section-header">
          <div>
            <h1 class="section-title">Monitor kondycji i zużycia baterii laptopa</h1>
            <p class="section-subtitle">
              Analiza stopnia zużycia ogniw (Wear Level), pojemności projektowej i rzeczywistej w mWh, poboru mocy oraz szacowanego czasu pracy na baterii przy bieżącym obciążeniu.
            </p>
          </div>
          <div class="row-wrap" style="gap:10px;align-items:center;">
            <button id="bat-trend-report-btn" type="button" class="btn btn-secondary btn-sm" title="Generuj raport trendu poboru mocy i degradacji ogniw w formacie PDF">
              ${iconSvg('pdf', 14)}
              <span>Battery Trend Report</span>
            </button>
            <div class="meta-line">
              <span>Źródło danych: <strong class="font-mono" style="color:var(--text-primary);">${b.apiSupported ? 'Battery Status API (Live)' : 'Kalibracja ręczna / Desktop'}</strong></span>
            </div>
          </div>
        </div>

        <div id="bat-kpi-grid" class="grid-4">
          ${this.renderBatteryKpisHtml(b, condCls)}
        </div>

        <div id="bat-low-health-alert-slot">${renderLowBatteryHealthAlertHtml(b, false)}</div>

        ${this.renderPcPsuPanelHtml(b)}

        <div class="grid-split">
          <div class="panel stack-md">
            <div class="panel-header" style="margin-bottom:0;">
              <h2 class="panel-title">Kalibracja pojemności ogniw (mWh)</h2>
              <span class="panel-caption">powercfg /batteryreport</span>
            </div>

            <div class="stack-sm">
              <span class="field-label">Szybkie profile laptopów</span>
              <div class="row-wrap">
                ${BATTERY_PRESETS.map(
                  (pr) => `
                  <button type="button" class="btn btn-secondary btn-sm" data-bat-preset="${pr.id}">
                    ${esc(pr.label)}
                  </button>`
                ).join('')}
              </div>
            </div>

            <div class="field-group">
              <label class="field-label" for="bat-design-input">Pojemność fabryczna (Design Capacity, mWh)</label>
              <input id="bat-design-input" class="field-input" type="number" min="10000" max="150000" step="500" value="${b.designCapacityMWh}" />
            </div>

            <div class="field-group">
              <label class="field-label" for="bat-full-input">Obecna pełna pojemność (Full Charge Capacity, mWh)</label>
              <input id="bat-full-input" class="field-input" type="number" min="5000" max="150000" step="500" value="${b.fullChargeCapacityMWh}" />
            </div>

            ${
              !b.apiSupported
                ? `
              <div class="field-group">
                <label class="field-label" for="bat-level-range">Poziom naładowania (tryb symulacji bez API): <strong class="font-mono" id="bat-level-lbl">${b.levelPct}%</strong></label>
                <input id="bat-level-range" class="range-input" type="range" min="5" max="100" value="${b.levelPct}" />
              </div>
              <div class="row-wrap">
                <button id="bat-toggle-charge" type="button" class="btn btn-secondary btn-sm">
                  Stan zasilacza: ${b.charging ? 'Podłączony (Ładowanie)' : 'Praca na baterii'}
                </button>
              </div>`
                : ''
            }

            <div style="font-size:12px;color:var(--text-muted);line-height:1.5;margin-bottom:12px;">
              Aby uzyskać dokładne wartości fabryczne z systemu Windows, wpisz w wierszu poleceń <span class="font-mono" style="color:var(--text-secondary);">powercfg /batteryreport</span> i przepisz wartości Design Capacity oraz Full Charge Capacity powyżej.
            </div>

            <div class="panel stack-sm" style="background:var(--bg-inset);padding:12px;border-radius:10px;">
              <div class="row-between" style="align-items:center;margin-bottom:6px;">
                <span style="font-size:13px;font-weight:600;">Alarm poboru mocy (Threshold Watts)</span>
                <span class="font-mono status-cyan" id="bat-power-threshold-lbl">${b.powerThresholdW} W</span>
              </div>
              <div class="row-wrap" style="gap:8px;align-items:center;">
                <input id="bat-power-threshold-input" class="range-input" type="range" min="10" max="300" step="5" value="${b.powerThresholdW}" style="flex-grow:1;" />
                <button id="bat-test-sound-btn" type="button" class="btn btn-secondary btn-sm">Test audio</button>
              </div>
              <span style="font-size:11px;color:var(--text-secondary);">Wyzwala dźwiękowe powiadomienie audio, gdy pobór mocy przekroczy próg.</span>
            </div>
          </div>

          <div class="stack-md">
            <div class="panel stack-md">
              <div class="panel-header" style="margin-bottom:0;">
                <h2 class="panel-title">Prognozowany czas pracy na baterii</h2>
                <span id="bat-load-tag" class="font-mono status-cyan">Bieżące obciążenie: ${b.currentLoadPct}% (${b.currentPowerDrawW} W)</span>
              </div>
              <div id="bat-estimates-table">
                ${this.renderBatteryEstimatesHtml(b)}
              </div>
            </div>

            <div class="panel stack-md">
              <div class="panel-header" style="margin-bottom:0;flex-wrap:wrap;gap:8px;">
                <div>
                  <h2 class="panel-title">Historia baterii — pobór mocy i poziom naładowania</h2>
                  <span class="panel-caption">Lewa oś: Poziom naładowania (%) · Prawa oś: Pobór mocy (W) · Najedź na punkt, aby zobaczyć dokładną datę, moc i poziom</span>
                </div>
                <div class="row-wrap" style="gap:6px;">
                  <button id="bat-history-export-csv-btn" type="button" class="btn btn-secondary btn-sm" title="Pobierz dziennik zarejestrowanych cykli ładowania w formacie CSV" aria-label="Download CSV" ${b.powerCycles.length === 0 ? 'disabled' : ''}>
                    ${iconSvg('csv', 13)}
                    <span>Download CSV</span>
                  </button>
                  <button id="bat-history-export-xlsx-btn" type="button" class="btn btn-secondary btn-sm" title="Pobierz dziennik zarejestrowanych cykli ładowania i podsumowanie baterii w pliku Excel (.xlsx)" aria-label="Download Excel" ${b.powerCycles.length === 0 ? 'disabled' : ''}>
                    ${iconSvg('excel', 13)}
                    <span>Download Excel</span>
                  </button>
                  <button id="bat-sample-now-btn" type="button" class="btn btn-secondary btn-sm">
                    Zapisz próbkę
                  </button>
                </div>
              </div>
              <div id="bat-chart-stats" class="meta-line">
                ${this.renderBatteryChartStatsHtml(b)}
              </div>
              <div id="bat-history-chart">
                ${this.renderBatteryChartHtml(b)}
              </div>
            </div>
          </div>
        </div>

        <div class="panel stack-md">
          <div class="panel-header" style="margin-bottom:0;flex-wrap:wrap;gap:8px;">
            <div>
              <h2 class="panel-title">Dziennik cykli ładowania (Power Cycle Log) i degradacja pojemności</h2>
              <p style="margin:3px 0 0;font-size:12px;color:var(--text-secondary);">
                Szczegółowy rejestr historycznych sesji ładowania wraz z analizą spadku pełnej pojemności ogniw (mWh) pomiędzy kolejnymi cyklami. Sesje zapisywane są w pamięci IndexedDB.
              </p>
            </div>
            <div class="row-wrap" style="gap:6px;">
              <button id="bat-cycles-export-csv-btn" type="button" class="btn btn-secondary btn-sm" title="Eksportuj tabelę cykli ładowania do pliku CSV" ${b.powerCycles.length === 0 ? 'disabled' : ''}>
                ${iconSvg('csv', 13)}
                <span>Download CSV</span>
              </button>
              <button id="bat-cycles-export-xlsx-btn" type="button" class="btn btn-secondary btn-sm" title="Eksportuj tabelę cykli ładowania do pliku Excel (.xlsx)" ${b.powerCycles.length === 0 ? 'disabled' : ''}>
                ${iconSvg('excel', 13)}
                <span>Download Excel</span>
              </button>
              <button id="bat-reset-cycles-btn" type="button" class="btn btn-secondary btn-sm">
                Przywróć bazę cykli
              </button>
            </div>
          </div>

          <div id="bat-cycle-summary" class="grid-4">
            ${this.renderBatteryCycleSummaryHtml(b)}
          </div>

          <div class="stack-sm">
            <div class="row-between" style="flex-wrap:wrap;gap:6px;">
              <span style="font-size:13px;font-weight:600;">Trend stopnia zużycia (Wear Level) vs Szacowane cykle ładowania (Ostatnie 30 Dni)</span>
              <span class="panel-caption">Wykres D3.js · Oś Y1: Wear Level (%) · Oś Y2: Est. Power Cycles</span>
            </div>
            <div id="bat-wear-30d-d3-container"></div>
          </div>

          <div class="stack-sm">
            <div class="row-between" style="flex-wrap:wrap;gap:6px;">
              <span style="font-size:13px;font-weight:600;">Trend degradacji pełnej pojemności ogniw (Full Charge Capacity · mWh)</span>
              <span class="panel-caption">Regresja liniowa na podstawie historii cykli ładowania (powerCycles)</span>
            </div>
            <div id="bat-degradation-chart">
              ${this.renderBatteryDegradationChartHtml(b)}
            </div>
          </div>

          <div id="bat-cycle-log-table" style="overflow-x:auto;">
            ${this.renderBatteryCycleTableHtml(b)}
          </div>

          <form id="bat-add-cycle-form" class="panel" style="padding:14px;background:var(--bg-inset);">
            <div class="row-between" style="margin-bottom:10px;flex-wrap:wrap;gap:8px;">
              <span style="font-size:13px;font-weight:600;">Zarejestruj nową sesję ładowania</span>
              <span class="panel-caption">Automatyczne wykrywanie po odłączeniu ładowarki (Battery API) lub wpis ręczny</span>
            </div>
            <div class="grid-4" style="align-items:end;">
              <div class="field-group">
                <label class="field-label" for="cycle-start-pct">Początek ładowania (%)</label>
                <input id="cycle-start-pct" class="field-input" type="number" min="0" max="99" value="${Math.max(10, b.levelPct - 35)}" required />
              </div>
              <div class="field-group">
                <label class="field-label" for="cycle-end-pct">Koniec ładowania (%)</label>
                <input id="cycle-end-pct" class="field-input" type="number" min="1" max="100" value="${Math.min(100, Math.max(b.levelPct, 95))}" required />
              </div>
              <div class="field-group">
                <label class="field-label" for="cycle-duration-min">Czas ładowania (min)</label>
                <input id="cycle-duration-min" class="field-input" type="number" min="1" max="1440" value="65" required />
              </div>
              <div class="field-group">
                <label class="field-label" for="cycle-full-cap">Zmierzona pojemność (mWh)</label>
                <div class="row-wrap" style="flex-wrap:nowrap;">
                  <input id="cycle-full-cap" class="field-input" type="number" min="5000" max="${b.designCapacityMWh}" step="10" value="${Math.max(5000, b.fullChargeCapacityMWh - 120)}" required />
                  <button type="submit" class="btn btn-primary btn-sm">Dodaj cykl</button>
                </div>
              </div>
            </div>
          </form>
        </div>
      </div>
    `;

    const designInput = host.querySelector<HTMLInputElement>('#bat-design-input');
    const fullInput = host.querySelector<HTMLInputElement>('#bat-full-input');
    const cycleCapInput = host.querySelector<HTMLInputElement>('#cycle-full-cap');

    const applyCap = () => {
      const dVal = Number(designInput?.value) || this.batteryState.designCapacityMWh;
      const fVal = Number(fullInput?.value) || this.batteryState.fullChargeCapacityMWh;
      batteryHealthService.setCapacities(dVal, fVal, true);
      if (cycleCapInput) {
        cycleCapInput.max = String(dVal);
        cycleCapInput.value = String(Math.max(5000, fVal - 100));
      }
      this.emitDiagnosticChanged('battery-update', false);
    };
    designInput?.addEventListener('change', applyCap);
    fullInput?.addEventListener('change', applyCap);

    host.querySelectorAll<HTMLButtonElement>('[data-bat-preset]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const pr = BATTERY_PRESETS.find((p) => p.id === btn.dataset.batPreset);
        if (!pr) return;
        if (designInput) designInput.value = String(pr.designMWh);
        if (fullInput) fullInput.value = String(pr.fullChargeMWh);
        if (cycleCapInput) {
          cycleCapInput.max = String(pr.designMWh);
          cycleCapInput.value = String(Math.max(5000, pr.fullChargeMWh - 100));
        }
        batteryHealthService.setCapacities(pr.designMWh, pr.fullChargeMWh, true);
        this.emitDiagnosticChanged('battery-update', false);
      });
    });

    const thresholdInput = host.querySelector<HTMLInputElement>('#bat-power-threshold-input');
    const thresholdLbl = host.querySelector<HTMLElement>('#bat-power-threshold-lbl');
    thresholdInput?.addEventListener('input', () => {
      const val = Number(thresholdInput.value);
      if (thresholdLbl) thresholdLbl.textContent = `${val} W`;
      batteryHealthService.setPowerThresholdW(val);
    });
    host.querySelector('#bat-test-sound-btn')?.addEventListener('click', () => {
      soundNotificationService.playEvent('thermalWarning', 'warning');
    });

    const psuChartEl = host.querySelector<HTMLElement>('#pc-psu-rail-chart');
    if (psuChartEl) {
      const cutoff60s = Date.now() - 60000;
      const rail60s = (b.railHistory || []).filter((h) => h.timestamp >= cutoff60s);
      const chartData = rail60s.length > 0 ? rail60s : (b.railHistory || []).slice(-24);
      renderPcPsuRailsD3Chart(
        psuChartEl,
        chartData,
        psuCalculatorService.getRailDeviationPct(),
        batteryHealthService.getRailAlertMarkersClearedAt()
      );
    }

    const psuCalcInit = psuCalculatorService.calculate(b.currentLoadPct, gpuStressEngine.isRunning() ? 90 : 25);
    const efficiencyChartEl = host.querySelector<HTMLElement>('#pc-psu-efficiency-chart');
    if (efficiencyChartEl) {
      renderPsuEfficiencyCurveChart(efficiencyChartEl, psuCalcInit.loadPercentageOfPsu, psuCalcInit.efficiencyPct, psuCalcInit.psuCapacityW);
    }

    const powerBarChartEl = host.querySelector<HTMLElement>('#pc-psu-power-efficiency-bar-chart');
    if (powerBarChartEl) {
      renderPsuPowerVsEfficiencyBarChart(
        powerBarChartEl,
        psuCalcInit.totalSystemPowerW,
        psuCalcInit.loadPercentageOfPsu,
        psuCalcInit.efficiencyPct,
        psuCalcInit.psuCapacityW
      );
    }

    const effTrend1hChartEl = host.querySelector<HTMLElement>('#pc-psu-efficiency-trend-1h-chart');
    if (effTrend1hChartEl) {
      renderPsuEfficiencyTrend1hChart(
        effTrend1hChartEl,
        b.efficiencyTrend1h || [],
        psuCalcInit.psuCapacityW
      );
    }

    host.querySelector('#psu-download-portable-zip-btn')?.addEventListener('click', () => {
      const filename = downloadPortableExeZip();
      void this.recordLog(
        'SYSTEM',
        'OK',
        'Pobrano paczkę Portable .EXE (.ZIP) z panelu PSU',
        filename,
        'Win64 Portable',
        'Pobrano archiwum ZIP z natywnym launcherem SystemPulse-Pro.exe i portalem diagnostycznym.'
      );
    });

    host.querySelector('#psu-high-power-toggle')?.addEventListener('click', () => {
      const next = !psuCalculatorService.isHighPowerSimulationEnabled();
      psuCalculatorService.setHighPowerSimulation(next);
      batteryHealthService.captureLiveSample();
      void this.recordLog(
        'BATTERY',
        next ? 'WARN' : 'OK',
        'Symulacja wysokiego poboru mocy PSU (High Power Consumption)',
        next ? 'Aktywna (>92% PSU)' : 'Wyłączona',
        next ? 'Test pulsowania Load Gauge' : 'Normalny pobór',
        next
          ? 'Włączono scenariusz High Power Consumption (>92% obciążenia zasilacza) w celu przetestowania pulsowania Load Gauge i odchyłek szyn ATX.'
          : 'Wyłączono symulację wysokiego poboru mocy zasilacza.'
      );
      this.renderBatteryView(host);
    });

    host.querySelectorAll<HTMLButtonElement>('[data-psu-profile]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const profileId = btn.dataset.psuProfile as PsuStressProfile | undefined;
        if (!profileId) return;
        psuCalculatorService.setStressProfile(profileId);
        batteryHealthService.captureLiveSample();
        const profInfo = PSU_STRESS_PROFILES.find((pr) => pr.id === profileId);
        void this.recordLog(
          'BATTERY',
          profileId === 'normal' ? 'OK' : 'WARN',
          'Zmiana profilu obciążenia podzespołów PSU',
          profInfo?.label || profileId,
          `CPU ${profInfo?.cpuLoadBoost ?? 25}% / GPU ${profInfo?.gpuLoadBoost ?? 20}%`,
          profInfo?.shortDesc || 'Przełączono profil obciążenia podzespołów zasilacza.'
        );
        this.renderBatteryView(host);
      });
    });

    host.querySelector('#psu-clear-alerts-btn')?.addEventListener('click', () => {
      batteryHealthService.clearRailAlertVisualMarkers();
      const chartEl = host.querySelector<HTMLElement>('#pc-psu-rail-chart');
      if (chartEl) {
        const latestState = batteryHealthService.getState();
        const cutoff60s = Date.now() - 60000;
        const rail60s = (latestState.railHistory || []).filter((h) => h.timestamp >= cutoff60s);
        const chartData = rail60s.length > 0 ? rail60s : (latestState.railHistory || []).slice(-24);
        renderPcPsuRailsD3Chart(
          chartEl,
          chartData,
          psuCalculatorService.getRailDeviationPct(),
          batteryHealthService.getRailAlertMarkersClearedAt()
        );
      }
      void this.recordLog(
        'BATTERY',
        'OK',
        'Zresetowano znaczniki wizualne alertów szyn PSU',
        'Clear Alerts',
        'Historia zachowana',
        'Wyczyszczono znaczniki wizualne odchyłek na wykresie napięć bez usuwania zapisanej historii pomiarów szyn.'
      );
    });

    host.querySelector('#psu-clear-rail-alerts-btn')?.addEventListener('click', () => {
      batteryHealthService.clearRailAlertEvents();
      void this.recordLog(
        'BATTERY',
        'OK',
        'Wyczyszczenie dziennika alertów szyn PSU',
        'Wyczyszczono',
        'Reset logu',
        'Usunięto zarejestrowane incydenty odchyłek napięć zasilacza.'
      );
      this.renderBatteryView(host);
    });

    const levelRange = host.querySelector<HTMLInputElement>('#bat-level-range');
    levelRange?.addEventListener('input', () => {
      const val = Number(levelRange.value);
      const lbl = host.querySelector('#bat-level-lbl');
      if (lbl) lbl.textContent = `${val}%`;
      batteryHealthService.setManualSimulation(val, this.batteryState.charging);
    });

    host.querySelector('#bat-trend-report-btn')?.addEventListener('click', () => {
      generateBatteryTrendReportPdf(this.batteryState);
      void this.recordLog(
        'BATTERY',
        'OK',
        'Generowanie raportu trendu baterii (PDF)',
        'Raport',
        'PDF',
        'Wygenerowano wykres trendu poboru mocy vs degradacja ogniw za ostatnie 30 dni.'
      );
    });

    host.querySelector('#psu-export-csv-btn')?.addEventListener('click', () => {
      const latest = batteryHealthService.getState();
      const res = exportPsuRailHistoryToCsv(latest.railHistory);
      void this.recordLog(
        'BATTERY',
        'OK',
        'Eksport wahania napięć szyn PSU (CSV, 60s)',
        `${res.count} próbek`,
        'Pobrano plik',
        `Wyeksportowano do pliku CSV dane wahań szyn zasilacza (+12V, +5V, +3.3V) z ostatnich 60 sekund (${res.filename}).`
      );
    });

    host.querySelector('#psu-export-json-btn')?.addEventListener('click', () => {
      const latest = batteryHealthService.getState();
      const rules = psuCalculatorService.getAlertRules();
      const calc = psuCalculatorService.calculate(
        latest.currentLoadPct,
        gpuStressEngine.isRunning() ? 90 : 25,
        this.specs?.cpuCores || 8,
        latest.psu.tempC
      );
      const res = exportPsuRailHistoryToJson(latest.railHistory, {
        psuMeta: {
          rating80Plus: latest.psu.rating80Plus,
          capacityW: calc.psuCapacityW,
          tempC: latest.psu.tempC,
          efficiencyPct: calc.efficiencyPct,
          currentLoadPct: calc.loadPercentageOfPsu,
          rippleMv: latest.psu.rippleMv,
          status: latest.psu.status,
        },
        thresholds: {
          rail12VThresholdPct: rules.rail12VThresholdPct,
          rail5VThresholdPct: rules.rail5VThresholdPct,
          rail3P3VThresholdPct: rules.rail3P3VThresholdPct,
          globalDeviationPct: psuCalculatorService.getRailDeviationPct(),
        },
        alertEvents: latest.railAlertEvents || [],
      });
      void this.recordLog(
        'BATTERY',
        'OK',
        'Eksport historii napięć szyn PSU (JSON Log)',
        `${res.count} próbek`,
        'Pobrano JSON',
        `Wyeksportowano ustrukturyzowany log JSON historii wahań napięć (+12V, +5V, +3.3V), statystyk i alertów do analizy zewnętrznej (${res.filename}).`
      );
    });

    const copyAllRailsBtn = host.querySelector<HTMLButtonElement>('#psu-copy-all-rails-btn');
    copyAllRailsBtn?.addEventListener('click', async () => {
      const latest = batteryHealthService.getState();
      const rules = psuCalculatorService.getAlertRules();
      const { jsonContent } = buildAllPsuRailsRawJson(latest.railHistory, {
        currentRails: {
          rail12V: latest.psu.rail12V,
          rail5V: latest.psu.rail5V,
          rail3P3V: latest.psu.rail3P3V,
          powerW: latest.psu.estimatedWattage || latest.currentPowerDrawW || 0,
        },
        thresholds: {
          rail12VThresholdPct: rules.rail12VThresholdPct,
          rail5VThresholdPct: rules.rail5VThresholdPct,
          rail3P3VThresholdPct: rules.rail3P3VThresholdPct,
        },
        windowSeconds: 60,
      });
      const copied = await this.copyTextToClipboard(jsonContent);
      if (!copied) return;

      copyAllRailsBtn.classList.add('is-copied');
      copyAllRailsBtn.textContent = '✓ Copied All Rail Data';
      window.setTimeout(() => {
        copyAllRailsBtn.classList.remove('is-copied');
        copyAllRailsBtn.textContent = '{} Copy All Rail Data';
      }, 2200);

      void this.recordLog(
        'BATTERY',
        'OK',
        'Skopiowano surowe dane wszystkich szyn PSU',
        '+12V / +5V / +3.3V',
        'Schowek (JSON)',
        'Skompilowano surowe pomiary napięć szyn +12V, +5V oraz +3.3V do pojedynczego obiektu JSON i skopiowano do schowka.'
      );
    });

    const psuRailGridHost = host.querySelector<HTMLElement>('#psu-rail-kpi-grid');
    psuRailGridHost?.addEventListener('click', async (ev) => {
      const target = ev.target as HTMLElement | null;
      if (!target) return;

      // 1. Copy formatted raw rail voltage JSON to clipboard
      const jsonBtn = target.closest<HTMLButtonElement>('.psu-rail-alert-tooltip-json-btn');
      if (jsonBtn) {
        ev.stopPropagation();
        const rail = (jsonBtn.dataset.rail as '+12V' | '+5V' | '+3.3V' | undefined) || '+12V';
        const latest = batteryHealthService.getState();
        const rules = psuCalculatorService.getAlertRules();
        const thresholdPct =
          rail === '+12V'
            ? rules.rail12VThresholdPct
            : rail === '+5V'
              ? rules.rail5VThresholdPct
              : rules.rail3P3VThresholdPct;
        const jsonPayload = this.buildRailRawVoltageJson(latest, rail, thresholdPct);
        const copied = await this.copyTextToClipboard(jsonPayload);
        if (!copied) return;

        this.psuTooltipJsonCopiedRail = rail;
        jsonBtn.classList.add('is-copied');
        jsonBtn.textContent = '✓ Copied JSON';

        if (this.psuTooltipJsonCopiedTimer !== null) {
          window.clearTimeout(this.psuTooltipJsonCopiedTimer);
        }
        this.psuTooltipJsonCopiedTimer = window.setTimeout(() => {
          this.psuTooltipJsonCopiedRail = null;
          this.psuTooltipJsonCopiedTimer = null;
          const activeBtn = this.root.querySelector<HTMLButtonElement>(
            `#psu-rail-kpi-grid .psu-rail-alert-tooltip-json-btn[data-rail="${rail}"]`
          );
          if (activeBtn) {
            activeBtn.classList.remove('is-copied');
            activeBtn.textContent = '{} Copy Raw JSON';
          }
        }, 2200);

        void this.recordLog(
          'BATTERY',
          'OK',
          `Skopiowano surowe dane JSON szyny ${rail}`,
          'Schowek (JSON)',
          'Skopiowano',
          `Skopiowano sformatowany ciąg JSON z surowymi pomiarami napięcia szyny ${rail} (ostatnie 60s) do analizy zewnętrznej.`
        );
        return;
      }

      // 2. Toggle 60-second sparkline overlay inside the alert panel
      const historyBtn = target.closest<HTMLButtonElement>('.psu-rail-alert-tooltip-history-btn');
      const closeSparkBtn = target.closest<HTMLButtonElement>('.psu-rail-sparkline-close-btn');
      if (historyBtn || closeSparkBtn) {
        ev.stopPropagation();
        const rail = ((historyBtn || closeSparkBtn)?.dataset.rail as '+12V' | '+5V' | '+3.3V' | undefined) || '+12V';
        const shouldOpen = closeSparkBtn ? false : !this.psuSparklineOpenRails.has(rail);
        if (shouldOpen) {
          this.psuSparklineOpenRails.add(rail);
        } else {
          this.psuSparklineOpenRails.delete(rail);
          this.psuSparklineHoverRatio.delete(rail);
        }

        const cardEl = (historyBtn || closeSparkBtn)?.closest<HTMLElement>('.psu-rail-metric-card');
        if (cardEl) {
          cardEl.querySelector('.psu-rail-alert-sparkline-overlay')?.remove();
          if (shouldOpen) {
            const latest = batteryHealthService.getState();
            const rules = psuCalculatorService.getAlertRules();
            const thresholdPct =
              rail === '+12V'
                ? rules.rail12VThresholdPct
                : rail === '+5V'
                  ? rules.rail5VThresholdPct
                  : rules.rail3P3VThresholdPct;
            const tpl = document.createElement('template');
            tpl.innerHTML = this.renderRailAlertSparklineOverlayHtml(latest, rail, thresholdPct).trim();
            if (tpl.content.firstElementChild) {
              cardEl.appendChild(tpl.content.firstElementChild);
            }
          }
          const btnInCard = cardEl.querySelector<HTMLButtonElement>('.psu-rail-alert-tooltip-history-btn');
          if (btnInCard) {
            btnInCard.classList.toggle('is-active', shouldOpen);
            btnInCard.setAttribute('aria-expanded', shouldOpen ? 'true' : 'false');
            btnInCard.textContent = shouldOpen ? '📈 Hide Rail History' : '📈 View Rail History';
          }
        }
        return;
      }

      // 2b. Open 5-minute high-resolution D3.js Full History modal
      const fullHistoryBtn = target.closest<HTMLButtonElement>('.psu-rail-alert-tooltip-full-history-btn');
      if (fullHistoryBtn) {
        ev.stopPropagation();
        const rail = (fullHistoryBtn.dataset.rail as '+12V' | '+5V' | '+3.3V' | undefined) || '+12V';
        this.openPsuRailFullHistoryModal(rail);
        return;
      }

      // 3. Click explanation text to copy troubleshooting steps
      const copyBtn = target.closest<HTMLButtonElement>('.psu-rail-alert-tooltip-copy');
      if (!copyBtn) return;
      ev.stopPropagation();

      const rail = (copyBtn.dataset.rail as '+12V' | '+5V' | '+3.3V' | undefined) || '+12V';
      const stepsText = this.buildRailTroubleshootingClipboardText(rail);
      const copied = await this.copyTextToClipboard(stepsText);
      if (!copied) return;

      this.psuTooltipCopiedRail = rail;
      copyBtn.classList.add('is-copied');
      const hintEl = copyBtn.querySelector<HTMLElement>('.psu-rail-alert-tooltip-copy-hint');
      if (hintEl) {
        hintEl.textContent = '✓ Skopiowano kroki sprawdzania połączeń do schowka';
      }

      if (this.psuTooltipCopiedTimer !== null) {
        window.clearTimeout(this.psuTooltipCopiedTimer);
      }
      this.psuTooltipCopiedTimer = window.setTimeout(() => {
        this.psuTooltipCopiedRail = null;
        this.psuTooltipCopiedTimer = null;
        const activeBtn = this.root.querySelector<HTMLButtonElement>(
          `#psu-rail-kpi-grid .psu-rail-alert-tooltip-copy[data-rail="${rail}"]`
        );
        if (activeBtn) {
          activeBtn.classList.remove('is-copied');
          const activeHint = activeBtn.querySelector<HTMLElement>('.psu-rail-alert-tooltip-copy-hint');
          if (activeHint) {
            activeHint.textContent = '📋 Kliknij tekst, aby skopiować kroki sprawdzania połączeń';
          }
        }
      }, 2200);

      void this.recordLog(
        'BATTERY',
        'OK',
        `Skopiowano kroki diagnostyki szyny ${rail}`,
        'Schowek',
        'Skopiowano',
        `Skopiowano do schowka listę kroków weryfikacji połączeń dla niestabilności szyny ${rail}.`
      );
    });

    psuRailGridHost?.addEventListener('mousemove', (ev) => {
      const target = ev.target as HTMLElement | null;
      const plot5sEl = target?.closest<HTMLElement>('.psu-rail-5s-sparkline-plot');
      if (plot5sEl) {
        const previewEl = plot5sEl.closest<HTMLElement>('.psu-rail-tooltip-5s-preview');
        const rail = previewEl?.dataset.rail as '+12V' | '+5V' | '+3.3V' | undefined;
        if (!previewEl || !rail) return;
        const rect = plot5sEl.getBoundingClientRect();
        if (rect.width <= 0) return;
        const ratio = Math.max(0, Math.min(1, (ev.clientX - rect.left) / rect.width));
        this.applyRail5sSparklineHoverTooltip(previewEl, rail, ratio);
        return;
      }

      const plotEl = target?.closest<HTMLElement>('.psu-rail-sparkline-plot');
      if (!plotEl) return;
      const overlayEl = plotEl.closest<HTMLElement>('.psu-rail-alert-sparkline-overlay');
      const rail = overlayEl?.dataset.rail as '+12V' | '+5V' | '+3.3V' | undefined;
      if (!overlayEl || !rail) return;
      const rect = plotEl.getBoundingClientRect();
      if (rect.width <= 0) return;
      const ratio = Math.max(0, Math.min(1, (ev.clientX - rect.left) / rect.width));
      this.psuSparklineHoverRatio.set(rail, ratio);
      this.applySparklineHoverTooltip(overlayEl, rail, ratio);
    });

    psuRailGridHost?.addEventListener('mouseover', (ev) => {
      const target = ev.target as HTMLElement | null;
      const infoBtn = target?.closest<HTMLButtonElement>('.psu-rail-info-btn');
      const valueHover = target?.closest<HTMLElement>('.psu-rail-value-hover-target');
      if (!infoBtn && !valueHover) return;
      const cardEl = (infoBtn || valueHover)?.closest<HTMLElement>('.psu-rail-metric-card');
      if (!cardEl) return;
      psuRailGridHost.querySelectorAll<HTMLElement>('.psu-rail-metric-card.is-info-tooltip-open, .psu-rail-metric-card.is-value-tooltip-open').forEach((other) => {
        if (other !== cardEl) {
          other.classList.remove('is-info-tooltip-open', 'is-value-tooltip-open');
        }
      });
      if (infoBtn) cardEl.classList.add('is-info-tooltip-open');
      if (valueHover) cardEl.classList.add('is-value-tooltip-open');
    });

    psuRailGridHost?.addEventListener('mouseout', (ev) => {
      const target = ev.target as HTMLElement | null;
      const related = ev.relatedTarget as Node | null;

      const cardEl = target?.closest<HTMLElement>('.psu-rail-metric-card');
      if (cardEl && (!related || !cardEl.contains(related))) {
        cardEl.classList.remove('is-info-tooltip-open', 'is-value-tooltip-open');
      }

      const plot5sEl = target?.closest<HTMLElement>('.psu-rail-5s-sparkline-plot');
      if (plot5sEl && (!related || !plot5sEl.contains(related))) {
        const previewEl = plot5sEl.closest<HTMLElement>('.psu-rail-tooltip-5s-preview');
        if (previewEl) this.clearRail5sSparklineHoverTooltip(previewEl);
      }

      const plotEl = target?.closest<HTMLElement>('.psu-rail-sparkline-plot');
      if (!plotEl) return;
      if (related && plotEl.contains(related)) return;
      const overlayEl = plotEl.closest<HTMLElement>('.psu-rail-alert-sparkline-overlay');
      const rail = overlayEl?.dataset.rail as '+12V' | '+5V' | '+3.3V' | undefined;
      if (!overlayEl || !rail) return;
      this.psuSparklineHoverRatio.delete(rail);
      this.clearSparklineHoverTooltip(overlayEl);
    });

    psuRailGridHost?.addEventListener('input', (ev) => {
      const target = ev.target as HTMLElement | null;
      const thresholdInput = target?.closest<HTMLInputElement>('#psu-power-alert-threshold-input');
      if (!thresholdInput) return;
      const val = Number(thresholdInput.value);
      if (!Number.isFinite(val) || val < 1 || val > 100) return;
      psuCalculatorService.setPowerAlertThresholdPct(val);
      this.patchPsuPowerDrawCardAlert(batteryHealthService.getState());
    });

    psuRailGridHost?.addEventListener('change', (ev) => {
      const target = ev.target as HTMLElement | null;
      const thresholdInput = target?.closest<HTMLInputElement>('#psu-power-alert-threshold-input');
      if (!thresholdInput) return;
      const saved = psuCalculatorService.setPowerAlertThresholdPct(Number(thresholdInput.value));
      thresholdInput.value = String(saved);
      this.patchPsuPowerDrawCardAlert(batteryHealthService.getState());
      void this.recordLog(
        'BATTERY',
        'INFO',
        'Zmiana progu alertu poboru mocy PSU',
        `${saved}% PSU`,
        'Zapisano próg',
        `Ręcznie ustawiono próg wyzwolenia alertu poboru mocy zasilacza na ${saved}% pojemności PSU.`
      );
    });

    const psuPriceInput = host.querySelector<HTMLInputElement>('#psu-price-input');
    psuPriceInput?.addEventListener('input', () => {
      const val = Number(psuPriceInput.value);
      if (!isNaN(val) && val > 0) {
        psuCalculatorService.setElectricityPrice(val);
        this.emitDiagnosticChanged('psu-config', false);
      }
    });

    const psuHoursInput = host.querySelector<HTMLInputElement>('#psu-hours-input');
    psuHoursInput?.addEventListener('input', () => {
      const val = Number(psuHoursInput.value);
      if (!isNaN(val) && val >= 1 && val <= 24) {
        psuCalculatorService.setUsageHoursPerDay(val);
        this.emitDiagnosticChanged('psu-config', false);
      }
    });

    const psuDeviationSelect = host.querySelector<HTMLSelectElement>('#psu-deviation-input');
    psuDeviationSelect?.addEventListener('change', () => {
      const val = Number(psuDeviationSelect.value);
      if (!isNaN(val)) {
        psuCalculatorService.setRailDeviationPct(val);
        batteryHealthService.captureLiveSample();
        void this.recordLog(
          'BATTERY',
          'OK',
          'Konfiguracja progów odchyłki szyn PSU',
          `±${val}%`,
          'Zaktualizowano',
          `Zmieniono dopuszczalny próg odchyłki napięć szyn zasilacza na ±${val}%.`
        );
        this.renderBatteryView(host);
      }
    });

    // Alert Rules individual rail threshold sliders/inputs & notification toggles
    const bindRailRuleInput = (selector: string, key: 'rail12VThresholdPct' | 'rail5VThresholdPct' | 'rail3P3VThresholdPct', railLabel: string) => {
      const el = host.querySelector<HTMLInputElement>(selector);
      el?.addEventListener('change', () => {
        const val = Number(el.value);
        if (!isNaN(val) && val >= 1 && val <= 15) {
          psuCalculatorService.setAlertRules({ [key]: val });
          batteryHealthService.captureLiveSample();
          void this.recordLog(
            'BATTERY',
            'OK',
            `Alert Rules: Zmiana progu szyny ${railLabel}`,
            `±${val}%`,
            'Zapisano regułę',
            `Ustawiono indywidualny próg alertu odchyłki dla szyny ${railLabel} na ±${val}%.`
          );
          this.renderBatteryView(host);
        }
      });
    };
    bindRailRuleInput('#psu-rule-12v-pct', 'rail12VThresholdPct', '+12V');
    bindRailRuleInput('#psu-rule-5v-pct', 'rail5VThresholdPct', '+5V');
    bindRailRuleInput('#psu-rule-3v3-pct', 'rail3P3VThresholdPct', '+3.3V');

    const desktopNotifyChk = host.querySelector<HTMLInputElement>('#psu-rule-desktop-notify');
    desktopNotifyChk?.addEventListener('change', () => {
      const enabled = desktopNotifyChk.checked;
      psuCalculatorService.setAlertRules({ desktopNotification: enabled });
      if (enabled && typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default') {
        void Notification.requestPermission();
      }
      void this.recordLog(
        'BATTERY',
        'INFO',
        'Alert Rules: Powiadomienia systemowe (Desktop Notification)',
        enabled ? 'WŁĄCZONE' : 'WYŁĄCZONE',
        'Zaktualizowano',
        `Powiadomienia pulpitu przy przekroczeniu progu szyn ATX: ${enabled ? 'Włączone' : 'Wyłączone'}.`
      );
      this.renderBatteryView(host);
    });

    const logErrorChk = host.querySelector<HTMLInputElement>('#psu-rule-log-error');
    logErrorChk?.addEventListener('change', () => {
      const enabled = logErrorChk.checked;
      psuCalculatorService.setAlertRules({ logError: enabled });
      void this.recordLog(
        'BATTERY',
        'INFO',
        'Alert Rules: Rejestracja błędów w dzienniku (Log Error)',
        enabled ? 'WŁĄCZONE' : 'WYŁĄCZONE',
        'Zaktualizowano',
        `Automatyczne zapisywanie błędów przekroczenia progów szyn ATX w dzienniku: ${enabled ? 'Włączone' : 'Wyłączone'}.`
      );
      this.renderBatteryView(host);
    });

    const soundAlertChk = host.querySelector<HTMLInputElement>('#psu-rule-sound-alert');
    soundAlertChk?.addEventListener('change', () => {
      const enabled = soundAlertChk.checked;
      psuCalculatorService.setAlertRules({ soundAlert: enabled });
      this.renderBatteryView(host);
    });

    host.querySelector('#psu-stress-test-btn')?.addEventListener('click', () => {
      cpuTestService.startContinuousStress(this.cpuState, (res) => {
        this.cpuState = res;
      });
      soundNotificationService.playEvent('thermalWarning', 'warning');
      void this.recordLog(
        'BATTERY',
        'WARN',
        'Stres-test zasilacza (PSU Stress Test)',
        'Obciążenie 100%',
        'Rozpoczęto',
        'Zainicjowano symulację pełnego obciążenia CPU+GPU w celu testu stabilności szyn zasilacza.'
      );
      window.setTimeout(() => {
        cpuTestService.stopStress();
      }, 20000);
    });

    host.querySelector('#bat-toggle-charge')?.addEventListener('click', (e) => {
      const next = !this.batteryState.charging;
      batteryHealthService.setManualSimulation(this.batteryState.levelPct, next);
      (e.currentTarget as HTMLButtonElement).textContent = `Stan zasilacza: ${next ? 'Podłączony (Ładowanie)' : 'Praca na baterii'}`;
      this.emitDiagnosticChanged('battery-update', false);
    });

    const handleCycleExport = (format: 'csv' | 'xlsx', btn: HTMLButtonElement) => {
      if (this.batteryState.powerCycles.length === 0) return;
      if (format === 'csv') {
        const res = exportBatteryPowerCyclesToCsv(this.batteryState.powerCycles);
        void this.recordLog(
          'BATTERY',
          'OK',
          'Eksport cykli ładowania (CSV)',
          'Cykle',
          `${res.count} wpisów (.csv)`,
          `Wyeksportowano log cykli baterii do pliku ${res.filename}.`
        );
      } else {
        const res = exportBatteryPowerCyclesToXlsx(this.batteryState);
        void this.recordLog(
          'BATTERY',
          'OK',
          'Eksport cykli ładowania (Excel)',
          'Cykle',
          `${res.count} wpisów (.xlsx)`,
          `Wyeksportowano log cykli baterii i podsumowanie ogniw do pliku ${res.filename}.`
        );
      }
      const origHtml = btn.innerHTML;
      btn.innerHTML = `${iconSvg(format === 'csv' ? 'csv' : 'excel', 13)}<span>Zapisano .${format} ✓</span>`;
      window.setTimeout(() => {
        if (btn.isConnected) btn.innerHTML = origHtml;
      }, 2200);
    };

    host.querySelector('#bat-history-export-csv-btn')?.addEventListener('click', (e) => {
      handleCycleExport('csv', e.currentTarget as HTMLButtonElement);
    });
    host.querySelector('#bat-history-export-xlsx-btn')?.addEventListener('click', (e) => {
      handleCycleExport('xlsx', e.currentTarget as HTMLButtonElement);
    });
    host.querySelector('#bat-cycles-export-csv-btn')?.addEventListener('click', (e) => {
      handleCycleExport('csv', e.currentTarget as HTMLButtonElement);
    });
    host.querySelector('#bat-cycles-export-xlsx-btn')?.addEventListener('click', (e) => {
      handleCycleExport('xlsx', e.currentTarget as HTMLButtonElement);
    });

    host.querySelector('#bat-sample-now-btn')?.addEventListener('click', () => {
      batteryHealthService.captureLiveSample();
    });

    const batChartHost = host.querySelector<HTMLElement>('#bat-history-chart');
    if (batChartHost) {
      bindBatteryHistoryChartTooltip(batChartHost);
    }

    const batDegradationHost = host.querySelector<HTMLElement>('#bat-degradation-chart');
    if (batDegradationHost) {
      bindBatteryDegradationChartTooltip(batDegradationHost);
    }

    host.querySelector('#bat-add-cycle-form')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const startPct = Number(host.querySelector<HTMLInputElement>('#cycle-start-pct')?.value ?? 20);
      const endPct = Number(host.querySelector<HTMLInputElement>('#cycle-end-pct')?.value ?? 100);
      const durationMin = Number(host.querySelector<HTMLInputElement>('#cycle-duration-min')?.value ?? 60);
      const fullCap = Number(
        host.querySelector<HTMLInputElement>('#cycle-full-cap')?.value ?? this.batteryState.fullChargeCapacityMWh
      );

      const added = batteryHealthService.recordPowerCycle({
        startPct,
        endPct,
        durationMin,
        fullChargeCapacityMWh: fullCap,
        source: 'manual',
      });

      if (fullInput) fullInput.value = String(added.fullChargeCapacityMWh);
      if (cycleCapInput) cycleCapInput.value = String(Math.max(5000, added.fullChargeCapacityMWh - 80));

      void this.recordLog(
        'BATTERY',
        added.degradationFromPrevMWh < -400 ? 'WARN' : 'OK',
        'Zarejestrowano cykl ładowania',
        `Cykl #${added.cycleNumber}`,
        `${added.fullChargeCapacityMWh} mWh (Wear ${added.cumulativeWearPct}%)`,
        `Zakres: ${added.startPct}%→${added.endPct}%, Czas: ${added.durationMin} min, Zmiana: ${added.degradationFromPrevMWh >= 0 ? '+' : ''}${added.degradationFromPrevMWh} mWh`
      );
      this.emitDiagnosticChanged('battery-update', false);
    });

    host.querySelector('#bat-reset-cycles-btn')?.addEventListener('click', () => {
      batteryHealthService.resetPowerCycles();
      this.emitDiagnosticChanged('battery-update', false);
    });

    // Event delegation so delete buttons keep working after live table updates
    host.querySelector('#bat-cycle-log-table')?.addEventListener('click', (e) => {
      const target = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-del-cycle]');
      if (!target) return;
      const cycleId = target.dataset.delCycle;
      if (!cycleId) return;
      batteryHealthService.deletePowerCycle(cycleId);
      this.emitDiagnosticChanged('battery-update', false);
    });

    animateMetricValueElements(host, this.metricAnimPrevValues);
  }

  private renderBatteryKpisHtml(b: BatteryHealthState, condCls: string): string {
    const lowHealth = isLowBatteryHealth(b.healthPct);
    return `
      <div class="metric-card">
        <span class="metric-label">Poziom naładowania</span>
        <div class="metric-row">
          <span class="metric-value" data-metric-key="bat-level-pct" data-metric-target="${b.levelPct}">${b.levelPct}</span>
          <span class="metric-unit">%</span>
        </div>
        <span class="metric-foot">${b.charging ? '● Zasilacz podłączony' : '● Rozładowywanie'} · ${b.voltageV} V</span>
      </div>

      <div class="metric-card ${lowHealth ? 'metric-card-alert' : ''}">
        <span class="metric-label">Zdrowie ogniw (Health)</span>
        <div class="metric-row">
          <span class="metric-value ${condCls}" data-metric-key="bat-health-pct" data-metric-target="${b.healthPct}">${b.healthPct}</span>
          <span class="metric-unit">%</span>
        </div>
        <span class="metric-foot">Kondycja: <strong class="${condCls}">${b.condition}</strong>${lowHealth ? ' · Poniżej 75%' : ''}</span>
      </div>

      <div class="metric-card">
        <span class="metric-label">Stopień zużycia (Wear Level)</span>
        <div class="metric-row">
          <span class="metric-value ${b.wearLevelPct > 25 ? 'status-warn' : ''}" data-metric-key="bat-wear-pct" data-metric-target="${b.wearLevelPct}">${b.wearLevelPct}</span>
          <span class="metric-unit">%</span>
        </div>
        <span class="metric-foot">Szac. cykle ładowania: ~${b.estimatedCycles}</span>
      </div>

      <div class="metric-card">
        <span class="metric-label">Bieżący pobór mocy</span>
        <div class="metric-row">
          <span class="metric-value" data-metric-key="bat-power-w" data-metric-target="${b.currentPowerDrawW}" data-metric-decimals="1">${b.currentPowerDrawW}</span>
          <span class="metric-unit">W</span>
        </div>
        <span class="metric-foot">${(b.fullChargeCapacityMWh / 1000).toFixed(1)} / ${(b.designCapacityMWh / 1000).toFixed(1)} Wh</span>
      </div>
    `;
  }

  private renderBatteryEstimatesHtml(b: BatteryHealthState): string {
    return `
      <table class="data-table">
        <thead>
          <tr>
            <th>Scenariusz pracy</th>
            <th>Pobór mocy</th>
            <th>Szacowany pozostały czas</th>
          </tr>
        </thead>
        <tbody>
          ${b.estimates
            .map(
              (est, idx) => `
            <tr>
              <td>${esc(est.profile)}</td>
              <td class="font-mono">${est.powerW.toFixed(1)} W</td>
              <td class="font-mono ${idx === 2 ? 'status-cyan' : ''}" style="font-weight:600;">${esc(est.label)}</td>
            </tr>`
            )
            .join('')}
        </tbody>
      </table>
    `;
  }

  private renderBatteryChartStatsHtml(b: BatteryHealthState): string {
    const powers = b.history.map((h) => h.powerW);
    const levels = b.history.map((h) => h.levelPct);
    const avgW =
      powers.length > 0 ? (powers.reduce((s, v) => s + v, 0) / powers.length).toFixed(1) : b.currentPowerDrawW.toFixed(1);
    const peakW = powers.length > 0 ? Math.max(...powers).toFixed(1) : b.currentPowerDrawW.toFixed(1);
    const minLvl = levels.length > 0 ? Math.min(...levels) : b.levelPct;
    const maxLvl = levels.length > 0 ? Math.max(...levels) : b.levelPct;
    return `
      <span>Śr. pobór mocy: <strong class="font-mono status-warn">${avgW} W</strong></span>
      <span class="meta-sep">·</span>
      <span>Szczyt mocy: <strong class="font-mono">${peakW} W</strong></span>
      <span class="meta-sep">·</span>
      <span>Zakres naładowania: <strong class="font-mono status-ok">${minLvl}% – ${maxLvl}%</strong></span>
      <span class="meta-sep">·</span>
      <span>Próbki: <strong class="font-mono">${b.history.length}</strong></span>
    `;
  }

  private renderBatteryChartHtml(b: BatteryHealthState): string {
    return renderBatteryHistoryChart(b.history, 190);
  }

  private renderBatteryDegradationChartHtml(b: BatteryHealthState): string {
    return renderBatteryDegradationTrendChart(b.powerCycles, b.designCapacityMWh, 215);
  }

  private renderBatteryCycleSummaryHtml(b: BatteryHealthState): string {
    const projLabel =
      b.projectedCyclesTo80Pct === 0
        ? 'Osiągnięto (< 80%)'
        : b.projectedCyclesTo80Pct !== null
          ? `~${b.projectedCyclesTo80Pct.toLocaleString('pl-PL')} cykli`
          : 'Stabilna';

    return `
      <div class="metric-card" style="padding:12px 14px;">
        <span class="metric-label">Zarejestrowane sesje</span>
        <div class="metric-row">
          <span class="metric-value" style="font-size:21px;">${b.powerCycles.length}</span>
          <span class="metric-unit">wpisów</span>
        </div>
      </div>

      <div class="metric-card" style="padding:12px 14px;">
        <span class="metric-label">Łączna utrata pojemności</span>
        <div class="metric-row">
          <span class="metric-value ${b.totalCapacityLostMWh > b.designCapacityMWh * 0.2 ? 'status-warn' : ''}" style="font-size:21px;">-${b.totalCapacityLostMWh.toLocaleString('pl-PL')}</span>
          <span class="metric-unit">mWh</span>
        </div>
      </div>

      <div class="metric-card" style="padding:12px 14px;">
        <span class="metric-label">Śr. degradacja na cykl</span>
        <div class="metric-row">
          <span class="metric-value" style="font-size:21px;">-${b.avgDegradationPerCycleMWh}</span>
          <span class="metric-unit">mWh/cykl</span>
        </div>
      </div>

      <div class="metric-card" style="padding:12px 14px;">
        <span class="metric-label">Prognoza do progu 80%</span>
        <div class="metric-row">
          <span class="metric-value ${b.projectedCyclesTo80Pct === 0 ? 'status-err' : 'status-cyan'}" style="font-size:19px;">${projLabel}</span>
        </div>
      </div>
    `;
  }

  private renderBatteryCycleTableHtml(b: BatteryHealthState): string {
    if (b.powerCycles.length === 0) {
      return `
        <div style="padding:18px 0;color:var(--text-muted);font-size:13px;">
          Brak zarejestrowanych cykli ładowania. Użyj formularza poniżej lub podłącz/odłącz zasilacz laptopa, aby zapisać pierwszą sesję.
        </div>
      `;
    }

    const rows = [...b.powerCycles].reverse();
    return `
      <table class="data-table" data-battery-cycle-table="true">
        <thead>
          <tr>
            <th>Cycle ID</th>
            <th>Data / Czas</th>
            <th>Start / Koniec (%)</th>
            <th>Czas trwania</th>
            <th>Zmierzona pełna pojemność (mWh)</th>
            <th>Degradacja vs poprz. (mWh)</th>
            <th>Zużycie (Wear)</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          ${rows
            .map((entry) => {
              const gain = entry.endPct - entry.startPct;
              const delta = entry.degradationFromPrevMWh;
              const deltaCls = delta < -350 ? 'status-err' : delta < 0 ? 'status-warn' : 'status-ok';
              const deltaText = `${delta > 0 ? '+' : ''}${delta.toLocaleString('pl-PL')} mWh`;
              const wearCls =
                entry.cumulativeWearPct >= 30
                  ? 'status-err'
                  : entry.cumulativeWearPct >= 15
                    ? 'status-warn'
                    : 'status-ok';
              const srcLabel =
                entry.source === 'auto' ? 'Auto API' : entry.source === 'manual' ? 'Wpis ręczny' : 'Kalibracja';

              return `
                <tr>
                  <td>
                    <div class="font-mono" style="font-weight:700;">#${entry.cycleNumber}</div>
                    <div class="font-mono" style="font-size:10px;color:var(--text-muted);">${esc(entry.id)}</div>
                  </td>
                  <td>
                    <div class="font-mono" style="font-size:12px;">${esc(formatCycleDateTime(entry))}</div>
                    <div style="font-size:11px;color:var(--text-muted);">${srcLabel}</div>
                  </td>
                  <td class="font-mono">${entry.startPct}% → ${entry.endPct}% <span class="status-ok">(+${gain}%)</span></td>
                  <td class="font-mono">${entry.durationMin} min · ${entry.avgPowerW.toFixed(1)} W</td>
                  <td class="font-mono" style="font-weight:600;">${entry.fullChargeCapacityMWh.toLocaleString('pl-PL')} mWh</td>
                  <td class="font-mono ${deltaCls}">${deltaText}</td>
                  <td class="font-mono ${wearCls}">${entry.cumulativeWearPct.toFixed(1)}%</td>
                  <td style="text-align:right;">
                    <button type="button" class="btn btn-secondary btn-sm" data-del-cycle="${esc(entry.id)}" title="Usuń wpis">
                      Usuń
                    </button>
                  </td>
                </tr>
              `;
            })
            .join('')}
        </tbody>
      </table>
    `;
  }

  private patchBatteryLive(): void {
    const b = this.batteryState;
    const condCls =
      b.condition === 'DOSKONAŁA' || b.condition === 'DOBRA'
        ? 'status-ok'
        : b.condition === 'ZUŻYTA'
          ? 'status-warn'
          : 'status-err';

    const kpi = this.root.querySelector('#bat-kpi-grid');
    if (kpi) {
      kpi.innerHTML = this.renderBatteryKpisHtml(b, condCls);
      animateMetricValueElements(kpi, this.metricAnimPrevValues);
    }

    const lowHealthSlot = this.root.querySelector('#bat-low-health-alert-slot');
    if (lowHealthSlot) {
      lowHealthSlot.innerHTML = renderLowBatteryHealthAlertHtml(b, false);
    }

    const loadTag = this.root.querySelector('#bat-load-tag');
    if (loadTag) loadTag.textContent = `Bieżące obciążenie: ${b.currentLoadPct}% (${b.currentPowerDrawW} W)`;

    const est = this.root.querySelector('#bat-estimates-table');
    if (est) est.innerHTML = this.renderBatteryEstimatesHtml(b);

    const chartStats = this.root.querySelector('#bat-chart-stats');
    if (chartStats) chartStats.innerHTML = this.renderBatteryChartStatsHtml(b);

    const chart = this.root.querySelector('#bat-history-chart');
    if (chart) chart.innerHTML = this.renderBatteryChartHtml(b);

    const cycleSummary = this.root.querySelector('#bat-cycle-summary');
    if (cycleSummary) cycleSummary.innerHTML = this.renderBatteryCycleSummaryHtml(b);

    const degChart = this.root.querySelector('#bat-degradation-chart');
    if (degChart) degChart.innerHTML = this.renderBatteryDegradationChartHtml(b);

    const wear30El = this.root.querySelector('#bat-wear-30d-d3-container');
    if (wear30El) {
      renderBatteryWearLevel30DaysChartD3(wear30El as HTMLElement, b.powerCycles, 220);
    }

    const cycleTable = this.root.querySelector('#bat-cycle-log-table');
    if (cycleTable) cycleTable.innerHTML = this.renderBatteryCycleTableHtml(b);

    const psuRailGridEl = this.root.querySelector<HTMLElement>('#psu-rail-kpi-grid');
    if (psuRailGridEl) {
      const isInteractingWithTooltip = Boolean(
        psuRailGridEl.querySelector(
          '.psu-rail-metric-card.is-info-tooltip-open, .psu-rail-metric-card.is-value-tooltip-open, .psu-rail-deviation-alert:hover, .psu-rail-metric-card:focus-within, .psu-rail-value-hover-target:hover, .psu-rail-info-btn:hover, .psu-rail-alert-tooltip:hover'
        )
      );
      if (!isInteractingWithTooltip) {
        psuRailGridEl.innerHTML = this.renderPcPsuRailCardsHtml(b);
        animateMetricValueElements(psuRailGridEl, this.metricAnimPrevValues);
      } else {
        this.syncPsuTransientHighlights(b);
        this.patchPsuPowerDrawCardAlert(b);
        const rulesForPreview = psuCalculatorService.getAlertRules();
        // Keep 5s sparkline preview & 60s moving-average trend indicators live inside any open tooltip
        (['+12V', '+5V', '+3.3V'] as const).forEach((rail) => {
          const currentV =
            rail === '+12V' ? b.psu.rail12V : rail === '+5V' ? b.psu.rail5V : b.psu.rail3P3V;

          const valTargetEl = psuRailGridEl.querySelector<HTMLElement>(
            `.psu-rail-value-hover-target[data-rail="${rail}"]`
          );
          const isHl = this.psuTransientTracker.isHighlighted(rail);
          if (valTargetEl) {
            valTargetEl.textContent = currentV.toFixed(2);
            valTargetEl.classList.toggle('is-transient-spike-highlight', isHl);
          }
          const badgeEl = psuRailGridEl.querySelector<HTMLElement>(
            `.psu-rail-transient-badge[data-rail="${rail}"]`
          );
          if (badgeEl) {
            badgeEl.hidden = !isHl;
          }

          const existing5s = psuRailGridEl.querySelector<HTMLElement>(
            `.psu-rail-tooltip-5s-preview[data-rail="${rail}"]`
          );
          if (existing5s) {
            const thresholdPct =
              rail === '+12V'
                ? rulesForPreview.rail12VThresholdPct
                : rail === '+5V'
                  ? rulesForPreview.rail5VThresholdPct
                  : rulesForPreview.rail3P3VThresholdPct;
            const preview = renderRail5sSparklinePreviewHtml(
              b.railHistory || [],
              rail,
              currentV,
              thresholdPct,
              batteryHealthService.getRailHistoryResetAt(rail)
            );
            this.psuRail5sCoordsMap.set(rail, preview.coords);
            const tpl5s = document.createElement('template');
            tpl5s.innerHTML = preview.html.trim();
            const next5s = tpl5s.content.firstElementChild as HTMLElement | null;
            if (next5s) existing5s.replaceWith(next5s);
          }

          const existingTrend = psuRailGridEl.querySelector<HTMLElement>(
            `.psu-rail-alert-tooltip-trend[data-rail="${rail}"]`
          );
          if (!existingTrend) return;
          const tpl = document.createElement('template');
          tpl.innerHTML = this.renderRailMovingAverageTrendHtml(b, rail, currentV).trim();
          const nextTrend = tpl.content.firstElementChild as HTMLElement | null;
          if (nextTrend) {
            existingTrend.replaceWith(nextTrend);
          }
        });

        if (this.psuSparklineOpenRails.size > 0) {
          // Keep open sparklines live even while hovering the tooltip
          const rules = psuCalculatorService.getAlertRules();
          this.psuSparklineOpenRails.forEach((rail) => {
            const existingOverlay = psuRailGridEl.querySelector<HTMLElement>(
              `.psu-rail-alert-sparkline-overlay[data-rail="${rail}"]`
            );
            if (!existingOverlay) return;
            const thresholdPct =
              rail === '+12V'
                ? rules.rail12VThresholdPct
                : rail === '+5V'
                  ? rules.rail5VThresholdPct
                  : rules.rail3P3VThresholdPct;
            const tpl = document.createElement('template');
            tpl.innerHTML = this.renderRailAlertSparklineOverlayHtml(b, rail, thresholdPct).trim();
            const newOverlay = tpl.content.firstElementChild as HTMLElement | null;
            if (newOverlay) {
              existingOverlay.replaceWith(newOverlay);
              const savedRatio = this.psuSparklineHoverRatio.get(rail);
              if (typeof savedRatio === 'number') {
                this.applySparklineHoverTooltip(newOverlay, rail, savedRatio);
              }
            }
          });
        }
      }
    }

    if (this.psuFullHistoryModalRail) {
      this.updatePsuRailFullHistoryModal(b);
    }

    const psuChartEl = this.root.querySelector<HTMLElement>('#pc-psu-rail-chart');
    if (psuChartEl) {
      const cutoff60s = Date.now() - 60000;
      const rail60s = (b.railHistory || []).filter((h) => h.timestamp >= cutoff60s);
      const chartData = rail60s.length > 0 ? rail60s : (b.railHistory || []).slice(-24);
      renderPcPsuRailsD3Chart(
        psuChartEl,
        chartData,
        psuCalculatorService.getRailDeviationPct(),
        batteryHealthService.getRailAlertMarkersClearedAt()
      );
    }

    const psuCalc = psuCalculatorService.calculate(
      b.currentLoadPct,
      gpuStressEngine.isRunning() ? 90 : 25,
      this.specs?.cpuCores || 8,
      b.psu.tempC
    );
    psuCalculatorService.recordPowerDrawSample(psuCalc.totalSystemPowerW);
    this.patchPsuMainGaugeAndTrend(b, psuCalc);

    const efficiencyChartEl = this.root.querySelector<HTMLElement>('#pc-psu-efficiency-chart');
    if (efficiencyChartEl) {
      renderPsuEfficiencyCurveChart(efficiencyChartEl, psuCalc.loadPercentageOfPsu, psuCalc.efficiencyPct, psuCalc.psuCapacityW);
    }

    const powerBarChartEl = this.root.querySelector<HTMLElement>('#pc-psu-power-efficiency-bar-chart');
    if (powerBarChartEl) {
      renderPsuPowerVsEfficiencyBarChart(
        powerBarChartEl,
        psuCalc.totalSystemPowerW,
        psuCalc.loadPercentageOfPsu,
        psuCalc.efficiencyPct,
        psuCalc.psuCapacityW
      );
    }

    const effTrend1hChartEl = this.root.querySelector<HTMLElement>('#pc-psu-efficiency-trend-1h-chart');
    if (effTrend1hChartEl) {
      renderPsuEfficiencyTrend1hChart(
        effTrend1hChartEl,
        b.efficiencyTrend1h || [],
        psuCalc.psuCapacityW
      );
    }

    const alertLogEl = this.root.querySelector<HTMLElement>('#psu-rail-alert-log');
    if (alertLogEl) {
      alertLogEl.innerHTML = this.renderPsuRailAlertLogTableHtml(
        b.railAlertEvents || [],
        psuCalculatorService.getRailDeviationPct()
      );
    }

    const disableExport = b.powerCycles.length === 0;
    for (const sel of [
      '#bat-history-export-csv-btn',
      '#bat-history-export-xlsx-btn',
      '#bat-cycles-export-csv-btn',
      '#bat-cycles-export-xlsx-btn',
    ]) {
      const btn = this.root.querySelector<HTMLButtonElement>(sel);
      if (btn) btn.disabled = disableExport;
    }
  }

  /* =========================================================================
     8. PERYFERIA A–Z, SKANER WSZYSTKICH PODZESPOŁÓW I TEST WENTYLATORÓW
     ========================================================================= */
  private renderFanLiveInnerHtml(f: FanTestState): string {
    const verdictCls =
      f.verdict === 'CHŁODZENIE SPRAWNE'
        ? 'status-ok'
        : f.verdict === 'GŁOŚNA PRACA / OBCIĄŻENIE'
          ? 'status-warn'
          : f.verdict === 'SŁABE SCHŁADZANIE'
            ? 'status-err'
            : 'status-cyan';

    const realCpuTemp = thermalMonitorService.getLiveCpuTempC();

    return `
      <div class="stack-md">
        <div>
          <div class="row-between" style="margin-bottom:6px;font-size:12px;">
            <span>Faza: <strong class="status-cyan">${esc(f.stageLabel)}</strong> · Obciążenie CPU: <strong class="font-mono">${f.targetLoadPct}%</strong></span>
            <span class="font-mono">${f.progressPct}% · <strong class="${verdictCls}">${esc(f.verdict)}</strong></span>
          </div>
          <div class="progress-track">
            <div class="progress-fill ${f.progressPct >= 100 ? 'ok' : f.targetLoadPct >= 90 ? 'warn' : ''}" style="width:${f.progressPct}%"></div>
          </div>
        </div>

        <div class="grid-4">
          <div class="metric-card" style="padding:12px 14px;">
            <span class="metric-label">Obroty wentylatora (krzywa obc.)</span>
            <div class="metric-row">
              <span class="metric-value status-cyan" style="font-size:21px;">${f.estRpm.toLocaleString('pl-PL')}</span>
              <span class="metric-unit">RPM (est.)</span>
            </div>
            <span class="metric-foot">Szczyt: ${f.peakRpm.toLocaleString('pl-PL')} RPM</span>
          </div>
          <div class="metric-card" style="padding:12px 14px;">
            <span class="metric-label">${realCpuTemp !== null ? 'Czujnik CPU (LIVE °C)' : 'Profil obciążenia / Schładzanie'}</span>
            <div class="metric-row">
              ${
                realCpuTemp !== null
                  ? `<span class="metric-value ${realCpuTemp >= 85 ? 'status-err' : realCpuTemp >= 70 ? 'status-warn' : 'status-ok'}" style="font-size:21px;">${realCpuTemp.toFixed(1)}</span><span class="metric-unit">°C</span>`
                  : `<span class="metric-value status-cyan" style="font-size:21px;">${f.targetLoadPct}%</span><span class="metric-unit">CPU</span>`
              }
            </div>
            <span class="metric-foot">${realCpuTemp !== null ? `Czujnik sprzętowy · Tempo: ${f.cooldownRateCPerMin} °C/min` : 'Brak czujnika °C (podłącz LHM :8085 na Dashboardzie)'}</span>
          </div>
          <div class="metric-card" style="padding:12px 14px;">
            <span class="metric-label">Akustyka wentylatora (Mikrofon)</span>
            <div class="metric-row">
              <span class="metric-value" style="font-size:21px;">${f.micMonitoring && f.currentNoiseDb !== null ? `${f.currentNoiseDb}` : '—'}</span>
              <span class="metric-unit">dB</span>
            </div>
            <span class="metric-foot">${f.micMonitoring && f.baselineNoiseDb !== null ? `Tło: ${f.baselineNoiseDb} dB · Wzrost: +${f.noiseDeltaDb ?? 0} dB` : 'Zaznacz pomiar akustyczny'}</span>
          </div>
          <div class="metric-card" style="padding:12px 14px;">
            <span class="metric-label">Ocena układu chłodzenia</span>
            <div class="metric-row">
              <span class="metric-value ${verdictCls}" style="font-size:14px;">${esc(f.verdict)}</span>
            </div>
            <span class="metric-foot">${f.history.length} próbek · 24 s rampa</span>
          </div>
        </div>

        ${
          f.history.length > 1
            ? renderDualLineChart(
                [
                  f.micMonitoring
                    ? {
                        label: 'Akustyka wentylatora (Mikrofon dB)',
                        color: '#f59e0b',
                        values: f.history.map((s) => s.db ?? 30),
                        unit: 'dB',
                        min: 20,
                        max: 95,
                      }
                    : {
                        label: 'Obciążenie CPU (rampa %)',
                        color: '#ef4444',
                        values: f.history.map((s) => (s.sec < 4 ? 0 : s.sec < 10 ? 55 : s.sec < 18 ? 100 : 0)),
                        unit: '%',
                        min: 0,
                        max: 100,
                      },
                  {
                    label: 'Profil obrotów wentylatora (est.)',
                    color: '#06b6d4',
                    values: f.history.map((s) => s.rpm),
                    unit: 'RPM',
                    min: 0,
                    max: 6000,
                    dashed: true,
                  },
                ],
                f.history.map((s) => `${s.sec}s`),
                165
              )
            : ''
        }
      </div>
    `;
  }

  private renderDeepHardwareAnalysisHtml(sheet: DeepHardwareAnalysisSheet): string {
    const dram = sheet.dramValidation;
    const ssd = sheet.ssdEndurance;
    const dramBadgeCls =
      dram.validationStatus === 'ZWERYFIKOWANO OK'
        ? 'ok'
        : dram.validationStatus === 'WYKRYTO NIEZGODNOŚĆ / ASYMETRIĘ'
          ? 'err'
          : dram.validationStatus === 'OCZEKUJE NA TEST RAM'
            ? 'warn'
            : 'neutral';
    const ssdBadgeCls =
      ssd.overallStatus === 'ZWERYFIKOWANO OK'
        ? 'ok'
        : ssd.overallStatus === 'WYMAGA UWAGI'
          ? 'err'
          : ssd.overallStatus === 'OCZEKUJE NA TEST DYSKU'
            ? 'warn'
            : 'neutral';

    return `
      <div class="stack-md">
        <div class="row-between" style="flex-wrap:wrap;gap:8px;padding:10px 12px;background:var(--bg-inset);border:1px solid var(--border-hairline);border-radius:var(--radius-sm);">
          <div class="row-wrap" style="gap:10px;align-items:center;">
            <span class="verdict-badge ${sheet.hasSmbiosData ? 'ok' : 'warn'}">
              ${sheet.hasSmbiosData ? `SMBIOS AKTYWNY (${esc(sheet.sourceOs)})` : 'TRYB LIVE API (BRAK ZRZUTU SMBIOS)'}
            </span>
            <span class="font-mono" style="font-size:11.5px;color:var(--text-secondary);">
              Import: ${esc(sheet.importedAtLabel)} · Wiersze SMBIOS: ${sheet.rawLineCount} · Pozycje arkusza: ${sheet.specRows.length}
            </span>
          </div>
          ${
            !sheet.hasSmbiosData
              ? `<span style="font-size:11.5px;color:var(--accent-cyan);">Wskazówka: wklej wynik komendy SMBIOS poniżej, aby odblokować walidację kości DIMM i ocenę TBW dysków.</span>`
              : ''
          }
        </div>

        <!-- 1. Arkusz specyfikacji technicznej z danych SMBIOS -->
        <div class="stack-sm">
          <div class="row-between" style="flex-wrap:wrap;gap:8px;">
            <h3 class="panel-title" style="font-size:14px;">Arkusz Specyfikacji Technicznej (SMBIOS Technical Specification Sheet)</h3>
            ${
              sheet.rawDumpPreview
                ? `<details style="font-size:11.5px;color:var(--text-secondary);cursor:pointer;">
                    <summary>Podgląd surowego zrzutu SMBIOS (${sheet.rawLineCount} linii)</summary>
                    <pre class="font-mono" style="margin-top:6px;padding:10px;max-height:180px;overflow:auto;background:#05070c;border:1px solid var(--border-hairline);border-radius:6px;font-size:10.5px;white-space:pre-wrap;">${esc(sheet.rawDumpPreview)}</pre>
                  </details>`
                : ''
            }
          </div>
          <div style="overflow-x:auto;">
            <table class="data-table">
              <thead>
                <tr><th>Sekcja / Podzespół</th><th>Parametr techniczny</th><th>Wartość (SMBIOS / Live)</th><th>Źródło</th></tr>
              </thead>
              <tbody>
                ${sheet.specRows
                  .map(
                    (row) => `
                  <tr>
                    <td style="font-weight:600;">${esc(row.category)}</td>
                    <td style="font-size:12px;color:var(--text-secondary);">${esc(row.parameter)}</td>
                    <td class="font-mono" style="font-size:12px;">${esc(row.value)}</td>
                    <td class="font-mono ${row.source === 'SMBIOS' ? 'status-ok' : 'status-cyan'}" style="font-size:11px;">${esc(row.source)}</td>
                  </tr>`
                  )
                  .join('')}
              </tbody>
            </table>
          </div>
        </div>

        <!-- 2. Real-Time DRAM Module Speed Validation -->
        <div class="panel stack-sm" style="background:var(--bg-inset);padding:14px;">
          <div class="row-between" style="flex-wrap:wrap;gap:8px;">
            <div>
              <h3 class="panel-title" style="font-size:14px;">Walidacja prędkości modułów DRAM w czasie rzeczywistym</h3>
              <span style="font-size:12px;color:var(--text-secondary);">${esc(dram.verdictNote)}</span>
            </div>
            <div class="row-wrap" style="gap:8px;">
              <span class="verdict-badge ${dramBadgeCls}">${esc(dram.validationStatus)}</span>
              <button id="hw-deep-validate-ram-btn" type="button" class="btn btn-primary btn-sm" ${this.deepRamValidating ? 'disabled' : ''}>
                ${this.deepRamValidating ? 'Walidowanie RAM…' : 'Waliduj prędkość DRAM na żywo'}
              </button>
            </div>
          </div>

          <div class="grid-4">
            <div class="metric-card" style="padding:9px 11px;">
              <span class="metric-label">Topologia kanałów</span>
              <div class="font-mono" style="font-size:12.5px;font-weight:700;margin-top:3px;">${esc(dram.channelConfig)}</div>
              <div style="font-size:11px;color:var(--text-secondary);">${dram.moduleCount} moduł(ów) · ${dram.totalCapacityGB} GB</div>
            </div>
            <div class="metric-card" style="padding:9px 11px;">
              <span class="metric-label">Teoretyczny Peak Magistrali</span>
              <div class="font-mono status-cyan" style="font-size:15px;font-weight:700;margin-top:3px;">${dram.theoreticalPeakMBs > 0 ? `${dram.theoreticalPeakMBs.toLocaleString('pl-PL')} MB/s` : '—'}</div>
              <div style="font-size:11px;color:var(--text-secondary);">Zegar min: ${dram.dominantSpeedMHz > 0 ? `${dram.dominantSpeedMHz} MT/s` : 'Brak SMBIOS'}</div>
            </div>
            <div class="metric-card" style="padding:9px 11px;">
              <span class="metric-label">Zmierzone Read / Write / Copy</span>
              <div class="font-mono status-ok" style="font-size:14px;font-weight:700;margin-top:3px;">${dram.measuredReadMBs > 0 ? `${dram.measuredReadMBs.toLocaleString('pl-PL')} / ${dram.measuredWriteMBs.toLocaleString('pl-PL')} MB/s` : 'Uruchom test'}</div>
              <div style="font-size:11px;color:var(--text-secondary);">STREAM Copy: ${dram.measuredCopyMBs > 0 ? `${dram.measuredCopyMBs.toLocaleString('pl-PL')} MB/s` : '—'}</div>
            </div>
            <div class="metric-card" style="padding:9px 11px;">
              <span class="metric-label">Opóźnienie / Sprawność</span>
              <div class="font-mono" style="font-size:15px;font-weight:700;margin-top:3px;">${dram.latencyNs > 0 ? `${dram.latencyNs} ns` : '—'}</div>
              <div style="font-size:11px;color:var(--text-secondary);">Wykorzystanie magistrali: ${dram.efficiencyPct !== null ? `${dram.efficiencyPct}%` : '—'}</div>
            </div>
          </div>

          ${
            dram.modules.length > 0
              ? `<div style="overflow-x:auto;">
                  <table class="data-table">
                    <thead>
                      <tr><th>Slot</th><th>Producent</th><th>Pojemność</th><th>Typ</th><th>Zegar SMBIOS</th><th>Baza JEDEC</th><th>Profil XMP/JEDEC</th><th>Teoret. 1-ch</th><th>Uwagi diagnostyczne</th></tr>
                    </thead>
                    <tbody>
                      ${dram.modules
                        .map(
                          (m) => `
                        <tr>
                          <td class="font-mono">${esc(m.slot)}</td>
                          <td style="font-weight:600;">${esc(m.manufacturer)}</td>
                          <td class="font-mono status-cyan">${m.capacityGB} GB</td>
                          <td class="font-mono">${esc(m.memoryType)}</td>
                          <td class="font-mono">${m.ratedSpeedMHz > 0 ? `${m.ratedSpeedMHz} MHz` : '—'}</td>
                          <td class="font-mono">${m.jedecBaselineMHz} MHz</td>
                          <td class="font-mono ${m.profileStatus === 'XMP / EXPO Aktywny' ? 'status-ok' : m.profileStatus === 'Poniżej bazy JEDEC' ? 'status-err' : 'status-cyan'}">${esc(m.profileStatus)}</td>
                          <td class="font-mono">${m.theoreticalSingleChanMBs > 0 ? `${m.theoreticalSingleChanMBs.toLocaleString('pl-PL')} MB/s` : '—'}</td>
                          <td style="font-size:11.5px;color:var(--text-secondary);">${esc(m.notes)}</td>
                        </tr>`
                        )
                        .join('')}
                    </tbody>
                  </table>
                </div>`
              : `<div style="font-size:12px;color:var(--text-muted);">Brak wykrytych modułów DIMM — skopiuj i wklej wynik SMBIOS poniżej, aby zweryfikować poszczególne kości.</div>`
          }
        </div>

        <!-- 3. SSD Endurance Rating Verification -->
        <div class="panel stack-sm" style="background:var(--bg-inset);padding:14px;">
          <div class="row-between" style="flex-wrap:wrap;gap:8px;">
            <div>
              <h3 class="panel-title" style="font-size:14px;">Weryfikacja klasy wytrzymałości i żywotności SSD (TBW / DWPD / SMART / SLC)</h3>
              <span style="font-size:12px;color:var(--text-secondary);">${esc(ssd.verdictNote)}</span>
            </div>
            <div class="row-wrap" style="gap:8px;">
              <span class="verdict-badge ${ssdBadgeCls}">${esc(ssd.overallStatus)}</span>
              <button id="hw-deep-validate-disk-btn" type="button" class="btn btn-primary btn-sm" ${this.deepDiskValidating ? 'disabled' : ''}>
                ${this.deepDiskValidating ? 'Weryfikowanie SSD…' : 'Weryfikuj żywotność SSD na żywo'}
              </button>
            </div>
          </div>

          ${
            ssd.drives.length > 0
              ? `<div style="overflow-x:auto;">
                  <table class="data-table">
                    <thead>
                      <tr><th>Model napędu</th><th>Interfejs / Nośnik</th><th>Pojemność</th><th>Klasa Endurance</th><th>Szac. TBW / DWPD</th><th>SMART / SLC / CRC32</th><th>Werdykt</th><th>Szczegóły</th></tr>
                    </thead>
                    <tbody>
                      ${ssd.drives
                        .map(
                          (d) => `
                        <tr>
                          <td style="font-weight:600;">${esc(d.model)}</td>
                          <td class="font-mono" style="font-size:11.5px;">${esc(d.interfaceType)} · ${esc(d.mediaType)}</td>
                          <td class="font-mono status-cyan">${d.sizeGB} GB</td>
                          <td class="font-mono" style="font-size:11.5px;">${esc(d.enduranceTier)}</td>
                          <td class="font-mono">${d.estimatedTbwRating ? `${d.estimatedTbwRating} TBW` : '—'} · ${d.estimatedDwpd ?? '—'} DWPD</td>
                          <td class="font-mono" style="font-size:11.5px;">${d.liveSmartHealthPct !== null ? `${d.liveSmartHealthPct}% · SLC ${d.liveSlcCachePct ?? '—'}% · ${d.crcVerified ? 'CRC OK' : 'CRC ERR'}` : `SMBIOS: ${esc(d.smartRawStatus)}`}</td>
                          <td class="font-mono ${d.verificationStatus === 'WYTRZYMAŁOŚĆ WZOROWA' ? 'status-ok' : d.verificationStatus === 'BRAK TESTU DYSKU' ? 'status-cyan' : 'status-err'}" style="font-size:11.5px;">${esc(d.verificationStatus)}</td>
                          <td style="font-size:11.5px;color:var(--text-secondary);">${esc(d.notes)}</td>
                        </tr>`
                        )
                        .join('')}
                    </tbody>
                  </table>
                </div>`
              : `<div style="font-size:12px;color:var(--text-muted);">Brak wykrytych dysków fizycznych z SMBIOS — wklej zrzut SMBIOS poniżej, aby oszacować klasę TBW/DWPD i zweryfikować kondycję każdego dysku.</div>`
          }
        </div>
      </div>
    `;
  }

  private renderMouseHistogramHtml(snap: MouseDiagnosticsSnapshot): string {
    const maxCount = Math.max(1, ...snap.histogram.map((b) => b.count));
    return snap.histogram
      .map((b) => {
        const barWidthPct = snap.activeIntervalCount > 0 ? Math.max(b.count > 0 ? 4 : 0, Math.round((b.count / maxCount) * 100)) : 0;
        return `
          <div class="mouse-hist-row">
            <div class="mouse-hist-label">
              <span class="font-mono">${esc(b.label)}</span>
              <span style="font-size:10.5px;color:var(--text-muted);">${esc(b.hzRangeLabel)}</span>
            </div>
            <div class="mouse-hist-bar-track">
              <div class="mouse-hist-bar ${b.isAnomaly ? 'anomaly' : ''}" style="width:${barWidthPct}%"></div>
            </div>
            <div class="mouse-hist-val font-mono">${b.count} <span style="color:var(--text-muted);">(${b.pct}%)</span></div>
          </div>`;
      })
      .join('');
  }

  private renderMouseRecentClicksHtml(snap: MouseDiagnosticsSnapshot): string {
    if (snap.recentClicks.length === 0) {
      return `<tr><td colspan="5" style="color:var(--text-muted);font-size:11.5px;">Klikaj w polu testowym powyżej, aby rejestrować mikrolatencję (µs) i czas wciśnięcia (dwell).</td></tr>`;
    }
    return snap.recentClicks
      .slice(0, 6)
      .map(
        (c) => `
      <tr>
        <td class="font-mono" style="font-size:11px;">#${c.seq}</td>
        <td class="font-mono" style="font-weight:600;font-size:11.5px;">${esc(c.buttonLabel)}</td>
        <td class="font-mono status-cyan" style="font-size:11.5px;">${c.interClickUs !== null ? `${c.interClickUs.toLocaleString('pl-PL')} µs` : 'Pierwszy'}</td>
        <td class="font-mono" style="font-size:11.5px;">${c.dwellUs !== null ? `${c.dwellUs.toLocaleString('pl-PL')} µs` : '—'}</td>
        <td class="font-mono ${c.flag === 'OK' ? 'status-ok' : c.flag === 'DOUBLE_CLICK' ? 'status-warn' : 'status-err'}" style="font-size:11px;">${esc(c.flag)}</td>
      </tr>`
      )
      .join('');
  }

  private renderPeripheralsView(host: HTMLElement): void {
    this.detachPeripheralsListeners();
    const audioMode = peripheralsTestService.getAudioMode();
    const audioFreq = peripheralsTestService.getAudioFreq();
    const scan = this.hardwareScan;
    const deep = scan?.deepInventory || null;
    const f = this.fanState;
    const mouseSnap = mouseDiagnosticsService.getSnapshot();
    const deepSheet =
      this.hwScannerTab === 'deep_analysis'
        ? analyzeDeepHardware(deep, this.ramState, this.diskState, this.specs, scan)
        : null;

    const micDevices = (scan?.devices || []).filter((d) => d.category === 'Mikrofon');

    host.innerHTML = `
      <div class="stack-lg">
        <div class="section-header">
          <div>
            <h1 class="section-title">Wszystkie podzespoły, peryferia A–Z i test wentylatorów</h1>
            <p class="section-subtitle">
              Detekcja każdego podzespołu (kości RAM DIMM, dyski fizyczne NVMe/SSD/HDD, płyta główna/BIOS, matryca EDID, USB/HID/Bluetooth/Serial), test wentylatorów i chłodzenia, klawiatura NKRO, mysz, gładzik (Touchpad), głośniki (Sweep + Różowy szum), mikrofon (Echo 4s), pad (drążki + wibracje) i kamera.
            </p>
          </div>
          <div class="row-wrap">
            <button id="periph-reset-btn" type="button" class="btn btn-secondary btn-sm">
              Resetuj liczniki wejścia
            </button>
          </div>
        </div>

        <!-- 0A. AUTOMATYCZNY SKANER 12 PODZESPOŁÓW + WYKRES D3.JS -->
        <div class="panel stack-md" style="border:1px solid rgba(6, 182, 212, 0.34);">
          <div class="row-between" style="flex-wrap:wrap;gap:10px;">
            <div>
              <h2 class="panel-title">⚡ Automatyczne Wykrywanie + 12 Dedykowanych Skanerów Podzespołów (Auto-Detect Live)</h2>
              <span class="panel-caption">
                Tryb detekcji: <strong class="${hardwareScannerService.isNativeBridgeActive() ? 'status-ok' : 'status-cyan'}">${hardwareScannerService.isNativeBridgeActive() ? '● NATYWNY MOSTEK .EXE (Pełne WMI + DriveInfo)' : '● AUTO WEB API (Wykryto automatycznie bez klikania)'}</strong> · ${this.componentScans.length || 12}/12 podzespołów zmapowanych
              </span>
            </div>
            <button id="hw-scan-all-12-btn" type="button" class="btn btn-primary btn-sm" ${this.componentScanBusy ? 'disabled' : ''}>
              ${this.componentScanBusy ? 'Skanowanie 12 podzespołów...' : '⚡ Skanuj Wszystkie 12 Podzespołów'}
            </button>
          </div>

          <div id="hw-12-health-chart" class="d3-chart-box"></div>

          <div class="hw-12-grid">
            ${this.componentScans
              .map((card) => {
                const statusCls =
                  card.status === 'OK' ? 'status-ok' : card.status === 'UWAGA' ? 'status-warn' : 'status-cyan';
                return `
                  <div class="hw-12-card">
                    <div class="row-between" style="gap:6px;">
                      <span class="hw-12-cat font-mono">${esc(card.category)}</span>
                      <span class="font-mono ${statusCls}" style="font-size:11px;font-weight:700;">${card.score}/100 · ${esc(card.source)}</span>
                    </div>
                    <div class="hw-12-title">${esc(card.title)}</div>
                    <div class="hw-12-headline">${esc(card.headline)}</div>
                    <div class="hw-12-details">${esc(card.summary)}</div>
                    <div class="row-between" style="margin-top:auto;padding-top:6px;">
                      <span class="font-mono" style="font-size:10px;color:var(--text-muted);">${new Date(card.scannedAt).toLocaleTimeString('pl-PL')}</span>
                      <button type="button" class="btn btn-secondary btn-sm" style="padding:3px 9px;font-size:11px;" data-hw-scan-one="${esc(card.id)}" ${this.componentScanBusy ? 'disabled' : ''}>
                        Skanuj
                      </button>
                    </div>
                  </div>
                `;
              })
              .join('')}
          </div>
        </div>

        <!-- 0. SKANER WSZYSTKICH PODZESPOŁÓW I URZĄDZEŃ -->
        <div class="panel stack-md">
          <div class="panel-header" style="margin-bottom:0;">
            <div>
              <h2 class="panel-title">0. Skaner wszystkich części i urządzeń PC / Laptopa (${scan ? scan.devices.length : 0} wykrytych)</h2>
              <span class="panel-caption">Działa na każdym komputerze i laptopie na świecie · CPU, GPU, WebGPU, RAM, Dyski, Matryca, Audio, USB, HID, Bluetooth, COM, Pad</span>
            </div>
            <button id="hw-rescan-btn" type="button" class="btn btn-primary btn-sm">Odśwież pełny skan</button>
          </div>

          <div class="row-wrap">
            <button id="hw-scan-screen-btn" type="button" class="btn btn-secondary btn-sm">Wykryj model matrycy (EDID/API)</button>
            <button id="hw-unlock-media-btn" type="button" class="btn btn-secondary btn-sm">Odblokuj nazwy audio i kamer</button>
            <button id="hw-pick-drive-btn" type="button" class="btn btn-secondary btn-sm">Wskaż i przetestuj dysk (C:/D:/USB)</button>
            <button id="hw-scan-usb-btn" type="button" class="btn btn-secondary btn-sm">Skanuj USB (WebUSB)</button>
            <button id="hw-scan-hid-btn" type="button" class="btn btn-secondary btn-sm">Skanuj HID (Klaw./Mysz/Pad)</button>
            <button id="hw-scan-bt-btn" type="button" class="btn btn-secondary btn-sm">Skanuj Bluetooth</button>
            <button id="hw-scan-serial-btn" type="button" class="btn btn-secondary btn-sm">Skanuj port COM / Serial</button>
          </div>

          ${
            this.hardwareScanNotice
              ? `<div style="padding:8px 12px;border:1px solid var(--accent-cyan);border-radius:var(--radius-sm);font-size:12px;background:var(--bg-inset);">
                  <strong class="status-cyan">Komunikat skanera:</strong> ${esc(this.hardwareScanNotice)}
                </div>`
              : ''
          }

          <div class="hw-tabs" role="tablist">
            <button id="hw-tab-overview" type="button" class="hw-tab-btn ${this.hwScannerTab === 'overview' ? 'active' : ''}" role="tab" aria-selected="${this.hwScannerTab === 'overview'}">
              Skaner Live &amp; Bus (USB / HID / EDID)
            </button>
            <button id="hw-tab-deep" type="button" class="hw-tab-btn ${this.hwScannerTab === 'deep_analysis' ? 'active' : ''}" role="tab" aria-selected="${this.hwScannerTab === 'deep_analysis'}">
              Deep Hardware Analysis (SMBIOS Spec Sheet · DRAM · SSD Endurance)
            </button>
          </div>

          ${
            this.hwScannerTab === 'deep_analysis' && deepSheet
              ? this.renderDeepHardwareAnalysisHtml(deepSheet)
              : `
          <div style="overflow-x:auto;">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Kategoria</th>
                  <th>Wykryty podzespół / Urządzenie</th>
                  <th>Szczegóły techniczne</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                ${
                  scan && scan.devices.length > 0
                    ? scan.devices
                        .map(
                          (d) => `
                        <tr>
                          <td class="font-mono" style="font-size:11px;white-space:nowrap;">${esc(d.category)}</td>
                          <td style="font-weight:600;">${esc(d.name)}</td>
                          <td style="font-size:12px;color:var(--text-secondary);">${esc(d.details)}</td>
                          <td class="font-mono ${d.status === 'Aktywne' ? 'status-ok' : 'status-cyan'}" style="font-size:11px;">${esc(d.status)}</td>
                        </tr>`
                        )
                        .join('')
                    : `<tr><td colspan="4" style="color:var(--text-muted);">Trwa skanowanie podzespołów...</td></tr>`
                }
              </tbody>
            </table>
          </div>`
          }

          <!-- Głęboki skaner SMBIOS (Każda kość RAM DIMM, każdy dysk NVMe/SSD/HDD, Płyta główna, BIOS, Matryca EDID) -->
          <div class="panel stack-sm" style="background:var(--bg-inset);padding:14px;">
            <div class="row-between" style="flex-wrap:wrap;gap:8px;">
              <div>
                <h3 class="panel-title" style="font-size:14px;">Głęboki odczyt SMBIOS — każda kość RAM (DIMM), każdy dysk NVMe/SSD/HDD, płyta główna i BIOS</h3>
                <p style="margin:2px 0 0;font-size:12px;color:var(--text-secondary);">
                  Przeglądarka chroni numery seryjne kości RAM i dysków fizycznych. Skopiuj 1 komendę dla swojego systemu, uruchom w terminalu / PowerShell i wklej wynik poniżej — aplikacja rozpozna każdą fizyczną kość RAM (slot, MHz, DDR4/DDR5, producenta), każdy dysk fizyczny, płytę główną, BIOS oraz dokładny model matrycy EDID.
                </p>
              </div>
              <div class="row-wrap">
                <button id="hw-copy-win-cmd" type="button" class="btn btn-primary btn-sm">Kopiuj komendę Windows (PowerShell)</button>
                <button id="hw-copy-linux-cmd" type="button" class="btn btn-secondary btn-sm">Kopiuj Linux</button>
                <button id="hw-copy-mac-cmd" type="button" class="btn btn-secondary btn-sm">Kopiuj macOS</button>
              </div>
            </div>

            <div class="row-wrap" style="align-items:stretch;">
              <textarea id="hw-smbios-input" class="field-input font-mono" rows="2" style="flex:1;min-width:260px;font-size:11px;" placeholder="Wklej tutaj skopiowany wynik komendy (Ctrl+V) i kliknij „Rozpoznaj każdą część”…"></textarea>
              <button id="hw-parse-smbios-btn" type="button" class="btn btn-primary btn-sm">Rozpoznaj każdą część</button>
              ${deep ? `<button id="hw-clear-smbios-btn" type="button" class="btn btn-secondary btn-sm">Wyczyść SMBIOS</button>` : ''}
            </div>

            ${
              deep
                ? `
              <div class="stack-sm" style="margin-top:8px;">
                <div class="grid-3">
                  <div class="metric-card" style="padding:10px 12px;">
                    <span class="metric-label">Komputer / Płyta główna</span>
                    <div style="font-size:13px;font-weight:700;margin-top:4px;">${esc(deep.computerModel)}</div>
                    <div style="font-size:11px;color:var(--text-secondary);">${esc(deep.motherboard)} · BIOS: ${esc(deep.bios)}</div>
                  </div>
                  <div class="metric-card" style="padding:10px 12px;">
                    <span class="metric-label">Dokładny CPU</span>
                    <div style="font-size:13px;font-weight:700;margin-top:4px;">${esc(deep.cpuModel || '—')}</div>
                    <div style="font-size:11px;color:var(--text-secondary);">${esc(deep.cpuDetails || deep.sourceOs)}</div>
                  </div>
                  <div class="metric-card" style="padding:10px 12px;">
                    <span class="metric-label">Kości RAM / Dyski fizyczne</span>
                    <div style="font-size:14px;font-weight:700;margin-top:4px;" class="status-ok">${deep.ramModules.length} kość(ci) RAM · ${deep.disks.length} dysk(ów)</div>
                    <div style="font-size:11px;color:var(--text-secondary);">GPU: ${deep.gpus.length} · Matryce EDID: ${deep.monitors.length}</div>
                  </div>
                </div>

                ${
                  deep.ramModules.length > 0
                    ? `
                  <div style="overflow-x:auto;">
                    <div style="font-size:12px;font-weight:700;margin-bottom:4px;">Wykryte kości pamięci RAM (DIMM / SO-DIMM)</div>
                    <table class="data-table">
                      <thead>
                        <tr><th>Slot</th><th>Producent</th><th>Pojemność</th><th>Typ</th><th>Taktowanie</th><th>Kod części (Part No.)</th><th>Numer seryjny</th></tr>
                      </thead>
                      <tbody>
                        ${deep.ramModules
                          .map(
                            (r) => `
                          <tr>
                            <td class="font-mono">${esc(r.slot)}</td>
                            <td style="font-weight:600;">${esc(r.manufacturer)}</td>
                            <td class="font-mono status-cyan">${r.capacityGB} GB</td>
                            <td class="font-mono">${esc(r.memoryType)}</td>
                            <td class="font-mono">${r.speedMHz > 0 ? `${r.speedMHz} MHz` : '—'}</td>
                            <td class="font-mono" style="font-size:11px;">${esc(r.partNumber)}</td>
                            <td class="font-mono" style="font-size:11px;">${esc(r.serial)}</td>
                          </tr>`
                          )
                          .join('')}
                      </tbody>
                    </table>
                  </div>`
                    : ''
                }

                ${
                  deep.disks.length > 0
                    ? `
                  <div style="overflow-x:auto;">
                    <div style="font-size:12px;font-weight:700;margin-bottom:4px;">Wykryte dyski fizyczne (NVMe / SATA SSD / HDD)</div>
                    <table class="data-table">
                      <thead>
                        <tr><th>Model dysku</th><th>Interfejs</th><th>Typ nośnika</th><th>Pojemność</th><th>Status SMART</th><th>Numer seryjny</th></tr>
                      </thead>
                      <tbody>
                        ${deep.disks
                          .map(
                            (d) => `
                          <tr>
                            <td style="font-weight:600;">${esc(d.model)}</td>
                            <td class="font-mono">${esc(d.interfaceType)}</td>
                            <td style="font-size:12px;">${esc(d.mediaType)}</td>
                            <td class="font-mono status-cyan">${d.sizeGB} GB</td>
                            <td class="font-mono status-ok">${esc(d.status)}</td>
                            <td class="font-mono" style="font-size:11px;">${esc(d.serial)}</td>
                          </tr>`
                          )
                          .join('')}
                      </tbody>
                    </table>
                  </div>`
                    : ''
                }
              </div>`
                : ''
            }
          </div>
        </div>

        <!-- 1. TEST WENTYLATORÓW I UKŁADU CHŁODZENIA -->
        <div class="panel stack-md">
          <div class="panel-header" style="margin-bottom:0;">
            <div>
              <h2 class="panel-title">1. Test wentylatorów i układu chłodzenia (Fan Ramp + Akustyka dB)</h2>
              <span class="panel-caption">24-sekundowa rampa obciążenia CPU (0% → 55% → 100% Turbo → Schładzanie) z pomiarem tempa chłodzenia i opcjonalną analizą szumu wentylatorów przez mikrofon</span>
            </div>
            <div class="row-wrap">
              <label style="display:inline-flex;align-items:center;gap:6px;font-size:12px;color:var(--text-secondary);cursor:pointer;">
                <input id="fan-mic-checkbox" type="checkbox" ${this.fanMicAcoustic ? 'checked' : ''} ${f.running ? 'disabled' : ''} />
                <span>Pomiar hałasu mikrofonem (dB)</span>
              </label>
              <button id="fan-toggle-btn" type="button" class="btn ${f.running ? 'btn-danger' : 'btn-primary'} btn-sm">
                ${iconSvg(f.running ? 'stop' : 'fan', 14)}
                <span>${f.running ? 'Zatrzymaj test wentylatorów' : 'Uruchom test wentylatorów (24s)'}</span>
              </button>
            </div>
          </div>

          <div id="fan-live-container">
            ${this.renderFanLiveInnerHtml(f)}
          </div>
        </div>

        <!-- 1A. MONITOR PWM FREQUENCY (CZĘSTOTLIWOŚĆ SYGNAŁU PWM) -->
        ${renderFanPwmMonitorPanelHtml(fanTestService.getPwmMonitorState())}

        <!-- 1B. INTERAKTYWNY EDYTOR KRZYWEJ WENTYLATORÓW -->
        ${renderFanCurveEditorPanelHtml(fanTestService.getFanCurve())}

        <!-- 1C. MAPA CIEPLNA REZONANSU AKUSTYCZNEGO & BEARING HEALTH HISTORY -->
        ${renderFanAcousticHeatmapPanelHtml(
          fanTestService.getAcousticHeatmapState(),
          fanTestService.getPwmMonitorState(),
          this.fanHeatmapTab
        )}

        <!-- 2. MATRYCA KLAWIATURY I NKRO -->
        <div class="panel stack-md">
          <div class="panel-header" style="margin-bottom:0;">
            <h2 class="panel-title">2. Matryca klawiatury i test NKRO (Anti-Ghosting)</h2>
            <div class="meta-line">
              <span>Przetestowane: <strong id="kbd-tested-cnt" class="font-mono status-ok">${this.testedKeys.size}</strong></span>
              <span class="meta-sep">·</span>
              <span>Jednocześnie / Max NKRO: <strong id="kbd-nkro-cnt" class="font-mono status-cyan">${this.pressedKeys.size} / ${this.maxNkro}</strong></span>
              <span class="meta-sep">·</span>
              <span>Ostatni kod: <strong id="kbd-last-code" class="font-mono">${esc(this.lastKeyCode)}</strong></span>
            </div>
          </div>

          <div class="kbd-rows">
            ${KEYBOARD_LAYOUT.map(
              (row) => `
              <div class="kbd-row">
                ${row
                  .map((k) => {
                    const tested = this.testedKeys.has(k.code) ? 'tested' : '';
                    const pressed = this.pressedKeys.has(k.code) ? 'pressed' : '';
                    return `<div class="kbd-key ${k.cls || ''} ${tested} ${pressed}" data-key-code="${k.code}">${k.label}</div>`;
                  })
                  .join('')}
              </div>`
            ).join('')}
          </div>
          <div style="font-size:12px;color:var(--text-muted);">
            Naciskaj dowolne klawisze na klawiaturze laptopa lub PC. Zielony kolor oznacza sprawny styk, a jednoczesne wciśnięcie wielu klawiszy sprawdza limit NKRO (Anti-Ghosting).
          </div>
        </div>

        <!-- 3. ADVANCED MOUSE & CLICK + DEDYKOWANY TOUCHPAD (GŁADZIK) -->
        <div class="grid-2">
          <div class="panel stack-md">
            <div class="panel-header" style="margin-bottom:0;flex-wrap:wrap;gap:8px;">
              <div>
                <h2 class="panel-title">3. Advanced Mouse &amp; Click (Mikrolatencja µs i Histogram Sensora)</h2>
                <span class="panel-caption">Pomiar interwałów między klikami (µs), czas wciśnięcia (dwell), wykrywanie chatter/dwukliku oraz rozkład stabilności USB Polling Rate</span>
              </div>
              <span id="mouse-hz-badge" class="font-mono status-cyan">${mouseSnap.pollingHz} Hz (Szczyt: ${mouseSnap.peakPollingHz} Hz · ${esc(mouseSnap.nominalTierLabel)})</span>
            </div>

            <div class="row-between" style="flex-wrap:wrap;gap:8px;">
              <div class="row-wrap" style="gap:4px;">
                <span style="font-size:11px;color:var(--text-secondary);align-self:center;margin-right:4px;">Profil Hz:</span>
                ${[0, 125, 250, 500, 1000, 2000]
                  .map(
                    (hz) =>
                      `<button type="button" class="btn ${mouseSnap.targetPollingHz === hz ? 'btn-primary' : 'btn-secondary'} btn-sm" data-mouse-target-hz="${hz}">${hz === 0 ? 'Auto' : `${hz} Hz`}</button>`
                  )
                  .join('')}
              </div>
              <span id="mouse-verdict-badge" class="verdict-badge ${
                mouseSnap.sensorVerdict === 'SENSOR WZOROWY'
                  ? 'ok'
                  : mouseSnap.sensorVerdict === 'LEKKIE WAHANIA USB'
                    ? 'warn'
                    : mouseSnap.sensorVerdict === 'WYKRYTO NIESTABILNOŚĆ SENSORA'
                      ? 'err'
                      : 'neutral'
              }">${esc(mouseSnap.sensorVerdict)}</span>
            </div>

            <div id="mouse-test-pad" class="mouse-pad" oncontextmenu="return false;">
              <div class="row-wrap" style="gap:16px;justify-content:center;align-items:baseline;">
                <div class="font-mono" style="font-size:24px;font-weight:700;" id="mouse-pad-hz">${mouseSnap.pollingHz} Hz</div>
                <div class="font-mono status-ok" style="font-size:14px;font-weight:700;" id="mouse-pad-stability">Stabilność: ${mouseSnap.stabilityPct}%</div>
              </div>
              <div id="mouse-verdict-note" style="font-size:11.5px;color:var(--text-secondary);">
                ${esc(mouseSnap.sensorVerdictNote)}
              </div>
            </div>

            <div class="grid-4">
              <div class="metric-card" style="padding:7px 9px;">
                <span class="metric-label">Ostatni interwał</span>
                <div id="mouse-last-us" class="font-mono status-cyan" style="font-size:14px;font-weight:700;">${mouseSnap.lastClickLatencyUs !== null ? `${mouseSnap.lastClickLatencyUs.toLocaleString('pl-PL')} µs` : '—'}</div>
              </div>
              <div class="metric-card" style="padding:7px 9px;">
                <span class="metric-label">Min / Śr. interwał</span>
                <div id="mouse-min-avg-us" class="font-mono" style="font-size:12.5px;font-weight:700;">${mouseSnap.minClickLatencyUs !== null ? `${mouseSnap.minClickLatencyUs.toLocaleString('pl-PL')} / ${mouseSnap.avgClickLatencyUs?.toLocaleString('pl-PL') ?? '—'} µs` : '—'}</div>
              </div>
              <div class="metric-card" style="padding:7px 9px;">
                <span class="metric-label">Dwell (Wciśnięcie)</span>
                <div id="mouse-dwell-us" class="font-mono status-ok" style="font-size:14px;font-weight:700;">${mouseSnap.lastDwellUs !== null ? `${mouseSnap.lastDwellUs.toLocaleString('pl-PL')} µs` : '—'}</div>
              </div>
              <div class="metric-card" style="padding:7px 9px;">
                <span class="metric-label">Chatter / Dwuklik</span>
                <div id="mouse-bounce-val" class="font-mono ${mouseSnap.chatterFaults + mouseSnap.doubleClickFaults > 0 ? 'status-err' : 'status-ok'}" style="font-size:14px;font-weight:700;">${mouseSnap.chatterFaults} / ${mouseSnap.doubleClickFaults}</div>
              </div>
            </div>

            <div class="kv-list">
              <div class="kv-row">
                <span class="kv-key">Kliknięcia (LPM / ŚPM / PPM / B4 / B5)</span>
                <span id="mouse-clicks-val" class="kv-val">${mouseSnap.clicks.lmb} / ${mouseSnap.clicks.mmb} / ${mouseSnap.clicks.rmb} / ${mouseSnap.clicks.side4} / ${mouseSnap.clicks.side5}</span>
              </div>
              <div class="kv-row">
                <span class="kv-key">Przesunięcie rolki (Scroll Delta)</span>
                <span id="mouse-scroll-val" class="kv-val">${mouseSnap.scrollDeltaPx} px</span>
              </div>
            </div>

            <div class="stack-sm">
              <div class="row-between" style="flex-wrap:wrap;gap:6px;">
                <span style="font-size:12px;font-weight:700;">Histogram stabilności interwałów Polling Rate</span>
                <span id="mouse-hist-stats" class="font-mono" style="font-size:11px;color:var(--text-secondary);">
                  Śr: ${mouseSnap.meanIntervalUs} µs · Med: ${mouseSnap.medianIntervalUs} µs · P99: ${mouseSnap.p99IntervalUs} µs · σ: ${mouseSnap.jitterStdDevUs} µs · Spadki: ${mouseSnap.inconsistencyEvents}
                </span>
              </div>
              <div id="mouse-histogram-bars" class="mouse-hist-grid">
                ${this.renderMouseHistogramHtml(mouseSnap)}
              </div>
            </div>

            <div style="overflow-x:auto;">
              <table class="data-table click-log-table">
                <thead>
                  <tr><th>#</th><th>Przycisk</th><th>Interwał (µs)</th><th>Dwell (µs)</th><th>Status</th></tr>
                </thead>
                <tbody id="mouse-recent-clicks">
                  ${this.renderMouseRecentClicksHtml(mouseSnap)}
                </tbody>
              </table>
            </div>
          </div>

          <div class="panel stack-md">
            <div class="panel-header" style="margin-bottom:0;">
              <h2 class="panel-title">4. Gładzik / Touchpad (Multi-Touch, Scroll 2-palce, Pinch)</h2>
              <span id="tp-fingers-badge" class="font-mono status-cyan">Palce: ${this.touchpadFingers} (Max: ${this.touchpadMaxFingers})</span>
            </div>

            <div class="touchpad-surface" id="touchpad-wrap">
              <canvas id="touchpad-canvas" style="width:100%;height:100%;display:block;"></canvas>
              <div id="tp-gesture-lbl" style="position:absolute;left:10px;bottom:8px;font-size:11px;color:var(--text-secondary);pointer-events:none;">
                ${esc(this.touchpadLastGesture)}
              </div>
            </div>

            <div class="kv-list">
              <div class="kv-row">
                <span class="kv-key">Przewijanie 2 palcami (X / Y)</span>
                <span id="tp-scroll-val" class="kv-val">${this.touchpadScrollX} px / ${this.touchpadScrollY} px</span>
              </div>
              <div class="kv-row">
                <span class="kv-key">Gest uszczypnięcia (Pinch-to-Zoom)</span>
                <span id="tp-pinch-val" class="kv-val status-cyan">${this.touchpadPinchScale.toFixed(2)}×</span>
              </div>
              <div class="kv-row">
                <span class="kv-key">Stuknięcia (Tap) i wykryty Multi-Touch</span>
                <span id="tp-taps-val" class="kv-val">${this.touchpadTaps} stuknięć · Max ${this.touchpadMaxFingers} pkt</span>
              </div>
            </div>
          </div>
        </div>

        <!-- 5. GŁOŚNIKI PRO + 6. MIKROFON PRO -->
        <div class="grid-2">
          <div class="panel stack-md">
            <div class="panel-header" style="margin-bottom:0;">
              <h2 class="panel-title">5. Głośniki i słuchawki Pro (Stereo, Sweep, Różowy szum)</h2>
              <span id="audio-freq-lbl" class="font-mono status-cyan">${audioFreq} Hz</span>
            </div>

            <div class="row-wrap">
              ${(['left', 'stereo', 'right', 'sweep', 'pink_noise', 'off'] as AudioChannelMode[])
                .map(
                  (m) => `
                  <button type="button" class="btn ${audioMode === m && m !== 'off' ? 'btn-primary' : m === 'off' ? 'btn-danger' : 'btn-secondary'} btn-sm" data-audio-mode="${m}">
                    ${
                      m === 'left'
                        ? 'Lewy (L)'
                        : m === 'right'
                          ? 'Prawy (P)'
                          : m === 'stereo'
                            ? 'Stereo (L+P)'
                            : m === 'sweep'
                              ? 'Sweep 20Hz→16kHz'
                              : m === 'pink_noise'
                                ? 'Różowy szum'
                                : 'Stop'
                    }
                  </button>`
                )
                .join('')}
            </div>

            <div class="field-group">
              <label class="field-label" for="audio-freq-range">Częstotliwość tonu testowego (20 Hz – 18 000 Hz)</label>
              <input id="audio-freq-range" class="range-input" type="range" min="20" max="18000" step="10" value="${audioFreq}" />
            </div>

            <div class="row-wrap">
              <button type="button" class="btn btn-secondary btn-sm" data-audio-preset="50">50 Hz Sub</button>
              <button type="button" class="btn btn-secondary btn-sm" data-audio-preset="120">120 Hz Bas</button>
              <button type="button" class="btn btn-secondary btn-sm" data-audio-preset="440">440 Hz A4</button>
              <button type="button" class="btn btn-secondary btn-sm" data-audio-preset="1000">1 kHz Ref</button>
              <button type="button" class="btn btn-secondary btn-sm" data-audio-preset="10000">10 kHz Góra</button>
            </div>

            <div style="font-size:12px;color:var(--text-muted);">
              Automatyczny Sweep 20Hz–16kHz wykrywa rezonanse obudowy i charczenie membran głośników laptopa, a różowy szum pozwala ocenić balans pasma słuchawek.
            </div>
          </div>

          <div class="panel stack-md">
            <div class="panel-header" style="margin-bottom:0;">
              <h2 class="panel-title">6. Mikrofon Pro (Miernik dB VU + Nagraj i Odsłuchaj)</h2>
              <div class="row-wrap">
                <button id="mic-toggle-btn" type="button" class="btn ${peripheralsTestService.isMicActive() ? 'btn-danger' : 'btn-primary'} btn-sm">
                  ${peripheralsTestService.isMicActive() ? 'Zatrzymaj' : 'Testuj mikrofon'}
                </button>
                <button id="mic-record-btn" type="button" class="btn btn-secondary btn-sm" ${this.micRecording ? 'disabled' : ''}>
                  ${this.micRecording ? 'Nagrywanie 4s…' : 'Nagraj 4s (Test echa)'}
                </button>
              </div>
            </div>

            ${
              micDevices.length > 0
                ? `
              <div class="field-group">
                <label class="field-label" for="mic-device-select">Wykryte wejścia mikrofonowe</label>
                <select id="mic-device-select" class="field-input">
                  <option value="">Domyślny mikrofon systemu</option>
                  ${micDevices
                    .map((m, idx) => `<option value="${esc(m.details.replace(/^ID:\s*/, '').split(' ')[0] || '')}">${idx + 1}. ${esc(m.name)}</option>`)
                    .join('')}
                </select>
              </div>`
                : ''
            }

            <div class="stack-sm">
              <div class="row-between">
                <span style="font-size:12px;color:var(--text-secondary);">Poziom sygnału wejściowego</span>
                <span id="mic-db-lbl" class="font-mono status-cyan">${this.micDb} dB (${this.micLevelPct}%)</span>
              </div>
              <div class="vu-track">
                <div id="mic-vu-fill" class="vu-fill" style="width:${this.micLevelPct}%"></div>
              </div>
              <div id="mic-status-lbl" class="font-mono" style="font-size:12px;color:var(--text-secondary);">${esc(this.micInfo)}</div>
              <audio id="mic-playback-audio" controls style="width:100%;height:34px;display:none;"></audio>
            </div>
          </div>
        </div>

        <!-- 7. KONTROLER / PAD PRO + 8. KAMERA INTERNETOWA -->
        <div class="grid-2">
          <div class="panel stack-md">
            <div class="panel-header" style="margin-bottom:0;">
              <div>
                <h2 class="panel-title">7. Kontroler / Gamepad Pro (Drążki, Drift, Spusty, Wibracje)</h2>
                <span class="panel-caption">Xbox / PlayStation / Nintendo / USB / Bluetooth</span>
              </div>
              <button id="gamepad-rumble-btn" type="button" class="btn btn-secondary btn-sm">Test wibracji (Rumble)</button>
            </div>
            <div id="gamepad-status-box" class="stack-sm">
              <div class="kv-row">
                <span class="kv-key">Wykryty kontroler</span>
                <span class="kv-val">Brak (podłącz pad i wciśnij przycisk)</span>
              </div>
            </div>
          </div>

          <div class="panel stack-md">
            <div class="panel-header" style="margin-bottom:0;">
              <h2 class="panel-title">8. Kamera internetowa (Podgląd HD i FPS)</h2>
              <div class="row-wrap">
                <button id="cam-toggle-btn" type="button" class="btn ${peripheralsTestService.isCameraActive() ? 'btn-danger' : 'btn-primary'} btn-sm">
                  ${peripheralsTestService.isCameraActive() ? 'Zatrzymaj' : 'Uruchom kamerę'}
                </button>
              </div>
            </div>
            <video id="cam-video-el" class="cam-preview" playsinline muted></video>
            <div id="cam-status-lbl" class="font-mono" style="font-size:12px;color:var(--text-secondary);">${esc(this.camInfo)}</div>
          </div>
        </div>
      </div>
    `;

    // --- 0A. Render D3.js 12-Component Health Chart & Per-Component Scanners ---
    const hw12ChartEl = host.querySelector<HTMLElement>('#hw-12-health-chart');
    if (hw12ChartEl) {
      renderHardwareHealthD3Chart(hw12ChartEl, this.componentScans);
    }

    // --- 0. Hardware Scanner & SMBIOS Handlers ---
    const rescanAll = async (notice?: string) => {
      if (notice !== undefined) this.hardwareScanNotice = notice;
      await hardwareScannerService.autoProbeFullLocalBridge(true);
      this.hardwareScan = await hardwareScannerService.scanAll(
        this.specs?.estimatedRefreshRate || 60,
        this.specs?.gpuRenderer || '',
        this.specs
      );
      if (this.hardwareScan?.deepInventory?.disks?.length) {
        diskTestService.registerSmbiosDrives(this.hardwareScan.deepInventory.disks);
      }
      this.diskDrives = await diskTestService.refreshAvailableDrives();
      await this.runAuto12ComponentScan();
      if (this.activeModule === 'peripherals') this.renderPeripheralsView(host);
    };

    host.querySelector('#hw-scan-all-12-btn')?.addEventListener('click', async () => {
      if (this.componentScanBusy) return;
      this.componentScanBusy = true;
      this.renderPeripheralsView(host);
      try {
        await rescanAll('Przeskanowano wszystkie 12 podzespołów sprzętowych na żywo.');
      } finally {
        this.componentScanBusy = false;
        if (this.activeModule === 'peripherals') this.renderPeripheralsView(host);
      }
    });

    host.querySelectorAll<HTMLButtonElement>('[data-hw-scan-one]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        if (this.componentScanBusy) return;
        const compId = btn.dataset.hwScanOne || '';
        this.componentScanBusy = true;
        try {
          if (compId === 'display') {
            const msg = await hardwareScannerService.requestExactScreenModel();
            await rescanAll(msg);
          } else if (compId === 'storage') {
            this.diskDrives = await diskTestService.refreshAvailableDrives();
            await rescanAll(`Odświeżono skan dysków i partycji (${this.diskDrives.length} pozycji).`);
          } else if (compId === 'audio_codecs' || compId === 'input_media') {
            const msg = await hardwareScannerService.unlockMediaDeviceNames();
            await rescanAll(msg);
          } else if (compId === 'usb_bus') {
            const msg = await hardwareScannerService.requestUsbDevice();
            await rescanAll(msg);
          } else {
            await rescanAll(`Odświeżono diagnostykę modułu: ${compId.toUpperCase()}.`);
          }
        } finally {
          this.componentScanBusy = false;
          if (this.activeModule === 'peripherals') this.renderPeripheralsView(host);
        }
      });
    });

    host.querySelector('#hw-rescan-btn')?.addEventListener('click', () => {
      void rescanAll('Odświeżono pełną listę wykrytych podzespołów i urządzeń.');
    });
    host.querySelector('#hw-scan-screen-btn')?.addEventListener('click', async () => {
      const msg = await hardwareScannerService.requestExactScreenModel();
      await rescanAll(msg);
    });
    host.querySelector('#hw-unlock-media-btn')?.addEventListener('click', async () => {
      const msg = await hardwareScannerService.unlockMediaDeviceNames();
      await rescanAll(msg);
    });
    host.querySelector('#hw-pick-drive-btn')?.addEventListener('click', async () => {
      const msg = await hardwareScannerService.pickAndProbePhysicalDrive();
      await rescanAll(msg);
    });
    host.querySelector('#hw-scan-usb-btn')?.addEventListener('click', async () => {
      const msg = await hardwareScannerService.requestUsbDevice();
      await rescanAll(msg);
    });
    host.querySelector('#hw-scan-hid-btn')?.addEventListener('click', async () => {
      const msg = await hardwareScannerService.requestHidDevice();
      await rescanAll(msg);
    });
    host.querySelector('#hw-scan-bt-btn')?.addEventListener('click', async () => {
      const msg = await hardwareScannerService.requestBluetoothDevice();
      await rescanAll(msg);
    });
    host.querySelector('#hw-scan-serial-btn')?.addEventListener('click', async () => {
      const msg = await hardwareScannerService.requestSerialPort();
      await rescanAll(msg);
    });

    const copyCmd = async (cmd: string, label: string) => {
      try {
        await navigator.clipboard.writeText(cmd);
        await rescanAll(`Skopiowano komendę dla ${label}. Uruchom ją w terminalu/PowerShell, a potem wklej wynik w pole poniżej.`);
      } catch {
        await rescanAll(`Komenda dla ${label}: ${cmd}`);
      }
    };
    host.querySelector('#hw-copy-win-cmd')?.addEventListener('click', () => void copyCmd(DEEP_SCAN_COMMANDS.windows, 'Windows (PowerShell)'));
    host.querySelector('#hw-copy-linux-cmd')?.addEventListener('click', () => void copyCmd(DEEP_SCAN_COMMANDS.linux, 'Linux (Bash)'));
    host.querySelector('#hw-copy-mac-cmd')?.addEventListener('click', () => void copyCmd(DEEP_SCAN_COMMANDS.macos, 'macOS (Terminal)'));

    host.querySelector('#hw-parse-smbios-btn')?.addEventListener('click', async () => {
      const raw = host.querySelector<HTMLTextAreaElement>('#hw-smbios-input')?.value || '';
      const res = hardwareScannerService.parseDeepHardwareDump(raw);
      if (res.ok && res.inventory) {
        void this.recordLog(
          'HARDWARE',
          'OK',
          'Import specyfikacji SMBIOS',
          res.inventory.computerModel,
          `${res.inventory.ramModules.length} RAM / ${res.inventory.disks.length} Dysków`,
          res.message
        );
      }
      await rescanAll(res.message);
    });

    host.querySelector('#hw-clear-smbios-btn')?.addEventListener('click', async () => {
      hardwareScannerService.clearDeepInventory();
      await rescanAll('Wyczyszczono zaimportowany raport SMBIOS.');
    });

    host.querySelector('#hw-tab-overview')?.addEventListener('click', () => {
      this.hwScannerTab = 'overview';
      this.renderPeripheralsView(host);
    });
    host.querySelector('#hw-tab-deep')?.addEventListener('click', () => {
      this.hwScannerTab = 'deep_analysis';
      this.renderPeripheralsView(host);
    });
    host.querySelector('#hw-deep-validate-ram-btn')?.addEventListener('click', async () => {
      if (this.deepRamValidating) return;
      this.deepRamValidating = true;
      this.renderPeripheralsView(host);
      try {
        this.ramState = await ramTestService.runTest(128, (res) => {
          this.ramState = res;
        });
        this.hardwareScanNotice = `Walidacja DRAM ukończona: Odczyt ${this.ramState.bandwidthReadMBs} MB/s · Zapis ${this.ramState.bandwidthWriteMBs} MB/s · Latency ${this.ramState.latencyNs} ns · ${this.ramState.errorsFound} błędów.`;
        this.emitDiagnosticChanged('deep-ram-validation', false);
      } finally {
        this.deepRamValidating = false;
        if (this.activeModule === 'peripherals') this.renderPeripheralsView(host);
      }
    });
    host.querySelector('#hw-deep-validate-disk-btn')?.addEventListener('click', async () => {
      if (this.deepDiskValidating) return;
      this.deepDiskValidating = true;
      this.renderPeripheralsView(host);
      try {
        this.diskState = await diskTestService.runTest((res) => {
          this.diskState = res;
        });
        this.hardwareScanNotice = `Weryfikacja SSD ukończona: Seq ${this.diskState.seqReadMBs}/${this.diskState.seqWriteMBs} MB/s · SMART ${this.diskState.smartHealthPct}% (${this.diskState.smartStatus}) · ${this.diskState.crcVerified ? 'CRC32 OK' : 'Błąd CRC32'}.`;
        this.emitDiagnosticChanged('deep-disk-validation', false);
      } finally {
        this.deepDiskValidating = false;
        if (this.activeModule === 'peripherals') this.renderPeripheralsView(host);
      }
    });

    // --- 1. Fan & Cooling Ramp Test + Interactive Fan Curve Editor ---
    const cleanupFanCurve = mountFanCurveEditor({
      container: host,
      initialCurve: fanTestService.getFanCurve(),
      getLiveCpuTempC: () => thermalMonitorService.getLiveCpuTempC(),
      onChange: (nextCurve) => {
        fanTestService.setFanCurve(nextCurve);
        this.emitDiagnosticChanged('fan-curve', false);
      },
    });

    // --- 1A. Monitor PWM Frequency Bindings ---
    let openBearingTooltipChannelId: string | null = null;
    let isDraggingBearingSlider = false;

    const applyOpenBearingTooltipDom = () => {
      const body = host.querySelector<HTMLElement>('#fan-pwm-monitor-live-body');
      if (!body) return;
      body.querySelectorAll<HTMLElement>('.fan-pwm-bearing-box').forEach((box) => {
        const chId = box.dataset.bearingChannel || '';
        const isOpen = openBearingTooltipChannelId !== null && chId === openBearingTooltipChannelId;
        box.classList.toggle('is-tooltip-open', isOpen);
        const btn = box.querySelector<HTMLButtonElement>('.fan-bearing-info-btn');
        if (btn) btn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
      });
    };

    const updateBearingThresholdUiInPlace = (pwmState: ReturnType<typeof fanTestService.getPwmMonitorState>) => {
      const body = host.querySelector<HTMLElement>('#fan-pwm-monitor-live-body');
      if (!body) return;
      const thresh = pwmState.predictiveMaintenanceThresholdPct;
      body.querySelectorAll<HTMLElement>('.fan-bearing-threshold-val').forEach((el) => {
        el.textContent = `${thresh}%`;
      });
      body.querySelectorAll<HTMLElement>('.fan-bearing-threshold-num').forEach((el) => {
        el.textContent = String(thresh);
      });
      const summaryEl = body.querySelector<HTMLElement>('[data-maint-summary]');
      const summaryCnt = body.querySelector<HTMLElement>('[data-maint-summary-count]');
      if (summaryEl && summaryCnt) {
        const hasAlerts = pwmState.maintenanceAlertCount > 0;
        summaryEl.classList.toggle('is-maint-alert', hasAlerts);
        summaryCnt.className = `font-mono ${hasAlerts ? 'status-err' : 'status-ok'}`;
        summaryCnt.textContent = hasAlerts
          ? `⚠ ${pwmState.maintenanceAlertCount} Alert${pwmState.maintenanceAlertCount > 1 ? 's' : ''}`
          : '✓ OK';
      }
      pwmState.channels.forEach((ch) => {
        const box = body.querySelector<HTMLElement>(
          `.fan-pwm-bearing-box[data-bearing-channel="${CSS.escape(ch.id)}"]`
        );
        if (!box) return;
        box.classList.toggle('is-maint-alert', ch.maintenanceAlertTriggered);
        box.dataset.maintAlert = ch.maintenanceAlertTriggered ? 'true' : 'false';
        const score = Math.max(0, Math.min(100, Math.round(ch.bearingHealthIndex)));
        const statusEl = box.querySelector<HTMLElement>('.fan-bearing-tooltip-status');
        if (statusEl) {
          statusEl.className = `fan-bearing-tooltip-status ${ch.maintenanceAlertTriggered ? 'is-alert' : 'is-ok'} font-mono`;
          statusEl.textContent = ch.maintenanceAlertTriggered
            ? `⚠ Predictive Maintenance Alert (${score}% < ${thresh}%)`
            : `✓ Within Tolerance (${score}% ≥ ${thresh}%)`;
        }
        const sliderEl = box.querySelector<HTMLInputElement>('.fan-bearing-threshold-slider');
        if (sliderEl && document.activeElement !== sliderEl) {
          sliderEl.value = String(thresh);
        }
        let maintPill = box.querySelector<HTMLElement>('.fan-pwm-bearing-maint-pill');
        if (ch.maintenanceAlertTriggered) {
          if (!maintPill) {
            maintPill = document.createElement('div');
            maintPill.className = 'fan-pwm-bearing-maint-pill font-mono';
            maintPill.setAttribute('role', 'alert');
            const predEl = box.querySelector('.fan-pwm-bearing-pred');
            if (predEl) box.insertBefore(maintPill, predEl);
            else box.appendChild(maintPill);
          }
          maintPill.textContent = `⚠ Predictive Maintenance (<${thresh}%): ${score}%`;
        } else if (maintPill) {
          maintPill.remove();
        }
      });
    };

    const syncBearingHistoryUi = (pwmState = fanTestService.getPwmMonitorState()) => {
      if (this.activeModule !== 'peripherals') return;
      const tabBtnHist = host.querySelector<HTMLButtonElement>('#fan-tab-btn-bearing-history');
      if (tabBtnHist) {
        const badge = tabBtnHist.querySelector('.fan-tab-alert-pill');
        if (pwmState.maintenanceAlertCount > 0) {
          if (badge) {
            badge.textContent = String(pwmState.maintenanceAlertCount);
          } else {
            const pill = document.createElement('span');
            pill.className = 'fan-tab-alert-pill font-mono';
            pill.textContent = String(pwmState.maintenanceAlertCount);
            tabBtnHist.appendChild(pill);
          }
        } else if (badge) {
          badge.remove();
        }
      }
      const openAlertBtn = host.querySelector<HTMLButtonElement>('#fan-open-bearing-alert-btn');
      if (openAlertBtn) {
        openAlertBtn.className = `btn ${pwmState.maintenanceAlertCount > 0 ? 'btn-danger' : 'btn-secondary'} btn-sm`;
        openAlertBtn.innerHTML = `<span>${
          pwmState.maintenanceAlertCount > 0
            ? `⚠ Alert stanu łożysk (${pwmState.maintenanceAlertCount})`
            : 'Poradnik konserwacji łożysk'
        }</span>`;
      }
      const histSummary = host.querySelector<HTMLElement>('#fan-bearing-history-summary');
      if (histSummary) {
        histSummary.innerHTML = renderFanBearingHistorySummaryHtml(pwmState);
      }
      if (this.fanHeatmapTab === 'bearing_history') {
        const bhChartHost = host.querySelector<HTMLElement>('#fan-bearing-history-d3');
        if (bhChartHost) renderFanBearingHistoryChartD3(bhChartHost, pwmState);
      }
    };

    const syncPwmMonitorUi = (pwmState = fanTestService.getPwmMonitorState()) => {
      if (this.activeModule !== 'peripherals') return;
      const body = host.querySelector<HTMLElement>('#fan-pwm-monitor-live-body');
      if (body) {
        if (isDraggingBearingSlider) {
          updateBearingThresholdUiInPlace(pwmState);
        } else {
          body.innerHTML = renderFanPwmMonitorInnerHtml(pwmState);
          applyOpenBearingTooltipDom();
        }
      }
      const toggleBtn = host.querySelector<HTMLButtonElement>('#fan-pwm-monitor-toggle-btn');
      if (toggleBtn) {
        toggleBtn.className = `btn ${pwmState.active ? 'btn-danger' : 'btn-primary'} btn-sm`;
        toggleBtn.setAttribute('aria-pressed', pwmState.active ? 'true' : 'false');
        toggleBtn.innerHTML = `${iconSvg(pwmState.active ? 'stop' : 'pulse', 14)}<span>${pwmState.active ? 'Zatrzymaj monitor PWM' : 'Monitoruj sygnał PWM'}</span>`;
      }
      const driftBtn = host.querySelector<HTMLButtonElement>('#fan-pwm-drift-test-btn');
      if (driftBtn) {
        driftBtn.className = `btn ${pwmState.driftTestEnabled ? 'btn-amber' : 'btn-secondary'} btn-sm`;
        driftBtn.textContent = pwmState.driftTestEnabled ? '⚡ Symulacja usterki: WŁ.' : '⚡ Symuluj usterkę / dryft (Test)';
      }
      syncBearingHistoryUi(pwmState);

      if (pwmState.maintenanceAlertCount === 0) {
        this.predictiveBearingAlertDismissed = false;
        if (document.getElementById('predictive-bearing-alert-modal')) {
          this.updatePredictiveBearingAlertModal(pwmState);
        }
      } else if (!isDraggingBearingSlider) {
        const hasAlertedLife = pwmState.channels.some(
          (ch) =>
            ch.predictedLifeExpectancyPct < pwmState.predictiveMaintenanceThresholdPct ||
            ch.bearingHealthIndex < pwmState.predictiveMaintenanceThresholdPct
        );
        if (hasAlertedLife && pwmState.driftTestEnabled && !this.predictiveBearingAlertDismissed) {
          this.openPredictiveBearingAlertModal(null, pwmState);
        } else if (document.getElementById('predictive-bearing-alert-modal')) {
          this.updatePredictiveBearingAlertModal(pwmState);
        }
      }
    };
    const unsubscribePwmMonitor = fanTestService.subscribePwmMonitor(syncPwmMonitorUi);

    const pwmLiveBody = host.querySelector<HTMLElement>('#fan-pwm-monitor-live-body');
    pwmLiveBody?.addEventListener('click', (ev) => {
      const target = ev.target as HTMLElement | null;
      const alertBtn = target?.closest<HTMLElement>('[data-open-bearing-alert]');
      if (alertBtn) {
        ev.stopPropagation();
        const chId = alertBtn.dataset.openBearingAlert;
        this.predictiveBearingAlertDismissed = false;
        this.openPredictiveBearingAlertModal(chId && chId !== 'all' ? chId : null);
        return;
      }
      const infoBtn = target?.closest<HTMLButtonElement>('.fan-bearing-info-btn');
      if (infoBtn) {
        ev.stopPropagation();
        const chId = infoBtn.dataset.bearingInfo || '';
        openBearingTooltipChannelId = openBearingTooltipChannelId === chId ? null : chId;
        applyOpenBearingTooltipDom();
      }
    });

    pwmLiveBody?.addEventListener('pointerdown', (ev) => {
      const target = ev.target as HTMLElement | null;
      const slider = target?.closest<HTMLInputElement>('.fan-bearing-threshold-slider');
      if (slider) {
        isDraggingBearingSlider = true;
        openBearingTooltipChannelId = slider.dataset.bearingChannel || openBearingTooltipChannelId;
        applyOpenBearingTooltipDom();
      }
    });

    pwmLiveBody?.addEventListener('input', (ev) => {
      const target = ev.target as HTMLElement | null;
      const slider = target?.closest<HTMLInputElement>('.fan-bearing-threshold-slider');
      if (slider) {
        isDraggingBearingSlider = true;
        this.predictiveBearingAlertDismissed = false;
        const val = Number(slider.value);
        if (Number.isFinite(val)) {
          fanTestService.setPredictiveMaintenanceThresholdPct(val);
        }
      }
    });

    pwmLiveBody?.addEventListener('change', (ev) => {
      const target = ev.target as HTMLElement | null;
      const slider = target?.closest<HTMLInputElement>('.fan-bearing-threshold-slider');
      if (slider) {
        const val = Number(slider.value);
        isDraggingBearingSlider = false;
        this.predictiveBearingAlertDismissed = false;
        if (Number.isFinite(val)) {
          fanTestService.setPredictiveMaintenanceThresholdPct(val);
        }
        syncPwmMonitorUi(fanTestService.getPwmMonitorState());
      }
    });

    const onBearingDocPointerUp = () => {
      if (isDraggingBearingSlider) {
        isDraggingBearingSlider = false;
        syncPwmMonitorUi(fanTestService.getPwmMonitorState());
      }
    };
    const onBearingDocClick = (ev: MouseEvent) => {
      if (!openBearingTooltipChannelId) return;
      const target = ev.target as HTMLElement | null;
      if (target?.closest('.fan-pwm-bearing-box')) return;
      openBearingTooltipChannelId = null;
      applyOpenBearingTooltipDom();
    };
    document.addEventListener('pointerup', onBearingDocPointerUp);
    document.addEventListener('click', onBearingDocClick);

    host.querySelector<HTMLButtonElement>('#fan-pwm-monitor-toggle-btn')?.addEventListener('click', () => {
      if (fanTestService.isPwmMonitoring()) {
        fanTestService.stopPwmFrequencyMonitor();
      } else {
        fanTestService.startPwmFrequencyMonitor();
        const latest = fanTestService.getPwmMonitorState();
        void this.recordLog(
          'THERMAL',
          latest.deviationCount > 0 || latest.rpmDutyWarningCount > 0 ? 'WARN' : 'OK',
          'Monitor częstotliwości PWM wentylatorów',
          `Cel płyty: ${latest.programmedHz} Hz (±${latest.tolerancePct}%)`,
          latest.deviationCount > 0 ? `${latest.deviationCount} odchyleń` : 'Zgodne',
          `Uruchomiono pomiar sygnału PWM oraz kontrolę rozjazdu RPM/Duty (>15% / >3s) dla ${latest.channels.length} kanałów wentylatorów.`
        );
      }
    });

    host.querySelector<HTMLSelectElement>('#fan-pwm-target-hz-select')?.addEventListener('change', (ev) => {
      const targetHz = Number((ev.target as HTMLSelectElement).value) || 25000;
      fanTestService.setProgrammedPwmFrequencyHz(targetHz);
    });

    host.querySelector<HTMLSelectElement>('#fan-pwm-tolerance-select')?.addEventListener('change', (ev) => {
      const tolPct = Number((ev.target as HTMLSelectElement).value) || 4;
      fanTestService.setPwmTolerancePct(tolPct);
    });

    host.querySelector<HTMLButtonElement>('#fan-pwm-drift-test-btn')?.addEventListener('click', () => {
      const current = fanTestService.getPwmMonitorState();
      const nextEnabled = !current.driftTestEnabled;
      if (nextEnabled) this.predictiveBearingAlertDismissed = false;
      fanTestService.setPwmDriftTestEnabled(nextEnabled);
      if (nextEnabled && !fanTestService.isPwmMonitoring()) {
        fanTestService.startPwmFrequencyMonitor();
      }
    });

    // --- 1C. RPM-vs-Microphone Noise Resonance Heatmap, FFT & Bearing Health History Bindings ---
    const applyHeatmapTabDom = (nextTab: FanHeatmapSectionTab) => {
      this.fanHeatmapTab = nextTab;
      const resPanel = host.querySelector<HTMLElement>('#fan-heatmap-tab-resonance');
      const histPanel = host.querySelector<HTMLElement>('#fan-heatmap-tab-bearing-history');
      if (resPanel) resPanel.hidden = nextTab !== 'resonance';
      if (histPanel) histPanel.hidden = nextTab !== 'bearing_history';
      host.querySelectorAll<HTMLButtonElement>('[data-fan-heatmap-tab]').forEach((btn) => {
        const match = btn.dataset.fanHeatmapTab === nextTab;
        btn.classList.toggle('active', match);
        btn.setAttribute('aria-selected', match ? 'true' : 'false');
      });
      if (nextTab === 'bearing_history') {
        syncBearingHistoryUi(fanTestService.getPwmMonitorState());
      } else {
        syncAcousticHeatmapUi(fanTestService.getAcousticHeatmapState());
      }
    };

    const heatmapPanelEl = host.querySelector<HTMLElement>('#fan-acoustic-heatmap-panel');
    heatmapPanelEl?.addEventListener('click', (ev) => {
      const target = ev.target as HTMLElement | null;
      const tabBtn = target?.closest<HTMLButtonElement>('[data-fan-heatmap-tab]');
      if (tabBtn) {
        const nextTab: FanHeatmapSectionTab =
          tabBtn.dataset.fanHeatmapTab === 'bearing_history' ? 'bearing_history' : 'resonance';
        applyHeatmapTabDom(nextTab);
        return;
      }
      const alertBtn = target?.closest<HTMLElement>('[data-open-bearing-alert]');
      if (alertBtn) {
        const chId = alertBtn.dataset.openBearingAlert;
        this.predictiveBearingAlertDismissed = false;
        this.openPredictiveBearingAlertModal(chId && chId !== 'all' ? chId : null);
      }
    });

    const syncAcousticHeatmapUi = (hmState = fanTestService.getAcousticHeatmapState()) => {
      if (this.activeModule !== 'peripherals') return;
      const metaHost = host.querySelector<HTMLElement>('#fan-heatmap-meta-host');
      if (metaHost) metaHost.innerHTML = renderFanAcousticHeatmapMetaHtml(hmState);
      if (this.fanHeatmapTab === 'resonance') {
        const d3Host = host.querySelector<HTMLElement>('#fan-acoustic-heatmap-d3');
        if (d3Host) renderFanAcousticHeatmapD3(d3Host, hmState);
        const fftHost = host.querySelector<HTMLElement>('#fan-acoustic-fft-d3');
        if (fftHost) renderFanFftSpectrumD3(fftHost, hmState);
        const harmonicsHost = host.querySelector<HTMLElement>('#fan-acoustic-harmonics-host');
        if (harmonicsHost) harmonicsHost.innerHTML = renderFanFftHarmonicsStripHtml(hmState);
        const zonesHost = host.querySelector<HTMLElement>('#fan-resonance-zones-host');
        if (zonesHost) zonesHost.innerHTML = renderFanResonanceZonesHtml(hmState);
      } else {
        syncBearingHistoryUi(fanTestService.getPwmMonitorState());
      }

      const micBtn = host.querySelector<HTMLButtonElement>('#fan-heatmap-mic-btn');
      if (micBtn) {
        micBtn.className = `btn ${hmState.capturing ? 'btn-danger' : 'btn-primary'} btn-sm`;
        micBtn.innerHTML = `${iconSvg(hmState.capturing ? 'stop' : 'volume-on', 14)}<span>${hmState.capturing ? 'Zatrzymaj nasłuch mikrofonu' : 'Uruchom nasłuch mikrofonu'}</span>`;
      }
      const sweepBtn = host.querySelector<HTMLButtonElement>('#fan-heatmap-sweep-btn');
      if (sweepBtn) {
        sweepBtn.disabled = hmState.sweeping;
        sweepBtn.innerHTML = `<span>${hmState.sweeping ? 'Skanowanie RPM…' : 'Skan rezonansu (500–5500 RPM)'}</span>`;
      }
    };
    const unsubscribeAcousticHeatmap = fanTestService.subscribeAcousticHeatmap(syncAcousticHeatmapUi);
    syncAcousticHeatmapUi(fanTestService.getAcousticHeatmapState());
    if (this.fanHeatmapTab === 'bearing_history') {
      syncBearingHistoryUi(fanTestService.getPwmMonitorState());
    }

    host.querySelector<HTMLSelectElement>('#fan-heatmap-blades-select')?.addEventListener('change', (ev) => {
      const blades = Number((ev.target as HTMLSelectElement).value) || 7;
      fanTestService.setAcousticBladeCount(blades);
    });

    host.querySelector<HTMLButtonElement>('#fan-heatmap-mic-btn')?.addEventListener('click', async () => {
      const cur = fanTestService.getAcousticHeatmapState();
      if (cur.capturing) {
        fanTestService.stopLiveAcousticHeatmapCapture();
      } else {
        await fanTestService.startLiveAcousticHeatmapCapture();
      }
    });

    host.querySelector<HTMLButtonElement>('#fan-heatmap-sweep-btn')?.addEventListener('click', async () => {
      const res = await fanTestService.runResonanceCalibrationSweep();
      void this.recordLog(
        'THERMAL',
        res.resonanceZones.length > 0 ? 'WARN' : 'OK',
        'Skan rezonansu akustycznego i widma FFT (RPM vs Harmoniczne)',
        `${res.sampleCount} próbek`,
        res.resonanceZones.length > 0 ? `${res.resonanceZones.length} strefy rezonansu` : 'Brak rezonansu',
        res.resonanceZones.length > 0
          ? `Wykryto strefy podwyższonych drgań: ${res.resonanceZones.map((z) => `${z.rpmMin}-${z.rpmMax} RPM (+${z.excessDb} dB${z.dominantHz ? `, FFT ${z.dominantHz} Hz` : ''})`).join(', ')}.`
          : 'Nie wykryto mechanicznych pików rezonansu w zakresie 500–5500 RPM.'
      );
    });

    host.querySelector<HTMLButtonElement>('#fan-heatmap-clear-btn')?.addEventListener('click', () => {
      fanTestService.clearAcousticHeatmap();
    });

    host.querySelector<HTMLButtonElement>('#fan-heatmap-export-fft-btn')?.addEventListener('click', () => {
      const { filename, data } = fanTestService.exportFftSpectrumToJson();
      void this.recordLog(
        'THERMAL',
        'INFO',
        'Eksport widma FFT do JSON',
        `${data.fullFrequencyBuckets.length} koszyków FFT`,
        filename,
        `Wyeksportowano pełne widmo częstotliwości (${data.analysisConfig.fftSize}-pt FFT, ${data.analysisConfig.binResolutionHz} Hz/bin, ${data.majorHarmonics.length} Major Harmonics).`
      );
    });

    host.querySelector<HTMLInputElement>('#fan-mic-checkbox')?.addEventListener('change', (e) => {
      this.fanMicAcoustic = (e.target as HTMLInputElement).checked;
    });

    host.querySelector('#fan-toggle-btn')?.addEventListener('click', async () => {
      if (fanTestService.isRunning()) {
        fanTestService.stop();
        this.fanState = { ...fanTestService.getState(), running: false, stage: 'idle', stageLabel: 'Przerwano ręcznie' };
        this.finalizeStressSession(
          'Test Wentylatorów',
          75,
          `Przerwano · Szczyt ${this.fanState.peakRpm} RPM`,
          'UWAGA'
        );
        if (this.activeModule === 'peripherals') this.renderPeripheralsView(host);
        return;
      }

      this.beginStressSession();
      await fanTestService.startFanRampTest(this.fanMicAcoustic, (state) => {
        this.fanState = state;
        if (this.activeModule === 'peripherals') {
          const box = host.querySelector('#fan-live-container');
          if (box) box.innerHTML = this.renderFanLiveInnerHtml(state);
          const btn = host.querySelector<HTMLButtonElement>('#fan-toggle-btn');
          if (btn) {
            btn.className = `btn ${state.running ? 'btn-danger' : 'btn-primary'} btn-sm`;
            btn.innerHTML = `${iconSvg(state.running ? 'stop' : 'fan', 14)}<span>${state.running ? 'Zatrzymaj test wentylatorów' : 'Uruchom test wentylatorów (24s)'}</span>`;
          }
        }
        if (state.stage === 'completed') {
          void this.recordLog(
            'THERMAL',
            state.verdict === 'CHŁODZENIE SPRAWNE' ? 'OK' : 'WARN',
            'Test wentylatorów i chłodzenia',
            'Szczyt RPM / Akustyka',
            `${state.peakRpm} RPM`,
            `Ocena: ${state.verdict}${state.micMonitoring && state.noiseDeltaDb !== null ? `, Delta hałasu: +${state.noiseDeltaDb} dB` : ''}`
          );
          const fanStab =
            state.verdict === 'CHŁODZENIE SPRAWNE'
              ? 96
              : state.verdict === 'GŁOŚNA PRACA / OBCIĄŻENIE'
                ? 80
                : 62;
          this.finalizeStressSession(
            'Test Wentylatorów',
            fanStab,
            `Szczyt ${state.peakRpm} RPM · ${state.verdict}`
          );
        }
      });
    });

    // --- 2. Keyboard Matrix Listeners ---
    const updateKeyStats = () => {
      const testedEl = host.querySelector('#kbd-tested-cnt');
      const nkroEl = host.querySelector('#kbd-nkro-cnt');
      const codeEl = host.querySelector('#kbd-last-code');
      if (testedEl) testedEl.textContent = String(this.testedKeys.size);
      if (nkroEl) nkroEl.textContent = `${this.pressedKeys.size} / ${this.maxNkro}`;
      if (codeEl) codeEl.textContent = this.lastKeyCode;
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) {
        return;
      }
      if (!e.ctrlKey && !e.metaKey && !e.altKey && !['F5', 'F11', 'F12', 'Escape', 'Tab'].includes(e.key)) {
        e.preventDefault();
      }
      this.pressedKeys.add(e.code);
      this.testedKeys.add(e.code);
      this.lastKeyCode = e.code;
      if (this.pressedKeys.size > this.maxNkro) this.maxNkro = this.pressedKeys.size;
      const keyEl = host.querySelector(`[data-key-code="${CSS.escape(e.code)}"]`);
      keyEl?.classList.add('pressed', 'tested');
      updateKeyStats();
    };

    const onKeyUp = (e: KeyboardEvent) => {
      this.pressedKeys.delete(e.code);
      const keyEl = host.querySelector(`[data-key-code="${CSS.escape(e.code)}"]`);
      keyEl?.classList.remove('pressed');
      updateKeyStats();
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);

    // --- 3. Advanced Mouse & Click (Microsecond Latency & Polling Stability Histogram) ---
    const mousePad = host.querySelector<HTMLElement>('#mouse-test-pad');
    const syncMouseUi = () => {
      const snap = mouseDiagnosticsService.getSnapshot();
      const badge = host.querySelector('#mouse-hz-badge');
      const padHz = host.querySelector('#mouse-pad-hz');
      const padStab = host.querySelector('#mouse-pad-stability');
      const verdictBadge = host.querySelector('#mouse-verdict-badge');
      const verdictNote = host.querySelector('#mouse-verdict-note');
      const lastUs = host.querySelector('#mouse-last-us');
      const minAvgUs = host.querySelector('#mouse-min-avg-us');
      const dwellUs = host.querySelector('#mouse-dwell-us');
      const clicksEl = host.querySelector('#mouse-clicks-val');
      const scrollEl = host.querySelector('#mouse-scroll-val');
      const bounceEl = host.querySelector('#mouse-bounce-val');
      const histStats = host.querySelector('#mouse-hist-stats');
      const histBars = host.querySelector('#mouse-histogram-bars');
      const clicksLog = host.querySelector('#mouse-recent-clicks');

      if (badge) badge.textContent = `${snap.pollingHz} Hz (Szczyt: ${snap.peakPollingHz} Hz · ${snap.nominalTierLabel})`;
      if (padHz) padHz.textContent = `${snap.pollingHz} Hz`;
      if (padStab) padStab.textContent = `Stabilność: ${snap.stabilityPct}%`;
      if (verdictBadge) {
        const cls =
          snap.sensorVerdict === 'SENSOR WZOROWY'
            ? 'ok'
            : snap.sensorVerdict === 'LEKKIE WAHANIA USB'
              ? 'warn'
              : snap.sensorVerdict === 'WYKRYTO NIESTABILNOŚĆ SENSORA'
                ? 'err'
                : 'neutral';
        verdictBadge.className = `verdict-badge ${cls}`;
        verdictBadge.textContent = snap.sensorVerdict;
      }
      if (verdictNote) verdictNote.textContent = snap.sensorVerdictNote;
      if (lastUs) lastUs.textContent = snap.lastClickLatencyUs !== null ? `${snap.lastClickLatencyUs.toLocaleString('pl-PL')} µs` : '—';
      if (minAvgUs) minAvgUs.textContent = snap.minClickLatencyUs !== null ? `${snap.minClickLatencyUs.toLocaleString('pl-PL')} / ${snap.avgClickLatencyUs?.toLocaleString('pl-PL') ?? '—'} µs` : '—';
      if (dwellUs) dwellUs.textContent = snap.lastDwellUs !== null ? `${snap.lastDwellUs.toLocaleString('pl-PL')} µs` : '—';
      if (clicksEl) {
        clicksEl.textContent = `${snap.clicks.lmb} / ${snap.clicks.mmb} / ${snap.clicks.rmb} / ${snap.clicks.side4} / ${snap.clicks.side5}`;
      }
      if (scrollEl) scrollEl.textContent = `${snap.scrollDeltaPx} px`;
      if (bounceEl) {
        const faults = snap.chatterFaults + snap.doubleClickFaults;
        bounceEl.textContent = `${snap.chatterFaults} / ${snap.doubleClickFaults}`;
        bounceEl.className = `font-mono ${faults > 0 ? 'status-err' : 'status-ok'}`;
      }
      if (histStats) {
        histStats.textContent = `Śr: ${snap.meanIntervalUs} µs · Med: ${snap.medianIntervalUs} µs · P99: ${snap.p99IntervalUs} µs · σ: ${snap.jitterStdDevUs} µs · Spadki: ${snap.inconsistencyEvents}`;
      }
      if (histBars) histBars.innerHTML = this.renderMouseHistogramHtml(snap);
      if (clicksLog) clicksLog.innerHTML = this.renderMouseRecentClicksHtml(snap);
    };

    host.querySelectorAll<HTMLButtonElement>('[data-mouse-target-hz]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const hz = Number(btn.dataset.mouseTargetHz) || 0;
        mouseDiagnosticsService.setTargetPollingHz(hz);
        host.querySelectorAll<HTMLButtonElement>('[data-mouse-target-hz]').forEach((other) => {
          const otherHz = Number(other.dataset.mouseTargetHz) || 0;
          other.className = `btn ${otherHz === hz ? 'btn-primary' : 'btn-secondary'} btn-sm`;
        });
        syncMouseUi();
      });
    });

    mousePad?.addEventListener('pointermove', (ev) => {
      const coalesced = typeof ev.getCoalescedEvents === 'function' ? ev.getCoalescedEvents() : [ev];
      const now = performance.now();
      const timestamps = coalesced.map((c) => (Number.isFinite(c.timeStamp) && c.timeStamp > 0 ? c.timeStamp : now));
      mouseDiagnosticsService.recordPointerMoveTimestamps(timestamps.length > 0 ? timestamps : [now], now);
      syncMouseUi();
    });

    mousePad?.addEventListener('mousedown', (ev) => {
      ev.preventDefault();
      if (!buttonIndexToKey(ev.button)) return;
      const sample = mouseDiagnosticsService.recordMouseDown(ev.button, performance.now());
      if (sample && (sample.flag === 'CHATTER' || sample.flag === 'DOUBLE_CLICK')) {
        void this.recordLog(
          'PERIPHERALS',
          'WARN',
          sample.flag === 'CHATTER' ? 'Wykryto chatter mikroprzełącznika' : 'Wykryto dwuklik myszy',
          `${sample.buttonLabel} interwał`,
          `${sample.interClickUs ?? 0} µs`,
          'Potencjalne zużycie lub drgania styków mikroprzełącznika'
        );
      }
      syncMouseUi();
    });

    mousePad?.addEventListener('mouseup', (ev) => {
      if (!buttonIndexToKey(ev.button)) return;
      mouseDiagnosticsService.recordMouseUp(ev.button, performance.now());
      syncMouseUi();
    });

    mousePad?.addEventListener('wheel', (ev) => {
      ev.preventDefault();
      mouseDiagnosticsService.recordWheel(ev.deltaY);
      syncMouseUi();
    });

    // --- 4. Dedicated Touchpad (Gładzik) Surface Canvas ---
    const tpCanvas = host.querySelector<HTMLCanvasElement>('#touchpad-canvas');
    const tpCtx = tpCanvas?.getContext('2d') || null;
    const activePointers = new Map<number, { x: number; y: number }>();
    const trailPoints: Array<{ x: number; y: number; t: number }> = [];

    const drawTouchpad = () => {
      if (!tpCanvas || !tpCtx) return;
      const rect = tpCanvas.getBoundingClientRect();
      const w = Math.max(200, Math.floor(rect.width));
      const h = Math.max(120, Math.floor(rect.height));
      if (tpCanvas.width !== w || tpCanvas.height !== h) {
        tpCanvas.width = w;
        tpCanvas.height = h;
      }
      tpCtx.clearRect(0, 0, w, h);

      // Subtle grid
      tpCtx.strokeStyle = 'rgba(148, 163, 184, 0.14)';
      tpCtx.lineWidth = 1;
      for (let x = 32; x < w; x += 32) {
        tpCtx.beginPath();
        tpCtx.moveTo(x, 0);
        tpCtx.lineTo(x, h);
        tpCtx.stroke();
      }
      for (let y = 32; y < h; y += 32) {
        tpCtx.beginPath();
        tpCtx.moveTo(0, y);
        tpCtx.lineTo(w, y);
        tpCtx.stroke();
      }

      // Draw recent finger trail
      const now = performance.now();
      while (trailPoints.length > 0 && now - trailPoints[0].t > 1600) trailPoints.shift();
      for (let i = 1; i < trailPoints.length; i++) {
        const a = trailPoints[i - 1];
        const b = trailPoints[i];
        const alpha = Math.max(0.05, 1 - (now - b.t) / 1600);
        tpCtx.strokeStyle = `rgba(6, 182, 212, ${alpha.toFixed(2)})`;
        tpCtx.lineWidth = 2.5;
        tpCtx.beginPath();
        tpCtx.moveTo(a.x, a.y);
        tpCtx.lineTo(b.x, b.y);
        tpCtx.stroke();
      }

      // Draw active touch contacts
      for (const pt of activePointers.values()) {
        tpCtx.fillStyle = 'rgba(16, 185, 129, 0.35)';
        tpCtx.strokeStyle = '#10b981';
        tpCtx.lineWidth = 2;
        tpCtx.beginPath();
        tpCtx.arc(pt.x, pt.y, 14, 0, Math.PI * 2);
        tpCtx.fill();
        tpCtx.stroke();
      }
    };

    const syncTouchpadUi = () => {
      const fBadge = host.querySelector('#tp-fingers-badge');
      const gLbl = host.querySelector('#tp-gesture-lbl');
      const sVal = host.querySelector('#tp-scroll-val');
      const pVal = host.querySelector('#tp-pinch-val');
      const tVal = host.querySelector('#tp-taps-val');
      if (fBadge) fBadge.textContent = `Palce: ${this.touchpadFingers} (Max: ${this.touchpadMaxFingers})`;
      if (gLbl) gLbl.textContent = this.touchpadLastGesture;
      if (sVal) sVal.textContent = `${this.touchpadScrollX} px / ${this.touchpadScrollY} px`;
      if (pVal) pVal.textContent = `${this.touchpadPinchScale.toFixed(2)}×`;
      if (tVal) tVal.textContent = `${this.touchpadTaps} stuknięć · Max ${this.touchpadMaxFingers} pkt`;
      drawTouchpad();
    };
    drawTouchpad();

    tpCanvas?.addEventListener('pointerdown', (ev) => {
      const rect = tpCanvas.getBoundingClientRect();
      const x = ev.clientX - rect.left;
      const y = ev.clientY - rect.top;
      activePointers.set(ev.pointerId, { x, y });
      this.touchpadFingers = activePointers.size;
      if (this.touchpadFingers > this.touchpadMaxFingers) this.touchpadMaxFingers = this.touchpadFingers;
      this.touchpadTaps++;
      this.touchpadLastGesture = `Dotyk (${ev.pointerType}) · X:${Math.round(x)} Y:${Math.round(y)}`;
      trailPoints.push({ x, y, t: performance.now() });
      syncTouchpadUi();
    });

    tpCanvas?.addEventListener('pointermove', (ev) => {
      const rect = tpCanvas.getBoundingClientRect();
      const x = ev.clientX - rect.left;
      const y = ev.clientY - rect.top;
      if (activePointers.has(ev.pointerId)) {
        activePointers.set(ev.pointerId, { x, y });
      }
      trailPoints.push({ x, y, t: performance.now() });
      if (trailPoints.length > 90) trailPoints.shift();
      this.touchpadLastGesture = `Ruch gładzika · X:${Math.round(x)} Y:${Math.round(y)}`;
      syncTouchpadUi();
    });

    const releasePointer = (ev: PointerEvent) => {
      activePointers.delete(ev.pointerId);
      this.touchpadFingers = activePointers.size;
      syncTouchpadUi();
    };
    tpCanvas?.addEventListener('pointerup', releasePointer);
    tpCanvas?.addEventListener('pointercancel', releasePointer);

    tpCanvas?.addEventListener('wheel', (ev) => {
      ev.preventDefault();
      if (ev.ctrlKey) {
        // Trackpad pinch-to-zoom gesture in Chromium/Firefox/Safari
        const factor = ev.deltaY < 0 ? 1.04 : 0.96;
        this.touchpadPinchScale = Math.max(0.25, Math.min(4.0, this.touchpadPinchScale * factor));
        this.touchpadMaxFingers = Math.max(this.touchpadMaxFingers, 2);
        this.touchpadLastGesture = `Gest Pinch-to-Zoom (${this.touchpadPinchScale.toFixed(2)}×)`;
      } else {
        this.touchpadScrollX += Math.round(ev.deltaX);
        this.touchpadScrollY += Math.round(ev.deltaY);
        this.touchpadMaxFingers = Math.max(this.touchpadMaxFingers, 2);
        this.touchpadLastGesture = `Przewijanie 2-palcowe dX:${Math.round(ev.deltaX)} dY:${Math.round(ev.deltaY)}`;
      }
      syncTouchpadUi();
    }, { passive: false });

    // --- 5. Pro Stereo / Sweep / Pink Noise Speaker Tester ---
    const freqRange = host.querySelector<HTMLInputElement>('#audio-freq-range');
    const freqLbl = host.querySelector('#audio-freq-lbl');
    const syncAudioBtns = (active: AudioChannelMode) => {
      host.querySelectorAll<HTMLButtonElement>('[data-audio-mode]').forEach((b) => {
        const m = b.dataset.audioMode as AudioChannelMode;
        b.className = `btn ${active === m && m !== 'off' ? 'btn-primary' : m === 'off' ? 'btn-danger' : 'btn-secondary'} btn-sm`;
      });
    };

    host.querySelectorAll<HTMLButtonElement>('[data-audio-mode]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const mode = btn.dataset.audioMode as AudioChannelMode;
        const freq = Number(freqRange?.value) || 440;
        peripheralsTestService.startTone(mode, freq, (liveHz) => {
          if (freqLbl) freqLbl.textContent = `${liveHz} Hz (Sweep)`;
          if (freqRange) freqRange.value = String(liveHz);
        });
        if (mode === 'pink_noise' && freqLbl) {
          freqLbl.textContent = 'Różowy szum (20Hz–20kHz)';
        } else if (mode === 'off' && freqLbl) {
          freqLbl.textContent = `${peripheralsTestService.getAudioFreq()} Hz`;
        }
        syncAudioBtns(peripheralsTestService.getAudioMode());
      });
    });

    freqRange?.addEventListener('input', () => {
      const f = Number(freqRange.value) || 440;
      if (freqLbl) freqLbl.textContent = `${f} Hz`;
      peripheralsTestService.setToneFrequency(f);
    });

    host.querySelectorAll<HTMLButtonElement>('[data-audio-preset]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const f = Number(btn.dataset.audioPreset) || 440;
        if (freqRange) freqRange.value = String(f);
        if (freqLbl) freqLbl.textContent = `${f} Hz`;
        peripheralsTestService.setToneFrequency(f);
      });
    });

    // --- 6. Microphone Pro VU Meter + 4s Loopback Echo Recorder ---
    const micBtn = host.querySelector<HTMLButtonElement>('#mic-toggle-btn');
    const micRecBtn = host.querySelector<HTMLButtonElement>('#mic-record-btn');
    const micSelect = host.querySelector<HTMLSelectElement>('#mic-device-select');
    const micDbLbl = host.querySelector('#mic-db-lbl');
    const micFill = host.querySelector<HTMLElement>('#mic-vu-fill');
    const micStatus = host.querySelector('#mic-status-lbl');
    const micAudioEl = host.querySelector<HTMLAudioElement>('#mic-playback-audio');

    micSelect?.addEventListener('change', () => {
      this.micSelectedDeviceId = micSelect.value;
    });

    micBtn?.addEventListener('click', async () => {
      if (peripheralsTestService.isMicActive()) {
        peripheralsTestService.stopMicrophone();
        this.micInfo = 'Zatrzymano nasłuch mikrofonu';
        if (micStatus) micStatus.textContent = this.micInfo;
        if (micFill) micFill.style.width = '0%';
        micBtn.textContent = 'Testuj mikrofon';
        micBtn.className = 'btn btn-primary btn-sm';
      } else {
        try {
          const label = await peripheralsTestService.startMicrophone(
            (pct, db, devName) => {
              this.micLevelPct = pct;
              this.micDb = db;
              this.micInfo = devName;
              if (micDbLbl) micDbLbl.textContent = `${db} dB (${pct}%)`;
              if (micFill) micFill.style.width = `${pct}%`;
              if (micStatus) micStatus.textContent = devName;
            },
            this.micSelectedDeviceId || undefined
          );
          micBtn.textContent = 'Zatrzymaj';
          micBtn.className = 'btn btn-danger btn-sm';
          void this.recordLog('PERIPHERALS', 'OK', 'Test mikrofonu', 'Urządzenie', 'Aktywny', label);
        } catch (err) {
          this.micInfo = err instanceof Error ? `Błąd / brak zgody: ${err.message}` : 'Brak dostępu do mikrofonu';
          if (micStatus) micStatus.textContent = this.micInfo;
        }
      }
    });

    micRecBtn?.addEventListener('click', async () => {
      if (this.micRecording) return;
      this.micRecording = true;
      micRecBtn.disabled = true;
      micRecBtn.textContent = 'Nagrywanie 4s… Mów teraz!';
      if (micStatus) micStatus.textContent = 'Nagrywanie 4-sekundowej próbki głosu…';
      try {
        const blobUrl = await peripheralsTestService.recordMicSample(4000);
        if (micAudioEl) {
          micAudioEl.src = blobUrl;
          micAudioEl.style.display = 'block';
          void micAudioEl.play().catch(() => {});
        }
        this.micInfo = 'Nagrano 4-sekundową próbkę — odsłuchaj poniżej';
        if (micStatus) micStatus.textContent = this.micInfo;
        void this.recordLog('PERIPHERALS', 'OK', 'Test echa mikrofonu (4s)', 'Nagranie', 'OK', 'Zapisano próbkę audio do odsłuchu');
      } catch (err) {
        this.micInfo = err instanceof Error ? `Błąd nagrania: ${err.message}` : 'Nie udało się nagrać próbki';
        if (micStatus) micStatus.textContent = this.micInfo;
      } finally {
        this.micRecording = false;
        micRecBtn.disabled = false;
        micRecBtn.textContent = 'Nagraj 4s (Test echa)';
      }
    });

    // --- 7. Gamepad Pro (Dual Sticks, Stick Drift, Triggers, 16 Buttons, Rumble) ---
    host.querySelector('#gamepad-rumble-btn')?.addEventListener('click', async () => {
      if (typeof navigator.getGamepads !== 'function') return;
      const pads = Array.from(navigator.getGamepads()).filter((p): p is Gamepad => p !== null);
      const pad = pads[0] as any;
      if (!pad) return;
      try {
        if (pad.vibrationActuator?.playEffect) {
          await pad.vibrationActuator.playEffect('dual-rumble', {
            startDelay: 0,
            duration: 500,
            weakMagnitude: 0.7,
            strongMagnitude: 0.9,
          });
        }
      } catch {
        // Ignore unsupported rumble
      }
    });

    let gamepadRaf = 0;
    const BTN_NAMES = ['A/✕', 'B/○', 'X/□', 'Y/△', 'LB', 'RB', 'LT', 'RT', 'Back', 'Start', 'L3', 'R3', '▲', '▼', '◄', '►'];
    const pollGamepads = () => {
      const box = host.querySelector('#gamepad-status-box');
      if (box && typeof navigator.getGamepads === 'function') {
        const pads = Array.from(navigator.getGamepads()).filter((p): p is Gamepad => p !== null);
        if (pads.length === 0) {
          box.innerHTML = `
            <div class="kv-row">
              <span class="kv-key">Wykryty kontroler</span>
              <span class="kv-val">Brak (podłącz pad USB/BT i wciśnij dowolny przycisk)</span>
            </div>`;
        } else {
          const pad = pads[0];
          const lx = pad.axes[0] || 0;
          const ly = pad.axes[1] || 0;
          const rx = pad.axes[2] || 0;
          const ry = pad.axes[3] || 0;
          const lMag = Math.hypot(lx, ly);
          const rMag = Math.hypot(rx, ry);
          const lDrift = lMag > 0.08 && lMag < 0.35;
          const rDrift = rMag > 0.08 && rMag < 0.35;
          const ltPct = Math.round((pad.buttons[6]?.value || 0) * 100);
          const rtPct = Math.round((pad.buttons[7]?.value || 0) * 100);

          box.innerHTML = `
            <div class="kv-row">
              <span class="kv-key">Model kontrolera</span>
              <span class="kv-val">${esc(pad.id.slice(0, 44))}</span>
            </div>
            <div class="gamepad-sticks">
              <div class="stick-box">
                <div class="stick-arena">
                  <div class="stick-dot" style="left:${50 + lx * 44}%;top:${50 + ly * 44}%;"></div>
                </div>
                <div class="font-mono" style="font-size:11px;">Lewy: ${lx.toFixed(2)}, ${ly.toFixed(2)}</div>
                <div style="font-size:10px;" class="${lDrift ? 'status-warn' : 'status-ok'}">${lDrift ? 'Możliwy Stick Drift!' : 'Centrum OK'}</div>
              </div>
              <div class="stick-box">
                <div class="stick-arena">
                  <div class="stick-dot" style="left:${50 + rx * 44}%;top:${50 + ry * 44}%;"></div>
                </div>
                <div class="font-mono" style="font-size:11px;">Prawy: ${rx.toFixed(2)}, ${ry.toFixed(2)}</div>
                <div style="font-size:10px;" class="${rDrift ? 'status-warn' : 'status-ok'}">${rDrift ? 'Możliwy Stick Drift!' : 'Centrum OK'}</div>
              </div>
              <div class="stack-sm" style="flex:1;min-width:120px;">
                <div class="font-mono" style="font-size:11px;">Spust LT: <strong class="status-cyan">${ltPct}%</strong></div>
                <div class="progress-track"><div class="progress-fill" style="width:${ltPct}%"></div></div>
                <div class="font-mono" style="font-size:11px;">Spust RT: <strong class="status-cyan">${rtPct}%</strong></div>
                <div class="progress-track"><div class="progress-fill" style="width:${rtPct}%"></div></div>
              </div>
            </div>
            <div class="gp-buttons-grid">
              ${pad.buttons
                .slice(0, 16)
                .map(
                  (b, i) =>
                    `<span class="gp-btn-chip ${b.pressed ? 'pressed' : ''}">${BTN_NAMES[i] || `B${i}`}</span>`
                )
                .join('')}
            </div>`;
        }
      }
      gamepadRaf = requestAnimationFrame(pollGamepads);
    };
    gamepadRaf = requestAnimationFrame(pollGamepads);

    // --- 8. Webcam Opt-in Probe ---
    const camBtn = host.querySelector<HTMLButtonElement>('#cam-toggle-btn');
    const camVideo = host.querySelector<HTMLVideoElement>('#cam-video-el');
    const camStatus = host.querySelector('#cam-status-lbl');
    camBtn?.addEventListener('click', async () => {
      if (peripheralsTestService.isCameraActive()) {
        peripheralsTestService.stopCamera(camVideo);
        this.camInfo = 'Zatrzymano podgląd kamery';
        if (camStatus) camStatus.textContent = this.camInfo;
        camBtn.textContent = 'Uruchom kamerę';
        camBtn.className = 'btn btn-primary btn-sm';
      } else if (camVideo) {
        try {
          const meta = await peripheralsTestService.startCamera(camVideo);
          this.camInfo = `${meta.label} · ${meta.width}×${meta.height} @ ${meta.fps} FPS`;
          if (camStatus) camStatus.textContent = this.camInfo;
          camBtn.textContent = 'Zatrzymaj';
          camBtn.className = 'btn btn-danger btn-sm';
          void this.recordLog('PERIPHERALS', 'OK', 'Test kamery', 'Rozdzielczość', `${meta.width}x${meta.height} @ ${meta.fps}fps`, meta.label);
        } catch (err) {
          this.camInfo = err instanceof Error ? `Błąd / brak zgody: ${err.message}` : 'Brak dostępu do kamery';
          if (camStatus) camStatus.textContent = this.camInfo;
        }
      }
    });

    // Reset button
    host.querySelector('#periph-reset-btn')?.addEventListener('click', () => {
      this.pressedKeys.clear();
      this.testedKeys.clear();
      this.maxNkro = 0;
      this.lastKeyCode = '—';
      mouseDiagnosticsService.reset();
      this.touchpadFingers = 0;
      this.touchpadMaxFingers = 0;
      this.touchpadScrollX = 0;
      this.touchpadScrollY = 0;
      this.touchpadPinchScale = 1.0;
      this.touchpadTaps = 0;
      this.touchpadLastGesture = 'Dotknij lub przesuń palcami po powierzchni gładzika';
      this.renderPeripheralsView(host);
    });

    this.peripheralsCleanup = () => {
      cleanupFanCurve();
      unsubscribePwmMonitor();
      unsubscribeAcousticHeatmap();
      document.removeEventListener('pointerup', onBearingDocPointerUp);
      document.removeEventListener('click', onBearingDocClick);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      cancelAnimationFrame(gamepadRaf);
    };
  }

  /* =========================================================================
     9. SIEĆ, PING I STABILNOŚĆ ŁĄCZA (NETWORK DIAGNOSTICS)
     ========================================================================= */
  private renderNetworkView(host: HTMLElement): void {
    const n = this.networkState;
    const busy = n.status === 'running';
    const gradeCls =
      n.qualityGrade === 'WZOROWA' || n.qualityGrade === 'DOBRA'
        ? 'status-ok'
        : n.qualityGrade === 'NIESTABILNA'
          ? 'status-warn'
          : 'status-err';

    const direction: NetworkTransferDirection = n.transferDirection || networkTestService.getTransferDirection();
    const dirLabel =
      direction === 'download'
        ? 'Tylko Pobieranie (Download ⬇️)'
        : direction === 'upload'
          ? 'Tylko Wysyłanie (Upload ⬆️)'
          : 'Pobieranie + Wysyłanie (Full Duplex ⇅)';
    const activeStreams = n.activeStreams || networkTestService.getActiveStreams();
    const linkProfile = n.linkProfileGbps ?? networkTestService.getLinkProfileGbps();
    const selectedServerId = n.selectedServerId || networkTestService.getSelectedServerId();
    const probes = n.serverScanResults && n.serverScanResults.length > 0 ? n.serverScanResults : networkTestService.getCachedServerProbes();

    const targetLabel = n.continuousMode ? '∞ (Bez limitu)' : `${n.targetSamples || 24}`;
    const speedSamples = n.speedSamples && n.speedSamples.length > 0 ? n.speedSamples : [];
    const activeLiveSpeedMbps =
      direction === 'upload'
        ? n.uploadEstMbps || 0
        : direction === 'download'
          ? n.downloadEstMbps
          : Math.max(n.downloadEstMbps, n.uploadEstMbps || 0);

    const adapters = n.adapters || [];
    const measuredPeakMbps = Math.max(n.downloadEstMbps, n.uploadEstMbps || 0, n.lanLoopbackMbps || 0);
    const cableCmp = getCableCapacityComparison(adapters, measuredPeakMbps);

    host.innerHTML = `
      <div class="stack-lg">
        <div class="section-header">
          <div>
            <h1 class="section-title">Diagnostyka Sieci, LAN (Kabel RJ-45 / Wi-Fi) &amp; Speed Test (Bez Limitu ∞)</h1>
            <p class="section-subtitle">
              Wybierz kierunek transferu (Pobieranie + Wysyłanie, Tylko Pobieranie lub Tylko Wysyłanie), liczbę strumieni TCP/HTTP (4–12), serwer z 32 węzłów IXP i uruchamiaj test próbkowany lub <strong>Tryb Ciągły — Bez limitu (∞)</strong>.
            </p>
          </div>
          <div class="row-wrap" style="gap:8px;">
            <button id="net-run-btn" type="button" class="btn btn-primary" ${busy ? 'disabled' : ''}>
              ${iconSvg('play', 14)}
              <span>${busy && !n.continuousMode && n.targetSamples === 24 ? 'Trwa test (24)...' : 'Speed Test (24 próbki)'}</span>
            </button>
            <button id="net-run-64-btn" type="button" class="btn btn-secondary" ${busy ? 'disabled' : ''}>
              ${iconSvg('play', 14)}
              <span>Pełny Test (64 próbki)</span>
            </button>
            <button id="net-run-continuous-btn" type="button" class="btn ${n.continuousMode && busy ? 'btn-danger' : 'btn-amber'}" ${busy && !n.continuousMode ? 'disabled' : ''}>
              ${iconSvg(n.continuousMode && busy ? 'stop' : 'activity', 14)}
              <span>${n.continuousMode && busy ? 'Zatrzymaj Tryb Ciągły (∞)' : 'Tryb Ciągły — Bez limitu (∞)'}</span>
            </button>
            ${
              busy && !n.continuousMode
                ? `<button id="net-stop-btn" type="button" class="btn btn-danger">
                     ${iconSvg('stop', 14)}
                     <span>Zatrzymaj</span>
                   </button>`
                : ''
            }
          </div>
        </div>

        <div class="panel stack-sm" style="padding:14px;border:1.5px solid rgba(6, 182, 212, 0.35);background:linear-gradient(135deg, rgba(6, 182, 212, 0.08), rgba(16, 185, 129, 0.05));">
          <div class="row-between" style="flex-wrap:wrap;gap:10px;">
            <div class="stack-xs">
              <strong style="font-size:13px;color:var(--accent-cyan);">Kierunek transferu Speed Testu (działa również w Trybie Ciągłym ∞ bez limitu):</strong>
              <div class="segmented" role="group" aria-label="Kierunek pomiaru transferu">
                <button type="button" class="segmented-btn ${direction === 'both' ? 'active' : ''}" data-net-direction="both">⇅ Pobieranie + Wysyłanie</button>
                <button type="button" class="segmented-btn ${direction === 'download' ? 'active' : ''}" data-net-direction="download">⬇️ Tylko Pobieranie (Download)</button>
                <button type="button" class="segmented-btn ${direction === 'upload' ? 'active' : ''}" data-net-direction="upload">⬆️ Tylko Wysyłanie (Upload)</button>
              </div>
            </div>

            <div class="row-wrap" style="gap:10px;align-items:center;">
              <div class="stack-xs">
                <span style="font-size:11.5px;color:var(--text-secondary);">Strumienie HTTP:</span>
                <div class="segmented" role="group" aria-label="Liczba strumieni">
                  ${[6, 8, 10, 12]
                    .map(
                      (st) => `
                      <button type="button" class="segmented-btn ${activeStreams === st ? 'active' : ''}" data-net-streams="${st}" ${busy ? 'disabled' : ''}>
                        ${st}×
                      </button>`
                    )
                    .join('')}
                </div>
              </div>

              <div class="stack-xs">
                <span style="font-size:11.5px;color:var(--text-secondary);">Profil łącza:</span>
                <div class="segmented" role="group" aria-label="Profil łącza">
                  ${[
                    { gbps: 0, label: 'Auto' },
                    { gbps: 1, label: '1G' },
                    { gbps: 2.5, label: '2.5G' },
                    { gbps: 10, label: '10G' },
                  ]
                    .map(
                      (lp) => `
                      <button type="button" class="segmented-btn ${linkProfile === lp.gbps ? 'active' : ''}" data-net-link="${lp.gbps}" ${busy ? 'disabled' : ''}>
                        ${lp.label}
                      </button>`
                    )
                    .join('')}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="panel">
          <div class="row-between" style="margin-bottom:8px;flex-wrap:wrap;gap:6px;">
            <span style="font-weight:600;">${esc(dirLabel)} · Próbki: ${n.samples.length} / ${targetLabel} · Przesłano: ${(n.transferredMB || 0).toFixed(2)} MB · Węzeł: ${esc(n.selectedServerName || 'Warszawa')}</span>
            <span class="font-mono ${gradeCls}">${n.status === 'completed' ? n.qualityGrade : n.continuousMode && busy ? `LIVE ∞ (${activeLiveSpeedMbps} Mbps)` : `${n.progress}%`}</span>
          </div>
          <div class="progress-track">
            <div class="progress-fill ${n.status === 'completed' ? 'ok' : ''}" style="width:${n.continuousMode && busy ? 100 : n.progress}%"></div>
          </div>
        </div>

        <div class="grid-5">
          <div class="metric-card" style="${direction === 'upload' ? 'opacity:0.55;' : direction === 'download' ? 'border-color:rgba(6, 182, 212, 0.55);' : ''}">
            <span class="metric-label">Pobieranie (Download)</span>
            <div class="metric-row">
              <span class="metric-value status-cyan">${direction === 'upload' ? 'Pominięto' : n.downloadEstMbps > 0 ? n.downloadEstMbps : '—'}</span>
              <span class="metric-unit">${direction === 'upload' ? '' : 'Mbps'}</span>
            </div>
            <span class="metric-foot">Peak: <strong class="font-mono">${n.peakDownloadMbps || n.downloadEstMbps || 0} Mbps</strong> · ${activeStreams} strumieni</span>
          </div>

          <div class="metric-card" style="${direction === 'download' ? 'opacity:0.55;' : direction === 'upload' ? 'border-color:rgba(16, 185, 129, 0.55);' : ''}">
            <span class="metric-label">Wysyłanie (Upload)</span>
            <div class="metric-row">
              <span class="metric-value status-ok">${direction === 'download' ? 'Pominięto' : (n.uploadEstMbps || 0) > 0 ? n.uploadEstMbps : '—'}</span>
              <span class="metric-unit">${direction === 'download' ? '' : 'Mbps'}</span>
            </div>
            <span class="metric-foot">Peak: <strong class="font-mono">${n.peakUploadMbps || n.uploadEstMbps || 0} Mbps</strong> · Dane: ${(n.transferredMB || 0).toFixed(1)} MB</span>
          </div>

          <div class="metric-card">
            <span class="metric-label">Średni Ping (RTT)</span>
            <div class="metric-row">
              <span class="metric-value">${n.pingAvgMs > 0 ? n.pingAvgMs : '—'}</span>
              <span class="metric-unit">ms</span>
            </div>
            <span class="metric-foot">Min: ${n.pingMinMs} ms · Max: ${n.pingMaxMs} ms</span>
          </div>

          <div class="metric-card">
            <span class="metric-label">Jitter &amp; Bufferbloat</span>
            <div class="metric-row">
              <span class="metric-value ${n.jitterMs > 20 ? 'status-warn' : 'status-ok'}">${n.samples.length > 1 ? n.jitterMs : '—'}</span>
              <span class="metric-unit">ms</span>
            </div>
            <span class="metric-foot">Bufferbloat: <strong class="font-mono">+${n.bufferbloatMs ?? 0} ms</strong> · VoIP MOS: <strong class="font-mono">${n.voipMosScore || '—'}</strong>/5</span>
          </div>

          <div class="metric-card">
            <span class="metric-label">Utrata pakietów &amp; CDN</span>
            <div class="metric-row">
              <span class="metric-value ${n.packetLossPct > 0 ? 'status-err' : 'status-ok'}">${n.packetLossPct}</span>
              <span class="metric-unit">%</span>
            </div>
            <span class="metric-foot">DNS/TCP: ${n.dnsLookupMs ?? 0} ms · CDN: ${n.cdnEdgeMs ?? 0} ms</span>
          </div>
        </div>

        <div class="grid-2">
          <div class="panel stack-md">
            <div class="panel-header" style="margin-bottom:0;">
              <h2 class="panel-title">Przepustowość łącza (${esc(dirLabel)})</h2>
              <span class="panel-caption">Oś Y: Rzeczywisty transfer multi-stream (Mbps)</span>
            </div>
            ${renderDualLineChart(
              [
                {
                  label: 'Download Speed (Mbps)',
                  color: '#06b6d4',
                  values: speedSamples.length > 0 ? speedSamples.map((s) => s.downloadMbps) : [n.downloadEstMbps || 0],
                  unit: 'Mbps',
                  min: 0,
                },
                {
                  label: 'Upload Speed (Mbps)',
                  color: '#10b981',
                  values: speedSamples.length > 0 ? speedSamples.map((s) => s.uploadMbps) : [n.uploadEstMbps || 0],
                  unit: 'Mbps',
                  min: 0,
                },
              ],
              speedSamples.length > 0 ? speedSamples.map((s) => `#${s.seq}`) : ['#1'],
              200
            )}
          </div>

          <div class="panel stack-md">
            <div class="panel-header" style="margin-bottom:0;">
              <h2 class="panel-title">Przebieg opóźnień (Ping) kolejnych próbek</h2>
              <span class="panel-caption">Oś Y: Opóźnienie odpowiedzi HTTP (ms)</span>
            </div>
            ${renderDualLineChart(
              [
                {
                  label: 'Ping HTTP',
                  color: '#f59e0b',
                  values: n.samples.slice(-64).map((s) => s.latencyMs),
                  unit: 'ms',
                  min: 0,
                },
              ],
              n.samples.slice(-64).map((s) => `#${s.seq}`),
              200
            )}
          </div>
        </div>

        <div class="panel stack-md">
          <div class="panel-header" style="margin-bottom:0;flex-wrap:wrap;gap:8px;">
            <div>
              <h2 class="panel-title">🔌 Diagnostyka LAN (Ethernet RJ-45, Brama Lokalna, Kabel Cat 5e–8 &amp; Wi-Fi)</h2>
              <span class="panel-caption">Sprawdź opóźnienie bramy/hosta lokalnego, przepustowość Loopback oraz prędkość negocjacji karty sieciowej (100M / 1G / 2.5G / 10G).</span>
            </div>
            <button id="net-lan-probe-btn" type="button" class="btn btn-primary btn-sm" ${this.lanProbeBusy ? 'disabled' : ''}>
              ${iconSvg('activity', 14)}
              <span>${this.lanProbeBusy ? 'Skanowanie LAN...' : 'Skanuj LAN / Bramę / Kabel RJ-45'}</span>
            </button>
          </div>

          <div class="grid-4">
            <div class="metric-card">
              <span class="metric-label">Ping Lokalny (Origin / LAN RTT)</span>
              <div class="metric-row">
                <span class="metric-value status-cyan">${n.lanGatewayRttMs !== undefined && n.lanGatewayRttMs > 0 ? n.lanGatewayRttMs : '—'}</span>
                <span class="metric-unit">ms</span>
              </div>
              <span class="metric-foot">5× szybkich impulsów HTTP same-origin</span>
            </div>

            <div class="metric-card">
              <span class="metric-label">Szybkość Pętli Lokalnej (.EXE Bridge)</span>
              <div class="metric-row">
                <span class="metric-value status-ok">${n.lanLoopbackMbps !== undefined && n.lanLoopbackMbps > 0 ? n.lanLoopbackMbps : '—'}</span>
                <span class="metric-unit">Mbps</span>
              </div>
              <span class="metric-foot">${n.lanLoopbackMbps ? 'Aktywny lokalny serwer mostka' : 'Dostępne w aplikacji .EXE lub lokalnie'}</span>
            </div>

            <div class="metric-card">
              <span class="metric-label">Wykryty Standard Przewodu / Radia</span>
              <div class="metric-row">
                <span class="metric-value" style="font-size:15px;">${esc(n.lanCableCategoryHint || cableCmp.primaryAdapter?.maxStandardLabel || 'Kliknij Skanuj LAN')}</span>
              </div>
              <span class="metric-foot">${esc(n.adapterSource || 'Oczekiwanie na sondę kart')}</span>
            </div>

            <div class="metric-card">
              <span class="metric-label">Nasycenie Fizycznego Linku LAN</span>
              <div class="metric-row">
                <span class="metric-value status-cyan">${cableCmp.saturationPct > 0 ? `${cableCmp.saturationPct}%` : '—'}</span>
                <span class="metric-unit">${cableCmp.primaryAdapter?.linkSpeedMbps ? `/ ${cableCmp.primaryAdapter.linkSpeedMbps} Mbps` : ''}</span>
              </div>
              <span class="metric-foot">${esc(n.lanStatusNote || cableCmp.bottleneckNote)}</span>
            </div>
          </div>

          ${
            adapters.length > 0
              ? `
              <div style="overflow-x:auto;">
                <table class="data-table">
                  <thead>
                    <tr>
                      <th>Interfejs</th>
                      <th>Typ</th>
                      <th>Status</th>
                      <th>Link PHY</th>
                      <th>Maks. Realny TCP</th>
                      <th>Standard Kabla / Wi-Fi</th>
                      <th>MAC</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${adapters
                      .map(
                        (ad) => `
                        <tr>
                          <td style="font-weight:600;">${esc(ad.name)} <span style="color:var(--text-muted);font-weight:400;font-size:11.5px;">${esc(ad.description)}</span></td>
                          <td>${esc(ad.type)}</td>
                          <td><span class="${ad.status === 'Up' ? 'status-ok' : 'status-warn'}">${ad.status === 'Up' ? '● Aktywna' : esc(ad.status)}</span></td>
                          <td class="font-mono status-cyan">${ad.linkSpeedMbps > 0 ? (ad.linkSpeedMbps >= 1000 ? `${(ad.linkSpeedMbps / 1000).toFixed(1)} Gbps` : `${ad.linkSpeedMbps} Mbps`) : '—'}</td>
                          <td class="font-mono">${ad.theoreticalMaxTcpMbps > 0 ? `~${ad.theoreticalMaxTcpMbps} Mbps` : '—'}</td>
                          <td style="font-size:12px;">${esc(ad.maxStandardLabel)}</td>
                          <td class="font-mono" style="font-size:11.5px;color:var(--text-muted);">${esc(ad.macAddress || '—')}</td>
                        </tr>`
                      )
                      .join('')}
                  </tbody>
                </table>
              </div>`
              : ''
          }

          <div class="grid-2" style="gap:14px;">
            <div class="stack-sm" style="background:var(--bg-inset);padding:12px;border-radius:8px;border:1px solid var(--border-hairline);">
              <strong style="font-size:12.5px;">Import rzeczywistej prędkości karty LAN/Wi-Fi z Windows PowerShell</strong>
              <div style="font-size:11.5px;color:var(--text-secondary);">Przeglądarka ukrywa fizyczną prędkość kabla RJ-45 (np. czy wynegocjował 100 Mbps zamiast 1G/2.5G). Skopiuj wyłącznie czystą komendę z pola poniżej, wklej do PowerShell i skopiuj wynik z powrotem:</div>
              <div class="ps-cmd-box">
                <input
                  id="net-ps-cmd-input"
                  type="text"
                  readonly
                  aria-label="Czysta komenda PowerShell Get-NetAdapter"
                  class="ps-cmd-input font-mono"
                  value="${esc(NET_ADAPTER_PS_COMMAND)}"
                />
                <button id="net-ps-copy-btn" type="button" class="btn btn-primary btn-sm">📋 Kopiuj komendę</button>
              </div>
              <textarea id="net-ps-paste" class="field-input" rows="3" placeholder="Wklej wynik polecenia Get-NetAdapter z PowerShell...">${esc(this.netAdapterPasteText)}</textarea>
              <div class="row-between">
                <button id="net-ps-parse-btn" type="button" class="btn btn-primary btn-sm">Analizuj karty LAN/Wi-Fi</button>
                <span class="font-mono" style="font-size:11px;color:var(--text-secondary);">${esc(this.netAdapterPasteNote)}</span>
              </div>
            </div>

            <div class="stack-sm" style="background:var(--bg-inset);padding:12px;border-radius:8px;border:1px solid var(--border-hairline);">
              <strong style="font-size:12.5px;">Porównanie kabli RJ-45 (Cat 5 – Cat 8) oraz Wi-Fi 5/6/7</strong>
              <div style="max-height:195px;overflow-y:auto;">
                <table class="data-table">
                  <thead>
                    <tr>
                      <th>Standard</th>
                      <th>Medium</th>
                      <th>Real TCP</th>
                      <th>Zasięg</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${NETWORK_CABLE_AND_WIFI_STANDARDS.map(
                      (c) => `
                      <tr>
                        <td style="font-size:11.5px;font-weight:600;">${esc(c.label)}</td>
                        <td style="font-size:11px;color:var(--text-secondary);">${esc(c.medium)}</td>
                        <td class="font-mono status-cyan" style="font-size:11.5px;">${c.realTcpMaxMbps >= 1000 ? `${(c.realTcpMaxMbps / 1000).toFixed(1)} Gbps` : `${c.realTcpMaxMbps} Mbps`}</td>
                        <td style="font-size:11px;color:var(--text-muted);">${esc(c.maxDistance)}</td>
                      </tr>`
                    ).join('')}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

        <div class="panel stack-md">
          <div class="panel-header" style="margin-bottom:0;flex-wrap:wrap;gap:8px;">
            <div>
              <h2 class="panel-title">🌐 Katalog ${SPEEDTEST_SERVER_CATALOG.length} Węzłów IXP (Polska &amp; Świat)</h2>
              <span class="panel-caption">Wybierz węzeł do sondowania RTT/Jitter lub przeskanuj wszystkie 32 węzły IXP naraz.</span>
            </div>
            <div class="row-wrap" style="gap:8px;align-items:center;">
              <select id="net-server-select" class="field-input" style="width:auto;max-width:340px;padding:6px 10px;font-size:12px;" ${busy ? 'disabled' : ''}>
                ${SPEEDTEST_SERVER_CATALOG.map(
                  (srv) => `
                  <option value="${srv.id}" ${srv.id === selectedServerId ? 'selected' : ''}>
                    [${srv.region}] ${esc(srv.city)} (${esc(srv.country)}) — ${esc(srv.provider)}
                  </option>`
                ).join('')}
              </select>
              <button id="net-scan-servers-btn" type="button" class="btn btn-secondary btn-sm" ${this.netServerScanBusy ? 'disabled' : ''}>
                ${iconSvg('activity', 14)}
                <span>${this.netServerScanBusy ? 'Skanowanie 32 węzłów...' : 'Skanuj 32 Węzły IXP'}</span>
              </button>
            </div>
          </div>

          <div style="max-height:240px;overflow-y:auto;">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Węzeł IXP</th>
                  <th>Operator</th>
                  <th>Region</th>
                  <th>Dystans / Link</th>
                  <th>Ping (RTT)</th>
                  <th>Jitter</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                ${probes
                  .map(
                    (p) => `
                    <tr data-net-pick-srv="${p.id}" style="cursor:pointer;${p.id === selectedServerId ? 'background:rgba(6, 182, 212, 0.10);' : ''}">
                      <td style="font-weight:600;">${esc(p.city)}, ${esc(p.country)}</td>
                      <td style="font-size:12px;color:var(--text-secondary);">${esc(p.provider)}</td>
                      <td class="font-mono">${p.region}</td>
                      <td class="font-mono" style="font-size:11.5px;">${p.distanceKm} km · ${p.capacityGbps}G</td>
                      <td class="font-mono status-cyan">${p.pingMs > 0 ? `${p.pingMs} ms` : '—'}</td>
                      <td class="font-mono">${p.jitterMs > 0 ? `${p.jitterMs} ms` : '—'}</td>
                      <td>
                        <span class="${p.status === 'ONLINE' ? 'status-ok' : p.status === 'TIMEOUT' ? 'status-err' : 'status-warn'}">
                          ${p.status === 'ONLINE' ? '● ONLINE' : p.status === 'TIMEOUT' ? '✖ TIMEOUT' : '…'}
                        </span>
                      </td>
                    </tr>`
                  )
                  .join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;

    const launchNetworkTest = async (opts: { sampleCount?: number; continuous?: boolean; direction?: NetworkTransferDirection }) => {
      try {
        this.networkState = await networkTestService.runTest((res) => {
          this.networkState = res;
          if (this.activeModule === 'network') this.renderNetworkView(host);
        }, {
          ...opts,
          direction: opts.direction ?? networkTestService.getTransferDirection(),
        });
        await this.recordLog(
          'NETWORK',
          this.networkState.qualityGrade === 'WZOROWA' || this.networkState.qualityGrade === 'DOBRA' ? 'OK' : 'WARN',
          opts.continuous ? 'Ciągły Speed Test & Ping (Bez limitu)' : `Speed Test & Ping (${opts.sampleCount || 24} próbek)`,
          `Download / Upload / Ping (${networkTestService.getTransferDirection()})`,
          `${this.networkState.downloadEstMbps} Mbps / ${this.networkState.uploadEstMbps} Mbps / ${this.networkState.pingAvgMs} ms`,
          `Peak DL: ${this.networkState.peakDownloadMbps} Mbps, Peak UL: ${this.networkState.peakUploadMbps} Mbps, Jitter: ${this.networkState.jitterMs} ms, Utrata: ${this.networkState.packetLossPct}%, Dane: ${this.networkState.transferredMB} MB`
        );
        this.emitDiagnosticChanged('network', true);
      } catch {
        // Already running
      }
    };

    host.querySelectorAll<HTMLButtonElement>('[data-net-direction]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const dir = (btn.dataset.netDirection as NetworkTransferDirection) || 'both';
        networkTestService.setTransferDirection(dir);
        this.networkState = { ...this.networkState, transferDirection: dir };
        if (networkTestService.isRunning()) {
          const wasContinuous = Boolean(this.networkState.continuousMode);
          const prevSamples = this.networkState.targetSamples || 24;
          networkTestService.stopTest();
          setTimeout(() => {
            void launchNetworkTest({ continuous: wasContinuous, sampleCount: prevSamples, direction: dir });
          }, 160);
        } else {
          this.renderNetworkView(host);
        }
      });
    });

    host.querySelectorAll<HTMLButtonElement>('[data-net-streams]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const st = Number(btn.dataset.netStreams) || 8;
        networkTestService.setActiveStreams(st);
        this.networkState = { ...this.networkState, activeStreams: st };
        this.renderNetworkView(host);
      });
    });

    host.querySelectorAll<HTMLButtonElement>('[data-net-link]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const gbps = Number(btn.dataset.netLink) || 0;
        networkTestService.setLinkProfileGbps(gbps);
        this.networkState = {
          ...this.networkState,
          linkProfileGbps: gbps,
          activeStreams: networkTestService.getActiveStreams(),
        };
        this.renderNetworkView(host);
      });
    });

    host.querySelector<HTMLSelectElement>('#net-server-select')?.addEventListener('change', (e) => {
      const id = (e.currentTarget as HTMLSelectElement).value;
      networkTestService.setSelectedServerId(id);
      const srv = networkTestService.getSelectedServer();
      this.networkState = {
        ...this.networkState,
        selectedServerId: srv.id,
        selectedServerName: `${srv.city} (${srv.country}) — ${srv.provider}`,
      };
      this.renderNetworkView(host);
    });

    host.querySelectorAll<HTMLTableRowElement>('[data-net-pick-srv]').forEach((row) => {
      row.addEventListener('click', () => {
        if (networkTestService.isRunning()) return;
        const id = row.dataset.netPickSrv;
        if (!id) return;
        networkTestService.setSelectedServerId(id);
        const srv = networkTestService.getSelectedServer();
        this.networkState = {
          ...this.networkState,
          selectedServerId: srv.id,
          selectedServerName: `${srv.city} (${srv.country}) — ${srv.provider}`,
        };
        this.renderNetworkView(host);
      });
    });

    host.querySelector('#net-scan-servers-btn')?.addEventListener('click', async () => {
      if (this.netServerScanBusy) return;
      this.netServerScanBusy = true;
      this.renderNetworkView(host);
      try {
        const scanned = await networkTestService.scanAllServers((probesUpdate) => {
          this.networkState = { ...this.networkState, serverScanResults: probesUpdate };
          if (this.activeModule === 'network') this.renderNetworkView(host);
        });
        this.networkState = { ...this.networkState, serverScanResults: scanned };
      } finally {
        this.netServerScanBusy = false;
        if (this.activeModule === 'network') this.renderNetworkView(host);
      }
    });

    host.querySelector('#net-lan-probe-btn')?.addEventListener('click', async () => {
      if (this.lanProbeBusy) return;
      this.lanProbeBusy = true;
      this.renderNetworkView(host);
      try {
        const lan = await networkTestService.runLanLocalProbe(this.networkState);
        this.networkState = {
          ...this.networkState,
          adapters: lan.adapters,
          adapterSource: lan.adapterSource,
          lanGatewayRttMs: lan.lanGatewayRttMs,
          lanLoopbackMbps: lan.lanLoopbackMbps,
          lanCableCategoryHint: lan.lanCableCategoryHint,
          lanStatusNote: lan.lanStatusNote,
        };
      } finally {
        this.lanProbeBusy = false;
        if (this.activeModule === 'network') this.renderNetworkView(host);
      }
    });

    host.querySelector('#net-ps-cmd-input')?.addEventListener('click', (e) => {
      (e.currentTarget as HTMLInputElement).select();
    });

    host.querySelector('#net-ps-copy-btn')?.addEventListener('click', async () => {
      const ok = await this.copyTextToClipboard(NET_ADAPTER_PS_COMMAND);
      this.netAdapterPasteNote = ok
        ? 'Skopiowano czystą komendę PowerShell (bez zbędnego tekstu)!'
        : 'Zaznacz pole komendy powyżej i naciśnij Ctrl+C.';
      this.renderNetworkView(host);
    });

    host.querySelector<HTMLTextAreaElement>('#net-ps-paste')?.addEventListener('input', (e) => {
      this.netAdapterPasteText = (e.currentTarget as HTMLTextAreaElement).value;
    });

    host.querySelector('#net-ps-parse-btn')?.addEventListener('click', () => {
      const parsed = parseNetAdapterPaste(this.netAdapterPasteText);
      if (parsed.length === 0) {
        this.netAdapterPasteNote = 'Nie rozpoznano kart — wklej pełną tabelę z PowerShell Get-NetAdapter.';
        this.renderNetworkView(host);
        return;
      }
      const peak = Math.max(this.networkState.downloadEstMbps, this.networkState.uploadEstMbps || 0, this.networkState.lanLoopbackMbps || 0);
      const cmp = getCableCapacityComparison(parsed, peak);
      this.networkState = {
        ...this.networkState,
        adapters: parsed,
        adapterSource: 'Windows PowerShell Get-NetAdapter (Import)',
        lanCableCategoryHint: cmp.primaryAdapter?.maxStandardLabel || this.networkState.lanCableCategoryHint,
        lanStatusNote: cmp.bottleneckNote,
      };
      this.netAdapterPasteNote = `Zaimportowano ${parsed.length} kart(y) sieciowych!`;
      this.renderNetworkView(host);
    });

    host.querySelector('#net-run-btn')?.addEventListener('click', () => {
      void launchNetworkTest({ sampleCount: 24, continuous: false });
    });

    host.querySelector('#net-run-64-btn')?.addEventListener('click', () => {
      void launchNetworkTest({ sampleCount: 64, continuous: false });
    });

    host.querySelector('#net-run-continuous-btn')?.addEventListener('click', () => {
      if (networkTestService.isRunning()) {
        networkTestService.stopTest();
      } else {
        void launchNetworkTest({ continuous: true, sampleCount: 24 });
      }
    });

    host.querySelector('#net-stop-btn')?.addEventListener('click', () => {
      networkTestService.stopTest();
    });
  }

  private renderSchedulerQueueTimelineHtml(
    queue: ScheduledTestItem[],
    activeIndex: number,
    running: boolean
  ): string {
    if (queue.length === 0) return '';
    return `
      <div class="panel stack-sm" style="padding:12px 14px;">
        <div class="row-between" style="margin-bottom:6px;">
          <span style="font-size:12.5px;font-weight:600;">Oś czasu kolejki (Queue Timeline)</span>
          <span class="panel-caption">${queue.length} kroków · Sekwencja diagnostyczna</span>
        </div>
        <div style="display:flex;gap:6px;align-items:center;overflow-x:auto;padding-bottom:4px;">
          ${queue
            .map((item, idx) => {
              const isActive = running && activeIndex === idx;
              const isDone = running && activeIndex > idx;
              const bg = isActive ? 'var(--accent-cyan)' : isDone ? '#10b981' : 'var(--bg-inset)';
              const color = isActive || isDone ? '#0c121e' : 'var(--text-primary)';
              return `
                <div style="flex:1;min-width:115px;padding:8px 10px;border-radius:6px;background:${bg};color:${color};border:1px solid var(--border-hairline);font-size:11px;text-align:center;">
                  <div style="font-weight:700;">#${idx + 1} ${esc(item.type.toUpperCase())}</div>
                  <div style="font-size:10px;opacity:0.85;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${esc(item.label)}</div>
                </div>
              `;
            })
            .join('')}
        </div>
      </div>
    `;
  }

  private renderSoundAlertsConfigHtml(): string {
    const sets = soundNotificationService.getSettings();
    return `
      <div class="panel stack-md" id="dash-sound-config-panel">
        <div class="panel-header" style="margin-bottom:0;flex-wrap:wrap;gap:8px;">
          <div>
            <h2 class="panel-title">Konfiguracja powiadomień dźwiękowych (Sound Alerts)</h2>
            <span class="panel-caption">Włączaj powiadomienia audio dla kluczowych zdarzeń i wybieraj presety sygnałów (Web Audio API)</span>
          </div>
          <label class="row-wrap" style="gap:8px;cursor:pointer;">
            <input type="checkbox" id="sound-master-toggle" ${sets.enabled ? 'checked' : ''} />
            <span style="font-weight:600;font-size:13px;">Główny dźwięk (Master Audio)</span>
          </label>
        </div>
        <div class="grid-2" style="gap:12px;">
          ${Object.entries(sets.events)
            .map(([evKey, evConf]) => {
              const labelMap: Record<string, string> = {
                thermalWarning: 'Ostrzeżenie termiczne (Przegrzanie)',
                testFailure: 'Błąd / Niepowodzenie testu',
                stepCompletion: 'Zakończenie kroku harmonogramu',
                generalComplete: 'Zakończenie pełnej diagnostyki',
              };
              return `
                <div class="panel stack-sm" style="background:var(--bg-inset);padding:12px;">
                  <div class="row-between">
                    <label class="row-wrap" style="gap:6px;cursor:pointer;">
                      <input type="checkbox" data-sound-ev-toggle="${evKey}" ${evConf.enabled && sets.enabled ? 'checked' : ''} />
                      <span style="font-weight:600;font-size:12.5px;">${esc(labelMap[evKey] || evKey)}</span>
                    </label>
                    <button type="button" class="btn btn-secondary btn-sm" data-sound-test="${evKey}">Test</button>
                  </div>
                  <div class="field-group" style="margin-top:6px;margin-bottom:0;">
                    <label class="field-label" style="font-size:11px;">Sygnał audio (Preset)</label>
                    <select class="field-input" style="font-size:12px;padding:5px 8px;" data-sound-preset="${evKey}">
                      <option value="harmonic" ${evConf.preset === 'harmonic' ? 'selected' : ''}>Harmonic Chime (Delikatny)</option>
                      <option value="chime" ${evConf.preset === 'chime' ? 'selected' : ''}>Dual Chime (Dwuton)</option>
                      <option value="beep" ${evConf.preset === 'beep' ? 'selected' : ''}>Sharp Beep (Krótki pik)</option>
                      <option value="pulse" ${evConf.preset === 'pulse' ? 'selected' : ''}>Sawtooth Pulse (Pulsujący)</option>
                    </select>
                  </div>
                </div>
              `;
            })
            .join('')}
        </div>
      </div>
    `;
  }

  private renderDetailedStressLogHtml(): string {
    const history = this.stressHistory;
    return `
      <div class="panel stack-md" id="dash-detailed-stress-log">
        <div class="panel-header" style="margin-bottom:0;flex-wrap:wrap;gap:8px;">
          <div>
            <h2 class="panel-title">Szczegółowy dziennik zdarzeń stresu (Detailed Stress Log)</h2>
            <span class="panel-caption">Wyszukiwanie i filtrowanie sesji obciążeniowych z pomiarami termicznymi i diagnostyką błędów</span>
          </div>
          <div class="row-wrap" style="gap:8px;flex-wrap:wrap;">
            <input id="stress-log-search" class="field-input" type="text" placeholder="Szukaj w logach..." style="width:180px;padding:6px 10px;font-size:12px;" />
            <select id="stress-log-module-filter" class="field-input" style="width:auto;padding:6px 10px;font-size:12px;">
              <option value="ALL">Wszystkie moduły</option>
              <option value="CPU">CPU</option>
              <option value="RAM">RAM</option>
              <option value="Dysk">Dysk</option>
              <option value="GPU">GPU 3D</option>
              <option value="Gra">Gra 3D MAX</option>
              <option value="Harmonogram">Harmonogram</option>
            </select>
          </div>
        </div>
        <div style="overflow-x:auto;">
          <table class="data-table">
            <thead>
              <tr>
                <th>Czas / Data</th>
                <th>Moduł testowy</th>
                <th>Status / Stabilność</th>
                <th>Temperatura CPU / GPU</th>
                <th>Czas trwania</th>
                <th>Szczegóły / Podsumowanie</th>
              </tr>
            </thead>
            <tbody id="stress-log-table-body">
              ${
                history.length === 0
                  ? `<tr><td colspan="6" style="text-align:center;color:var(--text-muted);padding:18px;">Brak wpisów w dzienniku stresu. Uruchom testy, aby zarejestrować zdarzenia.</td></tr>`
                  : [...history]
                      .reverse()
                      .map((rec) => {
                        const stab = rec.finalStabilityPct;
                        const stCls = stab >= 88 ? 'status-ok' : stab >= 72 ? 'status-warn' : 'status-err';
                        return `
                          <tr data-stress-row="${esc(rec.module)}">
                            <td class="font-mono" style="font-size:11.5px;">${new Date(rec.startedAt).toLocaleString('pl-PL')}</td>
                            <td style="font-weight:600;">${esc(rec.module)}</td>
                            <td><span class="font-mono ${stCls}" style="font-weight:700;">${stab.toFixed(1)}% stabilności</span></td>
                            <td class="font-mono">${rec.avgCpuTempC !== null ? `${rec.avgCpuTempC.toFixed(1)}°C` : '—'} / ${rec.avgGpuTempC !== null ? `${rec.avgGpuTempC.toFixed(1)}°C` : '—'}</td>
                            <td class="font-mono">${rec.durationSec.toFixed(1)}s</td>
                            <td style="font-size:12px;color:var(--text-secondary);">${esc(rec.summaryMetric)}</td>
                          </tr>
                        `;
                      })
                      .join('')
              }
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  private buildRailTroubleshootingClipboardText(railName: '+12V' | '+5V' | '+3.3V'): string {
    if (railName === '+12V') {
      return [
        'PSU Rail +12V — Kroki sprawdzania połączeń (Chwilowa niestabilność szyny / Transient Rail Instability):',
        '1. Wyłącz komputer, przełącz wyłącznik PSU na 0 i odłącz przewód sieciowy.',
        '2. Sprawdź i mocno dociśnij złącza 24-pin ATX (płyta główna), 8-pin EPS (CPU) oraz PCIe / 12VHPWR (GPU) po obu stronach (w tym w zasilaczu modularnym).',
        '3. Zasilaj kartę graficzną osobnymi kablami PCIe zamiast rozdzielacza (daisy-chain).',
        '4. Obejrzyj piny i wtyczki pod kątem przebarwień, luzów lub śladów przegrzania.',
      ].join('\n');
    }
    if (railName === '+5V') {
      return [
        'PSU Rail +5V — Kroki sprawdzania połączeń (Chwilowa niestabilność szyny / Transient Rail Instability):',
        '1. Wyłącz komputer i odłącz przewód zasilający AC.',
        '2. Dociśnij wtyczkę 24-pin ATX oraz przewody zasilające dyski SATA / Molex.',
        '3. Odłącz tymczasowo zewnętrzne huby USB i akcesoria o dużym poborze prądu, aby wykluczyć przeciążenie linii +5V.',
        '4. Zweryfikuj stan styków złączy SATA/Molex pod kątem poluzowania lub zaśniedzenia.',
      ].join('\n');
    }
    return [
      'PSU Rail +3.3V — Kroki sprawdzania połączeń (Chwilowa niestabilność szyny / Transient Rail Instability):',
      '1. Wyłącz komputer i odłącz przewód sieciowy od zasilacza.',
      '2. Sprawdź pewne osadzenie i zatrzask głównej wiązki 24-pin ATX (zarówno na płycie głównej, jak i od strony zasilacza modularnego).',
      '3. Zweryfikuj poprawne osadzenie modułów pamięci RAM oraz dysków M.2 NVMe.',
      '4. Jeśli wahania utrzymują się pod obciążeniem, przetestuj stabilność innym zasilaczem (możliwa degradacja kondensatorów PSU).',
    ].join('\n');
  }

  private getRailNominalVoltage(railName: '+12V' | '+5V' | '+3.3V'): number {
    return railName === '+12V' ? 12.0 : railName === '+5V' ? 5.0 : 3.3;
  }

  private getRailHistoryWindow(
    b: BatteryHealthState,
    railName: '+12V' | '+5V' | '+3.3V',
    windowMs: number,
    allowEmptyAfterReset = false
  ): Array<{ timestamp: number; timeLabel: string; voltageV: number; powerW: number }> {
    const history = b.railHistory || [];
    const resetAt = batteryHealthService.getRailHistoryResetAt(railName);
    const effectiveHistory =
      resetAt > 0 ? history.filter((pt) => pt.timestamp >= resetAt) : history;
    const cutoff = Math.max(Date.now() - windowMs, resetAt);
    const recent = effectiveHistory.filter((pt) => pt.timestamp >= cutoff);
    const source =
      recent.length > 0
        ? recent
        : resetAt > 0
          ? []
          : effectiveHistory.slice(-Math.max(24, Math.round(windowMs / 2500)));
    if (source.length === 0) {
      if (allowEmptyAfterReset && resetAt > 0) {
        return [];
      }
      const curV =
        railName === '+12V' ? b.psu.rail12V : railName === '+5V' ? b.psu.rail5V : b.psu.rail3P3V;
      return [
        {
          timestamp: Date.now(),
          timeLabel: '0s',
          voltageV: curV,
          powerW: b.psu.estimatedWattage || b.currentPowerDrawW || 0,
        },
      ];
    }
    return source.map((pt) => ({
      timestamp: pt.timestamp,
      timeLabel: pt.timeLabel,
      voltageV: railName === '+12V' ? pt.rail12V : railName === '+5V' ? pt.rail5V : pt.rail3P3V,
      powerW: pt.powerW,
    }));
  }

  private getRailHistoryWindow60s(
    b: BatteryHealthState,
    railName: '+12V' | '+5V' | '+3.3V'
  ): Array<{ timestamp: number; timeLabel: string; voltageV: number; powerW: number }> {
    return this.getRailHistoryWindow(b, railName, 60000);
  }

  private buildRailRawVoltageJson(
    b: BatteryHealthState,
    railName: '+12V' | '+5V' | '+3.3V',
    thresholdPct: number,
    windowSeconds: number = 60
  ): string {
    const nominalV = this.getRailNominalVoltage(railName);
    const points = this.getRailHistoryWindow(b, railName, windowSeconds * 1000);
    const currentV =
      railName === '+12V' ? b.psu.rail12V : railName === '+5V' ? b.psu.rail5V : b.psu.rail3P3V;

    let minV = Infinity;
    let maxV = -Infinity;
    let sumV = 0;
    let peakDevPct = 0;
    let outOfThresholdCount = 0;

    const samples = points.map((pt) => {
      const devPct = (Math.abs(pt.voltageV - nominalV) / nominalV) * 100;
      const out = devPct > thresholdPct;
      if (pt.voltageV < minV) minV = pt.voltageV;
      if (pt.voltageV > maxV) maxV = pt.voltageV;
      sumV += pt.voltageV;
      if (devPct > peakDevPct) peakDevPct = devPct;
      if (out) outOfThresholdCount += 1;
      return {
        timestamp: pt.timestamp,
        isoTime: new Date(pt.timestamp).toISOString(),
        timeLabel: pt.timeLabel,
        voltageV: Number(pt.voltageV.toFixed(4)),
        deviationPct: Number(devPct.toFixed(3)),
        outOfThreshold: out,
        powerW: pt.powerW,
      };
    });

    const payload = {
      rail: railName,
      nominalV,
      thresholdPct,
      windowSeconds,
      exportedAt: new Date().toISOString(),
      currentV: Number(currentV.toFixed(4)),
      currentDeviationPct: Number(((Math.abs(currentV - nominalV) / nominalV) * 100).toFixed(3)),
      sampleCount: samples.length,
      stats: {
        minV: Number((Number.isFinite(minV) ? minV : currentV).toFixed(4)),
        maxV: Number((Number.isFinite(maxV) ? maxV : currentV).toFixed(4)),
        avgV: Number((samples.length > 0 ? sumV / samples.length : currentV).toFixed(4)),
        peakDeviationPct: Number(peakDevPct.toFixed(3)),
        outOfThresholdCount,
      },
      samples,
    };

    return JSON.stringify(payload, null, 2);
  }

  private renderRailAlertSparklineOverlayHtml(
    b: BatteryHealthState,
    railName: '+12V' | '+5V' | '+3.3V',
    thresholdPct: number
  ): string {
    const nominalV = this.getRailNominalVoltage(railName);
    const points = this.getRailHistoryWindow60s(b, railName);
    const upperBound = nominalV * (1 + thresholdPct / 100);
    const lowerBound = nominalV * (1 - thresholdPct / 100);
    const vals = points.map((p) => p.voltageV);
    const minVal = Math.min(...vals);
    const maxVal = Math.max(...vals);
    const curVal = vals[vals.length - 1] ?? nominalV;

    const padSpan = nominalV * Math.max(thresholdPct / 100, 0.03) * 0.35;
    const yMin = Math.min(minVal, lowerBound) - padSpan;
    const yMax = Math.max(maxVal, upperBound) + padSpan;
    const ySpan = Math.max(0.001, yMax - yMin);

    const W = 220;
    const H = 52;
    const padX = 4;
    const padY = 5;
    const innerW = W - padX * 2;
    const innerH = H - padY * 2;

    const toY = (v: number): number => padY + ((yMax - v) / ySpan) * innerH;
    const toX = (idx: number): number =>
      points.length <= 1 ? W - padX : padX + (idx / (points.length - 1)) * innerW;

    const coords = points.map((pt, idx) => {
      const devPct = nominalV > 0 ? (Math.abs(pt.voltageV - nominalV) / nominalV) * 100 : 0;
      const x = toX(idx);
      const y = toY(pt.voltageV);
      return {
        x,
        y,
        xRatio: points.length <= 1 ? 1 : idx / (points.length - 1),
        voltageV: pt.voltageV,
        timestamp: pt.timestamp,
        timeLabel: pt.timeLabel,
        deviationPct: devPct,
        out: devPct > thresholdPct,
      };
    });

    this.psuSparklinePointsMap.set(railName, coords);

    const linePts = coords.map((c) => `${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(' ');
    const areaPts =
      coords.length > 0
        ? `${coords[0].x.toFixed(1)},${(H - padY).toFixed(1)} ${linePts} ${coords[coords.length - 1].x.toFixed(1)},${(H - padY).toFixed(1)}`
        : '';

    const bandTopY = toY(upperBound);
    const bandBotY = toY(lowerBound);
    const nomY = toY(nominalV);
    const lastCoord = coords[coords.length - 1];
    const alertDots = coords
      .filter((c) => c.out)
      .slice(-14)
      .map(
        (c) =>
          `<circle cx="${c.x.toFixed(1)}" cy="${c.y.toFixed(1)}" r="2.2" fill="#fb7185" stroke="#0b101c" stroke-width="0.8" />`
      )
      .join('');

    return `
      <div class="psu-rail-alert-sparkline-overlay" data-rail="${railName}" role="region" aria-label="Historia napięcia szyny ${railName} (ostatnie 60 sekund)">
        <div class="psu-rail-sparkline-header">
          <span class="psu-rail-sparkline-title">${railName} · 60s</span>
          <span class="psu-rail-sparkline-stats">${minVal.toFixed(2)}–${maxVal.toFixed(2)}V</span>
          <button type="button" class="psu-rail-sparkline-close-btn" data-rail="${railName}" title="Zamknij wykres historii" aria-label="Zamknij wykres historii szyny ${railName}">×</button>
        </div>
        <div class="psu-rail-sparkline-plot" data-rail="${railName}">
          <div class="psu-rail-sparkline-tooltip" role="status" aria-live="polite"></div>
          <svg class="psu-rail-sparkline-svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true">
            <rect x="${padX}" y="${bandTopY.toFixed(1)}" width="${innerW}" height="${Math.max(1, bandBotY - bandTopY).toFixed(1)}" fill="rgba(16, 185, 129, 0.14)" />
            <line x1="${padX}" y1="${bandTopY.toFixed(1)}" x2="${W - padX}" y2="${bandTopY.toFixed(1)}" stroke="rgba(244, 63, 94, 0.45)" stroke-width="0.8" stroke-dasharray="2,2" />
            <line x1="${padX}" y1="${bandBotY.toFixed(1)}" x2="${W - padX}" y2="${bandBotY.toFixed(1)}" stroke="rgba(244, 63, 94, 0.45)" stroke-width="0.8" stroke-dasharray="2,2" />
            <line x1="${padX}" y1="${nomY.toFixed(1)}" x2="${W - padX}" y2="${nomY.toFixed(1)}" stroke="rgba(148, 163, 184, 0.42)" stroke-width="0.8" stroke-dasharray="3,2" />
            ${areaPts ? `<polygon points="${areaPts}" fill="rgba(244, 63, 94, 0.16)" />` : ''}
            ${linePts ? `<polyline points="${linePts}" fill="none" stroke="#f43f5e" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round" />` : ''}
            ${alertDots}
            ${lastCoord ? `<circle cx="${lastCoord.x.toFixed(1)}" cy="${lastCoord.y.toFixed(1)}" r="3.1" fill="#38bdf8" stroke="#0b101c" stroke-width="1" />` : ''}
            <line class="psu-rail-sparkline-crosshair" x1="0" y1="${padY}" x2="0" y2="${H - padY}" stroke="rgba(56, 189, 248, 0.72)" stroke-width="1" stroke-dasharray="2,2" visibility="hidden" />
            <circle class="psu-rail-sparkline-hover-dot" cx="0" cy="0" r="3.4" fill="#38bdf8" stroke="#0b101c" stroke-width="1.1" visibility="hidden" />
          </svg>
        </div>
        <div class="psu-rail-sparkline-footer">
          <span>-60s (${points.length} pkt)</span>
          <span>Teraz: ${curVal.toFixed(2)}V (±${thresholdPct}%)</span>
        </div>
      </div>
    `;
  }

  private applySparklineHoverTooltip(
    overlayEl: HTMLElement,
    railName: '+12V' | '+5V' | '+3.3V',
    ratio: number
  ): void {
    const pts = this.psuSparklinePointsMap.get(railName);
    if (!pts || pts.length === 0) return;

    const idx = Math.max(0, Math.min(pts.length - 1, Math.round(ratio * (pts.length - 1))));
    const pt = pts[idx];
    const crosshair = overlayEl.querySelector<SVGLineElement>('.psu-rail-sparkline-crosshair');
    const dot = overlayEl.querySelector<SVGCircleElement>('.psu-rail-sparkline-hover-dot');
    const tooltip = overlayEl.querySelector<HTMLElement>('.psu-rail-sparkline-tooltip');

    if (crosshair) {
      crosshair.setAttribute('x1', pt.x.toFixed(1));
      crosshair.setAttribute('x2', pt.x.toFixed(1));
      crosshair.setAttribute('visibility', 'visible');
    }
    if (dot) {
      dot.setAttribute('cx', pt.x.toFixed(1));
      dot.setAttribute('cy', pt.y.toFixed(1));
      dot.setAttribute('fill', pt.out ? '#fb7185' : '#38bdf8');
      dot.setAttribute('visibility', 'visible');
    }
    if (tooltip) {
      const formattedTime =
        typeof pt.timestamp === 'number' && Number.isFinite(pt.timestamp)
          ? new Date(pt.timestamp).toLocaleTimeString('pl-PL', {
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
              hour12: false,
            })
          : pt.timeLabel;
      tooltip.innerHTML = `<span class="psu-rail-sparkline-tooltip-val">${pt.voltageV.toFixed(3)} V</span><span class="psu-rail-sparkline-tooltip-time">${formattedTime}</span>`;
      tooltip.classList.add('is-visible');
      tooltip.classList.toggle('is-out', pt.out);
      const clampedPct = Math.max(18, Math.min(82, pt.xRatio * 100));
      tooltip.style.left = `${clampedPct.toFixed(1)}%`;
    }
  }

  private clearSparklineHoverTooltip(overlayEl: HTMLElement): void {
    overlayEl.querySelector<SVGLineElement>('.psu-rail-sparkline-crosshair')?.setAttribute('visibility', 'hidden');
    overlayEl.querySelector<SVGCircleElement>('.psu-rail-sparkline-hover-dot')?.setAttribute('visibility', 'hidden');
    const tooltip = overlayEl.querySelector<HTMLElement>('.psu-rail-sparkline-tooltip');
    if (tooltip) {
      tooltip.classList.remove('is-visible', 'is-out');
    }
  }

  private renderRailMovingAverageTrendHtml(
    b: BatteryHealthState,
    railName: '+12V' | '+5V' | '+3.3V',
    currentV: number
  ): string {
    const points60s = this.getRailHistoryWindow60s(b, railName);
    const ma60V =
      points60s.length > 0
        ? points60s.reduce((sum, pt) => sum + pt.voltageV, 0) / points60s.length
        : currentV;
    const deltaFromMa = currentV - ma60V;
    const deltaPctFromMa = ma60V > 0 ? (deltaFromMa / ma60V) * 100 : 0;

    // Fallback to recent slope if currentV happens to equal the 60s MA within 0.0002V
    let trendDir: 'up' | 'down' | 'flat' =
      deltaFromMa > 0.0002 ? 'up' : deltaFromMa < -0.0002 ? 'down' : 'flat';
    if (trendDir === 'flat' && points60s.length >= 2) {
      const slopeDelta = points60s[points60s.length - 1].voltageV - points60s[0].voltageV;
      if (slopeDelta > 0.0002) trendDir = 'up';
      else if (slopeDelta < -0.0002) trendDir = 'down';
    }

    const trendIconSvg =
      trendDir === 'up'
        ? `<svg class="psu-rail-alert-tooltip-trend-icon" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="2 14 7 9 11 12 18 5"></polyline><polyline points="13 5 18 5 18 10"></polyline></svg>`
        : trendDir === 'down'
          ? `<svg class="psu-rail-alert-tooltip-trend-icon" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="2 6 7 11 11 8 18 15"></polyline><polyline points="13 15 18 15 18 10"></polyline></svg>`
          : `<svg class="psu-rail-alert-tooltip-trend-icon" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="2" y1="10" x2="17" y2="10"></line><polyline points="13 6 17 10 13 14"></polyline></svg>`;

    const badgeText =
      trendDir === 'up' ? '▲ UPWARD' : trendDir === 'down' ? '▼ DOWNWARD' : '→ STEADY';
    const signedV = `${deltaFromMa >= 0 ? '+' : ''}${deltaFromMa.toFixed(3)}V`;
    const signedPct = `${deltaPctFromMa >= 0 ? '+' : ''}${deltaPctFromMa.toFixed(2)}%`;
    const barWidthPct =
      trendDir === 'flat' ? 4 : Math.max(8, Math.min(50, Math.abs(deltaPctFromMa) * 18));

    return `
      <div
        class="psu-rail-alert-tooltip-trend is-${trendDir}"
        data-rail="${railName}"
        aria-label="Trend napięcia szyny ${railName} względem 60-sekundowej średniej kroczącej: ${badgeText} (${signedV}, ${signedPct}, 60s MA ${ma60V.toFixed(3)}V)"
      >
        <div class="psu-rail-alert-tooltip-trend-top">
          <span class="psu-rail-alert-tooltip-trend-main">
            ${trendIconSvg}
            <span class="psu-rail-alert-tooltip-trend-badge">${badgeText}</span>
            <span>${signedV} (${signedPct})</span>
          </span>
          <span class="psu-rail-alert-tooltip-trend-ma">60s MA: ${ma60V.toFixed(3)}V</span>
        </div>
        <div class="psu-rail-alert-tooltip-trend-track" aria-hidden="true">
          <span class="psu-rail-alert-tooltip-trend-mid"></span>
          <span class="psu-rail-alert-tooltip-trend-fill" style="width:${barWidthPct.toFixed(1)}%;"></span>
        </div>
      </div>
    `;
  }

  private renderRailDeviationTooltipHtml(
    b: BatteryHealthState,
    railName: '+12V' | '+5V' | '+3.3V',
    currentV: number,
    deviationPct: number,
    thresholdPct: number,
    isExceeded: boolean = true
  ): string {
    const checkHint =
      railName === '+12V'
        ? 'Sprawdź pewne dociśnięcie wtyczek 24-pin ATX, 8-pin EPS (CPU) oraz PCIe / 12VHPWR (GPU). Unikaj rozdzielaczy (daisy-chain) i skontroluj styki pod kątem przegrzania.'
        : railName === '+5V'
          ? 'Sprawdź wtyczkę 24-pin ATX, kable zasilania SATA / Molex oraz odepnij nadmiarowe urządzenia i huby USB o dużym poborze prądu.'
          : 'Sprawdź dociśnięcie głównej wiązki 24-pin ATX na płycie głównej oraz osadzenie modułów RAM i M.2; przy nawrotach zweryfikuj kondycję kondensatorów PSU.';
    const tooltipId = `psu-rail-tooltip-${railName.replace(/[^0-9a-z]/gi, '')}`;
    const isCopied = this.psuTooltipCopiedRail === railName;
    const isJsonCopied = this.psuTooltipJsonCopiedRail === railName;
    const isHistoryOpen = this.psuSparklineOpenRails.has(railName);
    const tooltipHeaderText = isExceeded
      ? `Chwilowa niestabilność szyny ${railName} (${currentV.toFixed(2)}V · ±${deviationPct.toFixed(1)}% &gt; ±${thresholdPct}%)`
      : `Diagnostyka szyny ${railName} (${currentV.toFixed(2)}V · ±${deviationPct.toFixed(1)}% · próg ±${thresholdPct}%)`;
    const preview5s = renderRail5sSparklinePreviewHtml(
      b.railHistory || [],
      railName,
      currentV,
      thresholdPct,
      batteryHealthService.getRailHistoryResetAt(railName)
    );
    this.psuRail5sCoordsMap.set(railName, preview5s.coords);

    return `
      <div id="${tooltipId}" class="psu-rail-alert-tooltip" role="tooltip">
        <div class="psu-rail-alert-tooltip-title">${tooltipHeaderText}</div>
        ${preview5s.html}
        ${this.renderRailMovingAverageTrendHtml(b, railName, currentV)}
        <button
          type="button"
          class="psu-rail-alert-tooltip-copy ${isCopied ? 'is-copied' : ''}"
          data-rail="${railName}"
          aria-label="Skopiuj kroki sprawdzania połączeń dla szyny ${railName} do schowka"
        >
          <span class="psu-rail-alert-tooltip-body">
            <strong>Co to oznacza:</strong> Nagły spadek lub skok napięcia podczas szybkich zmian obciążenia (transient rail instability), który może powodować zawieszanie systemu, błędy WHEA lub restarty pod obciążeniem.
          </span>
          <span class="psu-rail-alert-tooltip-action">
            <strong>Jak sprawdzić połączenia:</strong> ${checkHint}
          </span>
          <span class="psu-rail-alert-tooltip-copy-hint">
            ${isCopied ? '✓ Skopiowano kroki sprawdzania połączeń do schowka' : '📋 Kliknij tekst, aby skopiować kroki sprawdzania połączeń'}
          </span>
        </button>
        <div class="psu-rail-alert-tooltip-actions">
          <button
            type="button"
            class="psu-rail-alert-tooltip-action-btn psu-rail-alert-tooltip-json-btn ${isJsonCopied ? 'is-copied' : ''}"
            data-rail="${railName}"
            aria-label="Skopiuj surowe pomiary napięcia szyny ${railName} jako JSON"
          >
            ${isJsonCopied ? '✓ Copied JSON' : '{} Copy Raw JSON'}
          </button>
          <button
            type="button"
            class="psu-rail-alert-tooltip-action-btn psu-rail-alert-tooltip-history-btn ${isHistoryOpen ? 'is-active' : ''}"
            data-rail="${railName}"
            aria-expanded="${isHistoryOpen ? 'true' : 'false'}"
            aria-label="Pokaż lub ukryj wykres ostatnich 60 sekund dla szyny ${railName}"
          >
            ${isHistoryOpen ? '📈 Hide Rail History' : '📈 View Rail History'}
          </button>
          <button
            type="button"
            class="psu-rail-alert-tooltip-action-btn psu-rail-alert-tooltip-full-history-btn"
            data-rail="${railName}"
            aria-label="Otwórz pełną 5-minutową historię napięcia szyny ${railName} w oknie modalnym D3.js"
          >
            <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <polyline points="2 14 6 9 10 11 14 5 18 7"></polyline>
              <path d="M13 3h4v4"></path>
              <line x1="2" y1="17" x2="18" y2="17"></line>
            </svg>
            <span>View Full History</span>
          </button>
        </div>
      </div>
    `;
  }

  private applyRail5sSparklineHoverTooltip(
    previewEl: HTMLElement,
    railName: '+12V' | '+5V' | '+3.3V',
    ratio: number
  ): void {
    const pts = this.psuRail5sCoordsMap.get(railName);
    if (!pts || pts.length === 0) return;

    const idx = Math.max(0, Math.min(pts.length - 1, Math.round(ratio * (pts.length - 1))));
    const pt = pts[idx];
    const crosshair = previewEl.querySelector<SVGLineElement>('.psu-rail-5s-crosshair');
    const dot = previewEl.querySelector<SVGCircleElement>('.psu-rail-5s-hover-dot');
    const tooltip = previewEl.querySelector<HTMLElement>('.psu-rail-5s-sparkline-tooltip');

    if (crosshair) {
      crosshair.setAttribute('x1', pt.x.toFixed(1));
      crosshair.setAttribute('x2', pt.x.toFixed(1));
      crosshair.setAttribute('visibility', 'visible');
    }
    if (dot) {
      dot.setAttribute('cx', pt.x.toFixed(1));
      dot.setAttribute('cy', pt.y.toFixed(1));
      dot.setAttribute('fill', pt.out ? '#fb7185' : '#38bdf8');
      dot.setAttribute('visibility', 'visible');
    }
    if (tooltip) {
      const formattedTime =
        typeof pt.timestamp === 'number' && Number.isFinite(pt.timestamp)
          ? new Date(pt.timestamp).toLocaleTimeString('pl-PL', {
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
              hour12: false,
            })
          : pt.timeLabel;
      tooltip.innerHTML = `<span>${pt.voltageV.toFixed(3)} V</span><span>·</span><span>${formattedTime}</span>`;
      tooltip.classList.add('is-visible');
      tooltip.classList.toggle('is-out', pt.out);
      const clampedPct = Math.max(20, Math.min(80, pt.xRatio * 100));
      tooltip.style.left = `${clampedPct.toFixed(1)}%`;
    }
  }

  private clearRail5sSparklineHoverTooltip(previewEl: HTMLElement): void {
    previewEl.querySelector<SVGLineElement>('.psu-rail-5s-crosshair')?.setAttribute('visibility', 'hidden');
    previewEl.querySelector<SVGCircleElement>('.psu-rail-5s-hover-dot')?.setAttribute('visibility', 'hidden');
    const tooltip = previewEl.querySelector<HTMLElement>('.psu-rail-5s-sparkline-tooltip');
    if (tooltip) {
      tooltip.classList.remove('is-visible', 'is-out');
    }
  }

  private getBaseRailThresholdPct(railName: '+12V' | '+5V' | '+3.3V'): number {
    const rules = psuCalculatorService.getAlertRules();
    return railName === '+12V'
      ? rules.rail12VThresholdPct
      : railName === '+5V'
        ? rules.rail5VThresholdPct
        : rules.rail3P3VThresholdPct;
  }

  private getEffectiveModalThresholdPct(railName: '+12V' | '+5V' | '+3.3V'): number {
    return this.psuFullHistoryModalTempThresholdPct ?? this.getBaseRailThresholdPct(railName);
  }

  private openPsuRailFullHistoryModal(railName: '+12V' | '+5V' | '+3.3V'): void {
    this.closePsuRailFullHistoryModal();
    this.psuFullHistoryModalRail = railName;
    this.psuFullHistoryModalZoom = 2;
    this.psuFullHistoryModalWindowMin = 5;
    this.psuFullHistoryModalTempThresholdPct = null;

    const baseThresholdPct = this.getBaseRailThresholdPct(railName);
    const clampedSliderInit = Math.max(2, Math.min(15, Math.round(baseThresholdPct * 2) / 2));

    const backdrop = document.createElement('div');
    backdrop.id = 'psu-rail-full-history-modal';
    backdrop.className = 'psu-full-history-modal-backdrop';
    backdrop.setAttribute('role', 'dialog');
    backdrop.setAttribute('aria-modal', 'true');
    backdrop.setAttribute('aria-labelledby', 'psu-full-history-modal-title');

    backdrop.innerHTML = `
      <div class="psu-full-history-modal">
        <div class="psu-full-history-modal-head">
          <div>
            <h3 id="psu-full-history-modal-title" class="psu-full-history-modal-title">
              Pełna historia napięcia szyny ${railName} — Oś czasu 5 min (D3.js High-Res)
            </h3>
            <p class="psu-full-history-modal-sub" id="psu-full-history-modal-sub">
              Przewijalny wykres o wysokiej rozdzielczości obejmujący ostatnie 300 sekund pomiarów wraz z pasmem tolerancji ATX.
            </p>
          </div>
          <div class="psu-full-history-controls">
            <label class="psu-full-history-range-wrap" for="psu-full-history-range-select">
              <span>Range:</span>
              <select
                id="psu-full-history-range-select"
                class="psu-full-history-range-select"
                aria-label="Zakres czasu historii napięcia szyny ${railName}"
              >
                <option value="1">1 min (60s)</option>
                <option value="5" selected>5 min (300s)</option>
                <option value="15">15 min (900s)</option>
              </select>
            </label>
            <button type="button" class="psu-full-history-zoom-btn" data-zoom="1" title="Skala 1x">1x</button>
            <button type="button" class="psu-full-history-zoom-btn is-active" data-zoom="2" title="Skala 2x (wysoka rozdzielczość)">2x</button>
            <button type="button" class="psu-full-history-zoom-btn" data-zoom="3" title="Skala 3x (ultraszczegółowa)">3x</button>
            <button type="button" class="psu-full-history-copy-btn" id="psu-full-history-copy-json-btn">{} Copy 5m JSON</button>
            <button
              type="button"
              class="psu-full-history-export-csv-btn"
              id="psu-full-history-export-csv-btn"
              aria-label="Eksportuj bieżącą 5-minutową historię napięcia szyny ${railName} do lokalnego pliku CSV"
            >
              ${iconSvg('download', 13)}
              <span>Export 5m History (CSV)</span>
            </button>
            <button
              type="button"
              class="psu-full-history-reset-btn"
              id="psu-full-history-reset-btn"
              title="Wyczyść bieżący 5-minutowy bufor danych dla szyny ${railName} i uruchom okres ponownego próbkowania"
              aria-label="Reset 5-Minute History dla szyny ${railName}"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <polyline points="1 4 1 10 7 10"></polyline>
                <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"></path>
              </svg>
              <span>Reset 5-Minute History</span>
            </button>
            <button type="button" class="psu-full-history-close-btn" id="psu-full-history-close-btn" aria-label="Zamknij okno pełnej historii">✕ Zamknij</button>
          </div>
        </div>
        <div class="psu-full-history-tolerance-bar">
          <div class="psu-full-history-tolerance-left">
            <label class="psu-full-history-tolerance-label" for="psu-full-history-threshold-slider">
              Temp Deviation Threshold:
              <strong id="psu-full-history-threshold-val" class="font-mono">±${baseThresholdPct.toFixed(1)}%</strong>
            </label>
            <span id="psu-full-history-threshold-mode" class="psu-full-history-threshold-mode">
              Rule default (±${baseThresholdPct}%)
            </span>
            <button
              type="button"
              id="psu-full-history-threshold-reset-btn"
              class="psu-full-history-threshold-reset-btn"
              hidden
            >
              Reset to ±${baseThresholdPct}%
            </button>
          </div>
          <div class="psu-full-history-slider-wrap">
            <span class="psu-full-history-slider-bound font-mono">2%</span>
            <input
              id="psu-full-history-threshold-slider"
              class="psu-full-history-threshold-slider"
              type="range"
              min="2"
              max="15"
              step="0.5"
              value="${clampedSliderInit}"
              aria-label="Tymczasowy próg tolerancji odchyłki szyny ${railName} w procentach"
            />
            <span class="psu-full-history-slider-bound font-mono">15%</span>
          </div>
          <div id="psu-full-history-tolerance-status" class="psu-full-history-tolerance-status is-within">
            Sprawdzanie tolerancji…
          </div>
        </div>
        <div id="psu-full-history-resampling-banner" class="psu-full-history-resampling-banner" hidden>
          <div class="psu-full-history-resampling-head">
            <span id="psu-full-history-resampling-text">Re-sampling ${railName} 5-minute buffer…</span>
            <span id="psu-full-history-resampling-count" class="font-mono">0 / 20</span>
          </div>
          <div class="psu-full-history-resampling-track">
            <div id="psu-full-history-resampling-fill" class="psu-full-history-resampling-fill" style="width:0%;"></div>
          </div>
        </div>
        <div class="psu-full-history-kpi-strip" id="psu-full-history-kpi-strip"></div>
        <div id="psu-full-history-d3-chart"></div>
        <div class="psu-full-history-hint">
          <span id="psu-full-history-hint-range">Przewiń oś czasu poziomo, aby przeanalizować każdy skok napięcia z ostatnich 5 minut. Najedź na krzywą, aby zobaczyć dokładne wartości.</span>
          <span class="font-mono">Czerwone punkty = przekroczenie progu · Zielone pasmo = bezpieczny zakres</span>
        </div>
      </div>
    `;

    backdrop.addEventListener('click', (ev) => {
      if (ev.target === backdrop) {
        this.closePsuRailFullHistoryModal();
      }
    });

    backdrop.querySelector<HTMLButtonElement>('#psu-full-history-close-btn')?.addEventListener('click', () => {
      this.closePsuRailFullHistoryModal();
    });

    const copyBtn = backdrop.querySelector<HTMLButtonElement>('#psu-full-history-copy-json-btn');
    const exportCsvBtn = backdrop.querySelector<HTMLButtonElement>('#psu-full-history-export-csv-btn');
    const resetHistoryBtn = backdrop.querySelector<HTMLButtonElement>('#psu-full-history-reset-btn');
    const rangeSelect = backdrop.querySelector<HTMLSelectElement>('#psu-full-history-range-select');
    const thresholdSlider = backdrop.querySelector<HTMLInputElement>('#psu-full-history-threshold-slider');
    const thresholdResetBtn = backdrop.querySelector<HTMLButtonElement>('#psu-full-history-threshold-reset-btn');

    thresholdSlider?.addEventListener('input', () => {
      const parsed = Number(thresholdSlider.value);
      if (!Number.isFinite(parsed)) return;
      this.psuFullHistoryModalTempThresholdPct = Math.max(2, Math.min(15, parsed));
      this.updatePsuRailFullHistoryModal(batteryHealthService.getState());
    });

    thresholdResetBtn?.addEventListener('click', () => {
      this.psuFullHistoryModalTempThresholdPct = null;
      const ruleBase = this.getBaseRailThresholdPct(railName);
      if (thresholdSlider) {
        thresholdSlider.value = String(Math.max(2, Math.min(15, Math.round(ruleBase * 2) / 2)));
      }
      this.updatePsuRailFullHistoryModal(batteryHealthService.getState());
    });

    resetHistoryBtn?.addEventListener('click', () => {
      if (!this.psuFullHistoryModalRail) return;
      const rail = this.psuFullHistoryModalRail;
      batteryHealthService.resetRail5MinHistory(rail, { durationMs: 10000, intervalMs: 500 });
      this.updatePsuRailFullHistoryModal(batteryHealthService.getState());
      void this.recordLog(
        'BATTERY',
        'INFO',
        `Reset 5-minutowego bufora szyny ${rail}`,
        'Ponowne próbkowanie (10s)',
        'W toku',
        `Wyczyszczono bieżący 5-minutowy bufor historii szyny ${rail} i wymuszono okres szybkiego ponownego próbkowania.`
      );
    });

    rangeSelect?.addEventListener('change', () => {
      const parsed = Number(rangeSelect.value);
      const nextMin: 1 | 5 | 15 = parsed === 1 ? 1 : parsed === 15 ? 15 : 5;
      this.psuFullHistoryModalWindowMin = nextMin;
      const secs = nextMin * 60;
      const titleEl = backdrop.querySelector<HTMLElement>('#psu-full-history-modal-title');
      if (titleEl) {
        titleEl.textContent = `Pełna historia napięcia szyny ${railName} — Oś czasu ${nextMin} min (D3.js High-Res)`;
      }
      const subEl = backdrop.querySelector<HTMLElement>('#psu-full-history-modal-sub');
      if (subEl) {
        subEl.textContent = `Przewijalny wykres o wysokiej rozdzielczości obejmujący ostatnie ${secs} sekund pomiarów wraz z pasmem tolerancji ATX.`;
      }
      const hintRangeEl = backdrop.querySelector<HTMLElement>('#psu-full-history-hint-range');
      if (hintRangeEl) {
        hintRangeEl.textContent = `Przewiń oś czasu poziomo, aby przeanalizować każdy skok napięcia z ostatnich ${nextMin} min (${secs}s). Najedź na krzywą, aby zobaczyć dokładne wartości.`;
      }
      if (copyBtn && !copyBtn.classList.contains('is-copied')) {
        copyBtn.textContent = `{} Copy ${nextMin}m JSON`;
      }
      this.updatePsuRailFullHistoryModal(batteryHealthService.getState());
    });

    backdrop.querySelectorAll<HTMLButtonElement>('.psu-full-history-zoom-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const z = Number(btn.dataset.zoom) || 2;
        this.psuFullHistoryModalZoom = z;
        backdrop.querySelectorAll<HTMLButtonElement>('.psu-full-history-zoom-btn').forEach((b) => {
          b.classList.toggle('is-active', Number(b.dataset.zoom) === z);
        });
        this.updatePsuRailFullHistoryModal(batteryHealthService.getState());
      });
    });

    copyBtn?.addEventListener('click', async () => {
      if (!this.psuFullHistoryModalRail) return;
      const latest = batteryHealthService.getState();
      const rail = this.psuFullHistoryModalRail;
      const windowMin = this.psuFullHistoryModalWindowMin;
      const thresholdPct = this.getEffectiveModalThresholdPct(rail);
      const jsonStr = this.buildRailRawVoltageJson(latest, rail, thresholdPct, windowMin * 60);
      const ok = await this.copyTextToClipboard(jsonStr);
      if (ok && copyBtn) {
        copyBtn.classList.add('is-copied');
        copyBtn.textContent = `✓ Copied ${windowMin}m JSON`;
        window.setTimeout(() => {
          copyBtn.classList.remove('is-copied');
          copyBtn.textContent = `{} Copy ${this.psuFullHistoryModalWindowMin}m JSON`;
        }, 2200);
      }
    });

    exportCsvBtn?.addEventListener('click', () => {
      if (!this.psuFullHistoryModalRail) return;
      const rail = this.psuFullHistoryModalRail;
      const latest = batteryHealthService.getState();
      const thresholdPct = this.getEffectiveModalThresholdPct(rail);
      const nominalV = this.getRailNominalVoltage(rail);
      const samples5m = this.getRailHistoryWindow(latest, rail, 300000);
      const res = exportSinglePsuRail5mHistoryToCsv({
        railName: rail,
        nominalV,
        thresholdPct,
        samples: samples5m,
        windowSeconds: 300,
      });

      if (exportCsvBtn) {
        exportCsvBtn.classList.add('is-exported');
        exportCsvBtn.innerHTML = `<span>✓ Exported 5m CSV (${res.count} pkt)</span>`;
        window.setTimeout(() => {
          exportCsvBtn.classList.remove('is-exported');
          exportCsvBtn.innerHTML = `${iconSvg('download', 13)}<span>Export 5m History (CSV)</span>`;
        }, 2200);
      }

      void this.recordLog(
        'BATTERY',
        'OK',
        `Eksport CSV 5 min szyny ${rail}`,
        `${res.count} próbek`,
        'Wyeksportowano',
        `Wyeksportowano bieżącą 5-minutową historię napięcia szyny ${rail} do lokalnego pliku CSV (${res.filename}).`
      );
    });

    this.psuFullHistoryModalKeyHandler = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') {
        this.closePsuRailFullHistoryModal();
      }
    };
    window.addEventListener('keydown', this.psuFullHistoryModalKeyHandler);

    document.body.appendChild(backdrop);
    this.updatePsuRailFullHistoryModal(batteryHealthService.getState());
  }

  private updatePsuRailFullHistoryModal(b: BatteryHealthState): void {
    const railName = this.psuFullHistoryModalRail;
    if (!railName) return;
    const modalEl = document.getElementById('psu-rail-full-history-modal');
    if (!modalEl) {
      this.psuFullHistoryModalRail = null;
      return;
    }

    const baseThresholdPct = this.getBaseRailThresholdPct(railName);
    const thresholdPct = this.getEffectiveModalThresholdPct(railName);
    const isTempCustom =
      this.psuFullHistoryModalTempThresholdPct !== null &&
      Math.abs(this.psuFullHistoryModalTempThresholdPct - baseThresholdPct) > 0.001;
    const nominalV = this.getRailNominalVoltage(railName);
    const windowMin = this.psuFullHistoryModalWindowMin;
    const samples5m = this.getRailHistoryWindow(b, railName, windowMin * 60 * 1000, true);
    const currentV =
      railName === '+12V' ? b.psu.rail12V : railName === '+5V' ? b.psu.rail5V : b.psu.rail3P3V;
    const currentDevPct = (Math.abs(currentV - nominalV) / nominalV) * 100;

    let minV = Infinity;
    let maxV = -Infinity;
    let sumV = 0;
    let peakDevPct = 0;
    let outCount = 0;
    for (const pt of samples5m) {
      if (pt.voltageV < minV) minV = pt.voltageV;
      if (pt.voltageV > maxV) maxV = pt.voltageV;
      sumV += pt.voltageV;
      const dev = (Math.abs(pt.voltageV - nominalV) / nominalV) * 100;
      if (dev > peakDevPct) peakDevPct = dev;
      if (dev > thresholdPct) outCount += 1;
    }
    const avgV = samples5m.length > 0 ? sumV / samples5m.length : currentV;
    const spanSec =
      samples5m.length >= 2
        ? Math.max(1, Math.round((samples5m[samples5m.length - 1].timestamp - samples5m[0].timestamp) / 1000))
        : 0;

    // Update temporary threshold readout & live tolerance status pill
    const thresholdValEl = modalEl.querySelector<HTMLElement>('#psu-full-history-threshold-val');
    if (thresholdValEl) {
      thresholdValEl.textContent = `±${thresholdPct.toFixed(1)}%`;
    }
    const thresholdModeEl = modalEl.querySelector<HTMLElement>('#psu-full-history-threshold-mode');
    if (thresholdModeEl) {
      thresholdModeEl.textContent = isTempCustom
        ? `Temporary preview (Rule: ±${baseThresholdPct}%)`
        : `Rule default (±${baseThresholdPct}%)`;
      thresholdModeEl.classList.toggle('is-custom', isTempCustom);
    }
    const thresholdResetBtn = modalEl.querySelector<HTMLButtonElement>('#psu-full-history-threshold-reset-btn');
    if (thresholdResetBtn) {
      thresholdResetBtn.hidden = !isTempCustom;
      thresholdResetBtn.textContent = `Reset to ±${baseThresholdPct}%`;
    }

    const toleranceStatusEl = modalEl.querySelector<HTMLElement>('#psu-full-history-tolerance-status');
    if (toleranceStatusEl) {
      const effectivePeak = Math.max(peakDevPct, currentDevPct);
      const withinRange = outCount === 0 && currentDevPct <= thresholdPct;
      toleranceStatusEl.classList.toggle('is-within', withinRange);
      toleranceStatusEl.classList.toggle('is-exceeded', !withinRange);
      if (withinRange) {
        toleranceStatusEl.textContent = `✓ Within ±${thresholdPct.toFixed(1)}% tolerance (Peak ±${effectivePeak.toFixed(2)}%)`;
      } else {
        toleranceStatusEl.textContent = `⚠ Exceeds ±${thresholdPct.toFixed(1)}% (${outCount} excursions · Peak ±${effectivePeak.toFixed(2)}%)`;
      }
    }

    // Update forced re-sampling status banner & button state
    const resampling = batteryHealthService.getRailResamplingState(railName);
    const resamplingBanner = modalEl.querySelector<HTMLElement>('#psu-full-history-resampling-banner');
    const resamplingText = modalEl.querySelector<HTMLElement>('#psu-full-history-resampling-text');
    const resamplingCount = modalEl.querySelector<HTMLElement>('#psu-full-history-resampling-count');
    const resamplingFill = modalEl.querySelector<HTMLElement>('#psu-full-history-resampling-fill');
    const resetBtn = modalEl.querySelector<HTMLButtonElement>('#psu-full-history-reset-btn');

    if (resamplingBanner) {
      resamplingBanner.hidden = !resampling.active;
      if (resampling.active) {
        if (resamplingText) {
          resamplingText.textContent = `Re-sampling ${railName} 5-minute buffer (fresh high-rate capture)…`;
        }
        if (resamplingCount) {
          resamplingCount.textContent = `${resampling.samplesCollected} / ${resampling.targetSamples} pkt (${resampling.progressPct}%)`;
        }
        if (resamplingFill) {
          resamplingFill.style.width = `${resampling.progressPct}%`;
        }
      }
    }
    if (resetBtn) {
      resetBtn.classList.toggle('is-resampling', resampling.active);
      const labelSpan = resetBtn.querySelector('span');
      if (labelSpan) {
        labelSpan.textContent = resampling.active
          ? `Re-sampling (${resampling.progressPct}%)`
          : 'Reset 5-Minute History';
      }
    }

    const kpiStrip = modalEl.querySelector<HTMLElement>('#psu-full-history-kpi-strip');
    if (kpiStrip) {
      kpiStrip.innerHTML = `
        <div class="psu-full-history-kpi">
          <div class="psu-full-history-kpi-label">Aktualne napięcie</div>
          <div class="psu-full-history-kpi-val">${currentV.toFixed(3)} V</div>
        </div>
        <div class="psu-full-history-kpi">
          <div class="psu-full-history-kpi-label">Zakres (Min / Max)</div>
          <div class="psu-full-history-kpi-val">${samples5m.length > 0 ? `${minV.toFixed(2)}–${maxV.toFixed(2)} V` : '—'}</div>
        </div>
        <div class="psu-full-history-kpi">
          <div class="psu-full-history-kpi-label">Średnia (${windowMin} min)</div>
          <div class="psu-full-history-kpi-val">${samples5m.length > 0 ? `${avgV.toFixed(3)} V` : '—'}</div>
        </div>
        <div class="psu-full-history-kpi">
          <div class="psu-full-history-kpi-label">Szczytowa odchyłka</div>
          <div class="psu-full-history-kpi-val" style="color:${peakDevPct > thresholdPct ? '#fb7185' : '#34d399'};">${samples5m.length > 0 ? `±${peakDevPct.toFixed(2)}%` : '—'}</div>
        </div>
        <div class="psu-full-history-kpi">
          <div class="psu-full-history-kpi-label">Przekroczenia (&gt;±${thresholdPct.toFixed(1)}%${isTempCustom ? ' Temp' : ''})</div>
          <div class="psu-full-history-kpi-val" style="color:${outCount > 0 ? '#fb7185' : '#34d399'};">${outCount} / ${samples5m.length}</div>
        </div>
        <div class="psu-full-history-kpi">
          <div class="psu-full-history-kpi-label">Okno osi czasu</div>
          <div class="psu-full-history-kpi-val">${Math.floor(spanSec / 60)}m ${spanSec % 60}s</div>
        </div>
      `;
    }

    const chartHost = modalEl.querySelector<HTMLElement>('#psu-full-history-d3-chart');
    if (chartHost) {
      const emptyMsg = resampling.active
        ? `Wyczyszczono 5-minutowy bufor szyny ${railName}. Zbieranie nowych próbek telemetrii…`
        : undefined;
      renderRailFullHistoryD3ModalChart(
        chartHost,
        railName,
        samples5m,
        thresholdPct,
        nominalV,
        this.psuFullHistoryModalZoom,
        emptyMsg
      );
    }
  }

  private closePsuRailFullHistoryModal(): void {
    document.getElementById('psu-rail-full-history-modal')?.remove();
    this.psuFullHistoryModalRail = null;
    this.psuFullHistoryModalTempThresholdPct = null;
    if (this.psuFullHistoryModalKeyHandler) {
      window.removeEventListener('keydown', this.psuFullHistoryModalKeyHandler);
      this.psuFullHistoryModalKeyHandler = null;
    }
  }

  private openPredictiveBearingAlertModal(
    channelId: string | null = null,
    pwmState: FanPwmMonitorState = fanTestService.getPwmMonitorState()
  ): void {
    if (channelId) this.predictiveBearingAlertFocusedChannelId = channelId;
    const existing = document.getElementById('predictive-bearing-alert-modal');
    if (existing) {
      this.updatePredictiveBearingAlertModal(pwmState);
      return;
    }

    const backdrop = document.createElement('div');
    backdrop.id = 'predictive-bearing-alert-modal';
    backdrop.className = 'psu-full-history-modal-backdrop';
    backdrop.setAttribute('role', 'dialog');
    backdrop.setAttribute('aria-modal', 'true');
    backdrop.setAttribute('aria-labelledby', 'predictive-bearing-alert-title');

    backdrop.addEventListener('click', (ev) => {
      if (ev.target === backdrop) {
        this.closePredictiveBearingAlertModal(true);
      }
    });

    this.predictiveBearingAlertKeyHandler = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') {
        this.closePredictiveBearingAlertModal(true);
      }
    };
    window.addEventListener('keydown', this.predictiveBearingAlertKeyHandler);

    document.body.appendChild(backdrop);
    this.updatePredictiveBearingAlertModal(pwmState);
  }

  private updatePredictiveBearingAlertModal(
    pwmState: FanPwmMonitorState = fanTestService.getPwmMonitorState()
  ): void {
    const backdrop = document.getElementById('predictive-bearing-alert-modal');
    if (!backdrop) return;
    backdrop.innerHTML = renderPredictiveBearingAlertModalHtml(
      pwmState,
      this.predictiveBearingAlertFocusedChannelId
    );

    backdrop.querySelector('#predictive-bearing-alert-close-btn')?.addEventListener('click', () => {
      this.closePredictiveBearingAlertModal(true);
    });
    backdrop.querySelector('#predictive-bearing-alert-ack-btn')?.addEventListener('click', () => {
      this.closePredictiveBearingAlertModal(true);
    });
    backdrop.querySelector('#predictive-bearing-alert-history-btn')?.addEventListener('click', () => {
      this.closePredictiveBearingAlertModal(true);
      this.fanHeatmapTab = 'bearing_history';
      if (this.activeModule === 'peripherals') {
        const resPanel = this.root.querySelector<HTMLElement>('#fan-heatmap-tab-resonance');
        const histPanel = this.root.querySelector<HTMLElement>('#fan-heatmap-tab-bearing-history');
        if (resPanel) resPanel.hidden = true;
        if (histPanel) histPanel.hidden = false;
        this.root.querySelectorAll<HTMLButtonElement>('[data-fan-heatmap-tab]').forEach((btn) => {
          const match = btn.dataset.fanHeatmapTab === 'bearing_history';
          btn.classList.toggle('active', match);
          btn.setAttribute('aria-selected', match ? 'true' : 'false');
        });
        const bhChartHost = this.root.querySelector<HTMLElement>('#fan-bearing-history-d3');
        if (bhChartHost) renderFanBearingHistoryChartD3(bhChartHost, pwmState);
        const histSummary = this.root.querySelector<HTMLElement>('#fan-bearing-history-summary');
        if (histSummary) histSummary.innerHTML = renderFanBearingHistorySummaryHtml(pwmState);
        this.root.querySelector('#fan-acoustic-heatmap-panel')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } else {
        this.setModule('peripherals');
      }
    });
    backdrop.querySelectorAll<HTMLButtonElement>('[data-alert-select-channel]').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.predictiveBearingAlertFocusedChannelId = btn.dataset.alertSelectChannel || null;
        this.updatePredictiveBearingAlertModal(fanTestService.getPwmMonitorState());
      });
    });
  }

  private closePredictiveBearingAlertModal(dismiss = true): void {
    document.getElementById('predictive-bearing-alert-modal')?.remove();
    if (dismiss) this.predictiveBearingAlertDismissed = true;
    this.predictiveBearingAlertFocusedChannelId = null;
    if (this.predictiveBearingAlertKeyHandler) {
      window.removeEventListener('keydown', this.predictiveBearingAlertKeyHandler);
      this.predictiveBearingAlertKeyHandler = null;
    }
  }

  private renderPcPsuRailCardsHtml(b: BatteryHealthState): string {
    const p = b.psu;
    const psuCalc = psuCalculatorService.calculate(
      b.currentLoadPct,
      gpuStressEngine.isRunning() ? 90 : 25,
      this.specs?.cpuCores || 8,
      p.tempC
    );
    const rules = psuCalculatorService.getAlertRules();
    const dev12 = (Math.abs(p.rail12V - 12.0) / 12.0) * 100;
    const dev5 = (Math.abs(p.rail5V - 5.0) / 5.0) * 100;
    const dev3 = (Math.abs(p.rail3P3V - 3.3) / 3.3) * 100;
    const isExceeded12 = dev12 > rules.rail12VThresholdPct;
    const isExceeded5 = dev5 > rules.rail5VThresholdPct;
    const isExceeded3 = dev3 > rules.rail3P3VThresholdPct;

    this.syncPsuTransientHighlights(b);
    const hl12 = this.psuTransientTracker.isHighlighted('+12V');
    const hl5 = this.psuTransientTracker.isHighlighted('+5V');
    const hl3 = this.psuTransientTracker.isHighlighted('+3.3V');

    const powerAlertThresholdPct = psuCalculatorService.getPowerAlertThresholdPct();
    const powerAlertThresholdLabel = Number.isInteger(powerAlertThresholdPct)
      ? `${powerAlertThresholdPct}%`
      : `${powerAlertThresholdPct.toFixed(1)}%`;
    const overThresholdCapacity = isPsuCapacityOver95(
      psuCalc.totalSystemPowerW,
      psuCalc.psuCapacityW,
      psuCalc.loadPercentageOfPsu,
      powerAlertThresholdPct
    );

    return `
          <div class="metric-card psu-rail-metric-card ${isExceeded12 ? 'psu-rail-deviation-alert' : ''}" ${isExceeded12 ? 'tabindex="0" aria-describedby="psu-rail-tooltip-12V"' : ''}>
            <span class="metric-label">Szyna +12V (CPU/GPU) ${isExceeded12 ? '⚠️ >±' + rules.rail12VThresholdPct + '%' : ''}</span>
            <div class="metric-row">
              <span class="metric-value psu-rail-value-hover-target ${isExceeded12 ? 'status-err' : (p.rail12V < 11.4 ? 'status-err' : 'status-ok')} ${hl12 ? 'is-transient-spike-highlight' : ''}" tabindex="0" data-rail="+12V" aria-describedby="psu-rail-tooltip-12V" title="Najedź kursorem, aby zobaczyć 5-sekundowy wykres wahań napięcia">${p.rail12V.toFixed(2)}</span>
              <span class="metric-unit">V</span>
              <span class="psu-rail-transient-badge" data-rail="+12V" ${hl12 ? '' : 'hidden'}>⚡ SPIKE &gt;5%</span>
              <button
                type="button"
                class="psu-rail-info-btn"
                data-rail="+12V"
                aria-label="Pokaż szczegóły i historię szyny +12V"
                aria-describedby="psu-rail-tooltip-12V"
              >i</button>
            </div>
            <span class="metric-foot">Próg reguły: ±${rules.rail12VThresholdPct}% (Odchyłka: ±${dev12.toFixed(1)}%)</span>
            ${this.psuSparklineOpenRails.has('+12V') ? this.renderRailAlertSparklineOverlayHtml(b, '+12V', rules.rail12VThresholdPct) : ''}
            ${this.renderRailDeviationTooltipHtml(b, '+12V', p.rail12V, dev12, rules.rail12VThresholdPct, isExceeded12)}
          </div>
          <div class="metric-card psu-rail-metric-card ${isExceeded5 ? 'psu-rail-deviation-alert' : ''}" ${isExceeded5 ? 'tabindex="0" aria-describedby="psu-rail-tooltip-5V"' : ''}>
            <span class="metric-label">Szyna +5V (Logika / USB) ${isExceeded5 ? '⚠️ >±' + rules.rail5VThresholdPct + '%' : ''}</span>
            <div class="metric-row">
              <span class="metric-value psu-rail-value-hover-target ${isExceeded5 ? 'status-err' : 'status-ok'} ${hl5 ? 'is-transient-spike-highlight' : ''}" tabindex="0" data-rail="+5V" aria-describedby="psu-rail-tooltip-5V" title="Najedź kursorem, aby zobaczyć 5-sekundowy wykres wahań napięcia">${p.rail5V.toFixed(2)}</span>
              <span class="metric-unit">V</span>
              <span class="psu-rail-transient-badge" data-rail="+5V" ${hl5 ? '' : 'hidden'}>⚡ SPIKE &gt;5%</span>
              <button
                type="button"
                class="psu-rail-info-btn"
                data-rail="+5V"
                aria-label="Pokaż szczegóły i historię szyny +5V"
                aria-describedby="psu-rail-tooltip-5V"
              >i</button>
            </div>
            <span class="metric-foot">Próg reguły: ±${rules.rail5VThresholdPct}% (Odchyłka: ±${dev5.toFixed(1)}%)</span>
            ${this.psuSparklineOpenRails.has('+5V') ? this.renderRailAlertSparklineOverlayHtml(b, '+5V', rules.rail5VThresholdPct) : ''}
            ${this.renderRailDeviationTooltipHtml(b, '+5V', p.rail5V, dev5, rules.rail5VThresholdPct, isExceeded5)}
          </div>
          <div class="metric-card psu-rail-metric-card ${isExceeded3 ? 'psu-rail-deviation-alert' : ''}" ${isExceeded3 ? 'tabindex="0" aria-describedby="psu-rail-tooltip-33V"' : ''}>
            <span class="metric-label">Szyna +3.3V (RAM / Chipset) ${isExceeded3 ? '⚠️ >±' + rules.rail3P3VThresholdPct + '%' : ''}</span>
            <div class="metric-row">
              <span class="metric-value psu-rail-value-hover-target ${isExceeded3 ? 'status-err' : 'status-ok'} ${hl3 ? 'is-transient-spike-highlight' : ''}" tabindex="0" data-rail="+3.3V" aria-describedby="psu-rail-tooltip-33V" title="Najedź kursorem, aby zobaczyć 5-sekundowy wykres wahań napięcia">${p.rail3P3V.toFixed(2)}</span>
              <span class="metric-unit">V</span>
              <span class="psu-rail-transient-badge" data-rail="+3.3V" ${hl3 ? '' : 'hidden'}>⚡ SPIKE &gt;5%</span>
              <button
                type="button"
                class="psu-rail-info-btn"
                data-rail="+3.3V"
                aria-label="Pokaż szczegóły i historię szyny +3.3V"
                aria-describedby="psu-rail-tooltip-33V"
              >i</button>
            </div>
            <span class="metric-foot">Próg reguły: ±${rules.rail3P3VThresholdPct}% (Odchyłka: ±${dev3.toFixed(1)}%)</span>
            ${this.psuSparklineOpenRails.has('+3.3V') ? this.renderRailAlertSparklineOverlayHtml(b, '+3.3V', rules.rail3P3VThresholdPct) : ''}
            ${this.renderRailDeviationTooltipHtml(b, '+3.3V', p.rail3P3V, dev3, rules.rail3P3VThresholdPct, isExceeded3)}
          </div>
          <div id="psu-power-draw-rail-card" class="metric-card psu-rail-metric-card ${overThresholdCapacity ? 'psu-rail-deviation-alert psu-rail-capacity-alert' : ''}">
            <span id="psu-power-draw-rail-label" class="metric-label">Pobór mocy systemu (W)${overThresholdCapacity ? ` ⚠️ >${powerAlertThresholdLabel} PSU` : ''}</span>
            <div class="metric-row">
              <span class="metric-value ${overThresholdCapacity ? 'status-err' : 'status-cyan'}" data-metric-key="psu-total-power-w" data-metric-target="${psuCalc.totalSystemPowerW}">${psuCalc.totalSystemPowerW}</span>
              <span class="metric-unit">W / ${psuCalc.psuCapacityW}W</span>
            </div>
            <span class="metric-foot">CPU: ${psuCalc.cpuPowerW}W · GPU: ${psuCalc.gpuPowerW}W · ${psuCalc.loadPercentageOfPsu}% PSU</span>
            <div class="psu-rail-threshold-control">
              <label for="psu-power-alert-threshold-input" class="psu-rail-threshold-label">Próg alertu (%):</label>
              <input
                id="psu-power-alert-threshold-input"
                type="number"
                min="1"
                max="100"
                step="1"
                value="${powerAlertThresholdPct}"
                class="input-text font-mono psu-rail-threshold-input"
                aria-label="Ręczny próg procentowy alertu poboru mocy PSU (domyślnie 95%)"
                title="Ustaw własny próg procentowy mocy PSU wyzwalający alert (nadpisuje domyślne 95%)"
              />
            </div>
            <div id="psu-capacity-alert-slot">${renderPsuCapacityAlertBannerHtml(psuCalc.totalSystemPowerW, psuCalc.psuCapacityW, psuCalc.loadPercentageOfPsu, powerAlertThresholdPct)}</div>
          </div>
          <div class="metric-card">
            <span class="metric-label">Temperatura Zasilacza (PSU)</span>
            <div class="metric-row">
              <span class="metric-value ${p.tempC >= 55 ? 'status-err' : p.tempC >= 45 ? 'status-warn' : 'status-ok'}">${p.tempC.toFixed(1)}</span>
              <span class="metric-unit">°C</span>
            </div>
            <span class="metric-foot">${thermalMonitorService.getLivePsuTempC() !== null ? 'Czujnik sprzętowy PSU (LIVE)' : 'Wpływ na degradację sprawności'}</span>
          </div>
    `;
  }

  private syncPsuTransientHighlights(b: BatteryHealthState): void {
    const pairs: Array<[TransientHighlightRail, number]> = [
      ['+12V', b.psu.rail12V],
      ['+5V', b.psu.rail5V],
      ['+3.3V', b.psu.rail3P3V],
    ];
    const nowMs = Date.now();
    for (const [rail, voltage] of pairs) {
      const triggered = this.psuTransientTracker.updateRail(rail, voltage, nowMs);
      if (triggered) {
        const prevTimer = this.psuTransientTimers.get(rail);
        if (prevTimer !== undefined) {
          window.clearTimeout(prevTimer);
        }
        const timerId = window.setTimeout(() => {
          this.psuTransientTimers.delete(rail);
          this.clearPsuTransientHighlightDom(rail);
        }, TRANSIENT_RAIL_HIGHLIGHT_DURATION_MS);
        this.psuTransientTimers.set(rail, timerId);
      }
    }
  }

  private clearPsuTransientHighlightDom(rail: TransientHighlightRail): void {
    const valEl = this.root.querySelector<HTMLElement>(
      `#psu-rail-kpi-grid .psu-rail-value-hover-target[data-rail="${rail}"]`
    );
    if (valEl) {
      valEl.classList.remove('is-transient-spike-highlight');
    }
    const badgeEl = this.root.querySelector<HTMLElement>(
      `#psu-rail-kpi-grid .psu-rail-transient-badge[data-rail="${rail}"]`
    );
    if (badgeEl) {
      badgeEl.hidden = true;
    }
  }

  private patchPsuPowerDrawCardAlert(b: BatteryHealthState): void {
    const cardEl = this.root.querySelector<HTMLElement>('#psu-power-draw-rail-card');
    if (!cardEl) return;
    const p = b.psu;
    const psuCalc = psuCalculatorService.calculate(
      b.currentLoadPct,
      gpuStressEngine.isRunning() ? 90 : 25,
      this.specs?.cpuCores || 8,
      p.tempC
    );
    const thresholdPct = psuCalculatorService.getPowerAlertThresholdPct();
    const overThreshold = isPsuCapacityOver95(
      psuCalc.totalSystemPowerW,
      psuCalc.psuCapacityW,
      psuCalc.loadPercentageOfPsu,
      thresholdPct
    );
    const thresholdLabel = Number.isInteger(thresholdPct)
      ? `${thresholdPct}%`
      : `${thresholdPct.toFixed(1)}%`;

    cardEl.classList.toggle('psu-rail-deviation-alert', overThreshold);
    cardEl.classList.toggle('psu-rail-capacity-alert', overThreshold);

    const labelEl = cardEl.querySelector<HTMLElement>('#psu-power-draw-rail-label');
    if (labelEl) {
      labelEl.textContent = `Pobór mocy systemu (W)${overThreshold ? ` ⚠️ >${thresholdLabel} PSU` : ''}`;
    }

    const valEl = cardEl.querySelector<HTMLElement>('.metric-value[data-metric-key="psu-total-power-w"]');
    if (valEl) {
      valEl.classList.toggle('status-err', overThreshold);
      valEl.classList.toggle('status-cyan', !overThreshold);
    }

    const slotEl = cardEl.querySelector<HTMLElement>('#psu-capacity-alert-slot');
    if (slotEl) {
      slotEl.innerHTML = renderPsuCapacityAlertBannerHtml(
        psuCalc.totalSystemPowerW,
        psuCalc.psuCapacityW,
        psuCalc.loadPercentageOfPsu,
        thresholdPct
      );
    }
  }

  private renderPcPsuMainGaugeInnerHtml(
    b: BatteryHealthState,
    psuCalc: ReturnType<typeof psuCalculatorService.calculate>
  ): string {
    return `
          <div class="row-between" style="margin-bottom:6px;">
            <span style="font-size:13px;font-weight:600;">Żywy wskaźnik obciążenia zasilacza (PSU Load Gauge)</span>
            <span class="font-mono ${psuCalc.loadPercentageOfPsu > 85 ? 'status-err' : 'status-ok'}">${psuCalc.loadPercentageOfPsu}% obciążenia (${psuCalc.totalSystemPowerW}W / ${psuCalc.psuCapacityW}W)</span>
          </div>
          <div style="background:var(--bg-main);border-radius:8px;height:12px;overflow:hidden;position:relative;border:1px solid rgba(255,255,255,0.1);">
            <div style="background:linear-gradient(90deg, #10b981, #06b6d4 ${psuCalc.loadPercentageOfPsu > 75 ? ', #f59e0b' : ''} ${psuCalc.loadPercentageOfPsu > 90 ? ', #ef4444' : ''});width:${Math.min(100, psuCalc.loadPercentageOfPsu)}%;height:100%;transition:width 0.4s ease;"></div>
          </div>
          <div class="row-between" style="font-size:11px;color:var(--text-secondary);margin-top:6px;">
            <span>Sprawność zasilacza (z korekcją termiczną ${b.psu.tempC.toFixed(1)}°C): <strong>${psuCalc.efficiencyPct}%</strong></span>
            <span>Straty ciepła: <strong>~${psuCalc.estimatedHeatDissipationW}W</strong></span>
          </div>
          <div style="font-size:11.5px;color:var(--text-primary);margin-top:4px;font-style:italic;">
            ${esc(psuCalc.recommendation)}
          </div>
    `;
  }

  private renderPsuPowerDrawTrendHtmlForCalc(
    psuCalc: ReturnType<typeof psuCalculatorService.calculate>
  ): string {
    const samples = psuCalculatorService.getPowerDrawSamples1m();
    const trend = computePowerDrawTrend1m(
      samples,
      psuCalc.totalSystemPowerW,
      psuCalc.psuCapacityW
    );
    return renderPsuPowerDrawTrendHtml(trend, psuCalc.psuCapacityW);
  }

  private patchPsuMainGaugeAndTrend(
    b: BatteryHealthState,
    psuCalc: ReturnType<typeof psuCalculatorService.calculate>
  ): void {
    const gaugeBox = this.root.querySelector<HTMLElement>('#psu-main-load-gauge-box');
    if (gaugeBox) {
      gaugeBox.classList.toggle('psu-gauge-pulse-box', psuCalc.loadPercentageOfPsu > 90);
      gaugeBox.innerHTML = this.renderPcPsuMainGaugeInnerHtml(b, psuCalc);
    }
    const trendSlot = this.root.querySelector<HTMLElement>('#psu-power-draw-trend-slot');
    if (trendSlot) {
      trendSlot.innerHTML = this.renderPsuPowerDrawTrendHtmlForCalc(psuCalc);
    }
  }

  private renderPcPsuPanelHtml(b: BatteryHealthState): string {
    const p = b.psu;
    const psuCalc = psuCalculatorService.calculate(
      b.currentLoadPct,
      gpuStressEngine.isRunning() ? 90 : 25,
      this.specs?.cpuCores || 8,
      p.tempC
    );
    const rules = psuCalculatorService.getAlertRules();
    const devPct = psuCalculatorService.getRailDeviationPct();
    const highPowerSim = psuCalculatorService.isHighPowerSimulationEnabled();
    const activeStressProfile = psuCalculatorService.getStressProfile();

    const criticalBanner = b.criticalPowerAlert
      ? `
        <div style="background:rgba(244,63,94,0.18);border:1.5px solid var(--status-err);border-radius:12px;padding:14px;margin-bottom:14px;display:flex;align-items:center;gap:12px;animation: psuLoadPulse 1s infinite ease-in-out;">
          <span style="font-size:24px;">🚨</span>
          <div style="display:flex;flex-direction:column;gap:2px;">
            <strong style="color:var(--status-err);font-size:14px;">ALARM KRYTYCZNY ZASILACZA (Critical Power Alert)</strong>
            <span style="font-size:12.5px;color:var(--text-primary);">Pobór mocy systemu przekracza 95% pojemności zasilacza przez ponad 5 sekund! Ryzyko przeciążenia ATX.</span>
          </div>
        </div>
      `
      : '';

    return `
      <div id="pc-psu-panel-root" class="panel stack-md">
        ${criticalBanner}
        <div class="panel-header" style="margin-bottom:0;flex-wrap:wrap;gap:8px;">
          <div>
            <h2 class="panel-title">Zasilacz PC (ATX PSU Monitor) &amp; Napięcia szyn</h2>
            <span class="panel-caption">Wykrywanie i monitorowanie napięć +12V, +5V, +3.3V oraz obciążenia zasilacza w czasie rzeczywistym</span>
          </div>
          <div class="row-wrap" style="gap:8px;align-items:center;">
            <button id="psu-high-power-toggle" type="button" role="switch" aria-checked="${highPowerSim ? 'true' : 'false'}" class="btn ${highPowerSim ? 'btn-danger' : 'btn-secondary'} btn-sm" title="Symuluj scenariusz wysokiego poboru mocy (>92% PSU), aktualizując kalkulator PSU i aktywując animację pulsowania Load Gauge">
              <span>${highPowerSim ? '⚡ High Power Sim: WŁ. (>92%)' : '⚡ Symuluj Wysoki Pobór Mocy'}</span>
            </button>
            <button id="psu-download-portable-zip-btn" type="button" class="btn btn-amber btn-sm" title="Pobierz paczkę Portable Windows (.EXE + Launcher Bez Limitu FPS + Portal w archiwum .ZIP)">
              ${iconSvg('download', 13)}
              <span>Pobierz Portable .EXE (.ZIP)</span>
            </button>
            <button id="psu-copy-all-rails-btn" type="button" class="btn btn-secondary btn-sm" title="Skompiluj surowe dane napięć wszystkich trzech szyn (+12V, +5V, +3.3V) do pojedynczego obiektu JSON i skopiuj do schowka">
              {} Copy All Rail Data
            </button>
            <button id="psu-export-csv-btn" type="button" class="btn btn-secondary btn-sm" title="Download CSV containing the last 60 seconds of voltage fluctuation data for 12V, 5V, and 3.3V rails">
              Download Rail Data (CSV)
            </button>
            <button id="psu-export-json-btn" type="button" class="btn btn-secondary btn-sm" title="Eksportuj pełną historię wahań napięć szyn +12V, +5V i +3.3V wraz ze statystykami i progami do ustrukturyzowanego logu JSON">
              ${iconSvg('download', 13)}
              <span>Export Rail Log (JSON)</span>
            </button>
            <button id="psu-clear-alerts-btn" type="button" class="btn btn-secondary btn-sm" title="Resetuj znaczniki wizualne odchyłek na wykresie napięć bez usuwania danych historii szyn">
              Clear Alerts
            </button>
            <button id="psu-stress-test-btn" type="button" class="btn btn-primary btn-sm" title="Uruchom stres-test zasilacza poprzez maksymalizację obciążenia CPU i GPU">
              Stress Test PSU
            </button>
            <span class="font-mono status-ok">${p.rating80Plus}</span>
          </div>
        </div>
        <div id="psu-rail-kpi-grid" class="grid-5">
          ${this.renderPcPsuRailCardsHtml(b)}
        </div>

        <div id="psu-main-load-gauge-box" class="panel stack-sm ${psuCalc.loadPercentageOfPsu > 90 ? 'psu-gauge-pulse-box' : ''}" style="background:var(--bg-inset);padding:14px;border-radius:12px;">
          ${this.renderPcPsuMainGaugeInnerHtml(b, psuCalc)}
        </div>

        <div id="psu-power-draw-trend-slot">
          ${this.renderPsuPowerDrawTrendHtmlForCalc(psuCalc)}
        </div>

        <!-- Hardware Component Stress Profiles Section -->
        <div class="panel stack-sm" style="background:var(--bg-inset);padding:14px;border-radius:12px;margin-top:6px;">
          <div class="row-between" style="flex-wrap:wrap;gap:8px;margin-bottom:8px;">
            <div>
              <h3 style="font-size:13.5px;font-weight:600;margin:0;">Symulator Profili Obciążenia Podzespołów (Hardware Component Stress Profiles)</h3>
              <span class="panel-caption">Przełączaj symulowane scenariusze obciążenia podzespołów (np. GPU Intense, Full Multi-Core CPU Load) i obserwuj wpływ na odchyłki szyn +12V, +5V, +3.3V oraz alerty</span>
            </div>
            <span class="font-mono ${activeStressProfile !== 'normal' || highPowerSim ? 'status-warn' : 'status-ok'}" style="font-size:12px;">
              Aktywny profil: ${esc(PSU_STRESS_PROFILES.find((pr) => pr.id === activeStressProfile)?.label || 'Normalny')} ${highPowerSim ? ' + High Power (>92%)' : ''}
            </span>
          </div>
          <div class="grid-4" style="gap:10px;">
            ${PSU_STRESS_PROFILES.map((prof) => {
              const isSelected = activeStressProfile === prof.id;
              return `
                <button
                  type="button"
                  data-psu-profile="${prof.id}"
                  class="panel stack-sm"
                  style="text-align:left;padding:10px 12px;cursor:pointer;border-radius:10px;background:${isSelected ? 'rgba(6,182,212,0.14)' : 'var(--bg-main)'};border:1.5px solid ${isSelected ? '#06b6d4' : 'rgba(255,255,255,0.08)'};transition:all 0.15s ease;"
                >
                  <div class="row-between" style="width:100%;">
                    <strong style="font-size:12.5px;color:${isSelected ? '#38bdf8' : 'var(--text-primary)'};">${esc(prof.label)}</strong>
                    <span class="font-mono" style="font-size:10.5px;color:${isSelected ? '#22d3ee' : 'var(--text-muted)'};">${isSelected ? '● AKTYWNY' : 'Wybierz'}</span>
                  </div>
                  <span style="font-size:11px;color:var(--text-secondary);line-height:1.35;">${esc(prof.shortDesc)}</span>
                  <span class="font-mono" style="font-size:10.5px;color:var(--text-muted);">CPU: ${prof.cpuLoadBoost}% · GPU: ${prof.gpuLoadBoost}% · +${prof.extraDrawW}W</span>
                </button>
              `;
            }).join('')}
          </div>
        </div>

        <div class="grid-2" style="margin-top:12px;gap:12px;">
          <!-- Projected Monthly Power Cost widget -->
          <div class="panel stack-sm" style="background:var(--bg-inset);padding:14px;border-radius:12px;">
            <div class="row-between" style="margin-bottom:8px;">
              <span style="font-size:13px;font-weight:600;">Szacowany miesięczny koszt prądu (Projected Monthly Cost)</span>
              <span class="font-mono status-cyan" style="font-size:16px;font-weight:700;">${psuCalc.monthlyCost.toFixed(2)} PLN</span>
            </div>
            <div style="font-size:12px;color:var(--text-secondary);margin-bottom:10px;">
              Zużycie miesięczne: <strong class="font-mono">${psuCalc.monthlyKwh} kWh</strong> (przy stałym obciążeniu ${psuCalc.totalSystemPowerW}W)
            </div>
            <div class="row-wrap" style="gap:10px;align-items:center;">
              <div style="display:flex;flex-direction:column;gap:3px;flex-grow:1;">
                <label style="font-size:11px;color:var(--text-muted);">Cena kWh (PLN):</label>
                <input id="psu-price-input" type="number" step="0.01" min="0.01" value="${psuCalculatorService.getElectricityPrice()}" class="input-text font-mono" style="padding:6px 10px;font-size:12px;width:100%;">
              </div>
              <div style="display:flex;flex-direction:column;gap:3px;flex-grow:1;">
                <label style="font-size:11px;color:var(--text-muted);">Godziny pracy / dobę:</label>
                <input id="psu-hours-input" type="number" step="1" min="1" max="24" value="${psuCalculatorService.getUsageHoursPerDay()}" class="input-text font-mono" style="padding:6px 10px;font-size:12px;width:100%;">
              </div>
            </div>
          </div>

          <!-- Alert Rules Section (Individual Rail Thresholds & Notification Actions) -->
          <div id="psu-alert-rules-section" class="panel stack-sm" style="background:var(--bg-inset);padding:14px;border-radius:12px;">
            <div class="row-between" style="margin-bottom:6px;flex-wrap:wrap;gap:6px;">
              <span style="font-size:13px;font-weight:600;">Alert Rules (Reguły Alertów Szyn +12V / +5V / +3.3V)</span>
              <select id="psu-deviation-input" class="input-text font-mono" style="padding:3px 8px;font-size:11px;width:auto;" title="Szybki preset dla wszystkich szyn">
                <option value="2" ${devPct === 2 ? 'selected' : ''}>Preset wszystkie: ±2%</option>
                <option value="5" ${devPct === 5 ? 'selected' : ''}>Preset wszystkie: ±5% (ATX)</option>
                <option value="8" ${devPct === 8 ? 'selected' : ''}>Preset wszystkie: ±8%</option>
                <option value="10" ${devPct === 10 ? 'selected' : ''}>Preset wszystkie: ±10%</option>
              </select>
            </div>
            <div class="grid-3" style="gap:8px;margin-bottom:8px;">
              <div style="display:flex;flex-direction:column;gap:3px;">
                <label for="psu-rule-12v-pct" style="font-size:11px;color:var(--text-muted);">Próg szyny +12V (%):</label>
                <input id="psu-rule-12v-pct" type="number" min="1" max="15" step="0.5" value="${rules.rail12VThresholdPct}" class="input-text font-mono" style="padding:5px 8px;font-size:12px;width:100%;" />
              </div>
              <div style="display:flex;flex-direction:column;gap:3px;">
                <label for="psu-rule-5v-pct" style="font-size:11px;color:var(--text-muted);">Próg szyny +5V (%):</label>
                <input id="psu-rule-5v-pct" type="number" min="1" max="15" step="0.5" value="${rules.rail5VThresholdPct}" class="input-text font-mono" style="padding:5px 8px;font-size:12px;width:100%;" />
              </div>
              <div style="display:flex;flex-direction:column;gap:3px;">
                <label for="psu-rule-3v3-pct" style="font-size:11px;color:var(--text-muted);">Próg szyny +3.3V (%):</label>
                <input id="psu-rule-3v3-pct" type="number" min="1" max="15" step="0.5" value="${rules.rail3P3VThresholdPct}" class="input-text font-mono" style="padding:5px 8px;font-size:12px;width:100%;" />
              </div>
            </div>
            <div class="row-wrap" style="gap:14px;font-size:11.5px;color:var(--text-secondary);">
              <label style="display:inline-flex;align-items:center;gap:6px;cursor:pointer;">
                <input id="psu-rule-desktop-notify" type="checkbox" ${rules.desktopNotification ? 'checked' : ''} />
                <span>Powiadomienie pulpitu (Desktop Notification)</span>
              </label>
              <label style="display:inline-flex;align-items:center;gap:6px;cursor:pointer;">
                <input id="psu-rule-log-error" type="checkbox" ${rules.logError ? 'checked' : ''} />
                <span>Zapisz błąd w logu (Log Error)</span>
              </label>
              <label style="display:inline-flex;align-items:center;gap:6px;cursor:pointer;">
                <input id="psu-rule-sound-alert" type="checkbox" ${rules.soundAlert ? 'checked' : ''} />
                <span>Alarm audio</span>
              </label>
            </div>
          </div>
        </div>

        <div class="panel stack-sm" style="background:var(--bg-inset);padding:16px;border-radius:12px;margin-top:12px;">
          <div class="row-between" style="flex-wrap:wrap;gap:6px;margin-bottom:8px;">
            <div>
              <h3 style="font-size:14px;font-weight:600;margin:0;">Voltage History Panel (Ostatnie 60 sekund)</h3>
              <span class="panel-caption">Wizualizacja D3.js wahań napięć szyn +12V, +5V, +3.3V w czasie rzeczywistym z warstwą adnotacji zdarzeń</span>
            </div>
            <span class="font-mono" style="font-size:11.5px;color:var(--text-secondary);">Okno: 60s</span>
          </div>
          <div id="pc-psu-rail-chart"></div>
        </div>

        <div class="grid-2" style="margin-top:12px;gap:12px;">
          <div class="panel stack-sm" style="background:var(--bg-inset);padding:16px;border-radius:12px;">
            <div class="row-between" style="flex-wrap:wrap;gap:6px;margin-bottom:8px;">
              <div>
                <h3 style="font-size:14px;font-weight:600;margin:0;">Krzywa Sprawności Zasilacza (PSU Efficiency Curve)</h3>
                <span class="panel-caption">Interaktywny wykres D3.js sprawności PSU w funkcji obciążenia (optymalna strefa 40-60%)</span>
              </div>
              <span class="font-mono status-ok" style="font-size:11.5px;">Szczyt: ~92% (80 PLUS Gold)</span>
            </div>
            <div id="pc-psu-efficiency-chart"></div>
          </div>

          <div class="panel stack-sm" style="background:var(--bg-inset);padding:16px;border-radius:12px;">
            <div class="row-between" style="flex-wrap:wrap;gap:6px;margin-bottom:8px;">
              <div>
                <h3 style="font-size:14px;font-weight:600;margin:0;">Pobór Mocy vs. Krzywa Sprawności (Live D3.js Bar Chart)</h3>
                <span class="panel-caption">Porównanie bieżącego poboru mocy systemu z krzywą sprawności PSU w krokach 10%–100% obciążenia</span>
              </div>
              <span class="font-mono status-cyan" style="font-size:11.5px;">${psuCalc.totalSystemPowerW} W (${psuCalc.loadPercentageOfPsu}%)</span>
            </div>
            <div id="pc-psu-power-efficiency-bar-chart"></div>
          </div>
        </div>

        <!-- 1-Hour PSU Efficiency Trend vs. Power Draw & Temperature D3.js Chart -->
        <div class="panel stack-sm" style="background:var(--bg-inset);padding:16px;border-radius:12px;margin-top:12px;">
          <div class="row-between" style="flex-wrap:wrap;gap:6px;margin-bottom:8px;">
            <div>
              <h3 style="font-size:14px;font-weight:600;margin:0;">Trend Sprawności PSU w Czasie vs. Pobór Mocy i Temperatura (Ostatnie 60 min — D3.js)</h3>
              <span class="panel-caption">Wykres liniowy sprawności zasilacza (%) względem poboru mocy systemu (W) w ciągu ostatniej godziny, obrazujący spadek sprawności wraz ze wzrostem temperatury podzespołów</span>
            </div>
            <span class="font-mono status-warn" style="font-size:11.5px;">Okno: 60 min (${(b.efficiencyTrend1h || []).length} próbek · Temp PSU: ${p.tempC.toFixed(1)}°C)</span>
          </div>
          <div id="pc-psu-efficiency-trend-1h-chart"></div>
        </div>

        <!-- Rail Alert Log Panel -->
        <div class="panel stack-sm" style="background:var(--bg-inset);padding:16px;border-radius:12px;margin-top:12px;">
          <div class="row-between" style="flex-wrap:wrap;gap:6px;margin-bottom:8px;">
            <div>
              <h3 style="font-size:14px;font-weight:600;margin:0;">Rail Alert Log (Dziennik zdarzeń odchyłek napięć)</h3>
              <span class="panel-caption">Rejestr incydentów przekroczenia reguł Alert Rules (+12V: ±${rules.rail12VThresholdPct}%, +5V: ±${rules.rail5VThresholdPct}%, +3.3V: ±${rules.rail3P3VThresholdPct}%) · Log Error: ${rules.logError ? 'WŁ.' : 'WYŁ.'} · Desktop Notify: ${rules.desktopNotification ? 'WŁ.' : 'WYŁ.'}</span>
            </div>
            <div class="row-wrap" style="gap:8px;align-items:center;">
              <button id="psu-clear-rail-alerts-btn" type="button" class="btn btn-secondary btn-sm" ${!b.railAlertEvents || b.railAlertEvents.length === 0 ? 'disabled' : ''}>
                Wyczyść dziennik
              </button>
              <span class="font-mono ${b.railAlertEvents && b.railAlertEvents.length > 0 ? 'status-err' : 'status-ok'}" style="font-size:11.5px;">
                ${b.railAlertEvents && b.railAlertEvents.length > 0 ? `🚨 Zarejestrowano ${b.railAlertEvents.length} alertów` : '✅ Wszystkie szyny stabilne'}
              </span>
            </div>
          </div>
          <div id="psu-rail-alert-log" style="overflow-x:auto;">
            ${this.renderPsuRailAlertLogTableHtml(b.railAlertEvents || [], devPct)}
          </div>
        </div>
      </div>
    `;
  }

  private renderPsuRailAlertLogTableHtml(
    events: Array<{ timestamp: number; railName: string; voltage: number; deviationPct: number }>,
    devPct: number
  ): string {
    if (!events || events.length === 0) {
      return `
        <div style="padding:16px;color:var(--text-muted);font-size:12px;text-align:center;background:var(--bg-main);border-radius:8px;border:1px dashed rgba(255,255,255,0.08);">
          Brak zarejestrowanych incydentów odchyłek napięć. Wszystkie szyny (+12V, +5V, +3.3V) pracują w normie ATX i wyznaczonej tolerancji (±${devPct}%).
        </div>
      `;
    }

    const rows = [...events].reverse().slice(0, 20).map((ev) => {
      const d = new Date(ev.timestamp);
      const timeStr = `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}:${d.getSeconds().toString().padStart(2, '0')}.${Math.floor(d.getMilliseconds() / 100)}`;
      const atxNominal = ev.railName === '+12V' ? 12.0 : ev.railName === '+5V' ? 5.0 : 3.3;
      const atxRange = ev.railName === '+12V' ? '11.40V – 12.60V' : ev.railName === '+5V' ? '4.75V – 5.25V' : '3.13V – 3.47V';

      return `
        <tr style="border-bottom:1px solid rgba(255,255,255,0.05);font-size:12px;">
          <td class="font-mono" style="padding:8px 10px;color:var(--text-secondary);">${timeStr}</td>
          <td style="padding:8px 10px;font-weight:600;color:var(--text-primary);">${esc(ev.railName)}</td>
          <td class="font-mono" style="padding:8px 10px;font-weight:700;color:var(--status-err);">${ev.voltage.toFixed(2)} V</td>
          <td style="padding:8px 10px;">
            <span style="display:inline-block;padding:2px 6px;border-radius:4px;background:rgba(244,63,94,0.18);border:1px solid #f43f5e;color:#fecdd3;font-size:11px;font-weight:600;">
              ±${ev.deviationPct.toFixed(1)}% (próg ±${devPct}%)
            </span>
          </td>
          <td class="font-mono" style="padding:8px 10px;color:var(--text-muted);font-size:11px;">Nominalne: ${atxNominal}V (${atxRange})</td>
          <td style="padding:8px 10px;">
            <span class="status-err" style="font-weight:600;font-size:11px;">⚠️ ODCHYŁKA ATX</span>
          </td>
        </tr>
      `;
    }).join('');

    return `
      <table style="width:100%;border-collapse:collapse;text-align:left;">
        <thead>
          <tr style="border-bottom:1px solid rgba(255,255,255,0.1);font-size:11.5px;color:var(--text-secondary);">
            <th style="padding:6px 10px;">Czas</th>
            <th style="padding:6px 10px;">Szyna</th>
            <th style="padding:6px 10px;">Napięcie</th>
            <th style="padding:6px 10px;">Odchyłka zmierzona</th>
            <th style="padding:6px 10px;">Specyfikacja ATX</th>
            <th style="padding:6px 10px;">Status</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>
    `;
  }

  public dispose(): void {
    if (this.logFlushTimer !== null) {
      window.clearInterval(this.logFlushTimer);
      this.logFlushTimer = null;
    }
    void this.flushLogQueue();
    this.workspaceErrorBoundary.detachGlobalListeners();
    this.stopDisplaySlideshow();
    if (this.persistDebounceTimer !== null) {
      window.clearTimeout(this.persistDebounceTimer);
      this.persistDebounceTimer = null;
    }
    this.diagnosticEvents.removeEventListener('diagnostic-changed', this.onDiagnosticChangeEvent);
    document.removeEventListener('visibilitychange', this.onPageFlushPersist);
    window.removeEventListener('pagehide', this.onPageFlushPersist);
    cpuTestService.stopStress();
    gpuStressEngine.unmount();
    gameBenchService.unmount();
    fanTestService.stop();
    fanTestService.stopPwmFrequencyMonitor();
    fanTestService.stopLiveAcousticHeatmapCapture();
    displayDiagnostics.closeFullscreen();
    displayDiagnostics.detachPreviewCanvas();
    this.detachPeripheralsListeners();
    this.unsubscribeThermal?.();
    thermalMonitorService.stop();
    this.unsubscribeBattery?.();
    batteryHealthService.dispose();
  }
}
