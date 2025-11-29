// mobile/app/charts.jsx
import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { useBleContext } from '../context/BleContext';
import EEGChart from '../components/EEGChart';

export default function ChartsScreen() {
  const {
    device,
    bandData,
    rawEEGBuffer,
    dataCountRef,
    hasBandData,
  } = useBleContext();

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Live Charts</Text>
        <Text style={styles.headerSubtitle}>Real-time EEG Visualization</Text>
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
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {(hasBandData() && bandData.Delta?.length >= 3) || rawEEGBuffer.length >= 10 ? (
            <EEGChart 
              bandData={bandData} 
              rawBuffer={rawEEGBuffer}
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
  waitingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
    minHeight: 400,
  },
  waitingText: {
    fontSize: 18,
    color: '#666',
    marginBottom: 10,
  },
  waitingSubtext: {
    fontSize: 14,
    color: '#999',
    marginTop: 5,
  },
});