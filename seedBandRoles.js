const mongoose = require('mongoose');
const dotenv = require('dotenv');
const BandRole = require('./models/BandRole');

dotenv.config();

const roles = [
  "Ministro", "Backing Vocal", "Violão", "Guitarra", "Baixo", "Bateria", "Teclado",
  "Piano", "Violino", "Triângulo", "Pandeiro", "Percussão", "Mesa de Som", "Acordeão",
  "Saxofone", "Trombone", "Trompete"
];

async function seed() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Conectado ao MongoDB');

    for (const name of roles) {
      const exists = await BandRole.findOne({ name });
      if (!exists) {
        await BandRole.create({ name });
        console.log(`🌱 Inserido: ${name}`);
      } else {
        console.log(`ℹ️ Já existe: ${name}`);
      }
    }

    console.log('✅ Seeding concluído!');
    process.exit();
  } catch (err) {
    console.error('❌ Erro no seeding:', err);
    process.exit(1);
  }
}

seed();
