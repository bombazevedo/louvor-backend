// src/server.js
console.log("🛠️ server.js iniciado - hash de controle 2501");

const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const cors = require('cors');
const morgan = require('morgan');

dotenv.config();

console.log('🧪 process.env.PORT:', process.env.PORT);
console.log('🧪 process.env.MONGODB_URI exists:', !!process.env.MONGODB_URI);
console.log('🧪 NODE_ENV:', process.env.NODE_ENV);

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

try {
  app.use(morgan('dev'));
} catch (err) {
  console.error('❌ Erro ao configurar Morgan:', err.message);
}

// Test Route
app.get('/ping', (req, res) => {
  console.log('✅ /ping recebido');
  res.send('pong');
});

// Rotas principais
try {
  app.use('/api/auth', require('./routes/authRoutes'));
  app.use('/api/users', require('./routes/userRoutes'));
  app.use('/api/events', require('./routes/eventRoutes'));
  app.use('/api/scales', require('./routes/scaleRoutes'));
  app.use('/api/band-roles', require('./routes/bandRolesRoutes'));
  app.use('/api/repertoires', require('./routes/repertoireRoutes'));
  app.use('/api/songs', require('./routes/songRoutes'));
  app.use('/api/music', require('./routes/musicRoutes'));   // singular
  app.use('/api/musics', require('./routes/musicRoutes'));  // plural
} catch (err) {
  console.error('❌ Erro ao montar rotas:', err.message);
  console.error(err);
}

// MongoDB Connection
console.log('🔄 Tentando conectar ao MongoDB...');
mongoose.connect(process.env.MONGODB_URI || '', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => {
  console.log('✅ MongoDB conectado com sucesso');
  app.listen(PORT, () => {
    console.log(`🚀 Servidor rodando na porta ${PORT}`);
  });
})
.catch((err) => {
  console.error('❌ Falha ao conectar no MongoDB:', err.message);
});
