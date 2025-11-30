import { StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import React from 'react';
import { Slot, useRouter, usePathname } from 'expo-router';
import { BleProvider } from '../context/BleContext';

function LayoutContent() {
  const router = useRouter();
  const pathname = usePathname();

  const showTabBar = pathname === '/monitor' || pathname === '/charts' || pathname === '/analysis';

  return (
    <View style={styles.container}>
      <Slot />
      
      {showTabBar && (
        <View style={styles.tabBar}>
          <TouchableOpacity 
            style={[styles.tabButton, pathname === '/monitor' && styles.tabButtonActive]}
            onPress={() => router.push('/monitor')}
          >
            <Text style={styles.tabIcon}>{pathname === '/monitor' ? '📊' : '📈'}</Text>
            <Text style={[styles.tabLabel, pathname === '/monitor' && styles.tabLabelActive]}>
              Monitor
            </Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.tabButton, pathname === '/charts' && styles.tabButtonActive]}
            onPress={() => router.push('/charts')}
          >
            <Text style={styles.tabIcon}>{pathname === '/charts' ? '📉' : '📊'}</Text>
            <Text style={[styles.tabLabel, pathname === '/charts' && styles.tabLabelActive]}>
              Live Charts
            </Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.tabButton, pathname === '/analysis' && styles.tabButtonActive]}
            onPress={() => router.push('/analysis')}
          >
            <Text style={styles.tabIcon}>{pathname === '/analysis' ? '🧠' : '🔬'}</Text>
            <Text style={[styles.tabLabel, pathname === '/analysis' && styles.tabLabelActive]}>
              Analysis
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

export default function RootLayout() {
  return (
    <BleProvider>
      <LayoutContent />
    </BleProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    paddingBottom: 20,
    paddingTop: 8,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    opacity: 0.6,
  },
  tabButtonActive: {
    opacity: 1,
  },
  tabIcon: {
    fontSize: 24,
    marginBottom: 4,
  },
  tabLabel: {
    fontSize: 11,
    color: '#666',
    fontWeight: '500',
  },
  tabLabelActive: {
    color: '#2196F3',
    fontWeight: '700',
  },
});