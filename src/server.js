const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const cors = require('cors');

dotenv.config();
const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Mock de eventos
const events = [
  { id: '1', title: 'Culto de Louvor', date: '2024-05-01', location: 'Igreja Central' },
  { id: '2', title: 'Ensaio', date: '2024-05-05', location: 'Salão B' }
];

// Mock de músicas
const songs = [
  { id: '1', title: 'Grandes Coisas', artist: 'Fernandinho' },
  { id: '2', title: 'Te Louvarei', artist: 'Toque no Altar' }
];

// Rota principal
app.get('/', (req, res) => {
  res.send('Servidor rodando! ✅');
});

// Listar todos os eventos
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

// Listar músicas
app.get('/api/songs', (req, res) => {
  res.status(200).json(songs);
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
.catch((err) => console.error('❌ MongoDB error:', err.message));