(function(){
  'use strict';

  function $(sel, root){ return (root||document).querySelector(sel); }
  function el(tag, attrs, ...children){
    const n = document.createElement(tag);
    if (attrs && typeof attrs === 'object'){
      for (const [k,v] of Object.entries(attrs||{})){
        if (k === 'class' || k === 'className') n.className = v || '';
        else if (k === 'style' && v && typeof v === 'object') Object.assign(n.style, v);
        else if (k in n) n[k] = v;
        else n.setAttribute(k, v);
      }
    }
    for (const c of children){
      if (c == null) continue;
      if (Array.isArray(c)) c.forEach(ci=>n.appendChild(textOrNode(ci)));
      else n.appendChild(textOrNode(c));
    }
    return n;
  }
  function textOrNode(x){ return (typeof x==='string' || typeof x==='number') ? document.createTextNode(String(x)) : (x || document.createTextNode('')); }
  function toText(v){ if (v==null) return ''; try { return String(v).trim(); } catch { return ''+v; } }
  function pad2(n){ return String(n).padStart(2,'0'); }

  // DMY normalizer
  function normalizeToDMY(val){
    if (val == null || val === '') return '';
    if (typeof val === 'string'){
      const s = val.trim();
      if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) return s;
      if (/^\d{4}-\d{2}-\d{2}T/.test(s)){
        try{ const d=new Date(s); if(!isNaN(d)) return `${pad2(d.getDate())}/${pad2(d.getMonth()+1)}/${d.getFullYear()}`; }catch(_){}
        const m0=s.match(/^(\d{4})-(\d{2})-(\d{2})/); if(m0) return `${pad2(+m0[3])}/${pad2(+m0[2])}/${m0[1]}`;
      }
      let m=s.match(/^(\d{4})-(\d{2})-(\d{2})$/); if(m) return `${pad2(+m[3])}/${pad2(+m[2])}/${m[1]}`;
      m=s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/); if(m){ const a=+m[1], b=+m[2], y=m[3]; if (b>12 && a>=1 && a<=12) return `${pad2(b)}/${pad2(a)}/${y}`; return `${pad2(a)}/${pad2(b)}/${y}`; }
    }
    try{ const d=new Date(val); if(!isNaN(d)) return `${pad2(d.getDate())}/${pad2(d.getMonth()+1)}/${d.getFullYear()}`; }catch(_){}
    return String(val);
  }

  /* ================= Saved Assessments — Flexible controls ================= */
  function injectFlexibleControls(host){
    const controls = el('div', { class:'flexible-controls' },
      el('div', { class:'form-group', style:{maxWidth:'220px'} },
        el('label', null, 'Table width (%)'),
        el('input', { id:'sa_ft_width', type:'range', min:'60', max:'100', step:'1', value:'92' })
      ),
      el('div', { class:'form-group', style:{maxWidth:'220px'} },
        el('label', null, 'Table height (px)'),
        el('input', { id:'sa_ft_height', type:'range', min:'260', max:'720', step:'10', value:'420' })
      )
    );
    host.appendChild(controls);

    const applyVars = ()=>{
      const w = $('#sa_ft_width', host)?.value || '92';
      const h = $('#sa_ft_height', host)?.value || '420';
      document.documentElement.style.setProperty('--ft-width', w + '%');
      document.documentElement.style.setProperty('--ft-height', h + 'px');
    };
    controls.addEventListener('input', applyVars);
    applyVars();
  }

  /* ===================== Saved Assessments Table host ====================== */
  function makeTableHost(host){
    // table itself handles scrolling (no external wrapper)
    const table = el('table', {
      class: 'table',
      id: 'sa_table',
      style: {
        display: 'block',
        width: 'var(--ft-width)',
        minWidth: 'var(--ft-minw)',
        maxHeight: 'var(--ft-height)',
        overflow: 'scroll',
        scrollbarGutter: 'stable both-edges',
        margin: '0 auto'
      }
    });

    const thead = el('thead', null, el('tr', null, ...headersSpec().map((h,i)=>{
      const th = el('th', null, h.title);
      // Solid backgrounds for sticky header
      th.style.background = 'var(--ft-header-solid)';
      if (i === 0){
        th.style.position = 'sticky';
        th.style.left = '0';
        th.style.zIndex = '3';
        th.style.background = 'var(--ft-header-solid)';
        th.style.whiteSpace = 'nowrap';
      }
      return th;
    })));
    // make tbody block to allow internal scroll with sticky header
    const tbody = el('tbody', { id: 'sa_tbody', style:{ display:'block' } });

    // Initial shimmer
    const shimmerHost = el('tr', null, el('td', { colspan: headersSpec().length },
      el('div', null, shimmerRow(), shimmerRow(), shimmerRow())
    ));
    tbody.appendChild(shimmerHost);

    table.appendChild(thead);
    table.appendChild(tbody);

    host.innerHTML = '';
    injectFlexibleControls(host);
    host.appendChild(table);

    return { table, tbody };
  }

  function headersSpec(){
    return [
      { key:'name',            title:'Name' },
      { key:'id',              title:'ID' },
      { key:'followup_due',    title:'Next phone follow-up' },
      { key:'first_date_5fu',  title:'1st date 5FU' },
      { key:'mucositis_grade',   title:'Mucositis' },
      { key:'diarrhea_grade',    title:'Diarrhea' },
      { key:'neutropenia_grade', title:'Neutropenia' },
      { key:'_dpyd',           title:'DPYD' },
      { key:'other_tox_name',  title:'Other tox' },
      { key:'other_tox_grade', title:'Other grade' },
      { key:'_actions',        title:'Actions' },
    ];
  }

  function shimmerRow(){
    return el('div', { class:'shimmer-row' },
      el('div', { class:'shimmer shimmer-line' }),
      el('div', { class:'shimmer shimmer-line' }),
      el('div', { class:'shimmer shimmer-line' }),
      el('div', { class:'shimmer shimmer-line' }),
      el('div', { class:'shimmer shimmer-line' }),
      el('div', { class:'shimmer shimmer-line' }),
      el('div', { class:'shimmer shimmer-line' }),
      el('div', { class:'shimmer shimmer-line' }),
      el('div', { class:'shimmer shimmer-line' }),
      el('div', { class:'shimmer shimmer-line' }),
    );
  }

  function dpydCellValue(r){
    const present = toText(r.dpyd_present);
    const type    = toText(r.dpyd_type);
    if (!present && !type) return '—';
    if (present && type)   return `${present} (${type})`;
    return present || type || '—';
  }

  /* ======================= Edit Modal (unchanged logic) ==================== */
  function openEditAssessmentModal(row, onSave){
    const modalId = 'edit_assessment_modal';
    const old = { ...row };
    const labelId = 'edit_assessment_title';

    // Dropdowns with "Other"
    const CANCER_OPTIONS = [
      '', 'Colon','Rectal','Gastric','Pancreatic','Breast','Head & Neck','Lung','Other',
      'Esophageal','Head & Neck SCC','anal'
    ];
    const REGIMEN_OPTIONS = [
      '', 'FOLFOX','FOLFIRI','FOLFIRINOX','Capecitabine','CapeOX','TPF','PF','FLOT','Other'
    ];
    function selectWithOther(label, baseId, options, initialValue){
      const selId = `edit_${baseId}_select`;
      const inpId = `edit_${baseId}_other`;
      const hidId = `edit_${baseId}`;

      const wrap = el('div', { class:'form-group' },
        el('label', { for: selId }, label),
        el('select', { id: selId },
          ...options.map(op => el('option', { value: op }, op || 'Select…'))
        ),
        el('input', { id: inpId, type:'text', placeholder: `Type ${label.toLowerCase()}…`, style:{ display:'none', marginTop:'.4rem' } }),
        el('input', { id: hidId, type:'hidden' })
      );

      setTimeout(()=>{
        const sel = $('#'+selId, wrap);
        const inp = $('#'+inpId, wrap);
        const hid = $('#'+hidId, wrap);
        function update(){
          const v = sel.value;
          if (v === 'Other'){
            inp.style.display = '';
            hid.value = (inp.value || '').trim();
          } else {
            inp.style.display = 'none';
            hid.value = v || '';
          }
        }
        sel.addEventListener('change', update);
        inp.addEventListener('input', update);

        const current = toText(initialValue);
        if (!current){ sel.value = ''; inp.value = ''; }
        else if (options.includes(current)){ sel.value = current; inp.value = ''; }
        else { sel.value = 'Other'; inp.value = current; }
        update();
      }, 0);

      return wrap;
    }

    const wrap = el('div', { class:'modal-wrap', id: modalId },
      el('div', { class:'modal-overlay', onclick: close }),
      el('div', { class:'modal' },
        el('div', { class:'modal-header' },
          el('div', { class:'flex items-center justify-between' },
            el('h3', { id: labelId, class:'text-lg font-semibold' }, 'Edit assessment record'),
            el('button', { class:'btn btn-icon', title:'Close', onclick: close }, '×')
          )
        ),
        el('div', { class:'modal-body' },
          el('div', { class:'grid', style:'grid-template-columns:repeat(2,1fr); gap:12px;' },
            field('Name','name', old.name || ''),
            field('Phone','phone', old.phone || ''),
            selectWithOther('Regimen','regimen', REGIMEN_OPTIONS, old.regimen || ''),
            field('Stage','stage', old.stage || ''),
            selectWithOther('Cancer type','diagnosis', CANCER_OPTIONS, old.diagnosis || ''),
            dateField('Assessment date','assessment_date', old.assessment_date || '')
          ),
          el('small', { id:'edit_error', class:'muted', style:{color:'#ffb3b3'} }, '')
        ),
        el('div', { class:'modal-footer' },
          el('button', { class:'btn', onclick: close }, 'Cancel'),
          el('button', { id:'edit_save_btn', class:'btn btn-primary', disabled:true }, 'Save')
        )
      )
    );

    function field(label, id, val){
      return el('div', { class:'form-group' },
        el('label', { for: `edit_${id}` }, label),
        el('input', { id:`edit_${id}`, type:'text', value: val })
      );
    }
    function dateField(label, id, val){
      return el('div', { class:'form-group' },
        el('label', { for: `edit_${id}` }, label),
        el('input', { id:`edit_${id}`, type:'date', value: toYMDFromDMY(val) })
      );
    }
    function toYMDFromDMY(v){
      if (!v) return '';
      const s = String(v).trim();
      const mDMY = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
      if (mDMY) return `${mDMY[3]}-${mDMY[2]}-${mDMY[1]}`;
      const mYMD = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
      if (mYMD) return s;
      try{ const d=new Date(s); if(!isNaN(d)) return `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`; }catch(_){}
      return '';
    }

    function close(){ if (wrap && wrap.parentNode) wrap.parentNode.removeChild(wrap); }
    document.body.appendChild(wrap);

    const btn = $('#edit_save_btn', wrap);
    const err = $('#edit_error', wrap);

    function currentPatch(){
      const regimenVal   = toText($('#edit_regimen',wrap)?.value);
      const diagnosisVal = toText($('#edit_diagnosis',wrap)?.value);
      const patch = {
        name: toText($('#edit_name',wrap).value),
        phone: toText($('#edit_phone',wrap).value),
        regimen: regimenVal,
        stage: toText($('#edit_stage',wrap).value),
        diagnosis: diagnosisVal,
        assessment_date: normalizeToDMY($('#edit_assessment_date',wrap).value) || old.assessment_date || ''
      };
      const changed = {};
      Object.keys(patch).forEach(k=>{
        const newVal = patch[k] || '';
        const oldVal = (k==='assessment_date') ? normalizeToDMY(old.assessment_date||'') : toText(old[k]||'');
        if (newVal !== oldVal) changed[k] = newVal;
      });
      return changed;
    }

    function onInputChange(){
      const changed = currentPatch();
      btn.disabled = Object.keys(changed).length === 0;
      err.textContent = '';
    }

    ['name','phone','stage','assessment_date'].forEach(id=>{
      $('#edit_'+id, wrap)?.addEventListener('input', onInputChange);
    });
    ['edit_regimen_select','edit_regimen_other','edit_diagnosis_select','edit_diagnosis_other']
      .forEach(id => $('#'+id, wrap)?.addEventListener('input', onInputChange));

    btn.addEventListener('click', async ()=>{
      const changed = currentPatch();
      if (Object.keys(changed).length === 0) return;
      btn.disabled = true;
      err.textContent = '';
      try{
        await onSave(changed);
        close();
        alert('Record updated successfully.');
      }catch(e){
        btn.disabled = false;
        err.textContent = 'Failed to update record, please try again.';
      }
    });
  }

  // helpers
  function dmyToSortable(s){ const m = String(s||'').match(/^(\d{2})\/(\d{2})\/(\d{4})$/); return m ? `${m[3]}${m[2]}${m[1]}` : '99999999'; }
  function isTodayDMY(s){ const d=new Date(); const t=`${pad2(d.getDate())}/${pad2(d.getMonth()+1)}/${d.getFullYear()}`; return dmyToSortable(s)===dmyToSortable(t); }

  function renderRows(tbody, rows, api){
    tbody.innerHTML = '';
    if (!rows || !rows.length){
      tbody.appendChild(el('tr', null, el('td', { colspan: headersSpec().length }, 'No assessments.')));
      return;
    }
    rows.forEach(r=>{
      const tds = [];
      headersSpec().forEach((h, i)=>{
        if (h.key === '_actions'){
          const callBtn = el('button', { class:'btn btn-sm', title:'Phone', onclick:(ev)=>{ev.stopPropagation(); window.tryOpenPhone && window.tryOpenPhone(r);} }, '📞');
          const editBtn = el('button', {
              class:'btn btn-sm',
              title:'Edit',
              'aria-label': `Edit record for ${r.name || 'patient'}`,
              onclick:(ev)=>{ ev.stopPropagation(); api && api.onEdit && api.onEdit(r); }
            }, '✏️');
          const delBtn  = el('button', { class:'btn btn-danger btn-sm', title:'Delete', onclick:(ev)=>{ev.stopPropagation(); window.tryDeleteAssessment && window.tryDeleteAssessment(r.id);} }, '🗑️');
          tds.push(el('td', null, el('div', { class:'flex items-center gap-1' }, callBtn, editBtn, delBtn)));
          return;
        }
        if (h.key === '_dpyd'){
          tds.push(el('td', null, dpydCellValue(r)));
          return;
        }
        let val = r[h.key] ?? '';
        if (h.key === 'followup_due' || h.key === 'first_date_5fu' || h.key === 'assessment_date') val = normalizeToDMY(val);
        const td = el('td', null, String(val || ''));
        if (i === 0){
          td.style.position = 'sticky';
          td.style.left = '0';
          td.style.zIndex = '2';
          td.style.background = 'var(--ft-firstcol-solid)';
          td.style.whiteSpace = 'nowrap';
          td.style.fontWeight = '700';
          td.style.color = 'var(--accent)';
        }
        tds.push(td);
      });

      const tr = el('tr', null, ...tds);
      tr.setAttribute('data-assessment-date', normalizeToDMY(r.assessment_date || ''));
      if (isTodayDMY(r.followup_due)) tr.classList.add('is-due-today');
      tr.addEventListener('click', ()=> openRowDetailsModal(r));
      tbody.appendChild(tr);
    });
  }

  function buildSavedHeader(toolbarHost){
    const wrap = el('div', { class: 'table-header' });
    wrap.appendChild(el('div', { class:'form-group', style:{minWidth:'220px'} },
      el('label', null, 'Filter by name / ID / phone'),
      el('input', { id:'sa_q', type:'text', placeholder:'e.g., John or 1234', autocomplete:'off' })
    ));
    wrap.appendChild(el('div', { class:'form-group', style:{minWidth:'180px'} },
      el('label', null, 'Review date'),
      el('input', { id:'sa_date', type:'date' })
    ));
    wrap.appendChild(el('label', { class:'filter-chip', title:'Show only rows due today' },
      el('input', { id:'sa_today', type:'checkbox', style:{marginRight:'6px'} }),
      'Today’s follow-up'
    ));
    if (toolbarHost) { toolbarHost.innerHTML=''; toolbarHost.appendChild(wrap); }
  }

  function dmyToSortable2(s){ const m = String(s||'').match(/^(\d{2})\/(\d{2})\/(\d{4})$/); return m ? `${m[3]}${m[2]}${m[1]}` : '99999999'; }
  function isTodayDMY2(s){ const d=new Date(); const t=`${pad2(d.getDate())}/${pad2(d.getMonth()+1)}/${d.getFullYear()}`; return dmyToSortable2(s)===dmyToSortable2(t); }

  function rowMatchesFilters(row, filters){
    if (filters.q){
      const q = filters.q.toLowerCase();
      const hay = [row.name, row.id, row.phone].map(x=>String(x||'').toLowerCase()).join(' ');
      if (!hay.includes(q)) return false;
    }
    if (filters.date){
      const ymd = filters.date;
      const dmy = normalizeToDMY(ymd);
      if (row.followup_due !== dmy) return false;
    }
    if (filters.today){ if (!isTodayDMY2(row.followup_due)) return false; }
    return true;
  }

  function sortByDueThenName(rows){
    rows.sort((a,b)=>{
      const A = dmyToSortable(normalizeToDMY(a.followup_due));
      const B = dmyToSortable(normalizeToDMY(b.followup_due));
      if (A === B) return String(a.name||'').localeCompare(String(b.name||''));
      return A.localeCompare(B);
    });
    return rows;
  }

  function openRowDetailsModal(row){
    const wrap = el('div', { class:'modal-wrap' },
      el('div', { class:'modal-overlay', onclick: close }),
      el('div', { class:'modal' },
        el('div', { class:'modal-header' },
          el('div', { class:'flex items-center justify-between' },
            el('h3', { class:'text-lg font-semibold' }, `Patient — ${row.name || '—'}`),
            el('button', { class:'btn btn-icon', title:'Close', onclick: close }, '×')
          )
        ),
        el('div', { class:'modal-body' },
          (function(){
            const g = String(row.toxicity||'').toUpperCase();
            const sev = g==='G0'||g==='G1' ? 'ok' : (g==='G2' ? 'warn' : (g ? 'danger' : ''));
            return el('div', { class: 'severity-ribbon ' + (sev||'') }, g ? `Overall: ${g}` : 'No overall grade');
          })(),
          el('div', { class:'grid', style:'grid-template-columns:repeat(2,1fr); gap:12px; margin-top:8px;' },
            el('div', { class:'card soft' },
              el('div', { class:'section-title' }, el('h3', null, 'Basics')),
              el('p', null, `ID: ${row.id || '—'}`),
              el('p', null, `Phone: ${row.phone || '—'}`),
              el('p', null, `Sex: ${row.sex || '—'}`),
              el('p', null, `Age: ${row.age || '—'}`),
              el('p', null, `DPYD: ${row.dpyd_present || row.dpyd_type ? ( (row.dpyd_present||'') + (row.dpyd_type?` (${row.dpyd_type})`:'') ) : '—'}`)
            ),
            el('div', { class:'card soft' },
              el('div', { class:'section-title' }, el('h3', null, 'Treatment')),
              el('p', null, `Regimen: ${row.regimen || '—'}`),
              el('p', null, `Stage: ${row.stage || '—'}`),
              el('p', null, `Cancer type: ${row.diagnosis || '—'}`)
            ),
            el('div', { class:'card soft' },
              el('div', { class:'section-title' }, el('h3', null, 'Overall toxicity & notes')),
              el('p', null, `Overall toxicity: ${row.toxicity || '—'}`),
              el('p', null, `Notes: ${row.notes || ''}`)
            ),
            el('div', { class:'card soft' },
              el('div', { class:'section-title' }, el('h3', null, 'Dates')),
              el('p', null, `Assessment date: ${normalizeToDMY(row.assessment_date) || '—'}`),
              el('p', null, `Next phone follow-up: ${normalizeToDMY(row.followup_due) || '—'}`),
              el('p', { style:'color:#b00020;font-weight:600;' }, `1st date 5FU: ${normalizeToDMY(row.first_date_5fu)||'—'}`)
            )
          )
        ),
        el('div', { class:'modal-footer' },
          el('button', { class:'btn', onclick: close }, 'Close')
        )
      )
    );
    function close(){ if (wrap && wrap.parentNode) wrap.parentNode.removeChild(wrap); }
    document.body.appendChild(wrap);
  }

  function renderSavedAssessments(hostSelectors, rawRows){
    let toolbar = $(hostSelectors.toolbar || '#saved_toolbar') || createToolbarAuto();
    let tableHost = $(hostSelectors.table || '#saved-assessments') || createTableAuto();

    const rows = (rawRows || []).map(r => {
      const c = Object.assign({}, r);
      c.assessment_date = normalizeToDMY(c.assessment_date);
      c.followup_due    = normalizeToDMY(c.followup_due);
      c.first_date_5fu  = normalizeToDMY(c.first_date_5fu);
      c.dpyd_present    = toText(c.dpyd_present);
      c.dpyd_type       = toText(c.dpyd_type);
      return c;
    });

    buildSavedHeader(toolbar);
    const { tbody } = makeTableHost(tableHost);

    const q     = toolbar.querySelector('#sa_q');
    const date  = toolbar.querySelector('#sa_date');
    const today = toolbar.querySelector('#sa_today');

    function apply(){
      const filters = {
        q: (q && q.value || '').trim(),
        date: (date && date.value || '').trim(),
        today: !!(today && today.checked),
      };
      const filtered = rows.filter(r => rowMatchesFilters(r, filters));
      sortByDueThenName(filtered);
      renderRows(tbody, filtered, api);
    }

    const api = {
      onEdit: (row)=> {
        const oldRow = { ...row };
        openEditAssessmentModal(row, async (patch)=>{
          const idx = rows.findIndex(r=> String(r.id) === String(row.id));
          if (idx < 0) throw new Error('Row not found');

          const updated = { ...rows[idx], ...patch };
          if (patch.assessment_date) updated.assessment_date = normalizeToDMY(patch.assessment_date);
          rows[idx] = updated;
          apply();

          try{
            if (!window.SheetsAPI || !window.SheetsAPI.updateAssessmentFields){
              throw new Error('SheetsAPI.updateAssessmentFields not available');
            }
            await window.SheetsAPI.updateAssessmentFields(row.id, patch);
          }catch(e){
            rows[idx] = oldRow; // rollback
            apply();
            throw e;
          }
        });
      }
    };

    if (q)     q.addEventListener('input',  apply);
    if (date)  date.addEventListener('change', apply);
    if (today) today.addEventListener('change', apply);

    apply();
  }

  function buildSavedHeader(toolbarHost){
    const wrap = el('div', { class: 'table-header' });
    wrap.appendChild(el('div', { class:'form-group', style:{minWidth:'220px'} },
      el('label', null, 'Filter by name / ID / phone'),
      el('input', { id:'sa_q', type:'text', placeholder:'e.g., John or 1234', autocomplete:'off' })
    ));
    wrap.appendChild(el('div', { class:'form-group', style:{minWidth:'180px'} },
      el('label', null, 'Review date'),
      el('input', { id:'sa_date', type:'date' })
    ));
    wrap.appendChild(el('label', { class:'filter-chip', title:'Show only rows due today' },
      el('input', { id:'sa_today', type:'checkbox', style:{marginRight:'6px'} }),
      'Today’s follow-up'
    ));
    if (toolbarHost) { toolbarHost.innerHTML=''; toolbarHost.appendChild(wrap); }
  }

  function createToolbarAuto(){ const host = el('div', { id:'saved_toolbar', class:'header-bar container' }); document.body.prepend(host); return host; }
  function createTableAuto(){ const host = el('div', { id:'saved_table', class:'container mt-2' }); document.body.appendChild(host); return host; }

  const DomHelpers = { renderSavedAssessments, normalizeToDMY };
  if (typeof window!=='undefined') window.DomHelpers = DomHelpers;
  if (typeof module!=='undefined' && module.exports) module.exports = DomHelpers;
})();
