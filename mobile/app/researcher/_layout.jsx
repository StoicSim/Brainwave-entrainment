import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import { Slot, useRouter, usePathname } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';

const AUTH_KEY = 'researcher_logged_in';

function ResearcherLayoutContent() {
  const router = useRouter();
  const pathname = usePathname();
  const tabBarAnim = React.useRef(new Animated.Value(0)).current;
  const isUIVisible = React.useRef(true);

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

  // Don't show tab bar on login screen
  const showTabBar = pathname !== '/researcher/login';

  return (
    <View style={styles.container}>
      <Slot />

      {showTabBar && (
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
            style={[styles.tabButton, pathname === '/researcher/monitor' && styles.tabButtonActive]}
            onPress={() => router.push('/researcher/monitor')}
          >
            <Ionicons
              name="pulse"
              size={24}
              color={pathname === '/researcher/monitor' ? '#2196F3' : '#666'}
            />
            <Text style={[styles.tabLabel, pathname === '/researcher/monitor' && styles.tabLabelActive]}>
              Monitor
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabButton, pathname === '/researcher/charts' && styles.tabButtonActive]}
            onPress={() => router.push('/researcher/charts')}
          >
            <Ionicons
              name="stats-chart"
              size={24}
              color={pathname === '/researcher/charts' ? '#2196F3' : '#666'}
            />
            <Text style={[styles.tabLabel, pathname === '/researcher/charts' && styles.tabLabelActive]}>
              Charts
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabButton, pathname === '/researcher/record' && styles.tabButtonActive]}
            onPress={() => router.push('/researcher/record')}
          >
            <Ionicons
              name="radio-button-on"
              size={24}
              color={pathname === '/researcher/record' ? '#2196F3' : '#666'}
            />
            <Text style={[styles.tabLabel, pathname === '/researcher/record' && styles.tabLabelActive]}>
              Record
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabButton, pathname === '/researcher/profile' && styles.tabButtonActive]}
            onPress={() => router.push('/researcher/profile')}
          >
            <Ionicons
              name="person-circle-outline"
              size={24}
              color={pathname === '/researcher/profile' ? '#2196F3' : '#666'}
            />
            <Text style={[styles.tabLabel, pathname === '/researcher/profile' && styles.tabLabelActive]}>
              Profile
            </Text>
          </TouchableOpacity>
        </Animated.View>
      )}
    </View>
  );
}
function RedirectToLogin() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/researcher/login');
  }, []);
  return (
    <View style={styles.loadingContainer}>
      <Text style={styles.loadingText}>Loading...</Text>
    </View>
  );
}
export default function ResearcherLayout() {
  const router = useRouter();
  const pathname = usePathname();
  const [authChecked, setAuthChecked] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
  try {
    const loggedIn = await AsyncStorage.getItem(AUTH_KEY);
    setIsAuthenticated(loggedIn === 'true');
  } catch (error) {
    console.warn('Auth check error:', error.message);
    setIsAuthenticated(false);
  } finally {
    setAuthChecked(true);
  }
};

  // Always render layout content — let login.jsx handle its own redirect
  // Don't redirect from layout — causes race condition
  if (!authChecked) {
  return (
    <View style={styles.loadingContainer}>
      <Text style={styles.loadingText}>Loading...</Text>
    </View>
  );
}

if (!isAuthenticated && pathname !== '/researcher/login') {
  return <RedirectToLogin />;
}

return <ResearcherLayoutContent />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  loadingText: {
    fontSize: 16,
    color: '#666',
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
    color: '#2196F3',
    fontWeight: '700',
  },
});