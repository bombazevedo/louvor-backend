// src/server.js atualizado completo

const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const cors = require('cors');

// Importar Rotas
const songRoutes = require('./routes/songRoutes');
const authRoutes = require('./routes/authRoutes'); // <-- Novo

dotenv.config();
const app = express();
const PORT = process.env.PORT || 5000;

// Middlewares
app.use(cors());
app.use(express.json());

// Rotas principais
app.use('/auth', authRoutes); // <-- Novo
app.use('/api/songs', songRoutes);

// Mock de eventos
const events = [
  { id: '1', title: 'Culto de Louvor', date: '2024-05-01', location: 'Igreja Central' },
  { id: '2', title: 'Ensaio', date: '2024-05-05', location: 'Salão B' }
];

app.get('/', (req, res) => {
  res.send('Servidor rodando! ✅');
});

app.get('/api/events', (req, res) => {
  res.status(200).json(events);
});

app.get('/api/events/:id', (req, res) => {
  const event = events.find(e => e.id === req.params.id);
  if (event) {
    res.json(event);
  } else {
    res.status(404).json({ message: 'Evento não encontrado' });
  }
});

// Conexão MongoDB
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => {
  console.log('✅ Connected to MongoDB Atlas');
  app.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}`));
})
.catch((err) => console.error('❌ MongoDB connection error:', err.message));
