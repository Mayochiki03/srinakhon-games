(() => {
  const TZ = 'Asia/Bangkok';
  const THAI_WEEKDAYS = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'];
  const THAI_MONTHS = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
  const THAI_MONTHS_SHORT = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];

  let state = { data: null, stats: null, filter: 'all' };
  let prevStatusById = null; // used to detect "just finished" for the celebration effect
  let prevScoresById = null; // used to trigger the score-pop animation only when a number actually changes
  let pollTimer = null;

  function getVisitorId() {
    let id = localStorage.getItem('sn_visitor_id');
    if (!id) {
      id = (crypto.randomUUID ? crypto.randomUUID() : `v_${Date.now()}_${Math.random().toString(36).slice(2)}`);
      localStorage.setItem('sn_visitor_id', id);
    }
    return id;
  }

  async function pingVisit() {
    try {
      const res = await fetch('/api/visit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ visitorId: getVisitorId() }),
      });
      state.stats = await res.json();
    } catch (e) { /* stats are a nice-to-have, never block the page on this */ }
  }

  async function refreshStats() {
    try {
      const res = await fetch('/api/stats', { cache: 'no-store' });
      state.stats = await res.json();
      if (state.data) renderHero();
    } catch (e) { /* ignore */ }
  }

  function bangkokParts(date = new Date()) {
    const fmt = new Intl.DateTimeFormat('en-US', {
      timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit',
      weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: false,
    });
    const parts = {};
    fmt.formatToParts(date).forEach((p) => { parts[p.type] = p.value; });
    return parts;
  }

  function todayISO() {
    const p = bangkokParts();
    return `${p.year}-${p.month}-${p.day}`;
  }

  function weekdayIndex(dateObjInBkk) {
    const fmt = new Intl.DateTimeFormat('en-US', { timeZone: TZ, weekday: 'short' });
    const short = fmt.format(dateObjInBkk);
    const map = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
    return map[short];
  }

  function formatThaiDateLong(isoDate) {
    const [y, m, d] = isoDate.split('-').map(Number);
    const dateObj = new Date(Date.UTC(y, m - 1, d, 12));
    const wd = weekdayIndex(dateObj);
    const buddhistYear = y + 543;
    return { weekday: THAI_WEEKDAYS[wd], day: d, month: THAI_MONTHS[m - 1], year: buddhistYear };
  }

  function formatThaiDateShort(isoDate) {
    const [y, m, d] = isoDate.split('-').map(Number);
    return `${d} ${THAI_MONTHS_SHORT[m - 1]} ${String(y + 543).slice(-2)}`;
  }

  function sportMeta(sportKey) {
    return (state.data && state.data.sports[sportKey]) || { label: sportKey, icon: '🏟', venue: '' };
  }

  function venueOf(m) {
    return m.venue || sportMeta(m.sport).venue || '-';
  }

  async function loadData() {
    try {
      const res = await fetch('/api/matches', { cache: 'no-store' });
      const data = await res.json();
      const isFirstLoad = state.data === null;
      state.data = data;
      if (!isFirstLoad) {
        detectCelebrations(data.matches);
        detectScoreChanges(data.matches);
      }
      snapshotStatuses(data.matches);
      snapshotScores(data.matches);
      render();
      refreshStats();
    } catch (e) {
      console.error('โหลดข้อมูลไม่สำเร็จ', e);
    }
  }

  function snapshotStatuses(matches) {
    prevStatusById = {};
    matches.forEach((m) => { prevStatusById[m.id] = m.status; });
  }

  function snapshotScores(matches) {
    prevScoresById = {};
    matches.forEach((m) => { prevScoresById[m.id] = `${m.score1}|${m.score2}`; });
  }

  let justChangedIds = new Set();
  function detectScoreChanges(matches) {
    if (!prevScoresById) return;
    justChangedIds = new Set();
    matches.forEach((m) => {
      if (m.type !== 'match') return;
      const prev = prevScoresById[m.id];
      const now = `${m.score1}|${m.score2}`;
      if (prev !== undefined && prev !== now && (m.score1 !== null || m.score2 !== null)) {
        justChangedIds.add(m.id);
      }
    });
  }

  function detectCelebrations(matches) {
    if (!prevStatusById) return;
    matches.forEach((m) => {
      if (m.type !== 'match') return;
      const was = prevStatusById[m.id];
      if (was && was !== 'finished' && m.status === 'finished' && m.winner) {
        celebrate(m);
      }
    });
  }

  // ---------- sport-themed celebration: confetti burst + toast ----------
  function celebrate(m) {
    const colorMap = { team1: m.team1.color, team2: m.team2.color, draw: '#FFC94A' };
    const color = colorMap[m.winner] || '#FFC94A';
    spawnConfetti(color);

    const meta = sportMeta(m.sport);
    const label = m.winner === 'draw'
      ? `${meta.icon} ${m.team1.name} เสมอกับ ${m.team2.name} · ${meta.label}`
      : `🏆 ${m.winner === 'team1' ? m.team1.name : m.team2.name} ชนะ ${meta.label}!`;

    const toast = document.createElement('div');
    toast.className = 'celebrate-toast';
    toast.textContent = label;
    document.body.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('show'));
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 400);
    }, 3200);
  }

  function spawnConfetti(mainColor) {
    const layer = document.getElementById('confettiLayer');
    if (!layer) return;
    const colors = [mainColor, '#FFC94A', '#C4A6F3', '#ffffff'];
    const count = 40;
    for (let i = 0; i < count; i++) {
      const piece = document.createElement('div');
      piece.className = 'confetti-piece';
      const left = Math.random() * 100;
      const dur = 2.2 + Math.random() * 1.6;
      const delay = Math.random() * 0.4;
      const bg = colors[Math.floor(Math.random() * colors.length)];
      piece.style.left = left + 'vw';
      piece.style.background = bg;
      piece.style.animationDuration = dur + 's';
      piece.style.animationDelay = delay + 's';
      piece.style.transform = `rotate(${Math.random() * 360}deg)`;
      layer.appendChild(piece);
      setTimeout(() => piece.remove(), (dur + delay) * 1000 + 200);
    }
  }

  function sortedMatches() {
    return [...state.data.matches].sort((a, b) => {
      const ka = a.date + 'T' + a.time;
      const kb = b.date + 'T' + b.time;
      return ka.localeCompare(kb);
    });
  }

  function applyFilter(list) {
    if (state.filter === 'all') return list;
    return list.filter((m) => m.sport === state.filter);
  }

  function buildFilters() {
    const el = document.getElementById('filters');
    const sportsInUse = [...new Set(state.data.matches.map((m) => m.sport))];
    const chips = [{ key: 'all', label: 'ทั้งหมด', icon: '✨' }].concat(
      sportsInUse.map((key) => ({ key, label: sportMeta(key).label, icon: sportMeta(key).icon }))
    );
    el.innerHTML = '';
    chips.forEach((c) => {
      const btn = document.createElement('button');
      btn.className = 'chip' + (state.filter === c.key ? ' active' : '');
      btn.innerHTML = `<span>${c.icon}</span><span>${c.label}</span>`;
      btn.onclick = () => { state.filter = c.key; render(); };
      el.appendChild(btn);
    });
  }

  function teamNameHTML(team, isWinner) {
    return `<span class="team-name${isWinner ? ' winner' : ''}">${team.name}${isWinner ? ' 🏆' : ''}</span>`;
  }

  function metaLine(m) {
    const meta = sportMeta(m.sport);
    const bits = [meta.label];
    if (m.category) bits.push(m.category);
    if (m.round) bits.push(m.round);
    return `${meta.icon} ${bits.join(' · ')}`;
  }

  function matchCard(m) {
    const statusLabel = { live: 'สด', scheduled: 'เร็วๆ นี้', finished: 'จบแล้ว' }[m.status];
    const statusClass = { live: 'status-live', scheduled: 'status-scheduled', finished: 'status-finished' }[m.status];
    const hasScore = m.score1 !== null && m.score2 !== null && m.score1 !== undefined && m.score2 !== undefined;
    const scoreHTML = hasScore
      ? `<span>${m.score1}</span><span class="dash">:</span><span>${m.score2}</span>`
      : `<span class="score-empty">${m.status === 'live' ? '• • •' : 'VS'}</span>`;
    const dot = m.status === 'live' ? '<span class="pulse-dot" style="margin-right:4px"></span>' : '';
    const confirmedFinished = m.status === 'finished' && m.winner;
    const justChanged = justChangedIds.has(m.id);

    return `
    <div class="mcard ${m.status === 'live' ? 'is-live' : ''}">
      <div class="mcard-top">
        <span class="mcard-sport">${metaLine(m)}</span>
        <span class="status-pill ${statusClass}">${dot}${statusLabel}</span>
      </div>
      <div class="scoreboard">
        <div class="team">
          <span class="team-swatch" style="background:${m.team1.color}"></span>
          ${teamNameHTML(m.team1, confirmedFinished && m.winner === 'team1')}
        </div>
        <div class="score-block ${justChanged ? 'score-pop' : ''}">${scoreHTML}</div>
        <div class="team reverse">
          ${teamNameHTML(m.team2, confirmedFinished && m.winner === 'team2')}
          <span class="team-swatch" style="background:${m.team2.color}"></span>
        </div>
      </div>
      ${confirmedFinished && m.winner === 'draw' ? `<div style="text-align:center;font-size:11px;color:var(--cream-dim);margin-top:2px">ผลเสมอ</div>` : ''}
      <div class="mcard-meta">
        <span>📅 ${formatThaiDateShort(m.date)}</span>
        <span>🕒 ${m.time} น.</span>
        <span>📍 ${venueOf(m)}</span>
        ${m.referee ? `<span>👤 ${m.referee}</span>` : ''}
      </div>
    </div>`;
  }

  function eventCard(m) {
    const statusLabel = { live: 'กำลังดำเนินการ', scheduled: 'เร็วๆ นี้', finished: 'จบแล้ว' }[m.status];
    const statusClass = { live: 'status-live', scheduled: 'status-scheduled', finished: 'status-finished' }[m.status];
    return `
    <div class="ecard">
      <div class="mcard-top" style="margin-bottom:8px">
        <span class="mcard-sport">${metaLine(m)}</span>
        <span class="status-pill ${statusClass}">${statusLabel}</span>
      </div>
      <p class="ecard-title">${m.title}</p>
      <div class="mcard-meta" style="margin-top:9px;padding-top:9px">
        <span>📅 ${formatThaiDateShort(m.date)}</span>
        <span>🕒 ${m.time} น.</span>
        <span>📍 ${venueOf(m)}</span>
        ${m.referee ? `<span>👤 ${m.referee}</span>` : ''}
        ${m.note ? `<span>📝 ${m.note}</span>` : ''}
      </div>
    </div>`;
  }

  function cardFor(m) {
    return m.type === 'match' ? matchCard(m) : eventCard(m);
  }

  function animateNumber(el, newVal) {
    const oldVal = Number(el.dataset.val || 0);
    newVal = Number(newVal) || 0;
    if (oldVal === newVal) { el.textContent = newVal; return; }
    const start = performance.now();
    const duration = 550;
    function tick(now) {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      const cur = Math.round(oldVal + (newVal - oldVal) * eased);
      el.textContent = cur;
      if (t < 1) requestAnimationFrame(tick);
      else { el.textContent = newVal; el.dataset.val = newVal; }
    }
    requestAnimationFrame(tick);
  }

  function renderHero() {
    const today = todayISO();
    const t = formatThaiDateLong(today);
    document.getElementById('heroDate').innerHTML =
      `วัน${t.weekday}ที่ <span class="day-num">${t.day}</span> ${t.month} ${t.year}`;

    const all = state.data.matches;
    const live = all.filter((m) => m.status === 'live');
    const today_ = all.filter((m) => m.date === today);

    animateNumber(document.getElementById('statLive'), live.length);
    animateNumber(document.getElementById('statToday'), today_.length);
    animateNumber(document.getElementById('statTotal'), all.length);
    animateNumber(document.getElementById('statVisitors'), (state.stats && state.stats.today.unique) || 0);

    const ticker = document.getElementById('ticker');
    const track = document.getElementById('tickerTrack');
    const tag = document.getElementById('tickerTag');

    if (live.length > 0) {
      ticker.classList.remove('is-empty');
      tag.textContent = `สด (${live.length})`;
      const items = live.map((m) => {
        const meta = sportMeta(m.sport);
        if (m.type === 'match') {
          const score = m.score1 !== null && m.score1 !== undefined ? `${m.score1}-${m.score2}` : 'เริ่มแล้ว';
          return `${meta.icon} ${m.team1.name} <span class="sep">${score}</span> ${m.team2.name}`;
        }
        return `${meta.icon} ${m.title}`;
      });
      const doubled = items.concat(items);
      track.innerHTML = doubled.join('<span class="sep">&nbsp;&nbsp;●&nbsp;&nbsp;</span>');
      track.style.animation = '';
    } else {
      ticker.classList.add('is-empty');
      const next = sortedMatches().find((m) => (m.date + 'T' + m.time) >= (today + 'T00:00') && m.status !== 'finished');
      if (next) {
        const meta = sportMeta(next.sport);
        tag.textContent = 'ต่อไป';
        const label = next.type === 'match'
          ? `${next.team1.name} พบ ${next.team2.name}`
          : next.title;
        track.innerHTML = `${meta.icon} ${meta.label} · ${label} — ${formatThaiDateShort(next.date)} เวลา ${next.time} น. ที่ ${venueOf(next)}`;
        track.style.animation = 'none';
      } else {
        tag.textContent = 'จบครบแล้ว';
        track.innerHTML = 'การแข่งขันศรีนครเกมส์ ครั้งที่ 30 เสร็จสิ้นเรียบร้อย ขอบคุณทุกทีมที่ร่วมแข่งขัน 🎉';
        track.style.animation = 'none';
      }
    }
  }

  function renderLive() {
    const live = applyFilter(state.data.matches.filter((m) => m.status === 'live'));
    const section = document.getElementById('sectionLive');
    section.style.display = live.length ? '' : 'none';
    document.getElementById('countLive').textContent = live.length ? `${live.length} รายการ` : '';
    document.getElementById('gridLive').innerHTML = live.map(cardFor).join('');
  }

  function renderNext() {
    const today = todayISO();
    const now = bangkokParts();
    const nowKey = `${now.year}-${now.month}-${now.day}T${now.hour}:${now.minute}`;
    let upcoming = applyFilter(sortedMatches().filter((m) => m.status === 'scheduled' && (m.date + 'T' + m.time) >= nowKey));

    const todaysUpcoming = upcoming.filter((m) => m.date === today);
    const list = todaysUpcoming.length ? todaysUpcoming : upcoming.slice(0, 6);

    document.getElementById('countNext').textContent = list.length ? `${list.length} รายการ` : '';
    const grid = document.getElementById('gridNext');
    if (!list.length) {
      grid.innerHTML = `<div class="empty">ยังไม่มีรายการที่กำลังจะเริ่มในตอนนี้</div>`;
    } else {
      grid.innerHTML = list.map(cardFor).join('');
    }
  }

  function renderToday() {
    const today = todayISO();
    const finishedToday = applyFilter(state.data.matches.filter((m) => m.status === 'finished' && m.date === today));
    const section = document.getElementById('sectionToday');
    section.style.display = finishedToday.length ? '' : 'none';
    document.getElementById('countToday').textContent = finishedToday.length ? `${finishedToday.length} รายการ` : '';
    document.getElementById('gridToday').innerHTML = finishedToday.map(cardFor).join('');
  }

  // only matches that a teacher has actually confirmed finished (status === 'finished')
  // AND have a real winner count toward the standings — a score typed in mid-match
  // no longer counts until the result is confirmed.
  function renderStandings() {
    const teamsMeta = state.data.teams;
    const table = {};
    Object.keys(teamsMeta).forEach((k) => {
      table[k] = { ...teamsMeta[k], played: 0, win: 0, draw: 0, lose: 0, points: 0 };
    });
    const keyByName = {};
    Object.entries(teamsMeta).forEach(([k, v]) => { keyByName[v.name] = k; });

    state.data.matches.forEach((m) => {
      if (m.type !== 'match' || m.status !== 'finished' || !m.winner) return;
      const k1 = keyByName[m.team1.name];
      const k2 = keyByName[m.team2.name];
      if (!k1 || !k2) return;
      table[k1].played++; table[k2].played++;
      if (m.winner === 'team1') { table[k1].win++; table[k1].points += 3; table[k2].lose++; }
      else if (m.winner === 'team2') { table[k2].win++; table[k2].points += 3; table[k1].lose++; }
      else { table[k1].draw++; table[k2].draw++; table[k1].points += 1; table[k2].points += 1; }
    });

    const ranked = Object.values(table).sort((a, b) => b.points - a.points || b.win - a.win);
    const el = document.getElementById('standings');
    el.innerHTML = ranked.map((t, i) => `
      <div class="standing-card ${i === 0 && t.played ? 'standing-top' : ''}">
        <span class="standing-rank">#${i + 1}</span>
        <div class="standing-head">
          <div class="standing-swatch" style="background:${t.color}"></div>
          <div class="standing-name">${t.name}</div>
        </div>
        <div class="standing-points">${t.points}</div>
        <div class="standing-points-lbl">คะแนนสะสม (จากผลที่ยืนยันแล้ว)</div>
        <div class="standing-row"><span>ลงแข่ง</span><b>${t.played}</b></div>
        <div class="standing-row"><span>ชนะ</span><b>${t.win}</b></div>
        <div class="standing-row"><span>เสมอ</span><b>${t.draw}</b></div>
        <div class="standing-row"><span>แพ้</span><b>${t.lose}</b></div>
      </div>
    `).join('');
  }

  // manually-declared champions per sport (set by a teacher in the admin panel) —
  // shown separately from the match-based table above since tiebreak rules differ
  // per sport and we never want to guess a champion automatically.
  function renderChampions() {
    const section = document.getElementById('sectionChampions');
    const sportsWithChampion = Object.entries(state.data.sports).filter(([, s]) => s.championTeam);
    if (!sportsWithChampion.length) {
      section.style.display = 'none';
      return;
    }
    section.style.display = '';

    const list = document.getElementById('championsList');
    list.innerHTML = sportsWithChampion.map(([key, s]) => {
      const team = state.data.teams[s.championTeam];
      if (!team) return '';
      return `
      <div class="champion-chip">
        <span class="champion-swatch" style="background:${team.color}"></span>
        <span class="champion-sport">${s.icon} ${s.label}</span>
        <span class="champion-arrow">→</span>
        <span class="champion-team">${team.name}</span>
        <span class="champion-pts">+${s.championPoints}</span>
      </div>`;
    }).join('');

    const totals = {};
    Object.keys(state.data.teams).forEach((k) => { totals[k] = 0; });
    sportsWithChampion.forEach(([, s]) => {
      if (totals[s.championTeam] !== undefined) totals[s.championTeam] += Number(s.championPoints) || 0;
    });
    const ranked = Object.entries(totals)
      .map(([k, pts]) => ({ ...state.data.teams[k], pts }))
      .sort((a, b) => b.pts - a.pts);

    document.getElementById('championTotals').innerHTML = ranked.map((t) => `
      <div class="champion-total-pill">
        <span class="champion-swatch" style="background:${t.color}"></span>
        ${t.name} <b>${t.pts}</b>
      </div>
    `).join('');
  }

  function renderSchedule() {
    const today = todayISO();
    const list = applyFilter(sortedMatches());
    const byDate = {};
    list.forEach((m) => { (byDate[m.date] = byDate[m.date] || []).push(m); });
    const dates = Object.keys(byDate).sort();

    document.getElementById('countAll').textContent = `${list.length} รายการ · ${dates.length} วัน`;

    const nearestUpcomingDate = dates.find((d) => d >= today) || dates[dates.length - 1];

    const el = document.getElementById('dayList');
    if (!dates.length) {
      el.innerHTML = `<div class="empty">ไม่พบรายการแข่งขันในหมวดนี้</div>`;
      return;
    }

    el.innerHTML = dates.map((d) => {
      const t = formatThaiDateLong(d);
      const isToday = d === today;
      const shouldOpen = isToday || d === nearestUpcomingDate;
      const items = byDate[d];
      return `
      <div class="day-group ${isToday ? 'day-today' : ''} ${shouldOpen ? 'open' : ''}" data-date="${d}">
        <div class="day-header" onclick="this.parentElement.classList.toggle('open')">
          <div class="day-header-left">
            <div class="day-badge">${t.day}</div>
            <div>
              <div class="day-title">วัน${t.weekday}ที่ ${t.day} ${t.month} ${t.year}${isToday ? ' · วันนี้' : ''}</div>
              <div class="day-sub">${items.length} รายการ</div>
            </div>
          </div>
          <span class="chevron">▾</span>
        </div>
        <div class="day-body">
          <div class="card-grid">${items.map(cardFor).join('')}</div>
        </div>
      </div>`;
    }).join('');
  }

  function render() {
    if (!state.data) return;
    buildFilters();
    renderHero();
    renderLive();
    renderNext();
    renderToday();
    renderStandings();
    renderChampions();
    renderSchedule();
  }

  function setupScrollReveal() {
    const targets = document.querySelectorAll('.section-head, .standings, .champions-wrap');
    if (!('IntersectionObserver' in window)) return;
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('reveal-in');
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12 });
    targets.forEach((el) => { el.classList.add('reveal'); io.observe(el); });
  }

  pingVisit();
  loadData();
  pollTimer = setInterval(loadData, 20000);
  window.addEventListener('load', setupScrollReveal);


  // ==================== EXTRA FLOATIES (ประกายลอยใหม่) ====================
  function createExtraFloaties() {
    if (document.querySelector('.extra-floaties')) return; // ป้องกันซ้ำ

    const container = document.createElement('div');
    container.className = 'extra-floaties';

    const symbols = ['✦', '★', '⚡', '🏅', '🔥', '🌟', '🏆', '⚽', '🏸', '🏀'];

    for (let i = 0; i < 22; i++) {
      const span = document.createElement('span');
      span.textContent = symbols[Math.floor(Math.random() * symbols.length)];
      
      span.style.left = Math.random() * 100 + '%';
      span.style.animationDuration = (14 + Math.random() * 28) + 's';
      span.style.animationDelay = '-' + (Math.random() * 35) + 's';
      span.style.fontSize = (14 + Math.random() * 20) + 'px';
      span.style.opacity = 0.07 + Math.random() * 0.16;
      
      container.appendChild(span);
    }

    document.body.appendChild(container);
  }

  // เรียกใช้เมื่อหน้าโหลดเสร็จ
  window.addEventListener('load', () => {
    createExtraFloaties();
  });

})();
