import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView,
  TextInput, StyleSheet, Alert, ActivityIndicator
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useBleContext } from '../../context/BleContext';
import {
  getCurrentUser,
  updateCurrentUserProfile,
  logoutResearcher
} from '../../utils/ResearcherAuth';

export default function ResearcherProfileScreen() {
  const router = useRouter();
  const { device, handleDisconnect } = useBleContext();

  const [currentUser, setCurrentUser] = useState(null);
  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [gender, setGender] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const user = await getCurrentUser();
      if (user) {
        setCurrentUser(user);
        setName(user.name || '');
        setAge(user.age || '');
        setGender(user.gender || '');
      }
    } catch (error) {
      console.warn('loadProfile error:', error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    const result = await updateCurrentUserProfile({ name, age, gender });
    setIsSaving(false);
    if (result.success) {
      setCurrentUser(prev => ({ ...prev, name, age, gender }));
      Alert.alert('Saved', 'Profile updated successfully!');
    } else {
      Alert.alert('Error', result.error);
    }
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
              if (device) await handleDisconnect();
              await logoutResearcher();
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

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2196F3" />
      </View>
    );
  }

  const isProfileComplete = name && age && gender;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTitleContainer}>
          <Ionicons name="person-circle-outline" size={24} color="#fff" style={styles.headerIcon} />
          <Text style={styles.headerTitle}>Researcher Profile</Text>
        </View>
        <TouchableOpacity style={styles.logoutHeaderButton} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={22} color="#fff" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>

        {/* Logged in as badge */}
        <View style={styles.researcherBadge}>
          <Ionicons name="flask-outline" size={18} color="#1565C0" />
          <Text style={styles.researcherBadgeText}>
            Logged in as{' '}
            <Text style={styles.researcherUsername}>
              @{currentUser?.username || 'unknown'}
            </Text>
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

          <TouchableOpacity
            style={[styles.saveButton, isSaving && styles.saveButtonDisabled]}
            onPress={handleSave}
            disabled={isSaving}
          >
            {isSaving ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.saveButtonText}>💾 Save Profile</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Account Info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account Info</Text>
          <View style={styles.accountRow}>
            <Ionicons name="person-outline" size={18} color="#666" />
            <Text style={styles.accountLabel}>Username</Text>
            <Text style={styles.accountValue}>@{currentUser?.username}</Text>
          </View>
          <View style={styles.accountRow}>
            <Ionicons name="calendar-outline" size={18} color="#666" />
            <Text style={styles.accountLabel}>Joined</Text>
            <Text style={styles.accountValue}>
              {currentUser?.createdAt
                ? new Date(currentUser.createdAt).toLocaleDateString()
                : 'N/A'}
            </Text>
          </View>
          <View style={[styles.statusCard, isProfileComplete && styles.statusCardComplete]}>
            <Text style={styles.statusIcon}>{isProfileComplete ? '✅' : '⚠️'}</Text>
            <View style={styles.statusInfo}>
              <Text style={styles.statusText}>
                {isProfileComplete ? 'Profile Complete' : 'Profile Incomplete — Fill in your details'}
              </Text>
              <Text style={styles.statusItem}>
                {`${name ? '✓' : '○'} Name   ${age ? '✓' : '○'} Age   ${gender ? '✓' : '○'} Gender`}
              </Text>
            </View>
          </View>
        </View>

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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
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
  researcherUsername: {
    fontWeight: 'bold',
    color: '#0D47A1',
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
  saveButtonDisabled: {
    backgroundColor: '#90CAF9',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  accountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    marginBottom: 4,
  },
  accountLabel: {
    fontSize: 14,
    color: '#666',
    flex: 1,
  },
  accountValue: {
    fontSize: 14,
    color: '#333',
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
    marginTop: 14,
  },
  statusCardComplete: {
    backgroundColor: '#E3F2FD',
    borderColor: '#2196F3',
  },
  statusIcon: {
    fontSize: 32,
    marginRight: 14,
  },
  statusInfo: {
    flex: 1,
  },
  statusText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#333',
    marginBottom: 6,
  },
  statusItem: {
    fontSize: 13,
    color: '#666',
    fontWeight: '500',
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
