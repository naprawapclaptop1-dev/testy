export type ActiveModule =
  | 'dashboard'
  | 'scheduler'
  | 'game'
  | 'cpu'
  | 'ram'
  | 'disk'
  | 'gpu'
  | 'display'
  | 'battery'
  | 'peripherals'
  | 'network';

export type ThemeMode = 'dark' | 'high-contrast';

export interface DiagnosticLogEntry {
  id?: number;
  timestamp: number;
  isoTime: string;
  module: string;
  level: 'INFO' | 'OK' | 'WARN' | 'ERROR';
  event: string;
  metric: string;
  value: string;
  details: string;
}

export interface SystemSpecs {
  os: string;
  browser: string;
  platform: string;
  cpuCores: number;
  deviceMemory: number | 'Nieznana';
  gpuRenderer: string;
  gpuVendor: string;
  webglVersion: string;
  maxTextureSize: number;
  screenResolution: string;
  viewportSize: string;
  colorDepth: number;
  devicePixelRatio: number;
  estimatedRefreshRate: number;
  online: boolean;
  connectionType: string;
  downlink: number | 'Nieznana';
  rtt: number | 'Nieznana';
  storageQuotaGB: number | null;
  storageUsageMB: number | null;
}

export interface CpuTelemetryPoint {
  timeSec: number;
  loadPct: number;
  estClockGHz: number;
  estTempC: number;
  opsPerSec: number;
}

export type CpuStressMode =
  | 'all_core_avx'
  | 'prime_sieve'
  | 'raytrace_bvh'
  | 'matrix_fma'
  | 'crypto_gzip_mix'
  | 'nbody_gravity'
  | 'neural_ai_inference'
  | 'monte_carlo_quicksort';

export interface CpuTestResult {
  status: 'idle' | 'running' | 'completed' | 'stressing';
  phase: string;
  progress: number;
  coresUsed: number;
  singleCoreScore: number;
  multiCoreScore: number;
  scalingRatio: number;
  mathMflops: number;
  compressionMBs: number;
  cryptoSha256MBs: number;
  avxMatrixGflops?: number;
  raytraceScore?: number;
  branchOpsM?: number;
  physicsNbodyGflops?: number;
  neuralInferenceOps?: number;
  monteCarloScore?: number;
  aesGcmMBs?: number;
  fftSignalScore?: number;
  jsonParseMBs?: number;
  kdfHashOps?: number;
  simdDotGflops?: number;
  stressMode?: CpuStressMode;
  avgClockGHz: number;
  peakClockGHz: number;
  currentTempC: number;
  peakTempC: number;
  throttlingPct: number;
  stabilityPct: number;
  telemetry: CpuTelemetryPoint[];
  overallScore: number;
  grade: 'WZOROWY' | 'DOBRY' | 'ŚREDNI' | 'NISKI';
}

export interface RamTestResult {
  status: 'idle' | 'running' | 'completed' | 'failed';
  progress: number;
  allocatedMB: number;
  bandwidthReadMBs: number;
  bandwidthWriteMBs: number;
  copyBandwidthMBs?: number;
  cacheL1L2MBs?: number;
  cacheL3MBs?: number;
  latencyNs: number;
  errorsFound: number;
  patternErrors: number;
  randomErrors: number;
  walkingBitErrors: number;
  patternTestPassed: boolean;
  randomTestPassed: boolean;
  walkingBitsPassed: boolean;
  marchCPassed?: boolean;
  rowHammerPassed?: boolean;
  modulo20Passed?: boolean;
  movingInversionsPassed?: boolean;
  galpatPassed?: boolean;
  tlbThrashPassed?: boolean;
  tlbThrashErrors?: number;
  bankInterleavePassed?: boolean;
  streamCopyMBs?: number;
  bitFadePassed?: boolean;
  latencyP95Ns?: number;
  healthGrade: 'WZOROWY' | 'DOBRY' | 'UWAGA' | 'KRYTYCZNY';
  overallScore: number;
  testLog: string[];
}

export interface SmartAttribute {
  id: string;
  name: string;
  value: string;
  threshold: string;
  status: 'OK' | 'UWAGA' | 'BŁĄD';
  note: string;
}

export interface DiskTestResult {
  status: 'idle' | 'running' | 'completed' | 'failed';
  phase: string;
  progress: number;
  backend: 'OPFS (Native FS)' | 'IndexedDB' | 'Oczekiwanie';
  seqWriteMBs: number;
  seqReadMBs: number;
  rand4kWriteMBs: number;
  rand4kReadMBs: number;
  rand4kIops: number;
  mixedRwMBs?: number;
  qd32Iops?: number;
  qd64Iops?: number;
  dbCommitIops?: number;
  metaOpsPerSec?: number;
  sustainedStabilityPct?: number;
  directStorageBurstMBs?: number;
  slcCacheCurvePct?: number;
  thermalSustainedWriteMBs?: number;
  payloadSizeMB?: number;
  accessTimeAvgMs: number;
  accessTimeMinMs: number;
  accessTimeP95Ms: number;
  crcVerified: boolean;
  quotaGB: number;
  usedMB: number;
  smartHealthPct: number;
  smartStatus: 'ZDROWY' | 'UWAGA' | 'KRYTYCZNY';
  smartAttributes: SmartAttribute[];
  overallScore: number;
}

export type GpuLoadPreset = 'standard' | 'high' | 'extreme' | 'ultra';
export type GpuFpsMode = 'uncapped' | 'vsync';

export interface GpuTelemetryPoint {
  timeSec: number;
  fps: number;
  frameTimeMs: number;
  estTempC: number;
}

export type GpuSceneMode =
  | 'vortex'
  | 'furmark'
  | 'raymarching'
  | 'galaxy'
  | 'vram_fill'
  | 'geometry'
  | 'cyber_city'
  | 'fluid_plasma'
  | 'menger_sponge'
  | 'neural_lattice'
  | 'volumetric_nebula'
  | 'crystal_caustics'
  | 'blackhole_lensing'
  | 'dna_megastructure'
  | 'pathtraced_cornell'
  | 'subsurface_dragon'
  | 'cloth_aerodynamics'
  | 'volumetric_godrays'
  | 'voronoi_shatter'
  | 'supernova_remnant'
  | 'cyber_tunnel_warp'
  | 'magnetic_ferrofluid'
  | 'fractal_julia4d'
  | 'tokamak_fusion'
  | 'raytraced_metaballs'
  | 'ocean_gerstner_fft'
  | 'fluid_navier_stokes'
  | 'gi_radiosity_temple'
  | 'particle_collider_cern'
  | 'procedural_planet_atmo'
  | 'volumetric_fire_tornado'
  | 'cyber_matrix_hypercube'
  | 'voxel_pathtracer'
  | 'nbody_galaxy_collision'
  | 'caustic_water_pool'
  | 'fractal_apollonian'
  | 'cyber_mecha_hangar'
  | 'plasma_magnetosphere'
  | 'crystal_geode_cave'
  | 'quantum_chromodynamics'
  | 'meshlet_nanite_cluster'
  | 'caustic_raytrace_prism'
  | 'temporal_aa_checker'
  | 'sph_fluid_compute';

export interface GpuStressMetrics {
  running: boolean;
  sceneMode: GpuSceneMode;
  sceneLabel: string;
  workloadNote: string;
  preset: GpuLoadPreset;
  fpsMode: GpuFpsMode;
  instanceCount: number;
  triangles: number;
  drawCalls: number;
  fps: number;
  avgFps: number;
  minFps: number;
  maxFps: number;
  low1PctFps: number;
  totalFramesRendered: number;
  frameTimeMs: number;
  stabilityPct: number;
  estTempC: number;
  peakTempC: number;
  elapsedSec: number;
  isSoftwareGl: boolean;
  rendererName: string;
  estFp32Tflops?: number;
  vramFillrateGBs?: number;
  telemetry: GpuTelemetryPoint[];
  overallScore: number;
  verdict: 'STABILNY' | 'LEKKI SPADEK' | 'THROTTLING / PRZECIĄŻENIE' | 'OCZEKIWANIE';
}

export interface BatteryHistoryPoint {
  timeLabel: string;
  timestamp?: number;
  dateTimeLabel?: string;
  levelPct: number;
  powerW: number;
}

export interface BatteryRuntimeEstimate {
  profile: string;
  powerW: number;
  hours: number;
  minutes: number;
  label: string;
}

export interface BatteryPowerCycleEntry {
  id: string;
  cycleNumber: number;
  dateLabel: string;
  timestamp: number;
  startPct: number;
  endPct: number;
  durationMin: number;
  avgPowerW: number;
  designCapacityMWh: number;
  fullChargeCapacityMWh: number;
  degradationFromPrevMWh: number;
  cumulativeWearPct: number;
  source: 'auto' | 'manual' | 'baseline';
}

export interface PcPsuStatus {
  detected: boolean;
  model: string;
  rating80Plus: '80 PLUS Gold' | '80 PLUS Platinum' | '80 PLUS Titanium' | '80 PLUS Bronze' | 'Standard';
  rail12V: number;
  rail5V: number;
  rail3P3V: number;
  rippleMv: number;
  efficiencyPct: number;
  estimatedWattage: number;
  tempC: number;
  status: 'STABILNY' | 'WAHANIA NAPIĘCIA' | 'PRECIĄŻENIE';
}

export interface BatteryHealthState {
  apiSupported: boolean;
  levelPct: number;
  charging: boolean;
  nativeChargingTimeSec: number;
  nativeDischargingTimeSec: number;
  designCapacityMWh: number;
  fullChargeCapacityMWh: number;
  wearLevelPct: number;
  healthPct: number;
  estimatedCycles: number;
  currentLoadPct: number;
  currentPowerDrawW: number;
  powerThresholdW: number;
  soundAlertEnabled: boolean;
  voltageV: number;
  estTempC: number;
  condition: 'DOSKONAŁA' | 'DOBRA' | 'ZUŻYTA' | 'DO WYMIANY';
  estimates: BatteryRuntimeEstimate[];
  history: BatteryHistoryPoint[];
  railHistory: Array<{ timeLabel: string; timestamp: number; rail12V: number; rail5V: number; rail3P3V: number; powerW: number }>;
  efficiencyTrend1h: PsuEfficiencyTrendPoint[];
  powerCycles: BatteryPowerCycleEntry[];
  totalCapacityLostMWh: number;
  avgDegradationPerCycleMWh: number;
  projectedCyclesTo80Pct: number | null;
  psu: PcPsuStatus;
  criticalPowerAlert: boolean;
  railAlertEvents: Array<{ timestamp: number; railName: string; voltage: number; deviationPct: number; thresholdPct?: number; action?: string }>;
  wmiSnapshot?: WindowsBatteryWmiSnapshot | null;
  sagTestResult?: VoltageSagTestResult | null;
}

export interface VoltageSagTestResult {
  timestamp: number;
  idleVoltageV: number;
  loadedVoltageV: number;
  cellSagMv: number;
  rail12VIdleV: number;
  rail12VLoadedV: number;
  rail12VDroopPct: number;
  rippleLoadedMv: number;
  verdict: 'WZOROWA' | 'DOPUSZCZALNY SPADEK' | 'WYKRYTO SPADEK NAPIĘCIA (DEGRADACJA / ZASILACZ)';
  summary: string;
}

export interface PowerThermalMaintenanceReport {
  batteryRemainingMonths: number;
  batteryRemainingLabel: string;
  batteryCyclesRemainingTo80: number;
  batteryCyclesRemainingToEol: number;
  batteryVerdict: string;
  psuRemainingYears: number;
  psuRemainingLabel: string;
  psuVerdict: string;
  fullChargeIdleHours: string;
  fullChargeWebHours: string;
  fullChargeLoadHours: string;
  currentChargeRemainLabel: string;
  timeToFullChargeLabel: string;
  voltageSagMv: number;
  voltageSagPct: number;
  voltageSagStatus: 'BRAK SPADKU (STABILNE)' | 'LEKKI SPADEK' | 'WYRAŹNY SPADEK NAPIĘCIA';
  internalResistanceHint: string;
  pasteUrgency: 'OPTYMALNA (NIE WYMAGA)' | 'WKRÓTCE (3–6 MIES.)' | 'PILNA WYMIANA TERAZ';
  pasteUrgencyColor: string;
  pasteNextSwapLabel: string;
  padsNextSwapLabel: string;
  fanCleanNextLabel: string;
  cmosCheckLabel: string;
  deltaTLoadC: number | null;
  hotspotDeltaC: number | null;
  recommendedMaterials: string[];
  actionReasons: string[];
}

export interface PsuRailAlertRules {
  rail12VThresholdPct: number;
  rail5VThresholdPct: number;
  rail3P3VThresholdPct: number;
  desktopNotification: boolean;
  logError: boolean;
  soundAlert: boolean;
}

export interface PsuEfficiencyTrendPoint {
  timestamp: number;
  timeLabel: string;
  efficiencyPct: number;
  powerDrawW: number;
  tempC: number;
}

export interface GpuSceneSuiteEntry {
  sceneId: GpuSceneMode;
  name: string;
  targetUnit: string;
  avgFps: number;
  low1PctFps: number;
  triangles: number;
  stabilityPct: number;
  score: number;
}

export interface NetworkAdapterInfo {
  name: string;
  description: string;
  type: 'Ethernet (LAN)' | 'Wi-Fi' | 'VPN / Inne';
  status: 'Up' | 'Disconnected' | 'Other';
  linkSpeedMbps: number;
  maxStandardLabel: string;
  theoreticalMaxTcpMbps: number;
  macAddress: string;
}

export interface WindowsBatteryWmiSnapshot {
  source: 'exe_wmi' | 'powershell_paste' | 'battery_api' | 'manual';
  name: string;
  chemistry: string;
  manufacturer: string;
  serial: string;
  designCapacityMWh: number;
  fullChargeCapacityMWh: number;
  remainingCapacityMWh?: number;
  cycleCount: number;
  voltageMv: number;
  chargeRateMw: number;
  dischargeRateMw: number;
  acOnline: boolean;
  levelPct: number;
  timestamp: number;
}

export interface NetworkPingSample {
  seq: number;
  latencyMs: number;
  ok: boolean;
}

export interface NetworkSpeedSample {
  seq: number;
  downloadMbps: number;
  uploadMbps: number;
}

export type NetworkTransferDirection = 'both' | 'download' | 'upload';

export interface SpeedTestServerProbe {
  id: string;
  city: string;
  country: string;
  region: 'PL' | 'EU' | 'WORLD';
  provider: string;
  capacityGbps: number;
  distanceKm: number;
  pingMs: number;
  jitterMs: number;
  status: 'ONLINE' | 'PROBING' | 'TIMEOUT';
}

export interface NetworkTestResult {
  status: 'idle' | 'running' | 'completed';
  progress: number;
  online: boolean;
  effectiveType: string;
  downlinkMbps: number | null;
  nativeRttMs: number | null;
  pingMinMs: number;
  pingAvgMs: number;
  pingMaxMs: number;
  jitterMs: number;
  packetLossPct: number;
  downloadEstMbps: number;
  peakDownloadMbps?: number;
  uploadEstMbps?: number;
  peakUploadMbps?: number;
  transferredMB?: number;
  bufferbloatMs?: number;
  dnsLookupMs?: number;
  voipMosScore?: number;
  cdnEdgeMs?: number;
  activeStreams?: number;
  transferDirection?: NetworkTransferDirection;
  selectedServerId?: string;
  selectedServerName?: string;
  linkProfileGbps?: number;
  serverScanResults?: SpeedTestServerProbe[];
  adapters?: NetworkAdapterInfo[];
  adapterSource?: string;
  lanLoopbackMbps?: number;
  lanGatewayRttMs?: number;
  lanCableCategoryHint?: string;
  lanStatusNote?: string;
  continuousMode?: boolean;
  targetSamples?: number;
  samples: NetworkPingSample[];
  speedSamples?: NetworkSpeedSample[];
  qualityGrade: 'WZOROWA' | 'DOBRA' | 'NIESTABILNA' | 'OFFLINE';
}

export interface SuiteScores {
  cpu: number;
  ram: number;
  disk: number;
  gpu: number;
  battery: number;
  overall: number;
  grade: 'S' | 'A+' | 'A' | 'B' | 'C' | 'D';
  timestamp: number | null;
}

/* --- Thermal Heat Map --- */
export type ThermalZoneLevel = 'cool' | 'optimal' | 'warm' | 'hot';

export type ThermalSensorMode = 'hardware-live' | 'hardware-imported' | 'load-only';

export interface ThermalZoneHistoryPoint {
  ts: number;
  tempC: number | null;
  loadPct: number;
}

export interface ThermalZoneReading {
  id: string;
  label: string;
  tempC: number | null;
  peakC: number | null;
  loadPct: number;
  peakLoadPct: number;
  sensorName?: string;
  level: ThermalZoneLevel;
  history60s: ThermalZoneHistoryPoint[];
}

export interface ThermalComponentRow {
  id: 'cpu' | 'gpu' | 'disk' | 'ram';
  name: string;
  subtitle: string;
  loadPct: number;
  active: boolean;
  avgTempC: number | null;
  maxTempC: number | null;
  zones: ThermalZoneReading[];
}

export interface ThermalHeatMapSnapshot {
  updatedAt: number;
  sensorMode: ThermalSensorMode;
  bridgeUrl: string;
  bridgeStatus: string;
  rows: ThermalComponentRow[];
  avgSystemTempC: number | null;
  hottestTempC: number | null;
  hottestZoneLabel: string;
  batteryTempC: number | null;
  thermalStatus:
    | 'OPTYMALNA'
    | 'PODWYŻSZONA'
    | 'WYSOKA TEMPERATURA'
    | 'TRYB OBCIĄŻENIA (BRAK CZUJNIKA °C)';
}

/* --- Stress Test Scheduler --- */
export type ScheduledTestType =
  | 'cpu_bench'
  | 'cpu_stress'
  | 'ram'
  | 'disk'
  | 'gpu_stress'
  | 'gpu_all_scenes'
  | 'game_ultra'
  | 'game_racing'
  | 'display_cal'
  | 'psu_stress'
  | 'audio_sweep'
  | 'network';

export type GameQualityPreset = 'high' | 'ultra' | 'extreme' | 'nightmare';
export type GameToneMappingMode = 'aces' | 'agx' | 'neutral';
export type GameAiProfile =
  | 'manual'
  | 'ai_auto'
  | 'ai_smooth_120'
  | 'ai_balanced'
  | 'ai_quality_4k'
  | 'ai_esports';
export type GameFpsCap = 0 | 60 | 120 | 144;

export type GameSceneId =
  | 'hyperion'
  | 'cyber_racer'
  | 'exoplanet_raid'
  | 'quantum_arena'
  | 'abyssal_fleet'
  | 'void_armada'
  | 'mecha_citadel'
  | 'solar_storm'
  | 'aether_sky'
  | 'chronos_rift'
  | 'cryo_glacier'
  | 'xeno_hive'
  | 'warp_gate'
  | 'omega_core'
  | 'dark_eclipse'
  | 'ragnarok_siege'
  | 'valhalla_fleet'
  | 'nemesis_foundry'
  | 'solaris_corona'
  | 'tartarus_abyss'
  | 'zephyr_ringworld'
  | 'phantasm_nebula'
  | 'excalibur_citadel'
  | 'omega_singularity'
  | 'formula_cyber_gp'
  | 'tokyo_drift_touge'
  | 'maglev_wipeout'
  | 'dakar_desert_storm'
  | 'f22_raptor_jet'
  | 'sr71_mach_plane'
  | 'apache_gunship_heli'
  | 'bugatti_hypercar_450'
  | 'soccer_champions_3d'
  | 'rally_snow_wrc';

export type PsuStressProfile = 'normal' | 'gpu_intense' | 'cpu_multicore' | 'transient_spike';

export interface GameBenchMetrics {
  running: boolean;
  interactiveMode: boolean;
  gameId?: GameSceneId;
  gameTitle?: string;
  preset: GameQualityPreset;
  fpsMode: GpuFpsMode;
  fpsCap?: GameFpsCap;
  renderScale: number;
  bloomEnabled: boolean;
  shadowsEnabled: boolean;
  fogEnabled?: boolean;
  anisotropy?: number;
  toneMapping?: GameToneMappingMode;
  exposure?: number;
  envIntensity?: number;
  sceneryDensityPct?: number;
  dynamicResolution?: boolean;
  aiProfile?: GameAiProfile;
  aiRecommendation?: string;
  isSmoothMode?: boolean;
  raymarchSteps: number;
  resolutionLabel: string;
  fps: number;
  avgFps: number;
  minFps: number;
  maxFps: number;
  low1PctFps: number;
  low01PctFps: number;
  frameTimeMs: number;
  triangles: number;
  drawCalls: number;
  particleCount: number;
  droneCount: number;
  elapsedSec: number;
  estTempC: number;
  peakTempC: number;
  realGpuTempC: number | null;
  gpuLoadIndexPct: number;
  stabilityPct: number;
  overallScore: number;
  shotsFired: number;
  targetsHit: number;
  isRacingMode?: boolean;
  raceSpeedKmh?: number;
  raceLap?: number;
  raceNitroPct?: number;
  isSoccerMode?: boolean;
  soccerScoreHome?: number;
  soccerScoreAway?: number;
  soccerBallSpeedKmh?: number;
  soccerMatchSec?: number;
  isFlightMode?: boolean;
  flightCategory?: 'jet' | 'plane' | 'helicopter';
  altitudeM?: number;
  machSpeed?: number;
  rotorRpm?: number;
  telemetry: GpuTelemetryPoint[];
  verdict: 'ULTRA PŁYNNOŚĆ' | 'GRYWALNE (60+)' | 'CIĘŻKIE OBCIĄŻENIE' | 'EKSTREMALNY THROTTLING' | 'OCZEKIWANIE';
}

export interface ScheduledTestItem {
  id: string;
  type: ScheduledTestType;
  label: string;
  durationSec?: number;
  ramSizeMB?: number;
  gpuPreset?: GpuLoadPreset;
  gpuFpsMode?: GpuFpsMode;
}

export interface SchedulerStepResult {
  itemId: string;
  type: ScheduledTestType;
  label: string;
  configSummary: string;
  status: 'passed' | 'warning' | 'failed' | 'aborted';
  durationSec: number;
  primaryMetricLabel: string;
  primaryMetricValue: string;
  secondaryDetails: string;
  peakTempC: number | null;
  score: number;
}

export interface SchedulerSummaryReport {
  id: string;
  startedAt: number;
  finishedAt: number;
  totalDurationSec: number;
  aborted: boolean;
  overallScore: number;
  grade: SuiteScores['grade'];
  passedCount: number;
  warningCount: number;
  failedCount: number;
  peakSystemTempC: number;
  steps: SchedulerStepResult[];
}

/* --- Hardware & Display Panel Scanner --- */
export interface DisplayPanelInfo {
  label: string;
  isInternal: boolean | null;
  isPrimary: boolean;
  logicalResolution: string;
  nativeResolution: string;
  devicePixelRatio: number;
  refreshRateHz: number;
  colorDepthBit: number;
  colorGamut: 'Rec.2020' | 'Display-P3' | 'sRGB';
  hdrSupported: boolean;
  orientation: string;
  touchPoints: number;
  estimatedClass: string;
  screenCount: number;
  multiScreenPermission: 'granted' | 'prompt' | 'unsupported';
}

export interface DetectedHardwareDevice {
  category:
    | 'Procesor (CPU)'
    | 'Karta graficzna (GPU)'
    | 'Kość RAM (DIMM)'
    | 'Pamięć RAM'
    | 'Dysk fizyczny'
    | 'Dysk / Pamięć masowa'
    | 'Zamontowany wolumin'
    | 'Płyta główna / BIOS'
    | 'Ekran / Matryca'
    | 'Ekran / Matryca EDID'
    | 'Karta sieciowa (NIC)'
    | 'Audio (Wyjście)'
    | 'Mikrofon'
    | 'Kamera'
    | 'Kontroler / Pad'
    | 'USB / HID / BT'
    | 'USB / HID / BT / Serial';
  name: string;
  details: string;
  status: 'Wykryto' | 'Aktywne' | 'Gotowe';
}

export interface FanTestState {
  running: boolean;
  stage: 'idle' | 'idle_baseline' | 'medium_load' | 'max_turbo' | 'cooldown' | 'completed';
  stageLabel: string;
  progressPct: number;
  targetLoadPct: number;
  estRpm: number;
  peakRpm: number;
  currentTempC: number;
  peakTempC: number;
  baselineNoiseDb: number | null;
  peakNoiseDb: number | null;
  currentNoiseDb: number | null;
  noiseDeltaDb: number | null;
  cooldownRateCPerMin: number;
  micMonitoring: boolean;
  verdict: 'OCZEKIWANIE' | 'CHŁODZENIE SPRAWNE' | 'GŁOŚNA PRACA / OBCIĄŻENIE' | 'SŁABE SCHŁADZANIE';
  history: Array<{ sec: number; rpm: number; tempC: number; db: number | null }>;
}

export interface FanCurvePoint {
  id: string;
  tempC: number;
  rpmPct: number;
}

export type FanCurvePreset = 'silent' | 'balanced' | 'performance' | 'turbo' | 'custom';

export interface FanCurveConfig {
  preset: FanCurvePreset;
  maxRpm: number;
  points: FanCurvePoint[];
}

export interface StressSessionRecord {
  id: string;
  module:
    | 'CPU Stres'
    | 'CPU Benchmark'
    | 'GPU 3D'
    | 'Gra 3D MAX'
    | 'Test Wentylatorów'
    | 'Harmonogram'
    | 'Pełna Diagnostyka';
  startedAt: number;
  endedAt: number;
  durationSec: number;
  avgCpuTempC: number | null;
  avgGpuTempC: number | null;
  finalStabilityPct: number;
  summaryMetric: string;
  status: 'OK' | 'UWAGA' | 'BŁĄD';
}


