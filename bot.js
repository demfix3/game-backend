const TelegramBot = require('node-telegram-bot-api');
const db = require('./database');

const TOKEN = '8946713588:AAFBiC0BP2HU7a9iS-4laj6SR7xjutcOexI';
const ADMIN_ID = '1209267677';
const WEBAPP_URL = 'https://demfix3.github.io/game/';

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
    await db.addReferral(userId, refMatch[1]);
    try { await bot.sendMessage(refMatch[1], 'Новый реферал!'); } catch(e) {}
  }

  const p = await db.getPlayer(userId);
  bot.sendMessage(chatId, 'Привет, ' + name + '!\n\nМонет: ' + p.score + '\nУровень: ' + p.playerLevel + '\nДрузей: ' + p.refCount, {
    reply_markup: {
      inline_keyboard: [[{ text: 'Играть', web_app: { url: WEBAPP_URL } }]]
    }
  });
});

bot.onText(/\/admin/, async (msg) => {
  if (!isAdmin(msg.from.id)) return;
  bot.sendMessage(msg.chat.id, 'АДМИН\n/stats\n/give ID СУММА\n/broadcast ТЕКСТ');
});

bot.onText(/\/stats/, async (msg) => {
  if (!isAdmin(msg.from.id)) return;
  const s = await db.getStats();
  bot.sendMessage(msg.chat.id, 'Игроков: ' + s.players + '\nМонет: ' + (s.totalScore || 0));
});

bot.onText(/\/give (\d+) (\d+)/, async (msg, match) => {
  if (!isAdmin(msg.from.id)) return;
  await db.giveCoins(match[1], parseInt(match[2]));
  bot.sendMessage(msg.chat.id, 'Выдано ' + match[2]);
});

bot.onText(/\/broadcast (.+)/, async (msg, match) => {
  if (!isAdmin(msg.from.id)) return;
  const players = await db.getAllPlayers();
  let sent = 0;
  for (const p of players) {
    try { await bot.sendMessage(p.id, match[1]); sent++; } catch(e) {}
  }
  bot.sendMessage(msg.chat.id, 'Отправлено ' + sent);
});

console.log('Бот запущен');