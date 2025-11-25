// mobile/components/EEGChart.jsx

import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Dimensions, ScrollView } from 'react-native';
import { LineChart } from 'react-native-chart-kit';
import { BLE_CONFIG } from '../constants/BleConfig';

const { width } = Dimensions.get('window');

/**
 * Real-time EEG Band Power Visualization
 * Using react-native-chart-kit (pure JS, no native modules)
 */
export default function EEGChart({ bandData }) {
  // Focus on Alpha bands for your use case
  const alphaData = useMemo(() => {
    if (!bandData?.AlphaLow || !bandData?.AlphaHigh) {
      return null;
    }

    const alphaLow = bandData.AlphaLow;
    const alphaHigh = bandData.AlphaHigh;
    
    // Calculate average alpha power
    const avgAlpha = alphaLow.length > 0 
      ? (alphaLow[alphaLow.length - 1] + alphaHigh[alphaHigh.length - 1]) / 2 
      : 0;

    return {
      current: avgAlpha,
      low: alphaLow,
      high: alphaHigh
    };
  }, [bandData]);

  // Check if we have any data
  const hasData = useMemo(() => {
    return Object.values(bandData).some(arr => arr.length > 0);
  }, [bandData]);

  if (!hasData) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>⏳ Waiting for EEG data...</Text>
        <Text style={styles.emptySubtext}>Make sure your device is connected and sensors are making good contact</Text>
      </View>
    );
  }

  // Prepare chart configuration
  const chartConfig = {
    backgroundGradientFrom: '#fff',
    backgroundGradientTo: '#fff',
    color: (opacity = 1) => `rgba(76, 175, 80, ${opacity})`,
    strokeWidth: 2,
    barPercentage: 0.5,
    useShadowColorFromDataset: false,
    decimalPlaces: 0,
    propsForLabels: {
      fontSize: 10,
    },
  };

  // Create chart data for each band
  const createChartData = (band) => {
    const values = bandData[band] || [];
    const data = values.length > 0 ? values : [0];
    
    return {
      labels: [], // Hide labels for cleaner look
      datasets: [{
        data: data.slice(-50), // Last 50 points for smooth visualization
        color: (opacity = 1) => getBandColor(band, opacity),
        strokeWidth: 2,
      }],
    };
  };

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Alpha Focus Display */}
      {alphaData && (
        <View style={styles.alphaContainer}>
          <Text style={styles.alphaTitle}>🧠 Alpha Wave Power</Text>
          <Text style={styles.alphaValue}>
            {Math.round(alphaData.current).toLocaleString()}
          </Text>
          <View style={styles.alphaBar}>
            <View 
              style={[
                styles.alphaBarFill, 
                { width: `${Math.min((alphaData.current / 100000) * 100, 100)}%` }
              ]} 
            />
          </View>
          <Text style={styles.alphaSubtext}>Higher values indicate relaxed focus</Text>
        </View>
      )}

      {/* Band Power Charts */}
      <Text style={styles.sectionTitle}>📊 EEG Band Powers</Text>
      
      {BLE_CONFIG.EEG_BANDS.map((band) => {
        const values = bandData[band];
        if (!values || values.length === 0) return null;

        const currentValue = values[values.length - 1];
        const isAlpha = band.includes('Alpha');

        return (
          <View key={band} style={[styles.chartCard, isAlpha && styles.alphaChartCard]}>
            <View style={styles.chartHeader}>
              <Text style={[styles.chartTitle, isAlpha && styles.alphaChartTitle]}>
                {isAlpha ? '⭐ ' : ''}{band}
              </Text>
              <Text style={styles.chartValue}>
                {Math.round(currentValue).toLocaleString()}
              </Text>
            </View>
            
            <LineChart
              data={createChartData(band)}
              width={width - 40}
              height={120}
              chartConfig={{
                ...chartConfig,
                color: (opacity = 1) => getBandColor(band, opacity),
              }}
              bezier
              withVerticalLabels={false}
              withHorizontalLabels={true}
              withDots={false}
              withInnerLines={true}
              withOuterLines={true}
              withVerticalLines={false}
              withHorizontalLines={true}
              segments={3}
              style={styles.chart}
            />
            
            <Text style={styles.chartSubtext}>
              {getBandDescription(band)}
            </Text>
          </View>
        );
      })}

      <View style={styles.footer}>
        <Text style={styles.footerText}>
          💡 Tip: Alpha waves (8-13 Hz) are optimal for meditation and focused relaxation
        </Text>
      </View>
    </ScrollView>
  );
}

/**
 * Get color for each EEG band
 */
function getBandColor(band, opacity = 1) {
  const colors = {
    Delta: `rgba(156, 39, 176, ${opacity})`,
    Theta: `rgba(63, 81, 181, ${opacity})`,
    AlphaLow: `rgba(76, 175, 80, ${opacity})`,
    AlphaHigh: `rgba(139, 195, 74, ${opacity})`,
    BetaLow: `rgba(255, 152, 0, ${opacity})`,
    BetaHigh: `rgba(255, 87, 34, ${opacity})`,
    GammaLow: `rgba(244, 67, 54, ${opacity})`,
    GammaHigh: `rgba(233, 30, 99, ${opacity})`
  };
  return colors[band] || `rgba(102, 102, 102, ${opacity})`;
}

/**
 * Get description for each band
 */
function getBandDescription(band) {
  const descriptions = {
    Delta: '0.5-4 Hz • Deep sleep',
    Theta: '4-8 Hz • Drowsiness, meditation',
    AlphaLow: '8-10 Hz • Relaxed awareness',
    AlphaHigh: '10-13 Hz • Calm focus',
    BetaLow: '13-17 Hz • Active thinking',
    BetaHigh: '17-30 Hz • Alert, active',
    GammaLow: '30-40 Hz • Higher cognition',
    GammaHigh: '40-50 Hz • Peak awareness'
  };
  return descriptions[band] || '';
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    padding: 10,
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
    textAlign: 'center',
    marginBottom: 10,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
  },
  alphaContainer: {
    backgroundColor: '#E8F5E9',
    padding: 20,
    borderRadius: 15,
    marginBottom: 20,
    alignItems: 'center',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  alphaTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2E7D32',
    marginBottom: 8,
  },
  alphaValue: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#4CAF50',
    marginBottom: 12,
  },
  alphaBar: {
    width: '100%',
    height: 24,
    backgroundColor: '#C8E6C9',
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 8,
  },
  alphaBarFill: {
    height: '100%',
    backgroundColor: '#4CAF50',
    borderRadius: 12,
  },
  alphaSubtext: {
    fontSize: 12,
    color: '#558B2F',
    fontStyle: 'italic',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
    marginLeft: 5,
    color: '#333',
  },
  chartCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 15,
    marginBottom: 15,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  alphaChartCard: {
    backgroundColor: '#F1F8E9',
    borderWidth: 2,
    borderColor: '#8BC34A',
  },
  chartHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  chartTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  alphaChartTitle: {
    color: '#33691E',
  },
  chartValue: {
    fontSize: 18,
    fontWeight: '600',
    color: '#666',
  },
  chart: {
    marginVertical: 8,
    borderRadius: 8,
  },
  chartSubtext: {
    fontSize: 11,
    color: '#999',
    marginTop: 5,
    textAlign: 'center',
  },
  footer: {
    backgroundColor: '#FFF9C4',
    padding: 15,
    borderRadius: 10,
    marginTop: 10,
    marginBottom: 30,
  },
  footerText: {
    fontSize: 13,
    color: '#F57F17',
    textAlign: 'center',
    lineHeight: 18,
  },
});