import React, { useState, useRef } from 'react';
import {
  Grid,
  Pencil,
  Eraser,
  MousePointer,
  ChevronUp,
  ChevronDown,
  Sparkles,
  Trash2,
  Copy,
  Play,
  Volume2,
} from 'lucide-react';
import { MidiClip, MidiNote, Project, SnapGrid, ToolMode, Track } from '../../types';
import { noteNumberToName } from '../../audio/soundGenerator';

interface PianoRollProps {
  project: Project;
  setProject: React.Dispatch<React.SetStateAction<Project>>;
  selectedTrackId: string | null;
  setSelectedTrackId: (id: string | null) => void;
  onAuditionNote: (trackId: string, pitch: number) => void;
}

export const PianoRoll: React.FC<PianoRollProps> = ({
  project,
  setProject,
  selectedTrackId,
  setSelectedTrackId,
  onAuditionNote,
}) => {
  // Find current active track (or fallback to first MIDI/Drum track)
  const midiTracks = project.tracks.filter(t => t.type !== 'audio');
  const activeTrack =
    project.tracks.find(t => t.id === selectedTrackId && t.type !== 'audio') ||
    midiTracks[0];

  const [activeClipIndex, setActiveClipIndex] = useState(0);
  const [pitchRangeStart, setPitchRangeStart] = useState(36); // MIDI pitch bottom (e.g. C2)
  const numPitches = 36; // 3 octaves
  const [zoomX, setZoomX] = useState(120); // px per second
  const [tool, setTool] = useState<ToolMode>('draw');
  const [snap, setSnap] = useState<SnapGrid>('1/16');

  const gridContainerRef = useRef<HTMLDivElement>(null);

  if (!activeTrack) {
    return (
      <div className="flex-1 bg-[#0b0c10] flex items-center justify-center text-slate-500 text-sm">
        No MIDI or Drum tracks available. Add a Synth or Drum track in the Arranger view to edit notes!
      </div>
    );
  }

  // Active MIDI clip
  let activeClip = activeTrack.midiClips[activeClipIndex];
  if (!activeClip && activeTrack.midiClips.length > 0) {
    activeClip = activeTrack.midiClips[0];
  }

  // If track has no clips yet, offer to create one
  const handleCreateClip = () => {
    const newClip: MidiClip = {
      id: `midi-${Date.now()}`,
      trackId: activeTrack.id,
      name: `${activeTrack.name} Pattern`,
      startTime: 0,
      duration: 8.0,
      notes: [],
      color: activeTrack.color,
    };
    setProject(prev => ({
      ...prev,
      tracks: prev.tracks.map(t =>
        t.id === activeTrack.id ? { ...t, midiClips: [...t.midiClips, newClip] } : t
      ),
    }));
  };

  const updateClipNotes = (newNotes: MidiNote[]) => {
    if (!activeClip) return;
    setProject(prev => ({
      ...prev,
      tracks: prev.tracks.map(t =>
        t.id === activeTrack.id
          ? {
              ...t,
              midiClips: t.midiClips.map(c =>
                c.id === activeClip.id ? { ...c, notes: newNotes } : c
              ),
            }
          : t
      ),
    }));
  };

  // Snapping logic
  const secondsPerBeat = 60 / project.bpm;
  const getSnapInterval = (): number => {
    switch (snap) {
      case '1bar':
        return secondsPerBeat * 4;
      case '1/4':
        return secondsPerBeat;
      case '1/8':
        return secondsPerBeat / 2;
      case '1/16':
        return secondsPerBeat / 4;
      case '1/32':
        return secondsPerBeat / 8;
      case 'off':
      default:
        return 0.001;
    }
  };

  const snapValue = (val: number) => {
    const interval = getSnapInterval();
    return Math.max(0, Math.round(val / interval) * interval);
  };

  // Quantize all notes in current clip
  const handleQuantize = () => {
    if (!activeClip) return;
    const interval = getSnapInterval();
    const quantized = activeClip.notes.map(n => ({
      ...n,
      startTime: Math.round(n.startTime / interval) * interval,
      duration: Math.max(interval, Math.round(n.duration / interval) * interval),
    }));
    updateClipNotes(quantized);
  };

  // Transpose Octave
  const handleTranspose = (semitones: number) => {
    if (!activeClip) return;
    const transposed = activeClip.notes.map(n => ({
      ...n,
      pitch: Math.max(0, Math.min(127, n.pitch + semitones)),
    }));
    updateClipNotes(transposed);
  };

  // Note Grid Dimensions
  const clipDuration = activeClip ? activeClip.duration : 8.0;
  const gridWidth = clipDuration * zoomX;
  const rowHeight = 22; // px per semitone
  const gridHeight = numPitches * rowHeight;

  // Clicking / Drawing on grid
  const handleGridMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!activeClip || !gridContainerRef.current) return;
    const rect = gridContainerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const clickedTime = snapValue(x / zoomX);
    const rowFromTop = Math.floor(y / rowHeight);
    const pitch = pitchRangeStart + (numPitches - 1 - rowFromTop);

    // Audition pitch
    onAuditionNote(activeTrack.id, pitch);

    if (tool === 'erase') {
      // Find note at click
      const noteToDel = activeClip.notes.find(
        n => n.pitch === pitch && clickedTime >= n.startTime && clickedTime <= n.startTime + n.duration
      );
      if (noteToDel) {
        updateClipNotes(activeClip.notes.filter(n => n.id !== noteToDel.id));
      }
      return;
    }

    if (tool === 'draw') {
      const defaultDuration = getSnapInterval();
      const newNote: MidiNote = {
        id: `note-${Date.now()}`,
        pitch,
        startTime: clickedTime,
        duration: defaultDuration,
        velocity: 0.85,
      };

      const notes = [...activeClip.notes, newNote];
      updateClipNotes(notes);

      // Drag to extend duration
      const startX = e.clientX;
      const onMouseMove = (moveEv: MouseEvent) => {
        const deltaX = moveEv.clientX - startX;
        const addedDuration = Math.max(defaultDuration, snapValue(defaultDuration + deltaX / zoomX));
        const updatedNotes = notes.map(n =>
          n.id === newNote.id ? { ...n, duration: addedDuration } : n
        );
        updateClipNotes(updatedNotes);
      };

      const onMouseUp = () => {
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseup', onMouseUp);
      };

      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
    }
  };

  const isBlackKey = (pitch: number) => {
    const semitone = pitch % 12;
    return [1, 3, 6, 8, 10].includes(semitone);
  };

  return (
    <div className="flex-1 bg-[#0f1115] flex flex-col overflow-hidden select-none">
      {/* Top Toolbar */}
      <div className="bg-[#1a1d23] border-b border-[#2d333d] px-4 py-2 flex items-center justify-between gap-3 flex-wrap">
        {/* Track Selector & Pattern Selector */}
        <div className="flex items-center space-x-2">
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#64748b]">TRACK</span>
          <select
            value={activeTrack.id}
            onChange={e => setSelectedTrackId(e.target.value)}
            className="bg-[#16191e] text-xs font-semibold text-white px-2.5 py-1 rounded border border-[#2d333d] focus:outline-none"
          >
            {midiTracks.map(t => (
              <option key={t.id} value={t.id} className="bg-[#1a1d23]">
                {t.name} ({t.instrument.replace('_', ' ')})
              </option>
            ))}
          </select>

          {activeTrack.midiClips.length > 1 && (
            <select
              value={activeClipIndex}
              onChange={e => setActiveClipIndex(parseInt(e.target.value))}
              className="bg-[#16191e] text-xs text-[#94a3b8] px-2.5 py-1 rounded border border-[#2d333d]"
            >
              {activeTrack.midiClips.map((c, i) => (
                <option key={c.id} value={i} className="bg-[#1a1d23]">
                  {c.name}
                </option>
              ))}
            </select>
          )}

          {!activeClip && (
            <button
              onClick={handleCreateClip}
              className="px-3 py-1 rounded bg-[#3b82f6] hover:bg-[#60a5fa] text-white text-xs font-bold shadow-sm transition-colors"
            >
              + Create Pattern
            </button>
          )}
        </div>

        {/* Edit Tools */}
        <div className="flex items-center space-x-2">
          <div className="flex items-center bg-[#16191e] p-0.5 rounded border border-[#2d333d] space-x-0.5">
            <button
              onClick={() => setTool('draw')}
              className={`w-7 h-7 flex items-center justify-center rounded transition-colors ${
                tool === 'draw' ? 'bg-[#3b82f6] text-white' : 'text-[#94a3b8] hover:text-white'
              }`}
              title="Draw Note"
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setTool('erase')}
              className={`w-7 h-7 flex items-center justify-center rounded transition-colors ${
                tool === 'erase' ? 'bg-[#3b82f6] text-white' : 'text-[#94a3b8] hover:text-white'
              }`}
              title="Eraser"
            >
              <Eraser className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Snap */}
          <div className="flex items-center space-x-1.5 bg-[#16191e] px-2.5 py-1 rounded border border-[#2d333d]">
            <span className="text-[10px] font-bold text-[#64748b] uppercase tracking-wider">GRID</span>
            <select
              value={snap}
              onChange={e => setSnap(e.target.value as SnapGrid)}
              className="bg-transparent text-xs font-mono text-[#e2e8f0] focus:outline-none"
            >
              <option value="1/4" className="bg-[#1a1d23]">1/4</option>
              <option value="1/8" className="bg-[#1a1d23]">1/8</option>
              <option value="1/16" className="bg-[#1a1d23]">1/16</option>
              <option value="1/32" className="bg-[#1a1d23]">1/32</option>
            </select>
          </div>

          {/* Quantize */}
          <button
            onClick={handleQuantize}
            className="flex items-center space-x-1 px-3 py-1 rounded bg-[#2d333d] hover:bg-[#3d4450] text-[#10b981] border border-[#2d333d] text-xs font-semibold transition-colors"
            title="Quantize notes to current grid"
          >
            <Sparkles className="w-3.5 h-3.5 text-[#10b981]" />
            <span>Quantize</span>
          </button>

          {/* Octave Shift */}
          <div className="flex items-center space-x-1">
            <button
              onClick={() => handleTranspose(12)}
              className="px-2 py-1 rounded bg-[#2d333d] hover:bg-[#3d4450] text-[#94a3b8] hover:text-white text-xs font-mono font-bold transition-colors"
              title="Transpose +1 Octave"
            >
              +12
            </button>
            <button
              onClick={() => handleTranspose(-12)}
              className="px-2 py-1 rounded bg-[#2d333d] hover:bg-[#3d4450] text-[#94a3b8] hover:text-white text-xs font-mono font-bold transition-colors"
              title="Transpose -1 Octave"
            >
              -12
            </button>
          </div>

          {/* Octave Scroll Range */}
          <div className="flex items-center bg-[#16191e] p-0.5 rounded border border-[#2d333d]">
            <button
              onClick={() => setPitchRangeStart(Math.min(84, pitchRangeStart + 12))}
              className="w-7 h-7 flex items-center justify-center rounded text-[#94a3b8] hover:text-white hover:bg-[#2d333d] transition-colors"
              title="Scroll Up Octave"
            >
              <ChevronUp className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setPitchRangeStart(Math.max(12, pitchRangeStart - 12))}
              className="w-7 h-7 flex items-center justify-center rounded text-[#94a3b8] hover:text-white hover:bg-[#2d333d] transition-colors"
              title="Scroll Down Octave"
            >
              <ChevronDown className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Main Piano Roll: Left Virtual Keyboard + Right Grid */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Piano Keys */}
        <div className="w-20 min-w-20 border-r border-[#2d333d] bg-[#1a1d23] flex flex-col z-10 shadow-lg">
          {Array.from({ length: numPitches }).map((_, i) => {
            const pitch = pitchRangeStart + (numPitches - 1 - i);
            const isBlack = isBlackKey(pitch);
            const isC = pitch % 12 === 0;

            return (
              <button
                key={pitch}
                onClick={() => onAuditionNote(activeTrack.id, pitch)}
                className={`w-full flex items-center justify-between px-2 text-[9px] font-mono border-b border-[#2d333d]/40 transition-colors ${
                  isBlack
                    ? 'bg-[#16191e] text-[#64748b] hover:bg-[#232832]'
                    : 'bg-[#2d333d] text-[#e2e8f0] hover:bg-[#3d4450]'
                } ${isC ? 'border-b-2 border-[#3b82f6] font-bold text-[#38bdf8]' : ''}`}
                style={{ height: `${rowHeight}px` }}
                title={`Audition ${noteNumberToName(pitch)}`}
              >
                <span>{noteNumberToName(pitch)}</span>
                <span className="text-[8px] text-[#64748b]">{pitch}</span>
              </button>
            );
          })}
        </div>

        {/* Right Note Matrix Grid */}
        <div
          ref={gridContainerRef}
          onMouseDown={handleGridMouseDown}
          className="flex-1 overflow-x-auto overflow-y-auto relative bg-[#0a0c10] cursor-crosshair"
        >
          <div
            className="relative"
            style={{ width: `${gridWidth}px`, height: `${gridHeight}px` }}
          >
            {/* Horizontal rows */}
            {Array.from({ length: numPitches }).map((_, i) => {
              const pitch = pitchRangeStart + (numPitches - 1 - i);
              const isBlack = isBlackKey(pitch);
              const isC = pitch % 12 === 0;

              return (
                <div
                  key={pitch}
                  className={`absolute left-0 right-0 border-b border-[#2d333d]/30 pointer-events-none ${
                    isBlack ? 'bg-[#0f1115]' : 'bg-[#14171e]'
                  } ${isC ? 'border-b-[#3b82f6]/40 border-b-2' : ''}`}
                  style={{ top: `${i * rowHeight}px`, height: `${rowHeight}px` }}
                />
              );
            })}

            {/* Vertical grid lines (beats & fractions) */}
            {Array.from({ length: Math.ceil(clipDuration / secondsPerBeat) * 4 }).map((_, step) => {
              const isBeat = step % 4 === 0;
              const isBar = step % 16 === 0;
              const stepTime = step * (secondsPerBeat / 4);
              const left = stepTime * zoomX;

              return (
                <div
                  key={step}
                  className={`absolute top-0 bottom-0 pointer-events-none ${
                    isBar
                      ? 'border-l-2 border-[#2d333d]'
                      : isBeat
                      ? 'border-l border-[#2d333d]/50'
                      : 'border-l border-[#2d333d]/20'
                  }`}
                  style={{ left: `${left}px` }}
                />
              );
            })}

            {/* Render Notes */}
            {activeClip &&
              activeClip.notes.map(note => {
                const rowIdx = numPitches - 1 - (note.pitch - pitchRangeStart);
                if (rowIdx < 0 || rowIdx >= numPitches) return null; // out of visible octave range

                const top = rowIdx * rowHeight;
                const left = note.startTime * zoomX;
                const width = Math.max(8, note.duration * zoomX);

                return (
                  <div
                    key={note.id}
                    className="absolute rounded border border-white/60 shadow flex items-center px-1 overflow-hidden pointer-events-auto"
                    style={{
                      top: `${top + 1}px`,
                      height: `${rowHeight - 2}px`,
                      left: `${left}px`,
                      width: `${width}px`,
                      backgroundColor: activeTrack.color || '#3b82f6',
                    }}
                    title={`${noteNumberToName(note.pitch)} (${note.duration.toFixed(2)}s)`}
                  >
                    <span className="text-[9px] font-mono text-white font-bold truncate pointer-events-none">
                      {noteNumberToName(note.pitch)}
                    </span>
                  </div>
                );
              })}
          </div>
        </div>
      </div>
    </div>
  );
};
