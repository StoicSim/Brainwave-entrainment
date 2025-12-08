import React, { useRef } from 'react';
import { View, Text, TouchableWithoutFeedback, ScrollView, StyleSheet } from 'react-native';
import { useBleContext } from '../context/BleContext';

export default function AnalysisScreen() {
  const {
    device,
    bandData,
    rawEEGBuffer,
    metrics,
  } = useBleContext();

  const lastTap = useRef(null);

  const bands = [
    { key: 'Delta', color: '#9C27B0', freq: '0.5-4 Hz', desc: 'Deep sleep' },
    { key: 'Theta', color: '#3F51B5', freq: '4-8 Hz', desc: 'Meditation' },
    { key: 'AlphaLow', color: '#4CAF50', freq: '8-10 Hz', desc: 'Relaxation' },
    { key: 'AlphaHigh', color: '#8BC34A', freq: '10-13 Hz', desc: 'Calm focus'},
    { key: 'BetaLow', color: '#FF9800', freq: '13-17 Hz', desc: 'Active thinking' },
    { key: 'BetaHigh', color: '#FF5722', freq: '17-30 Hz', desc: 'High alertness' },
    { key: 'GammaLow', color: '#F44336', freq: '30-40 Hz', desc: 'Peak focus' },
    { key: 'GammaHigh', color: '#E91E63', freq: '40-50 Hz', desc: 'Cognitive peak' },
  ];

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
        <TouchableWithoutFeedback>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Deep Analysis</Text>
            <Text style={styles.headerSubtitle}>Detailed Session Insights</Text>
           
          </View>
        </TouchableWithoutFeedback>

        {!device ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>🔬</Text>
            <Text style={styles.emptyTitle}>No Data Available</Text>
            <Text style={styles.emptyText}>
              Connect your device in the Monitor tab to see detailed analysis
            </Text>
          </View>
        ) : (
          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            <TouchableWithoutFeedback onPress={handleDoubleTap}>
              <View>
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>EEG Band Analysis</Text>
                  
                  {bands.map((band) => {
                    const values = bandData[band.key];
                    if (!values || values.length === 0) return null;

                    const currentValue = values[values.length - 1];
                    const avgValue = values.reduce((a, b) => a + b, 0) / values.length;

                    return (
                      <View 
                        key={band.key} 
                        style={[
                          styles.analysisCard,
                          band.highlight && styles.analysisCardHighlight
                        ]}
                      >
                        <View style={styles.analysisHeader}>
                          <View style={styles.analysisHeaderLeft}>
                            <View style={[styles.colorDot, { backgroundColor: band.color }]} />
                            <View>
                              <Text style={styles.analysisBandName}>
                                {band.highlight ? '⭐ ' : ''}{band.key}
                              </Text>
                              <Text style={styles.analysisFreq}>{band.freq}</Text>
                            </View>
                          </View>
                          <Text style={styles.analysisDesc}>{band.desc}</Text>
                        </View>
                        
                        <View style={styles.analysisStats}>
                          <View style={styles.analysisStat}>
                            <Text style={styles.analysisStatLabel}>Current</Text>
                            <Text style={styles.analysisStatValue}>
                              {Math.round(currentValue).toLocaleString()}
                            </Text>
                          </View>
                          <View style={styles.analysisStat}>
                            <Text style={styles.analysisStatLabel}>Average</Text>
                            <Text style={styles.analysisStatValue}>
                              {Math.round(avgValue).toLocaleString()}
                            </Text>
                          </View>
                          <View style={styles.analysisStat}>
                            <Text style={styles.analysisStatLabel}>Samples</Text>
                            <Text style={styles.analysisStatValue}>{values.length}</Text>
                          </View>
                        </View>
                      </View>
                    );
                  })}
                </View>

                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Raw EEG Data</Text>
                  <View style={styles.infoCard}>
                    <View style={styles.infoRow}>
                      <Text style={styles.infoLabel}>Total Samples:</Text>
                      <Text style={styles.infoValue}>{rawEEGBuffer.length}</Text>
                    </View>
                    <View style={styles.infoRow}>
                      <Text style={styles.infoLabel}>Latest Value:</Text>
                      <Text style={styles.infoValue}>
                        {rawEEGBuffer.length > 0 ? rawEEGBuffer[rawEEGBuffer.length - 1] : 'N/A'}
                      </Text>
                    </View>
                    <View style={styles.infoRow}>
                      <Text style={styles.infoLabel}>Sample Rate:</Text>
                      <Text style={styles.infoValue}>512 Hz</Text>
                    </View>
                  </View>
                </View>

                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Session Summary</Text>
                  <View style={styles.summaryCard}>
                    <Text style={styles.summaryText}>
                      Signal quality is {metrics.poorSignal < 50 ? 'good' : 'poor'}.
                    </Text>
                    {metrics.poorSignal < 50 && (
                      <>
                        <Text style={styles.summaryText}>
                          Your attention level is at {metrics.attention}/100.
                        </Text>
                        <Text style={styles.summaryText}>
                          Your meditation level is at {metrics.meditation}/100.
                        </Text>
                      </>
                    )}
                    <Text style={styles.summaryText}>
                      Recording {Object.values(bandData).filter(arr => arr.length > 0).length}/8 frequency bands.
                    </Text>
                  </View>
                </View>
              </View>
            </TouchableWithoutFeedback>
          </ScrollView>
        )}
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
    marginBottom: 5,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#666',
  },
  headerHint: {
    fontSize: 10,
    color: '#999',
    marginTop: 5,
  },
  content: {
    flex: 1,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
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
  section: {
    padding: 15,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
  },
  analysisCard: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 15,
    marginBottom: 10,
  },
  analysisCardHighlight: {
    backgroundColor: '#F1F8E9',
    borderWidth: 2,
    borderColor: '#8BC34A',
  },
  analysisHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  analysisHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  colorDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  analysisBandName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  analysisFreq: {
    fontSize: 12,
    color: '#999',
  },
  analysisDesc: {
    fontSize: 12,
    color: '#666',
    fontStyle: 'italic',
  },
  analysisStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  analysisStat: {
    alignItems: 'center',
  },
  analysisStatLabel: {
    fontSize: 11,
    color: '#999',
    marginBottom: 4,
  },
  analysisStatValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
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
  summaryCard: {
    backgroundColor: '#E3F2FD',
    borderRadius: 10,
    padding: 15,
  },
  summaryText: {
    fontSize: 14,
    color: '#1976D2',
    marginBottom: 8,
    lineHeight: 20,
  },
});