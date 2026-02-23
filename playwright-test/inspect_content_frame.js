/**
 * Inspects the content-frame and Plotly chart dimensions at runtime.
 * Run: node inspect_content_frame.js
 */

const { chromium } = require('playwright');
const path = require('path');
const fs   = require('fs');

const BASE_URL    = 'http://localhost:5173';
const SCREENSHOTS = path.join(__dirname, 'screenshots');
fs.mkdirSync(SCREENSHOTS, { recursive: true });

let shotIndex = 0;
async function shot(page, label) {
  const file = path.join(SCREENSHOTS, `inspect_${String(++shotIndex).padStart(2,'0')}_${label}.png`);
  await page.screenshot({ path: file, fullPage: true });
  console.log(`📸  ${path.basename(file)}`);
}

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

async function measureBox(page, selector) {
  const el = page.locator(selector).first();
  const box = await el.boundingBox().catch(() => null);
  if (!box) return `  ${selector}: NOT FOUND`;
  return `  ${selector}: x=${box.x.toFixed(0)} y=${box.y.toFixed(0)} w=${box.width.toFixed(0)} h=${box.height.toFixed(0)}`;
}

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
  page.setDefaultTimeout(30_000);
  await page.addInitScript(MIC_MOCK);

  // Load and start
  await page.goto(BASE_URL, { waitUntil: 'networkidle' });
  const btn = page.locator('button:has-text("START GAME")');
  await btn.click();

  // Wait for battle scene
  await page.locator('.battle-scene').waitFor({ state: 'visible', timeout: 5_000 });
  await shot(page, 'battle_idle');

  // Measure layout at text phase (initial state)
  console.log('\n── Dimensions at text phase ──');
  console.log(await measureBox(page, '.battle-scene'));
  console.log(await measureBox(page, '.content-frame'));

  // Wait for the Plotly chart to appear
  console.log('\nWaiting for Plotly chart...');
  try {
    await page.waitForSelector('.content-frame .plot-container', { timeout: 30_000 });
    console.log('✅  Plotly chart appeared');
    await shot(page, 'chart_visible');

    // Measure everything
    console.log('\n── Dimensions at chart phase ──');
    console.log(await measureBox(page, '.battle-scene'));
    console.log(await measureBox(page, '.content-frame'));
    console.log(await measureBox(page, '.content-frame__chart'));
    console.log(await measureBox(page, '.content-frame .plot-container'));
    console.log(await measureBox(page, '.content-frame .main-svg'));

    // Check overflow: is chart bottom > frame bottom?
    const dims = await page.evaluate(() => {
      const frame = document.querySelector('.content-frame');
      const chart = document.querySelector('.content-frame .plot-container');
      if (!frame || !chart) return null;
      const fr = frame.getBoundingClientRect();
      const cr = chart.getBoundingClientRect();
      return {
        frameBottom: fr.bottom,
        frameHeight: fr.height,
        chartBottom: cr.bottom,
        chartHeight: cr.height,
        overflowPx: cr.bottom - fr.bottom,
      };
    });

    if (dims) {
      console.log('\n── Overflow check ──');
      console.log(`  frame height:  ${dims.frameHeight.toFixed(0)}px`);
      console.log(`  chart height:  ${dims.chartHeight.toFixed(0)}px`);
      console.log(`  overflow:      ${dims.overflowPx.toFixed(0)}px ${dims.overflowPx > 0 ? '⚠️  OVERFLOWS' : '✅  fits'}`);
    }

  } catch (e) {
    console.error('❌  Plotly chart never appeared:', e.message);
    await shot(page, 'chart_missing');
  }

  await page.waitForTimeout(2_000);
  await browser.close();
})();
