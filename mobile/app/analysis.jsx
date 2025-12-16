// Updated AnalysisScreen.jsx with fixed save & export

import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Alert, TextInput, Switch } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useBleContext } from '../context/BleContext';
import { useUserProfile } from '../context/UserProfileContext';
import { useEEGData } from '../context/EEGDataContext';
import EEGProcessor from '../utils/EEGProcessor';

export default function AnalysisScreen() {
  const { device, rawEEGBuffer, metrics } = useBleContext();
  const { userProfile } = useUserProfile();
  const { 
    sessions, 
    saveSession, 
    exportSession,
    exportAllSessions,
    deleteSession 
  } = useEEGData();

  const [isRecording, setIsRecording] = useState(false);
  const [recordedData, setRecordedData] = useState([]); // Array of { bandPowers, psd, metrics, timestamp }
  const [recordingStartTime, setRecordingStartTime] = useState(null);
  const [hasMusic, setHasMusic] = useState(false);
  const [musicLink, setMusicLink] = useState('');
  const [showSessions, setShowSessions] = useState(false);

  const eegProcessor = useRef(new EEGProcessor(512, 512)).current;
  const recordingInterval = useRef(null);

  // Check profile completion
  const isProfileComplete = () => {
    return userProfile.profileComplete && 
           userProfile.name && 
           userProfile.age && 
           userProfile.iafCalibration?.iaf;
  };

  // Start recording - capture data every second
  const handleStartRecording = () => {
    if (!isProfileComplete()) {
      Alert.alert(
        'Profile Incomplete',
        'Please complete your profile (name, age, personality test, and IAF calibration) before recording sessions.',
        [{ text: 'OK' }]
      );
      return;
    }

    if (rawEEGBuffer.length < 512) {
      Alert.alert('Insufficient Data', 'Need at least 512 samples to start recording. Please wait for more data.');
      return;
    }

    const startTime = Date.now();
    setIsRecording(true);
    setRecordedData([]);
    setRecordingStartTime(startTime);

    // Capture data every 1 second (1000ms)
    recordingInterval.current = setInterval(() => {
      captureDataPoint();
    }, 1000);

    Alert.alert('Recording Started', 'EEG data is being recorded. Press Stop when finished.');
  };

  // Capture a single data point
  const captureDataPoint = () => {
    if (rawEEGBuffer.length < 512) {
      console.log('Insufficient buffer for data point');
      return;
    }

    try {
      // Calculate PSD
      const psd = eegProcessor.computePSD(rawEEGBuffer);
      
      // Extract 8 band powers
      const bandPowers = {
        Delta: psd.bandPowers.Delta.power,
        Theta: psd.bandPowers.Theta.power,
        AlphaLow: psd.bandPowers.AlphaLow.power,
        AlphaHigh: psd.bandPowers.AlphaHigh.power,
        BetaLow: psd.bandPowers.BetaLow.power,
        BetaHigh: psd.bandPowers.BetaHigh.power,
        GammaLow: psd.bandPowers.GammaLow.power,
        GammaHigh: psd.bandPowers.GammaHigh.power,
      };

      // Extract PSD for 6-14 Hz (9 frequency points)
      const psdPoints = {};
      for (let freq = 6; freq <= 14; freq++) {
        const idx = psd.frequencies.findIndex(f => Math.abs(f - freq) < 0.5);
        if (idx !== -1) {
          psdPoints[`psd_${freq}hz`] = psd.psd[idx];
        }
      }

      // Capture metrics (Signal Quality, Attention, Meditation)
      const metricsSnapshot = {
        signalQuality: metrics.poorSignal, // 0-200 (lower is better)
        attention: metrics.attention, // 0-100
        meditation: metrics.meditation // 0-100
      };

      // Add data point to recorded data
      setRecordedData(prev => [...prev, {
        timestamp: Date.now(),
        bandPowers,
        psdPoints,
        metrics: metricsSnapshot
      }]);

    } catch (error) {
      console.error('Error capturing data point:', error);
    }
  };

  // Stop recording and save
  const handleStopRecording = () => {
    if (!isRecording) return;

    // Clear interval
    if (recordingInterval.current) {
      clearInterval(recordingInterval.current);
      recordingInterval.current = null;
    }

    setIsRecording(false);

    if (recordedData.length === 0) {
      Alert.alert('No Data', 'No data was recorded. Please try again.');
      return;
    }

    const duration = ((Date.now() - recordingStartTime) / 1000).toFixed(1);

    Alert.alert(
      'Recording Stopped',
      `Recorded ${recordedData.length} data points over ${duration} seconds.\n\nReady to save session?`,
      [
        { text: 'Cancel', style: 'cancel', onPress: () => {
          setRecordedData([]);
          setRecordingStartTime(null);
        }},
        { text: 'Save & Export', onPress: handleSaveAndExport }
      ]
    );
  };

  // Save and export session
  const handleSaveAndExport = async () => {
    if (recordedData.length === 0) {
      Alert.alert('No Data', 'No recorded data to save.');
      return;
    }

    try {
      // Prepare music condition
      const musicCondition = hasMusic ? 'music' : 'no_music';
      const musicLinkValue = hasMusic ? musicLink : null;

      // Save session with recorded data and recording start time
      const savedSession = await saveSession(
        userProfile,
        recordedData,
        musicCondition,
        musicLinkValue,
        recordingStartTime // Pass the recording start time
      );

      // Export immediately using the returned session object
      await exportSession(savedSession);

      Alert.alert(
        'Success!',
        `Session saved and exported!\n\n${recordedData.length} data points recorded.`,
        [{ text: 'OK' }]
      );

      // Reset state
      setRecordedData([]);
      setRecordingStartTime(null);
      setHasMusic(false);
      setMusicLink('');

    } catch (error) {
      console.error('Error saving session:', error);
      Alert.alert('Error', 'Failed to save session: ' + error.message);
    }
  };

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (recordingInterval.current) {
        clearInterval(recordingInterval.current);
      }
    };
  }, []);

  const handleDeleteSession = (sessionId) => {
    Alert.alert(
      'Delete Session',
      'Are you sure you want to delete this session? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive',
          onPress: () => {
            deleteSession(sessionId);
            Alert.alert('Deleted', 'Session deleted successfully.');
          }
        }
      ]
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>EEG Recording & Export</Text>
        <Text style={styles.headerSubtitle}>
          {device ? `${sessions.length} sessions saved` : 'Connect device to record'}
        </Text>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {!device ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>🔬</Text>
            <Text style={styles.emptyTitle}>No Device Connected</Text>
            <Text style={styles.emptyText}>
              Connect your EEG device in the Monitor tab to start recording data
            </Text>
          </View>
        ) : (
          <>
            {/* Recording Section */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Recording Session</Text>
              
              <View style={styles.infoCard}>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Buffer Size:</Text>
                  <Text style={styles.infoValue}>{rawEEGBuffer.length} samples</Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Signal Quality:</Text>
                  <Text style={[
                    styles.infoValue,
                    { color: metrics.poorSignal < 50 ? '#4CAF50' : '#F44336' }
                  ]}>
                    {metrics.poorSignal < 50 ? 'Good' : metrics.poorSignal < 100 ? 'Fair' : 'Poor'} ({metrics.poorSignal})
                  </Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Attention:</Text>
                  <Text style={styles.infoValue}>{metrics.attention}</Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Meditation:</Text>
                  <Text style={styles.infoValue}>{metrics.meditation}</Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Ready to Record:</Text>
                  <Text style={[
                    styles.infoValue,
                    { color: rawEEGBuffer.length >= 512 ? '#4CAF50' : '#F44336' }
                  ]}>
                    {rawEEGBuffer.length >= 512 ? 'Yes' : 'No (need 512+)'}
                  </Text>
                </View>
                {isRecording && (
                  <>
                    <View style={styles.infoRow}>
                      <Text style={styles.infoLabel}>Recording:</Text>
                      <Text style={[styles.infoValue, { color: '#F44336' }]}>
                        🔴 Active
                      </Text>
                    </View>
                    <View style={styles.infoRow}>
                      <Text style={styles.infoLabel}>Data Points:</Text>
                      <Text style={styles.infoValue}>{recordedData.length}</Text>
                    </View>
                    <View style={styles.infoRow}>
                      <Text style={styles.infoLabel}>Duration:</Text>
                      <Text style={styles.infoValue}>
                        {recordingStartTime ? ((Date.now() - recordingStartTime) / 1000).toFixed(1) : '0.0'}s
                      </Text>
                    </View>
                  </>
                )}
              </View>

              {!isRecording ? (
                <TouchableOpacity
                  style={[styles.button, styles.startButton]}
                  onPress={handleStartRecording}
                  disabled={rawEEGBuffer.length < 512}
                >
                  <Ionicons name="play-circle" size={24} color="#fff" />
                  <Text style={styles.buttonText}>Start Recording</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={[styles.button, styles.stopButton]}
                  onPress={handleStopRecording}
                >
                  <Ionicons name="stop-circle" size={24} color="#fff" />
                  <Text style={styles.buttonText}>Stop Recording</Text>
                </TouchableOpacity>
              )}

              {recordedData.length > 0 && !isRecording && (
                <View style={styles.resultsCard}>
                  <Text style={styles.resultsTitle}>📊 Recorded Data Ready</Text>
                  <Text style={styles.resultsText}>
                    {recordedData.length} data points captured
                  </Text>
                  <Text style={styles.resultsSubtext}>
                    8 band powers + 9 PSD values + Signal/Attention/Meditation per point
                  </Text>
                </View>
              )}
            </View>

            {/* Music Condition Section */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Music Condition</Text>
              
              <View style={styles.musicCard}>
                <View style={styles.switchRow}>
                  <Text style={styles.switchLabel}>Was music playing during recording?</Text>
                  <Switch
                    value={hasMusic}
                    onValueChange={setHasMusic}
                    trackColor={{ false: '#ccc', true: '#4CAF50' }}
                    thumbColor={hasMusic ? '#fff' : '#f4f3f4'}
                    disabled={isRecording}
                  />
                </View>

                {hasMusic && (
                  <View style={styles.musicLinkContainer}>
                    <Text style={styles.inputLabel}>Music Link (optional):</Text>
                    <TextInput
                      style={styles.textInput}
                      placeholder="https://spotify.com/..."
                      value={musicLink}
                      onChangeText={setMusicLink}
                      autoCapitalize="none"
                      keyboardType="url"
                      editable={!isRecording}
                    />
                    <Text style={styles.inputHint}>
                      Paste a link to the music that was playing
                    </Text>
                  </View>
                )}
              </View>
            </View>

            {/* Saved Sessions Section */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Saved Sessions ({sessions.length})</Text>
                <TouchableOpacity onPress={() => setShowSessions(!showSessions)}>
                  <Ionicons 
                    name={showSessions ? "chevron-up" : "chevron-down"} 
                    size={24} 
                    color="#666" 
                  />
                </TouchableOpacity>
              </View>

              {sessions.length > 0 && (
                <TouchableOpacity
                  style={[styles.button, styles.exportAllButton]}
                  onPress={exportAllSessions}
                >
                  <Ionicons name="download" size={20} color="#fff" />
                  <Text style={styles.buttonText}>Export All Sessions</Text>
                </TouchableOpacity>
              )}

              {showSessions && sessions.length > 0 && (
                <View style={styles.sessionsList}>
                  {sessions.map((session) => (
                    <View key={session.id} style={styles.sessionCard}>
                      <View style={styles.sessionHeader}>
                        <Text style={styles.sessionTitle}>
                          {session.userProfile.name} - {new Date(session.timestamp).toLocaleDateString()}
                        </Text>
                        <View style={styles.sessionActions}>
                          <TouchableOpacity
                            style={styles.iconButton}
                            onPress={() => exportSession(session.id)}
                          >
                            <Ionicons name="download-outline" size={20} color="#2196F3" />
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={styles.iconButton}
                            onPress={() => handleDeleteSession(session.id)}
                          >
                            <Ionicons name="trash-outline" size={20} color="#F44336" />
                          </TouchableOpacity>
                        </View>
                      </View>
                      
                      <View style={styles.sessionDetails}>
                        <Text style={styles.sessionDetailText}>
                          Age: {session.userProfile.age} | IAF: {session.userProfile.iaf?.toFixed(2)} Hz
                        </Text>
                        <Text style={styles.sessionDetailText}>
                          Data Points: {session.dataPoints?.length || 0}
                        </Text>
                        <Text style={styles.sessionDetailText}>
                          Music: {session.musicCondition === 'music' ? '🎵 Yes' : '🔇 No'}
                        </Text>
                        <Text style={styles.sessionDetailText}>
                          Time: {new Date(session.timestamp).toLocaleTimeString()}
                        </Text>
                      </View>
                    </View>
                  ))}
                </View>
              )}

              {sessions.length === 0 && (
                <View style={styles.noSessionsCard}>
                  <Text style={styles.noSessionsText}>
                    No sessions saved yet. Start recording your first session above!
                  </Text>
                </View>
              )}
            </View>
          </>
        )}

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
    backgroundColor: '#fff',
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 5,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#666',
  },
  content: {
    flex: 1,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
    minHeight: 400,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
  },
  emptyText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
  },
  section: {
    padding: 15,
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
  infoCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 15,
    marginBottom: 15,
    elevation: 1,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  infoLabel: {
    fontSize: 14,
    color: '#666',
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    padding: 15,
    borderRadius: 10,
    marginBottom: 10,
  },
  startButton: {
    backgroundColor: '#4CAF50',
  },
  stopButton: {
    backgroundColor: '#F44336',
  },
  exportAllButton: {
    backgroundColor: '#FF9800',
    marginBottom: 15,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  resultsCard: {
    backgroundColor: '#E3F2FD',
    borderRadius: 12,
    padding: 20,
    marginTop: 10,
    borderLeftWidth: 4,
    borderLeftColor: '#2196F3',
  },
  resultsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1565C0',
    marginBottom: 8,
  },
  resultsText: {
    fontSize: 14,
    color: '#1976D2',
    fontWeight: '600',
    marginBottom: 5,
  },
  resultsSubtext: {
    fontSize: 12,
    color: '#42A5F5',
  },
  musicCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    marginBottom: 15,
    elevation: 1,
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  switchLabel: {
    fontSize: 15,
    color: '#333',
    flex: 1,
    marginRight: 15,
  },
  musicLinkContainer: {
    marginTop: 10,
  },
  inputLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
    fontWeight: '600',
  },
  textInput: {
    backgroundColor: '#f9f9f9',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: '#333',
  },
  inputHint: {
    fontSize: 12,
    color: '#999',
    marginTop: 5,
    fontStyle: 'italic',
  },
  sessionsList: {
    gap: 10,
  },
  sessionCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 15,
    elevation: 1,
  },
  sessionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  sessionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
    flex: 1,
  },
  sessionActions: {
    flexDirection: 'row',
    gap: 10,
  },
  iconButton: {
    padding: 5,
  },
  sessionDetails: {
    gap: 5,
  },
  sessionDetailText: {
    fontSize: 13,
    color: '#666',
  },
  noSessionsCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 30,
    alignItems: 'center',
  },
  noSessionsText: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    lineHeight: 20,
  },
  bottomPadding: {
    height: 100,
  },
});