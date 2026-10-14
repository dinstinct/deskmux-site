// Targeted regression for incoming PR #3 assets/footer. No external navigation.
import { chromium, firefox, webkit } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createHash } from 'node:crypto';
const results = [];
const requestedScope=process.env.HYGIENE_SCOPE||'all';
const scope=requestedScope==='icons'?'followup':requestedScope;
assert(['all','followup','release'].includes(scope));
const output = path.resolve('dist');
const expectedIcons=Object.fromEntries(await Promise.all(['mark.svg','favicon.ico','apple-touch-icon.png'].map(async name=>['/'+name,createHash('sha256').update(await fs.readFile(path.join(output,name))).digest('hex')])));
await fs.mkdir('test-results', {recursive:true});
const server=createServer(async (req,res)=>{
  try{
    const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
    const file=path.resolve(output,`.${pathname==='/'?'/index.html':pathname}`);
    assert(file.startsWith(output+path.sep));
    const body=await fs.readFile(file);
    res.writeHead(200,{'Content-Type':({'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.svg':'image/svg+xml','.ico':'image/x-icon'})[path.extname(file)]||'application/octet-stream'});res.end(body);
  }catch{res.writeHead(404);res.end('Not found');}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const base=`http://127.0.0.1:${server.address().port}`;
try {
  for (const [engine, type] of Object.entries({chrome:chromium,firefox,webkit})) {
    const browser = await type.launch({headless:true,...(engine==='chrome'?{channel:'chrome'}:{})});
    try {
      for (const width of (scope==='release'||(scope==='followup'&&engine!=='firefox')?[320]:[1440,768,390,320])) for (const scale of (scope==='followup'&&engine!=='firefox'?[1]:[1,2])) {
        const context = await browser.newContext({viewport:{width,height:960},reducedMotion:'reduce'});
        try {
          await context.route('**/*',route=>new URL(route.request().url()).origin===base?route.continue():route.abort());
          const page = await context.newPage();
          await page.goto(base,{waitUntil:'networkidle'});
          const icons=await page.locator('link[rel="icon"],link[rel="apple-touch-icon"]').evaluateAll(es=>es.map(e=>e.getAttribute('href')));
          assert.deepEqual(icons,['/mark.svg','/favicon.ico','/apple-touch-icon.png']);
          // Playwright 1.55.1 aborts intercepted URLs ending /favicon.ico
          // (server/network.js + server/frames.js). Query only the test fetch,
          // then hash its bytes and decode them. Production links stay unchanged.
          const sizes=await page.evaluate(async paths=>Promise.all(paths.map(async src=>{
            let objectURL;
            try {
              const response=await fetch(src==='/favicon.ico'?src+'?qa-decode':src);if(!response.ok)throw Error(`HTTP ${response.status}`);
              const blob=await response.blob();
              const hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',await blob.arrayBuffer()))].map(x=>x.toString(16).padStart(2,'0')).join('');
              objectURL=URL.createObjectURL(blob);const img=new Image();img.src=objectURL;await img.decode();
              return {src,width:img.naturalWidth,height:img.naturalHeight,sha256:hash};
            } catch(error) {return {src,error:String(error)};}
            finally {if(objectURL)URL.revokeObjectURL(objectURL);}
          })),icons);
          const iconsOK=sizes.every(s=>s.width>0&&s.height>0&&s.sha256===expectedIcons[s.src]);
          if(scale===2)await page.evaluate(()=>{
            const elements=[...document.querySelectorAll('body,body *')].filter(e=>!['SCRIPT','STYLE'].includes(e.tagName));
            const sizes=elements.map(e=>parseFloat(getComputedStyle(e).fontSize));
            elements.forEach((e,i)=>e.style.setProperty('font-size',`${sizes[i]*2}px`,'important'));
          });
          const footer=page.locator('footer');
          for(const [label,href] of [['Privacy','https://dionlabs.ai/privacy'],['Terms','https://dionlabs.ai/terms'],['Contact','mailto:support@dionlabs.ai']])assert.equal(await footer.getByRole('link',{name:label,exact:true}).getAttribute('href'),href);
          await footer.getByRole('link',{name:'Privacy',exact:true}).focus();
          for(const label of ['Privacy','Terms','Contact']){
            const link=footer.getByRole('link',{name:label,exact:true});
            assert(await link.evaluate(e=>e===document.activeElement));
            assert.equal(await link.evaluate(e=>getComputedStyle(e).outlineStyle),'solid');
            if(label!=='Contact')await page.keyboard.press(engine==='webkit'?'Alt+Tab':'Tab');
          }
          const contrast=await footer.evaluate(foot=>{
            const channels=value=>value.match(/[0-9.]+/g).slice(0,3).map(Number);
            const lum=value=>channels(value).map(x=>x/255).map(x=>x<=0.04045?x/12.92:((x+0.055)/1.055)**2.4).reduce((sum,x,i)=>sum+x*[0.2126,0.7152,0.0722][i],0);
            const ratio=(a,b)=>(Math.max(lum(a),lum(b))+0.05)/(Math.min(lum(a),lum(b))+0.05);
            const background=getComputedStyle(document.documentElement).backgroundColor;
            return {text:ratio(getComputedStyle(foot).color,background),focus:ratio(getComputedStyle(document.activeElement).outlineColor,background)};
          });
          const release=await page.locator('.download').evaluate(card=>{
            const box=card.getBoundingClientRect();
            const items=[...card.querySelectorAll('.download-note,a')].map(e=>({text:e.textContent,display:getComputedStyle(e).display,clientWidth:e.clientWidth,scrollWidth:e.scrollWidth,rects:[...e.getClientRects()].map(r=>({left:r.left,right:r.right}))}));
            // Inline anchors have no client box; Firefox reports nonzero
            // scrollWidth for them. Use rendered rects, not a zero clientWidth.
            return {copy:[...card.querySelectorAll('.download-note')].map(e=>e.textContent),items,fits:items.every(e=>(!e.clientWidth||e.scrollWidth<=e.clientWidth+1)&&e.rects.every(r=>r.left>=box.left-1&&r.right<=box.right+1))};
          });
          if(width===320&&scale===1)await page.locator('.download').screenshot({path:`test-results/release-${engine}.png`});
          const layout=await footer.evaluate(foot=>{
            const box=foot.getBoundingClientRect();const links=[...foot.querySelectorAll('a')].map(e=>({label:e.textContent,rect:e.getBoundingClientRect()}));
            return {overflow:document.documentElement.scrollWidth>innerWidth+1,outside:links.filter(({rect:r})=>r.left<box.left-1||r.right>box.right+1||r.top<box.top-1||r.bottom>box.bottom+1).map(x=>x.label)};
          });
          if(width===320)await footer.screenshot({path:`test-results/footer-${engine}-${scale}x.png`});
          const ok=iconsOK&&!layout.overflow&&!layout.outside.length&&contrast.text>=4.5&&contrast.focus>=3&&release.fits;
          results.push({engine,version:browser.version(),width,scale,ok,layout,contrast,release,icons:sizes,linkKey:engine==='webkit'?'Alt+Tab':'Tab'});
          console.log(`${ok?'PASS':'FAIL'} ${engine} ${width}px ${scale}x icons/footer/keyboard ${JSON.stringify({layout,contrast,icons:sizes})}`);
        } finally {await context.close();}
      }
    } finally {await browser.close();}
  }
} finally {
  await new Promise(resolve=>server.close(resolve));
  await fs.writeFile('test-results/hygiene-results.json',JSON.stringify({at:new Date().toISOString(),scope,results},null,2)+'\n');
}
process.exitCode=results.some(r=>!r.ok)?1:0;
