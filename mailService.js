// mailService.js
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');

const MAIL_API = 'https://api.mail.tm';

async function createTempEmailAccount() {
  const password = uuidv4(); // rastgele güçlü bir şifre

  // 1. E-posta adresi oluştur
  const domainRes = await axios.get(`${MAIL_API}/domains`);
  const domain = domainRes.data['hydra:member'][0].domain;

  const address = `${uuidv4().slice(0, 8)}@${domain}`;

  // 2. Hesap oluştur
  await axios.post(`${MAIL_API}/accounts`, {
    address,
    password
  });

  // 3. Token al
  const tokenRes = await axios.post(`${MAIL_API}/token`, {
    address,
    password
  });

  const token = tokenRes.data.token;

  return { address, password, token };
}

async function getVerificationCode(token) {
  try {
    const headers = {
      Authorization: `Bearer ${token}`
    };

    // Belirli bir süre boyunca gelen maili bekle (polling)
    for (let i = 0; i < 30; i++) {
      const res = await axios.get(`${MAIL_API}/messages`, { headers });

      const messages = res.data['hydra:member'];
      if (messages.length > 0) {
        const messageId = messages[0].id;

        const messageRes = await axios.get(`${MAIL_API}/messages/${messageId}`, { headers });
        const message = messageRes.data;

        const codeMatch = message.text.match(/(\d{6})/);
        if (codeMatch) return codeMatch[1];
      }

      await new Promise((resolve) => setTimeout(resolve, 2000)); // 2 saniye bekle
    }

    return null; // zaman aşımı
  } catch (err) {
    console.error('Doğrulama kodu alınamadı:', err.message);
    return null;
  }
}

module.exports = {
  createTempEmailAccount,
  getVerificationCode
}; 