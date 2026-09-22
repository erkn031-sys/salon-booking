/* ==========================================================
   STORE — хранилище записей и движок расчёта свободных слотов.

   В демо данные лежат в хранилище браузера (Web Storage). Чтобы подключить
   настоящий сервер, достаточно заменить методы load()/save()
   (или конкретные методы create/update) на fetch() к вашему API —
   остальной код сайта и админки менять не нужно.
   ========================================================== */

(function () {
  /* Безопасная обёртка над хранилищем: если Web Storage недоступен
     (приватный режим, iframe с ограничениями) — данные живут в памяти страницы. */
  const mem = {};
  const makeStorage = (kind) => {
    try { const s = window[kind + 'Storage']; s.setItem('__t', '1'); s.removeItem('__t'); return s; }
    catch { return { getItem: (k) => (k in mem ? mem[k] : null), setItem: (k, v) => { mem[k] = String(v); }, removeItem: (k) => { delete mem[k]; } }; }
  };
  const store = makeStorage('local');
  const session = makeStorage('session');

  const KEY = 'elan.bookings.v1';
  const BLOCK_KEY = 'elan.blocks.v1';

  /* ---------- утилиты дат ---------- */
  const pad = (n) => String(n).padStart(2, '0');
  const toISO = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const fromISO = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
  const toMin = (hhmm) => { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m; };
  const toHHMM = (min) => `${pad(Math.floor(min / 60))}:${pad(min % 60)}`;
  const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
  const uid = () => Math.random().toString(36).slice(2, 8).toUpperCase();

  const DAY_NAMES = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
  const DAY_FULL = ['воскресенье', 'понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота'];
  const MONTHS = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
  const MONTHS_NOM = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];

  const fmtDate = (iso, opts = {}) => {
    const d = fromISO(iso);
    const base = `${d.getDate()} ${MONTHS[d.getMonth()]}`;
    return opts.weekday ? `${DAY_NAMES[d.getDay()]}, ${base}` : base;
  };
  const fmtMoney = (n) => `${n.toLocaleString('ru-RU')} ${SALON.currency}`;
  const fmtDur = (min) => min >= 60 ? (min % 60 ? `${Math.floor(min / 60)} ч ${min % 60} мин` : `${min / 60} ч`) : `${min} мин`;

  /* ---------- нормализация телефона ---------- */
  const normPhone = (p) => {
    let digits = (p || '').replace(/\D/g, '');
    if (digits.length === 11 && digits[0] === '8') digits = '7' + digits.slice(1);
    if (digits.length === 10) digits = '7' + digits;
    return digits;
  };
  const fmtPhone = (p) => {
    const d = normPhone(p);
    if (d.length !== 11) return p;
    return `+${d[0]} ${d.slice(1, 4)} ${d.slice(4, 7)} ${d.slice(7, 9)} ${d.slice(9)}`;
  };

  /* ---------- загрузка / сохранение ---------- */
  const load = (k) => { try { return JSON.parse(store.getItem(k)) || []; } catch { return []; } };
  const save = (k, v) => store.setItem(k, JSON.stringify(v));

  const byId = (arr, id) => arr.find((x) => x.id === id);

  /* ---------- модель ----------
     booking = {
       id, serviceId, masterId, date 'YYYY-MM-DD', time 'HH:MM', min, price,
       client: { name, phone, comment }, status: 'new'|'confirmed'|'done'|'cancelled',
       createdAt, source: 'site'|'admin'
     }
     block = { id, masterId, date, from 'HH:MM', to 'HH:MM', reason }  — перерыв / выходной
  */

  const Store = {
    util: { toISO, fromISO, toMin, toHHMM, addDays, fmtDate, fmtMoney, fmtDur, normPhone, fmtPhone, DAY_NAMES, DAY_FULL, MONTHS, MONTHS_NOM },

    all() { return load(KEY); },
    blocks() { return load(BLOCK_KEY); },

    get(id) { return byId(load(KEY), id); },

    create(data) {
      const list = load(KEY);
      const svc = byId(SERVICES, data.serviceId);
      const b = {
        id: 'B' + uid(),
        serviceId: data.serviceId,
        masterId: data.masterId,
        date: data.date,
        time: data.time,
        min: svc.min,
        price: svc.price,
        client: { name: data.client.name.trim(), phone: normPhone(data.client.phone), comment: (data.client.comment || '').trim() },
        status: data.status || 'new',
        source: data.source || 'site',
        createdAt: new Date().toISOString(),
      };
      // финальная проверка коллизий — защищает от двойной брони
      if (!this.isFree(b.masterId, b.date, toMin(b.time), b.min)) {
        throw new Error('Это время уже занято. Выберите другой слот.');
      }
      list.push(b); save(KEY, list);
      return b;
    },

    update(id, patch) {
      const list = load(KEY);
      const i = list.findIndex((x) => x.id === id);
      if (i < 0) return null;
      list[i] = { ...list[i], ...patch, updatedAt: new Date().toISOString() };
      save(KEY, list);
      return list[i];
    },

    setStatus(id, status) { return this.update(id, { status }); },

    remove(id) { save(KEY, load(KEY).filter((x) => x.id !== id)); },

    byPhone(phone) {
      const p = normPhone(phone);
      return load(KEY).filter((b) => b.client.phone === p).sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
    },

    forDate(date) { return load(KEY).filter((b) => b.date === date && b.status !== 'cancelled'); },

    /* ---------- блокировки (перерывы, выходные) ---------- */
    addBlock(block) {
      const list = load(BLOCK_KEY);
      const b = { id: 'K' + uid(), ...block };
      list.push(b); save(BLOCK_KEY, list); return b;
    },
    removeBlock(id) { save(BLOCK_KEY, load(BLOCK_KEY).filter((x) => x.id !== id)); },

    /* ---------- движок слотов ---------- */
    workHours(masterId, dateISO) {
      const m = byId(MASTERS, masterId);
      const wd = fromISO(dateISO).getDay();
      const h = m && m.schedule[wd];
      return h ? { from: h[0] * 60, to: h[1] * 60 } : null;
    },

    /* занятые интервалы мастера на день: записи + блокировки */
    busy(masterId, dateISO) {
      const intervals = [];
      for (const b of load(KEY)) {
        if (b.masterId === masterId && b.date === dateISO && b.status !== 'cancelled') {
          intervals.push({ from: toMin(b.time), to: toMin(b.time) + b.min });
        }
      }
      for (const k of load(BLOCK_KEY)) {
        if (k.masterId === masterId && k.date === dateISO) intervals.push({ from: toMin(k.from), to: toMin(k.to) });
      }
      return intervals;
    },

    isFree(masterId, dateISO, startMin, durMin) {
      const wh = this.workHours(masterId, dateISO);
      if (!wh || startMin < wh.from || startMin + durMin > wh.to) return false;
      const now = new Date();
      if (dateISO === toISO(now) && startMin <= now.getHours() * 60 + now.getMinutes()) return false;
      if (dateISO < toISO(now)) return false;
      return !this.busy(masterId, dateISO).some((i) => startMin < i.to && startMin + durMin > i.from);
    },

    /* список свободных времён 'HH:MM' для мастера, даты и длительности */
    slots(masterId, dateISO, durMin) {
      const wh = this.workHours(masterId, dateISO);
      if (!wh) return [];
      const out = [];
      for (let t = wh.from; t + durMin <= wh.to; t += SALON.slotStep) {
        if (this.isFree(masterId, dateISO, t, durMin)) out.push(toHHMM(t));
      }
      return out;
    },

    /* мастера, которые делают услугу */
    mastersFor(serviceId) {
      const svc = byId(SERVICES, serviceId);
      return MASTERS.filter((m) => m.cats.includes(svc.cat));
    },

    /* есть ли хоть один слот в этот день (для календаря) */
    dayHasSlots(masterIds, dateISO, durMin) {
      return masterIds.some((id) => this.slots(id, dateISO, durMin).length > 0);
    },

    /* загрузка мастера за день в процентах — для админки */
    load(masterId, dateISO) {
      const wh = this.workHours(masterId, dateISO);
      if (!wh) return null;
      const total = wh.to - wh.from;
      const used = this.busy(masterId, dateISO).reduce((s, i) => s + Math.max(0, Math.min(i.to, wh.to) - Math.max(i.from, wh.from)), 0);
      return Math.round((used / total) * 100);
    },

    /* ---------- демо-данные ---------- */
    seedIfEmpty() {
      if (store.getItem(KEY)) return false;
      const names = ['Алия', 'Карина', 'Тимур', 'Асель', 'Дарья', 'Арман', 'Жанна', 'Мария', 'Динара', 'Ерлан', 'Сабина', 'Наталья', 'Айдана', 'Виктория', 'Санжар', 'Гульнара'];
      const clients = names.map((n, i) => ({ name: n, phone: '7700' + String(1234567 + i * 71113).slice(0, 7) }));
      const list = [];
      const today = new Date();
      let seed = 7;
      const rnd = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
      for (let off = -6; off <= 8; off++) {
        const date = toISO(addDays(today, off));
        for (const m of MASTERS) {
          const wh = this.workHours(m.id, date);
          if (!wh) continue;
          const svcs = SERVICES.filter((s) => m.cats.includes(s.cat));
          let t = wh.from + (rnd() < 0.5 ? 0 : 30);
          const count = 2 + Math.floor(rnd() * 3);
          for (let i = 0; i < count && t < wh.to - 60; i++) {
            const svc = svcs[Math.floor(rnd() * svcs.length)];
            if (t + svc.min > wh.to) break;
            const past = off < 0 || (off === 0 && t < today.getHours() * 60);
            const r = rnd();
            const status = past ? (r < 0.9 ? 'done' : 'cancelled') : (r < 0.6 ? 'confirmed' : r < 0.92 ? 'new' : 'cancelled');
            const c = clients[Math.floor(rnd() * clients.length)];
            list.push({
              id: 'B' + uid(), serviceId: svc.id, masterId: m.id, date, time: toHHMM(t), min: svc.min, price: svc.price,
              client: { name: c.name, phone: c.phone, comment: '' },
              status, source: rnd() < 0.7 ? 'site' : 'admin',
              createdAt: addDays(fromISO(date), -1 - Math.floor(rnd() * 5)).toISOString(),
            });
            t += svc.min + (rnd() < 0.5 ? 30 : 60);
            t = Math.ceil(t / 30) * 30;
          }
        }
      }
      save(KEY, list);
      // пара блокировок для наглядности
      const tomorrow = toISO(addDays(today, 1));
      save(BLOCK_KEY, [{ id: 'K' + uid(), masterId: 'aigerim', date: tomorrow, from: '14:00', to: '15:00', reason: 'Обед' }]);
      return true;
    },

    resetDemo() { store.removeItem(KEY); store.removeItem(BLOCK_KEY); this.seedIfEmpty(); },

    /* простое key-value для мелочей (последний телефон, сессия админа) */
    kv: { get: (k) => store.getItem(k), set: (k, v) => store.setItem(k, v), del: (k) => store.removeItem(k) },
    session: { get: (k) => session.getItem(k), set: (k, v) => session.setItem(k, v), del: (k) => session.removeItem(k) },
  };

  Store.seedIfEmpty();
  window.Store = Store;
})();
