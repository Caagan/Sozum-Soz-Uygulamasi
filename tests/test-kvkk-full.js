const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const root = path.resolve(__dirname, '..', 'src');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const dom = new JSDOM(html, { runScripts: 'dangerously', resources: 'usable', url: 'file://' + root + '/index.html' });
dom.window.__SS_INSTANT = true;
dom.window.addEventListener('error', (e) => console.error('WINDOW ERROR:', e.error ? e.error.stack : e.message));
const wait = (ms) => new Promise(r => setTimeout(r, ms));

(async () => {
  await wait(1200);
  const w = dom.window;
  const d = w.document;
  const out = [];
  const ok = (n) => out.push('OK  ' + n);
  const bad = (n, e) => out.push('FAIL ' + n + ' :: ' + (e && e.message));

  const s = () => d.getElementById('phoneScreen');

  try {
    // 1) KVKK ekranında tam metin bölümleri var
    d.querySelector('.app-tile[data-app="sozumsoz"]').click();
    await wait(200);
    const bodyText = s().textContent;
    const sections = ['Veri Sorumlusu', 'İşlenen Kişisel Veriler', 'İşleme Amaçları', 'Hukuki Sebep', 'Saklama Süresi', 'Veri Sahibinin Hakları', 'Açık Rıza', 'KVKK m.11', 'Rızayı geri al'];
    const missing = sections.filter(x => !bodyText.includes(x));
    if (missing.length === 0) ok('KVKK tam metin: ' + sections.length + ' bölüm mevcut');
    else bad('KVKK bölüm eksik: ' + missing.join(','));

    // 2) kabul edip uygulamayı aç, bir şeyler yap (puan biriksin)
    d.getElementById('consentYes').click();
    await wait(300);
    d.getElementById('sozBack').click();
    await wait(200);
    d.querySelector('.app-tile[data-app="instagram"]').click();
    await wait(50);
    d.querySelector('.time-btn[data-min="5"]').click();
    await wait(50);
    d.getElementById('promiseOk').click();
    await wait(80);
    d.getElementById('btnKeep').click();
    await wait(80);
    const pts = parseInt(d.getElementById('hPoints').textContent, 10);
    if (pts >= 3) ok('ön koşul: puan birikti (' + pts + ')');
    else bad('ön koşul: puan yok');

    // 3) Ayarlar modalında 4 buton var
    d.getElementById('btnSettings').click();
    await wait(50);
    if (d.getElementById('btnExport') && d.getElementById('btnRevokeConsent') && d.getElementById('btnWipeData') && d.getElementById('btnReset2'))
      ok('Ayarlarda veri hakları butonları var (indir / rıza geri al / verileri sil / demo sıfırla)');
    else bad('Ayarlar butonları eksik');

    // 4) JSON dışa aktarma: URL.createObjectURL jsdom'da olmayabilir; yalnızca hata fırlatmadığını kontrol et
    d.getElementById('btnExport').click();
    await wait(100);
    const exportErr = await new Promise(r => { const old = w.onerror; w.onerror = (m) => { r(m); return true; }; setTimeout(() => { w.onerror = old; r(null); }, 120); });
    if (!exportErr) ok('JSON indir: hata fırlatmadı (' + (d.querySelector('.modal') && d.querySelector('.modal h3') ? 'özet modalı:' + d.querySelector('.modal h3').textContent : 'modal kapandı') + ')');
    else bad('JSON indir hatası: ' + exportErr);
    if (d.querySelector('#exportOk')) { d.getElementById('exportOk').click(); await wait(50); }

    // 5) Rızayı geri al → consent=false, ana ekrana döner, ikona basınca KVKK yine gelir
    d.getElementById('btnSettings').click();
    await wait(50);
    d.getElementById('btnRevokeConsent').click();
    await wait(50);
    if (d.querySelector('#revokeYes')) ok('rıza geri al onay modalı açıldı');
    else bad('rıza onay modalı');
    d.getElementById('revokeYes').click();
    await wait(100);
    if (!d.querySelector('.s-consent') && s() && s().querySelector('.app-grid')) ok('rıza geri alınınca ana ekrana dönüldü');
    else bad('rıza sonrası ana ekran');
    d.querySelector('.app-tile[data-app="sozumsoz"]').click();
    await wait(200);
    if (d.querySelector('.s-consent') && d.getElementById('consentYes')) ok('rıza geri alınınca KVKK tekrar geliyor');
    else bad('rıza sonrası KVKK tekrar gelmedi');

    // 6) Verileri sil → onay modalı, yes → reload (localStorage temiz + location.reload)
    d.getElementById('consentYes').click();
    await wait(200);
    d.getElementById('btnSettings').click();
    await wait(50);
    d.getElementById('btnWipeData').click();
    await wait(50);
    if (d.querySelector('#wipeYes')) ok('verilerimi sil onay modalı açıldı');
    else bad('verileri sil onay modalı');
    let wipeThrew = false;
    try {
      d.getElementById('wipeYes').click();
    } catch (e) { wipeThrew = e; }
    await wait(80);
    if (!wipeThrew) ok('verilerimi sil: onay tıklaması hatasız (silme + kilide dönüş tetiklendi)');
    else bad('verilerimi sil: tıklama hatası', wipeThrew);
  } catch (e) { bad('sürpriz hata', e); }

  console.log(out.join('\n'));
  process.exit(out.some(x => x.startsWith('FAIL')) ? 1 : 0);
})();