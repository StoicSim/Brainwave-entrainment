import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Slot } from 'expo-router';
import { BleProvider } from '../context/BleContext';
import { UserProfileProvider } from '../context/UserProfileContext';
import { ResearchSessionProvider } from '../context/ResearchSessionContext';
import { EEGDataProvider } from '../context/EEGDataContext';

function LayoutContent() {
  return (
    <View style={styles.container}>
      <Slot />
    </View>
  );
}

export default function RootLayout() {
  return (
    <UserProfileProvider>
      <ResearchSessionProvider>
        <EEGDataProvider>
          <BleProvider>
            <LayoutContent />
          </BleProvider>
        </EEGDataProvider>
      </ResearchSessionProvider>
    </UserProfileProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});