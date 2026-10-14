import { chromium, firefox, webkit } from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createServer } from 'node:http';
import router from './edge-router.js';

const output = path.resolve('dist');
const results = [];
const engineName = process.env.SITE_ENGINE || 'chrome';
const engines = { chrome: chromium, firefox, webkit };
assert(engines[engineName], `Unknown SITE_ENGINE: ${engineName}`);
let engineVersion;
let completed = false;
const pass = (id, detail) => { results.push({ id, detail }); console.log(`PASS ${id}: ${detail}`); };
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png' };
const server = createServer(async (req, res) => {
  try {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    let target = path.resolve(output, `.${pathname}`);
    assert(target.startsWith(output + path.sep) || target === output);
    if ((await fs.stat(target)).isDirectory()) target = path.join(target, 'index.html');
    const body = await fs.readFile(target);
    res.writeHead(200, { 'Content-Type': mime[path.extname(target)] || 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/html' });
    res.end(await fs.readFile(path.join(output, '404.html')));
  }
});
await fs.access(path.join(output, '404.html'));
await fs.mkdir('test-results', { recursive: true });
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}`;
let browser;
try {
  browser = await engines[engineName].launch({ headless: true, ...(engineName === 'chrome' ? { channel: 'chrome' } : {}) });
  engineVersion = browser.version();
  console.log(`ENGINE ${engineName} ${engineVersion} (Playwright; not physical Safari/mobile)`);
  for (const width of [1440, 768, 390, 320]) {
    const context = await browser.newContext({ viewport: { width, height: 960 }, reducedMotion: 'reduce' });
    const remote = [], errors = [], badResponses = [];
    await context.route('**/*', route => {
      const request = route.request();
      assert.equal(request.method(), 'GET', 'No submissions');
      const url = new URL(request.url());
      if (url.origin === base) return route.continue();
      remote.push(url.href);
      return route.abort();
    });
    const page = await context.newPage();
    page.on('pageerror', e => errors.push(e.message));
    page.on('response', r => { if (r.url().startsWith(base) && r.status() >= 400) badResponses.push(r.url()); });
    await page.goto(base, { waitUntil: 'networkidle' });
    await page.locator('img').evaluateAll(async imgs => {
      for (const img of imgs) img.loading = 'eager';
      await Promise.all(imgs.map(img => img.decode()));
    });
    assert.equal(await page.locator('h1').count(), 1);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    assert.deepEqual(await page.locator('a[href^="#"]').evaluateAll(links => links.map(a => a.hash).filter(h => h.length > 1 && !document.getElementById(h.slice(1)))), []);
    assert.equal(await page.getByRole('link', { name: 'Security', exact: true }).getAttribute('href'), 'https://github.com/dion-labs/deskmux/blob/main/SECURITY.md');
    pass('DS-002/009', `${width}px images, layout and fragments`);
    const book = page.locator('[data-mac="macbook"]'), studio = page.locator('[data-mac="studio"]');
    const check = async (active, inactive, name) => {
      assert.equal(await active.getAttribute('aria-pressed'), 'true');
      assert.equal(await inactive.getAttribute('aria-pressed'), 'false');
      assert.equal(await page.locator('.screen.active').count(), 1);
      assert.equal(await active.locator('.input-state').textContent(), 'Keyboard + mouse here');
      assert.equal(await inactive.locator('.input-state').textContent(), 'Ready when you are');
      assert.equal(await page.locator('#demo-status').textContent(), `Input is on ${name}`);
    };
    await check(studio, book, 'Mac Studio');
    await book.click(); await check(book, studio, 'MacBook');
    await book.click(); await check(book, studio, 'MacBook');
    await book.focus(); await page.keyboard.press('Tab');
    assert.equal(await studio.evaluate(e => e === document.activeElement), true);
    await page.keyboard.press('Enter'); await check(studio, book, 'Mac Studio');
    await page.keyboard.press('Shift+Tab'); await page.keyboard.press('Space'); await check(book, studio, 'MacBook');
    assert.equal(await book.evaluate(e => getComputedStyle(e).outlineStyle), 'solid');
    await page.getByRole('link', { name: 'Skip to content' }).focus();
    await page.keyboard.press('Enter');
    assert.equal(new URL(page.url()).hash, '#main');
    pass('DS-003/004', `${width}px repeated mouse, Tab, Enter, Space and skip`);
    assert.equal(await page.evaluate(() => getComputedStyle(document.documentElement).scrollBehavior), 'auto');
    assert.equal(await book.evaluate(e => getComputedStyle(e).transitionDuration), '0s');
    assert.equal(await page.locator('#demo-status').getAttribute('aria-live'), 'polite');
    assert.match(await page.locator('#demo-disclaimer').textContent(), /never connects/);
    assert.deepEqual(await context.cookies(), []);
    assert.equal(await page.evaluate(() => localStorage.length + sessionStorage.length), 0);
    assert(remote.every(url => new URL(url).hostname === 'fonts.googleapis.com'), JSON.stringify(remote));
    await page.reload({ waitUntil: 'networkidle' }); await check(studio, book, 'Mac Studio');
    assert.deepEqual(errors, []); assert.deepEqual(badResponses, []);
    pass('DS-006/007/008', `${width}px reset, no device/data requests; only blocked Google Fonts; reduced motion`);
    if (width === 1440) {
      const meta = async selector => page.locator(selector).getAttribute('content');
      assert.match(await page.title(), /DeskMux/);
      assert(await meta('meta[name="description"]'));
      assert.equal(await page.locator('link[rel="canonical"]').getAttribute('href'), 'https://deskmux.dionlabs.ai/');
      for (const selector of ['meta[property="og:image"]', 'meta[name="twitter:image"]']) assert.equal(await meta(selector), 'https://deskmux.dionlabs.ai/social-preview-v2.png');
      for (const selector of ['meta[property="og:image:alt"]', 'meta[name="twitter:image:alt"]']) assert(await meta(selector));
      const schema = JSON.parse(await page.locator('script[type="application/ld+json"]').textContent());
      const version = schema.softwareVersion;
      assert.match(version, /^\d+\.\d+\.\d+$/);
      assert.equal(schema.downloadUrl, `https://github.com/dion-labs/deskmux/releases/tag/v${version}`);
      assert.equal(await page.getByRole('link', { name: /Download for Apple silicon/ }).getAttribute('href'), `https://github.com/dion-labs/deskmux/releases/download/v${version}/DeskMux-${version}-macOS-arm64.zip`);
      assert.equal(await page.getByRole('link', { name: /Release notes & checksums/ }).getAttribute('href'), schema.downloadUrl);
      assert((await page.locator('.download-note').first().textContent()).includes(`v${version} public preview`));
      pass('DS-010/011', `metadata and release ${version} internally consistent (publication verified separately)`);
    }
    await page.screenshot({ path: `test-results/desk-${engineName}-${width}.png`, fullPage: true });
    await context.close();
  }
  for (const mode of ['no-js', 'blocked-script']) {
    const context = await browser.newContext({ javaScriptEnabled: mode !== 'no-js', viewport: { width: 320, height: 960 } });
    await context.route('**/*', r => new URL(r.request().url()).origin !== base || r.request().resourceType() === 'script' ? r.abort() : r.continue());
    const page = await context.newPage();
    await page.goto(base, { waitUntil: 'networkidle' });
    assert.equal(await page.locator('.screen:disabled').count(), 2);
    assert.match(await page.locator('#demo-help').textContent(), /Static illustration/);
    assert.equal(await page.getByRole('link', { name: /Download for Apple silicon/ }).count(), 1);
    assert.equal(await page.locator('h1').count(), 1);
    await context.close(); pass('DS-005/006', `${mode} honest static fallback`);
  }
  for (const width of [1440, 768, 390, 320]) {
    const context = await browser.newContext({ viewport: { width, height: 960 }, reducedMotion: 'no-preference' });
    await context.route('**/*', r => new URL(r.request().url()).origin === base ? r.continue() : r.abort());
    const page = await context.newPage();
    await page.goto(base, { waitUntil: 'networkidle' });
    assert.equal(await page.evaluate(() => getComputedStyle(document.documentElement).scrollBehavior), 'smooth');
    await page.emulateMedia({ reducedMotion: 'reduce' });
    assert.equal(await page.evaluate(() => getComputedStyle(document.documentElement).scrollBehavior), 'auto');
    assert.equal(await page.locator('.screen').first().evaluate(e => getComputedStyle(e).transitionDuration), '0s');
    // Deterministic text-only 200% sizing, not pinch zoom or a physical Safari preference.
    const enlargement = await page.evaluate(() => {
      const elements = [...document.querySelectorAll('body, body *')].filter(e => !['SCRIPT', 'STYLE'].includes(e.tagName));
      const original = elements.map(e => parseFloat(getComputedStyle(e).fontSize));
      elements.forEach((e, i) => e.style.setProperty('font-size', `${original[i] * 2}px`, 'important'));
      return getComputedStyle(document.querySelector('h1')).fontSize;
    });
    const layout = await page.evaluate(() => ({
      overflow: document.documentElement.scrollWidth > innerWidth + 1,
      clipped: [...document.querySelectorAll('h1,h2,h3,.screen,.nav-download,.button,.compatibility dd')].filter(e => e.scrollWidth > e.clientWidth + 1).map(e => ({ tag: e.tagName, class: e.className, text: e.textContent.slice(0, 45), width: e.clientWidth, scroll: e.scrollWidth }))
    }));
    await page.screenshot({ path: `test-results/zoom-${engineName}-${width}.png`, fullPage: true });
    assert.deepEqual(layout, { overflow: false, clipped: [] }, `${width}px 200% text: ${JSON.stringify(layout)}`);
    const book = page.locator('[data-mac="macbook"]'), studio = page.locator('[data-mac="studio"]');
    await book.focus(); await page.keyboard.press('Space');
    assert.equal(await book.getAttribute('aria-pressed'), 'true');
    await page.keyboard.press('Tab');
    assert.equal(await studio.evaluate(e => e === document.activeElement), true);
    await page.keyboard.press('Enter');
    assert.equal(await studio.getAttribute('aria-pressed'), 'true');
    assert.equal(await studio.evaluate(e => getComputedStyle(e).outlineStyle), 'solid');
    const download = page.getByRole('link', { name: /Download for Apple silicon/ });
    await download.focus();
    assert.equal(await download.evaluate(e => e === document.activeElement), true);
    assert.equal(await download.evaluate(e => getComputedStyle(e).outlineStyle), 'solid');
    pass('DS-017/018', `${width}px 200% text (h1 ${enlargement}), keyboard and live reduced-motion change`);
    await context.close();
  }
  const missing = await fetch(`${base}/missing/nested/page`);
  assert.equal(missing.status, 404);
  const missingHtml = await missing.text();
  assert.match(missingHtml, /name="robots" content="noindex"/);
  assert.match(missingHtml, /href="\/">Return to DeskMux/);
  pass('DS-012', 'built missing-page artifact and fixture HTTP recovery');
  const headers = await fs.readFile(path.join(output, '_headers'), 'utf8');
  for (const expected of ['X-Content-Type-Options: nosniff', 'X-Frame-Options: DENY', 'Referrer-Policy: strict-origin-when-cross-origin', 'Permissions-Policy: camera=(), microphone=(), geolocation=()']) assert(headers.includes(expected));
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = async request => {
      assert.equal(request.url, 'https://deskmux-site-7l8.pages.dev/missing?source=synthetic');
      assert.equal(request.method, 'HEAD');
      return new Response(null, { status: 404, headers: { 'X-Content-Type-Options': 'nosniff' } });
    };
    const response = await router.fetch(new Request('https://deskmux.dionlabs.ai/missing?source=synthetic', { method: 'HEAD' }));
    assert.equal(response.status, 404); assert.equal(response.headers.get('X-Content-Type-Options'), 'nosniff');
  } finally { globalThis.fetch = originalFetch; }
  pass('DS-013', 'emitted headers and isolated proxy method/query/status/header preservation');
  completed = true;
} finally {
  await browser?.close();
  await new Promise(resolve => server.close(resolve));
  await fs.writeFile(`test-results/qa-results-${engineName}.json`, JSON.stringify({ at: new Date().toISOString(), engine: engineName, engineVersion, completed, results }, null, 2) + '\n');
}
