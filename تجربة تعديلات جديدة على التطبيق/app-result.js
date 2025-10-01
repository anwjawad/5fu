/* =========================================================================
 * app-result.js — Results Dashboard (UI-only, sans Whole Result)
 * -------------------------------------------------------------------------
 * - Floating "Results" badge (independent from Diagnostics).
 * - Overlay "Results" with:
 *    1) Mini Dashboard (KPIs)
 *    2) Assessments per month (Last 12 months / This year)
 *    3) Optional Visualizations: Toxicity distribution, Regimen usage, Stage breakdown
 *    4) Pivot Table (Saved assessments only)
 *
 * - Whole Result موجود في app-whole-result.js (modal منفصل).
 * - إخفاء واجهة Diagnostics (UI فقط).
 * - يستخدم SheetsAPI.fetchPhoneLogsAll() لسرعة التحميل (طلب واحد).
 * ========================================================================= */

(function(){
  'use strict';

  // -------------------------
  // Small DOM / format helpers
  // -------------------------
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

  function toDMY(val){
    if (!val && val!==0) return '';
    if (typeof val==='string'){
      const s=val.trim();
      if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) return s;
      const mIso=s.match(/^(\d{4})-(\d{2})-(\d{2})/);
      if (mIso) return `${mIso[3]}/${mIso[2]}/${mIso[1]}`;
      const mDMY=s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
      if (mDMY){ const d=+mDMY[1],m=+mDMY[2],y=mDMY[3]; return `${pad2(d)}/${pad2(m)}/${y}`; }
      try{ const d=new Date(s); if(!isNaN(d)) return `${pad2(d.getDate())}/${pad2(d.getMonth()+1)}/${d.getFullYear()}`; }catch(_){}
      return s;
    }
    try{ const d=new Date(val); if(!isNaN(d)) return `${pad2(d.getDate())}/${pad2(d.getMonth()+1)}/${d.getFullYear()}`; }catch(_){}
    return String(val||'');
  }
  function dmyKey(s){ const m=String(s||'').match(/^(\d{2})\/(\d{2})\/(\d{4})$/); return m?`${m[3]}${m[2]}${m[1]}`:''; }
  function todayDMY(){ const d=new Date(); return `${pad2(d.getDate())}/${pad2(d.getMonth()+1)}/${d.getFullYear()}`; }
  function asText(v){
    if (v==null) return '—';
    if (typeof v==='string') return v.trim() || '—';
    if (v instanceof Date) return toDMY(v) || '—';
    return String(v);
  }
  function uniq(arr){ return Array.from(new Set(arr)); }
  function csvEscape(v){ if(v==null) return ''; const s=String(v); return /[",\r\n]/.test(s)?'"'+s.replace(/"/g,'""')+'"':s; }
  function downloadText(name, text, mime){
    const blob = new Blob([text||''], { type: mime || 'text/plain;charset=utf-8;' });
    const url = URL.createObjectURL(blob); const a=document.createElement('a');
    a.href=url; a.download=name||'file.txt'; document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // -------------------------
  // Hide Diagnostics (UI only)
  // -------------------------
  function hideDiagnosticsUI(){
    const a = $('#diag-fab'); if (a) a.style.display='none';
    const b = $('#diag-panel'); if (b) b.style.display='none';
  }

  // -------------------------
  // Floating Results Badge
  // -------------------------
  function ensureResultsBadge(){
    if ($('#results-fab')) return;
    const btn = el('button', {
      id:'results-fab',
      class:'btn',
      title:'Open results dashboard',
      'aria-label':'Open results dashboard',
      style:{
        position:'fixed', right:'16px', bottom:'16px',
        zIndex:60, boxShadow:'var(--shadow-1)', borderRadius:'999px',
        padding:'.55rem .9rem', background:'var(--pill-bg)', border:'1px solid var(--border)'
      }
    }, '📊 Results');
    btn.addEventListener('click', openResultsOverlay);
    document.body.appendChild(btn);
  }

  // -------------------------
  // Data fetch
  // -------------------------
  async function fetchAssessmentsFresh(){
    if (!window.SheetsAPI || typeof SheetsAPI.fetchAssessments!=='function') {
      throw new Error('SheetsAPI.fetchAssessments not available');
    }
    const rows = await SheetsAPI.fetchAssessments();
    // normalize display dates
    return (rows||[]).map(r=>{
      const c = Object.assign({}, r);
      c.assessment_date = toDMY(c.assessment_date);
      c.followup_due    = toDMY(c.followup_due);
      return c;
    });
  }

  // NEW: طلب واحد لكل سجلات الهاتف (مع fallback آمن إن لم تتوفر الدالة الجديدة)
  async function fetchAllPhoneLogsFast(){
    try{
      if (window.SheetsAPI && typeof SheetsAPI.fetchPhoneLogsAll==='function'){
        const list = await SheetsAPI.fetchPhoneLogsAll(); // داخليًا فيه Memo cache
        return Array.isArray(list) ? list : [];
      }
    }catch(err){
      console.warn('[results] fetchPhoneLogsAll failed, will fallback to empty.', err);
    }
    return []; // لا نرجع per-id حتى لا نبطّئ الصفحة
  }

  // -------------------------
  // KPIs / Aggregations
  // -------------------------
  function gradeNum(g){ const s=String(g||'').toUpperCase().trim(); const m=s.match(/^G([0-4])$/)||s.match(/^([0-4])$/); return m?+m[1]:NaN; }
  function computeKpis(assess, phoneLogs){
    const ids = uniq((assess||[]).map(r=> String(r.id||'').trim()).filter(Boolean));
    const totalPatients = ids.length;
    const savedAssessments = (assess||[]).length;
    const phoneFollowups = (phoneLogs||[]).length;

    const todayK = dmyKey(todayDMY());
    const eowK = (()=>{ const d=new Date(); const day=d.getDay(); const diff=(day===0?6:6-day); const e=new Date(d); e.setDate(d.getDate()+diff);
      return `${e.getFullYear()}${pad2(e.getMonth()+1)}${pad2(e.getDate())}`; })();

    let dueToday=0, overdue=0, dueWeek=0, next7=0;
    const next7cut = (()=>{ const d=new Date(); d.setDate(d.getDate()+7);
      return `${d.getFullYear()}${pad2(d.getMonth()+1)}${pad2(d.getDate())}`; })();

    (assess||[]).forEach(r=>{
      const k = dmyKey(r.followup_due||'');
      if (!k) return;
      if (k < todayK) overdue++;
      else if (k === todayK) dueToday++;
      if (k>todayK && k<=eowK) dueWeek++;
      if (k>todayK && k<=next7cut) next7++;
    });

    const toxYes = (assess||[]).filter(r=> String(r.toxicity_found||'').toLowerCase()==='yes').length;
    const toxPct = savedAssessments ? Math.round((toxYes/savedAssessments)*100) : 0;

    const cnt = { Mucositis:0, Diarrhea:0, Neutropenia:0, Other:0 };
    (assess||[]).forEach(r=>{
      if (gradeNum(r.mucositis_grade)>0) cnt.Mucositis++;
      if (gradeNum(r.diarrhea_grade)>0) cnt.Diarrhea++;
      if (gradeNum(r.neutropenia_grade)>0) cnt.Neutropenia++;
      if ((asText(r.other_tox_name)||'').trim()!=='—') cnt.Other++;
    });
    const mostCommon = Object.entries(cnt).sort((a,b)=> b[1]-a[1])[0]?.[0] || '—';

    const hosp = (assess||[]).filter(r=> String(r.hospitalization_due_tox||'').toLowerCase()==='yes').length;

    return { totalPatients, savedAssessments, phoneFollowups, dueToday, dueWeek, overdue, next7, toxYes, toxPct, mostCommon, hosp };
  }

  function monthlyCounts(assess, range){
    const map=new Map();
    (assess||[]).forEach(r=>{
      const s = String(r.assessment_date||'').trim();
      const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
      if (!m) return;
      // exclude future/unrealistic dates
      const dkey = `${m[3]}${m[2]}${m[1]}`; const todayKey=dmyKey(toDMY(new Date()));
      if (dkey > todayKey) return;
      const ym = `${m[3]}-${m[2]}`;
      map.set(ym, (map.get(ym)||0)+1);
    });
    if (range==='thisYear'){
      const y = new Date().getFullYear();
      const axis = Array.from({length:12},(_,i)=> `${y}-${pad2(i+1)}`);
      const values = axis.map(k=> map.get(k)||0);
      return { axis, values };
    }
    const now=new Date(); const axis=[];
    for (let i=11;i>=0;i--){
      const d=new Date(now.getFullYear(), now.getMonth()-i, 1);
      axis.push(`${d.getFullYear()}-${pad2(d.getMonth()+1)}`);
    }
    const values = axis.map(k=> map.get(k)||0);
    return { axis, values };
  }

  function distOverall(assess){
    // acceptance: يعتمد على Mucositis/Neutropenia/Diarrhea فقط
    const c = { Mucositis:0, Neutropenia:0, Diarrhea:0 };
    (assess||[]).forEach(r=>{
      if (gradeNum(r.mucositis_grade)>=1) c.Mucositis++;
      if (gradeNum(r.neutropenia_grade)>=1) c.Neutropenia++;
      if (gradeNum(r.diarrhea_grade)>=1) c.Diarrhea++;
    });
    const labels=Object.keys(c); const values=labels.map(k=> c[k]);
    return { labels, values };
  }
  function regimenUsage(assess){
    const map=new Map();
    (assess||[]).forEach(r=>{
      const k=asText(r.regimen||'').trim(); if (!k || k==='—') return;
      map.set(k,(map.get(k)||0)+1);
    });
    const entries = Array.from(map.entries()).sort((a,b)=> b[1]-a[1]).slice(0,12);
    const labels=entries.map(e=>e[0]); const values=entries.map(e=>e[1]);
    return { labels, values };
  }
  function stageBreakdown(assess){
    const stages=['1','2','3','4','—'], yes=new Array(stages.length).fill(0), no=new Array(stages.length).fill(0);
    (assess||[]).forEach(r=>{
      const s=asText(r.stage||''); const label = stages.includes(s)? s : '—';
      const idx=stages.indexOf(label);
      const found=String(r.toxicity_found||'').toLowerCase()==='yes';
      (found?yes:no)[idx]++;
    });
    return { stages, yes, no };
  }

  // -------------------------
  // Drawing (Canvas 2D)
  // -------------------------
  function drawLine(canvas, labels, values){
    if(!canvas) return; const ctx=canvas.getContext('2d'); const W=canvas.width,H=canvas.height;
    ctx.clearRect(0,0,W,H);
    const padL=40,padR=20,padT=18,padB=32, chartW=W-padL-padR, chartH=H-padT-padB;
    const maxV=Math.max(1,...values), stepX=chartW/Math.max(1,(values.length-1));
    // axes
    ctx.strokeStyle='rgba(255,255,255,0.18)'; ctx.lineWidth=1;
    ctx.beginPath(); ctx.moveTo(padL,H-padB); ctx.lineTo(W-padR,H-padB); ctx.moveTo(padL,padT); ctx.lineTo(padL,H-padB); ctx.stroke();
    // grid
    ctx.strokeStyle='rgba(255,255,255,0.10)';
    for(let i=1;i<=4;i++){ const y=padT+chartH*(1-i/4); ctx.beginPath(); ctx.moveTo(padL,y); ctx.lineTo(W-padR,y); ctx.stroke(); }
    // line
    ctx.strokeStyle='#6D9773'; ctx.lineWidth=2; ctx.beginPath();
    values.forEach((v,i)=>{ const x=padL+i*stepX, y=padT+chartH*(1-(v/maxV)); if(i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y); });
    ctx.stroke();
    // points
    ctx.fillStyle='#FFBA00';
    values.forEach((v,i)=>{ const x=padL+i*stepX, y=padT+chartH*(1-(v/maxV)); ctx.beginPath(); ctx.arc(x,y,3,0,Math.PI*2); ctx.fill(); });
    // labels
    ctx.fillStyle='#EAF4EE'; ctx.font='600 11px ui-sans-serif, system-ui'; ctx.textAlign='center';
    labels.forEach((lab,i)=>{ const x=padL+i*stepX; const m=lab.slice(5); if(values.length>8 && i%2!==0) return; ctx.fillText(m,x,H-12); });
    ctx.textAlign='right'; ctx.fillText(String(maxV), padL-6, padT+10);
  }
  function drawBars(canvas, labels, values, colors){
    if(!canvas) return; const ctx=canvas.getContext('2d'); const W=canvas.width,H=canvas.height;
    ctx.clearRect(0,0,W,H);
    const pad=28, chartW=W-pad*2, chartH=H-pad*2, max=Math.max(1,...values);
    const barW=chartW/(values.length*1.5), gap=barW/2;
    ctx.strokeStyle='rgba(255,255,255,0.18)'; ctx.beginPath(); ctx.moveTo(pad,H-pad); ctx.lineTo(W-pad,H-pad); ctx.stroke();
    values.forEach((v,i)=>{
      const x=pad+i*(barW+gap)+gap, h=(v/max)*(chartH*0.9), y=H-pad-h;
      ctx.fillStyle=(colors&&colors[i])||'#6D9773'; ctx.fillRect(x,y,barW,h);
      ctx.fillStyle='#EAF4EE'; ctx.font='600 12px ui-sans-serif, system-ui'; ctx.textAlign='center';
      ctx.fillText(String(v), x+barW/2, y-6); ctx.fillText(labels[i], x+barW/2, H-pad+14);
    });
  }
  function drawDonut(canvas, labels, values){
    if(!canvas) return; const ctx=canvas.getContext('2d'); const W=canvas.width,H=canvas.height;
    ctx.clearRect(0,0,W,H);
    const total=values.reduce((a,b)=>a+b,0)||1, cx=W/2, cy=H/2, R=Math.min(W,H)*0.40, rIn=R*0.60;
    const colors=['#58C58C','#6D9773','#FFBA00','#FF7800','#E05353','#9DB8AA','#A78BFA','#60A5FA'];
    let start=-Math.PI/2;
    values.forEach((v,i)=>{ const ang=(v/total)*Math.PI*2, end=start+ang; ctx.beginPath(); ctx.moveTo(cx,cy); ctx.arc(cx,cy,R,start,end); ctx.closePath(); ctx.fillStyle=colors[i%colors.length]; ctx.fill(); start=end; });
    // hole
    ctx.save(); ctx.globalCompositeOperation='destination-out'; ctx.beginPath(); ctx.arc(cx,cy,rIn,0,Math.PI*2); ctx.fill(); ctx.restore();
    // label
    ctx.fillStyle='#EAF4EE'; ctx.font='600 14px ui-sans-serif'; ctx.textAlign='center';
    const sum=values.reduce((a,b)=>a+b,0);
    ctx.fillText(String(sum), cx, cy+5);
    if (sum===0){
      ctx.font='600 13px ui-sans-serif, system-ui';
      ctx.fillText('No toxicities recorded', cx, cy+26);
    }
  }

  // -------------------------
  // Pivot over Saved assessments
  // -------------------------
  function avgGrade(list){
    const nums = list.map(g=>{ const m=String(g||'').toUpperCase().trim().match(/^G?([0-4])$/); return m?+m[1]:NaN; }).filter(n=>!Number.isNaN(n));
    if (!nums.length) return '';
    const m = nums.reduce((a,b)=>a+b,0)/nums.length;
    return 'G'+Math.round(m);
  }

  const NICE_LABELS = {
    assessment_date: 'Assessment date',
    followup_due: 'Next phone follow-up',
    other_tox_name: 'Other tox',
    other_tox_grade: 'Other grade',
  };

  function resolveColumnKey(field, sampleRow){
    if (field === 'Assessment month') return '__assessment_month__';
    if (field === 'Assessment year')  return '__assessment_year__';
    if (sampleRow && field in sampleRow) return field;
    const fromNice = Object.entries(NICE_LABELS).find(([,label])=> label===field);
    if (fromNice) return fromNice[0];
    return field;
  }
  function valueForField(row, resolvedKey){
    if (resolvedKey === '__assessment_month__'){
      const d = String(row.assessment_date||'');
      const m = d.match(/^(\d{2})\/(\d{2})\/(\d{4})$/); return m ? `${m[3]}-${m[2]}` : '—';
    }
    if (resolvedKey === '__assessment_year__'){
      const d = String(row.assessment_date||'');
      const m = d.match(/^(\d{2})\/(\d{2})\/(\d{4})$/); return m ? m[3] : '—';
    }
    return row[resolvedKey];
  }

  function buildPivot(assess, rowsField, colsField, valAgg, filters){
    const rows=new Map(); const rowSet=new Set(); const colSet=new Set();

    const sampleRow = (assess && assess[0]) || {};
    const rKey = resolveColumnKey(rowsField, sampleRow);
    const cKey = resolveColumnKey(colsField, sampleRow);

    const pass = (r)=>{
      if (filters.year){
        const y = String(toDMY(r.assessment_date||'')).slice(-4);
        if (y !== String(filters.year)) return false;
      }
      if (filters.regimen){
        const v = asText(r.regimen||'');
        if (v !== filters.regimen) return false;
      }
      return true;
    };

    (assess||[]).forEach(r=>{
      if (!pass(r)) return;
      const rkRaw = valueForField(r, rKey);
      const ckRaw = valueForField(r, cKey);
      const rk = asText(rkRaw);
      const ck = asText(ckRaw);
      rowSet.add(rk); colSet.add(ck);
      if (!rows.has(rk)) rows.set(rk,new Map());
      const row=rows.get(rk);
      if (!row.has(ck)) row.set(ck,{count:0, grades:[], names:[]});
      const cell=row.get(ck);
      cell.count++;
      if (r.toxicity) cell.grades.push(r.toxicity);
      if (r.name) cell.names.push(String(r.name));
    });

    const rowLabels=Array.from(rowSet).sort(); const colLabels=Array.from(colSet).sort();
    const matrix=rowLabels.map(rk=>{
      const row=rows.get(rk)||new Map();
      return colLabels.map(ck=>{
        const c=row.get(ck);
        if (!c) return '';
        if (valAgg==='Average grade') return avgGrade(c.grades);
        return String(c.count);
      });
    });

    const drill={};
    rowLabels.forEach((rk,ri)=>{
      const row=rows.get(rk)||new Map();
      colLabels.forEach((ck,ci)=>{ drill[`${ri}:${ci}`]=(row.get(ck)?.names||[]).slice(); });
    });

    return { rowLabels, colLabels, matrix, drill };
  }

  function drawPivotTable(root, rowLabels, colLabels, matrix, drill){
    const thead = $('#pv_head', root); const tbody=$('#pv_body', root);
    thead.innerHTML=''; tbody.innerHTML='';
    thead.appendChild(el('th', null, ''));
    colLabels.forEach(c=> thead.appendChild(el('th', null, c)));
    rowLabels.forEach((rk,ri)=>{
      const tr=el('tr', null); tr.appendChild(el('td', null, rk));
      matrix[ri].forEach((val,ci)=>{
        const td=el('td', {'data-raw': String(val||'')}, String(val||'—'));
        td.addEventListener('click', ()=>{
          const names = drill[`${ri}:${ci}`]||[];
          openDrillDownModal(rk, colLabels[ci], names);
        });
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });
  }

  function openDrillDownModal(rowKey, colKey, names){
    const wrap=el('div', { class:'modal-wrap' },
      el('div', { class:'modal-overlay', onclick: close }),
      el('div', { class:'modal', style:{ maxWidth:'520px' } },
        el('div', { class:'modal-header' },
          el('div', { class:'flex items-center justify-between' },
            el('h3', { class:'text-lg font-semibold' }, `Drill-down — ${rowKey} × ${colKey}`),
            el('button', { class:'btn btn-icon', title:'Close', onclick: close }, '×')
          )
        ),
        el('div', { class:'modal-body' },
          names.length ? el('ul', null, ...names.map(n=> el('li', null, n))) : el('p', null, 'No names.')
        ),
        el('div', { class:'modal-footer' }, el('button', { class:'btn', onclick: close }, 'Close'))
      )
    );
    function close(){ if (wrap && wrap.parentNode) wrap.parentNode.removeChild(wrap); }
    document.body.appendChild(wrap);
  }

  // -------------------------
  // Overlay UI (without Whole Result)
  // -------------------------
  function openResultsOverlay(){
    if ($('#results_overlay')) return;
    const wrap = el('div', { id:'results_overlay', class:'modal-wrap', role:'dialog', 'aria-modal':'true' },
      el('div', { class:'modal-overlay', onclick: close }),
      el('div', { class:'modal', style:{ width:'min(1100px, calc(100vw - 28px))' } },
        el('div', { id:'results_head', class:'modal-header' },
          el('div', { class:'flex items-center justify-between' },
            el('h3', { class:'text-lg font-semibold' }, 'Results'),
            el('div', { class:'flex items-center gap-2' },
              el('button', { id:'btn_whole_result', style:{display:'none'} }, ''), // placeholder; يُستبدل من app-whole-result.js
              el('span', { id:'results_status', class:'small-muted' }, ''),
              el('button', { id:'res_back', class:'btn', 'aria-label':'Back to main' }, '← Back to main'),
              el('button', { class:'btn btn-icon', title:'Close', onclick: close }, '×')
            )
          )
        ),
        el('div', { class:'modal-body', id:'results_body' },
          el('div', { id:'res_skel', class:'card soft', style:{ marginBottom:'12px' } }, 'Loading results…'),

          // KPIs
          el('section', { id:'res_kpis', class:'card', style:{ marginBottom:'12px', display:'none' }, 'aria-label':'Mini dashboard (KPIs)' },
            el('div', { class:'section-title' }, el('h3', null, 'Mini Dashboard (KPIs)')),
            el('div', { id:'res_kpi_grid', class:'grid', style:'grid-template-columns: repeat(3, minmax(220px, 1fr)); gap:12px;' })
          ),

          // Assessments per month + extras
          el('section', { id:'res_charts', class:'card', style:{ marginBottom:'12px', display:'none' } },
            el('div', { class:'section-title' },
              el('h3', null, 'Assessments per month'),
              el('div', null,
                el('label', { class:'pill', style:{ marginInlineEnd:'8px' } },
                  el('input', { type:'radio', name:'res_range', value:'rolling12', checked:true }),
                  'Last 12 months'
                ),
                el('label', { class:'pill' },
                  el('input', { type:'radio', name:'res_range', value:'thisYear' }),
                  'This year'
                )
              )
            ),
            el('div', { class:'grid', style:'grid-template-columns: 1fr; gap:12px;' },
              el('canvas', { id:'res_line', width:960, height:300, style:{ width:'100%', height:'auto' }, 'aria-label':'Assessments per month chart' })
            ),
            el('div', { class:'grid', style:'grid-template-columns: repeat(3, minmax(220px, 1fr)); gap:12px; marginTop:"12px"' },
              el('div', { class:'card soft' },
                el('div', { class:'section-title' }, el('h3', null, 'Toxicity distribution (overall)')),
                el('canvas', { id:'res_donut', width:320, height:220, style:{ width:'100%', height:'auto' } })
              ),
              el('div', { class:'card soft' },
                el('div', { class:'section-title' }, el('h3', null, 'Regimen usage')),
                el('canvas', { id:'res_regimen', width:320, height:220, style:{ width:'100%', height:'auto' } })
              ),
              el('div', { class:'card soft' },
                el('div', { class:'section-title' }, el('h3', null, 'Stage breakdown (Yes/No)')),
                el('canvas', { id:'res_stage', width:320, height:220, style:{ width:'100%', height:'auto' } })
              )
            )
          ),

          // Pivot (Saved assessments only)
          el('section', { id:'res_pivot', class:'card', style:{ display:'none' } },
            el('div', { class:'section-title' }, el('h3', null, 'Pivot Table')),
            el('div', { class:'grid', style:'grid-template-columns: repeat(4, minmax(150px, 1fr)); gap:12px; marginBottom:"8px"' },
              el('div', { class:'form-group' }, el('label', { for:'pv_rows' }, 'Rows'),    el('select', { id:'pv_rows', 'aria-label':'Rows field' })),
              el('div', { class:'form-group' }, el('label', { for:'pv_cols' }, 'Columns'), el('select', { id:'pv_cols', 'aria-label':'Columns field' })),
              el('div', { class:'form-group' }, el('label', { for:'pv_vals' }, 'Values'),
                el('select', { id:'pv_vals', 'aria-label':'Values aggregation' },
                  el('option', null, 'Count of records'),
                  el('option', null, 'Average grade')
                )
              ),
              el('div', { class:'form-group' }, el('label', { for:'pv_filter_year' }, 'Filter — Year'),
                el('select', { id:'pv_filter_year', 'aria-label':'Filter by year' }, el('option', { value:'' }, 'All'))
              )
            ),
            el('div', { class:'grid', style:'grid-template-columns: repeat(2, minmax(150px, 1fr)); gap:12px; marginTop:"-4px"; marginBottom:"8px"' },
              el('div', { class:'form-group' }, el('label', { for:'pv_filter_reg' }, 'Filter — Regimen'),
                el('select', { id:'pv_filter_reg', 'aria-label':'Filter by regimen' }, el('option', { value:'' }, 'All'))
              ),
              el('div', { class:'flex items-center gap-2', style:{ alignItems:'flex-end', justifyContent:'flex-end' } },
                el('button', { id:'pv_export_csv', class:'btn' }, 'Export CSV'),
                el('button', { id:'pv_export_xlsx', class:'btn', title:'Coming soon' }, 'Export XLSX')
              )
            ),
            el('div', { id:'pv_wrap', class:'table-host', style:{ marginTop:'6px' }, role:'region', 'aria-label':'Pivot table results' },
              el('table', { id:'pv_table', class:'table', style:'min-width:720px' },
                el('thead', null, el('tr', { id:'pv_head' })),
                el('tbody', { id:'pv_body' })
              )
            ),
            el('small', { class:'muted' }, 'Tip: Click any cell to drill down (show contributing patient names).')
          ),

          // Error box
          el('div', { id:'res_err', class:'card soft', style:{ display:'none', marginTop:'8px' } },
            el('div', { class:'flex items-center justify-between' },
              el('span', { style:{ color:'#b00020', fontWeight:'600' } }, 'Failed to load results.'),
              el('button', { id:'res_retry', class:'btn' }, 'Retry')
            )
          )
        )
      )
    );
    function close(){ if (wrap && wrap.parentNode) wrap.parentNode.removeChild(wrap); }
    $('#res_back', wrap)?.addEventListener('click', close);
    document.body.appendChild(wrap);

    loadResultsInto(wrap).catch(err=>{
      console.error('[results] load failed', err);
      $('#res_skel', wrap).style.display='none';
      const errBox = $('#res_err', wrap); if (errBox) errBox.style.display='';
      $('#res_retry', wrap)?.addEventListener('click', ()=>{
        errBox.style.display='none';
        $('#res_skel', wrap).style.display='';
        loadResultsInto(wrap).catch(e=>console.error(e));
      });
    });
  }

  function fillSelectOptionsFromColumns(selectEl, columns){
    selectEl.innerHTML = '';
    // Derived fields first
    ['Assessment month', 'Assessment year'].forEach(lbl=>{
      selectEl.appendChild(el('option', null, lbl));
    });
    // All sheet columns (with nice labels if any)
    columns.forEach(col=>{
      const nice = NICE_LABELS[col] || col;
      selectEl.appendChild(el('option', null, nice));
    });
  }

  async function loadResultsInto(root){
    hideDiagnosticsUI();

    const skel=$('#res_skel', root), kpisSec=$('#res_kpis', root), chartsSec=$('#res_charts', root), pivotSec=$('#res_pivot', root);
    const status = $('#results_status', root); if (status) status.textContent = 'Loading…';

    // جلب متوازٍ: Assessments + PhoneLogs (all)
    const [assessments, phoneLogs] = await Promise.all([
      fetchAssessmentsFresh(),
      fetchAllPhoneLogsFast()
    ]);

    // KPIs
    const k=computeKpis(assessments, phoneLogs);
    renderKpis($('#res_kpi_grid', root), k); kpisSec.style.display='';

    // Charts
    const rangeInputs = $$('input[name="res_range"]', root);
    function renderCharts(range){
      const mc=monthlyCounts(assessments, range==='thisYear'?'thisYear':'rolling12');
      drawLine($('#res_line', root), mc.axis, mc.values);
      const dist=distOverall(assessments); drawDonut($('#res_donut', root), dist.labels, dist.values);
      const reg=regimenUsage(assessments); drawBars($('#res_regimen', root), reg.labels, reg.values);
      const st=stageBreakdown(assessments); drawBars($('#res_stage', root),
        st.stages, st.yes.map((v,i)=> v+st.no[i]),
        st.stages.map((_,i)=> (st.yes[i]>=st.no[i]) ? '#6D9773' : '#9DB8AA')
      );
    }
    rangeInputs.forEach(r=> r.addEventListener('change', ()=> renderCharts(rangeInputs.find(x=>x.checked)?.value || 'rolling12')));
    renderCharts('rolling12'); chartsSec.style.display='';

    // Pivot fields = all assessment columns + derived month/year
    const autoCols = (()=> {
      const fromConfig = (window.AppData && Array.isArray(AppData.ASSESSMENT_COLUMNS)) ? AppData.ASSESSMENT_COLUMNS.slice() : [];
      const fromData = Array.from(
        assessments.reduce((s,row)=>{ Object.keys(row||{}).forEach(k=> s.add(k)); return s; }, new Set())
      );
      const set = new Set(); const out=[];
      fromConfig.concat(fromData).forEach(k=>{ if(!set.has(k)){ set.add(k); out.push(k); }});
      return out;
    })();

    const years = uniq(assessments.map(r=> String(toDMY(r.assessment_date||'')).slice(-4)).filter(y=>/^\d{4}$/.test(y))).sort();
    const regimens = uniq(assessments.map(r=> asText(r.regimen||'')).filter(Boolean)).sort();
    const yearSel = $('#pv_filter_year', root); years.forEach(y=> yearSel.appendChild(el('option', { value:y }, y)));
    const regSel  = $('#pv_filter_reg', root); regimens.forEach(r=> regSel.appendChild(el('option', { value:r }, r)));

    const rowsSel=$('#pv_rows', root), colsSel=$('#pv_cols', root), valsSel=$('#pv_vals', root);
    fillSelectOptionsFromColumns(rowsSel, autoCols);
    fillSelectOptionsFromColumns(colsSel, autoCols);

    // defaults
    rowsSel.value = 'diagnosis';
    colsSel.value = 'Assessment month';

    function renderPivot(){
      const filters={ year: yearSel.value || '', regimen: regSel.value || '' };
      const rowsField = rowsSel.value;
      const colsField = colsSel.value;
      const { rowLabels, colLabels, matrix, drill } = buildPivot(
        assessments, rowsField, colsField, valsSel.value, filters
      );
      drawPivotTable(root, rowLabels, colLabels, matrix, drill);
    }
    [rowsSel, colsSel, valsSel, yearSel, regSel].forEach(x=> x.addEventListener('change', renderPivot));
    renderPivot(); pivotSec.style.display='';

    // Export CSV
    $('#pv_export_csv', root)?.addEventListener('click', ()=>{
      const table=$('#pv_table', root); if (!table) return;
      const rows=[]; const head=$$('thead th', table).map(th=> th.textContent.trim()); rows.push(head);
      $$('tbody tr', table).forEach(tr=> rows.push($$('td', tr).map(td=> td.getAttribute('data-raw') || td.textContent.trim())));
      const csv = rows.map(r=> r.map(csvEscape).join(',')).join('\r\n');
      downloadText('pivot.csv', '\uFEFF'+csv, 'text/csv;charset=utf-8;');
    });
    $('#pv_export_xlsx', root)?.addEventListener('click', ()=> alert('XLSX export will be added later. Use CSV for now.'));

    skel.style.display='none';
    if (status) status.textContent = 'Ready';
  }

  function renderKpis(host, k){
    host.innerHTML='';
    const items = [
      ['Total Patients', k.totalPatients, 'Unique patients'],
      ['Saved Assessments', k.savedAssessments, 'All records'],
      ['Phone Follow-ups', k.phoneFollowups, 'All phone logs'],
      ['Due this week', k.dueWeek, 'by end of week'],
      ['Overdue', k.overdue, 'past due date'],
      ['Next 7 days', k.next7, 'upcoming within 7d'],
      ['This day', k.dueToday, 'appointments today'],
      ['Toxicity Yes', `${k.toxYes} (${k.toxPct}%)`, 'Yes cases'],
      ['Most common Toxicity type', k.mostCommon, 'by non-G0 count'],
      ['Hospitalizations due to toxicity', k.hosp, 'from assessments'],
    ];
    items.forEach(([title, value, hint])=>{
      const card = el('div', { class:'card soft', role:'group', 'aria-label':`${title}: ${value}` },
        el('div', { class:'section-title' },
          el('h3', null, title),
          el('span', { class:'badge' }, hint||'')
        ),
        el('div', { class:'text-lg', style:{ fontSize:'28px', fontWeight:'700', marginTop:'4px' } }, String(value))
      );
      host.appendChild(card);
    });
  }

  // -------------------------
  // Boot
  // -------------------------
  function boot(){
    hideDiagnosticsUI();
    ensureResultsBadge();
  }
  if (document.readyState==='loading') document.addEventListener('DOMContentLoaded', boot);
  else setTimeout(boot, 0);

})();
