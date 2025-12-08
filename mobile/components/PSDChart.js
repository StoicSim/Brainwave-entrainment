import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import { LineChart } from 'react-native-chart-kit';

const { width } = Dimensions.get('window');

const BAND_REGIONS = [
  { name: 'Delta', range: [1, 4], color: 'rgba(156, 39, 176, 0.3)' },
  { name: 'Theta', range: [4, 8], color: 'rgba(63, 81, 181, 0.3)' },
  { name: 'Alpha', range: [8, 13], color: 'rgba(76, 175, 80, 0.3)' },
  { name: 'Beta', range: [13, 30], color: 'rgba(255, 152, 0, 0.3)' },
  { name: 'Gamma', range: [30, 50], color: 'rgba(244, 67, 54, 0.3)' },
];

export default function PSDChart({ psdData, chartWidth }) {
  const displayWidth = chartWidth || (Dimensions.get('window').width - 40);

  const chartData = useMemo(() => {
    if (!psdData || !psdData.frequencies || psdData.frequencies.length < 10) {
      return null;
    }

    const frequencies = psdData.frequencies;
    const powers = psdData.psd;

    console.log('PSD Summary:');
    console.log('Freq range:', frequencies[0].toFixed(2), '-', frequencies[frequencies.length-1].toFixed(2), 'Hz');
    console.log('Total data points:', frequencies.length);

    // Create exactly 50 data points (one per Hz from 0-50)
    const targetFrequencies = [];
    const numPoints = 50; // One point per Hz for simplicity
    
    for (let i = 0; i <= numPoints; i++) {
      targetFrequencies.push(i); // 0, 1, 2, 3, ... 50 Hz
    }

    // Interpolate power values at these frequencies
    const interpolatedPowers = targetFrequencies.map(targetFreq => {
      // Handle edge cases
      if (targetFreq < frequencies[0]) return powers[0];
      if (targetFreq > frequencies[frequencies.length - 1]) return powers[powers.length - 1];
      
      // Find the two nearest data points
      let lowerIdx = 0;
      let upperIdx = frequencies.length - 1;
      
      for (let i = 0; i < frequencies.length - 1; i++) {
        if (frequencies[i] <= targetFreq && frequencies[i + 1] >= targetFreq) {
          lowerIdx = i;
          upperIdx = i + 1;
          break;
        }
      }
      
      // Linear interpolation
      const f1 = frequencies[lowerIdx];
      const f2 = frequencies[upperIdx];
      const p1 = powers[lowerIdx];
      const p2 = powers[upperIdx];
      
      if (f2 === f1) return p1;
      
      const ratio = (targetFreq - f1) / (f2 - f1);
      return p1 + ratio * (p2 - p1);
    });

    // Create labels - show every 5 Hz and key boundaries
    const keyFrequencies = [0, 1, 4, 8, 10, 13, 18, 30, 40, 50];
    const labels = targetFrequencies.map((f) => {
      if (keyFrequencies.includes(f)) {
        return f.toString();
      }
      return ''; // Empty string for unlabeled points
    });

    console.log('Created', targetFrequencies.length, 'points (1 Hz resolution)');
    console.log('Labels:', labels.filter(l => l).join(', '));
    console.log('Power range:', Math.min(...interpolatedPowers).toExponential(2), '-', Math.max(...interpolatedPowers).toExponential(2));

    return {
      labels: labels,
      datasets: [{
        data: interpolatedPowers.length > 0 ? interpolatedPowers : [0],
        color: (opacity = 1) => `rgba(33, 150, 243, ${opacity})`,
        strokeWidth: 2,
      }],
      rawData: { 
        frequencies: targetFrequencies, 
        powers: interpolatedPowers 
      },
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
  
  // Find which band has max power
  const dominantBand = BAND_REGIONS.reduce((max, band) => {
    const bandPowers = chartData.datasets[0].data.filter((_, i) => {
      const freq = chartData.rawData.frequencies[i];
      return freq >= band.range[0] && freq <= band.range[1];
    });
    const bandAvg = bandPowers.reduce((a, b) => a + b, 0) / (bandPowers.length || 1);
    return bandAvg > max.power ? { name: band.name, power: bandAvg } : max;
  }, { name: '', power: 0 });

  return (
    <View style={styles.container}>
      <Text style={styles.title}>⚡ Power Spectral Density</Text>
      <Text style={styles.subtitle}>Frequency (Hz) vs Power - Linear Scale</Text>

      {/* Dominant Band Indicator */}
      <View style={styles.dominantContainer}>
        <Text style={styles.dominantText}>
          🎯 Dominant Band: <Text style={styles.dominantBand}>{dominantBand.name}</Text>
        </Text>
        <Text style={styles.dominantPower}>
          Avg Power: {dominantBand.power.toExponential(2)}
        </Text>
      </View>

      {/* IAF Display */}
      {psdData.iaf && (
        <View style={styles.iafContainer}>
          <Text style={styles.iafText}>
            🧘 Individual Alpha Frequency: {psdData.iaf.frequency.toFixed(2)} Hz
          </Text>
          <Text style={styles.iafPower}>
            Peak Power: {psdData.iaf.power.toExponential(2)}
          </Text>
        </View>
      )}

      {/* Band Regions Legend */}
      <View style={styles.legendContainer}>
        {BAND_REGIONS.map(band => (
          <View key={band.name} style={styles.legendItem}>
            <View style={[styles.legendColor, { backgroundColor: band.color.replace('0.3', '1') }]} />
            <Text style={styles.legendText}>
              {band.name} ({band.range[0]}-{band.range[1]}Hz)
            </Text>
          </View>
        ))}
      </View>

      <LineChart
        data={chartData}
        width={displayWidth}
        height={280}
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
            r: '0',
          },
          propsForBackgroundLines: {
            stroke: '#e0e0e0',
            strokeWidth: 1,
          },
          propsForLabels: {
            fontSize: 10,
            fontWeight: '600',
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

      {/* Frequency Scale Reference */}
      <View style={styles.scaleReference}>
        <Text style={styles.scaleText}>← Low Freq (Delta, Theta)</Text>
        <Text style={styles.scaleText}>High Freq (Beta, Gamma) →</Text>
      </View>

      <View style={styles.statsContainer}>
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>Peak</Text>
          <Text style={styles.statValue}>{maxPower.toExponential(1)}</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>Average</Text>
          <Text style={styles.statValue}>{avgPower.toExponential(1)}</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>Peak/Avg</Text>
          <Text style={styles.statValue}>{(maxPower / avgPower).toFixed(1)}x</Text>
        </View>
      </View>

      {/* Computed Band Powers */}
      {psdData.bandPowers && Object.keys(psdData.bandPowers).length > 0 && (
        <View style={styles.bandPowersContainer}>
          <Text style={styles.bandPowersTitle}>📊 Band Power Summary</Text>
          <View style={styles.bandPowersGrid}>
            {Object.entries(psdData.bandPowers)
              .sort((a, b) => b[1].power - a[1].power) // Sort by power (highest first)
              .map(([band, data]) => {
                const isHighest = band === dominantBand.name;
                return (
                  <View 
                    key={band} 
                    style={[
                      styles.bandPowerItem,
                      isHighest && styles.bandPowerItemHighest
                    ]}
                  >
                    <Text style={styles.bandPowerName}>
                      {band} {isHighest && '👑'}
                    </Text>
                    <Text style={styles.bandPowerValue}>
                      {data.power.toExponential(1)}
                    </Text>
                    <Text style={styles.bandPowerFreq}>
                      {data.range[0]}-{data.range[1]} Hz
                    </Text>
                  </View>
                );
              })}
          </View>
        </View>
      )}

      {/* Debug Info */}
      <View style={styles.debugContainer}>
        <Text style={styles.debugText}>
          📊 1 Hz resolution | 51 points (0-50 Hz) | Labels at: {chartData.labels.filter(l => l).join(', ')} Hz
        </Text>
      </View>
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
  dominantContainer: {
    backgroundColor: '#E3F2FD',
    padding: 12,
    borderRadius: 8,
    marginBottom: 10,
    borderLeftWidth: 4,
    borderLeftColor: '#2196F3',
  },
  dominantText: {
    fontSize: 14,
    color: '#1976D2',
    marginBottom: 4,
  },
  dominantBand: {
    fontWeight: 'bold',
    fontSize: 16,
    color: '#0D47A1',
  },
  dominantPower: {
    fontSize: 11,
    color: '#1565C0',
  },
  iafContainer: {
    backgroundColor: '#E8F5E9',
    padding: 10,
    borderRadius: 8,
    marginBottom: 15,
    borderLeftWidth: 4,
    borderLeftColor: '#4CAF50',
  },
  iafText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#2E7D32',
    marginBottom: 3,
  },
  iafPower: {
    fontSize: 11,
    color: '#388E3C',
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
    marginBottom: 5,
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
  scaleReference: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    marginTop: 5,
    marginBottom: 10,
  },
  scaleText: {
    fontSize: 9,
    color: '#999',
    fontStyle: 'italic',
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
    fontSize: 11,
    color: '#666',
    marginBottom: 4,
  },
  statValue: {
    fontSize: 14,
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
    gap: 8,
  },
  bandPowerItem: {
    backgroundColor: '#fff',
    padding: 10,
    borderRadius: 6,
    minWidth: '22%',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  bandPowerItemHighest: {
    backgroundColor: '#E3F2FD',
    borderColor: '#2196F3',
    borderWidth: 2,
  },
  bandPowerName: {
    fontSize: 10,
    color: '#666',
    marginBottom: 4,
    fontWeight: '600',
  },
  bandPowerValue: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#2196F3',
    marginBottom: 2,
  },
  bandPowerFreq: {
    fontSize: 8,
    color: '#999',
  },
  debugContainer: {
    marginTop: 15,
    padding: 10,
    backgroundColor: '#f9f9f9',
    borderRadius: 6,
    borderLeftWidth: 3,
    borderLeftColor: '#9E9E9E',
  },
  debugText: {
    fontSize: 9,
    color: '#666',
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