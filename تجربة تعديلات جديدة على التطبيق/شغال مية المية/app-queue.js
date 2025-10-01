/* =========================================================================
 * app-queue.js
 * -------------------------------------------------------------------------
 * طابور مهام بسيط للعمليات الشبكية: حفظ تقييم، حذف تسلسلي، حفظ Phone Log.
 * - تنفيذ متتابع (concurrency = 1)
 * - إعادة محاولة تلقائية مع backoff
 * - تخزين دائم بالمتصفح (localStorage) لضمان عدم فقدان الطلبات عند الإغلاق
 * - تكامل اختياري مع Ext.events لإشعارات on: 'queue:add' | 'queue:done' | 'queue:fail'
 *
 * يعتمد على:
 *   - window.SheetsAPI  (saveAssessment, deleteAssessmentCascade, savePhoneLog)
 *   - اختياريًا window.Ext.events
 * ========================================================================= */

(function () {
  'use strict';

  // ==========================
  // إعدادات عامة
  // ==========================

  const STORE_KEY = 'app.queue.v1';
  const DEFAULT_RETRY_LIMIT = 3;
  const DEFAULT_BACKOFF_MS = 1500; // أساس backoff
  const MAX_BACKOFF_MS = 15000;

  // خريطة تصاريح العمليات المدعومة
  const ACTIONS = {
    SAVE_ASSESSMENT: 'SAVE_ASSESSMENT',
    DELETE_CASCADE: 'DELETE_CASCADE',
    SAVE_PHONE_LOG: 'SAVE_PHONE_LOG',
  };

  // ==========================
  // أدوات مساعدة
  // ==========================

  function nowISO() {
    return new Date().toISOString();
  }

  function uuid() {
    return 'q_' + Math.random().toString(36).slice(2, 10) + '_' + Date.now().toString(36);
  }

  function clamp(n, min, max) {
    n = Number(n);
    if (Number.isNaN(n)) return min;
    return Math.max(min, Math.min(max, n));
  }

  function backoff(attempt) {
    // نموّ أسّي بسيط مع ضجيج بسيط
    const base = DEFAULT_BACKOFF_MS * Math.pow(2, attempt - 1);
    const jitter = Math.floor(Math.random() * 250);
    return clamp(base + jitter, DEFAULT_BACKOFF_MS, MAX_BACKOFF_MS);
  }

  function emit(evt, payload) {
    if (window.Ext && window.Ext.events && typeof window.Ext.events.emit === 'function') {
      window.Ext.events.emit(evt, payload);
    }
    // كما يمكن إضافة dispatchEvent مخصص هنا لو رغبت لاحقًا.
  }

  function loadStore() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function saveStore(items) {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(items || []));
    } catch (e) {
      console.warn('[queue] localStorage save failed:', e);
    }
  }

  // ==========================
  // حالة الطابور
  // ==========================

  const state = {
    items: loadStore(), // [{id, action, payload, attempts, created_at, updated_at}]
    running: false,
    timer: null,
  };

  function persist() {
    saveStore(state.items);
  }

  function enqueue(action, payload, opts) {
    const item = {
      id: uuid(),
      action: String(action),
      payload: payload || {},
      attempts: 0,
      retryLimit: (opts && Number.isFinite(opts.retryLimit)) ? opts.retryLimit : DEFAULT_RETRY_LIMIT,
      created_at: nowISO(),
      updated_at: nowISO(),
    };
    state.items.push(item);
    persist();
    emit('queue:add', { item, size: state.items.length });
    scheduleRun(100);
    return item.id;
  }

  function dequeueById(id) {
    const idx = state.items.findIndex((x) => x.id === id);
    if (idx >= 0) {
      const [removed] = state.items.splice(idx, 1);
      persist();
      return removed;
    }
    return null;
  }

  function peek() {
    return state.items.length ? state.items[0] : null;
  }

  function scheduleRun(ms) {
    clearTimeout(state.timer);
    state.timer = setTimeout(run, ms || 0);
  }

  // ==========================
  // نفّذ عنصر واحد
  // ==========================

  async function execItem(item) {
    if (!window.SheetsAPI) throw new Error('SheetsAPI not available');

    switch (item.action) {
      case ACTIONS.SAVE_ASSESSMENT:
        // payload: {record}
        return window.SheetsAPI.saveAssessment(item.payload && item.payload.record || {});

      case ACTIONS.DELETE_CASCADE:
        // payload: {id}
        return window.SheetsAPI.deleteAssessmentCascade(item.payload && item.payload.id);

      case ACTIONS.SAVE_PHONE_LOG:
        // payload: {log}
        return window.SheetsAPI.savePhoneLog(item.payload && item.payload.log || {});

      default:
        throw new Error('Unknown action: ' + item.action);
    }
  }

  // ==========================
  // حلقة التشغيل
  // ==========================

  async function run() {
    if (state.running) return;
    state.running = true;

    try {
      let guard = 0;
      while (peek() && guard < 1000) { // حارس بسيط لتجنّب الدوران اللانهائي
        guard++;
        const item = peek();

        try {
          // جرّب التنفيذ
          const res = await execItem(item);
          // لو نجح: أزِل العنصر
          dequeueById(item.id);
          emit('queue:done', { item, res, size: state.items.length });
        } catch (err) {
          // فشل: زِد المحاولة، وقرّر
          item.attempts++;
          item.updated_at = nowISO();

          if (item.attempts >= item.retryLimit) {
            // تجاوز الحد → أزل مع إشعار فشل
            dequeueById(item.id);
            emit('queue:fail', { item, error: String(err && (err.message || err)) });
          } else {
            // أعِد المحاولة لاحقًا: أخر العنصر (أرسله لنهاية الطابور)
            state.items.shift(); // أزل من المقدمة
            state.items.push(item); // أضف للنهاية
            persist();

            const delay = backoff(item.attempts);
            // أوقف الحلقة الحالية وجدول محاولة لاحقة
            scheduleRun(delay);
            break;
          }
        }

        persist();
      }
    } finally {
      state.running = false;
      if (peek()) {
        // ما زال هناك عناصر → أعد الجدولة
        scheduleRun(250);
      }
    }
  }

  // ==========================
  // API عام للطابور
  // ==========================

  const Queue = {
    ACTIONS,

    // عمليات عالية المستوى:
    addSaveAssessment(record, opts) {
      return enqueue(ACTIONS.SAVE_ASSESSMENT, { record }, opts);
    },
    addDeleteCascade(id, opts) {
      return enqueue(ACTIONS.DELETE_CASCADE, { id }, opts);
    },
    addSavePhoneLog(log, opts) {
      return enqueue(ACTIONS.SAVE_PHONE_LOG, { log }, opts);
    },

    // التحكم بالطابور:
    run,
    schedule: scheduleRun,
    clear() {
      const size = state.items.length;
      state.items = [];
      persist();
      return size;
    },
    remove(id) {
      return dequeueById(id);
    },
    getPending() {
      return state.items.slice();
    },
    size() {
      return state.items.length;
    },
    isRunning() {
      return !!state.running;
    },
  };

  // ==========================
  // دمج اختياري مع التطبيق
  // ==========================

  // مثال: لو فقدت الشبكة، أجّل التنفيذ
  window.addEventListener('online', () => scheduleRun(300));
  // عند التحميل، حاول تشغيل المهام المعلّقة
  document.addEventListener('DOMContentLoaded', () => scheduleRun(800));

  // كشف الواجهة
  if (typeof window !== 'undefined') {
    window.AppQueue = Queue;
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = Queue;
  }
})();
