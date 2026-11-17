/* ================================================================
   app.js — PrepareKora Studio shell
   Responsibilities:
     • tab switching between Paper Builder and Thumbnail Maker
     • refresh thumbnail layout after it becomes visible (cqw fix)
     • sync active tab with URL hash (#paper / #thumb)
   ================================================================ */
(function initApp(global){
  'use strict';

  const TABS = ['paper', 'thumb'];
  const DEFAULT_TAB = 'paper';

  const tabButtons = Array.prototype.slice.call(
    document.querySelectorAll('.tool-tabs button[data-tool]')
  );
  const sections = {
    paper: document.getElementById('tool-paper'),
    thumb: document.getElementById('tool-thumb')
  };

  if(!tabButtons.length || !sections.paper || !sections.thumb) return;

  let currentTab = null;

  function normalizeTab(name){
    return TABS.indexOf(name) >= 0 ? name : DEFAULT_TAB;
  }

  function readHash(){
    const raw = String(global.location.hash || '').replace(/^#\/?/, '');
    return normalizeTab(raw || DEFAULT_TAB);
  }

  function setTab(name, options){
    options = options || {};
    const tab = normalizeTab(name);
    if(tab === currentTab && !options.force) return;

    /* toggle sections */
    TABS.forEach(function(key){
      const on = key === tab;
      const sec = sections[key];
      if(sec) sec.classList.toggle('active', on);
    });

    /* toggle tab buttons */
    tabButtons.forEach(function(btn){
      btn.classList.toggle('active', btn.dataset.tool === tab);
    });

    currentTab = tab;

    /* push to hash (unless caller opts out) */
    if(!options.silentHash){
      const newHash = '#' + tab;
      if(global.location.hash !== newHash){
        try{ history.replaceState(null, '', newHash); }
        catch(e){ global.location.hash = newHash; }
      }
    }

    /* Deferred layout hook: container-query (cqw) units only
       resolve correctly once an element is rendered. Force a
       reflow on the thumbnail banner right after it becomes
       visible so preview and export sizes match. */
    if(tab === 'thumb'){
      const refresh = function(){
        if(global.ThumbTool && typeof global.ThumbTool.refresh === 'function'){
          global.ThumbTool.refresh();
        }
      };
      /* rAF + timeout — belt and braces for browsers that delay layout */
      if(typeof global.requestAnimationFrame === 'function'){
        global.requestAnimationFrame(function(){ setTimeout(refresh, 0); });
      } else {
        setTimeout(refresh, 0);
      }
    }
  }

  /* ---------- public API (used by mcq.js "Create Thumbnail" button) ---------- */
  global.PKApp = {
    switchTool: function(name){ setTab(name); },
    currentTab: function(){ return currentTab; }
  };

  /* ---------- wire tab clicks ---------- */
  tabButtons.forEach(function(btn){
    btn.addEventListener('click', function(){
      setTab(btn.dataset.tool);
    });
  });

  /* ---------- hash routing ---------- */
  global.addEventListener('hashchange', function(){
    setTab(readHash(), { silentHash: true });
  });

  /* ---------- cross-tab intent: open thumb on paper:thumbrequested ---------- */
  global.addEventListener('pk:thumbrequested', function(){
    setTab('thumb');
  });

  /* ---------- init ---------- */
  setTab(readHash(), { force: true, silentHash: true });

})(window);
