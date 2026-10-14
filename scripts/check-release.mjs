// Validate actual saved `gh release view ... --json ...` receipts, never guessed tags.
// Default is offline. --online additionally verifies only the known GitHub release assets.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';

export function validateRelease(receipt, html) {
  assert.equal(receipt.isDraft, false, 'Release must be published, not draft');
  assert(Number.isFinite(Date.parse(receipt.publishedAt)), 'Published timestamp required');
  assert.match(receipt.tagName, /^v\d+\.\d+\.\d+$/, 'Expected stable version syntax (prerelease flag is allowed)');
  const version = receipt.tagName.slice(1);
  const origin = 'https://github.com/dion-labs/deskmux';
  assert.equal(receipt.url, `${origin}/releases/tag/${receipt.tagName}`);
  const assets = ['DeskMux-' + version + '-macOS-arm64.zip', 'SHA256SUMS.txt'].map(name => {
    const matches = receipt.assets.filter(a => a.name === name);
    assert.equal(matches.length, 1, `Exactly one ${name} required`);
    const asset = matches[0];
    assert.equal(asset.state, 'uploaded', `${name} must be uploaded`);
    assert(Number.isSafeInteger(asset.size) && asset.size > 0, `${name} must be nonempty`);
    assert.equal(asset.url, `${origin}/releases/download/${receipt.tagName}/${name}`);
    return asset;
  });
  const raw = html.match(/<script\b[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/)?.[1];
  assert(raw, 'Software metadata missing');
  const schema = JSON.parse(raw);
  assert.equal(schema.softwareVersion, version, 'Schema must match actual release');
  assert.equal(schema.downloadUrl, receipt.url);
  const urls = [...html.matchAll(/href="([^"]+)"/g)].map(m => m[1]);
  assert(urls.includes(assets[0].url), 'Exact actual uploaded ZIP link required');
  assert(urls.includes(receipt.url), 'Actual release notes link required');
  assert(urls.filter(u => u.startsWith(origin + '/releases/')).every(u => [assets[0].url, receipt.url].includes(u)), 'Stale release link');
  assert(html.includes(`v${version} public preview`), 'Visible preview version must match');
  return { version, assets };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [, , receiptPath, mode] = process.argv;
  assert(receiptPath && (!mode || mode === '--online'), 'Usage: node scripts/check-release.mjs RECEIPT.json [--online]');
  const receipt = JSON.parse(await fs.readFile(receiptPath, 'utf8'));
  const source = await fs.readFile('index.html', 'utf8');
  const built = await fs.readFile('dist/index.html', 'utf8');
  const { version, assets: [zip, sums] } = validateRelease(receipt, source);
  validateRelease(receipt, built);
  const evidence = { at: new Date().toISOString(), version, mode: mode || 'offline', sourceSHA256: createHash('sha256').update(source).digest('hex'), builtSHA256: createHash('sha256').update(built).digest('hex') };
  if (mode === '--online') {
    const checksumResponse = await fetch(sums.url, { signal: AbortSignal.timeout(30000) });
    assert(checksumResponse.ok, 'Checksum download failed');
    const checksumText = await checksumResponse.text();
    const entries = checksumText.trim().split(/\r?\n/).map(line => line.match(/^([a-fA-F0-9]{64})\s+\*?(.+)$/)).filter(Boolean);
    const matches = entries.filter(entry => entry[2] === zip.name);
    assert.equal(matches.length, 1, 'One matching archive checksum required');
    const response = await fetch(zip.url, { signal: AbortSignal.timeout(30000) });
    assert(response.ok, 'Archive download failed');
    const bytes = Buffer.from(await response.arrayBuffer());
    assert.equal(bytes.length, zip.size, 'Archive size must match release metadata');
    const digest = createHash('sha256').update(bytes).digest('hex');
    assert.equal(digest, matches[0][1].toLowerCase(), 'Archive checksum mismatch');
    Object.assign(evidence, { archiveBytes: bytes.length, archiveSHA256: digest, checksumUrl: sums.url, archiveUrl: zip.url });
  }
  await fs.mkdir('test-results', { recursive: true });
  await fs.writeFile('test-results/release-results.json', JSON.stringify(evidence, null, 2) + '\n');
  console.log(`PASS release v${version}: source/build links, schema, visible version${mode ? ', actual ZIP bytes/checksum' : ''}`);
}
