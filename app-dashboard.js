/* =========================================================================
 * app-dashboard.js — Mini Dashboard (UI-only, no logic changes)
 * ========================================================================= */
(function(){
  'use strict';

  // === Small DOM helpers
  const $  = (sel, r)=> (r||document).querySelector(sel);
  const $$ = (sel, r)=> Array.from((r||document).querySelectorAll(sel));
  function el(tag, attrs, ...kids){
    const n=document.createElement(tag);
    if(attrs) for(const[k,v] of Object.entries(attrs)){
      if(k==='class' || k==='className') n.className=v||'';
      else if(k==='style' && v && typeof v==='object') Object.assign(n.style,v);
      else if(k in n) n[k]=v;
      else n.setAttribute(k,v);
    }
    kids.forEach(k=>{ if(k!=null) n.appendChild(typeof k==='string'?document.createTextNode(k):k); });
    return n;
  }
  function pad2(n){return String(n).padStart(2,'0');}
  function todayDMY(){ const d=new Date(); return `${pad2(d.getDate())}/${pad2(d.getMonth()+1)}/${d.getFullYear()}`; }
  function dmyToSortable(s){ const m=String(s||'').match(/^(\d{2})\/(\d{2})\/(\d{4})$/); return m?`${m[3]}${m[2]}${m[1]}`:''; }
  function isTodayDMY(s){ return dmyToSortable(s)===dmyToSortable(todayDMY()); }
  function isOverdueDMY(s){ const key=dmyToSortable(s); return key && key<dmyToSortable(todayDMY()); }
  function endOfWeekKey(){
    const d=new Date(); const day=d.getDay(); // 0=Sun
    const diff = (day===0?6:6-day); // to Saturday
    const e=new Date(d); e.setDate(d.getDate()+diff);
    return `${e.getFullYear()}${pad2(e.getMonth()+1)}${pad2(e.getDate())}`;
  }

  // === Grades
  const GRADES = ['G0','G1','G2','G3','G4'];
  function parseGrade(g){ g=String(g||'').toUpperCase().trim(); return GRADES.includes(g)?g:''; }
  function maxGrade(...gs){
    let maxIdx=-1;
    gs.forEach(g=>{ const i=GRADES.indexOf(parseGrade(g)); if(i>maxIdx) maxIdx=i; });
    return maxIdx>=0?GRADES[maxIdx]:'';
  }

  // === Pick the right host safely
  function getMainHost(){
    return $('main.container') || $('main') || $('.container') || document.body;
  }

  // === Inject dashboard container (FIXED insertBefore logic)
  function ensureDashboard(){
    const existing = $('#mini_dashboard');
    if (existing) return existing;

    // Try to place right above the saved table section if present
    const savedSec = $('.table-card') || $('#saved-assessments');
    const host = savedSec ? savedSec.parentNode : getMainHost();

    const section = el('section', { id:'mini_dashboard', class:'card', style:{ marginBottom:'12px' } },
      el('div', { class:'section-title' },
        el('h3', null, '📊 Mini Dashboard'),
        el('div', { id:'md_kpis', class:'flex items-center gap-2 muted' }, 'Loading…')
      ),
      el('div', { class:'grid', style:'grid-template-columns: repeat(2, minmax(260px, 1fr)); gap:12px;' },
        el('div', { class:'card soft' },
          el('div', { class:'section-title' }, el('h3', null, 'Toxicity distribution (max of selected)')),
          el('canvas', { id:'md_pie', width:480, height:280, style:{ width:'100%', height:'auto' } })
        ),
        el('div', { class:'card soft' },
          el('div', { class:'section-title' }, el('h3', null, 'Follow-up due buckets')),
          el('canvas', { id:'md_bar', width:480, height:280, style:{ width:'100%', height:'auto' } })
        )
      )
    );

    // Safe insertion:
    try {
      if (savedSec && host && savedSec.parentNode === host) {
        host.insertBefore(section, savedSec);
      } else if (host && host.firstChild) {
        host.insertBefore(section, host.firstChild);
      } else if (host) {
        host.appendChild(section);
      } else {
        document.body.appendChild(section);
      }
    } catch (e){
      // Fallback (never throw)
      (host || document.body).appendChild(section);
    }

    // small styles
    const style = document.createElement('style');
    style.textContent = `
      #mini_dashboard .kpi{display:inline-flex;align-items:center;gap:8px;padding:6px 10px;border-radius:999px;background:var(--pill-bg);border:1px solid var(--border);color:var(--pill-text);font-weight:600}
      #mini_dashboard .legend{display:flex;flex-wrap:wrap;gap:8px;margin-top:6px}
      #mini_dashboard .legend .item{display:inline-flex;align-items:center;gap:8px;padding:4px 8px;border-radius:999px;background:rgba(255,255,255,0.04);border:1px solid var(--border);font-size:12px}
      @media (max-width: 900px){ #mini_dashboard .grid{ grid-template-columns: 1fr; } }
    `;
    document.head.appendChild(style);

    return section;
  }

  // === Extract rows from Saved Assessments table
  function readTable(){
    const table = $('#sa_table');
    const tb = $('#sa_tbody');
    if (!table || !tb) return [];
    const headers = Array.from(table.querySelectorAll('thead th')).map(th => (th.textContent||'').trim());
    const idx = {}; headers.forEach((t,i)=> idx[t]=i);
    const rows = [];
    tb.querySelectorAll('tr').forEach(tr=>{
      const tds = tr.querySelectorAll('td');
      if (!tds || !tds.length) return;
      function cell(title){ const i = idx[title]; return (i==null)?'':(tds[i]?.textContent||'').trim(); }
      rows.push({
        name: cell('Name'),
        id: cell('ID'),
        followup_due: cell('Next phone follow-up'),
        first_date_5fu: cell('1st date 5FU'),
        mucositis: cell('Mucositis'),
        diarrhea: cell('Diarrhea'),
        neutropenia: cell('Neutropenia'),
        other_name: cell('Other tox'),
        other_grade: cell('Other grade'),
      });
    });
    return rows;
  }

  // === Aggregate for charts
  function computeAggregates(rows){
    const dist = { G0:0, G1:0, G2:0, G3:0, G4:0, none:0 };
    const due = { overdue:0, today:0, week:0, later:0, none:0 };
    const eow = endOfWeekKey();
    rows.forEach(r=>{
      const max = maxGrade(parseGrade(r.mucositis), parseGrade(r.diarrhea), parseGrade(r.neutropenia));
      if (max) dist[max]++; else dist.none++;
      const dueStr = r.followup_due || '';
      if (!dueStr){ due.none++; }
      else if (isTodayDMY(dueStr)){ due.today++; }
      else if (isOverdueDMY(dueStr)){ due.overdue++; }
      else { const key=dmyToSortable(dueStr); if (key && key<=eow) due.week++; else due.later++; }
    });
    return { dist, due, total: rows.length };
  }

  // === Drawing (Canvas 2D)
  function drawDonut(canvas, data, labels){
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    ctx.clearRect(0,0,W,H);

    const total = data.reduce((a,b)=>a+b,0) || 1;
    const cx = W/2, cy = H/2, R = Math.min(W,H)*0.40;
    const rInner = R*0.60;

    const colors = ['#58C58C', '#6D9773', '#FFBA00', '#FF7800', '#E05353', '#9DB8AA'];
    let start = -Math.PI/2;

    data.forEach((v,i)=>{
      const ang = (v/total) * Math.PI*2;
      const end = start + ang;
      ctx.beginPath();
      ctx.moveTo(cx,cy);
      ctx.arc(cx,cy,R,start,end);
      ctx.closePath();
      ctx.fillStyle = colors[i % colors.length];
      ctx.fill();
      start = end;
    });

    // hole
    ctx.save();
    ctx.globalCompositeOperation = 'destination-out';
    ctx.beginPath(); ctx.arc(cx,cy,rInner,0,Math.PI*2); ctx.fill(); ctx.restore();

    // center label
    ctx.fillStyle = '#EAF4EE';
    ctx.font = '600 16px ui-sans-serif, system-ui';
    const sum = data.reduce((a,b)=>a+b,0);
    ctx.textAlign='center';
    ctx.fillText(`${sum} patients`, cx, cy+6);

    // legend
    const legend = canvas.nextElementSibling && canvas.nextElementSibling.classList.contains('legend')
      ? canvas.nextElementSibling
      : canvas.parentElement.appendChild(el('div',{class:'legend'}));
    legend.innerHTML='';
    labels.forEach((lab,i)=>{
      const chip = el('div', { class:'item' },
        el('span', { style:{ width:'10px', height:'10px', borderRadius:'50%', background: colors[i%colors.length], display:'inline-block' } }),
        `${lab}: ${data[i]}`
      );
      legend.appendChild(chip);
    });
  }

  function drawBar(canvas, labels, values){
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    ctx.clearRect(0,0,W,H);

    const max = Math.max(1, ...values);
    const pad = 28;
    const chartW = W - pad*2;
    const chartH = H - pad*2;

    // x-axis
    ctx.strokeStyle = 'rgba(255,255,255,0.18)';
    ctx.beginPath(); ctx.moveTo(pad, H-pad); ctx.lineTo(W-pad, H-pad); ctx.stroke();

    const barW = chartW / (values.length * 1.5);
    const gap  = barW/2;

    values.forEach((v,i)=>{
      const x = pad + i*(barW+gap) + gap;
      const h = (v/max) * (chartH*0.9);
      const y = H - pad - h;
      ctx.fillStyle = '#6D9773';
      if (labels[i]==='Overdue') ctx.fillStyle = '#E05353';
      else if (labels[i]==='Today') ctx.fillStyle = '#FFBA00';
      ctx.fillRect(x, y, barW, h);

      ctx.fillStyle = '#EAF4EE';
      ctx.font = '600 12px ui-sans-serif, system-ui';
      ctx.textAlign='center';
      ctx.fillText(String(v), x+barW/2, y-6);
      ctx.fillText(labels[i], x+barW/2, H-pad+14);
    });
  }

  // === Refresh
  function refresh(){
    const rows = readTable();
    const { dist, due, total } = computeAggregates(rows);

    const kpisHost = $('#md_kpis');
    if (kpisHost){
      kpisHost.innerHTML = '';
      kpisHost.appendChild(el('span', { class:'kpi' }, `Total: ${total}`));
      const hi = (dist.G3 + dist.G4);
      kpisHost.appendChild(el('span', { class:'kpi' }, `G3–G4: ${hi}`));
      kpisHost.appendChild(el('span', { class:'kpi' }, `Due Today: ${due.today}`));
      kpisHost.appendChild(el('span', { class:'kpi' }, `Overdue: ${due.overdue}`));
    }

    const pie = $('#md_pie');
    drawDonut(pie, [dist.G0, dist.G1, dist.G2, dist.G3, dist.G4, dist.none], ['G0','G1','G2','G3','G4','None']);

    const bar = $('#md_bar');
    drawBar(bar, ['Overdue','Today','This week','Later','None'], [due.overdue, due.today, due.week, due.later, due.none]);
  }

  // === Observe table changes & filter changes
  function watch(){
    const tb = $('#sa_tbody');
    const toolbar = $('#saved_toolbar') || document;
    if (tb){
      const mo = new MutationObserver(()=> refresh());
      mo.observe(tb, { childList:true, subtree:true, characterData:true });
    }
    $$('input,select', toolbar).forEach(inp=>{
      inp.addEventListener('input', refresh, { passive:true });
      inp.addEventListener('change', refresh, { passive:true });
    });
    window.addEventListener('resize', ()=> setTimeout(refresh, 150));
  }

  // === Boot
  function boot(){
    const section = ensureDashboard();
    if (!section) return;

    // ensure legends next to canvases
    $$('#mini_dashboard canvas').forEach(c=>{
      if (!c.nextElementSibling || !c.nextElementSibling.classList.contains('legend')){
        c.parentElement.appendChild(el('div',{class:'legend'}));
      }
    });

    const tryInit = ()=>{
      if ($('#sa_table') && $('#sa_tbody')){ refresh(); watch(); return true; }
      return false;
    };
    if (!tryInit()){
      let tries = 0;
      const iv = setInterval(()=>{
        tries++;
        if (tryInit() || tries>40) clearInterval(iv);
      }, 250);
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else setTimeout(boot, 0);
})();
