import * as THREE from 'three';
import { Reflector } from 'three/addons/objects/Reflector.js';

export type HdrEnvVariant = 'studio_cyber' | 'golden_day' | 'cyber_night' | 'deep_space';

/**
 * Generates a high-contrast HDR procedural PMREM environment map that replaces
 * Three.js's flat gray RoomEnvironment. Emissive HDR light strips (> 6.0 linear)
 * produce crisp automotive/3DMark-grade specular reflection bands on every
 * metallic, glass, and clearcoat surface in the scene.
 */
export function createCinematicHdrEnvironment(
  renderer: THREE.WebGLRenderer,
  variant: HdrEnvVariant = 'studio_cyber'
): THREE.WebGLRenderTarget | null {
  try {
    const envScene = new THREE.Scene();

    const palettes: Record<
      HdrEnvVariant,
      {
        bg: number;
        topBar: number;
        topIntensity: number;
        keyBar: number;
        keyIntensity: number;
        rimBar: number;
        rimIntensity: number;
        horizonBar: number;
        horizonIntensity: number;
        floorBounce: number;
      }
    > = {
      studio_cyber: {
        bg: 0x050914,
        topBar: 0xdcf4ff,
        topIntensity: 8.5,
        keyBar: 0xfff0d4,
        keyIntensity: 9.5,
        rimBar: 0x06b6d4,
        rimIntensity: 7.5,
        horizonBar: 0x6366f1,
        horizonIntensity: 4.2,
        floorBounce: 0x0c1a30,
      },
      golden_day: {
        bg: 0x102542,
        topBar: 0x87ceff,
        topIntensity: 5.5,
        keyBar: 0xffe4b5,
        keyIntensity: 12.0,
        rimBar: 0x38bdf8,
        rimIntensity: 5.2,
        horizonBar: 0xffb36b,
        horizonIntensity: 6.2,
        floorBounce: 0x1e2c3e,
      },
      cyber_night: {
        bg: 0x040712,
        topBar: 0x38bdf8,
        topIntensity: 7.2,
        keyBar: 0xf472b6,
        keyIntensity: 8.8,
        rimBar: 0x22d3ee,
        rimIntensity: 9.0,
        horizonBar: 0x818cf8,
        horizonIntensity: 5.5,
        floorBounce: 0x091326,
      },
      deep_space: {
        bg: 0x02040b,
        topBar: 0x93c5fd,
        topIntensity: 6.5,
        keyBar: 0xfbbf24,
        keyIntensity: 10.5,
        rimBar: 0xa855f7,
        rimIntensity: 7.8,
        horizonBar: 0x0ea5e9,
        horizonIntensity: 4.8,
        floorBounce: 0x070d1d,
      },
    };

    const p = palettes[variant];
    envScene.background = new THREE.Color(p.bg);

    const makeHdrMat = (hex: number, mult: number) =>
      new THREE.MeshBasicMaterial({
        color: new THREE.Color(hex).multiplyScalar(mult),
        side: THREE.DoubleSide,
      });

    // Overhead twin architectural softbox light strips (signature studio/automotive reflection lines)
    const stripGeo = new THREE.PlaneGeometry(18, 2.2);
    const topStripA = new THREE.Mesh(stripGeo, makeHdrMat(p.topBar, p.topIntensity));
    topStripA.position.set(0, 12, -3.5);
    topStripA.rotation.x = Math.PI / 2;
    envScene.add(topStripA);

    const topStripB = new THREE.Mesh(stripGeo, makeHdrMat(p.keyBar, p.keyIntensity * 0.72));
    topStripB.position.set(0, 12, 4.2);
    topStripB.rotation.x = Math.PI / 2;
    envScene.add(topStripB);

    // Warm key softbox panel on right-front
    const keyPanel = new THREE.Mesh(
      new THREE.PlaneGeometry(10, 7),
      makeHdrMat(p.keyBar, p.keyIntensity)
    );
    keyPanel.position.set(13, 6.5, 9);
    keyPanel.lookAt(0, 0, 0);
    envScene.add(keyPanel);

    // Electric cyan/neon rim softbox panel on left-rear
    const rimPanel = new THREE.Mesh(
      new THREE.PlaneGeometry(11, 6.5),
      makeHdrMat(p.rimBar, p.rimIntensity)
    );
    rimPanel.position.set(-14, 5.5, -8);
    rimPanel.lookAt(0, 0, 0);
    envScene.add(rimPanel);

    // Horizon glow band ring (creates crisp horizon line reflection on chrome & car paint)
    const horizonRing = new THREE.Mesh(
      new THREE.CylinderGeometry(19, 19, 1.45, 36, 1, true),
      makeHdrMat(p.horizonBar, p.horizonIntensity)
    );
    horizonRing.position.y = 0.6;
    envScene.add(horizonRing);

    // Subtle dark-blue floor bounce card so underside metallic faces aren't pitch black
    const floorBounce = new THREE.Mesh(
      new THREE.CircleGeometry(18, 24),
      makeHdrMat(p.floorBounce, 1.25)
    );
    floorBounce.rotation.x = -Math.PI / 2;
    floorBounce.position.y = -6;
    envScene.add(floorBounce);

    const pmrem = new THREE.PMREMGenerator(renderer);
    pmrem.compileEquirectangularShader();
    const rt = pmrem.fromScene(envScene, 0.02);
    pmrem.dispose();

    // Clean up temporary geometry/materials
    envScene.traverse((obj) => {
      const m = obj as THREE.Mesh;
      if (m.geometry) m.geometry.dispose();
      if (m.material) {
        if (Array.isArray(m.material)) m.material.forEach((mat) => mat.dispose());
        else (m.material as THREE.Material).dispose();
      }
    });

    return rt;
  } catch {
    return null;
  }
}

/**
 * Custom GLSL atmospheric studio / cyber-horizon dome for 3D showcase scenes,
 * replacing flat solid-color backgrounds with volumetric depth, mist bands,
 * subtle horizon energy glow, and crisp starlight depth.
 */
export function createCinematicBackdropDome(
  colZenithHex = 0x040814,
  colHorizonHex = 0x0c2444,
  colAccentHex = 0x06b6d4
): { mesh: THREE.Mesh; material: THREE.ShaderMaterial } {
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uZenith: { value: new THREE.Color(colZenithHex) },
      uHorizon: { value: new THREE.Color(colHorizonHex) },
      uAccent: { value: new THREE.Color(colAccentHex) },
    },
    vertexShader: `
      varying vec3 vWorldDir;
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorldDir = normalize(position);
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: `
      precision highp float;
      uniform float uTime;
      uniform vec3 uZenith;
      uniform vec3 uHorizon;
      uniform vec3 uAccent;
      varying vec3 vWorldDir;

      float hash21(vec2 p) {
        p = fract(p * vec2(234.34, 435.345));
        p += dot(p, p + 34.23);
        return fract(p.x * p.y);
      }

      void main() {
        vec3 d = normalize(vWorldDir);
        float y = clamp(d.y, -1.0, 1.0);
        float hBand = exp(-abs(y + 0.02) * 7.5);
        vec3 col = mix(uHorizon * 0.42, uZenith, smoothstep(-0.08, 0.72, y));
        col = mix(col, uHorizon, hBand * 0.78);

        // Subtle sweeping aurora / volumetric studio haze ribbons
        float rib1 = sin(d.x * 5.0 + d.z * 3.5 + uTime * 0.18) * cos(d.y * 6.0 - uTime * 0.12);
        float rib2 = sin(d.z * 6.5 - d.x * 4.0 - uTime * 0.14);
        float ribMask = smoothstep(-0.05, 0.55, y) * (1.0 - smoothstep(0.55, 0.96, y));
        col += uAccent * (smoothstep(0.25, 0.98, rib1) * 0.16 + smoothstep(0.45, 0.99, rib2) * 0.09) * ribMask;

        // Horizon rim light strip
        col += uAccent * exp(-abs(y) * 28.0) * 0.28;

        // Subtle crisp starlight in upper dome
        if (y > 0.06) {
          vec2 cell = floor(d.xz / (y + 0.32) * 85.0);
          float star = hash21(cell);
          if (star > 0.988) {
            float tw = 0.65 + 0.35 * sin(uTime * 2.5 + star * 90.0);
            col += vec3(0.75, 0.9, 1.0) * tw * smoothstep(0.06, 0.38, y) * 0.65;
          }
        }

        // Deep obsidian studio abyss below horizon
        if (y < -0.02) {
          col = mix(col, uZenith * 0.55, smoothstep(-0.02, -0.35, y));
        }

        gl_FragColor = vec4(col, 1.0);
      }
    `,
    side: THREE.BackSide,
    depthWrite: false,
  });

  const mesh = new THREE.Mesh(new THREE.SphereGeometry(72, 32, 20), material);
  mesh.frustumCulled = false;
  return { mesh, material };
}

/**
 * Real-time planar mirror Reflector (safely guarded for hardware WebGL only).
 * Place slightly underneath a semi-transparent clearcoat floor/road to create
 * ray-tracing-like wet asphalt or obsidian showcase reflections.
 */
export function createPlanarReflector(opts: {
  geometry: THREE.BufferGeometry;
  y: number;
  z?: number;
  color?: number;
  textureSize?: number;
  isSoftwareGl: boolean;
}): Reflector | null {
  if (opts.isSoftwareGl) return null;
  try {
    const texSize = opts.textureSize ?? 768;
    const reflector = new Reflector(opts.geometry, {
      clipBias: 0.003,
      textureWidth: texSize,
      textureHeight: texSize,
      color: opts.color ?? 0x7c93b2,
    });
    reflector.rotation.x = -Math.PI / 2;
    reflector.position.set(0, opts.y, opts.z ?? 0);
    return reflector;
  } catch {
    opts.geometry.dispose();
    return null;
  }
}

/**
 * Custom GLSL Fresnel-soft volumetric spotlight / god-ray cones.
 * Eliminates harsh geometric cone edges using view-angle dot-product fade
 * and vertical volumetric attenuation + subtle animated dust shimmer.
 */
export function createVolumetricLightShafts(opts: {
  count: number;
  ringRadius: number;
  height: number;
  topRadius?: number;
  bottomRadius?: number;
  colorHex: number;
  opacity?: number;
  targetY?: number;
}): { group: THREE.Group; material: THREE.ShaderMaterial } {
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uColor: { value: new THREE.Color(opts.colorHex) },
      uOpacity: { value: opts.opacity ?? 0.24 },
    },
    vertexShader: `
      varying vec2 vUv;
      varying vec3 vNormalW;
      varying vec3 vWorldPos;
      void main() {
        vUv = uv;
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorldPos = wp.xyz;
        vNormalW = normalize(mat3(modelMatrix) * normal);
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: `
      precision highp float;
      uniform float uTime;
      uniform vec3 uColor;
      uniform float uOpacity;
      varying vec2 vUv;
      varying vec3 vNormalW;
      varying vec3 vWorldPos;

      void main() {
        vec3 V = normalize(cameraPosition - vWorldPos);
        // Edge-softening Fresnel so cylinder/cone silhouette dissolves smoothly
        float edgeFade = pow(abs(dot(normalize(vNormalW), V)), 2.2);
        // Smooth vertical fade from top fixture down to floor
        float vFade = smoothstep(0.0, 0.28, vUv.y) * (1.0 - smoothstep(0.72, 1.0, vUv.y));
        // Animated atmospheric dust streaks drifting inside the shaft
        float dust = 0.78 + 0.22 * sin(vUv.y * 18.0 - uTime * 1.4 + vUv.x * 12.566);
        float alpha = edgeFade * vFade * dust * uOpacity;
        gl_FragColor = vec4(uColor * (1.15 + 0.45 * vUv.y), alpha);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  });

  const group = new THREE.Group();
  const geo = new THREE.CylinderGeometry(
    opts.topRadius ?? 0.28,
    opts.bottomRadius ?? 2.35,
    opts.height,
    24,
    1,
    true
  );

  for (let i = 0; i < opts.count; i++) {
    const angle = (i / opts.count) * Math.PI * 2 + Math.PI / 4;
    const cone = new THREE.Mesh(geo, material);
    const sx = Math.cos(angle) * opts.ringRadius;
    const sz = Math.sin(angle) * opts.ringRadius;
    const midY = (opts.targetY ?? 0.4) + opts.height * 0.42;
    cone.position.set(sx * 0.58, midY, sz * 0.58);
    cone.rotation.z = Math.cos(angle) * 0.34;
    cone.rotation.x = -Math.sin(angle) * 0.34;
    group.add(cone);
  }

  return { group, material };
}

/**
 * Custom GLSL animated Relativistic Black Hole / Plasma Accretion Disk shader
 * with spiral FBM filaments, Doppler brightness beaming, and glowing HDR inner photon ring.
 */
export function createRelativisticAccretionDiskMaterial(
  colInnerHex: number,
  colOuterHex: number
): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uColInner: { value: new THREE.Color(colInnerHex) },
      uColOuter: { value: new THREE.Color(colOuterHex) },
    },
    vertexShader: `
      varying vec2 vUv;
      varying vec3 vLocal;
      void main() {
        vUv = uv;
        vLocal = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      precision highp float;
      uniform float uTime;
      uniform vec3 uColInner;
      uniform vec3 uColOuter;
      varying vec2 vUv;
      varying vec3 vLocal;

      float hash(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
      }
      float noise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        return mix(
          mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
          mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x),
          f.y
        );
      }
      float fbm(vec2 p) {
        float v = 0.0;
        float a = 0.5;
        for (int i = 0; i < 4; i++) {
          v += a * noise(p);
          p = p * 2.08 + vec2(1.7, 9.2);
          a *= 0.5;
        }
        return v;
      }

      void main() {
        float r = length(vLocal.xy);
        float radialT = clamp((r - 4.4) / 10.6, 0.0, 1.0);
        float angle = atan(vLocal.y, vLocal.x);

        // Differential Keplerian orbital swirl (inner orbits spin much faster)
        float swirl = angle + (1.0 - radialT) * 7.5 - uTime * (1.85 - radialT * 1.15);
        vec2 spiralUv = vec2(swirl * 1.9, radialT * 9.0 - uTime * 0.45);
        float fil1 = fbm(spiralUv);
        float fil2 = fbm(spiralUv * 2.1 + vec2(uTime * 0.35, -uTime * 0.25));
        float streaks = smoothstep(0.24, 0.86, fil1 * 0.65 + fil2 * 0.45);

        // Relativistic Doppler beaming (approaching side glows brighter & hotter)
        float doppler = 0.72 + 0.52 * sin(angle + 0.6);

        // Blazing HDR inner photon ring right near event horizon
        float photonRing = exp(-pow((radialT - 0.06) * 16.0, 2.0)) * 2.4;
        float edgeMask = smoothstep(0.0, 0.09, radialT) * (1.0 - smoothstep(0.68, 1.0, radialT));

        vec3 col = mix(uColInner * 1.9, uColOuter * 1.15, pow(radialT, 0.72));
        col *= (0.45 + 1.35 * streaks) * doppler;
        col += vec3(1.65, 1.48, 1.25) * photonRing;

        float alpha = clamp((edgeMask * (0.28 + 0.72 * streaks) + photonRing * 0.45), 0.0, 0.96);
        gl_FragColor = vec4(col, alpha);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  });
}

/**
 * Custom GLSL volumetric scrolling plasma jet shader for polar relativistic beams
 * and reactor energy conduits (replaces flat MeshBasicMaterial cones).
 */
export function createVolumetricPlasmaBeamMaterial(colHex: number): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uColor: { value: new THREE.Color(colHex) },
    },
    vertexShader: `
      varying vec2 vUv;
      varying vec3 vNormalW;
      varying vec3 vWorldPos;
      void main() {
        vUv = uv;
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorldPos = wp.xyz;
        vNormalW = normalize(mat3(modelMatrix) * normal);
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: `
      precision highp float;
      uniform float uTime;
      uniform vec3 uColor;
      varying vec2 vUv;
      varying vec3 vNormalW;
      varying vec3 vWorldPos;

      void main() {
        vec3 V = normalize(cameraPosition - vWorldPos);
        float core = pow(abs(dot(normalize(vNormalW), V)), 1.65);
        float wave = 0.62 + 0.38 * sin(vUv.y * 26.0 - uTime * 8.5 + sin(vUv.x * 12.56) * 1.5);
        float pulse = 0.8 + 0.2 * sin(vUv.y * 9.0 - uTime * 4.2);
        float endFade = smoothstep(0.0, 0.14, vUv.y) * (1.0 - smoothstep(0.62, 1.0, vUv.y));
        vec3 hotCol = mix(uColor * 1.35, vec3(1.8, 1.72, 1.55), pow(core, 2.2) * 0.75);
        float alpha = core * wave * pulse * endFade * 0.85;
        gl_FragColor = vec4(hotCol, alpha);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  });
}

/**
 * Procedural 512x512 woven carbon-fiber PBR texture set (albedo + bump + roughness)
 * for GPU chassis shrouds, supercar aero bodywork, and mech armor plates.
 */
export function createCarbonFiberTextures(maxAnisotropy: number): {
  map: THREE.CanvasTexture;
  bumpMap: THREE.CanvasTexture;
  roughnessMap: THREE.CanvasTexture;
} {
  const size = 256;
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

  ctx.fillStyle = '#0e131e';
  ctx.fillRect(0, 0, size, size);
  bctx.fillStyle = '#606060';
  bctx.fillRect(0, 0, size, size);
  rctx.fillStyle = '#5c5c5c';
  rctx.fillRect(0, 0, size, size);

  const cell = 16;
  for (let y = 0; y < size; y += cell) {
    for (let x = 0; x < size; x += cell) {
      const diag = ((x / cell) + (y / cell)) % 2 === 0;
      const grad = diag
        ? ctx.createLinearGradient(x, y, x + cell, y)
        : ctx.createLinearGradient(x, y, x, y + cell);
      grad.addColorStop(0, '#111827');
      grad.addColorStop(0.5, '#263248');
      grad.addColorStop(1, '#0c111b');
      ctx.fillStyle = grad;
      ctx.fillRect(x + 1, y + 1, cell - 2, cell - 2);

      bctx.fillStyle = diag ? '#c8c8c8' : '#888888';
      bctx.fillRect(x + 1, y + 1, cell - 2, cell - 2);

      rctx.fillStyle = diag ? '#363636' : '#6a6a6a';
      rctx.fillRect(x + 1, y + 1, cell - 2, cell - 2);
    }
  }

  const map = new THREE.CanvasTexture(albedo);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.repeat.set(6, 4);
  map.anisotropy = Math.max(1, maxAnisotropy);

  const bumpMap = new THREE.CanvasTexture(bump);
  bumpMap.wrapS = bumpMap.wrapT = THREE.RepeatWrapping;
  bumpMap.repeat.set(6, 4);
  bumpMap.anisotropy = Math.max(1, maxAnisotropy);

  const roughnessMap = new THREE.CanvasTexture(rough);
  roughnessMap.wrapS = roughnessMap.wrapT = THREE.RepeatWrapping;
  roughnessMap.repeat.set(6, 4);
  roughnessMap.anisotropy = Math.max(1, maxAnisotropy);

  return { map, bumpMap, roughnessMap };
}

/**
 * Custom GLSL soft circular bokeh ember particle system with gentle upward drift
 * and twinkling HDR cores for rich cinematic depth.
 */
export function createFloatingEmberBokeh(opts: {
  count: number;
  radius: number;
  height: number;
  colorAHex: number;
  colorBHex: number;
  size?: number;
}): { points: THREE.Points; material: THREE.ShaderMaterial } {
  const positions = new Float32Array(opts.count * 3);
  const seeds = new Float32Array(opts.count * 3); // x: speed, y: phase, z: colorMix

  for (let i = 0; i < opts.count; i++) {
    const r = 1.4 + Math.sqrt(Math.random()) * opts.radius;
    const a = Math.random() * Math.PI * 2;
    positions[i * 3] = Math.cos(a) * r;
    positions[i * 3 + 1] = 0.25 + Math.random() * opts.height;
    positions[i * 3 + 2] = Math.sin(a) * r;

    seeds[i * 3] = 0.25 + Math.random() * 0.85;
    seeds[i * 3 + 1] = Math.random() * Math.PI * 2;
    seeds[i * 3 + 2] = Math.random();
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 3));

  const material = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uHeight: { value: opts.height },
      uSize: { value: opts.size ?? 24.0 },
      uColA: { value: new THREE.Color(opts.colorAHex) },
      uColB: { value: new THREE.Color(opts.colorBHex) },
    },
    vertexShader: `
      attribute vec3 aSeed;
      uniform float uTime;
      uniform float uHeight;
      uniform float uSize;
      varying float vMix;
      varying float vTwinkle;
      void main() {
        vec3 pos = position;
        float drift = mod(pos.y + uTime * aSeed.x * 0.42, uHeight);
        pos.y = drift + 0.15;
        pos.x += sin(uTime * 0.65 + aSeed.y) * 0.22;
        pos.z += cos(uTime * 0.58 + aSeed.y) * 0.22;
        vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
        gl_Position = projectionMatrix * mvPosition;
        float distScale = clamp(uSize / max(-mvPosition.z, 1.2), 2.5, 22.0);
        gl_PointSize = distScale * (0.65 + 0.55 * aSeed.x);
        vMix = aSeed.z;
        vTwinkle = 0.55 + 0.45 * sin(uTime * 3.2 + aSeed.y * 5.0);
      }
    `,
    fragmentShader: `
      precision highp float;
      uniform vec3 uColA;
      uniform vec3 uColB;
      varying float vMix;
      varying float vTwinkle;
      void main() {
        vec2 c = gl_PointCoord - 0.5;
        float d = length(c);
        if (d > 0.5) discard;
        // Soft bokeh disc with bright HDR core
        float core = exp(-d * d * 24.0);
        float halo = smoothstep(0.5, 0.08, d) * 0.48;
        vec3 col = mix(uColA, uColB, vMix) * (1.1 + core * 1.4);
        gl_FragColor = vec4(col, (core + halo) * vTwinkle * 0.82);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });

  const points = new THREE.Points(geo, material);
  points.frustumCulled = false;
  return { points, material };
}
