/**
 * ResultScreen - Displays win/lose results
 */

import { useState } from 'react';
import PitchVisualizer from './PitchVisualizer';
import PitchProgression from './PitchProgression';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export default function ResultScreen({ result, score, message, onPlayAgain, analysis }) {
  const isWin = result === 'win';
  const [copied, setCopied] = useState(false);

  const handleShare = async () => {
    const url = `https://fightuwubird.com/share?result=${result}&score=${score ?? 0}`;
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      // Fallback for browsers without clipboard API
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
