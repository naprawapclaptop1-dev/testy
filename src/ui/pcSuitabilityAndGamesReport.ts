import type {
  CpuTestResult,
  DiskTestResult,
  GameBenchMetrics,
  GpuStressMetrics,
  RamTestResult,
  SystemSpecs,
} from '../types';
import { gameBenchService } from '../services/gameBench.service';
import { generate30DayGameFpsHistory, renderGame30DayFpsTrendChartD3 } from './charts';

export interface PcSuitabilityInputContext {
  specs: SystemSpecs | null;
  cpu: CpuTestResult;
  ram: RamTestResult;
  disk: DiskTestResult;
  gpu: GpuStressMetrics;
  game: GameBenchMetrics;
}

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
}

export interface PcSuitabilityCategory {
  id: string;
  title: string;
  icon: string;
  score: number;
  verdict: 'IDEALNY (90-100%)' | 'BARDZO DOBRY (75-89%)' | 'DOBRY (55-74%)' | 'PODSTAWOWY (<55%)';
  badgeClass: string;
  summary: string;
  bottleneckNote: string;
}

interface OptimizerState {
  gpuTier: string;
  vramGb: number;
  resolution: '1080p' | '1440p' | '4k';
  refreshHz: 60 | 120 | 144 | 165 | 240;
  gameProfile: 'esport' | 'ue5_single' | 'aaa_rt';
  selectedTrendGameId: string;
  targetFps: number;
  appliedFeedback: string | null;
}

const optimizerState: OptimizerState = {
  gpuTier: 'rtx4090_7900xtx',
  vramGb: 16,
  resolution: '1440p',
  refreshHz: 144,
  gameProfile: 'ue5_single',
  selectedTrendGameId: 'cs2',
  targetFps: 144,
  appliedFeedback: null,
};

function computeHardwarePowerIndex(ctx: PcSuitabilityInputContext): {
  cpuScore: number;
  gpuScore: number;
  ramScore: number;
  diskScore: number;
  vramEstGb: number;
  isHighEndGpu: boolean;
  gpuLabel: string;
  cpuCores: number;
} {
  const gpuLabel = ctx.specs?.gpuRenderer || ctx.gpu.rendererName || 'Akcelerator 3D WebGL2';
  const renderer = gpuLabel.toLowerCase();
  const cores = ctx.specs?.cpuCores || ctx.cpu.coresUsed || 8;
  const memGb = typeof ctx.specs?.deviceMemory === 'number' ? ctx.specs.deviceMemory : 16;

  let gpuBase = 76;
  let vramEstGb = 12;
  if (/7900|4090|4080|5090|5080|6950|3090/.test(renderer)) {
    gpuBase = 98;
    vramEstGb = 24;
  } else if (/4070|7800|3080|6800|7700|4060 ti/.test(renderer)) {
    gpuBase = 86;
    vramEstGb = 16;
  } else if (/4060|3060|7600|6600|2070|arc a7/.test(renderer)) {
    gpuBase = 74;
    vramEstGb = 8;
  } else if (/intel|uhd|iris|vega|radeon\(tm\) graphics|apple m/.test(renderer)) {
    gpuBase = 50;
    vramEstGb = 6;
  }

  const benchGpuFps = ctx.gpu.avgFps || ctx.game.avgFps || ctx.game.fps || 0;
  const gpuScore = benchGpuFps > 20
    ? Math.min(100, Math.round(gpuBase * 0.65 + Math.min(100, (benchGpuFps / 140) * 100) * 0.35))
    : gpuBase;

  const cpuBenchScore = ctx.cpu.multiCoreScore > 0
    ? Math.min(100, Math.round(ctx.cpu.multiCoreScore / 110))
    : Math.min(96, 48 + cores * 3);

  const ramBenchScore = ctx.ram.overallScore > 0
    ? ctx.ram.overallScore
    : Math.min(95, 55 + Math.min(32, memGb) * 1.2);

  const diskBenchScore = ctx.disk.overallScore > 0
    ? ctx.disk.overallScore
    : 82;

  return {
    cpuScore: Math.max(35, Math.min(100, cpuBenchScore)),
    gpuScore: Math.max(30, Math.min(100, gpuScore)),
    ramScore: Math.max(40, Math.min(100, ramBenchScore)),
    diskScore: Math.max(45, Math.min(100, diskBenchScore)),
    vramEstGb,
    isHighEndGpu: gpuScore >= 82,
    gpuLabel,
    cpuCores: cores,
  };
}

export function predictPlayableGames(ctx: PcSuitabilityInputContext): GameFpsPrediction[] {
  const hw = computeHardwarePowerIndex(ctx);
  const perfFactor = (hw.gpuScore * 0.68 + hw.cpuScore * 0.22 + hw.ramScore * 0.10) / 85;

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
  }> = [
    {
      id: 'cs2',
      title: 'Counter-Strike 2 (Source 2)',
      engine: 'Source 2 · DX11/Vulkan',
      genre: 'E-Sport / Shooter',
      vramRecommendedGb: 6,
      base1080: 310,
      base1440: 235,
      dlssFgMult: 1.18,
      recommendedSetting: 'Natywne + Reflex Boost · FG Wył. · Cienie High · Limit 3 kl. poniżej Hz',
    },
    {
      id: 'valorant',
      title: 'Valorant / Overwatch 2',
      engine: 'UE4 Esports / Custom',
      genre: 'E-Sport / Shooter',
      vramRecommendedGb: 4,
      base1080: 380,
      base1440: 295,
      dlssFgMult: 1.12,
      recommendedSetting: 'Natywne 100% · NVIDIA Reflex ON + Boost · Motion Blur Wył.',
    },
    {
      id: 'forza5',
      title: 'Forza Horizon 5 (Extreme)',
      engine: 'ForzaTech · DX12',
      genre: 'Symulator / Open-World',
      vramRecommendedGb: 8,
      base1080: 155,
      base1440: 124,
      dlssFgMult: 1.55,
      recommendedSetting: 'DLAA / FSR Native · Tekstury Ultra · AF x16 · Odbicia High',
    },
    {
      id: 'gtav_next',
      title: 'GTA V Enhanced RT / GTA VI Preview',
      engine: 'RAGE Next-Gen · Ray Tracing',
      genre: 'Symulator / Open-World',
      vramRecommendedGb: 10,
      base1080: 122,
      base1440: 94,
      dlssFgMult: 1.72,
      recommendedSetting: 'DLSS/FSR Quality (67%) · Cienie High · Zasięg LOD High · AF x16',
    },
    {
      id: 'witcher3_rt',
      title: 'Wiedźmin 3: Dziki Gon (Next-Gen RT)',
      engine: 'REDengine 4 · DX12 RTGI',
      genre: 'AAA Singleplayer',
      vramRecommendedGb: 10,
      base1080: 104,
      base1440: 78,
      dlssFgMult: 1.85,
      recommendedSetting: 'DLSS/FSR Quality + Frame Gen x2 · RTGI Medium/High · Roślinność High',
    },
    {
      id: 'fc25',
      title: 'EA Sports FC 25 / F1 24',
      engine: 'Frostbite / Ego · DX12',
      genre: 'E-Sport / Shooter',
      vramRecommendedGb: 8,
      base1080: 175,
      base1440: 138,
      dlssFgMult: 1.35,
      recommendedSetting: 'Natywne / Quality · V-Sync Sterownik + G-Sync/FreeSync · Ultra Tekstury',
    },
    {
      id: 'cyberpunk_rt',
      title: 'Cyberpunk 2077: Phantom Liberty (RT Ultra)',
      engine: 'REDengine 4 · Ray/Path Tracing',
      genre: 'UE5 / Path Tracing',
      vramRecommendedGb: 12,
      base1080: 86,
      base1440: 62,
      dlssFgMult: 2.15,
      recommendedSetting: 'DLSS 4.5 / FSR 4 Quality + FG x2/x3 · Reflex ON · Wolumetryczna Mgła High',
    },
    {
      id: 'wukong_ue5',
      title: 'Black Myth: Wukong (Unreal Engine 5)',
      engine: 'UE5 · Lumen GI + Nanite',
      genre: 'UE5 / Path Tracing',
      vramRecommendedGb: 12,
      base1080: 92,
      base1440: 68,
      dlssFgMult: 2.05,
      recommendedSetting: 'Skalowanie 58-67% + Frame Gen · Lumen GI High (zamiast Epic) · Cienie High',
    },
    {
      id: 'alanwake2_pt',
      title: 'Alan Wake 2 (Path Tracing + Ray Reconstruction)',
      engine: 'Northlight · Full Path Tracing',
      genre: 'UE5 / Path Tracing',
      vramRecommendedGb: 12,
      base1080: 76,
      base1440: 54,
      dlssFgMult: 2.25,
      recommendedSetting: 'DLSS/FSR Balanced-Quality + FG x2 · Path Tracing Medium/High · Post-FX Ograniczone',
    },
    {
      id: 'msfs2024',
      title: 'Microsoft Flight Simulator 2024',
      engine: 'Asobo Engine · DirectStorage + Photogrammetry',
      genre: 'Symulator / Open-World',
      vramRecommendedGb: 12,
      base1080: 88,
      base1440: 66,
      dlssFgMult: 1.9,
      recommendedSetting: 'TAA / DLSS Quality + Frame Gen · LOD Terenu 150 · Chmury Wolumetryczne High',
    },
    {
      id: 'horizon_forbidden_west',
      title: 'Horizon Forbidden West Complete Edition',
      engine: 'Decima Engine · DirectStorage + DLSS 3',
      genre: 'AAA Singleplayer',
      vramRecommendedGb: 10,
      base1080: 112,
      base1440: 84,
      dlssFgMult: 1.85,
      recommendedSetting: 'DLSS / FSR Quality + Frame Gen · Tekstury High · Jakość Obrazu TAA',
    },
    {
      id: 'horizon_zero_dawn_remastered',
      title: 'Horizon Zero Dawn Remastered',
      engine: 'Decima Engine · Enhanced Lighting & Assets',
      genre: 'AAA Singleplayer',
      vramRecommendedGb: 8,
      base1080: 135,
      base1440: 102,
      dlssFgMult: 1.75,
      recommendedSetting: 'DLAA / DLSS Quality · Cienie High · Roślinność Ultra · LOD High',
    },
    {
      id: 'monster_hunter_wilds',
      title: 'Monster Hunter Wilds',
      engine: 'RE Engine · Seamless Open World',
      genre: 'Symulator / Open-World',
      vramRecommendedGb: 12,
      base1080: 94,
      base1440: 71,
      dlssFgMult: 1.95,
      recommendedSetting: 'DLSS / FSR Upscaling + Frame Gen · Detale Detektorów High · Wolumetria Medium',
    },
  ];

  return catalog.map((g) => {
    const f1080 = Math.max(24, Math.round(g.base1080 * perfFactor));
    const f1440 = Math.max(18, Math.round(g.base1440 * perfFactor));
    const fDlssFg = Math.max(35, Math.round(f1440 * g.dlssFgMult));
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
    };
  });
}

export function evaluatePcSuitability(ctx: PcSuitabilityInputContext): PcSuitabilityCategory[] {
  const hw = computeHardwarePowerIndex(ctx);

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
      score: Math.min(100, Math.round(hw.cpuScore * 0.45 + hw.gpuScore * 0.45 + hw.ramScore * 0.10)),
      summary: 'CS2, Valorant, Overwatch 2, Apex Legends, EA FC 25 z niskim opóźnieniem NVIDIA Reflex / Anti-Lag.',
      bottleneckNote: 'Zalecane: Wyłącz Frame Generation i Motion Blur, ustaw limit klatek 3 FPS poniżej Hz monitora.',
    },
    {
      id: 'aaa_ue5',
      title: 'Gry AAA Singleplayer & Unreal Engine 5 (1440p / 4K)',
      icon: '🎮',
      score: Math.min(100, Math.round(hw.gpuScore * 0.65 + hw.cpuScore * 0.20 + hw.diskScore * 0.15)),
      summary: 'Cyberpunk 2077 RT, Black Myth: Wukong, Wiedźmin 3 Next-Gen, Alan Wake 2 z DLSS/FSR + Frame Gen.',
      bottleneckNote: hw.vramEstGb >= 12
        ? `Szacowane ${hw.vramEstGb} GB+ VRAM pozwala na Tekstury Ultra i filtrowanie Anizotropowe x16 bez spadku FPS.`
        : 'Przy 8 GB VRAM ustaw Tekstury na High i zejdź z Lumen GI / Cieni z Epic na High.',
    },
    {
      id: 'streaming_obs',
      title: 'Streaming LIVE & Nagrywanie OBS (AV1 / NVENC / AMF)',
      icon: '📡',
      score: Math.min(100, Math.round(hw.cpuScore * 0.42 + hw.gpuScore * 0.43 + hw.ramScore * 0.15)),
      summary: 'Jednoczesna rozgrywka 3D i kodowanie strumienia 1440p60 HDR na Twitch / YouTube bez gubienia klatek.',
      bottleneckNote: 'Sprzętowy enkoder GPU odciąża procesor; stabilny frametime gwarantuje płynny obraz VOD.',
    },
    {
      id: 'video_3d',
      title: 'Montaż Wideo 4K/8K, CAD & Renderowanie 3D (Blender / DaVinci)',
      icon: '🎬',
      score: Math.min(100, Math.round(hw.gpuScore * 0.42 + hw.cpuScore * 0.35 + hw.ramScore * 0.13 + hw.diskScore * 0.10)),
      summary: 'Renderowanie scen Cycles/Octane, korekcja barwna HDR, oś czasu 4K ProRes/RAW i symulacje fizyki.',
      bottleneckNote: 'Wysoka przepustowość pamięci RAM i szybki odczyt NVMe przyspieszają scrubbing osi czasu 4K.',
    },
    {
      id: 'local_ai',
      title: 'Lokalne AI / Modele LLM, DeepSeek & Generowanie Obrazu (SDXL/Flux)',
      icon: '🧠',
      score: Math.min(100, Math.round(hw.gpuScore * 0.62 + hw.ramScore * 0.25 + hw.cpuScore * 0.13)),
      summary: 'Uruchamianie lokalnych modeli językowych (Ollama / LM Studio) oraz akceleracja Tensor / WebGPU.',
      bottleneckNote: `Przepustowość VRAM (${hw.vramEstGb} GB klasy GPU) decyduje o liczbie tokenów/s i wielkości kwantyzacji Q4/Q8.`,
    },
    {
      id: 'dev_vm',
      title: 'Programowanie, Kompilacja Kodu, Docker & Maszyny Wirtualne',
      icon: '💻',
      score: Math.min(100, Math.round(hw.cpuScore * 0.48 + hw.ramScore * 0.32 + hw.diskScore * 0.20)),
      summary: 'Wielowątkowa kompilacja C++/Rust/TypeScript, kontenery Docker, WSL2 i bazy danych o niskim opóźnieniu IOPS.',
      bottleneckNote: `${hw.cpuCores} wątków logicznych CPU oraz szybki czas dostępu 4K QD1 dysku skracają czas buildów.`,
    },
    {
      id: 'office_finance',
      title: 'Praca Biurowa, Wielozadaniowość, Trading & Analiza Danych (Excel/BI)',
      icon: '📊',
      score: Math.min(100, Math.round(hw.cpuScore * 0.35 + hw.ramScore * 0.40 + hw.diskScore * 0.25)),
      summary: 'Dziesiątki kart przeglądarki, arkusze kalkulacyjne z milionami wierszy, wielomonitorowe stanowisko pracy.',
      bottleneckNote: 'Zapas wydajności pozwala na bezgłośną pracę półpasywną przy minimalnym poborze mocy.',
    },
    {
      id: 'mobility_acoustics',
      title: 'Efektywność Energetyczna, Kultura Pracy Chłodzenia & Stabilność 24/7',
      icon: '❄️',
      score: Math.min(100, Math.round((hw.cpuScore + hw.gpuScore + hw.ramScore) / 3)),
      summary: 'Stabilność pod długotrwałym obciążeniem (brak thermal-throttlingu), zdrowie łożysk PWM i spójność zasilania.',
      bottleneckNote: 'Zablokowanie FPS (Max Frame Rate) 3 klatki poniżej Hz monitora obniża pobór prądu i hałas wentylatorów.',
    },
  ];

  return rawCategories.map((c) => {
    let verdict: PcSuitabilityCategory['verdict'] = 'IDEALNY (90-100%)';
    let badgeClass = 'sp-suit-badge--ideal';
    if (c.score < 55) {
      verdict = 'PODSTAWOWY (<55%)';
      badgeClass = 'sp-suit-badge--basic';
    } else if (c.score < 75) {
      verdict = 'DOBRY (55-74%)';
      badgeClass = 'sp-suit-badge--good';
    } else if (c.score < 90) {
      verdict = 'BARDZO DOBRY (75-89%)';
      badgeClass = 'sp-suit-badge--vgood';
    }
    return {
      ...c,
      verdict,
      badgeClass,
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
      upscalingRule: state.gpuTier === 'gtx1650_igpu'
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
      upscalingRule: state.resolution === '4k'
        ? 'DLSS 4.5 / FSR 4 / XeSS: Balanced (58%) lub własna skala 42-50% w NVIDIA App + Wyostrzanie 30%'
        : 'DLSS 4.5 / FSR 4 / XeSS: Quality (67% skali renderowania) – ostrość często lepsza niż natywne TAA',
      frameGenRule: state.gpuTier === 'rtx4090_7900xtx' || state.gpuTier === 'rtx4070_7800xt'
        ? 'Frame Generation: WŁĄCZONE (FG x2 / Multi Frame Gen x3 przy bazowych 55-65 FPS)'
        : 'Frame Generation / AFMF: WŁĄCZONE tylko jeśli bazowy FPS przekracza 50 kl./s',
      latencySyncRule: 'Low Latency (Reflex / Anti-Lag): OBOWIĄZKOWO WŁĄCZONE · V-Sync w sterowniku + G-Sync/FreeSync + HDR ON',
      lightingShadowsRule: 'Ray Tracing: High (odbicia + RTGI) · Cienie: High (zamiast Ultra) · Wolumetryczna Mgła: Medium (-2 poziomy = duży skok FPS)',
      texturesGeometryRule: `Tekstury: ${has12GbPlus ? 'ULTRA (pełny bufor 12GB+ VRAM)' : 'HIGH (ochrona przed przepełnieniem 8GB VRAM)'} · Anisotropic Filtering: x16 · Subsurface Scattering: WŁ.`,
      postProcessRule: 'Bloom & Lens Flare: WŁ. · Motion Blur: Wył./Niski · Aberracja Chromatyczna i Ziarno Filmowe: WYŁ. dla czystości obrazu',
      expectedGainText: '+90% do +165% wyższa płynność w grach z Ray Tracingiem przy zachowaniu fotorealistycznego oświetlenia.',
    };
  }

  // Default: Unreal Engine 5 / Modern Singleplayer
  return {
    title: `Schemat Unreal Engine 5 Singleplayer (${state.resolution.toUpperCase()} @ ${state.refreshHz} Hz · Max Jakość / FPS)`,
    fpsLimitRule: `Z włączonym FG: automatyczny limit Reflex. Bez FG: zablokuj na ${recommendedCap} FPS (3 kl. poniżej ${state.refreshHz} Hz).`,
    upscalingRule: state.resolution === '4k'
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

export function renderPcSuitabilityAndGamesReport(ctx: PcSuitabilityInputContext): string {
  const hasTested =
    (ctx.cpu?.multiCoreScore && ctx.cpu.multiCoreScore > 0) ||
    (ctx.ram?.overallScore && ctx.ram.overallScore > 0) ||
    (ctx.disk?.seqReadMBs && ctx.disk.seqReadMBs > 0) ||
    (ctx.gpu?.avgFps && ctx.gpu.avgFps > 0);

  if (!hasTested) {
    return `
      <section class="sp-games-suitability-wrap" id="sp-games-suitability-report">
        <div class="sp-panel" style="background:linear-gradient(135deg, rgba(6,182,212,0.12), rgba(15,23,42,0.96));border:1px solid rgba(6,182,212,0.35);padding:24px;border-radius:14px;text-align:center;">
          <div style="font-size:32px;margin-bottom:8px;">🎮📊</div>
          <h3 style="margin:0 0 8px;font-size:18px;color:#f8fafc;">Wykres Gier oraz Ocena Przydatności PC / Laptopa</h3>
          <p style="margin:0 auto 16px;max-width:640px;color:#94a3b8;font-size:13.5px;line-height:1.5;">
            Uruchom pełne testy diagnostyczne podzespołów (CPU, RAM, Dysk NVMe oraz testy GPU 3D), aby wygenerować dokładny ranking płynności w grach (CS2, Cyberpunk 2077, Wukong, Wiedźmin 3, Forza 5) oraz szczegółową ocenę w 8 zastosowaniach (AI, Montaż 4K, Streaming, Gaming).
          </p>
          <div style="display:flex;justify-content:center;gap:12px;flex-wrap:wrap;">
            <button type="button" class="btn btn-primary" data-open-mod="gpu" style="padding:10px 20px;font-weight:700;">🚀 Uruchom Testy 3D &amp; Benchmarki</button>
          </div>
        </div>
      </section>
    `;
  }

  const games = predictPlayableGames(ctx);
  const suitability = evaluatePcSuitability(ctx);
  const hw = computeHardwarePowerIndex(ctx);
  const scheme = buildOptimalSchemeRecommendation(optimizerState);

  return `
    <section class="sp-games-suitability-wrap" id="sp-games-suitability-report">
      <!-- 1. WYKRES GIER W JAKIE MOŻNA GRAĆ NA DANYM PC / LAPTOPIE -->
      <div class="sp-panel sp-games-chart-panel">
        <div class="sp-panel-head">
          <div>
            <span class="sp-eyebrow">ANALIZA WYDAJNOŚCI W GRACH 3D · 1080P / 1440P / DLSS 4.5 &amp; FRAME GEN</span>
            <h3>🎮 Wykres Gier, w jakie można grać na tym PC / Laptopie</h3>
            <p class="sp-muted">Szacowana liczba klatek na sekundę (FPS) wyliczona na podstawie profilu GPU (<strong>${hw.gpuLabel}</strong>), wielowątkowości CPU (${hw.cpuCores} wątków), przepustowości RAM i testów 3D.</p>
          </div>
          <div class="sp-games-legend">
            <span class="sp-legend-dot sp-legend-dot--1080"><i></i> 1080p Natywne</span>
            <span class="sp-legend-dot sp-legend-dot--1440"><i></i> 1440p Quality</span>
            <span class="sp-legend-dot sp-legend-dot--fg"><i></i> DLSS/FSR + Frame Gen</span>
          </div>
        </div>

        <div class="sp-games-chart-grid">
          ${games.map((g) => {
            const w1080 = Math.min(100, Math.round((g.fps1080pNative / 360) * 100));
            const w1440 = Math.min(100, Math.round((g.fps1440pQuality / 360) * 100));
            const wFg = Math.min(100, Math.round((g.fpsDlssFg / 360) * 100));
            const bestFps = Math.max(g.fps1080pNative, g.fpsDlssFg);
            const tierBadge = bestFps >= 120
              ? '<span class="sp-game-tier sp-game-tier--ultra">ULTRA PŁYNNIE 120+ FPS</span>'
              : bestFps >= 60
                ? '<span class="sp-game-tier sp-game-tier--smooth">PŁYNNIE 60+ FPS</span>'
                : '<span class="sp-game-tier sp-game-tier--playable">GRYWALNE 35-59 FPS</span>';

            return `
              <div class="sp-game-bar-card">
                <div class="sp-game-bar-top">
                  <div>
                    <strong>${g.title}</strong>
                    <span class="sp-game-meta">${g.engine} · ${g.genre} · Zalecane VRAM: ${g.vramRecommendedGb} GB</span>
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

                <div class="sp-game-rec-line">
                  <span>Optymalne ustawienia:</span> <strong>${g.recommendedSetting}</strong>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>

      <!-- 1B. 30-DNIOWY WYKRES TRENDU WYDAJNOŚCI (FPS) DLA WYBRANEJ GRY -->
      <div class="sp-panel sp-games-trend-panel" style="margin-top:20px;">
        <div class="sp-panel-head" style="flex-wrap:wrap;gap:12px;">
          <div>
            <span class="sp-eyebrow">HISTORIA WYDAJNOŚCI W CZASIE · OSTATNIE 30 DNI</span>
            <h3>📈 30-dniowy trend FPS w wybranej grze</h3>
            <p class="sp-muted">Analiza zmian klatkażu na przestrzeni ostatniego miesiąca (aktualizacje sterowników GPU, optymalizacje łat i profile upscalingu).</p>
          </div>
          <div style="display:flex;align-items:center;gap:8px;">
            <label style="font-size:12px;color:var(--text-secondary);display:flex;align-items:center;gap:6px;">
              <span>Wybierz grę:</span>
              <select id="sp-trend-game-select" class="sp-select" style="padding:6px 10px;font-size:12px;">
                ${games.map((g) => `<option value="${g.id}" ${optimizerState.selectedTrendGameId === g.id ? 'selected' : ''}>${g.title} (${g.fpsDlssFg} FPS)</option>`).join('')}
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
            <p class="sp-muted">Kompleksowa klasyfikacja możliwości komputera po testach CPU (${hw.cpuScore}/100), GPU 3D (${hw.gpuScore}/100), RAM (${hw.ramScore}/100) oraz Dysku NVMe/SSD (${hw.diskScore}/100).</p>
          </div>
        </div>

        <div class="sp-suitability-grid">
          ${suitability.map((cat) => `
            <div class="sp-suit-card">
              <div class="sp-suit-head">
                <span class="sp-suit-icon">${cat.icon}</span>
                <div class="sp-suit-title-wrap">
                  <strong>${cat.title}</strong>
                  <span class="sp-suit-badge ${cat.badgeClass}">${cat.verdict}</span>
                </div>
                <span class="sp-suit-score">${cat.score}%</span>
              </div>
              <div class="sp-suit-bar-track">
                <div class="sp-suit-bar-fill" style="width:${cat.score}%"></div>
              </div>
              <p class="sp-suit-summary">${cat.summary}</p>
              <div class="sp-suit-note">${cat.bottleneckNote}</div>
            </div>
          `).join('')}
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
              <h4>${scheme.title}</h4>
            </div>
            <div class="sp-scheme-actions">
              <button class="sp-btn sp-btn--primary" data-opt-apply-3d="true">
                ⚡ Zastosuj ten schemat na żywo w Silniku Gry 3D MAX
              </button>
            </div>
          </div>
          ${optimizerState.appliedFeedback ? `<div class="sp-scheme-feedback">${optimizerState.appliedFeedback}</div>` : ''}
          <div class="sp-scheme-grid">
            <div class="sp-scheme-item">
              <span>1. Skalowanie AI (DLSS / FSR / XeSS)</span>
              <strong>${scheme.upscalingRule}</strong>
            </div>
            <div class="sp-scheme-item">
              <span>2. Generowanie Klatek (FG / Smooth Motion)</span>
              <strong>${scheme.frameGenRule}</strong>
            </div>
            <div class="sp-scheme-item">
              <span>3. Limit FPS &amp; Synchronizacja</span>
              <strong>${scheme.fpsLimitRule}</strong>
            </div>
            <div class="sp-scheme-item">
              <span>4. V-Sync, Reflex / Anti-Lag &amp; HDR</span>
              <strong>${scheme.latencySyncRule}</strong>
            </div>
            <div class="sp-scheme-item">
              <span>5. Oświetlenie, Cienie, Lumen &amp; RT</span>
              <strong>${scheme.lightingShadowsRule}</strong>
            </div>
            <div class="sp-scheme-item">
              <span>6. Tekstury (VRAM), AF x16 &amp; Geometria</span>
              <strong>${scheme.texturesGeometryRule}</strong>
            </div>
            <div class="sp-scheme-item">
              <span>7. Filtry Post-Processingu</span>
              <strong>${scheme.postProcessRule}</strong>
            </div>
            <div class="sp-scheme-item sp-scheme-item--gain">
              <span>Szacowany Rezultat Wydajności</span>
              <strong>${scheme.expectedGainText}</strong>
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

export function bindPcSuitabilityReportEvents(root: HTMLElement, rerender: () => void): void {
  root.querySelectorAll<HTMLSelectElement>('[data-opt-select]').forEach((selectEl) => {
    selectEl.addEventListener('change', () => {
      const key = selectEl.dataset.optSelect as keyof OptimizerState;
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

  const trendSelect = root.querySelector<HTMLSelectElement>('#sp-trend-game-select');
  if (trendSelect) {
    trendSelect.addEventListener('change', () => {
      optimizerState.selectedTrendGameId = trendSelect.value;
      renderTrendChart();
    });
  }

  const renderTrendChart = () => {
    const mount = root.querySelector<HTMLElement>('#sp-game-trend-d3-mount');
    if (!mount) return;
    const dummyCtx = { specs: null, cpu: { multiCoreScore: 8000, coresUsed: 8 }, ram: { overallScore: 85 }, disk: { overallScore: 85 }, gpu: { avgFps: 90 }, game: { avgFps: 90 } };
    const allGames = predictPlayableGames(dummyCtx as any);
    const selGame = allGames.find((g) => g.id === optimizerState.selectedTrendGameId) || allGames[0];
    const historyData = generate30DayGameFpsHistory(selGame.fpsDlssFg);
    renderGame30DayFpsTrendChartD3(selGame.title, historyData, mount, 210);
  };

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
