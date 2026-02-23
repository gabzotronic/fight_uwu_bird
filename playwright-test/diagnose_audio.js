/**
 * Diagnoses bird call audio clipping by capturing precise timestamps
 * for every audio event and measuring gap between play() and actual output.
 * Run: node diagnose_audio.js
 */

const { chromium } = require('playwright');
const path = require('path');
const fs   = require('fs');

const BASE_URL    = 'http://localhost:5173';
const SCREENSHOTS = path.join(__dirname, 'screenshots');
fs.mkdirSync(SCREENSHOTS, { recursive: true });

let shotIndex = 0;
async function shot(page, label) {
  const file = path.join(SCREENSHOTS, `audio_${String(++shotIndex).padStart(2,'0')}_${label}.png`);
  await page.screenshot({ path: file });
  console.log(`📸  ${path.basename(file)}`);
}

// Patches the Audio constructor and the audio element used in useAudioPlayer
// to log every relevant event with a high-res timestamp.
const AUDIO_INSPECTOR = `
(() => {
  window.__audioLog = [];

  function log(event, extra) {
    const entry = { t: performance.now().toFixed(2), event, ...extra };
    window.__audioLog.push(entry);
    console.log('[audio] ' + JSON.stringify(entry));
  }

  const OrigAudio = window.Audio;
  window.Audio = function(...args) {
    const el = new OrigAudio(...args);

    const events = [
      'loadstart', 'durationchange', 'loadedmetadata', 'loadeddata',
      'canplay', 'canplaythrough', 'play', 'playing',
      'pause', 'ended', 'error', 'stalled', 'waiting', 'suspend'
    ];

    events.forEach(name => {
      el.addEventListener(name, () => {
        log(name, {
          src: el.src ? el.src.slice(0, 60) : null,
          currentTime: el.currentTime.toFixed(4),
          duration: isFinite(el.duration) ? el.duration.toFixed(4) : 'unknown',
          readyState: el.readyState,
          paused: el.paused,
        });
      });
    });

    return el;
  };
  window.Audio.prototype = OrigAudio.prototype;
})();
`;

const MIC_MOCK = `
(() => {
  navigator.mediaDevices.getUserMedia = async (constraints) => {
    if (constraints && constraints.audio) {
      const ctx  = new AudioContext({ sampleRate: 44100 });
      const osc  = ctx.createOscillator();
      const dest = ctx.createMediaStreamDestination();
      osc.frequency.value = 440;
      osc.connect(dest);
      osc.start();
      return dest.stream;
    }
  };
})();
`;

(async () => {
  const browser = await chromium.launch({
    headless: false,
    args: [
      '--autoplay-policy=no-user-gesture-required',
      '--use-fake-ui-for-media-stream',
    ],
  });

  const context = await browser.newContext({ permissions: ['microphone'] });
  const page    = await context.newPage();
  page.setDefaultTimeout(60_000);

  // Wire up console relay
  page.on('console', msg => {
    if (msg.text().startsWith('[audio]')) {
      console.log('  ' + msg.text());
    }
  });

  await page.addInitScript(AUDIO_INSPECTOR);
  await page.addInitScript(MIC_MOCK);

  await page.goto(BASE_URL, { waitUntil: 'networkidle' });
  await page.locator('button:has-text("START GAME")').click();
  await page.locator('.battle-scene').waitFor({ state: 'visible' });

  // Wait for first bird call phase
  console.log('\nWaiting for bird call...');
  await page.waitForFunction(
    () => document.querySelector('.typewriter-text')?.textContent?.includes('SCREECH'),
    { timeout: 15_000 }
  );
  console.log('Bird call phase reached.');
  await shot(page, 'bird_call');

  // Wait for player turn (means bird call audio finished)
  console.log('\nWaiting for player turn (audio must finish first)...');
  await page.waitForFunction(
    () => document.querySelector('.typewriter-text')?.textContent?.includes('YOUR TURN'),
    { timeout: 20_000 }
  );
  console.log('Player turn reached — bird call audio completed.');
  await shot(page, 'player_turn');

  // Pull the full audio log and analyse
  const audioLog = await page.evaluate(() => window.__audioLog);

  console.log('\n══ AUDIO EVENT TIMELINE ══════════════════════════');
  audioLog.forEach(e => console.log(`  t=${e.t}ms  ${e.event.padEnd(16)} cur=${e.currentTime}  dur=${e.duration}  ready=${e.readyState}`));

  // Key metrics
  const playEvt     = audioLog.find(e => e.event === 'play');
  const playingEvt  = audioLog.find(e => e.event === 'playing');
  const canplayEvt  = audioLog.find(e => e.event === 'canplay');
  const endedEvt    = audioLog.find(e => e.event === 'ended');

  console.log('\n══ KEY GAPS ══════════════════════════════════════');
  if (canplayEvt && playEvt) {
    console.log(`  canplay → play:    ${(parseFloat(playEvt.t) - parseFloat(canplayEvt.t)).toFixed(1)} ms`);
  }
  if (playEvt && playingEvt) {
    console.log(`  play    → playing: ${(parseFloat(playingEvt.t) - parseFloat(playEvt.t)).toFixed(1)} ms  ← gap before audio actually outputs`);
  }
  if (playEvt && endedEvt) {
    const playbackMs = parseFloat(endedEvt.t) - parseFloat(playEvt.t);
    const durationMs = endedEvt.duration !== 'unknown' ? parseFloat(endedEvt.duration) * 1000 : null;
    console.log(`  play    → ended:   ${playbackMs.toFixed(1)} ms`);
    if (durationMs) {
      console.log(`  audio duration:    ${durationMs.toFixed(1)} ms`);
      console.log(`  clipped start:     ${(durationMs - playbackMs).toFixed(1)} ms  ${durationMs - playbackMs > 100 ? '⚠️  CLIPPED' : '✅  ok'}`);
    }
  }

  await page.waitForTimeout(2_000);
  await browser.close();
})();
