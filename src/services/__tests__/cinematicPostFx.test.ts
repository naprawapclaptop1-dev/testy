import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import {
  CINEMATIC_GRADE_SHADER,
  createCinematicGradePass,
} from '../cinematicPostFx';

describe('cinematicPostFx', () => {
  it('defines all required cinematic shader uniforms and valid GLSL entrypoints', () => {
    expect(CINEMATIC_GRADE_SHADER.uniforms.tDiffuse).toBeDefined();
    expect(CINEMATIC_GRADE_SHADER.uniforms.uResolution.value).toBeInstanceOf(THREE.Vector2);
    expect(CINEMATIC_GRADE_SHADER.uniforms.uSharpen.value).toBeGreaterThan(0);
    expect(CINEMATIC_GRADE_SHADER.uniforms.uChromatic.value).toBeGreaterThan(0);
    expect(CINEMATIC_GRADE_SHADER.uniforms.uVignette.value).toBeGreaterThan(0);
    expect(CINEMATIC_GRADE_SHADER.vertexShader).toContain('gl_Position');
    expect(CINEMATIC_GRADE_SHADER.fragmentShader).toContain('gl_FragColor');
    expect(CINEMATIC_GRADE_SHADER.fragmentShader).toContain('uSharpen');
    expect(CINEMATIC_GRADE_SHADER.fragmentShader).toContain('uChromatic');
  });

  it('creates a configured ShaderPass with custom resolution and grading options', () => {
    const pass = createCinematicGradePass(1920, 1080, {
      sharpen: 0.45,
      chromatic: 0.0022,
      vignette: 0.28,
      vibrance: 0.18,
      contrast: 1.07,
    });

    expect(pass.uniforms.uResolution.value.x).toBe(1920);
    expect(pass.uniforms.uResolution.value.y).toBe(1080);
    expect(pass.uniforms.uSharpen.value).toBeCloseTo(0.45);
    expect(pass.uniforms.uChromatic.value).toBeCloseTo(0.0022);
    expect(pass.uniforms.uVignette.value).toBeCloseTo(0.28);
    expect(pass.uniforms.uVibrance.value).toBeCloseTo(0.18);
    expect(pass.uniforms.uContrast.value).toBeCloseTo(1.07);
    pass.dispose();
  });
});
