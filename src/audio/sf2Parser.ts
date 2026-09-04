// SoundFont 2 (SF2) Binary Parser and Sample Decoders for Web Audio
export interface Sf2SampleHeader {
  name: string;
  start: number;
  end: number;
  startLoop: number;
  endLoop: number;
  sampleRate: number;
  originalPitch: number; // 0-127 MIDI key
  pitchCorrection: number; // cents
  sampleLink: number;
  sampleType: number;
  audioBuffer?: AudioBuffer;
}

export interface Sf2Preset {
  name: string;
  preset: number;
  bank: number;
  presetBagIndex: number;
  genre: number;
  morphology: number;
  sampleHeaders: Sf2SampleHeader[];
}

export interface Sf2Bank {
  id: string;
  fileName: string;
  bankName: string;
  presets: Sf2Preset[];
  sampleDataLength: number;
  isCustomUpload: boolean;
}

class BinaryReader {
  private view: DataView;
  public offset = 0;

  constructor(buffer: ArrayBuffer) {
    this.view = new DataView(buffer);
  }

  get length(): number {
    return this.view.byteLength;
  }

  readFourCC(): string {
    if (this.offset + 4 > this.view.byteLength) return '';
    let result = '';
    for (let i = 0; i < 4; i++) {
      result += String.fromCharCode(this.view.getUint8(this.offset++));
    }
    return result;
  }

  readUint8(): number {
    return this.view.getUint8(this.offset++);
  }

  readInt8(): number {
    return this.view.getInt8(this.offset++);
  }

  readUint16(): number {
    const val = this.view.getUint16(this.offset, true);
    this.offset += 2;
    return val;
  }

  readInt16(): number {
    const val = this.view.getInt16(this.offset, true);
    this.offset += 2;
    return val;
  }

  readUint32(): number {
    const val = this.view.getUint32(this.offset, true);
    this.offset += 4;
    return val;
  }

  readInt32(): number {
    const val = this.view.getInt32(this.offset, true);
    this.offset += 4;
    return val;
  }

  readFixedString(length: number): string {
    let str = '';
    const end = Math.min(this.offset + length, this.view.byteLength);
    for (let i = this.offset; i < end; i++) {
      const charCode = this.view.getUint8(i);
      if (charCode === 0) break; // Null terminator
      if (charCode >= 32 && charCode <= 126) {
        str += String.fromCharCode(charCode);
      }
    }
    this.offset = end;
    return str.trim();
  }

  skip(bytes: number) {
    this.offset = Math.min(this.offset + bytes, this.view.byteLength);
  }
}

/**
 * Parses an SF2 (SoundFont 2) binary file from an ArrayBuffer
 * and decodes PCM samples into Web Audio AudioBuffers.
 */
export function parseSf2File(
  arrayBuffer: ArrayBuffer,
  fileName: string,
  audioCtx: AudioContext | BaseAudioContext
): Sf2Bank {
  const reader = new BinaryReader(arrayBuffer);

  // 1. Check RIFF header
  const riff = reader.readFourCC();
  if (riff !== 'RIFF') {
    throw new Error('Invalid SoundFont file: Missing RIFF signature');
  }

  const fileSize = reader.readUint32();
  const sfbk = reader.readFourCC();
  if (sfbk !== 'sfbk') {
    throw new Error('Invalid SoundFont format: Expected sfbk container');
  }

  let bankName = fileName.replace(/\.sf2$/i, '');
  let sampleDataOffset = 0;
  let sampleDataLength = 0;
  const sampleHeaders: Sf2SampleHeader[] = [];
  const rawPresets: {
    name: string;
    preset: number;
    bank: number;
    bagNdx: number;
    genre: number;
    morphology: number;
  }[] = [];

  // 2. Iterate through RIFF LIST chunks
  while (reader.offset < reader.length - 8) {
    const chunkId = reader.readFourCC();
    const chunkSize = reader.readUint32();
    const chunkEnd = Math.min(reader.offset + chunkSize, reader.length);

    if (chunkId === 'LIST') {
      const listType = reader.readFourCC();

      if (listType === 'INFO') {
        // Read INFO subchunks (INAM, etc.)
        while (reader.offset < chunkEnd - 8) {
          const subId = reader.readFourCC();
          const subSize = reader.readUint32();
          const subEnd = reader.offset + subSize;
          if (subId === 'INAM') {
            const name = reader.readFixedString(subSize);
            if (name) bankName = name;
          } else {
            reader.skip(subSize);
          }
          reader.offset = Math.min(subEnd, chunkEnd);
          if (subSize % 2 === 1) reader.skip(1); // word-align
        }
      } else if (listType === 'sdta') {
        // Sample data chunk
        while (reader.offset < chunkEnd - 8) {
          const subId = reader.readFourCC();
          const subSize = reader.readUint32();
          if (subId === 'smpl') {
            sampleDataOffset = reader.offset;
            sampleDataLength = subSize;
            reader.skip(subSize);
          } else {
            reader.skip(subSize);
          }
          if (subSize % 2 === 1) reader.skip(1);
        }
      } else if (listType === 'pdta') {
        // Preset and instrument headers chunk
        while (reader.offset < chunkEnd - 8) {
          const subId = reader.readFourCC();
          const subSize = reader.readUint32();
          const subEnd = reader.offset + subSize;

          if (subId === 'phdr') {
            // Preset headers (38 bytes each)
            const count = Math.floor(subSize / 38);
            for (let i = 0; i < count; i++) {
              const name = reader.readFixedString(20);
              const preset = reader.readUint16();
              const bank = reader.readUint16();
              const bagNdx = reader.readUint16();
              reader.skip(4); // dwLibrary
              const genre = reader.readUint32();
              const morphology = reader.readUint32();

              // Skip EOP (End of Presets marker)
              if (name !== 'EOP' && (i < count - 1 || name.length > 0)) {
                rawPresets.push({ name, preset, bank, bagNdx, genre, morphology });
              }
            }
          } else if (subId === 'shdr') {
            // Sample headers (46 bytes each)
            const count = Math.floor(subSize / 46);
            for (let i = 0; i < count; i++) {
              const name = reader.readFixedString(20);
              const start = reader.readUint32();
              const end = reader.readUint32();
              const startLoop = reader.readUint32();
              const endLoop = reader.readUint32();
              const sampleRate = reader.readUint32();
              const originalPitch = reader.readUint8();
              const pitchCorrection = reader.readInt8();
              const sampleLink = reader.readUint16();
              const sampleType = reader.readUint16();

              // Skip EOS (End of Samples marker)
              if (name !== 'EOS' && end > start) {
                sampleHeaders.push({
                  name,
                  start,
                  end,
                  startLoop,
                  endLoop,
                  sampleRate: sampleRate || 44100,
                  originalPitch: originalPitch || 60,
                  pitchCorrection,
                  sampleLink,
                  sampleType,
                });
              }
            }
          } else {
            reader.skip(subSize);
          }

          reader.offset = Math.min(subEnd, chunkEnd);
          if (subSize % 2 === 1) reader.skip(1);
        }
      } else {
        reader.skip(chunkSize - 4);
      }
    } else {
      reader.skip(chunkSize);
    }

    reader.offset = chunkEnd;
    if (chunkSize % 2 === 1) reader.skip(1);
  }

  // 3. Decode Sample Headers into Web Audio AudioBuffers
  // We extract samples from the 16-bit PCM `smpl` chunk.
  if (sampleDataOffset > 0 && sampleDataLength > 0) {
    const rawPcmView = new DataView(arrayBuffer, sampleDataOffset, sampleDataLength);
    const maxSamplesToPredecode = 120; // To maintain blazing fast loading for huge soundfonts

    sampleHeaders.slice(0, maxSamplesToPredecode).forEach(header => {
      try {
        const sampleCount = header.end - header.start;
        if (sampleCount <= 0 || sampleCount > 44100 * 30) return; // Ignore corrupted sample chunks

        const sampleByteOffset = header.start * 2;
        if (sampleByteOffset + sampleCount * 2 > sampleDataLength) return;

        const buffer = audioCtx.createBuffer(1, sampleCount, header.sampleRate || 44100);
        const channelData = buffer.getChannelData(0);

        for (let s = 0; s < sampleCount; s++) {
          // 16-bit signed integer to -1.0 .. +1.0 float
          const int16 = rawPcmView.getInt16(sampleByteOffset + s * 2, true);
          channelData[s] = int16 / 32768.0;
        }

        header.audioBuffer = buffer;
      } catch (err) {
        console.warn(`Could not decode sample ${header.name}:`, err);
      }
    });
  }

  // 4. Map presets to sample headers
  const presets: Sf2Preset[] = rawPresets.map((p, idx) => {
    // Associate representative samples with the preset
    const startIdx = Math.floor((idx / Math.max(1, rawPresets.length)) * sampleHeaders.length);
    const associatedSamples = sampleHeaders.slice(startIdx, startIdx + 3);

    return {
      name: p.name || `Preset ${p.preset}`,
      preset: p.preset,
      bank: p.bank,
      presetBagIndex: p.bagNdx,
      genre: p.genre,
      morphology: p.morphology,
      sampleHeaders: associatedSamples.length > 0 ? associatedSamples : sampleHeaders.slice(0, 1),
    };
  });

  // If no presets found or file is a raw sample bank, provide a default preset
  if (presets.length === 0) {
    presets.push({
      name: bankName || 'Default Preset',
      preset: 0,
      bank: 0,
      presetBagIndex: 0,
      genre: 0,
      morphology: 0,
      sampleHeaders: sampleHeaders.slice(0, 5),
    });
  }

  return {
    id: `sf2-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    fileName,
    bankName: bankName || fileName.replace(/\.[^/.]+$/, ''),
    presets,
    sampleDataLength,
    isCustomUpload: true,
  };
}
