// src/services/pagarmeClient.js
const axios = require('axios');

function buildBasicAuth(secretKey) {
  // user: secretKey / password: vazio => "sk_test_xxx:"
  return 'Basic ' + Buffer.from(`${secretKey}:`).toString('base64');
}

function createPagarmeClient() {
  const secretKey = process.env.PAGARME_SECRET_KEY;
  if (!secretKey) {
    throw new Error('[pagarmeClient] Missing env PAGARME_SECRET_KEY');
  }

    const isTestKey = String(secretKey || '').startsWith('sk_test');

  return axios.create({
    baseURL: isTestKey
      ? 'https://sdx-api.pagar.me/core/v5'
      : 'https://api.pagar.me/core/v5',
    headers: {
      Authorization: buildBasicAuth(secretKey),
      'Content-Type': 'application/json',
    },
    timeout: 20000,
  });
}

module.exports = { createPagarmeClient };
