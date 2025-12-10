import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useUserProfile } from '../context/UserProfileContext';
import UserProfileModal from '../components/UserProfileModal';

export default function HomeScreen() {
  const router = useRouter();
  const { userProfile, updateProfile, isSetupComplete } = useUserProfile();
  const [checklistExpanded, setChecklistExpanded] = useState(true);
  const [profileModalVisible, setProfileModalVisible] = useState(false);

  const handlePersonalityTest = () => {
    // Navigate to personality test screen or show modal
    // For now, simulate completion
    Alert.alert(
      'Personality Test',
      'This would navigate to a full personality assessment. For demo, marking as complete.',
      [
        {
          text: 'Complete Test',
          onPress: () => {
            updateProfile({
              personalityTest: {
                completed: true,
                timestamp: new Date().toISOString(),
                scores: {
                  openness: 75,
                  conscientiousness: 82,
                  extraversion: 68,
                  agreeableness: 79,
                  neuroticism: 45
                }
              }
            });
          }
        },
        { text: 'Cancel', style: 'cancel' }
      ]
    );
  };

  const handleIAFCalibration = () => {
    // Navigate to IAF calibration screen
    Alert.alert(
      'IAF Calibration',
      'This would start a 2-minute brainwave scan to determine your Individual Alpha Frequency. For demo, marking as complete.',
      [
        {
          text: 'Start Calibration',
          onPress: () => {
            updateProfile({
              iafCalibration: {
                completed: true,
                timestamp: new Date().toISOString(),
                iaf: 10.2
              }
            });
          }
        },
        { text: 'Cancel', style: 'cancel' }
      ]
    );
  };

  const handleStartMonitoring = () => {
    if (!isSetupComplete()) {
      Alert.alert(
        'Setup Incomplete',
        'Please complete all setup steps before starting monitoring.'
      );
      return;
    }
    router.push('/monitor');
  };

  return (
    <View style={styles.container}>
      {/* User Profile Icon */}
      <TouchableOpacity 
        style={styles.userIconButton}
        onPress={() => setProfileModalVisible(true)}
      >
        <Text style={styles.userIcon}>👤</Text>
      </TouchableOpacity>

      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.content}
      >
        <Text style={styles.title}>Brain Entrainment App</Text>
        <Text style={styles.subtitle}>Alpha Wave Focus & Relaxation</Text>
        
        <View style={styles.infoBox}>
          <Text style={styles.infoTitle}>🧠 What is this?</Text>
          <Text style={styles.infoText}>
            This app connects to your EEG device to monitor your brainwaves in real-time. 
            Our focus is on Alpha waves, which are associated with relaxation and calm focus.
          </Text>
        </View>

        {/* Setup Checklist */}
        <View style={styles.checklistCard}>
          <TouchableOpacity 
            style={styles.checklistHeader}
            onPress={() => setChecklistExpanded(!checklistExpanded)}
          >
            <Text style={styles.checklistTitle}>
              {isSetupComplete() ? '✅' : '⚙️'} Personal Mode Setup
            </Text>
            <Text style={styles.expandIcon}>{checklistExpanded ? '▼' : '▶'}</Text>
          </TouchableOpacity>

          {checklistExpanded && (
            <View style={styles.checklistBody}>
              {/* Basic Info */}
              <View style={styles.checklistItem}>
                <View style={styles.checklistItemHeader}>
                  <Text style={styles.checklistIcon}>
                    {userProfile.name && userProfile.age && userProfile.gender ? '✅' : '⭕'}
                  </Text>
                  <Text style={styles.checklistItemTitle}>Basic Information</Text>
                </View>
                <Text style={styles.checklistItemDesc}>
                  {userProfile.name && userProfile.age && userProfile.gender
                    ? `${userProfile.name}, ${userProfile.age}, ${userProfile.gender}`
                    : 'Complete your profile (tap 👤 icon above)'}
                </Text>
              </View>

              {/* Personality Test */}
              <View style={styles.checklistItem}>
                <View style={styles.checklistItemHeader}>
                  <Text style={styles.checklistIcon}>
                    {userProfile.personalityTest.completed ? '✅' : '⭕'}
                  </Text>
                  <Text style={styles.checklistItemTitle}>Step 1: Personality Test</Text>
                </View>
                <Text style={styles.checklistItemDesc}>15 min assessment</Text>
                {!userProfile.personalityTest.completed && (
                  <TouchableOpacity 
                    style={styles.checklistButton}
                    onPress={handlePersonalityTest}
                  >
                    <Text style={styles.checklistButtonText}>Start Test</Text>
                  </TouchableOpacity>
                )}
              </View>

              {/* IAF Calibration */}
              <View style={styles.checklistItem}>
                <View style={styles.checklistItemHeader}>
                  <Text style={styles.checklistIcon}>
                    {userProfile.iafCalibration.completed ? '✅' : '⭕'}
                  </Text>
                  <Text style={styles.checklistItemTitle}>Step 2: IAF Calibration</Text>
                </View>
                <Text style={styles.checklistItemDesc}>2 min brainwave scan</Text>
                {!userProfile.iafCalibration.completed && (
                  <TouchableOpacity 
                    style={styles.checklistButton}
                    onPress={handleIAFCalibration}
                  >
                    <Text style={styles.checklistButtonText}>Start Calibration</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          )}
        </View>

        {/* Main Action Button */}
        <TouchableOpacity 
          style={[
            styles.primaryButton,
            !isSetupComplete() && styles.primaryButtonDisabled
          ]}
          onPress={handleStartMonitoring}
        >
          <Text style={styles.buttonText}>
            {isSetupComplete() ? 'Start Monitoring' : 'Complete Setup First'}
          </Text>
        </TouchableOpacity>

        {!isSetupComplete() && (
          <Text style={styles.warningText}>
            ⚠️ Complete all setup steps to unlock monitoring
          </Text>
        )}

        <TouchableOpacity 
          style={styles.secondaryButton}
          onPress={() => router.push('/about')}
        >
          <Text style={styles.secondaryButtonText}>Data Collection Info</Text>
        </TouchableOpacity>
      </ScrollView>

      <View style={styles.footer}>
        <Text style={styles.footerText}>Connect your mind to the waves</Text>
        <Text style={styles.footerSubtext}>
          Next steps: Cloud storage → AI tone generation
        </Text>
      </View>

      {/* Profile Modal */}
      <UserProfileModal
        visible={profileModalVisible}
        onClose={() => setProfileModalVisible(false)}
        userProfile={userProfile}
        updateProfile={updateProfile}
      />
    </View>
  );
}

// Add new styles
const styles = StyleSheet.create({
  // ... existing styles ...
  
  userIconButton: {
    position: 'absolute',
    top: 15,
    right: 15,
    width: 45,
    height: 45,
    borderRadius: 22.5,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  userIcon: {
    fontSize: 24,
  },
  checklistCard: {
    backgroundColor: '#fff',
    borderRadius: 15,
    marginBottom: 20,
    overflow: 'hidden',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  checklistHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#2196F3',
  },
  checklistTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  expandIcon: {
    fontSize: 16,
    color: '#fff',
  },
  checklistBody: {
    padding: 15,
  },
  checklistItem: {
    marginBottom: 20,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  checklistItemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  checklistIcon: {
    fontSize: 20,
    marginRight: 10,
  },
  checklistItemTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  checklistItemDesc: {
    fontSize: 13,
    color: '#666',
    marginLeft: 30,
    marginBottom: 10,
  },
  checklistButton: {
    backgroundColor: '#4CAF50',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignSelf: 'flex-start',
    marginLeft: 30,
  },
  checklistButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  primaryButtonDisabled: {
    backgroundColor: '#ccc',
    elevation: 0,
  },
  warningText: {
    fontSize: 13,
    color: '#F44336',
    textAlign: 'center',
    marginBottom: 15,
  },
});