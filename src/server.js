// src/server.js
const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const cors = require('cors');

// Rotas
const songRoutes = require('./routes/songRoutes');

dotenv.config();
const app = express();
const PORT = process.env.PORT || 5000;

// Middlewares
app.use(cors());
app.use(express.json());

// Mock de eventos (ainda mock por enquanto)
const events = [
  { id: '1', title: 'Culto de Louvor', date: '2024-05-01', location: 'Igreja Central' },
  { id: '2', title: 'Ensaio', date: '2024-05-05', location: 'Salão B' }
];

// Rotas principais
app.get('/', (req, res) => {
  res.send('Servidor rodando! ✅');
});

// Rota para listar todos eventos
app.get('/api/events', (req, res) => {
  res.status(200).json(events);
});

// Buscar evento por ID
app.get('/api/events/:id', (req, res) => {
  const event = events.find(e => e.id === req.params.id);
  if (event) {
    res.json(event);
  } else {
    res.status(404).json({ message: 'Evento não encontrado' });
  }
});

// Rota para músicas (cadastro e listagem)
app.use('/api/songs', songRoutes);

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
