import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, TextInput, StyleSheet, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useResearchSession } from '../../context/ResearchSessionContext';

export default function NewSubjectScreen() {
  const router = useRouter();
  const { currentSubject, updateSubjectInfo } = useResearchSession();
  
  // Subject state
  const [subjectId, setSubjectId] = useState('');
  const [subjectName, setSubjectName] = useState('');
  const [age, setAge] = useState('');
  const [gender, setGender] = useState('');
  const [autoGenerateId, setAutoGenerateId] = useState(true);

  // Assessment progress state - check if already saved in context
  const [basicInfoComplete, setBasicInfoComplete] = useState(false);
  const personalityComplete = currentSubject.personalityTest.completed;
  const iafComplete = currentSubject.iafCalibration.completed;
  
  // Assessment data comes from context
  const personalityScores = currentSubject.personalityTest.scores;
  const iafData = currentSubject.iafCalibration;

  // Check if we're returning with existing data
  React.useEffect(() => {
    // If context has subject info, we've already saved basic info
    if (currentSubject.subjectId && currentSubject.subjectName) {
      setBasicInfoComplete(true);
      setSubjectId(currentSubject.subjectId);
      setSubjectName(currentSubject.subjectName);
      setAge(currentSubject.age);
      setGender(currentSubject.gender);
    }
  }, [currentSubject.subjectId]);

  // Generate next subject ID
  const generateNextId = () => {
    // TODO: Check existing subjects and generate next ID
    // For now, placeholder logic
    const nextNum = 1; // Will increment based on existing subjects
    return `S${String(nextNum).padStart(3, '0')}`;
  };

  const handleAutoGenerateId = () => {
    const nextId = generateNextId();
    setSubjectId(nextId);
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
    
    // Save to research context
    updateSubjectInfo({
      subjectId,
      subjectName,
      age,
      gender
    });
    
    setBasicInfoComplete(true);
    Alert.alert(
      'Basic Info Saved',
      'Subject information saved. Please proceed with assessments.',
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

  const handleStartPersonalityTest = () => {
    // Navigate to existing personality test
    // Pass callback to return here with results
    router.push({
      pathname: '/personality-test',
      params: { 
        researchMode: 'true',
        subjectId: subjectId,
        returnTo: '/research/new-subject'
      }
    });
  };

  const handleStartIAFCalibration = () => {
    if (!personalityComplete) {
      Alert.alert(
        'Complete Personality Test First',
        'Please complete the personality test before IAF calibration.',
        [{ text: 'OK' }]
      );
      return;
    }
    
    // Navigate to existing IAF calibration
    router.push({
      pathname: '/iaf-calibration',
      params: { 
        researchMode: 'true',
        subjectId: subjectId,
        returnTo: '/research/new-subject'
      }
    });
  };

  const handleProceedToDataCollection = () => {
    if (!basicInfoComplete || !personalityComplete || !iafComplete) {
      Alert.alert(
        'Assessment Incomplete',
        'Please complete all assessments before proceeding to data collection.',
        [{ text: 'OK' }]
      );
      return;
    }

    // Navigate to data collection session
    router.push({
      pathname: '/research/data-collection',
      params: {
        subjectId: subjectId,
        subjectName: subjectName,
        age: age,
        gender: gender,
        // Pass assessment data
        personality: JSON.stringify(personalityScores),
        iaf: JSON.stringify(iafData)
      }
    });
  };

  // Auto-generate ID on mount if needed
  React.useEffect(() => {
    if (autoGenerateId && !subjectId) {
      handleAutoGenerateId();
    }
  }, []);

  // Log when personality/IAF completes (for debugging)
  React.useEffect(() => {
    console.log('Assessment status:', {
      personality: personalityComplete,
      iaf: iafComplete,
      basicInfo: basicInfoComplete
    });
  }, [personalityComplete, iafComplete, basicInfoComplete]);

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
          <Text style={styles.subtitle}>Complete all steps to begin data collection</Text>
        </View>

        {/* Progress Indicator */}
        <View style={styles.progressContainer}>
          <View style={styles.progressBar}>
            <View style={[
              styles.progressFill, 
              { width: `${((basicInfoComplete ? 1 : 0) + (personalityComplete ? 1 : 0) + (iafComplete ? 1 : 0)) / 3 * 100}%` }
            ]} />
          </View>
          <Text style={styles.progressText}>
            Step {basicInfoComplete ? (personalityComplete ? (iafComplete ? 3 : 2) : 1) : 1} of 3
          </Text>
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
                <TouchableOpacity 
                  style={[styles.genderButton, gender === 'M' && styles.genderButtonActive]}
                  onPress={() => setGender('M')}
                >
                  <Text style={[styles.genderButtonText, gender === 'M' && styles.genderButtonTextActive]}>
                    Male
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.genderButton, gender === 'F' && styles.genderButtonActive]}
                  onPress={() => setGender('F')}
                >
                  <Text style={[styles.genderButtonText, gender === 'F' && styles.genderButtonTextActive]}>
                    Female
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.genderButton, gender === 'O' && styles.genderButtonActive]}
                  onPress={() => setGender('O')}
                >
                  <Text style={[styles.genderButtonText, gender === 'O' && styles.genderButtonTextActive]}>
                    Other
                  </Text>
                </TouchableOpacity>
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
                  <Text style={styles.buttonText}>Next: Assessment →</Text>
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

        {/* Step 2: Personality Test */}
        <View style={[styles.section, !basicInfoComplete && styles.sectionLocked]}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionIcon}>
              {personalityComplete ? '✅' : (basicInfoComplete ? '⏳' : '🔒')}
            </Text>
            <Text style={styles.sectionTitle}>Personality Test</Text>
            {!basicInfoComplete && <Text style={styles.lockedBadge}>Locked</Text>}
          </View>

          {personalityComplete ? (
            <View style={styles.completedInfo}>
              <Text style={styles.completedText}>✓ Completed</Text>
              <Text style={styles.completedSubtext}>
                Big Five scores recorded
              </Text>
              {personalityScores && Object.keys(personalityScores).length > 0 && (
                <TouchableOpacity 
                  style={styles.viewScoresButton}
                  onPress={() => {
                    const scores = Object.entries(personalityScores)
                      .map(([key, val]) => `${key}: ${val}`)
                      .join('\n');
                    Alert.alert('Personality Scores', scores);
                  }}
                >
                  <Text style={styles.viewScoresText}>View Scores</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : (
            <>
              <Text style={styles.sectionDescription}>
                15-minute Big Five personality assessment
              </Text>
              <TouchableOpacity 
                style={[styles.button, styles.buttonPrimary, !basicInfoComplete && styles.buttonDisabled]}
                onPress={handleStartPersonalityTest}
                disabled={!basicInfoComplete}
              >
                <Text style={styles.buttonText}>Start Personality Test →</Text>
              </TouchableOpacity>
            </>
          )}
        </View>

        {/* Step 3: IAF Calibration */}
        <View style={[styles.section, !personalityComplete && styles.sectionLocked]}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionIcon}>
              {iafComplete ? '✅' : (personalityComplete ? '⏳' : '🔒')}
            </Text>
            <Text style={styles.sectionTitle}>IAF Calibration</Text>
            {!personalityComplete && <Text style={styles.lockedBadge}>Locked</Text>}
          </View>

          {iafComplete ? (
            <View style={styles.completedInfo}>
              <Text style={styles.completedText}>IAF: {iafData?.iaf || 'N/A'} Hz</Text>
            </View>
          ) : (
            <>
              <Text style={styles.sectionDescription}>
                2-minute brainwave calibration
              </Text>
              <TouchableOpacity 
                style={[styles.button, styles.buttonPrimary, !personalityComplete && styles.buttonDisabled]}
                onPress={handleStartIAFCalibration}
                disabled={!personalityComplete}
              >
                <Text style={styles.buttonText}>Start IAF Calibration →</Text>
              </TouchableOpacity>
            </>
          )}
        </View>

        {/* Assessment Complete - Proceed to Data Collection */}
        {basicInfoComplete && personalityComplete && iafComplete && (
          <View style={styles.completeCard}>
            <Text style={styles.completeIcon}>🎉</Text>
            <Text style={styles.completeTitle}>Assessment Complete!</Text>
            <Text style={styles.completeText}>
              Subject {subjectId} is ready for data collection
            </Text>
            <TouchableOpacity 
              style={[styles.button, styles.buttonSuccess]}
              onPress={handleProceedToDataCollection}
            >
              <Text style={styles.buttonText}>Proceed to Data Collection →</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Note */}
        <View style={styles.noteBox}>
          <Text style={styles.noteText}>
            Note: Complete assessments in order. All data is stored temporarily during this session.
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
  progressContainer: {
    marginBottom: 30,
  },
  progressBar: {
    height: 8,
    backgroundColor: '#e0e0e0',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#4CAF50',
  },
  progressText: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
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
  sectionLocked: {
    opacity: 0.6,
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
  lockedBadge: {
    fontSize: 12,
    color: '#999',
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  sectionDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 15,
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
  buttonDisabled: {
    backgroundColor: '#ccc',
    opacity: 0.6,
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
  completedSubtext: {
    fontSize: 12,
    color: '#666',
  },
  viewScoresButton: {
    marginTop: 10,
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: '#E3F2FD',
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  viewScoresText: {
    fontSize: 12,
    color: '#2196F3',
    fontWeight: '600',
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