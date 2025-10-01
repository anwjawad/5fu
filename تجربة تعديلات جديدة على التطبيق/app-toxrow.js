/* =========================================================================
 * app-toxrow.js
 * -------------------------------------------------------------------------
 * طبقة خفيفة لإدارة "صفّ السُمّيات" داخل نموذج التقييم.
 *
 * الميزات:
 * - تهيئة وربط الحقول مع app-tox-helpers.js عبر wireAutoCompute:
 *     → يُحدّث #toxicity و #toxicity_found تلقائيًا عند تغيّر الدرجات المنفصلة.
 * - getValues(): يعيد كائن السمّيات من النموذج (منسّق ومطبّع).
 * - setValues(obj): يملأ الحقول من كائن بيانات (مع تطبيع الدرجات).
 * - computeNow(): يُجري تحديثًا فوريًا لقيم overall/found بحسب المدخل الحالي.
 *
 * الاعتماديات:
 *   - window.ToxHelpers  (من app-tox-helpers.js)
 *   - اختياريًا window.Utils (من app-utils.js)
 *
 * يتوقع وجود العناصر التالية داخل نفس النموذج:
 *   #mucositis_grade, #diarrhea_grade, #neutropenia_grade,
 *   #other_tox_name, #other_tox_grade,
 *   #toxicity (overall), #toxicity_found
 * ========================================================================= */

(function () {
  'use strict';

  function $(sel, root) {
    return (root || document).querySelector(sel);
  }

  function normalizeGrade(s) {
    if (window.ToxHelpers && window.ToxHelpers.normalizeGrade) {
      return window.ToxHelpers.normalizeGrade(s);
    }
    // fallback بسيط
    if (s == null || s === '') return '';
    const t = String(s).trim().toUpperCase();
    if (/^[0-4]$/.test(t)) return 'G' + t;
    if (/^G[0-4]$/.test(t)) return t;
    return t;
  }

  function yesNo(v) {
    if (v === 'Yes' || v === 'No') return v;
    if (typeof v === 'boolean') return v ? 'Yes' : 'No';
    if (v == null || v === '') return '';
    return v ? 'Yes' : 'No';
  }

  function getForm(formEl) {
    const form = formEl || document.getElementById('assessment-form');
    if (!form) throw new Error('[toxrow] Missing #assessment-form');
    return form;
  }

  /**
   * يقرأ قيم السُمّيات من النموذج
   */
  function readFromForm(formEl) {
    const form = getForm(formEl);
    const q = (id) => (form.querySelector('#' + id) || {}).value;

    return {
      mucositis_grade:   normalizeGrade(q('mucositis_grade')),
      diarrhea_grade:    normalizeGrade(q('diarrhea_grade')),
      neutropenia_grade: normalizeGrade(q('neutropenia_grade')),
      other_tox_name:    (q('other_tox_name') || '').trim(),
      other_tox_grade:   normalizeGrade(q('other_tox_grade')),
      toxicity:          normalizeGrade(q('toxicity')),
      toxicity_found:    yesNo(q('toxicity_found')),
    };
  }

  /**
   * يكتب قيم السُمّيات إلى النموذج
   */
  function writeToForm(values, formEl) {
    const form = getForm(formEl);
    const set = (id, v) => {
      const el = form.querySelector('#' + id);
      if (el) el.value = v == null ? '' : v;
    };
    set('mucositis_grade',   normalizeGrade(values.mucositis_grade));
    set('diarrhea_grade',    normalizeGrade(values.diarrhea_grade));
    set('neutropenia_grade', normalizeGrade(values.neutropenia_grade));
    set('other_tox_name',    (values.other_tox_name || '').trim());
    set('other_tox_grade',   normalizeGrade(values.other_tox_grade));
    set('toxicity',          normalizeGrade(values.toxicity));
    set('toxicity_found',    yesNo(values.toxicity_found));
  }

  /**
   * يُطبّع ويُكمل القيم (overall/found) إن كانت فارغة
   */
  function sanitize(values) {
    const v = Object.assign({}, values);
    // تطبيع
    v.mucositis_grade   = normalizeGrade(v.mucositis_grade);
    v.diarrhea_grade    = normalizeGrade(v.diarrhea_grade);
    v.neutropenia_grade = normalizeGrade(v.neutropenia_grade);
    v.other_tox_grade   = normalizeGrade(v.other_tox_grade);
    v.toxicity          = normalizeGrade(v.toxicity);
    v.toxicity_found    = yesNo(v.toxicity_found);

    if (window.ToxHelpers && typeof window.ToxHelpers.sanitizeAssessmentRecord === 'function') {
      const merged = window.ToxHelpers.sanitizeAssessmentRecord(v);
      // إعادة استخراج الحقول المهمة فقط
      return {
        mucositis_grade:   merged.mucositis_grade,
        diarrhea_grade:    merged.diarrhea_grade,
        neutropenia_grade: merged.neutropenia_grade,
        other_tox_name:    merged.other_tox_name,
        other_tox_grade:   merged.other_tox_grade,
        toxicity:          merged.toxicity,
        toxicity_found:    merged.toxicity_found,
      };
    }

    // fallback: احسب overall/found يدويًا إن توفر helpers الأساسية
    if ((!v.toxicity || v.toxicity === '') && window.ToxHelpers && window.ToxHelpers.computeOverall) {
      v.toxicity = window.ToxHelpers.computeOverall(v) || '';
    }
    if ((!v.toxicity_found || v.toxicity_found === '') && window.ToxHelpers && window.ToxHelpers.computeFound) {
      v.toxicity_found = window.ToxHelpers.computeFound(v) || '';
    }

    return v;
  }

  /**
   * يربط الحقول لتحديث #toxicity و #toxicity_found تلقائيًا
   */
  function init(formEl, opts) {
    const form = getForm(formEl);
    if (!window.ToxHelpers || typeof window.ToxHelpers.wireAutoCompute !== 'function') {
      console.warn('[toxrow] ToxHelpers.wireAutoCompute not available; auto compute disabled.');
      return null;
    }
    return window.ToxHelpers.wireAutoCompute(form, Object.assign({ syncOverall: true, syncFound: true }, opts || {}));
  }

  /**
   * يُجري تحديثًا فوريًا لقيم overall/found بحسب الحالة الحالية للنموذج
   */
  function computeNow(formEl) {
    const form = getForm(formEl);
    const current = readFromForm(form);
    const fixed = sanitize(current);
    writeToForm(fixed, form);
    return fixed;
  }

  /**
   * API عام
   */
  const API = {
    init,               // ربط auto-compute
    getValues: readFromForm,
    setValues: writeToForm,
    sanitize,           // تطبيع + إكمال overall/found
    computeNow,         // تحديث فوري للحقول المحسوبة
  };

  if (typeof window !== 'undefined') {
    window.ToxRow = API;
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = API;
  }
})();
