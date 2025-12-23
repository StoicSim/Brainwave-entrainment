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

  // Save a complete session with combined data points
  const saveSession = async (userProfile, dataPoints, recordingStartTime) => {
    const sessionId = `session_${Date.now()}`;
    
    const newSession = {
      id: sessionId,
      timestamp: new Date().toISOString(),
      recordingStartTime: recordingStartTime || Date.now(),
      userProfile: {
        name: userProfile.name,
        age: userProfile.age,
        iaf: userProfile.iafCalibration?.iaf || null,
        personality: userProfile.personalityTest?.scores || {}
      },
      dataPoints, // Array with both no_music and music data
    };
    
    const updated = [...sessions, newSession];
    await saveSessions(updated);
    
    return newSession;
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

  // Generate simplified filename: username_sessionid.csv
  const generateFilename = (session) => {
    const { userProfile, id } = session;
    const name = (userProfile.name || 'unknown').toLowerCase().replace(/\s+/g, '_');
    return `${name}_${id}.csv`;
  };

  // Generate CSV with metadata columns and absolute timestamps
  const generateCSV = (session) => {
    const { userProfile, dataPoints } = session;
    const p = userProfile.personality;
    
    // CSV Header with all metadata and data columns
    let csv = 'Timestamp,Session_ID,Name,Age,IAF,Openness,Conscientiousness,Extraversion,Agreeableness,Neuroticism,';
    csv += 'Session_Type,Music_Link,';
    csv += 'Signal_Quality,Attention,Meditation,';
    csv += 'Delta,Theta,Alpha_Low,Alpha_High,Beta_Low,Beta_High,Gamma_Low,Gamma_High,';
    csv += 'PSD_6Hz,PSD_7Hz,PSD_8Hz,PSD_9Hz,PSD_10Hz,PSD_11Hz,PSD_12Hz,PSD_13Hz,PSD_14Hz\n';
    
    // Add each data point as a row with full metadata
    if (dataPoints && dataPoints.length > 0) {
      dataPoints.forEach(point => {
        const { timestamp, sessionType, musicLink, bandPowers, psdPoints, metrics } = point;
        
        // Timestamp (absolute ISO format)
        csv += `${timestamp},`;
        
        // Session and User Metadata
        csv += `${session.id},`;
        csv += `${userProfile.name},`;
        csv += `${userProfile.age},`;
        csv += `${userProfile.iaf?.toFixed(2) || 'N/A'},`;
        csv += `${p.openmindedness || p.openness || 0},`;
        csv += `${p.conscientiousness || 0},`;
        csv += `${p.extraversion || 0},`;
        csv += `${p.agreeableness || 0},`;
        csv += `${p.negativeemotionality || p.neuroticism || 0},`;
        
        // Session Type and Music Link
        csv += `${sessionType},`;
        csv += `${musicLink || ''},`;
        
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

  // Export session to CSV
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

  // Export all sessions into a single combined CSV
  const exportAllSessions = async () => {
    try {
      if (sessions.length === 0) {
        console.error('No sessions to export');
        return null;
      }

      // Create a combined CSV with all session data
      let combinedCSV = 'Timestamp,Session_ID,Name,Age,IAF,Openness,Conscientiousness,Extraversion,Agreeableness,Neuroticism,';
      combinedCSV += 'Session_Type,Music_Link,';
      combinedCSV += 'Signal_Quality,Attention,Meditation,';
      combinedCSV += 'Delta,Theta,Alpha_Low,Alpha_High,Beta_Low,Beta_High,Gamma_Low,Gamma_High,';
      combinedCSV += 'PSD_6Hz,PSD_7Hz,PSD_8Hz,PSD_9Hz,PSD_10Hz,PSD_11Hz,PSD_12Hz,PSD_13Hz,PSD_14Hz\n';
      
      sessions.forEach(session => {
        const { id, userProfile, dataPoints } = session;
        const p = userProfile.personality;
        
        if (dataPoints && dataPoints.length > 0) {
          dataPoints.forEach(point => {
            const { timestamp, sessionType, musicLink, bandPowers, psdPoints, metrics } = point;
            
            // Timestamp
            combinedCSV += `${timestamp},`;
            
            // Session and User Metadata
            combinedCSV += `${id},`;
            combinedCSV += `${userProfile.name},`;
            combinedCSV += `${userProfile.age},`;
            combinedCSV += `${userProfile.iaf?.toFixed(2) || 'N/A'},`;
            combinedCSV += `${p.openmindedness || p.openness || 0},`;
            combinedCSV += `${p.conscientiousness || 0},`;
            combinedCSV += `${p.extraversion || 0},`;
            combinedCSV += `${p.agreeableness || 0},`;
            combinedCSV += `${p.negativeemotionality || p.neuroticism || 0},`;
            
            // Session Type and Music Link
            combinedCSV += `${sessionType},`;
            combinedCSV += `${musicLink || ''},`;
            
            // Metrics
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
            
            // 9 PSD points
            for (let freq = 6; freq <= 14; freq++) {
              const psdKey = `psd_${freq}hz`;
              combinedCSV += `${psdPoints[psdKey]?.toExponential(4) || 'N/A'}`;
              if (freq < 14) combinedCSV += ',';
            }
            combinedCSV += '\n';
          });
        }
      });

      const timestamp = Date.now();
      const filename = `eeg_all_sessions_${timestamp}.csv`;
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