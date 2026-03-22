import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, TextInput, StyleSheet, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useResearchSession } from '../../context/ResearchSessionContext';

export default function NewSubjectScreen() {
  const router = useRouter();
  const { currentSubject, updateSubjectInfo, getNextSubjectId } = useResearchSession();
  
  const [subjectId, setSubjectId] = useState('');
  const [subjectName, setSubjectName] = useState('');
  const [age, setAge] = useState('');
  const [gender, setGender] = useState('');
  const [autoGenerateId, setAutoGenerateId] = useState(true);
  const [basicInfoComplete, setBasicInfoComplete] = useState(false);

  // If returning to this screen with existing context data, repopulate
  React.useEffect(() => {
    if (currentSubject.subjectId && currentSubject.subjectName) {
      setBasicInfoComplete(true);
      setSubjectId(currentSubject.subjectId);
      setSubjectName(currentSubject.subjectName);
      setAge(currentSubject.age);
      setGender(currentSubject.gender);
    }
  }, [currentSubject.subjectId]);

  // Auto-generate ID on mount
  React.useEffect(() => {
    if (autoGenerateId && !subjectId) {
      setSubjectId(getNextSubjectId());
    }
  }, []);

  const handleAutoGenerateId = () => {
    setSubjectId(getNextSubjectId());
    setAutoGenerateId(true);
  };

  const handleManualEntry = () => {
    setSubjectId('');
    setAutoGenerateId(false);
  };

  const validateBasicInfo = () => {
    if (!subjectId.trim()) {
      Alert.alert('Missing Info', 'Please enter or generate a Subject ID');
      return false;
    }
    if (!subjectName.trim()) {
      Alert.alert('Missing Info', 'Please enter the subject name');
      return false;
    }
    if (!age.trim() || isNaN(age) || parseInt(age) < 1 || parseInt(age) > 120) {
      Alert.alert('Invalid Age', 'Please enter a valid age (1-120)');
      return false;
    }
    if (!gender) {
      Alert.alert('Missing Info', 'Please select a gender');
      return false;
    }
    return true;
  };

  const handleSaveBasicInfo = () => {
    if (!validateBasicInfo()) return;
    
    updateSubjectInfo({ subjectId, subjectName, age, gender });
    setBasicInfoComplete(true);
    Alert.alert(
      'Basic Info Saved',
      'Subject information saved. Ready to proceed to data collection.',
      [{ text: 'OK' }]
    );
  };

  const handleClearBasicInfo = () => {
    Alert.alert(
      'Clear Information',
      'Are you sure you want to clear all entered information?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Clear', 
          style: 'destructive',
          onPress: () => {
            setSubjectId('');
            setSubjectName('');
            setAge('');
            setGender('');
            setBasicInfoComplete(false);
            setAutoGenerateId(true);
          }
        }
      ]
    );
  };

  const handleProceedToDataCollection = () => {
    if (!basicInfoComplete) {
      Alert.alert(
        'Info Incomplete',
        'Please save subject information before proceeding.',
        [{ text: 'OK' }]
      );
      return;
    }

    router.push({
      pathname: '/research/data-collection',
      params: {
        subjectId,
        subjectName,
        age,
        gender,
      }
    });
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
          <Text style={styles.title}>✨ New Subject Registration</Text>
          <Text style={styles.subtitle}>Enter subject details to begin data collection</Text>
        </View>

        {/* Step 1: Subject Information */}
        <View style={[styles.section, basicInfoComplete && styles.sectionComplete]}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionIcon}>{basicInfoComplete ? '✅' : '📋'}</Text>
            <Text style={styles.sectionTitle}>Subject Information</Text>
          </View>

          {!basicInfoComplete ? (
            <View style={styles.formContainer}>
              {/* Subject ID */}
              <Text style={styles.label}>Subject ID</Text>
              <View style={styles.idInputContainer}>
                <TextInput
                  style={[styles.input, styles.idInput]}
                  value={subjectId}
                  onChangeText={setSubjectId}
                  placeholder="S001"
                  editable={!autoGenerateId}
                />
                <View style={styles.idButtonGroup}>
                  <TouchableOpacity 
                    style={[styles.idButton, autoGenerateId && styles.idButtonActive]}
                    onPress={handleAutoGenerateId}
                  >
                    <Text style={[styles.idButtonText, autoGenerateId && styles.idButtonTextActive]}>
                      Auto-generate
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={[styles.idButton, !autoGenerateId && styles.idButtonActive]}
                    onPress={handleManualEntry}
                  >
                    <Text style={[styles.idButtonText, !autoGenerateId && styles.idButtonTextActive]}>
                      Manual
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
              {autoGenerateId && (
                <Text style={styles.hint}>Next available ID: {subjectId}</Text>
              )}

              {/* Subject Name */}
              <Text style={styles.label}>Subject Name</Text>
              <TextInput
                style={styles.input}
                value={subjectName}
                onChangeText={setSubjectName}
                placeholder="Enter full name"
              />

              {/* Age */}
              <Text style={styles.label}>Age</Text>
              <TextInput
                style={styles.input}
                value={age}
                onChangeText={setAge}
                placeholder="Enter age"
                keyboardType="numeric"
              />

              {/* Gender */}
              <Text style={styles.label}>Gender</Text>
              <View style={styles.genderContainer}>
                {['M', 'F', 'O'].map((g) => (
                  <TouchableOpacity 
                    key={g}
                    style={[styles.genderButton, gender === g && styles.genderButtonActive]}
                    onPress={() => setGender(g)}
                  >
                    <Text style={[styles.genderButtonText, gender === g && styles.genderButtonTextActive]}>
                      {g === 'M' ? 'Male' : g === 'F' ? 'Female' : 'Other'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Action Buttons */}
              <View style={styles.buttonRow}>
                <TouchableOpacity 
                  style={[styles.button, styles.buttonSecondary]}
                  onPress={handleClearBasicInfo}
                >
                  <Text style={styles.buttonSecondaryText}>Clear</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.button, styles.buttonPrimary]}
                  onPress={handleSaveBasicInfo}
                >
                  <Text style={styles.buttonText}>Save & Continue →</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <View style={styles.completedInfo}>
              <Text style={styles.completedText}>Subject: {subjectId} - {subjectName}</Text>
              <Text style={styles.completedText}>Age: {age}, Gender: {gender}</Text>
              <TouchableOpacity 
                style={styles.editButton}
                onPress={() => setBasicInfoComplete(false)}
              >
                <Text style={styles.editButtonText}>Edit Info</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Proceed to Data Collection */}
        {basicInfoComplete && (
          <View style={styles.completeCard}>
            <Text style={styles.completeIcon}>🎉</Text>
            <Text style={styles.completeTitle}>Ready for Data Collection!</Text>
            <Text style={styles.completeText}>
              Subject {subjectId} is registered and ready.
            </Text>
            <TouchableOpacity 
              style={[styles.button, styles.buttonSuccess]}
              onPress={handleProceedToDataCollection}
            >
              <Text style={styles.buttonText}>Proceed to Data Collection →</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.noteBox}>
          <Text style={styles.noteText}>
            Note: All data is stored temporarily during this session.
          </Text>
        </View>

      </ScrollView>
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
    paddingBottom: 40,
  },
  header: {
    marginBottom: 20,
  },
  backButton: {
    marginBottom: 10,
  },
  backButtonText: {
    fontSize: 16,
    color: '#2196F3',
    fontWeight: '600',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 5,
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
  },
  section: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    marginBottom: 15,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  sectionComplete: {
    backgroundColor: '#F1F8F4',
    borderWidth: 2,
    borderColor: '#4CAF50',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  sectionIcon: {
    fontSize: 24,
    marginRight: 10,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
  },
  formContainer: {
    gap: 15,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 5,
  },
  input: {
    backgroundColor: '#f9f9f9',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  idInputContainer: {
    gap: 10,
  },
  idInput: {
    flex: 1,
  },
  idButtonGroup: {
    flexDirection: 'row',
    gap: 10,
  },
  idButton: {
    flex: 1,
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 10,
    alignItems: 'center',
  },
  idButtonActive: {
    backgroundColor: '#2196F3',
    borderColor: '#2196F3',
  },
  idButtonText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '600',
  },
  idButtonTextActive: {
    color: '#fff',
  },
  hint: {
    fontSize: 12,
    color: '#999',
    fontStyle: 'italic',
  },
  genderContainer: {
    flexDirection: 'row',
    gap: 10,
  },
  genderButton: {
    flex: 1,
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
  },
  genderButtonActive: {
    backgroundColor: '#4CAF50',
    borderColor: '#4CAF50',
  },
  genderButtonText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '600',
  },
  genderButtonTextActive: {
    color: '#fff',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 10,
  },
  button: {
    flex: 1,
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
  },
  buttonPrimary: {
    backgroundColor: '#2196F3',
  },
  buttonSecondary: {
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#ddd',
  },
  buttonSuccess: {
    backgroundColor: '#4CAF50',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  buttonSecondaryText: {
    color: '#666',
    fontSize: 16,
    fontWeight: '600',
  },
  completedInfo: {
    padding: 15,
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
  },
  completedText: {
    fontSize: 14,
    color: '#333',
    marginBottom: 5,
  },
  editButton: {
    marginTop: 10,
    alignSelf: 'flex-start',
  },
  editButtonText: {
    fontSize: 14,
    color: '#2196F3',
    fontWeight: '600',
  },
  completeCard: {
    backgroundColor: '#E8F5E9',
    borderRadius: 12,
    padding: 25,
    alignItems: 'center',
    marginBottom: 20,
    borderWidth: 2,
    borderColor: '#4CAF50',
  },
  completeIcon: {
    fontSize: 48,
    marginBottom: 10,
  },
  completeTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2E7D32',
    marginBottom: 5,
  },
  completeText: {
    fontSize: 14,
    color: '#555',
    marginBottom: 20,
    textAlign: 'center',
  },
  noteBox: {
    backgroundColor: '#FFF3E0',
    padding: 15,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#FF9800',
  },
  noteText: {
    fontSize: 13,
    color: '#555',
  },
});