import React, { useState, useEffect } from 'react';
import { View, Text, Button, ScrollView, StyleSheet } from 'react-native';
// Import the core functions from your service file
import { scanAndConnect, connectAndMonitor, disconnectDevice } from '../services/BleService'; 

export default function BleScreen() {
  const [status, setStatus] = useState('Disconnected');
  const [device, setDevice] = useState(null);
  const [data, setData] = useState([]);
  
  // Clean up connection when component is unmounted
  useEffect(() => {
    return () => {
      if (device) {
        disconnectDevice(device);
      }
    };
  }, [device]);

  const handleScan = async () => {
    setStatus('Scanning...');
    setData([]); // Clear old data

    try {
      await scanAndConnect(async (foundDevice) => {
        setStatus(`Found ${foundDevice.name}. Connecting...`);
        setDevice(foundDevice);

        // Start connection and data monitoring
        await connectAndMonitor(
          foundDevice, 
          (base64Data) => {
            // Function to handle streaming data
            // In a real app, you would decode this data (e.g., using Buffer)
            const newData = `[${new Date().toLocaleTimeString()}] Data: ${base64Data.substring(0, 15)}...`;
            setData(prev => [newData, ...prev]);
            setStatus('Streaming Data');
          }
        );
      });
    } catch (error) {
      setStatus(`Error: ${error.message}`);
      console.error(error);
    }
  };
  
  const handleDisconnect = () => {
    if (device) {
        disconnectDevice(device);
        setDevice(null);
        setStatus('Disconnected');
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.header}>BLE Device Status</Text>
      <Text style={styles.statusText}>Status: {status}</Text>
      
      <View style={styles.buttonContainer}>
        <Button 
          title="Scan & Connect" 
          onPress={handleScan} 
          disabled={status === 'Scanning...' || status === 'Streaming Data'} 
        />
        <Button 
          title="Disconnect" 
          onPress={handleDisconnect} 
          disabled={!device}
          color="red"
        />
      </View>

      <Text style={styles.dataHeader}>--- Last 10 Data Samples ---</Text>
      <ScrollView style={styles.dataContainer}>
        {data.slice(0, 10).map((d, index) => (
          <Text key={index} style={styles.dataItem}>{d}</Text>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
    container: { flex: 1, padding: 20, paddingTop: 50, backgroundColor: '#f0f0f0' },
    header: { fontSize: 24, fontWeight: 'bold', marginBottom: 10 },
    statusText: { fontSize: 18, marginVertical: 10, color: 'blue' },
    buttonContainer: { flexDirection: 'row', justifyContent: 'space-around', marginVertical: 20 },
    dataHeader: { marginTop: 20, fontSize: 16, fontWeight: 'bold' },
    dataContainer: { flex: 1, backgroundColor: '#fff', padding: 10, borderRadius: 5 },
    dataItem: { fontSize: 14, borderBottomWidth: 1, borderBottomColor: '#eee', paddingVertical: 5 },
});