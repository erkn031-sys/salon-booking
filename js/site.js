/* ==========================================================
   САЙТ — рендер секций, мастер записи в 4 шага, «Мои записи».
   ========================================================== */
(function () {
  const U = Store.util;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const el = (html) => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; };
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const svc = (id) => SERVICES.find((s) => s.id === id);
  const master = (id) => MASTERS.find((m) => m.id === id);
  const cat = (id) => CATEGORIES.find((c) => c.id === id);

  let toastTimer;
  const toast = (msg) => { const t = $('#toast'); t.textContent = msg; t.classList.add('is-on'); clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('is-on'), 2800); };

  /* ---------- статичные данные на страницу ---------- */
  $('#hero-city').textContent = `${SALON.city} · ${SALON.hoursText}`;
  $('#fact-masters').textContent = MASTERS.length;
  $('#fact-services').textContent = SERVICES.length;
  $('#year').textContent = new Date().getFullYear();
  $('#ig-link').href = SALON.instagram;
  $('#wa-link').href = SALON.whatsapp;
  $('#map-address').textContent = SALON.address;
  $('#contacts-list').innerHTML = `
    <dt>Адрес</dt><dd>${esc(SALON.city)}, ${esc(SALON.address)}</dd>
    <dt>Часы</dt><dd>${esc(SALON.hoursText)}</dd>
    <dt>Телефон</dt><dd><a href="tel:${SALON.phoneRaw}">${esc(SALON.phone)}</a></dd>
    <dt>Почта</dt><dd><a href="mailto:${SALON.email}">${esc(SALON.email)}</a></dd>`;

  /* ближайшее свободное окно — живой показатель в hero */
  (function nextSlot() {
    const today = new Date();
    for (let off = 0; off < SALON.daysAhead; off++) {
      const iso = U.toISO(U.addDays(today, off));
      let best = null;
      for (const m of MASTERS) {
        const s = Store.slots(m.id, iso, 45);
        if (s.length && (!best || s[0] < best.time)) best = { time: s[0], m };
      }
      if (best) {
        const when = off === 0 ? 'сегодня' : off === 1 ? 'завтра' : U.fmtDate(iso);
        $('#hero-next').textContent = `Ближайшее окно: ${when} в ${best.time}`;
        $('#hero-next-sub').textContent = `${best.m.name} · ${best.m.role.toLowerCase()}`;
        return;
      }
    }
    $('#hero-next-sub').textContent = 'запись открыта на 3 недели';
  })();

  /* ---------- услуги ---------- */
  let activeCat = 'all';
  const chips = $('#cat-chips');
  chips.append(el(`<button class="chip is-active" data-cat="all">Все</button>`));
  CATEGORIES.forEach((c) => chips.append(el(`<button class="chip" data-cat="${c.id}">${c.name}</button>`)));
  chips.addEventListener('click', (e) => {
    const b = e.target.closest('.chip'); if (!b) return;
    activeCat = b.dataset.cat;
    $$('.chip', chips).forEach((x) => x.classList.toggle('is-active', x === b));
    renderServices();
  });
  function renderServices() {
    const list = $('#services-list'); list.innerHTML = '';
    SERVICES.filter((s) => activeCat === 'all' || s.cat === activeCat).forEach((s) => {
      list.append(el(`
        <button class="service" data-book data-service="${s.id}" aria-label="Записаться: ${esc(s.name)}">
          <span class="service__name">${esc(s.name)}</span>
          <span class="service__price">${U.fmtMoney(s.price)}</span>
          <span class="service__desc">${esc(s.desc)}</span>
          <span class="service__dur">${U.fmtDur(s.min)}</span>
        </button>`));
    });
  }
  renderServices();

  /* ---------- мастера ---------- */
  const daysRow = (m) => [1, 2, 3, 4, 5, 6, 0].map((d) => `<span class="${m.schedule[d] ? 'on' : ''}">${U.DAY_NAMES[d]}</span>`).join('');
  MASTERS.forEach((m) => $('#masters-list').append(el(`
    <article class="master">
      <img class="master__img" src="${m.photo}" alt="${esc(m.name)} — ${esc(m.role)}" loading="lazy" width="900" height="1350">
      <div>
        <h3 class="master__name">${esc(m.name)}</h3>
        <p class="master__role">${esc(m.role)} · ${esc(m.exp)}</p>
      </div>
      <p class="master__bio">${esc(m.bio)}</p>
      <div class="master__days" title="Дни работы">${daysRow(m)}</div>
      <button class="btn btn--ghost btn--sm" data-book data-master="${m.id}" style="align-self:flex-start;margin-top:.25rem">Записаться к ${esc(m.name)}</button>
    </article>`)));

  /* ---------- галерея, отзывы ---------- */
  GALLERY.forEach((g) => $('#gallery-list').append(el(`<figure><img src="${g.src}" alt="${esc(g.alt)}" loading="lazy" width="900" height="1350"><figcaption>${esc(g.label)}</figcaption></figure>`)));
  REVIEWS.forEach((r) => $('#reviews-list').append(el(`<article class="review"><q>${esc(r.text)}</q><footer><b>${esc(r.name)}</b><span>${esc(r.service)}</span></footer></article>`)));

  /* ---------- меню ---------- */
  $('#burger').addEventListener('click', () => $('#nav').classList.toggle('is-open'));
  $('#nav').addEventListener('click', () => $('#nav').classList.remove('is-open'));

  /* ---------- модалки ---------- */
  function openModal(id) { const m = $(id); m.hidden = false; document.body.style.overflow = 'hidden'; }
  function closeModal(id) { const m = $(id); m.hidden = true; document.body.style.overflow = ''; }
  $$('[data-close]').forEach((b) => b.addEventListener('click', () => { closeModal('#book-modal'); closeModal('#visits-modal'); }));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { closeModal('#book-modal'); closeModal('#visits-modal'); } });

  /* ==========================================================
     МАСТЕР ЗАПИСИ
     state: serviceId → masterId ('any' = любой) → date → time → client
     ========================================================== */
  const B = { step: 0, serviceId: null, masterId: null, date: null, time: null, client: { name: '', phone: '', comment: '' }, calMonth: null, result: null };
  const TITLES = ['Выберите услугу', 'Выберите мастера', 'Дата и время', 'Ваши контакты'];

  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-book]'); if (!b) return;
    B.step = 0; B.serviceId = b.dataset.service || null; B.masterId = b.dataset.master || null; B.date = null; B.time = null; B.result = null;
    B.calMonth = null;
    if (B.serviceId) B.step = 1;
    if (B.serviceId && B.masterId) B.step = 2;
    openModal('#book-modal'); renderStep();
  });

  $('#book-back').addEventListener('click', () => { if (B.step > 0) { B.step--; renderStep(); } });
  $('#book-next').addEventListener('click', () => {
    if (B.step === 3) return submit();
    if (B.step < 3) { B.step++; renderStep(); }
  });

  function canNext() {
    return [!!B.serviceId, !!B.masterId, !!(B.date && B.time), true][B.step];
  }

  function renderStep() {
    const body = $('#book-body'); body.innerHTML = '';
    $('#book-foot').hidden = false;
    $('#book-step-label').textContent = `Шаг ${B.step + 1} из 4`;
    $('#book-title').textContent = TITLES[B.step];
    $$('#book-steps span').forEach((s, i) => { s.className = i < B.step ? 'done' : i === B.step ? 'now' : ''; });
    $('#book-back').style.visibility = B.step === 0 ? 'hidden' : 'visible';
    $('#book-next').textContent = B.step === 3 ? 'Подтвердить запись' : 'Далее';

    // сводка выбранного
    const sum = [];
    if (B.serviceId) sum.push(svc(B.serviceId).name);
    if (B.masterId) sum.push(B.masterId === 'any' ? 'Любой мастер' : master(B.masterId).name);
    if (B.date && B.time) sum.push(`${U.fmtDate(B.date, { weekday: true })}, ${B.time}`);
    if (sum.length && B.step > 0) body.append(el(`<div class="summary">${sum.map((s) => `<span>${esc(s)}</span>`).join('')}</div>`));

    [stepService, stepMaster, stepTime, stepClient][B.step](body);
    $('#book-next').disabled = !canNext();
    $('.modal__body', $('#book-modal')).scrollTop = 0;
  }

  /* --- шаг 1: услуга --- */
  function stepService(body) {
    CATEGORIES.forEach((c) => {
      const items = SERVICES.filter((s) => s.cat === c.id);
      const g = el(`<div class="pick-group"><h4>${c.name}</h4><div class="pick-list"></div></div>`);
      items.forEach((s) => {
        const p = el(`<button class="pick ${B.serviceId === s.id ? 'is-selected' : ''}"><b>${esc(s.name)}</b><span class="price">${U.fmtMoney(s.price)}</span><small>${U.fmtDur(s.min)} · ${esc(s.desc)}</small></button>`);
        p.addEventListener('click', () => {
          B.serviceId = s.id;
          if (B.masterId && B.masterId !== 'any' && !master(B.masterId).cats.includes(s.cat)) B.masterId = null;
          B.date = null; B.time = null;
          $$('.pick', body).forEach((x) => x.classList.toggle('is-selected', x === p));
          $('#book-next').disabled = false;
        });
        $('.pick-list', g).append(p);
      });
      body.append(g);
    });
  }

  /* --- шаг 2: мастер --- */
  function stepMaster(body) {
    const list = Store.mastersFor(B.serviceId);
    const wrap = el(`<div class="pick-masters"></div>`);
    const add = (id, html) => {
      const p = el(`<button class="pick-master ${B.masterId === id ? 'is-selected' : ''}">${html}</button>`);
      p.addEventListener('click', () => { B.masterId = id; B.date = null; B.time = null; $$('.pick-master', body).forEach((x) => x.classList.toggle('is-selected', x === p)); $('#book-next').disabled = false; });
      wrap.append(p);
    };
    if (list.length > 1) add('any', `<span class="any">✦</span><div><b>Любой мастер</b><small>покажем все свободные окна</small></div>`);
    list.forEach((m) => add(m.id, `<img src="${m.photo}" alt=""><div><b>${esc(m.name)}</b><small>${esc(m.role)} · ${esc(m.exp)}</small></div>`));
    body.append(wrap);
    if (list.length === 1 && !B.masterId) { B.masterId = list[0].id; $('.pick-master', wrap).classList.add('is-selected'); }
  }

  /* --- шаг 3: дата и время --- */
  function stepTime(body) {
    const dur = svc(B.serviceId).min;
    const ids = B.masterId === 'any' ? Store.mastersFor(B.serviceId).map((m) => m.id) : [B.masterId];
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const last = U.addDays(today, SALON.daysAhead - 1);
    if (!B.calMonth) B.calMonth = new Date(today.getFullYear(), today.getMonth(), 1);

    const cal = el(`<div class="cal"><div class="cal__head"><button class="cal__nav" data-prev aria-label="Предыдущий месяц">‹</button><b></b><button class="cal__nav" data-next aria-label="Следующий месяц">›</button></div><div class="cal__grid"></div></div>`);
    const slotsBox = el(`<div id="slots-box"></div>`);
    body.append(cal, slotsBox);

    function drawCal() {
      const y = B.calMonth.getFullYear(), mo = B.calMonth.getMonth();
      $('b', cal).textContent = `${U.MONTHS_NOM[mo]} ${y}`;
      $('[data-prev]', cal).disabled = B.calMonth <= new Date(today.getFullYear(), today.getMonth(), 1);
      $('[data-next]', cal).disabled = new Date(y, mo + 1, 1) > last;
      const grid = $('.cal__grid', cal); grid.innerHTML = '';
      ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].forEach((d) => grid.append(el(`<div class="cal__wd">${d}</div>`)));
      const first = new Date(y, mo, 1); const lead = (first.getDay() + 6) % 7;
      for (let i = 0; i < lead; i++) grid.append(el(`<div></div>`));
      const days = new Date(y, mo + 1, 0).getDate();
      for (let d = 1; d <= days; d++) {
        const date = new Date(y, mo, d); const iso = U.toISO(date);
        const inRange = date >= today && date <= last;
        const has = inRange && Store.dayHasSlots(ids, iso, dur);
        const b = el(`<button class="cal__day ${has ? 'has' : ''} ${iso === B.date ? 'is-selected' : ''} ${iso === U.toISO(today) ? 'today' : ''}" ${has ? '' : 'disabled'}>${d}</button>`);
        b.addEventListener('click', () => { B.date = iso; B.time = null; $$('.cal__day', grid).forEach((x) => x.classList.toggle('is-selected', x === b)); drawSlots(); $('#book-next').disabled = true; });
        grid.append(b);
      }
    }
    function drawSlots() {
      slotsBox.innerHTML = '';
      if (!B.date) { slotsBox.append(el(`<div class="slots-empty">Выберите день — покажем свободное время</div>`)); return; }
      let any = false;
      ids.forEach((id) => {
        const s = Store.slots(id, B.date, dur);
        if (!s.length) return;
        any = true;
        const g = el(`<div class="slot-group">${ids.length > 1 ? `<h4>${esc(master(id).name)} · ${esc(master(id).role)}</h4>` : ''}<div class="slots"></div></div>`);
        s.forEach((t) => {
          const end = U.toHHMM(U.toMin(t) + dur);
          const b = el(`<button class="slot ${B.time === t && B._slotMaster === id ? 'is-selected' : ''}">${t}<small>до ${end}</small></button>`);
          b.addEventListener('click', () => { B.time = t; B._slotMaster = id; $$('.slot', slotsBox).forEach((x) => x.classList.toggle('is-selected', x === b)); $('#book-next').disabled = false; });
          $('.slots', g).append(b);
        });
        slotsBox.append(g);
      });
      if (!any) slotsBox.append(el(`<div class="slots-empty">На этот день свободных окон нет</div>`));
    }
    $('[data-prev]', cal).addEventListener('click', () => { B.calMonth = new Date(B.calMonth.getFullYear(), B.calMonth.getMonth() - 1, 1); drawCal(); });
    $('[data-next]', cal).addEventListener('click', () => { B.calMonth = new Date(B.calMonth.getFullYear(), B.calMonth.getMonth() + 1, 1); drawCal(); });
    drawCal(); drawSlots();
  }

  /* --- шаг 4: контакты + подтверждение --- */
  function stepClient(body) {
    const s = svc(B.serviceId); const m = master(B._slotMaster || B.masterId);
    body.append(el(`
      <div class="receipt" style="margin-bottom:1.25rem">
        <div class="receipt__row"><span>Услуга</span><b>${esc(s.name)}</b></div>
        <div class="receipt__row"><span>Мастер</span><b>${esc(m.name)}</b></div>
        <div class="receipt__row"><span>Когда</span><b>${U.fmtDate(B.date, { weekday: true })}, ${B.time}–${U.toHHMM(U.toMin(B.time) + s.min)}</b></div>
        <div class="receipt__row"><span>Длительность</span><b>${U.fmtDur(s.min)}</b></div>
        <div class="receipt__row total"><span>К оплате в салоне</span><b>${U.fmtMoney(s.price)}</b></div>
      </div>`));
    const f = el(`
      <form class="form" id="client-form" novalidate>
        <div class="form__row">
          <div class="field"><label for="c-name">Имя</label><input id="c-name" autocomplete="name" placeholder="Как к вам обращаться" value="${esc(B.client.name)}" required><span class="err">Укажите имя</span></div>
          <div class="field"><label for="c-phone">Телефон</label><input id="c-phone" type="tel" autocomplete="tel" placeholder="+7 700 000 00 00" value="${esc(B.client.phone)}" required><span class="err">Введите номер в формате +7 700 000 00 00</span></div>
        </div>
        <div class="field"><label for="c-comment">Комментарий <span class="muted" style="font-weight:400">(необязательно)</span></label><textarea id="c-comment" placeholder="Пожелания, аллергии, длина волос…">${esc(B.client.comment)}</textarea></div>
        <p class="small muted">Нажимая «Подтвердить», вы соглашаетесь на обработку данных для записи. Отменить визит можно в разделе «Мои записи».</p>
      </form>`);
    body.append(f);
    f.addEventListener('input', (e) => { B.client = { name: $('#c-name').value, phone: $('#c-phone').value, comment: $('#c-comment').value }; e.target.closest('.field')?.classList.remove('invalid'); });
    f.addEventListener('submit', (e) => { e.preventDefault(); submit(); });
  }

  function submit() {
    const nameF = $('#c-name').closest('.field'), phoneF = $('#c-phone').closest('.field');
    const okName = B.client.name.trim().length >= 2;
    const okPhone = U.normPhone(B.client.phone).length === 11;
    nameF.classList.toggle('invalid', !okName); phoneF.classList.toggle('invalid', !okPhone);
    if (!okName || !okPhone) return;
    try {
      B.result = Store.create({ serviceId: B.serviceId, masterId: B._slotMaster || B.masterId, date: B.date, time: B.time, client: B.client, source: 'site' });
    } catch (err) { toast(err.message); B.step = 2; renderStep(); return; }
    localStorage.setItem('elan.lastPhone', U.normPhone(B.client.phone));
    renderSuccess();
  }

  function renderSuccess() {
    const b = B.result; const s = svc(b.serviceId); const m = master(b.masterId);
    $('#book-step-label').textContent = 'Готово';
    $('#book-title').textContent = 'Вы записаны';
    $('#book-foot').hidden = true;
    $('#book-body').innerHTML = '';
    $('#book-body').append(el(`
      <div class="success">
        <div class="success__icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg></div>
        <h3>${esc(b.client.name)}, ждём вас ${U.fmtDate(b.date)} в ${b.time}</h3>
        <p class="lead" style="text-align:center">${esc(s.name)} у мастера ${esc(m.name)}. Мы напомним о визите за день. Номер записи:</p>
        <span class="code">${b.id}</span>
        <div class="hero__cta" style="justify-content:center;margin-top:.5rem">
          <button class="btn btn--primary" data-open-visits>Мои записи</button>
          <button class="btn btn--ghost" data-close>Закрыть</button>
        </div>
      </div>`));
    $$('[data-close]', $('#book-body')).forEach((x) => x.addEventListener('click', () => closeModal('#book-modal')));
  }

  /* ==========================================================
     МОИ ЗАПИСИ — поиск по телефону, отмена
     ========================================================== */
  document.addEventListener('click', (e) => {
    if (!e.target.closest('[data-open-visits]')) return;
    closeModal('#book-modal'); openModal('#visits-modal');
    const p = localStorage.getItem('elan.lastPhone');
    if (p) { $('#visits-phone').value = U.fmtPhone(p); renderVisits(p); } else { $('#visits-list').innerHTML = ''; }
  });
  $('#visits-form').addEventListener('submit', (e) => { e.preventDefault(); renderVisits($('#visits-phone').value); });

  function renderVisits(phone) {
    const box = $('#visits-list'); box.innerHTML = '';
    if (U.normPhone(phone).length !== 11) { box.append(el(`<div class="slots-empty">Введите номер полностью</div>`)); return; }
    const list = Store.byPhone(phone);
    if (!list.length) { box.append(el(`<div class="slots-empty">Записей по этому номеру пока нет</div>`)); return; }
    const todayISO = U.toISO(new Date());
    const upcoming = list.filter((b) => b.date >= todayISO && b.status !== 'cancelled' && b.status !== 'done');
    const past = list.filter((b) => !upcoming.includes(b)).reverse();
    const STATUS = { new: 'Ожидает подтверждения', confirmed: 'Подтверждена', done: 'Завершена', cancelled: 'Отменена' };
    const card = (b, canCancel) => {
      const d = U.fromISO(b.date);
      const c = el(`
        <div class="booking">
          <div class="booking__date"><b>${d.getDate()}</b><span>${U.MONTHS[d.getMonth()].slice(0, 3)}</span></div>
          <div class="booking__info"><b>${esc(svc(b.serviceId).name)}</b><span>${b.time} · ${esc(master(b.masterId).name)} · ${U.fmtMoney(b.price)}</span></div>
          <div class="booking__side"><span class="status status--${b.status}">${STATUS[b.status]}</span>${canCancel ? `<button class="btn btn--danger btn--sm" data-cancel>Отменить</button>` : ''}</div>
        </div>`);
      if (canCancel) $('[data-cancel]', c).addEventListener('click', () => {
        if (!confirm(`Отменить запись ${U.fmtDate(b.date)} в ${b.time}?`)) return;
        Store.setStatus(b.id, 'cancelled'); toast('Запись отменена'); renderVisits(phone);
      });
      return c;
    };
    if (upcoming.length) { box.append(el(`<h4 class="eyebrow" style="margin-bottom:.75rem">Предстоящие</h4>`)); const w = el(`<div class="bookings" style="margin-bottom:1.5rem"></div>`); upcoming.forEach((b) => w.append(card(b, true))); box.append(w); }
    if (past.length) { box.append(el(`<h4 class="eyebrow" style="margin-bottom:.75rem">История</h4>`)); const w = el(`<div class="bookings"></div>`); past.forEach((b) => w.append(card(b, false))); box.append(w); }
  }
})();
