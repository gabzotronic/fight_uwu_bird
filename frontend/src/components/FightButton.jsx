/**
 * FightButton - Main entry point for the game
 */

export default function FightButton({ onClick, gameResult }) {
  return (
    <div className="fight-button-container">
      <h1 className="title">FIGHT UWU BIRD</h1>
      <button className="fight-button" onClick={onClick}>
        <span className="button-text">START GAME</span>
      </button>
      {gameResult ? (
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
