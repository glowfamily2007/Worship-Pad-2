import React, { useRef, useState } from 'react';
import {
  Sliders,
  Play,
  RotateCcw,
  RotateCw,
  Plus,
  Download,
  Upload,
  Layers,
  Activity,
  Music,
  Grid,
  Volume2,
  FolderOpen,
  Save,
  Mic,
  Disc,
} from 'lucide-react';
import { ActiveView, Project } from '../types';
import { exportProjectToWav } from '../audio/exportWav';

interface HeaderProps {
  project: Project;
  setProject: React.Dispatch<React.SetStateAction<Project>>;
  activeView: ActiveView;
  setActiveView: (view: ActiveView) => void;
  metronome: boolean;
  setMetronome: (enabled: boolean) => void;
  onResetDemo: () => void;
  onNewProject: () => void;
  onImportAudioFile: (file: File) => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  project,
  setProject,
  activeView,
  setActiveView,
  metronome,
  setMetronome,
  onResetDemo,
  onNewProject,
  onImportAudioFile,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
}) => {
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [isEditingName, setIsEditingName] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExportWav = async () => {
    try {
      setIsExporting(true);
      setExportProgress(0.1);
      const wavBlob = await exportProjectToWav(project, ratio => {
        setExportProgress(ratio);
      });
      const url = URL.createObjectURL(wavBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${project.name.toLowerCase().replace(/\s+/g, '_')}_master.wav`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Export error:', err);
      alert('Could not export mixdown: ' + (err as Error).message);
    } finally {
      setIsExporting(false);
      setExportProgress(0);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      onImportAudioFile(e.target.files[0]);
      e.target.value = '';
    }
  };

  const updateBpm = (val: number) => {
    const clamped = Math.max(40, Math.min(260, val));
    setProject(prev => ({ ...prev, bpm: clamped }));
  };

  return (
    <header className="bg-[#1a1d23] border-b border-[#2d333d] select-none text-[#e2e8f0]">
      {/* Top Bar */}
      <div className="flex items-center justify-between px-4 py-2 gap-3 flex-wrap">
        {/* Brand & Project Name */}
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <div className="w-6 h-6 bg-[#3b82f6] rounded-sm flex items-center justify-center shadow-sm">
              <div className="w-3 h-3 bg-white rotate-45" />
            </div>
            <div>
              <span className="font-bold tracking-tight text-lg text-white">
                AUDIO<span className="text-[#3b82f6]">EVO</span>
              </span>
            </div>
          </div>

          <div className="h-5 w-px bg-[#2d333d] hidden sm:block" />

          {/* Project Rename */}
          <div className="flex items-center">
            {isEditingName ? (
              <input
                type="text"
                autoFocus
                value={project.name}
                onChange={e => setProject(p => ({ ...p, name: e.target.value }))}
                onBlur={() => setIsEditingName(false)}
                onKeyDown={e => e.key === 'Enter' && setIsEditingName(false)}
                className="text-xs bg-[#0a0c10] border border-[#3b82f6] rounded px-2 py-0.5 text-white font-medium focus:outline-none"
              />
            ) : (
              <button
                onClick={() => setIsEditingName(true)}
                className="text-xs text-[#94a3b8] hover:text-white font-medium flex items-center gap-1.5 transition-colors"
                title="Click to rename project"
              >
                <span className="font-medium text-white">{project.name}</span>
                <span className="text-[10px] text-[#64748b]">✎</span>
              </button>
            )}
          </div>

          <div className="h-5 w-px bg-[#2d333d] hidden sm:block" />

          {/* Quick Undo / Redo */}
          <div className="hidden sm:flex items-center space-x-1">
            <button
              onClick={onUndo}
              disabled={!canUndo}
              className={`w-7 h-7 flex items-center justify-center rounded bg-[#2d333d] hover:bg-[#3d4450] text-[#94a3b8] transition-colors ${
                canUndo ? 'hover:text-white' : 'opacity-40 cursor-not-allowed'
              }`}
              title="Undo (Ctrl+Z)"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={onRedo}
              disabled={!canRedo}
              className={`w-7 h-7 flex items-center justify-center rounded bg-[#2d333d] hover:bg-[#3d4450] text-[#94a3b8] transition-colors ${
                canRedo ? 'hover:text-white' : 'opacity-40 cursor-not-allowed'
              }`}
              title="Redo (Ctrl+Y)"
            >
              <RotateCw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Center Project Master Controls: BPM, Time Signature, Metronome */}
        <div className="flex items-center space-x-3 bg-[#16191e] px-3 py-1 rounded border border-[#2d333d]">
          {/* Tempo / BPM */}
          <div className="flex items-center space-x-1.5">
            <span className="text-[10px] font-bold text-[#64748b] uppercase tracking-wider">BPM</span>
            <div className="flex items-center bg-[#0a0c10] border border-[#2d333d] rounded px-1.5 py-0.5">
              <input
                type="number"
                min={40}
                max={260}
                value={project.bpm}
                onChange={e => updateBpm(parseInt(e.target.value) || 120)}
                className="w-10 text-center text-xs font-mono font-bold text-[#10b981] bg-transparent focus:outline-none"
              />
            </div>
          </div>

          <div className="h-4 w-px bg-[#2d333d]" />

          {/* Time Signature */}
          <div className="flex items-center space-x-1.5">
            <span className="text-[10px] font-bold text-[#64748b] uppercase tracking-wider">SIG</span>
            <span className="text-xs font-mono font-semibold text-[#94a3b8] bg-[#0a0c10] border border-[#2d333d] px-1.5 py-0.5 rounded">
              {project.timeSignature[0]}/{project.timeSignature[1]}
            </span>
          </div>

          <div className="h-4 w-px bg-[#2d333d]" />

          {/* Metronome */}
          <button
            onClick={() => setMetronome(!metronome)}
            className={`flex items-center space-x-1 px-2 py-0.5 rounded text-xs font-medium transition-all ${
              metronome
                ? 'bg-[#3b82f622] text-[#3b82f6] border border-[#3b82f666]'
                : 'text-[#94a3b8] hover:text-white hover:bg-[#2d333d]'
            }`}
            title="Toggle Metronome Click"
          >
            <Disc className={`w-3.5 h-3.5 ${metronome ? 'animate-spin text-[#3b82f6]' : ''}`} />
            <span className="text-[10px] font-bold uppercase tracking-wider">CLICK</span>
          </button>
        </div>

        {/* Right Actions: File Import, Demo reset, WAV export */}
        <div className="flex items-center space-x-2">
          {/* Hidden File Input */}
          <input
            ref={fileInputRef}
            type="file"
            accept="audio/*"
            className="hidden"
            onChange={handleFileChange}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center space-x-1.5 px-2.5 py-1 rounded bg-[#2d333d] hover:bg-[#3d4450] text-[#94a3b8] hover:text-white border border-[#2d333d] text-xs font-medium transition-colors"
            title="Import audio file (WAV, MP3, OGG) to track"
          >
            <Upload className="w-3.5 h-3.5 text-[#3b82f6]" />
            <span className="hidden sm:inline">Import</span>
          </button>

          <button
            onClick={onResetDemo}
            className="flex items-center space-x-1.5 px-2.5 py-1 rounded bg-[#2d333d] hover:bg-[#3d4450] text-[#94a3b8] hover:text-white border border-[#2d333d] text-xs font-medium transition-colors"
            title="Reload Demo Song"
          >
            <FolderOpen className="w-3.5 h-3.5 text-[#f59e0b]" />
            <span className="hidden md:inline">Demo</span>
          </button>

          <button
            onClick={onNewProject}
            className="flex items-center space-x-1.5 px-2.5 py-1 rounded bg-[#2d333d] hover:bg-[#3d4450] text-[#94a3b8] hover:text-white border border-[#2d333d] text-xs font-medium transition-colors"
            title="Create blank project"
          >
            <Plus className="w-3.5 h-3.5 text-[#10b981]" />
            <span className="hidden md:inline">New</span>
          </button>

          {/* Export Mixdown WAV */}
          <button
            onClick={handleExportWav}
            disabled={isExporting}
            className="flex items-center space-x-1.5 px-3 py-1 rounded bg-[#3b82f6] hover:bg-[#2563eb] text-white font-medium text-xs shadow-[0_0_10px_rgba(59,130,246,0.3)] transition-all border border-[#60a5fa]/30 disabled:opacity-50"
            title="Export master audio mixdown to 16-bit 44.1kHz Stereo WAV file"
          >
            <Download className={`w-3.5 h-3.5 ${isExporting ? 'animate-bounce' : ''}`} />
            <span>{isExporting ? `Rendering ${Math.round(exportProgress * 100)}%` : 'Export Mix'}</span>
          </button>
        </div>
      </div>

      {/* Studio View Navigation Tabs */}
      <div className="flex items-center justify-between px-4 bg-[#16191e] border-t border-[#2d333d] overflow-x-auto">
        <nav className="flex space-x-6 text-xs font-medium text-[#94a3b8] uppercase tracking-wider py-2">
          <button
            onClick={() => setActiveView('track_console')}
            className={`transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeView === 'track_console'
                ? 'text-white border-b-2 border-[#3b82f6] pb-1 font-semibold'
                : 'hover:text-white border-b-2 border-transparent pb-1'
            }`}
          >
            <Sliders className="w-3.5 h-3.5 text-blue-400" />
            <span>Track Console</span>
          </button>

          <button
            onClick={() => setActiveView('arranger')}
            className={`transition-colors cursor-pointer ${
              activeView === 'arranger'
                ? 'text-white border-b-2 border-[#3b82f6] pb-1 font-semibold'
                : 'hover:text-white border-b-2 border-transparent pb-1'
            }`}
          >
            Timeline Arranger
          </button>

          <button
            onClick={() => setActiveView('mixer')}
            className={`transition-colors cursor-pointer ${
              activeView === 'mixer'
                ? 'text-white border-b-2 border-[#3b82f6] pb-1 font-semibold'
                : 'hover:text-white border-b-2 border-transparent pb-1'
            }`}
          >
            Mixer Console
          </button>

          <button
            onClick={() => setActiveView('pianoroll')}
            className={`transition-colors cursor-pointer ${
              activeView === 'pianoroll'
                ? 'text-white border-b-2 border-[#3b82f6] pb-1 font-semibold'
                : 'hover:text-white border-b-2 border-transparent pb-1'
            }`}
          >
            Piano Roll (MIDI)
          </button>

          <button
            onClick={() => setActiveView('fx')}
            className={`transition-colors cursor-pointer ${
              activeView === 'fx'
                ? 'text-white border-b-2 border-[#3b82f6] pb-1 font-semibold'
                : 'hover:text-white border-b-2 border-transparent pb-1'
            }`}
          >
            Track FX Rack
          </button>

          <button
            onClick={() => setActiveView('instruments')}
            className={`transition-colors cursor-pointer ${
              activeView === 'instruments'
                ? 'text-white border-b-2 border-[#3b82f6] pb-1 font-semibold'
                : 'hover:text-white border-b-2 border-transparent pb-1'
            }`}
          >
            Instruments & Drum Pads
          </button>
        </nav>

        {/* Master Status */}
        <div className="hidden lg:flex items-center space-x-3 text-[10px] text-[#64748b] font-mono tracking-wider">
          <span>44.1 kHz / 24-BIT</span>
          <span>•</span>
          <span className="text-[#10b981]">DSP ENGINE OK</span>
        </div>
      </div>
    </header>
  );
};
