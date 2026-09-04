import React, { useState } from 'react';
import {
  Mic,
  Music,
  Disc,
  Sliders,
  Volume2,
  VolumeX,
  Trash2,
  Copy,
  ChevronDown,
} from 'lucide-react';
import { Track, InstrumentType, ActiveView } from '../../types';

interface TrackHeaderProps {
  track: Track;
  isSelected: boolean;
  onSelect: () => void;
  onUpdateTrack: (updated: Partial<Track>) => void;
  onDeleteTrack: () => void;
  onOpenFx: () => void;
  onOpenPianoRoll: () => void;
}

export const TrackHeader: React.FC<TrackHeaderProps> = ({
  track,
  isSelected,
  onSelect,
  onUpdateTrack,
  onDeleteTrack,
  onOpenFx,
  onOpenPianoRoll,
}) => {
  const [isEditingName, setIsEditingName] = useState(false);
  const [nameVal, setNameVal] = useState(track.name);

  const handleNameBlur = () => {
    setIsEditingName(false);
    if (nameVal.trim()) {
      onUpdateTrack({ name: nameVal.trim() });
    }
  };

  const getTrackIcon = () => {
    switch (track.type) {
      case 'audio':
        return <Mic className="w-3.5 h-3.5 text-rose-400" />;
      case 'drum':
        return <Disc className="w-3.5 h-3.5 text-pink-400" />;
      case 'midi':
      default:
        return <Music className="w-3.5 h-3.5 text-indigo-400" />;
    }
  };

  const formatDb = (vol: number) => {
    if (vol <= 0.001) return '-∞ dB';
    const db = 20 * Math.log10(vol);
    return `${db > 0 ? '+' : ''}${db.toFixed(1)} dB`;
  };

  const formatPan = (pan: number) => {
    if (Math.abs(pan) < 0.05) return 'C';
    if (pan < 0) return `${Math.round(Math.abs(pan) * 100)}L`;
    return `${Math.round(pan * 100)}R`;
  };

  return (
    <div
      onClick={onSelect}
      className={`h-24 w-64 min-w-64 border-b border-r border-[#2d333d] p-3 flex flex-col justify-between transition-colors select-none ${
        isSelected
          ? 'bg-[#1e232b] border-l-4'
          : 'bg-[#1a1d23] hover:bg-[#1e232b] border-l-4'
      }`}
      style={{ borderLeftColor: isSelected ? '#3b82f6' : track.color || '#334155' }}
    >
      {/* Top row: Name, Type, M/S/R buttons */}
      <div className="flex justify-between items-start">
        <div className="flex items-center space-x-1.5 min-w-0 flex-1 mr-2">
          {isEditingName ? (
            <input
              type="text"
              autoFocus
              value={nameVal}
              onChange={e => setNameVal(e.target.value)}
              onBlur={handleNameBlur}
              onKeyDown={e => e.key === 'Enter' && handleNameBlur()}
              className="text-xs bg-[#0a0c10] border border-[#3b82f6] rounded px-1.5 py-0.5 text-white w-full focus:outline-none font-semibold"
            />
          ) : (
            <div className="truncate">
              <span
                onDoubleClick={() => setIsEditingName(true)}
                className={`text-xs font-semibold truncate cursor-pointer hover:underline block ${
                  isSelected ? 'text-white' : 'text-[#94a3b8]'
                }`}
                title="Double click to rename"
              >
                {track.name}
              </span>
              <span className="text-[9px] text-[#64748b] uppercase tracking-wider font-mono">
                {track.type === 'audio' ? 'Audio In' : track.instrument.replace('_', ' ')}
              </span>
            </div>
          )}
        </div>

        {/* Circular M / S / R buttons */}
        <div className="flex space-x-1 shrink-0">
          {/* Mute */}
          <button
            onClick={e => {
              e.stopPropagation();
              onUpdateTrack({ isMuted: !track.isMuted });
            }}
            className={`w-5 h-5 rounded-full text-[9px] flex items-center justify-center font-bold transition-colors ${
              track.isMuted
                ? 'bg-[#f59e0b] text-black shadow-sm'
                : 'bg-[#334155] text-slate-300 hover:text-white'
            }`}
            title="Mute Track"
          >
            M
          </button>

          {/* Solo */}
          <button
            onClick={e => {
              e.stopPropagation();
              onUpdateTrack({ isSolo: !track.isSolo });
            }}
            className={`w-5 h-5 rounded-full text-[9px] flex items-center justify-center font-bold transition-colors ${
              track.isSolo
                ? 'bg-[#f59e0b] text-black shadow-sm'
                : 'bg-[#334155] text-slate-300 hover:text-white'
            }`}
            title="Solo Track"
          >
            S
          </button>

          {/* Record Arm */}
          <button
            onClick={e => {
              e.stopPropagation();
              onUpdateTrack({ isArmed: !track.isArmed });
            }}
            className={`w-5 h-5 rounded-full text-[9px] flex items-center justify-center font-bold transition-colors ${
              track.isArmed
                ? 'bg-[#ef4444] text-white shadow-[0_0_8px_rgba(239,68,68,0.6)]'
                : 'bg-[#334155] text-slate-300 hover:text-[#ef4444]'
            }`}
            title="Record Arm"
          >
            R
          </button>
        </div>
      </div>

      {/* Mini LED Level Indicator Meter Bar */}
      <div className="h-1.5 bg-[#0f1115] rounded-full overflow-hidden w-full my-0.5">
        <div
          className="h-full bg-gradient-to-r from-green-500 via-yellow-500 to-red-500 opacity-80 transition-all duration-75"
          style={{ width: `${track.isMuted ? 0 : Math.min(100, Math.round(track.volume * 70))}%` }}
        />
      </div>

      {/* Bottom row: Quick FX, Volume & Pan */}
      <div className="flex items-center justify-between gap-2 text-[9px] font-mono text-[#64748b]">
        {/* FX / Notes Quick Launcher */}
        <div className="flex items-center space-x-1">
          <button
            onClick={e => {
              e.stopPropagation();
              onOpenFx();
            }}
            className="px-1 py-0.5 rounded bg-[#242934] hover:bg-[#2d3442] text-[#38bdf8] font-semibold border border-[#333d4f]"
            title="Open Track FX Rack"
          >
            FX
          </button>

          {track.type !== 'audio' && (
            <button
              onClick={e => {
                e.stopPropagation();
                onOpenPianoRoll();
              }}
              className="px-1 py-0.5 rounded bg-[#242934] hover:bg-[#2d3442] text-[#a78bfa] font-semibold border border-[#333d4f]"
              title="Open Piano Roll MIDI Editor"
            >
              MIDI
            </button>
          )}

          <button
            onClick={e => {
              e.stopPropagation();
              onDeleteTrack();
            }}
            className="text-[#64748b] hover:text-[#ef4444] p-0.5 transition-colors"
            title="Delete Track"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>

        {/* Volume & Pan values */}
        <div className="flex items-center space-x-2">
          <span className="text-[#94a3b8]">{formatDb(track.volume)}</span>
          <span className="text-[#38bdf8]">{formatPan(track.pan)}</span>
        </div>
      </div>
    </div>
  );
};
