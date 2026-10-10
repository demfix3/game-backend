const express = require('express');
const db = require('./database');
const app = express();

app.use(express.json());

// Отключаем предупреждение ngrok
app.use((req, res, next) => {
  res.setHeader('ngrok-skip-browser-warning', 'true');
  next();
});

// CORS
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Content-Type, ngrok-skip-browser-warning');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

app.get('/', (req, res) => {
  res.json({ status: 'ok', message: 'Сервер работает' });
});

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
  const data = req.body;
  if (!data.userId) return res.json({ error: 'no id' });
  await db.savePlayer(data.userId, data);
  res.json({ success: true });
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

app.listen(3000, () => console.log('Сервер запущен: http://localhost:3000'));