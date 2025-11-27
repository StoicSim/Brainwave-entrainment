// mobile/components/EEGChart.jsx
// Ultra simple - just display values, no charts to avoid crashes

import React from 'react';
import { View, Text, StyleSheet, ScrollView, Dimensions } from 'react-native';

const { width } = Dimensions.get('window');

export default function EEGChart({ bandData, rawBuffer }) {
  // Safety check
  if (!bandData) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>No data</Text>
      </View>
    );
  }

  // Check if we have any data
  const hasData = Object.values(bandData).some(arr => arr && arr.length > 0);

  if (!hasData) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>⏳ Waiting for EEG data...</Text>
        <Text style={styles.emptySubtext}>
          Raw samples: {rawBuffer?.length || 0}
        </Text>
      </View>
    );
  }

  // Calculate Alpha stats
  const alphaLowVal = bandData.AlphaLow?.[bandData.AlphaLow.length - 1] || 0;
  const alphaHighVal = bandData.AlphaHigh?.[bandData.AlphaHigh.length - 1] || 0;
  const avgAlpha = (alphaLowVal + alphaHighVal) / 2;

  return (
    <ScrollView style={styles.container}>
      {/* Alpha Focus */}
      <View style={styles.alphaContainer}>
        <Text style={styles.alphaTitle}>🧠 Alpha Wave Power</Text>
        <Text style={styles.alphaValue}>
          {formatNumber(avgAlpha)}
        </Text>
        <View style={styles.alphaDetails}>
          <Text style={styles.alphaDetailText}>
            Low: {formatNumber(alphaLowVal)}
          </Text>
          <Text style={styles.alphaDetailText}>
            High: {formatNumber(alphaHighVal)}
          </Text>
        </View>
      </View>

      {/* All Band Values */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>📊 EEG Band Powers</Text>
        
        {['Delta', 'Theta', 'AlphaLow', 'AlphaHigh', 'BetaLow', 'BetaHigh', 'GammaLow', 'GammaHigh'].map((band) => {
          const values = bandData[band];
          if (!values || values.length === 0) return null;

          const currentValue = values[values.length - 1];
          const isAlpha = band.includes('Alpha');

          return (
            <View 
              key={band} 
              style={[styles.bandRow, isAlpha && styles.alphaBandRow]}
            >
              <View style={styles.bandInfo}>
                <Text style={[styles.bandName, isAlpha && styles.alphaBandName]}>
                  {isAlpha ? '⭐ ' : ''}{band}
                </Text>
                <Text style={styles.bandFreq}>{getFrequency(band)}</Text>
              </View>
              <View style={styles.bandValueContainer}>
                <Text style={styles.bandValue}>
                  {formatNumber(currentValue)}
                </Text>
                <Text style={styles.bandSamples}>
                  {values.length} samples
                </Text>
              </View>
            </View>
          );
        })}
      </View>

      {/* Raw EEG Info */}
      {rawBuffer && rawBuffer.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📡 Raw EEG</Text>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Total Samples:</Text>
            <Text style={styles.infoValue}>{rawBuffer.length}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Latest Value:</Text>
            <Text style={styles.infoValue}>{rawBuffer[rawBuffer.length - 1]}</Text>
          </View>
        </View>
      )}

      <View style={styles.footer}>
        <Text style={styles.footerText}>
          ✨ Data is streaming successfully!
        </Text>
      </View>
    </ScrollView>
  );
}

function formatNumber(num) {
  if (num === null || num === undefined || isNaN(num)) return '0';
  return Math.round(num).toLocaleString();
}

function getFrequency(band) {
  const freqs = {
    Delta: '0.5-4 Hz',
    Theta: '4-8 Hz',
    AlphaLow: '8-10 Hz',
    AlphaHigh: '10-13 Hz',
    BetaLow: '13-17 Hz',
    BetaHigh: '17-30 Hz',
    GammaLow: '30-40 Hz',
    GammaHigh: '40-50 Hz',
  };
  return freqs[band] || '';
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
    backgroundColor: '#f5f5f5',
  },
  emptyText: {
    fontSize: 18,
    color: '#666',
    marginBottom: 10,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
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
  alphaContainer: {
    backgroundColor: '#E8F5E9',
    margin: 15,
    padding: 20,
    borderRadius: 15,
    alignItems: 'center',
  },
  alphaTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2E7D32',
    marginBottom: 10,
  },
  alphaValue: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#4CAF50',
    marginBottom: 10,
  },
  alphaDetails: {
    flexDirection: 'row',
    gap: 20,
  },
  alphaDetailText: {
    fontSize: 14,
    color: '#558B2F',
  },
  bandRow: {
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 10,
    marginBottom: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  alphaBandRow: {
    backgroundColor: '#F1F8E9',
    borderWidth: 2,
    borderColor: '#8BC34A',
  },
  bandInfo: {
    flex: 1,
  },
  bandName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 3,
  },
  alphaBandName: {
    color: '#33691E',
  },
  bandFreq: {
    fontSize: 12,
    color: '#999',
  },
  bandValueContainer: {
    alignItems: 'flex-end',
  },
  bandValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#666',
    marginBottom: 2,
  },
  bandSamples: {
    fontSize: 10,
    color: '#999',
  },
  infoRow: {
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 10,
    marginBottom: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  infoLabel: {
    fontSize: 14,
    color: '#666',
  },
  infoValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  footer: {
    backgroundColor: '#E3F2FD',
    margin: 15,
    padding: 15,
    borderRadius: 10,
    marginBottom: 30,
  },
  footerText: {
    fontSize: 14,
    color: '#1976D2',
    textAlign: 'center',
    fontWeight: '600',
  },
});