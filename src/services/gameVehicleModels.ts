import * as THREE from 'three';

export type VehicleStyle =
  | 'formula_gp'
  | 'drift_touge'
  | 'maglev_track'
  | 'dakar_rally'
  | 'bugatti_hypercar'
  | 'motogp_superbike'
  | 'corridor';

export type FlightStyle = 'f22_jet' | 'sr71_plane' | 'apache_heli' | 'f18_naval';
export type CombatStyle = 'tank_blitz' | 'mech_titan' | 'submarine_hunt' | 'starfighter_trench';

export interface RaceCarBuildOptions {
  style: VehicleStyle;
  paintHex: number;
  accentHex: number;
  isHero: boolean;
  plasmaMat: THREE.Material | null;
  shadowTex: THREE.CanvasTexture | null;
  wheelRegister: THREE.Object3D[];
  frontSteerRegister?: THREE.Object3D[];
}

export interface AircraftBuildOptions {
  style: FlightStyle;
  accentHex: number;
  plasmaMat: THREE.Material | null;
  rotorRegister: THREE.Object3D[];
}

function deterministicHash(n: number): number {
  const x = Math.sin(n * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
}

export function createContactShadowTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createRadialGradient(128, 128, 18, 128, 128, 122);
  grad.addColorStop(0, 'rgba(0, 0, 0, 0.86)');
  grad.addColorStop(0.55, 'rgba(0, 0, 0, 0.45)');
  grad.addColorStop(1, 'rgba(0, 0, 0, 0.0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 256, 256);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createArchitecturePbrTextures(
  mode: string,
  accentHex: number,
  maxAnisotropy: number
): {
  map: THREE.CanvasTexture;
  bumpMap: THREE.CanvasTexture;
  roughnessMap: THREE.CanvasTexture;
  emissiveMap: THREE.CanvasTexture;
} {
  const size = mode === 'dakar_rally' || mode === 'volcanic' || mode === 'snow_rally' || mode === 'glacial' || mode === 'soccer_stadium' || mode === 'starfighter_trench' || mode === 'tank_blitz' || mode === 'submarine_hunt' ? 512 : 1024;
  const albedo = document.createElement('canvas');
  albedo.width = size;
  albedo.height = size;
  const ctx = albedo.getContext('2d')!;

  const bump = document.createElement('canvas');
  bump.width = size;
  bump.height = size;
  const bctx = bump.getContext('2d')!;

  const rough = document.createElement('canvas');
  rough.width = size;
  rough.height = size;
  const rctx = rough.getContext('2d')!;

  const emiss = document.createElement('canvas');
  emiss.width = size;
  emiss.height = size;
  const ectx = emiss.getContext('2d')!;

  const accentCol = new THREE.Color(accentHex);
  const accentCss = `rgb(${Math.round(accentCol.r * 255)}, ${Math.round(accentCol.g * 255)}, ${Math.round(accentCol.b * 255)})`;

  if (mode === 'dakar_rally' || mode === 'volcanic') {
    // Stratified canyon sandstone / volcanic basalt rock layers
    ctx.fillStyle = mode === 'volcanic' ? '#1c1110' : '#6c3419';
    ctx.fillRect(0, 0, size, size);
    rctx.fillStyle = '#cfcfcf';
    rctx.fillRect(0, 0, size, size);
    bctx.fillStyle = '#808080';
    bctx.fillRect(0, 0, size, size);
    ectx.fillStyle = '#000000';
    ectx.fillRect(0, 0, size, size);

    for (let y = 0; y < size; y += 16) {
      const h = deterministicHash(y * 1.7);
      ctx.fillStyle =
        mode === 'volcanic'
          ? h > 0.5 ? '#261715' : '#140b0a'
          : h > 0.6 ? '#8d4925' : h > 0.3 ? '#592813' : '#a85a2e';
      ctx.fillRect(0, y, size, 12 + Math.floor(h * 8));
      bctx.fillStyle = h > 0.5 ? '#b4b4b4' : '#4a4a4a';
      bctx.fillRect(0, y, size, 10);
      if (mode === 'volcanic' && h > 0.82) {
        ectx.fillStyle = '#ea580c';
        ectx.fillRect(0, y + 4, size, 3);
      }
    }
  } else if (mode === 'snow_rally' || mode === 'glacial') {
    // Alpine jagged granite rock + frosted snow ledges
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(0, 0, size, size);
    rctx.fillStyle = '#8a8a8a';
    rctx.fillRect(0, 0, size, size);
    bctx.fillStyle = '#787878';
    bctx.fillRect(0, 0, size, size);
    ectx.fillStyle = '#000000';
    ectx.fillRect(0, 0, size, size);

    for (let i = 0; i < 420; i++) {
      const rx = deterministicHash(i * 3.1) * size;
      const ry = deterministicHash(i * 5.9) * size;
      const rw = 14 + deterministicHash(i * 7.3) * 48;
      const rh = 6 + deterministicHash(i * 9.7) * 18;
      const isSnow = deterministicHash(i * 11.1) > 0.58;
      ctx.fillStyle = isSnow ? 'rgba(226, 240, 255, 0.85)' : 'rgba(51, 65, 85, 0.72)';
      ctx.fillRect(rx, ry, rw, rh);
      rctx.fillStyle = isSnow ? '#3a3a3a' : '#a6a6a6';
      rctx.fillRect(rx, ry, rw, rh);
      bctx.fillStyle = isSnow ? '#c4c4c4' : '#525252';
      bctx.fillRect(rx, ry, rw, rh);
    }
    if (mode === 'glacial') {
      ectx.fillStyle = 'rgba(56, 189, 248, 0.35)';
      ectx.fillRect(0, 0, size, 24);
    }
  } else if (mode === 'soccer_stadium') {
    // Stadium tiered seating bowls + concrete concourse + LED perimeter ribbon
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, size, size);
    rctx.fillStyle = '#909090';
    rctx.fillRect(0, 0, size, size);
    bctx.fillStyle = '#707070';
    bctx.fillRect(0, 0, size, size);
    ectx.fillStyle = '#000000';
    ectx.fillRect(0, 0, size, size);

    for (let row = 0; row < 16; row++) {
      const y = row * 32;
      ctx.fillStyle = row % 2 === 0 ? '#1e293b' : '#0f172a';
      ctx.fillRect(0, y, size, 28);
      bctx.fillStyle = '#c8c8c8';
      bctx.fillRect(0, y, size, 6);
      // Colored crowd seats / LED banner strip
      for (let col = 0; col < 32; col++) {
        const s = deterministicHash(row * 41 + col * 13);
        if (s > 0.25) {
          ctx.fillStyle = s > 0.72 ? '#38bdf8' : s > 0.5 ? '#ef4444' : '#cbd5e1';
          ctx.fillRect(col * 16 + 3, y + 10, 10, 12);
        }
      }
      if (row === 14) {
        ectx.fillStyle = accentCss;
        ectx.fillRect(0, y, size, 16);
      }
    }
  } else if (mode === 'starfighter_trench') {
    // Armored sci-fi hull plating with recessed trenches, panel seams & tactical conduit glow
    ctx.fillStyle = '#1e2532';
    ctx.fillRect(0, 0, size, size);
    rctx.fillStyle = '#5a5a5a';
    rctx.fillRect(0, 0, size, size);
    bctx.fillStyle = '#888888';
    bctx.fillRect(0, 0, size, size);
    ectx.fillStyle = '#000000';
    ectx.fillRect(0, 0, size, size);

    for (let i = 0; i < 64; i++) {
      const px = Math.floor(deterministicHash(i * 19 + 3) * 8) * (size / 8);
      const py = Math.floor(deterministicHash(i * 37 + 11) * 8) * (size / 8);
      const pw = (1 + Math.floor(deterministicHash(i * 53) * 2)) * (size / 8);
      const ph = (1 + Math.floor(deterministicHash(i * 71) * 2)) * (size / 8);
      const shade = 26 + Math.floor(deterministicHash(i * 13) * 24);
      ctx.fillStyle = `rgb(${shade}, ${shade + 6}, ${shade + 14})`;
      ctx.fillRect(px + 2, py + 2, pw - 4, ph - 4);
      ctx.strokeStyle = '#0a0f18';
      ctx.lineWidth = 2;
      ctx.strokeRect(px + 1, py + 1, pw - 2, ph - 2);
      bctx.fillStyle = '#b4b4b4';
      bctx.fillRect(px + 3, py + 3, pw - 6, ph - 6);
      rctx.fillStyle = i % 3 === 0 ? '#3a3a3a' : '#6c6c6c';
      rctx.fillRect(px + 3, py + 3, pw - 6, ph - 6);
    }
    // Crisp recessed ventilation slits & subtle red/cyan status dots
    for (let row = 0; row < 12; row++) {
      const y = Math.floor((row + 0.5) * (size / 12));
      if (row % 4 === 1) {
        ectx.fillStyle = accentCss;
        ectx.fillRect(14, y, 42, 4);
        ectx.fillRect(size - 64, y, 42, 4);
      }
    }
  } else if (mode === 'tank_blitz') {
    // Stratified desert canyon sandstone & weathered bunker concrete
    ctx.fillStyle = '#8b6542';
    ctx.fillRect(0, 0, size, size);
    rctx.fillStyle = '#d4d4d4';
    rctx.fillRect(0, 0, size, size);
    bctx.fillStyle = '#808080';
    bctx.fillRect(0, 0, size, size);
    ectx.fillStyle = '#000000';
    ectx.fillRect(0, 0, size, size);
    for (let y = 0; y < size; y += 10) {
      const n = deterministicHash(y * 17);
      const r = Math.round(126 + n * 48);
      const g = Math.round(92 + n * 34);
      const b = Math.round(58 + n * 24);
      ctx.fillStyle = `rgb(${r},${g},${b})`;
      ctx.fillRect(0, y, size, 10);
      const bv = Math.round(95 + n * 75);
      bctx.fillStyle = `rgb(${bv},${bv},${bv})`;
      bctx.fillRect(0, y, size, 10);
    }
  } else if (mode === 'submarine_hunt') {
    // Abyssal basalt cliff rock with bioluminescent mineral veins
    ctx.fillStyle = '#0b1e2d';
    ctx.fillRect(0, 0, size, size);
    rctx.fillStyle = '#9a9a9a';
    rctx.fillRect(0, 0, size, size);
    bctx.fillStyle = '#707070';
    bctx.fillRect(0, 0, size, size);
    ectx.fillStyle = '#000000';
    ectx.fillRect(0, 0, size, size);
    for (let i = 0; i < 42; i++) {
      const cx = deterministicHash(i * 23) * size;
      const cy = deterministicHash(i * 41) * size;
      const rad = 18 + deterministicHash(i * 61) * 44;
      ctx.fillStyle = i % 2 === 0 ? '#112a3d' : '#081724';
      ctx.beginPath();
      ctx.arc(cx, cy, rad, 0, Math.PI * 2);
      ctx.fill();
      bctx.fillStyle = '#b8b8b8';
      bctx.beginPath();
      bctx.arc(cx, cy, rad * 0.7, 0, Math.PI * 2);
      bctx.fill();
      if (i % 7 === 0) {
        ectx.fillStyle = '#06b6d4';
        ectx.beginPath();
        ectx.arc(cx, cy, 4, 0, Math.PI * 2);
        ectx.fill();
      }
    }
  } else {
    // High-Resolution 1024x1024 Architectural Glass Curtain-Wall & Brushed Steel Skyscraper Facade
    const grad = ctx.createLinearGradient(0, 0, 0, size);
    grad.addColorStop(0, '#0a1426');
    grad.addColorStop(0.5, '#101d32');
    grad.addColorStop(1, '#070e1c');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);

    // Mirror-smooth dark curtain glass
    rctx.fillStyle = '#181818';
    rctx.fillRect(0, 0, size, size);
    bctx.fillStyle = '#727272';
    bctx.fillRect(0, 0, size, size);
    ectx.fillStyle = '#000000';
    ectx.fillRect(0, 0, size, size);

    const cols = 16;
    const rows = 28;
    const cellW = size / cols;
    const cellH = size / rows;

    for (let row = 0; row < rows; row++) {
      const y = row * cellH;
      const floorHash = deterministicHash(row * 131 + 19);
      const isOccupiedFloor = floorHash > 0.36;
      const isMechanicalFloor = row === 0 || row === 14 || row === 27;

      for (let col = 0; col < cols; col++) {
        const x = col * cellW;
        const paneHash = deterministicHash(row * 73 + col * 29 + 5);

        if (!isMechanicalFloor) {
          const glassR = 12 + Math.floor(paneHash * 16);
          const glassG = 22 + Math.floor(paneHash * 24);
          const glassB = 42 + Math.floor(paneHash * 34);
          ctx.fillStyle = `rgb(${glassR}, ${glassG}, ${glassB})`;
          ctx.fillRect(x + 4, y + 5, cellW - 8, cellH - 10);

          if (isOccupiedFloor && paneHash > 0.48) {
            const innerGrad = ctx.createLinearGradient(x, y + 5, x, y + cellH - 5);
            const warmOffice = paneHash > 0.72;
            const cTop = warmOffice ? '#e2b26b' : '#7ec4f2';
            const cBot = warmOffice ? '#5c3f1c' : '#1e3c5c';
            innerGrad.addColorStop(0, cTop);
            innerGrad.addColorStop(1, cBot);
            ctx.fillStyle = innerGrad;
            ctx.fillRect(x + 6, y + 7, cellW - 12, cellH - 14);

            // Crisp recessed office ceiling illumination for rich skyline HDR bloom
            ectx.fillStyle = warmOffice ? '#d89b48' : '#58a6df';
            ectx.fillRect(x + 7, y + 7, cellW - 14, Math.max(4, (cellH - 14) * 0.48));
            // Subtle interior desk silhouette dividers
            ctx.fillStyle = 'rgba(8, 14, 24, 0.48)';
            ctx.fillRect(x + 6, y + cellH - 12, cellW - 12, 4);
          }
        }
      }

      // Horizontal brushed aluminum spandrel beams
      ctx.fillStyle = isMechanicalFloor ? '#1e2c42' : '#162235';
      ctx.fillRect(0, y, size, isMechanicalFloor ? 12 : 6);
      rctx.fillStyle = '#707070';
      rctx.fillRect(0, y, size, isMechanicalFloor ? 12 : 6);
      bctx.fillStyle = '#d8d8d8';
      bctx.fillRect(0, y, size, isMechanicalFloor ? 12 : 6);
    }

    // Precision vertical steel curtain mullions
    ctx.fillStyle = '#1b283d';
    rctx.fillStyle = '#585858';
    bctx.fillStyle = '#d0d0d0';
    for (let col = 0; col <= cols; col++) {
      const x = Math.round(col * cellW);
      ctx.fillRect(x, 0, 5, size);
      rctx.fillRect(x, 0, 5, size);
      bctx.fillRect(x, 0, 5, size);
    }

    // Crisp narrow architectural rooftop crown light strip & mid-tower accent beacon
    ectx.fillStyle = accentCss;
    ectx.fillRect(0, 3, size, 6);
    ectx.fillStyle = accentCss;
    ectx.fillRect(0, Math.round(size * 0.5), size, 3);
  }

  const setup = (c: HTMLCanvasElement, isSrgb: boolean) => {
    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.anisotropy = maxAnisotropy;
    if (isSrgb) tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  };

  return {
    map: setup(albedo, true),
    bumpMap: setup(bump, false),
    roughnessMap: setup(rough, false),
    emissiveMap: setup(emiss, true),
  };
}

export function createArticulatedSoccerPlayer(kitHex: number, isHero: boolean, shadowTex: THREE.CanvasTexture | null): THREE.Group {
  const player = new THREE.Group();

  const kitMat = new THREE.MeshPhysicalMaterial({
    color: kitHex,
    roughness: 0.42,
    metalness: 0.12,
    clearcoat: isHero ? 0.35 : 0.1,
    emissive: kitHex,
    emissiveIntensity: isHero ? 0.22 : 0.05,
  });
  const trimMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.35 });
  const skinMat = new THREE.MeshStandardMaterial({ color: 0xebb888, roughness: 0.58 });
  const shortMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.48 });
  const bootMat = new THREE.MeshStandardMaterial({
    color: isHero ? 0x22d3ee : 0x111827,
    roughness: 0.28,
    metalness: 0.35,
  });

  if (shadowTex) {
    const sh = new THREE.Mesh(
      new THREE.PlaneGeometry(1.7, 1.7),
      new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, opacity: 0.72, depthWrite: false })
    );
    sh.rotation.x = -Math.PI / 2;
    sh.position.y = 0.02;
    player.add(sh);
  }

  // Sculpted Athletic Torso (tapered chest + shoulders + collar + jersey stripe)
  const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.28, 0.96, 14), kitMat);
  torso.position.y = 1.54;
  torso.scale.set(1.22, 1.0, 0.68);
  torso.castShadow = true;
  player.add(torso);

  const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.88, 0.5), trimMat);
  stripe.position.y = 1.54;
  player.add(stripe);

  // Shoulders & Arms
  for (const sx of [-1, 1]) {
    const shoulder = new THREE.Mesh(new THREE.SphereGeometry(0.14, 12, 10), kitMat);
    shoulder.position.set(sx * 0.46, 1.9, 0);
    const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.085, 0.46, 6, 10), skinMat);
    arm.position.set(sx * 0.49, 1.48, 0.05);
    arm.rotation.z = sx * 0.14;
    player.add(shoulder, arm);
  }

  // Head + Hair + Neck
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.11, 0.16, 10), skinMat);
  neck.position.y = 2.08;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.24, 18, 16), skinMat);
  head.position.y = 2.32;
  head.castShadow = true;
  const hair = new THREE.Mesh(
    new THREE.SphereGeometry(0.255, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.58),
    new THREE.MeshStandardMaterial({ color: 0x1e1b18, roughness: 0.75 })
  );
  hair.position.set(0, 2.35, -0.02);
  hair.rotation.x = -0.22;
  player.add(neck, head, hair);

  // Pelvis / Shorts
  const pelvis = new THREE.Mesh(new THREE.CylinderGeometry(0.29, 0.31, 0.32, 12), shortMat);
  pelvis.scale.set(1.15, 1, 0.74);
  pelvis.position.y = 0.98;
  player.add(pelvis);

  // Articulated Legs with Socks & Cleats pivoting from hip
  const legs: THREE.Group[] = [];
  for (const sx of [-0.18, 0.18]) {
    const legPivot = new THREE.Group();
    legPivot.position.set(sx, 0.92, 0);
    const thigh = new THREE.Mesh(new THREE.CapsuleGeometry(0.115, 0.32, 6, 10), shortMat);
    thigh.position.y = -0.22;
    const shin = new THREE.Mesh(new THREE.CapsuleGeometry(0.085, 0.38, 6, 10), kitMat);
    shin.position.y = -0.62;
    const boot = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.12, 0.34), bootMat);
    boot.position.set(0, -0.86, 0.08);
    legPivot.add(thigh, shin, boot);
    player.add(legPivot);
    legs.push(legPivot);
  }
  player.userData.legs = legs;

  if (isHero) {
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.75, 0.96, 32),
      new THREE.MeshBasicMaterial({ color: 0x22c55e, side: THREE.DoubleSide })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.04;
    player.add(ring);
  }

  return player;
}

export function createRacingTrackTextures(
  mode: VehicleStyle,
  maxAnisotropy: number
): {
  map: THREE.CanvasTexture;
  roughnessMap: THREE.CanvasTexture;
  bumpMap: THREE.CanvasTexture;
} {
  const size = 1024;
  const albedoCanvas = document.createElement('canvas');
  albedoCanvas.width = size;
  albedoCanvas.height = size;
  const ctx = albedoCanvas.getContext('2d')!;

  const roughCanvas = document.createElement('canvas');
  roughCanvas.width = size;
  roughCanvas.height = size;
  const rctx = roughCanvas.getContext('2d')!;

  const bumpCanvas = document.createElement('canvas');
  bumpCanvas.width = size;
  bumpCanvas.height = size;
  const bctx = bumpCanvas.getContext('2d')!;

  if (mode === 'dakar_rally') {
    // Rich Red Canyon Sand & Compacted Off-Road Rally Dirt Track
    const sandGrad = ctx.createLinearGradient(0, 0, size, 0);
    sandGrad.addColorStop(0, '#7c3f1d');
    sandGrad.addColorStop(0.14, '#a2582c');
    sandGrad.addColorStop(0.5, '#b86c3a');
    sandGrad.addColorStop(0.86, '#a2582c');
    sandGrad.addColorStop(1, '#7c3f1d');
    ctx.fillStyle = sandGrad;
    ctx.fillRect(0, 0, size, size);

    // Dual compacted tire track ruts
    ctx.fillStyle = 'rgba(72, 34, 14, 0.36)';
    ctx.fillRect(280, 0, 96, size);
    ctx.fillRect(648, 0, 96, size);
    ctx.fillStyle = 'rgba(46, 20, 8, 0.25)';
    ctx.fillRect(306, 0, 44, size);
    ctx.fillRect(674, 0, 44, size);

    // Subtle wind-swept sand ripples & pebbles
    rctx.fillStyle = '#c8c8c8';
    rctx.fillRect(0, 0, size, size);
    bctx.fillStyle = '#808080';
    bctx.fillRect(0, 0, size, size);

    for (let i = 0; i < 4200; i++) {
      const rx = deterministicHash(i * 3.1) * size;
      const ry = deterministicHash(i * 5.7) * size;
      const w = 2 + deterministicHash(i * 7.3) * 10;
      const shade = deterministicHash(i * 9.1);
      ctx.fillStyle = shade > 0.5 ? 'rgba(255, 205, 145, 0.14)' : 'rgba(55, 22, 8, 0.18)';
      ctx.fillRect(rx, ry, w, 3);
      bctx.fillStyle = shade > 0.5 ? '#a8a8a8' : '#585858';
      bctx.fillRect(rx, ry, w, 3);
    }

    // Center dusty rally marker chevrons
    ctx.fillStyle = 'rgba(251, 191, 36, 0.28)';
    for (let y = 0; y < size; y += 128) {
      ctx.fillRect(507, y, 10, 56);
    }
    // Red-rock canyon shoulder markers
    ctx.fillStyle = '#9a3412';
    ctx.fillRect(0, 0, 88, size);
    ctx.fillRect(size - 88, 0, 88, size);
    ctx.fillStyle = 'rgba(251, 146, 60, 0.45)';
    ctx.fillRect(92, 0, 6, size);
    ctx.fillRect(size - 98, 0, 6, size);
  } else if (mode === 'maglev_track') {
    // Hypersonic Carbon-Titanium Magnetic Guideway
    ctx.fillStyle = '#071320';
    ctx.fillRect(0, 0, size, size);
    rctx.fillStyle = '#484848';
    rctx.fillRect(0, 0, size, size);
    bctx.fillStyle = '#808080';
    bctx.fillRect(0, 0, size, size);

    // Track metallic shoulder rails
    ctx.fillStyle = '#0f2942';
    ctx.fillRect(0, 0, 110, size);
    ctx.fillRect(size - 110, 0, 110, size);
    ctx.fillStyle = '#2dd4bf';
    ctx.fillRect(110, 0, 12, size);
    ctx.fillRect(size - 122, 0, 12, size);

    // Center magnetic induction coil strip + boost chevrons
    const coilGrad = ctx.createLinearGradient(440, 0, 584, 0);
    coilGrad.addColorStop(0, 'rgba(6, 182, 212, 0)');
    coilGrad.addColorStop(0.5, 'rgba(56, 189, 248, 0.55)');
    coilGrad.addColorStop(1, 'rgba(6, 182, 212, 0)');
    ctx.fillStyle = coilGrad;
    ctx.fillRect(440, 0, 144, size);

    ctx.fillStyle = 'rgba(34, 211, 238, 0.35)';
    for (let y = 0; y < size; y += 128) {
      ctx.beginPath();
      ctx.moveTo(512, y + 18);
      ctx.lineTo(590, y + 64);
      ctx.lineTo(568, y + 64);
      ctx.lineTo(512, y + 32);
      ctx.lineTo(456, y + 64);
      ctx.lineTo(434, y + 64);
      ctx.closePath();
      ctx.fill();
    }

    // Metallic deck plate seams
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.16)';
    ctx.lineWidth = 3;
    for (let y = 0; y < size; y += 64) {
      ctx.beginPath();
      ctx.moveTo(122, y);
      ctx.lineTo(size - 122, y);
      ctx.stroke();
      bctx.fillStyle = '#404040';
      bctx.fillRect(122, y, size - 244, 3);
    }
    rctx.fillStyle = '#242424';
    rctx.fillRect(460, 0, 104, size);
  } else {
    // High-Resolution Motorsport Asphalt (Formula GP, Bugatti Autobahn, Tokyo Drift Wet, Neon Corridor)
    const isWet = mode === 'drift_touge' || mode === 'corridor';
    const isAutobahn = mode === 'bugatti_hypercar';

    ctx.fillStyle = isWet ? '#0d111a' : isAutobahn ? '#161b24' : '#181d27';
    ctx.fillRect(0, 0, size, size);

    // Base roughness (lower value = glossier)
    rctx.fillStyle = isWet ? '#4c4c4c' : '#9c9c9c';
    rctx.fillRect(0, 0, size, size);
    bctx.fillStyle = '#808080';
    bctx.fillRect(0, 0, size, size);

    // Grass / Gravel / Shoulder Run-off
    ctx.fillStyle = isWet ? '#0b101d' : isAutobahn ? '#0e1726' : '#0a2a18';
    ctx.fillRect(0, 0, 88, size);
    ctx.fillRect(size - 88, 0, 88, size);

    // Asphalt micro-grain noise
    for (let i = 0; i < 6500; i++) {
      const gx = deterministicHash(i * 1.9 + 1) * (size - 180) + 90;
      const gy = deterministicHash(i * 4.3 + 2) * size;
      const v = deterministicHash(i * 6.7);
      ctx.fillStyle = v > 0.55 ? 'rgba(255,255,255,0.035)' : 'rgba(0,0,0,0.16)';
      ctx.fillRect(gx, gy, 3, 3);
      bctx.fillStyle = v > 0.55 ? '#969696' : '#686868';
      bctx.fillRect(gx, gy, 2, 2);
    }

    // Wet specular puddles for Tokyo Drift / Corridor
    if (isWet) {
      for (let p = 0; p < 18; p++) {
        const px = 160 + deterministicHash(p * 11.3) * 704;
        const py = deterministicHash(p * 17.7) * size;
        const rx = 38 + deterministicHash(p * 23.1) * 65;
        const ry = 70 + deterministicHash(p * 29.9) * 140;
        const pGrad = rctx.createRadialGradient(px, py, 4, px, py, Math.max(rx, ry));
        pGrad.addColorStop(0, '#141414');
        pGrad.addColorStop(1, 'rgba(76, 76, 76, 0)');
        rctx.fillStyle = pGrad;
        rctx.fillRect(px - rx, py - ry, rx * 2, ry * 2);

        ctx.fillStyle = 'rgba(10, 16, 30, 0.35)';
        ctx.beginPath();
        ctx.ellipse(px, py, rx * 0.8, ry * 0.8, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Dark rubber racing groove in 3 lanes
    for (const laneCenter of [260, 512, 764]) {
      const groove = ctx.createLinearGradient(laneCenter - 65, 0, laneCenter + 65, 0);
      groove.addColorStop(0, 'rgba(0,0,0,0)');
      groove.addColorStop(0.5, 'rgba(0,0,0,0.34)');
      groove.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = groove;
      ctx.fillRect(laneCenter - 65, 0, 130, size);

      const rgroove = rctx.createLinearGradient(laneCenter - 55, 0, laneCenter + 55, 0);
      rgroove.addColorStop(0, 'rgba(0,0,0,0)');
      rgroove.addColorStop(0.5, 'rgba(20,20,20,0.45)');
      rgroove.addColorStop(1, 'rgba(0,0,0,0)');
      rctx.fillStyle = rgroove;
      rctx.fillRect(laneCenter - 55, 0, 110, size);
    }

    // Crisp Alternating FIA Curbs (Red/White or Bugatti Blue/White or Tokyo Crimson/Dark)
    const curbA = isAutobahn ? '#0284c7' : isWet ? '#ec4899' : '#e11d48';
    const curbB = '#f8fafc';
    const stripes = 16;
    const stripeH = size / stripes;
    for (let s = 0; s < stripes; s++) {
      ctx.fillStyle = s % 2 === 0 ? curbA : curbB;
      ctx.fillRect(88, s * stripeH, 36, stripeH);
      ctx.fillRect(size - 124, s * stripeH, 36, stripeH);
      bctx.fillStyle = s % 2 === 0 ? '#b2b2b2' : '#969696';
      bctx.fillRect(88, s * stripeH, 36, stripeH);
      bctx.fillRect(size - 124, s * stripeH, 36, stripeH);
    }

    // Crisp outer solid white border lines
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(128, 0, 8, size);
    ctx.fillRect(size - 136, 0, 8, size);

    // Center & lane dashed markings
    ctx.fillStyle = mode === 'drift_touge' ? 'rgba(250, 204, 21, 0.85)' : 'rgba(248, 250, 252, 0.78)';
    for (const lx of [340, 512, 684]) {
      for (let y = 0; y < size; y += 128) {
        if (lx === 512 && mode === 'drift_touge') {
          ctx.fillRect(lx - 8, y + 12, 6, 84);
          ctx.fillRect(lx + 2, y + 12, 6, 84);
        } else {
          ctx.fillRect(lx - 4, y + 16, 8, 68);
        }
      }
    }
  }

  const map = new THREE.CanvasTexture(albedoCanvas);
  map.wrapS = THREE.RepeatWrapping;
  map.wrapT = THREE.RepeatWrapping;
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = maxAnisotropy;

  const roughnessMap = new THREE.CanvasTexture(roughCanvas);
  roughnessMap.wrapS = THREE.RepeatWrapping;
  roughnessMap.wrapT = THREE.RepeatWrapping;
  roughnessMap.anisotropy = maxAnisotropy;

  const bumpMap = new THREE.CanvasTexture(bumpCanvas);
  bumpMap.wrapS = THREE.RepeatWrapping;
  bumpMap.wrapT = THREE.RepeatWrapping;
  bumpMap.anisotropy = maxAnisotropy;

  return { map, roughnessMap, bumpMap };
}

function addDetailedWheelAssembly(
  parent: THREE.Group,
  opts: {
    x: number;
    y: number;
    z: number;
    radius: number;
    width: number;
    isFront: boolean;
    tireMat: THREE.Material;
    rimMat: THREE.Material;
    caliperMat: THREE.Material;
    accentMat: THREE.Material;
    isOffroad?: boolean;
    wheelRegister: THREE.Object3D[];
    frontSteerRegister?: THREE.Object3D[];
  }
): void {
  const steerPivot = new THREE.Group();
  steerPivot.position.set(opts.x, opts.y, opts.z);

  const spinPivot = new THREE.Group();

  // Tire carcass with rounded shoulder bevel look (main cylinder + inner sidewall bevel torus)
  const tireGeo = new THREE.CylinderGeometry(opts.radius, opts.radius, opts.width, 32);
  tireGeo.rotateZ(Math.PI / 2);
  const tireMesh = new THREE.Mesh(tireGeo, opts.tireMat);
  tireMesh.castShadow = true;
  spinPivot.add(tireMesh);

  // Sidewall Pirelli / Racing stripe ring
  const sideSign = opts.x >= 0 ? 1 : -1;
  const stripeRadius = opts.radius * 0.82;
  const stripeRing = new THREE.Mesh(
    new THREE.TorusGeometry(stripeRadius, 0.016, 8, 32),
    opts.accentMat
  );
  stripeRing.rotation.y = Math.PI / 2;
  stripeRing.position.x = sideSign * (opts.width * 0.5 + 0.004);
  spinPivot.add(stripeRing);

  // Deep alloy rim barrel
  const rimRadius = opts.radius * (opts.isOffroad ? 0.54 : 0.67);
  const rimBarrel = new THREE.Mesh(
    new THREE.CylinderGeometry(rimRadius, rimRadius, opts.width * 1.01, 24),
    opts.rimMat
  );
  rimBarrel.rotation.z = Math.PI / 2;
  spinPivot.add(rimBarrel);

  // 5-Spoke Y-pattern / multi-spoke hub
  for (let s = 0; s < 5; s++) {
    const angle = (s / 5) * Math.PI * 2;
    const spoke = new THREE.Mesh(
      new THREE.BoxGeometry(opts.width * 0.14, rimRadius * 1.84, 0.038),
      opts.rimMat
    );
    spoke.position.x = sideSign * (opts.width * 0.46);
    spoke.rotation.x = angle;
    spinPivot.add(spoke);
  }

  // Center lock lug nut
  const centerNut = new THREE.Mesh(
    new THREE.CylinderGeometry(0.06, 0.07, opts.width * 1.06, 12),
    opts.accentMat
  );
  centerNut.rotation.z = Math.PI / 2;
  spinPivot.add(centerNut);

  // Off-road knobby tire tread blocks for Dakar
  if (opts.isOffroad) {
    for (let t = 0; t < 14; t++) {
      const a = (t / 14) * Math.PI * 2;
      const tread = new THREE.Mesh(
        new THREE.BoxGeometry(opts.width * 0.94, 0.045, 0.09),
        opts.tireMat
      );
      tread.position.set(0, Math.sin(a) * opts.radius, Math.cos(a) * opts.radius);
      tread.rotation.x = -a;
      spinPivot.add(tread);
    }
  }

  // Ventilated Brake Rotor + Stationary Painted Brake Caliper (does NOT spin with spinPivot!)
  const rotorDisc = new THREE.Mesh(
    new THREE.CylinderGeometry(rimRadius * 0.84, rimRadius * 0.84, 0.04, 24),
    new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.92, roughness: 0.25 })
  );
  rotorDisc.rotation.z = Math.PI / 2;
  rotorDisc.position.x = sideSign * (opts.width * 0.12);
  steerPivot.add(rotorDisc);

  const caliper = new THREE.Mesh(
    new THREE.BoxGeometry(0.11, rimRadius * 0.56, rimRadius * 0.42),
    opts.caliperMat
  );
  caliper.position.set(sideSign * (opts.width * 0.14), rimRadius * 0.22, opts.isFront ? 0.14 : -0.14);
  steerPivot.add(caliper);

  steerPivot.add(spinPivot);
  parent.add(steerPivot);
  opts.wheelRegister.push(spinPivot);
  if (opts.isFront && opts.frontSteerRegister) {
    opts.frontSteerRegister.push(steerPivot);
  }
}

export function createDetailedRaceCarModel(opts: RaceCarBuildOptions): THREE.Group {
  const car = new THREE.Group();

  const bodyMat = new THREE.MeshPhysicalMaterial({
    color: opts.paintHex,
    metalness: 0.78,
    roughness: 0.16,
    clearcoat: 1.0,
    clearcoatRoughness: 0.06,
    reflectivity: 0.95,
    emissive: opts.paintHex,
    emissiveIntensity: opts.isHero ? 0.08 : 0.04,
  });

  const secondaryMat = new THREE.MeshPhysicalMaterial({
    color: 0x0f172a,
    metalness: 0.86,
    roughness: 0.22,
    clearcoat: 0.7,
    clearcoatRoughness: 0.15,
  });

  const carbonMat = new THREE.MeshStandardMaterial({
    color: 0x111827,
    metalness: 0.55,
    roughness: 0.36,
  });

  const tireMat = new THREE.MeshStandardMaterial({
    color: 0x121418,
    metalness: 0.08,
    roughness: 0.88,
  });

  const rimMat = new THREE.MeshStandardMaterial({
    color: opts.style === 'drift_touge' ? 0xd97706 : 0xe2e8f0,
    metalness: 0.94,
    roughness: 0.16,
  });

  const glassMat = new THREE.MeshPhysicalMaterial({
    color: 0x030712,
    metalness: 0.92,
    roughness: 0.04,
    clearcoat: 1.0,
    clearcoatRoughness: 0.02,
    transparent: true,
    opacity: 0.88,
  });

  const accentMat = new THREE.MeshBasicMaterial({ color: opts.accentHex });
  const tailLedMat = new THREE.MeshBasicMaterial({ color: 0xff1e42 });
  const headLedMat = new THREE.MeshBasicMaterial({ color: 0xf8fafc });
  const caliperMat = new THREE.MeshStandardMaterial({
    color: opts.accentHex,
    metalness: 0.6,
    roughness: 0.3,
    emissive: opts.accentHex,
    emissiveIntensity: 0.2,
  });

  // Grounded soft contact shadow plane beneath every car (crucial when 4K shadows are off)
  if (opts.shadowTex) {
    const shadowPlane = new THREE.Mesh(
      new THREE.PlaneGeometry(opts.style === 'dakar_rally' ? 3.5 : 3.2, 6.2),
      new THREE.MeshBasicMaterial({
        map: opts.shadowTex,
        transparent: true,
        opacity: 0.85,
        depthWrite: false,
      })
    );
    shadowPlane.rotation.x = -Math.PI / 2;
    shadowPlane.position.y = 0.02;
    car.add(shadowPlane);
  }

  const flames: THREE.Mesh[] = [];
  const exhaustMat = opts.plasmaMat || new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.85 });

  if (opts.style === 'formula_gp') {
    // === ULTRA-REALISTIC F1 MONOPOSTO RACING CAR ===
    // 1. Sleek Aerodynamic Monocoque Tub + Tapered Needle Nosecone
    const noseCurvePoints: THREE.Vector3[] = [];
    for (let i = 0; i <= 16; i++) {
      const t = i / 16;
      const z = -2.8 + t * 4.6;
      const w = Math.sin(t * Math.PI) * 0.58 + (1 - t) * 0.18 + 0.32;
      const h = (1 - t * 0.5) * 0.42;
      noseCurvePoints.push(new THREE.Vector3(0, h, z));
    }

    const chassisBody = new THREE.Mesh(
      new THREE.CylinderGeometry(0.35, 0.52, 4.4, 24, 16),
      bodyMat
    );
    chassisBody.rotation.x = Math.PI / 2;
    chassisBody.position.set(0, 0.44, 0.05);
    chassisBody.castShadow = true;
    car.add(chassisBody);

    // Sculpted Tapered Nose Cone
    const noseCone = new THREE.Mesh(
      new THREE.ConeGeometry(0.32, 1.9, 20),
      bodyMat
    );
    noseCone.rotation.x = -Math.PI / 2;
    noseCone.position.set(0, 0.38, -1.95);
    noseCone.castShadow = true;
    car.add(noseCone);

    // Aerodynamic Undercut Sidepods (Left & Right) with Carbon Inlets
    for (const sx of [-0.78, 0.78]) {
      const sidepod = new THREE.Mesh(
        new THREE.CylinderGeometry(0.34, 0.38, 2.6, 18),
        bodyMat
      );
      sidepod.rotation.x = Math.PI / 2;
      sidepod.position.set(sx, 0.42, 0.25);
      sidepod.castShadow = true;

      // Carbon Air Intake Scoop
      const intake = new THREE.Mesh(
        new THREE.BoxGeometry(0.36, 0.28, 0.16),
        carbonMat
      );
      intake.position.set(sx, 0.45, -0.95);

      car.add(sidepod, intake);
    }

    // Flat Carbon Floor Plank
    const floorPlank = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.05, 4.4), carbonMat);
    floorPlank.position.set(0, 0.16, 0.15);
    car.add(floorPlank);

    // Driver Helmet, Visor & Titanium Halo
    const helmet = new THREE.Mesh(
      new THREE.SphereGeometry(0.2, 20, 20),
      new THREE.MeshPhysicalMaterial({ color: opts.accentHex, metalness: 0.85, roughness: 0.1, clearcoat: 1 })
    );
    helmet.position.set(0, 0.82, -0.04);
    const visor = new THREE.Mesh(
      new THREE.CylinderGeometry(0.205, 0.205, 0.1, 20, 1, false, -1.0, 2.0),
      glassMat
    );
    visor.position.set(0, 0.84, -0.06);
    visor.rotation.y = Math.PI;
    car.add(helmet, visor);

    const haloArch = new THREE.Mesh(
      new THREE.TorusGeometry(0.34, 0.038, 12, 28, Math.PI),
      carbonMat
    );
    haloArch.rotation.x = Math.PI / 2 + 0.14;
    haloArch.position.set(0, 0.94, -0.18);
    const haloPillar = new THREE.Mesh(
      new THREE.CylinderGeometry(0.026, 0.032, 0.36, 12),
      carbonMat
    );
    haloPillar.position.set(0, 0.82, -0.52);
    haloPillar.rotation.x = 0.48;
    car.add(haloArch, haloPillar);

    // Multi-element Carbon Front Wing & Endplates
    const frontWingMain = new THREE.Mesh(new THREE.BoxGeometry(2.52, 0.05, 0.62), carbonMat);
    frontWingMain.position.set(0, 0.22, -2.75);
    const frontWingFlap = new THREE.Mesh(new THREE.BoxGeometry(2.46, 0.04, 0.28), bodyMat);
    frontWingFlap.position.set(0, 0.3, -2.58);
    frontWingFlap.rotation.x = 0.28;
    for (const sx of [-1.28, 1.28]) {
      const endPlate = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.34, 0.72), bodyMat);
      endPlate.position.set(sx, 0.32, -2.72);
      car.add(endPlate);
    }
    car.add(frontWingMain, frontWingFlap);

    // Swan-Neck Multi-Plane F1 Rear Wing + DRS Actuator + Rain Light
    const wingTop = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.06, 0.42), carbonMat);
    wingTop.position.set(0, 1.34, 2.38);
    wingTop.rotation.x = 0.15;
    const wingMain = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.055, 0.48), bodyMat);
    wingMain.position.set(0, 1.2, 2.32);
    for (const sx of [-1.1, 1.1]) {
      const end = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.62, 0.62), bodyMat);
      end.position.set(sx, 1.16, 2.35);
      car.add(end);
    }
    for (const sx of [-0.24, 0.24]) {
      const strut = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.65, 0.24), carbonMat);
      strut.position.set(sx, 0.92, 2.22);
      car.add(strut);
    }
    car.add(wingTop, wingMain);

    // Rear Diffuser Fins + FIA Rain Light + Titanium Exhaust & Plasma Flame
    for (let f = -3; f <= 3; f++) {
      const fin = new THREE.Mesh(new THREE.BoxGeometry(0.038, 0.26, 0.48), carbonMat);
      fin.position.set(f * 0.24, 0.24, 2.42);
      car.add(fin);
    }
    const rainLight = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.18, 0.07), tailLedMat);
    rainLight.position.set(0, 0.42, 2.62);
    const exhaust = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.13, 0.3, 18), secondaryMat);
    exhaust.rotation.x = Math.PI / 2;
    exhaust.position.set(0, 0.62, 2.55);
    const flame = new THREE.Mesh(new THREE.ConeGeometry(0.14, 1.35, 16), exhaustMat);
    flame.rotation.x = Math.PI / 2;
    flame.position.set(0, 0.62, 3.25);
    flames.push(flame);
    car.add(rainLight, exhaust, flame);

    // Exposed Suspension A-Arms
    const suspensionCoords: Array<[number, number, number, number]> = [
      [-0.72, 0.48, -1.75, 1.05],
      [0.72, 0.48, -1.75, 1.05],
      [-0.75, 0.52, 1.62, 1.12],
      [0.75, 0.52, 1.62, 1.12],
    ];
    for (const [ax, ay, az, len] of suspensionCoords) {
      const armA = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, len, 8), carbonMat);
      armA.rotation.z = Math.PI / 2;
      armA.rotation.y = ax < 0 ? 0.25 : -0.25;
      armA.position.set(ax, ay, az - 0.14);
      const armB = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, len, 8), carbonMat);
      armB.rotation.z = Math.PI / 2;
      armB.rotation.y = ax < 0 ? -0.25 : 0.25;
      armB.position.set(ax, ay - 0.09, az + 0.14);
      car.add(armA, armB);
    }

    // 4 Wide Slick Racing Wheels
    const wheelSpecs = [
      { x: -1.24, y: 0.48, z: -1.75, r: 0.46, w: 0.45, front: true },
      { x: 1.24, y: 0.48, z: -1.75, r: 0.46, w: 0.45, front: true },
      { x: -1.28, y: 0.52, z: 1.62, r: 0.5, w: 0.55, front: false },
      { x: 1.28, y: 0.52, z: 1.62, r: 0.5, w: 0.55, front: false },
    ];
    for (const ws of wheelSpecs) {
      addDetailedWheelAssembly(car, {
        x: ws.x,
        y: ws.y,
        z: ws.z,
        radius: ws.r,
        width: ws.w,
        isFront: ws.front,
        tireMat,
        rimMat,
        caliperMat,
        accentMat,
        wheelRegister: opts.wheelRegister,
        frontSteerRegister: opts.frontSteerRegister,
      });
    }
  } else if (opts.style === 'dakar_rally') {
    // === DAKAR TROPHY RAID TRUCK 4x4 ===
    // Lifted tubular off-road body with armored cab, spare wheel on rear roll-cage, roof LED lightbar
    const truckShape = new THREE.Shape();
    truckShape.moveTo(-2.35, 0.52);
    truckShape.lineTo(-2.35, 0.88);
    truckShape.quadraticCurveTo(-1.85, 1.12, -0.95, 1.16);
    truckShape.lineTo(-0.42, 1.72); // windshield
    truckShape.lineTo(0.75, 1.72); // cab roof
    truckShape.lineTo(1.25, 1.18); // rear rollbed slope
    truckShape.lineTo(2.38, 1.02);
    truckShape.lineTo(2.35, 0.62);
    truckShape.lineTo(-2.35, 0.52);

    const truckGeo = new THREE.ExtrudeGeometry(truckShape, {
      depth: 1.98,
      bevelEnabled: true,
      bevelThickness: 0.14,
      bevelSize: 0.1,
      bevelSegments: 4,
      curveSegments: 14,
    });
    truckGeo.rotateY(Math.PI / 2);
    truckGeo.translate(-0.99, 0, 0);
    const truckBody = new THREE.Mesh(truckGeo, bodyMat);
    truckBody.castShadow = true;
    car.add(truckBody);

    // Armored windshield & side windows
    const glass = new THREE.Mesh(new THREE.BoxGeometry(1.76, 0.54, 1.32), glassMat);
    glass.position.set(0, 1.4, 0.08);
    glass.rotation.x = -0.18;
    car.add(glass);

    // Front Steel Skid Plate & Bull-Bar
    const skidPlate = new THREE.Mesh(new THREE.BoxGeometry(1.65, 0.12, 0.85), rimMat);
    skidPlate.position.set(0, 0.45, -2.28);
    skidPlate.rotation.x = -0.42;
    const bullBar = new THREE.Mesh(new THREE.TorusGeometry(0.65, 0.055, 8, 18, Math.PI), carbonMat);
    bullBar.position.set(0, 0.72, -2.52);
    car.add(skidPlate, bullBar);

    // Flared Wide Baja Wheel Arches (4 boxy rugged fenders)
    for (const [fx, fz] of [
      [-1.08, -1.55],
      [1.08, -1.55],
      [-1.12, 1.52],
      [1.12, 1.52],
    ]) {
      const flare = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.26, 1.25), carbonMat);
      flare.position.set(fx, 1.05, fz);
      car.add(flare);
    }

    // Roof Baja 6-LED Lightbar
    const lightBarHousing = new THREE.Mesh(new THREE.BoxGeometry(1.58, 0.13, 0.18), carbonMat);
    lightBarHousing.position.set(0, 1.88, -0.28);
    const lightBarGlow = new THREE.Mesh(new THREE.BoxGeometry(1.46, 0.08, 0.08), headLedMat);
    lightBarGlow.position.set(0, 1.88, -0.35);
    car.add(lightBarHousing, lightBarGlow);

    // Rear Tubular Roll Cage & Mounted Tilted Spare Tire
    for (const sx of [-0.82, 0.82]) {
      const rollTube = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 1.55, 10), secondaryMat);
      rollTube.rotation.x = 0.88;
      rollTube.position.set(sx, 1.44, 1.48);
      car.add(rollTube);
    }
    const spareTire = new THREE.Mesh(new THREE.CylinderGeometry(0.58, 0.58, 0.42, 24), tireMat);
    spareTire.rotation.x = 0.55;
    spareTire.position.set(0, 1.32, 1.68);
    const spareRim = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.44, 16), rimMat);
    spareRim.rotation.x = 0.55;
    spareRim.position.set(0, 1.32, 1.68);
    car.add(spareTire, spareRim);

    // Tail Lamps + Dual Rally Exhausts
    for (const sx of [-0.85, 0.85]) {
      const tail = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.18, 0.08), tailLedMat);
      tail.position.set(sx, 0.92, 2.46);
      const mudflap = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.36, 0.04), carbonMat);
      mudflap.position.set(sx * 1.15, 0.36, 2.28);
      mudflap.rotation.x = 0.15;
      car.add(tail, mudflap);
    }
    for (const sx of [-0.52, 0.52]) {
      const ex = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.12, 0.32, 12), rimMat);
      ex.rotation.x = Math.PI / 2;
      ex.position.set(sx, 0.58, 2.48);
      const fl = new THREE.Mesh(new THREE.ConeGeometry(0.13, 1.05, 12), exhaustMat);
      fl.rotation.x = Math.PI / 2;
      fl.position.set(sx, 0.58, 3.04);
      flames.push(fl);
      car.add(ex, fl);
    }

    // 4 Chunky Knobby Off-Road Wheels + Visible Coilover Struts
    for (const [wx, wz, front] of [
      [-1.18, -1.55, true],
      [1.18, -1.55, true],
      [-1.2, 1.52, false],
      [1.2, 1.52, false],
    ] as Array<[number, number, boolean]>) {
      addDetailedWheelAssembly(car, {
        x: wx,
        y: 0.62,
        z: wz,
        radius: 0.62,
        width: 0.48,
        isFront: front,
        tireMat,
        rimMat,
        caliperMat,
        accentMat,
        isOffroad: true,
        wheelRegister: opts.wheelRegister,
        frontSteerRegister: opts.frontSteerRegister,
      });
    }
  } else if (opts.style === 'maglev_track' || opts.style === 'corridor') {
    // === F-ZERO MAGLEV / CYBER AG-RACER ===
    // Catamaran forward prongs + sculpted jet fuselage + plasma repulsor pads + triple thruster cones
    const mainHull = new THREE.Mesh(new THREE.ConeGeometry(0.75, 4.6, 8), bodyMat);
    mainHull.rotation.x = -Math.PI / 2;
    mainHull.scale.set(1.25, 1.0, 0.52);
    mainHull.position.set(0, 0.44, 0.1);
    mainHull.castShadow = true;
    car.add(mainHull);

    // Twin Catamaran Forward Prongs
    for (const sx of [-0.72, 0.72]) {
      const prong = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.24, 3.4), secondaryMat);
      prong.position.set(sx, 0.34, -0.85);
      prong.rotation.y = sx > 0 ? 0.08 : -0.08;
      const tipLed = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.08, 1.6), accentMat);
      tipLed.position.set(sx, 0.44, -1.35);
      car.add(prong, tipLed);
    }

    // Swept Delta Side Wings & Twin Canted Stabilizer Fins
    for (const sx of [-1, 1]) {
      const wing = new THREE.Mesh(new THREE.BoxGeometry(1.35, 0.08, 1.55), bodyMat);
      wing.position.set(sx * 1.15, 0.36, 0.95);
      wing.rotation.y = sx * -0.35;
      wing.rotation.z = sx * -0.14;
      const fin = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.85, 0.95), bodyMat);
      fin.position.set(sx * 1.25, 0.82, 1.65);
      fin.rotation.z = sx * -0.32;
      fin.rotation.x = 0.25;
      car.add(wing, fin);
    }

    // Fighter Bubble Canopy
    const canopy = new THREE.Mesh(new THREE.SphereGeometry(0.56, 20, 14), glassMat);
    canopy.scale.set(0.85, 0.65, 2.25);
    canopy.position.set(0, 0.68, -0.22);
    car.add(canopy);

    // Glowing Anti-Gravity Magnetic Repulsor Hover Discs Underneath
    const hoverMat = new THREE.MeshBasicMaterial({
      color: opts.accentHex,
      transparent: true,
      opacity: 0.78,
      side: THREE.DoubleSide,
    });
    for (const [hx, hz] of [
      [-0.68, -1.3],
      [0.68, -1.3],
      [0, 1.45],
    ]) {
      const pad = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.55, 0.06, 18), hoverMat);
      pad.position.set(hx, 0.14, hz);
      car.add(pad);
    }

    // Triple Plasma Thrusters & Rear Tail Glow
    for (const tx of [-0.54, 0, 0.54]) {
      const nozzle = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.24, 0.42, 16), carbonMat);
      nozzle.rotation.x = Math.PI / 2;
      nozzle.position.set(tx, 0.44, 2.38);
      const flame = new THREE.Mesh(new THREE.ConeGeometry(0.2, 1.65, 16), exhaustMat);
      flame.rotation.x = Math.PI / 2;
      flame.position.set(tx, 0.44, 3.22);
      flames.push(flame);
      car.add(nozzle, flame);
    }
  } else {
    // === BUGATTI HYPERCAR 450+ & TOKYO DRIFT JDM WIDEBODY SUPERCAR ===
    const isBugatti = opts.style === 'bugatti_hypercar';
    const bodyWidth = isBugatti ? 1.56 : 1.48;

    // 1. Sculpted Main Fastback Fuselage with Sweeping Hood & Haunches
    const coupeShape = new THREE.Shape();
    coupeShape.moveTo(-2.52, 0.15);
    coupeShape.lineTo(-2.55, 0.36);
    coupeShape.quadraticCurveTo(-2.15, 0.68, -1.05, 0.78); // low aerodynamic hood
    coupeShape.quadraticCurveTo(-0.42, 1.24, 0.32, 1.24); // teardrop roofline
    coupeShape.quadraticCurveTo(1.28, 1.18, 2.28, 0.88); // muscular fastback deck
    coupeShape.lineTo(2.54, 0.74);
    coupeShape.lineTo(2.58, 0.24);
    coupeShape.lineTo(1.9, 0.16);
    coupeShape.lineTo(-2.52, 0.15);

    const chassisGeo = new THREE.ExtrudeGeometry(coupeShape, {
      depth: bodyWidth,
      bevelEnabled: true,
      bevelThickness: 0.22,
      bevelSize: 0.15,
      bevelSegments: 5,
      curveSegments: 18,
    });
    chassisGeo.rotateY(Math.PI / 2);
    chassisGeo.translate(-bodyWidth / 2, 0, 0);
    const chassisMesh = new THREE.Mesh(chassisGeo, bodyMat);
    chassisMesh.castShadow = true;
    car.add(chassisMesh);

    // 2. Sculpted Muscular Wheel Arch Fenders (Widebody Haunches wrapping all 4 wheels!)
    const fenderCoords: Array<[number, number, number, number]> = [
      [-0.96, 0.48, -1.55, 0.56],
      [0.96, 0.48, -1.55, 0.56],
      [-1.02, 0.52, 1.48, 0.62],
      [1.02, 0.52, 1.48, 0.62],
    ];
    for (const [fx, fy, fz, rad] of fenderCoords) {
      const arch = new THREE.Mesh(
        new THREE.CylinderGeometry(rad, rad * 1.06, 0.48, 24, 1, false, -Math.PI * 0.45, Math.PI * 0.9),
        isBugatti ? secondaryMat : bodyMat
      );
      arch.rotation.z = Math.PI / 2;
      arch.position.set(fx, fy, fz);
      arch.castShadow = true;
      car.add(arch);
    }

    // 3. Recessed Teardrop Glass Canopy + Visible Roll Cage / W16 Engine Deck
    const glassShape = new THREE.Shape();
    glassShape.moveTo(-1.02, 0.78);
    glassShape.quadraticCurveTo(-0.32, 1.26, 0.42, 1.24);
    glassShape.quadraticCurveTo(1.22, 1.14, 1.72, 0.86);
    glassShape.lineTo(-1.02, 0.78);
    const canopyGeo = new THREE.ExtrudeGeometry(glassShape, {
      depth: 1.26,
      bevelEnabled: true,
      bevelThickness: 0.08,
      bevelSize: 0.08,
      bevelSegments: 4,
      curveSegments: 16,
    });
    canopyGeo.rotateY(Math.PI / 2);
    canopyGeo.translate(-0.63, 0.02, 0);
    const canopy = new THREE.Mesh(canopyGeo, glassMat);
    car.add(canopy);

    if (isBugatti) {
      // Signature Bugatti Center Dorsal Spine + Twin Sweeping C-Line Side Intake Loops!
      const spine = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.14, 2.2), rimMat);
      spine.position.set(0, 1.18, 1.05);
      car.add(spine);

      for (const sx of [-1, 1]) {
        const cCurve = new THREE.Mesh(
          new THREE.TorusGeometry(0.46, 0.055, 10, 24, Math.PI * 1.15),
          rimMat
        );
        cCurve.rotation.y = Math.PI / 2;
        cCurve.rotation.z = sx > 0 ? Math.PI * 0.42 : Math.PI * 0.42;
        cCurve.position.set(sx * 0.96, 0.66, 0.22);
        car.add(cCurve);
      }

      // Exposed W16 Engine Valve Covers under glass deck
      const engineBay = new THREE.Mesh(new THREE.BoxGeometry(0.76, 0.14, 0.95), accentMat);
      engineBay.position.set(0, 0.92, 1.48);
      car.add(engineBay);
    } else {
      // Tokyo Drift Carbon Hood Scoop, Side Mirrors & Underglow
      const hoodScoop = new THREE.Mesh(new THREE.BoxGeometry(0.84, 0.09, 0.9), carbonMat);
      hoodScoop.position.set(0, 0.77, -1.52);
      const underglow = new THREE.Mesh(
        new THREE.PlaneGeometry(2.15, 4.35),
        new THREE.MeshBasicMaterial({ color: opts.accentHex, transparent: true, opacity: 0.38, side: THREE.DoubleSide })
      );
      underglow.rotation.x = Math.PI / 2;
      underglow.position.set(0, 0.04, 0);
      car.add(hoodScoop, underglow);
    }

    // Carbon Side Mirrors
    for (const sx of [-0.94, 0.94]) {
      const mirror = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.1, 0.15), carbonMat);
      mirror.position.set(sx, 0.88, -0.58);
      car.add(mirror);
    }

    // 4. Aggressive Carbon Front Splitter + Side Skirts + Rear 6-Fin Aero Diffuser
    const frontSplitter = new THREE.Mesh(new THREE.BoxGeometry(2.38, 0.07, 0.62), carbonMat);
    frontSplitter.position.set(0, 0.15, -2.56);
    car.add(frontSplitter);
    for (const sx of [-1.06, 1.06]) {
      const skirt = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.13, 2.55), carbonMat);
      skirt.position.set(sx, 0.18, -0.02);
      car.add(skirt);
    }
    const diffuserBase = new THREE.Mesh(new THREE.BoxGeometry(1.92, 0.16, 0.48), carbonMat);
    diffuserBase.position.set(0, 0.22, 2.48);
    car.add(diffuserBase);
    for (let f = -3; f <= 3; f++) {
      const fin = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.24, 0.42), carbonMat);
      fin.position.set(f * 0.24, 0.24, 2.58);
      car.add(fin);
    }

    // 5. Curved Swan-Neck Active Aero Rear Wing
    const wingBlade = new THREE.Mesh(
      new THREE.BoxGeometry(isBugatti ? 2.28 : 2.48, 0.075, 0.52),
      isBugatti ? bodyMat : carbonMat
    );
    wingBlade.position.set(0, isBugatti ? 1.24 : 1.38, 2.38);
    wingBlade.rotation.x = 0.15;
    car.add(wingBlade);
    for (const sx of [-1, 1]) {
      const endplate = new THREE.Mesh(
        new THREE.BoxGeometry(0.055, 0.38, 0.6),
        isBugatti ? secondaryMat : bodyMat
      );
      endplate.position.set(sx * (isBugatti ? 1.15 : 1.25), isBugatti ? 1.18 : 1.32, 2.38);
      const pylon = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.56, 0.24), carbonMat);
      pylon.position.set(sx * 0.48, isBugatti ? 0.98 : 1.06, 2.24);
      pylon.rotation.x = -0.22;
      car.add(endplate, pylon);
    }

    // 6. Signature Sculpted LED Tail Lamps & Quad Titanium Exhausts + Afterburners
    if (isBugatti) {
      // Iconic Full-Width Floating Chiron Crimson Blade + Recess
      const tailRecess = new THREE.Mesh(new THREE.BoxGeometry(1.98, 0.24, 0.12), carbonMat);
      tailRecess.position.set(0, 0.72, 2.61);
      const tailBlade = new THREE.Mesh(new THREE.BoxGeometry(1.88, 0.07, 0.08), tailLedMat);
      tailBlade.position.set(0, 0.72, 2.66);
      car.add(tailRecess, tailBlade);
    } else {
      // Iconic JDM 4-Ring Crimson LED Taillights
      for (const [lx, r] of [
        [-0.84, 0.12],
        [-0.54, 0.1],
        [0.54, 0.1],
        [0.84, 0.12],
      ]) {
        const ring = new THREE.Mesh(new THREE.TorusGeometry(r, 0.028, 10, 20), tailLedMat);
        ring.position.set(lx, 0.72, 2.64);
        car.add(ring);
      }
    }

    // Headlight DRL blades
    for (const sx of [-0.76, 0.76]) {
      const head = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.07, 0.08), headLedMat);
      head.position.set(sx, 0.48, -2.56);
      car.add(head);
    }

    // Quad / Twin Titanium Exhausts
    const exhaustXs = isBugatti ? [-0.36, -0.14, 0.14, 0.36] : [-0.66, 0.66];
    for (const exX of exhaustXs) {
      const tip = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.095, 0.26, 14), rimMat);
      tip.rotation.x = Math.PI / 2;
      tip.position.set(exX, 0.34, 2.66);
      car.add(tip);
    }
    for (const fx of [-0.46, 0.46]) {
      const flame = new THREE.Mesh(new THREE.ConeGeometry(0.14, 1.25, 14), exhaustMat);
      flame.rotation.x = Math.PI / 2;
      flame.position.set(fx, 0.34, 3.28);
      flames.push(flame);
      car.add(flame);
    }

    // 7. 4 Wide Sculpted Alloy Wheels with Non-Spinning Brake Calipers & Steering Front Pivots
    for (const [wx, wy, wz, rad, w, front] of [
      [-1.08, 0.45, -1.55, 0.45, 0.38, true],
      [1.08, 0.45, -1.55, 0.45, 0.38, true],
      [-1.13, 0.49, 1.48, 0.49, 0.46, false],
      [1.13, 0.49, 1.48, 0.49, 0.46, false],
    ] as Array<[number, number, number, number, number, boolean]>) {
      addDetailedWheelAssembly(car, {
        x: wx,
        y: wy,
        z: wz,
        radius: rad,
        width: w,
        isFront: front,
        tireMat,
        rimMat,
        caliperMat,
        accentMat,
        wheelRegister: opts.wheelRegister,
        frontSteerRegister: opts.frontSteerRegister,
      });
    }
  }

  // Forward Volumetric Headlight Beams on Track Ahead for Hero Car
  if (opts.isHero) {
    const beamMat = new THREE.MeshBasicMaterial({
      color: 0xe0f2fe,
      transparent: true,
      opacity: 0.09,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    for (const bx of [-0.72, 0.72]) {
      const beam = new THREE.Mesh(new THREE.ConeGeometry(2.1, 16, 16, 1, true), beamMat);
      beam.rotation.x = -Math.PI / 2 + 0.04;
      beam.position.set(bx, 0.36, -10.5);
      car.add(beam);
    }
  }

  car.userData.flames = flames;
  return car;
}

function createAircraftSkinTextures(): {
  map: THREE.CanvasTexture;
  bumpMap: THREE.CanvasTexture;
  roughnessMap: THREE.CanvasTexture;
} {
  const size = 512;
  const albedoC = document.createElement('canvas');
  albedoC.width = size;
  albedoC.height = size;
  const actx = albedoC.getContext('2d')!;

  const bumpC = document.createElement('canvas');
  bumpC.width = size;
  bumpC.height = size;
  const bctx = bumpC.getContext('2d')!;

  const roughC = document.createElement('canvas');
  roughC.width = size;
  roughC.height = size;
  const rctx = roughC.getContext('2d')!;

  actx.fillStyle = '#f2f4f7';
  actx.fillRect(0, 0, size, size);
  bctx.fillStyle = '#888888';
  bctx.fillRect(0, 0, size, size);
  rctx.fillStyle = '#484848';
  rctx.fillRect(0, 0, size, size);

  // Subtle tonal panel variation + titanium seams & flush rivets
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const h = deterministicHash(r * 19 + c * 7);
      const aTone = 228 + Math.floor(h * 22);
      actx.fillStyle = `rgb(${aTone},${aTone + 1},${Math.min(255, aTone + 3)})`;
      actx.fillRect(c * 64 + 2, r * 64 + 2, 60, 60);

      const shade = 52 + Math.floor(h * 34);
      rctx.fillStyle = `rgb(${shade},${shade},${shade})`;
      rctx.fillRect(c * 64 + 3, r * 64 + 3, 58, 58);

      // Corner rivets on each access hatch
      actx.fillStyle = 'rgba(71, 85, 105, 0.42)';
      for (const rx of [c * 64 + 8, c * 64 + 56]) {
        for (const ry of [r * 64 + 8, r * 64 + 56]) {
          actx.fillRect(rx, ry, 2, 2);
        }
      }
    }
  }

  actx.strokeStyle = 'rgba(51, 65, 85, 0.48)';
  actx.lineWidth = 1.5;
  bctx.strokeStyle = '#383838';
  bctx.lineWidth = 2;
  rctx.strokeStyle = '#707070';
  rctx.lineWidth = 2;
  for (let i = 0; i <= size; i += 64) {
    actx.beginPath();
    actx.moveTo(i, 0);
    actx.lineTo(i, size);
    actx.moveTo(0, i);
    actx.lineTo(size, i);
    actx.stroke();

    bctx.beginPath();
    bctx.moveTo(i, 0);
    bctx.lineTo(i, size);
    bctx.moveTo(0, i);
    bctx.lineTo(size, i);
    bctx.stroke();

    rctx.beginPath();
    rctx.moveTo(i, 0);
    rctx.lineTo(i, size);
    rctx.moveTo(0, i);
    rctx.lineTo(size, i);
    rctx.stroke();
  }

  const map = new THREE.CanvasTexture(albedoC);
  map.wrapS = THREE.RepeatWrapping;
  map.wrapT = THREE.RepeatWrapping;
  map.repeat.set(4, 4);
  map.colorSpace = THREE.SRGBColorSpace;

  const bumpMap = new THREE.CanvasTexture(bumpC);
  bumpMap.wrapS = THREE.RepeatWrapping;
  bumpMap.wrapT = THREE.RepeatWrapping;
  bumpMap.repeat.set(4, 4);

  const roughnessMap = new THREE.CanvasTexture(roughC);
  roughnessMap.wrapS = THREE.RepeatWrapping;
  roughnessMap.wrapT = THREE.RepeatWrapping;
  roughnessMap.repeat.set(4, 4);

  return { map, bumpMap, roughnessMap };
}

function addMachShockDiamondAfterburner(
  parent: THREE.Group,
  x: number,
  y: number,
  z: number,
  radius: number,
  length: number,
  exhaustMat: THREE.Material,
  coreColorHex: number,
  flamesOut: THREE.Mesh[]
): void {
  const outerPlume = new THREE.Mesh(
    new THREE.ConeGeometry(radius, length, 24, 1, true),
    new THREE.MeshBasicMaterial({
      color: coreColorHex,
      transparent: true,
      opacity: 0.42,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    })
  );
  outerPlume.rotation.x = Math.PI / 2;
  outerPlume.position.set(x, y, z + length * 0.5);
  flamesOut.push(outerPlume);
  parent.add(outerPlume);

  const innerCore = new THREE.Mesh(new THREE.ConeGeometry(radius * 0.58, length * 0.8, 18), exhaustMat);
  innerCore.rotation.x = Math.PI / 2;
  innerCore.position.set(x, y, z + length * 0.36);
  flamesOut.push(innerCore);
  parent.add(innerCore);

  // Supersonic Mach shock diamond nodes along exhaust stream
  const diamondMat = new THREE.MeshBasicMaterial({
    color: 0xe0f2fe,
    transparent: true,
    opacity: 0.88,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  for (let d = 0; d < 4; d++) {
    const sc = 1 - d * 0.18;
    const diamond = new THREE.Mesh(new THREE.OctahedronGeometry(radius * 0.42 * sc, 0), diamondMat);
    diamond.scale.set(0.85, 0.85, 1.9);
    diamond.position.set(x, y, z + 0.45 + d * (length * 0.21));
    parent.add(diamond);
  }
}

export function createDetailedAircraftModel(opts: AircraftBuildOptions): THREE.Group {
  const craft = new THREE.Group();
  const flames: THREE.Mesh[] = [];
  const exhaustMat =
    opts.plasmaMat ||
    new THREE.MeshBasicMaterial({
      color: opts.accentHex,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
    });
  const skinTex = createAircraftSkinTextures();

  const glassMat = new THREE.MeshPhysicalMaterial({
    color: opts.style === 'f22_jet' ? 0xf59e0b : 0x0f172a,
    metalness: 0.92,
    roughness: 0.04,
    clearcoat: 1.0,
    clearcoatRoughness: 0.02,
    reflectivity: 1.0,
    transparent: true,
    opacity: 0.86,
    emissive: opts.style === 'f22_jet' ? 0x78350f : 0x0c4a6e,
    emissiveIntensity: 0.3,
  });

  if (opts.style === 'f22_jet') {
    const stealthMat = new THREE.MeshPhysicalMaterial({
      color: 0x475569,
      metalness: 0.78,
      roughness: 0.26,
      clearcoat: 0.55,
      bumpMap: skinTex.bumpMap,
      bumpScale: 0.015,
      roughnessMap: skinTex.roughnessMap,
    });
    const darkRamMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      metalness: 0.86,
      roughness: 0.24,
      bumpMap: skinTex.bumpMap,
      bumpScale: 0.012,
    });

    // Blended sculpted chine fuselage profile (smooth curved Lathe + swept wing-body)
    const fuseProfile = [
      new THREE.Vector2(0.0, 4.0),
      new THREE.Vector2(0.24, 3.0),
      new THREE.Vector2(0.55, 1.5),
      new THREE.Vector2(0.78, 0.0),
      new THREE.Vector2(0.84, -1.6),
      new THREE.Vector2(0.72, -3.2),
      new THREE.Vector2(0.42, -3.6),
    ];
    const fuseGeo = new THREE.LatheGeometry(fuseProfile, 20);
    fuseGeo.rotateX(Math.PI / 2);
    fuseGeo.scale(1.45, 0.52, 1.0);
    const fuse = new THREE.Mesh(fuseGeo, stealthMat);
    fuse.castShadow = true;
    craft.add(fuse);

    // Sculpted Diamond Stealth Wing + Leading-Edge Chines
    const wingShape = new THREE.Shape();
    wingShape.moveTo(0, -3.6);
    wingShape.lineTo(0.85, -1.2);
    wingShape.lineTo(3.85, 1.35);
    wingShape.lineTo(3.85, 2.25);
    wingShape.lineTo(0.95, 2.65);
    wingShape.lineTo(-0.95, 2.65);
    wingShape.lineTo(-3.85, 2.25);
    wingShape.lineTo(-3.85, 1.35);
    wingShape.lineTo(-0.85, -1.2);
    wingShape.closePath();
    const wingGeo = new THREE.ExtrudeGeometry(wingShape, {
      depth: 0.09,
      bevelEnabled: true,
      bevelThickness: 0.05,
      bevelSize: 0.08,
      bevelSegments: 3,
    });
    wingGeo.rotateX(Math.PI / 2);
    const mainWing = new THREE.Mesh(wingGeo, stealthMat);
    mainWing.position.y = 0.04;
    mainWing.castShadow = true;
    craft.add(mainWing);

    // Caret Stealth Air Intakes & Twin Outward-Canted V-Tails + Horizontal Stabilators
    for (const sx of [-1, 1]) {
      const intake = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.42, 2.4), darkRamMat);
      intake.position.set(sx * 0.72, -0.02, -0.35);
      intake.rotation.y = sx * 0.1;

      const vTailShape = new THREE.Shape();
      vTailShape.moveTo(0, 0);
      vTailShape.lineTo(1.55, 0);
      vTailShape.lineTo(2.05, 1.38);
      vTailShape.lineTo(1.32, 1.42);
      vTailShape.closePath();
      const vTailGeo = new THREE.ExtrudeGeometry(vTailShape, {
        depth: 0.06,
        bevelEnabled: true,
        bevelThickness: 0.02,
        bevelSize: 0.02,
      });
      vTailGeo.rotateY(-Math.PI / 2);
      const vTail = new THREE.Mesh(vTailGeo, stealthMat);
      vTail.position.set(sx * 0.85, 0.08, 1.8);
      vTail.rotation.z = sx * -0.46;

      const hStabShape = new THREE.Shape();
      hStabShape.moveTo(0, 0);
      hStabShape.lineTo(1.55, 0.85);
      hStabShape.lineTo(1.55, 1.42);
      hStabShape.lineTo(0, 1.25);
      hStabShape.closePath();
      const hStabGeo = new THREE.ExtrudeGeometry(hStabShape, { depth: 0.05, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02 });
      hStabGeo.rotateX(Math.PI / 2);
      if (sx < 0) hStabGeo.scale(-1, 1, 1);
      const hStab = new THREE.Mesh(hStabGeo, darkRamMat);
      hStab.position.set(sx * 0.72, 0.02, 2.35);

      // Wingtip nav strobes (Red port / Green starboard)
      const navLight = new THREE.Mesh(
        new THREE.SphereGeometry(0.08, 10, 10),
        new THREE.MeshBasicMaterial({ color: sx < 0 ? 0xef4444 : 0x22c55e })
      );
      navLight.position.set(sx * 3.88, 0.06, 1.85);
      craft.add(intake, vTail, hStab, navLight);
    }

    // Gold Stealth Teardrop Bubble Canopy + Glowing HUD Frame
    const canopy = new THREE.Mesh(new THREE.SphereGeometry(0.46, 24, 16), glassMat);
    canopy.scale.set(0.76, 0.68, 2.55);
    canopy.position.set(0, 0.36, -1.42);
    const hudGlow = new THREE.Mesh(
      new THREE.BoxGeometry(0.24, 0.14, 0.04),
      new THREE.MeshBasicMaterial({ color: 0x34d399 })
    );
    hudGlow.position.set(0, 0.38, -2.05);
    craft.add(canopy, hudGlow);

    // Twin 2D Thrust-Vectoring Nozzles + Shock-Diamond Mach Afterburners
    for (const nx of [-0.46, 0.46]) {
      const nozzle = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.32, 0.72), darkRamMat);
      nozzle.position.set(nx, 0.02, 3.35);
      craft.add(nozzle);
      addMachShockDiamondAfterburner(craft, nx, 0.02, 3.65, 0.24, 2.9, exhaustMat, 0x38bdf8, flames);
    }
  } else if (opts.style === 'sr71_plane') {
    // === LOCKHEED SR-71 BLACKBIRD — SCULPTED MACH 3.3 TITANIUM CHINED DELTA ===
    const blackbirdMat = new THREE.MeshPhysicalMaterial({
      color: 0x161f2e,
      metalness: 0.84,
      roughness: 0.24,
      clearcoat: 0.72,
      clearcoatRoughness: 0.14,
      bumpMap: skinTex.bumpMap,
      bumpScale: 0.018,
      roughnessMap: skinTex.roughnessMap,
    });
    const titaniumMat = new THREE.MeshPhysicalMaterial({
      color: 0x475569,
      metalness: 0.94,
      roughness: 0.18,
      clearcoat: 0.5,
      bumpMap: skinTex.bumpMap,
      bumpScale: 0.012,
    });

    // 1. Sleek Lathe-sculpted long nose-to-tail titanium fuselage (NO flat cylinder/box seams!)
    const fuseProfile = [
      new THREE.Vector2(0.0, 5.4),
      new THREE.Vector2(0.14, 4.4),
      new THREE.Vector2(0.32, 3.1),
      new THREE.Vector2(0.52, 1.5),
      new THREE.Vector2(0.58, 0.0),
      new THREE.Vector2(0.56, -2.2),
      new THREE.Vector2(0.46, -4.1),
      new THREE.Vector2(0.24, -4.75),
      new THREE.Vector2(0.06, -5.05),
    ];
    const fuseGeo = new THREE.LatheGeometry(fuseProfile, 24);
    fuseGeo.rotateX(Math.PI / 2);
    fuseGeo.scale(1.18, 0.68, 1.0);
    const fuseMesh = new THREE.Mesh(fuseGeo, blackbirdMat);
    fuseMesh.castShadow = true;
    craft.add(fuseMesh);

    // 2. Iconic Seamless Blended Forebody Chines + Double-Delta Wing Planform (Beveled Extrude!)
    const sr71Planform = new THREE.Shape();
    sr71Planform.moveTo(0, -4.95);
    sr71Planform.quadraticCurveTo(0.86, -2.9, 0.96, -0.8);
    sr71Planform.lineTo(1.25, 0.6);
    sr71Planform.lineTo(4.05, 3.45);
    sr71Planform.lineTo(4.05, 4.25);
    sr71Planform.lineTo(1.65, 4.42);
    sr71Planform.lineTo(0.62, 4.18);
    sr71Planform.lineTo(0, 4.55);
    sr71Planform.lineTo(-0.62, 4.18);
    sr71Planform.lineTo(-1.65, 4.42);
    sr71Planform.lineTo(-4.05, 4.25);
    sr71Planform.lineTo(-4.05, 3.45);
    sr71Planform.lineTo(-1.25, 0.6);
    sr71Planform.lineTo(-0.96, -0.8);
    sr71Planform.quadraticCurveTo(-0.86, -2.9, 0, -4.95);

    const wingGeo = new THREE.ExtrudeGeometry(sr71Planform, {
      depth: 0.08,
      bevelEnabled: true,
      bevelThickness: 0.055,
      bevelSize: 0.09,
      bevelSegments: 4,
      curveSegments: 18,
    });
    wingGeo.rotateX(Math.PI / 2);
    const mainWing = new THREE.Mesh(wingGeo, blackbirdMat);
    mainWing.position.y = 0.04;
    mainWing.castShadow = true;
    craft.add(mainWing);

    // 3. Curved Dual-Cockpit Canopy (Zero square boxes — aerodynamic curved teardrop glass + frame)
    const canopyOuter = new THREE.Mesh(new THREE.SphereGeometry(0.44, 24, 16), glassMat);
    canopyOuter.scale.set(0.72, 0.62, 2.75);
    canopyOuter.position.set(0, 0.28, -2.15);
    const canopySpine = new THREE.Mesh(new THREE.CapsuleGeometry(0.14, 1.55, 6, 12), blackbirdMat);
    canopySpine.rotation.x = Math.PI / 2;
    canopySpine.position.set(0, 0.34, -1.65);
    craft.add(canopyOuter, canopySpine);

    // Iconic red Air Force fuselage maintenance trim band & titanium dorsal spine
    const redTrim = new THREE.Mesh(
      new THREE.BoxGeometry(0.06, 0.04, 4.8),
      new THREE.MeshBasicMaterial({ color: 0xef4444 })
    );
    redTrim.position.set(0, 0.36, 0.6);
    craft.add(redTrim);

    // 4. Twin Mid-Wing J58 Turboramjet Nacelles, Titanium Inlet Shock Cones, Inward-Canted Swept Fins & Afterburners
    for (const sx of [-1, 1]) {
      const nacelleProfile = [
        new THREE.Vector2(0.38, 2.65),
        new THREE.Vector2(0.49, 1.8),
        new THREE.Vector2(0.51, 0.0),
        new THREE.Vector2(0.47, -2.15),
        new THREE.Vector2(0.39, -2.65),
      ];
      const nacGeo = new THREE.LatheGeometry(nacelleProfile, 24);
      nacGeo.rotateX(Math.PI / 2);
      const nacelle = new THREE.Mesh(nacGeo, blackbirdMat);
      nacelle.position.set(sx * 1.72, 0.04, 2.25);
      nacelle.castShadow = true;

      // Titanium movable inlet shock-cone spike + glowing intake throat ring
      const spike = new THREE.Mesh(new THREE.ConeGeometry(0.28, 1.45, 20), titaniumMat);
      spike.rotation.x = -Math.PI / 2;
      spike.position.set(sx * 1.72, 0.04, -0.68);
      const inletLip = new THREE.Mesh(new THREE.TorusGeometry(0.38, 0.055, 10, 24), titaniumMat);
      inletLip.position.set(sx * 1.72, 0.04, -0.35);

      // Swept Trapezoidal Inward-Canted Vertical Rudders
      const finShape = new THREE.Shape();
      finShape.moveTo(0, 0);
      finShape.lineTo(1.75, 0);
      finShape.lineTo(1.95, 1.42);
      finShape.lineTo(1.15, 1.46);
      finShape.closePath();
      const finGeo = new THREE.ExtrudeGeometry(finShape, {
        depth: 0.055,
        bevelEnabled: true,
        bevelThickness: 0.02,
        bevelSize: 0.02,
      });
      finGeo.rotateY(-Math.PI / 2);
      const rudder = new THREE.Mesh(finGeo, blackbirdMat);
      rudder.position.set(sx * 1.72, 0.25, 2.25);
      rudder.rotation.z = sx * 0.26; // Iconic SR-71 inward cant

      // Mach 3.3 Turquoise-Orange Shock-Diamond Afterburner Plumes
      addMachShockDiamondAfterburner(craft, sx * 1.72, 0.04, 4.78, 0.34, 4.1, exhaustMat, 0x38bdf8, flames);

      // Wingtip beacon light + glowing Mach vapor ribbon
      const tipBeacon = new THREE.Mesh(
        new THREE.SphereGeometry(0.08, 10, 10),
        new THREE.MeshBasicMaterial({ color: sx < 0 ? 0xef4444 : 0x22d3ee })
      );
      tipBeacon.position.set(sx * 4.08, 0.06, 3.85);
      const vaporRibbon = new THREE.Mesh(
        new THREE.PlaneGeometry(0.14, 7.5),
        new THREE.MeshBasicMaterial({
          color: 0xbae6fd,
          transparent: true,
          opacity: 0.28,
          blending: THREE.AdditiveBlending,
          side: THREE.DoubleSide,
          depthWrite: false,
        })
      );
      vaporRibbon.rotation.x = Math.PI / 2;
      vaporRibbon.position.set(sx * 4.05, 0.06, 7.6);

      craft.add(nacelle, spike, inletLip, rudder, tipBeacon, vaporRibbon);
    }
  } else if (opts.style === 'apache_heli') {
    // === APACHE AH-64E GUARDIAN — SCULPTED ARMORED GUNSHIP ===
    const oliveArmorMat = new THREE.MeshPhysicalMaterial({
      color: 0x2e3b2f,
      metalness: 0.48,
      roughness: 0.42,
      clearcoat: 0.3,
      bumpMap: skinTex.bumpMap,
      bumpScale: 0.018,
      roughnessMap: skinTex.roughnessMap,
    });
    const gunMetalMat = new THREE.MeshStandardMaterial({
      color: 0x111827,
      metalness: 0.9,
      roughness: 0.22,
    });

    // Sculpted Armored Tandem Fuselage Side Silhouette (No blocky box!)
    const hullShape = new THREE.Shape();
    hullShape.moveTo(-2.55, 0.15);
    hullShape.lineTo(-2.3, 0.72);
    hullShape.lineTo(-1.35, 1.35);
    hullShape.lineTo(0.45, 1.38);
    hullShape.lineTo(1.85, 0.95);
    hullShape.lineTo(2.45, 0.45);
    hullShape.lineTo(2.3, -0.05);
    hullShape.lineTo(-1.8, -0.08);
    hullShape.closePath();
    const hullGeo = new THREE.ExtrudeGeometry(hullShape, {
      depth: 1.06,
      bevelEnabled: true,
      bevelThickness: 0.14,
      bevelSize: 0.12,
      bevelSegments: 4,
    });
    hullGeo.rotateY(Math.PI / 2);
    hullGeo.translate(-0.53, 0, 0);
    const body = new THREE.Mesh(hullGeo, oliveArmorMat);
    body.castShadow = true;
    craft.add(body);

    // Tandem Faceted Armored Glass Canopy
    const canopyShape = new THREE.Shape();
    canopyShape.moveTo(-1.75, 0.72);
    canopyShape.lineTo(-1.12, 1.48);
    canopyShape.lineTo(0.28, 1.52);
    canopyShape.lineTo(0.65, 1.08);
    canopyShape.closePath();
    const canopyGeo = new THREE.ExtrudeGeometry(canopyShape, {
      depth: 0.82,
      bevelEnabled: true,
      bevelThickness: 0.06,
      bevelSize: 0.06,
    });
    canopyGeo.rotateY(Math.PI / 2);
    canopyGeo.translate(-0.41, 0, 0);
    const canopy = new THREE.Mesh(canopyGeo, glassMat);
    craft.add(canopy);

    // Cheek Avionics EFAB Sponsons + Nose TADS/PNVS FLIR Turret w/ Sapphire Optic Lens + M230 30mm Chain Gun
    const tadsTurret = new THREE.Mesh(new THREE.SphereGeometry(0.36, 20, 16), gunMetalMat);
    tadsTurret.position.set(0, 0.48, -2.55);
    const opticLens = new THREE.Mesh(
      new THREE.CylinderGeometry(0.14, 0.14, 0.1, 16),
      new THREE.MeshBasicMaterial({ color: 0x38bdf8 })
    );
    opticLens.rotation.x = Math.PI / 2;
    opticLens.position.set(0, 0.48, -2.9);
    const chainGun = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.075, 1.55, 12), gunMetalMat);
    chainGun.rotation.x = Math.PI / 2;
    chainGun.position.set(0, -0.22, -2.25);
    craft.add(tadsTurret, opticLens, chainGun);

    // Twin T700 Turboshaft Nacelles + Stub Wings + 4-Rail AGM-114 Hellfire Missiles + 19-Shot Hydra Rocket Pods
    for (const sx of [-1, 1]) {
      const engine = new THREE.Mesh(new THREE.CapsuleGeometry(0.3, 1.85, 8, 16), oliveArmorMat);
      engine.rotation.x = Math.PI / 2;
      engine.position.set(sx * 0.72, 0.98, 0.42);
      const intakeGlow = new THREE.Mesh(
        new THREE.TorusGeometry(0.24, 0.04, 8, 16),
        new THREE.MeshBasicMaterial({ color: 0x10b981 })
      );
      intakeGlow.position.set(sx * 0.72, 0.98, -0.55);
      const stubWing = new THREE.Mesh(new THREE.BoxGeometry(1.75, 0.12, 0.92), oliveArmorMat);
      stubWing.position.set(sx * 1.32, 0.28, 0.15);
      stubWing.rotation.z = sx * -0.06;
      const rocketPod = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 1.25, 16), gunMetalMat);
      rocketPod.rotation.x = Math.PI / 2;
      rocketPod.position.set(sx * 1.92, 0.02, 0.12);
      const missileRack = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 1.38, 10), gunMetalMat);
      missileRack.rotation.x = Math.PI / 2;
      missileRack.position.set(sx * 1.35, -0.02, 0.05);
      const wheelStrut = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.72, 8), gunMetalMat);
      wheelStrut.position.set(sx * 0.78, -0.3, -1.15);
      wheelStrut.rotation.z = sx * 0.34;
      const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.16, 16), gunMetalMat);
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(sx * 0.94, -0.58, -1.15);
      craft.add(engine, intakeGlow, stubWing, rocketPod, missileRack, wheelStrut, wheel);
    }

    // Tapered Tail Boom, Swept Vertical Fin & Stabilator
    const tailBoom = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.42, 4.5, 12), oliveArmorMat);
    tailBoom.rotation.x = Math.PI / 2;
    tailBoom.position.set(0, 0.52, 4.15);
    const tailFin = new THREE.Mesh(new THREE.BoxGeometry(0.14, 1.35, 0.78), oliveArmorMat);
    tailFin.position.set(0, 1.08, 6.2);
    tailFin.rotation.x = -0.36;
    const hStab = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.1, 0.5), oliveArmorMat);
    hStab.position.set(0, 0.58, 6.15);
    craft.add(tailBoom, tailFin, hStab);

    // Longbow Radar Dome + Spinning 4-Blade Swept Main Rotor + Motion Blur Disc
    const mainRotorPivot = new THREE.Group();
    mainRotorPivot.position.set(0, 1.66, 0.12);
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.16, 0.55, 12), gunMetalMat);
    mast.position.y = -0.18;
    const radarDome = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.36, 0.28, 16), oliveArmorMat);
    radarDome.position.y = 0.22;
    mainRotorPivot.add(mast, radarDome);
    for (let b = 0; b < 4; b++) {
      const blade = new THREE.Mesh(new THREE.BoxGeometry(4.6, 0.035, 0.26), gunMetalMat);
      blade.position.x = b % 2 === 0 ? 2.3 : -2.3;
      const holder = new THREE.Group();
      holder.rotation.y = (b / 4) * Math.PI * 2;
      holder.add(blade);
      mainRotorPivot.add(holder);
    }
    const rotorBlurDisc = new THREE.Mesh(
      new THREE.RingGeometry(0.55, 4.55, 40),
      new THREE.MeshBasicMaterial({
        color: 0x334155,
        transparent: true,
        opacity: 0.11,
        side: THREE.DoubleSide,
        depthWrite: false,
      })
    );
    rotorBlurDisc.rotation.x = Math.PI / 2;
    mainRotorPivot.add(rotorBlurDisc);
    craft.add(mainRotorPivot);
    opts.rotorRegister.push(mainRotorPivot);

    // Spinning X-Tail Rotor
    const tailRotorPivot = new THREE.Group();
    tailRotorPivot.position.set(-0.22, 1.28, 6.25);
    tailRotorPivot.userData.axis = 'x';
    for (let b = 0; b < 4; b++) {
      const tBlade = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.98, 0.13), gunMetalMat);
      tBlade.rotation.x = (b / 4) * Math.PI * 2 + (b % 2 === 0 ? 0.22 : -0.22);
      tailRotorPivot.add(tBlade);
    }
    craft.add(tailRotorPivot);
    opts.rotorRegister.push(tailRotorPivot);
  } else if (opts.style === 'f18_naval') {
    // === F/A-18E SUPER HORNET — SCULPTED AAA CARRIER STRIKE FIGHTER ===
    const navalGrayMat = new THREE.MeshPhysicalMaterial({
      color: 0xc2cedc,
      map: skinTex.map,
      bumpMap: skinTex.bumpMap,
      bumpScale: 0.024,
      roughnessMap: skinTex.roughnessMap,
      roughness: 0.34,
      metalness: 0.64,
      clearcoat: 0.42,
      clearcoatRoughness: 0.24,
    });
    const darkNavalMat = new THREE.MeshPhysicalMaterial({
      color: 0x334155,
      map: skinTex.map,
      bumpMap: skinTex.bumpMap,
      bumpScale: 0.02,
      roughness: 0.38,
      metalness: 0.72,
      clearcoat: 0.35,
    });
    const titaniumMat = new THREE.MeshStandardMaterial({
      color: 0x1e2530,
      roughness: 0.24,
      metalness: 0.92,
    });
    const stripeMat = new THREE.MeshStandardMaterial({
      color: 0xd97706,
      roughness: 0.32,
      metalness: 0.45,
    });
    const hornetCanopyMat = new THREE.MeshPhysicalMaterial({
      color: 0x0b1628,
      roughness: 0.04,
      metalness: 0.88,
      clearcoat: 1.0,
      clearcoatRoughness: 0.03,
      reflectivity: 1.0,
      envMapIntensity: 2.2,
    });

    // Sculpted Lathe Ogive Nose + Blended Fuselage Body
    const nosePts: THREE.Vector2[] = [];
    for (let i = 0; i <= 14; i++) {
      const t = i / 14;
      const r = Math.pow(Math.sin(t * Math.PI * 0.5), 0.72) * 0.58;
      nosePts.push(new THREE.Vector2(Math.max(0.015, r), (1 - t) * 2.6));
    }
    const noseGeo = new THREE.LatheGeometry(nosePts, 24);
    noseGeo.rotateX(-Math.PI / 2);
    const noseCone = new THREE.Mesh(noseGeo, darkNavalMat);
    noseCone.scale.set(1.05, 0.82, 1.0);
    noseCone.position.set(0, 0.02, -3.15);
    noseCone.castShadow = true;
    craft.add(noseCone);

    const pitot = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.022, 0.72, 8), titaniumMat);
    pitot.rotation.x = Math.PI / 2;
    pitot.position.set(0, 0.02, -6.05);
    craft.add(pitot);

    // Sculpted Main Fuselage + Dorsal Avionics Spine
    const mainFuse = new THREE.Mesh(new THREE.CylinderGeometry(0.56, 0.74, 6.2, 24), navalGrayMat);
    mainFuse.rotation.x = Math.PI / 2;
    mainFuse.scale.set(1.48, 1.0, 0.68);
    mainFuse.castShadow = true;
    mainFuse.receiveShadow = true;
    craft.add(mainFuse);

    const dorsalSpine = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.44, 4.4, 16), darkNavalMat);
    dorsalSpine.rotation.x = Math.PI / 2;
    dorsalSpine.scale.set(1.15, 1.0, 0.52);
    dorsalSpine.position.set(0, 0.36, 0.75);
    craft.add(dorsalSpine);

    // Sleek Dark-Tinted Fighter Bubble Canopy + Cockpit Frame & Subtle Green HUD Glass
    const canopyGeo = new THREE.CapsuleGeometry(0.32, 1.48, 12, 22);
    canopyGeo.rotateX(Math.PI / 2);
    const canopy = new THREE.Mesh(canopyGeo, hornetCanopyMat);
    canopy.scale.set(1.06, 0.82, 1.0);
    canopy.position.set(0, 0.48, -1.95);
    const canopyArch = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.028, 8, 20, Math.PI), titaniumMat);
    canopyArch.position.set(0, 0.42, -2.15);
    const hudGlass = new THREE.Mesh(
      new THREE.PlaneGeometry(0.24, 0.16),
      new THREE.MeshBasicMaterial({ color: 0x34d399, transparent: true, opacity: 0.45, side: THREE.DoubleSide })
    );
    hudGlass.position.set(0, 0.56, -2.55);
    hudGlass.rotation.x = -0.35;
    craft.add(canopy, canopyArch, hudGlass);

    // Sculpted Beveled Swept Trapezoidal Carrier Wings, Curved LERX, Twin Canted Tails & Intakes
    for (const sx of [-1, 1]) {
      const wingShape = new THREE.Shape();
      wingShape.moveTo(0, -1.45);
      wingShape.lineTo(3.95, 0.42);
      wingShape.lineTo(3.95, 1.18);
      wingShape.lineTo(0.15, 1.45);
      wingShape.closePath();
      const wingGeo = new THREE.ExtrudeGeometry(wingShape, {
        depth: 0.085,
        bevelEnabled: true,
        bevelThickness: 0.025,
        bevelSize: 0.03,
        bevelSegments: 2,
      });
      wingGeo.rotateX(Math.PI / 2);
      if (sx < 0) wingGeo.scale(-1, 1, 1);
      const wing = new THREE.Mesh(wingGeo, navalGrayMat);
      wing.position.set(sx * 0.62, 0.04, 0.45);
      wing.castShadow = true;
      wing.receiveShadow = true;

      const lerxShape = new THREE.Shape();
      lerxShape.moveTo(0, -2.4);
      lerxShape.lineTo(0.88, -0.8);
      lerxShape.lineTo(0.95, 0.6);
      lerxShape.lineTo(0, 0.6);
      lerxShape.closePath();
      const lerxGeo = new THREE.ExtrudeGeometry(lerxShape, {
        depth: 0.07,
        bevelEnabled: true,
        bevelThickness: 0.02,
        bevelSize: 0.02,
        bevelSegments: 2,
      });
      lerxGeo.rotateX(Math.PI / 2);
      if (sx < 0) lerxGeo.scale(-1, 1, 1);
      const lerx = new THREE.Mesh(lerxGeo, darkNavalMat);
      lerx.position.set(sx * 0.44, 0.14, -1.05);

      const intakeBox = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.48, 2.35), darkNavalMat);
      intakeBox.position.set(sx * 0.92, -0.08, -0.62);
      intakeBox.rotation.z = sx * -0.18;
      const intakeHole = new THREE.Mesh(
        new THREE.PlaneGeometry(0.46, 0.38),
        new THREE.MeshBasicMaterial({ color: 0x050810 })
      );
      intakeHole.position.set(sx * 0.92, -0.08, -1.805);
      intakeHole.rotation.y = Math.PI;

      const tailShape = new THREE.Shape();
      tailShape.moveTo(0, 0);
      tailShape.lineTo(0.72, 1.72);
      tailShape.lineTo(1.22, 1.72);
      tailShape.lineTo(1.38, 0);
      tailShape.closePath();
      const tailGeo = new THREE.ExtrudeGeometry(tailShape, {
        depth: 0.065,
        bevelEnabled: true,
        bevelThickness: 0.015,
        bevelSize: 0.015,
        bevelSegments: 2,
      });
      tailGeo.rotateY(-Math.PI / 2);
      const tail = new THREE.Mesh(tailGeo, darkNavalMat);
      tail.position.set(sx * 0.62, 0.25, 1.95);
      tail.rotation.z = sx * -0.34;
      tail.castShadow = true;

      const tailStripe = new THREE.Mesh(new THREE.BoxGeometry(0.085, 0.18, 0.56), stripeMat);
      tailStripe.position.set(sx * 1.05, 1.56, 2.82);
      tailStripe.rotation.z = sx * -0.34;

      const hStabShape = new THREE.Shape();
      hStabShape.moveTo(0, -0.55);
      hStabShape.lineTo(1.85, 0.35);
      hStabShape.lineTo(1.85, 0.85);
      hStabShape.lineTo(0, 0.65);
      hStabShape.closePath();
      const hStabGeo = new THREE.ExtrudeGeometry(hStabShape, { depth: 0.055, bevelEnabled: false });
      hStabGeo.rotateX(Math.PI / 2);
      if (sx < 0) hStabGeo.scale(-1, 1, 1);
      const hStab = new THREE.Mesh(hStabGeo, navalGrayMat);
      hStab.position.set(sx * 0.58, -0.05, 2.65);

      const missileBodyMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.28, metalness: 0.55 });
      const sidewinder = new THREE.Mesh(new THREE.CylinderGeometry(0.048, 0.048, 2.05, 10), missileBodyMat);
      sidewinder.rotation.x = Math.PI / 2;
      sidewinder.position.set(sx * 4.62, 0.02, 1.15);
      const pylon = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.24, 0.95), darkNavalMat);
      pylon.position.set(sx * 2.45, -0.14, 0.88);
      const harpoon = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.085, 2.35, 12), darkNavalMat);
      harpoon.rotation.x = Math.PI / 2;
      harpoon.position.set(sx * 2.45, -0.31, 0.82);

      const navLight = new THREE.Mesh(
        new THREE.SphereGeometry(0.075, 10, 10),
        new THREE.MeshBasicMaterial({ color: sx < 0 ? 0xff2a3c : 0x22c55e })
      );
      navLight.position.set(sx * 4.62, 0.06, 0.82);

      const contrail = new THREE.Mesh(
        new THREE.CylinderGeometry(0.015, 0.14, 13.5, 8, 1, true),
        new THREE.MeshBasicMaterial({
          color: 0xe0f2fe,
          transparent: true,
          opacity: 0.19,
          depthWrite: false,
          side: THREE.DoubleSide,
        })
      );
      contrail.rotation.x = Math.PI / 2;
      contrail.position.set(sx * 4.62, 0.02, 8.2);

      const nozzle = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.36, 0.82, 18), titaniumMat);
      nozzle.rotation.x = Math.PI / 2;
      nozzle.position.set(sx * 0.44, -0.02, 3.45);
      const nozzleRing = new THREE.Mesh(
        new THREE.TorusGeometry(0.27, 0.028, 8, 18),
        new THREE.MeshBasicMaterial({ color: 0xfb923c })
      );
      nozzleRing.position.set(sx * 0.44, -0.02, 3.85);

      const outerFlame = new THREE.Mesh(
        new THREE.ConeGeometry(0.27, 3.0, 16, 1, true),
        new THREE.MeshBasicMaterial({
          color: 0x38bdf8,
          transparent: true,
          opacity: 0.62,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          side: THREE.DoubleSide,
        })
      );
      outerFlame.rotation.x = Math.PI / 2;
      outerFlame.position.set(sx * 0.44, -0.02, 5.35);

      const innerCore = new THREE.Mesh(
        new THREE.ConeGeometry(0.14, 1.85, 12),
        new THREE.MeshBasicMaterial({
          color: 0xffedd5,
          transparent: true,
          opacity: 0.92,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        })
      );
      innerCore.rotation.x = Math.PI / 2;
      innerCore.position.set(sx * 0.44, -0.02, 4.78);

      flames.push(outerFlame, innerCore);
      craft.add(
        wing,
        lerx,
        intakeBox,
        intakeHole,
        tail,
        tailStripe,
        hStab,
        sidewinder,
        pylon,
        harpoon,
        navLight,
        contrail,
        nozzle,
        nozzleRing,
        outerFlame,
        innerCore
      );
    }
  }

  craft.userData.flames = flames;
  return craft;
}

export function createSoftCloudTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 128;
  const ctx = c.getContext('2d')!;
  ctx.clearRect(0, 0, 256, 128);
  const puffs = [
    [68, 74, 46, 0.42],
    [108, 56, 56, 0.56],
    [152, 60, 52, 0.5],
    [190, 74, 42, 0.36],
    [126, 76, 62, 0.44],
  ];
  for (const [px, py, r, a] of puffs) {
    const g = ctx.createRadialGradient(px, py - r * 0.18, r * 0.08, px, py, r);
    g.addColorStop(0, `rgba(255, 250, 242, ${a})`);
    g.addColorStop(0.52, `rgba(226, 236, 248, ${a * 0.58})`);
    g.addColorStop(1, 'rgba(180, 200, 224, 0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(px, py, r, 0, Math.PI * 2);
    ctx.fill();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createVolcanicIslandTexture(maxAnisotropy = 4): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 512;
  const ctx = c.getContext('2d')!;
  const grad = ctx.createLinearGradient(0, 0, 0, 512);
  grad.addColorStop(0, '#364935');
  grad.addColorStop(0.32, '#2d3a2f');
  grad.addColorStop(0.68, '#333942');
  grad.addColorStop(1, '#1f252e');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 420; i++) {
    const x = (i * 83) % 512;
    const y = (i * 137) % 512;
    const w = 14 + (i % 34);
    const h = 8 + (i % 22);
    ctx.fillStyle = y < 190 ? 'rgba(54, 83, 52, 0.34)' : 'rgba(15, 23, 36, 0.38)';
    ctx.fillRect(x, y, w, h);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

/** Cracked dark basalt & obsidian caldera cliff texture with subtle base ember seams. */
export function createVolcanicBasaltTexture(maxAnisotropy = 4): {
  map: THREE.CanvasTexture;
  emissiveMap: THREE.CanvasTexture;
} {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 512;
  const ctx = c.getContext('2d')!;
  const grad = ctx.createLinearGradient(0, 0, 0, 512);
  grad.addColorStop(0, '#30343d');
  grad.addColorStop(0.45, '#1f232b');
  grad.addColorStop(0.82, '#171418');
  grad.addColorStop(1, '#2a1510');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 512, 512);

  // Sharp basalt strata & angular fracture facets
  for (let i = 0; i < 480; i++) {
    const x = (i * 97) % 512;
    const y = (i * 151) % 512;
    const w = 12 + (i % 38);
    const h = 4 + (i % 14);
    ctx.fillStyle = i % 3 === 0 ? 'rgba(71, 85, 105, 0.28)' : 'rgba(9, 10, 14, 0.45)';
    ctx.fillRect(x, y, w, h);
  }

  // Subtle glowing magma veins ONLY near lower strata
  const ec = document.createElement('canvas');
  ec.width = 512;
  ec.height = 512;
  const ectx = ec.getContext('2d')!;
  ectx.fillStyle = '#000000';
  ectx.fillRect(0, 0, 512, 512);
  ectx.strokeStyle = 'rgba(249, 115, 22, 0.72)';
  ectx.lineWidth = 2.5;
  for (let k = 0; k < 28; k++) {
    const sx = (k * 67) % 512;
    const sy = 370 + ((k * 43) % 130);
    ectx.beginPath();
    ectx.moveTo(sx, sy);
    ectx.lineTo((sx + 28) % 512, Math.min(510, sy + 24));
    ectx.lineTo((sx + 52) % 512, Math.min(510, sy + 12));
    ectx.stroke();
  }

  const map = new THREE.CanvasTexture(c);
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = maxAnisotropy;

  const emissiveMap = new THREE.CanvasTexture(ec);
  emissiveMap.wrapS = emissiveMap.wrapT = THREE.RepeatWrapping;
  emissiveMap.colorSpace = THREE.SRGBColorSpace;
  emissiveMap.anisotropy = maxAnisotropy;

  return { map, emissiveMap };
}

export function createAircraftCarrierModel(maxAnisotropy = 4): THREE.Group {
  const carrier = new THREE.Group();
  const hullMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.56, metalness: 0.45 });
  const darkHullMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.65, metalness: 0.42 });

  const deckCanvas = document.createElement('canvas');
  deckCanvas.width = 512;
  deckCanvas.height = 1024;
  const dctx = deckCanvas.getContext('2d')!;
  dctx.fillStyle = '#252c37';
  dctx.fillRect(0, 0, 512, 1024);
  for (let i = 0; i < 600; i++) {
    dctx.fillStyle = i % 2 === 0 ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.06)';
    dctx.fillRect((i * 71) % 512, (i * 113) % 1024, 18, 42);
  }
  dctx.strokeStyle = '#f8fafc';
  dctx.lineWidth = 8;
  dctx.strokeRect(24, 24, 464, 976);
  dctx.strokeStyle = '#facc15';
  dctx.setLineDash([28, 22]);
  dctx.lineWidth = 6;
  dctx.beginPath();
  dctx.moveTo(210, 960);
  dctx.lineTo(130, 80);
  dctx.stroke();
  dctx.setLineDash([]);
  dctx.fillStyle = '#94a3b8';
  for (let w = 720; w <= 860; w += 36) dctx.fillRect(90, w, 240, 5);
  dctx.fillStyle = 'rgba(248, 250, 252, 0.85)';
  dctx.font = 'bold 96px monospace';
  dctx.fillText('78', 290, 150);

  const deckTex = new THREE.CanvasTexture(deckCanvas);
  deckTex.colorSpace = THREE.SRGBColorSpace;
  deckTex.anisotropy = maxAnisotropy;
  const deckMat = new THREE.MeshStandardMaterial({ map: deckTex, roughness: 0.72, metalness: 0.18 });

  const hull = new THREE.Mesh(new THREE.BoxGeometry(10.5, 4.2, 54), darkHullMat);
  hull.position.set(0, 1.5, 0);
  hull.castShadow = true;
  hull.receiveShadow = true;
  const flightDeck = new THREE.Mesh(new THREE.BoxGeometry(14.8, 0.85, 58), deckMat);
  flightDeck.position.set(-0.6, 3.9, 0);
  flightDeck.receiveShadow = true;
  const island = new THREE.Mesh(new THREE.BoxGeometry(2.8, 5.6, 9.8), hullMat);
  island.position.set(5.4, 7.1, 4.5);
  island.castShadow = true;
  const bridgeWindow = new THREE.Mesh(
    new THREE.BoxGeometry(2.9, 0.65, 3.6),
    new THREE.MeshBasicMaterial({ color: 0x38bdf8 })
  );
  bridgeWindow.position.set(5.4, 8.6, 1.2);
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.42, 6.2, 8), darkHullMat);
  mast.position.set(5.4, 12.6, 5.2);
  const radarDish = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.65, 0.25), hullMat);
  radarDish.position.set(5.4, 14.4, 5.2);

  const lightMat = new THREE.MeshBasicMaterial({ color: 0xf59e0b });
  for (let lz = -24; lz <= 24; lz += 8) {
    const lDot = new THREE.Mesh(new THREE.SphereGeometry(0.22, 6, 6), lightMat);
    lDot.position.set(-7.8, 4.45, lz);
    carrier.add(lDot);
  }
  const wake = new THREE.Mesh(
    new THREE.PlaneGeometry(16, 46),
    new THREE.MeshBasicMaterial({
      color: 0xe0f2fe,
      transparent: true,
      opacity: 0.28,
      depthWrite: false,
      side: THREE.DoubleSide,
    })
  );
  wake.rotation.x = -Math.PI / 2;
  wake.position.set(0, 0.15, 50);

  carrier.add(hull, flightDeck, island, bridgeWindow, mast, radarDish, wake);
  return carrier;
}

export function createNavalDestroyerModel(): THREE.Group {
  const ship = new THREE.Group();
  const hullMat = new THREE.MeshStandardMaterial({ color: 0x3b495c, roughness: 0.48, metalness: 0.52 });
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.55, metalness: 0.6 });
  const hull = new THREE.Mesh(new THREE.BoxGeometry(4.2, 2.4, 28), hullMat);
  hull.position.y = 0.9;
  const bow = new THREE.Mesh(new THREE.ConeGeometry(2.4, 8.5, 4), hullMat);
  bow.rotation.x = -Math.PI / 2;
  bow.rotation.y = Math.PI / 4;
  bow.position.set(0, 1.0, -18.2);
  const bridge = new THREE.Mesh(new THREE.BoxGeometry(3.2, 3.8, 7.6), hullMat);
  bridge.position.set(0, 3.6, -2.5);
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.35, 5.2, 8), darkMat);
  mast.position.set(0, 7.6, -2.0);
  const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.2, 6, 6), new THREE.MeshBasicMaterial({ color: 0xef4444 }));
  beacon.position.set(0, 10.3, -2.0);
  const wake = new THREE.Mesh(
    new THREE.PlaneGeometry(6.5, 28),
    new THREE.MeshBasicMaterial({ color: 0xdbeafe, transparent: true, opacity: 0.24, depthWrite: false, side: THREE.DoubleSide })
  );
  wake.rotation.x = -Math.PI / 2;
  wake.position.set(0, 0.12, 27);
  ship.add(hull, bow, bridge, mast, beacon, wake);
  return ship;
}

export function createNightCityGroundTexture(accentHex: number, maxAnisotropy: number): {
  map: THREE.CanvasTexture;
  emissiveMap: THREE.CanvasTexture;
  roughnessMap: THREE.CanvasTexture;
} {
  const size = 1024;
  const albedo = document.createElement('canvas');
  const emiss = document.createElement('canvas');
  const rough = document.createElement('canvas');
  albedo.width = emiss.width = rough.width = size;
  albedo.height = emiss.height = rough.height = size;
  const ctx = albedo.getContext('2d')!;
  const ectx = emiss.getContext('2d')!;
  const rctx = rough.getContext('2d')!;
  const accentCss = '#' + new THREE.Color(accentHex).getHexString();

  // Dark wet urban asphalt base
  ctx.fillStyle = '#090e18';
  ctx.fillRect(0, 0, size, size);
  ectx.fillStyle = '#000000';
  ectx.fillRect(0, 0, size, size);
  rctx.fillStyle = '#383838'; // slight wet reflection
  rctx.fillRect(0, 0, size, size);

  // City blocks & sidewalks
  const step = 128;
  for (let gx = 0; gx < size; gx += step) {
    for (let gy = 0; gy < size; gy += step) {
      ctx.fillStyle = '#111a2b';
      ctx.fillRect(gx + 14, gy + 14, step - 28, step - 28);
      ctx.strokeStyle = '#1e2c42';
      ctx.lineWidth = 2;
      ctx.strokeRect(gx + 14, gy + 14, step - 28, step - 28);
      rctx.fillStyle = '#6e6e6e';
      rctx.fillRect(gx + 14, gy + 14, step - 28, step - 28);
    }
  }

  // Arterial avenues with crisp dashed lane markings & soft warm streetlamps
  for (let i = 0; i < size; i += step) {
    ctx.fillStyle = '#0d1422';
    ctx.fillRect(i - 10, 0, 20, size);
    ctx.fillRect(0, i - 10, size, 20);

    // Subtle glowing road lane lines & intersections
    ectx.fillStyle = i % 256 === 0 ? accentCss : '#334155';
    for (let d = 16; d < size; d += 32) {
      ectx.fillRect(i - 1, d, 2, 14);
      ectx.fillRect(d, i - 1, 14, 2);
    }
    // Streetlamp pools (warm amber / cool white)
    for (let s = 32; s < size; s += 64) {
      const lamp = ectx.createRadialGradient(i + 12, s, 1, i + 12, s, 10);
      lamp.addColorStop(0, 'rgba(251, 191, 36, 0.55)');
      lamp.addColorStop(1, 'rgba(251, 191, 36, 0)');
      ectx.fillStyle = lamp;
      ectx.fillRect(i, s - 12, 24, 24);
    }
  }

  const wrap = (c: HTMLCanvasElement, srgb: boolean) => {
    const t = new THREE.CanvasTexture(c);
    t.wrapS = THREE.RepeatWrapping;
    t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(8, 8);
    t.anisotropy = maxAnisotropy;
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    return t;
  };

  return {
    map: wrap(albedo, true),
    emissiveMap: wrap(emiss, true),
    roughnessMap: wrap(rough, false),
  };
}

export function createDetailedSuperbikeModel(
  paintHex: number,
  accentHex: number,
  isHero: boolean,
  shadowTex: THREE.CanvasTexture | null,
  wheelRegister: THREE.Object3D[]
): THREE.Group {
  const bike = new THREE.Group();
  const skinTex = createAircraftSkinTextures();
  const bodyMat = new THREE.MeshPhysicalMaterial({
    color: paintHex,
    map: skinTex.map,
    bumpMap: skinTex.bumpMap,
    bumpScale: 0.012,
    roughness: 0.14,
    metalness: 0.68,
    clearcoat: 1.0,
    clearcoatRoughness: 0.06,
  });
  const carbonMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.28, metalness: 0.62 });
  const goldMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.18, metalness: 0.94 });
  const brakeDiscMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.22, metalness: 0.92 });
  const tireMat = new THREE.MeshStandardMaterial({ color: 0x0b0f17, roughness: 0.78, metalness: 0.08 });
  const neonMat = new THREE.MeshBasicMaterial({ color: accentHex });
  const visorMat = new THREE.MeshPhysicalMaterial({ color: 0x050b18, roughness: 0.04, metalness: 0.95, clearcoat: 1.0 });

  if (shadowTex) {
    const sh = new THREE.Mesh(
      new THREE.PlaneGeometry(2.6, 5.2),
      new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, opacity: 0.78, depthWrite: false })
    );
    sh.rotation.x = -Math.PI / 2;
    sh.position.y = 0.02;
    bike.add(sh);
  }

  for (const wz of [-1.45, 1.45]) {
    const wheelGrp = new THREE.Group();
    wheelGrp.position.set(0, 0.58, wz);
    const tire = new THREE.Mesh(new THREE.TorusGeometry(0.46, 0.16, 16, 30), tireMat);
    tire.rotation.y = Math.PI / 2;
    tire.castShadow = true;
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.036, 10, 24), neonMat);
    rim.rotation.y = Math.PI / 2;
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.04, 18), brakeDiscMat);
    disc.rotation.z = Math.PI / 2;
    disc.position.x = 0.12;
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.3, 12), carbonMat);
    hub.rotation.z = Math.PI / 2;
    wheelGrp.add(tire, rim, disc, hub);
    bike.add(wheelGrp);
    wheelRegister.push(wheelGrp);
  }

  const fairingShape = new THREE.Shape();
  fairingShape.moveTo(-1.45, 0.42);
  fairingShape.lineTo(-0.9, 1.08);
  fairingShape.lineTo(0.25, 1.05);
  fairingShape.lineTo(1.55, 1.24);
  fairingShape.lineTo(1.42, 0.78);
  fairingShape.lineTo(0.35, 0.34);
  fairingShape.lineTo(-1.1, 0.28);
  fairingShape.closePath();
  const fairingGeo = new THREE.ExtrudeGeometry(fairingShape, {
    depth: 0.64,
    bevelEnabled: true,
    bevelThickness: 0.1,
    bevelSize: 0.08,
    bevelSegments: 3,
  });
  fairingGeo.rotateY(Math.PI / 2);
  fairingGeo.translate(-0.32, 0.24, 0);
  const mainBody = new THREE.Mesh(fairingGeo, bodyMat);
  mainBody.castShadow = true;

  const windshield = new THREE.Mesh(new THREE.CapsuleGeometry(0.24, 0.42, 8, 14), visorMat);
  windshield.rotation.x = 0.92;
  windshield.scale.set(1.15, 1, 0.55);
  windshield.position.set(0, 1.38, -1.12);

  for (const sx of [-1, 1]) {
    const winglet = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.05, 0.38), carbonMat);
    winglet.position.set(sx * 0.48, 1.02, -1.15);
    winglet.rotation.z = sx * -0.18;
    const fork = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 1.15, 10), goldMat);
    fork.position.set(sx * 0.18, 0.95, -1.25);
    fork.rotation.x = 0.34;
    bike.add(winglet, fork);
  }
  const exhaust = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.12, 1.08, 14), brakeDiscMat);
  exhaust.rotation.x = Math.PI / 2 - 0.2;
  exhaust.position.set(0.38, 0.78, 1.15);
  const headlight = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.11, 0.08), new THREE.MeshBasicMaterial({ color: 0xe0f2fe }));
  headlight.position.set(0, 1.06, -1.68);
  const tailLight = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.09, 0.08), new THREE.MeshBasicMaterial({ color: 0xff2244 }));
  tailLight.position.set(0, 1.34, 1.62);

  const riderSuit = new THREE.Mesh(new THREE.CapsuleGeometry(0.28, 0.72, 10, 14), carbonMat);
  riderSuit.rotation.x = Math.PI / 2 - 0.38;
  riderSuit.position.set(0, 1.56, 0.22);
  const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.25, 18, 16), isHero ? bodyMat : carbonMat);
  helmet.position.set(0, 1.72, -0.4);
  const helmetVisor = new THREE.Mesh(new THREE.SphereGeometry(0.225, 16, 12, 0, Math.PI), visorMat);
  helmetVisor.rotation.y = Math.PI;
  helmetVisor.position.set(0, 1.72, -0.46);

  bike.add(mainBody, windshield, exhaust, headlight, tailLight, riderSuit, helmet, helmetVisor);
  return bike;
}

export function createDetailedTankModel(accentHex: number, rotorRegister: THREE.Object3D[]): THREE.Group {
  const tank = new THREE.Group();
  const skinTex = createAircraftSkinTextures();
  const armorMat = new THREE.MeshPhysicalMaterial({
    color: 0xc4aa7e,
    map: skinTex.map,
    bumpMap: skinTex.bumpMap,
    bumpScale: 0.028,
    roughnessMap: skinTex.roughnessMap,
    roughness: 0.56,
    metalness: 0.28,
    clearcoat: 0.12,
  });
  const eraMat = new THREE.MeshStandardMaterial({ color: 0xa68d63, roughness: 0.65, metalness: 0.22 });
  const darkSteelMat = new THREE.MeshStandardMaterial({ color: 0x1b222c, roughness: 0.34, metalness: 0.86 });
  const trackMat = new THREE.MeshStandardMaterial({ color: 0x11151b, roughness: 0.88, metalness: 0.24 });
  const opticsMat = new THREE.MeshBasicMaterial({ color: accentHex });

  const hullShape = new THREE.Shape();
  hullShape.moveTo(-3.4, 0.52);
  hullShape.lineTo(-2.1, 1.38);
  hullShape.lineTo(3.15, 1.38);
  hullShape.lineTo(3.35, 0.62);
  hullShape.lineTo(-3.1, 0.36);
  hullShape.closePath();
  const hullGeo = new THREE.ExtrudeGeometry(hullShape, {
    depth: 3.3,
    bevelEnabled: true,
    bevelThickness: 0.08,
    bevelSize: 0.08,
    bevelSegments: 2,
  });
  hullGeo.rotateY(Math.PI / 2);
  hullGeo.translate(-1.65, 0, 0);
  const hull = new THREE.Mesh(hullGeo, armorMat);
  hull.castShadow = true;
  hull.receiveShadow = true;
  tank.add(hull);

  for (const sx of [-1.74, 1.74]) {
    const tread = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.86, 6.7), trackMat);
    tread.position.set(sx, 0.46, 0);
    tread.castShadow = true;
    const skirt = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.64, 6.2), armorMat);
    skirt.position.set(sx + (sx > 0 ? 0.38 : -0.38), 0.78, 0);
    tank.add(tread, skirt);
    for (let b = -2.3; b <= 2.3; b += 0.92) {
      const eraBlock = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.44, 0.78), eraMat);
      eraBlock.position.set(sx + (sx > 0 ? 0.48 : -0.48), 0.78, b);
      tank.add(eraBlock);
    }
    for (let w = -2.6; w <= 2.6; w += 0.86) {
      const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.74, 14), darkSteelMat);
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(sx, 0.35, w);
      tank.add(wheel);
      rotorRegister.push(wheel);
    }
  }

  const turretPivot = new THREE.Group();
  turretPivot.position.set(0, 1.44, 0.1);
  const turretShape = new THREE.Shape();
  turretShape.moveTo(-1.15, -2.15);
  turretShape.lineTo(1.15, -2.15);
  turretShape.lineTo(1.55, -0.45);
  turretShape.lineTo(1.38, 1.95);
  turretShape.lineTo(-1.38, 1.95);
  turretShape.lineTo(-1.55, -0.45);
  turretShape.closePath();
  const turretGeo = new THREE.ExtrudeGeometry(turretShape, {
    depth: 0.76,
    bevelEnabled: true,
    bevelThickness: 0.08,
    bevelSize: 0.08,
    bevelSegments: 2,
  });
  turretGeo.rotateX(Math.PI / 2);
  turretGeo.translate(0, 0.76, 0);
  const turretBody = new THREE.Mesh(turretGeo, armorMat);
  turretBody.castShadow = true;

  const mantlet = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.54, 0.62), darkSteelMat);
  mantlet.position.set(0, 0.38, -2.25);
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.105, 0.145, 5.4, 16), darkSteelMat);
  barrel.rotation.x = Math.PI / 2;
  barrel.position.set(0, 0.38, -4.65);
  barrel.castShadow = true;
  const evacuator = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.19, 0.92, 16), armorMat);
  evacuator.rotation.x = Math.PI / 2;
  evacuator.position.set(0, 0.38, -3.7);
  const muzzleRef = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.24, 0.08), darkSteelMat);
  muzzleRef.position.set(0, 0.54, -7.25);
  const citv = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.26, 0.34, 14), darkSteelMat);
  citv.position.set(-0.72, 0.94, -0.95);
  const optic = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.22, 0.26), opticsMat);
  optic.position.set(0.68, 0.92, -1.15);
  const mg50 = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.045, 1.35, 8), darkSteelMat);
  mg50.rotation.x = Math.PI / 2;
  mg50.position.set(0.88, 1.08, -0.45);
  const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.028, 2.5, 6), darkSteelMat);
  antenna.position.set(-1.05, 1.95, 1.45);
  turretPivot.add(turretBody, mantlet, barrel, evacuator, muzzleRef, citv, optic, mg50, antenna);
  tank.add(turretPivot);
  tank.userData.turret = turretPivot;

  const exhaustGlow = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.34, 0.14), new THREE.MeshBasicMaterial({ color: 0xf97316 }));
  exhaustGlow.position.set(0, 0.92, 3.38);
  tank.add(exhaustGlow);
  return tank;
}

export function createDetailedMechModel(accentHex: number): THREE.Group {
  const mech = new THREE.Group();
  const skinTex = createAircraftSkinTextures();
  const hullMat = new THREE.MeshPhysicalMaterial({
    color: 0x263549,
    map: skinTex.map,
    bumpMap: skinTex.bumpMap,
    bumpScale: 0.025,
    roughnessMap: skinTex.roughnessMap,
    roughness: 0.28,
    metalness: 0.84,
    clearcoat: 0.65,
  });
  const plateMat = new THREE.MeshPhysicalMaterial({
    color: 0x475569,
    map: skinTex.map,
    bumpMap: skinTex.bumpMap,
    bumpScale: 0.02,
    roughness: 0.34,
    metalness: 0.78,
  });
  const glowMat = new THREE.MeshBasicMaterial({ color: accentHex });
  const gunMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.28, metalness: 0.92 });

  const torso = new THREE.Mesh(new THREE.BoxGeometry(2.65, 2.25, 2.05), hullMat);
  torso.position.set(0, 3.85, 0);
  torso.castShadow = true;
  const chestPlate = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.35, 0.45), plateMat);
  chestPlate.position.set(0, 4.0, -1.05);
  chestPlate.rotation.x = -0.18;
  const chestCore = new THREE.Mesh(new THREE.OctahedronGeometry(0.46, 1), glowMat);
  chestCore.position.set(0, 3.92, -1.25);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.98, 0.72, 1.05), plateMat);
  head.position.set(0, 5.26, -0.15);
  const visor = new THREE.Mesh(new THREE.BoxGeometry(0.86, 0.22, 0.16), glowMat);
  visor.position.set(0, 5.28, -0.68);
  const waist = new THREE.Mesh(new THREE.CylinderGeometry(0.82, 0.95, 0.8, 12), gunMat);
  waist.position.set(0, 2.55, 0);
  mech.add(torso, chestPlate, chestCore, head, visor, waist);

  for (const sx of [-1, 1]) {
    const pauldron = new THREE.Mesh(new THREE.BoxGeometry(1.05, 1.25, 1.75), plateMat);
    pauldron.position.set(sx * 1.82, 4.42, 0);
    pauldron.rotation.z = sx * -0.15;
    pauldron.castShadow = true;
    const railgun = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.48, 3.75), gunMat);
    railgun.position.set(sx * 1.92, 5.05, -1.25);
    const railGlow = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.12, 3.25), glowMat);
    railGlow.position.set(sx * 1.92, 5.05, -1.38);
    const jet = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.42, 1.25, 14), gunMat);
    jet.position.set(sx * 0.76, 3.88, 1.25);
    const flame = new THREE.Mesh(
      new THREE.ConeGeometry(0.28, 1.65, 12, 1, true),
      new THREE.MeshBasicMaterial({
        color: 0x38bdf8,
        transparent: true,
        opacity: 0.78,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
      })
    );
    flame.rotation.x = Math.PI;
    flame.position.set(sx * 0.76, 2.65, 1.25);
    mech.add(pauldron, railgun, railGlow, jet, flame);
  }

  const legs: THREE.Group[] = [];
  for (const sx of [-0.92, 0.92]) {
    const leg = new THREE.Group();
    leg.position.set(sx, 2.65, 0);
    const thigh = new THREE.Mesh(new THREE.BoxGeometry(0.76, 1.45, 0.92), plateMat);
    thigh.position.set(0, -0.65, 0);
    thigh.castShadow = true;
    const knee = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.38, 0.84, 12), gunMat);
    knee.rotation.z = Math.PI / 2;
    knee.position.set(0, -1.32, -0.15);
    const shin = new THREE.Mesh(new THREE.BoxGeometry(0.68, 1.42, 1.02), hullMat);
    shin.position.set(0, -1.92, 0.14);
    const foot = new THREE.Mesh(new THREE.BoxGeometry(1.02, 0.38, 1.65), gunMat);
    foot.position.set(0, -2.52, -0.18);
    leg.add(thigh, knee, shin, foot);
    mech.add(leg);
    legs.push(leg);
  }
  mech.userData.legs = legs;
  return mech;
}

export function createDetailedSubmarineModel(accentHex: number, rotorRegister: THREE.Object3D[]): THREE.Group {
  const sub = new THREE.Group();
  const skinTex = createAircraftSkinTextures();
  const hullMat = new THREE.MeshPhysicalMaterial({
    color: 0x1e3248,
    map: skinTex.map,
    bumpMap: skinTex.bumpMap,
    bumpScale: 0.028,
    roughnessMap: skinTex.roughnessMap,
    roughness: 0.22,
    metalness: 0.82,
    clearcoat: 0.88,
    clearcoatRoughness: 0.14,
  });
  const lowerKeelMat = new THREE.MeshPhysicalMaterial({
    color: 0x6b212a,
    roughness: 0.42,
    metalness: 0.35,
    clearcoat: 0.55,
  });
  const darkTrimMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.36, metalness: 0.88 });
  const brassMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.18, metalness: 0.96 });
  const glowMat = new THREE.MeshBasicMaterial({ color: accentHex });
  const sonarMat = new THREE.MeshBasicMaterial({ color: 0x22d3ee });

  // Main hydrodynamic pressure hull + red anti-fouling lower keel
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.95, 5.8, 18, 32), hullMat);
  body.rotation.x = Math.PI / 2;
  body.scale.set(1.08, 1, 0.92);
  body.castShadow = true;
  body.receiveShadow = true;
  sub.add(body);

  const keel = new THREE.Mesh(new THREE.CapsuleGeometry(0.86, 5.2, 12, 24), lowerKeelMat);
  keel.rotation.x = Math.PI / 2;
  keel.scale.set(1.02, 1, 0.62);
  keel.position.set(0, -0.34, 0.08);
  sub.add(keel);

  // Dorsal casing deck & acoustic bow sonar dome
  const deck = new THREE.Mesh(new THREE.BoxGeometry(0.88, 0.24, 5.3), darkTrimMat);
  deck.position.set(0, 0.82, 0.05);
  const sonarDome = new THREE.Mesh(new THREE.SphereGeometry(0.68, 18, 14), darkTrimMat);
  sonarDome.scale.set(1.05, 0.85, 1.35);
  sonarDome.position.set(0, -0.02, -3.28);
  const sonarRing = new THREE.Mesh(new THREE.TorusGeometry(0.56, 0.038, 10, 24), sonarMat);
  sonarRing.position.set(0, -0.02, -3.52);
  sub.add(deck, sonarDome, sonarRing);

  // Sculpted conning tower (sail), diving hydroplanes, radar mast & nav strobes
  const sail = new THREE.Mesh(new THREE.BoxGeometry(0.62, 1.56, 2.25), hullMat);
  sail.position.set(0, 1.24, -0.68);
  sail.castShadow = true;
  const sailNose = new THREE.Mesh(new THREE.CylinderGeometry(0.31, 0.31, 1.56, 16), hullMat);
  sailNose.position.set(0, 1.24, -1.8);
  const sailPlane = new THREE.Mesh(new THREE.BoxGeometry(2.85, 0.09, 0.64), hullMat);
  sailPlane.position.set(0, 1.36, -0.95);
  const periscope = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.068, 1.15, 12), brassMat);
  periscope.position.set(0, 2.38, -0.58);
  const radarMast = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.88, 10), darkTrimMat);
  radarMast.position.set(0, 2.22, -1.05);
  const viewport = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.2, 0.16), glowMat);
  viewport.position.set(0, 1.56, -2.06);
  const portNav = new THREE.Mesh(new THREE.SphereGeometry(0.08, 10, 10), new THREE.MeshBasicMaterial({ color: 0xef4444 }));
  portNav.position.set(-1.42, 1.38, -0.95);
  const stbdNav = new THREE.Mesh(new THREE.SphereGeometry(0.08, 10, 10), new THREE.MeshBasicMaterial({ color: 0x22c55e }));
  stbdNav.position.set(1.42, 1.38, -0.95);
  sub.add(sail, sailNose, sailPlane, periscope, radarMast, viewport, portNav, stbdNav);

  // Twin side torpedo launch pods with glowing ready indicators
  for (const sx of [-0.88, 0.88]) {
    const pod = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.2, 2.4, 12), darkTrimMat);
    pod.rotation.x = Math.PI / 2;
    pod.position.set(sx, -0.14, -1.45);
    const tubeGlow = new THREE.Mesh(new THREE.TorusGeometry(0.14, 0.03, 8, 16), glowMat);
    tubeGlow.position.set(sx, -0.14, -2.66);
    sub.add(pod, tubeGlow);
  }

  // Stern cruciform stabilizers + tapered tailcone
  const sternCrossV = new THREE.Mesh(new THREE.BoxGeometry(0.11, 2.22, 0.96), hullMat);
  sternCrossV.position.set(0, 0, 3.32);
  const sternCrossH = new THREE.Mesh(new THREE.BoxGeometry(2.45, 0.11, 0.96), hullMat);
  sternCrossH.position.set(0, 0, 3.32);
  sub.add(sternCrossV, sternCrossH);

  // Volumetric dual deep-sea searchlight cones
  for (const sx of [-0.46, 0.46]) {
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 10), new THREE.MeshBasicMaterial({ color: 0xe0f2fe }));
    lamp.position.set(sx, -0.1, -3.55);
    const beam = new THREE.Mesh(
      new THREE.ConeGeometry(1.85, 13.0, 20, 1, true),
      new THREE.MeshBasicMaterial({
        color: 0x38bdf8,
        transparent: true,
        opacity: 0.15,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        depthWrite: false,
      })
    );
    beam.rotation.x = Math.PI / 2;
    beam.position.set(sx, -0.1, -10.1);
    sub.add(lamp, beam);
  }

  // Pump-jet propulsor shroud + 7-blade bronze skewed screw + glowing cavitation hub
  const shroud = new THREE.Mesh(new THREE.TorusGeometry(0.72, 0.095, 14, 28), hullMat);
  shroud.position.set(0, 0, 3.92);
  const propGlow = new THREE.Mesh(
    new THREE.RingGeometry(0.28, 0.66, 24),
    new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.42,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false,
    })
  );
  propGlow.position.set(0, 0, 4.02);
  sub.add(shroud, propGlow);

  const prop = new THREE.Group();
  prop.position.set(0, 0, 3.92);
  prop.userData.axis = 'z';
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2;
    const bl = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.65, 0.055), brassMat);
    bl.rotation.z = a;
    bl.rotation.y = 0.28;
    bl.position.set(Math.sin(a) * 0.31, Math.cos(a) * 0.31, 0);
    prop.add(bl);
  }
  sub.add(prop);
  rotorRegister.push(prop);
  return sub;
}

export function createDetailedStarfighterModel(accentHex: number): THREE.Group {
  const ship = new THREE.Group();
  const skinTex = createAircraftSkinTextures();
  const hullMat = new THREE.MeshPhysicalMaterial({
    color: 0xe2e8f0,
    map: skinTex.map,
    bumpMap: skinTex.bumpMap,
    bumpScale: 0.022,
    roughnessMap: skinTex.roughnessMap,
    roughness: 0.28,
    metalness: 0.56,
    clearcoat: 0.58,
  });
  const redStripeMat = new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.32, metalness: 0.35 });
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.36, metalness: 0.85 });
  const canopyMat = new THREE.MeshPhysicalMaterial({ color: 0x060d1c, roughness: 0.04, metalness: 0.94, clearcoat: 1.0 });
  const engineGlowMat = new THREE.MeshBasicMaterial({
    color: accentHex,
    transparent: true,
    opacity: 0.88,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });

  const fuselage = new THREE.Mesh(new THREE.BoxGeometry(0.96, 0.74, 4.6), hullMat);
  fuselage.castShadow = true;
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.62, 3.4, 4), hullMat);
  nose.rotation.x = -Math.PI / 2;
  nose.rotation.y = Math.PI / 4;
  nose.position.set(0, 0, -3.95);
  const canopy = new THREE.Mesh(new THREE.CapsuleGeometry(0.32, 1.2, 8, 16), canopyMat);
  canopy.rotation.x = Math.PI / 2;
  canopy.position.set(0, 0.44, -0.5);
  const droid = new THREE.Mesh(
    new THREE.SphereGeometry(0.28, 16, 14),
    new THREE.MeshStandardMaterial({ color: 0x2563eb, roughness: 0.2, metalness: 0.78 })
  );
  droid.position.set(0, 0.48, 0.88);
  ship.add(fuselage, nose, canopy, droid);

  const flames: THREE.Mesh[] = [];
  const angles = [0.28, -0.28, Math.PI - 0.28, Math.PI + 0.28];
  for (let i = 0; i < 4; i++) {
    const a = angles[i];
    const dirX = Math.cos(a);
    const dirY = Math.sin(a);
    const wingGrp = new THREE.Group();
    wingGrp.rotation.z = a;
    const wing = new THREE.Mesh(new THREE.BoxGeometry(3.55, 0.085, 1.5), hullMat);
    wing.position.set(2.05, 0, 1.05);
    wing.castShadow = true;
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.76, 0.095, 1.54), redStripeMat);
    stripe.position.set(1.68, 0, 1.05);
    const cannon = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.075, 2.95, 10), darkMat);
    cannon.rotation.x = Math.PI / 2;
    cannon.position.set(3.82, 0, -0.2);
    const tip = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 8), new THREE.MeshBasicMaterial({ color: 0xff3b30 }));
    tip.position.set(3.82, 0, -1.7);
    wingGrp.add(wing, stripe, cannon, tip);
    ship.add(wingGrp);

    const eng = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.3, 1.75, 16), darkMat);
    eng.rotation.x = Math.PI / 2;
    eng.position.set(dirX * 0.82, dirY * 0.58, 1.55);
    const fl = new THREE.Mesh(new THREE.ConeGeometry(0.24, 2.6, 12), engineGlowMat);
    fl.rotation.x = Math.PI / 2;
    fl.position.set(dirX * 0.82, dirY * 0.58, 3.55);
    flames.push(fl);
    ship.add(eng, fl);
  }
  ship.userData.flames = flames;
  return ship;
}

export function createEnemyTargetModel(
  kind: 'drone' | 'fighter' | 'tank' | 'turret' | 'mine' | 'boss',
  accentHex: number
): THREE.Group {
  const enemy = new THREE.Group();
  const skinTex = createAircraftSkinTextures();
  const hullMat = new THREE.MeshPhysicalMaterial({
    color: kind === 'boss' ? 0x1e1b2e : kind === 'fighter' ? 0x263244 : 0x1f2937,
    map: skinTex.map,
    bumpMap: skinTex.bumpMap,
    bumpScale: 0.022,
    roughness: 0.28,
    metalness: 0.84,
    clearcoat: 0.55,
  });
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.35, metalness: 0.9 });
  const coreMat = new THREE.MeshBasicMaterial({ color: kind === 'boss' ? 0xff2255 : 0xf43f5e });
  const ringMat = new THREE.MeshBasicMaterial({ color: accentHex, transparent: true, opacity: 0.8, side: THREE.DoubleSide });

  if (kind === 'boss') {
    const core = new THREE.Mesh(new THREE.OctahedronGeometry(2.8, 1), hullMat);
    const reactor = new THREE.Mesh(new THREE.SphereGeometry(1.35, 20, 18), coreMat);
    const ring1 = new THREE.Mesh(new THREE.TorusGeometry(4.3, 0.3, 14, 36), hullMat);
    const ring2 = new THREE.Mesh(new THREE.TorusGeometry(5.1, 0.1, 10, 40), ringMat);
    const wingL = new THREE.Mesh(new THREE.BoxGeometry(8.4, 0.52, 2.8), hullMat);
    wingL.position.set(0, 0, 0.4);
    for (const sx of [-3.6, 3.6]) {
      const pod = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.55, 3.6, 12), darkMat);
      pod.rotation.x = Math.PI / 2;
      pod.position.set(sx, -0.35, 0.2);
      enemy.add(pod);
    }
    enemy.add(core, reactor, ring1, ring2, wingL);
  } else if (kind === 'fighter') {
    const fuse = new THREE.Mesh(new THREE.ConeGeometry(0.68, 4.4, 8), hullMat);
    fuse.rotation.x = Math.PI / 2;
    fuse.scale.set(1.25, 1.0, 0.65);
    const canopy = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.24, 0.85, 8, 14),
      new THREE.MeshPhysicalMaterial({ color: 0x111827, roughness: 0.05, metalness: 0.95, clearcoat: 1.0 })
    );
    canopy.rotation.x = Math.PI / 2;
    canopy.position.set(0, 0.32, 0.45);
    const wingShape = new THREE.Shape();
    wingShape.moveTo(0, -1.6);
    wingShape.lineTo(2.7, 0.6);
    wingShape.lineTo(2.7, 1.2);
    wingShape.lineTo(0, 1.3);
    wingShape.closePath();
    const wGeoR = new THREE.ExtrudeGeometry(wingShape, { depth: 0.08, bevelEnabled: false });
    wGeoR.rotateX(Math.PI / 2);
    const wGeoL = wGeoR.clone();
    wGeoL.scale(-1, 1, 1);
    const wingR = new THREE.Mesh(wGeoR, hullMat);
    const wingL = new THREE.Mesh(wGeoL, hullMat);
    for (const sx of [-0.45, 0.45]) {
      const tail = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.92, 0.85), darkMat);
      tail.position.set(sx * 1.4, 0.46, -1.35);
      tail.rotation.z = sx > 0 ? -0.35 : 0.35;
      const burner = new THREE.Mesh(new THREE.ConeGeometry(0.2, 1.65, 10), coreMat);
      burner.rotation.x = -Math.PI / 2;
      burner.position.set(sx, -0.02, -2.55);
      enemy.add(tail, burner);
    }
    enemy.add(fuse, canopy, wingL, wingR);
  } else if (kind === 'tank') {
    const chassis = new THREE.Mesh(new THREE.BoxGeometry(3.0, 1.15, 4.5), hullMat);
    const turret = new THREE.Mesh(new THREE.BoxGeometry(2.05, 0.78, 2.4), hullMat);
    turret.position.y = 0.92;
    const gun = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.12, 3.6, 12), darkMat);
    gun.rotation.x = Math.PI / 2;
    gun.position.set(0, 0.94, 2.4);
    const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.38, 12, 12), coreMat);
    beacon.position.y = 1.56;
    enemy.add(chassis, turret, gun, beacon);
  } else if (kind === 'mine') {
    const sphere = new THREE.Mesh(new THREE.IcosahedronGeometry(1.25, 1), hullMat);
    const core = new THREE.Mesh(new THREE.SphereGeometry(0.55, 12, 12), coreMat);
    for (let s = 0; s < 6; s++) {
      const spike = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.72, 8), darkMat);
      if (s === 0) spike.position.set(0, 1.45, 0);
      if (s === 1) { spike.position.set(0, -1.45, 0); spike.rotation.x = Math.PI; }
      if (s === 2) { spike.position.set(1.45, 0, 0); spike.rotation.z = -Math.PI / 2; }
      if (s === 3) { spike.position.set(-1.45, 0, 0); spike.rotation.z = Math.PI / 2; }
      if (s === 4) { spike.position.set(0, 0, 1.45); spike.rotation.x = Math.PI / 2; }
      if (s === 5) { spike.position.set(0, 0, -1.45); spike.rotation.x = -Math.PI / 2; }
      enemy.add(spike);
    }
    enemy.add(sphere, core);
  } else if (kind === 'turret') {
    const base = new THREE.Mesh(new THREE.CylinderGeometry(1.35, 1.7, 1.3, 10), hullMat);
    const head = new THREE.Mesh(new THREE.BoxGeometry(1.75, 0.95, 2.0), hullMat);
    head.position.y = 1.05;
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.42, 12, 12), coreMat);
    eye.position.set(0, 1.05, 1.02);
    enemy.add(base, head, eye);
  } else {
    const body = new THREE.Mesh(new THREE.OctahedronGeometry(1.2, 0), hullMat);
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.5, 14, 14), coreMat);
    const wing = new THREE.Mesh(new THREE.TorusGeometry(1.7, 0.12, 10, 24), hullMat);
    enemy.add(body, eye, wing);
  }

  const lockRing = new THREE.Mesh(
    new THREE.RingGeometry(kind === 'boss' ? 5.2 : 2.15, kind === 'boss' ? 5.48 : 2.34, 28),
    new THREE.MeshBasicMaterial({ color: 0xf43f5e, transparent: true, opacity: 0.74, side: THREE.DoubleSide })
  );
  enemy.add(lockRing);
  enemy.userData.lockRing = lockRing;
  return enemy;
}

/** Procedural PBR texture for underwater volcanic coral reefs & hydrothermal rock formations. */
export function createUnderwaterCoralReefTexture(maxAnisotropy = 4): {
  map: THREE.CanvasTexture;
  emissiveMap: THREE.CanvasTexture;
} {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 512;
  const ctx = c.getContext('2d')!;
  const grad = ctx.createLinearGradient(0, 0, 0, 512);
  grad.addColorStop(0, '#0f4c5c');
  grad.addColorStop(0.35, '#134e4a');
  grad.addColorStop(0.7, '#112a3a');
  grad.addColorStop(1, '#081726');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 512, 512);

  // Organic mineral strata & coral polyps
  for (let i = 0; i < 420; i++) {
    const x = (i * 73) % 512;
    const y = (i * 139) % 512;
    const r = 6 + (i % 24);
    ctx.fillStyle =
      i % 5 === 0
        ? 'rgba(45, 212, 191, 0.24)'
        : i % 7 === 0
          ? 'rgba(244, 114, 182, 0.22)'
          : i % 3 === 0
            ? 'rgba(15, 23, 42, 0.38)'
            : 'rgba(14, 116, 144, 0.26)';
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // Emissive bioluminescent coral veins
  const ec = document.createElement('canvas');
  ec.width = 512;
  ec.height = 512;
  const ectx = ec.getContext('2d')!;
  ectx.fillStyle = '#000000';
  ectx.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 90; i++) {
    const x = (i * 97 + 19) % 512;
    const y = (i * 151 + 41) % 440;
    const r = 4 + (i % 10);
    const rg = ectx.createRadialGradient(x, y, 0, x, y, r * 2.2);
    const col = i % 3 === 0 ? 'rgba(34,211,238,0.85)' : i % 3 === 1 ? 'rgba(52,211,153,0.75)' : 'rgba(244,114,182,0.7)';
    rg.addColorStop(0, col);
    rg.addColorStop(1, 'rgba(0,0,0,0)');
    ectx.fillStyle = rg;
    ectx.beginPath();
    ectx.arc(x, y, r * 2.2, 0, Math.PI * 2);
    ectx.fill();
  }

  const map = new THREE.CanvasTexture(c);
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = maxAnisotropy;

  const emissiveMap = new THREE.CanvasTexture(ec);
  emissiveMap.wrapS = emissiveMap.wrapT = THREE.RepeatWrapping;
  emissiveMap.colorSpace = THREE.SRGBColorSpace;
  emissiveMap.anisotropy = maxAnisotropy;

  return { map, emissiveMap };
}

/** Procedural stratified red-sandstone desert mesa texture for Dakar, Tank Blitz, F-22 & AC-130 canyons. */
export function createDesertMesaTexture(maxAnisotropy = 4): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 512;
  const ctx = c.getContext('2d')!;
  const bands = ['#6d3b27', '#9c5233', '#b86d43', '#8a482c', '#c98856', '#7b422a', '#a95f3a', '#5d3221'];
  for (let y = 0; y < 512; y += 8) {
    ctx.fillStyle = bands[(y / 8) % bands.length];
    ctx.fillRect(0, y, 512, 9);
  }
  for (let i = 0; i < 650; i++) {
    const x = (i * 83) % 512;
    const y = (i * 127) % 512;
    ctx.fillStyle = i % 2 === 0 ? 'rgba(255,220,180,0.12)' : 'rgba(42,18,10,0.22)';
    ctx.fillRect(x, y, 16 + (i % 34), 3 + (i % 5));
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

/** Procedural snow-capped alpine granite mountain texture for Snow Rally WRC. */
export function createAlpineSnowPeakTexture(maxAnisotropy = 4): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 512;
  const ctx = c.getContext('2d')!;
  const grad = ctx.createLinearGradient(0, 0, 0, 512);
  grad.addColorStop(0, '#f8fafc');
  grad.addColorStop(0.32, '#e2e8f0');
  grad.addColorStop(0.58, '#64748b');
  grad.addColorStop(0.78, '#334155');
  grad.addColorStop(1, '#1e293b');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 320; i++) {
    const x = (i * 67) % 512;
    const y = 120 + ((i * 109) % 360);
    ctx.fillStyle = i % 3 === 0 ? 'rgba(241,245,249,0.42)' : 'rgba(15,23,42,0.28)';
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + 28, y + 48);
    ctx.lineTo(x - 16, y + 42);
    ctx.closePath();
    ctx.fill();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

/** Hero Naval Battleship (Iowa / Yamato-class) with teak deck, triple-barrel 460mm turrets & radar pagoda. */
export function createDetailedBattleshipModel(accentHex: number, rotorRegister: THREE.Object3D[]): THREE.Group {
  const ship = new THREE.Group();
  const skinTex = createAircraftSkinTextures();
  const steelMat = new THREE.MeshPhysicalMaterial({
    color: 0x475569,
    map: skinTex.map,
    bumpMap: skinTex.bumpMap,
    bumpScale: 0.025,
    roughness: 0.36,
    metalness: 0.78,
    clearcoat: 0.38,
  });
  const hullRedMat = new THREE.MeshStandardMaterial({ color: 0x7f1d1d, roughness: 0.52, metalness: 0.35 });
  const deckWoodMat = new THREE.MeshStandardMaterial({ color: 0x92623a, roughness: 0.76, metalness: 0.12 });
  const gunMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.28, metalness: 0.92 });
  const glowMat = new THREE.MeshBasicMaterial({ color: accentHex });

  // Sculpted armored hull + waterline keel + teak main deck
  const mainHull = new THREE.Mesh(new THREE.BoxGeometry(3.3, 1.35, 11.4), steelMat);
  mainHull.position.set(0, 0.72, 0);
  mainHull.castShadow = true;
  mainHull.receiveShadow = true;
  const bow = new THREE.Mesh(new THREE.ConeGeometry(2.35, 4.4, 4), steelMat);
  bow.rotation.x = -Math.PI / 2;
  bow.rotation.y = Math.PI / 4;
  bow.scale.set(1.0, 1.0, 0.42);
  bow.position.set(0, 0.78, -7.8);
  const keelRed = new THREE.Mesh(new THREE.BoxGeometry(3.42, 0.48, 12.2), hullRedMat);
  keelRed.position.set(0, 0.12, -0.4);
  const deck = new THREE.Mesh(new THREE.BoxGeometry(3.12, 0.12, 11.2), deckWoodMat);
  deck.position.set(0, 1.44, 0);
  ship.add(mainHull, bow, keelRed, deck);

  // Pagoda bridge superstructure + funnel + spinning radar mast
  const bridgeBase = new THREE.Mesh(new THREE.BoxGeometry(2.05, 1.65, 3.6), steelMat);
  bridgeBase.position.set(0, 2.25, 0.8);
  const bridgeTop = new THREE.Mesh(new THREE.BoxGeometry(1.45, 1.35, 2.1), steelMat);
  bridgeTop.position.set(0, 3.65, 0.5);
  const bridgeWindows = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.24, 0.42), glowMat);
  bridgeWindows.position.set(0, 3.92, -0.42);
  const funnel = new THREE.Mesh(new THREE.CylinderGeometry(0.48, 0.62, 2.35, 14), gunMat);
  funnel.rotation.x = 0.18;
  funnel.position.set(0, 3.2, 2.25);
  const radar = new THREE.Group();
  radar.position.set(0, 4.75, 0.5);
  radar.userData.axis = 'y';
  const dish = new THREE.Mesh(new THREE.BoxGeometry(1.65, 0.22, 0.16), gunMat);
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.14, 0.9, 10), gunMat);
  mast.position.y = -0.35;
  radar.add(dish, mast);
  rotorRegister.push(radar);
  ship.add(bridgeBase, bridgeTop, bridgeWindows, funnel, radar);

  // 2 Forward & 1 Aft Triple-Barrel 460mm Main Battery Turrets
  const buildTurret = (y: number, z: number, facingBack = false) => {
    const t = new THREE.Group();
    t.position.set(0, y, z);
    if (facingBack) t.rotation.y = Math.PI;
    const housing = new THREE.Mesh(new THREE.BoxGeometry(1.58, 0.68, 1.72), steelMat);
    t.add(housing);
    for (const gx of [-0.42, 0, 0.42]) {
      const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.11, 2.85, 10), gunMat);
      barrel.rotation.x = Math.PI / 2 - 0.14;
      barrel.position.set(gx, 0.14, -1.75);
      t.add(barrel);
    }
    return t;
  };
  ship.add(buildTurret(1.78, -4.45, false));
  ship.add(buildTurret(2.22, -2.35, false));
  ship.add(buildTurret(1.78, 4.35, true));

  // Glowing stern wake wash
  const wake = new THREE.Mesh(
    new THREE.PlaneGeometry(3.2, 7.5),
    new THREE.MeshBasicMaterial({
      color: 0xe0f2fe,
      transparent: true,
      opacity: 0.45,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false,
    })
  );
  wake.rotation.x = -Math.PI / 2;
  wake.position.set(0, 0.08, 9.4);
  ship.add(wake);

  return ship;
}

/** Hero AC-130J Ghostrider Heavy Gunship with 4 spinning turboprops, high wings & side-firing 105mm/30mm cannons. */
export function createDetailedGunshipModel(accentHex: number, rotorRegister: THREE.Object3D[]): THREE.Group {
  const gunship = new THREE.Group();
  const skinTex = createAircraftSkinTextures();
  const hullMat = new THREE.MeshPhysicalMaterial({
    color: 0x334155,
    map: skinTex.map,
    bumpMap: skinTex.bumpMap,
    bumpScale: 0.024,
    roughness: 0.36,
    metalness: 0.68,
    clearcoat: 0.42,
  });
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.35, metalness: 0.9 });
  const glassMat = new THREE.MeshPhysicalMaterial({ color: 0x061020, roughness: 0.05, metalness: 0.95, clearcoat: 1.0 });
  const glowMat = new THREE.MeshBasicMaterial({ color: accentHex });

  const fuselage = new THREE.Mesh(new THREE.CapsuleGeometry(0.92, 6.2, 14, 24), hullMat);
  fuselage.rotation.x = Math.PI / 2;
  fuselage.castShadow = true;
  const cockpit = new THREE.Mesh(new THREE.BoxGeometry(1.18, 0.44, 0.95), glassMat);
  cockpit.position.set(0, 0.36, -3.35);
  const flirBall = new THREE.Mesh(new THREE.SphereGeometry(0.28, 12, 12), darkMat);
  flirBall.position.set(0, -0.78, -2.95);
  const flirLens = new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 10), glowMat);
  flirLens.position.set(0, -0.82, -3.18);
  gunship.add(fuselage, cockpit, flirBall, flirLens);

  // High tactical transport wings + T-tail
  const wing = new THREE.Mesh(new THREE.BoxGeometry(11.8, 0.22, 1.95), hullMat);
  wing.position.set(0, 0.72, -0.35);
  wing.castShadow = true;
  const vTail = new THREE.Mesh(new THREE.BoxGeometry(0.22, 2.65, 1.75), hullMat);
  vTail.position.set(0, 1.58, 3.15);
  const hTail = new THREE.Mesh(new THREE.BoxGeometry(4.6, 0.16, 1.05), hullMat);
  hTail.position.set(0, 0.65, 3.35);
  gunship.add(wing, vTail, hTail);

  // 4 Wing-mounted turboprop nacelles with spinning 6-blade props
  for (const ex of [-4.1, -2.2, 2.2, 4.1]) {
    const nac = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.3, 1.85, 12), darkMat);
    nac.rotation.x = Math.PI / 2;
    nac.position.set(ex, 0.56, -0.75);
    const prop = new THREE.Group();
    prop.position.set(ex, 0.56, -1.72);
    prop.userData.axis = 'z';
    for (let b = 0; b < 4; b++) {
      const blade = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.45, 0.04), darkMat);
      blade.rotation.z = (b / 4) * Math.PI;
      prop.add(blade);
    }
    const disc = new THREE.Mesh(
      new THREE.RingGeometry(0.18, 0.74, 18),
      new THREE.MeshBasicMaterial({ color: 0x94a3b8, transparent: true, opacity: 0.22, side: THREE.DoubleSide })
    );
    prop.add(disc);
    rotorRegister.push(prop);
    gunship.add(nac, prop);
  }

  // Twin side-mounted heavy 105mm howitzer & 30mm autocannon barrels
  for (const gz of [-1.2, 0.6]) {
    const cannon = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.12, 1.85, 10), darkMat);
    cannon.rotation.z = Math.PI / 2;
    cannon.position.set(-1.32, -0.25, gz);
    gunship.add(cannon);
  }
  return gunship;
}

/** Hero Twin-Rotor Volcanic Heavy Chinook Helicopter with sculpted fuselage silhouette, twin turbine pods & tandem rotors. */
export function createDetailedChinookModel(accentHex: number, rotorRegister: THREE.Object3D[]): THREE.Group {
  const heli = new THREE.Group();
  const skinTex = createAircraftSkinTextures();
  const bodyMat = new THREE.MeshPhysicalMaterial({
    color: 0x3d4c3b,
    map: skinTex.map,
    bumpMap: skinTex.bumpMap,
    bumpScale: 0.024,
    roughnessMap: skinTex.roughnessMap,
    roughness: 0.36,
    metalness: 0.62,
    clearcoat: 0.42,
  });
  const rescueOrangeMat = new THREE.MeshStandardMaterial({ color: 0xf97316, roughness: 0.28, metalness: 0.35 });
  const rescueWhiteMat = new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.32, metalness: 0.22 });
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.34, metalness: 0.88 });
  const glassMat = new THREE.MeshPhysicalMaterial({
    color: 0x071324,
    emissive: 0x0ea5e9,
    emissiveIntensity: 0.12,
    roughness: 0.04,
    metalness: 0.94,
    clearcoat: 1.0,
  });
  const exhaustGlowMat = new THREE.MeshBasicMaterial({ color: 0xfb923c });

  // Sculpted CH-47 Chinook side silhouette (tapered cockpit nose -> long dorsal spine -> upswept rear ramp)
  const hullShape = new THREE.Shape();
  hullShape.moveTo(-3.45, -0.25);
  hullShape.lineTo(-3.2, 0.38);
  hullShape.lineTo(-2.35, 0.82);
  hullShape.lineTo(-1.45, 0.86);
  hullShape.lineTo(2.15, 0.92);
  hullShape.lineTo(3.25, 1.32);
  hullShape.lineTo(3.45, 0.35);
  hullShape.lineTo(2.2, -0.58);
  hullShape.lineTo(-2.55, -0.64);
  hullShape.lineTo(-3.25, -0.45);
  hullShape.closePath();

  const hullGeo = new THREE.ExtrudeGeometry(hullShape, {
    depth: 1.42,
    bevelEnabled: true,
    bevelThickness: 0.16,
    bevelSize: 0.14,
    bevelSegments: 3,
  });
  hullGeo.rotateY(Math.PI / 2);
  hullGeo.translate(-0.71, 0.05, 0);
  const fuselage = new THREE.Mesh(hullGeo, bodyMat);
  fuselage.castShadow = true;
  fuselage.receiveShadow = true;
  heli.add(fuselage);

  // Dorsal spine fairing & upswept rear pylon fin
  const spine = new THREE.Mesh(new THREE.CapsuleGeometry(0.42, 4.1, 8, 16), bodyMat);
  spine.rotation.x = Math.PI / 2;
  spine.scale.set(1.05, 1.0, 0.65);
  spine.position.set(0, 0.96, 0.25);
  const rearPylonShape = new THREE.Shape();
  rearPylonShape.moveTo(1.5, 0.72);
  rearPylonShape.lineTo(2.45, 1.98);
  rearPylonShape.lineTo(3.25, 1.92);
  rearPylonShape.lineTo(3.3, 0.82);
  rearPylonShape.closePath();
  const rearPylonGeo = new THREE.ExtrudeGeometry(rearPylonShape, {
    depth: 0.56,
    bevelEnabled: true,
    bevelThickness: 0.08,
    bevelSize: 0.06,
    bevelSegments: 2,
  });
  rearPylonGeo.rotateY(Math.PI / 2);
  rearPylonGeo.translate(-0.28, 0, 0);
  const rearPylon = new THREE.Mesh(rearPylonGeo, bodyMat);
  rearPylon.castShadow = true;
  heli.add(spine, rearPylon);

  // Glazed cockpit nose canopy + Search-and-Rescue high-vis fuselage stripes
  const canopy = new THREE.Mesh(new THREE.CapsuleGeometry(0.46, 0.78, 10, 18), glassMat);
  canopy.rotation.x = Math.PI / 2 - 0.36;
  canopy.scale.set(1.36, 1.0, 0.75);
  canopy.position.set(0, 0.36, -2.92);
  const chinGlass = new THREE.Mesh(new THREE.SphereGeometry(0.46, 14, 12), glassMat);
  chinGlass.scale.set(1.22, 0.68, 1.15);
  chinGlass.position.set(0, -0.22, -3.28);
  const sarStripeOrange = new THREE.Mesh(new THREE.BoxGeometry(1.78, 0.16, 4.6), rescueOrangeMat);
  sarStripeOrange.position.set(0, 0.08, -0.15);
  const sarStripeWhite = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.08, 4.55), rescueWhiteMat);
  sarStripeWhite.position.set(0, 0.2, -0.15);
  heli.add(canopy, chinGlass, sarStripeOrange, sarStripeWhite);

  // Contoured side fuel sponsons, quad landing gear struts & external twin T55 turbine nacelles
  for (const sx of [-1, 1]) {
    const sponson = new THREE.Mesh(new THREE.CapsuleGeometry(0.28, 3.85, 8, 14), bodyMat);
    sponson.rotation.x = Math.PI / 2;
    sponson.scale.set(0.95, 1.0, 0.85);
    sponson.position.set(sx * 0.98, -0.34, 0.2);
    const nacelle = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.29, 2.05, 16), darkMat);
    nacelle.rotation.x = Math.PI / 2;
    nacelle.position.set(sx * 0.84, 0.94, 2.18);
    const intake = new THREE.Mesh(new THREE.TorusGeometry(0.23, 0.04, 8, 18), rescueWhiteMat);
    intake.position.set(sx * 0.84, 0.94, 1.15);
    const exhaust = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.24, 0.45, 12), darkMat);
    exhaust.rotation.x = Math.PI / 2 + 0.14;
    exhaust.position.set(sx * 0.84, 0.96, 3.25);
    const exhaustCore = new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 10), exhaustGlowMat);
    exhaustCore.position.set(sx * 0.84, 0.98, 3.4);
    heli.add(sponson, nacelle, intake, exhaust, exhaustCore);

    // Dual landing gear wheels (fore & aft)
    for (const gz of [-1.7, 1.85]) {
      const strut = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.46, 8), darkMat);
      strut.position.set(sx * 0.96, -0.68, gz);
      const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.16, 14), darkMat);
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(sx * 0.96, -0.88, gz);
      heli.add(strut, wheel);
    }
  }

  // Belly rescue searchlight & beacon
  const searchlight = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 10), new THREE.MeshBasicMaterial({ color: 0xfef08a }));
  searchlight.position.set(0, -0.64, -2.4);
  const navBeacon = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 8), new THREE.MeshBasicMaterial({ color: accentHex }));
  navBeacon.position.set(0, 1.48, 0.2);
  heli.add(searchlight, navBeacon);

  // Tandem counter-rotating 3-blade airfoil rotor masts & hubs
  for (const [rz, ry, dir] of [[-2.05, 1.42, 1], [2.75, 2.04, -1]] as [number, number, number][]) {
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.18, 0.56, 12), darkMat);
    mast.position.set(0, ry - 0.24, rz);
    heli.add(mast);

    const rotor = new THREE.Group();
    rotor.position.set(0, ry, rz);
    rotor.userData.axis = 'y';
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.28, 0.16, 12), rescueOrangeMat);
    rotor.add(hub);
    for (let b = 0; b < 3; b++) {
      const ang = (b / 3) * Math.PI * 2;
      const bladeWrap = new THREE.Group();
      bladeWrap.rotation.y = ang;
      const blade = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.032, 2.55), darkMat);
      blade.position.z = 1.32;
      const tip = new THREE.Mesh(new THREE.BoxGeometry(0.165, 0.036, 0.28), rescueOrangeMat);
      tip.position.z = 2.48;
      bladeWrap.add(blade, tip);
      rotor.add(bladeWrap);
    }
    const disc = new THREE.Mesh(
      new THREE.RingGeometry(0.45, 2.62, 32),
      new THREE.MeshBasicMaterial({ color: 0xe2e8f0, transparent: true, opacity: 0.085, side: THREE.DoubleSide, depthWrite: false })
    );
    disc.rotation.x = -Math.PI / 2;
    rotor.add(disc);
    rotor.userData.dir = dir;
    rotorRegister.push(rotor);
    heli.add(rotor);
  }
  return heli;
}

/** Hero Futuristic Cyber Hoverbike (Sleek Akira/Tron Light-Cycle with low aero silhouette & open chase sightline). */
export function createDetailedHoverbikeModel(accentHex: number): THREE.Group {
  const bike = new THREE.Group();
  const bodyMat = new THREE.MeshPhysicalMaterial({
    color: 0x111827,
    roughness: 0.16,
    metalness: 0.88,
    clearcoat: 1.0,
    clearcoatRoughness: 0.06,
  });
  const titaniumMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.26, metalness: 0.9 });
  const neonMat = new THREE.MeshBasicMaterial({ color: accentHex });
  const visorMat = new THREE.MeshPhysicalMaterial({
    color: 0x040b18,
    emissive: accentHex,
    emissiveIntensity: 0.35,
    roughness: 0.04,
    metalness: 0.96,
    clearcoat: 1.0,
  });

  // Razor-sharp sculpted monocoque side frame (ExtrudeGeometry) — sleek low stance so center camera view is wide open!
  const frameShape = new THREE.Shape();
  frameShape.moveTo(-1.82, 0.34);
  frameShape.lineTo(-1.12, 0.96);
  frameShape.lineTo(0.15, 0.84);
  frameShape.lineTo(1.62, 0.98);
  frameShape.lineTo(1.75, 0.56);
  frameShape.lineTo(0.55, 0.24);
  frameShape.lineTo(-1.35, 0.22);
  frameShape.closePath();

  const frameGeo = new THREE.ExtrudeGeometry(frameShape, {
    depth: 0.44,
    bevelEnabled: true,
    bevelThickness: 0.08,
    bevelSize: 0.06,
    bevelSegments: 3,
  });
  frameGeo.rotateY(Math.PI / 2);
  frameGeo.translate(-0.22, 0.06, 0);
  const chassis = new THREE.Mesh(frameGeo, bodyMat);
  chassis.castShadow = true;

  const windscreen = new THREE.Mesh(new THREE.CapsuleGeometry(0.18, 0.52, 8, 14), visorMat);
  windscreen.rotation.x = 1.05;
  windscreen.scale.set(1.22, 1.0, 0.55);
  windscreen.position.set(0, 0.98, -1.02);

  // Tucked aerodynamic cyber-rider leaning low forward over the tank (compact profile!)
  const riderTorso = new THREE.Mesh(new THREE.CapsuleGeometry(0.18, 0.58, 8, 12), titaniumMat);
  riderTorso.rotation.x = Math.PI / 2 - 0.22;
  riderTorso.scale.set(1.18, 1.0, 0.72);
  riderTorso.position.set(0, 1.04, 0.05);
  const spineNeon = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.05, 0.54), neonMat);
  spineNeon.rotation.x = -0.22;
  spineNeon.position.set(0, 1.15, 0.08);
  const riderHelmet = new THREE.Mesh(new THREE.SphereGeometry(0.17, 14, 14), bodyMat);
  riderHelmet.scale.set(0.92, 0.88, 1.18);
  riderHelmet.position.set(0, 1.16, -0.45);
  const helmetVisor = new THREE.Mesh(new THREE.TorusGeometry(0.135, 0.025, 8, 18, Math.PI), neonMat);
  helmetVisor.rotation.x = Math.PI / 2;
  helmetVisor.rotation.z = Math.PI;
  helmetVisor.position.set(0, 1.16, -0.5);
  bike.add(chassis, windscreen, riderTorso, spineNeon, riderHelmet, helmetVisor);

  // Twin side aero winglets, fork shrouds & rear plasma thruster exhaust cones
  for (const sx of [-1, 1]) {
    const strip = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.06, 2.35), neonMat);
    strip.position.set(sx * 0.3, 0.72, -0.05);
    const winglet = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.04, 0.38), titaniumMat);
    winglet.position.set(sx * 0.38, 0.82, -1.08);
    winglet.rotation.z = sx * -0.18;
    const thruster = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.11, 0.65, 12), titaniumMat);
    thruster.rotation.x = Math.PI / 2 - 0.12;
    thruster.position.set(sx * 0.2, 0.82, 1.56);
    const afterburner = new THREE.Mesh(
      new THREE.ConeGeometry(0.08, 0.68, 10),
      new THREE.MeshBasicMaterial({
        color: accentHex,
        transparent: true,
        opacity: 0.78,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    afterburner.rotation.x = Math.PI / 2;
    afterburner.position.set(sx * 0.2, 0.8, 2.12);
    bike.add(strip, winglet, thruster, afterburner);
  }

  // Sleek hubless plasma wheels with inner metallic cowls & thin neon arc rings
  for (const wz of [-1.42, 1.44]) {
    const tire = new THREE.Mesh(new THREE.TorusGeometry(0.46, 0.11, 14, 30), bodyMat);
    tire.rotation.y = Math.PI / 2;
    tire.position.set(0, 0.48, wz);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.41, 0.03, 10, 28), neonMat);
    rim.rotation.y = Math.PI / 2;
    rim.position.set(0, 0.48, wz);
    bike.add(tire, rim);
  }

  // Tail brake bar + sleek translucent energy wake ribbon
  const tailBar = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.06, 0.06), new THREE.MeshBasicMaterial({ color: 0xff2a55 }));
  tailBar.position.set(0, 0.94, 1.72);
  const lightWall = new THREE.Mesh(
    new THREE.PlaneGeometry(1, 0.46),
    new THREE.MeshBasicMaterial({
      color: accentHex,
      transparent: true,
      opacity: 0.48,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false,
    })
  );
  lightWall.rotation.y = Math.PI / 2;
  lightWall.scale.set(22, 1, 1);
  lightWall.position.set(0, 0.42, 12.6);
  bike.add(tailBar, lightWall);

  return bike;
}



