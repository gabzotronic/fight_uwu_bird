import HealthBar from './HealthBar';

/**
 * Info panel showing Pokemon name, level, and HP
 * - opponent side: name, level, HP bar (no numeric HP)
 * - player side: name, level, HP bar + numeric tries
 */
export default function InfoPanel({
  side = 'player',
  name = 'POKEMON',
  level = 5,
  currentHp = 100,
  maxHp = 100,
  triesLeft = 3,
  maxTries = 3,
}) {
  return (
    <div className={`info-panel info-panel--${side}`}>
      <span className="info-panel__name">{name}</span>
      <span className="info-panel__level">:L{level}</span>
      <HealthBar current={currentHp} max={maxHp} />
      {side === 'player' && (
        <span className="info-panel__hp-numbers">
          {triesLeft} / {maxTries}
        </span>
      )}
    </div>
  );
}
