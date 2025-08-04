// utils/normalizeMusicMeta.js

export function normalizeTitle(title = '') {
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
    .replace(/[^a-zA-Z0-9À-ÿ\s]/g, '')               // Remove caracteres especiais restantes
    .replace(/\s+/g, ' ')                            // Remove espaços extras
    .trim();
}

export function normalizeArtist(artist = '') {
  return artist
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\(.*?\)/g, '')                         // Remove parênteses
    .replace(/ - T[oó]pico/gi, '')                   // Remove sufixo "- Tópico"
    .replace(/VEVO/gi, '')                           // Remove sufixo VEVO
    .replace(/Oficial/gi, '')                        // Remove "Oficial"
    .replace(/Letra/gi, '')                          // Remove "Letra"
    .replace(/\[.*?\]/g, '')                         // Remove colchetes
    .replace(/\s+/g, ' ')                            // Remove múltiplos espaços
    .trim();
}
