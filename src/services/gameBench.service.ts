import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import {
  GameAiProfile,
  GameBenchMetrics,
  GameFpsCap,
  GameQualityPreset,
  GameSceneId,
  GameToneMappingMode,
  GpuFpsMode,
  GpuTelemetryPoint,
} from '../types';
import { thermalMonitorService } from './thermalMonitor.service';
import {
  createArchitecturePbrTextures,
  createArticulatedSoccerPlayer,
  createContactShadowTexture,
  createDetailedAircraftModel,
  createDetailedRaceCarModel,
  createRacingTrackTextures,
  FlightStyle,
  VehicleStyle,
} from './gameVehicleModels';

export interface GamePresetConfig {
  label: string;
  drones: number;
  particles: number;
  towers: number;
  shadowSize: number;
  renderScale: number;
  bloomStrength: number;
  raymarchSteps: number;
  refFps: number;
}

export interface GameCatalogItem {
  id: GameSceneId;
  title: string;
  shortTitle: string;
  genre: string;
  badge: string;
  description: string;
  skyBaseTop: number;
  skyBaseBottom: number;
  nebulaColA: [number, number, number];
  nebulaColB: [number, number, number];
  nebulaColC: [number, number, number];
  coreColA: [number, number, number];
  coreColB: [number, number, number];
  floorColor: number;
  gridColor: string;
  gridBorder: string;
  fogColor: number;
  lightPalette: [number, number, number, number];
  layoutMode:
    | 'orbital'
    | 'corridor'
    | 'volcanic'
    | 'colosseum'
    | 'abyss'
    | 'asteroid'
    | 'dyson'
    | 'supernova'
    | 'skyland'
    | 'clockwork'
    | 'glacial'
    | 'biohive'
    | 'stargate'
    | 'mainframe'
    | 'eclipse'
    | 'orbital_cannon'
    | 'valhalla'
    | 'foundry'
    | 'corona'
    | 'tartarus'
    | 'ringworld'
    | 'phantasm'
    | 'excalibur'
    | 'singularity'
    | 'formula_gp'
    | 'drift_touge'
    | 'maglev_track'
    | 'dakar_rally'
    | 'bugatti_hypercar'
    | 'snow_rally'
    | 'soccer_stadium'
    | 'f22_jet'
    | 'sr71_plane'
    | 'apache_heli';
}

export const GAME_CATALOG: GameCatalogItem[] = [
  {
    id: 'hyperion',
    title: 'HYPERION: Orbital Singularity',
    shortTitle: 'HYPERION Singularity',
    genre: 'Space Dogfight & Raymarch Core',
    badge: 'SCI-FI MAX',
    description: 'Bitwa orbitalna wokół kwantowej osobliwości z wolumetryczną mgławicą i 24 000 myśliwców.',
    skyBaseTop: 0x01030a,
    skyBaseBottom: 0x050b1e,
    nebulaColA: [0.02, 0.34, 0.68],
    nebulaColB: [0.58, 0.14, 0.52],
    nebulaColC: [0.95, 0.42, 0.12],
    coreColA: [0.05, 0.78, 0.96],
    coreColB: [0.98, 0.42, 0.14],
    floorColor: 0x101828,
    gridColor: 'rgba(14, 165, 233, 0.25)',
    gridBorder: 'rgba(249, 115, 22, 0.18)',
    fogColor: 0x040814,
    lightPalette: [0x06b6d4, 0xf97316, 0x8b5cf6, 0x10b981],
    layoutMode: 'orbital',
  },
  {
    id: 'cyber_racer',
    title: 'NEON OVERDRIVE: Cyber-Metropolis 2099',
    shortTitle: 'NEON OVERDRIVE 2099',
    genre: 'Cyberpunk High-Speed Pursuit',
    badge: 'CYBERPUNK',
    description: 'Nocny pościg bojowy przez kaniony neonowej metropolii, hologramy, mokry asfalt PBR i tysiące ścigaczy.',
    skyBaseTop: 0x05010d,
    skyBaseBottom: 0x160526,
    nebulaColA: [0.92, 0.08, 0.55],
    nebulaColB: [0.04, 0.82, 0.96],
    nebulaColC: [0.62, 0.15, 0.95],
    coreColA: [0.96, 0.12, 0.62],
    coreColB: [0.06, 0.92, 0.98],
    floorColor: 0x0c0718,
    gridColor: 'rgba(236, 72, 153, 0.30)',
    gridBorder: 'rgba(6, 182, 212, 0.25)',
    fogColor: 0x090314,
    lightPalette: [0xec4899, 0x06b6d4, 0xa855f7, 0x3b82f6],
    layoutMode: 'corridor',
  },
  {
    id: 'exoplanet_raid',
    title: 'TITANFALL: Lava Exoplanet Raid',
    shortTitle: 'TITANFALL Lava Raid',
    genre: 'Volcanic Planetary Assault',
    badge: 'VOLCANIC 4K',
    description: 'Szturm nad wulkaniczną egzoplanetą z rzekami wrzącej magmy, bazaltowymi iglicami i burzą popiołu.',
    skyBaseTop: 0x0b0202,
    skyBaseBottom: 0x240704,
    nebulaColA: [0.85, 0.18, 0.04],
    nebulaColB: [0.98, 0.52, 0.08],
    nebulaColC: [0.45, 0.06, 0.08],
    coreColA: [0.98, 0.35, 0.06],
    coreColB: [1.0, 0.78, 0.15],
    floorColor: 0x180a08,
    gridColor: 'rgba(249, 115, 22, 0.28)',
    gridBorder: 'rgba(239, 68, 68, 0.24)',
    fogColor: 0x140504,
    lightPalette: [0xf97316, 0xef4444, 0xeab308, 0xf43f5e],
    layoutMode: 'volcanic',
  },
  {
    id: 'quantum_arena',
    title: 'NEXUS CORE: Mech Combat Arena',
    shortTitle: 'NEXUS Mech Arena',
    genre: 'Heavy Mecha Colosseum',
    badge: 'MECHA ARENA',
    description: 'Koloseum bojowe ciężkich mechów z reaktorem łukowym Tesli, barierami plazmowymi i artylerią.',
    skyBaseTop: 0x010906,
    skyBaseBottom: 0x041d14,
    nebulaColA: [0.06, 0.78, 0.48],
    nebulaColB: [0.04, 0.52, 0.85],
    nebulaColC: [0.55, 0.95, 0.25],
    coreColA: [0.10, 0.92, 0.58],
    coreColB: [0.22, 0.75, 0.98],
    floorColor: 0x081814,
    gridColor: 'rgba(16, 185, 129, 0.28)',
    gridBorder: 'rgba(56, 189, 248, 0.22)',
    fogColor: 0x03100c,
    lightPalette: [0x10b981, 0x06b6d4, 0x84cc16, 0x3b82f6],
    layoutMode: 'colosseum',
  },
  {
    id: 'abyssal_fleet',
    title: 'LEVIATHAN: Deep Trench Odyssey',
    shortTitle: 'LEVIATHAN Deep Trench',
    genre: 'Bioluminescent Abyssal Warfare',
    badge: 'ABYSSAL 3D',
    description: 'Bitwa w bioluminescencyjnym rowie oceanicznym z kaustyką, kryształami głębinowymi i ławicą bio-dronów.',
    skyBaseTop: 0x010712,
    skyBaseBottom: 0x03192e,
    nebulaColA: [0.02, 0.58, 0.75],
    nebulaColB: [0.08, 0.88, 0.72],
    nebulaColC: [0.28, 0.35, 0.95],
    coreColA: [0.05, 0.95, 0.82],
    coreColB: [0.25, 0.52, 0.98],
    floorColor: 0x061524,
    gridColor: 'rgba(45, 212, 191, 0.26)',
    gridBorder: 'rgba(59, 130, 246, 0.22)',
    fogColor: 0x020d1a,
    lightPalette: [0x14b8a6, 0x0ea5e9, 0x6366f1, 0x22d3ee],
    layoutMode: 'abyss',
  },
  {
    id: 'void_armada',
    title: 'DREADNOUGHT: Asteroid Belt Siege',
    shortTitle: 'DREADNOUGHT Armada',
    genre: 'Capital Ship & Asteroid Siege',
    badge: 'ARMADA SIEGE',
    description: 'Oblężenie floty krążowników w gęstym pasie asteroid z obracającymi się głazami i ostrzałem laserowym.',
    skyBaseTop: 0x06040c,
    skyBaseBottom: 0x161124,
    nebulaColA: [0.52, 0.28, 0.88],
    nebulaColB: [0.88, 0.62, 0.18],
    nebulaColC: [0.22, 0.48, 0.85],
    coreColA: [0.75, 0.42, 0.98],
    coreColB: [0.96, 0.75, 0.22],
    floorColor: 0x120f1d,
    gridColor: 'rgba(168, 85, 247, 0.24)',
    gridBorder: 'rgba(234, 179, 8, 0.20)',
    fogColor: 0x080610,
    lightPalette: [0xa855f7, 0xeab308, 0x38bdf8, 0xf43f5e],
    layoutMode: 'asteroid',
  },
  {
    id: 'mecha_citadel',
    title: 'VALKYRIE: Orbital Dyson Sphere',
    shortTitle: 'VALKYRIE Dyson Ring',
    genre: 'Dyson Megastructure Defense',
    badge: 'DYSON RING',
    description: 'Obrona megastruktury Sfery Dysona przechwytującej energię gwiazdy z pierścieniami kolektorów.',
    skyBaseTop: 0x080602,
    skyBaseBottom: 0x1f1606,
    nebulaColA: [0.95, 0.68, 0.12],
    nebulaColB: [0.12, 0.65, 0.92],
    nebulaColC: [0.92, 0.32, 0.12],
    coreColA: [1.0, 0.82, 0.22],
    coreColB: [0.15, 0.82, 0.98],
    floorColor: 0x17140d,
    gridColor: 'rgba(245, 158, 11, 0.28)',
    gridBorder: 'rgba(56, 189, 248, 0.22)',
    fogColor: 0x0d0a04,
    lightPalette: [0xf59e0b, 0x38bdf8, 0xf97316, 0x10b981],
    layoutMode: 'dyson',
  },
  {
    id: 'solar_storm',
    title: 'HELIOS: Supernova Shockwave',
    shortTitle: 'HELIOS Supernova',
    genre: 'Extreme Shader & Particle Stress',
    badge: 'EXTREME GPU',
    description: 'Wybuch supernowej z ekstremalnym raymarchingiem plazmowym, pryzmatycznymi iglicami i falą uderzeniową.',
    skyBaseTop: 0x09020a,
    skyBaseBottom: 0x22061a,
    nebulaColA: [0.96, 0.22, 0.38],
    nebulaColB: [0.98, 0.65, 0.12],
    nebulaColC: [0.58, 0.12, 0.92],
    coreColA: [0.98, 0.24, 0.45],
    coreColB: [1.0, 0.85, 0.25],
    floorColor: 0x160814,
    gridColor: 'rgba(244, 63, 94, 0.28)',
    gridBorder: 'rgba(245, 158, 11, 0.25)',
    fogColor: 0x10040c,
    lightPalette: [0xf43f5e, 0xf59e0b, 0xa855f7, 0x06b6d4],
    layoutMode: 'supernova',
  },
  {
    id: 'aether_sky',
    title: 'AETHER: Sky Archipelago Armada',
    shortTitle: 'AETHER Sky Isles',
    genre: 'Floating Islands & Wind Turbines',
    badge: 'SKY ARMADA',
    description: 'Bitwa powietrzna pomiędzy lewitującymi wyspami z gigantycznym wirnikiem eterycznym i flotą fregat.',
    skyBaseTop: 0x031124,
    skyBaseBottom: 0x0c345c,
    nebulaColA: [0.18, 0.68, 0.95],
    nebulaColB: [0.95, 0.75, 0.28],
    nebulaColC: [0.22, 0.92, 0.72],
    coreColA: [0.25, 0.88, 0.98],
    coreColB: [0.98, 0.82, 0.32],
    floorColor: 0x0a2138,
    gridColor: 'rgba(56, 189, 248, 0.25)',
    gridBorder: 'rgba(251, 191, 36, 0.22)',
    fogColor: 0x071a30,
    lightPalette: [0x38bdf8, 0xfbbf24, 0x34d399, 0x60a5fa],
    layoutMode: 'skyland',
  },
  {
    id: 'chronos_rift',
    title: 'CHRONOS: Temporal Clockwork Rift',
    shortTitle: 'CHRONOS Time Rift',
    genre: 'Temporal Astrolabe & Time Shards',
    badge: 'CHRONO 4D',
    description: 'Anomalia czasoprzestrzenna z monumentalnym mechanizmem zegarowym Astrolabium i odłamkami czasu.',
    skyBaseTop: 0x0c0802,
    skyBaseBottom: 0x241906,
    nebulaColA: [0.92, 0.72, 0.18],
    nebulaColB: [0.18, 0.78, 0.88],
    nebulaColC: [0.75, 0.38, 0.12],
    coreColA: [0.98, 0.82, 0.25],
    coreColB: [0.22, 0.92, 0.95],
    floorColor: 0x161108,
    gridColor: 'rgba(251, 191, 36, 0.28)',
    gridBorder: 'rgba(34, 211, 238, 0.22)',
    fogColor: 0x100b04,
    lightPalette: [0xfbbf24, 0x22d3ee, 0xf59e0b, 0xa855f7],
    layoutMode: 'clockwork',
  },
  {
    id: 'cryo_glacier',
    title: 'CRYO-ZERO: Glacial Monolith Core',
    shortTitle: 'CRYO-ZERO Glacier',
    genre: 'Sub-Zero Ice Fortress & Blizzard',
    badge: 'CRYO PBR',
    description: 'Zlodowaciała cytadela arktyczna z krystalicznym monolitem lodu, stalagmitami i zamiecią dronów krio.',
    skyBaseTop: 0x020c1b,
    skyBaseBottom: 0x092948,
    nebulaColA: [0.22, 0.82, 0.98],
    nebulaColB: [0.65, 0.92, 1.0],
    nebulaColC: [0.35, 0.45, 0.95],
    coreColA: [0.45, 0.92, 1.0],
    coreColB: [0.85, 0.96, 1.0],
    floorColor: 0x0b2239,
    gridColor: 'rgba(125, 211, 252, 0.30)',
    gridBorder: 'rgba(56, 189, 248, 0.25)',
    fogColor: 0x061628,
    lightPalette: [0x7dd3fc, 0x38bdf8, 0x818cf8, 0x2dd4bf],
    layoutMode: 'glacial',
  },
  {
    id: 'xeno_hive',
    title: 'XENO-PRIME: Alien Bio-Hive Spire',
    shortTitle: 'XENO Bio-Hive',
    genre: 'Organic Alien Hive & Spore Swarm',
    badge: 'BIO-XENO',
    description: 'Biologiczne gniazdo obcej cywilizacji z pulsującym rdzeniem zarodnikowym, mackami i rojem bio-myśliwców.',
    skyBaseTop: 0x050d02,
    skyBaseBottom: 0x142806,
    nebulaColA: [0.45, 0.92, 0.12],
    nebulaColB: [0.78, 0.18, 0.88],
    nebulaColC: [0.12, 0.82, 0.45],
    coreColA: [0.55, 0.98, 0.15],
    coreColB: [0.88, 0.25, 0.95],
    floorColor: 0x0c1906,
    gridColor: 'rgba(132, 204, 22, 0.28)',
    gridBorder: 'rgba(192, 38, 211, 0.24)',
    fogColor: 0x081204,
    lightPalette: [0x84cc16, 0xd946ef, 0x10b981, 0xeab308],
    layoutMode: 'biohive',
  },
  {
    id: 'warp_gate',
    title: 'VALHALLA: Intergalactic Warp Gate',
    shortTitle: 'VALHALLA Stargate',
    genre: 'Hyperspace Portal Ring & Fleet',
    badge: 'WARP GATE',
    description: 'Międzygalaktyczne wrota skokowe o średnicy 34m z horyzontem zdarzeń i przelatującymi eskadrami.',
    skyBaseTop: 0x020414,
    skyBaseBottom: 0x091038,
    nebulaColA: [0.22, 0.48, 0.98],
    nebulaColB: [0.06, 0.92, 0.85],
    nebulaColC: [0.68, 0.25, 0.98],
    coreColA: [0.18, 0.75, 1.0],
    coreColB: [0.08, 0.98, 0.88],
    floorColor: 0x080d24,
    gridColor: 'rgba(59, 130, 246, 0.28)',
    gridBorder: 'rgba(20, 184, 166, 0.24)',
    fogColor: 0x040718,
    lightPalette: [0x3b82f6, 0x14b8a6, 0x8b5cf6, 0x38bdf8],
    layoutMode: 'stargate',
  },
  {
    id: 'omega_core',
    title: 'OMEGA-AI: Quantum Matrix Mainframe',
    shortTitle: 'OMEGA AI Matrix',
    genre: 'Cybernetic AI Supercomputer Core',
    badge: 'AI MATRIX',
    description: 'Wnętrze superkomputera kwantowego OMEGA-AI z hipersześcianem danych i kolumnami światłowodowymi.',
    skyBaseTop: 0x020a08,
    skyBaseBottom: 0x04221a,
    nebulaColA: [0.04, 0.92, 0.65],
    nebulaColB: [0.06, 0.72, 0.96],
    nebulaColC: [0.95, 0.22, 0.45],
    coreColA: [0.06, 0.98, 0.72],
    coreColB: [0.12, 0.82, 0.98],
    floorColor: 0x041410,
    gridColor: 'rgba(16, 185, 129, 0.32)',
    gridBorder: 'rgba(6, 182, 212, 0.26)',
    fogColor: 0x020c09,
    lightPalette: [0x10b981, 0x06b6d4, 0xf43f5e, 0x34d399],
    layoutMode: 'mainframe',
  },
  {
    id: 'dark_eclipse',
    title: 'ECLIPSE: Black Sun Gravitational Lens',
    shortTitle: 'ECLIPSE Black Sun',
    genre: 'Dark Star Eclipse & Shadow Fleet',
    badge: 'DARK ECLIPSE',
    description: 'Zaćmienie czarnego słońca z ognistą koroną grawitacyjną, pierścieniem fotonowym i flotą cieni.',
    skyBaseTop: 0x040108,
    skyBaseBottom: 0x12031c,
    nebulaColA: [0.95, 0.38, 0.08],
    nebulaColB: [0.55, 0.12, 0.85],
    nebulaColC: [0.98, 0.75, 0.18],
    coreColA: [0.98, 0.45, 0.08],
    coreColB: [0.72, 0.18, 0.96],
    floorColor: 0x0a0410,
    gridColor: 'rgba(249, 115, 22, 0.26)',
    gridBorder: 'rgba(168, 85, 247, 0.24)',
    fogColor: 0x06020a,
    lightPalette: [0xf97316, 0xa855f7, 0xfbbf24, 0xec4899],
    layoutMode: 'eclipse',
  },
  {
    id: 'ragnarok_siege',
    title: 'RAGNAROK: Planetary Orbital Cannon',
    shortTitle: 'RAGNAROK Railgun',
    genre: 'Planetary Railgun & Drop-Pod Siege',
    badge: 'HEAVY SIEGE',
    description: 'Kolosalne planetarne działo elektromagnetyczne strzelające na orbitę wśród desantu kapsuł bojowych.',
    skyBaseTop: 0x0a0304,
    skyBaseBottom: 0x22080c,
    nebulaColA: [0.92, 0.15, 0.22],
    nebulaColB: [0.22, 0.68, 0.95],
    nebulaColC: [0.96, 0.55, 0.12],
    coreColA: [0.98, 0.18, 0.28],
    coreColB: [0.25, 0.78, 0.98],
    floorColor: 0x14080a,
    gridColor: 'rgba(239, 68, 68, 0.28)',
    gridBorder: 'rgba(56, 189, 248, 0.24)',
    fogColor: 0x0d0406,
    lightPalette: [0xef4444, 0x38bdf8, 0xf97316, 0xeab308],
    layoutMode: 'orbital_cannon',
  },
  {
    id: 'valhalla_fleet',
    title: 'VALKYRIE ARMADA: Bifrost Star-Carrier',
    shortTitle: 'VALKYRIE Star-Carrier',
    genre: 'Dual-Hull Carrier & Interceptor Launch',
    badge: 'CARRIER 3D',
    description: 'Dwukadłubowy lotniskowiec gwiezdny z tęczowym mostem plazmowym Bifrost i katapultami myśliwców.',
    skyBaseTop: 0x020618,
    skyBaseBottom: 0x091a3a,
    nebulaColA: [0.15, 0.65, 0.98],
    nebulaColB: [0.95, 0.55, 0.18],
    nebulaColC: [0.45, 0.25, 0.95],
    coreColA: [0.22, 0.85, 1.0],
    coreColB: [0.98, 0.68, 0.22],
    floorColor: 0x071126,
    gridColor: 'rgba(56, 189, 248, 0.28)',
    gridBorder: 'rgba(245, 158, 11, 0.24)',
    fogColor: 0x040b1c,
    lightPalette: [0x38bdf8, 0xf59e0b, 0x818cf8, 0x2dd4bf],
    layoutMode: 'valhalla',
  },
  {
    id: 'nemesis_foundry',
    title: 'NEMESIS: Automated Cyber-Foundry',
    shortTitle: 'NEMESIS Foundry',
    genre: 'Molten Steel Smelter & Robotic Arms',
    badge: 'FOUNDRY 4K',
    description: 'Gigantyczna huta orbitalna z kadzią płynnego tytanu, młotami kuźniczymi i rojem dronów spawalniczych.',
    skyBaseTop: 0x0d0401,
    skyBaseBottom: 0x260c03,
    nebulaColA: [0.98, 0.42, 0.06],
    nebulaColB: [0.95, 0.75, 0.15],
    nebulaColC: [0.35, 0.38, 0.45],
    coreColA: [1.0, 0.52, 0.08],
    coreColB: [1.0, 0.88, 0.25],
    floorColor: 0x180904,
    gridColor: 'rgba(249, 115, 22, 0.30)',
    gridBorder: 'rgba(250, 204, 21, 0.24)',
    fogColor: 0x120602,
    lightPalette: [0xf97316, 0xfacc15, 0xef4444, 0x38bdf8],
    layoutMode: 'foundry',
  },
  {
    id: 'solaris_corona',
    title: 'SOLARIS: Magnetar Flare Prominence',
    shortTitle: 'SOLARIS Magnetar',
    genre: 'Magnetic Arch Loops & Plasma Rain',
    badge: 'MAGNETAR',
    description: 'Powierzchnia magnetara z kolosalnymi łukami protuberancji słonecznych i deszczem koronalnym.',
    skyBaseTop: 0x100205,
    skyBaseBottom: 0x2b0710,
    nebulaColA: [0.98, 0.25, 0.15],
    nebulaColB: [0.98, 0.78, 0.12],
    nebulaColC: [0.85, 0.12, 0.55],
    coreColA: [1.0, 0.65, 0.12],
    coreColB: [0.98, 0.18, 0.35],
    floorColor: 0x1a060a,
    gridColor: 'rgba(251, 146, 60, 0.30)',
    gridBorder: 'rgba(244, 63, 94, 0.25)',
    fogColor: 0x140408,
    lightPalette: [0xfb923c, 0xf43f5e, 0xfacc15, 0xe879f9],
    layoutMode: 'corona',
  },
  {
    id: 'tartarus_abyss',
    title: 'TARTARUS: Subterranean Magma Drill',
    shortTitle: 'TARTARUS Core Drill',
    genre: 'Planetary Mantle Excavator & Lasers',
    badge: 'CORE DRILL',
    description: 'Podziemny świder planetarny drążący płaszcz Ziemi z obracającą się głowicą plazmową i odłamkami skał.',
    skyBaseTop: 0x090304,
    skyBaseBottom: 0x1f080a,
    nebulaColA: [0.92, 0.18, 0.12],
    nebulaColB: [0.96, 0.58, 0.08],
    nebulaColC: [0.45, 0.12, 0.28],
    coreColA: [0.98, 0.28, 0.12],
    coreColB: [1.0, 0.75, 0.18],
    floorColor: 0x140607,
    gridColor: 'rgba(239, 68, 68, 0.30)',
    gridBorder: 'rgba(245, 158, 11, 0.24)',
    fogColor: 0x0e0405,
    lightPalette: [0xef4444, 0xf59e0b, 0xf97316, 0xa855f7],
    layoutMode: 'tartarus',
  },
  {
    id: 'zephyr_ringworld',
    title: 'ZEPHYR: Halcyon Orbital Ringworld',
    shortTitle: 'ZEPHYR Ringworld',
    genre: 'Artificial Halo Habitat & Defense Fleet',
    badge: 'RINGWORLD',
    description: 'Sztuczny świat-pierścień o promieniu orbitalnym z wewnętrznym ekosystemem, wieżami atmosferycznymi i flotą.',
    skyBaseTop: 0x020f14,
    skyBaseBottom: 0x072b36,
    nebulaColA: [0.08, 0.85, 0.72],
    nebulaColB: [0.18, 0.62, 0.96],
    nebulaColC: [0.55, 0.95, 0.35],
    coreColA: [0.12, 0.95, 0.78],
    coreColB: [0.28, 0.75, 1.0],
    floorColor: 0x061d24,
    gridColor: 'rgba(45, 212, 191, 0.28)',
    gridBorder: 'rgba(56, 189, 248, 0.24)',
    fogColor: 0x031318,
    lightPalette: [0x2dd4bf, 0x38bdf8, 0x4ade80, 0x818cf8],
    layoutMode: 'ringworld',
  },
  {
    id: 'phantasm_nebula',
    title: 'PHANTASM: Psionic Eldritch Cathedral',
    shortTitle: 'PHANTASM Void Spire',
    genre: 'Dimensional Rift & Floating Obelisks',
    badge: 'VOID RIFT',
    description: 'Katedra próżni psionicznej z lewitującymi gotyckimi łukami, okiem wymiarowym i widmowymi myśliwcami.',
    skyBaseTop: 0x070112,
    skyBaseBottom: 0x1a0436,
    nebulaColA: [0.68, 0.15, 0.96],
    nebulaColB: [0.95, 0.12, 0.58],
    nebulaColC: [0.18, 0.75, 0.96],
    coreColA: [0.78, 0.22, 1.0],
    coreColB: [0.98, 0.18, 0.65],
    floorColor: 0x100422,
    gridColor: 'rgba(192, 132, 252, 0.30)',
    gridBorder: 'rgba(244, 114, 182, 0.25)',
    fogColor: 0x0a0217,
    lightPalette: [0xc084fc, 0xf472b6, 0x38bdf8, 0xa855f7],
    layoutMode: 'phantasm',
  },
  {
    id: 'excalibur_citadel',
    title: 'EXCALIBUR: Solar Lance Star-Fortress',
    shortTitle: 'EXCALIBUR Citadel',
    genre: 'Orbital Sword Spire & Shield Matrix',
    badge: 'STAR CITADEL',
    description: 'Gwiezdna cytadela w kształcie pionowego ostrza świetlnego z barierami heksagonalnymi i eskadrami strażników.',
    skyBaseTop: 0x030916,
    skyBaseBottom: 0x0d2142,
    nebulaColA: [0.96, 0.78, 0.22],
    nebulaColB: [0.22, 0.68, 0.98],
    nebulaColC: [0.95, 0.95, 1.0],
    coreColA: [1.0, 0.85, 0.28],
    coreColB: [0.35, 0.82, 1.0],
    floorColor: 0x09162b,
    gridColor: 'rgba(251, 191, 36, 0.30)',
    gridBorder: 'rgba(56, 189, 248, 0.26)',
    fogColor: 0x050e1c,
    lightPalette: [0xfbbf24, 0x38bdf8, 0xf8fafc, 0x60a5fa],
    layoutMode: 'excalibur',
  },
  {
    id: 'omega_singularity',
    title: 'OMEGA-ZERO: Multiverse Wormhole Nexus',
    shortTitle: 'OMEGA Wormhole',
    genre: 'Twin Black-Hole Binary Merger',
    badge: 'MULTIVERSE',
    description: 'Zderzenie układu podwójnego osobliwości kwantowych połączonych mostem Einsteina-Rosena i falami grawitacyjnymi.',
    skyBaseTop: 0x02020c,
    skyBaseBottom: 0x0a0828,
    nebulaColA: [0.12, 0.88, 0.96],
    nebulaColB: [0.96, 0.22, 0.65],
    nebulaColC: [0.55, 0.28, 0.98],
    coreColA: [0.15, 0.95, 1.0],
    coreColB: [0.98, 0.25, 0.72],
    floorColor: 0x07061c,
    gridColor: 'rgba(34, 211, 238, 0.30)',
    gridBorder: 'rgba(236, 72, 153, 0.26)',
    fogColor: 0x040312,
    lightPalette: [0x22d3ee, 0xec4899, 0xa855f7, 0x38bdf8],
    layoutMode: 'singularity',
  },
  {
    id: 'formula_cyber_gp',
    title: 'FORMULA CYBER-GP: Night Circuit 3000 (Wyścigi 3D)',
    shortTitle: 'WYŚCIGI: Formula GP',
    genre: '3D Racing Circuit · Sterowanie A/D + Nitro Shift',
    badge: 'WYŚCIGI F1',
    description: 'Nocny tor wyścigowy Grand Prix z bolidem gracza 3D, tarkami wyścigowymi, bramkami DRS i 24 000 rywali (Steruj A/D + Shift Nitro!).',
    skyBaseTop: 0x020510,
    skyBaseBottom: 0x08152e,
    nebulaColA: [0.06, 0.78, 0.98],
    nebulaColB: [0.98, 0.18, 0.35],
    nebulaColC: [0.98, 0.75, 0.12],
    coreColA: [0.08, 0.88, 1.0],
    coreColB: [1.0, 0.22, 0.42],
    floorColor: 0x0b101b,
    gridColor: 'rgba(56, 189, 248, 0.32)',
    gridBorder: 'rgba(239, 68, 68, 0.38)',
    fogColor: 0x040914,
    lightPalette: [0x38bdf8, 0xef4444, 0xfacc15, 0x10b981],
    layoutMode: 'formula_gp',
  },
  {
    id: 'tokyo_drift_touge',
    title: 'TOKYO OVERDRIVE: Shinjuku Touge Drift (Wyścigi 3D)',
    shortTitle: 'WYŚCIGI: Tokyo Drift',
    genre: 'Street Drift Racing · Sterowanie A/D + Nitro Shift',
    badge: 'DRIFT 3D',
    description: 'Uliczny wyścig i drift przez neonową autostradę Wangan w Tokio z mokrym asfaltem PBR, bramkami pomiaru prędkości i ruchem ulicznym.',
    skyBaseTop: 0x070112,
    skyBaseBottom: 0x1c0532,
    nebulaColA: [0.96, 0.12, 0.62],
    nebulaColB: [0.08, 0.88, 0.96],
    nebulaColC: [0.68, 0.18, 0.98],
    coreColA: [1.0, 0.15, 0.68],
    coreColB: [0.12, 0.95, 1.0],
    floorColor: 0x090514,
    gridColor: 'rgba(236, 72, 153, 0.34)',
    gridBorder: 'rgba(34, 211, 238, 0.32)',
    fogColor: 0x080212,
    lightPalette: [0xec4899, 0x22d3ee, 0xa855f7, 0xfbbf24],
    layoutMode: 'drift_touge',
  },
  {
    id: 'maglev_wipeout',
    title: 'F-ZERO MAGLEV: Anti-Gravity 1200 km/h (Wyścigi 3D)',
    shortTitle: 'WYŚCIGI: F-Zero Maglev',
    genre: 'Hypersonic AG-Racing · Sterowanie A/D + Nitro Shift',
    badge: 'AG-RACING',
    description: 'Naddźwiękowy wyścig ścigaczy antygrawitacyjnych na magnetycznym torze pętlowym z tunelami przyspieszenia plazmowego 1200 km/h.',
    skyBaseTop: 0x010914,
    skyBaseBottom: 0x04243c,
    nebulaColA: [0.04, 0.95, 0.78],
    nebulaColB: [0.18, 0.55, 0.98],
    nebulaColC: [0.98, 0.52, 0.12],
    coreColA: [0.08, 0.98, 0.85],
    coreColB: [0.25, 0.68, 1.0],
    floorColor: 0x041624,
    gridColor: 'rgba(45, 212, 191, 0.35)',
    gridBorder: 'rgba(56, 189, 248, 0.32)',
    fogColor: 0x020f1a,
    lightPalette: [0x2dd4bf, 0x38bdf8, 0xf97316, 0x818cf8],
    layoutMode: 'maglev_track',
  },
  {
    id: 'dakar_desert_storm',
    title: 'DAKAR APEX: Red Canyon Rally Raid (Wyścigi 3D)',
    shortTitle: 'WYŚCIGI: Dakar Rally',
    genre: 'Off-Road Desert Rally · Sterowanie A/D + Nitro Shift',
    badge: 'RALLY 4K',
    description: 'Ekstremalny rajd terenowy przez skaliste kaniony i czerwone wydmy z realistycznym zawieszeniem terenowym 4x4.',
    skyBaseTop: 0x160803,
    skyBaseBottom: 0x3b1707,
    nebulaColA: [0.96, 0.48, 0.12],
    nebulaColB: [0.98, 0.78, 0.22],
    nebulaColC: [0.75, 0.22, 0.08],
    coreColA: [0.98, 0.58, 0.14],
    coreColB: [1.0, 0.85, 0.28],
    floorColor: 0x241006,
    gridColor: 'rgba(249, 115, 22, 0.30)',
    gridBorder: 'rgba(250, 204, 21, 0.28)',
    fogColor: 0x1e0e06,
    lightPalette: [0xf97316, 0xfacc15, 0xef4444, 0x38bdf8],
    layoutMode: 'dakar_rally',
  },
  {
    id: 'bugatti_hypercar_450',
    title: 'BUGATTI CHIRON SS: Autobahn 450 km/h (Wyścigi 3D)',
    shortTitle: 'WYŚCIGI: Bugatti 450',
    genre: 'Hypercar Autobahn Sprint · Sterowanie A/D + Nitro Shift',
    badge: 'HYPERCAR 4K',
    description: 'Hiper-samochód klasy 450+ km/h na dwupasmowej autostradzie z lakierem Clearcoat 1.0, reflektorami LED i aktywnym spojlerem.',
    skyBaseTop: 0x030816,
    skyBaseBottom: 0x0c1e3e,
    nebulaColA: [0.08, 0.65, 0.98],
    nebulaColB: [0.92, 0.75, 0.25],
    nebulaColC: [0.18, 0.42, 0.88],
    coreColA: [0.12, 0.82, 1.0],
    coreColB: [0.98, 0.82, 0.28],
    floorColor: 0x0b1220,
    gridColor: 'rgba(56, 189, 248, 0.30)',
    gridBorder: 'rgba(250, 204, 21, 0.28)',
    fogColor: 0x071022,
    lightPalette: [0x38bdf8, 0xfacc15, 0xef4444, 0x22d3ee],
    layoutMode: 'bugatti_hypercar',
  },
  {
    id: 'rally_snow_wrc',
    title: 'WRC MONTE CARLO: Alpine Ice & Snow Stage (Wyścigi 3D)',
    shortTitle: 'WYŚCIGI: Snow Rally',
    genre: 'Alpine Winter Rally · Sterowanie A/D + Nitro Shift',
    badge: 'WRC SNOW',
    description: 'Zimowy odcinek specjalny WRC wśród zaśnieżonych Alp z głębokimi bandami śnieżnymi, reflektorami rajdowymi i poślizgiem 4WD.',
    skyBaseTop: 0x061324,
    skyBaseBottom: 0x163252,
    nebulaColA: [0.42, 0.84, 0.98],
    nebulaColB: [0.85, 0.94, 1.0],
    nebulaColC: [0.22, 0.56, 0.92],
    coreColA: [0.48, 0.92, 1.0],
    coreColB: [0.95, 0.98, 1.0],
    floorColor: 0x1e293b,
    gridColor: 'rgba(125, 211, 252, 0.32)',
    gridBorder: 'rgba(249, 115, 22, 0.30)',
    fogColor: 0x0d1b2d,
    lightPalette: [0x38bdf8, 0xf97316, 0xe0f2fe, 0x2dd4bf],
    layoutMode: 'snow_rally',
  },
  {
    id: 'soccer_champions_3d',
    title: 'CHAMPIONS STADIUM 3D: Mecz Piłki Nożnej (Gra 3D)',
    shortTitle: 'PIŁKA NOŻNA: Stadium 3D',
    genre: '3D Arcade Soccer · WASD/Strzałki + Spacja Strzał na Bramkę',
    badge: 'PIŁKA 3D',
    description: 'Prawdziwy stadion piłkarski 3D z murawą PBR, bramkami z siatką, jupiterami i meczem 5v5. Prowadź piłkę WASD i strzelaj Spacją!',
    skyBaseTop: 0x040b1c,
    skyBaseBottom: 0x0b1f3d,
    nebulaColA: [0.06, 0.78, 0.45],
    nebulaColB: [0.12, 0.65, 0.96],
    nebulaColC: [0.96, 0.82, 0.24],
    coreColA: [0.12, 0.92, 0.52],
    coreColB: [0.22, 0.85, 1.0],
    floorColor: 0x14532d,
    gridColor: 'rgba(34, 197, 94, 0.35)',
    gridBorder: 'rgba(255, 255, 255, 0.45)',
    fogColor: 0x071426,
    lightPalette: [0x22c55e, 0x38bdf8, 0xfacc15, 0xef4444],
    layoutMode: 'soccer_stadium',
  },
  {
    id: 'f22_raptor_jet',
    title: 'F-22 RAPTOR: Twilight Canyon Interceptor (Lotnictwo 3D)',
    shortTitle: 'LOTNICTWO: F-22 Raptor',
    genre: 'Supersonic Jet Flight · A/D Beczka + W/S Wznoszenie + Shift Dopalacz',
    badge: 'MYŚLIWIEC 3D',
    description: 'Naddźwiękowy myśliwiec przewagi powietrznej F-22 z podwójnymi dopalaczami plazmowymi lecący nisko przez górski kanion.',
    skyBaseTop: 0x030714,
    skyBaseBottom: 0x172442,
    nebulaColA: [0.15, 0.72, 0.98],
    nebulaColB: [0.98, 0.48, 0.14],
    nebulaColC: [0.45, 0.35, 0.95],
    coreColA: [0.22, 0.85, 1.0],
    coreColB: [0.98, 0.55, 0.16],
    floorColor: 0x0f172a,
    gridColor: 'rgba(56, 189, 248, 0.28)',
    gridBorder: 'rgba(249, 115, 22, 0.26)',
    fogColor: 0x0b152a,
    lightPalette: [0x38bdf8, 0xf97316, 0x818cf8, 0x22d3ee],
    layoutMode: 'f22_jet',
  },
  {
    id: 'sr71_mach_plane',
    title: 'SR-71 BLACKBIRD: Stratospheric Mach 3.3 (Lotnictwo 3D)',
    shortTitle: 'LOTNICTWO: SR-71 Mach 3',
    genre: 'Stratospheric Recon Jet · A/D Ster + W/S Pułap + Shift Mach 3',
    badge: 'STRATOLOT 3D',
    description: 'Stratosferyczny samolot zwiadowczy Mach 3.3 nad krzywizną planety i zorzą polarną z tytanowym kadłubem.',
    skyBaseTop: 0x010208,
    skyBaseBottom: 0x071832,
    nebulaColA: [0.06, 0.88, 0.78],
    nebulaColB: [0.22, 0.48, 0.98],
    nebulaColC: [0.85, 0.22, 0.78],
    coreColA: [0.12, 0.94, 0.84],
    coreColB: [0.35, 0.65, 1.0],
    floorColor: 0x061022,
    gridColor: 'rgba(45, 212, 191, 0.28)',
    gridBorder: 'rgba(59, 130, 246, 0.28)',
    fogColor: 0x030a18,
    lightPalette: [0x2dd4bf, 0x38bdf8, 0xc084fc, 0xfacc15],
    layoutMode: 'sr71_plane',
  },
  {
    id: 'apache_gunship_heli',
    title: 'AH-64 APACHE: Night Recon Helicopter (Lotnictwo 3D)',
    shortTitle: 'LOTNICTWO: Apache Heli',
    genre: 'Tactical Attack Helicopter · A/D Obrót + W/S Pułap + Shift Turbo',
    badge: 'HELIKOPTER',
    description: 'Śmigłowiec szturmowy AH-64 z wirującym 4-łopatowym rotorem głównym, radarem Longbow i nocnym przelotem nad miastem.',
    skyBaseTop: 0x030908,
    skyBaseBottom: 0x0a2118,
    nebulaColA: [0.08, 0.88, 0.48],
    nebulaColB: [0.96, 0.62, 0.14],
    nebulaColC: [0.14, 0.68, 0.92],
    coreColA: [0.12, 0.95, 0.55],
    coreColB: [0.98, 0.72, 0.18],
    floorColor: 0x081610,
    gridColor: 'rgba(16, 185, 129, 0.30)',
    gridBorder: 'rgba(245, 158, 11, 0.26)',
    fogColor: 0x06120d,
    lightPalette: [0x10b981, 0xf59e0b, 0x38bdf8, 0xef4444],
    layoutMode: 'apache_heli',
  },
];

const GAME_PRESETS: Record<GameQualityPreset, GamePresetConfig> = {
  high: {
    label: 'High (1080p)',
    drones: 2200,
    particles: 4000,
    towers: 180,
    shadowSize: 1024,
    renderScale: 1.0,
    bloomStrength: 0.26,
    raymarchSteps: 28,
    refFps: 120,
  },
  ultra: {
    label: 'Ultra MAX',
    drones: 6500,
    particles: 10000,
    towers: 320,
    shadowSize: 2048,
    renderScale: 1.25,
    bloomStrength: 0.32,
    raymarchSteps: 56,
    refFps: 90,
  },
  extreme: {
    label: 'Extreme 4K Raymarch',
    drones: 14000,
    particles: 18000,
    towers: 480,
    shadowSize: 2048,
    renderScale: 1.5,
    bloomStrength: 0.36,
    raymarchSteps: 88,
    refFps: 65,
  },
  nightmare: {
    label: 'NIGHTMARE MAX (8K-Load)',
    drones: 24000,
    particles: 25000,
    towers: 720,
    shadowSize: 4096,
    renderScale: 2.0,
    bloomStrength: 0.4,
    raymarchSteps: 128,
    refFps: 45,
  },
};

const _dummy = new THREE.Object3D();
const _color = new THREE.Color();
const _vFwd = new THREE.Vector3();
const _vRight = new THREE.Vector3();
const _up = new THREE.Vector3(0, 1, 0);
const _camEuler = new THREE.Euler(0, 0, 0, 'YXZ');
const _originVec = new THREE.Vector3(0, 8.2, 0);
const _dirVec = new THREE.Vector3();

// Genuine heavy GPU Raymarched Volumetric Deep-Space Nebula + Planetary Horizon Dome
const VOLUMETRIC_SKY_VERT = `
varying vec3 vWorldDir;
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorldDir = normalize(position);
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

const VOLUMETRIC_SKY_FRAG = `
precision highp float;
varying vec3 vWorldDir;
uniform float uTime;
uniform int uSteps;
uniform vec3 uColA;
uniform vec3 uColB;
uniform vec3 uColC;

float hash31(vec3 p) {
  p = fract(p * 0.1031);
  p += dot(p, p.yzx + 33.33);
  return fract((p.x + p.y) * p.z);
}

float noise3(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float n000 = hash31(i);
  float n100 = hash31(i + vec3(1.0, 0.0, 0.0));
  float n010 = hash31(i + vec3(0.0, 1.0, 0.0));
  float n110 = hash31(i + vec3(1.0, 1.0, 0.0));
  float n001 = hash31(i + vec3(0.0, 0.0, 1.0));
  float n101 = hash31(i + vec3(1.0, 0.0, 1.0));
  float n011 = hash31(i + vec3(0.0, 1.0, 1.0));
  float n111 = hash31(i + vec3(1.0, 1.0, 1.0));
  float nx00 = mix(n000, n100, f.x);
  float nx10 = mix(n010, n110, f.x);
  float nx01 = mix(n001, n101, f.x);
  float nx11 = mix(n011, n111, f.x);
  return mix(mix(nx00, nx10, f.y), mix(nx01, nx11, f.y), f.z);
}

float fbm(vec3 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 4; i++) {
    v += a * noise3(p);
    p = p * 2.04 + vec3(0.13, -0.09, 0.21);
    a *= 0.5;
  }
  return v;
}

void main() {
  vec3 dir = normalize(vWorldDir);
  vec3 baseSky = mix(uColA * 0.08, vec3(0.004, 0.007, 0.020), clamp(dir.y * 1.4, 0.0, 1.0));

  // Real volumetric raymarching loop scaled by preset (28 to 128 GPU steps per pixel!)
  vec3 acc = vec3(0.0);
  float trans = 1.0;
  float t = 1.2;
  float dt = 0.16;
  int maxSteps = clamp(uSteps, 16, 128);
  for (int i = 0; i < 128; i++) {
    if (i >= maxSteps) break;
    vec3 sp = dir * t + vec3(uTime * 0.06, -uTime * 0.03, uTime * 0.04);
    float d = fbm(sp * 0.65);
    float band = smoothstep(0.42, 0.85, d) * smoothstep(-0.15, 0.45, dir.y);
    vec3 nebCol = mix(uColA, uColB, sin(t * 0.5 + d * 3.1) * 0.5 + 0.5);
    nebCol = mix(nebCol, uColC, smoothstep(0.68, 0.92, d));
    float dens = band * 0.042;
    acc += trans * nebCol * dens;
    trans *= (1.0 - dens * 0.72);
    t += dt;
  }

  // Crisp horizon glow, directional sun halo, atmospheric scattering & sharp stars
  vec3 sunDir = normalize(vec3(0.32, 0.28, -0.9));
  float sunDot = max(dot(dir, sunDir), 0.0);
  float sunDisc = smoothstep(0.9975, 0.9994, sunDot);
  float sunHalo = pow(sunDot, 14.0) * 0.45 + pow(sunDot, 3.0) * 0.14;
  float horizon = exp(-abs(dir.y) * 8.5);
  vec3 zenithCol = mix(baseSky, uColB * 0.18, smoothstep(0.0, 0.85, dir.y));
  vec3 col = zenithCol + acc * 0.96 + mix(uColA, uColC, 0.35) * horizon * 0.56;
  col += mix(uColC, vec3(1.0, 0.92, 0.78), 0.65) * (sunHalo + sunDisc * 2.2);
  float starCell = hash31(floor(dir * 420.0));
  if (starCell > 0.994 && dir.y > 0.04) {
    col += vec3(0.85, 0.92, 1.0) * ((starCell - 0.994) * 155.0);
  }
  gl_FragColor = vec4(col, 1.0);
}
`;

// Real 3D Raymarched Quantum Singularity / Fractal Plasma Core
const SINGULARITY_VERT = `
varying vec3 vNormal;
varying vec3 vWorldPos;
varying vec3 vLocalPos;
uniform float uTime;
void main() {
  vLocalPos = position;
  vNormal = normalize(normalMatrix * normal);
  vec3 pos = position;
  float wave = sin(pos.x * 2.8 + uTime * 2.4) * cos(pos.y * 2.6 - uTime * 1.8) * sin(pos.z * 2.8 + uTime * 2.0);
  pos += normal * wave * 0.16;
  vec4 wp = modelMatrix * vec4(pos, 1.0);
  vWorldPos = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

const SINGULARITY_FRAG = `
precision highp float;
varying vec3 vNormal;
varying vec3 vWorldPos;
varying vec3 vLocalPos;
uniform float uTime;
uniform int uSteps;
uniform vec3 uCoreColA;
uniform vec3 uCoreColB;

float sdGyroid(vec3 p) {
  return dot(sin(p), cos(p.yzx));
}

void main() {
  vec3 viewDir = normalize(cameraPosition - vWorldPos);
  vec3 n = normalize(vNormal);
  float fresnel = pow(1.0 - max(dot(n, viewDir), 0.0), 2.8);

  // Volumetric interior plasma raymarch
  vec3 ro = vLocalPos * 0.75;
  vec3 rd = -viewDir;
  float glow = 0.0;
  int steps = clamp(uSteps / 2, 14, 64);
  for (int i = 0; i < 64; i++) {
    if (i >= steps) break;
    vec3 p = ro + rd * (float(i) * 0.075);
    float g = abs(sdGyroid(p * 2.2 + vec3(uTime * 0.7, -uTime * 0.5, uTime * 0.4)));
    glow += 0.024 / (0.09 + g * g);
  }
  glow = clamp(glow * 0.18, 0.0, 2.2);

  vec3 darkCore = vec3(0.03, 0.05, 0.12);
  vec3 col = mix(darkCore, uCoreColA, clamp(glow * 0.65, 0.0, 1.0));
  col = mix(col, uCoreColB, smoothstep(0.85, 1.8, glow));
  col += uCoreColA * fresnel * 1.15;

  gl_FragColor = vec4(col, 1.0);
}
`;

interface LaserBolt {
  mesh: THREE.Mesh;
  vel: THREE.Vector3;
  life: number;
}

export class GameBenchService {
  private mountEl: HTMLElement | null = null;
  private renderer: THREE.WebGLRenderer | null = null;
  private composer: EffectComposer | null = null;
  private bloomPass: UnrealBloomPass | null = null;
  private scene: THREE.Scene | null = null;
  private camera: THREE.PerspectiveCamera | null = null;
  private envRT: THREE.WebGLRenderTarget | null = null;
  private resizeObserver: ResizeObserver | null = null;

  private skyMat: THREE.ShaderMaterial | null = null;
  private plasmaMat: THREE.ShaderMaterial | null = null;
  private coreGroup: THREE.Group | null = null;
  private droneMesh: THREE.InstancedMesh | null = null;
  private towerMesh: THREE.InstancedMesh | null = null;
  private accentStripMesh: THREE.InstancedMesh | null = null;
  private particlePoints: THREE.Points | null = null;
  private dynLights: THREE.PointLight[] = [];
  private lasers: LaserBolt[] = [];

  private droneMeta: Float32Array = new Float32Array(0);
  private lastTriangles = 0;
  private lastDrawCalls = 0;

  private running = false;
  private interactiveMode = false;
  private gameId: GameSceneId = 'hyperion';
  private preset: GameQualityPreset = 'ultra';
  private fpsMode: GpuFpsMode = 'vsync';
  private fpsCap: GameFpsCap = 0;
  private bloomEnabled = true;
  private shadowsEnabled = true;
  private fogEnabled = true;
  private anisotropy = 16;
  private toneMapping: GameToneMappingMode = 'aces';
  private exposure = 1.05;
  private envIntensity = 0.72;
  private sceneryDensityPct = 100;
  private dynamicResolution = true;
  private aiProfile: GameAiProfile = 'ai_auto';
  private aiRecommendation = 'AI: Aktywna adaptacja rozdzielczości (Cel: płynne 60–144+ FPS)';
  private aiAdaptCooldownTs = 0;
  private dynResFactor = 1.0;
  private detectedGpuRenderer = '';
  private isSoftwareRenderer = false;
  private frameTickCount = 0;

  private rafId = 0;
  private uncappedTimer: number | null = null;
  private startTs = 0;
  private lastTickTs = 0;
  private simTime = 0;
  private windowStartTs = 0;
  private windowFrames = 0;
  private frameTimes: number[] = [];
  private fpsSamples: number[] = [];
  private telemetry: GpuTelemetryPoint[] = [];
  private shotsFired = 0;
  private targetsHit = 0;

  // Interactive camera, 3D Racing, 3D Flight & 3D Soccer controls
  private keysDown = new Set<string>();
  private camYaw = 0;
  private camPitch = -0.14;
  private isDraggingLook = false;
  private lastMouseX = 0;
  private lastMouseY = 0;
  private playerCarGroup: THREE.Group | null = null;
  private playerAircraftGroup: THREE.Group | null = null;
  private aircraftRotors: THREE.Object3D[] = [];
  private raceRoadTexture: THREE.CanvasTexture | null = null;
  private flightGroundTex: THREE.CanvasTexture | null = null;
  private flightCloudsMesh: THREE.InstancedMesh | null = null;
  private flightCloudMeta: Float32Array = new Float32Array(0);
  private contactShadowTex: THREE.CanvasTexture | null = null;
  private raceGantries: THREE.Object3D[] = [];
  private raceWheels: THREE.Object3D[] = [];
  private raceSteerWheels: THREE.Object3D[] = [];
  private playerCarX = 0;
  private playerCarSteer = 0;
  private playerFlightY = 11;
  private playerFlightPitch = 0;
  private raceSpeedKmh = 340;
  private raceDistanceM = 0;
  private raceLap = 1;
  private raceNitroPct = 100;
  private racePosition = 4;

  // 3D Soccer Match state
  private soccerPlayerGroup: THREE.Group | null = null;
  private soccerBallMesh: THREE.Mesh | null = null;
  private soccerTeammates: THREE.Group[] = [];
  private soccerOpponents: THREE.Group[] = [];
  private soccerBallPos = new THREE.Vector3(0, 0.48, 0);
  private soccerBallVel = new THREE.Vector3(0, 0, -4);
  private soccerPlayerPos = new THREE.Vector3(0, 0, 12);
  private soccerPlayerYaw = 0;
  private soccerScoreHome = 0;
  private soccerScoreAway = 0;
  private soccerMatchSec = 0;
  private soccerBallSpeedKmh = 0;
  private soccerGoalBannerTs = 0;

  private onMetrics: ((m: GameBenchMetrics) => void) | null = null;
  private metrics: GameBenchMetrics;

  constructor() {
    this.metrics = this.createInitialMetrics();
  }

  public getGameCatalogItem(): GameCatalogItem {
    return GAME_CATALOG.find((g) => g.id === this.gameId) || GAME_CATALOG[0];
  }

  public getGameScene(): GameSceneId {
    return this.gameId;
  }

  public setGameScene(id: GameSceneId): void {
    const found = GAME_CATALOG.find((g) => g.id === id);
    if (!found) return;
    this.gameId = found.id;
    this.metrics.gameId = found.id;
    this.metrics.gameTitle = found.title;
    this.shotsFired = 0;
    this.targetsHit = 0;

    if (this.scene && this.mountEl) {
      this.clearSceneObjects(this.scene);
      this.scene.background = new THREE.Color(found.skyBaseTop);
      this.scene.fog = this.fogEnabled ? new THREE.FogExp2(found.fogColor, 0.0068) : null;
      this.buildWorld(this.scene);
      this.applyPresetScale(Math.max(360, this.mountEl.clientWidth), Math.max(280, this.mountEl.clientHeight));
      if (!this.running) {
        this.renderFrameOnce();
        this.metrics.triangles = this.lastTriangles;
        this.metrics.drawCalls = this.lastDrawCalls;
      }
    }
    this.updateSceneModeFlags(found.layoutMode);
    this.emitMetrics();
  }

  private clearSceneObjects(scene: THREE.Scene): void {
    const toRemove = [...scene.children];
    for (const obj of toRemove) {
      scene.remove(obj);
      obj.traverse((child) => {
        if ((child as THREE.Mesh).isMesh || (child as THREE.Points).isPoints) {
          const m = child as THREE.Mesh;
          m.geometry?.dispose();
          if (Array.isArray(m.material)) {
            m.material.forEach((mat) => {
              const sm = mat as THREE.MeshStandardMaterial;
              sm.map?.dispose?.();
              sm.roughnessMap?.dispose?.();
              sm.bumpMap?.dispose?.();
              sm.emissiveMap?.dispose?.();
              mat.dispose();
            });
          } else if (m.material) {
            const sm = m.material as THREE.MeshStandardMaterial;
            sm.map?.dispose?.();
            sm.roughnessMap?.dispose?.();
            sm.bumpMap?.dispose?.();
            sm.emissiveMap?.dispose?.();
            m.material.dispose();
          }
        }
      });
    }
    this.dynLights = [];
    this.lasers = [];
    this.towerMesh = null;
    this.accentStripMesh = null;
    this.droneMesh = null;
    this.particlePoints = null;
    this.coreGroup = null;
    this.playerCarGroup = null;
    this.playerAircraftGroup = null;
    this.aircraftRotors = [];
    this.raceRoadTexture?.dispose();
    this.raceRoadTexture = null;
    this.flightGroundTex?.dispose();
    this.flightGroundTex = null;
    this.flightCloudsMesh = null;
    this.flightCloudMeta = new Float32Array(0);
    this.contactShadowTex?.dispose();
    this.contactShadowTex = null;
    this.raceGantries = [];
    this.raceWheels = [];
    this.raceSteerWheels = [];
    this.soccerPlayerGroup = null;
    this.soccerBallMesh = null;
    this.soccerTeammates = [];
    this.soccerOpponents = [];
    this.skyMat = null;
    this.plasmaMat = null;
  }

  public getRaceHudState(): {
    active: boolean;
    speedKmh: number;
    lap: number;
    nitroPct: number;
    position: number;
    distanceKm: number;
  } {
    return {
      active: this.isRacingScene(),
      speedKmh: Math.round(this.raceSpeedKmh),
      lap: this.raceLap,
      nitroPct: Math.round(this.raceNitroPct),
      position: this.racePosition,
      distanceKm: Number((this.raceDistanceM / 1000).toFixed(2)),
    };
  }

  public isRacingScene(layoutMode?: GameCatalogItem['layoutMode']): boolean {
    const mode = layoutMode || this.getGameCatalogItem().layoutMode;
    return (
      mode === 'formula_gp' ||
      mode === 'drift_touge' ||
      mode === 'maglev_track' ||
      mode === 'dakar_rally' ||
      mode === 'bugatti_hypercar' ||
      mode === 'snow_rally' ||
      mode === 'corridor'
    );
  }

  public isFlightScene(layoutMode?: GameCatalogItem['layoutMode']): boolean {
    const mode = layoutMode || this.getGameCatalogItem().layoutMode;
    return mode === 'f22_jet' || mode === 'sr71_plane' || mode === 'apache_heli';
  }

  public isSoccerScene(layoutMode?: GameCatalogItem['layoutMode']): boolean {
    const mode = layoutMode || this.getGameCatalogItem().layoutMode;
    return mode === 'soccer_stadium';
  }

  private updateSceneModeFlags(layoutMode: GameCatalogItem['layoutMode']): void {
    const racing = this.isRacingScene(layoutMode) || this.isFlightScene(layoutMode);
    const soccer = this.isSoccerScene(layoutMode);
    this.metrics.isRacingMode = racing;
    this.metrics.isSoccerMode = soccer;
  }

  public createInitialMetrics(): GameBenchMetrics {
    const cfg = GAME_PRESETS[this.preset];
    const gameMeta = this.getGameCatalogItem();
    return {
      running: false,
      interactiveMode: false,
      gameId: gameMeta.id,
      gameTitle: gameMeta.title,
      preset: this.preset,
      fpsMode: this.fpsMode,
      fpsCap: this.fpsCap,
      renderScale: cfg.renderScale,
      bloomEnabled: this.bloomEnabled,
      shadowsEnabled: this.shadowsEnabled,
      fogEnabled: this.fogEnabled,
      anisotropy: this.anisotropy,
      toneMapping: this.toneMapping,
      exposure: this.exposure,
      envIntensity: this.envIntensity,
      sceneryDensityPct: this.sceneryDensityPct,
      dynamicResolution: this.dynamicResolution,
      aiProfile: this.aiProfile,
      aiRecommendation: this.aiRecommendation,
      isSmoothMode: this.fpsMode === 'vsync' || this.fpsCap > 0,
      raymarchSteps: cfg.raymarchSteps,
      resolutionLabel: '—',
      fps: 0,
      avgFps: 0,
      minFps: 0,
      maxFps: 0,
      low1PctFps: 0,
      low01PctFps: 0,
      frameTimeMs: 0,
      triangles: 0,
      drawCalls: 0,
      particleCount: cfg.particles,
      droneCount: cfg.drones,
      elapsedSec: 0,
      estTempC: 0,
      peakTempC: 0,
      realGpuTempC: null,
      gpuLoadIndexPct: 0,
      stabilityPct: 100,
      overallScore: 0,
      shotsFired: 0,
      targetsHit: 0,
      isRacingMode: this.isRacingScene(gameMeta.layoutMode) || this.isFlightScene(gameMeta.layoutMode),
      isSoccerMode: this.isSoccerScene(gameMeta.layoutMode),
      soccerScoreHome: 0,
      soccerScoreAway: 0,
      soccerBallSpeedKmh: 0,
      soccerMatchSec: 0,
      telemetry: [],
      verdict: 'OCZEKIWANIE',
    };
  }

  public getMetrics(): GameBenchMetrics {
    return { ...this.metrics, telemetry: [...this.metrics.telemetry] };
  }

  public isRunning(): boolean {
    return this.running;
  }

  public getLoadPct(): number {
    if (!this.running) return 0;
    return this.preset === 'nightmare' ? 100 : this.preset === 'extreme' ? 96 : this.preset === 'ultra' ? 88 : 74;
  }

  public mount(container: HTMLElement, onMetrics: (m: GameBenchMetrics) => void): void {
    this.unmount();
    this.mountEl = container;
    this.onMetrics = onMetrics;

    const w = Math.max(360, container.clientWidth);
    const h = Math.max(280, container.clientHeight);
    const gameMeta = this.getGameCatalogItem();

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
      stencil: false,
    });
    renderer.info.autoReset = false;
    this.applyRendererToneMapping(renderer);
    renderer.shadowMap.enabled = this.shadowsEnabled;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.setSize(w, h);
    container.innerHTML = '';
    container.appendChild(renderer.domElement);
    this.renderer = renderer;

    // Inspect real WebGL GPU renderer string for on-device AI Graphics Engine
    try {
      const gl = renderer.getContext();
      const dbg = gl.getExtension('WEBGL_debug_renderer_info');
      const rawRenderer = dbg
        ? String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) || '')
        : String(gl.getParameter(gl.RENDERER) || '');
      this.detectedGpuRenderer = rawRenderer;
      this.isSoftwareRenderer = /swiftshader|llvmpipe|software|microsoft basic render/i.test(rawRenderer);
      if (this.aiProfile === 'ai_auto') {
        if (this.isSoftwareRenderer) {
          this.preset = 'high';
          this.bloomEnabled = false;
          this.shadowsEnabled = false;
          this.anisotropy = 4;
          this.sceneryDensityPct = 50;
          this.aiRecommendation = 'AI wykryło renderer programowy -> High + Zero Microstutter + Dynamic Scale';
        } else {
          const maxAf = Math.min(16, renderer.capabilities.getMaxAnisotropy() || 8);
          this.anisotropy = maxAf;
          this.aiRecommendation = `AI GPU (${rawRenderer.slice(0, 34) || 'WebGL2 HW'}) -> AF ${maxAf}x, ACES Filmic, Dynamic Res`;
        }
      }
    } catch {
      this.detectedGpuRenderer = 'WebGL2 Hardware';
    }

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(gameMeta.skyBaseTop);
    scene.fog = this.fogEnabled ? new THREE.FogExp2(gameMeta.fogColor, 0.0068) : null;
    this.scene = scene;

    const pmrem = new THREE.PMREMGenerator(renderer);
    this.envRT = pmrem.fromScene(new RoomEnvironment(), 0.04);
    scene.environment = this.envRT.texture;
    scene.environmentIntensity = this.envIntensity;
    pmrem.dispose();

    const camera = new THREE.PerspectiveCamera(60, w / h, 0.1, 460);
    camera.position.set(0, 12.5, 36);
    camera.lookAt(0, 6.5, 0);
    this.camera = camera;

    this.buildWorld(scene);
    this.setupComposer(w, h);
    this.applyPresetScale(w, h);

    this.bindInteractiveEvents(renderer.domElement);

    this.resizeObserver = new ResizeObserver(() => this.handleResize());
    this.resizeObserver.observe(container);

    this.renderFrameOnce();
    this.metrics.triangles = this.lastTriangles;
    this.metrics.drawCalls = this.lastDrawCalls;
    this.metrics.aiRecommendation = this.aiRecommendation;
    this.emitMetrics();
  }

  private buildWorld(scene: THREE.Scene): void {
    const cfg = GAME_PRESETS[this.preset];
    const gameMeta = this.getGameCatalogItem();

    // 1. Volumetric GPU Raymarched Sky Dome tailored to the selected game's palette
    this.skyMat = new THREE.ShaderMaterial({
      vertexShader: VOLUMETRIC_SKY_VERT,
      fragmentShader: VOLUMETRIC_SKY_FRAG,
      uniforms: {
        uTime: { value: 0 },
        uSteps: { value: cfg.raymarchSteps },
        uColA: { value: new THREE.Vector3(...gameMeta.nebulaColA) },
        uColB: { value: new THREE.Vector3(...gameMeta.nebulaColB) },
        uColC: { value: new THREE.Vector3(...gameMeta.nebulaColC) },
      },
      side: THREE.BackSide,
      depthWrite: false,
    });
    const skyDome = new THREE.Mesh(new THREE.SphereGeometry(240, 32, 24), this.skyMat);
    scene.add(skyDome);

    // 2. Balanced 3-Point Cinematic Studio Lighting (Key Sun + Cool Sky/Ground Hemi + Rim Fill)
    const hemi = new THREE.HemisphereLight(gameMeta.lightPalette[0], gameMeta.skyBaseBottom, 0.92);
    scene.add(hemi);

    const sun = new THREE.DirectionalLight(0xfff1dc, 2.55);
    sun.position.set(34, 58, 30);
    sun.castShadow = this.shadowsEnabled;
    sun.shadow.mapSize.set(cfg.shadowSize, cfg.shadowSize);
    sun.shadow.camera.near = 4;
    sun.shadow.camera.far = 175;
    const d = 62;
    sun.shadow.camera.left = -d;
    sun.shadow.camera.right = d;
    sun.shadow.camera.top = d;
    sun.shadow.camera.bottom = -d;
    sun.shadow.bias = -0.0004;
    sun.shadow.normalBias = 0.02;
    scene.add(sun);

    const rimDir = new THREE.DirectionalLight(gameMeta.lightPalette[0], 1.15);
    rimDir.position.set(-42, 22, -48);
    scene.add(rimDir);

    this.dynLights = gameMeta.lightPalette.map((col, idx) => {
      const pl = new THREE.PointLight(col, 46, 70, 1.7);
      pl.position.set(Math.cos(idx * 1.57) * 20, 8, Math.sin(idx * 1.57) * 20);
      scene.add(pl);
      return pl;
    });

    // 3. Unique Ground / Ocean / Highway / Magma Sea / Space Void per Game
    const isSpaceOnly =
      gameMeta.layoutMode === 'asteroid' ||
      gameMeta.layoutMode === 'dyson' ||
      gameMeta.layoutMode === 'supernova' ||
      gameMeta.layoutMode === 'skyland' ||
      gameMeta.layoutMode === 'stargate' ||
      gameMeta.layoutMode === 'eclipse';
    if (!isSpaceOnly) {
      const isRacingTrack =
        gameMeta.layoutMode === 'formula_gp' ||
        gameMeta.layoutMode === 'drift_touge' ||
        gameMeta.layoutMode === 'maglev_track' ||
        gameMeta.layoutMode === 'dakar_rally' ||
        gameMeta.layoutMode === 'bugatti_hypercar' ||
        gameMeta.layoutMode === 'snow_rally';

      if (isRacingTrack || gameMeta.layoutMode === 'corridor') {
        const trackStyle: VehicleStyle =
          gameMeta.layoutMode === 'snow_rally'
            ? 'dakar_rally'
            : (gameMeta.layoutMode as VehicleStyle);
        const textures = createRacingTrackTextures(trackStyle, this.anisotropy);
        if (gameMeta.layoutMode === 'snow_rally') {
          // Tint snow rally ground into crisp alpine tarmac + icy snow shoulders
          const snowC = document.createElement('canvas');
          snowC.width = 1024;
          snowC.height = 1024;
          const sctx = snowC.getContext('2d')!;
          sctx.fillStyle = '#e2e8f0';
          sctx.fillRect(0, 0, 1024, 1024);
          sctx.fillStyle = '#334155';
          sctx.fillRect(160, 0, 704, 1024);
          sctx.fillStyle = 'rgba(226, 232, 240, 0.25)';
          sctx.fillRect(260, 0, 110, 1024);
          sctx.fillRect(654, 0, 110, 1024);
          sctx.fillStyle = '#f97316';
          for (let y = 0; y < 1024; y += 128) {
            sctx.fillRect(142, y, 18, 72);
            sctx.fillRect(864, y, 18, 72);
            sctx.fillRect(507, y, 10, 58);
          }
          textures.map.dispose();
          textures.map = new THREE.CanvasTexture(snowC);
          textures.map.colorSpace = THREE.SRGBColorSpace;
        }
        textures.map.wrapS = THREE.RepeatWrapping;
        textures.map.wrapT = THREE.RepeatWrapping;
        textures.map.repeat.set(1, 34);
        textures.map.anisotropy = this.anisotropy;
        textures.roughnessMap.wrapS = THREE.RepeatWrapping;
        textures.roughnessMap.wrapT = THREE.RepeatWrapping;
        textures.roughnessMap.repeat.set(1, 34);
        textures.bumpMap.wrapS = THREE.RepeatWrapping;
        textures.bumpMap.wrapT = THREE.RepeatWrapping;
        textures.bumpMap.repeat.set(1, 34);
        this.raceRoadTexture = textures.map;

        const roadGeo = new THREE.PlaneGeometry(42, 460, 8, 8);
        const roadMat = new THREE.MeshStandardMaterial({
          map: textures.map,
          roughnessMap: textures.roughnessMap,
          bumpMap: textures.bumpMap,
          bumpScale: gameMeta.layoutMode === 'dakar_rally' || gameMeta.layoutMode === 'snow_rally' ? 0.14 : 0.04,
          metalness: gameMeta.layoutMode === 'corridor' || gameMeta.layoutMode === 'maglev_track' ? 0.45 : 0.12,
          roughness: gameMeta.layoutMode === 'dakar_rally' ? 0.88 : 0.52,
        });
        const roadMesh = new THREE.Mesh(roadGeo, roadMat);
        roadMesh.rotation.x = -Math.PI / 2;
        roadMesh.position.z = -125;
        roadMesh.receiveShadow = true;
        scene.add(roadMesh);
      } else if (gameMeta.layoutMode === 'soccer_stadium') {
        // Detailed Champions League 1024x1024 Striped Emerald Grass Pitch with crisp white markings
        const pitchCanvas = document.createElement('canvas');
        pitchCanvas.width = 1024;
        pitchCanvas.height = 1024;
        const pctx = pitchCanvas.getContext('2d')!;
        for (let b = 0; b < 16; b++) {
          pctx.fillStyle = b % 2 === 0 ? '#15803d' : '#166534';
          pctx.fillRect(0, (b * 1024) / 16, 1024, 1024 / 16 + 1);
        }
        // Chalk pitch lines
        pctx.strokeStyle = 'rgba(255, 255, 255, 0.94)';
        pctx.lineWidth = 8;
        pctx.strokeRect(56, 48, 912, 928);
        // Halfway line & center circle
        pctx.beginPath();
        pctx.moveTo(56, 512);
        pctx.lineTo(968, 512);
        pctx.stroke();
        pctx.beginPath();
        pctx.arc(512, 512, 112, 0, Math.PI * 2);
        pctx.stroke();
        pctx.fillStyle = '#ffffff';
        pctx.beginPath();
        pctx.arc(512, 512, 10, 0, Math.PI * 2);
        pctx.fill();
        // Top & Bottom Penalty Boxes
        pctx.strokeRect(272, 48, 480, 152);
        pctx.strokeRect(382, 48, 260, 62);
        pctx.strokeRect(272, 824, 480, 152);
        pctx.strokeRect(382, 914, 260, 62);

        const pitchTex = new THREE.CanvasTexture(pitchCanvas);
        pitchTex.colorSpace = THREE.SRGBColorSpace;
        pitchTex.anisotropy = this.anisotropy;
        const pitchGeo = new THREE.PlaneGeometry(54, 82, 4, 4);
        const pitchMat = new THREE.MeshStandardMaterial({
          map: pitchTex,
          roughness: 0.86,
          metalness: 0.04,
        });
        const pitch = new THREE.Mesh(pitchGeo, pitchMat);
        pitch.rotation.x = -Math.PI / 2;
        pitch.receiveShadow = true;
        scene.add(pitch);

        // Dark athletics running track apron outside pitch
        const apron = new THREE.Mesh(
          new THREE.PlaneGeometry(120, 130),
          new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.9, metalness: 0.08 })
        );
        apron.rotation.x = -Math.PI / 2;
        apron.position.y = -0.04;
        apron.receiveShadow = true;
        scene.add(apron);
      } else {
        const floorCanvas = document.createElement('canvas');
        floorCanvas.width = 512;
        floorCanvas.height = 512;
        const fctx = floorCanvas.getContext('2d')!;

        if (gameMeta.layoutMode === 'volcanic') {
          fctx.fillStyle = '#140503';
          fctx.fillRect(0, 0, 512, 512);
          for (let k = 0; k < 42; k++) {
            fctx.strokeStyle = k % 2 === 0 ? 'rgba(249, 115, 22, 0.75)' : 'rgba(239, 68, 68, 0.55)';
            fctx.lineWidth = 2 + (k % 3);
            fctx.beginPath();
            const sx = (k * 73) % 512;
            const sy = (k * 129) % 512;
            fctx.moveTo(sx, sy);
            fctx.lineTo((sx + 110) % 512, (sy + 65) % 512);
            fctx.lineTo((sx + 190) % 512, (sy + 140) % 512);
            fctx.stroke();
          }
        } else if (gameMeta.layoutMode === 'abyss') {
          const grad = fctx.createRadialGradient(256, 256, 20, 256, 256, 256);
          grad.addColorStop(0, '#072a3a');
          grad.addColorStop(1, '#030d18');
          fctx.fillStyle = grad;
          fctx.fillRect(0, 0, 512, 512);
          fctx.strokeStyle = 'rgba(45, 212, 191, 0.34)';
          fctx.lineWidth = 2;
          for (let r = 24; r < 256; r += 28) {
            fctx.beginPath();
            fctx.arc(256, 256, r, 0, Math.PI * 2);
            fctx.stroke();
          }
        } else {
          fctx.fillStyle = '#060a14';
          fctx.fillRect(0, 0, 512, 512);
          fctx.strokeStyle = gameMeta.gridColor;
          fctx.lineWidth = 1.5;
          for (let i = 0; i <= 512; i += 32) {
            fctx.beginPath();
            fctx.moveTo(i, 0);
            fctx.lineTo(i, 512);
            fctx.stroke();
            fctx.beginPath();
            fctx.moveTo(0, i);
            fctx.lineTo(512, i);
            fctx.stroke();
          }
          fctx.strokeStyle = gameMeta.gridBorder;
          fctx.lineWidth = 2.5;
          fctx.strokeRect(8, 8, 496, 496);
        }

        const floorTex = new THREE.CanvasTexture(floorCanvas);
        floorTex.wrapS = THREE.RepeatWrapping;
        floorTex.wrapT = THREE.RepeatWrapping;
        floorTex.repeat.set(24, 24);
        floorTex.colorSpace = THREE.SRGBColorSpace;
        floorTex.anisotropy = this.anisotropy;

        const floorGeo =
          gameMeta.layoutMode === 'volcanic' || gameMeta.layoutMode === 'abyss'
            ? new THREE.PlaneGeometry(240, 240, 64, 64)
            : new THREE.CircleGeometry(140, 72);

        if (gameMeta.layoutMode === 'volcanic' || gameMeta.layoutMode === 'abyss') {
          const pos = floorGeo.attributes.position;
          for (let i = 0; i < pos.count; i++) {
            const vx = pos.getX(i);
            const vy = pos.getY(i);
            const dist = Math.sqrt(vx * vx + vy * vy);
            const h =
              gameMeta.layoutMode === 'volcanic'
                ? Math.sin(dist * 0.18) * 2.2 + Math.cos(vx * 0.12) * Math.sin(vy * 0.12) * 2.8
                : Math.sin(vx * 0.09) * Math.cos(vy * 0.09) * 3.4;
            pos.setZ(i, dist < 16 ? -1.2 : h);
          }
          floorGeo.computeVertexNormals();
        }

        const floor = new THREE.Mesh(
          floorGeo,
          new THREE.MeshPhysicalMaterial({
            map: floorTex,
            color: gameMeta.floorColor,
            metalness: gameMeta.layoutMode === 'volcanic' ? 0.35 : 0.72,
            roughness: 0.28,
            clearcoat: 0.65,
            clearcoatRoughness: 0.2,
            emissive: gameMeta.layoutMode === 'volcanic' ? 0x7c2d12 : 0x000000,
            emissiveIntensity: gameMeta.layoutMode === 'volcanic' ? 0.45 : 0,
          })
        );
        floor.rotation.x = -Math.PI / 2;
        if (this.isFlightScene(gameMeta.layoutMode)) {
          // Stratospheric sea / canyon ridge texture scrolling underneath aircraft at Mach velocity
          const flCanvas = document.createElement('canvas');
          flCanvas.width = 512;
          flCanvas.height = 512;
          const flctx = flCanvas.getContext('2d')!;
          const grad = flctx.createLinearGradient(0, 0, 512, 512);
          if (gameMeta.layoutMode === 'sr71_plane') {
            grad.addColorStop(0, '#041428');
            grad.addColorStop(0.5, '#07223e');
            grad.addColorStop(1, '#041428');
          } else if (gameMeta.layoutMode === 'f22_jet') {
            grad.addColorStop(0, '#2a1810');
            grad.addColorStop(0.5, '#472818');
            grad.addColorStop(1, '#26140c');
          } else {
            grad.addColorStop(0, '#091f17');
            grad.addColorStop(0.5, '#133528');
            grad.addColorStop(1, '#081a13');
          }
          flctx.fillStyle = grad;
          flctx.fillRect(0, 0, 512, 512);
          flctx.strokeStyle = gameMeta.layoutMode === 'sr71_plane' ? 'rgba(56, 189, 248, 0.22)' : 'rgba(255, 255, 255, 0.14)';
          flctx.lineWidth = 2;
          for (let y = 0; y < 512; y += 32) {
            flctx.beginPath();
            flctx.moveTo(0, y);
            for (let x = 0; x <= 512; x += 64) {
              flctx.lineTo(x, y + Math.sin(x * 0.04 + y * 0.1) * 9);
            }
            flctx.stroke();
          }
          const flightTex = new THREE.CanvasTexture(flCanvas);
          flightTex.wrapS = THREE.RepeatWrapping;
          flightTex.wrapT = THREE.RepeatWrapping;
          flightTex.repeat.set(16, 22);
          flightTex.colorSpace = THREE.SRGBColorSpace;
          flightTex.anisotropy = this.anisotropy;
          this.flightGroundTex = flightTex;
          floor.material.map = flightTex;
          floor.material.roughness = 0.45;
          floor.material.metalness = gameMeta.layoutMode === 'sr71_plane' ? 0.55 : 0.22;
          floor.material.needsUpdate = true;
          floor.position.y = -14;
        }
        floor.receiveShadow = true;
        scene.add(floor);
      }
    }

    // 4. COMPLETELY DISTINCT CENTRAL ARCHITECTURE / BOSS FOR EACH OF THE 8 GAMES
    const coreGroup = new THREE.Group();
    this.plasmaMat = new THREE.ShaderMaterial({
      vertexShader: SINGULARITY_VERT,
      fragmentShader: SINGULARITY_FRAG,
      uniforms: {
        uTime: { value: 0 },
        uSteps: { value: cfg.raymarchSteps },
        uCoreColA: { value: new THREE.Vector3(...gameMeta.coreColA) },
        uCoreColB: { value: new THREE.Vector3(...gameMeta.coreColB) },
      },
    });

    if (gameMeta.layoutMode === 'orbital') {
      // GAME 1 (HYPERION): Quantum Black Hole Singularity with Horizontal Accretion Disk & Relativistic Polar Jets
      coreGroup.position.set(0, 10.5, 0);
      const eventHorizon = new THREE.Mesh(new THREE.IcosahedronGeometry(3.8, 5), this.plasmaMat);
      coreGroup.add(eventHorizon);

      const accretionDisk = new THREE.Mesh(
        new THREE.RingGeometry(4.8, 14.5, 96, 8),
        new THREE.MeshBasicMaterial({
          color: 0x38bdf8,
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0.65,
          blending: THREE.AdditiveBlending,
        })
      );
      accretionDisk.rotation.x = Math.PI / 2 - 0.18;
      accretionDisk.userData.ringIdx = 0;
      coreGroup.add(accretionDisk);

      // Relativistic polar plasma jets shooting up & down
      const jetMat = new THREE.MeshBasicMaterial({
        color: 0xf97316,
        transparent: true,
        opacity: 0.55,
        blending: THREE.AdditiveBlending,
      });
      const topJet = new THREE.Mesh(new THREE.ConeGeometry(1.8, 28, 24, 1, true), jetMat);
      topJet.position.y = 16;
      const botJet = new THREE.Mesh(new THREE.ConeGeometry(1.8, 28, 24, 1, true), jetMat);
      botJet.position.y = -16;
      botJet.rotation.x = Math.PI;
      coreGroup.add(topJet, botJet);
    } else if (gameMeta.layoutMode === 'corridor') {
      // GAME 2 (NEON OVERDRIVE): Cyberpunk Highway Holographic Gate Arches & Giant Wireframe Cyber-Head/Portal
      coreGroup.position.set(0, 0, 0);
      const archMat = new THREE.MeshStandardMaterial({
        color: 0x0f172a,
        metalness: 0.9,
        roughness: 0.15,
        emissive: 0xec4899,
        emissiveIntensity: 0.75,
      });
      for (let a = -3; a <= 3; a++) {
        const arch = new THREE.Mesh(new THREE.TorusGeometry(18, 0.45, 12, 48, Math.PI), archMat);
        arch.position.set(0, 0, a * 22);
        coreGroup.add(arch);
      }
      const holoBillboard = new THREE.Mesh(new THREE.OctahedronGeometry(4.5, 2), this.plasmaMat);
      holoBillboard.position.set(0, 14, -25);
      holoBillboard.userData.ringIdx = 1;
      coreGroup.add(holoBillboard);
    } else if (gameMeta.layoutMode === 'volcanic') {
      // GAME 3 (TITANFALL LAVA RAID): Giant Erupting Volcano Caldera Cone with Bubbling Magma Core & Lava Geysers
      coreGroup.position.set(0, 0, 0);
      const volcanoCone = new THREE.Mesh(
        new THREE.ConeGeometry(22, 16, 32, 6, true),
        new THREE.MeshStandardMaterial({
          color: 0x1c0a06,
          roughness: 0.85,
          metalness: 0.2,
          emissive: 0x7c2d12,
          emissiveIntensity: 0.35,
          side: THREE.DoubleSide,
        })
      );
      volcanoCone.position.y = 7.5;
      coreGroup.add(volcanoCone);

      const magmaPool = new THREE.Mesh(new THREE.DodecahedronGeometry(5.5, 3), this.plasmaMat);
      magmaPool.position.y = 14.5;
      magmaPool.userData.ringIdx = 0;
      coreGroup.add(magmaPool);

      // Erupting Lava Plume Columns
      const plumeMat = new THREE.MeshBasicMaterial({ color: 0xf97316, wireframe: true });
      for (let k = 0; k < 3; k++) {
        const plume = new THREE.Mesh(new THREE.CylinderGeometry(0.8 + k * 1.2, 3.2, 24, 16, 8, true), plumeMat);
        plume.position.y = 20 + k * 3;
        plume.userData.ringIdx = k + 1;
        coreGroup.add(plume);
      }
    } else if (gameMeta.layoutMode === 'colosseum') {
      // GAME 4 (NEXUS MECH ARENA): Giant Articulated Combat Titan Mech Boss in Center of Hexagonal Arena
      coreGroup.position.set(0, 0, 0);
      const armorMat = new THREE.MeshStandardMaterial({
        color: 0x111e1a,
        metalness: 0.92,
        roughness: 0.22,
        emissive: 0x10b981,
        emissiveIntensity: 0.28,
      });
      // Mech Legs
      const leftLeg = new THREE.Mesh(new THREE.BoxGeometry(2.4, 9.5, 2.8), armorMat);
      leftLeg.position.set(-3.4, 4.75, 0);
      const rightLeg = new THREE.Mesh(new THREE.BoxGeometry(2.4, 9.5, 2.8), armorMat);
      rightLeg.position.set(3.4, 4.75, 0);
      // Mech Torso
      const torso = new THREE.Mesh(new THREE.BoxGeometry(9.6, 8.2, 5.4), armorMat);
      torso.position.set(0, 13.2, 0);
      // Glowing Chest Arc Reactor
      const chestCore = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.2, 5.8, 24), this.plasmaMat);
      chestCore.rotation.x = Math.PI / 2;
      chestCore.position.set(0, 13.5, 0);
      // Shoulder Railgun Pods & Twin Laser Arms
      const leftPod = new THREE.Mesh(new THREE.BoxGeometry(3.2, 3.8, 7.5), armorMat);
      leftPod.position.set(-6.5, 17.5, -0.5);
      const rightPod = new THREE.Mesh(new THREE.BoxGeometry(3.2, 3.8, 7.5), armorMat);
      rightPod.position.set(6.5, 17.5, -0.5);
      const headVisor = new THREE.Mesh(
        new THREE.BoxGeometry(3.6, 2.0, 3.2),
        new THREE.MeshBasicMaterial({ color: 0x38bdf8 })
      );
      headVisor.position.set(0, 18.8, 0.6);
      // Energy Shield Dome around Mech
      const hexShield = new THREE.Mesh(
        new THREE.IcosahedronGeometry(16.5, 2),
        new THREE.MeshBasicMaterial({ color: 0x10b981, wireframe: true, transparent: true, opacity: 0.18 })
      );
      hexShield.position.y = 11;
      hexShield.userData.ringIdx = 0;
      coreGroup.add(leftLeg, rightLeg, torso, chestCore, leftPod, rightPod, headVisor, hexShield);
    } else if (gameMeta.layoutMode === 'abyss') {
      // GAME 5 (LEVIATHAN DEEP TRENCH): Colossal Bioluminescent Sea Leviathan (Coiled Serpent + Glowing Tentacles)
      coreGroup.position.set(0, 11.0, 0);
      const leviathanBody = new THREE.Mesh(new THREE.TorusKnotGeometry(6.8, 1.35, 180, 28, 2, 3), this.plasmaMat);
      leviathanBody.userData.ringIdx = 0;
      coreGroup.add(leviathanBody);

      const finMat = new THREE.MeshStandardMaterial({
        color: 0x042f2e,
        emissive: 0x2dd4bf,
        emissiveIntensity: 0.65,
        transparent: true,
        opacity: 0.78,
        wireframe: true,
      });
      for (let t = 0; t < 6; t++) {
        const tentacle = new THREE.Mesh(new THREE.ConeGeometry(0.9, 18, 12, 8, true), finMat);
        const a = (t / 6) * Math.PI * 2;
        tentacle.position.set(Math.cos(a) * 9, -3, Math.sin(a) * 9);
        tentacle.rotation.z = Math.cos(a) * 0.45;
        tentacle.rotation.x = Math.sin(a) * 0.45;
        coreGroup.add(tentacle);
      }
    } else if (gameMeta.layoutMode === 'asteroid') {
      // GAME 6 (DREADNOUGHT ARMADA): 45-Meter Orbital Battlecruiser Flagship in Asteroid Field
      coreGroup.position.set(0, 11.5, 0);
      const hullMat = new THREE.MeshStandardMaterial({
        color: 0x1e1b2e,
        metalness: 0.9,
        roughness: 0.22,
        emissive: 0xa855f7,
        emissiveIntensity: 0.2,
      });
      // Main Elongated Hull
      const mainHull = new THREE.Mesh(new THREE.BoxGeometry(7.5, 4.2, 34), hullMat);
      const prow = new THREE.Mesh(new THREE.ConeGeometry(5.2, 14, 4), hullMat);
      prow.rotation.x = Math.PI / 2;
      prow.rotation.z = Math.PI / 4;
      prow.position.z = 24;
      // Command Bridge Tower
      const bridge = new THREE.Mesh(new THREE.BoxGeometry(4.2, 5.5, 8.5), hullMat);
      bridge.position.set(0, 4.5, -6);
      // Wings
      const wings = new THREE.Mesh(new THREE.BoxGeometry(26, 0.9, 10), hullMat);
      wings.position.set(0, 0, -4);
      // Glowing Warp Thrusters at Rear
      const thrusterCore = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 3.2, 4.5, 20), this.plasmaMat);
      thrusterCore.rotation.x = Math.PI / 2;
      thrusterCore.position.set(0, 0, -18.5);
      coreGroup.add(mainHull, prow, bridge, wings, thrusterCore);
      coreGroup.userData.isFlagship = true;
    } else if (gameMeta.layoutMode === 'dyson') {
      // GAME 7 (VALKYRIE DYSON SPHERE): Blazing Star Enveloped by 6 Massive Segmented Dyson Collector Rings
      coreGroup.position.set(0, 15.0, 0);
      const blazingSun = new THREE.Mesh(new THREE.SphereGeometry(5.8, 48, 48), this.plasmaMat);
      coreGroup.add(blazingSun);

      const dysonMat = new THREE.MeshStandardMaterial({
        color: 0x1c1917,
        metalness: 0.95,
        roughness: 0.14,
        emissive: 0xf59e0b,
        emissiveIntensity: 0.42,
      });
      for (let r = 0; r < 6; r++) {
        const ring = new THREE.Mesh(
          new THREE.CylinderGeometry(11 + r * 3.8, 11 + r * 3.8, 1.8 + (r % 2) * 1.1, 36, 1, true),
          dysonMat
        );
        ring.material.side = THREE.DoubleSide;
        ring.rotation.set(r * 0.55, r * 0.8, r * 0.35);
        ring.userData.ringIdx = r;
        coreGroup.add(ring);
      }
      const shockShell = new THREE.Mesh(
        new THREE.SphereGeometry(20, 32, 24),
        new THREE.MeshBasicMaterial({
          color: 0xf59e0b,
          wireframe: true,
          transparent: true,
          opacity: 0.26,
        })
      );
      shockShell.userData.ringIdx = 1;
      coreGroup.add(shockShell);
    } else if (gameMeta.layoutMode === 'skyland') {
      // GAME 9 (AETHER SKY ARCHIPELAGO): Giant Central Floating Sky Island with inverted rocky spire + Rotating Aether Wind Turbine
      coreGroup.position.set(0, 12.0, 0);
      const islandRock = new THREE.Mesh(
        new THREE.ConeGeometry(13.5, 16.0, 9),
        new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.75, metalness: 0.25, flatShading: true })
      );
      islandRock.rotation.x = Math.PI;
      islandRock.position.y = -6.5;
      const topPlateau = new THREE.Mesh(
        new THREE.CylinderGeometry(13.5, 13.5, 1.4, 9),
        new THREE.MeshStandardMaterial({ color: 0x0f766e, roughness: 0.45, metalness: 0.35 })
      );
      topPlateau.position.y = 1.6;
      const aetherCore = new THREE.Mesh(new THREE.OctahedronGeometry(4.2, 2), this.plasmaMat);
      aetherCore.position.y = 7.5;
      // 4 giant wind-turbine rotor blades
      const rotorGroup = new THREE.Group();
      rotorGroup.position.y = 7.5;
      rotorGroup.userData.ringIdx = 0;
      const bladeMat = new THREE.MeshStandardMaterial({
        color: 0xfbbf24,
        metalness: 0.9,
        roughness: 0.15,
        emissive: 0x38bdf8,
        emissiveIntensity: 0.35,
      });
      for (let b = 0; b < 4; b++) {
        const blade = new THREE.Mesh(new THREE.BoxGeometry(19, 1.4, 0.35), bladeMat);
        blade.rotation.z = (b / 4) * Math.PI;
        rotorGroup.add(blade);
      }
      coreGroup.add(islandRock, topPlateau, aetherCore, rotorGroup);
    } else if (gameMeta.layoutMode === 'clockwork') {
      // GAME 10 (CHRONOS TIME RIFT): Giant Concentric Clockwork Astrolabe with Rotating Gear Rings & Pendulum Hands
      coreGroup.position.set(0, 13.5, 0);
      const timeOrb = new THREE.Mesh(new THREE.DodecahedronGeometry(3.6, 2), this.plasmaMat);
      coreGroup.add(timeOrb);
      const brassMat = new THREE.MeshStandardMaterial({
        color: 0xd97706,
        metalness: 0.95,
        roughness: 0.14,
        emissive: 0xf59e0b,
        emissiveIntensity: 0.35,
      });
      for (let g = 0; g < 4; g++) {
        const gear = new THREE.Mesh(new THREE.TorusGeometry(6.8 + g * 3.2, 0.42, 8, 24), brassMat);
        gear.userData.ringIdx = g;
        coreGroup.add(gear);
      }
      const clockHandLong = new THREE.Mesh(new THREE.BoxGeometry(0.65, 17.5, 0.45), brassMat);
      clockHandLong.userData.ringIdx = 1;
      const clockHandShort = new THREE.Mesh(new THREE.BoxGeometry(12.5, 0.75, 0.45), brassMat);
      clockHandShort.userData.ringIdx = 2;
      coreGroup.add(clockHandLong, clockHandShort);
    } else if (gameMeta.layoutMode === 'glacial') {
      // GAME 11 (CRYO-ZERO GLACIER): Towering Translucent Cryo-Crystal Fortress Monolith & Frost Rings
      coreGroup.position.set(0, 0, 0);
      const iceMat = new THREE.MeshPhysicalMaterial({
        color: 0x7dd3fc,
        emissive: 0x0284c7,
        emissiveIntensity: 0.45,
        metalness: 0.15,
        roughness: 0.08,
        transmission: 0.78,
        ior: 1.31,
        clearcoat: 1.0,
      });
      const mainSpire = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 5.5, 28, 6), iceMat);
      mainSpire.position.y = 14;
      coreGroup.add(mainSpire);
      for (let c = 0; c < 6; c++) {
        const a = (c / 6) * Math.PI * 2;
        const subSpire = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 2.8, 18, 6), iceMat);
        subSpire.position.set(Math.cos(a) * 7.5, 8.5, Math.sin(a) * 7.5);
        subSpire.rotation.z = -Math.cos(a) * 0.28;
        subSpire.rotation.x = -Math.sin(a) * 0.28;
        coreGroup.add(subSpire);
      }
      const cryoHeart = new THREE.Mesh(new THREE.OctahedronGeometry(3.8, 2), this.plasmaMat);
      cryoHeart.position.y = 15;
      cryoHeart.userData.ringIdx = 0;
      coreGroup.add(cryoHeart);
    } else if (gameMeta.layoutMode === 'biohive') {
      // GAME 12 (XENO BIO-HIVE): Pulsating Bio-Organic Alien Queen Nest with Spore Sacs & Arched Carapace Ribs
      coreGroup.position.set(0, 9.5, 0);
      const hiveSac = new THREE.Mesh(new THREE.SphereGeometry(5.6, 32, 32), this.plasmaMat);
      hiveSac.scale.set(1.0, 1.45, 1.0);
      hiveSac.userData.ringIdx = 0;
      coreGroup.add(hiveSac);
      const chitinMat = new THREE.MeshStandardMaterial({
        color: 0x1a2e05,
        emissive: 0x84cc16,
        emissiveIntensity: 0.4,
        roughness: 0.3,
        metalness: 0.65,
      });
      for (let r = 0; r < 8; r++) {
        const a = (r / 8) * Math.PI * 2;
        const rib = new THREE.Mesh(new THREE.TorusGeometry(8.5, 0.55, 10, 32, Math.PI * 1.15), chitinMat);
        rib.rotation.y = a;
        rib.rotation.z = 0.35;
        coreGroup.add(rib);
      }
    } else if (gameMeta.layoutMode === 'stargate') {
      // GAME 13 (VALHALLA STARGATE): Vertical 32m Intergalactic Stargate Ring with Rippling Event Horizon Portal
      coreGroup.position.set(0, 15.0, 0);
      const gateRingMat = new THREE.MeshStandardMaterial({
        color: 0x1e293b,
        metalness: 0.94,
        roughness: 0.16,
        emissive: 0x3b82f6,
        emissiveIntensity: 0.5,
      });
      const outerGate = new THREE.Mesh(new THREE.TorusGeometry(15.5, 1.45, 16, 72), gateRingMat);
      const innerChevronRing = new THREE.Mesh(new THREE.TorusGeometry(13.4, 0.55, 12, 48), gateRingMat);
      innerChevronRing.userData.ringIdx = 0;
      const portalHorizon = new THREE.Mesh(new THREE.CircleGeometry(13.0, 64), this.plasmaMat);
      portalHorizon.material.side = THREE.DoubleSide;
      coreGroup.add(outerGate, innerChevronRing, portalHorizon);
    } else if (gameMeta.layoutMode === 'mainframe') {
      // GAME 14 (OMEGA AI MATRIX): Levitating 4D Quantum Data Hypercube & Vertical Holographic Data Pillars
      coreGroup.position.set(0, 12.0, 0);
      const matWire = new THREE.MeshBasicMaterial({ color: 0x10b981, wireframe: true });
      const outerCube = new THREE.Mesh(new THREE.BoxGeometry(12.5, 12.5, 12.5, 4, 4, 4), matWire);
      outerCube.userData.ringIdx = 0;
      const midCube = new THREE.Mesh(
        new THREE.BoxGeometry(7.8, 7.8, 7.8, 2, 2, 2),
        new THREE.MeshBasicMaterial({ color: 0x06b6d4, wireframe: true })
      );
      midCube.userData.ringIdx = 1;
      const aiBrain = new THREE.Mesh(new THREE.OctahedronGeometry(4.0, 1), this.plasmaMat);
      aiBrain.userData.ringIdx = 2;
      coreGroup.add(outerCube, midCube, aiBrain);
    } else if (gameMeta.layoutMode === 'eclipse') {
      // GAME 15 (ECLIPSE BLACK SUN): Pitch-Black Void Star Occulting a Blazing Golden Gravitational Lens Corona
      coreGroup.position.set(0, 15.0, 0);
      const blackSun = new THREE.Mesh(
        new THREE.SphereGeometry(7.2, 48, 48),
        new THREE.MeshBasicMaterial({ color: 0x020104 })
      );
      const coronaHalo = new THREE.Mesh(new THREE.TorusGeometry(7.8, 0.85, 24, 96), this.plasmaMat);
      const lensRing = new THREE.Mesh(
        new THREE.TorusGeometry(13.5, 0.25, 16, 96),
        new THREE.MeshBasicMaterial({ color: 0xf97316 })
      );
      lensRing.rotation.x = 1.15;
      lensRing.userData.ringIdx = 0;
      coreGroup.add(blackSun, coronaHalo, lensRing);
    } else if (gameMeta.layoutMode === 'orbital_cannon') {
      // GAME 16 (RAGNAROK ORBITAL CANNON): Massive 38-Meter Twin-Barrel Planetary Railgun Fortress Aimed at Orbit
      coreGroup.position.set(0, 0, 0);
      const gunMetal = new THREE.MeshStandardMaterial({
        color: 0x18181b,
        metalness: 0.92,
        roughness: 0.2,
        emissive: 0xef4444,
        emissiveIntensity: 0.3,
      });
      const turretBase = new THREE.Mesh(new THREE.CylinderGeometry(9.5, 12.5, 6.5, 12), gunMetal);
      turretBase.position.y = 3.25;
      const barrelGroup = new THREE.Group();
      barrelGroup.position.set(0, 7.5, 0);
      barrelGroup.rotation.x = -0.58; // Aimed skyward at 55 degrees
      const leftBarrel = new THREE.Mesh(new THREE.BoxGeometry(2.2, 2.4, 34), gunMetal);
      leftBarrel.position.set(-2.6, 0, -12);
      const rightBarrel = new THREE.Mesh(new THREE.BoxGeometry(2.2, 2.4, 34), gunMetal);
      rightBarrel.position.set(2.6, 0, -12);
      const plasmaRail = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 0.95, 36, 16), this.plasmaMat);
      plasmaRail.rotation.x = Math.PI / 2;
      plasmaRail.position.set(0, 0, -13);
      barrelGroup.add(leftBarrel, rightBarrel, plasmaRail);
      coreGroup.add(turretBase, barrelGroup);
    } else if (gameMeta.layoutMode === 'valhalla') {
      // GAME 17 (VALKYRIE STAR-CARRIER): Twin-Hull Orbital Super-Carrier with Bifrost Plasma Runway Bridge
      coreGroup.position.set(0, 13.0, 0);
      const hullMat = new THREE.MeshStandardMaterial({
        color: 0x0f172a,
        metalness: 0.92,
        roughness: 0.18,
        emissive: 0x38bdf8,
        emissiveIntensity: 0.32,
      });
      const leftHull = new THREE.Mesh(new THREE.BoxGeometry(5.2, 4.2, 38), hullMat);
      leftHull.position.x = -7.5;
      const rightHull = new THREE.Mesh(new THREE.BoxGeometry(5.2, 4.2, 38), hullMat);
      rightHull.position.x = 7.5;
      const bifrostDeck = new THREE.Mesh(new THREE.BoxGeometry(10.5, 0.9, 32), this.plasmaMat);
      const bridgeTower = new THREE.Mesh(new THREE.BoxGeometry(4.5, 7.5, 8.0), hullMat);
      bridgeTower.position.set(7.5, 5.5, -10);
      coreGroup.add(leftHull, rightHull, bifrostDeck, bridgeTower);
      coreGroup.userData.isFlagship = true;
    } else if (gameMeta.layoutMode === 'foundry') {
      // GAME 18 (NEMESIS CYBER-FOUNDRY): Pouring Molten Titanium Crucible Cauldron & Rotating Smelter Arms
      coreGroup.position.set(0, 0, 0);
      const crucibleMat = new THREE.MeshStandardMaterial({
        color: 0x1c1917,
        metalness: 0.88,
        roughness: 0.25,
        emissive: 0xf97316,
        emissiveIntensity: 0.45,
      });
      const cauldron = new THREE.Mesh(new THREE.CylinderGeometry(8.5, 6.2, 9.5, 24), crucibleMat);
      cauldron.position.y = 14.5;
      const moltenStream = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 3.8, 15, 24), this.plasmaMat);
      moltenStream.position.y = 7.0;
      const anvilRing = new THREE.Mesh(new THREE.TorusGeometry(11.5, 1.1, 12, 36), crucibleMat);
      anvilRing.rotation.x = Math.PI / 2;
      anvilRing.position.y = 14.5;
      anvilRing.userData.ringIdx = 0;
      coreGroup.add(cauldron, moltenStream, anvilRing);
    } else if (gameMeta.layoutMode === 'corona') {
      // GAME 19 (SOLARIS MAGNETAR): Star Surface with 5 Giant Arching Magnetic Flare Prominence Loops
      coreGroup.position.set(0, 10.0, 0);
      const magnetarCore = new THREE.Mesh(new THREE.SphereGeometry(6.5, 40, 40), this.plasmaMat);
      coreGroup.add(magnetarCore);
      const loopMat = new THREE.MeshBasicMaterial({
        color: 0xfb923c,
        wireframe: true,
        transparent: true,
        opacity: 0.72,
      });
      for (let l = 0; l < 5; l++) {
        const arch = new THREE.Mesh(new THREE.TorusGeometry(11.5 + (l % 2) * 3.0, 0.95, 14, 48), loopMat);
        arch.rotation.y = (l / 5) * Math.PI;
        arch.userData.ringIdx = l;
        coreGroup.add(arch);
      }
    } else if (gameMeta.layoutMode === 'tartarus') {
      // GAME 20 (TARTARUS CORE DRILL): Giant Spinning Helical Planetary Mantle Drill Bore
      coreGroup.position.set(0, 12.5, 0);
      const drillHead = new THREE.Mesh(new THREE.ConeGeometry(8.5, 22, 16, 8), this.plasmaMat);
      drillHead.rotation.x = Math.PI;
      drillHead.userData.ringIdx = 0;
      const upperGantry = new THREE.Mesh(
        new THREE.CylinderGeometry(10.5, 8.5, 7.5, 12),
        new THREE.MeshStandardMaterial({ color: 0x18181b, metalness: 0.9, roughness: 0.2, emissive: 0xef4444, emissiveIntensity: 0.4 })
      );
      upperGantry.position.y = 13.5;
      coreGroup.add(drillHead, upperGantry);
    } else if (gameMeta.layoutMode === 'ringworld') {
      // GAME 21 (ZEPHYR RINGWORLD): Colossal Vertical Orbital Habitat Halo Arching Across the Sky + Central Artificial Sun
      coreGroup.position.set(0, 14.5, 0);
      const centralSun = new THREE.Mesh(new THREE.SphereGeometry(3.8, 32, 32), this.plasmaMat);
      const haloRing = new THREE.Mesh(
        new THREE.CylinderGeometry(24, 24, 5.2, 64, 1, true),
        new THREE.MeshStandardMaterial({
          color: 0x0f766e,
          metalness: 0.75,
          roughness: 0.22,
          emissive: 0x2dd4bf,
          emissiveIntensity: 0.35,
          side: THREE.DoubleSide,
        })
      );
      haloRing.rotation.z = 0.45;
      haloRing.userData.ringIdx = 0;
      coreGroup.add(centralSun, haloRing);
    } else if (gameMeta.layoutMode === 'phantasm') {
      // GAME 22 (PHANTASM PSIONIC CATHEDRAL): Eldritch Dimensional Eye Surrounded by 8 Floating Gothic Void Spires
      coreGroup.position.set(0, 13.5, 0);
      const voidEye = new THREE.Mesh(new THREE.OctahedronGeometry(5.2, 3), this.plasmaMat);
      voidEye.scale.set(1.3, 0.75, 1.3);
      voidEye.userData.ringIdx = 0;
      coreGroup.add(voidEye);
      const spireMat = new THREE.MeshStandardMaterial({
        color: 0x1e1b4b,
        metalness: 0.9,
        roughness: 0.15,
        emissive: 0xc084fc,
        emissiveIntensity: 0.5,
      });
      for (let s = 0; s < 8; s++) {
        const a = (s / 8) * Math.PI * 2;
        const spire = new THREE.Mesh(new THREE.ConeGeometry(1.1, 14, 5), spireMat);
        spire.position.set(Math.cos(a) * 11.5, 0, Math.sin(a) * 11.5);
        coreGroup.add(spire);
      }
    } else if (gameMeta.layoutMode === 'excalibur') {
      // GAME 23 (EXCALIBUR CITADEL): 36m Vertical Solar Lance Sword Blade Spire Piercing the Arena
      coreGroup.position.set(0, 14.0, 0);
      const blade = new THREE.Mesh(new THREE.BoxGeometry(2.6, 34, 0.75), this.plasmaMat);
      const crossGuard = new THREE.Mesh(
        new THREE.BoxGeometry(16.5, 2.2, 2.8),
        new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.95, roughness: 0.12, emissive: 0xfbbf24, emissiveIntensity: 0.5 })
      );
      crossGuard.position.y = 7.5;
      const shieldRing = new THREE.Mesh(
        new THREE.TorusGeometry(11.5, 0.45, 12, 48),
        new THREE.MeshBasicMaterial({ color: 0x38bdf8 })
      );
      shieldRing.rotation.x = Math.PI / 2;
      shieldRing.userData.ringIdx = 0;
      coreGroup.add(blade, crossGuard, shieldRing);
    } else if (gameMeta.layoutMode === 'singularity') {
      // GAME 24 (OMEGA-ZERO BINARY MERGER): Twin Orbiting Black Holes Connected by an Einstein-Rosen Wormhole Bridge
      coreGroup.position.set(0, 13.5, 0);
      const bhLeft = new THREE.Mesh(new THREE.SphereGeometry(3.8, 32, 32), this.plasmaMat);
      bhLeft.position.x = -8.5;
      const bhRight = new THREE.Mesh(new THREE.SphereGeometry(3.8, 32, 32), this.plasmaMat);
      bhRight.position.x = 8.5;
      const bridge = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.4, 17, 24), this.plasmaMat);
      bridge.rotation.z = Math.PI / 2;
      const waveRing = new THREE.Mesh(
        new THREE.TorusGeometry(14.5, 0.35, 12, 64),
        new THREE.MeshBasicMaterial({ color: 0x22d3ee })
      );
      waveRing.userData.ringIdx = 0;
      coreGroup.add(bhLeft, bhRight, bridge, waveRing);
    } else if (
      gameMeta.layoutMode === 'formula_gp' ||
      gameMeta.layoutMode === 'drift_touge' ||
      gameMeta.layoutMode === 'maglev_track' ||
      gameMeta.layoutMode === 'dakar_rally' ||
      gameMeta.layoutMode === 'bugatti_hypercar' ||
      gameMeta.layoutMode === 'snow_rally'
    ) {
      // HIGH-FIDELITY 3D MOTORSPORT CIRCUITS using gameVehicleModels.ts + Contact Shadows + Steerable Wheels
      coreGroup.position.set(0, 0, 0);
      this.contactShadowTex = createContactShadowTexture();
      this.raceWheels = [];
      this.raceSteerWheels = [];

      const gantryMat = new THREE.MeshStandardMaterial({
        color: 0x0f172a,
        metalness: 0.88,
        roughness: 0.22,
        emissive: gameMeta.lightPalette[0],
        emissiveIntensity: 0.32,
      });
      const darkCarbon = new THREE.MeshStandardMaterial({
        color: 0x090d16,
        metalness: 0.85,
        roughness: 0.25,
      });

      const barrierColor = gameMeta.layoutMode === 'snow_rally' ? 0xf1f5f9 : gameMeta.layoutMode === 'dakar_rally' ? 0x7c2d12 : 0x1e293b;
      const barrierMat = new THREE.MeshStandardMaterial({
        color: barrierColor,
        metalness: 0.35,
        roughness: 0.65,
      });
      const leftBarrier = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.15, 450), barrierMat);
      leftBarrier.position.set(-21.2, 0.58, -125);
      const rightBarrier = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.15, 450), barrierMat);
      rightBarrier.position.set(21.2, 0.58, -125);
      const leftLedRail = new THREE.Mesh(
        new THREE.BoxGeometry(0.18, 0.16, 450),
        new THREE.MeshBasicMaterial({ color: gameMeta.lightPalette[0] })
      );
      leftLedRail.position.set(-20.4, 1.05, -125);
      const rightLedRail = new THREE.Mesh(
        new THREE.BoxGeometry(0.18, 0.16, 450),
        new THREE.MeshBasicMaterial({ color: gameMeta.lightPalette[1] })
      );
      rightLedRail.position.set(20.4, 1.05, -125);
      coreGroup.add(leftBarrier, rightBarrier, leftLedRail, rightLedRail);

      // Infinite Recycling Motorsport Timing Gantries & Floodlights
      this.raceGantries = [];
      for (let g = 0; g < 9; g++) {
        const zGantry = 24 - g * 36;
        const gantry = new THREE.Group();
        gantry.position.set(0, 0, zGantry);
        const leftPylon = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.56, 9.2, 12), gantryMat);
        leftPylon.position.set(-20.2, 4.6, 0);
        const rightPylon = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.56, 9.2, 12), gantryMat);
        rightPylon.position.set(20.2, 4.6, 0);
        const topTruss = new THREE.Mesh(new THREE.BoxGeometry(41.6, 0.9, 1.1), gantryMat);
        topTruss.position.set(0, 8.8, 0);
        const lightStrip = new THREE.Mesh(
          new THREE.BoxGeometry(38.0, 0.22, 0.3),
          new THREE.MeshBasicMaterial({ color: g % 2 === 0 ? gameMeta.lightPalette[0] : gameMeta.lightPalette[1] })
        );
        lightStrip.position.set(0, 8.25, 0.55);
        gantry.add(leftPylon, rightPylon, topTruss, lightStrip);

        if (g === 1) {
          for (let l = -2; l <= 2; l++) {
            const podHousing = new THREE.Mesh(new THREE.BoxGeometry(1.15, 1.45, 0.45), darkCarbon);
            podHousing.position.set(l * 2.2, 7.6, 0.65);
            const greenLight = new THREE.Mesh(
              new THREE.SphereGeometry(0.28, 16, 16),
              new THREE.MeshBasicMaterial({ color: 0x10b981 })
            );
            greenLight.position.set(l * 2.2, 7.6, 0.9);
            gantry.add(podHousing, greenLight);
          }
        }
        coreGroup.add(gantry);
        this.raceGantries.push(gantry);
      }

      const vStyle: VehicleStyle =
        gameMeta.layoutMode === 'snow_rally' ? 'dakar_rally' : (gameMeta.layoutMode as VehicleStyle);

      // 6 Sculpted Rivals
      const rivalSpecs: Array<{ x: number; relZ: number; speedMult: number; color: number; accent: number }> = [
        { x: -6.8, relZ: -16, speedMult: 1.02, color: 0xef4444, accent: 0xfef08a },
        { x: 6.9, relZ: -30, speedMult: 0.99, color: 0x2563eb, accent: 0x38bdf8 },
        { x: -3.6, relZ: -46, speedMult: 1.04, color: 0x10b981, accent: 0xa7f3d0 },
        { x: 4.8, relZ: -66, speedMult: 0.97, color: 0xf59e0b, accent: 0xfde047 },
        { x: -8.0, relZ: -88, speedMult: 1.01, color: 0x9333ea, accent: 0xe879f9 },
        { x: 2.5, relZ: -112, speedMult: 1.03, color: 0xe2e8f0, accent: 0x06b6d4 },
      ];
      for (let rIdx = 0; rIdx < rivalSpecs.length; rIdx++) {
        const spec = rivalSpecs[rIdx];
        const rivalCar = createDetailedRaceCarModel({
          style: vStyle,
          paintHex: spec.color,
          accentHex: spec.accent,
          isHero: false,
          plasmaMat: this.plasmaMat,
          shadowTex: this.contactShadowTex,
          wheelRegister: this.raceWheels,
        });
        rivalCar.scale.setScalar(1.24);
        rivalCar.position.set(spec.x, 0.02, 16 + spec.relZ);
        rivalCar.userData.rivalIdx = rIdx;
        rivalCar.userData.baseX = spec.x;
        rivalCar.userData.relZ = spec.relZ;
        rivalCar.userData.speedMult = spec.speedMult;
        coreGroup.add(rivalCar);
      }

      // Hero Player Car
      const heroPaint =
        gameMeta.layoutMode === 'bugatti_hypercar'
          ? 0x0ea5e9
          : gameMeta.layoutMode === 'snow_rally'
            ? 0xf8fafc
            : gameMeta.lightPalette[0];
      const carGroup = createDetailedRaceCarModel({
        style: vStyle,
        paintHex: heroPaint,
        accentHex: gameMeta.lightPalette[1],
        isHero: true,
        plasmaMat: this.plasmaMat,
        shadowTex: this.contactShadowTex,
        wheelRegister: this.raceWheels,
        frontSteerRegister: this.raceSteerWheels,
      });
      carGroup.scale.setScalar(1.34);
      carGroup.position.set(0, 0.04, 16.0);
      scene.add(carGroup);
      this.playerCarGroup = carGroup;
      this.playerCarX = 0;
      this.playerCarSteer = 0;
      this.raceSpeedKmh =
        gameMeta.layoutMode === 'maglev_track'
          ? 840
          : gameMeta.layoutMode === 'bugatti_hypercar'
            ? 438
            : 356;
      this.raceLap = 1;
      this.raceNitroPct = 100;
      this.racePosition = 4;

      if (this.camera) {
        this.camera.position.set(0, 2.75, 24.4);
        this.camera.lookAt(0, 1.18, -14.0);
      }
    } else if (gameMeta.layoutMode === 'soccer_stadium') {
      // CHAMPIONS STADIUM 3D: Two 3D Goalposts + Nets, 4 Stadium Floodlight Towers, 5v5 Articulated Kit Players + Hero #10 & Playable Soccer Ball
      coreGroup.position.set(0, 0, 0);
      const goalMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, metalness: 0.35, roughness: 0.25 });
      const netMat = new THREE.MeshBasicMaterial({ color: 0xe2e8f0, wireframe: true, transparent: true, opacity: 0.45 });

      const buildGoal = (zSign: number) => {
        const gGroup = new THREE.Group();
        const postGeo = new THREE.CylinderGeometry(0.14, 0.14, 3.8, 12);
        const postL = new THREE.Mesh(postGeo, goalMat);
        postL.position.set(-5.2, 1.9, zSign * 37.5);
        const postR = new THREE.Mesh(postGeo, goalMat);
        postR.position.set(5.2, 1.9, zSign * 37.5);
        const crossbar = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 10.6, 12), goalMat);
        crossbar.rotation.z = Math.PI / 2;
        crossbar.position.set(0, 3.8, zSign * 37.5);
        const netBack = new THREE.Mesh(new THREE.BoxGeometry(10.4, 3.8, 2.8, 10, 4, 3), netMat);
        netBack.position.set(0, 1.9, zSign * 38.9);
        gGroup.add(postL, postR, crossbar, netBack);
        return gGroup;
      };
      coreGroup.add(buildGoal(-1), buildGoal(1));

      // 4 Tall Stadium Floodlight Towers outside pitch perimeter
      const pylonMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.85, roughness: 0.25 });
      const lampMat = new THREE.MeshBasicMaterial({ color: 0xfef9c3 });
      for (const sx of [-31, 31]) {
        for (const sz of [-44, 44]) {
          const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.8, 24, 10), pylonMat);
          mast.position.set(sx, 12, sz);
          const bank = new THREE.Mesh(new THREE.BoxGeometry(5.5, 2.2, 1.2), lampMat);
          bank.position.set(sx, 24.5, sz);
          bank.lookAt(0, 0, 0);
          coreGroup.add(mast, bank);
        }
      }

      // Stadium Upper Canopy Floodlight Halo Ring & Corner Flags
      const canopyHalo = new THREE.Mesh(
        new THREE.TorusGeometry(46, 1.8, 8, 64),
        new THREE.MeshStandardMaterial({
          color: 0x0f172a,
          metalness: 0.85,
          roughness: 0.25,
          emissive: 0x38bdf8,
          emissiveIntensity: 0.35,
        })
      );
      canopyHalo.rotation.x = Math.PI / 2;
      canopyHalo.position.y = 22.5;
      coreGroup.add(canopyHalo);

      const flagMat = new THREE.MeshBasicMaterial({ color: 0xfacc15, side: THREE.DoubleSide });
      const poleMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, metalness: 0.4, roughness: 0.4 });
      for (const [fx, fz] of [[-25, -39], [25, -39], [-25, 39], [25, 39]] as [number, number][]) {
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.8, 8), poleMat);
        pole.position.set(fx, 0.9, fz);
        const flag = new THREE.Mesh(new THREE.PlaneGeometry(0.55, 0.38), flagMat);
        flag.position.set(fx + 0.28, 1.6, fz);
        coreGroup.add(pole, flag);
      }

      this.contactShadowTex = createContactShadowTexture();

      // Detailed Textured Soccer Ball
      const ballCanvas = document.createElement('canvas');
      ballCanvas.width = 256;
      ballCanvas.height = 128;
      const bctx = ballCanvas.getContext('2d')!;
      bctx.fillStyle = '#f8fafc';
      bctx.fillRect(0, 0, 256, 128);
      bctx.fillStyle = '#0f172a';
      for (let gx = 16; gx < 256; gx += 48) {
        for (let gy = 18; gy < 128; gy += 44) {
          bctx.beginPath();
          for (let k = 0; k < 5; k++) {
            const a = (k / 5) * Math.PI * 2 - Math.PI / 2;
            const px = gx + Math.cos(a) * 12;
            const py = gy + Math.sin(a) * 12;
            if (k === 0) bctx.moveTo(px, py);
            else bctx.lineTo(px, py);
          }
          bctx.closePath();
          bctx.fill();
        }
      }
      const ballTex = new THREE.CanvasTexture(ballCanvas);
      ballTex.colorSpace = THREE.SRGBColorSpace;
      const ball = new THREE.Mesh(
        new THREE.SphereGeometry(0.46, 24, 24),
        new THREE.MeshStandardMaterial({ map: ballTex, roughness: 0.28, metalness: 0.12 })
      );
      ball.castShadow = true;
      ball.position.set(0, 0.46, 0);
      scene.add(ball);
      this.soccerBallMesh = ball;
      this.soccerBallPos.set(0, 0.46, 0);
      this.soccerBallVel.set(2.5, 0, -6.5);
      this.soccerPlayerPos.set(0, 0, 12);
      this.soccerPlayerYaw = 0;
      this.soccerScoreHome = 0;
      this.soccerScoreAway = 0;
      this.soccerMatchSec = 0;

      // Hero #10 Striker + 4 teammates + 5 rivals (1 GK + 4 outfield) using articulated anatomical models
      const hero = createArticulatedSoccerPlayer(0x38bdf8, true, this.contactShadowTex);
      hero.position.copy(this.soccerPlayerPos);
      scene.add(hero);
      this.soccerPlayerGroup = hero;

      this.soccerTeammates = [];
      const mateCoords: [number, number][] = [[-9, 4], [9, 4], [-7, 22], [0, 35.5]];
      for (const [mx, mz] of mateCoords) {
        const mate = createArticulatedSoccerPlayer(0x2563eb, false, this.contactShadowTex);
        mate.position.set(mx, 0, mz);
        mate.userData.baseX = mx;
        mate.userData.baseZ = mz;
        scene.add(mate);
        this.soccerTeammates.push(mate);
      }

      this.soccerOpponents = [];
      const oppCoords: [number, number][] = [[0, -35.2], [-9, -18], [9, -18], [-4, -4], [5, -6]];
      for (const [ox, oz] of oppCoords) {
        const opp = createArticulatedSoccerPlayer(0xef4444, false, this.contactShadowTex);
        opp.position.set(ox, 0, oz);
        opp.userData.baseX = ox;
        opp.userData.baseZ = oz;
        scene.add(opp);
        this.soccerOpponents.push(opp);
      }

      if (this.camera) {
        this.camera.position.set(0, 15, 34);
        this.camera.lookAt(0, 1.2, -4);
      }
    } else if (
      gameMeta.layoutMode === 'f22_jet' ||
      gameMeta.layoutMode === 'sr71_plane' ||
      gameMeta.layoutMode === 'apache_heli'
    ) {
      // 3D SUPERSONIC FIGHTERS & ATTACK HELICOPTER + VOLUMETRIC CLOUD DECK
      coreGroup.position.set(0, 0, 0);
      this.aircraftRotors = [];
      const fStyle = gameMeta.layoutMode as FlightStyle;
      const heroAir = createDetailedAircraftModel({
        style: fStyle,
        accentHex: gameMeta.lightPalette[0],
        plasmaMat: this.plasmaMat,
        rotorRegister: this.aircraftRotors,
      });
      heroAir.scale.setScalar(1.38);
      heroAir.position.set(0, 11.0, 14.0);
      scene.add(heroAir);
      this.playerAircraftGroup = heroAir;
      this.playerCarX = 0;
      this.playerFlightY = 11.0;
      this.playerFlightPitch = 0;
      this.raceSpeedKmh = fStyle === 'sr71_plane' ? 2850 : fStyle === 'f22_jet' ? 1680 : 325;
      this.raceNitroPct = 100;

      // 2 Wingman aircraft flying in tactical echelon ahead
      for (const [wx, wy, wz] of [[-13, 14, -14], [14, 15.5, -24]] as [number, number, number][]) {
        const wing = createDetailedAircraftModel({
          style: fStyle,
          accentHex: gameMeta.lightPalette[1],
          plasmaMat: this.plasmaMat,
          rotorRegister: this.aircraftRotors,
        });
        wing.position.set(wx, wy, wz);
        wing.userData.wingX = wx;
        wing.userData.wingY = wy;
        wing.userData.wingZ = wz;
        wing.userData.isWingman = true;
        coreGroup.add(wing);
      }

      // Sculpted volumetric 3D cloud clusters (outside central flight lane)
      const cloudCount = 46;
      const cloudGeo = new THREE.IcosahedronGeometry(2.6, 2);
      const cloudMat = new THREE.MeshStandardMaterial({
        color: gameMeta.layoutMode === 'f22_jet' ? 0xfed7aa : 0xdbeafe,
        roughness: 0.95,
        metalness: 0.02,
        transparent: true,
        opacity: 0.56,
        depthWrite: false,
      });
      const clouds = new THREE.InstancedMesh(cloudGeo, cloudMat, cloudCount);
      this.flightCloudMeta = new Float32Array(cloudCount * 5);
      for (let c = 0; c < cloudCount; c++) {
        const side = c % 2 === 0 ? 1 : -1;
        const cx = side * (16 + (c % 5) * 14 + Math.random() * 12);
        const cy = (c % 3 === 0 ? -5 : 18) + (c % 7) * 2.4;
        const cz = -((c * 6.5) % 260) + 40;
        const scX = 2.4 + (c % 4) * 1.1;
        const scY = 0.75 + (c % 3) * 0.35;
        this.flightCloudMeta[c * 5] = cx;
        this.flightCloudMeta[c * 5 + 1] = cy;
        this.flightCloudMeta[c * 5 + 2] = cz;
        this.flightCloudMeta[c * 5 + 3] = scX;
        this.flightCloudMeta[c * 5 + 4] = scY;
        _dummy.position.set(cx, cy, cz);
        _dummy.rotation.set(0, c * 0.4, 0);
        _dummy.scale.set(scX, scY, scX * 1.4);
        _dummy.updateMatrix();
        clouds.setMatrixAt(c, _dummy.matrix);
      }
      clouds.instanceMatrix.needsUpdate = true;
      clouds.computeBoundingSphere();
      coreGroup.add(clouds);
      this.flightCloudsMesh = clouds;

      if (this.camera) {
        this.camera.position.set(0, 14.5, 29.0);
        this.camera.lookAt(0, 11.0, -24.0);
      }
    } else {
      // GAME 8 (HELIOS SUPERNOVA SHOCKWAVE): Exploding Hypergiant Star with 24 Radial Crystalline Shockwave Spikes & Expanding Blast Shells
      coreGroup.position.set(0, 14.0, 0);
      const hyperCore = new THREE.Mesh(new THREE.IcosahedronGeometry(4.8, 4), this.plasmaMat);
      coreGroup.add(hyperCore);

      const spikeMat = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        emissive: 0xf43f5e,
        emissiveIntensity: 0.85,
        metalness: 0.9,
        roughness: 0.1,
      });
      for (let s = 0; s < 24; s++) {
        const spike = new THREE.Mesh(new THREE.ConeGeometry(0.75, 19, 6), spikeMat);
        const phi = Math.acos(1 - (2 * (s + 0.5)) / 24);
        const theta = Math.PI * (1 + Math.sqrt(5)) * s;
        const dir = new THREE.Vector3(
          Math.cos(theta) * Math.sin(phi),
          Math.sin(theta) * Math.sin(phi),
          Math.cos(phi)
        ).normalize();
        spike.position.copy(dir).multiplyScalar(9.5);
        spike.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
        spike.userData.ringIdx = s % 4;
        coreGroup.add(spike);
      }
    }

    scene.add(coreGroup);
    this.coreGroup = coreGroup;

    this.rebuildHeavyGeometry(scene);
  }

  private rebuildHeavyGeometry(scene: THREE.Scene): void {
    const cfg = GAME_PRESETS[this.preset];
    const gameMeta = this.getGameCatalogItem();

    for (const old of [this.towerMesh, this.accentStripMesh, this.droneMesh, this.particlePoints]) {
      if (old) {
        scene.remove(old);
        old.geometry.dispose();
        const disposeMat = (m: THREE.Material) => {
          const sm = m as THREE.MeshStandardMaterial;
          sm.map?.dispose?.();
          sm.bumpMap?.dispose?.();
          sm.roughnessMap?.dispose?.();
          sm.emissiveMap?.dispose?.();
          m.dispose();
        };
        if (Array.isArray(old.material)) old.material.forEach(disposeMat);
        else disposeMat(old.material);
      }
    }

    // 1. World Structures — Distinct geometry and PBR textured architecture per Game!
    let towerGeo: THREE.BufferGeometry;
    if (gameMeta.layoutMode === 'volcanic') {
      // Sharp jagged volcanic basalt spires
      towerGeo = new THREE.ConeGeometry(1.1, 1, 5);
    } else if (gameMeta.layoutMode === 'asteroid') {
      // Space boulders
      towerGeo = new THREE.DodecahedronGeometry(1.2, 1);
    } else if (gameMeta.layoutMode === 'abyss') {
      // Twisted hydrothermal vents & abyssal crystal formations
      towerGeo = new THREE.OctahedronGeometry(0.9, 1);
    } else if (gameMeta.layoutMode === 'colosseum') {
      // Hexagonal mecha arena fortress bastions
      towerGeo = new THREE.CylinderGeometry(1.1, 1.3, 1, 6);
    } else if (gameMeta.layoutMode === 'dyson') {
      // Orbital solar collector panels floating in a 3D sphere
      towerGeo = new THREE.BoxGeometry(2.4, 0.18, 1.4);
    } else if (gameMeta.layoutMode === 'supernova') {
      // Shattered planetary crystal shards flying outward
      towerGeo = new THREE.TetrahedronGeometry(1.3, 0);
    } else if (gameMeta.layoutMode === 'orbital') {
      // Orbital defense satellites & ring pylons
      towerGeo = new THREE.TorusGeometry(0.9, 0.22, 8, 16);
    } else if (gameMeta.layoutMode === 'skyland') {
      // Floating sky islands (inverted cones)
      towerGeo = new THREE.ConeGeometry(1.5, 2.2, 7);
      towerGeo.rotateX(Math.PI);
    } else if (gameMeta.layoutMode === 'clockwork') {
      // Suspended temporal cogs & gears
      towerGeo = new THREE.CylinderGeometry(1.2, 1.2, 0.3, 12);
    } else if (gameMeta.layoutMode === 'glacial') {
      // Sharp hexagonal ice crystals
      towerGeo = new THREE.CylinderGeometry(0.15, 1.1, 1.4, 6);
    } else if (gameMeta.layoutMode === 'biohive') {
      // Bulbous alien spore pods
      towerGeo = new THREE.SphereGeometry(0.95, 10, 8);
    } else if (gameMeta.layoutMode === 'stargate') {
      // Warp beacon rings
      towerGeo = new THREE.TorusGeometry(1.1, 0.16, 8, 20);
    } else if (gameMeta.layoutMode === 'mainframe') {
      // Data server obelisks
      towerGeo = new THREE.BoxGeometry(0.85, 1.6, 0.85);
    } else if (gameMeta.layoutMode === 'eclipse') {
      // Shadow monolith slabs
      towerGeo = new THREE.BoxGeometry(1.8, 3.2, 0.35);
    } else if (gameMeta.layoutMode === 'orbital_cannon') {
      // Anti-air defense bunkers & shield pylons
      towerGeo = new THREE.CylinderGeometry(0.8, 1.4, 1.2, 8);
    } else if (gameMeta.layoutMode === 'soccer_stadium') {
      // Terraced stadium seating blocks cleanly outside the 54x82m pitch perimeter
      towerGeo = new THREE.BoxGeometry(1.4, 1.0, 1.8);
    } else if (gameMeta.layoutMode === 'dakar_rally' || gameMeta.layoutMode === 'f22_jet') {
      // Canyon mesas & craggy terraced peaks
      towerGeo = new THREE.CylinderGeometry(0.82, 1.55, 1.2, 7);
    } else if (gameMeta.layoutMode === 'snow_rally') {
      // Alpine winter pine trees / snowy peaks
      towerGeo = new THREE.ConeGeometry(1.2, 1.6, 7);
    } else if (gameMeta.layoutMode === 'sr71_plane' || gameMeta.layoutMode === 'apache_heli') {
      // Sculpted mountain ridge spires & coastal monoliths (no flat rectangular boxes!)
      towerGeo = new THREE.CylinderGeometry(0.55, 1.45, 1.35, 6);
    } else {
      // Illuminated glass-curtain skyscrapers / grandstands
      towerGeo = new THREE.BoxGeometry(1, 1, 1);
    }

    const archPbr = createArchitecturePbrTextures(
      gameMeta.layoutMode,
      gameMeta.lightPalette[0],
      this.anisotropy
    );
    const towerMat = new THREE.MeshStandardMaterial({
      color:
        gameMeta.layoutMode === 'dakar_rally'
          ? 0xd6a488
          : gameMeta.layoutMode === 'snow_rally'
            ? 0xeef6ff
            : 0xffffff,
      map: archPbr.map,
      bumpMap: archPbr.bumpMap,
      bumpScale: 0.045,
      roughnessMap: archPbr.roughnessMap,
      emissiveMap: archPbr.emissiveMap,
      metalness: gameMeta.layoutMode === 'dakar_rally' || gameMeta.layoutMode === 'snow_rally' ? 0.14 : 0.76,
      roughness: gameMeta.layoutMode === 'dakar_rally' || gameMeta.layoutMode === 'snow_rally' ? 0.82 : 0.34,
      emissive: 0xffffff,
      emissiveIntensity:
        gameMeta.layoutMode === 'supernova' || gameMeta.layoutMode === 'dyson'
          ? 0.9
          : gameMeta.layoutMode === 'dakar_rally' || gameMeta.layoutMode === 'snow_rally'
            ? 0.15
            : 0.72,
    });
    const densityFactor = Math.max(0.25, Math.min(1, this.sceneryDensityPct / 100));
    const effectiveTowers = Math.max(24, Math.round(cfg.towers * densityFactor));
    const towers = new THREE.InstancedMesh(towerGeo, towerMat, effectiveTowers);
    towers.castShadow = this.shadowsEnabled;
    towers.receiveShadow = true;

    const stripGeo = new THREE.BoxGeometry(1.06, 0.18, 1.06);
    const stripMat = new THREE.MeshBasicMaterial({ color: gameMeta.lightPalette[0] });
    const strips = new THREE.InstancedMesh(stripGeo, stripMat, effectiveTowers);

    for (let i = 0; i < effectiveTowers; i++) {
      let px = 0;
      let py = 0;
      let pz = 0;
      let sx = 1.6 + Math.random() * 2.8;
      let sy = 5 + Math.random() * 28;
      let sz = 1.6 + Math.random() * 2.8;
      let rx = 0;
      let ry = (i / effectiveTowers) * Math.PI * 2 * 4 + Math.random() * 0.18;
      let rz = 0;

      if (
        gameMeta.layoutMode === 'corridor' ||
        gameMeta.layoutMode === 'formula_gp' ||
        gameMeta.layoutMode === 'drift_touge' ||
        gameMeta.layoutMode === 'maglev_track' ||
        gameMeta.layoutMode === 'dakar_rally' ||
        gameMeta.layoutMode === 'bugatti_hypercar' ||
        gameMeta.layoutMode === 'snow_rally' ||
        gameMeta.layoutMode === 'f22_jet' ||
        gameMeta.layoutMode === 'sr71_plane' ||
        gameMeta.layoutMode === 'apache_heli'
      ) {
        // Keep scenery STRICTLY outside road / flight corridor (|x| >= 25) so ZERO clutter blocks track view!
        const side = i % 2 === 0 ? 1 : -1;
        const row = Math.floor(i / 2);
        const laneOffset = 25 + (row % 5) * 9 + Math.random() * 3.0;
        px = side * laneOffset;
        pz = ((row * 4.2) % 240) - 180;
        sy = gameMeta.layoutMode === 'dakar_rally' || gameMeta.layoutMode === 'snow_rally'
          ? 7 + (row % 6) * 4.2
          : gameMeta.layoutMode === 'f22_jet' || gameMeta.layoutMode === 'apache_heli'
            ? 16 + (row % 7) * 7
            : 11 + (row % 6) * 4.5 + Math.random() * 8;
        sx = gameMeta.layoutMode === 'dakar_rally' || gameMeta.layoutMode === 'f22_jet' ? 4.2 : 2.2;
        sz = sx;
        py = gameMeta.layoutMode === 'f22_jet' || gameMeta.layoutMode === 'sr71_plane' ? sy / 2 - 12 : sy / 2;
        ry = 0;
      } else if (gameMeta.layoutMode === 'soccer_stadium') {
        // Stadium terraced spectator stands cleanly outside the 54x82m grass field
        const side = i % 2 === 0 ? 1 : -1;
        const tier = Math.floor(i / 2) % 4;
        const col = Math.floor(i / 8);
        px = side * (32 + tier * 3.8);
        pz = ((col * 3.2) % 86) - 43;
        sx = 2.6;
        sz = 2.6;
        sy = 3.2 + tier * 3.4;
        py = sy / 2;
        ry = 0;
      } else if (gameMeta.layoutMode === 'asteroid') {
        // Dense 3D tumbling asteroid field surrounding the flagship
        const ring = 14 + (i % 12) * 7.5 + Math.random() * 6;
        px = Math.cos(ry) * ring;
        pz = Math.sin(ry) * ring;
        sx = 1.5 + Math.random() * 3.8;
        sy = 1.2 + Math.random() * 3.4;
        sz = 1.5 + Math.random() * 3.8;
        py = -18 + Math.random() * 58;
        rx = i * 0.7;
        rz = i * 0.4;
      } else if (gameMeta.layoutMode === 'dyson') {
        // 3D spherical shell of solar collector mirrors orbiting the star
        const phi = Math.acos(1 - (2 * (i + 0.5)) / cfg.towers);
        const theta = Math.PI * (1 + Math.sqrt(5)) * i;
        const rad = 32 + (i % 4) * 8;
        px = rad * Math.sin(phi) * Math.cos(theta);
        py = 15 + rad * Math.cos(phi) * 0.75;
        pz = rad * Math.sin(phi) * Math.sin(theta);
        sx = 2.2;
        sy = 2.2;
        sz = 2.2;
        rx = phi;
        ry = theta;
      } else if (gameMeta.layoutMode === 'supernova') {
        // Explosive radial debris shell in 3D space
        const phi = Math.acos(1 - (2 * (i + 0.5)) / cfg.towers);
        const theta = Math.PI * (1 + Math.sqrt(5)) * i;
        const rad = 22 + (i % 7) * 9;
        px = rad * Math.sin(phi) * Math.cos(theta);
        py = 14 + rad * Math.cos(phi) * 0.7;
        pz = rad * Math.sin(phi) * Math.sin(theta);
        sx = 1.4 + (i % 3) * 0.9;
        sy = 2.5 + (i % 4) * 1.4;
        sz = 1.4 + (i % 3) * 0.9;
        rx = theta;
        rz = phi;
      } else if (gameMeta.layoutMode === 'orbital') {
        // Multi-inclination orbital ring stations in deep space (no ground towers!)
        const ringIdx = i % 3;
        const rad = 26 + ringIdx * 15;
        const tilt = (ringIdx - 1) * 0.48;
        px = Math.cos(ry) * rad;
        py = 10.5 + Math.sin(ry) * rad * Math.sin(tilt);
        pz = Math.sin(ry) * rad * Math.cos(tilt);
        sx = 2.0;
        sy = 2.0;
        sz = 2.0;
        rx = tilt;
      } else if (gameMeta.layoutMode === 'colosseum') {
        // Concentric tiered hexagonal mecha stadium walls
        const tier = i % 3;
        const ring = 26 + tier * 16;
        px = Math.cos(ry) * ring;
        pz = Math.sin(ry) * ring;
        sx = 3.2;
        sz = 3.2;
        sy = 7 + tier * 8;
        py = sy / 2;
      } else if (gameMeta.layoutMode === 'volcanic') {
        // Jagged leaning volcanic obsidian spikes rising from lava pools
        const ring = 24 + (i % 9) * 9 + Math.random() * 5;
        px = Math.cos(ry) * ring;
        pz = Math.sin(ry) * ring;
        sx = 2.2 + Math.random() * 3.5;
        sz = 2.2 + Math.random() * 3.5;
        sy = 8 + Math.random() * 26;
        py = sy / 2 - 1;
        rx = (Math.random() - 0.5) * 0.35;
        rz = (Math.random() - 0.5) * 0.35;
      } else if (gameMeta.layoutMode === 'skyland') {
        // Floating sky sanctuary islands and marble pillars at varied altitudes
        const ring = 22 + (i % 7) * 11;
        px = Math.cos(ry) * ring;
        pz = Math.sin(ry) * ring;
        sx = 3.6 + (i % 4) * 1.1;
        sz = 3.6 + (i % 4) * 1.1;
        sy = 4.5 + (i % 5) * 2.5;
        py = 6 + (i % 6) * 5.2;
      } else if (gameMeta.layoutMode === 'clockwork') {
        // Concentric temporal monoliths arranged like giant sundial numerals
        const dialRing = 26 + (i % 4) * 14;
        const snapAngle = Math.floor((i % 24) / 2) * (Math.PI / 6);
        px = Math.cos(snapAngle + (i % 2) * 0.08) * dialRing;
        pz = Math.sin(snapAngle + (i % 2) * 0.08) * dialRing;
        sx = 1.6;
        sz = 4.2;
        sy = 12 + (i % 4) * 6;
        py = sy / 2;
        ry = -snapAngle;
      } else if (gameMeta.layoutMode === 'glacial') {
        // Sharp crystalline icebergs tilted outward from the cryo cavern center
        const ring = 22 + (i % 8) * 9.5;
        px = Math.cos(ry) * ring;
        pz = Math.sin(ry) * ring;
        sx = 2.8 + (i % 3) * 1.4;
        sz = 2.8 + (i % 3) * 1.4;
        sy = 14 + (i % 7) * 5.5;
        py = sy / 2 - 2;
        rx = Math.sin(ry) * 0.28;
        rz = -Math.cos(ry) * 0.28;
      } else if (gameMeta.layoutMode === 'biohive') {
        // Curved organic hive ribs arching over the brood chamber
        const ribIdx = i % 16;
        const ribAngle = (ribIdx / 16) * Math.PI * 2;
        const archProgress = ((i >> 4) % 8) / 7;
        const rad = 24 + archProgress * 46;
        px = Math.cos(ribAngle) * rad;
        pz = Math.sin(ribAngle) * rad;
        sx = 2.4;
        sz = 2.4;
        sy = 10 + Math.sin(archProgress * Math.PI) * 18;
        py = sy / 2;
        rx = -Math.sin(ribAngle) * 0.42;
        rz = Math.cos(ribAngle) * 0.42;
      } else if (gameMeta.layoutMode === 'stargate') {
        // Dual hyper-lane warp beacon pylons forming a deep-space launch corridor
        const side = i % 2 === 0 ? 1 : -1;
        const slot = Math.floor(i / 2);
        px = side * (22 + (slot % 4) * 11);
        pz = ((slot % 35) - 17) * 4.5;
        sx = 1.8;
        sz = 1.8;
        sy = 18 + (slot % 4) * 6;
        py = sy / 2;
      } else if (gameMeta.layoutMode === 'mainframe') {
        // Orthogonal silicon CPU server racks and high-rise memory banks
        const gx = (i % 14) - 6.5;
        const gz = Math.floor(i / 14) - 6.5;
        const dist = Math.hypot(gx, gz);
        const push = dist < 3.2 ? 3.5 : 1.0;
        px = gx * 7.5 * push;
        pz = gz * 7.5 * push;
        sx = 3.2;
        sz = 3.2;
        sy = 8 + ((i * 7) % 28);
        py = sy / 2;
        ry = 0;
      } else if (gameMeta.layoutMode === 'eclipse') {
        // Ceremonial gothic obsidian monolith circle around the dark sun altar
        const ring = 28 + (i % 3) * 18;
        px = Math.cos(ry) * ring;
        pz = Math.sin(ry) * ring;
        sx = 2.6;
        sz = 1.4;
        sy = 16 + (i % 5) * 7;
        py = sy / 2;
      } else if (gameMeta.layoutMode === 'orbital_cannon') {
        // Fortified orbital trench bastions and angled blast shields
        const sector = i % 4;
        const ring = 26 + sector * 13;
        px = Math.cos(ry) * ring;
        pz = Math.sin(ry) * ring;
        sx = 4.2;
        sz = 2.0;
        sy = 9 + sector * 5;
        py = sy / 2;
        rx = 0.22;
      } else {
        // Abyssal trench crystalline coral spires
        const ring = 20 + (i % 8) * 10 + Math.random() * 4.5;
        px = Math.cos(ry) * ring;
        pz = Math.sin(ry) * ring;
        sx = 1.8 + Math.random() * 2.2;
        sz = 1.8 + Math.random() * 2.2;
        sy = 4 + Math.random() * 18;
        py = sy / 2;
      }

      _dummy.position.set(px, py, pz);
      _dummy.rotation.set(rx, ry, rz);
      _dummy.scale.set(sx, sy, sz);
      _dummy.updateMatrix();
      towers.setMatrixAt(i, _dummy.matrix);
      _color.setHex(gameMeta.lightPalette[i % 4]).multiplyScalar(0.32);
      towers.setColorAt(i, _color);

      _dummy.position.set(px, py + sy * 0.5 + 0.14, pz);
      _dummy.scale.set(sx * 0.9, 1, sz * 0.9);
      _dummy.updateMatrix();
      strips.setMatrixAt(i, _dummy.matrix);
      _color.setHex(gameMeta.lightPalette[i % 4]);
      strips.setColorAt(i, _color);
    }
    towers.instanceMatrix.needsUpdate = true;
    if (towers.instanceColor) towers.instanceColor.needsUpdate = true;
    strips.instanceMatrix.needsUpdate = true;
    if (strips.instanceColor) strips.instanceColor.needsUpdate = true;
    scene.add(towers);
    scene.add(strips);
    this.towerMesh = towers;
    this.accentStripMesh = strips;

    // 2. High-Density Metallic Fleet / Cyber Vehicles / Bio-Swarm / Mecha Drones
    let droneGeo: THREE.BufferGeometry;
    const isTrackOrField =
      gameMeta.layoutMode === 'formula_gp' ||
      gameMeta.layoutMode === 'drift_touge' ||
      gameMeta.layoutMode === 'maglev_track' ||
      gameMeta.layoutMode === 'dakar_rally' ||
      gameMeta.layoutMode === 'bugatti_hypercar' ||
      gameMeta.layoutMode === 'snow_rally' ||
      gameMeta.layoutMode === 'soccer_stadium' ||
      gameMeta.layoutMode === 'f22_jet' ||
      gameMeta.layoutMode === 'sr71_plane' ||
      gameMeta.layoutMode === 'apache_heli';

    if (
      gameMeta.layoutMode === 'corridor' ||
      gameMeta.layoutMode === 'stargate' ||
      isTrackOrField
    ) {
      // Sleek camera drones / overhead stadium confetti drones / escort delta darts (kept high & clear of road/pitch!)
      droneGeo = new THREE.ConeGeometry(0.24, 0.95, 5);
      droneGeo.rotateX(Math.PI / 2);
    } else if (gameMeta.layoutMode === 'abyss' || gameMeta.layoutMode === 'biohive') {
      droneGeo = new THREE.SphereGeometry(0.35, 8, 6);
    } else if (gameMeta.layoutMode === 'colosseum' || gameMeta.layoutMode === 'mainframe') {
      droneGeo = new THREE.BoxGeometry(0.65, 0.65, 0.65);
    } else if (gameMeta.layoutMode === 'clockwork' || gameMeta.layoutMode === 'glacial' || gameMeta.layoutMode === 'eclipse') {
      droneGeo = new THREE.OctahedronGeometry(0.42, 0);
    } else {
      droneGeo = new THREE.ConeGeometry(0.28, 1.15, this.preset === 'nightmare' ? 12 : 6);
      droneGeo.rotateX(Math.PI / 2);
    }

    const droneMat = new THREE.MeshStandardMaterial({
      color: 0x334155,
      metalness: 0.9,
      roughness: 0.18,
      emissive: gameMeta.lightPalette[0],
      emissiveIntensity: 0.28,
    });
    const effectiveDrones = Math.max(
      180,
      Math.round(cfg.drones * (isTrackOrField ? Math.min(0.22, densityFactor * 0.25) : densityFactor))
    );
    const drones = new THREE.InstancedMesh(droneGeo, droneMat, effectiveDrones);
    drones.castShadow = this.shadowsEnabled && effectiveDrones <= 6000;
    this.droneMeta = new Float32Array(effectiveDrones * 4);
    for (let i = 0; i < effectiveDrones; i++) {
      const rad = 10 + Math.random() * 58;
      const ang = Math.random() * Math.PI * 2;
      const h = 2.0 + Math.random() * 26;
      const spd = (0.3 + Math.random() * 0.95) * (i % 2 === 0 ? 1 : -1);
      this.droneMeta[i * 4] = rad;
      this.droneMeta[i * 4 + 1] = ang;
      this.droneMeta[i * 4 + 2] = h;
      this.droneMeta[i * 4 + 3] = spd;

      _color.setHex(gameMeta.lightPalette[i % 4]);
      drones.setColorAt(i, _color);
    }
    if (drones.instanceColor) drones.instanceColor.needsUpdate = true;
    this.droneMesh = drones;
    this.updateDrones(0);
    scene.add(drones);

    // 3. Atmospheric Particles / Starfield / Sparks / Ash / Bioluminescence
    const effectiveParticles = Math.max(600, Math.round(cfg.particles * densityFactor));
    const pPos = new Float32Array(effectiveParticles * 3);
    const pCol = new Float32Array(effectiveParticles * 3);
    for (let i = 0; i < effectiveParticles; i++) {
      const r = isTrackOrField ? 26 + Math.random() * 68 : 6 + Math.random() * 75;
      const a = Math.random() * Math.PI * 2;
      pPos[i * 3] = Math.cos(a) * r;
      pPos[i * 3 + 1] = isTrackOrField ? 10 + Math.random() * 34 : 1.0 + Math.random() * 38;
      pPos[i * 3 + 2] = Math.sin(a) * r;

      _color.setHex(gameMeta.lightPalette[i % 4]);
      pCol[i * 3] = _color.r;
      pCol[i * 3 + 1] = _color.g;
      pCol[i * 3 + 2] = _color.b;
    }
    const pGeo = new THREE.BufferGeometry();
    pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
    pGeo.setAttribute('color', new THREE.BufferAttribute(pCol, 3));
    const pMat = new THREE.PointsMaterial({
      size: gameMeta.layoutMode === 'snow_rally' ? 0.24 : 0.14,
      vertexColors: true,
      transparent: true,
      opacity: gameMeta.layoutMode === 'snow_rally' ? 0.72 : 0.44,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const points = new THREE.Points(pGeo, pMat);
    scene.add(points);
    this.particlePoints = points;

    if (this.skyMat) this.skyMat.uniforms.uSteps.value = cfg.raymarchSteps;
    if (this.plasmaMat) this.plasmaMat.uniforms.uSteps.value = cfg.raymarchSteps;

    this.metrics.droneCount = effectiveDrones;
    this.metrics.particleCount = effectiveParticles;
    this.metrics.raymarchSteps = cfg.raymarchSteps;
  }

  private setupComposer(w: number, h: number): void {
    if (!this.renderer || !this.scene || !this.camera) return;
    this.composer?.dispose();
    const composer = new EffectComposer(this.renderer);
    composer.addPass(new RenderPass(this.scene, this.camera));
    const bloom = new UnrealBloomPass(
      new THREE.Vector2(w, h),
      GAME_PRESETS[this.preset].bloomStrength,
      0.35,
      0.86
    );
    bloom.enabled = this.bloomEnabled;
    composer.addPass(bloom);
    composer.addPass(new OutputPass());
    this.composer = composer;
    this.bloomPass = bloom;
  }

  private applyRendererToneMapping(renderer: THREE.WebGLRenderer): void {
    renderer.toneMapping =
      this.toneMapping === 'agx'
        ? THREE.AgXToneMapping
        : this.toneMapping === 'neutral'
          ? THREE.NeutralToneMapping
          : THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = this.exposure;
  }

  private applyPresetScale(w: number, h: number): void {
    if (!this.renderer) return;
    const cfg = GAME_PRESETS[this.preset];
    const dynScale = this.dynamicResolution ? this.dynResFactor : 1.0;
    const effPixelRatio = Math.max(0.65, Math.min(2.5, (window.devicePixelRatio || 1) * cfg.renderScale * dynScale));
    this.renderer.setPixelRatio(effPixelRatio);
    this.renderer.setSize(w, h, false);
    this.composer?.setPixelRatio(effPixelRatio);
    this.composer?.setSize(w, h);
    if (this.bloomPass) {
      this.bloomPass.strength = cfg.bloomStrength;
      this.bloomPass.enabled = this.bloomEnabled;
    }
    const drawW = Math.round(w * effPixelRatio);
    const drawH = Math.round(h * effPixelRatio);
    this.metrics.renderScale = Number((cfg.renderScale * dynScale).toFixed(2));
    this.metrics.raymarchSteps = cfg.raymarchSteps;
    this.metrics.resolutionLabel = `${drawW} × ${drawH} (${Math.round(cfg.renderScale * dynScale * 100)}% SSAA · ${cfg.raymarchSteps} RM)`;
  }

  private bindInteractiveEvents(canvas: HTMLCanvasElement): void {
    const onKeyDown = (e: KeyboardEvent) => {
      if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space', 'ShiftLeft', 'ShiftRight'].includes(e.code)) {
        this.keysDown.add(e.code);
        if (e.code === 'Space' && (this.interactiveMode || this.isSoccerScene())) {
          e.preventDefault();
          if (this.isSoccerScene()) this.kickSoccerBall();
          else if (this.interactiveMode) this.fireLaser();
        }
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      this.keysDown.delete(e.code);
    };
    const onMouseDown = (e: MouseEvent) => {
      if (this.isSoccerScene()) {
        this.kickSoccerBall();
        return;
      }
      if (!this.interactiveMode) return;
      if (e.button === 0) {
        this.isDraggingLook = true;
        this.lastMouseX = e.clientX;
        this.lastMouseY = e.clientY;
        this.fireLaser();
      }
    };
    const onMouseMove = (e: MouseEvent) => {
      if (!this.interactiveMode || !this.isDraggingLook) return;
      const dx = e.clientX - this.lastMouseX;
      const dy = e.clientY - this.lastMouseY;
      this.lastMouseX = e.clientX;
      this.lastMouseY = e.clientY;
      this.camYaw -= dx * 0.0045;
      this.camPitch = Math.max(-0.85, Math.min(0.65, this.camPitch - dy * 0.004));
    };
    const onMouseUp = () => {
      this.isDraggingLook = false;
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    canvas.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);

    (canvas as any)._gameCleanup = () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      canvas.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }

  public kickSoccerBall(): void {
    if (!this.isSoccerScene()) return;
    const distToBall = this.soccerPlayerPos.distanceTo(this.soccerBallPos);
    const kickPower = distToBall < 6.0 ? 28 : 18;
    _dirVec.set(0, 0, -37.5).sub(this.soccerBallPos).normalize();
    _dirVec.x += (Math.random() - 0.5) * 0.18;
    this.soccerBallVel.copy(_dirVec).multiplyScalar(kickPower);
    this.shotsFired++;
    this.soccerBallSpeedKmh = Math.round(this.soccerBallVel.length() * 3.6);
  }

  public fireLaser(): void {
    if (!this.scene || !this.camera) return;
    const gameMeta = this.getGameCatalogItem();
    const geo = new THREE.CylinderGeometry(0.07, 0.07, 3.4, 8);
    geo.rotateX(Math.PI / 2);
    const mat = new THREE.MeshBasicMaterial({ color: gameMeta.lightPalette[0] });
    const bolt = new THREE.Mesh(geo, mat);
    bolt.position.copy(this.camera.position);
    bolt.quaternion.copy(this.camera.quaternion);
    _dirVec.set(0, 0, -1).applyQuaternion(this.camera.quaternion).normalize();
    bolt.position.addScaledVector(_dirVec, 2.0);
    this.scene.add(bolt);
    this.lasers.push({ mesh: bolt, vel: _dirVec.clone().multiplyScalar(85), life: 1.8 });
    this.shotsFired++;
    if (bolt.position.distanceTo(_originVec) < 65) {
      this.targetsHit++;
    }
  }

  public setPreset(preset: GameQualityPreset): void {
    this.preset = preset;
    this.metrics.preset = preset;
    if (this.scene && this.mountEl) {
      this.rebuildHeavyGeometry(this.scene);
      this.applyPresetScale(Math.max(360, this.mountEl.clientWidth), Math.max(280, this.mountEl.clientHeight));
      if (!this.running) {
        this.renderFrameOnce();
        this.metrics.triangles = this.lastTriangles;
        this.metrics.drawCalls = this.lastDrawCalls;
      }
    }
    this.emitMetrics();
  }

  public setFpsMode(mode: GpuFpsMode): void {
    this.fpsMode = mode;
    this.metrics.fpsMode = mode;
    this.metrics.isSmoothMode = mode === 'vsync' || this.fpsCap > 0;
    if (this.running) {
      cancelAnimationFrame(this.rafId);
      if (this.uncappedTimer !== null) {
        clearTimeout(this.uncappedTimer);
        this.uncappedTimer = null;
      }
      this.windowStartTs = performance.now();
      this.windowFrames = 0;
      this.scheduleLoop();
    }
    this.emitMetrics();
  }

  public setFpsCap(cap: GameFpsCap): void {
    this.fpsCap = cap;
    this.metrics.fpsCap = cap;
    this.metrics.isSmoothMode = this.fpsMode === 'vsync' || cap > 0;
    if (cap > 0 && this.fpsMode !== 'vsync') {
      this.setFpsMode('vsync');
      return;
    }
    this.emitMetrics();
  }

  public setBloomEnabled(enabled: boolean): void {
    this.bloomEnabled = enabled;
    this.metrics.bloomEnabled = enabled;
    if (this.bloomPass) this.bloomPass.enabled = enabled;
    if (!this.running) this.renderFrameOnce();
    this.emitMetrics();
  }

  public setShadowsEnabled(enabled: boolean): void {
    this.shadowsEnabled = enabled;
    this.metrics.shadowsEnabled = enabled;
    if (this.renderer) this.renderer.shadowMap.enabled = enabled;
    if (this.scene) {
      this.scene.traverse((obj) => {
        if ((obj as THREE.DirectionalLight).isDirectionalLight) {
          (obj as THREE.DirectionalLight).castShadow = enabled;
        }
      });
      if (this.towerMesh) this.towerMesh.castShadow = enabled;
    }
    if (!this.running) this.renderFrameOnce();
    this.emitMetrics();
  }

  public setFogEnabled(enabled: boolean): void {
    this.fogEnabled = enabled;
    this.metrics.fogEnabled = enabled;
    if (this.scene) {
      const gameMeta = this.getGameCatalogItem();
      this.scene.fog = enabled ? new THREE.FogExp2(gameMeta.fogColor, 0.0068) : null;
      if (!this.running) this.renderFrameOnce();
    }
    this.emitMetrics();
  }

  public setAnisotropy(af: number): void {
    const val = Math.max(1, Math.min(16, af));
    this.anisotropy = val;
    this.metrics.anisotropy = val;
    if (this.raceRoadTexture) {
      this.raceRoadTexture.anisotropy = val;
      this.raceRoadTexture.needsUpdate = true;
    }
    if (!this.running) this.renderFrameOnce();
    this.emitMetrics();
  }

  public setToneMapping(mode: GameToneMappingMode): void {
    this.toneMapping = mode;
    this.metrics.toneMapping = mode;
    if (this.renderer) {
      this.applyRendererToneMapping(this.renderer);
      if (!this.running) this.renderFrameOnce();
    }
    this.emitMetrics();
  }

  public setExposure(exp: number): void {
    this.exposure = Math.max(0.6, Math.min(1.6, Number(exp.toFixed(2))));
    this.metrics.exposure = this.exposure;
    if (this.renderer) {
      this.renderer.toneMappingExposure = this.exposure;
      if (!this.running) this.renderFrameOnce();
    }
    this.emitMetrics();
  }

  public setEnvIntensity(intensity: number): void {
    this.envIntensity = Math.max(0.1, Math.min(1.6, Number(intensity.toFixed(2))));
    this.metrics.envIntensity = this.envIntensity;
    if (this.scene) {
      this.scene.environmentIntensity = this.envIntensity;
      if (!this.running) this.renderFrameOnce();
    }
    this.emitMetrics();
  }

  public setSceneryDensityPct(pct: number): void {
    this.sceneryDensityPct = Math.max(25, Math.min(100, Math.round(pct)));
    this.metrics.sceneryDensityPct = this.sceneryDensityPct;
    if (this.scene && this.mountEl) {
      this.rebuildHeavyGeometry(this.scene);
      if (!this.running) this.renderFrameOnce();
    }
    this.emitMetrics();
  }

  public setDynamicResolution(enabled: boolean): void {
    this.dynamicResolution = enabled;
    this.metrics.dynamicResolution = enabled;
    if (!enabled) this.dynResFactor = 1.0;
    if (this.mountEl) {
      this.applyPresetScale(Math.max(360, this.mountEl.clientWidth), Math.max(280, this.mountEl.clientHeight));
      if (!this.running) this.renderFrameOnce();
    }
    this.emitMetrics();
  }

  public applyAiGraphicsProfile(profile: GameAiProfile): void {
    this.aiProfile = profile;
    this.metrics.aiProfile = profile;
    if (profile === 'ai_auto') {
      this.dynResFactor = 1.0;
      this.dynamicResolution = true;
      this.preset = this.isSoftwareRenderer ? 'high' : 'ultra';
      this.fpsMode = 'vsync';
      this.fpsCap = 0;
      this.bloomEnabled = !this.isSoftwareRenderer;
      this.shadowsEnabled = !this.isSoftwareRenderer;
      this.fogEnabled = true;
      this.anisotropy = this.isSoftwareRenderer ? 4 : 16;
      this.toneMapping = 'aces';
      this.exposure = 1.08;
      this.envIntensity = 0.78;
      this.sceneryDensityPct = this.isSoftwareRenderer ? 50 : 85;
      this.aiRecommendation = this.isSoftwareRenderer
        ? 'AI Auto: Tryb bezpieczny (Software GL) — High + Zero Microstutter'
        : 'AI Auto: Ultra + AF 16x + Dynamic Res AI (płynne 60–144 FPS bez przycięć)';
    } else if (profile === 'ai_smooth_120') {
      this.dynResFactor = 0.92;
      this.dynamicResolution = true;
      this.preset = 'high';
      this.fpsMode = 'vsync';
      this.fpsCap = 120;
      this.bloomEnabled = true;
      this.shadowsEnabled = true;
      this.fogEnabled = true;
      this.anisotropy = 8;
      this.toneMapping = 'aces';
      this.exposure = 1.05;
      this.envIntensity = 0.72;
      this.sceneryDensityPct = 70;
      this.aiRecommendation = 'AI Płynność 120+: Zoptymalizowany frame pacing VSync + Dynamic Resolution';
    } else if (profile === 'ai_balanced') {
      this.dynResFactor = 1.0;
      this.dynamicResolution = true;
      this.preset = 'ultra';
      this.fpsMode = 'vsync';
      this.fpsCap = 0;
      this.bloomEnabled = true;
      this.shadowsEnabled = true;
      this.fogEnabled = true;
      this.anisotropy = 8;
      this.toneMapping = 'aces';
      this.exposure = 1.1;
      this.envIntensity = 0.86;
      this.sceneryDensityPct = 85;
      this.aiRecommendation = 'AI Balans HDR: Ultra + ACES Filmic + IBL 0.86x + AF 8x';
    } else if (profile === 'ai_quality_4k') {
      this.dynResFactor = 1.0;
      this.dynamicResolution = false;
      this.preset = 'extreme';
      this.fpsMode = 'vsync';
      this.fpsCap = 0;
      this.bloomEnabled = true;
      this.shadowsEnabled = true;
      this.fogEnabled = true;
      this.anisotropy = 16;
      this.toneMapping = 'agx';
      this.exposure = 1.14;
      this.envIntensity = 1.05;
      this.sceneryDensityPct = 100;
      this.aiRecommendation = 'AI Jakość 4K: Extreme Raymarch + AgX Filmic + AF 16x + 100% Scenerii';
    } else if (profile === 'ai_esports') {
      this.dynResFactor = 1.0;
      this.dynamicResolution = false;
      this.preset = 'high';
      this.fpsMode = 'vsync';
      this.fpsCap = 144;
      this.bloomEnabled = false;
      this.shadowsEnabled = false;
      this.fogEnabled = false;
      this.anisotropy = 16;
      this.toneMapping = 'neutral';
      this.exposure = 1.16;
      this.envIntensity = 0.85;
      this.sceneryDensityPct = 50;
      this.aiRecommendation = 'AI E-Sport: Wyłączona mgła/bloom, Neutral PBR, maksymalna czytelność i 144 FPS';
    }

    if (this.renderer) {
      this.applyRendererToneMapping(this.renderer);
      this.renderer.shadowMap.enabled = this.shadowsEnabled;
    }
    if (this.scene && this.mountEl) {
      const gameMeta = this.getGameCatalogItem();
      this.scene.fog = this.fogEnabled ? new THREE.FogExp2(gameMeta.fogColor, 0.0068) : null;
      this.scene.environmentIntensity = this.envIntensity;
      this.rebuildHeavyGeometry(this.scene);
      this.applyPresetScale(Math.max(360, this.mountEl.clientWidth), Math.max(280, this.mountEl.clientHeight));
      if (!this.running) this.renderFrameOnce();
    }
    this.metrics = {
      ...this.metrics,
      preset: this.preset,
      fpsMode: this.fpsMode,
      fpsCap: this.fpsCap,
      bloomEnabled: this.bloomEnabled,
      shadowsEnabled: this.shadowsEnabled,
      fogEnabled: this.fogEnabled,
      anisotropy: this.anisotropy,
      toneMapping: this.toneMapping,
      exposure: this.exposure,
      envIntensity: this.envIntensity,
      sceneryDensityPct: this.sceneryDensityPct,
      dynamicResolution: this.dynamicResolution,
      aiProfile: this.aiProfile,
      aiRecommendation: this.aiRecommendation,
      isSmoothMode: this.fpsMode === 'vsync' || this.fpsCap > 0,
    };
    if (this.running) {
      cancelAnimationFrame(this.rafId);
      if (this.uncappedTimer !== null) {
        clearTimeout(this.uncappedTimer);
        this.uncappedTimer = null;
      }
      this.scheduleLoop();
    }
    this.emitMetrics();
  }

  public setInteractiveMode(active: boolean): void {
    this.interactiveMode = active;
    this.metrics.interactiveMode = active;
    this.keysDown.clear();
    if (active && this.camera) {
      this.camYaw = Math.atan2(this.camera.position.x, this.camera.position.z);
      this.camPitch = -0.14;
    }
    this.emitMetrics();
  }

  public start(): void {
    if (this.running || !this.renderer) return;
    this.running = true;
    const now = performance.now();
    this.startTs = now;
    this.lastTickTs = now;
    this.windowStartTs = now;
    this.windowFrames = 0;
    this.frameTimes = [];
    this.fpsSamples = [];
    this.telemetry = [];
    this.metrics.running = true;
    this.metrics.verdict = 'GRYWALNE (60+)';
    this.scheduleLoop();
    this.emitMetrics();
  }

  public stop(): void {
    this.running = false;
    cancelAnimationFrame(this.rafId);
    this.rafId = 0;
    if (this.uncappedTimer !== null) {
      clearTimeout(this.uncappedTimer);
      this.uncappedTimer = null;
    }
    this.metrics.running = false;
    this.emitMetrics();
  }

  public async runTimedBenchmark(
    durationMs: number,
    onProgress: (m: GameBenchMetrics) => void
  ): Promise<GameBenchMetrics> {
    this.onMetrics = onProgress;
    this.setInteractiveMode(false);
    this.start();
    await new Promise((r) => setTimeout(r, durationMs));
    this.stop();
    return this.getMetrics();
  }

  private scheduleLoop(): void {
    if (!this.running) return;
    if (this.fpsMode === 'uncapped' && this.fpsCap === 0) {
      this.uncappedTimer = window.setTimeout(() => this.tickLoop(), 0);
    } else {
      this.rafId = requestAnimationFrame(() => this.tickLoop());
    }
  }

  private updateDrones(t: number): void {
    if (!this.droneMesh) return;
    const count = this.droneMesh.count;
    const step = count > 6000 ? 2 : 1;
    const startIdx = count > 6000 ? (this.frameTickCount % 2) : 0;
    const layoutMode = this.getGameCatalogItem().layoutMode;

    for (let i = startIdx; i < count; i += step) {
      const r = this.droneMeta[i * 4];
      const a0 = this.droneMeta[i * 4 + 1];
      const h = this.droneMeta[i * 4 + 2];
      const spd = this.droneMeta[i * 4 + 3];

      if (
        layoutMode === 'corridor' ||
        layoutMode === 'formula_gp' ||
        layoutMode === 'drift_touge' ||
        layoutMode === 'maglev_track' ||
        layoutMode === 'dakar_rally' ||
        layoutMode === 'bugatti_hypercar' ||
        layoutMode === 'snow_rally'
      ) {
        // High-altitude camera drones & trackside overhead escorts (STRICTLY high above Y>=16 or outside |X|>=25 so road is crystal clear!)
        const side = i % 2 === 0 ? 1 : -1;
        const laneX = side * (25 + (i % 7) * 3.8 + Math.sin(t * 1.4 + i) * 1.6);
        const speedMult = layoutMode === 'maglev_track' ? 54 : 38;
        const zPos = ((((a0 * 28 + t * Math.abs(spd) * speedMult) % 200) + 200) % 200) - 140;
        const ySky = 11.5 + (i % 8) * 2.2;
        _dummy.position.set(laneX, ySky, zPos);
        _dummy.rotation.set(0, spd > 0 ? 0 : Math.PI, Math.cos(t * 2 + i) * 0.08);
      } else if (layoutMode === 'soccer_stadium') {
        // Aerial SpiderCam & stadium floodlight perimeter drones well above the pitch
        const ang = a0 + t * spd * 0.25;
        const ringR = 32 + (i % 6) * 5;
        _dummy.position.set(Math.cos(ang) * ringR, 22 + (i % 5) * 3.2, Math.sin(ang) * ringR);
        _dummy.rotation.set(0.15, -ang, 0);
      } else if (layoutMode === 'f22_jet' || layoutMode === 'sr71_plane' || layoutMode === 'apache_heli') {
        // Outer escort squadron flanking the canyon well outside player sightline
        const side = i % 2 === 0 ? 1 : -1;
        const flankX = side * (28 + (i % 8) * 4.5);
        const zFlight = ((((a0 * 28 + t * 55) % 220) + 220) % 220) - 160;
        _dummy.position.set(flankX, 12 + (i % 7) * 3.5, zFlight);
        _dummy.rotation.set(0, Math.PI, side * 0.25);
      } else if (layoutMode === 'volcanic') {
        // Rising volcanic embers and diving strike craft
        const ang = a0 + t * spd * 0.35;
        const yRise = ((h + t * Math.abs(spd) * 6.5) % 34) + 2.0;
        _dummy.position.set(Math.cos(ang) * r, yRise, Math.sin(ang) * r);
        _dummy.rotation.set(0.4, -ang, 0);
      } else if (layoutMode === 'supernova') {
        // Radial shockwave expansion waves
        const pulseR = ((r + t * Math.abs(spd) * 18) % 68) + 6;
        const phi = (i % 32) * 0.1;
        _dummy.position.set(Math.cos(a0) * pulseR, 14 + Math.sin(phi + t) * 14, Math.sin(a0) * pulseR);
        _dummy.rotation.set(t, a0, 0);
      } else if (layoutMode === 'abyss') {
        // Schooling bioluminescent jellyfish / underwater swarm
        const ang = a0 + t * spd * 0.28;
        const schoolWave = Math.sin(t * 2.8 + r * 0.25) * 3.5;
        _dummy.position.set(Math.cos(ang) * r, h + schoolWave, Math.sin(ang) * r);
        _dummy.rotation.set(Math.sin(t * 3 + i) * 0.4, -ang, 0);
      } else if (layoutMode === 'skyland') {
        // Soaring Valkyrie sky-gliders Riding vertical thermal currents
        const ang = a0 + t * spd * 0.38;
        const altitude = 8 + Math.sin(t * 1.4 + i * 0.3) * 9.5 + (h * 0.4);
        _dummy.position.set(Math.cos(ang) * r, altitude, Math.sin(ang) * r);
        _dummy.rotation.set(Math.cos(t * 1.4 + i * 0.3) * 0.35, -ang, 0.3);
      } else if (layoutMode === 'clockwork') {
        // Stepped escapement tick motion on concentric clock gears
        const tickT = Math.floor(t * 4) * 0.25 + Math.pow((t * 4) % 1, 3) * 0.25;
        const gearDir = (i % 2 === 0 ? 1 : -1);
        const ang = a0 + tickT * Math.abs(spd) * 0.85 * gearDir;
        _dummy.position.set(Math.cos(ang) * r, h, Math.sin(ang) * r);
        _dummy.rotation.set(tickT * 3, -ang, tickT * 2);
      } else if (layoutMode === 'glacial') {
        // Cyclonic blizzard ice shards swirling in a conical funnel
        const vortexH = ((h + t * 5) % 30) + 1.5;
        const funnelR = r * (0.45 + (vortexH / 32) * 0.75);
        const ang = a0 + t * (1.2 + Math.abs(spd) * 0.5);
        _dummy.position.set(Math.cos(ang) * funnelR, vortexH, Math.sin(ang) * funnelR);
        _dummy.rotation.set(t * 2.5, ang, i);
      } else if (layoutMode === 'biohive') {
        // Erratic insectoid swarm darting around the queen's spore sac
        const ang = a0 + t * spd * 0.65 + Math.sin(t * 6 + i) * 0.12;
        const hiveR = 8 + Math.abs(Math.sin(t * 1.8 + a0 * 3)) * r * 0.85;
        _dummy.position.set(Math.cos(ang) * hiveR, h + Math.cos(t * 5 + i) * 2.2, Math.sin(ang) * hiveR);
        _dummy.rotation.set(0.3, -ang, Math.sin(t * 8 + i) * 0.6);
      } else if (layoutMode === 'stargate') {
        // Hyper-velocity starfighters shooting through the warp portal axis
        const zWarp = ((((a0 * 24 + t * (28 + Math.abs(spd) * 32)) % 140) + 140) % 140) - 70;
        const tunnelR = 4.5 + (i % 9) * 3.8;
        const ang = a0 + zWarp * 0.03;
        _dummy.position.set(Math.cos(ang) * tunnelR, 11.5 + Math.sin(ang) * (tunnelR * 0.45), zWarp);
        _dummy.rotation.set(0, 0, ang);
      } else if (layoutMode === 'mainframe') {
        // Orthogonal data packets routing along X/Y/Z silicon bus lines
        const axis = i % 3;
        const travel = ((((a0 * 20 + t * Math.abs(spd) * 26) % 90) + 90) % 90) - 45;
        const laneA = ((i % 11) - 5) * 6.5;
        const laneB = 3 + ((i >> 3) % 7) * 3.8;
        if (axis === 0) _dummy.position.set(travel, laneB, laneA);
        else if (axis === 1) _dummy.position.set(laneA, laneB, travel);
        else _dummy.position.set(laneA, ((Math.abs(travel) % 28) + 2), ((i * 3) % 11 - 5) * 6.5);
        _dummy.rotation.set(0, axis * (Math.PI / 2), 0);
      } else if (layoutMode === 'eclipse') {
        // Helical solar-flare orbitals spiraling into the dark sun
        const ang = a0 + t * spd * 0.55;
        const spiralR = 7 + ((r + t * 8) % 52);
        const yOrbit = 14 + Math.sin(ang * 2 + t) * (spiralR * 0.25);
        _dummy.position.set(Math.cos(ang) * spiralR, yOrbit, Math.sin(ang) * spiralR);
        _dummy.rotation.set(t * 1.5, -ang, t);
      } else if (layoutMode === 'orbital_cannon') {
        // High-altitude artillery interceptors weaving through anti-air flak
        const ang = a0 + t * spd * 0.52;
        const bank = Math.sin(t * 3.2 + i) * 4.0;
        _dummy.position.set(Math.cos(ang) * (r + bank), h + Math.cos(t * 2.4 + i) * 2.5, Math.sin(ang) * (r + bank));
        _dummy.rotation.set(0.25, -ang + (spd > 0 ? 0 : Math.PI), bank * 0.15);
      } else {
        const ang = a0 + t * spd * 0.45;
        const x = Math.cos(ang) * r;
        const y = h + Math.sin(t * 2.0 + i * 0.17) * 1.1;
        const z = Math.sin(ang) * r;
        _dummy.position.set(x, y, z);
        _dummy.rotation.set(0, -ang + (spd > 0 ? 0 : Math.PI), Math.sin(t + i) * 0.35);
      }

      const sc = 0.72 + ((i % 6) * 0.12);
      _dummy.scale.setScalar(sc);
      _dummy.updateMatrix();
      this.droneMesh.setMatrixAt(i, _dummy.matrix);
    }
    this.droneMesh.instanceMatrix.needsUpdate = true;
  }

  private renderFrameOnce(): void {
    if (!this.renderer || !this.scene || !this.camera) return;
    this.renderer.info.reset();
    if (this.bloomEnabled && this.composer) {
      this.composer.render();
    } else {
      this.renderer.render(this.scene, this.camera);
    }
    this.lastTriangles = this.renderer.info.render.triangles;
    this.lastDrawCalls = this.renderer.info.render.calls;
  }

  private tickLoop(): void {
    if (!this.running || !this.renderer || !this.scene || !this.camera) return;

    const now = performance.now();
    const dt = Math.min(0.1, Math.max(0.001, (now - this.lastTickTs) / 1000));
    this.lastTickTs = now;
    this.simTime += dt;

    if (this.skyMat) this.skyMat.uniforms.uTime.value = this.simTime;
    if (this.plasmaMat) this.plasmaMat.uniforms.uTime.value = this.simTime;
    if (this.coreGroup) {
      if (this.coreGroup.userData.isFlagship) {
        this.coreGroup.position.y = 11.5 + Math.sin(this.simTime * 1.2) * 1.2;
        this.coreGroup.rotation.z = Math.sin(this.simTime * 0.7) * 0.08;
        this.coreGroup.rotation.y = Math.sin(this.simTime * 0.3) * 0.25;
      }
      this.coreGroup.children.forEach((child) => {
        const rIdx = child.userData.ringIdx;
        if (typeof rIdx === 'number') {
          child.rotation.x += dt * (0.45 + rIdx * 0.22);
          child.rotation.y += dt * (0.4 - rIdx * 0.14);
        }
      });
    }

    this.dynLights.forEach((pl, idx) => {
      const a = this.simTime * (0.6 + idx * 0.12) + idx * 1.57;
      pl.position.set(Math.cos(a) * 22, 8 + Math.sin(this.simTime * 1.7 + idx) * 4, Math.sin(a) * 22);
    });

    this.updateDrones(this.simTime);
    if (this.particlePoints) {
      this.particlePoints.rotation.y = this.simTime * 0.06;
    }

    for (let i = this.lasers.length - 1; i >= 0; i--) {
      const b = this.lasers[i];
      b.mesh.position.addScaledVector(b.vel, dt);
      b.life -= dt;
      if (b.life <= 0) {
        this.scene.remove(b.mesh);
        b.mesh.geometry.dispose();
        (b.mesh.material as THREE.Material).dispose();
        this.lasers.splice(i, 1);
      }
    }

    if (this.interactiveMode) {
      const euler = new THREE.Euler(this.camPitch, this.camYaw, 0, 'YXZ');
      this.camera.quaternion.setFromEuler(euler);
      _vFwd.set(0, 0, -1).applyQuaternion(this.camera.quaternion);
      _vRight.crossVectors(_vFwd, _up).normalize();
      const speed = this.keysDown.has('ShiftLeft') ? 40 : 22;
      if (this.keysDown.has('KeyW')) this.camera.position.addScaledVector(_vFwd, speed * dt);
      if (this.keysDown.has('KeyS')) this.camera.position.addScaledVector(_vFwd, -speed * dt);
      if (this.keysDown.has('KeyD')) this.camera.position.addScaledVector(_vRight, speed * dt);
      if (this.keysDown.has('KeyA')) this.camera.position.addScaledVector(_vRight, -speed * dt);
      this.camera.position.y = Math.max(2.2, Math.min(54, this.camera.position.y));
    } else {
      const layoutMode = this.getGameCatalogItem().layoutMode;
      if (
        layoutMode === 'formula_gp' ||
        layoutMode === 'drift_touge' ||
        layoutMode === 'maglev_track' ||
        layoutMode === 'dakar_rally' ||
        layoutMode === 'bugatti_hypercar' ||
        layoutMode === 'snow_rally'
      ) {
        // Playable 3D Racing Chase Camera + Player Steering (A/D or Left/Right) + Nitro Boost (Shift/W/Space)
        const nitroActive =
          this.keysDown.has('ShiftLeft') ||
          this.keysDown.has('ShiftRight') ||
          this.keysDown.has('KeyW') ||
          this.keysDown.has('ArrowUp') ||
          this.keysDown.has('Space');
        const brakeActive = this.keysDown.has('KeyS') || this.keysDown.has('ArrowDown');
        const steerLeft = this.keysDown.has('KeyA') || this.keysDown.has('ArrowLeft');
        const steerRight = this.keysDown.has('KeyD') || this.keysDown.has('ArrowRight');

        const baseSpeed =
          layoutMode === 'maglev_track'
            ? 880
            : layoutMode === 'bugatti_hypercar'
              ? 438
              : layoutMode === 'formula_gp'
                ? 372
                : 318;
        const targetSpeed = nitroActive && this.raceNitroPct > 2
          ? baseSpeed * 1.44
          : brakeActive
            ? baseSpeed * 0.56
            : baseSpeed + Math.sin(this.simTime * 1.4) * 26;
        this.raceSpeedKmh = Math.round(this.raceSpeedKmh + (targetSpeed - this.raceSpeedKmh) * Math.min(1, dt * 6));
        if (nitroActive && this.raceNitroPct > 0) {
          this.raceNitroPct = Math.max(0, Number((this.raceNitroPct - dt * 22).toFixed(0)));
        } else {
          this.raceNitroPct = Math.min(100, Number((this.raceNitroPct + dt * 15).toFixed(0)));
        }
        const mps = this.raceSpeedKmh / 3.6;
        this.raceDistanceM += mps * dt;
        this.raceLap = 1 + Math.floor(this.raceDistanceM / 1200);

        const targetSteer = steerLeft ? -1 : steerRight ? 1 : Math.sin(this.simTime * 1.15) * 0.48;
        this.playerCarSteer += (targetSteer - this.playerCarSteer) * Math.min(1, dt * 9);
        this.playerCarX = Math.max(-13.8, Math.min(13.8, this.playerCarX + this.playerCarSteer * dt * 17));

        if (this.raceRoadTexture) {
          this.raceRoadTexture.offset.y = (this.raceRoadTexture.offset.y + (mps * dt) / 14) % 1;
        }
        for (const gantry of this.raceGantries) {
          gantry.position.z += mps * dt * 0.65;
          if (gantry.position.z > 42) gantry.position.z -= 306;
        }
        for (const wheel of this.raceWheels) {
          wheel.rotation.x -= mps * dt * 0.95;
        }
        for (const sw of this.raceSteerWheels) {
          sw.rotation.y = -this.playerCarSteer * 0.34;
        }

        if (this.playerCarGroup) {
          const hoverY = layoutMode === 'maglev_track' ? 0.55 + Math.sin(this.simTime * 6) * 0.1 : 0.04;
          this.playerCarGroup.position.set(this.playerCarX, hoverY, 16.0);
          this.playerCarGroup.rotation.z = -this.playerCarSteer * 0.11;
          this.playerCarGroup.rotation.y = -this.playerCarSteer * (layoutMode === 'drift_touge' ? 0.36 : 0.14);
          const flames = this.playerCarGroup.userData.flames as THREE.Mesh[] | undefined;
          if (flames) {
            const flameScale = nitroActive && this.raceNitroPct > 2 ? 1.85 + Math.sin(this.simTime * 40) * 0.25 : 0.85 + Math.sin(this.simTime * 22) * 0.12;
            flames.forEach((f) => f.scale.set(1, flameScale, 1));
          }
        }

        let carsAhead = 0;
        if (this.coreGroup) {
          this.coreGroup.children.forEach((child) => {
            const rIdx = child.userData.rivalIdx;
            if (typeof rIdx === 'number') {
              const baseX = Number(child.userData.baseX) || 0;
              const speedMult = Number(child.userData.speedMult) || 1.0;
              const weaveX = Math.max(-13.5, Math.min(13.5, baseX + Math.sin(this.simTime * (1.0 + rIdx * 0.2) + rIdx * 1.7) * 4.2));
              let relZ = Number(child.userData.relZ) || -25;
              const rivalDeltaSpeed = (speedMult * 355 - this.raceSpeedKmh) * 0.08 * dt;
              relZ += -rivalDeltaSpeed;
              if (relZ > 18) relZ -= 160;
              if (relZ < -145) relZ += 160;
              child.userData.relZ = relZ;
              child.position.set(weaveX, 0.03, 16.0 + relZ);
              child.rotation.y = Math.cos(this.simTime * (1.0 + rIdx * 0.2) + rIdx * 1.7) * -0.1;
              if (relZ < 0) carsAhead++;
            }
          });
        }
        this.racePosition = Math.max(1, Math.min(7, carsAhead + 1));

        const targetFov = nitroActive && this.raceNitroPct > 2 ? 71 : 61;
        if (Math.abs(this.camera.fov - targetFov) > 0.2) {
          this.camera.fov += (targetFov - this.camera.fov) * Math.min(1, dt * 6);
          this.camera.updateProjectionMatrix();
        }
        this.camera.position.set(
          this.playerCarX * 0.82,
          2.72,
          24.2 + (nitroActive && this.raceNitroPct > 2 ? 0.65 : 0)
        );
        this.camera.lookAt(this.playerCarX * 0.92, 1.15, -18.0);
      } else if (
        layoutMode === 'f22_jet' ||
        layoutMode === 'sr71_plane' ||
        layoutMode === 'apache_heli'
      ) {
        // Playable Supersonic Flight / Gunship Simulation: A/D Roll & Bank, W/S Pitch & Altitude, Shift/Space Afterburner
        const boostActive =
          this.keysDown.has('ShiftLeft') ||
          this.keysDown.has('ShiftRight') ||
          this.keysDown.has('Space');
        const rollLeft = this.keysDown.has('KeyA') || this.keysDown.has('ArrowLeft');
        const rollRight = this.keysDown.has('KeyD') || this.keysDown.has('ArrowRight');
        const climbUp = this.keysDown.has('KeyW') || this.keysDown.has('ArrowUp');
        const diveDown = this.keysDown.has('KeyS') || this.keysDown.has('ArrowDown');

        const baseAirSpeed =
          layoutMode === 'sr71_plane' ? 2850 : layoutMode === 'f22_jet' ? 1680 : 325;
        const targetAirSpeed = boostActive && this.raceNitroPct > 2
          ? baseAirSpeed * 1.42
          : baseAirSpeed + Math.sin(this.simTime * 0.9) * (baseAirSpeed * 0.06);
        this.raceSpeedKmh = Math.round(this.raceSpeedKmh + (targetAirSpeed - this.raceSpeedKmh) * Math.min(1, dt * 5));
        if (boostActive && this.raceNitroPct > 0) {
          this.raceNitroPct = Math.max(0, Number((this.raceNitroPct - dt * 18).toFixed(0)));
        } else {
          this.raceNitroPct = Math.min(100, Number((this.raceNitroPct + dt * 12).toFixed(0)));
        }

        const targetBank = rollLeft ? -1 : rollRight ? 1 : Math.sin(this.simTime * 0.72) * 0.42;
        this.playerCarSteer += (targetBank - this.playerCarSteer) * Math.min(1, dt * 6);
        this.playerCarX = Math.max(-13.5, Math.min(13.5, this.playerCarX + this.playerCarSteer * dt * 16));

        const targetPitch = climbUp ? 1 : diveDown ? -1 : Math.cos(this.simTime * 0.85) * 0.28;
        this.playerFlightPitch += (targetPitch - this.playerFlightPitch) * Math.min(1, dt * 5);
        this.playerFlightY = Math.max(4.5, Math.min(20.5, this.playerFlightY + this.playerFlightPitch * dt * 8));

        // Scroll ground terrain texture & drifting 3D volumetric cloud clusters
        if (this.flightGroundTex) {
          this.flightGroundTex.offset.y = (this.flightGroundTex.offset.y + dt * (layoutMode === 'sr71_plane' ? 2.4 : layoutMode === 'f22_jet' ? 1.8 : 0.75)) % 1;
        }
        if (this.flightCloudsMesh) {
          const cloudSpeed = layoutMode === 'sr71_plane' ? 92 : layoutMode === 'f22_jet' ? 68 : 26;
          const cnt = this.flightCloudsMesh.count;
          for (let c = 0; c < cnt; c++) {
            const cx = this.flightCloudMeta[c * 5];
            const cy = this.flightCloudMeta[c * 5 + 1];
            let cz = this.flightCloudMeta[c * 5 + 2] + cloudSpeed * dt * (boostActive ? 1.45 : 1.0);
            if (cz > 56) cz -= 260;
            this.flightCloudMeta[c * 5 + 2] = cz;
            const scX = this.flightCloudMeta[c * 5 + 3];
            const scY = this.flightCloudMeta[c * 5 + 4];
            _dummy.position.set(cx, cy, cz);
            _dummy.rotation.set(0, c * 0.4, 0);
            _dummy.scale.set(scX, scY, scX * 1.4);
            _dummy.updateMatrix();
            this.flightCloudsMesh.setMatrixAt(c, _dummy.matrix);
          }
          this.flightCloudsMesh.instanceMatrix.needsUpdate = true;
        }

        // Spin Apache main & tail rotors
        for (const rotor of this.aircraftRotors) {
          if (rotor.userData.axis === 'x') rotor.rotation.x += dt * 42;
          else rotor.rotation.y += dt * 32;
        }

        if (this.playerAircraftGroup) {
          this.playerAircraftGroup.position.set(this.playerCarX, this.playerFlightY, 14.0);
          if (layoutMode === 'apache_heli') {
            this.playerAircraftGroup.rotation.z = -this.playerCarSteer * 0.28;
            this.playerAircraftGroup.rotation.x = -0.09 + this.playerFlightPitch * 0.14;
            this.playerAircraftGroup.rotation.y = -this.playerCarSteer * 0.18;
          } else {
            this.playerAircraftGroup.rotation.z = -this.playerCarSteer * 0.56;
            this.playerAircraftGroup.rotation.x = this.playerFlightPitch * 0.22;
            this.playerAircraftGroup.rotation.y = -this.playerCarSteer * 0.14;
          }
          const flames = this.playerAircraftGroup.userData.flames as THREE.Mesh[] | undefined;
          if (flames) {
            const flameScale = boostActive && this.raceNitroPct > 2
              ? 1.75 + Math.sin(this.simTime * 48) * 0.28
              : 0.9 + Math.sin(this.simTime * 24) * 0.14;
            flames.forEach((f) => f.scale.set(1, flameScale, 1));
          }
        }

        // Wingmen gentle formation bobbing
        if (this.coreGroup) {
          this.coreGroup.children.forEach((child, idx) => {
            if (child.userData.isWingman) {
              const wx = Number(child.userData.wingX) || 0;
              const wy = Number(child.userData.wingY) || 14;
              const wz = Number(child.userData.wingZ) || -14;
              child.position.set(
                wx + Math.sin(this.simTime * 0.8 + idx * 2) * 1.6,
                wy + Math.cos(this.simTime * 1.1 + idx) * 1.1,
                wz
              );
              child.rotation.z = -Math.cos(this.simTime * 0.8 + idx * 2) * 0.22;
            }
          });
        }

        const targetFov = boostActive && this.raceNitroPct > 2 ? 72 : 60;
        if (Math.abs(this.camera.fov - targetFov) > 0.2) {
          this.camera.fov += (targetFov - this.camera.fov) * Math.min(1, dt * 6);
          this.camera.updateProjectionMatrix();
        }
        this.camera.position.set(
          this.playerCarX * 0.78,
          this.playerFlightY + 3.2,
          28.5 + (boostActive && this.raceNitroPct > 2 ? 0.9 : 0)
        );
        this.camera.lookAt(this.playerCarX * 0.92, this.playerFlightY - 0.3, -24.0);
      } else if (layoutMode === 'soccer_stadium') {
        // Playable 5v5 Arcade Soccer Stadium: WASD/Arrows move hero #10, Space/Click kicks ball toward goal
        this.soccerMatchSec += dt;
        let moveX = 0;
        let moveZ = 0;
        if (this.keysDown.has('KeyA') || this.keysDown.has('ArrowLeft')) moveX -= 1;
        if (this.keysDown.has('KeyD') || this.keysDown.has('ArrowRight')) moveX += 1;
        if (this.keysDown.has('KeyW') || this.keysDown.has('ArrowUp')) moveZ -= 1;
        if (this.keysDown.has('KeyS') || this.keysDown.has('ArrowDown')) moveZ += 1;

        const manualControl = moveX !== 0 || moveZ !== 0;
        if (!manualControl) {
          // Smart autopilot chasing ball smoothly so benchmark & spectators see active football!
          const dx = this.soccerBallPos.x - this.soccerPlayerPos.x;
          const dz = (this.soccerBallPos.z + 1.2) - this.soccerPlayerPos.z;
          const dist = Math.hypot(dx, dz);
          if (dist > 0.6) {
            moveX = dx / dist;
            moveZ = dz / dist;
          }
        } else {
          const mag = Math.hypot(moveX, moveZ) || 1;
          moveX /= mag;
          moveZ /= mag;
        }

        const playerSpeed = 12.5;
        this.soccerPlayerPos.x = Math.max(-23.5, Math.min(23.5, this.soccerPlayerPos.x + moveX * playerSpeed * dt));
        this.soccerPlayerPos.z = Math.max(-36.5, Math.min(36.5, this.soccerPlayerPos.z + moveZ * playerSpeed * dt));
        if (Math.hypot(moveX, moveZ) > 0.1) {
          this.soccerPlayerYaw = Math.atan2(moveX, moveZ);
        }

        const animatePlayerLegs = (player: THREE.Group, speedFactor: number, phaseOffset: number) => {
          const legs = player.userData.legs as THREE.Object3D[] | undefined;
          if (legs && legs.length === 2) {
            const swing = Math.sin(this.simTime * 11 * speedFactor + phaseOffset) * 0.55 * Math.min(1, speedFactor);
            legs[0].rotation.x = swing;
            legs[1].rotation.x = -swing;
          }
        };

        if (this.soccerPlayerGroup) {
          this.soccerPlayerGroup.position.copy(this.soccerPlayerPos);
          this.soccerPlayerGroup.rotation.y = this.soccerPlayerYaw;
          animatePlayerLegs(this.soccerPlayerGroup, Math.hypot(moveX, moveZ) > 0.05 ? 1.15 : 0.2, 0);
        }

        // Player-ball dribble & touch impulse
        const distHeroBall = this.soccerPlayerPos.distanceTo(this.soccerBallPos);
        if (distHeroBall < 1.35) {
          _dirVec.set(this.soccerBallPos.x - this.soccerPlayerPos.x, 0, this.soccerBallPos.z - this.soccerPlayerPos.z);
          if (_dirVec.lengthSq() < 0.01) _dirVec.set(0, 0, -1);
          _dirVec.normalize();
          this.soccerBallVel.lerp(_dirVec.multiplyScalar(15), Math.min(1, dt * 8));
        }

        // Update Teammates & Opponents AI
        this.soccerTeammates.forEach((mate, idx) => {
          const bx = Number(mate.userData.baseX) || 0;
          const bz = Number(mate.userData.baseZ) || 0;
          const tx = bx + Math.sin(this.simTime * 1.1 + idx) * 4.5;
          const tz = idx === 3 ? 35.0 : Math.max(-32, Math.min(34, bz * 0.65 + this.soccerBallPos.z * 0.35));
          const vx = tx - mate.position.x;
          const vz = tz - mate.position.z;
          mate.position.x += vx * Math.min(1, dt * 2.2);
          mate.position.z += vz * Math.min(1, dt * 2.2);
          if (Math.hypot(vx, vz) > 0.2) mate.rotation.y = Math.atan2(vx, vz);
          animatePlayerLegs(mate, 0.85, idx * 1.4);
          if (mate.position.distanceTo(this.soccerBallPos) < 1.25) {
            this.soccerBallVel.set((Math.random() - 0.5) * 8, 0, -16);
          }
        });

        this.soccerOpponents.forEach((opp, idx) => {
          const bx = Number(opp.userData.baseX) || 0;
          const bz = Number(opp.userData.baseZ) || 0;
          const tx = idx === 0 ? Math.max(-4.5, Math.min(4.5, this.soccerBallPos.x * 0.6)) : bx + Math.cos(this.simTime * 1.2 + idx) * 4.2;
          const tz = idx === 0 ? -35.2 : Math.max(-34, Math.min(32, bz * 0.6 + this.soccerBallPos.z * 0.4));
          const vx = tx - opp.position.x;
          const vz = tz - opp.position.z;
          opp.position.x += vx * Math.min(1, dt * 2.4);
          opp.position.z += vz * Math.min(1, dt * 2.4);
          if (Math.hypot(vx, vz) > 0.2) opp.rotation.y = Math.atan2(vx, vz);
          animatePlayerLegs(opp, 0.9, idx * 1.9);
          if (opp.position.distanceTo(this.soccerBallPos) < 1.25) {
            this.soccerBallVel.set((Math.random() - 0.5) * 9, 0, 15);
          }
        });

        // Ball kinematics & grass friction
        this.soccerBallPos.addScaledVector(this.soccerBallVel, dt);
        this.soccerBallVel.multiplyScalar(Math.pow(0.55, dt));
        this.soccerBallSpeedKmh = Math.round(this.soccerBallVel.length() * 3.6);

        // Goal scoring check (Goal mouth width [-5.0, +5.0] at z = ±37.5)
        if (Math.abs(this.soccerBallPos.x) < 5.0 && this.soccerBallPos.z < -37.2) {
          this.soccerScoreHome++;
          this.targetsHit++;
          this.soccerBallPos.set(0, 0.46, 0);
          this.soccerBallVel.set((Math.random() - 0.5) * 5, 0, 4);
        } else if (Math.abs(this.soccerBallPos.x) < 5.0 && this.soccerBallPos.z > 37.2) {
          this.soccerScoreAway++;
          this.soccerBallPos.set(0, 0.46, 0);
          this.soccerBallVel.set((Math.random() - 0.5) * 5, 0, -5);
        } else {
          if (this.soccerBallPos.x < -24.5 || this.soccerBallPos.x > 24.5) {
            this.soccerBallVel.x *= -0.82;
            this.soccerBallPos.x = Math.max(-24.5, Math.min(24.5, this.soccerBallPos.x));
          }
          if (this.soccerBallPos.z < -37.5 || this.soccerBallPos.z > 37.5) {
            this.soccerBallVel.z *= -0.82;
            this.soccerBallPos.z = Math.max(-37.5, Math.min(37.5, this.soccerBallPos.z));
          }
        }

        if (this.soccerBallMesh) {
          this.soccerBallMesh.position.copy(this.soccerBallPos);
          this.soccerBallMesh.rotation.x += this.soccerBallVel.z * dt * 1.4;
          this.soccerBallMesh.rotation.z -= this.soccerBallVel.x * dt * 1.4;
        }

        // Smooth broadcast stadium chase camera following action
        const camTargetX = this.soccerBallPos.x * 0.45 + this.soccerPlayerPos.x * 0.25;
        const camTargetZ = Math.max(-6, Math.min(26, this.soccerBallPos.z * 0.5 + 24));
        this.camera.position.x += (camTargetX - this.camera.position.x) * Math.min(1, dt * 4);
        this.camera.position.y += (14.5 - this.camera.position.y) * Math.min(1, dt * 4);
        this.camera.position.z += (camTargetZ - this.camera.position.z) * Math.min(1, dt * 4);
        this.camera.lookAt(this.soccerBallPos.x * 0.55, 1.0, this.soccerBallPos.z * 0.65 - 2.0);
      } else if (layoutMode === 'corridor') {
        const zCam = 42 - ((this.simTime * 18) % 84);
        this.camera.position.set(Math.sin(this.simTime * 0.9) * 5.5, 7.5 + Math.cos(this.simTime * 0.6) * 2.0, zCam);
        this.camera.lookAt(0, 8.0, zCam - 30);
      } else if (layoutMode === 'dyson' || layoutMode === 'supernova') {
        const orbitR = 38 + Math.sin(this.simTime * 0.4) * 8;
        const orbitA = this.simTime * 0.28;
        this.camera.position.set(
          Math.cos(orbitA) * orbitR,
          16.0 + Math.sin(this.simTime * 0.6) * 7.5,
          Math.sin(orbitA) * orbitR
        );
        this.camera.lookAt(0, 14.5, 0);
      } else if (layoutMode === 'colosseum') {
        const orbitR = 26 + Math.sin(this.simTime * 0.35) * 6;
        const orbitA = this.simTime * 0.22;
        this.camera.position.set(
          Math.cos(orbitA) * orbitR,
          12.0 + Math.sin(this.simTime * 0.5) * 3.5,
          Math.sin(orbitA) * orbitR
        );
        this.camera.lookAt(0, 12.5, 0);
      } else {
        const orbitR = 32 + Math.sin(this.simTime * 0.3) * 10;
        const orbitA = this.simTime * 0.25;
        this.camera.position.set(
          Math.cos(orbitA) * orbitR,
          11.0 + Math.sin(this.simTime * 0.5) * 4.8,
          Math.sin(orbitA) * orbitR
        );
        this.camera.lookAt(0, 9.5, 0);
      }
    }

    // Hardware-synchronized GPU frame render & measurement
    const gl = this.renderer.getContext();
    const frameStart = performance.now();
    this.renderFrameOnce();
    if (this.fpsMode === 'uncapped') {
      gl.finish();
    }
    const frameMs = Math.max(0.2, performance.now() - frameStart);

    this.windowFrames++;
    this.frameTimes.push(frameMs);
    if (this.frameTimes.length > 140) this.frameTimes.shift();

    const elapsedWindowMs = performance.now() - this.windowStartTs;
    if (elapsedWindowMs >= 350) {
      const curFps =
        this.fpsMode === 'uncapped'
          ? Math.max(1, Math.round(1000 / Math.max(0.25, this.frameTimes.slice(-12).reduce((s, v) => s + v, 0) / Math.min(12, this.frameTimes.length))))
          : Math.max(1, Math.round((this.windowFrames * 1000) / elapsedWindowMs));
      this.windowFrames = 0;
      this.windowStartTs = performance.now();
      this.fpsSamples.push(curFps);
      if (this.fpsSamples.length > 90) this.fpsSamples.shift();

      const sortedFt = [...this.frameTimes].sort((a, b) => b - a);
      const p99Ft = sortedFt[Math.min(sortedFt.length - 1, Math.floor(sortedFt.length * 0.01))] || frameMs;
      const p999Ft = sortedFt[0] || frameMs;
      const low1PctFps = Math.max(1, Math.round(1000 / Math.max(0.25, p99Ft)));
      const low01PctFps = Math.max(1, Math.round(1000 / Math.max(0.25, p999Ft)));

      const avgFps = Math.round(this.fpsSamples.reduce((s, v) => s + v, 0) / this.fpsSamples.length);
      const minFps = Math.min(...this.fpsSamples);
      const maxFps = Math.max(...this.fpsSamples);

      const meanFt = this.frameTimes.reduce((s, v) => s + v, 0) / this.frameTimes.length;
      const variance = this.frameTimes.reduce((s, v) => s + (v - meanFt) ** 2, 0) / this.frameTimes.length;
      const cv = Math.sqrt(variance) / Math.max(0.2, meanFt);
      const stabilityPct = Number(Math.max(30, Math.min(100, (1 - cv * 0.85) * 100)).toFixed(1));

      const elapsedSec = (performance.now() - this.startTs) / 1000;
      const cfg = GAME_PRESETS[this.preset];
      const gameMeta = this.getGameCatalogItem();
      const realGpuTempC = thermalMonitorService.getLiveGpuTempC();
      const gpuLoadIndexPct = this.getLoadPct();

      this.telemetry.push({
        timeSec: Number(elapsedSec.toFixed(1)),
        fps: curFps,
        frameTimeMs: Number(meanFt.toFixed(2)),
        estTempC: realGpuTempC ?? 0,
      });
      if (this.telemetry.length > 40) this.telemetry.shift();

      const score = Math.max(
        10,
        Math.min(100, Math.round((avgFps / cfg.refFps) * 72 + stabilityPct * 0.28))
      );

      let verdict: GameBenchMetrics['verdict'] = 'ULTRA PŁYNNOŚĆ';
      if (avgFps < 24 || stabilityPct < 65) verdict = 'EKSTREMALNY THROTTLING';
      else if (avgFps < 48) verdict = 'CIĘŻKIE OBCIĄŻENIE';
      else if (avgFps < 85) verdict = 'GRYWALNE (60+)';

      this.metrics = {
        ...this.metrics,
        running: true,
        interactiveMode: this.interactiveMode,
        gameId: gameMeta.id,
        gameTitle: gameMeta.title,
        preset: this.preset,
        fpsMode: this.fpsMode,
        bloomEnabled: this.bloomEnabled,
        shadowsEnabled: this.shadowsEnabled,
        raymarchSteps: cfg.raymarchSteps,
        fps: curFps,
        avgFps,
        minFps,
        maxFps,
        low1PctFps,
        low01PctFps,
        frameTimeMs: Number(meanFt.toFixed(2)),
        triangles: this.lastTriangles,
        drawCalls: this.lastDrawCalls,
        elapsedSec: Number(elapsedSec.toFixed(1)),
        estTempC: realGpuTempC ?? 0,
        peakTempC: realGpuTempC !== null ? Math.max(this.metrics.peakTempC, realGpuTempC) : 0,
        realGpuTempC,
        gpuLoadIndexPct,
        stabilityPct,
        overallScore: score,
        shotsFired: this.shotsFired,
        targetsHit: this.targetsHit,
        isRacingMode: this.isRacingScene(gameMeta.layoutMode) || this.isFlightScene(gameMeta.layoutMode),
        isSoccerMode: this.isSoccerScene(gameMeta.layoutMode),
        raceSpeedKmh: this.raceSpeedKmh,
        raceLap: this.raceLap,
        raceNitroPct: this.raceNitroPct,
        soccerScoreHome: this.soccerScoreHome,
        soccerScoreAway: this.soccerScoreAway,
        soccerBallSpeedKmh: this.soccerBallSpeedKmh,
        soccerMatchSec: Math.round(this.soccerMatchSec),
        telemetry: [...this.telemetry],
        verdict,
      };
      this.emitMetrics();
    }

    this.scheduleLoop();
  }

  private handleResize(): void {
    if (!this.mountEl || !this.renderer || !this.camera) return;
    const w = Math.max(360, this.mountEl.clientWidth);
    const h = Math.max(280, this.mountEl.clientHeight);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.applyPresetScale(w, h);
    if (!this.running) {
      this.renderFrameOnce();
      this.metrics.triangles = this.lastTriangles;
      this.metrics.drawCalls = this.lastDrawCalls;
    }
  }

  private emitMetrics(): void {
    this.onMetrics?.(this.getMetrics());
  }

  public unmount(): void {
    this.stop();
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;

    if (this.renderer?.domElement) {
      (this.renderer.domElement as any)._gameCleanup?.();
    }

    if (this.scene) {
      this.clearSceneObjects(this.scene);
    }
    this.composer?.dispose();
    this.composer = null;
    this.bloomPass = null;
    this.envRT?.dispose();
    this.envRT = null;
    this.renderer?.dispose();
    this.renderer = null;
    this.scene = null;
    this.camera = null;
    this.mountEl = null;
  }
}

export const gameBenchService = new GameBenchService();
export { GAME_PRESETS };
