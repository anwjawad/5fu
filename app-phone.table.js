/* =========================================================================
 * app-phone.table.js — previous phone follow-ups table (UI-only)
 * =========================================================================
 * - بدون أي wrappers خارجية للسكرول. الجدول نفسه عليه overflow (styles.css).
 * - يدعم Flexible controls (إن وُجدت) عبر #ph_ft_width / #ph_ft_height.
 * ========================================================================= */
(function () {
  'use strict';
  const { $, el, fmtDDMMYYYY, dmyToSortable } = window.PhoneShared;
  const { dpydCompact } = (window.PhoneParts && window.PhoneParts.dpyd) || {};

  let handlers = { onEdit: null, onDelete: null };

  // Hook للـ Flexible controls داخل المودال
  (function initFlex(){
    const root = document.documentElement;
    const apply = ()=>{
      const w = $('#ph_ft_width')?.value;
      const h = $('#ph_ft_height')?.value;
      if (w) root.style.setProperty('--ft-width', w + '%');
      if (h) root.style.setProperty('--ft-height', h + 'px');
    };
    $('#ph_ft_width')?.addEventListener('input', apply);
    $('#ph_ft_height')?.addEventListener('input', apply);
    apply();
  })();

  function setPrevCountBadge(value) {
    const badge = $('#ph_prev_count_badge');
    if (!badge) return;
    const text = (value === null || value === undefined) ? '—' : String(value);
    badge.textContent = text;
    badge.setAttribute('aria-label', `Phone follow-ups count: ${text}`);
  }

  function actionsCell(row){
    const wrap = el('div', { class:'flex items-center gap-1' });

    const edit = el('button', { class:'btn btn-sm', title:'Edit', 'aria-label': `Edit follow-up for ${row.name || 'patient'}` }, '✏️');
    edit.addEventListener('click', (ev)=>{ ev.stopPropagation(); handlers.onEdit && handlers.onEdit(row); });

    const del = el('button', { class:'btn btn-danger btn-sm', title:'Delete', 'aria-label': `Delete follow-up for ${row.name || 'patient'}` }, '🗑️');
    del.addEventListener('click', (ev)=>{ ev.stopPropagation(); handlers.onDelete && handlers.onDelete(row); });

    wrap.appendChild(edit); wrap.appendChild(del);
    return wrap;
  }

  function isToday(ymdOrDmy){
    const dmy = fmtDDMMYYYY(ymdOrDmy);
    const now = new Date(); const p=(n)=>String(n).padStart(2,'0');
    const today = `${p(now.getDate())}/${p(now.getMonth()+1)}/${now.getFullYear()}`;
    return dmy === today;
  }
  function isOverdue(ymdOrDmy){
    const v = dmyToSortable(fmtDDMMYYYY(ymdOrDmy));
    const now = new Date(); const p=(n)=>String(n).padStart(2,'0');
    const today = `${now.getFullYear()}${p(now.getMonth()+1)}${p(now.getDate())}`;
    return /^\d{8}$/.test(v) && v < today;
  }

  function fillPrevTable(rows) {
    const tb = $('#ph_prev_tbody');
    tb.innerHTML = '';
    if (!rows || !rows.length) {
      tb.appendChild(el('tr', null, el('td', { colspan: 10 }, 'No phone follow-ups yet.')));
      setPrevCountBadge(0);
      return;
    }
    rows.forEach(r => {
      const tr = el('tr', null,
        el('td', null, fmtDDMMYYYY(r.call_time)),
        el('td', null, r.diarrhea || '—'),
        el('td', null, r.mucositis || '—'),
        el('td', null, r.neutropenia || '—'),
        el('td', null, r.fever || '—'),
        el('td', null, dpydCompact && dpydCompact(r.dpyd_present, r.dpyd_type) || '—'),
        el('td', null, r.other_tox_name || '—'),
        el('td', null, r.other_tox_grade || '—'),
        el('td', null, r.next_due ? fmtDDMMYYYY(r.next_due) : '—'),
        el('td', null, actionsCell(r))
      );

      if (r.next_due){
        if (isToday(r.next_due)) tr.classList.add('row-due-today');
        else if (isOverdue(r.next_due)) tr.classList.add('row-overdue');
      }

      tr.addEventListener('click', ()=> openPrevRowModal(r));
      tb.appendChild(tr);
    });
    setPrevCountBadge(rows.length);
  }

  function openPrevRowModal(r){
    const wrap = el('div', { class:'modal-wrap' },
      el('div', { class:'modal-overlay', onclick: close }),
      el('div', { class:'modal' },
        el('div', { class:'modal-header' },
          el('div', { class:'flex items-center justify-between' },
            el('h3', { class:'text-lg font-semibold' }, `Phone follow-up — ${fmtDDMMYYYY(r.call_time)}`),
            el('button', { class:'btn btn-icon', title:'Close', onclick: close }, '×')
          )
        ),
        el('div', { class:'modal-body' },
          el('div', { class:'grid', style:'grid-template-columns:repeat(2,1fr); gap:12px;' },
            el('div', { class:'card soft' },
              el('div', { class:'section-title' }, el('h3', null, 'Symptoms')),
              el('p', null, `Diarrhea: ${r.diarrhea || '—'}`),
              el('p', null, `Mucositis: ${r.mucositis || '—'}`),
              el('p', null, `Neutropenia: ${r.neutropenia || '—'}`),
              el('p', null, `Fever: ${r.fever || '—'}`),
              el('p', null, `Other toxicity: ${r.other_tox_name || '—'} (${r.other_tox_grade || '—'})`)
            ),
            el('div', { class:'card soft' },
              el('div', { class:'section-title' }, el('h3', null, 'DPYD & Decisions')),
              el('p', null, `DPYD: ${dpydCompact && dpydCompact(r.dpyd_present, r.dpyd_type) || '—'}`),
              el('p', null, `Hospitalization: ${r.hospitalization || '—'}`),
              el('p', null, `Hospitalization due tox: ${r.hospitalization_due_tox || '—'}`),
              el('p', null, `Delay: ${r.delay || '—'}`),
              el('p', null, `Stop: ${r.stop || '—'}`),
              el('p', null, `Dose modification: ${r.dose_modification || '—'}`)
            )
          )
        ),
        el('div', { class:'modal-footer' },
          el('button', { class:'btn' , onclick: close }, 'Close')
        )
      )
    );
    function close(){ if (wrap && wrap.parentNode) wrap.parentNode.removeChild(wrap); }
    document.body.appendChild(wrap);
  }

  // refreshPrev(state, { logsForId })
  async function refreshPrev(state, opts){
    const id = state && state.id;
    let rows = [];
    const opt = opts || {};
    try{
      if (Array.isArray(opt.logsForId)) rows = opt.logsForId.slice();
      else if (window.PhoneShared && PhoneShared.fetchPhoneLogsCached) rows = await PhoneShared.fetchPhoneLogsCached(id);
      else if (window.SheetsAPI && SheetsAPI.fetchPhoneLogs) rows = await SheetsAPI.fetchPhoneLogs(id);
    }catch(e){ rows = []; }
    rows.sort((a,b)=> dmyToSortable(b.call_time).localeCompare(dmyToSortable(a.call_time)));
    fillPrevTable(rows);
    return rows;
  }

  function setHandlers(h){ handlers = Object.assign(handlers, h||{}); }

  window.PhoneParts = window.PhoneParts || {};
  window.PhoneParts.table = { refreshPrev, setHandlers };
})();
