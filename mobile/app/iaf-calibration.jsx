import React, { useState, useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useBleContext } from '../context/BleContext';
import { useUserProfile } from '../context/UserProfileContext';
import EEGProcessor from '../utils/EEGProcessor';

// CRB Method Implementation for Single Channel
class CRBCalculator {
  constructor(sampleRate = 512) {
    this.sampleRate = sampleRate;
    this.eegProcessor = new EEGProcessor(sampleRate, 512);
  }

  calculatePSD(eegDataArray) {
    if (eegDataArray.length < 512) {
      console.warn('Insufficient samples for PSD calculation');
      return null;
    }
    const psdResult = this.eegProcessor.computePSD(eegDataArray);
    return psdResult;
  }

  calculateIAF(restPSD, taskPSD) {
    const alphaRange = { min: 6, max: 14 };
    
    if (!restPSD || !taskPSD) {
      console.error('Invalid PSD data');
      return null;
    }

    const frequencies = restPSD.frequencies;
    const restPowers = restPSD.psd;
    const taskPowers = taskPSD.psd;
    
    const startIdx = frequencies.findIndex(f => f >= alphaRange.min);
    const endIdx = frequencies.findIndex(f => f > alphaRange.max);
    
    if (startIdx === -1 || endIdx === -1) {
      console.error('Alpha range not found in frequency data');
      return null;
    }

    let maxDesync = -Infinity;
    let iafFrequency = null;
    let iafPower = null;

    for (let i = startIdx; i < endIdx; i++) {
      const desync = restPowers[i] - taskPowers[i];
      
      if (desync > maxDesync && taskPowers[i] < restPowers[i]) {
        maxDesync = desync;
        iafFrequency = frequencies[i];
        iafPower = restPowers[i];
      }
    }

    if (!iafFrequency) {
      console.error('Could not find IAF - no desynchronization detected');
      return null;
    }

    return {
      frequency: iafFrequency,
      power: iafPower,
      desynchronization: maxDesync,
      restPSD,
      taskPSD
    };
  }
}

export default function IAFCalibrationScreen() {
  const router = useRouter();
  const { 
    device, 
    metrics, 
    isConnecting, 
    rawEEGBuffer, 
    handleConnect, 
    handleDisconnect,
    pauseDataCollection,
    resumeDataCollection 
  } = useBleContext();
  const { updateProfile } = useUserProfile();
  
  const [phase, setPhase] = useState('intro');
  const [countdown, setCountdown] = useState(0);
  const [restData, setRestData] = useState([]);
  const [taskData, setTaskData] = useState([]);
  const [iafResult, setIafResult] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  
  const crbCalculator = useRef(new CRBCalculator(512));
  const recordingInterval = useRef(null);
  const lastBufferSnapshotRef = useRef([]);
  const sampleCounterRef = useRef(0);
  
  // Track if device was connected when we entered this screen
  const wasConnectedOnEntryRef = useRef(false);
  const hasInitializedRef = useRef(false);

  // Initialize - check if device was already connected
  useEffect(() => {
    if (!hasInitializedRef.current) {
      hasInitializedRef.current = true;
      wasConnectedOnEntryRef.current = !!device;
      console.log(`📱 IAF Calibration mounted. Device ${device ? 'was' : 'was NOT'} connected on entry`);
    }
  }, []);

  // Pause data collection when entering calibration
  useEffect(() => {
    if (device && pauseDataCollection) {
      pauseDataCollection();
      console.log('🔇 Paused main app data collection');
    }
  }, [device]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      console.log('🧹 IAF Calibration unmounting...');
      
      // Resume data collection
      if (resumeDataCollection) {
        resumeDataCollection();
        console.log('🔊 Resumed main app data collection');
      }
      
      // Disconnect only if we connected during calibration
      if (device && !wasConnectedOnEntryRef.current) {
        console.log('🔌 Disconnecting device (connected during calibration)');
        handleDisconnect();
      } else if (device) {
        console.log('✅ Keeping device connected (was connected before calibration)');
      }
    };
  }, []);

  // Monitor raw EEG data collection during rest and task phases
  useEffect(() => {
    if (!isRecording || !device) return;

    recordingInterval.current = setInterval(() => {
      if (rawEEGBuffer.length === 0) return;
      
      const currentBuffer = [...rawEEGBuffer];
      const expectedSamplesPerInterval = Math.floor((512 * 50) / 1000);
      const recentSamples = currentBuffer.slice(-expectedSamplesPerInterval);
      
      if (phase === 'rest') {
        setRestData(prev => [...prev, ...recentSamples]);
      } else if (phase === 'task') {
        setTaskData(prev => [...prev, ...recentSamples]);
      }
      
      lastBufferSnapshotRef.current = currentBuffer;
      sampleCounterRef.current += recentSamples.length;
      
    }, 50);

    return () => {
      if (recordingInterval.current) {
        clearInterval(recordingInterval.current);
      }
    };
  }, [isRecording, device, phase, rawEEGBuffer.length]);

  const startCountdown = (duration, nextPhase) => {
    setCountdown(duration);
    
    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          setIsRecording(false);
          setPhase(nextPhase);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const startRestPhase = () => {
    setRestData([]);
    lastBufferSnapshotRef.current = [];
    sampleCounterRef.current = 0;
    setIsRecording(true);
    setPhase('rest');
    startCountdown(60, 'rest-complete');
  };

  const startTaskPhase = () => {
    setTaskData([]);
    lastBufferSnapshotRef.current = [];
    sampleCounterRef.current = 0;
    setIsRecording(true);
    setPhase('task');
    startCountdown(60, 'processing');
  };

  const processIAF = () => {
    setIsRecording(false);
    setPhase('processing');

    setTimeout(() => {
      console.log(`Processing IAF with ${restData.length} rest samples and ${taskData.length} task samples`);

      if (restData.length < 512 || taskData.length < 512) {
        Alert.alert(
          'Insufficient Data',
          `Need at least 512 samples per phase. Got ${restData.length} rest and ${taskData.length} task samples. Please try again with better signal quality.`,
          [{ text: 'OK', onPress: () => setPhase('intro') }]
        );
        return;
      }

      const restPSD = crbCalculator.current.calculatePSD(restData);
      const taskPSD = crbCalculator.current.calculatePSD(taskData);

      if (!restPSD || !taskPSD) {
        Alert.alert(
          'Processing Error',
          'Could not compute power spectral density. Please try again.',
          [{ text: 'OK', onPress: () => setPhase('intro') }]
        );
        return;
      }

      const result = crbCalculator.current.calculateIAF(restPSD, taskPSD);

      if (!result || !result.frequency) {
        Alert.alert(
          'IAF Not Found',
          'Could not determine IAF. This could mean:\n\n• Signal quality was poor\n• Not enough alpha desynchronization\n• Instructions not followed correctly\n\nPlease try again.',
          [{ text: 'OK', onPress: () => setPhase('intro') }]
        );
        return;
      }

      console.log('IAF Result:', result);
      setIafResult(result);
      setPhase('results');
    }, 2000);
  };

  useEffect(() => {
    if (phase === 'processing') {
      processIAF();
    }
  }, [phase]);

  useEffect(() => {
    if (phase === 'rest-complete') {
      Alert.alert(
        'Rest Phase Complete',
        `Collected ${restData.length} samples. Ready for task phase?`,
        [
          { text: 'Retry Rest', onPress: () => setPhase('connect') },
          { text: 'Continue', onPress: startTaskPhase }
        ]
      );
    }
  }, [phase]);

  const saveIAF = async () => {
    if (iafResult) {
      updateProfile({
        iafCalibration: {
          completed: true,
          timestamp: new Date().toISOString(),
          iaf: iafResult.frequency,
          method: 'CRB',
          desynchronization: iafResult.desynchronization,
          restSamples: restData.length,
          taskSamples: taskData.length,
          power: iafResult.power
        }
      });
      
      // Disconnect if we connected during calibration
      if (device && !wasConnectedOnEntryRef.current) {
        console.log('🔌 Disconnecting device after save');
        await handleDisconnect();
      }
      
      Alert.alert(
        'Success!',
        `Your Individual Alpha Frequency has been calibrated:\n\n${iafResult.frequency.toFixed(2)} Hz\n\nThis will be used to personalize your brain entrainment experience.`,
        [{ text: 'OK', onPress: () => router.back() }]
      );
    }
  };

  const useDemoData = () => {
    updateProfile({
      iafCalibration: {
        completed: true,
        timestamp: new Date().toISOString(),
        iaf: 10.2,
        method: 'Demo'
      }
    });
    Alert.alert(
      'Demo Data Loaded',
      'IAF set to 10.2 Hz (average value)',
      [{ text: 'OK', onPress: () => router.back() }]
    );
  };

  const handleBack = async () => {
    console.log('⬅️ Back button clicked from phase:', phase);
    
    // Disconnect if we connected the device during calibration
    if (device && !wasConnectedOnEntryRef.current) {
      console.log('🔌 Disconnecting device before going back');
      await handleDisconnect();
    }
    
    if (phase === 'intro') {
      router.back();
    } else {
      setPhase('intro');
    }
  };

  const handleCancel = async () => {
    console.log('❌ Cancel button clicked');
    
    // Always disconnect if device is connected and we connected it
    if (device && !wasConnectedOnEntryRef.current) {
      console.log('🔌 Disconnecting device on cancel');
      await handleDisconnect();
    }
    
    router.back();
  };

  const renderIntro = () => (
    <View style={styles.phaseContainer}>
      <Text style={styles.phaseTitle}>🧘 IAF Calibration</Text>
      <Text style={styles.phaseSubtitle}>Channel Reactivity-Based Method</Text>
      
      <View style={styles.infoBox}>
        <Text style={styles.infoTitle}>What is IAF?</Text>
        <Text style={styles.infoText}>
          Your Individual Alpha Frequency (IAF) is the specific frequency at which your brain produces the strongest alpha waves. 
          This varies between individuals (typically 8-13 Hz) and helps us personalize your brain entrainment experience.
        </Text>
      </View>

      <View style={styles.infoBox}>
        <Text style={styles.infoTitle}>How does CRB work?</Text>
        <Text style={styles.infoText}>
          The CRB (Channel Reactivity-Based) method measures your alpha waves in two conditions:{'\n\n'}
          1. <Text style={styles.bold}>Rest</Text>: Eyes closed, relaxed (alpha is strong){'\n'}
          2. <Text style={styles.bold}>Task</Text>: Eyes open, mental activity (alpha suppresses){'\n\n'}
          Your IAF is the frequency showing the most suppression during the task.
        </Text>
      </View>

      <View style={styles.timelineCard}>
        <Text style={styles.timelineTitle}>📋 Process Timeline</Text>
        <View style={styles.timelineItem}>
          <Text style={styles.timelineNumber}>1</Text>
          <Text style={styles.timelineText}>Connect EEG device</Text>
        </View>
        <View style={styles.timelineItem}>
          <Text style={styles.timelineNumber}>2</Text>
          <Text style={styles.timelineText}>Rest phase: 60s eyes closed</Text>
        </View>
        <View style={styles.timelineItem}>
          <Text style={styles.timelineNumber}>3</Text>
          <Text style={styles.timelineText}>Task phase: 60s eyes open + counting</Text>
        </View>
        <View style={styles.timelineItem}>
          <Text style={styles.timelineNumber}>4</Text>
          <Text style={styles.timelineText}>Calculate your IAF</Text>
        </View>
        <Text style={styles.timelineTotal}>Total time: ~3 minutes</Text>
      </View>

      <View style={styles.buttonGroup}>
        <TouchableOpacity
          style={[styles.button, styles.buttonPrimary]}
          onPress={() => setPhase('connect')}
        >
          <Text style={styles.buttonText}>Start Real Calibration</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.buttonSecondary]}
          onPress={useDemoData}
        >
          <Text style={styles.buttonTextSecondary}>Use Demo Data (10.2 Hz)</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.buttonGhost]}
          onPress={handleCancel}
        >
          <Text style={styles.buttonTextGhost}>Cancel</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderConnect = () => (
    <View style={styles.phaseContainer}>
      <Text style={styles.phaseTitle}>🔌 Connect Device</Text>
      <Text style={styles.phaseSubtitle}>Step 1 of 4</Text>

      <View style={styles.statusCard}>
        <Text style={styles.statusLabel}>Device Status:</Text>
        <Text style={[
          styles.statusValue,
          { color: device ? '#4CAF50' : '#F44336' }
        ]}>
          {device ? '✓ Connected' : '✗ Not Connected'}
        </Text>
      </View>

      {device && (
        <View style={styles.statusCard}>
          <Text style={styles.statusLabel}>Signal Quality:</Text>
          <Text style={[
            styles.statusValue,
            { color: metrics.poorSignal <= 50 ? '#4CAF50' : '#F44336' }
          ]}>
            {metrics.poorSignal <= 50 ? 'Good' : 'Poor'} ({metrics.poorSignal}/200)
          </Text>
        </View>
      )}

      {device && metrics.poorSignal <= 50 && (
        <View style={styles.successBox}>
          <Text style={styles.successIcon}>✅</Text>
          <Text style={styles.successText}>Good signal quality! Ready to proceed.</Text>
        </View>
      )}

      {device && metrics.poorSignal > 50 && (
        <View style={styles.warningBox}>
          <Text style={styles.warningIcon}>⚠️</Text>
          <View style={styles.warningContent}>
            <Text style={styles.warningText}>
              Poor signal quality. Please adjust your headset:
            </Text>
            <Text style={styles.warningInstructions}>
              • Ensure sensors touch your skin{'\n'}
              • Moisten sensor contacts if needed{'\n'}
              • Adjust headset position{'\n'}
              • Wait a few seconds for stabilization
            </Text>
          </View>
        </View>
      )}

      <View style={styles.infoBox}>
        <Text style={styles.infoTitle}>💡 Tips for Best Results</Text>
        <Text style={styles.infoText}>
          • Find a quiet, comfortable place{'\n'}
          • Ensure good headset contact{'\n'}
          • Minimize movement during recording{'\n'}
          • Follow instructions carefully
        </Text>
      </View>

      <View style={styles.buttonGroup}>
        {!device ? (
          <TouchableOpacity
            style={[styles.button, styles.buttonPrimary]}
            onPress={handleConnect}
            disabled={isConnecting}
          >
            <Text style={styles.buttonText}>
              {isConnecting ? 'Connecting...' : 'Connect Device'}
            </Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.connectedButtons}>
            <TouchableOpacity
              style={[styles.button, styles.buttonPrimary, metrics.poorSignal > 50 && styles.buttonDisabled]}
              onPress={startRestPhase}
              disabled={metrics.poorSignal > 50}
            >
              <Text style={styles.buttonText}>
                {metrics.poorSignal > 50 ? '🔒 Improve Signal First' : 'Begin Rest Phase'}
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.button, styles.buttonDisconnect]}
              onPress={handleDisconnect}
            >
              <Text style={styles.buttonText}>Disconnect Device</Text>
            </TouchableOpacity>
          </View>
        )}

        <TouchableOpacity
          style={[styles.button, styles.buttonGhost]}
          onPress={handleBack}
        >
          <Text style={styles.buttonTextGhost}>Back</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderRest = () => (
    <View style={styles.phaseContainer}>
      <Text style={styles.phaseTitle}>😌 Rest Phase</Text>
      <Text style={styles.phaseSubtitle}>Step 2 of 4 - Recording baseline</Text>

      <View style={styles.countdownBox}>
        <Text style={styles.countdownNumber}>{countdown}</Text>
        <Text style={styles.countdownLabel}>seconds remaining</Text>
      </View>

      <View style={styles.instructionBox}>
        <Text style={styles.instructionTitle}>Instructions:</Text>
        <Text style={styles.instructionText}>
          ✓ Close your eyes{'\n'}
          ✓ Sit comfortably and relax{'\n'}
          ✓ Clear your mind{'\n'}
          ✓ Breathe naturally{'\n'}
          ✓ Stay still
        </Text>
      </View>

      <View style={styles.progressCard}>
        <Text style={styles.progressLabel}>Samples Collected:</Text>
        <Text style={styles.progressValue}>{restData.length} / ~30,720</Text>
        <View style={styles.progressBar}>
          <View 
            style={[
              styles.progressFill, 
              { width: `${Math.min(100, (restData.length / 30720) * 100)}%` }
            ]} 
          />
        </View>
        <Text style={styles.progressSubtext}>
          {restData.length >= 512 ? '✓ Minimum reached' : `Need ${512 - restData.length} more for minimum`}
        </Text>
      </View>

      <View style={styles.signalCard}>
        <Text style={styles.signalLabel}>Signal Quality:</Text>
        <Text style={[
          styles.signalValue,
          { color: metrics.poorSignal < 50 ? '#4CAF50' : '#F44336' }
        ]}>
          {metrics.poorSignal < 50 ? 'Good' : 'Poor'} ({metrics.poorSignal}/200)
        </Text>
      </View>
    </View>
  );

  const renderTask = () => (
    <View style={styles.phaseContainer}>
      <Text style={styles.phaseTitle}>🎯 Task Phase</Text>
      <Text style={styles.phaseSubtitle}>Step 3 of 4 - Recording active state</Text>

      <View style={styles.countdownBox}>
        <Text style={styles.countdownNumber}>{countdown}</Text>
        <Text style={styles.countdownLabel}>seconds remaining</Text>
      </View>

      <View style={styles.instructionBox}>
        <Text style={styles.instructionTitle}>Instructions:</Text>
        <Text style={styles.instructionText}>
          ✓ Keep your eyes OPEN{'\n'}
          ✓ Count backwards from 100 by 7s{'\n'}
          ✓ Focus on the counting task{'\n'}
          ✓ Stay mentally engaged
        </Text>
      </View>

      <View style={styles.taskHelper}>
        <Text style={styles.taskHelperTitle}>Mental Task:</Text>
        <Text style={styles.taskHelperText}>100 → 93 → 86 → 79 → 72 → ...</Text>
      </View>

      <View style={styles.progressCard}>
        <Text style={styles.progressLabel}>Samples Collected:</Text>
        <Text style={styles.progressValue}>{taskData.length} / ~30,720</Text>
        <View style={styles.progressBar}>
          <View 
            style={[
              styles.progressFill, 
              { width: `${Math.min(100, (taskData.length / 30720) * 100)}%` }
            ]} 
          />
        </View>
        <Text style={styles.progressSubtext}>
          {taskData.length >= 512 ? '✓ Minimum reached' : `Need ${512 - taskData.length} more for minimum`}
        </Text>
      </View>

      <View style={styles.signalCard}>
        <Text style={styles.signalLabel}>Signal Quality:</Text>
        <Text style={[
          styles.signalValue,
          { color: metrics.poorSignal < 50 ? '#4CAF50' : '#F44336' }
        ]}>
          {metrics.poorSignal < 50 ? 'Good' : 'Poor'} ({metrics.poorSignal}/200)
        </Text>
      </View>
    </View>
  );

  const renderProcessing = () => (
    <View style={styles.phaseContainer}>
      <Text style={styles.phaseTitle}>⚙️ Processing</Text>
      <Text style={styles.phaseSubtitle}>Step 4 of 4 - Computing IAF</Text>

      <View style={styles.processingBox}>
        <Text style={styles.processingIcon}>🔄</Text>
        <Text style={styles.processingText}>Analyzing brainwave data...</Text>
        <Text style={styles.processingSubtext}>
          Applying CRB algorithm to {restData.length + taskData.length} samples
        </Text>
      </View>

      <View style={styles.stepsCard}>
        <View style={styles.stepItem}>
          <Text style={styles.stepIcon}>✓</Text>
          <Text style={styles.stepText}>Preprocessing signals</Text>
        </View>
        <View style={styles.stepItem}>
          <Text style={styles.stepIcon}>✓</Text>
          <Text style={styles.stepText}>Computing rest PSD</Text>
        </View>
        <View style={styles.stepItem}>
          <Text style={styles.stepIcon}>✓</Text>
          <Text style={styles.stepText}>Computing task PSD</Text>
        </View>
        <View style={styles.stepItem}>
          <Text style={styles.stepIcon}>⏳</Text>
          <Text style={styles.stepText}>Finding maximum desynchronization</Text>
        </View>
        <View style={styles.stepItem}>
          <Text style={styles.stepIcon}>⏳</Text>
          <Text style={styles.stepText}>Calculating IAF</Text>
        </View>
      </View>
    </View>
  );

  const renderResults = () => (
    <View style={styles.phaseContainer}>
      <Text style={styles.phaseTitle}>🎉 Calibration Complete!</Text>
      <Text style={styles.phaseSubtitle}>Your personalized IAF has been determined</Text>

      <View style={styles.resultCard}>
        <Text style={styles.resultLabel}>Individual Alpha Frequency:</Text>
        <Text style={styles.resultValue}>{iafResult?.frequency?.toFixed(2)} Hz</Text>
        <Text style={styles.resultSubtext}>
          {iafResult?.frequency < 9.5 && 'Lower than average - may indicate deeper relaxation capacity'}
          {iafResult?.frequency >= 9.5 && iafResult?.frequency <= 10.5 && 'Right in the typical range'}
          {iafResult?.frequency > 10.5 && 'Higher than average - may indicate faster cognitive processing'}
        </Text>
      </View>

      <View style={styles.metricsCard}>
        <Text style={styles.metricsTitle}>📊 Calibration Metrics</Text>
        <View style={styles.metricRow}>
          <Text style={styles.metricLabel}>IAF:</Text>
          <Text style={styles.metricValue}>{iafResult?.frequency?.toFixed(2)} Hz</Text>
        </View>
        <View style={styles.metricRow}>
          <Text style={styles.metricLabel}>Alpha Power (rest):</Text>
          <Text style={styles.metricValue}>
            {iafResult?.power?.toExponential(2)}
          </Text>
        </View>
        <View style={styles.metricRow}>
          <Text style={styles.metricLabel}>Desynchronization:</Text>
          <Text style={styles.metricValue}>
            {iafResult?.desynchronization?.toExponential(2)}
          </Text>
        </View>
        <View style={styles.metricRow}>
          <Text style={styles.metricLabel}>Rest samples:</Text>
          <Text style={styles.metricValue}>{restData.length}</Text>
        </View>
        <View style={styles.metricRow}>
          <Text style={styles.metricLabel}>Task samples:</Text>
          <Text style={styles.metricValue}>{taskData.length}</Text>
        </View>
        <View style={styles.metricRow}>
          <Text style={styles.metricLabel}>Method:</Text>
          <Text style={styles.metricValue}>CRB (Single Channel)</Text>
        </View>
      </View>

      <View style={styles.infoBox}>
        <Text style={styles.infoTitle}>What does this mean?</Text>
        <Text style={styles.infoText}>
          Your brain produces strongest alpha waves at {iafResult?.frequency?.toFixed(2)} Hz during relaxation. 
          The app will now use this personalized frequency to create optimal brain entrainment tones matched to your unique neural rhythm.
        </Text>
      </View>

      <View style={styles.buttonGroup}>
        <TouchableOpacity
          style={[styles.button, styles.buttonPrimary]}
          onPress={saveIAF}
        >
          <Text style={styles.buttonText}>Save & Continue</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.buttonSecondary]}
          onPress={() => {
            setPhase('intro');
            setRestData([]);
            setTaskData([]);
            setIafResult(null);
          }}
        >
          <Text style={styles.buttonTextSecondary}>Recalibrate</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.content}
      >
        {phase === 'intro' && renderIntro()}
        {phase === 'connect' && renderConnect()}
        {phase === 'rest' && renderRest()}
        {phase === 'task' && renderTask()}
        {phase === 'processing' && renderProcessing()}
        {phase === 'results' && renderResults()}
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
  phaseContainer: {
    flex: 1,
  },
  phaseTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
    marginBottom: 5,
  },
  phaseSubtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 30,
  },
  infoBox: {
    backgroundColor: '#E3F2FD',
    padding: 20,
    borderRadius: 12,
    marginBottom: 20,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1976D2',
    marginBottom: 10,
  },
  infoText: {
    fontSize: 14,
    color: '#555',
    lineHeight: 22,
  },
  bold: {
    fontWeight: 'bold',
  },
  timelineCard: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 12,
    marginBottom: 20,
    elevation: 2,
  },
  timelineTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
  },
  timelineItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  timelineNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#4CAF50',
    color: '#fff',
    textAlign: 'center',
    lineHeight: 28,
    fontWeight: 'bold',
    marginRight: 12,
  },
  timelineText: {
    fontSize: 14,
    color: '#666',
    flex: 1,
  },
  timelineTotal: {
    fontSize: 13,
    color: '#999',
    fontStyle: 'italic',
    marginTop: 10,
    textAlign: 'center',
  },
  buttonGroup: {
    gap: 12,
  },
  connectedButtons: {
    gap: 10,
  },
  button: {
    padding: 18,
    borderRadius: 12,
    alignItems: 'center',
  },
  buttonPrimary: {
    backgroundColor: '#4CAF50',
  },
  buttonSecondary: {
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#4CAF50',
  },
  buttonDisconnect: {
    backgroundColor: '#F44336',
  },
  buttonGhost: {
    backgroundColor: 'transparent',
  },
  buttonDisabled: {
    backgroundColor: '#ccc',
    opacity: 0.6,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  buttonTextSecondary: {
    color: '#4CAF50',
    fontSize: 16,
    fontWeight: 'bold',
  },
  buttonTextGhost: {
    color: '#666',
    fontSize: 16,
    fontWeight: '600',
  },
  statusCard: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 12,
    marginBottom: 15,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    elevation: 1,
  },
  statusLabel: {
    fontSize: 16,
    color: '#666',
  },
  statusValue: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  successBox: {
    backgroundColor: '#E8F5E9',
    padding: 15,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    borderLeftWidth: 4,
    borderLeftColor: '#4CAF50',
  },
  successIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  successText: {
    fontSize: 14,
    color: '#2E7D32',
    flex: 1,
  },
  warningBox: {
    backgroundColor: '#FFF3E0',
    padding: 15,
    borderRadius: 10,
    flexDirection: 'row',
    marginBottom: 20,
    borderLeftWidth: 4,
    borderLeftColor: '#FF9800',
  },
  warningIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  warningContent: {
    flex: 1,
  },
  warningText: {
    fontSize: 14,
    color: '#E65100',
    fontWeight: '600',
    marginBottom: 8,
  },
  warningInstructions: {
    fontSize: 13,
    color: '#EF6C00',
    lineHeight: 20,
  },
  countdownBox: {
    backgroundColor: '#fff',
    padding: 40,
    borderRadius: 20,
    alignItems: 'center',
    marginBottom: 30,
    elevation: 4,
  },
  countdownNumber: {
    fontSize: 72,
    fontWeight: 'bold',
    color: '#4CAF50',
  },
  countdownLabel: {
    fontSize: 16,
    color: '#666',
    marginTop: 10,
  },
  instructionBox: {
    backgroundColor: '#E8F5E9',
    padding: 20,
    borderRadius: 12,
    marginBottom: 20,
  },
  instructionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2E7D32',
    marginBottom: 12,
  },
  instructionText: {
    fontSize: 14,
    color: '#555',
    lineHeight: 24,
  },
  taskHelper: {
    backgroundColor: '#FFF9C4',
    padding: 15,
    borderRadius: 10,
    marginBottom: 20,
    borderLeftWidth: 4,
    borderLeftColor: '#FBC02D',
  },
  taskHelperTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#F57F17',
    marginBottom: 5,
  },
  taskHelperText: {
    fontSize: 16,
    color: '#F57F17',
    fontWeight: '600',
  },
  progressCard: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 12,
    marginBottom: 20,
    elevation: 1,
  },
  progressLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  progressValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
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
  progressSubtext: {
    fontSize: 11,
    color: '#999',
    fontStyle: 'italic',
  },
  signalCard: {
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    elevation: 1,
  },
  signalLabel: {
    fontSize: 14,
    color: '#666',
  },
  signalValue: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  processingBox: {
    backgroundColor: '#fff',
    padding: 40,
    borderRadius: 20,
    alignItems: 'center',
    marginBottom: 30,
    elevation: 2,
  },
  processingIcon: {
    fontSize: 64,
    marginBottom: 20,
  },
  processingText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
  },
  processingSubtext: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  stepsCard: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 12,
    elevation: 1,
  },
  stepItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  stepIcon: {
    fontSize: 20,
    marginRight: 12,
    width: 24,
  },
  stepText: {
    fontSize: 14,
    color: '#666',
    flex: 1,
  },
  resultCard: {
    backgroundColor: '#4CAF50',
    padding: 30,
    borderRadius: 20,
    alignItems: 'center',
    marginBottom: 30,
    elevation: 4,
  },
  resultLabel: {
    fontSize: 16,
    color: '#fff',
    marginBottom: 10,
  },
  resultValue: {
    fontSize: 56,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
  },
  resultSubtext: {
    fontSize: 13,
    color: '#E8F5E9',
    textAlign: 'center',
  },
  metricsCard: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 12,
    marginBottom: 20,
    elevation: 1,
  },
  metricsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
  },
  metricRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  metricLabel: {
    fontSize: 14,
    color: '#666',
  },
  metricValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
});