/**
 * useAudioPlayer hook - plays audio blobs
 */

import { useRef, useEffect } from 'react';

export function useAudioPlayer() {
  const audioRef = useRef(null);

  // Initialize audio element once
  useEffect(() => {
    if (!audioRef.current) {
      audioRef.current = new Audio();
      // Ensure audio context is resumed for autoplay policy
      audioRef.current.addEventListener('play', () => {
        if (window.AudioContext) {
          const ctx = window.AudioContext.getContext?.();
          if (ctx?.state === 'suspended') {
            ctx.resume();
          }
        }
      });
    }
  }, []);

  async function playAudio(blob) {
    return new Promise((resolve, reject) => {
      if (!audioRef.current) {
        reject(new Error('Audio not initialized'));
        return;
      }

      const audio = audioRef.current;
      const url = URL.createObjectURL(blob);

      // Clear any previous handlers
      audio.onended = null;
      audio.onerror = null;

      // Set up handlers
      const onEnded = () => {
        cleanup();
        resolve();
      };

      const onError = (error) => {
        cleanup();
        reject(new Error('Failed to play audio: ' + error.message));
      };

      const cleanup = () => {
        audio.onended = null;
        audio.onerror = null;
        // Delay revocation slightly to avoid issues
        setTimeout(() => URL.revokeObjectURL(url), 100);
      };

      audio.onended = onEnded;
      audio.onerror = onError;

      audio.volume = 1.0;
      audio.src = url;

      // Wait for the browser to decode enough to start cleanly,
      // then play — prevents the beginning being clipped.
      audio.oncanplay = () => {
        audio.oncanplay = null;
        audio.play().catch((error) => {
          if (error.name === 'AbortError') {
            cleanup();
            resolve();
            return;
          }
          console.error('Audio playback error:', error);
          reject(error);
        });
      };

      audio.load();
    });
  }

  function stopAudio() {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
  }

  return { playAudio, stopAudio };
}
