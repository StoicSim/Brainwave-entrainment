// mobile/utils/ThinkGearDecoder.js

import { BLE_CONFIG } from '../constants/BleConfig';

/**
 * Complete ThinkGear Protocol Decoder
 * Matches the Python implementation exactly
 */

class ThinkGearDecoder {
  constructor() {
    this.buffer = [];
    this.SYNC_BYTES = BLE_CONFIG.SYNC_BYTES;
    this.CODE_LENGTHS = BLE_CONFIG.CODE_LENGTHS;
  }

  /**
   * Parse incoming byte stream and extract complete packets
   * @param {Uint8Array|Array} data - Raw bytes from BLE characteristic
   * @returns {Array} Array of parsed packet objects
   */
  parseStream(data) {
    // Add incoming bytes to buffer
    this.buffer.push(...Array.from(data));
    
    const results = [];
    let i = 0;

    while (i < this.buffer.length - 2) {
      // Look for sync bytes (0xAA 0xAA)
      if (this.buffer[i] !== 0xAA || this.buffer[i + 1] !== 0xAA) {
        i++;
        continue;
      }

      // Check if we have enough data for payload length
      if (i + 4 > this.buffer.length) {
        break;
      }

      const payloadLength = this.buffer[i + 2];
      const packetEnd = i + 3 + payloadLength + 1; // sync(2) + len(1) + payload + checksum(1)

      // Wait for complete packet
      if (packetEnd > this.buffer.length) {
        break;
      }

      // Extract packet
      const packet = this.buffer.slice(i, packetEnd);
      const payload = packet.slice(3, -1); // Remove sync, length, and checksum
      const receivedChecksum = packet[packet.length - 1];

      // Verify checksum
      const calculatedChecksum = this.calculateChecksum(payload);
      const isValid = calculatedChecksum === receivedChecksum;

      // Parse payload
      const parsedData = this.parsePayload(payload);
      
      results.push({
        timestamp: new Date().toISOString(),
        data: parsedData,
        checksumValid: isValid,
        rawPacket: packet
      });

      i = packetEnd;
    }

    // Remove processed bytes from buffer
    this.buffer = this.buffer.slice(i);

    return results;
  }

  /**
   * Calculate ThinkGear checksum
   */
  calculateChecksum(payload) {
    const sum = payload.reduce((acc, byte) => acc + byte, 0);
    return 0xFF - (sum & 0xFF);
  }

  /**
   * Parse payload bytes into meaningful data
   */
  parsePayload(payload) {
    const parsed = {};
    let j = 0;

    while (j < payload.length) {
      const code = payload[j];
      j++;

      const length = this.CODE_LENGTHS[code];
      if (length === undefined) {
        // Unknown code, skip
        continue;
      }

      if (j + length > payload.length) {
        break;
      }

      const valueBytes = payload.slice(j, j + length);
      j += length;

      // Decode based on code
      switch (code) {
        case 0x02: // Poor Signal Quality (0-200)
          parsed.poorSignal = valueBytes[0];
          break;

        case 0x04: // Attention eSense (0-100)
          parsed.attention = valueBytes[0];
          break;

        case 0x05: // Meditation eSense (0-100)
          parsed.meditation = valueBytes[0];
          break;

        case 0x80: // Raw EEG (16-bit signed integer)
          parsed.rawEEG = this.bytesToSignedInt16(valueBytes);
          break;

        case 0x83: // EEG Power Bands (8 bands × 3 bytes each)
          parsed.eegBands = this.parseEEGBands(valueBytes);
          break;
      }
    }

    return parsed;
  }

  /**
   * Convert 2 bytes to signed 16-bit integer (big-endian)
   */
  bytesToSignedInt16(bytes) {
    const value = (bytes[0] << 8) | bytes[1];
    // Convert to signed
    return value > 32767 ? value - 65536 : value;
  }

  /**
   * Parse EEG band power values (24 bytes = 8 bands × 3 bytes)
   */
  parseEEGBands(bytes) {
    const bands = BLE_CONFIG.EEG_BANDS;
    const powers = {};

    for (let i = 0; i < bands.length; i++) {
      const offset = i * 3;
      const value = (bytes[offset] << 16) | (bytes[offset + 1] << 8) | bytes[offset + 2];
      powers[bands[i]] = value;
    }

    return powers;
  }

  /**
   * Reset decoder state
   */
  reset() {
    this.buffer = [];
  }
}

// Export singleton instance
export const decoder = new ThinkGearDecoder();

// Export class for testing
export default ThinkGearDecoder;