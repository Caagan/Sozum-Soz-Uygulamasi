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
    // YZ Ã§Ä±ktÄ± kartÄ± altÄ±nda kalÄ±cÄ± uyarÄ± var
    const aiNote = (d.querySelector('#aiOutputCard .input-ai-note') || {}).textContent || '';
    if (aiNote.length > 0 && aiNote.indexOf('yapay zek') !== -1 && aiNote.indexOf('uzman') !== -1 && aiNote.indexOf('hata') !== -1)
      ok('YZ Ã§Ä±ktÄ± kartÄ±nda kalÄ±cÄ± uyarÄ± (YZ, hata, uzman gÃ¶rÃ¼ÅŸÃ¼)');
    else bad('YZ Ã§Ä±ktÄ± kartÄ± uyarÄ±sÄ± eksik: ' + aiNote);

    // Sohbet giriÅŸ kutusu Ã¼stÃ¼nde kalÄ±cÄ± uyarÄ± var
    const chatNote = (d.querySelector('#tab-chat .input-ai-note') || {}).textContent || '';
    if (chatNote && chatNote.indexOf('yapay zek') !== -1 && chatNote.indexOf('uzman') !== -1)
      ok('sohbet giriÅŸ kutusunda kalÄ±cÄ± YZ uyarÄ±sÄ±');
    else bad('sohbet giriÅŸ uyarÄ±sÄ± eksik');

    // GÃ¼nlÃ¼k yansÄ±ma Ã¼ret â†’ ai-stamp yeni metni iÃ§ermeli
    d.getElementById('btnDailyAI').click();
    await wait(700);
    const aiOut = d.getElementById('aiOutput');
    if (aiOut.querySelector('.ai-stamp')) {
      const st = aiOut.querySelector('.ai-stamp').textContent;
      if (st.indexOf('yapay zek') !== -1 && st.indexOf('uzman') !== -1 && st.indexOf('hata yapabilir') !== -1)
        ok('gÃ¼nlÃ¼k yansÄ±ma Ã§Ä±ktÄ±sÄ± altÄ±nda tam YZ stamp\'Ä± (hata + uzman)');
      else bad('gÃ¼nlÃ¼k stamp kÄ±sa: ' + st);
    } else bad('gÃ¼nlÃ¼k yansÄ±ma stamp yok');

    // Sohbet baÅŸlat â†’ assistant mesajÄ±nda tam stamp
    d.getElementById('chatInput').value = 'BugÃ¼n nasÄ±l gidiyor?';
    d.getElementById('chatSend').click();
    await wait(700);
    const msgs = d.querySelectorAll('.chat-msg.assistant');
    if (msgs.length) {
      const lastSt = msgs[msgs.length - 1].querySelector('.ai-stamp');
      if (lastSt && lastSt.textContent.indexOf('uzman') !== -1) ok('sohbet assistant yanÄ±tÄ±nda tam stamp');
      else bad('sohbet stamp eksik');
    } else bad('sohbet mesajÄ± yok');
    // kriz guard yanÄ±tÄ± da stamp taÅŸÄ±malÄ±
    d.getElementById('chatInput').value = 'ArtÄ±k dayanamÄ±yorum, kendime zarar vermek istiyorum';
    d.getElementById('chatSend').click();
    await wait(500);
    const msgs2 = d.querySelectorAll('.chat-msg.assistant');
    const kst = msgs2[msgs2.length - 1].querySelector('.ai-stamp');
    if (kst) ok('kriz guard yanÄ±tÄ±nda da YZ stamp var');
    else bad('kriz guard stamp yok');
  } catch (e) { bad('sÃ¼rpriz hata', e); }
  console.log(out.join('\n'));
  process.exit(out.some(x => x.startsWith('FAIL')) ? 1 : 0);
})();

