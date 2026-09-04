import React, { useState, useEffect } from 'react';
import { Sliders, CheckCircle2, AlertOctagon, RefreshCw, X, Radio, Activity } from 'lucide-react';
import { MidiManager, MidiDeviceInfo } from '../../audio/midiManager';

interface MidiSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPanic: () => void;
  onToast: (msg: string) => void;
}

export const MidiSettingsModal: React.FC<MidiSettingsModalProps> = ({
  isOpen,
  onClose,
  onPanic,
  onToast,
}) => {
  const midiManager = MidiManager.getInstance();
  const [devices, setDevices] = useState<MidiDeviceInfo[]>(midiManager.getDevices());
  const [selectedDevice, setSelectedDevice] = useState<string>(midiManager.getSelectedDeviceId());
  const [isSupported, setIsSupported] = useState<boolean>(midiManager.getIsSupported());
  const [isConnected, setIsConnected] = useState<boolean>(midiManager.getIsConnected());
  const [lastActivity, setLastActivity] = useState<string>('Listening for USB MIDI input...');
  const [activeKeys, setActiveKeys] = useState<number[]>([]);

  useEffect(() => {
    if (!isOpen) return;

    setDevices(midiManager.getDevices());
    setIsConnected(midiManager.getIsConnected());
    setSelectedDevice(midiManager.getSelectedDeviceId());

    const unsubDevices = midiManager.onDevicesChanged(newDevices => {
      setDevices(newDevices);
      setIsConnected(true);
    });

    const unsubActivity = midiManager.onActivity(act => {
      setLastActivity(`${new Date().toLocaleTimeString()}: ${act.info}`);
    });

    const unsubNoteOn = midiManager.onNoteOn((pitch: number) => {
      setActiveKeys(prev => (prev.includes(pitch) ? prev : [...prev, pitch]));
    });

    const unsubNoteOff = midiManager.onNoteOff((pitch: number) => {
      setActiveKeys(prev => prev.filter(p => p !== pitch));
    });

    return () => {
      unsubDevices();
      unsubActivity();
      unsubNoteOn();
      unsubNoteOff();
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleConnectMidi = async () => {
    const success = await midiManager.init();
    if (success) {
      setIsConnected(true);
      setDevices(midiManager.getDevices());
      onToast('Connected to Web MIDI API & USB Controller System');
    } else {
      onToast('Could not access Web MIDI. Ensure your browser supports Web MIDI and permissions are granted.');
    }
  };

  const handleSelectDevice = (id: string) => {
    setSelectedDevice(id);
    midiManager.setSelectedDeviceId(id);
    onToast(`USB MIDI Input set to: ${id === 'all' ? 'All Devices (Omni)' : id}`);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in duration-150">
      <div className="relative w-full max-w-lg bg-[#1a1d24] border border-[#2e3440] rounded-xl shadow-2xl flex flex-col overflow-hidden text-neutral-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#282e3a] bg-[#14171d]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white tracking-wide">
                USB MIDI & Hardware Controller
              </h2>
              <p className="text-xs text-neutral-400">
                Configure plugged-in USB keyboards, controllers & MIDI routing
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

        {/* Content */}
        <div className="p-6 space-y-5">
          {/* Status & Connect button */}
          <div className="flex items-center justify-between p-3.5 bg-[#14171d] rounded-lg border border-[#282e3a]">
            <div className="flex items-center gap-2.5">
              <div
                className={`w-3 h-3 rounded-full ${
                  isConnected ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.7)]' : 'bg-neutral-600'
                }`}
              />
              <div>
                <div className="text-xs font-semibold text-white">
                  {isConnected ? 'Web MIDI Engine Active' : 'MIDI Disconnected'}
                </div>
                <div className="text-[11px] text-neutral-400">
                  {isSupported ? 'Browser Web MIDI API is supported' : 'Web MIDI is not supported in this browser'}
                </div>
              </div>
            </div>

            <button
              onClick={handleConnectMidi}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded text-xs font-semibold shadow flex items-center gap-1.5 transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>{isConnected ? 'Refresh Devices' : 'Connect USB MIDI'}</span>
            </button>
          </div>

          {/* Connected USB Devices List */}
          <div>
            <label className="block text-xs font-medium text-neutral-400 mb-2">
              Detected USB MIDI Devices:
            </label>
            <div className="space-y-2">
              {/* Omni option */}
              <div
                onClick={() => handleSelectDevice('all')}
                className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-all ${
                  selectedDevice === 'all'
                    ? 'bg-blue-600/20 border-blue-500 text-white'
                    : 'bg-[#1e222b] hover:bg-[#232833] border-[#2a313d] text-neutral-300'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Radio className={`w-4 h-4 ${selectedDevice === 'all' ? 'text-blue-400' : 'text-neutral-500'}`} />
                  <div>
                    <div className="text-xs font-semibold">All Connected USB MIDI Devices (Omni)</div>
                    <div className="text-[10px] text-neutral-400">Accepts notes from any plugged-in keyboard or pad</div>
                  </div>
                </div>
                {selectedDevice === 'all' && <CheckCircle2 className="w-4 h-4 text-blue-400" />}
              </div>

              {devices.length === 0 ? (
                <div className="p-3 bg-[#161920] border border-dashed border-neutral-700/50 rounded-lg text-center text-xs text-neutral-500">
                  No USB hardware controllers detected yet. Plug in any USB MIDI keyboard or launch a virtual MIDI port, then click "Refresh Devices".
                </div>
              ) : (
                devices.map(dev => (
                  <div
                    key={dev.id}
                    onClick={() => handleSelectDevice(dev.id)}
                    className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-all ${
                      selectedDevice === dev.id
                        ? 'bg-blue-600/20 border-blue-500 text-white'
                        : 'bg-[#1e222b] hover:bg-[#232833] border-[#2a313d] text-neutral-300'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <Radio className={`w-4 h-4 ${selectedDevice === dev.id ? 'text-blue-400' : 'text-neutral-500'}`} />
                      <div>
                        <div className="text-xs font-semibold text-white">{dev.name}</div>
                        <div className="text-[10px] text-neutral-400">{dev.manufacturer || 'USB MIDI Interface'}</div>
                      </div>
                    </div>
                    {selectedDevice === dev.id && <CheckCircle2 className="w-4 h-4 text-blue-400" />}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Live MIDI Activity Monitor */}
          <div className="p-3 bg-[#14171d] rounded-lg border border-[#262c37] space-y-2">
            <div className="flex items-center justify-between text-xs text-neutral-400">
              <span className="flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
                Live MIDI Traffic Monitor:
              </span>
              <span className="font-mono text-[10px] text-emerald-400">
                {activeKeys.length > 0 ? `${activeKeys.length} keys down` : 'Idle'}
              </span>
            </div>
            <div className="font-mono text-xs text-neutral-300 bg-[#0e1014] p-2 rounded border border-neutral-800 truncate">
              {lastActivity}
            </div>
          </div>

          {/* Panic Kill Switch */}
          <div className="flex items-center justify-between p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg">
            <div>
              <div className="text-xs font-semibold text-amber-300 flex items-center gap-1.5">
                <AlertOctagon className="w-4 h-4" />
                Audio & MIDI Panic
              </div>
              <div className="text-[10px] text-neutral-400">
                Instantly cuts all sound, silences hanging notes, and sends MIDI All Notes Off
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                onPanic();
                onToast('Panic: Sent All Notes Off & silenced all voices');
              }}
              className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-black font-bold rounded text-xs transition-colors shadow"
            >
              ! Panic
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-[#14171d] border-t border-[#262c37] flex items-center justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-white rounded-md font-medium text-xs transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
