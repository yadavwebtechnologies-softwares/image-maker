/* ================================================================
   mcq.js — PrepareKora MCQ Paper Builder (browser-print PDF)
   Renders the exact bilingual A4 template — 5 questions per page,
   English (left) + Assamese (right), inline answer, header with
   MT ID + QR, footer with brand + page numbers.
   ================================================================ */
(function initMCQ(global){
  'use strict';

  /* ---------------- helpers ---------------- */
  function escHtml(s){
    return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({
      '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
    }[c]));
  }

  /* ---------------- parser (unchanged) ---------------- */
  function splitBi(raw){
    let en = String(raw == null ? '' : raw).trim();
    let as = '';
    if(en.indexOf('|') !== -1){
      as = String(raw).slice(String(raw).indexOf('|') + 1).trim();
      en = String(raw).slice(0, String(raw).indexOf('|')).trim();
    } else {
      const m = en.match(/^(.*?)\s*\(([^()]+)\)\s*$/);
      if(m){ en = m[1].trim(); as = m[2].trim(); }
    }
    return { en, as };
  }

  function emptyOptions(){
    return [
      { en:'', as:'' }, { en:'', as:'' }, { en:'', as:'' }, { en:'', as:'' }
    ];
  }

  function parseMCQs(text){
    const lines = String(text || '').split(/\r?\n/);
    const questions = [];
    let title = '';
    let cur = null;

    function flush(){
      if(!cur) return;
      const filled = cur.options.filter(o => o && o.en).length;
      if(cur.qEn && filled >= 2) questions.push(cur);
      cur = null;
    }

    for(let li = 0; li < lines.length; li++){
      const line = String(lines[li]).trim();
      if(!line) continue;
      let m;

      if((m = line.match(/^title\s*[:\-|]\s*(.+)$/i))){
        if(!title){ const b = splitBi(m[1]); title = b.en; }
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
    return { title, questions };
  }

  /* ---------------- QR URL source ----------------
     Reads from the thumbnail's saved state (single source of truth).
     Falls back to the default WhatsApp URL. */
  function getQRUrl(){
    try{
      const s = JSON.parse(localStorage.getItem('pk_banner_state') || 'null');
      if(s && s.url) return s.url;
    }catch(e){}
    return 'https://chat.whatsapp.com/DLrcA98MrlYKOeZ5DMeN5Z';
  }

  /* ---------------- print template CSS (verbatim) ---------------- */
  const PRINT_CSS = `
* { box-sizing: border-box; }
body { margin: 0; padding: 20px; background: #ededed; color: #111; font-family: Arial, sans-serif; }
.sheet {
  width: 210mm; height: 297mm; margin: 0 auto 20px; padding: 10mm 11mm 8mm;
  background: #fff; display: flex; flex-direction: column;
  box-shadow: 0 2px 12px rgba(0,0,0,0.10); overflow: hidden;
}
.page-header {
  flex: 0 0 14mm; display: grid;
  grid-template-columns: max-content minmax(0, 1fr) max-content 10mm;
  justify-content: space-between; align-items: center; gap: 3mm;
  border-bottom: 0.3mm solid #777; padding-bottom: 3mm;
  font-family: Arial, sans-serif; white-space: nowrap;
}
.header-brand { font-size: 8pt; font-weight: 700; color: #111; letter-spacing: -0.2px; }
.header-brand .in { color: #999; }
.header-subject, .header-id { font-size: 8pt; font-weight: 600; color: #444; }
.header-subject {
  padding-left: 4mm; border-left: 0.2mm solid #d5d5d5; text-align: center;
  overflow: hidden; text-overflow: ellipsis;
}
.header-id { padding-left: 4mm; border-left: 0.2mm solid #d5d5d5; }
.header-qr { width: 10mm; height: 10mm; display: block; object-fit: contain; flex-shrink: 0; }
.question-grid {
  flex: 1; min-height: 0; display: grid;
  grid-template-rows: repeat(5, minmax(0, 1fr));
}
.question-pair {
  min-height: 0; display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  border-bottom: 0.25mm solid #d0d0d0;
  break-inside: avoid; page-break-inside: avoid;
}
.question-pair:last-child { border-bottom: none; }
.language-card {
  min-width: 0; min-height: 0; padding: 4mm 4mm;
  display: flex; flex-direction: column; overflow: hidden;
}
.english { border-right: 0.3mm solid #bcbcbc; font-family: "Times New Roman", Times, serif; }
.assamese { font-family: "Noto Sans Bengali", "Nirmala UI", sans-serif; }
.question { font-size: 11pt; font-weight: 700; line-height: 1.35; margin: 0 0 3mm; color: #111; }
.assamese .question { font-size: 10.5pt; }
.question-number { font-weight: 700; white-space: nowrap; }
.options {
  display: grid; grid-template-columns: repeat(2, minmax(0, 1fr));
  column-gap: 3mm; row-gap: 2.2mm; font-size: 9.5pt; line-height: 1.3;
}
.option { min-width: 0; display: flex; align-items: flex-start; gap: 1.5mm; }
.option-label { flex-shrink: 0; font-weight: 700; }
.answer {
  margin-top: auto; padding-top: 2.5mm; border-top: 0.2mm solid #e1e1e1;
  font-size: 9pt; font-weight: 700; line-height: 1.3;
}
.page-footer {
  flex: 0 0 8mm; display: grid; grid-template-columns: 1fr 1fr 1fr;
  align-items: end; border-top: 0.25mm solid #bdbdbd; padding-top: 2mm;
  font-family: Arial, sans-serif; font-size: 7pt; font-weight: 600;
  color: #666; letter-spacing: 0.25px;
}
.footer-brand { color: #222; text-align: left; }
.footer-subject { text-align: center; }
.footer-page { text-align: right; }
@page { size: A4 portrait; margin: 0; }
@media print {
  html, body { width: 210mm; margin: 0; padding: 0; background: #fff; }
  .sheet {
    width: 210mm; height: 297mm; margin: 0; padding: 10mm 11mm 8mm;
    box-shadow: none; overflow: hidden;
    page-break-after: always; break-after: page;
  }
  .sheet:last-child { page-break-after: auto; break-after: auto; }
  * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
}
`;

  /* ---------------- print template JS (adapted) ---------------- */
  const PRINT_JS = `
function element(tag, className, text) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text !== undefined) el.textContent = text;
  return el;
}
function assameseNumber(number) {
  const digits = "০১২৩৪৫৬৭৮৯";
  return String(number).replace(/[0-9]/g, d => digits[Number(d)]);
}
function createHeader() {
  const header = element("header", "page-header");
  const brand = element("span", "header-brand");
  brand.appendChild(document.createTextNode(PK_DATA.brand));
  brand.appendChild(element("span", "in", ".in"));
  header.append(
    brand,
    element("span", "header-subject", PK_DATA.subject),
    element("span", "header-id", "MT ID: " + PK_DATA.mtId)
  );
  const qr = element("img", "header-qr");
  qr.alt = "QR Code";
  const u = new URL("https://api.qrserver.com/v1/create-qr-code/");
  u.searchParams.set("size", "240x240");
  u.searchParams.set("margin", "0");
  u.searchParams.set("data", PK_DATA.qrUrl);
  qr.src = u.href;
  header.appendChild(qr);
  return header;
}
function createFooter(page, total) {
  const footer = element("footer", "page-footer");
  footer.append(
    element("span", "footer-brand", "PREPAREKORA.IN"),
    element("span", "footer-subject", PK_DATA.footerSubject),
    element("span", "footer-page",
      String(page).padStart(2, "0") + " / " + String(total).padStart(2, "0"))
  );
  return footer;
}
function createCard(number, language, qData) {
  const isEnglish = language === "en";
  const card = element("div", "language-card " + (isEnglish ? "english" : "assamese"));
  const heading = element("div", "question");
  const numberText = isEnglish
    ? "Q" + number + "."
    : "প্ৰশ্ন " + assameseNumber(number) + ".";
  heading.append(
    element("span", "question-number", numberText),
    document.createTextNode(" " + (isEnglish ? qData.en : qData.as))
  );
  card.appendChild(heading);
  const options = element("div", "options");
  qData.options.forEach((option, index) => {
    const letter = ["A", "B", "C", "D"][index];
    const item = element("div", "option");
    item.append(
      element("b", "option-label", letter + "."),
      element("span", "", isEnglish ? (option[0] || '') : (option[1] || ''))
    );
    options.appendChild(item);
  });
  card.appendChild(options);
  if (qData.answer) {
    const idx = ["A", "B", "C", "D"].indexOf(qData.answer);
    const ansOpt = qData.options[idx] || ['', ''];
    const ansText = isEnglish
      ? "Correct: " + qData.answer + ". " + (ansOpt[0] || '')
      : "শুদ্ধ উত্তৰ: " + qData.answer + ". " + (ansOpt[1] || '');
    card.appendChild(element("div", "answer", ansText));
  }
  return card;
}
function createQuestionPair(qData, number) {
  const pair = element("div", "question-pair");
  pair.append(
    createCard(number, "en", qData),
    createCard(number, "as", qData)
  );
  return pair;
}
function createPage(pageQuestions, startIndex, pageNum, totalPages) {
  const sheet = element("section", "sheet");
  sheet.appendChild(createHeader());
  const grid = element("main", "question-grid");
  pageQuestions.forEach((q, i) => {
    grid.appendChild(createQuestionPair(q, startIndex + i + 1));
  });
  sheet.appendChild(grid);
  sheet.appendChild(createFooter(pageNum, totalPages));
  return sheet;
}
function renderPaper() {
  const output = document.getElementById("paper");
  if (!output) return;
  const perPage = 5;
  const totalPages = Math.ceil(PK_DATA.questions.length / perPage);
  for (let page = 0; page < totalPages; page++) {
    const start = page * perPage;
    const pageQuestions = PK_DATA.questions.slice(start, start + perPage);
    output.appendChild(createPage(pageQuestions, start, page + 1, totalPages));
  }
}
renderPaper();
`;

  /* ---------------- build full HTML for the print window ---------------- */
  function buildPrintHTML(testData){
    const questions = testData.questions.map(q => ({
      en: q.qEn || '',
      as: q.qAs || '',
      options: (q.options || []).map(o => [ (o && o.en) || '', (o && o.as) || '' ]),
      answer: q.answer || null
    }));

    const subject = testData.subject || 'General Knowledge';
    const data = {
      brand: 'Preparekora',
      subject: subject,
      footerSubject: subject.toUpperCase(),
      mtId: testData.mtId || '',
      qrUrl: getQRUrl(),
      questions: questions
    };

    // JSON is safe inside <script> after escaping </script
    const jsonStr = JSON.stringify(data).replace(/<\/script/gi, '<\\/script');

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escHtml(data.subject)} | ${escHtml(data.mtId)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+Bengali:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>${PRINT_CSS}</style>
</head>
<body>
<div id="paper"></div>
<script>
const PK_DATA = ${jsonStr};
${PRINT_JS}
</script>
<script>
function pkAutoPrint(){
  const ready = (document.fonts && document.fonts.ready) ? document.fonts.ready : Promise.resolve();
  ready.then(function(){
    setTimeout(function(){
      try { window.focus(); window.print(); } catch(e){}
    }, 800);
  });
}
if (document.readyState === 'complete') pkAutoPrint();
else window.addEventListener('load', pkAutoPrint);
</script>
</body>
</html>`;
  }

  /* ---------------- open print preview window ---------------- */
  function openPrintPreview(testData){
    const w = window.open('', '_blank');
    if(!w) throw new Error('Popup blocked. Please allow popups for this site.');
    try{
      const html = buildPrintHTML(testData);
      w.document.open();
      w.document.write(html);
      w.document.close();
    } catch(e){
      try{ w.close(); }catch(x){}
      throw e;
    }
    return w;
  }

  /* ---------------- UI wiring ---------------- */
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

    const sumMtId    = document.getElementById('sum-mtid');
    const sumSubject = document.getElementById('sum-subject');
    const sumTitle   = document.getElementById('sum-title');
    const sumCount   = document.getElementById('sum-count');

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

    // restore summary from a saved session
    const saved = PKState.get();
    if(saved && saved.questions && saved.questions.length){
      renderSummary(saved);
    }

    /* ---------- CREATE button ---------- */
    createBtn.addEventListener('click', function(){
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
        const q = parsed.questions[i];
        const filled = q.options.filter(o => o && o.en).length;
        if(filled < 2){
          setMsg('Question ' + (i + 1) + ' needs at least 2 options.');
          return;
        }
      }

      createBtn.disabled = true;
      const label = createBtn.textContent;
      createBtn.textContent = 'Creating…';

      try{
        const peekedId = PKState.peekMTId(subject);
        const draft = PKState.buildTestData({
          mtId: peekedId,
          subject: subject,
          title: titleInput.value.trim() || parsed.title || '',
          questions: parsed.questions
        });

        // Open window synchronously from user gesture
        const w = window.open('', '_blank');
        if(!w){
          setMsg('Popup blocked. Please allow popups for this site and try again.');
          createBtn.disabled = false;
          createBtn.textContent = label;
          return;
        }

        // Write first pass with peeked ID
        const html = buildPrintHTML(draft);
        w.document.open();
        w.document.write(html);
        w.document.close();

        // Consume ID (should match peeked unless race)
        const consumedId = PKState.consumeMTId(subject);
        if(consumedId !== peekedId){
          draft.mtId = consumedId;
          const finalHtml = buildPrintHTML(draft);
          w.document.open();
          w.document.write(finalHtml);
          w.document.close();
        }

        PKState.save(draft);
        renderSummary(draft);
        summaryEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

        setMsg('Print dialog opening · ' + draft.mtId + ' · ' + draft.totalQuestions + ' questions', true);
        window.dispatchEvent(new CustomEvent('pk:papercreated', { detail: draft }));

        createBtn.disabled = false;
        createBtn.textContent = label;
      } catch(err){
        console.error(err);
        setMsg('Failed: ' + (err && err.message ? err.message : err));
        createBtn.disabled = false;
        createBtn.textContent = 'Create';
      }
    });

    /* ---------- OPEN PDF (reopens print preview from saved data) ---------- */
    openPdfBtn.addEventListener('click', function(){
      setMsg('');
      const data = PKState.get();
      if(!data || !data.questions || !data.questions.length){
        setMsg('No test data available. Click Create first.');
        return;
      }
      try{
        openPrintPreview(data);
      } catch(err){
        console.error(err);
        setMsg('Could not open print preview: ' + (err && err.message ? err.message : err));
      }
    });

    /* ---------- CREATE THUMBNAIL ---------- */
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

  /* ---------------- export ---------------- */
  global.PKMCQ = {
    splitBi: splitBi,
    parseMCQs: parseMCQs,
    buildPrintHTML: buildPrintHTML,
    openPrintPreview: openPrintPreview
  };

})(window);
