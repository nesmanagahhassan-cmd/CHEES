// Simple, rich procedural synthesizer utilizing Web Audio API for Chess Sound Effects
class AudioSynthesizer {
  private ctx: AudioContext | null = null;

  private initContext() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    return this.ctx;
  }

  // Soft wooden move pop
  playMove() {
    try {
      const ctx = this.initContext();
      if (!ctx) return;
      const now = ctx.currentTime;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(180, now);
      osc.frequency.exponentialRampToValueAtTime(80, now + 0.08);

      gain.gain.setValueAtTime(0.35, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.08);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.1);
    } catch (e) {
      console.warn('Audio playMove error:', e);
    }
  }

  // Resonant capture sound (crack & clash)
  playCapture() {
    try {
      const ctx = this.initContext();
      if (!ctx) return;
      const now = ctx.currentTime;

      // 1. Structural crack
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sawtooth';
      osc1.frequency.setValueAtTime(260, now);
      osc1.frequency.exponentialRampToValueAtTime(60, now + 0.15);
      gain1.gain.setValueAtTime(0.4, now);
      gain1.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);

      // 2. High metallic chime
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(880, now);
      osc2.frequency.setValueAtTime(1200, now + 0.02);
      gain2.gain.setValueAtTime(0.25, now);
      gain2.gain.exponentialRampToValueAtTime(0.01, now + 0.25);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);

      osc1.start(now);
      osc1.stop(now + 0.15);
      osc2.start(now);
      osc2.stop(now + 0.25);
    } catch (e) {
      console.warn('Audio playCapture error:', e);
    }
  }

  // Alarm-like dual-tone check warning
  playCheck() {
    try {
      const ctx = this.initContext();
      if (!ctx) return;
      const now = ctx.currentTime;

      const osc = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.linearRampToValueAtTime(554.37, now + 0.1);
      osc.frequency.linearRampToValueAtTime(440, now + 0.2);

      osc2.type = 'triangle';
      osc2.frequency.setValueAtTime(220, now);
      osc2.frequency.linearRampToValueAtTime(277.18, now + 0.1);
      osc2.frequency.linearRampToValueAtTime(220, now + 0.2);

      gain.gain.setValueAtTime(0.4, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.25);

      osc.connect(gain);
      osc2.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc2.start(now);
      osc.stop(now + 0.3);
      osc2.stop(now + 0.3);
    } catch (e) {
      console.warn('Audio playCheck error:', e);
    }
  }

  // Sparkling ascending arpeggio for victory/start
  playVictory() {
    try {
      const ctx = this.initContext();
      if (!ctx) return;
      const now = ctx.currentTime;

      const notes = [261.63, 329.63, 392.00, 523.25, 659.25, 783.99, 1046.50]; // C Major
      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now + idx * 0.08);

        gain.gain.setValueAtTime(0.2, now + idx * 0.08);
        gain.gain.exponentialRampToValueAtTime(0.005, now + idx * 0.08 + 0.3);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now + idx * 0.08);
        osc.stop(now + idx * 0.08 + 0.45);
      });
    } catch (e) {
      console.warn('Audio playVictory error:', e);
    }
  }

  // Gentle slide sweep for starting games
  playStart() {
    try {
      const ctx = this.initContext();
      if (!ctx) return;
      const now = ctx.currentTime;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(220, now);
      osc.frequency.exponentialRampToValueAtTime(880, now + 0.25);

      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.25);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.3);
    } catch (e) {
      console.warn('Audio playStart error:', e);
    }
  }
}

export const audio = new AudioSynthesizer();
export default audio;
