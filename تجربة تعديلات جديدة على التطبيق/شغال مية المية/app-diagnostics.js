/* =========================================================================
 * app-diagnostics.js
 * -------------------------------------------------------------------------
 * زر "Diagnostics" عائم + مجموعة اختبارات تكامل للتطبيق.
 *
 * ماذا يفعل؟
 * 1) يضيف زرًا عائمًا أسفل/يمين الشاشة بعنوان Diagnostics.
 * 2) عند الضغط، يشغّل اختبارات تحقق من:
 *    - توفر الواجهات (SheetsAPI, CSVExporter, DomHelpers, ToxHelpers, ToxRow, AppData)
 *    - جلب Saved Assessments وفحص الأعمدة الجديدة المطلوبة
 *    - توليد CSV نصي والتأكد من العناوين
 *    - رسم جدول مؤقت للتحقق من عدم حصول أخطاء
 * 3) يكتب نتائج واضحة في لوحة Logs قابلة للنسخ.
 * ========================================================================= */

(function () {
  'use strict';

  // ============== Utilities ==============
  const REQUIRED_COLUMNS = [
    'toxicity',
    'toxicity_found',
    'mucositis_grade',
    'diarrhea_grade',
    'neutropenia_grade',
    'other_tox_name',
    'other_tox_grade',
  ];

  function $(sel, root) { return (root || document).querySelector(sel); }
  function el(tag, attrs, ...children) {
    const node = document.createElement(tag);
    if (attrs && typeof attrs === 'object') {
      Object.entries(attrs).forEach(([k, v]) => {
        if (k === 'class' || k === 'className') node.className = v || '';
        else if (k === 'style' && v && typeof v === 'object') Object.assign(node.style, v);
        else if (k in node) node[k] = v;
        else node.setAttribute(k, v);
      });
    }
    for (const c of children) {
      if (c == null) continue;
      node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    }
    return node;
  }

  function now() {
    const d = new Date();
    const p = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
  }

  // ============== UI ==============
  function ensureDiagUI() {
    if ($('#diag-fab')) return;

    // زر عائم
    const fab = el('button', {
      id: 'diag-fab',
      class: 'btn btn-primary',
      style: {
        position: 'fixed',
        right: '16px',
        bottom: '16px',
        zIndex: 60,
        boxShadow: '0 6px 16px rgba(2,6,23,.2)',
        borderRadius: '999px',
        padding: '.65rem 1rem',
      },
      title: 'Run diagnostics',
    }, 'Diagnostics');

    // لوحة النتائج
    const panel = el(
      'div',
      {
        id: 'diag-panel',
        class: 'card',
        style: {
          position: 'fixed',
          right: '16px',
          bottom: '76px',
          width: 'min(520px, calc(100vw - 2rem))',
          maxHeight: '60vh',
          overflow: 'hidden',
          display: 'none',
          zIndex: 59,
          background: '#fff',
        },
      },
      el('div', { class: 'flex items-center justify-between', style: { marginBottom: '.5rem' } },
        el('h3', { class: 'text-lg font-semibold' }, 'Diagnostics Log'),
        el('div', { class: 'flex items-center gap-2' },
          el('button', { id: 'diag-copy', class: 'btn btn-sm', title: 'Copy' }, 'Copy'),
          el('button', { id: 'diag-close', class: 'btn btn-sm', title: 'Close' }, 'Close')
        )
      ),
      el('pre', {
        id: 'diag-log',
        class: 'mono',
        style: {
          background: '#0b1220',
          color: '#e5e7eb',
          borderRadius: '8px',
          padding: '.75rem',
          margin: 0,
          overflow: 'auto',
          maxHeight: '48vh',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
        }
      })
    );

    document.body.appendChild(fab);
    document.body.appendChild(panel);

    // أحداث
    fab.addEventListener('click', runDiagnostics);
    $('#diag-close').addEventListener('click', () => panel.style.display = 'none');
    $('#diag-copy').addEventListener('click', () => {
      const txt = $('#diag-log').textContent || '';
      navigator.clipboard.writeText(txt).then(
        () => alert('Diagnostics copied to clipboard.'),
        () => alert('Copy failed.')
      );
    });
  }

  function logLine(s) {
    const log = $('#diag-log');
    if (!log) return;
    log.textContent += (log.textContent ? '\n' : '') + s;
    log.scrollTop = log.scrollHeight;
  }

  // ============== Checks ==============
  async function runDiagnostics() {
    const panel = $('#diag-panel');
    const log = $('#diag-log');
    if (!panel || !log) return;
    log.textContent = '';
    panel.style.display = 'block';

    logLine(`[Diagnostics] ${now()}`);

    // 1) وجود الواجهات
    const apis = [
      ['SheetsAPI', ['fetchAssessments', 'saveAssessment', 'deleteAssessmentCascade', 'fetchPhoneLogs', 'savePhoneLog']],
      ['CSVExporter', ['toCSV', 'exportAssessments']],
      ['DomHelpers', ['renderSavedAssessmentsTable']],
      ['ToxHelpers', ['sanitizeAssessmentRecord', 'computeOverall', 'computeFound']],
      ['ToxRow', ['init', 'getValues', 'setValues', 'computeNow']],
      ['AppData', ['APP_CONFIG', 'ASSESSMENT_COLUMNS', 'PHONE_LOG_COLUMNS']],
    ];

    for (const [name, methods] of apis) {
      const okObj = (typeof window[name] === 'object' || typeof window[name] === 'function');
      logLine(`- ${name}: ${okObj ? 'OK' : 'MISSING'}`);
      if (okObj) {
        for (const m of methods) {
          const ok = (typeof window[name][m] !== 'undefined');
          logLine(`   • ${m}: ${ok ? 'OK' : 'MISSING'}`);
        }
      }
    }

    // 2) جلب Saved Assessments
    let records = [];
    if (window.SheetsAPI && typeof window.SheetsAPI.fetchAssessments === 'function') {
      try {
        records = await window.SheetsAPI.fetchAssessments();
        logLine(`- fetchAssessments(): OK — ${Array.isArray(records) ? records.length : 0} rows`);
      } catch (e) {
        logLine(`- fetchAssessments(): FAIL — ${e.message}`);
      }
    } else {
      logLine('- fetchAssessments(): SKIPPED — API missing');
    }

    // 3) فحص الأعمدة الجديدة في البيانات
    if (Array.isArray(records) && records.length) {
      const sample = records.slice(0, 3);
      const keys = new Set();
      sample.forEach(r => Object.keys(r || {}).forEach(k => keys.add(k)));
      REQUIRED_COLUMNS.forEach(col => {
        logLine(`   • has "${col}": ${keys.has(col) ? 'YES' : 'NO'}`);
      });
    } else {
      logLine('   • (no rows to inspect)');
    }

    // 4) بناء CSV والتأكد من الأعمدة
    if (window.CSVExporter && typeof window.CSVExporter.toCSV === 'function') {
      try {
        const subset = (records || []).slice(0, 5);
        const csv = window.CSVExporter.toCSV(subset);
        const header = (csv.split(/\r?\n/)[0] || '').split(',');
        const headerStr = header.join(',').toLowerCase();
        const need = REQUIRED_COLUMNS.slice().concat(['toxicity']);
        const miss = need.filter(col => headerStr.indexOf(col.toLowerCase()) === -1);
        logLine(`- CSV header: ${header.length} columns; missing = ${miss.length ? miss.join(' | ') : 'none'}`);
      } catch (e) {
        logLine(`- CSV build: FAIL — ${e.message}`);
      }
    } else {
      logLine('- CSV build: SKIPPED — CSVExporter.toCSV missing');
    }

    // 5) رسم جدول مؤقّت للتحقق من DomHelpers
    if (window.DomHelpers && typeof window.DomHelpers.renderSavedAssessmentsTable === 'function') {
      try {
        // عنصر مخفي
        let host = $('#diag-table-host');
        if (!host) {
          host = el('div', { id: 'diag-table-host', style: { display: 'none' } });
          document.body.appendChild(host);
        }
        const sample = (records || []).slice(0, 5);
        window.DomHelpers.renderSavedAssessmentsTable(host, sample, { enableExportButton: false });
        logLine('- Table render: OK');
      } catch (e) {
        logLine(`- Table render: FAIL — ${e.message}`);
      }
    } else {
      logLine('- Table render: SKIPPED — DomHelpers.renderSavedAssessmentsTable missing');
    }

    logLine('— done.');
  }

  // ============== Init ==============
  document.addEventListener('DOMContentLoaded', ensureDiagUI);
})();
