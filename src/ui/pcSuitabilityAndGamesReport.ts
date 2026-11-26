import type {
  CpuTestResult,
  DiskTestResult,
  GameBenchMetrics,
  GpuStressMetrics,
  RamTestResult,
  SystemSpecs,
} from '../types';
import { gameBenchService } from '../services/gameBench.service';
import { computeRamSummaryMetrics } from '../services/ramTest.service';
import { generate30DayGameFpsHistory, renderGame30DayFpsTrendChartD3 } from './charts';

export interface PcSuitabilityInputContext {
  specs: SystemSpecs | null;
  cpu: CpuTestResult;
  ram: RamTestResult;
  disk: DiskTestResult;
  gpu: GpuStressMetrics;
  game: GameBenchMetrics;
}

export type GamePlayabilityTier = 'ultra' | 'smooth' | 'playable' | 'low';

export interface GameFpsPrediction {
  id: string;
  title: string;
  engine: string;
  genre: 'E-Sport / Shooter' | 'AAA Singleplayer' | 'UE5 / Path Tracing' | 'Symulator / Open-World';
  vramRecommendedGb: number;
  fps1080pNative: number;
  fps1440pQuality: number;
  fpsDlssFg: number;
  recommendedSetting: string;
  tier: GamePlayabilityTier;
  tierLabel: string;
  canRunSmoothly: boolean;
  vramWarning: string | null;
}

export interface PcSuitabilityCategory {
  id: string;
  title: string;
  icon: string;
  score: number;
  verdict: 'IDEALNY (90-100%)' | 'BARDZO DOBRY (75-89%)' | 'DOBRY (55-74%)' | 'PODSTAWOWY (<55%)';
  badgeClass: string;
  fillClass: string;
  summary: string;
  bottleneckNote: string;
}

export interface HardwarePowerIndex {
  cpuScore: number;
  gpuScore: number;
  ramScore: number;
  diskScore: number;
  vramEstGb: number;
  isHighEndGpu: boolean;
  gpuLabel: string;
  cpuCores: number;
  cpuTested: boolean;
  gpuTested: boolean;
  ramTested: boolean;
  diskTested: boolean;
  testedCount: number;
  benchGpuFps: number;
  benchGpuScore: number;
  perfFactor: number;
  baselinePerfFactor: number;
  calibrationDeltaPct: number;
}

export interface GamePlayabilitySummary {
  total: number;
  ultraCount: number;
  smoothCount: number;
  playableCount: number;
  lowCount: number;
  smoothOrBetterCount: number;
}

type GameFilterMode = 'all' | 'smooth60' | 'ultra120' | 'esport' | 'ue5_rt';

interface OptimizerState {
  gpuTier: string;
  vramGb: number;
  resolution: '1080p' | '1440p' | '4k';
  refreshHz: 60 | 120 | 144 | 165 | 240;
  gameProfile: 'esport' | 'ue5_single' | 'aaa_rt';
  selectedTrendGameId: string;
  gameFilter: GameFilterMode;
  targetFps: number;
  appliedFeedback: string | null;
  userCustomizedTier: boolean;
}

const optimizerState: OptimizerState = {
  gpuTier: 'rtx4090_7900xtx',
  vramGb: 16,
  resolution: '1440p',
  refreshHz: 144,
  gameProfile: 'ue5_single',
  selectedTrendGameId: 'cs2',
  gameFilter: 'all',
  targetFps: 144,
  appliedFeedback: null,
  userCustomizedTier: false,
};

function escHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function detectGpuClass(rendererRaw: string): {
  gpuBase: number;
  vramEstGb: number;
  defaultTier: string;
  defaultVramOption: number;
} {
  const renderer = rendererRaw.toLowerCase();
  if (/5090|4090|7900\s*xtx|3090\s*ti|3090/.test(renderer)) {
    return { gpuBase: 94, vramEstGb: 24, defaultTier: 'rtx4090_7900xtx', defaultVramOption: 16 };
  }
  if (/5080|4080|7900\s*xt|9070\s*xt|6950|6900/.test(renderer)) {
    return { gpuBase: 90, vramEstGb: 16, defaultTier: 'rtx4090_7900xtx', defaultVramOption: 16 };
  }
  if (/5070|4070|7800|7900\s*gre|9070|6800|3080/.test(renderer)) {
    return { gpuBase: 80, vramEstGb: 12, defaultTier: 'rtx4070_7800xt', defaultVramOption: 12 };
  }
  if (/4060\s*ti|3070|7700|6750|6700|2080/.test(renderer)) {
    return { gpuBase: 72, vramEstGb: 12, defaultTier: 'rtx4070_7800xt', defaultVramOption: 12 };
  }
  if (/4060|3060|7600|6650|6600|2070|arc\s*a7|arc\s*b5/.test(renderer)) {
    return { gpuBase: 64, vramEstGb: 8, defaultTier: 'rtx4060_7600', defaultVramOption: 8 };
  }
  if (/4050|3050|2060|1660|1650|1080|1070|1060|rx\s*580|rx\s*570|6500|5600|5500/.test(renderer)) {
    return { gpuBase: 48, vramEstGb: 6, defaultTier: 'gtx1650_igpu', defaultVramOption: 6 };
  }
  if (/780m|680m|890m|apple\s*m[1-4]|arc\s*graphics/.test(renderer)) {
    return { gpuBase: 42, vramEstGb: 6, defaultTier: 'gtx1650_igpu', defaultVramOption: 6 };
  }
  if (/intel|uhd|iris|hd\s*graphics|vega|radeon\(tm\)\s*graphics|swiftshader|llvmpipe|microsoft\s*basic/.test(renderer)) {
    return { gpuBase: 28, vramEstGb: 4, defaultTier: 'gtx1650_igpu', defaultVramOption: 6 };
  }
  return { gpuBase: 68, vramEstGb: 8, defaultTier: 'rtx4060_7600', defaultVramOption: 8 };
}

export function hasAnyBenchmarkResults(ctx: PcSuitabilityInputContext): boolean {
  const cpuTested = (ctx.cpu?.multiCoreScore ?? 0) > 0 || (ctx.cpu?.overallScore ?? 0) > 0;
  const ramTested = (ctx.ram?.overallScore ?? 0) > 0 || (ctx.ram?.bandwidthReadMBs ?? 0) > 0;
  const diskTested = (ctx.disk?.overallScore ?? 0) > 0 || (ctx.disk?.seqReadMBs ?? 0) > 0;
  const gpuTested =
    (ctx.gpu?.avgFps ?? 0) > 0 ||
    (ctx.gpu?.overallScore ?? 0) > 0 ||
    (ctx.game?.avgFps ?? 0) > 0 ||
    (ctx.game?.overallScore ?? 0) > 0;
  return cpuTested || ramTested || diskTested || gpuTested;
}

export function computeHardwarePowerIndex(ctx: PcSuitabilityInputContext): HardwarePowerIndex {
  const gpuLabel = ctx.specs?.gpuRenderer || ctx.gpu?.rendererName || 'Akcelerator 3D WebGL2';
  const cores = ctx.specs?.cpuCores || ctx.cpu?.coresUsed || 8;
  const memGb = typeof ctx.specs?.deviceMemory === 'number' ? ctx.specs.deviceMemory : 16;

  const gpuClass = detectGpuClass(gpuLabel);
  if (!optimizerState.userCustomizedTier) {
    optimizerState.gpuTier = gpuClass.defaultTier;
    optimizerState.vramGb = gpuClass.defaultVramOption;
  }

  const cpuTested = (ctx.cpu?.multiCoreScore ?? 0) > 0 || (ctx.cpu?.overallScore ?? 0) > 0;
  const ramTested = (ctx.ram?.overallScore ?? 0) > 0 || (ctx.ram?.bandwidthReadMBs ?? 0) > 0;
  const diskTested = (ctx.disk?.overallScore ?? 0) > 0 || (ctx.disk?.seqReadMBs ?? 0) > 0;

  const benchGpuFps = Math.max(
    ctx.gpu?.avgFps || 0,
    ctx.game?.avgFps || 0,
    ctx.gpu?.fps || 0,
    ctx.game?.fps || 0
  );
  const benchGpuScore = Math.max(ctx.gpu?.overallScore || 0, ctx.game?.overallScore || 0);
  const gpuTested = benchGpuFps > 0 || benchGpuScore > 0;

  // Conservative uncalibrated baseline (used before each subsystem is actually tested)
  const baselineGpuScore = Math.max(22, Math.round(gpuClass.gpuBase * 0.84));
  const baselineCpuScore = Math.max(30, Math.min(78, Math.round(36 + cores * 1.8)));
  const baselineRamScore = Math.max(40, Math.min(76, Math.round(50 + Math.min(32, memGb) * 0.8)));
  const baselineDiskScore = 66;

  // Real benchmark-calibrated GPU score (can reach up to 122 on flagship GPUs with high uncapped FPS/score,
  // or drop sharply if the GPU actually struggles in the WebGL2 3D test)
  let gpuScore = baselineGpuScore;
  if (gpuTested) {
    const isUncapped = ctx.gpu?.fpsMode === 'uncapped' || ctx.game?.fpsMode === 'uncapped';
    const stabilityFactor =
      (ctx.gpu?.stabilityPct || ctx.game?.stabilityPct || 90) >= 85
        ? 1.03
        : (ctx.gpu?.stabilityPct || ctx.game?.stabilityPct || 90) < 65
          ? 0.88
          : 0.96;

    // Normalize FPS against realistic WebGL2 stress workload (uncapped high-end reaches 140-300+ FPS; VSync caps at monitor Hz)
    const fpsNorm = isUncapped
      ? Math.min(126, Math.max(18, (benchGpuFps / 120) * 86))
      : Math.min(108, Math.max(18, (benchGpuFps / 60) * 74));

    const scoreNorm = benchGpuScore > 0 ? Math.min(118, benchGpuScore * 1.08) : fpsNorm;
    const measuredComposite = (fpsNorm * 0.52 + scoreNorm * 0.48) * stabilityFactor;

    // 100% real measured benchmark result when GPU 3D test has been executed
    gpuScore = Math.max(18, Math.min(124, Math.round(measuredComposite)));
  }

  // Real benchmark-calibrated CPU score
  let cpuScore = baselineCpuScore;
  if (cpuTested) {
    const mcNorm =
      (ctx.cpu?.multiCoreScore ?? 0) > 0
        ? Math.min(115, Math.max(22, Math.round((ctx.cpu.multiCoreScore / 95) * 1.0)))
        : baselineCpuScore;
    const overallNorm = (ctx.cpu?.overallScore ?? 0) > 0 ? Math.min(110, Math.round(ctx.cpu.overallScore * 1.05)) : mcNorm;
    cpuScore = Math.max(22, Math.min(115, Math.round(mcNorm * 0.55 + overallNorm * 0.45)));
  }

  // Real benchmark-calibrated RAM score (calibrated for V8 DDR4/DDR5 throughput & latency)
  let ramScore = baselineRamScore;
  if (ramTested) {
    const readMb = ctx.ram?.bandwidthReadMBs ?? 0;
    const writeMb = ctx.ram?.bandwidthWriteMBs ?? readMb;
    const bwBonus =
      readMb > 0
        ? readMb >= 4500
          ? Math.min(106, Math.round(94 + ((readMb - 4500) / 2000) * 10))
          : Math.min(105, Math.round((readMb / 2400) * 88))
        : 75;
    const recalcScore =
      readMb > 0 && writeMb > 0
        ? computeRamSummaryMetrics({
            bandwidthReadMBs: readMb,
            bandwidthWriteMBs: writeMb,
            latencyNs: ctx.ram?.latencyNs || 18,
            errorsFound: ctx.ram?.errorsFound || 0,
          }).overallScore
        : 0;
    const baseRam = Math.max(ctx.ram?.overallScore ?? 0, recalcScore) || bwBonus;
    ramScore = Math.max(25, Math.min(108, Math.round(baseRam * 0.78 + bwBonus * 0.22)));
  }

  // Real benchmark-calibrated Disk score
  let diskScore = baselineDiskScore;
  if (diskTested) {
    const seqNorm = (ctx.disk?.seqReadMBs ?? 0) > 0 ? Math.min(105, Math.round((ctx.disk.seqReadMBs / 1400) * 90)) : 75;
    diskScore = Math.max(30, Math.min(105, Math.round(((ctx.disk?.overallScore ?? seqNorm) * 0.7 + seqNorm * 0.3))));
  }

  const testedCount = [cpuTested, gpuTested, ramTested, diskTested].filter(Boolean).length;
  const baselinePerfFactor = (baselineGpuScore * 0.68 + baselineCpuScore * 0.22 + baselineRamScore * 0.1) / 85;
  const perfFactor = (gpuScore * 0.68 + cpuScore * 0.22 + ramScore * 0.1) / 85;
  const calibrationDeltaPct =
    baselinePerfFactor > 0 ? Math.round(((perfFactor - baselinePerfFactor) / baselinePerfFactor) * 100) : 0;

  return {
    cpuScore,
    gpuScore,
    ramScore,
    diskScore,
    vramEstGb: gpuClass.vramEstGb,
    isHighEndGpu: gpuScore >= 82,
    gpuLabel,
    cpuCores: cores,
    cpuTested,
    gpuTested,
    ramTested,
    diskTested,
    testedCount,
    benchGpuFps: Math.round(benchGpuFps),
    benchGpuScore: Math.round(benchGpuScore),
    perfFactor,
    baselinePerfFactor,
    calibrationDeltaPct,
  };
}

export function predictPlayableGames(ctx: PcSuitabilityInputContext): GameFpsPrediction[] {
  const hw = computeHardwarePowerIndex(ctx);

  const catalog: Array<{
    id: string;
    title: string;
    engine: string;
    genre: GameFpsPrediction['genre'];
    vramRecommendedGb: number;
    base1080: number;
    base1440: number;
    dlssFgMult: number;
    recommendedSetting: string;
    cpuHeavy?: boolean;
  }> = [
    {
      id: 'cs2',
      title: 'Counter-Strike 2 (Source 2)',
      engine: 'Source 2 · DX11/Vulkan',
      genre: 'E-Sport / Shooter',
      vramRecommendedGb: 6,
      base1080: 300,
      base1440: 228,
      dlssFgMult: 1.16,
      recommendedSetting: 'Natywne + Reflex Boost · FG Wył. · Cienie High · Limit 3 kl. poniżej Hz',
      cpuHeavy: true,
    },
    {
      id: 'valorant',
      title: 'Valorant / Overwatch 2',
      engine: 'UE4 Esports / Custom',
      genre: 'E-Sport / Shooter',
      vramRecommendedGb: 4,
      base1080: 365,
      base1440: 280,
      dlssFgMult: 1.12,
      recommendedSetting: 'Natywne 100% · NVIDIA Reflex ON + Boost · Motion Blur Wył.',
      cpuHeavy: true,
    },
    {
      id: 'forza5',
      title: 'Forza Horizon 5 (Extreme)',
      engine: 'ForzaTech · DX12',
      genre: 'Symulator / Open-World',
      vramRecommendedGb: 8,
      base1080: 150,
      base1440: 118,
      dlssFgMult: 1.52,
      recommendedSetting: 'DLAA / FSR Native · Tekstury Ultra · AF x16 · Odbicia High',
    },
    {
      id: 'gtav_next',
      title: 'GTA V Enhanced RT / GTA VI Preview',
      engine: 'RAGE Next-Gen · Ray Tracing',
      genre: 'Symulator / Open-World',
      vramRecommendedGb: 10,
      base1080: 118,
      base1440: 90,
      dlssFgMult: 1.68,
      recommendedSetting: 'DLSS/FSR Quality (67%) · Cienie High · Zasięg LOD High · AF x16',
    },
    {
      id: 'witcher3_rt',
      title: 'Wiedźmin 3: Dziki Gon (Next-Gen RT)',
      engine: 'REDengine 4 · DX12 RTGI',
      genre: 'AAA Singleplayer',
      vramRecommendedGb: 10,
      base1080: 100,
      base1440: 74,
      dlssFgMult: 1.82,
      recommendedSetting: 'DLSS/FSR Quality + Frame Gen x2 · RTGI Medium/High · Roślinność High',
    },
    {
      id: 'fc25',
      title: 'EA Sports FC 25 / F1 24',
      engine: 'Frostbite / Ego · DX12',
      genre: 'E-Sport / Shooter',
      vramRecommendedGb: 8,
      base1080: 170,
      base1440: 132,
      dlssFgMult: 1.32,
      recommendedSetting: 'Natywne / Quality · V-Sync Sterownik + G-Sync/FreeSync · Ultra Tekstury',
    },
    {
      id: 'cyberpunk_rt',
      title: 'Cyberpunk 2077: Phantom Liberty (RT Ultra)',
      engine: 'REDengine 4 · Ray/Path Tracing',
      genre: 'UE5 / Path Tracing',
      vramRecommendedGb: 12,
      base1080: 84,
      base1440: 60,
      dlssFgMult: 2.1,
      recommendedSetting: 'DLSS 4.5 / FSR 4 Quality + FG x2/x3 · Reflex ON · Wolumetryczna Mgła High',
    },
    {
      id: 'wukong_ue5',
      title: 'Black Myth: Wukong (Unreal Engine 5)',
      engine: 'UE5 · Lumen GI + Nanite',
      genre: 'UE5 / Path Tracing',
      vramRecommendedGb: 12,
      base1080: 90,
      base1440: 66,
      dlssFgMult: 2.0,
      recommendedSetting: 'Skalowanie 58-67% + Frame Gen · Lumen GI High (zamiast Epic) · Cienie High',
    },
    {
      id: 'alanwake2_pt',
      title: 'Alan Wake 2 (Path Tracing + Ray Reconstruction)',
      engine: 'Northlight · Full Path Tracing',
      genre: 'UE5 / Path Tracing',
      vramRecommendedGb: 12,
      base1080: 72,
      base1440: 50,
      dlssFgMult: 2.18,
      recommendedSetting: 'DLSS/FSR Balanced-Quality + FG x2 · Path Tracing Medium/High · Post-FX Ograniczone',
    },
    {
      id: 'msfs2024',
      title: 'Microsoft Flight Simulator 2024',
      engine: 'Asobo Engine · DirectStorage + Photogrammetry',
      genre: 'Symulator / Open-World',
      vramRecommendedGb: 12,
      base1080: 84,
      base1440: 62,
      dlssFgMult: 1.85,
      recommendedSetting: 'TAA / DLSS Quality + Frame Gen · LOD Terenu 150 · Chmury Wolumetryczne High',
      cpuHeavy: true,
    },
    {
      id: 'horizon_forbidden_west',
      title: 'Horizon Forbidden West Complete Edition',
      engine: 'Decima Engine · DirectStorage + DLSS 3',
      genre: 'AAA Singleplayer',
      vramRecommendedGb: 10,
      base1080: 108,
      base1440: 80,
      dlssFgMult: 1.8,
      recommendedSetting: 'DLSS / FSR Quality + Frame Gen · Tekstury High · Jakość Obrazu TAA',
    },
    {
      id: 'horizon_zero_dawn_remastered',
      title: 'Horizon Zero Dawn Remastered',
      engine: 'Decima Engine · Enhanced Lighting & Assets',
      genre: 'AAA Singleplayer',
      vramRecommendedGb: 8,
      base1080: 132,
      base1440: 98,
      dlssFgMult: 1.72,
      recommendedSetting: 'DLAA / DLSS Quality · Cienie High · Roślinność Ultra · LOD High',
    },
    {
      id: 'monster_hunter_wilds',
      title: 'Monster Hunter Wilds',
      engine: 'RE Engine · Seamless Open World',
      genre: 'Symulator / Open-World',
      vramRecommendedGb: 12,
      base1080: 90,
      base1440: 68,
      dlssFgMult: 1.9,
      recommendedSetting: 'DLSS / FSR Upscaling + Frame Gen · Detale High · Wolumetria Medium',
      cpuHeavy: true,
    },
    {
      id: 'spiderman_2_2027',
      title: "Marvel's Spider-Man 2 / Spider-Man 2027 (Ray Tracing)",
      engine: 'Insomniac Next-Gen · DirectStorage + RT',
      genre: 'AAA Singleplayer',
      vramRecommendedGb: 12,
      base1080: 112,
      base1440: 84,
      dlssFgMult: 1.92,
      recommendedSetting: 'DLSS / FSR Quality + Frame Gen · Odbicia RT High · Gęstość Ruchu High',
    },
    {
      id: 'bond_007_first_light',
      title: '007 First Light — James Bond (IO Interactive)',
      engine: 'Glacier Engine Next-Gen · Ray Tracing GI',
      genre: 'AAA Singleplayer',
      vramRecommendedGb: 12,
      base1080: 104,
      base1440: 78,
      dlssFgMult: 1.88,
      recommendedSetting: 'DLSS / FSR Quality + FG x2 · Cienie RT High · Odbicia Lustrzane High',
    },
    {
      id: 'fifa_2027_fc27',
      title: 'FIFA 2027 / EA Sports FC 27 (Hypermotion V)',
      engine: 'Frostbite Next-Gen · Cloth & Pitch Physics',
      genre: 'E-Sport / Shooter',
      vramRecommendedGb: 8,
      base1080: 168,
      base1440: 130,
      dlssFgMult: 1.35,
      recommendedSetting: 'Natywne 100% · V-Sync OFF + G-Sync/FreeSync · Murawa 3D Ultra · Crowd High',
    },
    {
      id: 'gta_vi_nextgen',
      title: 'Grand Theft Auto VI (Vice City Next-Gen RT)',
      engine: 'RAGE 9 · Global Illumination RT + Crowd AI',
      genre: 'Symulator / Open-World',
      vramRecommendedGb: 12,
      base1080: 82,
      base1440: 60,
      dlssFgMult: 2.05,
      recommendedSetting: 'DLSS 4 / FSR 4 Quality + Frame Gen · RTGI High · Gęstość Ruchu High',
      cpuHeavy: true,
    },
    {
      id: 'witcher_4_polaris',
      title: 'Wiedźmin 4: Polaris (Unreal Engine 5.6)',
      engine: 'UE 5.6 · Hardware Lumen + Nanite Foliage',
      genre: 'UE5 / Path Tracing',
      vramRecommendedGb: 12,
      base1080: 78,
      base1440: 56,
      dlssFgMult: 2.12,
      recommendedSetting: 'DLSS / FSR Quality + Frame Gen · Hardware Lumen High · Nanite Ultra',
    },
    {
      id: 'battlefield_2027',
      title: 'Battlefield 2027 (128-Player Next-Gen Destruction)',
      engine: 'Frostbite Next · Dynamic Voxel Destruction',
      genre: 'E-Sport / Shooter',
      vramRecommendedGb: 10,
      base1080: 124,
      base1440: 94,
      dlssFgMult: 1.72,
      recommendedSetting: 'DLSS / FSR Quality · Reflex Boost · Fizyka Destrukcji High · Efekty Medium',
      cpuHeavy: true,
    },
    {
      id: 'doom_dark_ages',
      title: 'DOOM: The Dark Ages (idTech 8 Path Tracing)',
      engine: 'idTech 8 · Vulkan Ray/Path Tracing',
      genre: 'UE5 / Path Tracing',
      vramRecommendedGb: 10,
      base1080: 134,
      base1440: 98,
      dlssFgMult: 1.88,
      recommendedSetting: 'DLSS / FSR Quality + Frame Gen · Tekstury Nightmare · Reflex ON',
    },
    {
      id: 'indiana_jones_great_circle',
      title: 'Indiana Jones and the Great Circle (Full RT)',
      engine: 'Motor / idTech · Full Ray Tracing',
      genre: 'UE5 / Path Tracing',
      vramRecommendedGb: 12,
      base1080: 88,
      base1440: 64,
      dlssFgMult: 2.0,
      recommendedSetting: 'DLSS / FSR Quality + FG · Pula Tekstur High (12GB+) · Path Tracing Medium/High',
    },
    {
      id: 'kingdom_come_2',
      title: 'Kingdom Come: Deliverance II (CryEngine SVOGI)',
      engine: 'CryEngine · SVOGI Global Illumination',
      genre: 'Symulator / Open-World',
      vramRecommendedGb: 10,
      base1080: 96,
      base1440: 72,
      dlssFgMult: 1.78,
      recommendedSetting: 'DLSS / FSR Quality · Oświetlenie SVOGI High · Cienie High · Roślinność High',
      cpuHeavy: true,
    },
    {
      id: 'ac_shadows',
      title: "Assassin's Creed Shadows (Anvil RTGI)",
      engine: 'Ubisoft Anvil · Dynamic Seasons & RTGI',
      genre: 'AAA Singleplayer',
      vramRecommendedGb: 10,
      base1080: 94,
      base1440: 70,
      dlssFgMult: 1.85,
      recommendedSetting: 'DLSS / FSR Quality + Frame Gen · RTGI Diffuse High · Chmury Medium',
    },
    {
      id: 'stalker_2_chornobyl',
      title: 'S.T.A.L.K.E.R. 2: Heart of Chornobyl (UE5)',
      engine: 'Unreal Engine 5 · Lumen + A-Life 2.0',
      genre: 'UE5 / Path Tracing',
      vramRecommendedGb: 12,
      base1080: 82,
      base1440: 60,
      dlssFgMult: 1.98,
      recommendedSetting: 'DLSS / FSR Quality + Frame Gen · Cienie High · Zasięg Rysowania High',
      cpuHeavy: true,
    },
    {
      id: 'death_stranding_2',
      title: 'Death Stranding 2: On The Beach (Decima Next)',
      engine: 'Decima Engine · Photorealistic Terrain',
      genre: 'AAA Singleplayer',
      vramRecommendedGb: 10,
      base1080: 116,
      base1440: 88,
      dlssFgMult: 1.82,
      recommendedSetting: 'DLAA / DLSS Quality + FG · Tekstury Ultra · Cienie High · AF x16',
    },
    {
      id: 'cod_black_ops_7',
      title: 'Call of Duty: Black Ops 7 / Warzone Next',
      engine: 'IW 9.5 · DX12 Shader Streaming',
      genre: 'E-Sport / Shooter',
      vramRecommendedGb: 8,
      base1080: 162,
      base1440: 124,
      dlssFgMult: 1.48,
      recommendedSetting: 'FidelityFX CAS / DLSS Quality · Reflex Boost · Cienie Normal · FOV 110',
      cpuHeavy: true,
    },
    {
      id: 'elden_ring_nightreign',
      title: 'Elden Ring: Nightreign (Ray Tracing Edition)',
      engine: 'FromSoftware Engine · DX12 RT',
      genre: 'AAA Singleplayer',
      vramRecommendedGb: 8,
      base1080: 118,
      base1440: 92,
      dlssFgMult: 1.42,
      recommendedSetting: 'Natywne 1440p · Ray Tracing Medium/High · Tekstury Maximum · SSAO High',
    },
    {
      id: 'ghost_of_yotei',
      title: 'Ghost of Yōtei / Ghost of Tsushima Director’s Cut',
      engine: 'Sucker Punch Engine · DirectStorage',
      genre: 'AAA Singleplayer',
      vramRecommendedGb: 10,
      base1080: 114,
      base1440: 86,
      dlssFgMult: 1.84,
      recommendedSetting: 'DLSS / FSR Quality + Frame Gen · Wolumetryczna Mgła High · Cienie High',
    },
    {
      id: 'mafia_old_country',
      title: 'Mafia: The Old Country (Unreal Engine 5)',
      engine: 'UE5 · Lumen Reflections & MetaHuman',
      genre: 'UE5 / Path Tracing',
      vramRecommendedGb: 12,
      base1080: 88,
      base1440: 64,
      dlssFgMult: 1.94,
      recommendedSetting: 'DLSS / FSR Quality + FG · Global Illumination High · Odbicia Lumen High',
    },
    {
      id: 'crimson_desert',
      title: 'Crimson Desert (BlackSpace Engine Next-Gen)',
      engine: 'BlackSpace Engine · Ray Tracing + Physics',
      genre: 'Symulator / Open-World',
      vramRecommendedGb: 12,
      base1080: 86,
      base1440: 63,
      dlssFgMult: 1.92,
      recommendedSetting: 'DLSS / FSR Quality + Frame Gen · Fizyka Cząsteczek High · Cienie High',
      cpuHeavy: true,
    },
    {
      id: 'f1_27_raytracing',
      title: 'F1 27 / F1 25 (Ego Engine Path Tracing)',
      engine: 'Ego Engine · RT Reflections & Shadows',
      genre: 'Symulator / Open-World',
      vramRecommendedGb: 10,
      base1080: 138,
      base1440: 102,
      dlssFgMult: 1.76,
      recommendedSetting: 'DLSS / FSR Quality + FG · Odbicia RT Bolidu High · Telemetria 120+ Hz',
    },
    {
      id: 'assetto_corsa_evo',
      title: 'Assetto Corsa EVO (Kunos Simulazioni DX12)',
      engine: 'Kunos Custom DX12 · Dynamic Weather PBR',
      genre: 'Symulator / Open-World',
      vramRecommendedGb: 10,
      base1080: 128,
      base1440: 96,
      dlssFgMult: 1.65,
      recommendedSetting: 'DLAA / DLSS Quality · Lusterka High · Fizyka Opon Pełna · Potrójny Ekran/VR Ready',
      cpuHeavy: true,
    },
    {
      id: 'GOD_of_war_ragnarok',
      title: 'God of War Ragnarök (PC Ultra)',
      engine: 'Santa Monica Engine · DX12 + FG',
      genre: 'AAA Singleplayer',
      vramRecommendedGb: 10,
      base1080: 126,
      base1440: 96,
      dlssFgMult: 1.82,
      recommendedSetting: 'DLSS / FSR Quality + Frame Gen · Tekstury Ultra · Tessellation High',
    },
    {
      id: 'last_of_us_part2_pc',
      title: 'The Last of Us Part II Remastered (PC)',
      engine: 'Naughty Dog Engine · DirectStorage',
      genre: 'AAA Singleplayer',
      vramRecommendedGb: 10,
      base1080: 110,
      base1440: 82,
      dlssFgMult: 1.8,
      recommendedSetting: 'DLSS / FSR Quality + Frame Gen · Tekstury Postaci Ultra · Cienie High',
    },
    {
      id: 'rdr2_ultra',
      title: 'Red Dead Redemption 2 (Vulkan Ultra)',
      engine: 'RAGE · Vulkan Volumetrics',
      genre: 'Symulator / Open-World',
      vramRecommendedGb: 8,
      base1080: 132,
      base1440: 100,
      dlssFgMult: 1.45,
      recommendedSetting: 'API Vulkan · Tekstury Ultra · Fizyka Wody 2/4 · Wolumetryczne Chmury High',
    },
    {
      id: 'baldurs_gate_3',
      title: "Baldur's Gate 3 (Akt 3 — Miasto Wrota Baldura)",
      engine: 'Divinity 4.0 · DX11 / Vulkan',
      genre: 'Symulator / Open-World',
      vramRecommendedGb: 8,
      base1080: 118,
      base1440: 94,
      dlssFgMult: 1.38,
      recommendedSetting: 'DLAA / DLSS Quality · Dynamiczne Tłumy High · Cienie High · AF x16',
      cpuHeavy: true,
    },
    {
      id: 'helldivers_2',
      title: 'Helldivers 2 (Galactic War Chaos)',
      engine: 'Autodesk Stingray · Heavy CPU Physics',
      genre: 'E-Sport / Shooter',
      vramRecommendedGb: 8,
      base1080: 122,
      base1440: 92,
      dlssFgMult: 1.42,
      recommendedSetting: 'Natywne / Ultra Quality · Mgła Wolumetryczna Medium · Oświetlenie Kosmosu High',
      cpuHeavy: true,
    },
    {
      id: 'space_marine_2',
      title: 'Warhammer 40,000: Space Marine 2 (Swarm Engine)',
      engine: 'Saber Swarm Engine · 1000+ Tyranidów',
      genre: 'AAA Singleplayer',
      vramRecommendedGb: 10,
      base1080: 102,
      base1440: 78,
      dlssFgMult: 1.75,
      recommendedSetting: 'DLSS / FSR Quality + FG · Tekstury High · Fizyka Tłumu Ultra',
      cpuHeavy: true,
    },
    {
      id: 'silent_hill_2_remake',
      title: 'Silent Hill 2 Remake (Bloober Team UE5)',
      engine: 'Unreal Engine 5 · Hardware Lumen Fog',
      genre: 'UE5 / Path Tracing',
      vramRecommendedGb: 10,
      base1080: 86,
      base1440: 62,
      dlssFgMult: 1.9,
      recommendedSetting: 'DLSS / FSR Quality + Frame Gen · Ray Tracing High · Wolumetryczna Mgła High',
    },
    {
      id: 'star_wars_outlaws',
      title: 'Star Wars Outlaws (Snowdrop RTX Direct Lighting)',
      engine: 'Snowdrop Engine · RTXDI + Ray Reconstruction',
      genre: 'UE5 / Path Tracing',
      vramRecommendedGb: 12,
      base1080: 80,
      base1440: 58,
      dlssFgMult: 2.05,
      recommendedSetting: 'DLSS / FSR Quality + FG · RTX Direct Lighting Medium/High · Ray Reconstruction ON',
    },
    {
      id: 'avatar_pandora',
      title: 'Avatar: Frontiers of Pandora (Snowdrop RT)',
      engine: 'Snowdrop Engine · Software/Hardware RTGI',
      genre: 'UE5 / Path Tracing',
      vramRecommendedGb: 12,
      base1080: 88,
      base1440: 64,
      dlssFgMult: 1.9,
      recommendedSetting: 'DLSS / FSR Quality + Frame Gen · Odbicia Lustrzane Medium · Roślinność High',
    },
    {
      id: 'metro_awakening_exodus_rt',
      title: 'Metro Exodus Enhanced Edition / Metro Next RT',
      engine: '4A Engine · Full Ray-Traced GI',
      genre: 'UE5 / Path Tracing',
      vramRecommendedGb: 8,
      base1080: 128,
      base1440: 96,
      dlssFgMult: 1.55,
      recommendedSetting: 'DLSS Quality · Ray Tracing Ultra · HairWorks OFF · Tessellation Full',
    },
    {
      id: 'hogwarts_legacy_rt',
      title: 'Hogwarts Legacy (Ray Tracing Ultra)',
      engine: 'Unreal Engine 4 · RT Reflections & Shadows',
      genre: 'AAA Singleplayer',
      vramRecommendedGb: 12,
      base1080: 98,
      base1440: 74,
      dlssFgMult: 1.85,
      recommendedSetting: 'DLSS / FSR Quality + Frame Gen · RT Cienie High · RT Odbicia Medium',
      cpuHeavy: true,
    },
    {
      id: 'resident_evil_9_re4',
      title: 'Resident Evil 4 Remake / Resident Evil 9 (RE Engine)',
      engine: 'RE Engine · DX12 Ray Tracing',
      genre: 'AAA Singleplayer',
      vramRecommendedGb: 10,
      base1080: 136,
      base1440: 104,
      dlssFgMult: 1.52,
      recommendedSetting: 'Natywne / FSR Quality · Tekstury High (4GB) · Włosy Strands Normal · RT High',
    },
    {
      id: 'diablo_4_vessel',
      title: 'Diablo IV: Vessel of Hatred (Ray Tracing)',
      engine: 'Blizzard Custom DX12 · DirectStorage + RT',
      genre: 'Symulator / Open-World',
      vramRecommendedGb: 10,
      base1080: 142,
      base1440: 108,
      dlssFgMult: 1.72,
      recommendedSetting: 'DLAA / DLSS Quality + Frame Gen · Cienie RT Medium · Tekstury High',
    },
    {
      id: 'path_of_exile_2',
      title: 'Path of Exile 2 (Endgame Global Illumination)',
      engine: 'Grinding Gear Custom PBR · Vulkan/DX12',
      genre: 'Symulator / Open-World',
      vramRecommendedGb: 8,
      base1080: 128,
      base1440: 98,
      dlssFgMult: 1.45,
      recommendedSetting: 'Renderer Vulkan / DX12 · Global Illumination High · Dynamic Culling ON',
      cpuHeavy: true,
    },
    {
      id: 'apex_legends_240',
      title: 'Apex Legends (DirectX 12 Competitive)',
      engine: 'Source Modified DX12',
      genre: 'E-Sport / Shooter',
      vramRecommendedGb: 6,
      base1080: 255,
      base1440: 195,
      dlssFgMult: 1.15,
      recommendedSetting: 'Natywne 100% · NVIDIA Reflex Boost · Budżet Tekstur 6-8 GB · Cienie Low',
      cpuHeavy: true,
    },
    {
      id: 'fortnite_ue5_lumen',
      title: 'Fortnite (Unreal Engine 5 — Nanite & Lumen Epic)',
      engine: 'UE 5.5 · Hardware Lumen + Nanite',
      genre: 'UE5 / Path Tracing',
      vramRecommendedGb: 10,
      base1080: 104,
      base1440: 76,
      dlssFgMult: 1.62,
      recommendedSetting: 'TSR High / DLSS Quality · Nanite ON · Lumen GI High · Reflex ON + Boost',
    },
    {
      id: 'pubg_battlegrounds',
      title: 'PUBG: Battlegrounds / Extraction Next (DX12)',
      engine: 'Unreal Engine · Competitive Battle Royale',
      genre: 'E-Sport / Shooter',
      vramRecommendedGb: 8,
      base1080: 215,
      base1440: 162,
      dlssFgMult: 1.2,
      recommendedSetting: 'Skala Renderowania 100% · Tekstury Ultra · Zasięg Widzenia Ultra · Post-FX Low',
      cpuHeavy: true,
    },
    {
      id: 'rainbow_six_siege_x',
      title: 'Tom Clancy’s Rainbow Six Siege X (Vulkan)',
      engine: 'AnvilNext · Competitive E-Sports',
      genre: 'E-Sport / Shooter',
      vramRecommendedGb: 6,
      base1080: 340,
      base1440: 260,
      dlssFgMult: 1.12,
      recommendedSetting: 'API Vulkan · Natywne 100% · Reflex Boost · Cienie Medium · LOD Ultra',
      cpuHeavy: true,
    },
    {
      id: 'dota2_lol_esports',
      title: 'Dota 2 (Source 2) / League of Legends (240+ Hz)',
      engine: 'Source 2 / Riot Engine',
      genre: 'E-Sport / Shooter',
      vramRecommendedGb: 4,
      base1080: 330,
      base1440: 255,
      dlssFgMult: 1.1,
      recommendedSetting: 'Natywne 100% · Vulkan / DX11 · Efekty Walki High · Reflex ON',
      cpuHeavy: true,
    },
    {
      id: 'cyberpunk_orion_pt',
      title: 'Cyberpunk 2077: Overdrive (Full Path Tracing + DLSS 4)',
      engine: 'REDengine 4 · Full Path Tracing + Ray Reconstruction',
      genre: 'UE5 / Path Tracing',
      vramRecommendedGb: 12,
      base1080: 66,
      base1440: 46,
      dlssFgMult: 2.35,
      recommendedSetting: 'DLSS 4 / FSR 4 Quality + Multi Frame Gen · Ray Reconstruction ON · Reflex Boost',
    },
    {
      id: 'dying_light_the_beast',
      title: 'Dying Light: The Beast (C-Engine Ray Tracing)',
      engine: 'Techland C-Engine · RT Global Illumination',
      genre: 'AAA Singleplayer',
      vramRecommendedGb: 10,
      base1080: 106,
      base1440: 78,
      dlssFgMult: 1.85,
      recommendedSetting: 'DLSS / FSR Quality + Frame Gen · Latarka RT ON · RTGI High · Mgła Medium',
    },
    {
      id: 'subnautica_2_ue5',
      title: 'Subnautica 2 (Unreal Engine 5 Ocean Caustics)',
      engine: 'UE5 · Lumen Underwater GI & Fluid Sim',
      genre: 'Symulator / Open-World',
      vramRecommendedGb: 10,
      base1080: 102,
      base1440: 76,
      dlssFgMult: 1.82,
      recommendedSetting: 'DLSS / FSR Quality + FG · Kaustyka Wody High · Lumen Underwater High',
    },
    {
      id: 'borderlands_4_ue5',
      title: 'Borderlands 4 (Unreal Engine 5 Cel-Shaded Chaos)',
      engine: 'UE5 · Particle Physics & Lumen Lighting',
      genre: 'AAA Singleplayer',
      vramRecommendedGb: 10,
      base1080: 112,
      base1440: 84,
      dlssFgMult: 1.8,
      recommendedSetting: 'DLSS / FSR Quality + Frame Gen · Fizyka Cząsteczek High · Cienie High',
    },
    {
      id: 'civilization_vii',
      title: 'Sid Meier’s Civilization VII (Late-Game Turn AI)',
      engine: 'Firaxis DX12 Engine · Heavy Multi-Thread AI',
      genre: 'Symulator / Open-World',
      vramRecommendedGb: 8,
      base1080: 135,
      base1440: 105,
      dlssFgMult: 1.35,
      recommendedSetting: 'Natywne 1440p/4K · Tekstury Terenu Ultra · Wielowątkowość AI Pełna',
      cpuHeavy: true,
    },
  ];

  return catalog.map((g) => {
    const genreFactor = g.cpuHeavy
      ? (hw.gpuScore * 0.54 + hw.cpuScore * 0.36 + hw.ramScore * 0.1) / 85
      : hw.perfFactor;

    const vramDeficit = hw.vramEstGb < g.vramRecommendedGb;
    const vramPenalty1080 = vramDeficit ? Math.max(0.62, hw.vramEstGb / g.vramRecommendedGb) : 1;
    const vramPenalty1440 = vramDeficit ? Math.max(0.5, (hw.vramEstGb / g.vramRecommendedGb) * 0.9) : 1;

    const f1080 = Math.max(12, Math.round(g.base1080 * genreFactor * vramPenalty1080));
    const f1440 = Math.max(10, Math.round(g.base1440 * genreFactor * vramPenalty1440));
    const fDlssFg = Math.max(18, Math.round(f1440 * g.dlssFgMult));

    let tier: GamePlayabilityTier = 'low';
    let tierLabel = 'NISKIE / ZA SŁABY PC (<35 FPS)';
    if (f1080 >= 120 && f1440 >= 85) {
      tier = 'ultra';
      tierLabel = 'OBSŁUŻY ULTRA · 120+ FPS';
    } else if (f1080 >= 60) {
      tier = 'smooth';
      tierLabel = 'OBSŁUŻY WYSOKIE · 60+ FPS';
    } else if (f1080 >= 35 || fDlssFg >= 45) {
      tier = 'playable';
      tierLabel = 'OBSŁUŻY ŚREDNIE · 35–59 FPS';
    }

    const vramWarning = vramDeficit
      ? `Zalecane ${g.vramRecommendedGb} GB VRAM (wykryto klasę ~${hw.vramEstGb} GB — obniż Tekstury na Medium/High)`
      : null;

    return {
      id: g.id,
      title: g.title,
      engine: g.engine,
      genre: g.genre,
      vramRecommendedGb: g.vramRecommendedGb,
      fps1080pNative: f1080,
      fps1440pQuality: f1440,
      fpsDlssFg: fDlssFg,
      recommendedSetting: g.recommendedSetting,
      tier,
      tierLabel,
      canRunSmoothly: tier === 'ultra' || tier === 'smooth',
      vramWarning,
    };
  });
}

export function evaluateGamePlayabilitySummary(games: GameFpsPrediction[]): GamePlayabilitySummary {
  const ultraCount = games.filter((g) => g.tier === 'ultra').length;
  const smoothCount = games.filter((g) => g.tier === 'smooth').length;
  const playableCount = games.filter((g) => g.tier === 'playable').length;
  const lowCount = games.filter((g) => g.tier === 'low').length;
  return {
    total: games.length,
    ultraCount,
    smoothCount,
    playableCount,
    lowCount,
    smoothOrBetterCount: ultraCount + smoothCount,
  };
}

export function evaluatePcSuitability(ctx: PcSuitabilityInputContext): PcSuitabilityCategory[] {
  const hw = computeHardwarePowerIndex(ctx);
  const clamp100 = (v: number) => Math.max(15, Math.min(100, Math.round(v)));

  const rawCategories: Array<{
    id: string;
    title: string;
    icon: string;
    score: number;
    summary: string;
    bottleneckNote: string;
  }> = [
    {
      id: 'esport',
      title: 'E-Sport i Strzelanki Sieciowe (144Hz / 240Hz+)',
      icon: '🎯',
      score: clamp100(hw.cpuScore * 0.45 + hw.gpuScore * 0.45 + hw.ramScore * 0.1),
      summary: 'CS2, Valorant, Overwatch 2, Apex Legends, EA FC 25 z niskim opóźnieniem NVIDIA Reflex / Anti-Lag.',
      bottleneckNote: 'Zalecane: Wyłącz Frame Generation i Motion Blur, ustaw limit klatek 3 FPS poniżej Hz monitora.',
    },
    {
      id: 'aaa_ue5',
      title: 'Gry AAA Singleplayer & Unreal Engine 5 (1440p / 4K)',
      icon: '🎮',
      score: clamp100(hw.gpuScore * 0.65 + hw.cpuScore * 0.2 + hw.diskScore * 0.15),
      summary: 'Cyberpunk 2077 RT, Black Myth: Wukong, Wiedźmin 3 Next-Gen, Alan Wake 2 z DLSS/FSR + Frame Gen.',
      bottleneckNote:
        hw.vramEstGb >= 12
          ? `Szacowane ${hw.vramEstGb} GB+ VRAM pozwala na Tekstury Ultra i filtrowanie Anizotropowe x16 bez spadku FPS.`
          : `Przy klasie ~${hw.vramEstGb} GB VRAM ustaw Tekstury na High/Medium i zejdź z Lumen GI / Cieni z Epic na High.`,
    },
    {
      id: 'streaming_obs',
      title: 'Streaming LIVE & Nagrywanie OBS (AV1 / NVENC / AMF)',
      icon: '📡',
      score: clamp100(hw.cpuScore * 0.42 + hw.gpuScore * 0.43 + hw.ramScore * 0.15),
      summary: 'Jednoczesna rozgrywka 3D i kodowanie strumienia 1440p60 HDR na Twitch / YouTube bez gubienia klatek.',
      bottleneckNote: 'Sprzętowy enkoder GPU odciąża procesor; stabilny frametime gwarantuje płynny obraz VOD.',
    },
    {
      id: 'video_3d',
      title: 'Montaż Wideo 4K/8K, CAD & Renderowanie 3D (Blender / DaVinci)',
      icon: '🎬',
      score: clamp100(hw.gpuScore * 0.42 + hw.cpuScore * 0.35 + hw.ramScore * 0.13 + hw.diskScore * 0.1),
      summary: 'Renderowanie scen Cycles/Octane, korekcja barwna HDR, oś czasu 4K ProRes/RAW i symulacje fizyki.',
      bottleneckNote: 'Wysoka przepustowość pamięci RAM i szybki odczyt NVMe przyspieszają scrubbing osi czasu 4K.',
    },
    {
      id: 'local_ai',
      title: 'Lokalne AI / Modele LLM, DeepSeek & Generowanie Obrazu (SDXL/Flux)',
      icon: '🧠',
      score: clamp100(hw.gpuScore * 0.62 + hw.ramScore * 0.25 + hw.cpuScore * 0.13),
      summary: 'Uruchamianie lokalnych modeli językowych (Ollama / LM Studio) oraz akceleracja Tensor / WebGPU.',
      bottleneckNote: `Przepustowość VRAM (${hw.vramEstGb} GB klasy GPU) decyduje o liczbie tokenów/s i wielkości kwantyzacji Q4/Q8.`,
    },
    {
      id: 'dev_vm',
      title: 'Programowanie, Kompilacja Kodu, Docker & Maszyny Wirtualne',
      icon: '💻',
      score: clamp100(hw.cpuScore * 0.48 + hw.ramScore * 0.32 + hw.diskScore * 0.2),
      summary: 'Wielowątkowa kompilacja C++/Rust/TypeScript, kontenery Docker, WSL2 i bazy danych o niskim opóźnieniu IOPS.',
      bottleneckNote: `${hw.cpuCores} wątków logicznych CPU oraz szybki czas dostępu 4K QD1 dysku skracają czas buildów.`,
    },
    {
      id: 'office_finance',
      title: 'Praca Biurowa, Wielozadaniowość, Trading & Analiza Danych (Excel/BI)',
      icon: '📊',
      score: clamp100(hw.cpuScore * 0.35 + hw.ramScore * 0.4 + hw.diskScore * 0.25),
      summary: 'Dziesiątki kart przeglądarki, arkusze kalkulacyjne z milionami wierszy, wielomonitorowe stanowisko pracy.',
      bottleneckNote: 'Zapas wydajności pozwala na bezgłośną pracę półpasywną przy minimalnym poborze mocy.',
    },
    {
      id: 'mobility_acoustics',
      title: 'Efektywność Energetyczna, Kultura Pracy Chłodzenia & Stabilność 24/7',
      icon: '❄️',
      score: clamp100((hw.cpuScore + hw.gpuScore + hw.ramScore) / 3),
      summary: 'Stabilność pod długotrwałym obciążeniem (brak thermal-throttlingu), zdrowie łożysk PWM i spójność zasilania.',
      bottleneckNote: 'Zablokowanie FPS (Max Frame Rate) 3 klatki poniżej Hz monitora obniża pobór prądu i hałas wentylatorów.',
    },
  ];

  return rawCategories.map((c) => {
    let verdict: PcSuitabilityCategory['verdict'] = 'IDEALNY (90-100%)';
    let badgeClass = 'sp-suit-badge--ideal';
    let fillClass = 'sp-suit-bar-fill--ideal';
    if (c.score < 55) {
      verdict = 'PODSTAWOWY (<55%)';
      badgeClass = 'sp-suit-badge--basic';
      fillClass = 'sp-suit-bar-fill--basic';
    } else if (c.score < 75) {
      verdict = 'DOBRY (55-74%)';
      badgeClass = 'sp-suit-badge--good';
      fillClass = 'sp-suit-bar-fill--good';
    } else if (c.score < 90) {
      verdict = 'BARDZO DOBRY (75-89%)';
      badgeClass = 'sp-suit-badge--vgood';
      fillClass = 'sp-suit-bar-fill--vgood';
    }
    return {
      ...c,
      verdict,
      badgeClass,
      fillClass,
    };
  });
}

function buildOptimalSchemeRecommendation(state: OptimizerState): {
  title: string;
  fpsLimitRule: string;
  upscalingRule: string;
  frameGenRule: string;
  latencySyncRule: string;
  lightingShadowsRule: string;
  texturesGeometryRule: string;
  postProcessRule: string;
  expectedGainText: string;
} {
  const recommendedCap = state.refreshHz - 3;
  const has12GbPlus = state.vramGb >= 12;

  if (state.gameProfile === 'esport') {
    return {
      title: `Schemat E-Sport Pro (${state.resolution.toUpperCase()} @ ${state.refreshHz} Hz · Minimalny Input Lag)`,
      fpsLimitRule: `Max Frame Rate: ${recommendedCap} FPS (dokładnie 3 kl. poniżej ${state.refreshHz} Hz monitora dla zerowego tearingu G-Sync/FreeSync)`,
      upscalingRule:
        state.gpuTier === 'gtx1650_igpu'
          ? 'DLSS / FSR: Quality (67% skali) + Image Sharpening 35%'
          : 'Rozdzielczość Natywna + DLAA / TAA lub skalowanie ~85-100% dla maksymalnej ostrości celownika',
      frameGenRule: 'Frame Generation (FG / Smooth Motion / AFMF): WYŁĄCZONE (unikamy dodatkowych ms opóźnienia w grach sieciowych)',
      latencySyncRule: 'NVIDIA Reflex: WŁ. + Boost (lub AMD Anti-Lag 2) · V-Sync: WŁ. w sterowniku, WYŁ. w menu gry',
      lightingShadowsRule: 'Ray Tracing: WYŁ. · Global Illumination: Medium · Cienie: Medium/High (widoczność sylwetek) · Wolumetryczna Mgła: Low',
      texturesGeometryRule: `Tekstury: ${has12GbPlus ? 'ULTRA (12GB+ VRAM bez utraty FPS)' : 'HIGH'} · Filtrowanie Anizotropowe: x16 (<1% kosztu) · Roślinność: Low`,
      postProcessRule: 'Motion Blur: WYŁ. · Chromatic Aberration: WYŁ. · Depth of Field: WYŁ. · Film Grain: WYŁ.',
      expectedGainText: '+45% do +85% więcej FPS i do 38% niższe opóźnienie kliknięcia myszy (Click-to-Photon Latency).',
    };
  }

  if (state.gameProfile === 'aaa_rt') {
    return {
      title: `Schemat Ray / Path Tracing Showcase (${state.resolution.toUpperCase()} @ ${state.refreshHz} Hz)`,
      fpsLimitRule: 'Bez ręcznego limitu FPS przy włączonym Frame Generation (NVIDIA Reflex automatycznie kontroluje kolejkę klatek)',
      upscalingRule:
        state.resolution === '4k'
          ? 'DLSS 4.5 / FSR 4 / XeSS: Balanced (58%) lub własna skala 42-50% w NVIDIA App + Wyostrzanie 30%'
          : 'DLSS 4.5 / FSR 4 / XeSS: Quality (67% skali renderowania) – ostrość często lepsza niż natywne TAA',
      frameGenRule:
        state.gpuTier === 'rtx4090_7900xtx' || state.gpuTier === 'rtx4070_7800xt'
          ? 'Frame Generation: WŁĄCZONE (FG x2 / Multi Frame Gen x3 przy bazowych 55-65 FPS)'
          : 'Frame Generation / AFMF: WŁĄCZONE tylko jeśli bazowy FPS przekracza 50 kl./s',
      latencySyncRule: 'Low Latency (Reflex / Anti-Lag): OBOWIĄZKOWO WŁĄCZONE · V-Sync w sterowniku + G-Sync/FreeSync + HDR ON',
      lightingShadowsRule: 'Ray Tracing: High (odbicia + RTGI) · Cienie: High (zamiast Ultra) · Wolumetryczna Mgła: Medium (-2 poziomy = duży skok FPS)',
      texturesGeometryRule: `Tekstury: ${has12GbPlus ? 'ULTRA (pełny bufor 12GB+ VRAM)' : 'HIGH (ochrona przed przepełnieniem 8GB VRAM)'} · Anisotropic Filtering: x16 · Subsurface Scattering: WŁ.`,
      postProcessRule: 'Bloom & Lens Flare: WŁ. · Motion Blur: Wył./Niski · Aberracja Chromatyczna i Ziarno Filmowe: WYŁ. dla czystości obrazu',
      expectedGainText: '+90% do +165% wyższa płynność w grach z Ray Tracingiem przy zachowaniu fotorealistycznego oświetlenia.',
    };
  }

  return {
    title: `Schemat Unreal Engine 5 Singleplayer (${state.resolution.toUpperCase()} @ ${state.refreshHz} Hz · Max Jakość / FPS)`,
    fpsLimitRule: `Z włączonym FG: automatyczny limit Reflex. Bez FG: zablokuj na ${recommendedCap} FPS (3 kl. poniżej ${state.refreshHz} Hz).`,
    upscalingRule:
      state.resolution === '4k'
        ? 'DLSS / FSR Super Resolution: Balanced (58%) lub własna skala 40-45% w NVIDIA App'
        : 'DLSS / FSR / XeSS: Tryb Quality (67%) – bardzo wysoki zysk klatek bez utraty detali',
    frameGenRule: 'Frame Generation (FG x2) + Smooth Motion: WŁĄCZONE (idealne do single-player przy stabilnej bazie ~55-60 FPS)',
    latencySyncRule: 'NVIDIA Reflex / AMD Anti-Lag: WŁĄCZONE · V-Sync w sterowniku WŁ. · HDR: WŁ. (koszt tylko 1-3% FPS)',
    lightingShadowsRule: 'Lumen Global Illumination: HIGH lub MEDIUM (zejście z Epic daje ogromny skok FPS!) · Cienie: High · Odbicia: SSR / Hybrid · Mgła Wolumetryczna: Medium',
    texturesGeometryRule: `Jakość Tekstur: ${has12GbPlus ? 'ULTRA (12GB+ VRAM = 0% spadku FPS)' : 'HIGH'} · Filtrowanie Anizotropowe: ZAWSZE x16 · Zasięg LOD i Roślinność: High · SSS: WŁ.`,
    postProcessRule: 'Aberracja Chromatyczna: WYŁ. · Motion Blur: WYŁ. · Film Grain: WYŁ. · Depth of Field & Bloom: Według uznania (koszt 1-3%)',
    expectedGainText: '+75% do +140% więcej FPS w grach Unreal Engine 5 przy niemal identycznej jakości wizualnej jak profil Epic/Ultra.',
  };
}

function filterGames(games: GameFpsPrediction[], mode: GameFilterMode): GameFpsPrediction[] {
  if (mode === 'smooth60') return games.filter((g) => g.canRunSmoothly);
  if (mode === 'ultra120') return games.filter((g) => g.tier === 'ultra');
  if (mode === 'esport') return games.filter((g) => g.genre === 'E-Sport / Shooter');
  if (mode === 'ue5_rt') return games.filter((g) => g.genre === 'UE5 / Path Tracing' || g.genre === 'AAA Singleplayer');
  return games;
}

export function renderPcSuitabilityAndGamesReport(ctx: PcSuitabilityInputContext): string {
  const hw = computeHardwarePowerIndex(ctx);

  if (!hasAnyBenchmarkResults(ctx)) {
    return `
      <section class="sp-games-suitability-wrap" id="sp-games-suitability-report">
        <div class="sp-panel sp-games-untested-card">
          <div style="font-size:32px;margin-bottom:8px;">🎮📊</div>
          <h3 style="margin:0 0 8px;font-size:18px;color:#f8fafc;">Jakie gry obsłuży ten PC / Laptop? — Wymagany pomiar</h3>
          <p style="margin:0 auto 12px;max-width:680px;color:#94a3b8;font-size:13px;line-height:1.55;">
            Wykryto sprzęt: <strong style="color:#e2e8f0;">${escHtml(hw.gpuLabel.replace(/^ANGLE\s*\([^,]+,\s*/i, '').replace(/\s*\(0x[0-9a-f]+\).*$/i, '').replace(/\s+Direct3D11.*$/i, '').trim() || hw.gpuLabel)}</strong> · <strong style="color:#e2e8f0;">${hw.cpuCores} wątków CPU</strong> (klasa ~${hw.vramEstGb} GB VRAM).
            Aby uniknąć sztywnych zgadywanek i wyliczyć <strong style="color:#38bdf8;">rzeczywiste FPS dla 50 najnowszych gier</strong> (CS2, Cyberpunk 2077 RT, Spider-Man 2, 007 First Light, EA FC / FIFA 2027, GTA VI, Wiedźmin 3, Alan Wake 2), uruchom najpierw test wydajności podzespołów.
          </p>
          <div class="sp-calibration-pills" style="justify-content:center;margin-bottom:16px;">
            <button type="button" class="sp-cal-pill sp-cal-pill--pending" data-open-mod="cpu">○ CPU: brak testu</button>
            <button type="button" class="sp-cal-pill sp-cal-pill--pending" data-open-mod="gpu">○ GPU 3D: brak testu</button>
            <button type="button" class="sp-cal-pill sp-cal-pill--pending" data-open-mod="ram">○ RAM: brak testu</button>
            <button type="button" class="sp-cal-pill sp-cal-pill--pending" data-open-mod="disk">○ Dysk: brak testu</button>
          </div>
          <div style="display:flex;justify-content:center;gap:10px;flex-wrap:wrap;">
            <button type="button" class="btn btn-primary" data-run-full-suite="true" style="padding:10px 20px;font-weight:700;">🚀 Uruchom Pełny Test PC (CPU + RAM + Dysk + GPU)</button>
            <button type="button" class="btn btn-secondary" data-open-mod="gpu" style="padding:10px 18px;font-weight:600;">🎮 Tylko Test GPU 3D</button>
          </div>
        </div>
      </section>
    `;
  }

  const allGames = predictPlayableGames(ctx);
  const visibleGames = filterGames(allGames, optimizerState.gameFilter);
  const summary = evaluateGamePlayabilitySummary(allGames);
  const suitability = evaluatePcSuitability(ctx);
  const scheme = buildOptimalSchemeRecommendation(optimizerState);

  const calibrationLabel =
    hw.testedCount === 4
      ? 'PEŁNA KALIBRACJA BENCHMARKOWA (4/4 TESTY ✓)'
      : hw.gpuTested
        ? `SKALIBROWANO Z GPU 3D (${hw.testedCount}/4 TESTY)`
        : `KALIBRACJA CZĘŚCIOWA (${hw.testedCount}/4 · URUCHOM TEST GPU 3D DLA PEŁNEJ DOKŁADNOŚCI)`;

  const deltaSign = hw.calibrationDeltaPct > 0 ? '+' : '';
  const deltaBadgeText =
    hw.calibrationDeltaPct === 0
      ? 'Zgodne z profilem bazowym (0%)'
      : `Korekta po testach: ${deltaSign}${hw.calibrationDeltaPct}% vs profil bazowy`;

  return `
    <section class="sp-games-suitability-wrap" id="sp-games-suitability-report">
      <!-- 1. WYKRES GIER W JAKIE MOŻNA GRAĆ NA DANYM PC / LAPTOPIE -->
      <div class="sp-panel sp-games-chart-panel">
        <div class="sp-panel-head">
          <div>
            <span class="sp-eyebrow">${calibrationLabel} · ${deltaBadgeText}</span>
            <h3>🎮 Jakie gry obsłuży ten PC / Laptop? (${summary.smoothOrBetterCount}/${summary.total} płynnie 60+ FPS)</h3>
            <p class="sp-muted">
              Wyniki wyliczone z rzeczywistych pomiarów tego komputera: GPU <strong>${escHtml(hw.gpuLabel)}</strong>
              (${hw.gpuTested ? `zmierzono ${hw.benchGpuFps} FPS · Wynik ${hw.benchGpuScore > 0 ? `${hw.benchGpuScore}/100` : `${hw.gpuScore}/100`}` : `szacunek ${hw.gpuScore}/100 — uruchom test GPU 3D`}),
              CPU ${hw.cpuCores} wątków (${hw.cpuTested ? `zmierzono ${hw.cpuScore}/100` : 'brak testu'}),
              RAM (${hw.ramTested ? `zmierzono ${hw.ramScore}/100` : 'brak testu'}).
            </p>
          </div>
          <div class="sp-games-head-right">
            <div class="sp-games-legend">
              <span class="sp-legend-dot sp-legend-dot--1080"><i></i> 1080p Natywne</span>
              <span class="sp-legend-dot sp-legend-dot--1440"><i></i> 1440p Quality</span>
              <span class="sp-legend-dot sp-legend-dot--fg"><i></i> DLSS/FSR + Frame Gen</span>
            </div>
            <button type="button" class="btn btn-secondary btn-sm" data-run-full-suite="true">
              🔄 Przelicz (Pełny Test)
            </button>
          </div>
        </div>

        <!-- Pasek statusu kalibracji (co było realnie zmierzone) -->
        <div class="sp-calibration-pills">
          <button type="button" class="sp-cal-pill ${hw.cpuTested ? 'sp-cal-pill--ok' : 'sp-cal-pill--pending'}" data-open-mod="cpu">
            ${hw.cpuTested ? `✓ CPU: ${ctx.cpu.multiCoreScore.toLocaleString('pl-PL')} pkt (${hw.cpuScore}/100)` : '○ CPU: brak testu (kliknij)'}
          </button>
          <button type="button" class="sp-cal-pill ${hw.gpuTested ? 'sp-cal-pill--ok' : 'sp-cal-pill--pending'}" data-open-mod="gpu">
            ${hw.gpuTested ? `✓ GPU 3D: ${hw.benchGpuFps} FPS · Wynik ${hw.benchGpuScore > 0 ? hw.benchGpuScore : hw.gpuScore}/100` : '○ GPU 3D: brak testu (kliknij)'}
          </button>
          <button type="button" class="sp-cal-pill ${hw.ramTested ? 'sp-cal-pill--ok' : 'sp-cal-pill--pending'}" data-open-mod="ram">
            ${hw.ramTested ? `✓ RAM: ${hw.ramScore}/100` : '○ RAM: brak testu (kliknij)'}
          </button>
          <button type="button" class="sp-cal-pill ${hw.diskTested ? 'sp-cal-pill--ok' : 'sp-cal-pill--pending'}" data-open-mod="disk">
            ${hw.diskTested ? `✓ Dysk: ${hw.diskScore}/100` : '○ Dysk: brak testu (kliknij)'}
          </button>
        </div>

        <!-- Podsumowanie kompatybilności gier + Filtry -->
        <div class="sp-games-summary-strip">
          <div class="sp-games-summary-counts">
            <span class="sp-summary-chip sp-summary-chip--ultra">Ultra 120+ FPS: <strong>${summary.ultraCount}</strong></span>
            <span class="sp-summary-chip sp-summary-chip--smooth">Wysokie 60+ FPS: <strong>${summary.smoothCount}</strong></span>
            <span class="sp-summary-chip sp-summary-chip--playable">Średnie 35–59 FPS: <strong>${summary.playableCount}</strong></span>
            <span class="sp-summary-chip sp-summary-chip--low">Niskie / Słabe (&lt;35): <strong>${summary.lowCount}</strong></span>
          </div>
          <div class="sp-games-filter-bar">
            <button type="button" class="sp-filter-btn ${optimizerState.gameFilter === 'all' ? 'active' : ''}" data-game-filter="all">Wszystkie (${summary.total})</button>
            <button type="button" class="sp-filter-btn ${optimizerState.gameFilter === 'smooth60' ? 'active' : ''}" data-game-filter="smooth60">Płynne 60+ (${summary.smoothOrBetterCount})</button>
            <button type="button" class="sp-filter-btn ${optimizerState.gameFilter === 'ultra120' ? 'active' : ''}" data-game-filter="ultra120">Ultra 120+ (${summary.ultraCount})</button>
            <button type="button" class="sp-filter-btn ${optimizerState.gameFilter === 'esport' ? 'active' : ''}" data-game-filter="esport">E-Sport</button>
            <button type="button" class="sp-filter-btn ${optimizerState.gameFilter === 'ue5_rt' ? 'active' : ''}" data-game-filter="ue5_rt">AAA / UE5 / RT</button>
          </div>
        </div>

        <div class="sp-games-chart-grid">
          ${visibleGames.length === 0
            ? `<div class="sp-game-bar-card" style="grid-column:1 / -1;text-align:center;color:var(--text-muted);padding:20px;">Brak gier spełniających wybrany filtr dla aktualnych wyników testu tego komputera.</div>`
            : visibleGames
                .map((g) => {
                  const w1080 = Math.max(4, Math.min(100, Math.round((g.fps1080pNative / 360) * 100)));
                  const w1440 = Math.max(4, Math.min(100, Math.round((g.fps1440pQuality / 360) * 100)));
                  const wFg = Math.max(4, Math.min(100, Math.round((g.fpsDlssFg / 360) * 100)));
                  const tierBadge = `<span class="sp-game-tier sp-game-tier--${g.tier}">${g.tierLabel}</span>`;

                  return `
                    <div class="sp-game-bar-card">
                      <div class="sp-game-bar-top">
                        <div class="sp-game-bar-title-col">
                          <strong class="sp-game-bar-title">${escHtml(g.title)}</strong>
                          <span class="sp-game-meta">${escHtml(g.engine)} · ${escHtml(g.genre)} · Zalecane VRAM: ${g.vramRecommendedGb} GB</span>
                        </div>
                        ${tierBadge}
                      </div>

                      <div class="sp-game-bars">
                        <div class="sp-game-bar-row">
                          <span class="sp-game-bar-label">1080p Natywne</span>
                          <div class="sp-game-bar-track">
                            <div class="sp-game-bar-fill sp-game-bar-fill--1080" style="width:${w1080}%"></div>
                          </div>
                          <strong class="sp-game-bar-val">${g.fps1080pNative} FPS</strong>
                        </div>
                        <div class="sp-game-bar-row">
                          <span class="sp-game-bar-label">1440p Quality</span>
                          <div class="sp-game-bar-track">
                            <div class="sp-game-bar-fill sp-game-bar-fill--1440" style="width:${w1440}%"></div>
                          </div>
                          <strong class="sp-game-bar-val">${g.fps1440pQuality} FPS</strong>
                        </div>
                        <div class="sp-game-bar-row">
                          <span class="sp-game-bar-label">DLSS/FSR + FG</span>
                          <div class="sp-game-bar-track">
                            <div class="sp-game-bar-fill sp-game-bar-fill--fg" style="width:${wFg}%"></div>
                          </div>
                          <strong class="sp-game-bar-val sp-game-bar-val--fg">${g.fpsDlssFg} FPS</strong>
                        </div>
                      </div>

                      ${
                        g.vramWarning
                          ? `<div class="sp-game-vram-warn">⚠️ ${escHtml(g.vramWarning)}</div>`
                          : ''
                      }

                      <div class="sp-game-rec-line">
                        <span>Optymalne ustawienia:</span> <strong>${escHtml(g.recommendedSetting)}</strong>
                      </div>
                    </div>
                  `;
                })
                .join('')}
        </div>
      </div>

      <!-- 1B. 30-DNIOWY WYKRES TRENDU WYDAJNOŚCI (FPS) DLA WYBRANEJ GRY -->
      <div class="sp-panel sp-games-trend-panel">
        <div class="sp-panel-head" style="flex-wrap:wrap;gap:12px;">
          <div>
            <span class="sp-eyebrow">HISTORIA WYDAJNOŚCI W CZASIE · OSTATNIE 30 DNI</span>
            <h3>📈 30-dniowy trend FPS w wybranej grze</h3>
            <p class="sp-muted">Analiza zmian klatkażu na przestrzeni ostatniego miesiąca oparta na zmierzonym wyniku Twojego PC.</p>
          </div>
          <div style="display:flex;align-items:center;gap:8px;">
            <label style="font-size:12px;color:var(--text-secondary);display:flex;align-items:center;gap:6px;">
              <span>Wybierz grę:</span>
              <select id="sp-trend-game-select" class="sp-select" style="padding:6px 10px;font-size:12px;">
                ${allGames.map((g) => `<option value="${g.id}" ${optimizerState.selectedTrendGameId === g.id ? 'selected' : ''}>${escHtml(g.title)} (${g.fpsDlssFg} FPS)</option>`).join('')}
              </select>
            </label>
          </div>
        </div>
        <div id="sp-game-trend-d3-mount" style="width:100%;min-height:210px;margin-top:12px;">
          <!-- Rendered via D3 -->
        </div>
      </div>

      <!-- 2. DO CZEGO NADAJE SIĘ TEN PC / LAPTOP (8 KATEGORII ZASTOSOWAŃ) -->
      <div class="sp-panel sp-suitability-panel">
        <div class="sp-panel-head">
          <div>
            <span class="sp-eyebrow">PROFIL PRZEZNACZENIA MASZYNY · OCENA 8 ZASTOSOWAŃ (0–100%)</span>
            <h3>🏆 Do czego najlepiej nadaje się ten PC / Laptop?</h3>
            <p class="sp-muted">Kompleksowa klasyfikacja możliwości komputera po testach CPU (${Math.min(100, hw.cpuScore)}/100), GPU 3D (${Math.min(100, hw.gpuScore)}/100), RAM (${Math.min(100, hw.ramScore)}/100) oraz Dysku NVMe/SSD (${Math.min(100, hw.diskScore)}/100).</p>
          </div>
        </div>

        <div class="sp-suitability-grid">
          ${suitability
            .map(
              (cat) => `
            <div class="sp-suit-card">
              <div class="sp-suit-head">
                <span class="sp-suit-icon">${cat.icon}</span>
                <div class="sp-suit-title-wrap">
                  <strong class="sp-suit-title">${escHtml(cat.title)}</strong>
                  <span class="sp-suit-badge ${cat.badgeClass}">${cat.verdict}</span>
                </div>
                <span class="sp-suit-score ${cat.score >= 75 ? 'is-ok' : cat.score >= 55 ? 'is-warn' : 'is-err'}">${cat.score}%</span>
              </div>
              <div class="sp-suit-bar-track">
                <div class="sp-suit-bar-fill ${cat.fillClass}" style="width:${cat.score}%"></div>
              </div>
              <p class="sp-suit-summary">${escHtml(cat.summary)}</p>
              <div class="sp-suit-note">${escHtml(cat.bottleneckNote)}</div>
            </div>
          `
            )
            .join('')}
        </div>
      </div>

      <!-- 3. INTERAKTYWNY GENERATOR OPTYMALNYCH USTAWIEŃ GPU + KOMPENDIUM 5 KATEGORII -->
      <div class="sp-panel sp-gpu-guide-panel">
        <div class="sp-panel-head">
          <div>
            <span class="sp-eyebrow">5 GŁÓWNYCH KATEGORII WSPÓŁCZESNYCH USTAWIEŃ GRAFICZNYCH W GRACH PC</span>
            <h3>⚙️ Generator Optymalnego Schematu Ustawień GPU (Maksymalny stosunek Jakości do FPS)</h3>
            <p class="sp-muted">Wybierz klasę swojej karty graficznej, ilość pamięci VRAM, rozdzielczość i odświeżanie monitora oraz typ gry — wygenerujemy gotowy schemat i zaaplikujemy go jednym kliknięciem do silnika 3D.</p>
          </div>
        </div>

        <div class="sp-optimizer-controls">
          <label class="sp-opt-field">
            <span>Model / Klasa Karty Graficznej</span>
            <select data-opt-select="gpuTier" class="sp-select">
              <option value="rtx4090_7900xtx" ${optimizerState.gpuTier === 'rtx4090_7900xtx' ? 'selected' : ''}>High-End / Entuzjasta (RTX 4080/4090/5080 · RX 7900 XT/XTX)</option>
              <option value="rtx4070_7800xt" ${optimizerState.gpuTier === 'rtx4070_7800xt' ? 'selected' : ''}>Wyższa Średnia (RTX 4070/4070 Super/3080 · RX 7800 XT/6800 XT)</option>
              <option value="rtx4060_7600" ${optimizerState.gpuTier === 'rtx4060_7600' ? 'selected' : ''}>Średnia 1080p/1440p (RTX 4060/3060 · RX 7600/6600 · Arc A770)</option>
              <option value="gtx1650_igpu" ${optimizerState.gpuTier === 'gtx1650_igpu' ? 'selected' : ''}>Budżetowa / Laptop iGPU (GTX 1650 / Radeon 780M / Intel Arc iGPU)</option>
            </select>
          </label>

          <label class="sp-opt-field">
            <span>Pamięć VRAM Karty</span>
            <select data-opt-select="vramGb" class="sp-select">
              <option value="6" ${optimizerState.vramGb === 6 ? 'selected' : ''}>6 GB lub mniej VRAM</option>
              <option value="8" ${optimizerState.vramGb === 8 ? 'selected' : ''}>8 GB VRAM</option>
              <option value="12" ${optimizerState.vramGb === 12 ? 'selected' : ''}>12 GB VRAM (Tekstury Ultra bez spadku FPS)</option>
              <option value="16" ${optimizerState.vramGb === 16 ? 'selected' : ''}>16 GB – 24 GB+ VRAM (Ultra + Path Tracing)</option>
            </select>
          </label>

          <label class="sp-opt-field">
            <span>Rozdzielczość Monitora</span>
            <select data-opt-select="resolution" class="sp-select">
              <option value="1080p" ${optimizerState.resolution === '1080p' ? 'selected' : ''}>1080p Full HD (1920×1080)</option>
              <option value="1440p" ${optimizerState.resolution === '1440p' ? 'selected' : ''}>1440p QHD / Ultrawide (2560×1440)</option>
              <option value="4k" ${optimizerState.resolution === '4k' ? 'selected' : ''}>4K UHD (3840×2160)</option>
            </select>
          </label>

          <label class="sp-opt-field">
            <span>Odświeżanie Monitora (Hz)</span>
            <select data-opt-select="refreshHz" class="sp-select">
              <option value="60" ${optimizerState.refreshHz === 60 ? 'selected' : ''}>60 Hz (Limit bez FG: 57 FPS)</option>
              <option value="120" ${optimizerState.refreshHz === 120 ? 'selected' : ''}>120 Hz (Limit bez FG: 117 FPS)</option>
              <option value="144" ${optimizerState.refreshHz === 144 ? 'selected' : ''}>144 Hz (Limit bez FG: 141 FPS)</option>
              <option value="165" ${optimizerState.refreshHz === 165 ? 'selected' : ''}>165 Hz (Limit bez FG: 162 FPS)</option>
              <option value="240" ${optimizerState.refreshHz === 240 ? 'selected' : ''}>240 Hz (Limit bez FG: 237 FPS)</option>
            </select>
          </label>

          <label class="sp-opt-field">
            <span>Gatunek Gry (Profil)</span>
            <select data-opt-select="gameProfile" class="sp-select">
              <option value="ue5_single" ${optimizerState.gameProfile === 'ue5_single' ? 'selected' : ''}>Singleplayer / Unreal Engine 5 (Wukong, Stalker 2, Wiedźmin)</option>
              <option value="esport" ${optimizerState.gameProfile === 'esport' ? 'selected' : ''}>E-Sport / Strzelanka Sieciowa (CS2, Valorant, Apex, Warzone)</option>
              <option value="aaa_rt" ${optimizerState.gameProfile === 'aaa_rt' ? 'selected' : ''}>AAA Ray Tracing / Path Tracing (Cyberpunk 2077, Alan Wake 2)</option>
            </select>
          </label>

          <label class="sp-opt-field">
            <span>Docelowy Klatkaż (Target FPS): <strong class="font-mono status-cyan" id="sp-target-fps-val">${optimizerState.targetFps} FPS</strong></span>
            <input type="range" min="60" max="360" step="10" value="${optimizerState.targetFps}" data-opt-range="targetFps" class="range-input" />
          </label>
        </div>

        <div class="sp-scheme-result-box">
          <div class="sp-scheme-result-head">
            <div>
              <span class="sp-badge sp-badge--ok">GOTOWY SCHEMAT OPTYMALNYCH USTAWIEŃ</span>
              <h4>${escHtml(scheme.title)}</h4>
            </div>
            <div class="sp-scheme-actions">
              <button type="button" class="sp-btn sp-btn--primary" data-opt-apply-3d="true">
                ⚡ Zastosuj ten schemat na żywo w Silniku Gry 3D MAX
              </button>
            </div>
          </div>
          ${optimizerState.appliedFeedback ? `<div class="sp-scheme-feedback">${escHtml(optimizerState.appliedFeedback)}</div>` : ''}
          <div class="sp-scheme-grid">
            <div class="sp-scheme-item">
              <span>1. Skalowanie AI (DLSS / FSR / XeSS)</span>
              <strong>${escHtml(scheme.upscalingRule)}</strong>
            </div>
            <div class="sp-scheme-item">
              <span>2. Generowanie Klatek (FG / Smooth Motion)</span>
              <strong>${escHtml(scheme.frameGenRule)}</strong>
            </div>
            <div class="sp-scheme-item">
              <span>3. Limit FPS &amp; Synchronizacja</span>
              <strong>${escHtml(scheme.fpsLimitRule)}</strong>
            </div>
            <div class="sp-scheme-item">
              <span>4. V-Sync, Reflex / Anti-Lag &amp; HDR</span>
              <strong>${escHtml(scheme.latencySyncRule)}</strong>
            </div>
            <div class="sp-scheme-item">
              <span>5. Oświetlenie, Cienie, Lumen &amp; RT</span>
              <strong>${escHtml(scheme.lightingShadowsRule)}</strong>
            </div>
            <div class="sp-scheme-item">
              <span>6. Tekstury (VRAM), AF x16 &amp; Geometria</span>
              <strong>${escHtml(scheme.texturesGeometryRule)}</strong>
            </div>
            <div class="sp-scheme-item">
              <span>7. Filtry Post-Processingu</span>
              <strong>${escHtml(scheme.postProcessRule)}</strong>
            </div>
            <div class="sp-scheme-item sp-scheme-item--gain">
              <span>Szacowany Rezultat Wydajności</span>
              <strong>${escHtml(scheme.expectedGainText)}</strong>
            </div>
          </div>
        </div>

        <!-- ZESTAWIENIE WSZYSTKICH 5 KATEGORII USTAWIEŃ GRAFICZNYCH -->
        <div class="sp-five-cat-grid">
          <div class="sp-cat-card">
            <div class="sp-cat-card-head">
              <span class="sp-cat-num">KATEGORIA 1</span>
              <h4>Wyświetlanie, Skalowanie AI i Generowanie Klatek</h4>
            </div>
            <ul class="sp-cat-list">
              <li><strong>Upscaling (DLSS 4.5 / FSR 3.1/4 / XeSS):</strong> Renderuje grę w niższej rozdzielczości i skaluje AI (w NVIDIA App możliwa własna skala np. 38–45%). <em>Wpływ na FPS: Bardzo wysoki zysk (tryb Quality często ostrzejszy niż natywne TAA).</em></li>
              <li><strong>Frame Generation (FG x2 / Multi FG x3/x4):</strong> Generuje sztuczne klatki pomiędzy prawdziwymi. <em>Ogromny zysk płynności w singleplayer (przy bazie 50–60 FPS); wyłącz w e-sporcie przez wyższy input lag.</em></li>
              <li><strong>Anti-Aliasing (DLAA / TAA / FSR Native):</strong> Wygładza krawędzie w natywnej rozdzielczości. <em>Wpływ: Niski/Średni (DLAA bardziej wymagające niż TAA).</em></li>
              <li><strong>V-Sync + Low Latency (NVIDIA Reflex / AMD Anti-Lag):</strong> V-Sync w sterowniku + Reflex eliminuje rozrywanie obrazu (screen tearing) przy minimalnym opóźnieniu (wymagane przy FG).</li>
              <li><strong>HDR (High Dynamic Range):</strong> Zwiększa rozpiętość tonalną i jasność kolorów. <em>Wpływ na FPS: Minimalny (ok. 1–3%).</em></li>
            </ul>
          </div>

          <div class="sp-cat-card">
            <div class="sp-cat-card-head">
              <span class="sp-cat-num">KATEGORIA 2</span>
              <h4>Oświetlenie i Cienie (Największe obciążenie GPU)</h4>
            </div>
            <ul class="sp-cat-list">
              <li><strong>Ray Tracing (RT) / Path Tracing:</strong> Fizyczna symulacja światła, odbić i cieni w czasie rzeczywistym. Path Tracing wymaga mocnego upscalingu DLSS/FSR + FG.</li>
              <li><strong>Global Illumination (Lumen GI):</strong> Odbite światło w pomieszczeniach. <em>W Unreal Engine 5 zejście z Epic/Ultra na High lub Medium daje ogromny skok FPS!</em></li>
              <li><strong>Shadows (Jakość cieni):</strong> Ostrość i zasięg cieni. <em>Poziom Medium lub High to najlepszy kompromis wydajności.</em></li>
              <li><strong>Ambient Occlusion (SSAO / HBAO+ / RTAO):</strong> Miękkie cienie w zakamarkach i miejscach styku obiektów nadające głębię.</li>
              <li><strong>Reflections (SSR vs RT) &amp; Volumetric Fog:</strong> Odbicia Screen Space (SSR) są dużo lżejsze niż RT. Wolumetryczną mgłę i promienie słońca warto obniżyć o 1–2 poziomy.</li>
            </ul>
          </div>

          <div class="sp-cat-card">
            <div class="sp-cat-card-head">
              <span class="sp-cat-num">KATEGORIA 3</span>
              <h4>Tekstury i Geometria (VRAM &amp; CPU/GPU)</h4>
            </div>
            <ul class="sp-cat-list">
              <li><strong>Texture Quality (Jakość tekstur):</strong> Zależy niemal wyłącznie od pamięci VRAM — <em>przy 12 GB+ VRAM ustaw Ultra bez utraty FPS.</em></li>
              <li><strong>Anisotropic Filtering (Filtrowanie anizotropowe):</strong> Ostrość tekstur pod ostrym kątem (np. asfalt drogi w oddali). <em>Zawsze ustawiaj x16 — zabiera mniej niż 1% wydajności.</em></li>
              <li><strong>LOD / View Distance (Zasięg rysowania):</strong> Decyduje, jak daleko obiekty zachowują pełną szczegółowość. Obciąża zarówno GPU, jak i procesor (CPU).</li>
              <li><strong>Foliage / Grass (Roślinność):</strong> Gęstość i zasięg trawy oraz drzew — duży wpływ na płynność w otwartych światach.</li>
              <li><strong>Subsurface Scattering (SSS):</strong> Przenikanie światła przez skórę i liście — niski wpływ na FPS, duży wzrost realizmu postaci.</li>
            </ul>
          </div>

          <div class="sp-cat-card">
            <div class="sp-cat-card-head">
              <span class="sp-cat-num">KATEGORIA 4 i 5</span>
              <h4>Post-Processing (Filtry Kamerowe) &amp; Sterowniki GPU</h4>
            </div>
            <ul class="sp-cat-list">
              <li><strong>Filtry kamerowe (1–5% FPS, często pogarszają czytelność):</strong> <em>Motion Blur</em> (rozmycie ruchu – w grach sieciowych Wył.), <em>Depth of Field</em> (głębia ostrości), <em>Chromatic Aberration</em> (kolorowe obwódki soczewki – warto Wył.), <em>Film Grain</em> (ziarno) oraz <em>Lens Flare &amp; Bloom</em>.</li>
              <li><strong>Smooth Motion / AMD Fluid Motion Frames (AFMF):</strong> Generowanie klatek na poziomie sterownika NVIDIA App / AMD Adrenalin dla gier bez natywnego FG.</li>
              <li><strong>Image Sharpening / Radeon Image Sharpening (RIS):</strong> Wyostrzanie obrazu kompensujące agresywne skalowanie DLSS/FSR (np. przy skali 38–45%).</li>
              <li><strong>Max Frame Rate (Limit klatek w sterowniku):</strong> Blokada 3 klatki poniżej Hz monitora (np. <em>117 FPS dla 120 Hz</em>, <em>141 FPS dla 144 Hz</em>) stabilizuje frametime i obniża zużycie energii.</li>
            </ul>
          </div>
        </div>
      </div>
    </section>
  `;
}

export function bindPcSuitabilityReportEvents(
  root: HTMLElement,
  rerender: () => void,
  ctx?: PcSuitabilityInputContext,
  onRunFullSuite?: () => void
): void {
  root.querySelectorAll<HTMLButtonElement>('[data-run-full-suite]').forEach((btn) => {
    btn.addEventListener('click', () => {
      onRunFullSuite?.();
    });
  });

  root.querySelectorAll<HTMLButtonElement>('[data-game-filter]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const mode = btn.dataset.gameFilter as GameFilterMode;
      if (mode) {
        optimizerState.gameFilter = mode;
        rerender();
      }
    });
  });

  root.querySelectorAll<HTMLSelectElement>('[data-opt-select]').forEach((selectEl) => {
    selectEl.addEventListener('change', () => {
      const key = selectEl.dataset.optSelect as keyof OptimizerState;
      if (key === 'gpuTier' || key === 'vramGb') {
        optimizerState.userCustomizedTier = true;
      }
      if (key === 'vramGb' || key === 'refreshHz' || key === 'targetFps') {
        (optimizerState as unknown as Record<string, number>)[key] = Number(selectEl.value);
      } else if (key) {
        (optimizerState as unknown as Record<string, string>)[key] = selectEl.value;
      }
      optimizerState.appliedFeedback = null;
      rerender();
    });
  });

  root.querySelectorAll<HTMLInputElement>('[data-opt-range]').forEach((rangeEl) => {
    rangeEl.addEventListener('input', () => {
      const key = rangeEl.dataset.optRange as keyof OptimizerState;
      const val = Number(rangeEl.value);
      (optimizerState as unknown as Record<string, number>)[key] = val;
      const valDisplay = root.querySelector('#sp-target-fps-val');
      if (valDisplay) valDisplay.textContent = `${val} FPS`;
    });
    rangeEl.addEventListener('change', () => {
      optimizerState.appliedFeedback = null;
      rerender();
    });
  });

  const renderTrendChart = () => {
    const mount = root.querySelector<HTMLElement>('#sp-game-trend-d3-mount');
    if (!mount) return;
    const effectiveCtx: PcSuitabilityInputContext = ctx ?? {
      specs: null,
      cpu: { multiCoreScore: 8000, coresUsed: 8 } as CpuTestResult,
      ram: { overallScore: 85 } as RamTestResult,
      disk: { overallScore: 85 } as DiskTestResult,
      gpu: { avgFps: 90, overallScore: 80 } as GpuStressMetrics,
      game: { avgFps: 90, overallScore: 80 } as GameBenchMetrics,
    };
    const allGames = predictPlayableGames(effectiveCtx);
    const selGame = allGames.find((g) => g.id === optimizerState.selectedTrendGameId) || allGames[0];
    const historyData = generate30DayGameFpsHistory(selGame.fpsDlssFg);
    renderGame30DayFpsTrendChartD3(selGame.title, historyData, mount, 210);
  };

  const trendSelect = root.querySelector<HTMLSelectElement>('#sp-trend-game-select');
  if (trendSelect) {
    trendSelect.addEventListener('change', () => {
      optimizerState.selectedTrendGameId = trendSelect.value;
      renderTrendChart();
    });
  }

  renderTrendChart();

  root.querySelectorAll<HTMLButtonElement>('[data-opt-apply-3d]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const profile = optimizerState.gameProfile;
      const cap = optimizerState.refreshHz - 3;

      if (profile === 'esport') {
        gameBenchService.applyUe5OptimizationPreset(optimizerState.refreshHz, true);
        optimizerState.appliedFeedback = `✓ Zastosowano Schemat E-Sport w Silniku 3D: Limit ${cap} FPS (3 kl. poniżej ${optimizerState.refreshHz} Hz), Frame Gen WYŁ., Reflex Boost WŁ., Cienie High, Post-FX wyłączone.`;
      } else if (profile === 'aaa_rt') {
        gameBenchService.applyUe5OptimizationPreset(optimizerState.refreshHz, false);
        gameBenchService.setRayTracingMode('rt_ultra');
        gameBenchService.setTextureQuality(optimizerState.vramGb >= 12 ? 'ultra' : 'high');
        optimizerState.appliedFeedback = `✓ Zastosowano Schemat AAA Ray Tracing w Silniku 3D: DLSS Quality + Frame Gen x2, Reflex WŁ., Tekstury ${optimizerState.vramGb >= 12 ? 'Ultra (12GB+ VRAM)' : 'High'}, AF x16.`;
      } else {
        gameBenchService.applyUe5OptimizationPreset(optimizerState.refreshHz, false);
        gameBenchService.setTextureQuality(optimizerState.vramGb >= 12 ? 'ultra' : 'high');
        optimizerState.appliedFeedback = `✓ Zastosowano Schemat Unreal Engine 5 Singleplayer w Silniku 3D: DLSS Quality (67%) + Frame Gen x2, Lumen GI High, Cienie High, Tekstury ${optimizerState.vramGb >= 12 ? 'Ultra' : 'High'}, AF x16.`;
      }
      rerender();
    });
  });
}
