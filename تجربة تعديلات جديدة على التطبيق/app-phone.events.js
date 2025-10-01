/* =========================================================================
 * app-phone.events.js — events, save, edit & delete, and due hints (UI-only)
 * ========================================================================= */
(function () {
  'use strict';
  const { fmtDDMMYYYY, copyToClipboard } = window.PhoneShared;

  /* ==============================
   * Small Toast utility (UI-only)
   * ============================== */
  function ensureToastHost(){
    let host = document.getElementById('app_toast_host');
    if (!host){
      host = document.createElement('div');
      host.id = 'app_toast_host';
      host.style.position = 'fixed';
      host.style.insetInlineEnd = '16px';
      host.style.insetBlockStart = '16px';
      host.style.zIndex = '1000';
      host.style.display = 'flex';
      host.style.flexDirection = 'column';
      host.style.gap = '8px';
      document.body.appendChild(host);
    }
    return host;
  }
  function showToast(type, message, {timeout=3500} = {}){
    const host = ensureToastHost();
    const el = document.createElement('div');
    el.setAttribute('role','status');
    el.setAttribute('aria-live','polite');
    el.className = `toast ${type||''}`;
    el.textContent = message || '';
    host.appendChild(el);
    const remove = ()=>{ if (el && el.parentNode) el.parentNode.removeChild(el); };
    if (timeout>0) setTimeout(remove, timeout);
    return { remove };
  }

  /* =========================================
   * Confirm Delete Modal (accessible, UI-only)
   * ========================================= */
  function openConfirmDeleteFollowupModal({ name }, onDeleteConfirm){
    const modalId = 'confirm_delete_followup_modal';
    const titleId = 'confirm_delete_followup_title';

    function el(tag, attrs, ...children){
      const n = document.createElement(tag);
      if (attrs) Object.entries(attrs).forEach(([k,v])=>{
        if (k==='class' || k==='className') n.className = v || '';
        else if (k==='style' && v && typeof v==='object') Object.assign(n.style, v);
        else if (k in n) n[k] = v;
        else n.setAttribute(k, v);
      });
      children.forEach(c => { if (c!=null) n.appendChild(typeof c==='string' ? document.createTextNode(c) : c); });
      return n;
    }

    const wrap = el('div', { class:'modal-wrap', id: modalId },
      el('div', { class:'modal-overlay', onclick: close }),
      el('div', { class:'modal', role:'dialog', 'aria-labelledby': titleId, 'aria-modal':'true', style:{maxWidth:'520px'} },
        el('div', { class:'modal-header' },
          el('div', { class:'flex items-center justify-between' },
            el('h3', { id: titleId, class:'text-lg font-semibold' }, 'Delete follow-up'),
            el('button', { class:'btn btn-icon', title:'Close', onclick: close }, '×')
          )
        ),
        el('div', { class:'modal-body' },
          el('p', null, `Are you sure you want to delete the follow-up for ${name || 'this patient'}? This action cannot be undone.`),
          el('small', { id:'del_err', class:'muted', style:{ color:'#b00020' } }, '')
        ),
        el('div', { class:'modal-footer' },
          el('button', { id:'del_cancel', class:'btn' }, 'Cancel'),
          el('button', { id:'del_confirm', class:'btn btn-danger', 'aria-label':'Confirm delete' }, 'Delete')
        )
      )
    );

    function close(){ if (wrap && wrap.parentNode) wrap.parentNode.removeChild(wrap); }
    document.body.appendChild(wrap);

    const btnCancel  = wrap.querySelector('#del_cancel');
    const btnDelete  = wrap.querySelector('#del_confirm');
    const errLabel   = wrap.querySelector('#del_err');

    function setBusy(on){
      btnCancel.disabled = !!on;
      btnDelete.disabled = !!on;
      btnDelete.setAttribute('aria-busy', on ? 'true' : 'false');
      btnDelete.textContent = on ? 'Deleting…' : 'Delete';
    }

    btnCancel.addEventListener('click', close);
    btnDelete.addEventListener('click', async ()=>{
      setBusy(true);
      errLabel.textContent = '';
      try{
        await onDeleteConfirm({ setBusy });
        close();
        showToast('success', 'Record deleted successfully.');
      }catch(e){
        const msg = String(e && (e.message || e) || 'Failed to delete.');
        if (/404/.test(msg) || /not\s*found/i.test(msg)){
          close();
          showToast('success', 'Record no longer exists.');
        } else if (/403/.test(msg)){
          setBusy(false);
          errLabel.textContent = 'You don’t have permission to delete this record.';
        } else if (/timeout|network/i.test(msg)){
          setBusy(false);
          errLabel.textContent = 'Network error. Please try again.';
        } else if (/409/.test(msg)){
          setBusy(false);
          errLabel.textContent = 'Conflict detected. Please refresh and try again.';
        } else {
          setBusy(false);
          errLabel.textContent = 'Failed to delete. Please try again.';
        }
      }
    });

    setTimeout(()=> btnCancel && btnCancel.focus(), 0);
  }

  function computeNextDueFromUI() {
    const datePicked = document.getElementById('ph_reschedule_date')?.value;
    if (datePicked) return datePicked;

    const sel = Array.from(document.querySelectorAll('input[name="ph_reschedule"]')).find(r=>r.checked);
    const val = sel && sel.value;
    if (!val || val === 'none') return '';

    const today = new Date();
    const p = (n)=>String(n).padStart(2,'0');
    const toISO = (d)=>`${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}`;
    const addDays = (n)=>{ const d=new Date(today); d.setDate(d.getDate()+n); return d; };

    if (val === '1w')  return toISO(addDays(7));
    if (val === '2w')  return toISO(addDays(14));
    if (val === '3w')  return toISO(addDays(21));
    if (val === '4w')  return toISO(addDays(28));
    return '';
  }

  function setDueBadgeText(text){
    const badge = document.getElementById('ph_due_badge');
    if (!badge) return;
    if (text){
      badge.textContent = `will set next due: ${text}`;
      badge.classList.remove('hidden');
    } else {
      badge.textContent = '';
      badge.classList.add('hidden');
    }
  }

  function updateRescheduleHint() {
    const d = computeNextDueFromUI();
    const hint = document.getElementById('ph_reschedule_hint');
    if (hint) hint.textContent = d ? `→ will set next due: ${d}` : '';
    setDueBadgeText(d);
  }

  function addHeaderEmphasisByDue(dueYmdOrDmy){
    const header = document.querySelector('#phone-modal .modal-header');
    if (!header) return;
    header.classList.remove('warn','alert');
    if (!dueYmdOrDmy) return;

    const d = fmtDDMMYYYY(dueYmdOrDmy);
    const p=(n)=>String(n).padStart(2,'0');
    const now=new Date(); const today=`${p(now.getDate())}/${p(now.getMonth()+1)}/${now.getFullYear()}`;

    function toKey(s){ return s ? s.slice(6,10)+s.slice(3,5)+s.slice(0,2) : ''; }
    const keyD = toKey(d), keyT = toKey(today);
    if (keyD && keyT){
      if (keyD === keyT) header.classList.add('warn');        // today → warn
      else if (keyD < keyT) header.classList.add('alert');    // overdue → alert
    }
  }

  function fillDueHint(followup_due) {
    const h = document.getElementById('phone-due-hint');
    if (!h) return;
    h.textContent = followup_due ? `— next due ${fmtDDMMYYYY(followup_due)}` : '';
    addHeaderEmphasisByDue(followup_due);
  }

  function setPhoneChip(phone){
    const chip = document.getElementById('ph_phone_chip');
    const call = document.getElementById('ph_call_phone');
    const copy = document.getElementById('ph_copy_phone');
    const display = phone || '—';
    if (chip) chip.textContent = display;
    if (call) call.href = phone ? `tel:${phone}` : '#';
    if (copy) copy.onclick = async ()=>{ if (phone){ const ok = await copyToClipboard(phone); if (ok) copy.textContent='✅'; setTimeout(()=>copy.textContent='📋',800); } };
  }

  function fillFormFromRow(r){
    const set = (id,val)=>{ const el=document.getElementById(id); if (el) el.value = (val==null?'':String(val)); };
    set('ph_diarrhea',  r.diarrhea);
    set('ph_mucositis', r.mucositis);
    set('ph_neutropenia', r.neutropenia);
    set('ph_fever', r.fever);

    set('ph_hosp', r.hospitalization);
    set('ph_hosp_due_tox', r.hospitalization_due_tox);
    set('ph_delay', r.delay);
    set('ph_stop', r.stop);
    set('ph_dose_mod', r.dose_modification);
    document.getElementById('ph_dose_red') && (document.getElementById('ph_dose_red').value = (r.dose_reduction_pct==null?'':r.dose_reduction_pct));

    set('ph_other_name', r.other_tox_name);
    set('ph_other_grade', r.other_tox_grade);

    const dpSel = document.getElementById('ph_dpyd_present');
    const dpInp = document.getElementById('ph_dpyd_type');
    if (dpSel && !dpSel.disabled) dpSel.value = r.dpyd_present || '';
    if (dpInp && !dpInp.disabled) dpInp.value = r.dpyd_type || '';

    document.getElementById('ph_notes') && (document.getElementById('ph_notes').value = r.notes || '');
  }

  function setEditHint(on, dateText){
    const hint = document.getElementById('ph_edit_hint');
    const btn  = document.getElementById('btn-save-phone');
    if (!hint || !btn) return;
    if (on){
      hint.textContent = `Editing existing entry (${dateText || ''}) — saving will update this log`;
      btn.textContent  = 'Save Changes';
    } else {
      hint.textContent = '';
      btn.textContent  = 'Save Phone Follow-up';
    }
  }

  function makeWireEvents({ getState, setState, setPrevOtherFromLatest, refreshPrev, setDpydLockUI }) {
    async function deleteRow(row){
      openConfirmDeleteFollowupModal({ name: row.name || '' }, async ()=>{
        if (!window.SheetsAPI || !window.SheetsAPI.deletePhoneLog){
          throw new Error('SheetsAPI.deletePhoneLog not available');
        }
        const res = await window.SheetsAPI.deletePhoneLog({ log_id: row.log_id });
        if (!(res && (res.ok !== false))) {
          const msg = (res && (res.error || res.message)) ? String(res.error || res.message) : 'Failed to delete.';
          throw new Error(msg);
        }
        const st = getState();
        await refreshPrev(st);
        setPrevOtherFromLatest(st.id, null, null);
        setEditHint(false);
      });
    }

    function enterEdit(row){
      const st = getState();
      st.editLogId = row.log_id || row.id;
      st.editCallTime = row.call_time || '';
      setState(st);
      fillFormFromRow(row);
      setEditHint(true, fmtDDMMYYYY(row.call_time));
    }

    return function wireEvents() {
      const state = getState();
      const close = () => window.PhoneUI && window.PhoneUI.close();
      document.getElementById('btn-close-phone')?.addEventListener('click', close);
      document.getElementById('btn-close-phone-2')?.addEventListener('click', close);

      const nm = document.getElementById('ph_patient_name'); if (nm) nm.textContent = state.name || '—';
      const title = document.getElementById('ph_title'); if (title && state.name) title.textContent = `Phone Assessment — ${state.name}`;
      fillDueHint(state.followup_due);

      Array.from(document.querySelectorAll('input[name="ph_reschedule"]')).forEach(r => r.addEventListener('change', updateRescheduleHint));
      const dt = document.getElementById('ph_reschedule_date'); if (dt) dt.addEventListener('change', updateRescheduleHint);
      updateRescheduleHint();

      document.getElementById('btn-save-phone')?.addEventListener('click', async () => {
        try {
          if (!window.SheetsAPI || !window.SheetsAPI.savePhoneLog) { alert('SheetsAPI.savePhoneLog is not available.'); return; }

          const nextDue = computeNextDueFromUI();
          const current = getState();
          const editing = !!current.editLogId;

          const log = {
            id: current.id,
            name: current.name || '',
            call_time: editing && current.editCallTime ? current.editCallTime : new Date().toISOString(),
            log_id: editing ? current.editLogId : window.PhoneShared.uuid(),

            diarrhea:    document.getElementById('ph_diarrhea').value || '',
            mucositis:   document.getElementById('ph_mucositis').value || '',
            neutropenia: document.getElementById('ph_neutropenia').value || '',
            fever:       document.getElementById('ph_fever').value || '',

            hospitalization: document.getElementById('ph_hosp').value || '',
            hospitalization_due_tox: document.getElementById('ph_hosp_due_tox').value || '',
            delay:        document.getElementById('ph_delay').value || '',
            stop:         document.getElementById('ph_stop').value || '',
            dose_modification: document.getElementById('ph_dose_mod').value || '',
            dose_reduction_pct: (function(){
              const v = document.getElementById('ph_dose_red').value;
              return v==='' ? '' : Number(v);
            })(),

            other_tox_name:  document.getElementById('ph_other_name').value.trim(),
            other_tox_grade: document.getElementById('ph_other_grade').value || '',

            dpyd_present: document.getElementById('ph_dpyd_present').value || '',
            dpyd_type:    document.getElementById('ph_dpyd_type').value.trim(),

            notes: document.getElementById('ph_notes').value.trim(),
            next_due: nextDue || '',
          };

          const res = await window.SheetsAPI.savePhoneLog(log);
          if (!(res && (res.ok !== false))) { console.error('[phone] savePhoneLog response', res); alert('Failed to save phone follow-up.'); return; }

          if (nextDue && window.SheetsAPI.saveAssessment) {
            await window.SheetsAPI.saveAssessment({ id: current.id, followup_due: nextDue });
          }

          if (!current.dpydLocked) {
            const dpydPresent = (document.getElementById('ph_dpyd_present').value || '');
            const dpydType    = (document.getElementById('ph_dpyd_type').value || '').trim();
            if ((dpydPresent && dpydPresent !== '—') || dpydType) {
              await window.SheetsAPI.saveAssessment({ id: current.id, dpyd_present: dpydPresent, dpyd_type: dpydType });
              setDpydLockUI(dpydPresent, dpydType, current);
              setState(current);
            }
          }

          await refreshPrev(current);
          setPrevOtherFromLatest(current.id, current.editLogId, current.editCallTime);

          current.editLogId = null;
          current.editCallTime = null;
          setState(current);
          setEditHint(false);
          setDueBadgeText('');

          showToast('success', 'Saved.');
        } catch (err) { console.error(err); showToast('error','Save failed, see console.'); }
      });

      window.PhoneParts = window.PhoneParts || {};
      window.PhoneParts.eventsAPI = { enterEdit, deleteRow, setPhoneChip };
    };
  }

  window.PhoneParts = window.PhoneParts || {};
  window.PhoneParts.events = { computeNextDueFromUI, updateRescheduleHint, fillDueHint, makeWireEvents };
})();
