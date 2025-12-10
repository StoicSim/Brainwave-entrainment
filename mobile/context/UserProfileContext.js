import React, { createContext, useState, useEffect, useContext } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
// Or use: import * as SecureStore from 'expo-secure-store';

const UserProfileContext = createContext();

export function UserProfileProvider({ children }) {
  const [userProfile, setUserProfile] = useState({
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
  });

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const stored = await AsyncStorage.getItem('userProfile');
      if (stored) {
        setUserProfile(JSON.parse(stored));
      }
    } catch (error) {
      console.error('Error loading profile:', error);
    }
  };

  const saveProfile = async (profile) => {
    try {
      await AsyncStorage.setItem('userProfile', JSON.stringify(profile));
      setUserProfile(profile);
    } catch (error) {
      console.error('Error saving profile:', error);
    }
  };

  const updateProfile = (updates) => {
    const updated = { ...userProfile, ...updates };
    saveProfile(updated);
  };

  const isSetupComplete = () => {
    return userProfile.personalityTest.completed && 
           userProfile.iafCalibration.completed &&
           userProfile.name && 
           userProfile.age && 
           userProfile.gender;
  };

  return (
    <UserProfileContext.Provider value={{ 
      userProfile, 
      updateProfile, 
      isSetupComplete 
    }}>
      {children}
    </UserProfileContext.Provider>
  );
}

export const useUserProfile = () => useContext(UserProfileContext);