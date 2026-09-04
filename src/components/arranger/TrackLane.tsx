import React, { useRef } from 'react';
import { AudioClip, MidiClip, SnapGrid, ToolMode, Track } from '../../types';

interface TrackLaneProps {
  track: Track;
  zoom: number; // pixels per second
  bpm: number;
  timeSignature: [number, number];
  snapGrid: SnapGrid;
  toolMode: ToolMode;
  playheadPosition: number;
  totalDuration: number;
  selectedClipId: string | null;
  onSelectClip: (clipId: string | null) => void;
  onUpdateAudioClip: (clipId: string, updated: Partial<AudioClip>) => void;
  onUpdateMidiClip: (clipId: string, updated: Partial<MidiClip>) => void;
  onDeleteClip: (clipId: string) => void;
  onSplitClip: (clipId: string, splitTime: number) => void;
  onDuplicateClip: (clipId: string) => void;
  onDropAudioFile: (file: File, startTime: number) => void;
  onSeek: (seconds: number) => void;
}

export const TrackLane: React.FC<TrackLaneProps> = ({
  track,
  zoom,
  bpm,
  timeSignature,
  snapGrid,
  toolMode,
  playheadPosition,
  totalDuration,
  selectedClipId,
  onSelectClip,
  onUpdateAudioClip,
  onUpdateMidiClip,
  onDeleteClip,
  onSplitClip,
  onDuplicateClip,
  onDropAudioFile,
  onSeek,
}) => {
  const laneRef = useRef<HTMLDivElement>(null);

  const secondsPerBeat = 60 / bpm;
  const beatsPerBar = timeSignature[0] || 4;
  const secondsPerBar = secondsPerBeat * beatsPerBar;
  const totalBars = Math.ceil(totalDuration / secondsPerBar) + 4;
  const laneWidth = Math.max(totalDuration * zoom, totalBars * secondsPerBar * zoom);

  // Compute snap interval
  const getSnapInterval = (): number => {
    switch (snapGrid) {
      case '1bar':
        return secondsPerBar;
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

  const snapTime = (time: number): number => {
    const interval = getSnapInterval();
    if (interval <= 0.001) return Math.max(0, time);
    return Math.max(0, Math.round(time / interval) * interval);
  };

  // Drag & drop audio file onto lane
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0] && laneRef.current) {
      const rect = laneRef.current.getBoundingClientRect();
      const dropX = e.clientX - rect.left;
      const startTime = snapTime(dropX / zoom);
      onDropAudioFile(e.dataTransfer.files[0], startTime);
    }
  };

  // Click on empty lane
  const handleLaneClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target !== laneRef.current) return;
    const rect = laneRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const seekTime = clickX / zoom;
    onSeek(seekTime);
    onSelectClip(null);
  };

  // Clip Dragging (Move)
  const handleClipMouseDown = (
    e: React.MouseEvent,
    clipId: string,
    currentStartTime: number,
    clipDuration: number,
    isAudio: boolean
  ) => {
    e.stopPropagation();

    // Tool Mode handlers
    if (toolMode === 'erase') {
      onDeleteClip(clipId);
      return;
    }

    if (toolMode === 'cut') {
      if (!laneRef.current) return;
      const rect = laneRef.current.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const cutTime = snapTime(clickX / zoom);
      if (cutTime > currentStartTime && cutTime < currentStartTime + clipDuration) {
        onSplitClip(clipId, cutTime);
      }
      return;
    }

    onSelectClip(clipId);

    const startX = e.clientX;
    const initialTime = currentStartTime;

    const onMouseMove = (moveEv: MouseEvent) => {
      const deltaX = moveEv.clientX - startX;
      const deltaTime = deltaX / zoom;
      const newTime = snapTime(initialTime + deltaTime);

      if (isAudio) {
        onUpdateAudioClip(clipId, { startTime: newTime });
      } else {
        onUpdateMidiClip(clipId, { startTime: newTime });
      }
    };

    const onMouseUp = () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  // Clip Left Trim
  const handleLeftTrim = (
    e: React.MouseEvent,
    clipId: string,
    startTime: number,
    duration: number,
    isAudio: boolean
  ) => {
    e.stopPropagation();
    const startX = e.clientX;

    const onMouseMove = (moveEv: MouseEvent) => {
      const deltaX = moveEv.clientX - startX;
      const deltaTime = deltaX / zoom;
      const newStart = snapTime(startTime + deltaTime);
      const newDuration = duration - (newStart - startTime);

      if (newDuration > 0.2 && newStart >= 0) {
        if (isAudio) {
          onUpdateAudioClip(clipId, { startTime: newStart, duration: newDuration });
        } else {
          onUpdateMidiClip(clipId, { startTime: newStart, duration: newDuration });
        }
      }
    };

    const onMouseUp = () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  // Clip Right Trim
  const handleRightTrim = (
    e: React.MouseEvent,
    clipId: string,
    duration: number,
    isAudio: boolean
  ) => {
    e.stopPropagation();
    const startX = e.clientX;

    const onMouseMove = (moveEv: MouseEvent) => {
      const deltaX = moveEv.clientX - startX;
      const deltaTime = deltaX / zoom;
      const newDuration = Math.max(0.2, snapTime(duration + deltaTime));

      if (isAudio) {
        onUpdateAudioClip(clipId, { duration: newDuration });
      } else {
        onUpdateMidiClip(clipId, { duration: newDuration });
      }
    };

    const onMouseUp = () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  // Draw Waveform Canvas Preview
  const renderWaveform = (peaks: number[] = []) => {
    if (!peaks || peaks.length === 0) {
      // Mock subtle aesthetic waveform if raw audio not yet analyzed
      return (
        <div className="w-full h-full flex items-center justify-around opacity-40 px-1">
          {Array.from({ length: 40 }).map((_, i) => (
            <div
              key={i}
              className="w-0.5 bg-white rounded-full"
              style={{ height: `${20 + Math.sin(i * 0.4) * 15 + Math.random() * 30}%` }}
            />
          ))}
        </div>
      );
    }

    return (
      <div className="w-full h-full flex items-center justify-between px-1 pointer-events-none">
        {peaks.map((p, i) => (
          <div
            key={i}
            className="w-0.5 bg-white/80 rounded-full"
            style={{ height: `${Math.max(4, p * 85)}%` }}
          />
        ))}
      </div>
    );
  };

  // Draw MIDI Notes Mini-preview
  const renderMidiNotes = (clip: MidiClip) => {
    if (!clip.notes || clip.notes.length === 0) return null;
    const minPitch = Math.min(...clip.notes.map(n => n.pitch));
    const maxPitch = Math.max(...clip.notes.map(n => n.pitch));
    const pitchRange = Math.max(12, maxPitch - minPitch);

    return (
      <div className="relative w-full h-full overflow-hidden pointer-events-none p-1">
        {clip.notes.map(note => {
          const leftPercent = (note.startTime / clip.duration) * 100;
          const widthPercent = Math.max(1.5, (note.duration / clip.duration) * 100);
          const topPercent = 85 - ((note.pitch - minPitch) / pitchRange) * 75;

          return (
            <div
              key={note.id}
              className="absolute h-1.5 rounded-sm bg-white/90 shadow-sm"
              style={{
                left: `${leftPercent}%`,
                width: `${widthPercent}%`,
                top: `${topPercent}%`,
              }}
            />
          );
        })}
      </div>
    );
  };

  return (
    <div
      ref={laneRef}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      onClick={handleLaneClick}
      className="relative h-24 border-b border-[#2d333d] bg-[#0f1115] hover:bg-[#13171f] transition-colors select-none overflow-hidden"
      style={{ width: `${laneWidth}px` }}
    >
      {/* Grid Subdivisions */}
      {Array.from({ length: totalBars }).map((_, b) => (
        <div
          key={b}
          className="absolute top-0 bottom-0 border-l border-[#2d333d]/50 pointer-events-none flex"
          style={{ left: `${b * secondsPerBar * zoom}px`, width: `${secondsPerBar * zoom}px` }}
        >
          {Array.from({ length: beatsPerBar }).map((__, beat) => (
            <div
              key={beat}
              className="flex-1 border-r border-[#2d333d]/20 h-full"
            />
          ))}
        </div>
      ))}

      {/* Render Audio Clips */}
      {track.audioClips.map(clip => {
        const left = clip.startTime * zoom;
        const width = Math.max(16, clip.duration * zoom);
        const isSelected = selectedClipId === clip.id;

        return (
          <div
            key={clip.id}
            onMouseDown={e => handleClipMouseDown(e, clip.id, clip.startTime, clip.duration, true)}
            className={`absolute top-1.5 bottom-1.5 rounded border flex flex-col justify-between overflow-hidden shadow cursor-grab active:cursor-grabbing transition-all ${
              isSelected
                ? 'ring-2 ring-white border-white bg-[#3b82f655]'
                : 'border-[#3b82f6] bg-[#3b82f626] hover:bg-[#3b82f63d]'
            }`}
            style={{
              left: `${left}px`,
              width: `${width}px`,
            }}
          >
            {/* Clip Header Label */}
            <div className="bg-[#3b82f6] px-2 py-0.5 flex items-center justify-between text-[10px] text-white font-medium truncate pointer-events-none">
              <span className="truncate">{clip.name}</span>
              <span className="text-[9px] font-mono opacity-80">{clip.duration.toFixed(1)}s</span>
            </div>

            {/* Waveform Visualization */}
            <div className="flex-1 overflow-hidden px-1">
              {renderWaveform(clip.waveformData)}
            </div>

            {/* Left Trim Handle */}
            <div
              onMouseDown={e => handleLeftTrim(e, clip.id, clip.startTime, clip.duration, true)}
              className="absolute left-0 top-0 bottom-0 w-2 hover:bg-white/40 cursor-ew-resize"
              title="Trim Start"
            />

            {/* Right Trim Handle */}
            <div
              onMouseDown={e => handleRightTrim(e, clip.id, clip.duration, true)}
              className="absolute right-0 top-0 bottom-0 w-2 hover:bg-white/40 cursor-ew-resize"
              title="Trim End"
            />
          </div>
        );
      })}

      {/* Render MIDI Clips */}
      {track.midiClips.map(clip => {
        const left = clip.startTime * zoom;
        const width = Math.max(16, clip.duration * zoom);
        const isSelected = selectedClipId === clip.id;

        return (
          <div
            key={clip.id}
            onMouseDown={e => handleClipMouseDown(e, clip.id, clip.startTime, clip.duration, false)}
            className={`absolute top-1.5 bottom-1.5 rounded border flex flex-col justify-between overflow-hidden shadow cursor-grab active:cursor-grabbing transition-all ${
              isSelected
                ? 'ring-2 ring-white border-white bg-[#10b98155]'
                : 'border-[#10b981] bg-[#10b98126] hover:bg-[#10b9813d]'
            }`}
            style={{
              left: `${left}px`,
              width: `${width}px`,
            }}
          >
            {/* Clip Header Label */}
            <div className="bg-[#10b981] px-2 py-0.5 flex items-center justify-between text-[10px] text-black font-semibold truncate pointer-events-none">
              <span className="truncate">{clip.name}</span>
              <span className="text-[9px] font-mono opacity-80">{clip.notes.length} notes</span>
            </div>

            {/* Mini Note Blocks */}
            <div className="flex-1 overflow-hidden px-1">
              {renderMidiNotes(clip)}
            </div>

            {/* Left Trim Handle */}
            <div
              onMouseDown={e => handleLeftTrim(e, clip.id, clip.startTime, clip.duration, false)}
              className="absolute left-0 top-0 bottom-0 w-2 hover:bg-white/40 cursor-ew-resize"
              title="Trim Start"
            />

            {/* Right Trim Handle */}
            <div
              onMouseDown={e => handleRightTrim(e, clip.id, clip.duration, false)}
              className="absolute right-0 top-0 bottom-0 w-2 hover:bg-white/40 cursor-ew-resize"
              title="Trim End"
            />
          </div>
        );
      })}
    </div>
  );
};
