(function initThumb(global){
  'use strict';

  const thumbBanner       = document.getElementById('banner');
  const thumbPortraitBtn  = document.getElementById('portraitBtn');
  const thumbLandscapeBtn = document.getElementById('landscapeBtn');
  const thumbScope        = document.getElementById('tool-thumb');

  if(!thumbBanner || !thumbScope) return;

  const DEFAULT_DATA = {
    mtId:      'MT-GK-003',
    subject:   'GENERAL KNOWLEDGE',
    title:     'Important\nMCQs',
    examType:  'MOCK EXAMINATION',
    examName:  'ADRE\nGeneral\nKnowledge',
    question:  'Who is the Education Minister of Assam?',
    optA:      'Ranoj Pegu',
    optB:      'Himanta Biswa Sarma',
    optC:      'Gaurav Gogoi',
    optD:      'Nitin Gadkari',
    questions: '120',
    time:      '30 Min',
    marks:     '50',
    url:       'https://chat.whatsapp.com/DLrcA98MrlYKOeZ5DMeN5Z?s=cl&p=a&iam=2'
  };

  const INPUT_MAP = {
    'in-question': 'question',
    'in-optA':     'optA',
    'in-optB':     'optB',
    'in-optC':     'optC',
    'in-optD':     'optD',
    'in-time':     'time',
    'in-marks':    'marks'
  };

  let thumbState = Object.assign({}, DEFAULT_DATA);
  let lastQRUrl  = '';

  function loadSaved(){
    try{
      const s = JSON.parse(localStorage.getItem('pk_banner_state') || 'null');
      if(s && typeof s === 'object'){
        thumbState = Object.assign({}, DEFAULT_DATA, s);
      }
    }catch(e){}
  }

  function saveThumbState(){
    try{ localStorage.setItem('pk_banner_state', JSON.stringify(thumbState)); }catch(e){}
  }

  function escapeHtml(s){
    return String(s == null ? '' : s).replace(/[&<>"']/g, function(c){
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function nl2br(s){
    return escapeHtml(s == null ? '' : s).split('\n').join('<br>');
  }

  function setText(bind, text){
    const el = thumbScope.querySelector('[data-bind="' + bind + '"]');
    if(el) el.textContent = text == null ? '' : text;
  }

  function setHtml(bind, html){
    const el = thumbScope.querySelector('[data-bind="' + bind + '"]');
    if(el) el.innerHTML = html == null ? '' : html;
  }

  function renderThumb(){
    setText('mtId',      'MT ID: ' + (thumbState.mtId || ''));
    setText('subject',   thumbState.subject);
    setHtml('title',     nl2br(thumbState.title));
    setText('examType',  thumbState.examType);
    setHtml('examName',  nl2br(thumbState.examName));
    setText('question',  thumbState.question);
    setText('optA',      thumbState.optA);
    setText('optB',      thumbState.optB);
    setText('optC',      thumbState.optC);
    setText('optD',      thumbState.optD);
    setText('questions', thumbState.questions);
    setText('time',      thumbState.time);
    setText('marks',     thumbState.marks);
    updateThumbQR();
  }

  function updateThumbQR(){
    const url = String(thumbState.url || '').trim();
    const img = thumbBanner.querySelector('.qr-image');
    if(!img) return;
    if(!url){ img.removeAttribute('src'); lastQRUrl = ''; return; }
    const qrSrc = 'https://quickchart.io/qr?text=' + encodeURIComponent(url) +
                  '&size=500&margin=2&ecLevel=H&dark=111111&light=ffffff';
    if(qrSrc === lastQRUrl) return;
    lastQRUrl = qrSrc;
    img.crossOrigin = 'anonymous';
    img.src = qrSrc;
  }

  function populateThumbInputs(){
    Object.keys(INPUT_MAP).forEach(function(id){
      const el = document.getElementById(id);
      if(el) el.value = thumbState[INPUT_MAP[id]] == null ? '' : thumbState[INPUT_MAP[id]];
    });
  }

  function bindThumbInputs(){
    Object.keys(INPUT_MAP).forEach(function(id){
      const el = document.getElementById(id);
      if(!el) return;
      el.addEventListener('input', function(){
        thumbState[INPUT_MAP[id]] = el.value;
        saveThumbState();
        renderThumb();
      });
    });
  }

  function setFormat(format){
    thumbBanner.classList.remove('portrait', 'landscape');
    thumbBanner.classList.add(format);

    thumbPortraitBtn.classList.toggle('active',    format === 'portrait');
    thumbPortraitBtn.classList.toggle('secondary', format !== 'portrait');
    thumbLandscapeBtn.classList.toggle('active',    format === 'landscape');
    thumbLandscapeBtn.classList.toggle('secondary', format !== 'landscape');
  }

  function waitForQR(){
    const img = thumbBanner.querySelector('.qr-image');
    if(img.complete && img.naturalWidth > 0) return Promise.resolve();
    return new Promise(function(resolve, reject){
      const t = setTimeout(function(){ reject(new Error('QR timeout')); }, 12000);
      img.onload  = function(){ clearTimeout(t); resolve(); };
      img.onerror = function(){ clearTimeout(t); reject(new Error('QR failed to load')); };
    });
  }

  async function downloadBanner(){
    const isPortrait  = thumbBanner.classList.contains('portrait');
    const cssWidth    = isPortrait ? 360 : 960;
    const cssHeight   = isPortrait ? 640 : 540;
    const outputWidth = isPortrait ? 1080 : 1920;
    const outputHeight= isPortrait ? 1920 : 1080;
    let clone = null;

    try{
      if(typeof global.html2canvas !== 'function'){
        throw new Error('PNG library not loaded. Refresh page.');
      }
      await waitForQR();

      clone = thumbBanner.cloneNode(true);
      clone.removeAttribute('id');
      clone.style.width        = cssWidth + 'px';
      clone.style.height       = cssHeight + 'px';
      clone.style.maxWidth     = 'none';
      clone.style.minWidth     = '0';
      clone.style.aspectRatio  = 'auto';
      clone.style.position     = 'fixed';
      clone.style.left         = '-10000px';
      clone.style.top          = '0';
      clone.style.margin       = '0';
      clone.style.transform    = 'none';

      thumbScope.appendChild(clone);

      const qrImg = clone.querySelector('.qr-image');
      if(qrImg && !(qrImg.complete && qrImg.naturalWidth > 0)){
        await new Promise(function(res, rej){
          qrImg.onload  = res;
          qrImg.onerror = function(){ rej(new Error('QR failed in clone')); };
        });
      }

      const canvas = await global.html2canvas(clone, {
        backgroundColor: '#f7f7f5',
        scale:           outputWidth / cssWidth,
        width:           cssWidth,
        height:          cssHeight,
        windowWidth:     cssWidth,
        windowHeight:    cssHeight,
        useCORS:         true,
        allowTaint:      false,
        logging:         false
      });

      const finalCanvas = document.createElement('canvas');
      finalCanvas.width  = outputWidth;
      finalCanvas.height = outputHeight;
      finalCanvas.getContext('2d').drawImage(canvas, 0, 0, outputWidth, outputHeight);

      const blob = await new Promise(function(r){ finalCanvas.toBlob(r, 'image/png'); });
      if(!blob) throw new Error('PNG creation failed');

      const fmt    = isPortrait ? '9x16' : '16x9';
      const safeId = String(thumbState.mtId || 'banner').replace(/[^a-zA-Z0-9-]/g, '-');
      const link   = document.createElement('a');
      link.href     = URL.createObjectURL(blob);
      link.download = 'PrepareKora_' + safeId + '_' + fmt + '.png';
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(function(){ URL.revokeObjectURL(link.href); }, 2000);
    }catch(error){
      alert((error && error.message) || 'Unable to export banner.');
      console.error(error);
    }finally{
      if(clone && clone.parentNode) clone.parentNode.removeChild(clone);
    }
  }

  function resetDefaults(){
    if(!confirm('Reset all thumbnail fields to default example?')) return;
    thumbState = Object.assign({}, DEFAULT_DATA);
    saveThumbState();
    populateThumbInputs();
    renderThumb();
  }

  function syncFromTestData(data){
    if(!data) return;
    if(!Array.isArray(data.questions) || data.questions.length === 0) return;

    const q1   = data.questions[0] || {};
    const opts = Array.isArray(q1.options) ? q1.options : [];

    thumbState.mtId      = data.mtId || thumbState.mtId;
    thumbState.subject   = (data.subject || '').toUpperCase() || thumbState.subject;
    thumbState.title     = data.title || thumbState.title;
    thumbState.examType  = data.examType || thumbState.examType;
    thumbState.examName  = data.examName || thumbState.examName;
    thumbState.questions = String(data.totalQuestions || data.questions.length || '');
    thumbState.question  = q1.qEn || '';
    thumbState.optA      = (opts[0] && opts[0].en) || '';
    thumbState.optB      = (opts[1] && opts[1].en) || '';
    thumbState.optC      = (opts[2] && opts[2].en) || '';
    thumbState.optD      = (opts[3] && opts[3].en) || '';
    if(data.qrUrl) thumbState.url = data.qrUrl;

    saveThumbState();
    populateThumbInputs();
    renderThumb();
  }

  global.setFormat      = setFormat;
  global.downloadBanner = downloadBanner;
  global.resetDefaults  = resetDefaults;

  global.ThumbTool = {
    refresh: function(){
      renderThumb();
      void thumbBanner.offsetWidth;
    }
  };

  loadSaved();
  populateThumbInputs();
  bindThumbInputs();
  renderThumb();
  setFormat('portrait');

  global.addEventListener('pk:testdatachanged', function(e){
    if(e && e.detail) syncFromTestData(e.detail);
  });

})(window);
