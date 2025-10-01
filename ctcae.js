/* =========================================================================
 * ctcae.js
 * -------------------------------------------------------------------------
 * مرجع خفيف لجزء من CTCAE v5.0:
 * - Mucositis (oral)
 * - Diarrhea
 * - Neutropenia (decreased neutrophils)
 *
 * ماذا يوفّر؟
 * - CTCAE.listTypes()                → ['mucositis','diarrhea','neutropenia']
 * - CTCAE.isValidType(type)          → boolean
 * - CTCAE.isValidGrade(grade)        → boolean  (G0..G4)
 * - CTCAE.describe(type, grade)      → نص الوصف للدرجة
 * - CTCAE.tooltip(type, grade)       → نص مختصر للـ tooltip
 * - CTCAE.getTypeMeta(type)          → { label, grades: {G0:{label,desc}, ...} }
 *
 * ملاحظات:
 * - الوصف موجز/مبسّط “للإرشاد” فقط—ليس بديلاً عن المرجع السريري الكامل.
 * - لا يفرض منطق فرز/علاج. محصور في الوصف والفحص الشكلي.
 * ========================================================================= */

(function () {
  'use strict';

  // ---------------------------
  // بيانات CTCAE موجزة
  // ---------------------------
  const GRADES = ['G0', 'G1', 'G2', 'G3', 'G4'];

  const DB = {
    mucositis: {
      label: 'Mucositis (oral)',
      grades: {
        G0: { label: 'G0', desc: 'لا توجد أعراض.' },
        G1: { label: 'G1', desc: 'ألم خفيف/احمرار؛ لا يؤثر على الأكل أو الشرب بشكل ملحوظ.' },
        G2: { label: 'G2', desc: 'ألم متوسط؛ تعديل بسيط على النظام الغذائي (أطعمة لينة/سائلة).' },
        G3: { label: 'G3', desc: 'ألم شديد؛ عدم القدرة على الأكل الصلب؛ يحتاج دعم (مسكنات/تغذية أنبوبية محتملة).' },
        G4: { label: 'G4', desc: 'مضاعفات مهددة للحياة (مثل فشل مجرى الهواء أو نزف شديد)، تدخل عاجل.' },
      },
    },

    diarrhea: {
      label: 'Diarrhea',
      grades: {
        G0: { label: 'G0', desc: 'لا توجد زيادة عن المعتاد.' },
        G1: { label: 'G1', desc: 'زيادة طفيفة؛ ≤ 4 مرات/يوم فوق المعتاد؛ أعراض خفيفة.' },
        G2: { label: 'G2', desc: '5–6 مرات/يوم فوق المعتاد؛ تقييد بسيط للنشاط؛ يحتاج سوائل فموية.' },
        G3: { label: 'G3', desc: '≥ 7 مرات/يوم؛ سلس/تجفاف؛ يحتاج سوائل و/أو دخول.' },
        G4: { label: 'G4', desc: 'عواقب مهددة للحياة (صدمة/فشل دوراني)، تدخل فوري.' },
      },
    },

    neutropenia: {
      label: 'Neutropenia (ANC)',
      grades: {
        G0: { label: 'G0', desc: 'ANC ضمن الطبيعي.' },
        G1: { label: 'G1', desc: 'ANC أقل من الطبيعي لكن > 1500/µL تقريبًا (خفيفة).' },
        G2: { label: 'G2', desc: 'ANC ~1000–1500/µL (متوسطة).' },
        G3: { label: 'G3', desc: 'ANC ~500–1000/µL (شديدة، خطر عدوى أعلى).' },
        G4: { label: 'G4', desc: 'ANC < 500/µL (شديدة جدًا/مهددة)، خطر عدوى حاد.' },
      },
    },
  };

  // ---------------------------
  // أدوات داخلية
  // ---------------------------
  function up(s) { return String(s || '').trim().toUpperCase(); }

  function isValidType(type) {
    return Object.prototype.hasOwnProperty.call(DB, String(type || '').toLowerCase());
  }

  function isValidGrade(grade) {
    const g = up(grade);
    return GRADES.includes(g);
  }

  function getTypeMeta(type) {
    const k = String(type || '').toLowerCase();
    return DB[k] || null;
  }

  function describe(type, grade) {
    const meta = getTypeMeta(type);
    const g = up(grade);
    if (!meta || !isValidGrade(g)) return '';
    return (meta.grades[g] && meta.grades[g].desc) || '';
  }

  function tooltip(type, grade) {
    const meta = getTypeMeta(type);
    if (!meta) return '';
    const g = up(grade);
    const gl = isValidGrade(g) ? g : '';
    const text = gl ? (meta.grades[g] && meta.grades[g].desc) : '';
    return gl ? `${meta.label} — ${gl}: ${text}` : `${meta.label}`;
  }

  function listTypes() {
    return Object.keys(DB);
  }

  // ---------------------------
  // كشف API
  // ---------------------------
  const CTCAE = {
    listTypes,
    isValidType,
    isValidGrade,
    describe,
    tooltip,
    getTypeMeta,
    GRADES: GRADES.slice(),
  };

  if (typeof window !== 'undefined') {
    window.CTCAE = CTCAE;
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = CTCAE;
  }
})();
