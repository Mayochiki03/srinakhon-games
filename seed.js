// seed.js — generates data/matches.json from the ศรีนครเกมส์ ครั้งที่ 30 program
const fs = require('fs');
const path = require('path');

const TEAMS = {
  green:  { name: 'สีเขียว',    color: '#22C55E' },
  blue:   { name: 'สีน้ำเงิน',   color: '#3B82F6' },
  pink:   { name: 'สีชมพู',     color: '#EC4899' },
  red:    { name: 'สีแดง',      color: '#EF4444' },
};

const SPORTS = {
  badminton_m:      { label: 'แบดมินตัน ชาย มัธยมปลาย',   icon: '🏸', venue: 'หอประชุม' },
  badminton_w:      { label: 'แบดมินตัน หญิง มัธยมปลาย',  icon: '🏸', venue: 'หอประชุม' },
  sharball:         { label: 'แชร์บอล หญิง ประถม 4-6',    icon: '🤾', venue: 'ลานอเนกประสงค์' },
  futsal:           { label: 'ฟุตซอล ชาย มัธยมปลาย',      icon: '⚽', venue: 'สนามฟุตซอล' },
  football_prathom: { label: 'ฟุตบอล ประถม 4-6',          icon: '⚽', venue: 'สนามฟุตบอล' },
  football_matthayom:{ label: 'ฟุตบอล มัธยมต้น',          icon: '⚽', venue: 'สนามฟุตบอล' },
  volleyball:       { label: 'วอลเลย์บอลผสม มัธยมปลาย',    icon: '🏐', venue: 'สนามวอลเลย์บอล' },
  basketball:       { label: 'บาสเกตบอล',                 icon: '🏀', venue: 'สนามบาสเกตบอล' },
  coverdance:       { label: 'Coverdance',                icon: '💃', venue: 'หอประชุม' },
  esport:           { label: 'E-SPORT',                   icon: '🎮', venue: 'หอประชุม' },
  folkgame_prathom: { label: 'กีฬาพื้นบ้าน ช่วงชั้น 1 (ป.1-3)', icon: '🎯', venue: 'สนามฟุตบอล' },
  folkgame_matthayom:{ label: 'กีฬาพื้นบ้าน ช่วงชั้น 3 (ม.1-3)', icon: '🎯', venue: 'สนามฟุตบอล' },
  opening:          { label: 'พิธีเปิด + กรีฑา + ผู้นำเชียร์', icon: '🏅', venue: 'สนามฟุตบอล' },
};

let counter = 1;
const nextId = () => 'm' + String(counter++).padStart(3, '0');

function match({ sport, date, time = '15:10', round, t1, t2, ref, note }) {
  return {
    id: nextId(),
    type: 'match',
    sport,
    date, // YYYY-MM-DD
    time,
    durationMin: 30,
    round: round || null,
    team1: TEAMS[t1],
    team2: TEAMS[t2],
    score1: null,
    score2: null,
    winner: null, // 'team1' | 'team2' | 'draw' | null
    status: 'scheduled', // scheduled | live | finished (auto from time unless overridden)
    statusOverride: null,
    referee: ref || null,
    note: note || null,
  };
}

function event({ sport, date, time = '15:10', title, ref, note }) {
  return {
    id: nextId(),
    type: 'event',
    sport,
    date,
    time,
    durationMin: 45,
    title,
    status: 'scheduled',
    statusOverride: null,
    referee: ref || null,
    note: note || null,
  };
}

const M = [];

// แชร์บอล (หญิง) ประถม 4-6
M.push(match({ sport: 'sharball', date: '2026-07-08', round: 'คู่ 1', t1: 'green', t2: 'blue', ref: 'ครูวัลลำ' }));
M.push(match({ sport: 'sharball', date: '2026-07-08', round: 'คู่ 2', t1: 'pink', t2: 'red', ref: 'ครูปรเมษฐ์' }));
M.push(match({ sport: 'sharball', date: '2026-07-09', round: 'คู่ 3', t1: 'green', t2: 'red', ref: 'ครูวัลลำ' }));
M.push(match({ sport: 'sharball', date: '2026-07-09', round: 'คู่ 1', t1: 'pink', t2: 'blue', ref: 'ครูปรเมษฐ์' }));
M.push(match({ sport: 'sharball', date: '2026-07-10', round: 'คู่ 2', t1: 'red', t2: 'blue', ref: 'ครูวัลลำ' }));
M.push(match({ sport: 'sharball', date: '2026-07-10', round: 'คู่ 3', t1: 'green', t2: 'pink', ref: 'ครูปรเมษฐ์' }));

// กีฬาพื้นบ้าน ช่วงชั้น 1 (ป.1-3) — 14 ก.ค.
M.push(event({ sport: 'folkgame_prathom', date: '2026-07-14', title: 'โยนบอลลงตะกร้า', ref: 'ครูอนิรุต์' }));
M.push(event({ sport: 'folkgame_prathom', date: '2026-07-14', title: 'วิ่งผลัดลูกบอล', ref: 'ครูวิมล' }));
M.push(event({ sport: 'folkgame_prathom', date: '2026-07-14', title: 'วิ่ง 6 ขาสามัคคี', ref: 'ครูสุวิทย์' }));

// กีฬาพื้นบ้าน ช่วงชั้น 3 (ม.1-3) — 14 ก.ค.
M.push(event({ sport: 'folkgame_matthayom', date: '2026-07-14', title: 'เอ็กซ์-โอ', ref: 'ครูอนิรุต์' }));
M.push(event({ sport: 'folkgame_matthayom', date: '2026-07-14', title: 'ส่งความห่วงใย', ref: 'ครูวิมล' }));
M.push(event({ sport: 'folkgame_matthayom', date: '2026-07-14', title: 'ตีกอล์ฟคนจน', ref: 'ครูสุวิทย์' }));

// Coverdance
M.push(event({ sport: 'coverdance', date: '2026-07-09', title: 'Coverdance รอบแรก', note: 'ณ หอประชุม' }));
M.push(event({ sport: 'coverdance', date: '2026-07-22', title: 'Coverdance รอบสอง', note: 'ณ สนามฟุตบอล (หลังซ้อมพิธีเปิด)' }));

// E-SPORT
M.push(event({ sport: 'esport', date: '2026-07-10', title: 'การแข่งขัน E-SPORT', note: 'ณ หอประชุม' }));

// ฟุตบอล ประถม 4-6
M.push(match({ sport: 'football_prathom', date: '2026-07-14', round: 'คู่ 1', t1: 'green', t2: 'red', ref: 'ครูสมชาย' }));
M.push(match({ sport: 'football_prathom', date: '2026-07-14', round: 'คู่ 2', t1: 'pink', t2: 'blue', ref: 'ครูนาวี' }));
M.push(match({ sport: 'football_prathom', date: '2026-07-15', round: 'คู่ 1', t1: 'red', t2: 'blue', ref: 'ครูสมชาย' }));
M.push(match({ sport: 'football_prathom', date: '2026-07-16', round: 'คู่ 1', t1: 'pink', t2: 'red', ref: 'ครูนาวี' }));
M.push(match({ sport: 'football_prathom', date: '2026-07-16', round: 'คู่ 2', t1: 'green', t2: 'blue', ref: 'ครูสมชาย' }));
M.push(match({ sport: 'football_prathom', date: '2026-07-17', round: 'คู่ 1', t1: 'green', t2: 'pink', ref: 'ครูนาวี' }));

// ฟุตบอล มัธยมต้น
M.push(match({ sport: 'football_matthayom', date: '2026-07-14', round: 'คู่ 3', t1: 'pink', t2: 'red', ref: 'ครูสมชาย' }));
M.push(match({ sport: 'football_matthayom', date: '2026-07-15', round: 'คู่ 2', t1: 'green', t2: 'pink', ref: 'ครูนาวี' }));
M.push(match({ sport: 'football_matthayom', date: '2026-07-15', round: 'คู่ 3', t1: 'red', t2: 'blue', ref: 'ครูสมชาย' }));
M.push(match({ sport: 'football_matthayom', date: '2026-07-16', round: 'คู่ 3', t1: 'green', t2: 'blue', ref: 'ครูนาวี' }));
M.push(match({ sport: 'football_matthayom', date: '2026-07-17', round: 'คู่ 2', t1: 'green', t2: 'red', ref: 'ครูสมชาย' }));
M.push(match({ sport: 'football_matthayom', date: '2026-07-17', round: 'คู่ 3', t1: 'pink', t2: 'blue', ref: 'ครูนาวี' }));

// บาสเกตบอล
M.push(match({ sport: 'basketball', date: '2026-07-20', round: 'คู่ 1 · ชาย', t1: 'red', t2: 'blue', ref: 'ครูสุวิทย์' }));
M.push(match({ sport: 'basketball', date: '2026-07-20', round: 'คู่ 2 · หญิง', t1: 'green', t2: 'pink', ref: 'ครูไพโรจน์' }));
M.push(match({ sport: 'basketball', date: '2026-07-20', round: 'คู่ 3 · ชาย', t1: 'green', t2: 'pink', ref: 'ครูวิมล' }));
M.push(match({ sport: 'basketball', date: '2026-07-20', round: 'คู่ 4 · หญิง', t1: 'red', t2: 'blue', ref: 'ครูปรเมษฐ์' }));
M.push(match({ sport: 'basketball', date: '2026-07-21', round: 'คู่ 5 · ชาย', t1: 'pink', t2: 'blue', ref: 'ครูสุวิทย์' }));
M.push(match({ sport: 'basketball', date: '2026-07-21', round: 'คู่ 6 · หญิง', t1: 'green', t2: 'red', ref: 'ครูไพโรจน์' }));
M.push(match({ sport: 'basketball', date: '2026-07-21', round: 'คู่ 7 · ชาย', t1: 'green', t2: 'red', ref: 'ครูสุวิทย์' }));
M.push(match({ sport: 'basketball', date: '2026-07-21', round: 'คู่ 8 · หญิง', t1: 'pink', t2: 'blue', ref: 'ครูไพโรจน์' }));
M.push(match({ sport: 'basketball', date: '2026-07-22', round: 'คู่ 9 · ชาย', t1: 'red', t2: 'pink', ref: 'ครูวิมล' }));
M.push(match({ sport: 'basketball', date: '2026-07-22', round: 'คู่ 10 · หญิง', t1: 'green', t2: 'blue', ref: 'ครูปรเมษฐ์' }));
M.push(match({ sport: 'basketball', date: '2026-07-22', round: 'คู่ 11 · ชาย', t1: 'green', t2: 'blue', ref: 'ครูสุวิทย์' }));
M.push(match({ sport: 'basketball', date: '2026-07-22', round: 'คู่ 12 · หญิง', t1: 'red', t2: 'pink', ref: 'ครูไพโรจน์' }));

// ฟุตซอลชาย มัธยมปลาย
M.push(match({ sport: 'futsal', date: '2026-07-09', round: 'คู่ 1', t1: 'green', t2: 'pink', ref: 'ครูอนิรุต์' }));
M.push(match({ sport: 'futsal', date: '2026-07-09', round: 'คู่ 2', t1: 'red', t2: 'blue', ref: 'ครูธนากร' }));
M.push(match({ sport: 'futsal', date: '2026-07-10', round: 'คู่ 3', t1: 'pink', t2: 'blue', ref: 'ครูสุวิทย์' }));
M.push(match({ sport: 'futsal', date: '2026-07-10', round: 'คู่ 1', t1: 'green', t2: 'red', ref: 'ครูวิมล' }));
M.push(match({ sport: 'futsal', date: '2026-07-13', round: 'คู่ 2', t1: 'red', t2: 'pink', ref: 'ครูสมชาย' }));
M.push(match({ sport: 'futsal', date: '2026-07-13', round: 'คู่ 3', t1: 'green', t2: 'blue', ref: 'ครูนาวี' }));

// วอลเลย์บอลผสม มัธยมปลาย
M.push(match({ sport: 'volleyball', date: '2026-07-14', round: 'คู่ 1', t1: 'green', t2: 'pink', ref: 'ครูไพโรจน์' }));
M.push(match({ sport: 'volleyball', date: '2026-07-14', round: 'คู่ 2', t1: 'red', t2: 'blue', ref: 'ครูปรเมษฐ์' }));
M.push(match({ sport: 'volleyball', date: '2026-07-15', round: 'คู่ 3', t1: 'pink', t2: 'blue', ref: 'ครูสุวิทย์' }));
M.push(match({ sport: 'volleyball', date: '2026-07-15', round: 'คู่ 1', t1: 'green', t2: 'red', ref: 'ครูวิมล' }));
M.push(match({ sport: 'volleyball', date: '2026-07-16', round: 'คู่ 2', t1: 'red', t2: 'pink', ref: 'ครูไพโรจน์' }));
M.push(match({ sport: 'volleyball', date: '2026-07-16', round: 'คู่ 3', t1: 'green', t2: 'blue', ref: 'ครูปรเมษฐ์' }));

// แบดมินตัน ชาย มัธยมปลาย
M.push(match({ sport: 'badminton_m', date: '2026-07-06', round: 'คู่ 1', t1: 'green', t2: 'pink', ref: 'ครูวิมล' }));
M.push(match({ sport: 'badminton_m', date: '2026-07-06', round: 'คู่ 2', t1: 'red', t2: 'blue', ref: 'ครูวิมล' }));
M.push(match({ sport: 'badminton_m', date: '2026-07-07', round: 'คู่ 1', t1: 'pink', t2: 'blue', ref: 'ครูวิมล' }));
M.push(match({ sport: 'badminton_m', date: '2026-07-07', round: 'คู่ 2', t1: 'green', t2: 'red', ref: 'ครูวิมล' }));
M.push(match({ sport: 'badminton_m', date: '2026-07-08', round: 'คู่ 1', t1: 'red', t2: 'pink', ref: 'ครูวิมล' }));
M.push(match({ sport: 'badminton_m', date: '2026-07-08', round: 'คู่ 2', t1: 'green', t2: 'blue', ref: 'ครูวิมล' }));

// แบดมินตัน หญิง มัธยมปลาย
M.push(match({ sport: 'badminton_w', date: '2026-07-06', round: 'คู่ 1', t1: 'green', t2: 'pink', ref: 'ครูไพโรจน์' }));
M.push(match({ sport: 'badminton_w', date: '2026-07-06', round: 'คู่ 2', t1: 'red', t2: 'blue', ref: 'ครูไพโรจน์' }));
M.push(match({ sport: 'badminton_w', date: '2026-07-07', round: 'คู่ 1', t1: 'pink', t2: 'blue', ref: 'ครูไพโรจน์' }));
M.push(match({ sport: 'badminton_w', date: '2026-07-07', round: 'คู่ 2', t1: 'green', t2: 'red', ref: 'ครูไพโรจน์' }));
M.push(match({ sport: 'badminton_w', date: '2026-07-08', round: 'คู่ 1', t1: 'red', t2: 'pink', ref: 'ครูไพโรจน์' }));
M.push(match({ sport: 'badminton_w', date: '2026-07-08', round: 'คู่ 2', t1: 'green', t2: 'blue', ref: 'ครูไพโรจน์' }));

// พิธีเปิด + กรีฑา + ผู้นำเชียร์
M.push(event({ sport: 'opening', date: '2026-07-24', time: '08:00', title: 'พิธีเปิด การแข่งขันกรีฑา และผู้นำเชียร์' }));

const out = { teams: TEAMS, sports: SPORTS, matches: M };
fs.writeFileSync(path.join(__dirname, 'data', 'matches.json'), JSON.stringify(out, null, 2), 'utf8');
console.log(`Seeded ${M.length} entries into data/matches.json`);
