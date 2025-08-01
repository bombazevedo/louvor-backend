// testSpotifyAudioFeatures.js
const axios = require('axios');
const { getValidAccessToken } = require('./src/services/spotifyTokenService');

async function run() {
  const token = await getValidAccessToken();
  const trackId = '1EXbrQ9H2aXlttiL7Zy4fC'; // Exemplo: Evil Morty Rap

  try {
    const res = await axios.get(`https://api.spotify.com/v1/audio-features/${trackId}`, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    console.log('🎧 Features da faixa:');
    console.log('🎵 BPM:', res.data.tempo);
    console.log('🎼 Key:', res.data.key);
    console.log('🎹 Mode:', res.data.mode);
  } catch (err) {
    console.error('❌ Erro ao buscar audio-features:', err.response?.data || err.message);
  }
}

run();
