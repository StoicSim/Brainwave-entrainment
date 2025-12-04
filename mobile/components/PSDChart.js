import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import { LineChart } from 'react-native-chart-kit';

const { width } = Dimensions.get('window');
// const CHART_WIDTH = width - 40;

const BAND_REGIONS = [
  { name: 'Delta', range: [0.5, 4], color: 'rgba(156, 39, 176, 0.2)' },
  { name: 'Theta', range: [4, 8], color: 'rgba(63, 81, 181, 0.2)' },
  { name: 'Alpha', range: [8, 13], color: 'rgba(76, 175, 80, 0.2)' },
  { name: 'Beta', range: [13, 30], color: 'rgba(255, 152, 0, 0.2)' },
  { name: 'Gamma', range: [30, 50], color: 'rgba(244, 67, 54, 0.2)' },
];

export default function PSDChart({ psdData, chartWidth }) {
    const width = chartWidth || (Dimensions.get('window').width - 40);
const chartData = useMemo(() => {
  if (!psdData || !psdData.frequencies || psdData.frequencies.length < 10) {
    return null;
  }

  // Limit to 0-50 Hz for EEG bands
  const maxFreq = 50;
  const indices = psdData.frequencies
    .map((f, i) => f <= maxFreq ? i : -1)
    .filter(i => i !== -1);
  
  const frequencies = indices.map(i => psdData.frequencies[i]);
  const powers = indices.map(i => psdData.psd[i]);

  const step = Math.max(1, Math.floor(frequencies.length / 100));
  const sampledFreqs = frequencies.filter((_, i) => i % step === 0);
  const sampledPowers = powers.filter((_, i) => i % step === 0);

  const boundaryFrequencies = [1, 4, 8, 10, 13, 17, 30, 40,50];
  const labels = sampledFreqs.map((f) => {
    const rounded = Math.round(f);
    if (boundaryFrequencies.includes(rounded)) {
      return rounded.toString();
    }
    return '';
  });

  return {
    labels: labels,
    datasets: [{
      data: sampledPowers.length > 0 ? sampledPowers : [0],
      color: (opacity = 1) => `rgba(33, 150, 243, ${opacity})`,
      strokeWidth: 2,
    }],
  };
}, [psdData]);

  if (!chartData) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>
          Collecting samples... ({psdData?.frequencies?.length || 0}/512)
        </Text>
        <Text style={styles.emptySubtext}>
          Need 512 samples (1 second) to compute PSD
        </Text>
      </View>
    );
  }

  const maxPower = Math.max(...chartData.datasets[0].data);
  const avgPower = chartData.datasets[0].data.reduce((a, b) => a + b, 0) / chartData.datasets[0].data.length;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Power Spectral Density (PSD)</Text>
      <Text style={styles.subtitle}>Frequency vs Power (0-50 Hz)</Text>

      {/* IAF Display */}
      {psdData.iaf && (
        <View style={styles.iafContainer}>
          <Text style={styles.iafText}>
            🎯 Individual Alpha Frequency (IAF): {psdData.iaf.frequency.toFixed(2)} Hz
          </Text>
          <Text style={styles.iafPower}>
            Power: {psdData.iaf.power.toFixed(2)}
          </Text>
        </View>
      )}

      {/* Band Regions Legend */}
      <View style={styles.legendContainer}>
        {BAND_REGIONS.map(band => (
          <View key={band.name} style={styles.legendItem}>
            <View style={[styles.legendColor, { backgroundColor: band.color.replace('0.2', '1') }]} />
            <Text style={styles.legendText}>
              {band.name} ({band.range[0]}-{band.range[1]}Hz)
            </Text>
          </View>
        ))}
      </View>

      <LineChart
        data={chartData}
        width={width}
        height={250}
        chartConfig={{
          backgroundColor: '#ffffff',
          backgroundGradientFrom: '#ffffff',
          backgroundGradientTo: '#f8f8f8',
          decimalPlaces: 0,
          color: (opacity = 1) => `rgba(33, 150, 243, ${opacity})`,
          labelColor: (opacity = 1) => '#666',
          style: {
            borderRadius: 10,
          },
          propsForDots: {
            r: '0', // No dots for cleaner look
          },
          propsForBackgroundLines: {
            stroke: '#e0e0e0',
            strokeWidth: 1,
          },
        }}
        bezier={false}
        style={styles.chart}
        withVerticalLabels={true}
        withHorizontalLabels={true}
        withInnerLines={true}
        withOuterLines={false}
        segments={5}
        fromZero={true}
      />

      <View style={styles.statsContainer}>
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>Peak Power</Text>
          <Text style={styles.statValue}>{maxPower.toFixed(2)}</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>Avg Power</Text>
          <Text style={styles.statValue}>{avgPower.toFixed(2)}</Text>
        </View>
      </View>

      {/* Computed Band Powers from FFT */}
      {psdData.bandPowers && Object.keys(psdData.bandPowers).length > 0 && (
        <View style={styles.bandPowersContainer}>
          <Text style={styles.bandPowersTitle}>Computed Band Powers (from FFT)</Text>
          <View style={styles.bandPowersGrid}>
            {Object.entries(psdData.bandPowers).map(([band, data]) => (
              <View key={band} style={styles.bandPowerItem}>
                <Text style={styles.bandPowerName}>{band}</Text>
                <Text style={styles.bandPowerValue}>{data.power.toFixed(2)}</Text>
              </View>
            ))}
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 10,
    marginVertical: 10,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 5,
  },
  subtitle: {
    fontSize: 12,
    color: '#666',
    marginBottom: 15,
  },
  iafContainer: {
    backgroundColor: '#E8F5E9',
    padding: 12,
    borderRadius: 8,
    marginBottom: 15,
  },
  iafText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2E7D32',
    marginBottom: 4,
  },
  iafPower: {
    fontSize: 12,
    color: '#558B2F',
  },
  legendContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 15,
    gap: 8,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 10,
  },
  legendColor: {
    width: 12,
    height: 12,
    borderRadius: 2,
    marginRight: 4,
  },
  legendText: {
    fontSize: 10,
    color: '#666',
  },
  chart: {
    borderRadius: 10,
    marginVertical: 10,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 15,
    paddingTop: 15,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  statItem: {
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  statValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2196F3',
  },
  bandPowersContainer: {
    marginTop: 20,
    padding: 15,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
  },
  bandPowersTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 10,
  },
  bandPowersGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  bandPowerItem: {
    backgroundColor: '#fff',
    padding: 10,
    borderRadius: 6,
    minWidth: '22%',
    alignItems: 'center',
  },
  bandPowerName: {
    fontSize: 10,
    color: '#666',
    marginBottom: 4,
  },
  bandPowerValue: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#2196F3',
  },
  emptyContainer: {
    backgroundColor: '#fff',
    padding: 40,
    borderRadius: 10,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 12,
    color: '#999',
  },
});