// server.js
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config();

const app = express();

// Middlewares
app.use(cors());
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));

// Rotas
const authRoutes = require('./routes/authRoutes');
const orgRoutes = require('./routes/orgRoutes');
const userRoutes = require('./routes/userRoutes');
const bandRolesRoutes = require('./routes/bandRolesRoutes');
const eventRoutes = require('./routes/eventRoutes');
const scaleRoutes = require('./routes/scaleRoutes');
const songRoutes = require('./routes/songRoutes');
const repertoireRoutes = require('./routes/repertoireRoutes');
const historicoRoutes = require('./routes/historicoRoutes');
const utilsRoutes = require('./routes/utilsRoutes');
const teamRoutes = require('./routes/teamRoutes'); // <-- ADICIONADO
const unavailabilityRoutes = require('./routes/unavailabilityRoutes'); // <-- ADICIONADO
const musicRoutes = require('./routes/musicRoutes');
const chordRoutes = require('./routes/chordRoutes');
const spotifyAuthRoutes = require('./routes/spotifyAuthRoutes');

// ✅ Notificações com nome novo (OK)
const notificationsRoutes = require('./routes/notifications.routes');

// ✅ PUSH: importar e montar as rotas de push
const pushRoutes = require('./routes/push.routes');

// Usando as rotas
app.use('/api/auth', authRoutes);
app.use('/api/orgs', orgRoutes);
app.use('/api/users', userRoutes);
app.use('/api/band-roles', bandRolesRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/scales', scaleRoutes);
app.use('/api/songs', songRoutes);
app.use('/api/repertoires', repertoireRoutes);
app.use('/api/historico', historicoRoutes);
app.use('/api/utils', utilsRoutes);
app.use('/api/teams', teamRoutes);
app.use('/api/unavailability', unavailabilityRoutes);
app.use('/api/music', musicRoutes);
app.use('/api/chords', chordRoutes);
app.use('/api/auth/spotify', spotifyAuthRoutes);

// ✅ Rotas de Notificações
app.use('/api/notifications', notificationsRoutes);

// ✅ Rotas de PUSH (cadastro de token / teste)
app.use('/api/push', pushRoutes);

// Conexão MongoDB
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('✅ MongoDB conectado com sucesso'))
.catch((err) => console.error('❌ Erro na conexão com MongoDB:', err));

// Endpoint simples para checagem
app.get('/', (req, res) => {
  res.send('🚀 API do LouvorApp está rodando');
});

// Porta
const PORT = process.env.PORT || 5000;

// 🔎 Prova de vida
app.get('/api/health', (_req, res) => res.json({ ok: true, ts: Date.now() }));

// 🛡️ Handler global (evita 502 e mostra o erro real)
app.use((err, req, res, next) => {
  console.error('[GLOBAL ERROR]', err);
  if (res.headersSent) return next(err);
  const status = err.status || 500;
  res.status(status).json({
    error: status === 500 ? 'INTERNAL_SERVER_ERROR' : 'ERROR',
    message: err.message || 'Unexpected error'
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Servidor rodando na porta ${PORT}`);
});
