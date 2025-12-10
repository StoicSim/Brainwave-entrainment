import React, { useState } from 'react';
import { 
  View, Text, TouchableOpacity, ScrollView, 
  Modal, TextInput, StyleSheet 
} from 'react-native';

export default function UserProfileModal({ visible, onClose, userProfile, updateProfile }) {
  const [name, setName] = useState(userProfile.name);
  const [age, setAge] = useState(userProfile.age);
  const [gender, setGender] = useState(userProfile.gender);

  const handleSave = () => {
    updateProfile({ name, age, gender });
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={true}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>👤 User Profile</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalBody}>
            {/* Basic Info */}
            <View style={styles.formSection}>
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
            </View>

            {/* Personality Test Status */}
            <View style={styles.formSection}>
              <Text style={styles.sectionTitle}>Personality Test</Text>
              {userProfile.personalityTest.completed ? (
                <View style={styles.completedCard}>
                  <Text style={styles.completedIcon}>✅</Text>
                  <View>
                    <Text style={styles.completedText}>Completed</Text>
                    <Text style={styles.completedDate}>
                      {new Date(userProfile.personalityTest.timestamp).toLocaleDateString()}
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

            {/* IAF Calibration Status */}
            <View style={styles.formSection}>
              <Text style={styles.sectionTitle}>IAF Calibration</Text>
              {userProfile.iafCalibration.completed ? (
                <View style={styles.completedCard}>
                  <Text style={styles.completedIcon}>✅</Text>
                  <View>
                    <Text style={styles.completedText}>Completed</Text>
                    <Text style={styles.completedDate}>
                      IAF: {userProfile.iafCalibration.iaf} Hz
                    </Text>
                    <Text style={styles.completedDate}>
                      {new Date(userProfile.iafCalibration.timestamp).toLocaleDateString()}
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
          </ScrollView>

          <View style={styles.modalFooter}>
            <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
              <Text style={styles.saveButtonText}>Save Profile</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '90%',
    maxHeight: '80%',
    backgroundColor: '#fff',
    borderRadius: 20,
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#2196F3',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  closeButton: {
    width: 30,
    height: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 24,
    color: '#fff',
  },
  modalBody: {
    flex: 1,
    padding: 20,
  },
  formSection: {
    marginBottom: 25,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
  },
  label: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
    marginTop: 12,
  },
  input: {
    backgroundColor: '#f5f5f5',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#333',
  },
  genderButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  genderButton: {
    flex: 1,
    paddingVertical: 12,
    borderWidth: 2,
    borderColor: '#ddd',
    borderRadius: 8,
    alignItems: 'center',
  },
  genderButtonActive: {
    borderColor: '#2196F3',
    backgroundColor: '#E3F2FD',
  },
  genderButtonText: {
    fontSize: 16,
    color: '#666',
  },
  genderButtonTextActive: {
    color: '#2196F3',
    fontWeight: 'bold',
  },
  completedCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F5E9',
    padding: 15,
    borderRadius: 10,
  },
  completedIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  completedText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2E7D32',
  },
  completedDate: {
    fontSize: 12,
    color: '#558B2F',
    marginTop: 2,
  },
  pendingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF3E0',
    padding: 15,
    borderRadius: 10,
  },
  pendingIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  pendingText: {
    fontSize: 16,
    color: '#E65100',
  },
  modalFooter: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  saveButton: {
    backgroundColor: '#4CAF50',
    padding: 16,
    borderRadius: 10,
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});