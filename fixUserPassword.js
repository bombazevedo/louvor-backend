
// fixUserPassword.js
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const dotenv = require('dotenv');
dotenv.config();

const User = require('./src/models/User'); // ajuste o caminho se necessário

const fixPassword = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });

    const email = 'bombazevedo7@gmail.com';
    const newPassword = '33268230';

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      console.log('❌ Usuário não encontrado.');
      process.exit(1);
    }

    // Verifica se já está com hash
    if (user.password.startsWith('$2b$')) {
      console.log('⚠️ A senha já está com hash bcrypt. Nenhuma alteração feita.');
      process.exit(0);
    }

    const hashed = await bcrypt.hash(newPassword, 10);
    user.password = hashed;
    await user.save();

    console.log('✅ Senha atualizada com sucesso (agora está com hash bcrypt).');
    process.exit(0);
  } catch (err) {
    console.error('❌ Erro ao atualizar senha:', err);
    process.exit(1);
  }
};

fixPassword();
