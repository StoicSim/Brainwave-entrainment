import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { Alert, Platform } from 'react-native';
import { BLE_CONFIG } from '../constants/BleConfig';
import EEGProcessor from '../utils/EEGProcessor';
import manager, { scanAndConnect, connectAndMonitor, disconnectDevice, stopScan } from '../services/BleService';
const BleContext = createContext();

export const useBleContext = () => {
  const context = useContext(BleContext);
  if (!context) {
    throw new Error('useBleContext must be used within a BleProvider');
  }
  return context;
};

export const BleProvider = ({ children }) => {
  const isCancelledRef = useRef(false);
  const [status, setStatus] = useState('Disconnected');
  const [isPaused, setIsPaused] = useState(false);
  const [device, setDevice] = useState(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [bleError, setBleError] = useState(null); // NEW: track BLE error state
  
  const [bandData, setBandData] = useState({
    Delta: [],
    Theta: [],
    AlphaLow: [],
    AlphaHigh: [],
    BetaLow: [],
    BetaHigh: [],
    GammaLow: [],
    GammaHigh: [],
  });
  
  const [rawEEGBuffer, setRawEEGBuffer] = useState([]);
  
  const [psdData, setPsdData] = useState({
    frequencies: [],
    psd: [],
    bandPowers: {},
    iaf: { frequency: 10, power: 0 },
  });
  
  const [metrics, setMetrics] = useState({
    attention: 0,
    meditation: 0,
    poorSignal: 200,
  });

  const dataCountRef = useRef(0);
  const lastUpdateRef = useRef(Date.now());
  const eegProcessorRef = useRef(new EEGProcessor(512, 512));

  useEffect(() => {
    return () => {
      if (device) {
        disconnectDevice(device);
      }
    };
  }, [device]);
useEffect(() => {
  if (!device) return; // only set up listener when we have a connected device

  const subscription = manager.onDeviceDisconnected(
    device.id,
    (error, disconnectedDevice) => {
      console.warn('Device disconnected unexpectedly:', error?.message);
      resetToDisconnected();
    }
  );

  return () => {
    subscription?.remove();
  };
}, [device?.id]); // depend on device.id not device object
  // Classify BLE errors into user-friendly messages
  const classifyBleError = (error) => {
    const message = error?.message?.toLowerCase() || '';
    const reason = error?.reason?.toLowerCase() || '';
    const combined = message + reason;

    if (
      combined.includes('bluetooth') && combined.includes('off') ||
      combined.includes('powered off') ||
      combined.includes('bluetooth is off') ||
      combined.includes('ble is off') ||
      error?.errorCode === 'BluetoothUnauthorized' ||
      error?.errorCode === 'BluetoothPoweredOff'
    ) {
      return {
        type: 'bluetooth_off',
        title: 'Bluetooth is Off',
        message: 'Please turn on Bluetooth and try again.',
      };
    }

    if (
      combined.includes('location') ||
      combined.includes('permission') ||
      combined.includes('unauthorized') ||
      combined.includes('denied')
    ) {
      return {
        type: 'permission',
        title: 'Permission Required',
        message: Platform.OS === 'android'
          ? 'Location and Bluetooth permissions are required to scan for devices. Please enable them in your device settings.'
          : 'Bluetooth permission is required. Please enable it in your device settings.',
      };
    }

    if (
      combined.includes('timeout') ||
      combined.includes('not found') ||
      combined.includes('no device')
    ) {
      return {
        type: 'not_found',
        title: 'Device Not Found',
        message: 'Could not find your EEG device. Make sure the headset is powered on and nearby, then try again.',
      };
    }

    if (
      combined.includes('disconnected') ||
      combined.includes('connection failed') ||
      combined.includes('gatt')
    ) {
      return {
        type: 'connection_failed',
        title: 'Connection Failed',
        message: 'Could not connect to the device. Please make sure the headset is on and try again.',
      };
    }

    return {
      type: 'unknown',
      title: 'Connection Error',
      message: 'Something went wrong. Please check your device and try again.',
    };
  };

  const resetToDisconnected = () => {
    setDevice(null);
    setStatus('Disconnected');
    setIsConnecting(false);
    setBleError(null);
    setBandData({
      Delta: [],
      Theta: [],
      AlphaLow: [],
      AlphaHigh: [],
      BetaLow: [],
      BetaHigh: [],
      GammaLow: [],
      GammaHigh: [],
    });
    setRawEEGBuffer([]);
    setPsdData({
      frequencies: [],
      psd: [],
      bandPowers: {},
      iaf: { frequency: 10, power: 0 },
    });
    setMetrics({ attention: 0, meditation: 0, poorSignal: 200 });
    dataCountRef.current = 0;
    eegProcessorRef.current.reset();
  };

  const handleDataReceived = (parsedData) => {
    dataCountRef.current += 1;
    const now = Date.now();

    if (isPaused) {
      if (parsedData.poorSignal !== undefined) {
        setMetrics(prev => ({
          ...prev,
          poorSignal: parsedData.poorSignal,
        }));
      }
      return;
    }

    if (parsedData.eegBands) {
      setBandData(prev => {
        const updated = { ...prev };
        Object.entries(parsedData.eegBands).forEach(([band, value]) => {
          const newData = [...prev[band], value];
          updated[band] = newData.slice(-BLE_CONFIG.MAX_POINTS);
        });
        return updated;
      });
    }

    if (parsedData.rawEEG !== undefined) {
      setRawEEGBuffer(prev => {
        const newBuffer = [...prev, parsedData.rawEEG];
        return newBuffer.slice(-1000);
      });
      
      const psdResult = eegProcessorRef.current.addSample(parsedData.rawEEG);
      
      if (psdResult) {
        const iaf = eegProcessorRef.current.findIAF(
          psdResult.frequencies, 
          psdResult.psd
        );
        
        setPsdData({
          frequencies: psdResult.frequencies,
          psd: psdResult.psd,
          bandPowers: psdResult.bandPowers,
          iaf: iaf,
        });
      }
    }

    setMetrics(prev => ({
      attention: parsedData.attention !== undefined ? parsedData.attention : (parsedData.poorSignal !== undefined ? 0 : prev.attention),
      meditation: parsedData.meditation !== undefined ? parsedData.meditation : (parsedData.poorSignal !== undefined ? 0 : prev.meditation),
      poorSignal: parsedData.poorSignal !== undefined ? parsedData.poorSignal : prev.poorSignal,
    }));

    if (now - lastUpdateRef.current > 50) {
      lastUpdateRef.current = now;
    }
  };

  const pauseDataCollection = () => {
    setIsPaused(true);
    setTimeout(() => {
      setRawEEGBuffer([]);
    }, 100);
  };

  const resumeDataCollection = () => {
    setIsPaused(false);
  };

  const handleConnect = async () => {
  setIsConnecting(true);
  setStatus('Scanning...');
  setBleError(null);
  isCancelledRef.current = false; // reset cancel flag

  try {
    await scanAndConnect(async (foundDevice) => {
      // Check if user cancelled before we even try to connect
      if (isCancelledRef.current) {
        console.warn('Connection cancelled before connecting.');
        return;
      }

      setStatus(`Found ${foundDevice.name || 'Device'}. Connecting...`);

      const connectedDevice = await connectAndMonitor(
        foundDevice,
        handleDataReceived
      );

      // Check again after connection completes — user may have cancelled during connect
      if (isCancelledRef.current) {
        console.warn('Connection cancelled after connecting — disconnecting immediately.');
        await disconnectDevice(connectedDevice);
        resetToDisconnected();
        return;
      }

      setDevice(connectedDevice);
      setStatus('Connected - Streaming Data');
      setIsConnecting(false);
      setBleError(null);
    });
  } catch (error) {
    if (isCancelledRef.current) {
      // Cancelled — don't show error alert
      resetToDisconnected();
      return;
    }

    console.warn('Connection error (handled):', error.message);
    const classified = classifyBleError(error);
    setBleError(classified);
    setStatus('Connection Failed');
    setIsConnecting(false);
    resetToDisconnected();

    Alert.alert(
      classified.title,
      classified.message,
      [{ text: 'OK' }]
    );
  }
};

const cancelConnection = () => {
  isCancelledRef.current = true; // set flag FIRST before stopping scan
  stopScan();
  resetToDisconnected();
};
  const handleDisconnect = async () => {
    if (device) {
      try {
        await disconnectDevice(device);
      } catch (error) {
        console.warn('Disconnect error (ignored):', error);
      }
      resetToDisconnected();
    }
  };

  const getStatusColor = () => {
    if (status.includes('Streaming')) return '#4CAF50';
    if (status.includes('Connecting') || status.includes('Scanning')) return '#FF9800';
    if (status.includes('Failed')) return '#F44336';
    return '#999';
  };

  const hasBandData = () => {
    return Object.values(bandData).some(arr => arr.length > 0);
  };

  const value = {
    status,
    device,
    isConnecting,
    bandData,
    rawEEGBuffer,
    psdData,
    metrics,
    dataCountRef,
    isPaused,
    bleError,          // expose error state so screens can react
    handleConnect,
    cancelConnection,
    handleDisconnect,
    pauseDataCollection,
    resumeDataCollection,
    resetToDisconnected,
    getStatusColor,
    hasBandData,
  };

  return <BleContext.Provider value={value}>{children}</BleContext.Provider>;
};