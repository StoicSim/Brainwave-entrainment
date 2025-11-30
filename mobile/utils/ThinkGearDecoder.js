

const SYNC_BYTES = [0xAA, 0xAA];
const CODE_LENGTHS = {
  0x02: 1,  // Poor signal
  0x04: 1,  // Attention
  0x05: 1,  // Meditation
  0x80: 2,  // Raw EEG (16-bit signed)
  0x83: 24, // EEG band powers (8 bands × 3 bytes)
};

class ThinkGearDecoder {
  constructor() {
    this.buffer = [];
  }

  
  parseStream(data) {
    this.buffer.push(...Array.from(data));
    
    let i = 0;
    const results = [];

    while (i < this.buffer.length - 2) {
      if (this.buffer[i] !== SYNC_BYTES[0] || this.buffer[i + 1] !== SYNC_BYTES[1]) {
        i += 1;
        continue;
      }

      if (i + 4 > this.buffer.length) {
        break;
      }

      const payloadLen = this.buffer[i + 2];
      const packetEnd = i + 3 + payloadLen + 1; // sync(2) + len(1) + payload + checksum(1)

      if (packetEnd > this.buffer.length) {
        break;
      }

      const packet = this.buffer.slice(i, packetEnd);
      const payload = packet.slice(3, -1); // Remove sync, length, checksum
      const checksum = packet[packet.length - 1];

      const sum = payload.reduce((acc, byte) => acc + byte, 0);
      const calcChecksum = 0xFF - (sum & 0xFF);
      const validChecksum = (calcChecksum === checksum);

      let j = 0;
      const parsedValues = {};

      while (j < payload.length) {
        const code = payload[j];
        j += 1;

        const length = CODE_LENGTHS[code];
        if (length === undefined) {
          j += 1;
          continue;
        }

        if (j + length > payload.length) {
          break;
        }

        const valBytes = payload.slice(j, j + length);
        j += length;

        if (code === 0x02) {
          parsedValues.poorSignal = valBytes[0];
        } else if (code === 0x04) {
          parsedValues.attention = valBytes[0];
        } else if (code === 0x05) {
          parsedValues.meditation = valBytes[0];
        } else if (code === 0x80) {
          const value = (valBytes[0] << 8) | valBytes[1];
          parsedValues.rawEEG = value > 32767 ? value - 65536 : value;
        } else if (code === 0x83) {
          const bands = ['Delta', 'Theta', 'AlphaLow', 'AlphaHigh', 
                         'BetaLow', 'BetaHigh', 'GammaLow', 'GammaHigh'];
          const powers = {};
          
          for (let k = 0; k < bands.length; k++) {
            const start = k * 3;
            const bandValue = (valBytes[start] << 16) | 
                             (valBytes[start + 1] << 8) | 
                             valBytes[start + 2];
            powers[bands[k]] = bandValue;
          }
          parsedValues.eegBands = powers;
        }
      }

      const timestamp = new Date().toISOString();
      results.push({
        timestamp: timestamp,
        parsed: parsedValues,
        checksumValid: validChecksum,
      });

      i = packetEnd;
    }

    this.buffer = this.buffer.slice(i);

    return results;
  }

  
  reset() {
    this.buffer = [];
  }

  
  getBufferSize() {
    return this.buffer.length;
  }
}

export const decoder = new ThinkGearDecoder();

export default ThinkGearDecoder;