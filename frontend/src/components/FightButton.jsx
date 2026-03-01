/**
 * FightButton - Main entry point for the game
 */

import { useState, useEffect } from 'react';
import { getLeaderboard } from '../api/gameApi';

export default function FightButton({ onClick, gameResult, micState = 'idle' }) {
  const isRequesting = micState === 'requesting';
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [entries, setEntries] = useState([]);

  useEffect(() => {
    if (showLeaderboard && entries.length === 0) {
      getLeaderboard()
        .then((data) => setEntries(data.entries || []))
        .catch(() => {});
    }
  }, [showLeaderboard]);

  const showDefault = !micState || micState === 'idle';

  return (
    <div className="fight-button-container">
      <h1 className="title">FIGHT UWU BIRD</h1>
      <button className="fight-button" onClick={onClick} disabled={isRequesting}>
        <span className="button-text">START GAME</span>
      </button>
      {micState === 'requesting' ? (
        <p className="subtitle">Microphone access is required to battle.</p>
      ) : micState === 'denied' ? (
        <p className="subtitle">Microphone access denied — please allow mic access and try again.</p>
      ) : gameResult ? (
        <p className={`result-message result-message--${gameResult}`}>
          {gameResult === 'win' ? 'YOU WIN' : 'YOU LOSE'}
        </p>
      ) : showLeaderboard ? (
        entries.length > 0 && (
          <div className="framed neutral leaderboard leaderboard--landing">
            <h3 className="leaderboard__title">LEADERBOARD</h3>
            <div className="leaderboard__table">
              {entries.map((entry, i) => (
                <div key={i} className="leaderboard__entry">
                  <span className="leaderboard__rank">{i + 1}</span>
                  <span className="leaderboard__name">{entry.name}</span>
                  <span className="leaderboard__score">{entry.score.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>
        )
      ) : (
        <>
          <p className="subtitle">
            Can you out-uwu the legendary Koel bird?
          </p>
          <p className="instructions">
            Listen to the bird's call, then <span className="instructions--emphasis">reply it with a higher pitch</span>.
            Win all 3 rounds to silence the bird!
          </p>
        </>
      )}
      {showDefault && (
        <button
          className="leaderboard-toggle"
          onClick={() => setShowLeaderboard(!showLeaderboard)}
        >
          {showLeaderboard ? 'HIDE LEADERBOARD' : 'SHOW LEADERBOARD'}
        </button>
      )}
      <footer className="fight-footer">
        <p>Made in 🇸🇬 with ❤️</p>
        <p><a href="https://www.reddit.com/r/askSingapore/comments/1p72dng/how_do_you_deal_with_the_uwu_bird_right_outside/" target="_blank" rel="noopener noreferrer">Reddit inspiration</a></p>
      </footer>
    </div>
  );
}
