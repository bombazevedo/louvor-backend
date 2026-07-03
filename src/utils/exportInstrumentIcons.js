const fs = require('fs');
const path = require('path');

const ICONS_DIR = path.join(__dirname, '..', 'assets', 'instruments');
const cache = {};

function normalizeIconKey(value = '') {
  return String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

const aliases = {
  'back_vocal': 'backing_vocal',
  'backing': 'backing_vocal',
  'backing_vocal': 'backing_vocal',
  'voz': 'ministro',
  'violao': 'violao',
  'mesa_de_som': 'mesa_de_som',
  'som': 'mesa_de_som',
  'audio': 'mesa_de_som',
  'iluminacao': 'lighting',
  'luz': 'lighting',
  'projecao': 'projection',
  'transmissao': 'streaming',
  'sax': 'saxofone',
};

function loadIcon(fileKey) {
  const key = aliases[fileKey] || fileKey;
  const fileName = `${key}.png`;

  if (cache[fileName]) return cache[fileName];

  const filePath = path.join(ICONS_DIR, fileName);
  if (!fs.existsSync(filePath)) return null;

  const base64 = fs.readFileSync(filePath).toString('base64');
  const dataUrl = `data:image/png;base64,${base64}`;

  cache[fileName] = dataUrl;
  return dataUrl;
}

function getExportInstrumentIcon(roleNameOrKey = '') {
  const key = normalizeIconKey(roleNameOrKey);
  return loadIcon(key);
}

module.exports = {
  getExportInstrumentIcon,
};