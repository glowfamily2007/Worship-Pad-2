/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  ActiveView,
  AudioClip,
  MidiClip,
  MidiNote,
  Project,
  SnapGrid,
  ToolMode,
  VUMeterData,
} from './types';
import { AudioEngine } from './audio/AudioEngine';
import { createDemoProject } from './audio/demoProject';
import { Header } from './components/Header';
import { TransportBar } from './components/TransportBar';
import { ArrangerView } from './components/arranger/ArrangerView';
import { MixerConsole } from './components/mixer/MixerConsole';
import { TrackConsoleTab } from './components/mixer/TrackConsoleTab';
import { PianoRoll } from './components/pianoroll/PianoRoll';
import { FxRack } from './components/fx/FxRack';
import { VirtualInstrument } from './components/instruments/VirtualInstrument';
import { exportProjectToWav } from './audio/exportWav';

const STORAGE_KEY = 'audio_evolution_studio_project_v1';

export default function App() {
  const audioEngine = useRef(AudioEngine.getInstance()).current;

  // State: Project
  const [project, setProject] = useState<Project>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.tracks) {
          return parsed;
        }
      }
    } catch (e) {
      console.warn('Failed to load project from storage:', e);
    }
    return createDemoProject();
  });

  // Undo / Redo history
  const [history, setHistory] = useState<Project[]>([]);
  const [redoStack, setRedoStack] = useState<Project[]>([]);

  // Views & Tools
  const [activeView, setActiveView] = useState<ActiveView>('track_console');
  const [toolMode, setToolMode] = useState<ToolMode>('pointer');
  const [snapGrid, setSnapGrid] = useState<SnapGrid>('1/16');
  const [zoom, setZoom] = useState<number>(100); // pixels per second

  // Playback & Recording state
  const [isPlaying, setIsPlaying] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [playheadPosition, setPlayheadPosition] = useState(0);
  const [metronome, setMetronome] = useState(false);

  // Selection state
  const [selectedTrackId, setSelectedTrackId] = useState<string | null>(() => {
    return project.tracks[0]?.id || null;
  });
  const [selectedClipId, setSelectedClipId] = useState<string | null>(null);

  // VU Meters
  const [vuMeters, setVuMeters] = useState<VUMeterData[]>([]);
  const [masterL, setMasterL] = useState(0);
  const [masterR, setMasterR] = useState(0);

  // Toast / notification banner
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Active live recording notes map: key `${trackId}_${pitch}` -> { noteId, trackId, startTime }
  const activeRecordingNotesRef = useRef<Map<string, { noteId: string; trackId: string; startTime: number }>>(new Map());

  // Sync Project to AudioEngine whenever project changes
  useEffect(() => {
    audioEngine.syncProject(project);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(project));
    } catch {
      // ignore storage quota errors for large audio buffers
    }
  }, [project, audioEngine]);

  // Metronome sync
  useEffect(() => {
    audioEngine.setMetronome(metronome);
  }, [metronome, audioEngine]);

  // Audio Engine Listeners
  useEffect(() => {
    audioEngine.registerPositionListener(time => {
      setPlayheadPosition(time);
    });

    audioEngine.registerVUMeterListener((meters, l, r) => {
      setVuMeters(meters);
      setMasterL(l);
      setMasterR(r);
    });
  }, [audioEngine]);

  // History state updates
  const updateProjectWithHistory = (updater: React.SetStateAction<Project>) => {
    setHistory(prev => [...prev.slice(-20), project]);
    setRedoStack([]);
    setProject(updater);
  };

  const handleUndo = () => {
    if (history.length === 0) return;
    const previous = history[history.length - 1];
    setHistory(prev => prev.slice(0, prev.length - 1));
    setRedoStack(prev => [...prev, project]);
    setProject(previous);
  };

  const handleRedo = () => {
    if (redoStack.length === 0) return;
    const next = redoStack[redoStack.length - 1];
    setRedoStack(prev => prev.slice(0, prev.length - 1));
    setHistory(prev => [...prev, project]);
    setProject(next);
  };

  // Transport Handlers
  const handlePlay = () => {
    audioEngine.play();
    setIsPlaying(true);
  };

  const handlePause = () => {
    audioEngine.pause();
    setIsPlaying(false);
  };

  const handleStop = () => {
    if (isRecording) {
      handleToggleRecord();
    }
    audioEngine.stop();
    setIsPlaying(false);
    setPlayheadPosition(0);
  };

  const handleRewind = () => {
    audioEngine.seek(0);
    setPlayheadPosition(0);
  };

  const handleStepBack = () => {
    const secondsPerBar = (60 / project.bpm) * (project.timeSignature[0] || 4);
    const newPos = Math.max(0, playheadPosition - secondsPerBar);
    audioEngine.seek(newPos);
    setPlayheadPosition(newPos);
  };

  const handleStepForward = () => {
    const secondsPerBar = (60 / project.bpm) * (project.timeSignature[0] || 4);
    const newPos = playheadPosition + secondsPerBar;
    audioEngine.seek(newPos);
    setPlayheadPosition(newPos);
  };

  const handleSeek = (seconds: number) => {
    audioEngine.seek(seconds);
    setPlayheadPosition(seconds);
  };

  const handleToggleLoop = () => {
    updateProjectWithHistory(prev => ({
      ...prev,
      loopEnabled: !prev.loopEnabled,
    }));
  };

  const handleUpdateLoopRange = (start: number, end: number) => {
    setProject(prev => ({
      ...prev,
      loopStart: start,
      loopEnd: end,
    }));
  };

  // Record Handler (Microphone or Simultaneous Multi-Track MIDI Live Recording)
  const handleToggleRecord = async () => {
    if (!isRecording) {
      // Find all armed tracks
      let armedTracks = project.tracks.filter(t => t.isArmed);
      if (armedTracks.length === 0) {
        // Auto-arm selected track or first track
        const defaultTrack = project.tracks.find(t => t.id === selectedTrackId) || project.tracks[0];
        if (defaultTrack) {
          armedTracks = [defaultTrack];
          setProject(prev => ({
            ...prev,
            tracks: prev.tracks.map(t => (t.id === defaultTrack.id ? { ...t, isArmed: true } : t)),
          }));
        }
      }

      if (armedTracks.length === 0) {
        showToast('Please add and arm at least one track before recording');
        return;
      }

      const audioArmedTrack = armedTracks.find(t => t.type === 'audio');
      if (audioArmedTrack) {
        const started = await audioEngine.startRecording(audioArmedTrack.id);
        if (started) {
          setIsRecording(true);
          setIsPlaying(true);
          showToast(`Microphone recording active on "${audioArmedTrack.name}" (${armedTracks.length} tracks armed)`);
        } else {
          showToast('Microphone access denied or unavailable');
        }
      } else {
        // Multi-track MIDI recording mode: starts playback & records incoming notes into all armed tracks!
        setIsRecording(true);
        handlePlay();
        showToast(
          armedTracks.length > 1
            ? `Recording ARMED on ${armedTracks.length} tracks simultaneously! Play keys or USB MIDI.`
            : `Recording ARMED on "${armedTracks[0].name}". Play keys or USB MIDI.`
        );
      }
    } else {
      // Stop recording
      setIsRecording(false);
      const audioArmedTrack = project.tracks.find(t => t.isArmed && t.type === 'audio');
      if (audioArmedTrack) {
        const newClip = await audioEngine.stopRecording();
        if (newClip) {
          updateProjectWithHistory(prev => ({
            ...prev,
            tracks: prev.tracks.map(t =>
              t.id === audioArmedTrack.id
                ? { ...t, audioClips: [...t.audioClips, newClip] }
                : t
            ),
          }));
          showToast(`Audio take added to "${audioArmedTrack.name}"`);
        }
      } else {
        handlePause();
      }
    }
  };

  // Live Note Start: records the start of a note across all armed tracks (or fallback track)
  const handleLiveNoteStart = (trackId: string, pitch: number, velocity: number) => {
    if (!isRecording) return;
    const armedTracks = project.tracks.filter(t => t.isArmed);
    const targetTracks = armedTracks.length > 0 ? armedTracks : project.tracks.filter(t => t.id === trackId);
    if (targetTracks.length === 0) return;

    const noteStartTime = Math.max(0, playheadPosition);

    setProject(prev => {
      let updatedTracks = [...prev.tracks];
      for (const track of targetTracks) {
        const noteId = `live-note-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
        const key = `${track.id}_${pitch}`;
        activeRecordingNotesRef.current.set(key, { noteId, trackId: track.id, startTime: noteStartTime });

        const newNote: MidiNote = {
          id: noteId,
          pitch,
          startTime: noteStartTime,
          duration: 0.1, // Minimum placeholder until Note Off arrives
          velocity,
        };

        let clip = track.midiClips[0];
        if (!clip) {
          clip = {
            id: `midi-clip-${Date.now()}-${track.id}`,
            trackId: track.id,
            name: `${track.name} Take`,
            startTime: 0,
            duration: Math.max(8, noteStartTime + 2),
            notes: [newNote],
            color: track.color,
          };
          updatedTracks = updatedTracks.map(t => (t.id === track.id ? { ...t, midiClips: [clip] } : t));
        } else {
          const updatedNotes = [...clip.notes, newNote];
          const updatedDuration = Math.max(clip.duration, noteStartTime + 1);
          updatedTracks = updatedTracks.map(t =>
            t.id === track.id
              ? {
                  ...t,
                  midiClips: t.midiClips.map(c =>
                    c.id === clip.id ? { ...c, notes: updatedNotes, duration: updatedDuration } : c
                  ),
                }
              : t
          );
        }
      }
      return { ...prev, tracks: updatedTracks };
    });
  };

  // Live Note End: calculates exact duration from key press to key release!
  const handleLiveNoteEnd = (trackId: string, pitch: number) => {
    if (!isRecording) return;
    const noteEndTime = Math.max(0, playheadPosition);

    setProject(prev => {
      let changed = false;
      const updatedTracks = prev.tracks.map(track => {
        const key = `${track.id}_${pitch}`;
        const activeRecord = activeRecordingNotesRef.current.get(key);
        if (!activeRecord) return track;

        activeRecordingNotesRef.current.delete(key);
        const noteDuration = Math.max(0.12, noteEndTime - activeRecord.startTime);

        const updatedClips = track.midiClips.map(clip => ({
          ...clip,
          duration: Math.max(clip.duration, noteEndTime + 0.5),
          notes: clip.notes.map(n =>
            n.id === activeRecord.noteId ? { ...n, duration: noteDuration } : n
          ),
        }));

        changed = true;
        return { ...track, midiClips: updatedClips };
      });

      return changed ? { ...prev, tracks: updatedTracks } : prev;
    });
  };

  // Backwards-compatible single-trigger recording (for fixed audition pads or quick taps)
  const handleRecordLiveNote = (trackId: string, pitch: number, velocity: number) => {
    handleLiveNoteStart(trackId, pitch, velocity);
    setTimeout(() => {
      handleLiveNoteEnd(trackId, pitch);
    }, 350);
  };

  // Drop audio file onto track
  const handleDropAudioFile = async (trackId: string, file: File, startTime = 0) => {
    try {
      showToast(`Loading audio file: ${file.name}...`);
      const clip = await audioEngine.loadAudioFileToClip(file, trackId, startTime);
      updateProjectWithHistory(prev => ({
        ...prev,
        tracks: prev.tracks.map(t =>
          t.id === trackId ? { ...t, audioClips: [...t.audioClips, clip] } : t
        ),
      }));
      showToast(`Audio clip "${clip.name}" loaded successfully`);
    } catch (e) {
      console.error(e);
      showToast('Error loading audio file: must be a valid WAV, MP3, or OGG');
    }
  };

  // Reset Demo Project
  const handleResetDemo = () => {
    if (confirm('Reload the full demo song? Current changes will be replaced.')) {
      handleStop();
      const demo = createDemoProject();
      setProject(demo);
      setSelectedTrackId(demo.tracks[0]?.id || null);
      showToast('Demo project reloaded');
    }
  };

  // Blank Project
  const handleNewProject = () => {
    if (confirm('Create a new blank project?')) {
      handleStop();
      const blank: Project = {
        id: `proj-${Date.now()}`,
        name: 'Untitled Project',
        bpm: 120,
        timeSignature: [4, 4],
        tracks: [
          {
            id: 'track-audio-1',
            name: 'Audio 1',
            type: 'audio',
            color: '#ef4444',
            volume: 1.0,
            pan: 0,
            isMuted: false,
            isSolo: false,
            isArmed: true,
            instrument: 'grand_piano',
            fx: {
              eq: { enabled: true, lowGain: 0, midGain: 0, highGain: 0, lowFreq: 100, midFreq: 1000, highFreq: 8000 },
              reverb: { enabled: false, decay: 1.5, mix: 0.2 },
              delay: { enabled: false, time: 0.25, feedback: 0.3, mix: 0.2 },
              distortion: { enabled: false, drive: 0, tone: 2000 },
              compressor: { enabled: false, threshold: -12, ratio: 4, attack: 0.01, release: 0.1 },
            },
            audioClips: [],
            midiClips: [],
          },
          {
            id: 'track-synth-1',
            name: 'Synth 1',
            type: 'midi',
            color: '#3b82f6',
            volume: 0.85,
            pan: 0,
            isMuted: false,
            isSolo: false,
            isArmed: false,
            instrument: 'analog_lead',
            fx: {
              eq: { enabled: true, lowGain: 0, midGain: 0, highGain: 0, lowFreq: 100, midFreq: 1000, highFreq: 8000 },
              reverb: { enabled: false, decay: 1.5, mix: 0.2 },
              delay: { enabled: false, time: 0.25, feedback: 0.3, mix: 0.2 },
              distortion: { enabled: false, drive: 0, tone: 2000 },
              compressor: { enabled: false, threshold: -12, ratio: 4, attack: 0.01, release: 0.1 },
            },
            audioClips: [],
            midiClips: [],
          },
        ],
        masterVolume: 0.95,
        loopEnabled: true,
        loopStart: 0,
        loopEnd: 8.0,
      };
      setProject(blank);
      setSelectedTrackId(blank.tracks[0].id);
      showToast('New project created');
    }
  };

  // Keyboard Shortcuts (Space, R, 1-5)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (e.code === 'Space') {
        e.preventDefault();
        if (isPlaying) handlePause();
        else handlePlay();
      } else if (e.key === 'r' || e.key === 'R') {
        e.preventDefault();
        handleToggleRecord();
      } else if (e.key === 'w' || e.key === 'W' || e.key === 'Home') {
        e.preventDefault();
        handleRewind();
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        handleUndo();
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
        e.preventDefault();
        handleRedo();
      } else if (e.key === '1') {
        setActiveView('arranger');
      } else if (e.key === '2') {
        setActiveView('mixer');
      } else if (e.key === '3') {
        setActiveView('pianoroll');
      } else if (e.key === '4') {
        setActiveView('fx');
      } else if (e.key === '5') {
        setActiveView('instruments');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPlaying, isRecording, project, history, redoStack]);

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-[#0f1115] text-[#e2e8f0] font-sans">
      {/* Toast Notification Banner */}
      {toastMessage && (
        <div className="fixed top-3 left-1/2 -translate-x-1/2 z-50 bg-[#1a1d23] border border-[#3b82f6] text-white px-4 py-1.5 rounded shadow-xl text-xs font-semibold tracking-wide flex items-center space-x-2">
          <span className="w-2 h-2 rounded-full bg-[#3b82f6]" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Main Studio Header */}
      <Header
        project={project}
        setProject={updateProjectWithHistory}
        activeView={activeView}
        setActiveView={setActiveView}
        metronome={metronome}
        setMetronome={setMetronome}
        onResetDemo={handleResetDemo}
        onNewProject={handleNewProject}
        onImportAudioFile={file => {
          const firstAudioTrack =
            project.tracks.find(t => t.id === selectedTrackId && t.type === 'audio') ||
            project.tracks.find(t => t.type === 'audio') ||
            project.tracks[0];
          if (firstAudioTrack) {
            handleDropAudioFile(firstAudioTrack.id, file, playheadPosition);
          }
        }}
        canUndo={history.length > 0}
        canRedo={redoStack.length > 0}
        onUndo={handleUndo}
        onRedo={handleRedo}
      />

      {/* Studio Transport Control Bar */}
      <TransportBar
        isPlaying={isPlaying}
        isRecording={isRecording}
        onPlay={handlePlay}
        onPause={handlePause}
        onStop={handleStop}
        onRewind={handleRewind}
        onStepBack={handleStepBack}
        onStepForward={handleStepForward}
        onToggleRecord={handleToggleRecord}
        loopEnabled={project.loopEnabled}
        onToggleLoop={handleToggleLoop}
        playheadPosition={playheadPosition}
        bpm={project.bpm}
        timeSignature={project.timeSignature}
        toolMode={toolMode}
        setToolMode={setToolMode}
        snapGrid={snapGrid}
        setSnapGrid={setSnapGrid}
        zoom={zoom}
        setZoom={setZoom}
      />

      {/* Primary Workspace View Switcher */}
      <main className="flex-1 flex flex-col overflow-hidden relative">
        {activeView === 'track_console' && (
          <TrackConsoleTab
            project={project}
            setProject={updateProjectWithHistory}
            selectedTrackId={selectedTrackId || project.tracks[0]?.id || ''}
            setSelectedTrackId={setSelectedTrackId}
            vuMeters={vuMeters}
            masterL={masterL}
            masterR={masterR}
            onOpenFx={trackId => {
              setSelectedTrackId(trackId);
              setActiveView('fx');
            }}
            onOpenPianoRoll={trackId => {
              setSelectedTrackId(trackId);
              setActiveView('pianoroll');
            }}
            onExportMixdown={async () => {
              try {
                showToast('Rendering 16-bit Master WAV Mixdown...');
                const blob = await exportProjectToWav(project);
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `${project.name.toLowerCase().replace(/\s+/g, '_')}_master.wav`;
                a.click();
                URL.revokeObjectURL(url);
                showToast('Mixdown exported successfully!');
              } catch (e) {
                console.error(e);
                showToast('Export failed: ' + (e as Error).message);
              }
            }}
            onRecordLiveNote={handleRecordLiveNote}
            onLiveNoteStart={handleLiveNoteStart}
            onLiveNoteEnd={handleLiveNoteEnd}
            isRecording={isRecording}
            onToast={showToast}
          />
        )}

        {activeView === 'arranger' && (
          <ArrangerView
            project={project}
            setProject={updateProjectWithHistory}
            playheadPosition={playheadPosition}
            zoom={zoom}
            snapGrid={snapGrid}
            toolMode={toolMode}
            selectedTrackId={selectedTrackId}
            setSelectedTrackId={setSelectedTrackId}
            selectedClipId={selectedClipId}
            setSelectedClipId={setSelectedClipId}
            onSeek={handleSeek}
            onUpdateLoopRange={handleUpdateLoopRange}
            onOpenFx={trackId => {
              setSelectedTrackId(trackId);
              setActiveView('fx');
            }}
            onOpenPianoRoll={trackId => {
              setSelectedTrackId(trackId);
              setActiveView('pianoroll');
            }}
            onDropAudioFile={handleDropAudioFile}
          />
        )}

        {activeView === 'mixer' && (
          <MixerConsole
            project={project}
            setProject={updateProjectWithHistory}
            vuMeters={vuMeters}
            masterL={masterL}
            masterR={masterR}
            onOpenFx={trackId => {
              setSelectedTrackId(trackId);
              setActiveView('fx');
            }}
            onExportMixdown={async () => {
              try {
                showToast('Rendering 16-bit Master WAV Mixdown...');
                const blob = await exportProjectToWav(project);
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `${project.name.toLowerCase().replace(/\s+/g, '_')}_master.wav`;
                a.click();
                URL.revokeObjectURL(url);
                showToast('Mixdown exported successfully!');
              } catch (e) {
                console.error(e);
                showToast('Export failed: ' + (e as Error).message);
              }
            }}
          />
        )}

        {activeView === 'pianoroll' && (
          <PianoRoll
            project={project}
            setProject={updateProjectWithHistory}
            selectedTrackId={selectedTrackId}
            setSelectedTrackId={setSelectedTrackId}
            onAuditionNote={(trackId, pitch) => {
              audioEngine.auditionNote(trackId, pitch, 0.4);
            }}
          />
        )}

        {activeView === 'fx' && (
          <FxRack
            project={project}
            setProject={updateProjectWithHistory}
            selectedTrackId={selectedTrackId}
            setSelectedTrackId={setSelectedTrackId}
          />
        )}

        {activeView === 'instruments' && (
          <VirtualInstrument
            project={project}
            selectedTrackId={selectedTrackId}
            setSelectedTrackId={setSelectedTrackId}
            onAuditionNote={(trackId, pitch, duration, vel) => {
              audioEngine.auditionNote(trackId, pitch, duration, vel);
            }}
            onRecordLiveNote={handleRecordLiveNote}
            onLiveNoteStart={handleLiveNoteStart}
            onLiveNoteEnd={handleLiveNoteEnd}
            isRecording={isRecording}
          />
        )}
      </main>

      {/* Bottom Status / Shortcut Bar */}
      <footer className="h-6 bg-[#16191e] border-t border-[#2d333d] px-3 flex items-center justify-between text-[10px] text-[#64748b] font-mono select-none">
        <div className="flex items-center space-x-3">
          <span className="text-[#94a3b8] font-bold">SHORTCUTS:</span>
          <span><kbd className="bg-[#2d333d] px-1 py-0.5 rounded text-white font-sans">Space</kbd> Play/Pause</span>
          <span><kbd className="bg-[#2d333d] px-1 py-0.5 rounded text-white font-sans">R</kbd> Record</span>
          <span><kbd className="bg-[#2d333d] px-1 py-0.5 rounded text-white font-sans">W</kbd> Rewind</span>
          <span><kbd className="bg-[#2d333d] px-1 py-0.5 rounded text-white font-sans">1-5</kbd> Views</span>
        </div>

        <div className="flex items-center space-x-2">
          <span>TRACKS: {project.tracks.length}</span>
          <span>•</span>
          <span>BPM: {project.bpm}</span>
          <span>•</span>
          <span className="text-[#38bdf8] font-semibold">Audio Evolution DAW v3.8</span>
        </div>
      </footer>
    </div>
  );
}
