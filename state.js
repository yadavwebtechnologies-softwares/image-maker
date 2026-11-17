(function initState(global){
  'use strict';

  const VERSION = 2;
  const KEYS = {
    serialPrefix: 'pk.mtSerial.',
    testData:     'pk.testData'
  };

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

  function lsGet(k){ try { return localStorage.getItem(k); } catch(e){ return null; } }
  function lsSet(k, v){ try { localStorage.setItem(k, v); return true; } catch(e){ return false; } }
  function lsDel(k){ try { localStorage.removeItem(k); } catch(e){} }

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

  function getSerial(subject){
    const code = subjectCode(subject || '');
    const v = parseInt(lsGet(KEYS.serialPrefix + code), 10);
    return (Number.isFinite(v) && v >= 0) ? v : 0;
  }
  function setSerial(subject, n){
    const code = subjectCode(subject || '');
    lsSet(KEYS.serialPrefix + code, String(n));
  }

  function pad3(n){ return String(n).padStart(3, '0'); }
  function buildId(subject, serialNum){
    return 'MT/' + subjectCode(subject) + '/' + pad3(serialNum);
  }

  function peekMTId(subject){
    return buildId(subject, getSerial(subject) + 1);
  }

  function consumeMTId(subject){
    const next = getSerial(subject) + 1;
    setSerial(subject, next);
    return buildId(subject, next);
  }

  function load(){
    const raw = lsGet(KEYS.testData);
    if(!raw){ testData = null; return null; }
    try{
      const parsed = JSON.parse(raw);
      if(parsed && parsed.__v === VERSION && Array.isArray(parsed.questions)){
        testData = parsed;
        return testData;
      }
    }catch(e){}
    testData = null;
    return null;
  }

  function save(data){
    if(!data || !Array.isArray(data.questions)) return false;
    const toSave = Object.assign({}, data, { __v: VERSION, updatedAt: Date.now() });
    testData = toSave;
    lsSet(KEYS.testData, JSON.stringify(toSave));
    emit();
    return true;
  }

  function reset(){
    testData = null;
    lsDel(KEYS.testData);
    emit();
  }

  function get(){ return testData; }
  function has(){ return !!(testData && Array.isArray(testData.questions) && testData.questions.length); }

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

  load();

})(window);
