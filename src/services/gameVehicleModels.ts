import * as THREE from 'three';

export type VehicleStyle =
  | 'formula_gp'
  | 'drift_touge'
  | 'maglev_track'
  | 'dakar_rally'
  | 'bugatti_hypercar'
  | 'corridor';

export type FlightStyle = 'f22_jet' | 'sr71_plane' | 'apache_heli';

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
  const size = 512;
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
  } else {
    // High-rise glass skyscraper / cyber-megastructure curtain wall + illuminated office windows
    ctx.fillStyle = '#09111e';
    ctx.fillRect(0, 0, size, size);
    rctx.fillStyle = '#242424'; // reflective glass panes
    rctx.fillRect(0, 0, size, size);
    bctx.fillStyle = '#909090';
    bctx.fillRect(0, 0, size, size);
    ectx.fillStyle = '#000000';
    ectx.fillRect(0, 0, size, size);

    // Metallic structural mullions
    ctx.fillStyle = '#1e293b';
    rctx.fillStyle = '#5c5c5c';
    bctx.fillStyle = '#d8d8d8';
    for (let x = 0; x < size; x += 32) {
      ctx.fillRect(x, 0, 5, size);
      rctx.fillRect(x, 0, 5, size);
      bctx.fillRect(x, 0, 5, size);
    }
    for (let y = 0; y < size; y += 32) {
      ctx.fillRect(0, y, size, 6);
      rctx.fillRect(0, y, size, 6);
      bctx.fillRect(0, y, size, 6);
    }

    // Lit architectural office windows & vertical neon trims
    for (let row = 0; row < 16; row++) {
      for (let col = 0; col < 16; col++) {
        const h = deterministicHash(row * 97 + col * 31 + 7);
        if (h > 0.48) {
          const x = col * 32 + 7;
          const y = row * 32 + 8;
          const warm = h > 0.78 ? '#fef08a' : h > 0.62 ? '#7dd3fc' : accentCss;
          ctx.fillStyle = warm;
          ectx.fillStyle = warm;
          ctx.fillRect(x, y, 20, 18);
          ectx.fillRect(x, y, 20, 18);
        }
      }
    }
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
    // === FORMULA 1 / CYBER-GP OPEN-WHEEL MONOPOSTO ===
    // 1. Sleek Needle Nosecone + Tapered Monocoque Tub (Lathe + Sculpted Extrude)
    const tubShape = new THREE.Shape();
    tubShape.moveTo(-2.75, 0.18);
    tubShape.lineTo(-2.65, 0.36);
    tubShape.quadraticCurveTo(-1.35, 0.62, -0.45, 0.68);
    tubShape.lineTo(0.45, 1.06); // airbox intake behind helmet
    tubShape.quadraticCurveTo(1.35, 0.98, 2.25, 0.56); // tapered engine cover shark-fin
    tubShape.lineTo(2.45, 0.24);
    tubShape.lineTo(-2.75, 0.18);

    const tubGeo = new THREE.ExtrudeGeometry(tubShape, {
      depth: 0.62,
      bevelEnabled: true,
      bevelThickness: 0.09,
      bevelSize: 0.07,
      bevelSegments: 4,
      curveSegments: 16,
    });
    tubGeo.rotateY(Math.PI / 2);
    tubGeo.translate(-0.31, 0, 0);
    const tubMesh = new THREE.Mesh(tubGeo, bodyMat);
    tubMesh.castShadow = true;
    car.add(tubMesh);

    // Sculpted Undercut Sidepods (Left & Right)
    const podShape = new THREE.Shape();
    podShape.moveTo(-0.82, 0.16);
    podShape.lineTo(-0.88, 0.56);
    podShape.quadraticCurveTo(0.15, 0.62, 1.45, 0.44);
    podShape.lineTo(1.75, 0.18);
    podShape.lineTo(-0.82, 0.16);
    const podGeo = new THREE.ExtrudeGeometry(podShape, {
      depth: 0.58,
      bevelEnabled: true,
      bevelThickness: 0.08,
      bevelSize: 0.07,
      bevelSegments: 4,
    });
    podGeo.rotateY(Math.PI / 2);
    const podL = new THREE.Mesh(podGeo, bodyMat);
    podL.position.x = -0.92;
    podL.castShadow = true;
    const podR = new THREE.Mesh(podGeo, bodyMat);
    podR.position.x = 0.34;
    podR.castShadow = true;
    car.add(podL, podR);

    // Dark sidepod air inlets + floor plank
    const floorPlank = new THREE.Mesh(new THREE.BoxGeometry(1.96, 0.06, 4.1), carbonMat);
    floorPlank.position.set(0, 0.13, 0.15);
    car.add(floorPlank);

    for (const sx of [-0.64, 0.64]) {
      const inlet = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.28, 0.14), secondaryMat);
      inlet.position.set(sx, 0.42, -0.84);
      car.add(inlet);
    }

    // Driver Helmet + Titanium Halo Safety Cockpit
    const helmet = new THREE.Mesh(
      new THREE.SphereGeometry(0.19, 16, 16),
      new THREE.MeshPhysicalMaterial({ color: opts.accentHex, metalness: 0.8, roughness: 0.12, clearcoat: 1 })
    );
    helmet.position.set(0, 0.72, -0.05);
    const visor = new THREE.Mesh(new THREE.CylinderGeometry(0.195, 0.195, 0.09, 16, 1, false, -0.9, 1.8), glassMat);
    visor.position.set(0, 0.74, -0.07);
    visor.rotation.y = Math.PI;
    car.add(helmet, visor);

    const haloArch = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.036, 10, 24, Math.PI), carbonMat);
    haloArch.rotation.x = Math.PI / 2 + 0.12;
    haloArch.position.set(0, 0.82, -0.18);
    const haloPillar = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.03, 0.32, 10), carbonMat);
    haloPillar.position.set(0, 0.72, -0.49);
    haloPillar.rotation.x = 0.45;
    car.add(haloArch, haloPillar);

    // Multi-element Front Wing + Endplates
    const frontWingMain = new THREE.Mesh(new THREE.BoxGeometry(2.38, 0.05, 0.52), carbonMat);
    frontWingMain.position.set(0, 0.16, -2.58);
    const frontWingFlap = new THREE.Mesh(new THREE.BoxGeometry(2.34, 0.04, 0.24), bodyMat);
    frontWingFlap.position.set(0, 0.23, -2.42);
    frontWingFlap.rotation.x = 0.25;
    for (const sx of [-1.2, 1.2]) {
      const endPlate = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.28, 0.62), bodyMat);
      endPlate.position.set(sx, 0.26, -2.55);
      car.add(endPlate);
    }
    car.add(frontWingMain, frontWingFlap);

    // Swan-neck Multi-Plane F1 Rear Wing + DRS Actuator + Rain Light
    const wingTop = new THREE.Mesh(new THREE.BoxGeometry(2.05, 0.055, 0.38), carbonMat);
    wingTop.position.set(0, 1.18, 2.34);
    wingTop.rotation.x = 0.18;
    const wingMain = new THREE.Mesh(new THREE.BoxGeometry(2.05, 0.05, 0.42), bodyMat);
    wingMain.position.set(0, 1.06, 2.28);
    for (const sx of [-1.04, 1.04]) {
      const end = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.56, 0.56), bodyMat);
      end.position.set(sx, 1.02, 2.3);
      car.add(end);
    }
    for (const sx of [-0.22, 0.22]) {
      const strut = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.58, 0.22), carbonMat);
      strut.position.set(sx, 0.84, 2.18);
      car.add(strut);
    }
    car.add(wingTop, wingMain);

    // F1 Diffuser Fins + Center FIA Blinking Rain Light + Exhaust
    for (let f = -3; f <= 3; f++) {
      const fin = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.22, 0.42), carbonMat);
      fin.position.set(f * 0.22, 0.2, 2.35);
      car.add(fin);
    }
    const rainLight = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.16, 0.06), tailLedMat);
    rainLight.position.set(0, 0.38, 2.52);
    const exhaust = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.12, 0.26, 16), secondaryMat);
    exhaust.rotation.x = Math.PI / 2;
    exhaust.position.set(0, 0.56, 2.48);
    const flame = new THREE.Mesh(new THREE.ConeGeometry(0.12, 1.15, 14), exhaustMat);
    flame.rotation.x = Math.PI / 2;
    flame.position.set(0, 0.56, 3.08);
    flames.push(flame);
    car.add(rainLight, exhaust, flame);

    // Exposed Carbon Suspension Wishbones (A-arms)
    const armCoords: Array<[number, number, number, number]> = [
      [-0.65, 0.42, -1.62, 0.95],
      [0.65, 0.42, -1.62, 0.95],
      [-0.68, 0.44, 1.54, 0.98],
      [0.68, 0.44, 1.54, 0.98],
    ];
    for (const [ax, ay, az, len] of armCoords) {
      const arm1 = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, len, 8), carbonMat);
      arm1.rotation.z = Math.PI / 2;
      arm1.rotation.y = ax < 0 ? 0.22 : -0.22;
      arm1.position.set(ax, ay, az - 0.12);
      const arm2 = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, len, 8), carbonMat);
      arm2.rotation.z = Math.PI / 2;
      arm2.rotation.y = ax < 0 ? -0.22 : 0.22;
      arm2.position.set(ax, ay - 0.08, az + 0.12);
      car.add(arm1, arm2);
    }

    // 4 Open Slick Wheels
    const wheelSpecs = [
      { x: -1.16, y: 0.44, z: -1.62, r: 0.44, w: 0.42, front: true },
      { x: 1.16, y: 0.44, z: -1.62, r: 0.44, w: 0.42, front: true },
      { x: -1.2, y: 0.48, z: 1.54, r: 0.48, w: 0.52, front: false },
      { x: 1.2, y: 0.48, z: 1.54, r: 0.48, w: 0.52, front: false },
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
  bumpMap: THREE.CanvasTexture;
  roughnessMap: THREE.CanvasTexture;
} {
  const size = 512;
  const bumpC = document.createElement('canvas');
  bumpC.width = size;
  bumpC.height = size;
  const bctx = bumpC.getContext('2d')!;

  const roughC = document.createElement('canvas');
  roughC.width = size;
  roughC.height = size;
  const rctx = roughC.getContext('2d')!;

  bctx.fillStyle = '#888888';
  bctx.fillRect(0, 0, size, size);
  rctx.fillStyle = '#484848';
  rctx.fillRect(0, 0, size, size);

  // Titanium panel seams & subtle weathering variation
  bctx.strokeStyle = '#383838';
  bctx.lineWidth = 2;
  rctx.strokeStyle = '#707070';
  rctx.lineWidth = 2;
  for (let i = 0; i <= size; i += 64) {
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
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const shade = 52 + Math.floor(deterministicHash(r * 19 + c * 7) * 34);
      rctx.fillStyle = `rgb(${shade},${shade},${shade})`;
      rctx.fillRect(c * 64 + 3, r * 64 + 3, 58, 58);
    }
  }

  const bumpMap = new THREE.CanvasTexture(bumpC);
  bumpMap.wrapS = THREE.RepeatWrapping;
  bumpMap.wrapT = THREE.RepeatWrapping;
  bumpMap.repeat.set(4, 4);

  const roughnessMap = new THREE.CanvasTexture(roughC);
  roughnessMap.wrapS = THREE.RepeatWrapping;
  roughnessMap.wrapT = THREE.RepeatWrapping;
  roughnessMap.repeat.set(4, 4);

  return { bumpMap, roughnessMap };
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
  } else {
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
        color: 0x94a3b8,
        transparent: true,
        opacity: 0.18,
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
  }

  craft.userData.flames = flames;
  return craft;
}

