import React, { useRef, useEffect } from 'react';
import { Sliders, Activity, Power, Waves, Disc, Sparkles, Volume2 } from 'lucide-react';
import { Project, Track, TrackFx } from '../../types';

interface FxRackProps {
  project: Project;
  setProject: React.Dispatch<React.SetStateAction<Project>>;
  selectedTrackId: string | null;
  setSelectedTrackId: (id: string | null) => void;
}

export const FxRack: React.FC<FxRackProps> = ({
  project,
  setProject,
  selectedTrackId,
  setSelectedTrackId,
}) => {
  const activeTrack =
    project.tracks.find(t => t.id === selectedTrackId) || project.tracks[0];

  const canvasRef = useRef<HTMLCanvasElement>(null);

  const updateTrackFx = (updater: (prevFx: TrackFx) => TrackFx) => {
    if (!activeTrack) return;
    setProject(prev => ({
      ...prev,
      tracks: prev.tracks.map(t =>
        t.id === activeTrack.id ? { ...t, fx: updater(t.fx) } : t
      ),
    }));
  };

  // Draw interactive EQ curve canvas
  useEffect(() => {
    if (!canvasRef.current || !activeTrack) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);

    // Draw background grid lines (frequencies: 100Hz, 1kHz, 10kHz)
    ctx.strokeStyle = '#2d333d';
    ctx.lineWidth = 1;

    // 0 dB center line
    const zeroY = height / 2;
    ctx.beginPath();
    ctx.setLineDash([4, 4]);
    ctx.moveTo(0, zeroY);
    ctx.lineTo(width, zeroY);
    ctx.stroke();
    ctx.setLineDash([]);

    // Curve rendering
    const eq = activeTrack.fx.eq;
    ctx.strokeStyle = eq.enabled ? (activeTrack.color || '#3b82f6') : '#64748b';
    ctx.lineWidth = 2.5;
    ctx.beginPath();

    for (let x = 0; x < width; x++) {
      // Map x (0..width) logarithmically to freq (20Hz..20000Hz)
      const freq = 20 * Math.pow(20000 / 20, x / width);

      // Approximate EQ response in dB
      let gainDb = 0;
      if (eq.enabled) {
        // Low shelf
        const lowFactor = 1 / (1 + Math.pow(freq / eq.lowFreq, 2));
        gainDb += eq.lowGain * lowFactor;

        // Mid peak (bell curve)
        const midFactor = Math.exp(-Math.pow(Math.log2(freq / eq.midFreq) * 1.5, 2));
        gainDb += eq.midGain * midFactor;

        // High shelf
        const highFactor = 1 / (1 + Math.pow(eq.highFreq / freq, 2));
        gainDb += eq.highGain * highFactor;
      }

      // Map gainDb (-15 to +15 dB) to y
      const y = zeroY - (gainDb / 15) * (height / 2 - 10);
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Fill under curve
    ctx.lineTo(width, zeroY);
    ctx.lineTo(0, zeroY);
    ctx.closePath();
    ctx.fillStyle = eq.enabled ? `${activeTrack.color || '#3b82f6'}20` : 'transparent';
    ctx.fill();
  }, [activeTrack]);

  if (!activeTrack) {
    return (
      <div className="flex-1 bg-[#0f1115] flex items-center justify-center text-[#64748b]">
        Select a track to configure audio effects.
      </div>
    );
  }

  const { eq, reverb, delay, compressor } = activeTrack.fx;

  return (
    <div className="flex-1 bg-[#0f1115] flex flex-col overflow-y-auto select-none p-4">
      {/* Top Track Selector */}
      <div className="bg-[#1a1d23] border border-[#2d333d] rounded p-3 mb-4 flex items-center justify-between flex-wrap gap-3 shadow-sm">
        <div className="flex items-center space-x-2">
          <div
            className="w-2.5 h-2.5 rounded-full"
            style={{ backgroundColor: activeTrack.color }}
          />
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#64748b]">TRACK FX RACK</span>
          <select
            value={activeTrack.id}
            onChange={e => setSelectedTrackId(e.target.value)}
            className="bg-[#16191e] text-xs font-bold text-white px-2.5 py-1 rounded border border-[#2d333d] focus:outline-none cursor-pointer"
          >
            {project.tracks.map(t => (
              <option key={t.id} value={t.id} className="bg-[#1a1d23]">
                {t.name} ({t.type === 'audio' ? 'Audio' : t.instrument.replace('_', ' ')})
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center space-x-2 text-xs font-mono text-[#64748b]">
          <span>INSERTS: 4 MODULES</span>
          <span>•</span>
          <span className="text-[#10b981] font-semibold">64-BIT DSP ENGINE</span>
        </div>
      </div>

      {/* Grid of Rack Modules */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Module 1: 3-Band Parametric EQ */}
        <div className="bg-[#1a1d23] border border-[#2d333d] rounded p-4 flex flex-col justify-between shadow-sm">
          <div className="flex items-center justify-between border-b border-[#2d333d] pb-2 mb-3">
            <div className="flex items-center space-x-2">
              <Activity className="w-4 h-4 text-[#10b981]" />
              <span className="text-xs font-bold uppercase tracking-wider text-white">
                3-BAND PARAMETRIC EQ
              </span>
            </div>
            <button
              onClick={() => updateTrackFx(fx => ({ ...fx, eq: { ...fx.eq, enabled: !fx.eq.enabled } }))}
              className={`p-1.5 rounded transition-colors ${
                eq.enabled ? 'bg-[#10b981]/20 text-[#10b981]' : 'bg-[#16191e] text-[#64748b]'
              }`}
            >
              <Power className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* EQ Frequency Curve Canvas */}
          <div className="w-full bg-[#0a0c10] rounded border border-[#2d333d] p-1.5 mb-4 flex flex-col items-center">
            <canvas ref={canvasRef} width={450} height={110} className="w-full h-24" />
            <div className="flex justify-between w-full px-2 text-[9px] font-mono text-[#64748b] pt-1">
              <span>50 Hz</span>
              <span>250 Hz</span>
              <span>1 kHz</span>
              <span>5 kHz</span>
              <span>16 kHz</span>
            </div>
          </div>

          {/* EQ Controls (Low, Mid, High) */}
          <div className="grid grid-cols-3 gap-3">
            {/* Low Shelf */}
            <div className="bg-[#16191e] p-2.5 rounded border border-[#2d333d] flex flex-col gap-1.5">
              <span className="text-[10px] font-bold text-[#64748b] uppercase">LOW SHELF</span>
              <div className="flex justify-between text-[9px] font-mono text-[#94a3b8]">
                <span>GAIN</span>
                <span className="text-[#10b981] font-bold">{eq.lowGain > 0 ? '+' : ''}{eq.lowGain} dB</span>
              </div>
              <input
                type="range"
                min={-12}
                max={12}
                step={0.5}
                value={eq.lowGain}
                onChange={e =>
                  updateTrackFx(fx => ({ ...fx, eq: { ...fx.eq, lowGain: parseFloat(e.target.value) } }))
                }
                className="w-full h-1 bg-[#2d333d] rounded accent-[#10b981]"
              />
              <div className="flex justify-between text-[9px] font-mono text-[#94a3b8] pt-1">
                <span>FREQ</span>
                <span>{eq.lowFreq} Hz</span>
              </div>
              <input
                type="range"
                min={40}
                max={400}
                step={10}
                value={eq.lowFreq}
                onChange={e =>
                  updateTrackFx(fx => ({ ...fx, eq: { ...fx.eq, lowFreq: parseInt(e.target.value) } }))
                }
                className="w-full h-1 bg-[#2d333d] rounded accent-[#10b981]"
              />
            </div>

            {/* Mid Parametric */}
            <div className="bg-[#16191e] p-2.5 rounded border border-[#2d333d] flex flex-col gap-1.5">
              <span className="text-[10px] font-bold text-[#64748b] uppercase">MID PEAK</span>
              <div className="flex justify-between text-[9px] font-mono text-[#94a3b8]">
                <span>GAIN</span>
                <span className="text-[#10b981] font-bold">{eq.midGain > 0 ? '+' : ''}{eq.midGain} dB</span>
              </div>
              <input
                type="range"
                min={-12}
                max={12}
                step={0.5}
                value={eq.midGain}
                onChange={e =>
                  updateTrackFx(fx => ({ ...fx, eq: { ...fx.eq, midGain: parseFloat(e.target.value) } }))
                }
                className="w-full h-1 bg-[#2d333d] rounded accent-[#10b981]"
              />
              <div className="flex justify-between text-[9px] font-mono text-[#94a3b8] pt-1">
                <span>FREQ</span>
                <span>{eq.midFreq} Hz</span>
              </div>
              <input
                type="range"
                min={300}
                max={4000}
                step={50}
                value={eq.midFreq}
                onChange={e =>
                  updateTrackFx(fx => ({ ...fx, eq: { ...fx.eq, midFreq: parseInt(e.target.value) } }))
                }
                className="w-full h-1 bg-[#2d333d] rounded accent-[#10b981]"
              />
            </div>

            {/* High Shelf */}
            <div className="bg-[#16191e] p-2.5 rounded border border-[#2d333d] flex flex-col gap-1.5">
              <span className="text-[10px] font-bold text-[#64748b] uppercase">HIGH SHELF</span>
              <div className="flex justify-between text-[9px] font-mono text-[#94a3b8]">
                <span>GAIN</span>
                <span className="text-[#10b981] font-bold">{eq.highGain > 0 ? '+' : ''}{eq.highGain} dB</span>
              </div>
              <input
                type="range"
                min={-12}
                max={12}
                step={0.5}
                value={eq.highGain}
                onChange={e =>
                  updateTrackFx(fx => ({ ...fx, eq: { ...fx.eq, highGain: parseFloat(e.target.value) } }))
                }
                className="w-full h-1 bg-[#2d333d] rounded accent-[#10b981]"
              />
              <div className="flex justify-between text-[9px] font-mono text-[#94a3b8] pt-1">
                <span>FREQ</span>
                <span>{eq.highFreq} Hz</span>
              </div>
              <input
                type="range"
                min={2000}
                max={14000}
                step={200}
                value={eq.highFreq}
                onChange={e =>
                  updateTrackFx(fx => ({ ...fx, eq: { ...fx.eq, highFreq: parseInt(e.target.value) } }))
                }
                className="w-full h-1 bg-[#2d333d] rounded accent-[#10b981]"
              />
            </div>
          </div>
        </div>

        {/* Module 2: Studio Algorithmic Reverb */}
        <div className="bg-[#1a1d23] border border-[#2d333d] rounded p-4 flex flex-col justify-between shadow-sm">
          <div className="flex items-center justify-between border-b border-[#2d333d] pb-2 mb-3">
            <div className="flex items-center space-x-2">
              <Sparkles className="w-4 h-4 text-[#38bdf8]" />
              <span className="text-xs font-bold uppercase tracking-wider text-white">
                STUDIO REVERB
              </span>
            </div>
            <button
              onClick={() =>
                updateTrackFx(fx => ({ ...fx, reverb: { ...fx.reverb, enabled: !fx.reverb.enabled } }))
              }
              className={`p-1.5 rounded transition-colors ${
                reverb.enabled ? 'bg-[#38bdf8]/20 text-[#38bdf8]' : 'bg-[#16191e] text-[#64748b]'
              }`}
            >
              <Power className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-4 my-auto">
            {/* Decay Time */}
            <div className="bg-[#16191e] p-3 rounded border border-[#2d333d] flex flex-col gap-2">
              <div className="flex justify-between text-xs font-semibold">
                <span className="text-[#64748b]">ROOM DECAY</span>
                <span className="font-mono text-[#38bdf8]">{reverb.decay.toFixed(1)} s</span>
              </div>
              <input
                type="range"
                min={0.3}
                max={4.5}
                step={0.1}
                value={reverb.decay}
                onChange={e =>
                  updateTrackFx(fx => ({
                    ...fx,
                    reverb: { ...fx.reverb, decay: parseFloat(e.target.value) },
                  }))
                }
                className="w-full h-1 bg-[#2d333d] rounded accent-[#38bdf8]"
              />
            </div>

            {/* Wet Mix */}
            <div className="bg-[#16191e] p-3 rounded border border-[#2d333d] flex flex-col gap-2">
              <div className="flex justify-between text-xs font-semibold">
                <span className="text-[#64748b]">WET / DRY MIX</span>
                <span className="font-mono text-[#38bdf8]">{Math.round(reverb.mix * 100)}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={1}
                step={0.02}
                value={reverb.mix}
                onChange={e =>
                  updateTrackFx(fx => ({
                    ...fx,
                    reverb: { ...fx.reverb, mix: parseFloat(e.target.value) },
                  }))
                }
                className="w-full h-1 bg-[#2d333d] rounded accent-[#38bdf8]"
              />
            </div>
          </div>

          <div className="text-[10px] text-[#64748b] font-mono mt-3">
            Algorithmic convolution simulation with natural diffusion and decay curves.
          </div>
        </div>

        {/* Module 3: Stereo Delay / Echo */}
        <div className="bg-[#1a1d23] border border-[#2d333d] rounded p-4 flex flex-col justify-between shadow-sm">
          <div className="flex items-center justify-between border-b border-[#2d333d] pb-2 mb-3">
            <div className="flex items-center space-x-2">
              <Waves className="w-4 h-4 text-[#3b82f6]" />
              <span className="text-xs font-bold uppercase tracking-wider text-white">
                STEREO DELAY / ECHO
              </span>
            </div>
            <button
              onClick={() =>
                updateTrackFx(fx => ({ ...fx, delay: { ...fx.delay, enabled: !fx.delay.enabled } }))
              }
              className={`p-1.5 rounded transition-colors ${
                delay.enabled ? 'bg-[#3b82f6]/20 text-[#3b82f6]' : 'bg-[#16191e] text-[#64748b]'
              }`}
            >
              <Power className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-3 gap-3 my-auto">
            {/* Delay Time */}
            <div className="bg-[#16191e] p-2.5 rounded border border-[#2d333d] flex flex-col gap-1.5">
              <div className="flex justify-between text-[10px] font-semibold">
                <span className="text-[#64748b]">TIME</span>
                <span className="font-mono text-[#3b82f6]">{Math.round(delay.time * 1000)} ms</span>
              </div>
              <input
                type="range"
                min={0.05}
                max={0.8}
                step={0.01}
                value={delay.time}
                onChange={e =>
                  updateTrackFx(fx => ({
                    ...fx,
                    delay: { ...fx.delay, time: parseFloat(e.target.value) },
                  }))
                }
                className="w-full h-1 bg-[#2d333d] rounded accent-[#3b82f6]"
              />
            </div>

            {/* Feedback */}
            <div className="bg-[#16191e] p-2.5 rounded border border-[#2d333d] flex flex-col gap-1.5">
              <div className="flex justify-between text-[10px] font-semibold">
                <span className="text-[#64748b]">FEEDBACK</span>
                <span className="font-mono text-[#3b82f6]">{Math.round(delay.feedback * 100)}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={0.85}
                step={0.02}
                value={delay.feedback}
                onChange={e =>
                  updateTrackFx(fx => ({
                    ...fx,
                    delay: { ...fx.delay, feedback: parseFloat(e.target.value) },
                  }))
                }
                className="w-full h-1 bg-[#2d333d] rounded accent-[#3b82f6]"
              />
            </div>

            {/* Mix */}
            <div className="bg-[#16191e] p-2.5 rounded border border-[#2d333d] flex flex-col gap-1.5">
              <div className="flex justify-between text-[10px] font-semibold">
                <span className="text-[#64748b]">MIX</span>
                <span className="font-mono text-[#3b82f6]">{Math.round(delay.mix * 100)}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={1}
                step={0.02}
                value={delay.mix}
                onChange={e =>
                  updateTrackFx(fx => ({
                    ...fx,
                    delay: { ...fx.delay, mix: parseFloat(e.target.value) },
                  }))
                }
                className="w-full h-1 bg-[#2d333d] rounded accent-[#3b82f6]"
              />
            </div>
          </div>

          <div className="text-[10px] text-[#64748b] font-mono mt-3">
            Stereo crossed delay line with dampening feedback filter.
          </div>
        </div>

        {/* Module 4: Studio Dynamics Compressor */}
        <div className="bg-[#1a1d23] border border-[#2d333d] rounded p-4 flex flex-col justify-between shadow-sm">
          <div className="flex items-center justify-between border-b border-[#2d333d] pb-2 mb-3">
            <div className="flex items-center space-x-2">
              <Sliders className="w-4 h-4 text-[#f59e0b]" />
              <span className="text-xs font-bold uppercase tracking-wider text-white">
                STUDIO COMPRESSOR
              </span>
            </div>
            <button
              onClick={() =>
                updateTrackFx(fx => ({
                  ...fx,
                  compressor: { ...fx.compressor, enabled: !fx.compressor.enabled },
                }))
              }
              className={`p-1.5 rounded transition-colors ${
                compressor.enabled ? 'bg-[#f59e0b]/20 text-[#f59e0b]' : 'bg-[#16191e] text-[#64748b]'
              }`}
            >
              <Power className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3 my-auto">
            {/* Threshold */}
            <div className="bg-[#16191e] p-2.5 rounded border border-[#2d333d] flex flex-col gap-1.5">
              <div className="flex justify-between text-[10px] font-semibold">
                <span className="text-[#64748b]">THRESHOLD</span>
                <span className="font-mono text-[#f59e0b]">{compressor.threshold} dB</span>
              </div>
              <input
                type="range"
                min={-40}
                max={0}
                step={1}
                value={compressor.threshold}
                onChange={e =>
                  updateTrackFx(fx => ({
                    ...fx,
                    compressor: { ...fx.compressor, threshold: parseInt(e.target.value) },
                  }))
                }
                className="w-full h-1 bg-[#2d333d] rounded accent-[#f59e0b]"
              />
            </div>

            {/* Ratio */}
            <div className="bg-[#16191e] p-2.5 rounded border border-[#2d333d] flex flex-col gap-1.5">
              <div className="flex justify-between text-[10px] font-semibold">
                <span className="text-[#64748b]">RATIO</span>
                <span className="font-mono text-[#f59e0b]">{compressor.ratio}:1</span>
              </div>
              <input
                type="range"
                min={1}
                max={16}
                step={0.5}
                value={compressor.ratio}
                onChange={e =>
                  updateTrackFx(fx => ({
                    ...fx,
                    compressor: { ...fx.compressor, ratio: parseFloat(e.target.value) },
                  }))
                }
                className="w-full h-1 bg-[#2d333d] rounded accent-[#f59e0b]"
              />
            </div>
          </div>

          <div className="text-[10px] text-[#64748b] font-mono mt-3">
            Peak-level dynamics control with soft-knee saturation protection.
          </div>
        </div>
      </div>
    </div>
  );
};
