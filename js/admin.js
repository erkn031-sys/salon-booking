/* ==========================================================
   АДМИН-ПАНЕЛЬ — вход по PIN, расписание дня, неделя,
   журнал записей, клиенты, блокировки времени.
   ========================================================== */
(function () {
  const U = Store.util;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const el = (html) => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; };
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const svc = (id) => SERVICES.find((s) => s.id === id);
  const master = (id) => MASTERS.find((m) => m.id === id);
  const STATUS = { new: 'Новая', confirmed: 'Подтверждена', done: 'Завершена', cancelled: 'Отменена' };
  const todayISO = () => U.toISO(new Date());

  let toastTimer;
  const toast = (msg) => { const t = $('#toast'); t.textContent = msg; t.classList.add('is-on'); clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('is-on'), 2600); };

  /* ---------- вход ---------- */
  const pinInputs = $$('#pin input');
  pinInputs.forEach((inp, i) => {
    inp.addEventListener('input', () => { inp.value = inp.value.replace(/\D/g, '').slice(-1); if (inp.value && pinInputs[i + 1]) pinInputs[i + 1].focus(); if (i === 3 && inp.value) $('#login-form').requestSubmit(); });
    inp.addEventListener('keydown', (e) => { if (e.key === 'Backspace' && !inp.value && pinInputs[i - 1]) pinInputs[i - 1].focus(); });
  });
  $('#login-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const pin = pinInputs.map((x) => x.value).join('');
    if (pin === SALON.adminPin) { sessionStorage.setItem('elan.admin', '1'); enter(); }
    else { $('#login-hint').textContent = 'Неверный PIN, попробуйте ещё раз'; $('#login-hint').style.color = 'var(--red)'; pinInputs.forEach((x) => (x.value = '')); pinInputs[0].focus(); }
  });
  $('#logout').addEventListener('click', (e) => { e.preventDefault(); sessionStorage.removeItem('elan.admin'); location.reload(); });

  function enter() {
    $('#login').hidden = true; $('#app').hidden = false;
    initSelects(); route();
  }

  /* ---------- навигация по вкладкам ---------- */
  const tabs = $('#tabs');
  window.addEventListener('hashchange', route);
  function route() {
    const tab = (location.hash || '#today').slice(1);
    $$('a', tabs).forEach((a) => a.classList.toggle('is-active', a.dataset.tab === tab));
    $$('[data-view]').forEach((v) => (v.hidden = v.dataset.view !== tab));
    ({ today: renderDay, week: renderWeek, list: renderList, clients: renderClients, settings: renderSettings })[tab]?.();
  }
  const refresh = () => route();

  /* ---------- селекты ---------- */
  function initSelects() {
    const ms = MASTERS.map((m) => `<option value="${m.id}">${esc(m.name)} · ${esc(m.role)}</option>`).join('');
    $('#f-master').innerHTML = '<option value="">Все мастера</option>' + ms;
    $('#b-master').innerHTML = ms;
    $('#n-service').innerHTML = CATEGORIES.map((c) => `<optgroup label="${c.name}">${SERVICES.filter((s) => s.cat === c.id).map((s) => `<option value="${s.id}">${esc(s.name)} — ${U.fmtMoney(s.price)}</option>`).join('')}</optgroup>`).join('');
    $('#b-date').value = todayISO(); $('#n-date').value = todayISO();
  }

  /* ==========================================================
     СЕГОДНЯ — KPI + таймлайн по мастерам
     ========================================================== */
  let day = todayISO();
  $('#day-date').value = day;
  $('#day-date').addEventListener('change', (e) => { day = e.target.value || todayISO(); renderDay(); });
  $('#day-prev').addEventListener('click', () => { day = U.toISO(U.addDays(U.fromISO(day), -1)); renderDay(); });
  $('#day-next').addEventListener('click', () => { day = U.toISO(U.addDays(U.fromISO(day), 1)); renderDay(); });
  $('#day-today').addEventListener('click', () => { day = todayISO(); renderDay(); });

  function renderDay() {
    $('#day-date').value = day;
    const d = U.fromISO(day);
    $('#today-title').textContent = day === todayISO() ? 'Сегодня' : U.fmtDate(day);
    $('#today-eyebrow').textContent = `${U.DAY_FULL[d.getDay()]}, ${U.fmtDate(day)} · ${SALON.name}`;

    const items = Store.forDate(day);
    const all = Store.all().filter((b) => b.date === day);
    const revenue = items.filter((b) => b.status !== 'cancelled').reduce((s, b) => s + b.price, 0);
    const loads = MASTERS.map((m) => Store.load(m.id, day)).filter((x) => x !== null);
    const avgLoad = loads.length ? Math.round(loads.reduce((a, b) => a + b, 0) / loads.length) : 0;
    const news = all.filter((b) => b.status === 'new').length;
    $('#kpis').innerHTML = `
      <div class="kpi"><span>Записей</span><b>${items.length}</b><small>${all.length - items.length} отменено</small></div>
      <div class="kpi"><span>Выручка план</span><b>${revenue.toLocaleString('ru-RU')}</b><small>${SALON.currency} по прайсу</small></div>
      <div class="kpi"><span>Загрузка</span><b>${avgLoad}%</b><small>среднее по мастерам</small></div>
      <div class="kpi"><span>Ждут подтверждения</span><b>${news}</b><small>${news ? 'откройте запись и подтвердите' : 'всё подтверждено'}</small></div>`;

    // таймлайн
    const HH = 56; // px в часе
    const working = MASTERS.filter((m) => Store.workHours(m.id, day));
    const cols = working.length ? working : MASTERS;
    let start = 24 * 60, end = 0;
    cols.forEach((m) => { const w = Store.workHours(m.id, day); if (w) { start = Math.min(start, w.from); end = Math.max(end, w.to); } });
    if (start >= end) { start = 10 * 60; end = 21 * 60; }
    const tl = $('#timeline'); tl.innerHTML = ''; tl.style.setProperty('--cols', cols.length); tl.style.setProperty('--hh', HH + 'px');
    tl.append(el(`<div class="tl__corner"></div>`));
    cols.forEach((m) => { const l = Store.load(m.id, day); tl.append(el(`<div class="tl__master"><img src="${m.photo}" alt=""><div><b>${esc(m.name)}</b><small>${l === null ? 'выходной' : `загрузка ${l}%`}</small></div></div>`)); });
    const hours = el(`<div class="tl__hours"></div>`);
    for (let t = start; t < end; t += 60) hours.append(el(`<div class="tl__hour">${U.toHHMM(t)}</div>`));
    tl.append(hours);
    const px = (min) => ((min - start) / 60) * HH;
    cols.forEach((m) => {
      const col = el(`<div class="tl__col" style="height:${px(end)}px"></div>`);
      const w = Store.workHours(m.id, day);
      if (!w) col.append(el(`<div class="tl__off" style="top:0;height:${px(end)}px"></div>`));
      else {
        if (w.from > start) col.append(el(`<div class="tl__off" style="top:0;height:${px(w.from)}px"></div>`));
        if (w.to < end) col.append(el(`<div class="tl__off" style="top:${px(w.to)}px;height:${px(end) - px(w.to)}px"></div>`));
      }
      Store.blocks().filter((k) => k.masterId === m.id && k.date === day).forEach((k) => {
        const it = el(`<div class="tl__item tl__item--block" style="top:${px(U.toMin(k.from)) + 1}px;height:${px(U.toMin(k.to)) - px(U.toMin(k.from)) - 2}px"><b>${esc(k.reason || 'Перерыв')}</b><span>${k.from}–${k.to}</span></div>`);
        it.addEventListener('click', () => { if (confirm('Снять блокировку?')) { Store.removeBlock(k.id); toast('Блокировка снята'); renderDay(); } });
        col.append(it);
      });
      items.filter((b) => b.masterId === m.id).forEach((b) => {
        const it = el(`<div class="tl__item tl__item--${b.status}" style="top:${px(U.toMin(b.time)) + 1}px;height:${(b.min / 60) * HH - 2}px"><b>${b.time} · ${esc(b.client.name)}</b><span>${esc(svc(b.serviceId).name)}</span></div>`);
        it.addEventListener('click', () => openDrawer(b.id));
        col.append(it);
      });
      tl.append(col);
    });
  }

  /* ==========================================================
     НЕДЕЛЯ — матрица мастер × день
     ========================================================== */
  let weekOff = 0;
  $('#week-prev').addEventListener('click', () => { weekOff--; renderWeek(); });
  $('#week-next').addEventListener('click', () => { weekOff++; renderWeek(); });
  function renderWeek() {
    const t = new Date(); t.setHours(0, 0, 0, 0);
    const mon = U.addDays(t, -((t.getDay() + 6) % 7) + weekOff * 7);
    const days = [...Array(7)].map((_, i) => U.toISO(U.addDays(mon, i)));
    $('#week-title').textContent = `${U.fmtDate(days[0])} — ${U.fmtDate(days[6])}`;
    const w = $('#week'); w.innerHTML = '';
    w.append(el(`<div></div>`));
    days.forEach((iso) => { const d = U.fromISO(iso); w.append(el(`<div class="week__hd ${iso === todayISO() ? 'today' : ''}">${U.DAY_NAMES[d.getDay()]}<b>${d.getDate()}</b></div>`)); });
    MASTERS.forEach((m) => {
      w.append(el(`<div class="week__m"><img src="${m.photo}" alt=""><span>${esc(m.name)}</span></div>`));
      days.forEach((iso) => {
        const load = Store.load(m.id, iso);
        if (load === null) { w.append(el(`<div class="week__cell off">—</div>`)); return; }
        const n = Store.forDate(iso).filter((b) => b.masterId === m.id).length;
        const bg = load >= 75 ? 'var(--green)' : load >= 40 ? 'var(--green-soft)' : 'var(--bg-2)';
        const fg = load >= 75 ? '#fff' : 'var(--ink)';
        const c = el(`<div class="week__cell" style="background:${bg};color:${fg}"><b>${n}</b><small>${load}%</small></div>`);
        c.addEventListener('click', () => { day = iso; location.hash = '#today'; });
        w.append(c);
      });
    });
  }

  /* ==========================================================
     ЖУРНАЛ
     ========================================================== */
  ['#f-q', '#f-status', '#f-master', '#f-period'].forEach((s) => $(s).addEventListener('input', renderList));
  function filtered() {
    const q = $('#f-q').value.trim().toLowerCase(), st = $('#f-status').value, mid = $('#f-master').value, per = $('#f-period').value;
    const t = todayISO();
    return Store.all().filter((b) => {
      if (st && b.status !== st) return false;
      if (mid && b.masterId !== mid) return false;
      if (per === 'upcoming' && b.date < t) return false;
      if (per === 'today' && b.date !== t) return false;
      if (per === 'past' && b.date >= t) return false;
      if (q && !(b.client.name.toLowerCase().includes(q) || b.client.phone.includes(q.replace(/\D/g, '') || '§') || b.id.toLowerCase().includes(q))) return false;
      return true;
    }).sort((a, b) => per === 'past' ? (b.date + b.time).localeCompare(a.date + a.time) : (a.date + a.time).localeCompare(b.date + b.time));
  }
  function renderList() {
    const rows = filtered(); const tb = $('#list-body'); tb.innerHTML = '';
    $('#list-empty').hidden = rows.length > 0;
    rows.slice(0, 200).forEach((b) => {
      const tr = el(`<tr>
        <td><b>${U.fmtDate(b.date)}</b><span class="sub">${U.DAY_NAMES[U.fromISO(b.date).getDay()]} · ${b.time}–${U.toHHMM(U.toMin(b.time) + b.min)}</span></td>
        <td><b>${esc(b.client.name)}</b><span class="sub">${U.fmtPhone(b.client.phone)}</span></td>
        <td>${esc(svc(b.serviceId).name)}<span class="sub">${U.fmtDur(b.min)}</span></td>
        <td>${esc(master(b.masterId).name)}</td>
        <td>${U.fmtMoney(b.price)}</td>
        <td><span class="status status--${b.status}">${STATUS[b.status]}</span></td>
        <td><div class="row-actions">
          ${b.status === 'new' ? `<button class="icon-btn" title="Подтвердить" data-act="confirmed"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg></button>` : ''}
          <button class="icon-btn" title="Открыть" data-act="open"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 6l6 6-6 6"/></svg></button>
        </div></td></tr>`);
      tr.addEventListener('click', (e) => {
        const a = e.target.closest('[data-act]');
        if (a && a.dataset.act !== 'open') { Store.setStatus(b.id, a.dataset.act); toast('Запись подтверждена'); renderList(); return; }
        openDrawer(b.id);
      });
      tb.append(tr);
    });
  }
  $('#export-csv').addEventListener('click', () => {
    const rows = [['Номер', 'Дата', 'Время', 'Клиент', 'Телефон', 'Услуга', 'Мастер', 'Сумма', 'Статус', 'Источник', 'Комментарий']];
    filtered().forEach((b) => rows.push([b.id, b.date, b.time, b.client.name, '+' + b.client.phone, svc(b.serviceId).name, master(b.masterId).name, b.price, STATUS[b.status], b.source, b.client.comment]));
    const csv = '\uFEFF' + rows.map((r) => r.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(';')).join('\n');
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' })); a.download = `elan-bookings-${todayISO()}.csv`; a.click();
  });

  /* ==========================================================
     КЛИЕНТЫ — агрегат по телефону
     ========================================================== */
  function renderClients() {
    const map = new Map();
    Store.all().forEach((b) => {
      const c = map.get(b.client.phone) || { name: b.client.name, phone: b.client.phone, visits: 0, spent: 0, last: '', svc: {} };
      if (b.status === 'done') { c.visits++; c.spent += b.price; if (b.date > c.last) c.last = b.date; }
      c.svc[b.serviceId] = (c.svc[b.serviceId] || 0) + 1; c.name = b.client.name;
      map.set(b.client.phone, c);
    });
    const list = [...map.values()].sort((a, b) => b.spent - a.spent);
    const tb = $('#clients-body'); tb.innerHTML = '';
    list.forEach((c) => {
      const fav = Object.entries(c.svc).sort((a, b) => b[1] - a[1])[0];
      const tr = el(`<tr><td><b>${esc(c.name)}</b></td><td>${U.fmtPhone(c.phone)}</td><td>${c.visits}</td><td>${U.fmtMoney(c.spent)}</td><td>${c.last ? U.fmtDate(c.last) : '—'}</td><td>${esc(svc(fav[0]).name)}</td></tr>`);
      tr.style.cursor = 'pointer';
      tr.addEventListener('click', () => { $('#f-q').value = U.fmtPhone(c.phone); $('#f-period').value = 'all'; location.hash = '#list'; });
      tb.append(tr);
    });
  }

  /* ==========================================================
     БЛОКИРОВКИ / НАСТРОЙКИ
     ========================================================== */
  $('#b-allday').addEventListener('change', (e) => { $('#b-from').disabled = $('#b-to').disabled = e.target.checked; });
  $('#block-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const masterId = $('#b-master').value, date = $('#b-date').value;
    let from = $('#b-from').value, to = $('#b-to').value;
    if ($('#b-allday').checked) { const w = Store.workHours(masterId, date); if (!w) return toast('В этот день мастер и так не работает'); from = U.toHHMM(w.from); to = U.toHHMM(w.to); }
    if (!date || !from || !to || from >= to) return toast('Проверьте дату и время');
    const clash = Store.forDate(date).filter((b) => b.masterId === masterId && U.toMin(b.time) < U.toMin(to) && U.toMin(b.time) + b.min > U.toMin(from));
    if (clash.length && !confirm(`В этот интервал уже есть ${clash.length} запись(ей). Всё равно заблокировать? Клиентов нужно будет перенести вручную.`)) return;
    Store.addBlock({ masterId, date, from, to, reason: $('#b-reason').value.trim() || ($('#b-allday').checked ? 'Выходной' : 'Перерыв') });
    toast('Время заблокировано'); $('#b-reason').value = ''; renderSettings();
  });
  $('#reset-demo').addEventListener('click', () => { if (confirm('Удалить все записи и создать демо-данные заново?')) { Store.resetDemo(); toast('Демо-данные обновлены'); refresh(); } });
  function renderSettings() {
    const list = Store.blocks().filter((k) => k.date >= todayISO()).sort((a, b) => (a.date + a.from).localeCompare(b.date + b.from));
    const box = $('#blocks-list'); box.innerHTML = '';
    if (!list.length) box.append(el(`<p class="small muted">Активных блокировок нет</p>`));
    list.forEach((k) => {
      const row = el(`<div class="block"><div><b>${esc(master(k.masterId).name)}</b> · ${U.fmtDate(k.date, { weekday: true })}, ${k.from}–${k.to}<span class="sub" style="display:block;font-size:.78rem;color:var(--muted)">${esc(k.reason)}</span></div><button class="icon-btn" title="Удалить">✕</button></div>`);
      $('button', row).addEventListener('click', () => { Store.removeBlock(k.id); renderSettings(); });
      box.append(row);
    });
  }

  /* ==========================================================
     ДЕТАЛИ ЗАПИСИ (drawer)
     ========================================================== */
  function openDrawer(id) {
    const b = Store.get(id); if (!b) return;
    const s = svc(b.serviceId), m = master(b.masterId);
    const p = $('#drawer-panel'); p.innerHTML = '';
    p.append(el(`<div style="display:contents">
      <div class="drawer__head"><div><span class="eyebrow">${b.id} · ${b.source === 'site' ? 'с сайта' : 'создана админом'}</span><h3>${esc(b.client.name)}</h3></div><button class="modal__close" data-close aria-label="Закрыть">✕</button></div>
      <div class="receipt">
        <div class="receipt__row"><span>Телефон</span><b><a href="tel:+${b.client.phone}">${U.fmtPhone(b.client.phone)}</a></b></div>
        <div class="receipt__row"><span>Услуга</span><b>${esc(s.name)}</b></div>
        <div class="receipt__row"><span>Мастер</span><b>${esc(m.name)}</b></div>
        <div class="receipt__row"><span>Когда</span><b>${U.fmtDate(b.date, { weekday: true })}, ${b.time}–${U.toHHMM(U.toMin(b.time) + b.min)}</b></div>
        <div class="receipt__row total"><span>Сумма</span><b>${U.fmtMoney(b.price)}</b></div>
        ${b.client.comment ? `<div class="receipt__row"><span>Комментарий</span><b style="font-weight:400">${esc(b.client.comment)}</b></div>` : ''}
      </div>
      <div><span class="eyebrow" style="display:block;margin-bottom:.6rem">Статус</span><div class="status-picker">${Object.entries(STATUS).map(([k, v]) => `<button type="button" data-status="${k}" class="${b.status === k ? 'is-on' : ''}">${v}</button>`).join('')}</div></div>
      <div style="display:flex;gap:.5rem;flex-wrap:wrap">
        <a class="btn btn--light btn--sm" href="https://wa.me/${b.client.phone}?text=${encodeURIComponent(`Здравствуйте, ${b.client.name}! Напоминаем о записи в ${SALON.name}: ${s.name}, ${U.fmtDate(b.date)} в ${b.time}, мастер ${m.name}. Ждём вас!`)}" target="_blank" rel="noopener">Напомнить в WhatsApp</a>
        <button class="btn btn--danger btn--sm" data-delete>Удалить запись</button>
      </div>
      <p class="small muted">Создана ${new Date(b.createdAt).toLocaleString('ru-RU', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}</p></div>`));
    $$('[data-status]', p).forEach((btn) => btn.addEventListener('click', () => { Store.setStatus(b.id, btn.dataset.status); $$('[data-status]', p).forEach((x) => x.classList.toggle('is-on', x === btn)); toast(`Статус: ${STATUS[btn.dataset.status]}`); refresh(); }));
    $('[data-delete]', p).addEventListener('click', () => { if (confirm('Удалить запись безвозвратно?')) { Store.remove(b.id); closeAll(); toast('Запись удалена'); refresh(); } });
    $('#drawer').hidden = false;
  }

  /* ==========================================================
     НОВАЯ ЗАПИСЬ ОТ АДМИНА
     ========================================================== */
  $('#new-booking').addEventListener('click', () => { $('#new-modal').hidden = false; $('#n-date').value = day; syncMasters(); });
  $('#n-service').addEventListener('change', syncMasters);
  $('#n-master').addEventListener('change', syncTimes);
  $('#n-date').addEventListener('change', syncTimes);
  function syncMasters() {
    const ms = Store.mastersFor($('#n-service').value);
    $('#n-master').innerHTML = ms.map((m) => `<option value="${m.id}">${esc(m.name)}</option>`).join('');
    syncTimes();
  }
  function syncTimes() {
    const s = svc($('#n-service').value); const list = Store.slots($('#n-master').value, $('#n-date').value, s.min);
    $('#n-time').innerHTML = list.length ? list.map((t) => `<option>${t}</option>`).join('') : '<option value="">нет свободных окон</option>';
  }
  $('#new-form').addEventListener('submit', (e) => {
    e.preventDefault();
    if (!$('#n-time').value) return toast('Нет свободного времени — выберите другой день');
    if (U.normPhone($('#n-phone').value).length !== 11) return toast('Проверьте номер телефона');
    try {
      Store.create({ serviceId: $('#n-service').value, masterId: $('#n-master').value, date: $('#n-date').value, time: $('#n-time').value, client: { name: $('#n-name').value, phone: $('#n-phone').value, comment: $('#n-comment').value }, status: 'confirmed', source: 'admin' });
    } catch (err) { return toast(err.message); }
    closeAll(); toast('Запись создана'); $('#new-form').reset(); day = $('#n-date').value || day; refresh();
  });

  /* ---------- закрытие оверлеев ---------- */
  function closeAll() { $('#drawer').hidden = true; $('#new-modal').hidden = true; }
  document.addEventListener('click', (e) => { if (e.target.closest('[data-close]')) closeAll(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeAll(); });

  /* ---------- старт ---------- */
  if (sessionStorage.getItem('elan.admin') === '1') enter(); else pinInputs[0].focus();
})();
