import React, { useRef } from 'react';

interface TimelineRulerProps {
  duration: number; // total visible duration in seconds
  bpm: number;
  timeSignature: [number, number];
  zoom: number; // pixels per second
  playheadPosition: number;
  onSeek: (seconds: number) => void;
  loopEnabled: boolean;
  loopStart: number;
  loopEnd: number;
  onUpdateLoopRange: (start: number, end: number) => void;
}

export const TimelineRuler: React.FC<TimelineRulerProps> = ({
  duration,
  bpm,
  timeSignature,
  zoom,
  playheadPosition,
  onSeek,
  loopEnabled,
  loopStart,
  loopEnd,
  onUpdateLoopRange,
}) => {
  const rulerRef = useRef<HTMLDivElement>(null);

  const secondsPerBeat = 60 / bpm;
  const beatsPerBar = timeSignature[0] || 4;
  const secondsPerBar = secondsPerBeat * beatsPerBar;
  const totalBars = Math.ceil(duration / secondsPerBar) + 4;

  const totalWidth = Math.max(duration * zoom, totalBars * secondsPerBar * zoom);

  const handleRulerMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!rulerRef.current) return;
    const rect = rulerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const seekTime = Math.max(0, x / zoom);
    onSeek(seekTime);

    const onMouseMove = (moveEv: MouseEvent) => {
      const moveX = moveEv.clientX - rect.left;
      onSeek(Math.max(0, moveX / zoom));
    };

    const onMouseUp = () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  const handleLoopStartDrag = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!rulerRef.current) return;
    const rect = rulerRef.current.getBoundingClientRect();

    const onMouseMove = (moveEv: MouseEvent) => {
      const moveX = moveEv.clientX - rect.left;
      const newStart = Math.max(0, Math.min(loopEnd - 0.5, moveX / zoom));
      onUpdateLoopRange(newStart, loopEnd);
    };

    const onMouseUp = () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  const handleLoopEndDrag = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!rulerRef.current) return;
    const rect = rulerRef.current.getBoundingClientRect();

    const onMouseMove = (moveEv: MouseEvent) => {
      const moveX = moveEv.clientX - rect.left;
      const newEnd = Math.max(loopStart + 0.5, moveX / zoom);
      onUpdateLoopRange(loopStart, newEnd);
    };

    const onMouseUp = () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  const bars = [];
  for (let bar = 0; bar < totalBars; bar++) {
    const barStartTime = bar * secondsPerBar;
    const barLeft = barStartTime * zoom;

    bars.push(
      <div
        key={`bar-${bar}`}
        className="absolute top-0 bottom-0 border-l border-[#2d333d] flex flex-col justify-between select-none pointer-events-none"
        style={{ left: `${barLeft}px`, width: `${secondsPerBar * zoom}px` }}
      >
        <div className="flex w-full justify-around pt-1 text-[9px] font-mono text-[#475569] uppercase tracking-widest">
          {Array.from({ length: beatsPerBar }).map((_, beatIdx) => (
            <span key={beatIdx} className={beatIdx === 0 ? 'text-[#94a3b8] font-bold' : ''}>
              {bar + 1}.{beatIdx + 1}
            </span>
          ))}
        </div>

        {/* Subdivision ticks */}
        <div className="flex w-full h-1.5 items-end">
          {Array.from({ length: beatsPerBar }).map((_, beatIdx) => (
            <div
              key={beatIdx}
              className="flex-1 border-r border-[#2d333d]/60 h-1"
            />
          ))}
        </div>
      </div>
    );
  }

  const loopLeft = loopStart * zoom;
  const loopWidth = (loopEnd - loopStart) * zoom;
  const playheadLeft = playheadPosition * zoom;

  return (
    <div
      ref={rulerRef}
      onMouseDown={handleRulerMouseDown}
      className="relative h-8 bg-[#16191e] border-b border-[#2d333d] cursor-pointer overflow-hidden select-none"
      style={{ width: `${totalWidth}px` }}
    >
      {/* Bars and ticks */}
      {bars}

      {/* Loop Region Highlight */}
      {loopEnabled && (
        <div
          className="absolute top-0 bottom-0 bg-[#3b82f61a] border-t-2 border-[#3b82f6] pointer-events-none"
          style={{ left: `${loopLeft}px`, width: `${loopWidth}px` }}
        >
          {/* Loop Start Handle */}
          <div
            onMouseDown={handleLoopStartDrag}
            className="absolute top-0 left-0 w-3 h-full bg-[#3b82f6] hover:bg-[#60a5fa] cursor-ew-resize pointer-events-auto flex items-center justify-center text-[8px] font-bold text-white rounded-r-xs"
            title="Drag to change loop start"
          >
            L
          </div>
          {/* Loop End Handle */}
          <div
            onMouseDown={handleLoopEndDrag}
            className="absolute top-0 right-0 w-3 h-full bg-[#3b82f6] hover:bg-[#60a5fa] cursor-ew-resize pointer-events-auto flex items-center justify-center text-[8px] font-bold text-white rounded-l-xs"
            title="Drag to change loop end"
          >
            R
          </div>
        </div>
      )}

      {/* Playhead Marker in Ruler (Theme: #ef4444 with circular white border) */}
      <div
        className="absolute top-0 bottom-0 pointer-events-none z-30 flex flex-col items-center"
        style={{ left: `${playheadLeft}px`, transform: 'translateX(-50%)' }}
      >
        <div className="w-3 h-3 bg-[#ef4444] rounded-full border-2 border-white shadow-[0_0_8px_rgba(239,68,68,0.6)]" />
        <div className="w-px flex-1 bg-[#ef4444] shadow-[0_0_8px_rgba(239,68,68,0.6)]" />
      </div>
    </div>
  );
};
