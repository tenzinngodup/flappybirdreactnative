import React, { useState, useEffect, useRef } from 'react';
import { 
  StyleSheet, 
  View, 
  Text, 
  TouchableWithoutFeedback, 
  Dimensions, 
  Animated, 
  Image,
  StatusBar,
  TouchableOpacity,
  Platform
} from 'react-native';
import { Stack } from 'expo-router';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const GRAVITY = 0.4;
const BIRD_WIDTH = 50;
const BIRD_HEIGHT = 35;
const PIPE_WIDTH = 60;
const PIPE_GAP = 220;
const PIPE_SPEED = 1.8;
const FLAP_POWER = -9;
const SCREEN_WIDTH = Dimensions.get('window').width;
const SCREEN_HEIGHT = Dimensions.get('window').height;
const PIPE_SPAWN_DISTANCE = 250;

// Define the pipe type to fix type errors
interface Pipe {
  x: number;
  topHeight: number;
  bottomHeight: number;
  passed: boolean;
}

export default function GameScreen() {
  // Get safe area insets
  const insets = useSafeAreaInsets();
  
  // Game states
  const [gameStarted, setGameStarted] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [score, setScore] = useState(0);
  const [bestScore, setBestScore] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  
  // Use refs to track current state to avoid stale closures
  const isGameOver = useRef(false);
  const isGamePaused = useRef(false);
  
  // Update refs when state changes
  useEffect(() => {
    isGameOver.current = gameOver;
  }, [gameOver]);
  
  useEffect(() => {
    isGamePaused.current = isPaused;
  }, [isPaused]);
  
  // Bird position and velocity
  const birdPosition = useRef({
    x: new Animated.Value(SCREEN_WIDTH / 3),
    y: new Animated.Value(SCREEN_HEIGHT / 2.5)
  }).current;
  const birdVelocity = useRef(0);
  const birdRotation = useRef(new Animated.Value(0)).current;
  
  // Pipes - specify the type to fix "never" errors
  const [pipes, setPipes] = useState<Pipe[]>([]);
  const pipesRef = useRef<Pipe[]>([]);
  pipesRef.current = pipes;
  
  // Animation frame
  const animationFrameId = useRef<number | null>(null);
  
  // Flap animation
  const [isFlapping, setIsFlapping] = useState(false);
  
  // Create dynamic styles that depend on insets
  const dynamicStyles = {
    score: {
      position: 'absolute' as const,
      top: 50 + (insets?.top || 0),
      left: 0,
      right: 0,
      textAlign: 'center' as const,
      fontSize: 60,
      fontWeight: 'bold' as const,
      color: 'white',
      textShadowColor: 'rgba(0, 0, 0, 0.5)',
      textShadowOffset: { width: 2, height: 2 },
      textShadowRadius: 5,
    },
    pauseButton: {
      position: 'absolute' as const,
      top: (insets?.top || 0) + 10,
      right: 20,
      backgroundColor: 'rgba(0,0,0,0.3)',
      width: 44,
      height: 44,
      borderRadius: 22,
      justifyContent: 'center' as const,
      alignItems: 'center' as const,
      zIndex: 10,
    }
  };
  
  // Initialize game
  useEffect(() => {
    return () => {
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
      }
    };
  }, []);
  
  // Game loop
  const gameLoop = () => {
    // Use ref values instead of closure values
    if (isGameOver.current || isGamePaused.current) {
      return; // Exit early if game is over or paused
    }
    
    // Update bird position
    birdVelocity.current += GRAVITY;
    const currentY = birdPosition.y._value;
    birdPosition.y.setValue(currentY + birdVelocity.current);
    
    // Rotate bird based on velocity
    birdRotation.setValue(Math.min(Math.max(-30, birdVelocity.current * 3), 90));
    
    // Check collisions
    const birdBox = {
      left: birdPosition.x._value,
      right: birdPosition.x._value + BIRD_WIDTH,
      top: birdPosition.y._value,
      bottom: birdPosition.y._value + BIRD_HEIGHT
    };
    
    // Check if bird hits the ground or ceiling
    if (birdBox.bottom > SCREEN_HEIGHT - 50 || birdBox.top < 0) {
      endGame();
      return;
    }
    
    // Update pipes and check collisions
    const newPipes = [...pipesRef.current];
    
    // Update the pipe generation to make the game easier at the start
    // Add new pipes
    if (newPipes.length === 0 || newPipes[newPipes.length - 1].x < SCREEN_WIDTH - PIPE_SPAWN_DISTANCE) {
      // Make the first few pipes easier
      let pipeGap = PIPE_GAP;
      if (score < 3) {
        pipeGap = PIPE_GAP + 50; // Extra wide gap for first few pipes
      }
      
      const pipeHeight = Math.floor(Math.random() * (SCREEN_HEIGHT - pipeGap - 200)) + 100;
      newPipes.push({
        x: SCREEN_WIDTH,
        topHeight: pipeHeight,
        bottomHeight: SCREEN_HEIGHT - pipeHeight - pipeGap,
        passed: false
      });
    }
    
    // Move pipes and check collisions
    for (let i = 0; i < newPipes.length; i++) {
      newPipes[i].x -= PIPE_SPEED;
      
      // Remove pipes that are off screen
      if (newPipes[i].x < -PIPE_WIDTH) {
        newPipes.splice(i, 1);
        i--;
        continue;
      }
      
      // Check if bird passed the pipe
      if (!newPipes[i].passed && newPipes[i].x + PIPE_WIDTH < birdBox.left) {
        newPipes[i].passed = true;
        setScore(prevScore => prevScore + 1);
        // Add haptic feedback on score
        if (Platform.OS === 'ios') {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
      }
      
      // Check collision with pipes
      const pipeX = newPipes[i].x;
      const topPipeBottom = newPipes[i].topHeight;
      const bottomPipeTop = SCREEN_HEIGHT - newPipes[i].bottomHeight;
      
      if (
        birdBox.right > pipeX && 
        birdBox.left < pipeX + PIPE_WIDTH && 
        (birdBox.top < topPipeBottom || birdBox.bottom > bottomPipeTop)
      ) {
        endGame();
        return;
      }
    }
    
    // Request next frame before state update
    animationFrameId.current = requestAnimationFrame(gameLoop);
    
    // Update pipes state
    setPipes(newPipes);
  };
  
  // Start game - fixed to ensure proper restart
  const startGame = () => {
    // First, cancel any existing animation frame
    if (animationFrameId.current) {
      cancelAnimationFrame(animationFrameId.current);
      animationFrameId.current = null;
    }
    
    // Reset all game state
    setGameStarted(true);
    setGameOver(false);
    setIsPaused(false);
    setScore(0);
    
    // Update refs immediately
    isGameOver.current = false;
    isGamePaused.current = false;
    
    // Reset bird position and velocity
    birdPosition.x.setValue(SCREEN_WIDTH / 3);
    birdPosition.y.setValue(SCREEN_HEIGHT / 2.5);
    birdVelocity.current = 0;
    birdRotation.setValue(0);
    
    // Clear pipes
    setPipes([]);
    pipesRef.current = [];
    
    // Start the game loop immediately
    animationFrameId.current = requestAnimationFrame(gameLoop);
    
    // Add haptic feedback
    if (Platform.OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
  };
  
  // End game
  const endGame = () => {
    isGameOver.current = true;
    setGameOver(true);
    if (score > bestScore) {
      setBestScore(score);
    }
    if (animationFrameId.current) {
      cancelAnimationFrame(animationFrameId.current);
      animationFrameId.current = null;
    }
    // Add haptic feedback on game over
    if (Platform.OS === 'ios') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  };
  
  // Handle screen tap
  const handleTap = () => {
    if (!gameStarted) {
      startGame();
    } else if (!isGameOver.current) {
      birdVelocity.current = FLAP_POWER;
      setIsFlapping(true);
      setTimeout(() => setIsFlapping(false), 100);
      // Add haptic feedback on flap
      if (Platform.OS === 'ios') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    }
  };
  
  // Continue game
  const continueGame = () => {
    // Same pattern as startGame
    if (animationFrameId.current) {
      cancelAnimationFrame(animationFrameId.current);
      animationFrameId.current = null;
    }
    
    setGameStarted(true);
    setGameOver(false);
    setIsPaused(false);
    setScore(0);
    
    // Update refs immediately
    isGameOver.current = false;
    isGamePaused.current = false;
    
    birdPosition.x.setValue(SCREEN_WIDTH / 3);
    birdPosition.y.setValue(SCREEN_HEIGHT / 2.5);
    birdVelocity.current = 0;
    birdRotation.setValue(0);
    
    setPipes([]);
    pipesRef.current = [];
    
    // Start the game loop immediately
    animationFrameId.current = requestAnimationFrame(gameLoop);
    
    if (Platform.OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
  };
  
  // Toggle pause
  const togglePause = () => {
    if (gameStarted && !gameOver) {
      const newPausedState = !isPaused;
      setIsPaused(newPausedState);
      isGamePaused.current = newPausedState;
      
      if (newPausedState === false) { // If unpausing
        // Start the game loop immediately
        animationFrameId.current = requestAnimationFrame(gameLoop);
      }
    }
  };
  
  return (
    <View style={[styles.container, { paddingTop: insets?.top || 0 }]}>
      <TouchableWithoutFeedback onPress={handleTap}>
        <View style={styles.container}>
          <StatusBar hidden />
          <Stack.Screen options={{ headerShown: false }} />
          
          {/* Sky background */}
          <View style={styles.skyBackground} />
          
          {/* Pipes */}
          {pipes.map((pipe, index) => (
            <React.Fragment key={index}>
              {/* Top pipe */}
              <View
                style={[
                  styles.pipe,
                  {
                    top: 0,
                    height: pipe.topHeight,
                    left: pipe.x,
                  },
                ]}
              />
              {/* Bottom pipe */}
              <View
                style={[
                  styles.pipe,
                  {
                    bottom: 0,
                    height: pipe.bottomHeight,
                    left: pipe.x,
                  },
                ]}
              />
            </React.Fragment>
          ))}
          
          {/* Ground */}
          <View style={styles.ground} />
          
          {/* Bird */}
          <Animated.View
            style={[
              styles.bird,
              {
                transform: [
                  { translateX: birdPosition.x },
                  { translateY: birdPosition.y },
                  { rotate: birdRotation.interpolate({
                    inputRange: [-30, 0, 90],
                    outputRange: ['-30deg', '0deg', '90deg']
                  }) }
                ]
              }
            ]}
          >
            <View style={[styles.birdBody, isFlapping && styles.birdFlap]} />
          </Animated.View>
          
          {/* Score */}
          {gameStarted && (
            <ThemedText style={dynamicStyles.score}>{score}</ThemedText>
          )}
          
          {/* Start screen */}
          {!gameStarted && !gameOver && (
            <View style={styles.startScreen}>
              <ThemedText style={styles.title}>Flappy Bird</ThemedText>
              <ThemedText style={styles.tapToStart}>Tap to Start</ThemedText>
            </View>
          )}
          
          {/* Game over screen */}
          {gameOver && (
            <View style={styles.gameOverScreen}>
              <ThemedText style={styles.gameOverText}>Game Over</ThemedText>
              <ThemedText style={styles.scoreText}>Score: {score}</ThemedText>
              <ThemedText style={styles.bestScoreText}>Best: {bestScore}</ThemedText>
              
              <View style={styles.buttonContainer}>
                <TouchableOpacity 
                  style={styles.restartButton} 
                  onPress={startGame}
                  activeOpacity={0.7}
                >
                  <ThemedText style={styles.restartText}>Restart</ThemedText>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={styles.continueButton} 
                  onPress={continueGame}
                  activeOpacity={0.7}
                >
                  <ThemedText style={styles.continueText}>Keep Playing</ThemedText>
                </TouchableOpacity>
              </View>
            </View>
          )}
          
          {/* Pause button */}
          {gameStarted && !gameOver && (
            <TouchableOpacity 
              style={dynamicStyles.pauseButton}
              onPress={togglePause}
              activeOpacity={0.7}
            >
              <ThemedText style={styles.pauseButtonText}>
                {isPaused ? "▶️" : "⏸️"}
              </ThemedText>
            </TouchableOpacity>
          )}
          
          {/* Pause screen */}
          {isPaused && (
            <View style={styles.pauseScreen}>
              <ThemedText style={styles.pauseText}>Game Paused</ThemedText>
              <TouchableOpacity 
                style={styles.resumeButton}
                onPress={togglePause}
                activeOpacity={0.7}
              >
                <ThemedText style={styles.resumeText}>Resume</ThemedText>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </TouchableWithoutFeedback>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    position: 'relative',
  },
  skyBackground: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    backgroundColor: '#70C5CE',
  },
  ground: {
    position: 'absolute',
    bottom: 0,
    width: '100%',
    height: 50,
    backgroundColor: '#DED895',
  },
  bird: {
    position: 'absolute',
    width: BIRD_WIDTH,
    height: BIRD_HEIGHT,
  },
  birdBody: {
    width: BIRD_WIDTH,
    height: BIRD_HEIGHT,
    borderRadius: 50,
    backgroundColor: '#F7DC6F',
  },
  birdFlap: {
    height: BIRD_HEIGHT - 5,
  },
  pipe: {
    position: 'absolute',
    width: PIPE_WIDTH,
    backgroundColor: '#73C020',
    borderWidth: 3,
    borderColor: '#000',
  },
  startScreen: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 48,
    fontWeight: 'bold',
    marginBottom: 20,
    color: 'white',
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 2, height: 2 },
    textShadowRadius: 5,
  },
  tapToStart: {
    fontSize: 24,
    color: 'white',
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  gameOverScreen: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    zIndex: 10,
  },
  gameOverText: {
    fontSize: 48,
    fontWeight: 'bold',
    marginBottom: 20,
    color: 'white',
  },
  scoreText: {
    fontSize: 32,
    marginBottom: 10,
    color: 'white',
  },
  bestScoreText: {
    fontSize: 24,
    marginBottom: 30,
    color: 'white',
  },
  buttonContainer: {
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    width: '80%',
    gap: 15,
  },
  restartButton: {
    paddingVertical: 18,
    paddingHorizontal: 35,
    backgroundColor: '#73C020',
    borderRadius: 15,
    borderWidth: 3,
    borderColor: '#000',
    width: '100%',
    alignItems: 'center',
  },
  restartText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
  },
  continueButton: {
    paddingVertical: 18,
    paddingHorizontal: 25,
    backgroundColor: '#4A90E2',
    borderRadius: 15,
    borderWidth: 3,
    borderColor: '#000',
    width: '100%',
    alignItems: 'center',
  },
  continueText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: 'white',
  },
  pauseButtonText: {
    fontSize: 20,
    color: 'white',
  },
  pauseScreen: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 5,
  },
  pauseText: {
    fontSize: 40,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 30,
  },
  resumeButton: {
    paddingVertical: 15,
    paddingHorizontal: 30,
    backgroundColor: '#4A90E2',
    borderRadius: 15,
    borderWidth: 3,
    borderColor: '#000',
  },
  resumeText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
  },
}); 