/**
 * Playwright smoke test for FIGHT UWU BIRD
 *
 * Mocks the microphone so the recording step completes silently,
 * lets the real backend handle analysis, and captures every console
 * message / network error / JS exception along the way.
 *
 * Run:  node test.js
 */

const { chromium } = require('playwright');
const path = require('path');
const fs   = require('fs');

const BASE_URL    = 'https://localhost:5173';
const SCREENSHOTS = path.join(__dirname, 'screenshots');
fs.mkdirSync(SCREENSHOTS, { recursive: true });

// ── helpers ──────────────────────────────────────────────────────────────────

let shotIndex = 0;
async function shot(page, label) {
  const file = path.join(SCREENSHOTS, `${String(++shotIndex).padStart(2,'0')}_${label}.png`);
  await page.screenshot({ path: file, fullPage: true });
  log(`📸  screenshot → ${path.basename(file)}`);
}

const logs   = [];
const errors = [];
function log(msg)   { console.log(msg);   logs.push(msg); }
function err(msg)   { console.error(msg); errors.push(msg); }

// ── microphone mock ───────────────────────────────────────────────────────────
// Injects into the page before any script runs.
// Creates a 440 Hz oscillator and wraps its stream in getUserMedia.
// Frequency-swept oscillator that mimics a rough "uwu" contour shape:
//   500 Hz → 800 Hz → 450 Hz → 750 Hz over 3.5 s
// A constant 440 Hz tone produces an all-zero semitone contour (flat ÷ own median),
// which causes the early-return in uwu_detector before chart data is populated.
const MIC_MOCK = `
  (() => {
    const origGetUserMedia = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    navigator.mediaDevices.getUserMedia = async (constraints) => {
      if (constraints && constraints.audio) {
        try {
          const ctx  = new AudioContext({ sampleRate: 44100 });
          const osc  = ctx.createOscillator();
          const dest = ctx.createMediaStreamDestination();
          const now  = ctx.currentTime;
          // Sweep through a rough uwu-shaped pitch contour
          osc.frequency.setValueAtTime(500, now);
          osc.frequency.linearRampToValueAtTime(800, now + 1.0);
          osc.frequency.linearRampToValueAtTime(450, now + 2.0);
          osc.frequency.linearRampToValueAtTime(750, now + 3.5);
          osc.connect(dest);
          osc.start();
          console.log('[mock] microphone replaced with frequency-swept oscillator (500→800→450→750 Hz)');
          return dest.stream;
        } catch (e) {
          console.warn('[mock] oscillator failed, falling back to real mic:', e.message);
          return origGetUserMedia(constraints);
        }
      }
      return origGetUserMedia(constraints);
    };
  })();
`;

// ── main ─────────────────────────────────────────────────────────────────────

(async () => {
  log('\n═══════════════════════════════════════════');
  log(' FIGHT UWU BIRD — Playwright smoke test');
  log('═══════════════════════════════════════════\n');

  const browser = await chromium.launch({
    headless: false,          // visible so we can watch + record
    slowMo:   0,
    args: [
      '--autoplay-policy=no-user-gesture-required',  // allow audio autoplay
      '--use-fake-ui-for-media-stream',              // auto-grant mic permission
    ],
  });

  const context = await browser.newContext({
    permissions: ['microphone'],
    ignoreHTTPSErrors: true,
  });

  const page = await context.newPage();
  page.setDefaultTimeout(30_000);

  // ── wire up logging ────────────────────────────────────────────────────────

  page.on('console', msg => {
    const type = msg.type();
    const text = msg.text();
    const line = `[console.${type}] ${text}`;
    if (type === 'error')   err(`❌  ${line}`);
    else if (type === 'warn') log(`⚠️   ${line}`);
    else                    log(`ℹ️   ${line}`);
  });

  page.on('pageerror', e => err(`❌  [pageerror] ${e.message}\n${e.stack}`));

  page.on('requestfailed', req =>
    err(`❌  [network] ${req.failure()?.errorText} — ${req.url()}`)
  );

  let intentionalClose = false;
  page.on('close', () => { if (!intentionalClose) err('❌  [page] PAGE CLOSED UNEXPECTEDLY'); });
  page.on('crash', () => err('❌  [page] PAGE CRASHED'));

  page.on('response', async res => {
    const url    = res.url();
    const status = res.status();
    if (url.includes('/api/') || url.includes('localhost:8000')) {
      const icon = status >= 400 ? '❌' : '✅';
      log(`${icon}  [api] ${status} ${res.request().method()} ${url}`);
      // Log pitch_chart presence for the analyze endpoint
      if (url.includes('/analyze') && res.request().method() === 'POST') {
        try {
          const body = await res.json();
          const hasChart = body.pitch_chart !== null && body.pitch_chart !== undefined;
          log(`    pitch_chart: ${hasChart ? 'PRESENT (' + body.pitch_chart.data.length + ' traces)' : JSON.stringify(body.pitch_chart)}`);
          log(`    performance_score: ${body.performance_score}`);   // only exists in new uwu_detector.py
          if (body.failure_reason) log(`    failure_reason: ${body.failure_reason}`);
          log(`    passed: ${body.passed}, contour_score: ${body.contour_score}`);
        } catch (e) {
          log(`    (could not parse response body: ${e.message})`);
        }
      }
    }
  });

  // ── inject mic mock before page scripts run ────────────────────────────────

  await page.addInitScript(MIC_MOCK);

  // ─────────────────────────────────────────────────────────────────────────
  // STEP 1 — load the page
  // ─────────────────────────────────────────────────────────────────────────
  log('\n── STEP 1: Load title screen ──');
  await page.goto(BASE_URL, { waitUntil: 'networkidle' });
  await shot(page, 'title_screen');

  // Check for the Start Game button
  const btn = page.locator('button:has-text("START GAME")');
  const btnVisible = await btn.isVisible().catch(() => false);
  log(`START GAME button visible: ${btnVisible}`);
  if (!btnVisible) {
    err('❌  START GAME button not found — aborting');
    await browser.close();
    printSummary();
    process.exit(1);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // STEP 2 — click Start Game, wait for battle scene
  // ─────────────────────────────────────────────────────────────────────────
  log('\n── STEP 2: Click START GAME ──');
  await btn.click();
  await shot(page, 'after_start_click');

  // Battle scene should appear
  const battleScene = page.locator('.battle-scene');
  try {
    await battleScene.waitFor({ state: 'visible', timeout: 5_000 });
    log('✅  .battle-scene is visible');
  } catch {
    err('❌  .battle-scene never appeared');
    await shot(page, 'battle_scene_missing');
  }

  // ─────────────────────────────────────────────────────────────────────────
  // STEP 3 — intro sequence: both sprites enter
  // ─────────────────────────────────────────────────────────────────────────
  log('\n── STEP 3: Intro sequence ──');
  await page.waitForTimeout(500);
  await shot(page, 'intro_bird_entering');

  // Wait for intro dialogue
  try {
    await page.waitForFunction(
      () => document.querySelector('.typewriter-text')?.textContent?.includes('Wild UWU BIRD'),
      { timeout: 5_000 }
    );
    log('✅  "Wild UWU BIRD appeared!" dialogue shown');
  } catch {
    err('❌  Intro dialogue "Wild UWU BIRD appeared!" not seen');
  }

  await page.waitForTimeout(1_200);
  await shot(page, 'intro_player_entering');

  try {
    await page.waitForFunction(
      () => document.querySelector('.typewriter-text')?.textContent?.includes('ANNOYED AUNTIE'),
      { timeout: 5_000 }
    );
    log('✅  "GO! ANNOYED AUNTIE!" dialogue shown');
  } catch {
    err('❌  "GO! ANNOYED AUNTIE!" dialogue not seen');
  }

  // Check sprite images are rendered
  await page.waitForTimeout(1_200);
  const opponentImg = page.locator('img.sprite--opponent');
  const playerImg   = page.locator('img.sprite--player');
  log(`opponent sprite visible: ${await opponentImg.isVisible().catch(() => false)}`);
  log(`player sprite visible:   ${await playerImg.isVisible().catch(() => false)}`);

  // Check info panels
  const panels = page.locator('.info-panel');
  const panelCount = await panels.count();
  log(`info panels rendered: ${panelCount} (expected 2)`);
  if (panelCount !== 2) err(`❌  Expected 2 info panels, got ${panelCount}`);

  // Check HP bars (.progress-bar-container divs, not <progress> elements)
  const hpBars = page.locator('.progress-bar-container');
  const hpBarCount = await hpBars.count();
  log(`HP bar containers rendered: ${hpBarCount} (expected 2)`);
  if (hpBarCount < 2) err(`❌  Expected 2 HP bar containers, got ${hpBarCount}`);

  await shot(page, 'intro_complete');

  // ─────────────────────────────────────────────────────────────────────────
  // STEP 4 — bird call phase
  // ─────────────────────────────────────────────────────────────────────────
  log('\n── STEP 4: Bird call phase ──');

  try {
    await page.waitForFunction(
      () => document.querySelector('.typewriter-text')?.textContent?.includes('SCREECH'),
      { timeout: 30_000 }
    );
    log('✅  "UWU BIRD used SCREECH!" shown');
    await shot(page, 'bird_call_phase');
  } catch {
    err('❌  Bird call phase dialogue not seen');
    await shot(page, 'bird_call_phase_missing');
  }

  // Check bird sprite is vibrating
  await page.waitForTimeout(300);
  const birdVibrating = await page.locator('.sprite--vibrating').isVisible().catch(() => false);
  log(`bird sprite vibrating: ${birdVibrating}`);

  // ─────────────────────────────────────────────────────────────────────────
  // STEP 5 — player turn phase (mic is mocked)
  // ─────────────────────────────────────────────────────────────────────────
  log('\n── STEP 5: Player turn phase (mock mic) ──');

  try {
    await page.waitForFunction(
      () => document.querySelector('.typewriter-text')?.textContent?.includes('YOUR TURN'),
      { timeout: 30_000 }  // bird call can take a few seconds
    );
    log('✅  "YOUR TURN!" shown');
    await shot(page, 'player_turn');
  } catch {
    err('❌  Player turn phase not reached');
    await shot(page, 'player_turn_missing');
  }

  // Check player sprite vibrating
  await page.waitForTimeout(300);
  const playerVibrating = await page.locator('.sprite--vibrating').isVisible().catch(() => false);
  log(`player sprite vibrating: ${playerVibrating}`);

  // ─────────────────────────────────────────────────────────────────────────
  // STEP 6 — analysis phase (3.5s recording + API call)
  // ─────────────────────────────────────────────────────────────────────────
  log('\n── STEP 6: Analysis phase ──');

  try {
    await page.waitForFunction(
      () => document.querySelector('.typewriter-text')?.textContent?.trim() === '...',
      { timeout: 30_000 }
    );
    log('✅  Analysis "..." shown');
    await shot(page, 'analysis_phase');
  } catch {
    err('❌  Analysis phase not seen');
    await shot(page, 'analysis_phase_missing');
  }

  // ─────────────────────────────────────────────────────────────────────────
  // STEP 7 — pitch chart appears
  // ─────────────────────────────────────────────────────────────────────────
  log('\n── STEP 7: Pitch chart ──');

  try {
    // Plotly renders a .plot-container inside .content-frame
    await page.waitForSelector('.content-frame .plot-container', { timeout: 30_000 });
    log('✅  Plotly pitch chart rendered');
    await shot(page, 'pitch_chart');
  } catch {
    err('❌  Plotly chart never appeared in content frame');
    await shot(page, 'pitch_chart_missing');
  }

  // ─────────────────────────────────────────────────────────────────────────
  // STEP 8 — round result text
  // ─────────────────────────────────────────────────────────────────────────
  log('\n── STEP 8: Round result ──');

  try {
    await page.waitForFunction(
      () => {
        const t = document.querySelector('.typewriter-text')?.textContent || '';
        return t.includes('cleared') || t.includes('Try again') || t.includes('tries left');
      },
      { timeout: 30_000 }
    );
    const resultText = await page.locator('.typewriter-text').textContent();
    log(`✅  Round result text: "${resultText.trim()}"`);
    await shot(page, 'round_result');
  } catch {
    err('❌  Round result text not seen after chart');
    await shot(page, 'round_result_missing');
  }

  // ─────────────────────────────────────────────────────────────────────────
  // STEP 9 — HP bars: check they updated (class should no longer be p100 for
  //          at least one bar after a fail, or bird bar after a pass)
  // ─────────────────────────────────────────────────────────────────────────
  log('\n── STEP 9: HP bar state ──');
  const hpContainers = await page.locator('.progress-bar-container').all();
  for (const container of hpContainers) {
    const bar = container.locator('.progress-bar');
    const cls = await bar.getAttribute('class').catch(() => null);
    log(`  .progress-bar class="${cls}"`);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // done — let the page sit for a moment then close
  // ─────────────────────────────────────────────────────────────────────────
  log('\n── Observing for 3s then closing ──');
  await page.waitForTimeout(3_000);
  await shot(page, 'final_state');

  intentionalClose = true;
  await browser.close();
  printSummary();
})().catch(async e => {
  err(`❌  Unhandled error: ${e.message}\n${e.stack}`);
  printSummary();
  process.exit(1);
});

function printSummary() {
  console.log('\n═══════════════════════════════════════════');
  console.log(' SUMMARY');
  console.log('═══════════════════════════════════════════');
  if (errors.length === 0) {
    console.log('✅  No errors detected');
  } else {
    console.log(`❌  ${errors.length} error(s) found:\n`);
    errors.forEach((e, i) => console.log(`  ${i+1}. ${e}`));
  }
  console.log(`\nScreenshots saved to: ${SCREENSHOTS}`);
  console.log('═══════════════════════════════════════════\n');
}
