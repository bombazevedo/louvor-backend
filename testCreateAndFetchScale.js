
const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

const Scale = require('./src/models/Scale');
const User = require('./src/models/User');
const Event = require('./src/models/Event');

(async () => {
  try {
    console.log('⏳ Conectando ao MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Conectado.');

    // 🧪 Buscar um evento existente
    const event = await Event.findOne();
    if (!event) {
      console.log('❌ Nenhum evento encontrado.');
      return;
    }

    // 🧪 Buscar dois usuários existentes
    const users = await User.find().limit(2);
    if (users.length < 2) {
      console.log('❌ Menos de 2 usuários cadastrados.');
      return;
    }

    // 🔧 Criar uma nova escala para esse evento
    const scale = new Scale({
      eventId: event._id,
      members: [
        { user: users[0]._id, function: 'Guitarra', confirmed: false },
        { user: users[1]._id, function: 'Ministro', confirmed: true }
      ],
      notes: 'Teste automático'
    });

    await scale.save();

    // 🔄 Buscar e popular
    const populated = await Scale.findOne({ eventId: event._id }).populate('members.user', 'name email');
    console.log('📋 Escala populada:', JSON.stringify(populated, null, 2));

    // Finaliza
    await mongoose.disconnect();
    console.log('🔌 Desconectado.');
  } catch (err) {
    console.error('❌ Erro:', err.message);
  }
})();
