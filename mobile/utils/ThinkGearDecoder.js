// mobile/utils/ThinkGearDecoder.js

import { BLE_CONFIG } from '../constants/BleConfig';

/**
 * Complete ThinkGear Protocol Decoder
 * Handles TWO packet formats from your device:
 * 1. Simple: [0xAA 0xAA] [0x04] [0x80 0x02] [raw_eeg_hi] [raw_eeg_lo] [checksum]
 * 2. Full: [0xAA 0xAA] [0x20] [0x02] [signal] [0x83 0x18] [24 bytes bands] [checksum]
 */

class ThinkGearDecoder {
  constructor() {
    this.buffer = [];
    this.SYNC_BYTES = BLE_CONFIG.SYNC_BYTES;
    this.packetCount = 0;
    this.errorCount = 0;
    this.lastBandPowers = null; // Cache last band powers
  }

  /**
   * Parse incoming byte stream and extract complete packets
   */
  parseStream(data) {
    this.buffer.push(...Array.from(data));
    
    const results = [];
    let i = 0;

    while (i < this.buffer.length - 3) {
      // Look for sync bytes
      if (this.buffer[i] !== 0xAA || this.buffer[i + 1] !== 0xAA) {
        i++;
        continue;
      }

      // Get payload length
      const payloadLength = this.buffer[i + 2];
      
      // Validate payload length
      if (payloadLength < 1 || payloadLength > 169) {
        i += 2;
        continue;
      }

      const packetEnd = i + 3 + payloadLength + 1;

      // Wait for complete packet
      if (packetEnd > this.buffer.length) {
        break;
      }

      // Extract packet
      const packet = this.buffer.slice(i, packetEnd);
      const payload = packet.slice(3, -1);
      const receivedChecksum = packet[packet.length - 1];

      // Calculate checksum
      let sum = 0;
      for (let j = 0; j < payload.length; j++) {
        sum += payload[j];
      }
      const calculatedChecksum = (~sum) & 0xFF;
      
      const isValid = calculatedChecksum === receivedChecksum;

      if (!isValid) {
        if (this.errorCount < 3) {
          console.log(
            `Checksum mismatch at packet #${this.packetCount + 1}: ` +
            `calc=0x${calculatedChecksum.toString(16)}, recv=0x${receivedChecksum.toString(16)}`
          );
        }
        this.errorCount++;
        i++;
        continue;
      }

      // Valid packet!
      this.errorCount = 0;
      this.packetCount++;

      // Parse payload
      const parsedData = this.parsePayload(payload);
      
      // Only return packets with data
      if (Object.keys(parsedData).length > 0) {
        results.push({
          timestamp: new Date().toISOString(),
          data: parsedData,
          checksumValid: true,
          packetNumber: this.packetCount,
        });
      }

      i = packetEnd;
    }

    // Clean buffer
    this.buffer = this.buffer.slice(i);
    
    if (this.buffer.length > 1000) {
      console.warn('Buffer overflow, clearing');
      this.buffer = this.buffer.slice(-500);
    }

    return results;
  }

  /**
   * Parse payload into meaningful data
   */
  parsePayload(payload) {
    const parsed = {};
    let j = 0;

    while (j < payload.length) {
      const code = payload[j];
      j++;

      // Skip extended code prefix
      if (code === 0x55) {
        continue;
      }

      switch (code) {
        case 0x02: // Poor Signal Quality
          if (j < payload.length) {
            parsed.poorSignal = payload[j];
            j++;
          }
          break;

        case 0x04: // Attention eSense
          if (j < payload.length) {
            parsed.attention = payload[j];
            j++;
          }
          break;

        case 0x05: // Meditation eSense
          if (j < payload.length) {
            parsed.meditation = payload[j];
            j++;
          }
          break;

        case 0x80: // Raw EEG (2 bytes)
          if (j + 1 < payload.length) {
            // Skip the length byte (0x02)
            if (payload[j] === 0x02) {
              j++;
            }
            // Read 2-byte signed integer
            if (j + 1 < payload.length) {
              const hi = payload[j];
              const lo = payload[j + 1];
              const value = (hi << 8) | lo;
              parsed.rawEEG = value > 32767 ? value - 65536 : value;
              j += 2;
            }
          }
          break;

        case 0x83: // EEG Power Bands (24 bytes)
          // Next byte should be length (0x18 = 24)
          if (j < payload.length) {
            const bandLength = payload[j];
            j++;
            
            if (bandLength === 24 && j + 24 <= payload.length) {
              const bandBytes = payload.slice(j, j + 24);
              parsed.eegBands = this.parseEEGBands(bandBytes);
              
              // Cache for future packets
              this.lastBandPowers = parsed.eegBands;
              
              j += 24;
            } else {
              console.warn(`Unexpected EEG band length: ${bandLength}`);
              j += Math.min(bandLength, payload.length - j);
            }
          }
          break;

        default:
          // Unknown code - try to skip gracefully
          if (j < payload.length) {
            const possibleLength = payload[j];
            if (possibleLength < 170 && j + possibleLength < payload.length) {
              j += possibleLength + 1;
            } else {
              j++;
            }
          }
          break;
      }
    }

    return parsed;
  }

  /**
   * Parse 24-byte EEG band powers
   */
  parseEEGBands(bytes) {
    if (bytes.length < 24) {
      console.warn(`Incomplete EEG band data: ${bytes.length} bytes`);
      return null;
    }

    const bands = BLE_CONFIG.EEG_BANDS;
    const powers = {};

    for (let i = 0; i < 8; i++) {
      const offset = i * 3;
      // 3-byte big-endian unsigned integer
      const value = (bytes[offset] << 16) | (bytes[offset + 1] << 8) | bytes[offset + 2];
      powers[bands[i]] = value;
    }

    return powers;
  }

  /**
   * Get decoder statistics
   */
  getStats() {
    return {
      packetCount: this.packetCount,
      errorCount: this.errorCount,
      bufferSize: this.buffer.length,
      successRate: this.packetCount > 0 
        ? ((this.packetCount / (this.packetCount + this.errorCount)) * 100).toFixed(1) + '%'
        : '0%',
      hasBandPowers: this.lastBandPowers !== null
    };
  }

  /**
   * Reset decoder state
   */
  reset() {
    this.buffer = [];
    this.packetCount = 0;
    this.errorCount = 0;
    this.lastBandPowers = null;
    console.log('ThinkGear decoder reset');
  }
}

// Export singleton instance
export const decoder = new ThinkGearDecoder();

// Export class for testing
export default ThinkGearDecoder;