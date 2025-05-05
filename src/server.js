const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');

const authRoutes = require('./routes/authRoutes');
const eventRoutes = require('./routes/eventRoutes');
const importRoutes = require('./routes/importRoutes');
const userRoutes = require('./routes/userRoutes');
const scaleRoutes = require('./routes/scaleRoutes');
const repertoireRoutes = require('./routes/repertoireRoutes');

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log('✅ MongoDB conectado com sucesso'))
.catch(err => {
  console.error('❌ Erro ao conectar com MongoDB:', err);
  process.exit(1);
});

// Rotas da API
app.use('/api/auth', authRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/import', importRoutes);
app.use('/api/users', userRoutes);
app.use('/api/scales', scaleRoutes);
app.use('/api/repertoire', repertoireRoutes);

// Test route
app.get('/', (req, res) => {
  res.send('API do Louvor está rodando.');
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Servidor rodando na porta ${PORT}`);
});