// Real-time Audio Engine for Audio Evolution Studio
import { Project, Track, TrackFx, VUMeterData, AudioClip } from '../types';
import { playSynthesizedNote, playMetronomeClick, extractWaveformData } from './soundGenerator';
import { SoundFontEngine } from './sf2Engine';
import { MidiManager } from './midiManager';

interface TrackNodes {
  inputGain: GainNode;
  eqLow: BiquadFilterNode;
  eqMid: BiquadFilterNode;
  eqHigh: BiquadFilterNode;
  distortion: WaveShaperNode;
  distortionDry: GainNode;
  distortionWet: GainNode;
  compressor: DynamicsCompressorNode;
  reverbSend: GainNode;
  delaySend: GainNode;
  delayNode: DelayNode;
  delayFeedback: GainNode;
  delayWet: GainNode;
  panNode: StereoPannerNode;
  volumeGain: GainNode;
  analyser: AnalyserNode;
}

export class AudioEngine {
  private static instance: AudioEngine | null = null;
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private masterLimiter: DynamicsCompressorNode | null = null;
  private masterAnalyserL: AnalyserNode | null = null;
  private masterAnalyserR: AnalyserNode | null = null;
  private reverbConvolver: ConvolverNode | null = null;
  private reverbWetGain: GainNode | null = null;

  private trackNodesMap = new Map<string, TrackNodes>();
  private activeBufferSources = new Set<AudioBufferSourceNode>();

  // Playback state
  private isPlaying = false;
  private playbackStartTime = 0; // ctx.currentTime when play started
  private playheadPosition = 0; // in seconds
  private lastScheduledTime = 0;
  private animFrameId: number | null = null;
  private currentProject: Project | null = null;

  // Metronome
  private metronomeEnabled = false;
  private lastMetronomeBeat = -1;

  // Microphone recording
  private mediaStream: MediaStream | null = null;
  private mediaRecorder: MediaRecorder | null = null;
  private recordedChunks: Blob[] = [];
  private recordingStartTime = 0;
  private recordingTrackId: string | null = null;
  private micAnalyser: AnalyserNode | null = null;

  // Live voice tracking for Note On / Note Off & Sustain
  private liveVoices: Map<string, { stop: (releaseSec?: number) => void; isSustained: boolean }> = new Map();
  private isSustainActive = false;
  private transposeSemitones = 0;

  // Listeners
  private onPositionUpdate: ((time: number) => void) | null = null;
  private onVUMeterUpdate: ((meters: VUMeterData[], masterL: number, masterR: number) => void) | null = null;

  public static getInstance(): AudioEngine {
    if (!AudioEngine.instance) {
      AudioEngine.instance = new AudioEngine();
    }
    return AudioEngine.instance;
  }

  public getContext(): AudioContext {
    if (!this.ctx) {
      const AudioCtxClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      // Use lowest latency profile for real-time responsiveness and no buffer jitter
      this.ctx = new AudioCtxClass({ latencyHint: 'interactive' });
      this.initMasterBus();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    return this.ctx;
  }

  private initMasterBus() {
    if (!this.ctx) return;
    const ctx = this.ctx;

    // Master Limiter: gentle transparent peak control with headroom to prevent clipping distortion
    this.masterLimiter = ctx.createDynamicsCompressor();
    this.masterLimiter.threshold.setValueAtTime(-2.5, ctx.currentTime);
    this.masterLimiter.knee.setValueAtTime(8.0, ctx.currentTime);
    this.masterLimiter.ratio.setValueAtTime(4.0, ctx.currentTime);
    this.masterLimiter.attack.setValueAtTime(0.005, ctx.currentTime);
    this.masterLimiter.release.setValueAtTime(0.08, ctx.currentTime);

    this.masterGain = ctx.createGain();
    this.masterGain.gain.setValueAtTime(0.85, ctx.currentTime);

    // Master Analyser L and R
    const splitter = ctx.createChannelSplitter(2);
    this.masterAnalyserL = ctx.createAnalyser();
    this.masterAnalyserR = ctx.createAnalyser();
    this.masterAnalyserL.fftSize = 256;
    this.masterAnalyserR.fftSize = 256;

    // Global impulse reverb convolver with normalized headroom
    this.reverbConvolver = ctx.createConvolver();
    this.reverbConvolver.buffer = this.createImpulseResponse(ctx, 1.8, 2.5);
    this.reverbWetGain = ctx.createGain();
    this.reverbWetGain.gain.setValueAtTime(0.20, ctx.currentTime);

    this.reverbConvolver.connect(this.reverbWetGain);
    this.reverbWetGain.connect(this.masterLimiter);

    // Connect master bus
    this.masterGain.connect(this.masterLimiter);
    this.masterLimiter.connect(splitter);
    splitter.connect(this.masterAnalyserL, 0);
    splitter.connect(this.masterAnalyserR, 1);
    this.masterLimiter.connect(ctx.destination);
  }

  // Generate synthetic impulse response with amplitude normalization to prevent distortion
  private createImpulseResponse(ctx: BaseAudioContext, duration: number, decay: number): AudioBuffer {
    const rate = ctx.sampleRate;
    const length = Math.floor(rate * duration);
    const impulse = ctx.createBuffer(2, length, rate);
    const left = impulse.getChannelData(0);
    const right = impulse.getChannelData(1);

    for (let i = 0; i < length; i++) {
      const n = i / length;
      const factor = Math.pow(1 - n, decay);
      left[i] = (Math.random() * 2 - 1) * factor;
      right[i] = (Math.random() * 2 - 1) * factor;
    }

    // Normalize impulse buffer to strictly safe acoustic energy
    let maxAmp = 0;
    for (let i = 0; i < length; i++) {
      const absL = Math.abs(left[i]);
      const absR = Math.abs(right[i]);
      if (absL > maxAmp) maxAmp = absL;
      if (absR > maxAmp) maxAmp = absR;
    }
    const norm = maxAmp > 0 ? 0.07 / maxAmp : 0.07;
    for (let i = 0; i < length; i++) {
      left[i] *= norm;
      right[i] *= norm;
    }

    return impulse;
  }

  // Set project and rebuild / reconcile track node chains
  public syncProject(project: Project) {
    this.currentProject = project;
    const ctx = this.getContext();

    if (this.masterGain) {
      this.masterGain.gain.setValueAtTime(project.masterVolume, ctx.currentTime);
    }

    // Determine solo state
    const hasSolo = project.tracks.some(t => t.isSolo);

    // Ensure all tracks have audio node chains
    project.tracks.forEach(track => {
      let nodes = this.trackNodesMap.get(track.id);
      if (!nodes) {
        nodes = this.createTrackNodes(track.id);
        this.trackNodesMap.set(track.id, nodes);
      }
      this.applyTrackSettings(track, nodes, hasSolo);
    });

    // Clean up removed tracks
    const trackIds = new Set(project.tracks.map(t => t.id));
    for (const [id, nodes] of this.trackNodesMap.entries()) {
      if (!trackIds.has(id)) {
        nodes.inputGain.disconnect();
        this.trackNodesMap.delete(id);
      }
    }
  }

  private createTrackNodes(trackId: string): TrackNodes {
    const ctx = this.getContext();

    const inputGain = ctx.createGain();

    // 3-Band Parametric EQ
    const eqLow = ctx.createBiquadFilter();
    eqLow.type = 'lowshelf';
    eqLow.frequency.setValueAtTime(120, ctx.currentTime);

    const eqMid = ctx.createBiquadFilter();
    eqMid.type = 'peaking';
    eqMid.frequency.setValueAtTime(1000, ctx.currentTime);
    eqMid.Q.setValueAtTime(1.0, ctx.currentTime);

    const eqHigh = ctx.createBiquadFilter();
    eqHigh.type = 'highshelf';
    eqHigh.frequency.setValueAtTime(8000, ctx.currentTime);

    // Distortion
    const distortion = ctx.createWaveShaper();
    distortion.curve = this.makeDistortionCurve(0);
    distortion.oversample = '2x';
    const distortionDry = ctx.createGain();
    const distortionWet = ctx.createGain();
    distortionDry.gain.setValueAtTime(1, ctx.currentTime);
    distortionWet.gain.setValueAtTime(0, ctx.currentTime);

    // Compressor - initialized transparently (0dB threshold, 1:1 ratio) to prevent unwanted squashing
    const compressor = ctx.createDynamicsCompressor();
    compressor.threshold.setValueAtTime(0, ctx.currentTime);
    compressor.ratio.setValueAtTime(1, ctx.currentTime);

    // Sends
    const reverbSend = ctx.createGain();
    reverbSend.gain.setValueAtTime(0, ctx.currentTime);
    if (this.reverbConvolver) {
      reverbSend.connect(this.reverbConvolver);
    }

    const delaySend = ctx.createGain();
    const delayNode = ctx.createDelay(2.0);
    delayNode.delayTime.setValueAtTime(0.3, ctx.currentTime);
    const delayFeedback = ctx.createGain();
    delayFeedback.gain.setValueAtTime(0.35, ctx.currentTime);
    const delayWet = ctx.createGain();
    delayWet.gain.setValueAtTime(0, ctx.currentTime);

    delaySend.connect(delayNode);
    delayNode.connect(delayFeedback);
    delayFeedback.connect(delayNode);
    delayNode.connect(delayWet);

    // Volume & Pan
    const volumeGain = ctx.createGain();
    const panNode = ctx.createStereoPanner ? ctx.createStereoPanner() : (ctx.createGain() as unknown as StereoPannerNode);

    // Analyser for peak metering
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 128;

    // Connect node chain:
    // inputGain -> EQ -> Compressor -> Dist -> Pan -> Vol -> Analyser -> Master
    inputGain.connect(eqLow);
    eqLow.connect(eqMid);
    eqMid.connect(eqHigh);
    eqHigh.connect(compressor);

    // Split for distortion & sends
    compressor.connect(distortionDry);
    compressor.connect(distortion);
    distortion.connect(distortionWet);

    const fxMerge = ctx.createGain();
    distortionDry.connect(fxMerge);
    distortionWet.connect(fxMerge);

    fxMerge.connect(reverbSend);
    fxMerge.connect(delaySend);
    fxMerge.connect(panNode);
    delayWet.connect(panNode);

    panNode.connect(volumeGain);
    volumeGain.connect(analyser);

    if (this.masterGain) {
      volumeGain.connect(this.masterGain);
    }

    return {
      inputGain,
      eqLow,
      eqMid,
      eqHigh,
      distortion,
      distortionDry,
      distortionWet,
      compressor,
      reverbSend,
      delaySend,
      delayNode,
      delayFeedback,
      delayWet,
      panNode,
      volumeGain,
      analyser,
    };
  }

  private applyTrackSettings(track: Track, nodes: TrackNodes, hasSolo: boolean) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;

    // Effective volume considering Mute and Solo
    let effVol = track.volume;
    if (track.isMuted) {
      effVol = 0;
    } else if (hasSolo && !track.isSolo) {
      effVol = 0;
    }
    nodes.volumeGain.gain.setValueAtTime(effVol, now);

    // Pan
    if (nodes.panNode.pan) {
      nodes.panNode.pan.setValueAtTime(track.pan, now);
    }

    // EQ
    if (track.channelEq) {
      nodes.eqLow.gain.setValueAtTime(track.channelEq.low, now);
      nodes.eqLow.frequency.setValueAtTime(100, now);
      nodes.eqMid.gain.setValueAtTime(track.channelEq.mid, now);
      nodes.eqMid.frequency.setValueAtTime(track.channelEq.midFreq, now);
      nodes.eqHigh.gain.setValueAtTime(track.channelEq.high, now);
      nodes.eqHigh.frequency.setValueAtTime(8000, now);
    } else {
      const { eq } = track.fx;
      if (eq.enabled) {
        nodes.eqLow.gain.setValueAtTime(eq.lowGain, now);
        nodes.eqLow.frequency.setValueAtTime(eq.lowFreq, now);
        nodes.eqMid.gain.setValueAtTime(eq.midGain, now);
        nodes.eqMid.frequency.setValueAtTime(eq.midFreq, now);
        nodes.eqHigh.gain.setValueAtTime(eq.highGain, now);
        nodes.eqHigh.frequency.setValueAtTime(eq.highFreq, now);
      } else {
        nodes.eqLow.gain.setValueAtTime(0, now);
        nodes.eqMid.gain.setValueAtTime(0, now);
        nodes.eqHigh.gain.setValueAtTime(0, now);
      }
    }

    // Distortion
    const { distortion } = track.fx;
    if (distortion.enabled && distortion.drive > 0) {
      nodes.distortion.curve = this.makeDistortionCurve(distortion.drive * 15);
      nodes.distortionWet.gain.setValueAtTime(0.7, now);
      nodes.distortionDry.gain.setValueAtTime(0.3, now);
    } else {
      nodes.distortionWet.gain.setValueAtTime(0, now);
      nodes.distortionDry.gain.setValueAtTime(1, now);
    }

    // Compressor
    const { compressor } = track.fx;
    if (compressor.enabled) {
      nodes.compressor.threshold.setValueAtTime(compressor.threshold, now);
      nodes.compressor.ratio.setValueAtTime(compressor.ratio, now);
      nodes.compressor.attack.setValueAtTime(compressor.attack, now);
      nodes.compressor.release.setValueAtTime(compressor.release, now);
    } else {
      nodes.compressor.threshold.setValueAtTime(0, now);
      nodes.compressor.ratio.setValueAtTime(1, now);
    }

    // Reverb send
    const { reverb } = track.fx;
    nodes.reverbSend.gain.setValueAtTime(reverb.enabled ? reverb.mix * 0.9 : 0, now);

    // Delay send
    const { delay } = track.fx;
    if (delay.enabled) {
      nodes.delayNode.delayTime.setValueAtTime(delay.time, now);
      nodes.delayFeedback.gain.setValueAtTime(delay.feedback, now);
      nodes.delayWet.gain.setValueAtTime(delay.mix * 0.8, now);
      nodes.delaySend.gain.setValueAtTime(1.0, now);
    } else {
      nodes.delayWet.gain.setValueAtTime(0, now);
      nodes.delaySend.gain.setValueAtTime(0, now);
    }
  }

  private makeDistortionCurve(amount: number): Float32Array {
    const k = amount;
    const n_samples = 44100;
    const curve = new Float32Array(n_samples);
    const deg = Math.PI / 180;
    for (let i = 0; i < n_samples; ++i) {
      const x = (i * 2) / n_samples - 1;
      if (k <= 0) {
        curve[i] = x;
      } else {
        curve[i] = ((3 + k) * x * 20 * deg) / (Math.PI + k * Math.abs(x));
      }
    }
    return curve;
  }

  // Start continuous note (Note On - sustains until stopNote is called or sustained by pedal)
  public startNote(trackId: string, pitch: number, velocity = 0.8) {
    if (!this.currentProject) return;
    const track = this.currentProject.tracks.find(t => t.id === trackId);
    if (!track) return;
    const nodes = this.trackNodesMap.get(trackId);
    if (!nodes) return;

    const ctx = this.getContext();
    const key = `${trackId}_${pitch}`;

    // Clean up any previously active voice on the same track and pitch
    const existing = this.liveVoices.get(key);
    if (existing) {
      existing.stop(0.03);
      this.liveVoices.delete(key);
    }

    const presetName = track.soundPreset || 'Stereo Grand';
    const voice = SoundFontEngine.getInstance().startNote(
      ctx,
      nodes.inputGain,
      presetName,
      pitch,
      velocity
    );

    this.liveVoices.set(key, { stop: voice.stop, isSustained: false });
  }

  // Stop continuous note (Note Off)
  public stopNote(trackId: string, pitch: number) {
    const key = `${trackId}_${pitch}`;
    const voice = this.liveVoices.get(key);
    if (!voice) return;

    if (this.isSustainActive) {
      // Mark as sustained so it remains sounding until the sustain button/pedal is released
      voice.isSustained = true;
      // Auto-cleanup voice tracking once the 6s sustain fade completes
      setTimeout(() => {
        const cur = this.liveVoices.get(key);
        if (cur === voice && cur.isSustained) {
          this.liveVoices.delete(key);
        }
      }, 6200);
    } else {
      voice.stop();
      this.liveVoices.delete(key);
    }
  }

  // Sustain Button & Pedal Control
  public setSustain(active: boolean) {
    this.isSustainActive = active;
    if (!active) {
      // Release all voices that were held by sustain
      const keysToRelease: string[] = [];
      this.liveVoices.forEach((voice, key) => {
        if (voice.isSustained) {
          voice.stop();
          keysToRelease.push(key);
        }
      });
      keysToRelease.forEach(k => this.liveVoices.delete(k));
    }
  }

  public getIsSustain(): boolean {
    return this.isSustainActive;
  }

  // Transpose Key Changer
  public setTranspose(semitones: number) {
    this.transposeSemitones = Math.max(-24, Math.min(24, Math.round(semitones)));
  }

  public getTranspose(): number {
    return this.transposeSemitones;
  }

  // Audition a single note on a track for a specific duration (piano keys, drum pads, preview)
  public auditionNote(trackId: string, pitch: number, duration = 0.4, velocity = 0.8) {
    this.startNote(trackId, pitch, velocity);
    setTimeout(() => {
      this.stopNote(trackId, pitch);
    }, Math.max(80, duration * 1000));
  }

  // Panic button: immediately cuts all active voices, audio nodes, soundfonts, and sources
  public panic() {
    this.liveVoices.forEach(v => v.stop(0.02));
    this.liveVoices.clear();
    this.stopActiveAudioSources();
    SoundFontEngine.getInstance().panic();
    MidiManager.getInstance().panic();
    if (this.isPlaying) {
      this.pause();
    }
  }

  // Transport Controls
  public play() {
    if (this.isPlaying) return;
    const ctx = this.getContext();
    this.isPlaying = true;
    this.playbackStartTime = ctx.currentTime - this.playheadPosition;
    this.lastScheduledTime = this.playheadPosition;
    this.lastMetronomeBeat = -1;

    this.startSchedulerLoop();
  }

  public pause() {
    if (!this.isPlaying) return;
    this.isPlaying = false;
    this.stopActiveAudioSources();
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
  }

  public stop() {
    this.pause();
    this.playheadPosition = 0;
    this.lastScheduledTime = 0;
    if (this.onPositionUpdate) {
      this.onPositionUpdate(0);
    }
  }

  public seek(positionInSeconds: number) {
    const wasPlaying = this.isPlaying;
    if (wasPlaying) {
      this.pause();
    }
    this.playheadPosition = Math.max(0, positionInSeconds);
    this.lastScheduledTime = this.playheadPosition;
    if (this.onPositionUpdate) {
      this.onPositionUpdate(this.playheadPosition);
    }
    if (wasPlaying) {
      this.play();
    }
  }

  public getIsPlaying(): boolean {
    return this.isPlaying;
  }

  public getPlayheadPosition(): number {
    return this.playheadPosition;
  }

  public setMetronome(enabled: boolean) {
    this.metronomeEnabled = enabled;
  }

  public registerPositionListener(cb: (time: number) => void) {
    this.onPositionUpdate = cb;
  }

  public registerVUMeterListener(cb: (meters: VUMeterData[], masterL: number, masterR: number) => void) {
    this.onVUMeterUpdate = cb;
  }

  private stopActiveAudioSources() {
    for (const src of this.activeBufferSources) {
      try {
        src.stop();
        src.disconnect();
      } catch {
        // already stopped
      }
    }
    this.activeBufferSources.clear();
  }

  // Main high-precision lookahead scheduler loop
  private startSchedulerLoop() {
    const scheduleWindow = 0.15; // 150ms lookahead

    const loop = () => {
      if (!this.isPlaying || !this.ctx || !this.currentProject) return;

      const currentCtxTime = this.ctx.currentTime;
      this.playheadPosition = currentCtxTime - this.playbackStartTime;

      // Handle timeline looping
      if (this.currentProject.loopEnabled && this.currentProject.loopEnd > this.currentProject.loopStart) {
        if (this.playheadPosition >= this.currentProject.loopEnd) {
          const loopDuration = this.currentProject.loopEnd - this.currentProject.loopStart;
          this.playheadPosition = this.currentProject.loopStart + ((this.playheadPosition - this.currentProject.loopStart) % loopDuration);
          this.playbackStartTime = currentCtxTime - this.playheadPosition;
          this.lastScheduledTime = this.playheadPosition;
          this.stopActiveAudioSources();
        }
      }

      const scheduleEndTime = this.playheadPosition + scheduleWindow;

      // Schedule MIDI notes and Audio Clips
      this.scheduleRange(this.lastScheduledTime, scheduleEndTime);
      this.lastScheduledTime = scheduleEndTime;

      // Metronome
      if (this.metronomeEnabled) {
        this.scheduleMetronome(this.playheadPosition, scheduleEndTime);
      }

      if (this.onPositionUpdate) {
        this.onPositionUpdate(this.playheadPosition);
      }

      // Update VU meters
      this.pollVUMeters();

      this.animFrameId = requestAnimationFrame(loop);
    };

    this.animFrameId = requestAnimationFrame(loop);
  }

  private scheduleRange(fromTime: number, toTime: number) {
    if (!this.ctx || !this.currentProject) return;
    const ctx = this.ctx;

    this.currentProject.tracks.forEach(track => {
      const nodes = this.trackNodesMap.get(track.id);
      if (!nodes) return;

      // 1. Schedule Audio Clips
      track.audioClips.forEach(clip => {
        if (clip.isMuted) return;
        const clipEnd = clip.startTime + clip.duration;
        // Check overlap with schedule range
        if (clipEnd > fromTime && clip.startTime < toTime) {
          if (clip.audioBuffer && clip.startTime >= fromTime) {
            const startOffset = Math.max(0, fromTime - clip.startTime);
            const source = ctx.createBufferSource();
            source.buffer = clip.audioBuffer;

            const clipGain = ctx.createGain();
            clipGain.gain.setValueAtTime(clip.volume, ctx.currentTime);

            source.connect(clipGain);
            clipGain.connect(nodes.inputGain);

            const scheduleCtxTime = this.playbackStartTime + clip.startTime + startOffset;
            const bufferOffset = clip.offset + startOffset;
            const playDuration = clip.duration - startOffset;

            if (scheduleCtxTime >= ctx.currentTime && playDuration > 0) {
              source.start(scheduleCtxTime, bufferOffset, playDuration);
              this.activeBufferSources.add(source);
              source.onended = () => {
                this.activeBufferSources.delete(source);
                clipGain.disconnect();
              };
            }
          }
        }
      });

      // 2. Schedule MIDI Clips
      track.midiClips.forEach(clip => {
        clip.notes.forEach(note => {
          const noteWorldStart = clip.startTime + note.startTime;
          if (noteWorldStart >= fromTime && noteWorldStart < toTime) {
            const noteCtxTime = this.playbackStartTime + noteWorldStart;
            if (track.soundPreset) {
              SoundFontEngine.getInstance().playNote(
                ctx,
                nodes.inputGain,
                track.soundPreset,
                note.pitch,
                noteCtxTime,
                note.duration,
                note.velocity
              );
            } else {
              playSynthesizedNote(
                ctx,
                nodes.inputGain,
                track.instrument,
                note.pitch,
                noteCtxTime,
                note.duration,
                note.velocity
              );
            }
          }
        });
      });
    });
  }

  private scheduleMetronome(fromTime: number, toTime: number) {
    if (!this.ctx || !this.currentProject) return;
    const bpm = this.currentProject.bpm;
    const secondsPerBeat = 60 / bpm;
    const currentBeat = Math.floor(fromTime / secondsPerBeat);
    const endBeat = Math.floor(toTime / secondsPerBeat);

    for (let beat = currentBeat; beat <= endBeat; beat++) {
      if (beat > this.lastMetronomeBeat) {
        const beatTime = beat * secondsPerBeat;
        if (beatTime >= fromTime && beatTime < toTime) {
          const isAccent = beat % (this.currentProject.timeSignature[0] || 4) === 0;
          playMetronomeClick(this.ctx, this.playbackStartTime + beatTime, isAccent);
          this.lastMetronomeBeat = beat;
        }
      }
    }
  }

  private pollVUMeters() {
    if (!this.onVUMeterUpdate) return;
    const meters: VUMeterData[] = [];
    const buffer = new Float32Array(128);

    for (const [trackId, nodes] of this.trackNodesMap.entries()) {
      nodes.analyser.getFloatTimeDomainData(buffer);
      let peak = 0;
      for (let i = 0; i < buffer.length; i++) {
        const abs = Math.abs(buffer[i]);
        if (abs > peak) peak = abs;
      }
      meters.push({
        trackId,
        left: peak,
        right: peak,
        peak: Math.min(peak, 1.2),
      });
    }

    // Master Meter
    let masterL = 0;
    let masterR = 0;
    if (this.masterAnalyserL && this.masterAnalyserR) {
      this.masterAnalyserL.getFloatTimeDomainData(buffer);
      for (let i = 0; i < buffer.length; i++) {
        const abs = Math.abs(buffer[i]);
        if (abs > masterL) masterL = abs;
      }
      this.masterAnalyserR.getFloatTimeDomainData(buffer);
      for (let i = 0; i < buffer.length; i++) {
        const abs = Math.abs(buffer[i]);
        if (abs > masterR) masterR = abs;
      }
    }

    this.onVUMeterUpdate(meters, Math.min(masterL, 1.2), Math.min(masterR, 1.2));
  }

  // --- Real Microphone Recording ---
  public async startRecording(trackId: string): Promise<boolean> {
    try {
      this.recordingTrackId = trackId;
      this.recordedChunks = [];
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
      });
      this.mediaStream = stream;

      const ctx = this.getContext();
      const micSource = ctx.createMediaStreamSource(stream);
      this.micAnalyser = ctx.createAnalyser();
      this.micAnalyser.fftSize = 128;
      micSource.connect(this.micAnalyser);

      this.mediaRecorder = new MediaRecorder(stream);
      this.mediaRecorder.ondataavailable = e => {
        if (e.data && e.data.size > 0) {
          this.recordedChunks.push(e.data);
        }
      };

      this.recordingStartTime = this.playheadPosition;
      this.mediaRecorder.start(100);

      // Also start playback so user can sing/record in sync!
      if (!this.isPlaying) {
        this.play();
      }

      return true;
    } catch (err) {
      console.error('Failed to access microphone for recording:', err);
      return false;
    }
  }

  public async stopRecording(): Promise<AudioClip | null> {
    if (!this.mediaRecorder || !this.recordingTrackId) {
      return null;
    }

    return new Promise(resolve => {
      if (!this.mediaRecorder) {
        resolve(null);
        return;
      }

      this.mediaRecorder.onstop = async () => {
        try {
          const blob = new Blob(this.recordedChunks, { type: 'audio/webm' });
          const arrayBuffer = await blob.arrayBuffer();
          const ctx = this.getContext();
          const audioBuffer = await ctx.decodeAudioData(arrayBuffer);

          const duration = audioBuffer.duration;
          const peaks = extractWaveformData(audioBuffer, 120);

          const newClip: AudioClip = {
            id: `clip-${Date.now()}`,
            trackId: this.recordingTrackId!,
            name: `Take ${new Date().toLocaleTimeString([], { minute: '2-digit', second: '2-digit' })}`,
            startTime: this.recordingStartTime,
            duration,
            offset: 0,
            volume: 1.0,
            color: '#ef4444', // studio record red
            audioBuffer,
            waveformData: peaks,
          };

          // Clean up stream
          if (this.mediaStream) {
            this.mediaStream.getTracks().forEach(t => t.stop());
            this.mediaStream = null;
          }
          this.mediaRecorder = null;
          this.recordingTrackId = null;

          resolve(newClip);
        } catch (e) {
          console.error('Error decoding recorded audio:', e);
          resolve(null);
        }
      };

      this.mediaRecorder.stop();
      this.pause();
    });
  }

  // Load an audio file (e.g. user drag and drop WAV/MP3) into an AudioClip
  public async loadAudioFileToClip(file: File, trackId: string, startTime = 0): Promise<AudioClip> {
    const arrayBuffer = await file.arrayBuffer();
    const ctx = this.getContext();
    const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
    const peaks = extractWaveformData(audioBuffer, 120);

    return {
      id: `clip-file-${Date.now()}`,
      trackId,
      name: file.name.replace(/\.[^/.]+$/, ''),
      startTime,
      duration: audioBuffer.duration,
      offset: 0,
      volume: 1.0,
      color: '#3b82f6',
      audioBuffer,
      waveformData: peaks,
    };
  }
}
