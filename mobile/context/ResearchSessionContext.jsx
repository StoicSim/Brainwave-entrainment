import React, { createContext, useState, useContext } from 'react';

const ResearchSessionContext = createContext();

const createEmptySubject = () => ({
  subjectId: '',
  subjectName: '',
  age: '',
  gender: '',
  registrationDate: null,
  sessions: []
});

export function ResearchSessionProvider({ children }) {
  const [currentSubject, setCurrentSubject] = useState(createEmptySubject());
  const [allSubjects, setAllSubjects] = useState([]);
  const [currentSession, setCurrentSession] = useState(null);

  const updateSubjectInfo = (info) => {
    setCurrentSubject(prev => ({
      ...prev,
      ...info,
      registrationDate: prev.registrationDate || new Date().toISOString()
    }));
  };

  const isAssessmentComplete = () => {
    return !!(
      currentSubject.subjectId &&
      currentSubject.subjectName &&
      currentSubject.age &&
      currentSubject.gender
    );
  };

  const completeSubjectRegistration = () => {
    if (isAssessmentComplete()) {
      setAllSubjects(prev => [...prev, { ...currentSubject }]);
      return true;
    }
    return false;
  };

  const loadSubject = (subjectId) => {
    const subject = allSubjects.find(s => s.subjectId === subjectId);
    if (subject) {
      setCurrentSubject({ ...subject });
      return true;
    }
    return false;
  };

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

  const addRecordingCondition = (conditionData) => {
    if (!currentSession) return false;
    setCurrentSession(prev => ({
      ...prev,
      conditions: [...prev.conditions, conditionData]
    }));
    return true;
  };

  const completeRecordingSession = () => {
    if (!currentSession) return false;
    
    const updatedSubject = {
      ...currentSubject,
      sessions: [...currentSubject.sessions, currentSession]
    };
    
    setCurrentSubject(updatedSubject);
    setAllSubjects(prev => 
      prev.map(s => s.subjectId === updatedSubject.subjectId ? updatedSubject : s)
    );
    setCurrentSession(null);
    return true;
  };

  const exportToCSV = () => {
    const subjectsCSV = generateSubjectsCSV();
    const eegDataCSV = generateEEGDataCSV();
    const musicCodesCSV = generateMusicCodesCSV();
    return { subjectsCSV, eegDataCSV, musicCodesCSV };
  };

  const generateSubjectsCSV = () => {
    const headers = [
      'subject_id',
      'subject_name',
      'age',
      'gender',
      'registration_date',
    ];
    
    const rows = allSubjects.map(subject => [
      subject.subjectId,
      subject.subjectName,
      subject.age,
      subject.gender,
      subject.registrationDate?.split('T')[0] || '',
    ]);
    
    return [headers, ...rows].map(row => row.join(',')).join('\n');
  };

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
    
    return [headers, ...rows].map(row => row.join(',')).join('\n');
  };

  const generateMusicCodesCSV = () => {
    const headers = ['music_code', 'frequency_hz', 'description'];
    
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
      .map(item => [item.code, item.frequency, item.description]);
    
    return [headers, ...rows].map(row => row.join(',')).join('\n');
  };

  const getNextSubjectId = () => {
    if (allSubjects.length === 0) return 'S001';
    const numbers = allSubjects
      .map(s => parseInt(s.subjectId.replace('S', '')))
      .filter(n => !isNaN(n));
    const maxNum = Math.max(...numbers);
    return `S${String(maxNum + 1).padStart(3, '0')}`;
  };

  const resetCurrentSubject = () => {
    setCurrentSubject(createEmptySubject());
    setCurrentSession(null);
  };

  const getStats = () => {
    return {
      totalSubjects: allSubjects.length,
      totalSessions: allSubjects.reduce(
        (sum, subject) => sum + (subject.sessions?.length || 0), 0
      )
    };
  };

  return (
    <ResearchSessionContext.Provider value={{
      currentSubject,
      updateSubjectInfo,
      isAssessmentComplete,
      resetCurrentSubject,
      allSubjects,
      completeSubjectRegistration,
      loadSubject,
      getNextSubjectId,
      currentSession,
      startRecordingSession,
      addRecordingCondition,
      completeRecordingSession,
      exportToCSV,
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