// src/utils/normalizeMusicUrl.js

function normalizeMusicUrl(url, platform) {
  if (!url || !platform) return url;

  if (platform.toLowerCase() === 'youtube') {
    try {
      const urlObj = new URL(url);
      let videoId = '';

      if (urlObj.hostname === 'youtu.be') {
        videoId = urlObj.pathname.slice(1);
      } else {
        videoId = urlObj.searchParams.get('v');
      }

      if (videoId) {
        return `https://www.youtube.com/watch?v=${videoId}`;
      }
    } catch (err) {
      console.warn('Erro ao normalizar URL do YouTube:', err);
    }
  }

  if (platform.toLowerCase() === 'spotify') {
    try {
      const match = url.match(/(track\/[a-zA-Z0-9]+)/);
      if (match && match[1]) {
        return `https://open.spotify.com/${match[1]}`;
      }
    } catch (err) {
      console.warn('Erro ao normalizar URL do Spotify:', err);
    }
  }

  if (platform.toLowerCase() === 'deezer') {
    try {
      const match = url.match(/(track\/[0-9]+)/);
      if (match && match[1]) {
        return `https://www.deezer.com/${match[1]}`;
      }
    } catch (err) {
      console.warn('Erro ao normalizar URL do Deezer:', err);
    }
  }

  // Se não conseguir normalizar, retorna original
  return url;
}

module.exports = {
  normalizeMusicUrl,
};
