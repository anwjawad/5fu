/* =========================================================================
 * app-phone.prevvisit.js — Previous visit aggregator (UI-only)
 * ========================================================================= */
(function () {
  'use strict';
  const { $, dmyToSortable } = window.PhoneShared;

  function setPrevOtherFromLatest(id, excludeLogId, excludeCallTime) {
    const nameEl = $('#phone-prev-other-name');
    const gradeEl = $('#phone-prev-other-grade');
    if (nameEl) nameEl.value = '—';
    if (gradeEl) gradeEl.value = '—';

    (async () => {
      try {
        const phoneLogs = window.SheetsAPI && window.SheetsAPI.fetchPhoneLogs
          ? await window.SheetsAPI.fetchPhoneLogs(id) : [];
        let logs = (phoneLogs || []).slice();
        logs.sort((x,y)=> dmyToSortable(y.call_time).localeCompare(dmyToSortable(x.call_time)));
        if (excludeLogId || excludeCallTime) {
          logs = logs.filter(r => {
            if (excludeLogId && r.log_id === excludeLogId) return false;
            if (excludeCallTime && r.call_time === excludeCallTime) return false;
            return true;
          });
        }
        if (logs.length > 0) {
          const last = logs[0];
          if (nameEl)  nameEl.value  = (last.other_tox_name || '—');
          if (gradeEl) gradeEl.value = (last.other_tox_grade || '—');
          return;
        }

        const assess = window.SheetsAPI && window.SheetsAPI.fetchAssessments
          ? await window.SheetsAPI.fetchAssessments() : [];
        const a = (assess || []).filter(r => String(r.id||'') === String(id));
        a.sort((x,y)=> String(y.assessment_date||'').localeCompare(String(x.assessment_date||'')));
        const latestAssess = a[0];
        if (latestAssess) {
          if (nameEl)  nameEl.value  = latestAssess.other_tox_name || '—';
          if (gradeEl) gradeEl.value = latestAssess.other_tox_grade || '—';
        }
      } catch (e) { console.warn('[phone] setPrevOtherFromLatest failed', e); }
    })();
  }

  window.PhoneParts = window.PhoneParts || {};
  window.PhoneParts.prevvisit = { setPrevOtherFromLatest };
})();
