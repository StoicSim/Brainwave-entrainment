import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useUserProfile } from '../context/UserProfileContext';

export default function HomeScreen() {
  const router = useRouter();
  const { userProfile, updateProfile, isSetupComplete, loadDemoData, resetProfile } = useUserProfile();
  const [checklistExpanded, setChecklistExpanded] = useState(true);

  const handleCompleteBasicInfo = () => {
    // Instantly complete basic info with demo data
    updateProfile({
      name: 'Sarah',
      age: '24',
      gender: 'F'
    });
  };

  const handlePersonalityTest = () => {
    // Instantly complete personality test with demo data
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
  };

  const handleIAFCalibration = () => {
    // Instantly complete IAF calibration with demo data
    updateProfile({
      iafCalibration: {
        completed: true,
        timestamp: new Date().toISOString(),
        iaf: 10.2
      }
    });
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

  const isBasicInfoComplete = userProfile.name && userProfile.age && userProfile.gender;
  const completedCount = 
    (isBasicInfoComplete ? 1 : 0) + 
    (userProfile.personalityTest.completed ? 1 : 0) + 
    (userProfile.iafCalibration.completed ? 1 : 0);

  return (
    <View style={styles.container}>
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

        {/* Setup Checklist - Collapsible */}
        {!isSetupComplete() && (
          <View style={styles.checklistCard}>
            <TouchableOpacity 
              style={styles.checklistHeader}
              onPress={() => setChecklistExpanded(!checklistExpanded)}
            >
              <Text style={styles.checklistTitle}>
                ⚙️ Setup Required ({completedCount}/3 Complete)
              </Text>
              <Text style={styles.expandIcon}>{checklistExpanded ? '▼' : '▶'}</Text>
            </TouchableOpacity>

            {checklistExpanded && (
              <View style={styles.checklistBody}>
                {/* Basic Info */}
                <View style={styles.checklistItem}>
                  <View style={styles.checklistItemHeader}>
                    <Text style={styles.checklistIcon}>
                      {isBasicInfoComplete ? '✅' : '⭕'}
                    </Text>
                    <Text style={styles.checklistItemTitle}>Basic Information</Text>
                  </View>
                  {isBasicInfoComplete ? (
                    <Text style={styles.checklistItemDesc}>
                      {userProfile.name}, {userProfile.age}, {userProfile.gender}
                    </Text>
                  ) : (
                    <>
                      <Text style={styles.checklistItemDesc}>
                        Tell us about yourself
                      </Text>
                      <TouchableOpacity 
                        style={styles.checklistButton}
                        onPress={handleCompleteBasicInfo}
                      >
                        <Text style={styles.checklistButtonText}>Complete Profile</Text>
                      </TouchableOpacity>
                    </>
                  )}
                </View>

                {/* Personality Test */}
                <View style={styles.checklistItem}>
                  <View style={styles.checklistItemHeader}>
                    <Text style={styles.checklistIcon}>
                      {userProfile.personalityTest.completed ? '✅' : '⭕'}
                    </Text>
                    <Text style={styles.checklistItemTitle}>Personality Test</Text>
                  </View>
                  {userProfile.personalityTest.completed ? (
                    <Text style={styles.checklistItemDesc}>
                      Completed on {new Date(userProfile.personalityTest.timestamp).toLocaleDateString()}
                    </Text>
                  ) : (
                    <>
                      <Text style={styles.checklistItemDesc}>15 min assessment</Text>
                      <TouchableOpacity 
                        style={styles.checklistButton}
                        onPress={handlePersonalityTest}
                      >
                        <Text style={styles.checklistButtonText}>Start Test</Text>
                      </TouchableOpacity>
                    </>
                  )}
                </View>

                {/* IAF Calibration */}
                <View style={styles.checklistItem}>
                  <View style={styles.checklistItemHeader}>
                    <Text style={styles.checklistIcon}>
                      {userProfile.iafCalibration.completed ? '✅' : '⭕'}
                    </Text>
                    <Text style={styles.checklistItemTitle}>IAF Calibration</Text>
                  </View>
                  {userProfile.iafCalibration.completed ? (
                    <Text style={styles.checklistItemDesc}>
                      IAF: {userProfile.iafCalibration.iaf} Hz
                    </Text>
                  ) : (
                    <>
                      <Text style={styles.checklistItemDesc}>2 min brainwave scan</Text>
                      <TouchableOpacity 
                        style={styles.checklistButton}
                        onPress={handleIAFCalibration}
                      >
                        <Text style={styles.checklistButtonText}>Start Calibration</Text>
                      </TouchableOpacity>
                    </>
                  )}
                </View>
              </View>
            )}
          </View>
        )}

        {/* Setup Complete Badge */}
        {isSetupComplete() && (
          <View style={styles.completeBadge}>
            <Text style={styles.completeBadgeIcon}>✅</Text>
            <Text style={styles.completeBadgeText}>Setup Complete! Ready to monitor.</Text>
          </View>
        )}

        {/* Quick Actions */}
        <View style={styles.quickActions}>
          <TouchableOpacity 
            style={styles.quickActionButton}
            onPress={loadDemoData}
          >
            <Text style={styles.quickActionText}> Load Demo Data</Text>
          </TouchableOpacity>
          
          {(userProfile.name || userProfile.personalityTest.completed || userProfile.iafCalibration.completed) && (
            <TouchableOpacity 
              style={[styles.quickActionButton, styles.quickActionDanger]}
              onPress={() => {
                Alert.alert(
                  'Reset Profile',
                  'Are you sure you want to reset all data?',
                  [
                    { text: 'Cancel', style: 'cancel' },
                    { 
                      text: 'Reset', 
                      style: 'destructive',
                      onPress: resetProfile 
                    }
                  ]
                );
              }}
            >
              <Text style={styles.quickActionTextDanger}> Reset All</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Main Action Button */}
        <TouchableOpacity 
          style={[
            styles.primaryButton,
            !isSetupComplete() && styles.primaryButtonDisabled
          ]}
          onPress={handleStartMonitoring}
          disabled={!isSetupComplete()}
        >
          <Text style={styles.buttonText}>
            {isSetupComplete() ? 'Start Monitoring' : '🔒 Complete Setup First'}
          </Text>
        </TouchableOpacity>

        {!isSetupComplete() && (
          <Text style={styles.warningText}>
            Complete the setup steps above to unlock monitoring
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
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 18,
    color: '#666',
    textAlign: 'center',
    marginBottom: 40,
  },
  infoBox: {
    backgroundColor: '#E8F5E9',
    padding: 20,
    borderRadius: 15,
    marginBottom: 20,
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
    lineHeight: 20,
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
  completeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E8F5E9',
    padding: 15,
    borderRadius: 10,
    marginBottom: 20,
    borderWidth: 2,
    borderColor: '#4CAF50',
  },
  completeBadgeIcon: {
    fontSize: 24,
    marginRight: 10,
  },
  completeBadgeText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2E7D32',
  },
  primaryButton: {
    backgroundColor: '#4CAF50',
    padding: 18,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 15,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  primaryButtonDisabled: {
    backgroundColor: '#ccc',
    elevation: 0,
    opacity: 0.7,
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  warningText: {
    fontSize: 13,
    color: '#F44336',
    textAlign: 'center',
    marginBottom: 15,
    fontStyle: 'italic',
  },
  secondaryButton: {
    backgroundColor: '#fff',
    padding: 18,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#4CAF50',
  },
  secondaryButtonText: {
    color: '#4CAF50',
    fontSize: 16,
    fontWeight: '600',
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
  quickActions: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 15,
  },
  quickActionButton: {
    flex: 1,
    backgroundColor: '#9C27B0',
    padding: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  quickActionDanger: {
    backgroundColor: '#F44336',
  },
  quickActionText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  quickActionTextDanger: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
});