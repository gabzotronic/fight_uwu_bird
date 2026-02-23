/**
 * Pokemon sprite component
 * Renders either <img> or <video> depending on animationState
 */
export default function PokemonSprite({
  side = 'player',
  src,
  videoSrc,
  animationState = 'idle',
  onAnimationComplete,
}) {
  // If showing video (win/lose animation)
  if (animationState === 'video' && videoSrc) {
    return (
      <video
        src={videoSrc}
        poster={src}
        autoPlay
        muted
        playsInline
        className="sprite sprite--video"
        onCanPlay={e => { e.target.playbackRate = 1.4; }}
        onEnded={() => onAnimationComplete && onAnimationComplete('hidden')}
      />
    );
  }

  // If hidden — render invisible placeholder to keep the grid row reserved
  if (animationState === 'hidden') {
    return (
      <img
        src={src}
        alt=""
        aria-hidden="true"
        className={`sprite sprite--${side} sprite--hidden`}
      />
    );
  }

  // Default: render sprite image
  return (
    <img
      src={src}
      alt={`${side} sprite`}
      className={`sprite sprite--${side} sprite--${animationState}`}
    />
  );
}
