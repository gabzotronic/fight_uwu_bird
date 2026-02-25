/**
 * useAudioRecorder hook - captures mic audio and encodes as WAV
 * Uses AudioWorkletNode where available, falls back to ScriptProcessorNode.
 *
 * Expects a shared AudioContext (created during a user gesture in App.jsx)
 * so that iOS Safari doesn't block audio processing.
 */

import { useState } from 'react';

export function useAudioRecorder() {
  const [isRecording, setIsRecording] = useState(false);

  async function startRecording(durationMs = 3500, existingStream = null, sharedAudioContext = null) {
    try {
      let stream;
      if (existingStream) {
        stream = existingStream;
        console.log('[MIC] Reusing existing stream');
      } else {
        console.log('[MIC] Requesting getUserMedia...');
        stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: false,
            sampleRate: 44100,
          },
        });
        console.log('[MIC] getUserMedia granted, stream active:', stream.active);
      }

      // Reuse the shared AudioContext (created during user tap) when available.
      // Only create a new one as a last resort — iOS Safari will block it here.
      let audioContext;
      let ownsContext = false;
      if (sharedAudioContext && sharedAudioContext.state !== 'closed') {
        audioContext = sharedAudioContext;
        console.log('[MIC] Reusing shared AudioContext, state:', audioContext.state);
      } else {
        console.warn('[MIC] No shared AudioContext, creating new one (may fail on iOS)');
        audioContext = new (window.AudioContext || window.webkitAudioContext)({
          sampleRate: 44100,
        });
        ownsContext = true;
      }

      // Safety net: resume if suspended (helps Android, may not help iOS without gesture)
      if (audioContext.state === 'suspended') {
        console.log('[MIC] AudioContext suspended, resuming...');
        await audioContext.resume();
        console.log('[MIC] AudioContext resumed, state:', audioContext.state);
      }

      const source = audioContext.createMediaStreamSource(stream);
      const chunks = [];

      // Try AudioWorklet first (module pre-registered in App.jsx), fall back to ScriptProcessor
      let cleanup;
      try {
        const workletNode = new AudioWorkletNode(audioContext, 'recorder-processor');
        workletNode.port.onmessage = (e) => {
          chunks.push(e.data);
          if (chunks.length % 10 === 0) {
            console.log('[MIC] Recorded', chunks.length, 'chunks (worklet)');
          }
        };
        source.connect(workletNode);
        workletNode.connect(audioContext.destination);
        console.log('[MIC] Using AudioWorkletNode');
        cleanup = () => {
          workletNode.port.postMessage('stop');
          workletNode.disconnect();
        };
      } catch {
        console.warn('[MIC] AudioWorklet unavailable, falling back to ScriptProcessor');
        cleanup = setupScriptProcessor(audioContext, source, chunks);
      }

      console.log('[MIC] Recording started, will stop after', durationMs, 'ms');
      setIsRecording(true);

      return new Promise((resolve) => {
        setTimeout(() => {
          console.log('[MIC] Recording finished, total chunks:', chunks.length);
          const actualSampleRate = audioContext.sampleRate;
          cleanup();
          source.disconnect();
          if (!existingStream) stream.getTracks().forEach((t) => t.stop());
          if (ownsContext) audioContext.close();
          setIsRecording(false);

          const wavBlob = encodeWAV(chunks, actualSampleRate);
          console.log('[MIC] WAV encoded, size:', wavBlob.size, 'bytes, sampleRate:', actualSampleRate);
          resolve(wavBlob);
        }, durationMs);
      });
    } catch (error) {
      setIsRecording(false);
      throw error;
    }
  }

  return { startRecording, isRecording };
}

/**
 * Fallback: deprecated ScriptProcessorNode for browsers without AudioWorklet
 */
function setupScriptProcessor(audioContext, source, chunks) {
  const processor = audioContext.createScriptProcessor(4096, 1, 1);

  processor.onaudioprocess = (e) => {
    const data = e.inputBuffer.getChannelData(0);
    chunks.push(new Float32Array(data));
    if (chunks.length % 10 === 0) {
      console.log('[MIC] Recorded', chunks.length, 'chunks (ScriptProcessor)');
    }
  };

  source.connect(processor);
  processor.connect(audioContext.destination);
  console.log('[MIC] Using ScriptProcessorNode (fallback)');

  return () => {
    processor.disconnect();
  };
}

/**
 * Encode raw audio chunks as WAV blob
 */
function encodeWAV(chunks, sampleRate) {
  // Concatenate all chunks
  const length = chunks.reduce((acc, c) => acc + c.length, 0);
  const samples = new Float32Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    samples.set(chunk, offset);
    offset += chunk.length;
  }

  // Convert to 16-bit PCM and create WAV
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);

  // WAV header
  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + samples.length * 2, true);
  writeString(view, 8, 'WAVE');
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(view, 36, 'data');
  view.setUint32(40, samples.length * 2, true);

  // PCM samples
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }

  return new Blob([buffer], { type: 'audio/wav' });
}

function writeString(view, offset, str) {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i));
  }
}
