// server.js — ศรีนครเกมส์ ครั้งที่ 30 : live scoreboard server
// Zero dependencies — uses only Node's built-in http/fs modules.
const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');
const crypto = require('crypto');

const PORT = process.env.PORT || 3000;
const ADMIN_PIN = process.env.ADMIN_PIN || '2569';
const DATA_FILE = path.join(__dirname, 'data', 'matches.json');
const STATS_FILE = path.join(__dirname, 'data', 'stats.json');
const PUBLIC_DIR = path.join(__dirname, 'public');

function bangkokDateStr(date = new Date()) {
  // en-CA locale formats as YYYY-MM-DD, and this respects the Bangkok timezone
  // regardless of what timezone the server machine itself is running in.
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok' }).format(date);
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

const VALID_TEAM_KEYS = ['green', 'blue', 'pink', 'red'];

// ---------- storage helpers ----------
function readDataRaw() {
  const raw = fs.readFileSync(DATA_FILE, 'utf8');
  return JSON.parse(raw);
}

// fills in fields that may be missing from older data files, so upgrading
// the server code never breaks or discards scores a teacher already entered
function migrate(data) {
  data.teams = data.teams || {};
  data.sports = data.sports || {};
  data.matches = data.matches || [];

  for (const key of Object.keys(data.sports)) {
    const s = data.sports[key];
    if (!('championTeam' in s)) s.championTeam = null;
    if (!('championPoints' in s)) s.championPoints = 5;
  }

  data.matches = data.matches.map((m) => {
    const sportMeta = data.sports[m.sport] || {};
    return {
      category: null,
      note: null,
      referee: null,
      round: null,
      winnerOverride: null,
      statusOverride: null,
      ...m,
      venue: m.venue || sportMeta.venue || null,
    };
  });

  return data;
}

function readData() {
  return migrate(readDataRaw());
}

function writeData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
}

// ---------- visitor stats helpers ----------
function readStats() {
  try {
    return JSON.parse(fs.readFileSync(STATS_FILE, 'utf8'));
  } catch (e) {
    return { daily: {}, allVisitorIds: [] };
  }
}

function writeStats(stats) {
  fs.writeFileSync(STATS_FILE, JSON.stringify(stats, null, 2), 'utf8');
}

function recordVisit(visitorId) {
  const stats = readStats();
  const today = bangkokDateStr();
  stats.daily = stats.daily || {};
  stats.allVisitorIds = stats.allVisitorIds || [];

  if (!stats.daily[today]) stats.daily[today] = { views: 0, uniqueIds: [] };
  stats.daily[today].views += 1;

  const id = typeof visitorId === 'string' && visitorId ? visitorId.slice(0, 80) : null;
  if (id) {
    if (!stats.daily[today].uniqueIds.includes(id)) stats.daily[today].uniqueIds.push(id);
    if (!stats.allVisitorIds.includes(id)) stats.allVisitorIds.push(id);
  }

  // keep the file from growing forever — retain the most recent 90 days
  const dates = Object.keys(stats.daily).sort();
  if (dates.length > 90) {
    for (const d of dates.slice(0, dates.length - 90)) delete stats.daily[d];
  }

  writeStats(stats);
  return summarizeStats(stats);
}

function summarizeStats(stats) {
  const today = bangkokDateStr();
  const todayStats = stats.daily[today] || { views: 0, uniqueIds: [] };
  const dates = Object.keys(stats.daily).sort();

  const totalViews = dates.reduce((sum, d) => sum + (stats.daily[d].views || 0), 0);
  const totalUniqueVisitors = (stats.allVisitorIds || []).length;

  const history = dates.slice(-14).map((d) => ({
    date: d,
    views: stats.daily[d].views,
    unique: stats.daily[d].uniqueIds.length,
  }));

  return {
    today: { date: today, views: todayStats.views, unique: todayStats.uniqueIds.length },
    allTime: { views: totalViews, unique: totalUniqueVisitors },
    history,
  };
}

// compute live status from date/time/duration, unless manually overridden
function computeStatus(entry, now) {
  if (entry.statusOverride) return entry.statusOverride;
  if (!entry.date || !entry.time) return 'scheduled';
  const start = new Date(`${entry.date}T${entry.time}:00+07:00`);
  const end = new Date(start.getTime() + (entry.durationMin || 30) * 60000);
  if (now < start) return 'scheduled';
  if (now >= start && now < end) return 'live';
  return 'finished';
}

function deriveWinner(entry) {
  if (entry.type !== 'match') return null;
  if (entry.winnerOverride) return entry.winnerOverride;
  if (entry.score1 === null || entry.score1 === undefined) return null;
  if (entry.score2 === null || entry.score2 === undefined) return null;
  if (entry.score1 > entry.score2) return 'team1';
  if (entry.score2 > entry.score1) return 'team2';
  return 'draw';
}

function enrich(data) {
  const now = new Date();
  return {
    ...data,
    matches: data.matches.map((m) => ({
      ...m,
      status: computeStatus(m, now),
      winner: deriveWinner(m),
    })),
  };
}

function newId() {
  return 'm' + crypto.randomBytes(4).toString('hex');
}

function slugify(label) {
  const base = label
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '_')
    .replace(/^_+|_+$/g, '');
  return base || 'sport_' + Date.now();
}

// ---------- validation ----------
function validateMatchPayload(body, data, isCreate) {
  const errors = [];
  const type = body.type === 'event' ? 'event' : 'match';

  if (isCreate) {
    if (!body.sport || !data.sports[body.sport]) errors.push('กรุณาเลือกชนิดกีฬาที่มีอยู่ในระบบ');
    if (!body.date) errors.push('กรุณาระบุวันที่');
    if (!body.time) errors.push('กรุณาระบุเวลา');
  }
  if (type === 'match') {
    if (isCreate && !VALID_TEAM_KEYS.includes(body.team1Key)) errors.push('กรุณาเลือกสีทีมที่ 1');
    if (isCreate && !VALID_TEAM_KEYS.includes(body.team2Key)) errors.push('กรุณาเลือกสีทีมที่ 2');
    if (isCreate && body.team1Key && body.team1Key === body.team2Key) errors.push('ทีมทั้งสองฝั่งต้องเป็นคนละสีกัน');
  } else if (isCreate) {
    if (!body.title || !body.title.trim()) errors.push('กรุณาระบุชื่อกิจกรรม');
  }
  return errors;
}

// ---------- tiny http helpers ----------
function sendJSON(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
  });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
      if (raw.length > 1e6) req.destroy();
    });
    req.on('end', () => {
      if (!raw) return resolve({});
      try { resolve(JSON.parse(raw)); } catch (e) { reject(e); }
    });
    req.on('error', reject);
  });
}

function serveStatic(req, res, pathname) {
  let filePath = pathname === '/' ? '/index.html' : pathname;
  filePath = path.normalize(filePath).replace(/^(\.\.[/\\])+/, '');
  const fullPath = path.join(PUBLIC_DIR, filePath);
  if (!fullPath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403); res.end('Forbidden'); return;
  }
  fs.readFile(fullPath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('ไม่พบหน้านี้ (404)');
      return;
    }
    const ext = path.extname(fullPath).toLowerCase();
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(data);
  });
}

function checkPin(req) {
  return req.headers['x-admin-pin'] === ADMIN_PIN;
}

// ---------- server ----------
const server = http.createServer(async (req, res) => {
  const parsed = url.parse(req.url, true);
  const pathname = parsed.pathname;

  try {
    // GET /api/matches — public, always fresh computed status
    if (req.method === 'GET' && pathname === '/api/matches') {
      return sendJSON(res, 200, enrich(readData()));
    }

    if (req.method === 'GET' && pathname === '/api/now') {
      return sendJSON(res, 200, { now: new Date().toISOString() });
    }

    // POST /api/visit — public, anonymous page-view ping (called once per page load)
    if (req.method === 'POST' && pathname === '/api/visit') {
      const body = await readBody(req);
      const summary = recordVisit(body.visitorId);
      return sendJSON(res, 200, summary);
    }

    // GET /api/stats — public, current visitor counts (shown on the homepage + admin panel)
    if (req.method === 'GET' && pathname === '/api/stats') {
      return sendJSON(res, 200, summarizeStats(readStats()));
    }

    if (req.method === 'POST' && pathname === '/api/admin/login') {
      const body = await readBody(req);
      if (body.pin === ADMIN_PIN) return sendJSON(res, 200, { ok: true });
      return sendJSON(res, 401, { ok: false, error: 'PIN ไม่ถูกต้อง' });
    }

    // everything below here requires the admin PIN
    if (pathname.startsWith('/api/admin/') && pathname !== '/api/admin/login') {
      if (!checkPin(req)) return sendJSON(res, 401, { error: 'PIN ไม่ถูกต้อง กรุณาเข้าสู่ระบบใหม่' });
    }

    // ---- POST /api/admin/matches — create ----
    if (req.method === 'POST' && pathname === '/api/admin/matches') {
      const body = await readBody(req);
      const data = readData();
      const errors = validateMatchPayload(body, data, true);
      if (errors.length) return sendJSON(res, 400, { error: errors.join(' / ') });

      const type = body.type === 'event' ? 'event' : 'match';
      const sportMeta = data.sports[body.sport];
      const base = {
        id: newId(),
        type,
        sport: body.sport,
        category: body.category || null,
        round: body.round || null,
        date: body.date,
        time: body.time,
        durationMin: Number(body.durationMin) || (type === 'match' ? 30 : 45),
        venue: body.venue || sportMeta.venue || null,
        referee: body.referee || null,
        note: body.note || null,
        statusOverride: null,
      };

      let entry;
      if (type === 'match') {
        entry = {
          ...base,
          team1: data.teams[body.team1Key],
          team2: data.teams[body.team2Key],
          score1: null,
          score2: null,
          winnerOverride: null,
        };
      } else {
        entry = { ...base, title: body.title.trim() };
      }

      data.matches.push(entry);
      writeData(data);
      const now = new Date();
      return sendJSON(res, 201, { ...entry, status: computeStatus(entry, now), winner: deriveWinner(entry) });
    }

    // ---- PATCH /api/admin/matches/:id — edit any field ----
    const matchIdMatch = pathname.match(/^\/api\/admin\/matches\/([^/]+)$/);
    if (req.method === 'PATCH' && matchIdMatch) {
      const id = matchIdMatch[1];
      const body = await readBody(req);
      const data = readData();
      const idx = data.matches.findIndex((m) => m.id === id);
      if (idx === -1) return sendJSON(res, 404, { error: 'ไม่พบรายการ' });

      const entry = data.matches[idx];

      const allowedSimple = [
        'category', 'round', 'date', 'time', 'durationMin', 'venue',
        'referee', 'note', 'statusOverride', 'score1', 'score2',
        'winnerOverride', 'title', 'sport',
      ];
      for (const key of allowedSimple) {
        if (key in body) entry[key] = body[key];
      }
      if ('team1Key' in body && VALID_TEAM_KEYS.includes(body.team1Key)) entry.team1 = data.teams[body.team1Key];
      if ('team2Key' in body && VALID_TEAM_KEYS.includes(body.team2Key)) entry.team2 = data.teams[body.team2Key];

      data.matches[idx] = entry;
      writeData(data);
      const now = new Date();
      return sendJSON(res, 200, { ...entry, status: computeStatus(entry, now), winner: deriveWinner(entry) });
    }

    // ---- DELETE /api/admin/matches/:id ----
    if (req.method === 'DELETE' && matchIdMatch) {
      const id = matchIdMatch[1];
      const data = readData();
      const idx = data.matches.findIndex((m) => m.id === id);
      if (idx === -1) return sendJSON(res, 404, { error: 'ไม่พบรายการ' });
      data.matches.splice(idx, 1);
      writeData(data);
      return sendJSON(res, 200, { ok: true, deletedId: id });
    }

    // ---- POST /api/admin/sports — create sport category ----
    if (req.method === 'POST' && pathname === '/api/admin/sports') {
      const body = await readBody(req);
      const data = readData();
      if (!body.label || !body.label.trim()) return sendJSON(res, 400, { error: 'กรุณาระบุชื่อชนิดกีฬา' });
      let key = body.key ? slugify(body.key) : slugify(body.label);
      let uniqueKey = key;
      let n = 2;
      while (data.sports[uniqueKey]) { uniqueKey = `${key}_${n}`; n++; }

      data.sports[uniqueKey] = {
        label: body.label.trim(),
        icon: body.icon || '🏟',
        venue: body.venue || '',
        championTeam: null,
        championPoints: Number(body.championPoints) || 5,
      };
      writeData(data);
      return sendJSON(res, 201, { key: uniqueKey, ...data.sports[uniqueKey] });
    }

    // ---- PATCH /api/admin/sports/:key ----
    const sportKeyMatch = pathname.match(/^\/api\/admin\/sports\/([^/]+)$/);
    if (req.method === 'PATCH' && sportKeyMatch) {
      const key = decodeURIComponent(sportKeyMatch[1]);
      const body = await readBody(req);
      const data = readData();
      if (!data.sports[key]) return sendJSON(res, 404, { error: 'ไม่พบชนิดกีฬานี้' });
      const s = data.sports[key];
      const allowed = ['label', 'icon', 'venue', 'championTeam', 'championPoints'];
      for (const f of allowed) {
        if (f in body) s[f] = body[f];
      }
      data.sports[key] = s;
      writeData(data);
      return sendJSON(res, 200, { key, ...s });
    }

    // ---- DELETE /api/admin/sports/:key ----
    if (req.method === 'DELETE' && sportKeyMatch) {
      const key = decodeURIComponent(sportKeyMatch[1]);
      const data = readData();
      if (!data.sports[key]) return sendJSON(res, 404, { error: 'ไม่พบชนิดกีฬานี้' });
      const inUse = data.matches.some((m) => m.sport === key);
      if (inUse) return sendJSON(res, 409, { error: 'ลบไม่ได้ เพราะยังมีรายการแข่งขันที่ใช้ชนิดกีฬานี้อยู่ กรุณาลบหรือย้ายรายการเหล่านั้นก่อน' });
      delete data.sports[key];
      writeData(data);
      return sendJSON(res, 200, { ok: true, deletedKey: key });
    }

    // everything else -> static files from /public
    if (req.method === 'GET') {
      return serveStatic(req, res, pathname);
    }

    res.writeHead(405); res.end('Method Not Allowed');
  } catch (err) {
    console.error(err);
    sendJSON(res, 500, { error: 'เกิดข้อผิดพลาดภายในเซิร์ฟเวอร์' });
  }
});

server.listen(PORT, () => {
  console.log(`ศรีนครเกมส์ ครั้งที่ 30 — server running at http://localhost:${PORT}`);
  console.log(`Admin PIN: ${ADMIN_PIN} (set ADMIN_PIN env var to change)`);
});
