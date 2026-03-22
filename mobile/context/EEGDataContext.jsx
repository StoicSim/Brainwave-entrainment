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
      }
    } catch (error) {
      console.warn('Error loading sessions:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const saveSessions = async (newSessions) => {
    try {
      await AsyncStorage.setItem('eegSessions', JSON.stringify(newSessions));
      setSessions(newSessions);
    } catch (error) {
      console.warn('Error saving sessions:', error);
    }
  };

  const saveSession = async (userProfile, dataPoints, recordingStartTime) => {
    const sessionId = `session_${Date.now()}`;
    const newSession = {
      id: sessionId,
      timestamp: new Date().toISOString(),
      recordingStartTime: recordingStartTime || Date.now(),
      userProfile: {
        name: userProfile.name || '',
        age: userProfile.age || '',
        gender: userProfile.gender || '',
        iaf: userProfile.iafCalibration?.iaf || null,
        personality: userProfile.personalityTest?.scores || {},
      },
      dataPoints,
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
    } catch (error) {
      console.warn('Error clearing sessions:', error);
    }
  };

  const generateFilename = (session) => {
    const name = (session.userProfile?.name || 'unknown').toLowerCase().replace(/\s+/g, '_');
    return `${name}_${session.id}.csv`;
  };

  // Safe personality getter — returns 0 if personality data doesn't exist
  const safePersonality = (userProfile) => {
    const p = userProfile?.personality || {};
    return {
      openness:          p.openmindedness || p.openness || 0,
      conscientiousness: p.conscientiousness || 0,
      extraversion:      p.extraversion || 0,
      agreeableness:     p.agreeableness || 0,
      neuroticism:       p.negativeemotionality || p.neuroticism || 0,
    };
  };

  const generateCSV = (session) => {
    const { userProfile, dataPoints } = session;
    const p = safePersonality(userProfile);

    let csv = 'Timestamp,Session_ID,Name,Age,Gender,IAF,Openness,Conscientiousness,Extraversion,Agreeableness,Neuroticism,';
    csv += 'Session_Type,Music_Link,';
    csv += 'Signal_Quality,Attention,Meditation,';
    csv += 'Delta,Theta,Alpha_Low,Alpha_High,Beta_Low,Beta_High,Gamma_Low,Gamma_High,';
    csv += 'PSD_6Hz,PSD_7Hz,PSD_8Hz,PSD_9Hz,PSD_10Hz,PSD_11Hz,PSD_12Hz,PSD_13Hz,PSD_14Hz\n';

    if (dataPoints && dataPoints.length > 0) {
      dataPoints.forEach(point => {
        const { timestamp, sessionType, musicLink, bandPowers, psdPoints, metrics } = point;

        csv += `${timestamp},`;
        csv += `${session.id},`;
        csv += `${userProfile?.name || ''},`;
        csv += `${userProfile?.age || ''},`;
        csv += `${userProfile?.gender || ''},`;
        csv += `${userProfile?.iaf?.toFixed(2) || 'N/A'},`;
        csv += `${p.openness},`;
        csv += `${p.conscientiousness},`;
        csv += `${p.extraversion},`;
        csv += `${p.agreeableness},`;
        csv += `${p.neuroticism},`;

        csv += `${sessionType || ''},`;
        csv += `${musicLink || ''},`;

        csv += `${metrics?.signalQuality || 0},`;
        csv += `${metrics?.attention || 0},`;
        csv += `${metrics?.meditation || 0},`;

        csv += `${bandPowers?.Delta?.toExponential(4) || 'N/A'},`;
        csv += `${bandPowers?.Theta?.toExponential(4) || 'N/A'},`;
        csv += `${bandPowers?.AlphaLow?.toExponential(4) || 'N/A'},`;
        csv += `${bandPowers?.AlphaHigh?.toExponential(4) || 'N/A'},`;
        csv += `${bandPowers?.BetaLow?.toExponential(4) || 'N/A'},`;
        csv += `${bandPowers?.BetaHigh?.toExponential(4) || 'N/A'},`;
        csv += `${bandPowers?.GammaLow?.toExponential(4) || 'N/A'},`;
        csv += `${bandPowers?.GammaHigh?.toExponential(4) || 'N/A'},`;

        for (let freq = 6; freq <= 14; freq++) {
          csv += `${psdPoints?.[`psd_${freq}hz`]?.toExponential(4) || 'N/A'}`;
          if (freq < 14) csv += ',';
        }
        csv += '\n';
      });
    }

    return csv;
  };

  const exportSession = async (sessionOrId) => {
    try {
      let session;
      if (typeof sessionOrId === 'string') {
        session = sessions.find(s => s.id === sessionOrId);
      } else {
        session = sessionOrId;
      }

      if (!session) {
        console.warn('Session not found');
        return null;
      }

      const csv = generateCSV(session);
      const filename = generateFilename(session);
      const fileUri = FileSystem.documentDirectory + filename;

      await FileSystem.writeAsStringAsync(fileUri, csv, { encoding: 'utf8' });

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri, {
          mimeType: 'text/csv',
          dialogTitle: 'Export EEG Session Data',
          UTI: 'public.comma-separated-values-text'
        });
      }

      return fileUri;
    } catch (error) {
      console.warn('Error exporting CSV:', error);
      throw error;
    }
  };

  const exportAllSessions = async (customSessions) => {
    try {
      const toExport = customSessions || sessions;
      if (toExport.length === 0) {
        console.warn('No sessions to export');
        return null;
      }

      let combinedCSV = 'Timestamp,Session_ID,Name,Age,Gender,IAF,Openness,Conscientiousness,Extraversion,Agreeableness,Neuroticism,';
      combinedCSV += 'Session_Type,Music_Link,';
      combinedCSV += 'Signal_Quality,Attention,Meditation,';
      combinedCSV += 'Delta,Theta,Alpha_Low,Alpha_High,Beta_Low,Beta_High,Gamma_Low,Gamma_High,';
      combinedCSV += 'PSD_6Hz,PSD_7Hz,PSD_8Hz,PSD_9Hz,PSD_10Hz,PSD_11Hz,PSD_12Hz,PSD_13Hz,PSD_14Hz\n';

      toExport.forEach(session => {
        const { id, userProfile, dataPoints } = session;
        const p = safePersonality(userProfile);

        if (dataPoints && dataPoints.length > 0) {
          dataPoints.forEach(point => {
            const { timestamp, sessionType, musicLink, bandPowers, psdPoints, metrics } = point;

            combinedCSV += `${timestamp},`;
            combinedCSV += `${id},`;
            combinedCSV += `${userProfile?.name || ''},`;
            combinedCSV += `${userProfile?.age || ''},`;
            combinedCSV += `${userProfile?.gender || ''},`;
            combinedCSV += `${userProfile?.iaf?.toFixed(2) || 'N/A'},`;
            combinedCSV += `${p.openness},`;
            combinedCSV += `${p.conscientiousness},`;
            combinedCSV += `${p.extraversion},`;
            combinedCSV += `${p.agreeableness},`;
            combinedCSV += `${p.neuroticism},`;

            combinedCSV += `${sessionType || ''},`;
            combinedCSV += `${musicLink || ''},`;

            combinedCSV += `${metrics?.signalQuality || 0},`;
            combinedCSV += `${metrics?.attention || 0},`;
            combinedCSV += `${metrics?.meditation || 0},`;

            combinedCSV += `${bandPowers?.Delta?.toExponential(4) || 'N/A'},`;
            combinedCSV += `${bandPowers?.Theta?.toExponential(4) || 'N/A'},`;
            combinedCSV += `${bandPowers?.AlphaLow?.toExponential(4) || 'N/A'},`;
            combinedCSV += `${bandPowers?.AlphaHigh?.toExponential(4) || 'N/A'},`;
            combinedCSV += `${bandPowers?.BetaLow?.toExponential(4) || 'N/A'},`;
            combinedCSV += `${bandPowers?.BetaHigh?.toExponential(4) || 'N/A'},`;
            combinedCSV += `${bandPowers?.GammaLow?.toExponential(4) || 'N/A'},`;
            combinedCSV += `${bandPowers?.GammaHigh?.toExponential(4) || 'N/A'},`;

            for (let freq = 6; freq <= 14; freq++) {
              combinedCSV += `${psdPoints?.[`psd_${freq}hz`]?.toExponential(4) || 'N/A'}`;
              if (freq < 14) combinedCSV += ',';
            }
            combinedCSV += '\n';
          });
        }
      });

      const filename = `eeg_all_sessions_${Date.now()}.csv`;
      const fileUri = FileSystem.documentDirectory + filename;

      await FileSystem.writeAsStringAsync(fileUri, combinedCSV, { encoding: 'utf8' });

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri, {
          mimeType: 'text/csv',
          dialogTitle: 'Export All EEG Sessions',
          UTI: 'public.comma-separated-values-text'
        });
      }

      return fileUri;
    } catch (error) {
      console.warn('Error exporting all sessions:', error);
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
      exportAllSessions,
    }}>
      {children}
    </EEGDataContext.Provider>
  );
}

export const useEEGData = () => {
  const context = useContext(EEGDataContext);
  if (!context) throw new Error('useEEGData must be used within EEGDataProvider');
  return context;
};
