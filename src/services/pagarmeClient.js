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

  // ✅ Teste (sk_test_*) usa sdx-api. Produção (sk_live_*) usa api.
  const isTestKey = String(secretKey).startsWith('sk_test_');

    const client = axios.create({
    baseURL: isTestKey
      ? 'https://sdx-api.pagar.me/core/v5'
      : 'https://api.pagar.me/core/v5',
    headers: {
      Authorization: buildBasicAuth(secretKey),
      'Content-Type': 'application/json',
    },
    timeout: 20000,
  });

  // debug cirúrgico: preserva request-id e response.data no erro
  client.interceptors.response.use(
    (resp) => resp,
    (err) => {
      try {
        err._pagarme = {
          status: err?.response?.status,
          reqId:
            err?.response?.headers?.['x-request-id'] ||
            err?.response?.headers?.['request-id'] ||
            err?.response?.headers?.['x-correlation-id'] ||
            null,
          data: err?.response?.data,
        };
      } catch (_) {}
      return Promise.reject(err);
    }
  );

  return client;

}

module.exports = { createPagarmeClient };
