import React, { useState, useRef } from 'react';
import { Upload, Music, Volume2, Check, X, FileAudio, AlertCircle, Sparkles } from 'lucide-react';
import { SoundFontEngine, SoundPreset, BUILTIN_SOUNDFONT_PRESETS } from '../../audio/sf2Engine';
import { AudioEngine } from '../../audio/AudioEngine';

interface SoundFontManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedTrackId: string;
  currentPresetName?: string;
  onSelectPreset: (trackId: string, presetName: string, bankId?: string) => void;
  onToast: (msg: string) => void;
}

export const SoundFontManagerModal: React.FC<SoundFontManagerModalProps> = ({
  isOpen,
  onClose,
  selectedTrackId,
  currentPresetName,
  onSelectPreset,
  onToast,
}) => {
  const [activeCategory, setActiveCategory] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [previewingId, setPreviewingId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const sf2Engine = SoundFontEngine.getInstance();
  const audioEngine = AudioEngine.getInstance();
  const allPresets = sf2Engine.getAllPresets();
  const uploadedBanks = sf2Engine.getUploadedBanks();

  if (!isOpen) return null;

  const categories = ['All', 'Uploaded SF2', 'Piano', 'Organ', 'Guitar', 'Bass', 'Strings', 'Brass', 'Choir', 'Synth', 'Drums'];

  const filteredPresets = allPresets.filter(preset => {
    if (activeCategory === 'Uploaded SF2' && !preset.isCustomSf2) return false;
    if (activeCategory !== 'All' && activeCategory !== 'Uploaded SF2' && preset.category !== activeCategory) {
      return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        preset.name.toLowerCase().includes(q) ||
        preset.bankName.toLowerCase().includes(q) ||
        preset.category.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.sf2')) {
      setUploadError('Please select a valid .sf2 (SoundFont 2) binary file.');
      return;
    }

    try {
      setIsUploading(true);
      setUploadError(null);
      const ctx = audioEngine.getContext();
      const bank = await sf2Engine.loadSf2File(file, ctx);
      setIsUploading(false);
      onToast(`Loaded SF2: "${bank.bankName}" with ${bank.presets.length} presets!`);
      setActiveCategory('Uploaded SF2');

      // If presets exist, auto-select first preset for the track
      if (bank.presets.length > 0 && selectedTrackId) {
        onSelectPreset(selectedTrackId, bank.presets[0].name, bank.id);
      }
    } catch (err) {
      console.error(err);
      setIsUploading(false);
      setUploadError((err as Error).message || 'Failed to parse .sf2 file');
    }
  };

  const handleAudition = (preset: SoundPreset) => {
    setPreviewingId(preset.id);
    const ctx = audioEngine.getContext();
    // Audition C4 (pitch 60)
    sf2Engine.playNote(ctx, ctx.destination, preset.id, 60, ctx.currentTime, 0.6, 0.85);
    setTimeout(() => {
      setPreviewingId(null);
    }, 600);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in duration-150">
      <div className="relative w-full max-w-2xl bg-[#1a1d24] border border-[#2e3440] rounded-xl shadow-2xl flex flex-col max-h-[85vh] overflow-hidden text-neutral-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#282e3a] bg-[#14171d]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-blue-500/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
              <Music className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white tracking-wide">
                SoundFont (SF2) & Instrument Library
              </h2>
              <p className="text-xs text-neutral-400">
                Choose a sound preset or upload custom .sf2 SoundFont files
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-neutral-800 text-neutral-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* SF2 File Upload Drag & Drop Banner */}
        <div className="p-4 bg-[#1e222b] border-b border-[#2a303c]">
          <div
            onClick={() => fileInputRef.current?.click()}
            className="group cursor-pointer border border-dashed border-blue-500/40 hover:border-blue-400 bg-blue-500/5 hover:bg-blue-500/10 rounded-lg p-3.5 flex items-center justify-between transition-all"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-md bg-blue-600/20 border border-blue-500/40 flex items-center justify-center text-blue-400 group-hover:scale-105 transition-transform">
                <Upload className="w-4 h-4" />
              </div>
              <div>
                <div className="text-sm font-medium text-blue-300 flex items-center gap-2">
                  <span>Upload .sf2 SoundFont File</span>
                  <span className="text-[10px] bg-blue-500/20 text-blue-300 px-1.5 py-0.5 rounded font-mono">
                    SF2 Format
                  </span>
                </div>
                <div className="text-xs text-neutral-400">
                  Drop any SoundFont 2 (.sf2) soundbank here to load custom instrument samples
                </div>
              </div>
            </div>
            <button
              type="button"
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded text-xs font-semibold shadow-md flex items-center gap-1.5 transition-colors"
            >
              <FileAudio className="w-3.5 h-3.5" />
              <span>Browse File</span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".sf2"
              onChange={handleFileUpload}
              className="hidden"
            />
          </div>

          {isUploading && (
            <div className="mt-2 text-xs text-blue-400 flex items-center gap-2 animate-pulse">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Parsing binary SoundFont chunks and decoding 16-bit PCM samples...</span>
            </div>
          )}

          {uploadError && (
            <div className="mt-2 text-xs text-rose-400 flex items-center gap-2">
              <AlertCircle className="w-3.5 h-3.5" />
              <span>{uploadError}</span>
            </div>
          )}

          {uploadedBanks.length > 0 && (
            <div className="mt-2.5 flex items-center gap-2 overflow-x-auto text-[11px] text-neutral-400">
              <span className="text-neutral-500">Loaded Banks:</span>
              {uploadedBanks.map(b => (
                <span
                  key={b.id}
                  className="bg-neutral-800 border border-neutral-700 px-2 py-0.5 rounded text-neutral-300 flex items-center gap-1.5 whitespace-nowrap"
                >
                  <FileAudio className="w-3 h-3 text-blue-400" />
                  {b.bankName} ({b.presets.length} presets)
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Search & Category Filter Bar */}
        <div className="px-4 py-3 bg-[#161920] border-b border-[#262c37] flex flex-col sm:flex-row gap-2.5 items-center justify-between">
          {/* Category pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0 scrollbar-none">
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`px-2.5 py-1 rounded-md text-xs font-medium whitespace-nowrap transition-colors ${
                  activeCategory === cat
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-[#202530] text-neutral-400 hover:text-neutral-200 hover:bg-[#282f3d]'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Search input */}
          <input
            type="text"
            placeholder="Search presets..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full sm:w-48 bg-[#1f242e] border border-[#303746] rounded-md px-3 py-1 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-blue-500"
          />
        </div>

        {/* Preset List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-1.5 min-h-[260px] max-h-[380px]">
          {filteredPresets.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-neutral-500">
              <Music className="w-8 h-8 mb-2 opacity-40" />
              <p className="text-sm">No sound presets found</p>
              <p className="text-xs text-neutral-600">Try selecting another category or uploading an .sf2 bank</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {filteredPresets.map(preset => {
                const isSelected = currentPresetName === preset.name;
                const isAuditioning = previewingId === preset.id;

                return (
                  <div
                    key={preset.id}
                    onClick={() => {
                      onSelectPreset(selectedTrackId, preset.name, preset.bankId);
                      onToast(`Assigned sound "${preset.name}" to track`);
                    }}
                    className={`flex items-center justify-between p-2.5 rounded-lg border cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-blue-600/20 border-blue-500 text-white'
                        : 'bg-[#1e222b] hover:bg-[#242934] border-[#2b3240] text-neutral-300'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 overflow-hidden">
                      <div
                        className={`w-7 h-7 rounded flex items-center justify-center text-xs font-mono shrink-0 ${
                          preset.isCustomSf2
                            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                            : 'bg-neutral-800 text-neutral-400 border border-neutral-700'
                        }`}
                      >
                        {preset.isCustomSf2 ? 'SF2' : preset.presetNumber.toString().padStart(2, '0')}
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-semibold truncate flex items-center gap-1.5">
                          <span>{preset.name}</span>
                          {isSelected && <Check className="w-3.5 h-3.5 text-blue-400 shrink-0" />}
                        </div>
                        <div className="text-[10px] text-neutral-400 truncate">
                          {preset.bankName} • {preset.category}
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={e => {
                        e.stopPropagation();
                        handleAudition(preset);
                      }}
                      title="Audition Sound (Middle C)"
                      className={`p-1.5 rounded-md hover:bg-neutral-700 transition-colors shrink-0 ${
                        isAuditioning ? 'text-amber-400 animate-pulse' : 'text-neutral-400 hover:text-white'
                      }`}
                    >
                      <Volume2 className="w-4 h-4" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-[#14171d] border-t border-[#262c37] flex items-center justify-between text-xs text-neutral-400">
          <div>
            <span>Presets available: </span>
            <span className="font-semibold text-neutral-200">{filteredPresets.length}</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-white rounded-md font-medium transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
