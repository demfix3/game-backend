const express = require('express');
const db = require('./database');
const app = express();

app.use(express.json());

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

app.get('/', (req, res) => res.json({ status: 'ok' }));

app.get('/load', async (req, res) => {
  const userId = String(req.query.id);
  if (!userId || userId === 'undefined') return res.json({ error: 'no id' });
  let player = await db.getPlayer(userId);
  if (!player) {
    await db.createPlayer(userId, 'Игрок');
    player = await db.getPlayer(userId);
  }
  res.json(player);
});

app.post('/save', async (req, res) => {
  try {
    const d = req.body;
    if (!d.userId) return res.json({ error: 'no userId' });

    let current = await db.getPlayer(d.userId);
    if (!current) {
      await db.createPlayer(d.userId, d.name);
      current = await db.getPlayer(d.userId);
    }

    const newScore = Math.floor(d.score || 0);
    const currentScore = current.score || 0;
    const currentTaps = current.totalTaps || 0;
    const newTaps = Math.floor(d.totalTaps || 0);

    // Если новый score МЕНЬШЕ текущего И тапы меньше - игнорируем
    if (newScore < currentScore && newTaps < currentTaps) {
      console.log('SAVE IGNORED (lower):', d.userId, 'new score:', newScore, 'current:', currentScore);
      res.json({ success: true, ignored: true, current: { score: currentScore, totalTaps: currentTaps } });
      return;
    }

    await db.savePlayer(d.userId, d);
    const check = await db.getPlayer(d.userId);
    console.log('SAVE OK:', d.userId, 'name:', check.name, 'score:', check.score, 'taps:', check.totalTaps);
    res.json({ success: true, saved: { score: check.score, totalTaps: check.totalTaps } });
  } catch (e) {
    console.log('SAVE ERROR:', e.message);
    res.json({ error: e.message });
  }
});

app.get('/leaderboard', async (req, res) => {
  const top = await db.getTop(100);
  res.json(top);
});

app.get('/refs', async (req, res) => {
  const userId = String(req.query.id);
  const refs = await db.getReferrals(userId);
  res.json(refs);
});

app.post('/claimrefs', async (req, res) => {
  const result = await db.claimRefs(req.body.userId);
  res.json(result);
});

app.listen(3000, () => console.log('✅ Сервер запущен: http://localhost:3000'));
