const TelegramBot = require('node-telegram-bot-api');
const db = require('./database');

const TOKEN = process.env.BOT_TOKEN || '8946713588:AAFBiC0BP2HU7a9iS-4laj6SR7xjutcOexI';
const ADMIN_ID = process.env.ADMIN_ID || '1209267677';
const BOT_USERNAME = 'igra2026_bot';
const APP_SHORT_NAME = 'game';

const bot = new TelegramBot(TOKEN, { 
  polling: {
    interval: 300,
    autoStart: true,
    params: { timeout: 10 }
  }
});

bot.on('polling_error', (err) => {
  if (err.code === 'ETELEGRAM' && err.message.includes('409')) {
    console.log('⚠️ 409 Conflict — другой бот запущен. Игнорирую.');
  } else {
    console.log('Polling error:', err.message);
  }
});

function isAdmin(userId) { return String(userId) === String(ADMIN_ID); }

function buildStatsText(name, p, isRefresh) {
  const title = isRefresh ? '🔄 <b>Обновлено!</b>' : '🎮 <b>Добро пожаловать в игру!</b>';
  return title + '\n\n' +
    '👤 <b>' + name + '</b>\n' +
    '━━━━━━━━━━━━━━━━━━\n' +
    '💰 Монет: <b>' + (p.score || 0).toLocaleString('ru') + '</b>\n' +
    '🏆 Уровень: <b>' + (p.playerLevel || 1) + '</b>\n' +
    '👆 Тапов: <b>' + (p.totalTaps || 0).toLocaleString('ru') + '</b>\n' +
    '⚡ Сила тапа: <b>' + (p.tapPower || 1) + '</b>\n' +
    '👥 Друзей: <b>' + (p.refCount || 0) + '</b>\n' +
    '━━━━━━━━━━━━━━━━━━\n\n' +
    '🚀 Тапай монету, качай уровни, соревнуйся!';
}

function buildKeyboard(userId) {
  const tmeLink = 'https://t.me/' + BOT_USERNAME + '/' + APP_SHORT_NAME + '?startapp=' + userId;
  return {
    inline_keyboard: [
      [{ text: '🎮 Играть', url: tmeLink }],
      [{ text: '👥 Пригласить друга', url: 'https://t.me/share/url?url=https://t.me/' + BOT_USERNAME + '?start=ref_' + userId + '&text=Играй со мной!' }],
      [{ text: '🔄 Обновить', callback_data: 'refresh_' + userId }]
    ]
  };
}

bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  const userId = String(msg.from.id);
  const name = msg.from.first_name || 'Игрок';
  const text = msg.text || '';
  const refMatch = text.match(/ref_(\d+)/);

  try {
    await db.createPlayer(userId, name);

    if (refMatch && refMatch[1] !== userId) {
      const result = await db.addReferral(userId, refMatch[1]);
      if (result.success) {
        try { await bot.sendMessage(refMatch[1], '🎉 У тебя новый реферал! +1 друг'); } catch(e) {}
      } else {
        console.log('REF NOT ADDED:', result.reason);
      }
    }

    const p = await db.getPlayer(userId);

    bot.sendMessage(chatId, buildStatsText(name, p, false), {
      parse_mode: 'HTML',
      reply_markup: buildKeyboard(userId)
    });
  } catch (e) {
    console.log('START ERROR:', e.message);
    bot.sendMessage(chatId, 'Ошибка. Попробуй ещё раз.');
  }
});

// Кнопка "Обновить"
bot.on('callback_query', async (query) => {
  if (!query.data || !query.data.startsWith('refresh_')) return;

  const userId = query.data.replace('refresh_', '');
  const name = query.from.first_name || 'Игрок';

  try {
    const p = await db.getPlayer(userId);
    if (!p) {
      bot.answerCallbackQuery(query.id, { text: '❌ Игрок не найден' });
      return;
    }

    await bot.editMessageText(buildStatsText(name, p, true), {
      chat_id: query.message.chat.id,
      message_id: query.message.message_id,
      parse_mode: 'HTML',
      reply_markup: buildKeyboard(userId)
    });

    bot.answerCallbackQuery(query.id, { text: '✅ Обновлено!' });
  } catch (e) {
    console.log('REFRESH ERROR:', e.message);
    bot.answerCallbackQuery(query.id, { text: '❌ Ошибка обновления' });
  }
});

bot.onText(/\/admin/, (msg) => {
  if (!isAdmin(msg.from.id)) return;
  bot.sendMessage(msg.chat.id, '👑 АДМИН\n/stats — статистика\n/give ID СУММА — выдать\n/broadcast ТЕКСТ — рассылка');
});

bot.onText(/\/stats/, async (msg) => {
  if (!isAdmin(msg.from.id)) return;
  const s = await db.getStats();
  bot.sendMessage(msg.chat.id, '📊 Игроков: ' + s.players + '\n💰 Всего монет: ' + (s.totalScore || 0));
});

bot.onText(/\/give (\d+) (\d+)/, async (msg, match) => {
  if (!isAdmin(msg.from.id)) return;
  await db.giveCoins(match[1], parseInt(match[2]));
  bot.sendMessage(msg.chat.id, '✅ Выдано ' + match[2] + ' игроку ' + match[1]);
});

bot.onText(/\/broadcast (.+)/, async (msg, match) => {
  if (!isAdmin(msg.from.id)) return;
  const players = await db.getAllPlayers();
  let sent = 0;
  for (const p of players) {
    try { await bot.sendMessage(p.id, '📢 ' + match[1]); sent++; } catch(e) {}
  }
  bot.sendMessage(msg.chat.id, '✅ Отправлено ' + sent);
});

bot.getMe().then((me) => {
  console.log('✅ Бот подключился:', me.username);
}).catch((e) => console.log('❌ Ошибка бота:', e.message));

console.log('🤖 Бот запущен');
