import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Dimensions, StatusBar } from 'react-native';
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

  return (
    <View style={styles.container}>
      <StatusBar hidden={isLandscape} />
      
      {/* Compact Header for Landscape */}
      <View style={[styles.header, isLandscape && styles.headerLandscape]}>
        <Text style={styles.headerTitle}>📊 Live EEG Charts</Text>
        <Text style={styles.headerSubtitle}>
          {device ? 'Connected • Streaming' : 'Not Connected'}
        </Text>
      </View>

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
          style={styles.content} 
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
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
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1e1e1e', // Dark theme for landscape
  },
  header: {
    backgroundColor: '#2a2a2a',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#444',
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