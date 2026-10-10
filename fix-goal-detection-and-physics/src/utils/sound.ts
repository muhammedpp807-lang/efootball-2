type Ctx = AudioContext;

class SoundManager {
  private ctx: Ctx | null = null;
  private crowdGain: GainNode | null = null;
  private crowdSource: AudioBufferSourceNode | null = null;
  private sfxOn = true;
  private crowdOn = true;

  private ensure(): Ctx | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtor = window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtor) return null;
      this.ctx = new AudioCtor();
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
    return this.ctx;
  }

  setSfx(on: boolean) { this.sfxOn = on; }

  setCrowd(on: boolean) {
    this.crowdOn = on;
    if (!on) this.stopCrowd();
  }

  private noiseBuffer(ctx: Ctx, seconds: number) {
    const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * seconds), ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let last = 0;
    for (let i = 0; i < data.length; i++) {
      const white = Math.random() * 2 - 1;
      last = (last + 0.02 * white) / 1.02;
      data[i] = last * 3.2;
    }
    return buffer;
  }

  /** Looping stadium ambience that sits quietly under the match. */
  startCrowd() {
    if (!this.crowdOn) return;
    const ctx = this.ensure();
    if (!ctx || this.crowdSource) return;

    const source = ctx.createBufferSource();
    source.buffer = this.noiseBuffer(ctx, 4);
    source.loop = true;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 620;
    filter.Q.value = 0.55;

    const gain = ctx.createGain();
    gain.gain.value = 0;
    gain.gain.linearRampToValueAtTime(0.055, ctx.currentTime + 1.4);

    source.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    source.start();

    this.crowdSource = source;
    this.crowdGain = gain;
  }

  stopCrowd() {
    if (this.crowdSource) {
      try { this.crowdSource.stop(); } catch { /* already stopped */ }
      this.crowdSource.disconnect();
      this.crowdSource = null;
      this.crowdGain = null;
    }
  }

  private tone(freq: number, endFreq: number, duration: number, volume: number, type: OscillatorType) {
    if (!this.sfxOn) return;
    const ctx = this.ensure();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), now + duration);
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.0008, now + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + duration + 0.02);
  }

  playKick(power = 1) { this.tone(150, 40, 0.11, 0.45 * power, 'sine'); }
  playPass() { this.tone(170, 60, 0.08, 0.3, 'triangle'); }
  playPost() { this.tone(430, 170, 0.25, 0.4, 'square'); }
  playSave() { this.tone(240, 120, 0.16, 0.3, 'sine'); }
  playUi() { this.tone(520, 460, 0.07, 0.12, 'sine'); }

  playWhistle(long = false) {
    if (!this.sfxOn) return;
    const ctx = this.ensure();
    if (!ctx) return;
    const now = ctx.currentTime;
    const duration = long ? 0.7 : 0.26;
    const osc = ctx.createOscillator();
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.value = 2900;
    lfo.frequency.value = 22;
    lfoGain.gain.value = 90;
    lfo.connect(lfoGain);
    lfoGain.connect(osc.frequency);

    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now); lfo.start(now);
    osc.stop(now + duration); lfo.stop(now + duration);
  }

  /** Big crowd roar plus goal horn. */
  playGoal() {
    const ctx = this.ensure();
    if (!ctx) return;
    const now = ctx.currentTime;

    if (this.crowdGain) {
      this.crowdGain.gain.cancelScheduledValues(now);
      this.crowdGain.gain.setValueAtTime(this.crowdGain.gain.value, now);
      this.crowdGain.gain.linearRampToValueAtTime(0.34, now + 0.25);
      this.crowdGain.gain.linearRampToValueAtTime(0.055, now + 3.4);
    }

    if (!this.sfxOn) return;
    [196, 246.94, 293.66].forEach((freq, index) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, now + index * 0.05);
      gain.gain.linearRampToValueAtTime(0.1, now + 0.15 + index * 0.05);
      gain.gain.exponentialRampToValueAtTime(0.0008, now + 2);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + index * 0.05);
      osc.stop(now + 2.1);
    });
  }
}

export const sound = new SoundManager();
