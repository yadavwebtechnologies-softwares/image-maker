/* ================================================================
   mcq.js — PrepareKora MCQ Paper Builder (v3 — digital text PDF)
   PDF is produced via browser print-to-PDF (window.print) so
   Bengali conjuncts shape correctly and text stays selectable.
   ================================================================ */
(function initMCQ(global){
  'use strict';

  /* ---------------- PARSER ---------------- */

  function splitBi(raw){
    const s = String(raw == null ? '' : raw);
    let en = s.trim();
    let as = '';
    if(s.indexOf('|') !== -1){
      const i = s.indexOf('|');
      en = s.slice(0, i).trim();
      as = s.slice(i + 1).trim();
    } else {
      const m = en.match(/^(.*?)\s*\(([^()]+)\)\s*$/);
      if(m){ en = m[1].trim(); as = m[2].trim(); }
    }
    return { en: en, as: as };
  }

  function emptyOptions(){
    return [
      { en: '', as: '' }, { en: '', as: '' },
      { en: '', as: '' }, { en: '', as: '' }
    ];
  }

  function parseMCQs(text){
    const lines = String(text || '').split(/\r?\n/);
    const questions = [];
    let title = '';
    let cur = null;

    function flush(){
      if(!cur) return;
      const filled = cur.options.filter(function(o){ return o && o.en; }).length;
      if(cur.qEn && filled >= 2) questions.push(cur);
      cur = null;
    }

    for(let li = 0; li < lines.length; li++){
      const line = String(lines[li]).trim();
      if(!line) continue;
      let m;

      if((m = line.match(/^title\s*[:\-|]\s*(.+)$/i))){
        if(!title) title = splitBi(m[1]).en;
        continue;
      }
      if((m = line.match(/^q\s*\(\s*as\s*\)\s*[:\-|]\s*(.+)$/i))){
        if(cur) cur.qAs = String(m[1]).trim();
        continue;
      }
      if((m = line.match(/^(?:q|question)\s*[:\-|]\s*(.+)$/i))){
        flush();
        const b = splitBi(m[1]);
        cur = { qEn: b.en, qAs: b.as, options: emptyOptions(), answer: null };
        continue;
      }
      if((m = line.match(/^(?:ans|answer|correct)\s*[:\-|]?\s*([A-Da-d])\b/i))){
        if(cur) cur.answer = m[1].toUpperCase();
        continue;
      }
      if((m = line.match(/^([A-Da-d])\s*[\)\.\:]\s*(.+)$/))){
        if(!cur) continue;
        const idx = 'ABCD'.indexOf(m[1].toUpperCase());
        if(idx >= 0){
          const b = splitBi(m[2]);
          cur.options[idx] = { en: b.en, as: b.as };
        }
        continue;
      }
    }
    flush();
    return { title: title, questions: questions };
  }

  /* ---------------- PDF LAYOUT CSS ---------------- */

  const PDF_CSS = `
  .pk-pdf-root { position: fixed; left: -10000px; top: 0; z-index: -1; pointer-events: none; }
  .pk-pdf-root, .pk-pdf-root * { box-sizing: border-box; }
  .pk-pdf-root .sheet {
    width: 210mm; height: 297mm;
    padding: 10mm 11mm 8mm;
    background: #fff;
    display: flex; flex-direction: column;
    overflow: hidden;
    margin: 0;
    box-shadow: none;
    font-family: Arial, sans-serif;
    color: #111;
  }
  .pk-pdf-root .page-header {
    flex: 0 0 14mm;
    display: grid;
    grid-template-columns: max-content minmax(0, 1fr) max-content 10mm;
    align-items: center;
    gap: 3mm;
    border-bottom: 0.3mm solid #777;
    padding-bottom: 3mm;
    white-space: nowrap;
  }
  .pk-pdf-root .header-brand {
    font-size: 8pt; font-weight: 700; color: #111; letter-spacing: -0.2px;
    line-height: 1;
  }
  .pk-pdf-root .header-brand .in { color: #999; }
  .pk-pdf-root .header-subject {
    font-size: 8pt; font-weight: 600; color: #444;
    padding-left: 4mm; border-left: 0.2mm solid #d5d5d5;
    text-align: center; line-height: 1;
    overflow: hidden; text-overflow: ellipsis;
  }
  .pk-pdf-root .header-id {
    font-size: 8pt; font-weight: 600; color: #444;
    padding-left: 4mm; border-left: 0.2mm solid #d5d5d5;
    line-height: 1;
  }
  .pk-pdf-root .header-qr {
    width: 10mm; height: 10mm; display: block; object-fit: contain; flex-shrink: 0;
  }
  .pk-pdf-root .question-grid {
    flex: 1; min-height: 0;
    display: grid;
    grid-template-rows: repeat(5, minmax(0, 1fr));
  }
  .pk-pdf-root .question-pair {
    min-height: 0;
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    border-bottom: 0.25mm solid #d0d0d0;
    break-inside: avoid;
  }
  .pk-pdf-root .question-pair:last-child { border-bottom: none; }
  .pk-pdf-root .language-card {
    min-width: 0; min-height: 0;
    padding: 4mm;
    display: flex; flex-direction: column;
    overflow: hidden;
  }
  .pk-pdf-root .language-card.english {
    border-right: 0.3mm solid #bcbcbc;
    font-family: "Times New Roman", Times, serif;
  }
  .pk-pdf-root .language-card.assamese {
    font-family: "Hind Siliguri", "Noto Sans Bengali", "Nirmala UI", sans-serif;
  }
  .pk-pdf-root .question {
    font-size: 11pt; font-weight: 700; line-height: 1.35;
    margin: 0 0 2mm; color: #111;
  }
  .pk-pdf-root .language-card.assamese .question { font-size: 10.5pt; font-weight: 600; }
  .pk-pdf-root .language-card.assamese .option { font-weight: 500; }
  .pk-pdf-root .language-card.assamese .option-label { font-weight: 600; }
  .pk-pdf-root .language-card.assamese .answer { font-weight: 600; }
  .pk-pdf-root .question-number { font-weight: 700; white-space: nowrap; }
  .pk-pdf-root .options {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    column-gap: 2.5mm; row-gap: 1.5mm;
    font-size: 9.5pt; line-height: 1.3;
  }
  .pk-pdf-root .option {
    min-width: 0;
    display: flex; align-items: flex-start; gap: 1.5mm;
  }
  .pk-pdf-root .option-label { flex-shrink: 0; font-weight: 700; }
  .pk-pdf-root .answer {
    margin-top: 1.5mm;
    padding-top: 1.5mm;
    border-top: 0.2mm solid #e1e1e1;
    font-size: 9pt; font-weight: 700; line-height: 1.3;
  }
  .pk-pdf-root .page-footer {
    flex: 0 0 8mm;
    display: grid; grid-template-columns: 1fr 1fr 1fr;
    align-items: end;
    border-top: 0.25mm solid #bdbdbd;
    padding-top: 2mm;
    font-size: 7pt; font-weight: 600; color: #666;
    letter-spacing: 0.25px;
  }
  .pk-pdf-root .footer-brand { color: #222; text-align: left; }
  .pk-pdf-root .footer-subject { text-align: center; }
  .pk-pdf-root .footer-page { text-align: right; }
  `;

  function ensurePdfStyles(){
    if(document.getElementById('pk-pdf-styles')) return;
    const style = document.createElement('style');
    style.id = 'pk-pdf-styles';
    style.textContent = PDF_CSS;
    document.head.appendChild(style);
  }

  /* ---------------- PDF HTML BUILDER ---------------- */

  function escHtml(s){
    return String(s == null ? '' : s).replace(/[&<>"']/g, function(c){
      return { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c];
    });
  }

  function assameseNumber(n){
    return String(n).replace(/[0-9]/g, function(d){
      return '০১২৩৪৫৬৭৮৯'[Number(d)];
    });
  }

  function getQRUrl(){
    const input = document.getElementById('in-url');
    if(input && input.value.trim()) return input.value.trim();
    return 'https://chat.whatsapp.com/DLrcA98MrlYKOeZ5DMeN5Z?s=cl&p=a&iam=2';
  }

  function buildLanguageCard(q, number, lang){
    const isEn = lang === 'en';
    const card = document.createElement('div');
    card.className = 'language-card ' + (isEn ? 'english' : 'assamese');

    const qText = isEn ? (q.qEn || '') : (q.qAs || '');
    const numText = isEn ? 'Q' + number + '.' : 'প্ৰশ্ন ' + assameseNumber(number) + '.';

    const optsHtml = q.options.map(function(opt, i){
      const letter = 'ABCD'[i];
      const text = isEn ? ((opt && opt.en) || '') : ((opt && opt.as) || '');
      return '<div class="option"><b class="option-label">' + letter + '.</b><span>' +
             escHtml(text) + '</span></div>';
    }).join('');

    let answerHtml = '';
    if(q.answer && 'ABCD'.indexOf(q.answer) >= 0){
      const idx = 'ABCD'.indexOf(q.answer);
      const opt = q.options[idx] || { en: '', as: '' };
      const ansText = isEn ? (opt.en || '') : (opt.as || '');
      answerHtml = isEn
        ? 'Correct: ' + q.answer + '. ' + escHtml(ansText)
        : 'শুদ্ধ উত্তৰ: ' + q.answer + '. ' + escHtml(ansText);
    }

    card.innerHTML =
      '<div class="question"><span class="question-number">' + numText + '</span> ' +
        escHtml(qText) + '</div>' +
      '<div class="options">' + optsHtml + '</div>' +
      (answerHtml ? '<div class="answer">' + answerHtml + '</div>' : '');

    return card;
  }

  function buildQuestionPair(q, number){
    const pair = document.createElement('div');
    pair.className = 'question-pair';
    pair.appendChild(buildLanguageCard(q, number, 'en'));
    pair.appendChild(buildLanguageCard(q, number, 'as'));
    return pair;
  }

  function buildSheet(testData, questions, startIndex, pageNum, totalPages, qrUrl){
    const sheet = document.createElement('section');
    sheet.className = 'sheet';

    const header = document.createElement('header');
    header.className = 'page-header';
    header.innerHTML =
      '<span class="header-brand">Preparekora<span class="in">.in</span></span>' +
      '<span class="header-subject">' + escHtml(testData.subject) + '</span>' +
      '<span class="header-id">MT ID: ' + escHtml(testData.mtId) + '</span>' +
      '<img class="header-qr" alt="QR" crossOrigin="anonymous" />';
    const qrImg = header.querySelector('.header-qr');
    qrImg.src = 'https://api.qrserver.com/v1/create-qr-code/?size=240x240&margin=0&data=' +
                encodeURIComponent(qrUrl);
    sheet.appendChild(header);

    const grid = document.createElement('main');
    grid.className = 'question-grid';
    questions.forEach(function(q, i){
      grid.appendChild(buildQuestionPair(q, startIndex + i + 1));
    });
    sheet.appendChild(grid);

    const footer = document.createElement('footer');
    footer.className = 'page-footer';
    footer.innerHTML =
      '<span class="footer-brand">PREPAREKORA.IN</span>' +
      '<span class="footer-subject">' + escHtml(String(testData.subject || '').toUpperCase()) + '</span>' +
      '<span class="footer-page">' +
        String(pageNum).padStart(2, '0') + ' / ' + String(totalPages).padStart(2, '0') +
      '</span>';
    sheet.appendChild(footer);

    return sheet;
  }

  /* ---------------- FONT + ASSET WAITING ---------------- */

  async function waitForFonts(){
    if(!document.fonts || !document.fonts.ready) return;
    try{
      await document.fonts.ready;
      await Promise.all([
        document.fonts.load('400 12px "Noto Sans Bengali"'),
        document.fonts.load('700 12px "Noto Sans Bengali"'),
        document.fonts.load('400 12px "Hind Siliguri"'),
        document.fonts.load('500 12px "Hind Siliguri"'),
        document.fonts.load('600 12px "Hind Siliguri"'),
        document.fonts.load('700 12px "Hind Siliguri"')
      ]);
    }catch(e){ /* ignore */ }
  }

  function waitForImages(root){
    const imgs = Array.prototype.slice.call(root.querySelectorAll('img'));
    return Promise.all(imgs.map(function(img){
      return new Promise(function(resolve){
        if(img.complete && img.naturalWidth > 0) return resolve();
        img.onload  = function(){ resolve(); };
        img.onerror = function(){ img.style.visibility = 'hidden'; resolve(); };
        setTimeout(resolve, 8000);
      });
    }));
  }

  /* ---------------- DIGITAL PDF VIA PRINT ---------------- */

  function buildPrintDocument(sheetsHtml, title){
    return '<!DOCTYPE html><html><head><meta charset="UTF-8">' +
      '<title>' + escHtml(title || 'MCQ Paper') + '</title>' +
      '<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+Bengali:wght@400;600;700;800&family=Hind+Siliguri:wght@400;500;600;700&display=swap" rel="stylesheet">' +
      '<style>' +
        '@page { size: A4 portrait; margin: 0; }' +
        'html, body { margin: 0; padding: 0; background: #fff; -webkit-print-color-adjust: exact; print-color-adjust: exact; }' +
        PDF_CSS +
        '.pk-pdf-root { position: static !important; left: auto !important; top: auto !important; z-index: auto !important; pointer-events: auto !important; }' +
        '.pk-pdf-root .sheet { page-break-after: always; break-after: page; box-shadow: none; }' +
        '.pk-pdf-root .sheet:last-child { page-break-after: auto; break-after: auto; }' +
      '</style></head><body><div class="pk-pdf-root">' +
      sheetsHtml +
      '</div></body></html>';
  }

  async function generatePDF(testData, onProgress){
    ensurePdfStyles();

    /* Open print window SYNCHRONOUSLY to survive popup blockers. */
    const printWin = global.open('', '_blank');
    if(!printWin){
      throw new Error('Popup blocked. Allow popups for this site, then click Create again.');
    }
    printWin.document.write(
      '<!DOCTYPE html><html><body style="font-family:sans-serif;padding:40px;color:#333">' +
      'Preparing digital PDF… please wait.</body></html>'
    );
    printWin.document.close();

    const perPage = 5;
    const total = testData.questions.length;
    const totalPages = Math.ceil(total / perPage);
    const qrUrl = getQRUrl();

    const root = document.createElement('div');
    root.className = 'pk-pdf-root';

    for(let p = 0; p < totalPages; p++){
      const slice = testData.questions.slice(p * perPage, (p + 1) * perPage);
      root.appendChild(buildSheet(testData, slice, p * perPage, p + 1, totalPages, qrUrl));
    }

    document.body.appendChild(root);

    try{
      if(typeof onProgress === 'function') onProgress('preparing');
      await waitForFonts();
      await waitForImages(root);
      await new Promise(function(r){ setTimeout(r, 120); });

      const sheetsHtml = root.innerHTML;

      printWin.document.open();
      printWin.document.write(buildPrintDocument(sheetsHtml, testData.title));
      printWin.document.close();

      /* Wait for print window resources */
      await new Promise(function(resolve){
        const check = function(){
          if(printWin.document.readyState === 'complete') resolve();
          else setTimeout(check, 100);
        };
        check();
      });

      try{ await printWin.document.fonts.ready; }catch(e){}

      const printImgs = Array.prototype.slice.call(printWin.document.querySelectorAll('img'));
      await Promise.all(printImgs.map(function(img){
        return new Promise(function(resolve){
          if(img.complete && img.naturalWidth > 0) return resolve();
          img.onload = resolve;
          img.onerror = resolve;
          setTimeout(resolve, 6000);
        });
      }));

      await new Promise(function(r){ setTimeout(r, 300); });

      if(typeof onProgress === 'function') onProgress('printing');
      printWin.focus();
      printWin.print();
    } finally {
      if(root.parentNode) root.parentNode.removeChild(root);
    }
  }

  /* ---------------- UI WIRING ---------------- */

  function wire(){
    const subjectSel  = document.getElementById('paper-subject');
    const customWrap  = document.getElementById('paper-custom-wrap');
    const customInput = document.getElementById('paper-custom-subject');
    const titleInput  = document.getElementById('paper-title');
    const inputEl     = document.getElementById('paper-input');
    const createBtn   = document.getElementById('paper-create');
    const msgEl       = document.getElementById('paper-msg');
    const summaryEl   = document.getElementById('paper-summary');
    const openPdfBtn  = document.getElementById('paper-open-pdf');
    const thumbBtn    = document.getElementById('paper-thumb-btn');
    const sumMtId     = document.getElementById('sum-mtid');
    const sumSubject  = document.getElementById('sum-subject');
    const sumTitle    = document.getElementById('sum-title');
    const sumCount    = document.getElementById('sum-count');

    if(!createBtn) return;

    subjectSel.addEventListener('change', function(){
      customWrap.hidden = subjectSel.value !== 'Custom';
      if(!customWrap.hidden) customInput.focus();
    });

    function setMsg(text, ok){
      msgEl.className = 'msg' + (ok ? ' ok' : '');
      msgEl.textContent = text || '';
    }

    function renderSummary(data){
      sumMtId.textContent    = data.mtId;
      sumSubject.textContent = data.subject;
      sumTitle.textContent   = data.title;
      sumCount.textContent   = data.totalQuestions +
        (data.totalQuestions === 1 ? ' question' : ' questions');
      summaryEl.hidden = false;
    }

    const saved = PKState.get();
    if(saved && saved.questions && saved.questions.length) renderSummary(saved);

    createBtn.addEventListener('click', async function(){
      setMsg('');

      let subject = subjectSel.value;
      if(subject === 'Custom'){
        subject = customInput.value.trim();
        if(!subject){ setMsg('Enter a custom subject name.'); return; }
      }
      if(!subject){ setMsg('Please select a subject.'); return; }

      const parsed = parseMCQs(inputEl.value);
      if(parsed.questions.length === 0){
        setMsg('No valid questions found. Each question must start with "Q:" and have at least 2 options.');
        return;
      }
      for(let i = 0; i < parsed.questions.length; i++){
        const filled = parsed.questions[i].options.filter(function(o){ return o && o.en; }).length;
        if(filled < 2){
          setMsg('Question ' + (i + 1) + ' needs at least 2 options.');
          return;
        }
      }

      createBtn.disabled = true;
      const label = createBtn.textContent;
      createBtn.textContent = 'Preparing…';

      try{
        const peekedId = PKState.peekMTId(subject);
        const draft = PKState.buildTestData({
          mtId:      peekedId,
          subject:   subject,
          title:     titleInput.value.trim() || parsed.title || '',
          questions: parsed.questions
        });

        await generatePDF(draft, function(stage){
          if(stage === 'preparing') createBtn.textContent = 'Preparing digital PDF…';
          else if(stage === 'printing') createBtn.textContent = 'Opening print dialog…';
        });

        const consumedId = PKState.consumeMTId(subject);
        draft.mtId = consumedId;

        PKState.save(draft);
        renderSummary(draft);

        setMsg('Ready — Save as PDF from the print dialog (Choose "Save as PDF") · ' +
               draft.mtId + ' · ' + draft.totalQuestions + ' questions', true);
        summaryEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        window.dispatchEvent(new CustomEvent('pk:papercreated', { detail: draft }));
      }catch(err){
        console.error(err);
        setMsg('PDF generation failed: ' + (err && err.message ? err.message : err));
      }finally{
        createBtn.disabled = false;
        createBtn.textContent = label;
      }
    });

    openPdfBtn.addEventListener('click', async function(){
      setMsg('');
      const data = PKState.get();
      if(!data || !data.questions || !data.questions.length){
        setMsg('No test data available. Click Create first.');
        return;
      }
      openPdfBtn.disabled = true;
      const label = openPdfBtn.textContent;
      openPdfBtn.textContent = 'Opening…';
      try{
        await generatePDF(data);
        setMsg('Print dialog opened — choose "Save as PDF".', true);
      }catch(err){
        console.error(err);
        setMsg('Could not open PDF: ' + (err && err.message ? err.message : err));
      }finally{
        openPdfBtn.disabled = false;
        openPdfBtn.textContent = label;
      }
    });

    thumbBtn.addEventListener('click', function(){
      if(global.PKApp && typeof global.PKApp.switchTool === 'function'){
        global.PKApp.switchTool('thumb');
      } else {
        const tab = document.querySelector('.tool-tabs button[data-tool="thumb"]');
        if(tab) tab.click();
      }
    });
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', wire);
  } else {
    wire();
  }

  global.PKMCQ = {
    splitBi: splitBi,
    parseMCQs: parseMCQs,
    generatePDF: generatePDF
  };

})(window);
