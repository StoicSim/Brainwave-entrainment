import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView,
  StyleSheet, ActivityIndicator, Alert
} from 'react-native';
import { Audio } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';
import { useBleContext } from '../../context/BleContext';
import { GENERATE_ENDPOINT, HEALTH_ENDPOINT } from '../../constants/ApiConfig';
import * as FileSystem from 'expo-file-system/legacy';

const PRESETS = [
  { label: 'Calm', emoji: '🌊', prompt: 'calm, peaceful and relaxing ambient music with soft tones' },
  { label: 'Focus', emoji: '🎯', prompt: 'gentle focus music with light melody, no distractions' },
  { label: 'Sleep', emoji: '🌙', prompt: 'soft, slow, sleep inducing ambient music with low frequencies' },
  { label: 'Nature', emoji: '🌿', prompt: 'nature inspired ambient music with soft flowing sounds' },
];

const TOTAL_TOKENS = 18000; // Fixed at ~2 mins

export default function GenerateScreen() {
  const { device, metrics } = useBleContext();

  const [selectedPreset, setSelectedPreset] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioReady, setAudioReady] = useState(false);
  const [backendOnline, setBackendOnline] = useState(null);
  const [generationTime, setGenerationTime] = useState(null);
  const [elapsed, setElapsed] = useState(0);

  const soundRef = useRef(null);
  const timerRef = useRef(null);

  useEffect(() => {
    checkBackendHealth();
    return () => { cleanup(); };
  }, []);

  // Tick elapsed timer every second while generating
  useEffect(() => {
    if (isGenerating) {
      setElapsed(0);
      timerRef.current = setInterval(() => {
        setElapsed(prev => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isGenerating]);

  const checkBackendHealth = async () => {
    try {
      const response = await fetch(HEALTH_ENDPOINT, {
        method: 'GET',
        headers: { 'ngrok-skip-browser-warning': 'true' }
      });
      const data = await response.json();
      setBackendOnline(data.model_loaded);
    } catch (error) {
      setBackendOnline(false);
    }
  };

  const cleanup = async () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (soundRef.current) {
      await soundRef.current.unloadAsync();
      soundRef.current = null;
    }
  };

  const handleGenerate = async () => {
    if (selectedPreset === null) {
      Alert.alert('Select a Style', 'Please select a music style to generate.');
      return;
    }

    if (backendOnline === false) {
      Alert.alert(
        'Backend Offline',
        'The music generation server is not reachable. Make sure the Lightning AI server is running.',
        [{ text: 'Retry', onPress: checkBackendHealth }, { text: 'OK' }]
      );
      return;
    }

    await cleanup();
    setAudioReady(false);
    setIsGenerating(true);
    setGenerationTime(null);

    try {
      const prompt = PRESETS[selectedPreset].prompt;
      const url = `${GENERATE_ENDPOINT}?prompt=${encodeURIComponent(prompt)}&total_tokens=${TOTAL_TOKENS}&chunk_tokens=512&temperature=1.0&top_k=200`;
      const tempUri = `${FileSystem.cacheDirectory}generated_${Date.now()}.wav`;

      const downloadResult = await FileSystem.downloadAsync(url, tempUri, {
        headers: { 'ngrok-skip-browser-warning': 'true' }
      });

      if (downloadResult.status !== 200) {
        throw new Error(`Server error: ${downloadResult.status}`);
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        staysActiveInBackground: true,
        playsInSilentModeIOS: true,
        shouldDuckAndroid: false,
      });

      const { sound } = await Audio.Sound.createAsync(
        { uri: tempUri },
        { shouldPlay: false }
      );

      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.didJustFinish) setIsPlaying(false);
      });

      soundRef.current = sound;
      setGenerationTime(elapsed);
      setAudioReady(true);

    } catch (error) {
      console.warn('Generation error:', error.message);
      Alert.alert(
        'Generation Failed',
        'Could not generate music. Please check your connection and try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setIsGenerating(false);
    }
  };

  const handlePlayPause = async () => {
    if (!soundRef.current) return;
    if (isPlaying) {
      await soundRef.current.pauseAsync();
      setIsPlaying(false);
    } else {
      await soundRef.current.playAsync();
      setIsPlaying(true);
    }
  };

  const handleStop = async () => {
    if (!soundRef.current) return;
    await soundRef.current.stopAsync();
    await soundRef.current.setPositionAsync(0);
    setIsPlaying(false);
  };

  const handleRegenerate = async () => {
    await handleStop();
    setAudioReady(false);
    handleGenerate();
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Generate Music</Text>
        <View style={styles.headerRight}>
          <View style={[
            styles.statusDot,
            {
              backgroundColor:
                backendOnline === true ? '#4CAF50' :
                backendOnline === false ? '#F44336' : '#FF9800'
            }
          ]} />
          <Text style={styles.statusText}>
            {backendOnline === true ? 'AI Online' :
             backendOnline === false ? 'AI Offline' : 'Checking...'}
          </Text>
        </View>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>

        {/* EEG Status */}
        {device && (
          <View style={styles.eegBanner}>
            <Ionicons name="pulse" size={16} color="#4CAF50" />
            <Text style={styles.eegBannerText}>
              {`EEG Connected — Signal: ${metrics.poorSignal < 50 ? 'Good' : 'Poor'} (${metrics.poorSignal}/200)`}
            </Text>
          </View>
        )}

        {/* Style Presets */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Choose a Style</Text>
          <Text style={styles.sectionSubtitle}>
            Select the type of music you want to generate
          </Text>
          <View style={styles.presetsGrid}>
            {PRESETS.map((preset, index) => (
              <TouchableOpacity
                key={index}
                style={[
                  styles.presetCard,
                  selectedPreset === index && styles.presetCardActive,
                  isGenerating && styles.presetCardDisabled
                ]}
                onPress={() => setSelectedPreset(selectedPreset === index ? null : index)}
                disabled={isGenerating}
              >
                <Text style={styles.presetEmoji}>{preset.emoji}</Text>
                <Text style={[
                  styles.presetLabel,
                  selectedPreset === index && styles.presetLabelActive
                ]}>
                  {preset.label}
                </Text>
                {selectedPreset === index && (
                  <View style={styles.presetCheck}>
                    <Ionicons name="checkmark" size={12} color="#fff" />
                  </View>
                )}
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Duration info */}
        <View style={styles.durationInfo}>
          <Ionicons name="time-outline" size={16} color="#888" />
          <Text style={styles.durationInfoText}>
            Generates approximately 2 minutes of music
          </Text>
        </View>

        {/* Generate Button */}
        <View style={styles.section}>
          {!isGenerating ? (
            <TouchableOpacity
              style={[
                styles.generateButton,
                (selectedPreset === null || backendOnline === false) && styles.generateButtonDisabled
              ]}
              onPress={handleGenerate}
              disabled={selectedPreset === null || backendOnline === false}
            >
              <Ionicons name="musical-notes" size={24} color="#fff" />
              <Text style={styles.generateButtonText}>Generate Music</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.generatingContainer}>
              <ActivityIndicator size="large" color="#4CAF50" />
              <Text style={styles.generatingTitle}>Generating your music...</Text>
              <Text style={styles.generatingSubtext}>
                This takes about 2 minutes — please keep the app open
              </Text>
              <View style={styles.timerBadge}>
                <Ionicons name="time-outline" size={14} color="#4CAF50" />
                <Text style={styles.timerText}>{`${elapsed}s elapsed`}</Text>
              </View>
            </View>
          )}
        </View>

        {/* Audio Player */}
        {audioReady && (
          <View style={styles.playerCard}>
            <View style={styles.playerHeader}>
              <Text style={styles.playerEmoji}>
                {PRESETS[selectedPreset]?.emoji ?? '🎵'}
              </Text>
              <View style={styles.playerInfo}>
                <Text style={styles.playerTitle}>
                  {PRESETS[selectedPreset]?.label ?? 'Generated Music'}
                </Text>
                <Text style={styles.playerSubtext}>
                  {generationTime ? `Generated in ${generationTime}s` : 'Ready to play'}
                </Text>
              </View>
              <View style={styles.playerReadyBadge}>
                <Text style={styles.playerReadyText}>~2 min</Text>
              </View>
            </View>

            {/* Waveform placeholder */}
            <View style={styles.waveform}>
              {Array.from({ length: 40 }).map((_, i) => (
                <View
                  key={i}
                  style={[
                    styles.waveformBar,
                    {
                      height: Math.random() * 35 + 8,
                      backgroundColor: isPlaying
                        ? `rgba(76, 175, 80, ${0.4 + Math.random() * 0.6})`
                        : '#ddd'
                    }
                  ]}
                />
              ))}
            </View>

            {/* Controls */}
            <View style={styles.playerControls}>
              <TouchableOpacity style={styles.playerButton} onPress={handleStop}>
                <Ionicons name="stop" size={26} color="#666" />
              </TouchableOpacity>

              <TouchableOpacity style={styles.playPauseButton} onPress={handlePlayPause}>
                <Ionicons
                  name={isPlaying ? 'pause' : 'play'}
                  size={34}
                  color="#fff"
                />
              </TouchableOpacity>

              <TouchableOpacity style={styles.playerButton} onPress={handleRegenerate}>
                <Ionicons name="refresh" size={26} color="#666" />
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Offline Card */}
        {backendOnline === false && (
          <View style={styles.offlineCard}>
            <Text style={styles.offlineIcon}>⚠️</Text>
            <Text style={styles.offlineTitle}>AI Server Offline</Text>
            <Text style={styles.offlineText}>
              Make sure the Lightning AI server is running and the ngrok tunnel is active.
            </Text>
            <TouchableOpacity style={styles.retryButton} onPress={checkBackendHealth}>
              <Text style={styles.retryButtonText}>Retry Connection</Text>
            </TouchableOpacity>
          </View>
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },
  eegBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F5E9',
    padding: 12,
    margin: 15,
    borderRadius: 10,
    gap: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#4CAF50',
  },
  eegBannerText: {
    fontSize: 13,
    color: '#2E7D32',
    fontWeight: '500',
  },
  content: {
    flex: 1,
  },
  section: {
    padding: 15,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#333',
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 13,
    color: '#999',
    marginBottom: 16,
  },
  presetsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  presetCard: {
    width: '47%',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#e0e0e0',
    elevation: 1,
    gap: 8,
    position: 'relative',
  },
  presetCardActive: {
    borderColor: '#4CAF50',
    backgroundColor: '#E8F5E9',
    elevation: 3,
  },
  presetCardDisabled: {
    opacity: 0.5,
  },
  presetEmoji: {
    fontSize: 36,
  },
  presetLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#555',
  },
  presetLabelActive: {
    color: '#2E7D32',
    fontWeight: '700',
  },
  presetCheck: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#4CAF50',
    alignItems: 'center',
    justifyContent: 'center',
  },
  durationInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 15,
    paddingBottom: 5,
  },
  durationInfoText: {
    fontSize: 12,
    color: '#888',
    fontStyle: 'italic',
  },
  generateButton: {
    backgroundColor: '#4CAF50',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 18,
    borderRadius: 16,
    gap: 10,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  generateButtonDisabled: {
    backgroundColor: '#ccc',
    elevation: 0,
  },
  generateButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  generatingContainer: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 30,
    alignItems: 'center',
    gap: 12,
    elevation: 2,
  },
  generatingTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  generatingSubtext: {
    fontSize: 13,
    color: '#999',
    textAlign: 'center',
    lineHeight: 20,
  },
  timerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    marginTop: 4,
  },
  timerText: {
    fontSize: 13,
    color: '#4CAF50',
    fontWeight: '600',
  },
  playerCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    margin: 15,
    padding: 20,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    gap: 16,
  },
  playerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  playerEmoji: {
    fontSize: 36,
  },
  playerInfo: {
    flex: 1,
  },
  playerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#333',
  },
  playerSubtext: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
  },
  playerReadyBadge: {
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  playerReadyText: {
    fontSize: 12,
    color: '#2E7D32',
    fontWeight: '600',
  },
  waveform: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 55,
    paddingHorizontal: 4,
  },
  waveformBar: {
    width: 5,
    borderRadius: 3,
  },
  playerControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 24,
  },
  playerButton: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#f5f5f5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  playPauseButton: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#4CAF50',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#4CAF50',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  offlineCard: {
    backgroundColor: '#FFF3E0',
    borderRadius: 16,
    margin: 15,
    padding: 24,
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: '#FFB74D',
  },
  offlineIcon: {
    fontSize: 36,
  },
  offlineTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#E65100',
  },
  offlineText: {
    fontSize: 13,
    color: '#BF360C',
    textAlign: 'center',
    lineHeight: 20,
  },
  retryButton: {
    backgroundColor: '#FF9800',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
    marginTop: 6,
  },
  retryButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  bottomPadding: {
    height: 120,
  },
});