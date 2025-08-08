// utils/normalizeUtils.js

function normalizeSongTitle(title) {
  return title
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // remove acentos
    .replace(/\(.*?\)|\[.*?\]/g, "")                  // remove colchetes e parênteses
    .replace(/\b(ao vivo|live|clipe oficial|video oficial|official video|feat\..*?)\b/gi, "")
    .replace(/^.*? - /, "")                           // remove artista duplicado no início
    .replace(/[^a-zA-Z0-9 ]/g, "")                    // remove pontuação
    .replace(/\s+/g, " ")                             // normaliza espaços
    .trim();
}

function normalizeArtistName(artist) {
  return artist
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9 ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

module.exports = {
  normalizeSongTitle,
  normalizeArtistName
};
