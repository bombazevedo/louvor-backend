// ✅ seedBandRoles.js
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const BandRole = require('./src/models/BandRole');

dotenv.config();

const MONGO_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/louvorapp';

const defaultRoles = [
  'Ministro',
  'Backing Vocal',
  'Violão',
  'Guitarra',
  'Baixo',
  'Bateria',
  'Teclado',
  'Piano',
  'Violino',
  'Triângulo',
  'Pandeiro',
  'Percussão',
  'Mesa de Som',
  'Acordeão',
  'Saxofone',
  'Trombone',
  'Trompete'
];

async function seedRoles() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('✅ Conectado ao MongoDB');

    for (const name of defaultRoles) {
      const exists = await BandRole.findOne({ name });
      if (!exists) {
        await BandRole.create({ name });
        console.log(`🌱 Inserido: ${name}`);
      } else {
        console.log(`⚠️ Já existe: ${name}`);
      }
    }

    console.log('✅ Seeding concluído!');
    mongoose.disconnect();
  } catch (err) {
    console.error('Erro ao executar seeding:', err);
    mongoose.disconnect();
  }
}

seedRoles();
