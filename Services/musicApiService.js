
require('dotenv').config();
const axios = require('axios');

const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;
const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;

let spotifyToken = null;

const getSpotifyToken = async () => {
  if (spotifyToken) return spotifyToken;
  const res = await axios.post(
    'https://accounts.spotify.com/api/token',
    'grant_type=client_credentials',
    {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: 'Basic ' + Buffer.from(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`).toString('base64')
      }
    }
  );
  spotifyToken = res.data.access_token;
  return spotifyToken;
};

const searchYouTube = async (query) => {
  const res = await axios.get(
    `https://www.googleapis.com/youtube/v3/search?part=snippet&maxResults=5&q=${encodeURIComponent(query)}&key=${YOUTUBE_API_KEY}`
  );
  return res.data.items.map((item) => ({
    name: item.snippet.title,
    artist: item.snippet.channelTitle,
    url: `https://www.youtube.com/watch?v=${item.id.videoId}`,
    platform: 'YouTube',
  }));
};

const searchDeezer = async (query) => {
  const res = await axios.get(`https://api.deezer.com/search?q=${encodeURIComponent(query)}`);
  return res.data.data.slice(0, 5).map((track) => ({
    name: track.title,
    artist: track.artist.name,
    url: track.link,
    platform: 'Deezer',
  }));
};

const searchSpotify = async (query) => {
  const token = await getSpotifyToken();
  const res = await axios.get(`https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=track&limit=5`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  return res.data.tracks.items.map((track) => ({
    name: track.name,
    artist: track.artists.map((a) => a.name).join(', '),
    url: track.external_urls.spotify,
    platform: 'Spotify',
  }));
};

const unifiedSearch = async (query) => {
  const [yt, dz, sp] = await Promise.all([
    searchYouTube(query),
    searchDeezer(query),
    searchSpotify(query),
  ]);
  return [...yt, ...dz, ...sp];
};

const matchVersionsAcrossPlatforms = async ({ name, artist, platform, url }) => {
  const query = `${name} ${artist}`;
  const results = await unifiedSearch(query);
  const isSameVersion = (a, b) =>
    a.name.toLowerCase().includes(b.name.toLowerCase()) &&
    a.artist.toLowerCase().includes(b.artist.toLowerCase());

  const filtered = results.filter(
    (r) => r.platform !== platform && isSameVersion(r, { name, artist })
  );

  return {
    name,
    artist,
    url,
    platform,
    alternatives: filtered.map(({ platform, url }) => ({ platform, url }))
  };
};

module.exports = {
  searchYouTube,
  searchDeezer,
  searchSpotify,
  unifiedSearch,
  matchVersionsAcrossPlatforms,
};
