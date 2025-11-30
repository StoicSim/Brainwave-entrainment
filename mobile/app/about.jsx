import { StyleSheet, Text, View } from 'react-native'
import React from 'react'
import {Link} from 'expo-router';


const about = () => {
  return (
    <View style={styles.container}>
      <Text>about</Text>
            <Link href="/">Back home</Link>
      
    </View>
  )
}

export default about

const styles = StyleSheet.create({
  container: {
    flex: 1,              
    justifyContent: 'center', 
    alignItems: 'center',     
  },
})