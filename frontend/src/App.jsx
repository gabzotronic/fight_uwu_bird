import { useState } from 'react';
import FightButton from './components/FightButton';
import BattleScene from './components/BattleScene';
import ResultScreen from './components/ResultScreen';
import './styles/app.css';

function App() {
  const [gameStarted, setGameStarted] = useState(false);
  const [gameResult, setGameResult] = useState(null);
  const [gameScore, setGameScore] = useState(0);
  const [gameSessionId, setGameSessionId] = useState(null);
  const [scoreToken, setScoreToken] = useState(null);
  const [micState, setMicState] = useState('idle'); // 'idle' | 'requesting' | 'denied'
  const [micStream, setMicStream] = useState(null);
  const [audioContext, setAudioContext] = useState(null);

  const handleFightClick = async () => {
    setGameResult(null);
    setGameScore(0);

    // Only show the mic message if permission takes longer than 200ms
    // (i.e. the browser dialog actually appeared)
    const messageTimer = setTimeout(() => setMicState('requesting'), 200);

    // Create AudioContext synchronously in the tap handler BEFORE any await.
    // iOS WebKit considers everything after an await as "automatically scripted"
    // and will refuse to unlock a suspended AudioContext.
    const ctx = new (window.AudioContext || window.webkitAudioContext)({
      sampleRate: 44100,
    });
    if (ctx.state === 'suspended') ctx.resume();

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: false,
          sampleRate: 44100,
        },
      });

      // Pre-register the AudioWorklet module (if supported)
      if (ctx.audioWorklet) {
        try {
          await ctx.audioWorklet.addModule('/recorder-worklet.js');
        } catch (e) {
          console.warn('[MIC] AudioWorklet registration failed, will use fallback:', e);
        }
      }

      clearTimeout(messageTimer);
      setMicState('idle');
      setMicStream(stream);
      setAudioContext(ctx);
      setGameStarted(true);
    } catch {
      clearTimeout(messageTimer);
      setMicState('denied');
      ctx.close();
    }
  };

  const handleGameEnd = (result, score, sessionId, token) => {
    if (micStream) {
      micStream.getTracks().forEach((t) => t.stop());
      setMicStream(null);
    }
    if (audioContext) {
      audioContext.close();
      setAudioContext(null);
    }
    setGameResult(result);
    setGameScore(score);
    setGameSessionId(sessionId);
    setScoreToken(token);
    setGameStarted(false);
  };

  // Battle screen
  if (gameStarted) {
    return (
      <div className="app game-state">
        <BattleScene
            micStream={micStream}
            audioContext={audioContext}
            onGameEnd={handleGameEnd}
            playerName="ANNOYED AUNTIE"
            playerLevel={6}
            opponentName="UWU BIRD"
            opponentLevel={10}
            playerSpriteUrl="/player_sprite.jpg"
            opponentSpriteUrl="/uwu_bird_sprite.jpg"
            winVideoUrl="/you_win_bird_animation.mp4"
            loseVideoUrl="/you_lose_bird_animation.mp4"
          />
      </div>
    );
  }

  // Result screen
  if (gameResult) {
    return (
      <div className="app idle-state">
        <div className="container">
          <ResultScreen
            result={gameResult}
            score={gameScore}
            sessionId={gameSessionId}
            scoreToken={scoreToken}
            onPlayAgain={handleFightClick}
          />
        </div>
      </div>
    );
  }

  // Title screen with Fight button
  return (
    <div className="app idle-state">
      <div className="container">
        <FightButton onClick={handleFightClick} micState={micState} />
      </div>
    </div>
  );
}

export default App;
