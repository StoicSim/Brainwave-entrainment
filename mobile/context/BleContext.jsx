import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { Alert } from 'react-native';
import { scanAndConnect, connectAndMonitor, disconnectDevice } from '../services/BleService';
import { BLE_CONFIG } from '../constants/BleConfig';
import EEGProcessor from '../utils/EEGProcessor';

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
  
  // NEW: PSD data state
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
  
  // NEW: Initialize EEG Processor
  const eegProcessorRef = useRef(new EEGProcessor(512, 512)); // 512 Hz, 1 second window

  useEffect(() => {
    return () => {
      if (device) {
        disconnectDevice(device);
      }
    };
  }, [device]);

  const handleDataReceived = (parsedData) => {
    dataCountRef.current += 1;
    const now = Date.now();

    // Handle band power data from device
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

    // Handle raw EEG data
    if (parsedData.rawEEG !== undefined) {
      setRawEEGBuffer(prev => {
        const newBuffer = [...prev, parsedData.rawEEG];
        return newBuffer.slice(-1000);
      });
      
      // NEW: Process raw EEG through FFT
      const psdResult = eegProcessorRef.current.addSample(parsedData.rawEEG);
      
      if (psdResult) {
        // Calculate IAF
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
    handleConnect,
    handleDisconnect,
    getStatusColor,
    hasBandData,
  };

  return <BleContext.Provider value={value}>{children}</BleContext.Provider>;
};