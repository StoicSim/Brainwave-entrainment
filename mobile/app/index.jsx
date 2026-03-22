import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';

export default function LoginScreen() {
  const router = useRouter();

  const handleLogin = () => {
    // TODO: Replace with Firebase authentication
    router.push('/monitor');
  };

  return (
    <View style={styles.container}>
      <View style={styles.topSection}>
        <Text style={styles.appName}>NeuroFlow</Text>
        <Text style={styles.tagline}>Alpha Wave Focus and Relaxation</Text>
      </View>

      <View style={styles.middleSection}>
        <View style={styles.infoBox}>
          <Text style={styles.infoTitle}>{'🧠 What is NeuroFlow?'}</Text>
          <Text style={styles.infoText}>
            NeuroFlow connects to your EEG device to monitor your brainwaves
            in real-time, generating music personalized to increase your alpha
            wave activity for deeper relaxation and calm focus.
          </Text>
        </View>

        <View style={styles.featureRow}>
          <View style={styles.featureItem}>
            <Text style={styles.featureIcon}>📡</Text>
            <Text style={styles.featureLabel}>Real-time EEG</Text>
          </View>
          <View style={styles.featureItem}>
            <Text style={styles.featureIcon}>🎵</Text>
            <Text style={styles.featureLabel}>AI Music</Text>
          </View>
          <View style={styles.featureItem}>
            <Text style={styles.featureIcon}>🌊</Text>
            <Text style={styles.featureLabel}>Alpha Waves</Text>
          </View>
        </View>
      </View>

      <View style={styles.bottomSection}>
        <TouchableOpacity 
          style={styles.loginButton}
          onPress={handleLogin}
        >
          <Text style={styles.loginButtonText}>Get Started</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.signupButton}
          onPress={handleLogin}
        >
          <Text style={styles.signupButtonText}>Create Account</Text>
        </TouchableOpacity>

        <Text style={styles.disclaimer}>
          {'Firebase authentication coming soon.\nTap either button to continue for now.'}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    paddingHorizontal: 25,
    paddingTop: 80,
    paddingBottom: 40,
    justifyContent: 'space-between',
  },
  topSection: {
    alignItems: 'center',
  },
  appName: {
    fontSize: 42,
    fontWeight: 'bold',
    color: '#2E7D32',
    letterSpacing: 1,
    marginBottom: 8,
  },
  tagline: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  middleSection: {
    gap: 20,
  },
  infoBox: {
    backgroundColor: '#E8F5E9',
    padding: 22,
    borderRadius: 16,
  },
  infoTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2E7D32',
    marginBottom: 10,
  },
  infoText: {
    fontSize: 14,
    color: '#555',
    lineHeight: 22,
  },
  featureRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  featureItem: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 18,
    borderRadius: 14,
    marginHorizontal: 5,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  featureIcon: {
    fontSize: 28,
    marginBottom: 8,
  },
  featureLabel: {
    fontSize: 12,
    color: '#555',
    fontWeight: '600',
    textAlign: 'center',
  },
  bottomSection: {
    gap: 12,
  },
  loginButton: {
    backgroundColor: '#4CAF50',
    padding: 18,
    borderRadius: 14,
    alignItems: 'center',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  loginButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  signupButton: {
    backgroundColor: '#fff',
    padding: 18,
    borderRadius: 14,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#4CAF50',
  },
  signupButtonText: {
    color: '#4CAF50',
    fontSize: 18,
    fontWeight: 'bold',
  },
  disclaimer: {
    fontSize: 12,
    color: '#aaa',
    textAlign: 'center',
    marginTop: 5,
    lineHeight: 18,
  },
});