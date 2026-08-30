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
  const w = dom.window, d = w.document;
  const out = [];
  const ok = (n) => out.push('OK  ' + n);
  const bad = (n, e) => out.push('FAIL ' + n + ' :: ' + (e && e.message));
  try {
    // YZ çıktı kartı altında kalıcı uyarı var
    const aiNote = (d.querySelector('#aiOutputCard .input-ai-note') || {}).textContent || '';
    if (aiNote.length > 0 && aiNote.indexOf('yapay zek') !== -1 && aiNote.indexOf('uzman') !== -1 && aiNote.indexOf('hata') !== -1)
      ok('YZ çıktı kartında kalıcı uyarı (YZ, hata, uzman görüşü)');
    else bad('YZ çıktı kartı uyarısı eksik: ' + aiNote);

    // Sohbet giriş kutusu üstünde kalıcı uyarı var
    const chatNote = (d.querySelector('#tab-chat .input-ai-note') || {}).textContent || '';
    if (chatNote && chatNote.indexOf('yapay zek') !== -1 && chatNote.indexOf('uzman') !== -1)
      ok('sohbet giriş kutusunda kalıcı YZ uyarısı');
    else bad('sohbet giriş uyarısı eksik');

    // Günlük yansıma üret → ai-stamp yeni metni içermeli
    d.getElementById('btnDailyAI').click();
    await wait(700);
    const aiOut = d.getElementById('aiOutput');
    if (aiOut.querySelector('.ai-stamp')) {
      const st = aiOut.querySelector('.ai-stamp').textContent;
      if (st.indexOf('yapay zek') !== -1 && st.indexOf('uzman') !== -1 && st.indexOf('hata yapabilir') !== -1)
        ok('günlük yansıma çıktısı altında tam YZ stamp\'ı (hata + uzman)');
      else bad('günlük stamp kısa: ' + st);
    } else bad('günlük yansıma stamp yok');

    // Sohbet başlat → assistant mesajında tam stamp
    d.getElementById('chatInput').value = 'Bugün nasıl gidiyor?';
    d.getElementById('chatSend').click();
    await wait(700);
    const msgs = d.querySelectorAll('.chat-msg.assistant');
    if (msgs.length) {
      const lastSt = msgs[msgs.length - 1].querySelector('.ai-stamp');
      if (lastSt && lastSt.textContent.indexOf('uzman') !== -1) ok('sohbet assistant yanıtında tam stamp');
      else bad('sohbet stamp eksik');
    } else bad('sohbet mesajı yok');
    // kriz guard yanıtı da stamp taşımalı
    d.getElementById('chatInput').value = 'Artık dayanamıyorum, kendime zarar vermek istiyorum';
    d.getElementById('chatSend').click();
    await wait(500);
    const msgs2 = d.querySelectorAll('.chat-msg.assistant');
    const kst = msgs2[msgs2.length - 1].querySelector('.ai-stamp');
    if (kst) ok('kriz guard yanıtında da YZ stamp var');
    else bad('kriz guard stamp yok');
  } catch (e) { bad('sürpriz hata', e); }
  console.log(out.join('\n'));
  process.exit(out.some(x => x.startsWith('FAIL')) ? 1 : 0);
})();