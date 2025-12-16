import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Alert } from 'react-native';
import { useRouter } from 'expo-router';

export default function ResearchModeScreen() {
  const router = useRouter();
  const [subjects, setSubjects] = useState([]);
  const [stats, setStats] = useState({
    totalSubjects: 0,
    totalSessions: 0
  });

  useEffect(() => {
    // Load subjects from storage (we'll implement this later)
    loadSubjects();
  }, []);

  const loadSubjects = () => {
    // Placeholder - will load from storage later
    // For now, empty state
    setSubjects([]);
    setStats({
      totalSubjects: 0,
      totalSessions: 0
    });
  };

  const handleNewSubject = () => {
    router.push('/research/new-subject');
  };

  const handleExistingSubject = () => {
    if (subjects.length === 0) {
      Alert.alert(
        'No Subjects Found',
        'No subjects have been registered yet. Please register a new subject first.',
        [{ text: 'OK' }]
      );
      return;
    }
    router.push('/research/subject-list');
  };

  return (
    <View style={styles.container}>
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.content}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Text style={styles.backButtonText}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.title}> Research Data Collection</Text>
          <Text style={styles.subtitle}>IAF & Personality Entrainment Study</Text>
        </View>

        {/* Instructions Box */}
        <View style={styles.instructionsBox}>
          <Text style={styles.instructionsTitle}>Instructions for Researchers:</Text>
          <Text style={styles.instructionItem}>1. Enter subject information</Text>
          <Text style={styles.instructionItem}>2. Complete assessment tests</Text>
          <Text style={styles.instructionItem}>3. Collect baseline & conditions</Text>
          <Text style={styles.instructionItem}>4. Export CSV files</Text>
        </View>

        {/* Stats Dashboard */}
        {subjects.length > 0 && (
          <View style={styles.statsBox}>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{stats.totalSubjects}</Text>
              <Text style={styles.statLabel}>Total Subjects</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{stats.totalSessions}</Text>
              <Text style={styles.statLabel}>Sessions Recorded</Text>
            </View>
          </View>
        )}

        {/* Mode Selection Cards */}
        <Text style={styles.sectionTitle}>Choose Mode:</Text>

        {/* Existing Subject Card */}
        <TouchableOpacity 
          style={styles.modeCard}
          onPress={handleExistingSubject}
          activeOpacity={0.7}
        >
          <View style={styles.modeIconContainer}>
            <Text style={styles.modeIcon}>👤</Text>
          </View>
          <View style={styles.modeContent}>
            <Text style={styles.modeTitle}>Existing Subject</Text>
            <Text style={styles.modeDescription}>
              Continue with previously registered subject's profile
            </Text>
            {subjects.length > 0 && (
              <Text style={styles.modeSubtext}>
                {subjects.length} subject{subjects.length !== 1 ? 's' : ''} available
              </Text>
            )}
          </View>
          <Text style={styles.modeArrow}>→</Text>
        </TouchableOpacity>

        {/* New Subject Card */}
        <TouchableOpacity 
          style={[styles.modeCard, styles.modeCardPrimary]}
          onPress={handleNewSubject}
          activeOpacity={0.7}
        >
          <View style={styles.modeIconContainer}>
            <Text style={styles.modeIcon}>✨</Text>
          </View>
          <View style={styles.modeContent}>
            <Text style={styles.modeTitle}>New Subject</Text>
            <Text style={styles.modeDescription}>
              Register and assess a new subject
            </Text>
            <Text style={styles.modeSubtext}>
              ~20 min for complete assessment
            </Text>
          </View>
          <Text style={styles.modeArrow}>→</Text>
        </TouchableOpacity>

        {/* Quick Info */}
        <View style={styles.infoBox}>
          <Text style={styles.infoTitle}>📊 Data Collection Process</Text>
          <Text style={styles.infoText}>
            Each subject requires:
          </Text>
          <Text style={styles.infoItem}>• Basic info (name, age, gender)</Text>
          <Text style={styles.infoItem}>• Personality test (15 min)</Text>
          <Text style={styles.infoItem}>• IAF calibration (2 min)</Text>
          <Text style={styles.infoItem}>• EEG recordings (multiple sessions)</Text>
          <Text style={styles.infoText}>
            All data exports to CSV format for analysis.
          </Text>
        </View>

      </ScrollView>

      {/* Footer */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>Research Mode</Text>
        <Text style={styles.footerSubtext}>
          Multi-subject data collection & CSV export
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 20,
    paddingTop: 60,
  },
  header: {
    marginBottom: 30,
  },
  backButton: {
    marginBottom: 15,
  },
  backButtonText: {
    fontSize: 16,
    color: '#2196F3',
    fontWeight: '600',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 5,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
  },
  instructionsBox: {
    backgroundColor: '#E3F2FD',
    padding: 20,
    borderRadius: 12,
    marginBottom: 20,
    borderLeftWidth: 4,
    borderLeftColor: '#2196F3',
  },
  instructionsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1976D2',
    marginBottom: 12,
  },
  instructionItem: {
    fontSize: 14,
    color: '#555',
    marginBottom: 6,
  },
  statsBox: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 12,
    marginBottom: 20,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statDivider: {
    width: 1,
    backgroundColor: '#e0e0e0',
  },
  statNumber: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#2196F3',
  },
  statLabel: {
    fontSize: 13,
    color: '#666',
    marginTop: 5,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 15,
  },
  modeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 15,
    marginBottom: 15,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    borderWidth: 2,
    borderColor: '#e0e0e0',
  },
  modeCardPrimary: {
    borderColor: '#4CAF50',
    backgroundColor: '#F1F8F4',
  },
  modeIconContainer: {
    marginRight: 15,
  },
  modeIcon: {
    fontSize: 36,
  },
  modeContent: {
    flex: 1,
  },
  modeTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  modeDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  modeSubtext: {
    fontSize: 12,
    color: '#999',
    fontStyle: 'italic',
  },
  modeArrow: {
    fontSize: 24,
    color: '#ccc',
    marginLeft: 10,
  },
  infoBox: {
    backgroundColor: '#FFF3E0',
    padding: 20,
    borderRadius: 12,
    marginTop: 20,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#F57C00',
    marginBottom: 10,
  },
  infoText: {
    fontSize: 14,
    color: '#555',
    marginBottom: 8,
  },
  infoItem: {
    fontSize: 13,
    color: '#555',
    marginLeft: 10,
    marginBottom: 4,
  },
  footer: {
    padding: 20,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  footerText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    fontWeight: '600',
  },
  footerSubtext: {
    fontSize: 12,
    color: '#999',
    textAlign: 'center',
    marginTop: 5,
  },
});