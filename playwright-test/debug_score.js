/**
 * debug_score.js — targeted test for the SCORE display
 *
 * - Uses backend/user_input.wav as microphone input (looped)
 * - Intercepts each /analyze API response and logs performance_score
 * - Checks the .battle-score DOM element after every round
 *
 * Run:  node debug_score.js
 */

const { chromium } = require('playwright');
const path = require('path');
const fs   = require('fs');

const BASE_URL    = 'https://localhost:5173';
const WAV_PATH    = path.join(__dirname, '..', 'backend', 'assets', 'uwu_round_3.wav');
const SCREENSHOTS = path.join(__dirname, 'screenshots');
fs.mkdirSync(SCREENSHOTS, { recursive: true });

// ── helpers ──────────────────────────────────────────────────────────────────
let shotIndex = 0;
async function shot(page, label) {
  const file = path.join(SCREENSHOTS, `score_${String(++shotIndex).padStart(2,'0')}_${label}.png`);
  await page.screenshot({ path: file, fullPage: true });
  log(`📸  ${path.basename(file)}`);
}

const errors = [];
function log(msg) { console.log(msg); }
function err(msg) { console.error(msg); errors.push(msg); }

// ── encode WAV as base64 ──────────────────────────────────────────────────────
if (!fs.existsSync(WAV_PATH)) {
  err(`❌  user_input.wav not found at ${WAV_PATH}`);
  process.exit(1);
}
const wavBase64 = fs.readFileSync(WAV_PATH).toString('base64');
log(`✅  Loaded user_input.wav (${(wavBase64.length * 0.75 / 1024).toFixed(1)} KB)`);

// ── mic mock — plays user_input.wav through AudioContext ─────────────────────
const MIC_MOCK = `
  (() => {
    const WAV_B64 = '${wavBase64}';

    function b64ToArrayBuffer(b64) {
      const bin = atob(b64);
      const buf = new ArrayBuffer(bin.length);
      const view = new Uint8Array(buf);
      for (let i = 0; i < bin.length; i++) view[i] = bin.charCodeAt(i);
      return buf;
    }

    navigator.mediaDevices.getUserMedia = async (constraints) => {
      if (constraints && constraints.audio) {
        const ctx  = new AudioContext({ sampleRate: 44100 });
        const ab   = b64ToArrayBuffer(WAV_B64);
        const decoded = await ctx.decodeAudioData(ab);
        const dest = ctx.createMediaStreamDestination();
        const src  = ctx.createBufferSource();
        src.buffer = decoded;
        src.loop   = true;
        src.connect(dest);
        src.start();
        console.log('[mock] mic → user_input.wav (' + decoded.duration.toFixed(2) + 's, looped)');
        return dest.stream;
      }
      throw new Error('getUserMedia: non-audio constraints not supported in mock');
    };
  })();
`;

// ── main ─────────────────────────────────────────────────────────────────────
(async () => {
  log('\n═══════════════════════════════════════════');
  log(' SCORE DEBUG TEST — user_input.wav mic');
  log('═══════════════════════════════════════════\n');

  const browser = await chromium.launch({
    headless: false,
    slowMo: 0,
    args: [
      '--autoplay-policy=no-user-gesture-required',
      '--use-fake-ui-for-media-stream',
    ],
  });

  const context = await browser.newContext({
    permissions: ['microphone'],
    ignoreHTTPSErrors: true,
  });

  const page = await context.newPage();
  page.setDefaultTimeout(60_000);

  // ── logging ────────────────────────────────────────────────────────────────
  page.on('console', msg => {
    const t = msg.type();
    const txt = msg.text();
    if (t === 'error') err(`❌  [console.error] ${txt}`);
    else log(`ℹ️   [console.${t}] ${txt}`);
  });
  page.on('pageerror', e => err(`❌  [pageerror] ${e.message}`));

  // ── intercept /analyze responses ───────────────────────────────────────────
  let roundNum = 0;
  page.on('response', async res => {
    if (res.url().includes('/analyze') && res.request().method() === 'POST') {
      try {
        const body = await res.json();
        roundNum++;
        log(`\n── /analyze response (attempt ${roundNum}) ────────────────`);
        log(`   passed:            ${body.passed}`);
        log(`   contour_score:     ${body.contour_score}`);
        log(`   performance_score: ${body.performance_score}`);
        log(`   failure_reason:    ${body.failure_reason ?? 'none'}`);

        // Check DOM score after a short delay for React to re-render
        await page.waitForTimeout(300);
        const domScore = await page.locator('.battle-score').textContent().catch(() => 'NOT FOUND');
        log(`   DOM .battle-score: "${domScore}"`);
      } catch (e) {
        err(`   (could not parse /analyze response: ${e.message})`);
      }
    }
  });

  // ── inject mic mock ────────────────────────────────────────────────────────
  await page.addInitScript(MIC_MOCK);

  // ── load page ──────────────────────────────────────────────────────────────
  log('\n── Loading title screen ──');
  await page.goto(BASE_URL, { waitUntil: 'networkidle' });
  await shot(page, 'title');

  // ── start game ────────────────────────────────────────────────────────────
  const btn = page.locator('button:has-text("START GAME")');
  await btn.waitFor({ state: 'visible' });
  log('── Clicking START GAME ──');
  await btn.click();

  await page.locator('.battle-scene').waitFor({ state: 'visible', timeout: 5_000 });
  log('✅  Battle scene visible');

  // Check initial score
  const initScore = await page.locator('.battle-score').textContent().catch(() => 'NOT FOUND');
  log(`\n   Initial DOM .battle-score: "${initScore}"`);
  await shot(page, 'battle_start');

  // ── let the full game run (up to 3 rounds × 3 tries = 9 attempts max) ─────
  log('\n── Waiting for game end (win or lose screen)... ──');
  try {
    await page.waitForFunction(
      () => {
        const t = document.querySelector('.typewriter-text')?.textContent || '';
        return t.includes('fainted') || t.includes('blacked out') || t.includes('won') || t.includes('victorious');
      },
      { timeout: 120_000 }
    );
    const endText = await page.locator('.typewriter-text').textContent();
    log(`\n✅  Game ended: "${endText.trim()}"`);
  } catch {
    err('❌  Game did not reach end state within 2 minutes');
  }

  // Final battle-scene score
  const finalScore = await page.locator('.battle-score').textContent().catch(() => 'NOT FOUND');
  log(`\n   Final DOM .battle-score: "${finalScore}"`);
  await shot(page, 'game_end');

  // Wait for ResultScreen to appear
  log('\n── Waiting for ResultScreen... ──');
  try {
    await page.waitForSelector('.result-screen', { timeout: 10_000 });
    log('✅  .result-screen visible');

    const resultTitle = await page.locator('.result-title').textContent().catch(() => 'NOT FOUND');
    const resultScore = await page.locator('.result-score').textContent().catch(() => 'NOT FOUND');
    log(`   .result-title: "${resultTitle}"`);
    log(`   .result-score: "${resultScore}"`);
    await shot(page, 'result_screen');
  } catch {
    err('❌  .result-screen never appeared');
    await shot(page, 'result_screen_missing');
  }

  await page.waitForTimeout(2_000);
  await browser.close();

  // ── summary ────────────────────────────────────────────────────────────────
  log('\n═══════════════════════════════════════════');
  log(' SUMMARY');
  log('═══════════════════════════════════════════');
  if (errors.length === 0) log('✅  No errors');
  else {
    log(`❌  ${errors.length} error(s):`);
    errors.forEach((e, i) => log(`  ${i + 1}. ${e}`));
  }
  log('═══════════════════════════════════════════\n');

})().catch(e => {
  err(`❌  Fatal: ${e.message}\n${e.stack}`);
  process.exit(1);
});
