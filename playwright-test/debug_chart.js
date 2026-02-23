/**
 * Debug chart visibility: confirms axis/line color mismatch with background.
 * Run: node debug_chart.js
 * Requires: backend on :8000, frontend on :5173
 */

const { chromium } = require('playwright');
const path = require('path');
const fs   = require('fs');

const BASE_URL    = 'https://localhost:5176';
const SCREENSHOTS = path.join(__dirname, 'screenshots');
fs.mkdirSync(SCREENSHOTS, { recursive: true });

// Read user_input.wav and encode as base64 for the mic mock
const wavPath   = path.join(__dirname, '..', 'backend', 'user_input.wav');
const wavBase64 = fs.readFileSync(wavPath).toString('base64');

let shotIndex = 0;
async function shot(page, label) {
  const file = path.join(SCREENSHOTS, `debug_chart_${String(++shotIndex).padStart(2,'0')}_${label}.png`);
  await page.screenshot({ path: file, fullPage: true });
  console.log(`📸  ${path.basename(file)}`);
}

// Mock getUserMedia: plays user_input.wav in a loop so the recorder captures real audio
const MIC_MOCK = `(() => {
  const WAV_B64 = "${wavBase64}";
  navigator.mediaDevices.getUserMedia = async (constraints) => {
    if (!constraints || !constraints.audio) return;
    const bytes = Uint8Array.from(atob(WAV_B64), c => c.charCodeAt(0));
    const ctx   = new AudioContext({ sampleRate: 44100 });
    const buf   = await ctx.decodeAudioData(bytes.buffer.slice(0));
    const dest  = ctx.createMediaStreamDestination();
    const src   = ctx.createBufferSource();
    src.buffer  = buf;
    src.loop    = true;
    src.connect(dest);
    src.start();
    return dest.stream;
  };
})();`;

(async () => {
  const browser = await chromium.launch({
    headless: false,
    args: ['--autoplay-policy=no-user-gesture-required', '--use-fake-ui-for-media-stream'],
  });

  const context = await browser.newContext({ permissions: ['microphone'], ignoreHTTPSErrors: true });
  const page    = await context.newPage();
  page.setDefaultTimeout(60_000);

  page.on('console', msg => {
    const t = msg.text();
    if (!t.includes('[vite]') && !t.includes('Download the React')) console.log(`[browser] ${t}`);
  });
  page.on('pageerror', err => console.error(`[page error] ${err}`));

  // Intercept /analyze to log whether pitch_chart came back
  await page.route('**/api/game/*/analyze', async (route) => {
    const response = await route.fetch();
    const body     = await response.json();
    console.log('\n══ /analyze response ══════════════════════');
    console.log('  passed      :', body.passed);
    console.log('  pitch_chart :', body.pitch_chart === null ? 'NULL ❌' : 'present ✅');
    if (body.pitch_chart) {
      (body.pitch_chart.data || []).forEach((tr, i) => {
        console.log(`  trace[${i}]: x.len=${tr.x?.length} y.len=${tr.y?.length} ` +
          `fill="${tr.fill}" line.color="${tr.line?.color}" fillcolor="${tr.fillcolor}"`);
      });
      const ly = body.pitch_chart.layout || {};
      console.log('  xaxis.color        :', ly.xaxis?.color);
      console.log('  xaxis.showticklabels:', ly.xaxis?.showticklabels);
      console.log('  yaxis.color        :', ly.yaxis?.color);
      console.log('  yaxis.showticklabels:', ly.yaxis?.showticklabels);
      console.log('  xaxis.gridcolor:', ly.xaxis?.gridcolor);
    }
    await route.fulfill({ response, body: JSON.stringify(body), contentType: 'application/json' });
  });

  await page.addInitScript(MIC_MOCK);
  await page.goto(BASE_URL, { waitUntil: 'networkidle' });
  await page.locator('button:has-text("START GAME")').click();
  await page.locator('.battle-scene').waitFor({ state: 'visible', timeout: 10_000 });
  await shot(page, '01_battle_start');

  console.log('\nWaiting for Plotly chart (.plot-container)...');
  try {
    await page.waitForSelector('.content-frame .plot-container', { timeout: 45_000 });
    await page.waitForTimeout(600); // let Plotly finish painting
    console.log('✅  Chart appeared');
    await shot(page, '02_chart_visible');

    const info = await page.evaluate(() => {
      const frame    = document.querySelector('.content-frame');
      const chartDiv = document.querySelector('.content-frame__chart');
      // Plotly may use multiple SVG elements; inspect all of them inside the chart div
      const svgs     = chartDiv ? Array.from(chartDiv.querySelectorAll('svg')) : [];
      const mainSvg  = chartDiv ? chartDiv.querySelector('.main-svg') : null;

      const rect = el => {
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return { w: Math.round(r.width), h: Math.round(r.height) };
      };

      const frameBg = frame ? getComputedStyle(frame).backgroundColor : null;

      // --- SVG inventory ---
      const svgInfo = svgs.map(s => ({
        class  : s.className?.baseVal,
        dims   : rect(s),
        viewBox: s.getAttribute('viewBox'),
      }));

      // --- All <text> elements across ALL svgs in chart div ---
      const allTexts = chartDiv
        ? Array.from(chartDiv.querySelectorAll('text')).map(t => {
            const cs = getComputedStyle(t);
            return {
              text      : t.textContent?.trim().slice(0, 30),
              class     : (t.className?.baseVal || '').trim().slice(0, 40),
              fill      : t.getAttribute('fill') || cs.fill,
              visibility: cs.visibility,
              display   : cs.display,
              opacity   : cs.opacity,
            };
          })
        : [];

      // --- xtick / ytick groups ---
      const xtickGroups = chartDiv ? chartDiv.querySelectorAll('.xtick').length : 0;
      const ytickGroups = chartDiv ? chartDiv.querySelectorAll('.ytick').length : 0;

      // --- All <line> elements (tick marks) ---
      const lines = chartDiv
        ? Array.from(chartDiv.querySelectorAll('line')).map(l => ({
            class : (l.className?.baseVal || '').trim().slice(0, 30),
            x1: l.getAttribute('x1'), y1: l.getAttribute('y1'),
            x2: l.getAttribute('x2'), y2: l.getAttribute('y2'),
            stroke: l.getAttribute('stroke') || getComputedStyle(l).stroke,
          })).slice(0, 12)
        : [];

      // --- Paths in main-svg ---
      const paths = mainSvg
        ? Array.from(mainSvg.querySelectorAll('path')).map(p => ({
            class : (p.className?.baseVal || '').trim().slice(0, 40),
            d_len : p.getAttribute('d')?.length || 0,
            stroke: p.getAttribute('stroke') || getComputedStyle(p).stroke,
            fill  : p.getAttribute('fill')   || getComputedStyle(p).fill,
          }))
        : [];

      // --- Plotly internal layout (available on the gd element) ---
      const plotDiv    = chartDiv?.querySelector('.js-plotly-plot');
      const fullLayout = plotDiv?._fullLayout;
      const axisInfo   = fullLayout ? {
        xType        : fullLayout.xaxis?.type,
        xShowTicks   : fullLayout.xaxis?.showticklabels,
        xColor       : fullLayout.xaxis?.color,
        xRange       : fullLayout.xaxis?.range,
        xTickvals    : fullLayout.xaxis?._vals?.length,
        yType        : fullLayout.yaxis?.type,
        yShowTicks   : fullLayout.yaxis?.showticklabels,
        yColor       : fullLayout.yaxis?.color,
        yRange       : fullLayout.yaxis?.range,
        yTickvals    : fullLayout.yaxis?._vals?.length,
        width        : fullLayout.width,
        height       : fullLayout.height,
        marginL      : fullLayout.margin?.l,
        marginB      : fullLayout.margin?.b,
      } : null;

      return {
        frameBg,
        frameDims   : rect(frame),
        chartDivDims: rect(chartDiv),
        svgs        : svgInfo,
        xtickGroups,
        ytickGroups,
        textCount   : allTexts.length,
        allTexts,
        lineCount   : lines.length,
        lines,
        pathCount   : paths.length,
        paths,
        axisInfo,
      };
    });

    console.log('\n══ DOM INSPECTION ══════════════════════════════');
    console.log('Frame bg    :', info.frameBg);
    console.log('Frame dims  :', JSON.stringify(info.frameDims));
    console.log('Chart dims  :', JSON.stringify(info.chartDivDims));
    console.log('\nSVG layers:');
    info.svgs.forEach(s => console.log(`  class="${s.class}" dims=${JSON.stringify(s.dims)} viewBox=${s.viewBox}`));
    console.log('\nxtick groups:', info.xtickGroups, '  ytick groups:', info.ytickGroups);
    console.log('line elements:', info.lineCount);
    info.lines.forEach((l, i) =>
      console.log(`  <line> x1=${l.x1} y1=${l.y1} x2=${l.x2} y2=${l.y2} stroke="${l.stroke}"`)
    );
    console.log(`\nAll text elements (${info.textCount}):`);
    info.allTexts.forEach(t =>
      console.log(`  "${t.text}"  class="${t.class}"  fill="${t.fill}"  vis=${t.visibility}  opacity=${t.opacity}`)
    );
    console.log(`\nPaths (${info.pathCount}):`);
    info.paths.forEach((p, i) =>
      console.log(`  [${i}] d_len=${p.d_len} stroke="${p.stroke}" fill="${p.fill}" class="${p.class}"`)
    );

    if (info.axisInfo) {
      console.log('\n── Plotly _fullLayout axis info ──');
      console.log(JSON.stringify(info.axisInfo, null, 2));
    } else {
      console.log('\n⚠️  Could not access _fullLayout (plotDiv not found or not yet attached)');
    }

    // Key diagnosis
    console.log('\n══ DIAGNOSIS ═══════════════════════════════════');
    if (info.xtickGroups === 0 && info.ytickGroups === 0) {
      console.log('⚠️  Zero .xtick/.ytick groups — Plotly did not generate tick elements');
    }
    if (info.axisInfo) {
      if (!info.axisInfo.xShowTicks) console.log('⚠️  xaxis.showticklabels is FALSE in _fullLayout');
      if (!info.axisInfo.yShowTicks) console.log('⚠️  yaxis.showticklabels is FALSE in _fullLayout');
      if (info.axisInfo.xTickvals === 0) console.log('⚠️  xaxis._vals is empty — no tick positions computed');
      if (info.axisInfo.yTickvals === 0) console.log('⚠️  yaxis._vals is empty — no tick positions computed');
      console.log(`  xaxis range: [${info.axisInfo.xRange}]  tickvals: ${info.axisInfo.xTickvals}`);
      console.log(`  yaxis range: [${info.axisInfo.yRange}]  tickvals: ${info.axisInfo.yTickvals}`);
    }
    const whiteText = info.allTexts.find(t => /rgba?\(255/.test(t.fill));
    if (whiteText) {
      console.log(`⚠️  White text found: "${whiteText.text}" fill="${whiteText.fill}" on bg "${info.frameBg}"`);
    }

  } catch (e) {
    console.error('❌  Chart never appeared:', e.message);
    await shot(page, '03_chart_missing');
    const html = await page.evaluate(() => document.querySelector('.content-frame')?.innerHTML?.slice(0, 800));
    console.log('Content frame innerHTML:\n', html);
  }

  await page.waitForTimeout(3_000);
  await browser.close();
})();
