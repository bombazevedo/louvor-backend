// testSpotifyAudioFeatures.js
const axios = require('axios');
const { getValidAccessToken } = require('./src/services/spotifyTokenService');

async function testAudioFeatures(trackId) {
  try {
    const accessToken = await getValidAccessToken();
    console.log('🔐 Token OK! Fazendo requisição para audio-features...');

    const response = await axios.get(`https://api.spotify.com/v1/audio-features/${trackId}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    });

    const features = response.data;
    console.log('\n🎵 [RESULTADO SPOTIFY AUDIO FEATURES]');
    console.log(`🎧 Track ID: ${trackId}`);
    console.log(`🎼 BPM: ${features.tempo}`);
    console.log(`🎹 Key (Tonalidade): ${features.key}`);
    console.log(`🔁 Mode (0 = menor, 1 = maior): ${features.mode}`);
    console.log(`🎚️ Energy: ${features.energy}`);
    console.log(`🎛️ Danceability: ${features.danceability}`);
    console.log(`🎵 Acousticness: ${features.acousticness}`);
    console.log(`🎶 Instrumentalness: ${features.instrumentalness}`);
    console.log(`🔊 Loudness: ${features.loudness}`);
    console.log(`🕒 Duration (ms): ${features.duration_ms}`);
  } catch (error) {
    console.error('\n❌ Erro ao buscar audio-features:');
    if (error.response) {
      console.error('📡 Status:', error.response.status);
      console.error('🧾 Data:', error.response.data);
    } else {
      console.error(error.message);
    }
  }
}

// ID da música "Oceans" (Hillsong United)
const trackId = '5SDcksP8En1l6RtTY1wzHc';
testAudioFeatures(trackId);
