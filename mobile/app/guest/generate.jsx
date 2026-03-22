import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView,
  StyleSheet, ActivityIndicator, Alert, TextInput
} from 'react-native';
import { Audio } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';
import { useBleContext } from '../../context/BleContext';
import { GENERATE_ENDPOINT, HEALTH_ENDPOINT } from '../../constants/ApiConfig';
import * as FileSystem from 'expo-file-system/legacy';
import { Buffer } from 'buffer';
const PRESETS = [
  { label: 'Calm', emoji: '🌊', prompt: 'calm, peaceful and relaxing ambient music with soft tones' },
  { label: 'Focus', emoji: '🎯', prompt: 'gentle focus music with light melody, no distractions' },
  { label: 'Sleep', emoji: '🌙', prompt: 'soft, slow, sleep inducing ambient music with low frequencies' },
  { label: 'Nature', emoji: '🌿', prompt: 'nature inspired ambient music with soft flowing sounds' },
];

export default function GenerateScreen() {
  const { device, metrics } = useBleContext();

  const [selectedPreset, setSelectedPreset] = useState(null);
  const [customPrompt, setCustomPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioReady, setAudioReady] = useState(false);
  const [backendOnline, setBackendOnline] = useState(null); // null=unknown, true, false
  const [generationTime, setGenerationTime] = useState(null);
  const [totalTokens, setTotalTokens] = useState(4500);

  const soundRef = useRef(null);
  const timerRef = useRef(null);
  const elapsedRef = useRef(0);

  // Check backend health on mount
  useEffect(() => {
    checkBackendHealth();
    return () => {
      cleanup();
    };
  }, []);

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

  const getActivePrompt = () => {
    if (customPrompt.trim()) return customPrompt.trim();
    if (selectedPreset !== null) return PRESETS[selectedPreset].prompt;
    return null;
  };

  const handleGenerate = async () => {
    const prompt = getActivePrompt();
    if (!prompt) {
      Alert.alert('Select a Style', 'Please select a music style or enter a custom prompt.');
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

    // Cleanup previous audio
    await cleanup();
    setAudioReady(false);
    setIsGenerating(true);
    setGenerationTime(null);
    elapsedRef.current = 0;

    // Start elapsed timer
    timerRef.current = setInterval(() => {
      elapsedRef.current += 1;
    }, 1000);

    try {
      const url = `${GENERATE_ENDPOINT}?prompt=${encodeURIComponent(prompt)}&total_tokens=${totalTokens}&chunk_tokens=512&temperature=1.0&top_k=200`;

      const response = await fetch(url, {
        method: 'GET',
        headers: { 'ngrok-skip-browser-warning': 'true' }
      });

      if (!response.ok) {
        throw new Error(`Server error: ${response.status}`);
      }

      // Get the audio blob
      const tempUri = `${FileSystem.cacheDirectory}generated_${Date.now()}.wav`;
      const arrayBuffer = await response.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);
      
      // Convert to base64 in chunks to avoid stack overflow on large files
      // Convert to base64 using Buffer to avoid encoding issues
      const base64 = Buffer.from(uint8Array).toString('base64');
      
      await FileSystem.writeAsStringAsync(tempUri, base64, {
        encoding: 'base64',
      });
      // Load into expo-av
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
        if (status.didJustFinish) {
          setIsPlaying(false);
        }
      });

      soundRef.current = sound;
      setGenerationTime(elapsedRef.current);
      setAudioReady(true);

    } catch (error) {
      console.warn('Generation error:', error.message);
      Alert.alert(
        'Generation Failed',
        'Could not generate music. Please check your connection and try again.',
        [{ text: 'OK' }]
      );
    } finally {
      if (timerRef.current) clearInterval(timerRef.current);
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

  const approximateDuration = Math.round((totalTokens / 9000) * 60);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Generate Music</Text>
        <View style={styles.headerRight}>
          {/* Backend status */}
          <View style={[
            styles.statusDot,
            { backgroundColor: backendOnline === true ? '#4CAF50' : backendOnline === false ? '#F44336' : '#FF9800' }
          ]} />
          <Text style={styles.statusText}>
            {backendOnline === true ? 'AI Online' : backendOnline === false ? 'AI Offline' : 'Checking...'}
          </Text>
        </View>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>

        {/* EEG Status (if connected) */}
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
          <View style={styles.presetsGrid}>
            {PRESETS.map((preset, index) => (
              <TouchableOpacity
                key={index}
                style={[
                  styles.presetCard,
                  selectedPreset === index && styles.presetCardActive,
                  customPrompt.trim() && styles.presetCardDisabled
                ]}
                onPress={() => {
                  setSelectedPreset(selectedPreset === index ? null : index);
                  setCustomPrompt('');
                }}
                disabled={!!customPrompt.trim()}
              >
                <Text style={styles.presetEmoji}>{preset.emoji}</Text>
                <Text style={[
                  styles.presetLabel,
                  selectedPreset === index && styles.presetLabelActive
                ]}>
                  {preset.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Custom Prompt */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Or Describe Your Own</Text>
          <TextInput
            style={[styles.promptInput, selectedPreset !== null && styles.promptInputDisabled]}
            placeholder="e.g. soft piano with slow rhythm..."
            placeholderTextColor="#bbb"
            value={customPrompt}
            onChangeText={(text) => {
              setCustomPrompt(text);
              if (text.trim()) setSelectedPreset(null);
            }}
            multiline
            numberOfLines={3}
            editable={selectedPreset === null}
          />
        </View>

        {/* Duration Selector */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{`Approximate Duration: ~${approximateDuration}s`}</Text>
          <View style={styles.durationRow}>
            {[2250, 4500, 9000, 18000].map((tokens) => (
              <TouchableOpacity
                key={tokens}
                style={[styles.durationButton, totalTokens === tokens && styles.durationButtonActive]}
                onPress={() => setTotalTokens(tokens)}
              >
                <Text style={[
                  styles.durationButtonText,
                  totalTokens === tokens && styles.durationButtonTextActive
                ]}>
                  {`~${Math.round((tokens / 9000) * 60)}s`}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Generate Button */}
        <View style={styles.section}>
          {!isGenerating ? (
            <TouchableOpacity
              style={[
                styles.generateButton,
                (!getActivePrompt() || backendOnline === false) && styles.generateButtonDisabled
              ]}
              onPress={handleGenerate}
              disabled={!getActivePrompt() || backendOnline === false || isGenerating}
            >
              <Ionicons name="musical-notes" size={24} color="#fff" />
              <Text style={styles.generateButtonText}>Generate Music</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.generatingContainer}>
              <ActivityIndicator size="large" color="#4CAF50" />
              <Text style={styles.generatingTitle}>Generating your music...</Text>
              <Text style={styles.generatingSubtext}>
                This may take 30–90 seconds depending on duration
              </Text>
            </View>
          )}
        </View>

        {/* Audio Player */}
        {audioReady && (
          <View style={styles.playerCard}>
            <View style={styles.playerHeader}>
              <Ionicons name="musical-note" size={20} color="#4CAF50" />
              <Text style={styles.playerTitle}>
                {selectedPreset !== null ? `${PRESETS[selectedPreset].emoji} ${PRESETS[selectedPreset].label}` : '🎵 Custom'}
              </Text>
              {generationTime && (
                <Text style={styles.playerSubtext}>{`Generated in ${generationTime}s`}</Text>
              )}
            </View>

            {/* Waveform placeholder */}
            <View style={styles.waveform}>
              {Array.from({ length: 30 }).map((_, i) => (
                <View
                  key={i}
                  style={[
                    styles.waveformBar,
                    {
                      height: Math.random() * 30 + 10,
                      backgroundColor: isPlaying ? '#4CAF50' : '#ccc'
                    }
                  ]}
                />
              ))}
            </View>

            {/* Controls */}
            <View style={styles.playerControls}>
              <TouchableOpacity
                style={styles.playerButton}
                onPress={handleStop}
              >
                <Ionicons name="stop" size={28} color="#666" />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.playPauseButton}
                onPress={handlePlayPause}
              >
                <Ionicons
                  name={isPlaying ? 'pause' : 'play'}
                  size={36}
                  color="#fff"
                />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.playerButton}
                onPress={handleRegenerate}
              >
                <Ionicons name="refresh" size={28} color="#666" />
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Offline retry */}
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
    fontSize: 15,
    fontWeight: '700',
    color: '#333',
    marginBottom: 12,
  },
  presetsGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  presetCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#e0e0e0',
    elevation: 1,
    gap: 6,
  },
  presetCardActive: {
    borderColor: '#4CAF50',
    backgroundColor: '#E8F5E9',
  },
  presetCardDisabled: {
    opacity: 0.4,
  },
  presetEmoji: {
    fontSize: 28,
  },
  presetLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
  },
  presetLabelActive: {
    color: '#2E7D32',
  },
  promptInput: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 12,
    padding: 14,
    fontSize: 14,
    color: '#333',
    minHeight: 80,
    textAlignVertical: 'top',
  },
  promptInputDisabled: {
    opacity: 0.4,
    backgroundColor: '#f9f9f9',
  },
  durationRow: {
    flexDirection: 'row',
    gap: 10,
  },
  durationButton: {
    flex: 1,
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#e0e0e0',
    borderRadius: 10,
    padding: 12,
    alignItems: 'center',
  },
  durationButtonActive: {
    borderColor: '#4CAF50',
    backgroundColor: '#E8F5E9',
  },
  durationButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#666',
  },
  durationButtonTextActive: {
    color: '#2E7D32',
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
    gap: 8,
  },
  playerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#333',
    flex: 1,
  },
  playerSubtext: {
    fontSize: 12,
    color: '#999',
  },
  waveform: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 50,
    paddingHorizontal: 4,
  },
  waveformBar: {
    width: 4,
    borderRadius: 2,
  },
  playerControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
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
    width: 68,
    height: 68,
    borderRadius: 34,
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