// Pre-loaded Demo Song for Audio Evolution Studio
import { Project, Track } from '../types';

export function createDefaultTrackFx() {
  return {
    eq: {
      enabled: true,
      lowGain: 0,
      midGain: 0,
      highGain: 0,
      lowFreq: 100,
      midFreq: 1000,
      highFreq: 8000,
    },
    reverb: {
      enabled: true,
      decay: 1.8,
      mix: 0.15,
    },
    delay: {
      enabled: false,
      time: 0.25,
      feedback: 0.3,
      mix: 0.2,
    },
    distortion: {
      enabled: false,
      drive: 0,
      tone: 2000,
    },
    compressor: {
      enabled: false,
      threshold: -12,
      ratio: 4,
      attack: 0.01,
      release: 0.15,
    },
  };
}

export function createDemoProject(): Project {
  const bpm = 120;
  const beatSec = 60 / bpm; // 0.5s per beat
  const barSec = beatSec * 4; // 2.0s per bar

  // 1. Drum Track Pattern (4 bars = 8 seconds)
  const drumNotes = [];
  for (let bar = 0; bar < 4; bar++) {
    const barOffset = bar * barSec;
    // Kicks on beat 1 and 3 (and 3.5 on bar 2/4)
    drumNotes.push({ id: `k-${bar}-1`, pitch: 36, startTime: barOffset + 0, duration: 0.2, velocity: 0.95 });
    drumNotes.push({ id: `k-${bar}-2`, pitch: 36, startTime: barOffset + beatSec * 2, duration: 0.2, velocity: 0.9 });
    if (bar % 2 === 1) {
      drumNotes.push({ id: `k-${bar}-3`, pitch: 36, startTime: barOffset + beatSec * 2.5, duration: 0.2, velocity: 0.8 });
    }

    // Snares on beat 2 and 4
    drumNotes.push({ id: `s-${bar}-1`, pitch: 38, startTime: barOffset + beatSec * 1, duration: 0.2, velocity: 0.9 });
    drumNotes.push({ id: `s-${bar}-2`, pitch: 38, startTime: barOffset + beatSec * 3, duration: 0.2, velocity: 0.95 });

    // Hi-hats every 8th note
    for (let h = 0; h < 8; h++) {
      const isOffbeat = h % 2 === 1;
      const hatPitch = (bar === 3 && h === 7) ? 46 : 42; // open hat at end
      drumNotes.push({
        id: `hh-${bar}-${h}`,
        pitch: hatPitch,
        startTime: barOffset + h * (beatSec / 2),
        duration: isOffbeat ? 0.12 : 0.08,
        velocity: isOffbeat ? 0.65 : 0.8,
      });
    }

    // Tom fills on bar 3
    if (bar === 3) {
      drumNotes.push({ id: `t1`, pitch: 45, startTime: barOffset + beatSec * 3.25, duration: 0.15, velocity: 0.85 });
      drumNotes.push({ id: `t2`, pitch: 47, startTime: barOffset + beatSec * 3.5, duration: 0.15, velocity: 0.9 });
      drumNotes.push({ id: `t3`, pitch: 48, startTime: barOffset + beatSec * 3.75, duration: 0.15, velocity: 0.95 });
    }
  }

  // 2. Funky Synth Bass (A minor groove)
  // Notes: A1(33), C2(36), D2(38), E2(40), G1(31)
  const bassNotes = [
    // Bar 1: Am
    { id: 'b-1', pitch: 33, startTime: 0.0, duration: 0.45, velocity: 0.9 },
    { id: 'b-2', pitch: 33, startTime: 0.5, duration: 0.25, velocity: 0.8 },
    { id: 'b-3', pitch: 36, startTime: 1.0, duration: 0.35, velocity: 0.85 },
    { id: 'b-4', pitch: 38, startTime: 1.5, duration: 0.4, velocity: 0.9 },

    // Bar 2: F
    { id: 'b-5', pitch: 29, startTime: 2.0, duration: 0.45, velocity: 0.9 },
    { id: 'b-6', pitch: 29, startTime: 2.5, duration: 0.25, velocity: 0.8 },
    { id: 'b-7', pitch: 33, startTime: 3.0, duration: 0.35, velocity: 0.85 },
    { id: 'b-8', pitch: 35, startTime: 3.5, duration: 0.4, velocity: 0.85 },

    // Bar 3: C
    { id: 'b-9', pitch: 36, startTime: 4.0, duration: 0.45, velocity: 0.9 },
    { id: 'b-10', pitch: 36, startTime: 4.5, duration: 0.25, velocity: 0.8 },
    { id: 'b-11', pitch: 40, startTime: 5.0, duration: 0.35, velocity: 0.85 },
    { id: 'b-12', pitch: 38, startTime: 5.5, duration: 0.4, velocity: 0.9 },

    // Bar 4: G / Em turnaround
    { id: 'b-13', pitch: 31, startTime: 6.0, duration: 0.45, velocity: 0.9 },
    { id: 'b-14', pitch: 31, startTime: 6.5, duration: 0.25, velocity: 0.8 },
    { id: 'b-15', pitch: 35, startTime: 7.0, duration: 0.35, velocity: 0.85 },
    { id: 'b-16', pitch: 38, startTime: 7.5, duration: 0.4, velocity: 0.9 },
  ];

  // 3. Poly Pad Chords (Am9, Fmaj7, Cmaj7, G6)
  const padNotes = [
    // Bar 1: Am9 (A3=57, C4=60, E4=64, B4=71)
    { id: 'p-1', pitch: 57, startTime: 0.0, duration: 1.9, velocity: 0.75 },
    { id: 'p-2', pitch: 60, startTime: 0.0, duration: 1.9, velocity: 0.7 },
    { id: 'p-3', pitch: 64, startTime: 0.0, duration: 1.9, velocity: 0.7 },
    { id: 'p-4', pitch: 71, startTime: 0.0, duration: 1.9, velocity: 0.75 },

    // Bar 2: Fmaj7 (F3=53, A3=57, C4=60, E4=64)
    { id: 'p-5', pitch: 53, startTime: 2.0, duration: 1.9, velocity: 0.75 },
    { id: 'p-6', pitch: 57, startTime: 2.0, duration: 1.9, velocity: 0.7 },
    { id: 'p-7', pitch: 60, startTime: 2.0, duration: 1.9, velocity: 0.7 },
    { id: 'p-8', pitch: 64, startTime: 2.0, duration: 1.9, velocity: 0.75 },

    // Bar 3: Cmaj7 (C3=48, G3=55, B3=59, E4=64)
    { id: 'p-9', pitch: 48, startTime: 4.0, duration: 1.9, velocity: 0.75 },
    { id: 'p-10', pitch: 55, startTime: 4.0, duration: 1.9, velocity: 0.7 },
    { id: 'p-11', pitch: 59, startTime: 4.0, duration: 1.9, velocity: 0.7 },
    { id: 'p-12', pitch: 64, startTime: 4.0, duration: 1.9, velocity: 0.75 },

    // Bar 4: G6 (G3=55, B3=59, D4=62, E4=64)
    { id: 'p-13', pitch: 55, startTime: 6.0, duration: 1.9, velocity: 0.75 },
    { id: 'p-14', pitch: 59, startTime: 6.0, duration: 1.9, velocity: 0.7 },
    { id: 'p-15', pitch: 62, startTime: 6.0, duration: 1.9, velocity: 0.7 },
    { id: 'p-16', pitch: 64, startTime: 6.0, duration: 1.9, velocity: 0.75 },
  ];

  // 4. Analog Synth Lead Melody
  const leadNotes = [
    { id: 'l-1', pitch: 69, startTime: 0.5, duration: 0.45, velocity: 0.85 }, // A4
    { id: 'l-2', pitch: 72, startTime: 1.0, duration: 0.35, velocity: 0.85 }, // C5
    { id: 'l-3', pitch: 71, startTime: 1.5, duration: 0.8, velocity: 0.9 }, // B4
    { id: 'l-4', pitch: 67, startTime: 2.5, duration: 0.45, velocity: 0.8 }, // G4
    { id: 'l-5', pitch: 69, startTime: 3.0, duration: 0.9, velocity: 0.85 }, // A4
    { id: 'l-6', pitch: 72, startTime: 4.5, duration: 0.45, velocity: 0.85 }, // C5
    { id: 'l-7', pitch: 74, startTime: 5.0, duration: 0.45, velocity: 0.85 }, // D5
    { id: 'l-8', pitch: 76, startTime: 5.5, duration: 0.85, velocity: 0.9 }, // E5
    { id: 'l-9', pitch: 74, startTime: 6.5, duration: 0.4, velocity: 0.85 }, // D5
    { id: 'l-10', pitch: 72, startTime: 7.0, duration: 0.4, velocity: 0.85 }, // C5
    { id: 'l-11', pitch: 71, startTime: 7.5, duration: 0.45, velocity: 0.85 }, // B4
  ];

  const tracks: Track[] = [
    {
      id: 'track-1',
      name: 'Track 1',
      type: 'midi',
      color: '#3b82f6', // blue
      volume: 0.95,
      pan: 0,
      isMuted: false,
      isSolo: false,
      isArmed: false,
      instrument: 'grand_piano',
      soundPreset: 'Stereo Grand',
      channelEq: { high: 0, mid: 0, midFreq: 1000, low: 0 },
      fx: createDefaultTrackFx(),
      audioClips: [],
      midiClips: [
        {
          id: 'midi-piano-1',
          trackId: 'track-1',
          name: 'Grand Arp',
          startTime: 0,
          duration: 8.0,
          notes: leadNotes,
          color: '#3b82f6',
        },
      ],
    },
    {
      id: 'track-2',
      name: 'Track 2',
      type: 'midi',
      color: '#60a5fa',
      volume: 0.9,
      pan: -0.15,
      isMuted: false,
      isSolo: false,
      isArmed: false,
      instrument: 'grand_piano',
      soundPreset: 'Tine Electric Pia',
      channelEq: { high: 1.5, mid: -0.5, midFreq: 1200, low: 0 },
      fx: createDefaultTrackFx(),
      audioClips: [],
      midiClips: [
        {
          id: 'midi-rhodes-1',
          trackId: 'track-2',
          name: 'Rhodes Chords',
          startTime: 0,
          duration: 8.0,
          notes: padNotes,
          color: '#60a5fa',
        },
      ],
    },
    {
      id: 'track-3',
      name: 'Track 3',
      type: 'midi',
      color: '#0284c7',
      volume: 0.85,
      pan: 0.2,
      isMuted: false,
      isSolo: false,
      isArmed: false,
      instrument: 'poly_pad',
      soundPreset: 'Tonewheel Orga',
      channelEq: { high: 0, mid: 0, midFreq: 1500, low: 0 },
      fx: createDefaultTrackFx(),
      audioClips: [],
      midiClips: [],
    },
    {
      id: 'track-4',
      name: 'Track 4',
      type: 'midi',
      color: '#06b6d4',
      volume: 0.85,
      pan: 0.1,
      isMuted: false,
      isSolo: false,
      isArmed: false,
      instrument: 'poly_pad',
      soundPreset: 'Rock Organ',
      channelEq: { high: 2.0, mid: 1.0, midFreq: 2200, low: -1.0 },
      fx: createDefaultTrackFx(),
      audioClips: [],
      midiClips: [],
    },
    {
      id: 'track-5',
      name: 'Track 5',
      type: 'midi',
      color: '#14b8a6',
      volume: 0.9,
      pan: -0.25,
      isMuted: false,
      isSolo: false,
      isArmed: false,
      instrument: 'grand_piano',
      soundPreset: 'Nylon Guitar',
      channelEq: { high: 0.5, mid: 0, midFreq: 1000, low: 0.5 },
      fx: createDefaultTrackFx(),
      audioClips: [],
      midiClips: [],
    },
    {
      id: 'track-6',
      name: 'Track 6',
      type: 'midi',
      color: '#10b981', // emerald
      volume: 0.95,
      pan: 0,
      isMuted: false,
      isSolo: false,
      isArmed: false,
      instrument: 'synth_bass',
      soundPreset: 'Finger Bass',
      channelEq: { high: -1.0, mid: 0, midFreq: 800, low: 3.0 },
      fx: createDefaultTrackFx(),
      audioClips: [],
      midiClips: [
        {
          id: 'midi-bass-1',
          trackId: 'track-6',
          name: 'Finger Groove',
          startTime: 0,
          duration: 8.0,
          notes: bassNotes,
          color: '#10b981',
        },
      ],
    },
    {
      id: 'track-7',
      name: 'Track 7',
      type: 'midi',
      color: '#84cc16',
      volume: 0.8,
      pan: -0.3,
      isMuted: false,
      isSolo: false,
      isArmed: false,
      instrument: 'poly_pad',
      soundPreset: 'Stereo Strings F',
      channelEq: { high: 1.0, mid: -0.5, midFreq: 1800, low: 0 },
      fx: createDefaultTrackFx(),
      audioClips: [],
      midiClips: [],
    },
    {
      id: 'track-8',
      name: 'Track 8',
      type: 'midi',
      color: '#eab308',
      volume: 0.8,
      pan: 0.3,
      isMuted: false,
      isSolo: false,
      isArmed: false,
      instrument: 'poly_pad',
      soundPreset: 'Synth Strings 2',
      channelEq: { high: 1.5, mid: 0, midFreq: 2500, low: -0.5 },
      fx: createDefaultTrackFx(),
      audioClips: [],
      midiClips: [],
    },
    {
      id: 'track-9',
      name: 'Track 9',
      type: 'midi',
      color: '#f97316',
      volume: 0.85,
      pan: 0.15,
      isMuted: false,
      isSolo: false,
      isArmed: false,
      instrument: 'analog_lead',
      soundPreset: 'Trumpet',
      channelEq: { high: 2.0, mid: 1.5, midFreq: 3000, low: 0 },
      fx: createDefaultTrackFx(),
      audioClips: [],
      midiClips: [],
    },
    {
      id: 'track-10',
      name: 'Track 10',
      type: 'drum',
      color: '#ec4899', // pink
      volume: 1.0,
      pan: 0,
      isMuted: false,
      isSolo: false,
      isArmed: false,
      instrument: 'drum_kit',
      soundPreset: 'Standard',
      channelEq: { high: 1.0, mid: 0, midFreq: 1200, low: 2.5 },
      fx: createDefaultTrackFx(),
      audioClips: [],
      midiClips: [
        {
          id: 'midi-drums-1',
          trackId: 'track-10',
          name: 'Drum Kit Rhythm',
          startTime: 0,
          duration: 8.0,
          notes: drumNotes,
          color: '#ec4899',
        },
      ],
    },
    {
      id: 'track-11',
      name: 'Track 11',
      type: 'midi',
      color: '#a855f7',
      volume: 0.8,
      pan: -0.2,
      isMuted: false,
      isSolo: false,
      isArmed: false,
      instrument: 'poly_pad',
      soundPreset: 'Concert Choir',
      channelEq: { high: 0, mid: 2.0, midFreq: 850, low: 0 },
      fx: createDefaultTrackFx(),
      audioClips: [],
      midiClips: [],
    },
    {
      id: 'track-12',
      name: 'Track 12',
      type: 'midi',
      color: '#f43f5e',
      volume: 0.85,
      pan: 0.25,
      isMuted: false,
      isSolo: false,
      isArmed: true, // Armed by default for USB MIDI input!
      instrument: 'analog_lead',
      soundPreset: 'Brass Section',
      channelEq: { high: 1.5, mid: 1.0, midFreq: 2200, low: 0.5 },
      fx: createDefaultTrackFx(),
      audioClips: [],
      midiClips: [],
    },
  ];

  return {
    id: 'proj-demo-1',
    name: 'Evolution Anthem',
    bpm: 120,
    timeSignature: [4, 4],
    tracks,
    masterVolume: 0.9,
    loopEnabled: true,
    loopStart: 0,
    loopEnd: 8.0, // 4-bar loop
  };
}
