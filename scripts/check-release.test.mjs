import test from 'node:test';
import assert from 'node:assert/strict';
import { validateRelease } from './check-release.mjs';
const root = 'https://github.com/dion-labs/deskmux';
function fixture() {
  const url = `${root}/releases/tag/v1.2.3`;
  const assets = ['DeskMux-1.2.3-macOS-arm64.zip','SHA256SUMS.txt'].map(name => ({name,state:'uploaded',size:100,url:`${root}/releases/download/v1.2.3/${name}`}));
  return {
    receipt: {isDraft:false,isPrerelease:true,publishedAt:'2026-09-28T00:00:00Z',tagName:'v1.2.3',url,assets},
    html: `<script type="application/ld+json">${JSON.stringify({softwareVersion:'1.2.3',downloadUrl:url})}</script><a href="${assets[0].url}">Download</a><a href="${url}">Notes</a><p>v1.2.3 public preview</p>`
  };
}
test('published prerelease with exact uploaded assets is accepted',()=>{
  const {receipt,html}=fixture();assert.equal(validateRelease(receipt,html).version,'1.2.3');
});
for(const [name,change] of [
  ['draft',r=>r.isDraft=true],
  ['missing publication timestamp',r=>r.publishedAt=null],
  ['missing archive',r=>r.assets.shift()],
  ['unfinished upload',r=>r.assets[0].state='new'],
  ['empty asset',r=>r.assets[0].size=0],
  ['duplicate archive',r=>r.assets.push({...r.assets[0]})],
  ['unexpected repository',r=>r.assets[0].url=r.assets[0].url.replace('/dion-labs/','/synthetic-other/')],
])test(`reject ${name}`,()=>{
  const {receipt,html}=fixture();change(receipt);assert.throws(()=>validateRelease(receipt,html));
});
test('reject stale schema/version, stale visible label and missing actual link',()=>{
  const {receipt,html}=fixture();
  for(const altered of [html.replace('"1.2.3"','"1.2.2"'),html.replace('v1.2.3 public preview','v1.2.2 public preview'),html.replace(receipt.assets[0].url,receipt.assets[0].url.replaceAll('1.2.3','1.2.2'))])assert.throws(()=>validateRelease(receipt,altered));
});
