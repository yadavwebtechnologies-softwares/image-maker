/* ================================================================
   mcq.js — PrepareKora MCQ Paper Builder
   Responsibilities:
     • parse pasted MCQs into { qEn, qAs, options[4], answer }
     • validate every question before generation
     • build the A4 PDF with jsPDF (vector text)
     • wire the Paper Builder UI to PKState (single source of truth)
   ================================================================ */
(function initMCQ(global){
  'use strict';

  /* ==========================================================
     PARSER
     ========================================================== */

  function splitBi(raw){
    let en = String(raw == null ? '' : raw).trim();
    let as = '';
    if(en.indexOf('|') !== -1){
      const i = en.indexOf('|');
      en = en.slice(0, i).trim();
      as = en.length >= 0 ? String(raw).slice(i + 1).trim() : '';
      // safer re-slice from original to avoid index drift
      as = String(raw).slice(String(raw).indexOf('|') + 1).trim();
    } else {
      const m = en.match(/^(.*?)\s*\(([^()]+)\)\s*$/);
      if(m){ en = m[1].trim(); as = m[2].trim(); }
    }
    return { en: en, as: as };
  }

  function emptyOptions(){
    return [
      { en: '', as: '' },
      { en: '', as: '' },
      { en: '', as: '' },
      { en: '', as: '' }
    ];
  }

  /**
   * parseMCQs(text) → { title: string, questions: Question[] }
   * Each Question: { qEn, qAs, options:[4], answer:'A'..'D'|null }
   * Rules:
   *  - `Title:` line anywhere sets the title (first wins)
   *  - `Q:` / `Question:` starts a new question (flushes previous)
   *  - `Q(as):` sets Assamese-only line on current question
   *  - `A)` … `D)` set options on current question
   *  - `Ans:` / `Answer:` / `Correct:` sets answer letter
   *  - bilingual via `( )` or `|` on any of the above
   */
  function parseMCQs(text){
    const lines = String(text || '').split(/\r?\n/);
    const questions = [];
    let title = '';
    let cur = null;

    function flush(){
      if(!cur) return;
      const filled = cur.options.filter(function(o){ return o && o.en; }).length;
      if(cur.qEn && filled >= 2){
        questions.push(cur);
      }
      cur = null;
    }

    for(let li = 0; li < lines.length; li++){
      const line = String(lines[li]).trim();
      if(!line) continue;
      let m;

      // Title line
      if((m = line.match(/^title\s*[:\-|]\s*(.+)$/i))){
        if(!title){
          const b = splitBi(m[1]);
          title = b.en;
        }
        continue;
      }

      // Q(as):
      if((m = line.match(/^q\s*\(\s*as\s*\)\s*[:\-|]\s*(.+)$/i))){
        if(cur){
          cur.qAs = String(m[1]).trim();
        }
        continue;
      }

      // Q: / Question:
      if((m = line.match(/^(?:q|question)\s*[:\-|]\s*(.+)$/i))){
        flush();
        const b = splitBi(m[1]);
        cur = { qEn: b.en, qAs: b.as, options: emptyOptions(), answer: null };
        continue;
      }

      // Ans: / Answer: / Correct:
      if((m = line.match(/^(?:ans|answer|correct)\s*[:\-|]?\s*([A-Da-d])\b/i))){
        if(cur) cur.answer = m[1].toUpperCase();
        continue;
      }

      // Options A) B) C) D)
      if((m = line.match(/^([A-Da-d])\s*[\)\.\:]\s*(.+)$/))){
        if(!cur) continue;
        const idx = 'ABCD'.indexOf(m[1].toUpperCase());
        if(idx >= 0){
          const b = splitBi(m[2]);
          cur.options[idx] = { en: b.en, as: b.as };
        }
        continue;
      }

      // Other lines: ignore (safe — could be stray separator or note)
    }

    flush();
    return { title: title, questions: questions };
  }

  /* ==========================================================
     BENGALI FONT (lazy, best-effort)
     ========================================================== */

  let bengaliFontPromise = null;

  function arrayBufferToBase64(buf){
    const bytes = new Uint8Array(buf);
    let bin = '';
    const CHUNK = 0x8000;
    for(let i = 0; i < bytes.length; i += CHUNK){
      bin += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK));
    }
    return btoa(bin);
  }

  function loadBengaliFontBase64(){
    if(bengaliFontPromise) return bengaliFontPromise;
    bengaliFontPromise = (async function(){
      const url = 'https://cdn.jsdelivr.net/gh/googlefonts/noto-fonts@main/hinted/ttf/NotoSansBengali/NotoSansBengali-Regular.ttf';
      try{
        const res = await fetch(url);
        if(!res.ok) return null;
        const buf = await res.arrayBuffer();
        return arrayBufferToBase64(buf);
      }catch(e){
        return null;
      }
    })();
    return bengaliFontPromise;
  }

  async function tryRegisterBengali(doc){
    const b64 = await loadBengaliFontBase64();
    if(!b64) return false;
    try{
      doc.addFileToVFS('NotoSansBengali-Regular.ttf', b64);
      doc.addFont('NotoSansBengali-Regular.ttf', 'NotoSansBengali', 'normal');
      return true;
    }catch(e){
      return false;
    }
  }

  /* ==========================================================
     PDF GENERATOR
     ========================================================== */

  async function generatePDF(testData){
    const jsPDFCtor = (global.jspdf && global.jspdf.jsPDF) || global.jsPDF;
    if(typeof jsPDFCtor !== 'function'){
      throw new Error('PDF library not loaded. Check your internet connection and refresh.');
    }

    const doc = new jsPDFCtor({ unit: 'pt', format: 'a4', orientation: 'portrait' });

    doc.setProperties({
      title: testData.title || 'MCQ Paper',
      subject: testData.subject || '',
      author: 'PrepareKora.in',
      creator: 'PrepareKora Studio'
    });

    const hasBengali = testData.questions.some(function(q){
      return q.qAs || q.options.some(function(o){ return o && o.as; });
    });
    const bengaliReady = hasBengali ? await tryRegisterBengali(doc) : false;

    const PW = doc.internal.pageSize.getWidth();
    const PH = doc.internal.pageSize.getHeight();
    const ML = 46, MR = 46, MT = 46, MB = 54;
    const CW = PW - ML - MR;

    const INK   = [17, 24, 39];
    const MUTED = [75, 85, 99];
    const LINE  = [215, 219, 224];
    const SOFT  = [245, 247, 250];
    const GREEN = [22, 163, 74];

    let y = MT;

    function drawHeader(){
      y = MT;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      doc.setTextColor(INK[0], INK[1], INK[2]);
      doc.text('PrepareKora', ML, y);
      const w1 = doc.getTextWidth('PrepareKora');
      doc.setTextColor(136, 136, 136);
      doc.text('.in', ML + w1, y);

      doc.setFont('courier', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
      doc.text(testData.mtId || '', PW - MR, y, { align: 'right' });

      y += 12;
      doc.setDrawColor(LINE[0], LINE[1], LINE[2]);
      doc.setLineWidth(0.7);
      doc.line(ML, y, PW - MR, y);
      y += 18;
    }

    function drawFooter(pageNum, totalPages){
      doc.setDrawColor(LINE[0], LINE[1], LINE[2]);
      doc.setLineWidth(0.5);
      doc.line(ML, PH - MB + 14, PW - MR, PH - MB + 14);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
      doc.text('PrepareKora.in  ·  Learn · Practice · Succeed', ML, PH - MB + 28);
      doc.text('Page ' + pageNum + ' / ' + totalPages, PW - MR, PH - MB + 28, { align: 'right' });
    }

    function newPage(){
      doc.addPage();
      drawHeader();
    }

    function ensureSpace(need){
      if(y + need > PH - MB - 10) newPage();
    }

    function drawTitleBlock(){
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(18);
      doc.setTextColor(INK[0], INK[1], INK[2]);
      const tLines = doc.splitTextToSize(testData.title || '', CW);
      doc.text(tLines, ML, y);
      y += tLines.length * 22 + 4;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
      const info = 'Subject: ' + testData.subject +
                   '    ·    Total Questions: ' + testData.totalQuestions;
      doc.text(info, ML, y);
      y += 14;

      const boxY = y;
      const boxH = 42;
      doc.setFillColor(SOFT[0], SOFT[1], SOFT[2]);
      doc.roundedRect(ML, boxY, CW, boxH, 6, 6, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
      doc.text('Instructions', ML + 12, boxY + 15);
      doc.setFont('helvetica', 'normal');
      doc.text('Read each question carefully. Each question has four options (A, B, C, D). Choose the correct one.', ML + 12, boxY + 28);
      y = boxY + boxH + 16;
    }

    function drawQuestion(q, index){
      const num = index + 1;
      const lineH = 13;
      const OPT_LINE_H = 11;
      const OPT_SUB_H = 10;

      // Question EN lines
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10.5);
      const qLines = doc.splitTextToSize(q.qEn || '', CW - 24);

      // Question AS lines (using intended font for correct measurement)
      let qAsLines = [];
      if(q.qAs){
        if(bengaliReady) doc.setFont('NotoSansBengali', 'normal');
        else doc.setFont('helvetica', 'italic');
        doc.setFontSize(10);
        qAsLines = doc.splitTextToSize('(' + q.qAs + ')', CW - 24);
      }

      // Options — measure each cell
      const optGap = 14;
      const optColW = (CW - 24 - optGap) / 2;
      const optData = q.options.map(function(o, i){
        const letter = 'ABCD'[i];
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        const combined = letter + ') ' + (o.en || '');
        const lines = doc.splitTextToSize(combined, optColW - 8);
        let subLines = [];
        if(o.as){
          if(bengaliReady) doc.setFont('NotoSansBengali', 'normal');
          else doc.setFont('helvetica', 'italic');
          doc.setFontSize(9.5);
          subLines = doc.splitTextToSize(o.as, optColW - 8);
        }
        const h = lines.length * OPT_LINE_H + subLines.length * OPT_SUB_H + 8;
        return { lines: lines, subLines: subLines, h: h, col: i % 2, row: Math.floor(i / 2) };
      });

      const row1H = Math.max(optData[0].h, optData[1].h);
      const row2H = Math.max(optData[2].h, optData[3].h);
      const optBlockH = row1H + row2H + 4;

      const headH = qLines.length * lineH + qAsLines.length * lineH + 4;
      const totalH = headH + optBlockH + 10;

      ensureSpace(totalH);

      // Number
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10.5);
      doc.setTextColor(INK[0], INK[1], INK[2]);
      doc.text(num + '.', ML, y + 10);

      // Question EN
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10.5);
      doc.setTextColor(INK[0], INK[1], INK[2]);
      doc.text(qLines, ML + 22, y + 10);
      let curY = y + 10 + qLines.length * lineH;

      // Question AS
      if(qAsLines.length){
        if(bengaliReady) doc.setFont('NotoSansBengali', 'normal');
        else doc.setFont('helvetica', 'italic');
        doc.setFontSize(10);
        doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
        doc.text(qAsLines, ML + 22, curY + 1);
        curY += qAsLines.length * lineH + 1;
      }

      // Options
      const optStartY = curY + 4;
      optData.forEach(function(o){
        const colX = ML + 22 + o.col * (optColW + optGap);
        const optY = optStartY + o.row * (row1H + 3);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
        doc.text(o.lines, colX, optY + 10);

        if(o.subLines.length){
          if(bengaliReady) doc.setFont('NotoSansBengali', 'normal');
          else doc.setFont('helvetica', 'italic');
          doc.setFontSize(9.5);
          const subY = optY + 10 + o.lines.length * OPT_LINE_H;
          doc.text(o.subLines, colX, subY);
        }
      });

      y = optStartY + row1H + row2H + 10;
    }

    function drawAnswerKey(){
      const anyAnswer = testData.questions.some(function(q){ return !!q.answer; });
      if(!anyAnswer) return;

      newPage();
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(16);
      doc.setTextColor(INK[0], INK[1], INK[2]);
      doc.text('Answer Key', ML, y);
      y += 10;
      doc.setDrawColor(GREEN[0], GREEN[1], GREEN[2]);
      doc.setLineWidth(1.5);
      doc.line(ML, y, ML + 62, y);
      y += 22;

      const cols = 5;
      const cellW = CW / cols;
      const cellH = 26;
      let rowStartY = y;

      testData.questions.forEach(function(q, i){
        const col = i % cols;
        if(col === 0){
          if(i > 0) rowStartY += cellH;
          if(rowStartY + cellH > PH - MB - 10){
            newPage();
            rowStartY = y;
          }
        }
        const cx = ML + col * cellW;
        const cy = rowStartY;

        doc.setDrawColor(LINE[0], LINE[1], LINE[2]);
        doc.setLineWidth(0.5);
        doc.rect(cx, cy, cellW, cellH);

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.setTextColor(INK[0], INK[1], INK[2]);
        doc.text((i + 1) + '.', cx + 8, cy + cellH / 2 + 3);

        doc.setFontSize(11);
        doc.setTextColor(GREEN[0], GREEN[1], GREEN[2]);
        doc.text(q.answer || '—', cx + cellW - 8, cy + cellH / 2 + 3, { align: 'right' });
      });
    }

    drawHeader();
    drawTitleBlock();
    testData.questions.forEach(function(q, i){
      if(q && q.qEn) drawQuestion(q, i);
    });
    drawAnswerKey();

    const total = doc.getNumberOfPages();
    for(let p = 1; p <= total; p++){
      doc.setPage(p);
      drawFooter(p, total);
    }

    return doc.output('blob');
  }

  /* ==========================================================
     FILE HELPERS
     ========================================================== */

  function slugify(s){
    return String(s == null ? '' : s)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40) || 'paper';
  }

  function filenameFor(testData){
    const id = String(testData.mtId || 'MT').replace(/[^a-z0-9]+/gi, '-');
    return 'PrepareKora_' + id + '_' + slugify(testData.title) + '.pdf';
  }

  function downloadBlob(blob, filename){
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function(){ URL.revokeObjectURL(a.href); }, 2000);
  }

  /* ==========================================================
     UI WIRING
     ========================================================== */

  function wire(){
    const subjectSel    = document.getElementById('paper-subject');
    const customWrap    = document.getElementById('paper-custom-wrap');
    const customInput   = document.getElementById('paper-custom-subject');
    const titleInput    = document.getElementById('paper-title');
    const inputEl       = document.getElementById('paper-input');
    const createBtn     = document.getElementById('paper-create');
    const msgEl         = document.getElementById('paper-msg');
    const summaryEl     = document.getElementById('paper-summary');
    const openPdfBtn    = document.getElementById('paper-open-pdf');
    const thumbBtn      = document.getElementById('paper-thumb-btn');

    const sumMtId    = document.getElementById('sum-mtid');
    const sumSubject = document.getElementById('sum-subject');
    const sumTitle   = document.getElementById('sum-title');
    const sumCount   = document.getElementById('sum-count');

    if(!createBtn) return; // safety

    let lastPdfBlob = null;

    // Custom subject reveal
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

    // Restore summary from a saved session
    const saved = PKState.get();
    if(saved && saved.questions && saved.questions.length){
      renderSummary(saved);
    }

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
        const q = parsed.questions[i];
        const filled = q.options.filter(function(o){ return o && o.en; }).length;
        if(filled < 2){
          setMsg('Question ' + (i + 1) + ' needs at least 2 options.');
          return;
        }
      }

      createBtn.disabled = true;
      const label = createBtn.textContent;
      createBtn.textContent = 'Creating…';

      try{
        // Peek ID (do not consume yet — PDF may fail)
        const peekedId = PKState.peekMTId(subject);

        const draft = PKState.buildTestData({
          mtId: peekedId,
          subject: subject,
          title: titleInput.value.trim() || parsed.title || '',
          questions: parsed.questions
        });

        const blob = await generatePDF(draft);

        // Success — now officially consume the ID
        const consumedId = PKState.consumeMTId(subject);
        draft.mtId = consumedId;

        PKState.save(draft);
        lastPdfBlob = blob;

        renderSummary(draft);
        downloadBlob(blob, filenameFor(draft));

        setMsg('PDF created · ' + draft.mtId + ' · ' + draft.totalQuestions + ' questions', true);
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

    // Open PDF — regenerate from saved state if we don't have a blob (e.g. after reload)
    openPdfBtn.addEventListener('click', async function(){
      setMsg('');
      const data = PKState.get();
      if(!data || !data.questions || !data.questions.length){
        setMsg('No test data available. Click Create first.');
        return;
      }

      openPdfBtn.disabled = true;
      try{
        const blob = lastPdfBlob || await generatePDF(data);
        lastPdfBlob = blob;
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank');
        setTimeout(function(){ URL.revokeObjectURL(url); }, 60000);
      }catch(err){
        console.error(err);
        setMsg('Could not open PDF: ' + (err && err.message ? err.message : err));
      }finally{
        openPdfBtn.disabled = false;
      }
    });

    // Create Thumbnail — switch tab; thumbnail.js listens for pk:papercreated / pk:testdatachanged
    thumbBtn.addEventListener('click', function(){
      if(global.PKApp && typeof global.PKApp.switchTool === 'function'){
        global.PKApp.switchTool('thumb');
      } else {
        // Fallback: click the tab button directly
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

  /* ==========================================================
     EXPORT
     ========================================================== */

  global.PKMCQ = {
    splitBi: splitBi,
    parseMCQs: parseMCQs,
    generatePDF: generatePDF
  };

})(window);
