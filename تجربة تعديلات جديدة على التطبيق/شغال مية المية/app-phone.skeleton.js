/* =========================================================================
 * app-phone.skeleton.js — modal skeleton (UI-only)
 * ========================================================================= */
(function () {
  'use strict';
  const { el, selWith, ynOptions, gradeOptions } = window.PhoneShared;

  function makeModalSkeleton() {
    const wrap = el('div', { class: 'modal-wrap', id: 'phone-modal' },
      el('div', { class: 'modal-overlay' }),
      el('div', { class: 'modal' },
        el('div', { class: 'modal-header' },
          el('div', { class: 'flex items-center justify-between' },
            el('h3', { class: 'text-lg font-semibold', id: 'ph_title' }, 'Phone Assessment'),
            el('div', { class: 'flex items-center gap-2' },
              el('div', { id:'ph_phone_chip', class:'pill muted', title:'Patient phone' }, '—'),
              el('button', { id:'ph_copy_phone', class:'btn btn-sm', title:'Copy phone' }, '📋'),
              el('a', { id:'ph_call_phone', class:'btn btn-sm', title:'Call', href:'#' }, '📞'),
              el('button', { class: 'btn btn-icon', id: 'btn-close-phone', title: 'Close' }, '×')
            )
          ),
        ),
        el('div', { class: 'modal-body' },
          el('div', { class: 'mb-1 muted' },
            el('strong', null, 'Patient: '),
            el('span', { id:'ph_patient_name' }, '—')
          ),
          el('div', { class: 'card soft mb-2' },
            el('div', { class: 'form-group' },
              el('label', { for: 'phone-prev-other-name' }, 'Previous visit: Other toxicity'),
              el('input', { id: 'phone-prev-other-name', type: 'text', readonly: true, placeholder: '—' })
            ),
            el('div', { class: 'form-group mt-1' },
              el('label', { for: 'phone-prev-other-grade' }, 'Grade of other toxicity'),
              el('input', { id: 'phone-prev-other-grade', type: 'text', readonly: true, placeholder: '—' })
            )
          ),
          el('div', { class: 'section-title' },
            el('h3', null, 'Phone Assessment'),
            el('small', { id: 'phone-due-hint', class: 'muted' }, '')
          ),
          el('div', { class: 'grid', style:'grid-template-columns:repeat(4,1fr); gap:12px;' },
            el('div', { class: 'form-group' },
              el('label', { for: 'ph_diarrhea' }, 'Diarrhea (G0–4)'),
              selWith('ph_diarrhea', gradeOptions())
            ),
            el('div', { class: 'form-group' },
              el('label', { for: 'ph_mucositis' }, 'Mucositis (G0–4)'),
              selWith('ph_mucositis', gradeOptions())
            ),
            el('div', { class: 'form-group' },
              el('label', { for: 'ph_neutropenia' }, 'Neutropenia (G0–4)'),
              selWith('ph_neutropenia', gradeOptions())
            ),
            el('div', { class: 'form-group' },
              el('label', { for: 'ph_fever' }, 'Fever/Signs of infection'),
              selWith('ph_fever', ynOptions())
            )
          ),
          el('div', { class: 'grid', style:'grid-template-columns:repeat(2,1fr); gap:12px; margin-top:12px;' },
            el('div', { class: 'form-group' },
              el('label', { for: 'ph_dpyd_present' }, 'DPYD mutation present?'),
              selWith('ph_dpyd_present', ynOptions())
            ),
            el('div', { class: 'form-group' },
              el('label', { for: 'ph_dpyd_type' }, 'Mutation type (if Yes)'),
              el('input', { id: 'ph_dpyd_type', type: 'text', placeholder: 'e.g., *2A, *13, c.2846A>T…', autocomplete: 'off' })
            )
          ),
          el('div', { class: 'grid', style:'grid-template-columns:repeat(2,1fr); gap:12px; margin-top:12px;' },
            el('div', { class: 'form-group' },
              el('label', { for: 'ph_other_name' }, 'Other toxicity (name)'),
              el('input', { id: 'ph_other_name', type: 'text', placeholder: 'e.g., Hand-Foot', autocomplete: 'off' })
            ),
            el('div', { class: 'form-group' },
              el('label', { for: 'ph_other_grade' }, 'Other toxicity grade'),
              selWith('ph_other_grade', gradeOptions())
            )
          ),
          el('div', { class: 'grid', style:'grid-template-columns:repeat(6,1fr); gap:12px; margin-top:12px;' },
            el('div', { class: 'form-group' },
              el('label', { for: 'ph_hosp' }, 'Hospitalization since last visit'),
              selWith('ph_hosp', ynOptions())
            ),
            el('div', { class: 'form-group' },
              el('label', { for: 'ph_hosp_due_tox' }, 'Hospitalization Due to Toxicity'),
              selWith('ph_hosp_due_tox', ynOptions())
            ),
            el('div', { class: 'form-group' },
              el('label', { for: 'ph_delay' }, 'Delay'),
              selWith('ph_delay', ynOptions())
            ),
            el('div', { class: 'form-group' },
              el('label', { for: 'ph_stop' }, 'Stop'),
              selWith('ph_stop', ynOptions())
            ),
            el('div', { class: 'form-group' },
              el('label', { for: 'ph_dose_mod' }, 'Dose modification'),
              selWith('ph_dose_mod', ynOptions())
            ),
            el('div', { class: 'form-group' },
              el('label', { for: 'ph_dose_red' }, 'Dose reduction (%)'),
              el('input', { id: 'ph_dose_red', type: 'number', min: '0', max: '100', step: '1', placeholder: 'e.g., 25', inputmode: 'numeric', autocomplete: 'off' })
            )
          ),
          el('div', { class: 'form-group', style:'margin-top:12px;' },
            el('label', { for: 'ph_notes' }, 'Notes'),
            el('textarea', { id: 'ph_notes', rows: 6, placeholder: 'Phone notes…' })
          ),
          el('div', { class: 'card soft mt-2' },
            el('div', { class: 'mb-1 flex items-center justify-between' },
              el('div', { class:'flex items-center gap-2' },
                el('strong', null, 'Previous phone follow-ups'),
                /* === Count Badge (updates from app-phone.table.js) === */
                el('span', {
                  id: 'ph_prev_count_badge',
                  class: 'badge',
                  'aria-live': 'polite',
                  'aria-label': 'Phone follow-ups count: —'
                }, '—')
              ),
              el('small', { id:'ph_edit_hint', class:'muted' }, '')
            ),
            el('div', { class: 'table-host' },
              el('table', { class: 'table', style:'min-width:900px' },
                el('thead', null,
                  el('tr', null,
                    el('th', null, 'Date'),
                    el('th', null, 'Diarrhea'),
                    el('th', null, 'Mucositis'),
                    el('th', null, 'Neutropenia'),
                    el('th', null, 'Fever'),
                    el('th', null, 'DPYD'),
                    el('th', null, 'Other tox'),
                    el('th', null, 'Other grade'),
                    el('th', null, 'Next Due'),
                    el('th', null, 'Actions')
                  )
                ),
                el('tbody', { id: 'ph_prev_tbody' },
                  el('tr', null, el('td', { colspan: 10 }, 'No phone follow-ups yet.'))
                )
              )
            )
          ),
          el('div', { class: 'mt-1' },
            el('div', { class: 'muted mb-1' }, 'Reschedule next follow-up to:'),
            el('div', { class: 'flex items-center gap-2', id:'ph_reschedule_wrap' },
              el('label', { class: 'pill' },
                el('input', { type: 'radio', name: 'ph_reschedule', value: 'none', checked: true }),
                'None'
              ),
              el('label', { class: 'pill' },
                el('input', { type: 'radio', name: 'ph_reschedule', value: '1w' }),
                '1w'
              ),
              el('label', { class: 'pill' },
                el('input', { type: 'radio', name: 'ph_reschedule', value: '2w' }),
                '2w'
              ),
              el('label', { class: 'pill' },
                el('input', { type: 'radio', name: 'ph_reschedule', value: '3w' }),
                '3w'
              ),
              el('label', { class: 'pill' },
                el('input', { type: 'radio', name: 'ph_reschedule', value: '4w' }),
                '4w'
              )
            ),
            el('div', { class: 'form-group mt-1' },
              el('label', { for: 'ph_reschedule_date' }, 'or pick a date:'),
              el('input', { id: 'ph_reschedule_date', type: 'date' })
            ),
            el('small', { id: 'ph_reschedule_hint', class: 'muted' }, '')
          )
        ),
        el('div', { class: 'modal-footer' },
          el('span', { id:'ph_due_badge', class:'badge hidden' }, ''), /* ← badge */
          el('button', { id: 'btn-save-phone', class: 'btn btn-primary' }, 'Save Phone Follow-up'),
          el('button', { id: 'btn-close-phone-2', class: 'btn' }, 'Close')
        )
      )
    );
    return wrap;
  }

  window.PhoneParts = window.PhoneParts || {};
  window.PhoneParts.skeleton = { makeModalSkeleton };
})();
