/**
 * Health bar component using HTML <progress> element
 * Integrates with gameboy.css for Game Boy styling
 */
export default function HealthBar({ current, max }) {
  // Calculate percentage and determine class for color
  const percentage = max > 0 ? Math.round((current / max) * 100) : 0;
  const clampedPercentage = Math.max(1, Math.min(100, percentage));

  return (
    <div className="progress-bar-container">
      <label>HP:</label>
      <div className={`progress-bar p${clampedPercentage}`} />
    </div>
  );
}
