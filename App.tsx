import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import Scene from './components/Scene';
import GameUI from './components/GameUI';
import { GameState, Recording } from './types';
import { useSounds } from './hooks/useSounds';
import { getLevelConfig, MAX_LEVELS } from './levelConfig';

type GameMode = 'start' | 'single' | 'challenge';

const App: React.FC = () => {
  const [gameMode, setGameMode] = useState<GameMode>('start');
  const [level, setLevel] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [lastRecording, setLastRecording] = useState<Recording | null>(null);

  // Player 1 State
  const [p1GameState, setP1GameState] = useState<GameState>('start');
  const [p1Score, setP1Score] = useState(0);
  const [p1Lives, setP1Lives] = useState(6);
  const [p1StarCoins, setP1StarCoins] = useState(0);
  const [p1PipesPassed, setP1PipesPassed] = useState(0);

  // Player 2 State
  const [p2GameState, setP2GameState] = useState<GameState>('start');
  const [p2Score, setP2Score] = useState(0);
  const [p2Lives, setP2Lives] = useState(6);
  const [p2StarCoins, setP2StarCoins] = useState(0);
  const [p2PipesPassed, setP2PipesPassed] = useState(0);

  const { playSound, playMusic, stopMusic } = useSounds({ isMuted });
  
  const p1FlapRef = useRef<() => void>(() => {});
  const p2FlapRef = useRef<() => void>(() => {});
  const recordingRef = useRef<{ level: number; startTime: number; flaps: { time: number }[] } | null>(null);

  const resetPlayerData = (setScore: Function, setLives: Function, setStarCoins: Function, setPipesPassed: Function, setGameState: Function) => {
    setScore(0);
    setLives(6);
    setStarCoins(0);
    setPipesPassed(0);
    setGameState('ready');
  };

  const handleStart = useCallback((mode: GameMode, startLevel = 1) => {
    if (isStarting || mode === 'start') return;
    setIsStarting(true);
    setTimeout(() => {
        setGameMode(mode);
        setLevel(startLevel);
        resetPlayerData(setP1Score, setP1Lives, setP1StarCoins, setP1PipesPassed, setP1GameState);
        if (mode === 'challenge') {
            resetPlayerData(setP2Score, setP2Lives, setP2StarCoins, setP2PipesPassed, setP2GameState);
        }
        setIsStarting(false); // Fix: Reset the starting flag
    }, 500);
  }, [isStarting]);

  const handleRestart = useCallback(() => {
    setGameMode('start');
    setP1GameState('start');
    setP2GameState('start');
  }, []);

  const handleResume = useCallback(() => {
    setLevel(l => {
      handleStart(gameMode, l);
      return l;
    });
  }, [gameMode, handleStart]);
  
  const handlePipePass = useCallback((player: 1 | 2) => {
    playSound('score');
    const setScore = player === 1 ? setP1Score : setP2Score;
    const setPipesPassed = player === 1 ? setP1PipesPassed : setP1PipesPassed;
    const setGameState = player === 1 ? setP1GameState : setP2GameState;

    setScore(s => s + 1);
    setPipesPassed(p => {
      const newPipesPassed = p + 1;
      const config = getLevelConfig(level);
      if (config.pipeCount > 0 && newPipesPassed >= config.pipeCount) {
        playSound('levelComplete');
        setGameState('levelComplete');
      }
      return newPipesPassed;
    });
  }, [playSound, level]);
  
  const handleCoinCollect = useCallback((player: 1 | 2) => {
    playSound('coin');
    const setScore = player === 1 ? setP1Score : setP2Score;
    const setStarCoins = player === 1 ? setP1StarCoins : setP1StarCoins;
    const setLives = player === 1 ? setP1Lives : setP2Lives;
    
    setScore(s => s + 5);
    setStarCoins(sc => {
      const newStarCoins = sc + 1;
      if (newStarCoins >= 25) {
        setLives(l => l + 1);
        playSound('lifeUp');
        return newStarCoins - 25;
      }
      return newStarCoins;
    });
  }, [playSound]);
  
  const handleTrapHit = useCallback((player: 1 | 2) => {
    playSound('trap');
    const setScore = player === 1 ? setP1Score : setP2Score;
    setScore(s => Math.max(0, s - 3));
  }, [playSound]);
  
  const handleCrash = useCallback((player: 1 | 2) => {
    playSound('crash');
    const setLives = player === 1 ? setP1Lives : setP2Lives;
    const setPipesPassed = player === 1 ? setP1PipesPassed : setP1PipesPassed;
    const setGameState = player === 1 ? setP1GameState : setP2GameState;
    
    setLives(l => {
      const newLives = l - 1;
      if (newLives > 0) {
        setPipesPassed(0);
        setGameState('ready'); // Restart level
      } else {
        setGameState('gameOver');
      }
      return newLives;
    });
  }, [playSound]);

  const handleNextLevel = useCallback(() => {
    if (level >= MAX_LEVELS) {
      setP1GameState('victory');
      if (gameMode === 'challenge') setP2GameState('victory');
    } else {
      setLevel(l => l + 1);
      setP1PipesPassed(0);
      setP1GameState('ready');
      if (gameMode === 'challenge') {
        setP2PipesPassed(0);
        setP2GameState('ready');
      }
    }
  }, [level, gameMode]);

  const handlePauseToggle = useCallback(() => {
    if (p1GameState === 'playing' || p2GameState === 'playing') {
      playSound('pause');
      setP1GameState(s => s === 'playing' ? 'paused' : s);
      setP2GameState(s => s === 'playing' ? 'paused' : s);
    } else if (p1GameState === 'paused' || p2GameState === 'paused') {
      playSound('pause');
      setP1GameState(s => s === 'paused' ? 'playing' : s);
      setP2GameState(s => s === 'paused' ? 'playing' : s);
    }
  }, [p1GameState, p2GameState, playSound]);

  const handleFlapSound = useCallback(() => playSound('flap'), [playSound]);

  const handleFlapAndRecord = useCallback((player: 1 | 2) => {
    const flapRef = player === 1 ? p1FlapRef : p2FlapRef;
    const gameState = player === 1 ? p1GameState : p2GameState;

    flapRef.current?.();

    if (gameMode === 'single' && (gameState === 'playing' || gameState === 'ready')) {
        if (!recordingRef.current) {
             recordingRef.current = { level, startTime: performance.now(), flaps: [{ time: 0 }] };
        } else {
            recordingRef.current.flaps.push({ time: performance.now() - recordingRef.current.startTime });
        }
    }
  }, [gameMode, p1GameState, p2GameState, level]);

  const handleInput = useCallback((player: 1 | 2) => {
    const gameState = player === 1 ? p1GameState : p2GameState;
    const setGameState = player === 1 ? setP1GameState : setP2GameState;
    if (gameState === 'ready') setGameState('playing');
    if (gameState === 'ready' || gameState === 'playing') handleFlapAndRecord(player);
  }, [p1GameState, p2GameState, handleFlapAndRecord]);
  
  const handleToggleMute = useCallback(() => setIsMuted(prev => !prev), []);

  useEffect(() => {
    if (gameMode === 'single' && (p1GameState === 'gameOver' || p1GameState === 'levelComplete' || p1GameState === 'victory') && recordingRef.current) {
        if (p1PipesPassed > 0) {
            setLastRecording({ level: recordingRef.current.level, flaps: recordingRef.current.flaps });
        }
        recordingRef.current = null;
    }
    if (p1GameState === 'ready') recordingRef.current = null;
    if (gameMode === 'start') setIsStarting(false);
  }, [gameMode, p1GameState, p1PipesPassed]);
  
  const isGameOverForAll = gameMode === 'single' ? p1GameState === 'gameOver' : (p1GameState === 'gameOver' && p2GameState === 'gameOver');
  const isVictoryForAll = p1GameState === 'victory'; // Victory is shared

  const shouldMusicBePlaying = gameMode !== 'start' && !isGameOverForAll && !isVictoryForAll;

  useEffect(() => {
    if (shouldMusicBePlaying) {
        stopMusic(); // Stop any existing music to play the new one
        playMusic(level);
    } else {
        stopMusic();
    }
  }, [shouldMusicBePlaying, level, playMusic, stopMusic]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.code === 'ArrowUp') {
        e.preventDefault();
        handleInput(1);
      } else if (e.key === 'Escape' || e.key.toLowerCase() === 'p') {
        e.preventDefault();
        handlePauseToggle();
      } else if (e.key === 'Enter' && gameMode === 'start') {
        e.preventDefault();
        handleStart('single');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleInput, handlePauseToggle, gameMode, handleStart]);

  return (
    <>
      <GameUI 
        gameMode={gameMode}
        level={level}
        isMuted={isMuted}
        onToggleMute={handleToggleMute}
        isStarting={isStarting}
        onStart={handleStart}
        onRestart={handleRestart}
        onResume={handleResume}
        onNextLevel={handleNextLevel}
        onPause={handlePauseToggle}
        playSound={playSound}
        // Player 1
        p1Score={p1Score}
        p1Lives={p1Lives}
        p1StarCoins={p1StarCoins}
        p1GameState={p1GameState}
        // Player 2
        p2Score={p2Score}
        p2Lives={p2Lives}
        p2StarCoins={p2StarCoins}
        p2GameState={p2GameState}
      />
      <div id="canvas-container" onMouseDown={() => handleInput(2)} onTouchStart={() => handleInput(2)}>
        <Canvas shadows>
          <Scene
            gameMode={gameMode}
            level={level}
            onFlap={handleFlapSound}
            lastRecording={lastRecording}
            // Player 1
            p1GameState={p1GameState}
            onPipePass1={() => handlePipePass(1)}
            onCoinCollect1={() => handleCoinCollect(1)}
            onTrapHit1={() => handleTrapHit(1)}
            onCrash1={() => handleCrash(1)}
            p1FlapRef={p1FlapRef}
            // Player 2
            p2GameState={p2GameState}
            onPipePass2={() => handlePipePass(2)}
            onCoinCollect2={() => handleCoinCollect(2)}
            onTrapHit2={() => handleTrapHit(2)}
            onCrash2={() => handleCrash(2)}
            p2FlapRef={p2FlapRef}
          />
        </Canvas>
      </div>
    </>
  );
};

export default App;