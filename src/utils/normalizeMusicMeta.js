// backend/src/utils/normalizeMusicMeta.js

function normalizeTitle(title = '') {
  return title
    .normalize('NFD')                                // Remove acentos
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\[.*?\]/g, '')                         // Remove colchetes
    .replace(/\(.*?\)/g, '')                         // Remove parênteses
    .replace(/\|.*$/g, '')                           // Remove tudo após '|'
    .replace(/(Clipe Oficial|Vídeo Oficial|Videoclipe|Oficial|Ao Vivo|Live|Lyric Video|Letra|DVD|Feat|Letra Oficial|HD|HQ|Versão Original|Tema de Novela|Full|Vídeo)/gi, '')
    .replace(/[-–_|•~•♪♫]+/g, ' ')                   // Remove pontuações repetitivas
    .replace(/#[\w-]+/g, '')                         // Remove hashtags
    .replace(/[0-9]{4,}/g, '')                       // Remove anos e códigos longos (ex: 2023)
    .replace(/[?!.,:;]+/g, '')                       // Remove pontuação residual (? ! . , :)
.replace(/[^a-zA-Z0-9À-ÿ\s]/g, '')               // Remove caracteres especiais restantes
.replace(/\s+/g, ' ')                            // Remove espaços extras
.trim()
.toLowerCase();                                  // Normaliza capitalização
}

function normalizeArtist(artist = '') {
  return artist
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\(.*?\)/g, '')                         // Remove parênteses
    .replace(/ - T[oó]pico/gi, '')                   // Remove sufixo "- Tópico"
    .replace(/vevo$/i, '')                           // Remove VEVO grudado no final
    .replace(/\bvevo\b/gi, '')                       // Remove VEVO isolado
    .replace(/Oficial/gi, '')                        // Remove "Oficial"
    .replace(/Letra/gi, '')                          // Remove "Letra"
    .replace(/\b(ao vivo|live|acústico|versão acústica|remix|remastered)\b/gi, '')
    .replace(/\[.*?\]/g, '')                         // Remove colchetes
    .replace(/,\s*$/, '')                            // Remove vírgula no final
    .replace(/\s+/g, ' ')                            // Remove múltiplos espaços
    .trim();
}

module.exports = {
  normalizeTitle,
  normalizeArtist,
};
