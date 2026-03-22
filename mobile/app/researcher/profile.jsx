import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView,
  TextInput, StyleSheet, Alert
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useUserProfile } from '../../context/UserProfileContext';
import { useBleContext } from '../../context/BleContext';
import AsyncStorage from '@react-native-async-storage/async-storage';

const AUTH_KEY = 'researcher_logged_in';

export default function ResearcherProfileScreen() {
  const router = useRouter();
  const { userProfile, updateProfile, resetProfile } = useUserProfile();
  const { device, handleDisconnect } = useBleContext();

  const [name, setName] = useState(userProfile.name);
  const [age, setAge] = useState(userProfile.age);
  const [gender, setGender] = useState(userProfile.gender);

  const handleSave = () => {
    updateProfile({ name, age, gender });
    Alert.alert('Success', 'Profile saved successfully!');
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

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout from researcher mode?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            try {
              // Disconnect BLE if connected
              if (device) await handleDisconnect();
              // Clear auth
              await AsyncStorage.removeItem(AUTH_KEY);
              // Go back to mode selection
              router.replace('/');
            } catch (error) {
              console.warn('Logout error:', error.message);
              router.replace('/');
            }
          }
        }
      ]
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTitleContainer}>
          <Ionicons name="person-circle-outline" size={24} color="#fff" style={styles.headerIcon} />
          <Text style={styles.headerTitle}>Researcher Profile</Text>
        </View>
        {/* Logout button in header */}
        <TouchableOpacity style={styles.logoutHeaderButton} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={22} color="#fff" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>

        {/* Researcher badge */}
        <View style={styles.researcherBadge}>
          <Ionicons name="flask-outline" size={18} color="#1565C0" />
          <Text style={styles.researcherBadgeText}>
            Logged in as Researcher
          </Text>
        </View>

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
            <Text style={styles.saveButtonText}>{'💾 Save Basic Info'}</Text>
          </TouchableOpacity>
        </View>

        {/* Profile Status */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Profile Status</Text>
          <View style={[
            styles.statusCard,
            userProfile.name && userProfile.age && userProfile.gender && styles.statusCardComplete
          ]}>
            <Text style={styles.statusIcon}>
              {userProfile.name && userProfile.age && userProfile.gender ? '✅' : '⚠️'}
            </Text>
            <View style={styles.statusInfo}>
              <Text style={styles.statusText}>
                {userProfile.name && userProfile.age && userProfile.gender
                  ? 'Profile Complete'
                  : 'Profile Incomplete — Fill in your details'}
              </Text>
              <Text style={styles.statusItem}>
                {`${userProfile.name && userProfile.age && userProfile.gender ? '✓' : '○'} Basic Info`}
              </Text>
            </View>
          </View>
        </View>

        {/* Reset Button */}
        <TouchableOpacity style={styles.resetButton} onPress={handleReset}>
          <Text style={styles.resetButtonText}>{'🗑️ Reset All Data'}</Text>
        </TouchableOpacity>

        {/* Logout Button */}
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={20} color="#fff" />
          <Text style={styles.logoutButtonText}>Logout from Researcher Mode</Text>
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
    backgroundColor: '#2196F3',
    paddingTop: 50,
    paddingBottom: 15,
    paddingHorizontal: 15,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
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
  logoutHeaderButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 20,
  },
  researcherBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#E3F2FD',
    padding: 12,
    borderRadius: 10,
    marginBottom: 20,
    borderLeftWidth: 3,
    borderLeftColor: '#2196F3',
  },
  researcherBadgeText: {
    fontSize: 14,
    color: '#1565C0',
    fontWeight: '600',
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
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
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
    borderColor: '#2196F3',
    backgroundColor: '#E3F2FD',
  },
  genderButtonText: {
    fontSize: 16,
    color: '#666',
    fontWeight: '600',
  },
  genderButtonTextActive: {
    color: '#2196F3',
    fontWeight: 'bold',
  },
  saveButton: {
    backgroundColor: '#2196F3',
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
    backgroundColor: '#E3F2FD',
    borderColor: '#2196F3',
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
    marginBottom: 6,
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
    marginBottom: 12,
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
  logoutButton: {
    backgroundColor: '#37474F',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
  },
  logoutButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  bottomPadding: {
    height: 100,
  },
});