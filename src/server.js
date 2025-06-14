require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');

const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const eventRoutes = require('./routes/eventRoutes');
const bandRoleRoutes = require('./routes/bandRoleRoutes');
const scaleRoutes = require('./routes/scaleRoutes');
const songRoutes = require('./routes/songRoutes');
const repertoireRoutes = require('./routes/repertoireRoutes');
const historicoRoutes = require('./routes/historicoRoutes');
const utilsRoutes = require('./routes/utilsRoutes'); // ✅ Adicionado para utils

const app = express();

// Middlewares
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Conexão com MongoDB
mongoose.connect(process.env.MONGO_URL, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
  .then(() => console.log('✅ Conectado ao MongoDB'))
  .catch(err => console.error('❌ Erro na conexão com MongoDB:', err));

// Rotas API
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/band-roles', bandRoleRoutes);
app.use('/api/scales', scaleRoutes);
app.use('/api/songs', songRoutes);
app.use('/api/repertoires', repertoireRoutes);
app.use('/api/historico', historicoRoutes);
app.use('/api/utils', utilsRoutes); // ✅ Aplicação correta da rota utils

// Rota padrão para testar se o backend está funcionando
app.get('/', (req, res) => {
  res.send('Servidor do LouvorApp rodando 🚀');
});

// Tratamento de erros não tratados (404)
app.use((req, res) => {
  res.status(404).json({ message: 'Rota não encontrada' });
});

// Start do servidor
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`🚀 Servidor rodando na porta ${PORT}`);
});
