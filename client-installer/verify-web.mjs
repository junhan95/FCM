import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { releaseFor } from '../pages/release.mjs';
const here=path.dirname(fileURLToPath(import.meta.url));
const {chromium}=createRequire(path.join(here,'../fct/package.json'))('playwright');
const root=path.resolve(here,'../pages');
const server=http.createServer(async(req,res)=>{
  const pathname=new URL(req.url,'http://localhost').pathname;
  const file=path.resolve(root,'.'+(pathname==='/'?'/index.html':pathname));
  if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}
  try {const bytes=await fs.readFile(file);res.setHeader('Content-Type',({'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.svg':'image/svg+xml','.webp':'image/webp'})[path.extname(file)]||'application/octet-stream');res.end(bytes);}catch{res.writeHead(404).end();}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const base=`http://127.0.0.1:${server.address().port}`;
let browser;
try {
  const published=JSON.parse(await fs.readFile(path.join(root,'releases.json'),'utf8'));
  for(const target of ['win32-x64','darwin-arm64','darwin-x64'])releaseFor(published,target);
  browser=await chromium.launch(process.platform==='win32'?{channel:'msedge',headless:true}:{headless:true});
  const page=await browser.newPage({viewport:{width:1366,height:900},userAgent:'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140.0.0.0 Safari/537.36'});const errors=[];const posts=[];
  const empty={schema:1,releases:Object.fromEntries(['win32-x64','darwin-arm64','darwin-x64'].map(target=>[target,{version:'1.3.0',url:null,sha256:null}]))};
  await page.route('**/releases.json',route=>route.fulfill({json:empty}));
  page.on('pageerror',error=>errors.push(error.message));page.on('request',req=>{if(req.method()==='POST')posts.push(req.url());});
  await page.goto(base);assert.equal(await page.locator('#client-step').isVisible(),false);
  await page.locator('#loginId').fill('sysadmin');await page.locator('#password').fill('wrong-password');await page.locator('#login-form button').click();await page.locator('#login-error').waitFor({state:'visible'});
  assert.equal(await page.locator('#client-step').isVisible(),false);
  await page.locator('#password').fill('devonly-Passw0rd!');await page.locator('#login-form button').click();await page.locator('#client-step').waitFor({state:'visible'});
  await page.locator('#release-status').filter({hasText:'1.3.0'}).waitFor();
  assert.equal(await page.locator('#password').inputValue(),'');assert.equal(await page.locator('#login-step').isVisible(),false);
  assert.equal(await page.locator('#client-download').isVisible(),false);
  assert.match(await page.locator('#release-status').textContent(),/아직 웹에 등록/);
  assert.equal(await page.locator('#client-os option').count(),3);
  await page.evaluate(()=>document.querySelector('#client-check').addEventListener('click',event=>event.preventDefault()));
  await page.locator('#client-check').click();assert.match(await page.locator('#check-status').textContent(),/확인 창을 요청/);
  const fixture={schema:1,releases:Object.fromEntries(['win32-x64','darwin-arm64','darwin-x64'].map(target=>[target,{version:'1.4.0',url:`https://downloads.example.test/${target}.bin`,sha256:'a'.repeat(64)}]))};
  await page.route('**/releases.json',route=>route.fulfill({json:fixture}));await page.locator('#release-retry').click();await page.locator('#release-status').filter({hasText:'1.4.0'}).waitFor();
  for(const target of Object.keys(fixture.releases)){await page.locator('#client-os').selectOption(target);assert.equal(await page.locator('#client-download').getAttribute('href'),fixture.releases[target].url);}
  await page.locator('[data-lang=en]').click();assert.equal(await page.locator('#client-step h2').textContent(),'Install and check client');await page.locator('[data-lang=ko]').click();
  await page.route('**/releases.json',route=>route.fulfill({status:503,body:'Unavailable'}));await page.locator('#release-retry').click();await page.locator('#release-status').filter({hasText:'가져오지 못했습니다'}).waitFor();assert.equal(await page.locator('#client-download').isVisible(),false);
  assert.deepEqual(await page.evaluate(()=>({...localStorage,...sessionStorage})),{});assert.deepEqual(posts,[]);
  await page.setViewportSize({width:390,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await fs.mkdir(path.join(here,'out'),{recursive:true});await page.screenshot({path:path.join(here,'out/portal-flow-mobile.png'),fullPage:true});
  await page.locator('#logout').click();assert.equal(await page.locator('#client-step').isVisible(),false);await page.reload();assert.equal(await page.locator('#client-step').isVisible(),false);
  assert.deepEqual(errors,[]);
  console.log('PASS: login before client selection, invalid login, OS-specific downloads, numeric release display, offline fallback, no credential transport/storage, logout, EN/KO and mobile layout.');
}finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
