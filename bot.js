const TelegramBot = require('node-telegram-bot-api');
const db = require('./database');

const TOKEN = process.env.BOT_TOKEN || '8946713588:AAEH-WudfsfMVCL2CPZLNXetrSmf_jBPTbI';
const ADMIN_ID = process.env.ADMIN_ID || '1209267677';
const BOT_USERNAME = 'igra2026_bot';
const APP_SHORT_NAME = 'game';

const STARS_PACKS = {
  support_15: { stars: 15, item: 'support', label: '☕ Поддержать · 15 ⭐', coins: 0, boost: null },
  pack_start: { stars: 19, item: 'autoclicker24', label: '🤖 Автокликер 24ч · 19 ⭐', coins: 0, boost: { type: 'autoclick', duration: 24 * 60 * 60 * 1000 } },
  pack_small: { stars: 49, item: 'small', label: '💎 Малый пак · 49 ⭐', coins: 25000, boost: null },
  pack_medium: { stars: 99, item: 'medium', label: '💎 Средний пак · 99 ⭐', coins: 75000, boost: null },
  pack_large: { stars: 199, item: 'large', label: '💎 Большой пак · 199 ⭐', coins: 200000, boost: null },
  pack_mega: { stars: 499, item: 'mega', label: '💎 МЕГА-ПАК · 499 ⭐', coins: 700000, boost: { type: 'autoclick', duration: 7 * 24 * 60 * 60 * 1000 } }
};

const bot = new TelegramBot(TOKEN, { polling: { interval: 300, autoStart: true, params: { timeout: 10 } } });

bot.on('polling_error', (err) => {
  if (err.code === 'ETELEGRAM' && err.message.includes('409')) console.log('⚠️ 409 Conflict');
  else console.log('Polling error:', err.message);
});

function isOwner(userId) { return String(userId) === String(ADMIN_ID); }
async function isAdmin(userId) {
  if (isOwner(userId)) return true;
  return await db.isAdminInDB(String(userId));
}

function fmt(n) { return (n || 0).toLocaleString('ru'); }

// ============ КРАСИВОЕ ПРИВЕТСТВИЕ ============
function buildWelcome(name, p) {
  return `✨ <b>Добро пожаловать, ${name}!</b>\n\n` +
    `🎮 <b>Моя Игра</b> — тапай, качайся, соревнуйся!\n\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `💰 Монет: <b>${fmt(p.score)}</b>\n` +
    `🏆 Уровень: <b>${p.playerLevel || 1}</b>\n` +
    `⚡ Сила тапа: <b>${p.tapPower || 1}</b>\n` +
    `👆 Тапов: <b>${fmt(p.totalTaps)}</b>\n` +
    `👥 Друзей: <b>${p.refCount || 0}</b>\n` +
    `━━━━━━━━━━━━━━━━━━━━\n\n` +
    `🚀 Нажми <b>«Играть»</b> чтобы начать!`;
}

function buildRefreshText(name, p) {
  return `🔄 <b>Обновлено!</b>\n\n` +
    `👤 ${name}\n\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `💰 Монет: <b>${fmt(p.score)}</b>\n` +
    `🏆 Уровень: <b>${p.playerLevel || 1}</b>\n` +
    `⚡ Сила тапа: <b>${p.tapPower || 1}</b>\n` +
    `👆 Тапов: <b>${fmt(p.totalTaps)}</b>\n` +
    `👥 Друзей: <b>${p.refCount || 0}</b>\n` +
    `━━━━━━━━━━━━━━━━━━━━`;
}

function mainKeyboard(userId) {
  const tmeLink = 'https://t.me/' + BOT_USERNAME + '/' + APP_SHORT_NAME + '?startapp=' + userId;
  return { inline_keyboard: [
    [{ text: '🎮 Играть', url: tmeLink }],
    [{ text: '💎 Магазин', callback_data: 'shop_' + userId }, { text: '🏆 Топ', callback_data: 'top_' + userId }],
    [{ text: '👥 Пригласить друга', url: 'https://t.me/share/url?url=https://t.me/' + BOT_USERNAME + '?start=ref_' + userId + '&text=Играй со мной!' }],
    [{ text: '🔄 Обновить', callback_data: 'refresh_' + userId }]
  ]};
}

function shopKeyboard() {
  return { inline_keyboard: [
    [{ text: '☕ Поддержать · 15 ⭐', callback_data: 'buy_support_15' }],
    [{ text: '🤖 Автокликер 24ч · 19 ⭐', callback_data: 'buy_pack_start' }],
    [{ text: '💎 Малый · 49 ⭐', callback_data: 'buy_pack_small' }],
    [{ text: '💎 Средний · 99 ⭐', callback_data: 'buy_pack_medium' }],
    [{ text: '💎 Большой · 199 ⭐', callback_data: 'buy_pack_large' }],
    [{ text: '👑 МЕГА · 499 ⭐', callback_data: 'buy_pack_mega' }]
  ]};
}

// ============ АДМИНКА ============
function adminPanel() {
  return { inline_keyboard: [
    [{ text: '📊 Статистика', callback_data: 'admin_stats' }, { text: '👥 Топ-20', callback_data: 'admin_top' }],
    [{ text: '💰 Выдать монеты', callback_data: 'admin_give' }, { text: '🎁 Бонус всем', callback_data: 'admin_bonus' }],
    [{ text: '🚫 Забанить', callback_data: 'admin_ban' }, { text: '✅ Разбанить', callback_data: 'admin_unban' }],
    [{ text: '🎫 Промокоды', callback_data: 'admin_promo' }, { text: '💎 Донаты', callback_data: 'admin_donates' }],
    [{ text: '👑 Админы', callback_data: 'admin_admins' }, { text: '📢 Рассылка', callback_data: 'admin_broadcast' }],
    [{ text: '🔍 Найти игрока', callback_data: 'admin_find' }, { text: '🗑 Удалить', callback_data: 'admin_delete' }]
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

function adminsPanel() {
  return { inline_keyboard: [
    [{ text: '➕ Добавить админа', callback_data: 'admin_addadmin' }],
    [{ text: '📋 Список админов', callback_data: 'admin_listadmins' }],
    [{ text: '🗑 Удалить админа', callback_data: 'admin_deladmin' }],
    [{ text: '⬅️ В панель', callback_data: 'admin_back' }]
  ]};
}

// ============ /start ============
bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  const userId = String(msg.from.id);
  const name = msg.from.first_name || 'Игрок';
  const text = msg.text || '';
  const refMatch = text.match(/ref_(\d+)/);
  const buyMatch = text.match(/buy_(\S+)/);

  try {
    await db.createPlayer(userId, name);

    if (refMatch && refMatch[1] !== userId) {
      const result = await db.addReferral(userId, refMatch[1]);
      if (result.success) {
        try { await bot.sendMessage(refMatch[1], '🎉 У тебя новый реферал! +1 друг'); } catch(e) {}
      }
    }

    const p = await db.getPlayer(userId);

    if (buyMatch) {
      const key = buyMatch[1];
      const sent = await sendStarsInvoice(chatId, userId, key);
      if (sent) return;
    }

    bot.sendMessage(chatId, buildWelcome(name, p), { parse_mode: 'HTML', reply_markup: mainKeyboard(userId) });
  } catch (e) {
    console.log('START ERROR:', e.message);
    bot.sendMessage(chatId, '❌ Ошибка.');
  }
});

// ============ /admin ============
bot.onText(/\/admin/, async (msg) => {
  if (!await isAdmin(msg.from.id)) return;
  bot.sendMessage(msg.chat.id, '👑 <b>АДМИН-ПАНЕЛЬ</b>\n\nВыбери действие:', { parse_mode: 'HTML', reply_markup: adminPanel() });
});

// ============ /buy ============
bot.onText(/\/buy/, async (msg) => {
  const userId = String(msg.from.id);
  await bot.sendMessage(msg.chat.id, '💎 <b>МАГАЗИН</b>\n\nВыбери пакет:', { parse_mode: 'HTML', reply_markup: shopKeyboard() });
});

// ============ INVOICE ============
async function sendStarsInvoice(chatId, userId, key) {
  const pack = STARS_PACKS[key];
  if (!pack) return false;
  try {
    await bot.sendInvoice(
      chatId,
      pack.label,
      'Нажми "Оплатить" чтобы купить за ' + pack.stars + ' ⭐',
      JSON.stringify({ userId, key }),
      '',
      'XTR',
      [{ label: pack.label, amount: pack.stars }]
    );
    return true;
  } catch (e) {
    console.log('INVOICE ERROR:', e.message);
    return false;
  }
}

// ============ CALLBACKS ============
bot.on('callback_query', async (query) => {
  const data = query.data || '';
  const chatId = query.message.chat.id;
  const msgId = query.message.message_id;
  const fromId = query.from.id;
  const userId = String(fromId);
  const name = query.from.first_name || 'Игрок';

  // REFRESH
  if (data.startsWith('refresh_')) {
    try {
      const p = await db.getPlayer(data.replace('refresh_', ''));
      if (!p) return bot.answerCallbackQuery(query.id, { text: '❌ Не найден' });
      try {
        await bot.editMessageText(buildRefreshText(name, p), { chat_id: chatId, message_id: msgId, parse_mode: 'HTML', reply_markup: mainKeyboard(userId) });
        bot.answerCallbackQuery(query.id, { text: '✅ Обновлено!' });
      } catch (e) {
        if (e.message && e.message.includes('not modified')) bot.answerCallbackQuery(query.id, { text: '📊 Актуально' });
        else await bot.sendMessage(chatId, buildRefreshText(name, p), { parse_mode: 'HTML', reply_markup: mainKeyboard(userId) });
      }
    } catch (e) { bot.answerCallbackQuery(query.id, { text: '❌ Ошибка' }); }
    return;
  }

  // SHOP
  if (data.startsWith('shop_')) {
    try { await bot.editMessageText('💎 <b>МАГАЗИН</b>\n\nВыбери пакет:', { chat_id: chatId, message_id: msgId, parse_mode: 'HTML', reply_markup: shopKeyboard() }); }
    catch (e) { await bot.sendMessage(chatId, '💎 <b>МАГАЗИН</b>', { parse_mode: 'HTML', reply_markup: shopKeyboard() }); }
    bot.answerCallbackQuery(query.id);
    return;
  }

  // TOP (для юзеров)
  if (data.startsWith('top_')) {
    bot.answerCallbackQuery(query.id);
    const top = await db.getTop(10);
    let text = '🏆 <b>ТОП-10</b>\n\n';
    top.forEach((p, i) => {
      const m = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : (i + 1) + '.';
      text += m + ' <b>' + (p.name || 'Игрок') + '</b> — ' + fmt(p.totalTaps) + '\n';
    });
    bot.sendMessage(chatId, text, { parse_mode: 'HTML' });
    return;
  }

  // BUY
  if (data.startsWith('buy_')) {
    const key = data.replace('buy_', '');
    bot.answerCallbackQuery(query.id);
    await sendStarsInvoice(chatId, userId, key);
    return;
  }

  // === АДМИНКА ===
  if (!await isAdmin(fromId)) return;

  const edit = async (text, kb) => {
    try { await bot.editMessageText(text, { chat_id: chatId, message_id: msgId, parse_mode: 'HTML', reply_markup: kb }); }
    catch (e) { await bot.sendMessage(chatId, text, { parse_mode: 'HTML', reply_markup: kb }); }
  };

  try {
    if (data === 'admin_back') { await edit('👑 <b>АДМИН-ПАНЕЛЬ</b>\n\nВыбери действие:', adminPanel()); bot.answerCallbackQuery(query.id); return; }

    if (data === 'admin_stats') {
      const s = await db.getStats();
      const top = await db.getTop(1000);
      let totalTaps = 0; top.forEach(t => totalTaps += (t.totalTaps || 0));
      await edit('📊 <b>СТАТИСТИКА</b>\n\n👥 Игроков: <b>' + (s.players || 0) + '</b>\n💰 Монет: <b>' + fmt(s.totalScore) + '</b>\n👆 Тапов: <b>' + fmt(totalTaps) + '</b>', adminBack());
      bot.answerCallbackQuery(query.id); return;
    }

    if (data === 'admin_top') {
      const top = await db.getTop(20);
      let text = '👥 <b>ТОП-20</b>\n\n';
      top.forEach((p, i) => {
        const m = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : (i + 1) + '.';
        text += m + ' <b>' + (p.name || 'Игрок') + '</b> — ' + fmt(p.totalTaps) + '\n<code>' + p.id + '</code>\n';
      });
      await edit(text, adminBack()); bot.answerCallbackQuery(query.id); return;
    }

    if (data === 'admin_give') { await edit('💰 <b>ВЫДАТЬ МОНЕТЫ</b>\n\n<code>/give ID СУММА</code>\n\nПример: <code>/give 1209267677 10000</code>', adminBack()); bot.answerCallbackQuery(query.id); return; }
    if (data === 'admin_bonus') { await edit('🎁 <b>БОНУС ВСЕМ</b>\n\n<code>/bonusall СУММА</code>\n\nПример: <code>/bonusall 1000</code>', adminBack()); bot.answerCallbackQuery(query.id); return; }
    if (data === 'admin_ban') { await edit('🚫 <b>ЗАБАНИТЬ</b>\n\n<code>/ban ID</code>', adminBack()); bot.answerCallbackQuery(query.id); return; }
    if (data === 'admin_unban') { await edit('✅ <b>РАЗБАНИТЬ</b>\n\n<code>/unban ID</code>', adminBack()); bot.answerCallbackQuery(query.id); return; }
    if (data === 'admin_delete') { await edit('🗑 <b>УДАЛИТЬ ИГРОКА</b>\n\n<code>/delete ID</code>\n\n⚠️ Необратимо!', adminBack()); bot.answerCallbackQuery(query.id); return; }
    if (data === 'admin_broadcast') { await edit('📢 <b>РАССЫЛКА</b>\n\n<code>/broadcast ТЕКСТ</code>', adminBack()); bot.answerCallbackQuery(query.id); return; }
    if (data === 'admin_find') { await edit('🔍 <b>НАЙТИ ИГРОКА</b>\n\n<code>/find ID</code>', adminBack()); bot.answerCallbackQuery(query.id); return; }
    if (data === 'admin_donates') { await edit('💎 <b>ДОНАТЫ</b>\n\n⭐ Stars активируются автоматически.\nБаланс: @BotFather → Payments', adminBack()); bot.answerCallbackQuery(query.id); return; }

    if (data === 'admin_promo') { await edit('🎫 <b>ПРОМОКОДЫ</b>', promoPanel()); bot.answerCallbackQuery(query.id); return; }
    if (data === 'admin_promo_create') { await edit('➕ <b>СОЗДАТЬ</b>\n\n<code>/newpromo КОД СУММА ЛИМИТ</code>\n\nПример: <code>/newpromo SUMMER 5000 100</code>', promoPanel()); bot.answerCallbackQuery(query.id); return; }
    if (data === 'admin_promo_list') {
      const promos = await db.listPromos();
      let text = '📋 <b>ПРОМОКОДЫ</b>\n\n';
      if (!promos.length) text += 'Пусто.';
      promos.forEach(p => { text += '🎫 <code>' + p.code + '</code>\n💰 ' + fmt(p.reward) + ' · 👥 ' + p.usedCount + '/' + p.maxUses + '\n\n'; });
      await edit(text, promoPanel()); bot.answerCallbackQuery(query.id); return;
    }
    if (data === 'admin_promo_delete') { await edit('🗑 <b>УДАЛИТЬ</b>\n\n<code>/delpromo КОД</code>', promoPanel()); bot.answerCallbackQuery(query.id); return; }

    if (data === 'admin_admins') { await edit('👑 <b>АДМИНЫ</b>\n\nУправление:', adminsPanel()); bot.answerCallbackQuery(query.id); return; }
    if (data === 'admin_addadmin') { if (!isOwner(fromId)) return bot.answerCallbackQuery(query.id, { text: '❌ Только владелец' }); await edit('➕ <b>ДОБАВИТЬ АДМИНА</b>\n\n<code>/addadmin ID</code>', adminsPanel()); bot.answerCallbackQuery(query.id); return; }
    if (data === 'admin_deladmin') { if (!isOwner(fromId)) return bot.answerCallbackQuery(query.id, { text: '❌ Только владелец' }); await edit('🗑 <b>УДАЛИТЬ АДМИНА</b>\n\n<code>/removeadmin ID</code>', adminsPanel()); bot.answerCallbackQuery(query.id); return; }
    if (data === 'admin_listadmins') {
      const list = await db.listAdmins();
      let text = '👑 <b>АДМИНЫ</b>\n\n🔱 Владелец: <code>' + ADMIN_ID + '</code>\n\n';
      if (!list.length) text += 'Больше никого.';
      else list.forEach((a, i) => { text += (i + 1) + '. <code>' + a.user_id + '</code>\n'; });
      await edit(text, adminsPanel()); bot.answerCallbackQuery(query.id); return;
    }

  } catch (e) { console.log('ADMIN ERROR:', e.message); bot.answerCallbackQuery(query.id, { text: '❌ Ошибка' }); }
});

// ============ ПЛАТЕЖ ============
bot.on('pre_checkout_query', (query) => {
  bot.answerPreCheckoutQuery(query.id, true);
});

bot.on('successful_payment', async (msg) => {
  const userId = String(msg.from.id);
  const payment = msg.successful_payment;
  let payload = {};
  try { payload = JSON.parse(payment.invoice_payload || '{}'); } catch(e) {}
  const key = payload.key;
  const pack = STARS_PACKS[key];

  console.log('💎 PAYMENT:', userId, 'stars:', payment.total_amount, 'key:', key);

  try {
    const already = await db.hasPayment(payment.telegram_payment_charge_id);
    if (already) { console.log('⚠️ Already processed'); return; }

    await db.addPayment(userId, payment.total_amount, key || 'unknown', payment.telegram_payment_charge_id);
    if (!pack) { bot.sendMessage(msg.chat.id, '✅ Оплата получена!'); return; }

    if (pack.coins && pack.coins > 0) await db.giveCoins(userId, pack.coins);
    if (pack.boost) await db.addBoost(userId, pack.boost.type, pack.boost.duration);

    let text = '✅ <b>Оплата получена!</b>\n\n⭐ Stars: <b>' + payment.total_amount + '</b>\n\n';
    if (pack.coins) text += '💰 +' + fmt(pack.coins) + ' монет\n';
    if (pack.boost) {
      const hours = pack.boost.duration / 3600000;
      text += '⚡ Буст на <b>' + hours + ' ч</b>\n';
      if (pack.boost.type === 'autoclick') text += '  🤖 Автокликер: +1 монета / 5 сек\n';
    }
    if (key === 'support_15') text += '❤️ Спасибо за поддержку!\n';

    bot.sendMessage(msg.chat.id, text, { parse_mode: 'HTML' });
  } catch (e) {
    console.log('PAYMENT ERROR:', e.message);
    bot.sendMessage(msg.chat.id, '❌ Ошибка.');
  }
});

// ============ АДМИН-КОМАНДЫ ============
bot.onText(/\/stats/, async (msg) => { if (!await isAdmin(msg.from.id)) return; const s = await db.getStats(); bot.sendMessage(msg.chat.id, '📊 Игроков: ' + (s.players || 0) + '\n💰 Монет: ' + fmt(s.totalScore)); });
bot.onText(/\/give (\d+) (\d+)/, async (msg, m) => { if (!await isAdmin(msg.from.id)) return; await db.giveCoins(m[1], parseInt(m[2])); bot.sendMessage(msg.chat.id, '✅ Выдано ' + fmt(parseInt(m[2])) + ' игроку <code>' + m[1] + '</code>', { parse_mode: 'HTML' }); });
bot.onText(/\/ban (\d+)/, async (msg, m) => { if (!await isAdmin(msg.from.id)) return; await db.banPlayer(m[1], true); bot.sendMessage(msg.chat.id, '🚫 Забанен <code>' + m[1] + '</code>', { parse_mode: 'HTML' }); });
bot.onText(/\/unban (\d+)/, async (msg, m) => { if (!await isAdmin(msg.from.id)) return; await db.banPlayer(m[1], false); bot.sendMessage(msg.chat.id, '✅ Разбанен <code>' + m[1] + '</code>', { parse_mode: 'HTML' }); });
bot.onText(/\/delete (\d+)/, async (msg, m) => { if (!await isAdmin(msg.from.id)) return; await db.deletePlayer(m[1]); bot.sendMessage(msg.chat.id, '🗑 Удалён <code>' + m[1] + '</code>', { parse_mode: 'HTML' }); });
bot.onText(/\/find (\d+)/, async (msg, m) => {
  if (!await isAdmin(msg.from.id)) return;
  const p = await db.getPlayer(m[1]);
  if (!p) return bot.sendMessage(msg.chat.id, '❌ Не найден');
  bot.sendMessage(msg.chat.id, `👤 <b>${p.name}</b>\n🆔 <code>${p.id}</code>\n💰 ${fmt(p.score)}\n🏆 Ур. ${p.playerLevel}\n👆 ${fmt(p.totalTaps)}`, { parse_mode: 'HTML' });
});

bot.onText(/\/broadcast (.+)/, async (msg, m) => {
  if (!await isAdmin(msg.from.id)) return;
  const players = await db.getAllPlayers();
  let sent = 0, failed = 0;
  for (const p of players) { try { await bot.sendMessage(p.id, '📢 <b>Сообщение:</b>\n\n' + m[1], { parse_mode: 'HTML' }); sent++; } catch(e) { failed++; } }
  bot.sendMessage(msg.chat.id, '✅ Отправлено: ' + sent + '\n❌ Ошибок: ' + failed);
});

bot.onText(/\/bonusall (\d+)/, async (msg, m) => {
  if (!await isAdmin(msg.from.id)) return;
  const amount = parseInt(m[1]);
  const players = await db.getAllPlayers();
  let sent = 0;
  for (const p of players) { try { await db.giveCoins(p.id, amount); sent++; } catch(e) {} }
  bot.sendMessage(msg.chat.id, '🎁 Выдано ' + fmt(amount) + ' монет ' + sent + ' игрокам');
});

bot.onText(/\/newpromo (\S+) (\d+) (\d+)/, async (msg, m) => {
  if (!await isAdmin(msg.from.id)) return;
  const code = m[1].toUpperCase();
  const result = await db.createPromo(code, parseInt(m[2]), parseInt(m[3]));
  if (result.success) bot.sendMessage(msg.chat.id, '✅ Промокод <code>' + code + '</code> создан!', { parse_mode: 'HTML' });
  else bot.sendMessage(msg.chat.id, '❌ Ошибка: ' + result.error);
});

bot.onText(/\/delpromo (\S+)/, async (msg, m) => {
  if (!await isAdmin(msg.from.id)) return;
  await db.deletePromo(m[1].toUpperCase());
  bot.sendMessage(msg.chat.id, '🗑 Удалён <code>' + m[1].toUpperCase() + '</code>', { parse_mode: 'HTML' });
});

// АДМИНЫ
bot.onText(/\/addadmin (\d+)/, async (msg, m) => {
  if (!isOwner(msg.from.id)) return bot.sendMessage(msg.chat.id, '❌ Только владелец');
  const targetId = m[1];
  if (String(targetId) === String(ADMIN_ID)) return bot.sendMessage(msg.chat.id, '❌ Это владелец');
  const result = await db.addAdmin(targetId, String(msg.from.id));
  if (result.success) {
    bot.sendMessage(msg.chat.id, '✅ <code>' + targetId + '</code> теперь админ!\n\nОн должен написать <code>/admin</code>', { parse_mode: 'HTML' });
    try { await bot.sendMessage(targetId, '👑 Тебя назначили админом!\nНапиши /admin'); } catch(e) {}
  } else bot.sendMessage(msg.chat.id, '❌ Ошибка: ' + result.error);
});

bot.onText(/\/removeadmin (\d+)/, async (msg, m) => {
  if (!isOwner(msg.from.id)) return bot.sendMessage(msg.chat.id, '❌ Только владелец');
  const targetId = m[1];
  if (String(targetId) === String(ADMIN_ID)) return bot.sendMessage(msg.chat.id, '❌ Нельзя удалить владельца');
  await db.removeAdmin(targetId);
  bot.sendMessage(msg.chat.id, '✅ <code>' + targetId + '</code> больше не админ', { parse_mode: 'HTML' });
});

bot.onText(/\/admins/, async (msg) => {
  if (!await isAdmin(msg.from.id)) return;
  const list = await db.listAdmins();
  let text = '👑 <b>АДМИНЫ</b>\n\n🔱 Владелец: <code>' + ADMIN_ID + '</code>\n\n';
  if (!list.length) text += 'Больше никого.';
  else list.forEach((a, i) => { text += (i + 1) + '. <code>' + a.user_id + '</code>\n'; });
  bot.sendMessage(msg.chat.id, text, { parse_mode: 'HTML' });
});

bot.getMe().then((me) => console.log('✅ Бот: ' + me.username)).catch((e) => console.log('❌ Ошибка:', e.message));
console.log('🤖 Бот запущен');
