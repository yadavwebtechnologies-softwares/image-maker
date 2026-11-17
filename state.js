/* ================================================================
   state.js — PrepareKora Studio shared state
   Single source of truth for:
     • the current test-data object (PDF + Thumbnail both read this)
     • the one and only MT ID generator
     • localStorage persistence
     • change notification
   ================================================================ */
(function initState(global){
  'use strict';

  const VERSION = 1;
  const KEYS = {
    serial:   'pk.mtSerial',
    testData: 'pk.testData'
  };

  /* Subject → short code used inside MT ID.
     Custom/unknown subjects fall back to letters extracted from the name. */
  const SUBJECT_CODES = {
    'Mathematics':       'MATH',
    'Reasoning':         'REAS',
    'General Knowledge': 'GK',
    'History':           'HIST',
    'Geography':         'GEO',
    'Current Affairs':   'CA',
    'Computer':          'COMP',
    'Custom':            'CUST'
  };

  let testData = null;
  const listeners = [];

  /* ---------- safe localStorage wrappers ---------- */
  function lsGet(k){ try { return localStorage.getItem(k); } catch(e){ return null; } }
  function lsSet(k, v){ try { localStorage.setItem(k, v); return true; } catch(e){ return false; } }
  function lsDel(k){ try { localStorage.removeItem(k); } catch(e){} }

  /* ---------- serial (never auto-reset) ---------- */
  function getSerial(){
    const v = parseInt(lsGet(KEYS.serial), 10);
    return (Number.isFinite(v) && v >= 0) ? v : 0;
  }
  function setSerial(n){ lsSet(KEYS.serial, String(n)); }

  /* ---------- MT ID ---------- */
  function subjectCode(subject){
    if(!subject) return 'GEN';
    const key = String(subject).trim();
    if(SUBJECT_CODES[key]) return SUBJECT_CODES[key];
    for(const [k, v] of Object.entries(SUBJECT_CODES)){
      if(k.toLowerCase() === key.toLowerCase()) return v;
    }
    const letters = key.replace(/[^A-Za-z]/g, '').toUpperCase().slice(0, 4);
    return letters || 'CUST';
  }

  function pad4(n){ return String(n).padStart(4, '0'); }
  function buildId(subject, serialNum){
    return 'MT/' + subjectCode(subject) + '/' + pad4(serialNum);
  }

  /* Peek what the next MT ID would be WITHOUT consuming it.
     Use this to display the ID on the PDF. */
  function peekMTId(subject){
    return buildId(subject, getSerial() + 1);
  }

  /* Commit the next MT ID — increments the serial.
     Call this ONLY after the PDF blob has been successfully produced. */
  function consumeMTId(subject){
    const next = getSerial() + 1;
    setSerial(next);
    return buildId(subject, next);
  }

  /* ---------- test data lifecycle ---------- */
  function load(){
    const raw = lsGet(KEYS.testData);
    if(!raw){ testData = null; return null; }
    try{
      const parsed = JSON.parse(raw);
      if(parsed && parsed.__v === VERSION && Array.isArray(parsed.questions)){
        testData = parsed;
        return testData;
      }
    }catch(e){ /* corrupt — ignore */ }
    testData = null;
    return null;
  }

  function save(data){
    if(!data || !Array.isArray(data.questions)) return false;
    const toSave = Object.assign({}, data, {
      __v: VERSION,
      updatedAt: Date.now()
    });
    testData = toSave;
    lsSet(KEYS.testData, JSON.stringify(toSave));
    emit();
    return true;
  }

  /* Clear the current test data. Does NOT reset the MT serial. */
  function reset(){
    testData = null;
    lsDel(KEYS.testData);
    emit();
  }

  function get(){ return testData; }
  function has(){ return !!(testData && Array.isArray(testData.questions) && testData.questions.length); }

  /* ---------- change events ---------- */
  function onChange(fn){
    if(typeof fn !== 'function') return function(){};
    listeners.push(fn);
    return function(){ const i = listeners.indexOf(fn); if(i >= 0) listeners.splice(i, 1); };
  }
  function emit(){
    const detail = testData;
    listeners.slice().forEach(function(fn){
      try{ fn(detail); }catch(e){ console.error('[PKState listener]', e); }
    });
    try{ global.dispatchEvent(new CustomEvent('pk:testdatachanged', { detail: detail })); }catch(e){}
  }

  /* ---------- build a test-data object from parsed MCQs ----------
     Called by mcq.js. Keeps shape consistent across tools.
     questions[] shape:
       {
         qEn: 'string',
         qAs: 'string' | '',
         options: [
           { en: 'string', as: 'string' | '' },   // A
           { en: 'string', as: 'string' | '' },   // B
           { en: 'string', as: 'string' | '' },   // C
           { en: 'string', as: 'string' | '' }    // D
         ],
         answer: 'A' | 'B' | 'C' | 'D' | null
       }
  */
  function buildTestData(opts){
    opts = opts || {};
    const s = String(opts.subject || '').trim() || 'General Knowledge';
    const list = Array.isArray(opts.questions) ? opts.questions : [];
    return {
      mtId:            String(opts.mtId || '').trim(),
      subject:         s,
      subjectCode:     subjectCode(s),
      title:           String(opts.title || '').trim() || (s + ' — MCQ Practice Paper'),
      examType:        String(opts.examType || '').trim(),
      examName:        String(opts.examName || '').trim(),
      totalQuestions:  list.length,
      questions:       list,
      createdAt:       Date.now()
    };
  }

  /* ---------- public API ---------- */
  global.PKState = {
    VERSION,
    SUBJECT_CODES,
    subjectCode,
    peekMTId,
    consumeMTId,
    getSerial,
    buildTestData,
    load, save, reset, get, has, onChange
  };

  /* Restore any saved test data on script load. */
  load();

})(window);
