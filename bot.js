const TelegramBot = require('node-telegram-bot-api');
const db = require('./database');

const TOKEN = process.env.BOT_TOKEN || '8946713588:AAFBiC0BP2HU7a9iS-4laj6SR7xjutcOexI';
const ADMIN_ID = process.env.ADMIN_ID || '1209267677';
const BOT_USERNAME = 'igra2026_bot';
const APP_SHORT_NAME = 'game';

const bot = new TelegramBot(TOKEN, { polling: { interval: 300, autoStart: true, params: { timeout: 10 } } });

bot.on('polling_error', (err) => {
  if (err.code === 'ETELEGRAM' && err.message.includes('409')) console.log('⚠️ 409 Conflict');
  else console.log('Polling error:', err.message);
});

function isAdmin(userId) { return String(userId) === String(ADMIN_ID); }

function buildStatsText(name, p, isRefresh) {
  const title = isRefresh ? '🔄 <b>Обновлено!</b>' : '🎮 <b>Добро пожаловать!</b>';
  return title + '\n\n👤 <b>' + name + '</b>\n━━━━━━━━━━━━━━━━━━\n' +
    '💰 Монет: <b>' + (p.score || 0).toLocaleString('ru') + '</b>\n' +
    '🏆 Уровень: <b>' + (p.playerLevel || 1) + '</b>\n' +
    '👆 Тапов: <b>' + (p.totalTaps || 0).toLocaleString('ru') + '</b>\n' +
    '⚡ Сила тапа: <b>' + (p.tapPower || 1) + '</b>\n' +
    '👥 Друзей: <b>' + (p.refCount || 0) + '</b>\n━━━━━━━━━━━━━━━━━━';
}

function buildKeyboard(userId) {
  const tmeLink = 'https://t.me/' + BOT_USERNAME + '/' + APP_SHORT_NAME + '?startapp=' + userId;
  return { inline_keyboard: [
    [{ text: '🎮 Играть', url: tmeLink }],
    [{ text: '👥 Пригласить друга', url: 'https://t.me/share/url?url=https://t.me/' + BOT_USERNAME + '?start=ref_' + userId + '&text=Играй со мной!' }],
    [{ text: '🔄 Обновить', callback_data: 'refresh_' + userId }]
  ]};
}

function adminPanel() {
  return { inline_keyboard: [
    [{ text: '📊 Статистика', callback_data: 'admin_stats' }],
    [{ text: '👥 Топ-20', callback_data: 'admin_top' }],
    [{ text: '💰 Выдать монеты', callback_data: 'admin_give' }],
    [{ text: '🚫 Забанить', callback_data: 'admin_ban' }],
    [{ text: '✅ Разбанить', callback_data: 'admin_unban' }],
    [{ text: '🎁 Бонус всем', callback_data: 'admin_bonus' }],
    [{ text: '📢 Рассылка', callback_data: 'admin_broadcast' }],
    [{ text: '🎫 Промокоды', callback_data: 'admin_promo' }],
    [{ text: '🗑 Удалить игрока', callback_data: 'admin_delete' }]
  ]};
}

function adminBack() {
  return { inline_keyboard: [[{ text: '⬅️ В панель', callback_data: 'admin_back' }]] };
}

function promoPanel() {
  return { inline_keyboard: [
    [{ text: '➕ Создать промокод', callback_data: 'admin_promo_create' }],
    [{ text: '📋 Список промокодов', callback_data: 'admin_promo_list' }],
    [{ text: '🗑 Удалить промокод', callback_data: 'admin_promo_delete' }],
    [{ text: '⬅️ В панель', callback_data: 'admin_back' }]
  ]};
}

// ============ /start ============
bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  const userId = String(msg.from.id);
  const name = msg.from.first_name || 'Игрок';
  const refMatch = (msg.text || '').match(/ref_(\d+)/);

  try {
    await db.createPlayer(userId, name);
    if (refMatch && refMatch[1] !== userId) {
      const result = await db.addReferral(userId, refMatch[1]);
      if (result.success) {
        try { await bot.sendMessage(refMatch[1], '🎉 У тебя новый реферал! +1 друг'); } catch(e) {}
      }
    }
    const p = await db.getPlayer(userId);
    bot.sendMessage(chatId, buildStatsText(name, p, false), { parse_mode: 'HTML', reply_markup: buildKeyboard(userId) });
  } catch (e) {
    console.log('START ERROR:', e.message);
    bot.sendMessage(chatId, 'Ошибка.');
  }
});

// ============ /admin ============
bot.onText(/\/admin/, (msg) => {
  if (!isAdmin(msg.from.id)) return;
  bot.sendMessage(msg.chat.id, '👑 <b>АДМИН-ПАНЕЛЬ</b>\n\nВыбери действие:', { parse_mode: 'HTML', reply_markup: adminPanel() });
});

// ============ CALLBACKS ============
bot.on('callback_query', async (query) => {
  const data = query.data || '';
  const chatId = query.message.chat.id;
  const msgId = query.message.message_id;
  const fromId = query.from.id;

  // Refresh (для игроков)
  if (data.startsWith('refresh_')) {
    const userId = data.replace('refresh_', '');
    const name = query.from.first_name || 'Игрок';
    try {
      const p = await db.getPlayer(userId);
      if (!p) return bot.answerCallbackQuery(query.id, { text: '❌ Не найден' });
      try {
        await bot.editMessageText(buildStatsText(name, p, true), { chat_id: chatId, message_id: msgId, parse_mode: 'HTML', reply_markup: buildKeyboard(userId) });
        bot.answerCallbackQuery(query.id, { text: '✅ Обновлено!' });
      } catch (editErr) {
        if (editErr.message && editErr.message.includes('message is not modified')) {
          bot.answerCallbackQuery(query.id, { text: '📊 Данные актуальны' });
        } else {
          await bot.sendMessage(chatId, buildStatsText(name, p, true), { parse_mode: 'HTML', reply_markup: buildKeyboard(userId) });
          bot.answerCallbackQuery(query.id, { text: '✅ Обновлено!' });
        }
      }
    } catch (e) { bot.answerCallbackQuery(query.id, { text: '❌ Ошибка' }); }
    return;
  }

  if (!isAdmin(fromId)) return;

  const edit = async (text, kb) => {
    try { await bot.editMessageText(text, { chat_id: chatId, message_id: msgId, parse_mode: 'HTML', reply_markup: kb }); }
    catch (e) { await bot.sendMessage(chatId, text, { parse_mode: 'HTML', reply_markup: kb }); }
  };

  try {
    if (data === 'admin_back') { await edit('👑 <b>АДМИН-ПАНЕЛЬ</b>\n\nВыбери действие:', adminPanel()); bot.answerCallbackQuery(query.id); return; }

    if (data === 'admin_stats') {
      const s = await db.getStats();
      const top = await db.getTop(100);
      let totalTaps = 0; top.forEach(t => totalTaps += (t.totalTaps || 0));
      await edit('📊 <b>СТАТИСТИКА</b>\n\n👥 Игроков: <b>' + (s.players || 0) + '</b>\n💰 Монет: <b>' + (s.totalScore || 0).toLocaleString('ru') + '</b>\n👆 Тапов: <b>' + totalTaps.toLocaleString('ru') + '</b>', adminBack());
      bot.answerCallbackQuery(query.id); return;
    }

    if (data === 'admin_top') {
      const top = await db.getTop(20);
      let text = '👥 <b>ТОП-20</b>\n\n';
      if (!top.length) text += 'Пока никого.';
      top.forEach((p, i) => {
        const m = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : (i + 1) + '.';
        text += m + ' <b>' + (p.name || 'Игрок') + '</b> — ' + (p.totalTaps || 0).toLocaleString('ru') + ' тапов\n<code>' + p.id + '</code>\n';
      });
      await edit(text, adminBack()); bot.answerCallbackQuery(query.id); return;
    }

    if (data === 'admin_give') { await edit('💰 <b>ВЫДАТЬ</b>\n\n<code>/give ID СУММА</code>', adminBack()); bot.answerCallbackQuery(query.id); return; }
    if (data === 'admin_ban') { await edit('🚫 <b>БАН</b>\n\n<code>/ban ID</code>', adminBack()); bot.answerCallbackQuery(query.id); return; }
    if (data === 'admin_unban') { await edit('✅ <b>РАЗБАН</b>\n\n<code>/unban ID</code>', adminBack()); bot.answerCallbackQuery(query.id); return; }
    if (data === 'admin_bonus') { await edit('🎁 <b>БОНУС ВСЕМ</b>\n\n<code>/bonusall СУММА</code>', adminBack()); bot.answerCallbackQuery(query.id); return; }
    if (data === 'admin_broadcast') { await edit('📢 <b>РАССЫЛКА</b>\n\n<code>/broadcast ТЕКСТ</code>', adminBack()); bot.answerCallbackQuery(query.id); return; }
    if (data === 'admin_delete') { await edit('🗑 <b>УДАЛИТЬ</b>\n\n<code>/delete ID</code>', adminBack()); bot.answerCallbackQuery(query.id); return; }

    if (data === 'admin_promo') { await edit('🎫 <b>ПРОМОКОДЫ</b>\n\nВыбери:', promoPanel()); bot.answerCallbackQuery(query.id); return; }

    if (data === 'admin_promo_create') {
      await edit('➕ <b>СОЗДАТЬ ПРОМОКОД</b>\n\nФормат:\n<code>/newpromo КОД СУММА КОЛИЧЕСТВО</code>\n\nПример:\n<code>/newpromo SUMMER 5000 100</code>', adminBack());
      bot.answerCallbackQuery(query.id); return;
    }

    if (data === 'admin_promo_list') {
      const promos = await db.listPromos();
      let text = '📋 <b>ПРОМОКОДЫ</b>\n\n';
      if (!promos.length) text += 'Пока нет промокодов.';
      promos.forEach(p => {
        text += '🎫 <code>' + p.code + '</code>\n💰 ' + p.reward.toLocaleString('ru') + ' · 👥 ' + p.usedCount + '/' + p.maxUses + '\n\n';
      });
      await edit(text, promoPanel()); bot.answerCallbackQuery(query.id); return;
    }

    if (data === 'admin_promo_delete') {
      await edit('🗑 <b>УДАЛИТЬ ПРОМОКОД</b>\n\n<code>/delpromo КОД</code>', promoPanel());
      bot.answerCallbackQuery(query.id); return;
    }

  } catch (e) { console.log('ADMIN ERROR:', e.message); bot.answerCallbackQuery(query.id, { text: '❌ Ошибка' }); }
});

// ============ АДМИН-КОМАНДЫ ============
bot.onText(/\/stats/, async (msg) => { if (!isAdmin(msg.from.id)) return; const s = await db.getStats(); bot.sendMessage(msg.chat.id, '📊 Игроков: ' + (s.players || 0) + '\n💰 Монет: ' + (s.totalScore || 0).toLocaleString('ru')); });
bot.onText(/\/give (\d+) (\d+)/, async (msg, m) => { if (!isAdmin(msg.from.id)) return; await db.giveCoins(m[1], parseInt(m[2])); bot.sendMessage(msg.chat.id, '✅ Выдано ' + parseInt(m[2]).toLocaleString('ru') + ' игроку <code>' + m[1] + '</code>', { parse_mode: 'HTML' }); });
bot.onText(/\/ban (\d+)/, async (msg, m) => { if (!isAdmin(msg.from.id)) return; await db.banPlayer(m[1], true); bot.sendMessage(msg.chat.id, '🚫 Забанен <code>' + m[1] + '</code>', { parse_mode: 'HTML' }); });
bot.onText(/\/unban (\d+)/, async (msg, m) => { if (!isAdmin(msg.from.id)) return; await db.banPlayer(m[1], false); bot.sendMessage(msg.chat.id, '✅ Разбанен <code>' + m[1] + '</code>', { parse_mode: 'HTML' }); });
bot.onText(/\/delete (\d+)/, async (msg, m) => { if (!isAdmin(msg.from.id)) return; await db.deletePlayer(m[1]); bot.sendMessage(msg.chat.id, '🗑 Удалён <code>' + m[1] + '</code>', { parse_mode: 'HTML' }); });

bot.onText(/\/broadcast (.+)/, async (msg, m) => {
  if (!isAdmin(msg.from.id)) return;
  const players = await db.getAllPlayers();
  let sent = 0, failed = 0;
  for (const p of players) { try { await bot.sendMessage(p.id, '📢 <b>Сообщение:</b>\n\n' + m[1], { parse_mode: 'HTML' }); sent++; } catch(e) { failed++; } }
  bot.sendMessage(msg.chat.id, '✅ Отправлено: ' + sent + '\n❌ Ошибок: ' + failed);
});

bot.onText(/\/bonusall (\d+)/, async (msg, m) => {
  if (!isAdmin(msg.from.id)) return;
  const amount = parseInt(m[1]);
  const players = await db.getAllPlayers();
  let sent = 0;
  for (const p of players) { try { await db.giveCoins(p.id, amount); sent++; } catch(e) {} }
  bot.sendMessage(msg.chat.id, '🎁 Выдано ' + amount.toLocaleString('ru') + ' монет ' + sent + ' игрокам');
});

bot.onText(/\/newpromo (\S+) (\d+) (\d+)/, async (msg, m) => {
  if (!isAdmin(msg.from.id)) return;
  const code = m[1].toUpperCase();
  const reward = parseInt(m[2]);
  const maxUses = parseInt(m[3]);
  const result = await db.createPromo(code, reward, maxUses);
  if (result.success) bot.sendMessage(msg.chat.id, '✅ Промокод <code>' + code + '</code> создан!\n💰 ' + reward.toLocaleString('ru') + ' монет\n👥 Лимит: ' + maxUses, { parse_mode: 'HTML' });
  else bot.sendMessage(msg.chat.id, '❌ Ошибка: ' + result.error);
});

bot.onText(/\/delpromo (\S+)/, async (msg, m) => {
  if (!isAdmin(msg.from.id)) return;
  await db.deletePromo(m[1].toUpperCase());
  bot.sendMessage(msg.chat.id, '🗑 Промокод <code>' + m[1].toUpperCase() + '</code> удалён', { parse_mode: 'HTML' });
});

bot.getMe().then((me) => console.log('✅ Бот: ' + me.username)).catch((e) => console.log('❌ Ошибка:', e.message));
console.log('🤖 Бот запущен');
