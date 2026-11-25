import * as THREE from 'three';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';

export interface CinematicGradeOptions {
  sharpen?: number;
  chromatic?: number;
  vignette?: number;
  vibrance?: number;
  contrast?: number;
}

/**
 * High-speed single-pass AAA post-processing shader:
 * - Adaptive 4-tap CAS-style micro-contrast sharpening (crisp textures & fractal detail, zero ringing)
 * - Subtle optical radial chromatic dispersion near screen edges
 * - Smooth vibrance & S-curve filmic contrast lift
 * - Clean studio vignette framing
 */
export const CINEMATIC_GRADE_SHADER = {
  uniforms: {
    tDiffuse: { value: null as THREE.Texture | null },
    uResolution: { value: new THREE.Vector2(1280, 720) },
    uSharpen: { value: 0.34 },
    uChromatic: { value: 0.0014 },
    uVignette: { value: 0.24 },
    uVibrance: { value: 0.14 },
    uContrast: { value: 1.05 },
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    precision highp float;
    uniform sampler2D tDiffuse;
    uniform vec2 uResolution;
    uniform float uSharpen;
    uniform float uChromatic;
    uniform float uVignette;
    uniform float uVibrance;
    uniform float uContrast;
    varying vec2 vUv;

    void main() {
      vec2 texel = 1.0 / max(uResolution, vec2(1.0));
      vec2 offsetFromCenter = vUv - 0.5;
      float radialDist = length(offsetFromCenter);

      // Subtle edge-weighted optical chromatic aberration (center stays razor-sharp)
      vec2 caOffset = offsetFromCenter * (radialDist * radialDist * uChromatic * 4.0);
      vec4 baseSample = texture2D(tDiffuse, vUv);
      vec3 c;
      if (uChromatic > 0.00005) {
        c.r = texture2D(tDiffuse, clamp(vUv + caOffset, 0.001, 0.999)).r;
        c.g = baseSample.g;
        c.b = texture2D(tDiffuse, clamp(vUv - caOffset, 0.001, 0.999)).b;
      } else {
        c = baseSample.rgb;
      }

      // Adaptive CAS-style 4-tap micro-contrast sharpening (clamped to prevent halo ringing)
      if (uSharpen > 0.001) {
        vec3 n = texture2D(tDiffuse, vUv + vec2(0.0, texel.y)).rgb;
        vec3 s = texture2D(tDiffuse, vUv - vec2(0.0, texel.y)).rgb;
        vec3 e = texture2D(tDiffuse, vUv + vec2(texel.x, 0.0)).rgb;
        vec3 w = texture2D(tDiffuse, vUv - vec2(texel.x, 0.0)).rgb;

        vec3 minN = min(c, min(min(n, s), min(e, w)));
        vec3 maxN = max(c, max(max(n, s), max(e, w)));
        vec3 avgN = (n + s + e + w) * 0.25;

        // Reduce sharpening on already extreme high-contrast edges to avoid aliasing
        vec3 contrastSpan = maxN - minN;
        float edgeMask = 1.0 - smoothstep(0.28, 0.72, max(contrastSpan.r, max(contrastSpan.g, contrastSpan.b)));
        vec3 sharpened = c + (c - avgN) * (uSharpen * (0.45 + 0.55 * edgeMask));
        c = clamp(sharpened, minN * 0.92, maxN * 1.08 + 0.02);
      }

      // Selective vibrance (boosts muted mid-saturation tones without clipping vivid highlights)
      float luma = dot(c, vec3(0.2126, 0.7152, 0.0722));
      float maxC = max(c.r, max(c.g, c.b));
      float minC = min(c.r, min(c.g, c.b));
      float sat = maxC - minC;
      float vibAmt = uVibrance * (1.0 - clamp(sat * 1.35, 0.0, 1.0));
      c = mix(vec3(luma), c, 1.0 + vibAmt);

      // Gentle filmic contrast around perceptual mid-gray
      c = max(vec3(0.0), (c - 0.18) * uContrast + 0.18);

      // Clean studio vignette
      float vig = 1.0 - smoothstep(0.42, 0.98, radialDist) * uVignette;
      c *= vig;

      gl_FragColor = vec4(max(c, vec3(0.0)), baseSample.a);
    }
  `,
};

export function createCinematicGradePass(
  width: number,
  height: number,
  opts: CinematicGradeOptions = {}
): ShaderPass {
  const pass = new ShaderPass(CINEMATIC_GRADE_SHADER);
  pass.uniforms.uResolution.value.set(Math.max(1, width), Math.max(1, height));
  if (opts.sharpen !== undefined) pass.uniforms.uSharpen.value = opts.sharpen;
  if (opts.chromatic !== undefined) pass.uniforms.uChromatic.value = opts.chromatic;
  if (opts.vignette !== undefined) pass.uniforms.uVignette.value = opts.vignette;
  if (opts.vibrance !== undefined) pass.uniforms.uVibrance.value = opts.vibrance;
  if (opts.contrast !== undefined) pass.uniforms.uContrast.value = opts.contrast;
  return pass;
}

/**
 * Generates high-resolution 1024x1024 studio turntable deck PBR textures (Albedo + Roughness)
 * with brushed obsidian rings, precision technical markings, and subtle cyan accent rings.
 */
export function createStudioFloorDeckTextures(maxAnisotropy: number): {
  map: THREE.CanvasTexture;
  roughnessMap: THREE.CanvasTexture;
} {
  const size = 1024;
  const cx = size / 2;
  const cy = size / 2;

  // Albedo map (SRGB)
  const albedoCanvas = document.createElement('canvas');
  albedoCanvas.width = size;
  albedoCanvas.height = size;
  const ctx = albedoCanvas.getContext('2d')!;

  const bgGrad = ctx.createRadialGradient(cx, cy, 40, cx, cy, 512);
  bgGrad.addColorStop(0, '#131d2f');
  bgGrad.addColorStop(0.42, '#0c1322');
  bgGrad.addColorStop(0.78, '#080d18');
  bgGrad.addColorStop(1, '#04070e');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, size, size);

  // Fine radial brushed metal grooves
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.05)';
  ctx.lineWidth = 1;
  for (let r = 36; r < 500; r += 8) {
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Precision studio calibration rings
  const rings = [
    { r: 175, color: 'rgba(6, 182, 212, 0.42)', width: 2.2 },
    { r: 245, color: 'rgba(56, 189, 248, 0.24)', width: 1.5 },
    { r: 340, color: 'rgba(6, 182, 212, 0.32)', width: 2.0 },
    { r: 445, color: 'rgba(99, 102, 241, 0.22)', width: 1.5 },
  ];
  for (const ring of rings) {
    ctx.strokeStyle = ring.color;
    ctx.lineWidth = ring.width;
    ctx.beginPath();
    ctx.arc(cx, cy, ring.r, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Degree tick marks around outer showcase ring
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.24)';
  for (let deg = 0; deg < 360; deg += 5) {
    const rad = (deg * Math.PI) / 180;
    const inner = deg % 30 === 0 ? 324 : 332;
    const outer = 340;
    ctx.lineWidth = deg % 30 === 0 ? 2 : 1;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(rad) * inner, cy + Math.sin(rad) * inner);
    ctx.lineTo(cx + Math.cos(rad) * outer, cy + Math.sin(rad) * outer);
    ctx.stroke();
  }

  // Subtle geometric crosshair grid
  ctx.strokeStyle = 'rgba(30, 58, 95, 0.22)';
  ctx.lineWidth = 1;
  for (let p = 64; p < size; p += 64) {
    ctx.beginPath();
    ctx.moveTo(p, 0);
    ctx.lineTo(p, size);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, p);
    ctx.lineTo(size, p);
    ctx.stroke();
  }

  const map = new THREE.CanvasTexture(albedoCanvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = Math.max(1, maxAnisotropy);

  // Roughness map (Linear — glossy center turntable fading to matte outer studio floor)
  const roughCanvas = document.createElement('canvas');
  roughCanvas.width = size;
  roughCanvas.height = size;
  const rctx = roughCanvas.getContext('2d')!;
  const rGrad = rctx.createRadialGradient(cx, cy, 30, cx, cy, 512);
  rGrad.addColorStop(0, '#2a2a2a');
  rGrad.addColorStop(0.45, '#424242');
  rGrad.addColorStop(0.75, '#787878');
  rGrad.addColorStop(1, '#b8b8b8');
  rctx.fillStyle = rGrad;
  rctx.fillRect(0, 0, size, size);

  rctx.strokeStyle = '#181818';
  rctx.lineWidth = 4;
  for (const r of [175, 245, 340]) {
    rctx.beginPath();
    rctx.arc(cx, cy, r, 0, Math.PI * 2);
    rctx.stroke();
  }

  const roughnessMap = new THREE.CanvasTexture(roughCanvas);
  roughnessMap.anisotropy = Math.max(1, maxAnisotropy);

  return { map, roughnessMap };
}
