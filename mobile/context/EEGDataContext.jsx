import React, { createContext, useState, useEffect, useContext } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';

const EEGDataContext = createContext();

export function EEGDataProvider({ children }) {
  const [sessions, setSessions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadSessions();
  }, []);

  const loadSessions = async () => {
    try {
      const stored = await AsyncStorage.getItem('eegSessions');
      if (stored) {
        setSessions(JSON.parse(stored));
        console.log('Sessions loaded:', JSON.parse(stored).length);
      }
    } catch (error) {
      console.error('Error loading sessions:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const saveSessions = async (newSessions) => {
    try {
      await AsyncStorage.setItem('eegSessions', JSON.stringify(newSessions));
      setSessions(newSessions);
      console.log('Sessions saved:', newSessions.length);
    } catch (error) {
      console.error('Error saving sessions:', error);
    }
  };

  // Save a complete session with recorded data points
  const saveSession = async (userProfile, dataPoints, musicCondition, musicLink, recordingStartTime) => {
    const newSession = {
      id: Date.now().toString(),
      timestamp: new Date().toISOString(),
      recordingStartTime: recordingStartTime || Date.now(), // Add recording start time
      userProfile: {
        name: userProfile.name,
        age: userProfile.age,
        iaf: userProfile.iafCalibration?.iaf || null,
        personality: userProfile.personalityTest?.scores || {}
      },
      dataPoints, // Array of { timestamp, bandPowers, psdPoints, metrics }
      musicCondition,
      musicLink
    };
    
    const updated = [...sessions, newSession];
    await saveSessions(updated); // Make sure this completes before returning
    
    return newSession; // Return the entire session object instead of just ID
  };

  const deleteSession = (sessionId) => {
    const updated = sessions.filter(s => s.id !== sessionId);
    saveSessions(updated);
  };

  const clearAllSessions = async () => {
    try {
      await AsyncStorage.removeItem('eegSessions');
      setSessions([]);
      console.log('All sessions cleared');
    } catch (error) {
      console.error('Error clearing sessions:', error);
    }
  };

  // Generate filename with all user info + recording timestamp
  const generateFilename = (session) => {
    const { userProfile, musicCondition, musicLink, recordingStartTime } = session;
    const p = userProfile.personality;
    
    const name = (userProfile.name || 'unknown').toLowerCase().replace(/\s+/g, '_');
    const age = userProfile.age || 'unknown';
    const iaf = userProfile.iaf ? userProfile.iaf.toFixed(1) : 'unknown';
    
    // Personality scores with single letter labels
    const o = p.openmindedness || p.openness || 0;
    const c = p.conscientiousness || 0;
    const e = p.extraversion || 0;
    const a = p.agreeableness || 0;
    const n = p.negativeemotionality || p.neuroticism || 0;
    
    const personality = `o${o}_c${c}_e${e}_a${a}_n${n}`;
    
    // Music condition
    let musicPart = 'no_music';
    if (musicCondition === 'music') {
      if (musicLink) {
        const cleanLink = musicLink
          .replace(/https?:\/\//g, '')
          .replace(/[^a-zA-Z0-9]/g, '_')
          .substring(0, 30);
        musicPart = `music_${cleanLink}`;
      } else {
        musicPart = 'music_unknown';
      }
    }
    
    // Use recording start time for the timestamp to make it unique
    const date = new Date(recordingStartTime || Date.now());
    const dateStr = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}_${String(date.getHours()).padStart(2, '0')}${String(date.getMinutes()).padStart(2, '0')}${String(date.getSeconds()).padStart(2, '0')}`;
    
    return `${name}_age${age}_iaf${iaf}_${personality}_${musicPart}_${dateStr}.csv`;
  };

  // Generate CSV content with multiple data points
  const generateCSV = (session) => {
    const { dataPoints } = session;
    
    // CSV Header - Only data columns, no user info
    let csv = 'Signal_Quality,Attention,Meditation,';
    csv += 'Delta,Theta,Alpha_Low,Alpha_High,Beta_Low,Beta_High,Gamma_Low,Gamma_High,';
    csv += 'PSD_6Hz,PSD_7Hz,PSD_8Hz,PSD_9Hz,PSD_10Hz,PSD_11Hz,PSD_12Hz,PSD_13Hz,PSD_14Hz\n';
    
    // Add each data point as a row
    if (dataPoints && dataPoints.length > 0) {
      dataPoints.forEach(point => {
        const { bandPowers, psdPoints, metrics } = point;
        
        // Metrics (Signal Quality, Attention, Meditation)
        csv += `${metrics.signalQuality || 0},`;
        csv += `${metrics.attention || 0},`;
        csv += `${metrics.meditation || 0},`;
        
        // 8 Band powers
        csv += `${bandPowers.Delta?.toExponential(4) || 'N/A'},`;
        csv += `${bandPowers.Theta?.toExponential(4) || 'N/A'},`;
        csv += `${bandPowers.AlphaLow?.toExponential(4) || 'N/A'},`;
        csv += `${bandPowers.AlphaHigh?.toExponential(4) || 'N/A'},`;
        csv += `${bandPowers.BetaLow?.toExponential(4) || 'N/A'},`;
        csv += `${bandPowers.BetaHigh?.toExponential(4) || 'N/A'},`;
        csv += `${bandPowers.GammaLow?.toExponential(4) || 'N/A'},`;
        csv += `${bandPowers.GammaHigh?.toExponential(4) || 'N/A'},`;
        
        // 9 PSD points (6-14 Hz)
        for (let freq = 6; freq <= 14; freq++) {
          const psdKey = `psd_${freq}hz`;
          csv += `${psdPoints[psdKey]?.toExponential(4) || 'N/A'}`;
          if (freq < 14) csv += ',';
        }
        csv += '\n';
      });
    }
    
    return csv;
  };

  // Export session to CSV - now accepts session object directly
  const exportSession = async (sessionOrId) => {
    try {
      // Handle both session object and session ID
      let session;
      if (typeof sessionOrId === 'string') {
        session = sessions.find(s => s.id === sessionOrId);
      } else {
        session = sessionOrId;
      }
      
      if (!session) {
        console.error('Session not found');
        return null;
      }

      const csv = generateCSV(session);
      const filename = generateFilename(session);
      const fileUri = FileSystem.documentDirectory + filename;

      await FileSystem.writeAsStringAsync(fileUri, csv, {
        encoding: 'utf8',
      });

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri, {
          mimeType: 'text/csv',
          dialogTitle: 'Export EEG Session Data',
          UTI: 'public.comma-separated-values-text'
        });
      } else {
        console.error('Sharing is not available on this device');
        return null;
      }

      return fileUri;
    } catch (error) {
      console.error('Error exporting CSV:', error);
      throw error;
    }
  };

  // Export all sessions
  const exportAllSessions = async () => {
    try {
      if (sessions.length === 0) {
        console.error('No sessions to export');
        return null;
      }

      // Create a combined CSV with all session data
      let combinedCSV = 'Session_ID,Timestamp,Signal_Quality,Attention,Meditation,';
      combinedCSV += 'Delta,Theta,Alpha_Low,Alpha_High,Beta_Low,Beta_High,Gamma_Low,Gamma_High,';
      combinedCSV += 'PSD_6Hz,PSD_7Hz,PSD_8Hz,PSD_9Hz,PSD_10Hz,PSD_11Hz,PSD_12Hz,PSD_13Hz,PSD_14Hz\n';
      
      sessions.forEach(session => {
        const { id, timestamp, dataPoints } = session;
        
        if (dataPoints && dataPoints.length > 0) {
          dataPoints.forEach(point => {
            const { bandPowers, psdPoints, metrics } = point;
            
            // Session metadata
            combinedCSV += `${id},${timestamp},`;
            
            // Metrics (Signal Quality, Attention, Meditation)
            combinedCSV += `${metrics.signalQuality || 0},`;
            combinedCSV += `${metrics.attention || 0},`;
            combinedCSV += `${metrics.meditation || 0},`;
            
            // 8 Band powers
            combinedCSV += `${bandPowers.Delta?.toExponential(4) || 'N/A'},`;
            combinedCSV += `${bandPowers.Theta?.toExponential(4) || 'N/A'},`;
            combinedCSV += `${bandPowers.AlphaLow?.toExponential(4) || 'N/A'},`;
            combinedCSV += `${bandPowers.AlphaHigh?.toExponential(4) || 'N/A'},`;
            combinedCSV += `${bandPowers.BetaLow?.toExponential(4) || 'N/A'},`;
            combinedCSV += `${bandPowers.BetaHigh?.toExponential(4) || 'N/A'},`;
            combinedCSV += `${bandPowers.GammaLow?.toExponential(4) || 'N/A'},`;
            combinedCSV += `${bandPowers.GammaHigh?.toExponential(4) || 'N/A'},`;
            
            // 9 PSD points (6-14 Hz)
            for (let freq = 6; freq <= 14; freq++) {
              const psdKey = `psd_${freq}hz`;
              combinedCSV += `${psdPoints[psdKey]?.toExponential(4) || 'N/A'}`;
              if (freq < 14) combinedCSV += ',';
            }
            combinedCSV += '\n';
          });
        }
      });

      const filename = `all_sessions_${Date.now()}.csv`;
      const fileUri = FileSystem.documentDirectory + filename;

      await FileSystem.writeAsStringAsync(fileUri, combinedCSV, {
        encoding: 'utf8',
      });

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri, {
          mimeType: 'text/csv',
          dialogTitle: 'Export All EEG Sessions',
          UTI: 'public.comma-separated-values-text'
        });
      }

      return fileUri;
    } catch (error) {
      console.error('Error exporting all sessions:', error);
      throw error;
    }
  };

  return (
    <EEGDataContext.Provider value={{ 
      sessions,
      isLoading,
      saveSession,
      deleteSession,
      clearAllSessions,
      exportSession,
      exportAllSessions
    }}>
      {children}
    </EEGDataContext.Provider>
  );
}

export const useEEGData = () => {
  const context = useContext(EEGDataContext);
  if (!context) {
    throw new Error('useEEGData must be used within EEGDataProvider');
  }
  return context;
};