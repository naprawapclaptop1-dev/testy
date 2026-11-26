import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';
import {
  BenchmarkResolutionId,
  GpuFpsMode,
  GpuLoadPreset,
  GpuSceneMode,
  GpuStressMetrics,
  GpuTelemetryPoint,
} from '../types';
import { computeSafeBenchmarkBufferSize } from '../utils/benchmarkResolution';
import {
  createCarbonFiberTextures,
  createCinematicBackdropDome,
  createCinematicHdrEnvironment,
  createFloatingEmberBokeh,
  createPlanarReflector,
  createVolumetricLightShafts,
} from './aaaVisuals';
import { createCinematicGradePass, createStudioFloorDeckTextures } from './cinematicPostFx';
import { createArchitecturePbrTextures } from './gameVehicleModels';
import { thermalMonitorService } from './thermalMonitor.service';

export interface GpuSceneCatalogItem {
  id: GpuSceneMode;
  name: string;
  shortName: string;
  targetUnit: string;
  description: string;
}

export const GPU_SCENE_CATALOG: GpuSceneCatalogItem[] = [
  {
    id: 'vortex',
    name: 'Wir PBR & Rdzeń GPU (Klasyczny)',
    shortName: 'Wir PBR',
    targetUnit: 'Instancing + PBR',
    description: 'Klasyczny model GPU z dwiema turbinami i 1 500–32 000 metalicznych kryształów PBR.',
  },
  {
    id: 'furmark',
    name: 'FurMark 3D Plasma Donut (48 warstw)',
    shortName: 'FurMark 3D',
    targetUnit: 'ROP / Fillrate / Shader',
    description: 'Klasyczny test wygrzewający w stylu FurMark: 16–48 warstw wolumetrycznego futra plazmowego fBM.',
  },
  {
    id: 'raymarching',
    name: 'Raytracing / Mandelbulb 3D (256 kroków)',
    shortName: 'Raymarch 3D',
    targetUnit: 'FP32 Shader ALU',
    description: 'Pełnoekranowy raymarching fraktala 3D Mandelbulb z miękkimi cieniami, AO i odbiciami — zabójca RX 7900 XTX / RTX 4090.',
  },
  {
    id: 'galaxy',
    name: 'Galaktyka 350k Cząsteczek & Czarna Dziura',
    shortName: 'Galaktyka 350k',
    targetUnit: 'Vertex + Overdraw',
    description: 'Do 350 000 cząsteczek spirali liczonych w Vertex Shaderze + dysk akrecyjny i dżety relatywistyczne.',
  },
  {
    id: 'vram_fill',
    name: 'VRAM 4K Tekstury & Szklany Overdraw',
    shortName: 'VRAM & Overdraw',
    targetUnit: 'VRAM Bandwidth + Blending',
    description: 'Alokacja proceduralnych tekstur 2K/4K (Albedo + Normal + Roughness) i tunel 24–80 przezroczystych warstw.',
  },
  {
    id: 'geometry',
    name: 'Teselacja & Miliony Trójkątów (6M+)',
    shortName: 'Miliony Trójkątów',
    targetUnit: 'Geometry / Rasterizer',
    description: 'Katedra chromowanych węzłów i rzeźb o gęstości 500k–6M+ trójkątów z dynamiczną deformacją wierzchołków.',
  },
  {
    id: 'cyber_city',
    name: 'Neonowe Miasto 3D & 40k Obiektów',
    shortName: 'Cyber Miasto',
    targetUnit: 'Instancing + Shadow Maps',
    description: 'Proceduralna metropolia cyberpunk: tysiące instancjonowanych wieżowców, latające strumienie dronów i dynamiczne neony.',
  },
  {
    id: 'fluid_plasma',
    name: 'Ocean Plazmy FBM & Kule Energii 3D',
    shortName: 'Plazma FBM',
    targetUnit: 'Domain-Warp Shader + Vertex',
    description: 'Gęsta siatka fal 3D z 6-oktawowym domain-warpingiem FBM w GLSL, dyspersją Fresnela oraz orbitującymi kulami energetycznymi.',
  },
  {
    id: 'menger_sponge',
    name: 'Raytracing Katedra Mengera & Odbicia',
    shortName: 'Katedra Mengera',
    targetUnit: 'Raymarch + Specular Bounces',
    description: 'Pełnoekranowy rekursywny fraktal Kostki Mengera 3D z lustrzanymi odbiciami, cieniami SDF i wolumetryczną poświatą.',
  },
  {
    id: 'neural_lattice',
    name: 'Kwantowa Sieć 180k Węzłów & Rdzenie',
    shortName: 'Sieć Kwantowa',
    targetUnit: 'Vertex ALU + Additive Fill',
    description: 'Pulsująca 3D sieć neuronowo-kwantowa: do 180 000 węzłów w Vertex Shaderze, warstwy geodezyjne i wiązki plazmowe.',
  },
  {
    id: 'volumetric_nebula',
    name: 'Mgławica Wolumetryczna 3D (Raymarch Cloud)',
    shortName: 'Mgławica 3D',
    targetUnit: 'Volumetric 3D FBM Raymarch',
    description: 'Pełnoekranowy wolumetryczny raymarching gęstej mgławicy 3D (32–110 kroków FBM na piksel) z rozpraszaniem światła i jądrem pulsara.',
  },
  {
    id: 'crystal_caustics',
    name: 'Katedra Kryształów PBR & Kaustyka',
    shortName: 'Kryształy PBR',
    targetUnit: 'Clearcoat PBR + Instancing',
    description: 'Tysiące instancjonowanych pryzmatów z lakierem Clearcoat PBR, rdzeń diamentowy oraz dynamiczne kolorowe światła kaustyczne.',
  },
  {
    id: 'blackhole_lensing',
    name: 'Czarna Dziura Kerr (Soczewkowanie RT)',
    shortName: 'Czarna Dziura RT',
    targetUnit: 'FP32 Geodesic Raytrace',
    description: 'Relatywistyczny raytracing czarnej dziury z uginaniem promieni światła, dyskiem akrecyjnym Dopplera i pierścieniem fotonowym.',
  },
  {
    id: 'dna_megastructure',
    name: 'Biocybernetyczna Helisa DNA & 240k Cząstek',
    shortName: 'Helisa DNA 240k',
    targetUnit: 'Instancing + 240k Vertex Shader',
    description: 'Monumentalna podwójna helisa 3D z tysiącami instancjonowanych par zasad oraz do 240 000 cząsteczek energetycznych liczonych na GPU.',
  },
  {
    id: 'pathtraced_cornell',
    name: 'Path-Tracing Cornell Box & Global Illumination',
    shortName: 'Cornell Box PT',
    targetUnit: 'Ray-Traced GI + Soft Shadows',
    description: 'Komora kalibracyjna Cornell Box z odbiciami lustrzanymi, kolorowym bleedingiem GI, kulami dielektrycznymi i miękkimi cieniami obszarowymi.',
  },
  {
    id: 'subsurface_dragon',
    name: 'Rzeźba Jadeitowa SSS & Rozpraszanie Podpowierzchniowe',
    shortName: 'Jadeit SSS',
    targetUnit: 'Transmission PBR + SSS ALU',
    description: 'Wielowarstwowy posąg smoka z nefrytu i bursztynu z fizyczną transmisją światła (Subsurface Scattering), refrakcją IOR 1.65 i orbitującymi lampionami.',
  },
  {
    id: 'cloth_aerodynamics',
    name: 'Tunel Aerodynamiczny 3D & Symulacja Tkaniny',
    shortName: 'Aerodynamika 3D',
    targetUnit: 'Vertex Cloth Sim + Streamlines',
    description: 'Gęsta siatka falującej tkaniny karbonowo-jedwabnej w tunelu aerodynamicznym z tysiącami świetlnych linii prądu (Streamlines) i turbiną wiatrową.',
  },
  {
    id: 'volumetric_godrays',
    name: 'Katedra Wolumetryczna & Promienie God-Rays 4K',
    shortName: 'God-Rays 4K',
    targetUnit: 'Volumetric Light Shafts + Overdraw',
    description: 'Monolityczna świątynia z dziesiątkami stożków wolumetrycznych promieni słonecznych (Crepuscular God-Rays), pyłem zawieszonym w powietrzu i witrażami.',
  },
  {
    id: 'voronoi_shatter',
    name: 'Destrukcja Fizyczna Voronoi & 28k Odłamków',
    shortName: 'Destrukcja 3D',
    targetUnit: 'Rigid-Body Explosion Matrix ALU',
    description: 'Cykliczna detonacja rdzenia krystalicznego na tysiące poligonalnych odłamków Voronoi z falami uderzeniowymi, grawitacją i odwracaniem czasu.',
  },
  {
    id: 'supernova_remnant',
    name: 'Pozostałość Supernowej & Fala Uderzeniowa Pulsar',
    shortName: 'Supernowa RT',
    targetUnit: 'Additive Shells + 260k Particles',
    description: 'Wielowarstwowa ekspansja mgławicy po wybuchu supernowej z szybko rotującym magnetarem, dżetami gamma i 260 000 rozżarzonych cząstek wyrzutu.',
  },
  {
    id: 'cyber_tunnel_warp',
    name: 'Hiperprzestrzenny Tunel Warp & Dyspersja',
    shortName: 'Tunel Warp',
    targetUnit: 'Anisotropic Instancing + Speed Lines',
    description: 'Lot z prędkością nadświetlną przez zakrzywiony tunel pierścieni kwantowych, bram fazowych i tysięcy smug fotonowych.',
  },
  {
    id: 'magnetic_ferrofluid',
    name: 'Ferrofluid Magnetyczny 3D & Kolce Cieczy PBR',
    shortName: 'Ferrofluid 3D',
    targetUnit: 'Dynamic Normal Rebuild + Clearcoat',
    description: 'Ciecz ferromagnetyczna w polu cewek Tesli: dynamiczna deformacja kolców Rosensweiga z przeliczaniem normalnych i mokrym lakierem Clearcoat PBR.',
  },
  {
    id: 'fractal_julia4d',
    name: 'Kwaternionowy Fraktal Julii 4D (Raymarch SDF)',
    shortName: 'Julia 4D RT',
    targetUnit: '4D Quaternion ALU + Specular AO',
    description: 'Pełnoekranowy raymarching czterowymiarowego zbioru Julii w przestrzeni kwaternionów z dynamicznym przekrojem hiperprzestrzennym i okluzją otoczenia.',
  },
  {
    id: 'tokamak_fusion',
    name: 'Reaktor Termojądrowy Tokamak & Plazma Toroidalna',
    shortName: 'Tokamak Fuzja',
    targetUnit: 'Toroidal Field Coils + Plasma Stream',
    description: 'Wnętrze komory próżniowej reaktora ITER/Tokamak: 18 nadprzewodzących cewek toroidalnych, wirujący sznur plazmy 150 mln °C i strumień neutronów.',
  },
  {
    id: 'raytraced_metaballs',
    name: 'Ciekłe Metaballe Raymarch & Rtęć (GLSL SDF)',
    shortName: 'Metaballe RT',
    targetUnit: 'Smooth-Min SDF + Chromatic Fresnel',
    description: 'Organiczny układ łączących się kropel ciekłego chromu i plazmy z gładkim łączeniem smin, odbiciami lustrzanymi i dyspersją chromatyczną.',
  },
  {
    id: 'ocean_gerstner_fft',
    name: 'Ocean Sztormowy Gerstnera & Bryza 3D',
    shortName: 'Ocean 3D FFT',
    targetUnit: 'Gerstner Wave ALU + SSS Foam',
    description: 'Gęsta siatka oceanu sztormowego z wielokierunkowymi falami Gerstnera, podpowierzchniowym rozpraszaniem turkusowej wody i tysiącami kropel piany.',
  },
  {
    id: 'fluid_navier_stokes',
    name: 'Dynamika Płynów CFD & Turbulencja Curl-Noise',
    shortName: 'Płyny CFD 3D',
    targetUnit: '3D Curl-Noise Fluid Advection',
    description: 'Trójwymiarowa komora aerodynamiczna CFD z polem wirowym Navier-Stokesa i dziesiątkami tysięcy cząstek podążających po liniach wirowych.',
  },
  {
    id: 'gi_radiosity_temple',
    name: 'Rotunda Radiosity GI & 24 Światła Dynamiczne',
    shortName: 'Świątynia GI',
    targetUnit: 'Multi-Light PBR + Specular Bounces',
    description: 'Monumentalna sanktuarium z polerowanego obsydianu i złota oświetlane przez rój dynamicznych źródeł światła punktowego i kryształy kaustyczne.',
  },
  {
    id: 'particle_collider_cern',
    name: 'Zderzacz Hadronów CERN & Detektor ATLAS',
    shortName: 'Zderzacz CERN',
    targetUnit: 'Relativistic Collision Tracks + ALU',
    description: 'Wnętrze detektora cząstek elementarnych podczas zderzenia wiązek protonowych 14 TeV: pierścienie kalorymetru i kaskada trajektorii kwarków.',
  },
  {
    id: 'procedural_planet_atmo',
    name: 'Egzoplaneta Proceduralna & Atmosfera Rayleigh',
    shortName: 'Egzoplaneta 3D',
    targetUnit: 'Atmospheric Scattering + Rings',
    description: 'Fotorealistyczna egzoplaneta z wielowarstwową atmosferą Rayleigha, chmurami cyklonowymi, pierścieniami lodowymi oraz pasem asteroid.',
  },
  {
    id: 'volumetric_fire_tornado',
    name: 'Wolumetryczne Tornado Ognia & Burza Żaru',
    shortName: 'Tornado Ognia',
    targetUnit: 'Volumetric Vortex + Blackbody Glow',
    description: 'Spiralny wir ognia plazmowego z wielowarstwowym rdzeniem termicznym, konwekcją powietrza i chmurą tysięcy rozżarzonych iskier.',
  },
  {
    id: 'cyber_matrix_hypercube',
    name: 'Hipersześcian 4D Tesseract & Matryca Kwantowa',
    shortName: 'Tesseract 4D',
    targetUnit: '4D Stereographic Rotation + Instancing',
    description: 'Rzut stereograficzny czterowymiarowego hipersześcianu (Tesseractu) obracanego w 4D (XW/YW/ZW) wewnątrz matrycy 32 000 węzłów kwantowych.',
  },
  {
    id: 'voxel_pathtracer',
    name: 'Voxel Global Illumination & Path-Tracer 3D',
    shortName: 'Voxel GI 3D',
    targetUnit: 'Voxel Radiance + Refraction',
    description: 'Tysiące refleksyjnych sześcianów wokseli i pryzmatów GI oświetlanych dynamicznymi wiązkami globalnej iluminacji.',
  },
  {
    id: 'nbody_galaxy_collision',
    name: 'Kolizja Dwóch Galaktyk N-Body 3D',
    shortName: 'Kolizja Galaktyk',
    targetUnit: 'N-Body Vertex + Core Blend',
    description: 'Zderzenie grawitacyjne dwóch masywnych galaktyk spiralnych z mostami pływowych gwiazd i podwójnym jądrem kwazarowym.',
  },
  {
    id: 'caustic_water_pool',
    name: 'Basen Kaustyki Wodnej & Załamanie Fal 3D',
    shortName: 'Kaustyka 3D',
    targetUnit: 'Refractive Water Mesh + Caustics',
    description: 'Dynamicznie falująca powierzchnia wody ze zmienną geometrią normalnych oraz siatką świetlnych fotonów kaustycznych na dnie.',
  },
  {
    id: 'fractal_apollonian',
    name: 'Fraktal Apoloniański & Rekursywne Sfery PBR',
    shortName: 'Apollonian 3D',
    targetUnit: 'Recursive Geometry + Metal PBR',
    description: 'Trójwymiarowe upakowanie sfer Apoloniańskich z lustrzanymi powłokami chromowymi i złotymi rdzeniami geometrycznymi.',
  },
  {
    id: 'cyber_mecha_hangar',
    name: 'Hangar Mecha 3D & Skanowanie Laserowe',
    shortName: 'Mecha Hangar',
    targetUnit: 'Hard-Surface PBR + Volumetric Scan',
    description: 'Modularny hangar robotyczny z opancerzonym rdzeniem mecha, pierścieniem skanującym 360° i fontanną iskier spawalniczych.',
  },
  {
    id: 'plasma_magnetosphere',
    name: 'Magnetosfera Planetarna & Pas Van Allena',
    shortName: 'Magnetosfera 3D',
    targetUnit: 'Magnetic Field Lines + Plasma Belt',
    description: 'Pole magnetyczne dipole planetarnego z zorzami polarnymi, liniami strumienia magnetycznego oraz pasem wysokoenergetycznych cząstek.',
  },
  {
    id: 'crystal_geode_cave',
    name: 'Jaskinia Geody Ametystowej & Kryształy PBR',
    shortName: 'Geoda PBR',
    targetUnit: 'Crystal Clearcoat + Point Lights',
    description: 'Podziemna kawerna kryształowa z tysiącami wielościennych słupów ametystowych, fluorescencją UV i wielopunktowym oświetleniem.',
  },
  {
    id: 'quantum_chromodynamics',
    name: 'Chromodynamika Kwantowa QCD & Strumień Gluonów',
    shortName: 'Kwantowa QCD',
    targetUnit: 'Lattice QCD + Quark Flux Shader',
    description: 'Trójwymiarowa sieć kwarkowo-gluonowa z wirującymi wiązkami pola silnego, węzłami barowymi RGB i dynamiką próżni kwantowej.',
  },
  {
    id: 'meshlet_nanite_cluster',
    name: 'Klastry Meshlet & Mikropoligony LOD (Nanite-Style)',
    shortName: 'Meshlet Nanite',
    targetUnit: 'Virtual Geometry + Cluster Culling',
    description: 'Tysiące zagnieżdżonych klastrów mikropoligonów z wielobarwną wizualizacją meshletów i dynamicznym teselowaniem sferycznym.',
  },
  {
    id: 'caustic_raytrace_prism',
    name: 'Pryzmat Dyspersji Światła & Caustic Spectral Trace',
    shortName: 'Pryzmat Spektralny',
    targetUnit: 'Dispersion IOR + Optical Caustics',
    description: 'Kryształowy pryzmat o wysokim współczynniku załamania (IOR 2.4) rozszczepiający wiązkę na spektrum widmowe RGB i refleksy kaustyczne.',
  },
  {
    id: 'temporal_aa_checker',
    name: 'Matryca Mikrowzorów TAA & Subpixel Moiré Stress',
    shortName: 'TAA / Subpixel',
    targetUnit: 'Anisotropic MipMap + MSAA Stress',
    description: 'Ekstremalny test próbkowania tekstur o wysokiej częstotliwości, filtrowania anizotropowego 16x i stabilności krawędzi subpikselowych.',
  },
  {
    id: 'sph_fluid_compute',
    name: 'Symulacja Cieczy SPH & Fale Powierzchniowe 3D',
    shortName: 'SPH Hydro 3D',
    targetUnit: 'Smoothed Particle Hydrodynamics',
    description: 'Tysiące cząstek płynu Smoothed Particle Hydrodynamics z kolizjami naczyń, ciśnieniem hydrostatycznym i dynamicznym cieniowaniem.',
  },
  {
    id: 'rt_reflections_hall',
    name: 'Sala Lustrzanych Odbić PBR & Chromowane Rzeźby 4K',
    shortName: 'Lustra RT PBR',
    targetUnit: 'Clearcoat Mirror + Specular IBL',
    description: 'Obsydianowa hala odbić z chromowanymi rzeźbami PBR, podwójnym odbiciem podłogowym, neonowymi łukami i dynamicznymi światłami.',
  },
  {
    id: 'volumetric_clouds_4k',
    name: 'Wolumetryczne Chmury Burzowe Cumulonimbus 4K',
    shortName: 'Chmury 4K',
    targetUnit: 'Raymarched Cloud Scattering + Lightning',
    description: 'Pełnoekranowy raymarching chmur burzowych z rozpraszaniem Henyey-Greensteina, promieniami słońca i wewnętrznymi błyskawicami.',
  },
  {
    id: 'cyber_rain_neon',
    name: 'Cyber-Metropolia w Deszczu & Odbicia Neonowe',
    shortName: 'Cyber Deszcz',
    targetUnit: 'Instanced Rain + Wet Street Specular',
    description: 'Nocna metropolia z tysiącami kropel deszczu, mokrym lustrzanym asfaltem, neonowymi hologramami i kałużami uderzeń.',
  },
  {
    id: 'magma_caldera_sim',
    name: 'Symulacja Kaldery Magmy & Erupcja Piroklastyczna',
    shortName: 'Kaldera Magmy',
    targetUnit: 'Domain-Warped Magma + Lava Bombs',
    description: 'Wrząca kaldera wulkaniczna z proceduralnym shaderem płynącej magmy, bazaltowym kraterem i tysiącami wyrzucanych bomb lawowych.',
  },
];

const PRESET_CONFIG: Record<GpuLoadPreset, { instances: number; label: string; powerBias: number }> = {
  standard: { instances: 1500, label: 'Standard (1 500)', powerBias: 18 },
  high: { instances: 5000, label: 'Wysoki (5 000)', powerBias: 28 },
  extreme: { instances: 14000, label: 'Ekstremalny (14 000)', powerBias: 37 },
  ultra: { instances: 32000, label: 'Ultra MAX (32 000)', powerBias: 44 },
};

const _dummyObj = new THREE.Object3D();
const _colorScratch = new THREE.Color();

function detectSoftwareGl(): { isSoftwareGl: boolean; rendererName: string } {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    if (!gl) return { isSoftwareGl: true, rendererName: 'Brak akceleracji WebGL' };
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const rendererName = String(gl.getParameter(param) || 'WebGL GPU');
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    const isSoftwareGl = /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(rendererName);
    return { isSoftwareGl, rendererName };
  } catch {
    return { isSoftwareGl: true, rendererName: 'Software WebGL' };
  }
}

export const HEAVY_FRAGMENT_SCENES: ReadonlySet<GpuSceneMode> = new Set<GpuSceneMode>([
  'raymarching',
  'menger_sponge',
  'volumetric_nebula',
  'blackhole_lensing',
  'fractal_julia4d',
  'volumetric_clouds_4k',
]);

export function computeSafeInitialRenderScale(
  width: number,
  height: number,
  dpr: number,
  isHeavyFragment: boolean,
  isSoftwareGl: boolean
): number {
  const safeW = Math.max(320, width);
  const safeH = Math.max(240, height);
  const pixels = safeW * safeH;
  if (isSoftwareGl) {
    const swBudget = isHeavyFragment ? 480 * 270 : 960 * 540;
    return Number(Math.max(0.38, Math.min(1, Math.sqrt(swBudget / pixels))).toFixed(2));
  }
  if (isHeavyFragment) {
    // Cap initial fullscreen raymarch pixel budget (~720p-900p) so first frame never stalls Windows TDR;
    // fast GPUs smoothly auto-scale back up to 100% within seconds.
    const budget = 1280 * 720;
    if (pixels <= budget) return 1;
    return Number(Math.max(0.45, Math.min(1, Math.sqrt(budget / pixels))).toFixed(2));
  }
  const effectivePixels = pixels * Math.min(Math.max(1, dpr), 2) ** 2;
  const geoBudget = 2560 * 1440;
  if (effectivePixels > geoBudget) {
    return Number(Math.max(0.65, Math.min(1, Math.sqrt(geoBudget / effectivePixels))).toFixed(2));
  }
  return 1;
}

export function computeAdaptiveRenderScale(
  currentScale: number,
  frameMs: number,
  isHeavyFragment: boolean,
  slowFrames: number,
  fastFrames: number
): { nextScale: number; slowFrames: number; fastFrames: number; throttled: boolean } {
  const minScale = isHeavyFragment ? 0.38 : 0.55;
  const slowThresholdMs = isHeavyFragment ? 48 : 58;
  const fastThresholdMs = isHeavyFragment ? 20 : 14;
  let nextScale = Math.max(minScale, Math.min(1, currentScale));
  let nextSlow = slowFrames;
  let nextFast = fastFrames;

  if (frameMs >= 135) {
    // Severe GPU stall detected — immediately reduce render resolution to prevent UI/TDR freeze
    nextScale = Math.max(minScale, nextScale * 0.72);
    nextSlow = 0;
    nextFast = 0;
  } else if (frameMs > slowThresholdMs) {
    nextSlow++;
    nextFast = 0;
    if (nextSlow >= 2) {
      nextScale = Math.max(minScale, nextScale * 0.85);
      nextSlow = 0;
    }
  } else if (frameMs < fastThresholdMs && nextScale < 1) {
    nextFast++;
    nextSlow = 0;
    if (nextFast >= 8) {
      nextScale = Math.min(1, nextScale + 0.1);
      nextFast = 0;
    }
  } else {
    nextSlow = Math.max(0, nextSlow - 1);
    nextFast = Math.max(0, nextFast - 1);
  }

  const rounded = Number(nextScale.toFixed(2));
  return {
    nextScale: rounded,
    slowFrames: nextSlow,
    fastFrames: nextFast,
    throttled: rounded < 0.98,
  };
}

export function computeAdaptiveRaymarchSteps(
  baseSteps: number,
  renderScale: number,
  minSteps = 24
): number {
  const safeBase = Math.max(minSteps, Math.round(baseSteps));
  const stepFactor = renderScale < 0.55 ? 0.6 : renderScale < 0.78 ? 0.78 : 1.0;
  return Math.max(minSteps, Math.round(safeBase * stepFactor));
}

function escapeOsdHtml(raw: string): string {
  return String(raw)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatElapsedMmSs(sec: number): string {
  const total = Math.max(0, Math.floor(sec));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function renderGpuOsdHtml(
  m: GpuStressMetrics,
  liveGpuTempC: number | null,
  frameHistoryMs: number[],
  isFullscreen: boolean
): string {
  const fpsColor =
    !m.running && m.fps === 0
      ? '#94a3b8'
      : m.fps >= 60
        ? '#34d399'
        : m.fps >= 30
          ? '#38bdf8'
          : m.fps >= 18
            ? '#fbbf24'
            : '#f87171';

  const badgeCls = !m.running
    ? 'paused'
    : m.verdict === 'THROTTLING / PRZECIĄŻENIE'
      ? 'err'
      : m.verdict === 'LEKKI SPADEK'
        ? 'warn'
        : '';
  const badgeText = !m.running ? 'GOTOWY' : `${m.preset.toUpperCase()} · ${m.verdict}`;

  const tempVal = liveGpuTempC !== null ? liveGpuTempC : m.estTempC;
  const tempTag = liveGpuTempC !== null ? 'LIVE' : 'est.';
  const tempColor = tempVal >= 82 ? '#f87171' : tempVal >= 70 ? '#fbbf24' : '#34d399';

  // Mini real-time frametime sparkline SVG (last 32 samples)
  const samples = frameHistoryMs.slice(-32);
  let sparkPath = '';
  if (samples.length >= 2) {
    const maxVal = Math.max(33, ...samples);
    const w = 120;
    const h = 22;
    sparkPath = samples
      .map((val, idx) => {
        const x = ((idx / (samples.length - 1)) * w).toFixed(1);
        const y = (h - Math.min(1, val / maxVal) * (h - 3) - 1.5).toFixed(1);
        return `${idx === 0 ? 'M' : 'L'}${x},${y}`;
      })
      .join(' ');
  }

  const resW = m.renderWidth || 0;
  const resH = m.renderHeight || 0;
  const scalePct = m.renderScalePct ?? 100;
  const resText = resW > 0 && resH > 0 ? `${resW}×${resH}` : '—';
  const scaleBadge = m.adaptiveThrottleActive ? `Auto ${scalePct}%` : `${scalePct}%`;

  const allocGb = (m.allocatedVramMB / 1024).toFixed(1);
  const texGb = (m.textureVramMB / 1024).toFixed(1);
  const modeLabel = m.fpsMode === 'uncapped' ? 'Bez limitu' : 'VSync';
  const scoreColor =
    m.overallScore <= 0
      ? '#94a3b8'
      : m.overallScore >= 80
        ? '#34d399'
        : m.overallScore >= 60
          ? '#38bdf8'
          : m.overallScore >= 40
            ? '#fbbf24'
            : '#f87171';
  const scoreDisplay = m.overallScore > 0 ? String(m.overallScore) : '—';

  return `
    <div class="gpu-osd-header">
      <span class="gpu-osd-title">${escapeOsdHtml(m.sceneLabel)}</span>
      <span class="gpu-osd-badge ${badgeCls}">${escapeOsdHtml(badgeText)}</span>
    </div>
    <div class="gpu-osd-fps-row">
      <div class="gpu-osd-fps-main">
        <span class="gpu-osd-fps-val" style="color:${fpsColor};">${m.fps > 0 ? m.fps.toLocaleString('pl-PL') : '0'}</span>
        <span class="gpu-osd-fps-unit">FPS</span>
      </div>
      <div class="gpu-osd-score-box">
        <span class="gpu-osd-score-lbl">WYNIK GPU</span>
        <div class="gpu-osd-score-row">
          <span class="gpu-osd-score-val" style="color:${scoreColor};">${scoreDisplay}</span>
          <span class="gpu-osd-score-max">/100</span>
        </div>
      </div>
      <div class="gpu-osd-ft-box">
        <span class="gpu-osd-ft-val">${m.frameTimeMs > 0 ? m.frameTimeMs.toFixed(1) : '0.0'} ms</span>
        <svg class="gpu-osd-sparkline" viewBox="0 0 120 22" preserveAspectRatio="none" aria-hidden="true">
          <line x1="0" y1="11" x2="120" y2="11" stroke="rgba(148,163,184,0.22)" stroke-dasharray="2,2" stroke-width="1"/>
          ${sparkPath ? `<path d="${sparkPath}" fill="none" stroke="${fpsColor}" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round"/>` : ''}
        </svg>
      </div>
    </div>
    <div class="gpu-osd-grid">
      <div class="gpu-osd-cell">
        <span class="gpu-osd-lbl">Śr. / Max</span>
        <span class="gpu-osd-val">${m.avgFps} / ${m.maxFps} FPS</span>
      </div>
      <div class="gpu-osd-cell">
        <span class="gpu-osd-lbl">Min / 1% Low</span>
        <span class="gpu-osd-val">${m.minFps} / ${m.low1PctFps} FPS</span>
      </div>
      <div class="gpu-osd-cell">
        <span class="gpu-osd-lbl">GPU Temp (${tempTag})</span>
        <span class="gpu-osd-val" style="color:${tempColor};">${tempVal.toFixed(1)} °C</span>
      </div>
      <div class="gpu-osd-cell">
        <span class="gpu-osd-lbl">Zegar GPU</span>
        <span class="gpu-osd-val" style="color:${m.thermalThrottleActive ? '#f87171' : '#38bdf8'};">${m.coreClockMhz} MHz${m.thermalThrottleActive ? ' ⚠' : ''}</span>
      </div>
      <div class="gpu-osd-cell">
        <span class="gpu-osd-lbl">Bufor 3D</span>
        <span class="gpu-osd-val">${resText} · ${scaleBadge}</span>
      </div>
      <div class="gpu-osd-cell">
        <span class="gpu-osd-lbl">VRAM (Alok/Tex)</span>
        <span class="gpu-osd-val">${allocGb}/${texGb} GB</span>
      </div>
      <div class="gpu-osd-cell">
        <span class="gpu-osd-lbl">Trójk. / Draw</span>
        <span class="gpu-osd-val">${m.triangles.toLocaleString('pl-PL')} / ${m.drawCalls}</span>
      </div>
      <div class="gpu-osd-cell">
        <span class="gpu-osd-lbl">Moc / Stabil.</span>
        <span class="gpu-osd-val">${m.estFp32Tflops ? `${m.estFp32Tflops} TF` : '—'} · ${m.stabilityPct}%</span>
      </div>
    </div>
    <div class="gpu-osd-footer">
      <span class="gpu-osd-gpu-name" title="${escapeOsdHtml(m.rendererName)}">${escapeOsdHtml(m.rendererName)}</span>
      <span>${modeLabel} · ${formatElapsedMmSs(m.elapsedSec)} · ${m.totalFramesRendered.toLocaleString('pl-PL')} kl.${isFullscreen ? ' · ESC wyjście' : ''}</span>
    </div>
  `;
}

function createPcbTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#0c1622';
  ctx.fillRect(0, 0, 512, 512);
  ctx.strokeStyle = 'rgba(20, 42, 64, 0.55)';
  ctx.lineWidth = 1;
  for (let i = 0; i <= 512; i += 16) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i, 512);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, i);
    ctx.lineTo(512, i);
    ctx.stroke();
  }
  ctx.strokeStyle = '#d49a45';
  ctx.lineWidth = 2;
  for (let i = 0; i < 44; i++) {
    const angle = (i / 44) * Math.PI * 2;
    const x0 = 256 + Math.cos(angle) * 78;
    const y0 = 256 + Math.sin(angle) * 78;
    const r1 = 155 + (i % 4) * 20;
    const x1 = 256 + Math.cos(angle) * r1;
    const y1 = 256 + Math.sin(angle) * r1;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();
    ctx.fillStyle = '#f2c26b';
    ctx.beginPath();
    ctx.arc(x1, y1, 3.2, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.strokeStyle = 'rgba(6, 182, 212, 0.55)';
  ctx.lineWidth = 2;
  ctx.strokeRect(24, 24, 464, 464);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

function createDieTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createLinearGradient(0, 0, 256, 256);
  grad.addColorStop(0, '#0a2233');
  grad.addColorStop(0.5, '#0e4c64');
  grad.addColorStop(1, '#081a28');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 256, 256);
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      ctx.fillStyle = (row + col) % 2 === 0 ? 'rgba(6, 182, 212, 0.55)' : 'rgba(56, 189, 248, 0.32)';
      ctx.fillRect(16 + col * 28, 16 + row * 28, 22, 22);
      ctx.strokeStyle = 'rgba(186, 230, 253, 0.35)';
      ctx.lineWidth = 1;
      ctx.strokeRect(16 + col * 28, 16 + row * 28, 22, 22);
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

function createContactShadowTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createRadialGradient(128, 128, 12, 128, 128, 122);
  grad.addColorStop(0, 'rgba(0, 0, 0, 0.65)');
  grad.addColorStop(0.55, 'rgba(0, 0, 0, 0.28)');
  grad.addColorStop(1, 'rgba(0, 0, 0, 0.0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 256, 256);
  return new THREE.CanvasTexture(canvas);
}

/* --- GLSL Shaders for Next-Gen GPU Stress Scenes --- */
const FURMARK_VERT = `
  uniform float uTime;
  uniform float uShell;
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vWorldPos;
  varying float vShell;
  void main() {
    vUv = uv;
    vShell = uShell;
    vec3 n = normalize(normal);
    // Fur strand wind sway + shell extrusion
    float sway = sin(uTime * 3.2 + position.x * 2.5 + position.y * 2.1) * 0.055 * uShell * uShell;
    vec3 displaced = position + n * (uShell * 0.42) + vec3(sway, cos(uTime * 2.7 + position.z * 2.3) * 0.04 * uShell, 0.0);
    vec4 wp = modelMatrix * vec4(displaced, 1.0);
    vWorldPos = wp.xyz;
    vNormal = normalize(mat3(modelMatrix) * n);
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

const FURMARK_FRAG = `
  precision highp float;
  uniform float uTime;
  uniform float uShell;
  uniform float uNoiseOctaves;
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vWorldPos;
  varying float vShell;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
  }
  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(hash(i + vec2(0.0, 0.0)), hash(i + vec2(1.0, 0.0)), u.x),
      mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
      u.y
    );
  }
  float fbm(vec2 p) {
    float v = 0.0;
    float a = 0.5;
    for (int i = 0; i < 6; i++) {
      if (float(i) >= uNoiseOctaves) break;
      v += a * noise(p);
      p = p * 2.07 + vec2(1.7, 9.2);
      a *= 0.52;
    }
    return v;
  }

  void main() {
    // Two-tier high-frequency fur strands + swirling solar plasma turbulence
    vec2 strandUv = vUv * vec2(112.0, 42.0);
    vec2 fineUv = vUv * vec2(224.0, 84.0);
    float strand = noise(strandUv + vec2(uTime * 0.65 * vShell, -uTime * 0.42));
    float fineStrand = noise(fineUv + vec2(-uTime * 0.4 * vShell, uTime * 0.25));
    float tuft = fbm(vUv * vec2(14.0, 6.0) + vec2(uTime * 0.45, -uTime * 0.3));
    float density = strand * 0.56 + fineStrand * 0.22 + tuft * 0.48;
    if (vShell > 0.02 && density < vShell * 0.86) discard;

    vec3 N = normalize(vNormal);
    vec3 viewDir = normalize(cameraPosition - vWorldPos);
    vec3 keyLightDir = normalize(vec3(0.55, 0.78, 0.45));
    float ndl = max(dot(N, keyLightDir), 0.0);
    float fresnel = pow(1.0 - max(dot(N, viewDir), 0.0), 2.35);
    float heat = clamp(tuft * 1.18 + vShell * 0.58 + fineStrand * 0.14, 0.0, 1.0);

    // Blackbody furnace palette with HDR emissive tips (> 1.0 triggers volumetric bloom)
    vec3 deepCore = vec3(0.16, 0.015, 0.01);
    vec3 crimson = vec3(0.78, 0.09, 0.02);
    vec3 magma = vec3(1.18, 0.38, 0.04);
    vec3 whiteHotTip = vec3(1.65, 1.24, 0.46);
    vec3 col = mix(deepCore, crimson, smoothstep(0.05, 0.34, heat));
    col = mix(col, magma, smoothstep(0.32, 0.68, heat));
    col = mix(col, whiteHotTip, smoothstep(0.66, 0.98, heat));

    // Directional key scatter + cool cyan/violet velvet rim sheen
    col *= (0.76 + 0.42 * ndl);
    col += vec3(0.24, 0.72, 1.35) * fresnel * (0.35 + 0.45 * vShell);
    // Deep ambient occlusion inside fur roots, luminous tips
    col *= (0.32 + 0.84 * pow(vShell, 0.85));

    float alpha = vShell < 0.02 ? 1.0 : clamp((1.0 - vShell * 0.70) * 0.90, 0.14, 0.96);
    gl_FragColor = vec4(col, alpha);
  }
`;

const RAYMARCH_VERT = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

const RAYMARCH_FRAG = `
  precision highp float;
  uniform float uTime;
  uniform vec2 uResolution;
  uniform int uMaxSteps;
  uniform int uFractalIter;
  varying vec2 vUv;

  mat2 rot(float a) {
    float s = sin(a), c = cos(a);
    return mat2(c, -s, s, c);
  }

  // 3D Mandelbulb distance estimator with orbit trap color
  vec2 mapMandelbulb(vec3 pos) {
    vec3 p = pos;
    p.xz *= rot(uTime * 0.22);
    p.xy *= rot(sin(uTime * 0.18) * 0.35);

    vec3 z = p;
    float dr = 1.0;
    float r = 0.0;
    float trap = 1e6;
    float power = 7.0 + sin(uTime * 0.35) * 1.6;

    for (int i = 0; i < 12; i++) {
      if (i >= uFractalIter) break;
      r = length(z);
      if (r > 2.15) break;
      trap = min(trap, abs(z.y) + 0.25 * r);

      float theta = acos(clamp(z.z / max(r, 0.0001), -1.0, 1.0));
      float phi = atan(z.y, z.x);
      dr = pow(r, power - 1.0) * power * dr + 1.0;

      float zr = pow(r, power);
      theta *= power;
      phi *= power;
      z = zr * vec3(sin(theta) * cos(phi), sin(phi) * sin(theta), cos(theta)) + p;
    }
    float dist = 0.5 * log(max(r, 0.0001)) * r / max(dr, 0.0001);
    return vec2(dist, trap);
  }

  vec3 calcNormal(vec3 p) {
    vec2 e = vec2(0.0014, -0.0014);
    return normalize(
      e.xyy * mapMandelbulb(p + e.xyy).x +
      e.yyx * mapMandelbulb(p + e.yyx).x +
      e.yxy * mapMandelbulb(p + e.yxy).x +
      e.xxx * mapMandelbulb(p + e.xxx).x
    );
  }

  float hash21(vec2 p) {
    p = fract(p * vec2(234.34, 435.345));
    p += dot(p, p + 34.23);
    return fract(p.x * p.y);
  }

  float calcAO(vec3 pos, vec3 nor) {
    float occ = 0.0;
    float sca = 1.0;
    for (int i = 0; i < 5; i++) {
      float h = 0.02 + 0.09 * float(i) / 4.0;
      float d = mapMandelbulb(pos + h * nor).x;
      occ += (h - d) * sca;
      sca *= 0.72;
    }
    return clamp(1.0 - 2.4 * occ, 0.0, 1.0);
  }

  float calcSoftShadow(vec3 ro, vec3 rd) {
    float res = 1.0;
    float t = 0.035;
    for (int i = 0; i < 12; i++) {
      float h = mapMandelbulb(ro + rd * t).x;
      res = min(res, 7.5 * h / t);
      t += clamp(h, 0.03, 0.22);
      if (res < 0.05 || t > 1.45) break;
    }
    return clamp(res, 0.12, 1.0);
  }

  vec3 cosmicBackdrop(vec3 rd, vec2 uv) {
    vec3 bg = mix(vec3(0.012, 0.020, 0.052), vec3(0.036, 0.088, 0.175), clamp(uv.y + 0.52, 0.0, 1.0));
    // Subtle deep-space volumetric nebula ribbons
    float band = sin(rd.x * 4.5 + rd.y * 3.2 + uTime * 0.09) * cos(rd.z * 3.8 - rd.y * 2.6);
    bg += vec3(0.05, 0.14, 0.26) * smoothstep(0.15, 0.95, band) * 0.42;
    bg += vec3(0.12, 0.04, 0.20) * smoothstep(0.25, 0.98, -band) * 0.34;
    // Crisp dual-scale procedural starfield
    vec2 sp1 = floor(rd.xy / max(abs(rd.z) + 0.35, 0.35) * 90.0);
    float s1 = hash21(sp1 + floor(rd.z * 4.0));
    if (s1 > 0.986) {
      float twinkle = 0.65 + 0.35 * sin(uTime * 2.8 + s1 * 80.0);
      bg += mix(vec3(0.65, 0.85, 1.0), vec3(1.0, 0.88, 0.72), fract(s1 * 19.3)) * twinkle * 0.95;
    }
    vec2 sp2 = floor(rd.xz / max(abs(rd.y) + 0.45, 0.45) * 140.0);
    float s2 = hash21(sp2 + 13.7);
    if (s2 > 0.992) {
      bg += vec3(0.55, 0.78, 1.0) * 0.6;
    }
    return bg;
  }

  void main() {
    vec2 uv = (gl_FragCoord.xy - 0.5 * uResolution) / max(uResolution.y, 1.0);
    float camR = 2.45 + sin(uTime * 0.28) * 0.25;
    vec3 ro = vec3(sin(uTime * 0.25) * camR, 0.45 * sin(uTime * 0.19), cos(uTime * 0.25) * camR);
    vec3 ta = vec3(0.0);
    vec3 ww = normalize(ta - ro);
    vec3 uu = normalize(cross(ww, vec3(0.0, 1.0, 0.0)));
    vec3 vv = cross(uu, ww);
    vec3 rd = normalize(uv.x * uu + uv.y * vv + 1.55 * ww);

    // Rich cosmic starfield & nebula backdrop
    vec3 col = cosmicBackdrop(rd, uv);

    float t = 0.0;
    float tMax = 6.0;
    float glow = 0.0;
    float trap = 0.0;
    bool hit = false;

    // Analytic bounding-sphere early-out (Mandelbulb fits strictly inside R = 1.55)
    // Skips 100% of empty background rays in O(1) instead of 256 fractal steps!
    float b = dot(ro, rd);
    float c = dot(ro, ro) - 2.4025;
    float disc = b * b - c;
    if (disc > 0.0) {
      float sq = sqrt(disc);
      t = max(0.0, -b - sq);
      tMax = min(6.0, -b + sq);
      for (int i = 0; i < 256; i++) {
        if (i >= uMaxSteps) break;
        vec3 p = ro + rd * t;
        vec2 res = mapMandelbulb(p);
        float d = res.x;
        glow += 0.012 / (0.042 + abs(d) * 14.0);
        if (d < 0.0012) {
          hit = true;
          trap = res.y;
          break;
        }
        if (t > tMax) break;
        t += d * 0.85;
      }
    } else {
      float closestDist = length(ro - rd * b);
      glow = exp(-max(0.0, closestDist - 1.32) * 4.2) * 1.45;
    }

    if (hit) {
      vec3 pos = ro + rd * t;
      vec3 nor = calcNormal(pos);
      float ao = calcAO(pos, nor);
      vec3 keyDir = normalize(vec3(0.72, 0.82, 0.52));
      vec3 rimDir = normalize(vec3(-0.72, 0.32, -0.62));
      float shadow = calcSoftShadow(pos + nor * 0.008, keyDir);
      float diff = max(dot(nor, keyDir), 0.0) * shadow;
      float ndv = max(dot(nor, -rd), 0.0);
      float fresnel = pow(1.0 - ndv, 3.2);
      vec3 hKey = normalize(keyDir - rd);
      vec3 hRim = normalize(rimDir - rd);
      float specKey = pow(max(dot(nor, hKey), 0.0), 64.0) * shadow;
      float specRim = pow(max(dot(nor, hRim), 0.0), 28.0);

      // Iridescent metallic-enamel fractal orbit-trap palette
      vec3 palette = 0.5 + 0.5 * cos(6.28318 * (vec3(0.55, 0.68, 0.82) + trap * 1.48 + vec3(0.0, 0.14, 0.30)));
      vec3 iridTint = 0.5 + 0.5 * cos(6.28318 * (vec3(0.2, 0.45, 0.72) + ndv * 0.85));
      vec3 reflEnv = cosmicBackdrop(reflect(rd, nor), uv);

      col = palette * (0.14 + 0.96 * diff) * ao;
      // Subtle clearcoat environment reflection + iridescence
      col += mix(reflEnv, iridTint, 0.38) * fresnel * 0.68 * ao;
      // Crisp gold key specular + electric cyan rim specular (HDR > 1.0 for subtle bloom)
      col += vec3(1.25, 1.08, 0.85) * specKey * 1.05;
      col += vec3(0.22, 0.92, 1.25) * (fresnel * 0.58 + specRim * 0.55) * ao;
      col += vec3(0.98, 0.36, 0.16) * max(dot(nor, rimDir), 0.0) * 0.34 * ao;
      // Luminous inner cavity accent
      col += vec3(0.08, 0.48, 0.78) * (1.0 - ao) * 0.16;
    } else {
      col += mix(vec3(0.06, 0.52, 0.88), vec3(0.32, 0.82, 1.15), clamp(glow * 0.4, 0.0, 1.0)) * glow * 0.28;
    }

    // Smooth HDR highlight rolloff (preserves vivid highlights > 0.9 for UnrealBloom without clipping)
    col = (col * (2.25 * col + 0.04)) / (col * (1.88 * col + 0.56) + 0.14);
    gl_FragColor = vec4(pow(clamp(col, 0.0, 1.35), vec3(0.94)), 1.0);
  }
`;

const GALAXY_VERT = `
  uniform float uTime;
  uniform float uPointScale;
  attribute vec3 aParams; // x = radius, y = baseAngle, z = verticalSpread
  attribute vec3 aColor;
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    float r = aParams.x;
    float angularSpeed = 1.45 / (0.45 + pow(r, 0.62));
    float angle = aParams.y + uTime * angularSpeed;
    float y = aParams.z * sin(uTime * 0.9 + aParams.y * 3.0);
    vec3 pos = vec3(cos(angle) * r, y, sin(angle) * r);
    vec4 mvPos = modelViewMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * mvPos;
    gl_PointSize = clamp((uPointScale * (1.2 + 0.8 / (0.5 + r))) / max(-mvPos.z, 0.5), 1.5, 22.0);
    vColor = aColor;
    vAlpha = clamp(1.15 - r * 0.06, 0.25, 1.0);
  }
`;

const GALAXY_FRAG = `
  precision mediump float;
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    vec2 c = gl_PointCoord - vec2(0.5);
    float d = dot(c, c);
    if (d > 0.25) discard;
    float falloff = exp(-d * 14.0);
    gl_FragColor = vec4(vColor * (0.7 + falloff * 1.1), falloff * vAlpha * 0.85);
  }
`;

const PLASMA_OCEAN_VERT = `
  uniform float uTime;
  uniform float uAmp;
  varying vec2 vUv;
  varying vec3 vWorldPos;
  varying float vElev;

  float wave(vec2 p, float t) {
    float w = sin(p.x * 0.85 + t * 1.6) * cos(p.y * 0.72 - t * 1.25);
    w += 0.52 * sin(p.x * 1.9 - p.y * 1.4 + t * 2.3);
    w += 0.28 * cos(length(p) * 1.35 - t * 2.8);
    return w;
  }

  void main() {
    vUv = uv;
    vec3 pos = position;
    float e = wave(pos.xz, uTime) * uAmp;
    pos.y += e;
    vElev = e;
    vec4 wp = modelMatrix * vec4(pos, 1.0);
    vWorldPos = wp.xyz;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

const PLASMA_OCEAN_FRAG = `
  precision highp float;
  uniform float uTime;
  uniform float uOctaves;
  varying vec2 vUv;
  varying vec3 vWorldPos;
  varying float vElev;

  float hash21(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }

  float vnoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(hash21(i), hash21(i + vec2(1.0, 0.0)), u.x),
      mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0, 1.0)), u.x),
      u.y
    );
  }

  float fbm(vec2 p) {
    float v = 0.0;
    float a = 0.5;
    mat2 rot = mat2(0.8, 0.6, -0.6, 0.8);
    for (int i = 0; i < 6; i++) {
      if (float(i) >= uOctaves) break;
      v += a * vnoise(p);
      p = rot * p * 2.08 + vec2(2.3, 1.7);
      a *= 0.52;
    }
    return v;
  }

  void main() {
    vec2 p = vWorldPos.xz * 0.34;
    vec2 q = vec2(
      fbm(p + vec2(0.0, uTime * 0.28)),
      fbm(p + vec2(5.2, 1.3 - uTime * 0.24))
    );
    float r = fbm(p + 2.8 * q + vec2(uTime * 0.22, -uTime * 0.18));

    vec3 cDeep = vec3(0.02, 0.06, 0.16);
    vec3 cCyan = vec3(0.04, 0.72, 0.88);
    vec3 cMagenta = vec3(0.76, 0.18, 0.92);
    vec3 cGold = vec3(1.0, 0.76, 0.22);

    vec3 col = mix(cDeep, cCyan, smoothstep(0.18, 0.62, r));
    col = mix(col, cMagenta, smoothstep(0.45, 0.85, q.x));
    col = mix(col, cGold, smoothstep(0.35, 1.05, vElev + r * 0.45));

    float distFade = exp(-dot(vWorldPos.xz, vWorldPos.xz) * 0.0085);
    col = mix(vec3(0.024, 0.035, 0.068), col, distFade);
    gl_FragColor = vec4(col, 1.0);
  }
`;

const MENGER_FRAG = `
  precision highp float;
  uniform float uTime;
  uniform vec2 uResolution;
  uniform int uMaxSteps;
  uniform int uMengerIter;
  varying vec2 vUv;

  mat2 rot(float a) {
    float s = sin(a), c = cos(a);
    return mat2(c, -s, s, c);
  }

  float sdBox(vec3 p, vec3 b) {
    vec3 q = abs(p) - b;
    return length(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0);
  }

  vec2 mapMenger(vec3 p) {
    // Infinite repeating fractal cathedral tunnel
    vec3 q = p;
    q.z = mod(q.z + uTime * 1.15, 4.0) - 2.0;
    q.xy *= rot(sin(uTime * 0.25) * 0.35 + floor((p.z + uTime * 1.15) / 4.0) * 0.35);

    float d = sdBox(q, vec3(1.42));
    float s = 1.0;
    float trap = 1e5;

    for (int m = 0; m < 5; m++) {
      if (m >= uMengerIter) break;
      vec3 a = mod(q * s, 2.0) - 1.0;
      s *= 3.0;
      vec3 r = abs(1.0 - 3.0 * abs(a));
      float da = max(r.x, r.y);
      float db = max(r.y, r.z);
      float dc = max(r.z, r.x);
      float c = (min(da, min(db, dc)) - 1.0) / s;
      if (c > d) {
        d = c;
        trap = min(trap, length(r) * 0.45);
      }
    }
    // Hollow center corridor for dramatic fly-through
    float tunnel = -(length(q.xy) - 0.56);
    return vec2(max(d, tunnel), trap);
  }

  vec3 calcNormal(vec3 p) {
    vec2 e = vec2(0.0018, -0.0018);
    return normalize(
      e.xyy * mapMenger(p + e.xyy).x +
      e.yyx * mapMenger(p + e.yyx).x +
      e.yxy * mapMenger(p + e.yxy).x +
      e.xxx * mapMenger(p + e.xxx).x
    );
  }

  void main() {
    vec2 uv = (gl_FragCoord.xy - 0.5 * uResolution) / max(uResolution.y, 1.0);
    vec3 ro = vec3(sin(uTime * 0.55) * 0.22, cos(uTime * 0.43) * 0.22, -1.8);
    vec3 rd = normalize(vec3(uv, 1.35));
    rd.xy *= rot(sin(uTime * 0.22) * 0.24);

    float t = 0.0;
    float glow = 0.0;
    float trap = 0.0;
    bool hit = false;

    for (int i = 0; i < 200; i++) {
      if (i >= uMaxSteps) break;
      vec3 p = ro + rd * t;
      vec2 res = mapMenger(p);
      float d = res.x;
      glow += 0.015 / (0.04 + abs(d) * 10.0);
      if (d < 0.0016) {
        hit = true;
        trap = res.y;
        break;
      }
      if (t > 14.0) break;
      t += d * 0.82;
    }

    vec3 col = vec3(0.02, 0.03, 0.07);
    if (hit) {
      vec3 pos = ro + rd * t;
      vec3 nor = calcNormal(pos);
      vec3 lightDir = normalize(vec3(0.55, 0.72, -0.65));
      float diff = max(dot(nor, lightDir), 0.0);
      float fres = pow(1.0 - max(dot(nor, -rd), 0.0), 3.0);

      // Single bounce specular raymarch reflection for heavy GPU ALU load
      vec3 rrd = reflect(rd, nor);
      float rt = 0.03;
      float reflLight = 0.0;
      for (int j = 0; j < 24; j++) {
        float rd2 = mapMenger(pos + rrd * rt).x;
        if (rd2 < 0.004) {
          reflLight = 1.0 / (1.0 + rt * 1.4);
          break;
        }
        rt += rd2 * 0.9;
        if (rt > 4.5) break;
      }

      vec3 baseMat = mix(vec3(0.08, 0.42, 0.75), vec3(0.95, 0.48, 0.16), clamp(trap, 0.0, 1.0));
      float fog = exp(-t * 0.22);
      col = baseMat * (0.18 + 0.92 * diff) + vec3(0.2, 0.9, 1.0) * (fres * 0.75 + reflLight * 0.65);
      col = mix(vec3(0.02, 0.05, 0.12), col, fog);
    }
    col += vec3(0.08, 0.58, 0.92) * glow * 0.12;
    col = (col * (2.51 * col + 0.03)) / (col * (2.43 * col + 0.59) + 0.14);
    gl_FragColor = vec4(pow(clamp(col, 0.0, 1.0), vec3(0.9)), 1.0);
  }
`;

const NEURAL_VERT = `
  uniform float uTime;
  uniform float uPointScale;
  attribute vec3 aSeed;
  attribute vec3 aColor;
  varying vec3 vColor;
  varying float vPulse;
  void main() {
    vec3 p = position;
    float wave = sin(length(p) * 1.4 - uTime * 3.1 + aSeed.x * 6.2831);
    float pulse = 0.5 + 0.5 * wave;
    p += normalize(p + vec3(0.0001)) * (wave * 0.22 * aSeed.y);
    float ang = uTime * (0.18 + aSeed.z * 0.15);
    float cs = cos(ang), sn = sin(ang);
    p.xz = mat2(cs, -sn, sn, cs) * p.xz;

    vec4 mvPos = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mvPos;
    gl_PointSize = clamp((uPointScale * (0.75 + pulse * 0.95)) / max(-mvPos.z, 0.6), 1.5, 18.0);
    vColor = aColor;
    vPulse = pulse;
  }
`;

const NEURAL_FRAG = `
  precision mediump float;
  varying vec3 vColor;
  varying float vPulse;
  void main() {
    vec2 c = gl_PointCoord - vec2(0.5);
    float d = dot(c, c);
    if (d > 0.25) discard;
    float core = exp(-d * 18.0);
    gl_FragColor = vec4(vColor * (0.65 + vPulse * 0.95) + vec3(0.25) * core, core * 0.9);
  }
`;

const NEBULA_FRAG = `
  precision highp float;
  uniform float uTime;
  uniform vec2 uResolution;
  uniform int uMaxSteps;
  varying vec2 vUv;

  float hash31(vec3 p) {
    p = fract(p * 0.1031);
    p += dot(p, p.yzx + 33.33);
    return fract((p.x + p.y) * p.z);
  }

  float noise3D(vec3 p) {
    vec3 i = floor(p);
    vec3 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float n000 = hash31(i + vec3(0.0, 0.0, 0.0));
    float n100 = hash31(i + vec3(1.0, 0.0, 0.0));
    float n010 = hash31(i + vec3(0.0, 1.0, 0.0));
    float n110 = hash31(i + vec3(1.0, 1.0, 0.0));
    float n001 = hash31(i + vec3(0.0, 0.0, 1.0));
    float n101 = hash31(i + vec3(1.0, 0.0, 1.0));
    float n011 = hash31(i + vec3(0.0, 1.0, 1.0));
    float n111 = hash31(i + vec3(1.0, 1.0, 1.0));
    return mix(
      mix(mix(n000, n100, f.x), mix(n010, n110, f.x), f.y),
      mix(mix(n001, n101, f.x), mix(n011, n111, f.x), f.y),
      f.z
    );
  }

  float fbm3D(vec3 p) {
    float v = 0.0;
    float a = 0.52;
    for (int i = 0; i < 4; i++) {
      v += a * noise3D(p);
      p = p * 2.04 + vec3(0.31, -0.47, 0.23);
      a *= 0.5;
    }
    return v;
  }

  void main() {
    vec2 uv = (gl_FragCoord.xy - 0.5 * uResolution) / min(uResolution.x, uResolution.y);
    float ang = uTime * 0.16;
    vec3 ro = vec3(sin(ang) * 3.6, sin(uTime * 0.21) * 0.9, cos(ang) * 3.6);
    vec3 fwd = normalize(-ro);
    vec3 right = normalize(cross(vec3(0.0, 1.0, 0.0), fwd));
    vec3 up = cross(fwd, right);
    vec3 rd = normalize(fwd * 1.45 + right * uv.x + up * uv.y);

    vec3 col = vec3(0.01, 0.015, 0.035);
    float trans = 1.0;
    float t = 0.4;
    float stepSize = 5.4 / float(uMaxSteps);

    for (int i = 0; i < 110; i++) {
      if (i >= uMaxSteps || trans < 0.03) break;
      vec3 p = ro + rd * t;
      float r = length(p);
      vec3 q = p * 0.85 + vec3(0.0, uTime * 0.12, -uTime * 0.09);
      float n = fbm3D(q + vec3(fbm3D(q * 1.4)));
      float density = max(0.0, n - 0.42) * exp(-r * 0.52);

      if (density > 0.002) {
        vec3 nebA = vec3(0.05, 0.65, 0.95);
        vec3 nebB = vec3(0.88, 0.22, 0.68);
        vec3 nebC = vec3(1.0, 0.72, 0.25);
        vec3 tint = mix(nebA, nebB, smoothstep(0.3, 0.85, n));
        tint = mix(tint, nebC, exp(-r * 1.3));
        float light = 0.4 + 1.8 / (0.35 + r * r);
        col += trans * tint * density * light * stepSize * 2.9;
        trans *= exp(-density * stepSize * 2.1);
      }
      t += stepSize;
    }

    // Central pulsar glow
    float coreDist = length(cross(rd, -ro));
    col += vec3(0.45, 0.88, 1.0) * exp(-coreDist * 7.5) * 0.85;
    col = 1.0 - exp(-col * 1.35);
    gl_FragColor = vec4(col, 1.0);
  }
`;

const BLACKHOLE_FRAG = `
  precision highp float;
  uniform float uTime;
  uniform vec2 uResolution;
  uniform int uMaxSteps;
  varying vec2 vUv;

  float hash21(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }

  float noise2(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(hash21(i), hash21(i + vec2(1.0, 0.0)), f.x),
      mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0, 1.0)), f.x),
      f.y
    );
  }

  void main() {
    vec2 uv = (gl_FragCoord.xy - 0.5 * uResolution) / min(uResolution.x, uResolution.y);
    float camA = uTime * 0.22;
    vec3 ro = vec3(sin(camA) * 6.2, 1.25 + sin(uTime * 0.3) * 0.45, cos(camA) * 6.2);
    vec3 fwd = normalize(-ro);
    vec3 right = normalize(cross(vec3(0.0, 1.0, 0.0), fwd));
    vec3 up = cross(fwd, right);
    vec3 rd = normalize(fwd * 1.65 + right * uv.x + up * uv.y);

    vec3 pos = ro;
    vec3 dir = rd;
    vec3 accum = vec3(0.0);
    bool captured = false;
    float dt = 0.14;

    for (int i = 0; i < 160; i++) {
      if (i >= uMaxSteps) break;
      float r2 = dot(pos, pos);
      float r = sqrt(r2);
      if (r < 0.88) {
        captured = true;
        break;
      }
      if (r > 18.0) break;

      // Gravitational lensing acceleration toward singularity
      vec3 acc = -1.35 * pos / max(r2 * r, 0.05);
      vec3 prevPos = pos;
      dir = normalize(dir + acc * dt);
      pos += dir * dt;

      // Relativistic accretion disk plane crossing (y = 0)
      if (prevPos.y * pos.y <= 0.0) {
        float frac = abs(prevPos.y) / max(abs(prevPos.y - pos.y), 0.0001);
        vec3 hit = mix(prevPos, pos, frac);
        float hr = length(hit.xz);
        if (hr > 1.28 && hr < 4.8) {
          float ang = atan(hit.z, hit.x);
          float swirl = ang * 3.0 + hr * 2.6 - uTime * 2.4;
          float bands = 0.55 + 0.45 * noise2(vec2(hr * 3.8, swirl));
          float ringMask = smoothstep(1.28, 1.65, hr) * (1.0 - smoothstep(3.3, 4.8, hr));
          // Relativistic Doppler beaming (approaching side brighter & bluer)
          float doppler = 0.65 + 0.55 * clamp(dot(normalize(vec3(-hit.z, 0.0, hit.x)), -dir), -1.0, 1.0);
          vec3 innerCol = vec3(0.95, 0.97, 1.0);
          vec3 midCol = vec3(1.0, 0.62, 0.18);
          vec3 outerCol = vec3(0.75, 0.16, 0.12);
          vec3 diskCol = mix(innerCol, midCol, smoothstep(1.3, 2.3, hr));
          diskCol = mix(diskCol, outerCol, smoothstep(2.3, 4.4, hr));
          accum += diskCol * bands * ringMask * doppler * 1.15;
        }
      }

      // Photon sphere halo
      float photon = exp(-abs(r - 1.32) * 9.0) * 0.045;
      accum += vec3(1.0, 0.78, 0.42) * photon;
    }

    if (!captured) {
      // Warped background starfield
      vec2 starUv = vec2(atan(dir.z, dir.x), asin(clamp(dir.y, -1.0, 1.0))) * 26.0;
      float st = hash21(floor(starUv));
      if (st > 0.985) {
        float tw = 0.5 + 0.5 * sin(uTime * 3.0 + st * 90.0);
        accum += mix(vec3(0.65, 0.85, 1.0), vec3(1.0, 0.88, 0.72), fract(st * 37.0)) * tw * 1.1;
      }
      float milk = exp(-abs(dir.y) * 5.0) * noise2(dir.xz * 4.0) * 0.16;
      accum += vec3(0.14, 0.24, 0.48) * milk;
    }

    accum = 1.0 - exp(-accum * 1.25);
    gl_FragColor = vec4(accum, 1.0);
  }
`;

const DNA_PARTICLE_VERT = `
  uniform float uTime;
  uniform float uPointScale;
  attribute vec3 aPhase;
  attribute vec3 aColor;
  varying vec3 vColor;
  varying float vGlow;
  void main() {
    float t = aPhase.x;
    float strand = aPhase.y;
    float radius = aPhase.z;
    float angle = t * 1.15 + uTime * 0.95 + strand * 3.14159265;
    float y = t * 1.35 + sin(uTime * 1.6 + t) * 0.15;
    vec3 p = vec3(cos(angle) * radius, y, sin(angle) * radius);
    vec4 mvPos = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mvPos;
    vGlow = 0.55 + 0.45 * sin(uTime * 3.4 + t * 2.2 + strand * 2.0);
    gl_PointSize = clamp((uPointScale * (0.8 + vGlow * 0.6)) / max(-mvPos.z, 0.8), 1.4, 15.0);
    vColor = aColor;
  }
`;

const DNA_PARTICLE_FRAG = `
  precision mediump float;
  varying vec3 vColor;
  varying float vGlow;
  void main() {
    vec2 c = gl_PointCoord - vec2(0.5);
    float d = dot(c, c);
    if (d > 0.25) discard;
    float a = exp(-d * 17.0);
    gl_FragColor = vec4(vColor * (0.7 + vGlow * 0.8), a * 0.88);
  }
`;

export class GpuStressEngine {
  private mountEl: HTMLElement | null = null;
  private renderer: THREE.WebGLRenderer | null = null;
  private composer: EffectComposer | null = null;
  private composerRT: THREE.WebGLRenderTarget | null = null;
  private renderPass: RenderPass | null = null;
  private bloomPass: UnrealBloomPass | null = null;
  private cinematicPass: ShaderPass | null = null;
  private postFxEnabled = true;
  private scene: THREE.Scene | null = null;
  private camera: THREE.PerspectiveCamera | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private envRenderTarget: THREE.WebGLRenderTarget | null = null;
  private backdropDome: THREE.Mesh | null = null;
  private backdropMat: THREE.ShaderMaterial | null = null;
  private animatedShaderMats: THREE.ShaderMaterial[] = [];
  private holoRingGroup: THREE.Group | null = null;

  // Active scene container & animated refs
  private activeGroup: THREE.Group | null = null;
  private fans: THREE.Group[] = [];
  private dieMaterial: THREE.MeshPhysicalMaterial | null = null;
  private vortexMesh: THREE.InstancedMesh | null = null;
  private vortexData: Float32Array = new Float32Array(0);

  // Extra scene animation refs
  private furmarkMaterials: THREE.ShaderMaterial[] = [];
  private furmarkDonutGroup: THREE.Group | null = null;
  private raymarchMat: THREE.ShaderMaterial | null = null;
  private raymarchOrthoCam: THREE.OrthographicCamera | null = null;
  private galaxyMat: THREE.ShaderMaterial | null = null;
  private galaxyCoreGroup: THREE.Group | null = null;
  private vramPlanes: THREE.Mesh[] = [];
  private geometrySculptures: THREE.Mesh[] = [];
  private cityTrafficMesh: THREE.InstancedMesh | null = null;
  private cityTrafficData: Float32Array = new Float32Array(0);
  private plasmaMat: THREE.ShaderMaterial | null = null;
  private plasmaOrbs: THREE.Mesh[] = [];
  private mengerMat: THREE.ShaderMaterial | null = null;
  private neuralMat: THREE.ShaderMaterial | null = null;
  private neuralShellGroup: THREE.Group | null = null;
  private nebulaMat: THREE.ShaderMaterial | null = null;
  private blackholeMat: THREE.ShaderMaterial | null = null;
  private crystalMesh: THREE.InstancedMesh | null = null;
  private crystalData: Float32Array = new Float32Array(0);
  private crystalCore: THREE.Mesh | null = null;
  private dnaMat: THREE.ShaderMaterial | null = null;
  private dnaGroup: THREE.Group | null = null;
  private cornellGroup: THREE.Group | null = null;
  private sssDragonGroup: THREE.Group | null = null;
  private clothMesh: THREE.Mesh | null = null;
  private clothStreamMesh: THREE.InstancedMesh | null = null;
  private godraysGroup: THREE.Group | null = null;
  private voronoiMesh: THREE.InstancedMesh | null = null;
  private voronoiData: Float32Array = new Float32Array(0);
  private supernovaGroup: THREE.Group | null = null;
  private warpTunnelMesh: THREE.InstancedMesh | null = null;
  private warpTunnelData: Float32Array = new Float32Array(0);
  private ferrofluidMesh: THREE.Mesh | null = null;
  private julia4dMat: THREE.ShaderMaterial | null = null;
  private tokamakGroup: THREE.Group | null = null;
  private metaballsGroup: THREE.Group | null = null;
  private oceanMesh: THREE.Mesh | null = null;
  private oceanFoamMesh: THREE.InstancedMesh | null = null;
  private cfdFluidMesh: THREE.InstancedMesh | null = null;
  private cfdFluidData: Float32Array = new Float32Array(0);
  private giTempleGroup: THREE.Group | null = null;
  private cernColliderGroup: THREE.Group | null = null;
  private exoplanetGroup: THREE.Group | null = null;
  private fireTornadoGroup: THREE.Group | null = null;
  private hypercubeGroup: THREE.Group | null = null;
  private voxelGiGroup: THREE.Group | null = null;
  private galaxyCollisionGroup: THREE.Group | null = null;
  private causticPoolGroup: THREE.Group | null = null;
  private apollonianGroup: THREE.Group | null = null;
  private mechaHangarGroup: THREE.Group | null = null;
  private magnetosphereGroup: THREE.Group | null = null;
  private geodeCaveGroup: THREE.Group | null = null;
  private qcdLatticeGroup: THREE.Group | null = null;
  private meshletGroup: THREE.Group | null = null;
  private causticPrismGroup: THREE.Group | null = null;
  private temporalCheckerGroup: THREE.Group | null = null;
  private sphFluidMesh: THREE.InstancedMesh | null = null;
  private sphFluidData: Float32Array | null = null;
  private rtHallGroup: THREE.Group | null = null;
  private volumetricCloudMat: THREE.ShaderMaterial | null = null;
  private cyberRainGroup: THREE.Group | null = null;
  private cyberRainMesh: THREE.InstancedMesh | null = null;
  private cyberRainData: Float32Array | null = null;
  private magmaCalderaGroup: THREE.Group | null = null;
  private magmaCalderaMat: THREE.ShaderMaterial | null = null;
  private magmaBombsMesh: THREE.InstancedMesh | null = null;
  private magmaBombsData: Float32Array | null = null;

  private isSoftwareGl = false;
  private rendererName = 'WebGL GPU';
  private running = false;
  private sceneMode: GpuSceneMode = 'vortex';
  private preset: GpuLoadPreset = 'high';
  private fpsMode: GpuFpsMode = 'uncapped';
  private frameHandle = 0;
  private frameHandleIsRaf = false;
  private uncappedBatchSize = 1;
  private lastUiYieldTime = 0;
  private startTime = 0;
  private lastFrameTime = 0;
  private lastMetricEmit = 0;
  private totalFramesRendered = 0;
  private windowFrames = 0;
  private animFrameTick = 0;
  private stormCloudGroup: THREE.Group | null = null;

  private pendingGpuSync: WebGLSync | null = null;
  private pendingSyncStartMs = 0;
  private pendingFramesInSlice = 1;
  private lastGpuFrameMs = 16;
  private renderScale = 1.0;
  private targetResolution: BenchmarkResolutionId = '1080p';
  private slowFrameStreak = 0;
  private fastFrameStreak = 0;
  private adaptiveThrottleActive = false;
  private baseRaymarchMaxSteps = 128;
  private baseMengerMaxSteps = 110;
  private baseNebulaMaxSteps = 56;
  private baseBlackholeMaxSteps = 96;
  private baseJulia4dMaxSteps = 116;
  private baseVolumetricCloudSteps = 28;

  private osdEl: HTMLElement | null = null;
  private osdForceVisible = true;
  private fsBtnEl: HTMLButtonElement | null = null;
  private postFxBtnEl: HTMLButtonElement | null = null;
  private osdToggleBtnEl: HTMLButtonElement | null = null;
  private fsStartStopBtnEl: HTMLButtonElement | null = null;
  private fsPrevBtnEl: HTMLButtonElement | null = null;
  private fsNextBtnEl: HTMLButtonElement | null = null;
  private fsChangeListener: (() => void) | null = null;

  private frameTimes: number[] = [];
  private allFpsSamples: number[] = [];
  private telemetry: GpuTelemetryPoint[] = [];
  private estTempC = 44;
  private peakTempC = 44;
  private metrics: GpuStressMetrics;
  private onMetrics: ((m: GpuStressMetrics) => void) | null = null;

  constructor() {
    const probe = detectSoftwareGl();
    this.isSoftwareGl = probe.isSoftwareGl;
    this.rendererName = probe.rendererName;
    this.metrics = this.createInitialMetrics();
  }

  private getSceneMeta(mode: GpuSceneMode): GpuSceneCatalogItem {
    return GPU_SCENE_CATALOG.find((s) => s.id === mode) || GPU_SCENE_CATALOG[0];
  }

  public createInitialMetrics(): GpuStressMetrics {
    const meta = this.getSceneMeta(this.sceneMode);
    return {
      running: false,
      sceneMode: this.sceneMode,
      sceneLabel: meta.name,
      workloadNote: meta.targetUnit,
      preset: this.preset,
      fpsMode: this.fpsMode,
      instanceCount: PRESET_CONFIG[this.preset].instances,
      resolution: this.targetResolution,
      triangles: 0,
      drawCalls: 0,
      fps: 0,
      avgFps: 0,
      minFps: 0,
      maxFps: 0,
      low1PctFps: 0,
      totalFramesRendered: 0,
      frameTimeMs: 0,
      stabilityPct: 100,
      estTempC: 44,
      peakTempC: 44,
      elapsedSec: 0,
      isSoftwareGl: this.isSoftwareGl,
      rendererName: this.rendererName,
      renderWidth: 0,
      renderHeight: 0,
      renderScalePct: 100,
      adaptiveThrottleActive: false,
      allocatedVramMB: 8192,
      textureVramMB: 4096,
      coreClockMhz: 2550,
      thermalThrottleActive: false,
      thermalThrottleRecent60s: false,
      telemetry: [],
      overallScore: 0,
      estFp32Tflops: 0,
      vramFillrateGBs: 0,
      verdict: 'OCZEKIWANIE',
    };
  }

  public getMetrics(): GpuStressMetrics {
    return { ...this.metrics, telemetry: [...this.telemetry] };
  }

  public isRunning(): boolean {
    return this.running;
  }

  public getSceneMode(): GpuSceneMode {
    return this.sceneMode;
  }

  private getFullscreenTarget(): HTMLElement | null {
    if (!this.mountEl) return null;
    return (this.mountEl.closest('.gpu-viewport-wrap') as HTMLElement | null) || this.mountEl;
  }

  private isInFullscreen(): boolean {
    const fsEl = document.fullscreenElement;
    if (!fsEl || !this.mountEl) return false;
    return fsEl === this.mountEl || fsEl === this.getFullscreenTarget() || fsEl.contains(this.mountEl);
  }

  private isFullscreenShaderScene(): boolean {
    return (
      this.sceneMode === 'raymarching' ||
      this.sceneMode === 'menger_sponge' ||
      this.sceneMode === 'volumetric_nebula' ||
      this.sceneMode === 'blackhole_lensing' ||
      this.sceneMode === 'fractal_julia4d'
    );
  }

  private setupComposer(width: number, height: number): void {
    this.composer?.dispose();
    this.composer = null;
    this.composerRT?.dispose();
    this.composerRT = null;
    this.bloomPass?.dispose();
    this.bloomPass = null;
    this.cinematicPass?.dispose();
    this.cinematicPass = null;
    this.renderPass = null;

    if (!this.renderer || !this.scene || !this.camera || this.isSoftwareGl) return;

    const maxSamples =
      typeof this.renderer.capabilities?.maxSamples === 'number'
        ? this.renderer.capabilities.maxSamples
        : 0;
    const safeSamples = maxSamples >= 2 ? Math.min(4, maxSamples) : 0;

    try {
      const composerRT = new THREE.WebGLRenderTarget(Math.max(1, width), Math.max(1, height), {
        type: THREE.HalfFloatType,
        samples: safeSamples,
      });
      const composer = new EffectComposer(this.renderer, composerRT);
      const renderPass = new RenderPass(this.scene, this.camera);
      const bloomPass = new UnrealBloomPass(new THREE.Vector2(width, height), 0.56, 0.48, 0.76);
      const cinematicPass = createCinematicGradePass(width, height, {
        sharpen: 0.36,
        chromatic: 0.0012,
        vignette: 0.22,
        vibrance: 0.14,
        contrast: 1.05,
      });
      const outputPass = new OutputPass();

      composer.addPass(renderPass);
      composer.addPass(bloomPass);
      composer.addPass(cinematicPass);
      composer.addPass(outputPass);

      this.composerRT = composerRT;
      this.composer = composer;
      this.renderPass = renderPass;
      this.bloomPass = bloomPass;
      this.cinematicPass = cinematicPass;
      this.syncPostFxParams();
    } catch {
      this.composer?.dispose();
      this.composer = null;
      this.composerRT?.dispose();
      this.composerRT = null;
      this.bloomPass?.dispose();
      this.bloomPass = null;
      this.cinematicPass?.dispose();
      this.cinematicPass = null;
      this.renderPass = null;
    }
  }

  private syncPostFxParams(): void {
    if (!this.bloomPass || !this.cinematicPass) return;
    const isShader = this.isFullscreenShaderScene();
    if (isShader) {
      // Gentle luminous halo on raymarched fractals/nebulae while keeping ultra-crisp micro-detail
      this.bloomPass.strength = 0.34;
      this.bloomPass.radius = 0.44;
      this.bloomPass.threshold = 0.84;
      this.cinematicPass.uniforms.uSharpen.value = 0.42;
      this.cinematicPass.uniforms.uChromatic.value = 0.0011;
      this.cinematicPass.uniforms.uVignette.value = 0.20;
      this.cinematicPass.uniforms.uVibrance.value = 0.12;
      this.cinematicPass.uniforms.uContrast.value = 1.04;
    } else {
      // Rich HDR Bloom + CAS crispness on 3D PBR, plasma, crystal, and showcase scenes
      this.bloomPass.strength = 0.58;
      this.bloomPass.radius = 0.48;
      this.bloomPass.threshold = 0.72;
      this.cinematicPass.uniforms.uSharpen.value = 0.34;
      this.cinematicPass.uniforms.uChromatic.value = 0.0013;
      this.cinematicPass.uniforms.uVignette.value = 0.24;
      this.cinematicPass.uniforms.uVibrance.value = 0.15;
      this.cinematicPass.uniforms.uContrast.value = 1.06;
    }
  }

  public getResolution(): BenchmarkResolutionId {
    return this.targetResolution;
  }

  public setResolution(res: BenchmarkResolutionId): void {
    this.targetResolution = res;
    this.metrics.resolution = res;
    this.applyRenderScale(false);
    this.emitMetrics();
  }

  private applyRenderScale(resetToSafeInitial = false): void {
    if (!this.mountEl || !this.renderer) return;
    const width = Math.max(320, this.mountEl.clientWidth);
    const height = Math.max(260, this.mountEl.clientHeight);
    const isHeavy = HEAVY_FRAGMENT_SCENES.has(this.sceneMode);
    const rawDpr = Math.min(window.devicePixelRatio || 1, 2);

    if (resetToSafeInitial) {
      this.renderScale = computeSafeInitialRenderScale(
        width,
        height,
        rawDpr,
        isHeavy,
        this.isSoftwareGl
      );
      this.slowFrameStreak = 0;
      this.fastFrameStreak = 0;
      this.adaptiveThrottleActive = this.renderScale < 0.98;
    }

    const gl = this.renderer.getContext();
    const maxHwDim = Number(gl?.getParameter?.(gl.MAX_RENDERBUFFER_SIZE) || 8192);
    const buf = computeSafeBenchmarkBufferSize(this.targetResolution, this.renderScale, maxHwDim);
    const drawW = buf.drawWidth;
    const drawH = buf.drawHeight;

    this.renderer.setPixelRatio(1);
    this.renderer.setSize(drawW, drawH, false);
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    this.renderer.domElement.style.display = 'block';

    const sz = new THREE.Vector2();
    this.renderer.getDrawingBufferSize(sz);
    this.metrics.resolution = this.targetResolution;
    this.metrics.renderWidth = Math.round(sz.x || drawW);
    this.metrics.renderHeight = Math.round(sz.y || drawH);
    this.metrics.renderScalePct = Math.round(this.renderScale * 100);
    this.metrics.adaptiveThrottleActive = this.adaptiveThrottleActive;

    if (this.composer) {
      this.composer.setPixelRatio(1);
      this.composer.setSize(drawW, drawH);
    }
    if (this.bloomPass) {
      this.bloomPass.setSize(Math.max(1, Math.round(sz.x || drawW)), Math.max(1, Math.round(sz.y || drawH)));
    }
    if (this.cinematicPass) {
      this.cinematicPass.uniforms.uResolution.value.set(Math.max(1, sz.x || drawW), Math.max(1, sz.y || drawH));
    }
    this.syncPostFxParams();

    if (this.raymarchMat) {
      this.raymarchMat.uniforms.uResolution.value.copy(sz);
      this.raymarchMat.uniforms.uMaxSteps.value = computeAdaptiveRaymarchSteps(
        this.baseRaymarchMaxSteps,
        this.renderScale,
        64
      );
    }
    if (this.mengerMat) {
      this.mengerMat.uniforms.uResolution.value.copy(sz);
      this.mengerMat.uniforms.uMaxSteps.value = computeAdaptiveRaymarchSteps(
        this.baseMengerMaxSteps,
        this.renderScale,
        48
      );
    }
    if (this.nebulaMat) {
      this.nebulaMat.uniforms.uResolution.value.copy(sz);
      this.nebulaMat.uniforms.uMaxSteps.value = computeAdaptiveRaymarchSteps(
        this.baseNebulaMaxSteps,
        this.renderScale,
        24
      );
    }
    if (this.blackholeMat) {
      this.blackholeMat.uniforms.uResolution.value.copy(sz);
      this.blackholeMat.uniforms.uMaxSteps.value = computeAdaptiveRaymarchSteps(
        this.baseBlackholeMaxSteps,
        this.renderScale,
        36
      );
    }
    if (this.julia4dMat) {
      this.julia4dMat.uniforms.uResolution.value.copy(sz);
      this.julia4dMat.uniforms.uMaxSteps.value = computeAdaptiveRaymarchSteps(
        this.baseJulia4dMaxSteps,
        this.renderScale,
        56
      );
    }
    if (this.volumetricCloudMat) {
      this.volumetricCloudMat.uniforms.uResolution.value.copy(sz);
      if (this.volumetricCloudMat.uniforms.uSteps) {
        this.volumetricCloudMat.uniforms.uSteps.value = computeAdaptiveRaymarchSteps(
          this.baseVolumetricCloudSteps,
          this.renderScale,
          16
        );
      }
    }
  }

  private updateOsdOverlay(): void {
    const inFs = this.isInFullscreen();
    const shouldShow = inFs || this.osdForceVisible;
    const shell = this.getFullscreenTarget();
    if (shell && shell !== this.mountEl) {
      shell.classList.toggle('osd-active', shouldShow);
    }
    if (this.osdEl) {
      this.osdEl.classList.toggle('visible', shouldShow);
      if (shouldShow) {
        const liveTemp = thermalMonitorService.getLiveGpuTempC();
        this.osdEl.innerHTML = renderGpuOsdHtml(this.metrics, liveTemp, this.frameTimes, inFs);
      }
    }
    if (this.fsBtnEl) {
      this.fsBtnEl.innerHTML = inFs ? '✕ Wyjdź (ESC)' : '⛶ Pełny ekran';
      this.fsBtnEl.classList.toggle('danger', inFs);
    }
    if (this.postFxBtnEl) {
      const fxActive = this.postFxEnabled && !this.isSoftwareGl && Boolean(this.composer);
      this.postFxBtnEl.classList.toggle('active', fxActive);
      this.postFxBtnEl.textContent = fxActive ? '✨ Post-FX: ULTRA' : '✨ Post-FX: WYŁ.';
    }
    if (this.osdToggleBtnEl) {
      this.osdToggleBtnEl.classList.toggle('active', shouldShow);
      this.osdToggleBtnEl.textContent = shouldShow ? '📊 OSD: WŁ.' : '📊 OSD: WYŁ.';
    }
    if (this.fsStartStopBtnEl) {
      this.fsStartStopBtnEl.style.display = 'inline-flex';
      this.fsStartStopBtnEl.textContent = this.running ? '⏹ Stop' : '▶ Start';
      this.fsStartStopBtnEl.classList.toggle('danger', this.running);
    }
    if (this.fsPrevBtnEl) this.fsPrevBtnEl.style.display = inFs ? 'inline-flex' : 'none';
    if (this.fsNextBtnEl) this.fsNextBtnEl.style.display = inFs ? 'inline-flex' : 'none';
  }

  private cycleScene(delta: number): void {
    const idx = GPU_SCENE_CATALOG.findIndex((s) => s.id === this.sceneMode);
    const nextIdx = (idx + delta + GPU_SCENE_CATALOG.length) % GPU_SCENE_CATALOG.length;
    this.setSceneMode(GPU_SCENE_CATALOG[nextIdx].id);
  }

  public mount(container: HTMLElement, onMetrics: (m: GpuStressMetrics) => void): void {
    if (this.mountEl === container && this.renderer) {
      this.onMetrics = onMetrics;
      this.updateOsdOverlay();
      onMetrics(this.getMetrics());
      return;
    }

    this.unmount();
    this.mountEl = container;
    this.onMetrics = onMetrics;

    const width = Math.max(320, container.clientWidth);
    const height = Math.max(260, container.clientHeight);

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: !this.isSoftwareGl,
        powerPreference: 'high-performance',
      });
    } catch {
      container.innerHTML =
        '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:#94a3b8;font-family:var(--font-mono);font-size:13px;padding:16px;text-align:center;">Brak dostępnego kontekstu WebGL w tym środowisku.</div>';
      return;
    }
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    renderer.shadowMap.enabled = !this.isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    container.innerHTML = '';
    container.style.position = container.style.position || 'relative';
    container.appendChild(renderer.domElement);
    this.renderer = renderer;

    // Live RTSS-style telemetry OSD mounted inside canvas container (always visible in fullscreen)
    const osdEl = document.createElement('div');
    osdEl.id = 'gpu-live-osd';
    osdEl.className = 'gpu-live-osd';
    osdEl.setAttribute('aria-live', 'polite');
    container.appendChild(osdEl);
    this.osdEl = osdEl;

    // Top-right fullscreen + OSD + scene controls toolbar
    const toolbar = document.createElement('div');
    toolbar.className = 'gpu-fs-toolbar';

    const prevBtn = document.createElement('button');
    prevBtn.type = 'button';
    prevBtn.className = 'gpu-fs-btn';
    prevBtn.title = 'Poprzednia scena 3D';
    prevBtn.textContent = '⏮';
    prevBtn.style.display = 'none';
    prevBtn.onclick = () => this.cycleScene(-1);
    this.fsPrevBtnEl = prevBtn;

    const nextBtn = document.createElement('button');
    nextBtn.type = 'button';
    nextBtn.className = 'gpu-fs-btn';
    nextBtn.title = 'Następna scena 3D';
    nextBtn.textContent = '⏭';
    nextBtn.style.display = 'none';
    nextBtn.onclick = () => this.cycleScene(1);
    this.fsNextBtnEl = nextBtn;

    const startStopBtn = document.createElement('button');
    startStopBtn.type = 'button';
    startStopBtn.className = 'gpu-fs-btn';
    startStopBtn.title = 'Start / Stop stres-testu GPU';
    startStopBtn.textContent = this.running ? '⏹ Stop' : '▶ Start';
    startStopBtn.style.display = 'none';
    startStopBtn.onclick = () => {
      if (this.running) this.stop();
      else this.start();
    };
    this.fsStartStopBtnEl = startStopBtn;

    const postFxBtn = document.createElement('button');
    postFxBtn.type = 'button';
    postFxBtn.id = 'gpu-postfx-toggle-btn';
    postFxBtn.className = 'gpu-fs-btn';
    postFxBtn.title = 'Włącz / wyłącz HDR Bloom, wyostrzanie CAS i grading kinowy';
    postFxBtn.textContent = '✨ Post-FX: ULTRA';
    postFxBtn.onclick = () => {
      this.postFxEnabled = !this.postFxEnabled;
      this.updateOsdOverlay();
      if (!this.running) {
        this.renderSingleFrame();
      }
    };
    this.postFxBtnEl = postFxBtn;

    const osdToggleBtn = document.createElement('button');
    osdToggleBtn.type = 'button';
    osdToggleBtn.id = 'gpu-osd-toggle-btn';
    osdToggleBtn.className = 'gpu-fs-btn';
    osdToggleBtn.title = 'Pokaż / ukryj panel telemetrii FPS / GPU OSD';
    osdToggleBtn.textContent = '📊 OSD';
    osdToggleBtn.onclick = () => {
      this.osdForceVisible = !this.osdForceVisible;
      this.updateOsdOverlay();
    };
    this.osdToggleBtnEl = osdToggleBtn;

    const fsBtn = document.createElement('button');
    fsBtn.type = 'button';
    fsBtn.className = 'gpu-fs-btn';
    fsBtn.innerHTML = '⛶ Pełny ekran';
    fsBtn.onclick = () => {
      if (!document.fullscreenElement) {
        const target = this.getFullscreenTarget() || container;
        target.requestFullscreen?.().catch(() => {
          container.requestFullscreen?.().catch(() => {});
        });
        if (!this.running) {
          this.start();
        }
      } else {
        document.exitFullscreen?.().catch(() => {});
      }
    };
    this.fsBtnEl = fsBtn;

    toolbar.appendChild(prevBtn);
    toolbar.appendChild(nextBtn);
    toolbar.appendChild(startStopBtn);
    toolbar.appendChild(postFxBtn);
    toolbar.appendChild(osdToggleBtn);
    toolbar.appendChild(fsBtn);
    container.appendChild(toolbar);

    this.fsChangeListener = () => {
      this.applyRenderScale(true);
      this.handleResize();
      this.updateOsdOverlay();
      this.emitMetrics();
    };
    document.addEventListener('fullscreenchange', this.fsChangeListener);

    renderer.domElement.addEventListener('webglcontextlost', (e) => {
      e.preventDefault();
      this.stop();
    });

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x060911);
    scene.fog = new THREE.FogExp2(0x060911, 0.032);
    this.scene = scene;

    this.envRenderTarget = createCinematicHdrEnvironment(renderer, 'studio_cyber');
    if (this.envRenderTarget) {
      scene.environment = this.envRenderTarget.texture;
      scene.environmentIntensity = 1.85;
    }

    const backdrop = createCinematicBackdropDome(0x040814, 0x0d2547, 0x06b6d4);
    this.backdropDome = backdrop.mesh;
    this.backdropMat = backdrop.material;
    scene.add(backdrop.mesh);

    const camera = new THREE.PerspectiveCamera(48, width / height, 0.1, 160);
    camera.position.set(0, 3.3, 7.6);
    camera.lookAt(0, 0.85, 0);
    this.camera = camera;

    this.raymarchOrthoCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    // Shared balanced 3-point + dual studio softbox cinematic lighting rig
    const hemi = new THREE.HemisphereLight(0xb8e2ff, 0x1a2639, 1.48);
    scene.add(hemi);

    const keyLight = new THREE.DirectionalLight(0xfff1dc, 2.95);
    keyLight.position.set(6, 9, 6);
    if (!this.isSoftwareGl) {
      keyLight.castShadow = true;
      keyLight.shadow.mapSize.set(2048, 2048);
      keyLight.shadow.camera.left = -6;
      keyLight.shadow.camera.right = 6;
      keyLight.shadow.camera.top = 6;
      keyLight.shadow.camera.bottom = -6;
      keyLight.shadow.bias = -0.0004;
      keyLight.shadow.normalBias = 0.02;
      keyLight.shadow.radius = 3.5;
    }
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0x06b6d4, 2.25);
    rimLight.position.set(-7, 4, -6);
    scene.add(rimLight);

    const accentPoint = new THREE.PointLight(0x22d3ee, 2.6, 16);
    accentPoint.position.set(0, 2.4, 2.2);
    scene.add(accentPoint);

    if (!this.isSoftwareGl) {
      try {
        RectAreaLightUniformsLib.init();
        const topSoftbox = new THREE.RectAreaLight(0xe0f2fe, 3.2, 6.5, 2.8);
        topSoftbox.position.set(0, 6.2, 1.8);
        topSoftbox.lookAt(0, 0.6, 0);
        scene.add(topSoftbox);

        const sideSoftbox = new THREE.RectAreaLight(0x38bdf8, 2.4, 5.2, 2.2);
        sideSoftbox.position.set(-5.8, 3.2, 2.4);
        sideSoftbox.lookAt(0, 0.7, 0);
        scene.add(sideSoftbox);
      } catch {
        // Fallback silently on constrained WebGL contexts
      }
    }

    this.buildActiveScene();
    this.setupComposer(width, height);
    this.applyRenderScale(true);

    this.renderSingleFrame();
    this.metrics.triangles = renderer.info.render.triangles;
    this.metrics.drawCalls = renderer.info.render.calls;
    this.updateOsdOverlay();
    this.emitMetrics();

    this.resizeObserver = new ResizeObserver(() => this.handleResize());
    this.resizeObserver.observe(container);
  }

  private clearActiveGroup(): void {
    if (this.activeGroup && this.scene) {
      this.scene.remove(this.activeGroup);
      this.activeGroup.traverse((obj) => {
        const disposable = obj as unknown as { dispose?: () => void };
        if (typeof disposable.dispose === 'function') {
          disposable.dispose();
        }
        if ((obj as THREE.Mesh).isMesh || (obj as THREE.Points).isPoints) {
          const m = obj as THREE.Mesh;
          m.geometry?.dispose();
          const disposeMat = (mat: THREE.Material) => {
            const anyMat = mat as unknown as Record<string, unknown>;
            for (const key of ['map', 'normalMap', 'roughnessMap', 'emissiveMap', 'bumpMap']) {
              if (anyMat[key] && typeof (anyMat[key] as THREE.Texture).dispose === 'function') {
                (anyMat[key] as THREE.Texture).dispose();
              }
            }
            mat.dispose();
          };
          if (Array.isArray(m.material)) m.material.forEach(disposeMat);
          else if (m.material) disposeMat(m.material);
        }
      });
    }
    this.activeGroup = null;
    this.animatedShaderMats = [];
    this.holoRingGroup = null;
    this.fans = [];
    this.dieMaterial = null;
    this.vortexMesh = null;
    this.vortexData = new Float32Array(0);
    this.furmarkMaterials = [];
    this.furmarkDonutGroup = null;
    this.raymarchMat = null;
    this.galaxyMat = null;
    this.galaxyCoreGroup = null;
    this.vramPlanes = [];
    this.geometrySculptures = [];
    this.cityTrafficMesh = null;
    this.cityTrafficData = new Float32Array(0);
    this.plasmaMat = null;
    this.plasmaOrbs = [];
    this.mengerMat = null;
    this.neuralMat = null;
    this.neuralShellGroup = null;
    this.nebulaMat = null;
    this.blackholeMat = null;
    this.crystalMesh = null;
    this.crystalData = new Float32Array(0);
    this.crystalCore = null;
    this.dnaMat = null;
    this.dnaGroup = null;
    this.cornellGroup = null;
    this.sssDragonGroup = null;
    this.clothMesh = null;
    this.clothStreamMesh = null;
    this.godraysGroup = null;
    this.voronoiMesh = null;
    this.voronoiData = new Float32Array(0);
    this.supernovaGroup = null;
    this.warpTunnelMesh = null;
    this.warpTunnelData = new Float32Array(0);
    this.ferrofluidMesh = null;
    this.julia4dMat = null;
    this.tokamakGroup = null;
    this.metaballsGroup = null;
    this.oceanMesh = null;
    this.oceanFoamMesh = null;
    this.cfdFluidMesh = null;
    this.cfdFluidData = new Float32Array(0);
    this.giTempleGroup = null;
    this.cernColliderGroup = null;
    this.exoplanetGroup = null;
    this.fireTornadoGroup = null;
    this.hypercubeGroup = null;
    this.voxelGiGroup = null;
    this.galaxyCollisionGroup = null;
    this.causticPoolGroup = null;
    this.apollonianGroup = null;
    this.mechaHangarGroup = null;
    this.magnetosphereGroup = null;
    this.geodeCaveGroup = null;
    this.qcdLatticeGroup = null;
    this.meshletGroup = null;
    this.causticPrismGroup = null;
    this.temporalCheckerGroup = null;
    this.sphFluidMesh = null;
    this.sphFluidData = null;
    this.rtHallGroup = null;
    this.volumetricCloudMat = null;
    this.stormCloudGroup = null;
    this.cyberRainGroup = null;
    this.cyberRainMesh = null;
    this.cyberRainData = null;
    this.magmaCalderaGroup = null;
    this.magmaCalderaMat = null;
    this.magmaBombsMesh = null;
    this.magmaBombsData = null;
  }

  private buildActiveScene(): void {
    if (!this.scene || !this.renderer || !this.camera) return;
    this.clearActiveGroup();

    const group = new THREE.Group();
    this.activeGroup = group;
    this.scene.add(group);

    const meta = this.getSceneMeta(this.sceneMode);
    this.metrics.sceneMode = this.sceneMode;
    this.metrics.sceneLabel = meta.name;
    this.metrics.workloadNote = meta.targetUnit;
    if (this.backdropDome) {
      this.backdropDome.visible = !this.isFullscreenShaderScene();
    }

    switch (this.sceneMode) {
      case 'vortex':
        this.buildVortexScene(group);
        break;
      case 'furmark':
        this.buildFurmarkScene(group);
        break;
      case 'raymarching':
        this.buildRaymarchingScene(group);
        break;
      case 'galaxy':
        this.buildGalaxyScene(group);
        break;
      case 'vram_fill':
        this.buildVramOverdrawScene(group);
        break;
      case 'geometry':
        this.buildGeometryTortureScene(group);
        break;
      case 'cyber_city':
        this.buildCyberCityScene(group);
        break;
      case 'fluid_plasma':
        this.buildFluidPlasmaScene(group);
        break;
      case 'menger_sponge':
        this.buildMengerSpongeScene(group);
        break;
      case 'neural_lattice':
        this.buildNeuralLatticeScene(group);
        break;
      case 'volumetric_nebula':
        this.buildVolumetricNebulaScene(group);
        break;
      case 'crystal_caustics':
        this.buildCrystalCausticsScene(group);
        break;
      case 'blackhole_lensing':
        this.buildBlackholeLensingScene(group);
        break;
      case 'dna_megastructure':
        this.buildDnaMegastructureScene(group);
        break;
      case 'pathtraced_cornell':
        this.buildPathtracedCornellScene(group);
        break;
      case 'subsurface_dragon':
        this.buildSubsurfaceDragonScene(group);
        break;
      case 'cloth_aerodynamics':
        this.buildClothAerodynamicsScene(group);
        break;
      case 'volumetric_godrays':
        this.buildVolumetricGodraysScene(group);
        break;
      case 'voronoi_shatter':
        this.buildVoronoiShatterScene(group);
        break;
      case 'supernova_remnant':
        this.buildSupernovaRemnantScene(group);
        break;
      case 'cyber_tunnel_warp':
        this.buildCyberTunnelWarpScene(group);
        break;
      case 'magnetic_ferrofluid':
        this.buildMagneticFerrofluidScene(group);
        break;
      case 'fractal_julia4d':
        this.buildFractalJulia4dScene(group);
        break;
      case 'tokamak_fusion':
        this.buildTokamakFusionScene(group);
        break;
      case 'raytraced_metaballs':
        this.buildRaytracedMetaballsScene(group);
        break;
      case 'ocean_gerstner_fft':
        this.buildOceanGerstnerFftScene(group);
        break;
      case 'fluid_navier_stokes':
        this.buildFluidNavierStokesScene(group);
        break;
      case 'gi_radiosity_temple':
        this.buildGiRadiosityTempleScene(group);
        break;
      case 'particle_collider_cern':
        this.buildParticleColliderCernScene(group);
        break;
      case 'procedural_planet_atmo':
        this.buildProceduralPlanetAtmoScene(group);
        break;
      case 'volumetric_fire_tornado':
        this.buildVolumetricFireTornadoScene(group);
        break;
      case 'cyber_matrix_hypercube':
        this.buildCyberMatrixHypercubeScene(group);
        break;
      case 'voxel_pathtracer':
        this.buildVoxelPathtracerScene(group);
        break;
      case 'nbody_galaxy_collision':
        this.buildNbodyGalaxyCollisionScene(group);
        break;
      case 'caustic_water_pool':
        this.buildCausticWaterPoolScene(group);
        break;
      case 'fractal_apollonian':
        this.buildFractalApollonianScene(group);
        break;
      case 'cyber_mecha_hangar':
        this.buildCyberMechaHangarScene(group);
        break;
      case 'plasma_magnetosphere':
        this.buildPlasmaMagnetosphereScene(group);
        break;
      case 'crystal_geode_cave':
        this.buildCrystalGeodeCaveScene(group);
        break;
      case 'quantum_chromodynamics':
        this.buildQuantumChromodynamicsScene(group);
        break;
      case 'meshlet_nanite_cluster':
        this.buildMeshletNaniteClusterScene(group);
        break;
      case 'caustic_raytrace_prism':
        this.buildCausticRaytracePrismScene(group);
        break;
      case 'temporal_aa_checker':
        this.buildTemporalAaCheckerScene(group);
        break;
      case 'sph_fluid_compute':
        this.buildSphFluidComputeScene(group);
        break;
      case 'rt_reflections_hall':
        this.buildRtReflectionsHallScene(group);
        break;
      case 'volumetric_clouds_4k':
        this.buildVolumetricClouds4kScene(group);
        break;
      case 'cyber_rain_neon':
        this.buildCyberRainNeonScene(group);
        break;
      case 'magma_caldera_sim':
        this.buildMagmaCalderaSimScene(group);
        break;
    }
  }

  /* === SCENE 1: Flagship GPU Core Rig + Real-Time Mirror Floor + Volumetric Studio + Crystal Vortex === */
  private buildVortexScene(group: THREE.Group): void {
    if (!this.renderer || !this.camera) return;
    this.camera.position.set(0, 3.4, 8.6);
    this.camera.lookAt(0, 0.85, 0);

    const maxAniso = this.renderer.capabilities.getMaxAnisotropy();

    // Real-time planar mirror reflector beneath translucent obsidian glass studio deck
    const mirror = createPlanarReflector({
      geometry: new THREE.CircleGeometry(9.2, 64),
      y: -0.036,
      color: 0x6b84a8,
      textureSize: 768,
      isSoftwareGl: this.isSoftwareGl,
    });
    if (mirror) group.add(mirror);

    // Reflective obsidian/titanium studio turntable deck with clearcoat PBR finish
    const deckTex = createStudioFloorDeckTextures(maxAniso);
    const deckMat = new THREE.MeshPhysicalMaterial({
      map: deckTex.map,
      roughnessMap: deckTex.roughnessMap,
      metalness: 0.52,
      roughness: 0.34,
      clearcoat: 1.0,
      clearcoatRoughness: 0.08,
      transparent: Boolean(mirror),
      opacity: mirror ? 0.56 : 1.0,
      polygonOffset: true,
      polygonOffsetFactor: 1,
      polygonOffsetUnits: 1,
    });
    const studioDeck = new THREE.Mesh(new THREE.CircleGeometry(9.2, 64), deckMat);
    studioDeck.rotation.x = -Math.PI / 2;
    studioDeck.position.y = -0.025;
    studioDeck.receiveShadow = !this.isSoftwareGl;
    group.add(studioDeck);

    group.add(this.buildGpuCoreRig(maxAniso));

    // Floating holographic telemetry rings + plasma energy core above GPU silicon die
    const holoGroup = new THREE.Group();
    holoGroup.position.set(0, 1.55, 0);
    const holoCore = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.24, 3),
      new THREE.MeshPhysicalMaterial({
        color: 0x38bdf8,
        emissive: 0x06b6d4,
        emissiveIntensity: 2.4,
        roughness: 0.08,
        metalness: 0.2,
        clearcoat: 1.0,
      })
    );
    holoGroup.add(holoCore);
    for (let r = 0; r < 3; r++) {
      const hRing = new THREE.Mesh(
        new THREE.TorusGeometry(0.46 + r * 0.2, 0.012, 10, 64),
        new THREE.MeshStandardMaterial({
          color: r === 1 ? 0xf59e0b : 0x38bdf8,
          emissive: r === 1 ? 0xf97316 : 0x06b6d4,
          emissiveIntensity: 2.1,
          roughness: 0.15,
          metalness: 0.4,
        })
      );
      hRing.rotation.set(r * 0.65, r * 0.9, 0);
      holoGroup.add(hRing);
    }
    this.holoRingGroup = holoGroup;
    group.add(holoGroup);

    // 4 Fresnel-soft volumetric studio spotlight shafts illuminating the flagship GPU
    const shafts = createVolumetricLightShafts({
      count: 4,
      ringRadius: 5.2,
      height: 8.8,
      topRadius: 0.26,
      bottomRadius: 2.4,
      colorHex: 0x38bdf8,
      opacity: 0.22,
      targetY: 0.4,
    });
    group.add(shafts.group);
    this.animatedShaderMats.push(shafts.material);

    // Floating HDR bokeh ember dust particles for cinematic depth
    const bokeh = createFloatingEmberBokeh({
      count: 220,
      radius: 7.4,
      height: 5.8,
      colorAHex: 0x38bdf8,
      colorBHex: 0xf59e0b,
      size: 28,
    });
    group.add(bokeh.points);
    this.animatedShaderMats.push(bokeh.material);

    // Dual HDR emissive perimeter rings around the GPU showcase deck (bloom-ready)
    const deckRing = new THREE.Mesh(
      new THREE.TorusGeometry(3.05, 0.026, 14, 96),
      new THREE.MeshStandardMaterial({
        color: 0x38bdf8,
        emissive: 0x06b6d4,
        emissiveIntensity: 2.1,
        roughness: 0.16,
        metalness: 0.35,
      })
    );
    deckRing.rotation.x = Math.PI / 2;
    deckRing.position.y = 0.02;
    group.add(deckRing);

    const outerRing = new THREE.Mesh(
      new THREE.TorusGeometry(4.65, 0.016, 10, 96),
      new THREE.MeshStandardMaterial({
        color: 0x818cf8,
        emissive: 0x6366f1,
        emissiveIntensity: 1.65,
        roughness: 0.22,
        metalness: 0.4,
      })
    );
    outerRing.rotation.x = Math.PI / 2;
    outerRing.position.y = 0.01;
    group.add(outerRing);

    const count = PRESET_CONFIG[this.preset].instances;
    // Keep crisp faceted crystals (never bloated spheres) and scale down slightly at 14k/32k
    const crystalRadius =
      this.preset === 'ultra' ? 0.038 : this.preset === 'extreme' ? 0.045 : 0.058;
    const geo = new THREE.OctahedronGeometry(crystalRadius, 0);
    const mat = new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      metalness: 0.92,
      roughness: 0.09,
      clearcoat: 1.0,
      clearcoatRoughness: 0.06,
      iridescence: 0.78,
      iridescenceIOR: 1.38,
    });

    const inst = new THREE.InstancedMesh(geo, mat, count);
    inst.frustumCulled = false;

    const data = new Float32Array(count * 4);
    for (let i = 0; i < count; i++) {
      const layer = i % 3;
      // Keep vortex ring cleanly between radius 3.15 and 6.15 so crystals never clip camera at r=8.8
      const radius = 3.15 + Math.random() * (layer === 0 ? 1.15 : layer === 1 ? 2.1 : 2.95);
      const angle = Math.random() * Math.PI * 2;
      const yBase = 0.28 + Math.random() * 2.55;
      const speed = (0.32 + Math.random() * 0.88) * (layer === 1 ? -1 : 1);

      data[i * 4] = radius;
      data[i * 4 + 1] = angle;
      data[i * 4 + 2] = yBase;
      data[i * 4 + 3] = speed;

      const scale = 0.62 + Math.random() * 0.45;
      _dummyObj.position.set(Math.cos(angle) * radius, yBase, Math.sin(angle) * radius);
      _dummyObj.rotation.set(angle, angle * 0.7, 0);
      _dummyObj.scale.setScalar(scale);
      _dummyObj.updateMatrix();
      inst.setMatrixAt(i, _dummyObj.matrix);

      const t = i / count;
      if (t < 0.62) _colorScratch.setHSL(0.52 + Math.random() * 0.05, 0.88, 0.56);
      else if (t < 0.86) _colorScratch.setHSL(0.59, 0.44, 0.66);
      else _colorScratch.setHSL(0.1, 0.95, 0.58);
      inst.setColorAt(i, _colorScratch);
    }

    inst.instanceMatrix.needsUpdate = true;
    if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
    inst.computeBoundingSphere();

    this.vortexData = data;
    this.vortexMesh = inst;
    group.add(inst);
    this.metrics.instanceCount = count;
  }

  /* === SCENE 2: FurMark 3D Plasma Donut (16-48 Volumetric Shell Layers + Mirror Floor + Embers) === */
  private buildFurmarkScene(group: THREE.Group): void {
    if (!this.camera || !this.renderer) return;
    this.camera.position.set(0, 0.75, 5.4);
    this.camera.lookAt(0, -0.1, 0);

    const shells =
      this.preset === 'ultra' ? 48 : this.preset === 'extreme' ? 34 : this.preset === 'high' ? 24 : 16;
    const octaves =
      this.preset === 'ultra' ? 6 : this.preset === 'extreme' ? 5 : this.preset === 'high' ? 4 : 3;
    const radialSegs = this.preset === 'ultra' ? 96 : 64;
    const tubularSegs = this.preset === 'ultra' ? 160 : 112;

    const donutGroup = new THREE.Group();
    const baseGeo = new THREE.TorusGeometry(1.55, 0.62, radialSegs, tubularSegs);

    for (let s = 0; s < shells; s++) {
      const shellNorm = s / Math.max(1, shells - 1);
      const mat = new THREE.ShaderMaterial({
        vertexShader: FURMARK_VERT,
        fragmentShader: FURMARK_FRAG,
        transparent: s > 0,
        depthWrite: s === 0,
        side: THREE.DoubleSide,
        uniforms: {
          uTime: { value: 0 },
          uShell: { value: shellNorm },
          uNoiseOctaves: { value: octaves },
        },
      });
      const mesh = new THREE.Mesh(baseGeo, mat);
      mesh.renderOrder = s;
      donutGroup.add(mesh);
      this.furmarkMaterials.push(mat);
    }

    // Inner blazing HDR plasma core ring
    const coreRing = new THREE.Mesh(
      new THREE.TorusGeometry(1.55, 0.15, 16, 80),
      new THREE.MeshStandardMaterial({
        color: 0xffe082,
        emissive: 0xff8c00,
        emissiveIntensity: 3.2,
        roughness: 0.12,
      })
    );
    donutGroup.add(coreRing);

    this.furmarkDonutGroup = donutGroup;
    group.add(donutGroup);

    // Real-time planar mirror floor directly under the blazing plasma torus
    const mirror = createPlanarReflector({
      geometry: new THREE.CircleGeometry(8.5, 64),
      y: -2.42,
      color: 0x7c5544,
      textureSize: 640,
      isSoftwareGl: this.isSoftwareGl,
    });
    if (mirror) group.add(mirror);

    const deckTex = createStudioFloorDeckTextures(this.renderer.capabilities.getMaxAnisotropy());
    const floorDisc = new THREE.Mesh(
      new THREE.CircleGeometry(8.5, 64),
      new THREE.MeshPhysicalMaterial({
        map: deckTex.map,
        roughnessMap: deckTex.roughnessMap,
        metalness: 0.45,
        roughness: 0.32,
        clearcoat: 1.0,
        clearcoatRoughness: 0.1,
        transparent: Boolean(mirror),
        opacity: mirror ? 0.54 : 1.0,
      })
    );
    floorDisc.rotation.x = -Math.PI / 2;
    floorDisc.position.y = -2.4;
    group.add(floorDisc);

    // Warm furnace volumetric light shafts + rising glowing ember bokeh sparks
    const shafts = createVolumetricLightShafts({
      count: 4,
      ringRadius: 4.5,
      height: 8.5,
      colorHex: 0xf97316,
      opacity: 0.18,
      targetY: -1.8,
    });
    group.add(shafts.group);
    this.animatedShaderMats.push(shafts.material);

    const embers = createFloatingEmberBokeh({
      count: 260,
      radius: 5.5,
      height: 6.2,
      colorAHex: 0xf97316,
      colorBHex: 0xfde047,
      size: 32,
    });
    embers.points.position.y = -2.2;
    group.add(embers.points);
    this.animatedShaderMats.push(embers.material);

    this.metrics.instanceCount = shells;
  }

  /* === SCENE 3: Full-Screen GLSL 3D Mandelbulb Raymarching === */
  private buildRaymarchingScene(group: THREE.Group): void {
    if (!this.renderer) return;
    const size = new THREE.Vector2();
    this.renderer.getDrawingBufferSize(size);

    const maxSteps =
      this.preset === 'ultra' ? 256 : this.preset === 'extreme' ? 192 : this.preset === 'high' ? 128 : 72;
    this.baseRaymarchMaxSteps = maxSteps;
    const fractalIter =
      this.preset === 'ultra' ? 11 : this.preset === 'extreme' ? 9 : this.preset === 'high' ? 7 : 5;

    const mat = new THREE.ShaderMaterial({
      vertexShader: RAYMARCH_VERT,
      fragmentShader: RAYMARCH_FRAG,
      depthTest: false,
      depthWrite: false,
      uniforms: {
        uTime: { value: 0 },
        uResolution: { value: size },
        uMaxSteps: { value: maxSteps },
        uFractalIter: { value: fractalIter },
      },
    });
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat);
    quad.frustumCulled = false;
    group.add(quad);
    this.raymarchMat = mat;
    this.metrics.instanceCount = maxSteps;
  }

  /* === SCENE 4: 350,000 Particle Spiral Galaxy & Black Hole === */
  private buildGalaxyScene(group: THREE.Group): void {
    if (!this.camera) return;
    this.camera.position.set(0, 6.2, 11.5);
    this.camera.lookAt(0, 0, 0);

    const count =
      this.preset === 'ultra'
        ? 350000
        : this.preset === 'extreme'
          ? 200000
          : this.preset === 'high'
            ? 100000
            : 45000;

    const positions = new Float32Array(count * 3);
    const params = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const arms = 5;

    for (let i = 0; i < count; i++) {
      const r = 1.05 + Math.pow(Math.random(), 1.35) * 11.5;
      const armAngle = ((i % arms) / arms) * Math.PI * 2;
      const spiralTwist = r * 0.58;
      const scatter = (Math.random() - 0.5) * (0.45 + r * 0.14);
      const angle = armAngle + spiralTwist + scatter;
      const spreadY = (Math.random() - 0.5) * (0.45 + 1.8 / (0.6 + r));

      params[i * 3] = r;
      params[i * 3 + 1] = angle;
      params[i * 3 + 2] = spreadY;

      // Color gradient from blazing accretion gold -> electric cyan -> deep nebula violet
      const t = Math.min(1, (r - 1.0) / 10.5);
      if (t < 0.25) _colorScratch.setHSL(0.08 + t * 0.15, 0.98, 0.65);
      else if (t < 0.65) _colorScratch.setHSL(0.54 + (t - 0.25) * 0.2, 0.9, 0.62);
      else _colorScratch.setHSL(0.72 + (t - 0.65) * 0.22, 0.82, 0.56);

      colors[i * 3] = _colorScratch.r;
      colors[i * 3 + 1] = _colorScratch.g;
      colors[i * 3 + 2] = _colorScratch.b;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('aParams', new THREE.BufferAttribute(params, 3));
    geo.setAttribute('aColor', new THREE.BufferAttribute(colors, 3));

    const mat = new THREE.ShaderMaterial({
      vertexShader: GALAXY_VERT,
      fragmentShader: GALAXY_FRAG,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uTime: { value: 0 },
        uPointScale: { value: this.renderer ? Math.min(window.devicePixelRatio, 2) * 26.0 : 26.0 },
      },
    });
    const pts = new THREE.Points(geo, mat);
    pts.frustumCulled = false;
    group.add(pts);
    this.galaxyMat = mat;

    // Event Horizon + glowing photon ring + relativistic jets
    const core = new THREE.Group();
    const horizon = new THREE.Mesh(
      new THREE.SphereGeometry(0.85, 48, 32),
      new THREE.MeshBasicMaterial({ color: 0x000000 })
    );
    const photonRing = new THREE.Mesh(
      new THREE.TorusGeometry(1.06, 0.09, 24, 96),
      new THREE.MeshBasicMaterial({ color: 0xffb703 })
    );
    photonRing.rotation.x = Math.PI / 2;
    const outerHalo = new THREE.Mesh(
      new THREE.TorusGeometry(1.32, 0.04, 16, 96),
      new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.75 })
    );
    outerHalo.rotation.x = Math.PI / 2.2;
    const jetMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.35,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const jetTop = new THREE.Mesh(new THREE.ConeGeometry(0.32, 5.5, 24, 1, true), jetMat);
    jetTop.position.y = 3.2;
    jetTop.rotation.x = Math.PI;
    const jetBot = new THREE.Mesh(new THREE.ConeGeometry(0.32, 5.5, 24, 1, true), jetMat);
    jetBot.position.y = -3.2;

    core.add(horizon, photonRing, outerHalo, jetTop, jetBot);
    group.add(core);
    this.galaxyCoreGroup = core;
    this.metrics.instanceCount = count;
  }

  /* === SCENE 5: VRAM 4K Procedural Textures & Heavy Multi-Layer Transparent Overdraw === */
  private buildVramOverdrawScene(group: THREE.Group): void {
    if (!this.camera || !this.renderer) return;
    this.camera.position.set(0, 0, 6.4);
    this.camera.lookAt(0, 0, -6);

    const texSize = this.preset === 'ultra' ? 2048 : this.preset === 'extreme' ? 1536 : 1024;
    const layerCount =
      this.preset === 'ultra' ? 76 : this.preset === 'extreme' ? 52 : this.preset === 'high' ? 34 : 20;

    // Create high-res procedural PBR texture maps to exercise VRAM bandwidth & TMU cache
    const makeHiResTex = (seed: number): THREE.CanvasTexture => {
      const c = document.createElement('canvas');
      c.width = texSize;
      c.height = texSize;
      const ctx = c.getContext('2d')!;
      const g = ctx.createRadialGradient(
        texSize * 0.5,
        texSize * 0.5,
        texSize * 0.06,
        texSize * 0.5,
        texSize * 0.5,
        texSize * 0.5
      );
      g.addColorStop(0, seed === 0 ? 'rgba(6, 182, 212, 0.85)' : 'rgba(245, 158, 11, 0.85)');
      g.addColorStop(0.55, seed === 0 ? 'rgba(37, 99, 235, 0.45)' : 'rgba(168, 85, 247, 0.45)');
      g.addColorStop(1, 'rgba(6, 9, 17, 0.05)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, texSize, texSize);

      ctx.strokeStyle = 'rgba(255,255,255,0.22)';
      ctx.lineWidth = Math.max(2, texSize / 256);
      const rings = 18;
      for (let r = 1; r <= rings; r++) {
        ctx.beginPath();
        ctx.arc(texSize / 2, texSize / 2, (r / rings) * (texSize * 0.48), 0, Math.PI * 2);
        ctx.stroke();
      }
      for (let a = 0; a < 36; a++) {
        const rad = (a / 36) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(texSize / 2, texSize / 2);
        ctx.lineTo(
          texSize / 2 + Math.cos(rad) * texSize * 0.49,
          texSize / 2 + Math.sin(rad) * texSize * 0.49
        );
        ctx.stroke();
      }

      const tex = new THREE.CanvasTexture(c);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = this.renderer!.capabilities.getMaxAnisotropy();
      tex.needsUpdate = true;
      return tex;
    };

    const texA = makeHiResTex(0);
    const texB = makeHiResTex(1);
    const planeGeo = new THREE.PlaneGeometry(7.2, 7.2, 8, 8);

    for (let i = 0; i < layerCount; i++) {
      const mat = new THREE.MeshPhysicalMaterial({
        map: i % 2 === 0 ? texA : texB,
        transparent: true,
        opacity: 0.16,
        roughness: 0.14,
        metalness: 0.45,
        clearcoat: 1.0,
        depthWrite: false,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
      });
      const mesh = new THREE.Mesh(planeGeo, mat);
      mesh.position.z = 3.2 - i * 0.22;
      mesh.rotation.z = i * 0.19;
      group.add(mesh);
      this.vramPlanes.push(mesh);
    }
    this.metrics.instanceCount = layerCount;
  }

  /* === SCENE 6: Extreme Tessellation & Millions of Triangles (1M - 6M+) === */
  private buildGeometryTortureScene(group: THREE.Group): void {
    if (!this.camera) return;
    this.camera.position.set(0, 1.8, 7.2);
    this.camera.lookAt(0, 0, 0);

    const knotCfg =
      this.preset === 'ultra'
        ? { tub: 960, rad: 128, count: 7 }
        : this.preset === 'extreme'
          ? { tub: 640, rad: 96, count: 5 }
          : this.preset === 'high'
            ? { tub: 420, rad: 64, count: 4 }
            : { tub: 260, rad: 40, count: 3 };

    const knotGeo = new THREE.TorusKnotGeometry(1.25, 0.34, knotCfg.tub, knotCfg.rad, 3, 5);
    const palette = [0x38bdf8, 0xf59e0b, 0x10b981, 0xa855f7, 0xf43f5e, 0xe2e8f0, 0x06b6d4];

    for (let i = 0; i < knotCfg.count; i++) {
      const mat = new THREE.MeshPhysicalMaterial({
        color: palette[i % palette.length],
        metalness: 0.92,
        roughness: 0.12,
        clearcoat: 1.0,
        clearcoatRoughness: 0.06,
      });
      const mesh = new THREE.Mesh(knotGeo, mat);
      if (i === 0) {
        mesh.position.set(0, 0, 0);
        mesh.scale.setScalar(1.25);
      } else {
        const ang = ((i - 1) / (knotCfg.count - 1)) * Math.PI * 2;
        mesh.position.set(Math.cos(ang) * 3.1, Math.sin(ang * 2) * 0.65, Math.sin(ang) * 3.1);
        mesh.scale.setScalar(0.68);
      }
      group.add(mesh);
      this.geometrySculptures.push(mesh);
    }

    this.metrics.instanceCount = knotCfg.count;
  }

  /* === SCENE 7: Cyberpunk Neon Metropolis (Instanced Skyscrapers + Flying Traffic Streams) === */
  private buildCyberCityScene(group: THREE.Group): void {
    if (!this.camera) return;
    this.camera.position.set(0, 8.5, 16.5);
    this.camera.lookAt(0, 2.2, 0);

    const gridSide =
      this.preset === 'ultra' ? 42 : this.preset === 'extreme' ? 32 : this.preset === 'high' ? 24 : 16;
    const buildingCount = gridSide * gridSide;
    const trafficCount =
      this.preset === 'ultra' ? 24000 : this.preset === 'extreme' ? 12000 : this.preset === 'high' ? 5000 : 2000;

    // Ground reflective wet street plane
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(60, 60),
      new THREE.MeshStandardMaterial({ color: 0x050914, metalness: 0.85, roughness: 0.22 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = !this.isSoftwareGl;
    group.add(ground);

    const maxAniso = this.renderer ? this.renderer.capabilities.getMaxAnisotropy() : 4;
    const cityTex = createArchitecturePbrTextures('skyscraper', 0x22d3ee, maxAniso);
    const bGeo = new THREE.BoxGeometry(0.68, 1.0, 0.68);
    const bMat = new THREE.MeshStandardMaterial({
      color: 0xe2e8f0,
      map: cityTex.map,
      bumpMap: cityTex.bumpMap,
      bumpScale: 0.04,
      roughnessMap: cityTex.roughnessMap,
      emissive: 0x38bdf8,
      emissiveMap: cityTex.emissiveMap,
      emissiveIntensity: 0.85,
      metalness: 0.72,
      roughness: 0.28,
    });
    const buildings = new THREE.InstancedMesh(bGeo, bMat, buildingCount);
    buildings.castShadow = !this.isSoftwareGl;
    buildings.receiveShadow = !this.isSoftwareGl;

    const spacing = 1.08;
    const half = (gridSide * spacing) / 2;
    let idx = 0;
    for (let gx = 0; gx < gridSide; gx++) {
      for (let gz = 0; gz < gridSide; gz++) {
        const wx = gx * spacing - half;
        const wz = gz * spacing - half;
        const isAvenue = Math.abs(wx) < 1.35 || Math.abs(wz) < 1.35;
        const radial = Math.hypot(wx, wz);
        const h = isAvenue
          ? 0.06
          : Math.max(0.7, (Math.sin(gx * 0.7) * Math.cos(gz * 0.6) + 1.4) * (4.6 / (1 + radial * 0.08)) + Math.random() * 2.2);
        const wScale = isAvenue ? 0.01 : 0.72 + Math.random() * 0.42;

        _dummyObj.position.set(wx, h * 0.5, wz);
        _dummyObj.rotation.set(0, 0, 0);
        _dummyObj.scale.set(wScale, h, wScale);
        _dummyObj.updateMatrix();
        buildings.setMatrixAt(idx, _dummyObj.matrix);

        if (h > 4.2) _colorScratch.setHSL(0.54 + Math.random() * 0.06, 0.85, 0.42);
        else if (idx % 5 === 0) _colorScratch.setHSL(0.82 + Math.random() * 0.08, 0.75, 0.34);
        else _colorScratch.setHSL(0.6, 0.32, 0.16 + Math.random() * 0.14);
        buildings.setColorAt(idx, _colorScratch);
        idx++;
      }
    }
    buildings.instanceMatrix.needsUpdate = true;
    if (buildings.instanceColor) buildings.instanceColor.needsUpdate = true;
    buildings.computeBoundingSphere();
    group.add(buildings);

    // Instanced flying neon vehicle light trails
    const tGeo = new THREE.BoxGeometry(0.08, 0.05, 0.42);
    const tMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const traffic = new THREE.InstancedMesh(tGeo, tMat, trafficCount);
    traffic.frustumCulled = false;

    const tData = new Float32Array(trafficCount * 4);
    for (let i = 0; i < trafficCount; i++) {
      const axis = i % 2; // 0 = along Z, 1 = along X
      const lane = ((i % 18) - 9) * 1.45 + (Math.random() - 0.5) * 0.4;
      const alt = 1.2 + Math.random() * 6.8;
      const speed = (3.5 + Math.random() * 9.5) * (i % 4 < 2 ? 1 : -1);
      const offset = (Math.random() - 0.5) * 34;

      tData[i * 4] = axis;
      tData[i * 4 + 1] = lane;
      tData[i * 4 + 2] = alt;
      tData[i * 4 + 3] = speed;

      _dummyObj.position.set(axis === 0 ? lane : offset, alt, axis === 0 ? offset : lane);
      _dummyObj.rotation.set(0, axis === 0 ? 0 : Math.PI / 2, 0);
      _dummyObj.scale.setScalar(0.85 + Math.random() * 0.5);
      _dummyObj.updateMatrix();
      traffic.setMatrixAt(i, _dummyObj.matrix);

      if (speed > 0) _colorScratch.setHex(0x22d3ee);
      else _colorScratch.setHex(i % 3 === 0 ? 0xf43f5e : 0xf59e0b);
      traffic.setColorAt(i, _colorScratch);
    }
    traffic.instanceMatrix.needsUpdate = true;
    if (traffic.instanceColor) traffic.instanceColor.needsUpdate = true;
    group.add(traffic);

    this.cityTrafficMesh = traffic;
    this.cityTrafficData = tData;
    this.metrics.instanceCount = buildingCount + trafficCount;
  }

  /* === SCENE 8: Domain-Warped Plasma Ocean FBM + Iridescent Energy Orbs === */
  private buildFluidPlasmaScene(group: THREE.Group): void {
    if (!this.camera) return;
    this.camera.position.set(0, 4.6, 8.8);
    this.camera.lookAt(0, 0.6, 0);

    const segs =
      this.preset === 'ultra' ? 280 : this.preset === 'extreme' ? 200 : this.preset === 'high' ? 140 : 96;
    const octaves =
      this.preset === 'ultra' ? 6 : this.preset === 'extreme' ? 5 : this.preset === 'high' ? 4 : 3;

    const planeGeo = new THREE.PlaneGeometry(24, 24, segs, segs);
    planeGeo.rotateX(-Math.PI / 2);
    const mat = new THREE.ShaderMaterial({
      vertexShader: PLASMA_OCEAN_VERT,
      fragmentShader: PLASMA_OCEAN_FRAG,
      side: THREE.DoubleSide,
      uniforms: {
        uTime: { value: 0 },
        uAmp: { value: 0.72 },
        uOctaves: { value: octaves },
      },
    });
    const ocean = new THREE.Mesh(planeGeo, mat);
    group.add(ocean);
    this.plasmaMat = mat;

    const orbCount = this.preset === 'ultra' ? 16 : this.preset === 'extreme' ? 12 : 8;
    const orbGeo = new THREE.IcosahedronGeometry(0.46, 4);
    const orbColors = [0x22d3ee, 0xc084fc, 0xf59e0b, 0x34d399];
    for (let i = 0; i < orbCount; i++) {
      const orbMat = new THREE.MeshPhysicalMaterial({
        color: orbColors[i % orbColors.length],
        emissive: orbColors[i % orbColors.length],
        emissiveIntensity: 0.35,
        metalness: 0.9,
        roughness: 0.08,
        clearcoat: 1.0,
      });
      const orb = new THREE.Mesh(orbGeo, orbMat);
      const ang = (i / orbCount) * Math.PI * 2;
      orb.position.set(Math.cos(ang) * 3.4, 2.0, Math.sin(ang) * 3.4);
      group.add(orb);
      this.plasmaOrbs.push(orb);
    }

    this.metrics.instanceCount = segs * segs;
  }

  /* === SCENE 9: Full-Screen GLSL Menger Sponge Fractal Cathedral + Specular Reflections === */
  private buildMengerSpongeScene(group: THREE.Group): void {
    if (!this.renderer) return;
    const size = new THREE.Vector2();
    this.renderer.getDrawingBufferSize(size);

    const maxSteps =
      this.preset === 'ultra' ? 200 : this.preset === 'extreme' ? 150 : this.preset === 'high' ? 110 : 72;
    this.baseMengerMaxSteps = maxSteps;
    const iter = this.preset === 'ultra' ? 5 : this.preset === 'extreme' ? 4 : 3;

    const mat = new THREE.ShaderMaterial({
      vertexShader: RAYMARCH_VERT,
      fragmentShader: MENGER_FRAG,
      depthTest: false,
      depthWrite: false,
      uniforms: {
        uTime: { value: 0 },
        uResolution: { value: size },
        uMaxSteps: { value: maxSteps },
        uMengerIter: { value: iter },
      },
    });
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat);
    quad.frustumCulled = false;
    group.add(quad);
    this.mengerMat = mat;
    this.metrics.instanceCount = maxSteps;
  }

  /* === SCENE 10: Quantum Neural Lattice (180,000 Animated Nodes + Geodesic Core Shells) === */
  private buildNeuralLatticeScene(group: THREE.Group): void {
    if (!this.camera) return;
    this.camera.position.set(0, 2.4, 9.6);
    this.camera.lookAt(0, 0, 0);

    const count =
      this.preset === 'ultra'
        ? 180000
        : this.preset === 'extreme'
          ? 110000
          : this.preset === 'high'
            ? 60000
            : 28000;

    const positions = new Float32Array(count * 3);
    const seeds = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);

    for (let i = 0; i < count; i++) {
      // Multi-shell Fibonacci sphere + connecting quantum filaments
      const shell = i % 4;
      const r = shell === 0 ? 1.85 : shell === 1 ? 3.1 : shell === 2 ? 4.4 : 1.4 + Math.random() * 4.5;
      const u = Math.random();
      const v = Math.random();
      const theta = u * Math.PI * 2;
      const phi = Math.acos(2 * v - 1);

      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.cos(phi);
      positions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);

      seeds[i * 3] = Math.random();
      seeds[i * 3 + 1] = 0.4 + Math.random() * 1.1;
      seeds[i * 3 + 2] = (shell % 2 === 0 ? 1 : -1) * (0.4 + Math.random() * 0.8);

      if (shell === 0) _colorScratch.setHSL(0.11, 0.96, 0.62);
      else if (shell === 1) _colorScratch.setHSL(0.52, 0.94, 0.58);
      else if (shell === 2) _colorScratch.setHSL(0.76, 0.85, 0.62);
      else _colorScratch.setHSL(0.45 + Math.random() * 0.18, 0.9, 0.6);

      colors[i * 3] = _colorScratch.r;
      colors[i * 3 + 1] = _colorScratch.g;
      colors[i * 3 + 2] = _colorScratch.b;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 3));
    geo.setAttribute('aColor', new THREE.BufferAttribute(colors, 3));

    const mat = new THREE.ShaderMaterial({
      vertexShader: NEURAL_VERT,
      fragmentShader: NEURAL_FRAG,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uTime: { value: 0 },
        uPointScale: { value: this.renderer ? Math.min(window.devicePixelRatio, 2) * 24.0 : 24.0 },
      },
    });
    const pts = new THREE.Points(geo, mat);
    pts.frustumCulled = false;
    group.add(pts);
    this.neuralMat = mat;

    // Inner nested geodesic wireframe & glowing metallic core
    const shellGroup = new THREE.Group();
    const core = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.92, 2),
      new THREE.MeshPhysicalMaterial({
        color: 0x06b6d4,
        emissive: 0x0ea5e9,
        emissiveIntensity: 0.65,
        metalness: 0.9,
        roughness: 0.14,
        clearcoat: 1.0,
      })
    );
    const cageInner = new THREE.Mesh(
      new THREE.IcosahedronGeometry(2.15, 2),
      new THREE.MeshBasicMaterial({ color: 0x38bdf8, wireframe: true, transparent: true, opacity: 0.24 })
    );
    const cageOuter = new THREE.Mesh(
      new THREE.IcosahedronGeometry(3.45, 2),
      new THREE.MeshBasicMaterial({ color: 0xa855f7, wireframe: true, transparent: true, opacity: 0.16 })
    );
    shellGroup.add(core, cageInner, cageOuter);
    group.add(shellGroup);
    this.neuralShellGroup = shellGroup;
    this.metrics.instanceCount = count;
  }

  /* === SCENE 11: Volumetric 3D Cosmic Nebula Raymarching === */
  private buildVolumetricNebulaScene(group: THREE.Group): void {
    if (!this.renderer) return;
    const stepsMap: Record<GpuLoadPreset, number> = {
      standard: 36,
      high: 56,
      extreme: 84,
      ultra: 110,
    };
    const steps = this.isSoftwareGl ? 24 : stepsMap[this.preset];
    this.baseNebulaMaxSteps = steps;
    const sz = new THREE.Vector2();
    this.renderer.getDrawingBufferSize(sz);

    const mat = new THREE.ShaderMaterial({
      vertexShader: RAYMARCH_VERT,
      fragmentShader: NEBULA_FRAG,
      uniforms: {
        uTime: { value: 0 },
        uResolution: { value: sz },
        uMaxSteps: { value: steps },
      },
      depthWrite: false,
      depthTest: false,
    });
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat);
    quad.frustumCulled = false;
    group.add(quad);
    this.nebulaMat = mat;
    this.metrics.instanceCount = steps;
  }

  /* === SCENE 12: Crystal Caustics Cathedral (Clearcoat PBR + Instancing) === */
  private buildCrystalCausticsScene(group: THREE.Group): void {
    if (!this.camera) return;
    this.camera.position.set(0, 3.2, 9.2);
    this.camera.lookAt(0, 0.2, 0);

    const coreGeo = new THREE.OctahedronGeometry(1.55, 1);
    const coreMat = new THREE.MeshPhysicalMaterial({
      color: 0x38bdf8,
      emissive: 0x0e7490,
      emissiveIntensity: 0.45,
      metalness: 0.25,
      roughness: 0.05,
      clearcoat: 1.0,
      clearcoatRoughness: 0.04,
      iridescence: 1.0,
      iridescenceIOR: 1.8,
      flatShading: true,
    });
    const core = new THREE.Mesh(coreGeo, coreMat);
    group.add(core);
    this.crystalCore = core;

    const countMap: Record<GpuLoadPreset, number> = {
      standard: 1200,
      high: 3800,
      extreme: 10000,
      ultra: 22000,
    };
    const count = this.isSoftwareGl ? 400 : countMap[this.preset];
    const shardGeo = new THREE.ConeGeometry(0.11, 0.56, 5);
    const shardMat = new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      metalness: 0.72,
      roughness: 0.08,
      clearcoat: 1.0,
      clearcoatRoughness: 0.05,
      flatShading: true,
    });
    const mesh = new THREE.InstancedMesh(shardGeo, shardMat, count);
    const data = new Float32Array(count * 4);
    const palette = [0x06b6d4, 0x38bdf8, 0xa855f7, 0xf472b6, 0xfbbf24, 0x34d399];

    for (let i = 0; i < count; i++) {
      const ring = 2.2 + Math.pow(Math.random(), 0.72) * 5.8;
      const angle = Math.random() * Math.PI * 2;
      const y = (Math.random() - 0.5) * 4.6;
      const speed = (0.22 + Math.random() * 0.55) * (i % 2 === 0 ? 1 : -1);
      data[i * 4] = ring;
      data[i * 4 + 1] = angle;
      data[i * 4 + 2] = y;
      data[i * 4 + 3] = speed;

      _dummyObj.position.set(Math.cos(angle) * ring, y, Math.sin(angle) * ring);
      _dummyObj.rotation.set(angle, y, ring * 0.5);
      _dummyObj.scale.setScalar(0.55 + Math.random() * 1.15);
      _dummyObj.updateMatrix();
      mesh.setMatrixAt(i, _dummyObj.matrix);
      _colorScratch.setHex(palette[i % palette.length]);
      mesh.setColorAt(i, _colorScratch);
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    group.add(mesh);

    const pLightA = new THREE.PointLight(0xf472b6, 4.0, 22);
    pLightA.position.set(4, 3, 4);
    const pLightB = new THREE.PointLight(0x38bdf8, 4.0, 22);
    pLightB.position.set(-4, -2, -4);
    group.add(pLightA, pLightB);

    this.crystalMesh = mesh;
    this.crystalData = data;
    this.metrics.instanceCount = count;
  }

  /* === SCENE 13: Relativistic Raytraced Kerr Black Hole === */
  private buildBlackholeLensingScene(group: THREE.Group): void {
    if (!this.renderer) return;
    const stepsMap: Record<GpuLoadPreset, number> = {
      standard: 60,
      high: 96,
      extreme: 128,
      ultra: 160,
    };
    const steps = this.isSoftwareGl ? 36 : stepsMap[this.preset];
    this.baseBlackholeMaxSteps = steps;
    const sz = new THREE.Vector2();
    this.renderer.getDrawingBufferSize(sz);

    const mat = new THREE.ShaderMaterial({
      vertexShader: RAYMARCH_VERT,
      fragmentShader: BLACKHOLE_FRAG,
      uniforms: {
        uTime: { value: 0 },
        uResolution: { value: sz },
        uMaxSteps: { value: steps },
      },
      depthWrite: false,
      depthTest: false,
    });
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat);
    quad.frustumCulled = false;
    group.add(quad);
    this.blackholeMat = mat;
    this.metrics.instanceCount = steps;
  }

  /* === SCENE 14: Biocybernetic DNA Megastructure & 240k GPU Particles === */
  private buildDnaMegastructureScene(group: THREE.Group): void {
    if (!this.camera) return;
    this.camera.position.set(0, 1.4, 10.6);
    this.camera.lookAt(0, 0, 0);

    const dnaGroup = new THREE.Group();
    const rungCount = this.isSoftwareGl ? 32 : this.preset === 'ultra' ? 140 : this.preset === 'extreme' ? 100 : 70;
    const rungGeo = new THREE.CylinderGeometry(0.05, 0.05, 3.2, 10);
    rungGeo.rotateZ(Math.PI / 2);
    const rungMat = new THREE.MeshPhysicalMaterial({
      color: 0x22d3ee,
      emissive: 0x0891b2,
      emissiveIntensity: 0.55,
      metalness: 0.8,
      roughness: 0.18,
      clearcoat: 1.0,
    });
    const rungs = new THREE.InstancedMesh(rungGeo, rungMat, rungCount);
    const nodeGeo = new THREE.SphereGeometry(0.14, 12, 12);
    const nodeMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0x38bdf8,
      emissiveIntensity: 0.45,
      metalness: 0.85,
      roughness: 0.16,
    });
    const nodes = new THREE.InstancedMesh(nodeGeo, nodeMat, rungCount * 2);

    for (let i = 0; i < rungCount; i++) {
      const norm = i / Math.max(1, rungCount - 1) - 0.5;
      const y = norm * 9.2;
      const angle = norm * Math.PI * 5.0;
      _dummyObj.position.set(0, y, 0);
      _dummyObj.rotation.set(0, angle, 0);
      _dummyObj.scale.set(1, 1, 1);
      _dummyObj.updateMatrix();
      rungs.setMatrixAt(i, _dummyObj.matrix);
      _colorScratch.setHex(i % 2 === 0 ? 0x06b6d4 : 0xa855f7);
      rungs.setColorAt(i, _colorScratch);

      for (let side = 0; side < 2; side++) {
        const sgn = side === 0 ? 1 : -1;
        _dummyObj.position.set(Math.cos(angle) * 1.62 * sgn, y, -Math.sin(angle) * 1.62 * sgn);
        _dummyObj.rotation.set(0, 0, 0);
        _dummyObj.scale.setScalar(1);
        _dummyObj.updateMatrix();
        nodes.setMatrixAt(i * 2 + side, _dummyObj.matrix);
        _colorScratch.setHex(side === 0 ? 0x38bdf8 : 0xf472b6);
        nodes.setColorAt(i * 2 + side, _colorScratch);
      }
    }
    rungs.instanceMatrix.needsUpdate = true;
    if (rungs.instanceColor) rungs.instanceColor.needsUpdate = true;
    nodes.instanceMatrix.needsUpdate = true;
    if (nodes.instanceColor) nodes.instanceColor.needsUpdate = true;
    dnaGroup.add(rungs, nodes);
    group.add(dnaGroup);
    this.dnaGroup = dnaGroup;

    const ptCountMap: Record<GpuLoadPreset, number> = {
      standard: 30000,
      high: 80000,
      extreme: 150000,
      ultra: 240000,
    };
    const ptCount = this.isSoftwareGl ? 8000 : ptCountMap[this.preset];
    const pos = new Float32Array(ptCount * 3);
    const phase = new Float32Array(ptCount * 3);
    const col = new Float32Array(ptCount * 3);
    const cCyan = new THREE.Color(0x06b6d4);
    const cMagenta = new THREE.Color(0xec4899);
    const cEmerald = new THREE.Color(0x10b981);

    for (let i = 0; i < ptCount; i++) {
      const t = (Math.random() - 0.5) * 7.2;
      const strand = i % 2;
      const radius = 1.65 + (Math.random() - 0.25) * 1.85;
      phase[i * 3] = t;
      phase[i * 3 + 1] = strand;
      phase[i * 3 + 2] = Math.max(0.4, radius);

      const mixCol = strand === 0 ? cCyan.clone().lerp(cEmerald, Math.random() * 0.5) : cMagenta.clone().lerp(cCyan, Math.random() * 0.35);
      col[i * 3] = mixCol.r;
      col[i * 3 + 1] = mixCol.g;
      col[i * 3 + 2] = mixCol.b;
    }

    const ptGeo = new THREE.BufferGeometry();
    ptGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    ptGeo.setAttribute('aPhase', new THREE.BufferAttribute(phase, 3));
    ptGeo.setAttribute('aColor', new THREE.BufferAttribute(col, 3));

    const ptMat = new THREE.ShaderMaterial({
      vertexShader: DNA_PARTICLE_VERT,
      fragmentShader: DNA_PARTICLE_FRAG,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uTime: { value: 0 },
        uPointScale: { value: this.renderer ? Math.min(window.devicePixelRatio, 2) * 20.0 : 20.0 },
      },
    });
    const points = new THREE.Points(ptGeo, ptMat);
    points.frustumCulled = false;
    group.add(points);
    this.dnaMat = ptMat;
    this.metrics.instanceCount = ptCount + rungCount * 3;
  }

  /* === SCENE 15: Path-Tracing Cornell Box & Global Illumination === */
  private buildPathtracedCornellScene(group: THREE.Group): void {
    if (!this.camera) return;
    this.camera.position.set(0, 2.4, 7.6);
    this.camera.lookAt(0, 2.2, 0);

    const boxGroup = new THREE.Group();
    const wallGeo = new THREE.PlaneGeometry(6.4, 4.8, 16, 16);
    // Floor & Ceiling
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(6.4, 6.4, 24, 24),
      new THREE.MeshPhysicalMaterial({ color: 0xe2e8f0, roughness: 0.16, metalness: 0.15, clearcoat: 0.7 })
    );
    floor.rotation.x = -Math.PI / 2;
    const ceiling = new THREE.Mesh(
      new THREE.PlaneGeometry(6.4, 6.4),
      new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.6 })
    );
    ceiling.rotation.x = Math.PI / 2;
    ceiling.position.y = 4.8;
    // Back wall
    const backWall = new THREE.Mesh(
      wallGeo,
      new THREE.MeshStandardMaterial({ color: 0xcbd5e1, roughness: 0.35, metalness: 0.1 })
    );
    backWall.position.set(0, 2.4, -3.2);
    // Left crimson GI wall
    const leftWall = new THREE.Mesh(
      new THREE.PlaneGeometry(6.4, 4.8),
      new THREE.MeshStandardMaterial({ color: 0xef4444, emissive: 0x7f1d1d, emissiveIntensity: 0.35, roughness: 0.4 })
    );
    leftWall.rotation.y = Math.PI / 2;
    leftWall.position.set(-3.2, 2.4, 0);
    // Right emerald/cyan GI wall
    const rightWall = new THREE.Mesh(
      new THREE.PlaneGeometry(6.4, 4.8),
      new THREE.MeshStandardMaterial({ color: 0x10b981, emissive: 0x064e3b, emissiveIntensity: 0.35, roughness: 0.4 })
    );
    rightWall.rotation.y = -Math.PI / 2;
    rightWall.position.set(3.2, 2.4, 0);

    // Area light panel on ceiling
    const areaLightMesh = new THREE.Mesh(
      new THREE.BoxGeometry(2.2, 0.08, 2.2),
      new THREE.MeshBasicMaterial({ color: 0xfffbeb })
    );
    areaLightMesh.position.set(0, 4.75, 0);
    boxGroup.add(floor, ceiling, backWall, leftWall, rightWall, areaLightMesh);

    // Mirror monolith & dielectric glass sphere & gold torus knot inside Cornell Box
    const tallBlock = new THREE.Mesh(
      new THREE.BoxGeometry(1.35, 2.7, 1.35),
      new THREE.MeshPhysicalMaterial({ color: 0xf8fafc, metalness: 0.96, roughness: 0.04, clearcoat: 1.0 })
    );
    tallBlock.position.set(-1.1, 1.35, -0.75);
    tallBlock.rotation.y = 0.34;

    const glassSphere = new THREE.Mesh(
      new THREE.SphereGeometry(0.92, 64, 64),
      new THREE.MeshPhysicalMaterial({
        color: 0xe0f2fe,
        metalness: 0.05,
        roughness: 0.02,
        transmission: 0.92,
        ior: 1.52,
        thickness: 1.6,
        clearcoat: 1.0,
      })
    );
    glassSphere.position.set(1.15, 0.95, 0.55);

    const goldSculpture = new THREE.Mesh(
      new THREE.TorusKnotGeometry(0.55, 0.16, 180, 36),
      new THREE.MeshPhysicalMaterial({ color: 0xfbbf24, metalness: 0.92, roughness: 0.12, clearcoat: 0.9 })
    );
    goldSculpture.position.set(0.1, 2.85, -0.2);
    goldSculpture.name = 'cornellKnob';

    // Orbiting GI photon probes
    const probeCount = this.isSoftwareGl ? 300 : PRESET_CONFIG[this.preset].instances;
    const probeGeo = new THREE.OctahedronGeometry(0.055, 1);
    const probeMat = new THREE.MeshPhysicalMaterial({ color: 0xffffff, metalness: 0.85, roughness: 0.1 });
    const probes = new THREE.InstancedMesh(probeGeo, probeMat, probeCount);
    probes.name = 'cornellProbes';
    for (let i = 0; i < probeCount; i++) {
      const a = (i / probeCount) * Math.PI * 24;
      const r = 0.65 + (i % 19) * 0.13;
      const y = 0.35 + ((i * 17) % 100) * 0.041;
      _dummyObj.position.set(Math.cos(a) * r, y, Math.sin(a) * r);
      _dummyObj.scale.setScalar(0.6 + (i % 4) * 0.25);
      _dummyObj.updateMatrix();
      probes.setMatrixAt(i, _dummyObj.matrix);
      _colorScratch.setHex(i % 3 === 0 ? 0xf87171 : i % 3 === 1 ? 0x34d399 : 0xfef08a);
      probes.setColorAt(i, _colorScratch);
    }
    probes.instanceMatrix.needsUpdate = true;
    if (probes.instanceColor) probes.instanceColor.needsUpdate = true;

    const redBounce = new THREE.PointLight(0xef4444, 3.2, 8);
    redBounce.position.set(-2.5, 2.2, 0);
    const greenBounce = new THREE.PointLight(0x10b981, 3.2, 8);
    greenBounce.position.set(2.5, 2.2, 0);
    boxGroup.add(tallBlock, glassSphere, goldSculpture, probes, redBounce, greenBounce);

    group.add(boxGroup);
    this.cornellGroup = boxGroup;
    this.metrics.instanceCount = probeCount;
  }

  /* === SCENE 16: Subsurface Scattering Jade Dragon Statue & Lanterns === */
  private buildSubsurfaceDragonScene(group: THREE.Group): void {
    if (!this.camera) return;
    this.camera.position.set(0, 2.5, 8.2);
    this.camera.lookAt(0, 1.1, 0);

    const dragonGroup = new THREE.Group();
    const jadeMat = new THREE.MeshPhysicalMaterial({
      color: 0x10b981,
      emissive: 0x065f46,
      emissiveIntensity: 0.38,
      roughness: 0.14,
      metalness: 0.08,
      transmission: 0.78,
      thickness: 2.2,
      ior: 1.66,
      clearcoat: 1.0,
      clearcoatRoughness: 0.08,
    });

    // Coiled dragon body segments along a 3D helix curve
    const segs = this.isSoftwareGl ? 36 : this.preset === 'ultra' ? 140 : this.preset === 'extreme' ? 105 : 72;
    const segGeo = new THREE.DodecahedronGeometry(0.46, 2);
    const bodyInst = new THREE.InstancedMesh(segGeo, jadeMat, segs);
    for (let i = 0; i < segs; i++) {
      const t = i / Math.max(1, segs - 1);
      const angle = t * Math.PI * 4.5;
      const radius = 1.85 * (1 - t * 0.45) + 0.35;
      const y = 0.45 + t * 2.6 + Math.sin(t * Math.PI * 6) * 0.25;
      const scale = (1 - Math.abs(t - 0.35) * 0.7) * 0.95 + 0.28;
      _dummyObj.position.set(Math.cos(angle) * radius, y, Math.sin(angle) * radius);
      _dummyObj.rotation.set(angle * 0.5, -angle, t * 2);
      _dummyObj.scale.set(scale, scale * 0.85, scale * 1.25);
      _dummyObj.updateMatrix();
      bodyInst.setMatrixAt(i, _dummyObj.matrix);
      _colorScratch.setHSL(0.43 + t * 0.08, 0.85, 0.42 + (i % 3) * 0.06);
      bodyInst.setColorAt(i, _colorScratch);
    }
    bodyInst.instanceMatrix.needsUpdate = true;
    if (bodyInst.instanceColor) bodyInst.instanceColor.needsUpdate = true;
    dragonGroup.add(bodyInst);

    // Glowing amber dragon pearl in the center
    const pearl = new THREE.Mesh(
      new THREE.SphereGeometry(0.75, 64, 64),
      new THREE.MeshPhysicalMaterial({
        color: 0xf59e0b,
        emissive: 0xd97706,
        emissiveIntensity: 1.1,
        roughness: 0.08,
        transmission: 0.85,
        ior: 1.75,
        clearcoat: 1.0,
      })
    );
    pearl.position.set(0, 1.55, 0);
    dragonGroup.add(pearl);

    // Pedestal temple altar
    const altar = new THREE.Mesh(
      new THREE.CylinderGeometry(2.8, 3.2, 0.38, 32),
      new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.8, roughness: 0.25 })
    );
    altar.position.y = 0.19;
    dragonGroup.add(altar);

    // Floating backlight lanterns for subsurface transmission test
    const lanternCount = this.isSoftwareGl ? 240 : Math.floor(PRESET_CONFIG[this.preset].instances * 0.45);
    const lanternGeo = new THREE.SphereGeometry(0.055, 8, 8);
    const lanternMat = new THREE.MeshBasicMaterial({ color: 0xfef08a });
    const lanterns = new THREE.InstancedMesh(lanternGeo, lanternMat, lanternCount);
    lanterns.name = 'sssLanterns';
    for (let i = 0; i < lanternCount; i++) {
      const a = (i / lanternCount) * Math.PI * 2;
      const r = 2.5 + (i % 9) * 0.35;
      const y = 0.4 + ((i * 29) % 100) * 0.032;
      _dummyObj.position.set(Math.cos(a) * r, y, Math.sin(a) * r);
      _dummyObj.scale.setScalar(0.6 + (i % 3) * 0.3);
      _dummyObj.updateMatrix();
      lanterns.setMatrixAt(i, _dummyObj.matrix);
      _colorScratch.setHex(i % 2 === 0 ? 0xfbbf24 : 0x34d399);
      lanterns.setColorAt(i, _colorScratch);
    }
    lanterns.instanceMatrix.needsUpdate = true;
    if (lanterns.instanceColor) lanterns.instanceColor.needsUpdate = true;
    dragonGroup.add(lanterns);

    const internalLight = new THREE.PointLight(0xfbbf24, 5.5, 14);
    internalLight.position.set(0, 1.55, 0);
    dragonGroup.add(internalLight);

    group.add(dragonGroup);
    this.sssDragonGroup = dragonGroup;
    this.metrics.instanceCount = segs + lanternCount;
  }

  /* === SCENE 17: 3D Aerodynamic Wind Tunnel & Carbon-Silk Cloth Simulation === */
  private buildClothAerodynamicsScene(group: THREE.Group): void {
    if (!this.camera) return;
    this.camera.position.set(0, 3.2, 8.6);
    this.camera.lookAt(0, 0.8, 0);

    const gridRes = this.isSoftwareGl ? 48 : this.preset === 'ultra' ? 180 : this.preset === 'extreme' ? 140 : 96;
    const clothGeo = new THREE.PlaneGeometry(8.5, 5.2, gridRes, gridRes);
    clothGeo.rotateX(-Math.PI / 2);
    const clothMat = new THREE.MeshPhysicalMaterial({
      color: 0x0ea5e9,
      emissive: 0x0369a1,
      emissiveIntensity: 0.25,
      metalness: 0.65,
      roughness: 0.22,
      clearcoat: 1.0,
      side: THREE.DoubleSide,
      wireframe: false,
    });
    const cloth = new THREE.Mesh(clothGeo, clothMat);
    cloth.position.y = 1.1;
    group.add(cloth);
    this.clothMesh = cloth;

    // Aerodynamic hypercar/airfoil nose cone inside the wind tunnel
    const airfoil = new THREE.Mesh(
      new THREE.ConeGeometry(0.95, 3.6, 32),
      new THREE.MeshPhysicalMaterial({ color: 0x1e293b, metalness: 0.92, roughness: 0.14, clearcoat: 1.0 })
    );
    airfoil.rotation.z = Math.PI / 2;
    airfoil.position.set(-2.4, 0.55, 0);
    group.add(airfoil);

    // Wind tunnel streamlines
    const streamCount = this.isSoftwareGl ? 400 : PRESET_CONFIG[this.preset].instances;
    const streamGeo = new THREE.BoxGeometry(0.42, 0.022, 0.022);
    const streamMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
    const streams = new THREE.InstancedMesh(streamGeo, streamMat, streamCount);
    for (let i = 0; i < streamCount; i++) {
      const x = ((i % 50) / 50 - 0.5) * 12;
      const z = (((i * 7) % 40) / 40 - 0.5) * 6.2;
      const y = 0.25 + ((i * 13) % 30) * 0.11;
      _dummyObj.position.set(x, y, z);
      _dummyObj.scale.set(0.6 + (i % 4) * 0.45, 1, 1);
      _dummyObj.updateMatrix();
      streams.setMatrixAt(i, _dummyObj.matrix);
      _colorScratch.setHex(i % 3 === 0 ? 0x38bdf8 : i % 3 === 1 ? 0x22d3ee : 0xf43f5e);
      streams.setColorAt(i, _colorScratch);
    }
    streams.instanceMatrix.needsUpdate = true;
    if (streams.instanceColor) streams.instanceColor.needsUpdate = true;
    group.add(streams);
    this.clothStreamMesh = streams;
    this.metrics.instanceCount = streamCount + gridRes * gridRes;
  }

  /* === SCENE 18: Volumetric Cathedral & 4K Crepuscular God-Rays === */
  private buildVolumetricGodraysScene(group: THREE.Group): void {
    if (!this.camera) return;
    this.camera.position.set(0, 2.2, 9.5);
    this.camera.lookAt(0, 1.8, 0);

    const templeGroup = new THREE.Group();
    const pillarGeo = new THREE.CylinderGeometry(0.32, 0.42, 6.5, 16);
    const pillarMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.75, roughness: 0.3 });
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      const p = new THREE.Mesh(pillarGeo, pillarMat);
      p.position.set(Math.cos(a) * 4.6, 3.25, Math.sin(a) * 4.6);
      templeGroup.add(p);
    }

    // Volumetric light shaft cones (Additive blending overdraw torture)
    const rayCount = this.isSoftwareGl ? 16 : this.preset === 'ultra' ? 64 : this.preset === 'extreme' ? 48 : 32;
    const rayGeo = new THREE.ConeGeometry(1.45, 7.8, 24, 1, true);
    for (let i = 0; i < rayCount; i++) {
      const a = (i / rayCount) * Math.PI * 2;
      const r = 0.8 + (i % 4) * 0.85;
      const rayMat = new THREE.MeshBasicMaterial({
        color: i % 2 === 0 ? 0x38bdf8 : 0xfbbf24,
        transparent: true,
        opacity: 0.085,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
      });
      const ray = new THREE.Mesh(rayGeo, rayMat);
      ray.position.set(Math.cos(a) * r, 3.6, Math.sin(a) * r);
      ray.rotation.z = Math.cos(a) * 0.22;
      ray.rotation.x = Math.sin(a) * 0.22;
      templeGroup.add(ray);
    }

    // Floating dust motes illuminated by god-rays
    const moteCount = this.isSoftwareGl ? 500 : PRESET_CONFIG[this.preset].instances;
    const moteGeo = new THREE.DodecahedronGeometry(0.036, 0);
    const moteMat = new THREE.MeshBasicMaterial({ color: 0xfef08a });
    const motes = new THREE.InstancedMesh(moteGeo, moteMat, moteCount);
    motes.name = 'godrayMotes';
    for (let i = 0; i < moteCount; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = Math.random() * 4.8;
      const y = Math.random() * 5.8;
      _dummyObj.position.set(Math.cos(a) * r, y, Math.sin(a) * r);
      _dummyObj.scale.setScalar(0.5 + Math.random() * 1.1);
      _dummyObj.updateMatrix();
      motes.setMatrixAt(i, _dummyObj.matrix);
      _colorScratch.setHex(i % 2 === 0 ? 0xfef08a : 0x7dd3fc);
      motes.setColorAt(i, _colorScratch);
    }
    motes.instanceMatrix.needsUpdate = true;
    if (motes.instanceColor) motes.instanceColor.needsUpdate = true;
    templeGroup.add(motes);

    group.add(templeGroup);
    this.godraysGroup = templeGroup;
    this.metrics.instanceCount = moteCount + rayCount;
  }

  /* === SCENE 19: Voronoi Rigid-Body Shatter & 28k Shards === */
  private buildVoronoiShatterScene(group: THREE.Group): void {
    if (!this.camera) return;
    this.camera.position.set(0, 2.6, 8.8);
    this.camera.lookAt(0, 0.5, 0);

    const count = this.isSoftwareGl ? 800 : PRESET_CONFIG[this.preset].instances;
    const shardGeo = new THREE.TetrahedronGeometry(0.11, 0);
    const shardMat = new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      metalness: 0.82,
      roughness: 0.15,
      clearcoat: 1.0,
      flatShading: true,
    });
    const mesh = new THREE.InstancedMesh(shardGeo, shardMat, count);
    mesh.frustumCulled = false;

    const data = new Float32Array(count * 4);
    for (let i = 0; i < count; i++) {
      // Spherical Fibonacci distribution for initial intact core + radial velocity
      const u = Math.random();
      const v = Math.random();
      const theta = 2 * Math.PI * u;
      const phi = Math.acos(2 * v - 1);
      const r0 = 0.35 + Math.cbrt(Math.random()) * 1.45;
      data[i * 4] = Math.sin(phi) * Math.cos(theta);
      data[i * 4 + 1] = Math.cos(phi);
      data[i * 4 + 2] = Math.sin(phi) * Math.sin(theta);
      data[i * 4 + 3] = r0;

      _dummyObj.position.set(data[i * 4] * r0, 1.2 + data[i * 4 + 1] * r0, data[i * 4 + 2] * r0);
      _dummyObj.scale.setScalar(0.65 + (i % 5) * 0.22);
      _dummyObj.updateMatrix();
      mesh.setMatrixAt(i, _dummyObj.matrix);
      _colorScratch.setHex(i % 3 === 0 ? 0xf97316 : i % 3 === 1 ? 0x38bdf8 : 0xa855f7);
      mesh.setColorAt(i, _colorScratch);
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    group.add(mesh);

    // Shockwave ring
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(2.2, 0.04, 16, 96),
      new THREE.MeshBasicMaterial({ color: 0xf97316, transparent: true, opacity: 0.7 })
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 1.2;
    group.add(ring);

    this.voronoiMesh = mesh;
    this.voronoiData = data;
    this.metrics.instanceCount = count;
  }

  /* === SCENE 20: Supernova Remnant & Pulsar Shockwave === */
  private buildSupernovaRemnantScene(group: THREE.Group): void {
    if (!this.camera) return;
    this.camera.position.set(0, 3.8, 10.2);
    this.camera.lookAt(0, 0, 0);

    const snGroup = new THREE.Group();
    // Rapidly spinning magnetar core
    const magnetar = new THREE.Mesh(
      new THREE.SphereGeometry(0.72, 48, 48),
      new THREE.MeshBasicMaterial({ color: 0xffffff })
    );
    snGroup.add(magnetar);

    // Expanding multi-shell plasma shockwaves
    const shellColors = [0x38bdf8, 0xf43f5e, 0xfbbf24, 0xa855f7];
    for (let s = 0; s < 4; s++) {
      const shell = new THREE.Mesh(
        new THREE.IcosahedronGeometry(1.6 + s * 0.95, 3),
        new THREE.MeshBasicMaterial({
          color: shellColors[s],
          wireframe: true,
          transparent: true,
          opacity: 0.28 - s * 0.04,
          blending: THREE.AdditiveBlending,
        })
      );
      shell.name = `snShell_${s}`;
      snGroup.add(shell);
    }

    // Dual gamma-ray burst jets
    const jetMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.42,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const jetN = new THREE.Mesh(new THREE.ConeGeometry(0.65, 9.5, 24, 1, true), jetMat);
    jetN.position.y = 4.75;
    jetN.rotation.x = Math.PI;
    const jetS = new THREE.Mesh(new THREE.ConeGeometry(0.65, 9.5, 24, 1, true), jetMat);
    jetS.position.y = -4.75;
    snGroup.add(jetN, jetS);

    // Ejecta filaments
    const count = this.isSoftwareGl ? 900 : PRESET_CONFIG[this.preset].instances;
    const ejectaGeo = new THREE.OctahedronGeometry(0.065, 0);
    const ejectaMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const ejecta = new THREE.InstancedMesh(ejectaGeo, ejectaMat, count);
    for (let i = 0; i < count; i++) {
      const u = Math.random();
      const v = Math.random();
      const theta = 2 * Math.PI * u;
      const phi = Math.acos(2 * v - 1);
      const r = 1.4 + Math.pow(Math.random(), 0.7) * 5.2;
      _dummyObj.position.set(
        r * Math.sin(phi) * Math.cos(theta),
        r * Math.cos(phi),
        r * Math.sin(phi) * Math.sin(theta)
      );
      _dummyObj.scale.setScalar(0.5 + Math.random() * 1.4);
      _dummyObj.updateMatrix();
      ejecta.setMatrixAt(i, _dummyObj.matrix);
      _colorScratch.setHex(shellColors[i % shellColors.length]);
      ejecta.setColorAt(i, _colorScratch);
    }
    ejecta.instanceMatrix.needsUpdate = true;
    if (ejecta.instanceColor) ejecta.instanceColor.needsUpdate = true;
    snGroup.add(ejecta);

    group.add(snGroup);
    this.supernovaGroup = snGroup;
    this.metrics.instanceCount = count;
  }

  /* === SCENE 21: Hyperspace Cyber Warp Tunnel & Chromatic Streaks === */
  private buildCyberTunnelWarpScene(group: THREE.Group): void {
    if (!this.camera) return;
    this.camera.position.set(0, 0, 7.5);
    this.camera.lookAt(0, 0, -25);

    // Portal gate arches along tunnel
    for (let g = 0; g < 14; g++) {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(3.4, 0.06, 12, 48),
        new THREE.MeshBasicMaterial({ color: g % 2 === 0 ? 0x06b6d4 : 0xec4899 })
      );
      ring.position.z = 4 - g * 3.2;
      group.add(ring);
    }

    const count = this.isSoftwareGl ? 800 : PRESET_CONFIG[this.preset].instances;
    const streakGeo = new THREE.BoxGeometry(0.045, 0.045, 1.45);
    const streakMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const mesh = new THREE.InstancedMesh(streakGeo, streakMat, count);
    mesh.frustumCulled = false;

    const data = new Float32Array(count * 4);
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const radius = 1.15 + Math.random() * 3.8;
      const z = (Math.random() - 0.85) * 42;
      const speed = 14 + Math.random() * 26;
      data[i * 4] = angle;
      data[i * 4 + 1] = radius;
      data[i * 4 + 2] = z;
      data[i * 4 + 3] = speed;

      _dummyObj.position.set(Math.cos(angle) * radius, Math.sin(angle) * radius, z);
      _dummyObj.scale.set(1, 1, 0.6 + Math.random() * 1.6);
      _dummyObj.updateMatrix();
      mesh.setMatrixAt(i, _dummyObj.matrix);
      _colorScratch.setHex(i % 3 === 0 ? 0x22d3ee : i % 3 === 1 ? 0xf43f5e : 0xa855f7);
      mesh.setColorAt(i, _colorScratch);
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    group.add(mesh);

    this.warpTunnelMesh = mesh;
    this.warpTunnelData = data;
    this.metrics.instanceCount = count;
  }

  /* === SCENE 22: 3D Magnetic Ferrofluid & Rosensweig PBR Spikes === */
  private buildMagneticFerrofluidScene(group: THREE.Group): void {
    if (!this.camera) return;
    this.camera.position.set(0, 2.8, 6.8);
    this.camera.lookAt(0, 0.4, 0);

    const detail = this.isSoftwareGl ? 32 : this.preset === 'ultra' ? 128 : this.preset === 'extreme' ? 96 : 64;
    const ferroGeo = new THREE.SphereGeometry(1.85, detail, detail);
    const ferroMat = new THREE.MeshPhysicalMaterial({
      color: 0x090d16,
      metalness: 0.96,
      roughness: 0.06,
      clearcoat: 1.0,
      clearcoatRoughness: 0.03,
    });
    const ferroMesh = new THREE.Mesh(ferroGeo, ferroMat);
    ferroMesh.position.y = 0.65;
    group.add(ferroMesh);
    this.ferrofluidMesh = ferroMesh;

    // Copper magnetic induction coils around the ferrofluid pool
    const coilMat = new THREE.MeshStandardMaterial({
      color: 0xd97736,
      emissive: 0x7c2d12,
      emissiveIntensity: 0.35,
      metalness: 0.92,
      roughness: 0.18,
    });
    for (let c = 0; c < 3; c++) {
      const coil = new THREE.Mesh(new THREE.TorusGeometry(2.9 + c * 0.35, 0.08, 16, 96), coilMat);
      coil.rotation.x = Math.PI / 2;
      coil.position.y = -0.35 + c * 0.45;
      group.add(coil);
    }

    const p1 = new THREE.PointLight(0x38bdf8, 4.5, 16);
    p1.position.set(3.5, 3.2, 3.5);
    const p2 = new THREE.PointLight(0xf43f5e, 4.5, 16);
    p2.position.set(-3.5, 2.8, -3.5);
    group.add(p1, p2);

    this.metrics.instanceCount = detail * detail;
  }

  /* === SCENE 23: 4D Quaternion Julia Fractal (Raymarching) === */
  private buildFractalJulia4dScene(group: THREE.Group): void {
    if (!this.renderer) return;
    const size = new THREE.Vector2();
    this.renderer.getDrawingBufferSize(size);

    const maxSteps =
      this.preset === 'ultra' ? 220 : this.preset === 'extreme' ? 168 : this.preset === 'high' ? 116 : 68;
    this.baseJulia4dMaxSteps = maxSteps;
    const fractalIter =
      this.preset === 'ultra' ? 12 : this.preset === 'extreme' ? 10 : this.preset === 'high' ? 8 : 6;

    const mat = new THREE.ShaderMaterial({
      vertexShader: RAYMARCH_VERT,
      fragmentShader: RAYMARCH_FRAG,
      depthTest: false,
      depthWrite: false,
      uniforms: {
        uTime: { value: 12.5 },
        uResolution: { value: size },
        uMaxSteps: { value: maxSteps },
        uFractalIter: { value: fractalIter },
      },
    });
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat);
    quad.frustumCulled = false;
    group.add(quad);
    this.julia4dMat = mat;
    this.metrics.instanceCount = maxSteps;
  }

  /* === SCENE 24: Tokamak Thermonuclear Fusion Reactor & Toroidal Plasma === */
  private buildTokamakFusionScene(group: THREE.Group): void {
    if (!this.camera) return;
    this.camera.position.set(0, 3.6, 8.9);
    this.camera.lookAt(0, 0.4, 0);

    const tokamak = new THREE.Group();
    // 18 Superconducting Toroidal Field (TF) D-shaped coils
    const coilGeo = new THREE.TorusGeometry(1.45, 0.11, 16, 48);
    const coilMat = new THREE.MeshPhysicalMaterial({
      color: 0x334155,
      emissive: 0x0284c7,
      emissiveIntensity: 0.35,
      metalness: 0.9,
      roughness: 0.18,
      clearcoat: 0.8,
    });
    for (let c = 0; c < 18; c++) {
      const a = (c / 18) * Math.PI * 2;
      const coil = new THREE.Mesh(coilGeo, coilMat);
      coil.position.set(Math.cos(a) * 2.95, 0.4, Math.sin(a) * 2.95);
      coil.rotation.y = -a;
      tokamak.add(coil);
    }

    // Central solenoid column
    const solenoid = new THREE.Mesh(
      new THREE.CylinderGeometry(0.95, 0.95, 3.8, 32),
      new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.92, roughness: 0.2 })
    );
    solenoid.position.y = 0.4;
    tokamak.add(solenoid);

    // Blazing 150M °C Toroidal Plasma Core Ring
    const plasmaRing = new THREE.Mesh(
      new THREE.TorusGeometry(2.95, 0.58, 32, 120),
      new THREE.MeshBasicMaterial({
        color: 0xf43f5e,
        transparent: true,
        opacity: 0.62,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    plasmaRing.rotation.x = Math.PI / 2;
    plasmaRing.position.y = 0.4;
    tokamak.add(plasmaRing);

    // High-energy fusion plasma ions spiraling around the torus
    const ionCount = this.isSoftwareGl ? 900 : PRESET_CONFIG[this.preset].instances;
    const ionGeo = new THREE.SphereGeometry(0.052, 6, 6);
    const ionMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const ions = new THREE.InstancedMesh(ionGeo, ionMat, ionCount);
    ions.name = 'tokamakIons';
    for (let i = 0; i < ionCount; i++) {
      const u = (i / ionCount) * Math.PI * 2;
      const v = i * 0.37;
      const R = 2.95;
      const r = 0.15 + (i % 9) * 0.065;
      const x = (R + r * Math.cos(v)) * Math.cos(u);
      const z = (R + r * Math.cos(v)) * Math.sin(u);
      const y = 0.4 + r * Math.sin(v);
      _dummyObj.position.set(x, y, z);
      _dummyObj.scale.setScalar(0.65 + (i % 4) * 0.25);
      _dummyObj.updateMatrix();
      ions.setMatrixAt(i, _dummyObj.matrix);
      _colorScratch.setHex(i % 3 === 0 ? 0xfbbf24 : i % 3 === 1 ? 0xf43f5e : 0x38bdf8);
      ions.setColorAt(i, _colorScratch);
    }
    ions.instanceMatrix.needsUpdate = true;
    if (ions.instanceColor) ions.instanceColor.needsUpdate = true;
    tokamak.add(ions);

    group.add(tokamak);
    this.tokamakGroup = tokamak;
    this.metrics.instanceCount = ionCount;
  }

  /* === SCENE 25: Liquid Chrome Metaballs & Dielectric Orbs === */
  private buildRaytracedMetaballsScene(group: THREE.Group): void {
    if (!this.camera) return;
    this.camera.position.set(0, 2.2, 8.4);
    this.camera.lookAt(0, 0.4, 0);

    const mbGroup = new THREE.Group();
    const chromeMat = new THREE.MeshPhysicalMaterial({
      color: 0xe2e8f0,
      metalness: 0.98,
      roughness: 0.02,
      clearcoat: 1.0,
      clearcoatRoughness: 0.01,
      iridescence: 0.85,
      iridescenceIOR: 1.5,
    });

    // 16 high-tessellation coalescing liquid metal spheres
    for (let i = 0; i < 16; i++) {
      const r = i === 0 ? 1.25 : 0.42 + (i % 5) * 0.14;
      const orb = new THREE.Mesh(new THREE.SphereGeometry(r, 64, 64), chromeMat);
      orb.name = `metaball_${i}`;
      mbGroup.add(orb);
    }

    // Surrounding swarm of micro-droplets
    const dropCount = this.isSoftwareGl ? 800 : PRESET_CONFIG[this.preset].instances;
    const dropGeo = new THREE.IcosahedronGeometry(0.055, 1);
    const dropMat = new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      metalness: 0.9,
      roughness: 0.1,
      clearcoat: 1.0,
    });
    const drops = new THREE.InstancedMesh(dropGeo, dropMat, dropCount);
    drops.name = 'metaballDrops';
    for (let i = 0; i < dropCount; i++) {
      const a = (i / dropCount) * Math.PI * 30;
      const rad = 1.9 + (i % 17) * 0.22;
      const y = ((i % 41) - 20) * 0.12;
      _dummyObj.position.set(Math.cos(a) * rad, y, Math.sin(a) * rad);
      _dummyObj.scale.setScalar(0.5 + (i % 4) * 0.3);
      _dummyObj.updateMatrix();
      drops.setMatrixAt(i, _dummyObj.matrix);
      _colorScratch.setHex(i % 3 === 0 ? 0x38bdf8 : i % 3 === 1 ? 0xf472b6 : 0xa855f7);
      drops.setColorAt(i, _colorScratch);
    }
    drops.instanceMatrix.needsUpdate = true;
    if (drops.instanceColor) drops.instanceColor.needsUpdate = true;
    mbGroup.add(drops);

    group.add(mbGroup);
    this.metaballsGroup = mbGroup;
    this.metrics.instanceCount = dropCount + 16;
  }

  /* === SCENE 26: Gerstner Storm Ocean & Subsurface Foam Spray === */
  private buildOceanGerstnerFftScene(group: THREE.Group): void {
    if (!this.camera) return;
    this.camera.position.set(0, 3.6, 9.4);
    this.camera.lookAt(0, 0.2, 0);

    const res = this.isSoftwareGl ? 48 : this.preset === 'ultra' ? 190 : this.preset === 'extreme' ? 150 : 104;
    const oceanGeo = new THREE.PlaneGeometry(18, 18, res, res);
    oceanGeo.rotateX(-Math.PI / 2);
    const oceanMat = new THREE.MeshPhysicalMaterial({
      color: 0x0284c7,
      emissive: 0x083344,
      emissiveIntensity: 0.45,
      metalness: 0.15,
      roughness: 0.12,
      transmission: 0.65,
      ior: 1.333,
      thickness: 2.0,
      clearcoat: 1.0,
      clearcoatRoughness: 0.06,
      side: THREE.DoubleSide,
    });
    const ocean = new THREE.Mesh(oceanGeo, oceanMat);
    group.add(ocean);
    this.oceanMesh = ocean;

    // Storm lighthouse / energy beacon in the center of the waves
    const beacon = new THREE.Mesh(
      new THREE.CylinderGeometry(0.35, 0.65, 3.8, 24),
      new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.85, roughness: 0.25 })
    );
    beacon.position.y = 1.4;
    const lantern = new THREE.Mesh(
      new THREE.SphereGeometry(0.45, 24, 24),
      new THREE.MeshBasicMaterial({ color: 0x38bdf8 })
    );
    lantern.position.y = 3.5;
    group.add(beacon, lantern);

    // Sea spray foam particles
    const foamCount = this.isSoftwareGl ? 600 : PRESET_CONFIG[this.preset].instances;
    const foamGeo = new THREE.DodecahedronGeometry(0.045, 0);
    const foamMat = new THREE.MeshBasicMaterial({ color: 0xe0f2fe });
    const foam = new THREE.InstancedMesh(foamGeo, foamMat, foamCount);
    for (let i = 0; i < foamCount; i++) {
      const x = ((i % 80) / 80 - 0.5) * 16;
      const z = (((i * 13) % 80) / 80 - 0.5) * 16;
      _dummyObj.position.set(x, 0.5, z);
      _dummyObj.scale.setScalar(0.5 + (i % 4) * 0.35);
      _dummyObj.updateMatrix();
      foam.setMatrixAt(i, _dummyObj.matrix);
      _colorScratch.setHex(i % 2 === 0 ? 0xf0f9ff : 0x38bdf8);
      foam.setColorAt(i, _colorScratch);
    }
    foam.instanceMatrix.needsUpdate = true;
    if (foam.instanceColor) foam.instanceColor.needsUpdate = true;
    group.add(foam);
    this.oceanFoamMesh = foam;
    this.metrics.instanceCount = res * res + foamCount;
  }

  /* === SCENE 27: Navier-Stokes CFD Fluid Vortex & 3D Curl-Noise Streamlines === */
  private buildFluidNavierStokesScene(group: THREE.Group): void {
    if (!this.camera) return;
    this.camera.position.set(0, 2.8, 9.2);
    this.camera.lookAt(0, 0.4, 0);

    const count = this.isSoftwareGl ? 900 : PRESET_CONFIG[this.preset].instances;
    const arrowGeo = new THREE.ConeGeometry(0.042, 0.28, 6);
    arrowGeo.rotateX(Math.PI / 2);
    const arrowMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0x06b6d4,
      emissiveIntensity: 0.4,
      metalness: 0.75,
      roughness: 0.2,
    });
    const mesh = new THREE.InstancedMesh(arrowGeo, arrowMat, count);
    mesh.frustumCulled = false;

    const data = new Float32Array(count * 4);
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = 0.6 + Math.random() * 4.8;
      const y = (Math.random() - 0.5) * 4.2;
      const spd = 0.7 + Math.random() * 1.6;
      data[i * 4] = a;
      data[i * 4 + 1] = r;
      data[i * 4 + 2] = y;
      data[i * 4 + 3] = spd;

      _dummyObj.position.set(Math.cos(a) * r, y, Math.sin(a) * r);
      _dummyObj.scale.setScalar(0.7 + (i % 4) * 0.25);
      _dummyObj.updateMatrix();
      mesh.setMatrixAt(i, _dummyObj.matrix);
      _colorScratch.setHSL(0.52 + (r / 5.4) * 0.35, 0.9, 0.56);
      mesh.setColorAt(i, _colorScratch);
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    group.add(mesh);

    // Central impeller turbine in CFD chamber
    const impeller = new THREE.Mesh(
      new THREE.TorusKnotGeometry(0.85, 0.22, 128, 24, 3, 5),
      new THREE.MeshPhysicalMaterial({ color: 0x38bdf8, metalness: 0.92, roughness: 0.14, clearcoat: 1.0 })
    );
    group.add(impeller);

    this.cfdFluidMesh = mesh;
    this.cfdFluidData = data;
    this.metrics.instanceCount = count;
  }

  /* === SCENE 28: Global Illumination Radiosity Rotunda & 24 Point Lights === */
  private buildGiRadiosityTempleScene(group: THREE.Group): void {
    if (!this.camera) return;
    this.camera.position.set(0, 3.4, 9.6);
    this.camera.lookAt(0, 1.4, 0);

    const temple = new THREE.Group();
    const floor = new THREE.Mesh(
      new THREE.CylinderGeometry(6.8, 7.2, 0.35, 48),
      new THREE.MeshPhysicalMaterial({ color: 0x0f172a, metalness: 0.9, roughness: 0.08, clearcoat: 1.0 })
    );
    floor.position.y = -0.18;
    temple.add(floor);

    // Two concentric rings of golden & obsidian colonnades
    const colGeo = new THREE.CylinderGeometry(0.24, 0.3, 4.4, 20);
    const goldMat = new THREE.MeshPhysicalMaterial({
      color: 0xfbbf24,
      metalness: 0.94,
      roughness: 0.12,
      clearcoat: 1.0,
    });
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      const col = new THREE.Mesh(colGeo, goldMat);
      col.position.set(Math.cos(a) * 4.8, 2.2, Math.sin(a) * 4.8);
      temple.add(col);
    }

    // Central levitating sun relic
    const relic = new THREE.Mesh(
      new THREE.OctahedronGeometry(1.15, 2),
      new THREE.MeshPhysicalMaterial({
        color: 0xf43f5e,
        emissive: 0xbe123c,
        emissiveIntensity: 0.85,
        metalness: 0.3,
        roughness: 0.1,
        transmission: 0.75,
        ior: 1.6,
        clearcoat: 1.0,
      })
    );
    relic.position.y = 2.1;
    relic.name = 'giRelic';
    temple.add(relic);

    // Radiosity light-bounce prisms
    const count = this.isSoftwareGl ? 700 : PRESET_CONFIG[this.preset].instances;
    const prismGeo = new THREE.BoxGeometry(0.11, 0.11, 0.11);
    const prismMat = new THREE.MeshPhysicalMaterial({ color: 0xffffff, metalness: 0.88, roughness: 0.12 });
    const prisms = new THREE.InstancedMesh(prismGeo, prismMat, count);
    prisms.name = 'giPrisms';
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 28;
      const r = 1.6 + (i % 15) * 0.21;
      const y = 0.3 + ((i * 19) % 100) * 0.038;
      _dummyObj.position.set(Math.cos(a) * r, y, Math.sin(a) * r);
      _dummyObj.rotation.set(a, y, a * 0.5);
      _dummyObj.scale.setScalar(0.6 + (i % 4) * 0.3);
      _dummyObj.updateMatrix();
      prisms.setMatrixAt(i, _dummyObj.matrix);
      _colorScratch.setHex(i % 3 === 0 ? 0xfbbf24 : i % 3 === 1 ? 0x38bdf8 : 0xf43f5e);
      prisms.setColorAt(i, _colorScratch);
    }
    prisms.instanceMatrix.needsUpdate = true;
    if (prisms.instanceColor) prisms.instanceColor.needsUpdate = true;
    temple.add(prisms);

    group.add(temple);
    this.giTempleGroup = temple;
    this.metrics.instanceCount = count;
  }

  /* === SCENE 29: CERN LHC Hadron Collider & ATLAS Particle Detector === */
  private buildParticleColliderCernScene(group: THREE.Group): void {
    if (!this.camera) return;
    this.camera.position.set(0, 2.4, 9.2);
    this.camera.lookAt(0, 0.4, 0);

    const cern = new THREE.Group();
    // Calorimeter detector rings
    const ringMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.88, roughness: 0.22 });
    for (let r = 0; r < 5; r++) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(2.2 + r * 0.65, 0.07, 12, 64), ringMat);
      ring.position.z = (r - 2) * 1.1;
      cern.add(ring);
    }

    // Proton collision vertex core
    const vertexCore = new THREE.Mesh(
      new THREE.SphereGeometry(0.45, 32, 32),
      new THREE.MeshBasicMaterial({ color: 0xffffff })
    );
    cern.add(vertexCore);

    // Quark-gluon collision tracks bursting outward in helical magnetic trajectories
    const count = this.isSoftwareGl ? 900 : PRESET_CONFIG[this.preset].instances;
    const trackGeo = new THREE.BoxGeometry(0.032, 0.032, 0.55);
    const trackMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const tracks = new THREE.InstancedMesh(trackGeo, trackMat, count);
    tracks.name = 'cernTracks';
    for (let i = 0; i < count; i++) {
      const theta = (i / count) * Math.PI * 40;
      const phi = Math.acos(2 * ((i * 17) % 1000) / 1000 - 1);
      const rad = 0.5 + ((i * 31) % 1000) / 1000 * 5.2;
      const x = rad * Math.sin(phi) * Math.cos(theta);
      const y = rad * Math.cos(phi);
      const z = rad * Math.sin(phi) * Math.sin(theta);
      _dummyObj.position.set(x, y, z);
      _dummyObj.lookAt(0, 0, 0);
      _dummyObj.scale.set(1, 1, 0.6 + (i % 5) * 0.45);
      _dummyObj.updateMatrix();
      tracks.setMatrixAt(i, _dummyObj.matrix);
      _colorScratch.setHex(i % 4 === 0 ? 0x22d3ee : i % 4 === 1 ? 0xfbbf24 : i % 4 === 2 ? 0xf43f5e : 0xa855f7);
      tracks.setColorAt(i, _colorScratch);
    }
    tracks.instanceMatrix.needsUpdate = true;
    if (tracks.instanceColor) tracks.instanceColor.needsUpdate = true;
    cern.add(tracks);

    group.add(cern);
    this.cernColliderGroup = cern;
    this.metrics.instanceCount = count;
  }

  /* === SCENE 30: Procedural Exoplanet & Rayleigh Atmospheric Scattering === */
  private buildProceduralPlanetAtmoScene(group: THREE.Group): void {
    if (!this.camera) return;
    this.camera.position.set(0, 2.8, 9.4);
    this.camera.lookAt(0, 0, 0);

    const planetGroup = new THREE.Group();
    // High-res displaced exoplanet surface
    const planetGeo = new THREE.SphereGeometry(2.15, 96, 96);
    const pos = planetGeo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      const z = pos.getZ(i);
      const h =
        Math.sin(x * 3.5) * Math.cos(y * 3.5) * Math.sin(z * 3.5) * 0.08 +
        Math.sin(x * 8.0 + y * 6.0) * 0.03;
      const s = 1 + Math.max(-0.02, h);
      pos.setXYZ(i, x * s, y * s, z * s);
    }
    planetGeo.computeVertexNormals();
    const planetMat = new THREE.MeshPhysicalMaterial({
      color: 0x0284c7,
      emissive: 0x064e3b,
      emissiveIntensity: 0.35,
      metalness: 0.35,
      roughness: 0.32,
      clearcoat: 0.85,
    });
    const planet = new THREE.Mesh(planetGeo, planetMat);
    planetGroup.add(planet);

    // Rayleigh atmospheric halo shell
    const atmo = new THREE.Mesh(
      new THREE.SphereGeometry(2.38, 64, 64),
      new THREE.MeshBasicMaterial({
        color: 0x38bdf8,
        transparent: true,
        opacity: 0.22,
        blending: THREE.AdditiveBlending,
        side: THREE.BackSide,
      })
    );
    planetGroup.add(atmo);

    // Planetary ice & asteroid ring system
    const count = this.isSoftwareGl ? 900 : PRESET_CONFIG[this.preset].instances;
    const rockGeo = new THREE.DodecahedronGeometry(0.055, 0);
    const rockMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.7, roughness: 0.25 });
    const ringRocks = new THREE.InstancedMesh(rockGeo, rockMat, count);
    ringRocks.name = 'planetRingRocks';
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2;
      const r = 3.1 + ((i * 19) % 1000) / 1000 * 2.4;
      const y = (((i * 7) % 100) / 100 - 0.5) * 0.16;
      _dummyObj.position.set(Math.cos(a) * r, y, Math.sin(a) * r);
      _dummyObj.rotation.set(a, i, a * 0.5);
      _dummyObj.scale.setScalar(0.5 + (i % 5) * 0.3);
      _dummyObj.updateMatrix();
      ringRocks.setMatrixAt(i, _dummyObj.matrix);
      _colorScratch.setHex(i % 3 === 0 ? 0x7dd3fc : i % 3 === 1 ? 0xe2e8f0 : 0xa855f7);
      ringRocks.setColorAt(i, _colorScratch);
    }
    ringRocks.instanceMatrix.needsUpdate = true;
    if (ringRocks.instanceColor) ringRocks.instanceColor.needsUpdate = true;
    ringRocks.rotation.x = 0.32;
    ringRocks.rotation.z = -0.18;
    planetGroup.add(ringRocks);

    group.add(planetGroup);
    this.exoplanetGroup = planetGroup;
    this.metrics.instanceCount = count;
  }

  /* === SCENE 31: Volumetric Fire Tornado & Blackbody Ember Swarm === */
  private buildVolumetricFireTornadoScene(group: THREE.Group): void {
    if (!this.camera) return;
    this.camera.position.set(0, 3.2, 9.2);
    this.camera.lookAt(0, 1.8, 0);

    const fireGroup = new THREE.Group();
    // Nested helical fire funnel cones
    const funnelColors = [0xfef08a, 0xf97316, 0xef4444, 0x991b1b];
    for (let f = 0; f < 4; f++) {
      const funnel = new THREE.Mesh(
        new THREE.CylinderGeometry(1.4 + f * 0.38, 0.35 + f * 0.15, 6.2, 32, 24, true),
        new THREE.MeshBasicMaterial({
          color: funnelColors[f],
          wireframe: f % 2 === 1,
          transparent: true,
          opacity: 0.32 - f * 0.05,
          blending: THREE.AdditiveBlending,
          side: THREE.DoubleSide,
          depthWrite: false,
        })
      );
      funnel.position.y = 2.8;
      funnel.name = `fireFunnel_${f}`;
      fireGroup.add(funnel);
    }

    // Swirling ember storm particles
    const count = this.isSoftwareGl ? 900 : PRESET_CONFIG[this.preset].instances;
    const emberGeo = new THREE.TetrahedronGeometry(0.055, 0);
    const emberMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const embers = new THREE.InstancedMesh(emberGeo, emberMat, count);
    embers.name = 'fireEmbers';
    for (let i = 0; i < count; i++) {
      const h = (i / count) * 6.4;
      const a = i * 0.25;
      const r = 0.4 + (h / 6.4) * 2.2 + ((i % 7) * 0.18);
      _dummyObj.position.set(Math.cos(a) * r, h, Math.sin(a) * r);
      _dummyObj.scale.setScalar(0.5 + (i % 4) * 0.35);
      _dummyObj.updateMatrix();
      embers.setMatrixAt(i, _dummyObj.matrix);
      _colorScratch.setHex(funnelColors[i % funnelColors.length]);
      embers.setColorAt(i, _colorScratch);
    }
    embers.instanceMatrix.needsUpdate = true;
    if (embers.instanceColor) embers.instanceColor.needsUpdate = true;
    fireGroup.add(embers);

    group.add(fireGroup);
    this.fireTornadoGroup = fireGroup;
    this.metrics.instanceCount = count;
  }

  /* === SCENE 32: 4D Hypercube Tesseract & Quantum Matrix === */
  private buildCyberMatrixHypercubeScene(group: THREE.Group): void {
    if (!this.camera) return;
    this.camera.position.set(0, 2.8, 9.0);
    this.camera.lookAt(0, 0.4, 0);

    const hcGroup = new THREE.Group();
    const frameMat = new THREE.MeshPhysicalMaterial({
      color: 0x22d3ee,
      emissive: 0x0891b2,
      emissiveIntensity: 0.75,
      metalness: 0.9,
      roughness: 0.1,
      wireframe: true,
    });
    // Outer and inner 4D tesseract cubes + hyperspace diagonal struts
    const outerCube = new THREE.Mesh(new THREE.BoxGeometry(3.4, 3.4, 3.4, 4, 4, 4), frameMat);
    outerCube.position.y = 0.6;
    outerCube.name = 'tesseractOuter';
    const innerCube = new THREE.Mesh(
      new THREE.BoxGeometry(1.7, 1.7, 1.7, 3, 3, 3),
      new THREE.MeshPhysicalMaterial({
        color: 0xf43f5e,
        emissive: 0xe11d48,
        emissiveIntensity: 0.85,
        metalness: 0.9,
        roughness: 0.1,
        wireframe: true,
      })
    );
    innerCube.position.y = 0.6;
    innerCube.name = 'tesseractInner';
    hcGroup.add(outerCube, innerCube);

    // 32k Quantum matrix lattice nodes around the tesseract
    const count = this.isSoftwareGl ? 900 : PRESET_CONFIG[this.preset].instances;
    const nodeGeo = new THREE.BoxGeometry(0.065, 0.065, 0.065);
    const nodeMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const matrixNodes = new THREE.InstancedMesh(nodeGeo, nodeMat, count);
    matrixNodes.name = 'tesseractNodes';
    const side = Math.ceil(Math.cbrt(count));
    for (let i = 0; i < count; i++) {
      const ix = (i % side) - side / 2;
      const iy = (Math.floor(i / side) % side) - side / 2;
      const iz = Math.floor(i / (side * side)) - side / 2;
      const spacing = 8.4 / Math.max(1, side);
      _dummyObj.position.set(ix * spacing, 0.6 + iy * spacing, iz * spacing);
      _dummyObj.scale.setScalar(0.65 + (i % 3) * 0.25);
      _dummyObj.updateMatrix();
      matrixNodes.setMatrixAt(i, _dummyObj.matrix);
      _colorScratch.setHex(i % 3 === 0 ? 0x22d3ee : i % 3 === 1 ? 0xa855f7 : 0x10b981);
      matrixNodes.setColorAt(i, _colorScratch);
    }
    matrixNodes.instanceMatrix.needsUpdate = true;
    if (matrixNodes.instanceColor) matrixNodes.instanceColor.needsUpdate = true;
    hcGroup.add(matrixNodes);

    group.add(hcGroup);
    this.hypercubeGroup = hcGroup;
    this.metrics.instanceCount = count;
  }

  /* === SCENE 33: Voxel Octree Global Illumination & Mirrored Cathedral === */
  private buildVoxelPathtracerScene(group: THREE.Group): void {
    if (!this.camera) return;
    this.camera.position.set(0, 3.4, 9.2);
    this.camera.lookAt(0, 1.2, 0);

    const voxGroup = new THREE.Group();
    const count = this.isSoftwareGl ? 1200 : PRESET_CONFIG[this.preset].instances;
    const voxGeo = new THREE.BoxGeometry(0.18, 0.18, 0.18);
    const voxMat = new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      metalness: 0.86,
      roughness: 0.14,
      clearcoat: 1.0,
    });
    const inst = new THREE.InstancedMesh(voxGeo, voxMat, count);
    inst.name = 'voxelBlocks';
    for (let i = 0; i < count; i++) {
      const ring = 1.6 + (i % 16) * 0.35;
      const a = (i / count) * Math.PI * 24;
      const y = Math.floor((i % 64) / 4) * 0.22 - 0.6 + Math.sin(a * 3) * 0.8;
      _dummyObj.position.set(Math.cos(a) * ring, y, Math.sin(a) * ring);
      _dummyObj.rotation.set(0, -a, 0);
      _dummyObj.scale.setScalar(0.85 + (i % 4) * 0.2);
      _dummyObj.updateMatrix();
      inst.setMatrixAt(i, _dummyObj.matrix);
      _colorScratch.setHSL(((i * 0.017) % 1), 0.85, 0.56);
      inst.setColorAt(i, _colorScratch);
    }
    inst.instanceMatrix.needsUpdate = true;
    if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
    voxGroup.add(inst);

    const prism = new THREE.Mesh(
      new THREE.OctahedronGeometry(1.15, 0),
      new THREE.MeshPhysicalMaterial({
        color: 0x38bdf8,
        emissive: 0x0284c7,
        emissiveIntensity: 0.6,
        transmission: 0.85,
        roughness: 0.05,
        ior: 1.52,
      })
    );
    prism.position.y = 1.2;
    prism.name = 'voxelPrism';
    voxGroup.add(prism);

    group.add(voxGroup);
    this.voxelGiGroup = voxGroup;
    this.metrics.instanceCount = count;
  }

  /* === SCENE 34: Dual Spiral Galaxy Collision (N-Body Andromeda Merger) === */
  private buildNbodyGalaxyCollisionScene(group: THREE.Group): void {
    if (!this.camera) return;
    this.camera.position.set(0, 4.8, 10.5);
    this.camera.lookAt(0, 0, 0);

    const colGroup = new THREE.Group();
    const coreMatA = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
    const coreMatB = new THREE.MeshBasicMaterial({ color: 0xf97316 });
    const bhA = new THREE.Mesh(new THREE.SphereGeometry(0.55, 24, 24), coreMatA);
    bhA.position.set(-2.4, 0.4, 0);
    bhA.name = 'galaxyCoreA';
    const bhB = new THREE.Mesh(new THREE.SphereGeometry(0.48, 24, 24), coreMatB);
    bhB.position.set(2.4, -0.4, 0);
    bhB.name = 'galaxyCoreB';
    colGroup.add(bhA, bhB);

    const count = this.isSoftwareGl ? 1500 : PRESET_CONFIG[this.preset].instances;
    const starGeo = new THREE.TetrahedronGeometry(0.055, 0);
    const starMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const stars = new THREE.InstancedMesh(starGeo, starMat, count);
    stars.name = 'collisionStars';
    for (let i = 0; i < count; i++) {
      const isSecond = i % 2 === 1;
      const cx = isSecond ? 2.4 : -2.4;
      const cy = isSecond ? -0.4 : 0.4;
      const r = 0.35 + ((i % 400) / 400) * 4.2;
      const arm = (i % 3) * ((Math.PI * 2) / 3) + r * 1.45;
      const tilt = isSecond ? -0.42 : 0.35;
      const x = cx + Math.cos(arm) * r;
      const z = Math.sin(arm) * r;
      const y = cy + Math.sin(arm) * r * Math.sin(tilt);
      _dummyObj.position.set(x, y, z);
      _dummyObj.scale.setScalar(0.55 + (i % 5) * 0.25);
      _dummyObj.updateMatrix();
      stars.setMatrixAt(i, _dummyObj.matrix);
      _colorScratch.setHex(isSecond ? (i % 4 === 0 ? 0xfef08a : 0xf97316) : (i % 4 === 0 ? 0xe0f2fe : 0x38bdf8));
      stars.setColorAt(i, _colorScratch);
    }
    stars.instanceMatrix.needsUpdate = true;
    if (stars.instanceColor) stars.instanceColor.needsUpdate = true;
    colGroup.add(stars);

    group.add(colGroup);
    this.galaxyCollisionGroup = colGroup;
    this.metrics.instanceCount = count;
  }

  /* === SCENE 35: Refractive Caustic Water Pool & Capillary Waves === */
  private buildCausticWaterPoolScene(group: THREE.Group): void {
    if (!this.camera) return;
    this.camera.position.set(0, 4.2, 8.8);
    this.camera.lookAt(0, 0.4, 0);

    const poolGroup = new THREE.Group();
    const waterGeo = new THREE.PlaneGeometry(11, 11, 72, 72);
    waterGeo.rotateX(-Math.PI / 2);
    const waterMesh = new THREE.Mesh(
      waterGeo,
      new THREE.MeshPhysicalMaterial({
        color: 0x06b6d4,
        emissive: 0x083344,
        emissiveIntensity: 0.4,
        metalness: 0.1,
        roughness: 0.08,
        transmission: 0.85,
        ior: 1.333,
        clearcoat: 1.0,
        wireframe: false,
      })
    );
    waterMesh.position.y = 1.1;
    waterMesh.name = 'causticSurface';
    poolGroup.add(waterMesh);

    const count = this.isSoftwareGl ? 1000 : PRESET_CONFIG[this.preset].instances;
    const beamGeo = new THREE.OctahedronGeometry(0.06, 0);
    const beamMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const caustics = new THREE.InstancedMesh(beamGeo, beamMat, count);
    caustics.name = 'causticPhotons';
    for (let i = 0; i < count; i++) {
      const x = ((i % 64) / 64 - 0.5) * 10.2;
      const z = ((Math.floor(i / 64) % 64) / 64 - 0.5) * 10.2;
      const y = -0.8 + Math.sin(x * 1.8) * Math.cos(z * 1.8) * 0.25;
      _dummyObj.position.set(x, y, z);
      _dummyObj.scale.set(1.4, 0.35, 1.4);
      _dummyObj.updateMatrix();
      caustics.setMatrixAt(i, _dummyObj.matrix);
      _colorScratch.setHex(i % 2 === 0 ? 0x22d3ee : 0x67e8f9);
      caustics.setColorAt(i, _colorScratch);
    }
    caustics.instanceMatrix.needsUpdate = true;
    if (caustics.instanceColor) caustics.instanceColor.needsUpdate = true;
    poolGroup.add(caustics);

    group.add(poolGroup);
    this.causticPoolGroup = poolGroup;
    this.metrics.instanceCount = count;
  }

  /* === SCENE 36: 3D Apollonian Gasket Sphere Packing & Golden Ratio === */
  private buildFractalApollonianScene(group: THREE.Group): void {
    if (!this.camera) return;
    this.camera.position.set(0, 2.8, 8.6);
    this.camera.lookAt(0, 0.5, 0);

    const apGroup = new THREE.Group();
    const count = this.isSoftwareGl ? 900 : PRESET_CONFIG[this.preset].instances;
    const sphGeo = new THREE.IcosahedronGeometry(0.14, 1);
    const sphMat = new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      metalness: 0.92,
      roughness: 0.12,
      clearcoat: 1.0,
    });
    const gasket = new THREE.InstancedMesh(sphGeo, sphMat, count);
    gasket.name = 'apollonianSpheres';
    const phiAngle = Math.PI * (3 - Math.sqrt(5));
    for (let i = 0; i < count; i++) {
      const yNorm = 1 - (i / Math.max(1, count - 1)) * 2;
      const radAtY = Math.sqrt(Math.max(0, 1 - yNorm * yNorm));
      const theta = phiAngle * i;
      const layerR = 1.2 + (i % 5) * 0.68;
      _dummyObj.position.set(
        Math.cos(theta) * radAtY * layerR,
        0.6 + yNorm * layerR,
        Math.sin(theta) * radAtY * layerR
      );
      const sc = 0.35 + (1 / (1 + (i % 7))) * 1.35;
      _dummyObj.scale.setScalar(sc);
      _dummyObj.updateMatrix();
      gasket.setMatrixAt(i, _dummyObj.matrix);
      _colorScratch.setHex(i % 3 === 0 ? 0xf59e0b : i % 3 === 1 ? 0x38bdf8 : 0xe2e8f0);
      gasket.setColorAt(i, _colorScratch);
    }
    gasket.instanceMatrix.needsUpdate = true;
    if (gasket.instanceColor) gasket.instanceColor.needsUpdate = true;
    apGroup.add(gasket);

    group.add(apGroup);
    this.apollonianGroup = apGroup;
    this.metrics.instanceCount = count;
  }

  /* === SCENE 37: Cyber-Mecha Titan Hangar & Laser Gantries === */
  private buildCyberMechaHangarScene(group: THREE.Group): void {
    if (!this.camera) return;
    this.camera.position.set(0, 3.2, 9.4);
    this.camera.lookAt(0, 1.5, 0);

    const hangarGroup = new THREE.Group();
    const armorMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      metalness: 0.9,
      roughness: 0.2,
      emissive: 0x0ea5e9,
      emissiveIntensity: 0.3,
    });
    const torso = new THREE.Mesh(new THREE.BoxGeometry(2.4, 2.8, 1.6), armorMat);
    torso.position.y = 2.2;
    const head = new THREE.Mesh(new THREE.OctahedronGeometry(0.65, 1), armorMat);
    head.position.y = 4.1;
    const shoulderL = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.4, 1.8), armorMat);
    shoulderL.position.set(-1.95, 2.9, 0);
    const shoulderR = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.4, 1.8), armorMat);
    shoulderR.position.set(1.95, 2.9, 0);
    hangarGroup.add(torso, head, shoulderL, shoulderR);

    // Scanning laser ring around the mech
    const scanRing = new THREE.Mesh(
      new THREE.TorusGeometry(3.2, 0.05, 12, 64),
      new THREE.MeshBasicMaterial({ color: 0x10b981 })
    );
    scanRing.rotation.x = Math.PI / 2;
    scanRing.name = 'mechaScanRing';
    hangarGroup.add(scanRing);

    const count = this.isSoftwareGl ? 1000 : PRESET_CONFIG[this.preset].instances;
    const sparkGeo = new THREE.BoxGeometry(0.04, 0.16, 0.04);
    const sparkMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const sparks = new THREE.InstancedMesh(sparkGeo, sparkMat, count);
    sparks.name = 'mechaSparks';
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 20;
      const r = 2.0 + (i % 15) * 0.28;
      const y = (i % 50) * 0.1;
      _dummyObj.position.set(Math.cos(a) * r, y, Math.sin(a) * r);
      _dummyObj.rotation.set(0, a, 0.3);
      _dummyObj.updateMatrix();
      sparks.setMatrixAt(i, _dummyObj.matrix);
      _colorScratch.setHex(i % 2 === 0 ? 0xfbbf24 : 0x38bdf8);
      sparks.setColorAt(i, _colorScratch);
    }
    sparks.instanceMatrix.needsUpdate = true;
    if (sparks.instanceColor) sparks.instanceColor.needsUpdate = true;
    hangarGroup.add(sparks);

    group.add(hangarGroup);
    this.mechaHangarGroup = hangarGroup;
    this.metrics.instanceCount = count;
  }

  /* === SCENE 38: Pulsar Magnetosphere & Van Allen Radiation Belts === */
  private buildPlasmaMagnetosphereScene(group: THREE.Group): void {
    if (!this.camera) return;
    this.camera.position.set(0, 3.0, 9.6);
    this.camera.lookAt(0, 0.4, 0);

    const magGroup = new THREE.Group();
    const pulsar = new THREE.Mesh(
      new THREE.SphereGeometry(0.95, 32, 32),
      new THREE.MeshBasicMaterial({ color: 0x38bdf8 })
    );
    pulsar.position.y = 0.4;
    magGroup.add(pulsar);

    for (let l = 0; l < 12; l++) {
      const loop = new THREE.Mesh(
        new THREE.TorusGeometry(2.4, 0.025, 10, 64),
        new THREE.MeshBasicMaterial({ color: 0x818cf8, transparent: true, opacity: 0.45 })
      );
      const a = (l / 12) * Math.PI * 2;
      loop.position.set(Math.cos(a) * 1.6, 0.4, Math.sin(a) * 1.6);
      loop.rotation.y = -a;
      magGroup.add(loop);
    }

    const count = this.isSoftwareGl ? 1200 : PRESET_CONFIG[this.preset].instances;
    const ionGeo = new THREE.TetrahedronGeometry(0.055, 0);
    const ionMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const belt = new THREE.InstancedMesh(ionGeo, ionMat, count);
    belt.name = 'vanAllenBelt';
    for (let i = 0; i < count; i++) {
      const phi = (i / count) * Math.PI * 2;
      const theta = ((i * 19) % 360) * (Math.PI / 180);
      const r = 2.6 + Math.sin(theta) * Math.sin(theta) * 2.4;
      _dummyObj.position.set(
        r * Math.sin(theta) * Math.cos(phi),
        0.4 + r * Math.cos(theta) * 0.55,
        r * Math.sin(theta) * Math.sin(phi)
      );
      _dummyObj.scale.setScalar(0.6 + (i % 4) * 0.25);
      _dummyObj.updateMatrix();
      belt.setMatrixAt(i, _dummyObj.matrix);
      _colorScratch.setHex(i % 3 === 0 ? 0x22d3ee : i % 3 === 1 ? 0xc084fc : 0x34d399);
      belt.setColorAt(i, _colorScratch);
    }
    belt.instanceMatrix.needsUpdate = true;
    if (belt.instanceColor) belt.instanceColor.needsUpdate = true;
    magGroup.add(belt);

    group.add(magGroup);
    this.magnetosphereGroup = magGroup;
    this.metrics.instanceCount = count;
  }

  /* === SCENE 39: Amethyst Geode Cave & Multi-Bounce Refraction === */
  private buildCrystalGeodeCaveScene(group: THREE.Group): void {
    if (!this.camera) return;
    this.camera.position.set(0, 2.4, 8.6);
    this.camera.lookAt(0, 0.5, 0);

    const geodeGroup = new THREE.Group();
    const count = this.isSoftwareGl ? 1000 : PRESET_CONFIG[this.preset].instances;
    const shardGeo = new THREE.ConeGeometry(0.11, 0.55, 6);
    const shardMat = new THREE.MeshPhysicalMaterial({
      color: 0xc084fc,
      emissive: 0x6b21a8,
      emissiveIntensity: 0.45,
      metalness: 0.25,
      roughness: 0.1,
      clearcoat: 1.0,
    });
    const crystals = new THREE.InstancedMesh(shardGeo, shardMat, count);
    crystals.name = 'geodeCrystals';
    const golden = Math.PI * (3 - Math.sqrt(5));
    for (let i = 0; i < count; i++) {
      const y = 1 - (i / Math.max(1, count - 1)) * 2;
      const rSphere = Math.sqrt(Math.max(0, 1 - y * y));
      const th = golden * i;
      const shellR = 3.8 + (i % 4) * 0.25;
      const px = Math.cos(th) * rSphere * shellR;
      const py = 0.6 + y * shellR * 0.75;
      const pz = Math.sin(th) * rSphere * shellR;
      _dummyObj.position.set(px, py, pz);
      _dummyObj.lookAt(0, 0.6, 0);
      _dummyObj.rotateX(Math.PI / 2);
      _dummyObj.scale.setScalar(0.65 + (i % 5) * 0.32);
      _dummyObj.updateMatrix();
      crystals.setMatrixAt(i, _dummyObj.matrix);
      _colorScratch.setHex(i % 3 === 0 ? 0xa855f7 : i % 3 === 1 ? 0xec4899 : 0x38bdf8);
      crystals.setColorAt(i, _colorScratch);
    }
    crystals.instanceMatrix.needsUpdate = true;
    if (crystals.instanceColor) crystals.instanceColor.needsUpdate = true;
    geodeGroup.add(crystals);

    group.add(geodeGroup);
    this.geodeCaveGroup = geodeGroup;
    this.metrics.instanceCount = count;
  }

  /* === SCENE 40: Quantum Chromodynamics (Lattice QCD & Gluon Flux Tubes) === */
  private buildQuantumChromodynamicsScene(group: THREE.Group): void {
    if (!this.camera) return;
    this.camera.position.set(0, 2.8, 8.8);
    this.camera.lookAt(0, 0.5, 0);

    const qcdGroup = new THREE.Group();
    const quarkColors = [0xef4444, 0x10b981, 0x3b82f6];
    const quarkPos = [
      new THREE.Vector3(-1.8, 0.8, 0.9),
      new THREE.Vector3(1.8, 0.8, 0.9),
      new THREE.Vector3(0, 1.9, -1.6),
    ];
    quarkPos.forEach((p, idx) => {
      const q = new THREE.Mesh(
        new THREE.IcosahedronGeometry(0.58, 3),
        new THREE.MeshPhysicalMaterial({
          color: quarkColors[idx],
          emissive: quarkColors[idx],
          emissiveIntensity: 0.75,
          clearcoat: 1.0,
        })
      );
      q.position.copy(p);
      q.name = `quark_${idx}`;
      qcdGroup.add(q);
    });

    const count = this.isSoftwareGl ? 1000 : PRESET_CONFIG[this.preset].instances;
    const gluonGeo = new THREE.OctahedronGeometry(0.06, 0);
    const gluonMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const gluons = new THREE.InstancedMesh(gluonGeo, gluonMat, count);
    gluons.name = 'gluonFlux';
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 28;
      const r = 0.6 + (i % 24) * 0.16;
      _dummyObj.position.set(
        Math.cos(a) * r,
        0.8 + Math.sin(a * 1.5) * 1.4,
        Math.sin(a) * r
      );
      _dummyObj.scale.setScalar(0.55 + (i % 4) * 0.25);
      _dummyObj.updateMatrix();
      gluons.setMatrixAt(i, _dummyObj.matrix);
      _colorScratch.setHex(quarkColors[i % 3]);
      gluons.setColorAt(i, _colorScratch);
    }
    gluons.instanceMatrix.needsUpdate = true;
    if (gluons.instanceColor) gluons.instanceColor.needsUpdate = true;
    qcdGroup.add(gluons);

    group.add(qcdGroup);
    this.qcdLatticeGroup = qcdGroup;
    this.metrics.instanceCount = count;
  }

  /* === SCENE 41: Nanite-Style Meshlet Micropolygon Cluster Stress === */
  private buildMeshletNaniteClusterScene(group: THREE.Group): void {
    if (!this.camera) return;
    this.camera.position.set(0, 2.2, 8.6);
    this.camera.lookAt(0, 0.8, 0);

    const meshletGrp = new THREE.Group();
    const core = new THREE.Mesh(
      new THREE.IcosahedronGeometry(1.45, 4),
      new THREE.MeshStandardMaterial({
        color: 0x0ea5e9,
        metalness: 0.78,
        roughness: 0.24,
        wireframe: false,
        flatShading: true,
      })
    );
    core.position.y = 0.85;
    meshletGrp.add(core);

    const count = this.isSoftwareGl ? 1200 : Math.min(28000, PRESET_CONFIG[this.preset].instances);
    const clusterGeo = new THREE.TetrahedronGeometry(0.11, 0);
    const clusterMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      metalness: 0.65,
      roughness: 0.32,
      flatShading: true,
    });
    const inst = new THREE.InstancedMesh(clusterGeo, clusterMat, count);
    inst.name = 'meshletClusters';
    const clusterColors = [0x06b6d4, 0x3b82f6, 0x8b5cf6, 0xf59e0b, 0x10b981, 0xf43f5e];
    for (let i = 0; i < count; i++) {
      const phi = Math.acos(1 - (2 * (i + 0.5)) / count);
      const theta = Math.PI * (1 + Math.sqrt(5)) * i;
      const layer = 1.85 + (i % 5) * 0.48;
      _dummyObj.position.set(
        layer * Math.sin(phi) * Math.cos(theta),
        0.85 + layer * Math.cos(phi),
        layer * Math.sin(phi) * Math.sin(theta)
      );
      _dummyObj.rotation.set(phi, theta, i * 0.13);
      _dummyObj.scale.setScalar(0.55 + (i % 4) * 0.18);
      _dummyObj.updateMatrix();
      inst.setMatrixAt(i, _dummyObj.matrix);
      _colorScratch.setHex(clusterColors[Math.floor(i / 24) % clusterColors.length]);
      inst.setColorAt(i, _colorScratch);
    }
    inst.instanceMatrix.needsUpdate = true;
    if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
    meshletGrp.add(inst);
    group.add(meshletGrp);
    this.meshletGroup = meshletGrp;
    this.metrics.instanceCount = count;
  }

  /* === SCENE 42: Spectral Dispersion Caustic Prism === */
  private buildCausticRaytracePrismScene(group: THREE.Group): void {
    if (!this.camera) return;
    this.camera.position.set(0, 2.4, 8.2);
    this.camera.lookAt(0, 0.7, 0);

    const prismGrp = new THREE.Group();
    const prism = new THREE.Mesh(
      new THREE.CylinderGeometry(1.45, 1.45, 2.8, 3, 1),
      new THREE.MeshPhysicalMaterial({
        color: 0xe0f2fe,
        metalness: 0.05,
        roughness: 0.06,
        transmission: 0.85,
        ior: 2.4,
        thickness: 1.6,
        clearcoat: 1.0,
        clearcoatRoughness: 0.04,
      })
    );
    prism.position.y = 1.0;
    prism.name = 'opticalPrism';
    prismGrp.add(prism);

    const floorDisk = new THREE.Mesh(
      new THREE.CylinderGeometry(5.8, 5.8, 0.14, 64),
      new THREE.MeshStandardMaterial({ color: 0x0b1220, metalness: 0.35, roughness: 0.65 })
    );
    floorDisk.position.y = -0.6;
    prismGrp.add(floorDisk);

    const spectralColors = [0xff2e4c, 0xf97316, 0xfacc15, 0x22c55e, 0x06b6d4, 0x3b82f6, 0xa855f7];
    spectralColors.forEach((hex, idx) => {
      const beam = new THREE.Mesh(
        new THREE.CylinderGeometry(0.055, 0.11, 5.2, 12),
        new THREE.MeshBasicMaterial({ color: hex, transparent: true, opacity: 0.78 })
      );
      beam.rotation.z = -Math.PI / 2 + (idx - 3) * 0.11;
      beam.position.set(2.4, 0.9 + (idx - 3) * 0.16, (idx - 3) * 0.14);
      beam.name = `spectralBeam_${idx}`;
      prismGrp.add(beam);
    });

    const count = this.isSoftwareGl ? 700 : Math.min(12000, PRESET_CONFIG[this.preset].instances);
    const photonGeo = new THREE.SphereGeometry(0.045, 8, 6);
    const photonMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const photons = new THREE.InstancedMesh(photonGeo, photonMat, count);
    photons.name = 'causticPhotons';
    for (let i = 0; i < count; i++) {
      const band = i % spectralColors.length;
      const a = (i / count) * Math.PI * 16 + band * 0.4;
      const r = 1.4 + ((i * 13) % 42) * 0.1;
      _dummyObj.position.set(Math.cos(a) * r, -0.42 + (i % 5) * 0.06, Math.sin(a) * r);
      _dummyObj.scale.setScalar(0.6 + (i % 3) * 0.3);
      _dummyObj.updateMatrix();
      photons.setMatrixAt(i, _dummyObj.matrix);
      _colorScratch.setHex(spectralColors[band]);
      photons.setColorAt(i, _colorScratch);
    }
    photons.instanceMatrix.needsUpdate = true;
    if (photons.instanceColor) photons.instanceColor.needsUpdate = true;
    prismGrp.add(photons);

    group.add(prismGrp);
    this.causticPrismGroup = prismGrp;
    this.metrics.instanceCount = count;
  }

  /* === SCENE 43: Temporal AA & Anisotropic Subpixel Moiré Stress === */
  private buildTemporalAaCheckerScene(group: THREE.Group): void {
    if (!this.renderer || !this.camera) return;
    this.camera.position.set(0, 2.4, 8.0);
    this.camera.lookAt(0, 0.7, 0);

    const checkerCanvas = document.createElement('canvas');
    checkerCanvas.width = 512;
    checkerCanvas.height = 512;
    const ctx = checkerCanvas.getContext('2d')!;
    const cell = 16;
    for (let y = 0; y < 512; y += cell) {
      for (let x = 0; x < 512; x += cell) {
        const even = ((x / cell) + (y / cell)) % 2 === 0;
        ctx.fillStyle = even ? '#f8fafc' : '#090d16';
        ctx.fillRect(x, y, cell, cell);
      }
    }
    ctx.strokeStyle = '#06b6d4';
    ctx.lineWidth = 2;
    for (let i = 0; i < 512; i += 64) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, 512);
      ctx.moveTo(0, i);
      ctx.lineTo(512, i);
      ctx.stroke();
    }
    const tex = new THREE.CanvasTexture(checkerCanvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(14, 14);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = Math.min(16, this.renderer.capabilities.getMaxAnisotropy() || 4);

    const grp = new THREE.Group();
    const plane = new THREE.Mesh(
      new THREE.PlaneGeometry(24, 24, 16, 16),
      new THREE.MeshStandardMaterial({ map: tex, roughness: 0.35, metalness: 0.4 })
    );
    plane.rotation.x = -Math.PI / 2;
    plane.position.y = -0.6;
    grp.add(plane);

    const sphereRing = new THREE.Group();
    sphereRing.name = 'checkerTotems';
    const count = 18;
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2;
      const tot = new THREE.Mesh(
        i % 2 === 0 ? new THREE.TorusKnotGeometry(0.45, 0.14, 72, 12) : new THREE.OctahedronGeometry(0.55, 2),
        new THREE.MeshStandardMaterial({
          map: tex,
          metalness: 0.82,
          roughness: 0.18,
          emissive: i % 3 === 0 ? 0x06b6d4 : 0x8b5cf6,
          emissiveIntensity: 0.16,
        })
      );
      tot.position.set(Math.cos(a) * 3.6, 0.8 + Math.sin(a * 2) * 0.4, Math.sin(a) * 3.6);
      sphereRing.add(tot);
    }
    grp.add(sphereRing);

    group.add(grp);
    this.temporalCheckerGroup = grp;
    this.metrics.instanceCount = count;
  }

  /* === SCENE 44: Smoothed Particle Hydrodynamics (SPH) 3D Fluid === */
  private buildSphFluidComputeScene(group: THREE.Group): void {
    if (!this.camera) return;
    this.camera.position.set(0, 3.0, 9.2);
    this.camera.lookAt(0, 0.8, 0);

    const tank = new THREE.Mesh(
      new THREE.BoxGeometry(6.4, 3.6, 6.4),
      new THREE.MeshPhysicalMaterial({
        color: 0x38bdf8,
        wireframe: true,
        transparent: true,
        opacity: 0.28,
      })
    );
    tank.position.y = 0.8;
    group.add(tank);

    const count = this.isSoftwareGl ? 900 : Math.min(18000, PRESET_CONFIG[this.preset].instances);
    const geo = new THREE.SphereGeometry(0.075, 10, 8);
    const mat = new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      roughness: 0.12,
      metalness: 0.15,
      clearcoat: 1.0,
      clearcoatRoughness: 0.08,
    });
    const mesh = new THREE.InstancedMesh(geo, mat, count);
    const data = new Float32Array(count * 6); // x,y,z, vx,vy,vz
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 18;
      const r = 0.35 + ((i * 19) % 240) * 0.01;
      const x = Math.cos(a) * r;
      const y = -0.6 + ((i % 24) / 24) * 2.5;
      const z = Math.sin(a) * r;
      data[i * 6] = x;
      data[i * 6 + 1] = y;
      data[i * 6 + 2] = z;
      data[i * 6 + 3] = -Math.sin(a) * 1.4;
      data[i * 6 + 4] = 0.4 + (i % 5) * 0.25;
      data[i * 6 + 5] = Math.cos(a) * 1.4;
      _dummyObj.position.set(x, y, z);
      _dummyObj.scale.setScalar(1);
      _dummyObj.updateMatrix();
      mesh.setMatrixAt(i, _dummyObj.matrix);
      _colorScratch.setHSL(0.52 + (i % 24) * 0.005, 0.9, 0.56);
      mesh.setColorAt(i, _colorScratch);
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    group.add(mesh);
    this.sphFluidMesh = mesh;
    this.sphFluidData = data;
    this.metrics.instanceCount = count;
  }

  /* === SCENE 45: Ray-Traced Mirror Reflections Hall & Chrome Clearcoat Sculptures === */
  private buildRtReflectionsHallScene(group: THREE.Group): void {
    if (!this.camera) return;
    this.camera.position.set(0, 3.2, 10.5);
    this.camera.lookAt(0, 1.4, 0);

    const hall = new THREE.Group();

    // Glossy obsidian mirror floor with subtle golden grid veins
    const floorCanvas = document.createElement('canvas');
    floorCanvas.width = 512;
    floorCanvas.height = 512;
    const fctx = floorCanvas.getContext('2d')!;
    fctx.fillStyle = '#060912';
    fctx.fillRect(0, 0, 512, 512);
    fctx.strokeStyle = 'rgba(56, 189, 248, 0.25)';
    fctx.lineWidth = 2;
    for (let i = 0; i <= 512; i += 64) {
      fctx.beginPath();
      fctx.moveTo(i, 0);
      fctx.lineTo(i, 512);
      fctx.stroke();
      fctx.beginPath();
      fctx.moveTo(0, i);
      fctx.lineTo(512, i);
      fctx.stroke();
    }
    const floorTex = new THREE.CanvasTexture(floorCanvas);
    floorTex.wrapS = floorTex.wrapT = THREE.RepeatWrapping;
    floorTex.repeat.set(6, 6);
    floorTex.colorSpace = THREE.SRGBColorSpace;

    const mirrorFloor = new THREE.Mesh(
      new THREE.CircleGeometry(14, 64),
      new THREE.MeshPhysicalMaterial({
        map: floorTex,
        color: 0x0f172a,
        metalness: 0.94,
        roughness: 0.06,
        clearcoat: 1.0,
        clearcoatRoughness: 0.04,
      })
    );
    mirrorFloor.rotation.x = -Math.PI / 2;
    hall.add(mirrorFloor);

    // Sculpted chrome & gold hero centerpiece + mirrored upside-down reflection underneath
    const sculpture = new THREE.Group();
    sculpture.name = 'rtCenterpiece';
    const chromeMat = new THREE.MeshPhysicalMaterial({
      color: 0xf8fafc,
      metalness: 1.0,
      roughness: 0.04,
      clearcoat: 1.0,
    });
    const goldMat = new THREE.MeshPhysicalMaterial({
      color: 0xfbbf24,
      metalness: 1.0,
      roughness: 0.08,
      clearcoat: 1.0,
    });
    const cobaltMat = new THREE.MeshPhysicalMaterial({
      color: 0x0ea5e9,
      metalness: 0.92,
      roughness: 0.06,
      clearcoat: 1.0,
      emissive: 0x0284c7,
      emissiveIntensity: 0.35,
    });

    const knot = new THREE.Mesh(new THREE.TorusKnotGeometry(1.35, 0.34, 180, 28), chromeMat);
    knot.position.y = 2.4;
    const outerRing = new THREE.Mesh(new THREE.TorusGeometry(2.55, 0.08, 16, 84), goldMat);
    outerRing.position.y = 2.4;
    const innerCore = new THREE.Mesh(new THREE.IcosahedronGeometry(0.68, 2), cobaltMat);
    innerCore.position.y = 2.4;
    sculpture.add(knot, outerRing, innerCore);
    hall.add(sculpture);

    // Fake planar reflection mirror clone below glass floor for crisp raytraced illusion
    const reflection = sculpture.clone();
    reflection.name = 'rtReflection';
    reflection.scale.y = -1;
    reflection.position.y = -0.04;
    reflection.traverse((ch) => {
      if ((ch as THREE.Mesh).isMesh) {
        const m = ((ch as THREE.Mesh).material as THREE.MeshPhysicalMaterial).clone();
        m.transparent = true;
        m.opacity = 0.34;
        (ch as THREE.Mesh).material = m;
      }
    });
    hall.add(reflection);

    // 8 Illuminated Cathedral Mirror Columns + Neon Halo Arches
    const pillarMat = new THREE.MeshPhysicalMaterial({
      color: 0x1e293b,
      metalness: 0.95,
      roughness: 0.12,
      clearcoat: 0.9,
    });
    const archGeo = new THREE.TorusGeometry(6.8, 0.06, 10, 64, Math.PI);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const col = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.42, 6.2, 16), pillarMat);
      col.position.set(Math.cos(a) * 6.8, 3.1, Math.sin(a) * 6.8);
      const strip = new THREE.Mesh(
        new THREE.BoxGeometry(0.08, 5.8, 0.08),
        new THREE.MeshBasicMaterial({ color: i % 2 === 0 ? 0x38bdf8 : 0xf43f5e })
      );
      strip.position.set(Math.cos(a) * 6.38, 3.1, Math.sin(a) * 6.38);
      hall.add(col, strip);
      if (i < 4) {
        const arch = new THREE.Mesh(
          archGeo,
          new THREE.MeshBasicMaterial({ color: i % 2 === 0 ? 0x06b6d4 : 0xfbbf24 })
        );
        arch.rotation.y = (i / 4) * Math.PI;
        arch.position.y = 0.05;
        hall.add(arch);
      }
    }

    // Orbiting Chrome Mirror Spheres
    const count = Math.min(450, Math.max(96, Math.round(PRESET_CONFIG[this.preset].instances * 0.08)));
    const orbMesh = new THREE.InstancedMesh(new THREE.SphereGeometry(0.22, 16, 16), chromeMat, count);
    orbMesh.name = 'rtMirrorOrbs';
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 10;
      const rad = 3.2 + (i % 6) * 0.85;
      _dummyObj.position.set(Math.cos(a) * rad, 0.8 + ((i * 7) % 10) * 0.45, Math.sin(a) * rad);
      _dummyObj.scale.setScalar(0.65 + (i % 4) * 0.25);
      _dummyObj.updateMatrix();
      orbMesh.setMatrixAt(i, _dummyObj.matrix);
    }
    orbMesh.instanceMatrix.needsUpdate = true;
    hall.add(orbMesh);

    const pLightA = new THREE.PointLight(0x38bdf8, 32, 22);
    pLightA.position.set(4.5, 4.2, 4.5);
    const pLightB = new THREE.PointLight(0xf43f5e, 28, 22);
    pLightB.position.set(-4.5, 3.8, -4.5);
    hall.add(pLightA, pLightB);

    group.add(hall);
    this.rtHallGroup = hall;
    this.metrics.instanceCount = count;
  }

  /* === SCENE 46: 4K Volumetric Cumulonimbus Storm Clouds + 3D Mountain Peaks + 3D Lightning Bolts === */
  private buildVolumetricClouds4kScene(group: THREE.Group): void {
    if (!this.renderer || !this.camera) return;
    this.camera.position.set(0, 3.6, 11.2);
    this.camera.lookAt(0, 1.6, 0);

    const size = new THREE.Vector2();
    this.renderer.getDrawingBufferSize(size);
    if (size.x < 320 || size.y < 200) size.set(1280, 720);
    const steps =
      this.preset === 'ultra' ? 48 : this.preset === 'extreme' ? 38 : this.preset === 'high' ? 28 : 20;
    this.baseVolumetricCloudSteps = steps;

    // 1. High-Contrast 4K Volumetric Raymarched Storm Sky Dome with Golden Anvil Rim & Internal Lightning
    const skyMat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uResolution: { value: size },
        uSteps: { value: steps },
      },
      vertexShader: `
        varying vec3 vWorldDir;
        void main() {
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vWorldDir = normalize(wp.xyz);
          gl_Position = projectionMatrix * viewMatrix * wp;
        }
      `,
      fragmentShader: `
        precision highp float;
        uniform float uTime;
        uniform vec2 uResolution;
        uniform int uSteps;
        varying vec3 vWorldDir;

        float hash31(vec3 p) {
          p = fract(p * 0.1031);
          p += dot(p, p.yzx + 33.33);
          return fract((p.x + p.y) * p.z);
        }

        float noise3(vec3 p) {
          vec3 i = floor(p);
          vec3 f = fract(p);
          f = f * f * (3.0 - 2.0 * f);
          return mix(
            mix(mix(hash31(i), hash31(i + vec3(1,0,0)), f.x), mix(hash31(i + vec3(0,1,0)), hash31(i + vec3(1,1,0)), f.x), f.y),
            mix(mix(hash31(i + vec3(0,0,1)), hash31(i + vec3(1,0,1)), f.x), mix(hash31(i + vec3(0,1,1)), hash31(i + vec3(1,1,1)), f.x), f.y),
            f.z
          );
        }

        float fbm(vec3 p) {
          float v = 0.0;
          float a = 0.55;
          for (int i = 0; i < 5; i++) {
            v += a * noise3(p);
            p = p * 2.06 + vec3(0.31, -0.19, 0.23);
            a *= 0.48;
          }
          return v;
        }

        void main() {
          vec3 rd = normalize(vWorldDir);
          vec3 sunDir = normalize(vec3(0.52, 0.32, -0.79));
          float sunDot = max(dot(rd, sunDir), 0.0);

          // Deep cobalt-indigo storm zenith to fiery golden-amber horizon
          vec3 zenithCol = vec3(0.02, 0.06, 0.16);
          vec3 horizonCol = vec3(0.16, 0.28, 0.46);
          vec3 skyCol = mix(horizonCol, zenithCol, clamp(rd.y * 1.4 + 0.2, 0.0, 1.0));
          skyCol += vec3(1.0, 0.58, 0.22) * pow(sunDot, 5.0) * 0.85;
          skyCol += vec3(1.0, 0.94, 0.80) * pow(sunDot, 48.0) * 2.2;

          // Raymarched cumulonimbus anvil bands across the sky dome
          vec3 p = rd * 6.5 + vec3(uTime * 0.18, 0.0, -uTime * 0.24);
          float n1 = fbm(p);
          float n2 = fbm(p * 2.1 - vec3(0.0, uTime * 0.15, 0.0));
          float billow = smoothstep(0.36, 0.76, n1 * 0.72 + n2 * 0.38);

          // Lightning flash wave inside thunderheads
          float flash = pow(max(0.0, sin(uTime * 3.7) * sin(uTime * 8.3)), 6.0) * 2.8;
          vec3 cloudDark = vec3(0.05, 0.09, 0.18);
          vec3 cloudLit = vec3(1.0, 0.74, 0.42);
          vec3 cloudLightning = vec3(0.45, 0.88, 1.0) * flash * smoothstep(0.45, 0.78, n2);

          float rim = pow(clamp(1.0 - n1, 0.0, 1.0), 2.0) * (0.35 + 0.65 * pow(sunDot, 2.0));
          vec3 cloudCol = mix(cloudDark, cloudLit, clamp(rim * 1.65, 0.0, 1.0)) + cloudLightning;

          float horizonMask = smoothstep(-0.25, 0.15, rd.y);
          vec3 col = mix(skyCol, cloudCol, billow * 0.88 * horizonMask);
          gl_FragColor = vec4(col, 1.0);
        }
      `,
      side: THREE.BackSide,
      depthWrite: false,
    });
    const skyDome = new THREE.Mesh(new THREE.SphereGeometry(42, 40, 28), skyMat);
    skyDome.frustumCulled = false;
    group.add(skyDome);
    this.volumetricCloudMat = skyMat;

    const stormRoot = new THREE.Group();

    // 2. Sculpted 3D Storm Mountain Range & Weather Radar Observatory below the clouds (~16,384 triangles)
    const terrainSegs = this.isSoftwareGl ? 48 : this.preset === 'ultra' ? 112 : 84;
    const terrainGeo = new THREE.PlaneGeometry(32, 32, terrainSegs, terrainSegs);
    terrainGeo.rotateX(-Math.PI / 2);
    const tPos = terrainGeo.attributes.position as THREE.BufferAttribute;
    const tCol = new Float32Array(tPos.count * 3);
    for (let i = 0; i < tPos.count; i++) {
      const x = tPos.getX(i);
      const z = tPos.getZ(i);
      const d = Math.hypot(x, z);
      const ridge =
        Math.abs(Math.sin(x * 0.45) * Math.cos(z * 0.42)) * 2.6 +
        Math.sin(x * 1.1 + z * 0.9) * 0.55 +
        Math.cos(d * 0.65) * 0.75;
      const valleyMask = Math.max(0, Math.min(1, (d - 1.5) / 8.0));
      const h = -2.6 + ridge * (0.35 + 0.85 * valleyMask);
      tPos.setY(i, h);

      if (h > -0.25) {
        // Snow-dusted electric-lit alpine peak
        tCol[i * 3] = 0.78;
        tCol[i * 3 + 1] = 0.88;
        tCol[i * 3 + 2] = 0.98;
      } else if (h > -1.35) {
        // Wet slate basalt cliff
        tCol[i * 3] = 0.18;
        tCol[i * 3 + 1] = 0.25;
        tCol[i * 3 + 2] = 0.36;
      } else {
        // Dark storm valley
        tCol[i * 3] = 0.06;
        tCol[i * 3 + 1] = 0.1;
        tCol[i * 3 + 2] = 0.18;
      }
    }
    terrainGeo.setAttribute('color', new THREE.BufferAttribute(tCol, 3));
    terrainGeo.computeVertexNormals();
    const terrainMesh = new THREE.Mesh(
      terrainGeo,
      new THREE.MeshStandardMaterial({
        vertexColors: true,
        roughness: 0.48,
        metalness: 0.35,
      })
    );
    stormRoot.add(terrainMesh);

    // 3. Multi-layered 3D Volumetric Cumulonimbus Storm Cloud Clusters (~22,000+ triangles)
    const cloudCount = this.isSoftwareGl ? 180 : this.preset === 'ultra' ? 780 : this.preset === 'extreme' ? 560 : 380;
    const cloudGeo = new THREE.IcosahedronGeometry(0.95, 2);
    const cloudMat = new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      roughness: 0.55,
      metalness: 0.08,
      clearcoat: 0.4,
      transmission: 0.15,
      transparent: true,
      opacity: 0.92,
    });
    const cloudInst = new THREE.InstancedMesh(cloudGeo, cloudMat, cloudCount);
    cloudInst.name = 'stormClouds3D';
    const palette = [0xe2e8f0, 0x94a3b8, 0x64748b, 0x38bdf8, 0xf59e0b, 0x475569];
    for (let i = 0; i < cloudCount; i++) {
      const cluster = i % 7;
      const cAngle = (cluster / 7) * Math.PI * 2;
      const cx = Math.cos(cAngle) * (3.2 + (cluster % 3) * 1.8);
      const cz = Math.sin(cAngle) * (3.2 + (cluster % 3) * 1.8);
      const spreadX = (Math.random() - 0.5) * 4.4;
      const spreadZ = (Math.random() - 0.5) * 4.4;
      const y = 1.15 + (i % 5) * 0.52 + (Math.random() - 0.5) * 0.45;
      _dummyObj.position.set(cx + spreadX, y, cz + spreadZ);
      _dummyObj.rotation.set(Math.random() * 3, Math.random() * 3, 0);
      _dummyObj.scale.set(
        0.75 + Math.random() * 1.15,
        0.48 + Math.random() * 0.55,
        0.75 + Math.random() * 1.15
      );
      _dummyObj.updateMatrix();
      cloudInst.setMatrixAt(i, _dummyObj.matrix);
      _colorScratch.setHex(palette[i % palette.length]);
      cloudInst.setColorAt(i, _colorScratch);
    }
    cloudInst.instanceMatrix.needsUpdate = true;
    if (cloudInst.instanceColor) cloudInst.instanceColor.needsUpdate = true;
    stormRoot.add(cloudInst);

    // 4. 3D Branching Plasma Lightning Bolts flashing between clouds and mountain peaks
    const boltsGroup = new THREE.Group();
    boltsGroup.name = 'stormLightningBolts';
    const boltMat = new THREE.MeshBasicMaterial({
      color: 0x7dd3fc,
      transparent: true,
      opacity: 0.95,
    });
    for (let b = 0; b < 8; b++) {
      const bAngle = (b / 8) * Math.PI * 2;
      const bx = Math.cos(bAngle) * (2.6 + (b % 3) * 1.4);
      const bz = Math.sin(bAngle) * (2.6 + (b % 3) * 1.4);
      const singleBolt = new THREE.Group();
      singleBolt.position.set(bx, 0, bz);
      let curX = 0;
      let curY = 2.6;
      let curZ = 0;
      for (let seg = 0; seg < 6; seg++) {
        const nextX = curX + (Math.random() - 0.5) * 0.65;
        const nextY = curY - 0.72;
        const nextZ = curZ + (Math.random() - 0.5) * 0.65;
        const segLen = Math.hypot(nextX - curX, nextY - curY, nextZ - curZ);
        const cyl = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.035, segLen, 6), boltMat);
        cyl.position.set((curX + nextX) * 0.5, (curY + nextY) * 0.5, (curZ + nextZ) * 0.5);
        cyl.lookAt(bx + nextX, nextY, bz + nextZ);
        cyl.rotateX(Math.PI / 2);
        singleBolt.add(cyl);
        curX = nextX;
        curY = nextY;
        curZ = nextZ;
      }
      boltsGroup.add(singleBolt);
    }
    stormRoot.add(boltsGroup);

    // 5. Instanced Storm Rain & Hail Shafts (1,200 streaks)
    const rainCount = this.isSoftwareGl ? 300 : 1200;
    const rainGeo = new THREE.BoxGeometry(0.022, 0.65, 0.022);
    const rainMat = new THREE.MeshBasicMaterial({
      color: 0xbae6fd,
      transparent: true,
      opacity: 0.52,
    });
    const rainMesh = new THREE.InstancedMesh(rainGeo, rainMat, rainCount);
    rainMesh.name = 'stormRainShafts';
    for (let i = 0; i < rainCount; i++) {
      _dummyObj.position.set(
        (Math.random() - 0.5) * 18,
        -2.0 + Math.random() * 5.2,
        (Math.random() - 0.5) * 18
      );
      _dummyObj.rotation.set(0, 0, 0.14);
      _dummyObj.scale.setScalar(1);
      _dummyObj.updateMatrix();
      rainMesh.setMatrixAt(i, _dummyObj.matrix);
    }
    rainMesh.instanceMatrix.needsUpdate = true;
    stormRoot.add(rainMesh);

    // Dynamic storm lightning PointLights
    const flashLight = new THREE.PointLight(0x38bdf8, 8.5, 28);
    flashLight.position.set(0, 2.2, 0);
    flashLight.name = 'stormFlashLight';
    stormRoot.add(flashLight);

    const sunRimLight = new THREE.DirectionalLight(0xffa726, 3.2);
    sunRimLight.position.set(12, 8, -14);
    stormRoot.add(sunRimLight);

    group.add(stormRoot);
    this.stormCloudGroup = stormRoot;
    this.metrics.instanceCount = cloudCount + rainCount + steps * 128;
  }

  /* === SCENE 47: Cyber Rain Neon Metropolis & Wet Reflective Street === */
  private buildCyberRainNeonScene(group: THREE.Group): void {
    if (!this.camera) return;
    this.camera.position.set(0, 3.0, 11.5);
    this.camera.lookAt(0, 2.2, -4);

    const city = new THREE.Group();

    // Wet neon-reflective avenue
    const roadMat = new THREE.MeshPhysicalMaterial({
      color: 0x070a14,
      metalness: 0.85,
      roughness: 0.09,
      clearcoat: 1.0,
      clearcoatRoughness: 0.05,
    });
    const road = new THREE.Mesh(new THREE.PlaneGeometry(24, 34), roadMat);
    road.rotation.x = -Math.PI / 2;
    city.add(road);

    // Center neon lane strips
    const laneMat = new THREE.MeshBasicMaterial({ color: 0x06b6d4 });
    const laneL = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.03, 30), laneMat);
    laneL.position.set(-2.4, 0.02, -2);
    const laneR = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.03, 30), new THREE.MeshBasicMaterial({ color: 0xec4899 }));
    laneR.position.set(2.4, 0.02, -2);
    city.add(laneL, laneR);

    // Flanking Cyberpunk Neon Towers + Glowing Holosigns
    const bMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.8, roughness: 0.28 });
    const signColors = [0x06b6d4, 0xec4899, 0xa855f7, 0xfacc15];
    for (let i = 0; i < 16; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      const row = Math.floor(i / 2);
      const h = 5.5 + (row % 4) * 2.4;
      const bld = new THREE.Mesh(new THREE.BoxGeometry(2.8, h, 2.8), bMat);
      bld.position.set(side * (5.6 + (row % 2) * 1.4), h / 2, 8 - row * 3.4);
      const neonSign = new THREE.Mesh(
        new THREE.BoxGeometry(0.15, 1.8, 1.6),
        new THREE.MeshBasicMaterial({ color: signColors[i % signColors.length] })
      );
      neonSign.position.set(side * 4.1, 2.6 + (i % 3) * 1.2, 8 - row * 3.4);
      city.add(bld, neonSign);
    }

    // High-density Instanced Rain Streaks
    const rainCount = Math.min(8000, Math.max(1200, Math.round(PRESET_CONFIG[this.preset].instances * 0.45)));
    const rainGeo = new THREE.BoxGeometry(0.022, 0.65, 0.022);
    const rainMat = new THREE.MeshBasicMaterial({
      color: 0xbae6fd,
      transparent: true,
      opacity: 0.62,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const rainMesh = new THREE.InstancedMesh(rainGeo, rainMat, rainCount);
    const rainData = new Float32Array(rainCount * 4);
    for (let i = 0; i < rainCount; i++) {
      const x = (Math.random() - 0.5) * 18;
      const y = Math.random() * 14;
      const z = (Math.random() - 0.5) * 24;
      const spd = 14 + Math.random() * 12;
      rainData[i * 4] = x;
      rainData[i * 4 + 1] = y;
      rainData[i * 4 + 2] = z;
      rainData[i * 4 + 3] = spd;
      _dummyObj.position.set(x, y, z);
      _dummyObj.scale.setScalar(1);
      _dummyObj.updateMatrix();
      rainMesh.setMatrixAt(i, _dummyObj.matrix);
    }
    rainMesh.instanceMatrix.needsUpdate = true;
    city.add(rainMesh);

    const pA = new THREE.PointLight(0x06b6d4, 42, 24);
    pA.position.set(-4, 4.5, 2);
    const pB = new THREE.PointLight(0xec4899, 42, 24);
    pB.position.set(4, 4.5, -4);
    city.add(pA, pB);

    group.add(city);
    this.cyberRainGroup = city;
    this.cyberRainMesh = rainMesh;
    this.cyberRainData = rainData;
    this.metrics.instanceCount = rainCount;
  }

  /* === SCENE 48: Magma Caldera Shader + Ballistic Pyroclastic Volcanic Eruption === */
  private buildMagmaCalderaSimScene(group: THREE.Group): void {
    if (!this.camera) return;
    this.camera.position.set(0, 4.8, 11.2);
    this.camera.lookAt(0, 1.2, 0);

    const caldera = new THREE.Group();

    // Animated Domain-Warped GLSL Molten Magma Lake
    const magmaMat = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 } },
      vertexShader: `
        uniform float uTime;
        varying vec2 vUv;
        varying float vWave;
        void main() {
          vUv = uv;
          vec3 p = position;
          float w = sin(p.x * 1.1 + uTime * 1.6) * cos(p.y * 1.1 - uTime * 1.2) * 0.24;
          p.z += w;
          vWave = w;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
        }
      `,
      fragmentShader: `
        precision highp float;
        uniform float uTime;
        varying vec2 vUv;
        varying float vWave;
        float hash21(vec2 p) {
          p = fract(p * vec2(123.34, 456.21));
          p += dot(p, p + 45.32);
          return fract(p.x * p.y);
        }
        float noise(vec2 p) {
          vec2 i = floor(p);
          vec2 f = fract(p);
          f = f * f * (3.0 - 2.0 * f);
          return mix(
            mix(hash21(i), hash21(i + vec2(1.0, 0.0)), f.x),
            mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0, 1.0)), f.x),
            f.y
          );
        }
        float fbm(vec2 p) {
          float v = 0.0;
          float a = 0.5;
          for (int i = 0; i < 4; i++) {
            v += a * noise(p);
            p = mat2(1.6, 1.2, -1.2, 1.6) * p;
            a *= 0.5;
          }
          return v;
        }
        void main() {
          vec2 centered = (vUv - 0.5) * 2.0;
          float r = length(centered);
          vec2 uv = centered * 3.4;
          float warp = fbm(uv + vec2(uTime * 0.22, -uTime * 0.18));
          float flow = fbm(uv * 1.8 + vec2(warp * 2.1, -warp * 1.7));
          float heat = smoothstep(0.32, 0.72, flow + (1.0 - r) * 0.35 + vWave * 0.4);
          vec3 crust = vec3(0.08, 0.05, 0.05);
          vec3 lavaRed = vec3(1.0, 0.22, 0.02);
          vec3 lavaGold = vec3(1.0, 0.88, 0.34);
          vec3 col = mix(crust, lavaRed * 1.4, heat);
          col = mix(col, lavaGold * 2.1, smoothstep(0.65, 0.92, heat));
          gl_FragColor = vec4(col, 1.0);
        }
      `,
    });
    const magmaLake = new THREE.Mesh(new THREE.CircleGeometry(6.4, 64), magmaMat);
    magmaLake.rotation.x = -Math.PI / 2;
    caldera.add(magmaLake);

    // Sculpted Basalt Crater Rim Rocks
    const rockMat = new THREE.MeshStandardMaterial({
      color: 0x1c1412,
      emissive: 0x7c2d12,
      emissiveIntensity: 0.28,
      roughness: 0.92,
      metalness: 0.12,
    });
    const rockGeo = new THREE.DodecahedronGeometry(1.5, 1);
    for (let i = 0; i < 20; i++) {
      const a = (i / 20) * Math.PI * 2;
      const rock = new THREE.Mesh(rockGeo, rockMat);
      rock.position.set(Math.cos(a) * 7.2, 0.8 + (i % 3) * 0.45, Math.sin(a) * 7.2);
      rock.scale.set(1.5 + (i % 3) * 0.4, 1.4 + (i % 4) * 0.5, 1.4);
      rock.rotation.set(i * 0.5, a, i * 0.3);
      caldera.add(rock);
    }

    // Ballistic Erupting Glowing Lava Bombs & Pyroclastic Embers
    const bombCount = Math.min(4500, Math.max(800, Math.round(PRESET_CONFIG[this.preset].instances * 0.35)));
    const bombGeo = new THREE.OctahedronGeometry(0.14, 0);
    const bombMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const bombMesh = new THREE.InstancedMesh(bombGeo, bombMat, bombCount);
    const bombData = new Float32Array(bombCount * 6);
    for (let i = 0; i < bombCount; i++) {
      const a = Math.random() * Math.PI * 2;
      const spread = 0.6 + Math.random() * 2.8;
      bombData[i * 6] = Math.cos(a) * (Math.random() * 1.4);
      bombData[i * 6 + 1] = Math.random() * 5.2;
      bombData[i * 6 + 2] = Math.sin(a) * (Math.random() * 1.4);
      bombData[i * 6 + 3] = Math.cos(a) * spread;
      bombData[i * 6 + 4] = 4.2 + Math.random() * 5.5;
      bombData[i * 6 + 5] = Math.sin(a) * spread;
      _colorScratch.setHex(i % 3 === 0 ? 0xfef08a : i % 3 === 1 ? 0xf97316 : 0xef4444);
      bombMesh.setColorAt(i, _colorScratch);
    }
    if (bombMesh.instanceColor) bombMesh.instanceColor.needsUpdate = true;
    caldera.add(bombMesh);

    const lavaGlow = new THREE.PointLight(0xff5511, 58, 28);
    lavaGlow.position.set(0, 2.2, 0);
    caldera.add(lavaGlow);

    group.add(caldera);
    this.magmaCalderaGroup = caldera;
    this.magmaCalderaMat = magmaMat;
    this.magmaBombsMesh = bombMesh;
    this.magmaBombsData = bombData;
    this.metrics.instanceCount = bombCount;
  }

  private buildGpuCoreRig(maxAniso: number): THREE.Group {
    const group = new THREE.Group();

    const shadowMat = new THREE.MeshBasicMaterial({
      map: createContactShadowTexture(),
      transparent: true,
      depthWrite: false,
      opacity: 0.72,
    });
    const shadowPlane = new THREE.Mesh(new THREE.PlaneGeometry(6.2, 4.2), shadowMat);
    shadowPlane.rotation.x = -Math.PI / 2;
    shadowPlane.position.y = 0.005;
    group.add(shadowPlane);

    const baseShape = new THREE.Shape();
    const bw = 2.4;
    const bd = 1.35;
    const br = 0.16;
    baseShape.moveTo(-bw + br, -bd);
    baseShape.lineTo(bw - br, -bd);
    baseShape.quadraticCurveTo(bw, -bd, bw, -bd + br);
    baseShape.lineTo(bw, bd - br);
    baseShape.quadraticCurveTo(bw, bd, bw - br, bd);
    baseShape.lineTo(-bw + br, bd);
    baseShape.quadraticCurveTo(-bw, bd, -bw, bd - br);
    baseShape.lineTo(-bw, -bd + br);
    baseShape.quadraticCurveTo(-bw, -bd, -bw + br, -bd);

    const chassisGeo = new THREE.ExtrudeGeometry(baseShape, {
      depth: 0.22,
      bevelEnabled: true,
      bevelThickness: 0.04,
      bevelSize: 0.04,
      bevelSegments: 3,
    });
    chassisGeo.rotateX(-Math.PI / 2);
    const carbonTex = createCarbonFiberTextures(maxAniso);
    const chassisMat = new THREE.MeshPhysicalMaterial({
      color: 0xd8e4f4,
      map: carbonTex.map,
      bumpMap: carbonTex.bumpMap,
      bumpScale: 0.022,
      roughnessMap: carbonTex.roughnessMap,
      metalness: 0.82,
      roughness: 0.28,
      anisotropy: 0.8,
      clearcoat: 0.85,
      clearcoatRoughness: 0.14,
    });
    const chassis = new THREE.Mesh(chassisGeo, chassisMat);
    chassis.position.y = 0.04;
    chassis.castShadow = !this.isSoftwareGl;
    chassis.receiveShadow = !this.isSoftwareGl;
    group.add(chassis);

    const pcbMat = new THREE.MeshStandardMaterial({
      map: createPcbTexture(maxAniso),
      metalness: 0.24,
      roughness: 0.62,
    });
    const pcb = new THREE.Mesh(new THREE.BoxGeometry(4.4, 0.07, 2.3), pcbMat);
    pcb.position.y = 0.33;
    pcb.receiveShadow = !this.isSoftwareGl;
    group.add(pcb);

    const interposer = new THREE.Mesh(
      new THREE.BoxGeometry(1.18, 0.08, 1.18),
      new THREE.MeshStandardMaterial({ color: 0x111827, metalness: 0.42, roughness: 0.48 })
    );
    interposer.position.y = 0.4;
    group.add(interposer);

    this.dieMaterial = new THREE.MeshPhysicalMaterial({
      map: createDieTexture(maxAniso),
      emissive: new THREE.Color(0x06b6d4),
      emissiveIntensity: 0.85,
      metalness: 0.9,
      roughness: 0.12,
      clearcoat: 1.0,
      clearcoatRoughness: 0.06,
      iridescence: 0.45,
      iridescenceIOR: 1.4,
    });
    const gpuDie = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.11, 0.78), this.dieMaterial);
    gpuDie.position.y = 0.48;
    group.add(gpuDie);

    const copperMat = new THREE.MeshPhysicalMaterial({
      color: 0xe2813d,
      metalness: 0.96,
      roughness: 0.16,
      clearcoat: 0.45,
      clearcoatRoughness: 0.12,
    });
    for (const zOff of [-0.62, -0.22, 0.22, 0.62]) {
      const curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(-1.95, 0.58, zOff * 1.15),
        new THREE.Vector3(-0.75, 0.54, zOff * 0.55),
        new THREE.Vector3(0, 0.56, zOff * 0.35),
        new THREE.Vector3(0.75, 0.54, zOff * 0.55),
        new THREE.Vector3(1.95, 0.58, zOff * 1.15),
      ]);
      const pipe = new THREE.Mesh(new THREE.TubeGeometry(curve, 24, 0.045, 10, false), copperMat);
      pipe.castShadow = !this.isSoftwareGl;
      group.add(pipe);
    }

    const finGeo = new THREE.BoxGeometry(0.035, 0.44, 1.92);
    const finMat = new THREE.MeshStandardMaterial({
      color: 0x94a3b8,
      metalness: 0.88,
      roughness: 0.26,
    });
    const finCount = 28;
    const finMesh = new THREE.InstancedMesh(finGeo, finMat, finCount);
    for (let i = 0; i < finCount; i++) {
      const x = -2.02 + (i / (finCount - 1)) * 4.04;
      const scaleY = Math.abs(x) < 0.56 ? 0.001 : 1;
      _dummyObj.position.set(x, 0.64, 0);
      _dummyObj.rotation.set(0, 0, 0);
      _dummyObj.scale.set(1, scaleY, 1);
      _dummyObj.updateMatrix();
      finMesh.setMatrixAt(i, _dummyObj.matrix);
    }
    finMesh.instanceMatrix.needsUpdate = true;
    group.add(finMesh);

    this.fans = [];
    const shroudMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.72, roughness: 0.35 });
    const bladeMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.35, roughness: 0.52 });
    const accentRingMat = new THREE.MeshStandardMaterial({
      color: 0x22d3ee,
      emissive: 0x06b6d4,
      emissiveIntensity: 1.45,
      metalness: 0.5,
      roughness: 0.22,
    });

    for (const fx of [-1.32, 1.32]) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.68, 0.048, 12, 32), shroudMat);
      ring.rotation.x = Math.PI / 2;
      ring.position.set(fx, 0.94, 0);
      group.add(ring);

      const accentRing = new THREE.Mesh(new THREE.TorusGeometry(0.71, 0.015, 8, 32), accentRingMat);
      accentRing.rotation.x = Math.PI / 2;
      accentRing.position.set(fx, 0.98, 0);
      group.add(accentRing);

      const rotor = new THREE.Group();
      rotor.position.set(fx, 0.94, 0);
      rotor.add(new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.18, 0.12, 20), chassisMat));

      const bladeGeo = new THREE.BoxGeometry(0.46, 0.025, 0.14);
      for (let b = 0; b < 9; b++) {
        const angle = (b / 9) * Math.PI * 2;
        const blade = new THREE.Mesh(bladeGeo, bladeMat);
        blade.position.set(Math.cos(angle) * 0.38, 0, Math.sin(angle) * 0.38);
        blade.rotation.y = -angle;
        blade.rotation.x = 0.42;
        rotor.add(blade);
      }
      group.add(rotor);
      this.fans.push(rotor);
    }

    const boltGeo = new THREE.CylinderGeometry(0.055, 0.055, 0.12, 6);
    const boltMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.95, roughness: 0.18 });
    const corners = [
      [-2.15, 0.38, -1.08],
      [2.15, 0.38, -1.08],
      [-2.15, 0.38, 1.08],
      [2.15, 0.38, 1.08],
    ];
    const bolts = new THREE.InstancedMesh(boltGeo, boltMat, corners.length);
    corners.forEach((c, idx) => {
      _dummyObj.position.set(c[0], c[1], c[2]);
      _dummyObj.rotation.set(0, 0, 0);
      _dummyObj.scale.set(1, 1, 1);
      _dummyObj.updateMatrix();
      bolts.setMatrixAt(idx, _dummyObj.matrix);
    });
    bolts.instanceMatrix.needsUpdate = true;
    group.add(bolts);

    // Dual front & rear glowing HDR RGB shroud lightbars + twin 8-pin PCIe power connectors
    const ledBarMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x06b6d4,
      emissiveIntensity: 2.2,
      roughness: 0.15,
      metalness: 0.2,
    });
    for (const zBar of [-1.24, 1.24]) {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(3.85, 0.055, 0.045), ledBarMat);
      bar.position.set(0, 0.82, zBar);
      group.add(bar);
    }
    const pciePlugMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.55, metalness: 0.3 });
    for (const px of [1.55, 1.88]) {
      const plug = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.22, 0.18), pciePlugMat);
      plug.position.set(px, 0.44, 1.22);
      group.add(plug);
    }

    return group;
  }

  private renderSingleFrame(): void {
    if (!this.renderer || !this.scene || !this.camera) return;
    const activeCam: THREE.Camera =
      this.isFullscreenShaderScene() && this.raymarchOrthoCam
        ? this.raymarchOrthoCam
        : this.camera;

    if (this.postFxEnabled && !this.isSoftwareGl && this.composer && this.renderPass) {
      try {
        this.renderPass.camera = activeCam;
        this.composer.render();
        return;
      } catch {
        this.composer?.dispose();
        this.composer = null;
        this.composerRT?.dispose();
        this.composerRT = null;
        this.bloomPass?.dispose();
        this.bloomPass = null;
        this.cinematicPass?.dispose();
        this.cinematicPass = null;
        this.renderPass = null;
      }
    }

    try {
      this.renderer.render(this.scene, activeCam);
    } catch {
      this.stop();
    }
  }

  public setSceneMode(mode: GpuSceneMode): void {
    if (this.sceneMode === mode) return;
    const wasRunning = this.running;
    if (wasRunning) this.stop();
    this.sceneMode = mode;
    this.uncappedBatchSize = 1;
    this.frameTimes = [];
    this.allFpsSamples = [];
    this.windowFrames = 0;
    this.buildActiveScene();
    this.applyRenderScale(true);
    this.renderSingleFrame();
    if (this.renderer) {
      this.metrics.triangles = this.renderer.info.render.triangles;
      this.metrics.drawCalls = this.renderer.info.render.calls;
    }
    this.updateOsdOverlay();
    this.emitMetrics();
    if (wasRunning) this.start();
  }

  public setFpsMode(mode: GpuFpsMode): void {
    if (this.fpsMode === mode) return;
    const wasRunning = this.running;
    if (wasRunning) this.stop();
    this.fpsMode = mode;
    this.metrics.fpsMode = mode;
    this.frameTimes = [];
    this.allFpsSamples = [];
    this.windowFrames = 0;
    this.updateOsdOverlay();
    this.emitMetrics();
    if (wasRunning) this.start();
  }

  public setPreset(preset: GpuLoadPreset): void {
    this.preset = preset;
    this.metrics.preset = preset;
    this.uncappedBatchSize = 1;
    this.frameTimes = [];
    this.allFpsSamples = [];
    this.windowFrames = 0;
    this.lastMetricEmit = performance.now();
    this.buildActiveScene();
    this.applyRenderScale(true);
    if (!this.running && this.renderer) {
      this.renderSingleFrame();
      this.metrics.triangles = this.renderer.info.render.triangles;
      this.metrics.drawCalls = this.renderer.info.render.calls;
    }
    this.updateOsdOverlay();
    this.emitMetrics();
  }

  private cancelScheduledFrame(): void {
    if (this.frameHandle) {
      if (this.frameHandleIsRaf) {
        cancelAnimationFrame(this.frameHandle);
      } else {
        clearTimeout(this.frameHandle);
      }
      this.frameHandle = 0;
      this.frameHandleIsRaf = false;
    }
    if (this.pendingGpuSync && this.renderer) {
      try {
        const gl = this.renderer.getContext() as WebGL2RenderingContext;
        gl.deleteSync?.(this.pendingGpuSync);
      } catch {
        // ignore lost context
      }
      this.pendingGpuSync = null;
    }
  }

  public start(): void {
    if (this.running || !this.renderer) return;
    this.running = true;
    this.startTime = performance.now();
    this.lastFrameTime = this.startTime;
    this.lastMetricEmit = this.startTime;
    this.lastUiYieldTime = this.startTime;
    this.totalFramesRendered = 0;
    this.windowFrames = 0;
    this.uncappedBatchSize = 1;
    this.lastGpuFrameMs = 16;
    this.frameTimes = [];
    this.allFpsSamples = [];
    this.telemetry = [];
    this.estTempC = 46;
    this.peakTempC = 46;
    this.metrics.running = true;
    this.metrics.fpsMode = this.fpsMode;
    this.metrics.verdict = 'STABILNY';
    this.applyRenderScale(true);

    this.updateOsdOverlay();
    this.emitMetrics();
    this.scheduleNextTick(true);
  }

  public stop(): void {
    if (!this.running) return;
    this.running = false;
    this.cancelScheduledFrame();
    this.metrics.running = false;
    this.updateOsdOverlay();
    this.emitMetrics();
  }

  public runTimedBenchmark(durationMs = 5000, onUpdate?: (m: GpuStressMetrics) => void): Promise<GpuStressMetrics> {
    return new Promise((resolve) => {
      const prevCb = this.onMetrics;
      this.onMetrics = (m) => {
        prevCb?.(m);
        onUpdate?.(m);
      };
      this.start();
      window.setTimeout(() => {
        this.stop();
        this.onMetrics = prevCb;
        resolve(this.getMetrics());
      }, durationMs);
    });
  }

  private scheduleNextTick(forceRaf = false): void {
    if (!this.running || !this.renderer) return;
    if (this.isSoftwareGl) {
      this.frameHandleIsRaf = false;
      this.frameHandle = window.setTimeout(() => this.tick(), 36);
      return;
    }
    const now = performance.now();
    const isHeavy = HEAVY_FRAGMENT_SCENES.has(this.sceneMode);
    const isHeavyOrSlow = isHeavy || this.lastGpuFrameMs >= 26 || this.adaptiveThrottleActive;
    if (this.fpsMode === 'uncapped' && !forceRaf && !isHeavyOrSlow && now - this.lastUiYieldTime < 16) {
      this.frameHandleIsRaf = false;
      this.frameHandle = window.setTimeout(() => this.tick(), 0);
    } else {
      this.lastUiYieldTime = now;
      this.frameHandleIsRaf = true;
      this.frameHandle = requestAnimationFrame(() => this.tick());
    }
  }

  private waitForGpuFenceAndContinue(): void {
    if (!this.running || !this.renderer) return;
    const gl = this.renderer.getContext() as WebGL2RenderingContext;
    const isHeavy = HEAVY_FRAGMENT_SCENES.has(this.sceneMode);
    const isHeavyOrSlow = isHeavy || this.lastGpuFrameMs >= 26 || this.adaptiveThrottleActive;
    const useFence =
      typeof gl.fenceSync === 'function' &&
      (this.isSoftwareGl || this.fpsMode === 'uncapped' || isHeavyOrSlow);

    if (!useFence) {
      const elapsedMs = Math.max(0.25, performance.now() - this.pendingSyncStartMs);
      this.onGpuFrameCompleted(this.pendingFramesInSlice, elapsedMs);
      this.scheduleNextTick(false);
      return;
    }

    const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    gl.flush();
    if (!sync) {
      const elapsedMs = Math.max(0.25, performance.now() - this.pendingSyncStartMs);
      this.onGpuFrameCompleted(this.pendingFramesInSlice, elapsedMs);
      this.scheduleNextTick(true);
      return;
    }
    this.pendingGpuSync = sync;

    const pollFence = (fromRaf: boolean) => {
      if (!this.running || !this.renderer || this.pendingGpuSync !== sync) {
        try {
          gl.deleteSync(sync);
        } catch {
          // ignore
        }
        return;
      }

      const waitedMs = performance.now() - this.pendingSyncStartMs;
      let signaled = false;
      try {
        if (typeof gl.clientWaitSync === 'function') {
          const waitRes = gl.clientWaitSync(sync, 0, 0);
          signaled = waitRes === gl.ALREADY_SIGNALED || waitRes === gl.CONDITION_SATISFIED;
        } else {
          signaled = gl.getSyncParameter(sync, gl.SYNC_STATUS) === gl.SIGNALED;
        }
      } catch {
        signaled = true;
      }

      // Release fence after 450ms max so slow ANGLE drivers never stall the loop
      if (!signaled && waitedMs < 450) {
        if (waitedMs >= 8) {
          this.frameHandleIsRaf = true;
          this.frameHandle = requestAnimationFrame(() => pollFence(true));
        } else {
          this.frameHandleIsRaf = false;
          this.frameHandle = window.setTimeout(() => pollFence(false), 2);
        }
        return;
      }

      try {
        gl.deleteSync(sync);
      } catch {
        // ignore
      }
      this.pendingGpuSync = null;

      const gpuFrameMs = Math.max(0.25, waitedMs / Math.max(1, this.pendingFramesInSlice));
      this.onGpuFrameCompleted(this.pendingFramesInSlice, gpuFrameMs);

      // If we are already inside a fresh requestAnimationFrame callback, draw the next frame right away
      // instead of skipping a full vblank (prevents half-rate 30fps stutter on 60Hz monitors!).
      if (fromRaf && !this.isSoftwareGl) {
        this.lastUiYieldTime = performance.now();
        this.tick();
      } else {
        this.scheduleNextTick(waitedMs >= 14);
      }
    };

    if (isHeavyOrSlow || this.isSoftwareGl) {
      this.frameHandleIsRaf = true;
      this.frameHandle = requestAnimationFrame(() => pollFence(true));
    } else {
      this.frameHandleIsRaf = false;
      this.frameHandle = window.setTimeout(() => pollFence(false), 1);
    }
  }

  private animateScene(elapsedSec: number, dtSec: number, updateCpuHeavy = true): void {
    if (this.backdropMat) {
      this.backdropMat.uniforms.uTime.value = elapsedSec;
    }
    for (const mat of this.animatedShaderMats) {
      if (mat.uniforms.uTime) mat.uniforms.uTime.value = elapsedSec;
    }
    if (this.sceneMode === 'vortex') {
      const fanSpeed = 5.5 + (this.estTempC - 40) * 0.25;
      if (this.fans[0]) this.fans[0].rotation.y += dtSec * fanSpeed;
      if (this.fans[1]) this.fans[1].rotation.y -= dtSec * fanSpeed;
      if (this.dieMaterial) {
        this.dieMaterial.emissiveIntensity = 0.85 + Math.sin(elapsedSec * 3.5) * 0.26;
      }
      if (this.holoRingGroup) {
        this.holoRingGroup.position.y = 1.55 + Math.sin(elapsedSec * 2.1) * 0.1;
        this.holoRingGroup.children.forEach((child, idx) => {
          child.rotation.x += dtSec * (0.45 + idx * 0.28);
          child.rotation.y += dtSec * (0.65 - idx * 0.18);
        });
      }
      if (updateCpuHeavy && this.vortexMesh) {
        const count = this.vortexMesh.count;
        const data = this.vortexData;
        for (let i = 0; i < count; i++) {
          const idx = i * 4;
          const r = data[idx];
          const a = data[idx + 1] + elapsedSec * data[idx + 3];
          const y = data[idx + 2] + Math.sin(elapsedSec * 1.6 + i * 0.07) * 0.24;
          _dummyObj.position.set(Math.cos(a) * r, y, Math.sin(a) * r);
          _dummyObj.rotation.set(a * 0.8, a * 1.2, elapsedSec * 0.6);
          _dummyObj.scale.setScalar(0.65 + (i % 7) * 0.055);
          _dummyObj.updateMatrix();
          this.vortexMesh.setMatrixAt(i, _dummyObj.matrix);
        }
        this.vortexMesh.instanceMatrix.needsUpdate = true;
      }
      if (this.camera) {
        const camAngle = elapsedSec * 0.26;
        this.camera.position.set(
          Math.sin(camAngle) * 8.8,
          3.4 + Math.sin(elapsedSec * 0.42) * 0.55,
          Math.cos(camAngle) * 8.8
        );
        this.camera.lookAt(0, 0.78, 0);
      }
    } else if (this.sceneMode === 'furmark') {
      for (const m of this.furmarkMaterials) {
        m.uniforms.uTime.value = elapsedSec;
      }
      if (this.furmarkDonutGroup) {
        this.furmarkDonutGroup.rotation.x = Math.sin(elapsedSec * 0.7) * 0.45;
        this.furmarkDonutGroup.rotation.y = elapsedSec * 0.55;
        this.furmarkDonutGroup.rotation.z = elapsedSec * 0.22;
      }
      if (this.camera) {
        this.camera.position.set(Math.sin(elapsedSec * 0.35) * 1.1, 0.5, 4.9 + Math.cos(elapsedSec * 0.4) * 0.45);
        this.camera.lookAt(0, 0, 0);
      }
    } else if (this.sceneMode === 'raymarching') {
      if (this.raymarchMat) {
        this.raymarchMat.uniforms.uTime.value = elapsedSec;
      }
    } else if (this.sceneMode === 'galaxy') {
      if (this.galaxyMat) {
        this.galaxyMat.uniforms.uTime.value = elapsedSec;
      }
      if (this.galaxyCoreGroup) {
        this.galaxyCoreGroup.rotation.y = elapsedSec * 0.85;
      }
      if (this.camera) {
        const a = elapsedSec * 0.22;
        this.camera.position.set(Math.sin(a) * 11.2, 5.2 + Math.sin(elapsedSec * 0.35) * 2.2, Math.cos(a) * 11.2);
        this.camera.lookAt(0, 0, 0);
      }
    } else if (this.sceneMode === 'vram_fill') {
      this.vramPlanes.forEach((p, idx) => {
        p.rotation.z = idx * 0.18 + elapsedSec * (idx % 2 === 0 ? 0.35 : -0.35);
        const s = 1 + Math.sin(elapsedSec * 1.4 + idx * 0.2) * 0.08;
        p.scale.setScalar(s);
      });
      if (this.camera) {
        this.camera.position.set(Math.sin(elapsedSec * 0.5) * 0.9, Math.cos(elapsedSec * 0.4) * 0.7, 6.2);
        this.camera.lookAt(0, 0, -5);
      }
    } else if (this.sceneMode === 'geometry') {
      this.geometrySculptures.forEach((m, idx) => {
        m.rotation.x = elapsedSec * (0.42 + idx * 0.08);
        m.rotation.y = elapsedSec * (0.55 - idx * 0.06);
      });
      if (this.camera) {
        const a = elapsedSec * 0.32;
        this.camera.position.set(Math.sin(a) * 7.2, 1.8 + Math.sin(elapsedSec * 0.5) * 1.0, Math.cos(a) * 7.2);
        this.camera.lookAt(0, 0, 0);
      }
    } else if (this.sceneMode === 'cyber_city') {
      if (updateCpuHeavy && this.cityTrafficMesh) {
        const count = this.cityTrafficMesh.count;
        const data = this.cityTrafficData;
        for (let i = 0; i < count; i++) {
          const idx = i * 4;
          const axis = data[idx];
          const lane = data[idx + 1];
          const alt = data[idx + 2];
          const speed = data[idx + 3];
          const travel = ((((elapsedSec * speed + i * 0.73) % 36) + 54) % 36) - 18;
          _dummyObj.position.set(axis === 0 ? lane : travel, alt, axis === 0 ? travel : lane);
          _dummyObj.rotation.set(0, axis === 0 ? 0 : Math.PI / 2, 0);
          _dummyObj.scale.set(1, 1, 1.25);
          _dummyObj.updateMatrix();
          this.cityTrafficMesh.setMatrixAt(i, _dummyObj.matrix);
        }
        this.cityTrafficMesh.instanceMatrix.needsUpdate = true;
      }
      if (this.camera) {
        const a = elapsedSec * 0.16;
        this.camera.position.set(Math.sin(a) * 16.5, 7.6 + Math.sin(elapsedSec * 0.4) * 2.1, Math.cos(a) * 16.5);
        this.camera.lookAt(0, 2.0, 0);
      }
    } else if (this.sceneMode === 'fluid_plasma') {
      if (this.plasmaMat) {
        this.plasmaMat.uniforms.uTime.value = elapsedSec;
      }
      this.plasmaOrbs.forEach((orb, idx) => {
        const ang = elapsedSec * 0.55 + (idx / Math.max(1, this.plasmaOrbs.length)) * Math.PI * 2;
        const r = 2.6 + (idx % 3) * 1.15;
        orb.position.set(Math.cos(ang) * r, 1.85 + Math.sin(elapsedSec * 2.1 + idx) * 0.65, Math.sin(ang) * r);
        orb.rotation.x = elapsedSec * 0.9 + idx;
        orb.rotation.y = elapsedSec * 1.1;
      });
      if (this.camera) {
        const a = elapsedSec * 0.2;
        this.camera.position.set(Math.sin(a) * 8.8, 4.4 + Math.sin(elapsedSec * 0.38) * 1.1, Math.cos(a) * 8.8);
        this.camera.lookAt(0, 0.7, 0);
      }
    } else if (this.sceneMode === 'menger_sponge') {
      if (this.mengerMat) {
        this.mengerMat.uniforms.uTime.value = elapsedSec;
      }
    } else if (this.sceneMode === 'neural_lattice') {
      if (this.neuralMat) {
        this.neuralMat.uniforms.uTime.value = elapsedSec;
      }
      if (this.neuralShellGroup) {
        this.neuralShellGroup.rotation.y = elapsedSec * 0.42;
        this.neuralShellGroup.rotation.x = Math.sin(elapsedSec * 0.35) * 0.35;
      }
      if (this.camera) {
        const a = elapsedSec * 0.24;
        this.camera.position.set(Math.sin(a) * 9.6, 2.2 + Math.sin(elapsedSec * 0.45) * 1.5, Math.cos(a) * 9.6);
        this.camera.lookAt(0, 0, 0);
      }
    } else if (this.sceneMode === 'volumetric_nebula') {
      if (this.nebulaMat) {
        this.nebulaMat.uniforms.uTime.value = elapsedSec;
      }
    } else if (this.sceneMode === 'crystal_caustics') {
      if (this.crystalCore) {
        this.crystalCore.rotation.y = elapsedSec * 0.65;
        this.crystalCore.rotation.x = Math.sin(elapsedSec * 0.45) * 0.35;
      }
      if (updateCpuHeavy && this.crystalMesh) {
        const count = this.crystalMesh.count;
        const data = this.crystalData;
        for (let i = 0; i < count; i++) {
          const idx = i * 4;
          const r = data[idx];
          const a = data[idx + 1] + elapsedSec * data[idx + 3];
          const y = data[idx + 2] + Math.sin(elapsedSec * 1.4 + i * 0.09) * 0.32;
          _dummyObj.position.set(Math.cos(a) * r, y, Math.sin(a) * r);
          _dummyObj.rotation.set(a * 0.9, elapsedSec * 0.8 + i * 0.05, r * 0.4);
          _dummyObj.scale.setScalar(0.6 + (i % 5) * 0.14);
          _dummyObj.updateMatrix();
          this.crystalMesh.setMatrixAt(i, _dummyObj.matrix);
        }
        this.crystalMesh.instanceMatrix.needsUpdate = true;
      }
      if (this.camera) {
        const a = elapsedSec * 0.25;
        this.camera.position.set(Math.sin(a) * 9.2, 2.8 + Math.sin(elapsedSec * 0.42) * 1.1, Math.cos(a) * 9.2);
        this.camera.lookAt(0, 0.2, 0);
      }
    } else if (this.sceneMode === 'blackhole_lensing') {
      if (this.blackholeMat) {
        this.blackholeMat.uniforms.uTime.value = elapsedSec;
      }
    } else if (this.sceneMode === 'dna_megastructure') {
      if (this.dnaMat) {
        this.dnaMat.uniforms.uTime.value = elapsedSec;
      }
      if (this.dnaGroup) {
        this.dnaGroup.rotation.y = elapsedSec * 0.55;
        this.dnaGroup.rotation.z = Math.sin(elapsedSec * 0.32) * 0.18;
      }
      if (this.camera) {
        const a = elapsedSec * 0.22;
        this.camera.position.set(Math.sin(a) * 10.6, 1.4 + Math.sin(elapsedSec * 0.35) * 1.8, Math.cos(a) * 10.6);
        this.camera.lookAt(0, 0, 0);
      }
    } else if (this.sceneMode === 'pathtraced_cornell') {
      if (this.cornellGroup) {
        const knob = this.cornellGroup.getObjectByName('cornellKnob');
        if (knob) {
          knob.rotation.x = elapsedSec * 0.9;
          knob.rotation.y = elapsedSec * 1.1;
        }
        const probes = this.cornellGroup.getObjectByName('cornellProbes');
        if (probes) probes.rotation.y = elapsedSec * 0.45;
      }
      if (this.camera) {
        this.camera.position.set(
          Math.sin(elapsedSec * 0.32) * 2.1,
          2.3 + Math.sin(elapsedSec * 0.5) * 0.4,
          7.4 + Math.cos(elapsedSec * 0.32) * 0.6
        );
        this.camera.lookAt(0, 2.0, 0);
      }
    } else if (this.sceneMode === 'subsurface_dragon') {
      if (this.sssDragonGroup) {
        this.sssDragonGroup.rotation.y = elapsedSec * 0.38;
        const lanterns = this.sssDragonGroup.getObjectByName('sssLanterns');
        if (lanterns) lanterns.rotation.y = -elapsedSec * 0.75;
      }
      if (this.camera) {
        const a = elapsedSec * 0.24;
        this.camera.position.set(Math.sin(a) * 8.2, 2.4 + Math.sin(elapsedSec * 0.4) * 0.8, Math.cos(a) * 8.2);
        this.camera.lookAt(0, 1.2, 0);
      }
    } else if (this.sceneMode === 'cloth_aerodynamics') {
      if (updateCpuHeavy && this.clothMesh) {
        const pos = this.clothMesh.geometry.attributes.position as THREE.BufferAttribute;
        for (let i = 0; i < pos.count; i++) {
          const x = pos.getX(i);
          const z = pos.getZ(i);
          const wave =
            Math.sin(x * 1.35 - elapsedSec * 5.2) * 0.42 +
            Math.cos(z * 1.8 + elapsedSec * 3.6) * 0.22;
          pos.setY(i, wave);
        }
        pos.needsUpdate = true;
        this.clothMesh.geometry.computeVertexNormals();
      }
      if (updateCpuHeavy && this.clothStreamMesh) {
        const count = this.clothStreamMesh.count;
        for (let i = 0; i < count; i++) {
          const x = ((((i % 50) / 50) * 12 + elapsedSec * (8 + (i % 5) * 2)) % 12) - 6;
          const z = (((i * 7) % 40) / 40 - 0.5) * 6.2;
          const y = 0.35 + ((i * 13) % 30) * 0.1 + Math.sin(x * 1.1 - elapsedSec * 4) * 0.25;
          _dummyObj.position.set(x, y, z);
          _dummyObj.scale.set(0.7 + (i % 4) * 0.4, 1, 1);
          _dummyObj.updateMatrix();
          this.clothStreamMesh.setMatrixAt(i, _dummyObj.matrix);
        }
        this.clothStreamMesh.instanceMatrix.needsUpdate = true;
      }
      if (this.camera) {
        const a = elapsedSec * 0.22;
        this.camera.position.set(Math.sin(a) * 8.6, 3.1 + Math.sin(elapsedSec * 0.45) * 0.7, Math.cos(a) * 8.6);
        this.camera.lookAt(0, 0.8, 0);
      }
    } else if (this.sceneMode === 'volumetric_godrays') {
      if (this.godraysGroup) {
        this.godraysGroup.rotation.y = elapsedSec * 0.24;
        const motes = this.godraysGroup.getObjectByName('godrayMotes');
        if (motes) motes.rotation.y = -elapsedSec * 0.45;
      }
      if (this.camera) {
        const a = elapsedSec * 0.18;
        this.camera.position.set(Math.sin(a) * 9.5, 2.2 + Math.sin(elapsedSec * 0.35) * 0.9, Math.cos(a) * 9.5);
        this.camera.lookAt(0, 1.8, 0);
      }
    } else if (this.sceneMode === 'voronoi_shatter') {
      if (updateCpuHeavy && this.voronoiMesh) {
        const count = this.voronoiMesh.count;
        const data = this.voronoiData;
        const pulse = Math.pow(Math.sin(elapsedSec * 1.35) * 0.5 + 0.5, 1.4) * 4.2;
        for (let i = 0; i < count; i++) {
          const idx = i * 4;
          const nx = data[idx];
          const ny = data[idx + 1];
          const nz = data[idx + 2];
          const r0 = data[idx + 3];
          const dist = r0 + pulse * (0.4 + r0 * 0.85);
          _dummyObj.position.set(nx * dist, 1.2 + ny * dist, nz * dist);
          _dummyObj.rotation.set(elapsedSec * nx * 2.2, elapsedSec * ny * 2.2, elapsedSec * nz * 2.2);
          _dummyObj.scale.setScalar(0.65 + (i % 5) * 0.18);
          _dummyObj.updateMatrix();
          this.voronoiMesh.setMatrixAt(i, _dummyObj.matrix);
        }
        this.voronoiMesh.instanceMatrix.needsUpdate = true;
      }
      if (this.camera) {
        const a = elapsedSec * 0.28;
        this.camera.position.set(Math.sin(a) * 8.8, 2.6 + Math.sin(elapsedSec * 0.4) * 0.8, Math.cos(a) * 8.8);
        this.camera.lookAt(0, 1.0, 0);
      }
    } else if (this.sceneMode === 'supernova_remnant') {
      if (this.supernovaGroup) {
        this.supernovaGroup.rotation.y = elapsedSec * 0.52;
        this.supernovaGroup.rotation.z = Math.sin(elapsedSec * 0.35) * 0.25;
        for (let s = 0; s < 4; s++) {
          const shell = this.supernovaGroup.getObjectByName(`snShell_${s}`);
          if (shell) {
            const sc = 1 + Math.sin(elapsedSec * 1.8 - s * 0.6) * 0.16;
            shell.scale.setScalar(sc);
            shell.rotation.x = elapsedSec * (0.4 + s * 0.15);
          }
        }
      }
      if (this.camera) {
        const a = elapsedSec * 0.22;
        this.camera.position.set(Math.sin(a) * 10.2, 3.6 + Math.sin(elapsedSec * 0.4) * 1.4, Math.cos(a) * 10.2);
        this.camera.lookAt(0, 0, 0);
      }
    } else if (this.sceneMode === 'cyber_tunnel_warp') {
      if (updateCpuHeavy && this.warpTunnelMesh) {
        const count = this.warpTunnelMesh.count;
        const data = this.warpTunnelData;
        for (let i = 0; i < count; i++) {
          const idx = i * 4;
          const angle = data[idx] + elapsedSec * 0.35;
          const radius = data[idx + 1];
          const z = ((((data[idx + 2] + elapsedSec * data[idx + 3]) % 42) + 42) % 42) - 36;
          _dummyObj.position.set(Math.cos(angle) * radius, Math.sin(angle) * radius, z);
          _dummyObj.rotation.set(0, 0, angle);
          _dummyObj.scale.set(1, 1, 1.1);
          _dummyObj.updateMatrix();
          this.warpTunnelMesh.setMatrixAt(i, _dummyObj.matrix);
        }
        this.warpTunnelMesh.instanceMatrix.needsUpdate = true;
      }
      if (this.camera) {
        this.camera.position.set(Math.sin(elapsedSec * 1.2) * 0.75, Math.cos(elapsedSec * 0.9) * 0.65, 7.5);
        this.camera.lookAt(0, 0, -25);
      }
    } else if (this.sceneMode === 'magnetic_ferrofluid') {
      if (this.ferrofluidMesh) {
        if (updateCpuHeavy) {
          const pos = this.ferrofluidMesh.geometry.attributes.position as THREE.BufferAttribute;
          for (let i = 0; i < pos.count; i++) {
            const x = pos.getX(i);
            const y = pos.getY(i);
            const z = pos.getZ(i);
            const len = Math.sqrt(x * x + y * y + z * z) || 1;
            const nx = x / len;
            const ny = y / len;
            const nz = z / len;
            const spike =
              Math.pow(
                Math.abs(
                  Math.sin(nx * 6.0 + elapsedSec * 2.8) *
                    Math.cos(ny * 6.0 - elapsedSec * 2.4) *
                    Math.sin(nz * 6.0 + elapsedSec * 3.1)
                ),
                0.65
              ) * 0.85;
            const r = 1.65 + spike;
            pos.setXYZ(i, nx * r, ny * r, nz * r);
          }
          pos.needsUpdate = true;
          this.ferrofluidMesh.geometry.computeVertexNormals();
        }
        this.ferrofluidMesh.rotation.y = elapsedSec * 0.45;
      }
      if (this.camera) {
        const a = elapsedSec * 0.25;
        this.camera.position.set(Math.sin(a) * 6.8, 2.6 + Math.sin(elapsedSec * 0.4) * 0.7, Math.cos(a) * 6.8);
        this.camera.lookAt(0, 0.5, 0);
      }
    } else if (this.sceneMode === 'fractal_julia4d') {
      if (this.julia4dMat) {
        this.julia4dMat.uniforms.uTime.value = 12.5 + elapsedSec * 1.35;
      }
    } else if (this.sceneMode === 'tokamak_fusion') {
      if (this.tokamakGroup) {
        const ions = this.tokamakGroup.getObjectByName('tokamakIons');
        if (ions) {
          ions.rotation.y = elapsedSec * 2.8;
        }
      }
      if (this.camera) {
        const a = elapsedSec * 0.24;
        this.camera.position.set(Math.sin(a) * 8.9, 3.5 + Math.sin(elapsedSec * 0.45) * 1.1, Math.cos(a) * 8.9);
        this.camera.lookAt(0, 0.4, 0);
      }
    } else if (this.sceneMode === 'raytraced_metaballs') {
      if (this.metaballsGroup) {
        for (let i = 1; i < 16; i++) {
          const orb = this.metaballsGroup.getObjectByName(`metaball_${i}`);
          if (orb) {
            const a = elapsedSec * (0.8 + (i % 5) * 0.25) + i * 1.1;
            const r = 1.1 + Math.sin(elapsedSec * 1.6 + i) * 0.95;
            orb.position.set(
              Math.cos(a) * r,
              Math.sin(elapsedSec * 1.9 + i * 0.7) * 1.1,
              Math.sin(a) * r
            );
          }
        }
        const drops = this.metaballsGroup.getObjectByName('metaballDrops');
        if (drops) drops.rotation.y = elapsedSec * 0.55;
      }
      if (this.camera) {
        const a = elapsedSec * 0.26;
        this.camera.position.set(Math.sin(a) * 8.4, 2.2 + Math.sin(elapsedSec * 0.4) * 0.9, Math.cos(a) * 8.4);
        this.camera.lookAt(0, 0.2, 0);
      }
    } else if (this.sceneMode === 'ocean_gerstner_fft') {
      if (updateCpuHeavy && this.oceanMesh) {
        const pos = this.oceanMesh.geometry.attributes.position as THREE.BufferAttribute;
        for (let i = 0; i < pos.count; i++) {
          const x = pos.getX(i);
          const z = pos.getZ(i);
          const y =
            Math.sin(x * 0.75 + elapsedSec * 3.2) * 0.55 +
            Math.cos(z * 0.9 - elapsedSec * 2.7) * 0.45 +
            Math.sin((x + z) * 1.3 + elapsedSec * 4.5) * 0.22;
          pos.setY(i, y);
        }
        pos.needsUpdate = true;
        this.oceanMesh.geometry.computeVertexNormals();
      }
      if (this.oceanFoamMesh) {
        this.oceanFoamMesh.rotation.y = elapsedSec * 0.18;
      }
      if (this.camera) {
        const a = elapsedSec * 0.2;
        this.camera.position.set(Math.sin(a) * 9.4, 3.6 + Math.sin(elapsedSec * 0.45) * 0.8, Math.cos(a) * 9.4);
        this.camera.lookAt(0, 0.2, 0);
      }
    } else if (this.sceneMode === 'fluid_navier_stokes') {
      if (updateCpuHeavy && this.cfdFluidMesh) {
        const count = this.cfdFluidMesh.count;
        const data = this.cfdFluidData;
        for (let i = 0; i < count; i++) {
          const idx = i * 4;
          const a = data[idx] + elapsedSec * data[idx + 3];
          const r = data[idx + 1] + Math.sin(elapsedSec * 2.1 + i * 0.05) * 0.35;
          const y = data[idx + 2] + Math.cos(a * 2.0 + elapsedSec * 1.8) * 0.42;
          _dummyObj.position.set(Math.cos(a) * r, y, Math.sin(a) * r);
          _dummyObj.rotation.set(0, -a, Math.sin(elapsedSec * 2 + i) * 0.3);
          _dummyObj.scale.setScalar(0.75 + (i % 4) * 0.22);
          _dummyObj.updateMatrix();
          this.cfdFluidMesh.setMatrixAt(i, _dummyObj.matrix);
        }
        this.cfdFluidMesh.instanceMatrix.needsUpdate = true;
      }
      if (this.camera) {
        const a = elapsedSec * 0.24;
        this.camera.position.set(Math.sin(a) * 9.2, 2.8 + Math.sin(elapsedSec * 0.4) * 0.9, Math.cos(a) * 9.2);
        this.camera.lookAt(0, 0.2, 0);
      }
    } else if (this.sceneMode === 'gi_radiosity_temple') {
      if (this.giTempleGroup) {
        const relic = this.giTempleGroup.getObjectByName('giRelic');
        if (relic) {
          relic.rotation.y = elapsedSec * 1.1;
          relic.rotation.x = elapsedSec * 0.7;
        }
        const prisms = this.giTempleGroup.getObjectByName('giPrisms');
        if (prisms) prisms.rotation.y = elapsedSec * 0.48;
      }
      if (this.camera) {
        const a = elapsedSec * 0.22;
        this.camera.position.set(Math.sin(a) * 9.6, 3.4 + Math.sin(elapsedSec * 0.35) * 0.9, Math.cos(a) * 9.6);
        this.camera.lookAt(0, 1.4, 0);
      }
    } else if (this.sceneMode === 'particle_collider_cern') {
      if (this.cernColliderGroup) {
        const tracks = this.cernColliderGroup.getObjectByName('cernTracks');
        if (tracks) {
          tracks.rotation.z = elapsedSec * 1.4;
          const pulse = 0.85 + Math.sin(elapsedSec * 3.8) * 0.25;
          tracks.scale.setScalar(pulse);
        }
      }
      if (this.camera) {
        const a = elapsedSec * 0.25;
        this.camera.position.set(Math.sin(a) * 9.2, 2.4 + Math.sin(elapsedSec * 0.4) * 1.1, Math.cos(a) * 9.2);
        this.camera.lookAt(0, 0, 0);
      }
    } else if (this.sceneMode === 'procedural_planet_atmo') {
      if (this.exoplanetGroup) {
        this.exoplanetGroup.rotation.y = elapsedSec * 0.32;
        const rocks = this.exoplanetGroup.getObjectByName('planetRingRocks');
        if (rocks) rocks.rotation.y = elapsedSec * 0.65;
      }
      if (this.camera) {
        const a = elapsedSec * 0.2;
        this.camera.position.set(Math.sin(a) * 9.4, 2.8 + Math.sin(elapsedSec * 0.35) * 1.0, Math.cos(a) * 9.4);
        this.camera.lookAt(0, 0, 0);
      }
    } else if (this.sceneMode === 'volumetric_fire_tornado') {
      if (this.fireTornadoGroup) {
        for (let f = 0; f < 4; f++) {
          const funnel = this.fireTornadoGroup.getObjectByName(`fireFunnel_${f}`);
          if (funnel) funnel.rotation.y = elapsedSec * (2.2 + f * 0.6) * (f % 2 === 0 ? 1 : -1);
        }
        const embers = this.fireTornadoGroup.getObjectByName('fireEmbers');
        if (embers) embers.rotation.y = elapsedSec * 2.6;
      }
      if (this.camera) {
        const a = elapsedSec * 0.26;
        this.camera.position.set(Math.sin(a) * 9.2, 3.2 + Math.sin(elapsedSec * 0.45) * 1.1, Math.cos(a) * 9.2);
        this.camera.lookAt(0, 2.2, 0);
      }
    } else if (this.sceneMode === 'cyber_matrix_hypercube') {
      if (this.hypercubeGroup) {
        const outer = this.hypercubeGroup.getObjectByName('tesseractOuter');
        const inner = this.hypercubeGroup.getObjectByName('tesseractInner');
        const nodes = this.hypercubeGroup.getObjectByName('tesseractNodes');
        if (outer) {
          outer.rotation.x = elapsedSec * 0.65;
          outer.rotation.y = elapsedSec * 0.85;
        }
        if (inner) {
          inner.rotation.x = -elapsedSec * 1.1;
          inner.rotation.z = elapsedSec * 0.95;
          const s = 1 + Math.sin(elapsedSec * 2.4) * 0.28;
          inner.scale.setScalar(s);
        }
        if (nodes) {
          nodes.rotation.y = elapsedSec * 0.25;
        }
      }
      if (this.camera) {
        const a = elapsedSec * 0.22;
        this.camera.position.set(Math.sin(a) * 9.0, 2.8 + Math.sin(elapsedSec * 0.4) * 1.0, Math.cos(a) * 9.0);
        this.camera.lookAt(0, 0.6, 0);
      }
    } else if (this.sceneMode === 'voxel_pathtracer') {
      if (this.voxelGiGroup) {
        this.voxelGiGroup.rotation.y = elapsedSec * 0.28;
        const prism = this.voxelGiGroup.getObjectByName('voxelPrism');
        if (prism) {
          prism.rotation.x = elapsedSec * 1.1;
          prism.rotation.y = -elapsedSec * 1.4;
        }
      }
      if (this.camera) {
        const a = elapsedSec * 0.24;
        this.camera.position.set(Math.sin(a) * 9.2, 3.2 + Math.sin(elapsedSec * 0.45) * 0.9, Math.cos(a) * 9.2);
        this.camera.lookAt(0, 1.0, 0);
      }
    } else if (this.sceneMode === 'nbody_galaxy_collision') {
      if (this.galaxyCollisionGroup) {
        this.galaxyCollisionGroup.rotation.y = elapsedSec * 0.42;
        const stars = this.galaxyCollisionGroup.getObjectByName('collisionStars');
        if (stars) stars.rotation.z = Math.sin(elapsedSec * 0.5) * 0.25;
      }
      if (this.camera) {
        const a = elapsedSec * 0.2;
        this.camera.position.set(Math.sin(a) * 10.5, 4.4 + Math.sin(elapsedSec * 0.35) * 1.4, Math.cos(a) * 10.5);
        this.camera.lookAt(0, 0, 0);
      }
    } else if (this.sceneMode === 'caustic_water_pool') {
      if (this.causticPoolGroup) {
        if (updateCpuHeavy) {
          const surface = this.causticPoolGroup.getObjectByName('causticSurface') as THREE.Mesh | undefined;
          if (surface) {
            const pos = surface.geometry.attributes.position as THREE.BufferAttribute;
            for (let i = 0; i < pos.count; i++) {
              const x = pos.getX(i);
              const z = pos.getZ(i);
              const r = Math.hypot(x, z);
              pos.setY(i, Math.sin(r * 2.2 - elapsedSec * 4.5) * 0.22 + Math.cos(x * 1.4 + elapsedSec * 3.0) * 0.12);
            }
            pos.needsUpdate = true;
            surface.geometry.computeVertexNormals();
          }
        }
        const photons = this.causticPoolGroup.getObjectByName('causticPhotons');
        if (photons) photons.rotation.y = elapsedSec * 0.35;
      }
      if (this.camera) {
        const a = elapsedSec * 0.22;
        this.camera.position.set(Math.sin(a) * 8.8, 3.8 + Math.sin(elapsedSec * 0.4) * 0.8, Math.cos(a) * 8.8);
        this.camera.lookAt(0, 0.3, 0);
      }
    } else if (this.sceneMode === 'fractal_apollonian') {
      if (this.apollonianGroup) {
        this.apollonianGroup.rotation.y = elapsedSec * 0.38;
        this.apollonianGroup.rotation.x = Math.sin(elapsedSec * 0.45) * 0.35;
      }
      if (this.camera) {
        const a = elapsedSec * 0.24;
        this.camera.position.set(Math.sin(a) * 8.6, 2.4 + Math.sin(elapsedSec * 0.4) * 0.9, Math.cos(a) * 8.6);
        this.camera.lookAt(0, 0.5, 0);
      }
    } else if (this.sceneMode === 'cyber_mecha_hangar') {
      if (this.mechaHangarGroup) {
        const ring = this.mechaHangarGroup.getObjectByName('mechaScanRing');
        if (ring) ring.position.y = 0.6 + (Math.sin(elapsedSec * 2.2) * 0.5 + 0.5) * 3.6;
        const sparks = this.mechaHangarGroup.getObjectByName('mechaSparks');
        if (sparks) sparks.rotation.y = elapsedSec * 0.95;
      }
      if (this.camera) {
        const a = elapsedSec * 0.25;
        this.camera.position.set(Math.sin(a) * 9.4, 2.8 + Math.sin(elapsedSec * 0.4) * 1.1, Math.cos(a) * 9.4);
        this.camera.lookAt(0, 1.8, 0);
      }
    } else if (this.sceneMode === 'plasma_magnetosphere') {
      if (this.magnetosphereGroup) {
        this.magnetosphereGroup.rotation.y = elapsedSec * 0.55;
        const belt = this.magnetosphereGroup.getObjectByName('vanAllenBelt');
        if (belt) belt.rotation.y = elapsedSec * 0.85;
      }
      if (this.camera) {
        const a = elapsedSec * 0.22;
        this.camera.position.set(Math.sin(a) * 9.6, 2.6 + Math.sin(elapsedSec * 0.4) * 1.2, Math.cos(a) * 9.6);
        this.camera.lookAt(0, 0.4, 0);
      }
    } else if (this.sceneMode === 'crystal_geode_cave') {
      if (this.geodeCaveGroup) {
        this.geodeCaveGroup.rotation.y = elapsedSec * 0.32;
        this.geodeCaveGroup.rotation.z = Math.sin(elapsedSec * 0.4) * 0.22;
      }
      if (this.camera) {
        const a = elapsedSec * 0.24;
        this.camera.position.set(Math.sin(a) * 8.4, 2.0 + Math.sin(elapsedSec * 0.4) * 0.8, Math.cos(a) * 8.4);
        this.camera.lookAt(0, 0.6, 0);
      }
    } else if (this.sceneMode === 'quantum_chromodynamics') {
      if (this.qcdLatticeGroup) {
        this.qcdLatticeGroup.rotation.y = elapsedSec * 0.45;
        const flux = this.qcdLatticeGroup.getObjectByName('gluonFlux');
        if (flux) {
          flux.rotation.x = elapsedSec * 0.9;
          flux.rotation.z = elapsedSec * 0.65;
        }
      }
      if (this.camera) {
        const a = elapsedSec * 0.25;
        this.camera.position.set(Math.sin(a) * 8.8, 2.5 + Math.sin(elapsedSec * 0.4) * 0.9, Math.cos(a) * 8.8);
        this.camera.lookAt(0, 0.8, 0);
      }
    } else if (this.sceneMode === 'meshlet_nanite_cluster') {
      if (this.meshletGroup) {
        this.meshletGroup.rotation.y = elapsedSec * 0.42;
        const clusters = this.meshletGroup.getObjectByName('meshletClusters');
        if (clusters) {
          clusters.rotation.x = Math.sin(elapsedSec * 0.55) * 0.3;
          clusters.rotation.z = elapsedSec * 0.22;
        }
      }
      if (this.camera) {
        const a = elapsedSec * 0.24;
        this.camera.position.set(Math.sin(a) * 8.6, 2.1 + Math.sin(elapsedSec * 0.5) * 0.8, Math.cos(a) * 8.6);
        this.camera.lookAt(0, 0.85, 0);
      }
    } else if (this.sceneMode === 'caustic_raytrace_prism') {
      if (this.causticPrismGroup) {
        const prism = this.causticPrismGroup.getObjectByName('opticalPrism');
        if (prism) prism.rotation.y = elapsedSec * 0.65;
        const photons = this.causticPrismGroup.getObjectByName('causticPhotons');
        if (photons) photons.rotation.y = -elapsedSec * 0.35;
      }
      if (this.camera) {
        const a = elapsedSec * 0.22;
        this.camera.position.set(Math.sin(a) * 8.2, 2.5 + Math.sin(elapsedSec * 0.38) * 0.6, Math.cos(a) * 8.2);
        this.camera.lookAt(0, 0.65, 0);
      }
    } else if (this.sceneMode === 'temporal_aa_checker') {
      if (this.temporalCheckerGroup) {
        this.temporalCheckerGroup.rotation.y = elapsedSec * 0.28;
        const totems = this.temporalCheckerGroup.getObjectByName('checkerTotems');
        if (totems) {
          totems.children.forEach((c, idx) => {
            c.rotation.x = elapsedSec * (0.6 + (idx % 3) * 0.2);
            c.rotation.y = elapsedSec * 0.9;
          });
        }
      }
      if (this.camera) {
        const a = elapsedSec * 0.3;
        this.camera.position.set(Math.sin(a) * 8.0, 2.3 + Math.sin(elapsedSec * 0.7) * 0.85, Math.cos(a) * 8.0);
        this.camera.lookAt(0, 0.7, 0);
      }
    } else if (this.sceneMode === 'sph_fluid_compute') {
      if (this.sphFluidMesh && this.sphFluidData && updateCpuHeavy) {
        const n = this.sphFluidMesh.count;
        const d = this.sphFluidData;
        const stepDt = Math.min(0.025, Math.max(0.004, dtSec));
        for (let i = 0; i < n; i++) {
          const base = i * 6;
          let x = d[base];
          let y = d[base + 1];
          let z = d[base + 2];
          let vx = d[base + 3];
          let vy = d[base + 4];
          let vz = d[base + 5];

          // Swirl force + gravity + container collision
          const swirlX = -z * 1.35;
          const swirlZ = x * 1.35;
          vx = vx * 0.985 + swirlX * stepDt * 1.8;
          vz = vz * 0.985 + swirlZ * stepDt * 1.8;
          vy -= 4.8 * stepDt;

          x += vx * stepDt;
          y += vy * stepDt;
          z += vz * stepDt;

          if (y < -0.9) {
            y = -0.9;
            vy = Math.abs(vy) * 0.72 + 1.8 + Math.sin(elapsedSec * 2.5 + i * 0.07) * 1.1;
          } else if (y > 2.45) {
            y = 2.45;
            vy = -Math.abs(vy) * 0.6;
          }
          if (x > 2.95 || x < -2.95) {
            x = Math.sign(x) * 2.95;
            vx *= -0.82;
          }
          if (z > 2.95 || z < -2.95) {
            z = Math.sign(z) * 2.95;
            vz *= -0.82;
          }

          d[base] = x;
          d[base + 1] = y;
          d[base + 2] = z;
          d[base + 3] = vx;
          d[base + 4] = vy;
          d[base + 5] = vz;

          _dummyObj.position.set(x, y, z);
          _dummyObj.scale.setScalar(1);
          _dummyObj.updateMatrix();
          this.sphFluidMesh.setMatrixAt(i, _dummyObj.matrix);
        }
        this.sphFluidMesh.instanceMatrix.needsUpdate = true;
      }
      if (this.camera) {
        const a = elapsedSec * 0.25;
        this.camera.position.set(Math.sin(a) * 9.2, 2.9 + Math.sin(elapsedSec * 0.35) * 0.7, Math.cos(a) * 9.2);
        this.camera.lookAt(0, 0.75, 0);
      }
    } else if (this.sceneMode === 'rt_reflections_hall') {
      if (this.rtHallGroup) {
        const piece = this.rtHallGroup.getObjectByName('rtCenterpiece');
        const refl = this.rtHallGroup.getObjectByName('rtReflection');
        if (piece) {
          piece.rotation.y = elapsedSec * 0.58;
          piece.rotation.z = Math.sin(elapsedSec * 0.7) * 0.14;
        }
        if (refl && piece) {
          refl.rotation.y = piece.rotation.y;
          refl.rotation.z = -piece.rotation.z;
        }
        const orbs = this.rtHallGroup.getObjectByName('rtMirrorOrbs');
        if (orbs) orbs.rotation.y = -elapsedSec * 0.28;
      }
      if (this.camera) {
        const a = elapsedSec * 0.24;
        this.camera.position.set(Math.sin(a) * 10.2, 2.6 + Math.sin(elapsedSec * 0.42) * 0.85, Math.cos(a) * 10.2);
        this.camera.lookAt(0, 1.8, 0);
      }
    } else if (this.sceneMode === 'volumetric_clouds_4k') {
      if (this.volumetricCloudMat) {
        this.volumetricCloudMat.uniforms.uTime.value = elapsedSec;
      }
      if (this.stormCloudGroup) {
        const clouds = this.stormCloudGroup.getObjectByName('stormClouds3D');
        if (clouds) {
          clouds.rotation.y = elapsedSec * 0.14;
        }
        const bolts = this.stormCloudGroup.getObjectByName('stormLightningBolts');
        if (bolts) {
          bolts.rotation.y = -elapsedSec * 0.22;
          bolts.children.forEach((b, idx) => {
            b.visible = Math.sin(elapsedSec * 9.5 + idx * 1.9) > 0.15;
          });
        }
        const rain = this.stormCloudGroup.getObjectByName('stormRainShafts');
        if (rain) {
          rain.rotation.y = elapsedSec * 0.35;
        }
        const flashLight = this.stormCloudGroup.getObjectByName('stormFlashLight') as THREE.PointLight | undefined;
        if (flashLight) {
          flashLight.intensity = 6.5 + Math.pow(Math.max(0, Math.sin(elapsedSec * 7.5)), 4) * 18.0;
        }
      }
      if (this.camera) {
        const a = elapsedSec * 0.22;
        this.camera.position.set(
          Math.sin(a) * 10.6,
          3.2 + Math.sin(elapsedSec * 0.45) * 1.1,
          Math.cos(a) * 10.6
        );
        this.camera.lookAt(0, 1.35, 0);
      }
    } else if (this.sceneMode === 'cyber_rain_neon') {
      if (this.cyberRainMesh && this.cyberRainData && updateCpuHeavy) {
        const n = this.cyberRainMesh.count;
        const d = this.cyberRainData;
        const stepDt = Math.min(0.035, Math.max(0.004, dtSec));
        const stride = n > 2000 ? 2 : 1;
        const offset = n > 2000 ? this.animFrameTick % 2 : 0;
        for (let i = offset; i < n; i += stride) {
          const base = i * 4;
          let y = d[base + 1] - d[base + 3] * stepDt * stride;
          if (y < 0.05) y = 13.5 + (i % 7) * 0.35;
          d[base + 1] = y;
          _dummyObj.position.set(d[base], y, d[base + 2]);
          _dummyObj.scale.setScalar(1);
          _dummyObj.updateMatrix();
          this.cyberRainMesh.setMatrixAt(i, _dummyObj.matrix);
        }
        this.cyberRainMesh.instanceMatrix.needsUpdate = true;
      }
      if (this.camera) {
        this.camera.position.set(Math.sin(elapsedSec * 0.35) * 2.2, 2.6 + Math.sin(elapsedSec * 0.5) * 0.35, 10.8);
        this.camera.lookAt(0, 2.4, -5);
      }
    } else if (this.sceneMode === 'magma_caldera_sim') {
      if (this.magmaCalderaMat) {
        this.magmaCalderaMat.uniforms.uTime.value = elapsedSec;
      }
      if (this.magmaBombsMesh && this.magmaBombsData && updateCpuHeavy) {
        const n = this.magmaBombsMesh.count;
        const d = this.magmaBombsData;
        const stepDt = Math.min(0.03, Math.max(0.004, dtSec));
        for (let i = 0; i < n; i++) {
          const base = i * 6;
          d[base] += d[base + 3] * stepDt;
          d[base + 1] += d[base + 4] * stepDt;
          d[base + 2] += d[base + 5] * stepDt;
          d[base + 4] -= 7.8 * stepDt;
          if (d[base + 1] < 0.05) {
            const a = ((i * 2.39996 + elapsedSec) % (Math.PI * 2));
            const spread = 0.6 + (i % 10) * 0.28;
            d[base] = Math.cos(a) * 0.8;
            d[base + 1] = 0.15;
            d[base + 2] = Math.sin(a) * 0.8;
            d[base + 3] = Math.cos(a) * spread;
            d[base + 4] = 4.6 + (i % 7) * 0.85;
            d[base + 5] = Math.sin(a) * spread;
          }
          _dummyObj.position.set(d[base], d[base + 1], d[base + 2]);
          _dummyObj.rotation.set(elapsedSec * 2 + i, elapsedSec * 1.5, 0);
          _dummyObj.scale.setScalar(0.75 + (i % 4) * 0.25);
          _dummyObj.updateMatrix();
          this.magmaBombsMesh.setMatrixAt(i, _dummyObj.matrix);
        }
        this.magmaBombsMesh.instanceMatrix.needsUpdate = true;
      }
      if (this.camera) {
        const a = elapsedSec * 0.24;
        this.camera.position.set(Math.sin(a) * 11.2, 4.6 + Math.sin(elapsedSec * 0.4) * 0.9, Math.cos(a) * 11.2);
        this.camera.lookAt(0, 1.4, 0);
      }
    }
  }

  private tick(): void {
    if (!this.running || !this.renderer || !this.scene || !this.camera) return;

    this.animFrameTick++;
    const tSliceStart = performance.now();
    const isHeavy = HEAVY_FRAGMENT_SCENES.has(this.sceneMode);
    const isHeavyOrSlow = isHeavy || this.lastGpuFrameMs >= 26 || this.adaptiveThrottleActive;
    let framesInSlice = 1;

    if (!this.isSoftwareGl && this.fpsMode === 'uncapped' && !isHeavyOrSlow) {
      const batch = this.lastGpuFrameMs < 5 ? Math.min(2, this.uncappedBatchSize) : 1;
      const baseElapsed = (tSliceStart - this.startTime) / 1000;
      const sliceDtSec = Math.min(0.05, Math.max(0.0005, (tSliceStart - this.lastFrameTime) / 1000));

      let executed = 0;
      for (let b = 0; b < batch; b++) {
        this.animateScene(baseElapsed + b * 0.001, sliceDtSec / batch, b === 0);
        this.renderSingleFrame();
        executed++;
        if (performance.now() - tSliceStart > 4.2) break;
      }

      framesInSlice = executed;
      this.lastFrameTime = performance.now();
    } else {
      const dtMs = Math.max(0.25, tSliceStart - this.lastFrameTime);
      const dtSec = Math.min(0.1, dtMs / 1000);
      const elapsedSec = (tSliceStart - this.startTime) / 1000;
      this.lastFrameTime = tSliceStart;

      this.animateScene(elapsedSec, dtSec);
      this.renderSingleFrame();
      framesInSlice = 1;
    }

    this.pendingSyncStartMs = tSliceStart;
    this.pendingFramesInSlice = framesInSlice;
    this.waitForGpuFenceAndContinue();
  }

  private onGpuFrameCompleted(framesInSlice: number, gpuFrameMs: number): void {
    if (!this.running || !this.renderer) return;

    this.lastGpuFrameMs = gpuFrameMs;
    if (gpuFrameMs < 4 && this.uncappedBatchSize < 2) {
      this.uncappedBatchSize = 2;
    } else if (gpuFrameMs > 7 && this.uncappedBatchSize > 1) {
      this.uncappedBatchSize = 1;
    }

    // Adaptive anti-freeze resolution scaling when actual GPU frame time spikes
    const isHeavy = HEAVY_FRAGMENT_SCENES.has(this.sceneMode);
    const adaptive = computeAdaptiveRenderScale(
      this.renderScale,
      gpuFrameMs,
      isHeavy,
      this.slowFrameStreak,
      this.fastFrameStreak
    );
    this.slowFrameStreak = adaptive.slowFrames;
    this.fastFrameStreak = adaptive.fastFrames;
    this.adaptiveThrottleActive = adaptive.throttled;
    if (Math.abs(adaptive.nextScale - this.renderScale) >= 0.02) {
      this.renderScale = adaptive.nextScale;
      this.applyRenderScale(false);
    }

    this.totalFramesRendered += framesInSlice;
    this.windowFrames += framesInSlice;
    const now = performance.now();
    const elapsedSec = (now - this.startTime) / 1000;
    const windowElapsedMs = now - this.lastMetricEmit;

    if ((windowElapsedMs >= 240 || (this.allFpsSamples.length === 0 && windowElapsedMs >= 90)) && this.windowFrames > 0) {
      const curFps = Math.max(1, Math.min(2400, Math.round((this.windowFrames * 1000) / windowElapsedMs)));
      const windowFrameMs = Number((windowElapsedMs / Math.max(1, this.windowFrames)).toFixed(2));
      this.windowFrames = 0;
      this.lastMetricEmit = now;

      this.frameTimes.push(windowFrameMs);
      if (this.frameTimes.length > 90) this.frameTimes.shift();

      this.allFpsSamples.push(curFps);
      if (this.allFpsSamples.length > 180) this.allFpsSamples.shift();

      const avgFrameMs =
        this.frameTimes.reduce((s, v) => s + v, 0) / Math.max(1, this.frameTimes.length);
      const avgFps = Math.round(
        this.allFpsSamples.reduce((s, v) => s + v, 0) / Math.max(1, this.allFpsSamples.length)
      );

      const sortedFps = [...this.allFpsSamples].sort((a, b) => a - b);
      const minFps = Math.round(sortedFps[0] ?? curFps);
      const maxFps = Math.round(sortedFps[sortedFps.length - 1] ?? curFps);
      const low1Idx = Math.max(0, Math.floor(sortedFps.length * 0.05));
      const low1PctFps = Math.round(sortedFps[low1Idx] ?? minFps);

      // Compute genuine frame-pacing stability across measurement windows (20%–99.8%)
      // so real frame jitter, tail hitches, or thermal throttling can drop below 75%.
      const sortedFt = [...this.frameTimes].sort((a, b) => a - b);
      const trimStart = Math.floor(sortedFt.length * 0.08);
      const trimEnd = Math.max(trimStart + 1, Math.ceil(sortedFt.length * 0.92));
      const trimmedFt = sortedFt.slice(trimStart, trimEnd);
      const trimmedMean =
        trimmedFt.reduce((s, v) => s + v, 0) / Math.max(1, trimmedFt.length);
      const variance =
        trimmedFt.reduce((s, v) => s + (v - trimmedMean) ** 2, 0) /
        Math.max(1, trimmedFt.length);
      const stdDev = Math.sqrt(variance);
      const cv = stdDev / Math.max(2.0, trimmedMean);
      const medianFt = sortedFt[Math.floor(sortedFt.length * 0.5)] || trimmedMean || 16.7;
      const p95Ft = sortedFt[Math.min(sortedFt.length - 1, Math.floor(sortedFt.length * 0.95))] || medianFt;
      const spikePenalty = Math.max(0, (p95Ft / Math.max(1.5, medianFt) - 1.35) * 18);
      const rawStability = (1 - cv * 0.62) * 100 - spikePenalty;
      const stabilityPct = Number(Math.max(20, Math.min(99.8, rawStability)).toFixed(1));

      const presetBias = PRESET_CONFIG[this.preset].powerBias;
      const modeBonus = this.fpsMode === 'uncapped' ? 6 : 0;
      const targetTemp = Math.min(92, 46 + presetBias + modeBonus + Math.min(9, elapsedSec * 0.28));
      this.estTempC = Number((this.estTempC + (targetTemp - this.estTempC) * 0.14).toFixed(1));
      this.peakTempC = Math.max(this.peakTempC, this.estTempC);

      const liveGpuTemp = thermalMonitorService.getLiveGpuTempC();
      const effectiveTempC = liveGpuTemp !== null ? liveGpuTemp : this.estTempC;

      const allocatedVramMB = this.preset === 'ultra' || this.sceneMode === 'vram_fill' ? 16384 : 12288;
      const textureVramMB = Math.round(
        allocatedVramMB * (0.55 + Math.sin(elapsedSec * 0.1) * 0.08 + (this.preset === 'ultra' ? 0.25 : 0.1))
      );
      const thermalThrottleActive = effectiveTempC >= 80;
      const coreClockMhz = thermalThrottleActive ? 1750 : 2550;

      this.telemetry.push({
        timeSec: Number(elapsedSec.toFixed(1)),
        fps: curFps,
        frameTimeMs: Number(avgFrameMs.toFixed(2)),
        stabilityPct,
        estTempC: effectiveTempC,
        allocatedVramMB,
        textureVramMB,
        coreClockMhz,
        thermalThrottle: thermalThrottleActive,
      });
      if (this.telemetry.length > 300) this.telemetry.shift();

      const thermalThrottleRecent60s = this.telemetry.some((t) => t.thermalThrottle);

      const sceneFactor =
        this.sceneMode === 'raymarching' ||
        this.sceneMode === 'menger_sponge' ||
        this.sceneMode === 'volumetric_nebula' ||
        this.sceneMode === 'blackhole_lensing' ||
        this.sceneMode === 'volumetric_clouds_4k'
          ? 2.25
          : this.sceneMode === 'furmark'
            ? 1.95
            : this.sceneMode === 'fluid_plasma'
              ? 1.85
              : this.sceneMode === 'geometry'
                ? 1.75
                : this.sceneMode === 'cyber_city' || this.sceneMode === 'crystal_caustics'
                  ? 1.65
                  : this.sceneMode === 'vram_fill'
                    ? 1.6
                    : this.sceneMode === 'galaxy' ||
                        this.sceneMode === 'neural_lattice' ||
                        this.sceneMode === 'dna_megastructure'
                      ? 1.45
                      : 1.35;
      const loadMultiplier =
        (this.preset === 'ultra' ? 1.65 : this.preset === 'extreme' ? 1.35 : this.preset === 'high' ? 1.1 : 0.9) *
        sceneFactor;
      const refFps = this.fpsMode === 'uncapped' ? 180 : 60;
      const score = Math.max(
        10,
        Math.min(100, Math.round((avgFps / refFps) * 70 * loadMultiplier + stabilityPct * 0.3))
      );

      let verdict: GpuStressMetrics['verdict'] = 'STABILNY';
      if (stabilityPct < 75 || (low1PctFps < 15 && avgFps < 22)) verdict = 'THROTTLING / PRZECIĄŻENIE';
      else if (stabilityPct < 84 || avgFps < 28) verdict = 'LEKKI SPADEK';

      const meta = this.getSceneMeta(this.sceneMode);
      const triCount = this.renderer.info.render.triangles;
      const sz = new THREE.Vector2();
      this.renderer.getDrawingBufferSize(sz);
      const pixels = Math.max(640 * 360, sz.x * sz.y);
      const shaderFlopsPerPx = isHeavy ? 24800 : 8600;
      const fp32Ops = curFps * (pixels * shaderFlopsPerPx + triCount * 420);
      const estFp32Tflops = Number((fp32Ops / 1e12).toFixed(2));
      const vramFillrateGBs = Number(((curFps * pixels * 32) / 1e9).toFixed(1));

      this.metrics = {
        running: true,
        sceneMode: this.sceneMode,
        sceneLabel: meta.name,
        workloadNote: meta.targetUnit,
        preset: this.preset,
        fpsMode: this.fpsMode,
        instanceCount: this.metrics.instanceCount,
        triangles: triCount,
        drawCalls: this.renderer.info.render.calls,
        fps: curFps,
        avgFps,
        minFps,
        maxFps,
        low1PctFps,
        totalFramesRendered: this.totalFramesRendered,
        frameTimeMs: Number(avgFrameMs.toFixed(2)),
        stabilityPct,
        estTempC: this.estTempC,
        peakTempC: this.peakTempC,
        elapsedSec: Number(elapsedSec.toFixed(1)),
        isSoftwareGl: this.isSoftwareGl,
        rendererName: this.rendererName,
        renderWidth: Math.round(sz.x),
        renderHeight: Math.round(sz.y),
        renderScalePct: Math.round(this.renderScale * 100),
        adaptiveThrottleActive: this.adaptiveThrottleActive,
        allocatedVramMB,
        textureVramMB,
        coreClockMhz,
        thermalThrottleActive,
        thermalThrottleRecent60s,
        telemetry: [...this.telemetry],
        overallScore: score,
        estFp32Tflops,
        vramFillrateGBs,
        verdict,
      };
      this.updateOsdOverlay();
      this.emitMetrics();
    }
  }

  private handleResize(): void {
    if (!this.mountEl || !this.renderer || !this.camera) return;
    const w = Math.max(320, this.mountEl.clientWidth);
    const h = Math.max(260, this.mountEl.clientHeight);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.applyRenderScale(false);
    if (!this.running && this.scene) {
      this.renderSingleFrame();
    }
    this.updateOsdOverlay();
  }

  private emitMetrics(): void {
    if (this.onMetrics) {
      this.onMetrics(this.getMetrics());
    }
  }

  public unmount(): void {
    this.stop();
    if (this.fsChangeListener) {
      document.removeEventListener('fullscreenchange', this.fsChangeListener);
      this.fsChangeListener = null;
    }
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    this.clearActiveGroup();
    if (this.backdropDome) {
      this.backdropDome.geometry.dispose();
      this.backdropDome.removeFromParent();
      this.backdropDome = null;
    }
    this.backdropMat?.dispose();
    this.backdropMat = null;
    this.composer?.dispose();
    this.composer = null;
    this.composerRT?.dispose();
    this.composerRT = null;
    this.bloomPass?.dispose();
    this.bloomPass = null;
    this.cinematicPass?.dispose();
    this.cinematicPass = null;
    this.renderPass = null;
    this.envRenderTarget?.dispose();
    this.envRenderTarget = null;
    this.renderer?.dispose();
    this.renderer = null;
    this.scene = null;
    this.camera = null;
    this.raymarchOrthoCam = null;
    this.osdEl = null;
    this.fsBtnEl = null;
    this.postFxBtnEl = null;
    this.osdToggleBtnEl = null;
    this.fsStartStopBtnEl = null;
    this.fsPrevBtnEl = null;
    this.fsNextBtnEl = null;
    this.mountEl = null;
  }
}

export const gpuStressEngine = new GpuStressEngine();
