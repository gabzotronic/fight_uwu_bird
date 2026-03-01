import { useState, useEffect, useCallback, useRef } from 'react';
import { useGameSession } from '../hooks/useGameSession';
import { useAudioRecorder } from '../hooks/useAudioRecorder';
import { useAudioPlayer } from '../hooks/useAudioPlayer';
import { delay } from '../utils/delay';
import '../styles/battle.css';
import BattleBackground from './BattleBackground';
import InfoPanel from './InfoPanel';
import PokemonSprite from './PokemonSprite';
import ContentFrame from './ContentFrame';

/**
 * Main battle scene component - orchestrates the entire game loop
 */
export default function BattleScene({
  micStream = null,
  audioContext = null,
  playerName = 'YOU',
  playerLevel = 6,
  opponentName = 'UWU BIRD',
  opponentLevel = 10,
  playerSpriteUrl = '/player_sprite.jpg',
  opponentSpriteUrl = '/uwu_bird_sprite.jpg',
  winVideoUrl = '/you_win_bird_animation.mp4',
  loseVideoUrl = '/you_lose_bird_animation.mp4',
  onGameEnd,
}) {
  const game = useGameSession();
  const { initializeGame, playBirdCall, submitAudio } = game;
  const { startRecording } = useAudioRecorder();
  const { playAudio } = useAudioPlayer();

  // Game state
  const [phase, setPhase] = useState('intro');
  const [round, setRound] = useState(1);
  const [triesLeft, setTriesLeft] = useState(3);
  const [birdHp, setBirdHp] = useState(3);
  const [playerHpDisplay, setPlayerHpDisplay] = useState(100);
  const [birdHpDisplay, setBirdHpDisplay] = useState(100);
  const [totalScore, setTotalScore] = useState(0);
  const totalScoreRef = useRef(0);
  const scoreTokenRef = useRef(null);

  // Animation states
  const [playerAnimState, setPlayerAnimState] = useState('hidden');
  const [birdAnimState, setBirdAnimState] = useState('entering');
  const [playerPanelVisible, setPlayerPanelVisible] = useState(false);

  // Content frame
  const [contentMode, setContentMode] = useState('text');
  const [dialogue, setDialogue] = useState('');
  const [chartData, setChartData] = useState([]);
  const [chartLayout, setChartLayout] = useState({});

  // Game session
  const [sessionId, setSessionId] = useState(null);
  // Guard against React StrictMode double-invoking the startup effect
  const battleStartedRef = useRef(false);
  // Holds the resolve function for the current video-end promise
  const videoEndResolverRef = useRef(null);

  const waitForBirdVideoEnd = useCallback(() => {
    return new Promise(resolve => {
      videoEndResolverRef.current = resolve;
    });
  }, []);

  const handleBirdAnimComplete = useCallback((state) => {
    setBirdAnimState(state);
    if (state === 'hidden' && videoEndResolverRef.current) {
      videoEndResolverRef.current();
      videoEndResolverRef.current = null;
    }
  }, []);

  // Drain HP animation
  const drainHp = useCallback(async (setHp, from, to, tickMs = 30) => {
    const fromPct = Math.round((from / 3) * 100);
    const toPct = Math.round((to / 3) * 100);
    const step = fromPct > toPct ? -1 : 1;

    for (let pct = fromPct; (step > 0 && pct <= toPct) || (step < 0 && pct >= toPct); pct += step) {
      setHp(pct);
      await delay(tickMs);
    }
  }, []);


  // Main game loop — accepts sessionId directly so it can be called
  // immediately after initializeGame() without waiting for setState to flush.
  const runBattle = useCallback(async (sid) => {
    if (!sid) return;

    try {
      // Intro sequence
      await playIntro();

      let currentRound = 1;
      let currentTriesLeft = 3;
      let currentBirdHp = 3;

      // Main loop
      while (currentRound <= 3 && currentTriesLeft > 0) {
        // Bird call phase
        setPhase('bird-call');
        setContentMode('text');
        setDialogue('UWU BIRD used SCREECH!');
        setBirdAnimState('vibrating');

        const birdAudio = await playBirdCall();
        if (birdAudio) {
          await playAudio(birdAudio);
        }
        setBirdAnimState('idle');
        await delay(500);

        // Player turn — countdown then record
        setPhase('player-turn');
        setContentMode('text');
        setDialogue('YOUR TURN!');
        await delay(800);
        setDialogue('3...');
        await delay(500);
        setDialogue('2...');
        await delay(500);
        setDialogue('1...');
        await delay(500);
        setDialogue('GO!');
        setPlayerAnimState('vibrating');

        const playerAudio = await startRecording(3500, micStream, audioContext);
        setPlayerAnimState('idle');

        // Analysis
        setPhase('analysis');
        setContentMode('text');
        setDialogue('...');

        const result = await submitAudio(playerAudio);
        if (!result) throw new Error('No analysis result returned');

        if (result.score_token) {
          scoreTokenRef.current = result.score_token;
        }
        if (result.total_score != null) {
          totalScoreRef.current = result.total_score;
          setTotalScore(result.total_score);
        } else if (result.passed) {
          totalScoreRef.current += (result.performance_score ?? 0);
          setTotalScore(totalScoreRef.current);
        }

        // Show failure feedback
        if (!result.passed && result.failure_reason) {
          setDialogue(result.failure_reason);
          await delay(2000);
        }

        // Handle result
        setPhase('round-result');
        setContentMode('text');

        if (result.passed) {
          currentBirdHp--;
          setBirdHp(currentBirdHp);
          await drainHp(setBirdHpDisplay, currentBirdHp + 1, currentBirdHp);
          setDialogue(`Round ${currentRound} cleared!`);
          await delay(1500);
          currentRound++;
          setRound(currentRound);
        } else {
          currentTriesLeft--;
          setTriesLeft(currentTriesLeft);
          await drainHp(setPlayerHpDisplay, currentTriesLeft + 1, currentTriesLeft);

          if (currentTriesLeft > 0) {
            setDialogue('Try again!');
            await delay(1500);
          }
        }
      }

      // End game
      if (currentRound > 3) {
        // WIN
        setPhase('win');
        setContentMode('text');
        setDialogue('UWU BIRD fainted!');
        setBirdAnimState('video');
        await waitForBirdVideoEnd();
        setDialogue('YOU won the battle!');
        if (onGameEnd) onGameEnd('win', totalScoreRef.current, sid, scoreTokenRef.current);
      } else {
        // LOSE
        setPhase('lose');
        setContentMode('text');
        setPlayerAnimState('sliding-out');
        await delay(800);
        setDialogue('UWU BIRD is victorious!');
        setBirdAnimState('video');
        await waitForBirdVideoEnd();
        setDialogue('YOU blacked out!');
        if (onGameEnd) onGameEnd('lose', totalScoreRef.current, sid, scoreTokenRef.current);
      }
    } catch (err) {
      console.error('Battle error:', err);
      setDialogue('Error occurred during battle');
    }
  }, [sessionId, playBirdCall, submitAudio, playAudio, startRecording, drainHp, onGameEnd, waitForBirdVideoEnd]);

  // Intro sequence
  const playIntro = useCallback(async () => {
    setPhase('intro');
    setContentMode('text');

    setDialogue('Wild UWU BIRD appeared!');
    await delay(1600);
    setBirdAnimState('idle');

    setDialogue('GO! ANNOYED AUNTIE!');
    setPlayerPanelVisible(true);
    setPlayerAnimState('entering');
    await delay(1600);
    setPlayerAnimState('idle');

    await delay(500);
  }, []);

  // Single effect: start session then immediately run the battle loop.
  // The ref guard prevents StrictMode's double-invocation from launching
  // two parallel game loops.
  useEffect(() => {
    if (battleStartedRef.current) return;
    battleStartedRef.current = true;

    (async () => {
      try {
        const startResponse = await initializeGame();
        setSessionId(startResponse.session_id);
        setTriesLeft(startResponse.tries_left);
        await runBattle(startResponse.session_id);
      } catch (err) {
        console.error('Failed to start game:', err);
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="battle-scene">
      <BattleBackground />

      <div className="battle-score">SCORE: {totalScore.toLocaleString()}</div>

      <InfoPanel
        side="opponent"
        name={opponentName}
        level={opponentLevel}
        currentHp={birdHpDisplay}
        maxHp={100}
      />

      <PokemonSprite
        side="opponent"
        src={opponentSpriteUrl}
        videoSrc={birdAnimState === 'video' ? (phase === 'win' ? winVideoUrl : loseVideoUrl) : null}
        animationState={birdAnimState}
        onAnimationComplete={handleBirdAnimComplete}
      />

      <PokemonSprite
        side="player"
        src={playerSpriteUrl}
        animationState={playerAnimState}
        onAnimationComplete={setPlayerAnimState}
      />

      {playerPanelVisible && (
        <InfoPanel
          side="player"
          name={playerName}
          level={playerLevel}
          currentHp={playerHpDisplay}
          maxHp={100}
          triesLeft={triesLeft}
          maxTries={3}
        />
      )}

      <ContentFrame
        mode={contentMode}
        text={dialogue}
        textSpeed={50}
        chartData={chartData}
        chartLayout={chartLayout}
      />
    </div>
  );
}
