import React, { createContext, useState, useContext } from 'react';

const ResearchSessionContext = createContext();

// Structure for a single subject's data
const createEmptySubject = () => ({
  // Basic Info
  subjectId: '',
  subjectName: '',
  age: '',
  gender: '',
  registrationDate: null,
  
  // Assessment Data
  personalityTest: {
    completed: false,
    timestamp: null,
    scores: {
      openmindedness: null,
      conscientiousness: null,
      extraversion: null,
      agreeableness: null,
      negativeemotionality: null
    }
  },
  
  iafCalibration: {
    completed: false,
    timestamp: null,
    iaf: null
  },
  
  // Recording Sessions
  sessions: []
  // Each session = { 
  //   sessionId, 
  //   date, 
  //   conditions: [{ musicCode, audioFile, duration, dataPoints: [...] }] 
  // }
});

export function ResearchSessionProvider({ children }) {
  // Current subject being registered/assessed
  const [currentSubject, setCurrentSubject] = useState(createEmptySubject());
  
  // All registered subjects (for multi-subject management)
  const [allSubjects, setAllSubjects] = useState([]);
  
  // Current recording session state
  const [currentSession, setCurrentSession] = useState(null);

  // Update current subject's basic info
  const updateSubjectInfo = (info) => {
    setCurrentSubject(prev => ({
      ...prev,
      ...info,
      registrationDate: prev.registrationDate || new Date().toISOString()
    }));
  };

  // Save personality test results
  const savePersonalityTest = (scores) => {
    setCurrentSubject(prev => ({
      ...prev,
      personalityTest: {
        completed: true,
        timestamp: new Date().toISOString(),
        scores: scores
      }
    }));
  };

  // Save IAF calibration results
  const saveIAFCalibration = (iafData) => {
    setCurrentSubject(prev => ({
      ...prev,
      iafCalibration: {
        completed: true,
        timestamp: new Date().toISOString(),
        iaf: iafData.iaf
      }
    }));
  };

  // Check if current subject's assessment is complete
  const isAssessmentComplete = () => {
    return (
      currentSubject.subjectId &&
      currentSubject.subjectName &&
      currentSubject.age &&
      currentSubject.gender &&
      currentSubject.personalityTest.completed &&
      currentSubject.iafCalibration.completed
    );
  };

  // Complete subject registration and add to subjects list
  const completeSubjectRegistration = () => {
    if (isAssessmentComplete()) {
      setAllSubjects(prev => [...prev, { ...currentSubject }]);
      return true;
    }
    return false;
  };

  // Load existing subject for new recording session
  const loadSubject = (subjectId) => {
    const subject = allSubjects.find(s => s.subjectId === subjectId);
    if (subject) {
      setCurrentSubject({ ...subject });
      return true;
    }
    return false;
  };

  // Start new recording session
  const startRecordingSession = () => {
    const sessionId = `session_${Date.now()}`;
    const newSession = {
      sessionId,
      subjectId: currentSubject.subjectId,
      date: new Date().toISOString(),
      conditions: []
    };
    setCurrentSession(newSession);
    return sessionId;
  };

  // Add recording condition to current session
  const addRecordingCondition = (conditionData) => {
    if (!currentSession) return false;
    
    setCurrentSession(prev => ({
      ...prev,
      conditions: [...prev.conditions, conditionData]
    }));
    return true;
  };

  // Complete recording session and save to subject
  const completeRecordingSession = () => {
    if (!currentSession) return false;
    
    // Update subject with new session
    const updatedSubject = {
      ...currentSubject,
      sessions: [...currentSubject.sessions, currentSession]
    };
    
    setCurrentSubject(updatedSubject);
    
    // Update in all subjects list
    setAllSubjects(prev => 
      prev.map(s => 
        s.subjectId === updatedSubject.subjectId ? updatedSubject : s
      )
    );
    
    setCurrentSession(null);
    return true;
  };

  // Export data as CSV format
  const exportToCSV = () => {
    // This will be implemented in the export screen
    // Returns formatted CSV strings for:
    // 1. subjects_info.csv
    // 2. eeg_data.csv
    // 3. music_codes.csv
    
    const subjectsCSV = generateSubjectsCSV();
    const eegDataCSV = generateEEGDataCSV();
    const musicCodesCSV = generateMusicCodesCSV();
    
    return {
      subjectsCSV,
      eegDataCSV,
      musicCodesCSV
    };
  };

  // Generate subjects_info.csv content
  const generateSubjectsCSV = () => {
    const headers = [
      'subject_id',
      'subject_name',
      'age',
      'gender',
      'test_date',
      'openness',
      'conscientiousness',
      'extraversion',
      'agreeableness',
      'neuroticism',
      'iaf_frequency'
    ];
    
    const rows = allSubjects.map(subject => [
      subject.subjectId,
      subject.subjectName,
      subject.age,
      subject.gender,
      subject.personalityTest.timestamp?.split('T')[0] || '',
      subject.personalityTest.scores.openmindedness || '',
      subject.personalityTest.scores.conscientiousness || '',
      subject.personalityTest.scores.extraversion || '',
      subject.personalityTest.scores.agreeableness || '',
      subject.personalityTest.scores.negativeemotionality || '',
      subject.iafCalibration.iaf || ''
    ]);
    
    return [headers, ...rows]
      .map(row => row.join(','))
      .join('\n');
  };

  // Generate eeg_data.csv content
  const generateEEGDataCSV = () => {
    const headers = [
      'subject_id',
      'session_id',
      'condition_type',
      'music_code',
      'timestamp',
      'alpha_power',
      'beta_power',
      'theta_power',
      'delta_power'
    ];
    
    const rows = [];
    allSubjects.forEach(subject => {
      subject.sessions?.forEach(session => {
        session.conditions?.forEach(condition => {
          condition.dataPoints?.forEach(dataPoint => {
            rows.push([
              subject.subjectId,
              session.sessionId,
              condition.conditionType || 'music',
              condition.musicCode || '',
              dataPoint.timestamp || '',
              dataPoint.alphaPower || '',
              dataPoint.betaPower || '',
              dataPoint.thetaPower || '',
              dataPoint.deltaPower || ''
            ]);
          });
        });
      });
    });
    
    return [headers, ...rows]
      .map(row => row.join(','))
      .join('\n');
  };

  // Generate music_codes.csv content
  const generateMusicCodesCSV = () => {
    const headers = [
      'music_code',
      'frequency_hz',
      'description'
    ];
    
    // Collect unique music codes from all sessions
    const musicCodes = new Set();
    allSubjects.forEach(subject => {
      subject.sessions?.forEach(session => {
        session.conditions?.forEach(condition => {
          if (condition.musicCode) {
            musicCodes.add(JSON.stringify({
              code: condition.musicCode,
              frequency: condition.frequency || '',
              description: condition.description || ''
            }));
          }
        });
      });
    });
    
    const rows = Array.from(musicCodes)
      .map(item => JSON.parse(item))
      .map(item => [
        item.code,
        item.frequency,
        item.description
      ]);
    
    return [headers, ...rows]
      .map(row => row.join(','))
      .join('\n');
  };

  // Get next available subject ID
  const getNextSubjectId = () => {
    if (allSubjects.length === 0) {
      return 'S001';
    }
    
    // Extract numbers from existing IDs and find max
    const numbers = allSubjects
      .map(s => parseInt(s.subjectId.replace('S', '')))
      .filter(n => !isNaN(n));
    
    const maxNum = Math.max(...numbers);
    return `S${String(maxNum + 1).padStart(3, '0')}`;
  };

  // Reset current subject (start fresh)
  const resetCurrentSubject = () => {
    setCurrentSubject(createEmptySubject());
    setCurrentSession(null);
  };

  // Get statistics
  const getStats = () => {
    const totalSubjects = allSubjects.length;
    const totalSessions = allSubjects.reduce(
      (sum, subject) => sum + (subject.sessions?.length || 0), 
      0
    );
    
    return {
      totalSubjects,
      totalSessions
    };
  };

  return (
    <ResearchSessionContext.Provider value={{
      // Current subject state
      currentSubject,
      updateSubjectInfo,
      savePersonalityTest,
      saveIAFCalibration,
      isAssessmentComplete,
      resetCurrentSubject,
      
      // Subject management
      allSubjects,
      completeSubjectRegistration,
      loadSubject,
      getNextSubjectId,
      
      // Recording session
      currentSession,
      startRecordingSession,
      addRecordingCondition,
      completeRecordingSession,
      
      // Export
      exportToCSV,
      
      // Stats
      getStats
    }}>
      {children}
    </ResearchSessionContext.Provider>
  );
}

export const useResearchSession = () => {
  const context = useContext(ResearchSessionContext);
  if (!context) {
    throw new Error('useResearchSession must be used within ResearchSessionProvider');
  }
  return context;
};