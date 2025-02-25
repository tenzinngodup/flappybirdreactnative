import React, { useRef, useEffect } from 'react';
import { View } from 'react-native';

type GameEngineProps = {
  onUpdate: (deltaTime: number) => void;
  running: boolean;
  children: React.ReactNode;
  style?: any;
};

export function GameEngine({ onUpdate, running, children, style }: GameEngineProps) {
  const lastUpdateTime = useRef(0);
  const requestRef = useRef<number | null>(null);

  const gameLoop = (time: number) => {
    if (lastUpdateTime.current === 0) {
      lastUpdateTime.current = time;
    }

    const deltaTime = time - lastUpdateTime.current;
    lastUpdateTime.current = time;

    if (running) {
      onUpdate(deltaTime);
    }

    requestRef.current = requestAnimationFrame(gameLoop);
  };

  useEffect(() => {
    if (running) {
      lastUpdateTime.current = 0;
      requestRef.current = requestAnimationFrame(gameLoop);
    }

    return () => {
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
      }
    };
  }, [running]);

  return <View style={style}>{children}</View>;
} 