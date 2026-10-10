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
  if (!player) { await db.createPlayer(userId, 'Игрок'); player = await db.getPlayer(userId); }
  res.json(player);
});

app.post('/save', async (req, res) => {
  try {
    const d = req.body;
    if (!d.userId) return res.json({ error: 'no userId' });
    let current = await db.getPlayer(d.userId);
    if (!current) { await db.createPlayer(d.userId, d.name); current = await db.getPlayer(d.userId); }
    const newScore = Math.floor(d.score || 0);
    const currentScore = current.score || 0;
    const currentTaps = current.totalTaps || 0;
    const newTaps = Math.floor(d.totalTaps || 0);
    if (newScore < currentScore && newTaps < currentTaps) {
      return res.json({ success: true, ignored: true, current: { score: currentScore, totalTaps: currentTaps } });
    }
    await db.savePlayer(d.userId, d);
    const check = await db.getPlayer(d.userId);
    res.json({ success: true, saved: { score: check.score, totalTaps: check.totalTaps } });
  } catch (e) { res.json({ error: e.message }); }
});

app.get('/leaderboard', async (req, res) => res.json(await db.getTop(100)));

app.post('/claimrefs', async (req, res) => res.json(await db.claimRefs(req.body.userId)));

app.post('/usepromo', async (req, res) => {
  const { userId, code } = req.body;
  if (!userId || !code) return res.json({ success: false, reason: 'no_data' });
  const result = await db.usePromo(code.toUpperCase(), userId);
  res.json(result);
});

app.listen(3000, () => console.log('✅ Сервер запущен: http://localhost:3000'));
