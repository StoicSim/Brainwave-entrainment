import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useUserProfile } from '../context/UserProfileContext';

export default function HomeScreen() {
  const router = useRouter();
  const { userProfile, isLoading, isSetupComplete } = useUserProfile();

  const handleStartMonitoring = () => {
    router.push('/monitor');
  };

  const handleGoToProfile = () => {
    router.push('/profile');
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4CAF50" />
        <Text style={styles.loadingText}>Loading your profile...</Text>
      </View>
    );
  }

  const isBasicInfoComplete = userProfile.name && userProfile.age && userProfile.gender;

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

        {/* User Profile Summary */}
        {isSetupComplete() && (
          <View style={styles.profileCard}>
            <Text style={styles.profileTitle}>👤 Your Profile</Text>
            <View style={styles.profileRow}>
              <Text style={styles.profileLabel}>Name:</Text>
              <Text style={styles.profileValue}>{userProfile.name}</Text>
            </View>
            <View style={styles.profileRow}>
              <Text style={styles.profileLabel}>Age:</Text>
              <Text style={styles.profileValue}>{userProfile.age}</Text>
            </View>
            <View style={styles.profileRow}>
              <Text style={styles.profileLabel}>Gender:</Text>
              <Text style={styles.profileValue}>{userProfile.gender}</Text>
            </View>
            
            {userProfile.personalityTest?.completed && (
              <View style={styles.profileSection}>
                <Text style={styles.profileSectionTitle}>✅ Personality Test Complete</Text>
                <Text style={styles.profileDetail}>
                  Completed: {new Date(userProfile.personalityTest.timestamp).toLocaleDateString()}
                </Text>
              </View>
            )}
            
            {userProfile.iafCalibration?.completed && (
              <View style={styles.profileSection}>
                <Text style={styles.profileSectionTitle}>✅ IAF Calibration Complete</Text>
                <Text style={styles.profileDetail}>
                  Your IAF: {userProfile.iafCalibration.iaf} Hz
                </Text>
              </View>
            )}

            <TouchableOpacity 
              style={styles.editProfileButton}
              onPress={handleGoToProfile}
            >
              <Text style={styles.editProfileText}>View Full Profile</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Setup Status */}
        {isSetupComplete() ? (
          <View style={styles.completeBadge}>
            <Text style={styles.completeBadgeIcon}>✅</Text>
            <Text style={styles.completeBadgeText}>
              Profile loaded! Ready to monitor.
            </Text>
          </View>
        ) : (
          <View style={styles.warningCard}>
            <Text style={styles.warningIcon}>⚠️</Text>
            <Text style={styles.warningTitle}>Profile Incomplete</Text>
            <Text style={styles.warningDesc}>
              Some profile data is missing. Please complete your profile setup.
            </Text>
            <TouchableOpacity 
              style={styles.warningButton}
              onPress={handleGoToProfile}
            >
              <Text style={styles.warningButtonText}>Complete Profile</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Main Action Button */}
        <TouchableOpacity 
          style={styles.primaryButton}
          onPress={handleStartMonitoring}
        >
          <Text style={styles.buttonText}>Start Monitoring</Text>
        </TouchableOpacity>

        {/* How It Works */}
        <View style={styles.howItWorksCard}>
          <Text style={styles.howItWorksTitle}>📊 How It Works</Text>
          <View style={styles.stepContainer}>
            <View style={styles.step}>
              <Text style={styles.stepNumber}>1</Text>
              <Text style={styles.stepText}>Connect your EEG device</Text>
            </View>
            <View style={styles.step}>
              <Text style={styles.stepNumber}>2</Text>
              <Text style={styles.stepText}>Monitor your brainwaves in real-time</Text>
            </View>
            <View style={styles.step}>
              <Text style={styles.stepNumber}>3</Text>
              <Text style={styles.stepText}>Save recordings for analysis</Text>
            </View>
          </View>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <Text style={styles.footerText}>Connect your mind to the waves</Text>
        <Text style={styles.footerSubtext}>
          Powered by backend API • Real-time EEG monitoring
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  loadingText: {
    marginTop: 15,
    fontSize: 16,
    color: '#666',
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
  profileCard: {
    backgroundColor: '#fff',
    borderRadius: 15,
    padding: 20,
    marginBottom: 20,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  profileTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
  },
  profileRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  profileLabel: {
    fontSize: 15,
    color: '#666',
    fontWeight: '500',
  },
  profileValue: {
    fontSize: 15,
    color: '#333',
    fontWeight: '600',
  },
  profileSection: {
    marginTop: 15,
    padding: 12,
    backgroundColor: '#E8F5E9',
    borderRadius: 8,
  },
  profileSectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2E7D32',
    marginBottom: 4,
  },
  profileDetail: {
    fontSize: 13,
    color: '#555',
  },
  editProfileButton: {
    marginTop: 15,
    padding: 12,
    backgroundColor: '#2196F3',
    borderRadius: 8,
    alignItems: 'center',
  },
  editProfileText: {
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
  warningCard: {
    backgroundColor: '#fff',
    borderRadius: 15,
    padding: 20,
    marginBottom: 20,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FF9800',
  },
  warningIcon: {
    fontSize: 40,
    marginBottom: 10,
  },
  warningTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#F57C00',
    marginBottom: 8,
  },
  warningDesc: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 15,
  },
  warningButton: {
    backgroundColor: '#FF9800',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  warningButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  primaryButton: {
    backgroundColor: '#4CAF50',
    padding: 18,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 20,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  howItWorksCard: {
    backgroundColor: '#fff',
    borderRadius: 15,
    padding: 20,
    marginBottom: 20,
  },
  howItWorksTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
  },
  stepContainer: {
    gap: 12,
  },
  step: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 15,
  },
  stepNumber: {
    width: 32,
    height: 32,
    backgroundColor: '#2196F3',
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
    lineHeight: 32,
    borderRadius: 16,
  },
  stepText: {
    flex: 1,
    fontSize: 14,
    color: '#555',
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