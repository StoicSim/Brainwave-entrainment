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
  const scrollViewRef = useRef(null);
  const [dimensions, setDimensions] = useState({
    width: Dimensions.get('window').width,
    height: Dimensions.get('window').height
  });

  // Lock to landscape when component mounts
  React.useEffect(() => {
    ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
    
    return () => {
      // Unlock when component unmounts
      ScreenOrientation.unlockAsync();
    };
  }, []);

  // Scroll to initial band after layout
  React.useEffect(() => {
    const timer = setTimeout(() => {
      if (scrollViewRef.current && initialIndex >= 0) {
        scrollViewRef.current.scrollTo({
          x: initialIndex * dimensions.width,
          animated: false,
        });
      }
    }, 100);
    
    return () => clearTimeout(timer);
  }, [initialIndex]);

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
  const bandValues = bandData[currentBand.key] || [];
  
  const handleScroll = (event) => {
    const offsetX = event.nativeEvent.contentOffset.x;
    const index = Math.round(offsetX / dimensions.width);
    if (index !== currentBandIndex && index >= 0 && index < BANDS_CONFIG.length) {
      setCurrentBandIndex(index);
    }
  };

  const navigateToBand = (direction) => {
    const newIndex = currentBandIndex + direction;
    if (newIndex >= 0 && newIndex < BANDS_CONFIG.length) {
      setCurrentBandIndex(newIndex);
      scrollViewRef.current?.scrollTo({
        x: newIndex * dimensions.width,
        animated: true,
      });
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar hidden />
      
      {/* Header */}
      <View style={[styles.header, { backgroundColor: currentBand.color }]}>
        <View style={styles.headerLeft}>
          <Text style={styles.bandName}>{currentBand.key}</Text>
          <Text style={styles.bandFreq}>{currentBand.freq} • {currentBand.desc}</Text>
        </View>
        
        <TouchableOpacity style={styles.closeButton} onPress={onClose}>
          <Text style={styles.closeButtonText}>✕ Exit</Text>
        </TouchableOpacity>
      </View>

      {/* Scrollable Charts */}
      <ScrollView
        ref={scrollViewRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        style={styles.scrollView}
        onLayout={(e) => {
          // Ensure we're on the right page after layout
          if (scrollViewRef.current && initialIndex >= 0) {
            scrollViewRef.current.scrollTo({
              x: initialIndex * dimensions.width,
              animated: false,
            });
          }
        }}
      >
        {BANDS_CONFIG.map((band, index) => (
          <View key={band.key} style={[styles.chartPage, { width: dimensions.width }]}>
            <LandscapeBandChart
              data={bandData[band.key] || []}
              band={band}
              screenWidth={dimensions.width}
              screenHeight={dimensions.height}
            />
          </View>
        ))}
      </ScrollView>

      {/* Navigation Arrows */}
      {currentBandIndex > 0 && (
        <TouchableOpacity
          style={[styles.navButton, styles.navButtonLeft]}
          onPress={() => navigateToBand(-1)}
        >
          <Text style={styles.navButtonText}>‹</Text>
        </TouchableOpacity>
      )}
      
      {currentBandIndex < BANDS_CONFIG.length - 1 && (
        <TouchableOpacity
          style={[styles.navButton, styles.navButtonRight]}
          onPress={() => navigateToBand(1)}
        >
          <Text style={styles.navButtonText}>›</Text>
        </TouchableOpacity>
      )}

      {/* Dots Indicator */}
      <View style={styles.dotsContainer}>
        {BANDS_CONFIG.map((band, index) => (
          <TouchableOpacity
            key={band.key}
            onPress={() => {
              setCurrentBandIndex(index);
              scrollViewRef.current?.scrollTo({
                x: index * dimensions.width,
                animated: true,
              });
            }}
          >
            <View
              style={[
                styles.dot,
                index === currentBandIndex && styles.dotActive,
                { backgroundColor: index === currentBandIndex ? band.color : '#ccc' }
              ]}
            />
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

function LandscapeBandChart({ data, band, screenWidth, screenHeight }) {
  // Memoize to prevent unnecessary re-renders
  const chartContent = React.useMemo(() => {
    if (!data || data.length < 3) {
      return (
        <View style={styles.emptyChart}>
          <Text style={styles.emptyText}>📊 Collecting data...</Text>
          <Text style={styles.emptySubtext}>{data?.length || 0}/3 points needed</Text>
        </View>
      );
    }

    // Take last 40 points for better performance (reduced from 50)
    const displayData = data.slice(-40);
    
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
      <>
        <LineChart
          data={chartData}
          width={screenWidth - 40}
          height={screenHeight - 200}
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
          segments={5}
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
            <Text style={styles.statLabel}>Range</Text>
            <Text style={styles.statValue}>
              {formatNumber(minVal)} - {formatNumber(maxVal)}
            </Text>
          </View>
          
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>Samples</Text>
            <Text style={styles.statValue}>
              {displayData.length}
            </Text>
          </View>
        </View>
      </>
    );
  }, [data, band.color, band.key, screenWidth, screenHeight]);

  return (
    <View style={styles.chartContent}>
      {chartContent}
    </View>
  );
}

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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
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
  scrollView: {
    flex: 1,
  },
  chartPage: {
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
    marginBottom: 20,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    paddingHorizontal: 20,
  },
  statBox: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 10,
    minWidth: 120,
  },
  statLabel: {
    fontSize: 12,
    color: '#aaa',
    marginBottom: 5,
  },
  statValue: {
    fontSize: 18,
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
  navButton: {
    position: 'absolute',
    top: '50%',
    backgroundColor: 'rgba(255,255,255,0.2)',
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: -30,
  },
  navButtonLeft: {
    left: 20,
  },
  navButtonRight: {
    right: 20,
  },
  navButtonText: {
    fontSize: 40,
    color: '#fff',
    fontWeight: 'bold',
  },
  dotsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 10,
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#ccc',
  },
  dotActive: {
    width: 24,
    height: 8,
    borderRadius: 4,
  },
});