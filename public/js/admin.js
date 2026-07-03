(() => {
  const TZ = 'Asia/Bangkok';
  const THAI_WEEKDAYS = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'];
  const THAI_MONTHS = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];

  let state = {
    data: null,
    filter: 'all',
    pin: sessionStorage.getItem('sn_admin_pin') || null,
    editingId: null, // null = creating new
  };

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
    return `วัน${THAI_WEEKDAYS[wd]}ที่ ${d} ${THAI_MONTHS[m - 1]} ${y + 543}`;
  }

  function sportMeta(sportKey) {
    return (state.data && state.data.sports[sportKey]) || { label: sportKey, icon: '🏟', venue: '' };
  }

  function teamKeyByName(name) {
    const entry = Object.entries(state.data.teams).find(([, v]) => v.name === name);
    return entry ? entry[0] : null;
  }

  // ---------- network ----------
  async function tryLogin(pin) {
    const res = await fetch('/api/admin/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin }),
    });
    return res.ok;
  }

  async function loadData() {
    const res = await fetch('/api/matches', { cache: 'no-store' });
    state.data = await res.json();
    render();
  }

  function toast(msg, ok = true) {
    const el = document.getElementById('saveToast');
    el.textContent = msg;
    el.style.background = ok ? 'var(--gold-500)' : 'var(--live-red)';
    el.style.color = ok ? 'var(--purple-950)' : '#fff';
    el.classList.add('show');
    setTimeout(() => el.classList.remove('show'), 2000);
  }

  function authHeaders() {
    return { 'Content-Type': 'application/json', 'X-Admin-Pin': state.pin };
  }

  async function apiCall(method, url, body) {
    const res = await fetch(url, {
      method,
      headers: authHeaders(),
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    if (res.status === 401) {
      sessionStorage.removeItem('sn_admin_pin');
      toast('PIN หมดอายุ กรุณาเข้าสู่ระบบใหม่', false);
      showLogin();
      return { __unauthorized: true };
    }
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { __error: json.error || 'เกิดข้อผิดพลาด' };
    }
    return json;
  }

  // ---------- quick inline row save (score/status/winner) ----------
  async function saveRowQuick(id, payload) {
    const updated = await apiCall('PATCH', `/api/admin/matches/${id}`, payload);
    if (updated.__unauthorized) return;
    if (updated.__error) { toast(updated.__error, false); return; }
    const idx = state.data.matches.findIndex((m) => m.id === id);
    if (idx !== -1) state.data.matches[idx] = { ...state.data.matches[idx], ...updated };
    toast('บันทึกแล้ว ✓');
    render();
  }

  async function deleteMatch(id) {
    const updated = await apiCall('DELETE', `/api/admin/matches/${id}`);
    if (updated.__unauthorized) return;
    if (updated.__error) { toast(updated.__error, false); return; }
    state.data.matches = state.data.matches.filter((m) => m.id !== id);
    toast('ลบรายการแล้ว');
    render();
  }

  // ---------- filters ----------
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

  // ---------- row rendering ----------
  function matchRow(m) {
    const meta = sportMeta(m.sport);
    const metaLine = `${meta.icon} ${meta.label}${m.category ? ' · ' + m.category : ''}${m.round ? ' · ' + m.round : ''} · ${m.time || '--:--'} น. · ${m.venue || meta.venue || '-'}`;

    if (m.type === 'event') {
      const winnerBadge = m.status === 'finished'
        ? `<span class="winner-badge">✅ จบแล้ว</span>`
        : '';
      return `
      <div class="arow">
        <div class="arow-sport"><span>${metaLine}</span><span>${m.referee || ''}</span></div>
        <div class="arow-event-title">${m.title}</div>
        ${winnerBadge}
        <select class="status-select" data-id="${m.id}" data-field="statusOverride">
          <option value="" ${!m.statusOverride ? 'selected' : ''}>อัตโนมัติ (${statusLabel(m.status)})</option>
          <option value="scheduled" ${m.statusOverride === 'scheduled' ? 'selected' : ''}>ยังไม่เริ่ม</option>
          <option value="live" ${m.statusOverride === 'live' ? 'selected' : ''}>กำลังดำเนินการ</option>
          <option value="finished" ${m.statusOverride === 'finished' ? 'selected' : ''}>✅ จบแล้ว</option>
        </select>
        <button class="save-row-btn" data-save="${m.id}">บันทึก</button>
        <div class="arow-actions">
          <button class="icon-btn" data-edit="${m.id}">✎ แก้ไข</button>
          <button class="icon-btn danger" data-del="${m.id}">🗑 ลบ</button>
        </div>
      </div>`;
    }

    const hasScore = m.score1 !== null && m.score1 !== undefined && m.score2 !== null && m.score2 !== undefined;
    const winnerNow = m.winnerOverride || (hasScore ? null : null);
    let winnerNote = '';
    if (m.status === 'finished' && m.winner) {
      const wname = m.winner === 'draw' ? 'เสมอ' : (m.winner === 'team1' ? m.team1.name : m.team2.name);
      winnerNote = `<span class="winner-badge">🏆 ${wname}${m.winnerOverride ? ' (ระบุเอง)' : ''}</span>`;
    } else if (hasScore && m.status !== 'finished') {
      winnerNote = `<span class="unconfirmed-note">ยังไม่ยืนยันผล — เลือก "✅ จบแล้ว" ด้านล่างเพื่อประกาศผล</span>`;
    }

    return `
    <div class="arow">
      <div class="arow-sport"><span>${metaLine}</span><span>${m.referee || ''}</span></div>
      <div class="arow-teams">
        <span class="arow-swatch" style="background:${m.team1.color}"></span>
        <span class="arow-team-name">${m.team1.name}</span>
        <input class="score-input" type="number" min="0" placeholder="-" value="${m.score1 ?? ''}" data-id="${m.id}" data-field="score1" />
      </div>
      <span style="color:var(--cream-dim);font-size:12px">พบ</span>
      <div class="arow-teams">
        <input class="score-input" type="number" min="0" placeholder="-" value="${m.score2 ?? ''}" data-id="${m.id}" data-field="score2" />
        <span class="arow-team-name">${m.team2.name}</span>
        <span class="arow-swatch" style="background:${m.team2.color}"></span>
      </div>

      <select class="status-select" data-id="${m.id}" data-field="winnerOverride" title="กำหนดผู้ชนะเอง (ไม่บังคับ)">
        <option value="" ${!m.winnerOverride ? 'selected' : ''}>ผู้ชนะ: อัตโนมัติจากคะแนน</option>
        <option value="team1" ${m.winnerOverride === 'team1' ? 'selected' : ''}>${m.team1.name} ชนะ</option>
        <option value="draw" ${m.winnerOverride === 'draw' ? 'selected' : ''}>เสมอ</option>
        <option value="team2" ${m.winnerOverride === 'team2' ? 'selected' : ''}>${m.team2.name} ชนะ</option>
      </select>

      <select class="status-select" data-id="${m.id}" data-field="statusOverride">
        <option value="" ${!m.statusOverride ? 'selected' : ''}>อัตโนมัติ (${statusLabel(m.status)})</option>
        <option value="scheduled" ${m.statusOverride === 'scheduled' ? 'selected' : ''}>ยังไม่เริ่ม</option>
        <option value="live" ${m.statusOverride === 'live' ? 'selected' : ''}>กำลังแข่งขัน</option>
        <option value="finished" ${m.statusOverride === 'finished' ? 'selected' : ''}>✅ จบแล้ว (ประกาศผล)</option>
      </select>

      <button class="save-row-btn" data-save="${m.id}">บันทึก</button>
      ${winnerNote}
      <div class="arow-actions">
        <button class="icon-btn" data-edit="${m.id}">✎ แก้ไข</button>
        <button class="icon-btn danger" data-del="${m.id}">🗑 ลบ</button>
      </div>
    </div>`;
  }

  function statusLabel(s) {
    return { live: 'กำลังแข่ง', scheduled: 'ยังไม่เริ่ม', finished: 'จบแล้ว' }[s] || s;
  }

  function render() {
    buildFilters();
    const search = (document.getElementById('searchInput').value || '').trim().toLowerCase();
    let list = [...state.data.matches].sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
    if (state.filter !== 'all') list = list.filter((m) => m.sport === state.filter);
    if (search) {
      list = list.filter((m) => {
        const hay = [m.referee, m.title, m.team1?.name, m.team2?.name, m.category].filter(Boolean).join(' ').toLowerCase();
        return hay.includes(search);
      });
    }
    const byDate = {};
    list.forEach((m) => { (byDate[m.date] = byDate[m.date] || []).push(m); });
    const dates = Object.keys(byDate).sort();

    const el = document.getElementById('dayList');
    el.innerHTML = dates.map((d) => `
      <div class="day-divider">${formatThaiDateLong(d)}</div>
      ${byDate[d].map(matchRow).join('')}
    `).join('') || `<div class="empty">ไม่พบรายการ — ลองล้างตัวกรอง หรือกด "＋ เพิ่มรายการแข่งขัน" เพื่อสร้างใหม่</div>`;

    el.querySelectorAll('[data-save]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-save');
        const scope = btn.closest('.arow');
        const payload = {};
        scope.querySelectorAll('[data-field]').forEach((input) => {
          const field = input.getAttribute('data-field');
          let val = input.value;
          if (field === 'score1' || field === 'score2') {
            payload[field] = val === '' ? null : Number(val);
          } else {
            payload[field] = val === '' ? null : val;
          }
        });
        saveRowQuick(id, payload);
      });
    });

    el.querySelectorAll('[data-edit]').forEach((btn) => {
      btn.addEventListener('click', () => openModal(btn.getAttribute('data-edit')));
    });

    el.querySelectorAll('[data-del]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-del');
        const m = state.data.matches.find((x) => x.id === id);
        const label = m.type === 'match' ? `${m.team1.name} พบ ${m.team2.name}` : m.title;
        if (confirm(`ต้องการลบรายการนี้ใช่ไหม?\n${label}\n\nการลบไม่สามารถย้อนกลับได้`)) {
          deleteMatch(id);
        }
      });
    });
  }

  // ================= MATCH MODAL (create / edit) =================
  const modalBackdrop = document.getElementById('matchModalBackdrop');
  let modalType = 'match';

  function populateSportSelect() {
    const sel = document.getElementById('fSport');
    sel.innerHTML = Object.entries(state.data.sports)
      .map(([key, s]) => `<option value="${key}">${s.icon} ${s.label}</option>`)
      .join('');
  }

  function populateTeamSelects() {
    const opts = Object.entries(state.data.teams)
      .map(([key, t]) => `<option value="${key}">${t.name}</option>`)
      .join('');
    document.getElementById('fTeam1').innerHTML = opts;
    document.getElementById('fTeam2').innerHTML = opts;
    document.getElementById('fTeam2').selectedIndex = 1;
  }

  function setModalType(type) {
    modalType = type;
    document.querySelectorAll('.type-btn').forEach((b) => b.classList.toggle('active', b.dataset.type === type));
    document.getElementById('matchFields').style.display = type === 'match' ? '' : 'none';
    document.getElementById('eventFields').style.display = type === 'event' ? '' : 'none';
  }

  function openModal(editId) {
    document.getElementById('modalError').textContent = '';
    populateSportSelect();
    populateTeamSelects();

    if (editId) {
      const m = state.data.matches.find((x) => x.id === editId);
      state.editingId = editId;
      document.getElementById('modalTitle').textContent = 'แก้ไขรายการแข่งขัน';
      document.getElementById('deleteMatchBtn').style.display = '';
      setModalType(m.type);
      document.getElementById('fSport').value = m.sport;
      document.getElementById('fCategory').value = m.category || '';
      document.getElementById('fDate').value = m.date || '';
      document.getElementById('fTime').value = m.time || '';
      document.getElementById('fVenue').value = m.venue || sportMeta(m.sport).venue || '';
      document.getElementById('fReferee').value = m.referee || '';
      document.getElementById('fRound').value = m.round || '';
      document.getElementById('fNote').value = m.note || '';
      if (m.type === 'match') {
        document.getElementById('fTeam1').value = teamKeyByName(m.team1.name) || '';
        document.getElementById('fTeam2').value = teamKeyByName(m.team2.name) || '';
      } else {
        document.getElementById('fTitle').value = m.title || '';
      }
    } else {
      state.editingId = null;
      document.getElementById('modalTitle').textContent = 'เพิ่มรายการแข่งขัน';
      document.getElementById('deleteMatchBtn').style.display = 'none';
      setModalType('match');
      document.getElementById('fCategory').value = '';
      document.getElementById('fDate').value = '';
      document.getElementById('fTime').value = '15:10';
      document.getElementById('fVenue').value = '';
      document.getElementById('fReferee').value = '';
      document.getElementById('fRound').value = '';
      document.getElementById('fNote').value = '';
      document.getElementById('fTitle').value = '';
    }
    modalBackdrop.style.display = 'flex';
  }

  function closeModal() {
    modalBackdrop.style.display = 'none';
  }

  async function submitModal() {
    const errEl = document.getElementById('modalError');
    errEl.textContent = '';

    const payload = {
      type: modalType,
      sport: document.getElementById('fSport').value,
      category: document.getElementById('fCategory').value.trim() || null,
      date: document.getElementById('fDate').value,
      time: document.getElementById('fTime').value,
      venue: document.getElementById('fVenue').value.trim() || null,
      referee: document.getElementById('fReferee').value.trim() || null,
      round: document.getElementById('fRound').value.trim() || null,
      note: document.getElementById('fNote').value.trim() || null,
    };

    if (modalType === 'match') {
      payload.team1Key = document.getElementById('fTeam1').value;
      payload.team2Key = document.getElementById('fTeam2').value;
      if (payload.team1Key === payload.team2Key) {
        errEl.textContent = 'ทีมทั้งสองฝั่งต้องเป็นคนละสีกัน';
        return;
      }
    } else {
      payload.title = document.getElementById('fTitle').value.trim();
      if (!payload.title) {
        errEl.textContent = 'กรุณาระบุชื่อกิจกรรม';
        return;
      }
    }

    if (!payload.date || !payload.time) {
      errEl.textContent = 'กรุณาระบุวันที่และเวลา';
      return;
    }

    let result;
    if (state.editingId) {
      result = await apiCall('PATCH', `/api/admin/matches/${state.editingId}`, payload);
    } else {
      result = await apiCall('POST', '/api/admin/matches', payload);
    }
    if (result.__unauthorized) return;
    if (result.__error) { errEl.textContent = result.__error; return; }

    if (state.editingId) {
      const idx = state.data.matches.findIndex((m) => m.id === state.editingId);
      if (idx !== -1) state.data.matches[idx] = { ...state.data.matches[idx], ...result };
      toast('บันทึกการแก้ไขแล้ว ✓');
    } else {
      state.data.matches.push(result);
      toast('เพิ่มรายการแข่งขันแล้ว ✓');
    }
    closeModal();
    render();
  }

  document.getElementById('addMatchBtn').addEventListener('click', () => openModal(null));
  document.getElementById('modalCloseBtn').addEventListener('click', closeModal);
  document.getElementById('cancelModalBtn').addEventListener('click', closeModal);
  document.getElementById('saveModalBtn').addEventListener('click', submitModal);
  document.getElementById('deleteMatchBtn').addEventListener('click', () => {
    if (!state.editingId) return;
    const m = state.data.matches.find((x) => x.id === state.editingId);
    const label = m.type === 'match' ? `${m.team1.name} พบ ${m.team2.name}` : m.title;
    if (confirm(`ต้องการลบรายการนี้ใช่ไหม?\n${label}`)) {
      deleteMatch(state.editingId);
      closeModal();
    }
  });
  document.querySelectorAll('.type-btn').forEach((btn) => {
    btn.addEventListener('click', () => setModalType(btn.dataset.type));
  });
  modalBackdrop.addEventListener('click', (e) => { if (e.target === modalBackdrop) closeModal(); });

  // ================= SPORTS MANAGER MODAL =================
  const sportsBackdrop = document.getElementById('sportsModalBackdrop');

  function renderSportsList() {
    const el = document.getElementById('sportsList');
    const teamOpts = (selected) => Object.entries(state.data.teams)
      .map(([k, t]) => `<option value="${k}" ${selected === k ? 'selected' : ''}>${t.name}</option>`).join('');

    el.innerHTML = Object.entries(state.data.sports).map(([key, s]) => `
      <div class="sport-row" data-sport-key="${key}">
        <span class="sport-row-icon">${s.icon}</span>
        <span class="sport-row-label">${s.label}</span>
        <input type="text" data-sfield="venue" value="${s.venue || ''}" placeholder="สถานที่" style="width:110px" />
        <select data-sfield="championTeam" style="width:110px">
          <option value="">ยังไม่มีแชมป์</option>
          ${teamOpts(s.championTeam)}
        </select>
        <input type="number" data-sfield="championPoints" value="${s.championPoints}" min="0" style="width:60px" title="คะแนนแชมป์" />
        <button class="icon-btn" data-save-sport="${key}">บันทึก</button>
        <button class="icon-btn danger" data-del-sport="${key}">🗑</button>
      </div>
    `).join('');

    el.querySelectorAll('[data-save-sport]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const key = btn.getAttribute('data-save-sport');
        const row = btn.closest('.sport-row');
        const payload = {};
        row.querySelectorAll('[data-sfield]').forEach((input) => {
          const f = input.getAttribute('data-sfield');
          payload[f] = f === 'championPoints' ? Number(input.value) : (input.value || null);
        });
        const result = await apiCall('PATCH', `/api/admin/sports/${encodeURIComponent(key)}`, payload);
        if (result.__unauthorized) return;
        if (result.__error) { toast(result.__error, false); return; }
        state.data.sports[key] = { ...state.data.sports[key], ...payload };
        toast('บันทึกชนิดกีฬาแล้ว ✓');
        render();
      });
    });

    el.querySelectorAll('[data-del-sport]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const key = btn.getAttribute('data-del-sport');
        if (!confirm(`ลบชนิดกีฬา "${state.data.sports[key].label}" ใช่ไหม?`)) return;
        const result = await apiCall('DELETE', `/api/admin/sports/${encodeURIComponent(key)}`);
        if (result.__unauthorized) return;
        if (result.__error) { toast(result.__error, false); return; }
        delete state.data.sports[key];
        toast('ลบชนิดกีฬาแล้ว');
        renderSportsList();
        render();
      });
    });
  }

  document.getElementById('manageSportsBtn').addEventListener('click', () => {
    renderSportsList();
    sportsBackdrop.style.display = 'flex';
  });
  document.getElementById('sportsModalCloseBtn').addEventListener('click', () => sportsBackdrop.style.display = 'none');
  document.getElementById('closeSportsBtn').addEventListener('click', () => sportsBackdrop.style.display = 'none');
  sportsBackdrop.addEventListener('click', (e) => { if (e.target === sportsBackdrop) sportsBackdrop.style.display = 'none'; });

  document.getElementById('addSportBtn').addEventListener('click', async () => {
    const errEl = document.getElementById('sportsError');
    errEl.textContent = '';
    const label = document.getElementById('nsLabel').value.trim();
    if (!label) { errEl.textContent = 'กรุณาระบุชื่อชนิดกีฬา'; return; }
    const payload = {
      label,
      icon: document.getElementById('nsIcon').value.trim() || '🏟',
      venue: document.getElementById('nsVenue').value.trim(),
      championPoints: Number(document.getElementById('nsPoints').value) || 5,
    };
    const result = await apiCall('POST', '/api/admin/sports', payload);
    if (result.__unauthorized) return;
    if (result.__error) { errEl.textContent = result.__error; return; }
    state.data.sports[result.key] = { label: result.label, icon: result.icon, venue: result.venue, championTeam: result.championTeam, championPoints: result.championPoints };
    document.getElementById('nsLabel').value = '';
    document.getElementById('nsIcon').value = '';
    document.getElementById('nsVenue').value = '';
    document.getElementById('nsPoints').value = 5;
    toast(`เพิ่มชนิดกีฬา "${label}" แล้ว ✓`);
    renderSportsList();
    render();
  });

  // ================= STATS MODAL =================
  const statsBackdrop = document.getElementById('statsModalBackdrop');

  async function loadAndRenderStats() {
    const res = await fetch('/api/stats', { cache: 'no-store' });
    const stats = await res.json();

    document.getElementById('statsSummary').innerHTML = `
      <div class="stats-tile">
        <div class="val">${stats.today.unique}</div>
        <div class="lbl">ผู้เข้าชมวันนี้ (ไม่ซ้ำ)</div>
      </div>
      <div class="stats-tile">
        <div class="val">${stats.today.views}</div>
        <div class="lbl">ครั้งที่เข้าชมวันนี้</div>
      </div>
      <div class="stats-tile">
        <div class="val">${stats.allTime.unique}</div>
        <div class="lbl">ผู้เข้าชมทั้งหมด (ไม่ซ้ำ)</div>
      </div>
      <div class="stats-tile">
        <div class="val">${stats.allTime.views}</div>
        <div class="lbl">ยอดเข้าชมสะสมทั้งหมด</div>
      </div>
    `;

    const maxViews = Math.max(1, ...stats.history.map((h) => h.views));
    const historyEl = document.getElementById('statsHistory');
    if (!stats.history.length) {
      historyEl.innerHTML = `<div class="empty">ยังไม่มีข้อมูลผู้เข้าชม</div>`;
    } else {
      historyEl.innerHTML = [...stats.history].reverse().map((h) => `
        <div class="stats-bar-row">
          <span class="stats-bar-date">${h.date.slice(5)}</span>
          <span class="stats-bar-track"><span class="stats-bar-fill" style="width:${(h.views / maxViews) * 100}%"></span></span>
          <span class="stats-bar-count">${h.views} ครั้ง / ${h.unique} คน</span>
        </div>
      `).join('');
    }
  }

  document.getElementById('statsBtn').addEventListener('click', () => {
    statsBackdrop.style.display = 'flex';
    loadAndRenderStats();
  });
  document.getElementById('statsModalCloseBtn').addEventListener('click', () => statsBackdrop.style.display = 'none');
  document.getElementById('closeStatsBtn').addEventListener('click', () => statsBackdrop.style.display = 'none');
  statsBackdrop.addEventListener('click', (e) => { if (e.target === statsBackdrop) statsBackdrop.style.display = 'none'; });

  // ================= LOGIN =================
  function showLogin() {
    document.getElementById('loginGate').style.display = '';
    document.getElementById('adminPanel').style.display = 'none';
  }

  function showPanel() {
    document.getElementById('loginGate').style.display = 'none';
    document.getElementById('adminPanel').style.display = '';
    loadData();
    setInterval(loadData, 30000);
  }

  document.getElementById('loginBtn').addEventListener('click', async () => {
    const pin = document.getElementById('pinInput').value.trim();
    const errEl = document.getElementById('loginError');
    errEl.textContent = '';
    if (!pin) return;
    const ok = await tryLogin(pin);
    if (ok) {
      state.pin = pin;
      sessionStorage.setItem('sn_admin_pin', pin);
      showPanel();
    } else {
      errEl.textContent = 'รหัส PIN ไม่ถูกต้อง กรุณาลองใหม่';
    }
  });

  document.getElementById('pinInput').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') document.getElementById('loginBtn').click();
  });

  document.getElementById('searchInput').addEventListener('input', () => { if (state.data) render(); });

  if (state.pin) {
    tryLogin(state.pin).then((ok) => (ok ? showPanel() : showLogin()));
  } else {
    showLogin();
  }
})();
