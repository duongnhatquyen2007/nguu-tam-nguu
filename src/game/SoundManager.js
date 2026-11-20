export class SoundManager {
  constructor() {
    this.ctx = null;
    this.enabled = true;
    this.hapticEnabled = true;
    this.activeTrack = 'track_folk_edm_1';
    this.nextNoteTime = 0;
    this.stepIndex = 0;
    this.bpm = 115;
    this.isPlayingMusic = false;
  }

  ensureContext() {
    if (!this.enabled) return null;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  getTime() {
    if (this.ctx && this.ctx.state === 'running') {
      return this.ctx.currentTime;
    }
    return performance.now() / 1000;
  }

  setEnabled(val) {
    this.enabled = Boolean(val);
    if (!this.enabled) {
      this.stopMusic();
    }
  }

  setHapticEnabled(val) {
    this.hapticEnabled = Boolean(val);
  }

  setTrack(trackId) {
    this.activeTrack = trackId;
  }

  vibrate(pattern) {
    if (!this.hapticEnabled) return;
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      try {
        navigator.vibrate(pattern);
      } catch {
        // Ignore vibrate failure
      }
    }
  }

  startMusic(bpm, trackId) {
    this.bpm = bpm;
    if (trackId) this.activeTrack = trackId;
    const ctx = this.ensureContext();
    this.isPlayingMusic = true;
    this.stepIndex = 0;
    this.nextNoteTime = ctx ? ctx.currentTime + 0.04 : performance.now() / 1000;
  }

  stopMusic() {
    this.isPlayingMusic = false;
  }

  updateScheduler() {
    if (!this.isPlayingMusic || !this.enabled) return;
    const ctx = this.ctx;
    if (!ctx || ctx.state !== 'running') return;

    const sixteenthDur = 60 / this.bpm / 4;
    const lookahead = 0.14;

    while (this.nextNoteTime < ctx.currentTime + lookahead) {
      this.scheduleStep(this.stepIndex, this.nextNoteTime);
      this.nextNoteTime += sixteenthDur;
      this.stepIndex = (this.stepIndex + 1) % 16;
    }
  }

  scheduleStep(step, time) {
    const ctx = this.ctx;
    if (!ctx) return;

    // Beat 1, 2, 3, 4 (steps 0, 4, 8, 12) -> Trống cái / Kick
    if (step % 4 === 0) {
      this.synthKick(time, step === 0 ? 1.0 : 0.78);
    }

    // Offbeat woodblock / clack (steps 2, 6, 10, 14)
    if (step % 4 === 2) {
      this.synthWoodblock(time, this.activeTrack === 'track_hardstyle_3' ? 0.25 : 0.18);
    }

    // Snare / Trong dong accent on beats 2 & 4 (steps 4, 12)
    if (step === 4 || step === 12) {
      this.synthSnare(time, 0.28);
    }

    // Pentatonic melody / Bass line based on selected track
    const pentatonic = [293.66, 329.63, 392.0, 440.0, 523.25, 587.33]; // D4 E4 G4 A4 C5 D5
    if (this.activeTrack === 'track_folk_edm_1') {
      // Sáo trúc & Trống hội
      if (step === 0 || step === 3 || step === 6 || step === 8 || step === 11 || step === 14) {
        const note = pentatonic[(step * 3 + 1) % pentatonic.length];
        this.synthFlute(time, note, 0.14);
      }
      if (step % 4 === 0) {
        this.synthBass(time, 73.42, 0.22); // D2
      }
    } else if (this.activeTrack === 'track_drum_bass_2') {
      // Đàn nguyệt Bass + Trống đồng
      if (step % 2 === 0) {
        const bassNote = step < 8 ? 73.42 : step < 12 ? 82.41 : 98.0;
        this.synthBass(time, bassNote, 0.26);
      }
      if (step === 2 || step === 5 || step === 10 || step === 13) {
        const pluck = pentatonic[(step + 2) % pentatonic.length] * 1.5;
        this.synthPluck(time, pluck, 0.16);
      }
    } else {
      // Hardstyle Remix
      if (step % 2 === 0) {
        const sub = step % 4 === 0 ? 65.41 : 98.0;
        this.synthBass(time, sub, 0.30);
      }
      if (step % 4 === 1 || step % 4 === 3) {
        const lead = pentatonic[(step * 2) % pentatonic.length] * 1.5;
        this.synthPluck(time, lead, 0.18);
      }
    }
  }

  synthKick(time, gainVal) {
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(145, time);
    osc.frequency.exponentialRampToValueAtTime(42, time + 0.14);
    gain.gain.setValueAtTime(0.38 * gainVal, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.22);
    osc.connect(gain).connect(ctx.destination);
    osc.start(time);
    osc.stop(time + 0.24);
  }

  synthSnare(time, gainVal) {
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(240, time);
    osc.frequency.exponentialRampToValueAtTime(95, time + 0.09);
    gain.gain.setValueAtTime(gainVal, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.11);
    osc.connect(gain).connect(ctx.destination);
    osc.start(time);
    osc.stop(time + 0.12);
  }

  synthWoodblock(time, gainVal) {
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(860, time);
    osc.frequency.exponentialRampToValueAtTime(620, time + 0.045);
    gain.gain.setValueAtTime(gainVal * 0.28, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.055);
    osc.connect(gain).connect(ctx.destination);
    osc.start(time);
    osc.stop(time + 0.06);
  }

  synthFlute(time, freq, gainVal) {
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, time);
    gain.gain.setValueAtTime(0.001, time);
    gain.gain.linearRampToValueAtTime(gainVal * 0.45, time + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.18);
    osc.connect(gain).connect(ctx.destination);
    osc.start(time);
    osc.stop(time + 0.2);
  }

  synthPluck(time, freq, gainVal) {
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, time);
    gain.gain.setValueAtTime(gainVal * 0.55, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.14);
    osc.connect(gain).connect(ctx.destination);
    osc.start(time);
    osc.stop(time + 0.15);
  }

  synthBass(time, freq, gainVal) {
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(freq, time);
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(320, time);
    gain.gain.setValueAtTime(gainVal * 0.35, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.16);
    osc.connect(filter).connect(gain).connect(ctx.destination);
    osc.start(time);
    osc.stop(time + 0.17);
  }

  playTone(freqStart, freqEnd, dur, type = 'sine', volume = 0.22) {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freqStart, t);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, freqEnd), t + dur);
    gain.gain.setValueAtTime(volume, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  playTimingFeedback(judgment) {
    if (judgment === 'PERFECT') {
      this.playTone(587.33, 880, 0.18, 'triangle', 0.25);
      this.vibrate(25);
    } else if (judgment === 'GOOD') {
      this.playTone(440, 523.25, 0.12, 'sine', 0.16);
      this.vibrate(12);
    } else {
      this.playTone(160, 90, 0.12, 'sawtooth', 0.12);
    }
  }

  playSkill(skillId) {
    if (skillId === 'HUC') {
      this.playTone(220, 110, 0.14, 'triangle', 0.22);
    } else if (skillId === 'LAO') {
      this.playTone(180, 420, 0.18, 'sawtooth', 0.20);
    } else if (skillId === 'MOC') {
      this.playTone(300, 680, 0.16, 'triangle', 0.22);
    } else if (skillId === 'NE') {
      this.playTone(520, 260, 0.18, 'sine', 0.18);
    } else if (skillId === 'NO') {
      this.playRageSkill();
    }
  }

  playRageSkill() {
    this.playTone(130, 560, 0.26, 'sawtooth', 0.30);
    setTimeout(() => this.playTone(587.33, 196, 0.32, 'triangle', 0.28), 60);
    this.vibrate([45, 20, 70]);
  }

  playWeakPointHit() {
    this.playTone(660, 1320, 0.14, 'triangle', 0.24);
    this.vibrate(28);
  }

  playLaunchKnockback() {
    this.playTone(145, 42, 0.28, 'sawtooth', 0.34);
    this.vibrate([40, 20, 55]);
  }

  playImpact(heavy = false) {
    this.playTone(heavy ? 120 : 165, 38, heavy ? 0.26 : 0.16, 'sawtooth', heavy ? 0.34 : 0.22);
    this.vibrate(heavy ? [40, 20, 40] : 25);
  }

  playCounterCrit() {
    this.playTone(440, 1046, 0.24, 'triangle', 0.30);
    this.vibrate([30, 15, 50]);
  }

  playClashStart() {
    this.playTone(260, 520, 0.28, 'sawtooth', 0.26);
    this.vibrate([45, 25, 45]);
  }

  playClashResolve(won) {
    if (won) {
      this.playTone(392, 784, 0.35, 'triangle', 0.32);
      this.vibrate([50, 30, 60]);
    } else {
      this.playTone(240, 80, 0.35, 'sawtooth', 0.28);
      this.vibrate(80);
    }
  }

  playLinhNguuDrop() {
    this.playTone(293.66, 587.33, 0.4, 'triangle', 0.30);
    setTimeout(() => this.playTone(440, 880, 0.4, 'sine', 0.25), 90);
    this.vibrate([40, 20, 40, 20, 60]);
  }

  playThunderWarning() {
    this.playTone(320, 480, 0.22, 'sawtooth', 0.18);
  }

  playThunderStomp() {
    this.playTone(150, 35, 0.42, 'sawtooth', 0.35);
    this.vibrate([60, 25, 60]);
  }

  playVictory() {
    const notes = [392, 440, 523.25, 587.33, 784];
    notes.forEach((n, idx) => {
      setTimeout(() => this.playTone(n, n * 1.02, 0.28, 'triangle', 0.24), idx * 90);
    });
  }

  playDefeat() {
    const notes = [329.63, 293.66, 220];
    notes.forEach((n, idx) => {
      setTimeout(() => this.playTone(n, n * 0.94, 0.32, 'sine', 0.22), idx * 140);
    });
  }
}
