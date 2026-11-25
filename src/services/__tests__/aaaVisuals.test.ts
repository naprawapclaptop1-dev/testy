import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import {
  createCinematicBackdropDome,
  createFloatingEmberBokeh,
  createPlanarReflector,
  createRelativisticAccretionDiskMaterial,
  createVolumetricLightShafts,
  createVolumetricPlasmaBeamMaterial,
} from '../aaaVisuals';

describe('aaaVisuals procedural HDR & shader components', () => {
  it('builds cinematic backdrop dome, volumetric shafts, accretion disk, plasma beam, and bokeh embers', () => {
    const dome = createCinematicBackdropDome();
    expect(dome.mesh).toBeInstanceOf(THREE.Mesh);
    expect(dome.material.uniforms.uTime.value).toBe(0);

    const shafts = createVolumetricLightShafts({
      count: 4,
      ringRadius: 4,
      height: 8,
      colorHex: 0x38bdf8,
    });
    expect(shafts.group.children).toHaveLength(4);
    expect(shafts.material.blending).toBe(THREE.AdditiveBlending);

    const diskMat = createRelativisticAccretionDiskMaterial(0x38bdf8, 0xf97316);
    expect(diskMat.fragmentShader).toContain('photonRing');
    expect(diskMat.uniforms.uTime.value).toBe(0);

    const beamMat = createVolumetricPlasmaBeamMaterial(0xf97316);
    expect(beamMat.uniforms.uTime.value).toBe(0);

    const bokeh = createFloatingEmberBokeh({
      count: 60,
      radius: 6,
      height: 5,
      colorAHex: 0x38bdf8,
      colorBHex: 0xf59e0b,
    });
    expect(bokeh.points).toBeInstanceOf(THREE.Points);
    expect(bokeh.points.geometry.getAttribute('position').count).toBe(60);
  });

  it('skips Reflector allocation cleanly when running on software WebGL', () => {
    const geo = new THREE.CircleGeometry(5, 16);
    const refl = createPlanarReflector({
      geometry: geo,
      y: -0.02,
      isSoftwareGl: true,
    });
    expect(refl).toBeNull();
  });
});
