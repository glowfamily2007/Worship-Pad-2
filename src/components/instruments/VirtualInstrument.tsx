import React, { useState, useEffect, useRef } from 'react';
import { Music, Disc, Circle, ChevronLeft, ChevronRight, Volume2 } from 'lucide-react';
import { Project, Track } from '../../types';
import { noteNumberToName } from '../../audio/soundGenerator';
import { AudioEngine } from '../../audio/AudioEngine';
import { MidiManager } from '../../audio/midiManager';

interface VirtualInstrumentProps {
  project: Project;
  selectedTrackId: string | null;
  setSelectedTrackId: (id: string | null) => void;
  onAuditionNote: (trackId: string, pitch: number, duration?: number, velocity?: number) => void;
  onRecordLiveNote?: (trackId: string, pitch: number, velocity: number) => void;
  onLiveNoteStart?: (trackId: string, pitch: number, velocity: number) => void;
  onLiveNoteEnd?: (trackId: string, pitch: number) => void;
  isRecording: boolean;
}

export const VirtualInstrument: React.FC<VirtualInstrumentProps> = ({
  project,
  selectedTrackId,
  setSelectedTrackId,
  onAuditionNote,
  onRecordLiveNote,
  onLiveNoteStart,
  onLiveNoteEnd,
  isRecording,
}) => {
  const audioEngine = AudioEngine.getInstance();
  const midiManager = MidiManager.getInstance();

  const [instrumentMode, setInstrumentMode] = useState<'keyboard' | 'drumpad'>('keyboard');
  const [octaveShift, setOctaveShift] = useState(0); // -2 to +2
  const [velocity, setVelocity] = useState(0.85);
  const [activeNotes, setActiveNotes] = useState<Set<number>>(new Set());

  // Sustain and Transpose state
  const [isSustainActive, setIsSustainActive] = useState<boolean>(midiManager.getIsSustainActive());
  const [transpose, setTransposeState] = useState<number>(midiManager.getTranspose());

  const activeTrack =
    project.tracks.find(t => t.id === selectedTrackId) ||
    project.tracks.find(t => t.type === 'drum') ||
    project.tracks[0];

  const armedTracks = project.tracks.filter(t => t.isArmed);
  const armedCount = armedTracks.length;

  // Base C3 = 48
  const basePitch = 48 + octaveShift * 12;

  // Track active key presses in ref to avoid stale closure in event listeners
  const activeKeysRef = useRef<Set<number>>(new Set());

  // Keep state synced with MIDI Manager
  useEffect(() => {
    const unsubSustain = midiManager.onSustainChanged(active => {
      setIsSustainActive(active);
    });
    return () => {
      unsubSustain();
    };
  }, [midiManager]);

  const handleToggleSustain = () => {
    const next = !isSustainActive;
    setIsSustainActive(next);
    midiManager.setSustainActive(next);
    audioEngine.setSustain(next);
  };

  const handleSetTranspose = (val: number) => {
    const clamped = Math.max(-24, Math.min(24, val));
    setTransposeState(clamped);
    midiManager.setTranspose(clamped);
    audioEngine.setTranspose(clamped);
  };

  // QWERTY keyboard mapping for 25 keys
  const keyboardKeyMap: { [key: string]: number } = {
    a: 0, // C
    w: 1, // C#
    s: 2, // D
    e: 3, // D#
    d: 4, // E
    f: 5, // F
    t: 6, // F#
    g: 7, // G
    y: 8, // G#
    h: 9, // A
    u: 10, // A#
    j: 11, // B
    k: 12, // C (+1)
    o: 13, // C#
    l: 14, // D
    p: 15, // D#
    ';': 16, // E
    "'": 17, // F
  };

  // Drum Pads (4x4 matrix)
  const drumPads = [
    { pitch: 48, name: 'High Tom', key: 'Q', color: 'from-purple-600 to-indigo-600' },
    { pitch: 49, name: 'Crash Cymbal', key: 'W', color: 'from-amber-600 to-yellow-500' },
    { pitch: 51, name: 'Ride Cymbal', key: 'E', color: 'from-yellow-600 to-amber-500' },
    { pitch: 56, name: 'Cowbell', key: 'R', color: 'from-teal-600 to-emerald-500' },

    { pitch: 42, name: 'Closed Hat', key: 'A', color: 'from-blue-600 to-cyan-500' },
    { pitch: 46, name: 'Open Hat', key: 'S', color: 'from-cyan-600 to-blue-500' },
    { pitch: 45, name: 'Low Tom', key: 'D', color: 'from-indigo-600 to-blue-600' },
    { pitch: 47, name: 'Mid Tom', key: 'F', color: 'from-indigo-600 to-purple-600' },

    { pitch: 36, name: 'Punch Kick', key: 'Z', color: 'from-rose-600 to-red-500' },
    { pitch: 35, name: 'Sub Kick', key: 'X', color: 'from-red-600 to-rose-700' },
    { pitch: 38, name: 'Snare Drum', key: 'C', color: 'from-pink-600 to-rose-500' },
    { pitch: 39, name: 'Hand Clap', key: 'V', color: 'from-fuchsia-600 to-pink-500' },

    { pitch: 37, name: 'Rimshot', key: '1', color: 'from-slate-600 to-zinc-500' },
    { pitch: 70, name: 'Shaker', key: '2', color: 'from-lime-600 to-emerald-600' },
    { pitch: 54, name: 'Tambourine', key: '3', color: 'from-amber-500 to-orange-600' },
    { pitch: 60, name: 'Laser FX', key: '4', color: 'from-violet-600 to-indigo-600' },
  ];

  const drumKeyMap: { [key: string]: number } = {
    q: 48,
    w: 49,
    e: 51,
    r: 56,
    a: 42,
    s: 46,
    d: 45,
    f: 47,
    z: 36,
    x: 35,
    c: 38,
    v: 39,
    '1': 37,
    '2': 70,
    '3': 54,
    '4': 60,
  };

  // Start continuous note: sound will NOT stop until stopNote is called!
  // Supports multi-track recording: triggers across ALL armed tracks!
  const startNote = (pitch: number) => {
    if (activeKeysRef.current.has(pitch)) return;
    activeKeysRef.current.add(pitch);
    setActiveNotes(new Set(activeKeysRef.current));

    const targets = armedTracks.length > 0 ? armedTracks : (activeTrack ? [activeTrack] : []);
    for (const track of targets) {
      audioEngine.startNote(track.id, pitch, velocity);
      if (isRecording) {
        if (onLiveNoteStart) {
          onLiveNoteStart(track.id, pitch, velocity);
        } else if (onRecordLiveNote) {
          onRecordLiveNote(track.id, pitch, velocity);
        }
      }
    }
  };

  // Stop note: called on key release / mouse up / touch end
  const stopNote = (pitch: number) => {
    if (!activeKeysRef.current.has(pitch)) return;
    activeKeysRef.current.delete(pitch);
    setActiveNotes(new Set(activeKeysRef.current));

    const targets = armedTracks.length > 0 ? armedTracks : (activeTrack ? [activeTrack] : []);
    for (const track of targets) {
      audioEngine.stopNote(track.id, pitch);
      if (isRecording && onLiveNoteEnd) {
        onLiveNoteEnd(track.id, pitch);
      }
    }
  };

  // Listen to physical keyboard presses (Note On on keydown, Note Off on keyup)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.repeat) return; // Ignore browser key repeat to preserve sustained notes
      const key = e.key.toLowerCase();

      if (instrumentMode === 'keyboard') {
        if (keyboardKeyMap[key] !== undefined) {
          e.preventDefault();
          const pitch = basePitch + keyboardKeyMap[key];
          startNote(pitch);
        }
      } else {
        if (drumKeyMap[key] !== undefined) {
          e.preventDefault();
          startNote(drumKeyMap[key]);
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      const key = e.key.toLowerCase();

      if (instrumentMode === 'keyboard') {
        if (keyboardKeyMap[key] !== undefined) {
          e.preventDefault();
          const pitch = basePitch + keyboardKeyMap[key];
          stopNote(pitch);
        }
      } else {
        if (drumKeyMap[key] !== undefined) {
          e.preventDefault();
          stopNote(drumKeyMap[key]);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [instrumentMode, basePitch, activeTrack, armedTracks, velocity, isRecording]);

  if (!activeTrack) return null;

  return (
    <div className="flex-1 bg-[#0f1115] flex flex-col p-4 select-none overflow-y-auto">
      {/* Top Bar: Mode switcher, Track picker, Sustain, Transpose, Octave, Velocity */}
      <div className="bg-[#1a1d23] border border-[#2d333d] rounded p-3 mb-4 flex items-center justify-between flex-wrap gap-3 shadow-sm">
        {/* Instrument / Mode buttons */}
        <div className="flex items-center space-x-2 flex-wrap gap-y-2">
          <div className="flex items-center bg-[#16191e] p-0.5 rounded border border-[#2d333d] space-x-0.5">
            <button
              onClick={() => setInstrumentMode('keyboard')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded text-xs font-bold transition-colors ${
                instrumentMode === 'keyboard'
                  ? 'bg-[#3b82f6] text-white shadow-sm'
                  : 'text-[#94a3b8] hover:text-white'
              }`}
            >
              <Music className="w-3.5 h-3.5" />
              <span>Synthesizer Keys</span>
            </button>
            <button
              onClick={() => setInstrumentMode('drumpad')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded text-xs font-bold transition-colors ${
                instrumentMode === 'drumpad'
                  ? 'bg-[#3b82f6] text-white shadow-sm'
                  : 'text-[#94a3b8] hover:text-white'
              }`}
            >
              <Disc className="w-3.5 h-3.5" />
              <span>16 Drum Pads</span>
            </button>
          </div>

          <div className="h-5 w-px bg-[#2d333d]" />

          {/* Route To Track / Armed Multi-Track Status */}
          <div className="flex items-center space-x-1.5">
            <span className="text-[10px] uppercase font-bold text-[#64748b] tracking-wider">TRACK</span>
            <select
              value={activeTrack.id}
              onChange={e => setSelectedTrackId(e.target.value)}
              className="bg-[#16191e] text-xs font-bold text-white px-2.5 py-1 rounded border border-[#2d333d] focus:outline-none cursor-pointer max-w-[180px] truncate"
            >
              {project.tracks.map(t => (
                <option key={t.id} value={t.id} className="bg-[#1a1d23]">
                  {t.name} {t.isArmed ? '🔴 ARMED' : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Multi-Track Recording Indicator */}
          {armedCount > 1 && (
            <div className="px-2 py-1 bg-rose-500/15 border border-rose-500/30 rounded text-[10px] font-mono text-rose-300">
              MULTI-REC: <span className="font-bold">{armedCount} Tracks Armed</span>
            </div>
          )}
        </div>

        {/* Center/Right: Sustain button, Transpose changer, Octave & Velocity */}
        <div className="flex items-center space-x-2.5 flex-wrap gap-y-2">
          {/* SUSTAIN BUTTON */}
          <button
            type="button"
            onClick={handleToggleSustain}
            title="Sustain Notes (Keeps sound playing until released, or use USB MIDI sustain pedal CC 64)"
            className={`flex items-center gap-1.5 px-3 py-1 rounded border text-xs font-bold transition-all shadow-sm ${
              isSustainActive
                ? 'bg-cyan-500/20 text-cyan-300 border-cyan-400 shadow-[0_0_10px_rgba(6,182,212,0.4)]'
                : 'bg-[#16191e] hover:bg-[#202530] text-neutral-300 border-[#2d333d]'
            }`}
          >
            <div
              className={`w-2 h-2 rounded-full ${
                isSustainActive ? 'bg-cyan-400 shadow-[0_0_6px_#22d3ee] animate-pulse' : 'bg-neutral-600'
              }`}
            />
            <span>SUSTAIN {isSustainActive ? 'ON' : 'OFF'}</span>
          </button>

          {/* KEY TRANSPOSE CHANGER */}
          <div className="flex items-center bg-[#16191e] border border-[#2d333d] rounded px-1.5 py-0.5 text-xs">
            <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-tighter mr-1.5">KEY</span>
            <button
              type="button"
              onClick={() => handleSetTranspose(transpose - 12)}
              title="Transpose down 1 octave (-12 st)"
              className="px-1 py-0.5 hover:text-white text-neutral-400 font-mono text-[10px]"
            >
              -12
            </button>
            <button
              type="button"
              onClick={() => handleSetTranspose(transpose - 1)}
              title="Transpose down 1 semitone (-1 st)"
              className="px-1.5 py-0.5 hover:text-white text-neutral-300 font-mono text-xs font-bold"
            >
              -
            </button>
            <button
              type="button"
              onClick={() => handleSetTranspose(0)}
              title="Click to reset transpose to 0"
              className={`px-1.5 py-0.5 font-mono text-xs font-bold rounded ${
                transpose !== 0 ? 'text-amber-400 bg-amber-400/10' : 'text-neutral-200'
              }`}
            >
              {transpose > 0 ? `+${transpose}` : transpose} st
            </button>
            <button
              type="button"
              onClick={() => handleSetTranspose(transpose + 1)}
              title="Transpose up 1 semitone (+1 st)"
              className="px-1.5 py-0.5 hover:text-white text-neutral-300 font-mono text-xs font-bold"
            >
              +
            </button>
            <button
              type="button"
              onClick={() => handleSetTranspose(transpose + 12)}
              title="Transpose up 1 octave (+12 st)"
              className="px-1 py-0.5 hover:text-white text-neutral-400 font-mono text-[10px]"
            >
              +12
            </button>
          </div>

          {/* Octave Shift */}
          {instrumentMode === 'keyboard' && (
            <div className="flex items-center space-x-1 bg-[#16191e] px-2.5 py-1 rounded border border-[#2d333d]">
              <span className="text-[10px] uppercase font-bold text-[#64748b] tracking-wider">OCT</span>
              <button
                onClick={() => setOctaveShift(Math.max(-2, octaveShift - 1))}
                className="w-6 h-6 flex items-center justify-center rounded text-[#94a3b8] hover:text-white hover:bg-[#2d333d] transition-colors"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <span className="font-mono text-xs font-bold text-[#38bdf8] w-6 text-center">
                {octaveShift > 0 ? `+${octaveShift}` : octaveShift}
              </span>
              <button
                onClick={() => setOctaveShift(Math.min(2, octaveShift + 1))}
                className="w-6 h-6 flex items-center justify-center rounded text-[#94a3b8] hover:text-white hover:bg-[#2d333d] transition-colors"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Velocity */}
          <div className="flex items-center space-x-2 bg-[#16191e] px-2.5 py-1 rounded border border-[#2d333d]">
            <span className="text-[10px] uppercase font-bold text-[#64748b] tracking-wider">VEL</span>
            <input
              type="range"
              min={0.2}
              max={1}
              step={0.05}
              value={velocity}
              onChange={e => setVelocity(parseFloat(e.target.value))}
              className="w-16 h-1 bg-[#2d333d] rounded accent-[#3b82f6] cursor-pointer"
            />
            <span className="font-mono text-xs font-bold text-[#10b981] w-6 text-right">
              {Math.round(velocity * 127)}
            </span>
          </div>

          {/* Live Recording Indicator */}
          {isRecording && (
            <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded bg-[#ef4444]/20 border border-[#ef4444]/50 text-[#ef4444] text-xs font-bold animate-pulse">
              <Circle className="w-2.5 h-2.5 fill-current" />
              <span>REC</span>
            </div>
          )}
        </div>
      </div>

      {/* Mode A: 25-Key Interactive Keyboard with continuous note sustain until release */}
      {instrumentMode === 'keyboard' && (
        <div className="flex-1 flex flex-col justify-center items-center bg-[#1a1d23] rounded border border-[#2d333d] p-6 shadow-sm">
          <div className="relative flex justify-center h-64 max-w-4xl w-full select-none">
            {/* White Keys (15 white keys for 2 octaves) */}
            {Array.from({ length: 15 }).map((_, i) => {
              // Convert white key index to pitch offset
              const whiteKeyOffsets = [0, 2, 4, 5, 7, 9, 11, 12, 14, 16, 17, 19, 21, 23, 24];
              const pitch = basePitch + whiteKeyOffsets[i];
              const isPressed = activeNotes.has(pitch);

              return (
                <button
                  key={`white-${i}`}
                  onMouseDown={() => startNote(pitch)}
                  onMouseUp={() => stopNote(pitch)}
                  onMouseLeave={() => stopNote(pitch)}
                  onTouchStart={e => {
                    e.preventDefault();
                    startNote(pitch);
                  }}
                  onTouchEnd={e => {
                    e.preventDefault();
                    stopNote(pitch);
                  }}
                  className={`flex-1 min-w-[36px] max-w-[58px] rounded-b border-2 border-[#16191e] transition-all flex flex-col justify-end pb-3 items-center ${
                    isPressed
                      ? 'bg-[#3b82f6] text-white shadow-[0_0_15px_rgba(59,130,246,0.8)] scale-[0.98]'
                      : 'bg-[#f1f5f9] hover:bg-white active:bg-[#3b82f6] text-slate-800'
                  }`}
                >
                  <span className="text-[10px] font-mono font-bold">{noteNumberToName(pitch)}</span>
                </button>
              );
            })}

            {/* Black Keys (Overlayed absolute) */}
            {[
              { offset: 1, pos: 0.7 },
              { offset: 3, pos: 1.7 },
              { offset: 6, pos: 3.7 },
              { offset: 8, pos: 4.7 },
              { offset: 10, pos: 5.7 },
              { offset: 13, pos: 7.7 },
              { offset: 15, pos: 8.7 },
              { offset: 18, pos: 10.7 },
              { offset: 20, pos: 11.7 },
              { offset: 22, pos: 12.7 },
            ].map(({ offset, pos }, idx) => {
              const pitch = basePitch + offset;
              const isPressed = activeNotes.has(pitch);

              return (
                <button
                  key={`black-${idx}`}
                  onMouseDown={e => {
                    e.stopPropagation();
                    startNote(pitch);
                  }}
                  onMouseUp={e => {
                    e.stopPropagation();
                    stopNote(pitch);
                  }}
                  onMouseLeave={e => {
                    e.stopPropagation();
                    stopNote(pitch);
                  }}
                  onTouchStart={e => {
                    e.stopPropagation();
                    e.preventDefault();
                    startNote(pitch);
                  }}
                  onTouchEnd={e => {
                    e.stopPropagation();
                    e.preventDefault();
                    stopNote(pitch);
                  }}
                  className={`absolute top-0 w-8 h-36 rounded-b z-10 transition-all flex flex-col justify-end pb-2 items-center shadow-lg ${
                    isPressed
                      ? 'bg-[#3b82f6] text-white ring-2 ring-white scale-[0.98] shadow-[0_0_15px_rgba(59,130,246,0.8)]'
                      : 'bg-[#16191e] border border-[#2d333d] hover:bg-[#232832] text-[#94a3b8]'
                  }`}
                  style={{
                    left: `calc(${pos} * (100% / 15))`,
                  }}
                >
                  <span className="text-[9px] font-mono">{noteNumberToName(pitch)}</span>
                </button>
              );
            })}
          </div>

          <div className="mt-4 text-center text-xs font-mono text-[#64748b]">
            Continuous Note Hold: sound plays until key is released (or sustained). Use computer keyboard <span className="text-[#38bdf8] font-bold">A - S - D - F - G - H - J - K - L</span> (Whites) & <span className="text-[#10b981] font-bold">W - E - T - Y - U - O - P</span> (Blacks)
          </div>
        </div>
      )}

      {/* Mode B: 16-Pad MPC Drum Machine */}
      {instrumentMode === 'drumpad' && (
        <div className="flex-1 flex flex-col justify-center items-center bg-[#1a1d23] rounded border border-[#2d333d] p-6 shadow-sm">
          <div className="grid grid-cols-4 gap-3 max-w-2xl w-full">
            {drumPads.map(pad => {
              const isHit = activeNotes.has(pad.pitch);

              return (
                <button
                  key={pad.name}
                  onMouseDown={() => startNote(pad.pitch)}
                  onMouseUp={() => stopNote(pad.pitch)}
                  onMouseLeave={() => stopNote(pad.pitch)}
                  onTouchStart={e => {
                    e.preventDefault();
                    startNote(pad.pitch);
                  }}
                  onTouchEnd={e => {
                    e.preventDefault();
                    stopNote(pad.pitch);
                  }}
                  className={`h-24 rounded p-3 flex flex-col justify-between border transition-all shadow active:scale-95 ${
                    isHit
                      ? 'ring-2 ring-white border-white bg-[#3b82f6] text-white scale-[0.97] shadow-[0_0_20px_rgba(59,130,246,0.8)]'
                      : 'border-[#2d333d] bg-[#16191e] hover:border-[#3b82f6]/70'
                  }`}
                >
                  <div className="flex justify-between items-center w-full">
                    <span className="font-mono text-xs font-bold bg-[#2d333d] px-1.5 py-0.5 rounded text-white">
                      {pad.key}
                    </span>
                    <span className="text-[9px] font-mono text-[#64748b]">#{pad.pitch}</span>
                  </div>

                  <span className="text-xs font-bold text-white tracking-wide text-left">
                    {pad.name}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="mt-4 text-center text-xs font-mono text-[#64748b]">
            MPC Performance Pads: tap with mouse/touch or physical keys <span className="text-[#38bdf8] font-bold">Z, X, C, V, A, S, D, F, Q, W, E, R, 1, 2, 3, 4</span>
          </div>
        </div>
      )}
    </div>
  );
};
