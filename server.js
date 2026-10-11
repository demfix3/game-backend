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

// ============ ЗАГРУЗКА ============
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

// ============ СОХРАНЕНИЕ ============
app.post('/save', async (req, res) => {
  try {
    const d = req.body;
    if (!d.userId) return res.json({ error: 'no userId' });

    let current = await db.getPlayer(d.userId);
    if (!current) {
      await db.createPlayer(d.userId, d.name);
      current = await db.getPlayer(d.userId);
    }

    const nScore = Math.floor(d.score || 0);
    const cScore = Math.floor(current.score || 0);
    const nTaps = Math.floor(d.totalTaps || 0);
    const cTaps = Math.floor(current.totalTaps || 0);
    const nTapLevel = Math.floor(d.tapLevel || 0);
    const cTapLevel = Math.floor(current.tapLevel || 0);
    const nEnergyLevel = Math.floor(d.energyLevel || 0);
    const cEnergyLevel = Math.floor(current.energyLevel || 0);
    const nRegenLevel = Math.floor(d.regenLevel || 0);
    const cRegenLevel = Math.floor(current.regenLevel || 0);

    // Логируем
    console.log('━━━ id=' + d.userId + ' NEW=' + nScore + '/L' + nTapLevel + '/E' + nEnergyLevel + '/R' + nRegenLevel + ' CUR=' + cScore + '/L' + cTapLevel + '/E' + cEnergyLevel + '/R' + cRegenLevel);

    // ГЛАВНОЕ: если уровни улучшений ВЫРОСЛИ — ВСЕГДА сохраняем
    const levelsGrew = (nTapLevel > cTapLevel) || (nEnergyLevel > cEnergyLevel) || (nRegenLevel > cRegenLevel);

    // Если уровни НЕ выросли И score меньше И тапы меньше — ИГНОРИРУЕМ
    if (!levelsGrew && nScore < cScore && nTaps < cTaps) {
      console.log('   ❌ IGNORED');
      return res.json({
        success: true, ignored: true,
        current: {
          score: cScore, totalTaps: cTaps,
          tapLevel: cTapLevel, energyLevel: cEnergyLevel, regenLevel: cRegenLevel,
          tapPower: current.tapPower, playerLevel: current.playerLevel,
          energy: current.energy, maxEnergy: current.maxEnergy, regen: current.regen
        }
      });
    }

    // СОХРАНЯЕМ
    await db.savePlayer(d.userId, d);
    const check = await db.getPlayer(d.userId);
    console.log('   ✅ SAVED score=' + check.score + ' L' + check.tapLevel + '/E' + check.energyLevel + '/R' + check.regenLevel);

    res.json({
      success: true,
      saved: {
        score: check.score, totalTaps: check.totalTaps,
        tapLevel: check.tapLevel, energyLevel: check.energyLevel, regenLevel: check.regenLevel,
        tapPower: check.tapPower, playerLevel: check.playerLevel,
        energy: check.energy, maxEnergy: check.maxEnergy, regen: check.regen
      }
    });
  } catch (e) {
    console.log('❌ SAVE ERROR:', e.message);
    res.json({ error: e.message });
  }
});

// ============ ЛИДЕРБОРД ============
app.get('/leaderboard', async (req, res) => res.json(await db.getTop(100)));

// ============ РЕФЕРАЛЫ ============
app.post('/claimrefs', async (req, res) => res.json(await db.claimRefs(req.body.userId)));

// ============ ПРОМОКОДЫ ============
app.post('/usepromo', async (req, res) => {
  const { userId, code } = req.body;
  if (!userId || !code) return res.json({ success: false, reason: 'no_data' });
  res.json(await db.usePromo(code.toUpperCase(), userId));
});

// ============ БУСТЫ ============
app.get('/boosts', async (req, res) => {
  const userId = String(req.query.id);
  if (!userId) return res.json({ boosts: [] });
  res.json({ boosts: await db.getActiveBoosts(userId) });
});

app.listen(3000, () => console.log('✅ Сервер запущен: http://localhost:3000'));
