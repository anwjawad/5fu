/* =========================================================================
 * app-sheets.js
 * -------------------------------------------------------------------------
 * شبكة الاتصال مع Google Apps Script (GAS).
 * - http/https → fetch
 * - file://    → JSONP (تفادي CORS)
 *
 * يعتمد على:
 *   GAS actions:
 *     listAssessments, saveAssessment, deleteAssessmentCascade,
 *     listPhoneLogs, savePhoneLog, deletePhoneLog
 *
 * تعديل (UI/UX فقط):
 * - قبل الإرسال، تُحوَّل حقول التواريخ إلى صيغة DD/MM/YYYY:
 *   Assessment: assessment_date, followup_due, first_date_5fu
 *   Phone Log : call_time, next_due
 * ========================================================================= */

(function () {
  'use strict';

  /* ==============================
   * إعداد الرابط
   * ============================== */
  function getBaseUrl() {
    try {
      if (window.AppData && typeof window.AppData.getWebAppUrl === 'function') {
        const u = window.AppData.getWebAppUrl();
        if (u) return u;
      }
    } catch {}
    if (typeof window.WEBAPP_URL === 'string' && window.WEBAPP_URL) {
      return window.WEBAPP_URL;
    }
    return '';
  }

  const BASE_URL = getBaseUrl();
  const IS_FILE_PROTOCOL = (location.protocol === 'file:');

  /* ==============================
   * أدوات عامة
   * ============================== */

  function buildUrl(params) {
    const u = new URL(BASE_URL);
    Object.entries(params || {}).forEach(([k, v]) => {
      if (v === undefined || v === null) return;
      u.searchParams.set(k, typeof v === 'string' ? v : String(v));
    });
    return u.toString();
  }

  function encodeData(obj) {
    const json = JSON.stringify(obj || {});
    return btoa(unescape(encodeURIComponent(json)));
  }

  // ---- تحويل التواريخ إلى DD/MM/YYYY (محليًا، لواجهة Google Sheet) ----
  function pad2(n){ return String(n).padStart(2,'0'); }
  function toDMY(val){
    if (val == null || val === '') return '';
    if (typeof val === 'string' && /^\d{2}\/\d{2}\/\d{4}$/.test(val.trim())) return val.trim();

    if (typeof val === 'string' && /^\d{4}-\d{2}-\d{2}/.test(val.trim())){
      const s = val.trim();
      const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
      if (m) return `${pad2(+m[3])}/${pad2(+m[2])}/${m[1]}`;
      try{ const d=new Date(s); if(!isNaN(d)) return `${pad2(d.getDate())}/${pad2(d.getMonth()+1)}/${d.getFullYear()}`; }catch(_){}
      return s;
    }

    if (typeof val === 'string'){
      const s = val.trim();
      const m2 = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
      if (m2){
        const a = +m2[1], b = +m2[2], y = m2[3];
        if (b > 12 && a >= 1 && a <= 12) return `${pad2(b)}/${pad2(a)}/${y}`;
        return `${pad2(a)}/${pad2(b)}/${y}`;
      }
    }

    try{
      const d = new Date(val);
      if (!isNaN(d)) return `${pad2(d.getDate())}/${pad2(d.getMonth()+1)}/${d.getFullYear()}`;
    }catch(_){}
    return String(val);
  }

  const ASSESSMENT_DATE_KEYS = new Set(['assessment_date','followup_due','first_date_5fu']);
  const PHONELOG_DATE_KEYS   = new Set(['call_time','next_due']);

  function mapAssessmentDates(obj){
    if (!obj || typeof obj !== 'object') return obj;
    const out = { ...obj };
    ASSESSMENT_DATE_KEYS.forEach(k=>{ if (k in out) out[k] = toDMY(out[k]); });
    return out;
  }
  function mapPhoneLogDates(obj){
    if (!obj || typeof obj !== 'object') return obj;
    const out = { ...obj };
    PHONELOG_DATE_KEYS.forEach(k=>{ if (k in out) out[k] = toDMY(out[k]); });
    return out;
  }

  /* ==============================
   * JSONP (للعمل على file://)
   * ============================== */

  function jsonpRequest(params, { timeoutMs = 15000 } = {}) {
    return new Promise((resolve, reject) => {
      const cbName = '__jsonp_cb_' + Math.random().toString(36).slice(2);
      let script = null;
      let timer = null;

      function cleanup() {
        try { delete window[cbName]; if (script && script.parentNode) script.parentNode.removeChild(script); } catch {}
        if (timer) clearTimeout(timer);
      }

      window[cbName] = (payload) => { cleanup(); resolve(payload); };

      const url = buildUrl(Object.assign({}, params, { callback: cbName }));
      script = document.createElement('script');
      script.src = url;
      script.async = true;
      script.onerror = () => { cleanup(); reject(new Error('JSONP network error')); };
      document.head.appendChild(script);

      timer = setTimeout(() => { cleanup(); reject(new Error('JSONP timeout')); }, timeoutMs);
    });
  }

  /* ==============================
   * fetch عادي (للـ http/https)
   * ============================== */

  async function apiGet(params) {
    const url = buildUrl(params);
    const res = await fetch(url, { method: 'GET', credentials: 'omit' });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return await res.json();
  }

  async function apiPost(params, bodyObj) {
    const url = buildUrl(params);
    const res = await fetch(url, {
      method: 'POST',
      credentials: 'omit',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(bodyObj || {}),
    });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return await res.json();
  }

  /* ==============================
   * دوال عالية المستوى (Assessments)
   * ============================== */

  async function fetchAssessments() {
    if (!BASE_URL) throw new Error('WEBAPP_URL is not set');
    if (IS_FILE_PROTOCOL) {
      const res = await jsonpRequest({ action: 'listAssessments' });
      return Array.isArray(res) ? res : (res && res.rows) || [];
    } else {
      const res = await apiGet({ action: 'listAssessments' });
      return Array.isArray(res) ? res : (res && res.rows) || [];
    }
  }

  async function saveAssessment(record) {
    if (!BASE_URL) throw new Error('WEBAPP_URL is not set');
    const payload = mapAssessmentDates(record || {});
    if (IS_FILE_PROTOCOL) {
      const res = await jsonpRequest({ action: 'saveAssessment', data: encodeData(payload) });
      return res || { ok: true };
    } else {
      const res = await apiPost({ action: 'saveAssessment' }, payload);
      return res || { ok: true };
    }
  }

  async function updateAssessmentFields(id, patch) {
    if (!id) throw new Error('id is required');
    const data = Object.assign({ id: String(id) }, patch || {});
    return await saveAssessment(data);
  }

  async function deleteAssessmentCascade(id) {
    if (!BASE_URL) throw new Error('WEBAPP_URL is not set');
    if (!id) throw new Error('id is required');
    if (IS_FILE_PROTOCOL) {
      const res = await jsonpRequest({ action: 'deleteAssessmentCascade', id: String(id) });
      return res || { ok: true };
    } else {
      const res = await apiPost({ action: 'deleteAssessmentCascade' }, { id: String(id) });
      return res || { ok: true };
    }
  }

  /* ==============================
   * دوال عالية المستوى (Phone Logs)
   * ============================== */

  async function fetchPhoneLogs(patientId) {
    if (!BASE_URL) throw new Error('WEBAPP_URL is not set');
    const id = String(patientId || '');
    if (IS_FILE_PROTOCOL) {
      const res = await jsonpRequest({ action: 'listPhoneLogs', id });
      return Array.isArray(res) ? res : (res && res.rows) || [];
    } else {
      const res = await apiGet({ action: 'listPhoneLogs', id });
      return Array.isArray(res) ? res : (res && res.rows) || [];
    }
  }

  async function savePhoneLog(log) {
    if (!BASE_URL) throw new Error('WEBAPP_URL is not set');
    const payload = mapPhoneLogDates(log || {});
    if (IS_FILE_PROTOCOL) {
      const res = await jsonpRequest({ action: 'savePhoneLog', data: encodeData(payload) });
      return res || { ok: true };
    } else {
      const res = await apiPost({ action: 'savePhoneLog' }, payload);
      return res || { ok: true };
    }
  }

  async function deletePhoneLog({ id, log_id, call_time }) {
    if (!BASE_URL) throw new Error('WEBAPP_URL is not set');
    const payload = {
      id: id != null ? String(id) : '',
      log_id: String(log_id || ''),
      call_time: call_time || '',
    };
    if (!payload.log_id) throw new Error('log_id is required');

    if (IS_FILE_PROTOCOL) {
      const res = await jsonpRequest({ action: 'deletePhoneLog', data: encodeData(payload) });
      return res || { ok: true };
    } else {
      const res = await apiPost({ action: 'deletePhoneLog' }, payload);
      return res || { ok: true };
    }
  }

  /* ==============================
   * كشف الواجهة
   * ============================== */

  const API = {
    fetchAssessments,
    saveAssessment,
    updateAssessmentFields,
    deleteAssessmentCascade,
    fetchPhoneLogs,
    savePhoneLog,
    deletePhoneLog,
  };

  if (typeof window !== 'undefined') window.SheetsAPI = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})();
