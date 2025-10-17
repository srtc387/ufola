import React, { useState, useEffect } from 'react';
import { GameState } from '../types';
import { SoundType } from '../hooks/useSounds';

type GameMode = 'start' | 'single' | 'challenge';

interface GameUIProps {
  gameMode: GameMode;
  level: number;
  isMuted: boolean;
  onToggleMute: () => void;
  isStarting: boolean;
  onStart: (mode: GameMode) => void;
  onRestart: () => void;
  onResume: () => void;
  onNextLevel: () => void;
  onPause: () => void;
  playSound: (type: SoundType) => void;
  // Player 1
  p1Score: number;
  p1Lives: number;
  p1StarCoins: number;
  p1GameState: GameState;
  // Player 2
  p2Score: number;
  p2Lives: number;
  p2StarCoins: number;
  p2GameState: GameState;
}

const GameUI: React.FC<GameUIProps> = (props) => {
  const { 
    gameMode, level, isMuted, onToggleMute, isStarting, 
    onStart, onRestart, onResume, onNextLevel, onPause, playSound,
    p1Score, p1Lives, p1StarCoins, p1GameState,
    p2Score, p2Lives, p2StarCoins, p2GameState,
  } = props;
  
  const [showNextLevelButton, setShowNextLevelButton] = useState(false);
  
  const isLevelComplete = p1GameState === 'levelComplete' || p2GameState === 'levelComplete';
  const isVictory = p1GameState === 'victory' || p2GameState === 'victory';
  const isPaused = p1GameState === 'paused' || p2GameState === 'paused';
  const isGameOver = gameMode === 'single' ? p1GameState === 'gameOver' : (p1GameState === 'gameOver' && p2GameState === 'gameOver');
  const isHudVisible = gameMode !== 'start' && !isLevelComplete && !isVictory && !isGameOver && !isPaused;
  const showPauseButton = (p1GameState === 'playing' || p1GameState === 'paused') || (gameMode === 'challenge' && (p2GameState === 'playing' || p2GameState === 'paused'));

  useEffect(() => {
    if (isLevelComplete) {
      setShowNextLevelButton(false);
      const timer = setTimeout(() => setShowNextLevelButton(true), 2000); // Show button after 2s animation
      return () => clearTimeout(timer);
    }
  }, [isLevelComplete]);
  
  useEffect(() => {
    if (gameMode === 'challenge' && isGameOver && p1Score !== p2Score) {
      playSound('victory');
    }
  }, [gameMode, isGameOver, p1Score, p2Score, playSound]);

  const getMessage = () => {
    if (gameMode === 'start') {
      return (
        <div className={`message-container ${isStarting ? 'starting' : ''}`}>
          <h1>UFO Flap</h1>
          <p>Dodge pipes and collect stars for extra lives!</p>
          <div style={{display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '1rem' }}>
            <p className='controls-text text-sm'>P1: [SPACE] / [ARROW UP]</p>
            <p className='controls-text text-sm'>P2: [MOUSE CLICK] / [TAP]</p>
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem' }}>
            <button onClick={() => onStart('single')} disabled={isStarting}>Single Player</button>
            <button onClick={() => onStart('challenge')} disabled={isStarting} className="button-secondary">Challenge Mode</button>
          </div>
        </div>
      );
    }
    
    if (p1GameState === 'ready' && (gameMode === 'single' || p2GameState === 'ready')) {
      return (
        <div className="message-container" style={{ pointerEvents: 'none', background: 'transparent', boxShadow: 'none' }}>
          <h2>Level {level}</h2>
          <p>Get Ready!</p>
        </div>
      );
    }
    
    if (isGameOver) {
       return (
          <div className="message-container">
            <h1>Game Over</h1>
            {gameMode === 'single' ? (
                <h2>Final Score: {p1Score}</h2>
            ) : (
                <>
                  <h2>P1: {p1Score} | P2: {p2Score}</h2>
                  <h3>{p1Score > p2Score ? 'Player 1 Wins!' : p2Score > p1Score ? 'Player 2 Wins!' : "It's a Tie!"}</h3>
                </>
            )}

            {level > 1 ? (
              <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem' }}>
                <button onClick={onResume}>Resume Level {level}</button>
                <button onClick={onRestart} className="button-secondary">Restart Game</button>
              </div>
            ) : (
              <button onClick={onRestart}>Try Again</button>
            )}
          </div>
        );
    }
    
    if (isLevelComplete) {
      return (
        <div className="message-container">
          <h1>Level {level} Complete!</h1>
          {showNextLevelButton && <button onClick={onNextLevel}>Next Level</button>}
        </div>
      );
    }

    if (isVictory) {
      return (
        <div className="message-container">
          <h1>Congratulations!</h1>
          <h2>You've completed the game!</h2>
          {gameMode === 'single' ? <h3>Final Score: {p1Score}</h3> : <h3>P1: {p1Score} | P2: {p2Score}</h3>}
          <button onClick={onRestart}>Play Again</button>
        </div>
      );
    }
    
    if (isPaused) {
      return (
        <div className="message-container">
          <h1>Paused</h1>
          <button onClick={onPause}>Resume</button>
        </div>
      );
    }

    return null;
  };

  return (
    <>
      <button className="mute-button" onClick={onToggleMute} aria-label={isMuted ? "Unmute Sound" : "Mute Sound"}>
        {isMuted ? '🔇' : '🔊'}
      </button>
      <div className="game-ui">
        {isHudVisible && (
          <div className="hud">
            <div className="hud-player">
              <div>Score: {p1Score}</div>
              <div>❤️ {p1Lives}</div>
              <div>⭐ {p1StarCoins}/25</div>
            </div>
            {gameMode === 'challenge' && (
              <div className="hud-player right">
                <div>Score: {p2Score}</div>
                <div>❤️ {p2Lives}</div>
                <div>⭐ {p2StarCoins}/25</div>
              </div>
            )}
          </div>
        )}
        {getMessage()}
      </div>
      {showPauseButton && (
        <button className="pause-button" onClick={onPause} aria-label={isPaused ? "Resume Game" : "Pause Game"}>
          {isPaused ? '▶' : '❚❚'}
        </button>
      )}
    </>
  );
};

export default GameUI;