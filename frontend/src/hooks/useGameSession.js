/**
 * useGameSession hook - manages game state and API interactions
 */

import { useState, useCallback, useRef } from 'react';
import { startGame, getBirdCall, analyzeAudio } from '../api/gameApi';
import { trackEvent } from '../analytics';

export const GameState = {
  IDLE: 'idle',
  BIRD_CALLING: 'bird_calling',
  PLAYER_TURN: 'player_turn',
  ANALYZING: 'analyzing',
  WIN_SCREEN: 'win_screen',
  LOSE_SCREEN: 'lose_screen',
};

function failureKey(reason) {
  if (!reason) return null;
  if (reason.includes('Not enough sound')) return 'no_voice';
  if (reason.includes('too short')) return 'too_short';
  if (reason.includes("didn't sound like")) return 'bad_contour';
  if (reason.includes('Not high enough')) return 'low_pitch';
  return 'unknown';
}

export function useGameSession() {
  const [state, setState] = useState(GameState.IDLE);
  const [sessionId, setSessionId] = useState(null);
  const [round, setRound] = useState(1);
  const [message, setMessage] = useState('');
  const [lastAnalysis, setLastAnalysis] = useState(null);
  const [error, setError] = useState(null);

  // Refs so that playBirdCall / submitAudio always see the latest values
  // even when called from a stale closure (e.g. a useEffect with [] deps).
  const sessionIdRef = useRef(null);
  const roundRef = useRef(1);

  const initializeGame = useCallback(async () => {
    try {
      setError(null);
      const data = await startGame();
      sessionIdRef.current = data.session_id;
      roundRef.current = data.round;
      setSessionId(data.session_id);
      setRound(data.round);
      setMessage(data.message);
      setState(GameState.BIRD_CALLING);
      trackEvent('game_start');
      return data;
    } catch (err) {
      setError(err.message);
      setState(GameState.IDLE);
      throw err;
    }
  }, []);

  const playBirdCall = useCallback(async () => {
    const sid = sessionIdRef.current;
    if (!sid) return null;
    try {
      setError(null);
      const blob = await getBirdCall(sid, roundRef.current);
      return blob;
    } catch (err) {
      setError(err.message);
      return null;
    }
  }, []);

  const submitAudio = useCallback(
    async (audioBlob) => {
      const sid = sessionIdRef.current;
      if (!sid) return null;
      try {
        setError(null);
        setState(GameState.ANALYZING);
        const analysis = await analyzeAudio(sid, audioBlob);

        setLastAnalysis(analysis);
        setMessage(analysis.message);

        trackEvent('round_attempt', {
          round: roundRef.current,
          passed: analysis.passed,
          performance_score: analysis.performance_score,
          failure: failureKey(analysis.failure_reason),
          contour_match: analysis.contour_match ?? null,
          pitch_match: analysis.pitch_match ?? null,
        });

        if (analysis.game_over) {
          trackEvent('game_over', {
            result: analysis.result,
            rounds_played: roundRef.current,
          });
          if (analysis.result === 'win') {
            setState(GameState.WIN_SCREEN);
          } else {
            setState(GameState.LOSE_SCREEN);
          }
        } else {
          roundRef.current = analysis.next_round;
          setRound(analysis.next_round);
          setState(GameState.BIRD_CALLING);
        }

        return analysis;
      } catch (err) {
        setError(err.message);
        setState(GameState.PLAYER_TURN);
        return null;
      }
    },
    [] // reads sessionId/round from refs — stable across renders
  );

  const reset = useCallback(() => {
    sessionIdRef.current = null;
    roundRef.current = 1;
    setState(GameState.IDLE);
    setSessionId(null);
    setRound(1);
    setMessage('');
    setLastAnalysis(null);
    setError(null);
  }, []);

  return {
    state,
    setState,
    sessionId,
    round,
    message,
    lastAnalysis,
    error,
    setError,
    initializeGame,
    playBirdCall,
    submitAudio,
    reset,
  };
}
