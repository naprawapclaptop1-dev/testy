const SOUND_NOTIFY_STORAGE_KEY = 'systempulse_sound_notify';
const SOUND_SETTINGS_STORAGE_KEY = 'systempulse_sound_settings_v2';
const CUSTOM_ALERT_AUDIO_STORAGE_KEY = 'systempulse_custom_alert_audio_v1';

export const CUSTOM_AUDIO_MAX_BYTES = 2 * 1024 * 1024; // 2 MB cap for short alert clips
export const CUSTOM_AUDIO_MAX_RECORD_SEC = 6;

export type NotificationChimeVariant = 'complete' | 'warning' | 'preview';
export type NotificationEventType =
  | 'thermalWarning'
  | 'testFailure'
  | 'stepCompletion'
  | 'generalComplete';
export type SoundPreset = 'harmonic' | 'chime' | 'beep' | 'pulse' | 'custom';

export interface SoundEventConfig {
  enabled: boolean;
  preset: SoundPreset;
}

export interface SoundAlertSettings {
  enabled: boolean;
  events: Record<NotificationEventType, SoundEventConfig>;
}

export interface CustomAlertAudioClip {
  name: string;
  mimeType: string;
  dataUrl: string;
  sizeBytes: number;
  durationSec: number | null;
  source: 'upload' | 'recording';
  updatedAt: number;
}

export interface CustomAudioValidationResult {
  ok: boolean;
  normalizedMime?: 'audio/mpeg' | 'audio/wav';
  error?: string;
}

const DEFAULT_SETTINGS: SoundAlertSettings = {
  enabled: true,
  events: {
    thermalWarning: { enabled: true, preset: 'beep' },
    testFailure: { enabled: true, preset: 'pulse' },
    stepCompletion: { enabled: true, preset: 'chime' },
    generalComplete: { enabled: true, preset: 'harmonic' },
  },
};

const VALID_PRESETS = new Set<SoundPreset>(['harmonic', 'chime', 'beep', 'pulse', 'custom']);

export function validateCustomAudioFile(file: {
  name: string;
  type: string;
  size: number;
}): CustomAudioValidationResult {
  const lowerName = (file.name || '').toLowerCase().trim();
  const lowerType = (file.type || '').toLowerCase().trim();

  const isMp3 =
    lowerName.endsWith('.mp3') ||
    lowerType === 'audio/mpeg' ||
    lowerType === 'audio/mp3' ||
    lowerType === 'audio/x-mpeg';
  const isWav =
    lowerName.endsWith('.wav') ||
    lowerType === 'audio/wav' ||
    lowerType === 'audio/wave' ||
    lowerType === 'audio/x-wav' ||
    lowerType === 'audio/vnd.wave';

  if (!isMp3 && !isWav) {
    return {
      ok: false,
      error: 'Obsługiwane są wyłącznie krótkie pliki audio w formacie .mp3 lub .wav.',
    };
  }

  if (!Number.isFinite(file.size) || file.size <= 0) {
    return {
      ok: false,
      error: 'Wybrany plik audio jest pusty.',
    };
  }

  if (file.size > CUSTOM_AUDIO_MAX_BYTES) {
    return {
      ok: false,
      error: `Plik audio przekracza limit ${(CUSTOM_AUDIO_MAX_BYTES / (1024 * 1024)).toFixed(0)} MB dla krótkich dźwięków alertów.`,
    };
  }

  return {
    ok: true,
    normalizedMime: isWav ? 'audio/wav' : 'audio/mpeg',
  };
}

/**
 * Pure 16-bit mono PCM RIFF/WAVE encoder so recorded microphone clips
 * are always stored as standard .wav files without codec ambiguity.
 */
export function encodePcmToWavBytes(samples: Float32Array, sampleRate: number): Uint8Array {
  const sr = Math.max(8000, Math.round(sampleRate || 44100));
  const numChannels = 1;
  const bitsPerSample = 16;
  const blockAlign = numChannels * (bitsPerSample / 8);
  const byteRate = sr * blockAlign;
  const dataSize = samples.length * 2;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  const writeAscii = (offset: number, text: string) => {
    for (let i = 0; i < text.length; i++) {
      view.setUint8(offset + i, text.charCodeAt(i));
    }
  };

  writeAscii(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeAscii(8, 'WAVE');
  writeAscii(12, 'fmt ');
  view.setUint32(16, 16, true); // PCM chunk size
  view.setUint16(20, 1, true); // PCM format
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sr, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);
  writeAscii(36, 'data');
  view.setUint32(40, dataSize, true);

  let offset = 44;
  for (let i = 0; i < samples.length; i++) {
    const clamped = Math.max(-1, Math.min(1, samples[i]));
    const int16 = clamped < 0 ? Math.round(clamped * 0x8000) : Math.round(clamped * 0x7fff);
    view.setInt16(offset, int16, true);
    offset += 2;
  }

  return new Uint8Array(buffer);
}

export function bytesToBase64(bytes: Uint8Array): string {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(bytes).toString('base64');
  }
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const slice = bytes.subarray(i, Math.min(i + chunkSize, bytes.length));
    binary += String.fromCharCode(...slice);
  }
  return btoa(binary);
}

export function dataUrlToArrayBuffer(dataUrl: string): ArrayBuffer | null {
  const commaIdx = dataUrl.indexOf(',');
  if (commaIdx < 0) return null;
  const base64 = dataUrl.slice(commaIdx + 1);
  if (!base64) return null;
  if (typeof Buffer !== 'undefined') {
    const buf = Buffer.from(base64, 'base64');
    return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  }
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

class SoundNotificationService {
  private settings: SoundAlertSettings;
  private customAudio: CustomAlertAudioClip | null = null;
  private ctx: AudioContext | null = null;
  private activeCustomAudioEl: HTMLAudioElement | null = null;

  constructor() {
    this.settings = {
      enabled: DEFAULT_SETTINGS.enabled,
      events: {
        thermalWarning: { ...DEFAULT_SETTINGS.events.thermalWarning },
        testFailure: { ...DEFAULT_SETTINGS.events.testFailure },
        stepCompletion: { ...DEFAULT_SETTINGS.events.stepCompletion },
        generalComplete: { ...DEFAULT_SETTINGS.events.generalComplete },
      },
    };
    this.loadFromStorage();
  }

  private loadFromStorage(): void {
    try {
      if (typeof localStorage === 'undefined') return;
      const legacy = localStorage.getItem(SOUND_NOTIFY_STORAGE_KEY);
      if (legacy === '0' || legacy === 'false') {
        this.settings.enabled = false;
      }
      const stored = localStorage.getItem(SOUND_SETTINGS_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as Partial<SoundAlertSettings>;
        if (typeof parsed.enabled === 'boolean') this.settings.enabled = parsed.enabled;
        if (parsed.events) {
          for (const k of Object.keys(DEFAULT_SETTINGS.events) as NotificationEventType[]) {
            if (parsed.events[k]) {
              const rawPreset = parsed.events[k].preset;
              const preset = VALID_PRESETS.has(rawPreset)
                ? rawPreset
                : DEFAULT_SETTINGS.events[k].preset;
              this.settings.events[k] = {
                enabled: Boolean(parsed.events[k].enabled),
                preset,
              };
            }
          }
        }
      }
      const rawClip = localStorage.getItem(CUSTOM_ALERT_AUDIO_STORAGE_KEY);
      if (rawClip) {
        const parsedClip = JSON.parse(rawClip) as Partial<CustomAlertAudioClip>;
        if (
          typeof parsedClip.name === 'string' &&
          typeof parsedClip.dataUrl === 'string' &&
          parsedClip.dataUrl.startsWith('data:audio/')
        ) {
          this.customAudio = {
            name: parsedClip.name,
            mimeType: parsedClip.mimeType || 'audio/wav',
            dataUrl: parsedClip.dataUrl,
            sizeBytes: Number(parsedClip.sizeBytes) || parsedClip.dataUrl.length,
            durationSec:
              typeof parsedClip.durationSec === 'number' && Number.isFinite(parsedClip.durationSec)
                ? parsedClip.durationSec
                : null,
            source: parsedClip.source === 'recording' ? 'recording' : 'upload',
            updatedAt: Number(parsedClip.updatedAt) || Date.now(),
          };
        }
      }
    } catch {
      // Ignore storage access issues
    }
  }

  private persistSettings(): void {
    try {
      if (typeof localStorage === 'undefined') return;
      localStorage.setItem(SOUND_SETTINGS_STORAGE_KEY, JSON.stringify(this.settings));
      localStorage.setItem(SOUND_NOTIFY_STORAGE_KEY, this.settings.enabled ? '1' : '0');
    } catch {
      // Ignore storage errors
    }
  }

  public getSettings(): SoundAlertSettings {
    return JSON.parse(JSON.stringify(this.settings));
  }

  public getCustomAudio(): CustomAlertAudioClip | null {
    return this.customAudio ? { ...this.customAudio } : null;
  }

  public setCustomAudio(clip: CustomAlertAudioClip): { ok: boolean; error?: string } {
    if (!clip.dataUrl || !clip.dataUrl.startsWith('data:audio/')) {
      return { ok: false, error: 'Nieprawidłowy format danych audio.' };
    }
    if (clip.sizeBytes > CUSTOM_AUDIO_MAX_BYTES) {
      return {
        ok: false,
        error: `Plik przekracza limit ${(CUSTOM_AUDIO_MAX_BYTES / (1024 * 1024)).toFixed(0)} MB.`,
      };
    }

    const normalized: CustomAlertAudioClip = {
      name: clip.name.trim() || 'custom-alert.wav',
      mimeType: clip.mimeType || 'audio/wav',
      dataUrl: clip.dataUrl,
      sizeBytes: clip.sizeBytes,
      durationSec:
        typeof clip.durationSec === 'number' && Number.isFinite(clip.durationSec)
          ? Number(clip.durationSec.toFixed(2))
          : null,
      source: clip.source === 'recording' ? 'recording' : 'upload',
      updatedAt: clip.updatedAt || Date.now(),
    };

    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(CUSTOM_ALERT_AUDIO_STORAGE_KEY, JSON.stringify(normalized));
      }
    } catch {
      return {
        ok: false,
        error: 'Brak miejsca w pamięci przeglądarki (localStorage) — wgraj krótszy plik audio.',
      };
    }

    this.customAudio = normalized;
    return { ok: true };
  }

  public clearCustomAudio(): void {
    this.customAudio = null;
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem(CUSTOM_ALERT_AUDIO_STORAGE_KEY);
      }
    } catch {
      // Ignore storage errors
    }

    // Revert any event pointing at 'custom' back to its default preset
    let changed = false;
    for (const k of Object.keys(this.settings.events) as NotificationEventType[]) {
      if (this.settings.events[k].preset === 'custom') {
        this.settings.events[k].preset = DEFAULT_SETTINGS.events[k].preset;
        changed = true;
      }
    }
    if (changed) {
      this.persistSettings();
    }
  }

  public applyCustomAudioToAllEvents(): boolean {
    if (!this.customAudio) return false;
    for (const k of Object.keys(this.settings.events) as NotificationEventType[]) {
      this.settings.events[k].preset = 'custom';
    }
    this.persistSettings();
    return true;
  }

  public async loadCustomAudioFromFile(
    file: File
  ): Promise<{ ok: boolean; clip?: CustomAlertAudioClip; error?: string }> {
    const validation = validateCustomAudioFile(file);
    if (!validation.ok) {
      return { ok: false, error: validation.error };
    }

    try {
      const arrayBuf = await file.arrayBuffer();
      const bytes = new Uint8Array(arrayBuf);
      const mimeType = validation.normalizedMime || 'audio/mpeg';
      const dataUrl = `data:${mimeType};base64,${bytesToBase64(bytes)}`;

      let durationSec: number | null = null;
      const ctx = this.getAudioContext();
      if (ctx) {
        try {
          const decoded = await ctx.decodeAudioData(arrayBuf.slice(0));
          durationSec = Number(decoded.duration.toFixed(2));
        } catch {
          // Some browsers only decode via HTMLAudioElement; keep durationSec null
        }
      }

      const clip: CustomAlertAudioClip = {
        name: file.name,
        mimeType,
        dataUrl,
        sizeBytes: file.size,
        durationSec,
        source: 'upload',
        updatedAt: Date.now(),
      };
      const saved = this.setCustomAudio(clip);
      if (!saved.ok) {
        return { ok: false, error: saved.error };
      }
      return { ok: true, clip: this.getCustomAudio() ?? clip };
    } catch {
      return { ok: false, error: 'Nie udało się odczytać pliku audio.' };
    }
  }

  public saveRecordedPcmAsCustomWav(
    samples: Float32Array,
    sampleRate: number,
    name?: string
  ): { ok: boolean; clip?: CustomAlertAudioClip; error?: string } {
    if (samples.length === 0) {
      return { ok: false, error: 'Nagranie jest puste — spróbuj ponownie.' };
    }
    const wavBytes = encodePcmToWavBytes(samples, sampleRate);
    if (wavBytes.byteLength > CUSTOM_AUDIO_MAX_BYTES) {
      return {
        ok: false,
        error: 'Nagranie jest zbyt długie dla pamięci alertu — nagraj krótszy dźwięk (do 6 s).',
      };
    }
    const stamp = new Date().toTimeString().slice(0, 8).replace(/:/g, '-');
    const clipName = name || `nagranie-alert-${stamp}.wav`;
    const durationSec = Number((samples.length / Math.max(8000, sampleRate)).toFixed(2));
    const dataUrl = `data:audio/wav;base64,${bytesToBase64(wavBytes)}`;
    const clip: CustomAlertAudioClip = {
      name: clipName,
      mimeType: 'audio/wav',
      dataUrl,
      sizeBytes: wavBytes.byteLength,
      durationSec,
      source: 'recording',
      updatedAt: Date.now(),
    };
    const saved = this.setCustomAudio(clip);
    if (!saved.ok) {
      return { ok: false, error: saved.error };
    }
    return { ok: true, clip: this.getCustomAudio() ?? clip };
  }

  public updateSettings(next: Partial<SoundAlertSettings>): void {
    if (typeof next.enabled === 'boolean') {
      this.settings.enabled = next.enabled;
    }
    if (next.events) {
      for (const k of Object.keys(this.settings.events) as NotificationEventType[]) {
        if (next.events[k]) {
          const nextPreset = VALID_PRESETS.has(next.events[k].preset)
            ? next.events[k].preset
            : this.settings.events[k].preset;
          this.settings.events[k] = {
            enabled: Boolean(next.events[k].enabled),
            preset: nextPreset,
          };
        }
      }
    }
    this.persistSettings();
  }

  public isEnabled(): boolean {
    return this.settings.enabled;
  }

  public setEnabled(next: boolean): void {
    this.updateSettings({ enabled: next });
  }

  public toggle(): boolean {
    const next = !this.settings.enabled;
    this.setEnabled(next);
    if (next) {
      this.playPresetSignal('harmonic', 'preview');
    }
    return next;
  }

  public playEvent(
    eventType: NotificationEventType,
    fallbackVariant: NotificationChimeVariant = 'complete'
  ): void {
    if (!this.settings.enabled && fallbackVariant !== 'preview') return;
    const evConf = this.settings.events[eventType];
    if (evConf && !evConf.enabled && fallbackVariant !== 'preview') return;

    const preset = evConf ? evConf.preset : 'harmonic';
    this.playPresetSignal(preset, fallbackVariant);
  }

  public playCustomAudioClip(clip: CustomAlertAudioClip | null = this.customAudio): boolean {
    if (!clip || !clip.dataUrl) return false;
    try {
      const ctx = this.getAudioContext();
      const rawBuf = dataUrlToArrayBuffer(clip.dataUrl);
      if (ctx && rawBuf) {
        const playDecoded = () => {
          void ctx
            .decodeAudioData(rawBuf.slice(0))
            .then((audioBuffer) => {
              const source = ctx.createBufferSource();
              const gain = ctx.createGain();
              gain.gain.setValueAtTime(0.85, ctx.currentTime);
              source.buffer = audioBuffer;
              source.connect(gain);
              gain.connect(ctx.destination);
              source.start(0);
            })
            .catch(() => {
              this.playCustomViaHtmlAudio(clip.dataUrl);
            });
        };
        if (ctx.state === 'suspended') {
          void ctx.resume().then(playDecoded).catch(() => {
            this.playCustomViaHtmlAudio(clip.dataUrl);
          });
        } else {
          playDecoded();
        }
        return true;
      }
      return this.playCustomViaHtmlAudio(clip.dataUrl);
    } catch {
      return this.playCustomViaHtmlAudio(clip.dataUrl);
    }
  }

  private playCustomViaHtmlAudio(dataUrl: string): boolean {
    if (typeof Audio === 'undefined') return false;
    try {
      if (this.activeCustomAudioEl) {
        this.activeCustomAudioEl.pause();
        this.activeCustomAudioEl.currentTime = 0;
      }
      const el = new Audio(dataUrl);
      el.volume = 0.85;
      this.activeCustomAudioEl = el;
      void el.play().catch(() => {});
      return true;
    } catch {
      return false;
    }
  }

  private getAudioContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return null;
    if (!this.ctx || this.ctx.state === 'closed') {
      this.ctx = new AudioCtx();
    }
    return this.ctx;
  }

  public playPresetSignal(
    preset: SoundPreset,
    variant: NotificationChimeVariant = 'complete'
  ): void {
    if (!this.settings.enabled && variant !== 'preview') return;

    if (preset === 'custom') {
      if (this.customAudio && this.playCustomAudioClip(this.customAudio)) {
        return;
      }
      // Fall back to harmonic if custom clip is unavailable
      preset = 'harmonic';
    }

    try {
      const ctx = this.getAudioContext();
      if (!ctx) return;

      const trigger = () => {
        const now = ctx.currentTime + 0.012;
        const masterGain = ctx.createGain();
        masterGain.connect(ctx.destination);

        if (preset === 'beep') {
          masterGain.gain.setValueAtTime(0.0001, now);
          masterGain.gain.linearRampToValueAtTime(0.12, now + 0.01);
          masterGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.35);

          const osc = ctx.createOscillator();
          osc.type = 'square';
          osc.frequency.setValueAtTime(880, now);
          osc.connect(masterGain);
          osc.start(now);
          osc.stop(now + 0.38);
        } else if (preset === 'pulse') {
          masterGain.gain.setValueAtTime(0.0001, now);
          masterGain.gain.linearRampToValueAtTime(0.14, now + 0.01);
          masterGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.55);

          const osc = ctx.createOscillator();
          osc.type = 'sawtooth';
          osc.frequency.setValueAtTime(320, now);
          osc.frequency.linearRampToValueAtTime(220, now + 0.5);
          osc.connect(masterGain);
          osc.start(now);
          osc.stop(now + 0.58);
        } else if (preset === 'chime') {
          masterGain.gain.setValueAtTime(0.0001, now);
          masterGain.gain.linearRampToValueAtTime(0.1, now + 0.02);
          masterGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.75);

          const osc = ctx.createOscillator();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(659.25, now); // E5
          osc.frequency.setValueAtTime(987.77, now + 0.2); // B5
          osc.connect(masterGain);
          osc.start(now);
          osc.stop(now + 0.8);
        } else {
          // Harmonic
          masterGain.gain.setValueAtTime(0.0001, now);
          masterGain.gain.linearRampToValueAtTime(0.11, now + 0.02);
          masterGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.92);

          const filter = ctx.createBiquadFilter();
          filter.type = 'lowpass';
          filter.frequency.setValueAtTime(2400, now);
          filter.connect(masterGain);

          const notes =
            variant === 'preview'
              ? [
                  { freq: 587.33, start: 0, dur: 0.24, gain: 0.55, type: 'sine' as OscillatorType },
                  { freq: 880.0, start: 0.09, dur: 0.34, gain: 0.45, type: 'sine' as OscillatorType },
                ]
              : variant === 'warning'
                ? [
                    { freq: 523.25, start: 0, dur: 0.28, gain: 0.55, type: 'triangle' as OscillatorType },
                    { freq: 440.0, start: 0.14, dur: 0.42, gain: 0.5, type: 'sine' as OscillatorType },
                  ]
                : [
                    { freq: 523.25, start: 0, dur: 0.32, gain: 0.45, type: 'sine' as OscillatorType },
                    { freq: 659.25, start: 0.1, dur: 0.34, gain: 0.42, type: 'sine' as OscillatorType },
                    { freq: 783.99, start: 0.2, dur: 0.42, gain: 0.4, type: 'sine' as OscillatorType },
                    { freq: 1046.5, start: 0.31, dur: 0.52, gain: 0.28, type: 'triangle' as OscillatorType },
                  ];

          for (const n of notes) {
            const osc = ctx.createOscillator();
            const noteGain = ctx.createGain();
            osc.type = n.type;
            osc.frequency.setValueAtTime(n.freq, now + n.start);

            noteGain.gain.setValueAtTime(0.0001, now + n.start);
            noteGain.gain.linearRampToValueAtTime(n.gain, now + n.start + 0.018);
            noteGain.gain.exponentialRampToValueAtTime(0.0001, now + n.start + n.dur);

            osc.connect(noteGain);
            noteGain.connect(filter);
            osc.start(now + n.start);
            osc.stop(now + n.start + n.dur + 0.03);
          }
        }
      };

      if (ctx.state === 'suspended') {
        void ctx.resume().then(trigger).catch(() => {});
      } else {
        trigger();
      }
    } catch {
      // Never interrupt diagnostics
    }
  }

  public playCompletionChime(variant: NotificationChimeVariant = 'complete'): void {
    const evType: NotificationEventType = variant === 'warning' ? 'testFailure' : 'generalComplete';
    this.playEvent(evType, variant);
  }
}

export const soundNotificationService = new SoundNotificationService();
