import { describe, expect, it } from 'vitest';
import {
  CUSTOM_AUDIO_MAX_BYTES,
  encodePcmToWavBytes,
  soundNotificationService,
  validateCustomAudioFile,
} from '../../services/soundNotification.service';
import { GPU_SCENE_CATALOG } from '../../services/gpuStress.service';
import {
  addGpuScheduleItem,
  clampGpuScheduleDurationSec,
  computeGpuScheduleTotalSec,
  createGpuSchedulePreset,
  createGpuScheduledItem,
  createInitialGpuScheduleState,
  duplicateGpuScheduleItem,
  moveGpuScheduleItem,
  removeGpuScheduleItem,
  renderGpuSchedulerPanelHtml,
  summarizeGpuScheduleResults,
  updateGpuScheduleItem,
} from '../gpuStressScheduler';

describe('Custom Alert Audio (.mp3 / .wav upload & WAV recording)', () => {
  it('validates .mp3 and .wav files and rejects unsupported formats or oversized files', () => {
    expect(validateCustomAudioFile({ name: 'alert.mp3', type: 'audio/mpeg', size: 42_000 })).toEqual({
      ok: true,
      normalizedMime: 'audio/mpeg',
    });
    expect(validateCustomAudioFile({ name: 'chime.WAV', type: 'audio/wav', size: 120_000 })).toEqual({
      ok: true,
      normalizedMime: 'audio/wav',
    });
    expect(validateCustomAudioFile({ name: 'clip.ogg', type: 'audio/ogg', size: 20_000 }).ok).toBe(
      false
    );
    expect(validateCustomAudioFile({ name: 'empty.mp3', type: 'audio/mpeg', size: 0 }).ok).toBe(
      false
    );
    expect(
      validateCustomAudioFile({
        name: 'huge.wav',
        type: 'audio/wav',
        size: CUSTOM_AUDIO_MAX_BYTES + 1,
      }).ok
    ).toBe(false);
  });

  it('encodes Float32 PCM samples into a valid 16-bit mono RIFF/WAVE binary', () => {
    const sampleRate = 16000;
    const samples = new Float32Array(sampleRate * 0.5); // 0.5s sine tone
    for (let i = 0; i < samples.length; i++) {
      samples[i] = Math.sin((2 * Math.PI * 440 * i) / sampleRate) * 0.5;
    }

    const wav = encodePcmToWavBytes(samples, sampleRate);
    expect(wav.byteLength).toBe(44 + samples.length * 2);

    // Check RIFF / WAVE / fmt / data headers
    const ascii = (start: number, len: number) =>
      String.fromCharCode(...wav.subarray(start, start + len));
    expect(ascii(0, 4)).toBe('RIFF');
    expect(ascii(8, 4)).toBe('WAVE');
    expect(ascii(12, 4)).toBe('fmt ');
    expect(ascii(36, 4)).toBe('data');

    const view = new DataView(wav.buffer, wav.byteOffset, wav.byteLength);
    expect(view.getUint16(20, true)).toBe(1); // PCM
    expect(view.getUint16(22, true)).toBe(1); // Mono
    expect(view.getUint32(24, true)).toBe(sampleRate);
    expect(view.getUint16(34, true)).toBe(16); // 16-bit
    expect(view.getUint32(40, true)).toBe(samples.length * 2);
  });

  it('saves recorded PCM as custom WAV alert, applies to all events, and reverts cleanly on clear', () => {
    const samples = new Float32Array(8000);
    for (let i = 0; i < samples.length; i++) samples[i] = 0.25;

    const saved = soundNotificationService.saveRecordedPcmAsCustomWav(
      samples,
      16000,
      'test-alert.wav'
    );
    expect(saved.ok).toBe(true);
    expect(saved.clip?.name).toBe('test-alert.wav');
    expect(saved.clip?.mimeType).toBe('audio/wav');
    expect(saved.clip?.source).toBe('recording');
    expect(saved.clip?.durationSec).toBe(0.5);
    expect(saved.clip?.dataUrl.startsWith('data:audio/wav;base64,')).toBe(true);

    expect(soundNotificationService.applyCustomAudioToAllEvents()).toBe(true);
    const settingsAfterApply = soundNotificationService.getSettings();
    expect(settingsAfterApply.events.thermalWarning.preset).toBe('custom');
    expect(settingsAfterApply.events.testFailure.preset).toBe('custom');
    expect(settingsAfterApply.events.stepCompletion.preset).toBe('custom');
    expect(settingsAfterApply.events.generalComplete.preset).toBe('custom');

    soundNotificationService.clearCustomAudio();
    expect(soundNotificationService.getCustomAudio()).toBeNull();
    const settingsAfterClear = soundNotificationService.getSettings();
    expect(settingsAfterClear.events.thermalWarning.preset).toBe('beep');
    expect(settingsAfterClear.events.generalComplete.preset).toBe('harmonic');
  });
});

describe('GPU Stress Test Scene Scheduler', () => {
  it('supports queuing, reordering, duplicating, updating resolution & duration, and computing total time', () => {
    let queue = createGpuSchedulePreset('resolution_ladder');
    expect(queue).toHaveLength(4);
    expect(queue.map((q) => q.resolution)).toEqual(['1080p', '2k', '4k', '8k']);

    const added = createGpuScheduledItem('raymarching', {
      resolution: '4k',
      durationSec: 25,
      preset: 'ultra',
    });
    queue = addGpuScheduleItem(queue, added);
    expect(queue).toHaveLength(5);

    queue = moveGpuScheduleItem(queue, added.id, 'up');
    expect(queue[3].id).toBe(added.id);

    queue = updateGpuScheduleItem(queue, added.id, { resolution: '8k', durationSec: 45 });
    expect(queue[3].resolution).toBe('8k');
    expect(queue[3].durationSec).toBe(45);

    queue = duplicateGpuScheduleItem(queue, added.id);
    expect(queue).toHaveLength(6);
    expect(queue[4].sceneId).toBe('raymarching');
    expect(queue[4].resolution).toBe('8k');

    queue = removeGpuScheduleItem(queue, queue[4].id);
    expect(queue).toHaveLength(5);

    // 5+5+5+45+5 = 65s + 4 pauses * 2s = 73s
    expect(computeGpuScheduleTotalSec(queue, 2)).toBe(73);
    expect(clampGpuScheduleDurationSec(1)).toBe(3);
    expect(clampGpuScheduleDurationSec(999)).toBe(300);
  });

  it('summarizes scheduled run results and renders the GPU scheduler panel HTML cleanly', () => {
    const state = createInitialGpuScheduleState();
    state.results = [
      {
        itemId: state.queue[0].id,
        sceneId: 'raymarching',
        sceneName: 'Raymarch Mandelbulb RT',
        targetUnit: 'Raymarch ALU',
        resolution: '1080p',
        durationSec: 5,
        preset: 'high',
        avgFps: 118,
        low1PctFps: 94,
        frameTimeMs: 8.5,
        stabilityPct: 86.2,
        score: 82,
        peakTempC: 72.5,
        finishedAt: Date.now(),
      },
      {
        itemId: state.queue[1].id,
        sceneId: 'vortex',
        sceneName: 'Rdzeń GPU & Wir PBR',
        targetUnit: 'Rasteryzacja PBR',
        resolution: '2k',
        durationSec: 5,
        preset: 'high',
        avgFps: 210,
        low1PctFps: 192,
        frameTimeMs: 4.8,
        stabilityPct: 96.4,
        score: 94,
        peakTempC: 68.0,
        finishedAt: Date.now(),
      },
    ];

    const summary = summarizeGpuScheduleResults(state.results);
    expect(summary).toEqual({
      totalScenes: 2,
      avgFps: 164,
      avgStabilityPct: 91.3,
      minStabilityPct: 86.2,
      avgScore: 88,
      peakTempC: 72.5,
    });

    const html = renderGpuSchedulerPanelHtml(state, GPU_SCENE_CATALOG, false);
    expect(html).toContain('id="gpu-stress-scheduler-panel"');
    expect(html).toContain('id="gpu-sched-run-btn"');
    expect(html).toContain('id="gpu-sched-add-btn"');
    expect(html).toContain('id="gpu-sched-results-wrap"');
    expect(html).toContain('86.2%');
    expect(html).toContain('96.4%');
  });
});
