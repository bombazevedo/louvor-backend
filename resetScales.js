const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Scale = require('../models/Scale');
const Event = require('../models/Event');
const User = require('../models/User');

dotenv.config();

const MONGO_URI = process.env.MONGODB_URI;

async function resetScales() {
  console.log('⏳ Conectando ao MongoDB...');
  await mongoose.connect(MONGO_URI);
  console.log('✅ Conectado.');

  const escalas = await Scale.find();
  console.log(`🧨 Apagando ${escalas.length} escalas existentes...`);
  await Scale.deleteMany({});

  const eventos = await Event.find();
  const usuarios = await User.find();

  console.log(`📅 Encontrados ${eventos.length} eventos`);
  const escalasCriadas = [];

  for (const evento of eventos) {
    // Apenas exemplo: sorteia 2 usuários para cada evento
    const sorteados = usuarios.sort(() => 0.5 - Math.random()).slice(0, 2);

    const members = sorteados.map((u, i) => ({
      user: u._id,
      function: i === 0 ? 'Ministro' : 'Guitarra',
      confirmed: false
    }));

    const nova = new Scale({
      eventId: evento._id,
      members,
      notes: 'Gerado automaticamente para teste'
    });

    const saved = await nova.save();
    escalasCriadas.push(saved._id);
    console.log(`✅ Escala criada para evento "${evento.title}"`);
  }

  console.log(`✨ ${escalasCriadas.length} escalas criadas com sucesso.`);
  await mongoose.disconnect();
  console.log('🔌 Desconectado do MongoDB.');
}

resetScales().catch(err => {
  console.error('❌ Erro durante reset:', err.message);
  mongoose.disconnect();
});
