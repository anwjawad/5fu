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
 *     listPhoneLogs, savePhoneLog, deletePhoneLog   // ← NEW
 *
 * ملاحظات:
 * - يقرأ رابط الـ Web App من window.AppData.getWebAppUrl() أو window.WEBAPP_URL
 * - يدعم إرسال كائنات كبيرة عبر JSONP باستخدام data=base64
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
    // Base64 UTF-8 آمن
    return btoa(unescape(encodeURIComponent(json)));
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
        try {
          delete window[cbName];
          if (script && script.parentNode) script.parentNode.removeChild(script);
        } catch {}
        if (timer) clearTimeout(timer);
      }

      window[cbName] = (payload) => {
        cleanup();
        resolve(payload);
      };

      const url = buildUrl(Object.assign({}, params, { callback: cbName }));
      script = document.createElement('script');
      script.src = url;
      script.async = true;
      script.onerror = () => {
        cleanup();
        reject(new Error('JSONP network error'));
      };
      document.head.appendChild(script);

      timer = setTimeout(() => {
        cleanup();
        reject(new Error('JSONP timeout'));
      }, timeoutMs);
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
    const payload = record || {};
    if (IS_FILE_PROTOCOL) {
      const res = await jsonpRequest({ action: 'saveAssessment', data: encodeData(payload) });
      return res || { ok: true };
    } else {
      const res = await apiPost({ action: 'saveAssessment' }, payload);
      return res || { ok: true };
    }
  }

  /**
   * updateAssessmentFields(id, patch)
   * - اختصار آمن لتحديث حقول محددة في سجل Assessment.
   * - يدمج {id} مع patch ويرسلها إلى saveAssessment (Upsert).
   */
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

  /**
   * savePhoneLog(log)
   * - يدعم upsert بالـ log_id (لو أرسلته الواجهة).
   * - يتقبّل كل الحقول التي يدعمها الخادم.
   */
  async function savePhoneLog(log) {
    if (!BASE_URL) throw new Error('WEBAPP_URL is not set');
    const payload = log || {};
    if (IS_FILE_PROTOCOL) {
      const res = await jsonpRequest({ action: 'savePhoneLog', data: encodeData(payload) });
      return res || { ok: true };
    } else {
      const res = await apiPost({ action: 'savePhoneLog' }, payload);
      return res || { ok: true };
    }
  }

  /**
   * NEW: deletePhoneLog({ id, log_id, call_time })
   * - يحذف صفًا واحدًا من PhoneLogs عبر المفتاح log_id.
   * - id اختياري كمعلومة تحقّق إضافية، وكذلك call_time.
   * - يعمل على file:// (jsonp data=base64) وعلى http/https (POST JSON).
   */
  async function deletePhoneLog({ id, log_id, call_time }) {
    if (!BASE_URL) throw new Error('WEBAPP_URL is not set');
    const payload = {
      id: id != null ? String(id) : '',
      log_id: String(log_id || ''),
      call_time: call_time || '', // يُمكن إرسال ISO أو DD/MM/YYYY؛ الخادم يطبّعها
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
    // Assessments
    fetchAssessments,
    saveAssessment,
    updateAssessmentFields,
    deleteAssessmentCascade,
    // Phone
    fetchPhoneLogs,
    savePhoneLog,
    deletePhoneLog, // ← NEW
  };

  if (typeof window !== 'undefined') {
    window.SheetsAPI = API;
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = API;
  }
})();
