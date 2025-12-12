import React, { useRef } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, TouchableWithoutFeedback } from 'react-native';
import { useBleContext } from '../context/BleContext';

export default function MonitorScreen() {
  const {
    status,
    device,
    isConnecting,
    metrics,
    dataCountRef,
    hasBandData,
    handleConnect,
    handleDisconnect,
    getStatusColor,
  } = useBleContext();

  const lastTap = useRef(null);

  const handleDoubleTap = () => {
    const now = Date.now();
    const DOUBLE_TAP_DELAY = 300; // milliseconds

    if (lastTap.current && (now - lastTap.current) < DOUBLE_TAP_DELAY) {
      // Double tap detected
      if (global.toggleTabBarUI) {
        global.toggleTabBarUI();
      }
      lastTap.current = null;
    } else {
      lastTap.current = now;
    }
  };

  return (
    <TouchableWithoutFeedback onPress={handleDoubleTap}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>EEG Monitor</Text>
          <View style={[styles.statusBadge, { backgroundColor: getStatusColor() }]}>
            <View style={styles.statusDot} />
            <Text style={styles.statusText}>{status.split(' - ')[0]}</Text>
          </View>
        </View>

        <ScrollView 
          style={styles.content} 
          showsVerticalScrollIndicator={false}
        >
          <TouchableWithoutFeedback onPress={handleDoubleTap}>
            <View>
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Device Connection</Text>
                <View style={styles.controls}>
                  <TouchableOpacity
                    style={[styles.button, styles.connectButton, (isConnecting || device !== null) && styles.buttonDisabled]}
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
              </View>

              {!device ? (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyIcon}>🔌</Text>
                  <Text style={styles.emptyTitle}>No Device Connected</Text>
                  <Text style={styles.emptyText}>
                    Connect your EEG headset to start monitoring your brainwaves
                  </Text>
                  <Text style={styles.emptySubtext}>Double-tap anywhere to toggle UI</Text>
                </View>
              ) : (
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

                  <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Real-time Metrics</Text>
                    <View style={styles.metricsGrid}>
                      <View style={styles.metricCard}>
                        <Text style={styles.metricIcon}>📡</Text>
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
                        <Text style={styles.metricIcon}>🎯</Text>
                        <Text style={styles.metricLabel}>Attention</Text>
                        <Text style={[styles.metricValue, metrics.poorSignal > 50 && styles.metricDisabled]}>
                          {metrics.attention}
                        </Text>
                        <Text style={styles.metricSubtext}>
                          {metrics.poorSignal > 50 ? 'Need good signal' : 'eSense'}
                        </Text>
                      </View>

                      <View style={[styles.metricCard, metrics.poorSignal > 50 && styles.metricCardDisabled]}>
                        <Text style={styles.metricIcon}>🧘</Text>
                        <Text style={styles.metricLabel}>Meditation</Text>
                        <Text style={[styles.metricValue, metrics.poorSignal > 50 && styles.metricDisabled]}>
                          {metrics.meditation}
                        </Text>
                        <Text style={styles.metricSubtext}>
                          {metrics.poorSignal > 50 ? 'Need good signal' : 'eSense'}
                        </Text>
                      </View>

                      <View style={styles.metricCard}>
                        <Text style={styles.metricIcon}>📊</Text>
                        <Text style={styles.metricLabel}>Data Points</Text>
                        <Text style={styles.metricValue}>{dataCountRef.current}</Text>
                        <Text style={styles.metricSubtext}>
                          {hasBandData() ? '✓ Bands' : 'Raw only'}
                        </Text>
                      </View>
                    </View>
                  </View>

                  <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Session Info</Text>
                    <View style={styles.infoCard}>
                      <View style={styles.infoRow}>
                        <Text style={styles.infoLabel}>Status:</Text>
                        <Text style={[styles.infoValue, { color: getStatusColor() }]}>{status}</Text>
                      </View>
                      <View style={styles.infoRow}>
                        <Text style={styles.infoLabel}>Packets Received:</Text>
                        <Text style={styles.infoValue}>{dataCountRef.current}</Text>
                      </View>
                      <View style={styles.infoRow}>
                        <Text style={styles.infoLabel}>Band Data:</Text>
                        <Text style={styles.infoValue}>{hasBandData() ? 'Available' : 'Not yet'}</Text>
                      </View>
                    </View>
                  </View>
                </>
              )}
            </View>
          </TouchableWithoutFeedback>
        </ScrollView>
      </View>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    backgroundColor: '#fff',
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
    alignSelf: 'flex-start',
    gap: 6,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#fff',
  },
  statusText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  section: {
    padding: 15,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
  },
  controls: {
    flexDirection: 'row',
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
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
    minHeight: 400,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
  },
  emptyText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
  },
  emptySubtext: {
    fontSize: 12,
    color: '#999',
    textAlign: 'center',
    marginTop: 10,
    fontStyle: 'italic',
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
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
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
  metricIcon: {
    fontSize: 32,
    marginBottom: 8,
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
  metricCardDisabled: {
    opacity: 0.5,
  },
  metricDisabled: {
    color: '#999',
  },
  infoCard: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 15,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  infoLabel: {
    fontSize: 14,
    color: '#666',
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
});