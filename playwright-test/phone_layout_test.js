/**
 * Phone layout smoke test (430 x 932 — iPhone 14 Pro Max)
 * Checks that the content-frame stays at the bottom during the intro
 * (before the player sprite enters), not floating up into the bird area.
 *
 * Run:  node phone_layout_test.js
 */

const { chromium } = require('playwright');
const path = require('path');
const fs   = require('fs');

const BASE_URL    = 'http://localhost:5173';
const SCREENSHOTS = path.join(__dirname, 'screenshots');
fs.mkdirSync(SCREENSHOTS, { recursive: true });

let shotIndex = 0;
async function shot(page, label) {
  const file = path.join(SCREENSHOTS, `phone_${String(++shotIndex).padStart(2,'0')}_${label}.png`);
  await page.screenshot({ path: file, fullPage: true });
  console.log(`📸  → ${path.basename(file)}`);
}

async function measureLayout(page) {
  return page.evaluate(() => {
    const get = sel => {
      const el = document.querySelector(sel);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { top: Math.round(r.top), bottom: Math.round(r.bottom), height: Math.round(r.height) };
    };
    return {
      battleScene:    get('.battle-scene'),
      opponentSprite: get('.sprite--opponent'),
      playerSprite:   get('.sprite--player'),
      contentFrame:   get('.content-frame'),
      playerPanel:    get('.info-panel--player'),
    };
  });
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

(async () => {
  console.log('\n═══════════════════════════════════════════');
  console.log(' Phone layout test  (430 × 932)');
  console.log('═══════════════════════════════════════════\n');

  const browser = await chromium.launch({
    headless: false,
    args: [
      '--autoplay-policy=no-user-gesture-required',
      '--use-fake-ui-for-media-stream',
    ],
  });

  const context = await browser.newContext({
    viewport: { width: 430, height: 932 },
    permissions: ['microphone'],
  });

  const page = await context.newPage();
  page.setDefaultTimeout(20_000);

  page.on('console', msg => {
    if (msg.type() === 'error') console.error(`[console.error] ${msg.text()}`);
  });
  page.on('pageerror', e => console.error(`[pageerror] ${e.message}`));

  await page.addInitScript(MIC_MOCK);

  // ── Title screen ──────────────────────────────────────────────────────────
  await page.goto(BASE_URL, { waitUntil: 'networkidle' });
  await shot(page, 'title');

  // ── Start game ───────────────────────────────────────────────────────────
  await page.locator('button:has-text("START GAME")').click();
  await page.locator('.battle-scene').waitFor({ state: 'visible', timeout: 5_000 });
  console.log('✅  battle-scene visible');

  // ── Capture: just after mount — player sprite is hidden, bird entering ───
  await page.waitForTimeout(300);
  console.log('\n── Layout at mount (player sprite HIDDEN) ──');
  let layout = await measureLayout(page);
  console.log(JSON.stringify(layout, null, 2));
  await shot(page, 'mount_player_hidden');

  const bs  = layout.battleScene;
  const cf  = layout.contentFrame;
  const opp = layout.opponentSprite;

  if (bs && cf && opp) {
    const cfRelTop    = cf.top - bs.top;                 // cf top relative to scene top
    const sceneHeight = bs.height;
    const oppBottom   = opp.bottom - bs.top;

    console.log(`\nbattle-scene height : ${sceneHeight}px`);
    console.log(`opponent sprite bottom (rel): ${oppBottom}px`);
    console.log(`content-frame top (rel)     : ${cfRelTop}px`);

    if (cf.top < opp.bottom) {
      console.error(`❌  content-frame (top=${cf.top}) overlaps opponent sprite (bottom=${opp.bottom}) — BUG CONFIRMED`);
    } else {
      console.log(`✅  content-frame below opponent sprite  (gap=${cf.top - opp.bottom}px)`);
    }
  }

  // ── Wait for "Wild UWU BIRD" dialogue ────────────────────────────────────
  try {
    await page.waitForFunction(
      () => document.querySelector('.typewriter-text')?.textContent?.includes('Wild UWU BIRD'),
      { timeout: 5_000 }
    );
    console.log('\n✅  "Wild UWU BIRD appeared!" shown');
    await shot(page, 'wild_uwu_bird');
    layout = await measureLayout(page);
    console.log('Layout:', JSON.stringify(layout, null, 2));
  } catch {
    console.error('❌  "Wild UWU BIRD appeared!" not seen');
    await shot(page, 'wild_uwu_bird_missing');
  }

  // ── Wait for "GO! ANNOYED AUNTIE!" ───────────────────────────────────────
  try {
    await page.waitForFunction(
      () => document.querySelector('.typewriter-text')?.textContent?.includes('Go!'),
      { timeout: 6_000 }
    );
    console.log('\n✅  "Go!" dialogue shown');
    await page.waitForTimeout(400);  // let animation start
    await shot(page, 'go_player_entering');
    layout = await measureLayout(page);
    console.log('Layout at "Go!" (player entering):', JSON.stringify(layout, null, 2));
  } catch {
    console.error('❌  "Go!" dialogue not seen');
  }

  // ── Wait for player sprite to be idle (fully entered) ────────────────────
  try {
    await page.waitForSelector('img.sprite--player.sprite--idle', { timeout: 5_000 });
    console.log('\n✅  Player sprite idle (fully entered)');
    await shot(page, 'intro_complete');
    layout = await measureLayout(page);
    console.log('Final intro layout:', JSON.stringify(layout, null, 2));
  } catch {
    console.error('❌  Player sprite did not reach idle state');
    await shot(page, 'intro_complete_missing');
  }

  // ── Keep open briefly then close ─────────────────────────────────────────
  await page.waitForTimeout(2_000);
  await browser.close();

  console.log('\n═══════════════════════════════════════════');
  console.log(' Done — check screenshots/ folder');
  console.log('═══════════════════════════════════════════\n');
})().catch(e => {
  console.error('Unhandled:', e);
  process.exit(1);
});
