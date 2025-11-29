import React, { useState, useMemo, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Dimensions, TouchableOpacity, Modal } from 'react-native';
import { LineChart } from 'react-native-chart-kit';
import LandscapeChartViewer from './LandscapeChartViewer';

const { width } = Dimensions.get('window');
const CHART_WIDTH = width - 40;

// Bands configuration - Define at top level
const BANDS_CONFIG = [
  { key: 'Delta', color: '#9C27B0', freq: '0.5-4 Hz' },
  { key: 'Theta', color: '#3F51B5', freq: '4-8 Hz' },
  { key: 'AlphaLow', color: '#4CAF50', freq: '8-10 Hz' },
  { key: 'AlphaHigh', color: '#8BC34A', freq: '10-13 Hz' },
  { key: 'BetaLow', color: '#FF9800', freq: '13-17 Hz' },
  { key: 'BetaHigh', color: '#FF5722', freq: '17-30 Hz' },
  { key: 'GammaLow', color: '#F44336', freq: '30-40 Hz' },
  { key: 'GammaHigh', color: '#E91E63', freq: '40-50 Hz' },
];

export default function EEGChart({ bandData, rawBuffer, initialSelectedBand = 'AlphaLow' }) {
  const [selectedBand, setSelectedBand] = useState(initialSelectedBand);
  const [showRaw, setShowRaw] = useState(false);
  const [showLandscape, setShowLandscape] = useState(false);

  const bandSelectorRef = React.useRef(null);

  // Update selected band if initialSelectedBand changes (from external navigation)
  useEffect(() => {
    if (initialSelectedBand) {
      setSelectedBand(initialSelectedBand);
      // Scroll to band selector when externally selected
      if (bandSelectorRef.current) {
        // Find index of selected band
        const bandIndex = BANDS_CONFIG.findIndex(b => b.key === initialSelectedBand);
        if (bandIndex !== -1 && bandSelectorRef.current) {
          // Scroll to position (approximate)
          bandSelectorRef.current.scrollTo({ x: bandIndex * 100, animated: true });
        }
      }
    }
  }, [initialSelectedBand]);

  // Throttle re-renders - only update every 500ms max
  const [lastRenderTime, setLastRenderTime] = useState(Date.now());
  const shouldRender = Date.now() - lastRenderTime > 500;

  // Use effect to control render throttling
  useEffect(() => {
    if (!shouldRender) return;
    
    const timer = setTimeout(() => {
      setLastRenderTime(Date.now());
    }, 500);
    
    return () => clearTimeout(timer);
  }, [bandData, rawBuffer]);

  // Catch any render errors
  try {
    // Use props directly - no batching needed, already handled in parent
    const displayData = {
      bands: bandData || {},
      raw: rawBuffer || [],
    };

    // Safety check
    if (!displayData.bands) {
      return (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No data (bands is null)</Text>
        </View>
      );
    }

    const hasData = Object.values(displayData.bands).some(arr => arr && arr.length > 0);

    if (!hasData) {
      return (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>⏳ Waiting for EEG data...</Text>
          <Text style={styles.emptySubtext}>
            Raw samples: {displayData.raw?.length || 0}
          </Text>
        </View>
      );
    }

    // Calculate Alpha stats
    const alphaLowVal = displayData.bands.AlphaLow?.[displayData.bands.AlphaLow.length - 1] || 0;
    const alphaHighVal = displayData.bands.AlphaHigh?.[displayData.bands.AlphaHigh.length - 1] || 0;
    const avgAlpha = (alphaLowVal + alphaHighVal) / 2;

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Landscape Modal */}
      <Modal
        visible={showLandscape}
        animationType="slide"
        onRequestClose={() => setShowLandscape(false)}
      >
        <LandscapeChartViewer
          bandData={displayData.bands}
          initialBand={selectedBand}
          onClose={() => setShowLandscape(false)}
        />
      </Modal>

      {/* Alpha Focus Card */}
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
        <Text style={styles.alphaDescription}>
          {avgAlpha > 50000 ? '✨ High focus & relaxation' :
           avgAlpha > 20000 ? '👍 Moderate alpha activity' :
           '💭 Building up...'}
        </Text>
      </View>

      {/* Band Spectrum Visualization */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>📊 EEG Band Spectrum</Text>
        <BandSpectrum 
          bandData={displayData.bands} 
          bands={BANDS_CONFIG}
          selectedBand={selectedBand}
          onBandSelect={setSelectedBand}
        />
      </View>

      {/* Individual Band Time Series */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>📈 Band Time Series</Text>
          <TouchableOpacity
            style={styles.fullscreenButton}
            onPress={() => setShowLandscape(true)}
          >
            <Text style={styles.fullscreenButtonText}>⛶ Landscape View</Text>
          </TouchableOpacity>
        </View>
        
        {/* Band Selector */}
        <ScrollView 
          ref={bandSelectorRef}
          horizontal 
          showsHorizontalScrollIndicator={false}
          style={styles.bandSelector}
        >
          {BANDS_CONFIG.map((band) => {
            const hasDataForBand = displayData.bands[band.key]?.length > 0;
            return (
              <TouchableOpacity
                key={band.key}
                style={[
                  styles.bandButton,
                  selectedBand === band.key && styles.bandButtonActive,
                  { borderColor: band.color },
                  !hasDataForBand && styles.bandButtonDisabled,
                ]}
                onPress={() => hasDataForBand && setSelectedBand(band.key)}
                disabled={!hasDataForBand}
              >
                <Text style={[
                  styles.bandButtonText,
                  selectedBand === band.key && styles.bandButtonTextActive,
                  !hasDataForBand && styles.bandButtonTextDisabled,
                ]}>
                  {band.key}
                </Text>
                {!hasDataForBand && (
                  <Text style={styles.bandButtonSubtext}>No data</Text>
                )}
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Selected Band Chart */}
        <BandTimeSeriesChart 
          data={displayData.bands[selectedBand] || []}
          color={BANDS_CONFIG.find(b => b.key === selectedBand)?.color || '#666'}
          label={selectedBand}
        />
      </View>

      {/* Raw EEG Toggle */}
      <TouchableOpacity 
        style={styles.rawToggle}
        onPress={() => setShowRaw(!showRaw)}
      >
        <Text style={styles.rawToggleText}>
          {showRaw ? '📉 Hide' : '📡 Show'} Raw EEG Signal
        </Text>
      </TouchableOpacity>

      {/* Raw EEG Visualization */}
      {showRaw && displayData.raw && displayData.raw.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📡 Raw EEG (512 Hz)</Text>
          <RawEEGChart data={displayData.raw} />
          <View style={styles.rawStats}>
            <Text style={styles.rawStatsText}>
              Samples: {displayData.raw.length} | Latest: {displayData.raw[displayData.raw.length - 1]}
            </Text>
          </View>
        </View>
      )}

      {/* All Band Values Table */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>📋 Current Values</Text>
        
        {BANDS_CONFIG.map((band) => {
          const values = displayData.bands[band.key];
          if (!values || values.length === 0) return null;

          const currentValue = values[values.length - 1];

          return (
            <TouchableOpacity
              key={band.key}
              onPress={() => setSelectedBand(band.key)}
              activeOpacity={0.7}
            >
              <View 
                style={[
                  styles.bandRow,
                  selectedBand === band.key && styles.bandRowSelected,
                ]}
              >
                <View style={styles.bandInfo}>
                  <View style={styles.bandNameRow}>
                    <View style={[styles.colorDot, { backgroundColor: band.color }]} />
                    <Text style={styles.bandName}>
                      {band.key}
                    </Text>
                    {selectedBand === band.key && (
                      <Text style={styles.selectedIndicator}>👈 Viewing</Text>
                    )}
                  </View>
                  <Text style={styles.bandFreq}>{band.freq}</Text>
                </View>
                <View style={styles.bandValueContainer}>
                  <Text style={styles.bandValue}>
                    {formatNumber(currentValue)}
                  </Text>
                  <Text style={styles.bandSamples}>
                    {values.length} pts
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerText}>
          ✨ Tap any band to view its time series chart
        </Text>
      </View>
    </ScrollView>
  );
  } catch (err) {
    // Catch and display any errors
    console.error('EEGChart render error:', err);
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>❌ Chart Error</Text>
        <Text style={styles.emptySubtext}>{err.toString()}</Text>
        <Text style={styles.emptySubtext}>{err.stack?.substring(0, 200)}</Text>
      </View>
    );
  }
}

// Band Spectrum Bar Chart Component - Now clickable
function BandSpectrum({ bandData, bands, selectedBand, onBandSelect }) {
  const values = bands.map(band => {
    const data = bandData[band.key];
    return data && data.length > 0 ? data[data.length - 1] : 0;
  });

  const maxValue = Math.max(...values, 1);

  return (
    <View style={styles.spectrumContainer}>
      {bands.map((band, index) => {
        const value = values[index];
        const percentage = (value / maxValue) * 100;
        const hasData = bandData[band.key]?.length > 0;

        return (
          <TouchableOpacity
            key={band.key}
            style={styles.spectrumBar}
            onPress={() => hasData && onBandSelect(band.key)}
            disabled={!hasData}
            activeOpacity={0.7}
          >
            <View style={styles.spectrumBarBg}>
              <View 
                style={[
                  styles.spectrumBarFill,
                  { 
                    height: `${percentage}%`,
                    backgroundColor: band.color,
                    opacity: selectedBand === band.key ? 1 : 0.7,
                  }
                ]} 
              />
            </View>
            {selectedBand === band.key && (
              <Text style={styles.spectrumSelected}>👆</Text>
            )}
            <Text style={styles.spectrumLabel} numberOfLines={1}>
              {band.key.replace('AlphaLow', 'α↓')
                       .replace('AlphaHigh', 'α↑')
                       .replace('BetaLow', 'β↓')
                       .replace('BetaHigh', 'β↑')
                       .replace('GammaLow', 'γ↓')
                       .replace('GammaHigh', 'γ↑')
                       .substring(0, 5)}
            </Text>
            <Text style={styles.spectrumValue}>
              {formatNumberShort(value)}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

// Band Time Series using react-native-chart-kit - Memoized to prevent crashes
const BandTimeSeriesChart = React.memo(({ data, color, label }) => {
  // Memoize chart data to prevent unnecessary re-renders
  const chartData = useMemo(() => {
    if (!data || data.length < 3) {
      // Need at least 3 points for chart-kit
      return null;
    }

    // Take last 20 points for better performance
    const displayData = data.slice(-20);
    
    return {
      labels: displayData.map((_, i) => ''), // Empty labels for cleaner look
      datasets: [{
        data: displayData.length > 0 ? displayData : [0], // Ensure at least one data point
        color: (opacity = 1) => color,
        strokeWidth: 2,
      }],
    };
  }, [data, color]);

  if (!chartData) {
    return (
      <View style={styles.timeSeriesEmpty}>
        <Text style={styles.timeSeriesEmptyText}>
          Collecting data... ({data?.length || 0}/3 points)
        </Text>
      </View>
    );
  }

  const minVal = Math.min(...chartData.datasets[0].data);
  const maxVal = Math.max(...chartData.datasets[0].data);
  const currentVal = chartData.datasets[0].data[chartData.datasets[0].data.length - 1];

  return (
    <View style={styles.chartContainer}>
      <LineChart
        data={chartData}
        width={CHART_WIDTH}
        height={180}
        chartConfig={{
          backgroundColor: '#ffffff',
          backgroundGradientFrom: '#ffffff',
          backgroundGradientTo: '#f8f8f8',
          decimalPlaces: 0,
          color: (opacity = 1) => color,
          labelColor: (opacity = 1) => '#666',
          style: {
            borderRadius: 10,
          },
          propsForDots: {
            r: '3',
            strokeWidth: '1',
            stroke: color,
          },
          propsForBackgroundLines: {
            strokeDasharray: '', // solid lines
            stroke: '#e0e0e0',
            strokeWidth: 1,
          },
        }}
        bezier // Smooth curves
        style={styles.chart}
        withVerticalLabels={false}
        withHorizontalLabels={true}
        withInnerLines={true}
        withOuterLines={false}
        withVerticalLines={false}
        segments={4}
      />
      <View style={styles.chartInfo}>
        <Text style={styles.chartLabel}>
          {label}: {formatNumber(currentVal)}
        </Text>
        <Text style={styles.chartRange}>
          Range: {formatNumber(minVal)} - {formatNumber(maxVal)}
        </Text>
      </View>
    </View>
  );
}, (prevProps, nextProps) => {
  // Custom comparison - only re-render if data actually changed
  const prevLength = prevProps.data?.length || 0;
  const nextLength = nextProps.data?.length || 0;
  const prevLast = prevProps.data?.[prevLength - 1];
  const nextLast = nextProps.data?.[nextLength - 1];
  
  // Only update if length changed or last value changed
  return prevLength === nextLength && prevLast === nextLast && prevProps.color === nextProps.color;
});

// Raw EEG Chart
function RawEEGChart({ data }) {
  const chartData = useMemo(() => {
    if (!data || data.length < 10) {
      // Need at least 10 points for raw EEG visualization
      return null;
    }

    // Take last 50 samples for raw EEG
    const displayData = data.slice(-50);
    
    return {
      labels: displayData.map((_, i) => ''),
      datasets: [{
        data: displayData,
        color: (opacity = 1) => '#2196F3',
        strokeWidth: 1.5,
      }],
    };
  }, [data]);

  if (!chartData) {
    return (
      <View style={styles.timeSeriesEmpty}>
        <Text style={styles.timeSeriesEmptyText}>
          Collecting samples... ({data?.length || 0}/10)
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.chartContainer}>
      <LineChart
        data={chartData}
        width={CHART_WIDTH}
        height={150}
        chartConfig={{
          backgroundColor: '#ffffff',
          backgroundGradientFrom: '#ffffff',
          backgroundGradientTo: '#f0f8ff',
          decimalPlaces: 0,
          color: (opacity = 1) => '#2196F3',
          labelColor: (opacity = 1) => '#666',
          style: {
            borderRadius: 10,
          },
          propsForDots: {
            r: '0', // No dots for raw signal
          },
          propsForBackgroundLines: {
            stroke: '#e3f2fd',
            strokeWidth: 1,
          },
        }}
        bezier={false} // Sharp lines for raw EEG
        style={styles.chart}
        withVerticalLabels={false}
        withHorizontalLabels={false}
        withInnerLines={true}
        withOuterLines={false}
        withVerticalLines={false}
        segments={2}
      />
    </View>
  );
}

// Helper functions
function formatNumber(num) {
  if (num === null || num === undefined || isNaN(num)) return '0';
  return Math.round(num).toLocaleString();
}

function formatNumberShort(num) {
  if (num === null || num === undefined || isNaN(num)) return '0';
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return Math.round(num).toString();
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
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  fullscreenButton: {
    backgroundColor: '#2196F3',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
  },
  fullscreenButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
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
    marginBottom: 10,
  },
  alphaDetailText: {
    fontSize: 14,
    color: '#558B2F',
  },
  alphaDescription: {
    fontSize: 14,
    color: '#558B2F',
    fontStyle: 'italic',
  },
  spectrumContainer: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 10,
    height: 200,
    alignItems: 'flex-end',
    gap: 4,
  },
  spectrumBar: {
    flex: 1,
    alignItems: 'center',
  },
  spectrumBarBg: {
    width: '100%',
    flex: 1,
    backgroundColor: '#f0f0f0',
    borderRadius: 4,
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  spectrumBarFill: {
    width: '100%',
    borderRadius: 4,
  },
  spectrumSelected: {
    fontSize: 12,
    marginTop: 2,
  },
  spectrumLabel: {
    fontSize: 9,
    color: '#666',
    marginTop: 4,
    textAlign: 'center',
  },
  spectrumValue: {
    fontSize: 8,
    color: '#999',
    marginTop: 2,
  },
  bandSelector: {
    marginBottom: 15,
  },
  bandButton: {
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 2,
    marginRight: 10,
    backgroundColor: '#fff',
    minHeight: 40,
    justifyContent: 'center',
  },
  bandButtonActive: {
    backgroundColor: '#f0f0f0',
    borderWidth: 3,
  },
  bandButtonDisabled: {
    opacity: 0.4,
    backgroundColor: '#f9f9f9',
  },
  bandButtonText: {
    fontSize: 12,
    color: '#666',
    fontWeight: '600',
  },
  bandButtonTextActive: {
    color: '#333',
    fontWeight: '700',
  },
  bandButtonTextDisabled: {
    color: '#999',
  },
  bandButtonSubtext: {
    fontSize: 9,
    color: '#999',
    marginTop: 2,
  },
  chartContainer: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 10,
    alignItems: 'center',
  },
  chart: {
    borderRadius: 10,
  },
  chartInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    paddingHorizontal: 10,
    marginTop: 10,
  },
  chartLabel: {
    fontSize: 12,
    color: '#666',
    fontWeight: '600',
  },
  chartRange: {
    fontSize: 11,
    color: '#999',
  },
  timeSeriesEmpty: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 40,
    alignItems: 'center',
  },
  timeSeriesEmptyText: {
    color: '#999',
    fontSize: 14,
  },
  rawToggle: {
    backgroundColor: '#2196F3',
    marginHorizontal: 15,
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
  },
  rawToggleText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  rawStats: {
    marginTop: 10,
    padding: 10,
    backgroundColor: '#f5f5f5',
    borderRadius: 5,
  },
  rawStatsText: {
    fontSize: 11,
    color: '#666',
    textAlign: 'center',
  },
  bandRow: {
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 10,
    marginBottom: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },

  bandRowSelected: {
    borderColor: '#2196F3',
    backgroundColor: '#E3F2FD',
  },
  bandInfo: {
    flex: 1,
  },
  bandNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 3,
  },
  colorDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  bandName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },

  selectedIndicator: {
    fontSize: 12,
    color: '#2196F3',
    marginLeft: 8,
    fontWeight: '600',
  },
  bandFreq: {
    fontSize: 12,
    color: '#999',
    marginLeft: 16,
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