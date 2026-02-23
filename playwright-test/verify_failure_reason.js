/**
 * Verifies that:
 *   1. failure_reason text is shown in the content frame after a failed round
 *   2. The Plotly chart (.plot-container) does NOT appear during the battle loop
 *
 * Run: node verify_failure_reason.js
 */

const { chromium } = require('playwright');
const path = require('path');
const fs   = require('fs');

const BASE_URL    = 'https://localhost:5173';
const SCREENSHOTS = path.join(__dirname, 'screenshots');
fs.mkdirSync(SCREENSHOTS, { recursive: true });

let shotIndex = 0;
async function shot(page, label) {
  const file = path.join(SCREENSHOTS, `verify_${String(++shotIndex).padStart(2,'0')}_${label}.png`);
  await page.screenshot({ path: file, fullPage: true });
  console.log(`📸  ${path.basename(file)}`);
}

// Mock getUserMedia with a flat 440 Hz tone — guaranteed to fail contour match
const MIC_MOCK = `(() => {
  navigator.mediaDevices.getUserMedia = async (constraints) => {
    if (!constraints || !constraints.audio) return;
    const ctx  = new AudioContext({ sampleRate: 44100 });
    const osc  = ctx.createOscillator();
    const dest = ctx.createMediaStreamDestination();
    osc.frequency.value = 440;
    osc.connect(dest);
    osc.start();
    return dest.stream;
  };
})();`;

// Known failure_reason strings from uwu_detector.py
const KNOWN_FAILURE_REASONS = [
  'Not enough sound detected',
  'Call too short',
  "That didn't sound like uwu",
  'Not high enough',
];

(async () => {
  const browser = await chromium.launch({
    headless: false,
    args: ['--autoplay-policy=no-user-gesture-required', '--use-fake-ui-for-media-stream'],
  });

  const context = await browser.newContext({
    permissions: ['microphone'],
    ignoreHTTPSErrors: true,
  });
  const page = await context.newPage();
  page.setDefaultTimeout(60_000);

  page.on('console', msg => {
    const t = msg.text();
    if (!t.includes('[vite]') && !t.includes('Download the React')) console.log(`[browser] ${t}`);
  });

  // Track whether a Plotly chart ever appeared
  let chartAppearedDuringBattle = false;
  let apiFailureReason = null;
  let analyzeCallDone = false;

  // Intercept /analyze to capture failure_reason from API
  await page.route('**/api/game/*/analyze', async (route) => {
    const response = await route.fetch();
    const body     = await response.json();
    console.log('\n══ /analyze ══════════════════════════════════');
    console.log('  passed              :', body.passed);
    console.log('  failure_reason key  :', 'failure_reason' in body ? `EXISTS = "${body.failure_reason}"` : 'MISSING from response');
    console.log('  contour_match       :', body.contour_match);
    console.log('  pitch_match         :', body.pitch_match);
    console.log('  pitch_chart         :', body.pitch_chart === null ? 'null ✅ (not generated)' : 'PRESENT ⚠️');
    if (body.failure_reason) apiFailureReason = body.failure_reason;
    analyzeCallDone = true;
    await route.fulfill({ response, body: JSON.stringify(body), contentType: 'application/json' });
  });

  await page.addInitScript(MIC_MOCK);
  await page.goto(BASE_URL, { waitUntil: 'networkidle' });
  await page.locator('button:has-text("START GAME")').click();
  await page.locator('.battle-scene').waitFor({ state: 'visible', timeout: 10_000 });
  await shot(page, '01_battle_start');

  // Poll for chart appearing (should NOT happen)
  const chartPollInterval = setInterval(async () => {
    const visible = await page.locator('.content-frame .plot-container').isVisible().catch(() => false);
    if (visible) chartAppearedDuringBattle = true;
  }, 300);

  // Step 1: wait for the "..." analyzing dialogue to appear
  console.log('\nWaiting for analysis phase ("...")...');
  await page.waitForFunction(
    () => document.querySelector('.typewriter-text')?.textContent?.includes('...'),
    { timeout: 30_000 }
  );
  console.log('  Analysis phase detected.');

  // Step 2: wait for "..." to be replaced by the feedback text
  console.log('Waiting for feedback text to appear...');
  await page.waitForFunction(
    () => {
      const text = document.querySelector('.typewriter-text')?.textContent || '';
      return text.length > 3 && !text.includes('...');
    },
    { timeout: 15_000 }
  );

  // Give typewriter a moment to finish typing
  await page.waitForTimeout(1_200);
  await shot(page, '02_after_analysis');

  clearInterval(chartPollInterval);

  // Read what's actually displayed in the content frame
  const displayedText = await page.evaluate(() =>
    document.querySelector('.typewriter-text')?.textContent?.trim() ?? ''
  );

  // ── Results ─────────────────────────────────────────────────────────────────
  console.log('\n══ VERIFICATION RESULTS ════════════════════════');

  // 1. failure_reason from API
  console.log('\n[1] API failure_reason:');
  if (apiFailureReason) {
    console.log(`    "${apiFailureReason}" ✅`);
  } else {
    console.log('    none (player passed on first try)');
  }

  // 2. failure_reason shown in UI
  console.log('\n[2] Text shown in content frame after analysis:');
  console.log(`    "${displayedText}"`);
  const feedbackShown = KNOWN_FAILURE_REASONS.some(r => displayedText.includes(r.split('!')[0]));
  if (feedbackShown) {
    console.log('    ✅  Matches a known failure_reason');
  } else if (!apiFailureReason) {
    console.log('    ℹ️   Player passed — no failure feedback expected');
  } else {
    console.log('    ❌  Displayed text does not match any known failure_reason');
  }

  // 3. Chart should NOT have appeared
  console.log('\n[3] Plotly chart appeared during battle loop:');
  if (chartAppearedDuringBattle) {
    console.log('    ❌  Chart appeared — should be disabled');
  } else {
    console.log('    ✅  Chart did NOT appear');
  }

  console.log('\n' + '═'.repeat(50));
  const allPassed = !chartAppearedDuringBattle && (feedbackShown || !apiFailureReason);
  console.log(allPassed ? '✅  ALL CHECKS PASSED' : '❌  SOME CHECKS FAILED');

  await page.waitForTimeout(2_000);
  await browser.close();
})();
