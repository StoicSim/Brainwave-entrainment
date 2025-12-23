// Updated AnalysisScreen.jsx with Combined Recording Mode

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
  const [currentPhase, setCurrentPhase] = useState('no_music'); // 'no_music' or 'music'
  const [noMusicData, setNoMusicData] = useState([]); // Data from first recording
  const [musicData, setMusicData] = useState([]); // Data from second recording
  const [recordingStartTime, setRecordingStartTime] = useState(null);
  const [musicLink, setMusicLink] = useState('');
  const [showSessions, setShowSessions] = useState(false);
  const [showMusicLinkInput, setShowMusicLinkInput] = useState(false);

  const eegProcessor = useRef(new EEGProcessor(512, 512)).current;
  const recordingInterval = useRef(null);

  // Check profile completion
  const isProfileComplete = () => {
    return userProfile.profileComplete && 
           userProfile.name && 
           userProfile.age && 
           userProfile.iafCalibration?.iaf;
  };

  // Start recording
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
    setRecordingStartTime(startTime);

    // Capture data every 1 second
    recordingInterval.current = setInterval(() => {
      captureDataPoint();
    }, 1000);

    Alert.alert(
      'Recording Started', 
      currentPhase === 'no_music' 
        ? 'Recording WITHOUT music. Press Stop when finished.'
        : 'Recording WITH music. Press Stop when finished.'
    );
  };

  // Capture a single data point
  const captureDataPoint = () => {
    if (rawEEGBuffer.length < 512) {
      console.log('Insufficient buffer for data point');
      return;
    }

    try {
      const psd = eegProcessor.computePSD(rawEEGBuffer);
      
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

      const psdPoints = {};
      for (let freq = 6; freq <= 14; freq++) {
        const idx = psd.frequencies.findIndex(f => Math.abs(f - freq) < 0.5);
        if (idx !== -1) {
          psdPoints[`psd_${freq}hz`] = psd.psd[idx];
        }
      }

      const metricsSnapshot = {
        signalQuality: metrics.poorSignal,
        attention: metrics.attention,
        meditation: metrics.meditation
      };

      const dataPoint = {
        timestamp: new Date().toISOString(), // Absolute ISO timestamp
        sessionType: currentPhase,
        musicLink: currentPhase === 'music' ? musicLink : '',
        bandPowers,
        psdPoints,
        metrics: metricsSnapshot
      };

      // Store in appropriate array based on current phase
      if (currentPhase === 'no_music') {
        setNoMusicData(prev => [...prev, dataPoint]);
      } else {
        setMusicData(prev => [...prev, dataPoint]);
      }

    } catch (error) {
      console.error('Error capturing data point:', error);
    }
  };

  // Stop recording
  const handleStopRecording = () => {
    if (!isRecording) return;

    if (recordingInterval.current) {
      clearInterval(recordingInterval.current);
      recordingInterval.current = null;
    }

    setIsRecording(false);

    const currentData = currentPhase === 'no_music' ? noMusicData : musicData;
    
    if (currentData.length === 0) {
      Alert.alert('No Data', 'No data was recorded. Please try again.');
      return;
    }

    const duration = ((Date.now() - recordingStartTime) / 1000).toFixed(1);

    // Show different options based on current phase
    if (currentPhase === 'no_music') {
      Alert.alert(
        'Recording Stopped',
        `Recorded ${noMusicData.length} data points (${duration}s) WITHOUT music.\n\nWhat would you like to do?`,
        [
          { 
            text: 'Discard', 
            style: 'cancel', 
            onPress: () => {
              setNoMusicData([]);
              setRecordingStartTime(null);
            }
          },
          { 
            text: 'Save & Finish', 
            onPress: handleSaveSession
          },
          { 
            text: 'Continue with Music', 
            onPress: handleContinueWithMusic
          }
        ]
      );
    } else {
      // Music phase completed
      Alert.alert(
        'Recording Stopped',
        `Recorded ${musicData.length} data points (${duration}s) WITH music.\n\nReady to save combined session?`,
        [
          { 
            text: 'Cancel', 
            style: 'cancel',
            onPress: () => {
              setMusicData([]);
            }
          },
          { 
            text: 'Save & Export', 
            onPress: handleSaveSession
          }
        ]
      );
    }
  };

  // Continue with music recording
  const handleContinueWithMusic = () => {
    setShowMusicLinkInput(true);
  };

  // Start music recording after link is entered
  const handleStartMusicRecording = () => {
    if (!musicLink.trim()) {
      Alert.alert('Music Link Required', 'Please enter a music link before continuing.');
      return;
    }

    setCurrentPhase('music');
    setShowMusicLinkInput(false);
    
    Alert.alert(
      'Ready to Record WITH Music',
      'Press "Start Recording" to begin recording with music playing.',
      [{ text: 'OK' }]
    );
  };

  // Save session (handles both single and combined)
  const handleSaveSession = async () => {
    const allData = [...noMusicData, ...musicData];
    
    if (allData.length === 0) {
      Alert.alert('No Data', 'No recorded data to save.');
      return;
    }

    try {
      // Save session
      const savedSession = await saveSession(
        userProfile,
        allData, // Combined data from both phases
        recordingStartTime
      );

      // Export immediately
      await exportSession(savedSession);

      const totalPoints = allData.length;
      const noMusicCount = noMusicData.length;
      const musicCount = musicData.length;

      Alert.alert(
        'Success!',
        `Session saved and exported!\n\nTotal: ${totalPoints} data points\n` +
        `Without music: ${noMusicCount}\n` +
        `With music: ${musicCount}`,
        [{ text: 'OK' }]
      );

      // Reset all state
      setNoMusicData([]);
      setMusicData([]);
      setRecordingStartTime(null);
      setMusicLink('');
      setCurrentPhase('no_music');
      setShowMusicLinkInput(false);

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

  const totalRecordedPoints = noMusicData.length + musicData.length;

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
                  <Text style={styles.infoLabel}>Current Phase:</Text>
                  <Text style={styles.infoValue}>
                    {currentPhase === 'no_music' ? '🔇 No Music' : '🎵 With Music'}
                  </Text>
                </View>
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
                {isRecording && (
                  <>
                    <View style={styles.infoRow}>
                      <Text style={styles.infoLabel}>Recording:</Text>
                      <Text style={[styles.infoValue, { color: '#F44336' }]}>
                        🔴 Active
                      </Text>
                    </View>
                    <View style={styles.infoRow}>
                      <Text style={styles.infoLabel}>Current Points:</Text>
                      <Text style={styles.infoValue}>
                        {currentPhase === 'no_music' ? noMusicData.length : musicData.length}
                      </Text>
                    </View>
                    <View style={styles.infoRow}>
                      <Text style={styles.infoLabel}>Duration:</Text>
                      <Text style={styles.infoValue}>
                        {recordingStartTime ? ((Date.now() - recordingStartTime) / 1000).toFixed(1) : '0.0'}s
                      </Text>
                    </View>
                  </>
                )}
                {totalRecordedPoints > 0 && !isRecording && (
                  <>
                    <View style={styles.infoRow}>
                      <Text style={styles.infoLabel}>No Music Data:</Text>
                      <Text style={styles.infoValue}>{noMusicData.length} points</Text>
                    </View>
                    <View style={styles.infoRow}>
                      <Text style={styles.infoLabel}>Music Data:</Text>
                      <Text style={styles.infoValue}>{musicData.length} points</Text>
                    </View>
                  </>
                )}
              </View>

              {!isRecording ? (
                <TouchableOpacity
                  style={[styles.button, styles.startButton]}
                  onPress={handleStartRecording}
                  disabled={rawEEGBuffer.length < 512 || showMusicLinkInput}
                >
                  <Ionicons name="play-circle" size={24} color="#fff" />
                  <Text style={styles.buttonText}>
                    Start Recording {currentPhase === 'music' ? '(With Music)' : ''}
                  </Text>
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

              {totalRecordedPoints > 0 && !isRecording && !showMusicLinkInput && (
                <View style={styles.resultsCard}>
                  <Text style={styles.resultsTitle}>📊 Recorded Data Ready</Text>
                  <Text style={styles.resultsText}>
                    Total: {totalRecordedPoints} data points
                  </Text>
                  <Text style={styles.resultsSubtext}>
                    No Music: {noMusicData.length} | Music: {musicData.length}
                  </Text>
                </View>
              )}
            </View>

            {/* Music Link Input Section */}
            {showMusicLinkInput && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Enter Music Information</Text>
                
                <View style={styles.musicCard}>
                  <Text style={styles.inputLabel}>Music Link:</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="https://spotify.com/track/..."
                    value={musicLink}
                    onChangeText={setMusicLink}
                    autoCapitalize="none"
                    keyboardType="url"
                    autoFocus
                  />
                  <Text style={styles.inputHint}>
                    Enter the link to the music you'll be playing
                  </Text>

                  <View style={styles.buttonRow}>
                    <TouchableOpacity
                      style={[styles.button, styles.cancelButton]}
                      onPress={() => {
                        setShowMusicLinkInput(false);
                        setMusicLink('');
                      }}
                    >
                      <Text style={styles.buttonText}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.button, styles.continueButton]}
                      onPress={handleStartMusicRecording}
                    >
                      <Text style={styles.buttonText}>Continue</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            )}

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
                  {sessions.map((session) => {
                    const noMusicCount = session.dataPoints?.filter(d => d.sessionType === 'no_music').length || 0;
                    const musicCount = session.dataPoints?.filter(d => d.sessionType === 'music').length || 0;
                    
                    return (
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
                            Total Points: {session.dataPoints?.length || 0} 
                            {musicCount > 0 && ` (🔇 ${noMusicCount} | 🎵 ${musicCount})`}
                          </Text>
                          <Text style={styles.sessionDetailText}>
                            Type: {musicCount > 0 ? 'Combined Session' : 'Single Session'}
                          </Text>
                          <Text style={styles.sessionDetailText}>
                            Time: {new Date(session.timestamp).toLocaleTimeString()}
                          </Text>
                        </View>
                      </View>
                    );
                  })}
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
  continueButton: {
    backgroundColor: '#2196F3',
    flex: 1,
  },
  cancelButton: {
    backgroundColor: '#9E9E9E',
    flex: 1,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 15,
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