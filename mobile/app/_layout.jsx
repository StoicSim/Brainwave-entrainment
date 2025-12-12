import { StyleSheet, Text, View, TouchableOpacity, Animated } from 'react-native';
import React, { useRef, useEffect } from 'react';
import { Slot, useRouter, usePathname } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { BleProvider } from '../context/BleContext';
import { UserProfileProvider, useUserProfile } from '../context/UserProfileContext';

function LayoutContent() {
  const router = useRouter();
  const pathname = usePathname();
  const tabBarAnim = useRef(new Animated.Value(0)).current;
  const isUIVisible = useRef(true);

  const showTabBar = pathname === '/monitor' || pathname === '/charts' || pathname === '/analysis';

  // Reset UI visibility when pathname changes
  useEffect(() => {
    if (showTabBar && !isUIVisible.current) {
      isUIVisible.current = true;
      
      Animated.timing(tabBarAnim, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }).start();

      // Notify child screens about UI reset
      if (global.onUIToggle) {
        global.onUIToggle(true);
      }
    }
  }, [pathname]);

  // Function to toggle UI visibility (called from child screens)
  const toggleUI = () => {
    isUIVisible.current = !isUIVisible.current;
    
    Animated.timing(tabBarAnim, {
      toValue: isUIVisible.current ? 0 : 100,
      duration: 250,
      useNativeDriver: true,
    }).start();

    // Notify child screens about UI toggle
    if (global.onUIToggle) {
      global.onUIToggle(isUIVisible.current);
    }
  };

  // Expose toggle function globally so child screens can call it
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
      
      {showTabBar && (
        <Animated.View 
          style={[
            styles.tabBar,
            {
              transform: [{ translateY: tabBarAnim }]
            }
          ]}
        >
          {/* Home Button */}
          <TouchableOpacity 
            style={styles.tabButton}
            onPress={() => router.push('/')}
          >
            <Ionicons name="home-outline" size={24} color="#666" />
            <Text style={styles.tabLabel}>Home</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.tabButton, pathname === '/monitor' && styles.tabButtonActive]}
            onPress={() => router.push('/monitor')}
          >
            <Ionicons 
              name="pulse" 
              size={24} 
              color={pathname === '/monitor' ? '#2196F3' : '#666'} 
            />
            <Text style={[styles.tabLabel, pathname === '/monitor' && styles.tabLabelActive]}>
              Monitor
            </Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.tabButton, pathname === '/charts' && styles.tabButtonActive]}
            onPress={() => router.push('/charts')}
          >
            <Ionicons 
              name="stats-chart" 
              size={24} 
              color={pathname === '/charts' ? '#2196F3' : '#666'} 
            />
            <Text style={[styles.tabLabel, pathname === '/charts' && styles.tabLabelActive]}>
              Charts
            </Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.tabButton, pathname === '/analysis' && styles.tabButtonActive]}
            onPress={() => router.push('/analysis')}
          >
            <Ionicons 
              name="analytics" 
              size={24} 
              color={pathname === '/analysis' ? '#2196F3' : '#666'} 
            />
            <Text style={[styles.tabLabel, pathname === '/analysis' && styles.tabLabelActive]}>
              Analysis
            </Text>
          </TouchableOpacity>

          {/* User Profile Button */}
          <TouchableOpacity 
            style={[styles.tabButton, pathname === '/profile' && styles.tabButtonActive]}
            onPress={() => router.push('/profile')}
          >
            <Ionicons 
              name="person-circle-outline" 
              size={24} 
              color={pathname === '/profile' ? '#2196F3' : '#666'} 
            />
            <Text style={[styles.tabLabel, pathname === '/profile' && styles.tabLabelActive]}>
              Profile
            </Text>
          </TouchableOpacity>
        </Animated.View>
      )}
    </View>
  );
}

export default function RootLayout() {
  return (
    <UserProfileProvider>
      <BleProvider>
        <LayoutContent />
      </BleProvider>
    </UserProfileProvider>
  );
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