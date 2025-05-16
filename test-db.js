const mongoose = require('mongoose');
require('dotenv').config();

mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => {
  console.log('✅ Conexão com MongoDB OK!');
  process.exit(0);
})
.catch((err) => {
  console.error('❌ Falha ao conectar com MongoDB:', err.message);
  process.exit(1);
});
