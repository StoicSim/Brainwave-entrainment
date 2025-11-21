import { StyleSheet, Text, View } from 'react-native'
import React from 'react'
import {Link} from 'expo-router';

const Home = () => {
  return (
    <View style={styles.container}>
      <Text>Home screen</Text>
      <Link href="/about">aboutPage</Link>
      <Text>Hello heloo</Text>
    </View>
  )
}

export default Home

const styles = StyleSheet.create({
  container: {
    flex: 1,               // take full height
    justifyContent: 'center', // vertical center
    alignItems: 'center',      // horizontal center
  },
})
