// mobile/app/ble-monitor.jsx
// Data handling logic ported from Python

import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Alert } from 'react-native';
import { scanAndConnect, connectAndMonitor, disconnectDevice } from '../services/BleService';
import EEGChart from '../components/EEGChart';
import { BLE_CONFIG } from '../constants/BleConfig';

export default function BleMonitorScreen() {
  const [status, setStatus] = useState('Disconnected');
  const [device, setDevice] = useState(null);
  const [isConnecting, setIsConnecting] = useState(false);
  
  // Data buffers matching Python implementation
  // Python: band_buffers = {band: deque(maxlen=MAX_POINTS) for band in [...]}
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
  
  // Python: raw_buffer = deque(maxlen=1000)
  const [rawEEGBuffer, setRawEEGBuffer] = useState([]);
  
  // Metrics from eSense values
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
    // Python: if "EEG_Bands" in p["parsed"]: band_buffers[band].append(val)
    if (parsedData.eegBands) {
      setBandData(prev => {
        const updated = { ...prev };
        Object.entries(parsedData.eegBands).forEach(([band, value]) => {
          // Maintain MAX_POINTS items (Python: deque(maxlen=MAX_POINTS))
          const newData = [...prev[band], value];
          updated[band] = newData.slice(-BLE_CONFIG.MAX_POINTS);
        });
        return updated;
      });
    }

    // Update raw EEG buffer
    // Python: if "RawEEG" in p["parsed"]: raw_buffer.append(...)
    if (parsedData.rawEEG !== undefined) {
      setRawEEGBuffer(prev => {
        const newBuffer = [...prev, parsedData.rawEEG];
        return newBuffer.slice(-1000); // maxlen=1000
      });
    }

    // Update eSense metrics
    // Python: Attention, Meditation, PoorSignal
    if (parsedData.attention !== undefined || 
        parsedData.meditation !== undefined || 
        parsedData.poorSignal !== undefined) {
      setMetrics(prev => ({
        attention: parsedData.attention ?? prev.attention,
        meditation: parsedData.meditation ?? prev.meditation,
        poorSignal: parsedData.poorSignal ?? prev.poorSignal,
      }));
    }

    // Throttle UI updates to avoid overwhelming React
    // Update at most every 50ms (20 FPS)
    if (now - lastUpdateRef.current > 50) {
      lastUpdateRef.current = now;
    }
  };

  /**
   * Connect to device
   */
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

  /**
   * Disconnect from device
   */
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

  /**
   * Get status color
   */
  const getStatusColor = () => {
    if (status.includes('Streaming')) return '#4CAF50';
    if (status.includes('Connecting') || status.includes('Scanning')) return '#FF9800';
    if (status.includes('Failed')) return '#F44336';
    return '#999';
  };

  /**
   * Check if we have any band data
   */
  const hasBandData = Object.values(bandData).some(arr => arr.length > 0);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>EEG Monitor</Text>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor() }]}>
          <Text style={styles.statusText}>{status}</Text>
        </View>
      </View>

      {/* Connection Controls */}
      <View style={styles.controls}>
        <TouchableOpacity
          style={[styles.button, styles.connectButton, isConnecting && styles.buttonDisabled]}
          onPress={handleConnect}
          disabled={isConnecting || device !== null}
        >
          <Text style={styles.buttonText}>
            {device ? '✓ Connected' : 'Connect to Device'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.disconnectButton, !device && styles.buttonDisabled]}
          onPress={handleDisconnect}
          disabled={!device}
        >
          <Text style={styles.buttonText}>Disconnect</Text>
        </TouchableOpacity>
      </View>

      {/* Metrics Display */}
      {device && (
        <View style={styles.metricsContainer}>
          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>Signal Quality</Text>
            <Text style={[
              styles.metricValue,
              { color: metrics.poorSignal < 50 ? '#4CAF50' : '#F44336' }
            ]}>
              {metrics.poorSignal < 50 ? 'Good' : metrics.poorSignal < 100 ? 'Fair' : 'Poor'}
            </Text>
            <Text style={styles.metricSubtext}>({metrics.poorSignal}/200)</Text>
          </View>

          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>Attention</Text>
            <Text style={styles.metricValue}>{metrics.attention}</Text>
            <Text style={styles.metricSubtext}>eSense</Text>
          </View>

          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>Meditation</Text>
            <Text style={styles.metricValue}>{metrics.meditation}</Text>
            <Text style={styles.metricSubtext}>eSense</Text>
          </View>

          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>Data Points</Text>
            <Text style={styles.metricValue}>{dataCountRef.current}</Text>
            <Text style={styles.metricSubtext}>
              {hasBandData ? '✓ Bands' : 'Raw only'}
            </Text>
          </View>
        </View>
      )}

      {/* Charts */}
      <ScrollView style={styles.chartContainer} showsVerticalScrollIndicator={false}>
        {device && hasBandData ? (
          <EEGChart bandData={bandData} rawBuffer={rawEEGBuffer} />
        ) : device ? (
          <View style={styles.waitingContainer}>
            <Text style={styles.waitingText}>📡 Receiving data...</Text>
            <Text style={styles.waitingSubtext}>
              Waiting for EEG band powers (arrives every ~1 second)
            </Text>
            <Text style={styles.waitingSubtext}>
              Raw EEG samples: {rawEEGBuffer.length}
            </Text>
          </View>
        ) : (
          <View style={styles.waitingContainer}>
            <Text style={styles.waitingText}>👆 Connect to your device to start</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    backgroundColor: '#fff',
    padding: 20,
    paddingTop: 50,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
    alignSelf: 'flex-start',
  },
  statusText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  controls: {
    flexDirection: 'row',
    padding: 15,
    gap: 10,
  },
  button: {
    flex: 1,
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  connectButton: {
    backgroundColor: '#2196F3',
  },
  disconnectButton: {
    backgroundColor: '#F44336',
  },
  buttonDisabled: {
    backgroundColor: '#ccc',
    opacity: 0.6,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  metricsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 10,
    gap: 10,
  },
  metricCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  metricLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 5,
  },
  metricValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  metricSubtext: {
    fontSize: 10,
    color: '#999',
    marginTop: 2,
  },
  chartContainer: {
    flex: 1,
  },
  waitingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
    minHeight: 300,
  },
  waitingText: {
    fontSize: 18,
    color: '#666',
    textAlign: 'center',
    marginBottom: 10,
  },
  waitingSubtext: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    marginTop: 5,
  },
});