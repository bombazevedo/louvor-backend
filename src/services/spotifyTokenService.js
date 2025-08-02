require('dotenv').config(); // ✅ Para garantir acesso às variáveis de ambiente
const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Caminho do token salvo localmente (pode ser ajustado para Redis, Mongo etc.)
const TOKEN_FILE = path.join(__dirname, '../../spotify_token.json');

function saveTokens(tokens) {
  console.log('💾 Salvando tokens:', tokens);
  fs.writeFileSync(TOKEN_FILE, JSON.stringify(tokens, null, 2));
}

function loadTokens() {
  if (fs.existsSync(TOKEN_FILE)) {
    const tokens = JSON.parse(fs.readFileSync(TOKEN_FILE));
    console.log('📥 Tokens carregados do arquivo:', tokens);
    return tokens;
  }
  console.warn('⚠️ Nenhum token encontrado no arquivo local.');
  return null;
}

function saveAccessToken(token, expiresIn) {
  const tokens = loadTokens() || {};
  tokens.access_token = token;
  tokens.expires_at = Date.now() + (expiresIn * 1000) - 60000; // segurança de 1 min
  saveTokens(tokens);
}

function saveRefreshToken(refreshToken) {
  const tokens = loadTokens() || {};
  tokens.refresh_token = refreshToken;
  saveTokens(tokens);
}

async function refreshAccessToken() {
  const tokens = loadTokens();
  if (!tokens || !tokens.refresh_token) throw new Error('❌ Refresh token ausente.');

  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error('❌ SPOTIFY_CLIENT_ID ou SPOTIFY_CLIENT_SECRET não definidos nas variáveis de ambiente.');
  }

  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  console.log('🔐 Credenciais codificadas:', credentials);

  const params = new URLSearchParams();
  params.append('grant_type', 'refresh_token');
  params.append('refresh_token', tokens.refresh_token);

  try {
    const res = await axios.post(
      'https://accounts.spotify.com/api/token',
      params,
      {
        headers: {
          'Authorization': `Basic ${credentials}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }
    );

    console.log('✅ Novo token de acesso obtido via refresh.');
    saveAccessToken(res.data.access_token, res.data.expires_in);
    if (res.data.refresh_token) {
      saveRefreshToken(res.data.refresh_token);
    }
    return res.data.access_token;
  } catch (error) {
    console.error('❌ Erro ao renovar token de acesso:', error.response?.data || error.message);
    throw error;
  }
}

async function getValidAccessToken() {
  const tokens = loadTokens();
  if (!tokens || !tokens.access_token || Date.now() > (tokens.expires_at || 0)) {
    console.log('🔁 Token expirado ou ausente, tentando renovar...');
    return refreshAccessToken();
  }
  console.log('🔐 Token válido encontrado.');
  return tokens.access_token;
}

module.exports = {
  saveAccessToken,
  saveRefreshToken,
  getValidAccessToken,
  refreshAccessToken,
  loadTokens,
  saveTokens
};
