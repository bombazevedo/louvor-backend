const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config();

const app = express();

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rotas
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const bandRoleRoutes = require('./routes/bandRoleRoutes');
const eventRoutes = require('./routes/eventRoutes');
const scaleRoutes = require('./routes/scaleRoutes');
const songRoutes = require('./routes/songRoutes');
const repertoireRoutes = require('./routes/repertoireRoutes');
const historicoRoutes = require('./routes/historicoRoutes');
const utilsRoutes = require('./routes/utilsRoutes');

// Usando as rotas
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/band-roles', bandRoleRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/scales', scaleRoutes);
app.use('/api/songs', songRoutes);
app.use('/api/repertoires', repertoireRoutes);
app.use('/api/historico', historicoRoutes);
app.use('/api/utils', utilsRoutes);

// Conexão MongoDB
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('✅ MongoDB conectado com sucesso'))
.catch((err) => console.error('❌ Erro na conexão com MongoDB:', err));

// Deploy - enviar o frontend React Native expo ou web futuramente
app.get('/', (req, res) => {
  res.send('🚀 API do LouvorApp está rodando');
});

// Definir porta
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Servidor rodando na porta ${PORT}`);
});
