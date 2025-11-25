// mobile/app/ble-monitor.jsx

import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Alert } from 'react-native';
import { scanAndConnect, connectAndMonitor, disconnectDevice } from '../services/BleService';
import EEGChart from '../components/EEGChart';
import { BLE_CONFIG } from '../constants/BleConfig';

export default function BleMonitorScreen() {
  const [status, setStatus] = useState('Disconnected');
  const [device, setDevice] = useState(null);
  const [isConnecting, setIsConnecting] = useState(false);
  
  // EEG data buffers (matching Python implementation)
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
  
  const [metrics, setMetrics] = useState({
    attention: 0,
    meditation: 0,
    poorSignal: 200, // Start at max (no signal)
  });

  const [rawEEGBuffer, setRawEEGBuffer] = useState([]);
  const dataCountRef = useRef(0);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (device) {
        disconnectDevice(device);
      }
    };
  }, [device]);

  /**
   * Handle incoming EEG data packets
   */
  const handleDataReceived = (parsedData) => {
    dataCountRef.current += 1;

    // Update EEG band powers
    if (parsedData.eegBands) {
      setBandData(prev => {
        const updated = { ...prev };
        Object.entries(parsedData.eegBands).forEach(([band, value]) => {
          updated[band] = [...prev[band], value].slice(-BLE_CONFIG.MAX_POINTS);
        });
        return updated;
      });
    }

    // Update eSense metrics
    if (parsedData.attention !== undefined || 
        parsedData.meditation !== undefined || 
        parsedData.poorSignal !== undefined) {
      setMetrics(prev => ({
        attention: parsedData.attention ?? prev.attention,
        meditation: parsedData.meditation ?? prev.meditation,
        poorSignal: parsedData.poorSignal ?? prev.poorSignal,
      }));
    }

    // Update raw EEG buffer (for future filtering/analysis)
    if (parsedData.rawEEG !== undefined) {
      setRawEEGBuffer(prev => [...prev, parsedData.rawEEG].slice(-1000));
    }
  };

  /**
   * Scan and connect to device
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
      
      // Reset data
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
      setMetrics({ attention: 0, meditation: 0, poorSignal: 200 });
      setRawEEGBuffer([]);
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
            {device ? 'Connected' : 'Connect to Device'}
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

      {/* Metrics */}
      {device && (
        <View style={styles.metricsContainer}>
          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>Signal Quality</Text>
            <Text style={[
              styles.metricValue,
              { color: metrics.poorSignal < 50 ? '#4CAF50' : '#F44336' }
            ]}>
              {metrics.poorSignal < 50 ? 'Good' : 'Poor'}
            </Text>
            <Text style={styles.metricSubtext}>({metrics.poorSignal}/200)</Text>
          </View>

          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>Attention</Text>
            <Text style={styles.metricValue}>{metrics.attention}</Text>
            <Text style={styles.metricSubtext}>0-100</Text>
          </View>

          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>Meditation</Text>
            <Text style={styles.metricValue}>{metrics.meditation}</Text>
            <Text style={styles.metricSubtext}>0-100</Text>
          </View>

          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>Data Points</Text>
            <Text style={styles.metricValue}>{dataCountRef.current}</Text>
            <Text style={styles.metricSubtext}>received</Text>
          </View>
        </View>
      )}

      {/* Charts */}
      <ScrollView style={styles.chartContainer} showsVerticalScrollIndicator={false}>
        <EEGChart bandData={bandData} />
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
});