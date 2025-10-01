/* =========================================================================
 * app-tox-helpers.js
 * -------------------------------------------------------------------------
 * Helpers لحساب/تطبيع الدرجات وتوحيد الحقول المتعلقة بالسمّيات.
 *
 * ماذا يوفّر؟
 * - normalizeGrade(v)        ← يطبع الدرجات بصيغة G0..G4 (يتسامح مع "0..4")
 * - gradeToNumber(g)         ← يحوّل "G3" → 3 أو "3" → 3
 * - maxGrade(grades[])       ← أعلى درجة كـ "G#"
 * - computeOverall(tox)      ← يحسب overall toxicity من الحقول المنفصلة
 * - computeFound(tox)        ← Yes/No وفق وجود أي درجة ≥ G1
 * - sanitizeAssessmentRecord(record) ← يُنظّم السجل ويسد القيم المحسوبة
 * - wireAutoCompute(formEl, {syncFound, syncOverall})
 * ========================================================================= */

(function () {
  'use strict';

  // ========= أدوات عامة بسيطة =========

  function trim(s) {
    return s == null ? '' : String(s).trim();
  }

  function normalizeGrade(v) {
    if (v == null || v === '') return '';
    const s = String(v).trim().toUpperCase();
    if (/^[0-4]$/.test(s)) return 'G' + s;      // 0..4 → G0..G4
    if (/^G[0-4]$/.test(s)) return s;           // G0..G4 كما هي
    return s;                                    // أي نص آخر نتركه
  }

  function gradeToNumber(g) {
    if (g == null || g === '') return NaN;
    const s = String(g).trim().toUpperCase();
    if (/^[0-4]$/.test(s)) return Number(s);
    const m = s.match(/^G([0-4])$/);
    return m ? Number(m[1]) : NaN;
  }

  function maxGrade(grades) {
    const nums = (grades || [])
      .map(gradeToNumber)
      .filter((n) => !Number.isNaN(n));
    if (!nums.length) return '';
    const m = Math.max(...nums);
    return 'G' + String(m);
  }

  function computeOverall(tox) {
    if (!tox || typeof tox !== 'object') return '';
    const g = maxGrade([
      normalizeGrade(tox.mucositis_grade),
      normalizeGrade(tox.diarrhea_grade),
      normalizeGrade(tox.neutropenia_grade),
      normalizeGrade(tox.other_tox_grade),
    ]);
    return g || '';
  }

  function computeFound(tox) {
    if (!tox || typeof tox !== 'object') return '';
    const arr = [
      tox.mucositis_grade,
      tox.diarrhea_grade,
      tox.neutropenia_grade,
      tox.other_tox_grade,
    ].map(gradeToNumber);
    const hasAny = arr.some((n) => !Number.isNaN(n) && n >= 1);
    if (typeof tox.toxicity_found === 'string' && (tox.toxicity_found === 'Yes' || tox.toxicity_found === 'No')) {
      return tox.toxicity_found; // احترام إدخال المستخدم إن وُجد
    }
    return hasAny ? 'Yes' : (arr.every((n) => Number.isNaN(n)) ? '' : 'No');
  }

  function sanitizeAssessmentRecord(record) {
    if (!record || typeof record !== 'object') return {};
    const out = { ...record };

    out.mucositis_grade   = normalizeGrade(out.mucositis_grade);
    out.diarrhea_grade    = normalizeGrade(out.diarrhea_grade);
    out.neutropenia_grade = normalizeGrade(out.neutropenia_grade);
    out.other_tox_grade   = normalizeGrade(out.other_tox_grade);

    const currentOverall = trim(out.toxicity);
    if (!currentOverall) {
      out.toxicity = computeOverall(out);
    } else {
      const ng = normalizeGrade(currentOverall);
      out.toxicity = /^G[0-4]$/.test(ng) ? ng : currentOverall;
    }

    const tf = trim(out.toxicity_found);
    if (!tf) {
      out.toxicity_found = computeFound(out);
    } else {
      const s = tf.toLowerCase();
      out.toxicity_found = (s === 'yes' || s === 'no') ? (s === 'yes' ? 'Yes' : 'No') : tf;
    }

    return out;
  }

  /**
   * يربط النموذج ليقوم بتحديث #toxicity و #toxicity_found تلقائيًا
   * عند تغيّر الحقول المنفصلة.
   */
  function wireAutoCompute(formEl, options) {
    if (!formEl) return;
    const opts = Object.assign({ syncOverall: true, syncFound: true }, options || {});

    // ✅ يقبل id أو selector كامل
    const $ = (sel) => {
      const s = (typeof sel === 'string' && sel.startsWith('#')) ? sel : ('#' + sel);
      return formEl.querySelector(s);
    };

    const els = {
      toxicity:        $('toxicity'),
      found:           $('toxicity_found'),
      mucositis:       $('mucositis_grade'),
      diarrhea:        $('diarrhea_grade'),
      neutropenia:     $('neutropenia_grade'),
      otherName:       $('other_tox_name'),
      otherGrade:      $('other_tox_grade'),
    };

    function read() {
      return {
        mucositis_grade:   els.mucositis && els.mucositis.value,
        diarrhea_grade:    els.diarrhea && els.diarrhea.value,
        neutropenia_grade: els.neutropenia && els.neutropenia.value,
        other_tox_grade:   els.otherGrade && els.otherGrade.value,
        toxicity:          els.toxicity && els.toxicity.value,
        toxicity_found:    els.found && els.found.value,
      };
    }

    function update() {
      const tox = sanitizeAssessmentRecord(read());
      if (opts.syncOverall && els.toxicity) {
        els.toxicity.value = tox.toxicity || '';
      }
      if (opts.syncFound && els.found) {
        els.found.value = tox.toxicity_found || '';
      }
    }

    const inputs = [
      els.mucositis, els.diarrhea, els.neutropenia, els.otherGrade,
    ].filter(Boolean);

    inputs.forEach((el) => {
      el.addEventListener('change', update);
      el.addEventListener('input', update);
    });

    update();
    return { update };
  }

  // ========= كشف API =========

  const API = {
    normalizeGrade,
    gradeToNumber,
    maxGrade,
    computeOverall,
    computeFound,
    sanitizeAssessmentRecord,
    wireAutoCompute,
  };

  if (typeof window !== 'undefined') {
    window.ToxHelpers = API;
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = API;
  }
})();
