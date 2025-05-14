// scripts/deleteOrphanScales.js
const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

const Scale = require('./src/models/Scale');
const Event = require('./src/models/Event');

(async () => {
  try {
    console.log('⏳ Conectando ao MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Conectado.');

    const allScales = await Scale.find();
    const allEvents = await Event.find();
    const validEventIds = new Set(allEvents.map(e => e._id.toString()));

    const orphanScales = allScales.filter(s => !validEventIds.has(s.eventId.toString()));

    for (const s of orphanScales) {
      await Scale.findByIdAndDelete(s._id);
      console.log(`🗑️ Escala órfã removida: ${s._id}`);
    }

    console.log(`✅ ${orphanScales.length} escalas órfãs removidas.`);
    process.exit(0);
  } catch (err) {
    console.error('❌ Erro ao limpar escalas órfãs:', err);
    process.exit(1);
  }
})();
