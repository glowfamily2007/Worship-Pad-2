import React from 'react';
import { Sliders, Volume2, Disc, Mic, Music, Download, ShieldCheck } from 'lucide-react';
import { Project, Track, VUMeterData } from '../../types';

interface MixerConsoleProps {
  project: Project;
  setProject: React.Dispatch<React.SetStateAction<Project>>;
  vuMeters: VUMeterData[];
  masterL: number;
  masterR: number;
  onOpenFx: (trackId: string) => void;
  onExportMixdown: () => void;
}

export const MixerConsole: React.FC<MixerConsoleProps> = ({
  project,
  setProject,
  vuMeters,
  masterL,
  masterR,
  onOpenFx,
  onExportMixdown,
}) => {
  const handleUpdateTrack = (trackId: string, updated: Partial<Track>) => {
    setProject(prev => ({
      ...prev,
      tracks: prev.tracks.map(t => (t.id === trackId ? { ...t, ...updated } : t)),
    }));
  };

  const formatDb = (vol: number) => {
    if (vol <= 0.001) return '-∞';
    const db = 20 * Math.log10(vol);
    return `${db > 0 ? '+' : ''}${db.toFixed(1)}`;
  };

  const getTrackMeter = (trackId: string) => {
    const meter = vuMeters.find(m => m.trackId === trackId);
    return meter ? meter.peak : 0;
  };

  // Convert normalized 0..1 peak to VU meter height percentage
  const peakToPercent = (peak: number) => {
    return Math.min(100, Math.max(0, Math.pow(peak, 0.6) * 100));
  };

  return (
    <div className="flex-1 bg-[#0f1115] overflow-x-auto overflow-y-hidden p-4 flex gap-3 select-none">
      {/* Track Channel Strips */}
      <div className="flex gap-2.5 flex-1 items-stretch min-w-max">
        {project.tracks.map((track, idx) => {
          const peak = getTrackMeter(track.id);
          const meterHeight = peakToPercent(peak);

          return (
            <div
              key={track.id}
              className="w-36 min-w-36 bg-[#1a1d23] border border-[#2d333d] rounded flex flex-col justify-between p-3 shadow-md relative overflow-hidden"
            >
              {/* Top Color Accent Bar */}
              <div
                className="absolute top-0 left-0 right-0 h-1"
                style={{ backgroundColor: track.color }}
              />

              {/* Channel Header: Number, Name, FX */}
              <div className="pt-1 flex flex-col gap-1 text-center">
                <div className="flex items-center justify-between text-[10px] font-mono text-[#64748b] font-bold">
                  <span>CH {idx + 1}</span>
                  <button
                    onClick={() => onOpenFx(track.id)}
                    className="px-1.5 py-0.5 rounded bg-[#242934] hover:bg-[#2d3442] text-[#38bdf8] text-[9px] font-semibold border border-[#333d4f]"
                    title="Open Track FX"
                  >
                    FX
                  </button>
                </div>
                <span className="text-xs font-bold text-white truncate px-0.5" title={track.name}>
                  {track.name}
                </span>
                <span className="text-[10px] text-[#94a3b8] capitalize truncate">
                  {track.type === 'audio' ? 'Audio In' : track.instrument.replace('_', ' ')}
                </span>
              </div>

              {/* Pan Control */}
              <div className="flex flex-col items-center gap-1 my-2 bg-[#16191e] p-1.5 rounded border border-[#2d333d]">
                <div className="flex items-center justify-between w-full text-[9px] font-mono text-[#64748b] px-1">
                  <span>PAN</span>
                  <span className="text-[#38bdf8] font-bold">
                    {Math.abs(track.pan) < 0.05
                      ? 'C'
                      : track.pan < 0
                      ? `${Math.round(Math.abs(track.pan) * 100)}L`
                      : `${Math.round(track.pan * 100)}R`}
                  </span>
                </div>
                <input
                  type="range"
                  min={-1}
                  max={1}
                  step={0.05}
                  value={track.pan}
                  onChange={e => handleUpdateTrack(track.id, { pan: parseFloat(e.target.value) })}
                  className="w-full h-1 bg-[#2d333d] rounded appearance-none cursor-pointer accent-[#38bdf8]"
                />
              </div>

              {/* Mute, Solo, Record Arm */}
              <div className="grid grid-cols-3 gap-1 mb-2">
                <button
                  onClick={() => handleUpdateTrack(track.id, { isMuted: !track.isMuted })}
                  className={`py-1 rounded text-[10px] font-bold transition-colors ${
                    track.isMuted
                      ? 'bg-[#f59e0b] text-black shadow-sm'
                      : 'bg-[#2d333d] text-[#94a3b8] hover:text-white'
                  }`}
                  title="Mute"
                >
                  M
                </button>
                <button
                  onClick={() => handleUpdateTrack(track.id, { isSolo: !track.isSolo })}
                  className={`py-1 rounded text-[10px] font-bold transition-colors ${
                    track.isSolo
                      ? 'bg-[#f59e0b] text-black shadow-sm'
                      : 'bg-[#2d333d] text-[#94a3b8] hover:text-white'
                  }`}
                  title="Solo"
                >
                  S
                </button>
                <button
                  onClick={() => handleUpdateTrack(track.id, { isArmed: !track.isArmed })}
                  className={`py-1 rounded text-[10px] font-bold transition-colors ${
                    track.isArmed
                      ? 'bg-[#ef4444] text-white shadow-[0_0_8px_rgba(239,68,68,0.6)]'
                      : 'bg-[#2d333d] text-[#94a3b8] hover:text-[#ef4444]'
                  }`}
                  title="Record Arm"
                >
                  R
                </button>
              </div>

              {/* Main Fader & Peak VU Meter Section */}
              <div className="flex-1 flex justify-center items-center gap-3 py-2">
                {/* Vertical VU Meter */}
                <div className="w-3 h-48 bg-[#0a0c10] rounded border border-[#2d333d] overflow-hidden flex flex-col justify-end p-0.5">
                  <div
                    className="w-full rounded transition-all duration-75 bg-gradient-to-t from-emerald-500 via-amber-400 to-rose-500"
                    style={{ height: `${meterHeight}%` }}
                  />
                </div>

                {/* Vertical Volume Fader */}
                <div className="flex flex-col items-center h-48 justify-between relative">
                  <input
                    type="range"
                    min={0}
                    max={1.5}
                    step={0.01}
                    value={track.volume}
                    onChange={e => handleUpdateTrack(track.id, { volume: parseFloat(e.target.value) })}
                    className="h-48 w-6 appearance-none bg-[#16191e] rounded cursor-pointer accent-[#3b82f6] [writing-mode:vertical-lr] [direction:rtl]"
                  />
                </div>

                {/* dB Scale Markings */}
                <div className="flex flex-col justify-between h-48 text-[9px] font-mono text-[#64748b] select-none py-1">
                  <span>+6</span>
                  <span>0</span>
                  <span>-6</span>
                  <span>-12</span>
                  <span>-24</span>
                  <span>-∞</span>
                </div>
              </div>

              {/* Bottom Numeric Level readout */}
              <div className="mt-2 text-center bg-[#0a0c10] py-1 rounded border border-[#2d333d]">
                <span className="font-mono text-xs font-bold text-[#10b981]">
                  {formatDb(track.volume)} <span className="text-[9px] text-[#64748b]">dB</span>
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Master Channel Strip (Hardware Style Master Bus) */}
      <div className="w-44 min-w-44 bg-[#1e232b] border border-[#3b82f6] rounded flex flex-col justify-between p-3 shadow-xl relative overflow-hidden">
        {/* Top Accent */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-[#3b82f6]" />

        <div className="pt-1 text-center">
          <span className="text-[10px] font-mono uppercase font-bold tracking-[0.2em] text-[#3b82f6]">
            MASTER BUS
          </span>
          <div className="text-sm font-bold text-white">MAIN STEREO</div>
          <div className="flex items-center justify-center gap-1 text-[10px] text-[#10b981] mt-0.5">
            <ShieldCheck className="w-3 h-3" />
            <span>Limiter Active</span>
          </div>
        </div>

        {/* Master VU Meter (Stereo Left + Right) & Fader */}
        <div className="flex-1 flex justify-center items-center gap-3 py-4">
          {/* Dual VU Meter */}
          <div className="flex gap-1">
            {/* L */}
            <div className="w-2.5 h-48 bg-[#0a0c10] rounded border border-[#2d333d] overflow-hidden flex flex-col justify-end p-0.5">
              <div
                className="w-full rounded transition-all duration-75 bg-gradient-to-t from-emerald-500 via-amber-400 to-rose-500"
                style={{ height: `${peakToPercent(masterL)}%` }}
              />
            </div>
            {/* R */}
            <div className="w-2.5 h-48 bg-[#0a0c10] rounded border border-[#2d333d] overflow-hidden flex flex-col justify-end p-0.5">
              <div
                className="w-full rounded transition-all duration-75 bg-gradient-to-t from-emerald-500 via-amber-400 to-rose-500"
                style={{ height: `${peakToPercent(masterR)}%` }}
              />
            </div>
          </div>

          {/* Master Fader */}
          <div className="flex flex-col items-center h-48 justify-between">
            <input
              type="range"
              min={0}
              max={1.5}
              step={0.01}
              value={project.masterVolume}
              onChange={e => setProject(p => ({ ...p, masterVolume: parseFloat(e.target.value) }))}
              className="h-48 w-7 appearance-none bg-[#0a0c10] rounded cursor-pointer accent-[#3b82f6] [writing-mode:vertical-lr] [direction:rtl]"
            />
          </div>

          {/* dB Scale */}
          <div className="flex flex-col justify-between h-48 text-[9px] font-mono text-[#64748b] py-1">
            <span className="text-[#ef4444]">+6</span>
            <span className="text-[#f59e0b]">0</span>
            <span>-6</span>
            <span>-12</span>
            <span>-24</span>
            <span>-∞</span>
          </div>
        </div>

        {/* Master Output Value */}
        <div className="text-center bg-[#0a0c10] py-1.5 rounded border border-[#2d333d] mb-2">
          <span className="font-mono text-sm font-bold text-[#38bdf8]">
            {formatDb(project.masterVolume)} <span className="text-[10px] text-[#64748b]">dB</span>
          </span>
        </div>

        {/* Quick Mixdown Button */}
        <button
          onClick={onExportMixdown}
          className="w-full py-2 rounded bg-[#10b981] hover:bg-[#34d399] text-black font-bold text-xs flex items-center justify-center gap-1.5 shadow transition-colors"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Export Mix</span>
        </button>
      </div>
    </div>
  );
};
