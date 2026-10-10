const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('game.db');

db.run(`CREATE TABLE IF NOT EXISTS players (
  id TEXT PRIMARY KEY,
  name TEXT DEFAULT 'Игрок',
  score INTEGER DEFAULT 0,
  energy REAL DEFAULT 100,
  maxEnergy INTEGER DEFAULT 100,
  regen REAL DEFAULT 0.5,
  tapPower INTEGER DEFAULT 1,
  tapLevel INTEGER DEFAULT 0,
  energyLevel INTEGER DEFAULT 0,
  regenLevel INTEGER DEFAULT 0,
  totalTaps INTEGER DEFAULT 0,
  playerLevel INTEGER DEFAULT 1,
  refCount INTEGER DEFAULT 0,
  refClaimed INTEGER DEFAULT 0,
  banned INTEGER DEFAULT 0,
  created_at INTEGER DEFAULT 0,
  last_seen INTEGER DEFAULT 0
)`);

db.run(`CREATE TABLE IF NOT EXISTS referrals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT UNIQUE,
  ref_id TEXT,
  created_at INTEGER
)`);

db.run(`CREATE TABLE IF NOT EXISTS promocodes (
  code TEXT PRIMARY KEY,
  reward INTEGER DEFAULT 0,
  maxUses INTEGER DEFAULT 1,
  usedCount INTEGER DEFAULT 0,
  created_at INTEGER DEFAULT 0
)`);

db.run(`CREATE TABLE IF NOT EXISTS promo_uses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT,
  user_id TEXT,
  used_at INTEGER,
  UNIQUE(code, user_id)
)`);

db.run('ALTER TABLE players ADD COLUMN name TEXT DEFAULT "Игрок"', (err) => { if (err) {} });

function getPlayer(id) {
  return new Promise((resolve) => {
    db.get('SELECT * FROM players WHERE id = ?', [id], (err, row) => resolve(row));
  });
}

function createPlayer(id, name) {
  return new Promise((resolve) => {
    db.run('INSERT OR IGNORE INTO players (id, name, created_at, last_seen) VALUES (?, ?, ?, ?)', [id, name || 'Игрок', Date.now(), Date.now()], () => resolve());
  });
}

function savePlayer(id, data) {
  return new Promise((resolve) => {
    db.run('INSERT OR IGNORE INTO players (id, name, created_at, last_seen) VALUES (?, ?, ?, ?)', [id, data.name || 'Игрок', Date.now(), Date.now()], () => {
      db.run(
        'UPDATE players SET name = ?, score = ?, energy = ?, maxEnergy = ?, regen = ?, tapPower = ?, tapLevel = ?, energyLevel = ?, regenLevel = ?, totalTaps = ?, playerLevel = ?, last_seen = ? WHERE id = ?',
        [data.name || 'Игрок', Math.floor(data.score || 0), data.energy !== undefined ? data.energy : 100, data.maxEnergy || 100, data.regen || 0.5, data.tapPower || 1, data.tapLevel || 0, data.energyLevel || 0, data.regenLevel || 0, Math.floor(data.totalTaps || 0), data.playerLevel || 1, Date.now(), id],
        function(err) { if (err) console.log('SQL ERROR:', err); else console.log('UPDATED ROWS:', this.changes, 'for id:', id); resolve(); }
      );
    });
  });
}

function getTop(limit) {
  return new Promise((resolve) => {
    db.all('SELECT id, name, score, totalTaps, playerLevel FROM players WHERE banned = 0 ORDER BY totalTaps DESC LIMIT ?', [limit], (err, rows) => resolve(rows || []));
  });
}

function getReferrals(userId) {
  return new Promise((resolve) => {
    db.get('SELECT refCount, refClaimed FROM players WHERE id = ?', [userId], (err, row) => resolve(row || { refCount: 0, refClaimed: 0 }));
  });
}

function claimRefs(userId) {
  return new Promise((resolve) => {
    db.get('SELECT refCount, refClaimed FROM players WHERE id = ?', [userId], (err, row) => {
      if (!row) return resolve({ success: false });
      const newRefs = row.refCount - row.refClaimed;
      if (newRefs <= 0) return resolve({ success: false });
      const bonus = newRefs * 5000;
      db.run('UPDATE players SET refClaimed = refCount, score = score + ? WHERE id = ?', [bonus, userId], () => {
        resolve({ success: true, bonus });
      });
    });
  });
}

function addReferral(userId, refId) {
  return new Promise((resolve) => {
    db.get('SELECT * FROM referrals WHERE user_id = ?', [userId], (err, row) => {
      if (row) return resolve({ success: false, reason: 'already_referred' });
      if (String(userId) === String(refId)) return resolve({ success: false, reason: 'self' });
      db.run('INSERT INTO referrals (user_id, ref_id, created_at) VALUES (?, ?, ?)', [userId, refId, Date.now()], function(err) {
        if (err) return resolve({ success: false, reason: 'db_error' });
        db.run('UPDATE players SET refCount = refCount + 1 WHERE id = ?', [refId], () => resolve({ success: true }));
      });
    });
  });
}

function getStats() {
  return new Promise((resolve) => {
    db.get('SELECT COUNT(*) as players, SUM(score) as totalScore FROM players WHERE banned = 0', (err, row) => resolve(row || { players: 0, totalScore: 0 }));
  });
}

function giveCoins(userId, amount) {
  return new Promise((resolve) => {
    db.run('UPDATE players SET score = score + ? WHERE id = ?', [amount, userId], () => resolve());
  });
}

function getAllPlayers() {
  return new Promise((resolve) => {
    db.all('SELECT id FROM players WHERE banned = 0', (err, rows) => resolve(rows || []));
  });
}

function banPlayer(userId, banned) {
  return new Promise((resolve) => {
    db.run('UPDATE players SET banned = ? WHERE id = ?', [banned ? 1 : 0, userId], () => resolve());
  });
}

function deletePlayer(userId) {
  return new Promise((resolve) => {
    db.run('DELETE FROM players WHERE id = ?', [userId], () => {
      db.run('DELETE FROM referrals WHERE user_id = ? OR ref_id = ?', [userId, userId], () => resolve());
    });
  });
}

// ============ ПРОМОКОДЫ ============

function createPromo(code, reward, maxUses) {
  return new Promise((resolve) => {
    db.run('INSERT OR REPLACE INTO promocodes (code, reward, maxUses, usedCount, created_at) VALUES (?, ?, ?, 0, ?)', [code, reward, maxUses, Date.now()], function(err) {
      if (err) return resolve({ success: false, error: err.message });
      resolve({ success: true });
    });
  });
}

function getPromo(code) {
  return new Promise((resolve) => {
    db.get('SELECT * FROM promocodes WHERE code = ?', [code], (err, row) => resolve(row));
  });
}

function listPromos() {
  return new Promise((resolve) => {
    db.all('SELECT * FROM promocodes ORDER BY created_at DESC LIMIT 50', (err, rows) => resolve(rows || []));
  });
}

function deletePromo(code) {
  return new Promise((resolve) => {
    db.run('DELETE FROM promocodes WHERE code = ?', [code], () => {
      db.run('DELETE FROM promo_uses WHERE code = ?', [code], () => resolve());
    });
  });
}

function usePromo(code, userId) {
  return new Promise((resolve) => {
    db.get('SELECT * FROM promocodes WHERE code = ?', [code], (err, promo) => {
      if (!promo) return resolve({ success: false, reason: 'not_found' });
      if (promo.usedCount >= promo.maxUses) return resolve({ success: false, reason: 'limit' });
      db.get('SELECT * FROM promo_uses WHERE code = ? AND user_id = ?', [code, userId], (err, use) => {
        if (use) return resolve({ success: false, reason: 'already_used' });
        db.run('INSERT INTO promo_uses (code, user_id, used_at) VALUES (?, ?, ?)', [code, userId, Date.now()], () => {
          db.run('UPDATE promocodes SET usedCount = usedCount + 1 WHERE code = ?', [code], () => {
            db.run('UPDATE players SET score = score + ? WHERE id = ?', [promo.reward, userId], () => {
              resolve({ success: true, reward: promo.reward });
            });
          });
        });
      });
    });
  });
}

module.exports = { getPlayer, createPlayer, savePlayer, getTop, addReferral, getReferrals, claimRefs, getStats, giveCoins, getAllPlayers, banPlayer, deletePlayer, createPromo, getPromo, listPromos, deletePromo, usePromo };
