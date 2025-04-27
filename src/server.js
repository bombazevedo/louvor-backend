// src/server.js
const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const cors = require('cors');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Teste de rota padrão
app.get('/', (req, res) => {
  res.send('Servidor rodando! ✅');
});

// Rota de teste para verificar se API está online
app.get('/api/ping', (req, res) => {
  res.status(200).json({ message: 'Server is running ✅' });
});

// 🆕 Rota mockada para /api/events
app.get('/api/events', (req, res) => {
  res.status(200).json([
    { id: 1, title: 'Culto de Louvor', date: '2024-05-01', location: 'Igreja Central' },
    { id: 2, title: 'Ensaio', date: '2024-05-05', location: 'Salão B' }
  ]);
});

// 🆕 Rota mockada para /api/songs
app.get('/api/songs', (req, res) => {
  res.status(200).json([
    { id: 1, title: 'Grandes Coisas', artist: 'Fernandinho' },
    { id: 2, title: 'Te Louvarei', artist: 'Toque no Altar' }
  ]);
});

// Conexão com MongoDB Atlas
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => {
  console.log('✅ Connected to MongoDB Atlas');
  app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
  });
})
.catch((err) => {
  console.error('❌ Error connecting to MongoDB Atlas:', err.message);
});
