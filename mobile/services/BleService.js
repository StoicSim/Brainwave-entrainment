import { BleManager } from 'react-native-ble-plx';
import { PermissionsAndroid, Platform } from 'react-native';
import { Buffer } from 'buffer';

// Import the decoder logic (which we will create in the next step)
import { parseAndDecodeStream } from '../utils/ThinkGearDecoder'; 

const manager = new BleManager();

// --- EEG DEVICE CONFIGURATION (Update these based on your specific device) ---
export const DEVICE_MAC_ADDRESS = '34:81:F4:33:AE:91'; 
export const DEVICE_NAME_FILTER = null; 

// Service UUIDs you suspect are involved. We use the first one as the data channel guess.
export const DATA_SERVICE_UUIDS = [
    "49535343-aca3-481c-91ec-d85e28a60318", 
    "49535343-1e4d-4bd9-ba61-23c647249616",
    "49535343-026e-3a9b-954c-97daef17e26e"
]; 

// CRITICAL FIX: We assume the main data channel uses the first Service UUID for both service and characteristic.
export const DATA_SERVICE_UUID = DATA_SERVICE_UUIDS[0];
export const DATA_CHARACTERISTIC_UUID = DATA_SERVICE_UUIDS[0]; 
// ----------------------------------------------------------------------------


const requestPermissions = async () => {
    // Android permissions logic
    if (Platform.OS === 'android') {
        if (Platform.Version >= 31) { // Android 12+
            const grantedScan = await PermissionsAndroid.request(
                PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN
            );
            const grantedConnect = await PermissionsAndroid.request(
                PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT
            );
            return grantedScan === PermissionsAndroid.RESULTS.GRANTED && grantedConnect === PermissionsAndroid.RESULTS.GRANTED;
        } else { // Android 11-
            const grantedLocation = await PermissionsAndroid.request(
                PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
            );
            return grantedLocation === PermissionsAndroid.RESULTS.GRANTED;
        }
    }
    return true; // iOS handles permissions in app.json
};


// --- Core BLE Logic ---

/**
 * Scans for the device using its MAC address or name filter.
 * @param {(device) => void} onDeviceFound - Callback when the device is found.
 */
export const scanAndConnect = async (onDeviceFound) => {
    const isPermitted = await requestPermissions();
    if (!isPermitted) {
        throw new Error("Bluetooth permissions not granted.");
    }
    
    // Start scanning
    manager.startDeviceScan(
        DATA_SERVICE_UUIDS, // Scan filter only for devices offering these services
        null, // Options
        (error, device) => {
            if (error) {
                console.error("Scanning Error:", error);
                manager.stopDeviceScan();
                throw error;
            }
            
            // Found the target device (match by MAC address)
            if (device.id === DEVICE_MAC_ADDRESS || (DEVICE_NAME_FILTER && device.name === DEVICE_NAME_FILTER)) {
                manager.stopDeviceScan();
                onDeviceFound(device); // Callback to the UI layer
            }
        }
    );
};

/**
 * Connects to the device and starts monitoring the characteristic.
 * @param {Device} device - The device object found during scan.
 * @param {(parsedData) => void} onDataParsed - Callback when a complete EEG packet is decoded.
 */
export const connectAndMonitor = async (device, onDataParsed) => {
    try {
        // Stop any residual scanning
        manager.stopDeviceScan(); 
        
        // 1. Connect
        const connectedDevice = await device.connect();
        
        // 2. Discover
        await connectedDevice.discoverAllServicesAndCharacteristics();
        
        // 3. Monitor
        connectedDevice.monitorCharacteristicForService(
            DATA_SERVICE_UUID,        // The Service that contains the characteristic
            DATA_CHARACTERISTIC_UUID, // The Characteristic that holds the data
            (error, characteristic) => {
                if (error) {
                    console.error("Data monitoring error:", error);
                    return;
                }
                
                if (characteristic.value) {
                    // Data is in characteristic.value (Base64 string)
                    const rawBytes = Buffer.from(characteristic.value, 'base64');
                    const byteList = Array.from(rawBytes); 
                    
                    // Call the ThinkGear decoder
                    const parsedData = parseAndDecodeStream(byteList);
                    
                    // If the decoder returned a complete packet, send it to the UI
                    if (parsedData) {
                        onDataParsed(parsedData); 
                    }
                }
            }
        );
        
        return connectedDevice; // Return the device for connection management
        
    } catch (error) {
        console.error('Connection/Streaming Error:', error);
        throw error;
    }
};

/**
 * Connects to the device, discovers all services and characteristics, and logs the details.
 * This is the function to use to debug which UUIDs are correct.
 * @param {Device} device - The device object found during scan.
 */
export const discoverDeviceDetails = async (device) => {
    let connectedDevice = null;
    try {
        console.log(`Starting discovery for device: ${device.id}`);

        // 1. Connect
        connectedDevice = await device.connect();
        console.log('Connected.');
        
        // 2. Discover all services and characteristics
        await connectedDevice.discoverAllServicesAndCharacteristics();
        console.log('Discovered all services and characteristics.');

        // 3. Fetch services
        const services = await connectedDevice.services();
        const detailMap = {};
        
        // 

        for (const service of services) {
            const characteristics = await service.characteristics();
            
            const chars = characteristics.map(char => ({
                uuid: char.uuid,
                isNotifiable: char.isReadable ? char.isNotifiable : false, // Check if the char is notifiable/readable
                isReadable: char.isReadable,
                isWritable: char.isWritable,
            }));

            detailMap[service.uuid] = {
                serviceUUID: service.uuid,
                characteristics: chars
            };
        }

        console.log('--- DEVICE SERVICE AND CHARACTERISTIC MAP ---');
        console.log(JSON.stringify(detailMap, null, 2));
        console.log('---------------------------------------------');
        console.log('Review the output above. The data stream characteristic is likely the one marked "isNotifiable: true".');
        
        return detailMap;

    } catch (error) {
        console.error('Discovery Error:', error);
        throw error;
    } finally {
        if (connectedDevice) {
            // Ensure we disconnect gracefully
            await connectedDevice.cancelConnection().catch(e => console.warn("Failed to disconnect:", e));
            console.log('Disconnected after discovery.');
        }
    }
};


// Optional: Function to disconnect
export const disconnectDevice = async (device) => {
    if (device) {
        await device.cancelConnection();
        console.log("Disconnected successfully.");
    }
};

export default manager;