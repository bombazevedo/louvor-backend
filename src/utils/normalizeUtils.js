// utils/normalizeUtils.js

const TITLE_REMOVALS = [
  'ao vivo',
  'live',
  'clipe oficial',
  'vídeo oficial',
  'video oficial',
  'official video',
  'mk music',
  'dvd',
  'acústico',
  'e cia',
  'karaoke',
  'cover',
  'versão',
  'versao',
  'feat\\.? [^\\-\\,\\|\\(\\)\\[\\]]*',
  'participação especial',
  'part\\.? [^\\-\\,\\|\\(\\)\\[\\]]*',
  'lyric video',
  'letra',
  'remix',
  'studio session',
  'playback',
  'instrumental',
  'official audio',
  'audio oficial',
  'ao vivo no',
  'sessão',
  'sessao',
  'original',
  'single',
  'prod\\.? [^\\-\\,\\|\\(\\)\\[\\]]*'
];

function normalizeSongTitle(title) {
  let t = title.toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // remove acentos
    .replace(/\(.*?\)|\[.*?\]/g, "")                  // remove colchetes e parênteses

  TITLE_REMOVALS.forEach((expr) => {
    t = t.replace(new RegExp("\\b" + expr + "\\b", "gi"), "");
  });

  t = t
    .replace(/^.*? - /, "")                           // remove artista duplicado no início
    .replace(/[^a-zA-Z0-9 ]/g, "")                    // remove pontuação
    .replace(/\s+/g, " ")                             // normaliza espaços
    .trim();

  return t;
}

function normalizeArtistName(artist) {
  let t = artist.toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9 ]/g, "")
    .replace(/\s+/g, " ")
    .trim();

  // Remove termos irrelevantes de gravadora, coletivos, etc.
  t = t.replace(/\b(mk music|sony music|som livre|vevo|records|and friends|e cia)\b/gi, "");
  t = t.replace(/\s+/g, " ").trim();
  return t;
}

module.exports = {
  normalizeSongTitle,
  normalizeArtistName
};
