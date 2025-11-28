
import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Alert } from 'react-native';
import { scanAndConnect, connectAndMonitor, disconnectDevice } from '../services/BleService';
import EEGChart from '../components/EEGChart';
import { BLE_CONFIG } from '../constants/BleConfig';

export default function BleMonitorScreen() {
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

    // Update eSense metrics - default to 0 if not provided
    // Python: Attention, Meditation, PoorSignal
    setMetrics(prev => ({
      attention: parsedData.attention !== undefined ? parsedData.attention : (parsedData.poorSignal !== undefined ? 0 : prev.attention),
      meditation: parsedData.meditation !== undefined ? parsedData.meditation : (parsedData.poorSignal !== undefined ? 0 : prev.meditation),
      poorSignal: parsedData.poorSignal !== undefined ? parsedData.poorSignal : prev.poorSignal,
    }));

    // Throttle UI updates to avoid overwhelming React
    // Update at most every 50ms (20 FPS)
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

      {device && (
        <>
          {metrics.poorSignal > 50 && (
            <View style={styles.warningBanner}>
              <Text style={styles.warningIcon}>⚠️</Text>
              <View style={styles.warningTextContainer}>
                <Text style={styles.warningTitle}>Poor Signal Quality</Text>
                <Text style={styles.warningText}>
                  {metrics.poorSignal === 200 
                    ? 'No sensor contact - Adjust headset placement'
                    : 'Weak signal - Ensure sensors touch skin firmly'}
                </Text>
              </View>
            </View>
          )}
          
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

            <View style={[styles.metricCard, metrics.poorSignal > 50 && styles.metricCardDisabled]}>
              <Text style={styles.metricLabel}>Attention</Text>
              <Text style={[styles.metricValue, metrics.poorSignal > 50 && styles.metricDisabled]}>
                {metrics.attention}
              </Text>
              <Text style={styles.metricSubtext}>
                {metrics.poorSignal > 50 ? 'Need good signal' : 'eSense'}
              </Text>
            </View>

            <View style={[styles.metricCard, metrics.poorSignal > 50 && styles.metricCardDisabled]}>
              <Text style={styles.metricLabel}>Meditation</Text>
              <Text style={[styles.metricValue, metrics.poorSignal > 50 && styles.metricDisabled]}>
                {metrics.meditation}
              </Text>
              <Text style={styles.metricSubtext}>
                {metrics.poorSignal > 50 ? 'Need good signal' : 'eSense'}
              </Text>
            </View>

            <View style={styles.metricCard}>
              <Text style={styles.metricLabel}>Data Points</Text>
              <Text style={styles.metricValue}>{dataCountRef.current}</Text>
              <Text style={styles.metricSubtext}>
                {hasBandData ? '✓ Bands' : 'Raw only'}
              </Text>
            </View>
          </View>
        </>
      )}

      {/* Charts */}
     <ScrollView style={styles.chartContainer} showsVerticalScrollIndicator={false}>
  {device ? (
    <>
      {/* Debug info */}
      <View style={styles.debugContainer}>
        <Text style={styles.debugText}>
          Delta: {bandData.Delta?.length || 0} | 
          Theta: {bandData.Theta?.length || 0} | 
          Alpha: {bandData.AlphaLow?.length || 0}
        </Text>
        <Text style={styles.debugText}>
          Raw: {rawEEGBuffer.length} samples | Packets: {dataCountRef.current}
        </Text>
      </View>

      {/* Render chart when we have enough data */}
      {(hasBandData && bandData.Delta?.length >= 3) || rawEEGBuffer.length >= 10 ? (
        <EEGChart 
          bandData={bandData} 
          rawBuffer={rawEEGBuffer}
        />
      ) : (
        <View style={styles.waitingContainer}>
          <Text style={styles.waitingText}>📡 Receiving data...</Text>
          <Text style={styles.waitingSubtext}>
            Band data: {bandData.Delta?.length || 0}/3 points
          </Text>
          <Text style={styles.waitingSubtext}>
            Raw samples: {rawEEGBuffer.length}/10
          </Text>
          <Text style={styles.waitingSubtext}>
            Packets: {dataCountRef.current}
          </Text>
        </View>
      )}
    </>
  ) : (
    <View style={styles.waitingContainer}>
      <Text style={styles.waitingText}> Connect to your device to start</Text>
    </View>
  )}
</ScrollView>

    </View>
  );
}

const styles = StyleSheet.create({
  debugContainer: {
    backgroundColor: '#FFF9C4',
    padding: 10,
    margin: 15,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: '#FBC02D',
  },
  debugText: {
    fontSize: 11,
    color: '#F57F17',
    fontFamily: 'monospace',
  },

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
  warningBanner: {
    backgroundColor: '#FFF3E0',
    borderLeftWidth: 4,
    borderLeftColor: '#FF9800',
    padding: 15,
    marginHorizontal: 15,
    marginBottom: 10,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  warningIcon: {
    fontSize: 24,
    marginRight: 10,
  },
  warningTextContainer: {
    flex: 1,
  },
  warningTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#E65100',
    marginBottom: 3,
  },
  warningText: {
    fontSize: 12,
    color: '#EF6C00',
  },
  metricCardDisabled: {
    opacity: 0.5,
  },
  metricDisabled: {
    color: '#999',
  },
});