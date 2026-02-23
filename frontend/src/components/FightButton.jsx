/**
 * FightButton - Main entry point for the game
 */

export default function FightButton({ onClick, gameResult, micState = 'idle' }) {
  const isRequesting = micState === 'requesting';

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
    </div>
  );
}
