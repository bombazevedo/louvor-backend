const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const authRoutes = require('./routes/authRoutes');
const eventRoutes = require('./routes/eventRoutes');
const importRoutes = require('./routes/importRoutes');

dotenv.config();
const app = express();

// Middlewares essenciais
app.use(cors());
app.use(express.json()); // ✅ Necessário para ler JSON no body

// Conectar ao MongoDB
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => console.log('MongoDB conectado'))
  .catch(err => console.error('Erro ao conectar MongoDB:', err));

// ✅ Rotas
app.use('/api/auth', authRoutes);
app.use('/api/events', eventRoutes);          // <-- Aponta para createEvent, getAllEvents etc.
app.use('/api/import', importRoutes);

// Rota padrão
app.get('/', (req, res) => {
  res.send('API do Louvor está rodando.');
});

// Iniciar servidor
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
