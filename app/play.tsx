import React from 'react';
import { StyleSheet, View, TouchableOpacity } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { ThemedText } from '@/components/ThemedText';
import GameScreen from './game';

export default function PlayGame() {
  const router = useRouter();
  
  return (
    <View style={styles.container}>
      <Stack.Screen options={{ 
        headerShown: false,
      }} />
      
      <GameScreen />
      
      {/* Home button (optional) */}
      <TouchableOpacity 
        style={styles.homeButton}
        onPress={() => router.push('/')}
      >
        <ThemedText style={styles.homeButtonText}>Home</ThemedText>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  homeButton: {
    position: 'absolute',
    top: 40,
    right: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingVertical: 8,
    paddingHorizontal: 15,
    borderRadius: 20,
  },
  homeButtonText: {
    color: 'white',
    fontWeight: 'bold',
  }
}); 