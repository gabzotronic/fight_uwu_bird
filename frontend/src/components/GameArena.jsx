/**
 * GameArena - Displays the active game state
 */

import { GameState } from '../hooks/useGameSession';

export default function GameArena({ round, message, gameState }) {
  const isAnalyzing = gameState === GameState.ANALYZING;
  const isPlayerTurn = gameState === GameState.PLAYER_TURN;
  const isBirdCalling = gameState === GameState.BIRD_CALLING;

  return (
    <div className="game-arena">
      <div className="game-header">
        <h2>Round {round} / 3</h2>
      </div>

      <div className="game-content">
        {/* Bird side */}
        <div className="bird-side">
          <div className={`bird-icon ${isBirdCalling ? 'calling' : ''}`}>
            UWU
          </div>
          {isBirdCalling && (
            <div className="sound-waves">
              <div className="wave"></div>
              <div className="wave"></div>
              <div className="wave"></div>
            </div>
          )}
        </div>

        {/* Center indicator */}
        <div className="center-indicator">
          {isAnalyzing && (
            <div className="spinner">
              <div></div>
            </div>
          )}
          {isPlayerTurn && (
            <div className="mic-icon">
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
                <path d="M17 16.91c-1.48 1.46-3.51 2.36-5.77 2.36-2.26 0-4.29-.9-5.77-2.36M19 12h2c0 2.04-.56 3.95-1.57 5.59l1.42 1.42c1.41-2.0 2.15-4.45 2.15-7.01zM5 12H3c0 2.56.74 5.01 2.15 7.01l1.42-1.42C5.56 15.95 5 14.04 5 12z" />
              </svg>
            </div>
          )}
        </div>

        {/* Player side */}
        <div className="player-side">
          <div className={`player-icon ${isPlayerTurn ? 'active' : ''}`}>
            YOU
          </div>
        </div>
      </div>

      {/* Message */}
      <div className="game-message">
        <p>{message}</p>
      </div>

      {/* Status indicator */}
      <div className="game-status">
        {isBirdCalling && <span className="status-text">Listening...</span>}
        {isPlayerTurn && <span className="status-text">Your turn!</span>}
        {isAnalyzing && <span className="status-text">Analyzing...</span>}
      </div>
    </div>
  );
}
