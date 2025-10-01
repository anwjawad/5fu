/* =========================================================================
 * app-utils.js
 * -------------------------------------------------------------------------
 * Utilities مشتركة للتطبيق.
 *
 * ملاحظات:
 * - يستفيد تلقائيًا من Ext (إن وُجد) بدل تكرار الدوال.
 * - لا يعتمد على DOM محدد سوى عند serialize/assign للنماذج.
 * - لا يحسب المنطق السريري؛ فقط أدوات عامة + مساعدات للدرجات/YesNo.
 * ========================================================================= */

(function () {
  'use strict';

  // ========= جسر اختياري مع Ext إن كان محمّلاً =========
  const hasExt = (typeof window !== 'undefined') && window.Ext;
  const toYMD    = hasExt ? window.Ext.toYMD    : (d)=>fmtDate(d, 'date');
  const toYMDhm  = hasExt ? window.Ext.toYMDhm  : (d)=>fmtDate(d, 'datetime');
  const asYesNo  = hasExt ? window.Ext.asYesNo  : (v)=> (v==='Yes'||v==='No') ? v : (typeof v==='boolean' ? (v?'Yes':'No') : (v? 'Yes' : 'No'));
  const normGrade= hasExt ? window.Ext.normalizeGrade : normalizeGradeLocal;

  // ========= تنسيقات تاريخ محلية بسيطة عند غياب Ext =========
  function fmtDate(v, mode) {
    if (!v) return '';
    try {
      const d = (v instanceof Date) ? v : new Date(v);
      if (isNaN(d.getTime())) return String(v);
      const pad = (n)=> String(n).padStart(2,'0');
      if (mode === 'datetime') {
        return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
      }
      return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
    } catch { return String(v); }
  }

  function normalizeGradeLocal(v) {
    if (v == null) return '';
    const s = String(v).trim().toUpperCase();
    // نسمح بالقيم G0..G5 أو 0..5 (للتوافق)، ونحوّل 0..5 إلى G0..G5
    if (/^[0-5]$/.test(s)) return 'G' + s;
    if (/^G[0-5]$/.test(s)) return s;
    return s;
  }

  // ========= Helpers أساسية =========

  function uid(prefix) {
    const p = prefix ? String(prefix) : 'id';
    return `${p}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,8)}`;
  }

  function deepClone(obj) {
    return obj == null ? obj : JSON.parse(JSON.stringify(obj));
  }

  function pick(obj, keys) {
    const out = {};
    if (!obj) return out;
    (keys || []).forEach(k => { out[k] = obj[k]; });
    return out;
  }

  function omit(obj, keys) {
    const out = {};
    if (!obj) return out;
    const hide = new Set(keys || []);
    Object.keys(obj).forEach(k => { if (!hide.has(k)) out[k] = obj[k]; });
    return out;
  }

  function groupBy(arr, keyFn) {
    const map = new Map();
    (arr || []).forEach(item => {
      const k = keyFn(item);
      if (!map.has(k)) map.set(k, []);
      map.get(k).push(item);
    });
    return map;
  }

  function sortBy(arr, keyFn, dir = 'asc') {
    const a = (arr || []).slice();
    const m = dir === 'desc' ? -1 : 1;
    a.sort((x,y) => {
      const kx = keyFn(x), ky = keyFn(y);
      if (kx < ky) return -1*m;
      if (kx > ky) return  1*m;
      return 0;
    });
    return a;
  }

  function uniqueBy(arr, keyFn) {
    const seen = new Set();
    const out = [];
    (arr || []).forEach(it => {
      const k = keyFn(it);
      if (!seen.has(k)) { seen.add(k); out.push(it); }
    });
    return out;
  }

  // ========= Grades / Toxicities =========

  function gradeToNumber(g) {
    if (!g && g !== 0) return NaN;
    const s = String(g).trim().toUpperCase();
    if (/^[0-5]$/.test(s)) return Number(s);
    const m = s.match(/^G([0-5])$/);
    return m ? Number(m[1]) : NaN;
  }

  /**
   * يحسب أعلى درجة (رقميًا) ويعيدها كـ G#.
   * @param {Array<string|number>} grades - مثل ['G2','G0','G3'] أو [2,0,3]
   * @returns {string} 'G0'..'G5' أو '' لو ما فيه أي درجة صالحة
   */
  function maxGrade(grades) {
    const nums = (grades||[])
      .map(gradeToNumber)
      .filter(n => !Number.isNaN(n));
    if (!nums.length) return '';
    const max = Math.max(...nums);
    return 'G' + String(max);
  }

  /**
   * يأخذ كائن تقييم ويحسب له الـ overall toxicity من الحقول المنفصلة إن رغبت.
   * لا يفرض التحديث؛ فقط دالة مساعدة.
   */
  function computeOverallFromSeparate(tox) {
    if (!tox || typeof tox !== 'object') return '';
    const g = maxGrade([
      tox.mucositis_grade,
      tox.diarrhea_grade,
      tox.neutropenia_grade,
      tox.other_tox_grade
    ]);
    return g || '';
  }

  /**
   * يطبع "Yes"/"No" ثابتة من مدخلات مختلفة.
   */
  function toYesNo(v) {
    return asYesNo(v);
  }

  // ========= Forms: serialize / assign =========

  /**
   * يحوّل عناصر form إلى كائن {name: value}
   * - يدعم input/select/textarea
   * - لو في عناصر بنفس الاسم، يجمعها كمصفوفة
   */
  function serializeForm(formEl) {
    if (!formEl) throw new Error('[utils] serializeForm: missing form element');
    const out = {};
    const elements = formEl.querySelectorAll('input, select, textarea');
    elements.forEach(el => {
      const name = el.name || el.id || '';
      if (!name) return;
      let val = (el.type === 'checkbox')
        ? (el.checked ? (el.value || true) : '')
        : (el.type === 'radio')
          ? (el.checked ? el.value : null)
          : el.value;

      if (val === null) return;

      if (out[name] === undefined) out[name] = val;
      else if (Array.isArray(out[name])) out[name].push(val);
      else out[name] = [out[name], val];
    });
    return out;
  }

  /**
   * يملأ form من كائن بيانات {name: value}
   */
  function assignForm(formEl, data) {
    if (!formEl) throw new Error('[utils] assignForm: missing form element');
    if (!data || typeof data !== 'object') return;
    const elements = formEl.querySelectorAll('input, select, textarea');
    elements.forEach(el => {
      const name = el.name || el.id || '';
      if (!name) return;
      const v = data[name];
      if (v === undefined) return;

      if (el.type === 'checkbox') {
        if (typeof v === 'boolean') el.checked = v;
        else el.checked = String(v) === (el.value || 'on');
      } else if (el.type === 'radio') {
        if (String(el.value) === String(v)) el.checked = true;
      } else {
        el.value = v;
      }
    });
  }

  // ========= تنزيل نصوص/ملفات بسيطة =========

  function downloadTextFile(filename, text, mime) {
    const name = filename || `file_${Date.now()}.txt`;
    const blob = new Blob([text || ''], { type: (mime || 'text/plain;charset=utf-8;') });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.setAttribute('href', url);
    a.setAttribute('download', name);
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // ========= Assertions / Diagnostics =========

  function assert(cond, msg) {
    if (!cond) throw new Error(msg || '[utils] assertion failed');
  }

  function warn(msg, ...args) {
    console.warn('[utils]', msg, ...args);
  }

  function info(msg, ...args) {
    console.log('[utils]', msg, ...args);
  }

  // ========= كشف الواجهة =========

  const Utils = {
    // IDs / objects
    uid, deepClone, pick, omit,

    // arrays
    groupBy, sortBy, uniqueBy,

    // grades
    normalizeGrade: normGrade,
    gradeToNumber,
    maxGrade,
    computeOverallFromSeparate,
    toYesNo,

    // dates
    toYMD, toYMDhm,

    // forms
    serializeForm,
    assignForm,

    // files
    downloadTextFile,

    // diagnostics
    assert, warn, info,
  };

  if (typeof window !== 'undefined') {
    window.Utils = Utils;
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = Utils;
  }
})();
