const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const cors = require('cors');

// Carregar variáveis de ambiente
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middlewares globais
app.use(cors());
app.use(express.json());

// Importação de rotas
const authRoutes = require('./routes/authRoutes');
const songRoutes = require('./routes/songRoutes');
const eventRoutes = require('./routes/eventRoutes');
const chatRoutes = require('./routes/chatRoutes');
const scaleRoutes = require('./routes/scaleRoutes');
const repertoireRoutes = require('./routes/repertoireRoutes');

// Rotas principais
app.use('/api/auth', authRoutes);
app.use('/api/songs', songRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/scales', scaleRoutes);
app.use('/api/repertoires', repertoireRoutes);

// Teste de rota raiz
app.get('/', (req, res) => {
  res.send('🎵 Servidor de Louvor Rodando com Sucesso!');
});

// Conexão MongoDB
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => {
  console.log('✅ Conectado ao MongoDB Atlas');
  app.listen(PORT, () => console.log(`🚀 Servidor ouvindo em http://localhost:${PORT}`));
})
.catch((err) => console.error('❌ Erro ao conectar ao MongoDB:', err.message));
ECHO est� ativado.
