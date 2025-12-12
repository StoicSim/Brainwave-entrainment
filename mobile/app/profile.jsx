import React, { useState } from 'react';
import { 
  View, Text, TouchableOpacity, ScrollView, 
  TextInput, StyleSheet, Alert 
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useUserProfile } from '../context/UserProfileContext';
import { useBleContext } from '../context/BleContext';

export default function ProfileScreen() {
  const router = useRouter();
  const { userProfile, updateProfile, resetProfile, isSetupComplete } = useUserProfile();
  const { device, handleDisconnect } = useBleContext();
  
  const [name, setName] = useState(userProfile.name);
  const [age, setAge] = useState(userProfile.age);
  const [gender, setGender] = useState(userProfile.gender);

  const handleSave = () => {
    updateProfile({ name, age, gender });
    Alert.alert('Success', 'Profile saved successfully!');
  };

  const handleBackNavigation = () => {
    // If setup is incomplete, disconnect device if connected and redirect to home
    if (!isSetupComplete()) {
      if (device) {
        handleDisconnect();
      }
      router.replace('/');
    } else {
      router.back();
    }
  };

  const handleReset = () => {
    Alert.alert(
      'Reset Profile',
      'Are you sure you want to reset all profile data? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: () => {
            resetProfile();
            Alert.alert('Profile Reset', 'All data has been cleared.');
          }
        }
      ]
    );
  };

  const handleResetPersonalityTest = () => {
    Alert.alert(
      'Reset Personality Test',
      'Reset your personality test results?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: () => {
            updateProfile({
              personalityTest: {
                completed: false,
                timestamp: null,
                scores: {}
              }
            });
            Alert.alert('Reset', 'Personality test has been reset.');
          }
        }
      ]
    );
  };

  const handleResetIAF = () => {
    Alert.alert(
      'Reset IAF Calibration',
      'Reset your IAF calibration results?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: () => {
            updateProfile({
              iafCalibration: {
                completed: false,
                timestamp: null,
                iaf: null
              }
            });
            Alert.alert('Reset', 'IAF calibration has been reset.');
          }
        }
      ]
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBackNavigation} style={styles.backButton}>
          <Ionicons name="arrow-back" size={28} color="#fff" />
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <Ionicons name="person-circle-outline" size={24} color="#fff" style={styles.headerIcon} />
          <Text style={styles.headerTitle}>User Profile</Text>
        </View>
        <View style={styles.backButton} />
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        {/* Basic Info Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Basic Information</Text>
          
          <Text style={styles.label}>Name</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="Enter your name"
            placeholderTextColor="#999"
          />

          <Text style={styles.label}>Age</Text>
          <TextInput
            style={styles.input}
            value={age}
            onChangeText={setAge}
            placeholder="Enter your age"
            placeholderTextColor="#999"
            keyboardType="numeric"
          />

          <Text style={styles.label}>Gender</Text>
          <View style={styles.genderButtons}>
            {['M', 'F', 'Other'].map((g) => (
              <TouchableOpacity
                key={g}
                style={[styles.genderButton, gender === g && styles.genderButtonActive]}
                onPress={() => setGender(g)}
              >
                <Text style={[styles.genderButtonText, gender === g && styles.genderButtonTextActive]}>
                  {g}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
            <Text style={styles.saveButtonText}>💾 Save Basic Info</Text>
          </TouchableOpacity>
        </View>

        {/* Personality Test Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Personality Test (Big Five)</Text>
            {userProfile.personalityTest.completed && (
              <TouchableOpacity onPress={handleResetPersonalityTest}>
                <Text style={styles.resetText}>Reset</Text>
              </TouchableOpacity>
            )}
          </View>
          
          {userProfile.personalityTest.completed ? (
            <View>
              <View style={styles.completedCard}>
                <Text style={styles.completedIcon}>✅</Text>
                <View style={styles.completedInfo}>
                  <Text style={styles.completedText}>Completed</Text>
                  <Text style={styles.completedDate}>
                    {new Date(userProfile.personalityTest.timestamp).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </Text>
                </View>
              </View>

              {/* Personality Scores */}
              {userProfile.personalityTest.scores && Object.keys(userProfile.personalityTest.scores).length > 0 && (
                <View style={styles.scoresCard}>
                  <Text style={styles.scoresTitle}>Your Scores:</Text>
                  {Object.entries(userProfile.personalityTest.scores).map(([trait, score]) => (
                    <View key={trait} style={styles.scoreRow}>
                      <Text style={styles.scoreTrait}>
                        {trait.charAt(0).toUpperCase() + trait.slice(1)}
                      </Text>
                      <View style={styles.scoreBarContainer}>
                        <View style={[styles.scoreBar, { width: `${score}%` }]} />
                        <Text style={styles.scoreValue}>{score}</Text>
                      </View>
                    </View>
                  ))}
                </View>
              )}
            </View>
          ) : (
            <View style={styles.pendingCard}>
              <Text style={styles.pendingIcon}>⏳</Text>
              <Text style={styles.pendingText}>Not completed yet</Text>
            </View>
          )}
        </View>

        {/* IAF Calibration Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>IAF Calibration</Text>
            {userProfile.iafCalibration.completed && (
              <TouchableOpacity onPress={handleResetIAF}>
                <Text style={styles.resetText}>Reset</Text>
              </TouchableOpacity>
            )}
          </View>
          
          {userProfile.iafCalibration.completed ? (
            <View>
              <View style={styles.completedCard}>
                <Text style={styles.completedIcon}>✅</Text>
                <View style={styles.completedInfo}>
                  <Text style={styles.completedText}>Completed</Text>
                  <Text style={styles.completedDate}>
                    {new Date(userProfile.iafCalibration.timestamp).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </Text>
                </View>
              </View>

              <View style={styles.iafCard}>
                <Text style={styles.iafLabel}>Individual Alpha Frequency:</Text>
                <Text style={styles.iafValue}>{userProfile.iafCalibration.iaf} Hz</Text>
                <Text style={styles.iafDescription}>
                  Your personal alpha wave frequency, used for optimal brain entrainment.
                </Text>
              </View>
            </View>
          ) : (
            <View style={styles.pendingCard}>
              <Text style={styles.pendingIcon}>⏳</Text>
              <Text style={styles.pendingText}>Not completed yet</Text>
            </View>
          )}
        </View>

        {/* Profile Status Summary */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Profile Status</Text>
          <View style={[styles.statusCard, userProfile.profileComplete && styles.statusCardComplete]}>
            <Text style={styles.statusIcon}>
              {userProfile.profileComplete ? '✅' : '⚠️'}
            </Text>
            <View style={styles.statusInfo}>
              <Text style={styles.statusText}>
                {userProfile.profileComplete 
                  ? 'Profile Complete - Ready to Monitor' 
                  : 'Profile Incomplete - Complete all steps'}
              </Text>
              <View style={styles.statusChecklist}>
                <Text style={styles.statusItem}>
                  {userProfile.name && userProfile.age && userProfile.gender ? '✓' : '○'} Basic Info
                </Text>
                <Text style={styles.statusItem}>
                  {userProfile.personalityTest.completed ? '✓' : '○'} Personality Test
                </Text>
                <Text style={styles.statusItem}>
                  {userProfile.iafCalibration.completed ? '✓' : '○'} IAF Calibration
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Reset Button */}
        <TouchableOpacity style={styles.resetButton} onPress={handleReset}>
          <Text style={styles.resetButtonText}>🗑️ Reset All Data</Text>
        </TouchableOpacity>

        <View style={styles.bottomPadding} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#4CAF50',
    paddingTop: 50,
    paddingBottom: 15,
    paddingHorizontal: 15,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerIcon: {
    marginRight: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 20,
  },
  section: {
    backgroundColor: '#fff',
    borderRadius: 15,
    padding: 20,
    marginBottom: 20,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
  },
  resetText: {
    fontSize: 14,
    color: '#F44336',
    fontWeight: '600',
  },
  label: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
    marginTop: 12,
    fontWeight: '600',
  },
  input: {
    backgroundColor: '#f9f9f9',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    padding: 14,
    fontSize: 16,
    color: '#333',
  },
  genderButtons: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
  },
  genderButton: {
    flex: 1,
    paddingVertical: 14,
    borderWidth: 2,
    borderColor: '#ddd',
    borderRadius: 10,
    alignItems: 'center',
  },
  genderButtonActive: {
    borderColor: '#4CAF50',
    backgroundColor: '#E8F5E9',
  },
  genderButtonText: {
    fontSize: 16,
    color: '#666',
    fontWeight: '600',
  },
  genderButtonTextActive: {
    color: '#4CAF50',
    fontWeight: 'bold',
  },
  saveButton: {
    backgroundColor: '#4CAF50',
    padding: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 20,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  completedCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F5E9',
    padding: 15,
    borderRadius: 12,
    marginBottom: 15,
  },
  completedIcon: {
    fontSize: 28,
    marginRight: 15,
  },
  completedInfo: {
    flex: 1,
  },
  completedText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#2E7D32',
  },
  completedDate: {
    fontSize: 13,
    color: '#558B2F',
    marginTop: 4,
  },
  scoresCard: {
    backgroundColor: '#f9f9f9',
    padding: 18,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  scoresTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#333',
    marginBottom: 15,
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  scoreTrait: {
    fontSize: 14,
    color: '#666',
    width: 150,
    fontWeight: '600',
  },
  scoreBarContainer: {
    flex: 1,
    height: 28,
    backgroundColor: '#e0e0e0',
    borderRadius: 14,
    overflow: 'hidden',
    position: 'relative',
    justifyContent: 'center',
  },
  scoreBar: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: '#4CAF50',
    borderRadius: 14,
  },
  scoreValue: {
    fontSize: 13,
    fontWeight: '700',
    color: '#333',
    textAlign: 'center',
    zIndex: 1,
  },
  iafCard: {
    backgroundColor: '#E8F5E9',
    padding: 20,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#4CAF50',
  },
  iafLabel: {
    fontSize: 14,
    color: '#2E7D32',
    marginBottom: 8,
    fontWeight: '600',
  },
  iafValue: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#1B5E20',
    marginBottom: 8,
  },
  iafDescription: {
    fontSize: 13,
    color: '#388E3C',
    lineHeight: 18,
  },
  pendingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF3E0',
    padding: 18,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#FFB74D',
  },
  pendingIcon: {
    fontSize: 28,
    marginRight: 15,
  },
  pendingText: {
    fontSize: 16,
    color: '#E65100',
    fontWeight: '600',
  },
  statusCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF3E0',
    padding: 18,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#FFB74D',
  },
  statusCardComplete: {
    backgroundColor: '#E8F5E9',
    borderColor: '#4CAF50',
  },
  statusIcon: {
    fontSize: 36,
    marginRight: 15,
  },
  statusInfo: {
    flex: 1,
  },
  statusText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#333',
    marginBottom: 12,
  },
  statusChecklist: {
    gap: 6,
  },
  statusItem: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  resetButton: {
    backgroundColor: '#F44336',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 10,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
  },
  resetButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  bottomPadding: {
    height: 100,
  },
});