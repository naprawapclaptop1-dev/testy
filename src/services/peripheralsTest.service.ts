export type AudioChannelMode = 'off' | 'left' | 'right' | 'stereo' | 'sweep' | 'pink_noise';

export class PeripheralsTestService {
  // Web Audio output tester
  private audioCtx: AudioContext | null = null;
  private oscillator: OscillatorNode | null = null;
  private noiseSource: AudioBufferSourceNode | null = null;
  private gainNode: GainNode | null = null;
  private pannerNode: StereoPannerNode | null = null;
  private activeAudioMode: AudioChannelMode = 'off';
  private activeFreqHz = 440;
  private sweepTimer: number | null = null;

  // Media devices (Webcam & Microphone)
  private camStream: MediaStream | null = null;
  private micStream: MediaStream | null = null;
  private micCtx: AudioContext | null = null;
  private micAnalyser: AnalyserNode | null = null;
  private micRafId = 0;

  // Mic Echo / Loopback recorder
  private recorder: MediaRecorder | null = null;
  private recordedAudioUrl: string | null = null;

  public getAudioMode(): AudioChannelMode {
    return this.activeAudioMode;
  }

  public getAudioFreq(): number {
    return this.activeFreqHz;
  }

  public getRecordedAudioUrl(): string | null {
    return this.recordedAudioUrl;
  }

  private ensureAudioContext(): AudioContext {
    if (!this.audioCtx) {
      this.audioCtx = new AudioContext();
    }
    if (this.audioCtx.state === 'suspended') {
      void this.audioCtx.resume();
    }
    return this.audioCtx;
  }

  public startTone(
    mode: AudioChannelMode,
    freqHz = this.activeFreqHz,
    onSweepFreq?: (hz: number) => void
  ): void {
    this.activeFreqHz = Math.max(20, Math.min(18000, Math.round(freqHz)));
    if (mode === 'off') {
      this.stopTone();
      return;
    }

    const ctx = this.ensureAudioContext();
    this.stopTone();

    const gain = ctx.createGain();
    const panner = ctx.createStereoPanner();
    gain.gain.value = mode === 'pink_noise' ? 0.14 : 0.18;
    panner.pan.value = mode === 'left' ? -1 : mode === 'right' ? 1 : 0;

    if (mode === 'pink_noise') {
      const bufferSize = ctx.sampleRate * 2;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const output = buffer.getChannelData(0);
      let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + white * 0.0555179;
        b1 = 0.99332 * b1 + white * 0.0750759;
        b2 = 0.96900 * b2 + white * 0.1538520;
        b3 = 0.86650 * b3 + white * 0.3104856;
        b4 = 0.55000 * b4 + white * 0.5329522;
        b5 = -0.7616 * b5 - white * 0.0168980;
        output[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
        b6 = white * 0.115926;
      }
      const noise = ctx.createBufferSource();
      noise.buffer = buffer;
      noise.loop = true;
      noise.connect(gain);
      gain.connect(panner);
      panner.connect(ctx.destination);
      noise.start();
      this.noiseSource = noise;
    } else {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = mode === 'sweep' ? 20 : this.activeFreqHz;
      osc.connect(gain);
      gain.connect(panner);
      panner.connect(ctx.destination);
      osc.start();
      this.oscillator = osc;

      if (mode === 'sweep') {
        const startHz = 20;
        const endHz = 16000;
        const durationSec = 8;
        const t0 = ctx.currentTime;
        osc.frequency.setValueAtTime(startHz, t0);
        osc.frequency.exponentialRampToValueAtTime(endHz, t0 + durationSec);
        const wallStart = performance.now();
        this.sweepTimer = window.setInterval(() => {
          const elapsed = (performance.now() - wallStart) / 1000;
          if (elapsed >= durationSec) {
            this.stopTone();
            onSweepFreq?.(endHz);
            return;
          }
          const curHz = Math.round(startHz * Math.pow(endHz / startHz, elapsed / durationSec));
          this.activeFreqHz = curHz;
          onSweepFreq?.(curHz);
        }, 80);
      }
    }

    this.gainNode = gain;
    this.pannerNode = panner;
    this.activeAudioMode = mode;
  }

  public setToneFrequency(freqHz: number): void {
    this.activeFreqHz = Math.max(20, Math.min(18000, Math.round(freqHz)));
    if (this.oscillator && this.audioCtx && this.activeAudioMode !== 'sweep') {
      this.oscillator.frequency.setTargetAtTime(this.activeFreqHz, this.audioCtx.currentTime, 0.02);
    }
  }

  public stopTone(): void {
    if (this.sweepTimer !== null) {
      clearInterval(this.sweepTimer);
      this.sweepTimer = null;
    }
    try {
      this.oscillator?.stop();
      this.oscillator?.disconnect();
      this.noiseSource?.stop();
      this.noiseSource?.disconnect();
      this.gainNode?.disconnect();
      this.pannerNode?.disconnect();
    } catch {
      // Ignore already stopped nodes
    }
    this.oscillator = null;
    this.noiseSource = null;
    this.gainNode = null;
    this.pannerNode = null;
    this.activeAudioMode = 'off';
  }

  public async listVideoDevices(): Promise<Array<{ deviceId: string; label: string }>> {
    if (!navigator.mediaDevices?.enumerateDevices) return [];
    try {
      const devs = await navigator.mediaDevices.enumerateDevices();
      return devs
        .filter((d) => d.kind === 'videoinput')
        .map((d, idx) => ({
          deviceId: d.deviceId,
          label: d.label || `Kamera #${idx + 1}`,
        }));
    } catch {
      return [];
    }
  }

  public async startCamera(
    videoEl: HTMLVideoElement,
    opts?: { deviceId?: string; width?: number; height?: number }
  ): Promise<{ width: number; height: number; fps: number; label: string; deviceId: string }> {
    this.stopCamera();
    const width = opts?.width ?? 1280;
    const height = opts?.height ?? 720;
    const videoConstraints: MediaTrackConstraints = {
      width: { ideal: width },
      height: { ideal: height },
      frameRate: { ideal: 60 },
      ...(opts?.deviceId ? { deviceId: { exact: opts.deviceId } } : {}),
    };
    const stream = await navigator.mediaDevices.getUserMedia({
      video: videoConstraints,
      audio: false,
    });
    this.camStream = stream;
    videoEl.srcObject = stream;
    await videoEl.play();
    const track = stream.getVideoTracks()[0];
    const settings = track?.getSettings() || {};
    return {
      width: settings.width || videoEl.videoWidth || 640,
      height: settings.height || videoEl.videoHeight || 480,
      fps: Math.round(settings.frameRate || 30),
      label: track?.label || 'Kamera wbudowana / USB',
      deviceId: settings.deviceId || opts?.deviceId || '',
    };
  }

  public stopCamera(videoEl?: HTMLVideoElement | null): void {
    if (this.camStream) {
      this.camStream.getTracks().forEach((t) => t.stop());
      this.camStream = null;
    }
    if (videoEl) {
      videoEl.srcObject = null;
    }
  }

  public async startMicrophone(
    onLevel: (levelPct: number, peakDb: number, label: string) => void,
    deviceId?: string
  ): Promise<string> {
    this.stopMicrophone();
    const audioConstraint: MediaTrackConstraints | boolean = deviceId
      ? { deviceId: { exact: deviceId } }
      : true;
    const stream = await navigator.mediaDevices.getUserMedia({ audio: audioConstraint, video: false });
    this.micStream = stream;
    const track = stream.getAudioTracks()[0];
    const label = track?.label || 'Mikrofon systemowy';

    const ctx = new AudioContext();
    const source = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    source.connect(analyser);

    this.micCtx = ctx;
    this.micAnalyser = analyser;
    const data = new Uint8Array(analyser.frequencyBinCount);

    const poll = () => {
      if (!this.micAnalyser) return;
      this.micAnalyser.getByteTimeDomainData(data);
      let sumSq = 0;
      for (let i = 0; i < data.length; i++) {
        const norm = (data[i] - 128) / 128;
        sumSq += norm * norm;
      }
      const rms = Math.sqrt(sumSq / data.length);
      const levelPct = Math.min(100, Math.round(rms * 280));
      const db = rms > 0.0001 ? Math.max(-60, Math.round(20 * Math.log10(rms))) : -60;
      onLevel(levelPct, db, label);
      this.micRafId = requestAnimationFrame(poll);
    };
    this.micRafId = requestAnimationFrame(poll);
    return label;
  }

  public async recordMicSample(durationMs = 4000): Promise<string> {
    const stream = this.micStream || (await navigator.mediaDevices.getUserMedia({ audio: true, video: false }));
    const ownsStream = !this.micStream;

    return new Promise((resolve, reject) => {
      try {
        const chunks: BlobPart[] = [];
        const rec = new MediaRecorder(stream);
        this.recorder = rec;
        rec.ondataavailable = (ev) => {
          if (ev.data.size > 0) chunks.push(ev.data);
        };
        rec.onerror = () => {
          if (ownsStream) stream.getTracks().forEach((t) => t.stop());
          reject(new Error('Błąd nagrywania mikrofonu'));
        };
        rec.onstop = () => {
          if (ownsStream) stream.getTracks().forEach((t) => t.stop());
          if (this.recordedAudioUrl) URL.revokeObjectURL(this.recordedAudioUrl);
          const blob = new Blob(chunks, { type: rec.mimeType || 'audio/webm' });
          this.recordedAudioUrl = URL.createObjectURL(blob);
          this.recorder = null;
          resolve(this.recordedAudioUrl);
        };
        rec.start();
        window.setTimeout(() => {
          if (rec.state === 'recording') rec.stop();
        }, durationMs);
      } catch (err) {
        if (ownsStream) stream.getTracks().forEach((t) => t.stop());
        reject(err);
      }
    });
  }

  public stopMicrophone(): void {
    cancelAnimationFrame(this.micRafId);
    this.micRafId = 0;
    if (this.recorder && this.recorder.state === 'recording') {
      try {
        this.recorder.stop();
      } catch {
        // Ignore
      }
    }
    this.recorder = null;
    if (this.micStream) {
      this.micStream.getTracks().forEach((t) => t.stop());
      this.micStream = null;
    }
    if (this.micCtx) {
      void this.micCtx.close();
      this.micCtx = null;
    }
    this.micAnalyser = null;
  }

  public isCameraActive(): boolean {
    return this.camStream !== null;
  }

  public isMicActive(): boolean {
    return this.micStream !== null;
  }

  public stopAll(): void {
    this.stopTone();
    this.stopCamera();
    this.stopMicrophone();
  }
}

export const peripheralsTestService = new PeripheralsTestService();
