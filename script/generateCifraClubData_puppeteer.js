const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const ARTISTS_URL = 'https://www.cifraclub.com.br/letras/';
const SONGS_URL = 'https://www.cifraclub.com.br/mais-acessadas/';

async function fetchArtistMap() {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  await page.goto(ARTISTS_URL, { waitUntil: 'domcontentloaded' });

  const artistMap = await page.evaluate(() => {
    const map = {};
    const items = document.querySelectorAll('a.artists-list__link');
    items.forEach((a) => {
      const name = a.textContent.trim();
      const url = a.href;
      if (name && url) map[name] = url;
    });
    return map;
  });

  await browser.close();
  return artistMap;
}

async function fetchSongMap() {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  await page.goto(SONGS_URL, { waitUntil: 'domcontentloaded' });

  const songMap = await page.evaluate(() => {
    const map = {};
    const rows = document.querySelectorAll('.music-list__list li.music-list__item');
    rows.forEach((row) => {
      const title = row.querySelector('.music-list__name')?.textContent?.trim();
      const artist = row.querySelector('.music-list__band')?.textContent?.trim();
      const link = row.querySelector('a')?.href;
      if (title && artist && link) {
        map[`${title} - ${artist}`] = link;
      }
    });
    return map;
  });

  await browser.close();
  return songMap;
}

async function main() {
  console.log('⏳ Coletando artistas...');
  const artistMap = await fetchArtistMap();
  fs.writeFileSync(path.join(__dirname, 'artistMap.json'), JSON.stringify(artistMap, null, 2));
  console.log('✅ Arquivo artistMap.json gerado com', Object.keys(artistMap).length, 'itens');

  console.log('⏳ Coletando músicas...');
  const songMap = await fetchSongMap();
  fs.writeFileSync(path.join(__dirname, 'songMap.json'), JSON.stringify(songMap, null, 2));
  console.log('✅ Arquivo songMap.json gerado com', Object.keys(songMap).length, 'itens');
}

main();
