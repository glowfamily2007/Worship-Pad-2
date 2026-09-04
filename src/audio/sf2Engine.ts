// SoundFont 2 (SF2) Engine and Preset Registry
import { Sf2Bank, Sf2Preset, parseSf2File } from './sf2Parser';
import { midiToFreq, playDrumSound } from './soundGenerator';

export interface SoundPreset {
  id: string;
  name: string;
  category: 'Piano' | 'Organ' | 'Guitar' | 'Bass' | 'Strings' | 'Brass' | 'Choir' | 'Synth' | 'Drums' | 'Custom SF2';
  bankId: string;
  bankName: string;
  presetNumber: number;
  bankNumber: number;
  isCustomSf2?: boolean;
}

// Built-in authentic soundfont presets matching the user's Audio Evolution Mobile screenshot!
export const BUILTIN_SOUNDFONT_PRESETS: SoundPreset[] = [
  { id: 'gm-stereo-grand', name: 'Stereo Grand', category: 'Piano', bankId: 'gm-builtin', bankName: 'General MIDI SoundFont', presetNumber: 0, bankNumber: 0 },
  { id: 'gm-tine-electric-piano', name: 'Tine Electric Pia', category: 'Piano', bankId: 'gm-builtin', bankName: 'General MIDI SoundFont', presetNumber: 4, bankNumber: 0 },
  { id: 'gm-tonewheel-organ', name: 'Tonewheel Orga', category: 'Organ', bankId: 'gm-builtin', bankName: 'General MIDI SoundFont', presetNumber: 16, bankNumber: 0 },
  { id: 'gm-rock-organ', name: 'Rock Organ', category: 'Organ', bankId: 'gm-builtin', bankName: 'General MIDI SoundFont', presetNumber: 18, bankNumber: 0 },
  { id: 'gm-nylon-guitar', name: 'Nylon Guitar', category: 'Guitar', bankId: 'gm-builtin', bankName: 'General MIDI SoundFont', presetNumber: 24, bankNumber: 0 },
  { id: 'gm-finger-bass', name: 'Finger Bass', category: 'Bass', bankId: 'gm-builtin', bankName: 'General MIDI SoundFont', presetNumber: 33, bankNumber: 0 },
  { id: 'gm-stereo-strings', name: 'Stereo Strings F', category: 'Strings', bankId: 'gm-builtin', bankName: 'General MIDI SoundFont', presetNumber: 48, bankNumber: 0 },
  { id: 'gm-synth-strings', name: 'Synth Strings 2', category: 'Strings', bankId: 'gm-builtin', bankName: 'General MIDI SoundFont', presetNumber: 51, bankNumber: 0 },
  { id: 'gm-trumpet', name: 'Trumpet', category: 'Brass', bankId: 'gm-builtin', bankName: 'General MIDI SoundFont', presetNumber: 56, bankNumber: 0 },
  { id: 'gm-standard-drums', name: 'Standard', category: 'Drums', bankId: 'gm-builtin', bankName: 'General MIDI SoundFont', presetNumber: 0, bankNumber: 128 },
  { id: 'gm-concert-choir', name: 'Concert Choir', category: 'Choir', bankId: 'gm-builtin', bankName: 'General MIDI SoundFont', presetNumber: 52, bankNumber: 0 },
  { id: 'gm-brass-section', name: 'Brass Section', category: 'Brass', bankId: 'gm-builtin', bankName: 'General MIDI SoundFont', presetNumber: 61, bankNumber: 0 },
  // Extra General MIDI presets
  { id: 'gm-slap-bass', name: 'Slap Bass 1', category: 'Bass', bankId: 'gm-builtin', bankName: 'General MIDI SoundFont', presetNumber: 36, bankNumber: 0 },
  { id: 'gm-acoustic-guitar', name: 'Steel String Guitar', category: 'Guitar', bankId: 'gm-builtin', bankName: 'General MIDI SoundFont', presetNumber: 25, bankNumber: 0 },
  { id: 'gm-alto-sax', name: 'Alto Sax', category: 'Brass', bankId: 'gm-builtin', bankName: 'General MIDI SoundFont', presetNumber: 65, bankNumber: 0 },
  { id: 'gm-flute', name: 'Concert Flute', category: 'Brass', bankId: 'gm-builtin', bankName: 'General MIDI SoundFont', presetNumber: 73, bankNumber: 0 },
  { id: 'gm-synth-lead', name: 'Square Lead 80s', category: 'Synth', bankId: 'gm-builtin', bankName: 'General MIDI SoundFont', presetNumber: 80, bankNumber: 0 },
  { id: 'gm-warm-pad', name: 'Warm Pad Synth', category: 'Synth', bankId: 'gm-builtin', bankName: 'General MIDI SoundFont', presetNumber: 89, bankNumber: 0 },
];

export class SoundFontEngine {
  private static instance: SoundFontEngine | null = null;
  private customBanks: Map<string, Sf2Bank> = new Map();
  private uploadedPresets: SoundPreset[] = [];
  private activeVoices: { stop: () => void }[] = [];

  public static getInstance(): SoundFontEngine {
    if (!SoundFontEngine.instance) {
      SoundFontEngine.instance = new SoundFontEngine();
    }
    return SoundFontEngine.instance;
  }

  // Load and parse an uploaded .sf2 file
  public async loadSf2File(file: File, audioCtx: AudioContext | BaseAudioContext): Promise<Sf2Bank> {
    const arrayBuffer = await file.arrayBuffer();
    const bank = parseSf2File(arrayBuffer, file.name, audioCtx);
    this.customBanks.set(bank.id, bank);

    // Add presets to available list
    bank.presets.forEach(p => {
      this.uploadedPresets.push({
        id: `sf2-${bank.id}-${p.bank}-${p.preset}`,
        name: p.name || `Preset ${p.preset}`,
        category: 'Custom SF2',
        bankId: bank.id,
        bankName: bank.bankName,
        presetNumber: p.preset,
        bankNumber: p.bank,
        isCustomSf2: true,
      });
    });

    return bank;
  }

  public getAllPresets(): SoundPreset[] {
    return [...BUILTIN_SOUNDFONT_PRESETS, ...this.uploadedPresets];
  }

  public getUploadedBanks(): Sf2Bank[] {
    return Array.from(this.customBanks.values());
  }

  public getPresetById(presetId: string): SoundPreset | undefined {
    return this.getAllPresets().find(p => p.id === presetId || p.name === presetId);
  }

  // Stop all active SoundFont voices (Panic)
  public panic() {
    this.activeVoices.forEach(v => {
      try {
        v.stop();
      } catch {
        // already stopped
      }
    });
    this.activeVoices = [];
  }

  // Register an active voice with polyphony limit to protect CPU and prevent distortion
  private registerVoice(voice: { stop: (releaseSec?: number) => void }) {
    if (this.activeVoices.length >= 24) {
      const oldest = this.activeVoices.shift();
      if (oldest) {
        try {
          oldest.stop(0.02);
        } catch {
          // ok
        }
      }
    }
    this.activeVoices.push(voice);
  }

  // Start continuous SoundFont note (sustains until stop() is called, fades naturally within 6s)
  public startNote(
    ctx: AudioContext | BaseAudioContext,
    dest: AudioNode,
    presetIdentifier: string,
    pitch: number,
    velocity = 0.8,
    startTime = ctx.currentTime
  ): { stop: (releaseSec?: number) => void } {
    const preset = this.getPresetById(presetIdentifier);
    const presetName = preset ? preset.name : presetIdentifier;

    // Check if this is an uploaded SF2 preset with PCM samples
    if (preset && preset.isCustomSf2 && preset.bankId) {
      const bank = this.customBanks.get(preset.bankId);
      if (bank) {
        const sf2Preset = bank.presets.find(p => p.preset === preset.presetNumber && p.bank === preset.bankNumber);
        if (sf2Preset && sf2Preset.sampleHeaders.length > 0) {
          const sampleWithBuffer = sf2Preset.sampleHeaders.find(s => s.audioBuffer);
          if (sampleWithBuffer && sampleWithBuffer.audioBuffer) {
            return this.startSampleBufferVoice(ctx, dest, sampleWithBuffer.audioBuffer, sampleWithBuffer.originalPitch || 60, pitch, velocity, startTime);
          }
        }
      }
    }

    // High-fidelity synthesized acoustic SoundFont preset
    return this.startAcousticVoice(ctx, dest, presetName, pitch, velocity, startTime);
  }

  // Play SoundFont note for a set duration (convenience wrapper around startNote)
  public playNote(
    ctx: AudioContext | BaseAudioContext,
    dest: AudioNode,
    presetIdentifier: string,
    pitch: number,
    startTime: number,
    duration = 0.5,
    velocity = 0.8
  ) {
    const playStartTime = Math.max(startTime, ctx.currentTime);
    const voice = this.startNote(ctx, dest, presetIdentifier, pitch, velocity, playStartTime);
    const effectiveDur = Math.min(duration, 6.0);
    const stopTime = playStartTime + effectiveDur;
    const msUntilStop = Math.max(40, (stopTime - ctx.currentTime) * 1000);
    setTimeout(() => {
      voice.stop(0.12);
    }, msUntilStop);
  }

  private startSampleBufferVoice(
    ctx: AudioContext | BaseAudioContext,
    dest: AudioNode,
    buffer: AudioBuffer,
    rootPitch: number,
    pitch: number,
    velocity: number,
    startTime = ctx.currentTime
  ): { stop: (releaseSec?: number) => void } {
    try {
      const time = Math.max(startTime, ctx.currentTime);
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.loop = true;

      const semitoneRatio = Math.pow(2, (pitch - rootPitch) / 12);
      source.playbackRate.setValueAtTime(semitoneRatio, time);

      const gain = ctx.createGain();
      // Scaled peak volume for polyphonic headroom
      const peakVol = Math.pow(velocity, 1.2) * 0.35;
      gain.gain.setValueAtTime(0.0001, time);
      gain.gain.exponentialRampToValueAtTime(peakVol, time + 0.005);
      gain.gain.setValueAtTime(peakVol * 0.75, time + 0.1);
      // Sustain smoothly fades out in 6 seconds
      gain.gain.exponentialRampToValueAtTime(0.0001, time + 6.0);

      source.connect(gain);
      gain.connect(dest);
      source.start(time);
      source.stop(time + 6.05);

      let isStopped = false;
      const stop = (releaseSec = 0.12) => {
        if (isStopped) return;
        isStopped = true;
        try {
          const now = Math.max(ctx.currentTime, time);
          gain.gain.cancelScheduledValues(now);
          const currentVal = Math.max(0.0001, gain.gain.value);
          gain.gain.setValueAtTime(currentVal, now);
          gain.gain.exponentialRampToValueAtTime(0.0001, now + releaseSec);
          source.stop(now + releaseSec + 0.05);
          setTimeout(() => {
            try {
              source.disconnect();
              gain.disconnect();
            } catch {
              // ok
            }
          }, (releaseSec + 0.1) * 1000);
        } catch {
          // ok
        }
      };

      const voice = { stop };
      this.registerVoice(voice);
      return voice;
    } catch (err) {
      console.warn('Error starting sample buffer voice:', err);
      return { stop: () => {} };
    }
  }

  // Continuous sound synthesizers matching the screenshot
  private startAcousticVoice(
    ctx: AudioContext | BaseAudioContext,
    dest: AudioNode,
    name: string,
    pitch: number,
    velocity: number,
    startTime = ctx.currentTime
  ): { stop: (releaseSec?: number) => void } {
    const freq = midiToFreq(pitch);
    const lower = name.toLowerCase();

    if (lower.includes('standard') || lower.includes('drum')) {
      playDrumSound(ctx, dest, pitch, Math.max(startTime, ctx.currentTime), velocity);
      return { stop: () => {} };
    }

    if (lower.includes('tine') || lower.includes('rhodes') || lower.includes('electric pia')) {
      return this.startTineElectricPiano(ctx, dest, freq, velocity, startTime);
    } else if (lower.includes('tonewheel') || lower.includes('b3') || (lower.includes('orga') && !lower.includes('rock'))) {
      return this.startTonewheelOrgan(ctx, dest, freq, velocity, startTime);
    } else if (lower.includes('rock organ')) {
      return this.startRockOrgan(ctx, dest, freq, velocity, startTime);
    } else if (lower.includes('nylon') || lower.includes('guitar')) {
      return this.startNylonGuitar(ctx, dest, freq, velocity, startTime);
    } else if (lower.includes('finger bass') || lower.includes('bass')) {
      return this.startFingerBass(ctx, dest, freq, velocity, startTime);
    } else if (lower.includes('stereo strings') || lower.includes('strings f')) {
      return this.startStereoStrings(ctx, dest, freq, velocity, startTime);
    } else if (lower.includes('synth strings')) {
      return this.startSynthStrings(ctx, dest, freq, velocity, startTime);
    } else if (lower.includes('trumpet') || lower.includes('horn')) {
      return this.startTrumpet(ctx, dest, freq, velocity, startTime);
    } else if (lower.includes('choir') || lower.includes('voice')) {
      return this.startConcertChoir(ctx, dest, freq, velocity, startTime);
    } else if (lower.includes('brass')) {
      return this.startBrassSection(ctx, dest, freq, velocity, startTime);
    } else {
      // Default: Stereo Grand Piano
      return this.startStereoGrand(ctx, dest, freq, velocity, startTime);
    }
  }

  // 1. Stereo Grand Piano (Held key lifts damper: sustain fades naturally in 6s; key release drops damper in 0.12s)
  private startStereoGrand(ctx: AudioContext | BaseAudioContext, dest: AudioNode, freq: number, velocity: number, startTime = ctx.currentTime) {
    const time = Math.max(startTime, ctx.currentTime);
    const gain = ctx.createGain();
    gain.connect(dest);

    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const osc3 = ctx.createOscillator();

    osc1.type = 'triangle';
    osc2.type = 'sine';
    osc3.type = 'sine';

    osc1.frequency.setValueAtTime(freq, time);
    osc2.frequency.setValueAtTime(freq * 2, time);
    osc3.frequency.setValueAtTime(freq * 3, time);

    osc1.detune.setValueAtTime(-2.5, time);
    osc2.detune.setValueAtTime(3.5, time);

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(Math.min(freq * 6 * velocity, 10000), time);
    filter.frequency.exponentialRampToValueAtTime(Math.max(freq * 1.5, 300), time + 6.0);

    // Controlled peak volume to prevent polyphonic summing distortion
    const peakVol = Math.pow(velocity, 1.2) * 0.18;
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.exponentialRampToValueAtTime(peakVol, time + 0.005);
    gain.gain.exponentialRampToValueAtTime(peakVol * 0.6, time + 0.14);
    // Sustain on the sound fades smoothly over 6 seconds
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 6.0);

    osc1.connect(filter);
    osc2.connect(filter);
    osc3.connect(filter);
    filter.connect(gain);

    osc1.start(time);
    osc2.start(time);
    osc3.start(time);
    osc1.stop(time + 6.05);
    osc2.stop(time + 6.05);
    osc3.stop(time + 6.05);

    let isStopped = false;
    const stop = (releaseSec = 0.12) => {
      if (isStopped) return;
      isStopped = true;
      try {
        const now = Math.max(ctx.currentTime, time);
        gain.gain.cancelScheduledValues(now);
        const cur = Math.max(0.0001, gain.gain.value);
        gain.gain.setValueAtTime(cur, now);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + releaseSec);
        osc1.stop(now + releaseSec + 0.04);
        osc2.stop(now + releaseSec + 0.04);
        osc3.stop(now + releaseSec + 0.04);
        setTimeout(() => {
          try {
            osc1.disconnect(); osc2.disconnect(); osc3.disconnect(); filter.disconnect(); gain.disconnect();
          } catch {}
        }, (releaseSec + 0.1) * 1000);
      } catch {}
    };

    const voice = { stop };
    this.registerVoice(voice);
    return voice;
  }

  // 2. Tine Electric Piano (Rhodes FM Bell: sustain fades in 6s)
  private startTineElectricPiano(ctx: AudioContext | BaseAudioContext, dest: AudioNode, freq: number, velocity: number, startTime = ctx.currentTime) {
    const time = Math.max(startTime, ctx.currentTime);
    const gain = ctx.createGain();
    gain.connect(dest);

    const carrier = ctx.createOscillator();
    carrier.type = 'sine';
    carrier.frequency.setValueAtTime(freq, time);

    const mod = ctx.createOscillator();
    const modGain = ctx.createGain();
    mod.type = 'sine';
    mod.frequency.setValueAtTime(freq * 7, time);

    const modDepth = freq * 2.5 * velocity;
    modGain.gain.setValueAtTime(modDepth, time);
    modGain.gain.exponentialRampToValueAtTime(0.01, time + 0.35);
    mod.connect(modGain);
    modGain.connect(carrier.frequency);

    const peakVol = velocity * 0.22;
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.exponentialRampToValueAtTime(peakVol, time + 0.006);
    gain.gain.exponentialRampToValueAtTime(peakVol * 0.5, time + 0.3);
    // Sustain fades in 6 seconds
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 6.0);

    carrier.connect(gain);
    mod.start(time);
    carrier.start(time);
    mod.stop(time + 6.05);
    carrier.stop(time + 6.05);

    let isStopped = false;
    const stop = (releaseSec = 0.15) => {
      if (isStopped) return;
      isStopped = true;
      try {
        const now = Math.max(ctx.currentTime, time);
        gain.gain.cancelScheduledValues(now);
        const cur = Math.max(0.0001, gain.gain.value);
        gain.gain.setValueAtTime(cur, now);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + releaseSec);
        carrier.stop(now + releaseSec + 0.04);
        mod.stop(now + releaseSec + 0.04);
        setTimeout(() => {
          try { carrier.disconnect(); mod.disconnect(); gain.disconnect(); } catch {}
        }, (releaseSec + 0.1) * 1000);
      } catch {}
    };

    const voice = { stop };
    this.registerVoice(voice);
    return voice;
  }

  // 3. Tonewheel Organ (B3 Drawbars: sustain fades in 6s)
  private startTonewheelOrgan(ctx: AudioContext | BaseAudioContext, dest: AudioNode, freq: number, velocity: number, startTime = ctx.currentTime) {
    const time = Math.max(startTime, ctx.currentTime);
    const gain = ctx.createGain();
    gain.connect(dest);

    const o1 = ctx.createOscillator();
    const o2 = ctx.createOscillator();
    const o3 = ctx.createOscillator();

    o1.type = 'sine';
    o2.type = 'sine';
    o3.type = 'sine';

    o1.frequency.setValueAtTime(freq * 0.5, time); // 16'
    o2.frequency.setValueAtTime(freq, time); // 8'
    o3.frequency.setValueAtTime(freq * 1.5, time); // 5 1/3'

    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    lfo.frequency.setValueAtTime(5.8, time);
    lfoGain.gain.setValueAtTime(4, time);
    lfo.connect(lfoGain);
    lfoGain.connect(o1.detune);
    lfoGain.connect(o2.detune);

    const peakVol = velocity * 0.14;
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.linearRampToValueAtTime(peakVol, time + 0.015);
    // Sustain fades in 6 seconds
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 6.0);

    o1.connect(gain);
    o2.connect(gain);
    o3.connect(gain);

    lfo.start(time);
    o1.start(time);
    o2.start(time);
    o3.start(time);
    lfo.stop(time + 6.05);
    o1.stop(time + 6.05);
    o2.stop(time + 6.05);
    o3.stop(time + 6.05);

    let isStopped = false;
    const stop = (releaseSec = 0.08) => {
      if (isStopped) return;
      isStopped = true;
      try {
        const now = Math.max(ctx.currentTime, time);
        gain.gain.cancelScheduledValues(now);
        const cur = Math.max(0.0001, gain.gain.value);
        gain.gain.setValueAtTime(cur, now);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + releaseSec);
        lfo.stop(now + releaseSec + 0.02);
        o1.stop(now + releaseSec + 0.02);
        o2.stop(now + releaseSec + 0.02);
        o3.stop(now + releaseSec + 0.02);
        setTimeout(() => {
          try { o1.disconnect(); o2.disconnect(); o3.disconnect(); lfo.disconnect(); gain.disconnect(); } catch {}
        }, (releaseSec + 0.1) * 1000);
      } catch {}
    };

    const voice = { stop };
    this.registerVoice(voice);
    return voice;
  }

  // 4. Rock Organ (Percussive click + overdrive: sustain fades in 6s)
  private startRockOrgan(ctx: AudioContext | BaseAudioContext, dest: AudioNode, freq: number, velocity: number, startTime = ctx.currentTime) {
    const time = Math.max(startTime, ctx.currentTime);
    const gain = ctx.createGain();
    gain.connect(dest);

    const o1 = ctx.createOscillator();
    const o2 = ctx.createOscillator();
    o1.type = 'triangle';
    o2.type = 'sawtooth';

    o1.frequency.setValueAtTime(freq, time);
    o2.frequency.setValueAtTime(freq * 2, time);

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(3000, time);

    const peakVol = velocity * 0.16;
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.linearRampToValueAtTime(peakVol, time + 0.008);
    gain.gain.setValueAtTime(peakVol * 0.85, time + 0.05);
    // Sustain fades in 6 seconds
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 6.0);

    o1.connect(filter);
    o2.connect(filter);
    filter.connect(gain);

    o1.start(time);
    o2.start(time);
    o1.stop(time + 6.05);
    o2.stop(time + 6.05);

    let isStopped = false;
    const stop = (releaseSec = 0.08) => {
      if (isStopped) return;
      isStopped = true;
      try {
        const now = Math.max(ctx.currentTime, time);
        gain.gain.cancelScheduledValues(now);
        const cur = Math.max(0.0001, gain.gain.value);
        gain.gain.setValueAtTime(cur, now);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + releaseSec);
        o1.stop(now + releaseSec + 0.02);
        o2.stop(now + releaseSec + 0.02);
        setTimeout(() => {
          try { o1.disconnect(); o2.disconnect(); filter.disconnect(); gain.disconnect(); } catch {}
        }, (releaseSec + 0.1) * 1000);
      } catch {}
    };

    const voice = { stop };
    this.registerVoice(voice);
    return voice;
  }

  // 5. Nylon Guitar (Acoustic Pluck with warm string body: sustain fades in 6s)
  private startNylonGuitar(ctx: AudioContext | BaseAudioContext, dest: AudioNode, freq: number, velocity: number, startTime = ctx.currentTime) {
    const time = Math.max(startTime, ctx.currentTime);
    const gain = ctx.createGain();
    gain.connect(dest);

    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, time);

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(freq * 2, time);
    filter.Q.setValueAtTime(2.0, time);

    const peakVol = velocity * 0.22;
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.exponentialRampToValueAtTime(peakVol, time + 0.006);
    gain.gain.exponentialRampToValueAtTime(peakVol * 0.45, time + 0.18);
    // Sustain fades in 6 seconds
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 6.0);

    osc.connect(filter);
    filter.connect(gain);
    osc.start(time);
    osc.stop(time + 6.05);

    let isStopped = false;
    const stop = (releaseSec = 0.1) => {
      if (isStopped) return;
      isStopped = true;
      try {
        const now = Math.max(ctx.currentTime, time);
        gain.gain.cancelScheduledValues(now);
        const cur = Math.max(0.0001, gain.gain.value);
        gain.gain.setValueAtTime(cur, now);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + releaseSec);
        osc.stop(now + releaseSec + 0.02);
        setTimeout(() => {
          try { osc.disconnect(); filter.disconnect(); gain.disconnect(); } catch {}
        }, (releaseSec + 0.1) * 1000);
      } catch {}
    };

    const voice = { stop };
    this.registerVoice(voice);
    return voice;
  }

  // 6. Finger Bass (Electric Bass with sustained fundamental: sustain fades in 6s)
  private startFingerBass(ctx: AudioContext | BaseAudioContext, dest: AudioNode, freq: number, velocity: number, startTime = ctx.currentTime) {
    const time = Math.max(startTime, ctx.currentTime);
    const gain = ctx.createGain();
    gain.connect(dest);

    const o1 = ctx.createOscillator();
    const o2 = ctx.createOscillator();
    o1.type = 'sine';
    o2.type = 'triangle';

    o1.frequency.setValueAtTime(freq, time);
    o2.frequency.setValueAtTime(freq * 2, time);

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(Math.min(freq * 3.5 * velocity, 2000), time);

    const peakVol = velocity * 0.24;
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.exponentialRampToValueAtTime(peakVol, time + 0.008);
    gain.gain.exponentialRampToValueAtTime(peakVol * 0.7, time + 0.15);
    // Sustain fades in 6 seconds
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 6.0);

    o1.connect(filter);
    o2.connect(filter);
    filter.connect(gain);

    o1.start(time);
    o2.start(time);
    o1.stop(time + 6.05);
    o2.stop(time + 6.05);

    let isStopped = false;
    const stop = (releaseSec = 0.08) => {
      if (isStopped) return;
      isStopped = true;
      try {
        const now = Math.max(ctx.currentTime, time);
        gain.gain.cancelScheduledValues(now);
        const cur = Math.max(0.0001, gain.gain.value);
        gain.gain.setValueAtTime(cur, now);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + releaseSec);
        o1.stop(now + releaseSec + 0.02);
        o2.stop(now + releaseSec + 0.02);
        setTimeout(() => {
          try { o1.disconnect(); o2.disconnect(); filter.disconnect(); gain.disconnect(); } catch {}
        }, (releaseSec + 0.1) * 1000);
      } catch {}
    };

    const voice = { stop };
    this.registerVoice(voice);
    return voice;
  }

  // 7. Stereo Strings F (Orchestral String Section: sustain fades in 6s)
  private startStereoStrings(ctx: AudioContext | BaseAudioContext, dest: AudioNode, freq: number, velocity: number, startTime = ctx.currentTime) {
    const time = Math.max(startTime, ctx.currentTime);
    const gain = ctx.createGain();
    gain.connect(dest);

    const oscL = ctx.createOscillator();
    const oscR = ctx.createOscillator();
    oscL.type = 'sawtooth';
    oscR.type = 'sawtooth';

    oscL.frequency.setValueAtTime(freq, time);
    oscR.frequency.setValueAtTime(freq, time);
    oscL.detune.setValueAtTime(-10, time);
    oscR.detune.setValueAtTime(10, time);

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(Math.min(freq * 3.2, 4000), time);

    const peakVol = velocity * 0.15;
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.linearRampToValueAtTime(peakVol, time + 0.12);
    // Sustain fades in 6 seconds
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 6.0);

    oscL.connect(filter);
    oscR.connect(filter);
    filter.connect(gain);

    oscL.start(time);
    oscR.start(time);
    oscL.stop(time + 6.05);
    oscR.stop(time + 6.05);

    let isStopped = false;
    const stop = (releaseSec = 0.35) => {
      if (isStopped) return;
      isStopped = true;
      try {
        const now = Math.max(ctx.currentTime, time);
        gain.gain.cancelScheduledValues(now);
        const cur = Math.max(0.0001, gain.gain.value);
        gain.gain.setValueAtTime(cur, now);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + releaseSec);
        oscL.stop(now + releaseSec + 0.04);
        oscR.stop(now + releaseSec + 0.04);
        setTimeout(() => {
          try { oscL.disconnect(); oscR.disconnect(); filter.disconnect(); gain.disconnect(); } catch {}
        }, (releaseSec + 0.1) * 1000);
      } catch {}
    };

    const voice = { stop };
    this.registerVoice(voice);
    return voice;
  }

  // 8. Synth Strings 2 (Analog 80s Strings: sustain fades in 6s)
  private startSynthStrings(ctx: AudioContext | BaseAudioContext, dest: AudioNode, freq: number, velocity: number, startTime = ctx.currentTime) {
    const time = Math.max(startTime, ctx.currentTime);
    const gain = ctx.createGain();
    gain.connect(dest);

    const o1 = ctx.createOscillator();
    const o2 = ctx.createOscillator();
    o1.type = 'sawtooth';
    o2.type = 'sawtooth';

    o1.frequency.setValueAtTime(freq, time);
    o2.frequency.setValueAtTime(freq, time);
    o1.detune.setValueAtTime(-8, time);
    o2.detune.setValueAtTime(8, time);

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(freq * 2.8, time);
    filter.Q.setValueAtTime(2.5, time);

    const peakVol = velocity * 0.15;
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.linearRampToValueAtTime(peakVol, time + 0.08);
    // Sustain fades in 6 seconds
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 6.0);

    o1.connect(filter);
    o2.connect(filter);
    filter.connect(gain);

    o1.start(time);
    o2.start(time);
    o1.stop(time + 6.05);
    o2.stop(time + 6.05);

    let isStopped = false;
    const stop = (releaseSec = 0.25) => {
      if (isStopped) return;
      isStopped = true;
      try {
        const now = Math.max(ctx.currentTime, time);
        gain.gain.cancelScheduledValues(now);
        const cur = Math.max(0.0001, gain.gain.value);
        gain.gain.setValueAtTime(cur, now);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + releaseSec);
        o1.stop(now + releaseSec + 0.04);
        o2.stop(now + releaseSec + 0.04);
        setTimeout(() => {
          try { o1.disconnect(); o2.disconnect(); filter.disconnect(); gain.disconnect(); } catch {}
        }, (releaseSec + 0.1) * 1000);
      } catch {}
    };

    const voice = { stop };
    this.registerVoice(voice);
    return voice;
  }

  // 9. Trumpet (Bright brass timbre with lip flare: sustain fades in 6s)
  private startTrumpet(ctx: AudioContext | BaseAudioContext, dest: AudioNode, freq: number, velocity: number, startTime = ctx.currentTime) {
    const time = Math.max(startTime, ctx.currentTime);
    const gain = ctx.createGain();
    gain.connect(dest);

    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(freq, time);

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(freq * 1.5, time);
    filter.frequency.exponentialRampToValueAtTime(Math.min(freq * 5 * velocity, 8000), time + 0.04);

    const peakVol = velocity * 0.20;
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.linearRampToValueAtTime(peakVol, time + 0.025);
    gain.gain.setValueAtTime(peakVol * 0.85, time + 0.05);
    // Sustain fades in 6 seconds
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 6.0);

    osc.connect(filter);
    filter.connect(gain);
    osc.start(time);
    osc.stop(time + 6.05);

    let isStopped = false;
    const stop = (releaseSec = 0.08) => {
      if (isStopped) return;
      isStopped = true;
      try {
        const now = Math.max(ctx.currentTime, time);
        gain.gain.cancelScheduledValues(now);
        const cur = Math.max(0.0001, gain.gain.value);
        gain.gain.setValueAtTime(cur, now);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + releaseSec);
        osc.stop(now + releaseSec + 0.02);
        setTimeout(() => {
          try { osc.disconnect(); filter.disconnect(); gain.disconnect(); } catch {}
        }, (releaseSec + 0.1) * 1000);
      } catch {}
    };

    const voice = { stop };
    this.registerVoice(voice);
    return voice;
  }

  // 10. Concert Choir (Vocal Formants Aah: sustain fades in 6s)
  private startConcertChoir(ctx: AudioContext | BaseAudioContext, dest: AudioNode, freq: number, velocity: number, startTime = ctx.currentTime) {
    const time = Math.max(startTime, ctx.currentTime);
    const gain = ctx.createGain();
    gain.connect(dest);

    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(freq, time);

    const formant = ctx.createBiquadFilter();
    formant.type = 'bandpass';
    formant.frequency.setValueAtTime(850, time);
    formant.Q.setValueAtTime(4.0, time);

    const peakVol = velocity * 0.18;
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.linearRampToValueAtTime(peakVol, time + 0.15);
    // Sustain fades in 6 seconds
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 6.0);

    osc.connect(formant);
    formant.connect(gain);
    osc.start(time);
    osc.stop(time + 6.05);

    let isStopped = false;
    const stop = (releaseSec = 0.35) => {
      if (isStopped) return;
      isStopped = true;
      try {
        const now = Math.max(ctx.currentTime, time);
        gain.gain.cancelScheduledValues(now);
        const cur = Math.max(0.0001, gain.gain.value);
        gain.gain.setValueAtTime(cur, now);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + releaseSec);
        osc.stop(now + releaseSec + 0.04);
        setTimeout(() => {
          try { osc.disconnect(); formant.disconnect(); gain.disconnect(); } catch {}
        }, (releaseSec + 0.1) * 1000);
      } catch {}
    };

    const voice = { stop };
    this.registerVoice(voice);
    return voice;
  }

  // 11. Brass Section (Multi-instrument brass ensemble: sustain fades in 6s)
  private startBrassSection(ctx: AudioContext | BaseAudioContext, dest: AudioNode, freq: number, velocity: number, startTime = ctx.currentTime) {
    const time = Math.max(startTime, ctx.currentTime);
    const gain = ctx.createGain();
    gain.connect(dest);

    const o1 = ctx.createOscillator();
    const o2 = ctx.createOscillator();
    o1.type = 'sawtooth';
    o2.type = 'sawtooth';

    o1.frequency.setValueAtTime(freq, time);
    o2.frequency.setValueAtTime(freq, time);
    o1.detune.setValueAtTime(-9, time);
    o2.detune.setValueAtTime(9, time);

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(freq * 1.8, time);
    filter.frequency.exponentialRampToValueAtTime(Math.min(freq * 4.5 * velocity, 10000), time + 0.05);

    const peakVol = velocity * 0.18;
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.linearRampToValueAtTime(peakVol, time + 0.03);
    gain.gain.setValueAtTime(peakVol * 0.9, time + 0.06);
    // Sustain fades in 6 seconds
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 6.0);

    o1.connect(filter);
    o2.connect(filter);
    filter.connect(gain);

    o1.start(time);
    o2.start(time);
    o1.stop(time + 6.05);
    o2.stop(time + 6.05);

    let isStopped = false;
    const stop = (releaseSec = 0.1) => {
      if (isStopped) return;
      isStopped = true;
      try {
        const now = Math.max(ctx.currentTime, time);
        gain.gain.cancelScheduledValues(now);
        const cur = Math.max(0.0001, gain.gain.value);
        gain.gain.setValueAtTime(cur, now);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + releaseSec);
        o1.stop(now + releaseSec + 0.02);
        o2.stop(now + releaseSec + 0.02);
        setTimeout(() => {
          try { o1.disconnect(); o2.disconnect(); filter.disconnect(); gain.disconnect(); } catch {}
        }, (releaseSec + 0.1) * 1000);
      } catch {}
    };

    const voice = { stop };
    this.registerVoice(voice);
    return voice;
  }
}
