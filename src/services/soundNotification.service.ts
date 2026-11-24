const SOUND_NOTIFY_STORAGE_KEY = 'systempulse_sound_notify';
const SOUND_SETTINGS_STORAGE_KEY = 'systempulse_sound_settings_v2';

export type NotificationChimeVariant = 'complete' | 'warning' | 'preview';
export type NotificationEventType = 'thermalWarning' | 'testFailure' | 'stepCompletion' | 'generalComplete';
export type SoundPreset = 'harmonic' | 'chime' | 'beep' | 'pulse';

export interface SoundEventConfig {
  enabled: boolean;
  preset: SoundPreset;
}

export interface SoundAlertSettings {
  enabled: boolean;
  events: Record<NotificationEventType, SoundEventConfig>;
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

class SoundNotificationService {
  private settings: SoundAlertSettings;
  private ctx: AudioContext | null = null;

  constructor() {
    this.settings = { ...DEFAULT_SETTINGS };
    try {
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
              this.settings.events[k] = {
                enabled: Boolean(parsed.events[k].enabled),
                preset: parsed.events[k].preset || DEFAULT_SETTINGS.events[k].preset,
              };
            }
          }
        }
      }
    } catch {
      // Ignore storage access issues
    }
  }

  public getSettings(): SoundAlertSettings {
    return JSON.parse(JSON.stringify(this.settings));
  }

  public updateSettings(next: Partial<SoundAlertSettings>): void {
    if (typeof next.enabled === 'boolean') {
      this.settings.enabled = next.enabled;
    }
    if (next.events) {
      for (const k of Object.keys(this.settings.events) as NotificationEventType[]) {
        if (next.events[k]) {
          this.settings.events[k] = {
            enabled: Boolean(next.events[k].enabled),
            preset: next.events[k].preset || this.settings.events[k].preset,
          };
        }
      }
    }
    try {
      localStorage.setItem(SOUND_SETTINGS_STORAGE_KEY, JSON.stringify(this.settings));
      localStorage.setItem(SOUND_NOTIFY_STORAGE_KEY, this.settings.enabled ? '1' : '0');
    } catch {
      // Ignore storage errors
    }
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

  public playEvent(eventType: NotificationEventType, fallbackVariant: NotificationChimeVariant = 'complete'): void {
    if (!this.settings.enabled) return;
    const evConf = this.settings.events[eventType];
    if (evConf && !evConf.enabled) return;

    const preset = evConf ? evConf.preset : 'harmonic';
    this.playPresetSignal(preset, fallbackVariant);
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

  public playPresetSignal(preset: SoundPreset, variant: NotificationChimeVariant = 'complete'): void {
    if (!this.settings.enabled) return;

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
    this.playPresetSignal('harmonic', variant);
  }
}

export const soundNotificationService = new SoundNotificationService();
