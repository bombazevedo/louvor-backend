// scripts/generateCifraClubData.js

const fs = require('fs');
const axios = require('axios');
const cheerio = require('cheerio');
const path = require('path');

// === Funções de normalização ===
function normalizeText(text = '') {
  return text
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')  // remove acentos
    .replace(/[\r\n\t]/g, ' ')                         // remove quebras de linha
    .replace(/\s+/g, ' ')                              // espaços duplos
    .replace(/[^a-zA-Z0-9À-ÿ|&]/g, '')                 // remove símbolos estranhos
    .trim();
}

function normalizeTitle(title = '') {
  return normalizeText(title)
    .replace(/(Clipe Oficial|Vídeo Oficial|Ao Vivo|Letra|HD|HQ)/gi, '')
    .trim().toLowerCase();
}

function normalizeArtist(artist = '') {
  return normalizeText(artist)
    .replace(/VEVO| - Topico|Oficial/gi, '')
    .trim().toLowerCase();
}

// === Função para obter os links de artistas ===
async function fetchArtistLinks(pages = 4) {
  const baseUrl = 'https://www.cifraclub.com.br/mais-acessadas-artistas/';
  const artistMap = {};

  for (let i = 1; i <= pages; i++) {
    const url = `${baseUrl}?p=${i}`;
    console.log(`🔍 Buscando artistas: ${url}`);

    const { data } = await axios.get(url);
    const $ = cheerio.load(data);

    $('.art_mus').each((_, el) => {
      const name = $(el).text().trim();
      const href = $(el).attr('href')?.replace(/^\/|\/$/g, '');
      if (name && href) {
        const normalized = normalizeArtist(name);
        artistMap[normalized] = href;
      }
    });
  }

  return artistMap;
}

// === Função para obter as músicas mais acessadas ===
async function fetchTopSongs() {
  const url = 'https://www.cifraclub.com.br/mais-acessadas/';
  const songMap = {};

  const { data } = await axios.get(url);
  const $ = cheerio.load(data);

  $('.art_mus').each((_, el) => {
    const href = $(el).attr('href')?.replace(/^\/|\/$/g, '');
    const parts = href.split('/');
    if (parts.length === 2) {
      const [artistSlug, songSlug] = parts;
      const songName = normalizeTitle(songSlug.replace(/-/g, ' '));
      const artistName = normalizeArtist(artistSlug.replace(/-/g, ' '));
      const key = `${songName}|${artistName}`;
      songMap[key] = `${artistSlug}/${songSlug}`;
    }
  });

  return songMap;
}

// === Execução ===
(async () => {
  try {
    const artistMap = await fetchArtistLinks(5); // captura até 100 artistas
    const songMap = await fetchTopSongs();       // captura até 100 músicas

    const outputDir = path.join(__dirname, '../utils/CifraClub');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    fs.writeFileSync(`${outputDir}/artistMap.json`, JSON.stringify(artistMap, null, 2));
    fs.writeFileSync(`${outputDir}/songMap.json`, JSON.stringify(songMap, null, 2));

    console.log('✅ Arquivos gerados com sucesso:');
    console.log('- utils/CifraClub/artistMap.json');
    console.log('- utils/CifraClub/songMap.json');
  } catch (err) {
    console.error('❌ Erro durante geração dos dados:', err.message);
  }
})();
