// mobile/context/BleContext.jsx
import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { Alert } from 'react-native';
import { scanAndConnect, connectAndMonitor, disconnectDevice } from '../services/BleService';
import { BLE_CONFIG } from '../constants/BleConfig';

const BleContext = createContext();

export const useBleContext = () => {
  const context = useContext(BleContext);
  if (!context) {
    throw new Error('useBleContext must be used within a BleProvider');
  }
  return context;
};

export const BleProvider = ({ children }) => {
  const [status, setStatus] = useState('Disconnected');
  const [device, setDevice] = useState(null);
  const [isConnecting, setIsConnecting] = useState(false);
  
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
  
  const [metrics, setMetrics] = useState({
    attention: 0,
    meditation: 0,
    poorSignal: 200,
  });

  const dataCountRef = useRef(0);
  const lastUpdateRef = useRef(Date.now());

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (device) {
        disconnectDevice(device);
      }
    };
  }, [device]);

  /**
   * Handle incoming data - Matches Python handle_notify logic
   */
  const handleDataReceived = (parsedData) => {
    dataCountRef.current += 1;
    const now = Date.now();

    // Update EEG band buffers when received
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

    // Update raw EEG buffer
    if (parsedData.rawEEG !== undefined) {
      setRawEEGBuffer(prev => {
        const newBuffer = [...prev, parsedData.rawEEG];
        return newBuffer.slice(-1000);
      });
    }

    // Update eSense metrics
    setMetrics(prev => ({
      attention: parsedData.attention !== undefined ? parsedData.attention : (parsedData.poorSignal !== undefined ? 0 : prev.attention),
      meditation: parsedData.meditation !== undefined ? parsedData.meditation : (parsedData.poorSignal !== undefined ? 0 : prev.meditation),
      poorSignal: parsedData.poorSignal !== undefined ? parsedData.poorSignal : prev.poorSignal,
    }));

    // Throttle UI updates
    if (now - lastUpdateRef.current > 50) {
      lastUpdateRef.current = now;
    }
  };

  const handleConnect = async () => {
    setIsConnecting(true);
    setStatus('Scanning...');
    
    try {
      await scanAndConnect(async (foundDevice) => {
        setStatus(`Found ${foundDevice.name || 'Device'}. Connecting...`);
        
        const connectedDevice = await connectAndMonitor(
          foundDevice,
          handleDataReceived
        );
        
        setDevice(connectedDevice);
        setStatus('Connected - Streaming Data');
        setIsConnecting(false);
      });
    } catch (error) {
      console.error('Connection error:', error);
      Alert.alert('Connection Error', error.message);
      setStatus('Connection Failed');
      setIsConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    if (device) {
      await disconnectDevice(device);
      setDevice(null);
      setStatus('Disconnected');
      
      // Reset all data
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
      setMetrics({ attention: 0, meditation: 0, poorSignal: 200 });
      dataCountRef.current = 0;
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
    metrics,
    dataCountRef,
    handleConnect,
    handleDisconnect,
    getStatusColor,
    hasBandData,
  };

  return <BleContext.Provider value={value}>{children}</BleContext.Provider>;
};