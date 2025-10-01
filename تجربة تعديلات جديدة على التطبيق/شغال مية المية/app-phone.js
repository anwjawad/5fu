/* =========================================================================
 * app-phone.js — orchestrator to compose Phone UI parts (UI-only)
 * Public API: window.PhoneUI.open(opts), window.PhoneUI.close()
 * ========================================================================= */
(function () {
  'use strict';
  const { $, fmtDDMMYYYY, fetchPhoneById } = window.PhoneShared;
  const { makeModalSkeleton } = window.PhoneParts.skeleton;
  const { getCanonicalDpyd, setDpydLockUI } = window.PhoneParts.dpyd;
  const { setPrevOtherFromLatest } = window.PhoneParts.prevvisit;
  const { refreshPrev, setHandlers } = window.PhoneParts.table;
  const { makeWireEvents } = window.PhoneParts.events;

  let mounted = null;
  let currentState = null;

  function getState(){ return currentState; }
  function setState(s){ currentState = s; }

  const wireEvents = makeWireEvents({
    getState, setState,
    setPrevOtherFromLatest,
    refreshPrev,
    setDpydLockUI
  });

  async function populatePhoneChip(id, fallbackPhone){
    const phone = fallbackPhone || await fetchPhoneById(id);
    const api = (window.PhoneParts && window.PhoneParts.eventsAPI);
    if (api && api.setPhoneChip) api.setPhoneChip(phone);
  }

  const PhoneUI = {
    async open(opts) {
      const state = { id:(opts&&opts.id)||'', name:(opts&&opts.name)||'', followup_due:(opts&&opts.followup_due)||'', phone:(opts&&opts.phone)||'' };
      if (!state.id) { alert('Missing patient id.'); return; }
      if (mounted) this.close();

      mounted = makeModalSkeleton();
      document.body.appendChild(mounted);
      currentState = { id: state.id, name: state.name, followup_due: state.followup_due, editLogId: null, editCallTime: null, dpydLocked:false, dpydPresent:'', dpydType:'' };

      try {
        const { dpyd_present, dpyd_type } = await getCanonicalDpyd(state.id);
        setDpydLockUI(dpyd_present, dpyd_type, currentState);
      } catch (e) { console.warn('[phone] getCanonicalDpyd failed', e); }

      // Phone chip
      populatePhoneChip(state.id, state.phone || '');

      // Previous visit + table + events
      setPrevOtherFromLatest(state.id, null, null);
      await refreshPrev(state);
      wireEvents();

      // ربط أزرار Edit/Delete القادمة من جدول previous
      const api = (window.PhoneParts && window.PhoneParts.eventsAPI);
      setHandlers({
        onEdit: (row)=> api && api.enterEdit && api.enterEdit(row),
        onDelete: (row)=> api && api.deleteRow && api.deleteRow(row)
      });
    },

    close() { if (mounted && mounted.parentNode) mounted.parentNode.removeChild(mounted); mounted = null; currentState = null; },
  };

  if (typeof window !== 'undefined') window.PhoneUI = PhoneUI;
  if (typeof module !== 'undefined' && module.exports) module.exports = PhoneUI;
})();
