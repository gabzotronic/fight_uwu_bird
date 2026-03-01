/**
 * API-level test for the leaderboard flow.
 * Tests: start game → analyze (mock) → submit to leaderboard
 *
 * Run: node test_leaderboard_api.js
 * Requires: backend running on http://localhost:8000
 */

const fs = require('fs');
const path = require('path');

const BASE = 'http://localhost:8000';

async function main() {
  console.log('\n=== Leaderboard API Test ===\n');

  // 1. Health check
  console.log('1. Health check...');
  const health = await fetch(`${BASE}/api/health`).then(r => r.json());
  console.log('   OK:', health.status);

  // 2. GET leaderboard (before)
  console.log('\n2. GET /api/leaderboard...');
  const lb1 = await fetch(`${BASE}/api/leaderboard`).then(r => r.json());
  console.log('   Entries:', lb1.entries.length);

  // 3. Start game
  console.log('\n3. POST /api/game/start...');
  const game = await fetch(`${BASE}/api/game/start`, { method: 'POST' }).then(r => r.json());
  console.log('   session_id:', game.session_id);
  console.log('   round:', game.round);

  // 4. Create a fake WAV file (silent, 1 second, 44100Hz mono 16-bit)
  const sampleRate = 44100;
  const numSamples = sampleRate * 1; // 1 second
  const bitsPerSample = 16;
  const numChannels = 1;
  const byteRate = sampleRate * numChannels * bitsPerSample / 8;
  const blockAlign = numChannels * bitsPerSample / 8;
  const dataSize = numSamples * blockAlign;

  // Generate a 500Hz sine wave instead of silence
  const buffer = Buffer.alloc(44 + dataSize);
  // WAV header
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16); // chunk size
  buffer.writeUInt16LE(1, 20);  // PCM
  buffer.writeUInt16LE(numChannels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(byteRate, 28);
  buffer.writeUInt16LE(blockAlign, 32);
  buffer.writeUInt16LE(bitsPerSample, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);

  // Write sine wave samples
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const sample = Math.sin(2 * Math.PI * 500 * t) * 16000;
    buffer.writeInt16LE(Math.round(sample), 44 + i * 2);
  }

  // 5. Submit audio for 3 rounds (will likely fail, but we get a score_token on game_lost)
  let lastResult = null;
  let roundNum = 1;
  for (let attempt = 0; attempt < 5; attempt++) {
    console.log(`\n5.${attempt + 1}. POST /api/game/${game.session_id}/analyze (round ${roundNum})...`);
    const formData = new FormData();
    formData.append('audio', new Blob([buffer], { type: 'audio/wav' }), 'recording.wav');

    const resp = await fetch(`${BASE}/api/game/${game.session_id}/analyze`, {
      method: 'POST',
      body: formData,
    });

    if (!resp.ok) {
      console.log('   ERROR:', resp.status, await resp.text());
      break;
    }

    lastResult = await resp.json();
    console.log('   passed:', lastResult.passed);
    console.log('   performance_score:', lastResult.performance_score);
    console.log('   total_score:', lastResult.total_score);
    console.log('   score_token:', lastResult.score_token ? lastResult.score_token.substring(0, 16) + '...' : null);
    console.log('   game_over:', lastResult.game_over);
    console.log('   result:', lastResult.result);

    if (lastResult.game_over) break;
    if (lastResult.next_round) roundNum = lastResult.next_round;
  }

  if (!lastResult || !lastResult.score_token) {
    console.log('\n   ERROR: No score_token received. Cannot test leaderboard submission.');
    process.exit(1);
  }

  // 6. Try to submit with INVALID token (should get 403)
  console.log('\n6. POST /api/leaderboard with FAKE token...');
  const fakeResp = await fetch(`${BASE}/api/leaderboard`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'HACKER',
      score: lastResult.total_score,
      session_id: game.session_id,
      token: 'fake_token',
    }),
  });
  console.log('   Status:', fakeResp.status, '(expected 403)');
  const fakeBody = await fakeResp.json();
  console.log('   Body:', JSON.stringify(fakeBody));

  // 7. Submit with VALID token
  console.log('\n7. POST /api/leaderboard with VALID token...');
  const validResp = await fetch(`${BASE}/api/leaderboard`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'APITEST',
      score: lastResult.total_score,
      session_id: game.session_id,
      token: lastResult.score_token,
    }),
  });
  console.log('   Status:', validResp.status, '(expected 200)');
  const validBody = await validResp.json();
  console.log('   player_rank:', validBody.player_rank);
  console.log('   entries:', validBody.entries?.length);

  // 8. Test profanity filter
  console.log('\n8. POST /api/leaderboard with profane name...');
  // Start a new game to get a fresh token
  const game2 = await fetch(`${BASE}/api/game/start`, { method: 'POST' }).then(r => r.json());
  let result2 = null;
  for (let attempt = 0; attempt < 5; attempt++) {
    const formData = new FormData();
    formData.append('audio', new Blob([buffer], { type: 'audio/wav' }), 'recording.wav');
    const resp = await fetch(`${BASE}/api/game/${game2.session_id}/analyze`, {
      method: 'POST',
      body: formData,
    });
    result2 = await resp.json();
    if (result2.game_over) break;
  }

  if (result2?.score_token) {
    const profaneResp = await fetch(`${BASE}/api/leaderboard`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'SHIT',
        score: result2.total_score,
        session_id: game2.session_id,
        token: result2.score_token,
      }),
    });
    console.log('   Status:', profaneResp.status, '(expected 400)');
    const profaneBody = await profaneResp.json();
    console.log('   Body:', JSON.stringify(profaneBody));
  }

  // 9. Final leaderboard
  console.log('\n9. GET /api/leaderboard (final)...');
  const lb2 = await fetch(`${BASE}/api/leaderboard`).then(r => r.json());
  lb2.entries.forEach((e, i) => console.log(`   ${i + 1}. ${e.name} - ${e.score}`));

  console.log('\n=== DONE ===\n');
}

main().catch(e => {
  console.error('FATAL:', e);
  process.exit(1);
});
