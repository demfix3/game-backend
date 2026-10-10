const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('game.db');

db.run(`CREATE TABLE IF NOT EXISTS players (
  id TEXT PRIMARY KEY,
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

function getPlayer(id) {
  return new Promise((resolve) => {
    db.get('SELECT * FROM players WHERE id = ?', [id], (err, row) => resolve(row));
  });
}

function createPlayer(id) {
  return new Promise((resolve) => {
    db.run('INSERT OR IGNORE INTO players (id, created_at, last_seen) VALUES (?, ?, ?)', [id, Date.now(), Date.now()], () => resolve());
  });
}

function savePlayer(id, data) {
  return new Promise((resolve) => {
    // Сначала убеждаемся, что игрок существует
    db.run('INSERT OR IGNORE INTO players (id, created_at, last_seen) VALUES (?, ?, ?)', [id, Date.now(), Date.now()], () => {
      // Теперь UPDATE
      db.run(
        'UPDATE players SET score = ?, energy = ?, maxEnergy = ?, regen = ?, tapPower = ?, tapLevel = ?, energyLevel = ?, regenLevel = ?, totalTaps = ?, playerLevel = ?, last_seen = ? WHERE id = ?',
        [
          Math.floor(data.score || 0),
          data.energy !== undefined ? data.energy : 100,
          data.maxEnergy || 100,
          data.regen || 0.5,
          data.tapPower || 1,
          data.tapLevel || 0,
          data.energyLevel || 0,
          data.regenLevel || 0,
          Math.floor(data.totalTaps || 0),
          data.playerLevel || 1,
          Date.now(),
          id
        ],
        function(err) {
          if (err) console.log('SQL ERROR:', err);
          else console.log('UPDATED ROWS:', this.changes, 'for id:', id);
          resolve();
        }
      );
    });
  });
}

function getTop(limit) {
  return new Promise((resolve) => {
    db.all('SELECT id, score, playerLevel FROM players WHERE banned = 0 ORDER BY score DESC LIMIT ?', [limit], (err, rows) => resolve(rows || []));
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
      if (row) return resolve({ success: false });
      db.run('INSERT INTO referrals (user_id, ref_id, created_at) VALUES (?, ?, ?)', [userId, refId, Date.now()], () => {
        db.run('UPDATE players SET refCount = refCount + 1 WHERE id = ?', [refId], () => {
          resolve({ success: true });
        });
      });
    });
  });
}

function getStats() {
  return new Promise((resolve) => {
    db.get('SELECT COUNT(*) as players, SUM(score) as totalScore FROM players WHERE banned = 0', (err, row) => {
      resolve(row || { players: 0, totalScore: 0 });
    });
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

module.exports = { getPlayer, createPlayer, savePlayer, getTop, addReferral, getReferrals, claimRefs, getStats, giveCoins, getAllPlayers };
