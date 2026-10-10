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
    await db.createPlayer(userId);
    player = await db.getPlayer(userId);
  }
  res.json(player);
});

app.post('/save', async (req, res) => {
  try {
    const d = req.body;
    if (!d.userId) return res.json({ error: 'no userId' });

    // Загружаем игрока из базы
    let current = await db.getPlayer(d.userId);
    if (!current) {
      await db.createPlayer(d.userId);
      current = await db.getPlayer(d.userId);
    }

    // ЗАЩИТА: если новый score МЕНЬШЕ текущего - не перезаписываем score/totalTaps/level
    const newScore = Math.floor(d.score || 0);
    const newTaps = Math.floor(d.totalTaps || 0);
    const newLevel = d.playerLevel || 1;

    if (newScore >= (current.score || 0) || newScore >= (current.totalTaps || 0)) {
      // Обновляем только если данные больше или равны
      await db.savePlayer(d.userId, d);
      const check = await db.getPlayer(d.userId);
      console.log('SAVE OK:', d.userId, 'score:', check.score, 'taps:', check.totalTaps);
      res.json({ success: true, saved: { score: check.score, totalTaps: check.totalTaps } });
    } else {
      // Игнорируем «старый» save
      console.log('SAVE IGNORED (lower):', d.userId, 'new:', newScore, 'current:', current.score);
      res.json({ success: true, ignored: true, current: { score: current.score, totalTaps: current.totalTaps } });
    }
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
