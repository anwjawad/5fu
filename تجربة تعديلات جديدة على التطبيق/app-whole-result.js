/* =========================================================================
 * app-whole-result.js — Whole Result modal (fast version)
 * - Uses SheetsAPI.fetchPhoneLogsAll() → single request for all phone logs
 * - Reuses front-end cache from app-sheets.js if available (no double fetch)
 * - UI/UX only, no logic changes to app data model
 * ========================================================================= */

(function(){
  'use strict';
// داخل IIFE وقبل الإغلاق النهائي:
if (typeof window !== 'undefined') {
  window.WholeResult = window.WholeResult || {};
  window.WholeResult.open = openModal;   // ← يعرّض الدالة للعالم
}

  // ------------------------------
  // Helpers
  // ------------------------------
  const $  = (sel, r)=> (r||document).querySelector(sel);
  const $$ = (sel, r)=> Array.from((r||document).querySelectorAll(sel));
  function el(tag, attrs, ...kids){
    const n=document.createElement(tag);
    if(attrs) for(const[k,v] of Object.entries(attrs)){
      if(k==='class' || k==='className') n.className=v||'';
      else if(k==='style' && v && typeof v==='object') Object.assign(n.style,v);
      else if(k==='dataset' && v && typeof v==='object') Object.assign(n.dataset,v);
      else if(k in n) n[k]=v;
      else n.setAttribute(k,v);
    }
    kids.forEach(k=>{ if(k!=null) n.appendChild(typeof k==='string'||typeof k==='number'?document.createTextNode(String(k)):k); });
    return n;
  }
  const pad2 = n => String(n).padStart(2,'0');

  function toDMY(v){
    if (!v && v!==0) return '';
    if (typeof v==='string'){
      const s=v.trim();
      if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) return s;
      const mISO = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
      if (mISO) return `${mISO[3]}/${mISO[2]}/${mISO[1]}`;
      const mDMY = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
      if (mDMY){ const d=+mDMY[1], m=+mDMY[2], y=mDMY[3]; return `${pad2(d)}/${pad2(m)}/${y}`; }
      try{ const d=new Date(s); if(!isNaN(d)) return `${pad2(d.getDate())}/${pad2(d.getMonth()+1)}/${d.getFullYear()}`; }catch(_){}
      return s;
    }
    try{ const d=new Date(v); if(!isNaN(d)) return `${pad2(d.getDate())}/${pad2(d.getMonth()+1)}/${d.getFullYear()}`; }catch(_){}
    return String(v||'');
  }
  function dmyKey(s){ const m=String(s||'').match(/^(\d{2})\/(\d{2})\/(\d{4})$/); return m?`${m[3]}${m[2]}${m[1]}`:''; }
  function ymdKey(s){ const m=String(s||'').match(/^(\d{4})-(\d{2})-(\d{2})$/); return m?`${m[1]}${m[2]}${m[3]}`:''; }
  function safeStr(v){ return (v==null)?'':String(v); }
  function asYN(v){
    if (v==='Yes'||v==='No') return v;
    if (typeof v==='boolean') return v?'Yes':'No';
    if (v==null || v==='') return '';
    const s=String(v).trim().toLowerCase();
    if (s==='yes' || s==='y' || s==='true' || s==='1') return 'Yes';
    if (s==='no'  || s==='n' || s==='false'|| s==='0') return 'No';
    return '';
  }
  function normG(v){ if(v==null||v==='') return ''; const s=String(v).trim().toUpperCase(); if (/^[0-4]$/.test(s)) return 'G'+s; if (/^G[0-4]$/.test(s)) return s; return s; }
  function gNum(v){ const s=normG(v); const m=s.match(/^G([0-4])$/); return m?+m[1]:NaN; }
  function gMax(list){ const nums=(list||[]).map(gNum).filter(n=>!Number.isNaN(n)); if(!nums.length) return ''; return 'G'+Math.max(...nums); }
  function downloadText(name, text, mime){
    const blob = new Blob([text||''], { type: mime || 'text/plain;charset=utf-8;' });
    const url = URL.createObjectURL(blob); const a=document.createElement('a');
    a.href=url; a.download=name||'file.txt'; document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // ------------------------------
  // Styles
  // ------------------------------
  function injectStyles(){
    if ($('#wr_modal_styles')) return;
    const css = `
#btn_whole_result{ padding:8px 12px; border-radius:999px; border:1px solid var(--border); background:var(--pill-bg); font-weight:700; cursor:pointer; }
#wr_modal{ position:fixed; inset:0; z-index:95; display:none; }
#wr_modal.open{ display:block; }
#wr_backdrop{ position:absolute; inset:0; background:rgba(0,0,0,.5); }
#wr_card{ position:relative; z-index:1; width:min(1200px,96vw); height:min(92vh,940px); margin:3vh auto; background:var(--surface); border:1px solid var(--border-strong); border-radius:18px; box-shadow:var(--shadow-2); display:flex; flex-direction:column; overflow:hidden; }
#wr_head{ padding:12px 16px; border-bottom:1px solid var(--border); background:linear-gradient(180deg,var(--surface),rgba(0,0,0,0.08)); position:sticky; top:0; z-index:1; }
#wr_title{ margin:0; font-size:18px; font-weight:800; }
#wr_body{ padding:12px; overflow:auto; height:100%; }
#wr_kpis{ display:grid; grid-template-columns:repeat(auto-fit,minmax(180px,1fr)); gap:10px; margin-bottom:10px; }
.kpi{ background:rgba(255,255,255,0.05); border:1px solid var(--border); border-radius:12px; padding:10px; }
.kpi .num{ font-size:20px; font-weight:800; } .kpi .lbl{ font-size:12px; color:var(--text-muted); }
.wr-filters{ display:flex; gap:8px; flex-wrap:wrap; padding:8px; border:1px solid var(--border); border-radius:12px; background:linear-gradient(90deg,rgba(109,151,115,0.06),rgba(255,186,0,0.05)); margin-bottom:10px; }
.table-host{ border:1px solid var(--border); border-radius:12px; overflow:auto; max-height:360px; }
.table{ width:100%; border-collapse:separate; border-spacing:0; }
.table thead th{ position:sticky; top:0; background:var(--table-header); z-index:1; cursor:pointer; }
.table td,.table th{ padding:8px 10px; border-bottom:1px solid var(--border); }
.sticky-name{ position:sticky; left:0; background:var(--table-row); z-index:2; font-weight:700; }
.pv-wrap{ margin-top:12px; border:1px solid var(--border); border-radius:12px; padding:10px; }
.pv-grid{ display:grid; grid-template-columns:260px 1fr; gap:10px; }
.pv-controls .group{ margin-bottom:8px; }
.pv-host{ border:1px solid var(--border); border-radius:12px; overflow:auto; max-height:340px; }
.pv-table th,.pv-table td{ padding:8px 10px; border-bottom:1px solid var(--border); }
.pv-table thead th{ position:sticky; top:0; background:var(--table-header); }
.badge{ display:inline-flex; gap:6px; padding:4px 8px; border-radius:999px; background:rgba(255,186,0,0.15); color:#FFD977; font-weight:700; font-size:11px; }
.small-muted{ font-size:12px; color:var(--text-muted); }`;
    document.head.appendChild(el('style', { id:'wr_modal_styles' }, css));
  }

  // ------------------------------
  // Inject Whole Result button in Results header
  // ------------------------------
  function hideInlineWholeSectionIfExists(){
    const inline = $('#wr_table')?.closest('section');
    if (inline) inline.style.display='none';
  }
  function ensureWholeButton(){
    const head = $('#results_head');
    if (!head) return false;
    if ($('#btn_whole_result')) return true;
    const right = head.querySelector('.flex.items-center.gap-2') || head;
    const btn = el('button', { id:'btn_whole_result', 'aria-label':'Open whole result summary', title:'Open whole result summary' }, 'Whole Result');
    btn.addEventListener('click', openModal);
    right.insertBefore(btn, right.firstChild);
    return true;
  }
  function waitForResultsAndInject(){
    if (ensureWholeButton()){ hideInlineWholeSectionIfExists(); return; }
    const mo = new MutationObserver(()=>{ if (ensureWholeButton()){ hideInlineWholeSectionIfExists(); mo.disconnect(); } });
    mo.observe(document.body, { childList:true, subtree:true });
  }

  // ------------------------------
  // Data fetch
  // ------------------------------
  async function fetchAssessments(){
    if (!window.SheetsAPI || !window.SheetsAPI.fetchAssessments) throw new Error('SheetsAPI.fetchAssessments not available');
    const rows = await window.SheetsAPI.fetchAssessments();
    (rows||[]).forEach(r=>{
      if (r.assessment_date) r.assessment_date = toDMY(r.assessment_date);
      if (r.followup_due)    r.followup_due    = toDMY(r.followup_due);
    });
    return rows||[];
  }

  // NEW: Fast all-logs fetch + cache reuse
  async function fetchPhoneLogsAllFast(){
    // إن كان الكاش من app-sheets.js موجود، استخدمه فوراً
    try{
      if (window.SheetsAPI && typeof SheetsAPI._cacheGet==='function'){
        const memo = SheetsAPI._cacheGet('phone_all');
        if (memo && Array.isArray(memo)) return memo;
      }
    }catch(_){}

    // اطلب مرّة واحدة من GAS
    if (window.SheetsAPI && typeof SheetsAPI.fetchPhoneLogsAll==='function'){
      try{
        const list = await SheetsAPI.fetchPhoneLogsAll(); // داخليًا سيُخزَّن في الكاش الواجهي
        return Array.isArray(list) ? list : [];
      }catch(e){
        console.warn('[whole] fetchPhoneLogsAll failed, continue without phone logs', e);
        return [];
      }
    }

    // Fallback آمن (لا نبطّئ الواجهة): بدون سجلات
    return [];
  }

  // حوّل قائمة الـ phone logs إلى Map key→array (مفتاح = id أو name عند غياب id)
  function phoneLogsToMap(allLogs){
    const map = new Map();
    (allLogs||[]).forEach(l=>{
      const key = safeStr(l.id||l.patient_id||'').trim() || safeStr(l.name||'').trim();
      if (!key) return;
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(l);
    });
    return map;
  }

  // ------------------------------
  // Whole Result computation
  // ------------------------------
  function groupPatients(assessments){
    const map = new Map();
    (assessments||[]).forEach(r=>{
      const id = safeStr(r.id||r.patient_id).trim();
      const name = safeStr(r.name).trim();
      const key = id || name;
      if (!key) return;
      if (!map.has(key)) map.set(key, { key, id, name, rows: [] });
      map.get(key).rows.push(r);
    });
    return Array.from(map.values());
  }

  function computeWholeRow(pGroup, phoneLogsMap){
    const rows = pGroup.rows.slice();
    rows.sort((a,b)=> dmyKey(a.assessment_date).localeCompare(dmyKey(b.assessment_date)));
    const baseline = rows[0] || {};

    const allGrades = { mucositis:[], neutropenia:[], diarrhea:[], overall:[] };

    rows.forEach(r=>{
      allGrades.mucositis.push(r.mucositis_grade);
      allGrades.neutropenia.push(r.neutropenia_grade);
      allGrades.diarrhea.push(r.diarrhea_grade);
      allGrades.overall.push(r.toxicity);
    });

    const logs = phoneLogsMap.get(pGroup.id) || phoneLogsMap.get(pGroup.name) || [];
    (logs||[]).forEach(l=>{
      allGrades.mucositis.push(l.mucositis);
      allGrades.neutropenia.push(l.neutropenia);
      allGrades.diarrhea.push(l.diarrhea);
      const ov = gMax([l.mucositis,l.neutropenia,l.diarrhea,l.other_tox_grade]);
      allGrades.overall.push(ov);
    });

    const ynOR = (arr)=> {
      const yes = arr.some(v => asYN(v)==='Yes');
      const allNoOrEmpty = arr.every(v => v==='' || asYN(v)==='No');
      return yes ? 'Yes' : (allNoOrEmpty ? 'No' : '');
    };

    const hospDueTox = ynOR([ ...rows.map(r=> r.hospitalization_due_tox), ...logs.map(l=> l.hospitalization_due_tox || l.hospitalization) ]);
    const anyDelay   = ynOR([ ...rows.map(r=> r.delay), ...logs.map(l=> l.delay) ]);
    const anyStop    = ynOR([ ...rows.map(r=> r.stop),  ...logs.map(l=> l.stop) ]);
    const anyDoseMod = ynOR([ ...rows.map(r=> r.dose_modification), ...logs.map(l=> l.dose_modification) ]);

    const toxFoundAssess = ynOR(rows.map(r=> r.toxicity_found));
    const phoneHasTox = (logs||[]).some(l=> [l.mucositis,l.neutropenia,l.diarrhea,l.other_tox_grade].some(x=> gNum(x)>=1));
    const toxEver = (toxFoundAssess==='Yes' || phoneHasTox) ? 'Yes' : (toxFoundAssess==='No' && !phoneHasTox ? 'No' : '');

    const dpEvents = [];
    rows.forEach(r=>{
      const k=dmyKey(r.assessment_date)||'';
      dpEvents.push({ k, present: safeStr(r.dpyd_present).trim(), mut: safeStr(r.dpyd_type).trim() });
    });
    (logs||[]).forEach(l=>{
      const k = ymdKey(safeStr(l.call_time)) || dmyKey(toDMY(l.call_time));
      dpEvents.push({ k, present: safeStr(l.dpyd_present).trim(), mut: safeStr(l.dpyd_type).trim() });
    });
    dpEvents.sort((a,b)=> String(a.k).localeCompare(String(b.k)));
    const dpydPresent = dpEvents.some(e=> asYN(e.present)==='Yes') ? 'Yes' : (dpEvents.every(e=> e.present===''||asYN(e.present)==='No') ? 'No' : '');
    const dpydMutation = (dpEvents.filter(e=> e.mut).slice(-1)[0]||{}).mut || '';

    return {
      name: pGroup.name || '—',
      id:   pGroup.id   || '—',
      age:  safeStr(baseline.age||baseline.patient_age||''),
      sex:  safeStr(baseline.sex||baseline.patient_sex||''),
      cancer:  safeStr(baseline.diagnosis||baseline.cancer_type||''),
      regimen: safeStr(baseline.regimen||''),
      baseline_date: toDMY(baseline.assessment_date||''),
      hosp_due_tox: hospDueTox,
      any_delay:    anyDelay,
      any_stop:     anyStop,
      any_dose_mod: anyDoseMod,
      tox_ever:     toxEver,
      highest_mucositis:  gMax(allGrades.mucositis) || 'G0',
      highest_neutropenia:gMax(allGrades.neutropenia)|| 'G0',
      highest_diarrhea:   gMax(allGrades.diarrhea)  || 'G0',
      highest_overall:    gMax(allGrades.overall)   || 'G0',
      dpyd_present: dpydPresent || 'No',
      dpyd_mutation: dpydMutation || ''
    };
  }

  function computeWholeDataset(assessments, phoneMap){
    const groups = groupPatients(assessments);
    const data = groups.map(g=> computeWholeRow(g, phoneMap));
    return { groups, data };
  }

  // ------------------------------
  // Mini dashboard (whole)
  // ------------------------------
  function renderWholeKPIs(host, rows){
    if (!host) return;
    host.innerHTML='';
    const uniq = rows.length;
    const cnt = f => rows.filter(r=> r[f]==='Yes').length;
    const toxYes = rows.filter(r=> r.tox_ever==='Yes').length;
    const toxPct = uniq ? Math.round(toxYes*100/uniq) : 0;
    const items = [
      ['Total patients', uniq],
      ['Toxicity Yes', `${toxYes} (${toxPct}%)`],
      ['Hospitalized due to tox', cnt('hosp_due_tox')],
      ['Any delay', cnt('any_delay')],
      ['Any stop', cnt('any_stop')],
      ['Dose modification', cnt('any_dose_mod')],
      ['DPYD present', cnt('dpyd_present')],
    ];
    items.forEach(([lbl,val])=>{
      host.appendChild(el('div', { class:'kpi', role:'group', 'aria-label': `${lbl}: ${val}` },
        el('div', { class:'num' }, String(val)),
        el('div', { class:'lbl' }, lbl)
      ));
    });
  }

  // ------------------------------
  // Whole table + filters
  // ------------------------------
  function buildWholeFilters(container){
    if (!container) return;
    container.innerHTML='';
    container.append(
      el('select', { id:'w_year', title:'Baseline year' }, el('option',{value:''},'Year…')),
      el('input', { id:'w_reg', type:'text', placeholder:'Regimen contains…', title:'Regimen' }),
      el('select', { id:'w_sex', title:'Sex' }, el('option',{value:''},'Sex…'), el('option',{value:'M'},'M'), el('option',{value:'F'},'F')),
      el('select', { id:'w_dpyd', title:'DPYD present' },
        el('option',{value:''},'DPYD…'), el('option',{value:'Yes'},'Yes'), el('option',{value:'No'},'No')
      ),
      el('select', { id:'w_tox', title:'Toxicity ever?' },
        el('option',{value:''},'Toxicity…'), el('option',{value:'Yes'},'Yes'), el('option',{value:'No'},'No')
      ),
      el('input', { id:'w_q', type:'search', placeholder:'Search name/id…', style:{minWidth:'200px'} }),
      el('button', { id:'w_reset', class:'btn' }, 'Reset')
    );
  }
  function applyWholeFilters(allRows){
    const fy   = safeStr($('#w_year')?.value||'').trim();
    const freg = safeStr($('#w_reg')?.value||'').toLowerCase();
    const fsex = safeStr($('#w_sex')?.value||'');
    const fdp  = safeStr($('#w_dpyd')?.value||'');
    const ftx  = safeStr($('#w_tox')?.value||'');
    const fq   = safeStr($('#w_q')?.value||'').toLowerCase();
    let rows = allRows.slice();
    if (fy)   rows = rows.filter(r=> (r.baseline_date||'').endsWith('/'+fy));
    if (freg) rows = rows.filter(r=> (r.regimen||'').toLowerCase().includes(freg));
    if (fsex) rows = rows.filter(r=> (r.sex||'')===fsex);
    if (fdp)  rows = rows.filter(r=> (r.dpyd_present||'')===fdp);
    if (ftx)  rows = rows.filter(r=> (r.tox_ever||'')===ftx);
    if (fq)   rows = rows.filter(r=> (r.name||'').toLowerCase().includes(fq) || (r.id||'').toLowerCase().includes(fq));
    return rows;
  }
  function renderWholeTable(tbody, rows){
    if (!tbody) return;
    tbody.innerHTML='';
    if (!rows.length){
      tbody.appendChild(el('tr', null, el('td', {colspan:18}, 'No patients match your filters.')));
      return;
    }
    rows.forEach(r=>{
      const tr = el('tr', null,
        el('td', { class:'sticky-name' }, r.name || '—'),
        el('td', null, r.id   || '—'),
        el('td', null, r.age  || '—'),
        el('td', null, r.sex  || '—'),
        el('td', null, r.cancer || '—'),
        el('td', null, r.regimen || '—'),
        el('td', null, r.baseline_date || '—'),
        el('td', null, r.hosp_due_tox || '—'),
        el('td', null, r.any_delay || '—'),
        el('td', null, r.any_stop || '—'),
        el('td', null, r.any_dose_mod || '—'),
        el('td', null, r.tox_ever || '—'),
        el('td', null, r.highest_mucositis || '—'),
        el('td', null, r.highest_neutropenia || '—'),
        el('td', null, r.highest_diarrhea || '—'),
        el('td', null, r.highest_overall || '—'),
        el('td', null, r.dpyd_present || '—'),
        el('td', null, r.dpyd_mutation || '—'),
      );
      tbody.appendChild(tr);
    });
  }
  function wireWholeSorting(thead, data, rerender){
    if (!thead || thead.dataset.sorted) return;
    thead.dataset.sorted = '1';
    thead.addEventListener('click', (ev)=>{
      const th=ev.target.closest('th'); if(!th) return;
      const key = th.getAttribute('data-key'); if (key==null) return;
      const fields = [
        'name','id','age','sex','cancer','regimen','baseline_date',
        'hosp_due_tox','any_delay','any_stop','any_dose_mod','tox_ever',
        'highest_mucositis','highest_neutropenia','highest_diarrhea','highest_overall',
        'dpyd_present','dpyd_mutation'
      ];
      const f = fields[+key];
      const asc = th.dataset.asc !== 'true';
      th.dataset.asc = asc ? 'true' : 'false';
      data.sort((a,b)=> asc ? String(a[f]||'').localeCompare(String(b[f]||'')) : String(b[f]||'').localeCompare(String(a[f]||'')));
      rerender();
    });
  }

  // ------------------------------
  // Pivot over Whole dataset
  // ------------------------------
  const WHOLE_FIELDS = [
    ['name','Name'], ['id','ID'], ['age','Age'], ['sex','Sex'],
    ['cancer','Cancer type'], ['regimen','Regimen'], ['baseline_date','Baseline date'],
    ['hosp_due_tox','Ever hospitalized'], ['any_delay','Any delay'], ['any_stop','Any stop'],
    ['any_dose_mod','Any dose modification'], ['tox_ever','Toxicity ever found'],
    ['highest_mucositis','Highest Mucositis'], ['highest_neutropenia','Highest Neutropenia'],
    ['highest_diarrhea','Highest Diarrhea'], ['highest_overall','Highest Overall'],
    ['dpyd_present','DPYD present'], ['dpyd_mutation','DPYD mutation']
  ];
  const BOOL_FIELDS  = new Set(['hosp_due_tox','any_delay','any_stop','any_dose_mod','tox_ever','dpyd_present']);
  const GRADE_FIELDS = new Set(['highest_mucositis','highest_neutropenia','highest_diarrhea','highest_overall']);

  function fillPivotWholeControls(root){
    const rowsSel = $('#wh_rows', root), colsSel = $('#wh_cols', root), valField = $('#wh_val_field', root), valAgg = $('#wh_val_agg', root);
    if (!rowsSel || !colsSel || !valField || !valAgg) return;
    rowsSel.innerHTML=''; colsSel.innerHTML=''; valField.innerHTML='';
    WHOLE_FIELDS.forEach(([k,lab])=>{
      rowsSel.appendChild(el('option',{value:k}, lab));
      colsSel.appendChild(el('option',{value:k}, lab));
      valField.appendChild(el('option',{value:k}, lab));
    });
    rowsSel.value='cancer';
    colsSel.value='highest_overall';
    valAgg.value='count';
  }

  function applyPivotWholeFilters(base){
    const y  = safeStr($('#wh_f_year')?.value||'').trim();
    const r  = safeStr($('#wh_f_reg')?.value||'').toLowerCase();
    const sx = safeStr($('#wh_f_sex')?.value||'');
    const dp = safeStr($('#wh_f_dpyd')?.value||'');
    const lg = safeStr($('#wh_f_logic')?.value||''); // any logical field filter Yes/No
    let rows = base.slice();
    if (y)  rows = rows.filter(x=> (x.baseline_date||'').endsWith('/'+y));
    if (r)  rows = rows.filter(x=> (x.regimen||'').toLowerCase().includes(r));
    if (sx) rows = rows.filter(x=> (x.sex||'')===sx);
    if (dp) rows = rows.filter(x=> (x.dpyd_present||'')===dp);
    if (lg){
      const [field,val] = lg.split(':'); if (field && val) rows = rows.filter(x=> (x[field]||'')===val);
    }
    return rows;
  }

  function valueToNum(field, v){
    if (BOOL_FIELDS.has(field))  return (v==='Yes'?1:(v==='No'?0:NaN));
    if (GRADE_FIELDS.has(field)){ const n=gNum(v); return Number.isNaN(n)?NaN:n; }
    const n = +v; return Number.isNaN(n)?NaN:n;
  }

  function renderPivotWhole(root, baseRows){
    const rowsSel=$('#wh_rows', root), colsSel=$('#wh_cols', root), valField=$('#wh_val_field', root), valAgg=$('#wh_val_agg', root);
    const head = $('#wh_pv thead', root), body = $('#wh_pv tbody', root);
    if (!rowsSel || !colsSel || !valField || !valAgg || !head || !body) return;

    head.innerHTML=''; body.innerHTML='';

    const filtered = applyPivotWholeFilters(baseRows);
    const rKey = rowsSel.value || ''; const cKey = colsSel.value || '';
    const vKey = valField.value || ''; const agg = valAgg.value || 'count';

    const rowKeyFn = (row)=> rKey ? String(row[rKey]||'—') : '—';
    const colKeyFn = (row)=> cKey ? String(row[cKey]||'—') : '—';

    // group rows
    const map = new Map(); // rk -> ck -> []
    filtered.forEach(r=>{
      const rk=rowKeyFn(r), ck=colKeyFn(r);
      if (!map.has(rk)) map.set(rk,new Map());
      const m=map.get(rk);
      if (!m.has(ck)) m.set(ck,[]);
      m.get(ck).push(r);
    });

    const colKeys = Array.from(new Set(Array.from(map.values()).flatMap(m=> Array.from(m.keys())))).sort();
    head.appendChild(el('tr', null,
      el('th', null, rKey ? WHOLE_FIELDS.find(x=>x[0]===rKey)?.[1]||rKey : '—'),
      ...colKeys.map(c=> el('th', null, c)),
      el('th', null, 'Total')
    ));

    function cellValue(list){
      if (agg==='count') return list.length;
      if (agg==='%row') return list.length; // converted to % after row total known
      if (agg==='max'){
        const nums = (vKey? list.map(x=> valueToNum(vKey, x[vKey])) : []).filter(n=>!Number.isNaN(n));
        if (!nums.length) return '';
        const m = Math.max(...nums);
        return GRADE_FIELDS.has(vKey) ? `G${m}` : String(m);
      }
      if (agg==='avg'){
        const nums = (vKey? list.map(x=> valueToNum(vKey, x[vKey])) : []).filter(n=>!Number.isNaN(n));
        if (!nums.length) return '';
        const m = nums.reduce((a,b)=>a+b,0)/nums.length;
        return GRADE_FIELDS.has(vKey) ? `≈G${Math.round(m)}` : m.toFixed(2);
      }
      return list.length;
    }

    Array.from(map.keys()).sort().forEach(rk=>{
      const rowMap = map.get(rk);
      const cells=[]; let rowTotal=0;
      colKeys.forEach(ck=>{
        const list=rowMap.get(ck)||[];
        const val = cellValue(list);
        const td = el('td', { style:{cursor:'pointer'} }, String(val||'—'));
        td.addEventListener('click', ()=> openDrill(list));
        td.dataset.count = String(list.length||0);
        cells.push(td);
        rowTotal += list.length;
      });
      if (agg==='%row' && rowTotal>0){
        cells.forEach(td=>{
          const c = +td.dataset.count||0;
          const pct = Math.round((c*100)/rowTotal);
          td.textContent = `${pct}%`;
        });
      }
      const tr = el('tr', null, el('td', null, rk), ...cells, el('td', null, String(rowTotal)));
      body.appendChild(tr);
    });
  }

  function exportTableToCSV(tbl){
    const rows=[];
    tbl.querySelectorAll('tr').forEach(tr=>{
      const cols=Array.from(tr.children).map(td=>{
        const s=(td.textContent||'').trim().replace(/\r?\n/g,' ');
        return /[",]/.test(s)?`"${s.replace(/"/g,'""')}"`:s;
      });
      rows.push(cols.join(','));
    });
    return rows.join('\r\n');
  }
  function exportTableToExcelXML(tbl, sheetName){
    const rows=[];
    tbl.querySelectorAll('tr').forEach(tr=>{
      const cells=Array.from(tr.children).map(td=> `<Cell><Data ss:Type="String">${(td.textContent||'').replace(/&/g,'&amp;').replace(/</g,'&lt;')}</Data></Cell>`).join('');
      rows.push(`<Row>${cells}</Row>`);
    });
    const xml = `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
 <Worksheet ss:Name="${(sheetName||'Sheet1').replace(/"/g,'')}">
  <Table>${rows.join('')}</Table>
 </Worksheet>
</Workbook>`;
    return xml;
  }
  function openDrill(list){
    const wrap=el('div', { class:'modal-wrap' },
      el('div', { class:'modal-overlay', onclick: close }),
      el('div', { class:'modal', style:{ maxWidth:'560px' } },
        el('div', { class:'modal-header' },
          el('div', { class:'flex items-center justify-between' },
            el('h3', { class:'text-lg font-semibold' }, 'Patients'),
            el('button', { class:'btn btn-icon', onclick: close }, '×')
          )
        ),
        el('div', { class:'modal-body' },
          list && list.length ? el('ul', null, ...list.map(r=> el('li', null, `${r.name || '—'} — ${r.id || '—'}`))) : el('div', null, 'No patients.')
        ),
        el('div', { class:'modal-footer' }, el('button', { class:'btn', onclick: close }, 'Close'))
      )
    );
    function close(){ if (wrap && wrap.parentNode) wrap.parentNode.removeChild(wrap); }
    document.body.appendChild(wrap);
  }

  // ------------------------------
  // Modal UI
  // ------------------------------
  function ensureModal(){
    let m = $('#wr_modal');
    if (m) return m;
    m = el('div', { id:'wr_modal', role:'dialog', 'aria-modal':'true', 'aria-labelledby':'wr_title' },
      el('div', { id:'wr_backdrop', onclick: closeModal }),
      el('div', { id:'wr_card' },
        el('div', { id:'wr_head', class:'flex items-center justify-between' },
          el('h3', { id:'wr_title' }, 'Whole Result per patient'),
          el('div', { class:'flex items-center gap-2' },
            el('span', { id:'wr_counter', class:'badge' }, '— patients'),
            el('button', { class:'btn', onclick: closeModal }, 'Close')
          )
        ),
        el('div', { id:'wr_body' },
          el('section', null, el('div', { id:'wr_kpis', 'aria-label':'Mini dashboard (whole result)' })),
          el('section', null,
            el('div', { class:'wr-filters', id:'wr_filters' }),
            el('div', { class:'table-host' },
              el('table', { class:'table', id:'wr_tbl', 'aria-label':'Whole results summary per patient' },
                el('thead', null,
                  el('tr', null,
                    ...['Name','ID','Age','Sex','Cancer (baseline)','Regimen (baseline)','Baseline date',
                       'Ever hospitalized','Any delay','Any stop','Any dose mod.','Toxicity ever?',
                       'Highest Mucositis','Highest Neutropenia','Highest Diarrhea','Highest Overall',
                       'DPYD present','DPYD mutation'
                    ].map((h,i)=> el('th', { 'data-key': String(i) }, h))
                  )
                ),
                el('tbody', null, el('tr', null, el('td',{colspan:18}, 'Loading…')))
              )
            )
          ),
          el('section', { class:'pv-wrap' },
            el('div', { class:'section-title' }, el('h3', null, 'Pivot (Whole Result)')),
            el('div', { class:'pv-grid' },
              el('div', { class:'pv-controls' },
                el('div', { class:'group' }, el('strong', null, 'Fields')),
                el('div', { class:'group' }, el('label', null, 'Rows'),    el('select', { id:'wh_rows', style:{width:'100%', marginBottom:'6px'} })),
                el('div', { class:'group' }, el('label', null, 'Columns'), el('select', { id:'wh_cols', style:{width:'100%', marginBottom:'6px'} })),
                el('div', { class:'group' }, el('label', null, 'Value field'), el('select', { id:'wh_val_field', style:{width:'100%', marginBottom:'6px'} })),
                el('div', { class:'group' }, el('label', null, 'Aggregation'),
                  el('select', { id:'wh_val_agg', style:{width:'100%'} },
                    el('option', {value:'count'}, 'Count'),
                    el('option', {value:'%row'},  '% of row'),
                    el('option', {value:'max'},   'Max'),
                    el('option', {value:'avg'},   'Avg')
                  )
                ),
                el('hr', { class:'divider', style:{margin:'10px 0'} }),
                el('div', { class:'group' }, el('strong', null, 'Filters')),
                el('div', { class:'group' },
                  el('input', { id:'wh_f_year', type:'number', placeholder:'Baseline year', style:{width:'100%', marginBottom:'6px'} }),
                  el('input', { id:'wh_f_reg', type:'text', placeholder:'Regimen contains…', style:{width:'100%', marginBottom:'6px'} }),
                  el('select', { id:'wh_f_sex', style:{width:'100%', marginBottom:'6px'} },
                    el('option', {value:''}, 'Sex…'), el('option',{value:'M'},'M'), el('option',{value:'F'},'F')
                  ),
                  el('select', { id:'wh_f_dpyd', style:{width:'100%', marginBottom:'6px'} },
                    el('option', {value:''}, 'DPYD…'), el('option',{value:'Yes'},'Yes'), el('option',{value:'No'},'No')
                  ),
                  el('select', { id:'wh_f_logic', style:{width:'100%'} },
                    el('option', {value:''}, 'Logical filter…'),
                    ...['hosp_due_tox','any_delay','any_stop','any_dose_mod','tox_ever','dpyd_present'].flatMap(f=>[
                      el('option',{value:`${f}:Yes`}, `${f} = Yes`),
                      el('option',{value:`${f}:No`},  `${f} = No`),
                    ])
                  )
                ),
                el('hr', { class:'divider', style:{margin:'10px 0'} }),
                el('div', { class:'group' },
                  el('button', { id:'wh_export_csv', class:'btn', style:{marginRight:'6px'} }, 'Export CSV'),
                  el('button', { id:'wh_export_xls', class:'btn' }, 'Export Excel (.xls)')
                )
              ),
              el('div', { class:'pv-host' },
                el('table', { class:'table pv-table', id:'wh_pv' },
                  el('thead', null, el('tr', null, el('th', null, '—'))),
                  el('tbody', null, el('tr', null, el('td', null, 'Loading…')))
                )
              )
            )
          )
        )
      )
    );
    document.body.appendChild(m);
    return m;
  }

  // ------------------------------
  // Open / Close
  // ------------------------------
  function openModal(){
    injectStyles();
    const modal = ensureModal();
    modal.classList.add('open');
    loadModalData(modal).catch(e=>{
      console.error('[whole] load failed', e);
      const k = $('#wr_kpis', modal); if (k) k.appendChild(el('div',{class:'small-muted',style:{color:'#E05353'}}, 'Failed to load. Try again.'));
    });
  }
  function closeModal(){ $('#wr_modal')?.classList.remove('open'); }

  // ------------------------------
  // Load & wire (FAST path)
  // ------------------------------
  async function loadModalData(root){
    // Clear placeholders (null-safe)
    const kEl = $('#wr_kpis', root); if (kEl) kEl.innerHTML = '';
    const tb  = $('#wr_tbl tbody', root); if (tb) tb.innerHTML = '';
    const ph  = $('#wh_pv thead', root); if (ph) ph.innerHTML = '';
    const pb  = $('#wh_pv tbody', root); if (pb) pb.innerHTML = '';

    // Fetch in parallel: Assessments + PhoneLogs (all)
    const [assessments, allLogs] = await Promise.all([
      fetchAssessments(),
      fetchPhoneLogsAllFast()
    ]);

    const phoneMap = phoneLogsToMap(allLogs);
    const { data: whole } = computeWholeDataset(assessments, phoneMap);

    // KPIs
    renderWholeKPIs(kEl, whole);

    // Build filters UI first (so elements exist)
    const filtersHost = $('#wr_filters', root);
    buildWholeFilters(filtersHost);

    // Populate baseline year select AFTER building filters (null-safe)
    const years = Array.from(new Set(whole.map(r=> (r.baseline_date||'').slice(-4)).filter(y=>/^\d{4}$/.test(y)))).sort();
    const selYear = $('#w_year', root);
    if (selYear) selYear.innerHTML = '<option value="">Year…</option>'+ years.map(y=>`<option>${y}</option>`).join('');

    // Table state
    const tableBody = $('#wr_tbl tbody', root);
    const state = { all: whole.slice(), filtered: whole.slice() };

    function rerenderTable(){
      state.filtered = applyWholeFilters(state.all);
      const badge = $('#wr_counter', root); if (badge) badge.textContent = `${state.filtered.length} patients`;
      renderWholeTable(tableBody, state.filtered);
    }
    rerenderTable();

    // Wire filters
    ['w_year','w_reg','w_sex','w_dpyd','w_tox','w_q'].forEach(id=>{
      const elx = $('#'+id, root);
      elx?.addEventListener('input', rerenderTable);
      elx?.addEventListener('change', rerenderTable);
    });
    $('#w_reset', root)?.addEventListener('click', ()=>{
      ['w_year','w_reg','w_sex','w_dpyd','w_tox','w_q'].forEach(id=>{ const el=$('#'+id, root); if (el) el.value=''; });
      rerenderTable();
    });

    // Sorting
    wireWholeSorting($('#wr_tbl thead', root), state.filtered, rerenderTable);

    // Pivot controls + render
    fillPivotWholeControls(root);
    function rerenderPivot(){ renderPivotWhole(root, state.filtered); }
    rerenderPivot();
    ['wh_rows','wh_cols','wh_val_field','wh_val_agg','wh_f_year','wh_f_reg','wh_f_sex','wh_f_dpyd','wh_f_logic'].forEach(id=>{
      const elx = $('#'+id, root);
      elx?.addEventListener('change', rerenderPivot);
      elx?.addEventListener('input',  rerenderPivot);
    });

    // Exports
    $('#wh_export_csv', root)?.addEventListener('click', ()=>{
      const csv = exportTableToCSV($('#wh_pv', root));
      downloadText('whole_pivot.csv', '\uFEFF'+csv, 'text/csv;charset=utf-8;');
    });
    $('#wh_export_xls', root)?.addEventListener('click', ()=>{
      const xml = exportTableToExcelXML($('#wh_pv', root), 'WholePivot');
      downloadText('whole_pivot.xls', xml, 'application/vnd.ms-excel');
    });
  }

  // ------------------------------
  // Boot
  // ------------------------------
  function boot(){
    injectStyles();
    waitForResultsAndInject();
  }
  if (document.readyState==='loading') document.addEventListener('DOMContentLoaded', boot);
  else setTimeout(boot,0);

})();
