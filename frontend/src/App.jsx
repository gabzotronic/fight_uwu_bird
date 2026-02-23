import { useState } from 'react';
import FightButton from './components/FightButton';
import BattleScene from './components/BattleScene';
import ResultScreen from './components/ResultScreen';
import './styles/app.css';

function App() {
  const [gameStarted, setGameStarted] = useState(false);
  const [gameResult, setGameResult] = useState(null);
  const [gameScore, setGameScore] = useState(0);
  const [micState, setMicState] = useState('idle'); // 'idle' | 'requesting' | 'denied'
  const [micStream, setMicStream] = useState(null);

  const handleFightClick = async () => {
    setGameResult(null);
    setGameScore(0);

    // Only show the mic message if permission takes longer than 200ms
    // (i.e. the browser dialog actually appeared)
    const messageTimer = setTimeout(() => setMicState('requesting'), 200);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100,
        },
      });
      clearTimeout(messageTimer);
      setMicState('idle');
      setMicStream(stream);
      setGameStarted(true);
    } catch {
      clearTimeout(messageTimer);
      setMicState('denied');
    }
  };

  const handleGameEnd = (result, score) => {
    if (micStream) {
      micStream.getTracks().forEach((t) => t.stop());
      setMicStream(null);
    }
    setGameResult(result);
    setGameScore(score);
    setGameStarted(false);
  };

  // Battle screen
  if (gameStarted) {
    return (
      <div className="app game-state">
        <BattleScene
            micStream={micStream}
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
