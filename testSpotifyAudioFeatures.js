// testSpotifyAudioFeatures.js
const axios = require('axios');
const { getValidAccessToken } = require('./src/services/spotifyTokenService');

// ID da música no Spotify para teste
const TRACK_ID = '3n3Ppam7vgaVa1iaRUc9Lp'; // Exemplo: "Hey Ya!" - Outkast

async function testAudioFeatures() {
  try {
    const token = await getValidAccessToken();

    const response = await axios.get(
      `https://api.spotify.com/v1/audio-features/${TRACK_ID}`,
      {
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    );

    const { tempo, key, mode, danceability, energy } = response.data;
    console.log('🎧 Dados retornados pela API do Spotify:');
    console.log(`- BPM: ${tempo}`);
    console.log(`- Key: ${key}`);
    console.log(`- Mode: ${mode}`);
    console.log(`- Danceability: ${danceability}`);
    console.log(`- Energy: ${energy}`);
  } catch (err) {
    console.error('❌ Erro ao buscar audio-features:', err.response?.data || err.message);
  }
}

testAudioFeatures();
