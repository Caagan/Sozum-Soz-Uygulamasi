const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');
const root = path.resolve(__dirname, '..', 'dist');
const html = fs.readFileSync(path.join(root, 'SOZUM-SOZ-TEKDOSYA.html'), 'utf8');
const dom = new JSDOM(html, { runScripts: 'dangerously', resources: 'usable', url: 'file://' + root + '/SOZUM-SOZ-TEKDOSYA.html' });
dom.window.__SS_INSTANT = true;
dom.window.addEventListener('error', (e) => console.error('WINDOW ERROR:', e.error ? e.error.stack : e.message));
const wait = (ms) => new Promise(r => setTimeout(r, ms));
(async () => {
  await wait(1200);
  const w = dom.window, d = w.document;
  const out = [];
  const ok = (n) => out.push('OK  ' + n);
  const bad = (n, e) => out.push('FAIL ' + n + ' :: ' + (e && e.message));
  try {
    if (d.getElementById('phoneScreen')) ok('tek dosya: doğrudan açıldı');
    else bad('tek dosya: acllis');
    const tile = d.querySelector('.app-tile[data-app="sozumsoz"]');
    if (tile) ok('tek dosya: SOZUM SOZ ikonu var');
    else bad('tek dosya: ikon');
    tile.click();
    await wait(200);
    if (d.querySelector('.s-consent')) ok('tek dosya: ikona basinca KVKK ekrani geldi');
    else bad('tek dosya: KVKK ekrani');
    if (!d.querySelector('.s-soz')) ok('tek dosya: KVKK verilmeden uygulama kilitli');
    else bad('tek dosya: KVKK siz acildi');
    d.getElementById('consentYes').click();
    await wait(300);
    if (d.querySelector('.s-soz') && !d.querySelector('.s-consent')) ok('tek dosya: kabul edilince uygulama acildi');
    else bad('tek dosya: kabul sonrasi acilis');
  } catch (e) { bad('surpriz hata', e); }
  console.log(out.join('\n'));
  process.exit(out.some(x => x.startsWith('FAIL')) ? 1 : 0);
})();
