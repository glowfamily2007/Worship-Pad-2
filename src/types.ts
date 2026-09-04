export type TrackType = 'audio' | 'midi' | 'drum';

export type InstrumentType =
  | 'grand_piano'
  | 'analog_lead'
  | 'synth_bass'
  | 'poly_pad'
  | 'drum_kit';

export interface AudioClip {
  id: string;
  trackId: string;
  name: string;
  startTime: number; // in seconds
  duration: number; // in seconds
  offset: number; // start offset within the audio buffer
  volume: number; // 0 to 2, default 1
  color: string;
  isMuted?: boolean;
  audioBuffer?: AudioBuffer;
  waveformData?: number[]; // pre-computed 0..1 peaks for fast waveform rendering
}

export interface MidiNote {
  id: string;
  pitch: number; // MIDI note number 0-127 (60 = Middle C / C4)
  startTime: number; // in seconds relative to clip start
  duration: number; // in seconds
  velocity: number; // 0 to 1
}

export interface MidiClip {
  id: string;
  trackId: string;
  name: string;
  startTime: number; // in seconds
  duration: number; // in seconds
  notes: MidiNote[];
  color: string;
}

export interface TrackFx {
  eq: {
    enabled: boolean;
    lowGain: number; // dB (-12 to +12)
    midGain: number; // dB (-12 to +12)
    highGain: number; // dB (-12 to +12)
    lowFreq: number; // Hz (e.g. 100)
    midFreq: number; // Hz (e.g. 1000)
    highFreq: number; // Hz (e.g. 8000)
  };
  reverb: {
    enabled: boolean;
    decay: number; // 0.1 to 5 seconds
    mix: number; // 0 to 1
  };
  delay: {
    enabled: boolean;
    time: number; // 0.05 to 1.0 seconds
    feedback: number; // 0 to 0.9
    mix: number; // 0 to 1
  };
  distortion: {
    enabled: boolean;
    drive: number; // 0 to 10
    tone: number; // filter freq Hz
  };
  compressor: {
    enabled: boolean;
    threshold: number; // -60 to 0 dB
    ratio: number; // 1 to 20
    attack: number; // seconds
    release: number; // seconds
  };
}

export interface TrackChannelEq {
  high: number; // -15 to +15 dB
  mid: number; // -15 to +15 dB
  midFreq: number; // 300 to 20000 Hz
  low: number; // -15 to +15 dB
}

export interface Track {
  id: string;
  name: string;
  type: TrackType;
  color: string;
  volume: number; // 0 to 1.5, 1 is 0dB
  pan: number; // -1 (L) to 1 (R)
  isMuted: boolean;
  isSolo: boolean;
  isArmed: boolean;
  instrument: InstrumentType;
  soundPreset?: string; // e.g. "Stereo Grand", "Tine Electric Pia", or SF2 preset name
  soundFontBankId?: string;
  channelEq?: TrackChannelEq;
  fx: TrackFx;
  audioClips: AudioClip[];
  midiClips: MidiClip[];
}

export interface Project {
  id: string;
  name: string;
  bpm: number;
  timeSignature: [number, number];
  tracks: Track[];
  masterVolume: number;
  loopEnabled: boolean;
  loopStart: number; // seconds
  loopEnd: number; // seconds
}

export type ToolMode = 'pointer' | 'cut' | 'draw' | 'erase';

export type ActiveView = 'track_console' | 'arranger' | 'mixer' | 'pianoroll' | 'fx' | 'instruments';

export type SnapGrid = 'off' | '1/4' | '1/8' | '1/16' | '1/32' | '1bar';

export interface VUMeterData {
  trackId: string;
  left: number; // 0 to 1
  right: number; // 0 to 1
  peak: number; // 0 to 1
}
