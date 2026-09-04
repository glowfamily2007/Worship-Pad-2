import React from 'react';
import {
  Play,
  Pause,
  Square,
  SkipBack,
  ChevronLeft,
  ChevronRight,
  Repeat,
  Scissors,
  MousePointer,
  Pencil,
  Eraser,
  ZoomIn,
  ZoomOut,
  Mic,
  Circle,
} from 'lucide-react';
import { SnapGrid, ToolMode } from '../types';

interface TransportBarProps {
  isPlaying: boolean;
  isRecording: boolean;
  onPlay: () => void;
  onPause: () => void;
  onStop: () => void;
  onRewind: () => void;
  onStepBack: () => void;
  onStepForward: () => void;
  onToggleRecord: () => void;
  loopEnabled: boolean;
  onToggleLoop: () => void;
  playheadPosition: number; // seconds
  bpm: number;
  timeSignature: [number, number];
  toolMode: ToolMode;
  setToolMode: (mode: ToolMode) => void;
  snapGrid: SnapGrid;
  setSnapGrid: (grid: SnapGrid) => void;
  zoom: number;
  setZoom: (zoom: number) => void;
}

export const TransportBar: React.FC<TransportBarProps> = ({
  isPlaying,
  isRecording,
  onPlay,
  onPause,
  onStop,
  onRewind,
  onStepBack,
  onStepForward,
  onToggleRecord,
  loopEnabled,
  onToggleLoop,
  playheadPosition,
  bpm,
  timeSignature,
  toolMode,
  setToolMode,
  snapGrid,
  setSnapGrid,
  zoom,
  setZoom,
}) => {
  // Compute Bars, Beats, 16ths
  const secondsPerBeat = 60 / bpm;
  const totalBeats = playheadPosition / secondsPerBeat;
  const beatsPerBar = timeSignature[0] || 4;
  const bar = Math.floor(totalBeats / beatsPerBar) + 1;
  const beat = Math.floor(totalBeats % beatsPerBar) + 1;
  const fraction = Math.floor((totalBeats % 1) * 4) + 1;

  // Format Time (mm:ss.ms)
  const mins = Math.floor(playheadPosition / 60);
  const secs = Math.floor(playheadPosition % 60);
  const millis = Math.floor((playheadPosition % 1) * 1000);
  const timeFormatted = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${millis
    .toString()
    .padStart(3, '0')}`;

  return (
    <div className="bg-[#1a1d23] border-b border-[#2d333d] px-4 py-2 flex items-center justify-between gap-4 flex-wrap select-none text-[#e2e8f0]">
      {/* Transport Controls */}
      <div className="flex items-center space-x-1.5">
        {/* Rewind to 0 */}
        <button
          onClick={onRewind}
          className="w-10 h-8 bg-[#2d333d] flex items-center justify-center rounded hover:bg-[#3d4450] text-[#94a3b8] hover:text-white transition-colors"
          title="Rewind to Start (Home / W)"
        >
          <SkipBack className="w-4 h-4" />
        </button>

        {/* Step Back 1 Bar */}
        <button
          onClick={onStepBack}
          className="w-10 h-8 bg-[#2d333d] flex items-center justify-center rounded hover:bg-[#3d4450] text-[#94a3b8] hover:text-white transition-colors"
          title="Step back 1 bar"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        {/* Stop */}
        <button
          onClick={onStop}
          className="w-10 h-8 bg-[#2d333d] flex items-center justify-center rounded hover:bg-[#3d4450] text-[#94a3b8] hover:text-[#ef4444] transition-colors"
          title="Stop Playback"
        >
          <Square className="w-4 h-4 fill-current" />
        </button>

        {/* Play / Pause Primary Button */}
        <button
          onClick={isPlaying ? onPause : onPlay}
          className={`w-12 h-8 flex items-center justify-center rounded font-bold transition-all ${
            isPlaying
              ? 'bg-[#10b981] hover:bg-[#34d399] text-black shadow-[0_0_10px_rgba(16,185,129,0.4)]'
              : 'bg-[#2d333d] hover:bg-[#3d4450] text-[#10b981]'
          }`}
          title="Play / Pause (Spacebar)"
        >
          {isPlaying ? (
            <Pause className="w-4 h-4 fill-current" />
          ) : (
            <Play className="w-4 h-4 fill-current ml-0.5" />
          )}
        </button>

        {/* Step Forward 1 Bar */}
        <button
          onClick={onStepForward}
          className="w-10 h-8 bg-[#2d333d] flex items-center justify-center rounded hover:bg-[#3d4450] text-[#94a3b8] hover:text-white transition-colors"
          title="Step forward 1 bar"
        >
          <ChevronRight className="w-4 h-4" />
        </button>

        {/* Record Arm / Active Button */}
        <button
          onClick={onToggleRecord}
          className={`h-8 px-3 rounded flex items-center justify-center space-x-1.5 transition-all font-semibold text-xs ${
            isRecording
              ? 'bg-[#ef4444] hover:bg-[#f87171] text-white shadow-[0_0_10px_rgba(239,68,68,0.4)] animate-pulse'
              : 'bg-[#2d333d] hover:bg-[#3d4450] text-[#ef4444]'
          }`}
          title="Record Audio / MIDI (R)"
        >
          <Circle className="w-3 h-3 fill-current" />
          <span className="font-bold">{isRecording ? 'REC' : 'ARM'}</span>
        </button>

        {/* Loop Region Toggle */}
        <button
          onClick={onToggleLoop}
          className={`w-10 h-8 flex items-center justify-center rounded transition-colors ${
            loopEnabled
              ? 'bg-[#3b82f622] text-[#3b82f6] border border-[#3b82f666]'
              : 'bg-[#2d333d] hover:bg-[#3d4450] text-[#94a3b8]'
          }`}
          title="Toggle Timeline Loop Range"
        >
          <Repeat className="w-4 h-4" />
        </button>
      </div>

      {/* Center Studio Timecode Display */}
      <div className="flex items-center space-x-4">
        <div className="flex items-center bg-[#0a0c10] border border-[#2d333d] rounded px-3 py-1 font-mono text-[#10b981] space-x-3">
          {/* Bars.Beats */}
          <div className="flex items-baseline space-x-1">
            <span className="text-sm font-bold text-[#64748b]">BAR</span>
            <span className="text-xl font-bold tracking-wider">
              {bar.toString().padStart(2, '0')}.{beat.toString().padStart(2, '0')}.{fraction.toString().padStart(2, '0')}
            </span>
          </div>

          <div className="h-4 w-px bg-[#2d333d]" />

          {/* Time mm:ss.ms */}
          <div className="flex items-baseline space-x-1">
            <span className="text-sm font-bold text-[#64748b]">TIME</span>
            <span className="text-xl font-bold tracking-wider text-[#38bdf8]">
              {timeFormatted}
            </span>
          </div>
        </div>
      </div>

      {/* Right Controls: Edit Tools, Snap Grid, Timeline Zoom */}
      <div className="flex items-center space-x-3">
        {/* Tool Mode Palette */}
        <div className="flex items-center bg-[#16191e] p-0.5 rounded border border-[#2d333d] space-x-0.5">
          <button
            onClick={() => setToolMode('pointer')}
            className={`w-7 h-7 flex items-center justify-center rounded text-xs transition-colors ${
              toolMode === 'pointer'
                ? 'bg-[#3b82f6] text-white shadow-sm'
                : 'text-[#94a3b8] hover:text-white hover:bg-[#2d333d]'
            }`}
            title="Pointer Tool (V)"
          >
            <MousePointer className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setToolMode('cut')}
            className={`w-7 h-7 flex items-center justify-center rounded text-xs transition-colors ${
              toolMode === 'cut'
                ? 'bg-[#3b82f6] text-white shadow-sm'
                : 'text-[#94a3b8] hover:text-white hover:bg-[#2d333d]'
            }`}
            title="Split Tool (C)"
          >
            <Scissors className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setToolMode('draw')}
            className={`w-7 h-7 flex items-center justify-center rounded text-xs transition-colors ${
              toolMode === 'draw'
                ? 'bg-[#3b82f6] text-white shadow-sm'
                : 'text-[#94a3b8] hover:text-white hover:bg-[#2d333d]'
            }`}
            title="Draw Tool (B)"
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setToolMode('erase')}
            className={`w-7 h-7 flex items-center justify-center rounded text-xs transition-colors ${
              toolMode === 'erase'
                ? 'bg-[#3b82f6] text-white shadow-sm'
                : 'text-[#94a3b8] hover:text-white hover:bg-[#2d333d]'
            }`}
            title="Eraser Tool (E)"
          >
            <Eraser className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Snap Grid Resolution */}
        <div className="flex items-center space-x-1.5 bg-[#16191e] px-2.5 py-1 rounded border border-[#2d333d]">
          <span className="text-[10px] font-bold text-[#64748b] uppercase tracking-wider">SNAP</span>
          <select
            value={snapGrid}
            onChange={e => setSnapGrid(e.target.value as SnapGrid)}
            className="bg-transparent text-xs font-mono font-medium text-[#e2e8f0] focus:outline-none cursor-pointer"
          >
            <option value="1bar" className="bg-[#1a1d23] text-white">1 Bar</option>
            <option value="1/4" className="bg-[#1a1d23] text-white">1/4 Beat</option>
            <option value="1/8" className="bg-[#1a1d23] text-white">1/8 Note</option>
            <option value="1/16" className="bg-[#1a1d23] text-white">1/16 Note</option>
            <option value="1/32" className="bg-[#1a1d23] text-white">1/32 Note</option>
            <option value="off" className="bg-[#1a1d23] text-white">Off</option>
          </select>
        </div>

        {/* Zoom Controls */}
        <div className="flex items-center space-x-1 bg-[#16191e] p-0.5 rounded border border-[#2d333d]">
          <button
            onClick={() => setZoom(Math.max(40, zoom - 20))}
            className="w-7 h-7 flex items-center justify-center rounded text-[#94a3b8] hover:text-white hover:bg-[#2d333d] transition-colors"
            title="Zoom Out Timeline"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <span className="text-[10px] font-mono text-[#64748b] px-1">{zoom}px/s</span>
          <button
            onClick={() => setZoom(Math.min(240, zoom + 20))}
            className="w-7 h-7 flex items-center justify-center rounded text-[#94a3b8] hover:text-white hover:bg-[#2d333d] transition-colors"
            title="Zoom In Timeline"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
