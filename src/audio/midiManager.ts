// USB MIDI Controller and Hardware Interface Manager
export interface MidiDeviceInfo {
  id: string;
  name: string;
  manufacturer: string;
  state: 'connected' | 'disconnected';
}

export type NoteOnCallback = (pitch: number, velocity: number, channel: number) => void;
export type NoteOffCallback = (pitch: number, channel: number) => void;
export type ControlChangeCallback = (controller: number, value: number, channel: number) => void;
export type ActivityCallback = (data: { type: 'note' | 'cc'; info: string; time: number }) => void;

// Fallback types for Web MIDI API in standard TypeScript environments
type WebMidiInput = {
  id: string;
  name?: string;
  manufacturer?: string;
  state?: string;
  onmidimessage?: ((e: { data: Uint8Array }) => void) | null;
};

type WebMidiAccess = {
  inputs: {
    values: () => IterableIterator<WebMidiInput>;
  };
  outputs?: {
    values: () => IterableIterator<{
      send: (data: number[]) => void;
    }>;
  };
  onstatechange?: (() => void) | null;
};

export class MidiManager {
  private static instance: MidiManager | null = null;
  private midiAccess: WebMidiAccess | null = null;
  private isSupported = false;
  private isConnected = false;
  private devices: MidiDeviceInfo[] = [];
  private selectedDeviceId: string = 'all'; // 'all' or specific input device ID

  // Active note tracking for sustain pedal and panic
  private activeNotes: Set<number> = new Set();
  private isSustainActive = false;
  private sustainedNotes: Set<number> = new Set();
  private transposeSemitones = 0;
  private rawToTransposedPitch: Map<number, number> = new Map();

  // Listeners
  private noteOnListeners: Set<NoteOnCallback> = new Set();
  private noteOffListeners: Set<NoteOffCallback> = new Set();
  private ccListeners: Set<ControlChangeCallback> = new Set();
  private activityListeners: Set<ActivityCallback> = new Set();
  private deviceListeners: Set<(devices: MidiDeviceInfo[]) => void> = new Set();
  private sustainListeners: Set<(active: boolean) => void> = new Set();

  public static getInstance(): MidiManager {
    if (!MidiManager.instance) {
      MidiManager.instance = new MidiManager();
    }
    return MidiManager.instance;
  }

  constructor() {
    this.isSupported = typeof navigator !== 'undefined' && 'requestMIDIAccess' in navigator;
  }

  public getIsSupported(): boolean {
    return this.isSupported;
  }

  public getIsConnected(): boolean {
    return this.isConnected;
  }

  public getDevices(): MidiDeviceInfo[] {
    return this.devices;
  }

  public getSelectedDeviceId(): string {
    return this.selectedDeviceId;
  }

  public setSelectedDeviceId(id: string) {
    this.selectedDeviceId = id;
  }

  // Transpose Key Changer
  public getTranspose(): number {
    return this.transposeSemitones;
  }

  public setTranspose(semitones: number) {
    this.transposeSemitones = Math.max(-24, Math.min(24, Math.round(semitones)));
    this.notifyActivity('cc', `Global Transpose set to ${this.transposeSemitones >= 0 ? '+' : ''}${this.transposeSemitones} st`);
  }

  // Sustain Button & Pedal
  public getIsSustainActive(): boolean {
    return this.isSustainActive;
  }

  public setSustainActive(active: boolean) {
    if (this.isSustainActive === active) return;
    this.isSustainActive = active;
    if (!active) {
      // Release any sustained notes that were held while sustain was active
      this.sustainedNotes.forEach(pitch => {
        this.noteOffListeners.forEach(cb => cb(pitch, 0));
      });
      this.sustainedNotes.clear();
    }
    this.notifyActivity('cc', `Sustain ${active ? 'HOLD ON' : 'OFF'}`);
    this.sustainListeners.forEach(cb => cb(active));
  }

  public toggleSustain(): boolean {
    this.setSustainActive(!this.isSustainActive);
    return this.isSustainActive;
  }

  // Request Web MIDI Access and bind USB MIDI listeners
  public async init(): Promise<boolean> {
    if (!this.isSupported) {
      console.warn('Web MIDI API is not supported in this browser.');
      return false;
    }

    try {
      // Standard navigator.requestMIDIAccess
      const nav = navigator as unknown as {
        requestMIDIAccess: (options?: { sysex?: boolean }) => Promise<WebMidiAccess>;
      };

      this.midiAccess = await nav.requestMIDIAccess({ sysex: false });
      this.isConnected = true;

      // Update connected USB MIDI devices
      this.updateDeviceList();

      // Listen for USB device plug / unplug events
      this.midiAccess.onstatechange = () => {
        this.updateDeviceList();
      };

      // Bind all incoming MIDI message handlers
      this.bindInputListeners();

      return true;
    } catch (err) {
      console.warn('Could not acquire MIDI access:', err);
      this.isConnected = false;
      return false;
    }
  }

  private updateDeviceList() {
    if (!this.midiAccess) return;

    const list: MidiDeviceInfo[] = [];
    const inputs = this.midiAccess.inputs.values();
    for (const input of inputs) {
      list.push({
        id: input.id,
        name: input.name || `USB MIDI Interface (${input.id})`,
        manufacturer: input.manufacturer || 'Generic USB MIDI',
        state: (input.state as 'connected' | 'disconnected') || 'connected',
      });
    }

    this.devices = list;
    this.deviceListeners.forEach(cb => cb(list));
    this.bindInputListeners();
  }

  private bindInputListeners() {
    if (!this.midiAccess) return;

    const inputs = this.midiAccess.inputs.values();
    for (const input of inputs) {
      input.onmidimessage = (event: { data: Uint8Array }) => {
        // Filter by device if specific device selected
        if (this.selectedDeviceId !== 'all' && input.id !== this.selectedDeviceId) {
          return;
        }
        this.handleMidiMessage(event.data, input.name || 'USB MIDI');
      };
    }
  }

  private handleMidiMessage(data: Uint8Array, deviceName: string) {
    if (!data || data.length < 2) return;

    const status = data[0];
    const command = status >> 4;
    const channel = status & 0x0f;
    const noteOrController = data[1];
    const velocityOrValue = data.length > 2 ? data[2] : 0;

    // 1. Note On (0x9)
    if (command === 0x9) {
      const velocity = velocityOrValue / 127.0;
      if (velocity > 0) {
        // Calculate transposed pitch
        const transposedPitch = Math.max(0, Math.min(127, noteOrController + this.transposeSemitones));
        this.rawToTransposedPitch.set(noteOrController, transposedPitch);
        this.activeNotes.add(transposedPitch);

        const info = this.transposeSemitones !== 0
          ? `${deviceName}: Note On #${noteOrController} -> #${transposedPitch} (${this.transposeSemitones > 0 ? '+' : ''}${this.transposeSemitones}st, vel ${velocityOrValue})`
          : `${deviceName}: Note On #${noteOrController} (vel ${velocityOrValue})`;

        this.notifyActivity('note', info);
        this.noteOnListeners.forEach(cb => cb(transposedPitch, velocity, channel));
      } else {
        // Velocity 0 is Note Off in MIDI specification
        this.handleNoteOff(noteOrController, channel, deviceName);
      }
    }
    // 2. Note Off (0x8)
    else if (command === 0x8) {
      this.handleNoteOff(noteOrController, channel, deviceName);
    }
    // 3. Control Change (0xB)
    else if (command === 0xb) {
      const cc = noteOrController;
      const val = velocityOrValue;

      // Sustain Pedal (CC 64)
      if (cc === 64) {
        const active = val >= 64;
        this.setSustainActive(active);
      }
      // All Notes Off (CC 123)
      else if (cc === 123) {
        this.panic();
      }

      this.notifyActivity('cc', `${deviceName}: CC ${cc} = ${val}`);
      this.ccListeners.forEach(cb => cb(cc, val, channel));
    }
  }

  private handleNoteOff(rawPitch: number, channel: number, deviceName: string) {
    const pitch = this.rawToTransposedPitch.get(rawPitch) ?? Math.max(0, Math.min(127, rawPitch + this.transposeSemitones));
    this.rawToTransposedPitch.delete(rawPitch);
    this.activeNotes.delete(pitch);

    if (this.isSustainActive) {
      this.sustainedNotes.add(pitch);
    }

    this.notifyActivity('note', `${deviceName}: Note Off #${pitch}`);
    this.noteOffListeners.forEach(cb => cb(pitch, channel));
  }

  private notifyActivity(type: 'note' | 'cc', info: string) {
    const item = { type, info, time: Date.now() };
    this.activityListeners.forEach(cb => cb(item));
  }

  // Panic Button: Silence all notes and reset all controllers
  public panic() {
    this.activeNotes.clear();
    this.sustainedNotes.clear();
    this.rawToTransposedPitch.clear();
    this.isSustainActive = false;
    this.sustainListeners.forEach(cb => cb(false));

    // Send MIDI All Notes Off (0x7B) and All Sound Off (0x78) to all outputs
    if (this.midiAccess && this.midiAccess.outputs) {
      const outputs = this.midiAccess.outputs.values();
      for (const out of outputs) {
        for (let ch = 0; ch < 16; ch++) {
          try {
            out.send([0xb0 | ch, 0x78, 0x00]); // All Sound Off
            out.send([0xb0 | ch, 0x7b, 0x00]); // All Notes Off
            out.send([0xb0 | ch, 0x40, 0x00]); // Sustain Off
          } catch {
            // output busy or error
          }
        }
      }
    }

    // Trigger all Note Off listeners for 0..127 to clear software engines
    for (let pitch = 0; pitch < 128; pitch++) {
      this.noteOffListeners.forEach(cb => cb(pitch, 0));
    }
  }

  // Listener subscriptions
  public onSustainChanged(cb: (active: boolean) => void): () => void {
    this.sustainListeners.add(cb);
    return () => this.sustainListeners.delete(cb);
  }
  public onNoteOn(cb: NoteOnCallback): () => void {
    this.noteOnListeners.add(cb);
    return () => this.noteOnListeners.delete(cb);
  }

  public onNoteOff(cb: NoteOffCallback): () => void {
    this.noteOffListeners.add(cb);
    return () => this.noteOffListeners.delete(cb);
  }

  public onControlChange(cb: ControlChangeCallback): () => void {
    this.ccListeners.add(cb);
    return () => this.ccListeners.delete(cb);
  }

  public onActivity(cb: ActivityCallback): () => void {
    this.activityListeners.add(cb);
    return () => this.activityListeners.delete(cb);
  }

  public onDevicesChanged(cb: (devices: MidiDeviceInfo[]) => void): () => void {
    this.deviceListeners.add(cb);
    return () => this.deviceListeners.delete(cb);
  }
}
