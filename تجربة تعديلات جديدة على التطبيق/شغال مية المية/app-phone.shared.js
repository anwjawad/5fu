/* =========================================================================
 * app-phone.shared.js — shared helpers for Phone UI (UI-only)
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

  // ---- NEW: robust, locale-safe normalization to DD/MM/YYYY for Phone UI ----
  function fmtDDMMYYYY(v){
    if(!v) return '—';

    // Strings first
    if (typeof v === 'string') {
      const s = v.trim();

      // Already DMY
      if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) return s;

      // ISO with time & tz (…T…Z or …±hh:mm): use LOCAL date to avoid -1 day
      if (/^\d{4}-\d{2}-\d{2}T/.test(s)) {
        try {
          const d = new Date(s);
          if (!isNaN(d)) return `${pad(d.getDate())}/${pad(d.getMonth()+1)}/${d.getFullYear()}`;
        } catch {}
        // fallback: take first 10 chars if parse failed
        const m0 = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
        if (m0) return `${pad(+m0[3])}/${pad(+m0[2])}/${m0[1]}`;
        return s;
      }

      // YYYY-MM-DD
      const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
      if (m) return `${pad(+m[3])}/${pad(+m[2])}/${m[1]}`;

      // a/b/YYYY — ambiguous. If second part > 12, treat as MM/DD/YYYY -> swap.
      const m2 = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
      if (m2) {
        const a = +m2[1], b = +m2[2], y = m2[3];
        if (b > 12 && a >= 1 && a <= 12) return `${pad(b)}/${pad(a)}/${y}`; // MM/DD -> DD/MM
        return `${pad(a)}/${pad(b)}/${y}`; // assume D/M
      }

      // last resort
      try {
        const d = new Date(s);
        if (!isNaN(d)) return `${pad(d.getDate())}/${pad(d.getMonth()+1)}/${d.getFullYear()}`;
      } catch {}
      return s || '—';
    }

    // Date/number fallbacks — LOCAL date (not UTC) for UI expectations
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
    // accept raw ISO or other inputs, normalize via fmtDDMMYYYY first
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

  async function fetchPhoneById(id){
    try{
      if (window.SheetsAPI && window.SheetsAPI.fetchAssessments){
        const all = await window.SheetsAPI.fetchAssessments();
        const rows = (all||[]).filter(r => String(r.id||'')===String(id));
        rows.sort((a,b)=> String(b.assessment_date||'').localeCompare(String(a.assessment_date||'')));
        if (rows[0] && rows[0].phone) return String(rows[0].phone);
      }
    }catch(e){}
    return '';
  }

  async function copyToClipboard(text){
    try{
      await navigator.clipboard.writeText(text||'');
      return true;
    }catch(e){
      try{
        const ta = document.createElement('textarea');
        ta.value = text||'';
        ta.style.position='fixed'; ta.style.opacity='0';
        document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove();
        return true;
      }catch(_){ return false; }
    }
  }

  window.PhoneShared = {
    $, el, textOrNode, toText, pad, fmtDDMMYYYY, dmyToSortable,
    ynOptions, gradeOptions, selWith, uuid, fetchPhoneById, copyToClipboard
  };
})();
