/* =========================================================================
 * app-csv.js
 * -------------------------------------------------------------------------
 * تصدير بيانات التقييمات (Saved Assessments) إلى CSV.
 *
 * الجديد:
 * - تضمين حقول السمّيات المنفصلة:
 *     mucositis_grade, diarrhea_grade, neutropenia_grade
 * - تضمين Other toxicity في عمودين:
 *     other_tox_name, other_tox_grade
 * - تضمين "Toxicity found?" في عمود مستقل:
 *     toxicity_found  (Yes/No كنص)
 * - الإبقاء على toxicity (overall) كما هو.
 *
 * ملاحظات:
 * - يقبل الدالة exportAssessments(records, filename) حيث records = Array<Object>.
 * - يتعامل مع مفاتيح ناقصة دون كسر؛ يضع قيمة فارغة عند عدم توفر المفتاح.
 * - يسمح بإضافة أعمدة مخصّصة إضافية إن لزم عبر options.extraColumns.
 * ========================================================================= */

(function () {
  'use strict';

  /**
   * تهريب قيم CSV بشكل آمن (فواصل/سطر جديد/علامات اقتباس)
   * @param {any} val
   * @returns {string}
   */
  function csvEscape(val) {
    if (val === null || val === undefined) return '';
    const s = String(val);
    // إذا تحتوي على فاصلة أو سطر جديد أو اقتباس مزدوج؛ لفّها بعلامات اقتباس وهرب الاقتباسات
    if (/[",\r\n]/.test(s)) {
      return '"' + s.replace(/"/g, '""') + '"';
    }
    return s;
  }

  /**
   * يحاول استخراج تاريخ بصيغة قابلة للقراءة، دون فرض شكل محدد على المصدر
   * @param {any} v
   * @returns {string}
   */
  function normalizeDate(v) {
    if (!v) return '';
    try {
      // إن كان النص أصلاً تاريخًا جاهزًا فاتركه
      if (typeof v === 'string') {
        // لا تفرض تحويلًا إن بدا قابلاً للقراءة
        return v;
      }
      const d = new Date(v);
      if (isNaN(d.getTime())) return String(v);
      // YYYY-MM-DD HH:mm
      const pad = (n) => String(n).padStart(2, '0');
      return (
        d.getFullYear() +
        '-' +
        pad(d.getMonth() + 1) +
        '-' +
        pad(d.getDate()) +
        ' ' +
        pad(d.getHours()) +
        ':' +
        pad(d.getMinutes())
      );
    } catch {
      return String(v);
    }
  }

  /**
   * يضمن أن قيمة السمّية بصيغة G0..G4 أو تُترك كما هي إن كانت نصًا آخر
   * @param {any} v
   * @returns {string}
   */
  function normalizeGrade(v) {
    if (v == null) return '';
    const s = String(v).trim().toUpperCase();
    return /^G[0-4]$/.test(s) ? s : s;
  }

  /**
   * يحوّل Boolean إلى Yes/No نصًا، أو يعيد النص إن كان Yes/No
   * @param {any} v
   * @returns {string}
   */
  function asYesNo(v) {
    if (v === 'Yes' || v === 'No') return v;
    if (typeof v === 'boolean') return v ? 'Yes' : 'No';
    if (v == null || v === '') return '';
    // أي قيمة أخرى نعدّها Truthy ⇒ Yes
    return v ? 'Yes' : 'No';
  }

  /**
   * ترتيب أعمدة CSV المطلوب (مع الأعمدة الجديدة)
   * ملاحظة: إن لم تكن بعض هذه الحقول موجودة في السجلات، ستظهر فارغة.
   */
  const CORE_COLUMNS_ORDER = [
    // تعريفات عامة متوقعة (عدّل حسب حقولك الشائعة)
    'id',
    'date',            // أو assessment_date إن كان اسمك مختلفًا
    'assessment_date', // في حال كانت لدى البعض
    'name',
    'phone',
    'regimen',
    'cycle',
    'stage',
    'diagnosis',
    // السمّيات
    'toxicity',        // overall grade (يبقى كما هو)
    'toxicity_found',  // Yes/No
    'mucositis_grade',
    'diarrhea_grade',
    'neutropenia_grade',
    'other_tox_name',
    'other_tox_grade',
    // حقول شائعة إضافية
    'notes',
    'nausea_grade',
    'vomiting_grade',
    'constipation_grade',
    'pain_score',
    'fatigue_grade',
    'followup_due',
    'created_at',
    'updated_at',
  ];

  /**
   * يبني مصفوفة الأعمدة النهائية:
   * - يبدأ بـ CORE_COLUMNS_ORDER
   * - يضيف أي مفاتيح أخرى ظهرت في السجلات ولم تكن موجودة، للحفاظ على كل البيانات
   * - يضيف extraColumns إن طُلبت
   * @param {Array<Object>} records
   * @param {Array<string>} extraColumns
   * @returns {Array<string>}
   */
  function buildColumns(records, extraColumns) {
    const cols = new Set(CORE_COLUMNS_ORDER);
    // اجمع كل المفاتيح التي قد لا تكون معروفة
    (records || []).forEach((r) => {
      if (r && typeof r === 'object') {
        Object.keys(r).forEach((k) => {
          if (!cols.has(k)) cols.add(k);
        });
      }
    });
    // أعمدة إضافية مخصّصة
    (extraColumns || []).forEach((k) => cols.add(k));

    return Array.from(cols);
  }

  /**
   * يحوّل السجلات إلى CSV نصي
   * @param {Array<Object>} records
   * @param {Object} options
   * @param {Array<string>} [options.extraColumns]  أعمدة إضافية
   * @returns {string}
   */
  function toCSV(records, options = {}) {
    const rows = Array.isArray(records) ? records : [];
    const cols = buildColumns(rows, options.extraColumns);

    // صفّ العناوين
    const header = cols.map(csvEscape).join(',');

    const lines = [header];

    for (const r of rows) {
      const line = cols
        .map((k) => {
          let v = r ? r[k] : '';

          // تحويلات خاصة لبعض الحقول
          if (k === 'date' || k === 'assessment_date' || k === 'created_at' || k === 'updated_at' || k === 'followup_due') {
            v = normalizeDate(v);
          }

          if (k === 'mucositis_grade' || k === 'diarrhea_grade' || k === 'neutropenia_grade' || k === 'other_tox_grade' || k === 'toxicity') {
            v = normalizeGrade(v);
          }

          if (k === 'toxicity_found') {
            v = asYesNo(v);
          }

          return csvEscape(v == null ? '' : v);
        })
        .join(',');

      lines.push(line);
    }

    return lines.join('\r\n');
  }

  /**
   * ينزّل محتوى نص CSV كملف عبر المتصفح
   * @param {string} csvText
   * @param {string} filename
   */
  function downloadCSV(csvText, filename) {
    const name = filename || `assessments_${Date.now()}.csv`;
    const blob = new Blob(['\uFEFF' + csvText], { type: 'text/csv;charset=utf-8;' }); // BOM لدعم Excel
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.setAttribute('href', url);
    a.setAttribute('download', name);
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  /**
   * الواجهة العامة: تصدير السجلات إلى CSV وتنزيله
   * @param {Array<Object>} records
   * @param {string} [filename]
   * @param {Object} [options]
   */
  function exportAssessments(records, filename, options) {
    const csv = toCSV(records, options);
    downloadCSV(csv, filename || 'saved_assessments.csv');
    return csv;
  }

  // كشف الواجهة
  const CSVExporter = {
    toCSV,
    exportAssessments,
    downloadCSV,
  };

  if (typeof window !== 'undefined') {
    window.CSVExporter = CSVExporter;
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = CSVExporter;
  }
})();
