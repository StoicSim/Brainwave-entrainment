// mobile/utils/ThinkGearDecoder.js
// Direct port of Python ThinkGear parser logic

/**
 * ThinkGear Protocol Parser - Ported from Python
 * Matches the exact logic from your working Python implementation
 */

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

  /**
   * Parse ThinkGear stream - Direct Python port
   * @param {Uint8Array|Array} data - Raw bytes from BLE
   * @returns {Array} Array of parsed packets
   */
  parseStream(data) {
    // Extend buffer with new data (Python: BUFFER.extend(data))
    this.buffer.push(...Array.from(data));
    
    let i = 0;
    const results = [];

    // Main parsing loop (Python: while i < len(BUFFER) - 2)
    while (i < this.buffer.length - 2) {
      // Look for sync bytes (Python: if BUFFER[i:i+2] != SYNC_BYTES)
      if (this.buffer[i] !== SYNC_BYTES[0] || this.buffer[i + 1] !== SYNC_BYTES[1]) {
        i += 1;
        continue;
      }

      // Check if we have enough data for length byte
      if (i + 4 > this.buffer.length) {
        break;
      }

      // Get payload length (Python: payload_len = BUFFER[i+2])
      const payloadLen = this.buffer[i + 2];
      const packetEnd = i + 3 + payloadLen + 1; // sync(2) + len(1) + payload + checksum(1)

      // Wait for complete packet (Python: if packet_end > len(BUFFER))
      if (packetEnd > this.buffer.length) {
        break;
      }

      // Extract packet (Python: packet = BUFFER[i:packet_end])
      const packet = this.buffer.slice(i, packetEnd);
      const payload = packet.slice(3, -1); // Remove sync, length, checksum
      const checksum = packet[packet.length - 1];

      // Calculate checksum (Python: calc_checksum = 0xFF - (sum(payload) & 0xFF))
      const sum = payload.reduce((acc, byte) => acc + byte, 0);
      const calcChecksum = 0xFF - (sum & 0xFF);
      const validChecksum = (calcChecksum === checksum);

      // Parse payload values (Python: j = 0; parsed_values = {})
      let j = 0;
      const parsedValues = {};

      while (j < payload.length) {
        const code = payload[j];
        j += 1;

        const length = CODE_LENGTHS[code];
        if (length === undefined) {
          // Unknown code, skip next byte
          j += 1;
          continue;
        }

        if (j + length > payload.length) {
          break;
        }

        const valBytes = payload.slice(j, j + length);
        j += length;

        // Decode based on code (Python logic)
        if (code === 0x02) {
          parsedValues.poorSignal = valBytes[0];
        } else if (code === 0x04) {
          parsedValues.attention = valBytes[0];
        } else if (code === 0x05) {
          parsedValues.meditation = valBytes[0];
        } else if (code === 0x80) {
          // Raw EEG: 16-bit signed big-endian
          // Python: int.from_bytes(val_bytes, 'big', signed=True)
          const value = (valBytes[0] << 8) | valBytes[1];
          parsedValues.rawEEG = value > 32767 ? value - 65536 : value;
        } else if (code === 0x83) {
          // EEG Band Powers: 8 bands × 3 bytes each
          // Python: bands = ['Delta','Theta','AlphaLow',...]
          const bands = ['Delta', 'Theta', 'AlphaLow', 'AlphaHigh', 
                         'BetaLow', 'BetaHigh', 'GammaLow', 'GammaHigh'];
          const powers = {};
          
          for (let k = 0; k < bands.length; k++) {
            const start = k * 3;
            // Python: int.from_bytes(val_bytes[start:start+3], 'big')
            const bandValue = (valBytes[start] << 16) | 
                             (valBytes[start + 1] << 8) | 
                             valBytes[start + 2];
            powers[bands[k]] = bandValue;
          }
          parsedValues.eegBands = powers;
        }
      }

      // Create result object (Python: timestamp = datetime.now().strftime(...))
      const timestamp = new Date().toISOString();
      results.push({
        timestamp: timestamp,
        parsed: parsedValues,
        checksumValid: validChecksum,
      });

      // Move to next packet (Python: i = packet_end)
      i = packetEnd;
    }

    // Remove processed bytes (Python: BUFFER = BUFFER[i:])
    this.buffer = this.buffer.slice(i);

    return results;
  }

  /**
   * Reset buffer
   */
  reset() {
    this.buffer = [];
  }

  /**
   * Get buffer size for debugging
   */
  getBufferSize() {
    return this.buffer.length;
  }
}

// Export singleton instance
export const decoder = new ThinkGearDecoder();

// Export class
export default ThinkGearDecoder;