/* =========================================================================
 * app-dashboard-trends.js — Line chart for "Assessments per month"
 * يعتمد على data-assessment-date المضافة على كل <tr> في #sa_tbody
 * UI-only — بدون أي تغيير على منطق التطبيق
 * ========================================================================= */
(function(){
  'use strict';

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
  const pad2 = n => String(n).padStart(2,'0');

  // ---------- mount a new card into existing Mini Dashboard ----------
  function ensureTrendsCard(){
    const dash = document.getElementById('mini_dashboard');
    if (!dash) return null;

    let card = document.getElementById('md_trends_card');
    if (card) return card;

    const grid = dash.querySelector('.grid') || dash;
    card = el('div', { id:'md_trends_card', class:'card soft', style:{ gridColumn:'1 / -1' } },
      el('div', { class:'section-title' }, el('h3', null, 'Assessments per month (Assessment date)')),
      el('canvas', { id:'md_line', width:960, height:300, style:{ width:'100%', height:'auto' } })
    );

    if (grid && grid.classList.contains('grid')) grid.appendChild(card);
    else dash.appendChild(card);

    return card;
  }

  // ---------- read assessment_date (DMY) from each row's data-attribute ----------
  function readAssessmentDates(){
    const rows = $$('#sa_tbody tr');
    const dmys = [];
    rows.forEach(tr=>{
      const dmy = tr.getAttribute('data-assessment-date') || '';
      if (/^\d{2}\/\d{2}\/\d{4}$/.test(dmy)) dmys.push(dmy);
    });

    // احتياطي: إذا ما لقى data-attribute (بحالة قديمة)، يحاول يقرأ من عمود "Assessment date" لو موجود
    if (dmys.length === 0){
      const table = $('#sa_table');
      const tb    = $('#sa_tbody');
      if (table && tb){
        const headers = Array.from(table.querySelectorAll('thead th')).map(th => (th.textContent||'').trim());
        const idx = {}; headers.forEach((t,i)=> idx[t]=i);
        const col = (idx['Assessment date']!=null) ? idx['Assessment date'] : null;
        if (col!=null){
          $$('#sa_tbody tr').forEach(tr=>{
            const td = tr.querySelectorAll('td')[col];
            const val = (td && td.textContent || '').trim();
            if (/^\d{2}\/\d{2}\/\d{4}$/.test(val)) dmys.push(val);
          });
        }
      }
    }

    return dmys;
  }

  // ---------- parse DMY to {y,m} ----------
  function parseDMYtoYM(dmy){
    if (!dmy) return null;
    const m = String(dmy).match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (!m) return null;
    return { y: +m[3], m: +m[2] };
  }

  // ---------- build monthly series (last 12 months) ----------
  function buildMonthlyCounts(dmys, monthsBack=12){
    const counts = new Map();
    dmys.forEach(dmy=>{
      const ym = parseDMYtoYM(dmy);
      if (!ym) return;
      const key = `${ym.y}-${pad2(ym.m)}`;
      counts.set(key, (counts.get(key)||0)+1);
    });

    const now = new Date();
    const axis = [];
    for (let i=monthsBack-1; i>=0; i--){
      const d = new Date(now.getFullYear(), now.getMonth()-i, 1);
      axis.push(`${d.getFullYear()}-${pad2(d.getMonth()+1)}`);
    }
    const values = axis.map(k => counts.get(k)||0);
    return { axis, values };
  }

  // ---------- draw a simple line chart on canvas ----------
  function drawLine(canvas, labels, values){
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    ctx.clearRect(0,0,W,H);

    const padL = 40, padR = 20, padT = 18, padB = 32;
    const chartW = W - padL - padR;
    const chartH = H - padT - padB;

    const maxV = Math.max(1, ...values);
    const stepX = chartW / Math.max(1, (values.length-1));

    // axes
    ctx.strokeStyle = 'rgba(255,255,255,0.18)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padL, H - padB);
    ctx.lineTo(W - padR, H - padB);
    ctx.moveTo(padL, padT);
    ctx.lineTo(padL, H - padB);
    ctx.stroke();

    // y-grid
    ctx.strokeStyle = 'rgba(255,255,255,0.10)';
    for (let i=1;i<=4;i++){
      const y = padT + chartH * (1 - i/4);
      ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(W - padR, y); ctx.stroke();
    }

    // line
    ctx.strokeStyle = '#6D9773';
    ctx.lineWidth = 2;
    ctx.beginPath();
    values.forEach((v,i)=>{
      const x = padL + i*stepX;
      const y = padT + chartH * (1 - (v/maxV));
      if (i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
    });
    ctx.stroke();

    // points
    ctx.fillStyle = '#FFBA00';
    values.forEach((v,i)=>{
      const x = padL + i*stepX;
      const y = padT + chartH * (1 - (v/maxV));
      ctx.beginPath(); ctx.arc(x,y,3,0,Math.PI*2); ctx.fill();
    });

    // labels (x)
    ctx.fillStyle = '#EAF4EE';
    ctx.font = '600 11px ui-sans-serif, system-ui';
    ctx.textAlign = 'center';
    labels.forEach((lab,i)=>{
      if (values.length>8 && (i%2)!==0) return;
      const x = padL + i*stepX;
      const month = lab.slice(5); // "YYYY-MM" -> "MM"
      ctx.fillText(month, x, H - 12);
    });

    // y max label
    ctx.textAlign = 'right';
    ctx.fillText(String(maxV), padL - 6, padT + 10);
  }

  // ---------- refresh + watch ----------
  function refresh(){
    const dmys = readAssessmentDates();
    const { axis, values } = buildMonthlyCounts(dmys, 12);
    const canvas = document.getElementById('md_line');
    drawLine(canvas, axis, values);
  }

  function watch(){
    const tb = document.getElementById('sa_tbody');
    const toolbar = document.getElementById('saved_toolbar') || document;
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

  // ---------- boot ----------
  function boot(){
    const card = ensureTrendsCard();
    if (!card) return;
    const tryInit = ()=>{
      if (document.getElementById('sa_table') && document.getElementById('sa_tbody')){
        refresh(); watch(); return true;
      }
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
