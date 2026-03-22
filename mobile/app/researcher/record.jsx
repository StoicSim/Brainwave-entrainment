import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView,
  StyleSheet, Alert, TextInput, Modal
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useBleContext } from '../../context/BleContext';
import { useEEGData } from '../../context/EEGDataContext';
import EEGProcessor from '../../utils/EEGProcessor';
import {
  getSessions,
  saveSession as saveSessionToAuth,
  deleteSession as deleteSessionFromAuth
} from '../../utils/ResearcherAuth';

export default function AnalysisScreen() {
  const { device, rawEEGBuffer, metrics } = useBleContext();
  const { exportSession } = useEEGData();

  const [sessions, setSessions] = useState([]);

  // Subject info — who the researcher is recording data FOR
  const [subjectName, setSubjectName] = useState('');
  const [subjectAge, setSubjectAge] = useState('');
  const [subjectGender, setSubjectGender] = useState('');
  const [showSubjectModal, setShowSubjectModal] = useState(false);

  const [isRecording, setIsRecording] = useState(false);
  const [currentPhase, setCurrentPhase] = useState('no_music');
  const [noMusicData, setNoMusicData] = useState([]);
  const [musicData, setMusicData] = useState([]);
  const [recordingStartTime, setRecordingStartTime] = useState(null);
  const [musicLink, setMusicLink] = useState('');
  const [showSessions, setShowSessions] = useState(false);
  const [showMusicLinkInput, setShowMusicLinkInput] = useState(false);

  const eegProcessor = useRef(new EEGProcessor(512, 512)).current;
  const recordingInterval = useRef(null);

  useEffect(() => { loadSessions(); }, []);

  const loadSessions = async () => {
    const loaded = await getSessions();
    setSessions(loaded);
  };

  const isSubjectInfoComplete = () =>
    subjectName.trim() && subjectAge.trim() && subjectGender.trim();

  const handleStartRecording = () => {
    if (!isSubjectInfoComplete()) {
      setShowSubjectModal(true);
      return;
    }
    if (rawEEGBuffer.length < 512) {
      Alert.alert('Insufficient Data', 'Need at least 512 samples. Please wait.');
      return;
    }
    const startTime = Date.now();
    setIsRecording(true);
    setRecordingStartTime(startTime);
    recordingInterval.current = setInterval(() => { captureDataPoint(); }, 1000);
    Alert.alert(
      'Recording Started',
      currentPhase === 'no_music'
        ? `Recording ${subjectName} WITHOUT music. Press Stop when finished.`
        : `Recording ${subjectName} WITH music. Press Stop when finished.`
    );
  };

  const captureDataPoint = () => {
    if (rawEEGBuffer.length < 512) return;
    try {
      const psd = eegProcessor.computePSD(rawEEGBuffer);
      const bandPowers = {
        Delta:     psd.bandPowers.Delta.power,
        Theta:     psd.bandPowers.Theta.power,
        AlphaLow:  psd.bandPowers.AlphaLow.power,
        AlphaHigh: psd.bandPowers.AlphaHigh.power,
        BetaLow:   psd.bandPowers.BetaLow.power,
        BetaHigh:  psd.bandPowers.BetaHigh.power,
        GammaLow:  psd.bandPowers.GammaLow.power,
        GammaHigh: psd.bandPowers.GammaHigh.power,
      };
      const psdPoints = {};
      for (let freq = 6; freq <= 14; freq++) {
        const idx = psd.frequencies.findIndex(f => Math.abs(f - freq) < 0.5);
        if (idx !== -1) psdPoints[`psd_${freq}hz`] = psd.psd[idx];
      }
      const dataPoint = {
        timestamp: new Date().toISOString(),
        sessionType: currentPhase,
        musicLink: currentPhase === 'music' ? musicLink : '',
        bandPowers,
        psdPoints,
        metrics: {
          signalQuality: metrics.poorSignal,
          attention: metrics.attention,
          meditation: metrics.meditation,
        },
      };
      if (currentPhase === 'no_music') {
        setNoMusicData(prev => [...prev, dataPoint]);
      } else {
        setMusicData(prev => [...prev, dataPoint]);
      }
    } catch (error) {
      console.warn('Error capturing data point:', error);
    }
  };

  const handleStopRecording = () => {
    if (!isRecording) return;
    if (recordingInterval.current) {
      clearInterval(recordingInterval.current);
      recordingInterval.current = null;
    }
    setIsRecording(false);
    const duration = ((Date.now() - recordingStartTime) / 1000).toFixed(1);
    if (currentPhase === 'no_music') {
      Alert.alert(
        'Recording Stopped',
        `Recorded ${noMusicData.length} points (${duration}s) WITHOUT music.\n\nWhat would you like to do?`,
        [
          { text: 'Discard', style: 'cancel', onPress: () => { setNoMusicData([]); setRecordingStartTime(null); } },
          { text: 'Save and Finish', onPress: handleSaveSession },
          { text: 'Continue with Music', onPress: () => setShowMusicLinkInput(true) },
        ]
      );
    } else {
      Alert.alert(
        'Recording Stopped',
        `Recorded ${musicData.length} points (${duration}s) WITH music.\n\nReady to save?`,
        [
          { text: 'Cancel', style: 'cancel', onPress: () => setMusicData([]) },
          { text: 'Save and Export', onPress: handleSaveSession },
        ]
      );
    }
  };

  const handleStartMusicRecording = () => {
    if (!musicLink.trim()) {
      Alert.alert('Music Link Required', 'Please enter a music link.');
      return;
    }
    setCurrentPhase('music');
    setShowMusicLinkInput(false);
    Alert.alert('Ready to Record WITH Music', 'Press Start Recording to begin.', [{ text: 'OK' }]);
  };

  const handleSaveSession = async () => {
    const allData = [...noMusicData, ...musicData];
    if (allData.length === 0) {
      Alert.alert('No Data', 'No recorded data to save.');
      return;
    }
    try {
      const newSession = {
        id: `session_${Date.now()}`,
        timestamp: new Date().toISOString(),
        recordingStartTime,
        userProfile: {
          name: subjectName.trim(),
          age: subjectAge.trim(),
          gender: subjectGender.trim(),
          iaf: null,
          personality: {},
        },
        dataPoints: allData,
      };

      await saveSessionToAuth(newSession);
      await exportSession(newSession);
      await loadSessions();

      Alert.alert(
        'Success!',
        `Session for ${subjectName} saved!\n\nTotal: ${allData.length} points\nWithout music: ${noMusicData.length}\nWith music: ${musicData.length}`,
        [{ text: 'OK' }]
      );

      setNoMusicData([]);
      setMusicData([]);
      setRecordingStartTime(null);
      setMusicLink('');
      setCurrentPhase('no_music');
      setShowMusicLinkInput(false);
      // Keep subject info for consecutive recordings of same subject

    } catch (error) {
      console.warn('Error saving session:', error);
      Alert.alert('Error', 'Failed to save: ' + error.message);
    }
  };

  const handleDeleteSession = (sessionId) => {
    Alert.alert('Delete Session', 'This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete', style: 'destructive',
          onPress: async () => {
            await deleteSessionFromAuth(sessionId);
            await loadSessions();
          }
        }
      ]
    );
  };

  const handleExportAll = async () => {
    for (const session of sessions) {
      await exportSession(session);
    }
  };

  useEffect(() => {
    return () => { if (recordingInterval.current) clearInterval(recordingInterval.current); };
  }, []);

  const totalRecordedPoints = noMusicData.length + musicData.length;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>EEG Recording and Export</Text>
        <Text style={styles.headerSubtitle}>
          {device ? `${sessions.length} sessions saved` : 'Connect device to record'}
        </Text>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {!device ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>🔬</Text>
            <Text style={styles.emptyTitle}>No Device Connected</Text>
            <Text style={styles.emptyText}>Connect your EEG device in the Monitor tab</Text>
          </View>
        ) : (
          <>
            {/* Subject Info */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Subject Information</Text>
              <View style={styles.subjectCard}>
                {isSubjectInfoComplete() ? (
                  <View style={styles.subjectFilled}>
                    <View style={styles.subjectInfo}>
                      <Text style={styles.subjectName}>{subjectName}</Text>
                      <Text style={styles.subjectDetails}>
                        {`Age: ${subjectAge}   Gender: ${subjectGender}`}
                      </Text>
                    </View>
                    <TouchableOpacity
                      style={styles.editSubjectButton}
                      onPress={() => setShowSubjectModal(true)}
                      disabled={isRecording}
                    >
                      <Ionicons name="pencil-outline" size={18} color="#2196F3" />
                      <Text style={styles.editSubjectText}>Edit</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity style={styles.addSubjectButton} onPress={() => setShowSubjectModal(true)}>
                    <Ionicons name="person-add-outline" size={22} color="#2196F3" />
                    <Text style={styles.addSubjectText}>Enter Subject Info to Start Recording</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>

            {/* Recording */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Recording Session</Text>
              <View style={styles.infoCard}>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Current Phase:</Text>
                  <Text style={styles.infoValue}>{currentPhase === 'no_music' ? '🔇 No Music' : '🎵 With Music'}</Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Buffer Size:</Text>
                  <Text style={styles.infoValue}>{`${rawEEGBuffer.length} samples`}</Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Signal Quality:</Text>
                  <Text style={[styles.infoValue, { color: metrics.poorSignal < 50 ? '#4CAF50' : '#F44336' }]}>
                    {`${metrics.poorSignal < 50 ? 'Good' : metrics.poorSignal < 100 ? 'Fair' : 'Poor'} (${metrics.poorSignal})`}
                  </Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Attention:</Text>
                  <Text style={styles.infoValue}>{`${metrics.attention}`}</Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Meditation:</Text>
                  <Text style={styles.infoValue}>{`${metrics.meditation}`}</Text>
                </View>
                {isRecording && (
                  <>
                    <View style={styles.infoRow}>
                      <Text style={styles.infoLabel}>Recording:</Text>
                      <Text style={[styles.infoValue, { color: '#F44336' }]}>🔴 Active</Text>
                    </View>
                    <View style={styles.infoRow}>
                      <Text style={styles.infoLabel}>Points:</Text>
                      <Text style={styles.infoValue}>
                        {currentPhase === 'no_music' ? noMusicData.length : musicData.length}
                      </Text>
                    </View>
                  </>
                )}
                {totalRecordedPoints > 0 && !isRecording && (
                  <>
                    <View style={styles.infoRow}>
                      <Text style={styles.infoLabel}>No Music Data:</Text>
                      <Text style={styles.infoValue}>{`${noMusicData.length} points`}</Text>
                    </View>
                    <View style={styles.infoRow}>
                      <Text style={styles.infoLabel}>Music Data:</Text>
                      <Text style={styles.infoValue}>{`${musicData.length} points`}</Text>
                    </View>
                  </>
                )}
              </View>

              {!isRecording ? (
                <TouchableOpacity
                  style={[styles.button, styles.startButton, !isSubjectInfoComplete() && styles.buttonDisabled]}
                  onPress={handleStartRecording}
                  disabled={showMusicLinkInput}
                >
                  <Ionicons name="play-circle" size={24} color="#fff" />
                  <Text style={styles.buttonText}>
                    {currentPhase === 'music' ? 'Start Recording (With Music)' : 'Start Recording'}
                  </Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity style={[styles.button, styles.stopButton]} onPress={handleStopRecording}>
                  <Ionicons name="stop-circle" size={24} color="#fff" />
                  <Text style={styles.buttonText}>Stop Recording</Text>
                </TouchableOpacity>
              )}

              {totalRecordedPoints > 0 && !isRecording && !showMusicLinkInput && (
                <View style={styles.resultsCard}>
                  <Text style={styles.resultsTitle}>📊 Recorded Data Ready</Text>
                  <Text style={styles.resultsText}>{`Total: ${totalRecordedPoints} data points`}</Text>
                  <Text style={styles.resultsSubtext}>{`No Music: ${noMusicData.length} / Music: ${musicData.length}`}</Text>
                </View>
              )}
            </View>

            {/* Music Link Input */}
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
                  <Text style={styles.inputHint}>Link to the music you will play</Text>
                  <View style={styles.buttonRow}>
                    <TouchableOpacity
                      style={[styles.button, styles.cancelButton]}
                      onPress={() => { setShowMusicLinkInput(false); setMusicLink(''); }}
                    >
                      <Text style={styles.buttonText}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.button, styles.continueButton]} onPress={handleStartMusicRecording}>
                      <Text style={styles.buttonText}>Continue</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            )}

            {/* Sessions */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>{`My Sessions (${sessions.length})`}</Text>
                <TouchableOpacity onPress={() => setShowSessions(!showSessions)}>
                  <Ionicons name={showSessions ? 'chevron-up' : 'chevron-down'} size={24} color="#666" />
                </TouchableOpacity>
              </View>

              {sessions.length > 0 && (
                <TouchableOpacity style={[styles.button, styles.exportAllButton]} onPress={handleExportAll}>
                  <Ionicons name="download" size={20} color="#fff" />
                  <Text style={styles.buttonText}>Export All Sessions</Text>
                </TouchableOpacity>
              )}

              {showSessions && sessions.length > 0 && (
                <View style={styles.sessionsList}>
                  {sessions.map((session) => {
                    const noMusicCount = session.dataPoints?.filter(d => d.sessionType === 'no_music').length || 0;
                    const musicCount   = session.dataPoints?.filter(d => d.sessionType === 'music').length || 0;
                    return (
                      <View key={session.id} style={styles.sessionCard}>
                        <View style={styles.sessionHeader}>
                          <Text style={styles.sessionTitle}>
                            {`${session.userProfile?.name || 'Session'} — ${new Date(session.timestamp).toLocaleDateString()}`}
                          </Text>
                          <View style={styles.sessionActions}>
                            <TouchableOpacity style={styles.iconButton} onPress={() => exportSession(session)}>
                              <Ionicons name="download-outline" size={20} color="#2196F3" />
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.iconButton} onPress={() => handleDeleteSession(session.id)}>
                              <Ionicons name="trash-outline" size={20} color="#F44336" />
                            </TouchableOpacity>
                          </View>
                        </View>
                        <View style={styles.sessionDetails}>
                          <Text style={styles.sessionDetailText}>
                            {`Age: ${session.userProfile?.age || '—'}   Gender: ${session.userProfile?.gender || '—'}`}
                          </Text>
                          <Text style={styles.sessionDetailText}>
                            {`Points: ${session.dataPoints?.length || 0}${musicCount > 0 ? ` (No Music: ${noMusicCount} / Music: ${musicCount})` : ''}`}
                          </Text>
                          <Text style={styles.sessionDetailText}>
                            {new Date(session.timestamp).toLocaleTimeString()}
                          </Text>
                        </View>
                      </View>
                    );
                  })}
                </View>
              )}

              {sessions.length === 0 && (
                <View style={styles.noSessionsCard}>
                  <Text style={styles.noSessionsText}>No sessions yet. Start recording above!</Text>
                </View>
              )}
            </View>
          </>
        )}
        <View style={styles.bottomPadding} />
      </ScrollView>

      {/* Subject Info Modal */}
      <Modal visible={showSubjectModal} animationType="slide" transparent onRequestClose={() => setShowSubjectModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Subject Information</Text>
            <Text style={styles.modalSubtitle}>Enter the details of the person being recorded</Text>

            <Text style={styles.label}>Name</Text>
            <TextInput
              style={styles.modalInput}
              value={subjectName}
              onChangeText={setSubjectName}
              placeholder="Subject's full name"
              placeholderTextColor="#999"
            />

            <Text style={styles.label}>Age</Text>
            <TextInput
              style={styles.modalInput}
              value={subjectAge}
              onChangeText={setSubjectAge}
              placeholder="Subject's age"
              placeholderTextColor="#999"
              keyboardType="numeric"
            />

            <Text style={styles.label}>Gender</Text>
            <View style={styles.genderButtons}>
              {['M', 'F', 'Other'].map((g) => (
                <TouchableOpacity
                  key={g}
                  style={[styles.genderButton, subjectGender === g && styles.genderButtonActive]}
                  onPress={() => setSubjectGender(g)}
                >
                  <Text style={[styles.genderButtonText, subjectGender === g && styles.genderButtonTextActive]}>{g}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity style={[styles.button, styles.cancelButton]} onPress={() => setShowSubjectModal(false)}>
                <Text style={styles.buttonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.button, styles.continueButton, !(subjectName.trim() && subjectAge.trim() && subjectGender) && styles.buttonDisabled]}
                onPress={() => {
                  if (!subjectName.trim() || !subjectAge.trim() || !subjectGender) {
                    Alert.alert('Required', 'Please fill in all subject fields.');
                    return;
                  }
                  setShowSubjectModal(false);
                }}
              >
                <Text style={styles.buttonText}>Confirm</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  header: { backgroundColor: '#fff', paddingHorizontal: 20, paddingTop: 50, paddingBottom: 15, borderBottomWidth: 1, borderBottomColor: '#e0e0e0' },
  headerTitle: { fontSize: 22, fontWeight: 'bold', color: '#333', marginBottom: 5 },
  headerSubtitle: { fontSize: 14, color: '#666' },
  content: { flex: 1 },
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40, minHeight: 400 },
  emptyIcon: { fontSize: 64, marginBottom: 20 },
  emptyTitle: { fontSize: 20, fontWeight: 'bold', color: '#333', marginBottom: 10 },
  emptyText: { fontSize: 14, color: '#666', textAlign: 'center', lineHeight: 20 },
  section: { padding: 15 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#333', marginBottom: 15 },
  subjectCard: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 4, elevation: 1 },
  subjectFilled: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  subjectInfo: { flex: 1 },
  subjectName: { fontSize: 17, fontWeight: 'bold', color: '#333', marginBottom: 4 },
  subjectDetails: { fontSize: 13, color: '#666' },
  editSubjectButton: { flexDirection: 'row', alignItems: 'center', gap: 4, padding: 8, borderWidth: 1.5, borderColor: '#2196F3', borderRadius: 8 },
  editSubjectText: { fontSize: 13, color: '#2196F3', fontWeight: '600' },
  addSubjectButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, padding: 14, borderWidth: 2, borderColor: '#2196F3', borderRadius: 10, borderStyle: 'dashed' },
  addSubjectText: { fontSize: 15, color: '#2196F3', fontWeight: '600' },
  infoCard: { backgroundColor: '#fff', borderRadius: 12, padding: 15, marginBottom: 15, elevation: 1 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  infoLabel: { fontSize: 14, color: '#666' },
  infoValue: { fontSize: 14, fontWeight: '600', color: '#333' },
  button: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, padding: 15, borderRadius: 10, marginBottom: 10 },
  startButton: { backgroundColor: '#4CAF50' },
  stopButton: { backgroundColor: '#F44336' },
  exportAllButton: { backgroundColor: '#FF9800', marginBottom: 15 },
  continueButton: { backgroundColor: '#2196F3', flex: 1 },
  cancelButton: { backgroundColor: '#9E9E9E', flex: 1 },
  buttonDisabled: { opacity: 0.5 },
  buttonRow: { flexDirection: 'row', gap: 10, marginTop: 15 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  resultsCard: { backgroundColor: '#E3F2FD', borderRadius: 12, padding: 20, marginTop: 10, borderLeftWidth: 4, borderLeftColor: '#2196F3' },
  resultsTitle: { fontSize: 16, fontWeight: 'bold', color: '#1565C0', marginBottom: 8 },
  resultsText: { fontSize: 14, color: '#1976D2', fontWeight: '600', marginBottom: 5 },
  resultsSubtext: { fontSize: 12, color: '#42A5F5' },
  musicCard: { backgroundColor: '#fff', borderRadius: 12, padding: 20, marginBottom: 15, elevation: 1 },
  inputLabel: { fontSize: 14, color: '#666', marginBottom: 8, fontWeight: '600' },
  textInput: { backgroundColor: '#f9f9f9', borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 12, fontSize: 14, color: '#333' },
  inputHint: { fontSize: 12, color: '#999', marginTop: 5, fontStyle: 'italic' },
  sessionsList: { gap: 10 },
  sessionCard: { backgroundColor: '#fff', borderRadius: 12, padding: 15, elevation: 1 },
  sessionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  sessionTitle: { fontSize: 15, fontWeight: '600', color: '#333', flex: 1 },
  sessionActions: { flexDirection: 'row', gap: 10 },
  iconButton: { padding: 5 },
  sessionDetails: { gap: 5 },
  sessionDetailText: { fontSize: 13, color: '#666' },
  noSessionsCard: { backgroundColor: '#fff', borderRadius: 12, padding: 30, alignItems: 'center' },
  noSessionsText: { fontSize: 14, color: '#999', textAlign: 'center', lineHeight: 20 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, paddingBottom: 40 },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#333', marginBottom: 6 },
  modalSubtitle: { fontSize: 13, color: '#888', marginBottom: 20, lineHeight: 18 },
  label: { fontSize: 14, fontWeight: '600', color: '#555', marginBottom: 8, marginTop: 12 },
  modalInput: { backgroundColor: '#f9f9f9', borderWidth: 1, borderColor: '#ddd', borderRadius: 10, padding: 14, fontSize: 16, color: '#333' },
  genderButtons: { flexDirection: 'row', gap: 10, marginTop: 4 },
  genderButton: { flex: 1, paddingVertical: 14, borderWidth: 2, borderColor: '#ddd', borderRadius: 10, alignItems: 'center' },
  genderButtonActive: { borderColor: '#2196F3', backgroundColor: '#E3F2FD' },
  genderButtonText: { fontSize: 16, color: '#666', fontWeight: '600' },
  genderButtonTextActive: { color: '#2196F3', fontWeight: 'bold' },
  modalButtons: { flexDirection: 'row', gap: 12, marginTop: 24 },
  bottomPadding: { height: 100 },
});
