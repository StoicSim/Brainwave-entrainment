// mobile/services/BleService.js

import { BleManager } from 'react-native-ble-plx';
import { PermissionsAndroid, Platform } from 'react-native';
import { Buffer } from 'buffer';
import { decoder } from '../utils/ThinkGearDecoder';
import { BLE_CONFIG } from '../constants/BleConfig';

const manager = new BleManager();

/**
 * Request necessary Bluetooth permissions
 */
const requestPermissions = async () => {
  if (Platform.OS === 'android') {
    if (Platform.Version >= 31) {
      // Android 12+
      const grantedScan = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
        {
          title: 'Bluetooth Scan Permission',
          message: 'This app needs Bluetooth scan permission to find your EEG device',
          buttonPositive: 'OK',
        }
      );
      const grantedConnect = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
        {
          title: 'Bluetooth Connect Permission',
          message: 'This app needs Bluetooth connect permission to connect to your EEG device',
          buttonPositive: 'OK',
        }
      );
      return (
        grantedScan === PermissionsAndroid.RESULTS.GRANTED &&
        grantedConnect === PermissionsAndroid.RESULTS.GRANTED
      );
    } else {
      // Android 11 and below
      const grantedLocation = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        {
          title: 'Location Permission',
          message: 'Bluetooth scanning requires location permission on Android',
          buttonPositive: 'OK',
        }
      );
      return grantedLocation === PermissionsAndroid.RESULTS.GRANTED;
    }
  }
  return true; // iOS handles permissions via Info.plist
};

/**
 * Scan for the EMI device
 */
export const scanAndConnect = async (onDeviceFound) => {
  const isPermitted = await requestPermissions();
  if (!isPermitted) {
    throw new Error('Bluetooth permissions not granted');
  }

  console.log('Starting BLE scan...');
  
  manager.startDeviceScan(
    null, // Scan all devices (filter by MAC/name later)
    { allowDuplicates: false },
    (error, device) => {
      if (error) {
        console.error('Scanning Error:', error);
        manager.stopDeviceScan();
        throw error;
      }

      // Match by MAC address or name
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
 * Connect to device and start monitoring data
 */
export const connectAndMonitor = async (device, onDataReceived) => {
  try {
    manager.stopDeviceScan();

    console.log('Connecting to device...');
    const connectedDevice = await device.connect();
    console.log('Connected! Discovering services...');

    await connectedDevice.discoverAllServicesAndCharacteristics();
    console.log('Services discovered. Starting data stream...');

    // Reset decoder state
    decoder.reset();

    // Start monitoring the characteristic
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
            // Decode base64 to bytes
            const rawBytes = Buffer.from(characteristic.value, 'base64');
            
            // Parse ThinkGear stream
            const packets = decoder.parseStream(rawBytes);
            
            // Send each parsed packet to the callback
            packets.forEach(packet => {
              if (packet.checksumValid) {
                onDataReceived(packet.data);
              } else {
                console.warn('Invalid checksum in packet');
              }
            });
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
 * Disconnect from device
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
 * Debug function: Discover all services and characteristics
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