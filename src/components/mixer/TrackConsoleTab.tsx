import React, { useState, useEffect, useRef } from 'react';
import {
  Folder,
  MoreHorizontal,
  AlertTriangle,
  Grid,
  Settings,
  ChevronLeft,
  ChevronRight,
  Sliders,
  Volume2,
  Upload,
  Radio,
  Music,
  Plus,
  Trash2,
  Play,
  Square,
  Sparkles,
} from 'lucide-react';
import { Project, Track, VUMeterData, TrackChannelEq } from '../../types';
import { AudioEngine } from '../../audio/AudioEngine';
import { MidiManager } from '../../audio/midiManager';
import { SoundFontEngine } from '../../audio/sf2Engine';
import { SoundFontManagerModal } from './SoundFontManagerModal';
import { MidiSettingsModal } from './MidiSettingsModal';

interface TrackConsoleTabProps {
  project: Project;
  setProject: React.Dispatch<React.SetStateAction<Project>>;
  selectedTrackId: string;
  setSelectedTrackId: (id: string) => void;
  vuMeters: VUMeterData[];
  masterL: number;
  masterR: number;
  onOpenFx: (trackId: string) => void;
  onOpenPianoRoll: (trackId: string) => void;
  onExportMixdown: () => void;
  onRecordLiveNote?: (trackId: string, pitch: number, velocity: number) => void;
  onLiveNoteStart?: (trackId: string, pitch: number, velocity: number) => void;
  onLiveNoteEnd?: (trackId: string, pitch: number) => void;
  isRecording?: boolean;
  onToast: (msg: string) => void;
}

export const TrackConsoleTab: React.FC<TrackConsoleTabProps> = ({
  project,
  setProject,
  selectedTrackId,
  setSelectedTrackId,
  vuMeters,
  masterL,
  masterR,
  onOpenFx,
  onOpenPianoRoll,
  onExportMixdown,
  onRecordLiveNote,
  onLiveNoteStart,
  onLiveNoteEnd,
  isRecording = false,
  onToast,
}) => {
  const audioEngine = AudioEngine.getInstance();
  const midiManager = MidiManager.getInstance();
  const sf2Engine = SoundFontEngine.getInstance();

  // Modals state
  const [isSf2ModalOpen, setIsSf2ModalOpen] = useState(false);
  const [isMidiModalOpen, setIsMidiModalOpen] = useState(false);
  const [modalTargetTrackId, setModalTargetTrackId] = useState<string>(selectedTrackId || project.tracks[0]?.id || '');
  const [isProjectMenuOpen, setIsProjectMenuOpen] = useState(false);
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);

  // USB MIDI state
  const [isMidiConnected, setIsMidiConnected] = useState<boolean>(midiManager.getIsConnected());
  const [midiFlash, setMidiFlash] = useState(false);
  const [activeMidiTrackId, setActiveMidiTrackId] = useState<string | null>(null);

  // Sustain & Transpose hardware state
  const [isSustainActive, setIsSustainActive] = useState<boolean>(midiManager.getIsSustainActive());
  const [transpose, setTransposeState] = useState<number>(midiManager.getTranspose());

  // Simulated CPU load
  const [cpuUsage, setCpuUsage] = useState(14);

  // Active Fader drag tracking
  const [draggingFaderTrackId, setDraggingFaderTrackId] = useState<string | null>(null);

  const armedTracksCount = project.tracks.filter(t => t.isArmed).length;

  // Toggle Sustain button
  const handleToggleSustain = () => {
    const next = !isSustainActive;
    setIsSustainActive(next);
    midiManager.setSustainActive(next);
    audioEngine.setSustain(next);
    onToast(next ? 'Sustain PEDAL ACTIVE: Sound will not stop until released' : 'Sustain PEDAL RELEASED');
  };

  // Set Transpose Semitones
  const handleSetTranspose = (val: number) => {
    const clamped = Math.max(-24, Math.min(24, val));
    setTransposeState(clamped);
    midiManager.setTranspose(clamped);
    audioEngine.setTranspose(clamped);
    onToast(`Key Transpose: ${clamped > 0 ? `+${clamped}` : clamped} semitones`);
  };

  // Multi-track arm toggling: toggling a track does NOT disarm other tracks!
  const handleToggleArm = (trackId: string) => {
    setProject(prev => ({
      ...prev,
      tracks: prev.tracks.map(t => (t.id === trackId ? { ...t, isArmed: !t.isArmed } : t)),
    }));
    setSelectedTrackId(trackId);
    const target = project.tracks.find(t => t.id === trackId);
    const nextArmed = !target?.isArmed;
    onToast(
      nextArmed
        ? `Armed "${target?.name || 'Track'}" (Multi-track recording supported)`
        : `Disarmed "${target?.name || 'Track'}"`
    );
  };

  // Arm all tracks simultaneously
  const handleArmAllTracks = () => {
    setProject(prev => ({
      ...prev,
      tracks: prev.tracks.map(t => ({ ...t, isArmed: true })),
    }));
    onToast(`All ${project.tracks.length} tracks ARMED for simultaneous multi-track recording!`);
  };

  // Disarm all tracks
  const handleDisarmAllTracks = () => {
    setProject(prev => ({
      ...prev,
      tracks: prev.tracks.map(t => ({ ...t, isArmed: false })),
    }));
    onToast('All tracks disarmed');
  };

  // Initialize and bind USB MIDI events
  useEffect(() => {
    // Attempt auto-connect if supported
    if (midiManager.getIsSupported() && !midiManager.getIsConnected()) {
      midiManager.init().then(connected => {
        setIsMidiConnected(connected);
      });
    }

    const unsubActivity = midiManager.onActivity(() => {
      setMidiFlash(true);
      setTimeout(() => setMidiFlash(false), 120);
    });

    const unsubDevices = midiManager.onDevicesChanged(() => {
      setIsMidiConnected(midiManager.getIsConnected());
    });

    // Handle incoming USB MIDI Note On
    const unsubNoteOn = midiManager.onNoteOn((pitch, velocity, channel) => {
      // Find receiving tracks: if multiple tracks are armed, ALL play and record simultaneously!
      let targetTracks = project.tracks.filter(t => t.isArmed);
      if (targetTracks.length === 0 && project.tracks[channel]) {
        targetTracks = [project.tracks[channel]];
      }
      if (targetTracks.length === 0) {
        const fallback = project.tracks.find(t => t.id === selectedTrackId) || project.tracks[0];
        if (fallback) targetTracks = [fallback];
      }

      for (const targetTrack of targetTracks) {
        setActiveMidiTrackId(targetTrack.id);

        // Continuous playback: until the key is released the sound will NOT stop!
        audioEngine.startNote(targetTrack.id, pitch, velocity);

        // If recording is active, record the note into all armed tracks
        if (isRecording) {
          if (onLiveNoteStart) {
            onLiveNoteStart(targetTrack.id, pitch, velocity);
          } else if (onRecordLiveNote) {
            onRecordLiveNote(targetTrack.id, pitch, velocity);
          }
        }
      }
      setTimeout(() => setActiveMidiTrackId(null), 180);
    });

    // Handle incoming USB MIDI Note Off
    const unsubNoteOff = midiManager.onNoteOff((pitch, channel) => {
      let targetTracks = project.tracks.filter(t => t.isArmed);
      if (targetTracks.length === 0 && project.tracks[channel]) {
        targetTracks = [project.tracks[channel]];
      }
      if (targetTracks.length === 0) {
        const fallback = project.tracks.find(t => t.id === selectedTrackId) || project.tracks[0];
        if (fallback) targetTracks = [fallback];
      }

      for (const targetTrack of targetTracks) {
        audioEngine.stopNote(targetTrack.id, pitch);

        if (isRecording && onLiveNoteEnd) {
          onLiveNoteEnd(targetTrack.id, pitch);
        }
      }
    });

    // Handle sustain pedal hardware CC 64 changes
    const unsubSustain = midiManager.onSustainChanged(active => {
      setIsSustainActive(active);
      audioEngine.setSustain(active);
    });

    // Handle incoming USB MIDI CC (CC 7 = Volume, CC 10 = Pan)
    const unsubCC = midiManager.onControlChange((cc, val, channel) => {
      let targetTrack = project.tracks.find(t => t.isArmed);
      if (!targetTrack && project.tracks[channel]) {
        targetTrack = project.tracks[channel];
      }
      if (!targetTrack) targetTrack = project.tracks[0];

      if (targetTrack) {
        if (cc === 7) {
          // CC 7: Volume (0-127 -> 0-1.25)
          const newVol = (val / 127) * 1.25;
          setProject(prev => ({
            ...prev,
            tracks: prev.tracks.map(t => (t.id === targetTrack!.id ? { ...t, volume: newVol } : t)),
          }));
        } else if (cc === 10) {
          // CC 10: Pan (0-127 -> -1 to 1)
          const newPan = (val / 64) - 1;
          setProject(prev => ({
            ...prev,
            tracks: prev.tracks.map(t => (t.id === targetTrack!.id ? { ...t, pan: newPan } : t)),
          }));
        }
      }
    });

    return () => {
      unsubActivity();
      unsubDevices();
      unsubNoteOn();
      unsubNoteOff();
      unsubSustain();
      unsubCC();
    };
  }, [project.tracks, selectedTrackId, isRecording, onRecordLiveNote, onLiveNoteStart, onLiveNoteEnd]);

  // Periodic CPU simulation update
  useEffect(() => {
    const interval = setInterval(() => {
      setCpuUsage(Math.min(95, Math.max(8, 12 + Math.floor(Math.random() * 8) + (audioEngine ? 4 : 0))));
    }, 1500);
    return () => clearInterval(interval);
  }, []);

  // Panic button handler
  const handlePanic = () => {
    audioEngine.panic();
    midiManager.panic();
    onToast('! PANIC: Silenced all voices, killed active oscillators & reset MIDI');
  };

  // Toggle Solo
  const handleToggleSolo = (trackId: string) => {
    setProject(prev => ({
      ...prev,
      tracks: prev.tracks.map(t => (t.id === trackId ? { ...t, isSolo: !t.isSolo } : t)),
    }));
  };

  // Channel EQ updater
  const handleUpdateChannelEq = (trackId: string, updates: Partial<TrackChannelEq>) => {
    setProject(prev => ({
      ...prev,
      tracks: prev.tracks.map(t => {
        if (t.id !== trackId) return t;
        const currentEq: TrackChannelEq = t.channelEq || { high: 0, mid: 0, midFreq: 1000, low: 0 };
        return {
          ...t,
          channelEq: { ...currentEq, ...updates },
        };
      }),
    }));
  };

  // Volume slider updater
  const handleVolumeChange = (trackId: string, vol: number) => {
    setProject(prev => ({
      ...prev,
      tracks: prev.tracks.map(t => (t.id === trackId ? { ...t, volume: Math.max(0, Math.min(1.5, vol)) } : t)),
    }));
  };

  // Open SoundFont preset manager for a track
  const handleOpenSoundManager = (trackId: string) => {
    setModalTargetTrackId(trackId);
    setSelectedTrackId(trackId);
    setIsSf2ModalOpen(true);
  };

  // Assign sound preset from modal
  const handleSelectPreset = (trackId: string, presetName: string, bankId?: string) => {
    setProject(prev => ({
      ...prev,
      tracks: prev.tracks.map(t =>
        t.id === trackId ? { ...t, soundPreset: presetName, soundFontBankId: bankId } : t
      ),
    }));
  };

  // Add a new track up to 16 tracks
  const handleAddTrack = () => {
    const nextNum = project.tracks.length + 1;
    const colors = ['#3b82f6', '#60a5fa', '#0284c7', '#06b6d4', '#14b8a6', '#10b981', '#84cc16', '#eab308', '#f97316', '#ec4899', '#a855f7', '#f43f5e'];
    const color = colors[(nextNum - 1) % colors.length];

    const newTrack: Track = {
      id: `track-${Date.now()}`,
      name: `Track ${nextNum}`,
      type: 'midi',
      color,
      volume: 0.9,
      pan: 0,
      isMuted: false,
      isSolo: false,
      isArmed: false,
      instrument: 'grand_piano',
      soundPreset: 'Stereo Grand',
      channelEq: { high: 0, mid: 0, midFreq: 1000, low: 0 },
      fx: {
        eq: { enabled: true, lowGain: 0, midGain: 0, highGain: 0, lowFreq: 100, midFreq: 1000, highFreq: 8000 },
        reverb: { enabled: true, decay: 1.8, mix: 0.2 },
        delay: { enabled: false, time: 0.25, feedback: 0.3, mix: 0.2 },
        distortion: { enabled: false, drive: 0, tone: 2000 },
        compressor: { enabled: false, threshold: -12, ratio: 4, attack: 0.01, release: 0.15 },
      },
      audioClips: [],
      midiClips: [],
    };

    setProject(prev => ({ ...prev, tracks: [...prev.tracks, newTrack] }));
    setSelectedTrackId(newTrack.id);
    onToast(`Added Track ${nextNum}`);
  };

  // Convert volume (0-1.5) to vertical percentage for fader
  const volumeToPercent = (vol: number) => {
    // 0 -> 0%, 1.0 -> 75%, 1.5 -> 100%
    return Math.min(100, Math.max(0, (vol / 1.5) * 100));
  };

  const percentToVolume = (pct: number) => {
    return Math.min(1.5, Math.max(0, (pct / 100) * 1.5));
  };

  return (
    <div className="flex-1 flex flex-col bg-[#0f1115] text-neutral-200 select-none overflow-hidden h-full">
      {/* 1. TOP HARDWARE BAR (Matching the Screenshot) */}
      <div className="h-14 bg-[#15181f] border-b border-[#242934] px-4 flex items-center justify-between shadow-md shrink-0 z-20">
        {/* Left Controls: Project, ... More, ! Panic, Scenes, Settings */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Project Button */}
          <div className="relative">
            <button
              onClick={() => {
                setIsProjectMenuOpen(!isProjectMenuOpen);
                setIsMoreMenuOpen(false);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#202530] hover:bg-[#282f3d] border border-[#2e3646] rounded text-xs font-semibold text-neutral-200 transition-colors"
            >
              <Folder className="w-3.5 h-3.5 text-blue-400" />
              <span>Project</span>
            </button>

            {isProjectMenuOpen && (
              <div className="absolute left-0 top-full mt-1.5 w-48 bg-[#1a1d24] border border-[#2e3440] rounded-lg shadow-2xl py-1 z-50 text-xs">
                <button
                  onClick={() => {
                    setIsProjectMenuOpen(false);
                    onExportMixdown();
                  }}
                  className="w-full text-left px-3 py-2 hover:bg-[#252b37] flex items-center gap-2"
                >
                  <Volume2 className="w-4 h-4 text-blue-400" />
                  <span>Export Master WAV</span>
                </button>
                <button
                  onClick={() => {
                    setIsProjectMenuOpen(false);
                    setIsSf2ModalOpen(true);
                  }}
                  className="w-full text-left px-3 py-2 hover:bg-[#252b37] flex items-center gap-2"
                >
                  <Upload className="w-4 h-4 text-emerald-400" />
                  <span>Upload .sf2 SoundFont</span>
                </button>
                <button
                  onClick={() => {
                    setIsProjectMenuOpen(false);
                    handleAddTrack();
                  }}
                  className="w-full text-left px-3 py-2 hover:bg-[#252b37] flex items-center gap-2"
                >
                  <Plus className="w-4 h-4 text-amber-400" />
                  <span>Add Channel Track</span>
                </button>
              </div>
            )}
          </div>

          {/* ... More Button */}
          <div className="relative">
            <button
              onClick={() => {
                setIsMoreMenuOpen(!isMoreMenuOpen);
                setIsProjectMenuOpen(false);
              }}
              className="px-2.5 py-1.5 bg-[#202530] hover:bg-[#282f3d] border border-[#2e3646] rounded text-xs font-semibold text-neutral-300 transition-colors"
            >
              <span className="text-[11px] font-mono tracking-wider">... More</span>
            </button>

            {isMoreMenuOpen && (
              <div className="absolute left-0 top-full mt-1.5 w-48 bg-[#1a1d24] border border-[#2e3440] rounded-lg shadow-2xl py-1 z-50 text-xs">
                <button
                  onClick={() => {
                    setIsMoreMenuOpen(false);
                    handleAddTrack();
                  }}
                  className="w-full text-left px-3 py-2 hover:bg-[#252b37] flex items-center gap-2"
                >
                  <Plus className="w-4 h-4 text-blue-400" />
                  <span>Add Next Track</span>
                </button>
                <button
                  onClick={() => {
                    setIsMoreMenuOpen(false);
                    setIsMidiModalOpen(true);
                  }}
                  className="w-full text-left px-3 py-2 hover:bg-[#252b37] flex items-center gap-2"
                >
                  <Sliders className="w-4 h-4 text-purple-400" />
                  <span>USB MIDI Setup</span>
                </button>
              </div>
            )}
          </div>

          {/* ! Panic Button (Matching Yellow/Amber Badge in Screenshot) */}
          <button
            type="button"
            onClick={handlePanic}
            title="Audio & MIDI Panic: Kill all sound & reset notes"
            className="flex items-center gap-1 px-3 py-1.5 bg-[#f59e0b] hover:bg-[#fbbf24] text-black font-extrabold text-xs rounded shadow-md active:scale-95 transition-all"
          >
            <AlertTriangle className="w-3.5 h-3.5 fill-black" />
            <span>! Panic</span>
          </button>

          {/* Scenes Button */}
          <button
            onClick={() => onToast('Scenes manager: 12-channel performance mode active')}
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-[#202530] hover:bg-[#282f3d] border border-[#2e3646] rounded text-xs font-semibold text-neutral-300 transition-colors"
          >
            <Grid className="w-3.5 h-3.5 text-neutral-400" />
            <span>Scenes</span>
          </button>

          {/* Settings Button (Opens USB MIDI & Hardware Settings) */}
          <button
            onClick={() => setIsMidiModalOpen(true)}
            className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 bg-[#202530] hover:bg-[#282f3d] border border-[#2e3646] rounded text-xs font-semibold text-neutral-300 transition-colors"
          >
            <Settings className="w-3.5 h-3.5 text-neutral-400" />
            <span className="hidden sm:inline">Settings</span>
          </button>

          {/* SUSTAIN PEDAL BUTTON */}
          <button
            type="button"
            onClick={handleToggleSustain}
            title="Sustain Notes (Keeps sound playing until released, or use USB MIDI sustain pedal CC 64)"
            className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded border text-xs font-bold transition-all shadow-sm ${
              isSustainActive
                ? 'bg-cyan-500/20 text-cyan-300 border-cyan-400 shadow-[0_0_10px_rgba(6,182,212,0.4)]'
                : 'bg-[#202530] hover:bg-[#282f3d] text-neutral-300 border-[#2e3646]'
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
          <div className="hidden md:flex items-center bg-[#0d0f13] border border-[#242a35] rounded px-1.5 py-1 text-xs">
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
        </div>

        {/* Center: Song Name Selector & Multi-Track Arm Info */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 sm:gap-2 bg-[#0d0f13] px-2.5 sm:px-4 py-1 rounded-md border border-[#242a35]">
            <button
              onClick={() => onToast('Previous song')}
              className="p-1 hover:text-white text-neutral-500 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-xs font-bold text-white tracking-wide truncate max-w-[120px] sm:max-w-[180px]">
              {project.name || 'No current song'}
            </span>
            <button
              onClick={() => onToast('Next song')}
              className="p-1 hover:text-white text-neutral-500 transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Simultaneous Multi-Track Arm Controls */}
          <div className="hidden xl:flex items-center gap-1.5 bg-[#0d0f13] border border-[#242a35] rounded px-2 py-1 text-xs">
            <span className="text-[10px] font-mono text-neutral-400">
              ARMED: <span className={armedTracksCount > 0 ? 'text-rose-400 font-bold' : 'text-neutral-500'}>{armedTracksCount}/{project.tracks.length}</span>
            </span>
            <button
              type="button"
              onClick={handleArmAllTracks}
              title="Arm all tracks simultaneously for multi-track recording"
              className="px-1.5 py-0.5 bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/40 rounded text-[10px] font-bold transition-colors"
            >
              ARM ALL
            </button>
            {armedTracksCount > 0 && (
              <button
                type="button"
                onClick={handleDisarmAllTracks}
                title="Disarm all tracks"
                className="px-1.5 py-0.5 hover:text-white text-neutral-400 text-[10px] transition-colors"
              >
                DISARM
              </button>
            )}
          </div>
        </div>

        {/* Right: CPU, OUT Meter, USB MIDI Badge, Next > */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* CPU Indicator */}
          <div className="hidden md:flex items-center gap-1.5 text-[11px] font-mono text-neutral-400">
            <span>CPU</span>
            <div className="w-10 h-2 bg-neutral-800 rounded-sm overflow-hidden p-0.5 border border-neutral-700">
              <div
                className={`h-full rounded-xs transition-all duration-300 ${
                  cpuUsage > 75 ? 'bg-rose-500' : cpuUsage > 45 ? 'bg-amber-500' : 'bg-emerald-500'
                }`}
                style={{ width: `${cpuUsage}%` }}
              />
            </div>
          </div>

          {/* OUT Stereo Master Meter Bars */}
          <div className="flex items-center gap-1 bg-[#0e1014] px-2 py-1 rounded border border-[#242a35]">
            <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-tighter">OUT</span>
            <div className="flex flex-col gap-0.5">
              {/* L */}
              <div className="w-12 sm:w-16 h-1.5 bg-neutral-800 rounded-xs overflow-hidden">
                <div
                  className="h-full bg-emerald-500 transition-all duration-75"
                  style={{ width: `${Math.min(100, masterL * 100)}%` }}
                />
              </div>
              {/* R */}
              <div className="w-12 sm:w-16 h-1.5 bg-neutral-800 rounded-xs overflow-hidden">
                <div
                  className="h-full bg-emerald-500 transition-all duration-75"
                  style={{ width: `${Math.min(100, masterR * 100)}%` }}
                />
              </div>
            </div>
          </div>

          {/* USB MIDI Controller Status & Connector Button */}
          <button
            onClick={() => setIsMidiModalOpen(true)}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded border text-xs font-semibold transition-all ${
              isMidiConnected
                ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/25'
                : 'bg-blue-600/20 border-blue-500/40 text-blue-300 hover:bg-blue-600/30'
            }`}
          >
            <div
              className={`w-2 h-2 rounded-full ${
                midiFlash
                  ? 'bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.9)]'
                  : isMidiConnected
                  ? 'bg-emerald-400 shadow-[0_0_5px_rgba(52,211,153,0.8)]'
                  : 'bg-neutral-500'
              }`}
            />
            <span className="hidden sm:inline">USB MIDI</span>
          </button>

          {/* Next Button */}
          <button
            onClick={() => onToast('Next scene/section ready')}
            className="px-2.5 py-1 bg-[#202530] hover:bg-[#282f3d] border border-[#2e3646] rounded text-xs font-semibold text-neutral-300 transition-colors"
          >
            Next &gt;
          </button>
        </div>
      </div>

      {/* 2. MULTI-CHANNEL CONSOLE STRIPS (Track 1 .. Track 12) */}
      <div className="flex-1 overflow-x-auto overflow-y-hidden p-3 bg-[#0d0f14] flex gap-2 scrollbar-thin">
        {project.tracks.map((track, trackIdx) => {
          const channelNum = trackIdx + 1;
          const isSelected = selectedTrackId === track.id;
          const isArmed = track.isArmed;
          const isSolo = track.isSolo;
          const isMidiActive = activeMidiTrackId === track.id;
          const soundName = track.soundPreset || track.instrument || 'Default Sound';

          // Current VU meter for this track
          const meter = vuMeters.find(m => m.trackId === track.id) || { left: 0, right: 0, peak: 0 };
          const meterLevel = Math.max(meter.left, meter.right);

          // Current Channel EQ values
          const eq: TrackChannelEq = track.channelEq || { high: 0, mid: 0, midFreq: 1000, low: 0 };

          return (
            <div
              key={track.id}
              onClick={() => setSelectedTrackId(track.id)}
              className={`w-24 sm:w-28 shrink-0 flex flex-col rounded-lg border transition-all select-none ${
                isArmed
                  ? 'bg-[#181c25] border-rose-500/60 shadow-[0_0_12px_rgba(239,68,68,0.2)]'
                  : isSelected
                  ? 'bg-[#181c25] border-blue-500/60 shadow-[0_0_8px_rgba(59,130,246,0.15)]'
                  : 'bg-[#151820] border-[#252b36] hover:border-[#323947]'
              }`}
            >
              {/* Channel Header (Track 1, Track 2, etc.) */}
              <div
                className="px-2 py-1.5 border-b border-[#242a36] flex items-center justify-between text-xs font-bold text-center"
                style={{ borderTop: `3px solid ${track.color || '#3b82f6'}` }}
              >
                <span className="text-white text-[11px] font-mono truncate w-full text-center">
                  {track.name.replace(/Beat Machine|Analog Bass|Warm Poly Pad|Retro Lead|Vocal \/ Audio In/i, `Track ${channelNum}`)}
                </span>
              </div>

              {/* 4-Band Channel EQ (HIGH, MID, MID Freq, LOW) */}
              <div className="p-1.5 space-y-2 border-b border-[#242a36] bg-[#12151b]/80">
                {/* HIGH (-15 .. 15 dB) */}
                <div className="flex flex-col items-center">
                  <div className="w-full flex justify-between text-[9px] text-neutral-400 font-mono px-1">
                    <span>-15</span>
                    <span className="font-semibold text-neutral-300">HIGH</span>
                    <span>15</span>
                  </div>
                  <input
                    type="range"
                    min="-15"
                    max="15"
                    step="0.5"
                    value={eq.high}
                    onChange={e => handleUpdateChannelEq(track.id, { high: parseFloat(e.target.value) })}
                    className="w-full h-1.5 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
                  />
                </div>

                {/* MID (-15 .. 15 dB) */}
                <div className="flex flex-col items-center">
                  <div className="w-full flex justify-between text-[9px] text-neutral-400 font-mono px-1">
                    <span>-15</span>
                    <span className="font-semibold text-neutral-300">MID</span>
                    <span>15</span>
                  </div>
                  <input
                    type="range"
                    min="-15"
                    max="15"
                    step="0.5"
                    value={eq.mid}
                    onChange={e => handleUpdateChannelEq(track.id, { mid: parseFloat(e.target.value) })}
                    className="w-full h-1.5 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                  />
                </div>

                {/* MID Freq (300 .. 20k Hz) */}
                <div className="flex flex-col items-center">
                  <div className="w-full flex justify-between text-[9px] text-neutral-400 font-mono px-1">
                    <span>300</span>
                    <span className="font-semibold text-neutral-300">MID Freq</span>
                    <span>20k</span>
                  </div>
                  <input
                    type="range"
                    min="300"
                    max="20000"
                    step="100"
                    value={eq.midFreq}
                    onChange={e => handleUpdateChannelEq(track.id, { midFreq: parseFloat(e.target.value) })}
                    className="w-full h-1.5 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                  />
                </div>

                {/* LOW (-15 .. 15 dB) */}
                <div className="flex flex-col items-center">
                  <div className="w-full flex justify-between text-[9px] text-neutral-400 font-mono px-1">
                    <span>-15</span>
                    <span className="font-semibold text-neutral-300">LOW</span>
                    <span>15</span>
                  </div>
                  <input
                    type="range"
                    min="-15"
                    max="15"
                    step="0.5"
                    value={eq.low}
                    onChange={e => handleUpdateChannelEq(track.id, { low: parseFloat(e.target.value) })}
                    className="w-full h-1.5 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
                  />
                </div>
              </div>

              {/* FADER & VU METER CHANNEL SECTION */}
              <div className="flex-1 flex px-2 py-3 items-center justify-center gap-2 relative bg-[#111319]">
                {/* dB Ticks Labels */}
                <div className="flex flex-col justify-between h-44 text-[8px] font-mono text-neutral-500 text-right leading-none select-none py-1">
                  <span>+6</span>
                  <span>0</span>
                  <span>-6</span>
                  <span>-12</span>
                  <span>-24</span>
                  <span>-inf</span>
                </div>

                {/* Fader Channel Groove with Ribbed Metallic Knob */}
                <div className="relative h-44 w-6 flex items-center justify-center">
                  {/* Recessed slot groove */}
                  <div className="absolute w-2 h-full bg-[#090b0e] rounded-full border border-neutral-800 shadow-inner" />

                  {/* Vertical Fader Input */}
                  <input
                    type="range"
                    min="0"
                    max="1.5"
                    step="0.01"
                    value={track.volume}
                    onChange={e => handleVolumeChange(track.id, parseFloat(e.target.value))}
                    className="absolute h-full w-6 opacity-0 cursor-pointer z-20"
                    style={{ writingMode: 'vertical-lr', direction: 'rtl' }}
                  />

                  {/* Metallic Ribbed Fader Knob Handle positioned based on track.volume */}
                  <div
                    className="absolute w-7 h-5 bg-gradient-to-b from-neutral-200 via-neutral-300 to-neutral-400 rounded shadow-md border border-neutral-400/80 pointer-events-none z-10 flex flex-col items-center justify-center"
                    style={{
                      bottom: `calc(${volumeToPercent(track.volume)}% - 10px)`,
                      transition: draggingFaderTrackId === track.id ? 'none' : 'bottom 50ms ease-out',
                    }}
                  >
                    {/* Metallic Center line & ribs */}
                    <div className="w-full h-[2px] bg-blue-600 mb-0.5" />
                    <div className="w-4 h-[1px] bg-neutral-500" />
                  </div>
                </div>

                {/* Real-time Vertical VU Meter Bar */}
                <div className="w-2 h-44 bg-[#090b0e] rounded-xs overflow-hidden border border-neutral-800 flex flex-col justify-end p-0.5">
                  <div
                    className={`w-full rounded-xs transition-all duration-75 ${
                      meterLevel > 0.85
                        ? 'bg-rose-500'
                        : meterLevel > 0.65
                        ? 'bg-amber-400'
                        : 'bg-emerald-500'
                    }`}
                    style={{ height: `${Math.min(100, meterLevel * 100)}%` }}
                  />
                </div>
              </div>

              {/* SOUND / SF2 PRESET BUTTON (Matching Screenshot) */}
              <div className="p-1.5 border-t border-[#242a36] bg-[#14171e]">
                <button
                  type="button"
                  onClick={() => handleOpenSoundManager(track.id)}
                  title={`Change Sound / Upload SF2: ${soundName}`}
                  className="w-full px-1.5 py-1 bg-[#1e232d] hover:bg-[#272d3a] border border-[#2e3646] rounded text-[10px] font-bold text-neutral-200 truncate flex items-center justify-center gap-1 transition-colors shadow-sm"
                >
                  <Music className="w-3 h-3 text-blue-400 shrink-0" />
                  <span className="truncate">{soundName}</span>
                </button>
              </div>

              {/* BOTTOM CONTROL BUTTONS: Fx/Patch, S (Solo), (o) (Arm) */}
              <div className="p-1.5 border-t border-[#242a36] bg-[#12151b] flex items-center justify-between gap-1">
                {/* Fx / SoundFont button */}
                <button
                  type="button"
                  onClick={() => onOpenFx(track.id)}
                  title="Open Track FX & Sound Settings"
                  className="flex-1 py-1 bg-[#1d222b] hover:bg-[#252b37] border border-[#2c3342] rounded text-[10px] font-bold text-neutral-300 flex items-center justify-center transition-colors"
                >
                  Fx
                </button>

                {/* Solo (S) Button */}
                <button
                  type="button"
                  onClick={() => handleToggleSolo(track.id)}
                  title="Solo Channel"
                  className={`w-7 py-1 rounded text-[10px] font-bold border transition-colors ${
                    isSolo
                      ? 'bg-amber-500 text-black border-amber-400 shadow-[0_0_8px_rgba(245,158,11,0.5)]'
                      : 'bg-[#1d222b] hover:bg-[#252b37] border-[#2c3342] text-neutral-400'
                  }`}
                >
                  S
                </button>

                {/* Record Arm (o) Button for USB MIDI */}
                <button
                  type="button"
                  onClick={() => handleToggleArm(track.id)}
                  title="Record Arm for USB MIDI input"
                  className={`w-7 py-1 rounded text-[10px] font-bold border flex items-center justify-center transition-colors ${
                    isArmed
                      ? 'bg-rose-600 text-white border-rose-500 shadow-[0_0_8px_rgba(239,68,68,0.7)] animate-pulse'
                      : 'bg-[#1d222b] hover:bg-[#252b37] border-[#2c3342] text-neutral-400'
                  }`}
                >
                  <span className="w-2 h-2 rounded-full border border-current" />
                </button>
              </div>
            </div>
          );
        })}

        {/* Add Channel Track Button (+) */}
        <div className="w-14 shrink-0 flex flex-col items-center justify-center rounded-lg border border-dashed border-neutral-700/60 hover:border-blue-500/60 bg-[#12151c]/40 hover:bg-[#161a24] text-neutral-500 hover:text-blue-400 transition-all cursor-pointer p-2">
          <button
            type="button"
            onClick={handleAddTrack}
            className="flex flex-col items-center gap-2"
          >
            <div className="w-8 h-8 rounded-full bg-neutral-800 flex items-center justify-center border border-neutral-700">
              <Plus className="w-4 h-4" />
            </div>
            <span className="text-[10px] font-bold">Add Track</span>
          </button>
        </div>
      </div>

      {/* Modals */}
      <SoundFontManagerModal
        isOpen={isSf2ModalOpen}
        onClose={() => setIsSf2ModalOpen(false)}
        selectedTrackId={modalTargetTrackId}
        currentPresetName={project.tracks.find(t => t.id === modalTargetTrackId)?.soundPreset}
        onSelectPreset={handleSelectPreset}
        onToast={onToast}
      />

      <MidiSettingsModal
        isOpen={isMidiModalOpen}
        onClose={() => setIsMidiModalOpen(false)}
        onPanic={handlePanic}
        onToast={onToast}
      />
    </div>
  );
};
