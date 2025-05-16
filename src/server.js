
const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const cors = require('cors');
const morgan = require('morgan');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 8080;

app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

// Importação de rotas
const eventRoutes = require('./routes/eventRoutes');
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const scaleRoutes = require('./routes/scaleRoutes');
const bandRolesRoutes = require('./routes/bandRolesRoutes');
const repertoireRoutes = require('./routes/repertoireRoutes');
const songRoutes = require('./routes/songRoutes');

// Montagem de rotas
app.use('/api/events', eventRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/scales', scaleRoutes);
app.use('/api/band-roles', bandRolesRoutes);
app.use('/api/repertoires', repertoireRoutes);
app.use('/api/songs', songRoutes);

// Conexão com MongoDB
mongoose.connect(process.env.MONGODB_URI || '', {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => {
  console.log('✅ MongoDB conectado com sucesso');
  app.listen(PORT, () => {
    console.log(`🚀 Servidor rodando na porta ${PORT}`);
  });
})
.catch((err) => {
  console.error('❌ Erro ao conectar no MongoDB:', err.message);
});
