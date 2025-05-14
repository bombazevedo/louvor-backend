// limparEscalasDuplicadas.js
require('dotenv').config(); // Carrega variáveis do .env

const mongoose = require('mongoose');
const Scale = require('./src/models/Scale'); // ajuste se o caminho for diferente

const MONGO_URL = process.env.MONGODB_URI;

if (!MONGO_URL) {
  console.error('❌ MONGODB_URI não definido no .env');
  process.exit(1);
}

console.log(`⏳ Conectando a ${MONGO_URL}...`);

mongoose.connect(MONGO_URL, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(async () => {
    console.log('✅ Conectado ao MongoDB');

    const escalas = await Scale.find();
    console.log(`🔍 ${escalas.length} escalas encontradas`);

    const result = await Scale.deleteMany({});
    console.log(`🧹 ${result.deletedCount} escalas deletadas.`);

    await mongoose.disconnect();
    process.exit(0);
  })
  .catch((err) => {
    console.error('❌ Erro na conexão MongoDB:', err.message);
    process.exit(1);
  });
