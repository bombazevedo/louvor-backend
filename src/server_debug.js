
const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const cors = require('cors');
const morgan = require('morgan');

dotenv.config();

// 🔧 Logs de ambiente carregado
console.log('🧪 process.env.PORT:', process.env.PORT);
console.log('🧪 process.env.MONGODB_URI exists:', !!process.env.MONGODB_URI);
console.log('🧪 NODE_ENV:', process.env.NODE_ENV);

const app = express();

// 🟢 Rota ping SEM middleware para testar conectividade
app.get('/ping', (req, res) => {
  console.log('✅ Rota /ping acessada com sucesso');
  res.send('pong');
});

app.use(cors());
app.use(express.json());

try {
  app.use(morgan('dev'));
} catch (err) {
  console.error('❌ Erro ao configurar Morgan:', err.message);
}

// Rotas principais com logs defensivos
try {
  app.use('/api/events', require('./routes/eventRoutes'));
  app.use('/api/auth', require('./routes/authRoutes'));
  app.use('/api/users', require('./routes/userRoutes'));
  app.use('/api/scales', require('./routes/scaleRoutes'));
  app.use('/api/band-roles', require('./routes/bandRolesRoutes'));
  app.use('/api/repertoires', require('./routes/repertoireRoutes'));
  app.use('/api/songs', require('./routes/songRoutes'));
} catch (err) {
  console.error('❌ Erro ao importar rotas:', err.message);
}

// Conexão com MongoDB e start
console.log('🔄 Tentando conectar ao MongoDB...');
mongoose.connect(process.env.MONGODB_URI || '', {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => {
  console.log('✅ MongoDB conectado com sucesso');
  const PORT = process.env.PORT;
  app.listen(PORT, () => {
    console.log(`🚀 Servidor escutando na porta ${PORT}`);
  });
})
.catch((err) => {
  console.error('❌ Falha ao conectar no MongoDB:', err.message);
});
