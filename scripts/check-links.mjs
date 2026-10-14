// Explicit read-only public-link audit: no login, cookies, downloads or site writes.
import fs from 'node:fs/promises';
const html = await fs.readFile('index.html', 'utf8');
const urls = [...new Set([...html.matchAll(/href="(https:\/\/[^"#]+)(?:#[^"]*)?"/g)].map(m => m[1]))]
  .filter(url => ['github.com', 'dionlabs.ai', 'deskmux.dionlabs.ai'].includes(new URL(url).hostname));
const results = [];
for (const url of urls) {
  try {
    const response = await fetch(url, { method: 'HEAD', redirect: 'follow', signal: AbortSignal.timeout(20000) });
    // Do not persist signed release-asset redirect query parameters.
    const final = new URL(response.url);
    const item = { url, status: response.status, ok: response.ok, finalHost: final.hostname, contentType: response.headers.get('content-type') };
    results.push(item); console.log(`${item.ok ? 'PASS' : 'FAIL'} ${url}: ${item.status} ${item.finalHost}`);
  } catch (error) {
    results.push({ url, ok: false, error: error.message }); console.log(`FAIL ${url}: ${error.message}`);
  }
}
await fs.mkdir('test-results', { recursive: true });
await fs.writeFile('test-results/public-links.json', JSON.stringify({ at: new Date().toISOString(), method: 'HEAD', results }, null, 2) + '\n');
process.exitCode = results.every(r => r.ok) ? 0 : 1;
