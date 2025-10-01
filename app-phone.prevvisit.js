/* =========================================================================
 * app-phone.prevvisit.js — Previous visit aggregator (UI-only) — (Optimized)
 * =========================================================================
 * Changes:
 * - setPrevOtherFromLatest(id, excludeLogId, excludeCallTime, opts)
 *   accepts { logsForId, assessAll } to avoid extra network requests.
 * ========================================================================= */
(function () {
  'use strict';
  const { $, dmyToSortable } = window.PhoneShared;

  function setPrevOtherFromLatest(id, excludeLogId, excludeCallTime, opts) {
    const nameEl = $('#phone-prev-other-name');
    const gradeEl = $('#phone-prev-other-grade');
    if (nameEl) nameEl.value = '—';
    if (gradeEl) gradeEl.value = '—';

    (async () => {
      const opt = opts || {};
      try {
        let logs = Array.isArray(opt.logsForId) ? opt.logsForId.slice() : null;
        if (!logs) {
          const apiLogs = (window.PhoneShared && PhoneShared.fetchPhoneLogsCached)
            ? await PhoneShared.fetchPhoneLogsCached(id) : [];
          logs = (apiLogs || []).slice();
        }
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

        // fallback from assessments
        const assess = Array.isArray(opt.assessAll) ? opt.assessAll
          : (window.PhoneShared && PhoneShared.fetchAssessmentsCached ? await PhoneShared.fetchAssessmentsCached() : []);
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