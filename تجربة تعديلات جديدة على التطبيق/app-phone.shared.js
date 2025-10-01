/* =========================================================================
 * app-phone.shared.js — shared helpers for Phone UI (UI-only) — (Optimized)
 * =========================================================================
 * Changes (UI/UX only, no data-model changes):
 * - Added lightweight front-end memo cache (window.PhoneCache) for:
 *     • fetchAssessments()  (single list, Promise-cached)
 *     • fetchPhoneLogs(id)  (per-id Promise-cached)
 * - fetchPhoneById(id) now prefers cached assessments if available.
 * - Exposed helpers to prime/consume cache from other modules.
 * ========================================================================= */
(function () {
  'use strict';

  function $(sel, root) { return (root || document).querySelector(sel); }
  function el(tag, attrs, ...children) {
    const node = document.createElement(tag);
    if (attrs && typeof attrs === 'object') {
      Object.entries(attrs).forEach(([k, v]) => {
        if (k === 'class' || k === 'className') node.className = v || '';
        else if (k === 'dataset' && v && typeof v === 'object') {
          Object.entries(v).forEach(([dk, dv]) => (node.dataset[dk] = dv));
        } else if (k in node) node[k] = v;
        else node.setAttribute(k, v);
      });
    }
    for (const c of children) {
      if (c == null) continue;
      if (Array.isArray(c)) c.forEach(ci => node.appendChild(textOrNode(ci)));
      else node.appendChild(textOrNode(c));
    }
    return node;
  }
  function textOrNode(x) { return (typeof x === 'string' || typeof x === 'number') ? document.createTextNode(String(x)) : (x || document.createTextNode('')); }
  function toText(v){ if (v===null||v===undefined) return ''; try{ return String(v).trim(); }catch{ return ''+v; } }
  function pad(n){ return String(n).padStart(2,'0'); }

  // ---- robust, locale-safe normalization to DD/MM/YYYY for Phone UI ----
  function fmtDDMMYYYY(v){
    if(!v) return '—';

    // Strings first
    if (typeof v === 'string') {
      const s = v.trim();

      // Already DMY
      if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) return s;

      // ISO with time & tz
      if (/^\d{4}-\d{2}-\d{2}T/.test(s)) {
        try {
          const d = new Date(s);
          if (!isNaN(d)) return `${pad(d.getDate())}/${pad(d.getMonth()+1)}/${d.getFullYear()}`;
        } catch {}
        const m0 = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
        if (m0) return `${pad(+m0[3])}/${pad(+m0[2])}/${m0[1]}`;
        return s;
      }

      // YYYY-MM-DD
      const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
      if (m) return `${pad(+m[3])}/${pad(+m[2])}/${m[1]}`;

      // a/b/YYYY — ambiguous
      const m2 = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
      if (m2) {
        const a = +m2[1], b = +m2[2], y = m2[3];
        if (b > 12 && a >= 1 && a <= 12) return `${pad(b)}/${pad(a)}/${y}`;
        return `${pad(a)}/${pad(b)}/${y}`;
      }

      // last resort
      try {
        const d = new Date(s);
        if (!isNaN(d)) return `${pad(d.getDate())}/${pad(d.getMonth()+1)}/${d.getFullYear()}`;
      } catch {}
      return s || '—';
    }

    // Date/number fallbacks — LOCAL date (not UTC)
    try{
      if (v instanceof Date){
        if (isNaN(v.getTime())) return '—';
        return `${pad(v.getDate())}/${pad(v.getMonth()+1)}/${v.getFullYear()}`;
      }
      if (typeof v === 'number'){
        const d = new Date(v);
        if (isNaN(d.getTime())) return '—';
        return `${pad(d.getDate())}/${pad(d.getMonth()+1)}/${d.getFullYear()}`;
      }
      return String(v);
    }catch{ return String(v); }
  }

  function dmyToSortable(s){
    const dmy = fmtDDMMYYYY(s);
    if (typeof dmy === 'string' && /^\d{2}\/\d{2}\/\d{4}$/.test(dmy)) {
      return dmy.slice(6,10) + dmy.slice(3,5) + dmy.slice(0,2);
    }
    return '99999999';
  }

  function ynOptions(){ return ['—','Yes','No']; }
  function gradeOptions(){ return ['—','G0','G1','G2','G3','G4']; }
  function selWith(id, opts, val){
    const s=el('select',{id}); for(const o of opts){ s.appendChild(el('option',{value:o==='—'?'':o},o)); }
    if(val!=null) s.value=val; return s;
  }
  function uuid() { return 'log_' + Math.random().toString(36).slice(2) + Date.now().toString(36); }

  // ===== Light-weight front-end cache =====
  const PhoneCache = window.PhoneCache = window.PhoneCache || {
    assessAllPromise: null,               // Promise<Array>
    phoneLogsById: new Map(),            // id -> Promise<Array>
    clear(){
      this.assessAllPromise = null;
      this.phoneLogsById.clear();
    }
  };

  async function fetchAssessmentsCached(){
    if (PhoneCache.assessAllPromise) return PhoneCache.assessAllPromise;
    if (!window.SheetsAPI || typeof SheetsAPI.fetchAssessments!=='function'){
      PhoneCache.assessAllPromise = Promise.resolve([]);
      return PhoneCache.assessAllPromise;
    }
    PhoneCache.assessAllPromise = SheetsAPI.fetchAssessments().then(rows => Array.isArray(rows) ? rows : []);
    return PhoneCache.assessAllPromise;
  }

  async function fetchPhoneLogsCached(patientId){
    const id = String(patientId||'');
    if (!id) return [];
    if (PhoneCache.phoneLogsById.has(id)) return PhoneCache.phoneLogsById.get(id);
    if (!window.SheetsAPI || typeof SheetsAPI.fetchPhoneLogs!=='function'){
      const p = Promise.resolve([]); PhoneCache.phoneLogsById.set(id,p); return p;
    }
    const p = SheetsAPI.fetchPhoneLogs(id).then(rows => Array.isArray(rows) ? rows : []);
    PhoneCache.phoneLogsById.set(id, p);
    return p;
  }

  async function fetchPhoneById(id){
    try{
      // Prefer cached Assessments
      const all = await fetchAssessmentsCached();
      const row = (all||[]).find(r => String(r.id||'') === String(id));
      if (row && row.phone) return row.phone;
      // fallback to API just in case
      if (window.SheetsAPI && window.SheetsAPI.fetchAssessments){
        const fresh = await SheetsAPI.fetchAssessments();
        const r = (fresh||[]).find(rr => String(rr.id||'') === String(id));
        return (r && r.phone) || '';
      }
    }catch{}
    return '';
  }

  // expose
  window.PhoneShared = Object.assign(window.PhoneShared || {}, {
    $, el, fmtDDMMYYYY, dmyToSortable, ynOptions, gradeOptions, selWith, uuid, toText,
    // cache helpers
    fetchAssessmentsCached,
    fetchPhoneLogsCached,
    fetchPhoneById,
  });
})();