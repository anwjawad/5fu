/* =========================================================================
 * app-whole-result.launcher.js
 * -------------------------------------------------------------------------
 * Badge عائمة لفتح مودال Whole Result مباشرة من الواجهة الرئيسية
 * - لا يغيّر أي منطق؛ واجهة فقط.
 * - يتوقع وجود window.WholeResult.open() (سنضيفها بخطوة لاحقة في app-whole-result.js)
 * - في حال عدم توفرها حالياً، يرسل حدث 'whole:open' كاحتياط.
 * ========================================================================= */

(function(){
  'use strict';

  const $ = (s,r)=> (r||document).querySelector(s);

  function injectStyles(){
    if ($('#whole_fab_styles')) return;
    const css = `
#whole-fab{
  position: fixed;
  right: 16px;
  bottom: 64px; /* فوق زر Results الافتراضي */
  z-index: 65;
  padding: 8px 12px;
  border-radius: 999px;
  border: 1px solid var(--border);
  background: var(--pill-bg);
  color: var(--text);
  font-weight: 700;
  cursor: pointer;
  box-shadow: var(--shadow-1);
  transition: transform .08s ease, box-shadow .2s ease, background .2s ease;
}
#whole-fab:hover{ transform: translateY(-1px); box-shadow: var(--shadow-2); }
#whole-fab:active{ transform: translateY(0); box-shadow: var(--shadow-1); }
@media (max-width: 640px){
  #whole-fab{ bottom: 72px; right: 12px; }
}
    `;
    const style = document.createElement('style');
    style.id = 'whole_fab_styles';
    style.appendChild(document.createTextNode(css));
    document.head.appendChild(style);
  }

  function createBadge(){
    if ($('#whole-fab')) return;
    const btn = document.createElement('button');
    btn.id = 'whole-fab';
    btn.type = 'button';
    btn.title = 'Whole Result';
    btn.setAttribute('aria-label', 'Open whole result summary');
    btn.textContent = '🧩 Whole Result';
    btn.addEventListener('click', ()=>{
      try{
        if (window.WholeResult && typeof window.WholeResult.open === 'function'){
          window.WholeResult.open();
        } else {
          // احتياط: لو حاب تربطها بحدث عام وتلتقطه من أي ملف آخر
          document.dispatchEvent(new CustomEvent('whole:open'));
          // أو fallback: إن وُجد زر داخلي لاحقاً
          const btnHdr = document.querySelector('#btn_whole_result');
          if (btnHdr) btnHdr.click();
        }
      }catch(err){
        console.error('[whole-launcher] failed to open Whole Result', err);
      }
    });
    document.body.appendChild(btn);
  }

  function waitForResultsFabThenPlace(){
    // زر Results الأساسي غالباً id=results-fab (من app-result.js)
    const resultsFab = $('#results-fab');
    if (resultsFab){
      createBadge();
      return;
    }
    // انتظر ظهوره، ثم أضف البادج
    const mo = new MutationObserver(()=>{
      const r = $('#results-fab');
      if (r){
        createBadge();
        mo.disconnect();
      }
    });
    mo.observe(document.body, { childList:true, subtree:true });
    // احتياط: أنشئها بعد مهلة قصيرة حتى لو ما ظهر الزر
    setTimeout(createBadge, 1200);
  }

  function boot(){
    injectStyles();
    waitForResultsFabThenPlace();
  }

  if (document.readyState==='loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

})();
