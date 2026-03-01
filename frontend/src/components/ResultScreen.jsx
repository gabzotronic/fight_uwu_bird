/**
 * ResultScreen - Displays win/lose results with leaderboard
 */

import { useState, useEffect } from 'react';
import PitchVisualizer from './PitchVisualizer';
import PitchProgression from './PitchProgression';
import { getLeaderboard, submitScore } from '../api/gameApi';

export default function ResultScreen({ result, score, sessionId, scoreToken, message, onPlayAgain, analysis }) {
  const isWin = result === 'win';
  const [copied, setCopied] = useState(false);

  // Leaderboard state
  const [name, setName] = useState('');
  const [submitState, setSubmitState] = useState('idle'); // idle | submitting | submitted | error
  const [entries, setEntries] = useState([]);
  const [submittedName, setSubmittedName] = useState(null);
  const [playerRank, setPlayerRank] = useState(null);

  useEffect(() => {
    getLeaderboard()
      .then((data) => setEntries(data.entries || []))
      .catch(() => {});
  }, []);

  const [submitError, setSubmitError] = useState(null);

  const handleSubmitScore = async () => {
    const trimmed = name.trim();
    if (!trimmed || submitState !== 'idle') return;
    setSubmitState('submitting');
    setSubmitError(null);
    try {
      const data = await submitScore(trimmed, score, sessionId, scoreToken);
      setEntries(data.entries || []);
      setSubmittedName(trimmed.toUpperCase());
      setPlayerRank(data.player_rank || null);
      setSubmitState('submitted');
    } catch (err) {
      setSubmitError(err.message);
      setSubmitState('idle');
    }
  };

  const handleShare = async () => {
    const url = `https://fightuwubird.com/share?result=${result}&score=${score ?? 0}`;
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      const input = document.createElement('input');
      input.value = url;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={`result-screen ${isWin ? 'win' : 'lose'}`}>
      <div className="result-content">
        <div className="result-icon">
          {isWin ? (
            <div className="win-animation">
              <span className="confetti">🎉</span>
              <h1 className="result-title">YOU WIN!</h1>
            </div>
          ) : (
            <div className="lose-animation">
              <h1 className="result-title">YOU LOSE</h1>
            </div>
          )}
          {score != null && (
            <p className="result-score">SCORE: {score.toLocaleString()}</p>
          )}
        </div>

        <p className="result-message">{message}</p>

        {/* Current round pitch visualization */}
        {analysis && <PitchVisualizer analysis={analysis} />}

        {/* All rounds progression (if game is over or multiple rounds completed) */}
        {analysis?.all_rounds_visualization && analysis.all_rounds_visualization.length > 0 && (
          <PitchProgression allRounds={analysis.all_rounds_visualization} />
        )}

        {analysis && (
          <div className="result-stats">
            <div className="stat">
              <span className="stat-label">Contour Match:</span>
              <span className={`stat-value ${analysis.contour_match ? 'pass' : 'fail'}`}>
                {analysis.contour_score.toFixed(2)} / 1.00
              </span>
            </div>
            <div className="stat">
              <span className="stat-label">Pitch Match:</span>
              <span className={`stat-value ${analysis.pitch_match ? 'pass' : 'fail'}`}>
                {analysis.player_median_pitch_hz.toFixed(0)} Hz / {analysis.target_min_pitch_hz.toFixed(0)} Hz
              </span>
            </div>
          </div>
        )}

        {/* Score submission */}
        {score > 0 && scoreToken && submitState !== 'submitted' && (
          <div className="leaderboard-submit">
            <input
              className="leaderboard-input"
              type="text"
              maxLength={8}
              placeholder="YOUR NAME"
              value={name}
              onChange={(e) => setName(e.target.value.toUpperCase())}
              disabled={submitState === 'submitting'}
            />
            <button
              className="framed neutral play-again-button"
              onClick={handleSubmitScore}
              disabled={!name.trim() || submitState === 'submitting'}
            >
              {submitState === 'submitting' ? 'SUBMITTING...' : 'SUBMIT SCORE'}
            </button>
            {submitError && <p className="leaderboard-error">{submitError}</p>}
          </div>
        )}
        {submitState === 'submitted' && (
          <p className="leaderboard-submitted">SCORE SUBMITTED!</p>
        )}

        {/* Leaderboard table */}
        {entries.length > 0 && (
          <div className="framed neutral leaderboard">
            <h3 className="leaderboard__title">LEADERBOARD</h3>
            <div className="leaderboard__table">
              {entries.map((entry, i) => (
                <div
                  key={i}
                  className={`leaderboard__entry${
                    submittedName && entry.name === submittedName && entry.score === score
                      ? ' leaderboard__entry--own'
                      : ''
                  }`}
                >
                  <span className="leaderboard__rank">{i + 1}</span>
                  <span className="leaderboard__name">{entry.name}</span>
                  <span className="leaderboard__score">{entry.score.toLocaleString()}</span>
                </div>
              ))}
              {/* Show player's row if they didn't make top 8 */}
              {playerRank && playerRank > entries.length && submittedName && (
                <>
                  <div className="leaderboard__separator">...</div>
                  <div className="leaderboard__entry leaderboard__entry--own">
                    <span className="leaderboard__rank">{playerRank}</span>
                    <span className="leaderboard__name">{submittedName}</span>
                    <span className="leaderboard__score">{score.toLocaleString()}</span>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        <button className="framed neutral play-again-button" onClick={onPlayAgain}>
          ▶ {isWin ? 'PLAY AGAIN' : 'TRY AGAIN'} ◀
        </button>
        <button className="framed neutral play-again-button" onClick={handleShare}>
          {copied ? '✓ COPIED!' : '⬆ SHARE SCORE'}
        </button>
      </div>
    </div>
  );
}
