import React, { useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import { Slot, useRouter, usePathname } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

function GuestLayoutContent() {
  const router = useRouter();
  const pathname = usePathname();
  const tabBarAnim = useRef(new Animated.Value(0)).current;
  const isUIVisible = useRef(true);

  useEffect(() => {
    if (!isUIVisible.current) {
      isUIVisible.current = true;
      Animated.timing(tabBarAnim, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }).start();
      if (global.onUIToggle) global.onUIToggle(true);
    }
  }, [pathname]);

  const toggleUI = () => {
    isUIVisible.current = !isUIVisible.current;
    Animated.timing(tabBarAnim, {
      toValue: isUIVisible.current ? 0 : 100,
      duration: 250,
      useNativeDriver: true,
    }).start();
    if (global.onUIToggle) global.onUIToggle(isUIVisible.current);
  };

  useEffect(() => {
    global.toggleTabBarUI = toggleUI;
    global.isUIVisible = isUIVisible;
    return () => {
      delete global.toggleTabBarUI;
      delete global.isUIVisible;
    };
  }, []);

  return (
    <View style={styles.container}>
      <Slot />

      <Animated.View
        style={[styles.tabBar, { transform: [{ translateY: tabBarAnim }] }]}
      >
        {/* Home — back to mode selection */}
        <TouchableOpacity
          style={styles.tabButton}
          onPress={() => router.push('/')}
        >
          <Ionicons name="home-outline" size={24} color="#666" />
          <Text style={styles.tabLabel}>Home</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabButton, pathname === '/guest/monitor' && styles.tabButtonActive]}
          onPress={() => router.push('/guest/monitor')}
        >
          <Ionicons
            name="pulse"
            size={24}
            color={pathname === '/guest/monitor' ? '#4CAF50' : '#666'}
          />
          <Text style={[styles.tabLabel, pathname === '/guest/monitor' && styles.tabLabelActive]}>
            Monitor
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabButton, pathname === '/guest/charts' && styles.tabButtonActive]}
          onPress={() => router.push('/guest/charts')}
        >
          <Ionicons
            name="stats-chart"
            size={24}
            color={pathname === '/guest/charts' ? '#4CAF50' : '#666'}
          />
          <Text style={[styles.tabLabel, pathname === '/guest/charts' && styles.tabLabelActive]}>
            Charts
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabButton, pathname === '/guest/generate' && styles.tabButtonActive]}
          onPress={() => router.push('/guest/generate')}
        >
          <Ionicons
            name="musical-notes"
            size={24}
            color={pathname === '/guest/generate' ? '#4CAF50' : '#666'}
          />
          <Text style={[styles.tabLabel, pathname === '/guest/generate' && styles.tabLabelActive]}>
            Generate
          </Text>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

export default function GuestLayout() {
  return <GuestLayoutContent />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  tabBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
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
  tabLabel: {
    fontSize: 11,
    color: '#666',
    fontWeight: '500',
  },
  tabLabelActive: {
    color: '#4CAF50',
    fontWeight: '700',
  },
});