// limparMembersAntigos.js
const mongoose = require('mongoose');
require('dotenv').config();
const Event = require('./src/models/Event');

const start = async () => {
  console.log('⏳ Conectando ao MongoDB...');
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('✅ Conectado!');

  const eventosComMembers = await Event.find({ members: { $exists: true, $not: { $size: 0 } } });

  console.log(`🔍 Encontrados ${eventosComMembers.length} eventos com members embutidos`);

  for (const event of eventosComMembers) {
    event.members = []; // limpa a lista embutida
    await event.save();
  }

  console.log(`🧹 ${eventosComMembers.length} eventos atualizados com members limpos.`);
  await mongoose.disconnect();
};

start();
