import { useState } from 'react';
import FightButton from './components/FightButton';
import BattleScene from './components/BattleScene';
import ResultScreen from './components/ResultScreen';
import './styles/app.css';

function App() {
  const [gameStarted, setGameStarted] = useState(false);
  const [gameResult, setGameResult] = useState(null);
  const [gameScore, setGameScore] = useState(0);

  const handleFightClick = () => {
    setGameStarted(true);
    setGameResult(null);
    setGameScore(0);
  };

  const handleGameEnd = (result, score) => {
    setGameResult(result);
    setGameScore(score);
    setGameStarted(false);
  };

  // Battle screen
  if (gameStarted) {
    return (
      <div className="app game-state">
        <BattleScene
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
        <FightButton onClick={handleFightClick} />
      </div>
    </div>
  );
}

export default App;
