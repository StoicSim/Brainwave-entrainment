import React, { useState, useRef } from 'react';
import { View, Text, StyleSheet, Dimensions, TouchableOpacity, ScrollView, StatusBar } from 'react-native';
import { LineChart } from 'react-native-chart-kit';
import * as ScreenOrientation from 'expo-screen-orientation';

const BANDS_CONFIG = [
  { key: 'Delta', color: '#9C27B0', freq: '0.5-4 Hz', desc: 'Deep sleep' },
  { key: 'Theta', color: '#3F51B5', freq: '4-8 Hz', desc: 'Meditation' },
  { key: 'AlphaLow', color: '#4CAF50', freq: '8-10 Hz', desc: 'Relaxation' },
  { key: 'AlphaHigh', color: '#8BC34A', freq: '10-13 Hz', desc: 'Calm focus' },
  { key: 'BetaLow', color: '#FF9800', freq: '13-17 Hz', desc: 'Active thinking' },
  { key: 'BetaHigh', color: '#FF5722', freq: '17-30 Hz', desc: 'High alertness' },
  { key: 'GammaLow', color: '#F44336', freq: '30-40 Hz', desc: 'Peak focus' },
  { key: 'GammaHigh', color: '#E91E63', freq: '40-50 Hz', desc: 'Cognitive peak' },
];

export default function LandscapeChartViewer({ bandData, initialBand = 'AlphaLow', onClose }) {
  const initialIndex = BANDS_CONFIG.findIndex(b => b.key === initialBand);
  const [currentBandIndex, setCurrentBandIndex] = useState(initialIndex >= 0 ? initialIndex : 0);
  const bandSelectorRef = useRef(null);
  
  const [dimensions, setDimensions] = useState({
    width: Dimensions.get('window').width,
    height: Dimensions.get('window').height
  });

  // Lock to landscape when component mounts
  React.useEffect(() => {
    ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
    
    return () => {
      ScreenOrientation.unlockAsync();
    };
  }, []);

  // Update dimensions on orientation change
  React.useEffect(() => {
    const subscription = Dimensions.addEventListener('change', ({ window }) => {
      setDimensions({
        width: window.width,
        height: window.height
      });
    });

    return () => subscription?.remove();
  }, []);

  const currentBand = BANDS_CONFIG[currentBandIndex];

  const handleBandSelect = (index) => {
    setCurrentBandIndex(index);
    // Scroll selector to show selected band
    if (bandSelectorRef.current) {
      bandSelectorRef.current.scrollTo({
        x: index * 110,
        animated: true,
      });
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar hidden />
      
      {/* Header with Band Selector */}
      <View style={[styles.header, { backgroundColor: currentBand.color }]}>
        <View style={styles.headerTop}>
          <View style={styles.headerLeft}>
            <Text style={styles.bandName}>{currentBand.key}</Text>
            <Text style={styles.bandFreq}>{currentBand.freq} • {currentBand.desc}</Text>
          </View>
          
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Text style={styles.closeButtonText}>✕ Exit</Text>
          </TouchableOpacity>
        </View>

        {/* Band Selector Buttons */}
        <ScrollView 
          ref={bandSelectorRef}
          horizontal 
          showsHorizontalScrollIndicator={false}
          style={styles.bandSelector}
          contentContainerStyle={styles.bandSelectorContent}
        >
          {BANDS_CONFIG.map((band, index) => {
            const hasData = bandData[band.key]?.length > 0;
            return (
              <TouchableOpacity
                key={band.key}
                style={[
                  styles.bandButton,
                  currentBandIndex === index && styles.bandButtonActive,
                  { borderColor: band.color },
                  !hasData && styles.bandButtonDisabled,
                ]}
                onPress={() => hasData && handleBandSelect(index)}
                disabled={!hasData}
              >
                <Text style={[
                  styles.bandButtonText,
                  currentBandIndex === index && styles.bandButtonTextActive,
                  !hasData && styles.bandButtonTextDisabled,
                ]}>
                  {band.key}
                </Text>
                {!hasData && (
                  <Text style={styles.bandButtonSubtext}>No data</Text>
                )}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Single Chart View - Only render current band */}
      <View style={styles.chartContainer}>
        <LandscapeBandChart
          data={bandData[currentBand.key] || []}
          band={currentBand}
          screenWidth={dimensions.width}
          screenHeight={dimensions.height}
        />
      </View>

          </View>
  );
}

// Memoized chart component for better performance
const LandscapeBandChart = React.memo(({ data, band, screenWidth, screenHeight }) => {
  if (!data || data.length < 3) {
    return (
      <View style={styles.emptyChart}>
        <Text style={styles.emptyText}>📊 Collecting data...</Text>
        <Text style={styles.emptySubtext}>{data?.length || 0}/3 points needed</Text>
      </View>
    );
  }

  // Take last 30 points for optimal performance
  const displayData = data.slice(-30);
  
  const chartData = {
    labels: displayData.map((_, i) => ''),
    datasets: [{
      data: displayData,
      color: (opacity = 1) => band.color,
      strokeWidth: 3,
    }],
  };

  const minVal = Math.min(...displayData);
  const maxVal = Math.max(...displayData);
  const currentVal = displayData[displayData.length - 1];
  const avgVal = displayData.reduce((a, b) => a + b, 0) / displayData.length;

  return (
    <View style={styles.chartContent}>
      <LineChart
        data={chartData}
        width={screenWidth - 60}
        height={screenHeight - 280}
        chartConfig={{
          backgroundColor: '#1e1e1e',
          backgroundGradientFrom: '#1e1e1e',
          backgroundGradientTo: '#2a2a2a',
          decimalPlaces: 0,
          color: (opacity = 1) => band.color,
          labelColor: (opacity = 1) => '#fff',
          style: {
            borderRadius: 16,
          },
          propsForDots: {
            r: '4',
            strokeWidth: '2',
            stroke: band.color,
          },
          propsForBackgroundLines: {
            strokeDasharray: '',
            stroke: '#444',
            strokeWidth: 1,
          },
        }}
        bezier
        style={styles.chart}
        withVerticalLabels={true}
        withHorizontalLabels={true}
        withInnerLines={true}
        withOuterLines={false}
        withVerticalLines={false}
        segments={4}
      />
      
      <View style={styles.statsContainer}>
        <View style={styles.statBox}>
          <Text style={styles.statLabel}>Current</Text>
          <Text style={[styles.statValue, { color: band.color }]}>
            {formatNumber(currentVal)}
          </Text>
        </View>
        
        <View style={styles.statBox}>
          <Text style={styles.statLabel}>Average</Text>
          <Text style={styles.statValue}>
            {formatNumber(avgVal)}
          </Text>
        </View>
        
        <View style={styles.statBox}>
          <Text style={styles.statLabel}>Min</Text>
          <Text style={styles.statValue}>
            {formatNumber(minVal)}
          </Text>
        </View>

        <View style={styles.statBox}>
          <Text style={styles.statLabel}>Max</Text>
          <Text style={styles.statValue}>
            {formatNumber(maxVal)}
          </Text>
        </View>
        
        <View style={styles.statBox}>
          <Text style={styles.statLabel}>Samples</Text>
          <Text style={styles.statValue}>
            {displayData.length}
          </Text>
        </View>
      </View>
    </View>
  );
}, (prevProps, nextProps) => {
  // Only re-render if data actually changed
  const prevLength = prevProps.data?.length || 0;
  const nextLength = nextProps.data?.length || 0;
  const prevLast = prevProps.data?.[prevLength - 1];
  const nextLast = nextProps.data?.[nextLength - 1];
  
  return prevLength === nextLength && 
         prevLast === nextLast && 
         prevProps.band.key === nextProps.band.key &&
         prevProps.screenWidth === nextProps.screenWidth &&
         prevProps.screenHeight === nextProps.screenHeight;
});

function formatNumber(num) {
  if (num === null || num === undefined || isNaN(num)) return '0';
  return Math.round(num).toLocaleString();
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  headerLeft: {
    flex: 1,
  },
  bandName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  bandFreq: {
    fontSize: 14,
    color: '#fff',
    opacity: 0.9,
  },
  closeButton: {
    backgroundColor: 'rgba(0,0,0,0.3)',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  closeButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  bandSelector: {
    maxHeight: 60,
  },
  bandSelectorContent: {
    paddingVertical: 8,
    gap: 10,
  },
  bandButton: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 2,
    backgroundColor: 'rgba(255,255,255,0.1)',
    marginRight: 10,
    minHeight: 44,
    justifyContent: 'center',
  },
  bandButtonActive: {
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderWidth: 3,
  },
  bandButtonDisabled: {
    opacity: 0.3,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  bandButtonText: {
    fontSize: 14,
    color: '#fff',
    fontWeight: '600',
    textAlign: 'center',
  },
  bandButtonTextActive: {
    fontWeight: '800',
  },
  bandButtonTextDisabled: {
    color: '#999',
  },
  bandButtonSubtext: {
    fontSize: 10,
    color: '#ccc',
    marginTop: 2,
    textAlign: 'center',
  },
  chartContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  chartContent: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  chart: {
    borderRadius: 16,
    marginBottom: 8,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    paddingHorizontal: 8,
    gap: 4,
  },
  statBox: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingVertical: 3,
    paddingHorizontal: 6,
    borderRadius: 4,
    minWidth: 70,
  },
  statLabel: {
    fontSize: 8,
    color: '#aaa',
    marginBottom: 1,
  },
  statValue: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#fff',
  },
  emptyChart: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 24,
    color: '#fff',
    marginBottom: 10,
  },
  emptySubtext: {
    fontSize: 16,
    color: '#aaa',
  },
  navInfo: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingVertical: 10,
    alignItems: 'center',
  },
  navInfoText: {
    color: '#fff',
    fontSize: 12,
    opacity: 0.8,
  },
});