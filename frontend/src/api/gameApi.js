/**
 * API wrapper functions for the FIGHT UWU BIRD backend
 */

// Use relative paths so Vite's dev proxy handles forwarding to :8000
// (avoids CORS issues in dev; works in production when served from same origin)
const API_BASE = import.meta.env.VITE_API_URL || '';

export async function startGame() {
  const resp = await fetch(`${API_BASE}/api/game/start`, {
    method: 'POST',
  });
  if (!resp.ok) throw new Error('Failed to start game');
  return resp.json();
}

export async function getBirdCall(sessionId, round) {
  const resp = await fetch(
    `${API_BASE}/api/game/${sessionId}/bird-call?round=${round}`
  );
  if (!resp.ok) throw new Error('Failed to get bird call');
  return resp.blob();
}

export async function analyzeAudio(sessionId, audioBlob) {
  const formData = new FormData();
  formData.append('audio', audioBlob, 'recording.wav');

  const resp = await fetch(
    `${API_BASE}/api/game/${sessionId}/analyze`,
    {
      method: 'POST',
      body: formData,
    }
  );
  if (!resp.ok) throw new Error('Failed to analyze audio');
  return resp.json();
}

export async function healthCheck() {
  const resp = await fetch(`${API_BASE}/api/health`);
  if (!resp.ok) throw new Error('Health check failed');
  return resp.json();
}
