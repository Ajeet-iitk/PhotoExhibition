// Advanced Procedural Web Audio Engine for Gallery Atmosphere & Sound Effects
class SoundManager {
  constructor() {
    this.ctx = null;
    this.isMuted = false;
    this.musicVolume = 0.45;
    this.sfxVolume = 0.65;
    this.isPlaying = false;
    this.currentTrackIndex = 0;
    this.tracks = [
      { id: 'serene', name: 'Serene Gallery Lounge', tempo: 72, scale: [261.63, 293.66, 329.63, 392.00, 440.00, 523.25] },
      { id: 'golden', name: 'Golden Nostalgia (Acoustic)', tempo: 64, scale: [220.00, 261.63, 293.66, 329.63, 392.00, 440.00] },
      { id: 'midnight', name: 'Midnight Museum Atmosphere', tempo: 56, scale: [196.00, 220.00, 261.63, 329.63, 392.00, 493.88] }
    ];

    this.musicLoopTimer = null;
    this.analyser = null;
    this.dataArray = null;
    this.masterGain = null;
    this.musicGain = null;
    this.sfxGain = null;
    this.stepCounter = 0;
  }

  init() {
    if (this.ctx) return;
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    this.ctx = new AudioContext();

    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.setValueAtTime(1.0, this.ctx.currentTime);
    this.masterGain.connect(this.ctx.destination);

    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.setValueAtTime(this.musicVolume, this.ctx.currentTime);
    this.musicGain.connect(this.masterGain);

    this.sfxGain = this.ctx.createGain();
    this.sfxGain.gain.setValueAtTime(this.sfxVolume, this.ctx.currentTime);
    this.sfxGain.connect(this.masterGain);

    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 64;
    this.musicGain.connect(this.analyser);
    this.dataArray = new Uint8Array(this.analyser.frequencyBinCount);
  }

  ensureContext() {
    if (!this.ctx) this.init();
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  playMusic() {
    this.ensureContext();
    if (this.isPlaying) return;
    this.isPlaying = true;
    this.scheduleNextChords();
  }

  pauseMusic() {
    this.isPlaying = false;
    if (this.musicLoopTimer) {
      clearTimeout(this.musicLoopTimer);
      this.musicLoopTimer = null;
    }
  }

  toggleMusic() {
    if (this.isPlaying) {
      this.pauseMusic();
    } else {
      this.playMusic();
    }
    return this.isPlaying;
  }

  nextTrack() {
    this.currentTrackIndex = (this.currentTrackIndex + 1) % this.tracks.length;
    if (this.isPlaying) {
      this.pauseMusic();
      this.playMusic();
    }
    return this.tracks[this.currentTrackIndex];
  }

  prevTrack() {
    this.currentTrackIndex = (this.currentTrackIndex - 1 + this.tracks.length) % this.tracks.length;
    if (this.isPlaying) {
      this.pauseMusic();
      this.playMusic();
    }
    return this.tracks[this.currentTrackIndex];
  }

  getCurrentTrack() {
    return this.tracks[this.currentTrackIndex];
  }

  setMusicVolume(val) {
    this.musicVolume = Math.max(0, Math.min(1, val));
    if (this.musicGain && this.ctx) {
      this.musicGain.gain.setTargetAtTime(this.isMuted ? 0 : this.musicVolume, this.ctx.currentTime, 0.05);
    }
  }

  toggleMute() {
    this.isMuted = !this.isMuted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(this.isMuted ? 0 : 1, this.ctx.currentTime, 0.05);
    }
    return this.isMuted;
  }

  // Synthesizes a warm, soothing Rhodes / ambient chord progression
  scheduleNextChords() {
    if (!this.isPlaying || !this.ctx) return;

    const track = this.tracks[this.currentTrackIndex];
    const baseFreqs = track.scale;
    const now = this.ctx.currentTime;
    const duration = (60 / track.tempo) * 3.5;

    // Pick 3 harmonic notes for a lush 7th / 9th chord
    const rootIdx = Math.floor(Math.random() * 3);
    const chordNotes = [
      baseFreqs[rootIdx],
      baseFreqs[(rootIdx + 2) % baseFreqs.length],
      baseFreqs[(rootIdx + 4) % baseFreqs.length] * 0.5
    ];

    chordNotes.forEach((freq, i) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const filter = this.ctx.createBiquadFilter();

      // Warm triangle / sine blend
      osc.type = i === 2 ? 'sine' : 'triangle';
      osc.frequency.setValueAtTime(freq, now + i * 0.08);

      // Lowpass filter for smooth jazz / chill ambient aesthetic
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(800 + Math.random() * 400, now);
      filter.frequency.exponentialRampToValueAtTime(350, now + duration);

      // Soft envelope
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.12, now + 0.5);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.musicGain);

      osc.start(now);
      osc.stop(now + duration + 0.1);
    });

    // Sub-bass root
    const bassOsc = this.ctx.createOscillator();
    const bassGain = this.ctx.createGain();
    bassOsc.type = 'sine';
    bassOsc.frequency.setValueAtTime(baseFreqs[rootIdx] * 0.5, now);
    bassGain.gain.setValueAtTime(0.001, now);
    bassGain.gain.linearRampToValueAtTime(0.08, now + 0.4);
    bassGain.gain.exponentialRampToValueAtTime(0.0001, now + duration * 0.9);

    bassOsc.connect(bassGain);
    bassGain.connect(this.musicGain);
    bassOsc.start(now);
    bassOsc.stop(now + duration);

    // Schedule next beat
    const nextInterval = (duration * 0.85) * 1000;
    this.musicLoopTimer = setTimeout(() => {
      this.scheduleNextChords();
    }, nextInterval);
  }

  // SFX: Footstep sound when moving in 3D
  playFootstep() {
    this.ensureContext();
    if (this.isMuted || !this.ctx) return;
    this.stepCounter++;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();

    osc.type = 'sine';
    // Alternate pitch slightly between left and right footsteps
    const baseFreq = this.stepCounter % 2 === 0 ? 82 : 76;
    osc.frequency.setValueAtTime(baseFreq + (Math.random() * 6 - 3), now);
    osc.frequency.exponentialRampToValueAtTime(35, now + 0.08);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(260, now);

    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.09);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(now);
    osc.stop(now + 0.1);
  }

  // SFX: Camera Shutter Click when inspecting a photo
  playCameraShutter() {
    this.ensureContext();
    if (this.isMuted || !this.ctx) return;
    const now = this.ctx.currentTime;

    // Mechanical click 1
    this.playNoiseClick(now, 0.03, 1400);
    // Mechanical click 2 (rebound)
    this.playNoiseClick(now + 0.06, 0.04, 900);
  }

  playNoiseClick(time, duration, filterFreq) {
    const bufferSize = this.ctx.sampleRate * duration;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }

    const whiteNoise = this.ctx.createBufferSource();
    whiteNoise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(filterFreq, time);
    filter.Q.setValueAtTime(3, time);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.2, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + duration);

    whiteNoise.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);

    whiteNoise.start(time);
    whiteNoise.stop(time + duration);
  }

  // SFX: Teleport Swoosh
  playTeleport() {
    this.ensureContext();
    if (this.isMuted || !this.ctx) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(150, now);
    osc.frequency.exponentialRampToValueAtTime(620, now + 0.25);
    osc.frequency.exponentialRampToValueAtTime(200, now + 0.5);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.15, now + 0.2);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.5);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(now);
    osc.stop(now + 0.55);
  }

  // SFX: UI Click
  playClick() {
    this.ensureContext();
    if (this.isMuted || !this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(600, now);
    osc.frequency.exponentialRampToValueAtTime(300, now + 0.04);
    gain.gain.setValueAtTime(0.05, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.04);
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.05);
  }

  // Visualizer data retrieval
  getWaveformData() {
    if (!this.analyser || !this.isPlaying || this.isMuted) return null;
    this.analyser.getByteFrequencyData(this.dataArray);
    return this.dataArray;
  }
}

export const soundManager = new SoundManager();
