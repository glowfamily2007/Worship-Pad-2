import React, { useRef } from 'react';
import { Plus, Mic, Music, Disc } from 'lucide-react';
import { AudioClip, MidiClip, Project, SnapGrid, ToolMode, Track, InstrumentType } from '../../types';
import { TimelineRuler } from './TimelineRuler';
import { TrackHeader } from './TrackHeader';
import { TrackLane } from './TrackLane';
import { createDefaultTrackFx } from '../../audio/demoProject';

interface ArrangerViewProps {
  project: Project;
  setProject: React.Dispatch<React.SetStateAction<Project>>;
  playheadPosition: number;
  zoom: number;
  snapGrid: SnapGrid;
  toolMode: ToolMode;
  selectedTrackId: string | null;
  setSelectedTrackId: (id: string | null) => void;
  selectedClipId: string | null;
  setSelectedClipId: (id: string | null) => void;
  onSeek: (seconds: number) => void;
  onUpdateLoopRange: (start: number, end: number) => void;
  onOpenFx: (trackId: string) => void;
  onOpenPianoRoll: (trackId: string) => void;
  onDropAudioFile: (trackId: string, file: File, startTime: number) => void;
}

export const ArrangerView: React.FC<ArrangerViewProps> = ({
  project,
  setProject,
  playheadPosition,
  zoom,
  snapGrid,
  toolMode,
  selectedTrackId,
  setSelectedTrackId,
  selectedClipId,
  setSelectedClipId,
  onSeek,
  onUpdateLoopRange,
  onOpenFx,
  onOpenPianoRoll,
  onDropAudioFile,
}) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Compute maximum project duration
  let maxDuration = 16; // minimum 16 seconds displayed
  project.tracks.forEach(t => {
    t.audioClips.forEach(c => (maxDuration = Math.max(maxDuration, c.startTime + c.duration + 4)));
    t.midiClips.forEach(c => (maxDuration = Math.max(maxDuration, c.startTime + c.duration + 4)));
  });

  const totalWidth = maxDuration * zoom;

  // Track operations
  const handleUpdateTrack = (trackId: string, updated: Partial<Track>) => {
    setProject(prev => ({
      ...prev,
      tracks: prev.tracks.map(t => (t.id === trackId ? { ...t, ...updated } : t)),
    }));
  };

  const handleDeleteTrack = (trackId: string) => {
    setProject(prev => ({
      ...prev,
      tracks: prev.tracks.filter(t => t.id !== trackId),
    }));
  };

  const handleAddTrack = (type: 'audio' | 'midi' | 'drum') => {
    const colors = ['#ec4899', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#06b6d4'];
    const randomColor = colors[Math.floor(Math.random() * colors.length)];

    let defaultInst: InstrumentType = 'grand_piano';
    let defaultName = 'New Track';
    if (type === 'audio') {
      defaultName = `Audio ${project.tracks.filter(t => t.type === 'audio').length + 1}`;
    } else if (type === 'drum') {
      defaultInst = 'drum_kit';
      defaultName = `Drum ${project.tracks.filter(t => t.type === 'drum').length + 1}`;
    } else {
      defaultInst = 'analog_lead';
      defaultName = `Synth ${project.tracks.filter(t => t.type === 'midi').length + 1}`;
    }

    const newTrack: Track = {
      id: `track-${Date.now()}`,
      name: defaultName,
      type,
      color: randomColor,
      volume: 0.9,
      pan: 0,
      isMuted: false,
      isSolo: false,
      isArmed: type === 'audio',
      instrument: defaultInst,
      fx: createDefaultTrackFx(),
      audioClips: [],
      midiClips: [],
    };

    setProject(prev => ({
      ...prev,
      tracks: [...prev.tracks, newTrack],
    }));
    setSelectedTrackId(newTrack.id);
  };

  // Clip operations
  const handleUpdateAudioClip = (clipId: string, updated: Partial<AudioClip>) => {
    setProject(prev => ({
      ...prev,
      tracks: prev.tracks.map(t => ({
        ...t,
        audioClips: t.audioClips.map(c => (c.id === clipId ? { ...c, ...updated } : c)),
      })),
    }));
  };

  const handleUpdateMidiClip = (clipId: string, updated: Partial<MidiClip>) => {
    setProject(prev => ({
      ...prev,
      tracks: prev.tracks.map(t => ({
        ...t,
        midiClips: t.midiClips.map(c => (c.id === clipId ? { ...c, ...updated } : c)),
      })),
    }));
  };

  const handleDeleteClip = (clipId: string) => {
    setProject(prev => ({
      ...prev,
      tracks: prev.tracks.map(t => ({
        ...t,
        audioClips: t.audioClips.filter(c => c.id !== clipId),
        midiClips: t.midiClips.filter(c => c.id !== clipId),
      })),
    }));
    setSelectedClipId(null);
  };

  const handleSplitClip = (clipId: string, splitTime: number) => {
    setProject(prev => {
      let updatedTracks = [...prev.tracks];

      // Check audio clips
      for (let t = 0; t < updatedTracks.length; t++) {
        const audioClip = updatedTracks[t].audioClips.find(c => c.id === clipId);
        if (audioClip) {
          const firstPartDuration = splitTime - audioClip.startTime;
          const secondPartDuration = audioClip.duration - firstPartDuration;

          const clip1: AudioClip = {
            ...audioClip,
            duration: firstPartDuration,
          };
          const clip2: AudioClip = {
            ...audioClip,
            id: `clip-${Date.now()}`,
            startTime: splitTime,
            duration: secondPartDuration,
            offset: audioClip.offset + firstPartDuration,
          };

          updatedTracks[t] = {
            ...updatedTracks[t],
            audioClips: updatedTracks[t].audioClips.map(c => (c.id === clipId ? clip1 : c)).concat(clip2),
          };
          break;
        }

        // Check midi clips
        const midiClip = updatedTracks[t].midiClips.find(c => c.id === clipId);
        if (midiClip) {
          const firstPartDuration = splitTime - midiClip.startTime;
          const secondPartDuration = midiClip.duration - firstPartDuration;

          const notes1 = midiClip.notes.filter(n => n.startTime < firstPartDuration);
          const notes2 = midiClip.notes
            .filter(n => n.startTime >= firstPartDuration)
            .map(n => ({ ...n, id: `n-${Date.now()}-${Math.random()}`, startTime: n.startTime - firstPartDuration }));

          const clip1: MidiClip = {
            ...midiClip,
            duration: firstPartDuration,
            notes: notes1,
          };
          const clip2: MidiClip = {
            ...midiClip,
            id: `clip-${Date.now()}`,
            startTime: splitTime,
            duration: secondPartDuration,
            notes: notes2,
          };

          updatedTracks[t] = {
            ...updatedTracks[t],
            midiClips: updatedTracks[t].midiClips.map(c => (c.id === clipId ? clip1 : c)).concat(clip2),
          };
          break;
        }
      }

      return { ...prev, tracks: updatedTracks };
    });
  };

  const playheadLeft = playheadPosition * zoom;

  return (
    <div className="flex-1 flex flex-col bg-[#0f1115] overflow-hidden select-none">
      {/* Arranger Split View: Fixed Left Headers & Horizontally Scrollable Lanes */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Column: Track Headers */}
        <div className="w-64 min-w-64 flex flex-col border-r border-[#2d333d] bg-[#1a1d23] z-10 shadow-lg">
          {/* Top corner above track headers */}
          <div className="h-8 border-b border-[#2d333d] px-3 flex items-center justify-between text-[10px] font-bold uppercase tracking-[0.2em] text-[#64748b] bg-[#16191e]">
            <span>TRACKS ({project.tracks.length})</span>
            <span className="text-[#64748b] font-mono">CH</span>
          </div>

          {/* Track Headers List */}
          <div className="flex-1 overflow-y-auto overflow-x-hidden">
            {project.tracks.map(track => (
              <TrackHeader
                key={track.id}
                track={track}
                isSelected={selectedTrackId === track.id}
                onSelect={() => setSelectedTrackId(track.id)}
                onUpdateTrack={updated => handleUpdateTrack(track.id, updated)}
                onDeleteTrack={() => handleDeleteTrack(track.id)}
                onOpenFx={() => onOpenFx(track.id)}
                onOpenPianoRoll={() => onOpenPianoRoll(track.id)}
              />
            ))}

            {/* Add Track Action Buttons */}
            <div className="p-3 flex flex-col gap-2 border-t border-[#2d333d]">
              <span className="text-[10px] uppercase font-bold text-[#64748b] tracking-[0.15em]">
                ADD TRACK
              </span>
              <div className="grid grid-cols-3 gap-1.5">
                <button
                  onClick={() => handleAddTrack('audio')}
                  className="px-2 py-1.5 rounded bg-[#2d333d] hover:bg-[#3d4450] text-[#f87171] hover:text-white border border-[#ef444433] text-[10px] font-medium flex items-center justify-center gap-1 transition-all"
                  title="Add Audio Track for microphone recording or audio files"
                >
                  <Mic className="w-3 h-3 text-[#ef4444]" />
                  <span>Audio</span>
                </button>

                <button
                  onClick={() => handleAddTrack('midi')}
                  className="px-2 py-1.5 rounded bg-[#2d333d] hover:bg-[#3d4450] text-[#60a5fa] hover:text-white border border-[#3b82f633] text-[10px] font-medium flex items-center justify-center gap-1 transition-all"
                  title="Add MIDI Synth Track"
                >
                  <Music className="w-3 h-3 text-[#3b82f6]" />
                  <span>Synth</span>
                </button>

                <button
                  onClick={() => handleAddTrack('drum')}
                  className="px-2 py-1.5 rounded bg-[#2d333d] hover:bg-[#3d4450] text-[#34d399] hover:text-white border border-[#10b98133] text-[10px] font-medium flex items-center justify-center gap-1 transition-all"
                  title="Add Beat / Drum Kit Track"
                >
                  <Disc className="w-3 h-3 text-[#10b981]" />
                  <span>Drum</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Right Scrollable Area: Timeline Ruler + Track Lanes */}
        <div
          ref={scrollContainerRef}
          className="flex-1 flex flex-col overflow-x-auto overflow-y-auto relative bg-[#0f1115]"
        >
          {/* Top Timeline Ruler */}
          <div className="sticky top-0 z-20">
            <TimelineRuler
              duration={maxDuration}
              bpm={project.bpm}
              timeSignature={project.timeSignature}
              zoom={zoom}
              playheadPosition={playheadPosition}
              onSeek={onSeek}
              loopEnabled={project.loopEnabled}
              loopStart={project.loopStart}
              loopEnd={project.loopEnd}
              onUpdateLoopRange={onUpdateLoopRange}
            />
          </div>

          {/* Lanes Container with Playhead Needle Overlay */}
          <div className="relative min-w-max">
            {/* Global Playhead Vertical Line */}
            <div
              className="absolute top-0 bottom-0 pointer-events-none z-30 w-px bg-[#ef4444] shadow-[0_0_8px_rgba(239,68,68,0.6)]"
              style={{ left: `${playheadLeft}px` }}
            />

            {/* Render Each Track Lane */}
            {project.tracks.map(track => (
              <TrackLane
                key={track.id}
                track={track}
                zoom={zoom}
                bpm={project.bpm}
                timeSignature={project.timeSignature}
                snapGrid={snapGrid}
                toolMode={toolMode}
                playheadPosition={playheadPosition}
                totalDuration={maxDuration}
                selectedClipId={selectedClipId}
                onSelectClip={setSelectedClipId}
                onUpdateAudioClip={handleUpdateAudioClip}
                onUpdateMidiClip={handleUpdateMidiClip}
                onDeleteClip={handleDeleteClip}
                onSplitClip={handleSplitClip}
                onDuplicateClip={() => {}}
                onDropAudioFile={(file, startTime) => onDropAudioFile(track.id, file, startTime)}
                onSeek={onSeek}
              />
            ))}

            {/* Empty space filler for timeline drag/drop */}
            <div
              className="h-32 border-b border-[#2d333d]/50 flex items-center justify-center text-[#64748b] text-xs font-mono"
              style={{ width: `${totalWidth}px` }}
            >
              Drop audio files here or click tracks to record
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
