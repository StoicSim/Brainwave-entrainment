const SYNC = 0xAA;

class ThinkGearDecoder {
  constructor() {
    this.buffer = [];
    this.debugMode = false;
  }

  /**
   * Unpacks a 3-byte (24-bit) big-endian unsigned integer
   */
  unpack3ByteUnsigned(bytes) {
    return (bytes[0] << 16) | (bytes[1] << 8) | bytes[2];
  }

  /**
   * Parse and decode ThinkGear stream - matches Python implementation
   */
  parseStream(newPayload) {
    this.buffer.push(...Array.from(newPayload));
    
    const MIN_PACKET_LENGTH = 4;
    const results = [];

    while (this.buffer.length >= MIN_PACKET_LENGTH) {
      // 1. Find SYNC bytes (0xAA 0xAA)
      while (this.buffer.length > 0 && this.buffer[0] !== SYNC) {
        this.buffer.shift();
      }
      
      if (this.buffer.length < 2) break;
      
      if (this.buffer[1] !== SYNC) {
        this.buffer.shift();
        continue;
      }

      if (this.buffer.length < 3) break;

      const pLength = this.buffer[2];
      const totalPacketLength = 3 + pLength + 1; // sync(2) + len(1) + payload + checksum(1)

      // Wait for complete packet
      if (this.buffer.length < totalPacketLength) break;

      // Packet is complete - slice it out
      const packet = this.buffer.slice(0, totalPacketLength);
      this.buffer = this.buffer.slice(totalPacketLength);

      const pData = packet.slice(3, 3 + pLength);

      // Debug: Show raw packet
      if (this.debugMode) {
        console.log('\n📦 RAW PACKET:', packet.map(b => '0x' + b.toString(16).padStart(2, '0')).join(' '));
        console.log('📦 PAYLOAD (length=' + pLength + '):', pData.map(b => '0x' + b.toString(16).padStart(2, '0')).join(' '));
      }

      // 2. Checksum Validation
      const receivedChecksum = packet[packet.length - 1];
      const sum = pData.reduce((acc, byte) => acc + byte, 0);
      const calculatedChecksum = 0xFF - (sum & 0xFF);
      const checksumValid = (calculatedChecksum === receivedChecksum);

      const parsedValues = {};

      if (!checksumValid) {
        const packetHex = packet.map(b => b.toString(16).padStart(2, '0')).join('');
        console.log(`\n❌ Checksum FAILED for Packet: ${packetHex} - Discarding corrupted data.`);
        continue; // Skip this packet
      }

      // 3. Decode the Data
      let i = 0;
      while (i < pData.length) {
        const code = pData[i];
        
        if (this.debugMode) {
          console.log(`  Parsing code: 0x${code.toString(16).padStart(2, '0')} at index ${i}`);
        }
        
        i += 1;

        if (code === 0x80) { // Raw EEG Value (EXTENDED CODE with VLEN)
          if (i >= pData.length) {
            if (this.debugMode) console.log('    ⚠️ No VLEN byte for 0x80');
            break;
          }
          
          const vlen = pData[i];
          if (vlen !== 0x02) {
            if (this.debugMode) console.log(`    ⚠️ Expected VLEN=0x02, got 0x${vlen.toString(16)}`);
            break;
          }
          i += 1; // Skip VLEN
          
          if (i + 2 > pData.length) {
            if (this.debugMode) console.log('    ⚠️ Not enough bytes for rawEEG value');
            break;
          }
          
          // 16-bit signed integer, big-endian
          const rawVal = (pData[i] << 8) | pData[i + 1];
          parsedValues.rawEEG = rawVal > 32767 ? rawVal - 65536 : rawVal;
          i += 2;
          
          if (this.debugMode) console.log(`    ✅ rawEEG = ${parsedValues.rawEEG}`);

        } else if (code === 0x83) { // EEG Band Powers (EXTENDED CODE with VLEN)
          if (i >= pData.length) {
            if (this.debugMode) console.log('    ⚠️ No VLEN byte for 0x83');
            break;
          }
          
          const vlen = pData[i];
          if (vlen !== 0x18) { // 0x18 = 24 bytes (8 bands × 3 bytes each)
            if (this.debugMode) console.log(`    ⚠️ Expected VLEN=0x18, got 0x${vlen.toString(16)}`);
            break;
          }
          i += 1; // Skip VLEN
          
          if (i + 24 > pData.length) {
            if (this.debugMode) console.log('    ⚠️ Not enough bytes for band powers');
            break;
          }
          
          const bands = ['Delta', 'Theta', 'AlphaLow', 'AlphaHigh', 
                         'BetaLow', 'BetaHigh', 'GammaLow', 'GammaHigh'];
          const powerValues = {};
          
          for (const bandName of bands) {
            const power = this.unpack3ByteUnsigned(pData.slice(i, i + 3));
            powerValues[bandName] = power;
            i += 3;
          }
          parsedValues.eegBands = powerValues;
          
          if (this.debugMode) console.log(`    ✅ eegBands parsed:`, powerValues);

        // --- SINGLE-BYTE CODES (no VLEN byte!) ---
        } else if (code === 0x02) { // Poor Signal Quality
          if (i >= pData.length) {
            if (this.debugMode) console.log('    ⚠️ No value byte for poorSignal');
            break;
          }
          parsedValues.poorSignal = pData[i];
          i += 1;
          
          if (this.debugMode) console.log(`    ✅ poorSignal = ${parsedValues.poorSignal}`);

        } else if (code === 0x04) { // Attention eSense
          if (i >= pData.length) {
            if (this.debugMode) console.log('    ⚠️ No value byte for attention');
            break;
          }
          parsedValues.attention = pData[i];
          i += 1;
          
          if (this.debugMode) console.log(`    ✅ attention = ${parsedValues.attention}`);

        } else if (code === 0x05) { // Meditation eSense
          if (i >= pData.length) {
            if (this.debugMode) console.log('    ⚠️ No value byte for meditation');
            break;
          }
          parsedValues.meditation = pData[i];
          i += 1;
          
          if (this.debugMode) console.log(`    ✅ meditation = ${parsedValues.meditation}`);

        } else {
          // Unknown code - handle gracefully
          if (code < 0x80) {
            // Single-byte code - skip 1 byte for the value
            if (i < pData.length) {
              i += 1;
              if (this.debugMode) console.log(`    ⏭️ Unknown single-byte code 0x${code.toString(16)}, skipping 1 byte`);
            } else {
              break;
            }
          } else {
            // Extended code - read VLEN and skip that many bytes
            if (i >= pData.length) break;
            const vlen = pData[i];
            i += 1 + vlen;
            if (this.debugMode) console.log(`    ⏭️ Unknown extended code 0x${code.toString(16)}, skipping VLEN=${vlen} bytes`);
          }
        }
      }

      // 4. CONDITIONAL OUTPUT - Only include packets with metrics
      // This matches the Python filter logic
      if (parsedValues.attention !== undefined ||
          parsedValues.meditation !== undefined ||
          parsedValues.eegBands !== undefined ||
          (parsedValues.poorSignal || 0) > 0) {
        
        const timestamp = new Date().toISOString();
        results.push({
          timestamp,
          parsed: parsedValues,
          checksumValid
        });

        if (this.debugMode) {
          console.log('✅ PACKET ACCEPTED:', JSON.stringify(parsedValues, null, 2));
        }
      } else {
        if (this.debugMode) {
          console.log('⏭️ PACKET FILTERED OUT (contains only rawEEG or no relevant metrics)');
        }
      }
    }

    return results;
  }

  /**
   * Reset the internal buffer
   */
  reset() {
    this.buffer = [];
  }

  /**
   * Get current buffer size
   */
  getBufferSize() {
    return this.buffer.length;
  }
  
  /**
   * Enable or disable debug logging
   */
  enableDebug(enabled = true) {
    this.debugMode = enabled;
    if (enabled) {
      console.log('🐛 Debug mode ENABLED - detailed packet parsing info will be shown');
    } else {
      console.log('🐛 Debug mode DISABLED');
    }
  }
}

// Export singleton instance and class
export const decoder = new ThinkGearDecoder();
export default ThinkGearDecoder;