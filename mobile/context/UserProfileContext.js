import React, { createContext, useState, useEffect, useContext } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const UserProfileContext = createContext();

// ⚠️ CHANGE THIS to your deployed backend URL
const API_BASE_URL = 'http://localhost:8000'; 
// After deployment: 'https://your-app.onrender.com'

const EMPTY_PROFILE = {
  profileComplete: false,
  name: '',
  age: '',
  gender: '',
  personalityTest: {
    completed: false,
    timestamp: null,
    scores: {}
  },
  iafCalibration: {
    completed: false,
    timestamp: null,
    iaf: null
  }
};

export function UserProfileProvider({ children }) {
  const [userProfile, setUserProfile] = useState(EMPTY_PROFILE);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      console.log('🔍 Fetching user data from backend...');
      
      // Fetch from backend
      const response = await fetch(`${API_BASE_URL}/user/user_001`);
      
      if (response.ok) {
        const data = await response.json();
        setUserProfile(data);
        console.log('✅ User data fetched from backend:', data);
        
        // Save to local storage as backup
        await AsyncStorage.setItem('userProfile', JSON.stringify(data));
      } else {
        throw new Error('Failed to fetch from backend');
      }
      
    } catch (error) {
      console.log('⚠️ Backend fetch failed, trying local storage...');
      
      // Fallback to local storage
      const stored = await AsyncStorage.getItem('userProfile');
      if (stored) {
        const parsed = JSON.parse(stored);
        setUserProfile(parsed);
        console.log('📱 Loaded from local storage');
      } else {
        console.log('No data found, using empty profile');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const saveProfile = async (profile) => {
    try {
      await AsyncStorage.setItem('userProfile', JSON.stringify(profile));
      setUserProfile(profile);
      console.log('Profile saved:', profile);
    } catch (error) {
      console.error('Error saving profile:', error);
    }
  };

  const updateProfile = (updates) => {
    const updated = { ...userProfile, ...updates };
    updated.profileComplete = 
      updated.name && 
      updated.age && 
      updated.gender &&
      updated.personalityTest.completed &&
      updated.iafCalibration.completed;
    saveProfile(updated);
  };

  const isSetupComplete = () => {
    return userProfile.profileComplete ||
           (userProfile.name && 
            userProfile.age && 
            userProfile.gender &&
            userProfile.personalityTest.completed &&
            userProfile.iafCalibration.completed);
  };

  const loadDemoData = () => {
    const DEMO_USER = {
      profileComplete: true,
      name: "Simran",
      age: "23",
      gender: "F",
      personalityTest: {
        completed: true,
        timestamp: "2024-12-10T10:30:00",
        scores: {
          openness: 75,
          conscientiousness: 82,
          extraversion: 68,
          agreeableness: 79,
          neuroticism: 45
        }
      },
      iafCalibration: {
        completed: true,
        timestamp: "2024-12-10T11:00:00",
        iaf: 10.2
      }
    };
    saveProfile(DEMO_USER);
  };

  const resetProfile = async () => {
    try {
      await AsyncStorage.removeItem('userProfile');
      setUserProfile(EMPTY_PROFILE);
      console.log('Profile reset to empty state');
    } catch (error) {
      console.error('Error resetting profile:', error);
    }
  };

  return (
    <UserProfileContext.Provider value={{ 
      userProfile, 
      updateProfile, 
      isSetupComplete,
      loadDemoData,
      resetProfile,
      isLoading
    }}>
      {children}
    </UserProfileContext.Provider>
  );
}

export const useUserProfile = () => {
  const context = useContext(UserProfileContext);
  if (!context) {
    throw new Error('useUserProfile must be used within UserProfileProvider');
  }
  return context;
};