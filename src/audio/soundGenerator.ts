// Synthesis engine for Audio Evolution DAW
import { InstrumentType } from '../types';

export function midiToFreq(note: number): number {
  return 440 * Math.pow(2, (note - 69) / 12);
}

export function noteNumberToName(note: number): string {
  const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const octave = Math.floor(note / 12) - 1;
  const noteName = notes[note % 12];
  return `${noteName}${octave}`;
}

export function playSynthesizedNote(
  ctx: AudioContext | BaseAudioContext,
  destination: AudioNode,
  instrument: InstrumentType,
  pitch: number,
  startTime: number,
  duration: number,
  velocity = 0.8
) {
  const now = Math.max(startTime, ctx.currentTime);
  const freq = midiToFreq(pitch);

  if (instrument === 'drum_kit') {
    playDrumSound(ctx, destination, pitch, now, velocity);
    return;
  }

  switch (instrument) {
    case 'grand_piano':
      playPianoSound(ctx, destination, freq, now, duration, velocity);
      break;
    case 'analog_lead':
      playLeadSound(ctx, destination, freq, now, duration, velocity);
      break;
    case 'synth_bass':
      playBassSound(ctx, destination, freq, now, duration, velocity);
      break;
    case 'poly_pad':
      playPadSound(ctx, destination, freq, now, duration, velocity);
      break;
    default:
      playPianoSound(ctx, destination, freq, now, duration, velocity);
  }
}

// 1. Realistic Piano Sound with multi-harmonic layers
function playPianoSound(
  ctx: AudioContext | BaseAudioContext,
  dest: AudioNode,
  freq: number,
  time: number,
  duration: number,
  velocity: number
) {
  const gain = ctx.createGain();
  gain.connect(dest);

  const osc1 = ctx.createOscillator();
  const osc2 = ctx.createOscillator();
  const osc3 = ctx.createOscillator();

  osc1.type = 'triangle';
  osc2.type = 'sine';
  osc3.type = 'sine';

  osc1.frequency.setValueAtTime(freq, time);
  osc2.frequency.setValueAtTime(freq * 2, time); // 1st overtone
  osc3.frequency.setValueAtTime(freq * 3, time); // 2nd overtone

  // Subtle acoustic string detune
  osc1.detune.setValueAtTime(-3, time);
  osc2.detune.setValueAtTime(4, time);

  // Velocity to volume scaling
  const peakVol = Math.pow(velocity, 1.2) * 0.22;

  gain.gain.setValueAtTime(0.0001, time);
  gain.gain.exponentialRampToValueAtTime(peakVol, time + 0.005); // immediate hammer attack
  gain.gain.exponentialRampToValueAtTime(peakVol * 0.4, time + 0.15); // initial pluck drop
  gain.gain.exponentialRampToValueAtTime(0.0001, time + Math.min(Math.max(duration, 0.4), 6.0)); // natural decay up to 6s

  // Hammer low-pass filter
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(Math.min(freq * 8 * velocity, 12000), time);
  filter.frequency.exponentialRampToValueAtTime(Math.max(freq * 1.5, 300), time + Math.min(duration, 6.0));

  osc1.connect(filter);
  osc2.connect(filter);
  osc3.connect(filter);
  filter.connect(gain);

  osc1.start(time);
  osc2.start(time);
  osc3.start(time);

  const stopTime = time + Math.min(Math.max(duration, 0.45), 6.05);
  osc1.stop(stopTime);
  osc2.stop(stopTime);
  osc3.stop(stopTime);
}

// 2. Analog Synth Lead with resonant sweep
function playLeadSound(
  ctx: AudioContext | BaseAudioContext,
  dest: AudioNode,
  freq: number,
  time: number,
  duration: number,
  velocity: number
) {
  const gain = ctx.createGain();
  gain.connect(dest);

  const osc1 = ctx.createOscillator();
  const osc2 = ctx.createOscillator();

  osc1.type = 'sawtooth';
  osc2.type = 'square';

  osc1.frequency.setValueAtTime(freq, time);
  osc2.frequency.setValueAtTime(freq, time);
  osc2.detune.setValueAtTime(8, time); // warm chorus detune

  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.Q.setValueAtTime(5, time); // resonance
  filter.frequency.setValueAtTime(freq * 1.5, time);
  filter.frequency.exponentialRampToValueAtTime(Math.min(freq * 8 * velocity, 14000), time + 0.04);
  filter.frequency.exponentialRampToValueAtTime(freq * 2.5, time + Math.min(duration, 6.0));

  const peakVol = velocity * 0.20;
  gain.gain.setValueAtTime(0.0001, time);
  gain.gain.exponentialRampToValueAtTime(peakVol, time + 0.02);
  gain.gain.setValueAtTime(peakVol * 0.75, time + Math.max(duration - 0.05, 0.03));
  gain.gain.exponentialRampToValueAtTime(0.0001, time + Math.min(duration + 0.08, 6.0));

  osc1.connect(filter);
  osc2.connect(filter);
  filter.connect(gain);

  osc1.start(time);
  osc2.start(time);
  const stopTime = time + Math.min(duration + 0.1, 6.05);
  osc1.stop(stopTime);
  osc2.stop(stopTime);
}

// 3. Punchy Deep Synth Bass
function playBassSound(
  ctx: AudioContext | BaseAudioContext,
  dest: AudioNode,
  freq: number,
  time: number,
  duration: number,
  velocity: number
) {
  const gain = ctx.createGain();
  gain.connect(dest);

  const subOsc = ctx.createOscillator();
  const gritOsc = ctx.createOscillator();

  subOsc.type = 'sine';
  gritOsc.type = 'sawtooth';

  // Sub bass
  subOsc.frequency.setValueAtTime(freq, time);
  gritOsc.frequency.setValueAtTime(freq, time);

  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(Math.min(freq * 5 * velocity, 2400), time);
  filter.frequency.exponentialRampToValueAtTime(freq * 1.8, time + 0.12);

  const gritGain = ctx.createGain();
  gritGain.gain.setValueAtTime(0.25, time);

  gritOsc.connect(filter);
  filter.connect(gritGain);
  gritGain.connect(gain);
  subOsc.connect(gain);

  const peakVol = velocity * 0.24;
  gain.gain.setValueAtTime(0.0001, time);
  gain.gain.exponentialRampToValueAtTime(peakVol, time + 0.008);
  gain.gain.exponentialRampToValueAtTime(peakVol * 0.8, time + 0.1);
  gain.gain.setValueAtTime(peakVol * 0.8, time + Math.max(duration - 0.02, 0.02));
  gain.gain.exponentialRampToValueAtTime(0.0001, time + Math.min(duration + 0.05, 6.0));

  subOsc.start(time);
  gritOsc.start(time);
  const stopTime = time + Math.min(duration + 0.06, 6.05);
  subOsc.stop(stopTime);
  gritOsc.stop(stopTime);
}

// 4. Warm Polyphonic Pad
function playPadSound(
  ctx: AudioContext | BaseAudioContext,
  dest: AudioNode,
  freq: number,
  time: number,
  duration: number,
  velocity: number
) {
  const gain = ctx.createGain();
  gain.connect(dest);

  const osc1 = ctx.createOscillator();
  const osc2 = ctx.createOscillator();

  osc1.type = 'sawtooth';
  osc2.type = 'triangle';

  osc1.frequency.setValueAtTime(freq, time);
  osc2.frequency.setValueAtTime(freq, time);
  osc1.detune.setValueAtTime(-10, time);
  osc2.detune.setValueAtTime(10, time);

  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(freq * 2.5, time);
  filter.frequency.exponentialRampToValueAtTime(freq * 5 * velocity, time + 0.4);

  const peakVol = velocity * 0.16;
  gain.gain.setValueAtTime(0.0001, time);
  gain.gain.linearRampToValueAtTime(peakVol, time + 0.18); // slow atmospheric attack
  gain.gain.setValueAtTime(peakVol, time + duration);
  gain.gain.exponentialRampToValueAtTime(0.0001, time + Math.min(duration + 0.4, 6.0)); // lingering release up to 6s

  osc1.connect(filter);
  osc2.connect(filter);
  filter.connect(gain);

  osc1.start(time);
  osc2.start(time);
  const stopTime = time + Math.min(duration + 0.45, 6.05);
  osc1.stop(stopTime);
  osc2.stop(stopTime);
}

// 5. Complete Drum Machine Sound Synthesizer
export function playDrumSound(
  ctx: AudioContext | BaseAudioContext,
  dest: AudioNode,
  drumIndex: number, // MIDI 36=Kick, 38=Snare, 42=Closed Hat, 46=Open Hat, 39=Clap, 45=Tom, 49=Crash
  time: number,
  velocity = 0.85
) {
  // Normalize drum pitch standard General MIDI
  switch (drumIndex) {
    case 35:
    case 36: // Kick Drum
      playKickDrum(ctx, dest, time, velocity);
      break;
    case 38:
    case 40: // Snare Drum
      playSnareDrum(ctx, dest, time, velocity);
      break;
    case 39: // Clap
      playHandClap(ctx, dest, time, velocity);
      break;
    case 42:
    case 44: // Closed Hi-Hat
      playClosedHat(ctx, dest, time, velocity);
      break;
    case 46: // Open Hi-Hat
      playOpenHat(ctx, dest, time, velocity);
      break;
    case 45:
    case 47:
    case 48:
    case 50: // Toms
      playTomDrum(ctx, dest, time, velocity);
      break;
    case 49:
    case 51: // Crash / Cymbal
      playCrashCymbal(ctx, dest, time, velocity);
      break;
    default:
      // Map other notes into drum family based on octave
      if (drumIndex < 38) playKickDrum(ctx, dest, time, velocity);
      else if (drumIndex < 42) playSnareDrum(ctx, dest, time, velocity);
      else if (drumIndex < 48) playClosedHat(ctx, dest, time, velocity);
      else playCrashCymbal(ctx, dest, time, velocity);
  }
}

function playKickDrum(ctx: AudioContext | BaseAudioContext, dest: AudioNode, time: number, velocity: number) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'sine';
  osc.frequency.setValueAtTime(150, time);
  osc.frequency.exponentialRampToValueAtTime(42, time + 0.08);

  const vol = velocity * 0.45;
  gain.gain.setValueAtTime(vol, time);
  gain.gain.exponentialRampToValueAtTime(0.001, time + 0.35);

  osc.connect(gain);
  gain.connect(dest);

  osc.start(time);
  osc.stop(time + 0.36);
}

function playSnareDrum(ctx: AudioContext | BaseAudioContext, dest: AudioNode, time: number, velocity: number) {
  // 1. Tonal body
  const osc = ctx.createOscillator();
  const oscGain = ctx.createGain();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(190, time);
  osc.frequency.exponentialRampToValueAtTime(80, time + 0.1);
  oscGain.gain.setValueAtTime(velocity * 0.25, time);
  oscGain.gain.exponentialRampToValueAtTime(0.001, time + 0.14);
  osc.connect(oscGain);
  oscGain.connect(dest);

  // 2. White noise snare rattle
  const bufferSize = ctx.sampleRate * 0.22;
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = Math.random() * 2 - 1;
  }
  const noise = ctx.createBufferSource();
  noise.buffer = buffer;

  const filter = ctx.createBiquadFilter();
  filter.type = 'highpass';
  filter.frequency.setValueAtTime(900, time);

  const noiseGain = ctx.createGain();
  noiseGain.gain.setValueAtTime(velocity * 0.35, time);
  noiseGain.gain.exponentialRampToValueAtTime(0.001, time + 0.2);

  noise.connect(filter);
  filter.connect(noiseGain);
  noiseGain.connect(dest);

  osc.start(time);
  noise.start(time);
  osc.stop(time + 0.22);
  noise.stop(time + 0.22);
}

function playHandClap(ctx: AudioContext | BaseAudioContext, dest: AudioNode, time: number, velocity: number) {
  const bufferSize = ctx.sampleRate * 0.25;
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = Math.random() * 2 - 1;
  }

  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.setValueAtTime(1200, time);
  filter.Q.setValueAtTime(1.5, time);

  const gain = ctx.createGain();
  // staggered bursts
  const v = velocity * 0.35;
  gain.gain.setValueAtTime(v * 0.8, time);
  gain.gain.exponentialRampToValueAtTime(0.01, time + 0.012);
  gain.gain.setValueAtTime(v * 0.9, time + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.01, time + 0.028);
  gain.gain.setValueAtTime(v, time + 0.032);
  gain.gain.exponentialRampToValueAtTime(0.001, time + 0.24);

  const noise = ctx.createBufferSource();
  noise.buffer = buffer;
  noise.connect(filter);
  filter.connect(gain);
  gain.connect(dest);

  noise.start(time);
  noise.stop(time + 0.25);
}

function playClosedHat(ctx: AudioContext | BaseAudioContext, dest: AudioNode, time: number, velocity: number) {
  const bufferSize = ctx.sampleRate * 0.08;
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = Math.random() * 2 - 1;
  }

  const noise = ctx.createBufferSource();
  noise.buffer = buffer;

  const filter = ctx.createBiquadFilter();
  filter.type = 'highpass';
  filter.frequency.setValueAtTime(7500, time);

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(velocity * 0.25, time);
  gain.gain.exponentialRampToValueAtTime(0.001, time + 0.055);

  noise.connect(filter);
  filter.connect(gain);
  gain.connect(dest);

  noise.start(time);
  noise.stop(time + 0.07);
}

function playOpenHat(ctx: AudioContext | BaseAudioContext, dest: AudioNode, time: number, velocity: number) {
  const bufferSize = ctx.sampleRate * 0.35;
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = Math.random() * 2 - 1;
  }

  const noise = ctx.createBufferSource();
  noise.buffer = buffer;

  const filter = ctx.createBiquadFilter();
  filter.type = 'highpass';
  filter.frequency.setValueAtTime(6500, time);

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(velocity * 0.28, time);
  gain.gain.exponentialRampToValueAtTime(0.001, time + 0.32);

  noise.connect(filter);
  filter.connect(gain);
  gain.connect(dest);

  noise.start(time);
  noise.stop(time + 0.35);
}

function playTomDrum(ctx: AudioContext | BaseAudioContext, dest: AudioNode, time: number, velocity: number) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'sine';
  osc.frequency.setValueAtTime(140, time);
  osc.frequency.exponentialRampToValueAtTime(65, time + 0.16);

  gain.gain.setValueAtTime(velocity * 0.35, time);
  gain.gain.exponentialRampToValueAtTime(0.001, time + 0.22);

  osc.connect(gain);
  gain.connect(dest);

  osc.start(time);
  osc.stop(time + 0.24);
}

function playCrashCymbal(ctx: AudioContext | BaseAudioContext, dest: AudioNode, time: number, velocity: number) {
  const bufferSize = ctx.sampleRate * 1.2;
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = Math.random() * 2 - 1;
  }

  const noise = ctx.createBufferSource();
  noise.buffer = buffer;

  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.setValueAtTime(5000, time);
  filter.Q.setValueAtTime(0.8, time);

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(velocity * 0.30, time);
  gain.gain.exponentialRampToValueAtTime(0.0001, time + 1.15);

  noise.connect(filter);
  filter.connect(gain);
  gain.connect(dest);

  noise.start(time);
  noise.stop(time + 1.2);
}

// Metronome click
export function playMetronomeClick(
  ctx: AudioContext,
  time: number,
  isAccent: boolean
) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'sine';
  osc.frequency.setValueAtTime(isAccent ? 1600 : 1000, time);

  gain.gain.setValueAtTime(isAccent ? 0.6 : 0.35, time);
  gain.gain.exponentialRampToValueAtTime(0.001, time + 0.035);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(time);
  osc.stop(time + 0.04);
}

// Compute waveform peak summary for instant crisp canvas drawing
export function extractWaveformData(buffer: AudioBuffer, numBuckets = 120): number[] {
  const channelData = buffer.getChannelData(0);
  const step = Math.floor(channelData.length / numBuckets);
  const peaks: number[] = [];

  for (let i = 0; i < numBuckets; i++) {
    const start = i * step;
    let max = 0;
    for (let j = 0; j < step; j++) {
      const val = Math.abs(channelData[start + j] || 0);
      if (val > max) max = val;
    }
    peaks.push(Math.min(max, 1));
  }
  return peaks;
}
