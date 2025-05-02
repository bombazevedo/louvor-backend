
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');

const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const eventRoutes = require('./routes/eventRoutes');
const songRoutes = require('./routes/songRoutes');
const repertoireRoutes = require('./routes/repertoireRoutes');
const scaleRoutes = require('./routes/scaleRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const chatRoutes = require('./routes/chatRoutes');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/songs', songRoutes);
app.use('/api/repertoires', repertoireRoutes);
app.use('/api/scales', scaleRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/chats', chatRoutes);

// Importação de escalas .xlsx
const importRoutes = require('./routes/importRoutes');
app.use('/api/import', importRoutes);

mongoose
  .connect(process.env.MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => {
    console.log('✅ Conectado ao MongoDB Atlas');
    app.listen(PORT, () => {
      console.log(`🚀 Servidor ouvindo em http://localhost:${PORT}`);
    });
  })
  .catch(err => console.error('Erro ao conectar no MongoDB:', err));
