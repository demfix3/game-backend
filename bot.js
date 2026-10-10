const TelegramBot = require('node-telegram-bot-api');
const db = require('./database');

const TOKEN = process.env.BOT_TOKEN || '8946713588:AAFBiC0BP2HU7a9iS-4laj6SR7xjutcOexI';
const ADMIN_ID = process.env.ADMIN_ID || '1209267677';
const WEBAPP_URL = 'https://demfix3.github.io/game/';
const BOT_USERNAME = 'igra2026_bot';

const bot = new TelegramBot(TOKEN, { polling: true });

function isAdmin(userId) {
  return String(userId) === String(ADMIN_ID);
}

bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  const userId = String(msg.from.id);
  const name = msg.from.first_name || 'Игрок';
  const text = msg.text || '';
  const refMatch = text.match(/ref_(\d+)/);

  await db.createPlayer(userId);

  if (refMatch && refMatch[1] !== userId) {
    const refId = refMatch[1];
    await db.addReferral(userId, refId);
    try {
      await bot.sendMessage(refId, '🎉 У тебя новый реферал! +1 друг');
    } catch(e) {}
  }

  const p = await db.getPlayer(userId);

  bot.sendMessage(chatId, `👋 Привет, ${name}!\n\n🎮 Добро пожаловать в игру!\n\nТапай монету, качай уровни, соревнуйся с друзьями!\n\n💰 Баланс: ${p.score} монет\n🏆 Уровень: ${p.playerLevel}\n👥 Приглашено: ${p.refCount}`, {
    reply_markup: {
      inline_keyboard: [
        [{ text: '🎮 Играть', web_app: { url: WEBAPP_URL } }],
        [{ text: '👥 Пригласить друга', url: `https://t.me/share/url?url=https://t.me/${BOT_USERNAME}?start=ref_${userId}&text=Играй со мной!` }]
      ]
    }
  });
});

bot.onText(/\/admin/, (msg) => {
  if (!isAdmin(msg.from.id)) return;
  bot.sendMessage(msg.chat.id, `👑 АДМИН-ПАНЕЛЬ\n\nКоманды:\n/stats — статистика\n/give ID СУММА — выдать монеты\n/ban ID — забанить\n/unban ID — разбанить\n/broadcast ТЕКСТ — рассылка`);
});

bot.onText(/\/stats/, async (msg) => {
  if (!isAdmin(msg.from.id)) return;
  const s = await db.getStats();
  bot.sendMessage(msg.chat.id, `📊 СТАТИСТИКА\n\n👥 Игроков: ${s.players}\n💰 Всего монет: ${(s.totalScore || 0).toLocaleString('ru')}\n👆 Всего тапов: ${(s.totalTaps || 0).toLocaleString('ru')}`);
});

bot.onText(/\/give (\d+) (\d+)/, async (msg, match) => {
  if (!isAdmin(msg.from.id)) return;
  await db.giveCoins(match[1], parseInt(match[2]));
  bot.sendMessage(msg.chat.id, `✅ Выдано ${match[2]} монет игроку ${match[1]}`);
});

bot.onText(/\/ban (\d+)/, async (msg, match) => {
  if (!isAdmin(msg.from.id)) return;
  await db.banPlayer(match[1], true);
  bot.sendMessage(msg.chat.id, `🚫 Игрок ${match[1]} забанен`);
});

bot.onText(/\/unban (\d+)/, async (msg, match) => {
  if (!isAdmin(msg.from.id)) return;
  await db.banPlayer(match[1], false);
  bot.sendMessage(msg.chat.id, `✅ Игрок ${match[1]} разбанен`);
});

bot.onText(/\/broadcast (.+)/, async (msg, match) => {
  if (!isAdmin(msg.from.id)) return;
  const text = match[1];
  const players = await db.getAllPlayers();
  let sent = 0;
  for (const p of players) {
    try {
      await bot.sendMessage(p.id, `📢 ${text}`);
      sent++;
    } catch(e) {}
  }
  bot.sendMessage(msg.chat.id, `✅ Отправлено ${sent} игрокам`);
});

console.log('🤖 Бот запущен');
