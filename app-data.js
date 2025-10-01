/* =========================================================================
 * app-data.js
 * -------------------------------------------------------------------------
 * مركز الإعدادات والثوابت للتطبيق (Front-end config & constants)
 *
 * ماذا يوفّر هذا الملف؟
 * 1) تعريف رابط الـ WebApp الخاص بـ Google Apps Script عبر window.WEBAPP_URL.
 * 2) كائن إعدادات موحّد APP_CONFIG يحوي أسماء الشيتات والأعمدة القياسية.
 * 3) دوال مساعدة بسيطة لضبط/قراءة رابط الويب آب والتحقق من الإعدادات.
 *
 * ملاحظات مهمة:
 * - يجب ضبط window.WEBAPP_URL إلى رابط الويب آب المنشور من ملف Code.gs.
 *   مثال: https://script.google.com/macros/s/AKfycb.../exec
 * - هذا الملف لا يعتمد على ملفات أخرى، ويمكن تحميله باكراً في index.html.
 * - باقي الوحدات (app-sheets.js، إلخ) ستقرأ window.WEBAPP_URL مباشرة.
 * ========================================================================= */

(function () {
  'use strict';

  /* ==============================
   * 1) WebApp URL
   * ============================== */

  /**
   * ضع هنا رابط الويب آب (GAS WebApp URL) أو اتركه فارغًا واضبطه لاحقًا من الـ index.html.
   * إن تركته فارغًا، ستظهر رسالة خطأ من app-sheets.js عند أول طلب شبكة.
   */
  if (typeof window.WEBAPP_URL === 'undefined') {
    window.WEBAPP_URL = 'https://script.google.com/macros/s/AKfycbyZDLT5dOKwf6Kj72vmIwrHw-jRT2BneJkYMSLFvj3cGhrcgBLbS-H7uZC4UXEYWiqT/exec'; // ← مثال: 'https://script.google.com/macros/s/AKfycb.../exec'
  }

  /**
   * اضبط رابط الويب آب برمجيًا (اختياري).
   * @param {string} url
   */
  function setWebAppUrl(url) {
    if (!url || typeof url !== 'string') {
      throw new Error('[app-data] setWebAppUrl: invalid URL');
    }
    window.WEBAPP_URL = url.trim();
    return window.WEBAPP_URL;
  }

  /**
   * أعِد رابط الويب آب الحالي (قد يكون فارغًا إن لم يُضبط).
   * @returns {string}
   */
  function getWebAppUrl() {
    return (typeof window.WEBAPP_URL === 'string') ? window.WEBAPP_URL : '';
  }

  /**
   * تحقّق سريع من الضبط لإظهار تحذير مبكر في الـ console.
   */
  function assertAppConfig() {
    const url = getWebAppUrl();
    if (!url) {
      console.warn('[app-data] WEBAPP_URL not set yet. Configure it in app-data.js or index.html.');
    }
  }

  /* ==============================
   * 2) Unified App Config
   * ============================== */

  /**
   * أسماء الشيتات الافتراضية (يجب أن تطابق Code.gs).
   * يمكنك تعديلها هنا وفي Code.gs معًا للحفاظ على التطابق.
   */
  const SHEET_NAMES = {
    assessments: 'patients_assessments_master',
    phoneLogs: 'phone_logs',
  };

  /**
   * الأعمدة القياسية لسطر الـ Assessment في الشيت (متوافقة مع Code.gs).
   * تتضمن الحقول الجديدة: toxicity_found, mucositis_grade, diarrhea_grade,
   * neutropenia_grade, other_tox_name, other_tox_grade.
   */
  const ASSESSMENT_COLUMNS = [
    'id',
    'assessment_date',
    'name',
    'phone',
    'regimen',
    'cycle',
    'stage',
    'diagnosis',

    // Toxicities
    'toxicity',          // overall grade (G0–G4) — يبقى كما هو
    'toxicity_found',    // Yes / No
    'mucositis_grade',   // G0–G4
    'diarrhea_grade',    // G0–G4
    'neutropenia_grade', // G0–G4
    'other_tox_name',
    'other_tox_grade',   // G0–G4

    'followup_due',
    'notes',

    // Timestamps
    'created_at',
    'updated_at',
  ];

  /**
   * الأعمدة القياسية لسطر الـ Phone Log (متوافقة مع Code.gs).
   */
  const PHONE_LOG_COLUMNS = [
    'id',            // patient id
    'datetime',      // ISO string أو نص تاريخ/وقت
    'type',          // Incoming / Outgoing / Missed / SMS / Other
    'notes',
    'next_followup', // تاريخ (اختياري)
    'created_at',
  ];

  /**
   * خيارات الدرجات المستخدمة للنموذج.
   */
  const GRADE_OPTIONS = ['G0', 'G1', 'G2', 'G3', 'G4'];

  /**
   * إعدادات وسمات إضافية للتطبيق يمكن تشغيل/إيقاف ميزات منها.
   */
  const FEATURE_FLAGS = {
    cascadeDelete: true,   // الحذف التسلسلي Assessment + PhoneLogs
    phoneModal: true,      // تفعيل مودال مكالمات الهاتف
    csvExport: true,       // تفعيل تصدير CSV
  };

  /**
   * نسخة التطبيق (للتشخيص فقط).
   */
  const APP_VERSION = 'v1.0.0-2025-09-03';

  /**
   * كائن إعدادات موحّد يمكن لباقي الوحدات قراءته عند الحاجة.
   */
  const APP_CONFIG = {
    VERSION: APP_VERSION,
    SHEETS: { ...SHEET_NAMES },
    COLUMNS: {
      ASSESSMENT: [...ASSESSMENT_COLUMNS],
      PHONE_LOG: [...PHONE_LOG_COLUMNS],
    },
    OPTIONS: {
      GRADES: [...GRADE_OPTIONS],
    },
    FEATURES: { ...FEATURE_FLAGS },
  };

  /* ==============================
   * 3) Helpers (Optional)
   * ============================== */

  /**
   * يُرجع كائن سجل فارغ جاهز للملء في نموذج الـ Assessment.
   * (اختياري للاستخدام من وحدات أخرى)
   */
  function getEmptyAssessmentRecord() {
    return {
      id: '',
      assessment_date: '',
      name: '',
      phone: '',
      regimen: '',
      cycle: '',
      stage: '',
      diagnosis: '',

      toxicity: '',
      toxicity_found: '',

      mucositis_grade: '',
      diarrhea_grade: '',
      neutropenia_grade: '',

      other_tox_name: '',
      other_tox_grade: '',

      followup_due: '',
      notes: '',

      created_at: '',
      updated_at: '',
    };
  }

  /**
   * يُرجع كائن سجل فارغ لـ Phone Log.
   */
  function getEmptyPhoneLog() {
    return {
      id: '',
      datetime: '',
      type: 'Other',
      notes: '',
      next_followup: '',
      created_at: '',
    };
  }

  /* ==============================
   * 4) Expose
   * ============================== */

  const API = {
    setWebAppUrl,
    getWebAppUrl,
    assertAppConfig,

    APP_CONFIG,
    SHEET_NAMES,
    ASSESSMENT_COLUMNS,
    PHONE_LOG_COLUMNS,
    GRADE_OPTIONS,
    FEATURE_FLAGS,

    getEmptyAssessmentRecord,
    getEmptyPhoneLog,
  };

  if (typeof window !== 'undefined') {
    window.AppData = API;
    // تحقّق مبكر عند التحميل
    try { assertAppConfig(); } catch (e) { /* ignore */ }
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = API;
  }
})();
