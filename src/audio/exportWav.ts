// High-fidelity Offline WAV Exporter for Audio Evolution Studio
import { Project } from '../types';
import { playSynthesizedNote } from './soundGenerator';

export async function exportProjectToWav(
  project: Project,
  onProgress?: (ratio: number) => void
): Promise<Blob> {
  // 1. Calculate total song length
  let maxDuration = 8; // minimum 8 seconds
  project.tracks.forEach(t => {
    t.audioClips.forEach(c => {
      maxDuration = Math.max(maxDuration, c.startTime + c.duration);
    });
    t.midiClips.forEach(c => {
      c.notes.forEach(n => {
        maxDuration = Math.max(maxDuration, c.startTime + n.startTime + n.duration);
      });
    });
  });
  maxDuration += 2.0; // tail for reverb/delay ringing out

  const sampleRate = 44100;
  const length = Math.ceil(maxDuration * sampleRate);
  const offlineCtx = new OfflineAudioContext(2, length, sampleRate);

  // Master Limiter
  const limiter = offlineCtx.createDynamicsCompressor();
  limiter.threshold.setValueAtTime(-0.5, 0);
  limiter.ratio.setValueAtTime(20, 0);
  limiter.connect(offlineCtx.destination);

  const masterGain = offlineCtx.createGain();
  masterGain.gain.setValueAtTime(project.masterVolume, 0);
  masterGain.connect(limiter);

  const hasSolo = project.tracks.some(t => t.isSolo);

  // Set up tracks
  for (const track of project.tracks) {
    let effVol = track.volume;
    if (track.isMuted) effVol = 0;
    else if (hasSolo && !track.isSolo) effVol = 0;

    const trackGain = offlineCtx.createGain();
    trackGain.gain.setValueAtTime(effVol, 0);

    const panNode = offlineCtx.createStereoPanner
      ? offlineCtx.createStereoPanner()
      : (offlineCtx.createGain() as unknown as StereoPannerNode);
    if (panNode.pan) {
      panNode.pan.setValueAtTime(track.pan, 0);
    }

    // EQ
    const eqLow = offlineCtx.createBiquadFilter();
    eqLow.type = 'lowshelf';
    eqLow.frequency.setValueAtTime(track.fx.eq.lowFreq, 0);
    eqLow.gain.setValueAtTime(track.fx.eq.enabled ? track.fx.eq.lowGain : 0, 0);

    const eqMid = offlineCtx.createBiquadFilter();
    eqMid.type = 'peaking';
    eqMid.frequency.setValueAtTime(track.fx.eq.midFreq, 0);
    eqMid.gain.setValueAtTime(track.fx.eq.enabled ? track.fx.eq.midGain : 0, 0);

    const eqHigh = offlineCtx.createBiquadFilter();
    eqHigh.type = 'highshelf';
    eqHigh.frequency.setValueAtTime(track.fx.eq.highFreq, 0);
    eqHigh.gain.setValueAtTime(track.fx.eq.enabled ? track.fx.eq.highGain : 0, 0);

    const trackInput = offlineCtx.createGain();
    trackInput.connect(eqLow);
    eqLow.connect(eqMid);
    eqMid.connect(eqHigh);
    eqHigh.connect(panNode);
    panNode.connect(trackGain);
    trackGain.connect(masterGain);

    // Audio Clips
    track.audioClips.forEach(clip => {
      if (clip.isMuted || !clip.audioBuffer) return;
      const src = offlineCtx.createBufferSource();
      src.buffer = clip.audioBuffer;
      const cGain = offlineCtx.createGain();
      cGain.gain.setValueAtTime(clip.volume, 0);
      src.connect(cGain);
      cGain.connect(trackInput);
      src.start(clip.startTime, clip.offset, clip.duration);
    });

    // MIDI Clips
    track.midiClips.forEach(clip => {
      clip.notes.forEach(note => {
        const noteStart = clip.startTime + note.startTime;
        playSynthesizedNote(
          offlineCtx,
          trackInput,
          track.instrument,
          note.pitch,
          noteStart,
          note.duration,
          note.velocity
        );
      });
    });
  }

  if (onProgress) onProgress(0.2);

  const renderedBuffer = await offlineCtx.startRendering();
  if (onProgress) onProgress(0.8);

  const wavBlob = audioBufferToWavBlob(renderedBuffer);
  if (onProgress) onProgress(1.0);

  return wavBlob;
}

// Convert AudioBuffer to 16-bit PCM WAV Blob
function audioBufferToWavBlob(buffer: AudioBuffer): Blob {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const format = 1; // PCM
  const bitDepth = 16;
  const bytesPerSample = bitDepth / 8;
  const blockAlign = numChannels * bytesPerSample;

  const length = buffer.length;
  const byteLength = 44 + length * blockAlign;
  const arrayBuffer = new ArrayBuffer(byteLength);
  const view = new DataView(arrayBuffer);

  // Write WAV RIFF header
  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + length * blockAlign, true);
  writeString(view, 8, 'WAVE');
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true); // SubChunk1Size
  view.setUint16(20, format, true); // AudioFormat
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true); // ByteRate
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitDepth, true);
  writeString(view, 36, 'data');
  view.setUint32(40, length * blockAlign, true);

  // Interleave channels
  const channels: Float32Array[] = [];
  for (let c = 0; c < numChannels; c++) {
    channels.push(buffer.getChannelData(c));
  }

  let offset = 44;
  for (let i = 0; i < length; i++) {
    for (let c = 0; c < numChannels; c++) {
      let sample = channels[c][i];
      // Clamp between -1.0 and 1.0
      sample = Math.max(-1, Math.min(1, sample));
      // Scale to 16-bit signed int
      const intSample = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
      view.setInt16(offset, intSample, true);
      offset += 2;
    }
  }

  return new Blob([view], { type: 'audio/wav' });
}

function writeString(view: DataView, offset: number, string: string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}
