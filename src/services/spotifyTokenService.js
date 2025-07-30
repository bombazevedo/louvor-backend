const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Caminho seguro para guardar os tokens (ou use Mongo, Redis etc.)
const TOKEN_FILE = path.join(__dirname, '../../spotify_token.json');

function saveTokens(tokens) {
  fs.writeFileSync(TOKEN_FILE, JSON.stringify(tokens));
}

function loadTokens() {
  if (fs.existsSync(TOKEN_FILE)) {
    return JSON.parse(fs.readFileSync(TOKEN_FILE));
  }
  return null;
}

function saveAccessToken(token, expiresIn) {
  const tokens = loadTokens() || {};
  tokens.access_token = token;
  tokens.expires_at = Date.now() + (expiresIn * 1000) - 60000; // -1 min segurança
  saveTokens(tokens);
}

function saveRefreshToken(refreshToken) {
  const tokens = loadTokens() || {};
  tokens.refresh_token = refreshToken;
  saveTokens(tokens);
}

async function refreshAccessToken() {
  const tokens = loadTokens();
  if (!tokens || !tokens.refresh_token) throw new Error('No refresh token available');

  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

  const params = new URLSearchParams();
  params.append('grant_type', 'refresh_token');
  params.append('refresh_token', tokens.refresh_token);

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
  saveAccessToken(res.data.access_token, res.data.expires_in);
  if (res.data.refresh_token) {
    saveRefreshToken(res.data.refresh_token);
  }
  return res.data.access_token;
}

async function getValidAccessToken() {
  const tokens = loadTokens();
  if (!tokens || !tokens.access_token || Date.now() > (tokens.expires_at || 0)) {
    // precisa refrescar
    return refreshAccessToken();
  }
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
