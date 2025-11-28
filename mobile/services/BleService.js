

import { BleManager } from 'react-native-ble-plx';
import { PermissionsAndroid, Platform } from 'react-native';
import { Buffer } from 'buffer';
import { decoder } from '../utils/ThinkGearDecoder';
import { BLE_CONFIG } from '../constants/BleConfig';

const manager = new BleManager();


const requestPermissions = async () => {
  if (Platform.OS === 'android') {
    if (Platform.Version >= 31) {
      const grantedScan = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
        {
          title: 'Bluetooth Scan Permission',
          message: 'This app needs Bluetooth scan permission',
          buttonPositive: 'OK',
        }
      );
      const grantedConnect = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
        {
          title: 'Bluetooth Connect Permission',
          message: 'This app needs Bluetooth connect permission',
          buttonPositive: 'OK',
        }
      );
      return (
        grantedScan === PermissionsAndroid.RESULTS.GRANTED &&
        grantedConnect === PermissionsAndroid.RESULTS.GRANTED
      );
    } else {
      const grantedLocation = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        {
          title: 'Location Permission',
          message: 'Bluetooth requires location permission',
          buttonPositive: 'OK',
        }
      );
      return grantedLocation === PermissionsAndroid.RESULTS.GRANTED;
    }
  }
  return true;
};

/**
 * Scan for device
 */
export const scanAndConnect = async (onDeviceFound) => {
  const isPermitted = await requestPermissions();
  if (!isPermitted) {
    throw new Error('Bluetooth permissions not granted');
  }

  console.log('Starting BLE scan...');
  
  manager.startDeviceScan(
    null,
    { allowDuplicates: false },
    (error, device) => {
      if (error) {
        console.error('Scanning Error:', error);
        manager.stopDeviceScan();
        throw error;
      }

      const matchesMac = device.id === BLE_CONFIG.DEVICE_MAC_ADDRESS;
      const matchesName = BLE_CONFIG.DEVICE_NAME_FILTER && 
                          device.name === BLE_CONFIG.DEVICE_NAME_FILTER;

      if (matchesMac || matchesName) {
        console.log(`Found target device: ${device.name} (${device.id})`);
        manager.stopDeviceScan();
        onDeviceFound(device);
      }
    }
  );
};

/**
 * Connect and monitor - Matches Python handle_notify logic
 */
export const connectAndMonitor = async (device, onDataReceived) => {
  try {
    manager.stopDeviceScan();

    console.log('Connecting to device...');
    const connectedDevice = await device.connect();
    console.log('Connected! Discovering services...');

    await connectedDevice.discoverAllServicesAndCharacteristics();
    console.log('Services discovered. Starting data stream...');

    // Reset decoder (Python equivalent: clear BUFFER)
    decoder.reset();

    let packetCount = 0;
    let validCount = 0;
    let invalidCount = 0;

    // Monitor characteristic (Python: handle_notify function)
    connectedDevice.monitorCharacteristicForService(
      BLE_CONFIG.DATA_SERVICE_UUID,
      BLE_CONFIG.DATA_CHARACTERISTIC_UUID,
      (error, characteristic) => {
        if (error) {
          console.error('Monitoring error:', error);
          return;
        }

        if (characteristic?.value) {
          try {
            // Decode base64 to bytes (Python: data parameter)
            const rawBytes = Buffer.from(characteristic.value, 'base64');
            
            // Parse ThinkGear stream (Python: packets = parse_thinkgear_stream(data))
            const packets = decoder.parseStream(rawBytes);
            
            // Process each packet (Python: for p in packets)
            packets.forEach(p => {
              packetCount++;
              
              if (p.checksumValid) {
                validCount++;
                
                // Send to callback (Python: update band_buffers and raw_buffer)
                onDataReceived(p.parsed);
                
                // Log first few packets for debugging
                if (validCount <= 5) {
                  console.log(`✓ Packet #${validCount}:`, p.parsed);
                }
                
                // Log band powers when received (Python: print EEG Bands)
                if (p.parsed.eegBands) {
                  console.log(`[${p.timestamp.split('T')[1].substring(0,8)}] EEG Bands:`, p.parsed.eegBands);
                }
                
                // Log signal quality and eSense values
                if (p.parsed.poorSignal !== undefined) {
                  console.log(`[${p.timestamp.split('T')[1].substring(0,8)}] Signal Quality: ${p.parsed.poorSignal}/200 (${p.parsed.poorSignal < 50 ? 'GOOD' : 'POOR'})`);
                }
                
                if (p.parsed.attention !== undefined || p.parsed.meditation !== undefined) {
                  console.log(`[${p.timestamp.split('T')[1].substring(0,8)}] Attention: ${p.parsed.attention || 'N/A'}, Meditation: ${p.parsed.meditation || 'N/A'}`);
                }
                
                // Log raw EEG (Python: print RawEEG)
                if (p.parsed.rawEEG !== undefined && validCount <= 10) {
                  console.log(`[${p.timestamp.split('T')[1].substring(0,8)}] RawEEG: ${p.parsed.rawEEG}`);
                }
                
              } else {
                invalidCount++;
                if (invalidCount <= 5) {
                  console.warn(`✗ Invalid checksum in packet #${packetCount}`);
                }
              }
            });
            
            // Log stats every 100 packets
            if (packetCount % 100 === 0 && packetCount > 0) {
              const successRate = ((validCount / packetCount) * 100).toFixed(1);
              console.log(`Stats: ${validCount}/${packetCount} valid (${successRate}%), buffer: ${decoder.getBufferSize()} bytes`);
            }
            
          } catch (err) {
            console.error('Decoding error:', err);
          }
        }
      }
    );

    return connectedDevice;
  } catch (error) {
    console.error('Connection/Streaming Error:', error);
    throw error;
  }
};

/**
 * Disconnect device
 */
export const disconnectDevice = async (device) => {
  if (device) {
    try {
      await device.cancelConnection();
      decoder.reset();
      console.log('Disconnected successfully');
    } catch (error) {
      console.error('Disconnect error:', error);
    }
  }
};

/**
 * Debug: Discover device details
 */
export const discoverDeviceDetails = async (device) => {
  let connectedDevice = null;
  try {
    console.log(`Discovering details for: ${device.id}`);
    
    connectedDevice = await device.connect();
    await connectedDevice.discoverAllServicesAndCharacteristics();
    
    const services = await connectedDevice.services();
    const detailMap = {};

    for (const service of services) {
      const characteristics = await service.characteristics();
      detailMap[service.uuid] = {
        serviceUUID: service.uuid,
        characteristics: characteristics.map(char => ({
          uuid: char.uuid,
          isReadable: char.isReadable,
          isWritable: char.isWritableWithResponse || char.isWritableWithoutResponse,
          isNotifiable: char.isNotifiable,
        })),
      };
    }

    console.log('=== DEVICE DETAILS ===');
    console.log(JSON.stringify(detailMap, null, 2));
    console.log('=====================');

    return detailMap;
  } catch (error) {
    console.error('Discovery error:', error);
    throw error;
  } finally {
    if (connectedDevice) {
      await connectedDevice.cancelConnection();
    }
  }
};

export default manager;