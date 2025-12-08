import React, { useEffect, useState, useRef } from 'react';
import { View, Text, ScrollView, StyleSheet, Dimensions, StatusBar, TouchableWithoutFeedback } from 'react-native';
import { useBleContext } from '../context/BleContext';
import EEGChart from '../components/EEGChart';
import * as ScreenOrientation from 'expo-screen-orientation';

export default function ChartsScreen() {
  const {
    device,
    bandData,
    rawEEGBuffer,
    psdData,
    dataCountRef,
    hasBandData,
  } = useBleContext();

  const [dimensions, setDimensions] = useState({
    width: Dimensions.get('window').width,
    height: Dimensions.get('window').height
  });

  const [isUIVisible, setIsUIVisible] = useState(true);
  const lastTap = useRef(null);

  const isLandscape = dimensions.width > dimensions.height;

  // Lock to landscape when this screen is active
  useEffect(() => {
    const lockOrientation = async () => {
      await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
    };
    
    lockOrientation();

    return () => {
      ScreenOrientation.unlockAsync();
    };
  }, []);

  // Listen for UI toggle from layout
  useEffect(() => {
    global.onUIToggle = (visible) => {
      setIsUIVisible(visible);
    };

    return () => {
      delete global.onUIToggle;
    };
  }, []);

  // Update dimensions on orientation change
  useEffect(() => {
    const subscription = Dimensions.addEventListener('change', ({ window }) => {
      setDimensions({
        width: window.width,
        height: window.height
      });
    });

    return () => subscription?.remove();
  }, []);

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
        <StatusBar hidden={isLandscape} />
        
        {/* Header removed completely when UI is hidden */}
        {isUIVisible && (
          <View style={[styles.header, isLandscape && styles.headerLandscape]}>
            <Text style={styles.headerTitle}>📊 Live EEG Charts</Text>
            <Text style={styles.headerSubtitle}>
              {device ? 'Connected • Streaming • Double-tap to toggle UI' : 'Not Connected'}
            </Text>
          </View>
        )}

        {!device ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>📊</Text>
            <Text style={styles.emptyTitle}>No Data Available</Text>
            <Text style={styles.emptyText}>
              Connect your device in the Monitor tab to see live charts
            </Text>
          </View>
        ) : (
          <ScrollView 
            style={[styles.content, { marginTop: isUIVisible ? 60 : 0 }]} 
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
          >
            <TouchableWithoutFeedback onPress={handleDoubleTap}>
              <View>
                {(hasBandData() && bandData.Delta?.length >= 3) || rawEEGBuffer.length >= 10 ? (
                  <EEGChart 
                    bandData={bandData} 
                    rawBuffer={rawEEGBuffer}
                    psdData={psdData}
                    isLandscape={isLandscape}
                    screenWidth={dimensions.width}
                    screenHeight={dimensions.height}
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
    backgroundColor: '#1e1e1e',
  },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: '#2a2a2a',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#444',
    zIndex: 10,
  },
  headerLandscape: {
    paddingTop: 10,
    paddingBottom: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 3,
  },
  headerSubtitle: {
    fontSize: 11,
    color: '#aaa',
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
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
    color: '#fff',
    marginBottom: 10,
  },
  emptyText: {
    fontSize: 14,
    color: '#aaa',
    textAlign: 'center',
    lineHeight: 20,
  },
  waitingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
    minHeight: 200,
  },
  waitingText: {
    fontSize: 18,
    color: '#fff',
    marginBottom: 10,
  },
  waitingSubtext: {
    fontSize: 14,
    color: '#aaa',
    marginTop: 5,
  },
});
