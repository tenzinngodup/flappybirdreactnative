import { StyleSheet } from 'react-native';
import { ThemedView } from '@/components/ThemedView';
import GameScreen from '../game';

export default function GameTab() {
  return (
    <ThemedView style={styles.container}>
      <GameScreen />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});