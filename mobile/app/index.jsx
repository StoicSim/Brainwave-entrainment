import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView } from 'react-native';
import { useRouter } from 'expo-router';
import { useBleContext } from '../context/BleContext';

export default function ModeSelectionScreen() {
  const router = useRouter();
  const { handleDisconnect, device } = useBleContext();

  const handleGuestMode = async () => {
    if (device) await handleDisconnect();
    router.push('/guest/monitor');
  };

  const handleResearcherMode = async () => {
    if (device) await handleDisconnect();
    router.push('/researcher/login');
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>

        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.appName}>NeuroFlow</Text>
          <Text style={styles.tagline}>Alpha Wave Focus and Relaxation</Text>
        </View>

        {/* Mode Cards */}
        <View style={styles.cardsContainer}>
          <Text style={styles.selectText}>Select Mode</Text>

          {/* Guest Mode Card */}
          <TouchableOpacity
            style={[styles.card, styles.guestCard]}
            onPress={handleGuestMode}
            activeOpacity={0.85}
          >
            <Text style={styles.cardIcon}>🎵</Text>
            <View style={styles.cardContent}>
              <Text style={styles.cardTitle}>Guest Mode</Text>
              <Text style={styles.cardDescription}>
                Connect your EEG device and generate personalized alpha wave music using AI
              </Text>
              <View style={styles.cardBadge}>
                <Text style={styles.cardBadgeText}>No login required</Text>
              </View>
            </View>
            <Text style={styles.cardArrow}>›</Text>
          </TouchableOpacity>

          {/* Researcher Mode Card */}
          <TouchableOpacity
            style={[styles.card, styles.researcherCard]}
            onPress={handleResearcherMode}
            activeOpacity={0.85}
          >
            <Text style={styles.cardIcon}>🔬</Text>
            <View style={styles.cardContent}>
              <Text style={styles.cardTitle}>Researcher Mode</Text>
              <Text style={styles.cardDescription}>
                Collect and export EEG session data for AI training pipeline
              </Text>
              <View style={[styles.cardBadge, styles.cardBadgeResearcher]}>
                <Text style={[styles.cardBadgeText, styles.cardBadgeTextResearcher]}>
                  Login required
                </Text>
              </View>
            </View>
            <Text style={styles.cardArrow}>›</Text>
          </TouchableOpacity>
        </View>

        {/* Footer */}
        <Text style={styles.footer}>
          Pulchowk Campus, IOE — Brainwave Entrainment Project
        </Text>

      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f0f4f8',
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 30,
    justifyContent: 'space-between',
  },
  header: {
    alignItems: 'center',
    marginBottom: 20,
  },
  appName: {
    fontSize: 44,
    fontWeight: 'bold',
    color: '#2E7D32',
    letterSpacing: 1,
    marginBottom: 8,
  },
  tagline: {
    fontSize: 15,
    color: '#666',
    textAlign: 'center',
  },
  cardsContainer: {
    flex: 1,
    justifyContent: 'center',
    gap: 20,
  },
  selectText: {
    fontSize: 13,
    color: '#999',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginBottom: 8,
    textAlign: 'center',
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 22,
    borderRadius: 20,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    gap: 16,
  },
  guestCard: {
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#4CAF50',
  },
  researcherCard: {
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#2196F3',
  },
  cardIcon: {
    fontSize: 40,
  },
  cardContent: {
    flex: 1,
    gap: 6,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  cardDescription: {
    fontSize: 13,
    color: '#666',
    lineHeight: 18,
  },
  cardBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    marginTop: 4,
  },
  cardBadgeResearcher: {
    backgroundColor: '#E3F2FD',
  },
  cardBadgeText: {
    fontSize: 11,
    color: '#2E7D32',
    fontWeight: '600',
  },
  cardBadgeTextResearcher: {
    color: '#1565C0',
  },
  cardArrow: {
    fontSize: 32,
    color: '#ccc',
    fontWeight: '300',
  },
  footer: {
    fontSize: 11,
    color: '#bbb',
    textAlign: 'center',
    marginTop: 20,
  },
});