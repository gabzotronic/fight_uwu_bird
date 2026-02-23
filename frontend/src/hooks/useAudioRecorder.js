/**
 * useAudioRecorder hook - captures mic audio and encodes as WAV
 */

import { useState, useRef } from 'react';

export function useAudioRecorder() {
  const [isRecording, setIsRecording] = useState(false);
  const audioContextRef = useRef(null);

  async function startRecording(durationMs = 3500, existingStream = null) {
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
            noiseSuppression: true,
            sampleRate: 44100,
          },
        });
        console.log('[MIC] getUserMedia granted, stream active:', stream.active);
      }

      const audioContext = new (window.AudioContext || window.webkitAudioContext)({
        sampleRate: 44100,
      });
      audioContextRef.current = audioContext;
      console.log('[MIC] AudioContext created, state:', audioContext.state);

      const source = audioContext.createMediaStreamSource(stream);
      const chunks = [];
      const processor = audioContext.createScriptProcessor(4096, 1, 1);

      processor.onaudioprocess = (e) => {
        const data = e.inputBuffer.getChannelData(0);
        chunks.push(new Float32Array(data));
        if (chunks.length % 10 === 0) {
          console.log('[MIC] Recorded', chunks.length, 'chunks');
        }
      };

      source.connect(processor);
      processor.connect(audioContext.destination);
      console.log('[MIC] Recording started, will stop after', durationMs, 'ms');
      setIsRecording(true);

      return new Promise((resolve) => {
        setTimeout(() => {
          console.log('[MIC] Recording finished, total chunks:', chunks.length);
          processor.disconnect();
          source.disconnect();
          if (!existingStream) stream.getTracks().forEach((t) => t.stop());
          audioContext.close();
          setIsRecording(false);

          const wavBlob = encodeWAV(chunks, 44100);
          console.log('[MIC] WAV encoded, size:', wavBlob.size, 'bytes');
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
