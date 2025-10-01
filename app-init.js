(function(){
  'use strict';

  // ===== Helpers (خفيفة وآمنة) =====
  function $(s,r){ return (r||document).querySelector(s); }
  function $all(s,r){ return Array.from((r||document).querySelectorAll(s)); }
  function byId(id){ return document.getElementById(id); }
  function pad2(n){ return String(n).padStart(2,'0'); }

  function toDMY(val){
    // نحاول إعادة الاستخدام لو عندك Normalizer مشترك
    if (window.DomHelpers && typeof DomHelpers.normalizeToDMY==='function'){
      return DomHelpers.normalizeToDMY(val);
    }
    if (!val) return '';
    if (typeof val==='string'){
      const s = val.trim();
      const mIso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
      if (mIso) return `${mIso[3]}/${mIso[2]}/${mIso[1]}`;
      const mDMY = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
      if (mDMY){
        const d=+mDMY[1], m=+mDMY[2], y=mDMY[3];
        return `${pad2(d)}/${pad2(m)}/${y}`;
      }
    }
    try{
      const d = new Date(val);
      if (!isNaN(d)) return `${pad2(d.getDate())}/${pad2(d.getMonth()+1)}/${d.getFullYear()}`;
    }catch(_){}
    return String(val||'');
  }

  function todayDMY(){
    const d = new Date();
    return `${pad2(d.getDate())}/${pad2(d.getMonth()+1)}/${d.getFullYear()}`;
  }

  function getVal(el){
    if (!el) return '';
    if (el.type === 'checkbox') return el.checked ? 'Yes' : 'No';
    return (el.value || '').trim();
  }
  function valOf(id){ return getVal(byId(id)); }
  function firstVal(){ for (let i=0;i<arguments.length;i++){ const v=valOf(arguments[i]); if (v!=='') return v; } return ''; }

  // ===== تحميل وعرض Saved assessments =====
  async function loadAssessments(){
    if (!window.SheetsAPI || !window.SheetsAPI.fetchAssessments) return [];
    const rows = await window.SheetsAPI.fetchAssessments();
    return (rows||[]).map(r=>{
      const c = Object.assign({}, r);
      c.assessment_date = toDMY(c.assessment_date);
      c.followup_due    = toDMY(c.followup_due);
      c.first_date_5fu  = toDMY(c.first_date_5fu); // NEW
      return c;
    });
  }

  async function renderSavedAssessments(){
    try{
      const rows = await loadAssessments();
      const tableSel = document.getElementById('saved-assessments') ? '#saved-assessments' : '#saved_table';
      if (window.DomHelpers && DomHelpers.renderSavedAssessments){
        DomHelpers.renderSavedAssessments({ toolbar:'#saved_toolbar', table: tableSel }, rows);
      }
    }catch(e){ console.error('[init] renderSavedAssessments', e); }
  }

  // ===== فتح مودال الهاتف مع تمرير first_date_5fu كملاحظة =====
  window.tryOpenPhone = function(row){
    if (!row || !row.id){ alert('Missing patient id.'); return; }
    if (!window.PhoneUI || !window.PhoneUI.open){ alert('PhoneUI not loaded.'); return; }
    window.PhoneUI.open({
      id: row.id,
      name: row.name || '',
      followup_due: row.followup_due || '',
      first_date_5fu: row.first_date_5fu || ''   // NEW: يُستخدم كملاحظة حمراء داخل المودال
    });
  };

  // ===== حذف تقييم مع كاسكيد =====
  window.tryDeleteAssessment = async function(id){
    if (!id) return;
    if (!window.SheetsAPI || !window.SheetsAPI.deleteAssessmentCascade){
      alert('SheetsAPI not ready'); return;
    }
    if (!confirm('Delete this assessment and all related phone logs?')) return;
    try{
      const res = await window.SheetsAPI.deleteAssessmentCascade(id);
      if (res && res.ok !== false){
        alert('Deleted.');
        await renderSavedAssessments();
      }else{
        alert('Delete failed: ' + (res && res.error || 'unknown'));
      }
    }catch(e){ console.error(e); alert('Delete failed. See console.'); }
  };

  // ===== تحضير Payload للحفظ =====
  function guessAssessmentPayload(){
    const p = {};
    // identity
    p.id    = firstVal('id','patient_id','pid','mrn');
    p.name  = firstVal('name','full_name','patient_name');
    p.phone = firstVal('phone','patient_phone');
    p.sex   = firstVal('sex','patient_sex');
    p.age   = firstVal('age','patient_age');

    // clinical
    p.diagnosis = firstVal('diagnosis','cancer_type','cancer','cancer_input');
    p.stage     = firstVal('stage','cancer_stage');
    p.regimen   = firstVal('regimen','tx_regimen');
    p.cycle     = firstVal('cycle');

    // toxicities
    p.mucositis_grade   = firstVal('mucositis_grade');
    p.diarrhea_grade    = firstVal('diarrhea_grade');
    p.neutropenia_grade = firstVal('neutropenia_grade');
    p.toxicity_found    = firstVal('toxicity_found');

    // other tox
    p.other_tox_name  = firstVal('other_tox_name','other_toxicity');
    p.other_tox_grade = firstVal('other_tox_grade','other_grade');

    // decisions
    p.hospitalization_due_tox = firstVal('hosp_due_tox','hospitalization_due_tox');
    p.delay             = firstVal('delay');
    p.stop              = firstVal('stop');
    p.dose_modification = firstVal('dose_modification','dose_mod');
    const red = firstVal('dose_reduction_pct','dose_reduction','dose_red');
    if (red !== '') p.dose_reduction_pct = Number(red);

    // dates
    const ad = firstVal('assessment_date');
    p.assessment_date = ad ? toDMY(ad) : todayDMY();

    const nextDueRaw = firstVal('followup_due','next_followup','next_phone_followup','next_due');
    if (nextDueRaw) p.followup_due = toDMY(nextDueRaw);

    // NEW: 1st date 5FU — افتراضيًا اليوم إذا تُرك فارغًا
    const first5fu = firstVal('first_date_5fu');
    p.first_date_5fu = first5fu ? toDMY(first5fu) : todayDMY();

    // notes
    p.notes = firstVal('notes','assessment_notes');

    // cleanup empty
    Object.keys(p).forEach(k => { if (p[k]===undefined || p[k]===null || p[k]==='') delete p[k]; });
    return p;
  }

  // ===== ربط زر الحفظ =====
  async function tryWireSaveButton(){
    const candidates = ['btn-save','btn_save','save_entry','btn-save-entry'];
    let btn = null;
    for (const id of candidates){ const el = byId(id); if (el){ btn = el; break; } }
    if (!btn) return;

    btn.addEventListener('click', async (ev)=>{
      ev.preventDefault();
      try{
        if (!window.SheetsAPI || !window.SheetsAPI.saveAssessment) { alert('SheetsAPI not ready'); return; }
        const payload = guessAssessmentPayload();
        if (!payload.id){ alert('Please provide patient ID.'); return; }
        const res = await window.SheetsAPI.saveAssessment(payload);
        if (res && res.ok === false){
          alert('Save failed: ' + (res.error || 'unknown'));
          return;
        }
        await renderSavedAssessments();
        alert('Saved.');
      }catch(e){
        console.error('saveAssessment failed', e); alert('Save failed. Check console.');
      }
    });
  }

  // ===== زر Reset (إرجاع 1st date 5FU لليوم) =====
  function tryWireResetButton(){
    const btn = byId('btn-reset') || byId('reset_form');
    if (!btn) return;
    btn.addEventListener('click', ()=>{
      const form = btn.closest('form') || document;
      $all('input, select, textarea', form).forEach(el=>{
        if (el.type === 'checkbox' || el.type === 'radio') el.checked = false;
        else el.value = '';
      });
      const fd = byId('first_date_5fu');
      if (fd && fd.type==='date'){
        const d = new Date();
        fd.value = `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`;
      }
    });
  }

  // ===== إنشاء الحاويات تلقائيًا إن لم تكن موجودة =====
  function ensureHosts(){
    let toolbar = $('#saved_toolbar');
    let table   = $('#saved-assessments') || $('#saved_table');
    if (!toolbar){
      toolbar = document.createElement('div'); toolbar.id = 'saved_toolbar'; toolbar.className='header-bar container'; document.body.prepend(toolbar);
    }
    if (!table){
      table = document.createElement('div'); table.id='saved_table'; table.className='container mt-2'; document.body.appendChild(table);
    }
  }

  // ===== Bootstrap =====
  async function bootstrap(){
    try{
      ensureHosts();
      await tryWireSaveButton();
      tryWireResetButton();
      await renderSavedAssessments();
    }catch(e){ console.error('[init] bootstrap', e); }
  }

  document.addEventListener('DOMContentLoaded', bootstrap);
})();
